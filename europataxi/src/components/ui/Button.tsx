import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface StyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-bold leading-none transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-taxi text-ink hover:bg-taxi-dark focus-visible:ring-paper",
  secondary: "border border-line bg-transparent text-paper hover:border-paper hover:bg-ink-soft focus-visible:ring-taxi",
  ghost: "bg-transparent text-paper hover:text-taxi focus-visible:ring-taxi",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-12 px-6 text-base",
  lg: "min-h-14 px-8 text-lg",
};

export function buttonClasses({ variant = "primary", size = "md", full = false, className = "" }: StyleOptions = {}): string {
  return [base, variants[variant], sizes[size], full ? "w-full" : "", className].filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleOptions {
  children: ReactNode;
}

export function Button({ variant, size, full, className, type = "button", children, ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, full, className })} {...props}>
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">, StyleOptions {
  href: string;
  children: ReactNode;
}

/** Bağlantı olarak davranan, buton görünümlü öğe (Next `Link`). */
export function ButtonLink({ href, variant, size, full, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, full, className })} {...props}>
      {children}
    </Link>
  );
}
