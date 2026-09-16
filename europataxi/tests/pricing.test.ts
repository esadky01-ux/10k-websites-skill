import assert from "node:assert/strict";
import test from "node:test";
import { fleet } from "@/data/fleet";
import { getLocation } from "@/data/locations";
import {
  calculateLeg,
  calculateQuote,
  estimateDistanceKm,
  estimateDurationMinutes,
  formatPrice,
  haversineKm,
} from "@/lib/pricing";
import type { Location, VehicleId } from "@/types";

/**
 * Beklenen değerler şartnamedeki formüllerden bağımsız olarak kurulur, koddan
 * okunmaz: kuş uçuşu mesafe × 1.25, süre = mesafe / 80 sa, fiyat =
 * max(45, 15 + km × 1.60 × araç çarpanı), ülke değişiyorsa +10, 22:00-06:00
 * arası %15 gece ücreti, dönüş transferinde toplam × 2 üzerinden %5 indirim.
 */
const SPEC = {
  roadFactor: 1.25,
  averageSpeedKmh: 80,
  baseFare: 15,
  perKm: 1.6,
  minimumFare: 45,
  crossBorderFee: 10,
  nightRate: 0.15,
  nightStartHour: 22,
  nightEndHour: 6,
  returnDiscount: 0.05,
} as const;

/** Şartnamedeki filo tablosundaki km başı çarpanlar. */
const SPEC_MULTIPLIERS: Record<VehicleId, number> = { sedan: 1.0, van: 1.35, business: 1.7 };

const EARTH_RADIUS_KM = 6371;
const CENT = 0.01;

function requireLocation(id: string): Location {
  const location = getLocation(id);
  if (!location) throw new Error(`Test için konum bulunamadı: ${id}`);
  return location;
}

