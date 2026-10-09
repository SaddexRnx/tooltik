/**
 * MP4 / ISOBMFF box parser.
 *
 * Pure, dependency-free parser used both for fast inspection (reading only the
 * `moov` metadata box of a file) and inside the patching pipeline.
 *
 * Ported from the Python parser of github.com/BastienGimbert/tiktok-quality
 * (MIT) and hardened for the browser: 64-bit box sizes, `size == 0` boxes,
 * corrupt-input tolerance and co64 (64-bit chunk offset) support.
 */

/** A located box inside a byte buffer. All offsets are relative to that buffer. */
export interface BoxRef {
  /** Four-character box type, e.g. "moov". */
  type: string;
  /** Offset of the box header inside the buffer. */
  start: number;
  /** Total box size in bytes, including the header. */
  size: number;
  /** Header length: 8 bytes normally, 16 for 64-bit "large size". */
  headerSize: number;
  /** Offset just past the box (`start + size`). */
  end: number;
}

export function readU32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) >>> 0) +
    (buf[offset + 1] << 16) +
    (buf[offset + 2] << 8) +
    buf[offset + 3]
  );
}

export function readU16(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1];
}

/** Reads a 64-bit unsigned big-endian integer. Precise up to 2^53 (plenty for files). */
export function readU64(buf: Uint8Array, offset: number): number {
  const hi = readU32(buf, offset);
  const lo = readU32(buf, offset + 4);
  return hi * 0x1_0000_0000 + lo;
}

export function readFourCC(buf: Uint8Array, offset: number): string {
  return String.fromCharCode(
    buf[offset],
    buf[offset + 1],
    buf[offset + 2],
    buf[offset + 3],
  );
}

/** True when the 4 bytes at `offset` equal `ascii`. Faster than readFourCC for comparisons. */
export function fourCCIs(buf: Uint8Array, offset: number, cc: string): boolean {
  return (
    buf[offset] === cc.charCodeAt(0) &&
    buf[offset + 1] === cc.charCodeAt(1) &&
    buf[offset + 2] === cc.charCodeAt(2) &&
    buf[offset + 3] === cc.charCodeAt(3)
  );
}

interface HeaderInfo {
  size: number;
  headerSize: number;
  type: string;
}

/**
 * Reads a box header at `pos`, bounded by `limit`.
 * Handles: normal 32-bit size, `size == 1` (64-bit large size) and
 * `size == 0` (box extends to the end of the enclosing range).
 * Returns null when the header is missing or obviously corrupt.
 */
function boxHeaderAt(
  buf: Uint8Array,
  pos: number,
  limit: number,
): HeaderInfo | null {
  if (pos < 0 || pos + 8 > limit) return null;
  const size32 = readU32(buf, pos);
  const type = readFourCC(buf, pos + 4);
  if (size32 === 1) {
    if (pos + 16 > limit) return null;
    const size = readU64(buf, pos + 8);
    if (size < 16 || pos + size > limit) return null;
    return { size, headerSize: 16, type };
  }
  if (size32 === 0) {
    // Box runs to the end of the enclosing range.
    const size = limit - pos;
    if (size < 8) return null;
    return { size, headerSize: 8, type };
  }
  if (size32 < 8 || pos + size32 > limit) return null;
  return { size: size32, headerSize: 8, type };
}

/** Iterates boxes in `[start, end)` at the current nesting level. */
export function* iterBoxes(
  buf: Uint8Array,
  start = 0,
  end: number = buf.length,
): Generator<BoxRef> {
  let pos = start;
  while (pos + 8 <= end) {
    const info = boxHeaderAt(buf, pos, end);
    if (!info) return;
    yield {
      type: info.type,
      start: pos,
      size: info.size,
      headerSize: info.headerSize,
      end: pos + info.size,
    };
    pos += info.size;
  }
}

/**
 * Finds the first box of `type` at the current level, or null.
 *
 * Convenience semantics: when `start`/`end` describe a container box's own
 * range (i.e. the box at `start` spans exactly `end`), the search happens
 * among that container's *children* - so `findBox(buf, "stts", stbl.start,
 * stbl.end)` means "find stts inside stbl", which is what callers always
 * intend.
 */
export function findBox(
  buf: Uint8Array,
  type: string,
  start = 0,
  end: number = buf.length,
): BoxRef | null {
  let s = start;
  if (s + 8 <= end) {
    const hdr = boxHeaderAt(buf, s, end);
    if (hdr && hdr.type !== type && s + hdr.size === end) {
      s += hdr.headerSize; // descend into the container
    }
  }
  for (const box of iterBoxes(buf, s, end)) {
    if (box.type === type) return box;
  }
  return null;
}

