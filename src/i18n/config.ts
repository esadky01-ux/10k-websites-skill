export const locales = ["nl", "tr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "nl";

export function isLocale(v: string | undefined): v is Locale {
  return locales.includes(v as Locale);
}

/** Uygulama rotaları: klasör adları Hollandaca, URL parçaları dile göre. */
export const routeSlugs = {
  order: { nl: "bestellen", tr: "siparis" },
  blog: { nl: "blog", tr: "blog" },
  regions: { nl: "regio", tr: "bolgeler" },
  account: { nl: "account", tr: "hesap" },
  login: { nl: "inloggen", tr: "giris" },
  register: { nl: "registreren", tr: "kayit" },
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

/** Türkçe URL parçasını Hollandaca klasör adına çevirir (proxy için). */
export function folderForSlug(lang: Locale, slug: string): string {
  for (const key of Object.keys(routeSlugs) as RouteKey[]) {
    if (routeSlugs[key][lang] === slug) return routeSlugs[key].nl;
  }
  return slug;
}

export const ogLocale: Record<Locale, string> = { nl: "nl_BE", tr: "tr_TR" };
export const htmlLang: Record<Locale, string> = { nl: "nl-BE", tr: "tr" };
