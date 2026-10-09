/**
 * Fragmented MP4 (fMP4) support.
 *
 * Screen recorders and streaming pipelines often finalize `moov` with empty
 * sample tables and ship the real samples in `moof`/`mdat` pairs. The patching
 * pipeline needs one progressive file, so this module rebuilds
 * `ftyp + moov (full sample tables) + mdat` from the fragments:
 *
 *  - every sample is read from its fragment (`tfhd`/`tfdt`/`trun` → size,
 *    duration, flags, composition offset, absolute source offset) and
 *    re-published contiguously under new `stco` chunk offsets,
 *  - `stts`/`stsz`/`stsc`/`stss`/`ctts` are flattened from the fragment runs,
 *  - zeroed `mvhd`/`tkhd`/`mdhd` durations are computed from the sample runs,
 *  - `mvex`/`moof`/`sidx`/`styp`/`mfra` are dropped from the output.
 *
 * Samples are referenced in place via `Blob` slices: media bytes are never
 * copied into JavaScript memory.
 */

import {
  type BoxRef,
  PatchError,
  findBox,
  findBoxPath,
  fullBoxVersion,
  iterBoxes,
  readU32,
  readU64,
} from "./boxes";
import {
  buildBox,
  buildCtts,
  buildMdhd,
  buildMvhd,
  buildStco,
  buildStsc,
  buildStss,
  buildStsz,
  buildStts,
  buildTkhd,
  concat,
  u32,
} from "./build";
import { scanTopLevel } from "./inspect";

// tfhd flags - ISO/IEC 14496-12:2015 §8.8.7.1
const TFHD_BASE_DATA_OFFSET = 0x000001;
const TFHD_SAMPLE_DESC_INDEX = 0x000002;
const TFHD_DEFAULT_DURATION = 0x000008;
const TFHD_DEFAULT_SIZE = 0x000010;
const TFHD_DEFAULT_FLAGS = 0x000020;

// trun flags - ISO/IEC 14496-12:2015 §8.8.8.1
const TRUN_DATA_OFFSET = 0x000001;
const TRUN_FIRST_SAMPLE_FLAGS = 0x000004;
const TRUN_SAMPLE_DURATION = 0x000100;
const TRUN_SAMPLE_SIZE = 0x000200;
const TRUN_SAMPLE_FLAGS = 0x000400;
const TRUN_SAMPLE_CTO = 0x000800;

/** `sample_is_non_sync_sample` bit of the sample flags word. */
const SAMPLE_NON_SYNC = 0x00010000;

const EMPTY = new Uint8Array(0);

function ascii(text: string): Uint8Array {
  const b = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) b[i] = text.charCodeAt(i) & 0xff;
  return b;
}

function u64(value: number): Uint8Array {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, Math.floor(value / 0x1_0000_0000), false);
  dv.setUint32(4, value >>> 0, false);
  return b;
}

