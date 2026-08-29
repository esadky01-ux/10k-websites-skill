# EUROPA TAXI — TEST RAPORU

Tarih: 2026-08-29 · Ortam: PHP 8.4.19 (Combell ile aynı ana sürüm), Node 22, Chromium (Playwright)
Toplam otomatik kontrol: **2.797** (test_adim1: 2.343 · test_adim2: 326 · test_adim3: 59 · test_adim4: 69) + tarayıcı uçtan uca paketi. **Tümü geçti.**

Testleri yeniden koşmak için:

```
python3 kaynak/build.py
python3 kaynak/testler/test_adim1.py
python3 kaynak/testler/test_adim2.py
python3 kaynak/testler/test_adim3.py
python3 kaynak/testler/test_adim4.py
# tarayıcı paketi (Chromium + Playwright gerekli):
python3 -m http.server 8123 --directory www &
node kaynak/testler/tarayici-test.js
```

---

## A. Derleme bütünlüğü

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| 4 dilde çözülmemiş `{{yer_tutucu}}` yok | ✅ | test_adim2/A — 0 kalıntı; build.py kalıntıda derlemeyi durdurur |
| strings.json 4 dilde birebir aynı anahtar seti | ✅ | test_adim1/A — 152 anahtar × 4 dil, fark yok |
| Fiyat sabitleri template.html = create.php | ✅ | build.py her derlemede doğrular: "✓ Fiyat sabitleri esit" |
| 4 dilde `node --check` temiz | ✅ | test_adim2/B — tüm satır içi betikler + kök sayfa |
| 4 dilde JSON-LD `JSON.parse` geçerli | ✅ | test_adim2/C — sayfa başına 2 blok (TaxiService+LocalBusiness, FAQPage) |
| Tüm PHP dosyaları `php -l` temiz | ✅ | test_adim3/A — kaynak/pay + www/pay (üretilen dil.php/isletme.php dahil) |

## B. Fiyat ve mesafe

| Rota | Beklenen | Sonuç |
|---|---|---|
| Brüksel → Antwerpen | 45 km → 99,55 € | ✅ (kapora 19,91 €) |
| Brüksel → Liège | 100 km → 209,00 € | ✅ (kapora 41,80 €) |
| Gent → Brussels Airport | 56 km → 121,44 € | ✅ (kapora 24,29 €) |
| Gent → Charleroi Airport | 115 km → 238,85 € | ✅ (kapora 47,77 €) |
| Leuven → Brussels Airport | 22 km | ✅ |
| Brüksel → Lüksemburg | 220 km | ✅ |
| Brüksel → Paris | 315 km | ✅ |
| Brüksel → Köln | 215 km | ✅ |
| Brüksel → Amsterdam | 210 km | ✅ |
| Tanınmayan adres | fiyat YOK + uyarı | ✅ (JS + tarayıcı testi: panel "—", kırmızı durum satırı, ödeme engelli) |

- Sunucu km sınırları: `0, -5, 801, 9999, "abc", ""` → **hepsi HTTP 422 ile reddedildi** (gerçek POST testleri).
- Sunucu fiyatı bağımsız hesaplıyor: istekle sahte `toplam=1.00` gönderildi, sipariş dosyasına **121,44 €** yazıldı (istemci tutarı hiç okunmuyor).
- Tolerans kararı birim testli: fark %16,7 → sunucu değeri; %3,3 → istemci değeri; sunucu verisi yoksa istemci.

## C. Uçtan uca akış (gerçek tarayıcı, Chromium)

- [x] Gent → Brussels Airport: 56 km / 121,44 € / kapora 24,29 € (hem chip hem elle yazım)
- [x] Bozuk e-posta → online ödeme engellendi (istemci) ve HTTP 422 (sunucu)
- [x] İptal onayı işaretsiz → engellendi
- [x] Adres boş → engellendi (istemci + sunucu)
- [x] WhatsApp mesajında boş/yarım satır yok; doğru numara (`wa.me/32493839898`), rota + fiyat + kapora satırları dolu
- [x] Sayaç sınırları 7 / 6 / 4 — sınırda buton soluk ve tıklanamaz (`opacity:.3; pointer-events:none`)
- [x] İletişim bilgileri: online ödemede zorunlu, WhatsApp yolunda opsiyonel

