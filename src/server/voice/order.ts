/**
 * Hızlı Sesli Sipariş sunucu hattı:
 *   ses (webm/mp4) → Whisper metin → GPT-4o-mini kalem çıkarımı → deterministik katalog eşleştirme (559 ürün)
 *   → istemcinin sepete ekleyeceği satırlar + onay kartı verisi.
 *
 * GPT çıkarımı başarısız olursa veya anahtar yoksa kural tabanlı ayrıştırıcı (parseOrderText) devreye girer,
 * böylece metin elde edildiği sürece sipariş yine sepete düşer.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getProduct, formatPackaging, productName, type Product } from "@/data/products";
import { parseOrderText, searchProducts, normalize, type Match } from "@/server/whatsapp/matcher";
import { extractOrderItems, transcribeAudio, type ExtractedItem } from "./openai";
import { translateKurdish } from "@/data/voice-vocab";

export type VoiceLang = "tr" | "nl" | "ku";
export type AddedLine = { id: string; isim: string; koli: number; adet: number; adetMetni: string; ambalaj: string; birimFiyat: number | null };
export type Candidate = { id: string; isim: string; ambalaj: string; etiket: string; birimFiyat: number | null };
/** Birden fazla varyant bulunan kalem: arayüz "Hangisi olsun?" chip'leriyle sorar. */
export type VariantChoice = { sorgu: string; koli: number; adet: number; adetMetni: string; adaylar: Candidate[] };
export type OrderAudioResult = {
  transkript: string;
  dil: VoiceLang;
  eklenenler: AddedLine[];
  secenekler: VariantChoice[];
  bulunamayanlar: string[];
  toplamTutar: number | null;
  /** Kural tabanlı yedek çalıştıysa true (GPT çıkarımı yapılamadı). */
  yedek: boolean;
};

const UNIT_WORD: Record<VoiceLang, { koli: string; adet: string }> = { tr: { koli: "koli", adet: "adet" }, nl: { koli: "colli", adet: "stuks" }, ku: { koli: "qutî", adet: "heb" } };

/** Aynı ürün farklı boyutlarda mı? (aynı ad, aynı boyut ve koli formatı → gerçekten aynı kalem) */
function sameItem(a: Match, b: Match): boolean {
  return normalize(a.product.name) === normalize(b.product.name) && a.product.unitSize === b.product.unitSize && a.product.unitsPerCase === b.product.unitsPerCase;
}

/** Kalemi kataloga çözer: net eşleşme → ürün; belirsiz → alternatif listesi; hiç yok → undefined. */
export function matchItem(item: ExtractedItem): { product?: Product; alternatives: Product[] } {
  const hits = searchProducts(item.query, 6);
  const best = hits[0];
  const second = hits[1];
  if (!best) return { alternatives: [] };
  const confident = best.score >= 5 && (!second || best.score - second.score >= 2 || sameItem(best, second));
  if (confident) return { product: best.product, alternatives: [] };
  // Varyantlar: en iyi adaya yakın puanlı olanlar (alakasız kategoriler elenir), en fazla 5
  const alternatives = hits.filter((h) => h.score >= best.score - 2.5).slice(0, 5).map((h) => h.product);
  return { alternatives };
}

export function detectLang(text: string, hint?: string): VoiceLang {
  if (hint === "tr" || hint === "nl" || hint === "ku") return hint;
  const t = text.toLowerCase();
  if (/\b(ez|dixwazim|spas|bira|silav|çend|qutî|rojbaş)\b/.test(t)) return "ku";
  if (/\b(graag|dozen|doos|stuks|alstublieft|bedankt|twee|drie|vier|vijf|kaas|frieten|bestellen)\b/.test(t)) return "nl";
  return "tr";
}

/** Metinden kalemleri çıkarır: önce GPT-4o-mini, olmazsa kural tabanlı. */
export async function itemsFromTranscript(transcript: string, useLlm: boolean): Promise<{ items: ExtractedItem[]; lang: VoiceLang; yedek: boolean }> {
  if (useLlm) {
    try {
      const ex = await extractOrderItems(transcript);
      return { items: ex.items, lang: detectLang(transcript, ex.language), yedek: false };
    } catch (err) {
      console.warn("[voice-order] LLM çıkarımı başarısız, kural tabanlı yedek:", (err as Error)?.message);
    }
  }
  // Kural tabanlı yedek: Kürtçe sayı/birim/ürün kelimeleri önce katalog diline çevrilir
  const cleaned = translateKurdish(transcript).replace(/\b(bana|lütfen|yaz|ekle|ekleyiver|koy|gönder|istiyorum|zet|erbij|erop|graag|alstublieft|bide|min re|ji bo min|kerem bike)\b/gi, " ").replace(/\s+/g, " ").trim();
  const items = parseOrderText(cleaned).map((l) => ({ query: l.query, quantity: l.quantity, unit: l.unit }));
  return { items, lang: detectLang(transcript), yedek: true };
}

