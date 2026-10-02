# -*- coding: utf-8 -*-
"""
SEO / GEO TESTLERI: kaynak/seo.py + seo-strings.json + assets/icons
Calistirma: python3 kaynak/testler/test_seo.py
Tamamen AG DISI, build.py calistirmaz (www/ gerekmez). Yalniz standart kutuphane.
Cikis kodu 0 = hepsi gecti.
"""
import ast
import copy
import datetime
import inspect
import json
import re
import struct
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

KAYNAK = Path(__file__).resolve().parent.parent          # kaynak/
sys.path.insert(0, str(KAYNAK))
import seo  # noqa: E402

DILLER = ["fr", "nl", "en", "tr"]
BUGUN = "2026-09-28"

hatalar = []
uyarilar = []
gecen = 0


def kontrol(kosul, mesaj):
    global gecen
    if kosul:
        gecen += 1
    else:
        hatalar.append(mesaj)


def uyar(mesaj):
    uyarilar.append(mesaj)


# ---------------------------------------------------------------- yardimcilar
def yukle(ad):
    return json.loads((KAYNAK / ad).read_text(encoding="utf-8"))


def normalize(s):
    """build.py normalize() ile ayni kurallar."""
    s = s.lower()
    s = s.replace("ı", "i").replace("ß", "ss").replace("œ", "oe").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def esc_html(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def png_oku(yol):
    """Kucuk PNG cozucu (8 bit RGB/RGBA, taramasiz). -> (genislik, yukseklik, piksel_fonksiyonu)."""
    d = yol.read_bytes()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", "PNG imzasi yok"
    i, idat, ihdr = 8, b"", None
    while i < len(d):
        n = struct.unpack(">I", d[i:i + 4])[0]
        tip, govde = d[i + 4:i + 8], d[i + 8:i + 8 + n]
        i += 12 + n
        if tip == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", govde)
        elif tip == b"IDAT":
            idat += govde
    w, h, bit, renk, _, _, taramali = ihdr
    assert bit == 8 and renk in (2, 6) and taramali == 0, f"desteklenmeyen PNG: {ihdr}"
    bpp = 3 if renk == 2 else 4
    ham = zlib.decompress(idat)
    stride = w * bpp
    satirlar, onceki = [], bytearray(stride)
    p = 0
    for _ in range(h):
        f = ham[p]
        satir = bytearray(ham[p + 1:p + 1 + stride])
        p += 1 + stride
        if f == 1:
            for x in range(bpp, stride):
                satir[x] = (satir[x] + satir[x - bpp]) & 255
        elif f == 2:
            for x in range(stride):
                satir[x] = (satir[x] + onceki[x]) & 255
        elif f == 3:
            for x in range(stride):
                sol = satir[x - bpp] if x >= bpp else 0
                satir[x] = (satir[x] + ((sol + onceki[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = satir[x - bpp] if x >= bpp else 0
                b = onceki[x]
                c = onceki[x - bpp] if x >= bpp else 0
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                satir[x] = (satir[x] + pr) & 255
        satirlar.append(satir)
        onceki = satir

    def piksel(x, y):
        o = x * bpp
        return tuple(satirlar[y][o:o + 3])
    return w, h, piksel


def jpeg_boyut(yol):
    d = yol.read_bytes()
    i = 2
    while i < len(d):
        if d[i] != 0xFF:
            i += 1
            continue
        m = d[i + 1]
        if m in (0xC0, 0xC1, 0xC2):
            yuk, gen = struct.unpack(">HH", d[i + 5:i + 9])
            return gen, yuk
        i += 2 + struct.unpack(">H", d[i + 2:i + 4])[0]
    return None


# ---------------------------------------------------------------- baglam
strings = yukle("strings.json")
seo_strings = yukle("seo-strings.json")
veri = yukle("mesafe-verisi.json")
isletme = yukle("isletme.json")
SABIT = veri["sabitler"]
ALAN = isletme["alan_adi"].rstrip("/")
YERLER = veri["yerler"]
KESIN = {f"{a}|{b}": km for a, b, km in veri["kesin"]}

birlesik = copy.deepcopy(strings)
for d in DILLER:
    birlesik[d].update(seo_strings[d])


def fiyat(km):
    toplam = round(SABIT["acilis_ucreti"] + km * SABIT["km_ucreti"] + 1e-9, 2)
    kapora = round(toplam * SABIT["kapora_yuzde"] / 100 + 1e-9, 2)
    return toplam, kapora, round(toplam - kapora, 2)


def bagimsiz_fiyat(km):
    """sartname formulu, sabitlere bakmadan: 10 EUR + 1,99 EUR/km."""
    return round(10 + km * 1.99 + 1e-9, 2)


ctx = dict(strings=birlesik, veri=veri, isletme=isletme, alan=ALAN, diller=DILLER,
           bugun=BUGUN, fiyat=fiyat, kesin=KESIN)
ctx_kopya = copy.deepcopy({k: v for k, v in ctx.items() if k != "fiyat"})


def km_bul(a, b):
    return KESIN.get(f"{a}|{b}") or KESIN.get(f"{b}|{a}")


# ============================================================ A. API imzalari ve saflik
print("— A. API imzalari, saflik, sabitler")
IMZALAR = {
    "head_ek": ["dil", "ctx"], "jsonld_graph": ["dil", "ctx"], "jsonld_faq": ["dil", "ctx", "ciftler"],
    "llms_txt": ["ctx"], "llms_full_txt": ["ctx"], "robots_txt": ["ctx"], "security_txt": ["ctx"],
    "manifest": ["ctx"], "sitemap_xml": ["ctx"], "zone_data": ["dil", "ctx"],
    "statik_doldur": ["dil", "metin", "ctx"],
}
for ad, beklenen in IMZALAR.items():
    kontrol(hasattr(seo, ad), f"seo.{ad} yok")
    if hasattr(seo, ad):
        gercek = list(inspect.signature(getattr(seo, ad)).parameters)[:len(beklenen)]
        kontrol(gercek == beklenen, f"seo.{ad} imzasi {gercek}, beklenen {beklenen}")
kontrol((SABIT["acilis_ucreti"], SABIT["km_ucreti"], SABIT["kapora_yuzde"]) == (10.0, 1.99, 20),
        "sartname sabitleri (10 EUR + 1,99 EUR/km, %20) mesafe-verisi.json ile uyusmuyor")

# tum fonksiyonlar 4 dil icin cagrilir; ciktilar toplanir
cikti = {"graph": {}, "faq": {}, "head": {}, "zone": {}}
SSS_SAYISI = 10


def sss_ciftleri(dil):
    return [(seo.statik_doldur(dil, birlesik[dil][f"faq{i}_q"], ctx),
             seo.statik_doldur(dil, birlesik[dil][f"faq{i}_a"], ctx)) for i in range(1, SSS_SAYISI + 1)]


for d in DILLER:
    cikti["graph"][d] = seo.jsonld_graph(d, ctx)
    cikti["faq"][d] = seo.jsonld_faq(d, ctx, sss_ciftleri(d))
    cikti["head"][d] = seo.head_ek(d, ctx)
    cikti["zone"][d] = seo.zone_data(d, ctx)
LLMS = seo.llms_txt(ctx)
LLMS_FULL = seo.llms_full_txt(ctx)
ROBOTS = seo.robots_txt(ctx)
SECURITY = seo.security_txt(ctx)
MANIFEST = seo.manifest(ctx)
SITEMAP = seo.sitemap_xml(ctx)

# saflik: ayni girdi -> ayni cikti; ctx degismez
kontrol(json.dumps(seo.jsonld_graph("fr", ctx), sort_keys=True) == json.dumps(cikti["graph"]["fr"], sort_keys=True),
        "jsonld_graph deterministik degil")
kontrol(seo.llms_txt(ctx) == LLMS and seo.robots_txt(ctx) == ROBOTS and seo.sitemap_xml(ctx) == SITEMAP,
        "cikti deterministik degil")
kontrol(copy.deepcopy({k: v for k, v in ctx.items() if k != "fiyat"}) == ctx_kopya,
        "seo.py ctx'i degistirdi (yan etki)")

# tum ciktilar tek havuzda: yasak icerik taramalari icin
HAVUZ = {"llms.txt": LLMS, "llms-full.txt": LLMS_FULL, "robots.txt": ROBOTS, "security.txt": SECURITY,
         "manifest": json.dumps(MANIFEST, ensure_ascii=False), "sitemap": SITEMAP,
         "seo-strings": json.dumps(seo_strings, ensure_ascii=False)}
for d in DILLER:
    HAVUZ[f"graph[{d}]"] = json.dumps(cikti["graph"][d], ensure_ascii=False)
    HAVUZ[f"faq[{d}]"] = json.dumps(cikti["faq"][d], ensure_ascii=False)
    HAVUZ[f"head[{d}]"] = cikti["head"][d]

# ============================================================ B. seo-strings.json yapisi
print("— B. seo-strings.json: anahtarlar, yer tutucular, uzunluk, dil kurallari")
kontrol(all(d in seo_strings for d in DILLER), "seo-strings.json 4 dili de icermeli")
OVERRIDE = {"meta_title", "meta_desc", "og_title", "og_desc"}
yeni_anahtar_kumeleri = {}
for d in DILLER:
    for k in seo_strings[d]:
        if k in strings["fr"]:
            kontrol(k in OVERRIDE, f"[{d}] '{k}' strings.json'da var ama override izin listesinde degil (istemeden ezme riski)")
        else:
            yeni_anahtar_kumeleri.setdefault(d, set()).add(k)
kontrol(len({frozenset(v) for v in yeni_anahtar_kumeleri.values()}) == 1 and len(yeni_anahtar_kumeleri) == 4,
        "yeni anahtar kumeleri 4 dilde birebir ayni olmali: "
        + str({d: len(v) for d, v in yeni_anahtar_kumeleri.items()}))
ORTAK = yeni_anahtar_kumeleri.get("fr", set())
for zorunlu in ["zones_title", "zones_sub", "zones_from", "zones_airports_t", "zones_cities_t", "zones_border_t",
                "og_image_alt"] + [f"faq{i}_{x}" for i in range(7, 11) for x in "qa"]:
    for d in DILLER:
        kontrol(zorunlu in seo_strings[d] and seo_strings[d][zorunlu].strip(),
                f"[{d}] seo-strings '{zorunlu}' eksik/bos")

YT = re.compile(r"\{([a-z_]+)\}")
for k in sorted(set().union(*[set(seo_strings[d]) for d in DILLER])):
    if k.startswith("_"):
        continue
    kumeler = {d: set(YT.findall(seo_strings[d].get(k, ""))) for d in DILLER if k in seo_strings[d]}
    if len(kumeler) > 1:
        kontrol(len({frozenset(v) for v in kumeler.values()}) == 1,
                f"'{k}' yer tutucu kumeleri diller arasinda ayni degil: {kumeler}")
    # override anahtarlarinin yer tutuculari strings.json'daki 4 dille uyumlu alt kume olmali
    for d in kumeler:
        yasal = {"pct", "base", "perkm", "company", "vat", "email", "company_email", "year", "price"} | \
                {p + "_" + c for p in ("km", "price") for c in seo.ROTA_KODLARI}
        kontrol(kumeler[d] <= yasal, f"[{d}] '{k}' bilinmeyen yer tutucu: {sorted(kumeler[d] - yasal)}")

for d in DILLER:
    for i in range(1, SSS_SAYISI + 1):
        kontrol(f"faq{i}_q" in birlesik[d] and f"faq{i}_a" in birlesik[d], f"[{d}] faq{i} eksik (birlesik)")
    # doldurma: kalinti '{' yok ({price} yalniz zones_from icinde beklenir)
    for k, v in seo_strings[d].items():
        if k.startswith("_"):
            continue
        dolu = seo.statik_doldur(d, v, ctx)
        if k == "zones_from":
            kontrol(dolu.count("{price}") == 1 and "{" not in dolu.replace("{price}", ""),
                    f"[{d}] zones_from tam olarak bir {{price}} icermeli: {dolu}")
        else:
            kontrol("{" not in dolu and "}" not in dolu, f"[{d}] '{k}' doldurulunca yer tutucu kaldi: {dolu[:80]}")
        kontrol("—" not in v, f"[{d}] '{k}' uzun tire (em dash) iceriyor")
        izinli = "&" if k in ("meta_title", "og_title") else ""   # basliklarda '&' build'de kacislanir (uzunluk testi kacisliyi olcer)
        kontrol(not any(c in dolu for c in '<>&"' if c not in izinli), f"[{d}] '{k}' HTML/JSON kacis gerektiren karakter iceriyor")

# meta uzunluklari (birlesik, doldurulmus; test_adim2 gibi KACISLI uzunluk da <=)
for d in DILLER:
    b = {k: seo.statik_doldur(d, birlesik[d][k], ctx) for k in ("meta_title", "meta_desc", "og_title", "og_desc")}
    kontrol(len(b["meta_title"]) <= 60, f"[{d}] title {len(b['meta_title'])} > 60")
    kontrol(len(esc_html(b["meta_title"])) <= 60, f"[{d}] title kacisli {len(esc_html(b['meta_title']))} > 60 (test_adim2 bunu olcer)")
    kontrol(len(b["meta_desc"]) <= 160, f"[{d}] description {len(b['meta_desc'])} > 160")
    kontrol(len(esc_html(b["meta_desc"])) <= 160, f"[{d}] description kacisli > 160")
    kontrol(len(b["og_title"]) <= 60, f"[{d}] og_title {len(b['og_title'])} > 60")
    kontrol(len(b["og_desc"]) <= 160, f"[{d}] og_desc {len(b['og_desc'])} > 160")
    kontrol(len(b["meta_desc"]) >= 110, f"[{d}] description cok kisa ({len(b['meta_desc'])})")
    kontrol('"' not in b["meta_desc"] and '"' not in b["meta_title"], f"[{d}] meta metninde cift tirnak (attribute kirar)")

# NL = Belcika Flamancasi
nl_tum = " ".join(seo_strings["nl"].values()).lower()
kontrol("aanbetaling" not in nl_tum and "creditcard" not in nl_tum and "pinpas" not in nl_tum,
        "NL: Hollanda Hollandacasi sozcukleri (aanbetaling/creditcard/pinpas) YASAK")
kontrol("voorschot" in nl_tum, "NL: 'voorschot' (Flaman) kullanilmali")
nl_birlesik = " ".join(birlesik["nl"].values()).lower()
kontrol("kredietkaart" in nl_birlesik and "voorschot" in nl_birlesik and "instapgeld" in nl_birlesik
        and "aanbetaling" not in nl_birlesik, "NL birlesik metin: kredietkaart/voorschot/instapgeld var, aanbetaling yok")
kontrol("break" in nl_birlesik and "luchthavenvervoer" in nl_birlesik, "NL: break/luchthavenvervoer beklenir")
kontrol("aanbetaling" not in HAVUZ["llms-full.txt"].lower(), "llms-full: 'aanbetaling' yok olmali")
nl_llms = LLMS_FULL[LLMS_FULL.index("## Nederlands"):LLMS_FULL.index("## English")]
kontrol("kredietkaart" in nl_llms and "voorschot" in nl_llms, "llms-full NL blogu kredietkaart+voorschot icermeli")
kontrol("Gand" in birlesik["fr"]["faq7_a"] or "Gand" in seo.statik_doldur("fr", birlesik["fr"]["faq7_a"], ctx),
        "FR faq7: Belcika Fransizcasi sehir adi (Gand) beklenir")

# Anahtar kelime kapsami (dogal cumle icinde, komsu kelime penceresi)
KELIMELER = {
    "fr": ["taxi Bruxelles", "transfert aéroport Bruxelles", "taxi Zaventem", "taxi aéroport Charleroi",
           "navette aéroport"],
    "nl": ["taxi Gent", "Brussel luchthaven transfer", "Charleroi taxi", "grensoverschrijdende taxi",
           "luchthavenvervoer Zaventem"],
    "en": ["Brussels taxi", "airport transfer Brussels", "Zaventem taxi", "Charleroi airport taxi",
           "cross-border taxi Belgium"],
    "tr": ["Brüksel taksi", "Brüksel havalimanı transfer", "Charleroi transfer", "Belçika havalimanı taksi"],
}
AYIR = {"nl": {"luchthaventransfer": "luchthaven transfer"}}


def jetonlar(dil, metin):
    n = normalize(metin)
    for a, b in AYIR.get(dil, {}).items():
        n = n.replace(a, b)
    return n.split()


def kelime_var(dil, metin, kelime):
    """kelime jetonlarinin hepsi (ek almis biciminde: startswith) bir pencerede geciyor mu."""
    t = jetonlar(dil, metin)
    kj = normalize(kelime).split()
    konumlar = [[i for i, x in enumerate(t) if x.startswith(k)] for k in kj]
    if any(not k for k in konumlar):
        return False
    pencere = len(kj) + 3
    for i0 in konumlar[0]:
        if all(any(abs(i0 - j) < pencere for j in k) for k in konumlar[1:]):
            return True
    return False


def kapsam(dil, metin):
    return sum(1 for k in KELIMELER[dil] if kelime_var(dil, metin, k))


for d in DILLER:
    eski = strings[d]["meta_title"] + ". " + strings[d]["meta_desc"]
    yeni = seo.statik_doldur(d, birlesik[d]["meta_title"], ctx) + ". " + \
        seo.statik_doldur(d, birlesik[d]["meta_desc"], ctx)
    n_eski, n_yeni = kapsam(d, eski), kapsam(d, yeni)
    kontrol(n_yeni >= n_eski, f"[{d}] yeni title+description anahtar kelime kapsami ({n_yeni}) eskisinden ({n_eski}) az")
    if any(k in seo_strings[d] for k in ("meta_title", "meta_desc")):
        kontrol(n_yeni > n_eski or n_eski == len(KELIMELER[d]),
                f"[{d}] meta override 'gercekten daha iyi' degil: kapsam {n_eski} -> {n_yeni}")
    print(f"   {d}: title+description anahtar kelime kapsami {n_eski}/{len(KELIMELER[d])} -> {n_yeni}/{len(KELIMELER[d])}")
    # sayfa duzeyi: her anahtar kelime, sayfadaki (birlesik) tek bir metin parcasinda dogal olarak gecmeli
    parcalar = [seo.statik_doldur(d, v, ctx) for k, v in birlesik[d].items() if not k.startswith("_") and isinstance(v, str)]
    for k in KELIMELER[d]:
        kontrol(any(kelime_var(d, p, k) for p in parcalar), f"[{d}] anahtar kelime sayfa metninde gecmiyor: '{k}'")

# ============================================================ C. JSON-LD
print("— C. JSON-LD (@graph + FAQPage)")
YASAK_ALAN = {"aggregateRating", "review", "reviews", "sameAs", "award", "awards", "foundingDate",
              "numberOfEmployees", "ratingValue", "reviewCount", "founder", "employee"}


def gez(dugum, f, yol=""):
    """Tum sozluk/liste dugumlerinde f(dict, yol) cagirir."""
    if isinstance(dugum, dict):
        f(dugum, yol)
        for k, v in dugum.items():
            gez(v, f, yol + "/" + k)
    elif isinstance(dugum, list):
        for i, v in enumerate(dugum):
            gez(v, f, yol + f"[{i}]")


tum_idler = {}
for d in DILLER:
    g, faq = cikti["graph"][d], cikti["faq"][d]
    kontrol(g.get("@context") == "https://schema.org" and isinstance(g.get("@graph"), list),
            f"[{d}] @context + @graph beklenir")
    for ad, blok in (("graph", g), ("faq", faq)):
        metin = json.dumps(blok, ensure_ascii=False)
        try:
            kontrol(json.loads(metin) == blok, f"[{d}] {ad} json gidis-donus esit degil")
        except ValueError as e:
            kontrol(False, f"[{d}] {ad} gecersiz JSON: {e}")
        kontrol("</" not in metin, f"[{d}] {ad} '</' iceriyor (script kacisi gerekir)")
        kontrol(len(metin.encode("utf-8")) < 20000, f"[{d}] {ad} cok buyuk: {len(metin.encode('utf-8'))} bayt")

    tanim, refler = {}, []

    def topla(n, yol, tanim=tanim, refler=refler, d=d):
        if "@id" in n:
            if len(n) == 1:
                refler.append((n["@id"], yol))
            else:
                kontrol(n["@id"] not in tanim, f"[{d}] @id tekil degil: {n['@id']} ({yol})")
                tanim[n["@id"]] = n
    gez(g, topla)
    tanim_faq = {}
    gez(faq, lambda n, yol: tanim_faq.__setitem__(n["@id"], n) if "@id" in n and len(n) > 1 else None)
    kontrol(faq["@id"] in tanim_faq, f"[{d}] FAQPage @id eksik")
    kontrol(not (set(tanim) & set(tanim_faq)), f"[{d}] FAQ @id'si graph ile cakisiyor")
    # tum referanslar var olan @id'ye isaret eder (graph + FAQ blogu birlikte)
    gez(faq, lambda n, yol: refler.append((n["@id"], "faq" + yol)) if "@id" in n and len(n) == 1 else None)
    for rid, yol in refler:
        kontrol(rid in tanim or rid in tanim_faq, f"[{d}] kirik referans {rid} ({yol})")
    for k in ("isPartOf", "publisher", "about", "parentOrganization", "logo"):
        # isimli referans alanlari @id ile verilmis olmali
        def kontrol_ref(n, yol, k=k, d=d):
            if k in n and isinstance(n[k], dict) and "@id" in n[k]:
                kontrol(n[k]["@id"] in tanim or n[k]["@id"] in tanim_faq, f"[{d}] {k} -> {n[k]['@id']} tanimsiz")
        gez(g, kontrol_ref)
        gez(faq, kontrol_ref)

    # sabit kimlikler
    sayfa_url = ALAN + strings[d]["dil_yol"]
    for kimlik in (ALAN + "/#isletme", ALAN + "/#organization", ALAN + "/#website", ALAN + "/#logo",
                   sayfa_url + "#webpage"):
        kontrol(kimlik in tanim, f"[{d}] @graph icinde {kimlik} yok")
    tum_idler[d] = {i for i in tanim if not i.startswith(sayfa_url)}
    kontrol(faq["@id"] == sayfa_url + "#faq", f"[{d}] FAQPage @id url#faq olmali")

    isl = tanim[ALAN + "/#isletme"]
    org = tanim[ALAN + "/#organization"]
    site = tanim[ALAN + "/#website"]
    sayfa = tanim[sayfa_url + "#webpage"]
    tipler = isl["@type"] if isinstance(isl["@type"], list) else [isl["@type"]]
    kontrol("TaxiService" in tipler and "LocalBusiness" in tipler, f"[{d}] isletme tipi TaxiService+LocalBusiness")
    kontrol(org["@type"] == "Organization" and site["@type"] == "WebSite" and sayfa["@type"] == "WebPage",
            f"[{d}] Organization/WebSite/WebPage tipleri")
    kontrol(sayfa["inLanguage"] == strings[d]["dil_hreflang"] and faq["inLanguage"] == strings[d]["dil_hreflang"],
            f"[{d}] inLanguage hreflang ile ayni olmali")
    kontrol(site["inLanguage"] == [strings[x]["dil_hreflang"] for x in DILLER], f"[{d}] WebSite.inLanguage 4 dil")
    kontrol(sayfa["isPartOf"] == {"@id": site["@id"]} and sayfa["about"] == {"@id": isl["@id"]}
            and site["publisher"] == {"@id": org["@id"]}, f"[{d}] WebPage/WebSite baglantilari")
    kontrol("potentialAction" not in site, f"[{d}] arama kutusu yok: WebSite.potentialAction olmamali")
    kontrol(sayfa["speakable"]["cssSelector"] == ["h1", ".hero-alt"], f"[{d}] speakable cssSelector")

    # YASAK alanlar hicbir yerde yok
    def yasak_ara(n, yol, d=d):
        for k in n:
            kontrol(k not in YASAK_ALAN, f"[{d}] YASAK JSON-LD alani: {k} ({yol})")
    gez(g, yasak_ara)
    gez(faq, yasak_ara)

    # isletme.json ile birebir
    kontrol(isl["telephone"] == isletme["telefon"] and org["telephone"] == isletme["telefon"],
            f"[{d}] telefon isletme.json ile ayni degil")
    kontrol(isl["email"] == isletme["eposta"] and org["email"] == isletme["eposta"], f"[{d}] e-posta")
    kontrol(isl["vatID"] == isletme["kdv"] and org["vatID"] == isletme["kdv"], f"[{d}] KDV")
    kontrol(isl["legalName"] == isletme["unvan"] and org["legalName"] == isletme["unvan"], f"[{d}] unvan")
    for dugum in (isl, org):
        a = dugum["address"]
        kontrol(f'{a["streetAddress"]}, {a["postalCode"]} {a["addressLocality"]}, Belgium' == isletme["adres"]
                and a["addressCountry"] == "BE", f"[{d}] adres isletme.json ile ayni degil: {a}")
    cp = org["contactPoint"][0]
    kontrol(cp["contactType"] == "customer service" and cp["telephone"] == isletme["telefon"]
            and cp["email"] == isletme["eposta"], f"[{d}] contactPoint")
    kontrol(cp["availableLanguage"] == ["fr", "nl", "en", "tr"], f"[{d}] contactPoint.availableLanguage")
    kontrol(cp["hoursAvailable"]["opens"] == "00:00" and cp["hoursAvailable"]["closes"] == "23:59"
            and len(cp["hoursAvailable"]["dayOfWeek"]) == 7, f"[{d}] contactPoint 7/24")
    oh = isl["openingHoursSpecification"]
    kontrol(len(oh["dayOfWeek"]) == 7 and oh["opens"] == "00:00" and oh["closes"] == "23:59", f"[{d}] 7/24 saatler")
    kontrol(isl["geo"]["latitude"] == seo.KOORDINAT[0] and isl["geo"]["longitude"] == seo.KOORDINAT[1],
            f"[{d}] geo seo.KOORDINAT ile ayni olmali")
    kontrol(isl["currenciesAccepted"] == "EUR", f"[{d}] currenciesAccepted")
    for y in ("Bancontact", "Credit card", "Apple Pay"):
        kontrol(y in isl["paymentAccepted"], f"[{d}] paymentAccepted '{y}' icermeli")
    kontrol(bool(isl.get("priceRange")), f"[{d}] priceRange")
    kontrol(isl["parentOrganization"] == {"@id": org["@id"]} and isl["logo"] == {"@id": ALAN + "/#logo"},
            f"[{d}] isletme -> organization/logo baglantisi")
    kontrol(org["logo"]["@id"] == ALAN + "/#logo" and org["logo"]["width"] == org["logo"]["height"],
            f"[{d}] logo ImageObject")

    # areaServed: ulkeler BE/DE/FR/LU/NL + sehir + havalimani
    ulkeler = [x["identifier"] for x in isl["areaServed"] if x["@type"] == "Country"]
    kontrol(sorted(ulkeler) == ["BE", "DE", "FR", "LU", "NL"], f"[{d}] areaServed ulke kodlari: {ulkeler}")
    havalar = [x for x in isl["areaServed"] if x["@type"] == "Airport"]
    kontrol(len(havalar) >= 5 and all(re.fullmatch(r"[A-Z]{3}", x["iataCode"]) for x in havalar),
            f"[{d}] areaServed havalimanlari iataCode")
    kontrol("ORY" in {x["iataCode"] for x in havalar} and "ORLY" not in {x["iataCode"] for x in havalar},
            f"[{d}] Orly iataCode ORY olmali")
    kontrol("BRU" in {x["iataCode"] for x in havalar} and "CRL" in {x["iataCode"] for x in havalar},
            f"[{d}] BRU ve CRL areaServed'da olmali")
    kontrol(len([x for x in isl["areaServed"] if x["@type"] == "City"]) >= 10, f"[{d}] areaServed sehirler")
    sehir_adlari = {x["name"] for x in isl["areaServed"] if x["@type"] == "City"}
    kontrol(YERLER["gent"]["ad"][d] in sehir_adlari and YERLER["brussels"]["ad"][d] in sehir_adlari,
            f"[{d}] sehir adlari dile gore olmali")

    # filo
    filo = isl["owns"]
    kontrol([c["vehicleSeatingCapacity"] for c in filo] == [4, 4, 7], f"[{d}] filo kapasiteleri 4/4/7")
    kontrol(filo[0]["name"] == "Tesla Model 3" and filo[2]["name"] == "Mercedes Vito", f"[{d}] filo adlari")

    # teklifler: KESIN tablodan yeniden hesaplanan fiyatlarla esit
    teklifler = {o["@id"]: o for o in isl["makesOffer"]}
    n_rota = 0
    for hizmet, a, b in seo.ORNEK_ROTALAR:
        o = teklifler.get(f"{ALAN}/#offer-{a}-{b}")
        kontrol(o is not None, f"[{d}] teklif eksik: {a}->{b}")
        if o is None:
            continue
        km = km_bul(a, b)
        kontrol(km is not None, f"KESIN tabloda yok: {a}|{b}")
        kontrol(abs(o["price"] - bagimsiz_fiyat(km)) < 1e-9, f"[{d}] {a}->{b} fiyat {o['price']} != {bagimsiz_fiyat(km)}")
        kontrol(o["priceSpecification"]["price"] == o["price"] and o["priceCurrency"] == "EUR"
                and o["priceSpecification"]["priceCurrency"] == "EUR", f"[{d}] {a}->{b} priceSpecification")
        kontrol(f"{km} km" in o["description"], f"[{d}] {a}->{b} aciklamada km yok")
        kontrol(o["itemOffered"]["@type"] == "Service", f"[{d}] itemOffered")
        n_rota += 1
    kontrol(n_rota == len(seo.ORNEK_ROTALAR) >= 6, f"[{d}] en az 6 hesaplanmis ornek teklif olmali")
    for zorunlu in [("brussels", "bru"), ("brussels", "crl"), ("gent", "bru"), ("antwerpen", "bru"),
                    ("brussels", "ams"), ("brussels", "paris")]:
        kontrol(f"{ALAN}/#offer-{zorunlu[0]}-{zorunlu[1]}" in teklifler, f"[{d}] sartname ornek teklifi eksik: {zorunlu}")
    tarife = teklifler[ALAN + "/#offer-tarife"]
    fiyatlar = {(x["name"]): x["price"] for x in tarife["priceSpecification"]}
    kontrol(sorted(fiyatlar.values()) == [1.99, 10], f"[{d}] tarife: 10 + 1,99: {fiyatlar}")
    kontrol(any(x.get("unitCode") == "KMT" for x in tarife["priceSpecification"]), f"[{d}] km birimi KMT")
    # katalog: 4 hizmet, hepsi var olan @id'lere baglanir; 4 hizmet adi dile gore
    kat = isl["hasOfferCatalog"]["itemListElement"]
    kontrol([c["name"] for c in kat] == [birlesik[d][k] for k in
                                         ("ld_svc_airport", "ld_svc_intercity", "ld_svc_border", "ld_svc_return")],
            f"[{d}] katalog hizmet adlari")
    # ReserveAction
    pa = isl["potentialAction"]
    urller = [t["urlTemplate"] for t in pa["target"]]
    kontrol(pa["@type"] == "ReserveAction" and isletme["whatsapp"] in urller and sayfa_url + "#rezervasyon" in urller
            and pa["inLanguage"] == strings[d]["dil_hreflang"], f"[{d}] ReserveAction hedefleri")
    # FAQPage: gorunur SSS ile birebir
    cift = sss_ciftleri(d)
    kontrol([(q["name"], q["acceptedAnswer"]["text"]) for q in faq["mainEntity"]] == cift and len(cift) == 10,
            f"[{d}] FAQPage sorulari gorunur SSS ile birebir olmali")
    for q, a in cift:
        kontrol(esc_html(q) == q and esc_html(a) == a, f"[{d}] SSS metni HTML kacisi gerektiriyor: {q[:30]}")

# @id'ler 4 dil sayfasinda ayni (kimlik tutarliligi)
kontrol(len({frozenset(v) for v in tum_idler.values()}) == 1, "dil sayfalari arasinda sabit @id kumesi ayni olmali")

# ============================================================ D. yer tutucular ve build.py uyumu
print("— D. statik_doldur: build.py bicimi ile uyum, KESIN tablodan hesap")


def build_fonksiyonlari():
    """build.py'yi CALISTIRMADAN (ast) para_goster/para_tam kaynagini alir."""
    kaynak = (KAYNAK / "build.py").read_text(encoding="utf-8")
    agac = ast.parse(kaynak)
    ns = {}
    for n in agac.body:
        if isinstance(n, ast.FunctionDef) and n.name in ("para_goster", "para_tam"):
            exec(compile(ast.Module([n], []), "build.py", "exec"), ns)
    return ns


bf = build_fonksiyonlari()
kontrol("para_goster" in bf and "para_tam" in bf, "build.py para_goster/para_tam okunamadi")
for d in DILLER:
    for x in (10.0, 1.99, 0.5, 35.87, 99.55, 209.0, 636.85, 1234.5):
        kontrol(seo.para_goster(d, x) == bf["para_goster"](d, x), f"[{d}] para_goster({x}) build.py ile ayni degil")
        kontrol(seo.para_tam(d, x) == bf["para_tam"](d, x), f"[{d}] para_tam({x}) build.py ile ayni degil")
kontrol(seo.para_goster("fr", 10.0) == "10 €" and seo.para_goster("fr", 1.99) == "1,99 €"
        and seo.para_goster("en", 10.0) == "€10" and seo.para_goster("en", 1.99) == "€1.99"
        and seo.para_goster("tr", 1.99) == "1,99 €" and seo.para_goster("nl", 10.0) == "10 €", "para bicimleri")

for d in DILLER:
    m = "{base}|{perkm}|{pct}|{company}|{vat}|{company_email}|{year}|{price_bru}|{price_crl}|{km_bru}|{km_crl}|{price}|{deposit}"
    dolu = seo.statik_doldur(d, m, ctx).split("|")
    beklenen = [bf["para_goster"](d, 10.0), bf["para_goster"](d, 1.99), "20", isletme["unvan"], isletme["kdv"],
                isletme["eposta"], BUGUN[:4], bf["para_tam"](d, bagimsiz_fiyat(km_bul("brussels", "bru"))),
                bf["para_tam"](d, bagimsiz_fiyat(km_bul("brussels", "crl"))), str(km_bul("brussels", "bru")),
                str(km_bul("brussels", "crl")), "{price}", "{deposit}"]
    kontrol(dolu == beklenen, f"[{d}] statik_doldur: {dolu} != {beklenen}")
    a7 = seo.statik_doldur(d, birlesik[d]["faq7_a"], ctx)
    kontrol(bf["para_tam"](d, bagimsiz_fiyat(13)) in a7 and "13 km" in a7, f"[{d}] faq7 BRU fiyat/km KESIN tablodan")
    kontrol(bf["para_tam"](d, bagimsiz_fiyat(56)) in a7, f"[{d}] faq7 Gent->BRU fiyati")
    a8 = seo.statik_doldur(d, birlesik[d]["faq8_a"], ctx)
    kontrol(bf["para_tam"](d, bagimsiz_fiyat(55)) in a8 and "55 km" in a8, f"[{d}] faq8 CRL fiyat/km")
    a10 = seo.statik_doldur(d, birlesik[d]["faq10_a"], ctx)
    kontrol(bf["para_tam"](d, bagimsiz_fiyat(193)) in a10 and bf["para_tam"](d, bagimsiz_fiyat(315)) in a10,
            f"[{d}] faq10 Schiphol/Paris fiyatlari")
    kontrol(("20" in a7) and ("{" not in a7), f"[{d}] faq7 kapora yuzdesi ve kalinti")

# ============================================================ E. head eki ve geo
print("— E. head_ek: geo meta, gorsel boyutu, tekrar yok")
sablon = (KAYNAK / "template.html").read_text(encoding="utf-8")
mevcut_head = sablon[sablon.index("<head>"):sablon.index("</head>")]
mevcut_head += '<link rel="canonical"><link rel="alternate" hreflang="x">'   # build.py yer tutucularindan gelenler
TAG = re.compile(r'<(meta|link)\b[^>]*?(?:(name|property)="([^"]+)"|rel="([^"]+)")[^>]*>')


def etiket_anahtarlari(html):
    s = set()
    for m in TAG.finditer(html):
        s.add((m.group(1), m.group(3) or m.group(4)))
    return s


mevcut = etiket_anahtarlari(mevcut_head)
for d in DILLER:
    h = cikti["head"][d]
    yeni = etiket_anahtarlari(h)
    kontrol(not (yeni & mevcut), f"[{d}] head_ek mevcut head'de zaten olan etiketleri tekrarliyor: {sorted(yeni & mevcut)}")
    for yasak in ('rel="canonical"', "hreflang", 'property="og:title"', 'property="og:description"',
                  'property="og:url"', 'property="og:locale"', 'name="twitter:card"', 'name="twitter:title"',
                  'name="twitter:description"', 'name="theme-color"', 'name="color-scheme"', 'rel="icon"',
                  "<title>", 'name="description"', 'name="viewport"'):
        kontrol(yasak not in h, f"[{d}] head_ek '{yasak}' iceriyor (mevcut head'de var)")
    kontrol(h.count('property="og:image"') == 0 and h.count('name="twitter:image"') == 0,
            f"[{d}] og:image / twitter:image mevcut; head_ek yalniz alt/boyut eklemeli")
    kontrol(("meta", "robots") in yeni and ("link", "manifest") in yeni and ("link", "apple-touch-icon") in yeni,
            f"[{d}] robots/manifest/apple-touch-icon eksik")
    kontrol("max-image-preview:large" in h and "max-snippet:-1" in h and "max-video-preview:-1" in h,
            f"[{d}] robots yonergeleri")
    kontrol('<link rel="manifest" href="/manifest.webmanifest">' in h, f"[{d}] manifest linki")
    kontrol(f'href="{seo.APPLE_TOUCH_ICON}"' in h, f"[{d}] apple-touch-icon linki")
    kontrol('name="geo.region" content="BE-VBR"' in h and 'name="geo.placename" content="Zaventem"' in h,
            f"[{d}] geo.region/placename")
    m = re.search(r'name="geo.position" content="([^"]+)"', h)
    kontrol(m is not None and re.fullmatch(r"-?\d+(\.\d+)?;-?\d+(\.\d+)?", m.group(1)) is not None,
            f"[{d}] geo.position 'lat;lng' bicimi: {m and m.group(1)}")
    if m:
        lat, lng = (float(x) for x in m.group(1).split(";"))
        kontrol(49.49 <= lat <= 51.51 and 2.54 <= lng <= 6.41, f"[{d}] geo.position Belcika disinda: {lat};{lng}")
        kontrol((lat, lng) == seo.KOORDINAT, f"[{d}] geo.position seo.KOORDINAT ile ayni degil")
    mi = re.search(r'name="ICBM" content="([^"]+)"', h)
    kontrol(mi is not None and mi.group(1) == f"{seo.KOORDINAT[0]}, {seo.KOORDINAT[1]}", f"[{d}] ICBM bicimi")
    alt = re.findall(r'(?:og:image:alt|twitter:image:alt)" content="([^"]+)"', h)
    kontrol(len(alt) == 2 and alt[0] == alt[1] and len(alt[0]) >= 20, f"[{d}] og:image:alt + twitter:image:alt")
    kontrol(alt and alt[0] == birlesik[d]["og_image_alt"], f"[{d}] alt metni dile gore (seo-strings) olmali")
    gerek = jpeg_boyut(KAYNAK / "assets" / "og.jpg")
    w = re.search(r'og:image:width" content="(\d+)"', h)
    hh = re.search(r'og:image:height" content="(\d+)"', h)
    kontrol(w and hh and (int(w.group(1)), int(hh.group(1))) == gerek == (1200, 630),
            f"[{d}] og:image boyutu gercek dosyayla ayni olmali: {gerek}")
    kontrol('property="og:image:type" content="image/jpeg"' in h, f"[{d}] og:image:type")
    kontrol(len(h.encode("utf-8")) < 2200, f"[{d}] head_ek cok buyuk")
alt_metinleri = {cikti["head"][d].split('og:image:alt" content="')[1].split('"')[0] for d in DILLER}
kontrol(len(alt_metinleri) == 4, "og:image:alt 4 dilde farkli (yerellestirilmis) olmali")
kontrol(all(49.49 <= v <= 51.51 for v in (seo.KOORDINAT[0],)) and 2.54 <= seo.KOORDINAT[1] <= 6.41,
        "seo.KOORDINAT Belcika sinirlari icinde olmali")

# ============================================================ F. llms.txt / llms-full.txt
print("— F. llms.txt / llms-full.txt")
satirlar = LLMS.split("\n")
kontrol(satirlar[0].startswith("# ") and len(satirlar[0]) > 2, "llms.txt ilk satir '# Baslik' olmali")
kontrol(sum(1 for s in satirlar if s.startswith("# ")) == 1, "llms.txt tek H1 icermeli")
kontrol(satirlar[1] == "" and satirlar[2].startswith("> "), "llms.txt: H1'den sonra blockquote ozet gelmeli")
h2 = [s for s in satirlar if s.startswith("## ")]
kontrol(len(h2) >= 6, f"llms.txt H2 bolumleri: {h2}")
for zorunlu in ("Website", "Services", "Pricing", "Waiting time and cancellation", "Fleet", "Contact",
                "Frequently asked questions", "Optional"):
    kontrol(any(zorunlu in x for x in h2), f"llms.txt '{zorunlu}' bolumu eksik")
for d in DILLER:
    kontrol(ALAN + strings[d]["dil_yol"] in LLMS, f"llms.txt {d} URL'si eksik")
    kontrol(ALAN + strings[d]["dil_yol"] in LLMS_FULL, f"llms-full.txt {d} URL'si eksik")
for parca in ("€10", "€1.99", "per kilometre", isletme["telefon"], isletme["eposta"], isletme["adres"],
              isletme["kdv"], isletme["unvan"], isletme["whatsapp"], "24/7", f"Last updated: {BUGUN}",
              "60 minutes", "15 minutes", "€0.50", "24 hours", "Bancontact", "Apple Pay", "20%",
              "Tesla Model 3", "Mercedes Vito", ALAN + "/llms-full.txt", ALAN + "/sitemap.xml"):
    kontrol(parca in LLMS, f"llms.txt '{parca}' icermeli")
kontrol(len(LLMS.encode("utf-8")) <= 20 * 1024, f"llms.txt {len(LLMS.encode('utf-8'))} bayt > 20KB")
kontrol(len(LLMS_FULL.encode("utf-8")) <= 80 * 1024, f"llms-full.txt {len(LLMS_FULL.encode('utf-8'))} bayt > 80KB")
kontrol(len(LLMS_FULL.encode("utf-8")) > len(LLMS.encode("utf-8")), "llms-full llms'ten buyuk olmali")
# markdown baglantilari saglam
for ad, metin in (("llms.txt", LLMS), ("llms-full.txt", LLMS_FULL)):
    kontrol(len(re.findall(r"\[[^\]]+\]\(", metin)) == len(re.findall(r"\[[^\]]+\]\(https?://[^)\s]+\)", metin)),
            f"{ad}: bozuk markdown baglantisi")
    kontrol("{" not in metin and "}" not in metin, f"{ad}: cozulmemis yer tutucu")
    kontrol("{{" not in metin, f"{ad}: {{{{ }}}}")
    kontrol(not re.search(r"[ \t]+\n", metin), f"{ad}: satir sonunda bosluk")
# fiyat tablosu satirlari: formulle yeniden hesap
for ad, metin, dil in (("llms.txt", LLMS, "en"),):
    satirlar_t = [s for s in metin.split("\n") if s.startswith("| ") and " km |" in s]
    kontrol(len(satirlar_t) >= 8, f"{ad}: fiyat tablosu satiri {len(satirlar_t)}")
    for s in satirlar_t:
        hucre = [x.strip() for x in s.strip("|").split("|")]
        km = int(hucre[1].split()[0])
        beklenen = bagimsiz_fiyat(km)
        kontrol(hucre[2] == f"€{beklenen:,.2f}".replace(",", " "), f"{ad}: '{hucre[0]}' fiyat {hucre[2]} != {beklenen}")
        kapora = round(beklenen * 20 / 100 + 1e-9, 2)
        kontrol(hucre[3] == f"€{kapora:.2f}" and hucre[4] == f"€{round(beklenen - kapora, 2):.2f}",
                f"{ad}: '{hucre[0]}' kapora/kalan")
        a, b = [x.strip() for x in hucre[0].split("→")]
        anahtarlar = {yer["ad"]["en"]: k for k, yer in YERLER.items()}
        kontrol(km_bul(anahtarlar[a], anahtarlar[b]) == km, f"{ad}: '{hucre[0]}' km KESIN tabloyla ayni degil")
# llms-full: 4 dil blogu, her blokta 10 SSS sorusu
for d in DILLER:
    kontrol(f'## {strings[d]["dil_ad"]} ({strings[d]["dil_hreflang"]})' in LLMS_FULL, f"llms-full {d} blogu")
    for q, a in sss_ciftleri(d):
        kontrol(q in LLMS_FULL and a in LLMS_FULL, f"llms-full [{d}] SSS eksik: {q[:40]}")
    kontrol(strings[d]["hero_title"] in LLMS_FULL.replace("{pct}", "20"), f"llms-full [{d}] hero basligi")
    # bolge listesi
    z = cikti["zone"][d]
    kontrol(z["sehirler"][0]["ad"] in LLMS_FULL, f"llms-full [{d}] bolge verisi")

# ============================================================ G. robots.txt
print("— G. robots.txt")
gruplar, aktif, gecerli = [], None, True
for n, satir in enumerate(ROBOTS.split("\n"), 1):
    if not satir.strip() or satir.lstrip().startswith("#"):
        if not satir.strip():
            aktif = None if (aktif and aktif["kurallar"]) else aktif
        continue
    m = re.fullmatch(r"(User-agent|Allow|Disallow|Sitemap|Crawl-delay): (\S.*)", satir)
    kontrol(m is not None, f"robots.txt satir {n} sozdizimi gecersiz: {satir!r}")
    if not m:
        continue
    alan_adi, deger = m.groups()
    if alan_adi == "User-agent":
        if aktif is None or aktif["kurallar"]:
            aktif = {"ua": [], "kurallar": []}
            gruplar.append(aktif)
        aktif["ua"].append(deger)
    elif alan_adi in ("Allow", "Disallow"):
        kontrol(aktif is not None and aktif["ua"], f"robots.txt satir {n}: kural User-agent'siz")
        kontrol(deger.startswith("/"), f"robots.txt satir {n}: yol '/' ile baslamali")
        if aktif:
            aktif["kurallar"].append((alan_adi, deger))
kontrol(ROBOTS.endswith("\n"), "robots.txt satir sonuyla bitmeli")
yildiz = [g for g in gruplar if "*" in g["ua"]]
kontrol(len(yildiz) == 1, "tam bir 'User-agent: *' grubu olmali")
if yildiz:
    kontrol(("Allow", "/") in yildiz[0]["kurallar"], "* grubu Allow: / icermeli")
    kontrol(("Disallow", "/pay/") in yildiz[0]["kurallar"] and ("Disallow", "/api/") in yildiz[0]["kurallar"],
            "* grubu Disallow /pay/ ve /api/ icermeli")
adli = {ua for g in gruplar for ua in g["ua"]}
for bot in ("OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User", "Applebot",
            "Googlebot", "Bingbot"):
    g = [x for x in gruplar if bot in x["ua"]]
    kontrol(len(g) == 1 and ("Allow", "/") in g[0]["kurallar"], f"robots.txt {bot} icin acik Allow: / grubu eksik")
    kontrol(len(g) == 1 and ("Disallow", "/pay/") in g[0]["kurallar"] and ("Disallow", "/api/") in g[0]["kurallar"],
            f"robots.txt {bot} grubu /pay/ ve /api/ yi de engellemeli (adli grup * grubunu gecersiz kilar)")
    kontrol(len(g) == 1 and ("Disallow", "/") not in g[0]["kurallar"], f"{bot} tum siteyi engelliyor")
kontrol(all(("Disallow", "/") not in g["kurallar"] for g in gruplar), "aktif 'Disallow: /' (tum siteyi engelle) YOK olmali")
# egitim botlari: karar yorumu, varsayilan izinli (aktif satir yok, yorumda engelleme talimati var)
for bot in ("GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot"):
    kontrol(bot not in adli, f"{bot} varsayilan olarak izinli (aktif grup olmamali)")
    kontrol(f"# User-agent: {bot}" in ROBOTS, f"{bot} icin yorum satirinda engelleme ornegi olmali")
kontrol("KARAR" in ROBOTS and "IZINLI" in ROBOTS, "egitim botlari karar yorumu")
kontrol(re.search(rf"^Sitemap: {re.escape(ALAN)}/sitemap.xml$", ROBOTS, re.M) is not None, "Sitemap satiri mutlak URL")
kontrol("Disallow: /fr" not in ROBOTS and "Disallow: /assets" not in ROBOTS, "dil sayfalari/varliklar engellenmemeli")
kontrol("Disallow: /pay/" in ROBOTS, "test_adim4: Disallow: /pay/")

# ============================================================ H. security.txt
print("— H. security.txt (RFC 9116)")
alanlar = {}
for satir in SECURITY.strip().split("\n"):
    if satir.startswith("#"):
        continue
    m = re.fullmatch(r"([A-Za-z-]+): (.+)", satir)
    kontrol(m is not None, f"security.txt satir sozdizimi: {satir!r}")
    if m:
        alanlar.setdefault(m.group(1), []).append(m.group(2))
kontrol(alanlar.get("Contact") == [f"mailto:{isletme['eposta']}"], "security.txt Contact mailto olmali")
kontrol(len(alanlar.get("Expires", [])) == 1, "security.txt tek Expires")
try:
    bitis = datetime.datetime.strptime(alanlar["Expires"][0], "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=datetime.timezone.utc)
    simdi = datetime.datetime.fromisoformat(BUGUN).replace(tzinfo=datetime.timezone.utc)
    kontrol(bitis > simdi, "Expires gelecekte olmali")
    kontrol((bitis - simdi).days <= 366, f"Expires en cok 1 yil sonra olmali: {(bitis - simdi).days} gun")
    kontrol((bitis - simdi).days >= 300, "Expires anlamli olcude ileride olmali")
except (ValueError, KeyError) as e:
    kontrol(False, f"security.txt Expires cozulemedi: {e}")
kontrol(alanlar.get("Canonical") == [ALAN + "/.well-known/security.txt"], "security.txt Canonical")
kontrol(alanlar.get("Preferred-Languages") == ["fr, nl, en, tr"], "security.txt Preferred-Languages")
kontrol("Policy" not in alanlar, "security.txt Policy alani olmamali")
kontrol(SECURITY.endswith("\n"), "security.txt satir sonuyla bitmeli")

# ============================================================ I. manifest + ikonlar
print("— I. manifest.webmanifest + PNG ikonlar")
json.loads(json.dumps(MANIFEST))
kontrol(seo.manifest_json(ctx).endswith("\n") and json.loads(seo.manifest_json(ctx)) == MANIFEST, "manifest_json gecerli")
for k, v in (("name", "europetaxi24"), ("short_name", "europetaxi24"), ("start_url", "/"), ("scope", "/"),
             ("background_color", "#0A0A0C"), ("theme_color", "#0A0A0C"), ("lang", "fr-BE"), ("id", "/")):
    kontrol(MANIFEST.get(k) == v, f"manifest.{k} = {MANIFEST.get(k)!r}, beklenen {v!r}")
kontrol(MANIFEST["display"] in ("minimal-ui", "standalone", "browser"), "manifest.display")
kontrol(len(MANIFEST["short_name"]) <= 12, "short_name <= 12 karakter")
kontrol(1 <= len(MANIFEST["description"]) <= 160, "manifest.description")
kontrol(seo.manifest(ctx, "tr")["lang"] == "tr" and seo.manifest(ctx, "nl")["lang"] == "nl-BE",
        "manifest(ctx, dil) dil secebilmeli")
purposeler = set()
for ik in MANIFEST["icons"]:
    yol = KAYNAK / ik["src"].lstrip("/")
    kontrol(ik["src"].startswith("/assets/icons/") and yol.exists(), f"manifest ikonu dosyada yok: {ik['src']}")
    if not yol.exists():
        continue
    w, h, piksel = png_oku(yol)
    beyan = tuple(int(x) for x in ik["sizes"].split("x"))
    kontrol((w, h) == beyan, f"{ik['src']} beyan {beyan} ama PNG {w}x{h}")
    kontrol(ik["type"] == "image/png", f"{ik['src']} type")
    purposeler.add(ik["purpose"])
    def amber(rgb):
        return abs(rgb[0] - 247) < 20 and abs(rgb[1] - 179) < 25 and rgb[2] < 80

    def murekkep(rgb):
        return rgb[0] < 40 and rgb[1] < 40 and rgb[2] < 40
    koseler = [piksel(0, 0), piksel(w - 1, h - 1), piksel(w - 1, 0)]
    if ik["purpose"] == "maskable":
        kontrol(all(amber(k) for k in koseler), f"{ik['src']} maskable: tam kare amber zemin olmali: {koseler}")
    else:   # 'any': yuvarlatilmis amber kare; kose saydam (siyah okunur) ya da amber
        kontrol(all(amber(k) or k == (0, 0, 0) for k in koseler), f"{ik['src']} kose pikselleri saydam/amber olmali: {koseler}")
    orta = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if amber(piksel(x, y))]
    kontrol(len(orta) >= (w * h / 4) * 0.30, f"{ik['src']} amber zemin az: {len(orta)}")
    murek = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if murekkep(piksel(x, y))]
    kontrol(len(murek) >= (w * h / 4) * 0.04, f"{ik['src']} murekkep isaret yok/az: {len(murek)}")
    if ik["purpose"] == "maskable":
        # maskable guvenli bolge: merkez daire capi %80 disinda MUREKKEP isaret piksel olmamali
        merkez, yaricap = w / 2, w * 0.40
        disarida = [1 for (x, y) in murek if ((x - merkez) ** 2 + (y - merkez) ** 2) ** 0.5 > yaricap]
        kontrol(not disarida, f"{ik['src']} maskable guvenli bolge disina tasan isaret piksel: {len(disarida)}")
kontrol({"any", "maskable"} <= purposeler, "manifest 'any' ve 'maskable' ikon icermeli")
kontrol(any(ik["sizes"] == "192x192" for ik in MANIFEST["icons"]) and
        any(ik["sizes"] == "512x512" and ik["purpose"] == "any" for ik in MANIFEST["icons"]), "192 ve 512 ikon")
apple = KAYNAK / seo.APPLE_TOUCH_ICON.lstrip("/")
kontrol(apple.exists(), "apple-touch-icon dosyasi yok")
if apple.exists():
    w, h, piksel = png_oku(apple)
    k0 = piksel(0, 0)
    kontrol((w, h) == (180, 180) and abs(k0[0] - 247) < 20 and abs(k0[1] - 179) < 25, f"apple-touch-icon 180x180 ve amber zemin: {w}x{h} {k0}")

# ============================================================ J. sitemap
print("— J. sitemap.xml (test_adim4 kosullari + image)")
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9", "xhtml": "http://www.w3.org/1999/xhtml",
      "image": "http://www.google.com/schemas/sitemap-image/1.1"}
try:
    kok = ET.fromstring(SITEMAP.encode("utf-8"))
    urller = kok.findall("sm:url", NS)
    kontrol(len(urller) == 4, f"sitemap 4 URL icermeli, {len(urller)} var")
    beklenen_locler = {f"{ALAN}/{d}/" for d in ["fr", "nl", "en", "tr"]}
    bulunan = set()
    for u in urller:
        loc = u.find("sm:loc", NS).text
        bulunan.add(loc)
        kontrol(loc.startswith("https://"), f"loc mutlak URL olmali: {loc}")
        altlar = u.findall("xhtml:link", NS)
        kontrol(len(altlar) == 5, f"{loc}: 5 xhtml:link olmali, {len(altlar)} var")
        hl = {a.get("hreflang"): a.get("href") for a in altlar}
        kontrol(set(hl) == {"fr-BE", "nl-BE", "en", "tr", "x-default"}, f"{loc}: hreflang kumesi: {sorted(hl)}")
        kontrol(hl.get("x-default") == f"{ALAN}/fr/", f"{loc}: x-default /fr/ olmali")
        kontrol(loc in hl.values(), f"{loc}: kendine referansli alternate olmali")
        for href in hl.values():
            kontrol(href.startswith("https://"), f"{loc}: alternate mutlak URL olmali: {href}")
        kontrol(all(a.get("rel") == "alternate" for a in altlar), f"{loc}: rel=alternate")
        lm = u.find("sm:lastmod", NS)
        kontrol(lm is not None and lm.text == BUGUN, f"{loc}: lastmod eksik/yanlis")
        gorseller = u.findall("image:image", NS)
        kontrol(len(gorseller) == 1 and gorseller[0].find("image:loc", NS).text == ALAN + "/assets/og.jpg",
                f"{loc}: image:image og.jpg olmali")
    kontrol(bulunan == beklenen_locler, f"sitemap loc kumesi yanlis: {sorted(bulunan)}")
    kontrol("/pay/" not in SITEMAP, "sitemap /pay/ icermemeli")
    kontrol('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' in SITEMAP, "xmlns:image tanimli olmali")
    kontrol(SITEMAP.startswith('<?xml version="1.0" encoding="UTF-8"?>'), "XML bildirimi")
    ET.ElementTree(kok)   # test_adim4 ET.parse ile ayni sonuc
    ctx_lm = dict(ctx, lastmod="2026-01-02")
    kontrol("<lastmod>2026-01-02</lastmod>" in seo.sitemap_xml(ctx_lm), "ctx['lastmod'] destegi")
except ET.ParseError as e:
    kontrol(False, f"sitemap XML gecersiz: {e}")

# ============================================================ K. zone_data
print("— K. zone_data (gorunur 'Hizmet bolgeleri' verisi)")
kontrol(set(veri["yerler"]) >= set(seo.YER_ULKE), "YER_ULKE tabloda olmayan anahtar iceriyor: "
        + str(sorted(set(seo.YER_ULKE) - set(veri["yerler"]))))
for anahtar, yer in YERLER.items():
    if anahtar not in seo.YER_ULKE:   # Belcika varsayimi: sinir kutusunda olmali
        kontrol(49.49 <= yer["lat"] <= 51.51 and 2.54 <= yer["lng"] <= 6.41,
                f"'{anahtar}' YER_ULKE'de yok ama Belcika kutusu disinda")
    else:
        kontrol(seo.YER_ULKE[anahtar] in ("NL", "FR", "DE", "LU"), f"{anahtar} ulke kodu")
for d in DILLER:
    z = cikti["zone"][d]
    kontrol(set(z) == {"havalimanlari", "sehirler", "sinir_otesi"}, f"[{d}] zone_data anahtarlari")
    for bolum, liste in z.items():
        kontrol(len(liste) >= 5, f"[{d}] {bolum} en az 5 oge icermeli ({len(liste)})")
        for o in liste:
            kontrol(o["alis_anahtar"] == "brussels" and o["varis_anahtar"] in YERLER, f"[{d}] {o}")
            km = km_bul("brussels", o["varis_anahtar"])
            kontrol(o["km"] == km, f"[{d}] {o['ad']} km {o['km']} != KESIN {km}")
            kontrol(abs(o["fiyat"] - bagimsiz_fiyat(km)) < 1e-9, f"[{d}] {o['ad']} fiyat")
            kontrol(o["fiyat_metin"] == bf["para_tam"](d, bagimsiz_fiyat(km)), f"[{d}] {o['ad']} fiyat_metin")
            kontrol(o["ad"] == YERLER[o["varis_anahtar"]]["ad"][d], f"[{d}] ad dile gore olmali: {o['ad']}")
            kontrol(o["ulke"] == seo.ulke_kodu(o["varis_anahtar"]), f"[{d}] ulke {o['ad']}")
    kontrol(all("iata" in o and re.fullmatch(r"[A-Z]{3}", o["iata"]) and YERLER[o["varis_anahtar"]]["havalimani"]
                for o in z["havalimanlari"]), f"[{d}] havalimanlari iata")
    kontrol({o["varis_anahtar"]: o["iata"] for o in z["havalimanlari"]}.get("orly") == "ORY", f"[{d}] Orly IATA = ORY")
    kontrol(all(o["ulke"] == "BE" and not YERLER[o["varis_anahtar"]]["havalimani"] for o in z["sehirler"]),
            f"[{d}] sehirler yalniz Belcika sehirleri")
    kontrol(all(o["ulke"] != "BE" and not YERLER[o["varis_anahtar"]]["havalimani"] for o in z["sinir_otesi"]),
            f"[{d}] sinir_otesi yalniz yurt disi sehirleri")
    kontrol([o["km"] for o in z["havalimanlari"]] == sorted(o["km"] for o in z["havalimanlari"]), f"[{d}] havalimanlari km sirali")
    kontrol({o["iata"] for o in z["havalimanlari"]} >= {"BRU", "CRL", "AMS", "CDG"}, f"[{d}] BRU/CRL/AMS/CDG")
    kontrol("Gent" in [o["ad"] for o in cikti["zone"]["nl"]["sehirler"]], "NL sehirler: Gent")
kontrol(cikti["zone"]["fr"]["sehirler"] != cikti["zone"]["nl"]["sehirler"], "sehir adlari dile gore degismeli")
kontrol("Gand" in [o["ad"] for o in cikti["zone"]["fr"]["sehirler"]] and
        "Ghent" in [o["ad"] for o in cikti["zone"]["en"]["sehirler"]], "FR Gand, EN Ghent")

# ============================================================ L. yasak icerik taramasi (tum ciktilar)
print("— L. yasak icerik: yonetici adi, em dash, dogrulanamaz iddialar")
IDDIA = [
    (r"\b\d+\s*\+?\s*(years?|ans|jaar|jaren|yıl|yıllık)\b", "yillik deneyim iddiasi"),
    (r"meet\s*(and|&|et|en|ve)\s*greet|welcome sign|name ?board|naambord|panneau d'accueil|karşılama tabela",
     "karsilama tabelasi / meet&greet"),
    (r"award|prix décerné|onderscheiding|ödül|awarded", "odul iddiasi"),
    (r"\b(5|4\.\d)\s*(stars?|étoiles|sterren|yıldız)|trustpilot|tripadvisor|google reviews|customer reviews",
     "puan/yorum iddiasi"),
    (r"(speaks?|spreken|parlent|konuşan|bilen)\s+(french|dutch|english|turkish|frans|nederlands|engels|turks)",
     "dil bilen sofor iddiasi"),
    (r"facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com/|tiktok\.com|youtube\.com", "sosyal medya adresi"),
]
for ad, metin in HAVUZ.items():
    kontrol(not re.search(r"necatican|ceylan", metin, re.I), f"'necatican|ceylan' {ad} icinde geciyor")
    kontrol("—" not in metin, f"{ad}: uzun tire (em dash)")
    for desen, ne in IDDIA:
        m = re.search(desen, metin, re.I)
        kontrol(m is None, f"{ad}: dogrulanamaz iddia ({ne}): {m and m.group(0)}")
    kontrol("NaN" not in metin and "None" not in metin and "undefined" not in metin, f"{ad}: NaN/None/undefined")
kontrol("necatican" not in json.dumps(veri).lower() and "ceylan" not in json.dumps(isletme).lower(),
        "kaynak veride yonetici adi olmamali")

# ============================================================ M. dagitim uyarilari (bilgi; hata degil)
print("— M. dagitim: kok.htaccess ve template uyumu (uyari)")
ht = (KAYNAK / "kok.htaccess").read_text(encoding="utf-8")


def fr_yonlendirmesi_tetiklenir(uri):
    """kok.htaccess'teki '/fr/'ye 301' kuralinin RewriteCond zincirini (yalniz %{REQUEST_URI}) simule eder."""
    satirlar = ht.splitlines()
    for i, satir in enumerate(satirlar):
        if satir.strip().startswith("RewriteRule ^ /fr/"):
            j, kosullar = i - 1, []
            while j >= 0 and satirlar[j].strip().startswith("RewriteCond"):
                kosullar.append(satirlar[j].strip())
                j -= 1
            for k in kosullar:
                m = re.match(r"RewriteCond %\{REQUEST_URI\} (!?)(\S+)", k)
                if not m:
                    continue
                eslesir = re.search(m.group(2), uri) is not None
                if eslesir == (m.group(1) == "!"):   # kosul saglanmadi -> kural tetiklenmez
                    return False
            return True
    return False


for uri in ("/fr/", "/nl/", "/assets/og.jpg", "/robots.txt", "/sitemap.xml"):
    kontrol(not fr_yonlendirmesi_tetiklenir(uri), f"kok.htaccess simulasyonu: {uri} /fr/'ye yonlenmemeli (mevcut davranis bozuldu)")
kontrol(fr_yonlendirmesi_tetiklenir("/bilinmeyen-sayfa"), "kok.htaccess simulasyonu: dil oneksiz bilinmeyen yol /fr/'ye yonlenmeli")
for uri in ("/llms.txt", "/llms-full.txt", "/manifest.webmanifest", "/.well-known/security.txt"):
    if fr_yonlendirmesi_tetiklenir(uri):
        uyar(f"kok.htaccess '{uri}' adresini /fr/'ye 301 ile yonlendirir: RewriteCond istisnasi ekleyin (SEO-NOTLARI.md)")
if "AddType application/manifest+json" not in ht:
    uyar("kok.htaccess .webmanifest MIME tipi (application/manifest+json) tanimlamiyor (SEO-NOTLARI.md)")
if "{{faq7_q}}" not in sablon:
    uyar("template.html faq7..faq10 ve 'Hizmet bolgeleri' bolumunu henuz icermiyor (SEO-NOTLARI.md, TEMPLATE onerisi)")
if "seo" not in (KAYNAK / "build.py").read_text(encoding="utf-8"):
    uyar("build.py henuz seo.py'yi cagirmiyor (SEO-NOTLARI.md, BUILD.PY ENTEGRASYON YAMASI)")

print()
for u in uyarilar:
    print("   ! UYARI:", u)
if hatalar:
    print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
    for x in hatalar:
        print("   -", x)
    sys.exit(1)
print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
