"use client";

import { motion } from "framer-motion";
import { Info, MonitorUp, Smartphone, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const STEPS = [
  { icon: MonitorUp, titleKey: "guide.step1.title", bodyKey: "guide.step1.body" },
  { icon: Upload, titleKey: "guide.step2.title", bodyKey: "guide.step2.body" },
  { icon: Smartphone, titleKey: "guide.step3.title", bodyKey: "guide.step3.body" },
] as const;

export function UploadGuide() {
  const { t } = useI18n();

  return (
    <section className="pb-4">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("guide.eyebrow")}
        </p>
        <h2 className="mt-1.5 text-balance text-xl font-semibold tracking-tight">
          {t("guide.title")}
        </h2>
      </div>

      <ol className="mt-5 divide-y divide-border/60">
        {STEPS.map(({ icon: Icon, titleKey, bodyKey }, index) => (
          <motion.li
            key={titleKey}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.45,
              delay: index * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="group -mx-3 flex items-start gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-muted/40"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-foreground/40 group-hover:text-foreground">
              <span className="font-mono text-xs font-medium tabular-nums">
                {index + 1}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                {t(titleKey as TranslationKey)}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(bodyKey as TranslationKey)}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>

      <Alert className="mt-3 border-border/70 bg-muted/40">
        <Info className="size-4" />
        <AlertDescription className="text-muted-foreground">
          {t("guide.notice")}
        </AlertDescription>
      </Alert>
    </section>
  );
}
