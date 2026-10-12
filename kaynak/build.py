# -*- coding: utf-8 -*-
"""
EUROPETAXI24 derleyicisi.
Kullanim: python3 kaynak/build.py
Girdi : kaynak/template.html + strings.json + mesafe-verisi.json + isletme.json + assets/ + pay/
Cikti : www/ (hosting'e yuklenen klasor)

Kurallar (sartname):
- 4 dilde birebir ayni anahtar seti; cozulmemis {{yer_tutucu}} kalirsa derleme HATA verir.
- Fiyat sabitleri template.html (JS) ve pay/create.php arasinda birebir ayni olmali;
  uyusmazsa derleme HATA verir.
- Cikti minify EDILMEZ (musteri dosya yoneticisinden duzenleyebilmeli).
"""
import datetime
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path

KAYNAK = Path(__file__).resolve().parent
KOK = KAYNAK.parent
WWW = KOK / "www"
DILLER = ["fr", "nl", "en", "tr"]


def hata(mesaj):
    print(f"HATA: {mesaj}")
    sys.exit(1)


# ---------------------------------------------------------------- veri yukle
strings = json.loads((KAYNAK / "strings.json").read_text(encoding="utf-8"))
veri = json.loads((KAYNAK / "mesafe-verisi.json").read_text(encoding="utf-8"))
isletme = json.loads((KAYNAK / "isletme.json").read_text(encoding="utf-8"))
sablon = (KAYNAK / "template.html").read_text(encoding="utf-8")
# Tum istemci JS'i assets/app.js icinde (satir ici JS yok); fiyat sabitleri oradan okunur
app_js = (KAYNAK / "assets" / "app.js").read_text(encoding="utf-8")
SABIT = veri["sabitler"]
YERLER = veri["yerler"]
ALAN = isletme["alan_adi"].rstrip("/")

# ---------------------------------------------------------------- SEO/GEO katmani (kaynak/seo.py)
# seo-strings.json, strings[dil] uzerine BIRLESTIRILIR (ayni anahtar varsa seo-strings kazanir).
sys.path.insert(0, str(KAYNAK))
import seo  # noqa: E402
_seo_strings = json.loads((KAYNAK / "seo-strings.json").read_text(encoding="utf-8"))
for _d in DILLER:
    strings[_d].update(_seo_strings[_d])

# ---------------------------------------------------------------- anahtar denetimi
referans = set(strings["fr"].keys())
for dil in DILLER:
    if set(strings[dil].keys()) != referans:
        eksik = referans - set(strings[dil].keys())
        fazla = set(strings[dil].keys()) - referans
        hata(f"strings.json [{dil}] anahtar seti farkli (eksik: {sorted(eksik)}, fazla: {sorted(fazla)})")

# ---------------------------------------------------------------- sabit esitligi
def js_sabitleri_oku(metin):
    """assets/app.js icindeki SABIT blogundan degerleri ceker."""
    desen = {
        "acilis_ucreti": r"ACILIS:\s*([\d.]+)",
        "km_ucreti": r"KM_UCRET:\s*([\d.]+)",
        "kapora_yuzde": r"KAPORA_YUZDE:\s*([\d.]+)",
        "yol_katsayisi": r"YOL_KATSAYI:\s*([\d.]+)",
        "min_km": r"MIN_KM:\s*([\d.]+)",
        "max_km": r"MAX_KM:\s*([\d.]+)",
        "ort_hiz_kmh": r"ORT_HIZ:\s*([\d.]+)",
    }
    sonuc = {}
    for ad, d in desen.items():
        e = re.search(d, metin)
        if not e:
            hata(f"assets/app.js icinde fiyat sabiti bulunamadi: {ad}")
        sonuc[ad] = float(e.group(1))
    return sonuc


