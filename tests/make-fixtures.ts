/**
 * Generates small synthetic MP4 fixtures for edge cases real-world samples
 * do not cover:
 *
 *   1. synth_5994_co64.mp4  – H.264, 59.94 fps, 64-bit chunk offsets (co64),
 *                             moov first (fast-start)
 *   2. synth_hevc.mp4       – H.265/HEVC (must be flagged unsupported)
 *   3. synth_vfr.mp4        – variable frame rate (multi-entry stts)
 *   4. synth_no_dinf.mp4    – video minf without dinf/vmhd references
 *   5. synth_avc3.mp4       – avc3 sample entry (in-band parameter sets)
 *   6. synth_fragmented.mp4 – moov without sample tables + top-level moof
 *   7. synth_id3.mp4        – ID3v2 tag in front of the first box
 *   8. synth_120fps.mp4     – 120 fps content
 *   9. synth_rotation.mp4   – tkhd matrix rotated 90°
 *   10. synth_editlist.mp4    – edit list (edts/elst) on the video trak
 *   11. synth_qt.mp4         – QuickTime "qt  " ftyp brand
 *   12. synth_real60.mp4     – REAL H.264 samples copied from bbb_720_10s.mp4,
 *                              retimed to 60 fps, no edit list: decodable in a
 *                              browser and eligible for all four methods
 *                              (browser e2e evidence for timescale + edit-list).
 *
 * Negative fixtures (must fail deterministically) go to tests/fixtures/negative:
 *   audio_only, no_moov, bad_offset, corrupt_size
 *
 * Usage: npx tsx tests/make-fixtures.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  findBox,
  findBoxPath,
  findTrackByHandler,
  parseStss,
  type BoxRef,
} from "../lib/mp4/boxes";
import { loadMoov, readSamples, sampleTable } from "../lib/validate/samples";

// --- tiny ISOBMFF builders (test-only) -------------------------------------

function u32(v: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v >>> 0, false);
  return b;
}
function u16(v: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v & 0xffff, false);
  return b;
}
function u64(v: number): Uint8Array {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, Math.floor(v / 0x1_0000_0000), false);
  dv.setUint32(4, v >>> 0, false);
  return b;
}
function ascii(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}
function cat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
function box(type: string, ...content: Uint8Array[]): Uint8Array {
  const body = cat(...content);
  return cat(u32(8 + body.length), ascii(type), body);
}
const IDENTITY_MATRIX = cat(
  u32(0x00010000), u32(0), u32(0),
  u32(0), u32(0x00010000), u32(0),
  u32(0), u32(0), u32(0x40000000),
);

interface Spec {
  brand: "avc1" | "avc3" | "hvc1";
  width: number;
  height: number;
  timescale: number;
  /** Sample durations in media ticks (one entry per run of equal deltas). */
  stts: { count: number; delta: number }[];
  frameCount: number;
  useCo64: boolean;
  /** Video minf without a dinf data-reference sub-tree. */
  omitDinf?: boolean;
  /** moov with no sample tables + a top-level moof box (streamed file). */
  fragmented?: boolean;
  /** Bytes prepended in front of ftyp after building (chunk offsets include it). */
  prefixBytes?: number;
  /** hdlr type; "soun" builds an audio-only file (no video track). */
  handler?: "vide" | "soun";
  /** tkhd display rotation (degrees, clockwise). */
  rotationDeg?: 90 | 180 | 270;
  /** Adds an edit list (edts/elst) to the trak. */
  editList?: boolean;
  /** ftyp major brand override (e.g. "qt  "). */
  majorBrand?: string;
  /** Pushes the chunk offset far past EOF (invalid media ranges). */
  badOffset?: boolean;
  /** Makes one stsz entry absurdly large (invalid sample size). */
  corruptSize?: boolean;
  /** Omits the moov box entirely. */
  omitMoov?: boolean;
  /** Real length-prefixed samples replacing the fake NAL (frameCount must match). */
  realSamples?: Uint8Array[];
  /** Raw `avcC` box BODY (without the box header) replacing the fake one. */
  avcCBody?: Uint8Array;
  /** 1-based sync sample numbers written to `stss`. */
  stssSyncs?: number[];
}

