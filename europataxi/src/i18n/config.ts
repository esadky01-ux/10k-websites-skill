/**
 * Dil yapılandırması. Yeni bir dil eklemek için:
 *  1. `src/i18n/dictionaries/<kod>.json` dosyasını oluşturun (boş `{}` bile olabilir;
 *     eksik anahtarlar otomatik olarak Türkçeye düşer).
 *  2. Aşağıdaki `localeConfig` nesnesine tek bir satır ekleyin.
 * Başka hiçbir dosyaya dokunmak gerekmez: URL yönlendirmesi, dil seçici, hreflang,
 * sitemap ve statik sayfa üretimi bu nesneden beslenir.
 */
export const localeConfig = {
  tr: { name: "Türkçe", short: "TR", intl: "tr-TR", hrefLang: "tr" },
  en: { name: "English", short: "EN", intl: "en-GB", hrefLang: "en" },
  fr: { name: "Français", short: "FR", intl: "fr-FR", hrefLang: "fr" },
} as const;

export type Locale = keyof typeof localeConfig;

export const locales = Object.keys(localeConfig) as Locale[];

export const defaultLocale: Locale = "tr";

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(localeConfig, value);
}

/** `Intl` API'leri için BCP 47 dil etiketi (ör. fiyat biçimlendirme). */
export function intlLocale(locale: Locale): string {
  return localeConfig[locale].intl;
}
