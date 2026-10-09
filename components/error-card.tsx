"use client";

import { motion } from "framer-motion";
import { CircleX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PatchErrorCode } from "@/lib/mp4/boxes";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export function ErrorCard({
  code,
  onReset,
  codecName,
}: {
  code: PatchErrorCode | null;
  onReset: () => void;
  /** Detected codec label for the unsupported-codec error (e.g. "H.265 (HEVC)"). */
  codecName?: string | null;
}) {
  const { t } = useI18n();
  const key = `error.${code ?? "unknown"}` as TranslationKey;
  const vars =
    code === "unsupported-codec"
      ? { codec: codecName || "" }
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.985 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto max-w-xl"
    >
      <Card className="border-foreground/30 bg-foreground/[0.03] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2.5 text-base text-foreground">
            <CircleX className="size-5" />
            {t("error.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(key, vars)}
          </p>
          <div className="flex justify-end">
            <Button onClick={onReset} variant="outline" className="gap-2">
              <RotateCcw className="size-4" />
              {t("error.retry")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
