# -*- coding: utf-8 -*-
"""
VERCEL ODEME KATMANI TESTLERI — kaynak/vercel (Node.js serverless) + sahte dis servisler
Calistirma:  python3 kaynak/testler/test_vercel_api.py   (repo'daki www/ KULLANILMAZ: test kendi gecici repo kopyasinda build.py calistirir)
Gereksinim: node (>=20), php CLI (PHP ile karsilastirma testleri), Python 3.9+. Ag disi; npm/pip YOK.
Cikis kodu 0 = hepsi gecti.

Ne yapar:
  0. Repoyu gecici dizine kopyalar ve orada build.py calistirir (gercek www/ ve vercel-out/ DEGISMEZ).
  1. vercel_build.py'yi gecici bir dizine calistirir (vercel-out'a DOKUNMAZ).
  2. kaynak/testler/mock_dis_servisler.py'yi (sahte MOLLIE + BREVO + GOOGLE) baslatir.
  3. kaynak/vercel/dev-server.js ile (yalniz Node http) birkac ortam varyantinda fonksiyonlari calistirir.
  4. Senaryolari kosar (odeme, webhook, success, orders, test ucu, fiyat tahrifati, Google, dogrulama, koruma...).
  5. paylasilan-vektorler.json'u Node'a, Python referansina ve PHP'ye karsi dogrular.
Portlar 9500-9599: bos bir 7li aralik otomatik secilir; ET_TEST_PORT ile taban verilebilir.
"""
import hashlib
import hmac as hmac_mod
import http.client
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import unicodedata
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

KOK = Path(__file__).resolve().parent.parent.parent
KAYNAK = KOK / "kaynak"
WWW = None            # gecici repo kopyasindaki www/ (www_uret doldurur); gercek www/ KULLANILMAZ
GECICI_REPO = None
TESTLER = KAYNAK / "testler"
VEKTOR_DOSYASI = TESTLER / "paylasilan-vektorler.json"

hatalar = []
gecen = 0


def kontrol(kosul, mesaj):
    """Basit assert: kosul yanlissa hatayi listeye ekler, testi durdurmaz."""
    global gecen
    if kosul:
        gecen += 1
    else:
        hatalar.append(mesaj)


