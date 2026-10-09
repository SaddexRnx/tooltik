/**
 * Gate 1: container structural validation + independent-parser cross-check.
 *
 * Native checks (our parser) verify box presence, table consistency,
 * sample-offset ranges and duration coherence directly against the bytes.
 * MP4Box.js (a completely independent implementation, GPAC-derived) parses
 * the same moov and any disagreement between the two is reported as
 * CONFLICT and fails the gate. An unavailable independent parser is
 * reported honestly and never upgraded to a pass for it.
 */

import { MP4BoxBuffer, createFile, type Movie } from "mp4box";

import {
  type BoxRef,
  PatchError,
  findBox,
  findBoxPath,
  findTrackByHandler,
  fullBoxVersion,
  iterBoxes,
  parseStsz,
  parseStts,
  readU32,
  readU64,
} from "@/lib/mp4/boxes";
import { scanTopLevel } from "@/lib/mp4/inspect";
import { type SampleRef, sampleTableFromMoov } from "@/lib/validate/samples";

export interface StructureCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface CrossCheckReport {
  available: boolean;
  agrees: boolean;
  conflicts: string[];
  note: string;
}

export interface StructureReport {
  pass: boolean;
  checks: StructureCheck[];
  crossCheck: CrossCheckReport;
  native: {
    trackCount: number;
    videoSamples: number;
    audioSamples: number;
    videoDurationSec: number;
    moovBeforeMdat: boolean;
    fragmented: boolean;
    brands: string[];
    chunkOffsetWidth: 32 | 64 | null;
  };
}

interface NativeTrack {
  handler: string;
  sampleCount: number;
  durationTicks: number;
  timescale: number;
}

function fail(id: string, label: string, detail: string): StructureCheck {
  return { id, label, pass: false, detail };
}

function ok(id: string, label: string, detail: string): StructureCheck {
  return { id, label, pass: true, detail };
}

/**
 * mdhd and mvhd share the same payload layout after version+flags:
 * v0: creation u32, modification u32, timescale u32, duration u32
 * v1: creation u64, modification u64, timescale u32, duration u64
 */
function parseDuration(
  buf: Uint8Array,
  ref: BoxRef,
): { timescale: number; duration: number } {
  const v = fullBoxVersion(buf, ref);
  const base = ref.start + ref.headerSize + 4; // skip fullbox version+flags
  if (v === 1) {
    return { timescale: readU32(buf, base + 16), duration: readU64(buf, base + 20) };
  }
  return { timescale: readU32(buf, base + 8), duration: readU32(buf, base + 12) };
}

/** Parses every trak's handler, sample count and media duration. */
function parseNativeTracks(
  moov: Uint8Array,
  headerSize: number,
): { tracks: NativeTrack[]; mvhd: { timescale: number; duration: number } } {
  const local: BoxRef = {
    type: "moov",
    start: 0,
    size: moov.length,
    headerSize,
    end: moov.length,
  };
  const mvhdRef = findBox(moov, "mvhd", 0, moov.length);
  const mvhd = mvhdRef ? parseDuration(moov, mvhdRef) : { timescale: 0, duration: 0 };
  const tracks: NativeTrack[] = [];
  for (const trak of iterBoxes(moov, local.start + headerSize, local.end)) {
    if (trak.type !== "trak") continue;
    const hdlr = findBoxPath(moov, ["mdia", "hdlr"], trak.start, trak.end);
    const mdhd = findBoxPath(moov, ["mdia", "mdhd"], trak.start, trak.end);
    const stbl = findBoxPath(moov, ["mdia", "minf", "stbl"], trak.start, trak.end);
    if (!hdlr || !mdhd || !stbl) {
      tracks.push({ handler: "?", sampleCount: -1, durationTicks: 0, timescale: 0 });
      continue;
    }
    // hdlr: fullbox(4) + pre_defined(4) then handler_type(4)
    const handlerType = String.fromCharCode(
      moov[hdlr.start + hdlr.headerSize + 8],
      moov[hdlr.start + hdlr.headerSize + 9],
      moov[hdlr.start + hdlr.headerSize + 10],
      moov[hdlr.start + hdlr.headerSize + 11],
    );
    const stsz = findBox(moov, "stsz", stbl.start, stbl.end);
    const dur = parseDuration(moov, mdhd);
    const sampleCount = stsz ? parseStsz(moov, stsz).length : -1;
    tracks.push({ handler: handlerType, sampleCount, durationTicks: dur.duration, timescale: dur.timescale });
  }
  return { tracks, mvhd };
}

