/**
 * JSON evidence report (spec: exportable preparation/validation record).
 *
 * Everything written here is measured during this session (gate results
 * with their durations, patch stats, hashes) or copied verbatim from the
 * method's own evidence entry (implementation status, limitations, live
 * test status). Nothing is inferred, rounded, or estimated: unknown stays
 * "unknown", not-performed stays "not-performed".
 *
 * SHA-256 values identify file bytes only. They say nothing about whether
 * any platform accepted or ranked the file (`sha256Scope` states this).
 */

import evidence from "@/data/method-evidence.json";
import { sha256File } from "@/lib/integrity/sha256";
import type { PatchEngine } from "@/lib/engines/registry";
import type { MediaInfo } from "@/lib/mp4/inspect";
import type { PatchStats } from "@/lib/mp4/transform";
import type { ValidationReport } from "@/lib/validate/gates";

export const REPORT_SCHEMA = "toolt-preparation-report/1";

/** One comparison row reduced to JSON-safe fields (no Blobs). */
export interface ComparisonRowReport {
  engineId: string;
  engineName: string;
  status: string;
  reason: string | null;
  error: string | null;
  patchMs: number;
  validationPass: boolean | null;
  timingChanged: boolean;
}

export interface BuildReportInput {
  info: MediaInfo;
  engine: PatchEngine;
  stats: PatchStats;
  validation: ValidationReport;
  sourceHash: string | null;
  sourceSize: number;
  integrity: "verified" | "failed" | "unverified";
  timingChanged: boolean;
  outputBlob: Blob;
  outputFileName: string;
  options: { scrubMetadata: boolean; flattenFrameTiming: boolean };
  normalizedFromFragmented?: boolean;
  comparison?: ComparisonRowReport[];
}

export interface TooltReport {
  schema: typeof REPORT_SCHEMA;
  generatedAt: string;
  source: {
    fileName: string;
    sizeBytes: number;
    sha256: string | null;
    /** SHA-256 scope: source file identity only, not any platform outcome. */
    sha256Scope: "source-file-identity";
    container: string;
    ftypBrand: string;
    fastStart: boolean;
    durationSec: number;
    normalizedFromFragmented: boolean;
    video: {
      codec: string;
      codecLabel: string;
      width: number;
      height: number;
      fps: number;
      frames: number;
      timescale: number;
      durationTicks: number;
      hasEditList: boolean;
      rotationDeg: number;
    };
    audio: {
      codec: string;
      codecLabel: string;
      sampleRate: number;
      channels: number;
    } | null;
  };
  method: {
    id: string;
    name: string;
    description: string;
    classification: {
      containerOnly: boolean;
      reencodesVideo: boolean;
      reencodesAudio: boolean;
      changesVideoSamples: boolean;
      changesAudioSamples: boolean;
      changesTiming: boolean;
      changesMetadata: boolean;
      experimental: boolean;
      localVerified: boolean;
      liveTikTokVerified: boolean;
    };
    options: {
      scrubMetadata: boolean;
      flattenFrameTiming: boolean;
    };
    /** Copied from data/method-evidence.json (verbatim). */
    evidence: {
      implementationStatus: string;
      sourceVersion: string;
      license: string;
      supportedContainers: readonly string[];
      supportedCodecs: readonly string[];
      supportedFPS: string | number[];
      knownLimitations: readonly string[];
      knownTikTokEvidence: string;
      localTestStatus: string;
      liveTestStatus: string;
    } | null;
  };
  patch: PatchStats;
  output: {
    fileName: string;
    sizeBytes: number;
    sha256: string;
    sha256Scope: "output-file-identity";
  };
  /** Pre-download integrity gate result for the source re-hash. */
  sourceIntegrity: "verified" | "failed" | "unverified";
  /** Engine declared a decoded-timing change (Gate 3 paired by order). */
  timingChanged: boolean;
  validation: {
    pass: boolean;
    totalMs: number;
    gates: ValidationReport["gates"];
    structure: ValidationReport["structure"];
    payload: ValidationReport["payload"];
    audio: ValidationReport["audio"];
    decoded: ValidationReport["decoded"];
  };
  comparison?: ComparisonRowReport[];
}

export async function buildReport(
  input: BuildReportInput,
): Promise<TooltReport> {
  const outputSha256 = await sha256File(input.outputBlob);
  const method = evidence.methods.find((m) => m.id === input.engine.id);
  const { info } = input;

  return {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: {
      fileName: info.fileName,
      sizeBytes: input.sourceSize,
      sha256: input.sourceHash,
      sha256Scope: "source-file-identity",
      container: info.isQuickTime ? "mov" : "mp4",
      ftypBrand: info.ftypBrand,
      fastStart: info.fastStart,
      durationSec: info.durationSec,
      normalizedFromFragmented: input.normalizedFromFragmented ?? false,
      video: {
        codec: info.video.codecId,
        codecLabel: info.video.codecLabel,
        width: info.video.width,
        height: info.video.height,
        fps: info.video.fps,
        frames: info.video.frames,
        timescale: info.video.timescale,
        durationTicks: info.video.durationTicks,
        hasEditList: info.video.hasEditList,
        rotationDeg: info.video.rotationDeg,
      },
      audio: info.audio
        ? {
            codec: info.audio.codecId,
            codecLabel: info.audio.codecLabel,
            sampleRate: info.audio.sampleRate,
            channels: info.audio.channels,
          }
        : null,
    },
    method: {
      id: input.engine.id,
      name: input.engine.name,
      description: input.engine.description,
      classification: {
        containerOnly: input.engine.containerOnly,
        reencodesVideo: input.engine.reencodesVideo,
        reencodesAudio: input.engine.reencodesAudio,
        changesVideoSamples: input.engine.changesVideoSamples,
        changesAudioSamples: input.engine.changesAudioSamples,
        changesTiming: input.engine.changesTiming,
        changesMetadata: input.engine.changesMetadata,
        experimental: input.engine.experimental,
        localVerified: input.engine.localVerified,
        liveTikTokVerified: input.engine.liveTikTokVerified,
      },
      options: {
        scrubMetadata: input.options.scrubMetadata,
        flattenFrameTiming: input.options.flattenFrameTiming,
      },
      evidence: method
        ? {
            implementationStatus: method.implementationStatus,
            sourceVersion: method.sourceVersion,
            license: method.license,
            supportedContainers: method.supportedContainers,
            supportedCodecs: method.supportedCodecs,
            supportedFPS: method.supportedFPS,
            knownLimitations: method.knownLimitations,
            knownTikTokEvidence: method.knownTikTokEvidence,
            localTestStatus: method.localTestStatus,
            liveTestStatus: method.liveTestStatus,
          }
        : null,
    },
    patch: input.stats,
    output: {
      fileName: input.outputFileName,
      sizeBytes: input.stats.outputSize,
      sha256: outputSha256,
      sha256Scope: "output-file-identity",
    },
    sourceIntegrity: input.integrity,
    timingChanged: input.timingChanged,
    validation: {
      pass: input.validation.pass,
      totalMs: input.validation.totalMs,
      gates: input.validation.gates,
      structure: input.validation.structure,
      payload: input.validation.payload,
      audio: input.validation.audio,
      decoded: input.validation.decoded,
    },
    ...(input.comparison && input.comparison.length > 0
      ? { comparison: input.comparison }
      : {}),
  };
}

/** Serializes the report to pretty JSON with a trailing newline. */
export function serializeReport(report: TooltReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
