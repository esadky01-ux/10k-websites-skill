# ROL
Sen kıdemli bir front-end mühendisi ve WooCommerce/e-ticaret UI uzmanısın. Görevin, referans siteyi yapısal olarak birebir taklit eden ama **GIR Décor** markasına ait, Fransızca + Türkçe iki dilli, tamamen çalışır ve responsive bir site inşa etmek. Tüm renkler tek bir CSS token dosyasından yönetilecek.

Referans site (yapı/layout kaynağı): https://www.tegelsvoordeel.nl/product-category/wandpanelen/bamboe-panelen/
(WordPress + WooCommerce tabanlı Hollandaca duvar paneli mağazası.)

Marka: **GIR Décor** (logodaki tam ad: "GIR Décoration — Carrelages et auvents pour fenêtres — Belgique"). Sitede kısa ad "GIR Décor" kullanılacak; logo dosyası `assets/img/logo/gir-decor-logo.jpg` projeye ZATEN eklenmiş durumda. Ürün görselleri de `assets/img/products/` altında hazır. Bu dosyaları kullan; yeniden indirme, uydurma.

Hiçbir şeyi tahmin etme. Önce referans siteyi analiz et, sonra inşa et. Her fazın sonunda kısa rapor ver ve durmadan devam et.

---

## FAZ 0 — Kurulum
1. Mevcut klasörde çalış (içinde `assets/img/...` hazır). `npm init -y && npm i -D playwright` (browser kuruluysa `playwright install` çalıştırma).
2. Hedef yapı:
```
./
├─ index.html                      (FR ana giriş → /fr/ yönlendirir veya FR içerik)
├─ fr/index.html                   (Ana sayfa FR)
├─ fr/panneaux-bambou.html         (Kategori: Panneaux en bambou — referansın kategori sayfası)
├─ fr/produit-[slug].html          (4 ürün detay sayfası)
├─ tr/index.html                   (Ana sayfa TR)
├─ tr/bambu-paneller.html          (Kategori: Bambu Paneller)
├─ tr/urun-[slug].html             (4 ürün detay sayfası)
├─ css/tokens.css                  (SADECE renk/font/spacing değişkenleri)
├─ css/main.css
├─ js/main.js, js/i18n.js, js/config.js
├─ data/products.json              (ürünler, FR+TR alanlarıyla)
├─ data/i18n/fr.json, tr.json      (tüm arayüz metinleri)
├─ assets/img/logo/gir-decor-logo.jpg          (HAZIR)
├─ assets/img/products/<slug>/...              (HAZIR)
└─ analysis/                       (referans ekran görüntüleri, çıkarılan CSS, notlar)
```

## FAZ 1 — Referans siteyi analiz et (kod yazmadan önce ZORUNLU)
Playwright ile şu sayfaları ziyaret et, `analysis/` içine kaydet:
- Kategori sayfası (1440 / 768 / 390 px tam sayfa ekran görüntüleri)
- Üst kategori: https://www.tegelsvoordeel.nl/product-category/wandpanelen/
- Bir ürün sayfası: https://www.tegelsvoordeel.nl/product/tussenprofiel-voor-bamboe/
- Ana sayfa (header/footer/hero referansı)

`analysis/notes.md` içine çıkar:
1. **DOM yapısı**: top/USP bar, header (logo, ana menü + alt menüler, arama, hesap, sepet), breadcrumb, kategori başlığı + açıklama, sidebar filtreleri (kategori listesi, fiyat slider, özellikler), sıralama + sonuç sayısı, ürün grid'i, sayfalama, ürün detay sayfası (galeri, fiyat bloğu, varyasyon seçici, sekmeler: açıklama/özellikler/yorumlar), footer (kolonlar, iletişim, ödeme ikonları, güven rozetleri, sosyal medya).
2. **Ürün kartı anatomisi**: görsel oranı, hover davranışı (ikinci görsel), badge'ler, ad, fiyat/m², eski fiyat, KDV notu, stok, buton.
3. **Computed CSS** (`getComputedStyle`): arka plan, metin, birincil/ikincil/vurgu renkleri, header/footer arka planı, border'lar, font-family (Google Fonts URL'si), h1–h4 boyutları, buton padding/radius, container genişliği, grid gap, kart gölgesi.
4. **Tema/plugin tespiti**: `wp-content/themes/...` ve pluginler — sadece ipucu; sen WordPress'e bağımlı OLMAYAN saf HTML/CSS/JS üreteceksin.
5. **Etkileşimler**: hamburger menü, arama, sepet drawer, filtre accordion, fiyat slider, galeri/lightbox, cookie bar.
Referans sitedeki ürün verilerini ve görsellerini KOPYALAMA; yalnızca layout, ölçü ve etkileşim referansı olarak kullan.

