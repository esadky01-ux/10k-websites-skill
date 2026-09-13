# -*- coding: utf-8 -*-
"""
ADIM 3 TESTLERI — pay/ PHP katmani
Calistirma: python3 kaynak/testler/test_adim3.py
Gereksinim: php CLI, once build.py calistirilmis olmali.

Kapsam:
- Tum PHP dosyalari `php -l` temiz (sartname §14-A)
- Birim testleri (fiyat, km sinirlari, tolerans, para bicimi, e-postalar)
- create.php uctan uca: PHP yerlesik sunucusuyla gercek POST'lar
  (km=0/-5/801/9999 ret; bozuk e-posta ret; gecerli istek siparis dosyasi
  yaratir ve fiyat SUNUCUDA hesaplanir — istemcinin gonderdigi tutar yok sayilir)
- Guvenlik: orders/.htaccess, config korumasi, webhook Mollie dogrulamasi
"""
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
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
kontrol("config\\.php" in pay_ht, "pay/.htaccess config.php'yi korumali")

create = (KAYNAK / "pay" / "create.php").read_text(encoding="utf-8")
kontrol("$_POST['toplam']" not in create and "$_POST['fiyat']" not in create
        and "$_POST['kapora']" not in create and "$_POST['tutar']" not in create,
        "create.php tarayicidan gelen TUTARI okumamali (yalnizca km'den hesap)")
kontrol("google_km" in create and "distancematrix" in create, "create.php Distance Matrix dogrulamasi icermeli")
kontrol("'tr' => 'fr_BE'" in create, "Mollie locale: tr -> fr_BE olmali (Mollie Turkce desteklemez)")
kontrol("303" in create, "checkout'a 303 yonlendirme olmali")

webhook = (KAYNAK / "pay" / "webhook.php").read_text(encoding="utf-8")
kontrol("mollie('GET', 'payments/'" in webhook, "webhook durumu Mollie API'sinden dogrulamali")
kontrol("eposta_gonderildi" in webhook, "webhook e-postayi yalnizca ILK odemede gondermeli")

success = (KAYNAK / "pay" / "success.php").read_text(encoding="utf-8")
kontrol("mini_sayfa" in success and "beklemede" in success,
        "success.php bekleyen durumda 'basarisiz' dememeli (canli sorgu + yenileme)")

# ============================================================ E. uctan uca (PHP yerlesik sunucu)
print("— E. create.php uctan uca")
PORT = 8224
sunucu = subprocess.Popen(
    ["php", "-S", f"127.0.0.1:{PORT}", "-t", str(WWW)],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)


def gonder(alanlar):
    veri = urllib.parse.urlencode(alanlar).encode()
    istek = urllib.request.Request(f"http://127.0.0.1:{PORT}/pay/create.php", data=veri, method="POST")
    try:
        with urllib.request.urlopen(istek, timeout=15) as y:
            return y.status, y.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


GECERLI = {
    "dil": "fr", "alis": "Gand", "varis": "Brussels Airport (Zaventem)", "km": "56",
    "tarih": "2030-01-15", "saat": "06:30", "yolcu": "2", "buyuk": "1", "kucuk": "0",
    "arac": "eco", "ad": "Marie Dubois", "eposta": "marie@exemple.be", "telefon": "+32470112233",
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

    # gecerli istek: Mollie anahtari bos oldugundan odeme baslamaz AMA siparis dosyasi
    # olusur ve fiyat SUNUCUDA hesaplanir (istemcinin sahte 'toplam' alani yok sayilir)
    once = set((WWW / "pay" / "orders").glob("ET-*.json"))
    kod, govde = gonder({**GECERLI, "toplam": "1.00", "fiyat": "1.00"})
    kontrol(kod == 422, f"Mollie anahtari bosken err_pay beklenir (HTTP {kod})")
    yeni = set((WWW / "pay" / "orders").glob("ET-*.json")) - once
    kontrol(len(yeni) == 1, f"gecerli istek 1 siparis dosyasi yaratmali ({len(yeni)} bulundu)")
    if len(yeni) == 1:
        siparis = json.loads(next(iter(yeni)).read_text(encoding="utf-8"))
        kontrol(siparis["toplam"] == 121.44 and siparis["kapora"] == 24.29 and siparis["kalan"] == 97.15,
                f"sunucu fiyati bagimsiz hesaplamali: {siparis['toplam']}/{siparis['kapora']}/{siparis['kalan']}")
        kontrol(siparis["km"] == 56 and siparis["km_sunucu"] is None,
                "sunucu anahtari yokken istemci km'si kullanilmali (dogrulanamadi olarak)")
        kontrol(siparis["durum"] == "odeme_baslatilamadi", "durum odeme_baslatilamadi olmali")
        kontrol("necatican" not in json.dumps(siparis).lower(), "siparis kaydinda yasak icerik olmamali")

    # success.php: bilinmeyen siparis -> marka gorunumlu hata, PHP hatasi yok
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/pay/success.php?order=ET-000000-XXXXXX", timeout=10) as y:
        govde = y.read().decode()
    kontrol("EUROPA" in govde and "Warning" not in govde and "Fatal" not in govde,
            "success.php bilinmeyen sipariste temiz hata sayfasi gostermeli")

    # webhook: gecersiz id -> 200 + PHP hatasi yok (Mollie tekrar denemesin)
    veri = urllib.parse.urlencode({"id": "kotu-deger"}).encode()
    with urllib.request.urlopen(
            urllib.request.Request(f"http://127.0.0.1:{PORT}/pay/webhook.php", data=veri), timeout=10) as y:
        kontrol(y.status == 200, "webhook gecersiz id'de bile 200 donmeli")

    # orders.php: sifre bos -> panel kapali uyarisi
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/pay/orders.php", timeout=10) as y:
        govde = y.read().decode()
    kontrol("admin_password" in govde, "orders.php sifre yokken kurulum uyarisi gostermeli")

    # test.php: sifre bos -> kapali
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/pay/test.php", timeout=10) as y:
        govde = y.read().decode()
    kontrol("admin_password" in govde, "test.php sifre yokken kapali olmali")
finally:
    sunucu.terminate()
    # test siparislerini temizle (uretim klasorune test verisi birakma)
    for dosya in (WWW / "pay" / "orders").glob("ET-*.json"):
        dosya.unlink()
    kayit_log = WWW / "pay" / "orders" / "kayit.log"
    if kayit_log.exists():
        kayit_log.unlink()

print()
if hatalar:
    print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
    for x in hatalar:
        print("   -", x)
    sys.exit(1)
print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
