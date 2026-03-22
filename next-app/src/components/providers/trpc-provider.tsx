"use client";
/**
 * TRPCProvider — wraps the app with tRPC + React Query providers.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { getAppBaseUrl } from "@/lib/app-url";
import { trpc } from "@/lib/trpc";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { refetchOnWindowFocus: false, retry: 1 },
                },
            })
    );

    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: `${getAppBaseUrl()}/api/trpc`,
                    transformer: superjson,
                    fetch(input, init) {
                        const requestInit: RequestInit = {
                            ...(init as RequestInit | undefined),
                            credentials: "include",
                        };
                        return globalThis.fetch(input as RequestInfo, requestInit);
                    },
                }),
            ],
        })
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
}
