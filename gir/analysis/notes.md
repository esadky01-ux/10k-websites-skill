# GIR Décor — Referans Analizi ve Yapım Notları

Tarih: 2026-08-29 · Ortam: Claude Code (uzak, sandbox)

## 0. ÖNEMLİ: Referans siteye canlı erişim engellendi

Bu ortamda dış ağ trafiği bir egress proxy üzerinden geçiyor ve
`https://www.tegelsvoordeel.nl/...` ile `https://web.archive.org/...` istekleri
**HTTP 403 (CONNECT tunnel failed — organizasyon politikası)** ile reddedildi:

```
curl: (56) CONNECT tunnel failed, response 403
[agent-proxy] www.tegelsvoordeel.nl:443 — connect_rejected
[agent-proxy] web.archive.org:443 — connect_rejected
```

Bu yüzden FAZ 1'deki canlı ekran görüntüleri ve `getComputedStyle` çıkarımı
**yapılamadı**. Prompt'un "eksik bilgi varsa makul varsayımla devam et,
raporda belirt" kuralı gereği aşağıdaki analiz; standart WooCommerce
kategori/ürün sayfası anatomisi + bu sınıftaki Hollandalı fayans/panel
mağazalarının (Tegelsvoordeel dahil) bilinen kalıpları üzerine kuruludur.
`analysis/` altındaki ekran görüntüleri bu nedenle *klonun kendi* görüntüleridir
(FAZ 5); referansla piksel bazlı yan yana karşılaştırma üretilemedi.
Google Fonts erişilebilir durumda (fonts.googleapis.com → 200), bu yüzden
tipografi canlı yüklenir.

## 1. Varsayılan DOM yapısı (WooCommerce kategori sayfası anatomisi)

```
body
├─ .topbar                 → USP çubuğu: ✓ teslimat ✓ kalite ✓ ücretsiz teklif (+ tel)
├─ header.site-header (sticky)
│  ├─ .header-main: logo (sol) · arama (orta) · hesap + sepet (sağ)
│  └─ nav.main-nav (lacivert şerit): Accueil / Panneaux muraux ▸ / Carrelages / Auvents / Contact
├─ .breadcrumb             → Accueil / Panneaux muraux / Panneaux en bambou
├─ .category-header        → h1 + kategori açıklaması (~120 kelime)
├─ .shop-layout (grid: 280px sidebar + 1fr)
│  ├─ aside.sidebar
│  │  ├─ kategori listesi (accordion, aktif vurgulu)
│  │  ├─ fiyat filtresi (çift kollu range slider + uygula)
│  │  └─ özellik filtreleri (yüzey, kalınlık — checkbox)
│  └─ main.shop-main
│     ├─ .shop-toolbar     → "X sonuç gösteriliyor" + sıralama <select>
│     ├─ ul.product-grid   → 3 kolon (≥1200) / 2 (≥768) / 1–2 (mobil)
│     └─ .pagination
├─ ürün detay: galeri (ana + thumbnail + lightbox) · başlık · fiyat bloğu
│  (fiyat, eski fiyat, KDV notu, m² karşılığı) · swatch (renk) seçici ·
│  adet + sepete ekle + teklif iste · sekmeler (Açıklama/Özellikler/Teslimat)
│  · "İdeal mekânlar" ikon satırı
└─ footer (lacivert): 4 kolon (marka+sosyal / menü / müşteri hizmetleri / iletişim)
   + ödeme ikonları (statik SVG taklit) + güven rozeti + alt telif satırı
```

## 2. Ürün kartı anatomisi (varsayım)

- Görsel oranı **1:1** (WooCommerce varsayılanı; eldeki görseller de 1536/2048 kare).
- Hover'da ikinci görsel (`*-room.jpg`) çapraz geçiş (opacity).
- Sol üst badge (Promo / Nouveau), ad (2 satır clamp), fiyat + eski fiyat,
  "TVA incluse" notu + ≈ €/m² satırı, stok durumu (yeşil ✓), tam genişlik buton.

## 3. Renk ölçümleri (logo → sharp ile piksel analizi)

`tools/logo-clusters.js` + `tools/logo-process.js` çıktıları
(`analysis/logo-palette.json`):

| Küme | Ortalama | Mod (en sık piksel) | Kullanılan token |
|---|---|---|---|
| Lacivert  | #122945 | **#0E2947** | `--color-primary: #0E2947` |
| Altın     | #B38C4E | **#BA8F4B** | `--color-accent: #B98E4A` |
| Kırık beyaz | #F8F4EB | — | `--color-bg / --color-header-bg: #F8F4EB` |
| Gri       | #797E85 | — | `--color-text-muted` türetildi |

Prompt'un beklediği (~#1B2E4B / #C9973A / #F6F2EA / #8A8F99) ile uyumlu;
gerçek ölçüm biraz daha koyu lacivert ve daha toprak bir altın verdi —
token'lar ölçüme göre kuruldu.

## 4. Logo işleme

- `gir-decor-logo.png` — arka planı kaldırılmış tam logo (mesafe tabanlı
  alpha, anti-alias korunarak). Kalite iyi; halo yok.
