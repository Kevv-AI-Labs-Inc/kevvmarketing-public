import { formatAuthProviderLabel, type AuthProviderId } from "@/lib/auth-provider-config";
import { DEFAULT_AUTHENTICATED_PATH } from "@/const";
import type { Locale } from "@/i18n";
import { pickText } from "@/i18n/copy";
import { uiCopy } from "@/i18n/ui-copy";

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
  const copy = uiCopy.authUx;
  const pick = (value: { zh: string; en: string }) => pickText(locale, value);
  const checklist = (items: ReadonlyArray<{ zh: string; en: string }>) => items.map((item) => pick(item));

  if (!code) {
    return null;
  }

  switch (code) {
    case "AccessDenied":
    case "denied":
      return {
        tone: "warning",
        title: pick(copy.accessDenied.title(providerLabel)),
        description: pick(copy.accessDenied.description),
        checklist: checklist(copy.accessDenied.checklist),
      };
    case "missing-email":
      return {
        tone: "warning",
        title: pick(copy.missingEmail.title(providerLabel)),
        description: pick(copy.missingEmail.description),
        checklist: checklist(copy.missingEmail.checklist),
      };
    case "account-sync-failed":
      return {
        tone: "error",
        title: pick(copy.accountSyncFailed.title),
        description: pick(copy.accountSyncFailed.description),
        checklist: checklist(copy.accountSyncFailed.checklist),
      };
    case "OAuthSignin":
    case "OAuthCallback":
    case "Callback":
    case "CallbackRouteError":
      return {
        tone: "error",
        title: pick(copy.oauthCallback.title(providerLabel)),
        description: pick(copy.oauthCallback.description),
        checklist: checklist(copy.oauthCallback.checklist),
      };
    case "Configuration":
      return {
        tone: "error",
        title: pick(copy.configuration.title),
        description: pick(copy.configuration.description),
        checklist: checklist(copy.configuration.checklist),
      };
    case "Verification":
    case "CredentialsSignin":
      return {
        tone: "warning",
        title: pick(copy.verification.title),
        description: pick(copy.verification.description),
        checklist: checklist(copy.verification.checklist),
      };
    case "Default":
    default:
      return {
        tone: "error",
        title: pick(copy.defaultError.title),
        description: pick(copy.defaultError.description),
        checklist: checklist(copy.defaultError.checklist),
      };
  }
}
