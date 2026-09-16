# Europataxi

Belçika, Hollanda, Fransa ve Almanya arasında şehirlerarası ve havalimanı transferleri için
rezervasyon sitesi. Next.js 15 (App Router), TypeScript, Tailwind CSS ve zod ile yazıldı.
Veritabanı yoktur: formlar JSON olarak API route'larına gönderilir, fiyat her zaman sunucuda
yeniden hesaplanır.

Site üç dillidir: Türkçe (varsayılan), İngilizce, Fransızca. Tüm içerik şimdilik Türkçedir;
`/en` ve `/fr` eksik anahtarlarda otomatik olarak Türkçeye düşer. Kök adres (`/`) 308 ile
`/tr` adresine yönlenir.

## Gereksinimler

- Node.js 18.17 veya üstü (`package.json` içindeki `engines` alanı bunu zorunlu tutar).
- npm 9 veya üstü.
- Başka bir servis, veritabanı ya da API anahtarı gerekmez.

## Kurulum ve çalıştırma

```bash
npm install
npm run dev     # http://localhost:3000 adresini açın, / adresi /tr'ye yönlenir
```

| Komut | Ne yapar | Ne gerekir |
| --- | --- | --- |
| `npm install` | Bağımlılıkları kurar | İnternet erişimi |
| `npm run dev` | Geliştirme sunucusu, http://localhost:3000 | Boş bir 3000 portu |
| `npm run build` | Üretim derlemesi (`.next/`) | Kurulmuş bağımlılıklar |
| `npm start` | Derlenmiş sürümü sunar, http://localhost:3000 | Önce `npm run build` |
| `npm run lint` | ESLint (`next/core-web-vitals`, `next/typescript`) | Kurulmuş bağımlılıklar |
| `npm run typecheck` | `tsc --noEmit`, strict mod | Kurulmuş bağımlılıklar |
| `npm test` | `node --import tsx --test tests/*.test.ts` birim testleri | Sunucu gerekmez |
| `npm run e2e` | `node e2e/smoke.mjs` uçtan uca duman testi | Ayakta bir sunucu ve Chromium |

`npm test` fiyatlandırma, doğrulama ve sözlük testlerini çalıştırır; ağ ya da tarayıcı
gerektirmez.

`npm run e2e` gerçek bir tarayıcı açar, bu yüzden site **ayrı bir terminalde çalışıyor olmalıdır**:

```bash
# 1. terminal
npm run build && npm start

# 2. terminal
npx playwright install chromium   # tarayıcı bir kez indirilir
npm run e2e                       # varsayılan adres http://localhost:3000
BASE_URL=https://www.europataxi.com npm run e2e   # başka bir ortamı sınamak için
```

Duman testi her kontrol için tek satır `PASS` ya da `FAIL` basar ve bir kontrol bile düşerse
çıkış kodu 1 olur: yönlendirme, 360 px'de yatay kaydırma, mavi renk taraması, mobil menü,
widget doğrulaması, widget'tan rezervasyona geçiş, rezervasyonun tamamlanması, iki API
route'u, SSS akordeonu ve dil yedeği.

## Proje yapısı

