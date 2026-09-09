# MAXIMUS Food & Horeca — B2B Toptan Gıda Platformu

Aarschot (Belçika) merkezli **Maximus Food & Horeca** için kurumsal B2B toptan gıda sipariş platformu.
Slogan: *Quality Food. Trusted Partner.* — 2020'den bu yana Belçika ve Hollanda'daki Horeca işletmelerine döner, pizza ve fritür malzemeleri.
Next.js (App Router) · TypeScript · Tailwind CSS v4 · Lucide React · Anthropic SDK.

Ana dil Felemenkçe (`/`), ikinci dil Türkçe (`/tr`).

## Özellikler

- **İki dil:** Felemenkçe kök URL'ler (`/bestellen`, `/regio`, `/blog`, `/account`), Türkçe `/tr/...` (`/tr/siparis`, `/tr/bolgeler`, `/tr/hesap`). `src/proxy.ts` Türkçe URL parçalarını klasörlere eşler; hreflang, canonical ve çok dilli sitemap otomatik.
- **Müşteri hesabı:** kayıt, giriş (scrypt + imzalı çerez), giriş yapan müşteri fiyatları görür (`/api/prices`, sunucu tarafı), WhatsApp'a gönderilen sipariş hesaba kaydedilir, "Son siparişi tekrarla" ve kayıtlı sabit listeler.
- **Bölge SEO sayfaları:** 28 Belçika bölgesi için `/regio/[slug]` ve `/tr/bolgeler/[slug]`; Service, FAQPage ve BreadcrumbList JSON-LD, geo meta etiketleri. Yeni bölge eklemek için `src/data/regions.ts` dizisine kayıt eklemek yeterlidir.
- **Mobil kart görünümü:** sipariş tablosu dar ekranlarda kart listesine dönüşür.
- **WhatsApp sipariş ajanı:** `docs/whatsapp-agent.md`.

- **Ana sayfa:** kurumsal üst bar (gerçek Maximus logosu, adres, telefon, Sepetim), Higgsfield ile üretilmiş sinematik hero görseli, sekiz kategori kartı, B2B avantajları, partner markalar şeridi, hakkımızda bölümü, üç adımlı sipariş akışı ve blog önizlemesi. Ürünler ana sayfada listelenmez.
- **Hızlı Sipariş (`/siparis`):** `QuickOrderMatrix` tablosu ile onlarca koliyi tek ekrandan girme; kategori sekmeleri, Türkçe karakter duyarlı canlı arama, koli ve paket/adet sayaçları, "Fiyat için giriş yapın" rozeti.
- **Sepet çekmecesi:** sağdan açılan slide-over; teslimat tipi seçimi ("Adrese Teslimat" / "Depodan Teslim Alma (-%15)"), işletme adı ve not alanı, sepetin düzenli toptancı fişi olarak WhatsApp mesajına dönüştürülmesi. Sepet `localStorage` ile kalıcıdır.
- **SEO blog (`/blog`):** üç detaylı B2B makale, meta başlık/açıklama, Open Graph, Article JSON-LD, `sitemap.xml` ve `robots.txt`.

## Geliştirme

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:3000
npm run build          # üretim derlemesi
npm run lint
npm test               # birim testleri (eşleştirici, ajan, depo, i18n)
npm run e2e            # Playwright uçtan uca testleri (sunucu çalışırken, BASE_URL)
npm run whatsapp:dry   # WhatsApp ajanı yerel simülasyon
npm run images         # product-images-inbox/ içindeki ürün fotoğraflarını işler
```

## Yapı

```
src/app/[lang]/     sayfalar (home, bestellen, blog, regio, account, inloggen, registreren)
src/app/api/        auth, prices, orders, lists, whatsapp/webhook
src/i18n/           sözlükler (nl, tr), rota eşlemeleri, sağlayıcı
src/server/         auth, store (dosya tabanlı), prices (sunucu), whatsapp ajanı
src/components/     Header, Hero, CategoryGrid, Advantages, QuickOrderMatrix, CartDrawer, ...
src/data/           kategoriler (10), Odoo ürün kataloğundan üretilen 559 ürün (SKU, Türkçe ad, orijinal katalog adı ve koli formatı), blog yazıları
src/lib/            site bilgileri, sepet deposu, WhatsApp fiş oluşturucu
public/media/hero/        Higgsfield ile üretilen hero görseli
public/media/categories/  Higgsfield ile üretilen kategori görselleri
public/media/products/    ürün görselleri (<ürün-id>.webp, `npm run images` üretir)
```

## Ürün görselleri

Sipariş matrisinde görseli olan ürünler küçük resimle listelenir; tıklanınca büyür. Görseli olmayan ürünlerde kategori simgesi kalır.

Toplu ekleme:

1. Fotoğrafları `product-images-inbox/` klasörüne koyun. Dosya adı SKU, ürün id veya katalog adı olabilir (`12345.jpg`, `nawras-nohut.jpg`, `NAWRAS NOHUT 900G 10X1_10ST.jpg`). İsterseniz `map.csv` ile `dosyaadı,ürün-id` eşlemesi verin.
2. `npm run images` çalıştırın: görseller 800×800 WebP olarak `public/media/products/` altına yazılır ve `src/data/product-images.ts` yeniden üretilir.
3. Commit edin. Eşleşmeyen dosyalar raporlanır; inbox klasörü depoya girmez.

GitHub arayüzünden de yapılabilir: dosyaları doğrudan `public/media/products/` altına `<ürün-id>.webp` adıyla yükleyip `npm run images` ile eşleme dosyasını güncelleyin.

## Önizleme / yayına alma

- **Vercel (en hızlı):** vercel.com/new → GitHub deposunu seçin → branch → `AUTH_SECRET` ve `ADMIN_PASSWORD` ortam değişkenlerini girin → Deploy. Önizlemede müşteri verisi geçici dosyadadır; kalıcı veri için Odoo bağlantısı veya bir veritabanı gerekir.
- **Kendi sunucunuz (Node 22):** `npm ci && npm run build && npm start`. `MAXIMUS_DATA_DIR` ile kalıcı bir veri dizini verin.
- **Yerel:** `npm install && cp .env.example .env && npm run dev` → http://localhost:3000

## Müşteri onayı

Yeni kayıtlar "onay bekliyor" durumundadır; fiyatlar yalnızca onaylı hesaplara gösterilir. `/beheer` (Türkçe: `/tr/yonetim`) panelinde `ADMIN_PASSWORD` ile giriş yapıp bekleyen kayıtları onaylayın veya reddedin. `ADMIN_WHATSAPP` ve WhatsApp Cloud API tanımlıysa her yeni kayıt sahibe WhatsApp ile bildirilir.

## Yapılandırma

İletişim bilgileri, WhatsApp numarası, çalışma saatleri, partner listesi ve site adresi `src/lib/site.ts` dosyasında tanımlıdır.
Logo dosyaları: `public/logo.png` (kırmızı, açık zemin), `public/logo-white.png` (koyu zemin), `public/logo-badge.jpg` (yuvarlak rozet). Favicon `src/app/icon.png`, Apple simgesi `src/app/apple-icon.png`.

Ürün listesi `Product_product_template.pdf` dışa aktarımından otomatik üretilmiştir; ürün adları Türkçeleştirilmiş, orijinal Hollandaca ad `nameNl` alanında ve sipariş tablosunda küçük yazıyla korunmuştur. Adal markalı ürünler kapsam dışıdır. Fiyatlar siteye alınmamıştır.
