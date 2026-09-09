/**
 * OpenAI köprüleri (yalnızca sunucu): Whisper (konuşma → metin), GPT-4o-mini (metin → sipariş kalemleri),
 * TTS (özet → mp3). Anahtar OPENAI_API_KEY (yoksa VOICE_API_KEY); değer bozuksa yalnızca token ayıklanır.
 *
 *   VOICE_STT_URL    varsayılan https://api.openai.com/v1/audio/transcriptions   (VOICE_STT_MODEL: whisper-1)
 *   VOICE_LLM_URL    varsayılan https://api.openai.com/v1/chat/completions       (VOICE_LLM_MODEL: gpt-4o-mini)
 *   VOICE_TTS_URL    varsayılan https://api.openai.com/v1/audio/speech           (VOICE_TTS_MODEL: tts-1, VOICE_TTS_VOICE: onyx)
 */
import { cleanApiKey, redactSecrets } from "./secrets";
import { VOICE_VOCAB, WHISPER_HINT } from "@/data/voice-vocab";

const STT_URL = "https://api.openai.com/v1/audio/transcriptions";
const LLM_URL = "https://api.openai.com/v1/chat/completions";
const TTS_URL = "https://api.openai.com/v1/audio/speech";

export function openaiKey(): string | undefined {
  return cleanApiKey(process.env.OPENAI_API_KEY) ?? cleanApiKey(process.env.VOICE_API_KEY);
}

export function openaiConfigured(): boolean {
  return !!openaiKey();
}

/** Hata ayrıntısını anahtar sızdırmadan döndürür. */
export function safeDetail(text: string): string {
  return redactSecrets(text, openaiKey()).slice(0, 300);
}

export class UpstreamError extends Error {
  constructor(public stage: "stt" | "llm" | "tts", public status: number, public detail: string) {
    super(`${stage} ${status}: ${detail}`);
    this.name = "UpstreamError";
  }
}

async function readError(res: Response): Promise<string> {
  return safeDetail((await res.text()).replace(/\s+/g, " "));
}

/** Whisper: ses → metin. Dil verilmezse otomatik algılar (Türkçe/Felemenkçe/karma). */
export async function transcribeAudio(audio: Blob, filename: string, lang?: string): Promise<string> {
  const post = async (withLang: boolean) => {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", process.env.VOICE_STT_MODEL ?? "whisper-1");
    form.append("response_format", "json");
    // Marka ve saha kelimeleri ipucu: Whisper nadir kelimeleri (Kurmancî dahil) doğru yazsın
    form.append("prompt", WHISPER_HINT);
    if (withLang && lang) form.append("language", lang);
    return fetch(process.env.VOICE_STT_URL ?? STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey()}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  };
  let res = await post(true);
  if (res.status === 400 && lang) res = await post(false);
  if (!res.ok) throw new UpstreamError("stt", res.status, await readError(res));
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

export type ExtractedItem = { query: string; quantity: number; unit: "koli" | "adet" };
export type Extraction = { items: ExtractedItem[]; language: "tr" | "nl" | "ku" | "other" };

const EXTRACT_SYSTEM = `Sen bir toptan gıda sipariş ayrıştırıcısısın. Müşterinin konuşma metninden (Türkçe, Felemenkçe/Flamanca, Kürtçe veya karışık) sipariş kalemlerini çıkar.
Kurallar:
- Her kalem için ürün adını olduğu gibi (marka, boyut, örn. "kip döner 20 kg", "pauwels samurai 3 liter", "tabasco 350ml") "query" alanına yaz; miktarı "quantity" olarak sayıya çevir (bir=1, iki/twee=2, üç/drie=3, ...). Miktar söylenmediyse 1.
- Birim: koli/kutu/doos/dozen/colli/qutî → "koli"; adet/tane/paket/pak/stuk/stuks/şişe/fles/kova → "adet". Belirtilmediyse "koli".
- Selamlaşma, sohbet ve sipariş dışı sözleri atla. Ürün uydurma; yalnızca söylenenleri çıkar.
- "language": metnin baskın dili (tr, nl, ku, other).
- Saha sözlüğü (Kürtçe/yöresel → katalog): ${Object.entries(VOICE_VOCAB).map(([k, v]) => `${k}=${v[0]}`).join(", ")}. Bu kelimeleri "query" alanında katalog karşılığıyla yaz.
Yalnızca JSON döndür.`;

const EXTRACT_SCHEMA = {
  name: "voice_order",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string", enum: ["tr", "nl", "ku", "other"] },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { query: { type: "string" }, quantity: { type: "integer" }, unit: { type: "string", enum: ["koli", "adet"] } },
          required: ["query", "quantity", "unit"],
        },
      },
    },
    required: ["language", "items"],
  },
};

/** GPT-4o-mini: transkript → yapılandırılmış kalem listesi (JSON şema ile). */
export async function extractOrderItems(transcript: string): Promise<Extraction> {
  const res = await fetch(process.env.VOICE_LLM_URL ?? LLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.VOICE_LLM_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_schema", json_schema: EXTRACT_SCHEMA },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new UpstreamError("llm", res.status, await readError(res));
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as Partial<Extraction>;
  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .filter((i): i is ExtractedItem => !!i && typeof i.query === "string" && i.query.trim().length > 0)
    .map((i) => ({ query: i.query.trim().slice(0, 120), quantity: Math.max(1, Math.min(999, Math.floor(Number(i.quantity) || 1))), unit: i.unit === "adet" ? ("adet" as const) : ("koli" as const) }))
    .slice(0, 30);
  const language = parsed.language === "nl" || parsed.language === "ku" || parsed.language === "tr" ? parsed.language : "other";
  return { items, language };
}

/** TTS: metin → mp3. Aynı cümle bellek içinde önbelleklenir. */
const ttsCache = new Map<string, Buffer>();
const TTS_CACHE_MAX = 60;

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const model = process.env.VOICE_TTS_MODEL ?? "tts-1";
  const voice = process.env.VOICE_TTS_VOICE ?? "onyx";
  const key = `${model}|${voice}|${text}`;
  const hit = ttsCache.get(key);
  if (hit) return hit;
  const res = await fetch(process.env.VOICE_TTS_URL ?? TTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, voice, input: text, response_format: "mp3", speed: 1.0 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new UpstreamError("tts", res.status, await readError(res));
  const buf = Buffer.from(await res.arrayBuffer());
  if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value as string);
  ttsCache.set(key, buf);
  return buf;
}
