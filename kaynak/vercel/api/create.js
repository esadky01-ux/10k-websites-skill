'use strict';
// ============================================================
// EUROPA TAXI — odeme olusturma (POST /pay/create.php -> /api/create)
// Akis: dogrula -> km karari (Google / dahili tablo / istemci) -> fiyati SUNUCUDA hesapla ->
// Mollie odemesi (siparis verisi metadata'da) -> 303 checkout + et_p cerezi.
// Tarayicidan gelen tutar/fiyat alanlari ASLA kullanilmaz; tutar yalniz km'den uretilir.
// DURUMSUZ: diske hicbir sey yazilmaz.
// ============================================================

const { cfg } = require('./_lib/config');
const { t, tYedekli, dilSec, isletme } = require('./_lib/dil');
const { h, miniSayfa, yanitHtml, yanitMetin, yanitYonlendir } = require('./_lib/html');
const {
  sarmala, govdeOku, formCoz, cerezYaz, cerezEkle, odemeCerezDegeri,
  kaynakIzinli, istemciIp, createSiniri,
} = require('./_lib/guvenlik');
const { fiyatHesapla } = require('./_lib/fiyat');
const { googleKm, dahiliMesafe, kmKarar } = require('./_lib/mesafe');
const { dogrula, yapisalHata, siparisNoUret, metadataOlustur, ALAN_MESAJI, BILINEN_ALANLAR } = require('./_lib/siparis');
const { mollie } = require('./_lib/mollie');
const { kayit } = require('./_lib/log');

const MOLLIE_YEREL = { fr: 'fr_BE', nl: 'nl_BE', en: 'en_GB', tr: 'fr_BE' }; // Mollie Turkce desteklemez

/** Hata sayfasi (PHP hata_sayfasi ile ayni gorunum). ekBtn: ek dugme HTML'i. */
function hataSayfasi(res, dil, kod, mesaj, ekBtn, ekBasliklar) {
  yanitHtml(res, kod, miniSayfa(dil, t(dil, 'err_t'),
    '<p>' + h(mesaj) + '</p>'
    + '<div class="btnler">' + (ekBtn || '')
    + '<a class="btn btn--dis" href="/' + h(dil) + '/#rezervasyon">' + h(t(dil, 'err_back')) + '</a></div>'), ekBasliklar);
}

/** Checkout adresi guvenli mi? https, ya da yerel Mollie taklidiyle ayni host (test). Acik yonlendirmeyi onler. */
function checkoutGuvenli(href) {
  try {
    const u = new URL(href);
    if (u.username || u.password) return false;
    if (u.protocol === 'https:') return true;
    const c = cfg();
    return u.protocol === 'http:' && u.hostname === '127.0.0.1' && !!c.mollieBase && new URL(c.mollieBase).host === u.host;
  } catch (_) {
    return false;
  }
}

