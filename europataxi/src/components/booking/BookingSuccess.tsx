"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, ButtonLink, TaxiStripe } from "@/components/ui";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill } from "@/i18n/utils";
import { formatDate } from "@/lib/dates";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";
import { formatPrice } from "@/lib/pricing";
import type { BookingSuccessResponse, Locale } from "@/types";
import { locationName, returnText } from "./RouteSummary";

export type BookingSuccessDict = Pick<Dictionary, "booking" | "fleet" | "locations" | "common">;

interface BookingSuccessProps {
  locale: Locale;
  dict: BookingSuccessDict;
  result: BookingSuccessResponse;
}

const TITLE_ID = "booking-success-title";

/**
 * Onay ekranı: rezervasyon numarası, e-posta bilgisi ve özet. Görünür olduğunda
 * sayfa başına kayar ve başlığa odaklanır (ekran okuyucu için duyuru).
 */
export function BookingSuccess({ locale, dict, result }: BookingSuccessProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const success = dict.booking.success;
  const route = dict.booking.route;
  const { booking, reference } = result;
  const { trip, customer, quote } = booking;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const rows = [
    { label: route.from, value: locationName(dict.locations, trip.from) },
    { label: route.to, value: locationName(dict.locations, trip.to) },
    { label: route.date, value: `${formatDate(trip.date, locale)}, ${trip.time}` },
    { label: route.return, value: returnText(trip, locale, route) },
    { label: route.passengers, value: fill(dict.common.passengersCount, { count: trip.passengers }) },
    { label: route.luggage, value: fill(dict.common.luggageCount, { count: trip.luggage }) },
    { label: dict.booking.summary.vehicle, value: dict.fleet.vehicles[booking.vehicle].name },
    { label: success.customer, value: `${customer.firstName} ${customer.lastName}, ${customer.phone}` },
    { label: dict.booking.summary.total, value: formatPrice(quote.total, locale), highlight: true },
  ];

  return (
    <div className="max-w-3xl">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-taxi">
        <span aria-hidden="true" className="inline-block h-px w-6 bg-taxi" />
        {dict.booking.eyebrow}
      </p>
      <h1
        id={TITLE_ID}
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-extrabold tracking-tight text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-4 focus-visible:ring-offset-ink md:text-3xl"
      >
        {success.title}
      </h1>

      <div role="status" className="mt-8 overflow-hidden rounded-lg border border-taxi bg-ink-soft">
        <TaxiStripe />
        <div className="p-6 md:p-8">
          <p className="text-sm font-medium text-muted">{success.referenceLabel}</p>
          <p className="mt-2 break-words text-2xl font-extrabold tracking-wider text-taxi md:text-3xl">{reference}</p>
        </div>
      </div>

      <p className="mt-6 max-w-prose text-base text-muted md:text-lg">{fill(success.description, { email: customer.email })}</p>

      <section aria-labelledby="booking-success-summary" className="mt-10">
        <h2 id="booking-success-summary" className="text-lg font-extrabold text-paper">
          {success.summaryTitle}
        </h2>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm text-muted">{row.label}</dt>
              <dd className={`break-words ${row.highlight ? "text-lg font-extrabold text-taxi" : "font-medium text-paper"}`}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ButtonLink href={localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID })}>{success.newBooking}</ButtonLink>
        <ButtonLink href={localizedPath(locale)} variant="secondary">
          {success.home}
        </ButtonLink>
        <Button variant="ghost" onClick={() => window.print()} className="print:hidden">
          <Printer aria-hidden="true" className="h-5 w-5" />
          {success.print}
        </Button>
      </div>
    </div>
  );
}
