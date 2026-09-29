# -*- coding: utf-8 -*-
"""
PHP ODEME KATMANI TESTLERI — kaynak/pay (PHP 8.4, Combell paylasimli Apache hedefi) + sahte dis servisler
Calistirma:   python3 kaynak/testler/test_php_pay.py            (tam paket + mutasyon kaniti)
              python3 kaynak/testler/test_php_pay.py --mutasyonsuz
Gereksinim:   php CLI (curl, mbstring, intl), node (Node<->PHP esitlik testleri), Python 3.9+. Ag disi.
Cikis kodu 0 = hepsi gecti.

Depoya/`www/`ya DOKUNMAZ: repo gecici dizine kopyalanir, python3 kaynak/build.py orada calisir, uzerine
kaynak/pay (kopyayla gelir) ve pay_veri.py ile mesafe.json konur. Iki www uretilir:
  "mevcut"   : strings.json/build.py DEGISTIRILMEMIS (yeni metin anahtarlari YOK -> PHP yedek anahtarlara duser)
  "onerilen" : kaynak/pay/STRINGS-ONERI.json anahtarlari strings.json + PHP_ANAHTARLARI'na eklenmis (lider entegre edince)
Sahte servisler: kaynak/testler/mock_dis_servisler.py (Mollie + Brevo + Google). PHP: `php -S` (PHP_CLI_SERVER_WORKERS ile
es zamanli isci). Portlar 9600-9699 (bos ardisik blok dinamik secilir; ET_PHP_TEST_PORT ile taban verilebilir).

Kapsam (Node test_vercel_api.py 1-12 karsiliklari + PHP'ye ozgu): vektorler (intl VE intl'siz yol, Node normalize
taramasi), girdi dogrulama, km politikasi (FAIL-CLOSED), mutlu yol, paid + alici basina e-posta bayraklari, iade/chargeback,
tutar uyusmazligi, 48 saat, Brevo/mail() hatasi -> 500 -> tam bir kez, es zamanli 10 webhook, success (canli sorgu),
orders (giris, CSRF, kilit, cerez bayraklari, XSS, temizlik), test.php (?pw= reddi, rapor), oran siniri, Origin, honeypot,
iptal onayi, idem, basliklar, hata sayfasinda yol sizmasi, dosya izinleri, web disi siparis klasoru, siparis_kaydet
basarisizken odeme yok, temizle.php, pay/.htaccess beyaz liste, ortam degiskeni onceligi, log hijyeni, Node esdegerligi.

Mutasyon kaniti (--mutasyonsuz ile atlanir): bilerek bozulmus >= 20 kopya uzerinde ilgili senaryolarin KIRMIZI oldugu gosterilir.
"""
import argparse
import base64
import email
import email.policy
import hashlib
import http.client
import json
import os
import random
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.parse
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

KOK = Path(__file__).resolve().parent.parent.parent
KAYNAK = KOK / "kaynak"
TESTLER = KAYNAK / "testler"
VEKTOR_DOSYASI = TESTLER / "paylasilan-vektorler.json"
PHP = shutil.which("php") or "php"
NODE = shutil.which("node")

hatalar = []
gecen = 0


def kontrol(kosul, mesaj):
    """Basit assert: kosul yanlissa hatayi listeye ekler, testi durdurmaz."""
    global gecen
    if kosul:
        gecen += 1
    else:
        hatalar.append(mesaj)


# ================================================================ sabitler
MOLLIE_ANAHTAR = "test_SirMollieAnahtari0123456789abcd"
BREVO_ANAHTAR = "xkeysib-SirBrevoAnahtari0123456789ab"
GOOGLE_ANAHTAR = "AIzaSirGoogleAnahtari0123456789"
ADMIN_SIFRE = "Yonetici-Sifresi-Test!42"
SIRKET_EPOSTA = "is-emri@sirket.test"
GONDEREN = "noreply@sirket.test"
SIRLAR = [MOLLIE_ANAHTAR, BREVO_ANAHTAR, GOOGLE_ANAHTAR, ADMIN_SIFRE]
KISISEL = ["jan@voorbeeld.be", "470 11 22 33", "Korenmarkt", "Jan Peeters", "+32 470"]
DILLER = ["fr", "nl", "en", "tr"]
TMP = Path(tempfile.mkdtemp(prefix="et_php_test_"))
SUREKLI = []


def port_bos_mu(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def port_tabani(adet=16):
    ham = os.environ.get("ET_PHP_TEST_PORT")
    if ham:
        return int(ham)
    for taban in range(9600, 9700 - adet + 1, 8):
        if all(port_bos_mu(taban + i) for i in range(adet)):
            return taban
    sys.exit("HATA: 9600-9699 araliginda bos ardisik blok bulunamadi (ET_PHP_TEST_PORT ile taban verin)")


PORT0 = None      # main()'de atanir
PORTLAR = {}      # ad -> port


# ================================================================ HTTP yardimcilari
class Yanit:
    def __init__(self, kod, basliklar, ham):
        self.kod = kod
        self.basliklar = basliklar
        self.ham = ham
        self.metin = ham.decode("utf-8", "replace")

    def baslik(self, ad):
        for k, v in reversed(self.basliklar):
            if k.lower() == ad.lower():
                return v
        return None

    def basliklar_hepsi(self, ad):
        return [v for k, v in self.basliklar if k.lower() == ad.lower()]

    def cerez(self, ad):
        for v in self.basliklar_hepsi("set-cookie"):
            if v.startswith(ad + "="):
                return v
        return None


_ip_sayac = [0]
TUM_YANITLAR = []      # (sunucu_adi, yontem, yol, Yanit) — baslik denetimi icin


def yeni_ip():
    _ip_sayac[0] += 1
    n = _ip_sayac[0]
    return f"10.88.{(n // 250) % 250}.{n % 250 + 1}"


def istek(ad, yontem, yol, veri=None, *, ham=None, baslik=None, ip="auto", origin="auto", cerez=None, tip="auto",
          zaman_asimi=60, kayit=True):
    """Sunucu `ad`a HTTP istegi (yonlendirme takip EDILMEZ). veri: dict (liste degerler tekrar eden alan) -> urlencoded."""
    port = PORTLAR[ad]
    govde = None
    if ham is not None:
        govde = ham if isinstance(ham, bytes) else ham.encode("utf-8")
    elif veri is not None:
        govde = urllib.parse.urlencode(veri, doseq=True).encode("utf-8")
    b = {}
    if ip == "auto":
        ip = yeni_ip()
    if ip:
        b["X-Forwarded-For"] = ip
    if origin == "auto":
        origin = f"http://127.0.0.1:{port}" if yontem not in ("GET", "HEAD") else None
    if origin:
        b["Origin"] = origin
    if cerez:
        b["Cookie"] = cerez
    if govde is not None:
        if tip == "auto":
            tip = "application/x-www-form-urlencoded"
        if tip:
            b["Content-Type"] = tip
    b.update(baslik or {})
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=zaman_asimi)
    try:
        c.request(yontem, yol, body=govde, headers=b)
        r = c.getresponse()
        y = Yanit(r.status, r.getheaders(), r.read())
    finally:
        c.close()
    if kayit:
        TUM_YANITLAR.append((ad, yontem, yol.split("?")[0], y))
    return y


def mock(yontem, yol, veri=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTLAR["mock"], timeout=60)
    try:
        c.request(yontem, yol, body=(json.dumps(veri).encode() if veri is not None else None),
                  headers={"Content-Type": "application/json"} if veri is not None else {})
        r = c.getresponse()
        ham = r.read()
        try:
            return json.loads(ham.decode("utf-8"))
        except Exception:
            return {"_ham": ham.decode("utf-8", "replace"), "_kod": r.status}
    finally:
        c.close()


def mollie_ham(yontem, yol, govde=None, anahtar="Bearer " + MOLLIE_ANAHTAR, baslik=None):
    b = {"Content-Type": "application/json"}
    if anahtar:
        b["Authorization"] = anahtar
    b.update(baslik or {})
    c = http.client.HTTPConnection("127.0.0.1", PORTLAR["mock"], timeout=30)
    try:
        c.request(yontem, "/v2/" + yol, body=(json.dumps(govde).encode() if govde is not None else None), headers=b)
        r = c.getresponse()
        ham = r.read()
        try:
            return r.status, json.loads(ham.decode("utf-8"))
        except Exception:
            return r.status, {"_ham": ham.decode("utf-8", "replace")}
    finally:
        c.close()


def mock_sifirla():
    mock("POST", "/__test/reset", {})


def postalar():
    return mock("GET", "/__test/mails")["postalar"]


def odemeler():
    return mock("GET", "/__test/state")["odemeler"]


def bul_posta(kime):
    return [p for p in postalar() if kime in p["alicilar"]]


def bekle_port(port, sn=15):
    bitis = time.time() + sn
    while time.time() < bitis:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def temiz_ortam(**ek):
    e = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "/tmp"), "LANG": "C.UTF-8"}
    e.update(ek)
    return e


def surec_baslat(ad, komut, env, cwd=None):
    log = open(TMP / f"{ad}.log", "wb")
    p = subprocess.Popen(komut, env=env, stdout=log, stderr=subprocess.STDOUT, cwd=str(cwd or TMP))
    SUREKLI.append((p, log))
    return p


def surecleri_kapat(sadece=None):
    for p, log in list(SUREKLI):
        if sadece is not None and p not in sadece:
            continue
        try:
            p.terminate()
        except Exception:
            pass
    for p, log in list(SUREKLI):
        if sadece is not None and p not in sadece:
            continue
        try:
            p.wait(timeout=5)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass
        try:
            log.close()
        except Exception:
            pass
        SUREKLI.remove((p, log))


# ================================================================ bicim yardimcilari
DIL_VERISI = {}       # dil -> {anahtar: metin}  (www/pay/dil.php'den)


def t(dil, anahtar, **degerler):
    s = DIL_VERISI[dil][anahtar]
    for k, v in degerler.items():
        s = s.replace("{" + k + "}", str(v))
    return s


def h_php(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#039;"))


def th(dil, anahtar, **degerler):
    return h_php(t(dil, anahtar, **degerler))


def bugun_brussels():
    if ZoneInfo is not None:
        return datetime.now(ZoneInfo("Europe/Brussels")).date()
    return (datetime.utcnow() + timedelta(hours=2)).date()


def tarih(gun):
    return (bugun_brussels() + timedelta(days=gun)).isoformat()


def form(**ek):
    f = dict(dil="nl", alis="Korenmarkt 77, Gent", varis="Brussels Airport (Zaventem)", km="56",
             kaynak="dahili", tarih=tarih(10), saat="14:30", donus_tarih="", donus_saat="",
             yolcu="3", buyuk="2", kucuk="1", arac="wagon",
             ad="Jan Peeters", eposta="jan@voorbeeld.be", telefon="+32 470 11 22 33", iptal="1")
    f.update(ek)
    return f


def yanit_h1(y):
    m = re.search(r"<h1>(.*?)</h1>", y.metin, re.S)
    return m.group(1) if m else ""


def php_calistir(govde, *, www=None, env=None, ini=None, girdi=None, zaman_asimi=120):
    """PHP kodunu (fonksiyonlar yuklenmis) CLI'da calistirir. Doner: CompletedProcess (stdout/stderr metin)."""
    pay = (www or X.www) / "pay"
    kod = ("<?php declare(strict_types=1);\n$PAY = " + json.dumps(str(pay)) + ";\n"
           "require_once $PAY . '/mailer.php'; require_once $PAY . '/create.php'; require_once $PAY . '/mesafe.php'; "
           "require_once $PAY . '/temizle.php';\n" + govde + "\n")
    yol = TMP / f"harness_{random.randrange(10**9)}.php"
    yol.write_text(kod, encoding="utf-8")
    e = temiz_ortam(**(env or {}))
    try:
        return subprocess.run([PHP, *(ini or []), str(yol)], input=girdi, capture_output=True, text=True, env=e, timeout=zaman_asimi)
    finally:
        try:
            yol.unlink()
        except OSError:
            pass


def php_json(govde, **kw):
    """Kodun sonunda echo json_encode($sonuc) yapmasi beklenir. Doner: (dict|None, CompletedProcess)."""
    p = php_calistir(govde, **kw)
    try:
        return json.loads(p.stdout), p
    except Exception:
        return None, p


# ================================================================ ortam hazirlama
class Ortam:
    """Bir www kopyasi + ondan turetilen sunucular."""

    def __init__(self, ad, www, repo=None):
        self.ad = ad
        self.www = Path(www)
        self.repo = Path(repo) if repo else None
        self.sunucular = {}
        self.siparis_dizinleri = {}
        self.www_e = None
        self.www_f = None
        self.vout = None
        self.tam_kosu = False


X = None       # aktif ortam


def repo_kopyala(hedef):
    hedef.mkdir(parents=True, exist_ok=True)
    p1 = subprocess.Popen(["tar", "--exclude=.git", "--exclude=./www", "--exclude=./teslim", "--exclude=./vercel-out", "-cf", "-", "."],
                          cwd=str(KOK), stdout=subprocess.PIPE)
    p2 = subprocess.run(["tar", "-xf", "-"], cwd=str(hedef), stdin=p1.stdout)
    p1.stdout.close()
    p1.wait()
    if p2.returncode != 0 or p1.returncode != 0:
        raise SystemExit("repo kopyalanamadi")


def strings_onerilerini_uygula(repo):
    """kaynak/pay/STRINGS-ONERI.json'u kopyadaki strings.json + build.py'ye uygular (lider entegrasyonunun simulasyonu)."""
    oneri = json.loads((KAYNAK / "pay" / "STRINGS-ONERI.json").read_text(encoding="utf-8"))
    sj = repo / "kaynak" / "strings.json"
    s = json.loads(sj.read_text(encoding="utf-8"))
    for d in DILLER:
        for k, v in oneri[d].items():
            s[d][k] = v
    sj.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")
    bp = repo / "kaynak" / "build.py"
    b = bp.read_text(encoding="utf-8")
    ek = "".join(f'"{k}", ' for k in oneri["_php_anahtarlari"])
    yeni = b if '"err_km_wa"' in b else b.replace('"err_t", "err_pay", "err_km", "err_back",', '"err_t", "err_pay", "err_km", "err_back", ' + ek.rstrip() , 1)
    if yeni == b and '"err_km_wa"' not in b:
        raise SystemExit("build.py PHP_ANAHTARLARI satiri bulunamadi (test guncellenmeli)")
    bp.write_text(yeni, encoding="utf-8")


def www_uret(ad, onerilen):
    repo = TMP / ad / "repo"
    repo_kopyala(repo)
    if onerilen:
        strings_onerilerini_uygula(repo)
    p = subprocess.run([sys.executable, str(repo / "kaynak" / "build.py")], capture_output=True, text=True, cwd=str(repo))
    if p.returncode != 0:
        raise SystemExit(f"build.py ({ad}) basarisiz:\n{p.stdout}\n{p.stderr}")
    sys.path.insert(0, str(repo / "kaynak"))
    try:
        import importlib
        import pay_veri
        importlib.reload(pay_veri)
        pay_veri.mesafe_json_yaz(repo / "www" / "pay" / "mesafe.json")
    finally:
        sys.path.remove(str(repo / "kaynak"))
    return repo, repo / "www"


def dil_verisi_yukle(www):
    p = subprocess.run([PHP, "-r", f"echo json_encode(require '{www / 'pay' / 'dil.php'}', JSON_UNESCAPED_UNICODE);"], capture_output=True, text=True)
    return json.loads(p.stdout)


SENDMAIL_BETIGI = None


def sendmail_hazirla():
    """php mail() icin sahte sendmail: $ET_SENDMAIL_DIR/fail dosyasi varsa BASARISIZ, yoksa .eml olarak saklar."""
    global SENDMAIL_BETIGI
    yol = TMP / "sendmail_yakala.sh"
    yol.write_text('#!/bin/sh\nD="$ET_SENDMAIL_DIR"\nif [ -f "$D/fail" ]; then cat >/dev/null; exit 1; fi\n'
                   'f="$D/$(date +%s%N).$$.eml"\ncat > "$f"\n', encoding="utf-8")
    yol.chmod(0o755)
    SENDMAIL_BETIGI = yol


def eml_oku(dizin):
    """Yakalanan mail() e-postalarini ayristirir: [{'to','subject','from','reply_to','headers','metin','html','ham'}]."""
    sonuc = []
    for f in sorted(Path(dizin).glob("*.eml")):
        ham = f.read_bytes()
        m = email.message_from_bytes(ham, policy=email.policy.default)
        metin = html = ""
        for parca in m.walk():
            ct = parca.get_content_type()
            if ct == "text/plain":
                metin = parca.get_content()
            elif ct == "text/html":
                html = parca.get_content()
        sonuc.append({"to": str(m["To"]), "subject": str(m["Subject"]), "from": str(m["From"]), "reply_to": m["Reply-To"],
                      "basliklar": ham.split(b"\r\n\r\n", 1)[0].decode("utf-8", "replace"), "metin": metin, "html": html, "ham": ham})
    return sonuc


def php_sunucu(ad, www, env_ek, *, ini=None, preexec=None):
    """`php -S` baslatir (PHP_CLI_SERVER_WORKERS=10). Doner: port."""
    port = PORTLAR[ad]
    mail_dizin = TMP / f"mail_{ad}"
    mail_dizin.mkdir(exist_ok=True)
    env = temiz_ortam(PHP_CLI_SERVER_WORKERS="10", ET_SENDMAIL_DIR=str(mail_dizin), **env_ek)
    komut = [PHP, "-d", f"sendmail_path={SENDMAIL_BETIGI}", *(ini or []), "-S", f"127.0.0.1:{port}", "-t", str(Path(www))]
    if preexec is not None:      # RLIMIT_FSIZE altinda log dosyasina yazilamaz: cikti /dev/null'a
        pr = subprocess.Popen(komut, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=preexec, cwd=str(TMP))
        SUREKLI.append((pr, open(os.devnull, "wb")))
    else:
        surec_baslat("php_" + ad, komut, env)
    ozet_log = (TMP / f"php_{ad}.log").read_text(errors="replace")[:300] if (TMP / f"php_{ad}.log").exists() else ""
    kontrol(bekle_port(port), f"php sunucusu {ad} (port {port}) baslamadi: {ozet_log}")
    return port


def log_oku(ad):
    return (TMP / f"php_{ad}.log").read_text(encoding="utf-8", errors="replace")


def siparis_dizini(ad):
    return TMP / f"siparisler_{ad}"


def siparis_dosyalari(ad):
    return sorted(siparis_dizini(ad).glob("ET-*.json"))


def siparis_oku_dosya(ad, no):
    return json.loads((siparis_dizini(ad) / f"{no}.json").read_text(encoding="utf-8"))


def kayit_log(ad):
    y = siparis_dizini(ad) / "kayit.log"
    return y.read_text(encoding="utf-8", errors="replace") if y.exists() else ""


HATA_TESTI_PHP = r"""<?php
declare(strict_types=1);
// TEST YARDIMCISI (yalniz gecici www kopyasinda): guvenlik_baslat() + kasitli hata tetikleyiciler
require __DIR__ . '/ortak.php';
guvenlik_baslat((string) ($_GET['ad'] ?? 'create'));
switch ($_GET['t'] ?? '') {
    case 'warning':
        $dizi = [];
        echo $dizi['yok']['ic'];              // Warning -> ErrorException -> genel 500
        break;
    case 'notice':
        echo $tanimsiz;                        // Warning (undefined variable)
        break;
    case 'typeerror':
        echo strlen([]);                       // TypeError
        break;
    case 'exception':
        throw new RuntimeException('GIZLI-IC-AYRINTI ' . __FILE__);
    case 'fatal':
        ini_set('memory_limit', '4M');
        $x = str_repeat('x', 50000000);        // Fatal: memory exhausted
        break;
    case 'deprecated':
        $a = [1];
        @trigger_error('kullanimdan kalkan', E_USER_DEPRECATED);
        trigger_error('kullanimdan kalkan', E_USER_DEPRECATED);
        echo 'DEPRECATED-KORUNDU';
        break;
    case 'divzero':
        echo intdiv(1, 0);                     // DivisionByZeroError
        break;
}
"""


def hata_testi_yaz(www):
    (Path(www) / "pay" / "_hata_testi.php").write_text(HATA_TESTI_PHP, encoding="utf-8")


def sunuculari_baslat(www, gruplar=("A", "B", "C", "D", "G", "S", "E", "F", "H", "K")):
    """Mock + gerekli PHP sunucu varyantlari. Ortam degiskenleri Node testleriyle ayni desende."""
    sendmail_hazirla()
    p = PORTLAR
    surec_baslat("mock", [sys.executable, str(TESTLER / "mock_dis_servisler.py"), "--port", str(p["mock"])], temiz_ortam())
    kontrol(bekle_port(p["mock"]), "mock baslamadi")
    M = p["mock"]
    ortak = dict(MOLLIE_API_KEY=MOLLIE_ANAHTAR, MOLLIE_API_BASE=f"http://127.0.0.1:{M}/v2", BREVO_API_BASE=f"http://127.0.0.1:{M}/v3",
                 COMPANY_EMAIL=SIRKET_EPOSTA, MAIL_FROM=GONDEREN, TRUSTED_PROXY_HEADER="HTTP_X_FORWARDED_FOR")
    hata_testi_yaz(www)
    for ad in gruplar:
        siparis_dizini(ad).mkdir(exist_ok=True)
        od = dict(ORDERS_DIR=str(siparis_dizini(ad)))
        site = f"http://127.0.0.1:{p[ad]}" if ad in p else ""
        if ad == "A":
            php_sunucu("A", www, dict(ortak, **od, BREVO_API_KEY=BREVO_ANAHTAR, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=site))
        elif ad == "B":
            php_sunucu("B", www, dict(ortak, **od, BREVO_API_KEY=BREVO_ANAHTAR, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=site,
                                      GOOGLE_SERVER_KEY=GOOGLE_ANAHTAR, GOOGLE_API_BASE=f"http://127.0.0.1:{M}"))
        elif ad == "C":     # https SITE_URL, BREVO yok, ADMIN yok
            php_sunucu("C", www, dict(ortak, **od, SITE_URL="https://europetaxi24.be"))
        elif ad == "D":     # BREVO yok -> mail() yedegi; ADMIN var
            php_sunucu("D", www, dict(ortak, **od, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=site))
        elif ad == "G":     # gecersiz taban adresleri
            php_sunucu("G", www, dict(ortak, **od, MOLLIE_API_BASE="http://evil.example/v2", BREVO_API_BASE="http://127.0.0.1.evil.example/v3",
                                      BREVO_API_KEY=BREVO_ANAHTAR, GOOGLE_SERVER_KEY=GOOGLE_ANAHTAR, GOOGLE_API_BASE="file:///etc/passwd",
                                      ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=site))
        elif ad == "S":     # https SITE_URL + ADMIN (Secure cerez)
            php_sunucu("S", www, dict(ortak, **od, BREVO_API_KEY=BREVO_ANAHTAR, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL="https://europetaxi24.be"))
        elif ad in ("E", "F"):   # ORDERS_DIR YOK: varsayilan (web disi) konum; ayri www kopyasi
            kok = TMP / ad.lower()
            kopya = kok / "www"
            shutil.rmtree(kok, ignore_errors=True)
            shutil.copytree(Path(www), kopya)
            if ad == "F":
                (kok / "et-siparisler").write_text("engel")          # varsayilan konum olusturulamaz -> pay/orders/ yedegi
                X.www_f = kopya
            else:
                X.www_e = kopya
            e = dict(ortak, BREVO_API_KEY=BREVO_ANAHTAR, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=site)
            php_sunucu(ad, kopya, e)
        elif ad == "H":     # dosya yazma basarisiz (RLIMIT_FSIZE=100 bayt): siparis_kaydet FALSE
            import resource
            import signal

            def sinirla():
                signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
                resource.setrlimit(resource.RLIMIT_FSIZE, (100, 100))
            php_sunucu("H", www, dict(ortak, **od, BREVO_API_KEY=BREVO_ANAHTAR, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=site), preexec=sinirla)
        elif ad == "K":     # display_errors=1 (php.ini kotu ayarli): uygulama yine sizdirmamali
            php_sunucu("K", www, dict(ortak, **od, BREVO_API_KEY=BREVO_ANAHTAR, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=site),
                       ini=["-d", "display_errors=1", "-d", "html_errors=1", "-d", "error_reporting=32767", "-d", "log_errors=0"])


class Sip:
    def __init__(self, yanit, odeme, sunucu):
        self.yanit = yanit
        self.odeme = odeme
        self.id = odeme["id"]
        self.no = odeme["metadata"]["order_id"]
        self.sunucu = sunucu

    def dosya(self):
        return siparis_oku_dosya(self.sunucu, self.no)


def siparis_olustur(sunucu="A", **ek):
    """Basarili create -> Sip. Basarisizsa None (yanit siparis_olustur.son'da)."""
    y = istek(sunucu, "POST", "/pay/create.php", form(**ek))
    siparis_olustur.son = y
    if y.kod != 303:
        return None
    m = re.search(r"/checkout/(tr_[A-Za-z0-9]+)$", y.baslik("location") or "")
    if not m:
        return None
    return Sip(y, mollie_ham("GET", "payments/" + m.group(1))[1], sunucu)


# ================================================================ yakalayici sahte sunucu (birim testler icin)
class Yakala:
    """Gelen istekleri kaydeden, yaniti ayarlanabilir kucuk HTTP sunucusu (Brevo/Mollie/Google taklidi)."""

    def __init__(self, port):
        self.port = port
        self.istekler = []
        self.kod = 201
        self.govde = b"{}"
        self.gecikme = 0.0
        self.kuyruk = []          # [(kod, govde)] — doluysa her istek siradaki yaniti alir
        ust = self

        class Isleyici(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *a):
                pass

            def _isle(self):
                n = int(self.headers.get("Content-Length") or 0)
                govde = self.rfile.read(n) if n else b""
                ust.istekler.append({"yontem": self.command, "yol": self.path, "baslik": {k.lower(): v for k, v in self.headers.items()},
                                     "govde": govde})
                if ust.gecikme:
                    time.sleep(ust.gecikme)
                kod, govde_y = (ust.kuyruk.pop(0) if ust.kuyruk else (ust.kod, ust.govde))
                g = govde_y if isinstance(govde_y, bytes) else govde_y.encode()
                self.send_response(kod)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(g)))
                self.end_headers()
                self.wfile.write(g)

            do_GET = do_POST = do_PATCH = _isle

        class S(ThreadingHTTPServer):
            daemon_threads = True
            allow_reuse_address = True

        self.sunucu = S(("127.0.0.1", port), Isleyici)
        self.is_parcacigi = threading.Thread(target=self.sunucu.serve_forever, daemon=True)
        self.is_parcacigi.start()

    def kapat(self):
        self.sunucu.shutdown()
        self.sunucu.server_close()


# ================================================================ STATIK senaryolar
def php_kodu_yorumsuz(yol):
    """PHP dosyasinin yorum ve bosluksuz halini (php_strip_whitespace) doner."""
    p = subprocess.run([PHP, "-r", "echo php_strip_whitespace($argv[1]);", "--", str(yol)], capture_output=True, text=True)
    return p.stdout


def apache_izinli_mi(htaccess, dosya_adi):
    """Apache 2.4 (mod_authz_core) semantigini taklit eder: ust duzey `Require all denied`, FilesMatch icindeki
    `Require all granted` onu ezer. Doner: True (erisilebilir) / False."""
    # IfModule !mod_authz_core (2.2 yedegi) bloklarini at: 2.4'te calismaz
    metin = re.sub(r"<IfModule !mod_authz_core\.c>.*?</IfModule>", "", htaccess, flags=re.S)
    metin = "\n".join(l for l in metin.splitlines() if not l.strip().startswith("#"))
    izin = True
    ust = re.sub(r"<FilesMatch[^>]*>.*?</FilesMatch>", "", metin, flags=re.S)
    if re.search(r"^\s*Require all denied\s*$", ust, re.M) or re.search(r"<IfModule mod_authz_core\.c>\s*Require all denied\s*</IfModule>", ust, re.S):
        izin = False
    for m in re.finditer(r'<FilesMatch\s+"([^"]+)">(.*?)</FilesMatch>', metin, flags=re.S):
        if re.search(m.group(1), dosya_adi):
            govde = re.sub(r"<IfModule !mod_authz_core\.c>.*?</IfModule>", "", m.group(2), flags=re.S)
            if "Require all granted" in govde:
                izin = True
            elif "Require all denied" in govde:
                izin = False
    return izin


def apache22_izinli_mi(htaccess, dosya_adi):
    """Apache 2.2 (Order/Deny/Allow) semantigi: Order allow,deny + Deny from all -> yasak; FilesMatch icinde Allow from all -> izin."""
    metin = re.sub(r"<IfModule mod_authz_core\.c>.*?</IfModule>", "", htaccess, flags=re.S)
    metin = "\n".join(l for l in metin.splitlines() if not l.strip().startswith("#"))
    ust = re.sub(r"<FilesMatch[^>]*>.*?</FilesMatch>", "", metin, flags=re.S)
    izin = not ("Deny from all" in ust)
    for m in re.finditer(r'<FilesMatch\s+"([^"]+)">(.*?)</FilesMatch>', metin, flags=re.S):
        if re.search(m.group(1), dosya_adi):
            if "Allow from all" in m.group(2):
                izin = True
            elif "Deny from all" in m.group(2):
                izin = False
    return izin


