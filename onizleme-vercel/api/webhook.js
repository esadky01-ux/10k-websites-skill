'use strict';
// ============================================================
// EUROPA TAXI — Mollie webhook'u (POST /pay/webhook.php -> /api/webhook)
// Mollie durum degisince buraya `id=tr_...` gonderir. POST verisine GUVENILMEZ:
// durum ve tutar her zaman Mollie API'sinden dogrulanir.
//
// E-posta yalniz 'paid' iken ve su korumalarla gonderilir (DURUMSUZ tasarim):
//   1. odenen tutar == metadata km'sinden sunucuda yeniden hesaplanan kapora (aksi: gonderme + hata logu)
//   2. amountRefunded / amountChargedBack > 0 ise gonderme (iade/geri odeme webhook'lari)
//   3. paidAt 48 saatten eskiyse gonderme (gec/tekrarlanan webhook)
//   4. odeme metadata'sinda m:1 isareti varsa gonderme (onceki basarili gonderim; Mollie'de kalici)
//   5. ayni surecte: odeme-id tabanli kilit + gonderildi hafizasi (yalniz en-iyi-caba, README)
// E-posta gonderimi basarisizsa 500 doner -> Mollie webhook'u yeniden dener.
// Kabul edilen ender risk: musteri e-postasi gitti, sirket e-postasi basarisiz olursa ve yeniden deneme
// BASKA bir sicak/soguk ornege duserse musteri e-postasi tekrar gider (ayni surecte hafiza bunu onler).
// ============================================================

const { formCoz, govdeOku, sarmala } = require('./_lib/guvenlik');
const { odemeGetir, mollie, ODEME_ID } = require('./_lib/mollie');
const { metadataDanSiparis } = require('./_lib/siparis');
const { epostaGonder, musteriEpostaHtml, sirketEpostaMetni } = require('./_lib/mail');
const { t } = require('./_lib/dil');
const { h, yanitMetin } = require('./_lib/html');
const { cfg } = require('./_lib/config');
const { kayit } = require('./_lib/log');

const PENCERE_MS = 48 * 3600 * 1000;      // paidAt en fazla bu kadar eski olabilir
const HAFIZA_MS = 72 * 3600 * 1000;       // surec ici "gonderildi" hafizasi omru

// ---- surec ici durum (serverless'ta YALNIZ en-iyi-caba: soguk baslangicta / baska orneklerde yoktur)
const kilitler = new Map();               // odemeId -> son islemin promise'i (siralayici)
const gonderilenler = new Map();          // odemeId -> { musteri, sirket, tam, zaman }

/** Ayni odeme id'si icin islemleri sirayla calistirir (es zamanli iki webhook'a karsi). */
async function kilitli(id, fn) {
  const onceki = kilitler.get(id) || Promise.resolve();
  let birak;
  const bu = new Promise((r) => { birak = r; });
  const zincir = onceki.then(() => bu);
  kilitler.set(id, zincir);
  await onceki;
  try {
    return await fn();
  } finally {
    birak();
    if (kilitler.get(id) === zincir) kilitler.delete(id);
  }
}

function hafizaTemizle() {
  if (gonderilenler.size < 500) return;
  const simdi = Date.now();
  for (const [id, d] of gonderilenler) if (simdi - d.zaman > HAFIZA_MS) gonderilenler.delete(id);
}

