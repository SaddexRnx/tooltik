"use client";

/**
 * Orchestrates the whole patching flow:
 * idle -> inspecting -> ready -> patching -> validating -> done
 * (or error at any step), plus the multi-method comparison branch
 * ready -> comparing -> comparison -> done (method selected).
 *
 * All work runs client-side via `lib/mp4/*`; this hook owns lifecycle,
 * progress reporting, object-URL management and error codes. The download
 * is gated on BOTH source-integrity (SHA-256) and every validation gate
 * (structure, payload, decoded frames, audio) - any failure disables it,
 * without exception.
 */

import * as React from "react";
import {
  type MediaContext,
  type MediaInfo,
  inspectMedia,
} from "@/lib/mp4/inspect";
import { type QualityReport, buildQualityReport } from "@/lib/mp4/quality";
import type { PatchProgress, PatchStats } from "@/lib/mp4/transform";
import { isFragmentedFile, remuxFragmented } from "@/lib/mp4/fragment";
import { asPatchError, type PatchErrorCode } from "@/lib/mp4/boxes";
import { sha256File } from "@/lib/integrity/sha256";
import { patchedFileName } from "@/lib/format";
import { DEFAULT_ENGINE_ID, getEngine } from "@/lib/engines/registry";
import {
  type EngineEligibility,
  computeEligibility,
} from "@/lib/methods/eligibility";
import {
  type MethodRunResult,
  type MethodRunStage,
  runAllMethods,
} from "@/lib/methods/runner";
import { type StructureReport, validateStructure } from "@/lib/validate/structure";
import {
  type DecodeRunResult,
  decodeRun,
  emptyContent,
  webCodecsAvailable,
} from "@/lib/validate/decode";
import { type GateId, type ValidationReport, runValidation } from "@/lib/validate/gates";
import type { ComparisonRowReport } from "@/lib/reports/build-report";

export type PatcherPhase =
  | "idle"
  | "inspecting"
  | "ready"
  | "patching"
  | "validating"
  | "comparing"
  | "comparison"
  | "done"
  | "error";

export interface PatcherResult {
  blob: Blob;
  url: string;
  fileName: string;
  stats: PatchStats;
  /** Size of the file the user originally picked. */
  sourceSize: number;
  /** SHA-256 (hex) of the source file, recorded when it was picked. */
  sourceHash: string | null;
  /**
   * Pre-download integrity gate: the source is re-hashed after preparation
   * and compared against `sourceHash`. Anything but "verified" disables
   * the download link, without exception.
   */
  integrity: "verified" | "failed" | "unverified";
  /**
   * Three-gate validation evidence (structure / payload / decoded frames)
   * plus the audio gate. `validation.pass === false` disables the download,
   * without exception.
   */
  validation: ValidationReport;
  /** The engine (or its flatten option) declared a decoded-timing change. */
  timingChanged: boolean;
  /** Options the run was started with (recorded in the JSON report). */
  runOptions: { scrubMetadata: boolean; flattenFrameTiming: boolean };
  /** True when a fragmented source was normalized before this run. */
  normalizedFromFragmented: boolean;
  /**
   * JSON-safe comparison rows, present only when this result was promoted
   * from a comparison run (recorded in the JSON report).
   */
  comparison?: ComparisonRowReport[];
}

/** User-tunable prepare options (see the toggles on the info card). */
export interface PatchRunOptions {
  scrubMetadata?: boolean;
  flattenFrameTiming?: boolean;
}

const ACCEPTED_EXTENSIONS = [".mp4", ".mov", ".m4v", ".qt"];
const ACCEPTED_MIME = ["video/mp4", "video/quicktime", "video/x-m4v", "video/mov"];

/** Reduces a comparison run to the JSON-safe row stored on the result. */
function comparisonRow(run: MethodRunResult): ComparisonRowReport {
  return {
    engineId: run.engineId,
    engineName: run.engineName,
    status: run.status,
    reason: run.reason,
    error: run.error,
    patchMs: run.patchMs,
    validationPass: run.validation ? run.validation.pass : null,
    timingChanged: run.timingChanged,
  };
}

export function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  if (file.type && ACCEPTED_MIME.includes(file.type.toLowerCase())) return true;
  // Fall back to content sniffing for mislabelled files: read the first bytes.
  return false;
}