```text
europataxi/
├── README.md
├── package.json           # scriptler, bağımlılıklar, Node sürüm koşulu
├── next.config.mjs
├── tailwind.config.ts     # renk paleti, tip ölçeği, container ayarları
├── postcss.config.mjs
├── tsconfig.json          # strict, noUncheckedIndexedAccess, "@/*" yolu
├── eslint.config.mjs
├── .env.example           # NEXT_PUBLIC_SITE_URL örneği
├── public/
│   └── logo.svg           # header ve footer logosu
├── scripts/
│   └── i18n-add.mjs       # sözlüğe yeni anahtar ekleme yardımcısı
├── tests/                 # node:test birim testleri (npm test)
│   ├── pricing.test.ts    # mesafe, süre, asgari ücret, sınır ötesi, gece, dönüş, çarpanlar
│   ├── validation.test.ts # zod şemaları: rota, rezervasyon, iletişim
│   └── i18n.test.ts       # deep-merge yedeği, sözlük bütünlüğü
├── e2e/
│   └── smoke.mjs          # Playwright duman testi (npm run e2e)
└── src/
    ├── middleware.ts               # dil öneki yoksa /tr'ye 308 yönlendirme
    ├── app/
    │   ├── layout.tsx              # geçirgen kök layout
    │   ├── globals.css             # Tailwind katmanları ve temel stiller
    │   ├── icon.svg                # tarayıcı sekmesi simgesi
    │   ├── not-found.tsx           # dil öneki olmayan 404
    │   ├── robots.ts
    │   ├── sitemap.ts              # her dil için her sayfa
    │   ├── [locale]/
    │   │   ├── layout.tsx          # html/body, Header, main, Footer, JSON-LD
    │   │   ├── page.tsx            # ana sayfa bölümleri
    │   │   ├── error.tsx
    │   │   ├── not-found.tsx
    │   │   ├── [...rest]/page.tsx  # eşleşmeyen yollar için 404
    │   │   ├── hizmetler/page.tsx
    │   │   ├── havalimani-transferleri/page.tsx
    │   │   ├── bolgeler/page.tsx
    │   │   ├── iletisim/page.tsx
    │   │   ├── rezervasyon/page.tsx        # araç seçimi ve yolcu bilgileri
    │   │   ├── gizlilik-politikasi/page.tsx
    │   │   └── kullanim-kosullari/page.tsx
    │   └── api/
    │       ├── booking/route.ts    # POST /api/booking
    │       └── contact/route.ts    # POST /api/contact
    ├── components/
    │   ├── layout/    Header, Footer, MobileMenu, NavLinks, LanguageSwitcher, Logo, SkipLink
    │   ├── home/      Hero, BookingWidget, LocationCombobox, TrustBar, Features, Fleet,
    │   │              FleetSelectButton, VehicleSilhouette, HowItWorks, PopularRoutes,
    │   │              Countries, AirportTransfers, AirportCard, FAQ, CtaBand
    │   ├── booking/   BookingFlow, RouteSummary, VehicleSelector, PassengerForm,
    │   │              BookingSummary, BookingSuccess
    │   ├── contact/   ContactForm, ContactInfo
    │   └── ui/        Button, Input, Select, Textarea, Checkbox, Counter, Toggle,
    │                  FieldShell, SectionHeading, Alert, TaxiStripe, index.ts
    ├── i18n/
    │   ├── config.ts               # localeConfig, locales, defaultLocale, isLocale
    │   ├── getDictionary.ts        # deep-merge yedeğiyle sözlük yükleme
    │   ├── utils.ts                # fill("{max} yolcu"), resolveKey("locations.paris")
    │   └── dictionaries/
    │       ├── tr.json             # TÜM görünür metinler burada
    │       ├── en.json             # şimdilik {}
    │       └── fr.json             # şimdilik {}
    ├── data/
    │   ├── locations.ts            # 33 şehir ve havalimanı, koordinatlarıyla
    │   ├── fleet.ts                # sedan, van, business ve kapasite kuralları
    │   └── routes.ts               # ana sayfadaki popüler rotalar
    ├── lib/
    │   ├── pricing.ts              # PRICING_CONFIG, calculateQuote, formatPrice
    │   ├── validation.ts           # zod şemaları ve alan hatası yardımcıları
    │   ├── booking-params.ts       # widget ile /rezervasyon arasındaki sorgu
    │   ├── dates.ts                # todayISO, timeOptions, formatDate
    │   ├── paths.ts                # pagePaths, localizedPath, switchLocalePath
    │   ├── metadata.ts             # generateMetadata yardımcısı, hreflang, Open Graph
    │   ├── page.ts                 # resolveLocale, PageProps
    │   ├── site.ts                 # telefon, e-posta, sosyal medya bağlantıları
    │   ├── widget-events.ts        # kartlardan widget'a ön doldurma olayı
    │   ├── reference.ts            # EPT-7K3F9Q biçiminde rezervasyon numarası
    │   └── fonts.ts                # Archivo (next/font)
    └── types/
        └── index.ts                # Location, Vehicle, Trip, Quote, API yanıt tipleri
```

Bileşen kuralları: sayfalar ve bölümler sunucu bileşenidir, yalnızca etkileşimli parçalar
(`BookingWidget`, `LocationCombobox`, `MobileMenu`, `LanguageSwitcher`, formlar, SSS akordeonu,
rezervasyon akışı) `"use client"` taşır. Bileşenlerde sabit metin yoktur; her metin sözlükten
gelir, telefon ve e-posta gibi değerler `src/lib/site.ts` içindedir.

