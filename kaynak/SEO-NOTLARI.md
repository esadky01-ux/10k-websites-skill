# SEO / GEO NOTLARI (Europa Taxi)

Bu belge `kaynak/seo.py` katmaninin kararlarini, dogrulama ciktilarini, `build.py`'ye baglama yamasini ve
musterinin kod disinda yapmasi gerekenleri toplar. Katman bagimsizdir: `build.py`, `template.html`,
`strings.json` bu calismada DEGISTIRILMEDI; baglama yamasi asagida (5. bolum) diff olarak verilmistir.

## 1. Ne uretildi

| Dosya | Gorev |
|---|---|
| `kaynak/seo.py` | Saf fonksiyonlar (yan etkisiz, yalniz stdlib): `head_ek`, `jsonld_graph`, `jsonld_faq`, `llms_txt`, `llms_full_txt`, `robots_txt`, `security_txt`, `manifest` (+`manifest_json`), `sitemap_xml`, `zone_data`, `statik_doldur` |
| `kaynak/seo-strings.json` | 4 dilli metinler. `build.py` bunu `strings[dil]` uzerine BIRLESTIRIR (ayni anahtar varsa seo-strings kazanir) |
| `kaynak/testler/test_seo.py` | Ag disi test paketi (4900+ kontrol) |
| `kaynak/assets/icons/` | `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (Playwright + Chromium ile logo ikonundan; #0A0A0C zemin, altin ikon) |
| `kaynak/SEO-NOTLARI.md` | Bu belge |

Cikti dosyalari (build sonrasi `www/`): `llms.txt`, `llms-full.txt`, `manifest.webmanifest`,
`.well-known/security.txt`, guncellenmis `sitemap.xml` ve `robots.txt`; her dil sayfasinda tek `@graph` blogu
+ tek FAQPage blogu + `<head>` eki.

`seo-strings.json` anahtarlari:
- Override (strings.json'da zaten var): `meta_title` (yalniz fr ve nl), `meta_desc`, `og_desc` (4 dil).
  `test_seo.py` yalniz bu 4 anahtarin ezilmesine izin verir (yanlislikla baska anahtari ezme riskine karsi).
- Yeni (4 dilde birebir ayni anahtar ve yer tutucu kumesi): `og_image_alt`, `zones_*` (6), `faq7..faq10` (q/a),
  `ld_*` (JSON-LD etiketleri), `ulke_be/de/fr/lu/nl`.

## 2. Kararlar

### 2.1 JSON-LD (tek `@graph` + ayri FAQPage)
- **Sayfa basina 2 blok** (test_adim2'nin "tam 2 blok" kurali korunur): (1) `@graph` = Organization, WebSite,
  TaxiService+LocalBusiness, WebPage; (2) FAQPage.
- **@id'ler**: `ALAN/#organization`, `ALAN/#website`, `ALAN/#logo`, `ALAN/#isletme` (MEVCUT sabit id korundu),
  `SAYFA_URL#webpage`, `SAYFA_URL#faq`. Ilk dort id 4 dil sayfasinda ayni (tek kimlik), son ikisi sayfaya ozgu.
  Tum referanslar (`publisher`, `isPartOf`, `about`, `parentOrganization`, `logo`, katalog ogeleri) var olan
  `@id`'lere isaret eder; testte dogrulanir.
- **Organization** = hukuki kimlik (CAN COMPANY, KDV, adres, contactPoint 7/24). **TaxiService+LocalBusiness** =
  "Europa Taxi" yerel isletmesi; `parentOrganization` ile Organization'a baglanir. Logo olarak kare
  `icon-512.png` kullanildi (eski `logo.svg` 640x200 yatay bannerdi).
- **Teklifler**: `makesOffer` = km tarifesi (10 + 1,99, `UnitPriceSpecification` unitCode KMT), havalimani
  "sabit fiyat" istegi (fiyatsiz; sitedeki metinle ayni), 8 hesaplanmis ornek rota, donus yolculugu (fiyatsiz:
  sitede donus icin ayri fiyat kurali YOKTUR, uydurulmadi). `hasOfferCatalog` bunlara `@id` ile baglanan 4 hizmet
  (havalimani transferi, sehirler arasi taksi, sinir otesi transfer, donus). Ornek fiyatlar `fiyat(km)` ile KESIN
  tablodan hesaplanir; her teklifin aciklamasinda "tahmini/kilometre tarifesi, kesin fiyat rezervasyonda" notu var.
- **Yasak alanlar YOK**: `aggregateRating`, `review`, `sameAs`, `award`, `foundingDate`, `numberOfEmployees`
  (test_seo.py her JSON-LD dugumunu tarar).
