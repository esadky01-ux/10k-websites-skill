# GIR Décor — Panneaux en bambou / Bambu Paneller

FR + TR iki dilli, WordPress'e bağımlı olmayan statik WooCommerce-tarzı mağaza
klonu. Referans yapı: tegelsvoordeel.nl kategori/ürün sayfası anatomisi.
Saf HTML/CSS/JS — framework yok; tek dış bağımlılık Google Fonts.

## Çalıştırma

```bash
npm install          # yalnızca geliştirme araçları (sharp, playwright, html-validate)
node build.js        # data/ + js/config.js → fr/ ve tr/ altına 19 statik sayfa
node tools/serve.js  # http://127.0.0.1:8090 (veya herhangi bir statik sunucu)
```

Sayfalar üretilmiş hâlde repoda durur; `build.js` yalnızca içerik/çeviri
değişince gerekir.

## Marka ve renkleri değiştirme (5 satırda)

1. **Renkler:** yalnızca `css/tokens.css` — `:root` varsayılan (navy-gold);
   `[data-theme="…"]` blokları alternatif temalar. `main.css`'e renk yazmayın.
2. **Tema seçimi:** `<html data-theme="warm-clay">` (veya sağ alttaki
   `#dev-theme-switcher` — yayında bu bloğu silin).
3. **Marka adı/slogan/logo:** `js/config.js` içindeki `BRAND` objesi;
   iletişim bilgileri `CONTACT` objesi. Sonra `node build.js`.
4. **Metinler:** `data/i18n/fr.json` + `tr.json` (anahtar kümeleri eşit olmalı);
   ürünler `data/products.json`. Sonra `node build.js`.
5. **Görsel varyantları:** yeni ürün görseli eklerseniz `node tools/images.js`
   (400/800/1600 WebP + swatch üretir).

## Doğrulama araçları

```bash
node tools/validate.js       # kırık link, eksik görsel/alt, i18n anahtar eşitliği
node tools/contrast.js       # 4 tema × WCAG AA kontrast denetimi
npx html-validate index.html fr/*.html tr/*.html
node tools/serve.js & node tools/interactions.js   # 29 etkileşim duman testi
node tools/screenshot.js     # analysis/ altına 1440/768/390 + tema görüntüleri
```

## Bilinen geçici değerler

- Fiyatlar (89–99 €) ve tüm iletişim bilgileri (telefon, e-posta, adres)
  **PLACEHOLDER** — yayına almadan önce güncelleyin.
- İnfografik görsellerdeki gömülü metinler Hollandacadır (orijinal görseller);
  FR/TR açıklama notu sayfada gösterilir.
- `hreflang` bağlantıları göreli; yayında mutlak URL'ye çevirin
  (build.js → `head()` içinde tek satır).
