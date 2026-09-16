/**
 * Site geneli yapılandırma: iletişim bilgileri ve sosyal medya bağlantıları.
 * Çevrilebilir metinler burada değil, `src/i18n/dictionaries/*.json` içindedir.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

if (!siteUrl && process.env.NODE_ENV === "production") {
  // Canonical, hreflang, sitemap ve Open Graph adresleri derleme anında gömülür.
  // Değişken derlemeden önce tanımlanmazsa site canlıda localhost adresleri yayınlar.
  console.warn("[europataxi] NEXT_PUBLIC_SITE_URL tanımlı değil; canonical ve sitemap adresleri http://localhost:3000 olarak derlenecek.");
}

export const site = {
  name: "Europataxi",
  /** Canonical, hreflang, sitemap ve Open Graph için mutlak adres. */
  url: siteUrl || "http://localhost:3000",
  phone: { display: "+32 2 000 00 00", href: "tel:+3220000000", e164: "+3220000000" },
  email: "info@europataxi.com",
  whatsapp: "https://wa.me/3220000000",
  social: {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    linkedin: "https://www.linkedin.com/",
  },
  /** Kuruluş yılı; footer telif satırı sözlükten gelir, bu değer JSON-LD içindir. */
  foundingYear: 2016,
} as const;

/**
 * JSON-LD `sameAs` kimlik iddiasıdır: "bu kuruluş şu adrestir". Henüz gerçek profil
 * adresi girilmemiş yer tutucular (kök adresler) dışarıda bırakılır, yoksa site
 * kendini instagram.com ile aynı kuruluş ilan eder.
 */
export function socialProfileUrls(): string[] {
  return Object.values(site.social).filter((url) => {
    try {
      return new URL(url).pathname.replace(/\/$/, "") !== "";
    } catch {
      return false;
    }
  });
}
