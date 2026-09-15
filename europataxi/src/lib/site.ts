/**
 * Site geneli yapılandırma: iletişim bilgileri ve sosyal medya bağlantıları.
 * Çevrilebilir metinler burada değil, `src/i18n/dictionaries/*.json` içindedir.
 */
export const site = {
  name: "Europataxi",
  /** Canonical, hreflang, sitemap ve Open Graph için mutlak adres. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
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
