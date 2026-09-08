"use client";

import { Minus, Plus } from "lucide-react";

type Props = {
  value: number;
  onChange: (next: number) => void;
  label: string;
  compact?: boolean;
};

export default function QtyCounter({ value, onChange, label, compact = false }: Props) {
  const size = compact ? "h-8 w-8" : "h-9 w-9";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex items-center rounded-lg border ${
          value > 0 ? "border-brand-500 bg-brand-50" : "border-cream-200 bg-white"
        }`}
      >
        <button
          type="button"
          aria-label={`${label} azalt`}
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          className={`${size} flex items-center justify-center rounded-l-lg text-ink-700 transition hover:bg-cream-100 disabled:opacity-30`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          aria-label={label}
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) && n > 0 ? n : 0);
          }}
          className={`${compact ? "w-10" : "w-12"} bg-transparent text-center text-sm font-semibold text-ink-900 outline-none placeholder:text-ink-300`}
        />
        <button
          type="button"
          aria-label={`${label} artır`}
          onClick={() => onChange(value + 1)}
          className={`${size} flex items-center justify-center rounded-r-lg text-ink-700 transition hover:bg-cream-100`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</span>
    </div>
  );
}
