import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, canonicalLocale, isLocale, pickLocale } from "@/lib/i18n";

// Links in YouTube descriptions point at locale-free paths such as /m/interestelar.
// Send each visitor to the same page in their language: an explicit choice made
// with the language switcher (cookie) wins, then the visitor's country.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, first, ...rest] = pathname.split("/");
  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.search = search;

  // /pt-pt/... -> /pt-PT/...
  const canonical = first ? canonicalLocale(first) : null;
  if (canonical) {
    url.pathname = `/${[canonical, ...rest].join("/")}`;
    return NextResponse.redirect(url, 308);
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  // Vercel geolocates every request into this header (what @vercel/functions' geolocation() reads).
  const country = request.headers.get("x-vercel-ip-country");
  const locale = isLocale(cookie) ? cookie : pickLocale(country, request.headers.get("accept-language"));

  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(url, 307);
  // The redirect target depends on these headers; keep caches from sharing it.
  response.headers.set("Vary", "Accept-Language, Cookie, X-Vercel-IP-Country");
  return response;
}

export const config = {
  // Skip Next internals, API routes and anything that looks like a file.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
