import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { pageMetadata } from "@/lib/metadata";
import { resolveLocale, type PageProps } from "@/lib/page";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  return pageMetadata({
    locale,
    page: "terms",
    title: dict.meta.terms.title,
    description: dict.meta.terms.description,
    siteName: dict.meta.siteName,
  });
}

/** Kullanım koşulları: tek sütun, okunabilir satır uzunluğu. */
export default async function TermsPage({ params }: PageProps) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  const page = dict.legal.terms;

  return (
    <section className="container py-16 md:py-24">
      <div className="max-w-prose">
        <h1 className="text-2xl font-extrabold tracking-tight text-paper md:text-3xl">{page.title}</h1>
        <p className="mt-4 text-sm text-muted">{dict.legal.lastUpdated}</p>
        <p className="mt-6 text-base text-muted md:text-lg">{page.intro}</p>
        <div className="mt-12 space-y-10 border-t border-line pt-10">
          {page.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="break-words text-lg font-bold text-paper">{section.heading}</h2>
              <p className="mt-3 text-base text-muted">{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
