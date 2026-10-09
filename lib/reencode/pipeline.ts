/**
 * Re-encode pipeline (WebCodecs): decode → optional downscale/frame-drop →
 * encode H.264, then mux with the original audio track.
 *
 * 100% client-side: works in the page or a worker, no ffmpeg. Support is
 * probed at runtime because WebCodecs availability varies per browser.
 * The audio track is copied bit-for-bit; only the video stream is encoded.
 */

import { PatchError } from "@/lib/mp4/boxes";
import type { MediaContext } from "@/lib/mp4/inspect";
import { type DemuxedVideo, demuxAudio, demuxVideo } from "./demux";
import { type MuxVideoSample, muxProgressive } from "./mux";

export type ReencodePresetId = "keep" | "1080p30" | "1080p60" | "720p30";

export interface ReencodePreset {
  id: Exclude<ReencodePresetId, "keep">;
  /** Longest edge cap (keeps aspect ratio, never upscales). */
  maxSide: number;
  /** Frame-rate cap (drops frames above it; never invents frames). */
  fps: number;
  /** Reference bitrate for the preset's reference resolution. */
  bitrateBps: number;
}

export const REENCODE_PRESETS: ReencodePreset[] = [
  { id: "1080p30", maxSide: 1920, fps: 30, bitrateBps: 10_000_000 },
  { id: "1080p60", maxSide: 1920, fps: 60, bitrateBps: 14_000_000 },
  { id: "720p30", maxSide: 1280, fps: 30, bitrateBps: 5_000_000 },
];

export interface ReencodeTarget {
  width: number;
  height: number;
  fps: number;
  bitrateBps: number;
}

