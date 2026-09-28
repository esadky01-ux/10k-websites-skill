'use strict';
// ============================================================
// EUROPA TAXI — HTML yardimcilari ve yanit gondericiler.
// miniSayfa: PHP ortak.php mini_sayfa() ile ayni marka gorunumu, noindex.
// ============================================================

/** HTML kacis kisayolu (PHP htmlspecialchars ENT_QUOTES ile ayni). */
function h(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// HTML yanitlarinda betik calistirilmaz; yalniz satir ici stil. Ek savunma katmani.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

/**
 * Marka gorunumlu kucuk sayfa. yenile: saniye; yenileUrl: yenilenecek adres (bos ise ayni sayfa).
 * Doner: HTML metni.
 */
function miniSayfa(dil, baslik, icerikHtml, yenile, yenileUrl) {
  let yenileEtiketi = '';
  if (yenile && yenile > 0) {
    yenileEtiketi = '<meta http-equiv="refresh" content="' + h(String(yenile) + (yenileUrl ? ';url=' + yenileUrl : '')) + '">';
  }
  return '<!doctype html>\n' +
'<html lang="' + h(dil) + '">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<meta name="robots" content="noindex,nofollow">\n' +
'<meta name="color-scheme" content="dark">\n' +
'<title>' + h(baslik) + ' · Europa Taxi</title>\n' +
'<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">\n' +
yenileEtiketi + '\n' +
'<style>\n' +
'body{background:#0A0A0C;color:#F4F4F6;font:400 16px/1.6 "Archivo",system-ui,sans-serif;\n' +
'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}\n' +
'.kart{max-width:520px;width:100%;background:#121215;border:1px solid rgba(255,255,255,.09);\n' +
'border-radius:18px;padding:34px;position:relative}\n' +
'.kart::before{content:"";position:absolute;top:0;left:24px;right:24px;height:2px;\n' +
'background:linear-gradient(90deg,transparent,#FFC107,transparent)}\n' +
'.marka{font-weight:900;font-size:18px;letter-spacing:.5px;margin-bottom:22px}\n' +
'.marka b{color:#fff}.marka span{color:#FFC107}\n' +
'h1{font-size:23px;font-weight:900;margin:0 0 12px;color:#FFC107}\n' +
'p{color:#A8AAB3;margin:0 0 12px}\n' +
'.ref{font-size:13px;color:#6E7080;margin-top:16px}\n' +
'.btnler{display:grid;gap:10px;margin-top:24px}\n' +
'.btn{display:block;text-align:center;padding:13px 22px;border-radius:12px;font-weight:800;\n' +
'text-decoration:none;color:#141005;background:linear-gradient(180deg,#FFC107,#E5A93C)}\n' +
'.btn--dis{background:none;border:1px solid rgba(255,255,255,.22);color:#F4F4F6}\n' +
'.btn--wa{background:#25D366;color:#06250f}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="kart">\n' +
'  <div class="marka"><b>EUROPA</b><span>TAXI</span></div>\n' +
'  <h1>' + h(baslik) + '</h1>\n' +
'  ' + icerikHtml + '\n' +
'</div>\n' +
'</body>\n' +
'</html>';
}

// ---------------------------------------------------------------- yanit gondericiler

function yanit(res, kod, tip, govde, ekBasliklar) {
  if (res.headersSent || res.writableEnded) return;
  const buf = Buffer.from(govde, 'utf8');
  res.statusCode = kod;
  res.setHeader('Content-Type', tip);
  res.setHeader('Content-Length', String(buf.length));
  if (ekBasliklar) {
    for (const k of Object.keys(ekBasliklar)) res.setHeader(k, ekBasliklar[k]);
  }
  res.end(buf);
}

function yanitHtml(res, kod, html, ekBasliklar) {
  yanit(res, kod, 'text/html; charset=utf-8', html, Object.assign({
    'Content-Security-Policy': CSP,
    'X-Frame-Options': 'DENY',
  }, ekBasliklar || {}));
}

function yanitMetin(res, kod, metin, ekBasliklar) {
  yanit(res, kod, 'text/plain; charset=utf-8', metin, ekBasliklar);
}

function yanitYonlendir(res, kod, adres, ekBasliklar) {
  yanit(res, kod, 'text/plain; charset=utf-8', 'Redirect: ' + adres + '\n', Object.assign({ Location: adres }, ekBasliklar || {}));
}

module.exports = { h, miniSayfa, yanit, yanitHtml, yanitMetin, yanitYonlendir, CSP };
