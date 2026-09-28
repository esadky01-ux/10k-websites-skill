# -*- coding: utf-8 -*-
"""
EUROPA TAXI — Vercel derleyicisi (build.py'den SONRA calisir).

Kullanim:
    python3 kaynak/build.py            # once www/ uretilir
    python3 kaynak/vercel_build.py     # sonra vercel-out/ uretilir
    python3 kaynak/vercel_build.py --out /baska/dizin --www /baska/www   (test icin)

Cikti (varsayilan: repo kokundeki vercel-out/):
    index.html, fr/ nl/ en/ tr/ assets/ robots.txt sitemap.xml ...   <- www/ statik dosyalari
    api/create.js webhook.js success.js orders.js test.js            <- kaynak/vercel/api
    api/_lib/*.js + mesafe.json + dil.json                           <- dil/mesafe verisi UBURADA uretilir
    package.json, (varsa) vercel.json

GUVENLIK: www/pay/ ve HER .php/.htaccess dosyasi ciktiya ALINMAZ (Vercel PHP calistirmaz,
ham metin olarak servis eder; config.php gibi dosyalar sizardi). Cikti taranir, bulunursa HATA.

Kurallar:
- build.py'ye dokunulmaz, import EDILMEZ (import derlemeyi tetikler); gereken mantik kopyalanir.
  PHP_ANAHTARLARI listesi build.py'den ast ile (calistirmadan) okunur; okunamazsa gomulu kopya kullanilir.
- Fiyat sabitleri mesafe-verisi.json, template.html (varsa assets/app.js) ve pay/create.php ile
  BIREBIR ayni olmali; uyusmazlikta HATA.
"""
import argparse
import ast
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

KAYNAK = Path(__file__).resolve().parent
KOK = KAYNAK.parent
VERCEL = KAYNAK / "vercel"
DILLER = ["fr", "nl", "en", "tr"]

# build.py PHP_ANAHTARLARI listesinin gomulu kopyasi (ast ile okunamazsa yedek)
PHP_ANAHTARLARI_YEDEK = [
    "succ_paid_t", "succ_paid_d", "succ_pending_t", "succ_pending_d",
    "succ_fail_t", "succ_fail_d", "succ_ref", "succ_home", "succ_retry", "succ_wa",
    "em_subject", "em_heading", "em_intro", "em_ref", "em_route", "em_date",
    "em_return", "em_vehicle", "em_pax", "em_bags", "em_paid", "em_due",
    "em_cancel_t", "em_outro", "cancel_policy", "dt_join",
    "err_t", "err_pay", "err_km", "err_back",
    "val_route", "val_date", "val_name", "val_email", "val_phone",
    "veh_eco_name", "veh_eco_model", "veh_wagon_name", "veh_wagon_model",
    "veh_vip_name", "veh_vip_model",
]

# Node katmaninin PHP_ANAHTARLARI'na EK olarak ZORUNLU kullandigi anahtarlar (strings.json'da bulunmali).
# val_cancel: iptal onayi sunucuda zorunlu (create.js, iptal=1 yoksa 422). build.py listesine eklenirse cift yazilmaz.
EK_ZORUNLU_ANAHTARLAR = ["val_cancel"]

# strings.json'da VARSA dil.json'a eklenen opsiyonel anahtarlar (Node bunlari yedekli kullanir;
# yoksa err_pay / err_km'ye duser). Bkz. README "gereken yeni strings anahtarlari".
OPSIYONEL_ANAHTARLAR = ["err_rate", "err_forbidden", "err_bad_request", "err_km_wa"]

# Ciktiya ALINMAYACAK statik dosyalar (www/ icinden)
YASAK_UZANTILAR = {".php", ".phtml", ".phar", ".inc", ".log", ".tmp", ".bak", ".sql", ".htaccess", ".htpasswd"}
YASAK_ADLAR = {".htaccess", ".htpasswd", ".DS_Store", "Thumbs.db"}


def hata(mesaj):
    print(f"HATA: {mesaj}")
    sys.exit(1)


