"use client";

export interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  className?: string;
}

/** Erişilebilir anahtar (`role="switch"`). Boşluk/Enter ile değişir. */
export function Toggle({ id, label, checked, onChange, hint, className = "" }: ToggleProps) {
  return (
    <div className={className}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className="group flex w-full items-center gap-3 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors motion-reduce:transition-none ${
            checked ? "border-taxi bg-taxi" : "border-line bg-ink-soft group-hover:border-muted"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${
              checked ? "translate-x-6 bg-ink" : "translate-x-1 bg-muted"
            }`}
          />
        </span>
        <span className="text-sm font-medium text-paper">{label}</span>
      </button>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 pl-[3.75rem] text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
