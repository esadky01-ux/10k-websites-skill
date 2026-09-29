# -*- coding: utf-8 -*-
"""
ADIM 2 TESTLERI — template.html + build.py ciktisi (www/)
Calistirma: python3 kaynak/testler/test_adim2.py
Gereksinim: once `python3 kaynak/build.py` calistirilmis olmali; node kurulu olmali.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent.parent   # depo koku
WWW = KOK / "www"
KAYNAK = KOK / "kaynak"
DILLER = ["fr", "nl", "en", "tr"]

veri = json.loads((KAYNAK / "mesafe-verisi.json").read_text(encoding="utf-8"))
isletme = json.loads((KAYNAK / "isletme.json").read_text(encoding="utf-8"))
ALAN = isletme["alan_adi"].rstrip("/")

hatalar = []
gecen = 0


def kontrol(kosul, mesaj):
    global gecen
    if kosul:
        gecen += 1
    else:
        hatalar.append(mesaj)


# YAPI: CSS/JS artik harici dosyada (assets/site.css, assets/app.js). Metin aramalari
# sayfa + bu dosyalar birlikte taranir; testler gevsetilmez, yalniz yapisal degisime uyar.
def oku_varlik(ad):
    yol = WWW / "assets" / ad
    kontrol(yol.exists(), f"www/assets/{ad} yok — once build.py calistirin")
    return yol.read_text(encoding="utf-8") if yol.exists() else ""


CSS = oku_varlik("site.css")
APP_JS = oku_varlik("app.js")
CONFIG_JS = oku_varlik("config.js")
KOK_JS = oku_varlik("kok.js")

def esc_html(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


sayfalar = {}
for dil in DILLER:
    yol = WWW / dil / "index.html"
    kontrol(yol.exists(), f"www/{dil}/index.html yok — once build.py calistirin")
    if yol.exists():
        sayfalar[dil] = yol.read_text(encoding="utf-8")

# ============================================================ A. yer tutucu + yasak icerik
print("— A. yer tutucular ve yasak icerik")
for dil, h in sayfalar.items():
    kalan = re.findall(r"\{\{[A-Za-z_]+\}\}", h)
    kontrol(not kalan, f"[{dil}] cozulmemis yer tutucu: {sorted(set(kalan))}")
    kontrol("necatican" not in h.lower() and "ceylan" not in h.lower(),
            f"[{dil}] yonetici adi sayfada gecmemeli")
for ad, metin in [("site.css", CSS), ("app.js", APP_JS), ("kok.js", KOK_JS)]:
    kontrol("necatican" not in metin.lower() and "ceylan" not in metin.lower(),
            f"{ad}: yonetici adi gecmemeli")

# ============================================================ B. JS gecerliligi (node --check) + SATIR ICI JS YASAK
print("— B. JS soz dizimi (node --check) ve satir ici betik yasagi")
BETIK = re.compile(r"<script([^>]*)>(.*?)</script>", re.S)
for ad in ["app.js", "config.js", "kok.js"]:
    yol = WWW / "assets" / ad
    if yol.exists():
        p = subprocess.run(["node", "--check", str(yol)], capture_output=True, text=True)
        kontrol(p.returncode == 0, f"assets/{ad} node --check hatasi: {p.stderr[:300]}")

def satir_ici_calistirilabilir(html):
    """src'siz ve ld+json / application/json olmayan <script> govdeleri (CSP: script-src 'self' bunu engeller)."""
    bulunan = []
    for nitelik, govde in BETIK.findall(html):
        if "src=" in nitelik:
            continue
        if "application/ld+json" in nitelik or "application/json" in nitelik:
            continue
        bulunan.append((nitelik, govde[:60]))
    return bulunan

kok_html = (WWW / "index.html").read_text(encoding="utf-8")
for dil, h in sayfalar.items():
    kontrol(not satir_ici_calistirilabilir(h), f"[{dil}] satir ici calistirilabilir JS var: {satir_ici_calistirilabilir(h)}")
    kontrol(not re.search(r"<script[^>]*>\s*[^<\s]", " ".join(
        m for m in re.findall(r"<script(?![^>]*(?:src=|ld\+json|application/json))[^>]*>(.*?)</script>", h, re.S))),
        f"[{dil}] satir ici betik govdesi olmamali")
    kontrol(not re.search(r"\son(click|load|error|input|change|submit)\s*=", h, re.I),
            f"[{dil}] satir ici olay isleyicisi (onclick vb.) olmamali")
