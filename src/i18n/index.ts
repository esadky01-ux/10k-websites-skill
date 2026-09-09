import { nl, type Dictionary } from "./nl";
import { tr } from "./tr";
import type { Locale } from "./config";

export type { Dictionary };
export { locales, defaultLocale, isLocale, localePath, routeSlugs, folderForSlug, ogLocale, htmlLang } from "./config";
export type { Locale, RouteKey } from "./config";

const dictionaries: Record<Locale, Dictionary> = { nl, tr };

export function getDictionary(lang: Locale): Dictionary {
  return dictionaries[lang] ?? nl;
}

/** "{year}" gibi yer tutucuları doldurur. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
