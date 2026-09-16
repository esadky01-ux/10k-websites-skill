"use client";

import { Briefcase, Check, Users, XCircle } from "lucide-react";
import { VehicleSilhouette } from "@/components/home/VehicleSilhouette";
import { checkCapacity, fleet } from "@/data/fleet";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill } from "@/i18n/utils";
import { calculateQuote, formatPrice } from "@/lib/pricing";
import type { Locale, Trip, Vehicle, VehicleId } from "@/types";

export type VehicleSelectorDict = Pick<Dictionary, "fleet" | "booking">;

/** Radyo grubunun `name`'i; klavye okları aynı isimli düğmeler arasında gezer. */
export const VEHICLE_RADIO_NAME = "booking-vehicle";
export const VEHICLE_ERROR_ID = `${VEHICLE_RADIO_NAME}-error`;

export function vehicleInputId(id: VehicleId): string {
  return `${VEHICLE_RADIO_NAME}-${id}`;
}

/** Hata durumunda odaklanacak ilk seçilebilir aracın id'si. */
export function firstSelectableVehicleId(trip: Trip): string | undefined {
  const vehicle = fleet.find((v) => checkCapacity(v, trip.passengers, trip.luggage).ok);
  return vehicle ? vehicleInputId(vehicle.id) : undefined;
}

interface VehicleSelectorProps {
  locale: Locale;
  dict: VehicleSelectorDict;
  trip: Trip;
  value: VehicleId | null;
  onChange: (id: VehicleId) => void;
  error?: string;
}

/** Kapasite dışı araç için neden metni: "Bu araç en fazla 3 yolcu alır". */
function unsuitableReason(vehicle: Vehicle, trip: Trip, fleetDict: Dictionary["fleet"]): string | null {
  const check = checkCapacity(vehicle, trip.passengers, trip.luggage);
  if (check.ok) return null;
  return fill(check.reason === "passengers" ? fleetDict.maxPassengers : fleetDict.maxLuggage, { max: check.max });
}

const labelBase =
  "flex h-full cursor-pointer flex-col gap-4 rounded-lg border bg-surface-2 p-5 transition-colors motion-reduce:transition-none peer-focus-visible:ring-4 peer-focus-visible:ring-taxi-ink peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface peer-disabled:cursor-not-allowed peer-disabled:opacity-60";

/**
 * Araç seçimi: her kart bir radyo düğmesidir. Yolcu/bagaj kapasitesine uymayan
 * araçlar devre dışıdır ve nedeni kartta yazar. Fiyat bu rota için hesaplanır.
 */
export function VehicleSelector({ locale, dict, trip, value, onChange, error }: VehicleSelectorProps) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label={dict.booking.vehicleGroupLabel}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? VEHICLE_ERROR_ID : undefined}
        className="grid gap-4 md:grid-cols-3"
      >
        {fleet.map((vehicle) => {
          const reason = unsuitableReason(vehicle, trip, dict.fleet);
          const disabled = reason !== null;
          const selected = value === vehicle.id;
          const inputId = vehicleInputId(vehicle.id);
          const reasonId = `${inputId}-reason`;
          const quote = calculateQuote({
            from: trip.from,
            to: trip.to,
            time: trip.time,
            vehicle: vehicle.id,
            returnTime: trip.return?.time ?? null,
          });
          const stateClass = selected ? "border-taxi-ink shadow-glow" : disabled ? "border-line" : "border-line hover:border-muted";

          return (
            <div key={vehicle.id} className="relative">
              <input
                type="radio"
                id={inputId}
                name={VEHICLE_RADIO_NAME}
                value={vehicle.id}
                checked={selected}
                disabled={disabled}
                aria-disabled={disabled || undefined}
                aria-describedby={disabled ? reasonId : undefined}
                onChange={() => onChange(vehicle.id)}
                className="peer sr-only"
              />
              <label htmlFor={inputId} className={`${labelBase} ${stateClass}`}>
                <span className="flex items-start justify-between gap-3">
                  <span className={`block w-28 shrink-0 ${selected ? "text-taxi-ink" : "text-muted"}`}>
                    <VehicleSilhouette id={vehicle.id} className="h-12 w-full" />
                  </span>
                  {selected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-taxi px-2.5 py-1 text-sm font-bold text-on-taxi">
                      <Check aria-hidden="true" className="h-4 w-4" />
                      {dict.fleet.selected}
                    </span>
                  ) : null}
                  {disabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-sm font-medium text-muted">
                      <XCircle aria-hidden="true" className="h-4 w-4" />
                      {dict.fleet.unavailable}
                    </span>
                  ) : null}
                </span>

                <span className="block">
                  <span className="block text-lg font-extrabold text-content">{dict.fleet.vehicles[vehicle.id].name}</span>
                  <span className="mt-0.5 block text-sm text-muted">{dict.fleet.vehicles[vehicle.id].model}</span>
                </span>

                <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-content">
                  <span className="inline-flex items-center gap-1.5">
                    <Users aria-hidden="true" className="h-4 w-4 text-muted" />
                    {fill(dict.fleet.capacity, { min: vehicle.passengers.min, max: vehicle.passengers.max })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase aria-hidden="true" className="h-4 w-4 text-muted" />
                    {fill(dict.fleet.luggage, { count: vehicle.luggage })}
                  </span>
                </span>

                <span className="mt-auto block border-t border-line pt-4">
                  <span className="block text-sm text-muted">{dict.booking.summary.total}</span>
                  <span className={`block text-xl font-extrabold tabular-nums ${selected ? "text-taxi-ink" : "text-content"}`}>
                    {formatPrice(quote.total, locale)}
                  </span>
                </span>

                {reason ? (
                  <span id={reasonId} className="text-sm font-medium text-taxi-ink">
                    {reason}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>

      {error ? (
        <p id={VEHICLE_ERROR_ID} className="mt-3 text-sm font-medium text-taxi-ink" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
