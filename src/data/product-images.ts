/**
 * Ürün görselleri: ürün id → public altındaki dosya yolu.
 * Bu dosya `npm run images` ile public/media/products klasöründen otomatik üretilir; elle düzenlemeyin.
 * Görsel eklemek için product-images-inbox/ klasörüne SKU veya ürün id'siyle adlandırılmış dosyaları koyup scripti çalıştırın.
 */
export const productImages: Record<string, string> = {

};

export function productImage(id: string): string | undefined {
  return productImages[id];
}