kontrol(not satir_ici_calistirilabilir(kok_html), "kok sayfada satir ici calistirilabilir JS olmamali")

# ============================================================ B2. yeni yapi sozlesmesi (harici CSS/JS, veri blogu, yazi tipi)
print("— B2. harici CSS/JS, #et-data blogu, yerel yazi tipi")
for dil, h in sayfalar.items():
    kontrol(re.search(r'<link rel="stylesheet" href="/assets/site\.css(\?v=[0-9a-f]+)?">', h) is not None, f"[{dil}] site.css baglantisi eksik")
    kontrol("<style" not in h.lower(), f"[{dil}] satir ici <style> blogu olmamali")
    kontrol(h.count(' style="') <= 2, f"[{dil}] satir ici style nitelikleri minimumda olmali: {h.count(' style=')}")
    ic = h.find('src="/assets/config.js'), h.find('src="/assets/app.js')
    kontrol(ic[0] != -1 and ic[1] != -1 and ic[0] < ic[1], f"[{dil}] config.js app.js'den ONCE yuklenmeli")
    kontrol(re.search(r'<script src="/assets/config.js" defer></script>', h) is not None, f"[{dil}] config.js defer olmali")
    kontrol(re.search(r'<script src="/assets/app\.js(\?v=[0-9a-f]+)?" defer></script>', h) is not None, f"[{dil}] app.js defer olmali")
    veri_blok = re.findall(r'<script type="application/json" id="et-data">(.*?)</script>', h, re.S)
    kontrol(len(veri_blok) == 1, f"[{dil}] tam 1 #et-data blogu olmali")
    if veri_blok:
        try:
            d = json.loads(veri_blok[0].replace("<\\/", "</"))
            kontrol(set(d.keys()) == {"dil", "wa", "veri", "soz"}, f"[{dil}] et-data anahtarlari yanlis: {sorted(d)}")
            kontrol(d["dil"] == dil, f"[{dil}] et-data dil yanlis")
            kontrol("yerler" in d["veri"] and "kesin" in d["veri"], f"[{dil}] et-data veri yapisi yanlis")
            kontrol(len(d["veri"]["yerler"]) >= 65 and len(d["veri"]["kesin"]) >= 45, f"[{dil}] et-data eksik veri")
        except json.JSONDecodeError as e:
            kontrol(False, f"[{dil}] et-data JSON hatasi: {e}")
    # yazi tipi: yalniz yerel; Google fontlarina HICBIR baglanti
    kontrol("fonts.googleapis.com" not in h and "fonts.gstatic.com" not in h, f"[{dil}] Google Fonts baglantisi olmamali")
    kontrol('rel="preload" as="font" type="font/woff2" href="/assets/fonts/archivo-latin.woff2" crossorigin' in h,
            f"[{dil}] latin yazi tipi onyuklenmeli")
kontrol("fonts.googleapis.com" not in CSS and "fonts.gstatic.com" not in CSS, "site.css Google Fonts'a baglanmamali")
kontrol(CSS.lstrip().startswith("/*") and "@font-face" in CSS[:1500] and "archivo-latin.woff2" in CSS[:1500],
        "site.css basinda Archivo @font-face bloklari olmali")
kontrol("archivo-latin-ext.woff2" in CSS, "latin-ext @font-face eksik")
kontrol((WWW / "assets" / "fonts" / "archivo-latin.woff2").exists(), "www/assets/fonts/archivo-latin.woff2 yok")
# sablon: tek {{HEAD_EK}}, head'in sonunda
sablon = (KAYNAK / "template.html").read_text(encoding="utf-8")
kontrol(sablon.count("{{HEAD_EK}}") == 1, "template.html tam 1 {{HEAD_EK}} icermeli")
kontrol(re.search(r"\{\{HEAD_EK\}\}\s*</head>", sablon) is not None, "{{HEAD_EK}} <head>'in SONUNDA olmali")
for yer_tutucu in ["{{CANONICAL}}", "{{HREFLANG_BLOKU}}", "{{OG_LOCALE_ALT_BLOKU}}", "{{JSONLD_ISLETME}}", "{{JSONLD_FAQ}}",
                   "{{meta_title}}", "{{meta_desc}}", "{{og_title}}", "{{og_desc}}"]:
    kontrol(yer_tutucu in sablon, f"template.html {yer_tutucu} yer tutucusu kalmali")
