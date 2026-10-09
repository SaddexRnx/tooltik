/**
 * Gate 3: decoded-frame equivalence (browser WebCodecs only).
 *
 * The structural and payload gates prove byte-level preservation of the
 * *compressed* stream; this gate proves the *decoded picture* is identical
 * by running the actual decoder over both files and comparing raw frame
 * buffers (exact bytes first, PSNR/SSIM as objective metrics).
 *
 * Frames are paired by presentation timestamp (not by position) so a single
 * dropped or reordered frame is reported as `unmatchedPairs` instead of
 * silently comparing the wrong pictures. Pure helpers live at the top so
 * Node unit tests can cover them without a browser.
 */

import { type DemuxedSample, demuxVideo } from "@/lib/reencode/demux";
import type { MediaContext } from "@/lib/mp4/inspect";
import { readSamples } from "@/lib/validate/samples";

/** Hard cap for "full decode" mode; above it we sample deterministically. */
export const FULL_DECODE_MAX_FRAMES = 1800;
const FEED_BATCH = 16;
const QUEUE_LIMIT = 64;
const HELD_LIMIT = 64;

export type DecodeMode = "full" | "sampled";

/** Deterministic frame selection: every K-th sample, labelled honestly. */
export function selectFrameIndices(
  total: number,
  maxFrames = FULL_DECODE_MAX_FRAMES,
): { indices: number[]; mode: DecodeMode; every: number } {
  if (total <= maxFrames) {
    const indices: number[] = [];
    for (let i = 0; i < total; i++) indices.push(i);
    return { indices, mode: "full", every: 1 };
  }
  const every = Math.ceil(total / maxFrames);
  const indices: number[] = [];
  for (let i = 0; i < total; i += every) indices.push(i);
  return { indices, mode: "sampled", every };
}

/** Mean squared error over two equally sized byte buffers. */
export function frameMse(a: Uint8Array, b: Uint8Array): number | null {
  if (a.length !== b.length || a.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum / a.length;
}

/**
 * PSNR from MSE over 8-bit samples. Exact equality yields 100 (a
 * conventional cap standing in for infinity, stated in reports).
 */
export function psnrFromMse(mse: number | null): number | null {
  if (mse === null) return null;
  if (mse <= 0) return 100;
  return 10 * Math.log10((255 * 255) / mse);
}

/**
 * Global (non-windowed) SSIM over the luma plane (first width*height bytes
 * of an I420 frame buffer). Deterministic; reported as "SSIM (luma)".
 */
export function ssimLuma(
  a: Uint8Array,
  b: Uint8Array,
  lumaCount: number,
): number | null {
  const n = Math.min(lumaCount, a.length, b.length);
  if (n < 16 || a.length !== b.length) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;
  }
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const meanX = sumX / n;
  const meanY = sumY / n;
  const varX = sumXX / n - meanX * meanX;
  const varY = sumYY / n - meanY * meanY;
  const cov = sumXY / n - meanX * meanY;
  const num = (2 * meanX * meanY + c1) * (2 * cov + c2);
  const den = (meanX * meanX + meanY * meanY + c1) * (varX + varY + c2);
  if (den === 0) return null;
  return num / den;
}

export const CONTENT_BLACK_LUMA = 8;
export const CONTENT_WHITE_LUMA = 247;
export const CONTENT_MIN_BLACK_RATIO = 0.98;
export const CONTENT_MIN_WHITE_RATIO = 0.98;
/** Grid-frame MSE at or below this counts as a duplicate (0 = identical). */
export const CONTENT_DUPLICATE_MSE = 1;
/** Fixed square luma grid used for duplicate/sharpness analysis. */
export const CONTENT_GRID = 64;
/** Max frames with an in-flight content copy (bounds decode memory). */
const ANALYZE_LIMIT = 8;

