import { ArrowRight, Hourglass, IdCard, PlaneLanding, Radar } from "lucide-react";
import { ButtonLink, SectionHeading } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { localizedPath } from "@/lib/paths";

interface AirportTransfersProps {
  locale: Locale;
  dict: Dictionary;
}

/** Sözlükteki üç vaadin sırasıyla simgeleri: isim tabelası, uçuş takibi, bekleme. */
const PROMISE_ICONS = [IdCard, Radar, Hourglass] as const;

/** Havalimanı transferleri: üç vaat ve havalimanları sayfasına bağlantı. */
export function AirportTransfers({ locale, dict }: AirportTransfersProps) {
  return (
    <section aria-labelledby="airport-transfers-title" className="bg-ink py-16 md:py-24">
      <div className="container grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div>
          <SectionHeading
            id="airport-transfers-title"
            eyebrow={dict.airportTransfers.eyebrow}
            title={dict.airportTransfers.title}
            description={dict.airportTransfers.description}
          />
          <ButtonLink href={localizedPath(locale, "airports")} variant="secondary" className="mt-8">
            {dict.airportTransfers.cta}
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </ButtonLink>
        </div>
        <ul role="list" className="divide-y divide-line border-y border-line">
          {dict.airportTransfers.items.map((item, index) => {
            const Icon = PROMISE_ICONS[index] ?? PlaneLanding;
            return (
              <li key={item.title} className="flex gap-5 py-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ink-soft text-taxi">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-paper">{item.title}</h3>
                  <p className="mt-1.5 max-w-prose text-base text-muted">{item.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
