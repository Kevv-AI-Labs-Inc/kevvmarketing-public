import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { getRequestLocale } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} — AI-Powered Real Estate Marketing`,
  description:
    "Create flyers, smart property matches, share pages, subscriptions, and bilingual real estate marketing workflows with Kevv Marketing.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={GeistSans.className}>
        <Providers defaultLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