/** Sniffs the ftyp box so files with odd extensions still work. */
export async function looksLikeMp4(file: File): Promise<boolean> {
  try {
    const probe = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (probe.length < 8) return false;
    let offset = 0;
    // Downloads may carry an ID3v2 tag in front of the first box.
    if (
      probe.length >= 10 &&
      probe[0] === 0x49 && probe[1] === 0x44 && probe[2] === 0x33 && // "ID3"
      (probe[6] & 0x80) === 0 && (probe[7] & 0x80) === 0 &&
      (probe[8] & 0x80) === 0 && (probe[9] & 0x80) === 0
    ) {
      offset =
        10 +
        (((probe[6] & 0x7f) << 21) |
          ((probe[7] & 0x7f) << 14) |
          ((probe[8] & 0x7f) << 7) |
          (probe[9] & 0x7f));
      if (offset >= file.size) return false;
      const head = new Uint8Array(await file.slice(offset, offset + 12).arrayBuffer());
      if (head.length < 8) return false;
      return String.fromCharCode(head[4], head[5], head[6], head[7]) === "ftyp";
    }
    const cc = String.fromCharCode(probe[4], probe[5], probe[6], probe[7]);
    return cc === "ftyp";
  } catch {
    return false;
  }
}

export function usePatcher() {
  const [phase, setPhase] = React.useState<PatcherPhase>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [info, setInfo] = React.useState<MediaInfo | null>(null);
  const [report, setReport] = React.useState<QualityReport | null>(null);
  const [progress, setProgress] = React.useState<PatchProgress>({
    stage: "validate",
    percent: 0,
  });
  const [result, setResult] = React.useState<PatcherResult | null>(null);
  const [errorCode, setErrorCode] = React.useState<PatchErrorCode | null>(null);
  // Analysis-stage forensic baseline (spec: source baseline before patching).
  const [baseline, setBaseline] = React.useState<DecodeRunResult | null>(null);
  const [inputStructure, setInputStructure] = React.useState<StructureReport | null>(null);
  // Validation evidence of the produced output.
  const [validation, setValidation] = React.useState<ValidationReport | null>(null);
  const [validationStage, setValidationStage] = React.useState<GateId | "done" | null>(null);
  const [engineId, setEngineId] = React.useState<string>(DEFAULT_ENGINE_ID);
  // Per-file method eligibility (computed once per inspected file).
  const [eligibility, setEligibility] = React.useState<EngineEligibility[]>([]);
  // Multi-method comparison state.
  const [methodRuns, setMethodRuns] = React.useState<MethodRunResult[] | null>(null);
  const [methodStage, setMethodStage] = React.useState<Record<string, MethodRunStage>>({});
  // True while a fragmented source was normalized before inspection.
  const [normalizedFromFragmented, setNormalizedFromFragmented] = React.useState(false);

  const contextRef = React.useRef<MediaContext | null>(null);
  const infoRef = React.useRef<MediaInfo | null>(null);
  const resultUrlRef = React.useRef<string | null>(null);
  const busyRef = React.useRef(false);
  // Layer 0 source identity: the original picked File plus its SHA-256.
  const fileRef = React.useRef<File | null>(null);
  const sourceHashRef = React.useRef<string | null>(null);
  // Cooperative cancellation for the comparison runner (checked between
  // stages; an in-flight decode always completes before the stop takes effect).
  const cancelRef = React.useRef(false);
  // Options of the last comparison run (used when promoting a row, since
  // per-row option recording would duplicate state for identical options).
  const runOptionsRef = React.useRef<{
    scrubMetadata: boolean;
    flattenFrameTiming: boolean;
  }>({ scrubMetadata: false, flattenFrameTiming: false });

  const revokeResult = React.useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
  }, []);

  const reset = React.useCallback(() => {
    revokeResult();
    busyRef.current = false;
    cancelRef.current = false;
    contextRef.current = null;
    infoRef.current = null;
    fileRef.current = null;
    sourceHashRef.current = null;
    setPhase("idle");
    setFile(null);
    setInfo(null);
    setReport(null);
    setResult(null);
    setErrorCode(null);
    setBaseline(null);
    setInputStructure(null);
    setValidation(null);
    setValidationStage(null);
    setEligibility([]);
    setMethodRuns(null);
    setMethodStage({});
    setNormalizedFromFragmented(false);
    setProgress({ stage: "validate", percent: 0 });
  }, [revokeResult]);

  const selectFile = React.useCallback(
    async (next: File) => {
      if (busyRef.current) return;
      busyRef.current = true;
      revokeResult();
      setErrorCode(null);
      setResult(null);
      setFile(next);
      fileRef.current = next;
      sourceHashRef.current = null;
      setPhase("inspecting");
      setInfo(null);
      setReport(null);
      setBaseline(null);
      setInputStructure(null);
      setValidation(null);
      setValidationStage(null);
      setEligibility([]);
      setMethodRuns(null);
      setMethodStage({});
      setNormalizedFromFragmented(false);
      try {
        if (!(isAcceptedFile(next) || (await looksLikeMp4(next)))) {
          setPhase("error");
          setErrorCode("not-video");
          return;
        }
        // Record the source identity first so hashing overlaps inspection.
        const hashPromise = sha256File(next).catch(() => null);
        // Streamed recordings keep their samples in fragments: rebuild one
        // progressive file first so inspection/patching see regular tables.
        const wasFragmented = await isFragmentedFile(next);
        const source = wasFragmented ? await remuxFragmented(next) : next;
        setNormalizedFromFragmented(wasFragmented);
        const { info: mediaInfo, context } = await inspectMedia(source);
        contextRef.current = context;
        infoRef.current = mediaInfo;
        setInfo(mediaInfo);
        setReport(buildQualityReport(context, mediaInfo));
        setEligibility(computeEligibility(source, mediaInfo));
        // Forensic baseline (spec): independent-parser cross-check of the
        // INPUT plus a real decode run for decoded-FPS/error evidence.
        const [structureReport, decodeBaseline] = await Promise.all([
          validateStructure(source).catch(() => null),
          decodeRun(source, context).catch(
            (err): DecodeRunResult => ({
              available: false,
              mode: "full",
              expectedFrames: 0,
              decodedFrames: 0,
              errors: 1,
              errorDetail: err instanceof Error ? err.message : String(err),
              firstPtsUs: null,
              lastPtsUs: null,
              deltaMinUs: null,
              deltaMaxUs: null,
              deltaDistinct: 0,
              width: 0,
              height: 0,
              format: "",
              content: emptyContent(),
            }),
          ),
        ]);
        setInputStructure(structureReport);
        setBaseline(decodeBaseline);
        // Null (hash failed) blocks the download later: "unverified".
        sourceHashRef.current = await hashPromise;
        setPhase("ready");
      } catch (err) {
        setErrorCode(asPatchError(err).code);
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [revokeResult],
  );

  const patch = React.useCallback(
    async (opts: PatchRunOptions = {}) => {
      const context = contextRef.current;
      if (!context || busyRef.current) return;
      busyRef.current = true;
      setErrorCode(null);
      setValidation(null);
      setValidationStage(null);
      setMethodRuns(null);
      setMethodStage({});
      setPhase("patching");
      setProgress({ stage: "validate", percent: 0 });
      try {
        // The selected engine always starts from the ORIGINAL source.
        // The video stream is never re-encoded: samples are copied as-is so
        // picture quality cannot change. Only headers/timing are rewritten.
        const engine = getEngine(engineId);
        const source = context.file;
        const sourceSize = source.size;
        const { blob, stats } = await engine.process(source, {
          onProgress: setProgress,
          scrubMetadata: opts.scrubMetadata,
          flattenFrameTiming: opts.flattenFrameTiming,
        });
        const outFile = new File([blob], patchedFileName(source.name), {
          type: "video/mp4",
        });

        // Three or four gates (structure, payload, decoded frames, audio):
        // all mandatory, any failure disables the download.
        setPhase("validating");
        const validationReport = await runValidation(source, outFile, {
          onStage: setValidationStage,
          runDecode: webCodecsAvailable(),
          timingMayChange: engine.timingMayChange(opts),
        });
        setValidation(validationReport);

        revokeResult();
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        // Integrity gate: re-hash the source and compare. A mismatch or an
        // unavailable hash disables the download without exception.
        const expected = sourceHashRef.current;
        const original = fileRef.current;
        let integrity: PatcherResult["integrity"] = "unverified";
        if (expected && original) {
          const actual = await sha256File(original).catch(() => null);
          integrity = actual === expected ? "verified" : "failed";
        }
        setResult({
          blob,
          url,
          fileName: outFile.name,
          stats,
          sourceSize,
          sourceHash: expected,
          integrity,
          validation: validationReport,
          timingChanged: engine.timingMayChange(opts),
          runOptions: {
            scrubMetadata: opts.scrubMetadata === true,
            flattenFrameTiming: opts.flattenFrameTiming === true,
          },
          normalizedFromFragmented,
        });
        setPhase("done");
      } catch (err) {
        setErrorCode(asPatchError(err).code);
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [revokeResult, engineId, normalizedFromFragmented],
  );

  /**
   * Runs EVERY eligible method against the same original file, each with
   * its own independent validation, and shows the comparison table.
   * Cancellable between stages via cancelCompare().
   */
  const compare = React.useCallback(
    async (opts: PatchRunOptions = {}) => {
      const context = contextRef.current;
      const info = infoRef.current;
      if (!context || !info || busyRef.current) return;
      busyRef.current = true;
      cancelRef.current = false;
      runOptionsRef.current = {
        scrubMetadata: opts.scrubMetadata === true,
        flattenFrameTiming: opts.flattenFrameTiming === true,
      };
      setErrorCode(null);
      setResult(null);
      revokeResult();
      setValidation(null);
      setValidationStage(null);
      setMethodRuns(null);
      setMethodStage({});
      setPhase("comparing");
      try {
        const source = context.file;
        const runs = await runAllMethods(source, {
          eligibility: computeEligibility(source, info),
          info,
          runDecode: webCodecsAvailable(),
          scrubMetadata: opts.scrubMetadata,
          flattenFrameTiming: opts.flattenFrameTiming,
          onProgress: ({ engineId: id, stage }) =>
            setMethodStage((prev) => ({ ...prev, [id]: stage })),
          shouldCancel: () => cancelRef.current,
        });
        if (cancelRef.current) {
          setPhase("ready");
          return;
        }
        setMethodRuns(runs);
        setPhase("comparison");
      } catch (err) {
        setErrorCode(asPatchError(err).code);
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [revokeResult],
  );

  const cancelCompare = React.useCallback(() => {
    cancelRef.current = true;
  }, []);

  /**
   * Promotes one comparison row to THE result: same integrity re-hash and
   * download gating as a single-method run (validation.pass is required
   * for the download; failures are visible but never downloadable).
   */
  const selectMethodRun = React.useCallback(
    async (id: string) => {
      const run = methodRuns?.find((r) => r.engineId === id);
      const context = contextRef.current;
      if (!context || !run || !run.output || !run.validation || busyRef.current) {
        return;
      }
      busyRef.current = true;
      try {
        const source = context.file;
        const outFile = new File([run.output], patchedFileName(source.name), {
          type: "video/mp4",
        });
        revokeResult();
        const url = URL.createObjectURL(run.output);
        resultUrlRef.current = url;
        const expected = sourceHashRef.current;
        const original = fileRef.current;
        let integrity: PatcherResult["integrity"] = "unverified";
        if (expected && original) {
          const actual = await sha256File(original).catch(() => null);
          integrity = actual === expected ? "verified" : "failed";
        }
        setEngineId(run.engineId);
        setValidation(run.validation);
        setResult({
          blob: run.output,
          url,
          fileName: outFile.name,
          stats: run.stats ?? emptyStats(run.output),
          sourceSize: source.size,
          sourceHash: expected,
          integrity,
          validation: run.validation,
          timingChanged: run.timingChanged,
          runOptions: { ...runOptionsRef.current },
          normalizedFromFragmented,
          comparison: methodRuns ? methodRuns.map(comparisonRow) : undefined,
        });
        setPhase("done");
      } catch (err) {
        setErrorCode(asPatchError(err).code);
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [methodRuns, revokeResult, normalizedFromFragmented],
  );

  // Revoke any lingering object URL on unmount.
  React.useEffect(() => revokeResult, [revokeResult]);

  return {
    phase,
    file,
    info,
    report,
    progress,
    result,
    errorCode,
    baseline,
    inputStructure,
    validation,
    validationStage,
    engineId,
    setEngineId,
    eligibility,
    normalizedFromFragmented,
    methodRuns,
    methodStage,
    selectFile,
    patch,
    compare,
    cancelCompare,
    selectMethodRun,
    reset,
    /** True while a file is being read, patched, validated or compared. */
    busy:
      phase === "inspecting" ||
      phase === "patching" ||
      phase === "validating" ||
      phase === "comparing",
  };
}

/** Fallback stats when a comparison row somehow lacks them (never null). */
function emptyStats(blob: Blob): PatchStats {
  return {
    inputSize: blob.size,
    outputSize: blob.size,
    sizeDelta: 0,
    originalFrames: 0,
    declaredFrames: 0,
    ghostFrames: 0,
    multiplier: 1,
    seiBytesRemoved: 0,
    inputFastStart: true,
    inputBrand: "",
    droppedTracks: 0,
    audioAdjusted: false,
    frameTimingFlattened: false,
    timestampsScrubbed: false,
    videoBitrateBps: null,
    audioBitrateBps: null,
    durationSec: 0,
    comment: "",
  };
}
