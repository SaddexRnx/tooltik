/**
 * Patch engine registry (spec: one interface per method, each starting
 * from the ORIGINAL input â€” never chaining A -> B -> C).
 *
 * Every engine here is container-only: re-encoding engines are banned by
 * product rule (evidence: data/method-evidence.json, reencode-variant).
 * Classification fields are declarations checked by tests; eligibility
 * (supports) is evaluated per file before a run, and outcomes are only
 * ever claimed as local gate results.
 */

import evidence from "@/data/method-evidence.json";
import { PatchError } from "@/lib/mp4/boxes";
import { type MediaInfo, inspectMedia } from "@/lib/mp4/inspect";
import { type PatchProgress, type PatchStats, transformMedia } from "@/lib/mp4/transform";

export interface EngineSupport {
  supported: boolean;
  reason?: string;
}

export interface EngineProcessOptions {
  onProgress?: (p: PatchProgress) => void;
  scrubMetadata?: boolean;
  flattenFrameTiming?: boolean;
}

export interface EngineOutput {
  blob: Blob;
  stats: PatchStats;
}

export interface PatchEngine {
  id: string;
  name: string;
  description: string;
  sourceRepo: string;
  sourceCommit: string;
  license: string;
  containerOnly: boolean;
  reencodesVideo: boolean;
  reencodesAudio: boolean;
  /** Adds/removes video samples in the output sample table. */
  changesVideoSamples: boolean;
  /** Adds/removes audio samples in the output sample table. */
  changesAudioSamples: boolean;
  /** Declared sample timing (stts/mdhd) differs from the source. */
  changesTiming: boolean;
  /** Headers/tags/brands differ beyond sample tables (scrub, udta, elst...). */
  changesMetadata: boolean;
  supportsVFR: boolean;
  supportsCFR: boolean;
  supportsH264: boolean;
  supportsHEVC: boolean;
  supportsMOV: boolean;
  supportsMP4: boolean;
  /** Engine input contract: progressive files only (pipeline normalizes fMP4). */
  supportsFragmentedMP4: boolean;
  supportsCo64: boolean;
  /** Timing-dependent candidate with no verified platform outcome. */
  experimental: boolean;
  /** This project's full local gate suite has passed for supported inputs. */
  localVerified: boolean;
  /** Set only after a performed live upload test (never by research). */
  liveTikTokVerified: boolean;
  /**
   * True when a run with these options may legitimately change decoded
   * timestamps (timing methods, or ghost-frame with flattening enabled).
   * Only then may Gate 3 fall back to pairing frames by sample order.
   */
  timingMayChange(options: EngineProcessOptions): boolean;
  outcomeEvidence: string;
  mechanismEvidence: string;
  supports(input: { file: File; info: MediaInfo }): EngineSupport;
  process(file: File, options: EngineProcessOptions): Promise<EngineOutput>;
}

type EvidenceMethod = (typeof evidence.methods)[number];

function evidenceOf(id: string): EvidenceMethod | undefined {
  return evidence.methods.find((m) => m.id === id);
}

/** Frame-rate divisor for the timescale method: 60fps -> 2, 120fps -> 4. */
export function timescaleDividerFor(fps: number): number | null {
  const nominal = Math.round(fps);
  if (nominal === 60) return 2;
  if (nominal === 120) return 4;
  return null;
}

function notAvc(): EngineSupport {
  return { supported: false, reason: "codec-not-avc" };
}

function baseSupports({ info }: { file: File; info: MediaInfo }): EngineSupport {
  if (!info.supported) return notAvc();
  return { supported: true };
}

interface EngineMeta {
  name: string;
  description: string;
  sourceRepo: string;
  sourceCommit: string;
  license: string;
}

function engineMeta(id: string, fallback: EngineMeta): EngineMeta {
  const ev = evidenceOf(id);
  return {
    name: ev?.name ?? fallback.name,
    description: ev?.description ?? fallback.description,
    sourceRepo: ev?.sources[0]?.repo ?? fallback.sourceRepo,
    sourceCommit: ev?.sourceVersion ?? fallback.sourceCommit,
    license: ev?.license ?? fallback.license,
  };
}

/** Shared classification for container-only rewrites of the same family. */
const containerOnlyBase = {
  containerOnly: true,
  reencodesVideo: false,
  reencodesAudio: false,
  changesAudioSamples: false,
  supportsVFR: true,
  supportsCFR: true,
  supportsH264: true,
  supportsHEVC: false,
  supportsMOV: true,
  supportsMP4: true,
  supportsFragmentedMP4: false,
  supportsCo64: true,
  liveTikTokVerified: false,
};

const ghostMeta = engineMeta("ghost-frame", {
  name: "Sample-table ghost frames",
  description: "",
  sourceRepo: "",
  sourceCommit: "5fc3907",
  license: "MIT",
});

const ghostFrameEngine: PatchEngine = {
  id: "ghost-frame",
  name: ghostMeta?.name ?? "Sample-table ghost frames",
  description: ghostMeta?.description ?? "",
  sourceRepo: ghostMeta?.sourceRepo ?? "",
  sourceCommit: ghostMeta?.sourceCommit ?? "5fc3907",
  license: ghostMeta?.license ?? "MIT",
  ...containerOnlyBase,
  changesVideoSamples: true,
  changesTiming: false,
  changesMetadata: true,
  experimental: true,
  localVerified: true,
  timingMayChange: (options) => options.flattenFrameTiming === true,
  outcomeEvidence: evidenceOf("ghost-frame")?.outcomeEvidence ?? "E",
  mechanismEvidence: evidenceOf("ghost-frame")?.mechanismEvidence ?? "E",
  supports: baseSupports,
  async process(file, options) {
    // Always starts from the ORIGINAL file: inspect, then transform.
    const { context } = await inspectMedia(file);
    const { blob, stats } = await transformMedia(context, {
      onProgress: options.onProgress,
      scrubMetadata: options.scrubMetadata,
      flattenFrameTiming: options.flattenFrameTiming,
    });
    return { blob, stats };
  },
};