async function readSlice(file: File, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

/** Run-length encodes a numeric sequence into `{count, value}` runs. */
function rle(values: number[]): { count: number; value: number }[] {
  const runs: { count: number; value: number }[] = [];
  for (const v of values) {
    const last = runs[runs.length - 1];
    if (last && last.value === v) last.count++;
    else runs.push({ count: 1, value: v });
  }
  return runs;
}

interface SampleRec {
  size: number;
  duration: number;
  cto: number;
  flags: number;
  dts: number;
  /** Absolute offset inside the source file. */
  offset: number;
}

interface TrackPlan {
  trak: BoxRef;
  handler: string;
  trackId: number;
  samples: SampleRec[];
  mediaTimescale: number;
  mediaDuration: number;
  movieDuration: number;
  sttsEntries: { count: number; delta: number }[];
  sizes: number[];
  syncs: number[];
  allSync: boolean;
  ctts: { count: number; offset: number }[] | null;
  cttsVersion: 0 | 1;
  minCts: number;
}

/** True when the file's samples live in top-level `moof` fragments. */
export async function isFragmentedFile(file: File): Promise<boolean> {
  try {
    const tops = await scanTopLevel(file, 65536);
    return (
      tops.some((b) => b.type === "moov") && tops.some((b) => b.type === "moof")
    );
  } catch {
    return false;
  }
}

/**
 * Rebuilds a fragmented file as a single progressive MP4
 * (`ftyp + moov + mdat`). Returns the input unchanged when there are no
 * fragments. Throws {@link PatchError} when the fragments cannot be remuxed.
 */
export async function remuxFragmented(file: File): Promise<File> {
  const tops = await scanTopLevel(file, 65536);
  const ftyp = tops.find((b) => b.type === "ftyp");
  const moovAbs = tops.find((b) => b.type === "moov");
  if (!ftyp || !moovAbs) throw new PatchError("no-moov");
  const moofs = tops.filter((b) => b.type === "moof");
  if (moofs.length === 0) return file;

  const moovBytes = await readSlice(file, moovAbs.start, moovAbs.end);
  const moov: BoxRef = {
    type: "moov",
    start: 0,
    size: moovBytes.length,
    headerSize: moovAbs.headerSize,
    end: moovBytes.length,
  };

  // --- movie header ------------------------------------------------------
  const mvhd = findBox(moovBytes, "mvhd", 0, moovBytes.length);
  if (!mvhd) throw new PatchError("unsupported-boxes");
  const mvV1 = fullBoxVersion(moovBytes, mvhd) === 1;
  const mvTimescale = readU32(
    moovBytes,
    mvhd.start + mvhd.headerSize + (mvV1 ? 20 : 12),
  );
  if (mvTimescale === 0) throw new PatchError("unsupported-boxes");

  // --- keep only video + audio tracks ------------------------------------
  const plans: TrackPlan[] = [];
  for (const trak of iterBoxes(
    moovBytes,
    moov.start + moov.headerSize,
    moov.end,
  )) {
    if (trak.type !== "trak") continue;
    const hdlr = findBoxPath(moovBytes, ["mdia", "hdlr"], trak.start, trak.end);
    if (!hdlr) continue;
    const hAt = hdlr.start + hdlr.headerSize + 8; // version/flags + pre_defined
    if (hAt + 4 > hdlr.end) continue;
    const handler = String.fromCharCode(
      moovBytes[hAt],
      moovBytes[hAt + 1],
      moovBytes[hAt + 2],
      moovBytes[hAt + 3],
    );
    if (handler !== "vide" && handler !== "soun") continue;

    const tkhd = findBox(moovBytes, "tkhd", trak.start, trak.end);
    const mdhd = findBoxPath(moovBytes, ["mdia", "mdhd"], trak.start, trak.end);
    const stbl = findBoxPath(
      moovBytes,
      ["mdia", "minf", "stbl"],
      trak.start,
      trak.end,
    );
    if (!tkhd || !mdhd || !stbl) throw new PatchError("unsupported-boxes");
    const stsd = findBox(moovBytes, "stsd", stbl.start, stbl.end);
    if (!stsd) throw new PatchError("unsupported-boxes");
    const stsz = findBox(moovBytes, "stsz", stbl.start, stbl.end);
    if (stsz) {
      const existing = readU32(moovBytes, stsz.start + stsz.headerSize + 8);
      // Mixed progressive + fragmented layouts are not supported.
      if (existing > 0) throw new PatchError("fragmented");
    }

    const tkC = tkhd.start + tkhd.headerSize;
    const tkV1 = fullBoxVersion(moovBytes, tkhd) === 1;
    // content: v/f(4), creation, modification, track_ID → +12 (v0) / +20 (v1)
    const trackId = readU32(moovBytes, tkC + (tkV1 ? 20 : 12));
    const mdC = mdhd.start + mdhd.headerSize;
    const mdV1 = fullBoxVersion(moovBytes, mdhd) === 1;
    const mediaTimescale = readU32(moovBytes, mdC + (mdV1 ? 20 : 12));
    if (mediaTimescale === 0) throw new PatchError("unsupported-boxes");

    plans.push({
      trak,
      handler,
      trackId,
      samples: [],
      mediaTimescale,
      mediaDuration: 0,
      movieDuration: 0,
      sttsEntries: [],
      sizes: [],
      syncs: [],
      allSync: true,
      ctts: null,
      cttsVersion: 0,
      minCts: 0,
    });
  }
  if (plans.length === 0) throw new PatchError("unsupported-boxes");
  const byId = new Map<number, TrackPlan>(
    plans.map((p): [number, TrackPlan] => [p.trackId, p]),
  );

  // --- trex defaults -----------------------------------------------------
  const trexDefaults = new Map<
    number,
    { duration: number; size: number; flags: number }
  >();
  const mvex = findBox(moovBytes, "mvex", moov.start, moov.end);
  if (mvex) {
    for (const trex of iterBoxes(
      moovBytes,
      mvex.start + mvex.headerSize,
      mvex.end,
    )) {
      if (trex.type !== "trex") continue;
      const c = trex.start + trex.headerSize;
      if (c + 24 > trex.end) continue;
      trexDefaults.set(readU32(moovBytes, c + 4), {
        duration: readU32(moovBytes, c + 12),
        size: readU32(moovBytes, c + 16),
        flags: readU32(moovBytes, c + 20),
      });
    }
  }

  // --- walk fragments ----------------------------------------------------
  const nextDts = new Map<number, number>();
  for (const moofAbs of moofs) {
    const moof = await readSlice(file, moofAbs.start, moofAbs.end);
    for (const traf of iterBoxes(moof, moofAbs.headerSize, moof.length)) {
      if (traf.type !== "traf") continue;
      const tfhd = findBox(moof, "tfhd", traf.start, traf.end);
      if (!tfhd) throw new PatchError("corrupt");
      const tfC = tfhd.start + tfhd.headerSize;
      const tfFlags = readU32(moof, tfC) & 0xffffff;
      const trackId = readU32(moof, tfC + 4);
      const plan = byId.get(trackId);
      if (!plan) continue;

      let cursor = tfC + 8;
      let base: number | null = null;
      let defaultDuration = 0;
      let defaultSize = 0;
      let defaultFlags = 0;
      if (tfFlags & TFHD_BASE_DATA_OFFSET) {
        base = readU64(moof, cursor);
        cursor += 8;
      }
      if (tfFlags & TFHD_SAMPLE_DESC_INDEX) cursor += 4;
      if (tfFlags & TFHD_DEFAULT_DURATION) {
        defaultDuration = readU32(moof, cursor);
        cursor += 4;
      }
      if (tfFlags & TFHD_DEFAULT_SIZE) {
        defaultSize = readU32(moof, cursor);
        cursor += 4;
      }
      if (tfFlags & TFHD_DEFAULT_FLAGS) {
        defaultFlags = readU32(moof, cursor);
        cursor += 4;
      }
      // No base-data-offset ⇒ samples are relative to the containing moof.
      if (base === null) base = moofAbs.start;

      const tfdt = findBox(moof, "tfdt", traf.start, traf.end);
      let dts = nextDts.get(trackId) ?? 0;
      if (tfdt) {
        const c = tfdt.start + tfdt.headerSize;
        dts =
          fullBoxVersion(moof, tfdt) === 1
            ? readU64(moof, c + 4)
            : readU32(moof, c + 4);
      }
      let runPos = base;
      let seenTrun = false;
      const trex = trexDefaults.get(trackId);

      for (const trun of iterBoxes(moof, traf.start + traf.headerSize, traf.end)) {
        if (trun.type !== "trun") continue;
        seenTrun = true;
        const c = trun.start + trun.headerSize;
        const version = moof[c];
        const trFlags = readU32(moof, c) & 0xffffff;
        const count = readU32(moof, c + 4);
        let p = c + 8;
        if (trFlags & TRUN_DATA_OFFSET) {
          runPos = base + (readU32(moof, p) | 0);
          p += 4;
        }
        let firstFlags = 0;
        if (trFlags & TRUN_FIRST_SAMPLE_FLAGS) {
          firstFlags = readU32(moof, p);
          p += 4;
        }
        const perSample =
          (trFlags & TRUN_SAMPLE_DURATION ? 4 : 0) +
          (trFlags & TRUN_SAMPLE_SIZE ? 4 : 0) +
          (trFlags & TRUN_SAMPLE_FLAGS ? 4 : 0) +
          (trFlags & TRUN_SAMPLE_CTO ? 4 : 0);

        for (let i = 0; i < count; i++) {
          const at = p + i * perSample;
          if (at + perSample > moof.length) throw new PatchError("corrupt");
          let q = at;
          let duration = defaultDuration || trex?.duration || 0;
          let size = defaultSize || trex?.size || 0;
          let flags = defaultFlags || trex?.flags || 0;
          let cto = 0;
          if (trFlags & TRUN_SAMPLE_DURATION) {
            duration = readU32(moof, q);
            q += 4;
          }
          if (trFlags & TRUN_SAMPLE_SIZE) {
            size = readU32(moof, q);
            q += 4;
          }
          if (trFlags & TRUN_SAMPLE_FLAGS) {
            flags = readU32(moof, q);
            q += 4;
          }
          if (trFlags & TRUN_SAMPLE_CTO) {
            cto = version === 1 ? readU32(moof, q) | 0 : readU32(moof, q);
            q += 4;
          }
          if (i === 0 && (trFlags & TRUN_FIRST_SAMPLE_FLAGS) !== 0) flags = firstFlags;
          if (size === 0) throw new PatchError("corrupt");
          if (runPos < 0 || runPos + size > file.size) {
            throw new PatchError("corrupt");
          }
          plan.samples.push({ size, duration, cto, flags, dts, offset: runPos });
          runPos += size;
          dts += duration;
        }
      }
      if (seenTrun) nextDts.set(trackId, dts);
    }
  }

  // --- flatten per-track tables ------------------------------------------
  for (const plan of plans) {
    if (plan.samples.length === 0) continue;
    const ctos: number[] = [];
    let anyCto = false;
    let anyNegative = false;
    let anySync = false;
    let minCts = Number.POSITIVE_INFINITY;
    for (let i = 0; i < plan.samples.length; i++) {
      const s = plan.samples[i];
      plan.mediaDuration += s.duration;
      if ((s.flags & SAMPLE_NON_SYNC) === 0) {
        plan.syncs.push(i + 1);
        anySync = true;
      } else {
        plan.allSync = false;
      }
      if (s.cto !== 0) anyCto = true;
      if (s.cto < 0) anyNegative = true;
      ctos.push(s.cto);
      const cts = s.dts + s.cto;
      if (cts < minCts) minCts = cts;
    }
    if (plan.mediaDuration === 0) {
      plan.samples = [];
      continue;
    }
    if (plan.mediaDuration > 0xffff_ffff) throw new PatchError("too-large");
    plan.minCts = Number.isFinite(minCts) ? minCts : 0;
    plan.sttsEntries = rle(plan.samples.map((s) => s.duration)).map((r) => ({
      count: r.count,
      delta: r.value,
    }));
    plan.sizes = plan.samples.map((s) => s.size);
    if (anyCto) {
      plan.ctts = rle(ctos).map((r) => ({ count: r.count, offset: r.value }));
      plan.cttsVersion = anyNegative ? 1 : 0;
    }
    if (!anySync) plan.syncs = [];
    plan.allSync = plan.syncs.length === plan.samples.length;
    plan.movieDuration = Math.round(
      (plan.mediaDuration * mvTimescale) / plan.mediaTimescale,
    );
  }
  const kept = plans.filter((p) => p.samples.length > 0);
  if (kept.length === 0) throw new PatchError("fragmented");

  // --- rebuild one trak (stco supplied in the second pass) ---------------
  const stcoPlaceholder = (n: number): Uint8Array =>
    buildBox("stco", concat([u32(0), u32(n), new Uint8Array(n * 4)]));

  const buildEdts = (plan: TrackPlan): Uint8Array | null => {
    const elstRef = findBoxPath(moovBytes, ["edts", "elst"], plan.trak.start, plan.trak.end);
    if (elstRef) {
      const c = elstRef.start + elstRef.headerSize;
      const version = moovBytes[c];
      const count = readU32(moovBytes, c + 4);
      if (count !== 1) {
        const edts = findBox(moovBytes, "edts", plan.trak.start, plan.trak.end);
        if (!edts) return null;
        return moovBytes.slice(edts.start, edts.end);
      }
      // Keep the edit (skip/priming) but fill in the segment duration that
      // the recorder left at 0 because it never finalized the file.
      const segDur = version === 1 ? readU64(moovBytes, c + 8) : readU32(moovBytes, c + 8);
      const mediaTime = version === 1 ? readU64(moovBytes, c + 16) : readU32(moovBytes, c + 12);
      const rate = version === 1 ? readU32(moovBytes, c + 24) : readU32(moovBytes, c + 16);
      const newSeg = segDur > 0 ? segDur : plan.movieDuration;
      const elst = buildBox(
        "elst",
        version === 1
          ? concat([u32(0x01000000), u32(1), u64(newSeg), u64(mediaTime), u32(rate)])
          : concat([u32(0), u32(1), u32(newSeg), u32(mediaTime), u32(rate)]),
      );
      return buildBox("edts", elst);
    }
    // No edit list but presentation starts after the first composition time:
    // add one so players begin at t = 0.
    if (plan.handler === "vide" && plan.minCts > 0) {
      const elst = buildBox(
        "elst",
        concat([u32(0), u32(1), u32(plan.movieDuration), u32(plan.minCts), u32(0x10000)]),
      );
      return buildBox("edts", elst);
    }
    return null;
  };

  const buildTrak = (plan: TrackPlan, stco: Uint8Array): Uint8Array => {
    const { trak } = plan;
    const tkhd = findBox(moovBytes, "tkhd", trak.start, trak.end);
    const mdia = findBoxPath(moovBytes, ["mdia"], trak.start, trak.end);
    const mdhd = findBoxPath(moovBytes, ["mdia", "mdhd"], trak.start, trak.end);
    const hdlr = findBoxPath(moovBytes, ["mdia", "hdlr"], trak.start, trak.end);
    const minf = findBoxPath(moovBytes, ["mdia", "minf"], trak.start, trak.end);
    const stbl = findBoxPath(moovBytes, ["mdia", "minf", "stbl"], trak.start, trak.end);
    if (!tkhd || !mdia || !mdhd || !hdlr || !minf || !stbl) {
      throw new PatchError("unsupported-boxes");
    }
    const stsd = findBox(moovBytes, "stsd", stbl.start, stbl.end);
    if (!stsd) throw new PatchError("unsupported-boxes");

    const tkhdNew = buildTkhd(
      moovBytes.slice(tkhd.start, tkhd.end),
      plan.movieDuration,
    );
    const mdhdNew = buildMdhd(moovBytes.slice(mdhd.start + mdhd.headerSize, mdhd.end), {
      duration: plan.mediaDuration,
    });
    const hdlrRaw = moovBytes.slice(hdlr.start, hdlr.end);
    const elng = findBox(moovBytes, "elng", mdia.start, mdia.end);
    const elngRaw = elng ? moovBytes.slice(elng.start, elng.end) : null;
    const edtsNew = buildEdts(plan);

    const minfParts: Uint8Array[] = [];
    for (const child of iterBoxes(moovBytes, minf.start + minf.headerSize, minf.end)) {
      if (child.type === "stbl") continue;
      minfParts.push(moovBytes.slice(child.start, child.end));
    }

    const stsdRaw = moovBytes.slice(stsd.start, stsd.end);
    const stts = buildStts(plan.sttsEntries);
    const stss = !plan.allSync && plan.syncs.length > 0 ? buildStss(plan.syncs) : null;
    const ctts = plan.ctts ? buildCtts(plan.ctts, plan.cttsVersion) : null;
    const stsc = buildStsc([
      { firstChunk: 1, samplesPerChunk: 1, descriptionIndex: 1 },
    ]);
    const stsz = buildStsz(plan.sizes);
    const stblNew = buildBox(
      "stbl",
      concat([
        stsdRaw,
        stts,
        stss ?? EMPTY,
        ctts ?? EMPTY,
        stsc,
        stsz,
        stco,
      ]),
    );
    const minfNew = buildBox("minf", concat([...minfParts, stblNew]));
    const mdiaNew = buildBox(
      "mdia",
      concat([mdhdNew, hdlrRaw, elngRaw ?? EMPTY, minfNew]),
    );
    return buildBox("trak", concat([tkhdNew, edtsNew ?? EMPTY, mdiaNew]));
  };

  // --- assemble moov (two passes: size, then real chunk offsets) ---------
  const udta = findBox(moovBytes, "udta", moov.start, moov.end);
  const udtaRaw = udta ? moovBytes.slice(udta.start, udta.end) : null;
  const movieDuration = Math.max(...kept.map((p) => p.movieDuration));
  const mvhdNew = buildMvhd(
    moovBytes.slice(mvhd.start + mvhd.headerSize, mvhd.end),
    movieDuration,
  );
  const assembleMoov = (stcos: Map<number, Uint8Array>): Uint8Array =>
    buildBox(
      "moov",
      concat([
        mvhdNew,
        ...kept.map((p) => buildTrak(p, stcos.get(p.trackId) ?? stcoPlaceholder(p.samples.length))),
        udtaRaw ?? EMPTY,
      ]),
    );

  const placeholders = new Map<number, Uint8Array>(
    kept.map((p): [number, Uint8Array] => [p.trackId, stcoPlaceholder(p.samples.length)]),
  );
  const moovPass1 = assembleMoov(placeholders);

  const ftypBytes = await readSlice(file, ftyp.start, ftyp.end);
  const contentLen = kept.reduce(
    (sum, p) => sum + p.samples.reduce((a, s) => a + s.size, 0),
    0,
  );
  const mdatHeaderSize = contentLen + 8 > 0xffff_ffff ? 16 : 8;
  const newMdatStart = ftypBytes.length + moovPass1.length + mdatHeaderSize;
  if (newMdatStart + contentLen > 0xffff_ffff) throw new PatchError("too-large");

  const stcos = new Map<number, Uint8Array>();
  for (const plan of kept) {
    const offsets: number[] = [];
    let pos = newMdatStart;
    for (const s of plan.samples) {
      offsets.push(pos);
      pos += s.size;
    }
    stcos.set(plan.trackId, buildStco(offsets));
  }
  const moovOut = assembleMoov(stcos);
  if (moovOut.length !== moovPass1.length) throw new PatchError("corrupt");

  const mdatHeader =
    mdatHeaderSize === 16
      ? concat([u32(1), ascii("mdat"), u64(contentLen + 16)])
      : concat([u32(contentLen + 8), ascii("mdat")]);

  const parts: BlobPart[] = [
    ftypBytes as BlobPart,
    moovOut as BlobPart,
    mdatHeader as BlobPart,
  ];
  for (const plan of kept) {
    for (const s of plan.samples) parts.push(file.slice(s.offset, s.offset + s.size));
  }
  const blob = new Blob(parts, { type: "video/mp4" });
  return new File([blob], file.name, {
    type: file.type || "video/mp4",
    lastModified: file.lastModified,
  });
}