js_sabit = js_sabitleri_oku(app_js)
for ad, deger in js_sabit.items():
    if abs(deger - float(SABIT[ad])) > 1e-9:
        hata(f"Fiyat sabiti uyusmuyor: app.js {ad}={deger}, mesafe-verisi.json {ad}={SABIT[ad]}")

create_php = KAYNAK / "pay" / "create.php"
if create_php.exists():
    php = create_php.read_text(encoding="utf-8")
    php_desen = {
        "acilis_ucreti": r"ACILIS_UCRETI\W+([\d.]+)",
        "km_ucreti": r"KM_UCRETI\W+([\d.]+)",
        "kapora_yuzde": r"KAPORA_YUZDE\W+([\d.]+)",
        "min_km": r"MIN_KM\W+([\d.]+)",
        "max_km": r"MAX_KM\W+([\d.]+)",
    }
    for ad, d in php_desen.items():
        e = re.search(d, php)
        if not e:
            hata(f"pay/create.php icinde fiyat sabiti bulunamadi: {ad}")
        if abs(float(e.group(1)) - float(SABIT[ad])) > 1e-9:
            hata(f"Fiyat sabiti uyusmuyor: create.php {ad}={e.group(1)}, beklenen {SABIT[ad]}")
    print("✓ Fiyat sabitleri esit: app.js = create.php")
else:
    print("! pay/create.php henuz yok — sabit esitligi kontrolu PHP katmani eklenince tamamlanacak")

# ---------------------------------------------------------------- yardimcilar
def normalize(s):
    """test_adim1.py ve template.html JS'i ile birebir ayni kurallar."""
    s = s.lower()
    s = s.replace("ı", "i").replace("ß", "ss").replace("œ", "oe").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def esc(s):
    """HTML metin baglami icin kacis."""
    # cift tirnak da kacislanir: {{...}} degerleri nitelik icine de girer (placeholder="...", content="...");
    # strings.json'a tirnakli bir metin girilirse HTML/nitelik kirilmasin
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def para_goster(dil, deger):
    """Statik metinlerdeki tutar bicimi ({base}, {perkm})."""
    if dil == "en":
        s = f"{deger:.2f}".rstrip("0").rstrip(".")
        return f"€{s}"
    s = f"{deger:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{s} €"


def fiyat_hesapla(km):
    toplam = round(SABIT["acilis_ucreti"] + km * SABIT["km_ucreti"] + 1e-9, 2)
    kapora = round(toplam * SABIT["kapora_yuzde"] / 100 + 1e-9, 2)
    return toplam, kapora, round(toplam - kapora, 2)


def para_tam(dil, deger):
    """Tam tutar bicimi (chip fiyatlari): 99,55 € / €99.55"""
    if dil == "en":
        return f"€{deger:,.2f}".replace(",", " ")
    return f"{deger:.2f}".replace(".", ",") + " €"


YIL = str(datetime.date.today().year)

# Statik yer tutucular: derlemede cozulur. Calisma zamani olanlar ({deposit},
# {rest}, {price}, {ref}, {name}, {from}, {to}, {date}, {time}, {pax}, {big},
# {small}, {vehicle}, {phone -> sadece em_outro/wa}) JS/PHP'ye birakilir.
def statik_doldur(dil, metin):
    # seo.statik_doldur: {base} {perkm} {pct} {company} {vat} {email} {year} + {km_*}/{price_*}
    return seo.statik_doldur(dil, metin, SEO_CTX)


KESIN_SOZLUK = {}
for a, b, km in veri["kesin"]:
    KESIN_SOZLUK[f"{a}|{b}"] = km

BUGUN = datetime.date.today().isoformat()
SEO_CTX = dict(strings=strings, veri=veri, isletme=isletme, alan=ALAN, diller=DILLER,
               bugun=BUGUN, fiyat=fiyat_hesapla, kesin=KESIN_SOZLUK)

# ---------------------------------------------------------------- www hazirla
for parca in ["fr", "nl", "en", "tr", "assets"]:
    hedef = WWW / parca
    if hedef.exists():
        shutil.rmtree(hedef)
