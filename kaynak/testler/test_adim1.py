# -*- coding: utf-8 -*-
"""
ADIM 1 TESTLERI — strings.json semasi + PLACES/EXACT tablolari
Calistirma: python3 kaynak/testler/test_adim1.py
Harici bagimlilik yok. Cikis kodu 0 = hepsi gecti.

Buradaki normalize() ve yer_bul() mantigi, Adim 2'de template.html icindeki
JS mesafe motoruyla birebir ayni olmalidir (ayni kurallar, ayni sonuclar).
"""
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent   # kaynak/
DILLER = ["fr", "nl", "en", "tr"]

hatalar = []
gecen = 0


def kontrol(kosul, mesaj):
    """Basit assert: kosul yanlissa hatayi listeye ekler, testi durdurmaz."""
    global gecen
    if kosul:
        gecen += 1
    else:
        hatalar.append(mesaj)


# ---------------------------------------------------------------- veri yukle
strings = json.loads((KOK / "strings.json").read_text(encoding="utf-8"))
veri = json.loads((KOK / "mesafe-verisi.json").read_text(encoding="utf-8"))
SABIT = veri["sabitler"]
YERLER = veri["yerler"]
KESIN = veri["kesin"]


# ------------------------------------------------------- mesafe motoru (Python kopyasi)
def normalize(s):
    """Girdi adresini eslesme icin normallestirir: kucuk harf, aksansiz,
    noktalama yerine bosluk, tek bosluk. JS tarafinda birebir aynisi olacak."""
    s = s.lower()
    # Turkce ozel karakterler once (unicodedata 'ı' harfini bozmadan birakir)
    s = s.replace("ı", "i").replace("ß", "ss").replace("œ", "oe").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# Eslesme dizini: normalize edilmis takma ad / gorunen ad -> yer anahtari
ESLESME = {}
for anahtar, yer in YERLER.items():
    adaylar = set(yer["takma"]) | {yer["ad"][d] for d in DILLER}
    for aday in adaylar:
        n = normalize(aday)
        if n:
            # Ayni takma ad iki yere isaret etmemeli
            if n in ESLESME and ESLESME[n] != anahtar:
                hatalar.append(f"Takma ad cakismasi: '{n}' hem {ESLESME[n]} hem {anahtar}")
            ESLESME[n] = anahtar


def yer_bul(girdi):
    """Serbest metin adresten yer anahtari bulur. En uzun eslesme kazanir
    (or. 'brussels airport' > 'brussels'). Bulamazsa None."""
    n = normalize(girdi)
    if not n:
        return None
    if n in ESLESME:
        return ESLESME[n]
    en_iyi, en_uzun = None, 0
    hedef = f" {n} "
    for takma, anahtar in ESLESME.items():
        if f" {takma} " in hedef and len(takma) > en_uzun:
            en_iyi, en_uzun = anahtar, len(takma)
    return en_iyi


def haversine_km(a, b):
    """Iki koordinat arasi kus ucusu km."""
    R = 6371.0
    la1, lo1 = math.radians(a["lat"]), math.radians(a["lng"])
    la2, lo2 = math.radians(b["lat"]), math.radians(b["lng"])
    h = (math.sin((la2 - la1) / 2) ** 2
         + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))


KESIN_SOZLUK = {}
for a, b, km in KESIN:
    KESIN_SOZLUK[(a, b)] = km
    KESIN_SOZLUK[(b, a)] = km


def mesafe_km(girdi_a, girdi_b):
    """Dahili tablo mesafesi: once KESIN, yoksa haversine x yol katsayisi.
    Yer bulunamazsa None (fiyat URETILMEZ)."""
    ka, kb = yer_bul(girdi_a), yer_bul(girdi_b)
    if ka is None or kb is None or ka == kb:
        return None
    if (ka, kb) in KESIN_SOZLUK:
        return float(KESIN_SOZLUK[(ka, kb)])
    return round(haversine_km(YERLER[ka], YERLER[kb]) * SABIT["yol_katsayisi"])


def fiyat_hesapla(km):
    """Toplam / kapora / aracta odenecek. Iki ondalik, yarim yukari yuvarlama."""
    toplam = round(SABIT["acilis_ucreti"] + km * SABIT["km_ucreti"] + 1e-9, 2)
    kapora = round(toplam * SABIT["kapora_yuzde"] / 100 + 1e-9, 2)
    return toplam, kapora, round(toplam - kapora, 2)


