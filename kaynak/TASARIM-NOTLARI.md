# Tasarım notları (europetaxi24)

Arayüz, müşterinin gösterdiği referans sitenin (mobil ekran görüntüleri) düzenini ve renk dilini izler;
metin, görsel ve logo bu projeye aittir (referanstan hiçbir marka varlığı kopyalanmadı).

## Renk ve yazı
- Zemin sıcak krem `#F6F4EF`, ikincil bölümler `#EEEBE3`, metin mürekkep `#121110`.
- Vurgu amber `#F7B32B` (ana CTA), yeşil `#0E7A3F` (WhatsApp/onay). Hero ve altbilgi saf siyah değil, sıcak espresso `#17130F`.
- Yazı tipi Archivo (değişken, kendi sunucumuzdan; Google'a istek yok).

## Yapı (mobil öncelikli)
1. Yapışkan başlık: logo, dil menüsü, tam ekran menü (`<details>`; JS'siz de çalışır).
2. Hero: yuvarlak köşeli sıcak gün batımı görseli, H1, ülke etiketleri (BE NL LU FR DE), hızlı rotalar.
3. Rezervasyon sihirbazı (3 adım): Yolculuk → Detaylar (araç, bagaj, iletişim) → Ödeme (özet + online/WhatsApp).
   JS kapalıysa adımlar alt alta görünür (`assets/nojs.css`).
4. Güven şeridi, "Nasıl çalışır" (yatay kaydırmalı kartlar), Hizmetler, Filo, Neden biz.
5. Popüler rotalar (kartlar) + Hizmet bölgeleri (satır listesi; SEO için tüm satırlar DOM'da).
6. SSS (10), yasal bilgiler, koyu altbilgi, sabit WhatsApp düğmesi.

## Kurallar
- Satır içi çalıştırılabilir JS yok; tüm betik `assets/app.js`, sayfa verisi `#et-data` JSON bloğunda.
- Fiyat sabitleri `assets/app.js` içindeki `SABIT` bloğunda ve `pay/create.php` ile birebir aynı olmak zorunda (build denetler).
- Açılış hareketi yalnızca CSS, 1,4 sn altında, `prefers-reduced-motion` ile tamamen kapanır.

## Logo
`python3 kaynak/gorsel-kaynak/logo_uret.py` → `assets/logo.svg`, `assets/favicon.svg`, `kaynak/logo-ic.svg` (sayfaya gömülen sembol).
PNG ikonlar ve `og.jpg` için `kaynak/gorsel-kaynak/OKUBENI.md`.