export function webCodecsAvailable(): boolean {
  return (
    typeof VideoDecoder !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

/** True when this browser can actually encode H.264 via WebCodecs. */
export async function reencodeSupported(): Promise<boolean> {
  if (!webCodecsAvailable()) return false;
  try {
    const probe = await VideoEncoder.isConfigSupported({
      codec: "avc1.640028",
      width: 640,
      height: 480,
      bitrate: 2_000_000,
      framerate: 30,
      avc: { format: "avc" },
    });
    return probe.supported === true;
  } catch {
    return false;
  }
}

/**
 * Resolves the encode target for a preset: caps the longest edge (no
 * upscaling), caps the frame rate (no invented frames) and scales the
 * bitrate to the actual output pixels.
 */
export function computeTarget(
  source: { width: number; height: number; fps: number },
  preset: ReencodePreset,
): ReencodeTarget {
  const longest = Math.max(source.width, source.height);
  const scale = longest > 0 ? Math.min(1, preset.maxSide / longest) : 1;
  const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
  const width = even(source.width * scale);
  const height = even(source.height * scale);
  const fps =
    source.fps > preset.fps + 1
      ? preset.fps
      : Math.max(1, Math.round(source.fps * 100) / 100);
  const refPixels = preset.maxSide >= 1920 ? 1920 * 1080 : 1280 * 720;
  const scaled = (preset.bitrateBps * (width * height) * fps) / (refPixels * preset.fps);
  const bitrateBps = Math.round(Math.min(Math.max(scaled, 800_000), preset.bitrateBps * 1.25));
  return { width, height, fps, bitrateBps };
}

async function chooseConfig(target: ReencodeTarget): Promise<VideoEncoderConfig> {
  const candidates = [
    ...(target.fps > 30.5 ? ["avc1.64002A", "avc1.640028"] : ["avc1.640028"]),
    "avc1.4D401F",
    "avc1.42E01E",
  ];
  const seen = new Set<string>();
  for (const codec of candidates) {
    if (seen.has(codec)) continue;
    seen.add(codec);
    const config: VideoEncoderConfig = {
      codec,
      width: target.width,
      height: target.height,
      bitrate: target.bitrateBps,
      framerate: target.fps,
      avc: { format: "avc" },
      latencyMode: "quality",
    };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return support.config ?? config;
    } catch {
      // try the next candidate
    }
  }
  throw new PatchError("reencode-unavailable");
}

function toUint8(v: AllowSharedBufferSource): Uint8Array {
  if (ArrayBuffer.isView(v)) {
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  return new Uint8Array(v as ArrayBufferLike);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asPatch(err: unknown): PatchError {
  return err instanceof PatchError ? err : new PatchError("reencode-failed", String(err));
}

/**
 * Re-encodes the video track of `context`'s file for the given preset and
 * returns a new progressive MP4 (audio untouched). Throws {@link PatchError}
 * with `reencode-unavailable` or `reencode-failed`.
 */
export async function reencodeFile(
  context: MediaContext,
  presetId: Exclude<ReencodePresetId, "keep">,
  onProgress?: (fraction: number) => void,
): Promise<File> {
  if (!webCodecsAvailable()) throw new PatchError("reencode-unavailable");
  const preset = REENCODE_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new PatchError("reencode-unavailable");

  const video: DemuxedVideo = demuxVideo(context);
  const audio = demuxAudio(context);
  const target = computeTarget(
    { width: video.width, height: video.height, fps: video.avgFps },
    preset,
  );
  const config = await chooseConfig(target);

  const encoded: MuxVideoSample[] = [];
  let description: Uint8Array | null = null;
  let failure: PatchError | null = null;
  const fail = (err: unknown) => {
    failure ??= asPatch(err);
  };

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (!description) {
        const desc = meta?.decoderConfig?.description;
        if (desc) description = toUint8(desc);
      }
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      encoded.push({ ptsUs: chunk.timestamp, isKey: chunk.type === "key", data });
    },
    error: (err) => fail(err),
  });

  const pending = new Set<Promise<void>>();
  const decoder = new VideoDecoder({
    output: (frame) => {
      const task = handleFrame(frame).finally(() => pending.delete(task));
      pending.add(task);
    },
    error: (err) => fail(err),
  });

  const keyByPts = new Map<number, true>();
  for (const s of video.samples) {
    if (s.isKey) keyByPts.set(s.ptsUs, true);
  }
  const decimate = video.avgFps > preset.fps + 1;
  const stepUs = decimate ? Math.round(1_000_000 / preset.fps) : 0;
  let nextKeepUs = -Infinity;
  let firstKept = true;

  async function handleFrame(frame: VideoFrame): Promise<void> {
    let source: VideoFrame | null = null;
    try {
      if (failure) return;
      if (stepUs > 0) {
        if (frame.timestamp < nextKeepUs) return;
        nextKeepUs = frame.timestamp + stepUs;
      }
      const isKey = firstKept || keyByPts.get(frame.timestamp) === true;
      firstKept = false;
      source = frame;
      if (frame.displayWidth !== target.width || frame.displayHeight !== target.height) {
        const canvas = new OffscreenCanvas(target.width, target.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new PatchError("reencode-failed");
        ctx.drawImage(frame, 0, 0, target.width, target.height);
        const init: VideoFrameBufferInit = {
          timestamp: frame.timestamp,
          codedWidth: target.width,
          codedHeight: target.height,
          format: "RGBA",
        };
        if (frame.duration != null) init.duration = frame.duration;
        source = new VideoFrame(canvas, init);
      }
      encoder.encode(source, { keyFrame: isKey });
      while (encoder.encodeQueueSize > 6 && !failure) await sleep(4);
    } catch (err) {
      fail(err);
    } finally {
      if (source && source !== frame) source.close();
      frame.close();
    }
  }

  decoder.configure({ codec: video.codec, description: video.description });
  encoder.configure(config);

  const total = video.samples.length;
  let fed = 0;
  for (const s of video.samples) {
    if (failure) break;
    const data = await context.file.slice(s.offset, s.offset + s.size).arrayBuffer();
    decoder.decode(
      new EncodedVideoChunk({ type: s.isKey ? "key" : "delta", timestamp: s.ptsUs, data }),
    );
    fed++;
    if (fed % 8 === 0) {
      onProgress?.(Math.min(0.9, (fed / total) * 0.9));
      while (decoder.decodeQueueSize > 12 && !failure) await sleep(4);
    }
  }
  if (failure) throw failure;

  await decoder.flush();
  while (pending.size > 0) await Promise.all([...pending]);
  if (failure) throw failure;
  await encoder.flush();
  if (failure) throw failure;
  try {
    decoder.close();
  } catch {
    /* already closed */
  }
  try {
    encoder.close();
  } catch {
    /* already closed */
  }

  if (!description || encoded.length === 0) throw new PatchError("reencode-failed");
  onProgress?.(0.95);

  const out = muxProgressive({
    context,
    video,
    encoded,
    description,
    width: target.width,
    height: target.height,
    audio,
  });
  onProgress?.(1);
  return out;
}
