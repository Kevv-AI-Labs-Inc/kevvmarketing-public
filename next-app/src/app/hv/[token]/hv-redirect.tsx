"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function HvRedirect({ token }: { token: string }) {
  const router = useRouter();
  const resolveMutation = trpc.homeValue.resolveCampaignLink.useMutation({
    onSuccess: (data) => {
      if (data.slug) {
        router.replace(`/agents/${data.slug}/home-value?ref=${token}`);
      }
    },
  });

  useEffect(() => {
    resolveMutation.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (resolveMutation.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">This link is no longer available.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
