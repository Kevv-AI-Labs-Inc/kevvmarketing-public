import { formatAuthProviderLabel, type AuthProviderId } from "@/lib/auth-provider-config";
import { DEFAULT_AUTHENTICATED_PATH } from "@/const";
import type { Locale } from "@/i18n";
import { getUiCopy } from "@/i18n/ui-copy";

export type LoginIssueTone = "error" | "warning" | "info";

export type LoginIssue = {
  tone: LoginIssueTone;
  title: string;
  description: string;
  checklist: string[];
};

export type LoginProviderState = {
  id: Exclude<AuthProviderId, "magic-link">;
  label: string;
  configured: boolean;
};

export function sanitizeCallbackUrl(candidate?: string | string[] | null) {
  const raw = Array.isArray(candidate) ? candidate[0] : candidate;

  if (!raw || typeof raw !== "string") {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  return DEFAULT_AUTHENTICATED_PATH;
}

export function resolveLoginIssue(
  error?: string | string[] | null,
  provider?: string | string[] | null,
  locale: Locale = "en",
): LoginIssue | null {
  const code = Array.isArray(error) ? error[0] : error;
  const providerCode = Array.isArray(provider) ? provider[0] : provider;
  const providerLabel = formatAuthProviderLabel(providerCode);
  const copy = getUiCopy(locale).authUx;

  if (!code) {
    return null;
  }

  switch (code) {
    case "AccessDenied":
    case "denied":
      return {
        tone: "warning",
        title: copy.accessDenied.title(providerLabel),
        description: copy.accessDenied.description,
        checklist: copy.accessDenied.checklist,
      };
    case "missing-email":
      return {
        tone: "warning",
        title: copy.missingEmail.title(providerLabel),
        description: copy.missingEmail.description,
        checklist: copy.missingEmail.checklist,
      };
    case "account-sync-failed":
      return {
        tone: "error",
        title: copy.accountSyncFailed.title,
        description: copy.accountSyncFailed.description,
        checklist: copy.accountSyncFailed.checklist,
      };
    case "OAuthSignin":
    case "OAuthCallback":
    case "Callback":
    case "CallbackRouteError":
      return {
        tone: "error",
        title: copy.oauthCallback.title(providerLabel),
        description: copy.oauthCallback.description,
        checklist: copy.oauthCallback.checklist,
      };
    case "Configuration":
      return {
        tone: "error",
        title: copy.configuration.title,
        description: copy.configuration.description,
        checklist: copy.configuration.checklist,
      };
    case "Verification":
    case "CredentialsSignin":
      return {
        tone: "warning",
        title: copy.verification.title,
        description: copy.verification.description,
        checklist: copy.verification.checklist,
      };
    case "Default":
    default:
      return {
        tone: "error",
        title: copy.defaultError.title,
        description: copy.defaultError.description,
        checklist: copy.defaultError.checklist,
      };
  }
}
