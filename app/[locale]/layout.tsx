import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { isLocale, locales } from "@/lib/i18n";
import { getMessages } from "@/lib/messages";
import "../globals.css";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = getMessages(isLocale(locale) ? locale : "pt");
  return {
    title: { default: t.siteName, template: `%s · ${t.siteName}` },
    description: t.tagline,
    // Not meant to be found through search: visitors arrive from YouTube links.
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  };
}

export const viewport: Viewport = { themeColor: "#0c0b0a", colorScheme: "dark" };

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  return (
    <html lang={locale}>
      <body>
        <header className="site-header">
          <div className="wrap site-header-inner">
            <Link href={`/${locale}`} className="brand">
              <span className="brand-mark" aria-hidden="true" />
              {t.siteName}
            </Link>
            <LanguageSwitcher current={locale} label={t.language} />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <p>
              <strong>{t.siteName}</strong> · {t.footer}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