## Yeni dil ekleme

1. `src/i18n/dictionaries/<kod>.json` dosyasını oluşturun. Boş bir `{}` bile yeterlidir.
2. `src/i18n/config.ts` içindeki `localeConfig` nesnesine tek bir satır ekleyin:

   ```ts
   export const localeConfig = {
     tr: { name: "Türkçe", short: "TR", intl: "tr-TR", hrefLang: "tr" },
     en: { name: "English", short: "EN", intl: "en-GB", hrefLang: "en" },
     fr: { name: "Français", short: "FR", intl: "fr-FR", hrefLang: "fr" },
     nl: { name: "Nederlands", short: "NL", intl: "nl-NL", hrefLang: "nl" }, // yeni satır
   } as const;
   ```

Başka hiçbir dosyaya dokunmanız gerekmez. URL yönlendirmesi, dil seçici, hreflang
alternatifleri, sitemap ve statik sayfa üretimi bu nesneden beslenir.

### Eksik çeviriler neden sorun çıkarmaz

`src/i18n/getDictionary.ts` içindeki `deepMerge`, Türkçe sözlüğü temel alır ve yalnızca çeviri
dosyasında bulunan anahtarları üzerine yazar. Yani kısmi bir dosya güvenlidir: çevrilen anahtar
yeni dilde, çevrilmeyen anahtar Türkçe görünür. Diziler (SSS listesi, özellikler listesi) parça
parça birleştirilmez, bütün olarak değiştirilir; böylece bir dilin listesi Türkçe listeyle
karışmaz. Bu davranış `tests/i18n.test.ts` içinde sınanır.

### EN ve FR çevirilerini doldurma

`tr.json` tüm anahtarların kaynağıdır. Çeviri yaparken anahtar adlarını ve iç içe yapıyı
birebir koruyun, yalnızca değerleri değiştirin:

```jsonc
// src/i18n/dictionaries/en.json
{
  "hero": {
    "title": "Your reliable transfer partner in Belgium, France, Germany and the Netherlands"
  }
}
```

İster tüm dosyayı `tr.json`'dan kopyalayıp değerleri çevirin, ister bölüm bölüm ilerleyin.
Kısmi dosyalar her zaman çalışır. Bir bölümü kopyalamak için:

```bash
node -e "const tr=require('./src/i18n/dictionaries/tr.json');console.log(JSON.stringify({faq:tr.faq},null,2))" > /tmp/faq.json
```

Var olan anahtarların üzerine yazmadan bir sözlüğe yeni anahtar eklemek için yardımcı script:

```bash
node scripts/i18n-add.mjs <locale> <patch.json>
node scripts/i18n-add.mjs en /tmp/faq.json
echo '{"common":{"bookNow":"Book now"}}' | node scripts/i18n-add.mjs en -
```

Script dosya kilidiyle çalışır, yalnızca eksik anahtarları ekler ve neyi eklediğini, neyi
atladığını yazar. Var olan bir değeri değiştirmek isterseniz JSON dosyasını elle düzenleyin.

## Fiyat ayarlarını düzenleme

Tüm sabitler `src/lib/pricing.ts` dosyasının başındaki tek bir `PRICING_CONFIG` nesnesindedir.
Bir değeri değiştirmek hem arayüzdeki hem API'deki fiyatı aynı anda günceller, çünkü fiyat
sunucuda `calculateQuote` ile yeniden hesaplanır ve istemciden gelen fiyata güvenilmez.

| Alan | Şu anki değer | Anlamı |
| --- | --- | --- |
| `roadFactor` | `1.25` | Kuş uçuşu mesafeyi karayolu mesafesine çeviren katsayı |
| `averageSpeedKmh` | `80` | Süre tahmini için ortalama hız |
| `baseFare` | `15` | Açılış ücreti (€) |
| `perKm` | `1.6` | Km başı ücret (€) |
| `minimumFare` | `45` | Bir bacak için asgari ücret (€) |
| `crossBorderFee` | `10` | Ülke değiştiren rotalara eklenen ücret (€) |
| `night` | `{ startHour: 22, endHour: 6, rate: 0.15 }` | 22:00 ile 06:00 arası %15 gece ücreti |
| `returnDiscount` | `0.05` | Dönüş transferinde toplamdan %5 indirim |
| `currency` | `"EUR"` | Para birimi |
| `roundingStep` | `0.01` | Yuvarlama hassasiyeti |