/**
 * Navigates nested container boxes, e.g.
 * `findBoxPath(buf, ["mdia", "minf", "stbl"], track.start, track.end)`.
 */
export function findBoxPath(
  buf: Uint8Array,
  path: string[],
  start = 0,
  end: number = buf.length,
): BoxRef | null {
  let rangeStart = start;
  let rangeEnd = end;
  let found: BoxRef | null = null;
  for (const type of path) {
    found = findBox(buf, type, rangeStart, rangeEnd);
    if (!found) return null;
    rangeStart = found.start + found.headerSize;
    rangeEnd = found.end;
  }
  return found;
}

/** Finds a track (`trak`) by its handler type: "vide" or "soun". */
export function findTrackByHandler(
  buf: Uint8Array,
  moov: BoxRef,
  handler: string,
): BoxRef | null {
  for (const box of iterBoxes(
    buf,
    moov.start + moov.headerSize,
    moov.end,
  )) {
    if (box.type !== "trak") continue;
    const hdlr = findBoxPath(buf, ["mdia", "hdlr"], box.start, box.end);
    if (!hdlr) continue;
    const handlerAt = hdlr.start + hdlr.headerSize + 8; // version/flags(4) + pre_defined(4)
    if (handlerAt + 4 <= hdlr.end && fourCCIs(buf, handlerAt, handler)) {
      return box;
    }
  }
  return null;
}

/** Version/flags byte of a Full Box. */
export function fullBoxVersion(buf: Uint8Array, ref: BoxRef): number {
  const at = ref.start + ref.headerSize;
  return at < ref.end ? buf[at] : 0;
}

/** Body of a box, excluding its header. */
export function boxContent(buf: Uint8Array, ref: BoxRef): Uint8Array {
  return buf.subarray(ref.start + ref.headerSize, ref.end);
}

// ---------------------------------------------------------------------------
// Sample tables ("stbl" children)
// ---------------------------------------------------------------------------

export interface SttsEntry {
  /** Number of consecutive samples with this delta. */
  count: number;
  /** Duration of each sample in media timescale ticks. */
  delta: number;
}

export interface StscEntry {
  firstChunk: number;
  samplesPerChunk: number;
  descriptionIndex: number;
}

/** Parses `stts` (time-to-sample). */
export function parseStts(buf: Uint8Array, ref: BoxRef): SttsEntry[] {
  const base = ref.start + ref.headerSize;
  const entryCount = readU32(buf, base + 4);
  const entries: SttsEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const at = base + 8 + i * 8;
    if (at + 8 > ref.end) break;
    entries.push({ count: readU32(buf, at), delta: readU32(buf, at + 4) });
  }
  return entries;
}

/** Parses `stsz` (sample sizes). Supports both fixed and per-sample sizes. */
export function parseStsz(buf: Uint8Array, ref: BoxRef): number[] {
  const base = ref.start + ref.headerSize;
  const uniform = readU32(buf, base + 4);
  const count = readU32(buf, base + 8);
  if (uniform !== 0) return new Array<number>(count).fill(uniform);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const at = base + 12 + i * 4;
    if (at + 4 > ref.end) break;
    sizes.push(readU32(buf, at));
  }
  return sizes;
}

/** Returns sample count without materialising the size array (large files). */
export function readStszCount(buf: Uint8Array, ref: BoxRef): number {
  return readU32(buf, ref.start + ref.headerSize + 8);
}

/** Parses `stsc` (sample-to-chunk). */
export function parseStsc(buf: Uint8Array, ref: BoxRef): StscEntry[] {
  const base = ref.start + ref.headerSize;
  const entryCount = readU32(buf, base + 4);
  const entries: StscEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const at = base + 8 + i * 12;
    if (at + 12 > ref.end) break;
    entries.push({
      firstChunk: readU32(buf, at),
      samplesPerChunk: readU32(buf, at + 4),
      descriptionIndex: readU32(buf, at + 8),
    });
  }
  return entries;
}

/** Parses `stss` (sync samples) into 1-based sample numbers. */
export function parseStss(buf: Uint8Array, ref: BoxRef): number[] {
  const base = ref.start + ref.headerSize;
  const entryCount = readU32(buf, base + 4);
  const out: number[] = [];
  for (let i = 0; i < entryCount; i++) {
    const at = base + 8 + i * 4;
    if (at + 4 > ref.end) break;
    out.push(readU32(buf, at));
  }
  return out;
}

