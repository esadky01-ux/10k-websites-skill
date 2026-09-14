"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { defaultLocale, localeFlag, localeNames, localeShort, locales, routeKeyForSlug, routeSlugs, type Locale } from "@/i18n/config";

/**
 * Geçerli sayfanın başka bir dildeki karşılığının yolu.
 * Rota parçası dile göre çevrilir (/tr/siparis → /fr/commander). Blog yazılarının slug'ları
 * dile özgü olduğundan yazı sayfasından blog dizinine gidilir.
 */
export function altPathFor(pathname: string, lang: Locale, target: Locale): string {
  const segs = pathname.split("/").filter(Boolean);
  if (lang !== defaultLocale && segs[0] === lang) segs.shift();
  let rest: string[] = [];
  if (segs[0]) {
    const key = routeKeyForSlug(lang, segs[0]);
    if (key) {
      rest = [routeSlugs[key][target], ...segs.slice(1)];
      if (key === "blog" && segs[1]) rest = [routeSlugs[key][target]]; // yazı slug'ları dile özgü
    } else {
      rest = segs;
    }
  }
  const path = "/" + rest.join("/");
  const clean = path === "/" ? "" : path.replace(/\/$/, "");
  return target === defaultLocale ? clean || "/" : `/${target}${clean}`;
}

function Flag({ lang }: { lang: Locale }) {
  return (
    <span aria-hidden className="text-base leading-none">
      {localeFlag[lang]}
    </span>
  );
}

/**
 * Dil seçici.
 *  - "dropdown" (varsayılan): dar üst çubuk için bayrak + kod düğmesi, tıklayınca liste açar.
 *  - "inline": bütün diller doğrudan görünür (mobil menüde açılır liste ekrandan taşıyordu).
 */
export default function LangSwitch({ className = "", variant = "dropdown" }: { className?: string; variant?: "dropdown" | "inline" }) {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (variant === "inline") {
    return (
      <div className={className} data-testid="lang-inline">
        <p className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-ink-500">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          {t.header.langSwitch}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={t.header.langSwitchAria}>
          {locales.map((l) => {
            const active = l === lang;
            return (
              <Link
                key={l}
                href={altPathFor(pathname, lang, l)}
                hrefLang={l}
                lang={l}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "border-brand-500 bg-brand-50 text-brand-600" : "border-cream-200 bg-white text-ink-800 hover:border-ink-300"
                }`}
                data-testid={`lang-option-${l}`}
              >
                <Flag lang={l} />
                <span className="truncate">{localeNames[l]}</span>
                {active && <Check className="ms-auto h-4 w-4 shrink-0" aria-hidden />}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.header.langSwitchAria}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 ${className}`}
        data-testid="lang-switch"
      >
        <Flag lang={lang} />
        <span>{localeShort[lang]}</span>
      </button>
      {open && (
        <div role="menu" aria-label={t.header.langSwitch} className="absolute end-0 top-full z-50 mt-2 min-w-48 overflow-hidden rounded-2xl border border-cream-200 bg-white py-1 shadow-xl" data-testid="lang-menu">
          {locales.map((l) => (
            <Link
              key={l}
              href={altPathFor(pathname, lang, l)}
              hrefLang={l}
              role="menuitem"
              onClick={() => setOpen(false)}
              lang={l}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition ${l === lang ? "font-bold text-brand-600" : "text-ink-700 hover:bg-cream-100"}`}
              data-testid={`lang-option-${l}`}
            >
              <Flag lang={l} />
              <span>{localeNames[l]}</span>
              {l === lang && <Check className="ms-auto h-4 w-4 shrink-0" aria-hidden />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
