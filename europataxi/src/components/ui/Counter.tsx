"use client";

import { Minus, Plus } from "lucide-react";
import type { KeyboardEvent } from "react";
import { FieldShell, describedBy } from "./FieldShell";

export interface CounterProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** "Yolcu sayısı azalt" gibi, sözlükten doldurulmuş erişilebilir etiketler. */
  decreaseLabel: string;
  increaseLabel: string;
  hint?: string;
  error?: string;
  className?: string;
}

/** Artı/eksi sayaç. Orta alan klavyeyle kullanılabilen bir `spinbutton`'dır. */
export function Counter({ id, label, value, min, max, onChange, decreaseLabel, increaseLabel, hint, error, className }: CounterProps) {
  const labelId = `${id}-label`;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = { ArrowUp: value + 1, ArrowRight: value + 1, ArrowDown: value - 1, ArrowLeft: value - 1, Home: min, End: max, PageUp: value + 5, PageDown: value - 5 };
    if (e.key in map) {
      e.preventDefault();
      onChange(clamp(map[e.key] as number));
    }
  }

  const btn =
    "flex h-12 w-12 shrink-0 items-center justify-center text-content transition-colors motion-reduce:transition-none hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-taxi-ink disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} labelAs="span" labelId={labelId}>
      <div className="flex min-h-12 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface focus-within:border-taxi-ink">
        <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={decreaseLabel}>
          <Minus aria-hidden="true" className="h-5 w-5" />
        </button>
        <div
          id={id}
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={String(value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onKeyDown={onKeyDown}
          className="flex flex-1 select-none items-center justify-center border-x border-line-strong text-lg font-bold tabular-nums text-content focus-visible:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-taxi-ink"
        >
          {value}
        </div>
        <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={increaseLabel}>
          <Plus aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </FieldShell>
  );
}
