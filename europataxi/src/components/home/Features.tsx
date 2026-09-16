import { BadgeCheck, BadgeEuro, CalendarX2, Headset, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";

interface FeaturesProps {
  locale: Locale;
  dict: Dictionary;
}

/** Sözlükteki dört özelliğin sırasıyla simgeleri: fiyat, iptal, destek, sürücü. */
const FEATURE_ICONS = [BadgeEuro, CalendarX2, Headset, ShieldCheck] as const;

/** Özellikler: kart yok, üst çizgiyle ayrılmış dört sütun. */
export function Features({ dict }: FeaturesProps) {
  return (
    <section aria-labelledby="features-title" className="bg-surface py-16 md:py-24">
      <div className="container">
        <SectionHeading id="features-title" eyebrow={dict.features.eyebrow} title={dict.features.title} />
        <ul role="list" className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {dict.features.items.map((item, index) => {
            const Icon = FEATURE_ICONS[index] ?? BadgeCheck;
            return (
              <li key={item.title} className="border-t border-line pt-6">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-surface-2 text-taxi-ink">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-content">{item.title}</h3>
                <p className="mt-2 max-w-prose text-base text-muted">{item.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