WWW.mkdir(exist_ok=True)
# fonts/fonts.css yalniz kaynak: @font-face bloklari site.css'in basina gomulu (yayina gitmez)
shutil.copytree(KAYNAK / "assets", WWW / "assets", ignore=shutil.ignore_patterns("fonts.css"))
# pay/ katmani kopyalanir; siparis kayitlari ve loglar TASINMAZ (orders/.htaccess kalir)
if (KAYNAK / "pay").exists():
    if (WWW / "pay").exists():
        shutil.rmtree(WWW / "pay")
    shutil.copytree(KAYNAK / "pay", WWW / "pay",
                    ignore=shutil.ignore_patterns("ET-*.json", "*.log", "*.tmp", "STRINGS-ONERI.json", "__pycache__"))

    # PHP katmaninin ihtiyac duydugu metinler strings.json'dan uretilir
    # (tek kaynak kurali: metin degisikligi = strings.json + build.py)
    PHP_ANAHTARLARI = [
        "succ_paid_t", "succ_paid_d", "succ_pending_t", "succ_pending_d",
        "succ_fail_t", "succ_fail_d", "succ_ref", "succ_home", "succ_retry", "succ_wa",
        "em_subject", "em_heading", "em_intro", "em_ref", "em_route", "em_date",
        "em_return", "em_vehicle", "em_pax", "em_bags", "em_paid", "em_due",
        "em_cancel_t", "em_outro", "cancel_policy", "dt_join",
        "err_t", "err_pay", "err_km", "err_back",
        "val_route", "val_date", "val_name", "val_email", "val_phone",
        "veh_eco_name", "veh_eco_model", "veh_wagon_name", "veh_wagon_model",
        "veh_vip_name", "veh_vip_model",
        # sertlestirilmis PHP katmaninin ek metinleri (Node dil.json ile ayni kaynak)
        "val_cancel", "err_km_wa", "err_rate", "err_forbidden", "err_bad_request",
    ]

    def php_json_dosyasi(veri, aciklama):
        return ("<?php\n// " + aciklama + "\n"
                "// OTOMATIK URETILDI — elle duzenlemeyin; kaynak dosyayi degistirip build.py calistirin.\n"
                "return json_decode(<<<'VERI'\n"
                + json.dumps(veri, ensure_ascii=False, indent=1)
                + "\nVERI, true);\n")

    dil_verisi = {d: {k: statik_doldur(d, strings[d][k]) for k in PHP_ANAHTARLARI} for d in DILLER}
    (WWW / "pay" / "dil.php").write_text(
        php_json_dosyasi(dil_verisi, "4 dilli PHP metinleri (kaynak: strings.json)"), encoding="utf-8")
    (WWW / "pay" / "isletme.php").write_text(
        php_json_dosyasi({k: v for k, v in isletme.items() if not k.startswith("_")},
                         "Isletme sabitleri (kaynak: isletme.json)"), encoding="utf-8")

    # Sunucu tarafi km dogrulamasi icin dahili mesafe tablosu (pay/mesafe.php okur).
    # Bu dosya OLMAZSA Google anahtari da yoksa TUM rezervasyonlar 422+WhatsApp'a duser (fail-closed).
    from pay_veri import mesafe_json_yaz
    mesafe_json_yaz(WWW / "pay" / "mesafe.json", veri)

# ---------------------------------------------------------------- varlik surumleme
# site.css / app.js / kok.* icin dosya ADI sabit kalir; sayfalar ?v=<icerik hash'i> ile cagirir.
# Sunucu bu dosyalara 1 yil 'immutable' onbellek verir: icerik degisince hash degisir, adres degisir.
import hashlib
SURUM = {ad: hashlib.sha256((WWW / "assets" / ad).read_bytes()).hexdigest()[:10]
         for ad in ("site.css", "app.js", "kok.css", "kok.js")}