# Mevcut kimlikler/nitelikler (tarayici testi + mantik buna dayanir)
KIMLIKLER = ["f-alis", "f-varis", "btn-swap", "mod-km", "mod-hava", "fiyat-panel", "hava-panel", "btn-hava-wa",
             "p-fiyat", "p-kapora", "p-kalan", "p-mesafe", "p-sure", "p-durum", "f-tarih", "f-saat", "f-donus",
             "donus-alani", "f-donus-tarih", "f-donus-saat", "s-yolcu", "s-buyuk", "s-kucuk", "f-ad", "f-eposta",
             "f-telefon", "f-iptal", "hata-kutu", "btn-onayla", "odeme-final", "btn-online", "btn-wa",
             "rezervasyon", "yer-listesi"]
for dil, h in sayfalar.items():
    for k in KIMLIKLER:
        kontrol(f'id="{k}"' in h, f"[{dil}] #{k} kimligi eksik")
    for kalip, ad in [(r'data-sayac="yolcu" data-yon="-1"', "yolcu -"), (r'data-sayac="kucuk" data-yon="1"', "kucuk +"),
                      (r'class="arac-kart" data-arac="vip"', ".arac-kart[data-arac]"),
                      (r'class="btn btn--cerceve filo-sec" data-arac="eco"', ".filo-sec[data-arac]"),
                      (r'class="odeme-kart" data-yontem="wa"', ".odeme-kart[data-yontem]"),
                      (r'class="chip" href="#rezervasyon" data-alis="gent" data-varis="bru"', ".chip[data-alis][data-varis]"),
                      (r'class="hizli-sekme" data-alis="brussels" data-varis="crl"', "hizli baslat sekmesi")]:
        kontrol(re.search(kalip, h) is not None, f"[{dil}] {ad} eksik")
    for d2 in DILLER:
        kontrol(f'href="/{d2}/" data-dil="{d2}"' in h, f"[{dil}] a[data-dil={d2}] dil baglantisi eksik")
    kontrol(h.count("<h1") == 1 and "<main" in h and "<header" in h and "<footer" in h and h.count("<nav") >= 2,
            f"[{dil}] landmark yapisi (header/main/footer/nav) eksik")
    tum_idler = re.findall(r'\sid="([^"]+)"', h)
    tekrar = sorted({k for k in tum_idler if tum_idler.count(k) > 1})
    kontrol(not tekrar, f"[{dil}] tekrar eden id: {tekrar}")
    kontrol(re.search(r'<a class="atlama" href="#main">', h) is not None and 'id="main"' in h, f"[{dil}] icerige atla baglantisi eksik")

# ============================================================ C. JSON-LD
print("— C. JSON-LD")
for dil, h in sayfalar.items():
    bloklar = [g for n, g in BETIK.findall(h) if "ld+json" in n]
    kontrol(len(bloklar) == 2, f"[{dil}] tam 2 JSON-LD blogu olmali, {len(bloklar)} var")
    for g in bloklar:
        try:
            j = json.loads(g.replace("<\\/", "</"))
        except json.JSONDecodeError as e:
            kontrol(False, f"[{dil}] JSON-LD parse hatasi: {e}")
            continue
        if j.get("@type") == "FAQPage":
            kontrol(len(j["mainEntity"]) == 10, f"[{dil}] FAQPage 10 soru icermeli")
            # JSON-LD'deki sorular ve cevaplar sayfada GORUNEN metinle ayni olmali
            gorunur = re.sub(r'<script type="application/ld\+json">.*?</script>', "", h, flags=re.S)
            for soru in j["mainEntity"]:
                kontrol(esc_html(soru["name"]) in gorunur, f"[{dil}] JSON-LD sorusu sayfada gorunmuyor: {soru['name'][:40]}")
                kontrol(esc_html(soru["acceptedAnswer"]["text"]) in gorunur,
                        f"[{dil}] JSON-LD cevabi sayfada gorunmuyor: {soru['name'][:40]}")
        else:
            # @graph: Organization + WebSite + TaxiService/LocalBusiness + WebPage (tek blok)
            dugumler = j["@graph"] if "@graph" in j else [j]
            j = next((n for n in dugumler if n.get("@id") == ALAN + "/#isletme"), {})
            kontrol(j.get("@id") == ALAN + "/#isletme", f"[{dil}] isletme @id tek ve sabit olmali")
            kontrol("TaxiService" in j["@type"] and "LocalBusiness" in j["@type"],
                    f"[{dil}] @type TaxiService+LocalBusiness olmali")
            kontrol(j["address"]["streetAddress"] == "Excelsiorlaan 31", f"[{dil}] JSON-LD adres yanlis")
            kontrol(j["vatID"] == isletme["kdv"], f"[{dil}] JSON-LD KDV yanlis")
            kontrol("geo" in j and "openingHoursSpecification" in j and "areaServed" in j
                    and "makesOffer" in j and "potentialAction" in j,
                    f"[{dil}] JSON-LD zorunlu alanlar eksik")
            hedefler = j["potentialAction"]["target"]
            hedefler = hedefler if isinstance(hedefler, list) else [hedefler]
            kontrol(isletme["whatsapp"] in [x["urlTemplate"] for x in hedefler],
                    f"[{dil}] potentialAction WhatsApp icermeli")

