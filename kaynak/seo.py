# -*- coding: utf-8 -*-
"""
EUROPA TAXI - SEO / yerel SEO / GEO katmani.

Saf fonksiyonlar: dosyaya yazmaz, agdan bir sey cekmez, global durumu degistirmez.
Yalniz standart kutuphane. build.py bu modulu SONRADAN baglar (bkz. SEO-NOTLARI.md,
"BUILD.PY ENTEGRASYON YAMASI").

ctx sozlugu (build.py kurar):
    strings : {dil: {anahtar: metin}}  strings.json + seo-strings.json BIRLESMIS (seo-strings kazanir)
    veri    : mesafe-verisi.json
    isletme : isletme.json
    alan    : 'https://europetaxi24.be'
    diller  : ['fr', 'nl', 'en', 'tr']
    bugun   : 'YYYY-MM-DD'
    fiyat   : callable km -> (toplam, kapora, kalan)      (build.py fiyat_hesapla)
    kesin   : {'a|b': km}                                  (build.py KESIN_SOZLUK)
    lastmod : (istege bagli) sitemap lastmod; yoksa bugun

Iddia kurali: yalniz sartnamedeki dogrulanabilir bilgiler. aggregateRating, review, sameAs,
award, foundingDate, numberOfEmployees, "X yillik deneyim", karsilama tabelasi vb. YOKTUR.
"""
import datetime
import json
import re
from urllib.parse import quote

# =====================================================================
# AYARLAR: musterinin degistirebilecegi tek yer
# =====================================================================

# Isletme koordinati. YAKLASIK deger: Zaventem ilce merkezi. Musteri Google Haritalar'da
# kendi adresine (Excelsiorlaan 31, 1930 Zaventem) sag tik -> koordinati kopyalayip
# yalnizca bu satiri degistirmelidir; JSON-LD (geo) ve geo.position/ICBM meta'lari birlikte guncellenir.
KOORDINAT = (50.8845, 4.4715)
GEO_REGION = "BE-VBR"            # ISO 3166-2: Vlaams-Brabant
GEO_YERADI = "Zaventem"
ADRES_BOLGE = "Vlaams-Brabant"   # PostalAddress.addressRegion (Zaventem bu ilde)

# Iletisim / bilgi dilleri: sitenin 4 dili. Musteri bu dillerde gercekten yanit VEREMIYORSA
# listeyi daralt veya bos birak (bos: availableLanguage, knowsLanguage, Preferred-Languages yazilmaz).
ILETISIM_DILLERI = ("fr", "nl", "en", "tr")

ODEME_YONTEMLERI = "Bancontact, Credit card, Apple Pay, Cash"   # cevrimici kapora + kalan soforde (nakit/kart)
FIYAT_ARALIGI = "€€"

OG_GORSEL_YOL = "/assets/og.jpg"
OG_GORSEL_BOYUT = (1200, 630)
LOGO_YOL = "/assets/icons/icon-512.png"
LOGO_BOYUT = (512, 512)

BOT_ROBOTS_ICERIK = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"

# manifest: 'minimal-ui' -> uygulama degil rezervasyon sitesi; Mollie/WhatsApp gibi dis yonlendirmeler
# ve dil degistirme icin adres cubugu/geri dugmesi gerekir. Desteklemeyen tarayici 'browser'a duser.
MANIFEST_DISPLAY = "minimal-ui"
MANIFEST_RENK = "#0A0A0C"
MANIFEST_IKONLAR = (
    ("/assets/icons/icon-192.png", "192x192", "any"),
    ("/assets/icons/icon-512.png", "512x512", "any"),
    ("/assets/icons/icon-maskable-512.png", "512x512", "maskable"),
)
APPLE_TOUCH_ICON = "/assets/icons/apple-touch-icon.png"

# Yer tutucu rota kodlari -> (alis, varis) KESIN tablo anahtarlari.
# {km_<kod>} ve {price_<kod>} bunlardan uretilir.
ROTA_KODLARI = {
    "bru": ("brussels", "bru"),
    "crl": ("brussels", "crl"),
    "gnt": ("gent", "bru"),
    "ams": ("brussels", "ams"),
    "par": ("brussels", "paris"),
}

# JSON-LD Offer ornekleri: (hizmet turu, alis, varis)   hizmet: airport | intercity | border
ORNEK_ROTALAR = (
    ("airport", "brussels", "bru"),
    ("airport", "brussels", "crl"),
    ("airport", "gent", "bru"),
    ("airport", "antwerpen", "bru"),
    ("intercity", "brussels", "antwerpen"),
    ("intercity", "brussels", "gent"),
    ("border", "brussels", "ams"),
    ("border", "brussels", "paris"),
)

# llms.txt fiyat tablosu: ORNEK_ROTALAR + populer rotalar (tekrarsiz)
# areaServed: sehir ve havalimani anahtarlari (mesafe-verisi.json 'yerler')
ALAN_SEHIRLERI = ("brussels", "antwerpen", "gent", "brugge", "leuven", "liege", "charleroi", "namur",
                  "mons", "hasselt", "mechelen", "kortrijk", "oostende",
                  "amsterdam", "rotterdam", "eindhoven", "maastricht", "paris", "lille", "koln",
                  "dusseldorf", "aachen", "luxembourg")
ALAN_HAVALIMANLARI = ("bru", "crl", "anr", "ost", "lgg", "ams", "ein", "cdg", "orly", "cgn", "dus", "fra", "lux")