function buildFixture(spec: Spec): Uint8Array {
  const { brand, width, height, timescale, stts, frameCount, useCo64, omitDinf, fragmented } = spec;
  const prefixBytes = spec.prefixBytes ?? 0;
  const isHevc = brand === "hvc1";
  const handler = spec.handler ?? "vide";
  const rotationDeg = spec.rotationDeg ?? 0;

  // --- media: one IDR-ish NAL per frame, constant size -----------------------
  const nalPayload = new Uint8Array(64);
  nalPayload[0] = isHevc ? 0x26 : 0x65; // IDR_W_RADL (HEVC) / IDR (AVC)
  for (let i = 1; i < nalPayload.length; i++) nalPayload[i] = (i * 7 + 13) & 0xff;
  const fakeSample = cat(u32(nalPayload.length), nalPayload);
  const mediaSamples: Uint8Array[] =
    spec.realSamples ?? new Array<Uint8Array>(frameCount).fill(fakeSample);
  if (spec.realSamples && spec.realSamples.length !== frameCount) {
    throw new Error("realSamples length must equal frameCount");
  }
  const mdatContent = cat(...mediaSamples);
  const totalTicks = stts.reduce((a, e) => a + e.count * e.delta, 0);

  // --- sample description ---------------------------------------------------
  const fixed = cat(
    new Uint8Array(6),          // reserved
    u16(1),                     // data_reference_index
    u16(0), u16(0),             // pre_defined, reserved
    new Uint8Array(12),         // pre_defined[3]
    u16(width), u16(height),
    u32(0x00480000), u32(0x00480000), // 72 dpi
    u32(0),
    u16(1),                     // frame_count
    new Uint8Array(32),         // compressor name
    u16(0x0018),                // depth
    u16(0xffff),                // pre_defined
  );
  let codecChild: Uint8Array;
  if (isHevc) {
    // minimal hvcC (configurationVersion 1)
    const hvcC = cat(
      new Uint8Array([1, 1, 0x60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xf0, 0, 0, 0, 0, 0]),
      u16(0), // lengthSizeMinusOne in top bits, 0 arrays
    );
    codecChild = box("hvcC", hvcC);
  } else {
    const avcCBody =
      spec.avcCBody ??
      cat(
        new Uint8Array([1, 0x64, 0x00, 0x28, 0xff, 0xe1]),
        u16(8),
        new Uint8Array([0x67, 0x64, 0x00, 0x28, 0xac, 0xd9, 0x40, 0x78]),
        u16(4),
        new Uint8Array([0x68, 0xeb, 0xec, 0xb2]),
      );
    codecChild = box("avcC", avcCBody);
  }
  const sampleEntry = box(brand, fixed, codecChild);
  const stsd = box("stsd", u32(0), u32(1), sampleEntry);

  const sttsBytes = box(
    "stts",
    u32(0),
    u32(stts.length),
    ...stts.flatMap((e) => [u32(e.count), u32(e.delta)]),
  );
  const stsc = box("stsc", u32(0), u32(1), u32(1), u32(frameCount), u32(1));
  const sampleSizes = mediaSamples.map((s) => s.length);
  if (spec.corruptSize && frameCount > 1) sampleSizes[1] = 0xfffffff0;
  const stsz = box(
    "stsz",
    u32(0),
    u32(0),
    u32(frameCount),
    ...sampleSizes.map((s) => u32(s)),
  );
  const stssBox =
    spec.stssSyncs && spec.stssSyncs.length > 0
      ? box("stss", u32(0), u32(spec.stssSyncs.length), ...spec.stssSyncs.map((n) => u32(n)))
      : null;

  const mdhd = box(
    "mdhd",
    u32(0), u32(0), u32(0),
    u32(timescale),
    u32(totalTicks),
    u16(0x55c4), // 'und'
    u16(0),
  );
  const hdlr = box(
    "hdlr",
    u32(0), u32(0),
    ascii(handler),
    new Uint8Array(12),
    ascii(handler === "soun" ? "SoundHandler" : "VideoHandler"),
    new Uint8Array(1),
  );
  const vmhd = box("vmhd", u32(1), u16(0), u16(0), u16(0), u16(0));
  const url = box("url ", u32(1));
  const dref = box("dref", u32(0), u32(1), url);
  const dinf = box("dinf", dref);

  const movieTimescale = 1000;
  const durationMs = Math.round((totalTicks / timescale) * movieTimescale);
  const mvhd = box(
    "mvhd",
    u32(0), u32(0), u32(0),
    u32(movieTimescale),
    u32(durationMs),
    u32(0x00010000),
    u16(0x0100),
    u16(0),
    u32(0), u32(0),
    IDENTITY_MATRIX,
    new Uint8Array(24),
    u32(2),
  );
  const tkhdMatrix = rotationDeg === 0
    ? IDENTITY_MATRIX
    : rotationDeg === 90
      ? cat(u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0xffff0000), u32(0), u32(0), u32(0x40000000))
      : rotationDeg === 180
        ? cat(u32(0xffff0000), u32(0), u32(0), u32(0), u32(0), u32(0xffff0000), u32(0), u32(0), u32(0x40000000))
        : cat(u32(0), u32(0xffff0000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0x40000000));
  const tkhd = box(
    "tkhd",
    u32(7), u32(0), u32(0),
    u32(1),
    u32(0),
    u32(durationMs),
    u32(0), u32(0),
    u16(0), u16(0),
    u16(0), u16(0),
    tkhdMatrix,
    u32(width << 16),
    u32(height << 16),
  );
  const elst = box("elst", u32(0), u32(1), u32(durationMs), u32(0), u32(0x00010000));
  const edts = box("edts", elst);

  // --- moov with placeholder offsets, then real offsets ---------------------
  const buildMoov = (offsets: number[]): Uint8Array => {
    const effOffsets = spec.badOffset ? offsets.map((o) => o + 0x7fff0000) : offsets;
    const chunkOffsets = useCo64
      ? box("co64", u32(0), u32(effOffsets.length), ...effOffsets.map((o) => u64(o)))
      : box("stco", u32(0), u32(effOffsets.length), ...effOffsets.map((o) => u32(o)));
    const stblChildren = [
      stsd,
      sttsBytes,
      stsc,
      stsz,
      ...(stssBox ? [stssBox] : []),
      chunkOffsets,
    ];
    const stbl = fragmented ? box("stbl", stsd) : box("stbl", ...stblChildren);
    const minf = omitDinf ? box("minf", vmhd, stbl) : box("minf", vmhd, dinf, stbl);
    const mdia = box("mdia", mdhd, hdlr, minf);
    const trakChildren = spec.editList ? [tkhd, edts, mdia] : [tkhd, mdia];
    const trak = box("trak", ...trakChildren);
    return box("moov", mvhd, trak);
  };

  const ftyp = box("ftyp", ascii(spec.majorBrand ?? "mp42"), u32(512), ascii("mp42isom"));
  if (spec.omitMoov) return cat(ftyp, box("mdat", mdatContent));
  const moovPlaceholder = buildMoov([0]);
  const mdatStart = ftyp.length + moovPlaceholder.length;
  const mdat = box("mdat", mdatContent);
  const firstOffset = mdatStart + 8 + prefixBytes; // single chunk
  const moov = buildMoov([firstOffset]);
  if (moov.length !== moovPlaceholder.length) {
    throw new Error("moov size changed after offset fill");
  }
  if (fragmented) {
    const moof = box("moof", box("mfhd", u32(0), u32(1)));
    return cat(ftyp, moov, mdat, moof);
  }
  return cat(ftyp, moov, mdat);
}

