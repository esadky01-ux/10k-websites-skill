#!/usr/bin/env node
'use strict';
// ============================================================
// EUROPA TAXI — YEREL CALISTIRICI (YALNIZ TEST/GELISTIRME; Vercel'e YUKLENMEZ).
// vercel_build.py ciktisindaki (veya --dir ile verilen) api/*.js dosyalarini require edip
// vercel.json'daki rewrite haritasiyla ayni yollarda sunar:
//   /pay/create.php -> api/create   /pay/webhook.php -> api/webhook   /pay/success.php -> api/success
//   /pay/orders.php -> api/orders   /pay/test.php    -> api/test      (+ dogrudan /api/<ad>)
// Yalniz Node'un yerlesik http modulu; Vercel ile ayni (req, res) arayuzu.
//
// Kullanim: node kaynak/vercel/dev-server.js --dir vercel-out --port 9501 [--host 127.0.0.1]
// Yapilandirma yine yalniz ortam degiskenlerinden (MOLLIE_API_KEY, SITE_URL, ...).
// ============================================================

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

function arguman(ad, varsayilan) {
  const i = process.argv.indexOf('--' + ad);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : varsayilan;
}

const DIZIN = path.resolve(arguman('dir', path.join(__dirname, '..', '..', 'vercel-out')));
const PORT = Number(arguman('port', process.env.PORT || '9501'));
const HOST = arguman('host', '127.0.0.1');

const REWRITE = {
  '/pay/create.php': 'create',
  '/pay/webhook.php': 'webhook',
  '/pay/success.php': 'success',
  '/pay/orders.php': 'orders',
  '/pay/test.php': 'test',
  '/api/create': 'create',
  '/api/webhook': 'webhook',
  '/api/success': 'success',
  '/api/orders': 'orders',
  '/api/test': 'test',
};

if (!fs.existsSync(path.join(DIZIN, 'api', 'create.js'))) {
  console.error('dev-server: ' + DIZIN + '/api/create.js yok. Once: python3 kaynak/build.py && python3 kaynak/vercel_build.py');
  process.exit(2);
}

const HANDLERS = {};
for (const ad of new Set(Object.values(REWRITE))) {
  HANDLERS[ad] = require(path.join(DIZIN, 'api', ad + '.js'));
}

// Yalniz test: sarmalayicinin (genel 500) davranisini dogrulamak icin bilerek istisna firlatir.
const { sarmala } = require(path.join(DIZIN, 'api', '_lib', 'guvenlik.js'));
HANDLERS.__crash = sarmala('crash', async () => {
  const e = new Error('GIZLI-IC-AYRINTI-yigin-sizmamali');
  e.code = 'ETEST';
  throw e;
});
REWRITE['/__crash'] = '__crash';

const sunucu = http.createServer((req, res) => {
  let yol = '/';
  try { yol = new URL(req.url, 'http://x').pathname; } catch (_) { /* asagida 404 */ }
  const ad = REWRITE[yol];
  if (!ad) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.end('yok');
    return;
  }
  Promise.resolve(HANDLERS[ad](req, res)).catch(() => {
    // sarmala zaten yakalar; buraya dusmesi olmamali
    if (!res.headersSent) { res.statusCode = 500; res.end('hata'); } else { res.end(); }
  });
});

sunucu.on('clientError', (err, soket) => {
  if (soket.writable) soket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  else soket.destroy();
});

sunucu.listen(PORT, HOST, () => {
  console.log('dev-server hazir http://' + HOST + ':' + PORT + ' dir=' + DIZIN);
});