- `gir-decor-logo-header.png` (587×414) — header için "GIR + GIR DÉCORATION +
  slogan" bloğunun kırpılmış şeffaf versiyonu (tam logo 768×1152 dikey olduğu
  için header'da okunmaz; kırpım bilinçli bir sapmadır, raporda belirtildi).
- `gir-decor-mark.svg` — yalnız "GIR" harflerinden elle çizilmiş SVG;
  `var(--color-primary)` / `var(--color-accent)` kullanır (inline edildiğinde
  temaya uyar; favicon olarak fallback sabitleriyle çalışır).

## 5. Tipografi ve ölçüler (varsayım + logo eşleşmesi)

- Başlık: **Cormorant Garamond** (logodaki düz serifli romen kapitallere en
  yakın Google Font); gövde: **Inter** (latin-ext → ş, ğ, İ destekli).
- h1 32/40px, h2 26px, h3 20px, h4 16px; gövde 15–16px.
- Container **1200px**, grid gap 24px, kart radius 6px, buton radius 4px,
  buton padding 12×24.
- Kırılma noktaları: 1200 / 992 / 768 / 480.

## 6. Tema/plugin tespiti

Canlı erişim olmadığından doğrulanamadı. Bilinen: site WordPress + WooCommerce
(ürün URL kalıpları `/product-category/` ve `/product/` bunu doğruluyor).
Klon **WordPress'e bağımlı olmayan** saf HTML/CSS/JS olarak inşa edildi.

## 7. Etkileşimler (klonda birebir uygulananlar)

hamburger → off-canvas menü · arama (client-side ürün araması) · sepet drawer
(localStorage) · filtre accordion + mobil "Filtres" drawer · çift kollu fiyat
slider · galeri + thumbnail + lightbox · cookie bar · sıralama · sayfalama ·
tema switcher (`#dev-theme-switcher`, silinebilir).

## 8. Bilinçli sapmalar

1. Referans ekran görüntüleri yok (ağ engeli) → karşılaştırma klon-içi
   iterasyonla yapıldı (`analysis/compare-*.png` klon görüntüleridir).
2. Header logosu kırpılmış blok (tam dikey logo header'a uygun değil);
   performans için 320w webp/png varyantı üretildi.
3. İnfografik görsellerin içindeki Hollandaca metinler görselde gömülü —
   değiştirilemedi; FR/TR alt yazı/`alt` metinleriyle telafi edildi.
4. Fiyatlar PLACEHOLDER (89,00–99,00 €); iletişim bilgileri kurgusal.
5. Sayfalama görünür biçimde çalışsın diye kategori grid'i `data-page-size="3"`
   (4 ürün → 2 sayfa). Gerçek envanterde 12 yapın.
6. Fiyat filtresi "Uygula" butonu yerine anlık uygulanıyor (+ Sıfırla) —
   daha iyi UX; `filtersApply` anahtarı yedekte.
7. `hreflang` bağlantıları göreli (alan adı yok); yayında mutlaklaştırın.

## 9. FAZ 5 doğrulama sonuçları (final)

- **İterasyonlar:** 1. tur → 3 görsel kusur bulundu (nav alt menü butonunda UA
  arka planı, footer monogramı lacivert-üstü-lacivert, hero scrim zayıf) ve
  düzeltildi; 2. tur → temiz. Ek tur: Lighthouse bulgularıyla logo 320w,
  hover `srcset`, başlık hiyerarşisi ve bloklamayan font yüklemesi.
- **Lighthouse (masaüstü, yerel sunucu):** kategori **100 / 100 / 96 / 91**,
  ana sayfa **100 / 100 / 96 / 91** (perf/a11y/bp/seo). BP 96: sandbox'ta
  Google Fonts isteğinin proxy'de kesilmesinden kaynaklı konsol hatası
  (ortama özgü); SEO 91: göreli hreflang (bkz. sapma 7).
- **`grep "#hex\|rgb(" css/main.css` → 0 eşleşme** ✓
- **`html-validate` 19 sayfa → 0 hata** ✓
- **Kontrast:** `tools/contrast.js` — 4 tema × 21 çift, tümü AA eşiğinde ✓
  (koyu zeminler için `--color-accent-soft` token'ı eklendi).
- **Link/görsel/i18n:** `tools/validate.js` — kırık link 0, eksik görsel 0,
  `alt` eksiği 0, FR/TR anahtar kümeleri eşit (190 anahtar) ✓
- **Etkileşimler:** `tools/interactions.js` — 29/29 test ✓ (sepet+localStorage,
  fiyat slider filtresi, sıralama, sayfalama, arama, accordion, tema kalıcılığı,
  galeri/lightbox, sekmeler, adet, mobil drawer'lar, dil anahtarı eşleşmesi);
  konsolda JS hatası yok ✓ (tek istisna: sandbox'ta font isteği, ortama özgü).
- **Görüntüler:** `compare-*.png` (1440/768/390, FR+TR) ve `theme-*.png`
  (4 tema × 2 dil) — fontlar sandbox'ta yüklenemediği için görüntülerde
  fallback fontlar görünür; canlıda Google Fonts yüklenir.
