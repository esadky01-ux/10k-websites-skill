# -*- coding: utf-8 -*-
"""
ADIM 3 TESTLERI — pay/ PHP katmani (hizli duman + uctan uca; derin kapsam: test_php_pay.py)
Calistirma: python3 kaynak/testler/test_adim3.py
Gereksinim: php CLI, once build.py calistirilmis olmali.

Kapsam:
- Tum PHP dosyalari `php -l` temiz (sartname §14-A)
- Birim testleri (fiyat, km sinirlari, km karar politikasi, girdi kurallari, e-postalar): birim_test.php
- create.php uctan uca: PHP yerlesik sunucusuyla gercek POST'lar (km=0/-5/801/9999 ret; bozuk e-posta ret;
  iptal onayi zorunlu; gecerli istek siparis dosyasi yaratir ve fiyat SUNUCUDA hesaplanir — istemcinin
  gonderdigi tutar yok sayilir; dogrulanamayan km -> 422 + WhatsApp)
- Guvenlik: pay/.htaccess beyaz liste, orders/.htaccess, config korumasi, webhook Mollie dogrulamasi

Uctan uca bolum www/'yu KIRLETMEZ: www/ gecici dizine kopyalanir; siparisler ORDERS_DIR ile gecici klasore yazilir;
pay/mesafe.json build.py'ye entegre edilene kadar pay_veri.py ile gecici kopyada uretilir.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent.parent
KAYNAK = KOK / "kaynak"
WWW = KOK / "www"

hatalar = []
gecen = 0


def kontrol(kosul, mesaj):
    global gecen
    if kosul:
        gecen += 1
    else:
        hatalar.append(mesaj)


# ============================================================ A. php -l
print("— A. php -l soz dizimi")
php_dosyalari = sorted((KAYNAK / "pay").glob("*.php")) + sorted((WWW / "pay").glob("*.php"))
for dosya in php_dosyalari:
    p = subprocess.run(["php", "-l", str(dosya)], capture_output=True, text=True)
    kontrol(p.returncode == 0, f"php -l hatasi {dosya.name}: {p.stderr[:200] or p.stdout[:200]}")

# ============================================================ B. birim testleri
print("— B. PHP birim testleri")
p = subprocess.run(["php", str(KAYNAK / "testler" / "birim_test.php")], capture_output=True, text=True)
kontrol(p.returncode == 0, f"birim_test.php basarisiz:\n{p.stdout}\n{p.stderr}")

# ============================================================ C. uretilen dosyalar
print("— C. uretilen dil.php / isletme.php")
for ad in ["dil.php", "isletme.php"]:
    kontrol((WWW / "pay" / ad).exists(), f"www/pay/{ad} uretilmemis")
cikti = subprocess.run(
    ["php", "-r", "echo json_encode(array_keys(require '" + str(WWW / "pay" / "dil.php") + "'));"],
    capture_output=True, text=True)
kontrol(cikti.returncode == 0 and set(json.loads(cikti.stdout or "[]")) == {"fr", "nl", "en", "tr"},
        f"dil.php 4 dil icermeli: {cikti.stdout[:120]}")

# ============================================================ D. guvenlik dosyalari
print("— D. guvenlik")
kontrol((WWW / "pay" / "orders" / ".htaccess").exists(), "www/pay/orders/.htaccess eksik")
orders_ht = (WWW / "pay" / "orders" / ".htaccess").read_text(encoding="utf-8")
kontrol("Require all denied" in orders_ht and "Deny from all" in orders_ht,
        "orders/.htaccess hem Apache 2.4 hem 2.2 icin kapatmali")
pay_ht = (WWW / "pay" / ".htaccess").read_text(encoding="utf-8")
kontrol("Require all denied" in pay_ht and "create|webhook|success|orders|test" in pay_ht and "Require all granted" in pay_ht,
        "pay/.htaccess BEYAZ LISTE olmali: her sey yasak, yalniz 5 betik izinli")
kontrol("Order allow,deny" in pay_ht and "Deny from all" in pay_ht and "Allow from all" in pay_ht, "pay/.htaccess Apache 2.2 karsiligi da olmali")
beyaz = re.search(r'<FilesMatch "([^"]+)">', pay_ht)
kontrol(beyaz is not None and all(re.search(beyaz.group(1), f) for f in ["create.php", "webhook.php", "success.php", "orders.php", "test.php"])
        and not any(re.search(beyaz.group(1), f) for f in ["config.php", "config.php~", "config.old", "config.txt", "x.bak", "mesafe.json", "kayit.log", "dil.php", "ortak.php"]),
        "pay/.htaccess beyaz liste deseni yalniz 5 betigi gecirmeli")

create = (KAYNAK / "pay" / "create.php").read_text(encoding="utf-8")
kontrol("$_POST['toplam']" not in create and "$_POST['fiyat']" not in create
        and "$_POST['kapora']" not in create and "$_POST['tutar']" not in create,
        "create.php tarayicidan gelen TUTARI okumamali (yalnizca km'den hesap)")
mesafe = (KAYNAK / "pay" / "mesafe.php").read_text(encoding="utf-8")
kontrol("function google_km" in mesafe and "distancematrix" in mesafe and "function mesafe_karar" in mesafe,
        "mesafe.php Distance Matrix dogrulamasi + karar politikasi icermeli")
kontrol("'tr' => 'fr_BE'" in create, "Mollie locale: tr -> fr_BE olmali (Mollie Turkce desteklemez)")
kontrol("303" in create, "checkout'a 303 yonlendirme olmali")
kontrol("google_server_key" in (KAYNAK / "pay" / "config.php").read_text(encoding="utf-8"), "config.php google_server_key alani")

webhook = (KAYNAK / "pay" / "webhook.php").read_text(encoding="utf-8")
kontrol("mollie('GET', 'payments/'" in webhook, "webhook durumu Mollie API'sinden dogrulamali")
kontrol("eposta_musteri" in webhook and "eposta_sirket" in webhook, "webhook e-postayi ALICI BASINA bayrakla gondermeli")
kontrol("siparis_guncelle" in webhook, "webhook siparisi kilitli (flock) guncellemeli")

success = (KAYNAK / "pay" / "success.php").read_text(encoding="utf-8")
kontrol("mini_sayfa" in success and "beklemede" in success and "siparis_guncelle" in success,
        "success.php bekleyen durumda 'basarisiz' dememeli (canli sorgu + yenileme + kilitli guncelleme)")

# ============================================================ E. uctan uca (PHP yerlesik sunucu, GECICI www kopyasi)
print("— E. create.php uctan uca")
TMP = Path(tempfile.mkdtemp(prefix="et_adim3_"))
WWW_T = TMP / "www"
SIP = TMP / "siparisler"
shutil.copytree(WWW, WWW_T)
if not (WWW_T / "pay" / "mesafe.json").exists():
    # build.py pay_veri.mesafe_json_yaz'i cagirana kadar: gecici kopyada uret
    sys.path.insert(0, str(KAYNAK))
    import pay_veri
    pay_veri.mesafe_json_yaz(WWW_T / "pay" / "mesafe.json")
PORT = int(os.environ.get("ET_ADIM3_PORT", "8224"))
env = dict(os.environ, ORDERS_DIR=str(SIP), TRUSTED_PROXY_HEADER="HTTP_X_FORWARDED_FOR", SITE_URL=f"http://127.0.0.1:{PORT}",
           PHP_CLI_SERVER_WORKERS="4")
for e in ["MOLLIE_API_KEY", "BREVO_API_KEY", "GOOGLE_SERVER_KEY", "ADMIN_PASSWORD", "MOLLIE_API_BASE", "BREVO_API_BASE", "GOOGLE_API_BASE", "COMPANY_EMAIL", "MAIL_FROM"]:
    env.pop(e, None)
sunucu = subprocess.Popen(
    ["php", "-S", f"127.0.0.1:{PORT}", "-t", str(WWW_T)],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
time.sleep(1.2)

_ip = [0]


def gonder(alanlar, yol="/pay/create.php"):
    _ip[0] += 1
    veri = urllib.parse.urlencode(alanlar).encode()
    istek = urllib.request.Request(f"http://127.0.0.1:{PORT}{yol}", data=veri, method="POST",
                                   headers={"X-Forwarded-For": f"10.33.0.{_ip[0]}"})
    try:
        with urllib.request.urlopen(istek, timeout=15) as y:
            return y.status, y.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def al(yol):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{yol}", timeout=15) as y:
            return y.status, y.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


GELECEK = (date.today() + timedelta(days=30)).isoformat()
GECERLI = {
    "dil": "fr", "alis": "Gand", "varis": "Brussels Airport (Zaventem)", "km": "56",
    "tarih": GELECEK, "saat": "06:30", "yolcu": "2", "buyuk": "1", "kucuk": "0",
    "arac": "eco", "ad": "Marie Dubois", "eposta": "marie@exemple.be", "telefon": "+32470112233", "iptal": "1",
}

try:
    # km sinirlari: 0, negatif, 801, 9999 -> hepsi RET (sartname §14-B)
    for kotu_km in ["0", "-5", "801", "9999", "abc", ""]:
        kod, govde = gonder({**GECERLI, "km": kotu_km})
        kontrol(kod == 422, f"km={kotu_km!r} reddedilmeli (HTTP {kod})")
        kontrol("Distance invalide" in govde or "adresse" in govde,
                f"km={kotu_km!r} icin dil dogru hata mesaji gostermeli")

    # bozuk e-posta -> RET
    kod, govde = gonder({**GECERLI, "eposta": "bozuk-eposta"})
    kontrol(kod == 422 and "e-mail" in govde, f"bozuk e-posta reddedilmeli (HTTP {kod})")
    # e-posta baslik enjeksiyonu -> RET
    kod, _ = gonder({**GECERLI, "eposta": "a@b.be\r\nBcc: kotu@x.be"})
    kontrol(kod == 422, "CRLF'li e-posta reddedilmeli")

    # kisa ad -> RET
    kod, _ = gonder({**GECERLI, "ad": "A"})
    kontrol(kod == 422, "1 karakterlik ad reddedilmeli")

    # kisa telefon -> RET
    kod, _ = gonder({**GECERLI, "telefon": "12345"})
    kontrol(kod == 422, "8 rakamdan kisa telefon reddedilmeli")

    # bos adres -> RET
    kod, _ = gonder({**GECERLI, "alis": ""})
    kontrol(kod == 422, "bos alis adresi reddedilmeli")

    # NL dilinde hata mesaji NL olmali
    kod, govde = gonder({**GECERLI, "dil": "nl", "km": "0"})
    kontrol("Ongeldige afstand" in govde, "NL istekte hata mesaji Flamanca olmali")

    # iptal kosullari onayi SUNUCUDA zorunlu
    once = set(SIP.glob("ET-*.json")) if SIP.exists() else set()
    kod, govde = gonder({k: v for k, v in GECERLI.items() if k != "iptal"})
    kontrol(kod == 422, f"iptal onayi olmadan 422 beklenir (HTTP {kod})")
    kontrol((set(SIP.glob("ET-*.json")) if SIP.exists() else set()) == once, "iptal onayi yokken siparis olusmamali")

    # dogrulanamayan km (tanimayan adres + Google yok) -> RET + WhatsApp yonlendirmesi (FAIL-CLOSED)
    kod, govde = gonder({**GECERLI, "alis": "Xyz Straat 1", "km": "1"})
    kontrol(kod == 422 and "wa.me/" in govde, f"tanimayan adres + km=1 -> 422 + WhatsApp ({kod})")
    kontrol((set(SIP.glob("ET-*.json")) if SIP.exists() else set()) == once, "reddedilen km icin siparis olusmamali")

    # gecerli istek: Mollie anahtari bos oldugundan odeme baslamaz AMA siparis dosyasi olusur ve fiyat
    # SUNUCUDA hesaplanir (istemcinin sahte 'toplam' alani yok sayilir; km=1 gonderilse de dahili tablo 56 km der)
    kod, govde = gonder({**GECERLI, "toplam": "1.00", "fiyat": "1.00", "km": "1"})
    kontrol(kod == 503, f"Mollie anahtari bosken 503 (err_pay) beklenir (HTTP {kod})")
    yeni = set(SIP.glob("ET-*.json")) - once
    kontrol(len(yeni) == 1, f"gecerli istek 1 siparis dosyasi yaratmali ({len(yeni)} bulundu)")
    if len(yeni) == 1:
        dosya = next(iter(yeni))
        siparis = json.loads(dosya.read_text(encoding="utf-8"))
        kontrol(siparis["toplam"] == 121.44 and siparis["kapora"] == 24.29 and siparis["kalan"] == 97.15,
                f"sunucu fiyati bagimsiz hesaplamali: {siparis['toplam']}/{siparis['kapora']}/{siparis['kalan']}")
        kontrol(siparis["km"] == 56 and siparis["km_sunucu"] is None and siparis["km_kaynak"] == "dahili" and siparis["km_istemci"] == 1,
                "km=1 gonderilse de dahili tablo 56 km'yi kullanmali (Google yok)")
        kontrol(siparis["durum"] == "odeme_baslatilamadi", "durum odeme_baslatilamadi olmali")
        kontrol("iptal_onay" in siparis, "siparise iptal_onay zaman damgasi yazilmali")
        kontrol("necatican" not in json.dumps(siparis).lower(), "siparis kaydinda yasak icerik olmamali")
        kontrol(oct(dosya.stat().st_mode & 0o777) == "0o600", "siparis dosyasi 0600")
    kontrol(not list((WWW_T / "pay" / "orders").glob("ET-*.json")), "siparis www/ icine yazilmamali")

    # success.php: bilinmeyen siparis -> marka gorunumlu sayfa, PHP hatasi yok
    kod, govde = al("/pay/success.php?order=ET-000000-XXXXXX")
    kontrol("EUROPA" in govde and "Warning" not in govde and "Fatal" not in govde,
            "success.php bilinmeyen sipariste temiz sayfa gostermeli")

    # webhook: gecersiz id -> 200 + PHP hatasi yok (Mollie tekrar denemesin)
    kod, govde = gonder({"id": "kotu-deger"}, "/pay/webhook.php")
    kontrol(kod == 200, "webhook gecersiz id'de bile 200 donmeli")

    # orders.php: sifre bos -> panel kapali uyarisi
    kod, govde = al("/pay/orders.php")
    kontrol(kod == 503 and "admin_password" in govde, "orders.php sifre yokken kurulum uyarisi gostermeli")

    # test.php: sifre bos -> kapali; ?pw= ASLA kabul edilmez
    kod, govde = al("/pay/test.php?pw=herhangi")
    kontrol(kod == 503 and "admin_password" in govde, "test.php sifre yokken kapali olmali")
finally:
    sunucu.terminate()
    try:
        sunucu.wait(timeout=5)
    except Exception:
        sunucu.kill()
    shutil.rmtree(TMP, ignore_errors=True)   # test verisi hicbir yerde kalmaz

print()
if hatalar:
    print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
    for x in hatalar:
        print("   -", x)
    sys.exit(1)
print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