# ============================================================ D. SEO
print("— D. SEO etiketleri")
for dil, h in sayfalar.items():
    beklenen_yol = {"fr": "/fr/", "nl": "/nl/", "en": "/en/", "tr": "/tr/"}[dil]
    kontrol(f'<link rel="canonical" href="{ALAN}{beklenen_yol}">' in h,
            f"[{dil}] canonical kendine isaret etmeli")
    # 5'li hreflang: 4 dil + x-default -> /fr/, mutlak URL
    for d2, hf in [("fr", "fr-BE"), ("nl", "nl-BE"), ("en", "en"), ("tr", "tr")]:
        kontrol(f'hreflang="{hf}" href="{ALAN}/{d2}/"' in h, f"[{dil}] hreflang {hf} eksik/yanlis")
    kontrol(f'hreflang="x-default" href="{ALAN}/fr/"' in h, f"[{dil}] x-default /fr/ olmali")
    baslik = re.search(r"<title>(.*?)</title>", h).group(1)
    kontrol(len(baslik) <= 60, f"[{dil}] title {len(baslik)} karakter (>60)")
    aciklama = re.search(r'<meta name="description" content="(.*?)"', h).group(1)
    kontrol(len(aciklama) <= 160, f"[{dil}] description {len(aciklama)} karakter (>160)")
    kontrol(h.count("<h1") == 1, f"[{dil}] tek <h1> olmali, {h.count('<h1')} var")
    # her <img> alt'li
    for img in re.findall(r"<img [^>]*>", h):
        kontrol(" alt=" in img, f"[{dil}] alt'siz <img>: {img[:70]}")
    kontrol(f'<html lang="{ {"fr":"fr-BE","nl":"nl-BE","en":"en","tr":"tr"}[dil] }"' in h,
            f"[{dil}] html lang yanlis")
    kontrol(f'property="og:locale" content="{ {"fr":"fr_BE","nl":"nl_BE","en":"en_GB","tr":"tr_TR"}[dil] }"' in h,
            f"[{dil}] og:locale yanlis")

# ============================================================ E. yasak ozellikler (sartname §6)
print("— E. kaldirilan/yasak ozellikler")
for dil, h in sayfalar.items():
    kucuk = (h + "\n" + APP_JS).lower()   # sayfa + istemci mantigi birlikte taranir
    kontrol("type=\"range\"" not in kucuk, f"[{dil}] km kaydirma cubugu OLMAMALI")
    kontrol("google.maps.map(" not in kucuk.replace(" ", ""), f"[{dil}] harita olusturulmamali")
    kontrol("directionsrenderer" not in kucuk, f"[{dil}] DirectionsRenderer kullanilmamali")
    # Ucus numarasi ALANI yasak (SSS metninde 'ucus' kelimesi gecebilir)
    for g in re.findall(r"<input [^>]*>", h):
        kontrol(not re.search(r'(name|id)="[^"]*(flight|vlucht|ucus|vol_no)', g, re.I),
                f"[{dil}] ucus numarasi alani OLMAMALI: {g[:70]}")
    for yasak, ad in [("flight number", "ucus no (en)"), ("numéro de vol", "ucus no (fr)"),
                      ("vluchtnummer", "ucus no (nl)"), ("uçuş numara", "ucus no (tr)"),
                      ("child seat", "cocuk koltugu"), ("kindersitz", "cocuk koltugu"),
                      ("kinderstoel", "cocuk koltugu"), ("siège enfant", "cocuk koltugu"),
                      ("çocuk koltuğu", "cocuk koltugu"), ("poussette", "puset"), ("stroller", "puset"),
                      ("kinderwagen", "puset"), ("puset", "puset")]:
        kontrol(yasak not in kucuk, f"[{dil}] yasak ozellik metni bulundu: {ad} ({yasak})")

