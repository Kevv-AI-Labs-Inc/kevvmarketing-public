// legacy page — incrementally migrated
/**
 * SmartMatchShare — Route Dispatcher
 *
 * Loads the share session data and dispatches to the correct
 * experience component based on session.experience_mode:
 *   - "story"  → SmartMatchStory (Instagram Stories immersive)
 *   - "kanban" → SmartMatchKanban (coming soon)
 *   - "report" → SmartMatchReport (coming soon)
 */

import { useT } from "@/i18n";
import { pickText } from "@/i18n/copy";
import { sharePageCopy } from "@/i18n/share-pages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SmartMatchStory } from "./share/SmartMatchStory";
import { Loader2 } from "lucide-react";

interface SmartMatchShareProps {
  token: string;
}

export function SmartMatchShare({ token }: SmartMatchShareProps) {
  const { locale } = useT();
  const copy = sharePageCopy.smartMatchShare;
  const pick = (value: { zh: string; en: string }) => pickText(locale, value);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["smartMatchShare", token],
    queryFn: async () => {
      const url = `/api/trpc/smartMatch.getShare?input=${encodeURIComponent(JSON.stringify({ json: { token } }))}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(pick(copy.fetchLoadError));
      const payload = await res.json();
      return payload?.result?.data?.json ?? payload?.result?.data ?? payload;
    },
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  const feedbackMutation = useMutation({
    mutationFn: async (params: {
      listingIdentifier: string;
      reaction: "like" | "dislike" | "neutral" | "tour_request";
      feedbackType: "reaction" | "comment" | "tour_request";
      listingType: "mls" | "external";
    }) => {
      const res = await fetch("/api/trpc/smartMatch.submitFeedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            token,
            listingIdentifier: params.listingIdentifier,
            reaction: params.reaction,
            feedbackType: params.feedbackType,
            listingType: params.listingType,
          },
        }),
      });
      if (!res.ok) throw new Error(pick(copy.fetchFeedbackError));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartMatchShare", token] });
    },
  });

  if (isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "white",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: "16px", color: "rgba(255,255,255,0.6)" }}>{pick(copy.loading)}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "white",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</div>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>{pick(copy.notFoundTitle)}</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>{pick(copy.notFoundDescription)}</p>
      </div>
    );
  }

  const mode = data.experienceMode || "story";

  switch (mode) {
    case "story":
      return <SmartMatchStory data={data} onFeedback={feedbackMutation.mutate} isFeedbackPending={feedbackMutation.isPending} />;

    case "kanban":
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "white",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <h2>{pick(copy.kanbanTitle)}</h2>
            <p style={{ color: "rgba(255,255,255,0.5)" }}>{pick(copy.comingSoon)}</p>
          </div>
        </div>
      );

    case "report":
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "white",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
            <h2>{pick(copy.reportTitle)}</h2>
            <p style={{ color: "rgba(255,255,255,0.5)" }}>{pick(copy.comingSoon)}</p>
          </div>
        </div>
      );

    default:
      return <SmartMatchStory data={data} onFeedback={feedbackMutation.mutate} isFeedbackPending={feedbackMutation.isPending} />;
  }
}

export default SmartMatchShare;
