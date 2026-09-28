'use strict';
// ============================================================
// EUROPA TAXI — kurulum tanilama (/pay/test.php -> /api/test)
// !!! KURULUM BITINCE BU UC NOKTAYI KAPATIN: kaynak/vercel/api/test.js dosyasini SILIN ve yeniden dagitin
//     (ya da vercel.json'daki /pay/test.php rewrite'ini kaldirin). !!!
//
// Sifre URL'de OLMAZ: yalniz POST govdesindeki `pw` alani. GET ?pw=... ASLA kabul edilmez.
// ADMIN_PASSWORD bossa uc nokta KAPALI. Raporda sirlarin DEGERI yok: yalniz ayarli/degil ve uzunluk.
// Dogru sifreyle POST -> rapor + yonetici oturum cerezi (orders paneliyle ortak); "Test e-postasi"
// dugmesi bu cerezle POST eder (sifre sayfaya yazilmaz).
// ============================================================

const { cfg, envRapor, ODEME_YONTEMLERI } = require('./_lib/config');
const { h, miniSayfa, yanitHtml, yanitMetin } = require('./_lib/html');
const {
  sarmala, govdeOku, formCoz, cerezEkle, kaynakIzinli, istemciIp, yoneticiSiniri,
  yoneticiSifreDogru, oturumCerezSatiri, oturumVarMi,
} = require('./_lib/guvenlik');
const { mollie } = require('./_lib/mollie');
const { epostaGonder } = require('./_lib/mail');
const { googleKm } = require('./_lib/mesafe');
const { kayit } = require('./_lib/log');
const YERLER = require('./_lib/mesafe.json').yerler;
const DIL = require('./_lib/dil.json');

const TEST_ADRESI = '/pay/test.php';

function girisSayfasi(mesaj) {
  return miniSayfa('tr', 'Kurulum tanılama',
    (mesaj ? '<p style="color:#FFB4AE">' + h(mesaj) + '</p>' : '') +
    '<form method="post" action="' + TEST_ADRESI + '">' +
    '<p><label style="font-size:13px;color:#A8AAB3">Yönetici şifresi (ADMIN_PASSWORD)</label><br>' +
    '<input type="password" name="pw" autofocus autocomplete="current-password" ' +
    'style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);' +
    'background:#1A1A1F;color:#F4F4F6;font-size:16px;box-sizing:border-box"></p>' +
    '<div class="btnler"><button class="btn" type="submit" style="border:0;cursor:pointer;font-size:15px">Raporu göster</button></div>' +
    '</form><p class="ref">Şifre adres çubuğuna yazılmaz; yalnızca bu form ile gönderilir.</p>');
}

/** Ortam degiskeni satirlari: [ad, ayarli?, detay]. Deger ASLA yazilmaz (SITE_URL/tolerans/BASE gibi sir olmayanlar haric). */
function envSatirlari(c) {
  const satirlar = [];
  const sir = (ad, zorunlu, ek) => {
    const r = envRapor(ad);
    let detay = r.ayarli ? 'ayarlı (' + r.uzunluk + ' karakter)' : (zorunlu ? 'AYARLI DEĞİL' : 'ayarlı değil');
    if (r.ayarli && r.bosluk) detay += ' — başta/sonda boşluk var (kopyalarken eklenmiş olabilir)';
    if (ek && r.ayarli) detay += ' — ' + ek;
    satirlar.push([ad, r.ayarli || !zorunlu, detay]);
  };
  sir('MOLLIE_API_KEY', true, c.mollieKey.startsWith('live_') ? 'CANLI anahtar' : (c.mollieKey.startsWith('test_') ? 'test anahtarı' : 'test_/live_ ile başlamıyor'));
  sir('BREVO_API_KEY', true);
  sir('ADMIN_PASSWORD', true, c.adminPassword.length < 12 ? 'UYARI: 12 karakterden kısa' : '');
  sir('SIGNING_SECRET', false, '');
  sir('GOOGLE_SERVER_KEY', false);
  sir('COMPANY_EMAIL', false);
  sir('MAIL_FROM', false);
  // sir olmayan degerler
  satirlar.push(['SITE_URL', c.siteHttps, envRapor('SITE_URL').ayarli ? c.siteUrl : c.siteUrl + ' (varsayılan)']);
  satirlar.push(['DISTANCE_TOLERANCE_PCT', true, '%' + c.tolerancePct + (envRapor('DISTANCE_TOLERANCE_PCT').ayarli ? '' : ' (varsayılan)')]);
  for (const [ad, deger] of [['MOLLIE_API_BASE', c.mollieBase], ['BREVO_API_BASE', c.brevoBase], ['GOOGLE_API_BASE', c.googleBase]]) {
    if (envRapor(ad).ayarli) satirlar.push([ad, deger !== null, deger === null ? 'GEÇERSİZ (yalnız https:// veya http://127.0.0.1) — çağrılar reddedilir' : 'TEST TABANI: ' + deger]);
  }
  return satirlar;
}

