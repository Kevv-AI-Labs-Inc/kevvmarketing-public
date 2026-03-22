"use client";

import { useSearchParams } from "next/navigation";
import { resolveLoginIssue, sanitizeCallbackUrl } from "@/lib/auth-ux";
import type { LoginProviderState } from "@/lib/auth-ux";
import { LoginAuthHub } from "@/components/login-auth-hub";
import { useT } from "@/i18n";

type LoginPageClientProps = {
  googleConfigured: boolean;
  microsoftConfigured: boolean;
};

export function LoginPageClient({
  googleConfigured,
  microsoftConfigured,
}: LoginPageClientProps) {
  const { locale } = useT();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const issue = resolveLoginIssue(
    searchParams.get("error"),
    searchParams.get("provider"),
    locale,
  );

  const providers: LoginProviderState[] = [
    { id: "google", label: "Google", configured: googleConfigured },
    {
      id: "microsoft-entra-id",
      label: "Microsoft",
      configured: microsoftConfigured,
    },
  ];

  return (
    <LoginAuthHub
      callbackUrl={callbackUrl}
      isNewWorkspaceFlow={false}
      issue={issue}
      magicLinkConfigured={true}
      providers={providers}
    />
  );
}
