// Single source of truth for supported languages. To add one: append it here,
// add its display name, then run `npm run translate` to generate the content.
export const locales = ["pt", "en", "es"] as const;
export type Locale = (typeof locales)[number];

// Language the editors write in. Everything else is translated from it.
export const sourceLocale: Locale = "pt";
// Served when none of the visitor's preferred languages is supported.
export const fallbackLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

// Picks the best supported locale from an Accept-Language header,
// e.g. "pt-BR,pt;q=0.9,en-US;q=0.8" -> "pt".
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return fallbackLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return fallbackLocale;
}
