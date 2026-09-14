/**
 * Diller ve dile göre URL yapısı.
 *
 * Kürtçe ve Arapça bilerek arayüz dili değildir: bu müşteriler siteyi Türkçe, Hollandaca, Fransızca veya
 * İngilizce okur ama siparişi kendi dilinde konuşur. İkisi de yalnızca sesli asistanda yaşar
 * (canlı plasiyer Kürtçe ve Arapça konuşur); bkz. src/server/voice/live.ts ve src/data/voice-vocab.ts.
 *
 * Yeni bir dili kaldırmak/eklemek için tek yer burasıdır: `locales` dizisinden adını çıkarmak
 * (ve src/i18n/<dil>.ts dosyasını silmek) o dili siteden tamamen kaldırır; başka hiçbir dosya değişmez.
 *
 * İki katman vardır:
 *  - Arayüz dilleri (`locales`): menü, sepet, formlar, sesli asistan — hepsi altı dilde.
 *  - İçerik dilleri (`contentLocales`): 28 bölge sayfasının şehir metinleri, blog yazıları ve
 *    ürün adları yalnızca Hollandaca ve Türkçe yazılıdır. Diğer diller bu metinleri
 *    `contentLocale` eşlemesindeki dilden alır; o sayfalar arama motorlarına `noindex` verilir ve
 *    canonical etiketi asıl dildeki sayfayı gösterir (kopya/ince içerik cezası olmasın diye).
 */
export const locales = ["nl", "fr", "en", "tr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "nl";

export function isLocale(v: string | undefined): v is Locale {
  return locales.includes(v as Locale);
}

/** Uzun içeriğin (bölge metinleri, blog, ürün adları) gerçekten yazılı olduğu diller. */
export const contentLocales = ["nl", "tr"] as const;
export type ContentLocale = (typeof contentLocales)[number];

export function isContentLocale(v: string | undefined): v is ContentLocale {
  return contentLocales.includes(v as ContentLocale);
}

/**
 * Arayüz dili → içerik dili.
 * Fransızca/İngilizce/Arapça konuşan müşteri ürünü faturada ve kolinin üstünde yazdığı gibi
 * (Hollandaca) görür; Kürtçe arayüzde Türkçe ürün adı gösterilir.
 */
export const contentLocale: Record<Locale, ContentLocale> = { nl: "nl", fr: "nl", en: "nl", tr: "tr" };

/** Dil değiştiricide gösterilen kendi dilindeki adlar. */
export const localeNames: Record<Locale, string> = { nl: "Nederlands", fr: "Français", en: "English", tr: "Türkçe" };
export const localeShort: Record<Locale, string> = { nl: "NL", fr: "FR", en: "EN", tr: "TR" };

/** Uygulama rotaları: klasör adları Hollandaca, URL parçaları dile göre. */
export const routeSlugs = {
  order: { nl: "bestellen", fr: "commander", en: "order", tr: "siparis" },
  blog: { nl: "blog", fr: "blog", en: "blog", tr: "blog" },
  regions: { nl: "regio", fr: "zones", en: "regions", tr: "bolgeler" },
  account: { nl: "account", fr: "compte", en: "account", tr: "hesap" },
  login: { nl: "inloggen", fr: "connexion", en: "login", tr: "giris" },
  register: { nl: "registreren", fr: "inscription", en: "register", tr: "kayit" },
  admin: { nl: "beheer", fr: "beheer", en: "beheer", tr: "yonetim" },
} as const;

export type RouteKey = keyof typeof routeSlugs;

/** Dil ve rota anahtarından URL üretir: localePath("tr","order") → "/tr/siparis" */
export function localePath(lang: Locale, route?: RouteKey, rest?: string, query?: string): string {
  const prefix = lang === defaultLocale ? "" : `/${lang}`;
  let path = prefix;
  if (route) path += `/${routeSlugs[route][lang]}`;
  if (rest) path += `/${rest.replace(/^\//, "")}`;
  if (!path) path = "/";
  return query ? `${path}?${query}` : path;
}

/** Dile özgü URL parçasını Hollandaca klasör adına çevirir (proxy için). */
export function folderForSlug(lang: Locale, slug: string): string {
  for (const key of Object.keys(routeSlugs) as RouteKey[]) {
    if (routeSlugs[key][lang] === slug) return routeSlugs[key].nl;
  }
  return slug;
}

/** Rota anahtarını URL parçasından bulur (dil değiştirici için). */
export function routeKeyForSlug(lang: Locale, slug: string): RouteKey | undefined {
  return (Object.keys(routeSlugs) as RouteKey[]).find((k) => routeSlugs[k][lang] === slug);
}

export const ogLocale: Record<Locale, string> = { nl: "nl_BE", fr: "fr_BE", en: "en_GB", tr: "tr_TR" };
export const htmlLang: Record<Locale, string> = { nl: "nl-BE", fr: "fr-BE", en: "en", tr: "tr" };
/** Sayı, para ve tarih biçimlendirme yerel ayarı. */
export const intlLocale: Record<Locale, string> = { nl: "nl-BE", fr: "fr-BE", en: "en-GB", tr: "tr-TR" };