# Hizmet ulkeleri (sartname: BE+DE+FR+LU+NL)
HIZMET_ULKELERI = ("BE", "DE", "FR", "LU", "NL")

# 'yerler' anahtari -> ulke. Belcika disindaki her yer acik yazilir; listede olmayan = BE
# (test_seo.py her yer icin tam kapsami ve Belcika sinir kutusunu dogrular).
YER_ULKE = {
    "amsterdam": "NL", "ams": "NL", "rotterdam": "NL", "den-haag": "NL", "utrecht": "NL",
    "eindhoven": "NL", "ein": "NL", "maastricht": "NL", "breda": "NL", "tilburg": "NL",
    "paris": "FR", "cdg": "FR", "orly": "FR", "lille": "FR", "calais": "FR", "dunkerque": "FR",
    "reims": "FR", "metz": "FR",
    "koln": "DE", "cgn": "DE", "dusseldorf": "DE", "dus": "DE", "aachen": "DE", "frankfurt": "DE",
    "fra": "DE", "bonn": "DE",
    "luxembourg": "LU", "lux": "LU",
}
ULKE_SIRASI = ("NL", "FR", "DE", "LU")   # zone_data sinir_otesi sirasi

# Arac filosu (sartname): kod -> (marka, model) ; kapasite mesafe-verisi.json 'araclar'
ARAC_MARKA = {"eco": ("Tesla", "Model 3"), "wagon": (None, None), "vip": ("Mercedes-Benz", "Vito")}

_TUM_GUNLER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_ULKE_ADI_ANAHTAR = "ulke_{}"
_ULKE_ISIMLERI_EN = {"BE": "Belgium", "DE": "Germany", "FR": "France", "LU": "Luxembourg", "NL": "Netherlands"}


# =====================================================================
# YARDIMCILAR
# =====================================================================
def _alan(ctx):
    return ctx["alan"].rstrip("/")


def _s(dil, ctx):
    return ctx["strings"][dil]


def sayfa_url(dil, ctx):
    """Dil sayfasinin mutlak URL'si (canonical ile ayni)."""
    return _alan(ctx) + _s(dil, ctx)["dil_yol"]


def _hreflang(dil, ctx):
    return _s(dil, ctx)["dil_hreflang"]


