export type AuthProviderId = "google" | "microsoft-entra-id" | "magic-link";

function nonEmpty(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getGoogleClientId() {
  return process.env.AUTH_GOOGLE_ID || "";
}

export function getGoogleClientSecret() {
  return process.env.AUTH_GOOGLE_SECRET || "";
}

export function getMicrosoftClientId() {
  return process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "";
}

export function getMicrosoftClientSecret() {
  return process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || "";
}

export function getMicrosoftIssuer() {
  if (process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER) {
    return process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  }

  return "https://login.microsoftonline.com/common/v2.0";
}

export function isGoogleAuthConfigured() {
  return nonEmpty(getGoogleClientId()) && nonEmpty(getGoogleClientSecret());
}

export function isMicrosoftAuthConfigured() {
  return nonEmpty(getMicrosoftClientId()) && nonEmpty(getMicrosoftClientSecret());
}

export function getEnabledAuthProviders(): AuthProviderId[] {
  const providers: AuthProviderId[] = [];

  if (isGoogleAuthConfigured()) {
    providers.push("google");
  }

  if (isMicrosoftAuthConfigured()) {
    providers.push("microsoft-entra-id");
  }

  return providers;
}

export function formatAuthProviderLabel(provider?: string | null) {
  if (provider === "google") {
    return "Google";
  }

  if (provider === "microsoft-entra-id") {
    return "Microsoft";
  }

  if (provider === "magic-link") {
    return "Email sign-in link";
  }

  return "your identity provider";
}
