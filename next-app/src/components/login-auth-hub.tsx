"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  Send,
  ShieldCheck,
} from "lucide-react";

import { LocaleToggleButton } from "@/components/LocaleToggleButton";
import { useT } from "@/i18n";
import { getUiCopy } from "@/i18n/ui-copy";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import type { LoginIssue, LoginProviderState } from "@/lib/auth-ux";

type LoginAuthHubProps = {
  callbackUrl: string;
  isNewWorkspaceFlow: boolean;
  issue: LoginIssue | null;
  magicLinkConfigured: boolean;
  providers: LoginProviderState[];
};

function GoogleGlyph() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MicrosoftGlyph() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

const providerMeta = {
  google: {
    label: "Google",
    subtitle: {
      zh: "个人 Gmail 或 Google Workspace",
      en: "Consumer Gmail or Google Workspace",
    },
    icon: GoogleGlyph,
  },
  "microsoft-entra-id": {
    label: "Microsoft",
    subtitle: {
      zh: "Outlook 或 Microsoft 365 / Entra ID",
      en: "Outlook or Microsoft 365 / Entra ID",
    },
    icon: MicrosoftGlyph,
  },
} as const;

const issueToneStyles = {
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
} as const;

export function LoginAuthHub({
  callbackUrl,
  isNewWorkspaceFlow,
  issue,
  magicLinkConfigured,
  providers,
}: LoginAuthHubProps) {
  const { locale } = useT();
  const copy = getUiCopy(locale).loginAuthHub;
  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = React.useState("");
  const [magicLinkPending, setMagicLinkPending] = React.useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = React.useState<string | null>(null);

  async function handleProviderSignIn(providerId: "google" | "microsoft-entra-id") {
    const provider = providerMap.get(providerId);
    const meta = providerMeta[providerId];
    if (!provider?.configured) {
      toast.error(copy.providerNotConfigured(meta.label));
      return;
    }

    try {
      setLoadingProvider(providerId);
      await signIn(providerId, { callbackUrl });
    } catch {
      toast.error(copy.providerStartFailed(meta.label));
      setLoadingProvider(null);
    }
  }

  async function handleMagicLinkRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = magicLinkEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error(copy.enterEmail);
      return;
    }
    if (!magicLinkConfigured) {
      toast.error(copy.magicLinkNotConfigured);
      return;
    }

    try {
      setMagicLinkPending(true);
      const response = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, callbackUrl }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || copy.magicLinkFailed);
      }

      setMagicLinkSentTo(trimmedEmail);
      toast.success(payload?.message || copy.magicLinkInbox);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.magicLinkFailed);
    } finally {
      setMagicLinkPending(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-amber-200/30 blur-[120px]" />
        <div className="absolute right-[-10rem] top-[16rem] h-[24rem] w-[24rem] rounded-full bg-orange-100/25 blur-[100px]" />
        <div className="absolute left-[-8rem] top-[26rem] h-[20rem] w-[20rem] rounded-full bg-yellow-100/20 blur-[90px]" />
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-120px)] w-full max-w-7xl items-center gap-8 px-5 py-8 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:block">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-block rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
              {copy.securityBadge}
            </span>
            <LocaleToggleButton />
          </div>
          <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-tight tracking-tight text-foreground">
            {isNewWorkspaceFlow ? copy.heroTitleNewWorkspace : copy.heroTitleDefault}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {copy.heroDescription}
          </p>

          <div className="mt-8 grid max-w-2xl gap-3">
            {copy.featureCards.map((item, index) => {
              const icons = [LockKeyhole, Mail, ShieldCheck] as const;
              const Icon = icons[index];
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-card/80 p-5 shadow-soft backdrop-blur"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-elevated lg:max-w-xl lg:justify-self-end">
          <div className="mb-4 flex justify-end lg:hidden">
            <LocaleToggleButton />
          </div>
          <div className="space-y-3 border-b border-border pb-5 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{siteConfig.name}</h2>
            <p className="text-sm text-muted-foreground">
              {isNewWorkspaceFlow
                ? copy.authCardPromptNewWorkspace
                : copy.authCardPromptDefault}
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {issue ? (
              <div
                className={cn(
                  "rounded-xl border px-4 py-4 text-left shadow-sm",
                  issueToneStyles[issue.tone],
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold">{issue.title}</p>
                      <p className="mt-1 text-sm leading-6 opacity-90">{issue.description}</p>
                    </div>
                    <div className="space-y-2">
                      {issue.checklist.map((item) => (
                        <div key={item} className="flex gap-2 text-sm leading-6">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 opacity-80" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">{copy.noPasswordsTitle}</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-700">{copy.noPasswordsBody}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {providers.map((provider) => {
                const meta = providerMeta[provider.id];
                const Icon = meta.icon;
                const disabled = !provider.configured || loadingProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => void handleProviderSignIn(provider.id)}
                    disabled={disabled}
                    className={cn(
                      "group rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-55",
                      provider.configured &&
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center text-base font-semibold text-foreground">
                          <Icon /> {copy.continueWith(meta.label)}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle[locale]}</p>
                      </div>
                      <div className="shrink-0">
                        {loadingProvider === provider.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : provider.configured ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            {copy.statusLive}
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            {copy.statusNotConfigured}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {copy.passwordlessDivider}
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    {copy.magicLinkTitle}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {copy.magicLinkDescription}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    magicLinkConfigured
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  {magicLinkConfigured ? copy.statusLive : copy.statusNotConfigured}
                </span>
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleMagicLinkRequest}>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="agent@brokerage.com"
                  value={magicLinkEmail}
                  onChange={(event) => setMagicLinkEmail(event.target.value)}
                  disabled={!magicLinkConfigured || magicLinkPending}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-55"
                />
                <button
                  type="submit"
                  disabled={!magicLinkConfigured || magicLinkPending || !magicLinkEmail.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {magicLinkPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {copy.sendingLink}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> {copy.sendLink}
                    </>
                  )}
                </button>
              </form>

              {magicLinkSentTo && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {copy.sentPrefix}
                  <span className="font-medium">{magicLinkSentTo}</span>
                  {copy.sentSuffix}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-primary" /> {copy.helpTitle}
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                {copy.helpChecklist.map((item) => (
                  <p key={item}>{item}</p>
                ))}
                <p>
                  {copy.needHelpPrefix}
                  <a
                    href={`mailto:${siteConfig.supportEmail}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {siteConfig.supportEmail}
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <Link className="inline-flex items-center gap-1 hover:text-foreground" href="/privacy">
                {copy.privacy} <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link className="inline-flex items-center gap-1 hover:text-foreground" href="/terms">
                {copy.terms} <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link className="inline-flex items-center gap-1 hover:text-foreground" href="/">
                {copy.returnHome} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
