'use strict';
// ============================================================
// EUROPA TAXI — 4 dilli metinler ve bicim yardimcilari.
// Tum metinler dil.json'dan gelir (vercel_build.py, strings.json'dan uretir).
// Kod icine dil metni GOMULMEZ. PHP'deki ortak.php (t, para, tarih_goster) ile ayni davranis.
// ============================================================

const VERI = require('./dil.json'); // { diller: {fr:{..}, nl:{..}, en:{..}, tr:{..}}, isletme: {..} }

const DILLER = ['fr', 'nl', 'en', 'tr'];

/** Gecerli dil kodu; bilinmeyen her sey varsayilan fr olur. */
function dilSec(d) {
  return typeof d === 'string' && DILLER.includes(d) ? d : 'fr';
}

/** Metin sozlugunden ceviri getirir, {yer_tutucu} degerlerini doldurur (PHP t() ile ayni). */
function t(dil, anahtar, degerler) {
  const sozluk = VERI.diller[dilSec(dil)] || {};
  let soz = Object.prototype.hasOwnProperty.call(sozluk, anahtar) ? sozluk[anahtar] : anahtar;
  if (degerler) {
    for (const k of Object.keys(degerler)) {
      soz = soz.split('{' + k + '}').join(String(degerler[k]));
    }
  }
  return soz;
}

/** Anahtar dil.json'da varsa onu, yoksa yedek anahtari kullanir (opsiyonel yeni anahtarlar icin). */
function tYedekli(dil, anahtar, yedek, degerler) {
  const sozluk = VERI.diller[dilSec(dil)] || {};
  return t(dil, Object.prototype.hasOwnProperty.call(sozluk, anahtar) ? anahtar : yedek, degerler);
}

function isletme() {
  return VERI.isletme || {};
}

function binlik(tamSayiMetni, ayirac) {
  return tamSayiMetni.replace(/\B(?=(\d{3})+(?!\d))/g, ayirac);
}

/** Tamsayi sent -> "121,44 €" (fr/nl/tr) veya "€121.44" (en). PHP para() ile ayni. */
function paraSent(dil, sent) {
  const eksi = sent < 0 ? '-' : '';
  const a = Math.abs(Math.round(sent));
  const tam = String(Math.floor(a / 100));
  const kesir = String(a % 100).padStart(2, '0');
  if (dil === 'en') return eksi + '€' + binlik(tam, ',') + '.' + kesir;
  return eksi + binlik(tam, ' ') + ',' + kesir + ' €';
}

/** Ondalikli tutar (orn. 24.29) -> bicimli metin. Yalniz sent-tam degerler icin (1e-9 emniyet payi). */
function para(dil, tutar) {
  return paraSent(dil, Math.round(Number(tutar) * 100 + 1e-9));
}

/** "2026-08-30" + "14:30" -> dile gore okunur metin (PHP tarih_goster ile ayni). */
function tarihGoster(dil, tarih, saat) {
  if (!tarih) return '';
  const p = String(tarih).split('-');
  const okunur = p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(tarih);
  if (!saat) return okunur;
  return t(dil, 'dt_join', { date: okunur, time: saat });
}

module.exports = { DILLER, dilSec, t, tYedekli, isletme, para, paraSent, tarihGoster };
