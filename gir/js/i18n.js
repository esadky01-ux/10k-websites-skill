/* ============================================================
   GIR Décor — i18n çalışma zamanı yardımcıları
   NOT: Arayüz metinleri build aşamasında statik HTML'e basılır
   (SEO). Bu dosya yalnızca JS'in ÜRETTİĞİ dinamik parçalar için
   (sepet satırları, arama sonuçları, sayaçlar) sayfaya gömülen
   window.__GIR_PAGE__.i18n mikro-sözlüğünü okur ve fiyat/metin
   biçimlendirme sağlar. Çalışma zamanında sayfa çevirisi YAPMAZ.
   ============================================================ */
(function (root) {
  "use strict";

  var page = root.__GIR_PAGE__ || { lang: "fr", i18n: {}, products: {}, root: "./" };

  /* "cart.subtotal" gibi nokta yollu anahtarı çözer, {param} doldurur */
  function t(key, params) {
    var value = key.split(".").reduce(function (acc, part) {
      return acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : null;
    }, page.i18n);
    if (typeof value !== "string") { return key; }
    if (params) {
      Object.keys(params).forEach(function (name) {
        value = value.split("{" + name + "}").join(String(params[name]));
      });
    }
    return value;
  }

  var priceFormatter = new Intl.NumberFormat(page.lang === "tr" ? "tr-TR" : "fr-BE", {
    style: "currency",
    currency: (root.GIR_CONFIG && root.GIR_CONFIG.currency) || "EUR"
  });

  function formatPrice(amount) {
    return priceFormatter.format(amount);
  }

  root.GIR_I18N = { t: t, formatPrice: formatPrice, lang: page.lang, page: page };
})(window);