## D. Google dayanıklılığı (kritik)

- [x] **Anahtar boşken**: Google betiği hiç yüklenmez, site dahili motorla tam işlevsel, fiyat verir, konsolda 0 hata
- [x] **Anahtar geçersizken** (sahte anahtar + betik ağda engellendi): "Oops!" kutusu görünmüyor, form bozulmuyor (yatay taşma 0), dahili tahmine düşüyor, 121,44 € hesaplanıyor
- [x] **`gm_authFailure`** yedek moda geçiriyor: sahte `.gm-err-container`/`.pac-container`/`.gm-style-moc` enjekte edildi → tetikleme sonrası **0 DOM kalıntısı**, datalist geri açıldı, fiyat 99,55 € hesaplandı
- [x] CSS güvenlik ağı çıktıda mevcut (`.gm-err-container…display:none!important`)
- [x] Anahtar ön-testi (AutocompleteService + 6 sn zaman aşımı) şartnamedeki desenle birebir

## E. SEO

- [x] 4 dilde canonical kendine (mutlak URL)
- [x] 5'li hreflang kümesi her sayfada, mutlak, çift yönlü, kendine referanslı
- [x] x-default → `/fr/`
- [x] title ≤ 60 (FR 57 · NL 53 · EN 51 · TR 56), description ≤ 160 (hepsi ölçüldü)
- [x] Tek `<h1>`, tüm `<img>` etiketleri `alt`'lı
- [x] sitemap.xml: 4 URL × tam 5'li `xhtml:link` kümesi (kendisi dahil), XML şeması geçerli
- [x] robots.txt: `Disallow: /pay/` + sitemap referansı; kök sayfa `noindex,follow`
- [x] Sunucu tarafı IP/Accept-Language yönlendirmesi YOK (yalnız kökte tarayıcı JS'i + localStorage)

## F. Mobil (360px ve 390px, gerçek tarayıcı)

- [x] Tarih/saat kutuları taşmıyor (360 ve 390px'te yatay taşma: 0px)
- [x] Input'a dokununca zoom yok (`font-size:16px` tüm girişlerde)
- [x] Tarih seçici koyu temada (`color-scheme: dark` meta + input CSS)
- [x] FAB footer'ı kapatmıyor (ölçülen alt boşluk 96px ≥ 92px + safe-area)
- [x] Flamanca uzun kelimeler taşmıyor (`overflow-wrap:anywhere`; NL sayfası 360px'te tam tarandı)

## G. Güvenlik

- [x] `pay/orders/` web'den erişilemez: `orders/.htaccess` (Require all denied + Deny from all) + kök .htaccess'te `RewriteRule ^pay/orders … [F]` + create.php klasörü her istekten önce kilitler
- [x] `pay/config.php` web'den erişilemez: pay/.htaccess + kök .htaccess FilesMatch (dil.php, isletme.php dahil)
- [x] `orders.php` şifresiz açılmıyor (şifre boşken panel tamamen kapalı; girişte `hash_equals`)
- [x] Webhook, ödemeyi POST verisinden değil **Mollie API'sinden** doğruluyor; e-posta yalnız ilk "paid"te
- [x] Çıktıda gömülü anahtar yok (live_/test_/AIzaSy/xkeysib desenleri tarandı: 0 eşleşme; tarayıcı anahtarı yalnızca assets/config.js'te ve referrer kısıtlı olacak)

## Canlıda yapılacak son doğrulamalar (anahtar gerektirir)

Bu maddeler gerçek anahtarlar girilince `pay/test.php?pw=…` ile tek ekrandan doğrulanır (KURULUM.md Adım 7):

1. Mollie bağlantısı + Bancontact/kredi kartı/Apple Pay yöntemlerinin aktifliği
2. Brevo ile gerçek test e-postası (buton sayfada)
3. `https://…/pay/orders/` adresinin Apache'de 403 verdiği (yerel PHP sunucusu .htaccess işlemez)
4. Google tarayıcı anahtarıyla canlı Autocomplete/Directions ve tarayıcı konsolunun temizliği
