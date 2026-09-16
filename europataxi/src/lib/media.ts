import { existsSync } from "node:fs";
import { join } from "node:path";
import type { VehicleId } from "@/types";

/**
 * Fotoğraf yuvaları.
 *
 * Site fotoğrafsız da eksiksiz çalışır: bir dosya yoksa bileşen mevcut çizim
 * ya da sade yüzey tasarımına düşer. Dosyayı `public/media/` altına doğru adla
 * koymak yeterlidir, kod değişikliği gerekmez (varlık derleme anında sunucuda
 * kontrol edilir).
 *
 * Beklenen dosyalar ve önerilen ölçüler:
 *   hero.jpg            1600x900  Şoför ve araç, sıcak ışık
 *   aile-van.jpg        1600x900  Aileyi vana bindiren şoför
 *   karsilama.jpg       1600x900  Havalimanında isim tabelasıyla karşılama
 *   arac-sedan.jpg      1200x675  Stüdyo araç fotoğrafı
 *   arac-van.jpg        1200x675
 *   arac-business.jpg   1200x675
 *   ulke-BE.jpg          800x600  Ülke kartları
 *   ulke-NL.jpg          800x600
 *   ulke-FR.jpg          800x600
 *   ulke-DE.jpg          800x600
 *
 * Marka kuralı: araç fotoğraflarında üretici amblemi görünmemelidir.
 */
export const mediaSlots = {
  hero: "/media/hero.jpg",
  familyVan: "/media/aile-van.jpg",
  meetAndGreet: "/media/karsilama.jpg",
  "vehicle-sedan": "/media/arac-sedan.jpg",
  "vehicle-van": "/media/arac-van.jpg",
  "vehicle-business": "/media/arac-business.jpg",
  "country-BE": "/media/ulke-BE.jpg",
  "country-NL": "/media/ulke-NL.jpg",
  "country-FR": "/media/ulke-FR.jpg",
  "country-DE": "/media/ulke-DE.jpg",
} as const;

export type MediaSlot = keyof typeof mediaSlots;

/** Yuvadaki dosya varsa genel yolunu, yoksa `null` döndürür. Yalnızca sunucuda çağrılır. */
export function mediaSrc(slot: MediaSlot): string | null {
  const publicPath = mediaSlots[slot];
  return existsSync(join(process.cwd(), "public", publicPath)) ? publicPath : null;
}

export function vehiclePhoto(id: VehicleId): string | null {
  return mediaSrc(`vehicle-${id}` as MediaSlot);
}

export function countryPhoto(code: string): string | null {
  return mediaSrc(`country-${code}` as MediaSlot);
}
