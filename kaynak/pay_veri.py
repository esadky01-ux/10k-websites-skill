# -*- coding: utf-8 -*-
"""
PHP odeme katmani icin veri uretimi (build.py bu modulu cagirir).

Uretilenler:
  1) www/pay/mesafe.json   — pay/mesafe.php'nin dahili mesafe motoru icin COMPACT veri.
     Ayni icerik: Node katmani icin vercel_build.py'nin urettigi api/_lib/mesafe.json ile
     ("sabitler", "yerler" -> {"l": [lat,lng], "t": [normalize takma adlar]}, "kesin");
     yerlerde vercel'in ek alanlari (a, h) YOKTUR: PHP yalniz l + t'ye bakar.
     takma adlar = union(yer["takma"] + 4 dilde normalize(yer["ad"])) — build.py veri_js ve
     vercel_build.py ile ayni kume.
  2) pay/unicode_tablo.php — intl (Normalizer) OLMAYAN hostingler icin yedek tablolar:
     'ascii' : kucuk harfli, NFD'de ASCII harfe inen karakterler (JS normalize() ile ayni sonuc)
     'nfc'   : Latin/Yunan/Kiril icin ikili birlesimler (a + U+0300 -> a-grave); yalniz yedek yol.
     Bu dosya elle DUZENLENMEZ: `python3 kaynak/pay_veri.py --unicode-tablo` yeniden uretir
     (testler kaynak dosyanin guncel oldugunu dogrular).

Kullanim (build.py icinden):
    from pay_veri import mesafe_json_yaz
    mesafe_json_yaz(WWW / "pay" / "mesafe.json", veri)      # veri = mesafe-verisi.json icerigi

Komut satiri:
    python3 kaynak/pay_veri.py --mesafe-json HEDEF.json     # mesafe-verisi.json'dan uretir
    python3 kaynak/pay_veri.py --unicode-tablo              # kaynak/pay/unicode_tablo.php'yi yeniden yazar
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

KAYNAK = Path(__file__).resolve().parent
DILLER = ["fr", "nl", "en", "tr"]


# ---------------------------------------------------------------- normalize (JS ile ayni)
def normalize(s):
    """build.py / vercel_build.py / template.html JS'i / pay/mesafe.php ile ayni kurallar.

    NOT: birlestirici isaret olarak YALNIZ U+0300..U+036F silinir (JS: /[\\u0300-\\u036f]/).
    build.py'deki `category == Mn` daha genistir; Latin adreslerde sonuc ayni, egzotik isaretlerde
    (or. U+20D0) fark vardir. Sunucu istemci JS'i ile ayni olmalidir.
    """
    s = s.lower()
    s = s.replace("ı", "i").replace("ß", "ss").replace("œ", "oe").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[̀-ͯ]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------- mesafe.json
def mesafe_json_uret(veri, diller=DILLER):
    """mesafe-verisi.json icerigi -> PHP icin compact sozluk."""
    yerler = veri["yerler"]
    yerler_kompakt = {}
    sahibi = {}
    for anahtar, yer in yerler.items():
        takma = {normalize(t) for t in yer["takma"]} | {normalize(yer["ad"][d]) for d in diller}
        takma.discard("")
        for n in takma:
            if n in sahibi and sahibi[n] != anahtar:
                raise ValueError(f"Takma ad cakismasi: '{n}' hem {sahibi[n]} hem {anahtar}")
            sahibi[n] = anahtar
        yerler_kompakt[anahtar] = {"l": [yer["lat"], yer["lng"]], "t": sorted(takma)}
    kesin = {}
    for a, b, km in veri["kesin"]:
        if a not in yerler or b not in yerler:
            raise ValueError(f"kesin tabloda bilinmeyen yer: {a}|{b}")
        kesin[f"{a}|{b}"] = km
    return {"sabitler": veri["sabitler"], "yerler": yerler_kompakt, "kesin": kesin}


def mesafe_json_yaz(hedef, veri=None):
    """mesafe.json'u hedef yola yazar (veri verilmezse kaynak/mesafe-verisi.json okunur). Yazilan dict'i doner."""
    if veri is None:
        veri = json.loads((KAYNAK / "mesafe-verisi.json").read_text(encoding="utf-8"))
    j = mesafe_json_uret(veri)
    hedef = Path(hedef)
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(json.dumps(j, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return j


# ---------------------------------------------------------------- unicode yedek tablolari
def _php_metni(s):
    """Dizgeyi PHP cift tirnakli \\u{..} kacislariyla yazar (dosya salt ASCII kalir)."""
    return '"' + "".join("\\u{%X}" % ord(c) for c in s) + '"'


def ascii_tablosu():
    """kucuk harf c -> ASCII karsiligi (JS normalize'in 'x'+c+'y' uzerindeki sonucu)."""
    tablo = {}
    for cp in range(0x80, 0x30000):
        if 0xD800 <= cp <= 0xDFFF:
            continue
        c = chr(cp)
        if c.lower() != c:
            continue                       # buyuk harfler once kucultulur; tabloya gerek yok
        if 0x300 <= cp <= 0x36F:
            continue                       # birlestirici isaretler regex ile silinir
        if c in "ıßœæ":
            continue                       # ayri ele alinan ozel harfler
        n = normalize("x" + c + "y")
        if len(n) > 2 and n.startswith("x") and n.endswith("y") and n[1:-1].isalnum() and n[1:-1].isascii():
            tablo[c] = n[1:-1]
    return tablo


def nfc_tablosu():
    """(taban + birlestirici) -> tek karakter. Latin, Yunan, Kiril + Latin Genisletilmis Ek."""
    tablo = {}
    for cp in list(range(0xC0, 0x500)) + list(range(0x1E00, 0x1F00)):
        c = chr(cp)
        d = unicodedata.decomposition(c)
        if not d or d.startswith("<"):
            continue
        parca = d.split()
        if len(parca) != 2:
            continue
        cift = chr(int(parca[0], 16)) + chr(int(parca[1], 16))
        if unicodedata.normalize("NFC", cift) == c:
            tablo[cift] = c
    return tablo


def unicode_tablo_php():
    """kaynak/pay/unicode_tablo.php icerigi."""
    ascii_t = ascii_tablosu()
    nfc_t = nfc_tablosu()
    satirlar = [
        "<?php",
        "// ============================================================",
        "// OTOMATIK URETILDI — elle duzenlemeyin: python3 kaynak/pay_veri.py --unicode-tablo",
        "// intl (Normalizer) olmayan hostingler icin yedek tablolar (yalniz mesafe.php / girdi.php yukler).",
        "//  'ascii': kucuk harfli karakter -> NFD + [U+0300-U+036F] silme sonrasi ASCII karsiligi (JS normalize() ile ayni)",
        "//  'nfc'  : ikili birlesimler (taban + birlestirici -> tek karakter); Latin/Yunan/Kiril; yalniz yedek yol",
        "// ============================================================",
        "return [",
        "    'ascii' => [",
    ]
    for c in sorted(ascii_t):
        satirlar.append("        %s => %s," % (_php_metni(c), "'" + ascii_t[c] + "'"))
    satirlar.append("    ],")
    satirlar.append("    'nfc' => [")
    for k in sorted(nfc_t):
        satirlar.append("        %s => %s," % (_php_metni(k), _php_metni(nfc_t[k])))
    satirlar.append("    ],")
    satirlar.append("];")
    return "\n".join(satirlar) + "\n"


def unicode_tablo_yaz(hedef=None):
    hedef = Path(hedef) if hedef else KAYNAK / "pay" / "unicode_tablo.php"
    hedef.write_text(unicode_tablo_php(), encoding="utf-8")
    return hedef


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--mesafe-json"] and len(args) == 2:
        j = mesafe_json_yaz(args[1])
        print(f"mesafe.json yazildi: {len(j['yerler'])} yer, {len(j['kesin'])} kesin rota -> {args[1]}")
    elif args == ["--unicode-tablo"]:
        h = unicode_tablo_yaz()
        print(f"{h} yazildi")
    else:
        print(__doc__)
        sys.exit(2)