def senaryo_statik():
    print("— A. statik: php -l, strict_types, yasak kaliplar, config.php, STRINGS-ONERI.json, .htaccess beyaz liste")
    pay_kaynak = KAYNAK / "pay"
    dosyalar = sorted(pay_kaynak.glob("*.php")) + sorted((X.www / "pay").glob("*.php")) + [TESTLER / "birim_test.php", TESTLER / "vektor_test.php"]
    for d in dosyalar:
        p = subprocess.run([PHP, "-l", str(d)], capture_output=True, text=True)
        kontrol(p.returncode == 0, f"php -l hatasi {d.name}: {(p.stderr or p.stdout)[:200]}")
    gerekli_strict = ["ortak", "guvenlik", "depo", "girdi", "mesafe", "mailer", "create", "webhook", "success", "orders", "test", "temizle"]
    for ad in gerekli_strict:
        icerik = (pay_kaynak / f"{ad}.php").read_text(encoding="utf-8")
        kontrol("declare(strict_types=1);" in icerik, f"{ad}.php: declare(strict_types=1) eksik")
    # kaynak/pay altinda yalniz beklenen dosyalar (yeni dosya .htaccess beyaz listesinde YOK -> yasak kalir)
    beklenen = {"config.php", "create.php", "webhook.php", "success.php", "orders.php", "test.php", "ortak.php", "guvenlik.php",
                "depo.php", "girdi.php", "mesafe.php", "mailer.php", "temizle.php", "unicode_tablo.php"}
    kontrol({d.name for d in pay_kaynak.glob("*.php")} == beklenen, f"kaynak/pay/*.php beklenen kumede degil: {sorted(d.name for d in pay_kaynak.glob('*.php'))}")

    for ad in ["create", "webhook", "success", "orders", "test"]:
        kod = php_kodu_yorumsuz(pay_kaynak / f"{ad}.php")
        kontrol(f"guvenlik_baslat('{ad}')" in kod, f"{ad}.php: guvenlik_baslat('{ad}') cagirmali (basliklar + hata isleyici)")
        kontrol(kod.index("ini_set('display_errors', '0')") < kod.index("require_once") if "ini_set('display_errors', '0')" in kod else False,
                f"{ad}.php: display_errors ilk is olarak kapatilmali (dahil edilen dosyalar yuklenirken bile)")

    # yorum disi kod taramasi
    for ad in gerekli_strict:
        kod = php_kodu_yorumsuz(pay_kaynak / f"{ad}.php")
        kontrol(not re.search(r"\bsleep\s*\(", kod), f"{ad}.php: sleep() KULLANILMAMALI (DoS)")
        kontrol("display_errors', '1'" not in kod and "display_errors','1'" not in kod, f"{ad}.php: display_errors acilmamali")
        kontrol(not re.search(r"\$_REQUEST\b", kod), f"{ad}.php: \\$_REQUEST kullanilmamali")
        kontrol(not re.search(r"\b(eval|exec|shell_exec|system|passthru|proc_open|popen|unserialize)\s*\(", kod), f"{ad}.php: tehlikeli islev")
        kontrol("$_GET['pw']" not in kod and '$_GET["pw"]' not in kod, f"{ad}.php: ?pw= okunmamali")
    kod_test = php_kodu_yorumsuz(pay_kaynak / "test.php")
    kontrol("$_GET" not in kod_test, "test.php: $_GET hic kullanilmamali (sifre URL'de olmaz)")
    kod_create = php_kodu_yorumsuz(pay_kaynak / "create.php")
    kontrol(not any(f"$_POST['{a}']" in kod_create for a in ["toplam", "fiyat", "kapora", "tutar"]), "create.php tarayicidan gelen TUTARI okumamali")
    kontrol("$_POST" not in kod_create and "$_REQUEST" not in kod_create, "create.php ham govdeyi kendisi ayristirmali ($_POST sessizce son degeri alir)")
    kontrol("'tr' => 'fr_BE'" in kod_create or '"tr" => "fr_BE"' in kod_create, "Mollie locale: tr -> fr_BE (Mollie Turkce desteklemez)")
    kontrol("303" in kod_create, "checkout'a 303 yonlendirme")
    # ortak: strict tip uyumu icin get_class disinda uyari uretecek eski kaliplar
    kod_ortak = php_kodu_yorumsuz(pay_kaynak / "ortak.php")
    kontrol("'https://api.mollie.com/v2/'" not in kod_ortak, "Mollie adresi yapilandirilabilir olmali (sabit URL yok)")
    kontrol("maps.googleapis.com" not in php_kodu_yorumsuz(pay_kaynak / "mesafe.php").replace("VARSAYILAN_GOOGLE", ""), "Google adresi yapilandirilabilir olmali")

    # config.php
    cfg_txt = (pay_kaynak / "config.php").read_text(encoding="utf-8")
    p = subprocess.run([PHP, "-r", f"echo json_encode(require '{pay_kaynak / 'config.php'}');"], capture_output=True, text=True)
    c = json.loads(p.stdout)
    for anahtar in ["mollie_api_key", "brevo_api_key", "google_server_key", "admin_password", "orders_dir", "mollie_api_base", "brevo_api_base", "google_api_base", "trusted_proxy_header"]:
        kontrol(c.get(anahtar) == "", f"config.php {anahtar} BOS kalmali (depoya anahtar girmez), bulunan {c.get(anahtar)!r}")
    kontrol("COMMIT ETMEYIN" in cfg_txt.upper() and "GIT" in cfg_txt.upper() and "MOLLIE_API_KEY" in cfg_txt and "ORTAM DEGISKEN" in cfg_txt.upper(),
            "config.php Turkce 'anahtarlari depoya commit etmeyin' + ortam degiskeni uyarisi icermeli")
    for ort in ["MOLLIE_API_KEY", "SITE_URL", "COMPANY_EMAIL", "MAIL_FROM", "BREVO_API_KEY", "GOOGLE_SERVER_KEY", "ADMIN_PASSWORD", "ORDERS_DIR",
                "DISTANCE_TOLERANCE_PCT", "MOLLIE_API_BASE", "BREVO_API_BASE", "GOOGLE_API_BASE", "TRUSTED_PROXY_HEADER"]:
        kontrol(ort in cfg_txt, f"config.php {ort} ortam degiskenini belgelemeli")
    kontrol(not re.search(r"(test|live)_[A-Za-z0-9]{10,}|xkeysib-[A-Za-z0-9]{6,}|AIza[A-Za-z0-9_-]{10,}", cfg_txt), "config.php icinde anahtar benzeri deger olmamali")

    # STRINGS-ONERI.json
    oneri = json.loads((pay_kaynak / "STRINGS-ONERI.json").read_text(encoding="utf-8"))
    kontrol(all(d in oneri for d in DILLER), "STRINGS-ONERI.json 4 dil icermeli")
    if all(d in oneri for d in DILLER):
        kontrol(len({tuple(sorted(oneri[d])) for d in DILLER}) == 1, "STRINGS-ONERI.json: 4 dilde ayni anahtar seti")
        yeni_anahtarlar = set(oneri["fr"])
        kontrol({"err_km_wa", "err_rate", "err_forbidden", "err_bad_request"} <= yeni_anahtarlar, "STRINGS-ONERI.json 4 yeni anahtari icermeli")
        strings = json.loads((KAYNAK / "strings.json").read_text(encoding="utf-8"))
        for k in oneri["_php_anahtarlari"]:
            kontrol(k in oneri["fr"] or k in strings["fr"], f"_php_anahtarlari '{k}' ne oneride ne strings.json'da")
        for d in DILLER:
            for k, v in oneri[d].items():
                kontrol("—" not in v and "–" not in v, f"STRINGS-ONERI [{d}.{k}] duz uzun/orta tire icermemeli")
                kontrol(strings[d].get(k) == v, f"STRINGS-ONERI [{d}.{k}] strings.json'a AYNEN entegre edilmis olmali")
        # Node README §9 ile ayni metinler
        readme = (KAYNAK / "vercel" / "README.md").read_text(encoding="utf-8")
        for d in DILLER:
            for k, v in oneri[d].items():
                kontrol(v in readme, f"STRINGS-ONERI [{d}.{k}] Node README §9 metniyle AYNI olmali")
        nl_metinler = " ".join(oneri["nl"].values()).lower()
        kontrol(not re.search(r"\b(u bent|gelieve nl|kan niet)\b", nl_metinler), "NL metni Belcika Flamancasi tonunda (basit kontrol)")

    # yorum: unicode tablosu kaynagi guncel mi
    sys.path.insert(0, str(KAYNAK))
    try:
        import pay_veri
        kontrol(pay_veri.unicode_tablo_php() == (pay_kaynak / "unicode_tablo.php").read_text(encoding="utf-8"),
                "kaynak/pay/unicode_tablo.php pay_veri.py cikisiyla AYNI olmali (python3 kaynak/pay_veri.py --unicode-tablo)")
        j = pay_veri.mesafe_json_uret(json.loads((KAYNAK / "mesafe-verisi.json").read_text(encoding="utf-8")))
        yaz = json.loads((X.www / "pay" / "mesafe.json").read_text(encoding="utf-8"))
        kontrol(j == yaz, "www/pay/mesafe.json pay_veri.mesafe_json_uret ile AYNI olmali")
        kontrol(len(j["yerler"]) == 71 and all(set(v) == {"l", "t"} for v in j["yerler"].values()), "mesafe.json compact bicim: yalniz l + t")
    finally:
        sys.path.remove(str(KAYNAK))

    # .htaccess beyaz liste
    ht = (pay_kaynak / ".htaccess").read_text(encoding="utf-8")
    kontrol((X.www / "pay" / ".htaccess").read_text(encoding="utf-8") == ht, "build www/pay/.htaccess kaynakla AYNI olmali")
    izinli = ["create.php", "webhook.php", "success.php", "orders.php", "test.php"]
    yasak = ["config.php", "config.php~", "config.old", "config.txt", "config.php.bak", "config.bak", "config.json", "kayit.log", "x.tmp", "dil.php",
             "isletme.php", "ortak.php", "guvenlik.php", "depo.php", "girdi.php", "mesafe.php", "mailer.php", "temizle.php", "unicode_tablo.php",
             "mesafe.json", "STRINGS-ONERI.json", ".htaccess", "test.php~", "test.php.bak", "test.php.old", "orders.php.txt", "create.PHP", "xcreate.php",
             "create.phps", "ET-260101-ABCDEF.json", "yeni_dosya.php", "error_log", "phpinfo.php", "webhook.php.swp", ".env", "composer.json", ""]
    for d in izinli:
        kontrol(apache_izinli_mi(ht, d), f".htaccess (Apache 2.4): {d} ERISILEBILIR olmali")
        kontrol(apache22_izinli_mi(ht, d), f".htaccess (Apache 2.2): {d} ERISILEBILIR olmali")
    for d in yasak:
        kontrol(not apache_izinli_mi(ht, d), f".htaccess (Apache 2.4): {d!r} YASAK olmali")
        kontrol(not apache22_izinli_mi(ht, d), f".htaccess (Apache 2.2): {d!r} YASAK olmali")
    kontrol("Options -Indexes" in ht and re.search(r"^#\s*Options -Indexes", ht, re.M) is not None, "Options -Indexes satiri (yorumda, gerekceyle) belgelenmeli")
    kontrol("Require all denied" in ht and "Order allow,deny" in ht and "Deny from all" in ht and "Allow from all" in ht and "Require all granted" in ht,
            ".htaccess Apache 2.4 + 2.2 sozdizimini icermeli")
    kontrol(ht.count("<IfModule") == ht.count("</IfModule>") and ht.count("<FilesMatch") == ht.count("</FilesMatch>"), ".htaccess etiketleri dengeli")
    orders_ht = (pay_kaynak / "orders" / ".htaccess").read_text(encoding="utf-8")
    kontrol("Require all denied" in orders_ht and "Deny from all" in orders_ht, "orders/.htaccess Apache 2.4 + 2.2 kilidi")
    kontrol(not apache_izinli_mi(orders_ht, "ET-260101-ABCDEF.json") and not apache22_izinli_mi(orders_ht, "kayit.log"), "orders/.htaccess her seyi yasaklar")
    kontrol((X.www / "pay" / "orders" / ".htaccess").exists(), "build www/pay/orders/.htaccess tasimali")


# ================================================================ VEKTORLER (PHP <-> Node <-> Python)
NODE_NORM_JS = r"""
// Node normalize(): tum kod noktalari + birlesik diziler + ozel metinler. argv[1] = vercel-out dizini
const m = require(process.argv[1] + '/api/_lib/mesafe.js');
const out = [];
for (let cp = 0x80; cp <= 0x2FFFF; cp++) {
  if (cp >= 0xD800 && cp <= 0xDFFF) continue;
  const c = String.fromCodePoint(cp);
  out.push(['x' + c + 'y', m.normalize('x' + c + 'y')]);
}
const isaretler = [0x300, 0x301, 0x302, 0x303, 0x308, 0x30a, 0x327, 0x30c, 0x323, 0x344, 0x20d0, 0x1ab0];
for (const tb of 'aAeEiIoOuUcCnNsSzZyY0O') for (const i of isaretler) for (const j of isaretler.slice(0, 5)) {
  const s = tb + String.fromCodePoint(i) + String.fromCodePoint(j) + 'b';
  out.push([s, m.normalize(s)]);
}
for (const s of ['İstanbul', 'ISTANBUL', 'ıi', 'ǅ', 'ẞ', 'ΑΣ', 'Σ', 'K', 'Å', 'Ω', 'ﬃ', 'ǆ', 'ŉ', 'ÀÉÎÕÜ', 'Łódź', 'Ørsted', 'Đà Nẵng', 'Straße',
  'Œuvre', 'Æsop', 'Gent-Sint-Pieters', '  Brussel  ', '\u0000\u0001x', 'a b', 'a​b', '１２３', 'Ｇｅｎｔ', 'mañana', 'crème brûlée',
  'Ḥ', 'ḍ', 'ṣ', 'ệ', 'ế', 'ǖ', 'ǘ', 'Ǭ', 'Bruxelles-Midi', "Rue de l'Étuve 5", 'Zaventem (Brussels Airport)', 'Köln/Bonn Havalimanı', 'İzmir']) out.push([s, m.normalize(s)]);
console.log(JSON.stringify(out));
"""

NODE_FUZZ_JS = r"""
const m = require(process.argv[1] + '/api/_lib/mesafe.js');
const g = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const yerbul = g.yerbul.map((s) => [s, m.yerBul(s)]);
const dahili = g.dahili.map(([a, b]) => [a, b, m.dahiliMesafe(a, b)]);
console.log(JSON.stringify({ yerbul, dahili }));
"""


