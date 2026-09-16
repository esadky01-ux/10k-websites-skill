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
 * Eşleşmeyen tüm yolların 404 sayfası (`/tr/olmayan-sayfa`, `/en/nope`, `/tr/a/b/c`).
 * Kök düzen bilerek geçirgen olduğundan `<html>` ve `<body>` burada kurulur.
 *
 * Bu sayfa bilinçli olarak yakalayıcı bir rota (`[...rest]/page.tsx`) yerine Next'in
 * kendi 404 yolunu kullanır: `notFound()` çağrısı belgeyi akışa alır ve header/footer
 * ilk HTML'de görünmezdi. Metin varsayılan dilden gelir; EN/FR zaten Türkçeye düştüğü
 * için görünür fark yoktur.
 *
 * Tek istisna: uzantı içeren yollar (`/dosya.txt`) middleware eşleşmesinin dışındadır ve
 * Next'in sade 404 kabuğuna düşer. Durum kodu yine 404'tür; bu adresler sayfa değil
 * dosya isteğidir.
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
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
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
