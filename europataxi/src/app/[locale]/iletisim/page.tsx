import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactInfo } from "@/components/contact/ContactInfo";
import { SectionHeading } from "@/components/ui";
import { getDictionary } from "@/i18n/getDictionary";
import { pageMetadata } from "@/lib/metadata";
import { resolveLocale, type PageProps } from "@/lib/page";
import { site } from "@/lib/site";

/** Formun erişilebilir adı sayfa başlığından gelir. */
const TITLE_ID = "contact-title";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  return pageMetadata({
    locale,
    page: "contact",
    title: dict.meta.contact.title,
    description: dict.meta.contact.description,
    siteName: dict.meta.siteName,
  });
}

/** İletişim sayfası: solda doğrudan iletişim bilgileri, sağda (lg) form. */
export default async function ContactPage({ params }: PageProps) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);

  return (
    <section className="container py-16 md:py-24">
      <SectionHeading
        as="h1"
        level="page"
        id={TITLE_ID}
        eyebrow={dict.contact.eyebrow}
        title={dict.contact.title}
        description={dict.contact.description}
      />
      <div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <ContactInfo dict={dict} />
        <div className="rounded-lg border border-line bg-surface-2 p-5 sm:p-8">
          <ContactForm
            locale={locale}
            dict={{ contact: dict.contact, validation: dict.validation, common: dict.common }}
            phoneDisplay={site.phone.display}
            phoneHref={site.phone.href}
            ariaLabelledBy={TITLE_ID}
          />
        </div>
      </div>
    </section>
  );
}