def node_json(js, girdi=None, *argv):
    p = subprocess.run([NODE, "-e", js, "--", *argv], input=json.dumps(girdi) if girdi is not None else None,
                       capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        kontrol(False, "node betigi basarisiz: " + p.stderr[:300])
        return None
    return json.loads(p.stdout)


def vercel_out_uret():
    """Node katmanini gecici dizine derler (repo kopyasindan; vercel-out'a DOKUNMAZ)."""
    if getattr(X, "vout", None):
        return X.vout
    out = TMP / "vercel_out"
    p = subprocess.run([sys.executable, str(X.repo / "kaynak" / "vercel_build.py"), "--out", str(out), "--www", str(X.www)],
                       capture_output=True, text=True, cwd=str(X.repo))
    kontrol(p.returncode == 0, "vercel_build.py (Node esitlik testi icin) basarisiz: " + p.stdout[-300:] + p.stderr[-300:])
    X.vout = out
    return out


def fuzz_girdileri(mesafe_json, tohum=20260928, adet=2500):
    """Alias/ad tabanli rastgele adres dizeleri (yerBul + dahili icin)."""
    rnd = random.Random(tohum)
    aliaslar = sorted({t for v in mesafe_json["yerler"].values() for t in v["t"]})
    veri = json.loads((KAYNAK / "mesafe-verisi.json").read_text(encoding="utf-8"))
    adlar = sorted({ad for y in veri["yerler"].values() for ad in y["ad"].values()})
    gurultu = ["Rue de la Loi 16", "Korenmarkt 77", "1000", "1930", "Station", "Airport", "Gare du", "Centraal", "de", "la", "Straat", "5", "bus 3",
               "Avenue Louise", "12", "Kerkstraat", "Hbf", "Flughafen", "Zaventem", "Belgium", "Belgique", "9000"]
    ayrac = [", ", " - ", "/", " ", "  ", " , ", "; ", "\n", "\t"]
    s = []
    for _ in range(adet):
        parcalar = []
        for __ in range(rnd.randint(1, 4)):
            r = rnd.random()
            if r < 0.4:
                parcalar.append(rnd.choice(aliaslar))
            elif r < 0.65:
                parcalar.append(rnd.choice(adlar))
            elif r < 0.75:
                parcalar.append(rnd.choice(adlar).upper())
            else:
                parcalar.append(rnd.choice(gurultu))
        metin = rnd.choice(ayrac).join(parcalar)
        if rnd.random() < 0.2:
            metin = metin.replace("e", "é", 1)
        s.append(metin)
    s += aliaslar + adlar
    cift = [[rnd.choice(s), rnd.choice(s)] for _ in range(1500)]
    cift += [[a, b] for a, b in [(adlar[i], adlar[(i * 7 + 3) % len(adlar)]) for i in range(len(adlar))]]
    return s, cift


def senaryo_vektorler():
    print("— B. paylasilan-vektorler.json + Node normalize/yerBul/dahili taramasi (PHP: intl VE intl'siz yol)")
    kontrol(NODE is not None, "node bulunamadi (Node esitlik testleri icin gerekli)")
    V = json.loads(VEKTOR_DOSYASI.read_text(encoding="utf-8"))
    for bolum, en_az in [("fiyat", 40), ("km_karar", 25), ("yer_bul", 25), ("dahili_mesafe", 12), ("dogrulama", 40)]:
        kontrol(len(V.get(bolum, [])) >= en_az, f"vektor bolumu '{bolum}' en az {en_az} vaka icermeli")
    girdi = {"vektorler": V}
    mesafe_json = json.loads((X.www / "pay" / "mesafe.json").read_text(encoding="utf-8"))
    if NODE:
        vout = vercel_out_uret()
        girdi["norm"] = node_json(NODE_NORM_JS, None, str(vout)) or []
        s, cift = fuzz_girdileri(mesafe_json)
        r = node_json(NODE_FUZZ_JS, {"yerbul": s, "dahili": cift}, str(vout)) or {"yerbul": [], "dahili": []}
        girdi["yerbul"] = r["yerbul"]
        girdi["dahili"] = r["dahili"]
        kontrol(len(girdi["norm"]) > 190000 and len(girdi["yerbul"]) > 2500, f"Node beklenen degerleri uretilemedi ({len(girdi['norm'])}, {len(girdi['yerbul'])})")
        bulunan = sum(1 for _, b in girdi["yerbul"] if b is not None)
        kontrol(0.3 < bulunan / max(1, len(girdi["yerbul"])) < 0.99, f"yerBul fuzz kapsami dengesiz: {bulunan}/{len(girdi['yerbul'])} eslesti")
    yol = TMP / "vektor_girdi.json"
    yol.write_text(json.dumps(girdi, ensure_ascii=False), encoding="utf-8")
    for mod, ini in [("intl", []), ("intl'siz (disable_classes=Normalizer)", ["-d", "disable_classes=Normalizer"])]:
        p = subprocess.run([PHP, *ini, str(TESTLER / "vektor_test.php"), str(X.www / "pay"), str(yol)], capture_output=True, text=True, timeout=300)
        try:
            o = json.loads(p.stdout)
        except Exception:
            kontrol(False, f"vektor_test.php [{mod}] calismadi: {p.stdout[:200]} {p.stderr[:300]}")
            continue
        kontrol(o["intl"] == (not ini), f"[{mod}] intl modu beklenenden farkli: {o['intl']}")
        kontrol(o["say"] > 300, f"[{mod}] vektor kontrol sayisi az ({o['say']})")
        for bolum in ["fiyat", "km_karar", "yer_bul", "dahili_mesafe", "dogrulama"]:
            kontrol(o["bolum_say"].get(bolum, 0) > 0, f"[{mod}] {bolum} calistirilmadi")
        if NODE:
            kontrol(o["bolum_say"].get("normalize", 0) > 190000 and o["bolum_say"].get("yerbul_fuzz", 0) > 2500 and o["bolum_say"].get("dahili_fuzz", 0) > 1500,
                    f"[{mod}] Node taramasi calistirilmadi: {o['bolum_say']}")
        for hata in o["hatalar"][:40]:
            kontrol(False, f"[{mod}] " + hata)
        kontrol(len(o["hatalar"]) == 0, f"[{mod}] toplam {len(o['hatalar'])} vektor/normalize uyusmazligi")
        print(f"   [{mod}] {o['say']} kontrol")
    # Python referansi ayni normalize ile: build.py normalize (Mn'nin tamami) yalniz Latin/yaygin girdilerde ayni olmali
    sys.path.insert(0, str(KAYNAK))
    try:
        import pay_veri
        for c in V["yer_bul"]:
            kontrol(pay_veri.normalize(c["girdi"]) is not None, "pay_veri.normalize calismali")
    finally:
        sys.path.remove(str(KAYNAK))

    # ---- tamsayi benzeri takma adlar: JS nesne anahtar sirasi (once tamsayilar artan) PHP'de de aynen taklit edilmeli
    if NODE:
        sint = json.loads(json.dumps(mesafe_json))
        sint["yerler"] = {
            "b": {"l": [51.0, 4.0], "t": ["brug", "2000", "ab cd"], "a": {}, "h": False},
            "a": {"l": [50.0, 3.0], "t": ["gent", "1000", "zz", "10"], "h": False, "a": {}},
            "c": {"l": [49.0, 5.0], "t": ["xy 7", "12345678901", "7", "abcd"], "h": False, "a": {}},
        }
        sint["kesin"] = {}
        vsint = TMP / "vout_sint"
        shutil.copytree(X.vout, vsint)
        (vsint / "api" / "_lib" / "mesafe.json").write_text(json.dumps(sint), encoding="utf-8")
        www_s = TMP / "www_sint"
        shutil.copytree(X.www / "pay", www_s / "pay")
        (www_s / "pay" / "mesafe.json").write_text(json.dumps({k: sint[k] for k in ("sabitler", "yerler", "kesin")}), encoding="utf-8")
        girdiler = ["brug 1000", "1000 brug", "gent 2000", "2000 gent", "brug gent", "zz 2000 brug", "12345678901 gent", "x 1000 y 2000", "2000", "1000",
                    "10", "10 gent", "gent 10", "7 abcd", "abcd 7", "xy 7", "xy 7 brug", "ab cd 2000", "2000 ab cd", "10 1000", "1000 10", "brug", "nope"]
        rnd = random.Random(7)
        tokenler = ["brug", "2000", "ab", "cd", "gent", "1000", "zz", "10", "xy", "7", "abcd", "12345678901", "x"]
        for _ in range(400):
            girdiler.append(" ".join(rnd.choice(tokenler) for __ in range(rnd.randint(1, 4))))
        beklenen = node_json(NODE_FUZZ_JS, {"yerbul": girdiler, "dahili": []}, str(vsint))
        if beklenen:
            sonuc, p = php_json("$g = json_decode(file_get_contents('php://stdin'), true); $o = []; foreach ($g as $s) { $o[] = [$s, mesafe_yer_bul($s)]; } echo json_encode($o);",
                                www=www_s, girdi=json.dumps(girdiler))
            kontrol(sonuc is not None, "sentetik takma ad testi PHP'de calismadi: " + (p.stderr[:300] + p.stdout[:200]))
            if sonuc is not None:
                fark = [(a, b) for a, b in zip(sonuc, beklenen["yerbul"]) if a != b]
                kontrol(not fark, f"tamsayi benzeri takma adlarda PHP == Node olmali (JS anahtar sirasi): {fark[:5]}")
                kontrol(any(b is not None for _, b in beklenen["yerbul"]) and len(sonuc) == len(girdiler), "sentetik takma ad testi bos")


# ================================================================ BIRIM (PHP CLI harness)
def senaryo_birim_girdi():
    print("— C1. girdi: form ayristirma, yapisal hata, temizleme, e-posta/tarih/km uc durumlari")
    kod = r"""
    $o = [];
    $f = girdi_form_coz('a=1&a=2&b%5B%5D=x&c%5Bk%5D=y&d=%zz&e=%E0%A4%A&f=a+b&&=&g&h=%C3%A9&i=%ff%fe');
    $o['form'] = $f;
    $o['yapisal'] = [girdi_yapisal_hata($f), girdi_yapisal_hata(['alis' => ['x']]), girdi_yapisal_hata(['alis[]' => ['x']]),
        girdi_yapisal_hata(['ad[k]' => ['x']]), girdi_yapisal_hata(['bilinmeyen[]' => ['x'], 'bilinmeyen2' => ['a', 'b']]),
        girdi_yapisal_hata(['dil[]' => ['x']]), girdi_yapisal_hata(['iptal' => ['1', '1']]), girdi_yapisal_hata(['web[0]' => ['x']]),
        girdi_yapisal_hata(['km' => ['1']])];
    $cok = [];
    for ($i = 0; $i < 300; $i++) { $cok[] = 'k' . $i . '=v'; }
    $o['parca_siniri'] = count(girdi_form_coz(implode('&', $cok)));
    $temiz = [];
    foreach (["Rue\r\nde\tla\x00Loi", "  a   b  ", "\u{200B}x\u{FEFF}y\u{202E}z", "\xC2\xA0nbsp\xC2\xA0", "Gent\xff", "e\u{0301}e\u{0301}", "\u{2028}a\u{2029}b", "a\u{0085}b", "\u{FFFD}x"] as $s) {
        $temiz[] = girdi_temiz_metin($s);
    }
    $o['temiz'] = $temiz;
    $eposta = [];
    foreach (["jan@x.be", "jan@x.be\n", "jan@x.be\0", "a@b.be\r\nBcc: x@y.be", "a@b.be,c@d.be", "<a@b.be>", "\"a b\"@x.be", "a@b.be>", "a b@x.be", "a@x..be", "a@.x.be",
              "a@x.be.", "a@x-.be", "a@x.b", "a@[1.2.3.4]", "é@x.be", "a@é.be", "a@x.be\u{00A0}", "A.B+c@Sub.Example.CO.UK", "a@xn--80ak6aa92e.com", "a@b.c1", "x@y.123",
              str_repeat('a', 64) . '@x.be', str_repeat('a', 65) . '@x.be'] as $e) {
        $eposta[] = [$e, girdi_eposta_gecerli($e)];
    }
    $o['eposta'] = $eposta;
    $o['kirp'] = [girdi_kirp("\u{00A0} jan@x.be \r\n"), girdi_kirp("\u{3000}x\u{2003}")];
    $o['tam_sayi'] = array_map('girdi_tam_sayi', ['56', ' 56 ', '+56', '-5', '056', '5.6', '1e2', '', "\u{0665}\u{0666}", '1234567890', '123456789', "56\n", 'abc', '0', '-0']);
    $o['idem'] = array_map('girdi_idem', [null, '', 'kisa', str_repeat('a', 15), str_repeat('a', 16), str_repeat('a', 64), str_repeat('a', 65), 'abc-DEF-0123456789xyz', "abc\n0123456789abcdef", 'a b c d e f g h i j k l']);
    // dogrulama: uc durumlar
    $simdi = new DateTimeImmutable('2026-09-28T10:00:00Z');
    $taban = ['dil' => 'nl', 'alis' => 'Gent', 'varis' => 'Brussels Airport', 'km' => '56', 'tarih' => '2026-10-08', 'saat' => '14:30', 'donus_tarih' => '', 'donus_saat' => '',
              'yolcu' => '3', 'buyuk' => '1', 'kucuk' => '0', 'arac' => 'wagon', 'ad' => 'Jan Peeters', 'eposta' => 'jan@voorbeeld.be', 'telefon' => '+32 470 11 22 33'];
    $dv = static function (array $ek) use ($taban, $simdi): array { return girdi_dogrula(array_merge($taban, $ek), $simdi); };
    $o['dv'] = [
        'boru_alis' => $dv(['alis' => 'Gent|Antwerpen']),
        'boru_varis' => $dv(['varis' => 'Brussels|Luxembourg']),
        'alis_120' => $dv(['alis' => str_repeat('a', 120)])['ok'],
        'alis_121' => $dv(['alis' => str_repeat('a', 121)]),
        'dizi_deger' => $dv(['alis' => ['x']]),
        'ad_nul' => $dv(['ad' => "Jan\0\r\nPeeters"])['deger']['ad'] ?? null,
        'alis_gecersiz_utf8' => $dv(['alis' => "Gent\xff\xfe Centrum"])['deger']['alis'] ?? null,
        'eposta_nbsp' => $dv(['eposta' => "\u{00A0}jan@x.be\u{00A0}"])['deger']['eposta'] ?? null,
        'eposta_crlf_son' => $dv(['eposta' => "jan@x.be\r\n"])['deger']['eposta'] ?? null,
        'km_arap' => $dv(['km' => "\u{0665}\u{0666}"]),
        'km_bosluk_yolcu' => $dv(['yolcu' => ' 4 ', 'buyuk' => '99', 'kucuk' => '-1'])['deger'] ?? null,
        'arac_buyuk_harf' => $dv(['arac' => 'VIP'])['deger']['arac'] ?? null,
        'dil_dizi_degil' => $dv(['dil' => 'en'])['deger']['dil'] ?? null,
        'tarih_bugun' => $dv(['tarih' => '2026-09-28'])['ok'],
        'tarih_dun' => $dv(['tarih' => '2026-09-27'])['ok'],
        'tarih_365' => $dv(['tarih' => '2027-09-28'])['ok'],
        'tarih_366' => $dv(['tarih' => '2027-09-29'])['ok'],
        'tarih_0000' => $dv(['tarih' => '0000-01-01'])['ok'],
        'tarih_0050' => $dv(['tarih' => '0050-01-01'])['ok'],
        'tarih_sonda_satir' => $dv(['tarih' => "2026-10-08\n"])['deger']['tarih'] ?? null,
        'donus_ilk_gun_sonra_gecersiz_saat' => $dv(['donus_tarih' => '2026-10-09', 'donus_saat' => '9:00'])['alan'] ?? null,
        'telefon_25' => $dv(['telefon' => str_repeat('1', 25)])['ok'],
        'telefon_rakam_7' => $dv(['telefon' => '+32 (0)47-01'])['ok'],
        'bugun_dst' => [girdi_bugun(new DateTimeImmutable('2026-03-28T23:30:00Z')), girdi_bugun(new DateTimeImmutable('2026-03-29T00:30:00Z')), girdi_bugun(new DateTimeImmutable('2026-10-24T22:30:00Z')), girdi_bugun(new DateTimeImmutable('2026-10-24T21:59:59Z'))],
        'gun_no' => [girdi_gun_no('2026-02-29'), girdi_gun_no('2028-02-29'), girdi_gun_no('1970-01-02'), girdi_gun_no('2026-9-30'), girdi_gun_no("2026-09-30\n")],
    ];
    echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    """
    o, p = php_json(kod)
    if o is None:
        kontrol(False, "girdi birim harness'i calismadi: " + p.stderr[:400] + p.stdout[:300])
        return
    f = o["form"]
    kontrol(f["a"] == ["1", "2"] and f["b[]"] == ["x"] and f["c[k]"] == ["y"] and f["d"] == ["%zz"] and f["f"] == ["a b"] and f["g"] == [""] and f["h"] == ["é"],
            f"form ayristirma: {f}")
    kontrol(f[""] == [""] and f["e"] == ["�%A"] and f["i"] == ["��"], f"gecersiz UTF-8/yuzde dizileri: e={f.get('e')} i={f.get('i')}")
    kontrol(o["yapisal"] == [None, None, "alis", "ad", None, "dil", "iptal", "web", None], f"yapisal hata: {o['yapisal']}")
    kontrol(o["parca_siniri"] == 200, f"en fazla 200 alan ({o['parca_siniri']})")
    kontrol(o["temiz"] == ["Rue de la Loi", "a b", "xyz", "nbsp", "Gent", "éé", "a b", "a b", "x"], f"temiz metin: {o['temiz']}")
    beklenen_eposta = {"jan@x.be": True, "jan@x.be\n": False, "jan@x.be\0": False, "a@b.be\r\nBcc: x@y.be": False, "a@b.be,c@d.be": False, "<a@b.be>": False,
                       "\"a b\"@x.be": False, "a@b.be>": False, "a b@x.be": False, "a@x..be": False, "a@.x.be": False, "a@x.be.": False, "a@x-.be": False,
                       "a@x.b": False, "a@[1.2.3.4]": False, "é@x.be": False, "a@é.be": False, "a@x.be ": False, "A.B+c@Sub.Example.CO.UK": True,
                       "a@xn--80ak6aa92e.com": True, "a@b.c1": False, "x@y.123": False, "a" * 64 + "@x.be": True, "a" * 65 + "@x.be": False}
    for e, ok in o["eposta"]:
        kontrol(beklenen_eposta[e] == ok, f"e-posta {e!r}: beklenen {beklenen_eposta[e]} bulunan {ok}")
    kontrol(o["kirp"] == ["jan@x.be", "x"], f"girdi_kirp: {o['kirp']}")
    kontrol(o["tam_sayi"] == [56, 56, 56, -5, None, None, None, None, None, None, 123456789, 56, None, 0, 0], f"girdi_tam_sayi: {o['tam_sayi']}")
    a16, a64 = "a" * 16, "a" * 64
    kontrol(o["idem"] == ["", "", "", "", a16, a64, "", "abc-DEF-0123456789xyz", "", ""], f"idem: {o['idem']}")
    dv = o["dv"]
    kontrol(dv["boru_alis"] == {"ok": False, "alan": "alis", "anahtar": "val_route"}, f"'|' alis: {dv['boru_alis']}")
    kontrol(dv["boru_varis"] == {"ok": False, "alan": "varis", "anahtar": "val_route"}, f"'|' varis: {dv['boru_varis']}")
    kontrol(dv["alis_120"] is True and dv["alis_121"]["ok"] is False, "alis 120 kabul / 121 ret")
    kontrol(dv["dizi_deger"]["ok"] is False, "dizi deger (girdi_dogrula dogrudan) bos sayilir -> val_route")
    kontrol(dv["ad_nul"] == "Jan Peeters", f"NUL+CRLF ad: {dv['ad_nul']!r}")
    kontrol(dv["alis_gecersiz_utf8"] == "Gent Centrum", f"gecersiz UTF-8 alis: {dv['alis_gecersiz_utf8']!r}")
    kontrol(dv["eposta_nbsp"] == "jan@x.be" and dv["eposta_crlf_son"] == "jan@x.be", "e-posta bas/son bosluk (NBSP, CRLF) kirpilir")
    kontrol(dv["km_arap"]["anahtar"] == "err_km", "Arapca-Hint rakamli km reddedilir")
    kontrol(dv["km_bosluk_yolcu"]["yolcu"] == 4 and dv["km_bosluk_yolcu"]["buyuk"] == 6 and dv["km_bosluk_yolcu"]["kucuk"] == 0, f"yolcu/valiz sinirlama: {dv['km_bosluk_yolcu']}")
    kontrol(dv["arac_buyuk_harf"] == "eco" and dv["dil_dizi_degil"] == "en", "arac buyuk harf -> eco; dil en")
    kontrol(dv["tarih_bugun"] and not dv["tarih_dun"] and dv["tarih_365"] and not dv["tarih_366"], "tarih sinirlari (bugun..+365)")
    kontrol(not dv["tarih_0000"] and not dv["tarih_0050"], "0000/0050 yillari gecersiz")
    kontrol(dv["tarih_sonda_satir"] == "2026-10-08", "tarihte sondaki satir sonu kirpilir (JS trim ile ayni)")
    kontrol(dv["donus_ilk_gun_sonra_gecersiz_saat"] == "donus_saat", "donus saati 9:00 gecersiz")
    kontrol(dv["telefon_25"] and not dv["telefon_rakam_7"], "telefon: 25 karakter kabul, 7 rakam ret")
    kontrol(dv["bugun_dst"] == ["2026-03-29", "2026-03-29", "2026-10-25", "2026-10-24"], f"Brussels bugunu (DST gecisleri): {dv['bugun_dst']}")
    kontrol(dv["gun_no"][0] is None and dv["gun_no"][1] is not None and dv["gun_no"][2] == 1 and dv["gun_no"][3] is None and dv["gun_no"][4] is None, f"gun_no: {dv['gun_no']}")


def senaryo_birim_guvenlik():
    print("— C2. guvenlik yardimcilari: IP, Origin, log temizligi, yapilandirma, oran siniri, kilit, CSRF/oturum yardimcilari")
    od = TMP / "birim_od"
    shutil.rmtree(od, ignore_errors=True)
    od.mkdir()
    kod = r"""
    $o = [];
    // ---- istemci_ip
    $ip = static function (string $baslik, array $server) use (&$o): string {
        putenv('TRUSTED_PROXY_HEADER=' . $baslik); cfg(true);
        $GLOBALS['_SERVER'] = $server;
        return istemci_ip();
    };
    $o['ip'] = [
        $ip('', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => '1.2.3.4']),
        $ip('HTTP_X_FORWARDED_FOR', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => '1.2.3.4, 5.6.7.8']),
        $ip('HTTP_X_FORWARDED_FOR', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => 'unknown, 9.9.9.9, 1.1.1.1']),
        $ip('X-Forwarded-For', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => ' 2001:DB8:0:0::1 ']),
        $ip('x-forwarded-for', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => 'evil, <script>, 999.1.1.1']),
        $ip('HTTP_X_FORWARDED_FOR', ['REMOTE_ADDR' => '203.0.113.9']),
        $ip('REMOTE_ADDR', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => '1.2.3.4']),
        $ip('kotu baslik!', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => '1.2.3.4']),
        $ip('', ['REMOTE_ADDR' => 'garip']),
        $ip('', []),
        $ip('CF-Connecting-IP', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_CF_CONNECTING_IP' => '::ffff:1.2.3.4']),
        $ip('HTTP_X_FORWARDED_FOR', ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => ['dizi']]),
    ];
    // ---- kaynak_izinli
    putenv('TRUSTED_PROXY_HEADER='); putenv('SITE_URL=https://europetaxi24.be'); cfg(true);
    $iz = static function (array $server): bool { $GLOBALS['_SERVER'] = $server; return kaynak_izinli(); };
    $o['origin'] = [
        $iz([]), $iz(['HTTP_ORIGIN' => 'https://europetaxi24.be']), $iz(['HTTP_ORIGIN' => 'https://www.europetaxi24.be']),
        $iz(['HTTP_ORIGIN' => 'https://europetaxi24.be:443']), $iz(['HTTP_ORIGIN' => 'HTTPS://EUROPETAXI24.BE']), $iz(['HTTP_ORIGIN' => 'null']),
        $iz(['HTTP_ORIGIN' => 'https://evil.example']), $iz(['HTTP_ORIGIN' => 'https://europetaxi24.be.evil.example']), $iz(['HTTP_ORIGIN' => 'https://europetaxi24.be:8443']),
        $iz(['HTTP_ORIGIN' => 'not a url']), $iz(['HTTP_ORIGIN' => '']), $iz(['HTTP_REFERER' => 'https://evil.example/x']),
        $iz(['HTTP_REFERER' => 'https://europetaxi24.be/fr/']), $iz(['HTTP_ORIGIN' => 'https://europetaxi24.be', 'HTTP_REFERER' => 'https://evil.example/']),
        $iz(['HTTP_ORIGIN' => 'https://baska.example', 'HTTP_HOST' => 'baska.example']), $iz(['HTTP_ORIGIN' => 'https://baska.example', 'HTTP_HOST' => 'europetaxi24.be']),
        $iz(['HTTP_ORIGIN' => 'ftp://europetaxi24.be']), $iz(['HTTP_ORIGIN' => 'null', 'HTTP_REFERER' => 'https://evil.example/']),
        $iz(['HTTP_REFERER' => 'javascript:alert(1)']), $iz(['HTTP_ORIGIN' => 'https://europetaxi24.be@evil.example']),
    ];
    // ---- kayit_temizle
    $o['kayit'] = [
        kayit_temizle("ilk\r\n2026-01-01 00:00:00  SAHTE satir\nson"),
        kayit_temizle('siparis ET-260929-5D6BE1 odeme tr_TIFhJUUM5f'),
        kayit_temizle('musteri jan.peeters@voorbeeld.be aradi'),
        kayit_temizle('tel +32 470 11 22 33 ve 0470112233'),
        kayit_temizle('anahtar test_SirMollieAnahtari0123456789abcd bitti'),
        kayit_temizle('token ' . str_repeat('A', 40)),
        kayit_temizle(str_repeat('x', 500)),
        kayit_temizle("NUL\0bayt ve\x1b[31mrenk\x7f"),
        kayit_temizle("unicode\u{2028}ayirici\u{0085}c1"),
        kayit_temizle('ET-260929-123456 kalir'),
        kayit_temizle("\xff\xfe gecersiz utf8"),
    ];
    // ---- yapilandirma
    foreach (['MOLLIE_API_BASE','BREVO_API_BASE','GOOGLE_API_BASE','SITE_URL','DISTANCE_TOLERANCE_PCT'] as $e) { putenv($e); }
    $bazi = ['http://127.0.0.1:9500/v2', 'https://api.mollie.com/v2', 'http://evil.example/v2', 'http://127.0.0.1.evil.example/v2', 'ftp://127.0.0.1/v2', 'http://localhost:9500/v2',
             'file:///etc/passwd', 'javascript:alert(1)', 'https://user:pw@api.mollie.com/v2', 'gecersiz', 'http://127.0.0.1:9500/v2/', '', 'http://127.0.0.1@evil.example/v2',
             "http://127.0.0.1/v2\r\nX: y", 'HTTP://127.0.0.1:1/v2', 'http://[::1]:9500/v2', 'https://api.mollie.com/v2//'];
    $o['taban'] = array_map(static fn (string $u): mixed => taban_url($u, 'VARSAYILAN'), $bazi);
    putenv('SITE_URL=javascript:alert(1)'); putenv('DISTANCE_TOLERANCE_PCT=abc'); cfg(true);
    $o['cfg_kotu'] = [cfg()['site_url'], cfg()['distance_tolerance_pct']];
    putenv('SITE_URL=https://ornek.be/'); putenv('DISTANCE_TOLERANCE_PCT=15'); putenv('MOLLIE_API_BASE=http://evil.example/v2'); cfg(true);
    $o['cfg_iyi'] = [cfg()['site_url'], cfg()['distance_tolerance_pct'], cfg()['mollie_api_base'], cfg()['brevo_api_base']];
    putenv('DISTANCE_TOLERANCE_PCT=150'); cfg(true);
    $o['tol150'] = cfg()['distance_tolerance_pct'];
    putenv('DISTANCE_TOLERANCE_PCT=12.5'); cfg(true);
    $o['tol125'] = cfg()['distance_tolerance_pct'];
    // ---- oran siniri (sahte zaman)
    putenv('ORDERS_DIR=' . getenv('BIRIM_OD'));
    $t0 = 1000000000;
    $k = [[60, 5], [3600, 30]];
    $o['oran_ilk5'] = array_map(static fn (int $i): bool => oran_siniri_dene('a', '1.1.1.1', $k, $t0 + $i)['izin'], [0, 1, 2, 3, 4]);
    $alti = oran_siniri_dene('a', '1.1.1.1', $k, $t0 + 10);
    $o['oran_alti'] = [$alti['izin'], $alti['bekleme']];
    $o['oran_baska_ip'] = oran_siniri_dene('a', '2.2.2.2', $k, $t0 + 10)['izin'];
    $o['oran_baska_kova'] = oran_siniri_dene('b', '1.1.1.1', $k, $t0 + 10)['izin'];
    $o['oran_1dk_sonra'] = oran_siniri_dene('a', '1.1.1.1', $k, $t0 + 61)['izin'];
    $gecen = [];
    for ($i = 0; $i < 30; $i++) { $gecen[] = oran_siniri_dene('c', '3.3.3.3', $k, $t0 + $i * 13)['izin']; }
    $otuzbir = oran_siniri_dene('c', '3.3.3.3', $k, $t0 + 30 * 13);
    $o['oran_saat'] = [!in_array(false, $gecen, true), $otuzbir['izin'], $otuzbir['bekleme'], oran_siniri_dene('c', '3.3.3.3', $k, $t0 + 3600 + 30)['izin']];
    // reddedilen istek sayilmaz: 5 gecer, 6. red (x3), 61 sn sonra izin
    // ---- kaba kuvvet
    $o['kk_ilk4'] = array_map(static fn (int $i): int => kaba_kuvvet_basarisiz('9.9.9.9', $t0 + $i), [0, 1, 2, 3]);
    $o['kk_5'] = kaba_kuvvet_basarisiz('9.9.9.9', $t0 + 5);
    $o['kk_kilitli'] = kaba_kuvvet_kalan('9.9.9.9', $t0 + 60);
    $o['kk_baska_ip'] = kaba_kuvvet_kalan('8.8.8.8', $t0 + 60);
    $o['kk_sonra'] = kaba_kuvvet_kalan('9.9.9.9', $t0 + 900 + 6);
    $o['kk_dosya_silindi'] = count(glob(siparis_klasoru() . '/rl/*.json')) ;
    for ($i = 0; $i < 4; $i++) { kaba_kuvvet_basarisiz('7.7.7.7', $t0 + $i); }
    kaba_kuvvet_temizle('7.7.7.7');
    $o['kk_temizle_sonra'] = kaba_kuvvet_basarisiz('7.7.7.7', $t0 + 10);
    // eski hata sayaci 15 dk sonra sifirlanir
    for ($i = 0; $i < 3; $i++) { kaba_kuvvet_basarisiz('6.6.6.6', $t0 + $i); }
    $o['kk_eski_sayac'] = array_map(static fn (int $i): int => kaba_kuvvet_basarisiz('6.6.6.6', $t0 + 2000 + $i), [0, 1, 2, 3]);
    // ---- rl dosya adlari hash'li, izinler 0600
    $dosyalar = glob(siparis_klasoru() . '/rl/*.json');
    $o['rl_adlar'] = array_map(static fn (string $d): bool => preg_match('/^[0-9a-f]{64}\.json\z/', basename($d)) === 1, $dosyalar);
    $o['rl_izin'] = array_unique(array_map(static fn (string $d): string => substr(sprintf('%o', fileperms($d)), -4), $dosyalar));
    $o['rl_klasor_izin'] = substr(sprintf('%o', fileperms(siparis_klasoru() . '/rl')), -4);
    $o['rl_temizle'] = rl_temizle(-1) >= 1;
    // ---- admin yardimcilari
    putenv('ADMIN_PASSWORD=Gizli-Sifre-12345'); cfg(true);
    $o['sifre'] = [admin_sifre_dogru('Gizli-Sifre-12345'), admin_sifre_dogru(' Gizli-Sifre-12345 '), admin_sifre_dogru('gizli-sifre-12345'), admin_sifre_dogru(''), admin_sifre_dogru('Gizli-Sifre-1234'), admin_sifre_dogru(str_repeat('x', 5000))];
    putenv('ADMIN_PASSWORD='); cfg(true);
    $o['sifre_bos'] = [admin_sifre_dogru(''), admin_sifre_dogru('x')];
    $GLOBALS['_SESSION'] = [];
    $b1 = csrf_belirteci();
    $o['csrf'] = [strlen($b1) === 64, csrf_belirteci() === $b1, csrf_dogru($b1), csrf_dogru($b1 . 'x'), csrf_dogru(''), csrf_dogru(null), csrf_dogru(['x'])];
    echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    """
    o, p = php_json(kod, env={"BIRIM_OD": str(od)})
    if o is None:
        kontrol(False, "guvenlik birim harness'i calismadi: " + p.stderr[:600] + p.stdout[:300])
        return
    kontrol(o["ip"] == ["203.0.113.9", "1.2.3.4", "9.9.9.9", "2001:db8::1", "203.0.113.9", "203.0.113.9", "203.0.113.9", "203.0.113.9", "bilinmiyor", "bilinmiyor", "::ffff:1.2.3.4", "203.0.113.9"],
            f"istemci_ip: {o['ip']}")
    beklenen_origin = [True, True, True, True, True, True, False, False, False, False, False, False, True, False, True, False, False, False, False, False]
    kontrol(o["origin"] == beklenen_origin, f"kaynak_izinli: {[(i, a, b) for i, (a, b) in enumerate(zip(o['origin'], beklenen_origin)) if a != b]}")
    k = o["kayit"]
    kontrol("\n" not in k[0] and "\r" not in k[0] and k[0].startswith("ilk ") and k[0].endswith("SAHTE satir son"), f"log satiri enjeksiyonu: {k[0]!r}")
    kontrol(k[1] == "siparis ET-260929-5D6BE1 odeme tr_TIFhJUUM5f", f"siparis no / odeme id korunur: {k[1]!r}")
    kontrol(k[2] == "musteri [eposta] aradi", f"e-posta maskelenir: {k[2]!r}")
    kontrol("470" not in k[3] and "112233" not in k[3], f"telefon maskelenir: {k[3]!r}")
    kontrol("test_Sir" not in k[4] and "[anahtar]" in k[4], f"API anahtari maskelenir: {k[4]!r}")
    kontrol("AAAA" not in k[5] and "[token]" in k[5], f"uzun token maskelenir: {k[5]!r}")
    kontrol(len(k[6]) <= 300, "log satiri en fazla 300 karakter")
    kontrol(all(ord(c) >= 32 and ord(c) != 127 for c in k[7]) and "\x00" not in k[7] and "\x1b" not in k[7], f"kontrol karakterleri temizlenir: {k[7]!r}")
    kontrol(" " not in k[8] and "\x85" not in k[8], f"unicode satir ayiricilar temizlenir: {k[8]!r}")
    kontrol(k[9] == "ET-260929-123456 kalir", f"rakamdan olusan siparis no telefon gibi maskelenmez: {k[9]!r}")
    kontrol(isinstance(k[10], str) and "\xff" not in k[10], "gecersiz UTF-8 log sanitizasyonunu bozmaz")
    beklenen_taban = ["http://127.0.0.1:9500/v2", "https://api.mollie.com/v2", None, None, None, None, None, None, None, None, "http://127.0.0.1:9500/v2", "VARSAYILAN", None, None,
                      "HTTP://127.0.0.1:1/v2", None, "https://api.mollie.com/v2//".rstrip("/")]
    kontrol(o["taban"] == beklenen_taban, f"taban_url matrisi: {[(a, b) for a, b in zip(o['taban'], beklenen_taban) if a != b]}")
    kontrol(o["cfg_kotu"] == ["https://europetaxi24.be", 12], f"gecersiz SITE_URL/tolerans varsayilana duser: {o['cfg_kotu']}")
    kontrol(o["cfg_iyi"] == ["https://ornek.be", 15, None, "https://api.brevo.com/v3"], f"cfg ortam onceligi: {o['cfg_iyi']}")
    kontrol(o["tol150"] == 12 and o["tol125"] == 12.5, f"tolerans 0..100: {o['tol150']} {o['tol125']}")
    kontrol(o["oran_ilk5"] == [True] * 5 and o["oran_alti"][0] is False and 1 <= o["oran_alti"][1] <= 60, f"oran siniri dakikada 5: {o['oran_ilk5']} {o['oran_alti']}")
    kontrol(o["oran_baska_ip"] is True and o["oran_baska_kova"] is True and o["oran_1dk_sonra"] is True, "oran siniri: baska IP / baska kova / 1 dk sonra izin")
    kontrol(o["oran_saat"][0] is True and o["oran_saat"][1] is False and o["oran_saat"][2] > 3000 and o["oran_saat"][3] is True, f"oran siniri saatte 30: {o['oran_saat']}")
    kontrol(o["kk_ilk4"] == [0, 0, 0, 0] and o["kk_5"] > 800 and o["kk_kilitli"] > 0 and o["kk_baska_ip"] == 0 and o["kk_sonra"] == 0,
            f"kaba kuvvet: 5. basarisiz -> 15 dk kilit: {o['kk_ilk4']} {o['kk_5']} {o['kk_kilitli']} {o['kk_baska_ip']} {o['kk_sonra']}")
    kontrol(o["kk_temizle_sonra"] == 0, "kaba kuvvet temizle sayaci sifirlar")
    kontrol(o["kk_eski_sayac"] == [0, 0, 0, 0], f"15 dk'dan eski hata sayaci sifirlanir: {o['kk_eski_sayac']}")
    kontrol(o["rl_adlar"] and all(o["rl_adlar"]) and o["rl_izin"] == ["0600"] and o["rl_klasor_izin"] == "0700", f"rl dosyalari hash'li adli, 0600; klasor 0700: {o['rl_izin']} {o['rl_klasor_izin']}")
    kontrol(o["rl_temizle"] is True, "rl_temizle eski dosyalari siler")
    kontrol(o["sifre"] == [True, True, False, False, False, False] and o["sifre_bos"] == [False, False], f"admin_sifre_dogru: {o['sifre']} {o['sifre_bos']}")
    kontrol(o["csrf"] == [True, True, True, False, False, False, False], f"csrf: {o['csrf']}")


def senaryo_birim_depo():
    print("— C3. depo: flock'lu atomik guncelleme (coklu surec), izinler, siparis_odeme_uygula matrisi, siparis_kaydet hatasi")
    od = TMP / "depo_od"
    shutil.rmtree(od, ignore_errors=True)
    od.mkdir()
    # ---- coklu surec: 8 x 60 artirma
    cocuk = (r"""<?php declare(strict_types=1);
    require $argv[1] . '/ortak.php';
    for ($i = 0; $i < 60; $i++) {
        siparis_guncelle('ET-260101-ABCDEF', static function (array $s): array { $s['sayac'] = (int) $s['sayac'] + 1; $s['uzun'] = str_repeat('x', 3000 + ($s['sayac'] % 7) * 100); return $s; });
    }
    """)
    cocuk_yol = TMP / "cocuk_artir.php"
    cocuk_yol.write_text(cocuk, encoding="utf-8")
    env = temiz_ortam(ORDERS_DIR=str(od))
    # onceden siparis dosyasini olustur
    p0 = subprocess.run([PHP, "-r", "declare(strict_types=1); require $argv[1] . '/ortak.php'; var_dump(siparis_kaydet(['no' => 'ET-260101-ABCDEF', 'sayac' => 0, 'durum' => 'beklemede']));", "--", str(X.www / "pay")],
                        capture_output=True, text=True, env=env)
    kontrol("bool(true)" in p0.stdout, "siparis_kaydet ilk yazim: " + p0.stdout + p0.stderr[:200])
    isciler = [subprocess.Popen([PHP, str(cocuk_yol), str(X.www / "pay")], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(8)]
    for i in isciler:
        i.wait(timeout=120)
    kontrol(all(i.returncode == 0 for i in isciler), "coklu surec yazicilari hata verdi: " + "".join(i.stderr.read()[:200] for i in isciler))
    s = json.loads((od / "ET-260101-ABCDEF.json").read_text(encoding="utf-8"))
    kontrol(s["sayac"] == 8 * 60, f"flock: 8 surec x 60 guncelleme kayipsiz olmali (sayac={s['sayac']})")
    kalan = sorted(x.name for x in od.iterdir() if x.name.startswith(".tmp"))
    kontrol(not kalan, f"gecici dosya kalintisi olmamali: {kalan}")
    kontrol(oct((od / "ET-260101-ABCDEF.json").stat().st_mode & 0o777) == "0o600", "siparis dosyasi 0600")
    kontrol(oct(od.stat().st_mode & 0o777) == "0o700", f"siparis klasoru 0700 ({oct(od.stat().st_mode & 0o777)})")
    kontrol(oct((od / "kayit.log").stat().st_mode & 0o777) == "0o600" if (od / "kayit.log").exists() else True, "kayit.log 0600")
    kontrol((od / ".htaccess").exists() and "Require all denied" in (od / ".htaccess").read_text(), "siparis klasorune .htaccess kilidi yazilir")
    kontrol(oct((od / "ET-260101-ABCDEF.json.lock").stat().st_mode & 0o777) == "0o600", "kilit dosyasi 0600")

    kod = r"""
    $o = [];
    $s0 = ['no' => 'ET-260101-ABCDEF', 'durum' => 'beklemede', 'kapora' => 24.29, 'mollie_id' => 'tr_x', 'mollie_durum' => 'open'];
    $paid = static fn (array $ek = []): array => array_replace_recursive(['status' => 'paid', 'id' => 'tr_x', 'amount' => ['currency' => 'EUR', 'value' => '24.29'], 'paidAt' => '2026-09-28T10:00:00+00:00'], $ek);
    $d = static fn (array $s, array $odeme): array => siparis_odeme_uygula($s, $odeme);
    $durum = static fn (array $s, array $odeme): string => siparis_odeme_uygula($s, $odeme)['durum'];
    $odendi = $d($s0, $paid());
    $iade = $d($s0, $paid(['amountRefunded' => ['currency' => 'EUR', 'value' => '5.00']]));
    $uyus = $d($s0, $paid(['amount' => ['value' => '1.00']]));
    $o['mat'] = [
        'open' => $d($s0, ['status' => 'open']) === $s0,
        'paid' => $durum($s0, $paid()),
        'paid_odenen_yok' => $durum($s0, ['status' => 'paid', 'id' => 'tr_x', 'paidAt' => 'x']),
        'paid_1eur' => $durum($s0, $paid(['amount' => ['value' => '1.00']])),
        'paid_usd' => $durum($s0, $paid(['amount' => ['currency' => 'USD']])),
        'paid_24_3' => $durum($s0, $paid(['amount' => ['value' => '24.3']])),
        'paid_iade' => $durum($s0, $paid(['amountRefunded' => ['currency' => 'EUR', 'value' => '5.00']])),
        'paid_iade_sifir' => $durum($s0, $paid(['amountRefunded' => ['currency' => 'EUR', 'value' => '0.00']])),
        'paid_chargeback' => $durum($s0, $paid(['amountChargedBack' => ['currency' => 'EUR', 'value' => '24.29']])),
        'paid_ikisi' => $durum($s0, $paid(['amountRefunded' => ['value' => '1.00'], 'amountChargedBack' => ['value' => '1.00']])),
        'paid_uyus_ve_iade' => $durum($s0, $paid(['amount' => ['value' => '1.00'], 'amountRefunded' => ['value' => '1.00']])),
        'odendi_canceled' => $durum($odendi, ['status' => 'canceled']),
        'odendi_open' => $durum($odendi, ['status' => 'open']),
        'odendi_failed' => $durum($odendi, ['status' => 'failed']),
        'odendi_expired' => $durum($odendi, ['status' => 'expired']),
        'odendi_ayni' => $d($odendi, $paid()) === $odendi,
        'odendi_canceled_ayni_dizi' => $d($odendi, ['status' => 'canceled']) === $odendi,
        'iade_expired' => $durum($iade, ['status' => 'expired']),
        'iade_paid_iadesiz' => $durum($iade, $paid()),
        'chargeback_paid_temiz' => $durum($d($s0, $paid(['amountChargedBack' => ['currency' => 'EUR', 'value' => '24.29']])), $paid()),
        'uyus_paid_dogru_tutar' => $durum($uyus, $paid()),
        'iade_paid_chargeback' => $durum($iade, $paid(['amountChargedBack' => ['currency' => 'EUR', 'value' => '24.29']])),
        'uyus_failed' => $durum($uyus, ['status' => 'failed']),
        'bekl_expired' => $durum($s0, ['status' => 'expired']),
        'bekl_failed' => $durum($s0, ['status' => 'failed']),
        'bekl_canceled' => $durum($s0, ['status' => 'canceled']),
        'bekl_authorized' => $durum($s0, ['status' => 'authorized']),
        'bekl_pending' => $durum($s0, ['status' => 'pending']),
        'baslatilamadi_open' => $durum(['durum' => 'odeme_baslatilamadi'] + $s0, ['status' => 'open']),
        'yok_status' => $durum($s0, []),
    ];
    $o['odeme_alanlari'] = [$odendi['odenen_tutar'], $odendi['iade'], $odendi['geri_odeme'], $odendi['odeme_zamani'], $iade['iade']];
    $o['bayrak'] = [siparis_eposta_bayraklari([]), siparis_eposta_bayraklari(['eposta_gonderildi' => true]), siparis_eposta_bayraklari(['eposta_gonderildi' => true, 'eposta_musteri' => true, 'eposta_sirket' => false]),
                    siparis_eposta_bayraklari(['eposta_musteri' => true]), siparis_eposta_bayraklari(['eposta_musteri' => true, 'eposta_sirket' => true])];
    // siparis no
    $o['no'] = array_map('siparis_no_gecerli', ['ET-260101-ABCDEF', "ET-260101-ABCDEF\n", 'ET-260101-abcdef', 'ET-26010-ABCDEF', 'ET-260101-ABCDEFG', '../ET-260101-ABCDEF', 'ET-260101-ABCDE', '']);
    try { siparis_yolu('../../etc/passwd'); $o['yol_enj'] = 'gecti'; } catch (\InvalidArgumentException $e) { $o['yol_enj'] = 'reddedildi'; }
    $o['oku_bozuk_no'] = siparis_oku("ET-260101-ABCDEF\n");
    $o['uret'] = [siparis_no_gecerli(siparis_no_uret()), preg_match('/^ET-' . date('ymd') . '-[0-9A-F]{6}\z/', siparis_no_uret())];
    // siparis_kaydet hatalari
    $o['kaydet_gecersiz_utf8'] = siparis_kaydet(['no' => 'ET-260101-BBBBBB', 'ad' => "\xff\xfe"]);
    $o['kaydet_no_yok'] = siparis_kaydet(['ad' => 'x']);
    $o['kaydet_kotu_no'] = siparis_kaydet(['no' => '../x']);
    $o['kaydet_dosya_olusmadi'] = file_exists(siparis_klasoru() . '/ET-260101-BBBBBB.json');
    // guncelle: olmayan siparis, gecersiz no
    $o['guncelle_yok'] = [siparis_guncelle('ET-260101-ZZZZZZ', static fn (array $s): array => $s), siparis_guncelle('../x', static fn (array $s): array => $s)];
    // guncelle: istisna kilidi birakir
    try { siparis_guncelle('ET-260101-ABCDEF', static function (array $s): array { throw new RuntimeException('x'); }); } catch (\RuntimeException) {}
    $o['istisna_sonrasi'] = siparis_guncelle('ET-260101-ABCDEF', static fn (array $s): array => $s + ['x' => 1])['x'] ?? null;
    // ara kaydet
    try { siparis_guncelle('ET-260101-ABCDEF', static function (array $s, callable $kaydet): array { $s['ara'] = 1; $kaydet($s); throw new RuntimeException('sonra hata'); }); } catch (\RuntimeException) {}
    echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    """
    o, p = php_json(kod, env={"ORDERS_DIR": str(od)})
    if o is None:
        # RuntimeException disari sizabilir (son satir): stdout bos olur; yeniden dene
        kontrol(False, "depo birim harness'i calismadi: " + p.stderr[:600] + p.stdout[:300])
        return
    m = o["mat"]
    beklenen = {"open": True, "paid": "odendi", "paid_odenen_yok": "tutar_uyusmazligi", "paid_1eur": "tutar_uyusmazligi", "paid_usd": "tutar_uyusmazligi", "paid_24_3": "tutar_uyusmazligi",
                "paid_iade": "iade", "paid_iade_sifir": "odendi", "paid_chargeback": "chargeback", "paid_ikisi": "chargeback", "paid_uyus_ve_iade": "tutar_uyusmazligi",
                "odendi_canceled": "odendi", "odendi_open": "odendi", "odendi_failed": "odendi", "odendi_expired": "odendi", "odendi_ayni": True, "odendi_canceled_ayni_dizi": True,
                "iade_expired": "iade", "iade_paid_iadesiz": "iade", "chargeback_paid_temiz": "chargeback", "uyus_paid_dogru_tutar": "tutar_uyusmazligi", "iade_paid_chargeback": "chargeback", "uyus_failed": "tutar_uyusmazligi", "bekl_expired": "suresi_doldu", "bekl_failed": "basarisiz",
                "bekl_canceled": "iptal", "bekl_authorized": "beklemede", "bekl_pending": "beklemede", "baslatilamadi_open": "beklemede", "yok_status": "beklemede"}
    for k, v in beklenen.items():
        kontrol(m[k] == v, f"siparis_odeme_uygula[{k}]: beklenen {v!r} bulunan {m[k]!r}")
    kontrol(o["odeme_alanlari"] == ["24.29 EUR", "0.00", "0.00", "2026-09-28T10:00:00+00:00", "5.00"], f"odeme alanlari: {o['odeme_alanlari']}")
    kontrol(o["bayrak"] == [{"musteri": False, "sirket": False}, {"musteri": True, "sirket": True}, {"musteri": True, "sirket": False}, {"musteri": True, "sirket": False},
                            {"musteri": True, "sirket": True}], f"alici bayraklari (eski tek bayrak dahil): {o['bayrak']}")
    kontrol(o["no"] == [True, False, False, False, False, False, False, False], f"siparis_no_gecerli (\\z: sondaki \\n kabul edilmez): {o['no']}")
    kontrol(o["yol_enj"] == "reddedildi" and o["oku_bozuk_no"] is None, "yol enjeksiyonu / bozuk no reddedilir")
    kontrol(o["uret"][0] is True and o["uret"][1] == 1, f"siparis_no_uret bicimi: {o['uret']}")
    kontrol(o["kaydet_gecersiz_utf8"] is False and o["kaydet_no_yok"] is False and o["kaydet_kotu_no"] is False and o["kaydet_dosya_olusmadi"] is False,
            f"siparis_kaydet json_encode/no hatasinda FALSE ve dosya yok: {o}")
    kontrol(o["guncelle_yok"] == [None, None], "siparis_guncelle olmayan/gecersiz siparis -> null")
    kontrol(o["istisna_sonrasi"] == 1, "callable istisna verse de kilit serbest kalir")
    s = json.loads((od / "ET-260101-ABCDEF.json").read_text(encoding="utf-8"))
    kontrol(s.get("ara") == 1, "ara kaydet (callable icinden) istisnadan sonra da kalici")


def senaryo_birim_dis_servis():
    print("— C4. dis servis istemcileri: e-posta (Brevo + mail() yedegi), Mollie, Google, checkout_guvenli")
    ini_mail = ["-d", f"sendmail_path={SENDMAIL_BETIGI}"]
    md = TMP / "birim_mail"
    shutil.rmtree(md, ignore_errors=True)
    md.mkdir()
    od = TMP / "birim_dis_od"
    shutil.rmtree(od, ignore_errors=True)
    od.mkdir()
    yak = Yakala(PORTLAR["yak1"])
    try:
        # ---------------------------------------------------------- e-posta
        kod = r"""
        $o = [];
        putenv('MAIL_FROM=noreply@sirket.test'); putenv('COMPANY_EMAIL=is@sirket.test'); putenv('BREVO_API_KEY='); putenv('BREVO_API_BASE='); cfg(true);
        $o['normal'] = eposta_gonder('jan@x.be', 'Konu ş ü ğ', '<p>Merhaba</p>', 'Merhaba dunya', 'is@sirket.test', 'ET-260101-ABCDEF musteri');
        $o['enj'] = array_map(static fn (string $k): array => eposta_gonder($k, 'K', '<p>x</p>'),
            ["a@b.be\r\nBcc: x@y.be", 'a@b.be,c@d.be', '<a@b.be>', "a\0b@x.be", 'a b@x.be', "a@b.be\n", '"x"@y.be', '']);
        $o['konu_crlf'] = eposta_gonder('jan@x.be', "Konu\r\nBcc: kotu@x.be\r\n\r\ngovde", '<p>x</p>', 'x');
        $o['reply_kotu'] = eposta_gonder('jan@x.be', 'Reply kotu', '<p>x</p>', 'x', "x@y.be\r\nBcc: z@y.be");
        $o['reply_yok'] = eposta_gonder('jan@x.be', 'Reply yok', '<p>x</p>', '');
        $o['nul_govde'] = eposta_gonder('jan@x.be', "Nul\0konu", "<p>a\0b</p>", "a\0b");
        putenv('MAIL_FROM=x@y.be' . "\r\n" . 'Bcc: z@y.be'); cfg(true);
        $o['gonderen_kotu'] = eposta_gonder('jan@x.be', 'K', '<p>x</p>');
        putenv('MAIL_FROM=noreply@sirket.test'); cfg(true);
        // ---- Brevo basarili
        putenv('BREVO_API_KEY=xkeysib-Deneme0123456789'); putenv('BREVO_API_BASE=http://127.0.0.1:' . getenv('YAK1') . '/v3'); cfg(true);
        $o['brevo_ok'] = eposta_gonder('jan@x.be', 'Brevo konu', '<p>Brevo govde</p>', 'Brevo metin', 'is@sirket.test', 'ET-260101-ABCDEF musteri');
        $o['brevo_replysiz'] = eposta_gonder('is@sirket.test', 'Sirket konu', '<pre>x</pre>', 'x', null, 'ET-260101-ABCDEF sirket');
        echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        """
        env = {"ET_SENDMAIL_DIR": str(md), "ORDERS_DIR": str(od), "YAK1": str(PORTLAR["yak1"])}
        yak.kod = 201
        yak.govde = '{"messageId":"<x@y>"}'
        o, p = php_json(kod, env=env, ini=ini_mail)
        if o is None:
            kontrol(False, "e-posta harness'i calismadi: " + p.stderr[:600] + p.stdout[:300])
            return
        emls = eml_oku(md)
        kontrol(o["normal"] == {"ok": True, "yontem": "mail", "hata": None}, f"mail() yedegi basarili: {o['normal']}")
        m0 = emls[0] if emls else {}
        kontrol(m0.get("to") == "jan@x.be" and m0.get("subject") == "Konu ş ü ğ" and m0.get("reply_to") == "is@sirket.test" and "noreply@sirket.test" in m0.get("from", ""),
                f"mail() basliklari (To/Subject/Reply-To/From): {m0.get('to')} {m0.get('subject')} {m0.get('reply_to')} {m0.get('from')}")
        kontrol(m0.get("metin", "").strip() == "Merhaba dunya" and m0.get("html", "").strip() == "<p>Merhaba</p>", "mail() govdesi (plain + html) base64 ile bozulmadan")
        for i, r in enumerate(o["enj"]):
            kontrol(r["ok"] is False and r["hata"] == "gecersiz_alici", f"alici enjeksiyonu #{i} reddedilmeli: {r}")
        kontrol(o["konu_crlf"]["ok"] is True, "konuda CRLF: temizlenip gonderilir")
        konu_crlf = [e for e in emls if "Konu" in e["subject"] and "Bcc" in e["subject"]]
        kontrol(len(konu_crlf) == 1 and "\nBcc:" not in konu_crlf[0]["basliklar"] and "kotu@x.be" not in konu_crlf[0]["basliklar"].replace(konu_crlf[0]["subject"], ""),
                f"konu CRLF baslik enjeksiyonu yapamaz: {[e['basliklar'] for e in konu_crlf]}")
        rk = [e for e in emls if e["subject"] == "Reply kotu"]
        kontrol(o["reply_kotu"]["ok"] is True and len(rk) == 1 and rk[0]["reply_to"] is None and "Bcc" not in rk[0]["basliklar"], "gecersiz Reply-To atlanir, Bcc enjekte edilemez")
        ry = [e for e in emls if e["subject"] == "Reply yok"]
        kontrol(len(ry) == 1 and ry[0]["reply_to"] is None, "Reply-To verilmezse baslik yok")
        kontrol(o["nul_govde"]["ok"] is True, f"govdede NUL: base64 kodlandigi icin gonderilir/temiz hata: {o['nul_govde']}")
        kontrol(o["gonderen_kotu"] == {"ok": False, "yontem": "yok", "hata": "gonderen_gecersiz"}, f"mail_from CRLF: {o['gonderen_kotu']}")
        kontrol(all("Bcc:" not in e["basliklar"] for e in emls), "hicbir e-postada enjekte Bcc basligi yok")
        kontrol(len(emls) == 5, f"yakalanan mail() sayisi 5 olmali (normal, konu_crlf, reply_kotu, reply_yok, nul_govde): {len(emls)} {[e['subject'] for e in emls]}")
        # Brevo istekleri
        bi = [i for i in yak.istekler if i["yol"] == "/v3/smtp/email"]
        kontrol(o["brevo_ok"] == {"ok": True, "yontem": "brevo", "hata": None} and o["brevo_replysiz"]["ok"] is True and len(bi) == 2, f"Brevo istekleri: {len(bi)} {o['brevo_ok']}")
        if len(bi) == 2:
            g0, g1 = json.loads(bi[0]["govde"]), json.loads(bi[1]["govde"])
            kontrol(bi[0]["baslik"].get("api-key") == "xkeysib-Deneme0123456789" and bi[0]["baslik"].get("content-type") == "application/json", "Brevo api-key + content-type basliklari")
            kontrol(g0["sender"] == {"name": "Europa Taxi", "email": "noreply@sirket.test"} and g0["to"] == [{"email": "jan@x.be"}] and g0["subject"] == "Brevo konu"
                    and g0["htmlContent"] == "<p>Brevo govde</p>" and g0["textContent"] == "Brevo metin", f"Brevo govdesi: {g0}")
            kontrol(g0.get("replyTo") == {"email": "is@sirket.test"}, f"Brevo replyTo = company_email: {g0.get('replyTo')}")
            kontrol("replyTo" not in g1 and g1["to"] == [{"email": "is@sirket.test"}], "sirket e-postasinda replyTo yok")
        # ---------------------------------------------------------- Brevo hatalari -> mail() yedegi
        for f in md.glob("*.eml"):
            f.unlink()
        yak.istekler.clear()
        kod2 = r"""
        $o = [];
        putenv('MAIL_FROM=noreply@sirket.test'); putenv('BREVO_API_KEY=xkeysib-Deneme0123456789'); putenv('BREVO_API_BASE=http://127.0.0.1:' . getenv('YAK1') . '/v3'); cfg(true);
        $o['brevo_500'] = eposta_gonder('jan@x.be', 'B500', '<p>x</p>', 'x', null, 'ET-260101-ABCDEF musteri');
        putenv('BREVO_API_BASE=http://127.0.0.1:1/v3'); cfg(true);
        $o['brevo_baglanti_yok'] = eposta_gonder('jan@x.be', 'Bkapali', '<p>x</p>', 'x');
        putenv('BREVO_API_BASE=http://evil.example/v3'); cfg(true);
        $o['brevo_taban_gecersiz'] = eposta_gonder('jan@x.be', 'Bgecersiz', '<p>x</p>', 'x');
        echo json_encode($o);
        """
        yak.kod = 500
        yak.govde = '{"code":"boom","message":"jan@x.be gecersiz"}'
        o2, p2 = php_json(kod2, env=env, ini=ini_mail)
        kontrol(o2 is not None, "Brevo hata harness'i calismadi: " + p2.stderr[:400])
        if o2 is not None:
            kontrol(all(o2[k] == {"ok": True, "yontem": "mail", "hata": None} for k in o2), f"Brevo hatasi -> mail() yedegi basarili: {o2}")
            kontrol(sorted(e["subject"] for e in eml_oku(md)) == ["B500", "Bgecersiz", "Bkapali"], "3 yedek e-posta yakalandi")
            kontrol(len([i for i in yak.istekler if i["yol"] == "/v3/smtp/email"]) == 1, "gecersiz taban (evil.example) icin Brevo istegi YAPILMADI; kapali port 1 kez denenmedi")
        (md / "fail").write_text("1")
        o3, p3 = php_json(kod2.replace("echo json_encode($o);", "echo json_encode($o);"), env=env, ini=ini_mail)
        if o3 is not None:
            kontrol(all(o3[k]["ok"] is False and o3[k]["yontem"] == "mail" for k in o3), f"mail() de basarisizsa ok=false: {o3}")
        (md / "fail").unlink()
        # mail() devre disi (Combell gibi hostlar): \Throwable yakalanir, temiz hata
        o4, p4 = php_json(r"""putenv('MAIL_FROM=noreply@sirket.test'); putenv('BREVO_API_KEY='); cfg(true);
            echo json_encode(eposta_gonder('jan@x.be', 'K', '<p>x</p>', 'x'));""", env=env, ini=["-d", "disable_functions=mail"])
        kontrol(o4 == {"ok": False, "yontem": "mail", "hata": "mail_istisna"}, f"mail() devre disi -> temiz hata: {o4} {p4.stderr[:200]}")
        log = (od / "kayit.log").read_text(encoding="utf-8") if (od / "kayit.log").exists() else ""
        kontrol("jan@x.be" not in log and "Brevo hatasi (HTTP 500" in log, f"e-posta hatalari loga KISISEL VERI yazmaz (yalniz kod): {log[-400:]}")

        # ---------------------------------------------------------- Mollie istemcisi
        yak.istekler.clear()
        yak.kod, yak.govde = 201, '{"id":"tr_abc","status":"open"}'
        kod5 = r"""
        $o = [];
        putenv('MOLLIE_API_KEY=test_Deneme0123456789abcdefghijk'); putenv('MOLLIE_API_BASE=http://127.0.0.1:' . getenv('YAK1') . '/v2'); cfg(true);
        $o['post'] = mollie('POST', 'payments', ['a' => 1, 'u' => 'é/x'], ['idempotency' => 'et-ET-260101-ABCDEF']);
        $o['get'] = mollie('GET', 'payments/tr_abc');
        $o['idem_kotu'] = mollie('POST', 'payments', ['a' => 1], ['idempotency' => "bad key\r\nX: y"]);
        $o['idem_uzun'] = mollie('POST', 'payments', ['a' => 1], ['idempotency' => str_repeat('a', 81)]);
        putenv('MOLLIE_API_BASE=http://evil.example/v2'); cfg(true);
        $o['taban_kotu'] = mollie('GET', 'methods');
        putenv('MOLLIE_API_BASE='); putenv('MOLLIE_API_KEY='); cfg(true);
        $o['anahtar_yok'] = mollie('GET', 'methods');
        putenv('MOLLIE_API_KEY=test_Deneme0123456789abcdefghijk'); putenv('MOLLIE_API_BASE=http://127.0.0.1:1/v2'); cfg(true);
        $o['baglanti_yok'] = mollie('GET', 'methods');
        echo json_encode($o, JSON_UNESCAPED_UNICODE);
        """
        o5, p5 = php_json(kod5, env=env)
        kontrol(o5 is not None, "mollie harness'i calismadi: " + p5.stderr[:400])
        if o5 is not None:
            kontrol(o5["post"][0] == 201 and o5["post"][1]["id"] == "tr_abc" and o5["get"][0] == 201, f"mollie() yanit ayristirma: {o5['post']}")
            ist = yak.istekler
            kontrol(len(ist) == 4, f"yalniz 4 gercek istek atilmali (taban_kotu/anahtar_yok/baglanti_yok atilmaz): {len(ist)}")
            if len(ist) >= 4:
                kontrol(ist[0]["baslik"].get("authorization") == "Bearer test_Deneme0123456789abcdefghijk" and ist[0]["baslik"].get("idempotency-key") == "et-ET-260101-ABCDEF"
                        and ist[0]["baslik"].get("content-type") == "application/json" and ist[0]["yol"] == "/v2/payments" and ist[0]["yontem"] == "POST", f"Mollie POST basliklari: {ist[0]['baslik']}")
                kontrol(json.loads(ist[0]["govde"]) == {"a": 1, "u": "é/x"}, "Mollie govdesi UNESCAPED unicode/slash")
                kontrol("idempotency-key" not in ist[1]["baslik"] and ist[1]["yontem"] == "GET" and ist[1]["yol"] == "/v2/payments/tr_abc", "GET isteginde Idempotency-Key yok")
                kontrol("idempotency-key" not in ist[2]["baslik"] and "idempotency-key" not in ist[3]["baslik"], "gecersiz Idempotency-Key (CRLF / >80) GONDERILMEZ")
            kontrol(o5["taban_kotu"][0] == 0 and o5["anahtar_yok"][0] == 0 and o5["baglanti_yok"][0] == 0, "gecersiz taban / anahtar yok / baglanti yok -> [0, hata], cagri yapilmaz")
            kontrol(MOLLIE_ANAHTAR not in json.dumps(o5) and "Deneme0123" not in json.dumps(o5["taban_kotu"]), "hata cikti anahtar icermez")

        # ---------------------------------------------------------- Google
        yak.istekler.clear()

        def gy(metre=56400, durum="OK", oge="OK", **ek):
            if oge == "OK":
                e = {"status": "OK", "distance": {"text": "x", "value": metre}, "duration": {"text": "1", "value": 1}}
            else:
                e = {"status": oge}
            return (200, json.dumps({"status": durum, "rows": [{"elements": [e]}]}))
        yak.kuyruk = [gy(), gy(durum="REQUEST_DENIED"), gy(oge="NOT_FOUND"), gy(metre="56400"), gy(metre=0), gy(metre=499), gy(metre=500), gy(metre=56499), gy(metre=56500),
                      (500, "{}"), (200, "bozuk json"), (200, json.dumps({"status": "OK", "rows": []})), gy(metre=900000), (200, json.dumps({"status": "OK", "rows": [{"elements": [{"status": "OK", "distance": {"value": 1500.4}}]}]})),
                      (403, "{}"), (200, json.dumps({"status": "OK", "rows": [{"elements": [{"status": "OK"}]}]}))]
        kod6 = r"""
        $o = [];
        putenv('GOOGLE_SERVER_KEY=AIzaDeneme0123456789'); putenv('GOOGLE_API_BASE=http://127.0.0.1:' . getenv('YAK1')); cfg(true);
        for ($i = 0; $i < 16; $i++) { $o['g'][] = google_km('Gent', 'Brussels Airport (Zaventem)'); }
        $o['boru'] = [google_km('Gent|Antwerpen', 'Brussels'), google_km('Gent', 'Brussels|Luxembourg'), google_km("Gent\nX", 'Brussels'), google_km('Gent', "B\x00"), google_km('', 'Brussels'), google_km('Gent', '')];
        putenv('GOOGLE_API_BASE=file:///etc/passwd'); cfg(true);
        $o['taban_kotu'] = google_km('Gent', 'Brussels');
        putenv('GOOGLE_API_BASE=http://127.0.0.1:1'); cfg(true);
        $o['baglanti_yok'] = google_km('Gent', 'Brussels');
        putenv('GOOGLE_SERVER_KEY='); putenv('GOOGLE_API_BASE=http://127.0.0.1:' . getenv('YAK1')); cfg(true);
        $o['anahtar_yok'] = google_km('Gent', 'Brussels');
        echo json_encode($o);
        """
        o6, p6 = php_json(kod6, env=env)
        kontrol(o6 is not None, "google harness'i calismadi: " + p6.stderr[:400])
        if o6 is not None:
            kontrol(o6["g"] == [56, None, None, None, None, None, 1, 56, 57, None, None, None, 900, 2, None, None], f"google_km yanit matrisi: {o6['g']}")
            kontrol(o6["boru"] == [None] * 6 and o6["taban_kotu"] is None and o6["baglanti_yok"] is None and o6["anahtar_yok"] is None, f"'|'/kontrol karakteri/gecersiz taban/anahtar yok: {o6}")
            gi = [i for i in yak.istekler if i["yol"].startswith("/maps/api/distancematrix/json")]
            kontrol(len(gi) == 16, f"Google'a yalniz 16 gecerli istek gitmeli ('|' istekleri gitmez): {len(gi)}")
            if gi:
                q = urllib.parse.parse_qs(urllib.parse.urlsplit(gi[0]["yol"]).query)
                kontrol(q["origins"] == ["Gent"] and q["destinations"] == ["Brussels Airport (Zaventem)"] and q["key"] == ["AIzaDeneme0123456789"] and q["mode"] == ["driving"] and q["units"] == ["metric"],
                        f"Google sorgu parametreleri: {q}")
                kontrol("%7C" not in gi[0]["yol"] and "|" not in gi[0]["yol"], "Google URL'sinde '|' yok")

        # ---------------------------------------------------------- checkout_guvenli
        kod7 = r"""
        putenv('MOLLIE_API_BASE=http://127.0.0.1:9650/v2'); cfg(true);
        $c = ['https://www.mollie.com/checkout/x', 'http://127.0.0.1:9650/checkout/tr_1', 'http://127.0.0.1:9651/checkout/tr_1', 'http://127.0.0.1/checkout/x', 'http://evil.example/x',
              'https://u:p@x.be/', "https://x.be/a\r\nSet-Cookie: a=b", 'javascript:alert(1)', '//evil.example', 'http://localhost:9650/x', '', 'HTTPS://X.BE/', 'ftp://x.be/'];
        $o = array_map(static fn (string $u): ?string => checkout_guvenli($u), $c);
        $o[] = checkout_guvenli(null); $o[] = checkout_guvenli(['x']);
        putenv('MOLLIE_API_BASE=http://evil.example/v2'); cfg(true);
        $o[] = checkout_guvenli('http://127.0.0.1:9650/checkout/tr_1');
        echo json_encode($o);
        """
        o7, p7 = php_json(kod7, env=env)
        if o7 is not None:
            beklenen = ["https://www.mollie.com/checkout/x", "http://127.0.0.1:9650/checkout/tr_1", None, None, None, None, None, None, None, None, None, "HTTPS://X.BE/", None, None, None, None]
            kontrol(o7 == beklenen, f"checkout_guvenli: {[(a, b) for a, b in zip(o7, beklenen) if a != b]}")
        else:
            kontrol(False, "checkout harness'i calismadi: " + p7.stderr[:300])
    finally:
        yak.kapat()


def senaryo_temizle():
    print("— C5. temizle.php: 30 gun / 12 ay anonimlestirme / 7 yil / log 90 gun / dry-run / CLI")
    od = TMP / "temizle_od"
    shutil.rmtree(od, ignore_errors=True)
    od.mkdir(mode=0o700)
    (od / "rl").mkdir()
    (od / "sess").mkdir()
    (od / ".htaccess").write_text("Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n")   # gercek kurulumlarda zaten vardir
    simdi = datetime.now(ZoneInfo("Europe/Brussels")) if ZoneInfo else datetime.utcnow()

    def iso(gun_once):
        return (simdi - timedelta(days=gun_once)).strftime("%Y-%m-%dT%H:%M:%S%z")[:-2] + ":" + (simdi - timedelta(days=gun_once)).strftime("%z")[-2:]

    def gun(gun_once):
        return (simdi - timedelta(days=gun_once)).strftime("%Y-%m-%d")
    sayac = [0]

    def siparis(durum, olusturma_gun=1, yolculuk_gun_once=-5, donus_gun_once=None, **ek):
        sayac[0] += 1
        no = f"ET-{(simdi - timedelta(days=olusturma_gun)).strftime('%y%m%d')}-{sayac[0]:06X}"
        s = {"no": no, "olusturma": iso(olusturma_gun), "durum": durum, "dil": "nl", "alis": "Korenmarkt 77, Gent", "varis": "Brussels Airport (Zaventem)", "km": 56,
             "toplam": 121.44, "kapora": 24.29, "kalan": 97.15, "tarih": gun(yolculuk_gun_once), "saat": "14:30",
             "donus_tarih": gun(donus_gun_once) if donus_gun_once is not None else "", "donus_saat": "", "yolcu": 3, "buyuk": 1, "kucuk": 0, "arac": "wagon",
             "ad": "Jan Peeters", "eposta": "jan@voorbeeld.be", "telefon": "+32 470 11 22 33", "mollie_id": "tr_abc", "km_sunucu": None}
        s.update(ek)
        (od / f"{no}.json").write_text(json.dumps(s, indent=2), encoding="utf-8")
        return no
    silinecek = [siparis("beklemede", 40), siparis("odeme_baslatilamadi", 31), siparis("iptal", 45), siparis("suresi_doldu", 100), siparis("basarisiz", 31), siparis("beklemede", 365)]
    kalacak_odenmemis = [siparis("beklemede", 5), siparis("basarisiz", 29), siparis("odeme_baslatilamadi", 1), siparis("iptal", 0)]
    anonim = [siparis("odendi", 400, 380), siparis("iade", 420, 400), siparis("chargeback", 500, 390), siparis("tutar_uyusmazligi", 450, 380)]
    dokunulmaz = [siparis("odendi", 350, 340), siparis("odendi", 500, 400, donus_gun_once=30), siparis("odendi", 30, -20)]
    zaten_anonim = siparis("odendi", 700, 600, ad="[anonim]", eposta="", telefon="", alis="[anonim]", varis="[anonim]", anonim="2025-01-01T00:00:00+01:00")
    muhasebe_biten = [siparis("odendi", 2700, 2650), siparis("iade", 3000, 2900)]
    bozuk = od / "ET-260101-ABCDEF.json"
    bozuk.write_text("{bozuk json", encoding="utf-8")
    # yardimci dosyalar
    eski = time.time() - 3 * 86400
    for ad, yas in [("rl/eski1.json", eski), ("rl/eski2.json", eski), ("rl/yeni.json", time.time()), ("sess/sess_eski", eski), ("sess/sess_yeni", time.time()),
                    (".tmpABC123", eski), (".tmpYENI", time.time())]:
        (od / ad).write_text("{}")
        os.utime(od / ad, (yas, yas))
    (od / "ET-990101-AAAAAA.json.lock").write_text("")                      # sahipsiz kilit
    (od / f"{kalacak_odenmemis[0]}.json.lock").write_text("")                # sahipli kilit KALMALI
    # kayit.log: 120/100/91/89/30/0 gun onceki satirlar + tarihsiz devam satiri (bir oncekinin kararina uyar)
    log_satirlari = []
    for gn in [120, 100, 91, 89, 30, 0]:
        log_satirlari.append(f"{gun(gn)} 10:00:00  bilgi: satir {gn} gun onceki")
        if gn == 100:
            log_satirlari.append("devam satiri (tarihsiz) 100 gunluge ait")
    (od / "kayit.log").write_text("\n".join(log_satirlari) + "\n", encoding="utf-8")

    def anlik():
        return {str(f.relative_to(od)): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(od.rglob("*")) if f.is_file()}
    env = {"ORDERS_DIR": str(od)}
    php_temizle = X.www / "pay" / "temizle.php"

    once = anlik()
    p = subprocess.run([PHP, str(php_temizle), "--dry-run", "--json"], capture_output=True, text=True, env=temiz_ortam(**env))
    kontrol(p.returncode == 0, f"temizle --dry-run cikis kodu 0 olmali: {p.stderr[:300]}")
    try:
        ozet = json.loads(p.stdout)
    except Exception:
        kontrol(False, "temizle --json ciktisi JSON degil: " + p.stdout[:300])
        return
    kontrol(anlik() == once, "DRY-RUN hicbir dosyayi degistirmemeli/silmemeli")
    kontrol(ozet["kuru"] is True and sorted(ozet["silinen_odenmemis"]) == sorted(silinecek), f"dry-run: silinecek odenmemisler: {ozet['silinen_odenmemis']} != {silinecek}")
    kontrol(sorted(ozet["anonimlestirilen"]) == sorted(anonim), f"dry-run: anonimlestirilecekler: {ozet['anonimlestirilen']} != {anonim}")
    kontrol(sorted(ozet["silinen_muhasebe"]) == sorted(muhasebe_biten), f"dry-run: 7 yili dolanlar: {ozet['silinen_muhasebe']}")
    kontrol(ozet["bozuk_dosya"] == 1, f"bozuk dosya sayisi: {ozet['bozuk_dosya']}")
    kontrol(ozet["log_atilan"] == 4 and ozet["log_kalan"] == 3, f"dry-run log: atilan={ozet['log_atilan']} kalan={ozet['log_kalan']} (120/100/devam/91 atilir)")
    kontrol(ozet["rl_silinen"] == 2 and ozet["oturum_silinen"] == 1 and ozet["gecici_silinen"] == 1 and ozet["kilit_silinen"] == 1, f"dry-run yardimci dosya sayilari: {ozet}")
    # insan okunur dry-run
    p_txt = subprocess.run([PHP, str(php_temizle), "--dry-run"], capture_output=True, text=True, env=temiz_ortam(**env))
    kontrol("KURU CALISTIRMA" in p_txt.stdout and silinecek[0] in p_txt.stdout and "jan@voorbeeld.be" not in p_txt.stdout and "Peeters" not in p_txt.stdout, "dry-run metin ozeti: numaralar var, kisisel veri YOK")
    kontrol(anlik() == once, "dry-run (metin) dosyalari degistirmemeli")

    # gercek calistirma
    p = subprocess.run([PHP, str(php_temizle), "--json"], capture_output=True, text=True, env=temiz_ortam(**env))
    kontrol(p.returncode == 0, f"temizle cikis kodu 0: {p.stderr[:300]}")
    for no in silinecek + muhasebe_biten:
        kontrol(not (od / f"{no}.json").exists(), f"{no} silinmeli")
    for no in kalacak_odenmemis + dokunulmaz:
        kontrol((od / f"{no}.json").exists(), f"{no} KALMALI")
        s = json.loads((od / f"{no}.json").read_text(encoding="utf-8"))
        kontrol(s["ad"] == "Jan Peeters" and "anonim" not in s, f"{no} kisisel alanlari KORUNMALI")
    for no in anonim:
        s = json.loads((od / f"{no}.json").read_text(encoding="utf-8"))
        kontrol(s["ad"] == "[anonim]" and s["alis"] == "[anonim]" and s["varis"] == "[anonim]" and s["eposta"] == "" and s["telefon"] == "" and "anonim" in s,
                f"{no} kisisel alanlar anonimlestirilmeli: {s['ad']} {s['eposta']}")
        kontrol(s["no"] == no and s["tarih"] and s["toplam"] == 121.44 and s["kapora"] == 24.29 and s["kalan"] == 97.15 and s["km"] == 56 and s["mollie_id"] == "tr_abc" and s["durum"] in DURUM_ODENMIS_TEST,
                f"{no} referans/tarih/tutar/durum SAKLANMALI: {s}")
        kontrol(json.dumps(s).count("jan@voorbeeld.be") == 0 and "Peeters" not in json.dumps(s) and "470" not in json.dumps(s), f"{no} anonim kayitta kisisel veri kalmamali")
        kontrol(oct((od / f"{no}.json").stat().st_mode & 0o777) == "0o600", f"{no} anonimlestirme sonrasi izin 0600")
    kontrol(json.loads((od / f"{zaten_anonim}.json").read_text(encoding="utf-8"))["anonim"] == "2025-01-01T00:00:00+01:00", "zaten anonim kayit tekrar islenmez")
    kontrol(bozuk.read_text(encoding="utf-8") == "{bozuk json", "bozuk dosyaya dokunulmaz")
    kontrol(not (od / "rl" / "eski1.json").exists() and (od / "rl" / "yeni.json").exists() and not (od / "sess" / "sess_eski").exists() and (od / "sess" / "sess_yeni").exists(), "eski rl/oturum dosyalari silinir, yeniler kalir")
    kontrol(not (od / ".tmpABC123").exists() and (od / ".tmpYENI").exists(), "eski gecici dosya silinir")
    kontrol(not (od / "ET-990101-AAAAAA.json.lock").exists() and (od / f"{kalacak_odenmemis[0]}.json.lock").exists(), "sahipsiz kilit silinir, sahipli kalir")
    log = (od / "kayit.log").read_text(encoding="utf-8")
    kontrol("satir 120" not in log and "satir 100" not in log and "devam satiri" not in log and "satir 91 " not in log and "satir 89 " in log and "satir 30 " in log and "satir 0 " in log,
            f"kayit.log: 90 gunden eski satirlar atilir: {log[:600]}")
    kontrol("temizle: silinen=" in log, "temizlik kayit.log'a not dusulur (yalniz sayilar)")
    # tekrar calistirma: degisiklik yok
    p2 = subprocess.run([PHP, str(php_temizle), "--dry-run", "--json"], capture_output=True, text=True, env=temiz_ortam(**env))
    o2 = json.loads(p2.stdout)
    kontrol(o2["silinen_odenmemis"] == [] and o2["anonimlestirilen"] == [] and o2["silinen_muhasebe"] == [] and o2["log_atilan"] == 0, f"ikinci calistirma bir sey bulmamali: {o2}")
    # CLI argumanlari
    pu = subprocess.run([PHP, str(php_temizle), "--bilinmeyen"], capture_output=True, text=True, env=temiz_ortam(**env))
    kontrol(pu.returncode == 2 and "Kullanim" in pu.stderr, "bilinmeyen arguman -> cikis 2 + kullanim")
    ph = subprocess.run([PHP, str(php_temizle), "--yardim"], capture_output=True, text=True, env=temiz_ortam(**env))
    kontrol(ph.returncode == 0 and "Kullanim" in ph.stderr, "--yardim cikis 0")
    # dosya dahil edilince (CLI harness) CLI ana blogu CALISMAZ
    pi = subprocess.run([PHP, "-r", "require $argv[1]; echo function_exists('temizle_calistir') ? 'var' : 'yok';", "--", str(php_temizle)], capture_output=True, text=True, env=temiz_ortam(**env))
    kontrol(pi.stdout == "var", f"temizle.php dahil edilince fonksiyonlar tanimlanir, ana blok calismaz: {pi.stdout!r} {pi.stderr[:200]}")
    kontrol(anlik() == anlik(), "kararlilik")


DURUM_ODENMIS_TEST = ["odendi", "iade", "chargeback", "tutar_uyusmazligi"]


# ================================================================ E2E senaryolar (php -S + sahte servisler)
def mail_dizini(ad):
    return TMP / f"mail_{ad}"


def mail_temizle(ad):
    for f in mail_dizini(ad).glob("*"):
        f.unlink()


def sendmail_kapat(ad, kapali=True):
    f = mail_dizini(ad) / "fail"
    if kapali:
        f.write_text("1")
    elif f.exists():
        f.unlink()


def webhook_tetikle(sip, *, sunucu=None, ip=None):
    """Sunucuya dogrudan (mock disindan) webhook POST'u."""
    return istek(sunucu or sip.sunucu, "POST", "/pay/webhook.php", {"id": sip.id}, ip=ip or "auto", origin=None)


def senaryo_mutlu_yol():
    print("— 1. mutlu yol: Gent -> Brussels Airport, km=56")
    mock_sifirla()
    s = siparis_olustur("A")
    y = siparis_olustur.son
    kontrol(s is not None, f"create 303 vermedi: {y.kod} {y.metin[:300]}")
    if s is None:
        return
    loc = y.baslik("location")
    kontrol(re.fullmatch(rf"http://127\.0\.0\.1:{PORTLAR['mock']}/checkout/tr_[A-Za-z0-9]{{10}}", loc or "") is not None, f"Location mock checkout olmali: {loc}")
    o = s.odeme
    kontrol(o["amount"] == {"currency": "EUR", "value": "24.29"}, f"odeme tutari 24.29: {o['amount']}")
    kontrol(o["description"] == "Europa Taxi " + s.no and re.fullmatch(r"ET-\d{6}-[0-9A-F]{6}", s.no) is not None, f"description/no: {o['description']}")
    kontrol(o["status"] == "open" and o["locale"] == "nl_BE", "durum open, locale nl_BE")
    kontrol(o["redirectUrl"] == f"http://127.0.0.1:{PORTLAR['A']}/pay/success.php?order={s.no}&dil=nl", f"redirectUrl: {o['redirectUrl']}")
    kontrol(o["webhookUrl"] == f"http://127.0.0.1:{PORTLAR['A']}/pay/webhook.php", f"webhookUrl: {o['webhookUrl']}")
    kontrol(o["metadata"] == {"order_id": s.no}, f"metadata yalniz order_id (kisisel veri Mollie'ye GITMEZ): {o['metadata']}")
    d = s.dosya()
    kontrol(d["durum"] == "beklemede" and d["mollie_id"] == s.id and d["mollie_durum"] == "open", f"siparis dosyasi durumu: {d['durum']} {d['mollie_id']}")
    kontrol((d["toplam"], d["kapora"], d["kalan"], d["km"], d["km_istemci"], d["km_sunucu"], d["km_kaynak"]) == (121.44, 24.29, 97.15, 56, 56, None, "istemci"),
            f"siparis fiyat/km alanlari: {d['toplam']} {d['kapora']} {d['kalan']} {d['km']} {d['km_kaynak']}")
    kontrol(d["alis"] == "Korenmarkt 77, Gent" and d["ad"] == "Jan Peeters" and d["eposta"] == "jan@voorbeeld.be" and d["telefon"] == "+32 470 11 22 33" and d["arac"] == "wagon"
            and (d["yolcu"], d["buyuk"], d["kucuk"]) == (3, 2, 1) and d["tarih"] == tarih(10) and d["saat"] == "14:30", "siparis kisisel/yolculuk alanlari")
    kontrol(re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d", d["iptal_onay"]) is not None, f"iptal_onay zaman damgasi: {d['iptal_onay']}")
    kontrol(d["eposta_musteri"] is False and d["eposta_sirket"] is False and d["eposta_gonderildi"] is False, "alici bayraklari baslangicta false")
    # siparis dosyasi guvenligi
    yol = siparis_dizini("A") / f"{s.no}.json"
    kontrol(oct(yol.stat().st_mode & 0o777) == "0o600" and oct(siparis_dizini("A").stat().st_mode & 0o777) == "0o700", "siparis 0600 / klasor 0700")
    kontrol(not list((X.www / "pay" / "orders").glob("ET-*.json")), "siparis www/ icine yazilmadi")
    # diller -> Mollie locale
    for dil, yerel in [("fr", "fr_BE"), ("en", "en_GB"), ("tr", "fr_BE"), ("nl", "nl_BE")]:
        s2 = siparis_olustur("A", dil=dil)
        kontrol(s2 is not None and s2.odeme["locale"] == yerel and s2.dosya()["dil"] == dil, f"dil={dil} -> locale {yerel}")
    s3 = siparis_olustur("A", dil="xx")
    kontrol(s3 is not None and s3.dosya()["dil"] == "fr" and s3.odeme["locale"] == "fr_BE", "bilinmeyen dil fr olmali")
    s4 = siparis_olustur("A", donus_tarih=tarih(17), donus_saat="18:05")
    kontrol(s4 is not None and (s4.dosya()["donus_tarih"], s4.dosya()["donus_saat"]) == (tarih(17), "18:05"), "donus alanlari")
    s6 = siparis_olustur("A", donus_tarih="", donus_saat="18:05")
    kontrol(s6 is not None and (s6.dosya()["donus_tarih"], s6.dosya()["donus_saat"]) == ("", ""), "donus tarihi yoksa donus saati yok sayilir")
    # Idempotency-Key: 'et-<siparis no>' (mock ayni anahtarla AYNI odemeyi doner)
    k, j = mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "1.00"}, "description": "x", "redirectUrl": "https://x.be/a"},
                      baslik={"Idempotency-Key": "et-" + s.no})
    kontrol(k == 201 and j["id"] == s.id, f"create Mollie'ye Idempotency-Key: et-<siparis no> gondermeli (tekrar ayni odemeyi doner): {j.get('id')} != {s.id}")
    # istemci idem belirteci Mollie'ye gider; ayni idem ikinci siparis icin ODEME YARATMAZ (tekrar/cift tiklama korumasi)
    n0 = len(odemeler())
    idem = "abcd1234-ef56-7890-abcd-1234567890ab"
    a = siparis_olustur("A", idem=idem)
    n1 = len(odemeler())
    b = siparis_olustur("A", idem=idem)
    yb = siparis_olustur.son
    kontrol(a is not None and n1 == n0 + 1, "idem'li ilk create bir odeme yaratir")
    kontrol(b is None and yb.kod == 502 and th("nl", "err_pay") in yb.metin, f"ayni idem ile ikinci create: baska siparisin odemesi DONMEMELI, temiz hata ({yb.kod})")
    kontrol(len(odemeler()) == n1, "ayni idem ikinci odeme yaratmadi")
    kontrol(mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "1.00"}, "description": "x", "redirectUrl": "https://x.be/a"}, baslik={"Idempotency-Key": idem})[1]["id"] == a.id,
            "istemci idem tokeni Idempotency-Key olarak Mollie'ye gitti")
    kotu_idem = siparis_olustur("A", idem="kisa")     # gecersiz token yok sayilir, siparis normal
    kontrol(kotu_idem is not None, "gecersiz idem yok sayilir (create yine calisir)")
    # iptal onayi SUNUCUDA zorunlu
    n2 = len(odemeler())
    dosya_say = len(siparis_dosyalari("A"))
    for ad, ek in [("iptal alani yok", None), ("iptal=0", "0"), ("iptal bos", ""), ("iptal=on", "on"), ("iptal=true", "true"), ("iptal=11", "11")]:
        f = form()
        if ek is None:
            del f["iptal"]
        else:
            f["iptal"] = ek
        y = istek("A", "POST", "/pay/create.php", f)
        kontrol(y.kod == 422 and th("nl", "val_cancel") in y.metin, f"{ad}: 422 val_cancel ({y.kod}: {yanit_h1(y)!r})")
    kontrol(len(odemeler()) == n2 and len(siparis_dosyalari("A")) == dosya_say, "iptal onayi yokken siparis/odeme OLUSMAMALI")
    y = istek("A", "POST", "/pay/create.php", ham=urllib.parse.urlencode(form()) + "&iptal=1")
    kontrol(y.kod == 400, f"iptal tekrar eden alan: 400 ({y.kod})")
    # 303 yaniti no-store
    kontrol(y is not None and s.yanit.baslik("cache-control") == "no-store", f"create 303 yanitinda Cache-Control: no-store ({s.yanit.baslik('cache-control')})")
    # sahte fiyat alanlari YOK SAYILIR
    sf = siparis_olustur("A", toplam="1.00", fiyat="1", kapora="0.01", tutar="0.10", price="1", amount="1.00", total="1")
    kontrol(sf is not None and sf.odeme["amount"]["value"] == "24.29" and sf.dosya()["toplam"] == 121.44, "sahte toplam/fiyat/kapora/tutar alanlari YOK SAYILMALI")


