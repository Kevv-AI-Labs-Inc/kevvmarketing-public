import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, type Locale, LOCALE_COOKIE_NAME } from "./config";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  return DEFAULT_LOCALE;
}
