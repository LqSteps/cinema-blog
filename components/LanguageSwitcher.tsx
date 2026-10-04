"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, localeNames, locales, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function change(next: Locale) {
    // Remember the choice so locale-free links (from YouTube) honor it next time.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const rest = pathname.split("/").slice(2).join("/");
    router.push(`/${next}${rest ? `/${rest}` : ""}`);
  }

  return (
    <label className="lang">
      <span className="visually-hidden">{label}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
        />
      </svg>
      <select value={current} onChange={(e) => change(e.target.value as Locale)}>
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