const hygieneMeta = engineMeta("hygiene-remux", {
  name: "Container hygiene remux",
  description: "",
  sourceRepo: "",
  sourceCommit: "5fc3907",
  license: "MIT",
});

const hygieneRemuxEngine: PatchEngine = {
  id: "hygiene-remux",
  name: hygieneMeta?.name ?? "Container hygiene remux",
  description: hygieneMeta?.description ?? "",
  sourceRepo: hygieneMeta?.sourceRepo ?? "",
  sourceCommit: hygieneMeta?.sourceCommit ?? "5fc3907",
  license: hygieneMeta?.license ?? "MIT",
  ...containerOnlyBase,
  changesVideoSamples: false,
  changesTiming: false,
  changesMetadata: true,
  experimental: false,
  localVerified: false,
  timingMayChange: () => false,
  outcomeEvidence: evidenceOf("hygiene-remux")?.outcomeEvidence ?? "E",
  mechanismEvidence: evidenceOf("hygiene-remux")?.mechanismEvidence ?? "E",
  supports: baseSupports,
  async process(file, options) {
    const { context } = await inspectMedia(file);
    const { blob, stats } = await transformMedia(context, {
      onProgress: options.onProgress,
      // Method definition: normalization is the point, dates always scrubbed,
      // no sample padding, no timing flattening.
      scrubMetadata: true,
      flattenFrameTiming: false,
      frameMultiplier: 1,
    });
    return { blob, stats };
  },
};

const timescaleMeta = engineMeta("timescale-divide", {
  name: "Timescale division",
  description: "",
  sourceRepo: "",
  sourceCommit: "unknown",
  license: "unknown",
});

const timescaleDivideEngine: PatchEngine = {
  id: "timescale-divide",
  name: timescaleMeta?.name ?? "Timescale division",
  description: timescaleMeta?.description ?? "",
  sourceRepo: timescaleMeta?.sourceRepo ?? "",
  sourceCommit: timescaleMeta?.sourceCommit ?? "unknown",
  license: timescaleMeta?.license ?? "unknown",
  ...containerOnlyBase,
  changesVideoSamples: false,
  changesTiming: true,
  changesMetadata: true,
  experimental: true,
  localVerified: false,
  timingMayChange: () => true,
  outcomeEvidence: evidenceOf("timescale-divide")?.outcomeEvidence ?? "E",
  mechanismEvidence: evidenceOf("timescale-divide")?.mechanismEvidence ?? "E",
  supports({ info }) {
    if (!info.supported) return notAvc();
    const divider = timescaleDividerFor(info.video.fps);
    if (divider === null) {
      return { supported: false, reason: "fps-unsupported" };
    }
    if (
      info.video.timescale % divider !== 0 ||
      info.video.durationTicks % divider !== 0
    ) {
      return { supported: false, reason: "timescale-indivisible" };
    }
    return { supported: true };
  },
  async process(file, options) {
    const { context, info } = await inspectMedia(file);
    const divider = timescaleDividerFor(info.video.fps);
    if (divider === null) {
      throw new PatchError("timescale-indivisible");
    }
    const { blob, stats } = await transformMedia(context, {
      onProgress: options.onProgress,
      scrubMetadata: options.scrubMetadata,
      flattenFrameTiming: false,
      frameMultiplier: 1,
      timescaleDivider: divider,
    });
    return { blob, stats };
  },
};

const editListMeta = engineMeta("edit-list-signal", {
  name: "Edit-list identity signal",
  description: "",
  sourceRepo: "",
  sourceCommit: "unknown",
  license: "unknown",
});

const editListSignalEngine: PatchEngine = {
  id: "edit-list-signal",
  name: editListMeta?.name ?? "Edit-list identity signal",
  description: editListMeta?.description ?? "",
  sourceRepo: editListMeta?.sourceRepo ?? "",
  sourceCommit: editListMeta?.sourceCommit ?? "unknown",
  license: editListMeta?.license ?? "unknown",
  ...containerOnlyBase,
  changesVideoSamples: false,
  changesTiming: false,
  changesMetadata: true,
  experimental: true,
  localVerified: false,
  timingMayChange: () => false,
  outcomeEvidence: evidenceOf("edit-list-signal")?.outcomeEvidence ?? "E",
  mechanismEvidence: evidenceOf("edit-list-signal")?.mechanismEvidence ?? "E",
  supports({ info }) {
    if (!info.supported) return notAvc();
    if (info.video.hasEditList) {
      return { supported: false, reason: "already-has-edit-list" };
    }
    return { supported: true };
  },
  async process(file, options) {
    const { context } = await inspectMedia(file);
    const { blob, stats } = await transformMedia(context, {
      onProgress: options.onProgress,
      scrubMetadata: options.scrubMetadata,
      flattenFrameTiming: false,
      frameMultiplier: 1,
      insertIdentityElst: true,
    });
    return { blob, stats };
  },
};

export const ENGINES: PatchEngine[] = [
  ghostFrameEngine,
  hygieneRemuxEngine,
  timescaleDivideEngine,
  editListSignalEngine,
];

export const DEFAULT_ENGINE_ID = ghostFrameEngine.id;

export function getEngine(id: string): PatchEngine {
  return ENGINES.find((e) => e.id === id) ?? ENGINES[0];
}
