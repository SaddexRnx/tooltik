/**
 * Structural test harness for the ToolT patching pipeline.
 *
 * Runs the real (browser-targeted) library in Node against fixture files:
 *   1. inspectMedia()   → display metadata must be sane
 *   2. transformMedia() → patched blob produced
 *   3. re-inspect the output and assert every invariant of the patch
 *   4. cross-check with MP4Box.js (independent parser, not our code)
 *
 * Usage: npx tsx tests/run.ts
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as MP4Box from "mp4box";
import { inspectMedia, PATCH_SIGNATURE } from "../lib/mp4/inspect";
import { buildQualityReport } from "../lib/mp4/quality";
import { transformMedia } from "../lib/mp4/transform";
import { isFragmentedFile, remuxFragmented } from "../lib/mp4/fragment";
import { asPatchError, findBox, findBoxPath, findTrackByHandler, parseChunkOffsets, parseStsz, parseStts, readFourCC, readU16, readU32 } from "../lib/mp4/boxes";
import { demuxAudio, demuxVideo } from "../lib/reencode/demux";
import { muxProgressive, type MuxVideoSample } from "../lib/reencode/mux";
import { Sha256, sha256Hex, sha256File } from "../lib/integrity/sha256";
import {
  CONTENT_DUPLICATE_MSE,
  CONTENT_MIN_BLACK_RATIO,
  CONTENT_MIN_WHITE_RATIO,
  frameContentStats,
  frameMse,
  laplacianVariance,
  lumaGrid,
  emptyContent,
  type DecodeCompareReport,
  psnrFromMse,
  selectFrameIndices,
  ssimLuma,
} from "../lib/validate/decode";
import { comparePayload } from "../lib/validate/payload";
import { validateAudio } from "../lib/validate/audio";
import { readSamples, sampleTable } from "../lib/validate/samples";
import { validateStructure } from "../lib/validate/structure";
import { runValidation } from "../lib/validate/gates";
import { ENGINES, getEngine, timescaleDividerFor } from "../lib/engines/registry";
import { computeEligibility, eligibilityFor, isEligible } from "../lib/methods/eligibility";
import { runAllMethods } from "../lib/methods/runner";
import { buildReport, serializeReport, REPORT_SCHEMA } from "../lib/reports/build-report";
import { isAcceptedFile, looksLikeMp4 } from "../hooks/use-patcher";
import { createHash, randomBytes } from "node:crypto";

let failures = 0;
let checks = 0;

function assert(cond: boolean, message: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  ✗ FAIL: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

function toFile(path: string, name?: string): File {
  const bytes = readFileSync(path);
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([ab], name ?? path.split(/[\\/]/).pop()!);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function mp4boxInfo(file: File): Promise<{
  nbTracks: number;
  nbSamples: number[];
  codecs: string[];
  duration: number;
}> {
  const ab = (await file.arrayBuffer()) as ArrayBuffer & { fileStart: number };
  ab.fileStart = 0;
  const mp4 = MP4Box.createFile();
  const done = new Promise<{
    nbTracks: number;
    nbSamples: number[];
    codecs: string[];
    duration: number;
  }>((resolve, reject) => {
    mp4.onReady = (info: {
      tracks: { nb_samples: number; codec: string }[];
      duration: number;
      timescale: number;
    }) => {
      resolve({
        nbTracks: info.tracks.length,
        nbSamples: info.tracks.map((t) => t.nb_samples),
        codecs: info.tracks.map((t) => t.codec),
        duration: info.duration / info.timescale,
      });
    };
    mp4.onError = (e: unknown) => reject(new Error(String(e)));
    try {
      mp4.appendBuffer(ab);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
  return done;
}

async function testFile(
  path: string,
  opts: { expectUnsupported?: boolean; expectError?: string } = {},
  inputOverride?: File,
): Promise<void> {
  const name = path.split(/[\\/]/).pop() ?? "";
  console.log(`\n=== ${name} ===`);
  const file = inputOverride ?? toFile(path);
  if (inputOverride) {
    console.log("  input: fragmented file remuxed to progressive first");
  }

  // ---- expected inspection failure ---------------------------------------
  if (opts.expectError) {
    try {
      await inspectMedia(file);
      assert(false, `inspection throws "${opts.expectError}"`);
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : null;
      assert(code === opts.expectError, `inspection throws "${opts.expectError}" (got "${code}")`);
    }
    return;
  }

  // ---- inspect ----------------------------------------------------------
  const { info, context } = await inspectMedia(file);
  console.log(
    `  info: ${info.video.codecLabel} ${info.video.width}x${info.video.height} ` +
      `@${info.video.fps}fps ${info.durationSec.toFixed(2)}s ` +
      `frames=${info.video.frames} audio=${info.audio?.codecLabel ?? "none"} ` +
      `fastStart=${info.fastStart} brand=${info.ftypBrand} supported=${info.supported}`,
  );
  assert(info.video.width > 0 && info.video.height > 0, "resolution detected");
  assert(info.durationSec > 0, "duration detected");
  assert(info.video.frames > 0, "frame count detected");
  assert(info.video.fps > 0, "fps detected");
  assert(!info.alreadyPatched, "input not flagged as already patched");

  if (inputOverride) {
    // The remuxed tables must account for exactly the fragment samples.
    const bxSrc = await mp4boxInfo(inputOverride);
    console.log(`  remuxed source: samples=[${bxSrc.nbSamples.join(", ")}], dur=${bxSrc.duration.toFixed(2)}s`);
    assert(
      info.video.frames === bxSrc.nbSamples[0],
      `frame count matches fragment samples (${bxSrc.nbSamples[0]}, got ${info.video.frames})`,
    );
    assert(Math.abs(info.durationSec - bxSrc.duration) < 0.05, "remuxed duration matches source");
  }

  if (name.includes("5994")) {
    assert(Math.abs(info.video.fps - 59.94) < 0.01, `59.94 fps detected (got ${info.video.fps})`);
  }
  if (name.includes("vfr")) {
    assert(Math.abs(info.video.fps - 40) < 0.01, `VFR average fps = 40 (got ${info.video.fps})`);
  }
  if (name.includes("avc3")) {
    assert(info.video.codecId === "avc3", `avc3 entry recognised (got ${info.video.codecId})`);
  }
  if (name.includes("id3")) {
    assert(info.ftypBrand === "mp42", `ID3 prefix skipped, ftyp read (got ${info.ftypBrand})`);
  }

  if (opts.expectUnsupported) {
    assert(!info.supported, "codec flagged as unsupported");
    return;
  }
  assert(info.supported, "codec supported (H.264)");

  // ---- quality report -----------------------------------------------------
  const report = buildQualityReport(context, info);
  assert(
    report.videoBitrateBps === null || report.videoBitrateBps > 0,
    "quality report: video bitrate computed",
  );
  assert(report.findings.length > 0, "quality report: findings present");
  if (name.includes("vfr")) {
    assert(report.isVfr, "quality report: VFR input flagged");
    assert(report.distinctDeltas > 1, "quality report: distinct deltas counted");
  }

  // ---- transform --------------------------------------------------------
  const { blob, stats } = await transformMedia(context, {});
  console.log(
    `  patched: ${stats.inputSize} → ${stats.outputSize} (${stats.sizeDelta >= 0 ? "+" : ""}${stats.sizeDelta} B), ` +
      `frames ${stats.originalFrames} → ${stats.declaredFrames}, sei −${stats.seiBytesRemoved} B`,
  );
  assert(stats.declaredFrames === stats.originalFrames * stats.multiplier, "frame count inflated 10x");
  assert(stats.ghostFrames === stats.originalFrames * 9, "ghost frame count correct");
  assert(!stats.frameTimingFlattened, "frame timing untouched by default");
  assert(stats.timestampsScrubbed, "timestamps scrubbed by default");
  assert(blob.size === stats.outputSize, "blob size matches stats");
  assert(blob.size > stats.inputSize, "output larger than input (metadata tables)");

  const outFile = path.replace(/\.mp4$/, ".patched.mp4");
  writeFileSync(outFile, Buffer.from(await blob.arrayBuffer()));

  // ---- re-inspect output ------------------------------------------------
  const { info: outInfo, context: outCtx } = await inspectMedia(toFile(outFile));
  assert(outInfo.supported, "output still recognised as H.264");
  assert(outInfo.fastStart, "output is fast-start (moov before mdat)");
  assert(outInfo.alreadyPatched, "output carries the signature comment");
  assert(outInfo.video.width === info.video.width, "resolution unchanged");
  if (!name.includes("vfr")) {
    assert(Math.abs(outInfo.video.fps - info.video.fps) < 0.01, "fps unchanged");
  } else {
    assert(outInfo.video.fps > 0, "fps still readable (VFR preserved)");
  }
  assert(outInfo.video.frames === stats.declaredFrames, "output stsz reports declared frames");
  assert(Math.abs(outInfo.durationSec - info.durationSec) < 0.05, "container duration unchanged");
  assert(outInfo.audio !== null || info.audio === null, "audio track preserved");

  // ---- structural checks on the output ----------------------------------
  const moov = outCtx.moovBytes;
  const ftyp = outCtx.topLevel.ftyp;
  const mdat = outCtx.topLevel.mdat;
  assert(readFourCC(moov, 4) === "moov", "moov bytes start at box boundary");
  assert(ftyp.start < outCtx.topLevel.moov.start, "ftyp first");
  assert(outCtx.topLevel.moov.start < mdat.start, "moov before mdat");

  const ftypBytes = await fileHead(outFile, 64);
  assert(readFourCC(ftypBytes, ftyp.headerSize) === "isom", "brand is 'isom'");

  // video stco → all offsets inside mdat data
  const moovLocal = { type: "moov", start: 0, size: moov.length, headerSize: outCtx.topLevel.moov.headerSize, end: moov.length };
  const vTrack = findTrackByHandler(moov, moovLocal as never, "vide");
  assert(!!vTrack, "output has video track");
  const vStbl = findBoxPath(moov, ["mdia", "minf", "stbl"], vTrack!.start, vTrack!.end)!;
  const offsets = parseChunkOffsets(moov, vStbl);

  // privacy: creation/modification times zeroed in the rebuilt headers
  const creationTime = (ref: { start: number; headerSize: number }): number => {
    const v1 = moov[ref.start + ref.headerSize] === 1;
    return readU32(moov, ref.start + ref.headerSize + (v1 ? 8 : 4));
  };
  const outMvhd = findBox(moov, "mvhd", moovLocal.start, moovLocal.end);
  assert(!!outMvhd && creationTime(outMvhd) === 0, "output mvhd creation time scrubbed");
  const outTkhd = findBox(moov, "tkhd", vTrack!.start, vTrack!.end);
  assert(!!outTkhd && creationTime(outTkhd) === 0, "output tkhd creation time scrubbed");
  const outMdhd = findBoxPath(moov, ["mdia", "mdhd"], vTrack!.start, vTrack!.end);
  assert(!!outMdhd && creationTime(outMdhd) === 0, "output mdhd creation time scrubbed");
  const inputChunks = inputChunkCount(context);
  assert(
    offsets.length === inputChunks + stats.ghostFrames,
    `stco entries = input chunks (${inputChunks}) + ghosts (${stats.ghostFrames})`,
  );
  const mdatDataStart = mdat.start + mdat.headerSize;
  const mdatDataEnd = mdat.end;
  assert(
    offsets.every((o) => o >= mdatDataStart && o + 8 <= mdatDataEnd),
    "every chunk offset points inside mdat",
  );

  // stsz: first sample shrunk by SEI, ghosts are 8 bytes
  const stszRef = findBox(moov, "stsz", vStbl.start, vStbl.end)!;
  const sizes = parseStsz(moov, stszRef);
  const firstOutSize = sizes[0];
  assert(firstOutSize > 0, "first sample size readable");
  assert(sizes.slice(-stats.ghostFrames).every((s) => s === 8), "all ghost samples are 8 bytes");
  if (name.includes("vfr")) {
    const outStts = findBox(moov, "stts", vStbl.start, vStbl.end);
    const sttsEntries = outStts ? parseStts(moov, outStts) : [];
    assert(sttsEntries.length === 3, `VFR stts keeps 2 original entries + 1 ghost entry (got ${sttsEntries.length})`);
    assert(
      sttsEntries[0]?.count === 60 && sttsEntries[1]?.count === 60 && sttsEntries[1]?.delta === 2000,
      "VFR original timing entries untouched",
    );
  }

  // ghost chunks all share one offset (the filler NAL at the end of mdat)
  const ghostOffsets = new Set(offsets.slice(-stats.ghostFrames));
  assert(ghostOffsets.size === 1, "all ghost frames share one filler NAL offset");
  const padOffset = [...ghostOffsets][0];
  assert(
    padOffset === mdatDataEnd - 8,
    "filler NAL sits at the very end of mdat",
  );

  // verify ghost NAL bytes
  const patched = new Uint8Array(await blob.arrayBuffer());
  const padBytes = patched.slice(padOffset, padOffset + 8);
  assert(
    padBytes.every((b, i) => b === [0, 0, 0, 4, 0, 0, 0, 0][i]),
    "filler NAL bytes correct (00 00 00 04 00 00 00 00)",
  );

  // media bytes before/after first sample must be untouched
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  const inMdatStart = context.topLevel.mdat.start + context.topLevel.mdat.headerSize;
  const inFirstOff = statsForFirstChunk(context) ;
  const firstSizeOrig = stats.originalFrames > 0 ? inFirstOff.size : 0;
  const beforeIn = inputBytes.slice(inMdatStart, inFirstOff.offset);
  const beforeOut = patched.slice(mdatDataStart, mdatDataStart + beforeIn.length);
  assert(
    beforeIn.every((b, i) => b === beforeOut[i]),
    "media bytes before first sample are byte-identical",
  );
  const afterIn = inputBytes.slice(inFirstOff.offset + firstSizeOrig, context.topLevel.mdat.end);
  const afterOutStart = mdatDataStart + beforeIn.length + firstOutSize;
  const afterOut = patched.slice(afterOutStart, afterOutStart + afterIn.length);
  assert(
    afterIn.every((b, i) => b === afterOut[i]),
    "media bytes after first sample are byte-identical",
  );
  // SEI actually removed?
  assert(
    stats.seiBytesRemoved >= 0 && firstSizeOrig - firstOutSize === stats.seiBytesRemoved,
    "SEI byte accounting matches first-sample delta",
  );

  // audio handler rename + language
  if (outInfo.audio) {
    const aTrack = findTrackByHandler(moov, moovLocal as never, "soun");
    assert(!!aTrack, "output has audio track");
    const hdlr = findBoxPath(moov, ["mdia", "hdlr"], aTrack!.start, aTrack!.end)!;
    const nameAt = hdlr.start + hdlr.headerSize + 24; // handler name after reserved[12]
    const name = String.fromCharCode(...moov.slice(nameAt, nameAt + 12)).replace(/\0+$/, "");
    assert(name === "SoundHandler", `audio handler renamed (got "${name}")`);
    const mdhd = findBoxPath(moov, ["mdia", "mdhd"], aTrack!.start, aTrack!.end)!;
    const lang = readU16(moov, mdhd.start + mdhd.headerSize + 20);
    assert(lang === 0x55c4, "audio language set to 'und'");
    const aStbl = findBoxPath(moov, ["mdia", "minf", "stbl"], aTrack!.start, aTrack!.end)!;
    const aOffsets = parseChunkOffsets(moov, aStbl);
    assert(
      aOffsets.every((o) => o >= mdatDataStart && o < mdatDataEnd),
      "audio chunk offsets inside mdat",
    );
  }

  // avcC high-profile extension + signature comment
  const stsdBox = findBox(moov, "stsd", vStbl.start, vStbl.end)!;
  const stsdStr = String.fromCharCode(...moov.slice(stsdBox.start, stsdBox.end));
  assert(stsdStr.includes("avcC"), "stsd contains avcC");
  if (name.includes("no_dinf")) {
    const dinfOut = findBoxPath(moov, ["mdia", "minf", "dinf"], vTrack!.start, vTrack!.end);
    assert(!!dinfOut, "missing dinf rebuilt into the output minf");
  }
  if (name.includes("avc3")) {
    assert(
      readFourCC(moov, stsdBox.start + stsdBox.headerSize + 12) === "avc3",
      "output stsd entry keeps the avc3 fourcc",
    );
  }
  const moovStr = new TextDecoder().decode(moov);
  assert(moovStr.includes(PATCH_SIGNATURE), "signature comment present in moov");

  // ---- MP4Box.js independent cross-check --------------------------------
  try {
    const bx = await mp4boxInfo(toFile(outFile));
    console.log(`  mp4box: ${bx.nbTracks} tracks, samples=[${bx.nbSamples.join(", ")}], dur=${bx.duration.toFixed(2)}s, codecs=[${bx.codecs.join(", ")}]`);
    assert(bx.nbTracks === (info.audio ? 2 : 1), "MP4Box sees expected track count");
    const vSamples = bx.nbSamples[0];
    assert(vSamples === stats.declaredFrames, `MP4Box reports ${vSamples} video samples (= declared)`);
    if (info.audio && bx.nbSamples.length > 1) {
      assert(bx.nbSamples[1] > 0, "MP4Box reports audio samples present");
    }
    assert(Math.abs(bx.duration - info.durationSec) < 0.1, "MP4Box duration matches input duration");
  } catch (e) {
    assert(false, `MP4Box parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // MP4Box on the INPUT for reference
  try {
    const bxIn = await mp4boxInfo(file);
    console.log(`  mp4box(input): samples=[${bxIn.nbSamples.join(", ")}], dur=${bxIn.duration.toFixed(2)}s`);
  } catch {
    /* input may be unusual; already covered */
  }
}

