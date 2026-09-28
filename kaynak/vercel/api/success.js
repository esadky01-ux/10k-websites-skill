'use strict';
// ============================================================
// EUROPA TAXI — odeme donus sayfasi (GET /pay/success.php?order=... -> /api/success)
// Webhook birkac saniye gecikebilir: musteriye yanlislikla "odeme tamamlanmadi" GOSTERILMEZ.
// Durum Mollie'den CANLI sorulur:
//   1. et_p cerezi (imza zaman-sabit dogrulanir) -> odeme id -> GET /payments/{id}
//   2. cerez yoksa/gecersizse: Mollie 'list payments' (limit=100) icinde metadata.n === order
// paid -> onay | open/pending/authorized/bilinmeyen -> "isleniyor" (6 sn yenileme, ASLA "basarisiz" denmez)
// failed/canceled/expired -> basarisiz (yeniden dene + WhatsApp). Bulunamazsa genel "isleniyor" + iletisim; 404 yok.
// 4 dilli, marka gorunumlu, noindex.
// ============================================================

const { t, dilSec, isletme, para } = require('./_lib/dil');
const { h, miniSayfa, yanitHtml, yanitMetin } = require('./_lib/html');
const { sarmala, cerezOku, odemeCerezindenId } = require('./_lib/guvenlik');
const { odemeGetir, odemeListele } = require('./_lib/mollie');
const { metadataDanSiparis, siparisNoGecerli } = require('./_lib/siparis');
const { kayit } = require('./_lib/log');

const YENILE_SN = 6;
const YENILE_EN_FAZLA = 40;   // ~4 dk sonra otomatik yenileme durur (terk edilmis sekme Mollie'yi dovmesin)

function sorgu(req) {
  try {
    return new URL(req.url || '/', 'http://x').searchParams;
  } catch (_) {
    return new URLSearchParams();
  }
}

/** Cerez varsa ve order ile eslesiyorsa o odemeyi, yoksa listeden buluruz. Doner: odeme | null | 'ulasilamadi' */
async function odemeBul(req, siparisNo) {
  let mollieUlasilamadi = false;

  const cerezId = odemeCerezindenId(cerezOku(req).et_p);
  if (cerezId) {
    const { kod, veri } = await odemeGetir(cerezId);
    if (kod === 200 && veri.metadata && veri.metadata.n === siparisNo) return veri;
    if (kod !== 200 && kod !== 404) mollieUlasilamadi = true;
  }

  const { kod, veri } = await odemeListele(100);
  if (kod === 200) {
    const liste = veri._embedded && Array.isArray(veri._embedded.payments) ? veri._embedded.payments : [];
    const bulunan = liste.find((o) => o && o.metadata && o.metadata.n === siparisNo);
    if (bulunan) return bulunan;
  } else {
    mollieUlasilamadi = true;
  }
  return mollieUlasilamadi ? 'ulasilamadi' : null;
}

function iletisimDugmeleri(dil, ek) {
  const i = isletme();
  let s = '<div class="btnler">' + (ek || '');
  if (i.whatsapp) s += '<a class="btn btn--wa" href="' + h(i.whatsapp) + '" rel="noopener">' + h(t(dil, 'succ_wa')) + '</a>';
  if (i.telefon_link) s += '<a class="btn btn--dis" href="tel:' + h(i.telefon_link) + '">' + h(i.telefon || i.telefon_link) + '</a>';
  s += '<a class="btn btn--dis" href="/' + h(dil) + '/">' + h(t(dil, 'succ_home')) + '</a></div>';
  return s;
}

/** Bulunamayan / bozuk siparis: genel "isleniyor" + iletisim. */
function genelSayfa(res, dil, siparisNo, yenileUrl) {
  const ref = siparisNo ? '<p class="ref">' + h(t(dil, 'succ_ref', { ref: siparisNo })) + '</p>' : '';
  yanitHtml(res, 200, miniSayfa(dil, t(dil, 'succ_pending_t'),
    '<p>' + h(t(dil, 'succ_pending_d')) + '</p>' + ref + iletisimDugmeleri(dil),
    yenileUrl ? YENILE_SN : 0, yenileUrl));
}

module.exports = sarmala('success', async function handler(req, res, ctx) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    yanitMetin(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }
  const q = sorgu(req);
  const siparisNo = String(q.get('order') || '');
  let dil = dilSec(q.get('dil'));
  ctx.dil = dil;

  // ---- bozuk / eksik order: temiz genel sayfa (yenileme yok)
  if (!siparisNoGecerli(siparisNo)) {
    genelSayfa(res, dil, '', null);
    return;
  }
  ctx.no = siparisNo;

  const sayac = Math.max(0, Math.min(YENILE_EN_FAZLA, parseInt(q.get('n') || '0', 10) || 0));
  const yenileAdresi = (d) => (sayac < YENILE_EN_FAZLA
    ? '/pay/success.php?order=' + siparisNo + '&dil=' + d + '&n=' + (sayac + 1)
    : null);

  const bulunan = await odemeBul(req, siparisNo);
  const s = bulunan && bulunan !== 'ulasilamadi' ? metadataDanSiparis(bulunan) : null;
  if (!s || s.no !== siparisNo) {
    if (bulunan === 'ulasilamadi') kayit('uyari', 'success: Mollie ulasilamadi ' + siparisNo);
    genelSayfa(res, dil, siparisNo, yenileAdresi(dil));
    return;
  }
  dil = s.dil;                       // musterinin siparis dili (metadata.l)
  ctx.dil = dil;
  const yenileUrl = yenileAdresi(dil);

  const i = isletme();
  const ref = '<p class="ref">' + h(t(dil, 'succ_ref', { ref: s.no })) + '</p>';
  const anaSayfa = '/' + dil + '/';
  const wa = (i.whatsapp || 'https://wa.me/32493839898') + '?text=' + encodeURIComponent(t(dil, 'succ_ref', { ref: s.no }));

  if (s.mollie_durum === 'paid') {
    // ---- odendi: onay (kalan tutar km'den sunucuda hesaplanir)
    yanitHtml(res, 200, miniSayfa(dil, t(dil, 'succ_paid_t'),
      '<p>' + h(t(dil, 'succ_paid_d', { rest: para(dil, s.kalan) })) + '</p>'
      + ref
      + '<div class="btnler"><a class="btn" href="' + h(anaSayfa) + '">' + h(t(dil, 'succ_home')) + '</a></div>'));
  } else if (s.durum === 'beklemede') {
    // ---- open / pending / authorized / bilinmeyen: henuz netlesmedi; sayfa kendini yeniler, "basarisiz" DENMEZ
    yanitHtml(res, 200, miniSayfa(dil, t(dil, 'succ_pending_t'),
      '<p>' + h(t(dil, 'succ_pending_d')) + '</p>' + ref,
      yenileUrl ? YENILE_SN : 0, yenileUrl));
  } else {
    // ---- failed / canceled / expired: para cekilmedi; yeniden dene veya WhatsApp
    yanitHtml(res, 200, miniSayfa(dil, t(dil, 'succ_fail_t'),
      '<p>' + h(t(dil, 'succ_fail_d')) + '</p>' + ref
      + '<div class="btnler">'
      + '<a class="btn" href="' + h(anaSayfa) + '#rezervasyon">' + h(t(dil, 'succ_retry')) + '</a>'
      + '<a class="btn btn--wa" href="' + h(wa) + '" rel="noopener">' + h(t(dil, 'succ_wa')) + '</a>'
      + '</div>'));
  }
});
