import { Pencil } from "lucide-react";
import Link from "next/link";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill } from "@/i18n/utils";
import { tripToQuery } from "@/lib/booking-params";
import { formatDate } from "@/lib/dates";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";
import type { Locale, Trip } from "@/types";

export type RouteSummaryDict = Pick<Dictionary, "booking" | "locations" | "common">;

interface RouteSummaryProps {
  locale: Locale;
  dict: RouteSummaryDict;
  trip: Trip;
  className?: string;
}

/** Konum kimliğini sözlükteki ada çevirir; ad yoksa kimlik görünür kalır. */
export function locationName(names: Dictionary["locations"], id: string): string {
  const map: Record<string, string | undefined> = names;
  return map[id] ?? id;
}

/** Dönüş bacağını "2 Ekim 2026 Cuma, 14:30" biçiminde yazar; dönüş yoksa "Tek yön". */
export function returnText(trip: Trip, locale: Locale, route: Dictionary["booking"]["route"]): string {
  return trip.return ? `${formatDate(trip.return.date, locale)}, ${trip.return.time}` : route.oneWay;
}

const TITLE_ID = "booking-route-title";

/**
 * Rezervasyon sayfasının üstündeki rota özeti. "Düzenle" bağlantısı rotayı sorgu
 * parametreleriyle ana sayfadaki widget'a geri taşır.
 */
export function RouteSummary({ locale, dict, trip, className = "" }: RouteSummaryProps) {
  const route = dict.booking.route;
  const editHref = localizedPath(locale, "home", { query: tripToQuery(trip), hash: BOOKING_WIDGET_ID });

  const items = [
    { label: route.from, value: locationName(dict.locations, trip.from) },
    { label: route.to, value: locationName(dict.locations, trip.to) },
    { label: route.date, value: formatDate(trip.date, locale) },
    { label: route.time, value: trip.time },
    { label: route.passengers, value: fill(dict.common.passengersCount, { count: trip.passengers }) },
    { label: route.luggage, value: fill(dict.common.luggageCount, { count: trip.luggage }) },
    { label: route.return, value: returnText(trip, locale, route) },
  ];

  return (
    <section aria-labelledby={TITLE_ID} className={`rounded-lg border border-line bg-surface-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id={TITLE_ID} className="text-lg font-extrabold text-content">
          {route.title}
        </h2>
        <Link
          href={editHref}
          aria-label={route.editAria}
          className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-taxi-ink transition-colors motion-reduce:transition-none hover:text-taxi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          {route.edit}
        </Link>
      </div>
      <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="mt-0.5 break-words font-medium text-content">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
