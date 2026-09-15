import type { Vehicle, VehicleId } from "@/types";

/**
 * Araç filosu. `multiplier` km başı ücreti çarpar (bkz. src/lib/pricing.ts).
 * Metinler sözlükte `fleet.vehicles.<id>` ve `fleet.featureLabels.*` altındadır.
 */
export const fleet: Vehicle[] = [
  {
    id: "sedan",
    name: "fleet.vehicles.sedan.name",
    model: "fleet.vehicles.sedan.model",
    description: "fleet.vehicles.sedan.description",
    passengers: { min: 1, max: 3 },
    luggage: 3,
    multiplier: 1.0,
    features: ["fleet.featureLabels.wifi", "fleet.featureLabels.water", "fleet.featureLabels.childSeat"],
  },
  {
    id: "van",
    name: "fleet.vehicles.van.name",
    model: "fleet.vehicles.van.model",
    description: "fleet.vehicles.van.description",
    passengers: { min: 4, max: 8 },
    luggage: 8,
    multiplier: 1.35,
    features: [
      "fleet.featureLabels.wifi",
      "fleet.featureLabels.water",
      "fleet.featureLabels.childSeat",
      "fleet.featureLabels.extraLuggage",
    ],
  },
  {
    id: "business",
    name: "fleet.vehicles.business.name",
    model: "fleet.vehicles.business.model",
    description: "fleet.vehicles.business.description",
    passengers: { min: 1, max: 3 },
    luggage: 3,
    multiplier: 1.7,
    features: [
      "fleet.featureLabels.wifi",
      "fleet.featureLabels.water",
      "fleet.featureLabels.childSeat",
      "fleet.featureLabels.premiumComfort",
    ],
  },
];

export const vehicleIds = fleet.map((v) => v.id) as [VehicleId, ...VehicleId[]];

const byId = new Map(fleet.map((v) => [v.id, v]));

export function getVehicle(id: string | null | undefined): Vehicle | undefined {
  return id ? byId.get(id as VehicleId) : undefined;
}

export function isVehicleId(id: string | null | undefined): id is VehicleId {
  return typeof id === "string" && byId.has(id as VehicleId);
}

export type CapacityCheck =
  | { ok: true }
  | { ok: false; reason: "passengers" | "luggage"; max: number };

/**
 * Araç, yolcu ve bagaj sayısına uyuyor mu? Uymuyorsa nedenini ve sınırı döndürür;
 * arayüz bunu "Bu araç en fazla 3 yolcu alır" gibi bir metne çevirir.
 * Yalnızca üst sınırlar bağlayıcıdır: 2 kişilik bir grup isterse van seçebilir.
 */
export function checkCapacity(vehicle: Vehicle, passengers: number, luggage: number): CapacityCheck {
  if (passengers > vehicle.passengers.max) {
    return { ok: false, reason: "passengers", max: vehicle.passengers.max };
  }
  if (luggage > vehicle.luggage) {
    return { ok: false, reason: "luggage", max: vehicle.luggage };
  }
  return { ok: true };
}

/** Yolcu/bagaj sayısına uyan araçlar. */
export function suitableVehicles(passengers: number, luggage: number): Vehicle[] {
  return fleet.filter((v) => checkCapacity(v, passengers, luggage).ok);
}
