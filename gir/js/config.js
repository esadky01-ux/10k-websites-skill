/* ============================================================
   GIR Décor — Site yapılandırması
   Marka adı, logo, slogan ve iletişim bilgileri TEK yerden burada
   değiştirilir. build.js bu dosyayı Node tarafında da okur;
   tarayıcıda window.GIR_CONFIG olarak yayınlanır.
   ============================================================ */
(function (root, factory) {
  var cfg = factory();
  if (typeof module === "object" && module.exports) { module.exports = cfg; }
  if (root) { root.GIR_CONFIG = cfg; }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var BRAND = {
    name: "GIR Décor",
    fullName: "GIR Décoration",
    tagline: {
      fr: "Carrelages et auvents pour fenêtres",
      tr: "Fayans ve pencere sundurmaları"
    },
    country: "Belgique",
    /* Header'da kullanılan kompakt logo (şeffaf PNG, kırpılmış blok) */
    logo: "assets/img/logo/gir-decor-logo-header.png",
    /* Orijinal tam logo (ana sayfa / hakkında blokları için) */
    logoFull: "assets/img/logo/gir-decor-logo.jpg",
    /* Yalnız "GIR" harflerinden oluşan SVG ikon-logo (favicon, footer) */
    mark: "assets/img/logo/gir-decor-mark.svg"
  };

  var CONTACT = {
    /* GEÇİCİ / KURGUSAL iletişim bilgileri — yayına almadan önce değiştirin */
    phone: "+32 2 555 01 84",
    email: "info@girdecor.be",
    address: "Rue des Carreleurs 12, 1000 Bruxelles, Belgique",
    addressTr: "Rue des Carreleurs 12, 1000 Brüksel, Belçika",
    hours: { fr: "Lun–Sam : 9h00–18h00", tr: "Pzt–Cmt: 09.00–18.00" }
  };

  return {
    BRAND: BRAND,
    CONTACT: CONTACT,
    currency: "EUR",
    themes: ["navy-gold", "warm-clay", "charcoal-brass", "sage-linen"],
    defaultTheme: "navy-gold",
    storageKeys: { cart: "gir-cart", theme: "gir-theme", cookies: "gir-cookies" },
    /* 1 panel = 1,22 m × 2,80 m */
    panelArea: 1.22 * 2.8
  };
});
