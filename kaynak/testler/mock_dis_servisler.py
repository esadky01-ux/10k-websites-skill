# -*- coding: utf-8 -*-
"""
SAHTE DIS SERVISLER — MOLLIE + BREVO + GOOGLE (yalniz test; gercek servislere ihtiyac yok)

Tek surecte, yalniz stdlib (http.server). Hem Node (kaynak/vercel) hem PHP (pay/) testleri kullanir;
PHP'nin cURL'u icin TLS'siz HTTP yeterlidir.

Calistirma:
    python3 kaynak/testler/mock_dis_servisler.py --port 9500

Uygulama tarafi ayarlari (ortam degiskenleri; PHP config.php'de karsiligi):
    MOLLIE_API_BASE=http://127.0.0.1:9500/v2     MOLLIE_API_KEY=test_xxxxxxxxxxxxxxxxxxxxxxxx
    BREVO_API_BASE=http://127.0.0.1:9500/v3      BREVO_API_KEY=xkeysib-xxxxxxxx
    GOOGLE_API_BASE=http://127.0.0.1:9500        GOOGLE_SERVER_KEY=AIzaXXXX

------------------------------------------------------------------ MOLLIE (/v2)
  POST  /v2/payments            Authorization: Bearer test_...  ZORUNLU (yoksa 401)
        govde dogrulamasi (422): amount.currency=EUR, amount.value '^\\d+\\.\\d{2}$' (>0), description dolu,
        redirectUrl/webhookUrl https?://, metadata JSON <= 1024 bayt (gercek Mollie ~1 kB sinirinin taklidi),
        locale ve method gecerli degerler (method dizi olabilir). Idempotency-Key: ayni anahtar AYNI odemeyi doner.
        Yanit 201: id tr_xxxxxxxxxx, status open, amount, description, metadata, createdAt,
        _links.checkout.href = http://127.0.0.1:PORT/checkout/<id>
  GET   /v2/payments/<id>       404 (Mollie bicimli JSON) bilinmeyen id
  PATCH /v2/payments/<id>       yalniz description/metadata (metadata <= 1024 bayt); webhook TETIKLEMEZ
  GET   /v2/payments?limit=&from=   en yeni ilk; `from` = o odemeden (dahil) baslar; _links.next ile sayfalama;
                                    limit en fazla 250 (gercek Mollie gibi) — /__test/page_size/<n> ile dusurulebilir
  GET   /v2/methods             aktif odeme yontemleri
  GET   /checkout/<id>          basit sahte checkout sayfasi (HTML)

------------------------------------------------------------------ BREVO (/v3)
  POST  /v3/smtp/email          `api-key` basligi zorunlu (yoksa 401); govde dogrulanir (400); gonderilenler saklanir; 201 {messageId}
  GET   /v3/account             api-key ile 200 (kurulum tanilamasi icin)

------------------------------------------------------------------ GOOGLE
  GET   /maps/api/distancematrix/json?origins=&destinations=&key=     (key yoksa REQUEST_DENIED)

------------------------------------------------------------------ TEST KONTROL UCLARI (POST; okuma olanlar GET de olur)
  /__test/paid/<id>[?webhook=0][&hours_ago=N][&paid_at=ISO][&amount=12.34]
                                durumu paid yapar, paidAt koyar, odemenin webhookUrl'sine `id=<id>` POST eder
  /__test/expired/<id>  /__test/failed/<id>  /__test/canceled/<id>[?webhook=0]
  /__test/refund/<id>[?amount=X][&webhook=0]       amountRefunded ayarlar (varsayilan: tam tutar) + webhook
  /__test/chargeback/<id>[?amount=X][&webhook=0]   amountChargedBack + webhook
  /__test/webhook/<id>          webhook'u (durumu degistirmeden) yeniden cagirir
  /__test/tamper/<id>?amount=1.00                  odemenin amount.value'sunu kurcalar (webhook yok)
  /__test/set_metadata/<id>     govde = JSON; metadata'yi degistirir (webhook yok)
  /__test/state                 (GET) tum odemeler + ayarlar
  /__test/reset                 her sey sifirlanir (odemeler, postalar, sayaçlar, ayarlar)
  /__test/mails                 (GET) gonderilen e-postalar ; /__test/mails/reset  (POST) yalniz postalari siler
  /__test/brevo_fail/<n>[?skip=m]                  once m gonderim BASARILI, sonraki n gonderim 500
  /__test/brevo_delay/<ms>                         Brevo gonderimine gecikme ekler
  /__test/mollie_fail/<n>                          Mollie'ye gelen sonraki n API cagrisi 500 doner
  /__test/page_size/<n>                            Mollie liste sayfa boyutu ust siniri
  /__test/google/set?meters=56400[&status=OK][&element=OK][&http=200]   Google yanitini ayarlar
  /__test/google/log            (GET) gelen Google isteklerinin kaydi
"""
import argparse
import json
import re
import secrets
import string
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOCALES = {
    "en_US", "en_GB", "nl_NL", "nl_BE", "fr_FR", "fr_BE", "de_DE", "de_AT", "de_CH", "es_ES", "ca_ES",
    "pt_PT", "it_IT", "nb_NO", "sv_SE", "fi_FI", "da_DK", "is_IS", "hu_HU", "pl_PL", "lv_LV", "lt_LT",
}
YONTEMLER = {
    "applepay", "bancontact", "banktransfer", "belfius", "creditcard", "directdebit", "eps", "giftcard",
    "giropay", "ideal", "in3", "kbc", "klarna", "klarnapaylater", "klarnapaynow", "klarnasliceit",
    "mybank", "paypal", "paysafecard", "przelewy24", "sofort", "trustly", "twint", "billie", "vipps",
}
AKTIF_YONTEMLER = ["bancontact", "creditcard", "applepay", "ideal", "paypal"]
METADATA_SINIRI = 1024
ID_ALFABE = string.ascii_letters + string.digits


