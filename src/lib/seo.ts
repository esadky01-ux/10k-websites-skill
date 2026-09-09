import type { Metadata } from "next";
import { site } from "@/lib/site";
import { localePath, type Locale, type RouteKey } from "@/i18n/config";

/** İki dilli canonical + hreflang alternates üretir. */
export function alternatesFor(lang: Locale, route?: RouteKey, rest?: string, query?: string): NonNullable<Metadata["alternates"]> {
  const nl = localePath("nl", route, rest, query);
  const tr = localePath("tr", route, rest, query);
  return {
    canonical: lang === "nl" ? nl : tr,
    languages: { "nl-BE": nl, tr, "x-default": nl },
  };
}

export function absoluteUrl(path: string): string {
  return `${site.url}${path === "/" ? "" : path}`;
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
