"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { usePatcher } from "@/hooks/use-patcher";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HonestyBanner } from "@/components/honesty-banner";
import { Hero } from "@/components/hero";
import { Stepper } from "@/components/stepper";
import { Dropzone } from "@/components/dropzone";
import { FileInfoCard } from "@/components/file-info-card";
import { PatchProgress } from "@/components/patch-progress";
import { MethodComparisonCard } from "@/components/method-comparison-card";
import { ResultCard } from "@/components/result-card";
import { ErrorCard } from "@/components/error-card";
import { UploadGuide } from "@/components/upload-guide";

export default function Home() {
  const {
    phase,
    file,
    info,
    report,
    progress,
    result,
    errorCode,
    baseline,
    inputStructure,
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
  } = usePatcher();

  const prevPhase = React.useRef(phase);

  // When a phase change swaps the main card (upload -> progress -> result…),
  // scroll the panel into view so the user sees what just happened instead
  // of being stranded at their old scroll position. Skipped when the user
  // prefers reduced motion.
  React.useEffect(() => {
    if (prevPhase.current === phase) return;
    prevPhase.current = phase;
    if (phase === "idle") return; // initial state, nothing to reveal
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const panel = document.querySelector("[data-phase-panel]");
    if (!panel) return;
    // Only scroll when the panel top is actually out of view.
    const rect = panel.getBoundingClientRect();
    if (rect.top >= 0 && rect.top < window.innerHeight * 0.4) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  // Files inspect fine but the method only works for H.264/AVC: surface that
  // as a friendly error instead of letting the prepare step throw.
  const unsupported = phase === "ready" && info !== null && !info.supported;
  const showError = phase === "error" || unsupported;
  const showReady = phase === "ready" && info !== null && !unsupported;
  const showProgress =
    (phase === "patching" || phase === "validating") && file !== null;
  const showComparison =
    (phase === "comparing" || phase === "comparison") && info !== null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />

      <main data-phase={phase} className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="pt-5">
            <HonestyBanner />
          </div>

          <Hero />

          <div className="flex justify-center pb-1 pt-1">
            <Stepper phase={phase} />
          </div>

          <div data-phase-panel className="min-h-[300px] pb-4">
            <AnimatePresence mode="wait">
              {(phase === "idle" || phase === "inspecting") && (
                <Dropzone key="dropzone" onFile={selectFile} busy={phase === "inspecting"} />
              )}

              {showReady && info && (
                <FileInfoCard
                  key="file-info"
                  info={info}
                  report={report}
                  baseline={baseline}
                  inputStructure={inputStructure}
                  engineId={engineId}
                  onEngineChange={setEngineId}
                  onPatch={patch}
                  onCompare={compare}
                  onReset={reset}
                  eligibility={eligibility}
                  normalizedFromFragmented={normalizedFromFragmented}
                />
              )}

              {showProgress && (
                <PatchProgress
                  key="progress"
                  progress={progress}
                  fileName={file.name}
                  validationStage={
                    phase === "validating" ? (validationStage ?? "structural") : null
                  }
                />
              )}

              {showComparison && (
                <MethodComparisonCard
                  key="comparison"
                  running={phase === "comparing"}
                  runs={methodRuns}
                  methodStage={methodStage}
                  eligibility={eligibility}
                  onCancel={cancelCompare}
                  onSelect={selectMethodRun}
                />
              )}

              {phase === "done" && result && info && (
                <ResultCard
                  key="result"
                  result={result}
                  info={info}
                  engineId={engineId}
                  onReset={reset}
                />
              )}

              {showError && (
                <ErrorCard
                  key="error"
                  code={unsupported ? "unsupported-codec" : errorCode}
                  codecName={info ? info.video.codecLabel : null}
                  onReset={reset}
                />
              )}
            </AnimatePresence>
          </div>

          <UploadGuide />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