def json_oku(yol):
    try:
        return json.loads(yol.read_text(encoding="utf-8"))
    except FileNotFoundError:
        hata(f"dosya yok: {yol}")
    except json.JSONDecodeError as e:
        hata(f"JSON bozuk: {yol}: {e}")


# ---------------------------------------------------------------- argumanlar
ap = argparse.ArgumentParser(description="Vercel cikti dizinini uretir (build.py'den sonra).")
ap.add_argument("--out", default=str(KOK / "vercel-out"), help="cikti dizini (varsayilan: vercel-out/)")
ap.add_argument("--www", default=str(KOK / "www"), help="build.py ciktisi (varsayilan: www/)")
ap.add_argument("--force", action="store_true", help="bos olmayan ve 'vercel-out' adli olmayan cikti dizininin silinmesine izin ver")
ap.add_argument("--test-ucu-yok", action="store_true",
                help="kurulum tanilama ucunu (api/test.js) ciktiya ALMA — kurulum bitince canli dagitim icin onerilir")
ARG = ap.parse_args()
OUT = Path(ARG.out).resolve()
WWW = Path(ARG.www).resolve()

# ---------------------------------------------------------------- girdileri yukle
strings = json_oku(KAYNAK / "strings.json")
veri = json_oku(KAYNAK / "mesafe-verisi.json")
isletme = json_oku(KAYNAK / "isletme.json")
sablon = (KAYNAK / "template.html").read_text(encoding="utf-8")
SABIT = veri["sabitler"]
YERLER = veri["yerler"]

if not VERCEL.is_dir():
    hata(f"kaynak/vercel/ yok: {VERCEL}")
if not (WWW / "index.html").is_file():
    hata(f"{WWW}/index.html yok — once `python3 kaynak/build.py` calistirin")
for d in DILLER:
    if not (WWW / d / "index.html").is_file():
        hata(f"{WWW}/{d}/index.html yok — once `python3 kaynak/build.py` calistirin")
for cakisan in ["api", "package.json", "vercel.json"]:
    if (WWW / cakisan).exists():
        hata(f"{WWW}/{cakisan} var: Vercel fonksiyonlari/yapilandirmasiyla cakisir; www/ icinde bu adlar olmamali")

# ---------------------------------------------------------------- anahtar denetimi (build.py ile ayni)
referans = set(strings["fr"].keys())
for d in DILLER:
    if set(strings[d].keys()) != referans:
        hata(f"strings.json [{d}] anahtar seti farkli")

# ---------------------------------------------------------------- fiyat sabiti esitligi
def js_sabitleri_oku(metin, kaynak_adi, zorunlu):
    """JS SABIT blogundan degerleri ceker (build.py js_sabitleri_oku ile ayni desenler)."""
    desen = {
        "acilis_ucreti": r"ACILIS:\s*([\d.]+)",
        "km_ucreti": r"KM_UCRET:\s*([\d.]+)",
        "kapora_yuzde": r"KAPORA_YUZDE:\s*([\d.]+)",
        "yol_katsayisi": r"YOL_KATSAYI:\s*([\d.]+)",
        "min_km": r"MIN_KM:\s*([\d.]+)",
        "max_km": r"MAX_KM:\s*([\d.]+)",
    }
    sonuc = {}
    for ad, d in desen.items():
        e = re.search(d, metin)
        if not e:
            if zorunlu:
                hata(f"{kaynak_adi} icinde fiyat sabiti bulunamadi: {ad}")
            continue
        sonuc[ad] = float(e.group(1))
    return sonuc


def sabit_karsilastir(bulunan, kaynak_adi):
    for ad, deger in bulunan.items():
        if abs(deger - float(SABIT[ad])) > 1e-9:
            hata(f"Fiyat sabiti uyusmuyor: {kaynak_adi} {ad}={deger}, mesafe-verisi.json {ad}={SABIT[ad]}")


