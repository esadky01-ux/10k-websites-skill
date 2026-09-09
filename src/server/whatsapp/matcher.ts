/**
 * Serbest metin sipariş satırlarını ürün kataloğuyla eşleştirir.
 * LLM'den bağımsız, deterministik ve test edilebilir. Ajan bu modülü araç olarak kullanır;
 * ANTHROPIC_API_KEY yoksa kural tabanlı ayrıştırıcı tek başına da çalışır.
 */
import { products, type Product } from "@/data/products";

export type Match = { product: Product; score: number };
export type ParsedLine = { raw: string; quantity: number; unit: "koli" | "adet"; query: string; sizeHint?: string };

const STOP = new Set(["koli", "kutu", "adet", "stuk", "stuks", "colli", "doos", "dozen", "tane", "paket", "pak", "x", "ve", "en", "ile", "met", "lütfen", "lutfen", "aub", "graag", "istiyorum", "gönder", "gonder", "bestellen", "bestel", "sipariş", "siparis", "order", "the", "of", "van", "de", "het", "bir", "een"]);

export function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/é|è|ë|ê/g, "e").replace(/ï|î/g, "i").replace(/ö|ô/g, "o")
    .replace(/[^a-z0-9.,%/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Türkçe/Hollandaca eş anlamlılar: sorgu genişletme */
const SYNONYMS: Record<string, string[]> = {
  tavuk: ["kip", "chicken"], kip: ["tavuk"], doner: ["döner", "kebab"], sos: ["saus", "sauce"], saus: ["sos"],
  patates: ["friet", "frieten", "fries"], friet: ["patates"], pizza: ["pizzadoos"], kutu: ["doos", "box"], doos: ["kutu"],
  peynir: ["kaas", "cheese"], kaas: ["peynir"], sut: ["melk"], ekmek: ["brood", "pide"], pide: ["brood"], et: ["vlees"], vlees: ["et"],
  kiyma: ["gehakt"], gehakt: ["kiyma"], hindi: ["kalkoen"], kalkoen: ["hindi"], dana: ["rund", "beef"], rund: ["dana"],
  sarimsak: ["knoflook", "look"], knoflook: ["sarimsak"], mayonez: ["mayo", "mayonaise"], mayonaise: ["mayonez", "mayo"],
  ketcap: ["ketchup"], zeytin: ["olijven"], olijven: ["zeytin"], su: ["water"], water: ["su"], bira: ["bier"],
  poset: ["draagzak", "zak"], draagzak: ["poset"], eldiven: ["handschoenen"], handschoenen: ["eldiven"], kagit: ["papier"],
  aluminyum: ["aluminium"], aluminium: ["aluminyum"], kahverengi: ["bruin"], beyaz: ["wit"], siyah: ["zwart"], yesil: ["groen"],
  yag: ["olie"], olie: ["yag"], un: ["bloem"], bloem: ["un"], nohut: ["kikkererwten"], mercimek: ["linzen"], pirinc: ["rijst"],
  domates: ["tomaten"], tomaten: ["domates"], rendelenmis: ["geraspte"], geraspte: ["rendelenmis"], dilimlenmis: ["gesneden"],
};

type Indexed = { product: Product; tokens: Set<string>; text: string; sizeTokens: string[] };
let index: Indexed[] | null = null;

function tokensOf(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t && !STOP.has(t));
}

function buildIndex(): Indexed[] {
  if (index) return index;
  index = products.map((p) => {
    const text = normalize(`${p.name} ${p.nameNl} ${p.brand} ${p.sku} ${p.unitSize} ${p.unitLabel}`);
    const sizeTokens = normalize(`${p.unitsPerCase}x${p.unitSize.replace(/\s/g, "")} ${p.unitSize.replace(/\s/g, "")} ${p.unitSize}`).split(" ");
    return { product: p, tokens: new Set(text.split(" ").filter(Boolean)), text, sizeTokens };
  });
  return index;
}

function expand(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) for (const syn of SYNONYMS[t] ?? []) out.add(normalize(syn));
  return [...out];
}

