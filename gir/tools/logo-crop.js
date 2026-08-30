const sharp = require('sharp');
(async () => {
  // two-stage: extract -> buffer -> trim
  const cropJ = await sharp('assets/img/logo/gir-decor-logo.jpg')
    .extract({ left: 60, top: 405, width: 648, height: 430 }).toBuffer();
  await sharp(cropJ).trim({ threshold: 25 }).jpeg({ quality: 90 }).toFile('assets/img/logo/gir-decor-logo-header.jpg');
  const cropP = await sharp('assets/img/logo/gir-decor-logo.png')
    .extract({ left: 60, top: 405, width: 648, height: 430 }).toBuffer();
  await sharp(cropP).trim({ threshold: 25 }).png().toFile('assets/img/logo/gir-decor-logo-header.png');
  for (const f of ['gir-decor-logo-header.jpg', 'gir-decor-logo-header.png', 'gir-decor-logo.png']) {
    const m = await sharp('assets/img/logo/' + f).metadata();
    console.log(f, m.width + 'x' + m.height);
  }
})();