# ================================================================ A. STRINGS
print("— A. strings.json kontrolleri")

kontrol(set(strings.keys()) - {"_aciklama"} == set(DILLER),
        "strings.json kok anahtarlari fr/nl/en/tr olmali")

fr_anahtarlar = set(strings["fr"].keys())
for dil in DILLER:
    fark1 = fr_anahtarlar - set(strings[dil].keys())
    fark2 = set(strings[dil].keys()) - fr_anahtarlar
    kontrol(not fark1 and not fark2,
            f"[{dil}] anahtar seti fr ile ayni degil (eksik: {sorted(fark1)}, fazla: {sorted(fark2)})")

YER_TUTUCU = re.compile(r"\{[a-z_]+\}")
for anahtar in sorted(fr_anahtarlar):
    referans = set(YER_TUTUCU.findall(strings["fr"][anahtar]))
    for dil in DILLER:
        deger = strings[dil].get(anahtar)
        kontrol(isinstance(deger, str) and deger.strip() != "",
                f"[{dil}] '{anahtar}' bos olamaz")
        if isinstance(deger, str):
            kontrol(set(YER_TUTUCU.findall(deger)) == referans,
                    f"[{dil}] '{anahtar}' yer tutuculari fr ile ayni degil ({referans})")

# Yasak icerik: yonetici adi hicbir dosyada gecmeyecek (sartname §1)
tum_metin = json.dumps(strings, ensure_ascii=False) + json.dumps(veri, ensure_ascii=False)
for yasak in ["necatican", "ceylan"]:
    kontrol(yasak not in tum_metin.lower(), f"Yasak icerik bulundu: '{yasak}'")

# SEO sinirlari (sartname §11)
for dil in DILLER:
    t, d = strings[dil]["meta_title"], strings[dil]["meta_desc"]
    kontrol(len(t) <= 60, f"[{dil}] meta_title {len(t)} karakter (en fazla 60): {t!r}")
    kontrol(len(d) <= 160, f"[{dil}] meta_desc {len(d)} karakter (en fazla 160)")

# Dil meta alanlari (sartname §3)
beklenen_meta = {
    "fr": ("fr-BE", "fr_BE", "/fr/"),
    "nl": ("nl-BE", "nl_BE", "/nl/"),
    "en": ("en", "en_GB", "/en/"),
    "tr": ("tr", "tr_TR", "/tr/"),
}
for dil, (hreflang, og, yol) in beklenen_meta.items():
    kontrol(strings[dil]["dil_hreflang"] == hreflang, f"[{dil}] dil_hreflang {hreflang} olmali")
    kontrol(strings[dil]["dil_og_locale"] == og, f"[{dil}] dil_og_locale {og} olmali")
    kontrol(strings[dil]["dil_yol"] == yol, f"[{dil}] dil_yol {yol} olmali")

# Flaman varyant kontrolu (sartname §3): Hollanda Hollandacasi kelimeler yasak
nl_metin = json.dumps(strings["nl"], ensure_ascii=False).lower()
kontrol("creditcard" not in nl_metin, "[nl] 'creditcard' yerine 'kredietkaart' kullanilmali")
kontrol("kredietkaart" in nl_metin, "[nl] 'kredietkaart' gecmeli")
kontrol("voorschot" in nl_metin, "[nl] 'voorschot' gecmeli")
kontrol("luchthavenvervoer" in nl_metin, "[nl] 'luchthavenvervoer' gecmeli")
kontrol("aanbetaling" not in nl_metin, "[nl] 'aanbetaling' (NL-NL) yerine 'voorschot' kullanilmali")

# Sartnamenin birebir istedigi metinler
kontrol(strings["tr"]["val_price"] == "Fiyatı hesaplayabilmemiz için alış ve varış adresini seçiniz.",
        "[tr] val_price sartnamedeki cumleyle birebir ayni olmali")
kontrol(strings["tr"]["cancel_policy"] ==
        "Rezervasyona 24 saatten fazla süre varken yapılan iptallerde tam iade. Son 24 saat içinde kapora iade edilmez.",
        "[tr] cancel_policy sartnamedeki metinle birebir ayni olmali")
kontrol(strings["tr"]["airport_wa_btn"] == "Güncel havalimanı fiyatını sor",
        "[tr] airport_wa_btn sartnamedeki metinle ayni olmali")