module.exports = sarmala('webhook', async function handler(req, res, ctx) {
  if (req.method !== 'POST') {
    yanitMetin(res, 405, 'Method Not Allowed', { Allow: 'POST' });
    return;
  }

  let govde;
  try {
    govde = await govdeOku(req);
  } catch (e) {
    if (e && e.kod === 413) { yanitMetin(res, 413, 'govde cok buyuk', { Connection: 'close' }); return; }
    throw e;
  }
  const odemeId = String(formCoz(govde).ilk('id') || '');

  // Mollie'yi tekrar denemeye zorlama: gecersiz id -> 200
  if (!ODEME_ID.test(odemeId)) {
    yanitMetin(res, 200, 'gecersiz istek');
    return;
  }

  await kilitli(odemeId, async () => {
    // ---- durumu Mollie'den DOGRULA (POST'a guvenme)
    const { kod, veri: odeme } = await odemeGetir(odemeId);
    if (kod === 404) {
      kayit('uyari', 'webhook: Mollie odemeyi bilmiyor ' + odemeId);
      yanitMetin(res, 200, 'odeme yok');
      return;
    }
    if (kod !== 200 || typeof odeme.status !== 'string') {
      kayit('hata', 'webhook: Mollie sorgusu basarisiz (HTTP ' + kod + ') ' + odemeId);
      yanitMetin(res, 500, 'mollie ulasilamadi');
      return;
    }

    const s = metadataDanSiparis(odeme);
    if (s === null) {
      kayit('uyari', 'webhook: siparis metadata\'si yok/gecersiz ' + odemeId);
      yanitMetin(res, 200, 'siparis yok');
      return;
    }
    ctx.no = s.no;

    if (odeme.status !== 'paid') {
      kayit('bilgi', 'webhook: ' + s.no + ' durum=' + odeme.status);
      yanitMetin(res, 200, 'OK');
      return;
    }

    // ---- (1) tutar dogrulamasi
    if (s.odenenPara !== 'EUR' || s.odenenTutar !== s.beklenenKapora) {
      kayit('hata', 'webhook: TUTAR UYUSMUYOR ' + s.no + ' odenen=' + s.odenenTutar + ' ' + s.odenenPara + ' beklenen=' + s.beklenenKapora + '; e-posta GONDERILMEDI');
      yanitMetin(res, 200, 'tutar uyusmuyor');
      return;
    }
    // ---- (2) iade / geri odeme
    if (s.iade > 0 || s.geriOdeme > 0) {
      kayit('bilgi', 'webhook: ' + s.no + ' iade/geri odeme var; e-posta gonderilmedi');
      yanitMetin(res, 200, 'OK');
      return;
    }
    // ---- (3) paidAt penceresi
    const paidMs = Date.parse(s.paidAt);
    if (!Number.isFinite(paidMs)) {
      kayit('hata', 'webhook: ' + s.no + ' paid ama paidAt yok/gecersiz; e-posta gonderilmedi');
      yanitMetin(res, 200, 'OK');
      return;
    }
    if (Date.now() - paidMs > PENCERE_MS) {
      kayit('bilgi', 'webhook: ' + s.no + ' paidAt 48 saatten eski; e-posta gonderilmedi');
      yanitMetin(res, 200, 'OK');
      return;
    }
    // ---- (4) Mollie'de kalici isaret ve (5) surec ici hafiza
    if (s.epostaIsareti) {
      kayit('bilgi', 'webhook: ' + s.no + ' e-postalar zaten gonderilmis (isaret)');
      yanitMetin(res, 200, 'OK');
      return;
    }
    let durum = gonderilenler.get(odemeId);
    if (durum && durum.tam) {
      kayit('bilgi', 'webhook: ' + s.no + ' e-postalar zaten gonderilmis (surec hafizasi)');
      yanitMetin(res, 200, 'OK');
      return;
    }
    if (!durum) {
      hafizaTemizle();
      durum = { musteri: false, sirket: false, tam: false, zaman: Date.now() };
      gonderilenler.set(odemeId, durum);
    }

    // ---- e-postalar: once musteri (kendi dilinde HTML onay), sonra sirket (duz metin is emri)
    if (!durum.musteri) {
      const sonuc = await epostaGonder(s.eposta, t(s.dil, 'em_subject', { ref: s.no }), musteriEpostaHtml(s));
      if (!sonuc.ok) {
        kayit('hata', 'webhook: musteri e-postasi gonderilemedi ' + s.no + ' -> 500 (Mollie yeniden deneyecek)');
        yanitMetin(res, 500, 'eposta hatasi');
        return;
      }
      if (sonuc.atlandi) {
        yanitMetin(res, 200, 'OK');
        return;
      }
      durum.musteri = true;
    }
    if (!durum.sirket) {
      const isEmri = sirketEpostaMetni(s);
      const sonuc = await epostaGonder(
        cfg().companyEmail,
        'Yeni rezervasyon · ' + s.no + ' · ' + s.alis + ' -> ' + s.varis,
        '<pre style="font-family:monospace;font-size:13px;">' + h(isEmri) + '</pre>',
        isEmri
      );
      if (!sonuc.ok) {
        kayit('hata', 'webhook: sirket e-postasi gonderilemedi ' + s.no + ' -> 500 (Mollie yeniden deneyecek)');
        yanitMetin(res, 500, 'eposta hatasi');
        return;
      }
      if (sonuc.atlandi) {
        yanitMetin(res, 200, 'OK');
        return;
      }
      durum.sirket = true;
    }
    durum.tam = true;
    kayit('bilgi', 'webhook: ' + s.no + ' e-postalar gonderildi');

    // ---- Mollie'de kalici isaret (best-effort): sonraki webhook'lar (baska orneklerde de) tekrar gondermez
    const yeniMeta = Object.assign({}, odeme.metadata, { m: 1 });
    const guncelle = await mollie('PATCH', 'payments/' + odemeId, { metadata: yeniMeta });
    if (guncelle.kod !== 200) {
      kayit('uyari', 'webhook: ' + s.no + ' m:1 isareti yazilamadi (HTTP ' + guncelle.kod + '); yalniz surec hafizasi/paidAt penceresi korur');
    }
    yanitMetin(res, 200, 'OK');
  });
});
