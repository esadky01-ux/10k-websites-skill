import { ArrowRight, Plane } from "lucide-react";
import Link from "next/link";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { countries, locationsByCountry } from "@/data/locations";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill, resolveKey } from "@/i18n/utils";
import { localizedPath } from "@/lib/paths";

interface CountriesProps {
  locale: Locale;
  dict: Dictionary;
}

/** Dört ülke bloğu: açıklama, hizmet verilen şehirler ve havalimanları, bölgeler sayfasına bağlantı. */
export function Countries({ locale, dict }: CountriesProps) {
  return (
    <section aria-labelledby="countries-title" className="bg-surface-2 py-16 md:py-24">
      <div className="container">
        <SectionHeading id="countries-title" eyebrow={dict.regions.eyebrow} title={dict.regions.title} description={dict.regions.description} />
        <ul role="list" className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
          {countries.map((code) => {
            const item = dict.regions.items[code];
            const places = locationsByCountry(code);
            const cities = places.filter((place) => place.type === "city");
            const airports = places.filter((place) => place.type === "airport");
            return (
              <li key={code} className="flex min-w-0 flex-col bg-surface-2 p-6">
                <h3 className="text-lg font-bold text-content">{item.title}</h3>
                <p className="mt-2 text-base text-muted">{item.description}</p>

                <h4 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">{dict.regions.citiesLabel}</h4>
                <ul role="list" className="mt-2 flex flex-wrap gap-2">
                  {cities.map((city) => (
                    <li key={city.id} className="rounded-md border border-line px-2.5 py-1 text-sm text-content">
                      {resolveKey(dict, city.name)}
                    </li>
                  ))}
                </ul>

                <h4 className="mt-5 text-sm font-bold uppercase tracking-wide text-muted">{dict.regions.airportsLabel}</h4>
                <ul role="list" className="mt-2 space-y-1.5">
                  {airports.map((airport) => (
                    <li key={airport.id} className="flex items-start gap-2 text-sm text-content">
                      <Plane aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-taxi-ink" />
                      <span className="break-words">{resolveKey(dict, airport.name)}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={localizedPath(locale, "regions", { hash: code.toLowerCase() })}
                  className="mt-auto inline-flex items-center gap-1.5 self-start rounded-sm pt-6 text-sm font-bold text-taxi-ink hover:text-taxi-dark"
                >
                  {fill(dict.regions.viewCountry, { country: item.title })}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-8">
          <ButtonLink href={localizedPath(locale, "regions")} variant="secondary">
            {dict.regions.viewAll}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
