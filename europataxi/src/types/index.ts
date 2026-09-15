import type { Locale } from "@/i18n/config";

export type { Locale };

export type CountryCode = "BE" | "NL" | "FR" | "DE";

export type LocationType = "city" | "airport";

export interface Location {
  /** URL ve API'de kullanılan kararlı kimlik, ör. `bru-airport`. */
  id: string;
  /** Sözlükteki i18n anahtarı, ör. `locations.bru-airport`. */
  name: string;
  country: CountryCode;
  type: LocationType;
  lat: number;
  lng: number;
  /** Yalnızca havalimanları: IATA kodu. */
  iata?: string;
}

export type VehicleId = "sedan" | "van" | "business";

export interface Vehicle {
  id: VehicleId;
  /** i18n anahtarı, ör. `fleet.vehicles.sedan.name`. */
  name: string;
  /** i18n anahtarı: örnek model. */
  model: string;
  /** i18n anahtarı: kısa açıklama. */
  description: string;
  passengers: { min: number; max: number };
  luggage: number;
  /** Km başı fiyat çarpanı. */
  multiplier: number;
  /** i18n anahtarları: `fleet.featureLabels.*` */
  features: string[];
}

export interface PopularRoute {
  id: string;
  from: string;
  to: string;
}

export interface ReturnTrip {
  date: string;
  time: string;
}

export interface Trip {
  from: string;
  to: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 15 dakikalık adımlar */
  time: string;
  passengers: number;
  luggage: number;
  return: ReturnTrip | null;
}

export interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  flightNumber?: string;
  note?: string;
  consent: true;
}

export interface BookingPayload {
  trip: Trip;
  vehicle: VehicleId;
  customer: Customer;
  locale: Locale;
}

export type ContactSubject = "booking" | "corporate" | "complaint" | "other";

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  subject: ContactSubject;
  message: string;
  consent: true;
  locale: Locale;
}

export interface PriceLeg {
  /** Tahmini karayolu mesafesi (km). */
  distanceKm: number;
  /** Tahmini süre (dakika). */
  durationMinutes: number;
  /** max(minimum, açılış + km × kmÜcreti × çarpan) */
  base: number;
  crossBorderFee: number;
  nightSurcharge: number;
  isNight: boolean;
  isCrossBorder: boolean;
  total: number;
}

export interface Quote {
  vehicle: VehicleId;
  currency: "EUR";
  outbound: PriceLeg;
  inbound: PriceLeg | null;
  /** Bacakların toplamı, indirim öncesi. */
  subtotal: number;
  /** Dönüş transferi indirimi (negatif değil, düşülecek tutar). */
  returnDiscount: number;
  total: number;
}

export interface FieldError {
  path: string;
  message: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: string;
  errors?: FieldError[];
}

export interface BookingSuccessResponse {
  ok: true;
  reference: string;
  booking: BookingPayload & { quote: Quote; receivedAt: string };
}

export interface ContactSuccessResponse {
  ok: true;
  receivedAt: string;
}
