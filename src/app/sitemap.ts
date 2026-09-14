import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { categories } from "@/data/categories";
import { categoryParam } from "@/components/CategoryGrid";
import { regions } from "@/data/regions";
import { getPosts } from "@/data/blog";
import { contentLocales, htmlLang, localePath, locales, type Locale } from "@/i18n/config";

/**
 * Site haritası.
 * Arayüz sayfaları (ana sayfa, sipariş, bölge dizini) beş dilde listelenir.
 * Uzun içerik sayfaları (bölge detayları, blog yazıları) yalnızca yazıldıkları dillerde
 * (Hollandaca, Türkçe) listelenir; diğer dillerdeki karşılıkları noindex olduğu için haritaya girmez.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const abs = (p: string) => `${site.url}${p === "/" ? "" : p}`;
  const entries: MetadataRoute.Sitemap = [];
  const altOf = (list: readonly Locale[]) => (route?: Parameters<typeof localePath>[1], rest?: string, q?: string) => ({
    languages: Object.fromEntries(list.map((l) => [htmlLang[l], abs(localePath(l, route, rest, q))])),
  });
  const uiAlt = altOf(locales);
  const contentAlt = altOf(contentLocales);

  for (const lang of locales) {
    const home = lang === "nl" ? 1 : 0.8;
    entries.push({ url: abs(localePath(lang)), lastModified: now, changeFrequency: "weekly", priority: home, alternates: uiAlt() });
    entries.push({ url: abs(localePath(lang, "order")), lastModified: now, changeFrequency: "weekly", priority: 0.9, alternates: uiAlt("order") });
    for (const c of categories) {
      entries.push({ url: abs(localePath(lang, "order", undefined, `${categoryParam[lang]}=${c.slug}`)), lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    }
    entries.push({ url: abs(localePath(lang, "regions")), lastModified: now, changeFrequency: "monthly", priority: 0.8, alternates: uiAlt("regions") });
  }

  for (const lang of contentLocales) {
    for (const r of regions) {
      entries.push({ url: abs(localePath(lang, "regions", r.slug)), lastModified: now, changeFrequency: "monthly", priority: lang === "nl" ? 0.8 : 0.6, alternates: contentAlt("regions", r.slug) });
    }
    entries.push({ url: abs(localePath(lang, "blog")), lastModified: now, changeFrequency: "weekly", priority: 0.7, alternates: contentAlt("blog") });
    for (const p of getPosts(lang)) {
      entries.push({ url: abs(localePath(lang, "blog", p.slug)), lastModified: new Date(p.updated ?? p.date), changeFrequency: "monthly", priority: 0.6 });
    }
  }
  return entries;
}