def port_bos_mu(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def port_tabani():
    """ET_TEST_PORT verilmisse onu, yoksa 9500-9599 icinde 7 ardisik bos port bulunan ilk tabani kullanir."""
    ham = os.environ.get("ET_TEST_PORT")
    if ham:
        return int(ham)
    for taban in range(9500, 9593, 10):
        if all(port_bos_mu(taban + i) for i in range(7)):
            return taban
    sys.exit("HATA: 9500-9599 araliginda 7 ardisik bos port bulunamadi (ET_TEST_PORT ile taban verin)")


# ================================================================ sabitler
PORT0 = port_tabani()
MOCK = PORT0
PORT = {"A": PORT0 + 1, "B": PORT0 + 2, "C": PORT0 + 3, "D": PORT0 + 4, "E": PORT0 + 5}

MOLLIE_ANAHTAR = "test_SirMollieAnahtari0123456789abcd"
BREVO_ANAHTAR = "xkeysib-SirBrevoAnahtari0123456789ab"
GOOGLE_ANAHTAR = "AIzaSirGoogleAnahtari0123456789"
ADMIN_SIFRE = "Yonetici-Sifresi-Test!42"
IMZA_SIRRI = "imza-sirri-0123456789abcdef-test"
SIRKET_EPOSTA = "is-emri@sirket.test"
GONDEREN = "noreply@sirket.test"
SIRLAR = [MOLLIE_ANAHTAR, BREVO_ANAHTAR, GOOGLE_ANAHTAR, ADMIN_SIFRE, IMZA_SIRRI]

# Loglarda ASLA gorunmemesi gereken kisisel veri belirteçleri (testlerde kullanilan benzersiz degerler)
KISISEL = ["jan@voorbeeld.be", "470 11 22 33", "Korenmarkt", "Jan Peeters", "+32 470"]

DILLER = ["fr", "nl", "en", "tr"]
TMP = Path(tempfile.mkdtemp(prefix="et_vercel_test_"))
CIKTI = TMP / "vercel-out"
SUREKLI = []          # baslatilan surecler
API_YANITLARI = []    # (sunucu, yontem, yol, Yanit) — baslik denetimi icin


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
        """Set-Cookie satirlarindan `ad` cerezinin tam satirini doner."""
        for v in self.basliklar_hepsi("set-cookie"):
            if v.startswith(ad + "="):
                return v
        return None


_ip_sayac = [0]


def yeni_ip():
    _ip_sayac[0] += 1
    n = _ip_sayac[0]
    return f"10.77.{(n // 250) % 250}.{n % 250 + 1}"


def istek(port, yontem, yol, veri=None, *, ham=None, baslik=None, ip="auto", origin="auto",
          cerez=None, tip="auto", zaman_asimi=40):
    """HTTP istegi (yonlendirme takip EDILMEZ). veri: dict (liste degerler tekrar eden alan) -> urlencoded."""
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
    if port in PORT.values():
        API_YANITLARI.append((port, yontem, yol.split("?")[0], y))
    return y


def mock(yontem, yol, veri=None):
    """Mock kontrol/okuma cagrisi (JSON doner)."""
    c = http.client.HTTPConnection("127.0.0.1", MOCK, timeout=60)
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
    """Mock'a dogrudan Mollie API istegi. Doner: (kod, json)."""
    b = {"Content-Type": "application/json"}
    if anahtar:
        b["Authorization"] = anahtar
    b.update(baslik or {})
    c = http.client.HTTPConnection("127.0.0.1", MOCK, timeout=30)
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


LOGLAR = {}


def surec_baslat(ad, komut, env):
    log = open(TMP / f"{ad}.log", "wb")
    p = subprocess.Popen(komut, env=env, stdout=log, stderr=subprocess.STDOUT, cwd=str(TMP))
    SUREKLI.append((p, log))
    LOGLAR[ad] = TMP / f"{ad}.log"
    return p


def sunucu_baslat(ad, env_ek):
    port = PORT[ad]
    env = temiz_ortam(**env_ek)
    surec_baslat("sunucu_" + ad, ["node", str(KAYNAK / "vercel" / "dev-server.js"), "--dir", str(CIKTI), "--port", str(port)], env)
    kontrol(bekle_port(port), f"dev-server {ad} (port {port}) baslamadi: " + (TMP / f"sunucu_{ad}.log").read_text(errors="replace")[:300])


def log_oku(ad):
    return (TMP / f"sunucu_{ad}.log").read_text(encoding="utf-8", errors="replace")


# ================================================================ veri / bicim yardimcilari
DIL_VERISI = None          # CIKTI'dan yuklenir


def t(dil, anahtar, **degerler):
    s = DIL_VERISI["diller"][dil][anahtar]
    for k, v in degerler.items():
        s = s.replace("{" + k + "}", str(v))
    return s


def th(dil, anahtar, **degerler):
    """Sayfa govdesinde aranacak metin: PHP h() ile kacislanmis ceviri."""
    return h_php(t(dil, anahtar, **degerler))


def h_php(s):
    """PHP htmlspecialchars(ENT_QUOTES) ile ayni kacis."""
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#039;"))


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


class Sip:
    def __init__(self, yanit, odeme):
        self.yanit = yanit
        self.odeme = odeme
        self.id = odeme["id"]
        self.no = odeme["metadata"]["n"]
        self.meta = odeme["metadata"]
        self.cerez = yanit.cerez("et_p")

    def cerez_basligi(self):
        return self.cerez.split(";")[0] if self.cerez else None


def siparis_olustur(port="A", **ek):
    """Basarili create -> Sip. Basarisizsa None (yanit son_yanit'ta)."""
    p = PORT[port]
    y = istek(p, "POST", "/pay/create.php", form(**ek))
    siparis_olustur.son = y
    if y.kod != 303:
        return None
    m = re.search(r"/checkout/(tr_[A-Za-z0-9]+)$", y.baslik("location") or "")
    if not m:
        return None
    return Sip(y, mollie_ham("GET", "payments/" + m.group(1))[1])


def yanit_h1(y):
    m = re.search(r"<h1>(.*?)</h1>", y.metin, re.S)
    return m.group(1) if m else ""


def metin_normalize(s):
    return re.sub(r"\s+", " ", s).strip()


# ================================================================ Node yardimci betikleri
HARNESS_JS = r"""
'use strict';
// Paylasilan vektorleri Node katmanina karsi kosar. argv[2] = vercel cikti dizini; stdin = vektor JSON.
const dizin = process.argv[1];
const V = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const L = (p) => require(dizin + '/api/_lib/' + p);
const fiyat = L('fiyat.js');
const mesafe = L('mesafe.js');
const sip = L('siparis.js');
const hatalar = [];
let say = 0;
const k = (c, m) => { say++; if (!c) hatalar.push(m); };
const j = (x) => JSON.stringify(x);

for (const f of V.fiyat) {
  const r = fiyat.fiyatHesapla(f.km);
  k(r.toplam === f.toplam && r.kapora === f.kapora && r.kalan === f.kalan,
    'fiyat km=' + f.km + ': beklenen ' + j([f.toplam, f.kapora, f.kalan]) + ' bulunan ' + j([r.toplam, r.kapora, r.kalan]));
}
for (const c of V.km_karar) {
  const r = mesafe.kmKarar(c.istemci, c.google, c.dahili, c.tol);
  const b = r === null ? 'RET' : r;
  k(b === c.beklenen, 'km_karar ' + j([c.istemci, c.google, c.dahili, c.tol]) + ': beklenen ' + c.beklenen + ' bulunan ' + b);
}
for (const c of V.yer_bul) {
  const r = mesafe.yerBul(c.girdi);
  k(r === c.beklenen, 'yer_bul ' + j(c.girdi) + ': beklenen ' + c.beklenen + ' bulunan ' + r);
}
for (const c of V.dahili_mesafe) {
  const r = mesafe.dahiliMesafe(c.a, c.b);
  k(r === c.km, 'dahili_mesafe ' + j([c.a, c.b]) + ': beklenen ' + c.km + ' bulunan ' + r);
}

for (const c of V.iptal || []) {
  const r = sip.iptalOnayli(c.deger === null ? undefined : c.deger);
  k(r === c.gecerli, 'iptal ' + j(c.deger) + ': beklenen ' + c.gecerli + ' bulunan ' + r);
}
for (const c of V.idem || []) {
  const r = sip.idemAyikla(c.deger === null ? undefined : c.deger);
  k(r === c.beklenen, 'idem ' + j(c.deger) + ': beklenen ' + j(c.beklenen) + ' bulunan ' + j(r));
}
for (const c of V.idempotency_anahtari || []) {
  const r = sip.idemAnahtari(c.idem === null ? undefined : c.idem, c.siparis_no);
  k(r === c.anahtar, 'idempotency_anahtari ' + j([c.idem, c.siparis_no]) + ': beklenen ' + c.anahtar + ' bulunan ' + r);
}
for (const c of V.google_cagri || []) {
  const r = mesafe.googleAdresiGuvenli(c.alis) && mesafe.googleAdresiGuvenli(c.varis);
  k(r === c.cagri, 'google_cagri ' + j([c.alis, c.varis]) + ': beklenen ' + c.cagri + ' bulunan ' + r);
}

const simdi = new Date(V.dogrulama_bugun.simdi_utc);
k(sip.bugunBrussels(simdi) === V.dogrulama_bugun.bugun_brussels,
  'bugunBrussels(' + V.dogrulama_bugun.simdi_utc + ') = ' + sip.bugunBrussels(simdi));
const CIKTI_ALANI = { km: 'kmIstemci', donus_tarih: 'donusTarih', donus_saat: 'donusSaat' };
for (const c of V.dogrulama) {
  const ham = Object.assign({}, V.dogrulama_taban, c.baglam || {});
  const tumu = new Map();
  for (const a of Object.keys(ham)) tumu.set(a, [ham[a]]);
  if (Array.isArray(c.deger)) tumu.set(c.alan, c.deger.slice());
  else tumu.set(c.alan, [c.deger]);
  const yh = sip.yapisalHata(tumu);
  let s;
  if (yh) {
    s = { ok: false, alan: yh, anahtar: sip.ALAN_MESAJI[yh] };
  } else {
    const duz = {};
    for (const [a, v] of tumu) duz[a] = v[0];
    s = sip.dogrula(duz, simdi);
  }
  const ad = 'dogrulama ' + c.alan + '=' + j(c.deger) + ' (' + c.sebep + ')';
  k(s.ok === c.gecerli, ad + ': beklenen gecerli=' + c.gecerli + ' bulunan ' + j(s.ok ? 'gecerli' : [s.alan, s.anahtar]));
  if (!c.gecerli && !s.ok) {
    k(s.alan === c.hata_alani, ad + ': hata alani ' + c.hata_alani + ' beklenirdi, ' + s.alan);
    k(s.anahtar === c.mesaj, ad + ': mesaj ' + c.mesaj + ' beklenirdi, ' + s.anahtar);
  }
  if (c.gecerli && s.ok && 'temiz' in c) {
    const alan = CIKTI_ALANI[c.alan] || c.alan;
    k(s.deger[alan] === c.temiz, ad + ': temiz ' + j(c.temiz) + ' beklenirdi, ' + j(s.deger[alan]));
  }
}
console.log(JSON.stringify({ say, hatalar }));
"""

LIMIT_JS = r"""
'use strict';
// Oran sinirlayici ve kaba kuvvet korumasi birim testleri (sahte zamanla). argv[2] = cikti dizini.
const g = require(process.argv[1] + '/api/_lib/guvenlik.js');
const cikti = {};
const t0 = 1000000000000;

// dakikada 5
let s = new g.OranSiniri([{ pencereMs: 60000, en: 5 }, { pencereMs: 3600000, en: 30 }]);
cikti.ilk5 = [0, 1, 2, 3, 4].map((i) => s.dene('a', t0 + i * 100).izin);
const alti = s.dene('a', t0 + 1000);
cikti.altinci = alti.izin;
cikti.altinciBekleme = alti.beklemeSn;
cikti.baskaIp = s.dene('b', t0 + 1000).izin;
cikti.birDkSonra = s.dene('a', t0 + 60500).izin;

// saatte 30 (istekler 13 sn arayla: dakikada <5 ama saatte asilir)
s = new g.OranSiniri([{ pencereMs: 60000, en: 5 }, { pencereMs: 3600000, en: 30 }]);
const gecenler = [];
for (let i = 0; i < 30; i++) gecenler.push(s.dene('c', t0 + i * 13000).izin);
cikti.saat30Gecen = gecenler.every((x) => x === true);
const otuzBir = s.dene('c', t0 + 30 * 13000);
cikti.otuzBir = otuzBir.izin;
cikti.otuzBirBekleme = otuzBir.beklemeSn;
cikti.saatSonra = s.dene('c', t0 + 3600000 + 1000).izin;

// bellek siniri: cok sayida IP kayit tabani asmaz
s = new g.OranSiniri([{ pencereMs: 60000, en: 5 }], 100);
for (let i = 0; i < 1000; i++) s.dene('ip' + i, t0 + i);
cikti.kayitSayisi = s.kayitlar.size;

// kaba kuvvet: 5 basarisiz -> 15 dk kilit
const kk = new g.KabaKuvvet(5, 15 * 60 * 1000);
cikti.kk_ilk4 = [0, 1, 2, 3].map((i) => kk.basarisiz('x', t0 + i));
cikti.kk_5 = kk.basarisiz('x', t0 + 5);
cikti.kk_kilitli = kk.kalanSn('x', t0 + 60000);
cikti.kk_baskaIp = kk.kalanSn('y', t0 + 60000);
cikti.kk_sonra = kk.kalanSn('x', t0 + 15 * 60 * 1000 + 6);
const kk2 = new g.KabaKuvvet(5, 15 * 60 * 1000);
for (let i = 0; i < 4; i++) kk2.basarisiz('z', t0 + i);
kk2.temizle('z');
cikti.kk_temizleSonra = kk2.basarisiz('z', t0 + 10);

// istek kimligi: 8 onaltilik karakter, HICBIRI tamamen rakamdan olusmaz (log temizleyicisi telefon sanmasin)
let kimlikBozuk = 0;
for (let i = 0; i < 50000; i++) {
  const id = g.istekKimligi();
  if (!/^[0-9a-f]{8}$/.test(id) || /^[0-9]{8}$/.test(id) || !/[a-f]/.test(id)) kimlikBozuk++;
}
cikti.kimlikBozuk = kimlikBozuk;
console.log(JSON.stringify(cikti));
"""

PHP_FIYAT_TARAMA = r"""
require '%s/pay/create.php';
$o = [];
for ($km = 1; $km <= 800; $km++) { [$t, $k, $r] = fiyat_hesapla($km); $o[$km] = [number_format($t, 2, '.', ''), number_format($k, 2, '.', ''), number_format($r, 2, '.', '')]; }
// km_karar karsilastirma esdegerligi: kayan nokta ile tamsayi (tol=12)
$fark = 0;
for ($g = 1; $g <= 800; $g++) for ($i = 1; $i <= 800; $i++) {
  if ((abs($g - $i) / $g * 100 > 12) !== (abs($g - $i) * 100 > 12 * $g)) $fark++;
  if (($i < $g * (1 - 12 / 100)) !== ($i * 100 < $g * (100 - 12))) $fark++;
}
echo json_encode(['fiyat' => $o, 'esdeger_fark' => $fark]);
"""

ISTEMCI_FIYAT_JS = r"""
// assets/app.js'teki istemci formulunun (Math.round) 1..800 taramasi ve Node fiyat.js ile karsilastirma
const f = require(process.argv[1] + '/api/_lib/fiyat.js');
const bozuk = [];
for (let km = 1; km <= 800; km++) {
  const toplam = Math.round((10 + km * 1.99) * 100) / 100;
  const kapora = Math.round(toplam * 20) / 100;
  const kalan = Math.round((toplam - kapora) * 100) / 100;
  const r = f.fiyatHesapla(km);
  if (r.toplam !== toplam || r.kapora !== kapora || r.kalan !== kalan) bozuk.push([km, toplam, kapora, kalan, r.toplam, r.kapora, r.kalan]);
}
console.log(JSON.stringify(bozuk));
"""

EPOSTA_JS = r"""
// Node musteri e-postasi / sirket metni: stdin = siparis listesi (PHP dizisiyle ayni alanlar)
const m = require(process.argv[1] + '/api/_lib/mail.js');
const liste = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(liste.map((s) => ({ html: m.musteriEpostaHtml(s), metin: m.sirketEpostaMetni(s) }))));
"""

PHP_EPOSTA = r"""
require '%s/pay/mailer.php';
$liste = json_decode(file_get_contents('php://stdin'), true);
$o = [];
foreach ($liste as $s) { $o[] = ['html' => musteri_eposta_html($s), 'metin' => sirket_eposta_metni($s)]; }
echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
"""


GOOGLE_JS = r"""
// Gercek googleKm() ile google_cagri vektorlerini kosar (mock'a giden istekler mock logundan sayilir). stdin = vektor JSON.
const m = require(process.argv[1] + '/api/_lib/mesafe.js');
const V = JSON.parse(require('fs').readFileSync(0, 'utf8'));
(async () => {
  for (const c of V.google_cagri) await m.googleKm(c.alis, c.varis);
  console.log('tamam');
})();
"""

PHP_YENI_VEKTOR = r"""
require '%s/pay/create.php';
$V = json_decode(file_get_contents('php://stdin'), true);
$o = ['iptal' => [], 'idem' => [], 'anahtar' => []];
foreach ($V['iptal'] as $c) { $f = $c['deger'] === null ? [] : ['iptal' => [$c['deger']]]; $o['iptal'][] = girdi_ilk($f, 'iptal') === '1'; }
foreach ($V['idem'] as $c) { $o['idem'][] = girdi_idem($c['deger']); }
foreach ($V['idempotency_anahtari'] as $c) { $i = girdi_idem($c['idem']); $o['anahtar'][] = $i !== '' ? $i : 'et-' . $c['siparis_no']; }
echo json_encode($o, JSON_UNESCAPED_UNICODE);
"""

PHP_GOOGLE = r"""
require '%s/pay/create.php';
$V = json_decode(file_get_contents('php://stdin'), true);
foreach ($V['google_cagri'] as $c) { google_km($c['alis'], $c['varis']); }
echo 'tamam';
"""


def node_calistir(kod, *argv, girdi=None):
    p = subprocess.run(["node", "-e", kod, "--", *argv], input=girdi, capture_output=True, text=True, timeout=120)
    return p


# ================================================================ gecici repo + www
def www_uret():
    """Repoyu gecici dizine kopyalar (www/, .git, vercel-out haric) ve ORADA build.py calistirir.
    Gercek www/ baskalarinin elinde olabilir: test yalniz bu gecici kopyayi kullanir."""
    global WWW, GECICI_REPO
    GECICI_REPO = TMP / "repo"
    GECICI_REPO.mkdir(parents=True)
    p1 = subprocess.Popen(["tar", "--exclude=.git", "--exclude=./www", "--exclude=./teslim", "--exclude=./vercel-out",
                           "--exclude=*.whl", "--exclude=__pycache__", "-cf", "-", "."], cwd=str(KOK), stdout=subprocess.PIPE)
    p2 = subprocess.run(["tar", "-xf", "-"], cwd=str(GECICI_REPO), stdin=p1.stdout)
    p1.stdout.close()
    p1.wait()
    if p1.returncode != 0 or p2.returncode != 0:
        raise SystemExit("HATA: repo gecici dizine kopyalanamadi")
    b = subprocess.run([sys.executable, str(GECICI_REPO / "kaynak" / "build.py")], capture_output=True, text=True, cwd=str(GECICI_REPO))
    if b.returncode != 0:
        raise SystemExit("HATA: gecici repoda build.py basarisiz:\n" + b.stdout[-600:] + b.stderr[-600:])
    WWW = GECICI_REPO / "www"
    # PHP mesafe motoru www/pay/mesafe.json'a ihtiyac duyar (build.py henuz uretmiyorsa pay_veri ile uret)
    if not (WWW / "pay" / "mesafe.json").is_file():
        pv = GECICI_REPO / "kaynak" / "pay_veri.py"
        if pv.is_file():
            subprocess.run([sys.executable, str(pv), "--mesafe-json", str(WWW / "pay" / "mesafe.json")], capture_output=True, text=True, cwd=str(GECICI_REPO))


# ================================================================ SENARYOLAR
def senaryo_kaynak_ve_derleme():
    print("— A. kaynak denetimi + vercel_build.py")
    js = sorted((KAYNAK / "vercel").rglob("*.js"))
    kontrol(len(js) >= 15, f"kaynak/vercel altinda beklenen JS dosyalari yok ({len(js)})")
    for f in js:
        p = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
        kontrol(p.returncode == 0, f"node --check basarisiz: {f.name}: {p.stderr[:200]}")

    # SIFIR npm bagimliligi: yalniz node: yerlesikleri ve goreli require
    for f in js:
        for m in re.finditer(r"require\((['\"])([^'\"]+)\1\)", f.read_text(encoding="utf-8")):
            hedef = m.group(2)
            kontrol(hedef.startswith("node:") or hedef.startswith("./") or hedef.startswith("../") or hedef.startswith("."),
                    f"{f.name}: yerlesik/goreli olmayan require: {hedef}")
    pkg = json.loads((KAYNAK / "vercel" / "package.json").read_text(encoding="utf-8"))
    kontrol(not pkg.get("dependencies") and not pkg.get("devDependencies"), "package.json bagimlilik icermemeli")

    # derle (gecici dizine)
    p = subprocess.run([sys.executable, str(KAYNAK / "vercel_build.py"), "--out", str(CIKTI), "--www", str(WWW)], capture_output=True, text=True)
    kontrol(p.returncode == 0, "vercel_build.py basarisiz:\n" + p.stdout + p.stderr)
    print("   " + p.stdout.strip().replace("\n", "\n   "))
    if p.returncode != 0:
        raise SystemExit("derleme olmadan devam edilemez")

    # cikti icerigi: PHP/.htaccess/pay/orders YOK
    dosyalar = [f.relative_to(CIKTI).as_posix() for f in CIKTI.rglob("*") if f.is_file()]
    kontrol(not any(d.endswith(".php") for d in dosyalar), "ciktida .php dosyasi var")
    kontrol(not any(d.split("/")[-1] == ".htaccess" for d in dosyalar), "ciktida .htaccess var")
    kontrol(not any(d.startswith("pay/") or "/orders/" in d for d in dosyalar), "ciktida pay/ veya orders/ var")
    for gerekli in ["index.html", "fr/index.html", "nl/index.html", "en/index.html", "tr/index.html", "assets/favicon.svg",
                    "robots.txt", "sitemap.xml", "api/create.js", "api/webhook.js", "api/success.js", "api/orders.js",
                    "api/test.js", "api/_lib/dil.json", "api/_lib/mesafe.json", "package.json"]:
        kontrol((CIKTI / gerekli).is_file(), f"ciktida eksik: {gerekli}")
    kontrol(not (CIKTI / "api" / "dev-server.js").exists() and not (CIKTI / "dev-server.js").exists(), "dev-server.js ciktiya girmemeli")
    kontrol(not (CIKTI / "README.md").exists(), "README.md ciktiya girmemeli")

    # sentetik www: tuzak dosyalar HARIC tutulmali
    sahte = TMP / "sahte_www"
    for yol, icerik in {
        "index.html": "<!doctype html>", "fr/index.html": "x", "nl/index.html": "x", "en/index.html": "x", "tr/index.html": "x",
        "assets/logo.svg": "<svg/>", "assets/evil.php": "<?php echo 1;", "assets/.htaccess": "deny",
        "pay/config.php": "<?php return [];", "pay/orders/ET-1.json": "{}", "orders/gizli.json": "{}",
        "robots.txt": "User-agent: *", "sitemap.xml": "<urlset/>", ".htaccess": "RewriteEngine on", "notlar.log": "x",
    }.items():
        (sahte / yol).parent.mkdir(parents=True, exist_ok=True)
        (sahte / yol).write_text(icerik, encoding="utf-8")
    out2 = TMP / "cikti_sahte"
    p = subprocess.run([sys.executable, str(KAYNAK / "vercel_build.py"), "--out", str(out2), "--www", str(sahte)], capture_output=True, text=True)
    kontrol(p.returncode == 0, "sentetik www ile derleme basarisiz: " + p.stdout + p.stderr)
    d2 = [f.relative_to(out2).as_posix() for f in out2.rglob("*") if f.is_file()] if out2.exists() else []
    for yasak in ["assets/evil.php", "assets/.htaccess", "pay/config.php", "pay/orders/ET-1.json", "orders/gizli.json", ".htaccess", "notlar.log"]:
        kontrol(yasak not in d2, f"sentetik www: '{yasak}' ciktiya sizdi")
    kontrol("assets/logo.svg" in d2 and "robots.txt" in d2, "sentetik www: mesru dosyalar eksik")

    # sabit uyusmazliginda derleme HATA vermeli (kaynak agacinin gecici kopyasinda)
    def kopya_kaynak(ad):
        hedef = TMP / ad / "kaynak"
        hedef.mkdir(parents=True)
        for f in ["vercel_build.py", "build.py", "strings.json", "mesafe-verisi.json", "isletme.json", "template.html"]:
            shutil.copy2(KAYNAK / f, hedef / f)
        (hedef / "assets").mkdir()
        shutil.copy2(KAYNAK / "assets" / "app.js", hedef / "assets" / "app.js")
        (hedef / "pay").mkdir()
        shutil.copy2(KAYNAK / "pay" / "create.php", hedef / "pay" / "create.php")
        shutil.copytree(KAYNAK / "vercel", hedef / "vercel")
        return hedef

    for ad, dosya, eski, yeni, beklenen in [
        ("sapma_tpl", "assets/app.js", "KM_UCRET: 1.99", "KM_UCRET: 1.98", "app.js"),
        ("sapma_php", "pay/create.php", "const KM_UCRETI      = 1.99;", "const KM_UCRETI      = 2.05;", "create.php"),
        ("sapma_json", "mesafe-verisi.json", '"kapora_yuzde": 20', '"kapora_yuzde": 25', "kapora_yuzde"),
    ]:
        k = kopya_kaynak(ad)
        yol = k / dosya
        icerik = yol.read_text(encoding="utf-8")
        if eski not in icerik:
            kontrol(False, f"{ad}: kaynakta '{eski}' bulunamadi (test guncellenmeli)")
            continue
        yol.write_text(icerik.replace(eski, yeni), encoding="utf-8")
        p = subprocess.run([sys.executable, str(k / "vercel_build.py"), "--out", str(TMP / ad / "cikti"), "--www", str(WWW)],
                           capture_output=True, text=True)
        kontrol(p.returncode != 0 and "Fiyat sabiti uyusmuyor" in p.stdout,
                f"{ad}: sabit uyusmazliginda derleme HATA vermeli (kod={p.returncode}): {p.stdout[-200:]}")

    # vercel.json (lider yazacak) varsa: 5 rewrite dogrulanir; eksikse HATA, tamsa cikti dizinine kopyalanir
    k = kopya_kaynak("vj_eksik")
    (k / "vercel" / "vercel.json").write_text(json.dumps({"rewrites": [{"source": "/pay/create.php", "destination": "/api/create"}]}), encoding="utf-8")
    p = subprocess.run([sys.executable, str(k / "vercel_build.py"), "--out", str(TMP / "vj_eksik" / "cikti"), "--www", str(WWW)], capture_output=True, text=True)
    kontrol(p.returncode != 0 and "rewrite eksik" in p.stdout, "eksik rewrite'li vercel.json'da derleme HATA vermeli: " + p.stdout[-200:])
    k = kopya_kaynak("vj_tam")
    tam = {"rewrites": [{"source": kaynak_yol, "destination": hedef} for kaynak_yol, hedef in [
        ("/pay/create.php", "/api/create"), ("/pay/webhook.php", "/api/webhook"), ("/pay/success.php", "/api/success"),
        ("/pay/orders.php", "/api/orders"), ("/pay/test.php", "/api/test")]]}
    (k / "vercel" / "vercel.json").write_text(json.dumps(tam), encoding="utf-8")
    p = subprocess.run([sys.executable, str(k / "vercel_build.py"), "--out", str(TMP / "vj_tam" / "cikti"), "--www", str(WWW)], capture_output=True, text=True)
    kontrol(p.returncode == 0 and json.loads((TMP / "vj_tam" / "cikti" / "vercel.json").read_text(encoding="utf-8")) == tam,
            "tam rewrite'li vercel.json cikti kokune kopyalanmali: " + p.stdout[-200:] + p.stderr[-200:])
    (k / "vercel" / "vercel.json").write_text("{bozuk", encoding="utf-8")
    p = subprocess.run([sys.executable, str(k / "vercel_build.py"), "--out", str(TMP / "vj_tam" / "cikti2"), "--www", str(WWW)], capture_output=True, text=True)
    kontrol(p.returncode != 0 and "JSON bozuk" in p.stdout, "bozuk vercel.json'da derleme HATA vermeli")
    # www icinde api/ varsa cakisma HATA
    sahte2 = TMP / "sahte_www2"
    shutil.copytree(sahte, sahte2)
    (sahte2 / "api").mkdir()
    (sahte2 / "api" / "x.js").write_text("x", encoding="utf-8")
    p = subprocess.run([sys.executable, str(KAYNAK / "vercel_build.py"), "--out", str(TMP / "cikti_cakisma"), "--www", str(sahte2)], capture_output=True, text=True)
    kontrol(p.returncode != 0 and "cakisir" in p.stdout, "www/api varsa derleme HATA vermeli")
    # ikinci calistirma (cikti adi 'vercel-out') temizler ve yeniden uretir
    p = subprocess.run([sys.executable, str(KAYNAK / "vercel_build.py"), "--out", str(CIKTI), "--www", str(WWW)], capture_output=True, text=True)
    kontrol(p.returncode == 0 and (CIKTI / "api" / "create.js").is_file(), "vercel-out ikinci kez derlenebilmeli: " + p.stdout[-200:])

    # --test-ucu-yok: api/test.js ciktiya girmez, gerisi tamam
    out3 = TMP / "cikti_testsiz"
    p = subprocess.run([sys.executable, str(KAYNAK / "vercel_build.py"), "--out", str(out3), "--www", str(WWW), "--test-ucu-yok"], capture_output=True, text=True)
    kontrol(p.returncode == 0 and not (out3 / "api" / "test.js").exists() and (out3 / "api" / "create.js").is_file(),
            "--test-ucu-yok: api/test.js ciktida olmamali, digerleri olmali: " + p.stdout[-200:] + p.stderr[-200:])

    # cikti dizini guvenligi: proje kokunu silmeyi reddet
    p = subprocess.run([sys.executable, str(KAYNAK / "vercel_build.py"), "--out", str(KOK), "--www", str(WWW)], capture_output=True, text=True)
    kontrol(p.returncode != 0 and "guvenli degil" in p.stdout, "cikti dizini olarak repo kokune izin verilmemeli")


def senaryo_mock_dogrudan():
    print("— B. sahte servislerin kendi davranisi (PHP testleri de buna guvenecek)")
    mock_sifirla()
    gecerli = {
        "amount": {"currency": "EUR", "value": "24.29"}, "description": "Europa Taxi ET-260101-ABCDEF",
        "redirectUrl": "https://ornek.be/ok", "webhookUrl": "https://ornek.be/wh",
        "locale": "nl_BE", "method": ["bancontact", "creditcard"], "metadata": {"n": 1},
    }
    kod, j = mollie_ham("POST", "payments", gecerli, anahtar=None)
    kontrol(kod == 401, f"Mollie: anahtarsiz istek 401 olmali, {kod}")
    kod, j = mollie_ham("POST", "payments", gecerli, anahtar="Bearer live_abc123")
    kontrol(kod == 401, f"Mollie: test_ olmayan anahtar 401 olmali, {kod}")
    kod, j = mollie_ham("POST", "payments", gecerli)
    kontrol(kod == 201 and re.fullmatch(r"tr_[A-Za-z0-9]{10}", j.get("id", "")), f"Mollie: gecerli olusturma 201/tr_ id: {kod} {j.get('id')}")
    kontrol(j.get("status") == "open" and j["_links"]["checkout"]["href"] == f"http://127.0.0.1:{MOCK}/checkout/{j['id']}",
            "Mollie: status open ve checkout href")
    kontrol(j["amount"] == gecerli["amount"] and j["description"] == gecerli["description"] and j["metadata"] == {"n": 1} and "createdAt" in j,
            "Mollie: yanit alanlari (amount/description/metadata/createdAt)")
    ilk_id = j["id"]
    # gecersiz govdeler -> 422
    def kotu(**degisim):
        g = json.loads(json.dumps(gecerli))
        for k, v in degisim.items():
            if v is None:
                g.pop(k, None)
            else:
                g[k] = v
        return mollie_ham("POST", "payments", g)[0]
    kontrol(kotu(amount={"currency": "USD", "value": "1.00"}) == 422, "Mollie: USD 422")
    kontrol(kotu(amount={"currency": "EUR", "value": "24.3"}) == 422, "Mollie: '24.3' (2 ondalik degil) 422")
    kontrol(kotu(amount={"currency": "EUR", "value": "24.299"}) == 422, "Mollie: '24.299' 422")
    kontrol(kotu(amount={"currency": "EUR", "value": 24.29}) == 422, "Mollie: sayi tipi 422")
    kontrol(kotu(amount={"currency": "EUR", "value": "0.00"}) == 422, "Mollie: 0.00 422")
    kontrol(kotu(redirectUrl="ftp://x") == 422 and kotu(redirectUrl=None) == 422, "Mollie: redirectUrl gecersiz 422")
    kontrol(kotu(webhookUrl="javascript:1") == 422, "Mollie: webhookUrl gecersiz 422")
    kontrol(kotu(locale="tr_TR") == 422, "Mollie: tr_TR locale gecersiz 422 (Mollie Turkce desteklemez)")
    kontrol(kotu(method=["bitcoin"]) == 422, "Mollie: gecersiz method 422")
    kontrol(kotu(description=None) == 422, "Mollie: description zorunlu")
    buyuk = {"x": "a" * 1100}
    kod, j2 = mollie_ham("POST", "payments", dict(gecerli, metadata=buyuk))
    kontrol(kod == 422 and j2.get("field") == "metadata", f"Mollie: metadata > 1024 bayt 422 olmali ({kod})")
    sinirda = {"x": "a" * (1024 - len(json.dumps({"x": ""}, separators=(',', ':'))))}
    kontrol(len(json.dumps(sinirda, separators=(",", ":")).encode()) == 1024
            and mollie_ham("POST", "payments", dict(gecerli, metadata=sinirda))[0] == 201, "Mollie: tam 1024 bayt metadata kabul edilmeli")
    # cok baytli: karakter sayisi degil BAYT sayilir
    kontrol(mollie_ham("POST", "payments", dict(gecerli, metadata={"x": "é" * 600}))[0] == 422, "Mollie: metadata BAYT olarak sayilmali (600 x é = 1200 bayt)")
    # idempotency
    idem = {"Idempotency-Key": "anahtar-1"}
    k1, a = mollie_ham("POST", "payments", gecerli, baslik=idem)
    k2, b = mollie_ham("POST", "payments", gecerli, baslik=idem)
    k3, c = mollie_ham("POST", "payments", gecerli, baslik={"Idempotency-Key": "anahtar-2"})
    kontrol(k1 == 201 and k2 == 201 and a["id"] == b["id"] and a["id"] != c["id"], "Mollie: ayni Idempotency-Key ayni odemeyi doner, farkli anahtar yeni odeme")
    # okuma
    kod, o = mollie_ham("GET", "payments/" + ilk_id)
    kontrol(kod == 200 and o["id"] == ilk_id, "Mollie: GET /payments/<id>")
    kod, o = mollie_ham("GET", "payments/tr_yokyokyok1")
    kontrol(kod == 404 and o.get("status") == 404, "Mollie: bilinmeyen id 404 (Mollie bicimli)")
    kod, o = mollie_ham("GET", "payments/" + ilk_id, anahtar=None)
    kontrol(kod == 401, "Mollie: GET anahtarsiz 401")
    # liste: en yeni ilk + sayfalama
    mock_sifirla()
    idler = []
    for i in range(7):
        kod, j = mollie_ham("POST", "payments", dict(gecerli, description=f"d{i}"))
        idler.append(j["id"])
    kod, l1 = mollie_ham("GET", "payments?limit=3")
    kontrol(kod == 200 and [p["id"] for p in l1["_embedded"]["payments"]] == idler[::-1][:3], "Mollie liste: en yeni ilk, limit=3")
    kontrol(l1["_links"]["next"] is not None and "from=" + idler[::-1][3] in l1["_links"]["next"]["href"], "Mollie liste: _links.next imleci")
    tumu = []
    imlec = None
    for _ in range(10):
        kod, l = mollie_ham("GET", "payments?limit=3" + (f"&from={imlec}" if imlec else ""))
        tumu += [p["id"] for p in l["_embedded"]["payments"]]
        sonraki = l["_links"]["next"]
        if not sonraki:
            break
        imlec = urllib.parse.parse_qs(urllib.parse.urlsplit(sonraki["href"]).query)["from"][0]
    kontrol(tumu == idler[::-1], "Mollie liste: sayfalama tum odemeleri sirayla doner")
    mock("POST", "/__test/page_size/2", {})
    kod, l = mollie_ham("GET", "payments?limit=250")
    kontrol(l["count"] == 2 and l["_links"]["next"] is not None, "Mollie liste: page_size ust siniri uygulanir")
    mock("POST", "/__test/page_size/250", {})
    kod, m = mollie_ham("GET", "methods")
    kontrol(kod == 200 and "bancontact" in [x["id"] for x in m["_embedded"]["methods"]], "Mollie: /methods")
    # PATCH
    kod, p = mollie_ham("PATCH", "payments/" + idler[0], {"metadata": {"m": 1}})
    kontrol(kod == 200 and mollie_ham("GET", "payments/" + idler[0])[1]["metadata"] == {"m": 1}, "Mollie: PATCH metadata")
    # test kontrolleri
    mock("POST", "/__test/paid/" + idler[1] + "?webhook=0", {})
    o = mollie_ham("GET", "payments/" + idler[1])[1]
    kontrol(o["status"] == "paid" and re.match(r"\d{4}-\d\d-\d\dT", o.get("paidAt", "")), "Mock: /__test/paid status+paidAt")
    mock("POST", "/__test/refund/" + idler[1] + "?webhook=0&amount=5.00", {})
    kontrol(mollie_ham("GET", "payments/" + idler[1])[1]["amountRefunded"]["value"] == "5.00", "Mock: /__test/refund amountRefunded")
    mock("POST", "/__test/expired/" + idler[2] + "?webhook=0", {})
    kontrol(mollie_ham("GET", "payments/" + idler[2])[1]["status"] == "expired", "Mock: /__test/expired")
    mock("POST", "/__test/mollie_fail/1", {})
    kontrol(mollie_ham("GET", "methods")[0] == 500 and mollie_ham("GET", "methods")[0] == 200, "Mock: mollie_fail/1 yalniz bir cagriyi 500 yapar")
    # BREVO
    mock_sifirla()
    def brevo(govde, anahtar="anahtar", ham=None):
        c = http.client.HTTPConnection("127.0.0.1", MOCK, timeout=30)
        b = {"Content-Type": "application/json"}
        if anahtar:
            b["api-key"] = anahtar
        c.request("POST", "/v3/smtp/email", body=ham if ham is not None else json.dumps(govde).encode(), headers=b)
        r = c.getresponse()
        return r.status, r.read().decode()
    posta = {"sender": {"name": "X", "email": "a@b.be"}, "to": [{"email": "c@d.be"}], "subject": "Konu", "htmlContent": "<p>x</p>", "textContent": "x"}
    kontrol(brevo(posta, anahtar=None)[0] == 401, "Brevo: api-key basligi zorunlu (401)")
    kontrol(brevo(posta)[0] == 201, "Brevo: gecerli gonderim 201")
    kontrol(brevo(dict(posta, to=[{"email": "gecersiz"}]))[0] == 400, "Brevo: bozuk alici 400")
    kontrol(brevo(dict(posta, subject=""))[0] == 400, "Brevo: bos konu 400")
    kontrol(brevo(None, ham=b"{bozuk")[0] == 400, "Brevo: bozuk JSON 400")
    kontrol(len(postalar()) == 1 and postalar()[0]["konu"] == "Konu" and postalar()[0]["alicilar"] == ["c@d.be"], "Brevo: gonderilenler saklanir")
    mock("POST", "/__test/brevo_fail/2?skip=1", {})
    kodlar = [brevo(posta)[0] for _ in range(4)]
    kontrol(kodlar == [201, 500, 500, 201], f"Brevo: skip=1,fail=2 -> 201,500,500,201, bulunan {kodlar}")
    mock("POST", "/__test/mails/reset", {})
    kontrol(len(postalar()) == 0, "Brevo: mails/reset")
    # GOOGLE
    def google(q):
        c = http.client.HTTPConnection("127.0.0.1", MOCK, timeout=30)
        c.request("GET", "/maps/api/distancematrix/json?" + urllib.parse.urlencode(q))
        r = c.getresponse()
        return r.status, json.loads(r.read().decode())
    kontrol(google({"origins": "a", "destinations": "b"})[1]["status"] == "REQUEST_DENIED", "Google: anahtarsiz REQUEST_DENIED")
    kod, g = google({"origins": "a", "destinations": "b", "key": "k"})
    kontrol(g["status"] == "OK" and g["rows"][0]["elements"][0]["distance"]["value"] == 56400, "Google: varsayilan 56400 m")
    mock("POST", "/__test/google/set?meters=1500&element=NOT_FOUND", {})
    kontrol(google({"origins": "a", "destinations": "b", "key": "k"})[1]["rows"][0]["elements"][0]["status"] == "NOT_FOUND", "Google: element NOT_FOUND ayari")
    mock("POST", "/__test/google/reset", {})
    mock_sifirla()


def sunuculari_baslat():
    print("— C. sunucular (mock + 5 dev-server varyanti)")
    for ad, port in [("mock", MOCK)] + list(PORT.items()):
        kontrol(port_bos_mu(port), f"port {port} ({ad}) dolu; ET_TEST_PORT ile baska taban secin")
    surec_baslat("mock", [sys.executable, str(TESTLER / "mock_dis_servisler.py"), "--port", str(MOCK)], temiz_ortam())
    kontrol(bekle_port(MOCK), "mock baslamadi")
    ortak = dict(MOLLIE_API_KEY=MOLLIE_ANAHTAR, MOLLIE_API_BASE=f"http://127.0.0.1:{MOCK}/v2",
                 BREVO_API_BASE=f"http://127.0.0.1:{MOCK}/v3", COMPANY_EMAIL=SIRKET_EPOSTA, MAIL_FROM=GONDEREN)
    A = dict(ortak, BREVO_API_KEY=BREVO_ANAHTAR, ADMIN_PASSWORD=ADMIN_SIFRE, SIGNING_SECRET=IMZA_SIRRI,
             SITE_URL=f"http://127.0.0.1:{PORT['A']}")
    B = dict(A, SITE_URL=f"http://127.0.0.1:{PORT['B']}", GOOGLE_SERVER_KEY=GOOGLE_ANAHTAR, GOOGLE_API_BASE=f"http://127.0.0.1:{MOCK}")
    C = dict(ortak, SITE_URL="https://europetaxi24.be")                       # BREVO yok, ADMIN yok, SIGNING yok, https
    D = dict(ortak, ADMIN_PASSWORD=ADMIN_SIFRE, SITE_URL=f"http://127.0.0.1:{PORT['D']}")  # BREVO yok, SIGNING yok (turetilir)
    E = dict(A, SITE_URL=f"http://127.0.0.1:{PORT['E']}")                     # A ile ayni ortam, ayri (soguk) surec
    for ad, env in [("A", A), ("B", B), ("C", C), ("D", D), ("E", E)]:
        sunucu_baslat(ad, env)
    kontrol(istek(PORT["A"], "GET", "/olmayan-yol").kod == 404, "dev-server: bilinmeyen yol 404")


# ------------------------------------------------------------------ 1. mutlu yol
def senaryo_mutlu_yol():
    print("— 1. mutlu yol: Gent -> Brussels Airport, km=56")
    mock_sifirla()
    s = siparis_olustur("A")
    y = siparis_olustur.son
    kontrol(s is not None, f"create 303 vermedi: {y.kod} {y.metin[:200]}")
    if s is None:
        return
    kontrol(y.kod == 303, f"create 303 olmali, {y.kod}")
    loc = y.baslik("location")
    kontrol(re.fullmatch(rf"http://127\.0\.0\.1:{MOCK}/checkout/tr_[A-Za-z0-9]{{10}}", loc or "") is not None, f"Location mock checkout olmali: {loc}")
    o = s.odeme
    kontrol(o["amount"] == {"currency": "EUR", "value": "24.29"}, f"odeme tutari 24.29 olmali: {o['amount']}")
    kontrol(o["description"] == "Europa Taxi " + s.no and re.fullmatch(r"ET-\d{6}-[A-Z0-9]{6}", s.no) is not None, f"description/no: {o['description']}")
    kontrol(o["status"] == "open" and o["locale"] == "nl_BE", "durum open, locale nl_BE")
    kontrol(o["redirectUrl"] == f"http://127.0.0.1:{PORT['A']}/pay/success.php?order={s.no}&dil=nl", f"redirectUrl: {o['redirectUrl']}")
    kontrol(o["webhookUrl"] == f"http://127.0.0.1:{PORT['A']}/pay/webhook.php", f"webhookUrl: {o['webhookUrl']}")
    m = s.meta
    boyut = len(json.dumps(m, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    kontrol(boyut <= 1024, f"metadata {boyut} bayt > 1024")
    kontrol(boyut <= 900, f"metadata {boyut} bayt > 900 (hedef)")
    kontrol(set(m.keys()) == {"v", "n", "l", "a", "b", "d", "r", "p", "g", "s", "c", "k", "t", "u", "e", "h", "src"}, f"metadata anahtarlari: {sorted(m)}")
    beklenen = {"v": 1, "n": s.no, "l": "nl", "a": "Korenmarkt 77, Gent", "b": "Brussels Airport (Zaventem)",
                "d": tarih(10) + "T14:30", "r": "", "p": 3, "g": 2, "s": 1, "c": "wagon", "k": 56, "t": 121.44,
                "u": "Jan Peeters", "e": "jan@voorbeeld.be", "h": "+32 470 11 22 33", "src": "d"}
    kontrol(m == beklenen, f"metadata alanlari yanlis:\n  beklenen {beklenen}\n  bulunan  {m}")
    # sunucu toplam 121,44 ; kapora %20 = 24,29 ; kalan 97,15
    kontrol(m["t"] == 121.44 and o["amount"]["value"] == "24.29", "sunucu toplam 121,44 / kapora 24,29")
    # cerez
    c = s.cerez
    kontrol(c is not None, "et_p cerezi verilmeli")
    if c:
        deger = c.split(";")[0].split("=", 1)[1]
        pid, imza = deger.rsplit(".", 1)
        beklenen_imza = hmac_mod.new(IMZA_SIRRI.encode(), pid.encode(), hashlib.sha256).hexdigest()
        kontrol(pid == s.id and imza == beklenen_imza, "et_p = <paymentId>.<HMAC-SHA256(secret, paymentId)>")
        oz = [x.strip() for x in c.split(";")[1:]]
        kontrol("HttpOnly" in oz and "SameSite=Lax" in oz and "Path=/" in oz and "Max-Age=7200" in oz, f"et_p bayraklari: {oz}")
        kontrol("Secure" not in oz, "SITE_URL http iken Secure YOK (yerel test)")
    # diller -> Mollie locale
    for dil, yerel in [("fr", "fr_BE"), ("en", "en_GB"), ("tr", "fr_BE"), ("nl", "nl_BE")]:
        s2 = siparis_olustur("A", dil=dil)
        kontrol(s2 is not None and s2.odeme["locale"] == yerel and s2.meta["l"] == dil, f"dil={dil} -> locale {yerel}")
    # bilinmeyen dil -> fr
    s3 = siparis_olustur("A", dil="xx")
    kontrol(s3 is not None and s3.meta["l"] == "fr" and s3.odeme["locale"] == "fr_BE", "bilinmeyen dil fr olmali")
    # donus yolculugu
    s4 = siparis_olustur("A", donus_tarih=tarih(17), donus_saat="18:05")
    kontrol(s4 is not None and s4.meta["r"] == tarih(17) + "T18:05", f"donus alani: {s4.meta['r'] if s4 else None}")
    s5 = siparis_olustur("A", donus_tarih=tarih(17), donus_saat="")
    kontrol(s5 is not None and s5.meta["r"] == tarih(17), "donus saati yoksa yalniz tarih")
    s6 = siparis_olustur("A", donus_tarih="", donus_saat="18:05")
    kontrol(s6 is not None and s6.meta["r"] == "", "donus tarihi yoksa donus saati yok sayilir")
    # https SITE_URL -> Secure cerez (sunucu C); C'de Brevo/Admin yok ama odeme olusur
    yc = istek(PORT["C"], "POST", "/pay/create.php", form(), origin="https://europetaxi24.be")
    kontrol(yc.kod == 303, f"C: create 303 olmali ({yc.kod})")
    cc = yc.cerez("et_p") or ""
    kontrol("Secure" in cc and "HttpOnly" in cc and "SameSite=Lax" in cc, f"https SITE_URL: et_p Secure olmali: {cc}")
    kontrol("et_p=" in cc and re.fullmatch(r"et_p=tr_[A-Za-z0-9]+\.[0-9a-f]{64}", cc.split(";")[0]) is not None, "C: turetilmis sirla da imzali cerez verilir")
    kontrol("SIGNING_SECRET ayarli degil" in log_oku("C"), "C: turetilmis imza sirri icin uyari loglanmali")


# ------------------------------------------------------------------ 2. paid
def bul_posta(kime):
    return [p for p in postalar() if kime in p["alicilar"]]


def senaryo_paid():
    print("— 2. paid -> webhook -> 2 e-posta (yalniz ilk odemede)")
    mock_sifirla()
    s = siparis_olustur("A", ad='Jan "J" O\'Brien & <b>Zn</b>', donus_tarih=tarih(17), donus_saat="18:00")
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and r["webhook"]["govde"] == "OK", f"webhook 200 OK olmali: {r}")
    P = postalar()
    kontrol(len(P) == 2, f"TAM 2 e-posta beklenir, {len(P)}")
    musteri = bul_posta("jan@voorbeeld.be")
    sirket = bul_posta(SIRKET_EPOSTA)
    kontrol(len(musteri) == 1 and len(sirket) == 1, "1 musteri + 1 sirket e-postasi")
    if len(musteri) == 1 and len(sirket) == 1:
        m, sk = musteri[0], sirket[0]
        kontrol(m["konu"] == t("nl", "em_subject", ref=s.no), f"musteri konusu Flamanca: {m['konu']}")
        kontrol("Uw reservering" in m["konu"], "musteri konusu 'Uw reservering'")
        kontrol("voorschot" in m["html"].lower(), "musteri govdesinde 'voorschot' (Flamanca)")
        kontrol(h_php(t("nl", "em_paid")) in m["html"] and h_php(t("nl", "em_due")) in m["html"], "em_paid / em_due etiketleri")
        kontrol("24,29 €" in m["html"] and "97,15 €" in m["html"], "musteri e-postasinda kapora 24,29 ve kalan 97,15")
        kontrol(s.no in m["html"], "musteri e-postasinda referans")
        kontrol(m["gonderen"]["email"] == GONDEREN and m["gonderen"]["name"] == "Europa Taxi", f"gonderen: {m['gonderen']}")
        # HTML kacisi (ad alaninda tirnak/etiket)
        kontrol("Jan &quot;J&quot; O&#039;Brien &amp; &lt;b&gt;Zn&lt;/b&gt;" in m["html"] and "<b>Zn</b>" not in m["html"],
                "musteri e-postasi HTML kacisli olmali (tirnak/&/<b>)")
        kontrol(m["metin"] == "", "musteri e-postasi yalniz HTML (PHP ile ayni)")
        # sirket: duz metin is emri
        kontrol("ARACTA TAHSIL: 97,15 EUR" in sk["metin"], f"is emri 'ARACTA TAHSIL: 97,15 EUR' icermeli:\n{sk['metin']}")
        kontrol("Odenen kapora: 24,29 EUR" in sk["metin"] and "Toplam       : 121,44 EUR" in sk["metin"], "is emrinde toplam/kapora")
        kontrol("Referans     : " + s.no in sk["metin"] and "Telefon      : +32 470 11 22 33" in sk["metin"], "is emrinde referans/telefon")
        kontrol("Donus        : " in sk["metin"] and ", saat 18:00" in sk["metin"], "is emrinde donus (Turkce bicim)")
        kontrol(sk["konu"].startswith("Yeni rezervasyon · " + s.no + " · "), f"sirket konusu: {sk['konu']}")
        kontrol("<pre" in sk["html"] and "&gt;" in sk["html"], "sirket e-postasinin HTML kismi <pre> icinde kacisli metin")
        kontrol("Jan \"J\" O'Brien & <b>Zn</b>" in sk["metin"], "is emrinde (duz metin) ad ham haliyle olmali")
    # ayni webhook'u 2. kez -> e-posta sayisi ARTMAZ
    r2 = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r2["webhook"]["kod"] == 200 and len(postalar()) == 2, f"tekrar webhook e-posta artirmamali ({len(postalar())})")
    # Mollie'de kalici 'e-postalar gonderildi' isareti
    kontrol(mollie_ham("GET", "payments/" + s.id)[1]["metadata"].get("m") == 1, "webhook Mollie metadata'sina m:1 isareti yazmali")
    # iade sonrasi webhook yeni e-posta gondermez
    r3 = mock("POST", f"/__test/refund/{s.id}", {})
    kontrol(r3["webhook"]["kod"] == 200 and len(postalar()) == 2, f"iade webhook'u e-posta gondermemeli ({len(postalar())})")
    # SOGUK (baska) surec: ayni odeme icin webhook -> hala artmaz (Mollie'deki isaret + iade)
    # once iadesiz bir siparisle dene
    s2 = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s2.id}", {})
    n0 = len(postalar())
    kontrol(n0 == 4, f"ikinci siparis 2 e-posta daha gondermeli ({n0})")
    y = istek(PORT["E"], "POST", "/pay/webhook.php", {"id": s2.id}, ip=None, origin=None)
    kontrol(y.kod == 200 and len(postalar()) == n0, f"soguk/baska ornek ayni webhook'ta e-posta gondermemeli (metadata m:1): {len(postalar())}")
    # iade ONCE, e-posta HIC gitmeden
    mock_sifirla()
    s3 = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s3.id}?webhook=0", {})
    mock("POST", f"/__test/refund/{s3.id}", {})
    kontrol(len(postalar()) == 0, f"paid+iade birlikte gelirse e-posta gonderilmemeli ({len(postalar())})")
    # geri odeme (chargeback)
    s4 = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s4.id}?webhook=0", {})
    mock("POST", f"/__test/chargeback/{s4.id}", {})
    kontrol(len(postalar()) == 0, "chargeback varsa e-posta gonderilmemeli")
    # paidAt 48 saatten eski
    s5 = siparis_olustur("A")
    r = mock("POST", f"/__test/paid/{s5.id}?hours_ago=72", {})
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 0, f"paidAt 72 saat once: e-posta gonderilmemeli ({len(postalar())})")
    # 47 saat once hala pencerede
    s6 = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s6.id}?hours_ago=47", {})
    kontrol(len(postalar()) == 2, f"paidAt 47 saat once pencere icinde: 2 e-posta ({len(postalar())})")
    # tum dillerde musteri e-postasi
    mock_sifirla()
    for dil in DILLER:
        sd = siparis_olustur("A", dil=dil)
        mock("POST", f"/__test/paid/{sd.id}", {})
        mm = [p for p in bul_posta("jan@voorbeeld.be") if sd.no in p["html"]]
        kontrol(len(mm) == 1 and mm[0]["konu"] == t(dil, "em_subject", ref=sd.no) and h_php(t(dil, "em_heading")) in mm[0]["html"],
                f"[{dil}] musteri e-postasi kendi dilinde")
    # paid degil durumlar: e-posta yok
    mock_sifirla()
    so = siparis_olustur("A")
    mock("POST", f"/__test/webhook/{so.id}", {})
    kontrol(len(postalar()) == 0, "open durumunda webhook e-posta gondermemeli")
    for durum in ["expired", "failed", "canceled"]:
        sx = siparis_olustur("A")
        mock("POST", f"/__test/{durum}/{sx.id}", {})
    kontrol(len(postalar()) == 0, "expired/failed/canceled durumunda e-posta yok")


