# Görsel kaynakları

- `logo_uret.py`: logo (`assets/logo.svg`), favicon ve sayfaya gömülen sembol (`logo-ic.svg`). Yazı Archivo (wght 800) hatlarından
  yola çevrilir; yazı tipi olmadan da aynı görünür. Gerekli: `fonttools` + `brotli`.
- Fotoğraflar (`assets/hero-*.webp`, `assets/foto/*.webp`): Higgsfield ile üretilip WebP'ye çevrildi. Aynı adlarla `kaynak/assets/` içine
  koyup `python3 kaynak/build.py` yeterli; okunurluk için `.hero-sahne::after` karartması CSS'tedir.
- `sahne-og.html`: `assets/og.jpg` (1200x630).
- PNG ikonlar (`assets/icons/`): favicon.svg'den Playwright ile üretilir (192, 512, 512 maskable, 180 apple-touch).
- OG görseli: `sahne-og.html` Playwright ile ekran görüntüsü alınarak yeniden üretilir.
