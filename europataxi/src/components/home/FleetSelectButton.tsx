"use client";

import { Button } from "@/components/ui";
import { prefillBookingWidget } from "@/lib/widget-events";
import type { VehicleId } from "@/types";

interface FleetSelectButtonProps {
  id: VehicleId;
  /** Görünen metin (`dict.fleet.select`). */
  label: string;
  /** Üç kart aynı metni taşıdığı için araç adını içeren erişilebilir ad (`dict.fleet.selectAria`). */
  ariaLabel: string;
}

/** "Bu aracı seç": tercih edilen aracı widget'a iletir ve widget'a kaydırır. */
export function FleetSelectButton({ id, label, ariaLabel }: FleetSelectButtonProps) {
  return (
    <Button variant="secondary" full aria-label={ariaLabel} onClick={() => prefillBookingWidget({ vehicle: id })}>
      {label}
    </Button>
  );
}
