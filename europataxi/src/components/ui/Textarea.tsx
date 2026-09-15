import { forwardRef, type TextareaHTMLAttributes } from "react";
import { FieldShell, controlClasses, describedBy } from "./FieldShell";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, hint, error, required, className = "", wrapperClassName, rows = 5, ...props },
  ref,
) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClasses} py-3 ${className}`}
        {...props}
      />
    </FieldShell>
  );
});