def _esc_attr(deger):
    return (str(deger).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def _sayi(x):
    """JSON icin sayi: tam sayiysa int, degilse 2 haneye yuvarlanmis float."""
    x = round(float(x), 2)
    return int(x) if x == int(x) else x


def para_goster(dil, deger):
    """Statik metinlerdeki tutar bicimi ({base}, {perkm}). build.py para_goster ile birebir."""
    if dil == "en":
        s = f"{deger:.2f}".rstrip("0").rstrip(".")
        return f"€{s}"
    s = f"{deger:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{s} €"


def para_tam(dil, deger):
    """Tam tutar bicimi (chip fiyatlari): 99,55 € / €99.55. build.py para_tam ile birebir."""
    if dil == "en":
        return f"€{deger:,.2f}".replace(",", " ")
    return f"{deger:.2f}".replace(".", ",") + " €"


def rota_km(ctx, a, b):
    """KESIN tablodan km (iki yonlu). Bulunamazsa KeyError."""
    kesin = ctx["kesin"]
    if f"{a}|{b}" in kesin:
        return kesin[f"{a}|{b}"]
    if f"{b}|{a}" in kesin:
        return kesin[f"{b}|{a}"]
    raise KeyError(f"KESIN tabloda rota yok: {a}|{b}")


def _km_veya_none(ctx, a, b):
    try:
        return rota_km(ctx, a, b)
    except KeyError:
        return None


def yer_adi(ctx, anahtar, dil):
    return ctx["veri"]["yerler"][anahtar]["ad"][dil]


def ulke_kodu(anahtar):
    return YER_ULKE.get(anahtar, "BE")


def ulke_adi(ctx, kod, dil):
    return _s(dil, ctx).get(_ULKE_ADI_ANAHTAR.format(kod.lower())) or _ULKE_ISIMLERI_EN[kod]


def _yer_tutucular(dil, ctx):
    sabit = ctx["veri"]["sabitler"]
    isl = ctx["isletme"]
    d = {
        "base": para_goster(dil, sabit["acilis_ucreti"]),
        "perkm": para_goster(dil, sabit["km_ucreti"]),
        "pct": str(sabit["kapora_yuzde"]),
        "company": isl["unvan"],
        "vat": isl["kdv"],
        "email": isl["eposta"],
        "year": str(ctx["bugun"])[:4],
    }
    for kod, (a, b) in ROTA_KODLARI.items():
        km = rota_km(ctx, a, b)
        toplam = ctx["fiyat"](km)[0]
        d["km_" + kod] = str(km)
        d["price_" + kod] = para_tam(dil, toplam)
    return d


def statik_doldur(dil, metin, ctx):
    """Build zamaninda cozulen yer tutucular. build.py statik_doldur ile ayni bicim; ek olarak
    {km_*}/{price_*} rota yer tutuculari. Bilinmeyen yer tutucular ({price}, {deposit}, {rest}...)
    OLDUGU GIBI birakilir (calisma zamani JS/PHP ya da bolge satiri basina doldurulur)."""
    for k, v in _yer_tutucular(dil, ctx).items():
        metin = metin.replace("{" + k + "}", v)
    return metin


def _doldur(dil, ctx, anahtar):
    """strings[dil][anahtar] -> yer tutuculari doldurulmus metin."""
    return statik_doldur(dil, _s(dil, ctx)[anahtar], ctx)


def adres_parcala(adres):
    """'Excelsiorlaan 31, 1930 Zaventem, Belgium' -> (sokak, posta, sehir, ulke_kodu)."""
    m = re.match(r"^\s*([^,]+?)\s*,\s*(\d{4,5})\s+([^,]+?)\s*(?:,\s*(.+?))?\s*$", adres)
    if not m:
        raise ValueError(f"isletme.json adres bicimi cozulemedi: {adres!r}")
    sokak, posta, sehir, ulke = m.groups()
    kodlar = {"belgium": "BE", "belgique": "BE", "belgie": "BE", "belgië": "BE", "belçika": "BE",
              "belcika": "BE"}
    return sokak, posta, sehir, kodlar.get((ulke or "belgium").lower(), "BE")


def _adres_dugumu(ctx):
    sokak, posta, sehir, ulke = adres_parcala(ctx["isletme"]["adres"])
    return {
        "@type": "PostalAddress",
        "streetAddress": sokak,
        "postalCode": posta,
        "addressLocality": sehir,
        "addressRegion": ADRES_BOLGE,
        "addressCountry": ulke,
    }


def _acik_saatler():
    """7/24: her gun 00:00-23:59 (Google'in 24 saat gosterimi)."""
    return {"@type": "OpeningHoursSpecification", "dayOfWeek": list(_TUM_GUNLER),
            "opens": "00:00", "closes": "23:59"}


def _gorsel(alan):
    return {"@type": "ImageObject", "url": alan + OG_GORSEL_YOL,
            "width": OG_GORSEL_BOYUT[0], "height": OG_GORSEL_BOYUT[1]}


# =====================================================================
# 1) <head> eki
# =====================================================================
def head_ek(dil, ctx):
    """<head> sonuna girecek HTML. Mevcut head'de zaten olan etiketleri (title, description, canonical,
    hreflang, og:title/description/url/image/locale, twitter:card/title/description/image, theme-color,
    color-scheme, icon) TEKRARLAMAZ."""
    alan = _alan(ctx)
    s = _s(dil, ctx)
    lat, lng = KOORDINAT
    alt = s.get("og_image_alt") or s.get("alt_logo") or ctx["isletme"]["marka"]
    satirlar = [
        "<!-- SEO/GEO eki (kaynak/seo.py): robots yonergeleri, geo, gorsel boyutu, manifest, ikon -->",
        f'<meta name="robots" content="{BOT_ROBOTS_ICERIK}">',
        f'<meta name="geo.region" content="{GEO_REGION}">',
        f'<meta name="geo.placename" content="{_esc_attr(GEO_YERADI)}">',
        f'<meta name="geo.position" content="{lat};{lng}">',
        f'<meta name="ICBM" content="{lat}, {lng}">',
        '<meta property="og:image:type" content="image/jpeg">',
        f'<meta property="og:image:width" content="{OG_GORSEL_BOYUT[0]}">',
        f'<meta property="og:image:height" content="{OG_GORSEL_BOYUT[1]}">',
        f'<meta property="og:image:alt" content="{_esc_attr(alt)}">',
        f'<meta name="twitter:image:alt" content="{_esc_attr(alt)}">',
        '<link rel="manifest" href="/manifest.webmanifest">',
        f'<link rel="apple-touch-icon" href="{APPLE_TOUCH_ICON}">',
    ]
    return "\n".join(satirlar) + "\n"


# =====================================================================
# 2) JSON-LD
# =====================================================================
def _alan_dugumleri(dil, ctx):
    """areaServed: ulkeler + baslica sehirler (City) + havalimanlari (Airport, iataCode)."""
    liste = []
    for kod in HIZMET_ULKELERI:
        liste.append({"@type": "Country", "name": ulke_adi(ctx, kod, dil), "identifier": kod})
    for anahtar in ALAN_SEHIRLERI:
        liste.append({"@type": "City", "name": yer_adi(ctx, anahtar, dil)})
    for anahtar in ALAN_HAVALIMANLARI:
        liste.append({"@type": "Airport", "name": yer_adi(ctx, anahtar, dil), "iataCode": anahtar.upper()})
    return liste


def _araclar(dil, ctx):
    s = _s(dil, ctx)
    araclar = ctx["veri"]["araclar"]
    liste = []
    adlar = {"eco": s["veh_eco_model"], "wagon": s["veh_wagon_name"], "vip": s["veh_vip_model"]}
    for kod in ("eco", "wagon", "vip"):
        a = araclar[kod]
        marka, model = ARAC_MARKA[kod]
        kapasite = (s["veh_capacity"].replace("{pax}", str(a["yolcu"]))
                    .replace("{big}", str(a["buyuk"])).replace("{small}", str(a["kucuk"])))
        dugum = {"@type": "Car", "name": adlar[kod], "vehicleSeatingCapacity": a["yolcu"],
                 "description": kapasite}
        if marka:
            dugum["brand"] = {"@type": "Brand", "name": marka}
            dugum["model"] = model
        liste.append(dugum)
    return liste


def _ornek_teklifler(dil, ctx, url):
    """KESIN tablodan hesaplanan Offer'lar -> [(hizmet, offer_dugumu)]."""
    alan = _alan(ctx)
    s = _s(dil, ctx)
    not_ = _doldur(dil, ctx, "ld_offer_note")
    hizmet_adi = {"airport": s["ld_svc_airport"], "intercity": s["ld_svc_intercity"],
                  "border": s["ld_svc_border"]}
    sonuc = []
    for hizmet, a, b in ORNEK_ROTALAR:
        km = rota_km(ctx, a, b)
        toplam = ctx["fiyat"](km)[0]
        ad = f"{yer_adi(ctx, a, dil)} → {yer_adi(ctx, b, dil)}"
        sonuc.append((hizmet, {
            "@type": "Offer",
            "@id": f"{alan}/#offer-{a}-{b}",
            "name": ad,
            "description": f"{km} km. {not_}",
            "price": _sayi(toplam),
            "priceCurrency": "EUR",
            "priceSpecification": {"@type": "PriceSpecification", "price": _sayi(toplam),
                                   "priceCurrency": "EUR"},
            "itemOffered": {"@type": "Service", "name": ad, "serviceType": hizmet_adi[hizmet]},
            "url": url + "#rezervasyon",
        }))
    return sonuc


def jsonld_graph(dil, ctx):
    """Tek JSON-LD blogu (@graph): Organization, WebSite, TaxiService+LocalBusiness, WebPage."""
    alan = _alan(ctx)
    isl = ctx["isletme"]
    sabit = ctx["veri"]["sabitler"]
    s = _s(dil, ctx)
    url = sayfa_url(dil, ctx)
    hl = _hreflang(dil, ctx)
    lat, lng = KOORDINAT
    tum_hl = [_hreflang(d, ctx) for d in ctx["diller"]]
    org_id, web_id, isl_id, logo_id = (alan + "/#organization", alan + "/#website",
                                       alan + "/#isletme", alan + "/#logo")
    sayfa_id = url + "#webpage"
    adres = _adres_dugumu(ctx)
    aciklama = _doldur(dil, ctx, "meta_desc")
    dil_kodlari = list(ILETISIM_DILLERI)

    # ---- Organization (kimlik) ----
    iletisim = {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "telephone": isl["telefon"],
        "email": isl["eposta"],
        "hoursAvailable": _acik_saatler(),
    }
    if dil_kodlari:
        iletisim["availableLanguage"] = dil_kodlari
    org = {
        "@type": "Organization",
        "@id": org_id,
        "name": isl["marka"],
        "legalName": isl["unvan"],
        "vatID": isl["kdv"],
        "url": alan + "/",
        "slogan": isl["slogan"],
        "telephone": isl["telefon"],
        "email": isl["eposta"],
        "address": adres,
        "logo": {"@type": "ImageObject", "@id": logo_id, "url": alan + LOGO_YOL,
                 "contentUrl": alan + LOGO_YOL, "width": LOGO_BOYUT[0], "height": LOGO_BOYUT[1],
                 "caption": isl["marka"]},
        "contactPoint": [iletisim],
    }

    # ---- WebSite ----
    website = {
        "@type": "WebSite",
        "@id": web_id,
        "url": alan + "/",
        "name": isl["marka"],
        "alternateName": alan.split("://", 1)[-1],
        "inLanguage": tum_hl,
        "publisher": {"@id": org_id},
    }

    # ---- Teklifler ----
    ornekler = _ornek_teklifler(dil, ctx, url)
    tarife = {
        "@type": "Offer",
        "@id": alan + "/#offer-tarife",
        "name": s["mode_km"],
        "description": _doldur(dil, ctx, "ld_tariff_d"),
        "priceCurrency": "EUR",
        "priceSpecification": [
            {"@type": "PriceSpecification", "name": s["ld_base_fare"],
             "price": _sayi(sabit["acilis_ucreti"]), "priceCurrency": "EUR"},
            {"@type": "UnitPriceSpecification", "name": s["ld_per_km"],
             "price": _sayi(sabit["km_ucreti"]), "priceCurrency": "EUR", "unitCode": "KMT"},
        ],
        "url": url + "#rezervasyon",
    }
    forfait = {
        "@type": "Offer",
        "@id": alan + "/#offer-forfait-aeroport",
        "name": s["mode_airport"],
        "description": s["airport_info"],
        "priceCurrency": "EUR",
        "url": url + "#rezervasyon",
    }
    donus = {
        "@type": "Offer",
        "@id": alan + "/#offer-retour",
        "name": s["ld_svc_return"],
        "description": s["ld_svc_return_d"],
        "priceCurrency": "EUR",
        "itemOffered": {"@type": "Service", "name": s["ld_svc_return"]},
        "url": url + "#rezervasyon",
    }
    makes_offer = [tarife, forfait] + [o for _, o in ornekler] + [donus]

    def ref(hizmet):
        return [{"@id": o["@id"]} for h, o in ornekler if h == hizmet]

    katalog = {
        "@type": "OfferCatalog",
        "name": s["ld_catalog"],
        "itemListElement": [
            {"@type": "OfferCatalog", "name": s["ld_svc_airport"],
             "itemListElement": [{"@id": forfait["@id"]}] + ref("airport")},
            {"@type": "OfferCatalog", "name": s["ld_svc_intercity"], "itemListElement": ref("intercity")},
            {"@type": "OfferCatalog", "name": s["ld_svc_border"], "itemListElement": ref("border")},
            {"@type": "OfferCatalog", "name": s["ld_svc_return"], "itemListElement": [{"@id": donus["@id"]}]},
        ],
    }

    # ---- TaxiService + LocalBusiness ----
    hedef_form = {"@type": "EntryPoint", "urlTemplate": url + "#rezervasyon", "inLanguage": hl,
                  "actionPlatform": ["https://schema.org/DesktopWebPlatform",
                                     "https://schema.org/MobileWebPlatform"]}
    hedef_wa = {"@type": "EntryPoint", "urlTemplate": isl["whatsapp"], "inLanguage": hl,
                "actionPlatform": ["https://schema.org/DesktopWebPlatform",
                                   "https://schema.org/MobileWebPlatform"]}
    isletme = {
        "@type": ["TaxiService", "LocalBusiness"],
        "@id": isl_id,
        "name": isl["marka"],
        "legalName": isl["unvan"],
        "vatID": isl["kdv"],
        "slogan": isl["slogan"],
        "description": aciklama,
        "url": url,
        "telephone": isl["telefon"],
        "email": isl["eposta"],
        "image": _gorsel(alan),
        "logo": {"@id": logo_id},
        "priceRange": FIYAT_ARALIGI,
        "currenciesAccepted": "EUR",
        "paymentAccepted": ODEME_YONTEMLERI,
        "parentOrganization": {"@id": org_id},
        "address": adres,
        "geo": {"@type": "GeoCoordinates", "latitude": lat, "longitude": lng},
        "hasMap": "https://www.google.com/maps/search/?api=1&query=" + quote(isl["adres"]),
        "openingHoursSpecification": _acik_saatler(),
        "areaServed": _alan_dugumleri(dil, ctx),
        "owns": _araclar(dil, ctx),
        "makesOffer": makes_offer,
        "hasOfferCatalog": katalog,
        "potentialAction": {
            "@type": "ReserveAction",
            "name": s["nav_book"],
            "inLanguage": hl,
            "target": [hedef_form, hedef_wa],
        },
    }
    if dil_kodlari:
        isletme["knowsLanguage"] = dil_kodlari

    # ---- WebPage ----
    sayfa = {
        "@type": "WebPage",
        "@id": sayfa_id,
        "url": url,
        "name": _doldur(dil, ctx, "meta_title"),
        "description": aciklama,
        "inLanguage": hl,
        "isPartOf": {"@id": web_id},
        "about": {"@id": isl_id},
        "primaryImageOfPage": _gorsel(alan),
        "speakable": {"@type": "SpeakableSpecification", "cssSelector": ["h1", ".hero-alt"]},
    }
    return {"@context": "https://schema.org", "@graph": [org, website, isletme, sayfa]}


def jsonld_faq(dil, ctx, ciftler):
    """FAQPage. ciftler: gorunur SSS sirasiyla [(soru, cevap), ...] (statik-doldurulmus metinler;
    birebir aktarilir, boylece JSON-LD sayfadaki gorunur metinle ayni kalir)."""
    url = sayfa_url(dil, ctx)
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": url + "#faq",
        "inLanguage": _hreflang(dil, ctx),
        "isPartOf": {"@id": url + "#webpage"},
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in ciftler
        ],
    }