# ============================================================ F. mobil zorunlu kurallar
print("— F. mobil kurallar (sartname §10)")
CSS_SIKI = CSS.replace(" ", "")
for dil, h in sayfalar.items():
    kontrol('name="color-scheme" content="dark"' in h, f"[{dil}] color-scheme dark meta eksik")
    kontrol("color-scheme:dark" in CSS_SIKI, "site.css input color-scheme:dark eksik")
    kontrol("font-size:16px" in CSS_SIKI, "site.css input font-size 16px eksik")
    kontrol(".grid-2>div{min-width:0}" in CSS_SIKI, "site.css .grid-2 > div min-width:0 eksik")
    kontrol("overflow-wrap:anywhere" in CSS_SIKI, "site.css overflow-wrap:anywhere eksik")
    kontrol("env(safe-area-inset-bottom)" in CSS, "site.css safe-area-inset eksik")
    kontrol("overflow-x:clip" in CSS_SIKI, "site.css yatay tasma guvenlik agi (overflow-x:clip) eksik")
    kontrol("flex-wrap:wrap" in CSS_SIKI, "site.css baslik kirilabilir olmali (flex-wrap)")
    kontrol(".gm-err-container" in CSS and "display:none!important" in CSS_SIKI,
            "site.css Google hata CSS guvenlik agi eksik")
    kontrol("@media(max-width:400px)" in CSS_SIKI and ".fiyat-detay{grid-template-columns:1fr}" in CSS_SIKI,
            "site.css 400px alti fiyat kutulari dikey olmali")
    kontrol("padding:60pxvar(--gut)calc(96px+env(safe-area-inset-bottom))" in CSS_SIKI
            or "calc(96px+env(safe-area-inset-bottom))" in CSS_SIKI, "footer alt bosluk >= 92px + safe-area eksik")
    kontrol(".sayacbutton.kapali{opacity:.3;pointer-events:none}" in CSS_SIKI, "sinirda dugme opacity:.3 pointer-events:none eksik")
    kontrol("@media(pointer:coarse)" in CSS_SIKI and "min-height:44px" in CSS_SIKI, "44px dokunma hedefi (pointer:coarse) eksik")
    kontrol(":focus-visible{outline:2pxsolidvar(--gold)" in CSS_SIKI, "altin :focus-visible eksik")

# hareket azaltma: CSS'te VE JS'te (canli dinleme)
print("— F2. prefers-reduced-motion (CSS + canli JS dinleme)")
kontrol("@media (prefers-reduced-motion:reduce)" in CSS and "animation:none!important" in CSS_SIKI,
        "site.css prefers-reduced-motion:reduce ile tum animasyonlari kapatmali")
kontrol("prefers-reduced-motion: reduce" in APP_JS and "addEventListener(\"change\"" in APP_JS,
        "app.js prefers-reduced-motion'i CANLI dinlemeli (change olayi)")
# giris animasyonlari: yalniz 'from' halinden baslar (nihai durum taban stildir), fill-mode both
kontrol(CSS_SIKI.count("both;") + CSS_SIKI.count("both}") >= 10, "giris animasyonlari animation-fill-mode:both kullanmali")
CSS_YORUMSUZ = re.sub(r"/\*.*?\*/", "", CSS, flags=re.S).lower()   # yorumlarda kavram gecebilir; kurallarda gecmemeli
kontrol("preloader" not in CSS_YORUMSUZ and "perde" not in CSS_YORUMSUZ and "curtain" not in CSS_YORUMSUZ,
        "tam ekran preloader/perde olmamali")

# em dash (duz uzun tire) yasak: CSS'te hic, JS'te yalniz bos-fiyat yer tutucusunda
print("— F3. em dash yasagi")
kontrol("\u2014" not in CSS, "site.css icinde em dash olmamali")
for no, satir in enumerate(APP_JS.splitlines(), 1):
    if "\u2014" in satir:
        kontrol('"\u2014"' in satir, f"app.js:{no} em dash yalniz bos fiyat yer tutucusu olabilir: {satir.strip()[:80]}")