# ------------------------------------------------------------------ 3. success
def senaryo_success():
    print("— 3. success sayfasi (cerezli / cerezsiz / open / failed / bozuk)")
    mock_sifirla()
    p = PORT["A"]
    s = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s.id}", {})
    y = istek(p, "GET", f"/pay/success.php?order={s.no}&dil=nl", cerez=s.cerez_basligi())
    kontrol(y.kod == 200 and th("nl", "succ_paid_t") in y.metin, f"cerezli: paid sayfasi: {yanit_h1(y)}")
    kontrol(h_php(th("nl", "succ_paid_d", rest="97,15 €")) in y.metin, "paid sayfasinda kalan tutar 97,15 €")
    kontrol('name="robots" content="noindex,nofollow"' in y.metin and "http-equiv=\"refresh\"" not in y.metin, "paid: noindex, yenileme yok")
    # cerezsiz -> liste yedegi
    y = istek(p, "GET", f"/pay/success.php?order={s.no}&dil=nl")
    kontrol(y.kod == 200 and th("nl", "succ_paid_t") in y.metin, "cerezsiz: liste yedegiyle paid sayfasi")
    # dil parametresi yanlis olsa da musterinin siparis dili (metadata.l) kullanilir
    y = istek(p, "GET", f"/pay/success.php?order={s.no}&dil=en", cerez=s.cerez_basligi())
    kontrol(th("nl", "succ_paid_t") in y.metin, "siparis dili metadata'dan (nl) alinmali")
    # sahte imzali cerez yok sayilir, sayfa yine dogru (liste yedegi)
    sahte = "et_p=" + s.id + "." + "0" * 64
    y = istek(p, "GET", f"/pay/success.php?order={s.no}&dil=nl", cerez=sahte)
    kontrol(y.kod == 200 and th("nl", "succ_paid_t") in y.metin, "sahte imzali cerez yok sayilir, yedek calisir")
    # baska siparisin GECERLI cerezi bu siparisi gostermez
    s_b = siparis_olustur("A")
    y = istek(p, "GET", f"/pay/success.php?order={s.no}&dil=nl", cerez=s_b.cerez_basligi())
    kontrol(th("nl", "succ_paid_t") in y.metin and s_b.no not in y.metin, "baska siparis cerezi karismamali")

    # ---- 100'un disina dusmus siparis: yalniz cerez bulur
    mock_sifirla()
    hedef = siparis_olustur("A")
    mock("POST", f"/__test/paid/{hedef.id}", {})
    for _ in range(101):
        istek(MOCK, "GET", "/__test/state")  # (bosluk) mock hizli kalsin
        mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "1.00"}, "description": "dolgu",
                                        "redirectUrl": "https://x.be/a", "metadata": {"dolgu": 1}})
    y = istek(p, "GET", f"/pay/success.php?order={hedef.no}&dil=nl", cerez=hedef.cerez_basligi())
    kontrol(th("nl", "succ_paid_t") in y.metin, "100'un disindaki siparis: cerez dogrudan odemeyi bulur")
    y = istek(p, "GET", f"/pay/success.php?order={hedef.no}&dil=nl")
    kontrol(y.kod == 200 and th("nl", "succ_pending_t") in y.metin and th("nl", "succ_paid_t") not in y.metin,
            "cerezsiz + listede yok: genel 'isleniyor' sayfasi (404 yok)")
    y = istek(p, "GET", f"/pay/success.php?order={hedef.no}&dil=nl", cerez="et_p=" + hedef.id + "." + "a" * 64)
    kontrol(y.kod == 200 and th("nl", "succ_paid_t") not in y.metin, "sahte cerezle 100'un disindaki siparis gosterilmez")

    # ---- open -> 'isleniyor', 'basarisiz' YOK (4 dilde)
    mock_sifirla()
    for dil in DILLER:
        so = siparis_olustur("A", dil=dil)
        y = istek(p, "GET", f"/pay/success.php?order={so.no}&dil={dil}", cerez=so.cerez_basligi())
        kontrol(y.kod == 200 and th(dil, "succ_pending_t") in y.metin, f"[{dil}] open: 'isleniyor' basligi")
        kontrol(th(dil, "succ_fail_t") not in y.metin and th(dil, "succ_fail_d") not in y.metin, f"[{dil}] open: 'basarisiz' metni OLMAMALI")
        kontrol(re.search(r'<meta http-equiv="refresh" content="6;url=/pay/success\.php\?order=' + so.no, y.metin) is not None,
                f"[{dil}] open: 6 sn meta refresh ve ayni sayfaya donus")
        kontrol("basarisiz" not in y.metin.lower(), f"[{dil}] sayfada 'basarisiz' kelimesi olmamali")
    # tr'de Turkce 'başarısız' ifadeleri de yok
    so = siparis_olustur("A", dil="tr")
    y = istek(p, "GET", f"/pay/success.php?order={so.no}&dil=tr", cerez=so.cerez_basligi())
    kontrol("başarısız" not in y.metin.lower() and "tamamlanamadı" not in y.metin, "tr open sayfasinda 'basarisiz/tamamlanamadi' yok")
    # yenileme sayaci: n=40'ta durur
    y = istek(p, "GET", f"/pay/success.php?order={so.no}&dil=tr&n=39", cerez=so.cerez_basligi())
    kontrol("n=40" in y.metin, "yenileme sayaci artar")
    y = istek(p, "GET", f"/pay/success.php?order={so.no}&dil=tr&n=40", cerez=so.cerez_basligi())
    kontrol("http-equiv=\"refresh\"" not in y.metin, "n=40'ta otomatik yenileme durmali")
    y = istek(p, "GET", f"/pay/success.php?order={so.no}&dil=tr&n=abc", cerez=so.cerez_basligi())
    kontrol(y.kod == 200 and "n=1" in y.metin, "bozuk n sifir sayilir")

    # ---- failed / expired / canceled -> basarisiz sayfasi (yeniden dene + WhatsApp)
    for durum in ["failed", "expired", "canceled"]:
        for dil in ["fr", "tr"]:
            sf = siparis_olustur("A", dil=dil)
            mock("POST", f"/__test/{durum}/{sf.id}?webhook=0", {})
            y = istek(p, "GET", f"/pay/success.php?order={sf.no}&dil={dil}", cerez=sf.cerez_basligi())
            kontrol(y.kod == 200 and th(dil, "succ_fail_t") in y.metin and th(dil, "succ_pending_t") not in y.metin,
                    f"[{dil}/{durum}] basarisiz sayfasi")
            kontrol(h_php(th(dil, "succ_retry")) in y.metin and "wa.me/" in y.metin and h_php(th(dil, "succ_wa")) in y.metin,
                    f"[{dil}/{durum}] 'yeniden dene' + WhatsApp dugmeleri")
            kontrol(f'href="/{dil}/#rezervasyon"' in y.metin, f"[{dil}/{durum}] yeniden dene baglantisi formu gosterir")

    # ---- bulunamayan / bozuk order: temiz sayfa
    y = istek(p, "GET", "/pay/success.php?order=ET-260101-ZZZZZZ&dil=en")
    kontrol(y.kod == 200 and th("en", "succ_pending_t") in y.metin and "wa.me/" in y.metin and 'http-equiv="refresh"' in y.metin,
            "bilinmeyen (gecerli bicimli) order: genel 'isleniyor' + iletisim + yenileme, 404 yok")
    for kotu in ["bozuk", "../../etc/passwd", "ET-1-2", "et-260101-abcdef", "ET-260101-ABCDEF%0d%0aX", "%3Cscript%3Ealert(1)%3C/script%3E", ""]:
        y = istek(p, "GET", f"/pay/success.php?order={kotu}&dil=en")
        kontrol(y.kod == 200 and th("en", "succ_pending_t") in y.metin and "<script" not in y.metin.lower() and 'http-equiv="refresh"' not in y.metin,
                f"bozuk order '{kotu}': temiz sayfa (yansitma yok, yenileme yok)")
    y = istek(p, "GET", "/pay/success.php")
    kontrol(y.kod == 200 and th("fr", "succ_pending_t") in y.metin, "order parametresi yok: temiz fr sayfasi")
    y = istek(p, "POST", "/pay/success.php", {"order": "x"})
    kontrol(y.kod == 405, "success: POST 405")
    # Mollie ulasilamiyorsa 'basarisiz' DENMEZ
    mock_sifirla()
    sm = siparis_olustur("A", dil="fr")
    mock("POST", f"/__test/paid/{sm.id}", {})
    mock("POST", "/__test/mollie_fail/5", {})
    y = istek(p, "GET", f"/pay/success.php?order={sm.no}&dil=fr", cerez=sm.cerez_basligi())
    kontrol(y.kod == 200 and th("fr", "succ_pending_t") in y.metin and th("fr", "succ_fail_t") not in y.metin, "Mollie 500: 'isleniyor' (basarisiz DEGIL)")
    mock("POST", "/__test/mollie_fail/0", {})