export interface CttsEntry {
  count: number;
  offset: number;
}

/** Parses `ctts` (composition offsets). Version 1 offsets are signed. */
export function parseCtts(buf: Uint8Array, ref: BoxRef): { version: number; entries: CttsEntry[] } {
  const base = ref.start + ref.headerSize;
  const version = buf[base];
  const entryCount = readU32(buf, base + 4);
  const entries: CttsEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const at = base + 8 + i * 8;
    if (at + 8 > ref.end) break;
    let offset = readU32(buf, at + 4);
    if (version === 1 && offset >= 0x8000_0000) offset -= 0x1_0000_0000;
    entries.push({ count: readU32(buf, at), offset });
  }
  return { version, entries };
}

/** Parses `stco` (32-bit chunk offsets). Values are absolute file offsets. */
export function parseStco(buf: Uint8Array, ref: BoxRef): number[] {
  const base = ref.start + ref.headerSize;
  const entryCount = readU32(buf, base + 4);
  const offsets: number[] = [];
  for (let i = 0; i < entryCount; i++) {
    const at = base + 8 + i * 4;
    if (at + 4 > ref.end) break;
    offsets.push(readU32(buf, at));
  }
  return offsets;
}

/** Parses `co64` (64-bit chunk offsets). */
export function parseCo64(buf: Uint8Array, ref: BoxRef): number[] {
  const base = ref.start + ref.headerSize;
  const entryCount = readU32(buf, base + 4);
  const offsets: number[] = [];
  for (let i = 0; i < entryCount; i++) {
    const at = base + 8 + i * 8;
    if (at + 8 > ref.end) break;
    offsets.push(readU64(buf, at));
  }
  return offsets;
}

/**
 * Returns chunk offsets for a sample table, transparently handling `stco`
 * and `co64`. Throws if the box is missing or offsets exceed 32-bit range
 * (our output always uses `stco`, which cannot address >4 GiB files).
 */
export function parseChunkOffsets(buf: Uint8Array, stbl: BoxRef): number[] {
  const stco = findBox(buf, "stco", stbl.start, stbl.end);
  if (stco) return parseStco(buf, stco);
  const co64 = findBox(buf, "co64", stbl.start, stbl.end);
  if (co64) {
    const offsets = parseCo64(buf, co64);
    if (offsets.some((o) => o > 0xffff_ffff)) {
      throw new PatchError("too-large");
    }
    return offsets;
  }
  throw new PatchError("unsupported-boxes");
}

// ---------------------------------------------------------------------------
// NAL units (AVC samples, 4-byte length prefixed)
// ---------------------------------------------------------------------------

export interface NaluRef {
  /** AVC NAL type: 1 = non-IDR slice, 5 = IDR slice, 6 = SEI, ... */
  type: number;
  /** Offset of the length prefix inside the sample buffer. */
  start: number;
  /** Offset just past the NAL unit (length prefix included). */
  end: number;
}

/**
 * Splits an AVC sample into length-prefixed NAL units.
 * Stops early on malformed lengths instead of throwing.
 */
export function parseNaluList(sample: Uint8Array): NaluRef[] {
  const nalus: NaluRef[] = [];
  let pos = 0;
  while (pos + 4 <= sample.length) {
    const len = readU32(sample, pos);
    if (len === 0 || pos + 4 + len > sample.length) break;
    nalus.push({
      type: sample[pos + 4] & 0x1f,
      start: pos,
      end: pos + 4 + len,
    });
    pos += 4 + len;
  }
  return nalus;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type PatchErrorCode =
  | "not-video"
  | "no-moov"
  | "no-mdat"
  | "no-video"
  | "unsupported-codec"
  | "unsupported-boxes"
  | "fragmented"
  | "too-large"
  | "corrupt"
  | "reencode-unavailable"
  | "reencode-failed"
  | "timescale-indivisible"
  | "already-has-edit-list"
  | "unknown";

/** Error carrying a stable code so the UI can translate it. */
export class PatchError extends Error {
  readonly code: PatchErrorCode;

  constructor(code: PatchErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PatchError";
    this.code = code;
  }
}

export function asPatchError(err: unknown): PatchError {
  if (err instanceof PatchError) return err;
  return new PatchError(
    "unknown",
    err instanceof Error ? err.message : String(err),
  );
}
