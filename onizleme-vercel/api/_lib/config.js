'use strict';
// ============================================================
// EUROPA TAXI — yapilandirma. YALNIZ ortam degiskenlerinden okunur.
//
//   MOLLIE_API_KEY        Mollie API anahtari (test_... / live_...)
//   SITE_URL              varsayilan https://europetaxi24.be
//   COMPANY_EMAIL         is emirlerinin gidecegi adres
//   MAIL_FROM             gonderen adres (Brevo'da dogrulanmis olmali)
//   BREVO_API_KEY         Brevo API anahtari
//   GOOGLE_SERVER_KEY     Google Distance Matrix SUNUCU anahtari (istege bagli)
//   ADMIN_PASSWORD        orders + test uc noktalari (bossa ikisi de KAPALI)
//   SIGNING_SECRET        cerez imzalama sirri (bossa MOLLIE_API_KEY+ADMIN_PASSWORD'den turetilir)
//   DISTANCE_TOLERANCE_PCT  varsayilan 12
//   MOLLIE_API_BASE / BREVO_API_BASE / GOOGLE_API_BASE  yalniz test icin (https veya http://127.0.0.1)
//
// Sirlar ASLA loglanmaz. cfg() her cagrida ortami yeniden okur (ucuz; testlerde ortam degisebilir).
// ============================================================

const crypto = require('node:crypto');
const DIL = require('./dil.json');
const MESAFE = require('./mesafe.json');
const { birKez } = require('./log');

const VARSAYILAN = {
  siteUrl: 'https://europetaxi24.be',
  mollieBase: 'https://api.mollie.com/v2',
  brevoBase: 'https://api.brevo.com/v3',
  googleBase: 'https://maps.googleapis.com',
};

// Mollie'de kabul edilen odeme yontemleri (PHP config.php ile ayni)
const ODEME_YONTEMLERI = ['bancontact', 'creditcard', 'applepay'];

function envMetin(ad) {
  const v = process.env[ad];
  return typeof v === 'string' ? v.trim() : '';
}

/** Ortam degiskeni raporu (deger DEGIL): { ayarli, uzunluk, bosluk } — test.js kullanir. */
function envRapor(ad) {
  const ham = process.env[ad];
  if (typeof ham !== 'string' || ham.trim() === '') return { ayarli: false, uzunluk: 0, bosluk: false };
  return { ayarli: true, uzunluk: ham.trim().length, bosluk: ham !== ham.trim() };
}

/**
 * *_BASE degiskeni: yalniz https:// veya http://127.0.0.1 kabul edilir; baska sema/host REDDEDILIR
 * (null doner, ilgili dis servis cagrisi yapilmaz — uretim adresine sessizce dusulmez).
 * Bos ise varsayilan.
 */
function tabanUrl(ad, varsayilan) {
  const ham = envMetin(ad);
  if (!ham) return varsayilan;
  let u;
  try {
    u = new URL(ham);
  } catch (_) {
    birKez('taban:' + ad, 'uyari', ad + ' gecersiz URL; ilgili servis cagrilari reddedilecek');
    return null;
  }
  const https = u.protocol === 'https:';
  const yerel = u.protocol === 'http:' && u.hostname === '127.0.0.1';
  if (!(https || yerel) || u.username || u.password) {
    birKez('taban:' + ad, 'uyari', ad + ' yalniz https:// veya http://127.0.0.1 ile baslayabilir; ilgili servis cagrilari reddedilecek');
    return null;
  }
  return ham.replace(/\/+$/, '');
}

function siteUrl() {
  const ham = envMetin('SITE_URL');
  if (!ham) return VARSAYILAN.siteUrl;
  try {
    const u = new URL(ham);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password) {
      return ham.replace(/\/+$/, '');
    }
  } catch (_) { /* asagida varsayilan */ }
  birKez('siteurl', 'uyari', 'SITE_URL gecersiz; varsayilan kullaniliyor');
  return VARSAYILAN.siteUrl;
}

function tolerans() {
  const ham = envMetin('DISTANCE_TOLERANCE_PCT');
  const varsayilan = Number(MESAFE.sabitler.tolerans_yuzde) || 12;
  if (!ham) return varsayilan;
  const n = Number(ham);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    birKez('tolerans', 'uyari', 'DISTANCE_TOLERANCE_PCT gecersiz; ' + varsayilan + ' kullaniliyor');
    return varsayilan;
  }
  return n;
}

/** Imzalama sirri. Doner: { deger: string|null, turetilmis: bool } */
function imzaSirri(mollieKey, adminPw) {
  const acik = envMetin('SIGNING_SECRET');
  if (acik) return { deger: acik, turetilmis: false };
  if (!mollieKey && !adminPw) return { deger: null, turetilmis: true };
  birKez('imza', 'uyari', 'SIGNING_SECRET ayarli degil: MOLLIE_API_KEY+ADMIN_PASSWORD\'den turetiliyor; ayri bir SIGNING_SECRET tanimlayin');
  return {
    deger: crypto.createHash('sha256').update('et-signing|' + mollieKey + '|' + adminPw).digest('hex'),
    turetilmis: true,
  };
}

function cfg() {
  const isl = DIL.isletme || {};
  const mollieKey = envMetin('MOLLIE_API_KEY');
  const adminPassword = envMetin('ADMIN_PASSWORD');
  const imza = imzaSirri(mollieKey, adminPassword);
  const site = siteUrl();
  let siteHost = '';
  try { siteHost = new URL(site).host.toLowerCase(); } catch (_) { /* yok */ }
  return {
    mollieKey,
    siteUrl: site,
    siteHost,
    siteHttps: site.startsWith('https://'),
    companyEmail: envMetin('COMPANY_EMAIL') || isl.eposta || '',
    mailFrom: envMetin('MAIL_FROM') || isl.gonderen_eposta || '',
    brevoKey: envMetin('BREVO_API_KEY'),
    googleKey: envMetin('GOOGLE_SERVER_KEY'),
    adminPassword,
    signingSecret: imza.deger,
    signingDerived: imza.turetilmis,
    tolerancePct: tolerans(),
    mollieBase: tabanUrl('MOLLIE_API_BASE', VARSAYILAN.mollieBase),
    brevoBase: tabanUrl('BREVO_API_BASE', VARSAYILAN.brevoBase),
    googleBase: tabanUrl('GOOGLE_API_BASE', VARSAYILAN.googleBase),
    methods: ODEME_YONTEMLERI.slice(),
  };
}

module.exports = { cfg, envRapor, envMetin, ODEME_YONTEMLERI, VARSAYILAN };