async function kontroller(c) {
  const k = [];
  const ekle = (ad, iyi, detay) => k.push([ad, iyi, detay || '']);

  ekle('Node.js sürümü ≥ 20', Number(process.versions.node.split('.')[0]) >= 20, 'Node ' + process.versions.node);
  ekle('Metin verisi (dil.json) yüklü', !!DIL.diller && ['fr', 'nl', 'en', 'tr'].every((d) => DIL.diller[d]), 'vercel_build.py üretir');
  ekle('Mesafe verisi (mesafe.json) yüklü', Object.keys(YERLER).length > 50, Object.keys(YERLER).length + ' yer');
  ekle('SITE_URL https', c.siteHttps, c.siteHttps ? '' : 'canlıda https:// kullanın (Secure çerez ve Mollie için gerekli)');
  ekle('SIGNING_SECRET ayrı tanımlı', !c.signingDerived,
    c.signingDerived ? 'UYARI: SIGNING_SECRET yok; MOLLIE_API_KEY+ADMIN_PASSWORD\'den TÜRETİLİYOR. Ayrı, rastgele bir SIGNING_SECRET tanımlayın.' : '');

  // ---- Mollie
  if (!c.mollieKey) {
    ekle('Mollie anahtarı girilmiş', false, 'MOLLIE_API_KEY tanımlayın');
  } else {
    const { kod, veri } = await mollie('GET', 'methods');
    const yontemler = ((veri._embedded && veri._embedded.methods) || []).map((m) => (m && m.id) || '?');
    ekle('Mollie bağlantısı', kod === 200,
      kod === 200 ? 'aktif yöntemler: ' + (yontemler.join(', ') || 'YOK — Mollie panosundan etkinleştirin')
        : 'HTTP ' + kod + (veri && veri.detail ? ' — ' + String(veri.detail).slice(0, 120) : ''));
    if (kod === 200) {
      for (const y of ODEME_YONTEMLERI) {
        ekle('Yöntem aktif: ' + y, yontemler.includes(y), yontemler.includes(y) ? '' : 'Mollie panosu > Ödeme yöntemleri bölümünden açın');
      }
    }
  }

  // ---- Brevo
  if (!c.brevoKey) {
    ekle('Brevo API anahtarı', false, 'BREVO_API_KEY yok: e-postalar GÖNDERİLEMEZ (Vercel\'de PHP mail() yedeği yoktur)');
  } else if (!c.brevoBase) {
    ekle('Brevo erişilebilirliği', false, 'BREVO_API_BASE geçersiz');
  } else {
    try {
      const r = await fetch(c.brevoBase + '/account', { headers: { 'api-key': c.brevoKey, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), redirect: 'error' });
      await r.arrayBuffer().catch(() => null);
      ekle('Brevo erişilebilirliği', r.status === 200, r.status === 200 ? 'anahtar geçerli' : 'HTTP ' + r.status + (r.status === 401 ? ' — anahtar geçersiz' : ''));
    } catch (e) {
      ekle('Brevo erişilebilirliği', false, 'bağlantı hatası: ' + (e && e.name));
    }
  }
  ekle('Gönderen adres (MAIL_FROM) ayarlı', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.mailFrom), 'Brevo\'da doğrulanmış olmalı');
  ekle('Şirket adresi (COMPANY_EMAIL) ayarlı', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.companyEmail), '');

  // ---- Google
  if (!c.googleKey) {
    ekle('Google SUNUCU anahtarı (Distance Matrix)', false, 'boşsa mesafe yalnızca dahili tabloyla doğrulanır (tanınmayan adresler reddedilir)');
  } else if (!c.googleBase) {
    ekle('Google erişilebilirliği', false, 'GOOGLE_API_BASE geçersiz');
  } else {
    const km = await googleKm('Brussels', 'Gent');
    ekle('Google Distance Matrix erişilebilirliği', km !== null, km !== null ? 'Brussels → Gent: ' + km + ' km' : 'yanıt alınamadı (anahtar/kısıtlama/faturalandırma?)');
  }
  return k;
}

