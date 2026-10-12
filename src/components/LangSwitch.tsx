"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { translatedPost } from "@/data/blog";
import { contentLocale, defaultLocale, isLocale, localeFlag, localeNames, localeShort, locales, routeKeyForSlug, routeSlugs, type Locale } from "@/i18n/config";

/**
 * Geçerli sayfanın başka bir dildeki karşılığının yolu.
 * Rota parçası dile göre çevrilir (/tr/siparis → /fr/commander). Blog yazısı slug'ları yalnızca
 * içerik dilleri (nl/tr) arasında farklıdır: o geçişte karşılık slug'a, karşılığı yoksa blog dizinine gidilir.
 */
export function altPathFor(pathname: string, lang: Locale, target: Locale): string {
  const segs = pathname.split("/").filter(Boolean);
  // SSG'de usePathname() iç rota yolunu verir (/bestellen → /nl/bestellen), tarayıcıda ise
  // görünen yolu. Baştaki dil parçası hangi dil olursa olsun (varsayılan dahil) atılır.
  if (isLocale(segs[0])) segs.shift();
  let rest: string[] = [];
  if (segs[0]) {
    // Yol parçası iki biçimde gelebilir: ziyaretçinin gördüğü dile özgü parça (/fr/commander) ya da
    // proxy'nin içeride yeniden yazdığı Hollandaca klasör adı (/fr/bestellen). İkisini de tanı.
    const key = routeKeyForSlug(lang, segs[0]) ?? routeKeyForSlug(defaultLocale, segs[0]);
    if (key) {
      rest = [routeSlugs[key][target], ...segs.slice(1)];
      // Yazı slug'ları yalnızca içerik dilleri (nl/tr) arasında farklıdır; nl/fr/en aynı slug'ı paylaşır.
      if (key === "blog" && segs[1] && contentLocale[lang] !== contentLocale[target]) {
        const other = translatedPost(lang, segs[1]);
        rest = other ? [routeSlugs[key][target], other.post.slug] : [routeSlugs[key][target]];
      }
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
 * Dil seçici. Açılır liste yoktur: diller her sayfada ilk bakışta görünür, ziyaretçi aramak zorunda kalmaz.
 *  - "bar"    (varsayılan): başlığın üst şeridinde bayrak + kısa kod; mobilde de görünür.
 *  - "inline": mobil menüde bayrak + dilin kendi adıyla iki sütunlu ızgara.
 */
export default function LangSwitch({ className = "", variant = "bar" }: { className?: string; variant?: "bar" | "inline" }) {
  const pathname = usePathname();
  const { lang, t } = useI18n();

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
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label={t.header.langSwitchAria} data-testid="lang-bar">
      <Globe className="me-0.5 hidden h-3.5 w-3.5 text-gold-500 sm:block" aria-hidden />
      {locales.map((l) => {
        const active = l === lang;
        return (
          <Link
            key={l}
            href={altPathFor(pathname, lang, l)}
            hrefLang={l}
            lang={l}
            aria-current={active ? "true" : undefined}
            title={localeNames[l]}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs leading-none transition ${
              active ? "bg-white/20 font-bold text-white" : "text-cream-100/75 hover:bg-white/10 hover:text-white"
            }`}
            data-testid={`lang-option-${l}`}
          >
            <Flag lang={l} />
            <span>{localeShort[l]}</span>
          </Link>
        );
      })}
    </div>
  );
}
