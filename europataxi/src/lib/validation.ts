import { z, type ZodError } from "zod";
import { checkCapacity, getVehicle, vehicleIds } from "@/data/fleet";
import { isLocationId } from "@/data/locations";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import type { FieldError } from "@/types";
import { compareDateTime } from "./dates";

/**
 * zod şemaları. Hata mesajları sözlük anahtarıdır (`validation.*`); arayüz ve API
 * bunları `dict.validation` üzerinden kullanıcı diline çevirir.
 */

export const LIMITS = {
  passengers: { min: 1, max: 16 },
  luggage: { min: 0, max: 20 },
  timeStepMinutes: 15,
  name: { min: 2, max: 60 },
  note: { max: 500 },
  message: { min: 10, max: 2000 },
  flightNumber: { max: 10 },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** E.164: artı işareti ve 7–15 rakam. Boşluk, tire ve parantez doğrulamadan önce temizlenir. */
const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const FLIGHT_RE = /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/;

export function isValidISODate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isQuarterHour(value: string): boolean {
  if (!TIME_RE.test(value)) return false;
  return Number.parseInt(value.slice(3), 10) % LIMITS.timeStepMinutes === 0;
}

export function normalizePhone(value: string): string {
  return value.replace(/[\s().-]/g, "");
}

export function normalizeFlightNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

const localeSchema = z
  .enum(locales as [Locale, ...Locale[]], { error: "validation.invalidLocale" })
  .default(defaultLocale);

const dateSchema = z
  .string({ error: "validation.dateRequired" })
  .min(1, { error: "validation.dateRequired" })
  .refine(isValidISODate, { error: "validation.invalidDate" });

const timeSchema = z
  .string({ error: "validation.timeRequired" })
  .min(1, { error: "validation.timeRequired" })
  .refine(isQuarterHour, { error: "validation.invalidTime" });

export const returnTripSchema = z.object({
  date: dateSchema,
  time: timeSchema,
});

/**
 * Rota şeması. `today` (YYYY-MM-DD) dışarıdan verilir: istemci cihazın tarihini,
 * sunucu Europe/Brussels tarihini kullanır.
 */
export function createTripSchema(today: string) {
  return z
    .object({
      from: z
        .string({ error: "validation.fromRequired" })
        .min(1, { error: "validation.fromRequired" })
        .refine(isLocationId, { error: "validation.unknownLocation" }),
      to: z
        .string({ error: "validation.toRequired" })
        .min(1, { error: "validation.toRequired" })
        .refine(isLocationId, { error: "validation.unknownLocation" }),
      date: dateSchema,
      time: timeSchema,
      passengers: z
        .number({ error: "validation.passengersRange" })
        .int({ error: "validation.passengersRange" })
        .min(LIMITS.passengers.min, { error: "validation.passengersRange" })
        .max(LIMITS.passengers.max, { error: "validation.passengersRange" }),
      luggage: z
        .number({ error: "validation.luggageRange" })
        .int({ error: "validation.luggageRange" })
        .min(LIMITS.luggage.min, { error: "validation.luggageRange" })
        .max(LIMITS.luggage.max, { error: "validation.luggageRange" }),
      return: returnTripSchema.nullable().default(null),
    })
    .refine((t) => !t.from || !t.to || t.from !== t.to, {
      error: "validation.sameLocation",
      path: ["to"],
    })
    .refine((t) => !isValidISODate(t.date) || t.date >= today, {
      error: "validation.pastDate",
      path: ["date"],
    })
    .refine(
      (t) =>
        !t.return ||
        !isValidISODate(t.return.date) ||
        !isValidISODate(t.date) ||
        compareDateTime(t.return.date, t.return.time, t.date, t.time) > 0,
      { error: "validation.returnBeforeOutbound", path: ["return", "date"] },
    );
}

export type TripInput = z.infer<ReturnType<typeof createTripSchema>>;

const nameSchema = (requiredKey: string) =>
  z
    .string({ error: requiredKey })
    .trim()
    .min(LIMITS.name.min, { error: requiredKey })
    .max(LIMITS.name.max, { error: "validation.nameTooLong" });

const emailSchema = z
  .string({ error: "validation.emailInvalid" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "validation.emailInvalid" }));

const phoneSchema = z
  .string({ error: "validation.phoneInvalid" })
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(PHONE_RE, { error: "validation.phoneInvalid" }));

const consentSchema = z.literal(true, { error: "validation.consentRequired" });

export const customerSchema = z.object({
  firstName: nameSchema("validation.firstNameRequired"),
  lastName: nameSchema("validation.lastNameRequired"),
  email: emailSchema,
  phone: phoneSchema,
  flightNumber: z
    .string()
    .trim()
    .max(LIMITS.flightNumber.max, { error: "validation.flightNumberInvalid" })
    .transform(normalizeFlightNumber)
    .refine((v) => v === "" || FLIGHT_RE.test(v), { error: "validation.flightNumberInvalid" })
    .optional()
    .default(""),
  note: z.string().trim().max(LIMITS.note.max, { error: "validation.noteTooLong" }).optional().default(""),
  consent: consentSchema,
});

export function createBookingSchema(today: string) {
  return z
    .object({
      trip: createTripSchema(today),
      vehicle: z.enum(vehicleIds, { error: "validation.vehicleRequired" }),
      customer: customerSchema,
      locale: localeSchema,
    })
    .refine(
      (b) => {
        const vehicle = getVehicle(b.vehicle);
        return !vehicle || checkCapacity(vehicle, b.trip.passengers, b.trip.luggage).ok;
      },
      { error: "validation.vehicleCapacity", path: ["vehicle"] },
    );
}

export type BookingInput = z.infer<ReturnType<typeof createBookingSchema>>;

export const contactSubjects = ["booking", "corporate", "complaint", "other"] as const;

export const contactSchema = z.object({
  name: nameSchema("validation.nameRequired"),
  email: emailSchema,
  phone: phoneSchema,
  subject: z.enum(contactSubjects, { error: "validation.subjectRequired" }),
  message: z
    .string({ error: "validation.messageTooShort" })
    .trim()
    .min(LIMITS.message.min, { error: "validation.messageTooShort" })
    .max(LIMITS.message.max, { error: "validation.messageTooLong" }),
  consent: consentSchema,
  locale: localeSchema,
});

export type ContactInput = z.infer<typeof contactSchema>;

type Issue = ZodError["issues"][number];

/**
 * zod hatalarını `[{ path: "customer.email", message: "validation.emailInvalid" }]`
 * biçimine çevirir. Aynı alan için yalnızca ilk hata tutulur.
 */
export function issuesToFieldErrors(issues: readonly Issue[]): FieldError[] {
  const seen = new Set<string>();
  const out: FieldError[] = [];
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ path, message: issue.message });
  }
  return out;
}

/** Alan hatalarını `{ "customer.email": "..." }` sözlüğüne çevirir (form state için). */
export function fieldErrorMap(errors: FieldError[]): Record<string, string> {
  return Object.fromEntries(errors.map((e) => [e.path, e.message]));
}
