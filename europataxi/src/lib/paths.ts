import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

/** Sayfa yolları. Slug'lar tüm dillerde aynıdır; yalnızca dil öneki değişir. */
export const pagePaths = {
  home: "",
  services: "/hizmetler",
  airports: "/havalimani-transferleri",
  regions: "/bolgeler",
  contact: "/iletisim",
  booking: "/rezervasyon",
  privacy: "/gizlilik-politikasi",
  terms: "/kullanim-kosullari",
} as const;

export type PageKey = keyof typeof pagePaths;

/** Ana sayfadaki rezervasyon widget'ının `id`'si; "Hemen Rezervasyon Yap" buraya kaydırır. */
export const BOOKING_WIDGET_ID = "rezervasyon";

export type QueryValue = string | number | boolean | null | undefined;

export function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** `/tr/rezervasyon?from=...`, `/en#rezervasyon` gibi dil önekli yol üretir. */
export function localizedPath(
  locale: Locale,
  page: PageKey = "home",
  options: { query?: Record<string, QueryValue>; hash?: string } = {},
): string {
  const base = `/${locale}${pagePaths[page]}`;
  const hash = options.hash ? `#${options.hash}` : "";
  return `${base}${buildQuery(options.query)}${hash}`;
}

/** Mevcut yolun (`/tr/hizmetler`) dil önekini değiştirir (`/en/hizmetler`). */
export function switchLocalePath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  const first = segments[1];
  if (isLocale(first)) {
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  }
  return `/${locale}${pathname === "/" ? "" : pathname}`;
}

/** Bir yolun dil önekini döndürür; yoksa varsayılan dil. */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split("/")[1];
  return isLocale(first) ? first : defaultLocale;
}
