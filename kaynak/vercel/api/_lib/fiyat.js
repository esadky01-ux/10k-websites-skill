'use strict';
// ============================================================
// EUROPA TAXI — fiyat hesabi (sunucu tarafi, tek dogruluk kaynagi).
//
//   toplam = 10 + km * 1,99   kapora = %20 (yarim yukari)   kalan = toplam - kapora
//
// Butun hesap TAMSAYI SENT aritmetigiyle yapilir (ondalik kayan nokta hatasi yok).
// Sabitler mesafe.json'dan gelir; o dosya kaynak/mesafe-verisi.json'dan uretilir ve
// vercel_build.py, template.html + pay/create.php ile esitligini denetler.
// PHP round() ile ayni sonuclar: paylasilan-vektorler.json ("fiyat") + 1..800 tarama testi.
// ============================================================

const S = require('./mesafe.json').sabitler;

function tamSent(deger, ad) {
  const x = deger * 100;
  const r = Math.round(x);
  if (Math.abs(x - r) > 1e-6) throw new Error('sabit sent-tam degil: ' + ad);
  return r;
}

const ACILIS_SENT = tamSent(S.acilis_ucreti, 'acilis_ucreti');   // 1000
const KM_SENT = tamSent(S.km_ucreti, 'km_ucreti');               // 199
const YUZDE_100 = tamSent(S.kapora_yuzde, 'kapora_yuzde');       // 2000 (yuzde x 100)
const MIN_KM = S.min_km;
const MAX_KM = S.max_km;

function sentMetni(sent) {
  return Math.floor(sent / 100) + '.' + String(sent % 100).padStart(2, '0');
}

/** km sinir kontrolu: tamsayi ve MIN_KM..MAX_KM. */
function kmGecerli(km) {
  return Number.isInteger(km) && km >= MIN_KM && km <= MAX_KM;
}

/**
 * Fiyat. Kapora = yarim yukari yuvarlanmis %20 (tamsayi sent):
 *   kaporaSent = floor((toplamSent * yuzde100 + 5000) / 10000)
 * Doner: sent degerleri + ondalik gosterim + Mollie amount.value metni.
 */
function fiyatHesapla(km) {
  if (!Number.isInteger(km)) throw new Error('km tamsayi olmali');
  const toplamSent = ACILIS_SENT + km * KM_SENT;
  const kaporaSent = Math.floor((toplamSent * YUZDE_100 + 5000) / 10000);
  const kalanSent = toplamSent - kaporaSent;
  return {
    km,
    toplamSent,
    kaporaSent,
    kalanSent,
    toplam: toplamSent / 100,
    kapora: kaporaSent / 100,
    kalan: kalanSent / 100,
    toplamStr: sentMetni(toplamSent),
    kaporaStr: sentMetni(kaporaSent),
    kalanStr: sentMetni(kalanSent),
  };
}

module.exports = { fiyatHesapla, kmGecerli, sentMetni, MIN_KM, MAX_KM };
