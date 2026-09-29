# EUROPA TAXI — GÜVENLİK RAPORU

Kapsam: statik site (fr/nl/en/tr), PHP ödeme katmanı (Combell), Node ödeme katmanı (Vercel), sunucu yapılandırması,
derleme hattı. Yöntem: 7 ayrı mercekle dinamik saldırı testi (ödeme mantığı, PHP girdi, ön yüz XSS/CSP, sunucu
yapılandırması, kötüye kullanım, gizlilik/KVKK-GDPR, derleme/gizli bilgi). Ham bulgu: ~89. Bulgular kodda düzeltildi ve
her düzeltme otomatik testle kilitlendi.

> **Dürüst not:** her bulgunun ayrı bir bağımsız doğrulayıcıyla teyidi oturum limiti yüzünden yarıda kaldı. Bu yüzden
> düzeltmeler "doğrulanmış bulgu" değil, "ham bulgu + test ile kanıtlanmış düzeltme" olarak sunulur. Yayın öncesi
> kısa bir bağımsız tekrar denetim önerilir (bkz. §5).

## 1. Düzeltilen ana açık sınıfları

| # | Risk | Önce | Şimdi |
|---|------|------|-------|
| 1 | **Fiyat manipülasyonu** (istemci km/fiyat) | İstemci km'sine güvenilebiliyordu | Fiyat SUNUCUDA yalnız km'den hesaplanır. km: Google sonucu → yoksa dahili tablo → ikisi de yoksa **fail-closed** (422 + WhatsApp). İstemci daha düşük km gönderirse tabloya yükseltilir |
| 2 | **Sahte "ödendi"** | Webhook gövdesine güvenilebiliyordu | Durum yalnız Mollie API'den doğrulanır (tutar = yeniden hesaplanan kapora, iade/chargeback yok, paidAt ≤ 48 saat); hata olursa 500 → Mollie yeniden dener |
| 3 | **Çift ödeme / çift e-posta** | Çift tıklama, geri tuşu, webhook tekrarı | `idem` tokeni → Mollie Idempotency-Key; istemci çift gönderim koruması; webhook `flock` + alıcı başına bayrak |
| 4 | **Kaba kuvvet / spam** | Sınırsız POST | IP başına dakikada 5 istek (429 + Retry-After), honeypot alanı, gövde ≤ 64 KB, Origin denetimi |
| 5 | **Girdi enjeksiyonu** (e-posta başlığı, CRLF, `\|` ayırıcı, kontrol karakterleri) | Kısmi | Sıkı doğrulama + normalizasyon; PHP ve Node aynı test vektörleriyle eşleşir (200 bin+ vektör) |
| 6 | **XSS / tıklama korsanlığı** | Satır içi betik vardı | Satır içi çalıştırılabilir JS yok; katı CSP (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, HSTS, Referrer/Permissions-Policy, COOP |
| 7 | **Sunucu yapılandırması** | `.htaccess` kırılgan, iki kez başlık | Yalnız güvenli yönergeler (500 riski yok), başlıklar tek kez, gizli dosyalar ve `pay/orders` engelli, `config.php` kilitli, 404 markalı ve noindex |
| 8 | **Sipariş verisi sızıntısı** | Sipariş dosyaları web kökünde olabilirdi | Varsayılan olarak web kökünün dışında (`ORDERS_DIR`), `.htaccess` beyaz liste, yönetici paneli şifreli |
| 9 | **Gizlilik (GDPR)** | Saklama süresi yok, harici yazı tipi | Yazı tipleri self-host (Google Fonts çağrısı yok); 30 gün ödenmemiş silinir, 12 ay sonra anonimleşir, fatura verisi 7 yıl (`temizle.php`, cron); gizlilik metni güncellendi (Mollie, Google, Brevo, WhatsApp, teknik çerez) |
| 10 | **Sırlar** | — | Anahtarlar yalnız ortam değişkenlerinde; kodda/çıktıda yok (test bunu tarar); loglarda kişisel veri ve sır yok |
| 11 | **Vercel (durumsuz) ödeme** | — | Disk yok: Mollie tek doğruluk kaynağı; `et_p` HMAC çerezi ile başarı sayfası; `api/test.js` kurulum sonrası kapatılır |

## 2. Test kanıtı (bu repoda çalıştırılır)

| Paket | Sonuç |
|---|---|
| `test_adim1.py` (veri, dil, fiyat) | 2447 kontrol geçti |
| `test_adim2.py` (sayfa, JSON-LD, yasaklı özellikler) | 684 |
| `test_adim3.py` (PHP birim + uçtan uca) | 83 |
| `test_adim4.py` (.htaccess, robots, sitemap) | 69 |
| `test_seo.py` (SEO/GEO, hreflang, JSON-LD, ikonlar) | 4917 |
| `test_php_pay.py` (PHP, sahte Mollie/Brevo/Google, 50 mutasyon) | 1630 — 50/50 mutasyon yakalandı |
| `test_vercel_api.py` (Node, aynı vektörler) | 999 |
| `tarayici-test.js` (Chromium, konsol, mobil taşma) | geçti |
| Tarayıcıda gerçek CSP başlığıyla 5 sayfa | CSP ihlali 0 |

## 3. Bilinçli olarak kabul edilen / açık kalan riskler

- **Google Maps yüklemesi** onay/lazy-load gerektirmiyor (yalnız anahtar girilirse yüklenir). Katı GDPR yorumu için
  onay bandı eklenmesi müşteriyle netleştirilmeli.
- **`style-src 'unsafe-inline'`**: Google Maps/Places stil enjekte ettiği için gerekli. Harita anahtarı kullanılmayacaksa kaldırılabilir.
- **Vercel Hobby planı ticari kullanım için uygun değildir.** Canlı ödeme alınacaksa Pro plan veya Combell (PHP) kullanılmalı.
- **Rate-limit Vercel'de** örnek başına bellekte tutulur (durumsuz); dağıtık saldırıda Vercel Firewall/WAF kuralı eklenmeli.
- **Gidiş-dönüş fiyatlandırması (ODM-10)**: dönüş tarihi kaydediliyor ama fiyat değişmiyor; ticari karar müşteride.

## 4. Yayına almadan önce yapılacaklar (müşteri / kurulum)

1. Mollie **canlı** anahtarı, Brevo anahtarı, Google sunucu + tarayıcı anahtarları (kurulum rehberleri: `KURULUM.md`, `kaynak/vercel/README.md`).
2. `temizle.php` için günlük cron (Combell) — saklama süreleri buna bağlı.
3. `test.php`/`api/test.js` kurulum bittikten sonra kapatılır (`vercel_build.py --test-ucu-yok`).
4. Yönetici şifresi uzun ve benzersiz olmalı.
5. Gerçek cihazda (iOS Safari, Android Chrome) bir test ödemesi (Mollie test modu), ardından canlı 1 € benzeri deneme.
6. Google İşletme Profili, Search Console, Bing Places (bkz. `kaynak/SEO-NOTLARI.md` §6).

## 5. Önerilen kalan doğrulama

Bulgu bazında bağımsız doğrulama bu oturumda tamamlanamadı. Düzeltilmiş sürüm üzerinde küçük bir regresyon denetimi
(ödeme mantığı + girdi + CSP) yapılması önerilir; testler bu denetimi hızlandırır.