export interface FrameContentStats {
  /** Mean luma of the sampled pixels (0-255). */
  mean: number;
  /** Fraction of sampled pixels at or below CONTENT_BLACK_LUMA. */
  blackRatio: number;
  /** Fraction of sampled pixels at or above CONTENT_WHITE_LUMA. */
  whiteRatio: number;
  /** Variance of the Laplacian over the luma grid (higher = sharper). */
  sharpness: number;
  /** Fixed CONTENT_GRID^2 luma sample used for duplicate comparison. */
  grid: Uint8Array;
}

/** Strided CONTENT_GRID x CONTENT_GRID luma sample of one frame plane. */
export function lumaGrid(y: Uint8Array, width: number, height: number): Uint8Array {
  const grid = new Uint8Array(CONTENT_GRID * CONTENT_GRID);
  if (width <= 0 || height <= 0 || y.length === 0) return grid;
  const stepX = Math.max(1, Math.floor(width / CONTENT_GRID));
  const stepY = Math.max(1, Math.floor(height / CONTENT_GRID));
  for (let gy = 0; gy < CONTENT_GRID; gy++) {
    const sy = Math.min(height - 1, gy * stepY);
    for (let gx = 0; gx < CONTENT_GRID; gx++) {
      const sx = Math.min(width - 1, gx * stepX);
      grid[gy * CONTENT_GRID + gx] = y[sy * width + sx] ?? 0;
    }
  }
  return grid;
}

