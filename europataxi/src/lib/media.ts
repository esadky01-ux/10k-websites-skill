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
 *   hero.webp           1600x900  Şoför ve araç, sıcak ışık
 *   aile-van.webp       1600x900  Aileyi vana bindiren şoför
 *   karsilama.webp      1600x900  Havalimanında isim tabelasıyla karşılama
 *   arac-sedan.webp     1200x675  Stüdyo araç fotoğrafı
 *   arac-van.webp       1200x675
 *   arac-business.webp  1200x675
 *   ulke-BE.webp         800x600  Ülke kartları
 *   ulke-NL.webp         800x600
 *   ulke-FR.webp         800x600
 *   ulke-DE.webp         800x600
 *
 * Marka kuralı: araç fotoğraflarında üretici amblemi görünmemelidir.
 */
export const mediaSlots = {
  hero: "/media/hero.webp",
  familyVan: "/media/aile-van.webp",
  meetAndGreet: "/media/karsilama.webp",
  "vehicle-sedan": "/media/arac-sedan.webp",
  "vehicle-van": "/media/arac-van.webp",
  "vehicle-business": "/media/arac-business.webp",
  "country-BE": "/media/ulke-BE.webp",
  "country-NL": "/media/ulke-NL.webp",
  "country-FR": "/media/ulke-FR.webp",
  "country-DE": "/media/ulke-DE.webp",
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
