# YON A: "GECE YOLCULUGU" (sinematik)

Kopya dizini: `/tmp/claude-0/-home-user-10k-websites-skill/8800eec3-33ff-5ac0-95af-f4a89d8bd8a5/scratchpad/tasarim/A-gece-yolculugu`
Statik sunucu portu: 8201 (`python3 -m http.server 8201 --directory <kopya>/www`)
Ekran goruntuleri: `<kopya>/ekran/` (26 dosya, adlari icerigi anlatir)

## 1. Konsept

Logonun ruhu: simsiyah zemin, altin/beyaz HIZ CIZGILERI, dama motifi, "EUROPA" beyaz + "TAXI" altin.
Sayfa bir gece yolculugu gibi acilir: karanlikta bir isik gelir, sayfayi soldan saga tarar, arkasindan
baslik yukselir, cam kart alttan kayarak girer, cati levhasi yanar. Sonrasi sakin: kullanici ilk iki
saniyede etkilenir, sonraki 30 saniyede fiyati gorup rezervasyona baslar.

Tek imza fikri, iki gorunumle: **hiz isigi**.
1. **Hiz isigi tarama** (`.tarama`): acilista tum sayfayi tarayan altin/beyaz isik (saf CSS, `transform`+`opacity`, 1.15 sn).
   Perde degil: saydam, `pointer-events:none`, icerik zaten gorunur, LCP'yi bozmaz.
2. **Taksi cati levhasi CTA** (`.levha`): ana dugme taksi cati isigi gibi; altta iki metal ayak, arkasinda isik havuzu.
   Acilista titreyerek "yanar" (0.7 sn), sonra yavasca nefes alir; hover'da uzerinden isik seridi gecer.
   Ayni dil hero CTA, kapanis bandi ve "Rezervasyonu onayla" dugmesinde tekrar eder.

Hiz cizgisi dili sitenin her yerinde ayni kalir (tutarlilik): nav alt cizgisi soldan buyur, ust ilerleme cubugu,
fiyat panelinde A'dan B'ye cizilen rota, hizli sekmelerde hover'da gecen isik, filo kartinda arac hareket ederken
arkasinda beliren cizgiler, kapanis bandinda kayarak gelen cizgiler, dama seridi (yavas akar).

## 2. Ne dinamik (hepsi CSS, JS'e bagimli degil; JS yalniz artirir)

| Oge | Nasil |
|---|---|
| Acilis (t=0 ile 1.55 sn) | tarama isigi, 13 hiz cizgisi isik basiyla hizla gelir (`translate3d`+`scaleX`, cubic-bezier ease-out), baslik kelime kelime maskeli yukselir, cam kart alttan kayar (easeOutExpo), levha yanar, FAB gelir |
| Ambient (acilistan sonra) | 3 gezinen cizgi, levha nefesi, dama akisi, "hizli baslat" nokta nabzi. Hero gorunmuyorsa/sekme arka plandaysa JS `.durgun` ile hepsini durdurur |
| Paralaks | 4 katman (gorsel + 3 cizgi katmani), imlec +-10 px, kaydirmada en fazla ~40 px; yalniz `transform`, rAF, imlec yalniz mouse'ta, reduced-motion'da CANLI kapanir |
| Hizli baslat | Hero'da 4 tek dokunus sekmesi (Brussels Airport, Charleroi Airport, Gand, Anvers): formu doldurur, fiyat aninda gorunur, fiyat paneli parlar; dokunmatikte gerekirse forma kaydirir |
| Fiyat paneli | Fiyat gelince rota cizgisi A'dan B'ye cizilir, fiyat "vurur", panelden isik gecer; metin degeri ANINDA yazilir (test/erisilebilirlik icin sayma animasyonu yok) |
| Guven seridi | 24/7, 4 dil, 5 ulke, 1,99 EUR/km: ekrana girince sayilir (IntersectionObserver). Ekrandaki/bot goren degerler nihai metindir |
| Nasil calisir | Rota cizgisi kaydirdikca kendini cizer: `animation-timeline: view()`; destek yoksa IntersectionObserver yedegi (dikey mobilde de) |
| Bolum girisleri | `animation-timeline: view()` ile yumusak yukselis; baslangic opakligi .35 (kaydirmadan alinan tam sayfa goruntuler bile okunur) |
| Baslik | Kaydirinca cam gorunum, ust ilerleme cubugu (`scroll()` timeline) |
| Mikro etkilesim | hover/focus/active her dugmede; mod secici kayan gosterge; anahtar (switch); sayac dokunusu; hata kutusu sarsilir; hatali alan kirmizi (`aria-invalid`) |

