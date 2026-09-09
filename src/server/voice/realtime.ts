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

export async function transcribeAudio(audio: Blob, filename: string, lang?: string): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", process.env.VOICE_STT_MODEL ?? "whisper-1");
  form.append("response_format", "json");
  if (lang) form.append("language", lang);
  const res = await fetch(process.env.VOICE_STT_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VOICE_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`STT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
