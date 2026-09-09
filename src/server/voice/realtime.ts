/**
 * Gerçek zamanlı ses köprüsü yapılandırması.
 *
 * Tarayıcı, mikrofon sesini WebRTC ile doğrudan ses sağlayıcısına gönderir; sağlayıcının API anahtarı
 * tarayıcıya hiç inmez: SDP teklifi /api/voice-agent/webrtc üzerinden sunucuda imzalanıp iletilir.
 *
 *   VOICE_API_KEY       sağlayıcı anahtarı (zorunlu)
 *   VOICE_REALTIME_URL  sağlayıcının SDP uç noktası, örn. https://api.<saglayici>.com/v1/realtime
 *   VOICE_MODEL         isteğe bağlı model/ses kimliği; sorgu parametresi olarak eklenir
 */
export function realtimeConfigured(): boolean {
  return !!(process.env.VOICE_API_KEY && process.env.VOICE_REALTIME_URL);
}

export async function forwardOffer(offerSdp: string): Promise<{ status: number; body: string; contentType: string }> {
  const url = new URL(process.env.VOICE_REALTIME_URL as string);
  if (process.env.VOICE_MODEL) url.searchParams.set("model", process.env.VOICE_MODEL);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VOICE_API_KEY}`, "Content-Type": "application/sdp" },
    body: offerSdp,
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, body: await res.text(), contentType: res.headers.get("content-type") ?? "application/sdp" };
}

/**
 * Sunucu tarafı konuşma-metin (STT) köprüsü. Tarayıcıda Web Speech API çalışmazsa ses kaydı buraya gelir.
 *
 *   VOICE_STT_URL    Whisper uyumlu transkripsiyon uç noktası (multipart: file, model, language → { text })
 *                    örn. https://api.<saglayici>.com/v1/audio/transcriptions
 *   VOICE_STT_MODEL  model adı (varsayılan whisper-1)
 *   VOICE_API_KEY    Bearer anahtarı (gerçek zamanlı köprüyle ortak)
 */
export function sttConfigured(): boolean {
  return !!(process.env.VOICE_API_KEY && process.env.VOICE_STT_URL);
}

export class SttError extends Error {
  constructor(public status: number, public detail: string) {
    super(`STT ${status}: ${detail}`);
    this.name = "SttError";
  }
}

async function postStt(audio: Blob, filename: string, lang?: string): Promise<Response> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", process.env.VOICE_STT_MODEL ?? "whisper-1");
  form.append("response_format", "json");
  if (lang) form.append("language", lang);
  return fetch(process.env.VOICE_STT_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VOICE_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
}

/** Sesi STT servisine gönderir. Sağlayıcı `language` alanını reddederse (400) bir kez dilsiz tekrar dener. */
export async function transcribeAudio(audio: Blob, filename: string, lang?: string): Promise<string> {
  let res = await postStt(audio, filename, lang);
  if (res.status === 400 && lang) res = await postStt(audio, filename);
  if (!res.ok) throw new SttError(res.status, (await res.text()).replace(/\s+/g, " ").slice(0, 300));
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/**
 * Sunucu tarafı metin-ses (TTS): yanıtlar OpenAI TTS ile mp3 olarak üretilir, tarayıcı Audio ile çalar.
 *
 *   VOICE_TTS_URL    varsayılan https://api.openai.com/v1/audio/speech
 *   VOICE_TTS_MODEL  varsayılan tts-1
 *   VOICE_TTS_VOICE  varsayılan onyx (alloy, echo, fable, nova, shimmer de olur)
 *   Anahtar: OPENAI_API_KEY, yoksa VOICE_API_KEY
 */
const TTS_DEFAULT_URL = "https://api.openai.com/v1/audio/speech";

function ttsKey(): string | undefined {
  return process.env.OPENAI_API_KEY || process.env.VOICE_API_KEY || undefined;
}

export function ttsConfigured(): boolean {
  return !!ttsKey() && process.env.VOICE_TTS_DISABLED !== "1";
}

export class TtsError extends Error {
  constructor(public status: number, public detail: string) {
    super(`TTS ${status}: ${detail}`);
    this.name = "TtsError";
  }
}

/** Aynı cümle için tekrar üretim yapmamak adına küçük bellek içi önbellek (karşılama cümleleri sık tekrar eder). */
const ttsCache = new Map<string, Buffer>();
const TTS_CACHE_MAX = 60;

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const model = process.env.VOICE_TTS_MODEL ?? "tts-1";
  const voice = process.env.VOICE_TTS_VOICE ?? "onyx";
  const key = `${model}|${voice}|${text}`;
  const hit = ttsCache.get(key);
  if (hit) return hit;
  const res = await fetch(process.env.VOICE_TTS_URL ?? TTS_DEFAULT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${ttsKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, voice, input: text, response_format: "mp3", speed: 1.0 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new TtsError(res.status, (await res.text()).replace(/\s+/g, " ").slice(0, 300));
  const buf = Buffer.from(await res.arrayBuffer());
  if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value as string);
  ttsCache.set(key, buf);
  return buf;
}