Hareket egrileri: `--ease-out` cubic-bezier(.22,1,.36,1) (easeOutQuint), `--ease-cubic` (.215,.61,.355,1), `--ease-expo` (.16,1,.3,1).

## 3. Karar gerekceleri

- **Foto yerine bokeh + CSS cizgiler**: gercek foto yok; jenerik "arac fotosu" yerine logoya sadik, sadece isik. Bokeh gorseli
  (`hero-masa.jpg` 24 KB, `hero-mobil.jpg` 14 KB) `kaynak/gorsel-kaynak/sahne-hero.html` ile tohumlu ve tekrar uretilebilir;
  hiz cizgileri gorselde YOK, sitede canli. Gercek fotograf ayni dosya adiyla gelirse okunurluk karartmasi CSS'te oldugu icin direkt calisir.
- **Cam kart okunakli**: arka plan %66-74 opak koyu + 26 px blur, alanlar opak koyu; en kotu durumda (saf altin cizgi arkada) mist metin 5.3:1.
- **Form tek sayfa, numarali gruplar** (1 kart basligi, 2 iletisim, 3 arac, 4 odeme): sihirbaz yapmadim, cunku dogrulama/testler
  ve "Rezervasyonu onayla" akisi degismemeli. Rota ray'i (nokta ve baklava) + yer degistir koprusu.
