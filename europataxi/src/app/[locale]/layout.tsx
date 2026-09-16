import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipLink } from "@/components/layout/SkipLink";
import { countries } from "@/data/locations";
import { localeConfig, locales, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";
import { archivo } from "@/lib/fonts";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { resolveLocale, type LocaleParams } from "@/lib/page";
import { site } from "@/lib/site";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** Varsayılan meta (ana sayfa) ve simgeler; her sayfa kendi `generateMetadata`'sıyla başlık ve açıklamayı ezer. */
export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  return {
    ...pageMetadata({
      locale,
      page: "home",
      title: dict.meta.home.title,
      description: dict.meta.home.description,
      siteName: dict.meta.siteName,
    }),
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  };
}

/** Kuruluş (taksi hizmeti) için yapılandırılmış veri; yalnızca site yapılandırması ve sözlükten beslenir. */
function organizationJsonLd(locale: Locale, dict: Dictionary) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.url}/#organization`,
    additionalType: "https://schema.org/TaxiService",
    name: site.name,
    url: absoluteUrl(locale, "home"),
    logo: `${site.url}/logo.svg`,
    image: `${site.url}/logo.svg`,
    slogan: dict.meta.tagline,
    description: dict.meta.home.description,
    telephone: site.phone.e164,
    email: site.email,
    foundingDate: String(site.foundingYear),
    areaServed: countries.map((code) => ({ "@type": "Country", name: dict.countries[code], identifier: code })),
    knowsLanguage: locales.map((l) => localeConfig[l].hrefLang),
    sameAs: Object.values(site.social),
  };
}

/** `<script>` içine gömülürken `<` kaçırılır; böylece metin HTML olarak yorumlanamaz. */
function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);

  return (
    <html lang={locale}>
      <body className={`${archivo.variable} flex min-h-dvh flex-col`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd(locale, dict)) }} />
        <SkipLink label={dict.common.skipToContent} />
        <Header locale={locale} dict={dict} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} dict={dict} />
      </body>
    </html>
  );
}
