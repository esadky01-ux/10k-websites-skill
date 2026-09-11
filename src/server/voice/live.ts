/**
 * GPT-Live (gpt-live-1) canlı sesli asistan köprüsü.
 *
 * Akış (OpenAI Live API, WebRTC):
 *   tarayıcı RTCPeerConnection → SDP teklifi → POST /api/realtime-session → bu modül
 *   → POST https://api.openai.com/v1/live/sessions { session, transport: { type: "webrtc", sdp } }
 *   → SDP cevabı tarayıcıya döner; ses eşler arası akar, "oai-events" veri kanalı JSON olayları taşır.
 * API anahtarı sunucuda kalır; tarayıcıya yalnızca SDP cevabı ve oturum kimliği iner.
 *
 * Araçlar "responses" delegasyonu ile arka uç modele (VOICE_LIVE_BACKEND_MODEL) tanımlanır; araç çağrıları
 * veri kanalında "response.event" içinde sarılı "response.output_item.done" olarak gelir, sonuç
 * "response.item.create" + "response.create" ile geri gönderilir (bkz. src/hooks/useLiveVoice.ts).
 */
import { openaiKey, safeDetail, UpstreamError } from "./openai";
import { kurdishGuideText } from "@/data/voice-vocab";

const LIVE_URL = "https://api.openai.com/v1/live/sessions";
export const LIVE_MODEL = () => process.env.VOICE_LIVE_MODEL ?? "gpt-live-1";
export const LIVE_BACKEND_MODEL = () => process.env.VOICE_LIVE_BACKEND_MODEL ?? "gpt-5.6-terra";

export function liveConfigured(): boolean {
  return !!openaiKey() && process.env.VOICE_LIVE_DISABLED !== "1";
}

/** Konuşma katmanı talimatı: kısa, nazik, aynı dilde; ürün işleri arka uca devredilir. */
export function liveInstructions(lang: "tr" | "nl"): string {
  const tr = `Sen "Maximus Food Dijital Plasiyeri"sin: Belçika'daki restoran, dönerci, pizzacı, fritür, süpermarket ve fırınlara toptan gıda satan Maximus Food & Horeca'nın (Aarschot) profesyonel, hızlı ve nazik satış temsilcisisin.
Kişilik: sıcak ama işine hâkim; esnafla yıllardır çalışan bir plasiyer gibi. Cümleler kısa ve net; bu bir telefon görüşmesi gibi akar.
Dil: müşteri hangi dilde konuşuyorsa (Türkçe veya Felemenkçe/Flamanca; Kürtçe gelirse Türkçe yanıtla) anında o dile geç ve o dilde kal. İlk cümleyi müşterinin diliyle kur; dil belli olana kadar Türkçe konuş.
Karşılama: "Selamünaleyküm, Maximus Dijital Plasiyer, buyurun ne yazalım?" (Felemenkçe müşteriye: "Dag, Maximus Digitale Vertegenwoordiger, wat mag ik noteren?").
Araya girme: müşteri konuşmaya başlarsa hemen sus, kaldığın yeri tekrar etme, yeni söylediğine cevap ver.
Onaylama: sepete eklenen her ürünü tek cümleyle onayla ("Ekledim, 5 koli Tabasco. Başka?").

Delegasyon politikası:
- Arka uç araçları: search_catalog (ürün ara), add_to_cart (sepete ekle), show_cart (sepeti oku), open_cart (sepet panelini aç).
- Devret: müşteri bir ürün söylediğinde, miktar/koli/adet verdiğinde, sepeti sorduğunda veya siparişi tamamlamak istediğinde arka uca devret; sonucu bekleyip kısa onay ver.
- Devretme: selamlaşma, sohbet, adres (Nieuwlandlaan 111, Unit 3-4, 3200 Aarschot), çalışma saatleri (hafta içi 08:00–17:00, cumartesi 09:00–13:00), depodan teslimde %15 indirim, teslimat Belçika ve Hollanda.
- Fiyat söyleme: fiyatlar giriş yapan onaylı müşteriye sepette görünür.
- Birden fazla boyut varsa en fazla üç seçenek söyleyip tek soru sor ("10, 15 yoksa 20 kilo mu?").

${kurdishGuideText()}`;
  if (lang === "nl") return tr.replace('dil belli olana kadar Türkçe konuş', "dil belli olana kadar Felemenkçe konuş");
  return tr;
}

