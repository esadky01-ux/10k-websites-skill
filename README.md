# MAXIMUS Food & Horeca — B2B Toptan Gıda Platformu

Aarschot (Belçika) merkezli **Maximus Food & Horeca** için kurumsal B2B toptan gıda sipariş platformu.
Slogan: *Quality Food. Trusted Partner.* — 2020'den bu yana Belçika ve Hollanda'daki Horeca işletmelerine döner, pizza ve fritür malzemeleri.
Next.js (App Router) · TypeScript · Tailwind CSS v4 · Lucide React.

## Özellikler

- **Ana sayfa:** kurumsal üst bar (gerçek Maximus logosu, adres, telefon, Sepetim), Higgsfield ile üretilmiş sinematik hero görseli, sekiz kategori kartı, B2B avantajları, partner markalar şeridi, hakkımızda bölümü, üç adımlı sipariş akışı ve blog önizlemesi. Ürünler ana sayfada listelenmez.
- **Hızlı Sipariş (`/siparis`):** `QuickOrderMatrix` tablosu ile onlarca koliyi tek ekrandan girme; kategori sekmeleri, Türkçe karakter duyarlı canlı arama, koli ve paket/adet sayaçları, "Fiyat için giriş yapın" rozeti.
- **Sepet çekmecesi:** sağdan açılan slide-over; teslimat tipi seçimi ("Adrese Teslimat" / "Depodan Teslim Alma (-%15)"), işletme adı ve not alanı, sepetin düzenli toptancı fişi olarak WhatsApp mesajına dönüştürülmesi. Sepet `localStorage` ile kalıcıdır.
- **SEO blog (`/blog`):** üç detaylı B2B makale, meta başlık/açıklama, Open Graph, Article JSON-LD, `sitemap.xml` ve `robots.txt`.

## Geliştirme

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # üretim derlemesi
npm run lint
```

## Yapı

```
src/app/            sayfalar (/, /siparis, /blog, /blog/[slug]), sitemap, robots
src/components/     Header, Hero, CategoryGrid, Advantages, QuickOrderMatrix, CartDrawer, ...
src/data/           kategoriler (8), katalogdan alınan ürünler (SKU ve koli formatlarıyla), blog yazıları
src/lib/            site bilgileri, sepet deposu, WhatsApp fiş oluşturucu
public/media/hero/        Higgsfield ile üretilen hero görseli
public/media/categories/  Higgsfield ile üretilen kategori görselleri
```

## Yapılandırma

İletişim bilgileri, WhatsApp numarası, çalışma saatleri, partner listesi ve site adresi `src/lib/site.ts` dosyasında tanımlıdır.
Logo dosyaları: `public/logo.png` (kırmızı, açık zemin), `public/logo-white.png` (koyu zemin), `public/logo-badge.jpg` (yuvarlak rozet). Favicon `src/app/icon.png`, Apple simgesi `src/app/apple-icon.png`.

Katalogda sayfası paylaşılmayan kategorilerde (Et Ürünleri, Dondurulmuş, Kuru Gıda) ürün numarası yerine "Çeşitli" yazılıdır; gerçek katalog sayfaları eklendiğinde `src/data/products.ts` güncellenmelidir.
