import tr from "./dictionaries/tr.json";
import { defaultLocale, type Locale } from "./config";

/** Türkçe sözlük tüm anahtarların kaynağıdır; diğer diller bunun kısmi kopyasıdır. */
export type Dictionary = typeof tr;

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Derin birleştirme: `override` içinde bulunan anahtarlar `base` üzerine yazılır,
 * eksik anahtarlar `base`'den (Türkçe) kalır. Diziler bütün olarak değiştirilir;
 * bir dilin SSS listesi Türkçe listeyle karıştırılmaz.
 */
export function deepMerge<T>(base: T, override: DeepPartial<T> | undefined | null): T {
  if (override === undefined || override === null) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const key of Object.keys(override)) {
      const overrideValue = (override as Record<string, unknown>)[key];
      if (overrideValue === undefined || overrideValue === null) continue;
      const baseValue = (base as Record<string, unknown>)[key];
      result[key] = isPlainObject(baseValue) && isPlainObject(overrideValue)
        ? deepMerge(baseValue, overrideValue as DeepPartial<typeof baseValue>)
        : overrideValue;
    }
    return result as T;
  }
  return override as T;
}

const cache = new Map<Locale, Dictionary>();

/**
 * Verilen dilin sözlüğünü döndürür. Dil dosyası kısmi ya da boş (`{}`) olsa bile
 * her anahtar Türkçe yedeğiyle dolu gelir.
 */
export async function getDictionary(locale: Locale): Promise<Dictionary> {
  if (locale === defaultLocale) return tr;
  const cached = cache.get(locale);
  if (cached) return cached;
  const mod = (await import(`./dictionaries/${locale}.json`)) as { default: DeepPartial<Dictionary> };
  const merged = deepMerge(tr, mod.default);
  cache.set(locale, merged);
  return merged;
}
