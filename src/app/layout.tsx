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
    "MAXIMUS Food & Horeca, Aarschot (Belçika) merkezli B2B toptan gıda tedarikçisidir. Restoran, fritür ve otellere soslar, et ürünleri, dondurulmuş gıda, ambalaj, içecek ve kuru gıda. Depodan teslimde %15 indirim, WhatsApp ile aynı gün sipariş onayı.",
  keywords: [
    "toptan gıda Aarschot",
    "horeca tedarikçisi Belçika",
    "restoran toptancı",
    "fritür sosları toptan",
    "döner tedarik Belçika",
    "B2B gıda toptancısı",
  ],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: site.name,
    title: `${site.name} | Aarschot Toptan Gıda & Horeca Tedarikçisi`,
    description:
      "Belçika Horeca sektörü için toptan gıda: soslar, et, dondurulmuş, ambalaj, içecek ve kuru gıda. Depodan teslimde %15 indirim.",
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
    openingHours: ["Mo-Fr 07:00-17:00", "Sa 08:00-13:00"],
    areaServed: "Belgium",
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