function fileHead(path: string, n: number): Promise<Uint8Array> {
  const bytes = readFileSync(path);
  return Promise.resolve(new Uint8Array(bytes.subarray(0, n)));
}

/** Reads the first video chunk offset + its sample size from a context. */
function statsForFirstChunk(context: Awaited<ReturnType<typeof inspectMedia>>["context"]): {
  offset: number;
  size: number;
} {
  const info = firstChunkInfo(context);
  return info;
}

/** Number of video chunks in an (input) context. */
function inputChunkCount(context: Awaited<ReturnType<typeof inspectMedia>>["context"]): number {
  return chunkCount(context);
}

function chunkCount(context: Awaited<ReturnType<typeof inspectMedia>>["context"]): number {
  const moov = context.moovBytes;
  const moovLocal = {
    type: "moov",
    start: 0,
    size: moov.length,
    headerSize: context.topLevel.moov.headerSize,
    end: moov.length,
  };
  const vTrack = findTrackByHandler(moov, moovLocal as never, "vide")!;
  const vStbl = findBoxPath(moov, ["mdia", "minf", "stbl"], vTrack.start, vTrack.end)!;
  return parseChunkOffsets(moov, vStbl).length;
}

function firstChunkInfo(context: Awaited<ReturnType<typeof inspectMedia>>["context"]): {
  offset: number;
  size: number;
} {
  const moov = context.moovBytes;
  const moovLocal = {
    type: "moov",
    start: 0,
    size: moov.length,
    headerSize: context.topLevel.moov.headerSize,
    end: moov.length,
  };
  const vTrack = findTrackByHandler(moov, moovLocal as never, "vide")!;
  const vStbl = findBoxPath(moov, ["mdia", "minf", "stbl"], vTrack.start, vTrack.end)!;
  const offsets = parseChunkOffsets(moov, vStbl);
  const stsz = findBox(moov, "stsz", vStbl.start, vStbl.end)!;
  const sizes = parseStsz(moov, stsz);
  return { offset: offsets[0], size: sizes[0] };
}

