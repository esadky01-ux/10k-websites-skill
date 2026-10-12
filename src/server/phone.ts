/**
 * Telefon normalleştirme. Hem FileStore hem PostgresStore bunu kullanır; tek doğruluk kaynağı.
 * Belçika numaraları: rakam dışı karakterler atılır, baştaki 0 ülke koduna (32) çevrilir.
 * PostgresStore bunu INSERT sırasında hesaplar ve phone_normalized kolonunda indeksler;
 * böylece SQL tarafında normalleştirme mantığı tekrarlanmaz.
 */
export function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^0/, "32");
}
