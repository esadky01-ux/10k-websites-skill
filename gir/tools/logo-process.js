// 1) Mode colors for navy/gold clusters  2) transparent PNG  3) trimmed header crop PNG
const sharp = require('sharp');
(async () => {
  const { data, info } = await sharp('assets/img/logo/gir-decor-logo.jpg').raw().toBuffer({ resolveWithObject: true });
  const count = { navy: new Map(), gold: new Map() };
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    let k = null;
    if (b > r + 15 && lum < 90) k = 'navy';
    else if (r > 150 && r < 220 && g > 110 && g < 180 && b < 100 && r > b + 80) k = 'gold';
    if (k) { const key = `${r},${g},${b}`; count[k].set(key, (count[k].get(key) || 0) + 1); }
  }
  for (const k of Object.keys(count)) {
    const top = [...count[k].entries()].sort((a,b) => b[1]-a[1]).slice(0, 3);
    console.log(k, 'mode:', top.map(([c,n]) => '#' + c.split(',').map(v => (+v).toString(16).padStart(2,'0')).join('') + ` (${n})`).join('  '));
  }

  // Transparent PNG: distance from cream bg -> alpha (soft threshold), keeps anti-aliasing
  const BG = [248, 244, 235];
  const rgba = Buffer.alloc((data.length / 3) * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const dr = data[i]-BG[0], dg = data[i+1]-BG[1], db = data[i+2]-BG[2];
    const dist = Math.sqrt(dr*dr + dg*dg + db*db);
    const a = dist <= 10 ? 0 : dist >= 60 ? 255 : Math.round((dist - 10) / 50 * 255);
    rgba[j] = data[i]; rgba[j+1] = data[i+1]; rgba[j+2] = data[i+2]; rgba[j+3] = a;
  }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toFile('assets/img/logo/gir-decor-logo.png');

  // Header lockup: crop the GIR letters + "GIR DÉCORATION" + tagline block (y ≈ 400–840), then trim
  await sharp('assets/img/logo/gir-decor-logo.jpg')
    .extract({ left: 60, top: 405, width: 648, height: 430 })
    .trim({ threshold: 25 })
    .jpeg({ quality: 90 })
    .toFile('assets/img/logo/gir-decor-logo-header.jpg');
  // and a transparent version of the same crop from the RGBA buffer
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: 60, top: 405, width: 648, height: 430 })
    .trim({ threshold: 25 })
    .png().toFile('assets/img/logo/gir-decor-logo-header.png');
  const m1 = await sharp('assets/img/logo/gir-decor-logo-header.png').metadata();
  console.log('header png:', m1.width + 'x' + m1.height);
})();
