# Europa Taxi — Vercel ödeme katmanı (Node.js serverless)

Vercel'de PHP çalışmaz ve kalıcı dosya sistemi yoktur. Bu klasör, `kaynak/pay/*.php` ödeme katmanının
**durumsuz** Node.js karşılığıdır: **Mollie tek doğruluk kaynağıdır**, siparişler diske yazılmaz.

- Sıfır npm bağımlılığı (yalnızca Node 22 yerleşikleri + global `fetch`). CommonJS, standart `(req, res)` arayüzü.
- Yapılandırma yalnızca ortam değişkenlerinden. Metinler `strings.json` → `dil.json` üzerinden (kodda dil metni yok).
- Sırlar ve kişisel veri (e-posta / telefon / adres) **asla loglanmaz**; loglarda yalnızca sipariş no, ödeme id ve durum.

```
kaynak/vercel/
  api/create.js     POST /pay/create.php  -> doğrula, km kararı, fiyatı SUNUCUDA hesapla, Mollie ödemesi, 303 checkout + et_p çerezi
  api/webhook.js    POST /pay/webhook.php -> durumu Mollie'den doğrula; yalnızca ilk 'paid'te 2 e-posta
  api/success.js    GET  /pay/success.php -> durumu Mollie'den CANLI sor (çerez, yoksa liste yedeği)
  api/orders.js     /pay/orders.php       -> şifreli panel (Mollie'den listeler)
  api/test.js       /pay/test.php         -> kurulum tanılaması (kurulum bitince KAPATIN)
  api/_lib/         config, fiyat, mesafe, mollie, mail (Brevo), dil, siparis, guvenlik, html, log
  dev-server.js     YALNIZ test: aynı rewrite haritasıyla yerel çalıştırıcı (Vercel'e yüklenmez)
  package.json
kaynak/vercel_build.py      build.py'den SONRA çalışır -> repo kökündeki vercel-out/ (dağıtılan klasör)
kaynak/testler/mock_dis_servisler.py, test_vercel_api.py, paylasilan-vektorler.json
```

## 1. Derleme ve dağıtım

```bash
python3 kaynak/build.py            # www/ üretir (statik site + PHP katmanı)
python3 kaynak/vercel_build.py     # vercel-out/ üretir
```

