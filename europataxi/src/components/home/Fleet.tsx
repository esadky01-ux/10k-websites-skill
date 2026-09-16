import { Briefcase, Check, Users } from "lucide-react";
import { SectionHeading } from "@/components/ui";
import { fleet } from "@/data/fleet";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill, resolveKey } from "@/i18n/utils";
import { FleetSelectButton } from "./FleetSelectButton";
import { VehicleSilhouette } from "./VehicleSilhouette";

interface FleetProps {
  locale: Locale;
  dict: Dictionary;
}

/** Araç filosu: üç paralel kart (siluet, model, kapasite, öne çıkanlar, seçim butonu). */
export function Fleet({ dict }: FleetProps) {
  return (
    <section aria-labelledby="fleet-title" className="bg-ink-soft py-16 md:py-24">
      <div className="container">
        <SectionHeading id="fleet-title" eyebrow={dict.fleet.eyebrow} title={dict.fleet.title} description={dict.fleet.description} />
        <ul role="list" className="mt-12 grid gap-6 lg:grid-cols-3">
          {fleet.map((vehicle) => {
            const name = resolveKey(dict, vehicle.name);
            const featuresId = `fleet-${vehicle.id}-features`;
            return (
              <li key={vehicle.id} className="flex flex-col rounded-lg border border-line bg-ink p-6 shadow-card md:p-8">
                <VehicleSilhouette id={vehicle.id} className="h-20 w-auto text-taxi" />
                <h3 className="mt-6 text-lg font-bold text-paper">{name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {dict.fleet.modelLabel}: {resolveKey(dict, vehicle.model)}
                </p>
                <p className="mt-3 text-base text-muted">{resolveKey(dict, vehicle.description)}</p>
                <ul role="list" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-paper">
                  <li className="inline-flex items-center gap-2">
                    <Users aria-hidden="true" className="h-4 w-4 text-taxi" />
                    {fill(dict.fleet.capacity, { min: vehicle.passengers.min, max: vehicle.passengers.max })}
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <Briefcase aria-hidden="true" className="h-4 w-4 text-taxi" />
                    {fill(dict.fleet.luggage, { count: vehicle.luggage })}
                  </li>
                </ul>
                <p id={featuresId} className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">
                  {dict.fleet.featuresLabel}
                </p>
                <ul role="list" aria-labelledby={featuresId} className="mt-2 space-y-2">
                  {vehicle.features.map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm text-paper">
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-taxi" />
                      <span>{resolveKey(dict, key)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <FleetSelectButton id={vehicle.id} label={dict.fleet.select} ariaLabel={fill(dict.fleet.selectAria, { name })} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
