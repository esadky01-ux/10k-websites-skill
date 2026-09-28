'use strict';
// ============================================================
// EUROPA TAXI — kayit (log) yardimcisi.
// KURAL: yalniz siparis numarasi, odeme id'si ve durum/kod yazilir.
// Kisisel veri (e-posta/telefon/adres/ad) ve sirlar ASLA yazilmaz.
// Asagidaki temizleyici, yanlislikla gecen bir e-posta / telefon / anahtar
// benzeri metni son bir emniyet olarak maskeler.
// ============================================================

const EPOSTA = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TELEFON = /\d(?:[\s().-]?\d){7,}/g;                 // >= 8 rakam (bosluk/nokta/tire ile bolunmus olabilir)
const ANAHTAR = /\b(?:test|live)_[A-Za-z0-9]{8,}/g;       // Mollie anahtari benzeri
const UZUN_TOKEN = /[A-Za-z0-9_-]{32,}/g;                 // uzun sir benzeri diziler (siparis no / odeme id bunlardan kisadir)

const SIPARIS_NO = /ET-[0-9]{6}-[A-Z0-9]{6}/g;   // siparis numarasi (rakamdan olusabilir; telefon gibi maskelenmemeli)
const KORU_ACIK = String.fromCharCode(1);
const KORU_KAPA = String.fromCharCode(2);

function temizle(metin) {
  const saklanan = [];
  const korunmus = String(metin).replace(SIPARIS_NO, (m) => {
    saklanan.push(m);
    return KORU_ACIK + (saklanan.length - 1) + KORU_KAPA;
  });
  const maskeli = korunmus
    .replace(/[\r\n\t]+/g, ' ')
    .replace(EPOSTA, '[eposta]')
    .replace(ANAHTAR, '[anahtar]')
    .replace(UZUN_TOKEN, '[token]')
    .replace(TELEFON, '[sayi]');
  return maskeli
    .replace(new RegExp(KORU_ACIK + '(\\d+)' + KORU_KAPA, 'g'), (_, i) => saklanan[Number(i)])
    .slice(0, 300);
}

/** seviye: 'bilgi' | 'uyari' | 'hata' */
function kayit(seviye, mesaj) {
  const satir = '[et] ' + seviye + ' ' + temizle(mesaj);
  if (seviye === 'hata' || seviye === 'uyari') console.error(satir);
  else console.log(satir);
}

const birKezGorulen = new Set();
/** Ayni uyari surec basina yalniz bir kez yazilir (soguk baslangic gurultusunu onler). */
function birKez(anahtar, seviye, mesaj) {
  if (birKezGorulen.has(anahtar)) return;
  birKezGorulen.add(anahtar);
  kayit(seviye, mesaj);
}

module.exports = { kayit, birKez, temizle };
