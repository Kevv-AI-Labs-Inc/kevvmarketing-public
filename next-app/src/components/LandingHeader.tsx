"use client";

import Link from "next/link";
import { Users, Link as LinkIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { LocaleToggleButton } from "@/components/LocaleToggleButton";
import { useT } from "@/i18n";

export function LandingHeader({
  signIn,
  getStartedShort,
}: {
  signIn: string;
  getStartedShort: string;
}) {
  const { status } = useSession();
  const { t } = useT();
  const isAuthenticated = status === "authenticated";

  return (
    <div className="flex items-center gap-3">
      <LocaleToggleButton variant="ghost" />

      {isAuthenticated ? (
        <>
          {/* 已登录：显示 线索中心 + 我的分享 */}
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-accent active:scale-[0.98]"
          >
            <Users className="h-3.5 w-3.5" />
            {t("landing.header.leads")}
          </Link>
          <Link
            href="/shares"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:brightness-110 active:scale-[0.98]"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {t("landing.header.myShares")}
          </Link>
        </>
      ) : (
        <>
          {/* 未登录：显示 登录 + 免费开始 */}
          <Link
            href="/login"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-accent active:scale-[0.98]"
          >
            {signIn}
          </Link>
          <Link
            href="/login"
            className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:brightness-110 active:scale-[0.98] sm:inline-flex"
          >
            {getStartedShort}
          </Link>
        </>
      )}
    </div>
  );
}
