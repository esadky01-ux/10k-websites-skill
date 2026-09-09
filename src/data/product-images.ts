/**
 * Ürün görselleri: ürün id → public altındaki dosya yolu.
 * Bu dosya `npm run images` ile public/media/products klasöründen otomatik üretilir; elle düzenlemeyin.
 * Görsel eklemek için product-images-inbox/ klasörüne SKU veya ürün id'siyle adlandırılmış dosyaları koyup scripti çalıştırın.
 */
export const productImages: Record<string, string> = {
  "fd-vgl-006": "/media/products/fd-vgl-006.webp",
  "hane-barbunya": "/media/products/hane-barbunya.webp",
  "hane-ha-lanm-meksika-fasulyesi-cam": "/media/products/hane-ha-lanm-meksika-fasulyesi-cam.webp",
  "hane-ha-lanm-nohut": "/media/products/hane-ha-lanm-nohut.webp",
  "hane-ha-lanm-nohut-cam": "/media/products/hane-ha-lanm-nohut-cam.webp",
  "hane-k-ftelik-bulgur": "/media/products/hane-k-ftelik-bulgur.webp",
  "hane-k-rm-z-mercimek": "/media/products/hane-k-rm-z-mercimek.webp",
  "hane-kuru-fasulye": "/media/products/hane-kuru-fasulye.webp",
  "hane-m-s-r": "/media/products/hane-m-s-r.webp",
  "hane-nohut": "/media/products/hane-nohut.webp",
  "hane-pilavl-k-bulgur": "/media/products/hane-pilavl-k-bulgur.webp",
  "hane-ye-il-mercimek": "/media/products/hane-ye-il-mercimek.webp",
  "nawras-bakla": "/media/products/nawras-bakla.webp",
  "nawras-basmati-pirin": "/media/products/nawras-basmati-pirin.webp",
  "nawras-k-rm-z-mercimek": "/media/products/nawras-k-rm-z-mercimek.webp",
  "nawras-ma-fasulyesi": "/media/products/nawras-ma-fasulyesi.webp",
  "nawras-nohut": "/media/products/nawras-nohut.webp",
  "nawras-pirin": "/media/products/nawras-pirin.webp",
  "nawras-pirin-2": "/media/products/nawras-pirin-2.webp",
  "nf-dzn-016": "/media/products/nf-dzn-016.webp",
  "nf-dzn-028": "/media/products/nf-dzn-028.webp",
};

export function productImage(id: string): string | undefined {
  return productImages[id];
}
