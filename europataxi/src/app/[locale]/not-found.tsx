import type { Metadata } from "next";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import type { LocaleParams } from "@/lib/page";
import { localizedPath } from "@/lib/paths";

/** Next, not-found sınırının `generateMetadata`'sına düzen parametrelerini geçirir; başlık dile göre gelir. */
export async function generateMetadata({ params }: { params?: LocaleParams }): Promise<Metadata> {
  const raw = params ? (await params).locale : undefined;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = await getDictionary(locale);
  return {
    title: dict.meta.notFound.title,
    description: dict.meta.notFound.description,
    robots: { index: false, follow: false },
    // Düzenden miras kalan ana sayfa canonical'ı, hreflang kümesi ve OG etiketleri
    // burada temizlenir; yoksa 404 kendini ana sayfa olarak işaretler (soft 404).
    alternates: { canonical: null, languages: {} },
    // `openGraph` bir bütün olarak ezilir; `url` yazılmadığı için ana sayfanın og:url'i taşınmaz.
    openGraph: { title: dict.meta.notFound.title, description: dict.meta.notFound.description },
  };
}

/**
 * 404 sayfası. `not-found` bileşeni Next'te parametre almadığından metin varsayılan dilden gelir;
 * EN/FR sözlükleri şimdilik Türkçeye düştüğü için görünür bir fark yoktur.
 */
export default async function NotFoundPage() {
  const dict = await getDictionary(defaultLocale);
  return (
    <section className="container flex flex-col items-start gap-8 py-16 md:py-24">
      <SectionHeading as="h1" level="page" eyebrow="404" title={dict.notFound.title} description={dict.notFound.description} />
      <ButtonLink href={localizedPath(defaultLocale)}>{dict.notFound.home}</ButtonLink>
    </section>
  );
}