function raporSayfasi(c, satirlarEnv, kontrolListesi, postaSonucu) {
  let sorun = 0;
  const satir = (ad, iyi, detay) => {
    if (!iyi) sorun++;
    const isaret = iyi ? '<span style="color:#4CAF50;font-weight:800">✓</span>' : '<span style="color:#FF5252;font-weight:800">✗</span>';
    return '<tr><td style="width:26px">' + isaret + '</td><td>' + h(ad) + '</td><td style="color:#A8AAB3;font-size:13px">' + h(detay) + '</td></tr>';
  };
  const envHtml = satirlarEnv.map(([ad, iyi, detay]) => satir(ad, iyi, detay)).join('');
  const kontrolHtml = kontrolListesi.map(([ad, iyi, detay]) => satir(ad, iyi, detay)).join('');
  const posta = postaSonucu === null ? '' :
    '<div class="sonuc ' + (postaSonucu.ok && !postaSonucu.atlandi ? 'ok' : 'hata') + '">' +
    (postaSonucu.ok && !postaSonucu.atlandi ? 'Gönderildi (' + h(postaSonucu.yontem) + '). Gelen kutusunu ve spam klasörünü kontrol edin.'
      : postaSonucu.atlandi ? 'BREVO_API_KEY yok: e-posta gönderilemedi.' : 'Gönderilemedi: ' + h(postaSonucu.hata)) + '</div>';

  return '<!doctype html>\n<html lang="tr">\n<head>\n' +
'<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<meta name="robots" content="noindex,nofollow">\n<meta name="color-scheme" content="dark">\n' +
'<title>Kurulum tanılama · Europa Taxi</title>\n<style>\n' +
'body{background:#0A0A0C;color:#F4F4F6;font:400 15px/1.6 system-ui,sans-serif;margin:0;padding:24px;max-width:860px;margin-inline:auto}\n' +
'h1{font-size:22px}h1 span{color:#FFC107}h2{font-size:17px;margin-top:28px}\n' +
'.uyari{background:#B3261E22;border:1px solid #B3261E;color:#FFB4AE;border-radius:12px;padding:16px 18px;font-weight:700;margin:18px 0}\n' +
'table{width:100%;border-collapse:collapse;background:#121215;border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden}\n' +
'td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}\n' +
'.ozet{margin:16px 0;color:#A8AAB3}\n' +
'button{background:linear-gradient(180deg,#FFC107,#E5A93C);border:0;color:#141005;font-weight:800;padding:12px 22px;border-radius:10px;font-size:15px;cursor:pointer}\n' +
'.sonuc{margin-top:10px;padding:12px;border-radius:10px;font-size:14px}\n' +
'.sonuc.ok{background:#2E7D3222;border:1px solid #2E7D32;color:#A5D6A7}\n' +
'.sonuc.hata{background:#B3261E22;border:1px solid #B3261E;color:#FFB4AE}\n' +
'code{background:#1A1A1F;padding:2px 6px;border-radius:6px}\n' +
'</style>\n</head>\n<body>\n' +
'<h1>EUROPA<span>TAXI</span> · Kurulum tanılama</h1>\n' +
'<div class="uyari">⚠️ KURULUM BİTİNCE BU UÇ NOKTAYI KAPATIN: <code>api/test.js</code> dosyasını silin ve yeniden dağıtın.\n' +
'Bu sayfa yalnızca kurulum sırasında kullanılır.</div>\n' +
'<h2>Ortam değişkenleri (değerler gösterilmez)</h2>\n<table>' + envHtml + '</table>\n' +
'<h2>Kontroller</h2>\n<table>' + kontrolHtml + '</table>\n' +
'<p class="ozet">' + (sorun === 0 ? 'Tüm kontroller yeşil ✅' : sorun + ' madde ilgi bekliyor.') + '</p>\n' +
'<h2>Test e-postası</h2>\n<form method="post" action="' + TEST_ADRESI + '">\n' +
'  <button type="submit" name="eposta_testi" value="1">Test e-postası gönder → ' + h(c.companyEmail) + '</button>\n</form>\n' +
posta + '\n</body>\n</html>';
}

