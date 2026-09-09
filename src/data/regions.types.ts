/**
 * Bölge SEO sayfaları için veri şeması.
 * Her bölge /regio/[slug] (NL) ve /tr/bolgeler/[slug] (TR) altında ayrı bir sayfa olur.
 * Yeni bölge eklemek için regions.ts dizisine bir kayıt eklemek yeterlidir.
 */
export type RegionFaq = { q: string; a: string };

export type Region = {
  /** URL parçası, küçük harf, tire ile: "sint-truiden" */
  slug: string;
  /** Şehir adı (Hollandaca resmî yazım) */
  name: string;
  /** Vlaams-Brabant, Antwerpen, Limburg, Oost-Vlaanderen, West-Vlaanderen, Brussel */
  province: string;
  /** Başlıca posta kodları */
  postcodes: string[];
  /** Aarschot deposuna karayolu mesafesi (km, yaklaşık) */
  distanceKm: number;
  /** Depodan sürüş süresi (dk, yaklaşık) */
  driveMinutes: number;
  /** Teslimat günleri (Hollandaca kısaltma): ["ma", "do"] */
  deliveryDays: string[];
  /** Coğrafi konum (GEO meta ve JSON-LD için) */
  lat: number;
  lng: number;
  /** Bu bölgeye bağlı komşu gemeenten / deelgemeenten (iç bağlantı ve uzun kuyruk aramalar için) */
  nearby: string[];
  /** Hollandaca içerik */
  nl: {
    /** SEO başlığı (55-60 karakter) */
    metaTitle: string;
    /** SEO açıklaması (140-155 karakter) */
    metaDescription: string;
    /** H1 */
    h1: string;
    /** 2-3 paragraf, bölgeye özgü, 120-180 kelime toplam; HTML <p> etiketleriyle */
    intro: string;
    /** Bölgedeki horeca profiline dair 1 paragraf (döner, pizzeria, frituur, snackbar yoğunluğu, öğrenci nüfusu, turizm vb.) */
    localProfile: string;
    faq: RegionFaq[];
  };
  /** Türkçe içerik */
  tr: {
    metaTitle: string;
    metaDescription: string;
    h1: string;
    intro: string;
    localProfile: string;
    faq: RegionFaq[];
  };
};
