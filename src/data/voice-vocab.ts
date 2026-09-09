/**
 * Saha sözlüğü: Kürtçe (Kurmancî), yöresel Türkçe ve esnaf jargonundan katalog terimlerine.
 *
 * Katalogda karşılığı olmayan kelimeler için "eğitim" burada yapılır: sağ tarafa katalogda geçen
 * Türkçe/Felemenkçe kelimeyi yazın. Sözlük üç yerde kullanılır:
 *   1) Eşleştirici (searchProducts) sorguyu bu eş anlamlılarla genişletir,
 *   2) Whisper'a "prompt" ipucu olarak verilir (nadir kelimeleri doğru duyması için),
 *   3) GPT-4o-mini kalem çıkarımına sözlük olarak eklenir.
 * Eşleşmeyen sorgular data/voice-unmatched.jsonl dosyasına düşer; oradan yeni kelimeler eklenir.
 */
export const VOICE_VOCAB: Record<string, string[]> = {
  // Kurmancî → katalog
  goşt: ["et", "vlees"], gost: ["et"],
  mirîşk: ["tavuk", "kip"], mirisk: ["tavuk"], mrişk: ["tavuk", "kip"], mrisk: ["tavuk"],
  hêk: ["yumurta", "eieren"], hek: ["yumurta"],
  "sêva erdê": ["patates", "friet"], "seva erde": ["patates"],
  ga: ["dana"], çêlek: ["dana"], celek: ["dana"],
  nan: ["ekmek", "brood"],
  penîr: ["peynir", "kaas"], penir: ["peynir"],
  rûn: ["yağ", "olie"], run: ["yag"],
  sîr: ["sarımsak", "knoflook"], sir: ["sarimsak"],
  pîvaz: ["soğan"], pivaz: ["sogan"],
  bacan: ["domates"], bacanê: ["domates"],
  kartol: ["patates", "friet"],
  şîr: ["süt", "melk"],
  dew: ["ayran"],
  av: ["su", "water"], avê: ["su"],
  birinc: ["pirinç", "rijst"],
  nok: ["nohut"],
  nîsk: ["mercimek"], nisk: ["mercimek"],
  ar: ["un", "bloem"],
  xwê: ["tuz"], xwe: ["tuz"],
  şekir: ["şeker"],
  zeytûn: ["zeytin"], zeytun: ["zeytin"],
  kaxez: ["kağıt", "papier"],
  qutî: ["kutu", "koli"], quti: ["kutu"],
  karton: ["koli"], kîlo: ["kg"], kilo: ["kg"], dane: ["adet"],
  // Esnaf jargonu / yöresel
  "25lik": ["25"], "25'lik": ["25"], onluk: ["10 kg"], yirmilik: ["20 kg"],
  bidon: ["kova"], teneke: ["teneke"], bib: ["bib"],
  dönerlik: ["döner"], donerlik: ["doner"],
  fritür: ["patates", "friet"], fritur: ["patates"],
  lahmacunluk: ["lahmacun"],
};

/** Whisper'a verilen kısa kelime listesi (nadir/özel kelimeleri doğru yazması için). */
export const WHISPER_HINT = [
  "Maximus, Pauwels, Samurai, Andalouse, Tabasco, Lutosa, Poco Loco, Nawras, Hane, Düzgün, Polat, Efendi, Mekkafood, Ceres, Van Reusel",
  "döner, tavuk döner, dana döner, kıyma döner, kip doner, koli, kutu, kova, teneke, bidon, BIB, 20 kg, 15 kg, 10 kg, 3 liter, 350 ml",
  "goşt, mirîşk, nan, penîr, rûn, sîr, dew, birinc, nok, nîsk, qutî",
].join(". ");

/**
 * Kurmancî sektör kılavuzu: GPT-4o-mini sistem talimatına okunaklı biçimde eklenir ve kural tabanlı yedek
 * çevirisinde kullanılır. Ürünler, sayılar ve birimler ayrı tutulur ki miktarlar rakama, birimler koli/adet'e dönsün.
 */
export const KURDISH_GUIDE = {
  products: [
    ["mrişk / mirîşk", "tavuk / kip"],
    ["goşt", "et / vlees"],
    ["hêk", "yumurta / eieren"],
    ["rûn", "yağ / olie"],
    ["birinc", "pirinç / rijst"],
    ["penîr", "peynir / kaas"],
    ["nan", "ekmek / pita / durum"],
    ["pîvaz", "soğan"],
    ["kartol / sêva erdê", "patates / friet"],
    ["dew", "ayran"],
    ["şîr", "süt / melk"],
    ["av", "su / water"],
    ["nok", "nohut"],
    ["nîsk", "mercimek"],
    ["sîr", "sarımsak / knoflook"],
    ["bacan", "domates"],
    ["ar", "un / bloem"],
    ["xwê", "tuz"],
    ["şekir", "şeker"],
    ["zeytûn", "zeytin"],
  ] as const,
  numbers: { yek: 1, du: 2, sê: 3, se: 3, çar: 4, car: 4, pênc: 5, penc: 5, şeş: 6, ses: 6, heft: 7, heşt: 8, hest: 8, neh: 9, deh: 10, bîst: 20, bist: 20 } as Record<string, number>,
  units: { koli: "koli", karton: "koli", qutî: "koli", quti: "koli", teneke: "teneke", kîlo: "kg", kilo: "kg", dane: "adet", heb: "adet" } as Record<string, string>,
};

/** Kılavuzun GPT talimatına eklenen metni. */
export function kurdishGuideText(): string {
  const products = KURDISH_GUIDE.products.map(([k, v]) => `${k} = ${v}`).join("; ");
  const numbers = Object.entries(KURDISH_GUIDE.numbers).filter(([k]) => !/^(se|car|penc|ses|hest|bist)$/.test(k)).map(([k, v]) => `${k}=${v}`).join(", ");
  const units = "koli / karton / qutî = koli; teneke = teneke (ürün adında kalır, birim adet); kîlo = kg; dane / heb = adet";
  return `Kurmancî (Kürtçe) Horeca kılavuzu — müşteri Kürtçe terim kullanırsa "query" alanına katalog karşılığını (Türkçe veya Felemenkçe) yaz, Kürtçe kelimeyi bırakma:
- Ürünler: ${products}.
- Sayılar: ${numbers} (örn. "sê koli mirîşk" → quantity 3, unit koli, query "tavuk").
- Birimler: ${units}. "20 kîlo" gibi boyutlar query içinde "20 kg" olarak kalır.`;
}

/**
 * Kural tabanlı yedek için deterministik Kürtçe → katalog çevirisi (LLM olmadan da çalışır):
 * sayı kelimeleri rakama, birimler koli/adet/kg'ye, ürün kelimeleri Türkçe karşılığına.
 */
export function translateKurdish(text: string): string {
  let out = ` ${text} `;
  for (const [k, v] of KURDISH_GUIDE.products) {
    const tr = v.split("/")[0].trim();
    for (const alias of k.split("/").map((a) => a.trim())) out = out.replace(new RegExp(`(?<=\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s,.;])`, "giu"), tr);
  }
  for (const [k, n] of Object.entries(KURDISH_GUIDE.numbers)) out = out.replace(new RegExp(`(?<=\\s)${k}(?=\\s)`, "giu"), String(n));
  for (const [k, u] of Object.entries(KURDISH_GUIDE.units)) out = out.replace(new RegExp(`(?<=\\s)${k}(?=[\\s,.;])`, "giu"), u);
  return out.replace(/\s+/g, " ").trim();
}
