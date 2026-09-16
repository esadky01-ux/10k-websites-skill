import type { Dictionary } from "@/i18n/getDictionary";
import { estimateDistanceKm, estimateDurationMinutes, formatPrice, splitDuration } from "@/lib/pricing";
import type { Locale, PriceLeg, Quote, Trip, VehicleId } from "@/types";

export type BookingSummaryDict = Pick<Dictionary, "booking" | "fleet" | "common">;

interface BookingSummaryProps {
  locale: Locale;
  dict: BookingSummaryDict;
  trip: Trip;
  vehicle: VehicleId | null;
  /** Seçili araç için hesaplanmış teklif; araç yoksa `null`. */
  quote: Quote | null;
  className?: string;
}

interface PriceLine {
  label: string;
  value: string;
}

/** Dakikayı "3 sa 45 dk" biçiminde yazar; sıfır olan parça atlanır. */
export function durationText(minutes: number, common: Dictionary["common"]): string {
  const split = splitDuration(minutes);
  const parts: string[] = [];
  if (split.hours > 0) parts.push(`${split.hours} ${common.hoursShort}`);
  if (split.minutes > 0 || split.hours === 0) parts.push(`${split.minutes} ${common.minutesShort}`);
  return parts.join(" ");
}

/** Bir bacağın fiyat kalemleri: yol ücreti, varsa sınır ötesi ve gece ücreti. */
function legLines(leg: PriceLeg, summary: Dictionary["booking"]["summary"], locale: Locale): PriceLine[] {
  const lines: PriceLine[] = [{ label: summary.baseFare, value: formatPrice(leg.base, locale) }];
  if (leg.crossBorderFee > 0) lines.push({ label: summary.crossBorder, value: formatPrice(leg.crossBorderFee, locale) });
  if (leg.nightSurcharge > 0) lines.push({ label: summary.night, value: formatPrice(leg.nightSurcharge, locale) });
  return lines;
}

function PriceLines({ title, lines }: { title?: string; lines: PriceLine[] }) {
  return (
    <div>
      {title ? <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{title}</p> : null}
      <dl className="flex flex-col gap-2 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">{line.label}</dt>
            <dd className="tabular-nums text-paper">{line.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const TITLE_ID = "booking-summary-title";

/**
 * Sağdaki (mobilde alttaki) rezervasyon özeti: mesafe, süre, araç ve fiyat kalemleri.
 * Masaüstünde kaydırırken görünür kalır (`lg:sticky`).
 */
export function BookingSummary({ locale, dict, trip, vehicle, quote, className = "" }: BookingSummaryProps) {
  const summary = dict.booking.summary;
  const distanceKm = estimateDistanceKm(trip.from, trip.to);
  const durationMinutes = estimateDurationMinutes(distanceKm);

  const facts = [
    { label: summary.distance, value: `${distanceKm} ${dict.common.km}` },
    { label: summary.duration, value: durationText(durationMinutes, dict.common) },
    { label: summary.vehicle, value: vehicle ? dict.fleet.vehicles[vehicle].name : summary.vehicleNotSelected },
  ];

  return (
    <section aria-labelledby={TITLE_ID} className={`rounded-lg border border-line bg-ink-soft p-5 md:p-6 ${className}`}>
      <h2 id={TITLE_ID} className="text-lg font-extrabold text-paper">
        {summary.title}
      </h2>

      <dl className="mt-4 divide-y divide-line">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <dt className="text-muted">{fact.label}</dt>
            <dd className="text-right font-medium text-paper">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {quote ? (
        <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
          <PriceLines title={quote.inbound ? summary.outbound : undefined} lines={legLines(quote.outbound, summary, locale)} />
          {quote.inbound ? <PriceLines title={summary.inbound} lines={legLines(quote.inbound, summary, locale)} /> : null}
          {quote.inbound ? (
            <PriceLines
              lines={[
                { label: summary.subtotal, value: formatPrice(quote.subtotal, locale) },
                { label: summary.returnDiscount, value: formatPrice(-quote.returnDiscount, locale) },
              ]}
            />
          ) : null}
          <div className="border-t border-line pt-4">
            <dl className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="font-bold text-paper">{summary.total}</dt>
              <dd className="text-2xl font-extrabold tabular-nums text-taxi">{formatPrice(quote.total, locale)}</dd>
            </dl>
            <p className="mt-1 text-sm text-muted">{summary.perTrip}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">{summary.selectVehicleHint}</p>
      )}

      <p className="mt-4 text-sm text-muted">{summary.fixedPriceNote}</p>
    </section>
  );
}