# =====================================================================
# 3) Gorunur 'Hizmet bolgeleri' verisi
# =====================================================================
def zone_data(dil, ctx, kaynak="brussels"):
    """Gorunur 'Hizmet bolgeleri' bolumu icin veri (Brussels'ten KESIN tabloya gore).
    HTML uretmez; build/template katmani kullanir.
    Her oge: ad, km, fiyat (float toplam), fiyat_metin (bicimli), alis_anahtar, varis_anahtar, ulke, ulke_ad
    (+ havalimanlarinda iata)."""
    yerler = ctx["veri"]["yerler"]

    def oge(anahtar):
        km = _km_veya_none(ctx, kaynak, anahtar)
        if km is None:
            return None
        toplam = ctx["fiyat"](km)[0]
        kod = ulke_kodu(anahtar)
        d = {"ad": yer_adi(ctx, anahtar, dil), "km": km, "fiyat": toplam,
             "fiyat_metin": para_tam(dil, toplam), "alis_anahtar": kaynak, "varis_anahtar": anahtar,
             "ulke": kod, "ulke_ad": ulke_adi(ctx, kod, dil)}
        if yerler[anahtar]["havalimani"]:
            d["iata"] = anahtar.upper()
        return d

    havalimanlari, sehirler, sinir = [], [], []
    for anahtar, yer in yerler.items():
        if anahtar == kaynak:
            continue
        d = oge(anahtar)
        if d is None:
            continue
        if yer["havalimani"]:
            havalimanlari.append(d)
        elif d["ulke"] == "BE":
            sehirler.append(d)
        else:
            sinir.append(d)
    havalimanlari.sort(key=lambda d: (d["km"], d["ad"]))
    sehirler.sort(key=lambda d: (d["km"], d["ad"]))
    sinir.sort(key=lambda d: (ULKE_SIRASI.index(d["ulke"]) if d["ulke"] in ULKE_SIRASI else 99,
                              d["km"], d["ad"]))
    return {"havalimanlari": havalimanlari, "sehirler": sehirler, "sinir_otesi": sinir}


