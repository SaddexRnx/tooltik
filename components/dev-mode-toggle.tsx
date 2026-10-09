"use client";

import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Minus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { setDevMode, useDevMode } from "@/lib/dev-mode";

export function DevModeToggle() {
  const { t } = useI18n();
  const devMode = useDevMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("nav.devMode")}
          title={t("nav.devMode")}
          className="text-muted-foreground hover:text-foreground"
        >
          <Code2 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => setDevMode(false)} className="gap-2">
          <Minus className="size-4 text-muted-foreground" />
          <span className="flex-1">{t("nav.devMode.hide")}</span>
          {!devMode && <Check className="size-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDevMode(true)} className="gap-2">
          <Code2 className="size-4 text-muted-foreground" />
          <span className="flex-1">{t("nav.devMode.show")}</span>
          {devMode && <Check className="size-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
