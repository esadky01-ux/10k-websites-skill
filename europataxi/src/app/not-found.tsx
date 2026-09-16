import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipLink } from "@/components/layout/SkipLink";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { archivo } from "@/lib/fonts";
import { localizedPath } from "@/lib/paths";
import "./globals.css";

/**
 * Kök 404. Nokta içeren yollar (`/dosya.txt`) middleware eşleşmesinin dışında kaldığı için
 * dil önekli düzene hiç girmez; bu sayfa o istekleri eksiksiz bir HTML belgesiyle karşılar.
 * Dil önekli yolların 404'ü `src/app/[locale]/not-found.tsx` sayfasıdır.
 */
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(defaultLocale);
  return {
    title: dict.meta.notFound.title,
    description: dict.meta.notFound.description,
    robots: { index: false, follow: false },
  };
}

export default async function RootNotFound() {
  const dict = await getDictionary(defaultLocale);
  return (
    <html lang={defaultLocale}>
      <body className={`${archivo.variable} flex min-h-dvh flex-col`}>
        <SkipLink label={dict.common.skipToContent} />
        <Header locale={defaultLocale} dict={dict} />
        <main id="main" className="flex-1">
          <section className="container flex flex-col items-start gap-8 py-16 md:py-24">
            <SectionHeading as="h1" level="page" eyebrow="404" title={dict.notFound.title} description={dict.notFound.description} />
            <ButtonLink href={localizedPath(defaultLocale)}>{dict.notFound.home}</ButtonLink>
          </section>
        </main>
        <Footer locale={defaultLocale} dict={dict} />
      </body>
    </html>
  );
}
