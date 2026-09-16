import type { Metadata } from "next";
import { defaultLocale, localeConfig, locales, type Locale } from "@/i18n/config";
import { pagePaths, type PageKey } from "./paths";
import { site } from "./site";

interface PageMetadataInput {
  locale: Locale;
  page: PageKey;
  title: string;
  description: string;
  siteName: string;
  /** Sayfa arama motorlarına kapatılacaksa (ör. rezervasyon adımı). */
  noIndex?: boolean;
}

export function absoluteUrl(locale: Locale, page: PageKey): string {
  return `${site.url}/${locale}${pagePaths[page]}`;
}

/** Dile göre başlık/açıklama, canonical, hreflang alternatifleri ve Open Graph etiketleri. */
export function pageMetadata({ locale, page, title, description, siteName, noIndex }: PageMetadataInput): Metadata {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeConfig[l].hrefLang] = absoluteUrl(l, page);
  languages["x-default"] = absoluteUrl(defaultLocale, page);
  const url = absoluteUrl(locale, page);

  return {
    metadataBase: new URL(site.url),
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url,
      locale: localeConfig[locale].intl.replace("-", "_"),
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeConfig[l].intl.replace("-", "_")),
    },
    // `openGraph.images` ve `twitter.images` bilerek yazılmaz: Next, aynı segmentteki
    // `opengraph-image.tsx` dosyasından üretilen görseli her iki etikete de kendisi ekler.
    twitter: { card: "summary_large_image", title, description },
    robots: noIndex ? { index: false, follow: true } : undefined,
  };
}
