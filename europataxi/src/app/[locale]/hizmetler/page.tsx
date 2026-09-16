import { ArrowRight, Briefcase, Check, Globe, Moon, Plane, Route, Users } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/i18n/getDictionary";
import { pageMetadata } from "@/lib/metadata";
import { resolveLocale, type PageProps } from "@/lib/page";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  return pageMetadata({
    locale,
    page: "services",
    title: dict.meta.services.title,
    description: dict.meta.services.description,
    siteName: dict.meta.siteName,
  });
}

/** Sözlükteki altı hizmetin sırasıyla simgeleri: havalimanı, şehirlerarası, uluslararası, kurumsal, grup, gece. */
const SERVICE_ICONS = [Plane, Route, Globe, Briefcase, Users, Moon] as const;

/** Hizmetler sayfası: altı hizmet bloğu ve her transfere dahil olanlar listesi. */
export default async function ServicesPage({ params }: PageProps) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);

  return (
    <>
      <section className="bg-surface py-16 md:py-24">
        <div className="container">
          <SectionHeading
            as="h1"
            level="page"
            eyebrow={dict.servicesPage.eyebrow}
            title={dict.servicesPage.title}
            description={dict.servicesPage.description}
          />
          <ul role="list" className="mt-12 grid gap-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-x-8">
            {dict.servicesPage.items.map((item, index) => {
              const Icon = SERVICE_ICONS[index] ?? Plane;
              return (
                <li key={item.title} className="min-w-0 border-t border-line pt-6">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-surface-2 text-taxi-ink">
                    <Icon aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 break-words text-lg font-bold text-content">{item.title}</h2>
                  <p className="mt-2 max-w-prose text-base text-muted">{item.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="services-included-title" className="bg-surface-2 py-16 md:py-24">
        <div className="container grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <div>
            <SectionHeading id="services-included-title" title={dict.servicesPage.includedTitle} />
            <ButtonLink href={localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID })} className="mt-8">
              {dict.servicesPage.cta}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </ButtonLink>
          </div>
          <ul role="list" className="divide-y divide-line border-y border-line">
            {dict.servicesPage.included.map((entry) => (
              <li key={entry} className="flex items-start gap-4 py-4">
                <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-taxi-ink" />
                <span className="min-w-0 break-words text-base text-content">{entry}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
