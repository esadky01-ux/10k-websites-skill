'use strict';
// ============================================================
// EUROPA TAXI — sifreli rezervasyon paneli (/pay/orders.php -> /api/orders)
// Siparisler Mollie'den listelenir (metadata.v===1); diske hicbir sey yazilmaz.
// Giris: ADMIN_PASSWORD (bossa panel KAPALI), zaman-sabit karsilastirma, imzali oturum cerezi
// (HttpOnly; Secure; SameSite=Strict; 12 saat). Kaba kuvvet: IP basina 5 basarisiz denemeden
// sonra 15 dk 429 (bellek ici, en-iyi-caba — README'de Vercel Firewall onerisi).
// Panel dili Turkce (isletme ici; PHP orders.php ile ayni bilgiler). Tum kullanici alanlari HTML-kacislidir.
// ============================================================

const { cfg } = require('./_lib/config');
const { para, paraSent, tarihGoster } = require('./_lib/dil');
const { h, miniSayfa, yanitHtml, yanitMetin, yanitYonlendir } = require('./_lib/html');
const {
  sarmala, govdeOku, formCoz, cerezEkle, kaynakIzinli, istemciIp, yoneticiSiniri,
  yoneticiSifreDogru, oturumCerezSatiri, oturumCerezSil, oturumVarMi,
} = require('./_lib/guvenlik');
const { siparisOdemeleri } = require('./_lib/mollie');
const { metadataDanSiparis } = require('./_lib/siparis');
const { kayit } = require('./_lib/log');

const PANEL_ADRESI = '/pay/orders.php';
const EN_FAZLA_SIPARIS = 250;
const SAYFA_BOYUTU = 250;      // Mollie sayfa basina en fazla 250
const EN_FAZLA_SAYFA = 6;

const BRUKSEL_ZAMAN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function zamanMetni(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const p = {};
  for (const x of BRUKSEL_ZAMAN.formatToParts(new Date(ms))) p[x.type] = x.value;
  return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute;
}

function sorgu(req) {
  try { return new URL(req.url || '/', 'http://x').searchParams; } catch (_) { return new URLSearchParams(); }
}

function girisFormu(hataMetni) {
  return miniSayfa('tr', 'Rezervasyon paneli',
    (hataMetni ? '<p style="color:#FFB4AE">' + h(hataMetni) + '</p>' : '') +
    '<form method="post" action="' + PANEL_ADRESI + '">' +
    '<p><label style="font-size:13px;color:#A8AAB3">Şifre</label><br>' +
    '<input type="password" name="pw" autofocus autocomplete="current-password" ' +
    'style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);' +
    'background:#1A1A1F;color:#F4F4F6;font-size:16px;box-sizing:border-box"></p>' +
    '<div class="btnler"><button class="btn" type="submit" style="border:0;cursor:pointer;font-size:15px">Giriş</button></div>' +
    '</form>');
}

const ROZET_RENK = { odendi: '#2E7D32', beklemede: '#8a6d00', basarisiz: '#B3261E', iptal: '#B3261E', suresi_doldu: '#B3261E', iade: '#B3261E' };
const ROZET_AD = { odendi: 'ÖDENDİ', beklemede: 'BEKLİYOR', basarisiz: 'BAŞARISIZ', iptal: 'İPTAL', suresi_doldu: 'SÜRESİ DOLDU', iade: 'İADE' };

function rozet(durum) {
  const renk = ROZET_RENK[durum] || '#55565E';
  const ad = ROZET_AD[durum] || String(durum).toUpperCase();
  return '<span style="background:' + renk + '22;color:' + renk + ';border:1px solid ' + renk + '55;' +
    'padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;white-space:nowrap">' + h(ad) + '</span>';
}

function sekme(kod, ad, sayi, aktif) {
  const secili = kod === aktif ? 'background:#FFC107;color:#141005' : 'color:#A8AAB3;border:1px solid rgba(255,255,255,.15)';
  return '<a style="padding:8px 16px;border-radius:99px;text-decoration:none;font-size:13px;font-weight:700;' + secili + '"' +
    ' href="' + PANEL_ADRESI + '?f=' + kod + '">' + h(ad) + ' (' + sayi + ')</a>';
}

/** "12.34" -> sent (tamsayi); gecersizse 0 */
function sentOku(metin) {
  const m = /^(\d+)\.(\d{2})$/.exec(String(metin));
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
}

