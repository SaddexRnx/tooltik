/**
 * MP4 / ISOBMFF box builder.
 *
 * Ported from github.com/BastienGimbert/tiktok-quality (MIT), `mp4/builder.py`.
 * Each builder mirrors the Python implementation byte-for-byte, with extra
 * guards for version-1 boxes and 64-bit durations.
 */

import type { BoxRef } from "./boxes";
import { readU32 } from "./boxes";

/** Concatenates byte parts, computing the exact total length first. */
export function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

export function u32(value: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, value >>> 0, false);
  return b;
}

export function u16(value: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, value & 0xffff, false);
  return b;
}

function ascii(text: string): Uint8Array {
  const b = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) b[i] = text.charCodeAt(i) & 0xff;
  return b;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Builds a standard box: `[size:4][type:4][content]`. */
export function buildBox(type: string, content: Uint8Array): Uint8Array {
  return concat([u32(8 + content.length), ascii(type), content]);
}

/** `ftyp` with the brand layout produced by the reference implementation. */
export function buildFtyp(): Uint8Array {
  return buildBox(
    "ftyp",
    concat([
      ascii("isom"),
      u32(512),
      ascii("isomiso2avc1mp41"),
    ]),
  );
}

/** Minimal 8-byte `free` box (keeps the layout identical to the reference). */
export function buildFree(): Uint8Array {
  return concat([u32(8), ascii("free")]);
}

/**
 * Patches the duration of an `mvhd` box (content without header).
 * v0: duration u32 at 16 · v1: duration u64 at 24.
 */
export function buildMvhd(
  originalContent: Uint8Array,
  duration: number,
): Uint8Array {
  const content = originalContent.slice();
  const dv = new DataView(content.buffer, content.byteOffset);
  if (content[0] === 1) {
    writeU64(dv, 24, duration);
  } else {
    dv.setUint32(16, duration >>> 0, false);
  }
  return buildBox("mvhd", content);
}

/**
 * Patches `mdhd` content (without header).
 * v0: duration at 16, language at 20 · v1: duration at 24, language at 32.
 */
export function buildMdhd(
  originalContent: Uint8Array,
  opts: { duration?: number; language?: number } = {},
): Uint8Array {
  const content = originalContent.slice();
  const dv = new DataView(content.buffer, content.byteOffset);
  const v1 = content[0] === 1;
  if (opts.duration !== undefined) {
    if (v1) writeU64(dv, 24, opts.duration);
    else dv.setUint32(16, opts.duration >>> 0, false);
  }
  if (opts.language !== undefined) {
    dv.setUint16(v1 ? 32 : 20, opts.language & 0xffff, false);
  }
  return buildBox("mdhd", content);
}

/**
 * Patches a `tkhd` box (full box bytes including header).
 * v0: duration u32 at 28 · v1: duration u64 at 36.
 */
export function buildTkhd(
  original: Uint8Array,
  duration: number,
): Uint8Array {
  const out = original.slice();
  const dv = new DataView(out.buffer, out.byteOffset);
  if (out[8] === 1) {
    writeU64(dv, 36, duration);
  } else {
    dv.setUint32(28, duration >>> 0, false);
  }
  return out;
}

function writeU64(dv: DataView, offset: number, value: number): void {
  const hi = Math.floor(value / 0x1_0000_0000);
  const lo = value >>> 0;
  dv.setUint32(offset, hi, false);
  dv.setUint32(offset + 4, lo, false);
}

/**
 * Zeroes the creation/modification time fields of a FullBox such as
 * `mvhd`, `tkhd` or `mdhd` (privacy scrub: no recording dates left).
 * Expects the full box bytes including its header.
 */
export function scrubTimestamps(box: Uint8Array): Uint8Array {
  const out = box.slice();
  if (out.length < 20) return out;
  let header = 8;
  if (readU32(out, 0) === 1) header = 16; // largesize header
  const version = out[header];
  const dv = new DataView(out.buffer, out.byteOffset);
  if (version === 1) {
    writeU64(dv, header + 4, 0);  // creation_time
    writeU64(dv, header + 12, 0); // modification_time
  } else {
    dv.setUint32(header + 4, 0, false);  // creation_time
    dv.setUint32(header + 8, 0, false);  // modification_time
  }
  return out;
}

/** Builds an `hdlr` box with the given handler type and UTF-8 name. */
export function buildHdlr(handlerType: string, name: string): Uint8Array {
  return buildBox(
    "hdlr",
    concat([
      u32(0), // version/flags
      u32(0), // pre_defined
      ascii(handlerType),
      new Uint8Array(12), // reserved
      utf8(name),
      new Uint8Array(1), // null terminator
    ]),
  );
}

export function buildStts(entries: { count: number; delta: number }[]): Uint8Array {
  const parts: Uint8Array[] = [u32(0), u32(entries.length)];
  for (const e of entries) parts.push(u32(e.count), u32(e.delta));
  return buildBox("stts", concat(parts));
}

