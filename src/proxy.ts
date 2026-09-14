import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, folderForSlug, isLocale, locales } from "@/i18n/config";

/**
 * Dil yönlendirmesi:
 *  - /            → /nl (dahili yeniden yazım, URL değişmez)
 *  - /bestellen   → /nl/bestellen
 *  - /tr/siparis  → /tr/bestellen (Türkçe URL parçası Hollandaca klasöre eşlenir)
 *  - /nl/...      → 308 → /... (tek kanonik URL)
 *  - /siparis     → 308 → /tr/siparis (eski bağlantılar)
 *
 * Ayrıca kategori filtresindeki eski Türkçe slug'lar yeni Felemenkçe slug'lara 308 ile taşınır:
 *  - /bestellen?categorie=soslar → /bestellen?categorie=sauzen
 * Böylece dizindeki, bloglardaki ve müşteride kayıtlı eski bağlantılar çalışmaya devam eder.
 */
const LEGACY_TR: Record<string, string> = { siparis: "/tr/siparis" };

/** Eski kategori slug'ı → yeni slug (2026-09 Felemenkçeleştirme). */
const LEGACY_CATEGORY: Record<string, string> = {
  soslar: "sauzen",
  "et-urunleri": "vlees-doner",
  dondurulmus: "diepvries",
  konserve: "conserven",
  "peynir-sut": "kaas-zuivel",
  "ekmek-hamur": "brood-deeg",
  "kuru-gida": "droge-voeding",
  icecekler: "dranken",
};
const CATEGORY_PARAMS = ["categorie", "kategori", "category"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/media") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Eski kategori slug'ıyla gelen bağlantıları yeni slug'a taşı (dil ve rota fark etmez)
  for (const key of CATEGORY_PARAMS) {
    const value = request.nextUrl.searchParams.get(key);
    const next = value ? LEGACY_CATEGORY[value] : undefined;
    if (next) {
      const url = request.nextUrl.clone();
      url.searchParams.set(key, next);
      return NextResponse.redirect(url, 308);
    }
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  // /nl/... → kanonik köke yönlendir
  if (first === defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = "/" + segments.slice(1).join("/");
    return NextResponse.redirect(url, 308);
  }

  // Eski Türkçe kök bağlantılar
  if (first && LEGACY_TR[first]) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_TR[first] + (segments.length > 1 ? "/" + segments.slice(1).join("/") : "");
    return NextResponse.redirect(url, 308);
  }

  if (isLocale(first) && first !== defaultLocale) {
    // Türkçe URL parçasını klasör adına çevir
    const rest = [...segments.slice(1)];
    if (rest[0]) rest[0] = folderForSlug(first, rest[0]);
    const url = request.nextUrl.clone();
    url.pathname = `/${first}/${rest.join("/")}`.replace(/\/$/, "") || `/${first}`;
    return NextResponse.rewrite(url);
  }

  // Varsayılan dil: dahili olarak /nl önekiyle sun
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`.replace(/\/$/, "");
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Kullanılmayan içe aktarmayı tip düzeyinde koru
void locales;