/** Testin kendi haversine uygulaması; kaynak koddaki sürümden bağımsızdır. */
function greatCircleKm(fromId: string, toId: string): number {
  const from = requireLocation(fromId);
  const to = requireLocation(toId);
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Tahmini karayolu mesafesi: kuş uçuşu × 1.25, tam km. */
function specRoadKm(fromId: string, toId: string): number {
  return Math.round(greatCircleKm(fromId, toId) * SPEC.roadFactor);
}

function isNight(time: string): boolean {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  return hour >= SPEC.nightStartHour || hour < SPEC.nightEndHour;
}

interface SpecLeg {
  km: number;
  base: number;
  crossBorderFee: number;
  nightSurcharge: number;
  total: number;
}

/** Tek yön fiyatı, yalnızca şartnamedeki formülle. */
function specLeg(fromId: string, toId: string, time: string, vehicle: VehicleId): SpecLeg {
  const km = specRoadKm(fromId, toId);
  const multiplier = SPEC_MULTIPLIERS[vehicle];
  const metered = SPEC.baseFare + km * SPEC.perKm * multiplier;
  const base = Math.max(SPEC.minimumFare, metered);
  const crossBorderFee =
    requireLocation(fromId).country === requireLocation(toId).country ? 0 : SPEC.crossBorderFee;
  const nightSurcharge = isNight(time) ? (base + crossBorderFee) * SPEC.nightRate : 0;
  return { km, base, crossBorderFee, nightSurcharge, total: base + crossBorderFee + nightSurcharge };
}

function assertMoney(actual: number, expected: number, message: string): void {
  assert.ok(
    Math.abs(actual - expected) <= CENT,
    `${message}: beklenen ${expected.toFixed(2)}, gelen ${actual.toFixed(2)}`,
  );
}

test("Brüksel-Paris kuş uçuşu mesafesi ve 1.25 yol katsayısı makul aralıkta", () => {
  const direct = haversineKm(requireLocation("brussels"), requireLocation("paris"));
  const own = greatCircleKm("brussels", "paris");
  // Brüksel ile Paris arası kuş uçuşu yaklaşık 264 km'dir.
  assert.ok(direct > 250 && direct < 280, `kuş uçuşu mesafe aralık dışı: ${direct}`);
  assert.ok(Math.abs(direct - own) < 0.5, `haversine sonuçları ayrıştı: ${direct} / ${own}`);

  const road = estimateDistanceKm("brussels", "paris");
  assert.equal(road, specRoadKm("brussels", "paris"));
  assert.ok(road > 315 && road < 345, `karayolu mesafesi aralık dışı: ${road}`);
  assert.ok(Math.abs(road - direct * SPEC.roadFactor) <= 0.5, "yol katsayısı 1.25 uygulanmamış");
});

test("süre tahmini mesafenin 80 km/s hıza bölümüdür", () => {
  for (const [from, to] of [
    ["brussels", "paris"],
    ["brussels", "amsterdam"],
    ["bru-airport", "brussels"],
  ] as const) {
    const km = specRoadKm(from, to);
    const expectedMinutes = (km / SPEC.averageSpeedKmh) * 60;
    assert.ok(
      Math.abs(estimateDurationMinutes(km) - expectedMinutes) <= 0.5,
      `${from}-${to} süresi beklenenden farklı: ${estimateDurationMinutes(km)} / ${expectedMinutes}`,
    );
  }

  const leg = calculateLeg({ from: "brussels", to: "paris", time: "12:00", vehicle: "sedan" });
  assert.ok(Math.abs(leg.durationMinutes - (leg.distanceKm / SPEC.averageSpeedKmh) * 60) <= 0.5);
});

test("kısa mesafede asgari ücret uygulanır (Brüksel Havalimanı - Brüksel)", () => {
  const expected = specLeg("bru-airport", "brussels", "12:00", "sedan");
  const metered = SPEC.baseFare + expected.km * SPEC.perKm;
  assert.ok(metered < SPEC.minimumFare, "test rotası artık asgari ücretin altında değil");

  const leg = calculateLeg({ from: "bru-airport", to: "brussels", time: "12:00", vehicle: "sedan" });
  assertMoney(leg.base, SPEC.minimumFare, "asgari ücret uygulanmadı");
  assertMoney(leg.total, SPEC.minimumFare, "toplam asgari ücrete eşit değil");
  assert.equal(leg.isCrossBorder, false);
});

test("sınır ötesi ücreti yalnızca ülke değiştiren rotalarda eklenir", () => {
  const crossing = calculateLeg({ from: "brussels", to: "amsterdam", time: "12:00", vehicle: "sedan" });
  const expectedCrossing = specLeg("brussels", "amsterdam", "12:00", "sedan");
  assert.equal(crossing.isCrossBorder, true);
  assertMoney(crossing.crossBorderFee, SPEC.crossBorderFee, "Brüksel-Amsterdam sınır ücreti");
  assertMoney(crossing.total, expectedCrossing.total, "Brüksel-Amsterdam toplamı");

  const domestic = calculateLeg({ from: "brussels", to: "antwerp", time: "12:00", vehicle: "sedan" });
  const expectedDomestic = specLeg("brussels", "antwerp", "12:00", "sedan");
  assert.equal(domestic.isCrossBorder, false);
  assertMoney(domestic.crossBorderFee, 0, "Brüksel-Anvers sınır ücreti sıfır olmalı");
  assertMoney(domestic.total, expectedDomestic.total, "Brüksel-Anvers toplamı");
});

test("gece ücreti 22:00 ve 05:45'te uygulanır, 06:00 ve 21:45'te uygulanmaz", () => {
  const route = { from: "brussels", to: "paris", vehicle: "sedan" } as const;

  for (const time of ["22:00", "05:45"]) {
    const leg = calculateLeg({ ...route, time });
    const expected = specLeg(route.from, route.to, time, route.vehicle);
    assert.equal(leg.isNight, true, `${time} gece tarifesinde sayılmalı`);
    assertMoney(leg.nightSurcharge, expected.nightSurcharge, `${time} gece ücreti`);
    assertMoney(leg.total, expected.total, `${time} toplamı`);
    assert.ok(expected.nightSurcharge > 0, "test verisi gece ücreti üretmiyor");
  }

  for (const time of ["06:00", "21:45"]) {
    const leg = calculateLeg({ ...route, time });
    const expected = specLeg(route.from, route.to, time, route.vehicle);
    assert.equal(leg.isNight, false, `${time} gündüz tarifesinde olmalı`);
    assertMoney(leg.nightSurcharge, 0, `${time} gece ücreti sıfır olmalı`);
    assertMoney(leg.total, expected.total, `${time} toplamı`);
  }
});

test("iki bacağı da gündüz olan dönüşlü transfer: tek yön × 2 × 0.95", () => {
  const oneWay = calculateQuote({ from: "brussels", to: "paris", time: "12:00", vehicle: "sedan" });
  const roundTrip = calculateQuote({
    from: "brussels",
    to: "paris",
    time: "12:00",
    vehicle: "sedan",
    returnTime: "16:30",
  });

  const expectedOneWay = specLeg("brussels", "paris", "12:00", "sedan").total;
  assertMoney(oneWay.total, expectedOneWay, "tek yön toplamı");
  assert.equal(oneWay.inbound, null);

  const expectedRoundTrip = expectedOneWay * 2 * (1 - SPEC.returnDiscount);
  assertMoney(roundTrip.subtotal, expectedOneWay * 2, "dönüşlü ara toplam");
  assertMoney(roundTrip.returnDiscount, expectedOneWay * 2 * SPEC.returnDiscount, "dönüş indirimi");
  assertMoney(roundTrip.total, expectedRoundTrip, "dönüşlü toplam");
  assertMoney(roundTrip.total, oneWay.total * 2 * 0.95, "dönüşlü toplam tek yönün 1.9 katı olmalı");
});

test("araç çarpanları taksimetre kısmını beklendiği gibi değiştirir", () => {
  const km = specRoadKm("brussels", "paris");

  for (const vehicle of fleet) {
    assert.equal(
      vehicle.multiplier,
      SPEC_MULTIPLIERS[vehicle.id],
      `${vehicle.id} çarpanı şartnameden farklı`,
    );

    const leg = calculateLeg({ from: "brussels", to: "paris", time: "12:00", vehicle: vehicle.id });
    const expected = specLeg("brussels", "paris", "12:00", vehicle.id);
    assertMoney(leg.base, expected.base, `${vehicle.id} taksimetre tutarı`);
    assertMoney(leg.total, expected.total, `${vehicle.id} toplamı`);
    // Açılış ücreti düşüldüğünde geriye km × 1.60 × çarpan kalmalı.
    assertMoney(leg.base - SPEC.baseFare, km * SPEC.perKm * vehicle.multiplier, `${vehicle.id} km ücreti`);
  }

  const sedan = calculateLeg({ from: "brussels", to: "paris", time: "12:00", vehicle: "sedan" });
  const van = calculateLeg({ from: "brussels", to: "paris", time: "12:00", vehicle: "van" });
  const business = calculateLeg({ from: "brussels", to: "paris", time: "12:00", vehicle: "business" });
  const meter = (base: number) => base - SPEC.baseFare;
  assert.ok(Math.abs(meter(van.base) / meter(sedan.base) - 1.35) < 0.001, "van oranı 1.35 değil");
  assert.ok(Math.abs(meter(business.base) / meter(sedan.base) - 1.7) < 0.001, "business oranı 1.7 değil");
});

test("formatPrice Türkçe biçimde euro işareti içerir", () => {
  const price = formatPrice(553, "tr");
  assert.ok(price.includes("€"), `euro işareti yok: ${price}`);
  assert.ok(price.includes("553"), `tutar görünmüyor: ${price}`);
  assert.ok(formatPrice(1050.7, "tr").includes("€"), "ondalıklı tutarda euro işareti yok");
});
