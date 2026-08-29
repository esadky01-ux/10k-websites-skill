# -*- coding: utf-8 -*-
"""
ADIM 4 TESTLERI — .htaccess, sitemap.xml, robots.txt
Calistirma: python3 kaynak/testler/test_adim4.py (once build.py)
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent.parent
WWW = KOK / "www"
KAYNAK = KOK / "kaynak"

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


# ============================================================ A. .htaccess
print("— A. .htaccess")
ht_yolu = WWW / ".htaccess"
kontrol(ht_yolu.exists(), "www/.htaccess yok")
ht = ht_yolu.read_text(encoding="utf-8") if ht_yolu.exists() else ""
kontrol("RewriteCond %{HTTPS} !=on" in ht, "HTTPS zorunlulugu eksik")
kontrol("^www\\." in ht, "www -> ciplak yonlendirmesi eksik")
kontrol("^pay/orders(/.*)?$ - [F,L]" in ht, "pay/orders erisim engeli eksik")
kontrol("config\\.php" in ht, "config.php korumasi eksik")
kontrol("ErrorDocument 404 /fr/index.html" in ht, "404 -> /fr/ eksik")
kontrol('image/jpeg "access plus 1 year"' in ht, "resim onbellegi 1 yil olmali")
kontrol("mod_deflate" in ht, "gzip (mod_deflate) eksik")
kontrol('"config.js"' in ht and "no-cache" in ht,
        "config.js onbellege takilmamali (anahtar degisince aninda okunmali)")
# kok / yonlendirilmemeli (tarayici JS'i yonlendirir); dil onekli yollar da haric
kontrol("!^/(fr|nl|en|tr)(/|$)" in ht, "dil onekli yollar yonlendirme disi olmali")
kontrol("!^/(index\\.html)?$" in ht, "kok / sunucu yonlendirmesinden muaf olmali")
kontrol("!^/(assets|pay)/" in ht, "assets/ ve pay/ yonlendirme disi olmali")
# sunucu tarafi dil algilama YASAK (sartname §3) — yorum satirlari haric
ht_kod = "\n".join(satir for satir in ht.splitlines() if not satir.strip().startswith("#"))
kontrol("Accept-Language" not in ht_kod and "HTTP:Accept" not in ht_kod,
        ".htaccess Accept-Language ile yonlendirme YAPMAMALI")
# IfModule korumalari: paylasimli hostingde eksik modul 500 uretmesin
for modul in ["mod_rewrite.c", "mod_expires.c", "mod_headers.c", "mod_deflate.c"]:
    kontrol(f"<IfModule {modul}>" in ht, f"{modul} IfModule korumasi eksik")

# ============================================================ B. robots.txt
print("— B. robots.txt")
r_yolu = WWW / "robots.txt"
kontrol(r_yolu.exists(), "www/robots.txt yok")
r = r_yolu.read_text(encoding="utf-8") if r_yolu.exists() else ""
kontrol("Disallow: /pay/" in r, "robots.txt /pay/ engellemeli")
kontrol(f"Sitemap: {ALAN}/sitemap.xml" in r, "robots.txt sitemap referansi icermeli")
kontrol("Disallow: /fr" not in r and "Disallow: /assets" not in r,
        "dil sayfalari ve varliklar engellenmemeli")

# ============================================================ C. sitemap.xml
print("— C. sitemap.xml")
s_yolu = WWW / "sitemap.xml"
kontrol(s_yolu.exists(), "www/sitemap.xml yok")
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
      "xhtml": "http://www.w3.org/1999/xhtml"}
try:
    agac = ET.parse(s_yolu)
    urller = agac.getroot().findall("sm:url", NS)
    kontrol(len(urller) == 4, f"sitemap 4 URL icermeli, {len(urller)} var")
    beklenen_locler = {f"{ALAN}/{d}/" for d in ["fr", "nl", "en", "tr"]}
    bulunan_locler = set()
    for u in urller:
        loc = u.find("sm:loc", NS).text
        bulunan_locler.add(loc)
        kontrol(loc.startswith("https://"), f"loc mutlak URL olmali: {loc}")
        # TAM alternate kumesi: 4 dil + x-default (kendisi dahil)
        altlar = u.findall("xhtml:link", NS)
        kontrol(len(altlar) == 5, f"{loc}: 5 xhtml:link olmali, {len(altlar)} var")
        hreflangler = {a.get("hreflang"): a.get("href") for a in altlar}
        kontrol(set(hreflangler) == {"fr-BE", "nl-BE", "en", "tr", "x-default"},
                f"{loc}: hreflang kumesi eksik/yanlis: {sorted(hreflangler)}")
        kontrol(hreflangler.get("x-default") == f"{ALAN}/fr/",
                f"{loc}: x-default /fr/ olmali")
        kontrol(loc in hreflangler.values(), f"{loc}: kendine referansli alternate olmali")
        for href in hreflangler.values():
            kontrol(href.startswith("https://"), f"{loc}: alternate mutlak URL olmali: {href}")
        kontrol(u.find("sm:lastmod", NS) is not None, f"{loc}: lastmod eksik")
    kontrol(bulunan_locler == beklenen_locler,
            f"sitemap loc kumesi yanlis: {sorted(bulunan_locler)}")
except ET.ParseError as e:
    kontrol(False, f"sitemap.xml XML olarak gecersiz: {e}")

# /pay/ sitemap'te olmamali
kontrol("/pay/" not in (s_yolu.read_text(encoding="utf-8") if s_yolu.exists() else ""),
        "sitemap /pay/ icermemeli")

print()
if hatalar:
    print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
    for x in hatalar:
        print("   -", x)
    sys.exit(1)
print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