# =====================================================================
# 4) llms.txt / llms-full.txt (GEO)
# =====================================================================
def _tablo_rotalari(ctx):
    """llms.txt fiyat tablosu: ORNEK_ROTALAR + populer rotalar (tekrarsiz, sirali)."""
    cift, gorulen = [], set()
    for _, a, b in ORNEK_ROTALAR:
        cift.append((a, b))
        gorulen.add(frozenset((a, b)))
    for a, b in ctx["veri"].get("populer", []):
        if frozenset((a, b)) not in gorulen:
            cift.append((a, b))
            gorulen.add(frozenset((a, b)))
    return cift


def _fiyat_tablosu(dil, ctx):
    satirlar = ["| " + " | ".join(_baslik_tablo(dil)) + " |", "|---|---|---|---|---|"]
    for a, b in _tablo_rotalari(ctx):
        km = _km_veya_none(ctx, a, b)
        if km is None:
            continue
        toplam, kapora, kalan = ctx["fiyat"](km)
        satirlar.append(f"| {yer_adi(ctx, a, dil)} → {yer_adi(ctx, b, dil)} | {km} km | "
                        f"{para_tam(dil, toplam)} | {para_tam(dil, kapora)} | {para_tam(dil, kalan)} |")
    return satirlar


_TABLO_BASLIK = {
    "fr": ("Trajet", "Distance", "Prix total", "Acompte en ligne", "Solde au chauffeur"),
    "nl": ("Rit", "Afstand", "Totaalprijs", "Voorschot online", "Saldo aan chauffeur"),
    "en": ("Route", "Distance", "Total price", "Deposit online", "Balance to driver"),
    "tr": ("Güzergah", "Mesafe", "Toplam fiyat", "Online kapora", "Şoföre kalan"),
}


