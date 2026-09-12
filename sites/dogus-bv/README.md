# Dogus BV website

Tek sayfalık kurumsal site. Ana dil Belçika Felemenkçesi (HTML'de), Türkçe ve İngilizce çeviriler
`index.html` içindeki `I18N` sözlüğünde; header'daki NL / TR / EN seçici ile geçiş, `?lang=tr` ve `?lang=en`
ile paylaşılabilir bağlantı. Framework yok, build yok.

- `index.html` + `images/` → hostinge yüklenecek dosyalar (`dogus-bv-website.zip` aynısını içerir)
- `dogus-bv-preview.html` → tüm görseller gömülü tek dosyalık önizleme
- `tools/build.py` → `index.html` ve `images/` değişince önizlemeyi ve zip'i yeniden üretir
- `tools/fetch_images.py` → Higgsfield ile üretilen kaynak görselleri indirip WebP'ye çevirir
  (GitHub Actions ile çalışır, `.github/workflows/fetch-images.yml`)

Yer tutucular (telefon, e-posta, BTW, domain, openingsuren) ve Formspree'ye geçiş notu
`index.html` dosyasının en üstündeki yorum bloğunda listelenmiştir.
