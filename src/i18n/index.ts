import { nl, type Dictionary } from "./nl";
import { fr } from "./fr";
import { en } from "./en";
import { tr } from "./tr";
import type { Locale } from "./config";

export type { Dictionary };
export {
  locales,
  defaultLocale,
  isLocale,
  localePath,
  routeSlugs,
  routeKeyForSlug,
  folderForSlug,
  ogLocale,
  htmlLang,
  intlLocale,
  localeNames,
  localeShort,
  contentLocales,
  contentLocale,
  isContentLocale,
} from "./config";
export type { Locale, RouteKey, ContentLocale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { nl, fr, en, tr };

export function getDictionary(lang: Locale): Dictionary {
  return dictionaries[lang] ?? nl;
}

/** "{year}" gibi yer tutucuları doldurur. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
