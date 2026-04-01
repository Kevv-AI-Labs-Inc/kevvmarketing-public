import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, isLocale, type Locale, LOCALE_COOKIE_NAME } from "./config";

/**
 * Resolve locale for the current request.
 * Priority: cookie → Accept-Language header → DEFAULT_LOCALE
 */
export async function getRequestLocale(): Promise<Locale> {
  // 1. Explicit user preference via cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Browser / device language from Accept-Language header
  try {
    const headerStore = await headers();
    const acceptLang = headerStore.get("accept-language") ?? "";
    // Parse primary language tags (e.g. "zh-CN,zh;q=0.9,en;q=0.8")
    const tags = acceptLang
      .split(",")
      .map((tag) => tag.split(";")[0].trim().toLowerCase());

    for (const tag of tags) {
      if (tag.startsWith("zh")) return "zh";
      if (tag.startsWith("en")) return "en";
    }
  } catch {
    // headers() may throw in some edge cases — ignore
  }

  return DEFAULT_LOCALE;
}