export function buildStsc(
  entries: { firstChunk: number; samplesPerChunk: number; descriptionIndex: number }[],
): Uint8Array {
  const parts: Uint8Array[] = [u32(0), u32(entries.length)];
  for (const e of entries) {
    parts.push(u32(e.firstChunk), u32(e.samplesPerChunk), u32(e.descriptionIndex));
  }
  return buildBox("stsc", concat(parts));
}

export function buildStsz(sampleSizes: number[]): Uint8Array {
  const parts: Uint8Array[] = [u32(0), u32(0), u32(sampleSizes.length)];
  for (const s of sampleSizes) parts.push(u32(s));
  return buildBox("stsz", concat(parts));
}

export function buildStco(offsets: number[]): Uint8Array {
  const parts: Uint8Array[] = [u32(0), u32(offsets.length)];
  for (const o of offsets) parts.push(u32(o));
  return buildBox("stco", concat(parts));
}

/** Builds `stss` (sync-sample) with 1-based sample numbers. */
export function buildStss(syncSamples: number[]): Uint8Array {
  const parts: Uint8Array[] = [u32(0), u32(syncSamples.length)];
  for (const s of syncSamples) parts.push(u32(s));
  return buildBox("stss", concat(parts));
}

/**
 * Builds `ctts` (composition offsets).
 * version 0 = unsigned offsets, version 1 = signed (negative values).
 */
export function buildCtts(
  entries: { count: number; offset: number }[],
  version: 0 | 1,
): Uint8Array {
  // FullBox header: version is the first byte, flags the next three.
  const header = new Uint8Array([version, 0, 0, 0]);
  const parts: Uint8Array[] = [header, u32(entries.length)];
  for (const e of entries) parts.push(u32(e.count), u32(e.offset));
  return buildBox("ctts", concat(parts));
}

/**
 * Rebuilds a video `stsd` box from the fixed fields of the visual sample
 * entry plus its child boxes (avcC/colr/pasp/btrt/...).
 */
export function buildStsdVideo(
  fixedFields: Uint8Array,
  children: Uint8Array[],
  fourcc = "avc1",
): Uint8Array {
  const entry = buildBox(fourcc, concat([fixedFields, ...children]));
  return buildBox("stsd", concat([u32(0), u32(1), entry]));
}

/** Appends the High-profile extension bytes to an `avcC` box (idempotent). */
export function buildAvcc(originalContent: Uint8Array): Uint8Array {
  const HIGH_EXT = [0xfd, 0xf8, 0xf8, 0x00];
  const alreadyPatched =
    originalContent.length >= 4 &&
    originalContent[originalContent.length - 4] === HIGH_EXT[0] &&
    originalContent[originalContent.length - 3] === HIGH_EXT[1] &&
    originalContent[originalContent.length - 2] === HIGH_EXT[2] &&
    originalContent[originalContent.length - 1] === HIGH_EXT[3];
  const content = alreadyPatched
    ? originalContent
    : concat([originalContent, new Uint8Array(HIGH_EXT)]);
  return buildBox("avcC", content);
}

/** Builds a `btrt` (bitrate) box. */
export function buildBtrt(
  bufferSizeDb: number,
  maxBitrate: number,
  avgBitrate: number,
): Uint8Array {
  return buildBox(
    "btrt",
    concat([u32(bufferSizeDb), u32(maxBitrate), u32(avgBitrate)]),
  );
}

/**
 * Builds `udta > meta > ilst > ©cmt > data` with an iTunes-style comment —
 * the metadata signature used by the reference implementation.
 */
export function buildUdtaComment(comment: string): Uint8Array {
  const metaHdlr = buildBox(
    "hdlr",
    concat([
      u32(0),
      u32(0),
      ascii("mdir"),
      ascii("appl"),
      new Uint8Array(8),
      new Uint8Array(1),
    ]),
  );
  const dataBox = buildBox("data", concat([u32(1), u32(0), utf8(comment)]));
  const cmt = concat([
    u32(8 + dataBox.length),
    ascii("\xa9cmt"),
    dataBox,
  ]);
  const ilst = buildBox("ilst", cmt);
  const meta = buildBox("meta", concat([u32(0), metaHdlr, ilst]));
  return buildBox("udta", meta);
}

/** Reads a 32-bit field of a box at an absolute offset inside `buf`. */
export function u32At(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset);
}

/** True when a box ref points at a known type. */
export function isBox(ref: BoxRef | null, type: string): ref is BoxRef {
  return ref !== null && ref.type === type;
}

/** `vmhd` built from scratch when a quirky muxer omitted it. */
export function buildVmhd(): Uint8Array {
  return buildBox("vmhd", concat([u32(1), u16(0), u16(0), u16(0), u16(0)]));
}

/** `dinf > dref > url ` (self-contained) when the muxer omitted `dinf`. */
export function buildDinf(): Uint8Array {
  const url = buildBox("url ", u32(1));
  const dref = buildBox("dref", concat([u32(0), u32(1), url]));
  return buildBox("dinf", dref);
}

/** `smhd` built from scratch when a quirky muxer omitted it. */
export function buildSmhd(): Uint8Array {
  return buildBox("smhd", concat([u32(0), u16(0), u16(0)]));
}
