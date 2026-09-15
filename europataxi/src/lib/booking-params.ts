import type { Trip } from "@/types";
import { LIMITS, createTripSchema, issuesToFieldErrors } from "./validation";
import type { FieldError } from "@/types";

/**
 * Widget → /rezervasyon arasında taşınan sorgu parametreleri:
 * `?from=bru-airport&to=paris&date=2026-10-02&time=14:30&pax=2&bags=3[&returnDate=…&returnTime=…]`
 */
export const TRIP_PARAM_KEYS = {
  from: "from",
  to: "to",
  date: "date",
  time: "time",
  passengers: "pax",
  luggage: "bags",
  returnDate: "returnDate",
  returnTime: "returnTime",
} as const;

export type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: SearchParamsLike, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function toInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

/** Sorguyu, doğrulanmamış ham rota nesnesine çevirir (widget ön doldurma için). */
export function readTripParams(params: SearchParamsLike): Trip {
  const returnDate = read(params, TRIP_PARAM_KEYS.returnDate);
  const returnTime = read(params, TRIP_PARAM_KEYS.returnTime);
  return {
    from: read(params, TRIP_PARAM_KEYS.from) ?? "",
    to: read(params, TRIP_PARAM_KEYS.to) ?? "",
    date: read(params, TRIP_PARAM_KEYS.date) ?? "",
    time: read(params, TRIP_PARAM_KEYS.time) ?? "",
    passengers: toInt(read(params, TRIP_PARAM_KEYS.passengers), LIMITS.passengers.min),
    luggage: toInt(read(params, TRIP_PARAM_KEYS.luggage), LIMITS.luggage.min),
    return: returnDate || returnTime ? { date: returnDate ?? "", time: returnTime ?? "" } : null,
  };
}

/** Rota nesnesini sorgu parametrelerine çevirir. */
export function tripToQuery(trip: Trip): Record<string, string | number> {
  const query: Record<string, string | number> = {
    [TRIP_PARAM_KEYS.from]: trip.from,
    [TRIP_PARAM_KEYS.to]: trip.to,
    [TRIP_PARAM_KEYS.date]: trip.date,
    [TRIP_PARAM_KEYS.time]: trip.time,
    [TRIP_PARAM_KEYS.passengers]: trip.passengers,
    [TRIP_PARAM_KEYS.luggage]: trip.luggage,
  };
  if (trip.return) {
    query[TRIP_PARAM_KEYS.returnDate] = trip.return.date;
    query[TRIP_PARAM_KEYS.returnTime] = trip.return.time;
  }
  return query;
}

export type ParsedTrip = { ok: true; trip: Trip } | { ok: false; trip: Trip; errors: FieldError[] };

/** Sorguyu okur ve rota şemasıyla doğrular. */
export function parseTripParams(params: SearchParamsLike, today: string): ParsedTrip {
  const raw = readTripParams(params);
  const result = createTripSchema(today).safeParse(raw);
  if (result.success) return { ok: true, trip: result.data };
  return { ok: false, trip: raw, errors: issuesToFieldErrors(result.error.issues) };
}