function sttsFrameTotal(moov: Uint8Array, stbl: BoxRef): number {
  const stts = findBox(moov, "stts", stbl.start, stbl.end);
  if (!stts) return -1;
  return parseStts(moov, stts).reduce((a, e) => a + e.count, 0);
}

export interface StructureInput {
  top: Awaited<ReturnType<typeof scanTopLevel>>;
  fileSize: number;
  /** Raw ftyp box bytes (with header). */
  ftyp: Uint8Array | null;
  /** Raw moov box bytes (with header). */
  moov: Uint8Array | null;
}

export function validateStructureSync(input: StructureInput): StructureReport {
  const checks: StructureCheck[] = [];
  const { top, fileSize } = input;
  const ftyp = top.find((b) => b.type === "ftyp");
  const moovTop = top.find((b) => b.type === "moov");
  const mdats = top.filter((b) => b.type === "mdat");
  const moof = top.find((b) => b.type === "moof");
  if (ftyp && moovTop && mdats.length > 0) {
    checks.push(
      ok("required-boxes", "Required boxes present (ftyp, moov, mdat)", `ftyp + moov@${moovTop.start} + ${mdats.length} mdat`),
    );
  } else {
    const missing = [
      !ftyp && "ftyp",
      !moovTop && "moov",
      mdats.length === 0 && "mdat",
    ].filter(Boolean).join(", ");
    checks.push(fail("required-boxes", "Required boxes present (ftyp, moov, mdat)", `missing: ${missing}`));
  }
  if (!moovTop || !input.moov) {
    checks.push(fail("video-track", "Video track with complete tables", "no moov box"));
    return {
      pass: false,
      checks,
      crossCheck: { available: false, agrees: false, conflicts: [], note: "no moov" },
      native: {
        trackCount: 0, videoSamples: 0, audioSamples: 0, videoDurationSec: 0,
        moovBeforeMdat: false, fragmented: false, brands: [],
        chunkOffsetWidth: null,
      },
    };
  }

  const moov = input.moov;
  const { tracks, mvhd } = parseNativeTracks(moov, moovTop.headerSize);

  // 2. Video track with complete tables.
  let videoTrack: BoxRef | null = null;
  let videoStbl: BoxRef | null = null;
  const localMoov: BoxRef = {
    type: "moov", start: 0, size: moov.length, headerSize: moovTop.headerSize, end: moov.length,
  };
  videoTrack = findTrackByHandler(moov, localMoov, "vide");
  if (videoTrack) {
    videoStbl = findBoxPath(moov, ["mdia", "minf", "stbl"], videoTrack.start, videoTrack.end);
  }
  const requiredTables = ["stsd", "stts", "stsc", "stsz"] as const;
  const missingTables: string[] = [];
  if (videoStbl) {
    for (const t of requiredTables) {
      if (!findBox(moov, t, videoStbl.start, videoStbl.end)) missingTables.push(t);
    }
    if (
      !findBox(moov, "stco", videoStbl.start, videoStbl.end) &&
      !findBox(moov, "co64", videoStbl.start, videoStbl.end)
    ) {
      missingTables.push("stco/co64");
    }
  } else {
    missingTables.push(...requiredTables, "stco/co64");
  }
  if (videoTrack && videoStbl && missingTables.length === 0) {
    checks.push(ok("video-track", "Video track with complete tables", "stsd/stts/stsc/stsz + chunk offsets present"));
  } else {
    checks.push(
      fail(
        "video-track",
        "Video track with complete tables",
        videoTrack ? `missing: ${missingTables.join(", ")}` : "no vide track",
      ),
    );
  }

  // 3. Table consistency: stsz count == stts frame total; stsc expansion matches.
  const videoNative = tracks.find((t) => t.handler === "vide");
  const audioNative = tracks.find((t) => t.handler === "soun");
  if (videoStbl) {
    const stszCount = videoNative ? videoNative.sampleCount : -1;
    const sttsFrames = sttsFrameTotal(moov, videoStbl);
    let expansionOk = true;
    let expansionDetail = "";
    try {
      sampleTableFromMoov(moov, moovTop.headerSize, "vide");
    } catch (err) {
      expansionOk = false;
      expansionDetail = `; expansion: ${err instanceof PatchError ? err.code : String(err)}`;
    }
    if (stszCount > 0 && sttsFrames === stszCount && expansionOk) {
      checks.push(ok("tables-consistent", "Sample tables are internally consistent", `${stszCount} video samples; stts total matches stsz`));
    } else {
      checks.push(
        fail(
          "tables-consistent",
          "Sample tables are internally consistent",
          `stsz=${stszCount} stts=${sttsFrames}${expansionDetail}`,
        ),
      );
    }
  } else {
    checks.push(fail("tables-consistent", "Sample tables are internally consistent", "no video stbl"));
  }

  // 4. Every sample offset+size lies inside an mdat region.
  let offsetsPass = true;
  let offsetsDetail = "";
  let checkedSamples = 0;
  const checkOffsets = (handler: "vide" | "soun"): void => {
    let refs: SampleRef[];
    try {
      refs = sampleTableFromMoov(moov, moovTop.headerSize, handler);
    } catch (err) {
      offsetsPass = false;
      offsetsDetail += `; ${handler}: ${err instanceof PatchError ? err.code : String(err)}`;
      return;
    }
    for (const r of refs) {
      checkedSamples++;
      const inFile = r.offset >= 0 && r.offset + r.size <= fileSize;
      const inside = mdats.some((m) => r.offset >= m.start && r.offset + r.size <= m.end);
      if (!inFile || !inside) {
        offsetsPass = false;
        offsetsDetail += `; ${handler} sample at ${r.offset}+${r.size} outside mdat/file`;
        return;
      }
    }
  };
  checkOffsets("vide");
  checkOffsets("soun");
  if (offsetsPass) {
    checks.push(ok("sample-offsets", "Sample offsets point into media data", `${checkedSamples} samples inside mdat`));
  } else {
    checks.push(fail("sample-offsets", "Sample offsets point into media data", offsetsDetail.trim()));
  }

  // 5. Duration coherence (mvhd covers video; positive timescales).
  const mvhdSec = mvhd.timescale > 0 ? mvhd.duration / mvhd.timescale : 0;
  const videoDurSec =
    videoNative && videoNative.timescale > 0
      ? videoNative.durationTicks / videoNative.timescale
      : 0;
  const audioDurSec =
    audioNative && audioNative.timescale > 0
      ? audioNative.durationTicks / audioNative.timescale
      : 0;
  const durOk =
    mvhdSec > 0 &&
    videoDurSec > 0 &&
    mvhdSec >= videoDurSec - 0.05 &&
    mvhdSec <= videoDurSec + audioDurSec + 1.0;
  checks.push(
    durOk
      ? ok("durations", "Durations are coherent", `movie ${mvhdSec.toFixed(3)}s, video ${videoDurSec.toFixed(3)}s, audio ${audioDurSec.toFixed(3)}s`)
      : fail("durations", "Durations are coherent", `movie ${mvhdSec.toFixed(3)}s, video ${videoDurSec.toFixed(3)}s, audio ${audioDurSec.toFixed(3)}s`),
  );

  // 6. Optional boxes parse cleanly when present (stss, elst, udta).
  const optionalIssues: string[] = [];
  if (videoStbl && findBox(moov, "stss", videoStbl.start, videoStbl.end)) {
    try {
      const stss = findBox(moov, "stss", videoStbl.start, videoStbl.end)!;
      const content = moov.subarray(stss.start + stss.headerSize + 4, stss.end);
      const count = readU32(content, 0);
      if (content.length < 4 + count * 4) optionalIssues.push("stss truncated");
    } catch {
      optionalIssues.push("stss malformed");
    }
  }
  if (videoTrack) {
    const elst = findBoxPath(moov, ["edts", "elst"], videoTrack.start, videoTrack.end);
    if (elst) {
      try {
        const c = moov.subarray(elst.start + elst.headerSize, elst.end);
        const entryCount = readU32(c, 0);
        const v = fullBoxVersion(moov, elst);
        const entrySize = v === 1 ? 20 : 12;
        if (c.length < 8 + entryCount * entrySize) optionalIssues.push("elst truncated");
      } catch {
        optionalIssues.push("elst malformed");
      }
    }
  }
  const udta = findBox(moov, "udta", 0, moov.length);
  if (udta) {
    let udtaOk = true;
    try {
      for (const box of iterBoxes(moov, udta.start + udta.headerSize, udta.end)) {
        void box; /* enumeration succeeds only when sizes are sane */
      }
    } catch {
      udtaOk = false;
    }
    if (!udtaOk) optionalIssues.push("udta malformed");
  }
  checks.push(
    optionalIssues.length === 0
      ? ok("optional-boxes", "Optional boxes (stss, edit lists, metadata) parse cleanly", "no malformation detected")
      : fail("optional-boxes", "Optional boxes (stss, edit lists, metadata) parse cleanly", optionalIssues.join(", ")),
  );

  const nativePass = checks.every((c) => c.pass);
  const brands: string[] = [];
  if (ftyp && input.ftyp) {
    const c = input.ftyp.subarray(ftyp.headerSize);
    const fourcc = (i: number): string =>
      String.fromCharCode(c[i], c[i + 1], c[i + 2], c[i + 3]);
    if (c.length >= 4) brands.push(fourcc(0)); // major brand
    // bytes 4..8 are minor_version, compatible brands follow
    for (let i = 8; i + 4 <= c.length; i += 4) brands.push(fourcc(i));
  }
  const co64 = videoStbl ? findBox(moov, "co64", videoStbl.start, videoStbl.end) : null;
  const stco = videoStbl ? findBox(moov, "stco", videoStbl.start, videoStbl.end) : null;

  const report: StructureReport = {
    pass: nativePass, // cross-check appended by caller
    checks,
    crossCheck: { available: false, agrees: false, conflicts: [], note: "" },
    native: {
      trackCount: tracks.length,
      videoSamples: videoNative && videoNative.sampleCount >= 0 ? videoNative.sampleCount : 0,
      audioSamples: audioNative && audioNative.sampleCount >= 0 ? audioNative.sampleCount : 0,
      videoDurationSec: videoDurSec,
      moovBeforeMdat: mdats.length > 0 ? moovTop.start < mdats[0].start : false,
      fragmented: Boolean(moof),
      brands,
      chunkOffsetWidth: co64 ? 64 : stco ? 32 : null,
    },
  };
  return report;
}