/**
 * Focused test: the opt-in "constant frame timing" path collapses the VFR
 * fixture's two deltas to one and rebuilds the header durations.
 */
async function testFlattenFrameTiming(): Promise<void> {
  const dir = join(process.cwd(), "tests", "fixtures");
  const path = join(dir, "synth_vfr.mp4");
  console.log("\n=== synth_vfr.mp4 (flatten frame timing) ===");
  const file = toFile(path);
  const { context } = await inspectMedia(file);
  const { blob, stats } = await transformMedia(context, { flattenFrameTiming: true });
  assert(stats.frameTimingFlattened, "stats report flattened frame timing");
  assert(stats.timestampsScrubbed, "timestamps scrubbed in the flattened run too");

  const outFile = path.replace(/\.mp4$/, ".flat.patched.mp4");
  writeFileSync(outFile, Buffer.from(await blob.arrayBuffer()));
  const { info: outInfo, context: outCtx } = await inspectMedia(toFile(outFile));

  const moov = outCtx.moovBytes;
  const moovLocal = {
    type: "moov",
    start: 0,
    size: moov.length,
    headerSize: outCtx.topLevel.moov.headerSize,
    end: moov.length,
  };
  const vTrack = findTrackByHandler(moov, moovLocal as never, "vide")!;
  const vStbl = findBoxPath(moov, ["mdia", "minf", "stbl"], vTrack.start, vTrack.end)!;
  const sttsRef = findBox(moov, "stts", vStbl.start, vStbl.end);
  const stts = sttsRef ? parseStts(moov, sttsRef) : [];
  const deltas = new Set(stts.map((e) => e.delta));
  assert(stts.length > 0 && deltas.size === 1, "flattened output uses a single delta");
  assert(outInfo.video.frames === stats.declaredFrames, "frame count preserved after flatten");
  // Modal delta for this fixture is 1000 (first of two tied runs) at
  // timescale 60000: 120 frames → 2.0 s.
  assert(
    Math.abs(outInfo.durationSec - 2.0) < 0.02,
    `duration rebuilt from modal delta (got ${outInfo.durationSec.toFixed(2)}s)`,
  );
  const outReport = buildQualityReport(outCtx, outInfo);
  assert(!outReport.isVfr, "flattened output no longer flagged as VFR");
  try {
    const bx = await mp4boxInfo(toFile(outFile));
    assert(bx.nbSamples[0] === stats.declaredFrames, "MP4Box sees flattened output samples");
    assert(
      Math.abs(bx.duration - outInfo.durationSec) < 0.05,
      "MP4Box duration matches flattened headers",
    );
  } catch (e) {
    assert(false, `MP4Box parse of flattened output failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Byte-identity mux: feed the source samples through the muxer without
 * touching them. The output must carry identical video/audio bytes, the
 * same frame count/duration/resolution, and parse in MP4Box. Guarantees the
 * pipeline can never alter picture data.
 */
async function identityMuxOn(path: string): Promise<void> {
  const name = path.split(/[\\/]/).pop();
  console.log(`\n=== ${name} (identity mux) ===`);
  const raw = toFile(path);
  // Real-world fixtures are fragmented; demux needs progressive tables,
  // so remux first exactly like the app does.
  const file = (await isFragmentedFile(raw)) ? await remuxFragmented(raw) : raw;
  const { info, context } = await inspectMedia(file);

  const video = demuxVideo(context);
  const audio = demuxAudio(context);
  const encoded: MuxVideoSample[] = [];
  for (const s of video.samples) {
    const data = new Uint8Array(
      await file.slice(s.offset, s.offset + s.size).arrayBuffer(),
    );
    encoded.push({ ptsUs: s.ptsUs, isKey: s.isKey, data });
  }
  assert(encoded.length === video.samples.length, "all video samples read for identity mux");

  const out = muxProgressive({
    context,
    video,
    encoded,
    description: video.description,
    width: video.width,
    height: video.height,
    audio,
  });
  assert(out.size > 0, "identity mux produced a file");

  const outPath = path.replace(/\.mp4$/, ".remuxed.mp4");
  writeFileSync(outPath, Buffer.from(await out.arrayBuffer()));
  const outFile = toFile(outPath);
  const { info: outInfo, context: outCtx } = await inspectMedia(outFile);

  assert(outInfo.fastStart, "identity mux output is fast-start (moov first)");
  assert(
    outInfo.video.frames === info.video.frames,
    `frame count preserved (${outInfo.video.frames} vs ${info.video.frames})`,
  );
  assert(
    outInfo.video.width === video.width && outInfo.video.height === video.height,
    "resolution preserved",
  );
  assert(
    Math.abs(outInfo.durationSec - info.durationSec) < 0.05,
    `duration preserved (${outInfo.durationSec.toFixed(2)}s vs ${info.durationSec.toFixed(2)}s)`,
  );

  // Byte-identity: every video sample and every audio chunk matches source.
  const outVideo = demuxVideo(outCtx);
  const outAudio = demuxAudio(outCtx);
  assert(
    outVideo.samples.length === video.samples.length,
    "re-demux sees the same number of video samples",
  );
  if (audio) {
    assert(
      outAudio !== null && outAudio.sampleCount === audio.sampleCount,
      "audio sample count preserved",
    );
  }
  let videoBytesOk = true;
  for (let i = 0; i < video.samples.length; i++) {
    const a = video.samples[i];
    const b = outVideo.samples[i];
    const src = new Uint8Array(await file.slice(a.offset, a.offset + a.size).arrayBuffer());
    const dst = new Uint8Array(
      await outFile.slice(b.offset, b.offset + b.size).arrayBuffer(),
    );
    if (!bytesEqual(src, dst)) {
      videoBytesOk = false;
      break;
    }
  }
  assert(videoBytesOk, "all video sample bytes are identical after mux");
  // Relative timestamps must survive (a constant origin shift is fine, and
  // µs ↔ tick round-tripping can be off by one tick).
  const tickUs = 1_000_000 / video.timescale;
  const srcOrigin = video.samples[0].ptsUs;
  const outOrigin = outVideo.samples[0].ptsUs;
  assert(
    outVideo.samples.every(
      (s, i) =>
        s.isKey === video.samples[i].isKey &&
        Math.abs(s.ptsUs - outOrigin - (video.samples[i].ptsUs - srcOrigin)) <= tickUs + 1,
    ),
    "video sample flags and relative timestamps preserved",
  );

  if (audio && outAudio) {
    assert(
      outAudio.chunks.length === audio.chunks.length,
      "audio chunk count preserved",
    );
    let audioBytesOk = true;
    for (let i = 0; i < audio.chunks.length; i++) {
      const a = audio.chunks[i];
      const b = outAudio.chunks[i];
      const src = new Uint8Array(await file.slice(a.offset, a.offset + a.size).arrayBuffer());
      const dst = new Uint8Array(
        await outFile.slice(b.offset, b.offset + b.size).arrayBuffer(),
      );
      if (!bytesEqual(src, dst)) {
        audioBytesOk = false;
        break;
      }
    }
    assert(audioBytesOk, "audio bytes are bit-identical after mux");
  }

  try {
    const bx = await mp4boxInfo(outFile);
    const srcBx = await mp4boxInfo(file);
    assert(
      bx.nbSamples[0] === info.video.frames,
      "MP4Box sees the same video sample count",
    );
    assert(
      Math.abs(bx.duration - srcBx.duration) < 0.02,
      `MP4Box duration matches the source (${bx.duration.toFixed(3)}s vs ${srcBx.duration.toFixed(3)}s)`,
    );
  } catch (e) {
    assert(false, `MP4Box parse of identity mux failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function testIdentityMux(): Promise<void> {
  const dir = join(process.cwd(), "tests", "fixtures");
  await identityMuxOn(join(dir, "111.mp4"));
  // sample_5s has an AAC track: covers the audio pass-through path.
  await identityMuxOn(join(dir, "sample_5s.mp4"));
}

async function testSha256(): Promise<void> {
  console.log("\n=== sha256 (source identity) ===");
  assert(
    sha256Hex(new Uint8Array(0)) ===
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "empty input matches FIPS vector",
  );
  const enc = new TextEncoder();
  assert(
    sha256Hex(enc.encode("abc")) ===
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "'abc' matches FIPS vector",
  );
  assert(
    sha256Hex(enc.encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")) ===
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    "448-bit message matches FIPS vector",
  );

  const data = new Uint8Array(randomBytes(200_003));
  const expected = createHash("sha256").update(data).digest("hex");
  for (const size of [1, 3, 63, 64, 65, 4096, 12345, 200_003]) {
    const h = new Sha256();
    for (let i = 0; i < data.length; i += size) {
      h.update(data.subarray(i, Math.min(i + size, data.length)));
    }
    assert(h.digestHex() === expected, `chunked update matches node crypto (chunk=${size})`);
  }

  const viaFile = await sha256File(new File([data], "probe.bin"));
  assert(viaFile === expected, "sha256File matches node crypto over a File");

  const dir = join(process.cwd(), "tests", "fixtures");
  const fixture = readFileSync(join(dir, "111.mp4"));
  const fixtureRef = createHash("sha256").update(fixture).digest("hex");
  const viaFixture = await sha256File(
    new File([fixture.slice().buffer as ArrayBuffer], "111.mp4"),
  );
  assert(viaFixture === fixtureRef, "sha256File matches node crypto on the 111.mp4 fixture");
}

function fakeDecodeReport(pass: boolean): DecodeCompareReport {
  const run = {
    available: true,
    mode: "full" as const,
    expectedFrames: 120,
    decodedFrames: 120,
    errors: 0,
    errorDetail: null,
    firstPtsUs: 0,
    lastPtsUs: 4_000_000,
    deltaMinUs: 33_333,
    deltaMaxUs: 33_334,
    deltaDistinct: 2,
    width: 320,
    height: 240,
    format: "I420",
    content: emptyContent(),
  };
  return {
    available: true,
    mode: "full",
    orig: run,
    patched: run,
    totalOriginalFrames: 120,
    selectedFrames: 120,
    comparedFrames: pass ? 120 : 119,
    exactMatches: pass ? 120 : 118,
    differentFrames: pass ? 0 : 1,
    unmatchedPairs: pass ? 0 : 1,
    syntheticOutputs: 1080,
    minPsnr: pass ? 100 : 41.2,
    avgPsnr: pass ? 100 : 41.2,
    minSsim: pass ? 1 : 0.98,
    avgSsim: pass ? 1 : 0.98,
    pass,
    line: pass
      ? "Decoded frames compared: 120/120 selected, all exact (full decode), PSNR 100.0 dB min, SSIM 1.0000 min"
      : "Decoded-frame equivalence: FAIL (compared 119/120, exact 118, different 1, unmatched 1, decoder errors original/output 0/0)",
    notes: [],
  };
}

async function testValidation(): Promise<void> {
  console.log("\n=== validation gates (structural / payload / decoded) ===");
  const dir = join(process.cwd(), "tests", "fixtures");

  // --- pure decode helpers (no browser needed)
  const sel100 = selectFrameIndices(100);
  assert(
    sel100.mode === "full" && sel100.indices.length === 100 && sel100.every === 1,
    "selectFrameIndices: full decode for 100 frames",
  );
  const sel10k = selectFrameIndices(10_000);
  assert(
    sel10k.mode === "sampled" && sel10k.every === 6 && sel10k.indices.length === 1667,
    "selectFrameIndices: 10k frames sampled every 6th (1667 kept)",
  );
  assert(selectFrameIndices(1800).mode === "full", "selectFrameIndices: boundary 1800 = full");
  assert(selectFrameIndices(1801).mode === "sampled", "selectFrameIndices: boundary 1801 = sampled");

  const a = new Uint8Array([1, 2, 3, 4]);
  const b = new Uint8Array([1, 2, 3, 4]);
  const c = new Uint8Array([1, 2, 3, 5]);
  assert(frameMse(a, b) === 0, "frameMse: identical buffers = 0");
  assert((frameMse(a, c) ?? -1) > 0, "frameMse: differing buffers > 0");
  assert(frameMse(a, new Uint8Array(3)) === null, "frameMse: size mismatch = null");
  assert(psnrFromMse(0) === 100, "psnr: exact frames reported as 100 dB cap");
  const expectedPsnr = 10 * Math.log10((255 * 255) / 1);
  assert(
    Math.abs((psnrFromMse(1) ?? 0) - expectedPsnr) < 1e-9,
    "psnr: mse=1 matches 10*log10(65025) formula",
  );
  const flatX = new Uint8Array(64).fill(10);
  const flatY = new Uint8Array(64).fill(10);
  const flatZ = new Uint8Array(64).fill(200);
  assert(ssimLuma(flatX, flatY, 64) === 1, "ssim: identical luma = 1");
  const lowSsim = ssimLuma(flatX, flatZ, 64);
  assert(lowSsim !== null && lowSsim < 0.5, "ssim: unrelated luma well below 0.5");

  // --- Gate 1: real file passes, independent parser agrees
  const s1 = await validateStructure(toFile(join(dir, "sample_5s.mp4")));
  assert(s1.pass, "structure: sample_5s passes every native check");
  assert(s1.crossCheck.available, "structure: independent MP4Box parse ran");
  assert(s1.crossCheck.agrees, "structure: native parser and MP4Box agree");

  // --- Gate 1: negatives fail deterministically (never throw)
  const truncated = toFile(join(dir, "sample_5s.mp4"), "t.mp4");
  const truncatedBytes = readFileSync(join(dir, "sample_5s.mp4")).subarray(0, 40_000);
  const truncFile = new File(
    [truncatedBytes.buffer.slice(truncatedBytes.byteOffset, truncatedBytes.byteOffset + truncatedBytes.byteLength) as ArrayBuffer],
    "truncated.mp4",
  );
  const sTrunc = await validateStructure(truncFile);
  assert(!sTrunc.pass, "structure: truncated file fails");
  const sZero = await validateStructure(new File([new Uint8Array(0)], "zero.mp4"));
  assert(!sZero.pass, "structure: zero-byte file fails");
  const sGarbage = await validateStructure(
    new File([new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9])], "garbage.mp4"),
  );
  assert(!sGarbage.pass, "structure: garbage bytes fail");
  void truncated;

  // --- Fresh patch of a real file (with audio) through the gates
  const s5 = toFile(join(dir, "sample_5s.mp4"));
  const s5ctx = (await inspectMedia(s5)).context;
  const patched5 = new File(
    [(await transformMedia(s5ctx, { scrubMetadata: true, flattenFrameTiming: true })).blob],
    "sample_5s.fresh.patched.mp4",
  );
  const pv = await comparePayload(s5, patched5, "vide");
  const pa = await comparePayload(s5, patched5, "soun");
  assert(pv.pass, `payload: fresh video payload preserved (${pv.line})`);
  assert(
    pa.pass && pa.preserved > 0,
    `payload: audio samples copied verbatim (${pa.preserved} preserved)`,
  );
  const s5out = await validateStructure(patched5);
  assert(s5out.pass, "structure: fresh patched output passes");

  // --- Payload negatives
  const other = await comparePayload(s5, toFile(join(dir, "bbb_720_10s.mp4")), "vide");
  assert(!other.pass, "payload: comparing against a different file fails");
  const self = await comparePayload(s5, s5, "vide");
  assert(self.pass && self.synthetic === 0, "payload: self-comparison passes with 0 synthetic");

  // --- Whole-gate behaviour (decode injected: Node has no WebCodecs)
  const g1 = await runValidation(s5, patched5, { runDecode: false });
  assert(
    !g1.pass &&
      g1.gates[0].pass &&
      g1.gates[1].pass &&
      !g1.gates[2].pass &&
      g1.gates[2].detail.includes("not run"),
    "gates: decode not run => overall FAIL (fail closed, no download)",
  );

  const g2 = await runValidation(s5, patched5, { decoded: fakeDecodeReport(true) });
  assert(
    g2.pass && g2.gates.every((g) => g.pass),
    "gates: all three gates pass with verified decode evidence",
  );
  assert(
    g2.gates[0].ms >= 0 && g2.gates[1].ms >= 0 && g2.totalMs >= g2.gates[0].ms,
    "gates: every gate reports a measured duration",
  );

  const g3 = await runValidation(s5, patched5, { decoded: fakeDecodeReport(false) });
  assert(!g3.pass, "gates: failing decoded-frame gate blocks overall pass");

  const g4 = await runValidation(
    s5,
    toFile(join(dir, "bbb_720_10s.mp4")),
    { decoded: fakeDecodeReport(true) },
  );
  assert(!g4.pass && !g4.gates[1].pass, "gates: payload mismatch blocks overall pass");

  // --- Fragmented source has no moov sample tables: payload must fail closed
  const fragV = await comparePayload(
    toFile(join(dir, "111.mp4")),
    toFile(join(dir, "111.patched.mp4")),
    "vide",
  );
  assert(!fragV.pass, "payload: raw fragmented source fails closed (validate the remuxed copy)");
}

/**
 * Negative fixtures (tests/fixtures/negative): every one must fail
 * deterministically — either at inspection or at the structural gate —
 * and never produce a downloadable result.
 */
async function testNegativeFixtures(): Promise<void> {
  console.log("\n=== negative fixtures (deterministic fail-safe) ===");
  const negDir = join(process.cwd(), "tests", "fixtures", "negative");
  const expectInspectError: Record<string, string> = {
    "audio_only.mp4": "no-video",
    "no_moov.mp4": "no-moov",
  };
  const files = readdirSync(negDir).filter((f) => f.endsWith(".mp4"));
  assert(files.length === 4, `four negative fixtures present (found ${files.length})`);

  for (const f of files) {
    const file = toFile(join(negDir, f));
    const expect = expectInspectError[f];
    if (expect) {
      try {
        await inspectMedia(file);
        assert(false, `${f}: inspectMedia throws "${expect}"`);
      } catch (e) {
        const code = asPatchError(e).code;
        assert(code === expect, `${f}: inspectMedia throws "${expect}" (got "${code}")`);
      }
    }
    const s = await validateStructure(file);
    assert(!s.pass, `${f}: structural gate fails closed`);
    assert(
      s.checks.some((c) => !c.pass),
      `${f}: at least one failing structural check reported`,
    );
  }

  // bad_offset / corrupt_size can pass inspection; a patch attempt must
  // either throw or yield output that fails validation, and the payload
  // gate must fail against the untouched original either way.
  for (const f of ["bad_offset.mp4", "corrupt_size.mp4"]) {
    const file = toFile(join(negDir, f));
    let out: File | null = null;
    try {
      const { context } = await inspectMedia(file);
      const { blob } = await transformMedia(context, { scrubMetadata: true });
      out = new File([blob], f);
    } catch {
      assert(true, `${f}: patch attempt throws (fail-safe)`);
    }
    if (out) {
      const s = await validateStructure(out);
      assert(!s.pass, `${f}: produced output fails the structural gate`);
      const p = await comparePayload(file, out, "vide");
      assert(!p.pass, `${f}: payload gate fails for a corrupted input`);
    }
  }
}

/**
 * Fixture-matrix extras: rotation survives patching, edit lists are
 * handled, and file acceptance accepts mislabelled-but-valid content.
 */
async function testFixtureMatrixExtras(): Promise<void> {
  console.log("\n=== fixture matrix extras (rotation / edit list / acceptance) ===");
  const dir = join(process.cwd(), "tests", "fixtures");

  const rotIn = await inspectMedia(toFile(join(dir, "synth_rotation.mp4")));
  assert(
    rotIn.info.video.rotationDeg === 90,
    `input reports 90° rotation (got ${rotIn.info.video.rotationDeg}°)`,
  );
  const rotOut = new File(
    [(await transformMedia(rotIn.context, { scrubMetadata: true })).blob],
    "synth_rotation.patched.mp4",
  );
  const rotInfo = await inspectMedia(rotOut);
  assert(
    rotInfo.info.video.rotationDeg === 90,
    `rotation preserved through patching (got ${rotInfo.info.video.rotationDeg}°)`,
  );
  assert((await validateStructure(rotOut)).pass, "rotated output passes structure");
  const rotPayload = await comparePayload(
    toFile(join(dir, "synth_rotation.mp4")),
    rotOut,
    "vide",
  );
  assert(rotPayload.pass, "rotated input payload preserved");

  const elFile = toFile(join(dir, "synth_editlist.mp4"));
  const el = await inspectMedia(elFile);
  const elOut = new File(
    [(await transformMedia(el.context, { scrubMetadata: true })).blob],
    "synth_editlist.patched.mp4",
  );
  assert(
    (await validateStructure(elOut)).pass,
    "edit-list input patches and passes structure",
  );
  const elPayload = await comparePayload(elFile, elOut, "vide");
  assert(elPayload.pass, "edit-list input payload preserved");

  const sampleHead = readFileSync(join(dir, "sample_5s.mp4")).subarray(0, 32);
  const headAb = sampleHead.buffer.slice(
    sampleHead.byteOffset,
    sampleHead.byteOffset + sampleHead.byteLength,
  ) as ArrayBuffer;
  const mislabeled = new File([headAb], "clip.txt", { type: "" });
  assert(!isAcceptedFile(mislabeled), "wrong extension alone is not accepted");
  assert(await looksLikeMp4(mislabeled), "mp4 content named .txt sniffs as mp4");
  const text = new File([new TextEncoder().encode("hello world")], "notes.txt");
  assert(!isAcceptedFile(text), "plain text file rejected");
  assert(!(await looksLikeMp4(text)), "plain text does not sniff as mp4");
  assert(
    await looksLikeMp4(toFile(join(dir, "synth_id3.mp4"))),
    "ID3-prefixed mp4 sniffs as mp4",
  );
  assert(
    isAcceptedFile(new File([headAb], "clip.mov", { type: "video/quicktime" })),
    ".mov extension accepted",
  );
}

async function testReadSamples(): Promise<void> {
  console.log("\n=== readSamples (batched coalesced reads) ===");
  const dir = join(process.cwd(), "tests", "fixtures");
  const file = toFile(join(dir, "bbb_720_10s.mp4"));
  const table = await sampleTable(file, "vide");
  assert(table.length >= 32, `bbb fixture has >=32 video samples (${table.length})`);

  const direct = async (i: number): Promise<Uint8Array> =>
    new Uint8Array(
      await file.slice(table[i].offset, table[i].offset + table[i].size).arrayBuffer(),
    );

  const idx = Array.from({ length: Math.min(32, table.length) }, (_, k) => k);
  const batched = await readSamples(file, table, idx);
  let batchedOk = true;
  for (const i of idx) {
    if (!bytesEqual(batched[i], await direct(i))) batchedOk = false;
  }
  assert(batchedOk, "contiguous 32-sample batch matches direct per-sample slices");

  const stride: number[] = [];
  for (let i = 0; i < table.length; i += 7) stride.push(i);
  const strided = await readSamples(file, table, stride);
  let stridedOk = true;
  for (let k = 0; k < stride.length; k++) {
    if (!bytesEqual(strided[k], await direct(stride[k]))) stridedOk = false;
  }
  assert(stridedOk, "non-contiguous stride selection matches direct slices");

  const mixed = await readSamples(file, table, [0, 1, 2, 17, 18, 40, 41, 42, table.length - 1]);
  const mixedIdx = [0, 1, 2, 17, 18, 40, 41, 42, table.length - 1];
  let mixedOk = true;
  for (let k = 0; k < mixedIdx.length; k++) {
    if (!bytesEqual(mixed[k], await direct(mixedIdx[k]))) mixedOk = false;
  }
  assert(mixedOk, "mixed contiguous/non-contiguous selection matches direct slices");
}

async function testEnginesAndRunner(): Promise<void> {
  console.log("\n=== engines / eligibility / multi-method runner ===");
  const dir = join(process.cwd(), "tests", "fixtures");

  // ---- registry: declarations are checked, not assumed -------------------
  assert(ENGINES.length === 4, "registry lists four engines");
  assert(
    ENGINES.map((e) => e.id).join(",") ===
      "ghost-frame,hygiene-remux,timescale-divide,edit-list-signal",
    "registry order is ghost, hygiene, timescale, edit-list",
  );
  assert(
    ENGINES.every((e) => e.containerOnly && !e.reencodesVideo && !e.reencodesAudio),
    "every engine is container-only (no re-encode)",
  );
  const ghost = getEngine("ghost-frame");
  const hygiene = getEngine("hygiene-remux");
  const timescale = getEngine("timescale-divide");
  const editList = getEngine("edit-list-signal");
  assert(
    ghost.changesVideoSamples &&
      !hygiene.changesVideoSamples &&
      !timescale.changesVideoSamples &&
      !editList.changesVideoSamples,
    "only ghost changes video samples",
  );
  assert(
    !ghost.changesTiming && timescale.changesTiming &&
      !hygiene.changesTiming && !editList.changesTiming,
    "only timescale declares a timing change",
  );
  assert(
    !ghost.timingMayChange({}) &&
      !ghost.timingMayChange({ flattenFrameTiming: false }) &&
      ghost.timingMayChange({ flattenFrameTiming: true }),
    "ghost declares a timing change only with flatten enabled",
  );
  assert(timescale.timingMayChange({}), "timescale always declares a timing change");
  assert(
    !hygiene.timingMayChange({ flattenFrameTiming: true }) &&
      !editList.timingMayChange({}),
    "hygiene and edit-list never declare a timing change",
  );
  assert(
    timescaleDividerFor(60) === 2 && timescaleDividerFor(120) === 4,
    "frame-rate divisor: 60fps -> 2, 120fps -> 4",
  );
  assert(
    timescaleDividerFor(30) === null && timescaleDividerFor(24) === null,
    "frame-rate divisor refuses 24/30fps",
  );
  assert(
    timescaleDividerFor(59.94) === 2,
    "59.94fps rounds to 60 and divides by 2",
  );

  // ---- per-file eligibility ---------------------------------------------
  const sample = toFile(join(dir, "sample_5s.mp4"));
  const beforeHash = await sha256File(sample);
  const { info: sampleInfo } = await inspectMedia(sample);
  const sampleEl = computeEligibility(sample, sampleInfo);
  assert(sampleEl.length === 4, "eligibility covers every engine");
  const ghostEl = eligibilityFor(sampleEl, "ghost-frame");
  const hygEl = eligibilityFor(sampleEl, "hygiene-remux");
  const editEl = eligibilityFor(sampleEl, "edit-list-signal");
  assert(
    ghostEl?.status === "supported" && hygEl?.status === "supported",
    "30fps H.264 file: ghost and hygiene eligible",
  );
  assert(
    sampleInfo.video.hasEditList
      ? editEl?.status === "unsupported" &&
          editEl.reason === "already-has-edit-list"
      : editEl?.status === "supported",
    `edit-list eligibility mirrors the file's edit list (hasEditList=${sampleInfo.video.hasEditList})`,
  );
  const tsEl = eligibilityFor(sampleEl, "timescale-divide");
  assert(
    tsEl?.status === "unsupported" && tsEl.reason === "fps-unsupported",
    `30fps file: timescale refused with fps-unsupported (got "${tsEl?.reason}")`,
  );

  const editFixture = toFile(join(dir, "synth_editlist.mp4"));
  const { info: editInfo } = await inspectMedia(editFixture);
  const elOnEdit = eligibilityFor(
    computeEligibility(editFixture, editInfo),
    "edit-list-signal",
  );
  assert(
    elOnEdit?.status === "unsupported" && elOnEdit.reason === "already-has-edit-list",
    "file with an existing edit list: edit-list method refused",
  );

  const hevcFile = toFile(join(dir, "synth_hevc.mp4"));
  const { info: hevcInfo } = await inspectMedia(hevcFile);
  const hevcEl = computeEligibility(hevcFile, hevcInfo);
  assert(
    hevcEl.every((e) => e.status === "unsupported" && e.reason === "codec-not-avc"),
    "HEVC file: every method refused with codec-not-avc",
  );
  assert(!isEligible(hevcEl, "ghost-frame"), "isEligible reports ghost unsupported for HEVC");

  const hiFps = toFile(join(dir, "synth_120fps.mp4"));
  const { info: hiInfo } = await inspectMedia(hiFps);
  const hiEl = eligibilityFor(computeEligibility(hiFps, hiInfo), "timescale-divide");
  const hiDivider = timescaleDividerFor(hiInfo.video.fps)!;
  const hiDivisible =
    hiInfo.video.timescale % hiDivider === 0 &&
    hiInfo.video.durationTicks % hiDivider === 0;
  assert(
    hiEl?.status === (hiDivisible ? "supported" : "unsupported"),
    `120fps eligibility follows exact divisibility (timescale ${hiInfo.video.timescale}, ticks ${hiInfo.video.durationTicks}, divider ${hiDivider})`,
  );

  // ---- engine.process: hygiene remux -------------------------------------
  console.log("  -- hygiene-remux --");
  const hygieneOut = await hygiene.process(sample, {});
  const hCtx = await inspectMedia(new File([hygieneOut.blob], "hygiene.mp4"));
  assert(hCtx.info.video.frames === sampleInfo.video.frames, "hygiene keeps the frame count");
  assert(
    hygieneOut.stats.ghostFrames === 0 && hygieneOut.stats.multiplier === 1,
    "hygiene adds no padding samples",
  );
  assert(hygieneOut.stats.timestampsScrubbed, "hygiene scrubs creation dates");
  assert(
    (await validateStructure(hygieneOut.blob)).pass,
    "hygiene output passes the structural gate",
  );
  const hPayloadV = await comparePayload(sample, hygieneOut.blob, "vide");
  assert(
    hPayloadV.pass && hPayloadV.synthetic === 0,
    "hygiene video payload byte-identical, zero synthetic samples",
  );

  // ---- engine.process: edit-list signal ----------------------------------
  console.log("  -- edit-list-signal --");
  const editTarget = toFile(join(dir, "synth_avc3.mp4"));
  const { info: editTargetInfo } = await inspectMedia(editTarget);
  assert(
    !editTargetInfo.video.hasEditList,
    "precondition: synth_avc3 has no edit list",
  );
  const elOut = await editList.process(editTarget, {});
  const elCtx = await inspectMedia(new File([elOut.blob], "editlist.mp4"));
  assert(elCtx.info.video.hasEditList, "edit-list output carries an edit list");
  assert(
    elCtx.info.video.frames === editTargetInfo.video.frames,
    "edit-list keeps the frame count",
  );
  assert(
    (await validateStructure(elOut.blob)).pass,
    "edit-list output passes the structural gate",
  );
  const elPayload = await comparePayload(editTarget, elOut.blob, "vide");
  assert(
    elPayload.pass && elPayload.synthetic === 0,
    "edit-list video payload byte-identical",
  );
  try {
    await editList.process(editFixture, {});
    assert(false, "edit-list refuses a file that already has an edit list");
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : null;
    assert(
      code === "already-has-edit-list",
      `edit-list refuses a file with an edit list (got "${code}")`,
    );
  }

  // ---- engine.process: timescale divide ----------------------------------
  console.log("  -- timescale-divide --");
  try {
    await timescale.process(sample, {});
    assert(false, "timescale refuses a 30fps file at process time");
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : null;
    assert(
      code === "timescale-indivisible",
      `timescale refuses a 30fps file at process time (got "${code}")`,
    );
  }
  if (hiEl?.status === "supported") {
    const tsOut = await timescale.process(hiFps, {});
    const tsCtx = await inspectMedia(new File([tsOut.blob], "timescale.mp4"));
    assert(
      tsCtx.info.video.timescale === hiInfo.video.timescale / hiDivider,
      `video mdhd timescale divided by ${hiDivider}`,
    );
    assert(
      tsCtx.info.video.durationTicks === hiInfo.video.durationTicks / hiDivider,
      "video mdhd duration divided too",
    );
    assert(tsCtx.info.video.frames === hiInfo.video.frames, "timescale keeps every frame");
    assert(
      Math.abs(tsCtx.info.durationSec - hiInfo.durationSec) < 0.05,
      "movie header duration unchanged (mvhd untouched)",
    );
    assert(
      (await validateStructure(tsOut.blob)).pass,
      "timescale output passes the structural gate",
    );
    const tsPayload = await comparePayload(hiFps, tsOut.blob, "vide");
    assert(
      tsPayload.pass && tsPayload.synthetic === 0,
      "timescale payload byte-identical, no padding samples",
    );
    const tsMoov = tsCtx.context.moovBytes;
    const tsLocal = {
      type: "moov" as const,
      start: 0,
      size: tsMoov.length,
      headerSize: tsCtx.context.topLevel.moov.headerSize,
      end: tsMoov.length,
    };
    const tsTrack = findTrackByHandler(tsMoov, tsLocal as never, "vide")!;
    const tsStbl = findBoxPath(tsMoov, ["mdia", "minf", "stbl"], tsTrack.start, tsTrack.end)!;
    const tsSttsRef = findBox(tsMoov, "stts", tsStbl.start, tsStbl.end);
    const tsStts = tsSttsRef ? parseStts(tsMoov, tsSttsRef) : [];
    assert(
      tsStts.length > 0 && tsStts.every((entry) => entry.count > 0),
      "timescale stts has no zero-count entries (padCount guard)",
    );
  } else {
    assert(
      hiEl?.reason === "timescale-indivisible",
      `120fps fixture refused with timescale-indivisible (got "${hiEl?.reason}")`,
    );
  }

  // ---- multi-method runner -------------------------------------------------
  console.log("  -- runAllMethods --");
  const runs = await runAllMethods(sample, {
    info: sampleInfo,
    eligibility: sampleEl,
    runDecode: false,
  });
  assert(runs.length === 4, "runner returns one row per method");
  const tsRow = runs.find((r) => r.engineId === "timescale-divide");
  assert(
    tsRow?.status === "unsupported" && tsRow.reason === "fps-unsupported",
    "unsupported method reported with its reason, never run",
  );
  const editRow = runs.find((r) => r.engineId === "edit-list-signal");
  assert(
    editRow?.status === "unsupported" && editRow.reason === "already-has-edit-list",
    "edit-list row skipped with its reason on a file that already has an edit list",
  );
  for (const row of runs.filter((r) => r.status !== "unsupported")) {
    assert(row.validation !== null, `${row.engineId}: validation ran`);
    assert(
      row.validation!.gates.map((g) => g.id).join(",") ===
        "structural,payload,decoded,audio",
      `${row.engineId}: four gates in order`,
    );
    const gate = (id: string) => row.validation!.gates.find((g) => g.id === id)!;
    assert(gate("structural").pass, `${row.engineId}: structural gate passes`);
    assert(gate("payload").pass, `${row.engineId}: payload gate passes`);
    assert(gate("audio").pass, `${row.engineId}: audio gate passes`);
    assert(
      !gate("decoded").pass,
      `${row.engineId}: decoded gate fails closed without WebCodecs`,
    );
    assert(
      row.status === "failed",
      `${row.engineId}: overall status failed because the decode gate could not run`,
    );
    assert(
      row.output !== null && row.patchMs >= 0,
      `${row.engineId}: output and measured patch time recorded`,
    );
  }
  assert(
    runs.find((r) => r.engineId === "ghost-frame")?.timingChanged === false,
    "ghost row does not declare a timing change (flatten off)",
  );
  assert(
    runs.find((r) => r.engineId === "hygiene-remux")?.timingChanged === false,
    "hygiene row does not declare a timing change",
  );

  // Cancellation between stages: the first method starts and stops at the
  // next safe point; the remaining methods never start.
  let cancelCalls = 0;
  const cancelled = await runAllMethods(sample, {
    info: sampleInfo,
    eligibility: sampleEl,
    runDecode: false,
    shouldCancel: () => ++cancelCalls > 1,
  });
  const cancelRan = cancelled.filter((r) => r.status !== "unsupported");
  assert(
    cancelRan.length > 0 &&
      cancelRan.every((r) => r.status === "skipped" && r.reason === "cancelled"),
    "cancellation stops every started method at the next safe point",
  );

  // ---- audio gate (direct) -------------------------------------------------
  console.log("  -- audio gate --");
  const audioPayload = await comparePayload(sample, hygieneOut.blob, "soun");
  const audioGate = await validateAudio(sample, hygieneOut.blob, audioPayload);
  assert(audioGate.present && audioGate.pass, "audio gate passes for the hygiene output");
  const silent = toFile(join(dir, "bbb_720_10s.mp4"));
  const silentOut = await hygiene.process(silent, {});
  const silentPayload = await comparePayload(silent, silentOut.blob, "soun");
  const silentGate = await validateAudio(silent, silentOut.blob, silentPayload);
  assert(
    !silentGate.present && silentGate.pass,
    "no-audio source auto-passes the audio gate",
  );

  // ---- JSON evidence report -------------------------------------------------
  console.log("  -- report --");
  const validation = await runValidation(
    sample,
    new File([hygieneOut.blob], "report.mp4", { type: "video/mp4" }),
    { runDecode: false },
  );
  assert(
    validation.gates.map((g) => g.id).join(",") === "structural,payload,decoded,audio",
    "runValidation produces the four gates in order",
  );
  const rep = await buildReport({
    info: sampleInfo,
    engine: hygiene,
    stats: hygieneOut.stats,
    validation,
    sourceHash: beforeHash,
    sourceSize: sample.size,
    integrity: "verified",
    timingChanged: false,
    outputBlob: hygieneOut.blob,
    outputFileName: "report.mp4",
    options: { scrubMetadata: true, flattenFrameTiming: false },
  });
  assert(rep.schema === REPORT_SCHEMA, "report carries the schema id");
  const nodeHash = createHash("sha256")
    .update(Buffer.from(await hygieneOut.blob.arrayBuffer()))
    .digest("hex");
  assert(rep.output.sha256 === nodeHash, "report output sha256 matches node:crypto");
  assert(
    rep.source.sha256 === beforeHash && rep.sourceIntegrity === "verified",
    "report records the source hash and integrity gate",
  );
  assert(
    rep.method.evidence?.implementationStatus === "ported" &&
      rep.method.evidence?.liveTestStatus === "not-performed",
    "report copies the evidence entry verbatim",
  );
  assert(
    rep.timingChanged === false && rep.validation.gates.length === 4,
    "report records the timing flag and all four gates",
  );
  const text = serializeReport(rep);
  assert(
    text.endsWith("\n") && JSON.parse(text).schema === REPORT_SCHEMA,
    "serialized report is valid JSON with a trailing newline",
  );

  const afterHash = await sha256File(sample);
  assert(
    beforeHash === afterHash,
    "source bytes unchanged after every engine and runner pass",
  );
}

async function testContentAnalysis(): Promise<void> {
  console.log("\n=== decoded-content analysis (pure helpers) ===");
  const w = 160;
  const h = 90;

  const black = new Uint8Array(w * h);
  const blackStats = frameContentStats(black, w, h);
  assert(
    blackStats.blackRatio >= CONTENT_MIN_BLACK_RATIO && blackStats.mean < 4,
    "all-zero frame: blackRatio >= 0.98 and mean near 0",
  );

  const white = new Uint8Array(w * h).fill(255);
  const whiteStats = frameContentStats(white, w, h);
  assert(
    whiteStats.whiteRatio >= CONTENT_MIN_WHITE_RATIO && whiteStats.blackRatio < 0.5,
    "all-255 frame: whiteRatio >= 0.98, not counted black",
  );

  const flat = new Uint8Array(w * h).fill(128);
  const flatStats = frameContentStats(flat, w, h);
  assert(flatStats.sharpness === 0, "flat frame: laplacian variance 0");
  assert(
    flatStats.blackRatio < 0.5 && flatStats.whiteRatio < 0.5,
    "mid-grey frame: neither black nor white",
  );

  const gradient = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) gradient[y * w + x] = (x * 7 + y * 3) & 0xff;
  }
  const gradientStats = frameContentStats(gradient, w, h);
  assert(
    gradientStats.sharpness > flatStats.sharpness,
    "gradient frame: sharpness above flat frame",
  );

  const gridA = lumaGrid(gradient, w, h);
  const gridB = lumaGrid(gradient, w, h);
  assert(gridA.length === 64 * 64, "luma grid is 64x64");
  assert(
    (frameMse(gridA, gridB) ?? 1) <= CONTENT_DUPLICATE_MSE,
    "identical frames: grid MSE within the duplicate threshold",
  );
  const other = new Uint8Array(w * h).fill(200);
  assert(
    (frameMse(gridA, lumaGrid(other, w, h)) ?? 0) > CONTENT_DUPLICATE_MSE,
    "different frames: grid MSE above the duplicate threshold",
  );

  assert(
    laplacianVariance(new Uint8Array(64 * 64)) === 0,
    "flat grid: laplacian variance 0",
  );

  const empty = emptyContent();
  assert(
    empty.measured === 0 && empty.sharpnessAvg === null && empty.sharpnessMin === null,
    "empty content report: zeros and nulls",
  );
}

