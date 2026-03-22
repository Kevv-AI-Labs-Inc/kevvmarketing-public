import { Suspense } from "react";
import {
  isGoogleAuthConfigured,
  isMicrosoftAuthConfigured,
} from "@/lib/auth-provider-config";
import { LoginPageClient } from "./login-client";

/**
 * Server Component — reads server-only env vars and passes
 * provider-configured booleans down to the client component.
 */
export default function LoginPage() {
  const googleConfigured = isGoogleAuthConfigured();
  const microsoftConfigured = isMicrosoftAuthConfigured();

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginPageClient
        googleConfigured={googleConfigured}
        microsoftConfigured={microsoftConfigured}
      />
    </Suspense>
  );
}
