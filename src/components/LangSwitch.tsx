"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { defaultLocale, localeNames, localeShort, locales, routeKeyForSlug, routeSlugs, type Locale } from "@/i18n/config";

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

export default function LangSwitch({ className = "" }: { className?: string }) {
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
        <Globe className="h-4 w-4" aria-hidden />
        <span>{localeShort[lang]}</span>
      </button>
      {open && (
        <div role="menu" aria-label={t.header.langSwitch} className="absolute end-0 top-full z-50 mt-2 min-w-44 overflow-hidden rounded-2xl border border-cream-200 bg-white py-1 shadow-xl" data-testid="lang-menu">
          {locales.map((l) => (
            <Link
              key={l}
              href={altPathFor(pathname, lang, l)}
              hrefLang={l}
              role="menuitem"
              onClick={() => setOpen(false)}
              lang={l}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition ${l === lang ? "font-bold text-brand-600" : "text-ink-700 hover:bg-cream-100"}`}
              data-testid={`lang-option-${l}`}
            >
              {l === lang ? <Check className="h-4 w-4 shrink-0" /> : <span className="w-4 shrink-0" />}
              <span>{localeNames[l]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