Hesap sırası: mesafe = haversine × `roadFactor`, süre = mesafe / `averageSpeedKmh`,
bacak fiyatı = `max(minimumFare, baseFare + km × perKm × araçÇarpanı)`, sonra sınır ötesi ücreti,
sonra gece oranı. Dönüş varsa iki bacak toplanır ve `returnDiscount` düşülür.

Araç çarpanları fiyatlandırmada değil `src/data/fleet.ts` içindedir: `sedan` 1.0, `van` 1.35,
`business` 1.7. Bir değeri değiştirdikten sonra `npm test` çalıştırın; `tests/pricing.test.ts`
beklenen tutarları şartnamedeki formülden kendisi hesaplar, bu yüzden testlerdeki sabitleri de
güncellemeniz gerekir.

## Konum listesini düzenleme

Konumlar `src/data/locations.ts` içindedir. Yeni bir şehir ya da havalimanı eklemek iki adımdır:

1. Diziye bir kayıt ekleyin:

   ```ts
   { id: "namur", name: "locations.namur", country: "BE", type: "city", lat: 50.4674, lng: 4.8720 },
   // havalimanı ise: type: "airport", iata: "CRL"
   ```

2. `src/i18n/dictionaries/tr.json` içindeki `locations` nesnesine aynı `id` ile adı ekleyin:

   ```json
   "locations": {
     "namur": "Namur"
   }
   ```

`id` değeri URL'lerde ve API gövdelerinde kullanılan kararlı anahtardır, sonradan değiştirmeyin.
Koordinatlar fiyat ve süre tahmininde kullanılır. Ülke kodu `BE`, `NL`, `FR` ya da `DE` olabilir.
Ana sayfadaki popüler rota kartları `src/data/routes.ts` içindedir ve bu kimliklere işaret eder.
`npm test` her konumun sözlükte bir karşılığı olduğunu ve sözlükte fazladan konum kalmadığını
denetler.

## Logo, renkler ve yazı tipi

- **Logo:** `public/logo.svg` dosyasını değiştirin. Aynı oranı koruyun, dosya `Logo.tsx`
  üzerinden header ve footer'da kullanılır. Bileşenin kendisi
  `src/components/layout/Logo.tsx` içindedir. Tarayıcı sekmesi simgesi ayrı bir dosyadır:
  `src/app/icon.svg`.
- **Renkler:** Palet `tailwind.config.ts` içindeki `palette` nesnesindedir:
  `ink #000000`, `ink-soft #141414`, `line #2A2A2A`, `taxi #FFC20E`, `taxi-dark #E0A800`,
  `paper #FFFFFF`, `muted #A3A3A3`. Tailwind'in varsayılan paleti bilerek kapatılmıştır, yani
  `bg-blue-500` gibi sınıflar derlenmez ve siteye mavi ton sızamaz. Marka rengini değiştirmek
  için `taxi` ve `taxi-dark` değerlerini güncellemeniz yeterlidir; bileşenlerde ham hex yoktur.
- **Yazı tipi:** `src/lib/fonts.ts` içinde `next/font/google` ile Archivo yüklenir ve
  `--font-archivo` değişkeni `tailwind.config.ts` içindeki `fontFamily.sans` listesine bağlanır.
  Başka bir yazı tipine geçmek için bu dosyadaki içe aktarmayı ve ağırlıkları değiştirin,
  değişken adı aynı kalabilir.

## API route'ları

İki route da JSON alır, zod ile doğrular ve hata mesajlarını isteğin `locale` alanına göre
çevirir. Geçersiz gövdede `400`, geçerli gövdede `201` döner.

### POST /api/booking

İstek (şartnamedeki örnek gövde):

```json
{
  "trip": {
    "from": "bru-airport",
    "to": "paris",
    "date": "2026-10-02",
    "time": "14:30",
    "passengers": 2,
    "luggage": 3,
    "return": null
  },
  "vehicle": "sedan",
  "customer": {
    "firstName": "Ayşe",
    "lastName": "Yılmaz",
    "email": "ayse@example.com",
    "phone": "+32470000000",
    "flightNumber": "TK1937",
    "note": "",
    "consent": true
  },
  "locale": "tr"
}
```

