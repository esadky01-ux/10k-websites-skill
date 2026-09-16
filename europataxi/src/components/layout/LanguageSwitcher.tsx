"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { localeConfig, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { switchLocalePath } from "@/lib/paths";

interface LanguageSwitcherProps {
  locale: Locale;
  labels: Dictionary["languageSwitcher"];
  /** `sm`: header; `md`: mobil menü ve footer (daha büyük dokunma alanı). */
  size?: "sm" | "md";
  onNavigate?: () => void;
  className?: string;
}

interface SwitcherLinksProps extends LanguageSwitcherProps {
  /** Korunacak sorgu dizesi (`?from=...`); yoksa boş. */
  search: string;
}

const pillSizes = {
  sm: "min-h-10 min-w-10 px-3",
  md: "min-h-11 min-w-11 px-4",
} as const;

function SwitcherLinks({ locale, labels, size = "sm", onNavigate, className = "", search }: SwitcherLinksProps) {
  const pathname = usePathname();
  return (
    <div role="group" aria-label={labels.label} className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-ink-soft p-1 ${className}`}>
      {locales.map((target) => {
        const active = target === locale;
        return (
          <Link
            key={target}
            href={`${switchLocalePath(pathname, target)}${search}`}
            hrefLang={localeConfig[target].hrefLang}
            aria-current={active ? "true" : undefined}
            onClick={onNavigate}
            className={`inline-flex items-center justify-center rounded-full text-sm font-bold leading-none transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-ink-soft ${pillSizes[size]} ${
              active ? "bg-taxi text-ink" : "text-muted hover:text-paper"
            }`}
          >
            {localeConfig[target].short}
            {active ? <span className="sr-only"> ({labels.current})</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

/** Sorgu dizesini korur (`/tr/rezervasyon?from=...` → `/en/rezervasyon?from=...`); statik sayfalarda Suspense sınırı gerekir. */
function SwitcherWithQuery(props: LanguageSwitcherProps) {
  const query = useSearchParams().toString();
  return <SwitcherLinks {...props} search={query ? `?${query}` : ""} />;
}

/** TR / EN / FR bağlantıları; seçili dil `aria-current` ile işaretlenir. Diller `localeConfig`'ten gelir. */
export function LanguageSwitcher(props: LanguageSwitcherProps) {
  return (
    <Suspense fallback={<SwitcherLinks {...props} search="" />}>
      <SwitcherWithQuery {...props} />
    </Suspense>
  );
}
