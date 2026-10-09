"use client";

import { ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
        <span className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-card text-foreground shadow-sm">
          <Logo className="size-5" />
        </span>

        <p className="text-sm font-semibold tracking-tight">{t("brand.name")}</p>

        <p className="flex max-w-lg items-start justify-center gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-foreground" />
          <span>{t("footer.privacy")}</span>
        </p>

        <Separator className="max-w-40" />

        <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
          <p>{t("footer.noCopyright")}</p>
          <p>{t("footer.disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