sabit_karsilastir(js_sabitleri_oku(sablon, "template.html", True), "template.html")
uygulama_js = KAYNAK / "assets" / "app.js"
if uygulama_js.is_file():
    bulunan = js_sabitleri_oku(uygulama_js.read_text(encoding="utf-8"), "assets/app.js", False)
    if bulunan:
        sabit_karsilastir(bulunan, "assets/app.js")

create_php = KAYNAK / "pay" / "create.php"
if create_php.is_file():
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
    print("✓ Fiyat sabitleri esit: mesafe-verisi.json = template.html = create.php (Node fiyat.js mesafe.json'dan okur)")
else:
    print("! pay/create.php yok — PHP sabit esitligi kontrol edilemedi")


# ---------------------------------------------------------------- yardimcilar (build.py'den kopya)
def normalize(s):
    """test_adim1.py, build.py ve template.html JS'i ile birebir ayni kurallar."""
    s = s.lower()
    s = s.replace("ı", "i").replace("ß", "ss").replace("œ", "oe").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def para_goster(dil, deger):
    """Statik metinlerdeki tutar bicimi ({base}, {perkm}) — build.py ile ayni."""
    if dil == "en":
        s = f"{deger:.2f}".rstrip("0").rstrip(".")
        return f"€{s}"
    s = f"{deger:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{s} €"


YIL = str(datetime.date.today().year)


def statik_doldur(dil, metin):
    """build.py statik_doldur ile AYNI degisim: derlemede cozulen yer tutucular."""
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


def php_anahtarlari_oku():
    """build.py'deki PHP_ANAHTARLARI listesini CALISTIRMADAN (ast) okur."""
    try:
        agac = ast.parse((KAYNAK / "build.py").read_text(encoding="utf-8"))
        for dugum in ast.walk(agac):
            if isinstance(dugum, ast.Assign) and any(
                    isinstance(t, ast.Name) and t.id == "PHP_ANAHTARLARI" for t in dugum.targets):
                liste = ast.literal_eval(dugum.value)
                if isinstance(liste, list) and liste and all(isinstance(x, str) for x in liste):
                    return liste
    except (OSError, SyntaxError, ValueError):
        pass
    return None


# ---------------------------------------------------------------- dil.json
PHP_ANAHTARLARI = php_anahtarlari_oku()
if PHP_ANAHTARLARI is None:
    print("! build.py'den PHP_ANAHTARLARI okunamadi; gomulu kopya kullaniliyor")
    PHP_ANAHTARLARI = PHP_ANAHTARLARI_YEDEK
elif set(PHP_ANAHTARLARI) != set(PHP_ANAHTARLARI_YEDEK):
    print("i build.py PHP_ANAHTARLARI gomulu kopyadan farkli; build.py'deki liste kullaniliyor")

eksik = [k for k in list(PHP_ANAHTARLARI) + EK_ZORUNLU_ANAHTARLAR if k not in strings["fr"]]
if eksik:
    hata(f"strings.json'da bulunmayan anahtarlar: {eksik}")

opsiyonel = [k for k in OPSIYONEL_ANAHTARLAR if all(k in strings[d] for d in DILLER)]
dil_anahtarlari = list(PHP_ANAHTARLARI)
for k in EK_ZORUNLU_ANAHTARLAR + opsiyonel:
    if k not in dil_anahtarlari:
        dil_anahtarlari.append(k)

dil_json = {
    "diller": {d: {k: statik_doldur(d, strings[d][k]) for k in dil_anahtarlari} for d in DILLER},
    "isletme": {k: v for k, v in isletme.items() if not k.startswith("_")},
}

# ---------------------------------------------------------------- mesafe.json
yerler_kompakt = {}
esleme_sahibi = {}
for anahtar, yer in YERLER.items():
    takma = {normalize(t) for t in yer["takma"]} | {normalize(yer["ad"][d]) for d in DILLER}
    takma.discard("")
    for n in takma:
        if n in esleme_sahibi and esleme_sahibi[n] != anahtar:
            hata(f"Takma ad cakismasi: '{n}' hem {esleme_sahibi[n]} hem {anahtar}")
        esleme_sahibi[n] = anahtar
    yerler_kompakt[anahtar] = {
        "a": yer["ad"],
        "l": [yer["lat"], yer["lng"]],
        "h": bool(yer["havalimani"]),
        "t": sorted(takma),
    }