def _baslik_tablo(dil):
    return _TABLO_BASLIK[dil]


def _liste_ekle(satirlar, oge_metinleri):
    for m in oge_metinleri:
        satirlar.append("- " + m)


def _filo_satirlari(dil, ctx):
    s = _s(dil, ctx)
    araclar = ctx["veri"]["araclar"]
    adlar = {"eco": f'{s["veh_eco_name"]}: {s["veh_eco_model"]}',
             "wagon": f'{s["veh_wagon_name"]}: {s["veh_wagon_model"]}',
             "vip": f'{s["veh_vip_name"]}: {s["veh_vip_model"]}'}
    sonuc = []
    for kod in ("eco", "wagon", "vip"):
        a = araclar[kod]
        kap = (s["veh_capacity"].replace("{pax}", str(a["yolcu"]))
               .replace("{big}", str(a["buyuk"])).replace("{small}", str(a["kucuk"])))
        sonuc.append(f"{adlar[kod]} ({kap})")
    return sonuc


def _sss_ciftleri(dil, ctx):
    s = _s(dil, ctx)
    ciftler, i = [], 1
    while f"faq{i}_q" in s:
        ciftler.append((_doldur(dil, ctx, f"faq{i}_q"), _doldur(dil, ctx, f"faq{i}_a")))
        i += 1
    return ciftler


def llms_txt(ctx):
    """/llms.txt (llmstxt.org bicimi). Ingilizce, olgusal, tarihli, tek anlamli cumleler."""
    alan = _alan(ctx)
    isl = ctx["isletme"]
    sabit = ctx["veri"]["sabitler"]
    en = "en"
    s = _s(en, ctx)
    base, perkm = para_goster(en, sabit["acilis_ucreti"]), para_goster(en, sabit["km_ucreti"])
    pct = sabit["kapora_yuzde"]
    havalimanlari = ", ".join(f'{yer_adi(ctx, k, en)}' for k in ALAN_HAVALIMANLARI)
    L = []
    L.append(f'# {isl["marka"]}')
    L.append("")
    L.append(f'> {isl["marka"]} is a taxi and airport transfer service based in Zaventem, Belgium, operated by '
             f'{isl["unvan"]} (VAT {isl["kdv"]}). Every ride has a price fixed in advance: a base fare of {base} '
             f'plus {perkm} per kilometre. The service runs 24/7 across Belgium and to Germany, France, '
             f'Luxembourg and the Netherlands. The website is available in French (Belgium), Dutch (Belgium), '
             f'English and Turkish.')
    L.append("")
    L.append(f'Last updated: {ctx["bugun"]}. Currency: EUR. Website: {alan}')
    L.append("")
    L.append("## Website (one page per language)")
    etiketler = {"en": ("English", "English"), "fr": ("Français (Belgique)", "French (Belgium)"),
                 "nl": ("Nederlands (België)", "Dutch (Belgium)"), "tr": ("Türkçe", "Turkish")}
    for d in ("en", "fr", "nl", "tr"):
        if d not in ctx["diller"]:
            continue
        ad, dil_adi = etiketler[d]
        ek = " Default language of the site (x-default)." if d == "fr" else ""
        L.append(f'- [{ad}]({alan}{_s(d, ctx)["dil_yol"]}): booking form, prices, fleet, FAQ and legal '
                 f'information in {dil_adi}.{ek}')
    L.append("")
    L.append("## Services")
    L.append(f"- Airport transfers: {havalimanlari}.")
    L.append("- Intercity taxi rides between Belgian cities (for example Brussels, Antwerp, Ghent, Bruges, "
             "Leuven, Liège, Namur, Mons, Hasselt, Mechelen, Kortrijk, Ostend).")
    L.append("- Cross-border rides to Germany, France, Luxembourg and the Netherlands (for example "
             "Amsterdam, Rotterdam, Eindhoven, Maastricht, Paris, Lille, Cologne, Düsseldorf, Aachen, Luxembourg).")
    L.append("- Return trips: a return date and time can be added when booking.")
    L.append(f'- Booking: the online form on each language page ([{alan}/en/#rezervasyon]({alan}/en/#rezervasyon)) '
             f'or WhatsApp ({isl["whatsapp"]}).')
    L.append("")
    L.append("## Pricing")
    L.append(f"- Formula: total price = {base} base fare + {perkm} per kilometre driven.")
    L.append("- The price shown at booking is final. There is no night or weekend surcharge.")
    L.append(f"- Airport flat rate: for airports a fixed airport price is also offered; today's price can be "
             f"requested on WhatsApp ({isl['whatsapp']}).")
    L.append(f"- Deposit: {pct}% is paid online at booking (Bancontact, credit card or Apple Pay, processed by "
             f"Mollie). The balance is paid to the driver, in cash or by card.")
    L.append(f"- Example prices from the formula (distance in road km, prices in EUR, deposit {pct}%):")
    L.append("")
    L.extend(_fiyat_tablosu("en", ctx))
    L.append("")
    L.append("## Waiting time and cancellation")
    L.append("- Airports: waiting is free for 60 minutes after landing.")
    L.append("- Other addresses: the first 15 minutes are free, then €0.50 per minute.")
    L.append("- Cancellation more than 24 hours before departure: the deposit is fully refunded.")
    L.append("- Cancellation less than 24 hours before departure: the deposit is not refunded.")
    L.append("")
    L.append("## Fleet")
    _liste_ekle(L, _filo_satirlari(en, ctx))
    L.append("")
    L.append("## Contact and company")
    L.append(f'- Phone and WhatsApp: {isl["telefon"]} ({isl["whatsapp"]})')
    L.append(f'- Email: {isl["eposta"]}')
    L.append(f'- Business address: {isl["adres"]}')
    L.append("- Opening hours: every day, 24 hours a day.")
    L.append(f'- Company: {isl["unvan"]}, VAT {isl["kdv"]}. Trading name: {isl["marka"]}.')
    L.append("")
    L.append("## Frequently asked questions (summary)")
    for q, a in _sss_ciftleri(en, ctx):
        L.append(f"- {q} {a}")
    L.append("")
    L.append("## Optional")
    L.append(f"- [Full text in four languages]({alan}/llms-full.txt): all site sections and FAQ in French, "
             f"Dutch, English and Turkish.")
    L.append(f"- [Sitemap]({alan}/sitemap.xml): the four language pages with hreflang alternates.")
    L.append("")
    return "\n".join(L)


