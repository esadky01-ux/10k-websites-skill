import { ArrowRight, Plane } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { airportBookingHref } from "@/components/home/AirportCard";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { countries, locationsByCountry } from "@/data/locations";
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
    page: "regions",
    title: dict.meta.regions.title,
    description: dict.meta.regions.description,
    siteName: dict.meta.siteName,
  });
}

const labelClass = "text-sm font-bold uppercase tracking-[0.18em] text-muted";

/**
 * Hizmet bölgeleri sayfası. Her ülkenin bölümü, ana sayfadaki ülke kartlarının
 * bağlandığı çapayı (`#be`, `#nl`, `#fr`, `#de`) taşır ve zeminler sırayla değişir.
 */
export default async function RegionsPage({ params }: PageProps) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  const widgetHref = localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID });

  return (
    <>
      <section className="bg-surface py-16 md:py-24">
        <div className="container">
          <SectionHeading
            as="h1"
            level="page"
            eyebrow={dict.regionsPage.eyebrow}
            title={dict.regionsPage.title}
            description={dict.regionsPage.description}
          />
        </div>
      </section>

      {countries.map((code, index) => {
        const item = dict.regions.items[code];
        const places = locationsByCountry(code);
        const cities = places.filter((place) => place.type === "city");
        const countryAirports = places.filter((place) => place.type === "airport");
        const titleId = `region-${code.toLowerCase()}-title`;

        return (
          <section
            key={code}
            id={code.toLowerCase()}
            aria-labelledby={titleId}
            className={`scroll-mt-24 py-16 md:py-24 ${index % 2 === 0 ? "bg-surface-2" : "bg-surface"}`}
          >
            <div className="container grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
              <SectionHeading id={titleId} title={item.title} description={item.description} />
              <div className="min-w-0">
                <h3 className={labelClass}>{dict.regions.citiesLabel}</h3>
                <ul role="list" className="mt-4 flex flex-wrap gap-2">
                  {cities.map((city) => (
                    <li key={city.id} className="rounded-md border border-line px-3 py-1.5 text-sm text-content">
                      {resolveKey(dict, city.name)}
                    </li>
                  ))}
                </ul>

                <h3 className={`${labelClass} mt-10`}>{dict.regions.airportsLabel}</h3>
                <ul role="list" className="mt-3 divide-y divide-line border-y border-line">
                  {countryAirports.map((airport) => {
                    const name = resolveKey(dict, airport.name);
                    return (
                      <li key={airport.id}>
                        <Link
                          href={airportBookingHref(locale, airport.id)}
                          aria-label={fill(dict.airportsPage.selectAirport, { name })}
                          className="group flex min-h-14 items-center gap-3 py-3 text-base text-content transition-colors motion-reduce:transition-none hover:text-taxi-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink"
                        >
                          <Plane aria-hidden="true" className="h-5 w-5 shrink-0 text-taxi-ink" />
                          <span className="min-w-0 break-words font-bold">{name}</span>
                          <ArrowRight
                            aria-hidden="true"
                            className="ml-auto h-5 w-5 shrink-0 text-taxi-ink motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        );
      })}

      <section className="bg-surface-2 py-16 md:py-24">
        <div className="container flex flex-col items-start gap-4 border-t border-line pt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          <ButtonLink href={widgetHref} size="lg">
            {dict.regionsPage.cta}
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </ButtonLink>
          <ButtonLink href={localizedPath(locale, "contact")} variant="secondary" size="lg">
            {dict.regionsPage.contactCta}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
