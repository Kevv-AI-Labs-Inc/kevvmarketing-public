import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { createTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);

  return {
    title: t("metadata.rootTitle", { appName: siteConfig.name }),
    description: t("metadata.rootDescription", { appName: siteConfig.name }),
  };
}

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