`return` alanı dönüşlü transferlerde `{ "date": "2026-10-09", "time": "09:00" }` biçimindedir.
`flightNumber` ve `note` opsiyoneldir, `consent` `true` olmak zorundadır. Fiyat gövdede yer
almaz, sunucu kendisi hesaplar.

Başarılı yanıt (`201`):

```json
{
  "ok": true,
  "reference": "EPT-7K3F9Q",
  "booking": {
    "trip": { "...": "istekteki rota" },
    "vehicle": "sedan",
    "customer": { "...": "istekteki müşteri" },
    "locale": "tr",
    "quote": {
      "vehicle": "sedan",
      "currency": "EUR",
      "outbound": {
        "distanceKm": 342,
        "durationMinutes": 257,
        "base": 562.2,
        "crossBorderFee": 10,
        "nightSurcharge": 0,
        "isNight": false,
        "isCrossBorder": true,
        "total": 572.2
      },
      "inbound": null,
      "subtotal": 572.2,
      "returnDiscount": 0,
      "total": 572.2
    },
    "receivedAt": "2026-10-01T09:12:44.512Z"
  }
}
```

Hatalı yanıt (`400`):

```json
{
  "ok": false,
  "error": "Lütfen işaretli alanları düzeltip tekrar deneyin.",
  "errors": [
    { "path": "customer.email", "message": "Geçerli bir e-posta adresi girin" },
    { "path": "vehicle", "message": "Seçilen araç bu yolcu ve bagaj sayısına uygun değil" }
  ]
}
```

Gövde geçerli JSON değilse yine `400` ve `{ "ok": false, "error": "İstek gövdesi geçerli JSON değil" }` döner.

### POST /api/contact

İstek:

```json
{
  "name": "Ayşe Yılmaz",
  "email": "ayse@example.com",
  "phone": "+32470000000",
  "subject": "booking",
  "message": "Brüksel Havalimanından Paris'e transfer için bilgi almak istiyorum.",
  "consent": true,
  "locale": "tr"
}
```

`subject` yalnızca `booking`, `corporate`, `complaint` ya da `other` olabilir, `message` en az
10 karakterdir. Başarılı yanıt (`201`):

```json
{ "ok": true, "receivedAt": "2026-10-01T09:12:44.512Z" }
```

Hatalı yanıt, booking route'undaki ile aynı biçimdedir: `{ ok: false, error, errors: [{ path, message }] }`.

### E-posta ya da CRM entegrasyonu ekleme

Şu anda veri yalnızca sunucu günlüğüne yazılır. Entegrasyon noktaları:

- `src/app/api/booking/route.ts`, satır 85 `console.log("[api/booking] yeni rezervasyon", ...)`
  ve hemen altındaki satır 86 `// Buraya e-posta servisi / CRM entegrasyonu eklenecek`
- `src/app/api/contact/route.ts`, satır 57 `console.log("[contact]", ...)` ve satır 58
  `// Buraya e-posta servisi / CRM entegrasyonu eklenecek`

Kodu bu yorumun yerine yazın, `NextResponse.json(...)` satırından önce. Gönderim hatası
müşteriye yansımasın diye `try/catch` içine alın ve hatayı `console.error` ile günlüğe düşün:
rezervasyon numarası zaten üretilmiştir, e-posta gitmese bile müşteriye `201` dönmelidir.