/** Arka uç (araç çağıran) model talimatı. */
export const BACKEND_INSTRUCTIONS = `Sen Maximus Food & Horeca'nın sipariş arka ucusun. Konuşma katmanı sana müşterinin isteğini iletir; sen araçları kullanıp kısa, konuşulabilir bir sonuç döndürürsün.
Kurallar:
1. Ürün eklemeden önce daima search_catalog ile ara. Sonuç netse (tek ürün veya aynı ürünün tek boyutu) add_to_cart çağır. Aynı ürünün birden fazla boyutu varsa ekleme; en fazla üç seçeneği kısa yaz ki plasiyer sorsun.
2. Miktar: "koli/kutu/doos" → cases, "adet/paket/stuk/şişe/kova" → units; söylenmediyse 1 koli.
3. Katalogda olmayan ürünü asla uydurma; "katalogda yok" de ve varsa en yakın alternatifi öner.
4. Fiyat söyleme. Sonuçları tek cümlede özetle; liste ve emoji kullanma.
5. Kürtçe/yöresel kelimeleri katalog diline çevirerek ara (mirîşk=tavuk, goşt=et, birinc=pirinç, dew=ayran, onluk=10 kg).`;

/** Arka uç araç tanımları (Responses API function şeması). */
export const LIVE_TOOLS = [
  {
    type: "function",
    name: "search_catalog",
    description: "Maximus kataloğunda (559 ürün) ürün arar. Türkçe/Felemenkçe ad, marka ve boyut kabul eder; en iyi adayları id, ad, marka, koli formatı ve kategori ile döndürür.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Arama, örn. 'tavuk döner 20 kg', 'pauwels samurai 3 liter', 'tabasco'" } }, required: ["query"], additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "add_to_cart",
    description: "Ürünü müşterinin sepetine ekler (mevcut miktara ekler). productId yalnızca search_catalog sonucundan alınır.",
    parameters: {
      type: "object",
      properties: { productId: { type: "string" }, cases: { type: "integer", minimum: 0, description: "koli sayısı" }, units: { type: "integer", minimum: 0, description: "adet/paket sayısı" } },
      required: ["productId", "cases", "units"],
      additionalProperties: false,
    },
    strict: true,
  },
  { type: "function", name: "show_cart", description: "Sepetin güncel içeriğini döndürür.", parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true },
  { type: "function", name: "open_cart", description: "Sitede sepet panelini açar; müşteri siparişi tamamlamak/WhatsApp ile göndermek istediğinde çağır.", parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true },
] as const;

export type LiveSession = { id: string; sdp: string; model: string; backendModel: string };

/**
 * SDP'yi OpenAI'nin ayrıştırıcısının beklediği biçime getirir: her satır CRLF ile biter, son satır dahil.
 * Sondaki satır sonu silinirse (ör. trim) üst hizmet "failed to unmarshal SDP: EOF" döndürür.
 */
export function normalizeSdp(sdp: string): string {
  const lines = sdp.replace(/\r\n/g, "\n").split("\n").filter((l, i, arr) => !(l === "" && i === arr.length - 1));
  return lines.join("\r\n") + "\r\n";
}

/** Tarayıcının SDP teklifiyle Live oturumu açar; SDP cevabını döndürür. */
export async function createLiveSession(sdp: string, lang: "tr" | "nl"): Promise<LiveSession> {
  const body = {
    session: {
      model: LIVE_MODEL(),
      instructions: liveInstructions(lang),
      delegation: {
        type: "responses",
        responses: { model: LIVE_BACKEND_MODEL(), instructions: BACKEND_INSTRUCTIONS, tools: LIVE_TOOLS, tool_choice: "auto" },
      },
    },
    transport: { type: "webrtc", sdp: normalizeSdp(sdp) },
  };
  const res = await fetch(process.env.VOICE_LIVE_URL ?? LIVE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new UpstreamError("llm", res.status, safeDetail((await res.text()).replace(/\s+/g, " ")));
  const data = (await res.json()) as { id?: string; session?: { id?: string }; transport?: { sdp?: string } };
  const answer = data.transport?.sdp;
  if (!answer) throw new UpstreamError("llm", 502, "Live yanıtında SDP cevabı yok");
  return { id: data.session?.id ?? data.id ?? "", sdp: answer, model: LIVE_MODEL(), backendModel: LIVE_BACKEND_MODEL() };
}
