"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

type LocaleToggleButtonProps = {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
};

export function LocaleToggleButton({
  className,
  variant = "outline",
  size = "sm",
}: LocaleToggleButtonProps) {
  const router = useRouter();
  const { locale, setLocale } = useT();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => {
        setLocale(locale === "zh" ? "en" : "zh");
        router.refresh();
      }}
    >
      <Globe className="h-4 w-4" />
      <span>{locale === "zh" ? "English" : "中文"}</span>
    </Button>
  );
}