- **Sol sutun yapiskan** (masaustu, yukseklik >= 720): uzun formda kaydirirken baslik ve hizli sekmeler yerinde kalir.
- **Az bolum**: hero, guven seridi, nasil calisir, neden biz, filo, populer rotalar, kapanis bandi (tek satirlik CTA), SSS, yasal.
  Kapanis bandi yeni tek bolum; baslik yeni `final_title` metni (SEO'da form_sub tekrarini onler).
- **Rozetler kaldirildi** (badge_1..3): guven seridiyle cift olurdu; anahtarlar strings.json'da duruyor.
- **Nav < 1200 px gizlenir**: marka + dil + CTA tek satirda kalir (site tek sayfa, hamburger gerekmez).
- **Onceki `<img alt>` bos**: hero gorseli dekoratif; gercek foto gelince `alt="{{alt_hero}}"` yapilir (OKUBENI.md'de yazili).

## 4. Teknik sozlesme uyumu

1. **Satir ici JS yok**: tum JS `assets/app.js`; sayfa verisi `<script type="application/json" id="et-data">` (`dil, wa, veri, soz`).
   `config.js` ve `app.js` ikisi `defer`, config once. Kok sayfanin yonlendirme betigi de `assets/kok.js`'e tasindi
   (build.py'nin kok sayfa uretimi; siki CSP `script-src 'self'` altinda satir ici betik calismazdi) ve stili `assets/kok.css`.
   **Siki CSP testi**: `default-src 'none'; script-src 'self' https://maps.googleapis.com; style-src 'self'; font-src 'self'; img-src 'self' data:; form-action 'self'`
   altinda 4 dil x (masaustu, mobil), tum etkilesimlerle: 0 ihlal, 0 konsol hatasi. (Paralaks ve `--ust-yuk` CSSOM ile yazilir, CSP'ye takilmaz.)
2. **CSS `assets/site.css`**, en basta iki `@font-face` blogu (fonts.css icerigi). Google'a HICBIR istek yok
   (testte harici istek = 0). latin dosyasi `<link rel="preload" as="font" type="font/woff2" crossorigin>`.
   Yedek yazi `Archivo Yedek` (Arial'a `size-adjust` ile kalibre: genislik farki <%1) yazi gecisinde kaymayi onler.
   Satir ici `style=""` nitelikleri: 0.
3. **`<head>`**: tum eski yer tutucular duruyor; `{{HEAD_EK}}` tek, `</head>`'den hemen once (build.py bos doldurur). Google betigi yalniz anahtar varsa app.js ile yuklenir.
4. **Kimlikler**: listedeki tum kimlik/nitelikler duruyor (test_adim2 bunlari tek tek denetler). Yeni: `.hizli-sekme[data-alis][data-varis]`, `#et-data`, `#ust`, `#top`.
4b. **Google hata deseni** aynen tasindi (on-test, `gm_authFailure`, `fallbackMode`, 6 sn, `.pac-container/.gm-err-container` temizligi, CSS agi);
   tarayici testine sahte `google.maps` ile MUTLU YOL testi de eklendi (Autocomplete + Directions).
5. **Performans**: bkz. Olculen degerler. Acilis <= 1.55 sn (testte otomatik: sonlu animasyonlarin `delay+sure` maksimumu <= 1600 ms).
   Perde/preloader yok (testte: tiklamayi tutan tam ekran fixed oge = 0). scroll-jacking yok, video yok.
   `prefers-reduced-motion: reduce`: CSS'te `animation/transition:none` (taban stiller nihai durum) VE JS'te `matchMedia` `change` ile canli dinleme (paralaks, sayaclar, rota yedegi).
   JS kapaliyken ekran ustu icerik gorunur, asagidaki bolumler kaydirinca gorunur (testte).
6. **Erisilebilirlik**: kontrast tablosu asagida. `:focus-visible` altin, tum etkilesimli ogeler klavye ile odaklanir (16 Tab dogrulandi).
   `pointer:coarse` iken tum etkilesimli ogeler >= 44x44 px (olculdu: 0 ihlal). Tek `<h1>`; header/nav x2/main/footer; bolumler `aria-labelledby`;
   `fieldset/legend`; durum satiri `role=status`; hata `role=alert` + `aria-invalid`; gizli dekorlar `aria-hidden`.
7. **Mobil kurallar**: input 16 px, `color-scheme:dark`, `.grid-2 > div{min-width:0}`, basliklarda `overflow-wrap:anywhere`,
   footer alt bosluk `calc(96px + env(safe-area-inset-bottom))`, 400 px alti fiyat kutulari dikey (satir satir), `html,body{overflow-x:clip}`, `header{flex-wrap:wrap}`.
8. **Dokunmadigim yerler**: `kaynak/pay/**`, `kok.htaccess`, `vercel/**`, `isletme.json`, `mesafe-verisi.json`, `teslim/`, `KURULUM.md`, `TEST-RAPORU.md`.
   Degisenler: `template.html`, `assets/**` (yeni: site.css, app.js, kok.js, kok.css; hero gorselleri), `gorsel-kaynak/**`,
   `strings.json` (8 yeni anahtar x 4 dil: `quick_label, trust_aria, trust_1_n, trust_1_l, trust_2_l, trust_3_l, trust_4_l, final_title`),
   `build.py` (yalniz: fiyat sabitlerini app.js'den okuma, h1 kelime sarma, `HIZLI_SEKMELER`, `ET_DATA`, `KM_UCRETI(_SAYI)`, `HEAD_EK`, kok sayfa dosyalari, fonts.css'i yayina almama),
   `test_adim2.py` ve `tarayici-test.js` (yapisal uyum + yeni kontroller; hicbir kontrol gevsetilmedi).

## 5. Olculen degerler (Chromium 141, yerel Archivo, sunucu gzip degil: gzip -6 ile hesaplandi)

**Ilk yukleme aktarimi** (HTML + CSS + JS + config.js + latin font + hero gorseli + 3 arac SVG, gzip'li):

| | FR | NL | EN | TR (latin-ext font +33 KB) | Hedef |
|---|---|---|---|---|---|
| Masaustu | 98.2 KB | 98.0 KB | 97.8 KB | 129.9 KB | <= 300 KB |
| Mobil | 88.5 KB | 88.2 KB | 88.1 KB | 120.2 KB | <= 250 KB |

Kalemler (FR masaustu): HTML 14.4, site.css 13.8, app.js 9.3, latin font 34.1, hero-masa 24.1, config 0.3, 3 SVG 1.3 KB. 9 istek, harici istek 0.

**LCP / CLS** (PerformanceObserver; LCP ogesi dekoratif hero gorseli):

| Ortam | FCP = LCP | CLS |
|---|---|---|
| Masaustu 1440x900 | 284 ms (FR), 268 ms (TR) | 0.0000 |
| Mobil 390x844 | 164 ms (FR), 192 ms (TR) | 0.0000 |
| Mobil, 1.6 Mbps + 150 ms RTT + CPU 4x | 1556 ms (FR), 1480 ms (TR) | 0.0000 |
| Masaustu, ayni kisit | 1656 ms (FR), 1728 ms (TR) | 0.0000 |

**Yatay tasma** (320/360/390/412 px, mobil emulasyon; her genislikte 4 dil x 5 durum: ilk, fiyat gorunur, hata kutusu acik, havalimani modu, onay sonrasi odeme secimi;
"%130 yazi" = Android buyuk yazi taklidi: sayfadaki TUM eleman yazi boyutlari 1.3 kati; olcum: `scrollWidth - innerWidth` VE gorunen hicbir ogenin sayfa disina tasmamasi; GERCEK Archivo yuklu):

| Genislik | Normal yazi | %130 yazi |
|---|---|---|
| 320 px | 0 tasma, 0 disari tasan oge | 0 tasma, 0 disari tasan oge |
| 360 px | 0 / 0 | 0 / 0 |
| 390 px | 0 / 0 | 0 / 0 |
| 412 px | 0 / 0 | 0 / 0 |

(160 sayfa yuklemesi: 4 genislik x 2 olcek x 4 dil x 5 durum; dokunmatik emulasyon, yani 44 px hedefler devrede. Olcum ilk turda iki gercek tasma yakaladi ve duzeltildi:
populer rota chip'lerindeki nowrap fiyat ve NL'de sayac satiri; ikisi de `flex-wrap` ile cozuldu. Ayni kontrol artik `tarayici-test.js` icinde kalici: 4 genislik x FR/NL/TR x %130 yazi.)

**Acilis akiciligi** (rAF araligi, ilk 3.2 sn): mobil emulasyonda CPU 4x altinda medyan 16.7 ms (60 fps), p95 16.8 ms; tek uzun kare ilk boyama (parse/stil/JS).
Masaustu headless (yazilimsal raster, GPU yok) medyan 33 ms: sandbox siniri, `backdrop-filter` gercek GPU'da ucuz; yine de blur 26 px ile sinirli.

**Testler** (kopyada): test_adim1 2407, test_adim2 628, test_adim4 69 kontrol GECTI; `tarayici-test.js` GECTI
(yeni: harici istek 0, Archivo yerel yuklu, hizli sekme, acilis <= 1.6 sn, perde yok, JS kapali gorunurluk, reduced-motion (acik + canli), Google mutlu yol, 4 genislik x %130 yazi tasma).

**Kontrast (AA, hesaplandi)**

| Cift | Oran |
|---|---|
| Metin #F4F4F6 / siyah | 18.0 |
| mist #A8AAB3 / siyah, black-2, black-3 | 8.5, 8.1, 7.5 |
| mist / cam kartin en kotu hali (arkasinda saf altin) | 5.3 |
| mist-2 #9B9DAB (yeni turev ton) / siyah, black-2 | 7.4, 7.0 |
| altin #FFC107 / siyah, black-2 | 12.1, 11.5 |
| koyu #141005 / altin, altin-2 | 11.7, 9.1 |
| koyu #06250F / WhatsApp yesili | 8.3 |
| placeholder #8A8C99 / girdi zemini | 5.9 |
| hata #FFB4AE / hata kutusu | 10.1 |
| **soluk #6E7080 / siyah (yasal punto, MARKA RENGI)** | **4.04 (AA-buyuk; normal metin 4.5'in altinda)** |

`--soluk` yalniz `.adres-notu` (yasal adres notu, 11 px) icin kaldi; onceki `.servis-notu`, `.formul-satiri`, `.haklar` ikincil metinleri okunur turev tona (`--mist-2`) alindi.

## 6. Bilinen sorunlar / dikkat

- **`--soluk` #6E7080 AA'yi gecmiyor** (4.04:1): musterinin yasal kucuk punto rengi. Yalniz yasal adres satirinda. Karar sahibi isterse `--mist-2` yapilir.
- **Bos fiyat yer tutucusu "—" (em dash)**: `tarayici-test.js` taninmayan adreste `#p-fiyat === '—'` bekliyor, bu yuzden JS ve sablonda kaldi. Baska hicbir yerde em dash yok (testle korunuyor).
- **Kok sayfa degisti** (kok.js/kok.css): sozlesme gozetildi ama build.py'nin kok sayfa uretimine dokunuldu; sunucu tarafi karsiligi yok, davranis ayni.
- **Onbellek**: dosya adlarinda surum yok (`/assets/app.js`); `kok.htaccess` CSS/JS'i 1 hafta onbellekliyor. Yeniden yayinda eski onbellek riski (Vercel'de sorun degil).
- **`animation-timeline: view()` destegi yoksa** (eski Firefox/Safari): bolum girisleri (`.gir`) animasyonsuz gorunur, rota cizgisi IntersectionObserver ile cizilir. Iki yol da testte dogrulandi.
- **Hero gorseli soyut**: gecerli foto degil; alt bos (dekoratif). `alt_hero` anahtari su an kullanilmiyor.
- **Google anahtari ile gercek test yapilamadi** (ag kapali): Autocomplete/Directions sahte `google.maps` ile dogrulandi; fonksiyon govdeleri onceki surumle ayni.
- **Sekmeler sabit**: hizli baslat = `populer` listesinin ilk 4 rotasi (build.py'de `[:4]`); baska rota istenirse `mesafe-verisi.json` `populer` sirasi degisir.
- **TR sayfasi** latin-ext fontunu da indirir (+33 KB); butce icinde.
- **Masaustu 1200 px alti nav gizli**; mobilde dil menusu 44 px hedefle dar telefonlarda (<=360) alt satira inebilir (istenen `flex-wrap` agi).
- Uygulanmayan fikirler: gercek foto, tam sihirbaz form, hamburger menu (sadelik).

## 7. En guclu 3 yon

1. **Imza tutarliligi**: hiz isigi (acilis taramasi) + cati levhasi CTA, ayni dil fiyat rotasi, sekmeler, filo, kapanis bandinda tekrar ediyor; jenerik sablon gorunumu yok, logonun ruhuyla birebir.
2. **Donusum**: hizli baslat sekmeleri 1 dokunusla fiyat gosteriyor, cam kartta rota rayli net form, fiyat paneli dolu (kapora/aracta odenecek/mesafe/sure) ve canli; sticky sol sutunla uzun formda baglam kaybolmuyor.
3. **Muhendislik**: 98 KB (masaustu) / 88 KB (mobil) gzip, LCP < 300 ms, CLS 0, siki CSP altinda 0 ihlal, JS'siz gorunur icerik, canli reduced-motion, 320 px + %130 yazi tasmasiz.

## 8. Ekran goruntuleri (`ekran/`)

- Acilis kareleri (t=0.3, 0.9, 1.8, 3.0 sn; tum CSS animasyonlari ayni ana sarilarak deterministik): `masa-1440x900-acilis-t*.jpg`, `mobil-390x844-acilis-t*.jpg`
- Form dolu: `*-form-dolu-rota-secili-fiyat-gorunur.jpg`, `*-form-dolu-tum-alanlar-ust.jpg`, `*-form-dolu-onay-sonrasi-odeme-secimi.jpg` (masa + mobil)
- Tam sayfa (nihai durum, jpeg): `masa-1440x900-tam-sayfa.jpg`, `mobil-390x844-tam-sayfa.jpg`
- 4 dilin mobil hero'su: `mobil-390x844-hero-{fr,nl,en,tr}.jpg`
- Rota cizgisi kaydirma ilerlemesi (basliyor, ilerliyor, cizildi): `*-nasil-calisir-rota-cizgisi-*.jpg`

## 9. Yeniden uretmek

```
python3 kaynak/build.py
python3 kaynak/testler/test_adim1.py && python3 kaynak/testler/test_adim2.py && python3 kaynak/testler/test_adim4.py
python3 -m http.server 8201 --directory www &
NODE_PATH=$(npm root -g) node kaynak/testler/tarayici-test.js
```
