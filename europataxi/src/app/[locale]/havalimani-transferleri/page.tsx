import { ArrowRight, Hourglass, IdCard, PlaneLanding, Radar } from "lucide-react";
import type { Metadata } from "next";
import { AirportCard } from "@/components/home/AirportCard";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { airports, countries } from "@/data/locations";
import { getDictionary } from "@/i18n/getDictionary";
import { fill, resolveKey } from "@/i18n/utils";
import { pageMetadata } from "@/lib/metadata";
import { resolveLocale, type PageProps } from "@/lib/page";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  return pageMetadata({
    locale,
    page: "airports",
    title: dict.meta.airports.title,
    description: dict.meta.airports.description,
    siteName: dict.meta.siteName,
  });
}

/** Sözlükteki üç vaadin sırasıyla simgeleri: isim tabelası, uçuş takibi, bekleme. */
const PROMISE_ICONS = [IdCard, Radar, Hourglass] as const;

/** Havalimanı transferleri sayfası: vaatler, havalimanı kartları ve karşılama adımları. */
export default async function AirportsPage({ params }: PageProps) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);

  /** Havalimanları ülke sırasına göre gruplanır; boş ülke bloğu basılmaz. */
  const all = airports();
  const groups = countries
    .map((code) => ({ code, items: all.filter((airport) => airport.country === code) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <section className="bg-surface py-16 md:py-24">
        <div className="container">
          <SectionHeading
            as="h1"
            level="page"
            eyebrow={dict.airportsPage.eyebrow}
            title={dict.airportsPage.title}
            description={dict.airportsPage.description}
          />
          <ul role="list" className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-16">
            {dict.airportTransfers.items.map((item, index) => {
              const Icon = PROMISE_ICONS[index] ?? PlaneLanding;
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

      <section aria-labelledby="airports-list-title" className="bg-surface-2 py-16 md:py-24">
        <div className="container">
          <SectionHeading
            id="airports-list-title"
            title={dict.airportsPage.airportsTitle}
            description={dict.airportsPage.airportsDescription}
          />
          <div className="mt-12 space-y-12">
            {groups.map((group) => (
              <div key={group.code}>
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted">{dict.countries[group.code]}</h3>
                <ul role="list" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((airport) => {
                    const name = resolveKey(dict, airport.name);
                    return (
                      <li key={airport.id} className="min-w-0">
                        <AirportCard
                          locale={locale}
                          airport={airport}
                          name={name}
                          country={dict.countries[group.code]}
                          ariaLabel={fill(dict.airportsPage.selectAirport, { name })}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="airports-meet-title" className="bg-surface py-16 md:py-24">
        <div className="container grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <div>
            <SectionHeading id="airports-meet-title" title={dict.airportsPage.meetTitle} />
            <ButtonLink href={localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID })} className="mt-8">
              {dict.airportsPage.cta}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </ButtonLink>
          </div>
          <ol role="list">
            {dict.airportsPage.meet.map((step, index) => (
              <li
                key={step.title}
                className="relative flex gap-6 pb-10 before:absolute before:bottom-0 before:left-6 before:top-12 before:w-px before:bg-taxi before:content-[''] last:pb-0 last:before:hidden"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-taxi text-base font-extrabold tabular-nums text-on-taxi ring-8 ring-surface"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 pt-2.5">
                  <h3 className="break-words text-lg font-bold text-content">{step.title}</h3>
                  <p className="mt-1.5 max-w-prose text-base text-muted">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
