// Single source of truth for supported languages: one per language our videos are
// dubbed in. To add one: append it here, add its display name (and the countries
// that speak it to countryLocales), then run `npm run translate`.
export const locales = [
  "pt", "pt-PT", "en", "es", "fr", "de", "it", "nl", "ca",
  "pl", "cs", "sk", "hu", "uk", "ru", "kk", "tr", "el",
  "he", "ar", "hi", "mr", "ta", "te", "ml", "th", "vi",
  "id", "ms", "tl", "zh", "zh-HK", "ja", "ko", "sv", "no", "da", "fi",
] as const;
export type Locale = (typeof locales)[number];

// Language the editors write in (Brazilian Portuguese). Everything else is translated from it.
export const sourceLocale: Locale = "pt";
// Served when neither the visitor's country nor their browser points to a supported language.
export const fallbackLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  pt: "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  ca: "Català",
  pl: "Polski",
  cs: "Čeština",
  sk: "Slovenčina",
  hu: "Magyar",
  uk: "Українська",
  ru: "Русский",
  kk: "Қазақ тілі",
  tr: "Türkçe",
  el: "Ελληνικά",
  he: "עברית",
  ar: "العربية",
  hi: "हिन्दी",
  mr: "मराठी",
  ta: "தமிழ்",
  te: "తెలుగు",
  ml: "മലയാളം",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  tl: "Filipino",
  zh: "简体中文",
  "zh-HK": "繁體中文（香港）",
  ja: "日本語",
  ko: "한국어",
  sv: "Svenska",
  no: "Norsk",
  da: "Dansk",
  fi: "Suomi",
};

const rtlLocales: ReadonlySet<Locale> = new Set(["he", "ar"]);
export const isRtl = (locale: Locale) => rtlLocales.has(locale);

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

// Locale codes are case-sensitive in URLs; this accepts "pt-pt" for "pt-PT".
export function canonicalLocale(value: string): Locale | null {
  return locales.find((locale) => locale.toLowerCase() === value.toLowerCase()) ?? null;
}

const PT_PT_REGIONS = new Set(["pt", "ao", "mz", "cv", "gw", "st", "tl"]);
const TRADITIONAL_CHINESE = new Set(["hk", "mo", "tw", "hant"]);
const ALIASES: Record<string, string> = { nb: "no", nn: "no", fil: "tl", iw: "he", in: "id" };

// Maps any language tag (browser, YouTube track) to a supported locale:
// "pt-BR" -> "pt", "pt-AO" -> "pt-PT", "zh-TW"/"yue" -> "zh-HK", "nb-NO" -> "no".
export function localeForTag(tag: string): Locale | null {
  const [language, ...subtags] = tag.toLowerCase().replace(/_/g, "-").split("-");
  if (language === "pt") return subtags.some((s) => PT_PT_REGIONS.has(s)) ? "pt-PT" : "pt";
  if (language === "yue") return "zh-HK";
  if (language === "zh") return subtags.some((s) => TRADITIONAL_CHINESE.has(s)) ? "zh-HK" : "zh";
  const code = ALIASES[language] ?? language;
  return isLocale(code) ? code : null;
}

// Supported locales from an Accept-Language header, best first,
// e.g. "pt-BR,pt;q=0.9,en-US;q=0.8" -> ["pt", "en"].
export function rankLocales(acceptLanguage: string | null): Locale[] {
  if (!acceptLanguage) return [];
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  const result: Locale[] = [];
  for (const { tag } of ranked) {
    const locale = localeForTag(tag);
    if (locale && !result.includes(locale)) result.push(locale);
  }
  return result;
}

const each = (countries: string[], spoken: readonly Locale[]) =>
  Object.fromEntries(countries.map((country) => [country, spoken]));

// Site locales spoken in each country (ISO 3166-1 alpha-2), the usual one first.
// Countries missing here fall back to the browser's languages.
const countryLocales: Record<string, readonly Locale[]> = {
  BR: ["pt"],
  ...each(["PT", "AO", "MZ", "CV", "GW", "ST", "TL"], ["pt-PT"]),
  US: ["en", "es"],
  CA: ["en", "fr"],
  ...each(["GB", "IE", "AU", "NZ", "ZA", "NG", "GH", "KE", "UG", "TZ", "ZW", "ZM", "BW", "NA", "MW", "SL", "LR", "GM",
      "JM", "TT", "BS", "BB", "BZ", "GY", "MT", "FJ", "PG", "PK", "BD", "NP"], ["en"]),
  IN: ["hi", "en", "ta", "te", "ml", "mr"],
  LK: ["en", "ta"],
  SG: ["en", "zh", "ms", "ta"],
  MY: ["ms", "en", "zh", "ta"],
  BN: ["ms", "en"],
  ID: ["id"],
  PH: ["tl", "en"],
  VN: ["vi"],
  TH: ["th"],
  CN: ["zh"],
  HK: ["zh-HK", "en"],
  MO: ["zh-HK", "pt-PT"],
  TW: ["zh-HK", "zh"],
  JP: ["ja"],
  KR: ["ko"],
  ES: ["es", "ca"],
  AD: ["ca", "es"],
  ...each(["MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY",
      "PR", "GQ"], ["es"]),
  FR: ["fr"],
  MC: ["fr"],
  BE: ["nl", "fr", "de"],
  LU: ["fr", "de"],
  CH: ["de", "fr", "it"],
  ...each(["SN", "CI", "CM", "ML", "BF", "NE", "TG", "BJ", "GN", "CD", "CG", "GA", "MG", "HT", "RW", "BI", "TD", "CF",
      "DJ", "KM"], ["fr"]),
  DE: ["de"],
  AT: ["de"],
  LI: ["de"],
  IT: ["it"],
  SM: ["it"],
  VA: ["it"],
  NL: ["nl"],
  SR: ["nl"],
  PL: ["pl"],
  CZ: ["cs"],
  SK: ["sk"],
  HU: ["hu"],
  UA: ["uk", "ru"],
  RU: ["ru"],
  BY: ["ru"],
  KG: ["ru"],
  KZ: ["kk", "ru"],
  TR: ["tr"],
  GR: ["el"],
  CY: ["el", "tr"],
  IL: ["he", "ar"],
  ...each(["EG", "IQ", "JO", "LB", "SY", "YE", "LY", "SD", "PS", "MR"], ["ar"]),
  ...each(["SA", "AE", "QA", "KW", "BH", "OM"], ["ar", "en", "hi"]),
  ...each(["MA", "DZ", "TN"], ["ar", "fr"]),
  SE: ["sv"],
  NO: ["no"],
  DK: ["da"],
  GL: ["da"],
  FO: ["da"],
  FI: ["fi", "sv"],
};

// The visitor's country decides the language; their browser only picks among the
// languages of that country (Tamil in India, French in Switzerland). Without a known
// country (local development), the browser decides.
export function pickLocale(country: string | null, acceptLanguage: string | null): Locale {
  const preferred = rankLocales(acceptLanguage);
  const spoken = country ? countryLocales[country.toUpperCase()] : undefined;
  if (spoken) return preferred.find((locale) => spoken.includes(locale)) ?? spoken[0];
  return preferred[0] ?? fallbackLocale;
}