def llms_full_txt(ctx):
    """/llms-full.txt: 4 dilin tam metin ozeti + tum SSS'ler (site metinlerinden, celismez)."""
    alan = _alan(ctx)
    isl = ctx["isletme"]
    sabit = ctx["veri"]["sabitler"]
    L = []
    L.append(f'# {isl["marka"]} (full text)')
    L.append("")
    L.append(f'> Full text of {alan} in French (Belgium), Dutch (Belgium), English and Turkish. '
             f'{isl["marka"]} is a taxi and airport transfer service based in Zaventem, Belgium, operated by '
             f'{isl["unvan"]} (VAT {isl["kdv"]}). Last updated: {ctx["bugun"]}.')
    L.append("")
    L.append("## Company facts (language independent)")
    L.append(f'- Trading name: {isl["marka"]}. Legal entity: {isl["unvan"]}. VAT: {isl["kdv"]}.')
    L.append(f'- Business address: {isl["adres"]}.')
    L.append(f'- Phone and WhatsApp: {isl["telefon"]} ({isl["whatsapp"]}). Email: {isl["eposta"]}.')
    L.append(f"- Price formula: {para_goster('en', sabit['acilis_ucreti'])} base fare + "
             f"{para_goster('en', sabit['km_ucreti'])} per kilometre. Deposit {sabit['kapora_yuzde']}% online, "
             f"balance to the driver.")
    L.append("- Availability: every day, 24 hours a day. Area: Belgium, Germany, France, Luxembourg, Netherlands.")
    L.append("")
    for dil in ctx["diller"]:
        s = _s(dil, ctx)
        t = lambda k: _doldur(dil, ctx, k)   # noqa: E731
        L.append(f'## {s["dil_ad"]} ({s["dil_hreflang"]}): {alan}{s["dil_yol"]}')
        L.append("")
        L.append(f'### {t("hero_kicker")}')
        L.append(f'{t("hero_title")} {t("hero_sub")}')
        L.append("")
        L.append(f'### {t("how_title")}')
        for i in (1, 2, 3):
            L.append(f'- {t("how%d_t" % i)}: {t("how%d_d" % i)}')
        L.append("")
        L.append(f'### {t("why_title")}')
        for i in (1, 2, 3, 4):
            L.append(f'- {t("why%d_t" % i)}: {t("why%d_d" % i)}')
        L.append("")
        L.append(f'### {t("fleet_title")}')
        _liste_ekle(L, _filo_satirlari(dil, ctx))
        L.append("")
        L.append(f'### {t("routes_title")}')
        L.append(t("routes_sub"))
        L.append("")
        L.extend(_fiyat_tablosu(dil, ctx))
        L.append("")
        if "zones_title" in s:
            z = zone_data(dil, ctx)
            L.append(f'### {t("zones_title")}')
            L.append(t("zones_sub"))
            for baslik_anahtar, anahtar in (("zones_airports_t", "havalimanlari"), ("zones_cities_t", "sehirler"),
                                            ("zones_border_t", "sinir_otesi")):
                oge_metni = "; ".join(f'{o["ad"]} ({o["km"]} km, {o["fiyat_metin"]})' for o in z[anahtar])
                L.append(f'- {t(baslik_anahtar)}: {oge_metni}')
            L.append("")
        L.append(f'### {t("paym_title")}')
        L.append(f'- {t("faq2_a")}')
        L.append(f'- {t("faq4_a")}')
        L.append(f'- {t("cancel_policy")}')
        L.append("")
        L.append(f'### {t("faq_title")}')
        for q, a in _sss_ciftleri(dil, ctx):
            L.append(f"**{q}**")
            L.append(a)
            L.append("")
        L.append(f'### {t("legal_company_t")}')
        L.append(t("legal_company_d"))
        L.append(f'{t("email_label")}: {isl["eposta"]} · {t("phone_label")}: {isl["telefon"]}')
        L.append(f'{isl["unvan"]} · {isl["kdv"]} · {isl["adres"]}')
        L.append("")
    return "\n".join(L)


