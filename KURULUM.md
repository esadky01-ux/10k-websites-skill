# EUROPA TAXI — KURULUM REHBERİ

Bu rehber siteyi Combell'e kurmanız için gereken her adımı sırayla anlatır.
Özet: **dosyaları yükle → SSL aç → iki Google anahtarı gir → Mollie anahtarı gir →
Brevo anahtarı gir → test.php ile doğrula → test.php'yi sil.**

---

## 1. Dosyaları yükleme (Combell)

1. `www-yukle.zip` dosyasını bilgisayarınıza alın.
2. Combell kontrol paneli → **Dosya Yöneticisi** → sitenizin `www/` kök dizinine girin.
3. Zip'i yükleyin ve **buraya çıkarın**. Çıkan yapı şöyle olmalı:
   `www/index.html`, `www/fr/`, `www/nl/`, `www/en/`, `www/tr/`, `www/assets/`, `www/pay/`, `www/.htaccess`, `www/sitemap.xml`, `www/robots.txt`
4. `.htaccess` gizli dosyadır; dosya yöneticisinde "gizli dosyaları göster" açık olsun ve dosyanın geldiğini kontrol edin.

## 2. SSL (HTTPS) açma

Combell paneli → alan adınız → **SSL sertifikaları** → ücretsiz **Let's Encrypt** sertifikasını etkinleştirin.
`.htaccess` zaten tüm trafiği HTTPS'e ve `www.` adresini çıplak alan adına yönlendirir.

## 3. Google Cloud — iki ayrı anahtar

> Neden iki anahtar? Tarayıcı anahtarı sitenin kaynak kodunda görünür; ödeme tutarı ona
> güvenilerek belirlenemez. Sunucu anahtarı gizlidir ve mesafeyi bağımsız doğrular.

1. [console.cloud.google.com](https://console.cloud.google.com) → yeni proje oluşturun (ör. "europa-taxi").
2. **API'ler ve Hizmetler → Kitaplık**'tan şu 4 API'yi etkinleştirin:
   - Maps JavaScript API
   - Places API
   - Directions API
   - Distance Matrix API
3. **Kimlik bilgileri → Anahtar oluştur** ile **iki** anahtar üretin:

   **A) TARAYICI anahtarı** (siteye girer)
   - Uygulama kısıtlaması: **HTTP yönlendirenleri (web siteleri)**
   - Şu İKİ satırı birden ekleyin:
     ```
     https://europetaxi24.be/*
     https://www.europetaxi24.be/*
     ```
     > ⚠️ DİKKAT: `*.europetaxi24.be/*` yazarsanız **çıplak alan adını kapsamaz** ve site
     > `RefererNotAllowedMapError` verir. Mutlaka yukarıdaki iki satırı ayrı ayrı girin.
   - API kısıtlaması: Maps JavaScript, Places, Directions.
   - Anahtarı `assets/config.js` dosyasına yapıştırın:
     ```js
     window.EUROPA_CONFIG = { googleMapsKey: "AIzaSy..." };
     ```
     Kaydettiğiniz anda 4 dil de okur; yeniden derleme gerekmez.

   **B) SUNUCU anahtarı** (gizli kalır)
   - Uygulama kısıtlaması: **IP adresleri** → Combell sunucunuzun çıkış IP'si
     (Combell destek panelinden öğrenilir; `test.php` sayfası da ipucu verir).
   - API kısıtlaması: **yalnızca Distance Matrix API**.
   - Anahtarı `pay/config.php` → `google_server_key` alanına yapıştırın.
4. **Faturalandırma → Bütçeler**: aylık ör. 20 € bütçe + %50/%90 e-posta uyarısı kurun.
   (Harita çizilmediği için maliyet düşüktür; uyarı yine de güvencedir.)

## 4. Mollie (online ödeme)

