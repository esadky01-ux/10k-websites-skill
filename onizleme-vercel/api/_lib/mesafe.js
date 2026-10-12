'use strict';
// ============================================================
// EUROPA TAXI — mesafe: dahili tablo (istemci template.html motorunun BIREBIR portu),
// Google Distance Matrix (sunucu anahtari) ve km karar politikasi.
// ============================================================

const VERI = require('./mesafe.json'); // { sabitler, yerler:{anahtar:{a:{fr,nl,en,tr}, l:[lat,lng], h, t:[normalize takma adlar]}}, kesin:{"a|b":km} }
const { cfg } = require('./config');
const { kmGecerli } = require('./fiyat');
const { kayit } = require('./log');

const YOL_KATSAYI = VERI.sabitler.yol_katsayisi;

// ---- metin normallestirme: template.html JS'i / test_adim1.py ile ayni kurallar ----
function normalize(s) {
  s = String(s).toLowerCase().replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  s = s.normalize('NFD').replace(/[\u{300}-\u{36f}]/gu, '');
  s = s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

// ---- eslesme dizini: normalize ad/takma -> yer anahtari (istemcideki ESLESME ile ayni) ----
const ESLESME = {};
Object.keys(VERI.yerler).forEach((k) => {
  VERI.yerler[k].t.forEach((t) => { ESLESME[t] = k; });
});

/** Serbest metin adresten yer anahtari. En uzun eslesme kazanir. Bulamazsa null. */
function yerBul(girdi) {
  const n = normalize(girdi || '');
  if (!n) return null;
  if (ESLESME[n]) return ESLESME[n];
  const hedef = ' ' + n + ' ';
  let enIyi = null;
  let enUzun = 0;
  Object.keys(ESLESME).forEach((t) => {
    if (t.length > enUzun && hedef.indexOf(' ' + t + ' ') !== -1) { enIyi = ESLESME[t]; enUzun = t.length; }
  });
  return enIyi;
}

function haversineKm(a, b) {
  const R = 6371;
  const d2r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * d2r;
  const dLng = (b[1] - a[1]) * d2r;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a[0] * d2r) * Math.cos(b[0] * d2r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Dahili mesafe: once KESIN tablo, yoksa round(haversine x katsayi). Bulamazsa null. */
function dahiliMesafe(girdiA, girdiB) {
  const ka = yerBul(girdiA);
  const kb = yerBul(girdiB);
  if (!ka || !kb || ka === kb) return null;
  const kesin = VERI.kesin[ka + '|' + kb] || VERI.kesin[kb + '|' + ka];
  if (kesin) return kesin;
  return Math.round(haversineKm(VERI.yerler[ka].l, VERI.yerler[kb].l) * YOL_KATSAYI);
}

/**
 * Google'a gonderilebilecek adres mi? '|' Google'da coklu origin/destination ayiricisidir (enjeksiyon),
 * kontrol karakterleri (C0, DEL) istegi bozar; bos adres anlamsizdir. Guvensizse Google'a HIC cagri yapilmaz.
 */
function googleAdresiGuvenli(adres) {
  return typeof adres === 'string' && adres !== '' && !/[\x00-\x1F\x7F|]/.test(adres);
}

/**
 * Google Distance Matrix ile karayolu km'si (SUNUCU anahtariyla).
 * Anahtar yoksa / cagri basarisizsa / sonuc OK degilse null. Anahtar ve adresler loglanmaz.
 */
async function googleKm(alis, varis) {
  const c = cfg();
  if (!c.googleKey || !c.googleBase) return null;
  if (!googleAdresiGuvenli(alis) || !googleAdresiGuvenli(varis)) return null;   // HIC cagri yapma
  const url = c.googleBase + '/maps/api/distancematrix/json'
    + '?origins=' + encodeURIComponent(alis)
    + '&destinations=' + encodeURIComponent(varis)
    + '&mode=driving&units=metric&key=' + encodeURIComponent(c.googleKey);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: 'error' });
    if (!r.ok) { kayit('uyari', 'Google HTTP ' + r.status + '; dahili katmana dusuluyor'); return null; }
    const j = await r.json();
    const oge = j && j.rows && j.rows[0] && j.rows[0].elements && j.rows[0].elements[0];
    if (!j || j.status !== 'OK' || !oge || oge.status !== 'OK') {
      kayit('uyari', 'Google durum ' + String(j && j.status).slice(0, 30) + '/' + String(oge && oge.status).slice(0, 30) + '; dahili katmana dusuluyor');
      return null;
    }
    const metre = oge.distance && oge.distance.value;
    if (typeof metre !== 'number' || !Number.isFinite(metre)) return null;
    const km = Math.round(metre / 1000);
    return km > 0 ? km : null;
  } catch (e) {
    kayit('uyari', 'Google cagrisi basarisiz (' + (e && (e.name || e.code)) + '); dahili katmana dusuluyor');
    return null;
  }
}

/**
 * KM KARAR POLITIKASI (PHP ile ayni olacak; paylasilan-vektorler.json "km_karar" kilitler).
 *  - istemci km 1..800 disi          -> RET (null)
 *  - google var                      -> fark istemciye gore %tol'u ASARSA google, aksi istemci
 *  - google yok, dahili var          -> istemci < dahili*(1-tol/100) ise dahili, aksi istemci
 *  - ikisi de yok                    -> DOGRULANAMAZ -> RET (null)
 *  - sonuc 1..800 disi               -> RET (null)
 * Tamsayi aritmetigi: fark > tol% <=> |g-i|*100 > tol*g ; alt sinir <=> i*100 < d*(100-tol)
 */
function kmKarar(istemci, google, dahili, tol) {
  if (!kmGecerli(istemci)) return null;
  let km;
  if (Number.isInteger(google) && google > 0) {
    km = Math.abs(google - istemci) * 100 > tol * google ? google : istemci;
  } else if (Number.isInteger(dahili) && dahili > 0) {
    km = istemci * 100 < dahili * (100 - tol) ? dahili : istemci;
  } else {
    return null;
  }
  return kmGecerli(km) ? km : null;
}

module.exports = { normalize, yerBul, haversineKm, dahiliMesafe, googleKm, googleAdresiGuvenli, kmKarar, YERLER: VERI.yerler };
