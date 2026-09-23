# Fotoğraflar

Bu klasördeki dosyalar sitede otomatik olarak görünür; yoksa ilgili bölüm
çizim ya da sade yüzey tasarımına düşer. Beklenen adlar ve ölçüler
`src/lib/media.ts` dosyasının başındaki listede yazılıdır.

Dosya eklemek için:

1. Görseli aşağıdaki adla bu klasöre koyun (jpg ya da webp; ad aynı kalmalı).
2. `npm run build` çalıştırın; varlık kontrolü derleme anında yapılır.

| Dosya | Ölçü | Nerede görünür |
| --- | --- | --- |
| `hero.webp` | 1600x900 | Ana sayfa hero, başlığın altında |
| `aile-van.webp` | 1600x900 | Hizmetler sayfası, "Her transfere dahil" |
| `karsilama.webp` | 1600x900 | Havalimanı transferleri, karşılama bölümü |
| `arac-sedan.webp` | 1200x675 | Filo kartı ve rezervasyon araç seçimi |
| `arac-van.webp` | 1200x675 | Aynı |
| `arac-business.webp` | 1200x675 | Aynı |
| `ulke-BE.webp` | 800x600 | Ülkeler bölümü, Belçika kartı |
| `ulke-NL.webp` | 800x600 | Hollanda |
| `ulke-FR.webp` | 800x600 | Fransa |
| `ulke-DE.webp` | 800x600 | Almanya |

Araç fotoğraflarında üretici amblemi görünmemelidir.
