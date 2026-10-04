import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, negotiateLocale } from "@/lib/i18n";

// Links in YouTube descriptions point at locale-free paths such as /m/interestelar.
// Send each visitor to the same page in their language: an explicit choice made
// with the language switcher (cookie) wins over the browser's Accept-Language.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie)
    ? cookie
    : negotiateLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  const response = NextResponse.redirect(url, 307);
  // The redirect target depends on these headers; keep caches from sharing it.
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // Skip Next internals, API routes and anything that looks like a file.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
