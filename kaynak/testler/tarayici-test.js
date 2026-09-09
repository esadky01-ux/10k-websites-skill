/* Adim 2 tarayici oz-testi: konsol, fiyat motoru, dogrulama, mobil */
const { chromium } = require('playwright');

const TABAN = 'http://127.0.0.1:8123';
const hatalar = [];
function kontrol(kosul, mesaj){ if (!kosul) hatalar.push(mesaj); }

(async () => {
  const b = await chromium.launch();

  /* ---------- masaustu ---------- */
  const sayfa = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const konsolHatalari = [];
  const disKopmalar = [];  // sandbox proxy'sinin kestigi harici istekler (fonts vb.)
  sayfa.on('requestfailed', r => {
    const u = r.url();
    if (u.includes('fonts.g') || u.includes('wa.me')) disKopmalar.push(u);
    else konsolHatalari.push('requestfailed: ' + u);
  });
  sayfa.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_RESET')) konsolHatalari.push(m.text());
  });
  sayfa.on('pageerror', e => konsolHatalari.push('pageerror: ' + e.message));

  await sayfa.goto(TABAN + '/fr/', { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(600);

  // 1. Konsolda hata olmamali (uyari serbest)
  kontrol(konsolHatalari.length === 0, 'FR konsol hatalari: ' + JSON.stringify(konsolHatalari));

  // 2. Anahtar bos -> dahili mod, datalist acik
  const listAttr = await sayfa.getAttribute('#f-alis', 'list');
  kontrol(listAttr === 'yer-listesi', 'Dahili modda datalist acilmali, bulunan: ' + listAttr);

  // 3. Bruxelles -> Zaventem : 13 km, 35,87 EUR
  await sayfa.fill('#f-alis', 'Bruxelles');
  await sayfa.fill('#f-varis', 'Zaventem');
  await sayfa.waitForTimeout(600);
  let fiyat = await sayfa.textContent('#p-fiyat');
  let mesafe = await sayfa.textContent('#p-mesafe');
  kontrol(mesafe.trim() === '13 km', 'Bruxelles->Zaventem 13 km bekleniyordu: ' + mesafe);
  kontrol(fiyat.includes('35,87'), 'Bruxelles->Zaventem 35,87 EUR bekleniyordu: ' + fiyat);

  // 4. Taninmayan adres -> fiyat YOK + uyari
  await sayfa.fill('#f-varis', 'qwertyasdf sokagi 12');
  await sayfa.waitForTimeout(600);
  fiyat = await sayfa.textContent('#p-fiyat');
  const durumSinif = await sayfa.getAttribute('#p-durum', 'class');
  kontrol(fiyat.trim() === '—', 'Taninmayan adreste fiyat kalmamali: ' + fiyat);
  kontrol(durumSinif.includes('hata'), 'Taninmayan adreste uyari gorunmeli');

  // 5. Chip: Gand -> Aeroport (kesin 56 km, 121,44 EUR)
  await sayfa.click('.chip[data-alis="gent"][data-varis="bru"]');
  await sayfa.waitForTimeout(600);
  fiyat = await sayfa.textContent('#p-fiyat');
  const kapora = await sayfa.textContent('#p-kapora');
  kontrol(fiyat.includes('121,44'), 'Gent->BRU 121,44 EUR bekleniyordu: ' + fiyat);
  kontrol(kapora.includes('24,29'), 'Gent->BRU kapora 24,29 EUR bekleniyordu: ' + kapora);

  // 6. Bos form onayi -> engellenmeli (tarih yok)
  await sayfa.click('#btn-onayla');
  await sayfa.waitForTimeout(200);
  let hataGorunur = await sayfa.isVisible('#hata-kutu');
  kontrol(hataGorunur, 'Tarih bosken onay engellenmeli');

  // 7. Tarih + saat + iptal onayi -> odeme secimi acilmali
  const yarin = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await sayfa.fill('#f-tarih', yarin);
  await sayfa.fill('#f-saat', '14:30');
  await sayfa.check('#f-iptal');
  await sayfa.click('#btn-onayla');
  await sayfa.waitForTimeout(300);
  kontrol(await sayfa.isVisible('#odeme-final .btnler'), 'Onaydan sonra odeme secimi acilmali');

  // 8. Online ode iletisimsiz -> engellenmeli
  await sayfa.click('#btn-online');
  await sayfa.waitForTimeout(200);
  kontrol(await sayfa.isVisible('#hata-kutu'), 'Iletisimsiz online odeme engellenmeli');

  // 9. WhatsApp mesaji: iletisimsiz de calismali, bos satir olmamali
  await sayfa.evaluate(() => {
    window.__waUrl = null;
    window.open = (u) => { window.__waUrl = u; return null; };
  });
  await sayfa.click('#btn-wa');
  await sayfa.waitForTimeout(200);
  const waUrl = await sayfa.evaluate(() => window.__waUrl);
  kontrol(!!waUrl, 'WhatsApp baglantisi kurulmali');
  if (waUrl) {
    kontrol(waUrl.startsWith('https://wa.me/32493839898'), 'WA linki dogru numaraya gitmeli: ' + waUrl);
    const metin = decodeURIComponent(waUrl.split('text=')[1] || '');
    const satirlar = metin.split('\n');
    kontrol(!satirlar.some((s, i) => s.trim() === '' && i > 1), 'WA mesajinda bos satir olmamali:\n' + metin);
    kontrol(metin.includes('121,44'), 'WA mesajinda fiyat olmali');
    kontrol(metin.includes('Gand') && metin.includes('Brussels Airport'), 'WA mesajinda rota olmali');
  }

  // 10. Sayac sinirlari: yolcu 7'de + pasif (6 tik: 1 -> 7; sinirda buton zaten tiklanamaz)
  for (let i = 0; i < 6; i++) await sayfa.click('[data-sayac="yolcu"][data-yon="1"]');
  await sayfa.waitForTimeout(150);
  const deger = await sayfa.textContent('#s-yolcu');
  kontrol(deger.trim() === '7', 'Yolcu sayaci 7 ile sinirli olmali: ' + deger);
  const artiKapali = await sayfa.getAttribute('[data-sayac="yolcu"][data-yon="1"]', 'class');
  kontrol(artiKapali.includes('kapali'), 'Sinirda + butonu pasif gorunmeli');

  // 11. Havalimani modu: panel degisir, WhatsApp butonu cikar
  await sayfa.click('#mod-hava');
  await sayfa.waitForTimeout(200);
  kontrol(await sayfa.isHidden('#fiyat-panel'), 'Hava modunda fiyat paneli kapanmali');
  kontrol(await sayfa.isVisible('#btn-hava-wa'), 'Hava modunda WA fiyat sorma butonu gorunmeli');
  kontrol(await sayfa.isHidden('#btn-onayla'), 'Hava modunda onay butonu gizlenmeli');
  await sayfa.click('#mod-km');

  // 12. Swap
  await sayfa.click('#btn-swap');
  const yeniAlis = await sayfa.inputValue('#f-alis');
  kontrol(yeniAlis.includes('Brussels Airport'), 'Swap alis/varisi degistirmeli: ' + yeniAlis);

  await sayfa.screenshot({ path: 'ekran-masa.jpg', fullPage: true, quality: 70, type: 'jpeg' });

  // 13. Diger 3 dil: konsol temiz + fiyat calisiyor
  for (const dil of ['nl', 'en', 'tr']) {
    const s2 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const kh = [];
    s2.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_RESET')) kh.push(m.text()); });
    s2.on('pageerror', e => kh.push('pageerror: ' + e.message));
    await s2.goto(TABAN + '/' + dil + '/', { waitUntil: 'networkidle' });
    await s2.fill('#f-alis', 'Brussel');
    await s2.fill('#f-varis', 'Antwerpen');
    await s2.waitForTimeout(600);
    const f2 = await s2.textContent('#p-fiyat');
    kontrol(f2.includes('99') && f2.includes('55'), '[' + dil + '] Brussel->Antwerpen 99,55 bekleniyordu: ' + f2);
    kontrol(kh.length === 0, '[' + dil + '] konsol hatalari: ' + JSON.stringify(kh));
    await s2.close();
  }

  /* ---------- mobil 360px ---------- */
  const mobil = await b.newPage({ viewport: { width: 360, height: 780 } });
  const mkh = [];
  mobil.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_RESET')) mkh.push(m.text()); });
  mobil.on('pageerror', e => mkh.push('pageerror: ' + e.message));
  await mobil.goto(TABAN + '/nl/', { waitUntil: 'networkidle' });
  await mobil.waitForTimeout(500);
  kontrol(mkh.length === 0, 'Mobil konsol hatalari: ' + JSON.stringify(mkh));
  // yatay tasma yok
  const tasma = await mobil.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  kontrol(tasma <= 0, 'Mobilde yatay tasma var: ' + tasma + 'px');
  // FAB butonlari footer linklerini kapatmasin: alt bosluk >= 92px (sartname §10)
  const altBosluk = await mobil.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('footer.alt')).paddingBottom));
  kontrol(altBosluk >= 92, 'Footer alt boslugu >= 92px olmali: ' + altBosluk);
  await mobil.screenshot({ path: 'ekran-mobil.jpg', fullPage: true, quality: 70, type: 'jpeg' });

  // 390px de kontrol (sartname §14-F)
  await mobil.setViewportSize({ width: 390, height: 844 });
  await mobil.waitForTimeout(300);
  const tasma390 = await mobil.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  kontrol(tasma390 <= 0, '390px yatay tasma: ' + tasma390 + 'px');

  // 320px (en dar gercek cihazlar) da tasmasin
  await mobil.setViewportSize({ width: 320, height: 700 });
  await mobil.waitForTimeout(300);
  const tasma320 = await mobil.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  kontrol(tasma320 <= 0, '320px yatay tasma: ' + tasma320 + 'px');

  /* ---------- D. Google dayanikliligi: gm_authFailure simulasyonu ---------- */
  const g1 = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const g1h = [];
  g1.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_RESET')) g1h.push(m.text()); });
  g1.on('pageerror', e => g1h.push('pageerror: ' + e.message));
  await g1.goto(TABAN + '/fr/', { waitUntil: 'load' });
  await g1.waitForTimeout(400);
  // Google'in sayfaya enjekte ettigi hata katmanini taklit et, sonra auth hatasi tetikle
  await g1.evaluate(() => {
    for (const sinif of ['gm-err-container', 'pac-container', 'gm-style-moc']) {
      const el = document.createElement('div');
      el.className = sinif;
      el.textContent = 'Oops! Something went wrong.';
      document.body.appendChild(el);
    }
    window.gm_authFailure();
  });
  await g1.waitForTimeout(300);
  const kalinti = await g1.evaluate(() =>
    document.querySelectorAll('.gm-err-container,.pac-container,.gm-style-moc').length);
  kontrol(kalinti === 0, 'gm_authFailure sonrasi Google DOM kalintisi temizlenmeli, kalan: ' + kalinti);
  const oops = await g1.evaluate(() => document.body.textContent.includes('Oops!'));
  kontrol(!oops, '"Oops!" kutusu gorunmemeli');
  kontrol((await g1.getAttribute('#f-alis', 'list')) === 'yer-listesi',
    'authFailure sonrasi dahili liste (datalist) geri acilmali');
  await g1.fill('#f-alis', 'Bruxelles');
  await g1.fill('#f-varis', 'Anvers');
  await g1.waitForTimeout(600);
  kontrol((await g1.textContent('#p-fiyat')).includes('99,55'),
    'authFailure sonrasi fiyat yine hesaplanmali (99,55 EUR)');
  // kalan sayac sinirlari: buyuk 6, kucuk 4 (sartname §14-C)
  for (let i = 0; i < 6; i++) await g1.click('[data-sayac="buyuk"][data-yon="1"]');
  for (let i = 0; i < 4; i++) await g1.click('[data-sayac="kucuk"][data-yon="1"]');
  await g1.waitForTimeout(150);
  kontrol((await g1.textContent('#s-buyuk')).trim() === '6', 'Buyuk valiz 6 ile sinirli olmali');
  kontrol((await g1.textContent('#s-kucuk')).trim() === '4', 'Kucuk valiz 4 ile sinirli olmali');
  kontrol((await g1.getAttribute('[data-sayac="buyuk"][data-yon="1"]', 'class')).includes('kapali'),
    'Buyuk valiz sinirinda + pasif olmali');
  kontrol((await g1.getAttribute('[data-sayac="kucuk"][data-yon="1"]', 'class')).includes('kapali'),
    'Kucuk valiz sinirinda + pasif olmali');
  kontrol(g1h.length === 0, 'authFailure simulasyonunda konsol hatasi: ' + JSON.stringify(g1h));
  await g1.close();

  /* ---------- D. Google dayanikliligi: GECERSIZ anahtar + betik yukleme hatasi ---------- */
  const g2 = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const g2h = [];
  g2.on('console', m => {
    const metin = m.text();
    if (m.type() === 'error' && !metin.includes('ERR_CONNECTION_RESET') && !metin.includes('ERR_FAILED')) g2h.push(metin);
  });
  g2.on('pageerror', e => g2h.push('pageerror: ' + e.message));
  // config.js'e sahte anahtar koy; Google betigini agda engelle -> site yine calismali
  await g2.route('**/assets/config.js', r => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.EUROPA_CONFIG={googleMapsKey:"GECERSIZ_ANAHTAR_TESTI"};',
  }));
  await g2.route('**maps.googleapis.com**', r => r.abort());
  await g2.goto(TABAN + '/nl/', { waitUntil: 'load' });
  await g2.waitForTimeout(800);
  kontrol((await g2.getAttribute('#f-alis', 'list')) === 'yer-listesi',
    'Gecersiz anahtar + betik hatasi: dahili moda dusulmeli');
  await g2.fill('#f-alis', 'Gent');
  await g2.fill('#f-varis', 'Zaventem');
  await g2.waitForTimeout(600);
  kontrol((await g2.textContent('#p-fiyat')).includes('121,44'),
    'Gecersiz anahtarla site TAM islevsel kalmali (121,44 EUR)');
  const tasmaG2 = await g2.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  kontrol(tasmaG2 <= 0, 'Gecersiz anahtar durumunda form bozulmamali (yatay tasma yok)');
  kontrol(g2h.length === 0, 'Gecersiz anahtar testinde konsol hatasi: ' + JSON.stringify(g2h));
  await g2.close();

  await b.close();

  console.log('');
  if (hatalar.length) {
    console.log('✗ ' + hatalar.length + ' HATA:');
    hatalar.forEach(h => console.log('   - ' + h));
    process.exit(1);
  }
  console.log('✓ Tarayici testleri gecti');
})();
