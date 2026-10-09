"use client";

import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Always-visible honesty disclaimer: this technique is experimental and
 * TikTok can break it at any time.
 */
export function HonestyBanner() {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="flex items-start gap-3 rounded-xl border border-foreground/20 bg-foreground/[0.03] px-4 py-3 text-sm"
      role="note"
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-foreground" />
      <div className="leading-relaxed">
        <span className="font-semibold text-foreground">
          {t("honesty.title")}:
        </span>{" "}
        <span className="text-muted-foreground">{t("honesty.body")}</span>
      </div>
    </motion.div>
  );
}