# ================================================================ B. SABITLER
print("— B. fiyat sabitleri")
kontrol(SABIT["acilis_ucreti"] == 10.0, "acilis_ucreti 10.0 olmali")
kontrol(SABIT["km_ucreti"] == 1.99, "km_ucreti 1.99 olmali")
kontrol(SABIT["kapora_yuzde"] == 20, "kapora_yuzde 20 olmali")
kontrol(SABIT["yol_katsayisi"] == 1.17, "yol_katsayisi 1.17 olmali")
kontrol(SABIT["min_km"] == 1 and SABIT["max_km"] == 800, "km siniri 1-800 olmali")
kontrol(SABIT["tolerans_yuzde"] == 12, "tolerans_yuzde 12 olmali")
kontrol((SABIT["yolcu_max"], SABIT["buyuk_valiz_max"], SABIT["kucuk_valiz_max"]) == (7, 6, 4),
        "sayac limitleri 7/6/4 olmali (Vito kapasitesi)")

# ================================================================ C. YERLER
print("— C. yerler tablosu")
kontrol(len(YERLER) >= 65, f"En az ~70 yer bekleniyor, {len(YERLER)} var")
for anahtar, yer in YERLER.items():
    kontrol(35 <= yer["lat"] <= 60 and -6 <= yer["lng"] <= 15,
            f"{anahtar}: koordinat Avrupa disinda ({yer['lat']}, {yer['lng']})")
    kontrol(set(yer["ad"].keys()) == set(DILLER), f"{anahtar}: 4 dilde ad olmali")
    kontrol(yer["ulke"] in ("BE", "DE", "FR", "LU", "NL"), f"{anahtar}: ulke kodu gecersiz")
    for takma in yer["takma"]:
        kontrol(takma == normalize(takma),
                f"{anahtar}: takma ad normalize edilmis olmali: {takma!r}")

hava_sayisi = sum(1 for y in YERLER.values() if y["havalimani"])
kontrol(hava_sayisi >= 12, f"En az 12 havalimani bekleniyor, {hava_sayisi} var")

# ================================================================ D. KESIN TABLO
print("— D. kesin rota tablosu")
kontrol(len(KESIN) >= 45, f"En az ~45 kesin rota bekleniyor, {len(KESIN)} var")
gorulen = set()
for a, b, km in KESIN:
    kontrol(a in YERLER and b in YERLER, f"KESIN rota bilinmeyen yer iceriyor: {a}-{b}")
    kontrol(1 <= km <= 800, f"KESIN {a}-{b}: km ({km}) 1-800 araliginda degil")
    cift = tuple(sorted((a, b)))
    kontrol(cift not in gorulen, f"KESIN tekrar eden rota: {a}-{b}")
    gorulen.add(cift)
    # Sagduyu kontrolu: kesin km, kus ucusu x katsayi degerinden asiri sapmamali
    if a in YERLER and b in YERLER:
        tahmin = haversine_km(YERLER[a], YERLER[b]) * SABIT["yol_katsayisi"]
        kontrol(abs(km - tahmin) / max(tahmin, 1) <= 0.40,
                f"KESIN {a}-{b}={km} km, kus ucusu tahmini {tahmin:.0f} km'den %40+ sapiyor (yazim hatasi?)")

# ================================================================ E. §5 DOGRULAMA HEDEFLERI
print("— E. sartname §5 rota hedefleri")
hedefler = [
    # (girdi A, girdi B, beklenen km, beklenen toplam €, beklenen kapora €)
    ("Bruxelles", "Antwerpen", 45, 99.55, 19.91),
    ("Brüksel", "Liège", 100, 209.00, 41.80),
    ("Gent", "Brussels Airport", 56, 121.44, 24.29),
    ("Gand", "Aéroport de Charleroi", 115, 238.85, 47.77),
    ("Leuven", "Zaventem", 22, None, None),
    ("Brussel", "Luxembourg", 220, None, None),
    ("Brussels", "Paris", 315, None, None),
    ("Bruxelles", "Köln", 215, None, None),
    ("Brüksel", "Amsterdam", 210, None, None),
]
for girdi_a, girdi_b, beklenen_km, beklenen_toplam, beklenen_kapora in hedefler:
    km = mesafe_km(girdi_a, girdi_b)
    kontrol(km == beklenen_km,
            f"{girdi_a} → {girdi_b}: {km} km bulundu, {beklenen_km} km bekleniyordu")
    if km is not None and beklenen_toplam is not None:
        toplam, kapora, kalan = fiyat_hesapla(km)
        kontrol(toplam == beklenen_toplam,
                f"{girdi_a} → {girdi_b}: {toplam} € bulundu, {beklenen_toplam} € bekleniyordu")
        kontrol(kapora == beklenen_kapora,
                f"{girdi_a} → {girdi_b}: kapora {kapora} €, {beklenen_kapora} € bekleniyordu")
        kontrol(round(kapora + kalan, 2) == toplam,
                f"{girdi_a} → {girdi_b}: kapora + kalan toplami tutmuyor")