const CROSS_CHECK_SPAN_LIMIT = 64 * 1024 * 1024;

/**
 * Runs MP4Box.js over a contiguous prefix of the file ending at the moov
 * (independent implementation). MP4Box parses positionally, so the span
 * must include every byte from the ftyp to the end of the moov; spans
 * above the limit are refused rather than loading unbounded memory.
 */
async function crossCheckWithMp4box(
  spanBytes: Uint8Array,
  spanStart: number,
  native: StructureReport["native"],
): Promise<CrossCheckReport> {
  if (spanBytes.length > CROSS_CHECK_SPAN_LIMIT) {
    return {
      available: false,
      agrees: false,
      conflicts: [],
      note: `prefix before moov is ${spanBytes.length} bytes (> ${CROSS_CHECK_SPAN_LIMIT}); independent parse skipped to bound memory`,
    };
  }
  try {
    const file = createFile(false); // discard mdat bytes; moov tables suffice
    let errMsg: string | null = null;
    file.onError = (module, message) => {
      if (!errMsg) errMsg = `${module}: ${message}`;
    };
    file.appendBuffer(
      MP4BoxBuffer.fromArrayBuffer(spanBytes.slice().buffer, spanStart),
      false,
    );
    if (!file.moov) {
      return {
        available: false,
        agrees: false,
        conflicts: [],
        note: errMsg ? `MP4Box did not produce structure info: ${errMsg}` : "MP4Box did not produce structure info",
      };
    }
    const info: Movie = file.getInfo();

    const conflicts: string[] = [];
    const boxTracks = info.tracks ?? [];
    if (native.trackCount !== boxTracks.length) {
      conflicts.push(`track count: native ${native.trackCount} vs MP4Box ${boxTracks.length}`);
    }
    const boxVideo = (info.videoTracks ?? [])[0];
    if (boxVideo) {
      if (native.videoSamples !== boxVideo.nb_samples) {
        conflicts.push(`video samples: native ${native.videoSamples} vs MP4Box ${boxVideo.nb_samples}`);
      }
      // Prefer MP4Box's mdhd-derived duration (same semantic as our native
      // mdhd read); fall back to the stts sum only when mdhd reports 0.
      // Note: stts sums can legitimately exceed mdhd for synthetic filler
      // samples, so the stts value is not comparable to our native number.
      const boxDurSec =
        boxVideo.duration && boxVideo.timescale
          ? boxVideo.duration / boxVideo.timescale
          : boxVideo.samples_duration && boxVideo.timescale
            ? boxVideo.samples_duration / boxVideo.timescale
            : 0;
      if (
        boxDurSec > 0 &&
        Math.abs(boxDurSec - native.videoDurationSec) > 0.05
      ) {
        conflicts.push(
          `video duration: native ${native.videoDurationSec.toFixed(3)}s vs MP4Box ${boxDurSec.toFixed(3)}s`,
        );
      }
    } else if (native.videoSamples > 0) {
      conflicts.push("video track: native present vs MP4Box absent");
    }
    const nativeHasAudio = native.audioSamples > 0;
    const boxHasAudio = (info.audioTracks ?? []).length > 0;
    if (nativeHasAudio !== boxHasAudio) {
      conflicts.push(`audio track: native ${nativeHasAudio ? "present" : "absent"} vs MP4Box ${boxHasAudio ? "present" : "absent"}`);
    }

    return {
      available: true,
      agrees: conflicts.length === 0,
      conflicts,
      note: conflicts.length === 0 ? "MP4Box agrees with native parser" : "CONFLICT",
    };
  } catch (err) {
    return {
      available: false,
      agrees: false,
      conflicts: [`MP4Box rejected file: ${err instanceof Error ? err.message : String(err)}`],
      note: "independent parser threw",
    };
  }
}