**Resend ile e-posta (en kısa yol).** `npm install resend` ve:

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
try {
  await resend.emails.send({
    from: process.env.BOOKING_FROM_EMAIL ?? "rezervasyon@europataxi.com",
    to: process.env.BOOKING_NOTIFICATION_EMAIL ?? "info@europataxi.com",
    replyTo: booking.customer.email,
    subject: `Yeni rezervasyon ${reference}`,
    text: JSON.stringify(response.booking, null, 2),
  });
} catch (mailError) {
  console.error("[api/booking] e-posta gönderilemedi", mailError);
}
```

**Nodemailer ile SMTP.** Kendi posta sunucunuzu kullanacaksanız `npm install nodemailer`,
ardından `nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })`
ile bir taşıyıcı kurup aynı yerde `transport.sendMail(...)` çağırın. Route zaten
`export const runtime = "nodejs"` ile çalışır, yani Node tabanlı kütüphaneler sorunsuz çalışır.

**CRM webhook'u.** Ek bir pakete gerek yoktur:

```ts
if (process.env.CRM_WEBHOOK_URL) {
  try {
    await fetch(process.env.CRM_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRM_API_KEY ?? ""}` },
      body: JSON.stringify({ reference, ...response.booking }),
    });
  } catch (crmError) {
    console.error("[api/booking] CRM'e iletilemedi", crmError);
  }
}
```

Eklenecek ortam değişkenleri (`.env.local` dosyasına ve Vercel proje ayarlarına):

| Değişken | Ne için |
| --- | --- |
| `RESEND_API_KEY` | Resend API anahtarı |
| `BOOKING_FROM_EMAIL` | Gönderen adresi (doğrulanmış alan adı) |
| `BOOKING_NOTIFICATION_EMAIL` | Rezervasyon bildirimlerinin gideceği kutu |
| `CONTACT_NOTIFICATION_EMAIL` | İletişim formu mesajlarının gideceği kutu |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Nodemailer kullanacaksanız |
| `CRM_WEBHOOK_URL`, `CRM_API_KEY` | CRM'e iletim için |

Bu değişkenler sunucu tarafındadır, `NEXT_PUBLIC_` öneki almamalıdır; aksi halde tarayıcıya
sızarlar. `.env*` dosyaları git'e girmez, örnek için `.env.example` dosyasına bakın.

## Vercel'e deploy

> **Önemli:** Bu proje deponun kökünde değil, `europataxi/` alt klasöründedir. Vercel'de
> **Settings > General > Root Directory** alanını `europataxi` olarak ayarlayın. Bu yapılmazsa
> Vercel depo kökünde `package.json` arar ve derleme başlamadan hata verir.

1. Depoyu Vercel'e aktarın (**Add New > Project**, ardından depoyu seçin).
2. **Root Directory** alanına `europataxi` yazın. Framework olarak Next.js otomatik seçilir;
   build komutu `npm run build`, çıktı dizini `.next` olarak kalabilir.
3. **Settings > Environment Variables** altına `NEXT_PUBLIC_SITE_URL` ekleyin, değeri sitenin
   herkese açık adresi olsun, örneğin `https://www.europataxi.com`. Bu değer canonical adres,
   hreflang alternatifleri, `sitemap.xml`, `robots.txt` ve Open Graph etiketlerinde kullanılır.
   Tanımlanmazsa `http://localhost:3000` varsayılır ve arama motorlarına yanlış adres verilir.
   Değişkeni Production, Preview ve Development ortamlarının üçüne de ekleyin.
4. E-posta ya da CRM entegrasyonu eklediyseniz onun anahtarlarını da aynı ekranda tanımlayın.
5. **Deploy** deyin. Kurulum sonrası kendi alan adınızı **Settings > Domains** altından bağlayın
   ve `NEXT_PUBLIC_SITE_URL` değerini o alan adına güncelleyip yeniden deploy edin.

Node sürümü Vercel'de 20 ya da üstü olmalıdır (**Settings > General > Node.js Version**).
Ortam değişkenlerini değiştirdiğinizde yeni bir deploy gerekir, çünkü `NEXT_PUBLIC_` değişkenleri
derleme sırasında gömülür.

## Kabul kontrol listesi

Teslimden önce doğrulayın. İlk üç madde `npm run build` ve `npm test` ile, kalanlar ayakta bir
sunucuda `npm run e2e` ile denetlenir.

- [ ] `npm run build` hatasız tamamlanıyor
- [ ] `/` adresi `/tr`'ye yönleniyor ve tüm metinler Türkçe
- [ ] Bileşenlerde hardcoded metin yok; hepsi `tr.json`'dan geliyor
- [ ] Sitede hiçbir mavi renk yok; palet siyah, sarı, beyaz
- [ ] Widget doğrulaması çalışıyor ve rezervasyon sayfasına doğru parametrelerle gidiyor
- [ ] Kapasiteyi aşan araçlar seçilemiyor
- [ ] Booking ve contact formları JSON gönderiyor, başarı ve hata durumları görünüyor
- [ ] Mobil menü, akordeon ve formlar klavyeyle kullanılabiliyor
- [ ] 360 px genişlikte yatay kaydırma yok
