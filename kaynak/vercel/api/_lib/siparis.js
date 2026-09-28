'use strict';
// ============================================================
// EUROPA TAXI — siparis: girdi dogrulama, Mollie metadata (durumsuz depo), siparis no.
//
// DURUMSUZ TASARIM: diske hicbir sey yazilmaz. Siparis verisi, Mollie odemesinin
// `metadata` alanina KISALTILMIS anahtarlarla konur ve her okumada oradan alinir:
//   {v:1, n:siparisNo, l:dil, a:alis, b:varis, d:'YYYY-MM-DDTHH:MM', r:donus|'', p:yolcu,
//    g:buyuk valiz, s:kucuk valiz, c:arac, k:km, t:toplam, u:ad, e:eposta, h:telefon,
//    src:'g'|'d'}            (m:1 = e-postalar gonderildi isareti, webhook yazar)
// src: 'g' = km Google Distance Matrix (sunucu) ile dogrulandi, 'd' = dahili tablo ile.
// ============================================================

const crypto = require('node:crypto');
const { fiyatHesapla, kmGecerli } = require('./fiyat');
const { dilSec } = require('./dil');

// ---------------------------------------------------------------- zaman (Europe/Brussels)

const TARIH_BICIMI = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Brussels'e gore bugun: 'YYYY-MM-DD'. */
function bugunBrussels(simdi) {
  const p = {};
  for (const x of TARIH_BICIMI.formatToParts(simdi || new Date())) p[x.type] = x.value;
  return p.year + '-' + p.month + '-' + p.day;
}

/** 'YYYY-MM-DD' gecerli takvim gunu ise gun numarasi (1970'ten beri), degilse null. */
function gunNo(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
}

const ILERI_GUN = 365;
const SAAT_DESENI = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------------------------------------------- metin temizligi