/** Bir sorgu için en iyi ürün adaylarını puanlar. */
export function searchProducts(query: string, limit = 5): Match[] {
  const qTokens = tokensOf(query);
  if (!qTokens.length) return [];
  const expanded = expand(qTokens);
  const sizeInQuery = normalize(query).match(/\d+(?:[.,]\d+)?\s*(kg|g|gr|l|liter|cl|ml|cm|st|stuks)/g)?.map((s) => s.replace(/\s/g, "")) ?? [];
  const results: Match[] = [];
  for (const item of buildIndex()) {
    let score = 0;
    let matchedOriginal = 0;
    for (const t of qTokens) {
      if (item.tokens.has(t)) { score += 3; matchedOriginal++; continue; }
      if ([...item.tokens].some((it) => it.startsWith(t) && t.length >= 3)) { score += 1.5; matchedOriginal += 0.5; continue; }
      const syns = (SYNONYMS[t] ?? []).map(normalize);
      if (syns.some((s) => item.tokens.has(s))) { score += 2.5; matchedOriginal++; }
    }
    if (matchedOriginal === 0) continue;
    // Sorgudaki tüm anlamlı kelimeler eşleştiyse bonus
    if (matchedOriginal >= qTokens.length) score += 2;
    // Boyut eşleşmesi (20kg, 10 kg, 24x33cl)
    for (const s of sizeInQuery) {
      if (item.sizeTokens.some((st) => st === s || st.replace(",", ".") === s.replace(",", "."))) score += 3;
      else if (item.text.includes(s)) score += 2;
    }
    // Marka sorguda geçiyorsa bonus
    if (qTokens.includes(normalize(item.product.brand).split(" ")[0])) score += 1;
    // Kısa ürün adları (daha az fazladan kelime) hafif öncelikli
    score -= Math.max(0, item.tokens.size - qTokens.length - 6) * 0.05;
    results.push({ product: item.product, score });
  }
  results.sort((a, b) => b.score - a.score);
  void expanded;
  return results.slice(0, limit);
}

/**
 * "5 koli kip doner 20kg, 2 kutu samurai 3l" gibi bir mesajı satırlara böler.
 * Miktar başta ya da sonda olabilir; birim koli/kutu/doos → koli, adet/stuk/tane → adet.
 */
export function parseOrderText(text: string): ParsedLine[] {
  const parts = text
    .replace(/\r/g, "")
    .split(/\n|,|;|\+|\bve\b|\ben\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  const lines: ParsedLine[] = [];
  for (const raw of parts) {
    const n = normalize(raw);
    let quantity = 1;
    let unit: "koli" | "adet" = "koli";
    let rest = n;
    let m = n.match(/^(\d+)\s*(koli|kutu|doos|dozen|colli|adet|stuk|stuks|tane|paket|pak)?\s+(.+)$/);
    if (m) {
      quantity = parseInt(m[1], 10);
      rest = m[3];
      if (m[2] && /adet|stuk|tane|paket|pak/.test(m[2])) unit = "adet";
    } else if ((m = n.match(/^(.+?)\s+(\d+)\s*(koli|kutu|doos|dozen|colli|adet|stuk|stuks|tane|paket|pak)?$/))) {
      quantity = parseInt(m[2], 10);
      rest = m[1];
      if (m[3] && /adet|stuk|tane|paket|pak/.test(m[3])) unit = "adet";
    } else if ((m = n.match(/^(\d+)x\s*(.+)$/))) {
      quantity = parseInt(m[1], 10);
      rest = m[2];
    }
    if (!rest.trim()) continue;
    const sizeHint = rest.match(/\d+(?:[.,]\d+)?\s*(kg|g|gr|l|liter|cl|ml)/)?.[0];
    lines.push({ raw, quantity: Math.max(1, Math.min(quantity, 999)), unit, query: rest.trim(), sizeHint });
  }
  return lines;
}

export type Resolution = { line: ParsedLine; best?: Match; alternatives: Match[]; confident: boolean };

/** Satırları ürünlere çözer; belirsiz olanları işaretler. */
export function resolveOrder(text: string): Resolution[] {
  return parseOrderText(text).map((line) => {
    const matches = searchProducts(line.query, 5);
    const best = matches[0];
    const second = matches[1];
    const sameItem = (a: Match, b: Match) => normalize(a.product.name) === normalize(b.product.name) && a.product.unitSize === b.product.unitSize && a.product.unitsPerCase === b.product.unitsPerCase;
    const confident = !!best && best.score >= 5 && (!second || best.score - second.score >= 2 || sameItem(best, second));
    return { line, best, alternatives: matches.slice(1, 4), confident };
  });
}