# Taninmayan adres -> fiyat YOK (sartname §4.3)
kontrol(mesafe_km("asdfghjkl qwerty", "Bruxelles") is None,
        "Taninmayan adres icin mesafe/fiyat uretilmemeli")
kontrol(mesafe_km("", "Bruxelles") is None, "Bos adres icin mesafe uretilmemeli")
kontrol(mesafe_km("Bruxelles", "Bruxelles") is None,
        "Ayni yer icin mesafe uretilmemeli")

# ================================================================ F. TAKMA AD / DIL ESLESMELERI
print("— F. cok dilli takma ad eslesmeleri")
takma_testleri = [
    ("Brüksel", "brussels"), ("bruxelles", "brussels"), ("BRUSSEL", "brussels"),
    ("Anvers", "antwerpen"), ("antwerp", "antwerpen"),
    ("Luik", "liege"), ("Liège", "liege"), ("Lüttich", "liege"),
    ("Gand", "gent"), ("Ghent", "gent"),
    ("Keulen", "koln"), ("Cologne", "koln"), ("Köln", "koln"),
    ("La Haye", "den-haag"), ("The Hague", "den-haag"), ("Lahey", "den-haag"),
    ("Zaventem", "bru"), ("Brussels Airport", "bru"),
    ("Aéroport de Bruxelles", "bru"), ("Brüksel Havalimanı", "bru"),
    ("luchthaven zaventem", "bru"),
    ("Charleroi", "charleroi"),
    ("Charleroi Airport", "crl"), ("Aéroport de Charleroi", "crl"),
    ("Charleroi Havalimanı", "crl"), ("Brussels South", "crl"),
    ("Schiphol", "ams"), ("CDG", "cdg"), ("Roissy", "cdg"),
    ("Parijs", "paris"), ("Doornik", "tournai"), ("Rijsel", "lille"),
    ("Lüksemburg", "luxembourg"), ("Aken", "aachen"), ("Duinkerke", "dunkerque"),
    # Adres icinde gecen sehir de bulunmali (en uzun eslesme kazanir)
    ("Rue de la Loi 16, Bruxelles", "brussels"),
    ("Brussels Airport Departures, Zaventem", "bru"),
    ("Wetstraat 16, Brussel", "brussels"),
]
for girdi, beklenen in takma_testleri:
    bulunan = yer_bul(girdi)
    kontrol(bulunan == beklenen, f"yer_bul({girdi!r}) = {bulunan!r}, beklenen {beklenen!r}")

# ================================================================ G. HAVERSINE YEDEGI
print("— G. haversine yedegi")
# KESIN tabloda olmayan bir cift: tablo yoksa kus ucusu x 1.17 devrede
km = mesafe_km("Mechelen", "Gent")
kontrol(km is not None and 45 <= km <= 80,
        f"Mechelen → Gent haversine tahmini mantiksiz: {km} km")
km = mesafe_km("Tongeren", "Namur")
kontrol(km is not None and 50 <= km <= 110,
        f"Tongeren → Namur haversine tahmini mantiksiz: {km} km")

# Sinir kontrolu: fiyat formulu ornek degerler
toplam, kapora, kalan = fiyat_hesapla(45)
kontrol((toplam, kapora, kalan) == (99.55, 19.91, 79.64),
        f"45 km fiyat bekleneni vermedi: {toplam}/{kapora}/{kalan}")

# ================================================================ H. EK VERILER
print("— H. isletme / araclar / populer rotalar / dil bekcileri")