kesin = {}
for a, b, km in veri["kesin"]:
    if a not in YERLER or b not in YERLER:
        hata(f"kesin tabloda bilinmeyen yer: {a}|{b}")
    kesin[f"{a}|{b}"] = km

mesafe_json = {"sabitler": SABIT, "yerler": yerler_kompakt, "kesin": kesin}

# ---------------------------------------------------------------- cikti dizini
def guvenli_cikti_mi(yol):
    korunan = {Path("/"), Path.home(), KOK, KAYNAK, WWW, VERCEL, KAYNAK / "pay"}
    if yol in korunan:
        return False
    # korunan bir dizinin ATASI olan dizini silme
    for k in korunan:
        try:
            k.relative_to(yol)
            return False
        except ValueError:
            pass
    return True


if not guvenli_cikti_mi(OUT):
    hata(f"cikti dizini guvenli degil: {OUT}")
if OUT.exists():
    if not OUT.is_dir():
        hata(f"cikti bir dizin degil: {OUT}")
    bos = not any(OUT.iterdir())
    if not bos:
        if OUT.name != "vercel-out" and not ARG.force:
            hata(f"{OUT} bos degil ve adi 'vercel-out' degil; silmek icin --force verin")
        shutil.rmtree(OUT)
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- statik dosyalar (www/ -> kok)
atlanan = []
kopyalanan = 0
for kok, dizinler, dosyalar in os.walk(WWW):
    goreli_kok = Path(kok).relative_to(WWW)
    # www/pay/ (PHP katmani) ve her orders/ klasoru HARIC
    kalan = []
    for d in dizinler:
        goreli = goreli_kok / d
        if goreli == Path("pay") or d == "orders" or d == "__pycache__" or (d.startswith(".") and d != ".well-known"):
            atlanan.append(str(goreli) + "/")
        else:
            kalan.append(d)
    dizinler[:] = kalan
    for ad in dosyalar:
        goreli = goreli_kok / ad
        if ad in YASAK_ADLAR or Path(ad).suffix.lower() in YASAK_UZANTILAR or (ad.startswith(".") and goreli_kok == Path(".")):
            atlanan.append(str(goreli))
            continue
        hedef = OUT / goreli
        hedef.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(kok) / ad, hedef)
        kopyalanan += 1

# ---------------------------------------------------------------- Vercel fonksiyonlari
HARIC_VERCEL = {"README.md", "dev-server.js", "node_modules", "__pycache__"}
for kok, dizinler, dosyalar in os.walk(VERCEL / "api"):
    dizinler[:] = [d for d in dizinler if d not in HARIC_VERCEL and not d.startswith(".")]
    for ad in dosyalar:
        if ad in HARIC_VERCEL or ad.startswith("."):
            continue
        # _lib/dil.json ve mesafe.json kaynak agacinda YOKTUR (asagida uretilir); varsa eskimis kopyadir
        if ad in ("dil.json", "mesafe.json"):
            continue
        if ARG.test_ucu_yok and ad == "test.js" and Path(kok).name == "api":
            continue
        goreli = Path(kok).relative_to(VERCEL) / ad
        (OUT / goreli).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(kok) / ad, OUT / goreli)