# fotograflar (assets/foto/*.webp): ad sabit, ?v=<hash> ile cagrilir (resim degisince onbellek yenilenir)
FOTO = {f.name: hashlib.sha256(f.read_bytes()).hexdigest()[:10] for f in sorted((WWW / "assets" / "foto").glob("*.webp"))} \
    if (WWW / "assets" / "foto").is_dir() else {}


def surumle(html):
    for ad, h in SURUM.items():
        html = html.replace(f'/assets/{ad}"', f'/assets/{ad}?v={h}"')
    for ad, h in FOTO.items():
        html = html.replace(f'/assets/foto/{ad}"', f'/assets/foto/{ad}?v={h}"')
    return html


# dizin listeleme kalkani: 'Options -Indexes' AllowOverride'a bagli (izin yoksa site 500 verir);
# bunun yerine her klasore noindex bir index.html konur.
for _alt in ("assets", "assets/fonts", "assets/icons", "assets/foto"):
    if (WWW / _alt).is_dir():
        (WWW / _alt / "index.html").write_text(
            '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>europetaxi24</title>\n',
            encoding="utf-8")

# ---------------------------------------------------------------- dil sayfalari
boyutlar = {}
for dil in DILLER:
    ham = strings[dil]
    s = {k: statik_doldur(dil, v) for k, v in ham.items()}

    canonical = ALAN + s["dil_yol"]

    # 5'li hreflang kumesi: 4 dil + x-default -> /fr/ (mutlak, kendine referansli)
    hreflang = []
    for d2 in DILLER:
        hreflang.append(f'<link rel="alternate" hreflang="{strings[d2]["dil_hreflang"]}" href="{ALAN}{strings[d2]["dil_yol"]}">')
    hreflang.append(f'<link rel="alternate" hreflang="x-default" href="{ALAN}/fr/">')

    og_alt = [f'<meta property="og:locale:alternate" content="{strings[d2]["dil_og_locale"]}">'
              for d2 in DILLER if d2 != dil]

    # JSON-LD 1: tek @graph (Organization + WebSite + TaxiService/LocalBusiness + WebPage)
    # JSON-LD 2: sayfada GORUNEN 10 SSS (faq1..faq10)
    jsonld_isletme = seo.jsonld_graph(dil, SEO_CTX)
    jsonld_faq = seo.jsonld_faq(dil, SEO_CTX, [(s[f"faq{i}_q"], s[f"faq{i}_a"]) for i in range(1, 11)])

    # h1: virgulden sonrasi amber vurgu (<em>)
    baslik = esc(s["hero_title"])
    if ", " in baslik:
        on, arka = baslik.split(", ", 1)
        hero_baslik = f"{on}, <em>{arka}</em>"
    else:
        hero_baslik = baslik

    # datalist: bu dilin gorunen adlari (havalimanlari once, sonra alfabetik)
    def sirala(oge):
        anahtar, yer = oge
        return (0 if yer["havalimani"] else 1, yer["ad"][dil])
    datalist = "".join(
        f'<option value="{esc(yer["ad"][dil])}"></option>'
        for _, yer in sorted(YERLER.items(), key=sirala)
    )

    def rota_km(a, b):
        km = seo._km_veya_none(SEO_CTX, a, b)
        if km is None:
            hata(f"rota km bulunamadi: {a}|{b}")
        return km

    def sure_metni(km):
        dk = round(km / SABIT["ort_hiz_kmh"] * 60)
        return f"{dk // 60} h {dk % 60:02d}" if dk >= 60 else f"{dk} min"

    # populer rota kartlari (yatay kaydirma; fiyat KESIN tablodan, "dès X")
    def foto_anahtari(a, b):
        """Kart gorseli: varis; varis Bruksel havalimani ise (baska sehirden gelen rota) alis sehri."""
        anahtar = a if (b == "bru" and a != "brussels") else b
        anahtar = {"ams": "amsterdam", "cdg": "paris", "orly": "paris", "cgn": "koln", "lux": "luxembourg"}.get(anahtar, anahtar)
        return anahtar if (KAYNAK / "assets" / "foto" / f"{anahtar}.webp").is_file() else None

    rota_kartlari = []
    for i, (a, b) in enumerate(veri["populer"]):
        km = rota_km(a, b)
        toplam, _, _ = fiyat_hesapla(km)
        rota_kartlari.append(
            f'<a class="chip dest-kart t{i % 4 + 1}{" foto" if foto_anahtari(a, b) else ""}" href="#rezervasyon" data-alis="{a}" data-varis="{b}">'
            + (f'<img class="dk-foto" src="/assets/foto/{foto_anahtari(a, b)}.webp" alt="" width="640" height="849" loading="lazy" decoding="async">'
               if foto_anahtari(a, b) else "")
            + (f'<span class="dk-yol">→ {esc(YERLER[b]["ad"][dil])}</span><b class="dk-ad">{esc(YERLER[a]["ad"][dil])}</b>'
               if (b == "bru" and a != "brussels") else
               f'<span class="dk-yol">{esc(YERLER[a]["ad"][dil])} →</span><b class="dk-ad">{esc(YERLER[b]["ad"][dil])}</b>') +
            f'<span class="dk-alt">{km} km</span>'
            f'<span class="dk-fiyat">{esc(s["zones_from"].replace("{price}", para_tam(dil, toplam)))}'
            f'<svg class="i" aria-hidden="true"><use href="#i-arrow"/></svg></span></a>'
        )

    # hizli baslat sekmeleri: hero'da tek dokunusla forma yuklenen ilk 4 populer rota
    hizli = []
    for a, b in veri["populer"][:4]:
        toplam, _, _ = fiyat_hesapla(rota_km(a, b))
        hizli.append(
            f'<button type="button" class="hizli-sekme" data-alis="{a}" data-varis="{b}" aria-pressed="false">'
            f'<span class="hs-yol"><span class="hs-nereden">{esc(YERLER[a]["ad"][dil])}</span>'
            f'<svg class="i" aria-hidden="true"><use href="#i-arrow"/></svg>'
            f'<span class="hs-nereye">{esc(YERLER[b]["ad"][dil])}</span></span>'
            f'<b class="hs-fiyat">{para_tam(dil, toplam)}</b></button>'
        )

    # hero/altbilgi ulke etiketleri (bayrak: saf CSS)
    ulke_chips = "".join(
        f'<li><i class="bayrak b-{k}" aria-hidden="true"></i>{esc(s["ulke_" + k])}</li>'
        for k in ("be", "nl", "lu", "fr", "de"))

    # "Nasil calisir" gorsel kartlari: gercek rota/fiyat KESIN tablodan
    km1 = rota_km("brussels", "bru")
    t1, k1, _ = fiyat_hesapla(km1)
    km3 = rota_km("brussels", "gent")
    nasil = {
        "NASIL_A": esc(YERLER["brussels"]["ad"][dil]), "NASIL_B": esc(YERLER["bru"]["ad"][dil]),
        "NASIL_KM": str(km1), "NASIL_SURE": sure_metni(km1),
        "NASIL_FIYAT": para_tam(dil, t1), "NASIL_KAPORA": para_tam(dil, k1),
        "NASIL_C": esc(YERLER["brussels"]["ad"][dil] + " → " + YERLER["gent"]["ad"][dil]),
        "NASIL_C_KM": str(km3), "NASIL_C_SURE": sure_metni(km3),
    }

    # arac kapasite (sayi + metin)
    arac_yer = {}
    for kod in ("eco", "wagon", "vip"):
        a = veri["araclar"][kod]
        arac_yer[f"PAX_{kod.upper()}"] = str(a["yolcu"])
        arac_yer[f"BAG_{kod.upper()}"] = f'{a["buyuk"]}+{a["kucuk"]}'

    def kapasite(kod):
        a = veri["araclar"][kod]
        return esc(s["veh_capacity"]
                   .replace("{pax}", str(a["yolcu"]))
                   .replace("{big}", str(a["buyuk"]))
                   .replace("{small}", str(a["kucuk"])))

    # JS'e gomulen mesafe verisi (bu dilin gorunen adlari + tum takma adlar)
    veri_js = {"yerler": {}, "kesin": KESIN_SOZLUK}
    for anahtar, yer in YERLER.items():
        takma = set(yer["takma"]) | {normalize(yer["ad"][d2]) for d2 in DILLER}
        veri_js["yerler"][anahtar] = {
            "a": yer["ad"][dil],
            "l": [yer["lat"], yer["lng"]],
            "h": yer["havalimani"],
            "t": sorted(t for t in takma if t),
        }

    # JS'e gomulen calisma zamani metinleri
    soz_anahtarlari = [
        "status_google", "status_fallback", "status_unknown", "status_waiting",
        "val_route", "val_price", "val_date", "val_cancel", "val_name", "val_email", "val_phone",
        "wa_title", "wa_mode_airport", "wa_route", "wa_date", "wa_return", "wa_pax",
        "wa_bags", "wa_vehicle", "wa_price", "wa_deposit", "wa_rest",
        "wa_name", "wa_phone", "wa_email", "airport_wa_msg", "paym_online_d", "dt_join",
    ]
    soz = {k: s[k] for k in soz_anahtarlari}
    soz["veh_eco"] = f'{s["veh_eco_name"]} ({s["veh_eco_model"]})'
    soz["veh_wagon"] = f'{s["veh_wagon_name"]} ({s["veh_wagon_model"]})'
    soz["veh_vip"] = f'{s["veh_vip_name"]} ({s["veh_vip_model"]})'

    def js_json(v):
        # </script> ve <!-- kacisini garantile (JSON bloklari HTML icinde gomulu)
        return json.dumps(v, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "<\\u0021--")

    # Sayfa basina veri blogu: app.js bunu JSON.parse eder (satir ici calistirilabilir JS yok)
    et_data = {"dil": s["dil_kod"], "wa": isletme["whatsapp"], "veri": veri_js, "soz": soz}

    def paragraflar(metin):
        return "".join(f"<p>{esc(p)}</p>" for p in metin.split("\n\n"))

    def bolgeler_html():
        """Gorunur 'Hizmet bolgeleri' bolumu: seo.zone_data -> liste satirlari (ilk 6 acik, kalani 'Voir tout')."""
        z = seo.zone_data(dil, SEO_CTX)

        def satir(o):
            fiyat_etiketi = s["zones_from"].replace("{price}", o["fiyat_metin"])
            return (f'<a class="chip sat" href="#rezervasyon" data-alis="{o["alis_anahtar"]}" '
                    f'data-varis="{o["varis_anahtar"]}"><span class="sat-ad"><b>{esc(o["ad"])}</b>'
                    f'<small>{esc(o["ulke_ad"])} · {o["km"]} km</small></span>'
                    f'<span class="sat-fiyat">{esc(fiyat_etiketi)}</span>'
                    f'<svg class="i" aria-hidden="true"><use href="#i-arrow"/></svg></a>')
        bloklar = []
        for baslik, anahtar in (("zones_airports_t", "havalimanlari"), ("zones_cities_t", "sehirler"),
                                ("zones_border_t", "sinir_otesi")):
            liste = z[anahtar]
            ilk, kalan = liste[:6], liste[6:]
            html = f'<h3 class="bolge-baslik">{esc(s[baslik])}</h3>\n<div class="satirlar">' + "".join(satir(o) for o in ilk)
            if kalan:
                html += ('<details class="plus"><summary>' + esc(s["view_all"].replace("{n}", str(len(liste))))
                         + '<svg class="i" aria-hidden="true"><use href="#i-chev"/></svg></summary><div class="satirlar">'
                         + "".join(satir(o) for o in kalan) + "</div></details>")
            html += "</div>"
            bloklar.append(html)
        return "\n    ".join(bloklar)

    # ---- yer tutuculari doldur ----
    sayfa = sablon
    ozel = {
        "CANONICAL": canonical,
        "HREFLANG_BLOKU": "\n".join(hreflang),
        "OG_LOCALE_ALT_BLOKU": "\n".join(og_alt),
        "JSONLD_ISLETME": js_json(jsonld_isletme),
        "JSONLD_FAQ": js_json(jsonld_faq),
        "HERO_BASLIK": hero_baslik,
        "DATALIST": datalist,
        "ROTA_KARTLARI": "\n      ".join(rota_kartlari),
        "ULKE_CHIPS": ulke_chips,
        "LOGO_SEMBOL": (KAYNAK / "logo-ic.svg").read_text(encoding="utf-8").strip(),
        "DIL_KOD_BUYUK": dil.upper(),
        **nasil,
        **arac_yer,
        "BOLGELER": bolgeler_html(),
        "KAP_ECO": kapasite("eco"),
        "KAP_WAGON": kapasite("wagon"),
        "KAP_VIP": kapasite("vip"),
        "PAYM_ONLINE_D_BOS": esc(s["paym_online_d"].replace("{deposit}", "—").replace("{rest}", "—")),
        "PRIVACY_PARAGRAFLAR": paragraflar(s["privacy_d"]),
        "TERMS_PARAGRAFLAR": paragraflar(s["terms_d"]),
        "FOOTER_RIGHTS": esc(s["footer_rights"]),
        "ET_DATA": js_json(et_data),
        "HIZLI_SEKMELER": "\n          ".join(hizli),
        "KM_UCRETI": para_goster(dil, SABIT["km_ucreti"]),
        "KM_UCRETI_SAYI": str(SABIT["km_ucreti"]),
        "HEAD_EK": "",   # SEO asamasi dolduracak (head sonu)
        "WHATSAPP": isletme["whatsapp"],
        "TELEFON": isletme["telefon"],
        "TEL_LINK": isletme["telefon_link"],
        "EPOSTA": isletme["eposta"],
        "UNVAN": isletme["unvan"],
        "KDV": isletme["kdv"],
        "ADRES": esc(isletme["adres"]),
        "ALAN_ADI": ALAN,
    }
    for d2 in DILLER:
        ozel[f"DIL_SECILI_{d2.upper()}"] = 'aria-current="true"' if d2 == dil else ""
    for anahtar, deger in ozel.items():
        sayfa = sayfa.replace("{{" + anahtar + "}}", deger)

    # dil metinleri: HTML baglaminda kacisli
    for anahtar, deger in s.items():
        sayfa = sayfa.replace("{{" + anahtar + "}}", esc(deger))

    # cozulmemis yer tutucu kaldi mi?
    kalan = re.findall(r"\{\{[A-Za-z_]+\}\}", sayfa)
    if kalan:
        hata(f"[{dil}] cozulmemis yer tutucular: {sorted(set(kalan))}")

    # SEO/GEO <head> eki (geo meta, og:image boyutu/alt, manifest, apple-touch-icon, robots yonergeleri)
    sayfa = sayfa.replace("</head>", seo.head_ek(dil, SEO_CTX) + "</head>", 1)

    hedef = WWW / dil
    hedef.mkdir(parents=True, exist_ok=True)
    sayfa = surumle(sayfa)
    (hedef / "index.html").write_text(sayfa, encoding="utf-8")
    boyutlar[dil] = len(sayfa.encode("utf-8"))

