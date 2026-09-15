import { forwardRef, type InputHTMLAttributes } from "react";
import { FieldShell, controlClasses, describedBy } from "./FieldShell";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, required, className = "", wrapperClassName, ...props },
  ref,
) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <input
        ref={ref}
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClasses} min-h-12 ${className}`}
        {...props}
      />
    </FieldShell>
  );
});