GEREKLI_REWRITE = {
    "/pay/create.php": "/api/create",
    "/pay/webhook.php": "/api/webhook",
    "/pay/success.php": "/api/success",
    "/pay/orders.php": "/api/orders",
    "/pay/test.php": "/api/test",
}
if (VERCEL / "vercel.json").is_file():
    vj = json_oku(VERCEL / "vercel.json")
    tanimli = {}
    for r in (vj.get("rewrites") or []) if isinstance(vj, dict) else []:
        if isinstance(r, dict) and isinstance(r.get("source"), str) and isinstance(r.get("destination"), str):
            tanimli[r["source"]] = r["destination"]
    gerekli = dict(GEREKLI_REWRITE)
    if ARG.test_ucu_yok:
        gerekli.pop("/pay/test.php")
    eksik_rw = [f"{k} -> {v}" for k, v in gerekli.items() if tanimli.get(k) != v]
    if eksik_rw:
        hata("kaynak/vercel/vercel.json'da gereken rewrite eksik/yanlis: " + "; ".join(eksik_rw))
    for kaynak_yol, hedef_yol in tanimli.items():
        if "_lib" in hedef_yol:
            hata(f"vercel.json: rewrite api/_lib'e yonlenemez: {kaynak_yol} -> {hedef_yol}")
    print("✓ vercel.json: 5 gerekli rewrite (/pay/*.php -> /api/*) tanimli")

for ad in ["package.json", "vercel.json"]:
    if (VERCEL / ad).is_file():
        shutil.copy2(VERCEL / ad, OUT / ad)

lib = OUT / "api" / "_lib"
lib.mkdir(parents=True, exist_ok=True)
(lib / "dil.json").write_text(json.dumps(dil_json, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
(lib / "mesafe.json").write_text(json.dumps(mesafe_json, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

# ---------------------------------------------------------------- guvenlik taramasi
ihlaller = []
for kok, dizinler, dosyalar in os.walk(OUT):
    goreli_kok = Path(kok).relative_to(OUT)
    for d in dizinler:
        if (goreli_kok / d) == Path("pay") or d == "orders":
            ihlaller.append(str(goreli_kok / d) + "/")
    for ad in dosyalar:
        if Path(ad).suffix.lower() in YASAK_UZANTILAR or ad in YASAK_ADLAR:
            ihlaller.append(str(goreli_kok / ad))
if ihlaller:
    hata("cikti dizininde YASAK dosya/dizin bulundu (PHP/.htaccess/pay/orders): " + ", ".join(sorted(ihlaller)))

gerekli = ["index.html", "fr/index.html", "nl/index.html", "en/index.html", "tr/index.html",
           "api/create.js", "api/webhook.js", "api/success.js", "api/orders.js",
           "api/_lib/dil.json", "api/_lib/mesafe.json", "package.json"]
if not ARG.test_ucu_yok:
    gerekli.append("api/test.js")
eksik_dosya = [g for g in gerekli if not (OUT / g).is_file()]
if eksik_dosya:
    hata(f"cikti eksik: {eksik_dosya}")

# ---------------------------------------------------------------- sozdizimi (node --check)
node = shutil.which("node")
if node:
    for js in sorted((OUT / "api").rglob("*.js")):
        p = subprocess.run([node, "--check", str(js)], capture_output=True, text=True)
        if p.returncode != 0:
            hata(f"node --check basarisiz: {js.relative_to(OUT)}\n{p.stderr[:400]}")
else:
    print("! node bulunamadi; sozdizimi denetimi atlandi")

# ---------------------------------------------------------------- rapor
toplam_bayt = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
print(f"✓ Vercel ciktisi hazir: {OUT}")
print(f"  statik dosya: {kopyalanan}   fonksiyon: {len(list((OUT / 'api').glob('*.js')))}   toplam: {toplam_bayt / 1024:.0f} KB")
print(f"  dil.json: {len(dil_anahtarlari)} anahtar x {len(DILLER)} dil"
      + (f" (opsiyonel: {opsiyonel})" if opsiyonel else "")
      + f"   mesafe.json: {len(yerler_kompakt)} yer, {len(kesin)} kesin rota")
print(f"  ciktiya ALINMAYAN (PHP/.htaccess/pay/orders): {len(atlanan)} oge")
if ARG.test_ucu_yok:
    print("  kurulum tanilama ucu (api/test.js) ciktiya ALINMADI")
else:
    print("! api/test.js DAHIL: kurulum bitince `--test-ucu-yok` ile yeniden derleyip dagitin")
