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

# ============================================================ B. JS gecerliligi (node --check)
print("— B. JS soz dizimi (node --check)")
BETIK = re.compile(r"<script([^>]*)>(.*?)</script>", re.S)
for dil, h in sayfalar.items():
    for i, (nitelik, govde) in enumerate(BETIK.findall(h)):
        if "ld+json" in nitelik or "src=" in nitelik:
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(govde)
            gecici = f.name
        p = subprocess.run(["node", "--check", gecici], capture_output=True, text=True)
        kontrol(p.returncode == 0, f"[{dil}] betik #{i} node --check hatasi: {p.stderr[:300]}")
        Path(gecici).unlink()

# kok sayfa betigi de temiz olmali
kok_html = (WWW / "index.html").read_text(encoding="utf-8")
for i, (nitelik, govde) in enumerate(BETIK.findall(kok_html)):
    if "ld+json" in nitelik or "src=" in nitelik:
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(govde)
        gecici = f.name
    p = subprocess.run(["node", "--check", gecici], capture_output=True, text=True)
    kontrol(p.returncode == 0, f"[kok] betik #{i} node --check hatasi: {p.stderr[:300]}")
    Path(gecici).unlink()

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
            kontrol(len(j["mainEntity"]) == 6, f"[{dil}] FAQPage 6 soru icermeli")
            # JSON-LD'deki sorular sayfada GORUNEN sorularla ayni olmali
            for soru in j["mainEntity"]:
                kontrol(soru["name"] in h, f"[{dil}] JSON-LD sorusu sayfada gorunmuyor: {soru['name'][:40]}")
        else:
            kontrol(j.get("@id") == ALAN + "/#isletme", f"[{dil}] isletme @id tek ve sabit olmali")
            kontrol("TaxiService" in j["@type"] and "LocalBusiness" in j["@type"],
                    f"[{dil}] @type TaxiService+LocalBusiness olmali")
            kontrol(j["address"]["streetAddress"] == "Excelsiorlaan 31", f"[{dil}] JSON-LD adres yanlis")
            kontrol(j["vatID"] == isletme["kdv"], f"[{dil}] JSON-LD KDV yanlis")
            kontrol("geo" in j and "openingHoursSpecification" in j and "areaServed" in j
                    and "makesOffer" in j and "potentialAction" in j,
                    f"[{dil}] JSON-LD zorunlu alanlar eksik")
            kontrol(j["potentialAction"]["target"]["urlTemplate"] == isletme["whatsapp"],
                    f"[{dil}] potentialAction WhatsApp olmali")

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
    kucuk = h.lower()
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
for dil, h in sayfalar.items():
    kontrol('name="color-scheme" content="dark"' in h, f"[{dil}] color-scheme dark meta eksik")
    kontrol("font-size:16px" in h.replace(" ", ""), f"[{dil}] input font-size 16px eksik")
    kontrol("min-width:0" in h.replace(" ", ""), f"[{dil}] .grid-2 min-width:0 eksik")
    kontrol("overflow-wrap:anywhere" in h.replace(" ", ""), f"[{dil}] overflow-wrap:anywhere eksik")
    kontrol("env(safe-area-inset-bottom)" in h, f"[{dil}] safe-area-inset eksik")
    kontrol(".gm-err-container" in h and "display:none!important" in h.replace(" ", ""),
            f"[{dil}] Google hata CSS guvenlik agi eksik")

# ============================================================ G. sabit esitligi + boyut
print("— G. fiyat sabitleri ve boyut butcesi")
S = veri["sabitler"]
for dil, h in sayfalar.items():
    for desen, deger in [
        (r"ACILIS:\s*10\.00", S["acilis_ucreti"] == 10.0),
        (r"KM_UCRET:\s*1\.99", S["km_ucreti"] == 1.99),
        (r"KAPORA_YUZDE:\s*20", S["kapora_yuzde"] == 20),
        (r"YOL_KATSAYI:\s*1\.17", S["yol_katsayisi"] == 1.17),
        (r"MAX_KM:\s*800", S["max_km"] == 800),
    ]:
        kontrol(re.search(desen, h) and deger, f"[{dil}] JS fiyat sabiti eksik/yanlis: {desen}")

varlik = WWW / "assets"
sayfa_kb = {d: len(h.encode("utf-8")) / 1024 for d, h in sayfalar.items()}
masa_ilk = sayfa_kb["fr"] + sum((varlik / f).stat().st_size / 1024 for f in
                                ["hero-masa.jpg", "config.js", "favicon.svg",
                                 "arac-eco.svg", "arac-wagon.svg", "arac-vip.svg"])
mobil_ilk = sayfa_kb["fr"] + sum((varlik / f).stat().st_size / 1024 for f in
                                 ["hero-mobil.jpg", "config.js", "favicon.svg",
                                  "arac-eco.svg", "arac-wagon.svg", "arac-vip.svg"])
kontrol(masa_ilk < 260, f"masaustu ilk yukleme {masa_ilk:.0f} KB (hedef <260)")
kontrol(mobil_ilk < 230, f"mobil ilk yukleme {mobil_ilk:.0f} KB (hedef <230)")

# ============================================================ H. kok yonlendirme
print("— H. kok sayfa")
kontrol('content="noindex,follow"' in kok_html, "kok sayfa noindex olmali")
for d in DILLER:
    kontrol(f'href="/{d}/"' in kok_html, f"kok sayfada /{d}/ linki olmali")
kontrol("localStorage" in kok_html and "navigator.languages" in kok_html,
        "kok yonlendirme tarayici dili + localStorage kullanmali")
kontrol("accept-language" not in kok_html.lower(), "sunucu tarafi dil yonlendirmesi olmamali")

# ============================================================ I. sartnamenin istedigi google deseni
print("— I. Google hata yonetimi deseni")
for dil, h in sayfalar.items():
    kontrol("gm_authFailure" in h, f"[{dil}] gm_authFailure kancasi eksik")
    kontrol("AutocompleteService" in h and "getPlacePredictions" in h,
            f"[{dil}] anahtar on-testi (AutocompleteService) eksik")
    kontrol(".pac-container,.gm-err-container,.gm-style-moc" in h,
            f"[{dil}] fallbackMode DOM temizligi eksik")
    kontrol("6000" in h, f"[{dil}] 6 sn zaman asimi eksik")
    kontrol("componentRestrictions" in h and '"be","de","fr","lu","nl"' in h.replace(" ", ""),
            f"[{dil}] ulke kisitlamasi (be,de,fr,lu,nl) eksik")

print()
if hatalar:
    print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
    for x in hatalar:
        print("   -", x)
    sys.exit(1)
print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