def simdi():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def metadata_bayt(m):
    return len(json.dumps(m, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


class Durum:
    """Tum sahte servislerin paylasilan durumu (kilitli)."""

    def __init__(self, port):
        self.port = port
        self.kilit = threading.RLock()
        self.sifirla()

    def sifirla(self):
        with self.kilit:
            self.odemeler = {}          # id -> odeme (ekleme sirasi = olusma sirasi)
            self.idem = {}              # Idempotency-Key -> odeme id
            self.postalar = []
            self.brevo_deneme = 0
            self.brevo_atla = 0
            self.brevo_basarisiz = 0
            self.brevo_gecikme_ms = 0
            self.mollie_basarisiz = 0
            self.sayfa_ust = 250
            self.google = {"metre": 56400, "durum": "OK", "oge": "OK", "http": 200}
            self.google_log = []
            self.webhook_log = []


DURUM = None


# ================================================================ Mollie yardimcilari
def mollie_hata(kod, baslik, detay, alan=None):
    j = {"status": kod, "title": baslik, "detail": detay,
         "_links": {"documentation": {"href": "https://docs.mollie.com/overview/handling-errors", "type": "text/html"}}}
    if alan:
        j["field"] = alan
    return kod, j


def odeme_json(p):
    """Disari verilen odeme nesnesi (Mollie bicimi)."""
    c = json.loads(json.dumps(p))
    base = f"http://127.0.0.1:{DURUM.port}"
    c["_links"] = {
        "self": {"href": f"{base}/v2/payments/{p['id']}", "type": "application/hal+json"},
        "dashboard": {"href": f"https://my.mollie.com/dashboard/org_0/payments/{p['id']}", "type": "text/html"},
    }
    if p["status"] == "open":
        c["_links"]["checkout"] = {"href": f"{base}/checkout/{p['id']}", "type": "text/html"}
    else:
        c["_links"]["checkout"] = None
    c["_links"]["documentation"] = {"href": "https://docs.mollie.com/reference/create-payment", "type": "text/html"}
    return c


def dogrula_odeme(g):
    """POST /payments govdesini dogrular. Doner: None | (alan, detay)."""
    if not isinstance(g, dict):
        return ("body", "The request body must be a JSON object")
    a = g.get("amount")
    if not isinstance(a, dict):
        return ("amount", "The amount is invalid")
    if a.get("currency") != "EUR":
        return ("amount.currency", "The currency is invalid: only EUR is accepted by this mock")
    v = a.get("value")
    if not isinstance(v, str) or not re.fullmatch(r"\d+\.\d{2}", v) or float(v) <= 0:
        return ("amount.value", "The amount value is invalid (expected a positive string with 2 decimals, e.g. '10.00')")
    d = g.get("description")
    if not isinstance(d, str) or not d.strip():
        return ("description", "The description is invalid")
    for alan in ("redirectUrl", "webhookUrl"):
        u = g.get(alan)
        if alan == "webhookUrl" and u is None:
            continue
        if not isinstance(u, str) or not re.match(r"^https?://\S+$", u):
            return (alan, f"The {alan} is invalid")
    if "locale" in g and g["locale"] not in LOCALES:
        return ("locale", "The locale is invalid")
    if "method" in g:
        m = g["method"]
        liste = m if isinstance(m, list) else [m]
        if not liste or not all(isinstance(x, str) and x in YONTEMLER for x in liste):
            return ("method", "The payment method is invalid")
    if "metadata" in g and g["metadata"] is not None:
        if metadata_bayt(g["metadata"]) > METADATA_SINIRI:
            return ("metadata", f"The metadata is too large: at most {METADATA_SINIRI} bytes of JSON are allowed")
    return None


def yeni_id():
    while True:
        i = "tr_" + "".join(secrets.choice(ID_ALFABE) for _ in range(10))
        if i not in DURUM.odemeler:
            return i


def webhook_cagir(odeme):
    """Odemenin webhookUrl'sine `id=<id>` POST eder. Doner: (durum_kodu, govde)."""
    url = odeme.get("webhookUrl")
    if not url:
        return None, "webhookUrl yok"
    veri = urllib.parse.urlencode({"id": odeme["id"]}).encode()
    istek = urllib.request.Request(url, data=veri, method="POST",
                                   headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(istek, timeout=30) as r:
            kod, govde = r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        kod, govde = e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # baglanti hatasi vb.
        kod, govde = None, "HATA: " + type(e).__name__
    with DURUM.kilit:
        DURUM.webhook_log.append({"id": odeme["id"], "kod": kod, "govde": govde[:200]})
    return kod, govde


# ================================================================ HTTP isleyici
class Isleyici(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "EuropaMock/1.0"

    def log_message(self, *args):  # sessiz
        pass

    # ---------------------------------------------------------- yanit yardimcilari
    def json_gonder(self, kod, veri, ek=None):
        govde = json.dumps(veri, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(govde)))
        for k, v in (ek or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(govde)

    def html_gonder(self, kod, metin):
        govde = metin.encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(govde)))
        self.end_headers()
        self.wfile.write(govde)

    def govde_oku(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n > 0 else b""

    def json_govde(self):
        ham = self.govde_oku()
        try:
            return json.loads(ham.decode("utf-8")), None
        except Exception:
            return None, ham

    # ---------------------------------------------------------- yonlendirme
    def do_GET(self):
        self.dagit("GET")

    def do_POST(self):
        self.dagit("POST")

    def do_PATCH(self):
        self.dagit("PATCH")

    def do_DELETE(self):
        self.dagit("DELETE")

    def dagit(self, yontem):
        try:
            u = urllib.parse.urlsplit(self.path)
            yol = u.path
            q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query, keep_blank_values=True).items()}
            if yol.startswith("/v2/"):
                self.mollie(yontem, yol[4:], q)
            elif yol.startswith("/v3/"):
                self.brevo(yontem, yol[4:])
            elif yol == "/maps/api/distancematrix/json":
                self.google(yontem, q)
            elif yol.startswith("/checkout/"):
                self.html_gonder(200, "<!doctype html><title>Sahte Mollie checkout</title><h1>Sahte checkout</h1><p>%s</p>"
                                 % urllib.parse.quote(yol.split("/")[-1]))
            elif yol.startswith("/__test/"):
                self.kontrol(yontem, yol[len("/__test/"):], q)
            else:
                self.json_gonder(404, {"hata": "bilinmeyen yol", "yol": yol})
        except BrokenPipeError:
            pass
        except Exception as e:  # mock'un kendi hatasi test sonucunu gizlemesin
            try:
                self.json_gonder(500, {"mock_hata": type(e).__name__, "mesaj": str(e)})
            except Exception:
                pass

    # ---------------------------------------------------------- MOLLIE
    def mollie_yetki(self):
        b = self.headers.get("Authorization", "")
        if not re.fullmatch(r"Bearer test_\S+", b):
            self.json_gonder(*mollie_hata(401, "Unauthorized Request", "Missing authentication, or failed to authenticate"))
            return False
        return True

    def mollie(self, yontem, yol, q):
        if not self.mollie_yetki():
            self.govde_oku() if yontem in ("POST", "PATCH") else None
            return
        with DURUM.kilit:
            if DURUM.mollie_basarisiz > 0:
                DURUM.mollie_basarisiz -= 1
                basarisiz = True
            else:
                basarisiz = False
        if basarisiz:
            if yontem in ("POST", "PATCH"):
                self.govde_oku()
            self.json_gonder(*mollie_hata(500, "Internal Server Error", "Simulated Mollie outage (/__test/mollie_fail)"))
            return

        if yol == "payments" and yontem == "POST":
            return self.odeme_olustur()
        if yol == "payments" and yontem == "GET":
            return self.odeme_listele(q)
        m = re.fullmatch(r"payments/([^/]+)", yol)
        if m and yontem == "GET":
            with DURUM.kilit:
                p = DURUM.odemeler.get(m.group(1))
                if p is None:
                    return self.json_gonder(*mollie_hata(404, "Not Found", f"No payment exists with token {m.group(1)}."))
                return self.json_gonder(200, odeme_json(p))
        if m and yontem == "PATCH":
            return self.odeme_guncelle(m.group(1))
        if yol == "methods" and yontem == "GET":
            yontemler = [{"resource": "method", "id": y, "description": y.capitalize(), "status": "activated"}
                         for y in AKTIF_YONTEMLER]
            return self.json_gonder(200, {"count": len(yontemler), "_embedded": {"methods": yontemler}})
        self.json_gonder(*mollie_hata(404, "Not Found", "No such Mollie mock endpoint"))

    def odeme_olustur(self):
        g, ham = self.json_govde()
        if g is None:
            return self.json_gonder(*mollie_hata(422, "Unprocessable Entity", "The request body is not valid JSON"))
        idem = self.headers.get("Idempotency-Key")
        with DURUM.kilit:
            if idem and idem in DURUM.idem:
                return self.json_gonder(201, odeme_json(DURUM.odemeler[DURUM.idem[idem]]))
        hata = dogrula_odeme(g)
        if hata:
            return self.json_gonder(*mollie_hata(422, "Unprocessable Entity", hata[1], hata[0]))
        with DURUM.kilit:
            i = yeni_id()
            olusma = simdi()
            p = {
                "resource": "payment",
                "id": i,
                "mode": "test",
                "createdAt": iso(olusma),
                "amount": g["amount"],
                "description": g["description"],
                "method": None,
                "metadata": g.get("metadata"),
                "status": "open",
                "isCancelable": False,
                "expiresAt": iso(olusma + timedelta(minutes=15)),
                "locale": g.get("locale", "en_US"),
                "redirectUrl": g["redirectUrl"],
                "webhookUrl": g.get("webhookUrl"),
                "restrictPaymentMethodsToCountry": None,
                "sequenceType": "oneoff",
                "profileId": "pfl_mock",
            }
            DURUM.odemeler[i] = p
            if idem:
                DURUM.idem[idem] = i
            return self.json_gonder(201, odeme_json(p))

    def odeme_guncelle(self, pid):
        g, _ = self.json_govde()
        with DURUM.kilit:
            p = DURUM.odemeler.get(pid)
            if p is None:
                return self.json_gonder(*mollie_hata(404, "Not Found", f"No payment exists with token {pid}."))
            if not isinstance(g, dict):
                return self.json_gonder(*mollie_hata(422, "Unprocessable Entity", "The request body is not valid JSON"))
            if "metadata" in g:
                if g["metadata"] is not None and metadata_bayt(g["metadata"]) > METADATA_SINIRI:
                    return self.json_gonder(*mollie_hata(422, "Unprocessable Entity",
                                                         f"The metadata is too large: at most {METADATA_SINIRI} bytes of JSON are allowed",
                                                         "metadata"))
                p["metadata"] = g["metadata"]
            if "description" in g and isinstance(g["description"], str) and g["description"].strip():
                p["description"] = g["description"]
            return self.json_gonder(200, odeme_json(p))

    def odeme_listele(self, q):
        try:
            limit = int(q.get("limit", "50"))
        except ValueError:
            return self.json_gonder(*mollie_hata(422, "Unprocessable Entity", "The limit is invalid", "limit"))
        if limit < 1:
            return self.json_gonder(*mollie_hata(422, "Unprocessable Entity", "The limit is invalid", "limit"))
        with DURUM.kilit:
            limit = min(limit, 250, DURUM.sayfa_ust)
            sirali = list(reversed(list(DURUM.odemeler.values())))  # en yeni ilk
            baslangic = 0
            if q.get("from"):
                idler = [p["id"] for p in sirali]
                if q["from"] not in idler:
                    return self.json_gonder(*mollie_hata(404, "Not Found", "The `from` payment does not exist", "from"))
                baslangic = idler.index(q["from"])
            dilim = sirali[baslangic:baslangic + limit]
            sonraki = sirali[baslangic + limit] if baslangic + limit < len(sirali) else None
            base = f"http://127.0.0.1:{DURUM.port}/v2/payments"
            govde = {
                "count": len(dilim),
                "_embedded": {"payments": [odeme_json(p) for p in dilim]},
                "_links": {
                    "self": {"href": f"{base}?limit={limit}", "type": "application/hal+json"},
                    "previous": None,
                    "next": {"href": f"{base}?from={sonraki['id']}&limit={limit}", "type": "application/hal+json"} if sonraki else None,
                    "documentation": {"href": "https://docs.mollie.com/reference/list-payments", "type": "text/html"},
                },
            }
            return self.json_gonder(200, govde)

    # ---------------------------------------------------------- BREVO
    def brevo(self, yontem, yol):
        anahtar = self.headers.get("api-key", "")
        if yontem == "POST":
            ham = self.govde_oku()
        else:
            ham = b""
        if not anahtar.strip():
            return self.json_gonder(401, {"code": "unauthorized", "message": "Key not found"})
        if yol == "account" and yontem == "GET":
            return self.json_gonder(200, {"email": "mock@example.test", "companyName": "Mock Co", "plan": [{"type": "free"}]})
        if yol == "smtp/email" and yontem == "POST":
            with DURUM.kilit:
                gecikme = DURUM.brevo_gecikme_ms
            if gecikme:
                time.sleep(gecikme / 1000.0)
            try:
                g = json.loads(ham.decode("utf-8"))
            except Exception:
                return self.json_gonder(400, {"code": "invalid_parameter", "message": "Body is not valid JSON"})
            hata = None
            if not isinstance(g, dict):
                hata = "body must be an object"
            else:
                gonderen = g.get("sender") or {}
                alicilar = g.get("to")
                if not isinstance(gonderen, dict) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", str(gonderen.get("email", ""))):
                    hata = "sender.email is invalid"
                elif not isinstance(alicilar, list) or not alicilar or not all(
                        isinstance(a, dict) and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", str(a.get("email", ""))) for a in alicilar):
                    hata = "to[].email is invalid"
                elif not isinstance(g.get("subject"), str) or not g["subject"].strip():
                    hata = "subject is required"
                elif not (g.get("htmlContent") or g.get("textContent")):
                    hata = "htmlContent or textContent is required"
            if hata:
                return self.json_gonder(400, {"code": "invalid_parameter", "message": hata})
            with DURUM.kilit:
                DURUM.brevo_deneme += 1
                if DURUM.brevo_atla > 0:
                    DURUM.brevo_atla -= 1
                elif DURUM.brevo_basarisiz > 0:
                    DURUM.brevo_basarisiz -= 1
                    return self.json_gonder(500, {"code": "internal_server_error", "message": "Simulated Brevo failure (/__test/brevo_fail)"})
                mesaj_id = f"<{secrets.token_hex(8)}@smtp-relay.mock>"
                DURUM.postalar.append({
                    "id": mesaj_id,
                    "zaman": iso(simdi()),
                    "gonderen": gonderen,
                    "alicilar": [a["email"] for a in alicilar],
                    "konu": g["subject"],
                    "html": g.get("htmlContent", ""),
                    "metin": g.get("textContent", ""),
                    "api_key_uzunluk": len(anahtar),
                })
            return self.json_gonder(201, {"messageId": mesaj_id})
        self.json_gonder(404, {"code": "not_found", "message": "No such Brevo mock endpoint"})

    # ---------------------------------------------------------- GOOGLE
    def google(self, yontem, q):
        with DURUM.kilit:
            ayar = dict(DURUM.google)
            DURUM.google_log.append({"origins": q.get("origins"), "destinations": q.get("destinations"),
                                     "key_var": bool(q.get("key"))})
        if ayar["http"] != 200:
            return self.json_gonder(ayar["http"], {"error": "simulated"})
        if not q.get("key"):
            return self.json_gonder(200, {"status": "REQUEST_DENIED", "error_message": "You must use an API key to authenticate each request",
                                          "rows": [], "origin_addresses": [], "destination_addresses": []})
        if ayar["durum"] != "OK":
            return self.json_gonder(200, {"status": ayar["durum"], "error_message": "simulated",
                                          "rows": [], "origin_addresses": [], "destination_addresses": []})
        if ayar["oge"] != "OK":
            oge = {"status": ayar["oge"]}
        else:
            metre = int(ayar["metre"])
            oge = {"status": "OK",
                   "distance": {"text": f"{metre / 1000:.1f} km", "value": metre},
                   "duration": {"text": "1 hour", "value": 3600}}
        return self.json_gonder(200, {"status": "OK", "origin_addresses": [q.get("origins", "")],
                                      "destination_addresses": [q.get("destinations", "")],
                                      "rows": [{"elements": [oge]}]})

    # ---------------------------------------------------------- TEST KONTROL
    def kontrol(self, yontem, yol, q):
        parcalar = yol.strip("/").split("/")
        ad = parcalar[0]
        arg = parcalar[1] if len(parcalar) > 1 else None
        if yontem == "POST":
            ham = self.govde_oku()
        else:
            ham = b""

        if ad == "state":
            with DURUM.kilit:
                return self.json_gonder(200, {
                    "odemeler": list(DURUM.odemeler.values()),
                    "posta_sayisi": len(DURUM.postalar),
                    "brevo_deneme": DURUM.brevo_deneme,
                    "webhook_log": DURUM.webhook_log,
                })
        if ad == "reset":
            DURUM.sifirla()
            return self.json_gonder(200, {"ok": True})
        if ad == "mails":
            if arg == "reset":
                with DURUM.kilit:
                    DURUM.postalar.clear()
                    DURUM.brevo_deneme = 0
                return self.json_gonder(200, {"ok": True})
            with DURUM.kilit:
                return self.json_gonder(200, {"sayi": len(DURUM.postalar), "postalar": list(DURUM.postalar),
                                              "brevo_deneme": DURUM.brevo_deneme})
        if ad == "brevo_fail":
            with DURUM.kilit:
                DURUM.brevo_basarisiz = int(arg or 1)
                DURUM.brevo_atla = int(q.get("skip", "0"))
            return self.json_gonder(200, {"ok": True})
        if ad == "brevo_delay":
            with DURUM.kilit:
                DURUM.brevo_gecikme_ms = int(arg or 0)
            return self.json_gonder(200, {"ok": True})
        if ad == "mollie_fail":
            with DURUM.kilit:
                DURUM.mollie_basarisiz = int(arg or 1)
            return self.json_gonder(200, {"ok": True})
        if ad == "page_size":
            with DURUM.kilit:
                DURUM.sayfa_ust = max(1, min(250, int(arg or 250)))
            return self.json_gonder(200, {"ok": True})
        if ad == "google":
            if arg == "log":
                with DURUM.kilit:
                    return self.json_gonder(200, {"istekler": list(DURUM.google_log)})
            if arg == "set":
                with DURUM.kilit:
                    if "meters" in q:
                        DURUM.google["metre"] = int(q["meters"])
                    if "status" in q:
                        DURUM.google["durum"] = q["status"]
                    if "element" in q:
                        DURUM.google["oge"] = q["element"]
                    if "http" in q:
                        DURUM.google["http"] = int(q["http"])
                    return self.json_gonder(200, {"ok": True, "google": DURUM.google})
            if arg == "reset":
                with DURUM.kilit:
                    DURUM.google = {"metre": 56400, "durum": "OK", "oge": "OK", "http": 200}
                    DURUM.google_log.clear()
                return self.json_gonder(200, {"ok": True})

        # ---- odeme durum kontrolleri
        durumlar = {"paid", "expired", "failed", "canceled", "refund", "chargeback", "webhook", "tamper", "set_metadata"}
        if ad in durumlar:
            with DURUM.kilit:
                p = DURUM.odemeler.get(arg or "")
                if p is None:
                    return self.json_gonder(404, {"hata": "odeme yok", "id": arg})
                webhook_gerek = q.get("webhook", "1") != "0"
                if ad == "paid":
                    p["status"] = "paid"
                    if "paid_at" in q:
                        p["paidAt"] = q["paid_at"]
                    else:
                        p["paidAt"] = iso(simdi() - timedelta(hours=float(q.get("hours_ago", "0"))))
                    if "amount" in q:
                        p["amount"]["value"] = q["amount"]
                elif ad in ("expired", "failed", "canceled"):
                    p["status"] = ad
                    p[{"expired": "expiredAt", "failed": "failedAt", "canceled": "canceledAt"}[ad]] = iso(simdi())
                elif ad == "refund":
                    tutar = q.get("amount") or p["amount"]["value"]
                    p["amountRefunded"] = {"currency": p["amount"]["currency"], "value": tutar}
                    p["amountRemaining"] = {"currency": p["amount"]["currency"], "value": "0.00"}
                elif ad == "chargeback":
                    tutar = q.get("amount") or p["amount"]["value"]
                    p["amountChargedBack"] = {"currency": p["amount"]["currency"], "value": tutar}
                elif ad == "tamper":
                    p["amount"]["value"] = q.get("amount", "1.00")
                    webhook_gerek = False
                elif ad == "set_metadata":
                    try:
                        p["metadata"] = json.loads(ham.decode("utf-8"))
                    except Exception:
                        return self.json_gonder(400, {"hata": "govde JSON degil"})
                    webhook_gerek = False
                elif ad == "webhook":
                    webhook_gerek = True
                kopya = json.loads(json.dumps(p))
            yanit = {"ok": True, "id": arg, "durum": kopya["status"]}
            if webhook_gerek:
                kod, govde = webhook_cagir(kopya)   # kilit DISINDA: uygulama Mollie'yi (bu sunucuyu) sorgulayacak
                yanit["webhook"] = {"kod": kod, "govde": govde}
            return self.json_gonder(200, yanit)

        self.json_gonder(404, {"hata": "bilinmeyen test ucu", "yol": yol})


class Sunucu(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64


def main():
    global DURUM
    ap = argparse.ArgumentParser(description="europetaxi24 sahte dis servisler (Mollie + Brevo + Google)")
    ap.add_argument("--port", type=int, default=9500)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    DURUM = Durum(a.port)
    s = Sunucu((a.host, a.port), Isleyici)
    print(f"mock hazir http://{a.host}:{a.port}", flush=True)
    try:
        s.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
