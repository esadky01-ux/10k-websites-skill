'use strict';
// ============================================================
// EUROPA TAXI — guvenlik ve HTTP yardimcilari.
//  - temel basliklar, hata sarmalayici (stack ASLA disari cikmaz)
//  - govde okuma (<=64 KB, urlencoded), cerez okuma/yazma
//  - HMAC imza (et_p odeme cerezi, yonetici oturumu), zaman-sabit karsilastirma
//  - Origin/Referer denetimi, IP, bellek ici oran sinirlayici ve kaba kuvvet korumasi
//
// SERVERLESS UYARISI: oran sinirlayicilar ve kaba kuvvet sayaci BELLEK ICIDIR; her sicak
// fonksiyon ornegi kendi sayacini tutar, soguk baslangicta sifirlanir. Yalniz EN-IYI-CABA
// korumadir. Gercek koruma icin Vercel Firewall rate-limit kurali ekleyin (README).
// ============================================================

const crypto = require('node:crypto');
const { cfg } = require('./config');
const { kayit } = require('./log');
const { t, dilSec } = require('./dil');
const { h, miniSayfa, yanitHtml, yanitMetin } = require('./html');

const GOVDE_SINIRI = 64 * 1024;

// ---------------------------------------------------------------- basliklar / sarmalayici

function temelBasliklar(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function istekKimligi() {
  return crypto.randomBytes(4).toString('hex');
}

/** Hatanin ilk yigin satirindan yalniz "dosya:satir" (yol/mesaj icermez). */
function ilkKare(e) {
  const yigin = e && typeof e.stack === 'string' ? e.stack.split('\n') : [];
  for (const satir of yigin) {
    const m = /([A-Za-z0-9_.-]+\.js:\d+):\d+\)?\s*$/.exec(satir);
    if (m) return m[1];
  }
  return '?';
}

/** Genel 500: ic ayrinti yok; yalniz istek kimligi. */
function genel500(res, ctx) {
  if (ctx.ad === 'webhook') {
    yanitMetin(res, 500, 'hata ' + ctx.rid);
    return;
  }
  const dil = dilSec(ctx.dil);
  yanitHtml(res, 500, miniSayfa(dil, t(dil, 'err_t'),
    '<p>' + h(t(dil, 'err_pay')) + '</p><p class="ref">ref: ' + h(ctx.rid) + (ctx.no ? ' · ' + h(ctx.no) : '') + '</p>'));
}

/**
 * Her uc nokta bunun icinden gecer: temel basliklari koyar, beklenmeyen istisnayi yakalar
 * (genel 500 + istek kimligi), yarida kesilen istekte sessizce cikar.
 */
function sarmala(ad, fn) {
  return async function handler(req, res) {
    temelBasliklar(res);
    const ctx = { ad, rid: istekKimligi(), dil: 'fr', no: '' };
    // Istemci baglantiyi koparirsa req 'error' yayar; dinleyici yoksa surec cokerdi
    req.on('error', () => {});
    try {
      await fn(req, res, ctx);
    } catch (e) {
      if (e && e.kesildi) {
        kayit('bilgi', ad + ': istek yarida kesildi (' + ctx.rid + ')');
        return;
      }
      kayit('hata', ad + ': beklenmeyen istisna ' + ctx.rid + ' ' + (e && e.name) + (e && e.code ? ' ' + e.code : '') + ' @' + ilkKare(e));
      try {
        if (!res.headersSent && !res.writableEnded) genel500(res, ctx);
        else if (!res.writableEnded) res.end();
      } catch (_) { /* yanit gonderilemedi */ }
    }
  };
}

// ---------------------------------------------------------------- govde / form / cerez

function istisna(kod, kesildi) {
  const e = new Error(kesildi ? 'kesildi' : 'govde buyuk');
  e.kod = kod;
  e.kesildi = !!kesildi;
  return e;
}

