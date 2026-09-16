import type { VehicleId } from "@/types";

interface VehicleSilhouetteProps {
  id: VehicleId;
  className?: string;
}

/** `evenodd` kuralıyla oyulacak daire (lastik ve jant için). */
function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
}

/** Gövde altındaki tekerlek yuvası: sağdan sola çizilen yarım daire çentik (yarıçap 17). */
const ARCH = "a 17 17 0 0 0 -34 0";

/** Tekerlek: lastik dolu kalır, jant `evenodd` ile boşalır. Yuvanın içine tam oturur. */
function wheel(cx: number): string {
  return `${circle(cx, 82, 14)} ${circle(cx, 82, 5)}`;
}

/**
 * Üç özgün, markasız yan görünüm silueti (viewBox 240×100, araç sağa bakar).
 * Gövde tek parçadır; camlar, farlar ve jantlar `evenodd` kuralıyla oyulur,
 * böylece zemin rengi içlerinden görünür. Testler için dışa açıktır.
 */
export const vehicleSilhouettePaths: Record<VehicleId, string> = {
  // Sedan: alçak ve uzun; bagaj, kabin ve kaput üç ayrı hacim.
  sedan: [
    "M 18 84 L 18 60 Q 18 51 27 50 L 66 47 L 96 30 Q 101 26 108 26 L 156 26 Q 166 26 174 32 L 200 50 L 224 54 Q 232 55 232 63 L 232 84",
    `L 205 84 ${ARCH} L 69 84 ${ARCH} Z`,
    "M 76 46 L 101 33 L 128 33 L 128 46 Z",
    "M 136 33 L 156 33 L 188 48 L 136 48 Z",
    "M 218 57 L 228 58 L 228 64 L 218 64 Z",
    "M 21 56 L 27 55 L 27 61 L 21 61 Z",
    wheel(52),
    wheel(188),
  ].join(" "),
  // Van: yüksek ve kutu gibi; üç cam, dik ön cam, kısa burun.
  van: [
    "M 16 84 L 16 30 Q 16 20 26 20 L 148 20 Q 160 20 168 27 L 212 55 L 230 57 Q 236 58 236 66 L 236 84",
    `L 207 84 ${ARCH} L 71 84 ${ARCH} Z`,
    "M 26 30 L 72 30 L 72 54 L 26 54 Z",
    "M 80 30 L 128 30 L 128 54 L 80 54 Z",
    "M 136 30 L 158 30 L 196 54 L 136 54 Z",
    "M 224 61 L 232 62 L 232 68 L 224 68 Z",
    "M 18 58 L 24 58 L 24 68 L 18 68 Z",
    wheel(54),
    wheel(190),
  ].join(" "),
  // Business: en uzun gövde, sedan'dan biraz daha alçak tavan, yatık ön cam.
  business: [
    "M 10 84 L 10 62 Q 10 53 20 52 L 70 48 L 106 31 Q 112 28 120 28 L 162 28 Q 174 28 184 35 L 210 50 L 232 53 Q 238 54 238 62 L 238 84",
    `L 213 84 ${ARCH} L 67 84 ${ARCH} Z`,
    "M 82 46 L 111 34 L 138 34 L 138 46 Z",
    "M 146 34 L 168 34 L 200 48 L 146 48 Z",
    "M 226 56 L 234 57 L 234 62 L 226 62 Z",
    "M 14 58 L 20 57 L 20 62 L 14 62 Z",
    wheel(50),
    wheel(196),
  ].join(" "),
};

/** Dekoratif araç silueti; metin rengini alır (`fill="currentColor"`). */
export function VehicleSilhouette({ id, className = "h-20 w-auto" }: VehicleSilhouetteProps) {
  return (
    <svg viewBox="0 0 240 100" aria-hidden="true" focusable="false" fill="currentColor" className={className}>
      <path fillRule="evenodd" d={vehicleSilhouettePaths[id]} />
    </svg>
  );
}
