"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

interface NavLinksProps {
  items: NavItem[];
  /** `header`: yatay masaüstü menüsü; `mobile`: dikey çekmece menüsü. */
  variant?: "header" | "mobile";
  /** Bir bağlantıya tıklanınca çağrılır (mobil menüyü kapatmak için). */
  onNavigate?: () => void;
  className?: string;
}

const styles = {
  header: {
    list: "flex items-center gap-1",
    link: "inline-flex min-h-10 items-center rounded-md px-2.5 text-sm font-medium transition-colors motion-reduce:transition-none hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi",
    active: "text-paper underline decoration-taxi decoration-2 underline-offset-8",
    idle: "text-muted",
  },
  mobile: {
    list: "flex flex-col gap-1",
    link: "flex min-h-12 items-center rounded-md border-l-2 px-4 text-lg font-bold transition-colors motion-reduce:transition-none hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-taxi",
    active: "border-taxi bg-ink-soft text-paper",
    idle: "border-transparent text-paper",
  },
} as const;

function trimSlash(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

/** Sorgu ve parça atılır; dil kökü (`/tr`) yalnızca tam eşleşmede, diğer sayfalar alt yollarında da aktiftir. */
function isActive(pathname: string, href: string): boolean {
  const target = trimSlash(href.split(/[?#]/)[0] ?? href);
  const current = trimSlash(pathname);
  if (current === target) return true;
  const isLocaleRoot = target.split("/").length <= 2;
  return !isLocaleRoot && current.startsWith(`${target}/`);
}

/** Menü bağlantıları; aktif sayfa `aria-current="page"` ile işaretlenir. */
export function NavLinks({ items, variant = "header", onNavigate, className = "" }: NavLinksProps) {
  const pathname = usePathname();
  const style = styles[variant];
  return (
    <ul className={`${style.list} ${className}`}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`${style.link} ${active ? style.active : style.idle}`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