/** Istek govdesini okur (<=sinir bayt). Asarsa {kod:413}, yarida kesilirse {kesildi:true} firlatir. */
function govdeOku(req, sinir) {
  const limit = sinir || GOVDE_SINIRI;
  return new Promise((coz, red) => {
    const uz = Number(req.headers['content-length']);
    if (Number.isFinite(uz) && uz > limit) {
      req.resume();
      red(istisna(413, false));
      return;
    }
    // Platform govdeyi onceden tuketmisse (yerel calistiricida olmaz) hazir govdeyi kullan
    if (req.readableEnded) {
      const b = req.body;
      if (Buffer.isBuffer(b)) { b.length > limit ? red(istisna(413, false)) : coz(b); return; }
      if (typeof b === 'string') { const bb = Buffer.from(b, 'utf8'); bb.length > limit ? red(istisna(413, false)) : coz(bb); return; }
      if (b && typeof b === 'object') { coz(Buffer.from(new URLSearchParams(b).toString(), 'utf8')); return; }
      coz(Buffer.alloc(0));
      return;
    }
    const parcalar = [];
    let toplam = 0;
    let bitti = false;
    const bitir = (fn, v) => { if (!bitti) { bitti = true; fn(v); } };
    req.on('data', (p) => {
      if (bitti) return;
      toplam += p.length;
      if (toplam > limit) { bitir(red, istisna(413, false)); return; }
      parcalar.push(p);
    });
    req.on('end', () => bitir(coz, Buffer.concat(parcalar)));
    req.on('error', () => bitir(red, istisna(400, true)));
    req.on('close', () => bitir(red, istisna(400, true)));
  });
}

/** application/x-www-form-urlencoded coz. Tekrar eden alanlar korunur (dizi olarak). */
function formCoz(buf) {
  const alanlar = new Map();
  let sayac = 0;
  for (const [k, v] of new URLSearchParams(buf.toString('utf8'))) {
    if (++sayac > 200) break;
    if (!alanlar.has(k)) alanlar.set(k, []);
    alanlar.get(k).push(v);
  }
  return {
    tumu: alanlar,
    ilk(ad) { const a = alanlar.get(ad); return a && a.length ? a[0] : undefined; },
    sayi(ad) { const a = alanlar.get(ad); return a ? a.length : 0; },
  };
}

function cerezOku(req) {
  const cikti = {};
  const ham = req.headers && req.headers.cookie;
  if (typeof ham !== 'string') return cikti;
  for (const parca of ham.split(';')) {
    const i = parca.indexOf('=');
    if (i < 1) continue;
    const ad = parca.slice(0, i).trim();
    let deger = parca.slice(i + 1).trim();
    try { deger = decodeURIComponent(deger); } catch (_) { continue; }
    if (!(ad in cikti)) cikti[ad] = deger;
  }
  return cikti;
}

/** Set-Cookie satiri. secenek: {maxAge, path, httpOnly, secure, sameSite} */
function cerezYaz(ad, deger, secenek) {
  const s = secenek || {};
  let c = ad + '=' + deger + '; Path=' + (s.path || '/');
  if (s.maxAge !== undefined) c += '; Max-Age=' + s.maxAge;
  if (s.httpOnly !== false) c += '; HttpOnly';
  if (s.secure) c += '; Secure';
  c += '; SameSite=' + (s.sameSite || 'Lax');
  return c;
}

function cerezEkle(res, satir) {
  const onceki = res.getHeader('Set-Cookie');
  if (!onceki) res.setHeader('Set-Cookie', [satir]);
  else res.setHeader('Set-Cookie', [].concat(onceki, satir));
}

// ---------------------------------------------------------------- imza / karsilastirma

function hmacHex(anahtar, veri) {
  return crypto.createHmac('sha256', anahtar).update(veri).digest('hex');
}