# Isletme sabitleri (sartname §1, birebir)
isletme = json.loads((KOK / "isletme.json").read_text(encoding="utf-8"))
kontrol(isletme["marka"] == "Europa Taxi", "isletme.marka yanlis")
kontrol(isletme["slogan"] == "Your Ride, Our Priority", "isletme.slogan yanlis")
kontrol(isletme["unvan"] == "CAN COMPANY", "isletme.unvan yanlis")
kontrol(isletme["kdv"] == "BE 1016.219.906", "isletme.kdv yanlis")
kontrol("Excelsiorlaan 31" in isletme["adres"] and "1930 Zaventem" in isletme["adres"],
        "isletme.adres sartnamedeki adres olmali")
kontrol(isletme["eposta"] == "Europataxisrl@gmail.com", "isletme.eposta yanlis")
kontrol(isletme["gonderen_eposta"] == "noreply@europetaxi24.be", "isletme.gonderen_eposta yanlis")
kontrol(isletme["telefon"] == "+32 493 83 98 98", "isletme.telefon yanlis")
kontrol(isletme["whatsapp"] == "https://wa.me/32493839898", "isletme.whatsapp yanlis")
kontrol(isletme["alan_adi"] == "https://europetaxi24.be", "isletme.alan_adi yanlis")
for yasak in ["necatican", "ceylan"]:
    kontrol(yasak not in json.dumps(isletme).lower(), f"isletme.json yasak icerik: '{yasak}'")

# Arac kapasiteleri (sartname §7)
araclar = veri["araclar"]
kontrol(araclar["eco"] == {"yolcu": 4, "buyuk": 2, "kucuk": 2}, "eco kapasitesi 4/2+2 olmali")
kontrol(araclar["wagon"] == {"yolcu": 4, "buyuk": 4, "kucuk": 2}, "wagon kapasitesi 4/4+2 olmali")
kontrol(araclar["vip"] == {"yolcu": 7, "buyuk": 6, "kucuk": 4}, "vip kapasitesi 7/6+4 olmali")
kontrol(araclar["vip"]["yolcu"] == SABIT["yolcu_max"]
        and araclar["vip"]["buyuk"] == SABIT["buyuk_valiz_max"]
        and araclar["vip"]["kucuk"] == SABIT["kucuk_valiz_max"],
        "Sayac limitleri en buyuk aracin (Vito) kapasitesine esit olmali")

# Populer rota chip'leri: hepsi KESIN tabloda olmali (chip fiyati kesin km'den)
for a, b in veri["populer"]:
    kontrol(a in YERLER and b in YERLER, f"populer rota bilinmeyen yer: {a}-{b}")
    kontrol((a, b) in KESIN_SOZLUK, f"populer rota KESIN tabloda yok: {a}-{b}")

# Yedek mod sure hesabi icin ortalama hiz
kontrol(50 <= SABIT["ort_hiz_kmh"] <= 90, "ort_hiz_kmh 50-90 araliginda olmali")

# Eksiklik denetiminden gelen takma ad duzeltmeleri
for girdi, beklenen in [("Bergen", "mons"), ("Spa", "spa"), ("Saint-Nicolas", "sint-niklaas")]:
    kontrol(yer_bul(girdi) == beklenen, f"yer_bul({girdi!r}) {beklenen!r} donmeli")

# Dil incelemesi bekcileri: bir daha geri gelmesinler
fr_metin = json.dumps(strings["fr"], ensure_ascii=False).lower()
kontrol("licencié" not in fr_metin, "[fr] 'licencié' (yanlis anlam) kullanilmamali, 'agréé' dogru")
kontrol("agréé" in fr_metin, "[fr] 'agréé' gecmeli")
nl_metin2 = json.dumps(strings["nl"], ensure_ascii=False).lower()
kontrol("instaptarief" not in nl_metin2, "[nl] 'instaptarief' yerine 'instapgeld' kullanilmali")
kontrol("instapgeld" in nl_metin2, "[nl] 'instapgeld' gecmeli")
kontrol("stationwagen" not in nl_metin2, "[nl] 'stationwagen' (NL-NL) yerine 'break' kullanilmali")

# Alt metinleri: 4 dilde bes gorsel icin de mevcut (SEO: her <img> alt'li)
for alt_anahtar in ["alt_hero", "alt_logo", "alt_veh_eco", "alt_veh_wagon", "alt_veh_vip"]:
    for dil in DILLER:
        kontrol(strings[dil].get(alt_anahtar, "").strip() != "",
                f"[{dil}] {alt_anahtar} eksik")

# ================================================================ SONUC
print()
if hatalar:
    print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
    for h in hatalar:
        print("   -", h)
    sys.exit(1)
print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