## FAZ 2 — Marka ve renk sistemi (en kritik gereksinim)
**Logo analizi:** `assets/img/logo/gir-decor-logo.jpg` dosyasını aç, baskın renkleri örnekle. Beklenen palet: lacivert (~#1B2E4B / #14294A), altın-hardal (~#C9973A / #B8862B), kırık beyaz zemin (~#F6F2EA), gri (~#8A8F99). Gerçek değerleri görselden ölç ve `tokens.css` varsayılan temasını BU paletle kur.
- Logonun kırık-beyaz zeminini sitede header zemini olarak kullan; ya da arka planı şeffaf yapmak için görseli işleyerek `assets/img/logo/gir-decor-logo.png` üret (arka plan kaldırma; kalite düşerse orijinal jpg ile kal ve raporla).
- Ek olarak `assets/img/logo/gir-decor-mark.svg`: sadece "GIR" harflerinden oluşan SVG ikon-logo (favicon, mobil header ve footer için). Harf formlarını logoya sadık, `--color-primary` ve `--color-accent` token'larını kullanan SVG olarak çiz.
- Logo görseli, marka adı ve slogan tek yerden (`js/config.js` içindeki `BRAND` objesi) değiştirilebilir olsun: `{ name:"GIR Décor", fullName:"GIR Décoration", tagline:{fr:"Carrelages et auvents pour fenêtres", tr:"Fayans ve pencere sundurmaları"}, country:"Belgique", logo:"...", mark:"..." }`.

Tüm renkler YALNIZCA `css/tokens.css` içinde; `main.css` içinde tek bir hard-coded hex/rgb olmayacak:
```css
:root{
  --color-primary: /*lacivert*/; --color-primary-hover:; --color-secondary:;
  --color-accent: /*altın*/; --color-accent-hover:;
  --color-bg: /*kırık beyaz*/; --color-surface:; --color-header-bg:; --color-topbar-bg:;
  --color-footer-bg:; --color-footer-text:;
  --color-text:; --color-text-muted:; --color-link:; --color-price:; --color-price-old:;
  --color-border:; --color-success:; --color-badge:;
  --font-heading: /*logodaki serif'e yakın: Playfair Display veya Cormorant*/;
  --font-body: /*Inter / Montserrat*/;
  --radius:; --shadow-card:; --container:;
}
```
`tokens.css` altına **3 alternatif tema** ekle (`[data-theme="..."]` blokları): `navy-gold` (varsayılan, logodan), `warm-clay` (kil kahvesi + bej — ürün tonlarına uygun), `charcoal-brass` (antrasit + pirinç), `sage-linen` (adaçayı yeşili + keten). `<html data-theme>` değişince tüm site tutarlı biçimde renk değiştirmeli. Sağ alta silinebilir `#dev-theme-switcher` koy (dropdown).

## FAZ 3 — İçerik ve ürün verisi
Ürünler (hepsi 122 × 280 cm, 5 mm, Premium Mat, sürdürülebilir bambu):
| slug | SKU | FR ad | TR ad | Görseller (assets/img/products/<slug>/) |
|---|---|---|---|---|
| ivory-bp02 | BP02 | Panneau mural bambou naturel – Ivoire | Doğal Bambu Duvar Paneli – Fildişi | product, infographic, room |
| linen-bp03 | BP03 | Panneau mural bambou naturel – Lin | Doğal Bambu Duvar Paneli – Keten | product, infographic, room, texture |
| clay-bp06 | BP06 | Panneau mural bambou naturel – Argile | Doğal Bambu Duvar Paneli – Kil | product, infographic, room, texture |
| camel-bp10 | BP10 | Panneau mural bambou naturel – Camel | Doğal Bambu Duvar Paneli – Kamel | product, infographic, room, texture |

- `data/products.json`: her ürün için `sku, slug, name{fr,tr}, shortDesc{fr,tr}, description{fr,tr}, specs{finish, material, width, height, thickness, rooms[]}, price, oldPrice, unit ("par panneau"/"panel başı"), badge, images[]`. Fiyatları `PLACEHOLDER` olarak 89,00 € gibi makul değerlerle doldur ve raporda "fiyatlar geçicidir" diye belirt.
- Ürün kartı ana görseli = `*-product.jpg`; hover'da `*-room.jpg`. Ürün detay galerisi: product → room → infographic → texture. Renk seçici (swatch) olarak `*-texture.png` küçük daireler; Ivory için texture yoksa `product` görselinden kırpılmış bir swatch üret.
- "Ideaal voor ruimtes" bölümündeki 4 alanı (yatak odası, oturma odası, mutfak, ofis) ürün sayfasında ikonlu satır olarak FR/TR göster. İnfografikteki Hollandaca metinler görsel içinde kalıyor; bunu raporda belirt ve alt metinleri FR/TR yaz.
- Kategori açıklama metnini (~120 kelime, SEO'ya uygun) FR ve TR yaz. Ana sayfa: hero (room görseli + "GIR Décor" başlık), USP bar, öne çıkan 4 ürün, "Neden bambu?" 3 madde, iletişim/CTA (Belçika).
- Menü: Accueil / Panneaux muraux ▸ Panneaux en bambou / Carrelages / Auvents pour fenêtres / Contact — TR karşılıkları: Ana Sayfa / Duvar Panelleri ▸ Bambu Paneller / Fayanslar / Pencere Sundurmaları / İletişim. "Carrelages" ve "Auvents" sayfaları "Bientôt disponible / Yakında" yer tutucu sayfası olsun.

## FAZ 4 — İnşa
- Semantik HTML5, BEM, CSS Grid/Flexbox. Framework/Tailwind/jQuery YOK. Vanilla JS.
- **i18n**: her sayfa hem `fr/` hem `tr/` altında statik olarak üretilir (SEO için). Header'da FR | TR dil anahtarı, aynı sayfanın karşılığına gider (`<link rel="alternate" hreflang>` ekle). Arayüz metinleri `data/i18n/*.json`'dan build script'iyle (`node build.js`) statik HTML'e basılır; JS ile runtime çeviri yapma.
- `<html lang="fr">` / `lang="tr"`; Türkçe karakterler (ş, ğ, İ) için font desteğini doğrula.
- Kırılma noktaları 1200 / 992 / 768 / 480. Mobil: off-canvas menü, "Filtres / Filtreler" drawer, 2 kolon → 1 kolon.
- Header sticky; USP bar (ör. "Livraison en Belgique · Qualité premium · Devis gratuit" / TR karşılığı).
- Sıralama ve fiyat filtresi gerçekten çalışsın (client-side). Sepet: localStorage sayaç + drawer. Breadcrumb, sayfalama, sonuç sayısı çalışsın.
- Ürün detay: galeri + thumbnail + lightbox, swatch ile ürünler arası geçiş, sekmeler (Description / Caractéristiques / Livraison), "Ajouter au panier" / "Sepete ekle", "Demander un devis" / "Teklif iste" (mailto/form).
- Erişilebilirlik: alt metinler FR/TR, aria-label, focus stilleri, klavye navigasyonu.
- Performans: görseller `loading="lazy"`, width/height atanmış; büyük JPG'lerden (2000px) 400 / 800 / 1600 px WebP varyantları üret (`sharp` ile), `srcset` kullan. Lighthouse masaüstü ≥ 90.

## FAZ 5 — Doğrulama (bitmeden atlama)
1. Playwright ile klonun 1440/768/390 görüntülerini al, referansla yan yana `analysis/compare-*.png` üret; belirgin layout farklarını düzelt (en az 2 iterasyon).
2. `grep -rn "#[0-9a-fA-F]\{3,6\}\|rgb(" css/main.css` sonucu BOŞ olmalı.
3. 4 tema × 2 dil ekran görüntüsü; WCAG AA kontrast (≥ 4.5:1) kontrol et ve düzelt.
4. FR ve TR sayfaların hepsinde kırık link, eksik çeviri anahtarı, eksik görsel olmadığını script ile doğrula; `npx html-validate` hatasız; konsolda JS hatası yok.
5. Son rapor: dosya listesi, bilinçli sapmalar, geçici veriler (fiyatlar, iletişim bilgileri), renk ve marka değiştirme için 5 satırlık kullanım notu.

## KISITLAR
- Referans sitenin logosunu, ürün verisini, görsellerini, metinlerini KOPYALAMA — sadece yapı ve ölçü.
- Gerçek ödeme, hesap sistemi, üçüncü taraf script yok; görsel karşılıklarını statik taklit et.
- Dış CDN bağımlılığı sadece Google Fonts.
- Eksik bilgi varsa durup sorma; makul varsayımla devam et, raporda belirt.

Başla: FAZ 0–1'i uygula, analiz özetini ver, ardından durmadan FAZ 2–5'i tamamla.
