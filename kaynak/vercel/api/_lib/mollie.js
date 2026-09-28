'use strict';
// ============================================================
// EUROPA TAXI — Mollie API istemcisi (yalniz global fetch).
// Doner deger her zaman { kod, veri }: kod=0 ag/zaman asimi/ayar hatasi, veri = ayrilmis JSON (yoksa {}).
// Anahtar ve yanit govdeleri loglanmaz (yanit kisisel veri icerir); yalniz HTTP kodu.
// ============================================================

const { cfg } = require('./config');
const { kayit } = require('./log');

const ODEME_ID = /^tr_[A-Za-z0-9]+$/;

async function mollie(yontem, yol, govde, secenek) {
  const c = cfg();
  if (!c.mollieBase) return { kod: 0, veri: { hata: 'MOLLIE_API_BASE gecersiz' } };
  if (!c.mollieKey) return { kod: 0, veri: { hata: 'MOLLIE_API_KEY yok' } };
  const s = secenek || {};
  const basliklar = { Authorization: 'Bearer ' + c.mollieKey, Accept: 'application/json' };
  const ayar = { method: yontem, headers: basliklar, signal: AbortSignal.timeout(s.zamanAsimi || 10000), redirect: 'error' };
  if (govde !== undefined && govde !== null) {
    basliklar['Content-Type'] = 'application/json';
    ayar.body = JSON.stringify(govde);
  }
  // Idempotency-Key yalniz guvenli bicimdeyse gonderilir (PHP ortak.php mollie() ile ayni: ^[A-Za-z0-9-]{1,80}$)
  if (s.idempotency && /^[A-Za-z0-9-]{1,80}$/.test(String(s.idempotency))) basliklar['Idempotency-Key'] = String(s.idempotency);
  try {
    const r = await fetch(c.mollieBase + '/' + String(yol).replace(/^\/+/, ''), ayar);
    let veri = {};
    try {
      const j = JSON.parse(await r.text());
      if (j && typeof j === 'object' && !Array.isArray(j)) veri = j;
    } catch (_) { /* JSON degil: bos */ }
    return { kod: r.status, veri };
  } catch (e) {
    kayit('uyari', 'Mollie ag hatasi (' + yontem + '): ' + (e && (e.name || e.code)));
    return { kod: 0, veri: { hata: String(e && e.name) } };
  }
}

/** GET /payments/{id}. Gecersiz id ag'a hic gitmez. */
function odemeGetir(id) {
  if (!ODEME_ID.test(String(id))) return Promise.resolve({ kod: 400, veri: {} });
  return mollie('GET', 'payments/' + id);
}

/** GET /payments?limit=&from= — en yeni ilk. */
function odemeListele(limit, from) {
  let yol = 'payments?limit=' + encodeURIComponent(String(limit));
  if (from) {
    if (!ODEME_ID.test(String(from))) return Promise.resolve({ kod: 400, veri: {} });
    yol += '&from=' + encodeURIComponent(from);
  }
  return mollie('GET', yol);
}

/** Sonraki sayfa imleci: _links.next.href icindeki `from` (URL kor kor kullanilmaz; yalniz id alinir). */
function sonrakiImlec(veri) {
  const href = veri && veri._links && veri._links.next && veri._links.next.href;
  if (typeof href !== 'string') return null;
  try {
    const f = new URL(href).searchParams.get('from');
    return f && ODEME_ID.test(f) ? f : null;
  } catch (_) {
    return null;
  }
}

/**
 * Siparis (metadata.v===1) odemelerini sayfalayarak listeler. En yeni ilk.
 * Doner: { ok, odemeler:[...], kesildi:bool } ; ok=false ise Mollie'ye ulasilamadi.
 */
async function siparisOdemeleri(enFazla, sayfaBoyutu, enFazlaSayfa) {
  const sonuc = [];
  let imlec = null;
  let sayfa = 0;
  let kesildi = false;
  const bakilan = new Set();
  do {
    const { kod, veri } = await odemeListele(sayfaBoyutu, imlec);
    if (kod !== 200) return { ok: false, odemeler: sonuc, kesildi };
    const liste = (veri._embedded && Array.isArray(veri._embedded.payments)) ? veri._embedded.payments : [];
    for (const o of liste) {
      if (o && o.metadata && typeof o.metadata === 'object' && o.metadata.v === 1) sonuc.push(o);
    }
    sayfa += 1;
    const sonraki = sonrakiImlec(veri);
    if (!sonraki || bakilan.has(sonraki)) { imlec = null; break; }
    bakilan.add(sonraki);
    imlec = sonraki;
    if (sonuc.length >= enFazla || sayfa >= enFazlaSayfa) { kesildi = true; break; }
  } while (imlec);
  if (sonuc.length > enFazla) { sonuc.length = enFazla; kesildi = true; }
  return { ok: true, odemeler: sonuc, kesildi };
}

module.exports = { mollie, odemeGetir, odemeListele, siparisOdemeleri, ODEME_ID };