module.exports = sarmala('create', async function handler(req, res, ctx) {
  // ---- yalniz POST
  if (req.method !== 'POST') {
    yanitMetin(res, 405, 'Method Not Allowed', { Allow: 'POST' });
    return;
  }

  // ---- govde (<=64 KB, urlencoded)
  const tip = String(req.headers['content-type'] || '').toLowerCase();
  if (!tip.startsWith('application/x-www-form-urlencoded')) {
    hataSayfasi(res, 'fr', 415, t('fr', 'err_pay'));
    return;
  }
  let govde;
  try {
    govde = await govdeOku(req);
  } catch (e) {
    if (e && e.kod === 413) {
      hataSayfasi(res, 'fr', 413, tYedekli('fr', 'err_bad_request', 'err_pay'), '', { Connection: 'close' });
      return;
    }
    throw e;
  }
  const form = formCoz(govde);
  const dil = dilSec(form.ilk('dil'));
  ctx.dil = dil;

  // ---- Origin / Referer (CSRF)
  if (!kaynakIzinli(req)) {
    kayit('uyari', 'create: Origin/Referer reddedildi');
    hataSayfasi(res, dil, 403, tYedekli(dil, 'err_forbidden', 'err_pay'));
    return;
  }

  // ---- oran siniri (bellek ici, en-iyi-caba; IP = x-forwarded-for ilk deger)
  const oran = createSiniri.dene(istemciIp(req));
  if (!oran.izin) {
    kayit('uyari', 'create: oran siniri asildi');
    hataSayfasi(res, dil, 429, tYedekli(dil, 'err_rate', 'err_pay'), '', { 'Retry-After': String(oran.beklemeSn) });
    return;
  }

  // ---- bal-kupu (honeypot): dolu ise sessizce "tamam" de, odeme OLUSTURMA
  const bal = form.ilk('web');
  if (typeof bal === 'string' && bal.trim() !== '') {
    kayit('bilgi', 'create: honeypot tetiklendi');
    yanitMetin(res, 200, 'tamam');
    return;
  }

  // ---- dizi / tekrar eden alan: reddet (alis[]=x, alis=a&alis=b ...)
  const yapisal = yapisalHata(form.tumu);
  if (yapisal) {
    hataSayfasi(res, dil, 400, t(dil, ALAN_MESAJI[yapisal] || 'err_pay'));
    return;
  }

  // ---- girdileri temizle ve dogrula (PHP sirasiyla; ilk hata gosterilir)
  const ham = {};
  for (const alan of BILINEN_ALANLAR) ham[alan] = form.ilk(alan);
  const dv = dogrula(ham);
  if (!dv.ok) {
    hataSayfasi(res, dil, 422, t(dil, dv.anahtar));
    return;
  }
  const g = dv.deger;

  // ---- km: Google (varsa) + dahili tablo + istemci -> karar (dogrulanamazsa RET)
  const c = cfg();
  const kmGoogle = await googleKm(g.alis, g.varis);
  const kmDahili = dahiliMesafe(g.alis, g.varis);
  const km = kmKarar(g.kmIstemci, kmGoogle, kmDahili, c.tolerancePct);
  if (km === null) {
    // Ulasilamayan/dogrulanamayan mesafe: musteriyi WhatsApp'a yonlendir (fiyat URETME)
    const i = isletme();
    const wa = (i.whatsapp || '') ? '<a class="btn btn--wa" href="' + h(i.whatsapp) + '" rel="noopener">' + h(t(dil, 'succ_wa')) + '</a>' : '';
    hataSayfasi(res, dil, 422, tYedekli(dil, 'err_km_wa', 'err_km'), wa);
    return;
  }

  // ---- fiyati SUNUCUDA hesapla (tamsayi sent)
  const f = fiyatHesapla(km);
  const no = siparisNoUret();
  ctx.no = no;

  // ---- Mollie odemesi
  if (!c.mollieKey) {
    kayit('hata', 'create: MOLLIE_API_KEY bos; odeme baslatilamadi. Siparis: ' + no);
    hataSayfasi(res, dil, 503, t(dil, 'err_pay'));
    return;
  }
  const metadata = metadataOlustur({
    no, dil, alis: g.alis, varis: g.varis, tarih: g.tarih, saat: g.saat,
    donusTarih: g.donusTarih, donusSaat: g.donusSaat,
    yolcu: g.yolcu, buyuk: g.buyuk, kucuk: g.kucuk, arac: g.arac,
    km, toplam: f.toplam, ad: g.ad, eposta: g.eposta, telefon: g.telefon,
    src: kmGoogle !== null ? 'g' : 'd',
  });
  const site = c.siteUrl;
  const { kod, veri: odeme } = await mollie('POST', 'payments', {
    amount: { currency: 'EUR', value: f.kaporaStr },
    description: 'Europa Taxi ' + no,
    redirectUrl: site + '/pay/success.php?order=' + no + '&dil=' + dil,
    webhookUrl: site + '/pay/webhook.php',
    locale: MOLLIE_YEREL[dil],
    method: c.methods,
    metadata,
  }, { idempotency: 'et-' + no });

  const checkout = odeme && odeme._links && odeme._links.checkout && odeme._links.checkout.href;
  if (kod !== 201 || typeof odeme.id !== 'string' || !/^tr_[A-Za-z0-9]+$/.test(odeme.id) || !checkout || !checkoutGuvenli(checkout)) {
    kayit('hata', 'create: Mollie odeme olusturulamadi (HTTP ' + kod + '). Siparis: ' + no);
    hataSayfasi(res, dil, 502, t(dil, 'err_pay'));
    return;
  }
  kayit('bilgi', 'create: odeme olusturuldu ' + no + ' ' + odeme.id);

  // ---- et_p cerezi: <odemeId>.<HMAC(secret, odemeId)> — success.js durumu cerezle canli sorar
  const cerez = odemeCerezDegeri(odeme.id);
  if (cerez) {
    cerezEkle(res, cerezYaz('et_p', cerez, { maxAge: 7200, httpOnly: true, secure: c.siteHttps, sameSite: 'Lax', path: '/' }));
  }

  // ---- checkout'a 303
  yanitYonlendir(res, 303, checkout);
});