# ============================================================ G. sabit esitligi + boyut
print("— G. fiyat sabitleri ve boyut butcesi")
S = veri["sabitler"]
JS_METIN = APP_JS
for desen, deger in [
    (r"ACILIS:\s*10\.00", S["acilis_ucreti"] == 10.0),
    (r"KM_UCRET:\s*1\.99", S["km_ucreti"] == 1.99),
    (r"KAPORA_YUZDE:\s*20", S["kapora_yuzde"] == 20),
    (r"YOL_KATSAYI:\s*1\.17", S["yol_katsayisi"] == 1.17),
    (r"MAX_KM:\s*800", S["max_km"] == 800),
]:
    kontrol(re.search(desen, JS_METIN) and deger, f"app.js fiyat sabiti eksik/yanlis: {desen}")

import gzip

def gz_kb(veri_bayt):
    return len(gzip.compress(veri_bayt, 9)) / 1024

def hesapla_ilk_yukleme(dil, hero, gz):
    """HTML + CSS + JS + latin yazi tipi + hero gorseli (+ config.js, favicon). gz=True: metinler gzip'li."""
    varlik = WWW / "assets"
    toplam = 0.0
    parcalar = [WWW / dil / "index.html", varlik / "site.css", varlik / "app.js", varlik / "config.js", varlik / "favicon.svg"]
    for yol in parcalar:
        b = yol.read_bytes()
        toplam += gz_kb(b) if gz else len(b) / 1024
    for yol in [varlik / "fonts" / "archivo-latin.woff2", varlik / hero]:   # zaten sikisik ikili dosyalar
        toplam += yol.stat().st_size / 1024
    return toplam

for dil in DILLER:
    masa_gz = hesapla_ilk_yukleme(dil, "hero-masa.jpg", True)
    mobil_gz = hesapla_ilk_yukleme(dil, "hero-mobil.jpg", True)
    kontrol(masa_gz <= 300, f"[{dil}] masaustu ilk yukleme (gzip) {masa_gz:.0f} KB (hedef <=300)")
    kontrol(mobil_gz <= 250, f"[{dil}] mobil ilk yukleme (gzip) {mobil_gz:.0f} KB (hedef <=250)")
# eski ham (sikistirmasiz) butceler de korunur
kontrol(hesapla_ilk_yukleme("fr", "hero-masa.jpg", False) < 260, "masaustu ilk yukleme (ham) >= 260 KB")
kontrol(hesapla_ilk_yukleme("fr", "hero-mobil.jpg", False) < 230, "mobil ilk yukleme (ham) >= 230 KB")

# ============================================================ H. kok yonlendirme
print("— H. kok sayfa")
kontrol('content="noindex,follow"' in kok_html, "kok sayfa noindex olmali")
for d in DILLER:
    kontrol(f'href="/{d}/"' in kok_html, f"kok sayfada /{d}/ linki olmali")
kontrol(re.search(r'src="/assets/kok\.js(\?v=[0-9a-f]+)?"', kok_html) is not None, "kok sayfa yonlendirmeyi assets/kok.js ile yapmali (satir ici JS yok)")
kontrol("localStorage" in KOK_JS and "navigator.languages" in KOK_JS and "location.replace" in KOK_JS,
        "kok yonlendirme tarayici dili + localStorage kullanmali")
kontrol("accept-language" not in (kok_html + KOK_JS).lower(), "sunucu tarafi dil yonlendirmesi olmamali")

# ============================================================ I. sartnamenin istedigi google deseni
print("— I. Google hata yonetimi deseni")
kontrol("gm_authFailure" in APP_JS, "app.js gm_authFailure kancasi eksik")
kontrol("AutocompleteService" in APP_JS and "getPlacePredictions" in APP_JS,
        "app.js anahtar on-testi (AutocompleteService) eksik")
kontrol(".pac-container,.gm-err-container,.gm-style-moc" in APP_JS, "app.js fallbackMode DOM temizligi eksik")
kontrol("6000" in APP_JS and "TIMEOUT" in APP_JS and "fallbackMode" in APP_JS, "app.js 6 sn zaman asimi eksik")
kontrol("componentRestrictions" in APP_JS and '"be","de","fr","lu","nl"' in APP_JS.replace(" ", ""),
        "app.js ulke kisitlamasi (be,de,fr,lu,nl) eksik")
kontrol("window.initGoogleMaps" in APP_JS and "loading=async" in APP_JS, "app.js Google betik yukleme mantigi eksik")
for dil, h in sayfalar.items():
    kontrol("maps.googleapis.com" not in h, f"[{dil}] sayfada Google betigi dogrudan yuklenmemeli (anahtar bossa hic yuklenmez)")

print()
if hatalar:
    print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
    for x in hatalar:
        print("   -", x)
    sys.exit(1)
print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