# =====================================================================
# 5) robots.txt, security.txt, manifest, sitemap
# =====================================================================
def robots_txt(ctx):
    alan = _alan(ctx)
    arama_botlari = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User",
                     "Applebot", "Googlebot", "Bingbot"]
    L = [
        "# Europa Taxi - robots.txt (uretildi: kaynak/seo.py robots_txt)",
        f'# Son guncelleme: {ctx["bugun"]}',
        "#",
        "# /pay/ (odeme uc noktalari) ve /api/ (sunucu uc noktalari) hicbir botta taranmaz.",
        "",
        "User-agent: *",
        "Allow: /",
        "Disallow: /pay/",
        "Disallow: /api/",
        "",
        "# --- ARAMA ve YANIT motorlari: acikca IZINLI ---",
        "# Bu botlar siteyi arama sonuclarinda ve yapay zeka yanitlarinda (ChatGPT search, Perplexity,",
        "# Claude search, Apple, Google, Bing) gostermek icin sayfa okur. Adli bir grup, o bot icin",
        "# '*' grubunun yerine gectiginden ozel alan kurallari burada da tekrarlanir.",
    ]
    L.extend(f"User-agent: {b}" for b in arama_botlari)
    L.extend([
        "Allow: /",
        "Disallow: /pay/",
        "Disallow: /api/",
        "",
        "# --- YAPAY ZEKA EGITIM tarayicilari: KARAR = IZINLI (varsayilan) ---",
        "# Bu botlar yukaridaki '*' grubuna duser ve siteyi tarayabilir. Isletme egitim verisi olarak",
        "# kullanilmasini ISTEMIYORSA asagidaki satirlarin basindaki '# ' isaretlerini kaldirin",
        "# (arama/yanit botlari yukaridaki gruplarda ayrica izinli kalir):",
        "#",
        "# User-agent: GPTBot",
        "# User-agent: ClaudeBot",
        "# User-agent: Google-Extended",
        "# User-agent: Applebot-Extended",
        "# User-agent: CCBot",
        "# Disallow: /",
        "",
        f"Sitemap: {alan}/sitemap.xml",
        "",
    ])
    return "\n".join(L)


def security_txt(ctx):
    """RFC 9116 /.well-known/security.txt (Policy YOK)."""
    alan = _alan(ctx)
    bugun = datetime.date.fromisoformat(ctx["bugun"])
    bitis = bugun + datetime.timedelta(days=365)
    L = [
        "# Europa Taxi - guvenlik iletisimi (RFC 9116)",
        f'Contact: mailto:{ctx["isletme"]["eposta"]}',
        f"Expires: {bitis.isoformat()}T00:00:00.000Z",
    ]
    if ILETISIM_DILLERI:
        L.append("Preferred-Languages: " + ", ".join(ILETISIM_DILLERI))
    L.append(f"Canonical: {alan}/.well-known/security.txt")
    return "\n".join(L) + "\n"


def manifest(ctx, dil=None):
    """/manifest.webmanifest. dil verilmezse x-default dili (fr)."""
    dil = dil or ctx.get("manifest_dil") or "fr"
    isl = ctx["isletme"]
    s = _s(dil, ctx)
    return {
        "id": "/",
        "name": isl["marka"],
        "short_name": isl["marka"],
        "description": _doldur(dil, ctx, "meta_desc"),
        "lang": s["dil_hreflang"],
        "dir": "ltr",
        "start_url": "/",
        "scope": "/",
        "display": MANIFEST_DISPLAY,
        "background_color": MANIFEST_RENK,
        "theme_color": MANIFEST_RENK,
        "categories": ["travel"],
        "icons": [{"src": src, "sizes": boyut, "type": "image/png", "purpose": amac}
                  for src, boyut, amac in MANIFEST_IKONLAR],
    }


def manifest_json(ctx, dil=None):
    return json.dumps(manifest(ctx, dil), ensure_ascii=False, indent=2) + "\n"


def sitemap_xml(ctx):
    """4 URL x tam 5'li xhtml:link kumesi + lastmod + image:image (og.jpg). Mevcut build.py cikisiyla
    ayni kume yapisi; image ad alani xmlns:image ile tanimlidir."""
    alan = _alan(ctx)
    lastmod = ctx.get("lastmod") or ctx["bugun"]
    diller = ctx["diller"]
    alternatifler = "\n".join(
        f'    <xhtml:link rel="alternate" hreflang="{_hreflang(d, ctx)}" href="{alan}{_s(d, ctx)["dil_yol"]}"/>'
        for d in diller
    ) + f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{alan}/fr/"/>'
    gorsel = (f"    <image:image>\n      <image:loc>{alan}{OG_GORSEL_YOL}</image:loc>\n"
              f"    </image:image>")
    girdiler = "\n".join(
        f"""  <url>
    <loc>{alan}{_s(d, ctx)["dil_yol"]}</loc>
{alternatifler}
    <lastmod>{lastmod}</lastmod>
{gorsel}
  </url>"""
        for d in diller
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
{girdiler}
</urlset>
"""
