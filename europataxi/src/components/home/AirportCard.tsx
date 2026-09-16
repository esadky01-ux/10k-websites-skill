import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";
import type { Location } from "@/types";

interface AirportCardProps {
  locale: Locale;
  airport: Location;
  /** Sözlükten çözülmüş ad, ör. "Brüksel Havalimanı (BRU)". */
  name: string;
  /** Kartın altındaki ülke adı (sözlükten). */
  country: string;
  /** Erişilebilir ad, ör. "Brüksel Havalimanı (BRU) kalkışlı transfer planla". */
  ariaLabel: string;
}

/**
 * Ana sayfa bağlantısı: widget `?from=` parametresini okuyup havalimanını kalkış
 * yeri olarak yükler ve `#rezervasyon` çapasıyla kendine kaydırılır.
 * Ön doldurma olayı yalnızca ana sayfada çalıştığı için alt sayfalar bağlantı kullanır.
 */
export function airportBookingHref(locale: Locale, airportId: string): string {
  return localizedPath(locale, "home", { query: { from: airportId }, hash: BOOKING_WIDGET_ID });
}

/** IATA kodu ayrı rozet olarak gösterildiği için addaki "(BRU)" ekini kaldırır. */
function stripIata(name: string, iata?: string): string {
  if (!iata) return name;
  const suffix = ` (${iata})`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

/** Havalimanı kartı: IATA rozeti, ad ve ülke. Tıklanınca ana sayfadaki widget'a kalkış yeri olarak gider. */
export function AirportCard({ locale, airport, name, country, ariaLabel }: AirportCardProps) {
  return (
    <Link
      href={airportBookingHref(locale, airport.id)}
      aria-label={ariaLabel}
      className="group flex h-full min-w-0 flex-col rounded-lg border border-line bg-surface p-5 transition-colors motion-reduce:transition-none hover:border-taxi-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
    >
      <span className="flex items-center justify-between gap-3">
        {airport.iata ? (
          <span className="rounded-md bg-taxi px-2.5 py-1 text-sm font-extrabold tracking-wider text-on-taxi">{airport.iata}</span>
        ) : null}
        <ArrowRight
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-taxi-ink motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
        />
      </span>
      <span className="mt-5 block break-words text-lg font-bold text-content">{stripIata(name, airport.iata)}</span>
      <span className="mt-1 block text-sm text-muted">{country}</span>
    </Link>
  );
}