function panelSayfasi(siparisler, suzgec, uyari) {
  // iade / geri odeme -> gosterim durumu 'iade'
  const gorunen = (s) => (s.durum === 'odendi' && (s.iade > 0 || s.geriOdeme > 0) ? 'iade' : s.durum);
  let tahsilatSent = 0;
  let aractaSent = 0;
  let odendiSayi = 0;
  let bekleyenSayi = 0;
  for (const s of siparisler) {
    const d = gorunen(s);
    if (d === 'odendi') {
      odendiSayi++;
      tahsilatSent += sentOku(s.odenenTutar) || s.kaporaSent;
      aractaSent += s.kalanSent;
    } else if (d === 'beklemede') {
      bekleyenSayi++;
    }
  }
  const liste = siparisler.filter((s) => suzgec === 'hepsi' || gorunen(s) === suzgec);

  let satirlar = '';
  for (const s of liste) {
    const tel = String(s.telefon).replace(/\D/g, '');
    const donus = s.donus_tarih
      ? '<br><small style="color:#6E7080">↩ ' + h(tarihGoster('tr', s.donus_tarih, s.donus_saat)) + '</small>'
      : '';
    const tutarNotu = s.durum === 'odendi' && (s.odenenTutar !== s.beklenenKapora || s.odenenPara !== 'EUR')
      ? '<br><small style="color:#FFB4AE">⚠ ödenen tutar beklenenle uyuşmuyor (' + h(s.odenenTutar + ' ' + s.odenenPara) + ')</small>'
      : '';
    satirlar += '<tr>' +
      '<td><b>' + h(s.no) + '</b><br><small style="color:#6E7080">' + h(zamanMetni(s.olusturma)) + '</small></td>' +
      '<td>' + h(s.alis) + ' → ' + h(s.varis) +
      '<br><small style="color:#A8AAB3">' + h(tarihGoster('tr', s.tarih, s.saat)) + donus + '</small></td>' +
      '<td>' + h(s.ad) + '<br><a style="color:#FFC107" href="tel:+' + h(tel) + '">' + h(s.telefon) + '</a></td>' +
      '<td style="text-align:right">' + h(paraSent('tr', s.toplamSent)) +
      '<br><small style="color:#A8AAB3">kapora ' + h(paraSent('tr', s.kaporaSent)) + '</small>' +
      '<br><b style="color:#FFC107">araçta ' + h(paraSent('tr', s.kalanSent)) + '</b>' + tutarNotu + '</td>' +
      '<td>' + h(s.yolcu) + ' yolcu<br><small style="color:#A8AAB3">' +
      h(s.buyuk) + 'B + ' + h(s.kucuk) + 'K · ' + h(s.arac) + ' · ' + h(s.km) + ' km</small></td>' +
      '<td>' + rozet(gorunen(s)) + '</td>' +
      '</tr>';
  }
  if (satirlar === '') {
    satirlar = '<tr><td colspan="6" style="text-align:center;color:#6E7080;padding:40px">Kayıt yok</td></tr>';
  }

  return '<!doctype html>\n<html lang="tr">\n<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<meta name="robots" content="noindex,nofollow">\n' +
'<meta name="color-scheme" content="dark">\n' +
'<title>Rezervasyonlar · Europa Taxi</title>\n' +
'<style>\n' +
'body{background:#0A0A0C;color:#F4F4F6;font:400 15px/1.5 system-ui,sans-serif;margin:0;padding:24px}\n' +
'.ust{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}\n' +
'h1{font-size:20px;margin:0}h1 span{color:#FFC107}\n' +
'.kartlar{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}\n' +
'.kart{background:#121215;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:14px 20px}\n' +
'.kart b{display:block;font-size:22px;color:#FFC107}\n' +
'.kart span{font-size:12px;color:#A8AAB3;text-transform:uppercase;letter-spacing:.5px}\n' +
'table{width:100%;border-collapse:collapse;background:#121215;border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden}\n' +
'th{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#6E7080;text-align:left;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.09)}\n' +
'td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}\n' +
'tr:hover td{background:rgba(255,255,255,.02)}\n' +
'.tablo-sar{overflow-x:auto}\n' +
'a.cikis{margin-left:auto;color:#6E7080;font-size:13px}\n' +
'.uyari{background:#8a6d0022;border:1px solid #8a6d00;color:#FFE08A;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:14px}\n' +
'</style>\n</head>\n<body>\n' +
'<div class="ust">\n' +
'  <h1>EUROPA<span>TAXI</span> · Rezervasyonlar</h1>\n' +
'  ' + sekme('hepsi', 'Hepsi', siparisler.length, suzgec) + '\n' +
'  ' + sekme('odendi', 'Ödendi', odendiSayi, suzgec) + '\n' +
'  ' + sekme('beklemede', 'Bekliyor', bekleyenSayi, suzgec) + '\n' +
'  <a class="cikis" href="' + PANEL_ADRESI + '?cikis=1">Çıkış</a>\n' +
'</div>\n' +
(uyari ? '<div class="uyari">' + h(uyari) + '</div>\n' : '') +
'<div class="kartlar">\n' +
'  <div class="kart"><b>' + h(paraSent('tr', tahsilatSent)) + '</b><span>Tahsil edilen kapora</span></div>\n' +
'  <div class="kart"><b>' + h(paraSent('tr', aractaSent)) + '</b><span>Araçta beklenen</span></div>\n' +
'  <div class="kart"><b>' + odendiSayi + '</b><span>Ödenmiş rezervasyon</span></div>\n' +
'</div>\n' +
'<div class="tablo-sar">\n<table>\n' +
'  <tr><th>Referans</th><th>Güzergâh</th><th>Müşteri</th><th style="text-align:right">Tutar</th><th>Detay</th><th>Durum</th></tr>\n' +
'  ' + satirlar + '\n' +
'</table>\n</div>\n</body>\n</html>';
}

