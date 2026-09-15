import type { Trip } from "@/types";
import { BOOKING_WIDGET_ID } from "./paths";

/**
 * Sayfa içi bileşenler (popüler rota kartları gibi) rezervasyon widget'ını bu
 * olayla doldurur. Widget `window` üzerinde dinler, alanları günceller ve
 * kendine kaydırır. Yalnızca istemci tarafında çağrılmalıdır.
 */
export const PREFILL_EVENT = "europataxi:prefill";

export type PrefillDetail = Partial<Pick<Trip, "from" | "to" | "date" | "time" | "passengers" | "luggage">>;

export function prefillBookingWidget(detail: PrefillDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PrefillDetail>(PREFILL_EVENT, { detail }));
  const el = document.getElementById(BOOKING_WIDGET_ID);
  if (el) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}
