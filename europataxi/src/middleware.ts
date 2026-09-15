import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";

/**
 * Dil öneki olmayan her isteği varsayılan dile yönlendirir: `/` → `/tr`,
 * `/hizmetler` → `/tr/hizmetler`. API, statik dosyalar ve Next iç yolları hariç.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|logo.svg|robots.txt|sitemap.xml|.*\\..*).*)"],
};