/** Kalemleri eşleştirir, fiyat verilmişse tutar hesaplar. Belirsiz kalemler "secenekler" olarak döner. */
export function buildResult(transcript: string, items: ExtractedItem[], lang: VoiceLang, prices: Record<string, number> | null, yedek: boolean): OrderAudioResult {
  const eklenenler: AddedLine[] = [];
  const secenekler: VariantChoice[] = [];
  const bulunamayanlar: string[] = [];
  const u = UNIT_WORD[lang];
  const pl = lang === "nl" ? "nl" : "tr";
  for (const item of items) {
    const koli = item.unit === "koli" ? item.quantity : 0;
    const adet = item.unit === "adet" ? item.quantity : 0;
    const { product, alternatives } = matchItem(item);
    if (!product) {
      if (alternatives.length) {
        const sameName = new Set(alternatives.map((p) => productName(p, pl))).size === 1;
        secenekler.push({
          sorgu: item.query,
          koli,
          adet,
          adetMetni: qtyText(koli, adet, u),
          adaylar: alternatives.map((p) => ({ id: p.id, isim: productName(p, pl), ambalaj: formatPackaging(p), etiket: sameName ? formatPackaging(p) : `${productName(p, pl)} · ${formatPackaging(p)}`, birimFiyat: prices ? (prices[p.id] ?? null) : null })),
        });
      } else {
        bulunamayanlar.push(item.query);
        logUnmatched(item.query, transcript);
      }
      continue;
    }
    const ex = eklenenler.find((l) => l.id === product.id);
    if (ex) {
      ex.koli += koli;
      ex.adet += adet;
      ex.adetMetni = qtyText(ex.koli, ex.adet, u);
      continue;
    }
    const price = prices ? (prices[product.id] ?? null) : null;
    eklenenler.push({ id: product.id, isim: productName(product, pl), koli, adet, adetMetni: qtyText(koli, adet, u), ambalaj: formatPackaging(product), birimFiyat: price });
  }
  let toplamTutar: number | null = null;
  if (prices) {
    toplamTutar = 0;
    for (const l of eklenenler) {
      const p = getProduct(l.id);
      const unit = l.birimFiyat ?? 0;
      toplamTutar += unit * (l.adet + l.koli * (p?.unitsPerCase ?? 1));
    }
    toplamTutar = Math.round(toplamTutar * 100) / 100;
  }
  return { transkript: transcript, dil: lang, eklenenler, secenekler, bulunamayanlar, toplamTutar, yedek };
}

/** Eşleşmeyen sorguları sözlük "eğitimi" için kaydeder (MAXIMUS_DATA_DIR/voice-unmatched.jsonl). Asla fırlatmaz. */
function logUnmatched(query: string, transcript: string) {
  try {
    const dir = process.env.MAXIMUS_DATA_DIR ?? path.join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "voice-unmatched.jsonl"), JSON.stringify({ at: new Date().toISOString(), query, transcript }) + "\n");
  } catch {
    /* log yazılamazsa sessizce geç */
  }
}

function qtyText(koli: number, adet: number, u: { koli: string; adet: string }): string {
  return [koli ? `${koli} ${u.koli}` : "", adet ? `${adet} ${u.adet}` : ""].filter(Boolean).join(" + ");
}

/** Uçtan uca: ses → sonuç. `prices` yalnızca onaylı müşteri için verilir. */
export async function processOrderAudio(audio: Blob, filename: string, langHint: VoiceLang | undefined, prices: Record<string, number> | null, useLlm = true): Promise<OrderAudioResult> {
  const transcript = await transcribeAudio(audio, filename, langHint && langHint !== "ku" ? langHint : undefined);
  if (!transcript) return { transkript: "", dil: langHint ?? "tr", eklenenler: [], secenekler: [], bulunamayanlar: [], toplamTutar: null, yedek: false };
  const { items, lang, yedek } = await itemsFromTranscript(transcript, useLlm);
  return buildResult(transcript, items, langHint ?? lang, prices, yedek);
}

/** Onay kartını sesli okumak için kısa özet cümlesi (kullanıcı isteğiyle çalınır, asla otomatik değil). */
export function summaryText(r: OrderAudioResult): string {
  const lang = r.dil;
  if (!r.eklenenler.length && !r.secenekler.length) return lang === "nl" ? "Ik kon geen product herkennen, probeer het nog eens." : lang === "ku" ? "Min tu hilber nas nekir, dîsa biceribîne." : "Ürün anlayamadım abi, bir daha söyler misin?";
  const list = r.eklenenler.map((l) => `${l.adetMetni} ${l.isim}`).join(", ") || (lang === "nl" ? "niets" : lang === "ku" ? "tiştek" : "henüz bir şey yok");
  const missing = r.bulunamayanlar.length ? (lang === "nl" ? ` Niet gevonden: ${r.bulunamayanlar.join(", ")}.` : lang === "ku" ? ` Nehat dîtin: ${r.bulunamayanlar.join(", ")}.` : ` Bulamadıklarım: ${r.bulunamayanlar.join(", ")}.`) : "";
  return lang === "nl" ? `Toegevoegd: ${list}.${missing} Nog iets, baas?` : lang === "ku" ? `Zêde kirin: ${list}.${missing} Tiştekî din, bira?` : `Sepete ekledim: ${list}.${missing} Başka ne lazım abi?`;
}
