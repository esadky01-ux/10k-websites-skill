# -*- coding: utf-8 -*-
"""
EUROPA TAXI derleyicisi.
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
SABIT = veri["sabitler"]
YERLER = veri["yerler"]
ALAN = isletme["alan_adi"].rstrip("/")

# ---------------------------------------------------------------- anahtar denetimi
referans = set(strings["fr"].keys())
for dil in DILLER:
    if set(strings[dil].keys()) != referans:
        eksik = referans - set(strings[dil].keys())
        fazla = set(strings[dil].keys()) - referans
        hata(f"strings.json [{dil}] anahtar seti farkli (eksik: {sorted(eksik)}, fazla: {sorted(fazla)})")

# ---------------------------------------------------------------- sabit esitligi
def js_sabitleri_oku(metin):
    """template.html icindeki SABIT blogundan degerleri ceker."""
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
            hata(f"template.html icinde fiyat sabiti bulunamadi: {ad}")
        sonuc[ad] = float(e.group(1))
    return sonuc


js_sabit = js_sabitleri_oku(sablon)
for ad, deger in js_sabit.items():
    if abs(deger - float(SABIT[ad])) > 1e-9:
        hata(f"Fiyat sabiti uyusmuyor: template.html {ad}={deger}, mesafe-verisi.json {ad}={SABIT[ad]}")

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
    print("✓ Fiyat sabitleri esit: template.html = create.php")
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
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


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
    degerler = {
        "base": para_goster(dil, SABIT["acilis_ucreti"]),
        "perkm": para_goster(dil, SABIT["km_ucreti"]),
        "pct": str(SABIT["kapora_yuzde"]),
        "company": isletme["unvan"],
        "vat": isletme["kdv"],
        "email": isletme["eposta"],
        "year": YIL,
    }
    for k, v in degerler.items():
        metin = metin.replace("{" + k + "}", v)
    return metin


KESIN_SOZLUK = {}
for a, b, km in veri["kesin"]:
    KESIN_SOZLUK[f"{a}|{b}"] = km

# ---------------------------------------------------------------- www hazirla
for parca in ["fr", "nl", "en", "tr", "assets"]:
    hedef = WWW / parca
    if hedef.exists():
        shutil.rmtree(hedef)
WWW.mkdir(exist_ok=True)
shutil.copytree(KAYNAK / "assets", WWW / "assets")
# pay/ katmani (varsa) kopyalanir; orders/ icerigi tasinmaz
if (KAYNAK / "pay").exists():
    if (WWW / "pay").exists():
        shutil.rmtree(WWW / "pay")
    shutil.copytree(KAYNAK / "pay", WWW / "pay",
                    ignore=shutil.ignore_patterns("orders", "*.log"))

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

    # JSON-LD 1: TaxiService + LocalBusiness (tek @id)
    jsonld_isletme = {
        "@context": "https://schema.org",
        "@type": ["TaxiService", "LocalBusiness"],
        "@id": ALAN + "/#isletme",
        "name": isletme["marka"],
        "legalName": isletme["unvan"],
        "vatID": isletme["kdv"],
        "slogan": isletme["slogan"],
        "url": canonical,
        "telephone": isletme["telefon"],
        "email": isletme["eposta"],
        "image": ALAN + "/assets/og.jpg",
        "logo": ALAN + "/assets/logo.svg",
        "priceRange": "€€",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Excelsiorlaan 31",
            "postalCode": "1930",
            "addressLocality": "Zaventem",
            "addressCountry": "BE",
        },
        "geo": {"@type": "GeoCoordinates", "latitude": 50.8845, "longitude": 4.4715},
        "openingHoursSpecification": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "opens": "00:00",
            "closes": "23:59",
        },
        "areaServed": [{"@type": "Country", "name": u} for u in ["BE", "DE", "FR", "LU", "NL"]],
        "makesOffer": [{
            "@type": "Offer",
            "name": s["mode_km"],
            "priceCurrency": "EUR",
            "priceSpecification": {
                "@type": "UnitPriceSpecification",
                "price": SABIT["km_ucreti"],
                "priceCurrency": "EUR",
                "unitCode": "KMT",
            },
        }, {
            "@type": "Offer",
            "name": s["mode_airport"],
            "priceCurrency": "EUR",
        }],
        "potentialAction": {
            "@type": "ReserveAction",
            "target": {"@type": "EntryPoint", "urlTemplate": isletme["whatsapp"]},
        },
    }

    # JSON-LD 2: sayfada GORUNEN 6 SSS
    jsonld_faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [{
            "@type": "Question",
            "name": s[f"faq{i}_q"],
            "acceptedAnswer": {"@type": "Answer", "text": s[f"faq{i}_a"]},
        } for i in range(1, 7)],
    }

    # h1: virgulden sonrasi altin vurgu
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

    # populer rota chip'leri (fiyat KESIN tablodan)
    chipler = []
    for a, b in veri["populer"]:
        km = KESIN_SOZLUK.get(f"{a}|{b}") or KESIN_SOZLUK.get(f"{b}|{a}")
        toplam, _, _ = fiyat_hesapla(km)
        chipler.append(
            f'<a class="chip" href="#rezervasyon" data-alis="{a}" data-varis="{b}">'
            f'<span>{esc(YERLER[a]["ad"][dil])}</span><span class="ok">→</span>'
            f'<span>{esc(YERLER[b]["ad"][dil])}</span><b>{para_tam(dil, toplam)}</b></a>'
        )

    # arac kapasite satirlari
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
        # </script> kacisini garantile
        return json.dumps(v, ensure_ascii=False).replace("</", "<\\/")

    def paragraflar(metin):
        return "".join(f"<p>{esc(p)}</p>" for p in metin.split("\n\n"))

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
        "ROTA_CHIPS": "\n      ".join(chipler),
        "KAP_ECO": kapasite("eco"),
        "KAP_WAGON": kapasite("wagon"),
        "KAP_VIP": kapasite("vip"),
        "PAYM_ONLINE_D_BOS": esc(s["paym_online_d"].replace("{deposit}", "—").replace("{rest}", "—")),
        "PRIVACY_PARAGRAFLAR": paragraflar(s["privacy_d"]),
        "TERMS_PARAGRAFLAR": paragraflar(s["terms_d"]),
        "FOOTER_RIGHTS": esc(s["footer_rights"]),
        "VERI_JS": js_json(veri_js),
        "SOZLUK_JS": js_json(soz),
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

    hedef = WWW / dil
    hedef.mkdir(parents=True, exist_ok=True)
    (hedef / "index.html").write_text(sayfa, encoding="utf-8")
    boyutlar[dil] = len(sayfa.encode("utf-8"))

# ---------------------------------------------------------------- kok yonlendirme
# Sunucu tarafi IP/Accept-Language yonlendirmesi YASAK (sartname §3):
# sadece kokte, sadece tarayici JS'iyle, localStorage'la hatirlayarak.
dil_linkleri = "\n    ".join(
    f'<li><a href="{strings[d]["dil_yol"]}" hreflang="{strings[d]["dil_hreflang"]}">{strings[d]["dil_ad"]}</a></li>'
    for d in DILLER
)
kok_html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex,follow">
<title>Europa Taxi</title>
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<style>
body{{background:#0A0A0C;color:#F4F4F6;font:400 16px/1.6 system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.kutu{{text-align:center;padding:24px}}
h1{{font-size:26px;letter-spacing:.5px}}h1 span{{color:#FFC107}}
ul{{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:10px}}
a{{display:block;padding:13px 40px;border:1px solid rgba(255,255,255,.18);border-radius:12px;
color:#F4F4F6;text-decoration:none;font-weight:600}}
a:hover{{border-color:#FFC107;color:#FFC107}}
</style>
<script>
/* Kok yonlendirme: once kayitli tercih, sonra tarayici dili, yoksa /fr/ */
(function(){{
  var diller = ["fr","nl","en","tr"], hedef = null;
  try {{ hedef = localStorage.getItem("europa_dil"); }} catch(e){{}}
  if (diller.indexOf(hedef) === -1) {{
    hedef = null;
    var tercihler = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < tercihler.length && !hedef; i++) {{
      var kod = String(tercihler[i]).slice(0, 2).toLowerCase();
      if (diller.indexOf(kod) !== -1) hedef = kod;
    }}
  }}
  location.replace("/" + (hedef || "fr") + "/");
}})();
</script>
</head>
<body>
<div class="kutu">
  <h1>EUROPA<span>TAXI</span></h1>
  <ul>
    {dil_linkleri}
  </ul>
</div>
</body>
</html>
"""
(WWW / "index.html").write_text(kok_html, encoding="utf-8")

# ---------------------------------------------------------------- rapor
print("✓ Derleme tamam:")
for dil in DILLER:
    print(f"  www/{dil}/index.html  {boyutlar[dil]/1024:.1f} KB")
varlik_toplam = sum(f.stat().st_size for f in (WWW / "assets").rglob("*") if f.is_file())
print(f"  www/assets/           {varlik_toplam/1024:.1f} KB")
