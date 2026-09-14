import type { Metadata } from "next";
import { site } from "@/lib/site";
import { contentLocale, contentLocales, defaultLocale, htmlLang, isContentLocale, locales, localePath, type Locale, type RouteKey } from "@/i18n/config";

/**
 * Sayfanın içerik kapsamı:
 *  - "ui"      → metni sözlükten gelen, gerçekten her dilde yazılmış sayfa (ana sayfa, sipariş, bölge dizini, hesap).
 *                Beş dilin hepsi hreflang'de listelenir ve dizine girer.
 *  - "content" → uzun metni yalnızca Hollandaca ve Türkçe yazılmış sayfa (bölge detayları, blog yazıları).
 *                Diğer dillerde sayfa yine açılır ama canonical asıl dile bakar ve sayfa dizine girmez;
 *                makine çevirisi kopya/ince içerik cezası doğurmasın diye.
 */
export type SeoScope = "ui" | "content";

export function alternatesFor(lang: Locale, route?: RouteKey, rest?: string, query?: string, scope: SeoScope = "ui"): NonNullable<Metadata["alternates"]> {
  const list: readonly Locale[] = scope === "content" ? contentLocales : locales;
  const languages: Record<string, string> = {};
  for (const l of list) languages[htmlLang[l]] = localePath(l, route, rest, query);
  languages["x-default"] = localePath(defaultLocale, route, rest, query);
  const self = scope === "content" && !isContentLocale(lang) ? contentLocale[lang] : lang;
  return { canonical: localePath(self, route, rest, query), languages };
}

/** Çevirisi olmayan dilde gösterilen uzun içerik sayfaları dizine girmez. */
export function robotsFor(lang: Locale, scope: SeoScope = "ui"): Metadata["robots"] {
  return scope === "content" && !isContentLocale(lang) ? { index: false, follow: true } : { index: true, follow: true };
}

export function absoluteUrl(path: string): string {
  return `${site.url}${path === "/" ? "" : path}`;
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
