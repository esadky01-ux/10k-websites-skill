import type { MetadataRoute } from "next";
import { defaultLocale, localeConfig, locales } from "@/i18n/config";
import { absoluteUrl } from "@/lib/metadata";
import { pagePaths, type PageKey } from "@/lib/paths";

/** Rezervasyon sayfası yalnızca geçerli parametrelerle anlamlı olduğu için haritaya girmez. */
const excluded: PageKey[] = ["booking"];

const indexablePages = (Object.keys(pagePaths) as PageKey[]).filter((page) => !excluded.includes(page));

/** Sayfanın tüm dillerdeki karşılıkları; hreflang etiketleriyle aynı adresler. */
function alternateLanguages(page: PageKey): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[localeConfig[locale].hrefLang] = absoluteUrl(locale, page);
  languages["x-default"] = absoluteUrl(defaultLocale, page);
  return languages;
}

/** Her dil için her sayfa; ana sayfa en yüksek öncelikte. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return locales.flatMap((locale) =>
    indexablePages.map((page) => ({
      url: absoluteUrl(locale, page),
      lastModified,
      changeFrequency: page === "home" ? ("weekly" as const) : ("monthly" as const),
      priority: page === "home" ? 1 : 0.7,
      alternates: { languages: alternateLanguages(page) },
    })),
  );
}