def paid_yap(sip, **q):
    qs = "".join(f"&{k}={v}" for k, v in q.items())
    return mock("POST", f"/__test/paid/{sip.id}?x=1{qs}", {})


def senaryo_paid():
    print("— 2. paid -> webhook -> 2 e-posta (alici basina bayrak), tekrar/iade/chargeback/48 saat")
    mock_sifirla()
    s = siparis_olustur("A", ad='Jan "J" O\'Brien & <b>Zn</b>', donus_tarih=tarih(17), donus_saat="18:00")
    r = paid_yap(s)
    kontrol(r["webhook"]["kod"] == 200 and r["webhook"]["govde"] == "OK", f"webhook 200 OK: {r}")
    P = postalar()
    kontrol(len(P) == 2, f"TAM 2 e-posta beklenir, {len(P)}")
    musteri, sirket = bul_posta("jan@voorbeeld.be"), bul_posta(SIRKET_EPOSTA)
    kontrol(len(musteri) == 1 and len(sirket) == 1, "1 musteri + 1 sirket e-postasi")
    if len(musteri) == 1 and len(sirket) == 1:
        m, sk = musteri[0], sirket[0]
        kontrol(m["konu"] == t("nl", "em_subject", ref=s.no) and "Uw reservering" in m["konu"], f"musteri konusu Flamanca: {m['konu']}")
        kontrol("voorschot" in m["html"].lower() and "24,29 €" in m["html"] and "97,15 €" in m["html"] and s.no in m["html"], "musteri govdesi: voorschot, 24,29, 97,15, referans")
        kontrol(m["gonderen"]["email"] == GONDEREN and m["gonderen"]["name"] == "Europa Taxi", f"gonderen: {m['gonderen']}")
        kontrol("Jan &quot;J&quot; O&#039;Brien &amp; &lt;b&gt;Zn&lt;/b&gt;" in m["html"] and "<b>Zn</b>" not in m["html"], "musteri e-postasi HTML kacisli")
        kontrol("ARACTA TAHSIL: 97,15 EUR" in sk["metin"] and "Odenen kapora: 24,29 EUR" in sk["metin"] and "Toplam       : 121,44 EUR" in sk["metin"], f"is emri tutarlari:\n{sk['metin']}")
        kontrol("Donus        : " in sk["metin"] and ", saat 18:00" in sk["metin"], "is emrinde donus")
        kontrol(sk["konu"].startswith("Yeni rezervasyon · " + s.no + " · "), f"sirket konusu: {sk['konu']}")
        kontrol("<pre" in sk["html"] and "&gt;" in sk["html"], "sirket e-postasi <pre> icinde kacisli")
        kontrol(len([l for l in sk["metin"].split("\n") if l.startswith("ARACTA TAHSIL")]) == 1, "is emrinde TEK 'ARACTA TAHSIL' satiri")
    d = s.dosya()
    kontrol(d["durum"] == "odendi" and d["mollie_durum"] == "paid" and d["eposta_musteri"] is True and d["eposta_sirket"] is True and d["eposta_gonderildi"] is True,
            f"siparis: odendi + alici bayraklari true: {d['durum']} {d['eposta_musteri']} {d['eposta_sirket']}")
    kontrol(d["eposta_kaydi"]["musteri"] == "brevo" and d["eposta_kaydi"]["sirket"] == "brevo" and d["odenen_tutar"] == "24.29 EUR", f"eposta_kaydi/odenen_tutar: {d.get('eposta_kaydi')} {d.get('odenen_tutar')}")
    # tekrar webhook -> e-posta ARTMAZ
    r2 = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r2["webhook"]["kod"] == 200 and len(postalar()) == 2, f"tekrar webhook e-posta artirmamali ({len(postalar())})")
    # iade sonrasi webhook: durum 'iade', yeni e-posta yok, panel tahsilata saymaz
    r3 = mock("POST", f"/__test/refund/{s.id}", {})
    kontrol(r3["webhook"]["kod"] == 200 and len(postalar()) == 2 and s.dosya()["durum"] == "iade", f"iade: e-posta yok, durum iade ({s.dosya()['durum']})")
    # iade ONCE, e-posta HIC gitmeden
    mock_sifirla()
    s3 = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s3.id}?webhook=0", {})
    mock("POST", f"/__test/refund/{s3.id}", {})
    kontrol(len(postalar()) == 0 and s3.dosya()["durum"] == "iade" and s3.dosya()["eposta_musteri"] is False, f"paid+iade birlikte: e-posta yok, durum iade ({len(postalar())}, {s3.dosya()['durum']})")
    s4 = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s4.id}?webhook=0", {})
    mock("POST", f"/__test/chargeback/{s4.id}", {})
    kontrol(len(postalar()) == 0 and s4.dosya()["durum"] == "chargeback", f"chargeback: e-posta yok, durum chargeback ({s4.dosya()['durum']})")
    kontrol("bilgi: webhook: " + s4.no + " chargeback" in kayit_log("A"), "chargeback loglanir")
    # paidAt 48 saatten eski -> e-posta yok, ama durum odendi
    s5 = siparis_olustur("A")
    r = paid_yap(s5, hours_ago=72)
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 0 and s5.dosya()["durum"] == "odendi", f"paidAt 72 saat once: e-posta yok, durum odendi ({len(postalar())}, {s5.dosya()['durum']})")
    kontrol("48 saatten eski" in kayit_log("A"), "48 saat kurali loglanir")
    s6 = siparis_olustur("A")
    paid_yap(s6, hours_ago=47)
    kontrol(len(postalar()) == 2, f"paidAt 47 saat once (pencere icinde): 2 e-posta ({len(postalar())})")
    # gecersiz paidAt
    s7 = siparis_olustur("A")
    n0 = len(postalar())
    paid_yap(s7, paid_at="garip")
    kontrol(len(postalar()) == n0 and s7.dosya()["durum"] == "odendi", "paidAt gecersiz: e-posta gonderilmez")
    # tum dillerde
    mock_sifirla()
    for dil in DILLER:
        sd = siparis_olustur("A", dil=dil)
        paid_yap(sd)
        mm = [p for p in bul_posta("jan@voorbeeld.be") if sd.no in p["html"]]
        kontrol(len(mm) == 1 and mm[0]["konu"] == t(dil, "em_subject", ref=sd.no) and th(dil, "em_heading") in mm[0]["html"], f"[{dil}] musteri e-postasi kendi dilinde")
    # paid degil durumlar
    mock_sifirla()
    so = siparis_olustur("A")
    mock("POST", f"/__test/webhook/{so.id}", {})
    kontrol(len(postalar()) == 0 and so.dosya()["durum"] == "beklemede", "open: e-posta yok, durum beklemede")
    for durum, beklenen in [("expired", "suresi_doldu"), ("failed", "basarisiz"), ("canceled", "iptal")]:
        sx = siparis_olustur("A")
        mock("POST", f"/__test/{durum}/{sx.id}", {})
        kontrol(sx.dosya()["durum"] == beklenen, f"{durum} -> {beklenen} ({sx.dosya()['durum']})")
    kontrol(len(postalar()) == 0, "expired/failed/canceled: e-posta yok")
    # ESKI/YANLIS Mollie yaniti 'paid'i ezmez
    mock_sifirla()
    sp = siparis_olustur("A")
    paid_yap(sp)
    kontrol(sp.dosya()["durum"] == "odendi", "on kosul: odendi")
    mock("POST", f"/__test/expired/{sp.id}", {})     # Mollie artik 'expired' diyor (gecikmis/hatali yanit simulasyonu)
    kontrol(sp.dosya()["durum"] == "odendi" and len(postalar()) == 2, f"paid sonra expired webhook'u durumu EZMEZ ({sp.dosya()['durum']})")
    y = istek("A", "GET", f"/pay/success.php?order={sp.no}")
    kontrol(th("nl", "succ_paid_t") in y.metin and sp.dosya()["durum"] == "odendi", "success.php de paid'i ezmez (canli sorgu expired dese bile)")