# ---------------------------------------------------------------- kok yonlendirme
# Sunucu tarafi IP/Accept-Language yonlendirmesi YASAK (sartname §3):
# sadece kokte, sadece tarayici JS'iyle, localStorage'la hatirlayarak.
dil_linkleri = "\n    ".join(
    f'<li><a href="{strings[d]["dil_yol"]}" hreflang="{strings[d]["dil_hreflang"]}">{strings[d]["dil_ad"]}</a></li>'
    for d in DILLER
)
# Kok sayfanin CSS ve JS'i harici dosyada (assets/kok.css, assets/kok.js):
# siki CSP (script-src 'self') altinda satir ici betik/stil calismaz.
kok_html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex,follow">
<title>europetaxi24</title>
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="stylesheet" href="/assets/kok.css">
<script src="/assets/kok.js"></script>
</head>
<body>
<div class="kutu">
  <h1>EUROPETAXI<span>24</span></h1>
  <ul>
    {dil_linkleri}
  </ul>
</div>
</body>
</html>
"""
(WWW / "index.html").write_text(surumle(kok_html), encoding="utf-8")

# 404: markali, noindex; Apache ErrorDocument ve Vercel bunu 404 durum koduyla sunar.
# (Bilinmeyen adresleri /fr/'ye 301'lemek 'yumusak 404'tur; taramayi ve SEO'yu bozar.)
nf_satirlari = "\n    ".join(f'<p class="nf-msg" lang="{strings[d]["dil_hreflang"]}">{esc(strings[d]["nf_msg"])}</p>' for d in DILLER)
yok404_html = kok_html.replace("<title>europetaxi24</title>", "<title>404 · europetaxi24</title>", 1)
yok404_html = yok404_html.replace('<script src="/assets/kok.js"></script>\n', "", 1)   # 404'te dil yonlendirmesi YOK
yok404_html = yok404_html.replace('<h1>EUROPETAXI<span>24</span></h1>',
                                  '<h1>EUROPETAXI<span>24</span></h1>\n  <div class="nf">' + nf_satirlari + '</div>', 1)
(WWW / "404.html").write_text(surumle(yok404_html), encoding="utf-8")

# ---------------------------------------------------------------- .htaccess + sitemap + robots
# Kok .htaccess kaynaktan kopyalanir (sartname §11)
_host = ALAN.split("://", 1)[-1].split("/")[0]
(WWW / ".htaccess").write_text(
    (KAYNAK / "kok.htaccess").read_text(encoding="utf-8").replace("%%HOST%%", _host), encoding="utf-8")

# sitemap.xml (4 URL x tam 5'li xhtml:link + lastmod + image:image), robots.txt, llms*.txt,
# manifest, security.txt: hepsi kaynak/seo.py'den (sartname §11: eksik hreflang kumesi grubu gecersiz kilar).
(WWW / "sitemap.xml").write_text(seo.sitemap_xml(SEO_CTX), encoding="utf-8")
(WWW / "robots.txt").write_text(seo.robots_txt(SEO_CTX), encoding="utf-8")
(WWW / "llms.txt").write_text(seo.llms_txt(SEO_CTX), encoding="utf-8")
(WWW / "llms-full.txt").write_text(seo.llms_full_txt(SEO_CTX), encoding="utf-8")
(WWW / "manifest.webmanifest").write_text(seo.manifest_json(SEO_CTX), encoding="utf-8")
(WWW / ".well-known").mkdir(exist_ok=True)
(WWW / ".well-known" / "security.txt").write_text(seo.security_txt(SEO_CTX), encoding="utf-8")

# ---------------------------------------------------------------- rapor
print("✓ Derleme tamam:")
for dil in DILLER:
    print(f"  www/{dil}/index.html  {boyutlar[dil]/1024:.1f} KB")
varlik_toplam = sum(f.stat().st_size for f in (WWW / "assets").rglob("*") if f.is_file())
print(f"  www/assets/           {varlik_toplam/1024:.1f} KB")
