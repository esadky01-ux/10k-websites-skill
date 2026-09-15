/**
 * Sözlük yardımcıları. Hem sunucu hem istemci bileşenlerinde kullanılabilir
 * (sözlük içe aktarmaz; yalnızca saf fonksiyonlar).
 */

/** `"Bu araç en fazla {max} yolcu alır"` → `{ max: 3 }` ile doldurur. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

/**
 * Noktalı anahtarı (`"locations.brussels"`) sözlük ağacında çözer.
 * Anahtar yoksa anahtarın kendisini döndürür ki eksik çeviri görünür olsun.
 */
export function resolveKey(dict: unknown, key: string): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : key;
}
