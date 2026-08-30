// Classify pixels into navy / gold / grey / cream clusters and report means.
const sharp = require('sharp');
(async () => {
  const raw = await sharp('assets/img/logo/gir-decor-logo.jpg').raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const acc = { navy: [0,0,0,0], gold: [0,0,0,0], grey: [0,0,0,0], cream: [0,0,0,0] };
  const add = (k, r, g, b) => { acc[k][0]+=r; acc[k][1]+=g; acc[k][2]+=b; acc[k][3]++; };
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    if (b > r + 15 && lum < 110) add('navy', r, g, b);
    else if (r > 140 && r < 230 && g > 100 && g < 190 && b < 120 && r > b + 60) add('gold', r, g, b);
    else if (Math.abs(r-g) < 12 && Math.abs(g-b) < 12 && lum > 100 && lum < 180) add('grey', r, g, b);
    else if (lum > 225 && r >= g && g >= b - 5) add('cream', r, g, b);
  }
  const hex = a => '#' + a.slice(0,3).map(v => Math.round(v / a[3]).toString(16).padStart(2,'0')).join('');
  for (const k of Object.keys(acc)) {
    const pct = (acc[k][3] / (data.length/3) * 100).toFixed(1);
    console.log(k, acc[k][3] ? hex(acc[k]) : 'n/a', pct + '%');
  }
})();
