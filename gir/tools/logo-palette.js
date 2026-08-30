// Samples brand colors from the logo at known regions + global histogram.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const LOGO = path.join(__dirname, '..', 'assets/img/logo/gir-decor-logo.jpg');

function hex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

async function avgRegion(img, meta, x, y, w, h) {
  const buf = await img.clone().extract({ left: x, top: y, width: w, height: h }).raw().toBuffer();
  let r = 0, g = 0, b = 0, n = buf.length / 3;
  for (let i = 0; i < buf.length; i += 3) { r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; }
  return [r / n, g / n, b / n];
}

(async () => {
  const img = sharp(LOGO);
  const meta = await img.metadata(); // 768x1152
  const regions = {
    background_topleft:  [20, 20, 60, 60],
    background_bottom:   [20, 1100, 60, 40],
    navy_letter_G:       [200, 480, 30, 60],
    navy_letter_R_stem:  [455, 470, 20, 80],
    navy_wordmark:       [140, 745, 40, 20],
    gold_letter_I:       [372, 470, 22, 80],
    gold_house_frame:    [300, 92, 60, 8],
    grey_window_pane:    [438, 290, 30, 40],
  };
  const out = {};
  for (const [k, [x, y, w, h]] of Object.entries(regions)) {
    out[k] = hex(await avgRegion(img, meta, x, y, w, h));
  }
  // Global dominant colors: quantize to 32-step buckets
  const raw = await img.clone().resize(128, 192).raw().toBuffer();
  const buckets = new Map();
  for (let i = 0; i < raw.length; i += 3) {
    const key = [raw[i], raw[i + 1], raw[i + 2]].map(v => Math.round(v / 24) * 24).join(',');
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  out.dominant = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => ({ color: hex(k.split(',').map(Number)), share: +(n / (raw.length / 3) * 100).toFixed(1) + '%' }));
  fs.writeFileSync(path.join(__dirname, '..', 'analysis/logo-palette.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})();
