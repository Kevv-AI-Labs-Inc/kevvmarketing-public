"use client";
/**
 * useAuth — NextAuth-based replacement for the old tRPC auth hook.
 * Provides the same API surface: { user, loading, isAuthenticated, logout, refresh }
 */

import { useSession, signOut } from "next-auth/react";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

type UseAuthOptions = {
    redirectOnUnauthenticated?: boolean;
    redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
    const { redirectOnUnauthenticated = false, redirectPath = "/login" } =
        options ?? {};
    const { data: session, status, update } = useSession({
        required: redirectOnUnauthenticated,
        onUnauthenticated() {
            if (typeof window !== "undefined") {
                window.location.href = redirectPath;
            }
        },
    });
    const router = useRouter();

    const logout = useCallback(async () => {
        await signOut({ redirect: false });
        router.push("/login");
    }, [router]);

    const state = useMemo(() => {
        type SessionUser = {
            userId?: number;
            role?: "user" | "admin";
            authProvider?: string | null;
        };

        const sessionUser = session?.user as SessionUser | undefined;
        const user = session?.user
            ? {
                id: sessionUser?.userId ?? 0,
                openId: sessionUser?.userId?.toString() ?? "",
                name: session.user.name ?? null,
                email: session.user.email ?? null,
                role: sessionUser?.role ?? "user",
                picture: session.user.image ?? null,
                authProvider: sessionUser?.authProvider ?? null,
            }
            : null;

        return {
            user,
            loading: status === "loading",
            error: null as Error | null,
            isAuthenticated: status === "authenticated",
        };
    }, [session, status]);

    return {
        ...state,
        refresh: () => update(),
        logout,
    };
}
