"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileVideo, HardDrive, Loader2, Timer, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const HINTS = [
  { icon: FileVideo, text: "MP4, MOV" },
  { icon: Timer, text: "H.264 / AVC" },
  { icon: HardDrive, text: "≤ 4 GB" },
] as const;

export function Dropzone({
  onFile,
  busy,
}: {
  onFile: (file: File) => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragDepth = React.useRef(0);
  const [dragging, setDragging] = React.useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.985 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <button
        type="button"
        aria-label={t("drop.selectAria")}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (!busy) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={cn(
          "group relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border-2 border-dashed border-border bg-card/60 px-4 py-10 text-center transition-[border-color,background-color,box-shadow,transform] duration-200 sm:px-6 sm:py-14",
          "hover:border-foreground/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          dragging && "glow-soft scale-[1.01] border-foreground/70 bg-card",
          busy && "pointer-events-none opacity-80",
        )}
      >
        {/* Animated sweep line on drag/hover */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px origin-left bg-foreground/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            dragging && "animate-shimmer opacity-100",
          )}
        />

        <motion.span
          animate={
            busy
              ? {}
              : dragging
                ? { scale: 1.12, y: -4 }
                : { scale: 1, y: 0 }
          }
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl transition-[background-color,border-color,box-shadow,color] duration-200 sm:size-16",
            dragging
              ? "bg-foreground text-background shadow-lg"
              : "border border-border bg-card text-foreground shadow-sm",
          )}
        >
          {busy ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <UploadCloud className="size-7" />
          )}
        </motion.span>

        <span className="space-y-1.5">
          <span className="block text-base font-semibold tracking-tight sm:text-lg">
            {busy
              ? t("status.reading")
              : dragging
                ? t("drop.dragging")
                : t("drop.title")}
          </span>
          {!busy && (
            <span className="block text-sm text-muted-foreground">
              {t("drop.subtitle")}{" "}
              <span className="text-foreground underline decoration-foreground/50 decoration-2 underline-offset-4">
                {t("drop.browse")}
              </span>
            </span>
          )}
        </span>

        <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {HINTS.map(({ icon: Icon, text }) => (
            <span key={text} className="inline-flex items-center gap-1.5">
              <Icon className="size-3.5" />
              {text}
            </span>
          ))}
        </span>
        <span className="sr-only">{t("drop.formats")}</span>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v"
          className="sr-only"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) onFile(picked);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
      </button>
    </motion.div>
  );
}
