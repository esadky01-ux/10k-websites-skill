import type { PopularRoute } from "@/types";

/**
 * Ana sayfadaki "Popüler Rotalar" kartları. Kimlikler `src/data/locations.ts`
 * içindeki konumlara işaret eder; "başlayan fiyat" sedan için canlı hesaplanır.
 * Lüksemburg bilerek kapsam dışıdır.
 */
export const popularRoutes: PopularRoute[] = [
  { id: "brussels-paris", from: "brussels", to: "paris" },
  { id: "brussels-amsterdam", from: "brussels", to: "amsterdam" },
  { id: "bru-airport-antwerp", from: "bru-airport", to: "antwerp" },
  { id: "ams-airport-rotterdam", from: "ams-airport", to: "rotterdam" },
  { id: "cdg-airport-lille", from: "cdg-airport", to: "lille" },
  { id: "cologne-brussels", from: "cologne", to: "brussels" },
  { id: "dus-airport-maastricht", from: "dus-airport", to: "maastricht" },
];
