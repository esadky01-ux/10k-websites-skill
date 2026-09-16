import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { describedBy } from "./FieldShell";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, label, error, required, className = "", wrapperClassName = "", ...props },
  ref,
) {
  return (
    <div className={wrapperClassName}>
      {/* min-h-11: onay kutusu 20 px, dokunma hedefi satırın tamamıdır. */}
      <div className="flex min-h-11 items-start gap-3 py-1">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, undefined, error)}
          className={`mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-line bg-ink accent-taxi focus:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${className}`}
          {...props}
        />
        <label htmlFor={id} className="cursor-pointer text-sm text-paper">
          {label}
          {required ? (
            <span className="text-taxi" aria-hidden="true">
              {" "}*
            </span>
          ) : null}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-taxi" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
});
