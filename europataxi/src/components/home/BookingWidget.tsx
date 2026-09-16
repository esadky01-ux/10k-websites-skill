"use client";

import { ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Alert, Button, Counter, Input, Select, TaxiStripe, Toggle } from "@/components/ui";
import { isVehicleId } from "@/data/fleet";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill } from "@/i18n/utils";
import { TRIP_PARAM_KEYS, readTripParams, tripToQuery } from "@/lib/booking-params";
import { nextQuarterHour, timeOptions } from "@/lib/dates";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";
import { LIMITS, createTripSchema, fieldErrorMap, issuesToFieldErrors } from "@/lib/validation";
import { PREFILL_EVENT, VEHICLE_PARAM_KEY, type PrefillDetail } from "@/lib/widget-events";
import type { Locale, Location, ReturnTrip, Trip, VehicleId } from "@/types";
import { LocationCombobox } from "./LocationCombobox";

export type BookingWidgetDict = Pick<Dictionary, "widget" | "validation" | "countries" | "locations" | "locationTypes" | "common">;

export interface BookingWidgetProps {
  locale: Locale;
  dict: BookingWidgetDict;
  locations: Location[];
  /** Sunucudan gelen bugünün tarihi (YYYY-MM-DD); doğrulama ve `min` için. */
  today: string;
}

const TIME_OPTIONS = timeOptions(LIMITS.timeStepMinutes).map((time) => ({ value: time, label: time }));

/** Hata varsa odaklanacak ilk alanı bulmak için görsel sıra. */
const FIELD_ORDER = ["from", "to", "date", "time", "passengers", "luggage", "return.date", "return.time"] as const;

const ERROR_PREFIX = "validation.";

function fieldId(name: string): string {
  return `${BOOKING_WIDGET_ID}-${name.replace(".", "-")}`;
}

