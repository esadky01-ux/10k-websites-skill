import { SectionHeading } from "@/components/ui";
import { locations } from "@/data/locations";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { BookingWidget, type BookingWidgetDict } from "./BookingWidget";
import { TrustBar } from "./TrustBar";

interface HeroProps {
  locale: Locale;
  dict: Dictionary;
  /** Sunucuda `todayISO(SERVICE_TIME_ZONE)` ile hesaplanan bugünün tarihi. */
  today: string;
}

/**
 * Hero: masaüstünde widget solda, başlık ve güven göstergeleri sağda; mobilde
 * önce başlık, altında widget. DOM sırası her zaman başlık → widget'tır.
 */
export function Hero({ locale, dict, today }: HeroProps) {
  const widgetDict: BookingWidgetDict = {
    widget: dict.widget,
    validation: dict.validation,
    countries: dict.countries,
    locations: dict.locations,
    locationTypes: dict.locationTypes,
    common: dict.common,
  };

  return (
    <section className="bg-ink py-16 md:py-24" aria-labelledby="hero-title">
      <div className="container grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div>
          <SectionHeading
            as="h1"
            level="page"
            id="hero-title"
            eyebrow={dict.hero.eyebrow}
            title={dict.hero.title}
            description={dict.hero.subtitle}
          />
          <TrustBar trust={dict.hero.trust} label={dict.hero.trustAria} className="mt-10" />
        </div>
        <div className="lg:order-first">
          <BookingWidget locale={locale} dict={widgetDict} locations={locations} today={today} />
        </div>
      </div>
    </section>
  );
}