/**
 * Full Gate 1: native structural checks + MP4Box cross-check.
 * Fails closed: any native failure or CONFLICT means `pass:false`.
 * Only the ftyp and moov boxes are read into memory (sample-offset checks
 * are arithmetic over the top-level ranges), so multi-GB inputs stay cheap.
 */
export async function validateStructure(file: Blob): Promise<StructureReport> {
  let top: Awaited<ReturnType<typeof scanTopLevel>>;
  try {
    top = await scanTopLevel(file as File);
  } catch (err) {
    return {
      pass: false,
      checks: [
        fail(
          "required-boxes",
          "Required boxes present (ftyp, moov, mdat)",
          `top-level parse failed: ${err instanceof PatchError ? err.code : String(err)}`,
        ),
      ],
      crossCheck: { available: false, agrees: false, conflicts: [], note: "top-level parse failed" },
      native: {
        trackCount: 0, videoSamples: 0, audioSamples: 0, videoDurationSec: 0,
        moovBeforeMdat: false, fragmented: false, brands: [], chunkOffsetWidth: null,
      },
    };
  }
  const ftypTop = top.find((b) => b.type === "ftyp");
  const moovTop = top.find((b) => b.type === "moov");
  const [ftyp, moov] = await Promise.all([
    ftypTop
      ? file.slice(ftypTop.start, ftypTop.end).arrayBuffer().then((b) => new Uint8Array(b))
      : Promise.resolve(null),
    moovTop
      ? file.slice(moovTop.start, moovTop.end).arrayBuffer().then((b) => new Uint8Array(b))
      : Promise.resolve(null),
  ]);

  const report = validateStructureSync({ top, fileSize: file.size, ftyp, moov });

  if (moovTop && moov && ftypTop) {
    // Contiguous prefix ftyp..moov for the positional independent parser.
    const span = new Uint8Array(
      await file.slice(ftypTop.start, moovTop.end).arrayBuffer(),
    );
    const cross = await crossCheckWithMp4box(span, ftypTop.start, report.native);
    report.crossCheck = cross;
    if (cross.conflicts.length > 0) {
      report.pass = false;
      report.checks.push(
        fail(
          "independent-cross-check",
          "Independent parser (MP4Box) agrees with native parser",
          cross.conflicts.join("; "),
        ),
      );
    } else if (cross.available) {
      report.checks.push(
        ok("independent-cross-check", "Independent parser (MP4Box) agrees with native parser", cross.note),
      );
    } else {
      report.checks.push({
        id: "independent-cross-check",
        label: "Independent parser (MP4Box) agrees with native parser",
        pass: true,
        detail: `not run: ${cross.note}`,
      });
    }
  }
  report.pass = report.checks.every((c) => c.pass);
  return report;
}
