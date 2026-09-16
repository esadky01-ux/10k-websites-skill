import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
  /** `label` yerine `span` kullan (grup/spinbutton gibi label'ı olmayan öğeler için). */
  labelAs?: "label" | "span";
  labelId?: string;
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/** Etiket + alan + ipucu + hata düzeni. Hata `aria-describedby` ile alana bağlanır. */
export function FieldShell({ id, label, required, hint, error, className = "", children, labelAs = "label", labelId }: FieldShellProps) {
  const labelClass = "mb-1.5 block text-sm font-medium text-paper";
  return (
    <div className={className}>
      {labelAs === "label" ? (
        <label htmlFor={id} className={labelClass} id={labelId}>
          {label}
          {required ? (
            <span className="text-taxi" aria-hidden="true">
              {" "}*
            </span>
          ) : null}
        </label>
      ) : (
        <span className={labelClass} id={labelId ?? `${id}-label`}>
          {label}
          {required ? (
            <span className="text-taxi" aria-hidden="true">
              {" "}*
            </span>
          ) : null}
        </span>
      )}
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        // Sarı hem CTA hem hata rengi olduğu için mesaj bir uyarı simgesiyle gelir:
        // renk tek başına "buraya tıkla" ile "burada hata var" ayrımını taşımaz.
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-taxi" aria-live="polite">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses =
  "block w-full rounded-md border border-line-strong bg-ink px-3.5 text-base text-paper placeholder:text-muted transition-colors motion-reduce:transition-none hover:border-muted focus:border-taxi focus:outline-none focus:ring-2 focus:ring-taxi/40 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-taxi";
