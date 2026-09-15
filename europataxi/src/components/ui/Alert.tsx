import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

interface AlertProps {
  tone: "error" | "success" | "info";
  title?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
}

const icons = { error: AlertTriangle, success: CheckCircle2, info: Info } as const;

/** Durum mesajı. Hata `role="alert"`, diğerleri `role="status"` ile duyurulur. */
export function Alert({ tone, title, children, className = "", id }: AlertProps) {
  const Icon = icons[tone];
  const toneClass =
    tone === "error"
      ? "border-taxi bg-ink-soft text-paper"
      : tone === "success"
        ? "border-taxi bg-ink-soft text-paper"
        : "border-line bg-ink-soft text-paper";
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-md border px-4 py-3 ${toneClass} ${className}`}>
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-taxi" />
      <div className="text-sm">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className={title ? "mt-1 text-muted" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}
