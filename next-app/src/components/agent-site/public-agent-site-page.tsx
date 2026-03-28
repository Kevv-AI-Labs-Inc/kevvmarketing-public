"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { AgentSiteShell } from "@/components/agent-site/agent-site-shell";
import { trpc } from "@/lib/trpc";

export function PublicAgentSitePage({ slug }: { slug: string }) {
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
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        <div className="text-sm uppercase tracking-[0.28em] text-white/50">Loading profile...</div>
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-white">
        <div className="text-xs uppercase tracking-[0.36em] text-white/45">Agent Site</div>
        <h1 className="text-4xl font-semibold tracking-tight">Profile not found</h1>
        <p className="max-w-xl text-white/65">
          This agent page has not been published yet, or the slug has changed.
        </p>
      </div>
    );
  }

  return <AgentSiteShell profile={query.data} />;
}
