import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import CartDrawer from "@/components/CartDrawer";
import VoiceAgent from "@/components/VoiceAgent";
import VoiceAgentBoundary from "@/components/VoiceAgentBoundary";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getDictionary, htmlLang, isLocale, locales, ogLocale, type Locale } from "@/i18n";
import { site } from "@/lib/site";
import { alternatesFor, jsonLd } from "@/lib/seo";

type Params = Promise<{ lang: string }>;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).meta;
  return {
    metadataBase: new URL(site.url),
    title: { default: t.siteTitle, template: `%s | ${site.name}` },
    description: t.siteDescription,
    keywords: t.keywords,
    alternates: alternatesFor(lang),
    openGraph: {
      type: "website",
      locale: ogLocale[lang],
      alternateLocale: lang === "nl" ? ["tr_TR"] : ["nl_BE"],
      siteName: site.name,
      title: t.siteTitle,
      description: t.ogDescription,
      images: [{ url: "/media/hero/hero-warehouse.jpg", width: 1920, height: 1086, alt: "Maximus Food & Horeca" }],
    },
    robots: { index: true, follow: true },
    // Chrome/Google Translate sayfayı çevirmesin: çeviri DOM'u değiştirir ve React (insertBefore) hatası verir.
    // Site zaten Türkçe ve Felemenkçe sunulur; dil değiştirici kullanılmalı.
    other: { google: "notranslate" },
  };
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { lang: raw } = await params;
  if (!isLocale(raw)) notFound();
  const lang = raw;
  const t = getDictionary(lang);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": ["WholesaleStore", "LocalBusiness"],
    "@id": `${site.url}/#organization`,
    name: site.name,
    url: site.url,
    logo: `${site.url}/logo-badge.jpg`,
    image: `${site.url}/media/hero/hero-warehouse.jpg`,
    telephone: site.phone,
    email: site.email,
    slogan: site.tagline,
    foundingDate: String(site.founded),
    priceRange: "€€",
    address: { "@type": "PostalAddress", streetAddress: site.address.street, postalCode: site.address.postal, addressLocality: site.address.city, addressRegion: "Vlaams-Brabant", addressCountry: "BE" },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "09:00", closes: "13:00" },
    ],
    areaServed: [{ "@type": "Country", name: "Belgium" }, { "@type": "Country", name: "Netherlands" }],
    sameAs: [`https://wa.me/${site.whatsapp}`],
  };

  return (
    <html lang={htmlLang[lang]} translate="no" className="notranslate h-full antialiased">
      <body className="flex min-h-full flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(orgJsonLd) }} />
        <I18nProvider lang={lang} t={t}>
          <AuthProvider>
            <CartProvider>
              <Header lang={lang} />
              <main className="flex-1">{children}</main>
              <Footer lang={lang} />
              <CartDrawer />
              <VoiceAgentBoundary label={t.voice.unavailable} retry={t.voice.retry}>
                <VoiceAgent />
              </VoiceAgentBoundary>
            </CartProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
