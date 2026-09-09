"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CartLine, DeliveryType } from "@/lib/cart";
import { updateCart, useCartState, useHydrated } from "@/lib/cartStore";

type CartContextValue = {
  lines: CartLine[];
  delivery: DeliveryType;
  isOpen: boolean;
  hydrated: boolean;
  setDelivery: (d: DeliveryType) => void;
  setQuantity: (productId: string, cases: number, units: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Sepeti verilen satırlarla değiştirir (tekrar sipariş / kayıtlı liste). */
  loadLines: (lines: CartLine[]) => void;
  open: () => void;
  close: () => void;
  totalCases: number;
  totalUnits: number;
  lineCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { lines, delivery } = useCartState();
  const hydrated = useHydrated();
  const [isOpen, setIsOpen] = useState(false);

  const setDelivery = useCallback((d: DeliveryType) => {
    updateCart((prev) => ({ ...prev, delivery: d }));
  }, []);

  const setQuantity = useCallback((productId: string, cases: number, units: number) => {
    const c = Math.max(0, Math.floor(cases));
    const u = Math.max(0, Math.floor(units));
    updateCart((prev) => {
      const others = prev.lines.filter((l) => l.productId !== productId);
      if (c === 0 && u === 0) return { ...prev, lines: others };
      const next: CartLine = { productId, cases: c, units: u };
      const exists = prev.lines.some((l) => l.productId === productId);
      return {
        ...prev,
        lines: exists ? prev.lines.map((l) => (l.productId === productId ? next : l)) : [...others, next],
      };
    });
  }, []);

  const remove = useCallback((productId: string) => {
    updateCart((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.productId !== productId) }));
  }, []);

  const clear = useCallback(() => updateCart((prev) => ({ ...prev, lines: [] })), []);
  const loadLines = useCallback((next: CartLine[]) => {
    updateCart((prev) => ({ ...prev, lines: next.filter((l) => l.cases > 0 || l.units > 0).map((l) => ({ productId: l.productId, cases: Math.floor(l.cases), units: Math.floor(l.units) })) }));
  }, []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const totalCases = lines.reduce((s, l) => s + l.cases, 0);
    const totalUnits = lines.reduce((s, l) => s + l.units, 0);
    return {
      lines,
      delivery,
      isOpen,
      hydrated,
      setDelivery,
      setQuantity,
      remove,
      clear,
      loadLines,
      open,
      close,
      totalCases,
      totalUnits,
      lineCount: lines.length,
    };
  }, [lines, delivery, isOpen, hydrated, setDelivery, setQuantity, remove, clear, loadLines, open, close]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart yalnızca CartProvider içinde kullanılabilir");
  return ctx;
}
