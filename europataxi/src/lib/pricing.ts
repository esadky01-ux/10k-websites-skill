import { getLocation } from "@/data/locations";
import { getVehicle } from "@/data/fleet";
import { intlLocale, type Locale } from "@/i18n/config";
import type { PriceLeg, Quote, VehicleId } from "@/types";

/**
 * Tüm fiyat sabitleri tek yerde. Değerleri değiştirmek fiyatlandırmayı
 * hem arayüzde hem API'de anında günceller (sunucu fiyatı yeniden hesaplar).
 */
export const PRICING_CONFIG = {
  /** Kuş uçuşu mesafeyi tahmini karayolu mesafesine çeviren katsayı. */
  roadFactor: 1.25,
  /** Süre tahmini için ortalama hız (km/s). */
  averageSpeedKmh: 80,
  /** Açılış ücreti (€). */
  baseFare: 15,
  /** Km başı ücret (€). */
  perKm: 1.6,
  /** Bir bacak için asgari ücret (€). */
  minimumFare: 45,
  /** Ülke değiştiren rotalara eklenen sınır ötesi ücret (€). */
  crossBorderFee: 10,
  /** Gece ücreti: [start, end) saatleri arasında kalkışlara uygulanan oran. */
  night: { startHour: 22, endHour: 6, rate: 0.15 },
  /** Dönüş transferi seçildiğinde toplam üzerinden indirim oranı. */
  returnDiscount: 0.05,
  currency: "EUR" as const,
  /** Fiyatlar bu kesirle yuvarlanır (0.01 = kuruş hassasiyeti). */
  roundingStep: 0.01,
} as const;

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine formülüyle kuş uçuşu mesafe (km). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundMoney(value: number): number {
  const step = PRICING_CONFIG.roundingStep;
  return Math.round(value / step) * step;
}

/** Tahmini karayolu mesafesi (km, tam sayıya yuvarlanmış). */
export function estimateDistanceKm(fromId: string, toId: string): number {
  const from = getLocation(fromId);
  const to = getLocation(toId);
  if (!from || !to) throw new Error(`Bilinmeyen konum: ${!from ? fromId : toId}`);
  return Math.round(haversineKm(from, to) * PRICING_CONFIG.roadFactor);
}

/** Tahmini süre (dakika, ortalama hızla). */
export function estimateDurationMinutes(distanceKm: number): number {
  return Math.round((distanceKm / PRICING_CONFIG.averageSpeedKmh) * 60);
}

/** "HH:MM" kalkış saati gece tarifesine giriyor mu? (22:00 dahil, 06:00 hariç) */
export function isNightTime(time: string): boolean {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  if (Number.isNaN(hour)) return false;
  const { startHour, endHour } = PRICING_CONFIG.night;
  return hour >= startHour || hour < endHour;
}

export interface LegInput {
  from: string;
  to: string;
  time: string;
  vehicle: VehicleId;
}

/** Tek yön (bir bacak) fiyatı. */
export function calculateLeg({ from, to, time, vehicle }: LegInput): PriceLeg {
  const fromLoc = getLocation(from);
  const toLoc = getLocation(to);
  const veh = getVehicle(vehicle);
  if (!fromLoc || !toLoc) throw new Error(`Bilinmeyen konum: ${!fromLoc ? from : to}`);
  if (!veh) throw new Error(`Bilinmeyen araç: ${vehicle}`);

  const distanceKm = estimateDistanceKm(from, to);
  const durationMinutes = estimateDurationMinutes(distanceKm);
  const metered = PRICING_CONFIG.baseFare + distanceKm * PRICING_CONFIG.perKm * veh.multiplier;
  const base = roundMoney(Math.max(PRICING_CONFIG.minimumFare, metered));
  const isCrossBorder = fromLoc.country !== toLoc.country;
  const crossBorderFee = isCrossBorder ? PRICING_CONFIG.crossBorderFee : 0;
  const isNight = isNightTime(time);
  const nightSurcharge = isNight ? roundMoney((base + crossBorderFee) * PRICING_CONFIG.night.rate) : 0;
  const total = roundMoney(base + crossBorderFee + nightSurcharge);

  return { distanceKm, durationMinutes, base, crossBorderFee, nightSurcharge, isNight, isCrossBorder, total };
}

export interface QuoteInput {
  from: string;
  to: string;
  time: string;
  vehicle: VehicleId;
  /** Dönüş transferi varsa dönüş kalkış saati. */
  returnTime?: string | null;
}

/**
 * Tam teklif. Dönüş seçiliyse dönüş bacağı ters yönde ve kendi kalkış saatiyle
 * hesaplanır (gece ücreti bacak bazında), toplam üzerinden %5 indirim uygulanır.
 * İki bacak da gündüzse sonuç "tek yön × 2 × 0.95" ile birebir aynıdır.
 */
export function calculateQuote({ from, to, time, vehicle, returnTime }: QuoteInput): Quote {
  const outbound = calculateLeg({ from, to, time, vehicle });
  const inbound = returnTime ? calculateLeg({ from: to, to: from, time: returnTime, vehicle }) : null;
  const subtotal = roundMoney(outbound.total + (inbound?.total ?? 0));
  const returnDiscount = inbound ? roundMoney(subtotal * PRICING_CONFIG.returnDiscount) : 0;
  const total = roundMoney(subtotal - returnDiscount);
  return { vehicle, currency: PRICING_CONFIG.currency, outbound, inbound, subtotal, returnDiscount, total };
}

/** Bir rota için en düşük tek yön fiyat (sedan, gündüz). Popüler rota kartlarında kullanılır. */
export function startingPrice(from: string, to: string): number {
  return calculateLeg({ from, to, time: "12:00", vehicle: "sedan" }).total;
}

/**
 * Para biçimi: Türkçe için `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR' })`.
 * Ondalık basamak sayısı bilinçli olarak varsayılan bırakılır (euro için iki basamak);
 * böylece liste içinde "45,00 €" ile "572,20 €" aynı hizada durur.
 */
export function formatPrice(amount: number, locale: Locale = "tr"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: PRICING_CONFIG.currency,
  }).format(amount);
}

/** Dakikayı saat ve dakikaya böler; metni bileşen sözlükten kurar. */
export function splitDuration(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