def senaryo_eposta_hatalari():
    print("— 3. e-posta hatalari: Brevo/mail() -> 500 -> yalniz eksik alici; Mollie hatasi; mail() yedegi; Reply-To")
    mock_sifirla()
    mail_temizle("A")
    # (a) Brevo 500 + sendmail KAPALI -> her iki kanal basarisiz -> 500, bayrak yok
    s = siparis_olustur("A")
    sendmail_kapat("A")
    mock("POST", "/__test/brevo_fail/1", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 500 and len(postalar()) == 0, f"Brevo 500 + mail() basarisiz -> webhook 500 ({r['webhook']})")
    d = s.dosya()
    kontrol(d["durum"] == "odendi" and d["eposta_musteri"] is False and d["eposta_sirket"] is False, f"durum odendi ama bayraklar FALSE: {d['durum']} {d['eposta_musteri']} {d['eposta_sirket']}")
    kontrol("musteri e-postasi gonderilemedi " + s.no in kayit_log("A"), "hata loglanir (yalniz siparis no)")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 2, f"tekrarda TAM 2 e-posta ({len(postalar())})")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(len(postalar()) == 2 and s.dosya()["eposta_gonderildi"] is True, "sonraki tekrar artirmaz")
    # (b) kismi basari: musteri gitti, sirket basarisiz -> 500; tekrar YALNIZ sirket
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", "/__test/brevo_fail/1?skip=1", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    P = postalar()
    kontrol(r["webhook"]["kod"] == 500 and len(P) == 1 and P[0]["alicilar"] == ["jan@voorbeeld.be"], f"kismi basari: musteri gitti, webhook 500 ({r['webhook']}, {len(P)})")
    d = s.dosya()
    kontrol(d["eposta_musteri"] is True and d["eposta_sirket"] is False and d["eposta_gonderildi"] is False, f"ALICI BASINA bayrak: musteri true, sirket false: {d['eposta_musteri']} {d['eposta_sirket']} {d['eposta_gonderildi']}")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    P = postalar()
    kontrol(r["webhook"]["kod"] == 200 and len(P) == 2 and sorted(x["alicilar"][0] for x in P) == sorted(["jan@voorbeeld.be", SIRKET_EPOSTA]),
            f"tekrar YALNIZ eksik (sirket) e-postayi gonderir; musteri TEKRARLANMAZ ({[x['alicilar'] for x in P]})")
    kontrol(s.dosya()["eposta_sirket"] is True and s.dosya()["eposta_gonderildi"] is True, "sirket bayragi basari sonrasi true")
    # (c) once musteri basarisiz olursa SIRKETE gonderilmez (oncelik musteri)
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", "/__test/brevo_fail/1", {})
    mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(len(postalar()) == 0, "musteri basarisizsa sirket e-postasi ONCE gitmez (oncelik: musteri)")
    # (d) mail() yedegi BASARILI: Brevo 500 -> mail() gonderir -> 200
    mock_sifirla()
    mail_temizle("A")
    sendmail_kapat("A", False)
    s = siparis_olustur("A")
    mock("POST", "/__test/brevo_fail/2", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    emls = eml_oku(mail_dizini("A"))
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 0 and len(emls) == 2, f"Brevo 500 -> mail() yedegi 2 e-posta gonderir ({len(emls)}, {r['webhook']})")
    kontrol(s.dosya()["eposta_kaydi"] == {"musteri": "mail", "zaman": s.dosya()["eposta_kaydi"]["zaman"], "sirket": "mail"} or
            (s.dosya()["eposta_kaydi"].get("musteri") == "mail" and s.dosya()["eposta_kaydi"].get("sirket") == "mail"), "eposta_kaydi yontem: mail")
    musteri_eml = [e for e in emls if e["to"] == "jan@voorbeeld.be"]
    kontrol(len(musteri_eml) == 1 and musteri_eml[0]["reply_to"] == SIRKET_EPOSTA and GONDEREN in musteri_eml[0]["from"], f"musteri e-postasi Reply-To: company_email ({musteri_eml[0]['reply_to'] if musteri_eml else None})")
    sirket_eml = [e for e in emls if e["to"] == SIRKET_EPOSTA]
    kontrol(len(sirket_eml) == 1 and "ARACTA TAHSIL: 97,15 EUR" in sirket_eml[0]["metin"], "sirket e-postasi mail() ile: duz metin is emri")
    mock_sifirla()
    mail_temizle("A")
    # (e) Mollie ulasilamaz -> 500; duzelince tam iki e-posta
    s = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s.id}?webhook=0", {})
    mock("POST", "/__test/mollie_fail/1", {})
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 500 and len(postalar()) == 0, f"Mollie 500 -> webhook 500 ({r['webhook']})")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 2, "Mollie duzelince: 2 e-posta")
    # (f) Brevo anahtari yok (sunucu D): mail() ile teslim, Reply-To
    mock_sifirla()
    mail_temizle("D")
    sd = siparis_olustur("D")
    r = mock("POST", f"/__test/paid/{sd.id}", {})
    emls = eml_oku(mail_dizini("D"))
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 0 and len(emls) == 2 and {e["to"] for e in emls} == {"jan@voorbeeld.be", SIRKET_EPOSTA}, f"BREVO_API_KEY yok: 2 e-posta mail() ile ({len(emls)})")
    kontrol("Brevo anahtari/adresi yok" in kayit_log("D"), "Brevo yok uyarisi loglanir")
    # mail() de yoksa 500
    mock_sifirla()
    sendmail_kapat("D")
    sd2 = siparis_olustur("D")
    r = mock("POST", f"/__test/paid/{sd2.id}", {})
    kontrol(r["webhook"]["kod"] == 500, f"Brevo yok + mail() basarisiz -> webhook 500 ({r['webhook']})")
    sendmail_kapat("D", False)
    r = mock("POST", f"/__test/webhook/{sd2.id}", {})
    kontrol(r["webhook"]["kod"] == 200, "mail() duzelince 200")
    sendmail_kapat("A", False)
    mock_sifirla()


def senaryo_es_zamanli():
    print("— 4. es zamanli 10 webhook -> TAM 2 e-posta; siparis dosyasi bozulmaz; success ile yaris")
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s.id}?webhook=0", {})
    mock("POST", "/__test/brevo_delay/250", {})
    sonuclar, hatalar_l = [], []

    def cagir():
        try:
            y = istek("A", "POST", "/pay/webhook.php", {"id": s.id}, ip="auto", origin=None, zaman_asimi=120, kayit=False)
            sonuclar.append((y.kod, y.metin))
        except Exception as e:  # pragma: no cover
            hatalar_l.append(repr(e))
    isler = [threading.Thread(target=cagir) for _ in range(10)]
    # aralarina success sorgulari da karistir (eski kopyayi geri yazma yarisi)
    def success_cagir():
        try:
            istek("A", "GET", f"/pay/success.php?order={s.no}", kayit=False, zaman_asimi=120)
        except Exception as e:  # pragma: no cover
            hatalar_l.append(repr(e))
    isler += [threading.Thread(target=success_cagir) for _ in range(6)]
    random.Random(3).shuffle(isler)
    for i in isler:
        i.start()
    for i in isler:
        i.join()
    mock("POST", "/__test/brevo_delay/0", {})
    kontrol(not hatalar_l, f"es zamanli istek hatalari: {hatalar_l}")
    kontrol(sorted(k for k, _ in sonuclar) == [200] * 10, f"10 es zamanli webhook 200 donmeli: {sonuclar}")
    P = postalar()
    kontrol(len(P) == 2 and sorted(x["alicilar"][0] for x in P) == sorted(["jan@voorbeeld.be", SIRKET_EPOSTA]), f"10 es zamanli webhook -> TAM 2 e-posta (musteri 1, sirket 1): {[x['alicilar'] for x in P]}")
    yol = siparis_dizini("A") / f"{s.no}.json"
    try:
        d = json.loads(yol.read_text(encoding="utf-8"))
        kontrol(d["durum"] == "odendi" and d["eposta_musteri"] is True and d["eposta_sirket"] is True and d["eposta_gonderildi"] is True, f"siparis dosyasi tutarli: {d['durum']}")
    except Exception as e:
        kontrol(False, f"siparis dosyasi BOZULDU: {e}")
    kontrol(not [f for f in siparis_dizini("A").iterdir() if f.name.startswith(".tmp")], "gecici dosya kalintisi yok")
    log = kayit_log("A")
    kontrol(log.count(s.no + " e-postalar gonderildi") == 1, f"'e-postalar gonderildi' TAM bir kez loglanmali ({log.count(s.no + ' e-postalar gonderildi')})")
    # 10 es zamanli, Brevo'da tek hata: her sey sonunda tam bir kez teslim
    mock_sifirla()
    s2 = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s2.id}?webhook=0", {})
    sendmail_kapat("A")
    mock("POST", "/__test/brevo_fail/1", {})
    sonuclar.clear()
    def cagir_id(sid=s2.id):
        sonuclar.append(istek("A", "POST", "/pay/webhook.php", {"id": sid}, origin=None, zaman_asimi=120, kayit=False).kod)
    isler = [threading.Thread(target=cagir_id) for _ in range(10)]
    for i in isler:
        i.start()
    for i in isler:
        i.join()
    sendmail_kapat("A", False)
    # hatadan sonra tek ek denemeyle tamamlanir
    istek("A", "POST", "/pay/webhook.php", {"id": s2.id}, origin=None)
    P = postalar()
    kontrol(len(P) == 2 and sorted(x["alicilar"][0] for x in P) == sorted(["jan@voorbeeld.be", SIRKET_EPOSTA]), f"es zamanli + tek Brevo hatasi: sonunda TAM 2 e-posta ({[x['alicilar'] for x in P]}, kodlar {sorted(sonuclar)})")
    mock_sifirla()


def senaryo_success():
    print("— 5. success sayfasi (canli sorgu, open/failed/tutar uyusmazligi, bozuk order, 'basarisiz' kelimesi yok)")
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s.id}", {})
    y = istek("A", "GET", f"/pay/success.php?order={s.no}&dil=nl")
    kontrol(y.kod == 200 and th("nl", "succ_paid_t") in y.metin, f"paid sayfasi: {yanit_h1(y)}")
    kontrol(th("nl", "succ_paid_d", rest="97,15 €") in y.metin and 'name="robots" content="noindex,nofollow"' in y.metin and 'http-equiv="refresh"' not in y.metin, "paid: kalan tutar 97,15, noindex, yenileme yok")
    y = istek("A", "GET", f"/pay/success.php?order={s.no}&dil=en")
    kontrol(th("nl", "succ_paid_t") in y.metin, "siparis dili (nl) dil parametresinden ustun")
    # ---- CANLI sorgu: webhook henuz gelmedi (webhook=0) ama Mollie paid diyor -> paid sayfasi, dosya guncellenir
    sc = siparis_olustur("A")
    mock("POST", f"/__test/paid/{sc.id}?webhook=0", {})
    kontrol(sc.dosya()["durum"] == "beklemede", "on kosul: webhook gelmedi, dosya beklemede")
    y = istek("A", "GET", f"/pay/success.php?order={sc.no}")
    kontrol(th("nl", "succ_paid_t") in y.metin and sc.dosya()["durum"] == "odendi", "success canli sorgu: paid gosterir ve durumu kilitli guncelleme ile yazar")
    kontrol(len([p for p in postalar() if sc.no in p["html"] or sc.no in p["konu"]]) == 0, "success.php e-posta GONDERMEZ")
    mock("POST", f"/__test/webhook/{sc.id}", {})
    P = [p for p in postalar() if sc.no in p["konu"] or sc.no in p["html"] or sc.no in p["metin"]]
    kontrol(len(P) == 2, f"success paid'e cevirse de webhook e-postalari TAM bir kez gonderir ({len(P)})")
    # ---- open -> 'isleniyor', 'basarisiz' YOK (4 dilde)
    mock_sifirla()
    for dil in DILLER:
        so = siparis_olustur("A", dil=dil)
        y = istek("A", "GET", f"/pay/success.php?order={so.no}&dil={dil}")
        kontrol(y.kod == 200 and th(dil, "succ_pending_t") in y.metin, f"[{dil}] open: 'isleniyor' basligi")
        kontrol(th(dil, "succ_fail_t") not in y.metin and th(dil, "succ_fail_d") not in y.metin, f"[{dil}] open: 'basarisiz' metni OLMAMALI")
        kontrol(re.search(r'<meta http-equiv="refresh" content="6;url=/pay/success\.php\?order=' + so.no + r'&amp;dil=' + dil + r'&amp;n=1"', y.metin) is not None, f"[{dil}] open: 6 sn meta refresh (n=1)")
        kontrol("basarisiz" not in y.metin.lower(), f"[{dil}] sayfada 'basarisiz' kelimesi olmamali")
    so = siparis_olustur("A", dil="tr")
    y = istek("A", "GET", f"/pay/success.php?order={so.no}&dil=tr")
    kontrol("başarısız" not in y.metin.lower() and "tamamlanamadı" not in y.metin, "tr open sayfasinda 'basarisiz/tamamlanamadi' yok")
    y = istek("A", "GET", f"/pay/success.php?order={so.no}&dil=tr&n=39")
    kontrol("n=40" in y.metin and 'http-equiv="refresh"' in y.metin, "yenileme sayaci artar")
    y = istek("A", "GET", f"/pay/success.php?order={so.no}&dil=tr&n=40")
    kontrol('http-equiv="refresh"' not in y.metin, "n=40'ta otomatik yenileme durur")
    y = istek("A", "GET", f"/pay/success.php?order={so.no}&dil=tr&n=abc")
    kontrol(y.kod == 200 and "n=1" in y.metin, "bozuk n sifir sayilir")
    y = istek("A", "GET", f"/pay/success.php?order={so.no}&n[]=5&dil[]=x")
    kontrol(y.kod == 200 and "Warning" not in y.metin, "dizi parametreler temiz")
    # ---- failed / expired / canceled -> basarisiz sayfasi
    for durum in ["failed", "expired", "canceled"]:
        for dil in ["fr", "tr"]:
            sf = siparis_olustur("A", dil=dil)
            mock("POST", f"/__test/{durum}/{sf.id}?webhook=0", {})
            y = istek("A", "GET", f"/pay/success.php?order={sf.no}")
            kontrol(y.kod == 200 and th(dil, "succ_fail_t") in y.metin and th(dil, "succ_pending_t") not in y.metin, f"[{dil}/{durum}] basarisiz sayfasi")
            kontrol(th(dil, "succ_retry") in y.metin and "wa.me/" in y.metin and th(dil, "succ_wa") in y.metin and f'href="/{dil}/#rezervasyon"' in y.metin, f"[{dil}/{durum}] yeniden dene + WhatsApp")
    # ---- tutar uyusmazligi / iade: pending metni + iletisim, yenileme yok
    mock_sifirla()
    st = siparis_olustur("A", dil="fr")
    mock("POST", f"/__test/tamper/{st.id}?amount=1.00", {})
    mock("POST", f"/__test/paid/{st.id}?webhook=0", {})
    y = istek("A", "GET", f"/pay/success.php?order={st.no}")
    kontrol(st.dosya()["durum"] == "tutar_uyusmazligi" and th("fr", "succ_paid_t") not in y.metin and th("fr", "succ_pending_t") in y.metin and 'http-equiv="refresh"' not in y.metin and "wa.me/" in y.metin,
            f"tutar uyusmazligi: 'odendi' DENMEZ, iletisim dugmeleri ({st.dosya()['durum']})")
    kontrol(len(postalar()) == 0, "tutar uyusmazliginda e-posta yok")
    # ---- bulunamayan / bozuk order
    y = istek("A", "GET", "/pay/success.php?order=ET-260101-ZZZZZZ&dil=en")
    kontrol(y.kod == 200 and th("en", "succ_pending_t") in y.metin and "wa.me/" in y.metin, "bilinmeyen (gecerli bicimli) order: genel sayfa + iletisim, 404 yok")
    for kotu in ["bozuk", "../../etc/passwd", "ET-1-2", "et-260101-abcdef", "ET-260101-ABCDEF%0d%0aX", "ET-260101-ABCDEF%0a", "%3Cscript%3Ealert(1)%3C/script%3E", "", "ET-260101-ABCDEF/../x"]:
        y = istek("A", "GET", f"/pay/success.php?order={kotu}&dil=en")
        kontrol(y.kod == 200 and th("en", "succ_pending_t") in y.metin and "<script" not in y.metin.lower() and 'http-equiv="refresh"' not in y.metin, f"bozuk order '{kotu}': temiz sayfa")
    y = istek("A", "GET", "/pay/success.php")
    kontrol(y.kod == 200 and th("fr", "succ_pending_t") in y.metin, "order parametresi yok: temiz fr sayfasi")
    y = istek("A", "POST", "/pay/success.php", {"order": "x"})
    kontrol(y.kod == 405 and y.baslik("allow") == "GET, HEAD", "success: POST 405")
    y = istek("A", "HEAD", f"/pay/success.php?order={s.no}")
    kontrol(y.kod == 200, "HEAD 200")
    # ---- Mollie ulasilamiyorsa 'basarisiz' DENMEZ
    mock_sifirla()
    sm = siparis_olustur("A", dil="fr")
    mock("POST", f"/__test/paid/{sm.id}?webhook=0", {})
    mock("POST", "/__test/mollie_fail/5", {})
    y = istek("A", "GET", f"/pay/success.php?order={sm.no}")
    kontrol(y.kod == 200 and th("fr", "succ_pending_t") in y.metin and th("fr", "succ_fail_t") not in y.metin, "Mollie 500: 'isleniyor' (basarisiz DEGIL)")
    mock("POST", "/__test/mollie_fail/0", {})
    # ---- baska siparisin odeme id'si: mollie_id eslesmezse uygulanmaz
    mock_sifirla()
    a, b = siparis_olustur("A"), siparis_olustur("A")
    mock("POST", f"/__test/paid/{a.id}?webhook=0", {})
    dosya_b = siparis_dizini("A") / f"{b.no}.json"
    db = json.loads(dosya_b.read_text())
    db["mollie_id"] = a.id
    dosya_b.write_text(json.dumps(db))
    y = istek("A", "GET", f"/pay/success.php?order={b.no}")
    kontrol(b.dosya()["durum"] == "beklemede" and th("nl", "succ_paid_t") not in y.metin, "mollie_id baska siparisin odemesine ait -> uygulanmaz (metadata.order_id eslesmedigi icin)")


def senaryo_fiyat_km():
    print("— 6. fiyat tahrifati / km karari (Google YOK: dahili tablo; FAIL-CLOSED)")
    mock_sifirla()

    def dene(**ek):
        n0 = len(odemeler())
        s = siparis_olustur("A", **ek)
        return s, len(odemeler()) - n0
    s, _ = dene(km="1")
    kontrol(s is not None and s.odeme["amount"]["value"] == "24.29" and s.dosya()["km"] == 56 and s.dosya()["km_kaynak"] == "dahili", f"km=1 (Gent->BRU) -> dahili 56 (24.29): {s.dosya() if s else siparis_olustur.son.kod}")
    s, _ = dene(km="50")
    kontrol(s is not None and s.dosya()["km"] == 50 and s.odeme["amount"]["value"] == "21.90", "km=50 (56'nin %10.7 alti) -> istemci kabul")
    s, _ = dene(km="49")
    kontrol(s is not None and s.dosya()["km"] == 56, "km=49 (%12.5 alti) -> 56")
    s, _ = dene(km="100")
    kontrol(s is not None and s.dosya()["km"] == 100 and s.odeme["amount"]["value"] == "41.80", "istemci daha yuksekse (100) kabul")
    # tanimayan adres + Google yok -> RET + WhatsApp
    n0, f0 = len(odemeler()), len(siparis_dosyalari("A"))
    for dil in DILLER:
        y = istek("A", "POST", "/pay/create.php", form(dil=dil, alis="Xyz Straat 1", km="30"))
        kontrol(y.kod == 422 and (th(dil, "err_km_wa") in y.metin) and "wa.me/" in y.metin and th(dil, "succ_wa") in y.metin, f"[{dil}] taninmayan adres -> 422 err_km_wa + WhatsApp ({y.kod})")
    kontrol(len(odemeler()) == n0 and len(siparis_dosyalari("A")) == f0, "reddedilen istekte ODEME ve SIPARIS olusmamali")
    # 500 km'lik yolculuk km=1 ile 12 EUR'ya YAPILAMAZ (denetim bulgusu #1)
    n0 = len(odemeler())
    y = istek("A", "POST", "/pay/create.php", form(alis="Xyz Straat 1", varis="Paris Charles de Gaulle (CDG)", km="1"))
    kontrol(y.kod == 422 and len(odemeler()) == n0, "tanimayan alis + km=1 -> RET (fail-open KAPANDI)")
    s, _ = dene(km="1", alis="Gent", varis="Luxembourg")
    kontrol(s is not None and s.dosya()["km"] == 275 and s.dosya()["km_kaynak"] == "dahili" and s.odeme["amount"]["value"] == "111.45", f"km=1 Gent->Luxembourg -> haversine 275 km (111.45): {s.dosya()['km'] if s else siparis_olustur.son.kod}")
    y = istek("A", "POST", "/pay/create.php", form(alis="Gent", varis="Ghent", km="10"))
    kontrol(y.kod == 422, "alis ve varis ayni yer -> dogrulanamaz -> 422")
    for kotu in ["0", "-5", "801", "9999", "abc", "", "56.5", "1e2", "٥٦", "056", "+", " "]:
        y = istek("A", "POST", "/pay/create.php", form(km=kotu))
        kontrol(y.kod == 422 and th("nl", "err_km") in y.metin, f"km={kotu!r} -> 422 err_km ({y.kod})")
    y = istek("A", "POST", "/pay/create.php", {k: v for k, v in form().items() if k != "km"})
    kontrol(y.kod == 422 and th("nl", "err_km") in y.metin, "km alani yok -> 422")
    s, _ = dene(km="800", alis="Gent", varis="Luxembourg")
    kontrol(s is not None and s.dosya()["km"] == 800 and s.odeme["amount"]["value"] == "320.40", "km=800 sinir kabul (istemci yuksek)")
    # Mollie anahtari yok: siparis olusur ama odeme baslamaz (sunucu C'de Mollie var; D'de de var) — anahtarsiz ortam unit'te


def senaryo_google():
    print("— 7. Google Distance Matrix (mock): fail-closed, '|' enjeksiyonu, hata siniflari")
    mock_sifirla()
    mock("POST", "/__test/google/reset", {})

    def olustur(**ek):
        s = siparis_olustur("B", **ek)
        return s, siparis_olustur.son
    mock("POST", "/__test/google/set?meters=56400", {})
    s, y = olustur(km="30")
    kontrol(s is not None and s.dosya()["km"] == 56 and s.dosya()["km_sunucu"] == 56 and s.dosya()["km_kaynak"] == "google" and s.odeme["amount"]["value"] == "24.29", f"google 56.4 km -> 56, km_sunucu=56: {s.dosya() if s else y.kod}")
    log = mock("GET", "/__test/google/log")["istekler"]
    kontrol(len(log) >= 1 and log[-1]["key_var"] is True and log[-1]["origins"] == "Korenmarkt 77, Gent" and log[-1]["destinations"] == "Brussels Airport (Zaventem)", f"Google istegi: {log[-1:]}")
    s, y = olustur(km="55")
    kontrol(s is not None and s.dosya()["km"] == 55 and s.dosya()["km_kaynak"] == "istemci" and s.odeme["amount"]["value"] == "23.89", "istemci google'a yakin -> istemci kalir")
    s, y = olustur(km="49")
    kontrol(s is not None and s.dosya()["km"] == 56, "istemci uzaksa google")
    s, y = olustur(km="56", alis="Rue Inconnue 5, Petite Ville", varis="Autre Lieu 9, Nulle Part")
    kontrol(s is not None and s.dosya()["km"] == 56 and s.dosya()["km_kaynak"] == "istemci" and s.dosya()["km_sunucu"] == 56, "Google varken tabloda olmayan adresler de kabul")
    # '|' enjeksiyonu: girdi kurali reddeder, Google'a HIC gitmez
    n_log = len(mock("GET", "/__test/google/log")["istekler"])
    n_odeme = len(odemeler())
    for ek in [dict(alis="Gent|Brussels"), dict(varis="Brussels Airport|Luxembourg"), dict(alis="Gent%7CAntwerpen"), dict(varis="Brussels\x00|x")]:
        y = istek("B", "POST", "/pay/create.php", form(**ek))
        kontrol(y.kod == 422 and th("nl", "val_route") in y.metin or ek.get("alis") == "Gent%7CAntwerpen", f"'|' iceren adres reddedilir ({ek}: {y.kod})")
    log_son = mock("GET", "/__test/google/log")["istekler"]
    kontrol(len(log_son) == n_log + 1 and log_son[-1]["origins"] == "Gent%7CAntwerpen", f"'|' iceren adresler icin Google'a HIC istek gitmez (yalniz literal '%7C' metni gider, '|' ayirici degil): {len(log_son)} != {n_log}+1")
    kontrol(len(odemeler()) == n_odeme + 1 or len(odemeler()) == n_odeme, "'|' istekleri odeme yaratmaz (Gent%7CAntwerpen literal metin sayilir)")
    # Google hatalari -> dahili katmana dus (FAIL-CLOSED: dahili yoksa RET)
    for ad, ayar in [("REQUEST_DENIED", "status=REQUEST_DENIED"), ("element NOT_FOUND", "element=NOT_FOUND"), ("http 500", "http=500"), ("0 metre", "meters=0"), ("ZERO_RESULTS", "element=ZERO_RESULTS"),
                     ("OVER_QUERY_LIMIT", "status=OVER_QUERY_LIMIT")]:
        mock("POST", "/__test/google/reset", {})
        mock("POST", "/__test/google/set?" + ayar, {})
        s, y = olustur(km="1")
        kontrol(s is not None and s.dosya()["km"] == 56 and s.dosya()["km_kaynak"] == "dahili" and s.dosya()["km_sunucu"] is None, f"Google {ad}: dahili tabloya dusulur (km=1 -> 56) ({s.dosya() if s else y.kod})")
        n0 = len(odemeler())
        s, y = olustur(km="30", alis="Xyz Straat 1")
        kontrol(s is None and y.kod == 422 and th("nl", "err_km_wa") in y.metin and len(odemeler()) == n0, f"Google {ad} + taninmayan adres -> 422 err_km_wa, odeme YOK ({y.kod})")
    mock("POST", "/__test/google/reset", {})
    mock("POST", "/__test/google/set?meters=900000", {})
    s, y = olustur(km="56")
    kontrol(s is None and y.kod == 422, f"Google 900 km -> RET 422 ({y.kod})")
    mock("POST", "/__test/google/reset", {})
    kontrol(GOOGLE_ANAHTAR not in kayit_log("B") and GOOGLE_ANAHTAR not in y.metin and GOOGLE_ANAHTAR not in log_oku("B"), "Google anahtari log/yanita sizmaz")
    # sunucu G: gecersiz GOOGLE_API_BASE (file://) -> Google cagrisi YOK, dahili katman
    mock("POST", "/__test/google/reset", {})
    yg = siparis_olustur("G")
    kontrol(len(mock("GET", "/__test/google/log")["istekler"]) == 0, "gecersiz GOOGLE_API_BASE: Google'a istek YAPILMAZ")