# ------------------------------------------------------------------ 4. fiyat tahrifati
def senaryo_fiyat_tahrifati():
    print("— 4. fiyat tahrifati / km karari (Google yok, dahili tablo)")
    mock_sifirla()
    def dene(**ek):
        n0 = len(odemeler())
        s = siparis_olustur("A", **ek)
        return s, len(odemeler()) - n0

    s, _ = dene(km="1")
    kontrol(s is not None and s.odeme["amount"]["value"] == "24.29" and s.meta["k"] == 56, "km=1 (Gent->BRU) -> sunucu 56 km kullanir (24.29)")
    s, _ = dene(km="50")
    kontrol(s is not None and s.meta["k"] == 50 and s.odeme["amount"]["value"] == "21.90", f"km=50 (56'nin %10.7 alti) -> istemci kabul (21.90): {s.odeme['amount'] if s else siparis_olustur.son.kod}")
    s, _ = dene(km="49")
    kontrol(s is not None and s.meta["k"] == 56 and s.odeme["amount"]["value"] == "24.29", "km=49 (%12.5 alti) -> 56")
    s, _ = dene(km="100")
    kontrol(s is not None and s.meta["k"] == 100 and s.odeme["amount"]["value"] == "41.80", "istemci daha yuksekse (100) kabul edilir")
    # taninmayan adres + Google yok -> 422 + WhatsApp yonlendirmesi
    n0 = len(odemeler())
    y = istek(PORT["A"], "POST", "/pay/create.php", form(alis="Xyz Straat 1", km="30"))
    kontrol(y.kod == 422 and h_php(th("nl", "err_km_wa")) in y.metin, f"taninmayan adres -> 422 err_km ({y.kod})")
    kontrol("wa.me/" in y.metin and h_php(th("nl", "succ_wa")) in y.metin, "422 sayfasi WhatsApp'a yonlendirmeli")
    kontrol(len(odemeler()) == n0, "reddedilen istekte odeme OLUSMAMALI")
    # ayni yer iki uc
    y = istek(PORT["A"], "POST", "/pay/create.php", form(alis="Gent", varis="Ghent", km="10"))
    kontrol(y.kod == 422, "alis ve varis ayni yerse dogrulanamaz -> 422")
    # gecersiz km degerleri
    for kotu in ["0", "-5", "801", "9999", "abc", "", "56.5", "1e2", "٥٦"]:
        y = istek(PORT["A"], "POST", "/pay/create.php", form(km=kotu))
        kontrol(y.kod == 422 and h_php(th("nl", "err_km")) in y.metin, f"km={kotu!r} -> 422 err_km ({y.kod})")
    y = istek(PORT["A"], "POST", "/pay/create.php", {k: v for k, v in form().items() if k != "km"})
    kontrol(y.kod == 422 and h_php(th("nl", "err_km")) in y.metin, "km alani yok -> 422")
    kontrol(len(odemeler()) == n0, "km reddi odeme olusturmamali")
    # sahte fiyat alanlari YOK SAYILIR
    s = siparis_olustur("A", toplam="1.00", fiyat="1", kapora="0.01", tutar="0.10", price="1", amount="1.00", total="1")
    kontrol(s is not None and s.odeme["amount"]["value"] == "24.29" and s.meta["t"] == 121.44, "sahte toplam/fiyat/kapora/tutar alanlari YOK SAYILMALI")
    # sinir degerleri
    s, _ = dene(km="800", alis="Gent", varis="Luxembourg")
    kontrol(s is not None and s.meta["k"] == 800 and s.odeme["amount"]["value"] == "320.40", f"km=800 sinir kabul: {s.odeme['amount'] if s else None}")
    s, _ = dene(km="1", alis="Gent", varis="Luxembourg")
    kontrol(s is not None and s.meta["k"] == 275, "km=1 Gent->Luxembourg -> haversine yedegi 275")


# ------------------------------------------------------------------ 5. Google
def senaryo_google():
    print("— 5. Google Distance Matrix saglayicisi (mock)")
    mock_sifirla()
    p = PORT["B"]
    def olustur(**ek):
        y = istek(p, "POST", "/pay/create.php", form(**ek))
        if y.kod != 303:
            return None, y
        m = re.search(r"/checkout/(tr_[A-Za-z0-9]+)$", y.baslik("location"))
        return Sip(y, mollie_ham("GET", "payments/" + m.group(1))[1]), y
    mock("POST", "/__test/google/set?meters=56400", {})
    s, y = olustur(km="30")
    kontrol(s is not None and s.meta["k"] == 56 and s.meta["src"] == "g" and s.odeme["amount"]["value"] == "24.29",
            f"google 56.4 km -> 56 kullanilir, src=g ({s.meta if s else y.kod})")
    log = mock("GET", "/__test/google/log")["istekler"]
    kontrol(len(log) >= 1 and log[-1]["key_var"] is True and "Gent" in (log[-1]["origins"] or "") and "Brussels Airport" in (log[-1]["destinations"] or ""),
            f"Google istegi anahtarli ve adresli olmali: {log[-1:] }")
    s, y = olustur(km="55")
    kontrol(s is not None and s.meta["k"] == 55 and s.odeme["amount"]["value"] == "23.89" and s.meta["src"] == "g", "istemci google'a yakin (55 vs 56) -> istemci kalir")
    s, y = olustur(km="49")
    kontrol(s is not None and s.meta["k"] == 56, "google varken istemci uzaksa google (49 vs 56)")
    # Google tanidigi (tabloda olmayan) adresi de dogrular
    s, y = olustur(km="56", alis="Rue Inconnue 5, Petite Ville", varis="Autre Lieu 9, Nulle Part")
    kontrol(s is not None and s.meta["k"] == 56 and s.meta["src"] == "g", "Google varken tabloda olmayan adresler de kabul edilir")
    # Google hatalari -> dahili katmana dus
    for ad, ayar in [("REQUEST_DENIED", "status=REQUEST_DENIED"), ("element NOT_FOUND", "element=NOT_FOUND"),
                     ("http 500", "http=500"), ("0 metre", "meters=0"), ("ZERO_RESULTS", "element=ZERO_RESULTS")]:
        mock("POST", "/__test/google/reset", {})
        mock("POST", "/__test/google/set?" + ayar, {})
        s, y = olustur(km="1")
        kontrol(s is not None and s.meta["k"] == 56 and s.meta["src"] == "d", f"Google {ad}: dahili tabloya dusulur (km=1 -> 56, src=d) ({s.meta if s else y.kod})")
        s, y = olustur(km="30", alis="Xyz Straat 1")
        kontrol(s is None and y.kod == 422, f"Google {ad} + taninmayan adres -> 422 ({y.kod})")
    mock("POST", "/__test/google/reset", {})
    # Google sonucu 800 km'yi asarsa RET
    mock("POST", "/__test/google/set?meters=900000", {})
    s, y = olustur(km="56")
    kontrol(s is None and y.kod == 422, f"Google 900 km -> RET 422 ({y.kod})")
    mock("POST", "/__test/google/reset", {})
    # Google ULASILAMAZ (baglanti reddi) -> dahili katman
    mock("POST", "/__test/google/set?http=503", {})
    s, y = olustur(km="1")
    kontrol(s is not None and s.meta["k"] == 56, "Google 503 -> dahili")
    mock("POST", "/__test/google/reset", {})
    kontrol(GOOGLE_ANAHTAR not in log_oku("B"), "Google anahtari sunucu loguna YAZILMAMALI")
    kontrol(GOOGLE_ANAHTAR not in y.metin, "Google anahtari yanita sizmamali")