- **speakable** `WebPage` dugumunde (schema.org'a gore `speakable` LocalBusiness'ta degil Article/WebPage'de gecerlidir).
- **ReserveAction** iki hedefli: sayfadaki `#rezervasyon` formu ve WhatsApp. Bu yuzden `potentialAction.target`
  liste oldu (test_adim2 uyarlamasi gerekir, bkz. 5.4).
- **paymentAccepted** = "Bancontact, Credit card, Apple Pay, Cash": ilk uc yontem cevrimici kapora, "Cash" kalan
  tutarin soforde nakit/kartla odenmesi (SSS 2 ile ayni bilgi).
- **areaServed**: BE/DE/FR/LU/NL ulkeleri (`identifier` = ISO kodu, `name` = dile gore ad) + 23 sehir + 13 havalimani
  (`iataCode`; Orly icin ORY, veri dosyasindaki ad parantezinden okunur).
- **Uyarilar**: `availableLanguage` ve `knowsLanguage` sitenin 4 dilini yazar. Bu bir "iletisimde bu dillerde
  yanit veriyoruz" beyani sayilir; musteri dogrulamalidir. Gerekirse `seo.ILETISIM_DILLERI` daraltilir/bos birakilir
  (bos: uc alan da yazilmaz).

### 2.2 Ek SSS (faq7..faq10) ve senkron
Konular: BRU transferi (km + fiyat + Gent'ten fiyat + kapora), Charleroi (km + fiyat + bekleme), gece/erken sabah
7/24, sinir otesi (Schiphol ve Paris ornek fiyatlari). Odeme ve ulke sorulari SSS 2 ve SSS 5'te zaten var,
tekrarlanmadi. Fiyat/km yer tutuculari (`{price_bru} {km_bru} {price_crl} {km_crl} {price_gnt} {km_gnt}
{price_ams} {km_ams} {price_par} {km_par}`) build zamaninda KESIN tablodan `fiyat()` ile hesaplanir
(`seo.statik_doldur`), bu yuzden metin ve sabitler ayrisamaz. JSON-LD FAQPage, gorunur 10 soru-cevabi BIREBIR
alir. Havalimani "sabit fiyat" (WhatsApp ile gunluk fiyat) bilgisi sitedeki `airport_info` ile celismesin diye
SSS 7'de belirtildi; kilometre tarifesi ornegi "kilometre tarifesiyle" diye acikca etiketlendi.
Kural: cevaplarda `<`, `>`, `&`, `"` yok (HTML kacisi ile JSON-LD birebir esit kalsin).

### 2.3 Meta onerileri (yalniz gercekten daha iyi olanlar)
Olcut: hedef anahtar kelimelerin title+description icinde dogal cumlede (komsu kelime penceresi) gecme sayisi
(`test_seo.py` olcer ve "yeni >= eski", override'da "yeni > eski" zorunlu tutar). Uzunluk test_adim2 gibi KACISLI
(`&` = 5 karakter) olculur.

| Dil | Anahtar | Eski | Yeni | Kapsam |
|---|---|---|---|---|
| fr | title | `Taxi Bruxelles & transfert aéroport 24h/24 | Europa Taxi` (60 kacisli) | `Taxi Bruxelles, transfert aéroport Zaventem | Europa Taxi` (57) | 2/5 -> 5/5 (title+desc) |
| fr | description | 153 | `Taxi Bruxelles et Zaventem 24h/24 à prix fixe annoncé d'avance. Transfert aéroport Bruxelles, taxi aéroport Charleroi, navette aéroport. Réservation en ligne.` (158) | |
| nl | title | `Taxi & luchthavenvervoer Zaventem 24/7 | Europa Taxi` | `Taxi Brussel & luchthavenvervoer Zaventem | Europa Taxi` (59) | 1/5 -> 4/5 |
| nl | description | 159 | `Taxi Gent, Brussel en heel België, vaste prijs vooraf. Luchthavenvervoer Zaventem, Charleroi taxi en grensoverschrijdende taxi. 24/7, voorschot online.` (151) | |
| en | title | DEGISMEDI: mevcut `Brussels Taxi & Airport Transfer 24/7` zaten iyi (55) | | |
| en | description | 139 | `Brussels taxi at a fixed price: Zaventem taxi, Charleroi airport taxi and cross-border taxi from Belgium to Germany, France, Luxembourg and the Netherlands.` (156) | 2/5 -> 5/5 |
| tr | title | DEGISMEDI: mevcut `Brüksel Taksi & Havalimanı Transferi 7/24` iyi (59) | | |
| tr | description | 159 | `Brüksel taksi ve Belçika havalimanı taksi hizmeti: Zaventem ile Charleroi transferi, önceden hesaplanan sabit fiyat, online kapora. Her gün 7/24.` (145) | 3/4 -> 4/4 |
| 4 dil | og_desc | genel ifade | Formul + kapora yuzdesi ({base} + {perkm} per km, %{pct} online) gibi somut bilgi: WhatsApp/sosyal onizlemede tiklama nedeni | |

`og_title` bilerek degistirilmedi (mevcutlar marka once yapisiyla zaten iyi). NL'de "Brussel luchthaven transfer"
ifadesi title+description'a sigmadi; SSS 7 sorusunda ("luchthaventransfer van Brussel") dogal olarak geciyor.
NL metinleri Belcika Flamancasi: voorschot, kredietkaart, instapgeld, luchthavenvervoer, break, dagprijs
("aanbetaling", "creditcard", "pinpas" test ile yasak). FR = Belcika Fransizcasi (Gand, Anvers, Malines...).

### 2.4 Geo koordinati: YAKLASIKTIR
`seo.KOORDINAT = (50.8845, 4.4715)` Zaventem ilce merkezidir, Excelsiorlaan 31'in gercek koordinati DEGILDIR.
Tek yerde tanimlidir; `geo.position`, `ICBM` ve JSON-LD `geo` birlikte guncellenir. Musteri Google Haritalar'da adrese
sag tiklayip koordinati kopyalayinca yalnizca `kaynak/seo.py` icindeki bu satir degistirilir. Dürüst not: `geo.*`
ve `ICBM` meta'lari Google tarafindan kullanilmayan eski standartlardir (zarari yok, istendigi icin eklendi);
yerel SEO'da asil agirlik Google Business Profile, NAP tutarliligi ve JSON-LD `geo`/`address`'tir.
`isletme.json`'a koordinat yazilmadi (sartname sabitleri degismesin diye).

### 2.5 robots.txt ve yapay zeka botlari (ISLETME KARARI)
- `*` grubu: `Allow: /`, `Disallow: /pay/`, `Disallow: /api/`.
- Arama/yanit botlari ACIKCA izinli: OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User,
  Applebot, Googlebot, Bingbot. Adli bir grup o bot icin `*` grubunu gecersiz kildigindan `/pay/` ve `/api/`
  kurallari bu grupta da tekrarlanir (testle dogrulanir).
- **Egitim tarayicilari (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot): karar = IZINLI (varsayilan).**
  Aktif kural yok; engellemek icin dosyadaki yorum blogunun `# ` isaretleri kaldirilir. Bu bir is karari:
  izin vermek, modellerin markayi ve fiyat formulunu dogru bilmesine yarar; vermemek icerigin egitimde
  kullanilmasini onler. Karari musteri verir. Arama/yanit botlari her durumda izinli kalir.
- robots.txt bir erisim kontrolu degil talimattir; ozel veri zaten `/pay/` altinda .htaccess ile korunur.

### 2.6 manifest.webmanifest: `display: minimal-ui`
Site bir uygulama degil rezervasyon sitesi. `standalone` adres cubugunu kaldirir; Mollie odeme yonlendirmesi,
WhatsApp baglantilari ve dil degistirme icin adres cubugu/geri dugmesi gerekir. `minimal-ui` bunlari korur;
desteklemeyen tarayici `browser`'a duser. Tek satirla (`seo.MANIFEST_DISPLAY`) degistirilir. `start_url` `/`
(kok sayfa tarayici diline gore yonlendirir), tema/zemin #0A0A0C, `lang` fr-BE (x-default dili).
Ikonlar: 192 ve 512 (`any`), 512 `maskable` (altin ikon merkez daire capi %80 icinde; testte piksel duzeyinde
dogrulanir), 180 apple-touch-icon.

### 2.7 llms.txt ve llms-full.txt
- `/llms.txt`: llmstxt.org bicimi (H1, blockquote ozet, H2 bolumleri, linkler), Ingilizce, tarihli
  ("Last updated: bugun"), tek anlamli olgusal cumleler: isletme, 4 dil URL'si, hizmetler, formul, kapora,
  HESAPLANMIS fiyat tablosu (KESIN tablodan; testte formulle yeniden hesaplanir), bekleme/iptal, filo, iletisim,
  SSS ozeti. Boyut ~6,8 KB (sinir 20 KB).
- `/llms-full.txt`: 4 dilin tam metin ozeti + 10 SSS + hizmet bolgeleri (site metinlerinden uretilir, sayfayla
  celismez). Boyut ~28 KB (sinir 80 KB).
- Dürüst not: llms.txt henuz resmi bir standart degil ve buyuk arama motorlarinin siralamasini etkiledigi
  kanitlanmis degil; dusuk maliyetli, zarar vermeyen bir GEO katkisidir. Asil GEO etkisi sayfadaki net,
  olgusal, tekrarlanabilir metinden (SSS, fiyat tablosu, JSON-LD) gelir.

### 2.8 security.txt
RFC 9116: `Contact: mailto:`, `Expires` = build tarihi + 365 gun, `Preferred-Languages`, `Canonical`; `Policy` yok.
DIKKAT: `Expires` build tarihine baglidir; site yilda en az bir kez yeniden derlenmezse sure dolar.

### 2.9 sitemap.xml
Ayni kume yapisi (4 URL x tam 5'li xhtml:link + lastmod), her URL icin `image:image` (og.jpg; `xmlns:image`
tanimli). `lastmod` = build tarihidir (bugunku davranis korundu). Daha durust olmasi icin `ctx['lastmod']`
ile icerigin son degisim tarihi (ornegin son git commit tarihi) verilebilir; `seo.sitemap_xml` bunu destekler.

### 2.10 Dagitim uyarilari (onemli)
`kok.htaccess` bugun `robots.txt`, `sitemap.xml`, `favicon.ico` DISINDAKI kokteki her adresi `/fr/`'ye 301 ile
yonlendirir. Yama olmadan `/llms.txt`, `/llms-full.txt`, `/manifest.webmanifest` ve `/.well-known/security.txt`
`/fr/`'ye gider (test_seo.py bunu kuralin RewriteCond zincirini simule ederek UYARI olarak gosterir).
5.2'deki yama istisnalari ve `.webmanifest` MIME tipini ekler. Vercel dagitiminda ek is gerekmez
(`vercel_build.py` `.well-known` klasorunu kopyalar).

Sayfa boyutu: her dil sayfasi ~85 KB -> ~107 KB (JSON-LD ~13,5 KB + FAQ blogu ~3,5 KB + gorunur bolge ve 4 SSS
~5 KB). Sunucu gzip aciksa (kok.htaccess `mod_deflate`) aktarim boyutu cok daha kucuktur. test_adim2 boyut
butcesi (<260 KB masaustu, <230 KB mobil) etkilenmez.

## 3. Dogrulama ciktilari

### 3.1 `python3 kaynak/testler/test_seo.py` (repo, bugunku hal: baglama yamasi henuz uygulanmadi)
```
— A. API imzalari, saflik, sabitler
— B. seo-strings.json: anahtarlar, yer tutucular, uzunluk, dil kurallari
   fr: title+description anahtar kelime kapsami 2/5 -> 5/5
   nl: title+description anahtar kelime kapsami 1/5 -> 4/5
   en: title+description anahtar kelime kapsami 2/5 -> 5/5
   tr: title+description anahtar kelime kapsami 3/4 -> 4/4
— C. JSON-LD (@graph + FAQPage)
— D. statik_doldur: build.py bicimi ile uyum, KESIN tablodan hesap
— E. head_ek: geo meta, gorsel boyutu, tekrar yok
— F. llms.txt / llms-full.txt
— G. robots.txt
— H. security.txt (RFC 9116)
— I. manifest.webmanifest + PNG ikonlar
— J. sitemap.xml (test_adim4 kosullari + image)
— K. zone_data (gorunur 'Hizmet bolgeleri' verisi)
— L. yasak icerik: yonetici adi, em dash, dogrulanamaz iddialar
— M. dagitim: kok.htaccess ve template uyumu (uyari)

   ! UYARI: kok.htaccess '/llms.txt' adresini /fr/'ye 301 ile yonlendirir: RewriteCond istisnasi ekleyin (SEO-NOTLARI.md)
   ! UYARI: kok.htaccess '/llms-full.txt' adresini /fr/'ye 301 ile yonlendirir: RewriteCond istisnasi ekleyin (SEO-NOTLARI.md)
   ! UYARI: kok.htaccess '/manifest.webmanifest' adresini /fr/'ye 301 ile yonlendirir: RewriteCond istisnasi ekleyin (SEO-NOTLARI.md)
   ! UYARI: kok.htaccess '/.well-known/security.txt' adresini /fr/'ye 301 ile yonlendirir: RewriteCond istisnasi ekleyin (SEO-NOTLARI.md)
   ! UYARI: kok.htaccess .webmanifest MIME tipi (application/manifest+json) tanimlamiyor (SEO-NOTLARI.md)
   ! UYARI: template.html faq7..faq10 ve 'Hizmet bolgeleri' bolumunu henuz icermiyor (SEO-NOTLARI.md, TEMPLATE onerisi)
   ! UYARI: build.py henuz seo.py'yi cagirmiyor (SEO-NOTLARI.md, BUILD.PY ENTEGRASYON YAMASI)
✓ Tum kontroller gecti (4917 kontrol)
```
Uyarilar beklenendir: yama uygulanana kadar kok.htaccess, template.html ve build.py henuz baglanmamistir.

### 3.2 Test paketinin gercekten hata yakaladigi (mutasyon denemesi)
Gecici kopyada bilerek bozuldu, her seferinde test kirmizi oldu: `sameAs` eklenmesi (8 hata), tum fiyatlara +1
(32 hata), adli robots grubundan `/pay/` kaldirilmasi (8 hata), em dash eklenmesi (2 hata), ikon `sizes`
uyusmazligi (2 hata), koordinatin Belcika disina cikmasi (5 hata), `og:title` tekrari head_ek'te (8 hata),
NL'de "aanbetaling" (3 hata).

### 3.3 Entegrasyon provasi (gecici dizinde kaynak/ kopyasi + asagidaki yama)
`build.py` calistirildi, ardindan:
```
test_adim1.py  ✓ Tum kontroller gecti (2343 kontrol)
test_adim2.py  ✓ Tum kontroller gecti (390 kontrol)   # 5.4'teki uyarlama ile
test_adim3.py  ✓ Tum kontroller gecti (61 kontrol)
test_adim4.py  ✓ Tum kontroller gecti (69 kontrol)    # DEGISTIRILMEDEN gecti
test_seo.py    ✓ Tum kontroller gecti (4917 kontrol), 0 uyari
```
- `test_adim4.py` (robots, sitemap, .htaccess) hicbir degisiklik gerekmeden gecti.
- `test_adim2.py` YAMASIZ KIRILIR: JSON-LD artik `@graph` oldugundan (ust duzeyde `@type` yok), FAQPage 10 soru
  oldugundan ve `potentialAction.target` liste oldugundan. 5.4'teki uyarlama bu uc noktayi karsilar ve ayrica
  JSON-LD sorularinin/cevaplarinin JSON-LD DISINDA sayfada gorunur oldugunu dogrular (eski kontrol JSON-LD'nin
  kendi metnini de tarayip her zaman gecerdi).
- Tarayici paketi (`tarayici-test.js`, Chromium) yamali ve yamasiz ayni sonucu verdi: sandbox proxy'sinin Google
  Fonts icin urettigi 7 `ERR_CERT_AUTHORITY_INVALID` konsol hatasi (ortam kaynakli, yamayla ilgisiz); baska hata yok.
- Mobil (390 px) ve masaustu (1280 px) ekran goruntusunde yeni bolumde yatay tasma yok.

## 4. Gorunur bolumler icin ornek HTML

`seo.zone_data(dil, ctx)` veriyi verir (`havalimanlari`, `sehirler`, `sinir_otesi`; her oge: `ad`, `km`, `fiyat`,
`fiyat_metin`, `alis_anahtar`, `varis_anahtar`, `ulke`, `ulke_ad`, havalimaninda `iata`). HTML'i build/template
katmani uretir; 5.1'deki yama mevcut `.chip` bicimini yeniden kullanir, boylece chip'e tiklayinca form dolar
(JS zaten `data-alis`/`data-varis` okur). Uretilen cikti (FR, her blokta ilk 2 chip):
```html
<section class="bolum" id="zones" style="padding-top:20px">
  <div class="dar">
    <div class="bolum-baslik">
      <h2>Zones desservies : Belgique et pays voisins</h2>
      <p class="bolum-alt">Prix indicatifs au départ du centre de Bruxelles, calculés avec notre formule (10 € + 1,99 € par km). Le prix exact de votre trajet s'affiche à la réservation.</p>
    </div>
    <h3 class="bolge-baslik">Transferts aéroport</h3>
<div class="chipler"><a class="chip" href="#rezervasyon" data-alis="brussels" data-varis="bru"><span>Brussels Airport (Zaventem)</span><span class="ok">13 km</span><b>dès 35,87 €</b></a>
<a class="chip" href="#rezervasyon" data-alis="brussels" data-varis="crl"><span>Aéroport de Charleroi (CRL)</span><span class="ok">55 km</span><b>dès 119,45 €</b></a>
      <h3 class="bolge-baslik">Villes en Belgique</h3>
<div class="chipler"><a class="chip" href="#rezervasyon" data-alis="brussels" data-varis="leuven"><span>Louvain</span><span class="ok">27 km</span><b>dès 63,73 €</b></a>
<a class="chip" href="#rezervasyon" data-alis="brussels" data-varis="mechelen"><span>Malines</span><span class="ok">27 km</span><b>dès 63,73 €</b></a>
      <h3 class="bolge-baslik">Trajets transfrontaliers</h3>
<div class="chipler"><a class="chip" href="#rezervasyon" data-alis="brussels" data-varis="breda"><span>Breda</span><span class="ok">102 km</span><b>dès 212,98 €</b></a>
<a class="chip" href="#rezervasyon" data-alis="brussels" data-varis="maastricht"><span>Maastricht</span><span class="ok">115 km</span><b>dès 238,85 €</b></a>
  </div>
</section>
```
Isteğe bagli (yalniz basliklara bosluk): `.bolge-baslik{font-size:18px;font-weight:800;margin:32px 0 14px}`
`#zones .bolge-baslik:first-of-type{margin-top:0}`. NOT: `.chip{white-space:nowrap}` EKLEMEYIN, uzun havalimani
adlari 390 px'te tasar.

SSS 7..10 (template):
```html
<details><summary>{{faq7_q}}</summary><p class="cevap">{{faq7_a}}</p></details>
... faq8, faq9, faq10 ayni kalip
```

## 5. BUILD.PY ENTEGRASYON YAMASI

Bu yama gecici kopyada uygulanip test edildi (3.3). `build.py` bu calismada DEGISTIRILMEDI. Uygulamak icin
asagidaki bloklari (5.1 ... 5.4) tek bir dosyaya (`seo-entegrasyon.patch`) yapistirip depo kokunde
`git apply --check seo-entegrasyon.patch && git apply seo-entegrasyon.patch` calistirin. Baska ekipler
`build.py`/`template.html`'i degistirdiyse `patch -p1 --dry-run` ile once deneyin; yama mantigi 6 bagimsiz duzenlemedir
(seo modulunu ve seo-strings'i yukle, `statik_doldur`'u devret, JSON-LD'yi cagriya cevir, head eki, bolge HTML'i,
sitemap/robots/yeni dosyalar).

Yamanin ozeti:
1. `import seo` ve `seo-strings.json`'u `strings[dil]` uzerine birlestirme (anahtar denetiminden ONCE).
2. `statik_doldur` -> `seo.statik_doldur` (ek yer tutucular `{km_*}`/`{price_*}`; bilinmeyenleri dokunmaz).
3. `SEO_CTX` (KESIN_SOZLUK'ten sonra).
4. Iki JSON-LD blogu `seo.jsonld_graph` / `seo.jsonld_faq` (10 SSS).
5. `<head>` eki `</head>` oncesine string ile eklenir (template'e placeholder gerekmez).
6. Gorunur bolge HTML'i (`{{BOLGELER}}`) ve sitemap/robots/llms/manifest/security.txt yazimi.

### 5.1 kaynak/build.py
```diff
--- a/kaynak/build.py
+++ b/kaynak/build.py
@@ -39,6 +39,14 @@
 YERLER = veri["yerler"]
 ALAN = isletme["alan_adi"].rstrip("/")
 
+# ---------------------------------------------------------------- SEO/GEO katmani (kaynak/seo.py)
+# seo-strings.json, strings[dil] uzerine BIRLESTIRILIR (ayni anahtar varsa seo-strings kazanir).
+sys.path.insert(0, str(KAYNAK))
+import seo  # noqa: E402
+_seo_strings = json.loads((KAYNAK / "seo-strings.json").read_text(encoding="utf-8"))
+for _d in DILLER:
+    strings[_d].update(_seo_strings[_d])
+
 # ---------------------------------------------------------------- anahtar denetimi
 referans = set(strings["fr"].keys())
 for dil in DILLER:
@@ -137,24 +145,18 @@
 # {rest}, {price}, {ref}, {name}, {from}, {to}, {date}, {time}, {pax}, {big},
 # {small}, {vehicle}, {phone -> sadece em_outro/wa}) JS/PHP'ye birakilir.
 def statik_doldur(dil, metin):
-    degerler = {
-        "base": para_goster(dil, SABIT["acilis_ucreti"]),
-        "perkm": para_goster(dil, SABIT["km_ucreti"]),
-        "pct": str(SABIT["kapora_yuzde"]),
-        "company": isletme["unvan"],
-        "vat": isletme["kdv"],
-        "email": isletme["eposta"],
-        "year": YIL,
-    }
-    for k, v in degerler.items():
-        metin = metin.replace("{" + k + "}", v)
-    return metin
+    # seo.statik_doldur: {base} {perkm} {pct} {company} {vat} {email} {year} + {km_*}/{price_*}
+    return seo.statik_doldur(dil, metin, SEO_CTX)
 
 
 KESIN_SOZLUK = {}
 for a, b, km in veri["kesin"]:
     KESIN_SOZLUK[f"{a}|{b}"] = km
 
+BUGUN = datetime.date.today().isoformat()
+SEO_CTX = dict(strings=strings, veri=veri, isletme=isletme, alan=ALAN, diller=DILLER,
+               bugun=BUGUN, fiyat=fiyat_hesapla, kesin=KESIN_SOZLUK)
+
 # ---------------------------------------------------------------- www hazirla
 for parca in ["fr", "nl", "en", "tr", "assets"]:
     hedef = WWW / parca
@@ -214,67 +216,10 @@
     og_alt = [f'<meta property="og:locale:alternate" content="{strings[d2]["dil_og_locale"]}">'
               for d2 in DILLER if d2 != dil]
 
-    # JSON-LD 1: TaxiService + LocalBusiness (tek @id)
-    jsonld_isletme = {
-        "@context": "https://schema.org",
-        "@type": ["TaxiService", "LocalBusiness"],
-        "@id": ALAN + "/#isletme",
-        "name": isletme["marka"],
-        "legalName": isletme["unvan"],
-        "vatID": isletme["kdv"],
-        "slogan": isletme["slogan"],
-        "url": canonical,
-        "telephone": isletme["telefon"],
-        "email": isletme["eposta"],
-        "image": ALAN + "/assets/og.jpg",
-        "logo": ALAN + "/assets/logo.svg",
-        "priceRange": "€€",
-        "address": {
-            "@type": "PostalAddress",
-            "streetAddress": "Excelsiorlaan 31",
-            "postalCode": "1930",
-            "addressLocality": "Zaventem",
-            "addressCountry": "BE",
-        },
-        "geo": {"@type": "GeoCoordinates", "latitude": 50.8845, "longitude": 4.4715},
-        "openingHoursSpecification": {
-            "@type": "OpeningHoursSpecification",
-            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
-            "opens": "00:00",
-            "closes": "23:59",
-        },
-        "areaServed": [{"@type": "Country", "name": u} for u in ["BE", "DE", "FR", "LU", "NL"]],
-        "makesOffer": [{
-            "@type": "Offer",
-            "name": s["mode_km"],
-            "priceCurrency": "EUR",
-            "priceSpecification": {
-                "@type": "UnitPriceSpecification",
-                "price": SABIT["km_ucreti"],
-                "priceCurrency": "EUR",
-                "unitCode": "KMT",
-            },
-        }, {
-            "@type": "Offer",
-            "name": s["mode_airport"],
-            "priceCurrency": "EUR",
-        }],
-        "potentialAction": {
-            "@type": "ReserveAction",
-            "target": {"@type": "EntryPoint", "urlTemplate": isletme["whatsapp"]},
-        },
-    }
-
-    # JSON-LD 2: sayfada GORUNEN 6 SSS
-    jsonld_faq = {
-        "@context": "https://schema.org",
-        "@type": "FAQPage",
-        "mainEntity": [{
-            "@type": "Question",
-            "name": s[f"faq{i}_q"],
-            "acceptedAnswer": {"@type": "Answer", "text": s[f"faq{i}_a"]},
-        } for i in range(1, 7)],
-    }
+    # JSON-LD 1: tek @graph (Organization + WebSite + TaxiService/LocalBusiness + WebPage)
+    # JSON-LD 2: sayfada GORUNEN 10 SSS (faq1..faq10)
+    jsonld_isletme = seo.jsonld_graph(dil, SEO_CTX)
+    jsonld_faq = seo.jsonld_faq(dil, SEO_CTX, [(s[f"faq{i}_q"], s[f"faq{i}_a"]) for i in range(1, 11)])
 
     # h1: virgulden sonrasi altin vurgu
     baslik = esc(s["hero_title"])
@@ -343,6 +288,21 @@
     def paragraflar(metin):
         return "".join(f"<p>{esc(p)}</p>" for p in metin.split("\n\n"))
 
+    def bolgeler_html():
+        """Gorunur 'Hizmet bolgeleri' bolumu: seo.zone_data -> mevcut .chip bicimi."""
+        z = seo.zone_data(dil, SEO_CTX)
+        def chip(o):
+            fiyat_etiketi = s["zones_from"].replace("{price}", o["fiyat_metin"])
+            return (f'<a class="chip" href="#rezervasyon" data-alis="{o["alis_anahtar"]}" '
+                    f'data-varis="{o["varis_anahtar"]}"><span>{esc(o["ad"])}</span>'
+                    f'<span class="ok">{o["km"]} km</span><b>{esc(fiyat_etiketi)}</b></a>')
+        bloklar = []
+        for baslik, anahtar in (("zones_airports_t", "havalimanlari"), ("zones_cities_t", "sehirler"),
+                                ("zones_border_t", "sinir_otesi")):
+            bloklar.append(f'<h3 class="bolge-baslik">{esc(s[baslik])}</h3>\n'
+                           f'<div class="chipler">' + "\n".join(chip(o) for o in z[anahtar]) + '</div>')
+        return "\n      ".join(bloklar)
+
     # ---- yer tutuculari doldur ----
     sayfa = sablon
     ozel = {
@@ -354,6 +314,7 @@
         "HERO_BASLIK": hero_baslik,
         "DATALIST": datalist,
         "ROTA_CHIPS": "\n      ".join(chipler),
+        "BOLGELER": bolgeler_html(),
         "KAP_ECO": kapasite("eco"),
         "KAP_WAGON": kapasite("wagon"),
         "KAP_VIP": kapasite("vip"),
@@ -386,6 +347,9 @@
     if kalan:
         hata(f"[{dil}] cozulmemis yer tutucular: {sorted(set(kalan))}")
 
+    # SEO/GEO <head> eki (geo meta, og:image boyutu/alt, manifest, apple-touch-icon, robots yonergeleri)
+    sayfa = sayfa.replace("</head>", seo.head_ek(dil, SEO_CTX) + "</head>", 1)
+
     hedef = WWW / dil
     hedef.mkdir(parents=True, exist_ok=True)
     (hedef / "index.html").write_text(sayfa, encoding="utf-8")
@@ -450,32 +414,15 @@
 # Kok .htaccess kaynaktan kopyalanir (sartname §11)
 shutil.copyfile(KAYNAK / "kok.htaccess", WWW / ".htaccess")
 
-# sitemap.xml: her URL icin TAM xhtml:link kumesi (kendisi dahil 4 dil + x-default).
-# Eksik kume tum grubu gecersiz kilar (sartname §11).
-bugun = datetime.date.today().isoformat()
-alternatifler = "\n".join(
-    f'    <xhtml:link rel="alternate" hreflang="{strings[d]["dil_hreflang"]}" href="{ALAN}{strings[d]["dil_yol"]}"/>'
-    for d in DILLER
-) + f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{ALAN}/fr/"/>'
-sitemap_girdileri = "\n".join(
-    f"""  <url>
-    <loc>{ALAN}{strings[d]["dil_yol"]}</loc>
-{alternatifler}
-    <lastmod>{bugun}</lastmod>
-  </url>"""
-    for d in DILLER
-)
-sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
-<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
-        xmlns:xhtml="http://www.w3.org/1999/xhtml">
-{sitemap_girdileri}
-</urlset>
-"""
-(WWW / "sitemap.xml").write_text(sitemap, encoding="utf-8")
-
-# robots.txt: /pay/ tarama disi + sitemap referansi
-(WWW / "robots.txt").write_text(
-    f"User-agent: *\nDisallow: /pay/\n\nSitemap: {ALAN}/sitemap.xml\n", encoding="utf-8")
+# sitemap.xml (4 URL x tam 5'li xhtml:link + lastmod + image:image), robots.txt, llms*.txt,
+# manifest, security.txt: hepsi kaynak/seo.py'den (sartname §11: eksik hreflang kumesi grubu gecersiz kilar).
+(WWW / "sitemap.xml").write_text(seo.sitemap_xml(SEO_CTX), encoding="utf-8")
+(WWW / "robots.txt").write_text(seo.robots_txt(SEO_CTX), encoding="utf-8")
+(WWW / "llms.txt").write_text(seo.llms_txt(SEO_CTX), encoding="utf-8")
+(WWW / "llms-full.txt").write_text(seo.llms_full_txt(SEO_CTX), encoding="utf-8")
+(WWW / "manifest.webmanifest").write_text(seo.manifest_json(SEO_CTX), encoding="utf-8")
+(WWW / ".well-known").mkdir(exist_ok=True)
+(WWW / ".well-known" / "security.txt").write_text(seo.security_txt(SEO_CTX), encoding="utf-8")
 
 # ---------------------------------------------------------------- rapor
 print("✓ Derleme tamam:")
```

### 5.2 kaynak/kok.htaccess (yonlendirme istisnalari + MIME)
```diff
--- a/kaynak/kok.htaccess
+++ b/kaynak/kok.htaccess
@@ -26,7 +26,8 @@
 RewriteCond %{REQUEST_URI} !^/(fr|nl|en|tr)(/|$)
 RewriteCond %{REQUEST_URI} !^/(assets|pay)/
 RewriteCond %{REQUEST_URI} !^/(index\.html)?$
-RewriteCond %{REQUEST_URI} !^/(robots\.txt|sitemap\.xml|favicon\.ico)$
+RewriteCond %{REQUEST_URI} !^/(robots\.txt|sitemap\.xml|favicon\.ico|llms\.txt|llms-full\.txt|manifest\.webmanifest)$
+RewriteCond %{REQUEST_URI} !^/\.well-known/
 RewriteRule ^ /fr/ [R=301,L]
 </IfModule>
 
@@ -63,6 +64,11 @@
 Header always set X-Content-Type-Options "nosniff"
 </IfModule>
 
+# ---- .webmanifest dogru MIME tipiyle servis edilsin (SEO/PWA katmani)
+<IfModule mod_mime.c>
+AddType application/manifest+json .webmanifest
+</IfModule>
+
 # ---- gzip sikistirma
 <IfModule mod_deflate.c>
 AddOutputFilterByType DEFLATE text/html text/css text/plain application/javascript application/json image/svg+xml application/xml
```

### 5.3 kaynak/template.html (gorunur bolge + SSS 7..10; baska ekibin dosyasi, ONERI)
```diff
--- a/kaynak/template.html
+++ b/kaynak/template.html
@@ -756,6 +756,17 @@
   </div>
 </section>
 
+<!-- ============================ HIZMET BOLGELERI ============================ -->
+<section class="bolum" id="zones" style="padding-top:20px">
+  <div class="dar">
+    <div class="bolum-baslik">
+      <h2>{{zones_title}}</h2>
+      <p class="bolum-alt">{{zones_sub}}</p>
+    </div>
+    {{BOLGELER}}
+  </div>
+</section>
+
 <!-- ============================ SSS ============================ -->
 <section class="bolum" id="faq">
   <div class="dar">
@@ -767,6 +778,10 @@
       <details><summary>{{faq4_q}}</summary><p class="cevap">{{faq4_a}}</p></details>
       <details><summary>{{faq5_q}}</summary><p class="cevap">{{faq5_a}}</p></details>
       <details><summary>{{faq6_q}}</summary><p class="cevap">{{faq6_a}}</p></details>
+      <details><summary>{{faq7_q}}</summary><p class="cevap">{{faq7_a}}</p></details>
+      <details><summary>{{faq8_q}}</summary><p class="cevap">{{faq8_a}}</p></details>
+      <details><summary>{{faq9_q}}</summary><p class="cevap">{{faq9_a}}</p></details>
+      <details><summary>{{faq10_q}}</summary><p class="cevap">{{faq10_a}}</p></details>
     </div>
   </div>
 </section>
```

### 5.4 kaynak/testler/test_adim2.py (graph, 10 SSS ve liste hedefe uyarlama)
```diff
--- a/kaynak/testler/test_adim2.py
+++ b/kaynak/testler/test_adim2.py
@@ -32,6 +32,10 @@
         hatalar.append(mesaj)
 
 
+def esc_html(s):
+    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
+
+
 sayfalar = {}
 for dil in DILLER:
     yol = WWW / dil / "index.html"
@@ -85,11 +89,18 @@
             kontrol(False, f"[{dil}] JSON-LD parse hatasi: {e}")
             continue
         if j.get("@type") == "FAQPage":
-            kontrol(len(j["mainEntity"]) == 6, f"[{dil}] FAQPage 6 soru icermeli")
-            # JSON-LD'deki sorular sayfada GORUNEN sorularla ayni olmali
+            kontrol(len(j["mainEntity"]) == 10, f"[{dil}] FAQPage 10 soru icermeli")
+            # JSON-LD'deki sorular ve cevaplar sayfada GORUNEN metinle ayni olmali
+            # (JSON-LD bloklari cikarildiktan sonraki govdede aranir)
+            gorunur = re.sub(r'<script type="application/ld\+json">.*?</script>', "", h, flags=re.S)
             for soru in j["mainEntity"]:
-                kontrol(soru["name"] in h, f"[{dil}] JSON-LD sorusu sayfada gorunmuyor: {soru['name'][:40]}")
+                kontrol(esc_html(soru["name"]) in gorunur, f"[{dil}] JSON-LD sorusu sayfada gorunmuyor: {soru['name'][:40]}")
+                kontrol(esc_html(soru["acceptedAnswer"]["text"]) in gorunur,
+                        f"[{dil}] JSON-LD cevabi sayfada gorunmuyor: {soru['name'][:40]}")
         else:
+            # @graph: Organization + WebSite + TaxiService/LocalBusiness + WebPage (tek blok)
+            dugumler = j["@graph"] if "@graph" in j else [j]
+            j = next((n for n in dugumler if n.get("@id") == ALAN + "/#isletme"), {})
             kontrol(j.get("@id") == ALAN + "/#isletme", f"[{dil}] isletme @id tek ve sabit olmali")
             kontrol("TaxiService" in j["@type"] and "LocalBusiness" in j["@type"],
                     f"[{dil}] @type TaxiService+LocalBusiness olmali")
@@ -98,8 +109,10 @@
             kontrol("geo" in j and "openingHoursSpecification" in j and "areaServed" in j
                     and "makesOffer" in j and "potentialAction" in j,
                     f"[{dil}] JSON-LD zorunlu alanlar eksik")
-            kontrol(j["potentialAction"]["target"]["urlTemplate"] == isletme["whatsapp"],
-                    f"[{dil}] potentialAction WhatsApp olmali")
+            hedefler = j["potentialAction"]["target"]
+            hedefler = hedefler if isinstance(hedefler, list) else [hedefler]
+            kontrol(isletme["whatsapp"] in [x["urlTemplate"] for x in hedefler],
+                    f"[{dil}] potentialAction WhatsApp icermeli")
 
 # ============================================================ D. SEO
 print("— D. SEO etiketleri")
```

## 6. Musterinin sonradan yapacaklari (kodla uydurulamaz)

1. **Google Business Profile (GBP)** ac ve dogrula (posta karti veya telefon dogrulamasi). Tasit merkezli/hizmet
   bolgeli isletme secenegi ve adres gizleme secenegi degerlendirilmeli. Kategori: "Taksi servisi", ek kategori:
   "Havalimani transfer servisi". Alan adi: `https://europetaxi24.be/fr/` (veya secilen dil sayfasi).
2. **NAP tutarliligi** (Name, Address, Phone): her yerde AYNI yazim. Ad: "Europa Taxi" (ticari), hukuki unvan
   "CAN COMPANY" fatura/yasal metinlerde; adres: `Excelsiorlaan 31, 1930 Zaventem, Belgium`; telefon:
   `+32 493 83 98 98`. GBP, Bing Places, Apple Business Connect, rehberler ve sosyal profiller bu uc bilgiyi birebir
   kullanmali (site JSON-LD'si isletme.json'dan okur).
3. **Bing Places** (Bing ve Copilot/ChatGPT arama sonuclari icin) ve **Apple Business Connect** kaydi.
4. **Gercek koordinat**: 2.4'teki adimla `seo.KOORDINAT` degistirilir.
5. **Yorum toplama**: gercek musterilerden GBP uzerinden. Yorumlar toplanana kadar sitede puan/yildiz gosterilmez
   ve `aggregateRating` EKLENMEZ (Google, isletmenin kendi sitesindeki kendi yorumlari icin bu isaretlemeyi
   desteklemez; sahte veya kendi kendine yazilmis yorum ceza nedenidir). GBP yorumlari yeterli olur.
6. **Google Search Console** ve **Bing Webmaster Tools**: alan adini dogrula, `https://europetaxi24.be/sitemap.xml`
   gonder, `/fr/ /nl/ /en/ /tr/` sayfalarinin indekslendigini ve hreflang hatasi olmadigini kontrol et.
7. **Sosyal medya**: gercek profiller acilirsa `sameAs` ANCAK o zaman (ve gercek adreslerle) eklenir; bugun yok.
8. **Iletisim dilleri beyani**: JSON-LD `availableLanguage`/`knowsLanguage` (fr, nl, en, tr) ve security.txt
   `Preferred-Languages` gercekte bu dillerde yanit verilebiliyorsa dogrudur; degilse `seo.ILETISIM_DILLERI` daraltilir.
9. **robots.txt egitim botu karari** (2.5): izinli mi kalsin, engellensin mi; karar musterinindir.
10. **Yillik derleme**: `security.txt Expires` icin en az yilda bir `build.py` calistirilmali (ve dosyalar yuklenmeli).
11. **Yerel icerik** (uzun vadede en cok isleyen): "taxi Gent", "taxi Charleroi" gibi arama niyetleri icin gercek
    hizmet verilen sehir sayfalari, gercek fotograf, gercek musteri sorulari. Bu calisma yalniz mevcut tek sayfayi
    ve altyapiyi hazirlar.

## 7. Bilinen sinirlar
- `geo.position`/`ICBM`/`geo.region` Google icin sinyal degildir; koordinat yaklasiktir (2.4).
- JSON-LD ornek fiyatlari KESIN tablodaki Bruksel merkezli mesafelerden turetilen tahminlerdir; baska baslangic
  adresinde fiyat farkli olur (metinlerde "tahmini/kilometre tarifesi" diye belirtildi). Havalimani sabit fiyatlari
  (WhatsApp ile) formulden farkli olabilir ve bilerek fiyatsiz birakildi.
- FAQ zengin sonuclari Google'da artik cogu site icin gosterilmez; FAQPage isaretlemesi gorunur metinle birebir
  ayni oldugu icin zarari yoktur ve yapay zeka motorlarinin alintilamasina yardimci olur.
- `llms.txt` Ingilizce; 4 dilli tam metin `llms-full.txt`'tedir.
- `WebSite.url` kok (`/`) adresidir; kok sayfa `noindex` JS yonlendirmesidir. Dil sayfalari indekslenir.
- `lastmod` her derlemede bugunun tarihidir (2.9).
- Icon uretimi bir kerelik (Playwright); ikon degisirse yeniden uretilmelidir (`kaynak/assets/icons/`).