def senaryo_dogrulama():
    print("— 8. dogrulama matrisi (temiz 4xx + dilde mesaj), dizi/tekrar, NUL/CRLF, is emri enjeksiyonu")
    mock_sifirla()
    n0, f0 = len(odemeler()), len(siparis_dosyalari("A"))

    def kotu(dil, anahtar, kod=422, **ek):
        y = istek("A", "POST", "/pay/create.php", form(dil=dil, **ek))
        kontrol(y.kod == kod and th(dil, anahtar) in y.metin and "Traceback" not in y.metin and "Warning" not in y.metin, f"[{dil}] {ek} -> {kod}/{anahtar} beklenirdi, {y.kod}: {yanit_h1(y)!r}")
        kontrol(th(dil, "err_t") in y.metin and f'href="/{dil}/#rezervasyon"' in y.metin, f"[{dil}] hata sayfasi basligi ve geri baglantisi")
    kotu("nl", "val_email", eposta="jan@voorbeeld")
    kotu("fr", "val_email", eposta="jan.voorbeeld.be")
    kotu("en", "val_email", eposta="a b@c.be")
    kotu("tr", "val_email", eposta="jan@x.be\r\nBcc: kotu@example.com")
    kotu("nl", "val_email", eposta="jan@x.be\nBcc: kotu@example.com")
    kotu("fr", "val_email", eposta="a" * 95 + "@x.be")
    kotu("nl", "val_email", eposta="<jan@x.be>")
    kotu("en", "val_email", eposta="jan@x.be, kotu@y.be")
    kotu("nl", "val_name", ad="J")
    kotu("fr", "val_name", ad="   ")
    kotu("en", "val_name", ad="A" * 81)
    kotu("tr", "val_phone", telefon="1234567")
    kotu("nl", "val_phone", telefon="1" * 26)
    kotu("fr", "val_phone", telefon="")
    kotu("nl", "val_date", tarih=tarih(-1))
    kotu("fr", "val_date", tarih=tarih(400))
    kotu("en", "val_date", tarih="2026-02-30")
    kotu("tr", "val_date", tarih="30-09-2026")
    kotu("nl", "val_date", tarih=tarih(10), saat="25:00")
    kotu("fr", "val_date", tarih=tarih(10), saat="12:60")
    kotu("en", "val_date", tarih=tarih(10), saat="")
    kotu("nl", "val_date", tarih=tarih(10), donus_tarih=tarih(9), donus_saat="10:00")
    kotu("fr", "val_date", tarih=tarih(10), saat="14:30", donus_tarih=tarih(10), donus_saat="13:00")
    kotu("tr", "val_date", tarih=tarih(10), donus_tarih=tarih(11), donus_saat="24:00")
    kotu("nl", "val_route", alis="")
    kotu("fr", "val_route", varis="   ")
    kotu("en", "val_route", alis="Gent" + "x" * 200)
    kotu("tr", "val_route", varis="Brussels Airport " + "y" * 120)
    kotu("nl", "err_km", km="abc")
    # dizi / tekrar eden alanlar: temiz 400
    tam = urllib.parse.urlencode(form())
    for ad, govde, anahtar in [("alis[]", "alis%5B%5D=x&" + tam, "val_route"), ("alis tekrar", tam + "&alis=Baska", "val_route"), ("eposta[]", tam + "&eposta%5B%5D=a%40b.be", "val_email"),
                               ("km tekrar", tam + "&km=1", "err_km"), ("ad[k]", tam + "&ad%5Bk%5D=x", "val_name"), ("telefon[]", tam + "&telefon%5B%5D=1", "val_phone"),
                               ("tarih[]", tam + "&tarih%5B%5D=x", "val_date"), ("saat tekrar", tam + "&saat=10:00", "val_date"), ("yolcu[]", tam + "&yolcu%5B%5D=1", "err_pay"),
                               ("arac tekrar", tam + "&arac=vip", "err_pay"), ("web[]", tam + "&web%5B%5D=x", "err_pay"), ("dil[] (fr'e duser)", "dil%5B%5D=nl&" + tam.replace("dil=nl&", ""), "err_pay")]:
        y = istek("A", "POST", "/pay/create.php", ham=govde)
        dil_beklenen = "fr" if ad.startswith("dil[]") else "nl"
        kontrol(y.kod == 400 and th(dil_beklenen, anahtar) in y.metin, f"{ad}: temiz 400 + mesaj ({y.kod})")
    y = istek("A", "POST", "/pay/create.php", ham="alis%5B%5D=x&varis%5B%5D=y&dil=fr")
    kontrol(y.kod in (400, 422) and "Warning" not in y.metin and "TypeError" not in y.metin, f"yalniz dizi alanlari: temiz 4xx ({y.kod})")
    kontrol(len(odemeler()) == n0 and len(siparis_dosyalari("A")) == f0, "reddedilen isteklerde odeme/siparis olusmamali")
    # ---- GECERLI ama temizlenen girdiler
    s = siparis_olustur("A", ad="Jan" + chr(0) + chr(9) + "  Peeters", telefon="0470" + chr(0) + "112233", alis="Korenmarkt" + chr(13) + chr(10) + "77, Gent")
    d = s.dosya() if s else {}
    kontrol(s is not None and d["ad"] == "Jan Peeters" and d["telefon"] == "0470 112233" and d["alis"] == "Korenmarkt 77, Gent", f"NUL/CRLF/TAB temizlenir: {d.get('ad')!r} {d.get('telefon')!r} {d.get('alis')!r}")
    s = siparis_olustur("A", eposta="jan@voorbeeld.be\r\n")
    kontrol(s is not None and s.dosya()["eposta"] == "jan@voorbeeld.be", "sondaki satir sonu kirpilir")
    s = siparis_olustur("A", yolcu="99", buyuk="-3", kucuk="9", arac="bus")
    dd = s.dosya() if s else {}
    kontrol(s is not None and (dd["yolcu"], dd["buyuk"], dd["kucuk"], dd["arac"]) == (7, 0, 4, "eco"), f"yan alanlar sinirlanir: {dd}")
    s = siparis_olustur("A", alis="Gent " + "a" * 115, varis="Brussels Airport " + "b" * 103, km="56")
    kontrol(s is not None and len(s.dosya()["alis"]) == 120 and len(s.dosya()["varis"]) == 120, "120 karakter adresler kabul")
    s = siparis_olustur("A", ad="日" * 80 + "", alis="Gent 😀 é " + "€" * 10)
    kontrol(s is not None and s.dosya()["ad"] == "日" * 80, "80 kod noktalik CJK ad kabul; uzunluk kod noktasi sayisi")
    s = siparis_olustur("A", ad="Ünal​‮Öz﻿")
    kontrol(s is not None and s.dosya()["ad"] == "ÜnalÖz", f"gorunmez bicim karakterleri silinir: {s.dosya()['ad'] if s else None!r}")
    # gecersiz UTF-8 ham baytlar: temiz
    for ad, govde in [("gecersiz yuzde", b"alis=%zz&varis=%E0%A4%A&km=%"), ("gecersiz UTF-8", b"alis=\xff\xfe\xfd&varis=Gent&km=56&eposta=\xc3\x28"),
                      ("ikili cop", bytes(range(256)) * 20), ("cok fazla alan", ("&".join(f"k{i}=v" for i in range(5000))).encode()), ("bos anahtar", b"=&=&&&=x"),
                      ("NUL bayt", b"alis=a%00b&varis=c%00d&km=1%00")]:
        y = istek("A", "POST", "/pay/create.php", ham=govde)
        kontrol(y.kod in (400, 413, 422) and "Warning" not in y.metin and "Fatal" not in y.metin, f"{ad}: temiz 4xx, 500 degil ({y.kod})")
    # ---- SIRKET IS EMRI: CR/LF ile sahte 'ARACTA TAHSIL' satiri imkansiz
    mock_sifirla()
    s = siparis_olustur("A", ad="Kotu\r\nARACTA TAHSIL: 0,00 EUR", alis="Gent\nARACTA TAHSIL: 0,01 EUR", telefon="0470\r\n112233\r\nARACTA:1")
    kontrol(s is not None, f"CRLF'li alanlar temizlenip kabul: {siparis_olustur.son.kod}")
    if s:
        paid_yap(s)
        sk = bul_posta(SIRKET_EPOSTA)[0]["metin"]
        satirlar = [l for l in sk.split("\n") if l.startswith("ARACTA TAHSIL")]
        kontrol(satirlar == ["ARACTA TAHSIL: 97,15 EUR"], f"sahte ARACTA TAHSIL satiri OLMAMALI: {satirlar}")
    # ESKI siparis dosyasi (dogrulama oncesi veri): mailer yine tek satira indirir
    mock_sifirla()
    s = siparis_olustur("A")
    yol = siparis_dizini("A") / f"{s.no}.json"
    dd = json.loads(yol.read_text(encoding="utf-8"))
    dd["ad"] = "X\nARACTA TAHSIL: 0,00 EUR"
    dd["alis"] = "A\r\nARACTA TAHSIL: 0,00 EUR"
    dd["telefon"] = "1 ARACTA TAHSIL: 0,00 EUR"
    yol.write_text(json.dumps(dd), encoding="utf-8")
    paid_yap(s)
    sk = bul_posta(SIRKET_EPOSTA)
    kontrol(len(sk) == 1 and [l for l in sk[0]["metin"].split("\n") if l.startswith("ARACTA TAHSIL")] == ["ARACTA TAHSIL: 97,15 EUR"], "eski (kirli) siparis dosyasinda da sahte satir yok")


def senaryo_koruma():
    print("— 9. koruma: Origin, honeypot, metod, icerik turu, govde siniri, oran siniri (create + webhook)")
    mock_sifirla()
    n0 = len(odemeler())
    y = istek("A", "POST", "/pay/create.php", form(), origin="https://evil.example")
    kontrol(y.kod == 403 and len(odemeler()) == n0 and th("nl", "err_forbidden") in y.metin, f"yanlis Origin -> 403 + err_forbidden ({y.kod})")
    y = istek("A", "POST", "/pay/create.php", form(), origin=None, baslik={"Referer": "https://evil.example/sayfa"})
    kontrol(y.kod == 403, "yanlis Referer -> 403")
    p = PORTLAR["A"]
    y = istek("A", "POST", "/pay/create.php", form(), origin=f"http://127.0.0.1:{p}", baslik={"Referer": "https://evil.example/x"})
    kontrol(y.kod == 403, "Origin dogru, Referer yanlis -> 403")
    y = istek("A", "POST", "/pay/create.php", form(), origin="not a url")
    kontrol(y.kod == 403, "cozulemeyen Origin -> 403")
    y = istek("A", "POST", "/pay/create.php", form(), origin=f"http://127.0.0.1:{p}", baslik={"Referer": f"http://127.0.0.1:{p}/fr/"})
    kontrol(y.kod == 303, f"dogru Origin + Referer -> 303 ({y.kod})")
    y = istek("A", "POST", "/pay/create.php", form(), origin=None)
    kontrol(y.kod == 303, "Origin/Referer yok -> izin (tarayici disi istemci)")
    y = istek("A", "POST", "/pay/create.php", form(), origin="null")
    kontrol(y.kod == 303, "Origin: null -> yok sayilir")
    y = istek("A", "POST", "/pay/create.php", form(), origin=f"http://127.0.0.1:{p}", baslik={"Host": f"127.0.0.1:{p}"})
    kontrol(y.kod == 303, "Origin = site host'u -> izin")
    y = istek("C", "POST", "/pay/create.php", form(), origin="https://europetaxi24.be")
    kontrol(y.kod == 303, f"C: Origin = SITE_URL host'u -> izin ({y.kod})")
    y = istek("C", "POST", "/pay/create.php", form(), origin="https://www.europetaxi24.be")
    kontrol(y.kod == 303, "C: Origin = www. esi -> izin")
    y = istek("C", "POST", "/pay/create.php", form(), origin="https://baska.example", baslik={"Host": "europetaxi24.be"})
    kontrol(y.kod == 403, "C: Origin ne site ne Host -> 403")
    # honeypot
    n1 = len(odemeler())
    f1 = len(siparis_dosyalari("A"))
    y = istek("A", "POST", "/pay/create.php", form(web="http://spam.example"))
    kontrol(y.kod == 200 and y.metin.strip() == "tamam" and len(odemeler()) == n1 and len(siparis_dosyalari("A")) == f1, f"honeypot: sessizce 200 'tamam', siparis/odeme YOK ({y.kod} {y.metin[:30]!r})")
    y = istek("A", "POST", "/pay/create.php", form(web="   "))
    kontrol(y.kod == 303, "yalniz bosluk honeypot -> normal akis")
    y = istek("A", "POST", "/pay/create.php", form(web=""))
    kontrol(y.kod == 303, "bos honeypot -> normal akis")
    # metodlar
    for yontem in ["GET", "PUT", "DELETE", "PATCH", "OPTIONS"]:
        y = istek("A", yontem, "/pay/create.php")
        kontrol(y.kod == 405 and (y.baslik("allow") or "") == "POST", f"{yontem} -> 405 + Allow: POST ({y.kod})")
    # icerik turu / govde siniri
    y = istek("A", "POST", "/pay/create.php", ham=json.dumps(form()), tip="application/json")
    kontrol(y.kod == 415, f"JSON govde -> 415 ({y.kod})")
    y = istek("A", "POST", "/pay/create.php", ham=urllib.parse.urlencode(form()), tip="multipart/form-data; boundary=x")
    kontrol(y.kod == 415, "multipart -> 415")
    y = istek("A", "POST", "/pay/create.php", ham=urllib.parse.urlencode(form()), tip="application/x-www-form-urlencoded; charset=UTF-8")
    kontrol(y.kod == 303, "charset'li urlencoded kabul")
    y = istek("A", "POST", "/pay/create.php", ham="a=" + "x" * 70000)
    kontrol(y.kod == 413 and th("fr", "err_bad_request") in y.metin, f"70 KB govde -> 413 ({y.kod})")
    y = istek("A", "POST", "/pay/create.php", ham="a=" + "x" * 65000)
    kontrol(y.kod != 413, f"65000 bayt govde 413 olmamali ({y.kod})")
    y = istek("A", "POST", "/pay/create.php", ham="a=" + "x" * 65534)
    kontrol(y.kod != 413, "tam sinirda (65536 bayt) govde kabul")
    y = istek("A", "POST", "/pay/create.php", ham="a=" + "x" * 65535)
    kontrol(y.kod == 413, "65537 bayt -> 413")
    # oran siniri: ayni IP dakikada 5
    ip = "10.250.1.1"
    kodlar = [istek("A", "POST", "/pay/create.php", form(eposta="gecersiz"), ip=ip).kod for _ in range(6)]
    kontrol(kodlar == [422] * 5 + [429], f"dakikada 5'i asan -> 429: {kodlar}")
    y = istek("A", "POST", "/pay/create.php", form(eposta="gecersiz"), ip=ip)
    kontrol(y.kod == 429 and (y.baslik("retry-after") or "").isdigit() and 1 <= int(y.baslik("retry-after")) <= 60, f"429 + Retry-After 1..60: {y.baslik('retry-after')}")
    kontrol(th("nl", "err_rate") in y.metin, "429 sayfasi dilde err_rate mesaji")
    y = istek("A", "POST", "/pay/create.php", form(eposta="gecersiz"), ip="10.250.1.2")
    kontrol(y.kod == 422, "baska IP etkilenmez")
    y = istek("A", "POST", "/pay/create.php", form(eposta="gecersiz"), ip="10.250.1.3, 1.2.3.4")
    kontrol(y.kod == 422, "x-forwarded-for: ilk gecerli IP")
    kodlar = [istek("A", "POST", "/pay/create.php", form(eposta="gecersiz"), ip="unknown, 10.250.1.4").kod for _ in range(6)]
    kontrol(kodlar == [422] * 5 + [429], f"gecersiz ilk deger atlanir, ilk GECERLI IP sayilir: {kodlar}")
    kodlar = [istek("A", "POST", "/pay/create.php", form(eposta="gecersiz"), ip=None).kod for _ in range(6)]
    kontrol(kodlar == [422] * 5 + [429], f"X-Forwarded-For yoksa REMOTE_ADDR: {kodlar}")
    # honeypot ve Origin reddi oran sinirindan ONCE/SONRA: reddedilen Origin sayilmaz? (Origin once) — 403 sayac tuketmez
    ip2 = "10.250.1.5"
    for _ in range(8):
        istek("A", "POST", "/pay/create.php", form(), origin="https://evil.example", ip=ip2)
    y = istek("A", "POST", "/pay/create.php", form(eposta="gecersiz"), ip=ip2)
    kontrol(y.kod == 422, "Origin reddi oran sayacini tuketmez")
    # rl dosyalari: hash'li, 0600
    rl = siparis_dizini("A") / "rl"
    dosyalar = list(rl.glob("*.json"))
    kontrol(dosyalar and all(re.fullmatch(r"[0-9a-f]{64}\.json", f.name) for f in dosyalar) and all(oct(f.stat().st_mode & 0o777) == "0o600" for f in dosyalar) and oct(rl.stat().st_mode & 0o777) == "0o700",
            "rl/ dosyalari hash'li adli, 0600; klasor 0700")
    kontrol(not any(ip in f.read_text() for f in dosyalar), "rl dosyalari IP'yi acik yazmaz")
    # webhook oran siniri: dakikada 60
    ip = "10.250.2.1"
    kodlar = [istek("A", "POST", "/pay/webhook.php", {"id": "tr_yok"}, ip=ip, origin=None).kod for _ in range(62)]
    kontrol(kodlar[:60] == [200] * 60 and kodlar[60:] == [429, 429], f"webhook dakikada 60: ilk60={set(kodlar[:60])} sonrasi={kodlar[60:]}")
    y = istek("A", "POST", "/pay/webhook.php", {"id": "tr_yok"}, ip=ip, origin=None)
    kontrol(y.kod == 429 and (y.baslik("retry-after") or "").isdigit(), "webhook 429 + Retry-After")
    y = istek("A", "POST", "/pay/webhook.php", {"id": "tr_yok"}, ip="10.250.2.2", origin=None)
    kontrol(y.kod == 200, "webhook: baska IP etkilenmez")
    # kimliksiz webhook POST'lari Mollie'ye GITMEZ (sahte mock sayaci: mollie_fail sayaci dusmez)
    mock_sifirla()
    mock("POST", "/__test/mollie_fail/3", {})
    for i in range(5):
        istek("A", "POST", "/pay/webhook.php", {"id": "gecersiz " + str(i)}, ip=f"10.250.3.{i}", origin=None)
    kontrol(mollie_ham("GET", "methods")[0] == 500, "kimliksiz webhook'lar Mollie API'sine GITMEZ (mollie_fail sayaci tuketilmedi)")
    mock("POST", "/__test/mollie_fail/0", {})


