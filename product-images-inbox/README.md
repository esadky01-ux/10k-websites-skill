# Ürün görseli gelen kutusu

Ürün fotoğraflarını bu klasöre atıp `npm run images` çalıştırın.

- Dosya adı = **SKU** (Odoo dahili referans) veya **ürün id** (`src/data/products.ts`) veya katalog adı, örn. `NAWRAS NOHUT 900G 10X1_10ST.jpg`
- Eşleşme kurmak istemiyorsanız `map.csv` ekleyin: her satır `dosyaadı,ürün-id`
- Çıktı: `public/media/products/<id>.webp` (800×800, beyaz zemin) ve güncellenmiş `src/data/product-images.ts`

Bu klasördeki görseller depoya girmez; yalnızca işlenmiş WebP dosyaları commit edilir.
