/* WebP varyantları (400/800/1600) + 96px swatch üretimi */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const SIZES = [400, 800, 1600];

(async () => {
  const made = [];
  for (const p of data.products) {
    const dir = path.join(ROOT, 'assets/img/products', p.slug);

    // 1) galeri + kart görselleri için webp varyantları
    for (const rel of p.images) {
      const src = path.join(ROOT, rel);
      const base = path.basename(rel).replace(/\.(jpg|png)$/i, '');
      for (const w of SIZES) {
        const out = path.join(dir, `${base}-${w}.webp`);
        if (fs.existsSync(out)) continue;
        await sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
        made.push(path.relative(ROOT, out));
      }
    }

    // 2) swatch: texture varsa ortadan kare kırp; ivory için product görselinden doku kırpımı
    const swatchOut = path.join(dir, `${p.slug}-swatch.png`);
    if (!fs.existsSync(swatchOut)) {
      const texture = path.join(dir, `${p.slug}-texture.png`);
      if (fs.existsSync(texture)) {
        const m = await sharp(texture).metadata();
        const s = Math.min(m.width, m.height);
        const buf = await sharp(texture)
          .extract({ left: Math.floor((m.width - s) / 2), top: Math.floor((m.height - s) / 2), width: s, height: s })
          .toBuffer();
        await sharp(buf).resize(96, 96).png().toFile(swatchOut);
      } else {
        // ivory: ürün görselinin panel yüzeyinden (orta bölge) kırp
        const src = path.join(dir, `${p.slug}-product.jpg`);
        const m = await sharp(src).metadata();
        const s = Math.floor(Math.min(m.width, m.height) * 0.28);
        const buf = await sharp(src)
          .extract({ left: Math.floor(m.width * 0.36), top: Math.floor(m.height * 0.30), width: s, height: s })
          .toBuffer();
        await sharp(buf).resize(96, 96).png().toFile(swatchOut);
      }
      made.push(path.relative(ROOT, swatchOut));
    }
  }

  // 3) hero görseli (linen room) için geniş webp varyantları
  const hero = path.join(ROOT, 'assets/img/products/linen-bp03/linen-bp03-room.jpg');
  for (const w of [800, 1600]) {
    const out = path.join(ROOT, `assets/img/hero-${w}.webp`);
    if (fs.existsSync(out)) continue;
    await sharp(hero).resize({ width: w }).webp({ quality: 80 }).toFile(out);
    made.push(path.relative(ROOT, out));
  }
  console.log('generated:', made.length, 'files');
})();
