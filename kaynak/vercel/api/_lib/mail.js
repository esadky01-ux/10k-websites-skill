'use strict';
// ============================================================
// EUROPA TAXI — e-posta: Brevo API gonderimi + musteri HTML / sirket duz metin govdeleri.
// Govdeler kaynak/pay/mailer.php (musteri_eposta_html, sirket_eposta_metni) ile AYNI icerik ve yapidadir.
// Vercel'de PHP mail() yedegi YOKTUR: BREVO_API_KEY yoksa e-posta gonderilemez (atlanir + loglanir).
// ============================================================

const { cfg } = require('./config');
const { t, dilSec, isletme, para, paraSent, tarihGoster } = require('./dil');
const { h } = require('./html');
const { kayit } = require('./log');

/**
 * E-posta gonderir. Doner: { ok, atlandi, yontem, hata }
 *  - anahtar yoksa: ATLANIR (ok:true, atlandi:true) — hata sayilmaz ama loglanir
 *  - Brevo 2xx disi / ag hatasi: ok:false (webhook 500 doner, Mollie yeniden dener)
 */
async function epostaGonder(kime, konu, html, duzMetin) {
  const c = cfg();
  if (!c.brevoKey) {
    kayit('uyari', 'BREVO_API_KEY yok: e-posta gonderilemedi');
    return { ok: true, atlandi: true, yontem: 'yok', hata: null };
  }
  if (!c.brevoBase) {
    kayit('hata', 'BREVO_API_BASE gecersiz: e-posta gonderilemedi');
    return { ok: false, atlandi: false, yontem: 'brevo', hata: 'BREVO_API_BASE gecersiz' };
  }
  const govde = {
    sender: { name: 'Europa Taxi', email: c.mailFrom },
    // e-posta 'bu e-postayi yanitlayin' der: yanit noreply'a degil sirket adresine gitsin (PHP ile ayni)
    replyTo: { email: c.companyEmail },
    to: [{ email: kime }],
    subject: konu,
    htmlContent: html,
  };
  if (duzMetin) govde.textContent = duzMetin;
  try {
    const r = await fetch(c.brevoBase + '/smtp/email', {
      method: 'POST',
      headers: { 'api-key': c.brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(govde),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    await r.arrayBuffer().catch(() => null); // baglantiyi serbest birak; govde loglanmaz
    if (r.status >= 200 && r.status < 300) return { ok: true, atlandi: false, yontem: 'brevo', hata: null };
    kayit('hata', 'Brevo hatasi (HTTP ' + r.status + ')');
    return { ok: false, atlandi: false, yontem: 'brevo', hata: 'HTTP ' + r.status };
  } catch (e) {
    kayit('hata', 'Brevo ag hatasi: ' + (e && (e.name || e.code)));
    return { ok: false, atlandi: false, yontem: 'brevo', hata: String(e && e.name) };
  }
}

/** Siparisten arac adi ("Ekonomi (Tesla Model 3)" gibi, musteri dilinde). */
function aracAdi(dil, arac) {
  const eslesme = { eco: 'veh_eco', wagon: 'veh_wagon', vip: 'veh_vip' };
  const on = eslesme[arac] || 'veh_eco';
  return t(dil, on + '_name') + ' (' + t(dil, on + '_model') + ')';
}

/** Musteriye giden HTML onay e-postasi (mailer.php musteri_eposta_html ile ayni). */
function musteriEpostaHtml(s) {
  const dil = dilSec(s.dil || 'fr');
  const i = isletme();

  const satir = (etiket, deger) => '<tr>' +
    '<td style="padding:9px 0;color:#6E7080;font-size:13px;vertical-align:top;white-space:nowrap;padding-right:18px;">' + h(etiket) + '</td>' +
    '<td style="padding:9px 0;color:#1A1A1F;font-size:14px;font-weight:600;">' + h(deger) + '</td>' +
    '</tr>';

  let satirlar = satir(t(dil, 'em_ref'), s.no) +
    satir(t(dil, 'em_route'), s.alis + ' → ' + s.varis) +
    satir(t(dil, 'em_date'), tarihGoster(dil, s.tarih, s.saat));
  if (s.donus_tarih) {
    satirlar += satir(t(dil, 'em_return'), tarihGoster(dil, s.donus_tarih, s.donus_saat || ''));
  }
  satirlar += satir(t(dil, 'em_vehicle'), aracAdi(dil, s.arac)) +
    satir(t(dil, 'em_pax'), String(s.yolcu)) +
    satir(t(dil, 'em_bags'), s.buyuk + ' + ' + s.kucuk) +
    satir(t(dil, 'em_paid'), para(dil, s.kapora)) +
    satir(t(dil, 'em_due'), para(dil, s.kalan));

  return '<!doctype html><html><body style="margin:0;padding:0;background:#F2F2F4;">\n' +
'<div style="max-width:560px;margin:0 auto;padding:24px 14px;font-family:Arial,Helvetica,sans-serif;">\n' +
'  <div style="background:#0A0A0C;border-radius:14px 14px 0 0;padding:22px 28px;">\n' +
'    <span style="font-size:20px;font-weight:900;letter-spacing:1px;color:#FFFFFF;">EUROPA<span style="color:#FFC107;">TAXI</span></span>\n' +
'  </div>\n' +
'  <div style="height:4px;background:#FFC107;"></div>\n' +
'  <div style="background:#FFFFFF;border-radius:0 0 14px 14px;padding:28px;">\n' +
'    <h1 style="margin:0 0 6px;font-size:21px;color:#1A1A1F;">' + h(t(dil, 'em_heading')) + '</h1>\n' +
'    <p style="margin:0 0 18px;color:#55565E;font-size:14px;">' + h(t(dil, 'em_intro', { name: s.ad })) + '</p>\n' +
'    <table style="width:100%;border-collapse:collapse;border-top:1px solid #ECECEF;">' + satirlar + '</table>\n' +
'    <div style="margin-top:20px;padding:14px 16px;background:#FFF8E4;border-radius:10px;">\n' +
'      <b style="font-size:13px;color:#8a6d00;">' + h(t(dil, 'em_cancel_t')) + '</b>\n' +
'      <p style="margin:6px 0 0;font-size:13px;color:#6b6b6b;">' + h(t(dil, 'cancel_policy')) + '</p>\n' +
'    </div>\n' +
'    <p style="margin:20px 0 0;font-size:13px;color:#55565E;">' + h(t(dil, 'em_outro', { phone: i.telefon || '' })) + '</p>\n' +
'    <p style="margin:22px 0 0;font-size:11px;color:#9A9BA3;">\n' +
'      Europa Taxi · ' + h((i.unvan || '') + ' · ' + (i.kdv || '')) + '<br>' +
      h(i.adres || '') + '<br>' +
      h((i.telefon || '') + ' · ' + (i.eposta || '')) + '\n' +
'    </p>\n' +
'  </div>\n' +
'</div>\n' +
'</body></html>';
}

/** Tutar: "121,44" (binlik ayirac yok; PHP number_format($x, 2, ',', '') ile ayni). */
function tutarDuz(tutar) {
  const sent = Math.round(Number(tutar) * 100 + 1e-9);
  return Math.floor(sent / 100) + ',' + String(sent % 100).padStart(2, '0');
}

/**
 * Sirkete giden duz metin is emri (mailer.php sirket_eposta_metni ile ayni yapi).
 * Durumsuz tasarimda istemci km'si metadata'ya girmedigi icin "Mesafe" satiri kaynagi bildirir.
 */
function sirketEpostaMetni(s) {
  const donus = s.donus_tarih ? tarihGoster('tr', s.donus_tarih, s.donus_saat || '') : '-';
  const dogrulama = s.km_sunucu !== null && s.km_sunucu !== undefined
    ? 'Google ile dogrulandi'
    : 'dahili tablo ile dogrulandi; Google sunucu dogrulamasi yok';
  return 'YENI REZERVASYON — KAPORA ODENDI\n' +
    '================================\n' +
    'Referans     : ' + s.no + '\n' +
    'Musteri      : ' + s.ad + '\n' +
    'Telefon      : ' + s.telefon + '\n' +
    'E-posta      : ' + s.eposta + '\n' +
    '--------------------------------\n' +
    'Guzergah     : ' + s.alis + ' -> ' + s.varis + '\n' +
    'Alis         : ' + tarihGoster('tr', s.tarih, s.saat) + '\n' +
    'Donus        : ' + donus + '\n' +
    'Arac         : ' + aracAdi('tr', s.arac) + '\n' +
    'Yolcu        : ' + s.yolcu + '\n' +
    'Valiz        : ' + s.buyuk + ' buyuk + ' + s.kucuk + ' kucuk' + '\n' +
    '--------------------------------\n' +
    'Mesafe       : ' + s.km + ' km (' + dogrulama + ')\n' +
    'Toplam       : ' + tutarDuz(s.toplam) + ' EUR\n' +
    'Odenen kapora: ' + tutarDuz(s.kapora) + ' EUR\n' +
    'ARACTA TAHSIL: ' + tutarDuz(s.kalan) + ' EUR\n' +
    'Dil          : ' + String(s.dil).toUpperCase() + '\n';
}

module.exports = { epostaGonder, aracAdi, musteriEpostaHtml, sirketEpostaMetni, paraSent };
