"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/CartProvider";

export default function CartButton({ variant = "solid" }: { variant?: "solid" | "ghost" }) {
  const { open, lineCount, hydrated } = useCart();
  const base =
    variant === "solid"
      ? "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-900/20"
      : "bg-white/10 text-white hover:bg-white/20 border border-white/20";
  return (
    <button
      type="button"
      onClick={open}
      className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${base}`}
      aria-label="Sepetim"
    >
      <ShoppingCart className="h-4.5 w-4.5" />
      <span>Sepetim</span>
      {hydrated && lineCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-ink-900 ring-2 ring-white">
          {lineCount}
        </span>
      )}
    </button>
  );
}