// --- generate ----------------------------------------------------------------

const dir = join(process.cwd(), "tests", "fixtures");

writeFileSync(
  join(dir, "synth_5994_co64.mp4"),
  buildFixture({
    brand: "avc1",
    width: 1920,
    height: 1080,
    timescale: 60000,
    stts: [{ count: 120, delta: 1001 }], // 59.94 fps
    frameCount: 120,
    useCo64: true,
  }),
);

writeFileSync(
  join(dir, "synth_hevc.mp4"),
  buildFixture({
    brand: "hvc1",
    width: 1280,
    height: 720,
    timescale: 30000,
    stts: [{ count: 90, delta: 1000 }],
    frameCount: 90,
    useCo64: false,
  }),
);

writeFileSync(
  join(dir, "synth_vfr.mp4"),
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [
      { count: 60, delta: 1000 },
      { count: 60, delta: 2000 },
    ],
    frameCount: 120,
    useCo64: false,
  }),
);

writeFileSync(
  join(dir, "synth_no_dinf.mp4"),
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    omitDinf: true,
  }),
);

writeFileSync(
  join(dir, "synth_avc3.mp4"),
  buildFixture({
    brand: "avc3",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
  }),
);

writeFileSync(
  join(dir, "synth_fragmented.mp4"),
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    fragmented: true,
  }),
);

writeFileSync(
  join(dir, "synth_id3.mp4"),
  cat(
    ascii("ID3"),
    new Uint8Array([4, 0, 0, 0, 0, 0, 0]), // ID3v2.4 header (10 bytes total), empty tag
    buildFixture({
      brand: "avc1",
      width: 1280,
      height: 720,
      timescale: 60000,
      stts: [{ count: 60, delta: 1000 }],
      frameCount: 60,
      useCo64: false,
      prefixBytes: 10,
    }),
  ),
);

writeFileSync(
  join(dir, "synth_120fps.mp4"),
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 120, delta: 500 }], // 120 fps
    frameCount: 120,
    useCo64: false,
  }),
);