`vercel-out/` şunları içerir: statik site (kökte `index.html`, `fr/ nl/ en/ tr/ assets/ robots.txt sitemap.xml`),
`api/` fonksiyonları, `api/_lib/dil.json` + `mesafe.json` (build'de üretilir), `package.json`, varsa `vercel.json`.
**`www/pay/`, her `.php` ve `.htaccess` ASLA dahil edilmez** (Vercel PHP'yi çalıştırmaz, ham metin olarak servis eder;
`config.php` sızardı). Derleyici çıktıyı tarar, yasak dosya bulursa hata verir. Fiyat sabitleri
(`ACILIS/KM_UCRET/KAPORA_YUZDE/MIN_KM/MAX_KM`) `mesafe-verisi.json`, `template.html` ve `pay/create.php` ile
birebir aynı değilse derleme **hata verir**.

> Önemli: Vercel fonksiyonları, dağıtılan projenin **kökündeki** `api/` klasöründen alınır. Bu yüzden
> `vercel-out/` bir "Output Directory" olarak değil, **projenin kök dizini (Root Directory)** olarak dağıtılmalıdır.

**Seçenek A — CLI (önerilen, Git gerekmez):**
```bash
cd vercel-out
vercel link            # bir kez: projeyi oluştur/bağla (Framework: Other)
vercel env add MOLLIE_API_KEY production   # ... aşağıdaki tablo
vercel deploy --prod
```
**Seçenek B — Git:** `vercel-out/` klasörünü commit'leyin, Vercel projesinde *Root Directory = `vercel-out`*,
*Framework Preset = Other*, Build Command boş bırakın. Her içerik/kod değişikliğinde yerelde iki derleme komutunu
çalıştırıp `vercel-out/`'u yeniden commit'leyin.

Kurulum bitince tanılama ucunu **kaldırın**:
```bash
python3 kaynak/vercel_build.py --test-ucu-yok     # api/test.js çıktıya alınmaz; sonra yeniden dağıtın
```

## 2. `vercel.json` (yazan: proje sahibi) — gereken rewrite listesi

```json
{
  "rewrites": [
    { "source": "/pay/create.php",  "destination": "/api/create" },
    { "source": "/pay/webhook.php", "destination": "/api/webhook" },
    { "source": "/pay/success.php", "destination": "/api/success" },
    { "source": "/pay/orders.php",  "destination": "/api/orders" },
    { "source": "/pay/test.php",    "destination": "/api/test" }
  ]
}
```
Bu adresler değişmez: site formu `/pay/create.php`'ye gönderir, Mollie'ye verilen `redirectUrl`/`webhookUrl`
`/pay/success.php` ve `/pay/webhook.php`'dir. Önerilen (isteğe bağlı) eklemeler:

```json
{
  "regions": ["fra1"],
  "functions": {
    "api/create.js":  { "maxDuration": 30 },
    "api/webhook.js": { "maxDuration": 60 },
    "api/success.js": { "maxDuration": 30 },
    "api/orders.js":  { "maxDuration": 30 },
    "api/test.js":    { "maxDuration": 30 }
  }
}
```
Webhook en kötü durumda Mollie GET + iki Brevo çağrısı + bir PATCH yapar (her biri en çok 10 sn); süre sınırı yetersizse
fonksiyon yarıda kesilir ve Mollie yeniden dener (bkz. §6 çift e-posta notu). `regions`: Belçika trafiği için `fra1`/`cdg1`.

## 3. Ortam değişkenleri

Production **ve** Preview için ayrı ayrı tanımlayın; değişiklik sonrası **yeniden dağıtım** gerekir.

| Değişken | Zorunlu | Açıklama / varsayılan |
|---|---|---|
| `MOLLIE_API_KEY` | evet | Önce `test_...`, sonra `live_...`. Yoksa ödeme başlatılamaz (create 503). |
| `SITE_URL` | önerilir | Varsayılan `https://europetaxi24.be`. Mollie `redirectUrl`/`webhookUrl` ve `Secure` çerez kararı buradan gelir. Sonda `/` olmasın. |
| `BREVO_API_KEY` | evet* | Brevo > SMTP & API > API anahtarı. *Yoksa e-posta ATLANIR (`BREVO_API_KEY yok: e-posta gönderilemedi` loglanır); Vercel'de PHP `mail()` yedeği yoktur. |
| `MAIL_FROM` | önerilir | Gönderen adres; Brevo'da **doğrulanmış** olmalı. Varsayılan `isletme.json > gonderen_eposta`. |
| `COMPANY_EMAIL` | önerilir | İş emirlerinin gideceği adres. Varsayılan `isletme.json > eposta`. |
| `GOOGLE_SERVER_KEY` | hayır | Distance Matrix **sunucu** anahtarı (IP kısıtı Vercel'de kullanılamaz; yalnızca API kısıtı + bütçe uyarısı koyun). Yoksa km yalnız dahili tabloyla doğrulanır. |
| `ADMIN_PASSWORD` | evet* | Panel (`/pay/orders.php`) ve tanılama (`/pay/test.php`) şifresi. **Boşsa ikisi de KAPALI.** ≥ 12 karakter. |
| `SIGNING_SECRET` | önerilir | Çerez imza sırrı (rastgele ≥ 32 karakter). Boşsa `MOLLIE_API_KEY`+`ADMIN_PASSWORD`'den SHA-256 ile türetilir ve **uyarı loglanır** (anahtar döndürülürse tüm oturumlar/çerezler düşer). |
| `DISTANCE_TOLERANCE_PCT` | hayır | Varsayılan `12` (istemci/sunucu km farkı toleransı). |
| `MOLLIE_API_BASE`, `BREVO_API_BASE`, `GOOGLE_API_BASE` | hayır | **Yalnız test** (sahte servisler). Yalnızca `https://…` veya `http://127.0.0.1…` kabul edilir; başka şema/host (ör. `http://127.0.0.1.evil.com`, `file:`) REDDEDİLİR ve ilgili çağrı yapılmaz (üretim adresine sessizce düşülmez). Canlıda tanımlamayın. |

Rastgele sır üretmek için: `openssl rand -hex 32`.

## 4. Firewall / hız sınırı (önerilir)

Uygulama içi sınırlar **bellek içidir ve en-iyi-çabadır**: her sıcak fonksiyon örneği kendi sayacını tutar, soğuk
başlangıçta sıfırlanır, örnekler arası paylaşılmaz. Gerçek koruma için Vercel Firewall'da kural ekleyin
(Project → Firewall → Configure → Add rule; arayüz adları değişebilir, plana göre kural sayısı sınırlıdır):

1. `Request Path equals /pay/create.php` **ve** `Method equals POST` → **Rate limit**: sabit pencere 60 sn, 5 istek, anahtar = IP → 429.
   (Uygulama da dakikada 5 / saatte 30 ile aynı sınırı en-iyi-çabayla uygular.)
2. `Request Path equals /pay/orders.php` veya `/pay/test.php` **ve** `Method equals POST` → 15 dk'da 10 istek/IP.
3. Google anahtarınız varsa Google Cloud'da **aylık bütçe uyarısı** kurun: her `create` bir Distance Matrix çağrısı yapar.
4. İsteğe bağlı: doğrudan `/api/*` çağrılarını (rewrite dışında) Firewall'da reddedin; kuralı dağıtımdan sonra `/pay/*` adreslerinin
   çalıştığını kontrol ederek ekleyin.

Vercel `x-forwarded-for` başlığını gerçek istemci IP'siyle yazar; uygulama ilk değeri kullanır.

## 5. Alan adı bağlama (europetaxi24.be)

1. Vercel projesi → Settings → Domains → `europetaxi24.be` ve `www.europetaxi24.be` ekleyin; **www → çıplak alan adı** yönlendirmesini
   Vercel'de seçin (SITE_URL çıplak adrestir).
2. Vercel'in gösterdiği DNS kayıtlarını (apex için A, www için CNAME) alan adı sağlayıcınıza girin; eski Combell A/CNAME
   kayıtlarını kaldırın. SSL otomatik verilir.
3. **DNS'i taşırken e-posta kayıtlarını (MX, SPF, Brevo DKIM/DMARC TXT) koruyun**; aksi halde Brevo gönderimi/spam sonucu bozulur.
4. `SITE_URL=https://europetaxi24.be`. Mollie webhook'u `https://europetaxi24.be/pay/webhook.php` adresine gelir; Preview
   dağıtımlarında Vercel *Deployment Protection* Mollie'yi engeller — ödeme testini Production'da (test anahtarıyla) yapın.
5. Google tarayıcı anahtarı kısıtlarını (HTTP yönlendiren) yeni alan adlarıyla eşleştirin (`https://europetaxi24.be/*`, `https://www.europetaxi24.be/*`).

## 6. Durumsuz tasarım: bilinmesi gerekenler

**Metadata (siparişin tek kalıcı yeri).** `create` sipariş verisini Mollie `metadata` alanına kısaltılmış anahtarlarla koyar:
`{v:1, n:sipariş no, l:dil, a:alış, b:varış, d:'YYYY-MM-DDTHH:MM', r:dönüş|'', p:yolcu, g:büyük valiz, s:küçük valiz,
c:araç, k:km, t:toplam, u:ad, e:e-posta, h:telefon, src:'g'|'d'}` (`src`: km Google ile mi `g`, dahili tabloyla mı `d`
doğrulandı). Hedef ≤ 900 bayt (Mollie ~1 kB). Aşılırsa önce adresler, sonra ad kırpılır; **asla hata verilmez**; e-posta/telefon/km/tarih
kırpılmaz. Webhook başarıyla e-posta gönderince `m:1` "gönderildi" işaretini metadata'ya yazar. Tutarlar her okumada `k`'dan
sunucuda yeniden hesaplanır.

**E-posta tekrarını önleme (katmanlı, hepsi en-iyi-çaba):**
1. Ödenen tutar, `k`'dan yeniden hesaplanan kapora ile eşit değilse e-posta **gönderilmez** ve hata loglanır (`TUTAR UYUSMUYOR`).
2. `amountRefunded` / `amountChargedBack` > 0 ise gönderilmez (iade/geri ödeme webhook'ları).
3. `paidAt` 48 saatten eskiyse gönderilmez (Mollie'nin yeniden deneme ufku ~26 saattir).
4. Mollie metadata'sında `m:1` varsa gönderilmez (kalıcı; farklı fonksiyon örneklerinde de geçerli). İşaret **PATCH ile yazılır; Mollie'nin
   ödenmiş ödemede metadata güncellemesine izin verdiği canlıda doğrulanmalıdır** — reddedilirse `m:1 işareti yazılamadı` uyarısı
   loglanır ve davranış (1–3 + aşağıdaki 5) bozulmaz.
5. Aynı süreçte ödeme-id tabanlı kilit (`Map`) es zamanlı iki webhook'u sıraya dizer ve "gönderildi" hafızası tutar
   (kısmi başarıda tekrar denemede yalnız eksik e-posta gönderilir). **Bu yalnızca sıcak örnek içinde geçerlidir**; serverless'ta
   iki webhook farklı örneklere düşerse aynı anda ikisi de gönderebilir (pencere: bir webhook çağrısı süresi).

E-posta gönderimi başarısızsa webhook **500** döner ve Mollie yeniden dener. Kabul edilen ender risk: müşteri e-postası gittikten sonra
şirket e-postası başarısız olur **ve** yeniden deneme farklı bir örneğe düşerse müşteriye e-posta tekrar gider (şirket e-postası önce
gönderilmez; çift iş emri riski çift müşteri e-postasından daha kötüdür).

**Bilinen sınırlamalar:**
- Sipariş listesi = Mollie'nin en yeni 250 `metadata.v===1` ödemesi. Eski kayıtlar için Mollie panosunu kullanın.
- Ödeme oluşturma Mollie'de başarısız olursa iz bırakan bir sipariş kaydı yoktur (yalnızca log). PHP'deki `odeme_baslatilamadi` durumu yoktur.
- `success` sayfası, çerezsizken ödemeyi Mollie "list payments" (limit=100) içinde arar; çok yoğun günlerde (≥100 yeni ödeme)
  çerezi olmayan müşteri "işleniyor" sayfası görür (sayfa 6 sn'de yeniler, ~4 dk sonra durur; e-posta yine gider).
- Panelin "Bekliyor" durumu, terk edilmiş ödemeleri Mollie onları `expired` yapana kadar gösterir.
- Hız sınırı ve kaba kuvvet sayaçları örnek başınadır (bkz. §4).
- Adres alanları ≤ 120, ad ≤ 80 karakter; tanınmayan adres + Google yok/hata → km doğrulanamaz → **422 + WhatsApp yönlendirmesi**.
- Bilinen huy (istemci JS motoruyla aynı): "en uzun eşleşme kazanır" kuralı yüzünden `Rue de Bruxelles 5, Namur` gibi adresler `brussels`
  ile eşleşir; sunucu istemciyle aynı sonucu verir.
- `Origin: null` (sayfa `Referrer-Policy: no-referrer` ise tarayıcı bunu gönderir) yok sayılır; Origin/Referer hiç yoksa izin verilir.
  Bunlar CSRF savunma katmanıdır, kimlik doğrulama değil.
- `billingEmail` Mollie'ye gönderilmez (yalnız banktransfer için anlamlı).
- Şirket iş emrindeki "Mesafe" satırı, istemci km'si metadata'da tutulmadığı için PHP'den farklı olarak yalnız km ve doğrulama kaynağını yazar.

## 7. Kurulum sonrası doğrulama (Mollie TEST anahtarıyla)

1. Ortam değişkenlerini girip `vercel deploy --prod`.
2. `https://europetaxi24.be/pay/test.php` adresini açın (şifre **adrese yazılmaz**; formdan girilir): Mollie bağlantısı + aktif yöntemler,
   Brevo/Google erişimi, `SIGNING_SECRET` uyarısı ve **Test e-postası** düğmesi.
3. Sitede bir rezervasyon oluşturup Mollie test ödeme sayfasında "Paid" seçin: 2 e-posta (müşteri + şirket) gelmeli;
   `/pay/success.php` "ödeme alındı" göstermeli; `/pay/orders.php`'de sipariş "ÖDENDİ" olmalı.
4. `python3 kaynak/vercel_build.py --test-ucu-yok` ile yeniden derleyip dağıtın (**tanılama ucunu kapatın**).
5. Canlıya geçiş: `MOLLIE_API_KEY=live_...`, yeniden dağıtım. Bir webhook'u elle yeniden tetiklemek güvenlidir (tekrar önleme):
   `curl -X POST -d id=tr_XXXX https://europetaxi24.be/pay/webhook.php`.

## 8. Testler ve yerel çalıştırma

```bash
python3 kaynak/build.py
python3 kaynak/testler/test_vercel_api.py      # çıkış kodu 0 = geçti (ağ dışı; sahte Mollie/Brevo/Google)
```
Test paketi `vercel_build.py`'yi geçici dizine derler, sahte servisleri (`mock_dis_servisler.py`) ve `dev-server.js`'in 5 ortam varyantını
9500–9599 portlarında başlatır (`ET_TEST_PORT` ile taban değişir; hata ayıklarken `ET_TEST_TMP_KORU=1` geçici dizini/logları saklar).

Elle deneme:
```bash
python3 kaynak/testler/mock_dis_servisler.py --port 9500 &
MOLLIE_API_KEY=test_localdev0123456789 MOLLIE_API_BASE=http://127.0.0.1:9500/v2 \
BREVO_API_KEY=xkeysib-local BREVO_API_BASE=http://127.0.0.1:9500/v3 SITE_URL=http://127.0.0.1:9501 \
ADMIN_PASSWORD=yerel-sifre-123 SIGNING_SECRET=yerel-imza-sirri-0123456789 \
node kaynak/vercel/dev-server.js --dir vercel-out --port 9501
# sahte ödeme: curl -X POST 127.0.0.1:9500/__test/paid/<odeme_id>   |  postalar: curl 127.0.0.1:9500/__test/mails
```
Sahte servisin uçları `mock_dis_servisler.py` dosya başındaki belgede listelidir (PHP testleri de aynı sahte servisi kullanabilir:
`MOLLIE_API_BASE`/`BREVO_API_BASE`/`GOOGLE_API_BASE` karşılıkları için PHP tarafında cURL adresi yapılandırılabilir olmalıdır).

`kaynak/testler/paylasilan-vektorler.json`, PHP ve Node'un aynı mantığı verdiğini kilitleyen ortak vektörlerdir (fiyat, km kararı,
`yer_bul`, dahili mesafe, girdi doğrulama). Node bu dosyaya karşı test edilir; PHP tarafı bu dosyaya göre sertleştirilecektir.

## 9. Gereken yeni `strings.json` anahtarları (opsiyonel; eklenmezse mevcut anahtarlara düşülür)

Node kodu bu anahtarlar `dil.json`'da varsa kullanır (`vercel_build.py`, dört dilde de varsa otomatik ekler), yoksa parantezdeki anahtara düşer.
`strings.json`'a **yazılmadı**; eklerseniz 4 dilde birden ekleyin (build.py anahtar seti denetimi).

| Anahtar | Ne zaman | Yedek | Önerilen metin (fr / nl / en / tr) |
|---|---|---|---|
| `err_km_wa` | km doğrulanamadı (422) | `err_km` | fr: « Nous ne pouvons pas vérifier automatiquement cette distance. Confirmez votre réservation par WhatsApp, nous vous répondons rapidement. » / nl: "We kunnen deze afstand niet automatisch controleren. Bevestig uw reservering via WhatsApp, we antwoorden snel." / en: "We can't verify this distance automatically. Please confirm your booking on WhatsApp and we'll reply quickly." / tr: "Bu mesafeyi otomatik doğrulayamadık. Rezervasyonunuzu WhatsApp'tan onaylayın, hızla dönüş yapalım." |
| `err_rate` | 429 (çok sık deneme) | `err_pay` | fr: « Trop de tentatives en peu de temps. Patientez une minute puis réessayez. » / nl: "Te veel pogingen in korte tijd. Wacht een minuut en probeer het opnieuw." / en: "Too many attempts in a short time. Please wait a minute and try again." / tr: "Kısa sürede çok fazla deneme yapıldı. Bir dakika bekleyip tekrar deneyin." |
| `err_forbidden` | 403 (Origin/Referer uyuşmuyor) | `err_pay` | fr: « Cette demande n'a pas pu être vérifiée. Rechargez la page du site puis réessayez. » / nl: "Deze aanvraag kon niet worden gecontroleerd. Laad de pagina opnieuw en probeer het nog eens." / en: "This request could not be verified. Reload the site page and try again." / tr: "Bu istek doğrulanamadı. Site sayfasını yenileyip tekrar deneyin." |
| `err_bad_request` | 413 (gövde çok büyük) | `err_pay` | fr: « La demande est trop volumineuse. Rechargez la page et réessayez. » / nl: "De aanvraag is te groot. Laad de pagina opnieuw en probeer het nog eens." / en: "The request is too large. Reload the page and try again." / tr: "İstek çok büyük. Sayfayı yenileyip tekrar deneyin." |

Ayrıca `PHP_ANAHTARLARI` listesine (build.py) yeni anahtar eklerseniz `vercel_build.py` listeyi `build.py`'den otomatik okur (çalıştırmadan, `ast` ile).
