import { useSyncExternalStore } from "react";
import type { CartLine, DeliveryType } from "@/lib/cart";

export type CartState = { lines: CartLine[]; delivery: DeliveryType };

const STORAGE_KEY = "maximus-cart-v1";
const EMPTY: CartState = { lines: [], delivery: "adres" };

let state: CartState | null = null;
const listeners = new Set<() => void>();

function load(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CartState>;
      return {
        lines: Array.isArray(parsed.lines) ? parsed.lines : [],
        delivery: parsed.delivery === "depo" ? "depo" : "adres",
      };
    }
  } catch {
    /* depolama kullanılamıyorsa boş sepetle devam et */
  }
  return EMPTY;
}

function getSnapshot(): CartState {
  if (state === null) state = load();
  return state;
}

function getServerSnapshot(): CartState {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateCart(updater: (prev: CartState) => CartState) {
  state = updater(getSnapshot());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sessizce geç */
  }
  listeners.forEach((l) => l());
}

export function useCartState(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noop = () => () => {};
/** İlk istemci render'ından sonra true olur; sunucuda daima false. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
