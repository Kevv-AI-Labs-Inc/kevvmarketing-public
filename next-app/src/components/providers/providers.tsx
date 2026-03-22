"use client";
/**
 * Client-side providers wrapper — wraps the entire app with session, tRPC, theme, and toast providers.
 * Must be a Client Component because it uses context providers.
 */

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { getAppBaseUrl } from "@/lib/app-url";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider, type Locale } from "@/i18n";

export function Providers({
    children,
    defaultLocale,
}: {
    children: React.ReactNode;
    defaultLocale: Locale;
}) {
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
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                <trpc.Provider client={trpcClient} queryClient={queryClient}>
                    <QueryClientProvider client={queryClient}>
                        <I18nProvider defaultLocale={defaultLocale}>
                            <Toaster />
                            {children}
                        </I18nProvider>
                    </QueryClientProvider>
                </trpc.Provider>
            </ThemeProvider>
        </SessionProvider>
    );
}