def senaryo_webhook_koruma():
    print("— 10. webhook koruma: gecersiz id, mollie_id eslesmesi, tutar uyusmazligi, yabanci odeme")
    mock_sifirla()
    for gecersiz in ["", "abc", "tr_", "tr_a b", "tr_../x", "TR_abc123", "tr_abc'; DROP", "x" * 5000, "tr_abc\n", "tr_abc\r\nX: y", "tr_abc%00"]:
        y = istek("A", "POST", "/pay/webhook.php", {"id": gecersiz}, origin=None)
        kontrol(y.kod == 200 and "gecersiz" in y.metin and not postalar(), f"gecersiz id {gecersiz[:12]!r} -> 200 'gecersiz' ({y.kod})")
    for ad, govde in [("bos govde", ""), ("id[]", "id%5B%5D=tr_abc"), ("json", '{"id":"tr_abc"}'), ("id tekrar (ilk gecersiz)", "id=xx&id=tr_abc")]:
        y = istek("A", "POST", "/pay/webhook.php", ham=govde, origin=None, tip="application/x-www-form-urlencoded" if ad != "json" else "application/json")
        kontrol(y.kod == 200 and "gecersiz" in y.metin, f"{ad}: 200 gecersiz ({y.kod} {y.metin!r})")
    y = istek("A", "GET", "/pay/webhook.php?id=tr_abc")
    kontrol(y.kod == 405 and y.baslik("allow") == "POST", "webhook GET -> 405")
    y = istek("A", "POST", "/pay/webhook.php", ham="id=tr_abc&x=" + "y" * 70000, origin=None)
    kontrol(y.kod == 413, f"webhook 70 KB govde 413 ({y.kod})")
    y = istek("A", "POST", "/pay/webhook.php", {"id": "tr_yokyokyok1"}, origin=None)
    kontrol(y.kod == 200 and "odeme yok" in y.metin and not postalar(), f"Mollie'de olmayan id -> 200 ({y.kod} {y.metin!r})")
    # bizim olmayan odeme (metadata yok) ve bilinmeyen siparis
    p = PORTLAR["A"]
    kod, yabanci = mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "5.00"}, "description": "yabanci", "redirectUrl": "https://x.be/a",
                                                   "webhookUrl": f"http://127.0.0.1:{p}/pay/webhook.php", "metadata": {"baska": "sistem"}})
    r = mock("POST", f"/__test/paid/{yabanci['id']}", {})
    kontrol(r["webhook"]["kod"] == 200 and "siparis yok" in r["webhook"]["govde"] and not postalar(), f"yabanci metadata -> e-posta yok ({r['webhook']})")
    for oid in ["ET-260101-ZZZZZZ", "../../etc/passwd", "ET-260101-ZZZZZZ\n", "", 5, ["x"], "ET-260101-ABCDEF\r\nX: y"]:
        kod, y2 = mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "5.00"}, "description": "d", "redirectUrl": "https://x.be/a",
                                                  "webhookUrl": f"http://127.0.0.1:{p}/pay/webhook.php", "metadata": {"order_id": oid}})
        r = mock("POST", f"/__test/paid/{y2['id']}", {})
        kontrol(r["webhook"]["kod"] == 200 and "siparis yok" in r["webhook"]["govde"] and not postalar(), f"metadata.order_id={oid!r}: 200 'siparis yok', e-posta yok ({r['webhook']})")
    # ---- mollie_id ESLESMESI: baska (gecerli, odenmis) bir odemenin metadata'si siparisi isaret ederse ISLENMEZ
    mock_sifirla()
    s = siparis_olustur("A")
    kod, sahte = mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "24.29"}, "description": "sahte", "redirectUrl": "https://x.be/a",
                                                 "webhookUrl": f"http://127.0.0.1:{p}/pay/webhook.php", "metadata": {"order_id": s.no}})
    r = mock("POST", f"/__test/paid/{sahte['id']}", {})
    kontrol(r["webhook"]["kod"] == 200 and "siparis yok" in r["webhook"]["govde"] and not postalar() and s.dosya()["durum"] == "beklemede" and s.dosya()["mollie_id"] == s.id,
            f"metadata.order_id dogru ama mollie_id farkli: ISLENMEZ, e-posta yok, siparis degismez ({r['webhook']}, {s.dosya()['durum']})")
    kontrol("mollie_id" in kayit_log("A") and s.no in kayit_log("A"), "eslesmeyen odeme hata olarak loglanir")
    # siparis mollie_id'si bos (null) -> islenmez
    s2 = siparis_olustur("A")
    dosya = siparis_dizini("A") / f"{s2.no}.json"
    dd = json.loads(dosya.read_text())
    dd["mollie_id"] = None
    dosya.write_text(json.dumps(dd))
    r = paid_yap(s2)
    kontrol(r["webhook"]["kod"] == 200 and not postalar(), "siparisin mollie_id'si yoksa e-posta yok")
    # ---- tutar uyusmazligi
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", f"/__test/tamper/{s.id}?amount=1.00", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and "tutar" in r["webhook"]["govde"] and not postalar(), f"tutar uyusmazligi -> e-posta yok ({r['webhook']})")
    kontrol("TUTAR UYUSMUYOR " + s.no in kayit_log("A"), "tutar uyusmazligi hata olarak loglanir")
    kontrol(s.dosya()["durum"] == "tutar_uyusmazligi", f"durum tutar_uyusmazligi: {s.dosya()['durum']}")
    s = siparis_olustur("A")
    mock("POST", f"/__test/tamper/{s.id}?amount=24.30", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(not postalar() and s.dosya()["durum"] == "tutar_uyusmazligi", "1 sentlik fark bile uyusmazlik")
    s = siparis_olustur("A")
    dosya = siparis_dizini("A") / f"{s.no}.json"
    dd = json.loads(dosya.read_text())
    dd["kapora"] = 30.0     # siparis kaporasi Mollie'ye giden tutardan farkli (dosya kurcalama)
    dosya.write_text(json.dumps(dd))
    mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(not postalar() and s.dosya()["durum"] == "tutar_uyusmazligi", "odenen tutar siparis kaporasiyla esit degilse e-posta yok")
    # eski/beklemede olmayan siparisler: paid sonrasi tutar duzelmez
    mock_sifirla()


def senaryo_orders():
    print("— 11. orders paneli: giris, CSRF, kilit (sleep yok), cerez bayraklari, fixation, XSS, cikis, temizlik")
    mock_sifirla()
    p = PORTLAR["A"]
    odendi = siparis_olustur("A", ad="Piet Odendi", telefon="+32 470 99 88 77")
    paid_yap(odendi)
    bekleyen = siparis_olustur("A", ad="Bekleyen Kisi", telefon="+32 471 00 00 01", donus_tarih=tarih(20), donus_saat="09:15")
    xss = siparis_olustur("A", ad='<script>alert(1)</script>"x', alis='Gent "><img src=x onerror=alert(1)>', telefon='+32 470 <b>1</b> 22 33 44')
    kontrol(odendi and bekleyen and xss, "orders verisi olusturulamadi")
    if not (odendi and bekleyen and xss):
        return

    def csrf_al(y):
        m = re.search(r'name="csrf" value="([0-9a-f]{64})"', y.metin)
        return m.group(1) if m else None

    def cerez_deger(y):
        c = y.cerez("et_admin")
        return c.split(";")[0] if c else None
    # ---- cerezsiz GET: yalniz giris formu + oturum cerezi bayraklari
    ip = yeni_ip()
    y0 = istek("A", "GET", "/pay/orders.php", ip=ip)
    kontrol(y0.kod == 200 and 'type="password"' in y0.metin and odendi.no not in y0.metin and "Rezervasyonlar" not in y0.metin, "cerezsiz: yalniz giris formu")
    c0 = y0.cerez("et_admin") or ""
    oz = {x.strip().lower() for x in c0.split(";")}
    kontrol("httponly" in oz and "samesite=strict" in oz and "path=/pay/" in oz and "max-age=43200" in oz and "secure" not in oz, f"oturum cerezi bayraklari (http): {sorted(oz)}")
    tok0 = csrf_al(y0)
    kontrol(tok0 is not None and 'name="pw"' in y0.metin and 'method="post"' in y0.metin, "giris formunda CSRF belirteci")
    kontrol("et_admin=" in c0 and y0.baslik("cache-control") == "no-store", f"cerez et_admin; Cache-Control: no-store korunur ({y0.baslik('cache-control')})")
    ck0 = cerez_deger(y0)
    # ---- CSRF: belirtec yok / yanlis
    n = kayit_log("A").count("hatali giris")
    y = istek("A", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE}, cerez=ck0, ip=ip)
    kontrol(y.kod == 403 and "Şifre hatalı" not in y.metin and 'type="password"' in y.metin, f"CSRF belirteci yok -> 403 + yeni form, giris YOK ({y.kod})")
    y = istek("A", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": "0" * 64}, cerez=ck0, ip=ip)
    kontrol(y.kod == 403, "yanlis CSRF belirteci -> 403")
    y = istek("A", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": tok0}, ip=ip)     # cerezsiz: baska oturum
    kontrol(y.kod == 403, "belirtec baska oturumun -> 403")
    y = istek("A", "GET", "/pay/orders.php", cerez=ck0, ip=ip)
    kontrol('type="password"' in y.metin, "CSRF hatalari oturum acmaz")
    kontrol(kayit_log("A").count("hatali giris") == n, "CSRF hatasi 'hatali giris' sayaci tuketmez")
    # ---- kaba kuvvet: 4 yanlis 401, 5. 429 (sleep YOK: hizli), dogru sifre de 429
    ipk = "10.251.0.9"

    def yeni_oturum(ip_):
        y_ = istek("A", "GET", "/pay/orders.php", ip=ip_)
        return cerez_deger(y_), csrf_al(y_)
    ck, tok = yeni_oturum(ipk)
    zamanlar, kodlar = [], []
    for i in range(5):
        t0 = time.time()
        y = istek("A", "POST", "/pay/orders.php", {"pw": "yanlis" + str(i), "csrf": tok}, cerez=ck, ip=ipk)
        zamanlar.append(time.time() - t0)
        kodlar.append(y.kod)
    kontrol(kodlar == [401, 401, 401, 401, 429], f"yanlis sifre x5 -> 5.'de 429: {kodlar}")
    kontrol(max(zamanlar) < 0.9, f"sleep() YOK: yanlis denemeler yavaslatilmaz ({max(zamanlar):.2f} sn)")
    y = istek("A", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": tok}, cerez=ck, ip=ipk)
    kontrol(y.kod == 429 and (y.baslik("retry-after") or "").isdigit() and int(y.baslik("retry-after")) > 800, f"kilitliyken dogru sifre de 429 + Retry-After ({y.kod} {y.baslik('retry-after')})")
    ck2, tok2 = yeni_oturum("10.251.0.10")
    y = istek("A", "POST", "/pay/orders.php", {"pw": "yanlis", "csrf": tok2}, cerez=ck2, ip="10.251.0.10")
    kontrol(y.kod == 401 and 'type="password"' in y.metin and "hatalı" in y.metin, "baska IP: 401 + form + hata mesaji")
    # ---- dogru sifre -> 303 + yeni cerez (fixation: oturum kimligi degisir)
    ipd = yeni_ip()
    ck_on, tok_on = yeni_oturum(ipd)
    y = istek("A", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": tok_on}, cerez=ck_on, ip=ipd)
    kontrol(y.kod == 303 and y.baslik("location") == "/pay/orders.php", f"dogru sifre -> 303 ({y.kod})")
    ck_son = cerez_deger(y)
    kontrol(ck_son is not None and ck_son != ck_on, "giristen sonra oturum kimligi YENILENIR (fixation korumasi)")
    oz = {x.strip().lower() for x in (y.cerez("et_admin") or "").split(";")}
    kontrol({"httponly", "samesite=strict", "path=/pay/", "max-age=43200"} <= oz and "secure" not in oz, f"giris cerezi bayraklari: {sorted(oz)}")
    y = istek("A", "GET", "/pay/orders.php", cerez=ck_on, ip=ipd)
    kontrol('type="password"' in y.metin and odendi.no not in y.metin, "eski (giris oncesi) oturum kimligiyle panel ACILMAZ")
    y = istek("A", "GET", "/pay/orders.php", cerez="et_admin=saldirgan0123456789abcdefghij", ip=ipd)
    kontrol('type="password"' in y.metin and (cerez_deger(y) or "").split("=")[1] != "saldirgan0123456789abcdefghij", f"strict mode: sahte oturum kimligi BENIMSENMEZ ({cerez_deger(y)})")
    # ---- panel
    y = istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd)
    html = y.metin
    kontrol(y.kod == 200 and "Rezervasyonlar" in html and odendi.no in html and bekleyen.no in html and xss.no in html, "panel listesi")
    kontrol("Piet Odendi" in html and 'href="tel:+32470998877"' in html, "musteri adi + tiklanabilir tel:")
    kontrol("ÖDENDİ" in html and "BEKLİYOR" in html and "araçta 97,15 €" in html and "kapora 24,29 €" in html and "121,44 €" in html, "rozetler + tutarlar")
    kontrol("Tahsil edilen kapora" in html and "Araçta beklenen" in html and "↩ " in html, "ozet kartlari + donus")
    kontrol("✉ müşteri ✓ · şirket ✓" in html, "e-posta durumu (alici basina)")
    kontrol("<script" not in html.lower(), "panelde HICBIR <script> etiketi olmamali")
    kontrol("&lt;script&gt;alert(1)&lt;/script&gt;&quot;x" in html and "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;" in html and "<img src=x" not in html and "&lt;b&gt;1&lt;/b&gt;" in html, "ad/adres/telefon kacisli")
    kontrol("web kökünün İÇİNDE" not in html, "A: orders_dir web kokunun disinda -> kirmizi uyari yok")
    for f, var, yok in [("odendi", [odendi.no], [bekleyen.no, xss.no]), ("beklemede", [bekleyen.no, xss.no], [odendi.no]), ("hepsi", [odendi.no, bekleyen.no], [])]:
        y = istek("A", "GET", f"/pay/orders.php?f={f}", cerez=ck_son, ip=ipd)
        kontrol(all(v in y.metin for v in var) and not any(v in y.metin for v in yok), f"f={f} suzgeci")
    y = istek("A", "GET", "/pay/orders.php?f=%3Cscript%3E&f2[]=x", cerez=ck_son, ip=ipd)
    kontrol(y.kod == 200 and "<script" not in y.metin.lower() and odendi.no in y.metin, "gecersiz suzgec 'hepsi'ye duser")
    y = istek("A", "GET", "/pay/orders.php?f[]=odendi", cerez=ck_son, ip=ipd)
    kontrol(y.kod == 200 and "Warning" not in y.metin, "f[] dizi parametresi temiz")
    # tum durum degerleri KACISLANIR (dosyaya enjekte edilmis kotu durum), sorunlu durumlar tahsilata sayilmaz
    yol = siparis_dizini("A") / f"{bekleyen.no}.json"
    dd = json.loads(yol.read_text())
    dd["durum"] = '<img src=x onerror=alert(2)>'
    dd["arac"] = '"><svg onload=alert(3)>'
    dd["no"] = bekleyen.no
    yol.write_text(json.dumps(dd))
    y = istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd)
    kontrol("<img" not in y.metin.lower() and "&lt;img src=x onerror=alert(2)&gt;" in y.metin.lower(), "bilinmeyen durum degeri KACISLI yazilir (buyuk harfe cevrilse bile)")
    kontrol("<svg" not in y.metin.lower() and "&lt;svg onload=alert(3)&gt;" in y.metin, "arac alani kacisli")
    mock("POST", f"/__test/refund/{odendi.id}", {})
    y = istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd)
    kontrol("İADE" in y.metin, "iade rozeti")
    m = re.search(r'<div class="kart"><b>([^<]*)</b><span>Tahsil edilen kapora', y.metin)
    beklenen_toplam = sum(json.loads(f.read_text(encoding="utf-8")).get("kapora", 0) for f in siparis_dosyalari("A") if json.loads(f.read_text(encoding="utf-8")).get("durum") == "odendi")
    kontrol(m is not None and m.group(1) == f"{beklenen_toplam:,.2f}".replace(",", " ").replace(".", ",") + " €", f"tahsilat yalniz 'odendi' siparislerin kaporasi (iade/tutar uyusmazligi SAYILMAZ): panel={m.group(1) if m else None} beklenen={beklenen_toplam:.2f}")
    kontrol(json.loads((siparis_dizini("A") / f"{odendi.no}.json").read_text())["durum"] == "iade", "iade edilen siparisin durumu iade")
    tut = siparis_olustur("A", ad="Tutar Sorunu")
    mock("POST", f"/__test/tamper/{tut.id}?amount=1.00", {})
    mock("POST", f"/__test/paid/{tut.id}?webhook=0", {})
    istek("A", "GET", f"/pay/success.php?order={tut.no}")
    y = istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd)
    kontrol("TUTAR UYUŞMUYOR" in y.metin and "ödenen tutar beklenenle uyuşmuyor" in y.metin, "tutar uyusmazligi panelde")
    y = istek("A", "GET", "/pay/orders.php?f=sorunlu", cerez=ck_son, ip=ipd)
    kontrol(tut.no in y.metin and odendi.no in y.metin and bekleyen.no not in y.metin, "sorunlu suzgeci")
    # ---- cikis: GET cikis YAPMAZ; POST CSRF ister
    y = istek("A", "GET", "/pay/orders.php?cikis=1", cerez=ck_son, ip=ipd)
    kontrol(y.kod == 200 and "Rezervasyonlar" in y.metin, "GET ?cikis=1 artik cikis YAPMAZ (CSRF)")
    tok_panel = csrf_al(istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd))
    kontrol(tok_panel is not None and 'name="eylem" value="cikis"' in istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd).metin, "panelde cikis formu + CSRF")
    y = istek("A", "POST", "/pay/orders.php", {"eylem": "cikis"}, cerez=ck_son, ip=ipd)
    kontrol(y.kod == 403, "belirtecsiz cikis POST'u -> 403")
    y = istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd)
    kontrol("Rezervasyonlar" in y.metin, "belirtecsiz cikis oturumu kapatmaz")
    # ---- temizlik: CSRF + kuru/gercek
    eski = json.loads((siparis_dizini("A") / f"{bekleyen.no}.json").read_text())
    eski_no = "ET-250101-A1B2C3"
    eski.update(no=eski_no, durum="beklemede", olusturma="2025-01-01T10:00:00+01:00")
    (siparis_dizini("A") / f"{eski_no}.json").write_text(json.dumps(eski))
    y = istek("A", "POST", "/pay/orders.php", {"eylem": "temizle"}, cerez=ck_son, ip=ipd)
    kontrol(y.kod == 403 and (siparis_dizini("A") / f"{eski_no}.json").exists(), "CSRF'siz temizlik -> 403, hicbir sey silinmez")
    y = istek("A", "POST", "/pay/orders.php", {"eylem": "temizle_kuru", "csrf": tok_panel}, cerez=ck_son, ip=ipd)
    kontrol(y.kod == 200 and "KURU CALISTIRMA" in y.metin and eski_no in y.metin and (siparis_dizini("A") / f"{eski_no}.json").exists(), "kuru calistirma ozet gosterir, silmez")
    kontrol("Jan Peeters" not in y.metin.split("Veri temizliği")[1][:600] if "Veri temizliği" in y.metin else True, "temizlik ozetinde kisisel veri yok")
    y = istek("A", "POST", "/pay/orders.php", {"eylem": "temizle", "csrf": tok_panel}, cerez=ck_son, ip=ipd)
    kontrol(y.kod == 200 and "Temizlik tamamlandi" in y.metin and not (siparis_dizini("A") / f"{eski_no}.json").exists(), "gercek temizlik eski odenmemis siparisi siler")
    y = istek("A", "POST", "/pay/orders.php", {"eylem": "cikis", "csrf": tok_panel}, cerez=ck_son, ip=ipd)
    kontrol(y.kod == 303 and "expires=" in (y.cerez("et_admin") or "").lower(), f"CSRF'li cikis: 303 + cerez silinir ({y.kod})")
    y = istek("A", "GET", "/pay/orders.php", cerez=ck_son, ip=ipd)
    kontrol('type="password"' in y.metin and odendi.no not in y.metin, "cikistan sonra eski oturum gecersiz")
    # ---- Origin, metod, govde
    ipx = yeni_ip()
    ckx, tokx = yeni_oturum(ipx)
    y = istek("A", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": tokx}, cerez=ckx, origin="https://evil.example", ip=ipx)
    kontrol(y.kod == 403 and y.cerez("et_admin") is None, "giris POST'unda yanlis Origin -> 403")
    y = istek("A", "PUT", "/pay/orders.php", ham="x", ip=ipx)
    kontrol(y.kod == 405 and "GET" in (y.baslik("allow") or ""), "orders: PUT 405")
    y = istek("A", "POST", "/pay/orders.php", ham="pw=" + "x" * 70000, ip=yeni_ip())
    kontrol(y.kod == 413, f"orders: 70 KB govde 413 ({y.kod})")
    # ---- sifre dizi/bosluk
    y = istek("A", "POST", "/pay/orders.php", ham="pw%5B%5D=x&csrf=" + tokx, cerez=ckx, ip=ipx)
    kontrol(y.kod in (200, 403) and "Warning" not in y.metin and "Fatal" not in y.metin, f"pw[] dizi: temiz yanit ({y.kod})")
    # ---- ADMIN_PASSWORD yok (sunucu C) -> KAPALI
    for yontem, veri in [("GET", None), ("POST", {"pw": "herhangi"}), ("POST", {"pw": ""})]:
        y = istek("C", yontem, "/pay/orders.php", veri, origin="https://europetaxi24.be")
        kontrol(y.kod == 503 and "kapalı" in y.metin and y.cerez("et_admin") is None, f"ADMIN_PASSWORD yok: KAPALI ({yontem} {y.kod})")
    # ---- sunucu D (Brevo yok) icin de giris calisir
    ipd2 = yeni_ip()
    ckd, tokd = None, None
    y = istek("D", "GET", "/pay/orders.php", ip=ipd2)
    ckd, tokd = cerez_deger(y), csrf_al(y)
    y = istek("D", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": tokd}, cerez=ckd, ip=ipd2)
    kontrol(y.kod == 303, "sunucu D: giris")


def yonetici_giris(sunucu, sifre=ADMIN_SIFRE, ip=None):
    """orders/test ortak oturumu: giris yapar. Doner: (cerez_basligi, csrf) — basarisizsa (None, csrf)."""
    ip = ip or yeni_ip()
    y = istek(sunucu, "GET", "/pay/orders.php", ip=ip)
    m = re.search(r'name="csrf" value="([0-9a-f]{64})"', y.metin)
    c = y.cerez("et_admin")
    if not m or not c:
        return None, None
    ck = c.split(";")[0]
    y = istek(sunucu, "POST", "/pay/orders.php", {"pw": sifre, "csrf": m.group(1)}, cerez=ck, ip=ip)
    if y.kod != 303:
        return None, m.group(1)
    yeni = y.cerez("et_admin")
    ck = yeni.split(";")[0] if yeni else ck
    y = istek(sunucu, "GET", "/pay/test.php", cerez=ck, ip=ip)
    m2 = re.search(r'name="csrf" value="([0-9a-f]{64})"', y.metin)
    return ck, (m2.group(1) if m2 else None)


def senaryo_test_ucu():
    print("— 12. test.php: ?pw= ASLA, POST govdesi + CSRF, ortak kilit, rapor (sir degeri yok), KIRMIZI uyarilar")
    mock_sifirla()
    # GET ?pw= ASLA kabul edilmez
    for yol in [f"/pay/test.php?pw={ADMIN_SIFRE}", f"/pay/test.php?pw={urllib.parse.quote(ADMIN_SIFRE)}&x=1", "/pay/test.php", f"/pay/test.php?pw[]={ADMIN_SIFRE}"]:
        y = istek("A", "GET", yol)
        kontrol(y.kod == 200 and 'type="password"' in y.metin and "MOLLIE_API_KEY" not in y.metin and "ayarlı (" not in y.metin, f"GET {yol[:34]}: rapor VERILMEMELI")
        kontrol((y.cerez("et_admin") or "").count("=") >= 1 and ADMIN_SIFRE not in y.metin, "GET ?pw= sifreyi sayfaya yansitmaz")
    ip = yeni_ip()
    y = istek("A", "GET", "/pay/test.php", ip=ip)
    ck = y.cerez("et_admin").split(";")[0]
    tok = re.search(r'name="csrf" value="([0-9a-f]{64})"', y.metin).group(1)
    y = istek("A", "POST", f"/pay/test.php?pw={ADMIN_SIFRE}", {"x": "1", "csrf": tok}, cerez=ck, ip=ip)
    kontrol("MOLLIE_API_KEY" not in y.metin and 'type="password"' in y.metin, "POST + URL'de pw (govdede yok): kabul edilmez")
    y = istek("A", "POST", f"/pay/test.php?pw={ADMIN_SIFRE}", {"pw": "yanlis", "csrf": tok}, cerez=ck, ip=ip)
    kontrol(y.kod == 403 and "MOLLIE_API_KEY" not in y.metin, "URL'de dogru, govdede yanlis sifre -> 403")
    # CSRF olmadan giris yok
    y = istek("A", "POST", "/pay/test.php", {"pw": ADMIN_SIFRE}, cerez=ck, ip=ip)
    kontrol(y.kod == 403 and "MOLLIE_API_KEY" not in y.metin, "CSRF'siz giris -> 403")
    # dogru sifre -> PRG -> rapor
    ck2, tok2 = yonetici_giris("A")
    kontrol(ck2 is not None, "test.php: dogru sifreyle giris")
    y = istek("A", "GET", "/pay/test.php", cerez=ck2)
    r = y.metin
    kontrol(y.kod == 200, f"rapor 200 ({y.kod})")
    for beklenen in ["MOLLIE_API_KEY", "BREVO_API_KEY", "GOOGLE_SERVER_KEY", "ADMIN_PASSWORD", f"ayarlı ({len(MOLLIE_ANAHTAR)} karakter", "test anahtarı", "Mollie bağlantısı", "bancontact", "creditcard", "applepay",
                     "Brevo erişilebilirliği", "anahtar geçerli", "Test e-postası gönder", "KURULUM BİTİNCE", "PHP sürümü", "cURL eklentisi", "mbstring", "intl eklentisi", "open_basedir",
                     "Sipariş klasörü web kökünün DIŞINDA", "izni 0700", ".htaccess", "beyaz liste", "TRUSTED_PROXY_HEADER", "HTTP_X_FORWARDED_FOR", "Mesafe verisi", "Dil sayfası"]:
        kontrol(beklenen in r, f"rapor '{beklenen}' icermeli")
    kontrol("KIRMIZI UYARI" not in r, "A: web disi klasor -> kirmizi uyari YOK")
    kontrol("ayarlı değil" in r, "ayarli olmayan anahtar 'ayarlı değil' gorunur")
    for i, sir in enumerate(SIRLAR):
        kontrol(sir not in r, f"raporda SIR degeri YOK olmali (#{i})")
        kontrol(all(sir not in v for k, v in y.basliklar), f"basliklarda SIR yok (#{i})")
    kontrol(ADMIN_SIFRE[:10] not in r and 'name="pw"' not in r, "rapor sifreyi/sifre alanini icermez")
    kontrol("Traceback" not in r and "Warning" not in r, "rapor stack/uyari icermez")
    # test e-postasi: oturum + CSRF
    n0 = len(postalar())
    y2 = istek("A", "POST", "/pay/test.php", {"eposta_testi": "1", "csrf": tok2}, cerez=ck2)
    P = postalar()
    kontrol(y2.kod == 200 and len(P) == n0 + 1 and P[-1]["alicilar"] == [SIRKET_EPOSTA] and P[-1]["konu"] == "Europa Taxi kurulum testi" and "Gönderildi" in y2.metin, f"test e-postasi COMPANY_EMAIL'e ({len(P)}, {y2.kod})")
    y3 = istek("A", "POST", "/pay/test.php", {"eposta_testi": "1"}, cerez=ck2)
    kontrol(y3.kod == 403 and len(postalar()) == n0 + 1, "CSRF'siz test e-postasi -> 403, gonderilmez")
    n1 = len(postalar())
    istek("A", "POST", "/pay/test.php", {"eposta_testi": "1", "csrf": "0" * 64})
    kontrol(len(postalar()) == n1, "oturumsuz istek test e-postasi gonderemez")
    # Mollie arizasi raporlanir
    mock("POST", "/__test/mollie_fail/1", {})
    y = istek("A", "GET", "/pay/test.php", cerez=ck2)
    kontrol("HTTP 500" in y.metin, "Mollie hatasi raporda gorunur")
    # oturum sonrasi POST'ta yanlis Origin
    y = istek("A", "POST", "/pay/test.php", {"eposta_testi": "1", "csrf": tok2}, cerez=ck2, origin="https://evil.example")
    kontrol(y.kod == 403, "test: yanlis Origin 403")
    # Google (sunucu B)
    ckb, tokb = yonetici_giris("B")
    yb = istek("B", "GET", "/pay/test.php", cerez=ckb)
    kontrol("Brussels → Gent: 56 km" in yb.metin and GOOGLE_ANAHTAR not in yb.metin and f"ayarlı ({len(GOOGLE_ANAHTAR)} karakter" in yb.metin, "Google erisilebilirligi raporlanir, anahtar yok")
    # sunucu D: Brevo yok
    ckd, _ = yonetici_giris("D")
    yd = istek("D", "GET", "/pay/test.php", cerez=ckd)
    kontrol("boşsa PHP mail() kullanılır" in yd.metin and ADMIN_SIFRE not in yd.metin and "Brevo anahtarı" in yd.metin and "ayarlı değil" in yd.metin, "D: Brevo eksik uyarisi")
    # sunucu G: gecersiz tabanlar
    ckg, _ = yonetici_giris("G")
    yg = istek("G", "GET", "/pay/test.php", cerez=ckg)
    kontrol(yg.metin.count("GEÇERSİZ (yalnız https:// veya http://127.0.0.1)") >= 3 or yg.metin.count("GEÇERSİZ") >= 2, "G: gecersiz *_API_BASE raporda")
    # ADMIN_PASSWORD yok (C): KAPALI
    yc = istek("C", "POST", "/pay/test.php", {"pw": "x"}, origin="https://europetaxi24.be")
    kontrol(yc.kod == 503 and "kapalı" in yc.metin.lower(), f"ADMIN_PASSWORD yok: test KAPALI ({yc.kod})")
    yc = istek("C", "GET", "/pay/test.php?pw=x")
    kontrol(yc.kod == 503, "ADMIN_PASSWORD yok: GET de KAPALI")
    # ORTAK kilit: test.php'de 5 yanlis -> 429; ayni IP orders'ta da kilitli
    ipk = "10.252.0.9"
    y = istek("A", "GET", "/pay/test.php", ip=ipk)
    ckk = y.cerez("et_admin").split(";")[0]
    tk = re.search(r'name="csrf" value="([0-9a-f]{64})"', y.metin).group(1)
    kodlar = [istek("A", "POST", "/pay/test.php", {"pw": "yanlis" + str(i), "csrf": tk}, cerez=ckk, ip=ipk).kod for i in range(5)]
    kontrol(kodlar == [403, 403, 403, 403, 429], f"test.php: yanlis sifre x5 -> 5.'de 429 ({kodlar})")
    y = istek("A", "POST", "/pay/test.php", {"pw": ADMIN_SIFRE, "csrf": tk}, cerez=ckk, ip=ipk)
    kontrol(y.kod == 429 and (y.baslik("retry-after") or "").isdigit(), "kilitliyken dogru sifre de 429")
    y = istek("A", "GET", "/pay/orders.php", ip=ipk)
    ckk2 = y.cerez("et_admin").split(";")[0]
    tk2 = re.search(r'name="csrf" value="([0-9a-f]{64})"', y.metin).group(1)
    y = istek("A", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": tk2}, cerez=ckk2, ip=ipk)
    kontrol(y.kod == 429, "orders.php ayni kilidi paylasir (test.php'de kilitlenen IP orders'ta da 429)")
    # https site (sunucu S): Secure cerez
    ys = istek("S", "GET", "/pay/orders.php", origin=None)
    oz = {x.strip().lower() for x in (ys.cerez("et_admin") or "").split(";")}
    kontrol("secure" in oz and "httponly" in oz and "samesite=strict" in oz and "path=/pay/" in oz, f"https SITE_URL: et_admin Secure: {sorted(oz)}")
    ipS = yeni_ip()
    yS = istek("S", "GET", "/pay/orders.php", ip=ipS, origin=None)
    ckS = yS.cerez("et_admin").split(";")[0]
    tS = re.search(r'name="csrf" value="([0-9a-f]{64})"', yS.metin).group(1)
    yS2 = istek("S", "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE, "csrf": tS}, cerez=ckS, ip=ipS, origin="https://europetaxi24.be")
    kontrol(yS2.kod == 303 and "secure" in {x.strip().lower() for x in (yS2.cerez("et_admin") or "").split(";")}, f"S: https origin ile giris 303 + Secure cerez ({yS2.kod})")


def kirmizi_uyari_var(metin):
    return "KIRMIZI UYARI" in metin


def senaryo_depo():
    print("— 13. depo: varsayilan web disi klasor, web ici yedek (KIRMIZI uyari), izinler, siparis_kaydet hatasi -> odeme YOK")
    mock_sifirla()
    # ---- E: varsayilan orders_dir = www'nin bir ustu/et-siparisler
    e_dizin = TMP / "e" / "et-siparisler"
    # eski konumdan (pay/orders/) tasima: eski siparis dosyasi + log
    eski_no = "ET-250101-0LD001"
    eski_yol = X.www_e / "pay" / "orders" / f"{eski_no}.json"
    eski_yol.write_text(json.dumps({"no": eski_no, "durum": "odendi", "ad": "Eski Musteri"}), encoding="utf-8")
    (X.www_e / "pay" / "orders" / "kayit.log").write_text("2025-01-01 10:00:00  eski log satiri\n", encoding="utf-8")
    s = siparis_olustur("E")
    kontrol((e_dizin / f"{eski_no}.json").is_file() and not eski_yol.exists() and oct((e_dizin / f"{eski_no}.json").stat().st_mode & 0o777) == "0o600",
            "eski pay/orders/ siparisleri web disi klasore TASINIR (0600), eskisi silinir")
    kontrol(not (X.www_e / "pay" / "orders" / "kayit.log").exists() and "eski log satiri" in (e_dizin / "kayit.log").read_text(encoding="utf-8") and "tasindi" in (e_dizin / "kayit.log").read_text(encoding="utf-8"),
            "eski kayit.log yeni loga eklenir, eski dosya kalmaz")
    kontrol(s is not None, f"E: create 303 ({siparis_olustur.son.kod})")
    if s:
        kontrol((e_dizin / f"{s.no}.json").is_file(), "varsayilan siparis klasoru = <www>/../et-siparisler")
        kontrol(not list((X.www_e / "pay" / "orders").glob("ET-*.json")) and not list((X.www_e).rglob("ET-*.json")), "siparis www/ agacinin ICINDE degil")
        kontrol(oct(e_dizin.stat().st_mode & 0o777) == "0o700" and oct((e_dizin / f"{s.no}.json").stat().st_mode & 0o777) == "0o600", "E: klasor 0700, dosya 0600")
        kontrol((e_dizin / ".htaccess").is_file() and "Require all denied" in (e_dizin / ".htaccess").read_text(), "E: klasor icinde .htaccess kilidi de olusur")
        ck, tok = yonetici_giris("E")
        kontrol(ck is not None, "E: yonetici girisi")
        y = istek("E", "GET", "/pay/test.php", cerez=ck)
        kontrol("Sipariş klasörü web kökünün DIŞINDA" in y.metin and not kirmizi_uyari_var(y.metin) and "✓" in y.metin, "E: test.php web disi klasoru YESIL gosterir")
        y = istek("E", "GET", "/pay/orders.php", cerez=ck)
        kontrol(s.no in y.metin and "web kökünün İÇİNDE" not in y.metin, "E: panel kirmizi uyari vermez")
    # ---- F: varsayilan konum olusturulamaz (yerinde dosya var) -> pay/orders/ yedegi + KIRMIZI uyari
    f_orders = X.www_f / "pay" / "orders"
    s = siparis_olustur("F")
    kontrol(s is not None, f"F: yedek konumla create yine calisir ({siparis_olustur.son.kod})")
    if s:
        kontrol((f_orders / f"{s.no}.json").is_file(), "F: siparis pay/orders/ yedek klasorune yazildi")
        kontrol((f_orders / ".htaccess").is_file() and "Require all denied" in (f_orders / ".htaccess").read_text(), "F: yedek klasorde .htaccess kilidi")
        kontrol(oct((f_orders / f"{s.no}.json").stat().st_mode & 0o777) == "0o600", "F: dosya 0600")
        ck, tok = yonetici_giris("F")
        kontrol(ck is not None, "F: yonetici girisi")
        y = istek("F", "GET", "/pay/test.php", cerez=ck)
        kontrol(kirmizi_uyari_var(y.metin) and "web kökünün İÇİNDE" in y.metin and "✗" in y.metin, "F: test.php KIRMIZI uyari gosterir")
        y = istek("F", "GET", "/pay/orders.php", cerez=ck)
        kontrol("web kökünün İÇİNDE" in y.metin and s.no in y.metin, "F: orders paneli de kirmizi uyari verir")
    # ---- H: dosya yazma basarisiz (RLIMIT_FSIZE) -> siparis_kaydet FALSE -> odeme BASLATILMAZ
    n0 = len(odemeler())
    y = istek("H", "POST", "/pay/create.php", form())
    kontrol(y.kod == 500 and th("nl", "err_pay") in y.metin and re.search(r"ref: [0-9a-f]{8}", y.metin) is None, f"H: siparis yazilamazsa 500 + genel hata ({y.kod}: {yanit_h1(y)!r})")
    kontrol(len(odemeler()) == n0, "H: siparis kaydedilemediyse Mollie'ye GIDILMEZ (odeme yok)")
    kontrol(not list(siparis_dizini("H").glob("ET-*.json")) and not [f for f in siparis_dizini("H").iterdir() if f.name.startswith(".tmp") and f.stat().st_size > 0], "H: yarim/gecici siparis dosyasi kalmaz")


def senaryo_basliklar_hatalar():
    print("— 14. basliklar (no-store, nosniff, no-referrer, XFO, CSP), X-Powered-By yok, hata sayfalarinda yol sizmasi yok")
    # ---- K: display_errors=1 ile bile ic ayrinti sizmaz; ozel hata tetikleyici
    for t_, ad in [("warning", "create"), ("typeerror", "success"), ("exception", "orders"), ("exception", "webhook"), ("fatal", "create"), ("notice", "test"), ("deprecated", "create"), ("divzero", "success")]:
        y = istek("K", "GET", f"/pay/_hata_testi.php?t={t_}&ad={ad}", kayit=True)
        govde = y.metin
        if t_ == "deprecated":
            kontrol(y.kod == 200 and "DEPRECATED-KORUNDU" in govde, f"K/{t_}: kullanimdan kalkan islev akisi bozmaz ({y.kod})")
            continue
        kontrol(y.kod == 500, f"K/{t_}/{ad}: 500 olmali ({y.kod})")
        kontrol(re.search(r"ref: [0-9a-f]{8}", govde) is not None or (ad == "webhook" and re.fullmatch(r"hata [0-9a-f]{8}", govde.strip())), f"K/{t_}/{ad}: istek kimligi (ref) var: {govde[:120]!r}")
        for yasak in ["GIZLI-IC-AYRINTI", "/tmp/", "/home/", ".php", "Stack trace", "Warning", "Notice", "Fatal error", "Uncaught", "on line", str(X.www), "et_php_test_"]:
            kontrol(yasak not in govde, f"K/{t_}/{ad}: hata sayfasi '{yasak}' SIZDIRMAZ: {govde[:200]!r}")
        kontrol(y.baslik("x-powered-by") is None, "X-Powered-By yok")
    kl = kayit_log("K")
    kontrol("beklenmeyen hata" in kl and "ErrorException" in kl and "TypeError" in kl and "RuntimeException" in kl, f"K: hata sinifi + dosya:satir loglanir: {kl[-500:]}")
    kontrol("GIZLI-IC-AYRINTI" not in kl and str(X.www) not in kl and "/tmp/" not in kl, "K: hata mesaji/mutlak yol loga yazilmaz")
    kontrol(re.search(r"_hata_testi\.php:\d+", kl) is not None, "K: dosya adi:satir (yolsuz) loglanir")
    # gercek uclarda display_errors=1 iken bozuk girdiler: PHP uyarisi ekrana BASILMAZ
    for yol, yontem, ham in [("/pay/create.php", "POST", b"alis[]=x&varis=%ff&km=1&tarih[]=1"), ("/pay/webhook.php", "POST", b"id[]=1"), ("/pay/success.php?order[]=x&n=%ff&dil[]=1", "GET", None),
                             ("/pay/orders.php?f[]=1", "GET", None), ("/pay/test.php?pw[]=1", "GET", None)]:
        y = istek("K", yontem, yol, ham=ham)
        kontrol("Warning" not in y.metin and "Notice" not in y.metin and "Fatal" not in y.metin and "Deprecated" not in y.metin and "Stack trace" not in y.metin, f"K {yol}: uyari/notice YOK ({y.kod})")
    # ---- tum yanitlarda basliklar
    csp = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    eksik = []
    yol_sizan = []
    for ad, yontem, yol, r in TUM_YANITLAR:
        cc = r.baslik("cache-control") or ""
        if (cc != "no-store" or r.baslik("x-content-type-options") != "nosniff" or r.baslik("referrer-policy") != "no-referrer"
                or r.baslik("x-frame-options") != "DENY" or r.baslik("content-security-policy") != csp or r.baslik("x-powered-by") is not None):
            eksik.append((ad, yontem, yol, r.kod, cc, r.baslik("x-powered-by")))
        if re.search(r"(/tmp/|/home/|\.php on line|Stack trace|Fatal error|Warning:|Notice:|Deprecated:|Uncaught|et_php_test_)", r.metin):
            yol_sizan.append((ad, yontem, yol, r.kod, re.search(r"(/tmp/|/home/|\.php on line|Stack trace|Fatal error|Warning:|Notice:|Deprecated:|Uncaught|et_php_test_)", r.metin).group(1)))
    kontrol((len(TUM_YANITLAR) > 300 or not X.tam_kosu) and not eksik, f"{len(TUM_YANITLAR)} yanittan {len(eksik)} tanesinde temel baslik eksik/X-Powered-By var: {eksik[:5]}")
    kontrol(not yol_sizan, f"hicbir yanitta mutlak yol/stack/uyari yok: {yol_sizan[:5]}")
    # 303 + 4xx/5xx durumlarinin da basligi tamam (ozellikle create 303)
    kontrol((not X.tam_kosu) or any(r.kod == 303 for _, _, _, r in TUM_YANITLAR) and any(r.kod == 429 for _, _, _, r in TUM_YANITLAR) and any(r.kod == 403 for _, _, _, r in TUM_YANITLAR) and any(r.kod == 500 for _, _, _, r in TUM_YANITLAR),
            "baslik denetimi 303/403/429/500 yanitlarini da kapsadi")
    html_yanitlar = [r for _, _, _, r in TUM_YANITLAR if (r.baslik("content-type") or "").startswith("text/html")]
    kontrol(html_yanitlar and all("charset=utf-8" in (r.baslik("content-type") or "").lower() for r in html_yanitlar), "HTML yanitlari UTF-8")


def senaryo_yapilandirma():
    print("— 15. yapilandirma: gecersiz *_API_BASE -> dis servis cagrisi YOK (Mollie/Brevo/Google)")
    mock_sifirla()
    y = istek("G", "POST", "/pay/create.php", form())
    kontrol(y.kod == 502 and th("nl", "err_pay") in y.metin, f"G: gecersiz MOLLIE_API_BASE -> temiz 502 ({y.kod})")
    kontrol(len(odemeler()) == 0 and mock("GET", "/__test/state")["brevo_deneme"] == 0, "G: mock'a HICBIR istek gitmedi")
    d = siparis_dosyalari("G")
    kontrol(len(d) >= 1 and all(json.loads(f.read_text())["durum"] == "odeme_baslatilamadi" for f in d), "G: siparisler odeme_baslatilamadi olarak isaretlenir")
    y = istek("G", "POST", "/pay/webhook.php", {"id": "tr_abcdefghij"}, origin=None)
    kontrol(y.kod == 500 and "mollie ulasilamadi" in y.metin, f"G: webhook Mollie'ye ulasamaz -> 500 ({y.kod})")
    y = istek("G", "GET", f"/pay/success.php?order={json.loads(d[-1].read_text())['no']}")
    kontrol(y.kod == 200 and th("nl", "succ_fail_t") in y.metin, "G: odeme_baslatilamadi siparisi basarisiz sayfasi (yeniden dene)")
    kontrol("mollie_api_base" not in y.metin, "hata sayfasi ayar adini sizdirmaz")
    # ortam degiskeni onceligi (config.php degerleri): gecici config'li kopya
    www_c = TMP / "cfg_www"
    shutil.rmtree(www_c, ignore_errors=True)
    shutil.copytree(X.www / "pay", www_c / "pay")
    (www_c / "pay" / "config.php").write_text(
        "<?php return ['mollie_api_key'=>'test_FromConfig0123456789abcdefgh','site_url'=>'https://config.example','company_email'=>'cfg@sirket.test','mail_from'=>'cfgfrom@sirket.test',"
        "'brevo_api_key'=>'cfg-brevo','google_server_key'=>'cfg-google','admin_password'=>'cfg-admin-pass-123','orders_dir'=>'','methods'=>['bancontact'],'distance_tolerance_pct'=>7,"
        "'trusted_proxy_header'=>'','mollie_api_base'=>'','brevo_api_base'=>'','google_api_base'=>''];", encoding="utf-8")
    o1, p1 = php_json("echo json_encode(array_diff_key(cfg(true), ['_kaynak' => 1]));", www=www_c, env={})
    kontrol(o1 is not None and o1["mollie_api_key"] == "test_FromConfig0123456789abcdefgh" and o1["site_url"] == "https://config.example" and o1["distance_tolerance_pct"] == 7
            and o1["methods"] == ["bancontact"] and o1["company_email"] == "cfg@sirket.test", f"config.php degerleri (ortam yokken): {o1}")
    o2, p2 = php_json("echo json_encode(array_diff_key(cfg(true), ['_kaynak' => 1]));", www=www_c,
                      env={"MOLLIE_API_KEY": "test_FromEnv0123456789abcdefghijk", "SITE_URL": "https://env.example", "COMPANY_EMAIL": "env@sirket.test", "MAIL_FROM": "envfrom@sirket.test",
                           "BREVO_API_KEY": "env-brevo", "GOOGLE_SERVER_KEY": "env-google", "ADMIN_PASSWORD": "env-admin-pass-123", "ORDERS_DIR": "/tmp/x_env_orders",
                           "DISTANCE_TOLERANCE_PCT": "20", "TRUSTED_PROXY_HEADER": "X-Real-IP", "MOLLIE_API_BASE": "http://127.0.0.1:1/v2", "BREVO_API_BASE": "https://b.example/v3",
                           "GOOGLE_API_BASE": "http://127.0.0.1:2"})
    kontrol(o2 is not None and o2["mollie_api_key"] == "test_FromEnv0123456789abcdefghijk" and o2["site_url"] == "https://env.example" and o2["company_email"] == "env@sirket.test"
            and o2["mail_from"] == "envfrom@sirket.test" and o2["brevo_api_key"] == "env-brevo" and o2["google_server_key"] == "env-google" and o2["admin_password"] == "env-admin-pass-123"
            and o2["orders_dir"] == "/tmp/x_env_orders" and o2["distance_tolerance_pct"] == 20 and o2["trusted_proxy_header"] == "HTTP_X_REAL_IP"
            and o2["mollie_api_base"] == "http://127.0.0.1:1/v2" and o2["brevo_api_base"] == "https://b.example/v3" and o2["google_api_base"] == "http://127.0.0.1:2", f"ortam degiskenleri config.php'yi EZER: {o2}")
    # bos ortam degiskeni config.php degerini EZMEZ
    o3, _ = php_json("echo json_encode(cfg(true)['mollie_api_key']);", www=www_c, env={"MOLLIE_API_KEY": "   "})
    kontrol(o3 == "test_FromConfig0123456789abcdefgh", "bos/bosluk ortam degiskeni config.php'yi ezmez")
    # config.php yoksa bile calisir
    (www_c / "pay" / "config.php").unlink()
    o4, _ = php_json("echo json_encode([cfg(true)['mollie_api_key'], cfg()['site_url'], cfg()['mollie_api_base']]);", www=www_c, env={})
    kontrol(o4 == ["", "https://europetaxi24.be", "https://api.mollie.com/v2"], f"config.php yokken varsayilanlar: {o4}")


def senaryo_log_hijyeni():
    print("— 16. log hijyeni: kayit.log + sunucu ciktilarinda sir/kisisel veri/enjeksiyon/yol yok")
    for ad in ["A", "B", "C", "D", "E", "G", "H", "K", "S"]:
        klasor = siparis_dizini(ad) if ad in ("A", "B", "C", "D", "G", "H", "K", "S") else (TMP / "e" / "et-siparisler")
        if ad == "F":
            klasor = X.www_f / "pay" / "orders"
        log_yol = klasor / "kayit.log"
        log = log_yol.read_text(encoding="utf-8", errors="replace") if log_yol.exists() else ""
        for sir in SIRLAR:
            kontrol(sir not in log, f"[{ad}] kayit.log'da SIR var: {sir[:8]}...")
        for kv in KISISEL:
            kontrol(kv not in log, f"[{ad}] kayit.log'da KISISEL VERI var: {kv!r}")
        for isaret in ["[eposta]", "[sayi]", "[token]", "[anahtar]"]:
            kontrol(isaret not in log, f"[{ad}] kayit.log'da maskelenen icerik ({isaret}): kod PII/sir loglamaya calisiyor")
        satirlar = [l for l in log.splitlines() if l.strip()]
        kotu = [l for l in satirlar if not re.match(r"^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d  ", l)]
        kontrol(not kotu, f"[{ad}] kayit.log'da bicimsiz (enjeksiyon?) satir: {kotu[:2]}")
        kontrol(all(len(l) <= 330 for l in satirlar), f"[{ad}] log satiri 300 karakteri asmamali")
        kontrol("/tmp/" not in log and "/home/" not in log and "Stack trace" not in log, f"[{ad}] kayit.log'da yol/stack yok")
        srv = TMP / f"php_{ad}.log"
        if srv.exists():
            # ?pw= ile test amacli gonderilen URL'ler sunucunun kendi istek gunlugune duser (URL'de sifre tam da bu yuzden yasak)
            t_ = "\n".join(l for l in srv.read_text(encoding="utf-8", errors="replace").splitlines() if not re.search(r"pw(\[\])?=", l) and "Input variables exceeded" not in l)
            for sir in SIRLAR:
                kontrol(sir not in t_, f"[{ad}] sunucu ciktisinda SIR var")
            php_hatalari = re.findall(r"PHP (?:Warning|Notice|Deprecated|Fatal error|Parse error)[^\n]*", t_)
            kontrol(not php_hatalari or ad == "K", f"[{ad}] sunucu ciktisinda PHP uyarisi/hatasi var: {php_hatalari[:2]}")
    a = kayit_log("A")
    kontrol((not X.tam_kosu) or ("create: odeme olusturuldu ET-" in a and "webhook: ET-" in a), "loglarda siparis numarasi ve durum gorunur")


ORNEK_SIPARISLER = [
    {"no": "ET-260829-TEST01", "dil": "nl", "alis": "Gent", "varis": "Brussels Airport (Zaventem)", "km": 56, "km_istemci": 56, "km_sunucu": 56,
     "toplam": 121.44, "kapora": 24.29, "kalan": 97.15, "tarih": "2026-09-01", "saat": "06:30", "donus_tarih": "2026-09-08",
     "donus_saat": "18:00", "yolcu": 3, "buyuk": 2, "kucuk": 1, "arac": "wagon", "ad": "Jan Peeters", "eposta": "jan@voorbeeld.be",
     "telefon": "+32 470 11 22 33"},
    {"no": "ET-261001-ABC123", "dil": "en", "alis": 'Rue "de" la Loi 16 & <Bruxelles>', "varis": "Antwerp's Centraal", "km": 800, "km_istemci": 780, "km_sunucu": None,
     "toplam": 1602.0, "kapora": 320.4, "kalan": 1281.6, "tarih": "2026-10-15", "saat": "23:59", "donus_tarih": "", "donus_saat": "",
     "yolcu": 1, "buyuk": 0, "kucuk": 0, "arac": "eco", "ad": 'Jane "JJ" O\'Neil & Co <b>x</b>', "eposta": "jane@example.com", "telefon": "+44 20 7946 0958"},
    {"no": "ET-270101-ZZ9999", "dil": "tr", "alis": "Brüksel Havalimanı (Zaventem)", "varis": "Köln/Bonn Havalimanı (CGN)", "km": 230, "km_istemci": 230, "km_sunucu": 231,
     "toplam": 467.7, "kapora": 93.54, "kalan": 374.16, "tarih": "2027-01-01", "saat": "00:00", "donus_tarih": "2027-01-03", "donus_saat": "",
     "yolcu": 7, "buyuk": 6, "kucuk": 4, "arac": "vip", "ad": "Şükrü Öztürk", "eposta": "sukru@ornek.com.tr", "telefon": "+90 532 000 00 00"},
    {"no": "ET-260930-FR0001", "dil": "fr", "alis": "Bruxelles", "varis": "Paris Charles de Gaulle (CDG)", "km": 800, "km_istemci": 800, "km_sunucu": 800,
     "toplam": 1602.0, "kapora": 320.4, "kalan": 1281.6, "tarih": "2026-09-30", "saat": "12:00", "donus_tarih": "", "donus_saat": "",
     "yolcu": 4, "buyuk": 1, "kucuk": 2, "arac": "vip", "ad": "Élodie Dupont", "eposta": "elodie@exemple.fr", "telefon": "0032 493 83 98 98"},
]

EPOSTA_JS = r"""
const m = require(process.argv[1] + '/api/_lib/mail.js');
const liste = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(liste.map((s) => ({ html: m.musteriEpostaHtml(s), metin: m.sirketEpostaMetni(s) }))));
"""


def metin_normalize(s):
    return re.sub(r"\s+", " ", s).strip()


def senaryo_node_esdegerligi():
    print("— 17. Node <-> PHP esdegerlik: dil.php/dil.json, e-posta govdeleri, fiyat 1..800, mesafe.json")
    kontrol(NODE is not None, "node bulunamadi")
    if not NODE:
        return
    vout = vercel_out_uret()
    node_dil = json.loads((vout / "api" / "_lib" / "dil.json").read_text(encoding="utf-8"))
    php_dil = DIL_VERISI
    for d in DILLER:
        kontrol(set(php_dil[d]) <= set(node_dil["diller"][d]), f"[{d}] dil.json, dil.php anahtarlarini icermeli")
        fark = [k for k in php_dil[d] if node_dil["diller"][d].get(k) != php_dil[d][k]]
        kontrol(not fark, f"[{d}] dil.json ile dil.php degerleri esit: {fark[:5]}")
    # mesafe.json: Node'un l/t/kesin/sabitler alanlari PHP dosyasiyla ayni
    nj = json.loads((vout / "api" / "_lib" / "mesafe.json").read_text(encoding="utf-8"))
    pj = json.loads((X.www / "pay" / "mesafe.json").read_text(encoding="utf-8"))
    kontrol(nj["sabitler"] == pj["sabitler"] and nj["kesin"] == pj["kesin"] and list(nj["yerler"]) == list(pj["yerler"]) and all(nj["yerler"][k]["l"] == pj["yerler"][k]["l"] and nj["yerler"][k]["t"] == pj["yerler"][k]["t"] for k in nj["yerler"]),
            "PHP mesafe.json == Node mesafe.json (sabitler, kesin, l, t)")
    # e-posta govdeleri
    girdi = json.dumps(ORNEK_SIPARISLER, ensure_ascii=False)
    pn = subprocess.run([NODE, "-e", EPOSTA_JS, "--", str(vout)], input=girdi, capture_output=True, text=True)
    kontrol(pn.returncode == 0, "Node e-posta uretimi: " + pn.stderr[:300])
    o, p = php_json("$l = json_decode(file_get_contents('php://stdin'), true); $o = []; foreach ($l as $s) { $o[] = ['html' => musteri_eposta_html($s), 'metin' => sirket_eposta_metni($s)]; } echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);",
                    girdi=girdi)
    kontrol(o is not None, "PHP e-posta uretimi: " + p.stderr[:300])
    if pn.returncode == 0 and o is not None:
        nod = json.loads(pn.stdout)
        for i, s in enumerate(ORNEK_SIPARISLER):
            a, b = metin_normalize(nod[i]["html"]), metin_normalize(o[i]["html"])
            kontrol(a == b, f"[{s['dil']}] musteri e-postasi Node == PHP:\n  node: {a[:300]}\n  php : {b[:300]}")
            na = [l for l in nod[i]["metin"].split("\n") if not l.startswith("Mesafe")]
            pa = [l for l in o[i]["metin"].split("\n") if not l.startswith("Mesafe")]
            kontrol(na == pa, f"[{s['dil']}] is emri (Mesafe satiri haric) Node == PHP:\n{na}\n{pa}")
    # fiyat 1..800: PHP fiyat_hesapla == Node fiyat.js
    sweep = subprocess.run([NODE, "-e", "const f=require(process.argv[1]+'/api/_lib/fiyat.js');const o={};for(let k=1;k<=800;k++){const r=f.fiyatHesapla(k);o[k]=[r.toplamStr,r.kaporaStr,r.kalanStr];}console.log(JSON.stringify(o));", "--", str(vout)],
                           capture_output=True, text=True)
    of, pf = php_json("$o = []; for ($k = 1; $k <= 800; $k++) { [$t, $ka, $kl] = fiyat_hesapla($k); $o[$k] = [number_format($t, 2, '.', ''), number_format($ka, 2, '.', ''), number_format($kl, 2, '.', '')]; } echo json_encode($o);")
    if sweep.returncode == 0 and of is not None:
        nf = json.loads(sweep.stdout)
        fark = [k for k in nf if nf[k] != of[k]]
        kontrol(not fark, f"PHP ve Node fiyati 1..800 km icin AYNI (farkli: {fark[:10]})")
    else:
        kontrol(False, "fiyat taramasi calismadi")


# ================================================================ "mevcut strings.json" yedek anahtar davranisi
def senaryo_mevcut_yedek():
    print("— 18. strings.json YENI anahtarlar olmadan (mevcut): PHP yedek anahtarlara duser, ham anahtar adi GORUNMEZ")
    repo, www = www_uret("mevcut", onerilen=False)
    # yeni anahtarlar artik strings.json'da; eski dil.php'yi (bu anahtarlar olmadan) taklit et
    dil = dil_verisi_yukle(www)
    for d_ in DILLER:
        for k_ in ("err_km_wa", "err_rate", "err_forbidden", "err_bad_request", "val_cancel"):
            dil[d_].pop(k_, None)
    (www / "pay" / "dil.php").write_text("<?php\nreturn json_decode(<<<'VERI'\n" + json.dumps(dil, ensure_ascii=False) + "\nVERI, true);\n", encoding="utf-8")
    dil = dil_verisi_yukle(www)
    kontrol("err_km_wa" not in dil["fr"] and "err_rate" not in dil["fr"] and "val_cancel" not in dil["fr"], "on kosul: mevcut dil.php yeni anahtarlari icermez")
    od = TMP / "siparisler_M"
    od.mkdir(exist_ok=True)
    M = PORTLAR["M"]
    php_sunucu("M", www, dict(MOLLIE_API_KEY=MOLLIE_ANAHTAR, MOLLIE_API_BASE=f"http://127.0.0.1:{PORTLAR['mock']}/v2", BREVO_API_BASE=f"http://127.0.0.1:{PORTLAR['mock']}/v3",
                              COMPANY_EMAIL=SIRKET_EPOSTA, MAIL_FROM=GONDEREN, TRUSTED_PROXY_HEADER="HTTP_X_FORWARDED_FOR", ORDERS_DIR=str(od), SITE_URL=f"http://127.0.0.1:{M}"))

    def h_(dil_, anahtar):
        return h_php(dil[dil_][anahtar])
    y = istek("M", "POST", "/pay/create.php", form(dil="fr", alis="Xyz Straat 1", km="30"))
    kontrol(y.kod == 422 and h_("fr", "err_km") in y.metin and "err_km_wa" not in y.metin, f"err_km_wa yoksa err_km ({y.kod})")
    y = istek("M", "POST", "/pay/create.php", form(dil="nl", iptal="0"))
    kontrol(y.kod == 422 and h_("nl", "err_pay") in y.metin and "val_cancel" not in y.metin, f"val_cancel yoksa err_pay yedegi ({y.kod})")
    y = istek("M", "POST", "/pay/create.php", form(dil="en"), origin="https://evil.example")
    kontrol(y.kod == 403 and h_("en", "err_pay") in y.metin and "err_forbidden" not in y.metin, "err_forbidden yoksa err_pay")
    y = istek("M", "POST", "/pay/create.php", ham="a=" + "x" * 70000)
    kontrol(y.kod == 413 and h_("fr", "err_pay") in y.metin and "err_bad_request" not in y.metin, "err_bad_request yoksa err_pay")
    ip = "10.99.0.1"
    kodlar = [istek("M", "POST", "/pay/create.php", form(dil="tr", eposta="gecersiz"), ip=ip).kod for _ in range(6)]
    y = istek("M", "POST", "/pay/create.php", form(dil="tr", eposta="gecersiz"), ip=ip)
    kontrol(kodlar == [422] * 5 + [429] and h_("tr", "err_pay") in y.metin and "err_rate" not in y.metin, f"err_rate yoksa err_pay ({kodlar})")
    s = siparis_olustur("M")
    kontrol(s is not None, "mevcut strings ile mutlu yol da calisir")


# ================================================================ senaryo kaydi
def senaryolar_tablosu():
    return {
        "statik": (senaryo_statik, []),
        "vektorler": (senaryo_vektorler, []),
        "birim_girdi": (senaryo_birim_girdi, []),
        "birim_guvenlik": (senaryo_birim_guvenlik, []),
        "birim_depo": (senaryo_birim_depo, []),
        "birim_dis": (senaryo_birim_dis_servis, ["yak"]),
        "temizle": (senaryo_temizle, []),
        "mutlu_yol": (senaryo_mutlu_yol, ["A"]),
        "paid": (senaryo_paid, ["A"]),
        "eposta_hatalari": (senaryo_eposta_hatalari, ["A", "D"]),
        "es_zamanli": (senaryo_es_zamanli, ["A"]),
        "success": (senaryo_success, ["A"]),
        "fiyat_km": (senaryo_fiyat_km, ["A"]),
        "google": (senaryo_google, ["B", "G"]),
        "dogrulama": (senaryo_dogrulama, ["A"]),
        "koruma": (senaryo_koruma, ["A", "C"]),
        "webhook_koruma": (senaryo_webhook_koruma, ["A"]),
        "orders": (senaryo_orders, ["A", "C", "D"]),
        "test_ucu": (senaryo_test_ucu, ["A", "B", "C", "D", "G", "S"]),
        "depo": (senaryo_depo, ["E", "F", "H"]),
        "yapilandirma": (senaryo_yapilandirma, ["G"]),
        "basliklar_hatalar": (senaryo_basliklar_hatalar, ["K"]),
        "log_hijyeni": (senaryo_log_hijyeni, []),
        "node_esdegerligi": (senaryo_node_esdegerligi, []),
    }


SIRA = ["statik", "vektorler", "birim_girdi", "birim_guvenlik", "birim_depo", "birim_dis", "temizle", "mutlu_yol", "paid", "eposta_hatalari", "es_zamanli", "success",
        "fiyat_km", "google", "dogrulama", "koruma", "webhook_koruma", "orders", "test_ucu", "depo", "yapilandirma", "basliklar_hatalar", "log_hijyeni", "node_esdegerligi"]


def calistir(ad, fonksiyon):
    global hatalar
    onceki = len(hatalar)
    t0 = time.time()
    try:
        fonksiyon()
    except SystemExit:
        raise
    except Exception:
        kontrol(False, f"{ad}: ISTISNA:\n" + traceback.format_exc())
    SURELER[ad] = time.time() - t0
    return len(hatalar) - onceki


SURELER = {}


def ortam_hazirla(gruplar):
    """Gerekli sunuculari baslatir (gruplar: {'A','B',...,'yak'})."""
    sunucu_gruplari = [g for g in ("A", "B", "C", "D", "G", "S", "E", "F", "H", "K") if g in gruplar]
    if sunucu_gruplari:
        sunuculari_baslat(X.www, tuple(sunucu_gruplari))
    else:
        sendmail_hazirla()


def portlari_ata():
    global PORT0, PORTLAR
    PORT0 = port_tabani(20)
    isimler = ["mock", "A", "B", "C", "D", "G", "S", "E", "F", "H", "K", "yak1", "yak2", "M"]
    PORTLAR = {ad: PORT0 + i for i, ad in enumerate(isimler)}
    kontrol(all(port_bos_mu(p) for p in PORTLAR.values()), "ayrilan portlar dolu")


def sonuc_yaz():
    print()
    if hatalar:
        print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
        for x in hatalar:
            print("   -", x)
        return 1
    print(f"✓ Tum kontroller gecti ({gecen} kontrol)")
    return 0


def mutant_modu(a):
    """Tek bir (mutasyonlu ya da kontrol) www kopyasi uzerinde secili senaryolari kosar; cikti son satir JSON."""
    global X, DIL_VERISI
    portlari_ata()
    X = Ortam("mutant", a.mutant_www, a.repo)
    X.vout = Path(a.vout) if a.vout else None
    X.tam_kosu = False
    DIL_VERISI = dil_verisi_yukle(X.www)
    tablo = senaryolar_tablosu()
    adlar = a.senaryolar.split(",")
    gruplar = set()
    for ad in adlar:
        gruplar |= set(tablo[ad][1])
    try:
        ortam_hazirla(gruplar)
        if "yak" in gruplar:
            pass
        for ad in adlar:
            calistir(ad, tablo[ad][0])
    finally:
        surecleri_kapat()
    print("MUTANT_SONUC " + json.dumps({"hata": len(hatalar), "gecen": gecen, "ornek": hatalar[:3]}, ensure_ascii=False))
    return 1 if hatalar else 0


# ================================================================ MUTASYON KANITI
def M(id_, aciklama, dosya, eski, yeni, senaryolar, say=1):
    return dict(id=id_, aciklama=aciklama, dosya=dosya, eski=eski, yeni=yeni, senaryolar=senaryolar, say=say)


def mutasyon_listesi():
    return [
        M("km_fail_open", "km politikasi: dogrulanamayan km ISTEMCIDEN kabul (FAIL-OPEN)", "mesafe.php",
          "        return ['km' => null, 'kaynak' => null, 'sebep' => 'dogrulanamadi'];", "        $km = $istemci;\n        $kaynak = 'istemci';", ["vektorler", "fiyat_km"]),
        M("google_boru", "Google: '|' korumasi kaldirildi (mesafe.php)", "mesafe.php", "preg_match('/[\\x00-\\x1F\\x7F|]/', $adres)", "preg_match('/[\\x00-\\x1F\\x7F]/', $adres)", ["birim_dis"]),
        M("girdi_boru", "girdi kurali: '|' yasagi kaldirildi (girdi.php)", "girdi.php", "if (girdi_uzunluk($alis) > 120 || str_contains($alis, '|')) {", "if (girdi_uzunluk($alis) > 120) {", ["birim_girdi", "google"]),
        M("flock_yok", "siparis_guncelle: flock(LOCK_EX) kaldirildi", "depo.php", "if (!flock($k, LOCK_EX)) {", "if (false) {", ["birim_depo", "es_zamanli"]),
        M("bayrak_musteri", "alici bayragi: musteri bayragi yazilmiyor (kismi basarida musteri TEKRAR)", "webhook.php", "        $s['eposta_musteri'] = true;\n", "", ["eposta_hatalari"]),
        M("tek_bayrak", "e-posta hatasinda bile 'gonderildi' isaretlenir", "webhook.php", "        if (!$r['ok']) {\n            kayit('hata: webhook: sirket e-postasi", "        if (false) {\n            kayit('hata: webhook: sirket e-postasi", ["eposta_hatalari"]),
        M("pencere_48", "paidAt 48 saat kurali kaldirildi", "depo.php", "const EPOSTA_PENCERE_SN = 48 * 3600;", "const EPOSTA_PENCERE_SN = 48 * 3600 * 1000;", ["paid"]),
        M("iade_yok", "iade durumu ele alinmiyor", "depo.php", "($iade > 0 ? 'iade' : 'odendi')", "'odendi'", ["birim_depo", "paid"]),
        M("tutar_kontrol_yok", "odenen tutar dogrulamasi kaldirildi", "depo.php", "$tutarOk = (string) ($tutar['currency'] ?? '') === 'EUR' && (string) ($tutar['value'] ?? '') === kapora_metni($s);", "$tutarOk = true;", ["birim_depo", "webhook_koruma"]),
        M("mollie_id_eslesme_yok", "webhook: mollie_id eslesmesi kaldirildi", "webhook.php", " || ($siparis['mollie_id'] ?? null) !== $odemeId", "", ["webhook_koruma"]),
        M("create_oran_yok", "create: oran siniri kaldirildi", "create.php", "if (!$oran['izin']) {", "if (false) {", ["koruma"]),
        M("webhook_oran_yok", "webhook: oran siniri kaldirildi", "webhook.php", "if (!$oran['izin']) {", "if (false) {", ["koruma"]),
        M("lockout_yok", "yonetici girisi: 15 dk kilit devre disi (5 -> 500 deneme)", "guvenlik.php", "const KILIT_DENEME = 5;", "const KILIT_DENEME = 500;", ["birim_guvenlik", "orders"]),
        M("cerez_samesite", "oturum cerezi SameSite=Lax", "guvenlik.php", "        'samesite' => 'Strict',\n    ]);\n    session_start();", "        'samesite' => 'Lax',\n    ]);\n    session_start();", ["orders"]),
        M("cerez_httponly", "oturum cerezi HttpOnly degil", "guvenlik.php", "        'httponly' => true,\n        'samesite' => 'Strict',\n    ]);\n    session_start();", "        'httponly' => false,\n        'samesite' => 'Strict',\n    ]);\n    session_start();", ["orders"]),
        M("pw_get", "test.php: ?pw= URL parametresi kabul", "test.php", "    $pw = girdi_ilk($form, 'pw');", "    $pw = $_GET['pw'] ?? girdi_ilk($form, 'pw');", ["test_ucu"]),
        M("kayit_saniti_yok", "kayit(): CR/LF/kontrol karakteri temizligi kaldirildi", "ortak.php", "$m = preg_replace('/[\\x00-\\x1F\\x7F]+/', ' ', $mesaj) ?? '';", "$m = $mesaj;", ["birim_guvenlik"]),
        M("izin_0644", "siparis dosyalari 0644", "depo.php", "    @chmod($gecici, 0600);", "    @chmod($gecici, 0644);", ["mutlu_yol", "temizle"]),
        M("sleep_geri", "orders: sleep(1) kaba kuvvet yavaslatma geri geldi", "orders.php", "        $sonKilit = kaba_kuvvet_basarisiz($ip);", "        sleep(1);\n        $sonKilit = kaba_kuvvet_basarisiz($ip);", ["statik", "orders"]),
        M("iptal_zorunlu_degil", "iptal onayi sunucuda zorunlu degil", "create.php", "if (girdi_ilk($form, 'iptal') !== '1') {", "if (false) {", ["mutlu_yol"]),
        M("honeypot_yok", "bal-kupu (honeypot) kaldirildi", "create.php", "if ($bal !== null && trim($bal) !== '') {", "if (false) {", ["koruma"]),
        M("origin_yok", "Origin/Referer denetimi hep izinli", "guvenlik.php", "function kaynak_izinli(): bool\n{\n", "function kaynak_izinli(): bool\n{\n    return true;\n", ["birim_guvenlik", "koruma"]),
        M("paid_ezilir", "paid durumu baska duruma EZILIR", "depo.php", "        if (in_array($eski, DURUM_ODENMIS, true)) {\n            return $s;\n        }\n", "", ["birim_depo", "paid"]),
        M("mollie_hata_200", "webhook: Mollie sorgusu basarisizsa 200 (Mollie tekrar denemez)", "webhook.php", "webhook_yanit(500, 'mollie ulasilamadi');", "webhook_yanit(200, 'mollie ulasilamadi');", ["eposta_hatalari"]),
        M("eposta_hata_200", "webhook: e-posta hatasinda 200", "webhook.php", "$sonuc = [500, 'eposta hatasi'];", "$sonuc = [200, 'eposta hatasi'];", ["eposta_hatalari"], say=2),
        M("htaccess_acik", "pay/.htaccess: varsayilan yasak kaldirildi", ".htaccess", "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>", "<IfModule mod_authz_core.c>\n  Require all granted\n</IfModule>", ["statik"]),
        M("orders_dir_web_ici", "varsayilan siparis klasoru web KOKUNUN ICINDE", "depo.php", "[dirname(__DIR__, 2) . '/et-siparisler', false]", "[__DIR__ . '/orders', false]", ["depo"]),
        M("kaydet_hatasi_yutuldu", "siparis_kaydet basarisizsa odemeye DEVAM", "create.php", "if (!siparis_kaydet($siparis)) {", "if (false) {", ["depo"]),
        M("unicode_tablo_bozuk", "intl'siz normalize tablosu bozuk", "unicode_tablo.php", "\"\\u{E0}\" => 'a',", "\"\\u{E0}\" => 'x',", ["vektorler"]),
        M("xss_rozet", "orders: durum rozeti kacislanmiyor", "orders.php", "padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;white-space:nowrap\">' . h($ad) . '</span>';", "padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;white-space:nowrap\">' . $ad . '</span>';", ["orders"]),
        M("hata_isleyici_yok", "genel hata isleyici kaldirildi (display_errors=1 ile yol sizar)", "guvenlik.php", "    set_exception_handler('et_istisna_isleyici');\n", "", ["basliklar_hatalar"]),
        M("success_pending_yok", "success: beklemede durumu 'basarisiz' sayfasi gosterir", "success.php", "} elseif ($durum === 'beklemede') {", "} elseif (false) {", ["success"]),
        M("csrf_gevsek", "CSRF belirteci dogrulamasi hep dogru", "guvenlik.php", "    return is_string($gelen) && is_string($b) && $b !== '' && hash_equals($b, $gelen);", "    return true;", ["birim_guvenlik", "orders"]),
        M("fixation", "girisde oturum kimligi yenilenmiyor", "guvenlik.php", "    session_regenerate_id(true);\n", "", ["orders"]),
        M("proxy_yok", "trusted_proxy_header yok sayiliyor (IP hep REMOTE_ADDR)", "guvenlik.php", "    if ($baslik !== '') {\n        $ham = $_SERVER[$baslik] ?? '';", "    if (false) {\n        $ham = $_SERVER[$baslik] ?? '';", ["birim_guvenlik", "koruma"]),
        M("idem_yok", "Mollie Idempotency-Key gonderilmiyor", "create.php", "], ['idempotency' => $idem !== '' ? $idem : 'et-' . $no]);", "]);", ["mutlu_yol"]),
        M("reply_to_yok", "Reply-To gonderilmiyor (Brevo + mail())", "mailer.php", "        if ($yanitAdresi !== null) {\n            $govde['replyTo'] = ['email' => $yanitAdresi];\n        }\n", "", ["birim_dis"]),
        M("alici_dogrulama_yok", "mail(): alici dogrulamasi kaldirildi (baslik enjeksiyonu)", "mailer.php", "    if (!girdi_eposta_gecerli($kime)) {", "    if (false) {", ["birim_dis"]),
        M("is_emri_enjeksiyon", "is emri: CR/LF tek satira indirilmiyor", "mailer.php", "    return girdi_temiz_metin(is_scalar($deger) ? (string) $deger : '');", "    return is_scalar($deger) ? (string) $deger : '';", ["dogrulama"]),
        M("anonim_yok", "temizle: kisisel alanlar anonimlestirilmiyor", "temizle.php", "                        $x['eposta'] = '';\n", "", ["temizle"]),
        M("temizle_30_gun", "temizle: 30 gun yerine 300 gun", "temizle.php", "const TEMIZLE_ODENMEMIS_GUN = 30;", "const TEMIZLE_ODENMEMIS_GUN = 300;", ["temizle"]),
        M("dry_run_siler", "temizle: dry-run gercekten siliyor", "temizle.php", "                if (!$kuru) {\n                    siparis_sil($no);\n                }\n            }\n        } elseif", "                siparis_sil($no);\n            }\n        } elseif", ["temizle"]),
        M("sunucu_taban_yok", "*_api_base dogrulamasi kaldirildi (evil taban kabul)", "ortak.php", "    if (!($https || $yerel) || preg_match('/[\\x00-\\x20\\x7F]/', $ham) === 1) {\n        return null;\n    }", "    if (preg_match('/[\\x00-\\x20\\x7F]/', $ham) === 1) {\n        return null;\n    }", ["yapilandirma", "birim_guvenlik"]),
        M("iade_yapisik_yok", "iade/chargeback/uyusmazlik yapisik degil (eski 'paid' yaniti iadeyi odendi'ye cevirir)", "depo.php", "            $yeni['durum'] = $eski;\n", "", ["birim_depo"]),
        M("tasima_yok", "eski pay/orders/ siparisleri web disi klasore tasinmiyor", "depo.php", "                depo_eski_siparisleri_tasi($yol);", "", ["depo"]),
        M("web_disi_hep_dogru", "depo_web_disi_mi hep 'disinda' der (KIRMIZI uyari kaybolur)", "depo.php", "        if ($g === $k || str_starts_with($g . '/', rtrim($k, '/') . '/')) {\n            return false;", "        if ($g === $k || str_starts_with($g . '/', rtrim($k, '/') . '/')) {\n            return true;", ["depo"]),
        M("log_90_gun", "temizle: kayit.log 90 gun yerine 900 gun", "temizle.php", "const TEMIZLE_LOG_GUN = 90;", "const TEMIZLE_LOG_GUN = 900;", ["temizle"]),
        M("anonim_12_ay", "temizle: anonimlestirme 12 ay yerine 120 ay", "temizle.php", "const TEMIZLE_ANONIM_AY = 12;", "const TEMIZLE_ANONIM_AY = 120;", ["temizle"]),
        M("muhasebe_7_yil", "temizle: muhasebe silme 7 yil yerine 70 yil", "temizle.php", "const TEMIZLE_MUHASEBE_YIL = 7;", "const TEMIZLE_MUHASEBE_YIL = 70;", ["temizle"]),
        M("iade_tahsilat", "panel iade/uyusmazligi tahsilata sayiyor", "orders.php", "    if ($d === 'odendi') {\n        $odendiSayi++;", "    if ($d === 'odendi' || $d === 'iade') {\n        $odendiSayi++;", ["orders"]),
    ]


def mutasyon_kaniti(repo, vout):
    print("— 19. MUTASYON KANITI: bilerek bozulmus kopyalar (paket KIRMIZI olmali) + canli kopya kontrolu (YESIL)")
    listesi = mutasyon_listesi()
    kontrol(len(listesi) >= 20, f"en az 20 mutasyon gerekli ({len(listesi)})")
    kontrol_cache = {}
    sonuclar = []
    tsc = Path(__file__).resolve()

    def kos(www, senaryolar):
        komut = [sys.executable, str(tsc), "--mutant-www", str(www), "--senaryolar", ",".join(senaryolar), "--repo", str(repo), "--vout", str(vout)]
        p = subprocess.run(komut, capture_output=True, text=True, timeout=900)
        m = re.search(r"MUTANT_SONUC (\{.*\})", p.stdout)
        return p.returncode, (json.loads(m.group(1)) if m else {"hata": -1, "ornek": [p.stdout[-300:], p.stderr[-300:]]})
    for mt in listesi:
        yol_www = TMP / "mut" / mt["id"] / "www"
        shutil.rmtree(yol_www.parent, ignore_errors=True)
        shutil.copytree(X.www, yol_www)
        hedef = yol_www / "pay" / mt["dosya"]
        metin = hedef.read_text(encoding="utf-8")
        if mt["eski"] not in metin:
            kontrol(False, f"mutasyon {mt['id']}: '{mt['eski'][:60]}' {mt['dosya']} icinde bulunamadi (test guncellenmeli)")
            continue
        hedef.write_text(metin.replace(mt["eski"], mt["yeni"], mt["say"] if mt["say"] > 0 else -1), encoding="utf-8")
        p = subprocess.run([PHP, "-l", str(hedef)], capture_output=True, text=True) if hedef.suffix == ".php" else None
        kontrol(p is None or p.returncode == 0, f"mutasyon {mt['id']}: mutant PHP sozdizimi gecerli olmali: {(p.stdout + p.stderr)[:200] if p else ''}")
        anahtar = ",".join(mt["senaryolar"])
        if anahtar not in kontrol_cache:
            rc, sonuc = kos(X.www, mt["senaryolar"])
            kontrol_cache[anahtar] = (rc, sonuc)
        rc_k, s_k = kontrol_cache[anahtar]
        kontrol(rc_k == 0 and s_k["hata"] == 0, f"KONTROL: canli kopya '{anahtar}' senaryolarinda YESIL olmali: {s_k}")
        rc, s = kos(yol_www, mt["senaryolar"])
        kirmizi = rc != 0 and s["hata"] != 0
        kontrol(kirmizi, f"MUTASYON '{mt['id']}' ({mt['aciklama']}) YAKALANMADI: senaryolar {anahtar} yesil kaldi ({s})")
        sonuclar.append((mt["id"], mt["aciklama"], kirmizi, s["hata"]))
        print(f"   {'KIRMIZI' if kirmizi else 'YESIL!!'}  {mt['id']:24s} {s['hata']:3d} hata  <- {mt['aciklama']}")
        shutil.rmtree(yol_www.parent, ignore_errors=True)
    print(f"   {sum(1 for x in sonuclar if x[2])}/{len(listesi)} mutasyon yakalandi; canli kopya kontrolleri: {len(kontrol_cache)} senaryo kumesi YESIL")


def main():
    global X, DIL_VERISI
    ap = argparse.ArgumentParser()
    ap.add_argument("--mutasyonsuz", action="store_true")
    ap.add_argument("--mutant-www")
    ap.add_argument("--senaryolar")
    ap.add_argument("--repo")
    ap.add_argument("--vout")
    ap.add_argument("--yalniz", help="virgulle ayrilmis senaryo adlari (gelistirme icin)")
    a = ap.parse_args()
    kontrol(shutil.which("php") is not None, "php CLI bulunamadi")
    if a.mutant_www:
        rc = mutant_modu(a)
        if not os.environ.get("ET_TEST_TMP_KORU"):
            shutil.rmtree(TMP, ignore_errors=True)
        sys.exit(rc)
    portlari_ata()
    try:
        repo, www = www_uret("onerilen", onerilen=True)
        X = Ortam("onerilen", www, repo)
        X.tam_kosu = a.yalniz is None
        DIL_VERISI = dil_verisi_yukle(www)
        tablo = senaryolar_tablosu()
        adlar = a.yalniz.split(",") if a.yalniz else SIRA
        gruplar = set()
        for ad in adlar:
            gruplar |= set(tablo[ad][1])
        ortam_hazirla(gruplar)
        for ad in adlar:
            calistir(ad, tablo[ad][0])
        if a.yalniz is None:
            php_sunucu_M_once = None
            calistir("mevcut_yedek", senaryo_mevcut_yedek)
        vout = X.vout
        surecleri_kapat()
        if a.yalniz is None and not a.mutasyonsuz:
            calistir("mutasyon", lambda: mutasyon_kaniti(repo, vout or vercel_out_uret()))
    finally:
        surecleri_kapat()
        if not os.environ.get("ET_TEST_TMP_KORU"):
            shutil.rmtree(TMP, ignore_errors=True)
    print("\n— senaryo sureleri: " + ", ".join(f"{k}={v:.1f}s" for k, v in SURELER.items()))
    sys.exit(sonuc_yaz())


if __name__ == "__main__":
    main()
