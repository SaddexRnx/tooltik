/**
 * Gate 2: media payload preservation.
 *
 * Compares the encoded sample byte sequences (NOT the whole-file hash) of
 * the original and patched files, per track. Any original sample whose
 * bytes changed (or vanished) is a FAIL — a byte-exact remux of untouched
 * media must reproduce every original sample verbatim.
 *
 * Synthetic samples (ghost frames) are allowed and counted separately;
 * they must never be mistaken for preserved originals.
 */

import { PatchError } from "@/lib/mp4/boxes";
import {
  type SampleRef,
  bytesEqual,
  readSamples,
  sampleTable,
} from "@/lib/validate/samples";

export interface PayloadReport {
  /** Track handler this report covers. */
  handler: "vide" | "soun";
  /** True when neither file has this track (nothing to preserve). */
  absent: boolean;
  pass: boolean;
  /** Original samples that exist byte-identical in the output. */
  preserved: number;
  /** Original samples whose bytes are missing or modified in the output. */
  modified: number;
  /** Original samples that could not be located in the output (best-effort). */
  lost: number;
  /** Output samples that are not byte-copies of any original (synthetic). */
  synthetic: number;
  /** First few indices of modified originals (capped at 16). */
  modifiedIndices: number[];
  /** How the mapping was established. */
  strategy: "direct" | "greedy" | "absent" | "error";
  /** Populated when table extraction failed. */
  error?: string;
  /** Human-readable one-line result for reports. */
  line: string;
}

const MAX_REPORTED_INDICES = 16;

function emptyReport(handler: "vide" | "soun"): PayloadReport {
  return {
    handler,
    absent: false,
    pass: false,
    preserved: 0,
    modified: 0,
    lost: 0,
    synthetic: 0,
    modifiedIndices: [],
    strategy: "error",
    line: "",
  };
}

function failureLine(r: PayloadReport): string {
  if (r.error) return `Payload check could not run: ${r.error}`;
  if (r.absent) return "Track absent in both files (nothing to preserve).";
  return `Payload preservation: FAIL (modified ${r.modified}, lost ${r.lost} of ${r.preserved + r.modified + r.lost})`;
}

function successLine(r: PayloadReport): string {
  const synth =
    r.synthetic > 0 ? `; ${r.synthetic} synthetic sample(s) added` : "";
  if (r.absent) return "Track absent in both files (nothing to preserve).";
  return (
    `Payload preservation: PASS (${r.preserved} original samples byte-identical` +
    `${synth})`
  );
}

/** Reads all samples of one track in both files and compares them in order. */
async function readBoth(
  original: Blob,
  patched: Blob,
  handler: "vide" | "soun",
): Promise<{ orig: SampleRef[]; out: SampleRef[] }> {
  const orig = await sampleTable(original, handler);
  const out = await sampleTable(patched, handler);
  return { orig, out };
}

/**
 * Direct strategy: output sample i must equal original sample i for every
 * i < N (the ghost-frame transform guarantees this layout). Used first
 * because it is O(N) reads with coalesced ranges.
 */
async function compareDirect(
  original: Blob,
  patched: Blob,
  origTable: SampleRef[],
  outTable: SampleRef[],
  handler: "vide" | "soun",
): Promise<PayloadReport | null> {
  const n = origTable.length;
  const m = outTable.length;
  if (m < n) return null; // impossible under direct layout

  const r = emptyReport(handler);
  r.strategy = "direct";

  const BATCH = 32;
  for (let i = 0; i < n; i += BATCH) {
    const end = Math.min(n, i + BATCH);
    const idx: number[] = [];
    for (let k = i; k < end; k++) idx.push(k);
    const [a, b] = await Promise.all([
      readSamples(original, origTable, idx),
      readSamples(patched, outTable, idx),
    ]);
    for (let k = 0; k < idx.length; k++) {
      if (!bytesEqual(a[k], b[k])) {
        r.modified = 1;
        r.modifiedIndices = [i + k];
        r.lost = 0;
        r.preserved = 0;
        r.synthetic = m - n;
        r.pass = false;
        r.line = failureLine(r);
        return r;
      }
    }
  }
  r.preserved = n;
  r.modified = 0;
  r.lost = 0;
  r.synthetic = m - n;
  r.pass = true;
  r.line = successLine(r);
  return r;
}

/**
 * Greedy fallback: original samples must appear in the output as an
 * increasing subsequence (allows interleaved synthetic content). Bounded
 * scan window so a pathological file fails fast instead of hanging.
 */
async function compareGreedy(
  original: Blob,
  patched: Blob,
  origTable: SampleRef[],
  outTable: SampleRef[],
  handler: "vide" | "soun",
): Promise<PayloadReport> {
  const r = emptyReport(handler);
  r.strategy = "greedy";

  const n = origTable.length;
  const m = outTable.length;
  let j = 0;
  let preserved = 0;
  const modifiedIndices: number[] = [];
  let lost = 0;
  const window = Math.max(64, Math.ceil(n / 4));

  for (let i = 0; i < n; i++) {
    const limit = Math.min(m, j + window);
    let matched = -1;
    let scanned = 0;
    let jj = j;
    while (jj < limit && scanned <= window) {
      const [a, b] = await Promise.all([
        readSamples(original, origTable, [i]),
        readSamples(patched, outTable, [jj]),
      ]);
      if (bytesEqual(a[0], b[0])) {
        matched = jj;
        break;
      }
      jj++;
      scanned++;
    }
    if (matched >= 0) {
      preserved++;
      j = matched + 1;
    } else {
      lost++;
      if (modifiedIndices.length < MAX_REPORTED_INDICES) modifiedIndices.push(i);
    }
  }

  r.preserved = preserved;
  r.lost = lost;
  r.modified = 0; // "modified" only set by the fast path; lost covers both
  r.modifiedIndices = modifiedIndices;
  r.synthetic = m - preserved;
  r.pass = lost === 0 && preserved === n;
  r.line = r.pass ? successLine(r) : failureLine({ ...r, modified: lost });
  if (!r.pass) r.modified = lost;
  return r;
}

/**
 * Full payload comparison for one track. Table extraction errors become
 * `pass:false` with the error attached — validation must fail closed.
 */
export async function comparePayload(
  original: Blob,
  patched: Blob,
  handler: "vide" | "soun",
): Promise<PayloadReport> {
  let origTable: SampleRef[];
  let outTable: SampleRef[];
  try {
    ({ orig: origTable, out: outTable } = await readBoth(original, patched, handler));
  } catch (err) {
    const r = emptyReport(handler);
    r.error = err instanceof PatchError ? err.code : String(err);
    r.line = failureLine(r);
    return r;
  }

  if (origTable.length === 0 && outTable.length === 0) {
    const r = emptyReport(handler);
    r.absent = true;
    r.pass = true;
    r.strategy = "absent";
    r.line = successLine(r);
    return r;
  }
  if (origTable.length === 0 && outTable.length > 0) {
    const r = emptyReport(handler);
    r.error = "track present in output but not in original";
    r.line = failureLine(r);
    return r;
  }

  try {
    const direct = await compareDirect(original, patched, origTable, outTable, handler);
    if (direct) return direct;
    return await compareGreedy(original, patched, origTable, outTable, handler);
  } catch (err) {
    const r = emptyReport(handler);
    r.error = err instanceof PatchError ? err.code : String(err);
    r.line = failureLine(r);
    return r;
  }
}
