# Görsel kaynakları

`sahne-hero.html` ve `sahne-og.html`, `assets/` içindeki yer tutucu görsellerin
(hero-masa.jpg, hero-mobil.jpg, og.jpg) kaynağıdır. Gerçek fotoğraf (gece Brüksel +
siyah Tesla) geldiğinde aynı dosya adlarıyla `kaynak/assets/` içine koyup
`python3 kaynak/build.py` çalıştırmak yeterlidir.

Yeniden üretmek için (Chromium + Playwright gerekli):

    npx playwright screenshot --viewport-size=1600,900  sahne-hero.html        hero-masa.jpg
    npx playwright screenshot --viewport-size=828,1104  "sahne-hero.html#mobil" hero-mobil.jpg
    npx playwright screenshot --viewport-size=1200,630  sahne-og.html          og.jpg