1. [mollie.com](https://www.mollie.com) hesabınızda işletme doğrulamasını tamamlayın
   (CAN COMPANY bilgileri, KDV BE 1016.219.906, site adresi). Sitedeki yasal bölüm
   (şirket bilgileri + gizlilik + şartlar) Mollie onayı için hazırdır.
2. **Ödeme yöntemleri**: Bancontact, Kart (creditcard) ve Apple Pay'i etkinleştirin.
3. **Geliştiriciler → API anahtarları**: önce `test_...` anahtarını
   `pay/config.php` → `mollie_api_key` alanına yapıştırın.
4. Sitede küçük bir test rezervasyonu yapıp Mollie test ekranında "Paid" seçin;
   onay e-postalarının geldiğini görün.
5. Her şey doğruysa anahtarı `live_...` ile değiştirin. **Canlıya geçince bir de
   gerçek küçük ödeme yapıp iade edin** — en sağlam son kontrol budur.

## 5. Brevo (e-posta)

1. [brevo.com](https://www.brevo.com) ücretsiz hesap (300 e-posta/gün yeterli).
2. **Senders & Domains**: `europetaxi24.be` alan adını ekleyip Brevo'nun verdiği
   **DKIM/SPF DNS kayıtlarını** Combell DNS'ine girin ve "doğrulandı" olana kadar bekleyin
   (bu olmadan e-postalar spam'e düşebilir).
3. **SMTP & API → API anahtarı** üretin → `pay/config.php` → `brevo_api_key`.
4. Gönderen adres `noreply@europetaxi24.be` olarak ayarlıdır (`mail_from`).

## 6. Yönetici şifresi

`pay/config.php` → `admin_password` alanına **güçlü** bir şifre yazın (uzun, tahmin edilemez).
- Rezervasyon paneli: `https://europetaxi24.be/pay/orders.php`
- Tanılama: `https://europetaxi24.be/pay/test.php?pw=ŞİFRENİZ`

## 7. test.php ile doğrulama — sonra SİLME

`https://europetaxi24.be/pay/test.php?pw=ŞİFRENİZ` adresini açın. Sayfa şunları tek tek kontrol eder:
PHP sürümü, cURL, HTTPS, klasör yazma izni, **Mollie bağlantısı + aktif ödeme yöntemleri**,
anahtar uzunluk/boşluk kontrolü, Google anahtarları, e-posta ayarı, 4 dilin dosyaları.
"Test e-postası gönder" butonuyla gerçek bir e-posta gönderin.

Ek iki el kontrolü:
- `https://europetaxi24.be/pay/orders/` → **403 Yasak** görmelisiniz.
- Tarayıcı konsolu (F12) → ana sayfada **0 hata** olmalı.

> 🔴 **Tüm satırlar yeşil olunca `pay/test.php` dosyasını sunucudan SİLİN.**

## 8. Search Console

[search.google.com/search-console](https://search.google.com/search-console) → alan adını doğrulayın →
**Sitemaps** bölümüne `https://europetaxi24.be/sitemap.xml` gönderin.
4 dil sayfasının indekslenmesi birkaç gün sürebilir.

---

## Bakım

### Fiyat değiştirme (İKİ dosyada birden!)
Açılış ücreti / km fiyatı / kapora yüzdesi şu iki dosyada **birebir aynı** olmalı:
1. `kaynak/template.html` → `var SABIT = { ACILIS: 10.00, KM_UCRET: 1.99, ... }`
2. `kaynak/pay/create.php` → `const ACILIS_UCRETI = 10.00; const KM_UCRETI = 1.99; ...`

Ayrıca `kaynak/mesafe-verisi.json` → `sabitler` bölümünü de aynı değere getirin
(testler ve rota chip fiyatları oradan okur). Sonra:
```
python3 kaynak/build.py
```
Değerler uyuşmazsa derleme **hata verip durur** — bu bilinçli bir emniyettir.
Çıkan `www/` içeriğini sunucuya yükleyin.

### Metin değiştirme
Tüm metinler tek dosyada: `kaynak/strings.json` (4 dil yan yana).
Değiştirin → `python3 kaynak/build.py` → `www/` içeriğini yükleyin.
4 dil otomatik senkron kalır; HTML'e elle dokunmayın.

### Hero fotoğrafı
Gerçek "gece Brüksel + siyah Tesla" fotoğrafı hazır olduğunda:
`kaynak/assets/hero-masa.jpg` (1600×900) ve `hero-mobil.jpg` (828×1104) adlarıyla koyun →
derleyin → yükleyin. Şu anki görseller markaya uygun yer tutuculardır.

### Sipariş kayıtları
`pay/orders/` içindeki JSON dosyaları rezervasyon kayıtlarıdır (web'den erişilemez).
Muhasebe için yılda bir yedeğini almanız yeterlidir.