// Kontrol karakterleri (C0, DEL, C1), satir/paragraf ayiricilari ve U+FFFD -> bosluk
const KONTROL = /[\u0000-\u001F\u007F-\u009F  �]/g;
// Gorunmez bicim karakterleri (sifir genislik, bidi yonlendirme, BOM) -> silinir
const GORUNMEZ = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Kontrol karakterlerini at, bosluklari tekilles, kirp. NFC. */
function temizMetin(s) {
  return String(s === undefined || s === null ? '' : s)
    .normalize('NFC')
    .replace(GORUNMEZ, '')
    .replace(KONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uzunluk(s) {
  return Array.from(s).length; // kod noktasi sayisi (PHP mb_strlen ile ayni)
}

const EPOSTA_DESENI = new RegExp(
  "^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@" +
  '(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+' +
  '(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{2,59})$'
);

/** E-posta: <=100, ASCII, gorunmez/kontrol karakteri YOK, ardisik/bas/son nokta yok. */
function epostaGecerli(e) {
  if (e.length === 0 || e.length > 100) return false;
  if (!EPOSTA_DESENI.test(e)) return false;
  const yerel = e.slice(0, e.lastIndexOf('@'));
  return !(yerel.startsWith('.') || yerel.endsWith('.') || yerel.includes('..'));
}

function tamSayiAyikla(deger) {
  const s = String(deger === undefined || deger === null ? '' : deger).trim();
  if (!/^[+-]?(0|[1-9][0-9]{0,8})$/.test(s)) return null;
  return parseInt(s, 10);
}

function sinirla(deger, min, maks, varsayilan) {
  const n = tamSayiAyikla(deger);
  if (n === null) return varsayilan;
  return Math.max(min, Math.min(maks, n));
}

// Alan -> hata mesaji anahtari (strings.json). Bilinmeyen/yapisal hatalar icin err_pay.
const ALAN_MESAJI = {
  alis: 'val_route', varis: 'val_route',
  tarih: 'val_date', saat: 'val_date', donus_tarih: 'val_date', donus_saat: 'val_date',
  ad: 'val_name', eposta: 'val_email', telefon: 'val_phone', km: 'err_km',
  dil: 'err_pay', kaynak: 'err_pay', yolcu: 'err_pay', buyuk: 'err_pay', kucuk: 'err_pay', arac: 'err_pay', web: 'err_pay',
};
const BILINEN_ALANLAR = Object.keys(ALAN_MESAJI);

// ---------------------------------------------------------------- dogrulama

/**
 * Ham form alanlarindan (alan -> TEK metin) dogrulanmis siparis girdisi cikarir.
 * Sira PHP create.php ile ayni: guzergah, tarih/saat, ad, e-posta, telefon, km.
 * Doner: { ok:true, deger } | { ok:false, alan, anahtar }
 * simdi: test icin sabit zaman (varsayilan: su an).
 */
function dogrula(ham, simdi) {
  const al = (k) => (ham[k] === undefined || ham[k] === null ? '' : String(ham[k]));
  const hata = (alan) => ({ ok: false, alan, anahtar: ALAN_MESAJI[alan] });

  // ---- guzergah: <=120, bos degil
  const alis = temizMetin(al('alis'));
  const varis = temizMetin(al('varis'));
  if (!alis) return hata('alis');
  if (!varis) return hata('varis');
  if (uzunluk(alis) > 120) return hata('alis');
  if (uzunluk(varis) > 120) return hata('varis');

  // ---- tarih / saat
  const bugun = bugunBrussels(simdi);
  const bugunNo = gunNo(bugun);
  const tarih = al('tarih').trim();
  const saat = al('saat').trim();
  const tNo = gunNo(tarih);
  if (tNo === null) return hata('tarih');
  if (tNo < bugunNo || tNo > bugunNo + ILERI_GUN) return hata('tarih');
  if (!SAAT_DESENI.test(saat)) return hata('saat');

  let donusTarih = al('donus_tarih').trim();
  let donusSaat = al('donus_saat').trim();
  if (donusTarih === '') {
    donusTarih = '';
    donusSaat = ''; // donus tarihi yoksa donus saati yok sayilir
  } else {
    const dNo = gunNo(donusTarih);
    if (dNo === null) return hata('donus_tarih');
    if (dNo < tNo) return hata('donus_tarih');                  // donus < gidis
    if (dNo > bugunNo + ILERI_GUN) return hata('donus_tarih');
    if (donusSaat !== '') {
      if (!SAAT_DESENI.test(donusSaat)) return hata('donus_saat');
      if (dNo === tNo && donusSaat < saat) return hata('donus_saat'); // ayni gun, donus saati gidisten once
    }
  }

  // ---- iletisim
  const ad = temizMetin(al('ad'));
  if (uzunluk(ad) < 2 || uzunluk(ad) > 80) return hata('ad');

  const eposta = al('eposta').trim();
  if (!epostaGecerli(eposta)) return hata('eposta');

  const telefon = temizMetin(al('telefon'));
  const rakam = (telefon.match(/[0-9]/g) || []).length;
  if (rakam < 8 || uzunluk(telefon) > 25) return hata('telefon');

  // ---- km (istemcinin beyani; nihai karar create.js'te)
  const kmIstemci = tamSayiAyikla(al('km'));
  if (kmIstemci === null || !kmGecerli(kmIstemci)) return hata('km');

  // ---- yan alanlar (sinirlanir, hata verilmez)
  return {
    ok: true,
    deger: {
      dil: dilSec(ham.dil),
      alis,
      varis,
      kmIstemci,
      tarih,
      saat,
      donusTarih,
      donusSaat,
      yolcu: sinirla(al('yolcu'), 1, 7, 1),
      buyuk: sinirla(al('buyuk'), 0, 6, 0),
      kucuk: sinirla(al('kucuk'), 0, 4, 0),
      arac: ['eco', 'wagon', 'vip'].includes(al('arac')) ? al('arac') : 'eco',
      ad,
      eposta,
      telefon,
    },
  };
}

// ---------------------------------------------------------------- siparis numarasi

const SIPARIS_NO_DESENI = /^ET-[0-9]{6}-[A-Z0-9]{6}$/;

function siparisNoGecerli(no) {
  return typeof no === 'string' && SIPARIS_NO_DESENI.test(no);
}

/** ET-yymmdd-XXXXXX (yymmdd = Brussels gunu; XXXXXX = 24 bit rastgele, onaltilik buyuk harf). */
function siparisNoUret(simdi) {
  const yymmdd = bugunBrussels(simdi).replace(/-/g, '').slice(2);
  return 'ET-' + yymmdd + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ---------------------------------------------------------------- metadata

const METADATA_SINIRI = 900; // bayt (Mollie ~1 kB sinirinin altinda pay birakir; m isareti icin yer kalir)

function jsonBayt(m) {
  return Buffer.byteLength(JSON.stringify(m), 'utf8');
}

function kirpAlan(m, alan, hedefUzunluk) {
  const c = Array.from(m[alan]);
  if (c.length > hedefUzunluk) m[alan] = c.slice(0, hedefUzunluk).join('');
}

/**
 * Metadata boyutu asilirsa alanlari mantikli sirayla kirpar (once adresler, sonra ad).
 * ASLA hata vermez; e-posta/telefon/km/tarih hicbir zaman kirpilmaz (zaten kucuktur).
 */
function metadataKirp(m, sinir) {
  const limit = sinir || METADATA_SINIRI;
  const adimlar = [['a', 60], ['b', 60], ['u', 30], ['a', 30], ['b', 30], ['u', 12], ['a', 10], ['b', 10], ['u', 4], ['a', 0], ['b', 0]];
  for (const [alan, hedef] of adimlar) {
    let uz = Array.from(m[alan]).length;
    // once %15'lik kademelerle in, sonra hedefe
    while (jsonBayt(m) > limit && uz > hedef) {
      uz = Math.max(hedef, uz - Math.max(1, Math.ceil(uz * 0.15)));
      kirpAlan(m, alan, uz);
    }
    if (jsonBayt(m) <= limit) break;
  }
  return m;
}

/** Odeme olustururken Mollie'ye gidecek metadata nesnesi. */
function metadataOlustur(s) {
  const m = {
    v: 1,
    n: s.no,
    l: s.dil,
    a: s.alis,
    b: s.varis,
    d: s.tarih + 'T' + s.saat,
    r: s.donusTarih ? (s.donusSaat ? s.donusTarih + 'T' + s.donusSaat : s.donusTarih) : '',
    p: s.yolcu,
    g: s.buyuk,
    s: s.kucuk,
    c: s.arac,
    k: s.km,
    t: s.toplam,
    u: s.ad,
    e: s.eposta,
    h: s.telefon,
    src: s.src === 'g' ? 'g' : 'd',
  };
  // adres alanlari en fazla 120 karakter (dogrulama zaten <=120 sagliyor; savunma)
  kirpAlan(m, 'a', 120);
  kirpAlan(m, 'b', 120);
  return metadataKirp(m);
}

// ---------------------------------------------------------------- Mollie odemesi -> siparis

const DURUM_ESLESME = { paid: 'odendi', expired: 'suresi_doldu', canceled: 'iptal', failed: 'basarisiz' };

/** Mollie durumu -> panel/siparis durumu (PHP webhook.php eslesmesi ile ayni; digerleri 'beklemede'). */
function durumEsle(mollieDurum) {
  return DURUM_ESLESME[mollieDurum] || 'beklemede';
}

function sayi(v) {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function metinAlan(v) {
  return typeof v === 'string' ? v : '';
}

/**
 * Mollie odeme nesnesinden siparis (PHP siparis dizisiyle ayni alanlar) cikarir.
 * metadata bizim degilse (v!==1) veya bozuksa null. Tutarlar km'den SUNUCUDA yeniden hesaplanir.
 */
function metadataDanSiparis(odeme) {
  if (!odeme || typeof odeme !== 'object') return null;
  const m = odeme.metadata;
  if (!m || typeof m !== 'object' || m.v !== 1) return null;
  if (!siparisNoGecerli(m.n)) return null;
  const km = m.k;
  if (!kmGecerli(km)) return null;
  const f = fiyatHesapla(km);
  const [tarih, saat] = metinAlan(m.d).split('T');
  const [donusTarih, donusSaat] = metinAlan(m.r).split('T');
  const odenen = odeme.amount && typeof odeme.amount === 'object' ? odeme.amount : {};
  const iade = odeme.amountRefunded && typeof odeme.amountRefunded === 'object' ? sayi(odeme.amountRefunded.value) : 0;
  const geriOdeme = odeme.amountChargedBack && typeof odeme.amountChargedBack === 'object' ? sayi(odeme.amountChargedBack.value) : 0;
  return {
    no: m.n,
    dil: dilSec(m.l),
    alis: metinAlan(m.a),
    varis: metinAlan(m.b),
    tarih: tarih || '',
    saat: saat || '',
    donus_tarih: donusTarih || '',
    donus_saat: donusSaat || '',
    yolcu: sinirla(m.p, 1, 7, 1),
    buyuk: sinirla(m.g, 0, 6, 0),
    kucuk: sinirla(m.s, 0, 4, 0),
    arac: ['eco', 'wagon', 'vip'].includes(m.c) ? m.c : 'eco',
    ad: metinAlan(m.u),
    eposta: metinAlan(m.e),
    telefon: metinAlan(m.h),
    km,
    km_sunucu: m.src === 'g' ? km : null,
    src: m.src === 'g' ? 'g' : 'd',
    toplam: f.toplam,
    kapora: f.kapora,
    kalan: f.kalan,
    toplamSent: f.toplamSent,
    kaporaSent: f.kaporaSent,
    kalanSent: f.kalanSent,
    beklenenKapora: f.kaporaStr,
    // Mollie tarafi
    mollie_id: metinAlan(odeme.id),
    mollie_durum: metinAlan(odeme.status),
    durum: durumEsle(odeme.status),
    olusturma: metinAlan(odeme.createdAt),
    paidAt: metinAlan(odeme.paidAt),
    odenenTutar: metinAlan(odenen.value),
    odenenPara: metinAlan(odenen.currency),
    iade,
    geriOdeme,
    epostaIsareti: m.m === 1,
  };
}

module.exports = {
  bugunBrussels, gunNo, temizMetin, epostaGecerli, tamSayiAyikla, sinirla,
  dogrula, ALAN_MESAJI, BILINEN_ALANLAR,
  siparisNoGecerli, siparisNoUret, SIPARIS_NO_DESENI,
  metadataOlustur, metadataKirp, jsonBayt, METADATA_SINIRI,
  durumEsle, metadataDanSiparis,
};
