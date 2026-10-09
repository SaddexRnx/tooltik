/**
 * Sample-table extraction for the validation gates.
 *
 * Walks the native parser's view of a track (stbl → stsz/stsc/stco|co64)
 * and expands it into absolute (offset, size) pairs for every sample.
 * Pure arithmetic over the moov tables: no media bytes are read here.
 */

import {
  type BoxRef,
  PatchError,
  findBox,
  findBoxPath,
  findTrackByHandler,
  parseChunkOffsets,
  parseStsc,
  parseStsz,
} from "@/lib/mp4/boxes";
import { scanTopLevel } from "@/lib/mp4/inspect";

export interface SampleRef {
  offset: number;
  size: number;
}

/** Reads just the top-level `moov` box of a file. */
export async function loadMoov(file: Blob): Promise<{
  bytes: Uint8Array;
  headerSize: number;
}> {
  const top = await scanTopLevel(file as File);
  const moov = top.find((b) => b.type === "moov");
  if (!moov) throw new PatchError("no-moov");
  const bytes = new Uint8Array(await file.slice(moov.start, moov.end).arrayBuffer());
  return { bytes, headerSize: moov.headerSize };
}

/**
 * Expands one track's sample table into absolute file offsets.
 * Throws `PatchError("corrupt")` when the tables disagree on sample counts.
 * Returns an empty array when the track does not exist.
 */
export function sampleTableFromMoov(
  moov: Uint8Array,
  moovHeaderSize: number,
  handler: "vide" | "soun",
): SampleRef[] {
  const local: BoxRef = {
    type: "moov",
    start: 0,
    size: moov.length,
    headerSize: moovHeaderSize,
    end: moov.length,
  };
  const track = findTrackByHandler(moov, local, handler);
  if (!track) return [];
  const stbl = findBoxPath(moov, ["mdia", "minf", "stbl"], track.start, track.end);
  if (!stbl) throw new PatchError("unsupported-boxes");
  const stszRef = findBox(moov, "stsz", stbl.start, stbl.end);
  const stscRef = findBox(moov, "stsc", stbl.start, stbl.end);
  if (!stszRef || !stscRef) throw new PatchError("unsupported-boxes");

  const sizes = parseStsz(moov, stszRef);
  const chunks = parseChunkOffsets(moov, stbl);
  const stsc = parseStsc(moov, stscRef);
  if (sizes.length === 0) return [];
  if (chunks.length === 0) throw new PatchError("corrupt");

  const out: SampleRef[] = [];
  let entry = 0;
  for (let c = 0; c < chunks.length; c++) {
    const chunkNo = c + 1;
    while (entry + 1 < stsc.length && stsc[entry + 1].firstChunk <= chunkNo) entry++;
    const perChunk =
      stsc[entry] && stsc[entry].firstChunk <= chunkNo ? stsc[entry].samplesPerChunk : 1;
    let off = chunks[c];
    for (let s = 0; s < perChunk && out.length < sizes.length; s++) {
      out.push({ offset: off, size: sizes[out.length] });
      off += sizes[out.length - 1];
    }
  }
  if (out.length !== sizes.length) {
    throw new PatchError("corrupt");
  }
  return out;
}

/** Convenience: moov lookup + expansion for a whole file. */
export async function sampleTable(
  file: Blob,
  handler: "vide" | "soun",
): Promise<SampleRef[]> {
  const { bytes, headerSize } = await loadMoov(file);
  return sampleTableFromMoov(bytes, headerSize, handler);
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Reads several samples, coalescing contiguous file ranges into one slice. */
export async function readSamples(
  file: Blob,
  refs: SampleRef[],
  indices: number[],
): Promise<Uint8Array[]> {
  const sorted = [...indices].sort((x, y) => x - y);
  const cache = new Map<number, Uint8Array>();
  let runStart = 0;
  while (runStart < sorted.length) {
    let runEnd = runStart + 1;
    const first = refs[sorted[runStart]];
    let expected = first.offset + first.size;
    while (
      runEnd < sorted.length &&
      refs[sorted[runEnd]].offset === expected &&
      expected - first.offset < 8 * 1024 * 1024
    ) {
      expected += refs[sorted[runEnd]].size;
      runEnd++;
    }
    const slice = new Uint8Array(
      await file.slice(first.offset, expected).arrayBuffer(),
    );
    for (let k = runStart; k < runEnd; k++) {
      const ref = refs[sorted[k]];
      const start = ref.offset - first.offset;
      cache.set(sorted[k], slice.subarray(start, start + ref.size));
    }
    runStart = runEnd;
  }
  return indices.map((i) => {
    const hit = cache.get(i);
    if (!hit) throw new PatchError("corrupt");
    return hit;
  });
}
