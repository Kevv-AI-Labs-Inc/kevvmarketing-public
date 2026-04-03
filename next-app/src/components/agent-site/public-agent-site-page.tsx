"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { TemplateRenderer } from "@/components/agent-site/templates";
import { AgentSiteChatWidget } from "@/components/agent-site/agent-site-chat-widget";
import { useT } from "@/i18n";
import { trpc } from "@/lib/trpc";

export function PublicAgentSitePage({ slug }: { slug: string }) {
  const { t } = useT();
  const pathname = usePathname();
  const query = trpc.profile.getPublicBySlug.useQuery(
    { slug },
    { enabled: slug.trim().length > 0 }
  );
  const trackView = trpc.profile.trackView.useMutation();

  useEffect(() => {
    if (!query.data?.slug) return;

    const storageKey = `kevv-agent-profile-view:${query.data.slug}:${pathname}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {}

    void trackView.mutateAsync({
      slug: query.data.slug,
      pagePath: pathname,
      referrer: typeof document !== "undefined" ? document.referrer : "",
    });
  }, [pathname, query.data?.slug, trackView]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-950 text-white">
        <div className="text-sm uppercase tracking-[0.28em] text-white/50">{t("publicAgentSite.loading")}</div>
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-white">
        <div className="text-xs uppercase tracking-[0.36em] text-white/45">{t("publicAgentSite.eyebrow")}</div>
        <h1 className="text-4xl font-semibold tracking-tight">{t("publicAgentSite.notFoundTitle")}</h1>
        <p className="max-w-xl text-white/65">
          {t("publicAgentSite.notFoundDescription")}
        </p>
      </div>
    );
  }

  const profile = query.data;
  const chatEnabled = profile.chatSettings?.enabled !== false;

  return (
    <>
      <TemplateRenderer profile={profile} />
      {chatEnabled && (
        <AgentSiteChatWidget
          accentClassName="bg-primary text-primary-foreground hover:bg-primary/90"
          agentName={profile.name}
          agentSlug={profile.slug}
        />
      )}
    </>
  );
}