/** Zaman-sabit metin esitligi (uzunluk sizdirmaz: iki tarafin SHA-256'si karsilastirilir). */
function zamanSabitEsit(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Odeme cerezi degeri: <odemeId>.<HMAC-SHA256(secret, odemeId)> — sir yoksa null. */
function odemeCerezDegeri(odemeId) {
  const s = cfg().signingSecret;
  if (!s) return null;
  return odemeId + '.' + hmacHex(s, odemeId);
}

/** Cerez degerinden dogrulanmis odeme id'si; imza gecersizse null. */
function odemeCerezindenId(deger) {
  const s = cfg().signingSecret;
  if (!s || typeof deger !== 'string') return null;
  const nokta = deger.lastIndexOf('.');
  if (nokta < 1) return null;
  const id = deger.slice(0, nokta);
  const imza = deger.slice(nokta + 1);
  if (!/^tr_[A-Za-z0-9]+$/.test(id) || !/^[0-9a-f]{64}$/.test(imza)) return null;
  return zamanSabitEsit(imza, hmacHex(s, id)) ? id : null;
}

// ---------------------------------------------------------------- Origin / IP

function izinliHostlar(req) {
  const c = cfg();
  const kume = new Set();
  const ekle = (v) => {
    if (typeof v !== 'string' || !v.trim()) return;
    let x = v.trim().toLowerCase();
    x = x.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (x) kume.add(x);
  };
  ekle(c.siteHost);
  ekle(process.env.VERCEL_URL);
  ekle(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  ekle(req.headers && req.headers.host);
  return kume;
}

/**
 * Origin veya Referer VARSA host'u SITE_URL / VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL veya
 * istegin Host'u ile eslesmeli. Ikisi de yoksa izin verilir (tarayici disi istemci; CSRF degil).
 * Origin: null -> yok sayilir (sayfa Referrer-Policy: no-referrer ise tarayici bunu gonderir).
 */
function kaynakIzinli(req) {
  const izinli = izinliHostlar(req);
  for (const baslik of ['origin', 'referer']) {
    const v = req.headers[baslik];
    if (v === undefined) continue;
    if (baslik === 'origin' && v === 'null') continue;
    let host;
    try { host = new URL(String(v)).host.toLowerCase(); } catch (_) { return false; }
    if (!izinli.has(host)) return false;
  }
  return true;
}

/** Istemci IP: x-forwarded-for ilk deger; yoksa soket adresi. */
function istemciIp(req) {
  const xff = req.headers && req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const ilk = xff.split(',')[0].trim();
    if (/^[0-9A-Fa-f:.]{2,45}$/.test(ilk)) return ilk;
  }
  const s = req.socket && req.socket.remoteAddress;
  return typeof s === 'string' && s ? s.slice(0, 45) : 'bilinmiyor';
}

// ---------------------------------------------------------------- oran sinirlayici (bellek ici, en-iyi-caba)

class OranSiniri {
  /** kurallar: [{pencereMs, en}] — her pencerede en fazla `en` istek. */
  constructor(kurallar, maksKayit) {
    this.kurallar = kurallar;
    this.maksKayit = maksKayit || 10000;
    this.kayitlar = new Map();
    this.enUzunPencere = Math.max.apply(null, kurallar.map((k) => k.pencereMs));
  }

  temizle(simdi) {
    for (const [anahtar, zamanlar] of this.kayitlar) {
      if (!zamanlar.length || simdi - zamanlar[zamanlar.length - 1] > this.enUzunPencere) this.kayitlar.delete(anahtar);
    }
    while (this.kayitlar.size > this.maksKayit) this.kayitlar.delete(this.kayitlar.keys().next().value);
  }

  /** Doner: { izin:true } | { izin:false, beklemeSn }. Reddedilen istek sayilmaz. */
  dene(anahtar, simdi) {
    const an = simdi === undefined ? Date.now() : simdi;
    if (this.kayitlar.size > this.maksKayit / 2) this.temizle(an);
    let z = this.kayitlar.get(anahtar) || [];
    z = z.filter((x) => an - x < this.enUzunPencere);
    let bekle = 0;
    for (const k of this.kurallar) {
      const pencere = z.filter((x) => an - x < k.pencereMs);
      if (pencere.length >= k.en) {
        bekle = Math.max(bekle, Math.ceil((pencere[0] + k.pencereMs - an) / 1000));
      }
    }
    if (bekle > 0) {
      this.kayitlar.set(anahtar, z);
      return { izin: false, beklemeSn: Math.max(1, bekle) };
    }
    z.push(an);
    this.kayitlar.set(anahtar, z);
    while (this.kayitlar.size > this.maksKayit) this.kayitlar.delete(this.kayitlar.keys().next().value);
    return { izin: true, beklemeSn: 0 };
  }
}

/** Odeme olusturma: dakikada 5, saatte 30 (IP basina). */
const createSiniri = new OranSiniri([{ pencereMs: 60 * 1000, en: 5 }, { pencereMs: 3600 * 1000, en: 30 }]);

/** Yonetici girisi kaba kuvvet: IP basina 5 basarisiz denemeden sonra 15 dk kilit. */
class KabaKuvvet {
  constructor(en, kilitMs) {
    this.en = en;
    this.kilitMs = kilitMs;
    this.kayitlar = new Map(); // ip -> { sayi, son, kilitBitis }
  }

  /** Kilit varsa kalan saniye, yoksa 0. */
  kalanSn(ip, simdi) {
    const an = simdi === undefined ? Date.now() : simdi;
    const k = this.kayitlar.get(ip);
    if (!k || !k.kilitBitis) return 0;
    if (an >= k.kilitBitis) { this.kayitlar.delete(ip); return 0; }
    return Math.ceil((k.kilitBitis - an) / 1000);
  }

  /** Basarisiz deneme kaydeder; kilit devreye girdiyse kalan saniye, aksi 0. */
  basarisiz(ip, simdi) {
    const an = simdi === undefined ? Date.now() : simdi;
    if (this.kayitlar.size > 5000) {
      for (const [a, k] of this.kayitlar) { if (an - k.son > this.kilitMs) this.kayitlar.delete(a); }
      while (this.kayitlar.size > 10000) this.kayitlar.delete(this.kayitlar.keys().next().value);
    }
    let k = this.kayitlar.get(ip);
    if (!k || an - k.son > this.kilitMs) k = { sayi: 0, son: an, kilitBitis: 0 };
    k.sayi += 1;
    k.son = an;
    if (k.sayi >= this.en) k.kilitBitis = an + this.kilitMs;
    this.kayitlar.set(ip, k);
    return k.kilitBitis ? Math.ceil((k.kilitBitis - an) / 1000) : 0;
  }

  temizle(ip) { this.kayitlar.delete(ip); }
}

const yoneticiSiniri = new KabaKuvvet(5, 15 * 60 * 1000);

// ---------------------------------------------------------------- yonetici oturumu (orders + test)

const OTURUM_MS = 12 * 3600 * 1000;
const OTURUM_CEREZ = 'et_a';

function yoneticiSifreDogru(girilen) {
  const s = cfg().adminPassword;
  if (!s) return false;
  return zamanSabitEsit(String(girilen).trim(), s);
}

/** Oturum imza anahtari: SIGNING_SECRET + ADMIN_PASSWORD'e baglidir (sifre degisirse oturumlar duser). */
function oturumAnahtari() {
  const c = cfg();
  return hmacHex(c.signingSecret || 'et-sirsiz', 'admin|' + c.adminPassword);
}

function oturumCerezSatiri(simdi) {
  const bitis = (simdi === undefined ? Date.now() : simdi) + OTURUM_MS;
  const deger = bitis + '.' + hmacHex(oturumAnahtari(), 'oturum|' + bitis);
  return cerezYaz(OTURUM_CEREZ, deger, { maxAge: OTURUM_MS / 1000, secure: true, sameSite: 'Strict' });
}

function oturumCerezSil() {
  return cerezYaz(OTURUM_CEREZ, '', { maxAge: 0, secure: true, sameSite: 'Strict' });
}

function oturumVarMi(req, simdi) {
  const c = cfg();
  if (!c.adminPassword) return false;
  const deger = cerezOku(req)[OTURUM_CEREZ];
  if (typeof deger !== 'string') return false;
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(deger);
  if (!m) return false;
  if (Number(m[1]) <= (simdi === undefined ? Date.now() : simdi)) return false;
  return zamanSabitEsit(m[2], hmacHex(oturumAnahtari(), 'oturum|' + m[1]));
}

module.exports = {
  GOVDE_SINIRI, temelBasliklar, sarmala, govdeOku, formCoz, cerezOku, cerezYaz, cerezEkle,
  hmacHex, zamanSabitEsit, odemeCerezDegeri, odemeCerezindenId,
  kaynakIzinli, istemciIp, OranSiniri, createSiniri, KabaKuvvet, yoneticiSiniri,
  yoneticiSifreDogru, oturumCerezSatiri, oturumCerezSil, oturumVarMi, OTURUM_CEREZ,
};
