"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { routeSlugs, type Locale, type RouteKey } from "@/i18n/config";

/** Geçerli sayfanın diğer dildeki karşılığına bağlantı. Blog yazıları için dizin sayfasına gider. */
export function altPathFor(pathname: string, lang: Locale): string {
  const other: Locale = lang === "nl" ? "tr" : "nl";
  const segs = pathname.split("/").filter(Boolean);
  if (lang === "tr" && segs[0] === "tr") segs.shift();
  const first = segs[0];
  let rest: string[] = [];
  if (first) {
    const key = (Object.keys(routeSlugs) as RouteKey[]).find((k) => routeSlugs[k][lang] === first);
    if (key) {
      rest = [routeSlugs[key][other], ...segs.slice(1)];
      if (key === "blog" && segs[1]) rest = [routeSlugs[key][other]]; // yazı slug'ları dile özgü
    } else {
      rest = segs;
    }
  }
  const path = "/" + rest.join("/");
  return other === "nl" ? (path === "/" ? "/" : path) : `/tr${path === "/" ? "" : path}`;
}

export default function LangSwitch({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const href = altPathFor(pathname, lang);
  return (
    <Link href={href} hrefLang={lang === "nl" ? "tr" : "nl-BE"} aria-label={t.header.langSwitchAria} className={className}>
      {t.header.langSwitch}
    </Link>
  );
}