/** Variance of the 4-neighbour Laplacian over a CONTENT_GRID^2 buffer. */
export function laplacianVariance(grid: Uint8Array): number {
  const n = CONTENT_GRID;
  if (grid.length < n * n) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let row = 1; row < n - 1; row++) {
    for (let col = 1; col < n - 1; col++) {
      const i = row * n + col;
      const v =
        4 * grid[i] - grid[i - 1] - grid[i + 1] - grid[i - n] - grid[i + n];
      sum += v;
      sumSq += v * v;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}

/**
 * Content statistics of ONE decoded I420 luma plane (first width*height
 * bytes). Mean/ratios are computed over a 1-in-4 pixel sample for speed;
 * sharpness and duplicates use the fixed luma grid.
 */
export function frameContentStats(
  y: Uint8Array,
  width: number,
  height: number,
): FrameContentStats {
  const pixels = width * height;
  let sum = 0;
  let black = 0;
  let white = 0;
  let count = 0;
  const limit = Math.min(pixels, y.length);
  for (let i = 0; i < limit; i += 4) {
    const v = y[i];
    sum += v;
    if (v <= CONTENT_BLACK_LUMA) black++;
    if (v >= CONTENT_WHITE_LUMA) white++;
    count++;
  }
  const grid = lumaGrid(y, width, height);
  return {
    mean: count > 0 ? sum / count : 0,
    blackRatio: count > 0 ? black / count : 0,
    whiteRatio: count > 0 ? white / count : 0,
    sharpness: laplacianVariance(grid),
    grid,
  };
}

/** Aggregated decoded-content evidence for one file (baseline decode). */
export interface FrameContentReport {
  /** Frames whose pixels were actually analyzed. */
  measured: number;
  /** Frames with at least 98% of sampled pixels at/below luma 8. */
  blackFrames: number;
  /** Frames with at least 98% of sampled pixels at/above luma 247. */
  clippedFrames: number;
  /** Consecutive frame pairs identical on the luma grid (MSE <= 1). */
  duplicateFrames: number;
  sharpnessAvg: number | null;
  sharpnessMin: number | null;
}

export function emptyContent(): FrameContentReport {
  return {
    measured: 0,
    blackFrames: 0,
    clippedFrames: 0,
    duplicateFrames: 0,
    sharpnessAvg: null,
    sharpnessMin: null,
  };
}

interface ContentAccumulator {
  measured: number;
  blackFrames: number;
  clippedFrames: number;
  duplicateFrames: number;
  sharpnessSum: number;
  sharpnessMin: number | null;
  prevGrid: Uint8Array | null;
}

function newAccumulator(): ContentAccumulator {
  return {
    measured: 0,
    blackFrames: 0,
    clippedFrames: 0,
    duplicateFrames: 0,
    sharpnessSum: 0,
    sharpnessMin: null,
    prevGrid: null,
  };
}

function finishContent(acc: ContentAccumulator): FrameContentReport {
  return {
    measured: acc.measured,
    blackFrames: acc.blackFrames,
    clippedFrames: acc.clippedFrames,
    duplicateFrames: acc.duplicateFrames,
    sharpnessAvg: acc.measured > 0 ? acc.sharpnessSum / acc.measured : null,
    sharpnessMin: acc.sharpnessMin,
  };
}

export interface DecodeRunResult {
  available: boolean;
  mode: DecodeMode;
  expectedFrames: number;
  decodedFrames: number;
  errors: number;
  errorDetail: string | null;
  firstPtsUs: number | null;
  lastPtsUs: number | null;
  deltaMinUs: number | null;
  deltaMaxUs: number | null;
  deltaDistinct: number;
  width: number;
  height: number;
  format: string;
  /** Decoded-content analysis (baseline decode only; zeros elsewhere). */
  content: FrameContentReport;
}

export interface DecodeCompareReport {
  available: boolean;
  mode: DecodeMode;
  orig: DecodeRunResult;
  patched: DecodeRunResult;
  totalOriginalFrames: number;
  selectedFrames: number;
  comparedFrames: number;
  exactMatches: number;
  differentFrames: number;
  unmatchedPairs: number;
  syntheticOutputs: number;
  minPsnr: number | null;
  avgPsnr: number | null;
  minSsim: number | null;
  avgSsim: number | null;
  pass: boolean;
  line: string;
  notes: string[];
}

const sleep0 = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function waitUntil(cond: () => boolean): Promise<void> {
  while (!cond()) await sleep0();
}

interface DecoderSide {
  decoder: VideoDecoder;
  /** Selected frames awaiting their counterpart (only in compare mode). */
  outputs: VideoFrame[];
  outputsTotal: number;
  synthetic: number;
  errors: number;
  errorDetail: string | null;
  fed: number;
  done: boolean;
  /** Content copies still in flight (baseline analysis backpressure). */
  inFlight: number;
}

function createSide(
  config: VideoDecoderConfig,
  lastOrigPtsUs: number | null,
  selectedPts: Set<number> | null,
): DecoderSide {
  const side: DecoderSide = {
    decoder: null as unknown as VideoDecoder,
    outputs: [],
    outputsTotal: 0,
    synthetic: 0,
    errors: 0,
    errorDetail: null,
    fed: 0,
    done: false,
    inFlight: 0,
  };
  side.decoder = new VideoDecoder({
    output: (frame) => {
      side.outputsTotal++;
      const pts = frame.timestamp;
      if (selectedPts && selectedPts.has(pts)) {
        side.outputs.push(frame);
        return;
      }
      if (selectedPts && lastOrigPtsUs !== null && pts > lastOrigPtsUs) {
        side.synthetic++;
      }
      frame.close();
    },
    error: (err) => {
      side.errors++;
      if (!side.errorDetail) side.errorDetail = String(err);
    },
  });
  side.decoder.configure(config);
  return side;
}

async function feedSide(
  side: DecoderSide,
  file: Blob,
  samples: DemuxedSample[],
  onProgress?: (fraction: number) => void,
): Promise<void> {
  try {
    for (let i = 0; i < samples.length; i += FEED_BATCH) {
      await waitUntil(
        () =>
          side.errors > 0 ||
          (side.decoder.decodeQueueSize < QUEUE_LIMIT &&
            side.outputs.length < HELD_LIMIT &&
            side.inFlight < ANALYZE_LIMIT),
      );
      if (side.errors > 0) break;
      const end = Math.min(samples.length, i + FEED_BATCH);
      const refs = samples.slice(i, end);
      const bufs = await readSamples(
        file,
        refs.map((s) => ({ offset: s.offset, size: s.size })),
        refs.map((_, k) => k),
      );
      for (let k = 0; k < refs.length; k++) {
        side.decoder.decode(
          new EncodedVideoChunk({
            type: refs[k].isKey ? "key" : "delta",
            timestamp: refs[k].ptsUs,
            data: bufs[k],
          }),
        );
        side.fed++;
      }
      onProgress?.(side.fed / samples.length);
    }
    if (side.errors === 0) await side.decoder.flush();
  } catch (err) {
    side.errors++;
    if (!side.errorDetail) {
      side.errorDetail = err instanceof Error ? err.message : String(err);
    }
  } finally {
    side.done = true;
    try {
      side.decoder.close();
    } catch {
      /* already closed or errored */
    }
  }
}

function emptyRun(): DecodeRunResult {
  return {
    available: false,
    mode: "full",
    expectedFrames: 0,
    decodedFrames: 0,
    errors: 0,
    errorDetail: null,
    firstPtsUs: null,
    lastPtsUs: null,
    deltaMinUs: null,
    deltaMaxUs: null,
    deltaDistinct: 0,
    width: 0,
    height: 0,
    format: "",
    content: emptyContent(),
  };
}

function videoConfig(v: {
  codec: string;
  width: number;
  height: number;
  description: Uint8Array;
}): VideoDecoderConfig {
  return {
    codec: v.codec,
    codedWidth: v.width,
    codedHeight: v.height,
    description: v.description,
    optimizeForLatency: true,
  };
}

export function webCodecsAvailable(): boolean {
  return typeof globalThis.VideoDecoder === "function";
}

/**
 * Best-effort content analysis of one decoded frame: copies the packed I420
 * planes, records black/white ratios, sharpness and the luma grid for
 * duplicate detection. Any failure (unexpected pixel format, closed frame)
 * skips that frame without affecting the decode itself.
 */
async function analyzeFrameContent(
  frame: VideoFrame,
  acc: ContentAccumulator,
): Promise<void> {
  try {
    if (frame.format !== "I420") return;
    const width = frame.codedWidth;
    const height = frame.codedHeight;
    if (width <= 0 || height <= 0) return;
    const chromaW = Math.ceil(width / 2);
    const chromaH = Math.ceil(height / 2);
    const yBytes = width * height;
    const buf = new Uint8Array(yBytes + 2 * chromaW * chromaH);
    await frame.copyTo(buf, {
      layout: [
        { offset: 0, stride: width },
        { offset: yBytes, stride: chromaW },
        { offset: yBytes + chromaW * chromaH, stride: chromaW },
      ],
    });
    const stats = frameContentStats(buf.subarray(0, yBytes), width, height);
    acc.measured++;
    if (stats.blackRatio >= CONTENT_MIN_BLACK_RATIO) acc.blackFrames++;
    if (stats.whiteRatio >= CONTENT_MIN_WHITE_RATIO) acc.clippedFrames++;
    if (acc.prevGrid) {
      const mse = frameMse(acc.prevGrid, stats.grid);
      if (mse !== null && mse <= CONTENT_DUPLICATE_MSE) acc.duplicateFrames++;
    }
    acc.sharpnessSum += stats.sharpness;
    if (acc.sharpnessMin === null || stats.sharpness < acc.sharpnessMin) {
      acc.sharpnessMin = stats.sharpness;
    }
    acc.prevGrid = stats.grid;
  } catch {
    // analysis is evidence, never a decode failure
  }
}

/**
 * Baseline decode of one file: counts, timing distribution, decoder
 * errors. This is the analysis-stage evidence for "decoded FPS" and
 * proves the stream decodes at all before any patch is attempted.
 * Frames are analyzed for content (black/clipped/duplicates/sharpness)
 * and closed on arrival; nothing is retained.
 */
export async function decodeRun(
  file: Blob,
  context: MediaContext,
  onProgress?: (fraction: number) => void,
): Promise<DecodeRunResult> {
  const base = emptyRun();
  if (!webCodecsAvailable()) {
    base.errorDetail = "WebCodecs unavailable in this environment";
    return base;
  }
  let video;
  try {
    video = demuxVideo(context);
  } catch (err) {
    base.errorDetail = err instanceof Error ? err.message : String(err);
    return base;
  }
  base.expectedFrames = video.samples.length;
  base.available = true;
  base.mode = "full";
  base.width = video.width;
  base.height = video.height;

  const timestamps: number[] = [];
  const acc = newAccumulator();
  const side: DecoderSide = {
    decoder: new VideoDecoder({
      output: (frame) => {
        timestamps.push(frame.timestamp);
        side.inFlight++;
        void analyzeFrameContent(frame, acc).finally(() => {
          side.inFlight--;
          frame.close();
        });
      },
      error: (err) => {
        side.errors++;
        if (!side.errorDetail) side.errorDetail = String(err);
      },
    }),
    outputs: [],
    outputsTotal: 0,
    synthetic: 0,
    errors: 0,
    errorDetail: null,
    fed: 0,
    done: false,
    inFlight: 0,
  };
  side.decoder.configure(videoConfig(video));
  await feedSide(side, file, video.samples, onProgress);
  // Drain content analysis before freezing the counters.
  await waitUntil(() => side.inFlight === 0);
  side.outputsTotal = timestamps.length;

  base.decodedFrames = timestamps.length;
  base.errors = side.errors;
  base.errorDetail = side.errorDetail;
  base.content = finishContent(acc);
  if (timestamps.length > 0) {
    base.firstPtsUs = timestamps[0];
    base.lastPtsUs = timestamps[timestamps.length - 1];
    const seen = new Set<number>();
    let min: number | null = null;
    let max: number | null = null;
    for (let i = 1; i < timestamps.length; i++) {
      const d = timestamps[i] - timestamps[i - 1];
      if (seen.size < 10000) seen.add(d);
      if (min === null || d < min) min = d;
      if (max === null || d > max) max = d;
    }
    base.deltaMinUs = min;
    base.deltaMaxUs = max;
    base.deltaDistinct = seen.size;
  }
  return base;
}

function makeRunFromSide(
  side: DecoderSide,
  expected: number,
  mode: DecodeMode,
): DecodeRunResult {
  const r = emptyRun();
  r.available = true;
  r.mode = mode;
  r.expectedFrames = expected;
  r.decodedFrames = side.outputsTotal;
  r.errors = side.errors;
  r.errorDetail = side.errorDetail;
  return r;
}

/**
 * Full comparison of decoded frames between original and patched files.
 * Pairs frames by timestamp; only deterministically selected frames are
 * held for pixel comparison (full decode when the file is small enough).
 *
 * With `options.timingMayChange` (set only for engines that declare a
 * timing change), the output side selects by its own timestamps and frames
 * are paired by sample order when timestamps differ; every pair is still
 * compared pixel-exactly and the pairing mode is reported in the notes.
 */
export async function compareDecodedFrames(
  original: Blob,
  originalCtx: MediaContext,
  patched: Blob,
  patchedCtx: MediaContext,
  onProgress?: (fraction: number) => void,
  options?: { timingMayChange?: boolean },
): Promise<DecodeCompareReport> {
  const notes: string[] = [];
  const unavailable = (reason: string): DecodeCompareReport => {
    const r = emptyRun();
    return {
      available: false,
      mode: "full",
      orig: r,
      patched: { ...r },
      totalOriginalFrames: 0,
      selectedFrames: 0,
      comparedFrames: 0,
      exactMatches: 0,
      differentFrames: 0,
      unmatchedPairs: 0,
      syntheticOutputs: 0,
      minPsnr: null,
      avgPsnr: null,
      minSsim: null,
      avgSsim: null,
      pass: false,
      line: `Decoded-frame check could not run: ${reason}`,
      notes: [reason],
    };
  };
  if (!webCodecsAvailable()) {
    return unavailable("WebCodecs unavailable in this environment");
  }

  let origVideo;
  let patchedVideo;
  try {
    origVideo = demuxVideo(originalCtx);
    patchedVideo = demuxVideo(patchedCtx);
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : String(err));
  }
  if (origVideo.samples.length === 0) return unavailable("no video samples");

  const { indices, mode, every } = selectFrameIndices(origVideo.samples.length);
  if (mode === "sampled") {
    notes.push(
      `Sampled decode: every ${every}th of ${origVideo.samples.length} frames (not a full decode)`,
    );
  }
  const selectedPts = new Set(indices.map((i) => origVideo.samples[i].ptsUs));
  const lastOrigPts = origVideo.samples[origVideo.samples.length - 1].ptsUs;

  // Engines keep original samples first in the output (asserted byte-for-byte
  // by Gate 2); anything beyond the original count is declared synthetic
  // filler (ghost frames). The shared filler NAL is not decodable on purpose,
  // so the output side decodes only the original region and the excluded
  // count is reported instead of being decoded.
  const origCount = origVideo.samples.length;
  const patchedCount = patchedVideo.samples.length;
  const patchedFeed = patchedVideo.samples.slice(0, Math.min(patchedCount, origCount));
  const syntheticExcluded = Math.max(0, patchedCount - origCount);

  // Declared timing changes (timescale division, frame-timing flatten): the
  // output side selects by its OWN timestamps, and pairing falls back to
  // sample order. Without the explicit flag the timestamp path stays strict
  // so an unexpected timing bug still fails the gate.
  const timingMayChange = options?.timingMayChange === true;
  const sideBSelectedPts = timingMayChange
    ? new Set(indices.filter((i) => i < patchedFeed.length).map((i) => patchedVideo.samples[i].ptsUs))
    : selectedPts;
  const sideBLastPts =
    timingMayChange && patchedFeed.length > 0
      ? patchedFeed[patchedFeed.length - 1].ptsUs
      : lastOrigPts;

  const sideA = createSide(videoConfig(origVideo), lastOrigPts, selectedPts);
  const sideB = createSide(videoConfig(patchedVideo), sideBLastPts, sideBSelectedPts);

  let fracA = 0;
  let fracB = 0;
  const feederA = feedSide(sideA, original, origVideo.samples, (f) => {
    fracA = f;
    onProgress?.((fracA + fracB) / 2);
  });
  const feederB = feedSide(sideB, patched, patchedFeed, (f) => {
    fracB = f;
    onProgress?.((fracA + fracB) / 2);
  });

  let compared = 0;
  let exact = 0;
  let different = 0;
  let unmatched = 0;
  let pairedByOrder = false;
  let minPsnr: number | null = null;
  let sumPsnr = 0;
  let minSsim: number | null = null;
  let sumSsim = 0;
  let ssimSamples = 0;

  for (;;) {
    const aIdle = sideA.done && sideA.outputs.length === 0;
    const bIdle = sideB.done && sideB.outputs.length === 0;
    if (aIdle && bIdle) break;

    if (sideA.outputs.length > 0 && sideB.outputs.length > 0) {
      const fa = sideA.outputs[0];
      const fb = sideB.outputs[0];
      const sameTimestamps = fa.timestamp === fb.timestamp;
      if (sameTimestamps || timingMayChange) {
        if (!sameTimestamps) pairedByOrder = true;
        sideA.outputs.shift();
        sideB.outputs.shift();
        const [ba, bb] = await Promise.all([
          frameToBytes(fa),
          frameToBytes(fb),
        ]);
        fa.close();
        fb.close();
        compared++;
        const mse = frameMse(ba, bb);
        if (mse === null) {
          different++;
          notes.push("frame buffers differ in size between original and output");
        } else if (mse === 0) {
          exact++;
        } else {
          different++;
        }
        const psnr = psnrFromMse(mse);
        if (psnr !== null) {
          if (minPsnr === null || psnr < minPsnr) minPsnr = psnr;
          sumPsnr += psnr;
        }
        const ssim =
          mse !== null ? ssimLuma(ba, bb, origVideo.width * origVideo.height) : null;
        if (ssim !== null) {
          if (minSsim === null || ssim < minSsim) minSsim = ssim;
          sumSsim += ssim;
          ssimSamples++;
        }
        continue;
      }
      if (fa.timestamp < fb.timestamp) {
        sideA.outputs.shift();
        fa.close();
        unmatched++;
        continue;
      }
      sideB.outputs.shift();
      fb.close();
      unmatched++;
      continue;
    }
    if (sideA.outputs.length > 0 && bIdle) {
      const fa = sideA.outputs.shift()!;
      fa.close();
      unmatched++;
      continue;
    }
    if (sideB.outputs.length > 0 && aIdle) {
      const fb = sideB.outputs.shift()!;
      fb.close();
      unmatched++;
      continue;
    }
    await sleep0();
  }

  await Promise.all([feederA, feederB]);

  const origRun = makeRunFromSide(sideA, origVideo.samples.length, mode);
  origRun.width = origVideo.width;
  origRun.height = origVideo.height;
  const patchedRun = makeRunFromSide(sideB, patchedFeed.length, mode);
  patchedRun.width = patchedVideo.width;
  patchedRun.height = patchedVideo.height;

  const selected = indices.length;
  const pass =
    sideA.errors === 0 &&
    sideB.errors === 0 &&
    compared === selected &&
    exact === compared &&
    different === 0 &&
    unmatched === 0 &&
    compared > 0;

  if (sideA.errors > 0) {
    notes.push(`original decoder errors: ${sideA.errorDetail ?? "unknown"}`);
  }
  if (sideB.errors > 0) {
    notes.push(`output decoder errors: ${sideB.errorDetail ?? "unknown"}`);
  }
  if (pairedByOrder) {
    notes.push(
      "Timestamps differ between source and output (this method changes timing); frames paired by sample order",
    );
  }
  if (unmatched > 0) {
    notes.push(`${unmatched} frame pair(s) could not be matched by timestamp`);
  }
  if (!pass && syntheticExcluded > 0) {
    notes.push(
      `${syntheticExcluded} synthetic filler sample(s) excluded from decode (counted by Gate 2)`,
    );
  }

  const line = pass
    ? `Decoded frames compared: ${compared}/${selected} selected, all exact` +
      (mode === "sampled" ? ` (sampled, every ${every}th)` : " (full decode)") +
      (pairedByOrder ? "; paired by sample order (timing changed)" : "") +
      `, PSNR ${minPsnr === null ? "n/a" : minPsnr.toFixed(1)} dB min, ` +
      `SSIM ${minSsim === null ? "n/a" : minSsim.toFixed(4)} min` +
      (syntheticExcluded > 0
        ? `; ${syntheticExcluded} synthetic filler sample(s) excluded from decode`
        : "")
    : `Decoded-frame equivalence: FAIL (compared ${compared}/${selected}, exact ${exact}, different ${different}, unmatched ${unmatched}, decoder errors original/output ${sideA.errors}/${sideB.errors})`;

  return {
    available: true,
    mode,
    orig: origRun,
    patched: patchedRun,
    totalOriginalFrames: origVideo.samples.length,
    selectedFrames: selected,
    comparedFrames: compared,
    exactMatches: exact,
    differentFrames: different,
    unmatchedPairs: unmatched,
    syntheticOutputs: sideB.synthetic,
    minPsnr,
    avgPsnr: compared > 0 ? sumPsnr / compared : null,
    minSsim,
    avgSsim: ssimSamples > 0 ? sumSsim / ssimSamples : null,
    pass,
    line,
    notes,
  };
}

async function frameToBytes(frame: VideoFrame): Promise<Uint8Array> {
  const buf = new Uint8Array(frame.allocationSize());
  await frame.copyTo(buf);
  return buf;
}