module.exports = sarmala('test', async function handler(req, res, ctx) {
  ctx.dil = 'tr';
  const c = cfg();

  if (!c.adminPassword) {
    yanitHtml(res, 503, miniSayfa('tr', 'Tanılama kapalı',
      '<p>Önce <code>ADMIN_PASSWORD</code> ortam değişkenini tanımlayıp yeniden dağıtın. Şifre adrese yazılmaz; formla gönderilir.</p>'));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    yanitMetin(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD, POST' });
    return;
  }

  let yetkili = false;
  let yeniOturum = false;
  let form = null;

  if (req.method === 'POST') {
    if (!kaynakIzinli(req)) {
      yanitMetin(res, 403, 'Forbidden');
      return;
    }
    let govde;
    try {
      govde = await govdeOku(req);
    } catch (e) {
      if (e && e.kod === 413) { yanitMetin(res, 413, 'govde cok buyuk', { Connection: 'close' }); return; }
      throw e;
    }
    form = formCoz(govde);
    const pw = form.ilk('pw');
    if (typeof pw === 'string') {
      // sifreyle giris denemesi: kaba kuvvet korumali (orders ile ortak sayac)
      const ip = istemciIp(req);
      const kilit = yoneticiSiniri.kalanSn(ip);
      if (kilit > 0) {
        yanitHtml(res, 429, miniSayfa('tr', 'Çok fazla deneme', '<p>Çok fazla hatalı giriş denemesi. Lütfen daha sonra tekrar deneyin.</p>'),
          { 'Retry-After': String(kilit) });
        return;
      }
      if (yoneticiSifreDogru(pw)) {
        yoneticiSiniri.temizle(ip);
        yetkili = true;
        yeniOturum = true;
      } else {
        const sonKilit = yoneticiSiniri.basarisiz(ip);
        kayit('uyari', 'test: hatali giris denemesi' + (sonKilit ? ' (IP kilitlendi)' : ''));
        if (sonKilit > 0) {
          yanitHtml(res, 429, miniSayfa('tr', 'Çok fazla deneme', '<p>Çok fazla hatalı giriş denemesi. Lütfen daha sonra tekrar deneyin.</p>'),
            { 'Retry-After': String(sonKilit) });
          return;
        }
        yanitHtml(res, 403, girisSayfasi('Şifre hatalı.'));
        return;
      }
    }
  }
  if (!yetkili) yetkili = oturumVarMi(req);   // GET (veya cerezli POST): yalniz oturum cerezi; ?pw= ASLA
  if (!yetkili) {
    yanitHtml(res, 200, girisSayfasi(''));
    return;
  }
  if (yeniOturum) cerezEkle(res, oturumCerezSatiri());

  // ---- test e-postasi (yalniz oturumlu POST)
  let postaSonucu = null;
  if (req.method === 'POST' && form && form.ilk('eposta_testi') !== undefined) {
    postaSonucu = await epostaGonder(
      c.companyEmail,
      'Europa Taxi kurulum testi',
      '<p>Bu bir kurulum test e-postasıdır. Bunu okuyorsanız e-posta ayarları çalışıyor.</p>',
      'Bu bir kurulum test e-postasidir.'
    );
  }

  const kontrolListesi = await kontroller(c);
  yanitHtml(res, 200, raporSayfasi(c, envSatirlari(c), kontrolListesi, postaSonucu));
});