# ------------------------------------------------------------------ 6. dogrulama matrisi
def senaryo_dogrulama():
    print("— 6. dogrulama matrisi (temiz 4xx + dilde mesaj)")
    mock_sifirla()
    p = PORT["A"]
    n0 = len(odemeler())

    def kotu(dil, anahtar, kod=422, **ek):
        y = istek(p, "POST", "/pay/create.php", form(dil=dil, **ek))
        mesaj = h_php(t(dil, anahtar))
        kontrol(y.kod == kod and mesaj in y.metin and "Traceback" not in y.metin,
                f"[{dil}] {ek} -> {kod}/{anahtar} beklenirdi, {y.kod}: {yanit_h1(y)!r}")
        kontrol(th(dil, "err_t") in y.metin and f'href="/{dil}/#rezervasyon"' in y.metin, f"[{dil}] hata sayfasi basligi ve geri baglantisi")
        return y

    kotu("nl", "val_email", eposta="jan@voorbeeld")
    kotu("fr", "val_email", eposta="jan.voorbeeld.be")
    kotu("en", "val_email", eposta="a b@c.be")
    kotu("tr", "val_email", eposta="jan@x.be\r\nBcc: kotu@example.com")           # CRLF baslik enjeksiyonu
    kotu("nl", "val_email", eposta="jan@x.be\nBcc: kotu@example.com")
    kotu("fr", "val_email", eposta="a" * 95 + "@x.be")
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
    kotu("nl", "val_date", tarih=tarih(10), donus_tarih=tarih(9), donus_saat="10:00")           # donus < gidis
    kotu("fr", "val_date", tarih=tarih(10), saat="14:30", donus_tarih=tarih(10), donus_saat="13:00")
    kotu("tr", "val_date", tarih=tarih(10), donus_tarih=tarih(11), donus_saat="24:00")
    kotu("nl", "val_route", alis="")
    kotu("fr", "val_route", varis="   ")
    kotu("en", "val_route", alis="Gent" + "x" * 200)                                 # 204 karakter: kirpma yok, RET
    kotu("tr", "val_route", varis="Brussels Airport " + "y" * 120)
    kotu("nl", "err_km", km="abc")
    # dizi / tekrar eden alanlar
    for ad, govde, anahtar in [
        ("alis[]", "alis%5B%5D=x&" + urllib.parse.urlencode(form()), "val_route"),
        ("alis tekrar", urllib.parse.urlencode(form()) + "&alis=Baska", "val_route"),
        ("eposta[]", urllib.parse.urlencode(form()) + "&eposta%5B%5D=a%40b.be", "val_email"),
        ("km tekrar", urllib.parse.urlencode(form()) + "&km=1", "err_km"),
        ("ad[k]", urllib.parse.urlencode(form()) + "&ad%5Bk%5D=x", "val_name"),
    ]:
        y = istek(p, "POST", "/pay/create.php", ham=govde)
        kontrol(y.kod == 400 and h_php(th("nl", anahtar)) in y.metin, f"{ad}: temiz 400 + mesaj ({y.kod})")
    y = istek(p, "POST", "/pay/create.php", ham="alis%5B%5D=x&varis%5B%5D=y&dil=fr")
    kontrol(y.kod in (400, 422), f"yalniz dizi alanlari: temiz 4xx ({y.kod})")
    kontrol(len(odemeler()) == n0, f"reddedilen isteklerde odeme olusmamali ({len(odemeler()) - n0} adet olustu)")

    # ---- GECERLI ama temizlenen girdiler
    s = siparis_olustur("A", ad="Jan" + chr(0) + chr(9) + "  Peeters", telefon="0470" + chr(0) + "112233", alis="Korenmarkt" + chr(13) + chr(10) + "77, Gent")
    kontrol(s is not None and s.meta["u"] == "Jan Peeters" and s.meta["h"] == "0470 112233" and s.meta["a"] == "Korenmarkt 77, Gent",
            f"kontrol karakterleri atilir/bosluga cevrilir: {s.meta if s else siparis_olustur.son.kod}")
    s = siparis_olustur("A", eposta="jan@voorbeeld.be\r\n")
    kontrol(s is not None and s.meta["e"] == "jan@voorbeeld.be", "sondaki satir sonu kirpilir")
    s = siparis_olustur("A", yolcu="99", buyuk="-3", kucuk="9", arac="bus")
    kontrol(s is not None and (s.meta["p"], s.meta["g"], s.meta["s"], s.meta["c"]) == (7, 0, 4, "eco"), f"yan alanlar sinirlanir: {s.meta if s else None}")
    # 120 karakterlik adresler kabul (sinir)
    s = siparis_olustur("A", alis="Gent " + "a" * 115, varis="Brussels Airport " + "b" * 103, km="56")
    kontrol(s is not None and len(s.meta["a"]) == 120 and len(s.meta["b"]) == 120, "120 karakter adresler kabul edilir")
    # metadata boyutu: alanlari kirp, ASLA hata verme (tirnaklar JSON'da ikiye katlanir, Unicode cok bayt)
    uzun_eposta = "a" * 40 + "@" + "b" * 40 + ".be"
    agir = form(alis="Gent " + '"' * 115, varis="Brussels Airport " + chr(0x65E5) * 103, ad='"' * 80, eposta=uzun_eposta, km="56")
    y = istek(p, "POST", "/pay/create.php", agir)
    kontrol(y.kod == 303, f"agir metadata: create yine 303 olmali ({y.kod})")
    if y.kod == 303:
        m = re.search(r"/checkout/(tr_[A-Za-z0-9]+)$", y.baslik("location"))
        meta = mollie_ham("GET", "payments/" + m.group(1))[1]["metadata"]
        b = len(json.dumps(meta, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        kontrol(b <= 900, f"agir metadata {b} bayt (<=900 olmali)")
        kontrol(meta["e"] == uzun_eposta and meta["h"] == "+32 470 11 22 33" and meta["k"] == 56 and meta["t"] == 121.44 and meta["d"] == tarih(10) + "T14:30",
                "kirpmada e-posta/telefon/km/tarih korunur")
        kontrol(meta["a"].startswith("Gent") and len(meta["a"]) < 120 and len(meta["u"]) <= 80, f"once adresler kirpilir ({len(meta['a'])}/{len(meta['b'])}/{len(meta['u'])})")
    cok_bayt = form(alis="Gent " + "é" * 115, varis="Brussels Airport " + "€" * 100, ad="日" * 80, km="56")
    y = istek(p, "POST", "/pay/create.php", cok_bayt)
    kontrol(y.kod == 303, f"cok baytli karakterler: create 303 ({y.kod})")
    if y.kod == 303:
        m = re.search(r"/checkout/(tr_[A-Za-z0-9]+)$", y.baslik("location"))
        meta = mollie_ham("GET", "payments/" + m.group(1))[1]["metadata"]
        kontrol(len(json.dumps(meta, separators=(",", ":"), ensure_ascii=False).encode("utf-8")) <= 900, "cok baytli metadata <=900 bayt")


# ------------------------------------------------------------------ 6b. iptal / idem / pipe
def senaryo_iptal_idem_pipe():
    print("— 6b. iptal onayi (sunucuda zorunlu), idem (Idempotency-Key), '|' enjeksiyonu")
    mock_sifirla()
    p = PORT["A"]
    # ---- iptal=1 zorunlu
    n0 = len(odemeler())
    for ad, ek in [("alan yok", None), ("iptal=0", "0"), ("bos", ""), ("on", "on"), ("true", "true"), ("11", "11"), ("01", "01"),
                   ("bosluklu ' 1'", " 1"), ("sonda bosluk '1 '", "1 ")]:
        f = form()
        if ek is None:
            del f["iptal"]
        else:
            f["iptal"] = ek
        y = istek(p, "POST", "/pay/create.php", f)
        kontrol(y.kod == 422 and th("nl", "val_cancel") in y.metin and y.baslik("location") is None and y.cerez("et_p") is None,
                f"iptal {ad}: 422 val_cancel beklenirdi ({y.kod}: {yanit_h1(y)!r})")
    kontrol(len(odemeler()) == n0, "iptal onayi yokken odeme OLUSMAMALI")
    for dil in DILLER:
        y = istek(p, "POST", "/pay/create.php", form(dil=dil, iptal="0"))
        kontrol(y.kod == 422 and th(dil, "val_cancel") in y.metin and th(dil, "err_t") in y.metin and f'href="/{dil}/#rezervasyon"' in y.metin,
                f"[{dil}] iptal reddi dilde mesaj + geri baglantisi ({y.kod})")
    # tekrar eden / dizi iptal alani -> 400 (val_cancel mesaji)
    for ad, ek in [("tekrar", "&iptal=1"), ("dizi", "&iptal%5B%5D=1"), ("anahtarli dizi", "&iptal%5Bx%5D=1")]:
        y = istek(p, "POST", "/pay/create.php", ham=urllib.parse.urlencode(form()) + ek)
        kontrol(y.kod == 400 and th("nl", "val_cancel") in y.metin, f"iptal {ad}: 400 val_cancel ({y.kod})")
    # siralama: once girdi dogrulamasi, sonra iptal, sonra km karari (Google)
    y = istek(p, "POST", "/pay/create.php", form(eposta="gecersiz", iptal="0"))
    kontrol(y.kod == 422 and th("nl", "val_email") in y.metin, "gecersiz e-posta + iptal yok: ilk hata e-posta (dogrulama once)")
    y = istek(p, "POST", "/pay/create.php", form(alis="Xyz Straat 1", km="30", iptal="0"))
    kontrol(y.kod == 422 and th("nl", "val_cancel") in y.metin and "wa.me/" not in y.metin, "km dogrulanamiyor + iptal yok: iptal mesaji (km karari iptalden SONRA)")
    y = istek(p, "POST", "/pay/create.php", form(km="0", iptal="0"))
    kontrol(y.kod == 422 and th("nl", "err_km") in y.metin, "km gecersiz + iptal yok: km hatasi (dogrulama iptalden once)")
    mock("POST", "/__test/google/reset", {})
    yb = istek(PORT["B"], "POST", "/pay/create.php", form(iptal="0"))
    kontrol(yb.kod == 422 and mock("GET", "/__test/google/log")["istekler"] == [], "iptal reddi Google'i CAGIRMAZ")
    kontrol(len(odemeler()) == n0, "reddedilen isteklerde odeme yok")
    s = siparis_olustur("A")
    kontrol(s is not None, "iptal=1 ile create calisir")
    # iptal onayi zaman damgasi gerekmez: siparis/success/orders akisi normal
    mock("POST", f"/__test/paid/{s.id}", {})
    y = istek(p, "GET", f"/pay/success.php?order={s.no}&dil=nl", cerez=s.cerez_basligi())
    kontrol(t("nl", "succ_paid_t") in y.metin, "iptal'li siparis: success akisi normal")
    oturum = istek(p, "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE}).cerez("et_a").split(";")[0]
    kontrol(s.no in istek(p, "GET", "/pay/orders.php", cerez=oturum).metin, "iptal'li siparis: orders akisi normal")

    # ---- idem: istemci belirteci Idempotency-Key olarak Mollie'ye gider
    mock_sifirla()
    gecerli_govde = {"amount": {"currency": "EUR", "value": "1.00"}, "description": "x", "redirectUrl": "https://x.be/a"}
    idem = "abcd1234-ef56-7890-abcd-1234567890ab"
    n0 = len(odemeler())
    a = siparis_olustur("A", idem=idem)
    n1 = len(odemeler())
    b = siparis_olustur("A", idem=idem)
    yb = siparis_olustur.son
    kontrol(a is not None and n1 == n0 + 1, "idem'li ilk create bir odeme yaratir")
    kontrol(mollie_ham("POST", "payments", gecerli_govde, baslik={"Idempotency-Key": idem})[1].get("id") == (a.id if a else None),
            "istemci idem tokeni AYNEN Idempotency-Key olarak Mollie'ye gitti")
    kontrol(b is None and yb.kod == 502 and th("nl", "err_pay") in yb.metin, f"ayni idem ile ikinci create: baska siparisin odemesi DONMEMELI, temiz hata ({yb.kod})")
    kontrol(yb.baslik("location") is None and yb.cerez("et_p") is None, "idem tekrarinda yonlendirme ve et_p cerezi OLMAMALI")
    kontrol(len(odemeler()) == n1, "ayni idem ikinci odeme yaratmadi")
    kontrol(a is not None and a.yanit.kod == 303 and a.cerez is not None and a.meta["n"] == a.no, "ilk odeme (ve cerezi) bozulmadi")
    if a is not None:
        r = mock("POST", f"/__test/paid/{a.id}", {})
        kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 2, "idem tekrarindan sonra ILK odeme normal ilerler: webhook + 2 e-posta")
        y = istek(p, "GET", f"/pay/success.php?order={a.no}&dil=nl", cerez=a.cerez_basligi())
        kontrol(t("nl", "succ_paid_t") in y.metin, "ilk odemenin success sayfasi paid")
    # varsayilan anahtar 'et-<siparis no>'
    s = siparis_olustur("A")
    kontrol(s is not None and mollie_ham("POST", "payments", gecerli_govde, baslik={"Idempotency-Key": "et-" + s.no})[1].get("id") == s.id,
            "idem yoksa Idempotency-Key = 'et-<siparis no>'")
    # gecersiz idem YOK SAYILIR (create yine calisir, anahtar et-<no>)
    for ad, kotu in [("kisa", "kisa"), ("65 karakter", "a" * 65), ("alt cizgi", "abc_def_ghi_jkl_mno"), ("CRLF", "abcdefghijklmnop\r\nX-Kotu: 1"),
                     ("bosluk", "abcdefghij klmnopqrst"), ("15 karakter", "a" * 15), ("ASCII disi", "abcdefghijklmn" + chr(0xE9) + "o")]:
        s = siparis_olustur("A", idem=kotu)
        kontrol(s is not None and mollie_ham("POST", "payments", gecerli_govde, baslik={"Idempotency-Key": "et-" + s.no})[1].get("id") == s.id,
                f"gecersiz idem ({ad}) yok sayilir; Idempotency-Key et-<no>")
    for uz in (16, 64):
        s = siparis_olustur("A", idem="k" * uz)
        kontrol(s is not None and mollie_ham("POST", "payments", gecerli_govde, baslik={"Idempotency-Key": "k" * uz})[1].get("id") == s.id, f"{uz} karakterlik idem kabul")
    # tekrar eden / dizi idem alani -> 400
    for ad, ek in [("tekrar", "&idem=" + "b" * 20), ("dizi", "&idem%5B%5D=" + "b" * 20)]:
        y = istek(p, "POST", "/pay/create.php", ham=urllib.parse.urlencode(form(idem="a" * 20)) + ek)
        kontrol(y.kod == 400 and th("nl", "err_pay") in y.metin, f"idem {ad}: 400 ({y.kod})")
    # Mollie ayni anahtarla farkli govde/hata dondururse (kod != 201) temiz hata
    mock("POST", "/__test/mollie_fail/1", {})
    y = istek(p, "POST", "/pay/create.php", form(idem="z" * 20))
    kontrol(y.kod == 502 and y.cerez("et_p") is None, "Mollie hatasi: temiz 502, cerez yok")

    # ---- '|' (pipe): reddedilir, Google'a HIC gidilmez
    mock_sifirla()
    n0 = len(odemeler())
    for alan, deger in [("alis", "Gent|Brussels Airport"), ("varis", "Brussels Airport|Antwerpen"), ("alis", "|"), ("varis", "Gent |"),
                        ("alis", "Gent" + chr(13) + chr(10) + "|Evil"), ("alis", "Gent (|)")]:
        y = istek(p, "POST", "/pay/create.php", form(**{alan: deger}))
        kontrol(y.kod == 422 and th("nl", "val_route") in y.metin, f"{alan}={deger!r}: 422 val_route ({y.kod})")
    mock("POST", "/__test/google/set?meters=56400", {})
    for alan, deger in [("alis", "Gent|Evil"), ("varis", "Brussels Airport|Antwerpen")]:
        y = istek(PORT["B"], "POST", "/pay/create.php", form(**{alan: deger}))
        kontrol(y.kod == 422 and th("nl", "val_route") in y.metin, f"B: {alan} '|' -> 422 ({y.kod})")
    kontrol(mock("GET", "/__test/google/log")["istekler"] == [], "'|' iceren adres icin Google'a HIC istek gitmemeli")
    kontrol(len(odemeler()) == n0, "'|' reddi odeme olusturmamali")
    # normal adres: Google'a GIDER (savunma mesru istegi engellemez)
    s = istek(PORT["B"], "POST", "/pay/create.php", form())
    kontrol(s.kod == 303 and len(mock("GET", "/__test/google/log")["istekler"]) == 1, "'|' icermeyen adres Google'a gider")
    mock("POST", "/__test/google/reset", {})


# ------------------------------------------------------------------ 7. koruma
def senaryo_koruma():
    print("— 7. koruma: Origin, honeypot, metod, oran siniri, govde siniri")
    mock_sifirla()
    p = PORT["A"]
    n0 = len(odemeler())
    y = istek(p, "POST", "/pay/create.php", form(), origin="https://evil.example")
    kontrol(y.kod == 403 and len(odemeler()) == n0, f"yanlis Origin -> 403, odeme yok ({y.kod})")
    y = istek(p, "POST", "/pay/create.php", form(), origin=None, baslik={"Referer": "https://evil.example/sayfa"})
    kontrol(y.kod == 403, f"yanlis Referer -> 403 ({y.kod})")
    y = istek(p, "POST", "/pay/create.php", form(), origin=f"http://127.0.0.1:{p}", baslik={"Referer": "https://evil.example/x"})
    kontrol(y.kod == 403, "Origin dogru ama Referer yanlis -> 403")
    y = istek(p, "POST", "/pay/create.php", form(), origin="not a url")
    kontrol(y.kod == 403, "cozulemeyen Origin -> 403")
    y = istek(p, "POST", "/pay/create.php", form(), origin=f"http://127.0.0.1:{p}", baslik={"Referer": f"http://127.0.0.1:{p}/fr/"})
    kontrol(y.kod == 303, f"dogru Origin + Referer -> 303 ({y.kod})")
    y = istek(p, "POST", "/pay/create.php", form(), origin=None)
    kontrol(y.kod == 303, "Origin/Referer yoksa izin verilir (tarayici disi istemci)")
    y = istek(p, "POST", "/pay/create.php", form(), origin="null")
    kontrol(y.kod == 303, "Origin: null (no-referrer sayfa) yok sayilir, izin verilir")
    # SITE_URL host'u ile eslesen Origin (Host farkli olsa da) — sunucu C'de SITE_URL https://europetaxi24.be
    y = istek(PORT["C"], "POST", "/pay/create.php", form(), origin="https://europetaxi24.be")
    kontrol(y.kod == 303, "Origin = SITE_URL host'u -> izin")
    y = istek(PORT["C"], "POST", "/pay/create.php", form(), origin="https://www.europetaxi24.be", baslik={"Host": "www.europetaxi24.be"})
    kontrol(y.kod == 303, "Origin = istegin Host'u -> izin")
    y = istek(PORT["C"], "POST", "/pay/create.php", form(), origin="https://baska.example", baslik={"Host": "europetaxi24.be"})
    kontrol(y.kod == 403, "Origin ne SITE_URL ne Host ile eslesirse 403")
    # honeypot
    n1 = len(odemeler())
    y = istek(p, "POST", "/pay/create.php", form(web="http://spam.example"))
    kontrol(y.kod == 200 and y.metin.strip() == "tamam" and len(odemeler()) == n1, f"honeypot: sessizce 200 'tamam', odeme YOK ({y.kod} {y.metin[:30]!r})")
    y = istek(p, "POST", "/pay/create.php", form(web=""))
    kontrol(y.kod == 303, "bos honeypot -> normal akis")
    # metodlar
    for yontem in ["GET", "PUT", "DELETE", "PATCH", "OPTIONS"]:
        y = istek(p, yontem, "/pay/create.php")
        kontrol(y.kod == 405 and (y.baslik("allow") or "") == "POST", f"{yontem} -> 405 + Allow: POST ({y.kod})")
    # icerik turu / govde siniri
    y = istek(p, "POST", "/pay/create.php", ham=json.dumps(form()), tip="application/json")
    kontrol(y.kod == 415, f"JSON govde -> 415 ({y.kod})")
    y = istek(p, "POST", "/pay/create.php", ham="a=" + "x" * 70000)
    kontrol(y.kod == 413, f"70 KB govde -> 413 ({y.kod})")
    y = istek(p, "POST", "/pay/create.php", ham="a=" + "x" * 65000)
    kontrol(y.kod != 413, "65000 bayt (<64 KB) govde 413 olmamali")
    # oran siniri: ayni IP, dakikada 5
    ip = "10.250.1.1"
    kodlar = [istek(p, "POST", "/pay/create.php", form(eposta="gecersiz"), ip=ip).kod for _ in range(6)]
    kontrol(kodlar == [422] * 5 + [429], f"dakikada 5'i asan -> 429: {kodlar}")
    y = istek(p, "POST", "/pay/create.php", form(eposta="gecersiz"), ip=ip)
    kontrol(y.kod == 429 and (y.baslik("retry-after") or "").isdigit() and 1 <= int(y.baslik("retry-after")) <= 60,
            f"429 + Retry-After (1..60): {y.baslik('retry-after')}")
    kontrol(h_php(th("nl", "err_rate")) in y.metin, "429 sayfasi dilde mesaj verir (err_rate)")
    y = istek(p, "POST", "/pay/create.php", form(eposta="gecersiz"), ip="10.250.1.2")
    kontrol(y.kod == 422, "baska IP etkilenmez")
    y = istek(p, "POST", "/pay/create.php", form(eposta="gecersiz"), ip="10.250.1.3, 1.2.3.4")
    kontrol(y.kod == 422, "x-forwarded-for: ilk deger kullanilir")
    # birim testler (sahte zamanla): saatte 30, kaba kuvvet
    pr = node_calistir(LIMIT_JS, str(CIKTI))
    kontrol(pr.returncode == 0, "limit birim testi calismadi: " + pr.stderr[:300])
    if pr.returncode == 0:
        o = json.loads(pr.stdout)
        kontrol(o["ilk5"] == [True] * 5 and o["altinci"] is False and 1 <= o["altinciBekleme"] <= 60, f"OranSiniri dakikada 5: {o}")
        kontrol(o["baskaIp"] is True and o["birDkSonra"] is True, "OranSiniri: baska IP ve 1 dk sonra izin")
        kontrol(o["saat30Gecen"] is True and o["otuzBir"] is False and o["otuzBirBekleme"] > 3000 and o["saatSonra"] is True,
                f"OranSiniri saatte 30 (31.'de bekleme ~53 dk): {o}")
        kontrol(o["kayitSayisi"] <= 100, f"OranSiniri bellek siniri ({o['kayitSayisi']})")
        kontrol(o["kk_ilk4"] == [0, 0, 0, 0] and o["kk_5"] > 800 and o["kk_kilitli"] > 0 and o["kk_baskaIp"] == 0 and o["kk_sonra"] == 0,
                f"KabaKuvvet 5 hata -> 15 dk kilit: {o}")
        kontrol(o["kk_temizleSonra"] == 0, "KabaKuvvet.temizle sayaci sifirlar")
        kontrol(o["kimlikBozuk"] == 0, f"istek kimligi 8 onaltilik karakter ve asla tamamen rakam degil ({o['kimlikBozuk']}/50000 bozuk)")


# ------------------------------------------------------------------ 8. webhook
def senaryo_webhook():
    print("— 8. webhook: gecersiz id, tutar uyusmazligi, Brevo/Mollie hatalari, es zamanlilik")
    mock_sifirla()
    p = PORT["A"]
    for gecersiz in ["", "abc", "tr_", "tr_a b", "tr_../x", "TR_abc123", "tr_abc'; DROP", "x" * 5000]:
        y = istek(p, "POST", "/pay/webhook.php", {"id": gecersiz}, ip=None, origin=None)
        kontrol(y.kod == 200 and "gecersiz" in y.metin and not postalar(), f"gecersiz id {gecersiz[:12]!r} -> 200 'gecersiz', e-posta yok ({y.kod})")
    y = istek(p, "POST", "/pay/webhook.php", ham="", ip=None, origin=None)
    kontrol(y.kod == 200 and "gecersiz" in y.metin, "bos govde -> 200 gecersiz")
    y = istek(p, "POST", "/pay/webhook.php", ham='{"id":"tr_abc"}', tip="application/json", ip=None, origin=None)
    kontrol(y.kod == 200 and "gecersiz" in y.metin, "JSON govde -> 200 gecersiz (id okunamaz)")
    y = istek(p, "GET", "/pay/webhook.php?id=tr_abc", ip=None)
    kontrol(y.kod == 405, "webhook GET -> 405")
    # Mollie'de olmayan id
    y = istek(p, "POST", "/pay/webhook.php", {"id": "tr_yokyokyok1"}, ip=None, origin=None)
    kontrol(y.kod == 200 and "yok" in y.metin and not postalar(), f"Mollie'de olmayan id -> 200, e-posta yok ({y.kod} {y.metin!r})")
    # bizim olmayan odeme (metadata yok)
    kod, yabanci = mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "5.00"}, "description": "yabanci",
                                                   "redirectUrl": "https://x.be/a", "webhookUrl": f"http://127.0.0.1:{p}/pay/webhook.php",
                                                   "metadata": {"baska": "sistem"}})
    r = mock("POST", f"/__test/paid/{yabanci['id']}", {})
    kontrol(r["webhook"]["kod"] == 200 and "siparis yok" in r["webhook"]["govde"] and not postalar(), f"yabanci metadata -> e-posta yok ({r['webhook']})")
    # bozuk metadata (km gecersiz)
    s = siparis_olustur("A")
    mock("POST", f"/__test/set_metadata/{s.id}", dict(s.meta, k=99999))
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and not postalar(), "gecersiz km'li metadata -> e-posta yok")
    # tutar uyusmazligi
    s = siparis_olustur("A")
    mock("POST", f"/__test/tamper/{s.id}?amount=1.00", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and "tutar" in r["webhook"]["govde"] and not postalar(), f"tutar uyusmazligi -> e-posta yok ({r['webhook']})")
    kontrol("TUTAR UYUSMUYOR " + s.no in log_oku("A"), "tutar uyusmazligi hata olarak loglanmali")
    # tutar dogru ama para birimi/metadata km'si degistirilmis (kapora km'den yeniden hesaplanir)
    s = siparis_olustur("A")
    mock("POST", f"/__test/set_metadata/{s.id}", dict(s.meta, k=100))   # km 100 -> beklenen kapora 41.80 != 24.29
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and not postalar(), "metadata km'si degisirse (beklenen kapora farkli) e-posta yok")
    mock_sifirla()
    # Brevo 500 -> webhook 500 -> sonraki basarili tekrarda TAM bir kez
    s = siparis_olustur("A")
    mock("POST", "/__test/brevo_fail/1", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 500 and len(postalar()) == 0, f"Brevo 500 -> webhook 500 ({r['webhook']}), e-posta yok")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 2, f"tekrarda basarili: TAM 2 e-posta ({len(postalar())})")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(len(postalar()) == 2, "tekrar tekrar cagrilsa da artmaz")
    # kismi basari: musteri gitti, sirket 500 -> retry yalniz sirketi gonderir (ayni surecte)
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", "/__test/brevo_fail/1?skip=1", {})
    r = mock("POST", f"/__test/paid/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 500 and len(postalar()) == 1 and postalar()[0]["alicilar"] == ["jan@voorbeeld.be"],
            f"kismi basari: musteri e-postasi gitti, webhook 500 ({r['webhook']}, {len(postalar())})")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    P = postalar()
    kontrol(r["webhook"]["kod"] == 200 and len(P) == 2 and sorted(x["alicilar"][0] for x in P) == sorted(["jan@voorbeeld.be", SIRKET_EPOSTA]),
            f"retry yalniz eksik (sirket) e-postayi gonderir; musteri TEKRARLANMAZ ({[x['alicilar'] for x in P]})")
    # Mollie ulasilamaz -> 500, tekrar -> basarili
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s.id}?webhook=0", {})
    mock("POST", "/__test/mollie_fail/1", {})
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 500 and len(postalar()) == 0, f"Mollie 500 -> webhook 500 ({r['webhook']})")
    r = mock("POST", f"/__test/webhook/{s.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 2, "Mollie duzelince tekrar: 2 e-posta")
    # es zamanli iki webhook -> yine 2 e-posta (ayni surecte kilit)
    mock_sifirla()
    s = siparis_olustur("A")
    mock("POST", f"/__test/paid/{s.id}?webhook=0", {})
    mock("POST", "/__test/brevo_delay/300", {})
    sonuclar = []
    def cagir():
        sonuclar.append(mock("POST", f"/__test/webhook/{s.id}", {})["webhook"]["kod"])
    ipler = [threading.Thread(target=cagir) for _ in range(3)]
    for i in ipler:
        i.start()
    for i in ipler:
        i.join()
    mock("POST", "/__test/brevo_delay/0", {})
    kontrol(sonuclar == [200, 200, 200] and len(postalar()) == 2, f"3 es zamanli webhook -> TAM 2 e-posta ({sonuclar}, {len(postalar())})")
    # Brevo anahtari yok (sunucu D): atla, 200, logla
    mock_sifirla()
    sd = siparis_olustur("D")
    r = mock("POST", f"/__test/paid/{sd.id}", {})
    kontrol(r["webhook"]["kod"] == 200 and len(postalar()) == 0, f"BREVO_API_KEY yok: 200 ve e-posta gonderilmez ({r['webhook']})")
    kontrol("BREVO_API_KEY yok: e-posta gonderilemedi" in log_oku("D"), "BREVO_API_KEY yok uyarisi loglanmali")
    # webhook: kotu istisna yolu -> genel 500 (stack yok)
    mock_sifirla()


# ------------------------------------------------------------------ 9. orders
def yonetici_cerezi(bitis_ms, gecerli_imza=True):
    """Testin bildigi sirlarla yonetici oturum cerezi uretir (bicim capraz dogrulamasi)."""
    anahtar = hmac_mod.new(IMZA_SIRRI.encode(), ("admin|" + ADMIN_SIFRE).encode(), hashlib.sha256).hexdigest()
    imza = hmac_mod.new(anahtar.encode(), f"oturum|{bitis_ms}".encode(), hashlib.sha256).hexdigest()
    if not gecerli_imza:
        imza = "0" * 64
    return f"et_a={bitis_ms}.{imza}"


def senaryo_orders():
    print("— 9. orders paneli (giris, kaba kuvvet, XSS, sayfalama, kapali)")
    mock_sifirla()
    p = PORT["A"]
    # veri: odenmis, bekleyen, XSS yuku
    odendi = siparis_olustur("A", ad="Piet Odendi", telefon="+32 470 99 88 77")
    mock("POST", f"/__test/paid/{odendi.id}", {})
    bekleyen = siparis_olustur("A", ad="Bekleyen Kisi", telefon="+32 471 00 00 01", donus_tarih=tarih(20), donus_saat="09:15")
    xss = siparis_olustur("A", ad='<script>alert(1)</script>"x', alis='Gent "><img src=x onerror=alert(1)>',
                          telefon='+32 470 <b>1</b> 22 33 44')
    yabanci = mollie_ham("POST", "payments", {"amount": {"currency": "EUR", "value": "5.00"}, "description": "yabanci-sistem",
                                              "redirectUrl": "https://x.be/a", "metadata": {"baska": "sistem"}})[1]
    kontrol(odendi and bekleyen and xss, "orders verisi olusturulamadi")
    if not (odendi and bekleyen and xss):
        return
    # cerezsiz -> giris formu (veri YOK)
    y = istek(p, "GET", "/pay/orders.php")
    kontrol(y.kod == 200 and 'type="password"' in y.metin and odendi.no not in y.metin and "Rezervasyonlar" not in y.metin, "cerezsiz: yalniz giris formu")
    kontrol(y.baslik("content-security-policy") is not None and "X-Frame-Options".lower() in [k.lower() for k, _ in y.basliklar], "panelde CSP + X-Frame-Options")
    # yanlis cerez / sahte imza
    y = istek(p, "GET", "/pay/orders.php", cerez=yonetici_cerezi(int(time.time() * 1000) + 3600_000, gecerli_imza=False))
    kontrol('type="password"' in y.metin and odendi.no not in y.metin, "sahte imzali oturum cerezi reddedilir")
    y = istek(p, "GET", "/pay/orders.php", cerez=yonetici_cerezi(int(time.time() * 1000) - 1000))
    kontrol('type="password"' in y.metin and odendi.no not in y.metin, "suresi dolmus (dogru imzali) oturum cerezi reddedilir")
    y = istek(p, "GET", "/pay/orders.php", cerez="et_a=garip")
    kontrol('type="password"' in y.metin, "bozuk oturum cerezi -> form")
    # kaba kuvvet: 4 yanlis 401, 5. 429, sonra dogru sifre de 429
    ip = "10.251.0.9"
    kodlar = [istek(p, "POST", "/pay/orders.php", {"pw": "yanlis" + str(i)}, ip=ip).kod for i in range(5)]
    kontrol(kodlar == [401, 401, 401, 401, 429], f"yanlis sifre x5 -> 429: {kodlar}")
    y = istek(p, "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE}, ip=ip)
    kontrol(y.kod == 429 and (y.baslik("retry-after") or "").isdigit() and int(y.baslik("retry-after")) > 800, f"kilitliyken dogru sifre de 429 + Retry-After ({y.kod} {y.baslik('retry-after')})")
    y = istek(p, "POST", "/pay/orders.php", {"pw": "yanlis"}, ip="10.251.0.10")
    kontrol(y.kod == 401 and 'type="password"' in y.metin and "hatalı" in y.metin, "baska IP: 401 + form + hata mesaji")
    # dogru sifre -> 303 + cerez bayraklari
    y = istek(p, "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE}, ip="10.251.0.11")
    kontrol(y.kod == 303 and y.baslik("location") == "/pay/orders.php", f"dogru sifre -> 303 ({y.kod})")
    c = y.cerez("et_a") or ""
    oz = [x.strip() for x in c.split(";")]
    kontrol("HttpOnly" in oz and "Secure" in oz and "SameSite=Strict" in oz and "Max-Age=43200" in oz and "Path=/" in oz, f"oturum cerezi bayraklari: {oz}")
    # dogrulanmis cerez: testin kendi uretimi de calismali (bicim capraz dogrulamasi)
    kendi = yonetici_cerezi(int(time.time() * 1000) + 3600_000)
    for isim, cerez in [("sunucu cerezi", c.split(";")[0]), ("testin urettigi cerez", kendi)]:
        y = istek(p, "GET", "/pay/orders.php", cerez=cerez)
        kontrol(y.kod == 200 and "Rezervasyonlar" in y.metin and odendi.no in y.metin, f"{isim}: panel listesi ({y.kod})")
    cerez = c.split(";")[0]
    y = istek(p, "GET", "/pay/orders.php", cerez=cerez)
    html = y.metin
    kontrol(bekleyen.no in html and xss.no in html and yabanci["id"] not in html and "yabanci-sistem" not in html and "baska" not in html,
            "metadata.v===1 olmayan (yabanci) odemeler listelenmez")
    kontrol("Piet Odendi" in html and 'href="tel:+32470998877"' in html, "musteri adi + tiklanabilir tel: baglantisi")
    kontrol("ÖDENDİ" in html and "BEKLİYOR" in html, "durum rozetleri")
    kontrol("araçta 97,15 €" in html and "kapora 24,29 €" in html and "121,44 €" in html, "toplam / kapora / aracta tahsil")
    kontrol("Tahsil edilen kapora" in html and "24,29 €" in html and "Araçta beklenen" in html, "ozet kartlari")
    kontrol("↩ " in html, "donus bilgisi")
    # XSS
    kontrol("<script" not in html.lower(), "panelde HICBIR <script> etiketi olmamali")
    kontrol("&lt;script&gt;alert(1)&lt;/script&gt;&quot;x" in html, "musteri adi kacisli (<script> ve \")")
    kontrol("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;" in html and "<img src=x" not in html, "adres alani kacisli")
    kontrol("&lt;b&gt;1&lt;/b&gt;" in html, "telefon alani kacisli")
    # suzgecler
    y = istek(p, "GET", "/pay/orders.php?f=odendi", cerez=cerez)
    kontrol(odendi.no in y.metin and bekleyen.no not in y.metin and xss.no not in y.metin, "f=odendi yalniz odenenleri gosterir")
    y = istek(p, "GET", "/pay/orders.php?f=beklemede", cerez=cerez)
    kontrol(odendi.no not in y.metin and bekleyen.no in y.metin, "f=beklemede yalniz bekleyenleri gosterir")
    y = istek(p, "GET", "/pay/orders.php?f=%3Cscript%3E", cerez=cerez)
    kontrol(y.kod == 200 and "<script" not in y.metin.lower() and odendi.no in y.metin, "gecersiz suzgec 'hepsi'ye duser")
    # iade edilenler
    mock("POST", f"/__test/refund/{odendi.id}", {})
    y = istek(p, "GET", "/pay/orders.php", cerez=cerez)
    kontrol("İADE" in y.metin, "iade edilen siparis 'IADE' rozeti alir")
    # tutar uyusmuyor uyarisi
    tut = siparis_olustur("A", ad="Tutar Sorunu")
    mock("POST", f"/__test/tamper/{tut.id}?amount=1.00", {})
    mock("POST", f"/__test/paid/{tut.id}?webhook=0", {})
    y = istek(p, "GET", "/pay/orders.php", cerez=cerez)
    kontrol("ödenen tutar beklenenle uyuşmuyor" in y.metin, "tutar uyusmazligi panelde uyari olarak gorunur")
    # cikis
    y = istek(p, "GET", "/pay/orders.php?cikis=1", cerez=cerez)
    kontrol(y.kod == 303 and "Max-Age=0" in (y.cerez("et_a") or ""), "cikis cerezi siler")
    # Origin
    y = istek(p, "POST", "/pay/orders.php", {"pw": ADMIN_SIFRE}, origin="https://evil.example", ip=yeni_ip())
    kontrol(y.kod == 403 and y.cerez("et_a") is None, "giris POST'unda yanlis Origin -> 403")
    y = istek(p, "PUT", "/pay/orders.php", ham="x", cerez=cerez)
    kontrol(y.kod == 405, "orders: PUT 405")
    y = istek(p, "POST", "/pay/orders.php", ham="pw=" + "x" * 70000, ip=yeni_ip())
    kontrol(y.kod == 413, f"orders: 70 KB govde 413 ({y.kod})")
    # sayfalama: mock sayfa boyutu 2 -> tum siparisler listelenmeli
    mock_sifirla()
    nolar = []
    for i in range(7):
        so = siparis_olustur("A", ad=f"Sayfa Kisi {i}")
        nolar.append(so.no)
    mock("POST", "/__test/page_size/2", {})
    y = istek(p, "GET", "/pay/orders.php", cerez=cerez)
    kontrol(all(n in y.metin for n in nolar), f"sayfalama: 7 siparisin tamami listelenmeli ({sum(n in y.metin for n in nolar)}/7)")
    kontrol(y.metin.count("<b>ET-") == 7, "her siparis bir kez listelenir")
    mock("POST", "/__test/page_size/250", {})
    # Mollie ulasilamaz
    mock("POST", "/__test/mollie_fail/5", {})
    y = istek(p, "GET", "/pay/orders.php", cerez=cerez)
    kontrol(y.kod == 502 and "Mollie" in y.metin and "Traceback" not in y.metin, f"Mollie yok: temiz 502 ({y.kod})")
    mock("POST", "/__test/mollie_fail/0", {})
    # ADMIN_PASSWORD yok -> KAPALI (sunucu C)
    for yontem, veri in [("GET", None), ("POST", {"pw": "herhangi"}), ("POST", {"pw": ""})]:
        y = istek(PORT["C"], yontem, "/pay/orders.php", veri, origin="https://europetaxi24.be")
        kontrol(y.kod == 503 and "kapalı" in y.metin and y.cerez("et_a") is None, f"ADMIN_PASSWORD yok: orders KAPALI ({yontem} {y.kod})")
    y = istek(PORT["C"], "GET", "/pay/orders.php", cerez=yonetici_cerezi(int(time.time() * 1000) + 3600_000))
    kontrol(y.kod == 503, "ADMIN_PASSWORD yokken herhangi cerez panel acmaz")


# ------------------------------------------------------------------ 10. test ucu
def senaryo_test_ucu():
    print("— 10. test (tanilama) ucu")
    mock_sifirla()
    p = PORT["A"]
    # GET ?pw= ASLA kabul edilmez
    for yol in [f"/pay/test.php?pw={ADMIN_SIFRE}", f"/pay/test.php?pw={urllib.parse.quote(ADMIN_SIFRE)}&x=1", "/pay/test.php"]:
        y = istek(p, "GET", yol)
        kontrol(y.kod == 200 and 'type="password"' in y.metin and "MOLLIE_API_KEY" not in y.metin and y.cerez("et_a") is None,
                f"GET {yol[:30]}...: rapor VERILMEMELI, cerez verilmemeli")
    y = istek(p, "POST", f"/pay/test.php?pw={ADMIN_SIFRE}", {"x": "1"})
    kontrol("MOLLIE_API_KEY" not in y.metin and y.cerez("et_a") is None, "POST + URL'de pw: yine kabul edilmez")
    # yanlis sifre
    y = istek(p, "POST", "/pay/test.php", {"pw": "yanlis"})
    kontrol(y.kod == 403 and "MOLLIE_API_KEY" not in y.metin, f"yanlis sifre -> 403 ({y.kod})")
    # dogru sifre -> rapor
    y = istek(p, "POST", "/pay/test.php", {"pw": ADMIN_SIFRE})
    kontrol(y.kod == 200, f"dogru sifre 200 ({y.kod})")
    r = y.metin
    for beklenen in ["MOLLIE_API_KEY", "BREVO_API_KEY", "ADMIN_PASSWORD", "SIGNING_SECRET", "GOOGLE_SERVER_KEY", "SITE_URL",
                     "ayarlı (" + str(len(MOLLIE_ANAHTAR)) + " karakter)", "test anahtarı", "Mollie bağlantısı", "bancontact", "creditcard", "applepay",
                     "Brevo erişilebilirliği", "anahtar geçerli", "Test e-postası gönder", "KURULUM BİTİNCE"]:
        kontrol(beklenen in r, f"rapor '{beklenen}' icermeli")
    kontrol("GOOGLE_SERVER_KEY" in r and "ayarlı değil" in r, "ayarli olmayan degisken 'ayarlı değil' gorunur")
    for i, sir in enumerate(SIRLAR):
        kontrol(sir not in r, f"raporda SIR degeri YOK olmali (#{i})")
    kontrol(hashlib.sha256(("et-signing|" + MOLLIE_ANAHTAR + "|" + ADMIN_SIFRE).encode()).hexdigest() not in r, "turetilmis imza sirri raporda olmamali")
    kontrol("Traceback" not in r, "rapor stack icermez")
    c = y.cerez("et_a") or ""
    kontrol("HttpOnly" in c and "Secure" in c and "SameSite=Strict" in c, "rapor cerezi (oturum) guvenli bayraklarla verilir")
    # test e-postasi dugmesi: oturum cerezi ile (sifre sayfada yok)
    kontrol(ADMIN_SIFRE not in r and 'name="pw"' not in r, "rapor sayfasi sifreyi veya sifre alani icermez")
    n0 = len(postalar())
    y2 = istek(p, "POST", "/pay/test.php", {"eposta_testi": "1"}, cerez=c.split(";")[0])
    P = postalar()
    kontrol(y2.kod == 200 and len(P) == n0 + 1 and P[-1]["alicilar"] == [SIRKET_EPOSTA] and P[-1]["konu"] == "Europa Taxi kurulum testi" and "Gönderildi" in y2.metin,
            f"test e-postasi COMPANY_EMAIL'e gider ({len(P)}, {y2.kod})")
    # oturumsuz eposta_testi gonderemez
    n1 = len(postalar())
    istek(p, "POST", "/pay/test.php", {"eposta_testi": "1"})
    kontrol(len(postalar()) == n1, "oturumsuz istek test e-postasi gonderemez")
    # Mollie ariza raporlanir
    mock("POST", "/__test/mollie_fail/1", {})
    y3 = istek(p, "POST", "/pay/test.php", {"pw": ADMIN_SIFRE}, ip=yeni_ip())
    kontrol(y3.kod == 200 and "HTTP 500" in y3.metin, "Mollie hatasi raporda gorunur")
    # Google (sunucu B) erisilebilirligi + surec
    yb = istek(PORT["B"], "POST", "/pay/test.php", {"pw": ADMIN_SIFRE})
    kontrol("Brussels → Gent: 56 km" in yb.metin and GOOGLE_ANAHTAR not in yb.metin, "Google erisilebilirligi raporlanir, anahtar yok")
    # SIGNING_SECRET turetilmis uyarisi + Brevo anahtari yok (sunucu D)
    yd = istek(PORT["D"], "POST", "/pay/test.php", {"pw": ADMIN_SIFRE})
    kontrol("TÜRETİLİYOR" in yd.metin and "BREVO_API_KEY yok" in yd.metin and "AYARLI DEĞİL" in yd.metin, "D: turetilmis SIGNING_SECRET ve eksik Brevo uyarilari")
    kontrol(ADMIN_SIFRE not in yd.metin, "D raporunda sifre yok")
    # ADMIN_PASSWORD yok (sunucu C): KAPALI
    yc = istek(PORT["C"], "POST", "/pay/test.php", {"pw": "x"}, origin="https://europetaxi24.be")
    kontrol(yc.kod == 503 and "kapalı" in yc.metin.lower(), f"ADMIN_PASSWORD yok: test ucu KAPALI ({yc.kod})")
    yc = istek(PORT["C"], "GET", "/pay/test.php?pw=x")
    kontrol(yc.kod == 503, "ADMIN_PASSWORD yok: GET de KAPALI")
    # yanlis Origin
    y = istek(p, "POST", "/pay/test.php", {"pw": ADMIN_SIFRE}, origin="https://evil.example")
    kontrol(y.kod == 403, "test: yanlis Origin 403")
    # kaba kuvvet ortak sayac
    ip = "10.252.0.9"
    kodlar = [istek(p, "POST", "/pay/test.php", {"pw": "yanlis" + str(i)}, ip=ip).kod for i in range(5)]
    kontrol(kodlar == [403, 403, 403, 403, 429], f"test ucu: yanlis sifre x5 -> 429 ({kodlar})")


def senaryo_taban_guvenligi():
    print("— 10b. *_BASE degiskenleri yalniz https:// veya http://127.0.0.1")
    kod = r"""
    const c = require(process.argv[1] + '/api/_lib/config.js');
    const sonuclar = {};
    for (const [ad, deger] of [
      ['a', 'http://127.0.0.1:9500/v2'], ['b', 'https://api.mollie.com/v2'], ['c', 'http://evil.example/v2'],
      ['d', 'http://127.0.0.1.evil.example/v2'], ['e', 'ftp://127.0.0.1/v2'], ['f', 'http://localhost:9500/v2'],
      ['g', 'file:///etc/passwd'], ['h', 'javascript:alert(1)'], ['i', 'https://user:pw@api.mollie.com/v2'], ['j', 'gecersiz'],
      ['k', 'http://127.0.0.1:9500/v2/'], ['l', ''],
    ]) {
      process.env.MOLLIE_API_BASE = deger;
      sonuclar[ad] = c.cfg().mollieBase;
    }
    delete process.env.MOLLIE_API_BASE;
    sonuclar.varsayilan = c.cfg().mollieBase;
    process.env.SITE_URL = 'javascript:alert(1)';
    sonuclar.site = c.cfg().siteUrl;
    process.env.DISTANCE_TOLERANCE_PCT = 'abc';
    sonuclar.tol = c.cfg().tolerancePct;
    process.env.DISTANCE_TOLERANCE_PCT = '15';
    sonuclar.tol15 = c.cfg().tolerancePct;
    console.log(JSON.stringify(sonuclar));
    """
    p = subprocess.run(["node", "-e", kod, str(CIKTI)], capture_output=True, text=True, env=temiz_ortam())
    kontrol(p.returncode == 0, "config testi calismadi: " + p.stderr[:300])
    if p.returncode == 0:
        o = json.loads(p.stdout)
        kontrol(o["a"] == "http://127.0.0.1:9500/v2" and o["b"] == "https://api.mollie.com/v2" and o["k"] == "http://127.0.0.1:9500/v2", f"izinli semalar kabul: {o}")
        for ad in "cdefghij":
            kontrol(o[ad] is None, f"gecersiz taban '{ad}' REDDEDILMELI (null), bulunan {o[ad]}")
        kontrol(o["l"] == "https://api.mollie.com/v2" and o["varsayilan"] == "https://api.mollie.com/v2", "bos taban -> varsayilan")
        kontrol(o["site"] == "https://europetaxi24.be", "gecersiz SITE_URL -> varsayilan")
        kontrol(o["tol"] == 12 and o["tol15"] == 15, f"DISTANCE_TOLERANCE_PCT: {o['tol']} / {o['tol15']}")
    # gecersiz taban ile sunucu: create cagrisi uretim adresine GITMEZ
    port = PORT0 + 6
    if port_bos_mu(port):
        env = temiz_ortam(MOLLIE_API_KEY=MOLLIE_ANAHTAR, MOLLIE_API_BASE="http://evil.example/v2", SITE_URL=f"http://127.0.0.1:{port}", SIGNING_SECRET=IMZA_SIRRI)
        surec_baslat("sunucu_F", ["node", str(KAYNAK / "vercel" / "dev-server.js"), "--dir", str(CIKTI), "--port", str(port)], env)
        if bekle_port(port):
            y = istek(port, "POST", "/pay/create.php", form(), origin=f"http://127.0.0.1:{port}")
            kontrol(y.kod == 502 and th("nl", "err_pay") in y.metin.replace("&#039;", "'"), f"gecersiz MOLLIE_API_BASE: create temiz 502 ({y.kod})")
            kontrol("MOLLIE_API_BASE yalniz https:// veya http://127.0.0.1" in log_oku("F"), "gecersiz taban loglanir")
        else:
            kontrol(False, "F sunucusu baslamadi")


# ------------------------------------------------------------------ 11. basliklar / bozuk istekler
def ham_soket(port, veri, bekle=0.6, oku=True):
    s = socket.create_connection(("127.0.0.1", port), timeout=5)
    try:
        s.sendall(veri)
        if not oku:
            return b""
        s.settimeout(bekle)
        parcalar = []
        try:
            while True:
                b = s.recv(65536)
                if not b:
                    break
                parcalar.append(b)
        except (socket.timeout, ConnectionResetError):
            pass
        return b"".join(parcalar)
    finally:
        s.close()


def senaryo_bozuk_istekler():
    print("— 11. bozuk / kesik istekler, genel 500, basliklar")
    p = PORT["A"]
    # kesik govde: Content-Length 500 ama 20 bayt gonderip baglantiyi kes
    for yol in ["/pay/create.php", "/pay/webhook.php", "/pay/orders.php"]:
        ham_soket(p, (f"POST {yol} HTTP/1.1\r\nHost: 127.0.0.1:{p}\r\nContent-Type: application/x-www-form-urlencoded\r\n"
                      f"Content-Length: 500\r\nX-Forwarded-For: {yeni_ip()}\r\n\r\nalis=Gent&varis=Bru").encode(), oku=False)
    time.sleep(0.4)
    y = istek(p, "GET", "/pay/success.php?order=bozuk")
    kontrol(y.kod == 200, "kesik istekten sonra sunucu ayakta ve saglikli")
    # Content-Length gercekten kucuk: artan bayt HTTP ayristiricisina kalir
    yanit = ham_soket(p, (f"POST /pay/create.php HTTP/1.1\r\nHost: 127.0.0.1:{p}\r\nContent-Type: application/x-www-form-urlencoded\r\n"
                          f"Content-Length: 5\r\nX-Forwarded-For: {yeni_ip()}\r\n\r\nalis=xxxxxxxxxxxxxxxxxxxx").encode())
    kontrol(b"Traceback" not in yanit and b"    at " not in yanit and b"node:internal" not in yanit, "uyumsuz Content-Length: yanitta stack yok")
    # bozuk HTTP
    yanit = ham_soket(p, b"GARBAGE\r\n\r\n")
    kontrol(b"node:internal" not in yanit and b"    at " not in yanit, "bozuk HTTP: stack yok")
    # bozuk yuzde kodlamasi / gecersiz UTF-8 / ikili cop: 500 OLMAMALI
    for ad, govde in [
        ("gecersiz yuzde kodlamasi", b"alis=%zz&varis=%E0%A4%A&km=%"),
        ("gecersiz UTF-8 bayt", b"alis=\xff\xfe\xfd&varis=Gent&km=56&eposta=\xc3\x28"),
        ("ikili cop", bytes(range(256)) * 20),
        ("cok fazla alan", ("&".join(f"k{i}=v" for i in range(5000))).encode()),
        ("bos anahtar", b"=&=&&&=x"),
    ]:
        y = istek(p, "POST", "/pay/create.php", ham=govde)
        kontrol(y.kod in (400, 413, 422) and "Traceback" not in y.metin, f"{ad}: temiz 4xx, 500 degil ({y.kod})")
        y = istek(p, "POST", "/pay/webhook.php", ham=govde, ip=None, origin=None)
        kontrol(y.kod in (200, 413), f"webhook {ad}: 200/413 ({y.kod})")
    # genel 500: dev-server /__crash ozel istisna firlatir
    y = istek(p, "GET", "/__crash")
    kontrol(y.kod == 500, f"beklenmeyen istisna -> 500 ({y.kod})")
    kontrol("GIZLI-IC-AYRINTI" not in y.metin and "\n    at " not in y.metin and "node:internal" not in y.metin and ".js:" not in y.metin, "500 yanitinda ic ayrinti/stack yok")
    kontrol(re.search(r"ref: [0-9a-f]{8}", y.metin) is not None, "500 yanitinda istek kimligi (ref) var")
    kontrol(th("fr", "err_t") in y.metin, "500 sayfasi dilde genel mesaj verir")
    kontrol("GIZLI-IC-AYRINTI" not in log_oku("A"), "istisna mesaji (gizli ayrinti) loga yazilmamali")
    kontrol("beklenmeyen istisna" in log_oku("A") and "ETEST" in log_oku("A"), "istisna adi/kodu loglanir")
    # Mollie hatasi -> temiz 502 (stack yok)
    mock_sifirla()
    mock("POST", "/__test/mollie_fail/1", {})
    y = istek(p, "POST", "/pay/create.php", form())
    kontrol(y.kod == 502 and "Traceback" not in y.metin, f"Mollie 500 -> create temiz 502 ({y.kod})")
    kontrol(th("nl", "err_pay") in y.metin, "502 sayfasi dilde mesaj verir")
    # tum API yanitlarinda temel basliklar
    eksik = []
    for port, yontem, yol, r in API_YANITLARI:
        cc = (r.baslik("cache-control") or "")
        if cc != "no-store" or r.baslik("x-content-type-options") != "nosniff" or r.baslik("referrer-policy") != "no-referrer":
            eksik.append((yontem, yol, r.kod, cc))
    kontrol(len(API_YANITLARI) > 100 and not eksik, f"{len(API_YANITLARI)} yanittan {len(eksik)} tanesinde no-store/nosniff/no-referrer eksik: {eksik[:5]}")
    # HTML yanitlarinda CSP
    html_yanitlar = [r for _, _, _, r in API_YANITLARI if (r.baslik("content-type") or "").startswith("text/html")]
    kontrol(html_yanitlar and all(r.baslik("content-security-policy") and r.baslik("x-frame-options") == "DENY" for r in html_yanitlar),
            "tum HTML yanitlarinda CSP + X-Frame-Options")
    kontrol(all("Traceback" not in r.metin and "node:internal" not in r.metin and "\n    at " not in r.metin for _, _, _, r in API_YANITLARI),
            "hicbir yanitta stack izi yok")


# ------------------------------------------------------------------ 12. PHP / Node esitligi
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


def senaryo_php_node_esitligi():
    print("— 12. dil.json <-> www/pay/dil.php, musteri e-postasi Node <-> PHP")
    php = shutil.which("php")
    kontrol(php is not None, "php CLI bulunamadi (PHP esitlik testleri icin gerekli)")
    if php is None:
        return
    dil_php = WWW / "pay" / "dil.php"
    isl_php = WWW / "pay" / "isletme.php"
    kontrol(dil_php.is_file() and isl_php.is_file(), "www/pay/dil.php yok — once python3 kaynak/build.py")
    if not dil_php.is_file():
        return
    p = subprocess.run([php, "-r", f"echo json_encode(require '{dil_php}', JSON_UNESCAPED_UNICODE);"], capture_output=True, text=True)
    kontrol(p.returncode == 0, "dil.php PHP'de yuklenemedi: " + p.stderr[:200])
    php_dil = json.loads(p.stdout)
    node_dil = json.loads((CIKTI / "api" / "_lib" / "dil.json").read_text(encoding="utf-8"))
    kontrol(set(php_dil.keys()) == set(DILLER) and set(node_dil["diller"].keys()) == set(DILLER), "her iki dilde 4 dil var")
    for d in DILLER:
        php_k, node_k = php_dil[d], node_dil["diller"][d]
        kontrol(set(php_k) <= set(node_k), f"[{d}] dil.json, dil.php'nin TUM anahtarlarini icermeli (eksik: {sorted(set(php_k) - set(node_k))})")
        fark = [k for k in php_k if node_k.get(k) != php_k[k]]
        kontrol(not fark, f"[{d}] dil.json ile dil.php degerleri esit olmali (farkli: {fark[:5]})")
        ekstra = set(node_k) - set(php_k)
        kontrol(ekstra <= {"val_cancel", "err_rate", "err_forbidden", "err_bad_request", "err_km_wa"}, f"[{d}] dil.json'da beklenmeyen ek anahtarlar: {sorted(ekstra)}")
    p = subprocess.run([php, "-r", f"echo json_encode(require '{isl_php}', JSON_UNESCAPED_UNICODE);"], capture_output=True, text=True)
    kontrol(json.loads(p.stdout) == node_dil["isletme"], "isletme bilgileri dil.json ile isletme.php'de ayni")
    # www/pay/dil.php disinda: build.py'nin PHP_ANAHTARLARI ile dil.json'un PHP anahtarlari ayni
    kontrol(set(php_dil["fr"]) <= set(node_dil["diller"]["fr"]) and len(php_dil["fr"]) >= 41, f"PHP_ANAHTARLARI kapsami ({len(php_dil['fr'])})")

    # musteri e-postasi: Node vs PHP
    girdi = json.dumps(ORNEK_SIPARISLER, ensure_ascii=False)
    pn = node_calistir(EPOSTA_JS, str(CIKTI), girdi=girdi)
    pp = subprocess.run([php, "-r", PHP_EPOSTA % WWW], input=girdi, capture_output=True, text=True)
    kontrol(pn.returncode == 0, "Node e-posta uretimi basarisiz: " + pn.stderr[:300])
    kontrol(pp.returncode == 0, "PHP e-posta uretimi basarisiz: " + pp.stderr[:300] + pp.stdout[:200])
    if pn.returncode == 0 and pp.returncode == 0:
        nod, phpc = json.loads(pn.stdout), json.loads(pp.stdout)
        for i, s in enumerate(ORNEK_SIPARISLER):
            a, b = metin_normalize(nod[i]["html"]), metin_normalize(phpc[i]["html"])
            kontrol(a == b, f"[{s['dil']}] musteri e-postasi Node == PHP olmali (bosluklar normalize):\n  node: {a[:400]}\n  php : {b[:400]}")
            # sirket metni: Mesafe satiri HARIC ayni (durumsuz tasarimda istemci km'si tutulmaz)
            na = [l for l in nod[i]["metin"].split("\n") if not l.startswith("Mesafe")]
            pa = [l for l in phpc[i]["metin"].split("\n") if not l.startswith("Mesafe")]
            kontrol(na == pa, f"[{s['dil']}] sirket is emri (Mesafe satiri haric) Node == PHP olmali:\n{na}\n{pa}")
            kontrol("ARACTA TAHSIL: " in nod[i]["metin"], f"[{s['dil']}] is emri 'ARACTA TAHSIL'")


# ------------------------------------------------------------------ 13. vektorler
def yer_bul_referans(veri):
    """test_adim1.py mantiginin (Python) kopyasi."""
    def normalize(s):
        s = s.lower()
        s = s.replace(chr(0x131), "i").replace(chr(0xDF), "ss").replace(chr(0x153), "oe").replace(chr(0xE6), "ae")
        s = unicodedata.normalize("NFD", s)
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        s = re.sub(r"[^a-z0-9]+", " ", s)
        return re.sub(r"\s+", " ", s).strip()
    esleme = {}
    for anahtar, yer in veri["yerler"].items():
        for aday in set(yer["takma"]) | {yer["ad"][d] for d in DILLER}:
            n = normalize(aday)
            if n:
                esleme[n] = anahtar

    def yer_bul(girdi):
        n = normalize(girdi)
        if not n:
            return None
        if n in esleme:
            return esleme[n]
        en_iyi, en_uzun, hedef = None, 0, f" {n} "
        for takma, anahtar in esleme.items():
            if f" {takma} " in hedef and len(takma) > en_uzun:
                en_iyi, en_uzun = anahtar, len(takma)
        return en_iyi

    import math
    kesin = {}
    for a, b, km in veri["kesin"]:
        kesin[(a, b)] = km
        kesin[(b, a)] = km

    def haversine(a, b):
        R = 6371.0
        la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lng"], b["lat"], b["lng"]))
        h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
        return 2 * R * math.asin(math.sqrt(h))

    def mesafe(a, b):
        ka, kb = yer_bul(a), yer_bul(b)
        if ka is None or kb is None or ka == kb:
            return None
        if (ka, kb) in kesin:
            return kesin[(ka, kb)]
        x = haversine(veri["yerler"][ka], veri["yerler"][kb]) * veri["sabitler"]["yol_katsayisi"]
        return int(math.floor(x + 0.5))   # JS Math.round: .5 yukari

    return yer_bul, mesafe


def senaryo_vektorler():
    print("— 13. paylasilan-vektorler.json: Node + Python referansi + PHP")
    V = json.loads(VEKTOR_DOSYASI.read_text(encoding="utf-8"))
    kontrol("_aciklama" in V and len(V["_aciklama"]) > 400, "vektor dosyasinda aciklama olmali")
    for bolum, en_az in [("fiyat", 40), ("km_karar", 25), ("yer_bul", 25), ("dahili_mesafe", 12), ("dogrulama", 40),
                         ("iptal", 8), ("idem", 10), ("idempotency_anahtari", 5), ("google_cagri", 10)]:
        kontrol(len(V.get(bolum, [])) >= en_az, f"vektor bolumu '{bolum}' en az {en_az} vaka icermeli ({len(V.get(bolum, []))})")
    yer_dilleri = set()
    for c in V["yer_bul"]:
        yer_dilleri.add(c["girdi"])
    kontrol(any(c["beklenen"] is None for c in V["yer_bul"]) and any(c["beklenen"] == "bru" for c in V["yer_bul"]), "yer_bul: tanınmayan ve havalimani vakalari var")
    kontrol(any(c["beklenen"] == "RET" for c in V["km_karar"]) and any(c["google"] is None and c["dahili"] is None for c in V["km_karar"]), "km_karar: RET ve 'ikisi de yok' vakalari var")
    kontrol(any(c["gecerli"] is False for c in V["dogrulama"]) and any("temiz" in c for c in V["dogrulama"]), "dogrulama: gecersiz ve temiz vakalari var")

    # ---- Node
    pn = subprocess.run(["node", "-e", HARNESS_JS, "--", str(CIKTI)], input=VEKTOR_DOSYASI.read_text(encoding="utf-8"), capture_output=True, text=True)
    kontrol(pn.returncode == 0, "Node vektor harness'i calismadi: " + pn.stderr[:300])
    if pn.returncode == 0:
        o = json.loads(pn.stdout)
        kontrol(o["say"] > 300, f"Node vektor kontrol sayisi az ({o['say']})")
        for h in o["hatalar"]:
            kontrol(False, "Node vektor uyusmazligi: " + h)
    # ---- Python referansi (test_adim1.py mantigi)
    veri = json.loads((KAYNAK / "mesafe-verisi.json").read_text(encoding="utf-8"))
    yer_bul, mesafe = yer_bul_referans(veri)
    for c in V["yer_bul"]:
        kontrol(yer_bul(c["girdi"]) == c["beklenen"], f"Python yer_bul {c['girdi']!r}: beklenen {c['beklenen']}, bulunan {yer_bul(c['girdi'])}")
    for c in V["dahili_mesafe"]:
        kontrol(mesafe(c["a"], c["b"]) == c["km"], f"Python dahili_mesafe {c['a']!r}->{c['b']!r}: beklenen {c['km']}, bulunan {mesafe(c['a'], c['b'])}")
    # ---- km_karar: Python referans uygulamasi
    def km_karar_py(i, g, d, tol):
        if not (1 <= i <= 800):
            return "RET"
        if g is not None and g > 0:
            km = g if abs(g - i) * 100 > tol * g else i
        elif d is not None and d > 0:
            km = d if i * 100 < d * (100 - tol) else i
        else:
            return "RET"
        return km if 1 <= km <= 800 else "RET"
    for c in V["km_karar"]:
        r = km_karar_py(c["istemci"], c["google"], c["dahili"], c["tol"])
        kontrol(r == c["beklenen"], f"Python km_karar {c}: bulunan {r}")
    # ---- PHP: fiyat_hesapla (mevcut create.php) vektorlerle ve 1..800 taramasiyla
    php = shutil.which("php")
    if php:
        pf = subprocess.run([php, "-r", PHP_FIYAT_TARAMA % WWW], capture_output=True, text=True)
        kontrol(pf.returncode == 0, "PHP fiyat taramasi calismadi: " + pf.stderr[:300])
        if pf.returncode == 0:
            o = json.loads(pf.stdout)
            php_fiyat = o["fiyat"]
            for c in V["fiyat"]:
                bek = [f"{c['toplam']:.2f}", f"{c['kapora']:.2f}", f"{c['kalan']:.2f}"]
                kontrol(php_fiyat[str(c["km"])] == bek, f"PHP fiyat_hesapla({c['km']}) vektorle ayni olmali: {php_fiyat[str(c['km'])]} vs {bek}")
            # Node 1..800 taramasi
            sweep = subprocess.run(["node", "-e", "const f=require(process.argv[1]+'/api/_lib/fiyat.js');const o={};for(let k=1;k<=800;k++){const r=f.fiyatHesapla(k);o[k]=[r.toplamStr,r.kaporaStr,r.kalanStr];}console.log(JSON.stringify(o));", str(CIKTI)],
                                   capture_output=True, text=True)
            node_fiyat = json.loads(sweep.stdout)
            fark = [k for k in php_fiyat if php_fiyat[k] != node_fiyat[k]]
            kontrol(not fark, f"PHP ve Node fiyati 1..800 km icin AYNI olmali (farkli: {fark[:10]})")
            kontrol(o["esdeger_fark"] == 0, f"PHP kayan nokta ve tamsayi km_karar karsilastirmalari 800x800 taramada AYNI olmali (fark {o['esdeger_fark']})")
    # ---- iptal / idem / idempotency anahtari / google cagrisi: PHP (girdi.php, create.php, mesafe.php) ile
    if php:
        pe = subprocess.run([php, "-r", PHP_YENI_VEKTOR % WWW], input=VEKTOR_DOSYASI.read_text(encoding="utf-8"), capture_output=True, text=True)
        kontrol(pe.returncode == 0, "PHP iptal/idem vektorleri calismadi: " + pe.stderr[:300] + pe.stdout[:200])
        if pe.returncode == 0:
            o = json.loads(pe.stdout)
            for c, r in zip(V["iptal"], o["iptal"]):
                kontrol(r == c["gecerli"], f"PHP iptal {c['deger']!r}: beklenen {c['gecerli']}, bulunan {r}")
            for c, r in zip(V["idem"], o["idem"]):
                kontrol(r == c["beklenen"], f"PHP idem {c['deger']!r}: beklenen {c['beklenen']!r}, bulunan {r!r}")
            for c, r in zip(V["idempotency_anahtari"], o["anahtar"]):
                kontrol(r == c["anahtar"], f"PHP Idempotency-Key {c['idem']!r}: beklenen {c['anahtar']!r}, bulunan {r!r}")
    # Google cagrisi: gercek googleKm() ve PHP google_km() ayni adresler icin mock'a istek yapar/yapmaz
    beklenen_istekler = [[c["alis"], c["varis"]] for c in V["google_cagri"] if c["cagri"]]
    google_env = {"GOOGLE_SERVER_KEY": GOOGLE_ANAHTAR, "GOOGLE_API_BASE": f"http://127.0.0.1:{MOCK}"}
    mock("POST", "/__test/google/reset", {})
    pg = subprocess.run(["node", "-e", GOOGLE_JS, "--", str(CIKTI)], input=VEKTOR_DOSYASI.read_text(encoding="utf-8"), capture_output=True, text=True,
                        env=temiz_ortam(**google_env))
    kontrol(pg.returncode == 0 and "tamam" in pg.stdout, "Node googleKm vektor betigi calismadi: " + pg.stderr[:300])
    log = [[i["origins"], i["destinations"]] for i in mock("GET", "/__test/google/log")["istekler"]]
    kontrol(log == beklenen_istekler, f"Node googleKm: '|'/kontrol karakteri/bos adreste HIC istek gitmemeli. Beklenen {beklenen_istekler}, mock'a giden {log}")
    if php:
        mock("POST", "/__test/google/reset", {})
        siparis_dizini = TMP / "php_siparis"
        siparis_dizini.mkdir(exist_ok=True)
        pgp = subprocess.run([php, "-r", PHP_GOOGLE % WWW], input=VEKTOR_DOSYASI.read_text(encoding="utf-8"), capture_output=True, text=True,
                             env=temiz_ortam(ORDERS_DIR=str(siparis_dizini), **google_env))
        kontrol(pgp.returncode == 0 and "tamam" in pgp.stdout, "PHP google_km vektor betigi calismadi: " + pgp.stderr[:300] + pgp.stdout[:200])
        logp = [[i["origins"], i["destinations"]] for i in mock("GET", "/__test/google/log")["istekler"]]
        kontrol(logp == beklenen_istekler, f"PHP google_km ve Node googleKm ayni adreslerde istek yapmali. Beklenen {beklenen_istekler}, PHP {logp}")
    mock("POST", "/__test/google/reset", {})
    # ---- PHP'nin kendi vektor kosucusu (kaynak/testler/vektor_test.php): tum bolumler + yeni '|' / iptal / idem yapisal vakalari
    kosucu = TESTLER / "vektor_test.php"
    if php and kosucu.is_file():
        girdi_json = TMP / "php_vektor_girdi.json"
        girdi_json.write_text(json.dumps({"vektorler": V}, ensure_ascii=False), encoding="utf-8")
        pk = subprocess.run([php, str(kosucu), str(WWW / "pay"), str(girdi_json)], capture_output=True, text=True, env=temiz_ortam(ORDERS_DIR=str(TMP / "php_siparis")))
        try:
            ok = json.loads(pk.stdout.strip().splitlines()[-1])
        except Exception:
            ok = None
        kontrol(ok is not None and ok["say"] > 300, "PHP vektor kosucusu calismadi: " + pk.stderr[:300] + pk.stdout[:300])
        if ok:
            for h in ok["hatalar"][:20]:
                kontrol(False, "PHP vektor uyusmazligi: " + h)
    # ---- istemci (template.html) formulu Node ile ayni mi (1..800)
    pc = subprocess.run(["node", "-e", ISTEMCI_FIYAT_JS, "--", str(CIKTI)], capture_output=True, text=True)
    kontrol(pc.returncode == 0 and json.loads(pc.stdout) == [], f"istemci Math.round formulu 1..800'de sunucu fiyatiyla AYNI olmali: {pc.stdout[:200]} {pc.stderr[:200]}")
    # vektorlerin fiyat bolumu kesirli sent iceriyor mu
    kesirli = [c for c in V["fiyat"] if (1000 + 199 * c["km"]) % 5 != 0]
    kontrol(len(kesirli) >= 25, f"fiyat vektorlerinde kesirli sentli (yuvarlama gerektiren) vaka sayisi yeterli olmali ({len(kesirli)})")


# ------------------------------------------------------------------ 14. log hijyeni
def senaryo_log_hijyeni():
    print("— 14. log hijyeni: sir yok, kisisel veri yok, stack yok")
    for ad in ["A", "B", "C", "D", "E", "F"]:
        yol = TMP / f"sunucu_{ad}.log"
        if not yol.exists():
            continue
        log = yol.read_text(encoding="utf-8", errors="replace")
        for sir in SIRLAR:
            kontrol(sir not in log, f"sunucu {ad} logunda SIR var: {sir[:8]}...")
        for kv in KISISEL:
            kontrol(kv not in log, f"sunucu {ad} logunda KISISEL VERI var: {kv!r}")
        for isaret in ["[eposta]", "[sayi]", "[token]", "[anahtar]"]:
            kontrol(isaret not in log, f"sunucu {ad} logunda maskelenen icerik var ({isaret}): kod PII/sir loglamaya calisiyor")
        kontrol("\n    at " not in log and "node:internal" not in log, f"sunucu {ad} logunda stack izi var")
        satirlar = [l for l in log.splitlines() if l.strip()]
        kontrol(all(l.startswith("[et] ") or l.startswith("dev-server hazir") for l in satirlar), f"sunucu {ad} logunda beklenmeyen satirlar: {[l for l in satirlar if not (l.startswith('[et] ') or l.startswith('dev-server hazir'))][:3]}")
    a = (TMP / "sunucu_A.log").read_text(encoding="utf-8", errors="replace")
    kontrol("create: odeme olusturuldu ET-" in a and "webhook: ET-" in a, "loglarda siparis numarasi ve durum gorunur")


# ================================================================ calistir
def temizlik():
    for p, log in SUREKLI:
        try:
            p.terminate()
        except Exception:
            pass
    for p, log in SUREKLI:
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


def calistir(fonksiyon):
    try:
        fonksiyon()
    except SystemExit:
        raise
    except Exception:
        kontrol(False, f"{fonksiyon.__name__} ISTISNA verdi:\n" + traceback.format_exc())


def main():
    global DIL_VERISI
    kontrol(shutil.which("node") is not None, "node bulunamadi")
    if shutil.which("node") is None:
        return
    try:
        www_uret()
        calistir(senaryo_kaynak_ve_derleme)
        DIL_VERISI = json.loads((CIKTI / "api" / "_lib" / "dil.json").read_text(encoding="utf-8"))
        sunuculari_baslat()
        for f in [senaryo_mock_dogrudan, senaryo_mutlu_yol, senaryo_paid, senaryo_success, senaryo_fiyat_tahrifati,
                  senaryo_google, senaryo_dogrulama, senaryo_iptal_idem_pipe, senaryo_koruma, senaryo_webhook, senaryo_orders,
                  senaryo_test_ucu, senaryo_taban_guvenligi, senaryo_bozuk_istekler,
                  senaryo_php_node_esitligi, senaryo_vektorler, senaryo_log_hijyeni]:
            calistir(f)
    finally:
        temizlik()
        if not os.environ.get("ET_TEST_TMP_KORU"):
            shutil.rmtree(TMP, ignore_errors=True)

    print()
    if hatalar:
        print(f"✗ {len(hatalar)} HATA ({gecen} kontrol gecti):")
        for x in hatalar:
            print("   -", x)
        sys.exit(1)
    print(f"✓ Tum kontroller gecti ({gecen} kontrol)")


if __name__ == "__main__":
    main()