async function main(): Promise<void> {
  const dir = join(process.cwd(), "tests", "fixtures");
  const files = readdirSync(dir).filter(
    (f) =>
      f.endsWith(".mp4") && !f.includes(".patched.") && !f.includes(".remuxed."),
  );
  if (files.length === 0) {
    console.error("No fixtures found in tests/fixtures");
    process.exit(1);
  }
  for (const f of files) {
    const path = join(dir, f);
    try {
      const head = readFileSync(path).subarray(0, 12);
      const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
      const isHevc = f.includes("hevc");
      const expectError = f.includes("fragmented") ? "fragmented" : undefined;
      // Fragmented inputs are remuxed first, exactly like the app does —
      // except for fixtures that must keep throwing at inspection.
      let input: File | undefined;
      if (!expectError) {
        const candidate = toFile(path);
        if (await isFragmentedFile(candidate)) {
          input = await remuxFragmented(candidate);
        }
      }
      await testFile(
        path,
        {
          expectUnsupported: isHevc || brand === "hvc1",
          expectError,
        },
        input,
      );
    } catch (e) {
      failures++;
      console.error(`  ✗ ERROR in ${f}:`, e instanceof Error ? e.stack : e);
    }
  }

  try {
    await testFlattenFrameTiming();
  } catch (e) {
    failures++;
    console.error("  ✗ ERROR in flatten test:", e instanceof Error ? e.stack : e);
  }

  try {
    await testIdentityMux();
  } catch (e) {
    failures++;
    console.error("  ✗ ERROR in identity mux test:", e instanceof Error ? e.stack : e);
  }

  try {
    await testSha256();
  } catch (e) {
    failures++;
    console.error("  \u2717 ERROR in sha256 test:", e instanceof Error ? e.stack : e);
  }

  try {
    await testValidation();
  } catch (e) {
    failures++;
    console.error("  \u2717 ERROR in validation test:", e instanceof Error ? e.stack : e);
  }

  try {
    await testNegativeFixtures();
  } catch (e) {
    failures++;
    console.error("  \u2717 ERROR in negative fixture test:", e instanceof Error ? e.stack : e);
  }

  try {
    await testFixtureMatrixExtras();
  } catch (e) {
    failures++;
    console.error("  ✗ ERROR in fixture matrix extras:", e instanceof Error ? e.stack : e);
  }

  try {
    await testReadSamples();
  } catch (e) {
    failures++;
    console.error("  ✗ ERROR in readSamples regression test:", e instanceof Error ? e.stack : e);
  }

  try {
    await testEnginesAndRunner();
  } catch (e) {
    failures++;
    console.error("  ✗ ERROR in engines/runner test:", e instanceof Error ? e.stack : e);
  }

  try {
    await testContentAnalysis();
  } catch (e) {
    failures++;
    console.error("  ✗ ERROR in content analysis test:", e instanceof Error ? e.stack : e);
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
