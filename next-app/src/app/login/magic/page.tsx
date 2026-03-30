"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DEFAULT_AUTHENTICATED_PATH } from "@/const";
import { useT } from "@/i18n";

function MagicLinkHandler() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const callbackUrl = searchParams.get("callbackUrl") || DEFAULT_AUTHENTICATED_PATH;

  useEffect(() => {
    if (!token) {
      return;
    }

    signIn("magic-link", {
      token,
      callbackUrl,
      redirect: true,
    }).catch(() => {
      router.replace("/login?error=magic-link");
    });
  }, [token, callbackUrl, router]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">
            {t("magicLogin.invalidLink")}
          </p>
          <a href="/login" className="mt-4 inline-block text-primary hover:underline">
            {t("magicLogin.backToLogin")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-lg">{t("magicLogin.verifying")}</p>
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <MagicLinkHandler />
    </Suspense>
  );
}
