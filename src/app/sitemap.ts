import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { categories } from "@/data/categories";
import { regions } from "@/data/regions";
import { getPosts } from "@/data/blog";
import { localePath, locales } from "@/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const abs = (p: string) => `${site.url}${p === "/" ? "" : p}`;
  const entries: MetadataRoute.Sitemap = [];
  for (const lang of locales) {
    const alt = (route?: Parameters<typeof localePath>[1], rest?: string, q?: string) => ({
      languages: { "nl-BE": abs(localePath("nl", route, rest, q)), tr: abs(localePath("tr", route, rest, q)) },
    });
    entries.push({ url: abs(localePath(lang)), lastModified: now, changeFrequency: "weekly", priority: lang === "nl" ? 1 : 0.8, alternates: alt() });
    entries.push({ url: abs(localePath(lang, "order")), lastModified: now, changeFrequency: "weekly", priority: 0.9, alternates: alt("order") });
    for (const c of categories) {
      const q = `${lang === "nl" ? "categorie" : "kategori"}=${c.slug}`;
      entries.push({ url: abs(localePath(lang, "order", undefined, q)), lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    }
    entries.push({ url: abs(localePath(lang, "regions")), lastModified: now, changeFrequency: "monthly", priority: 0.8, alternates: alt("regions") });
    for (const r of regions) {
      entries.push({ url: abs(localePath(lang, "regions", r.slug)), lastModified: now, changeFrequency: "monthly", priority: lang === "nl" ? 0.8 : 0.6, alternates: alt("regions", r.slug) });
    }
    entries.push({ url: abs(localePath(lang, "blog")), lastModified: now, changeFrequency: "weekly", priority: 0.7, alternates: alt("blog") });
    for (const p of getPosts(lang)) {
      entries.push({ url: abs(localePath(lang, "blog", p.slug)), lastModified: new Date(p.updated ?? p.date), changeFrequency: "monthly", priority: 0.6 });
    }
  }
  return entries;
}