writeFileSync(
  join(dir, "synth_rotation.mp4"),
  buildFixture({
    brand: "avc1",
    width: 720,
    height: 1280,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    rotationDeg: 90,
  }),
);

writeFileSync(
  join(dir, "synth_editlist.mp4"),
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    editList: true,
  }),
);

writeFileSync(
  join(dir, "synth_qt.mp4"),
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    majorBrand: "qt  ",
  }),
);

// --- negative fixtures (must fail deterministically) ------------------------

mkdirSync(join(dir, "negative"), { recursive: true });
const neg = (name: string, bytes: Uint8Array) => writeFileSync(join(dir, "negative", name), bytes);

neg(
  "audio_only.mp4",
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 44100,
    stts: [{ count: 60, delta: 1024 }],
    frameCount: 60,
    useCo64: false,
    handler: "soun",
  }),
);

neg(
  "no_moov.mp4",
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    omitMoov: true,
  }),
);

neg(
  "bad_offset.mp4",
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    badOffset: true,
  }),
);

neg(
  "corrupt_size.mp4",
  buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count: 60, delta: 1000 }],
    frameCount: 60,
    useCo64: false,
    corruptSize: true,
  }),
);

console.log("synthetic fixtures written to tests/fixtures");
console.log("negative fixtures written to tests/fixtures/negative");

// --- real-sample fixture (async: reads bbb_720_10s.mp4) ----------------------

/** Byte-scans `moov` for the first `avcC` box and returns its BODY. */
function findAvcCBody(moov: Uint8Array): Uint8Array | null {
  for (let i = 0; i + 8 < moov.length; i++) {
    if (
      moov[i + 4] === 0x61 && // a
      moov[i + 5] === 0x76 && // v
      moov[i + 6] === 0x63 && // c
      moov[i + 7] === 0x43 // C
    ) {
      const size =
        ((moov[i] << 24) | (moov[i + 1] << 16) | (moov[i + 2] << 8) | moov[i + 3]) >>> 0;
      if (size >= 12 && size < 1024 && i + size <= moov.length) {
        return moov.slice(i + 8, i + size);
      }
    }
  }
  return null;
}

async function buildReal60Fixture(): Promise<Uint8Array> {
  const bbbPath = join(dir, "bbb_720_10s.mp4");
  const bbbBytes = new Uint8Array(readFileSync(bbbPath));
  const bbb = new File([bbbBytes], "bbb_720_10s.mp4");
  const { bytes: moov, headerSize } = await loadMoov(bbb);
  const local: BoxRef = {
    type: "moov",
    start: 0,
    size: moov.length,
    headerSize,
    end: moov.length,
  };
  const track = findTrackByHandler(moov, local, "vide");
  if (!track) throw new Error("bbb fixture has no video track");
  const stbl = findBoxPath(moov, ["mdia", "minf", "stbl"], track.start, track.end);
  if (!stbl) throw new Error("bbb fixture has no stbl");
  const stssRef = findBox(moov, "stss", stbl.start, stbl.end);
  const syncs = stssRef ? parseStss(moov, stssRef) : [];
  const firstKey0 = syncs.length > 0 ? syncs[0] - 1 : 0;

  const count = 64;
  const refs = await sampleTable(bbb, "vide");
  if (firstKey0 + count > refs.length) {
    throw new Error(`bbb fixture too short for ${count} samples from key ${firstKey0}`);
  }
  const indices = Array.from({ length: count }, (_, i) => firstKey0 + i);
  const realSamples = await readSamples(bbb, refs, indices);

  const avcCBody = findAvcCBody(moov);
  if (!avcCBody) throw new Error("bbb fixture has no avcC box");

  // Sync samples inside the window, relabeled to 1-based positions in the
  // new file (samples before firstKey0 are dropped).
  const stssSyncs = (syncs.length > 0 ? syncs : [firstKey0 + 1])
    .filter((n) => n >= firstKey0 + 1 && n <= firstKey0 + count)
    .map((n) => n - firstKey0);

  return buildFixture({
    brand: "avc1",
    width: 1280,
    height: 720,
    timescale: 60000,
    stts: [{ count, delta: 1000 }], // 60 fps
    frameCount: count,
    useCo64: false,
    realSamples,
    avcCBody,
    stssSyncs,
  });
}

void (async () => {
  const real60 = await buildReal60Fixture();
  writeFileSync(join(dir, "synth_real60.mp4"), real60);
  console.log(
    `real-sample fixture written to tests/fixtures/synth_real60.mp4 (${real60.length} bytes)`,
  );
})().catch((err) => {
  console.error("synth_real60.mp4 generation failed:", err);
  process.exitCode = 1;
});