/** Şema anahtarını (`validation.pastDate`) kullanıcı diline çevirir; yoksa anahtarı bırakır. */
function translateError(validation: Dictionary["validation"], key: string | undefined): string | undefined {
  if (!key) return undefined;
  const messages: Record<string, string | undefined> = validation;
  const short = key.startsWith(ERROR_PREFIX) ? key.slice(ERROR_PREFIX.length) : key;
  return messages[short] ?? key;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function initialTrip(today: string): Trip {
  return {
    from: "",
    to: "",
    date: today,
    time: "",
    passengers: LIMITS.passengers.min,
    luggage: LIMITS.luggage.min,
    return: null,
  };
}

/** Ön doldurma verisinden yalnızca dolu alanları alır, gerisi olduğu gibi kalır. */
function mergePrefill(prev: Trip, detail: PrefillDetail): Trip {
  return {
    ...prev,
    from: detail.from ?? prev.from,
    to: detail.to ?? prev.to,
    date: detail.date || prev.date,
    time: detail.time || prev.time,
    passengers: detail.passengers ?? prev.passengers,
    luggage: detail.luggage ?? prev.luggage,
  };
}

interface SearchPrefill {
  detail: PrefillDetail;
  returnTrip: ReturnTrip | null;
  vehicle: VehicleId | undefined;
  hasRoute: boolean;
}

/** `?from=…&to=…` sorgusunu okur (rezervasyon sayfasındaki "Düzenle" bağlantısı buraya döner). */
function readSearch(search: string): SearchPrefill {
  const params = new URLSearchParams(search);
  const raw = readTripParams(params);
  const detail: PrefillDetail = {};
  if (raw.from) detail.from = raw.from;
  if (raw.to) detail.to = raw.to;
  if (raw.date) detail.date = raw.date;
  if (raw.time) detail.time = raw.time;
  if (params.has(TRIP_PARAM_KEYS.passengers)) detail.passengers = raw.passengers;
  if (params.has(TRIP_PARAM_KEYS.luggage)) detail.luggage = raw.luggage;
  const vehicle = params.get(VEHICLE_PARAM_KEY);
  return {
    detail,
    returnTrip: raw.return,
    vehicle: isVehicleId(vehicle) ? vehicle : undefined,
    hasRoute: Boolean(raw.from || raw.to),
  };
}

/**
 * Hero'daki rezervasyon widget'ı. Doğrulama `createTripSchema` ile yapılır; geçerliyse
 * rota `/rezervasyon` sayfasına sorgu parametreleriyle taşınır. URL'den ve
 * `PREFILL_EVENT` olayından ön doldurma alır.
 */
export function BookingWidget({ locale, dict, locations, today }: BookingWidgetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trip, setTrip] = useState<Trip>(() => initialTrip(today));
  const [preferredVehicle, setPreferredVehicle] = useState<VehicleId | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefilled, setPrefilled] = useState(false);

  const titleId = `${BOOKING_WIDGET_ID}-title`;

  // Bağlanınca: URL sorgusunu uygula ve saat varsayılanını cihaz saatinden kur
  // (sunucu ile istemci HTML'i aynı kalsın diye ilk render'da saat boştur).
  useEffect(() => {
    const { detail, returnTrip, vehicle, hasRoute } = readSearch(window.location.search);
    setTrip((prev) => {
      let next = hasRoute ? { ...mergePrefill(prev, detail), return: returnTrip ?? prev.return } : prev;
      if (!next.time) next = { ...next, time: nextQuarterHour() };
      return next;
    });
    if (hasRoute) {
      setPrefilled(true);
      if (vehicle) setPreferredVehicle(vehicle);
    }
  }, []);

  // Popüler rota ve filo kartlarından gelen ön doldurma olayı.
  useEffect(() => {
    function onPrefill(event: Event) {
      const detail = (event as CustomEvent<PrefillDetail>).detail;
      if (!detail) return;
      setTrip((prev) => mergePrefill(prev, detail));
      if (detail.vehicle) setPreferredVehicle(detail.vehicle);
      setErrors({});
      setPrefilled(true);
    }
    window.addEventListener(PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(PREFILL_EVENT, onPrefill);
  }, []);

  function clearErrors(...keys: string[]) {
    setErrors((prev) => {
      if (!keys.some((key) => key in prev)) return prev;
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function update<K extends keyof Trip>(key: K, value: Trip[K]) {
    setTrip((prev) => ({ ...prev, [key]: value }));
    clearErrors(key);
    setPrefilled(false);
  }

  function updateReturn(patch: Partial<ReturnTrip>) {
    setTrip((prev) => (prev.return ? { ...prev, return: { ...prev.return, ...patch } } : prev));
    clearErrors("return.date", "return.time", "return");
  }

  function toggleReturn(on: boolean) {
    setTrip((prev) => ({
      ...prev,
      return: on ? { date: addDays(prev.date || today, 1), time: prev.time } : null,
    }));
    clearErrors("return.date", "return.time", "return");
  }

  function swap() {
    setTrip((prev) => ({ ...prev, from: prev.to, to: prev.from }));
    clearErrors("from", "to");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createTripSchema(today).safeParse(trip);
    if (!result.success) {
      const map = fieldErrorMap(issuesToFieldErrors(result.error.issues));
      setErrors(map);
      const first = FIELD_ORDER.find((field) => map[field]) ?? Object.keys(map)[0];
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }
    setErrors({});
    const query = { ...tripToQuery(result.data), [VEHICLE_PARAM_KEY]: preferredVehicle };
    startTransition(() => {
      router.push(localizedPath(locale, "booking", { query }));
    });
  }

  const errorFor = (key: string) => translateError(dict.validation, errors[key]);
  const hasErrors = Object.keys(errors).length > 0;

  const swapButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-ink text-paper transition-colors motion-reduce:transition-none hover:border-taxi hover:text-taxi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-ink-soft";

  return (
    <form
      id={BOOKING_WIDGET_ID}
      noValidate
      aria-labelledby={titleId}
      onSubmit={onSubmit}
      className="scroll-mt-24 rounded-lg border border-line bg-ink-soft shadow-card"
    >
      <TaxiStripe className="rounded-t-[7px]" />
      <div className="p-5 md:p-6">
        <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-paper">
          {dict.widget.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{dict.widget.subtitle}</p>
        <p role="status" aria-live="polite" className={prefilled ? "mt-3 text-sm font-medium text-taxi" : "sr-only"}>
          {prefilled ? dict.widget.prefilled : null}
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <LocationCombobox
              id={fieldId("from")}
              label={dict.widget.from}
              value={trip.from}
              onChange={(id) => update("from", id)}
              locations={locations}
              dict={dict}
              exclude={trip.to}
              error={errorFor("from")}
              placeholder={dict.widget.searchPlaceholder}
            />
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={swap} aria-label={dict.widget.swap} className={swapButtonClass}>
                <ArrowUpDown aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <LocationCombobox
              id={fieldId("to")}
              label={dict.widget.to}
              value={trip.to}
              onChange={(id) => update("to", id)}
              locations={locations}
              dict={dict}
              exclude={trip.from}
              error={errorFor("to")}
              placeholder={dict.widget.searchPlaceholder}
              className="mt-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id={fieldId("date")}
              type="date"
              label={dict.widget.date}
              min={today}
              value={trip.date}
              onChange={(event) => update("date", event.target.value)}
              error={errorFor("date")}
            />
            <Select
              id={fieldId("time")}
              label={dict.widget.time}
              options={TIME_OPTIONS}
              placeholder={dict.widget.time}
              value={trip.time}
              onChange={(event) => update("time", event.target.value)}
              error={errorFor("time")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Counter
              id={fieldId("passengers")}
              label={dict.widget.passengers}
              value={trip.passengers}
              min={LIMITS.passengers.min}
              max={LIMITS.passengers.max}
              onChange={(value) => update("passengers", value)}
              decreaseLabel={fill(dict.widget.decrease, { label: dict.widget.passengers })}
              increaseLabel={fill(dict.widget.increase, { label: dict.widget.passengers })}
              error={errorFor("passengers")}
            />
            <Counter
              id={fieldId("luggage")}
              label={dict.widget.luggage}
              value={trip.luggage}
              min={LIMITS.luggage.min}
              max={LIMITS.luggage.max}
              onChange={(value) => update("luggage", value)}
              decreaseLabel={fill(dict.widget.decrease, { label: dict.widget.luggage })}
              increaseLabel={fill(dict.widget.increase, { label: dict.widget.luggage })}
              error={errorFor("luggage")}
            />
          </div>

          <Toggle
            id={fieldId("return")}
            label={dict.widget.addReturn}
            hint={dict.widget.returnHint}
            checked={trip.return !== null}
            onChange={toggleReturn}
          />

          {trip.return ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id={fieldId("return.date")}
                type="date"
                label={dict.widget.returnDate}
                min={trip.date || today}
                value={trip.return.date}
                onChange={(event) => updateReturn({ date: event.target.value })}
                error={errorFor("return.date") ?? errorFor("return")}
              />
              <Select
                id={fieldId("return.time")}
                label={dict.widget.returnTime}
                options={TIME_OPTIONS}
                placeholder={dict.widget.returnTime}
                value={trip.return.time}
                onChange={(event) => updateReturn({ time: event.target.value })}
                error={errorFor("return.time")}
              />
            </div>
          ) : null}

          {hasErrors ? <Alert tone="error">{dict.widget.formErrorSummary}</Alert> : null}

          <Button type="submit" full disabled={isPending} aria-busy={isPending || undefined}>
            {isPending ? dict.common.loading : dict.widget.submit}
          </Button>
        </div>
      </div>
    </form>
  );
}
