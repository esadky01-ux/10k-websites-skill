import { notFound } from "next/navigation";

/**
 * Eşleşmeyen dil önekli yollar (`/tr/olmayan-sayfa`) 404 durum koduyla
 * `src/app/[locale]/not-found.tsx` sayfasına düşer; header ve footer korunur.
 */
export default function CatchAllPage() {
  notFound();
}
