import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import CartDrawer from "@/components/CartDrawer";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Aarschot Toptan Gıda & Horeca Tedarikçisi`,
    template: `%s | ${site.name}`,
  },
  description:
    "Maximus Food & Horeca: Quality Food. Trusted Partner. Aarschot (Belçika) merkezli B2B toptan gıda tedarikçisi. Döner, pizza, fritür ve restoranlara soslar, et, dondurulmuş gıda, konserve, ambalaj, içecek ve hijyen ürünleri. Belçika & Hollanda teslimat, depodan teslimde %15 indirim.",
  keywords: [
    "toptan gıda Aarschot",
    "horeca tedarikçisi Belçika",
    "restoran toptancı",
    "fritür sosları toptan",
    "döner tedarik Belçika",
    "pizza malzemeleri toptan",
    "Pauwels sos toptan",
    "B2B gıda toptancısı",
  ],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: site.name,
    title: `${site.name} | Aarschot Toptan Gıda & Horeca Tedarikçisi`,
    description:
      "Quality Food. Trusted Partner. Döner ve pizza malzemelerinde uzman toptan gıda tedarikçisi. Belçika & Hollanda teslimat, depodan teslimde %15 indirim.",
    images: [{ url: "/media/hero/hero-warehouse.jpg", width: 1920, height: 1071, alt: "MAXIMUS Food & Horeca deposu" }],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "WholesaleStore",
    name: site.name,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      postalCode: site.address.postal,
      addressLocality: site.address.city,
      addressCountry: "BE",
    },
    foundingDate: String(site.founded),
    slogan: site.tagline,
    logo: `${site.url}/logo-badge.jpg`,
    openingHours: ["Mo-Fr 08:00-17:00", "Sa 09:00-13:00"],
    areaServed: ["Belgium", "Netherlands"],
  };

  return (
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
