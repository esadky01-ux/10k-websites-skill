/**
 * API anahtarı temizleme ve gizleme.
 *
 * Ortam değişkenine yanlışlıkla "curl https://api.openai.com ... -H 'Authorization: Bearer sk-...'" gibi
 * bir örnek yapıştırılırsa header'a satır sonu/boşluk girer ve fetch daha isteği atmadan
 * "Headers.append: invalid value" hatası verir. Bu yüzden değerden yalnızca gerçek token ayıklanır.
 * Hata metinlerine anahtar sızmasın diye tüm ayrıntılar redactSecrets'ten geçer.
 */

/** OpenAI tarzı anahtarlar: sk-..., sk-proj-..., sk-svcacct-... (harf, rakam, _ ve -). */
const KEY_PATTERN = /sk-[A-Za-z0-9_-]{20,}/;

/** Ham ortam değişkeninden yalnızca kullanılabilir token'ı döndürür; boş/geçersizse undefined. */
export function cleanApiKey(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(KEY_PATTERN);
  if (m) return m[0];
  // Başka sağlayıcı anahtarları: tırnak, "Bearer", boşluk ve kontrol karakterlerini at; ilk boşluksuz parçayı kullan
  const stripped = raw
    .replace(/[\r\n\t]/g, " ")
    .replace(/^\s*(authorization\s*:\s*)?(bearer\s+)?/i, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
  if (!stripped || /\s/.test(stripped) || /curl|https?:\/\//i.test(stripped)) {
    // Değerde komut/URL var ama tanıdık bir anahtar deseni yok → kullanılamaz
    const token = stripped.split(/\s+/).find((p) => /^[A-Za-z0-9_\-.]{16,}$/.test(p) && !/^(curl|https?:|bearer|authorization)/i.test(p));
    return token;
  }
  return stripped;
}

/** Hata/log metninden anahtarları ve Bearer değerlerini maskeler. */
export function redactSecrets(text: string, ...extraSecrets: (string | undefined)[]): string {
  let out = String(text ?? "");
  for (const s of extraSecrets) if (s && s.length >= 8) out = out.split(s).join("***");
  out = out.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***");
  out = out.replace(/(bearer\s+)[^\s"']+/gi, "$1***");
  out = out.replace(/(authorization\s*[:=]\s*)[^\r\n]+/gi, "$1***");
  return out;
}
