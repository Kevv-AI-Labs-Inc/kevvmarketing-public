import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role?: string;
      authProvider?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number;
    role?: string;
    authProvider?: string;
  }
}