module.exports = sarmala('orders', async function handler(req, res, ctx) {
  ctx.dil = 'tr';
  const c = cfg();

  // ---- ADMIN_PASSWORD yoksa panel KAPALI
  if (!c.adminPassword) {
    yanitHtml(res, 503, miniSayfa('tr', 'Panel kapalı',
      '<p>Önce Vercel ortam değişkenlerinde <code>ADMIN_PASSWORD</code> için güçlü bir şifre tanımlayın ve yeniden dağıtın.</p>'));
    return;
  }
  const yontem = req.method;
  if (yontem !== 'GET' && yontem !== 'HEAD' && yontem !== 'POST') {
    yanitMetin(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD, POST' });
    return;
  }
  const q = sorgu(req);

  // ---- cikis
  if (q.get('cikis')) {
    cerezEkle(res, oturumCerezSil());
    yanitYonlendir(res, 303, PANEL_ADRESI);
    return;
  }

  // ---- giris (POST pw)
  if (yontem === 'POST') {
    if (!kaynakIzinli(req)) {
      kayit('uyari', 'orders: Origin/Referer reddedildi');
      yanitMetin(res, 403, 'Forbidden');
      return;
    }
    const ip = istemciIp(req);
    const kilit = yoneticiSiniri.kalanSn(ip);
    if (kilit > 0) {
      yanitHtml(res, 429, miniSayfa('tr', 'Çok fazla deneme', '<p>Çok fazla hatalı giriş denemesi. Lütfen daha sonra tekrar deneyin.</p>'),
        { 'Retry-After': String(kilit) });
      return;
    }
    let govde;
    try {
      govde = await govdeOku(req);
    } catch (e) {
      if (e && e.kod === 413) { yanitMetin(res, 413, 'govde cok buyuk', { Connection: 'close' }); return; }
      throw e;
    }
    const pw = formCoz(govde).ilk('pw');
    if (typeof pw === 'string' && yoneticiSifreDogru(pw)) {
      yoneticiSiniri.temizle(ip);
      cerezEkle(res, oturumCerezSatiri());
      kayit('bilgi', 'orders: yonetici girisi basarili');
      yanitYonlendir(res, 303, PANEL_ADRESI);
      return;
    }
    const sonKilit = yoneticiSiniri.basarisiz(ip);
    kayit('uyari', 'orders: hatali giris denemesi' + (sonKilit ? ' (IP kilitlendi)' : ''));
    if (sonKilit > 0) {
      yanitHtml(res, 429, miniSayfa('tr', 'Çok fazla deneme', '<p>Çok fazla hatalı giriş denemesi. Lütfen daha sonra tekrar deneyin.</p>'),
        { 'Retry-After': String(sonKilit) });
      return;
    }
    yanitHtml(res, 401, girisFormu('Şifre hatalı.'));
    return;
  }

  // ---- oturum yoksa giris formu
  if (!oturumVarMi(req)) {
    yanitHtml(res, 200, girisFormu(''));
    return;
  }

  // ---- siparisleri Mollie'den oku
  const suzgec = ['odendi', 'beklemede'].includes(q.get('f')) ? q.get('f') : 'hepsi';
  const sonuc = await siparisOdemeleri(EN_FAZLA_SIPARIS, SAYFA_BOYUTU, EN_FAZLA_SAYFA);
  if (!sonuc.ok && sonuc.odemeler.length === 0) {
    kayit('hata', 'orders: Mollie listesi alinamadi');
    yanitHtml(res, 502, miniSayfa('tr', 'Mollie\'ye ulaşılamadı',
      '<p>Rezervasyon listesi şu anda Mollie\'den alınamadı. Birkaç saniye sonra sayfayı yenileyin. ' +
      'Sorun sürerse <code>MOLLIE_API_KEY</code> değerini kontrol edin.</p>'));
    return;
  }
  const siparisler = [];
  for (const o of sonuc.odemeler) {
    const s = metadataDanSiparis(o);
    if (s) siparisler.push(s);
  }
  siparisler.sort((a, b) => (a.olusturma < b.olusturma ? 1 : a.olusturma > b.olusturma ? -1 : 0));
  let uyari = '';
  if (!sonuc.ok) uyari = 'Liste eksik olabilir: Mollie\'ye erişim yarıda kesildi.';
  else if (sonuc.kesildi) uyari = 'Yalnızca en yeni ' + EN_FAZLA_SIPARIS + ' rezervasyon gösteriliyor.';

  yanitHtml(res, 200, panelSayfasi(siparisler, suzgec, uyari));
});
