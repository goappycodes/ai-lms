import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/db/repo";

/** Reads ?locale= from a request, falling back to English for anything else. */
export function localeFrom(req: Request): Locale {
  const v = new URL(req.url).searchParams.get("locale");
  return (LOCALES as string[]).includes(v ?? "") ? (v as Locale) : DEFAULT_LOCALE;
}

export function asLocale(v: unknown): Locale {
  return (LOCALES as string[]).includes(String(v)) ? (v as Locale) : DEFAULT_LOCALE;
}
