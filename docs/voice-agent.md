# Sesli Sipariş Asistanı — "Maximus Dijital Plasiyer"

Sitenin sağ alt köşesindeki mikrofon butonu, esnafla yıllardır çalışan samimi bir toptancı plasiyeri gibi konuşan
sesli sipariş asistanını açar. Müşteri "Bana 5 koli mayonez yaz" dediğinde ürün katalogdan eşleştirilir, sepete
eklenir ve asistan "Ekledim abi, başka ne lazım?" der.

## Mimari

```
Tarayıcı                                  Sunucu (Next.js route handlers)
─────────────────────────────────────     ─────────────────────────────────────────────
Web Speech API (STT, tr-TR/nl-BE)  ──►    POST /api/voice-agent
  transcript + geçmiş + sepet               ├─ src/server/voice/agent.ts  (Claude araç döngüsü)
                                            │    search_products · add_to_cart · remove_from_cart
                                            │    show_cart · open_cart   (strict tool schemas)
                                            └─ ANTHROPIC_API_KEY yoksa kural tabanlı yedek
  { text, lang, actions }          ◄──
  actions → CartProvider (setQuantity/remove/open)
  text → POST /api/voice-agent/tts (OpenAI TTS, mp3) → <audio>; TTS yoksa speechSynthesis; barge-in ile kesilebilir

Canlı ses (isteğe bağlı)
RTCPeerConnection ──SDP offer──►  POST /api/voice-agent/webrtc ──Bearer VOICE_API_KEY──► ses sağlayıcısı
                   ◄─SDP answer──                                                       (SDP uç noktası)
ses akışı tarayıcı ↔ sağlayıcı arasında doğrudan (WebRTC); data channel "events" → transkript / araç çağrıları
```

- **Karakter**: `src/server/voice/prompt.ts` — sistem talimatı, karşılama cümleleri (TR/NL/KU), "Ekledim abi" yanıtları.
- **Beyin**: `src/server/voice/agent.ts` — `runVoiceTurn()`; model `VOICE_AGENT_MODEL` (varsayılan `claude-opus-5`, adaptif düşünme, düşük efor). Dil, transkriptten anında tespit edilir (`detectVoiceLang`), yanıt o dilde döner ve tarayıcı tanıma dilini değiştirir.
- **Arayüz**: `src/components/VoiceAgent.tsx` — durumlar `idle · listening (Dinliyor…) · thinking (Düşünüyor…) · speaking`, ses dalgası animasyonu (`.voice-wave` sınıfları, `globals.css`), tıkla-dinle ve bas-konuş (uzun basış), Escape ile kapanma.
- **Barge-in**: asistan konuşurken tanıma açık kalır; ara sonuç gelir gelmez `speechSynthesis.cancel()` çağrılır. Yankı koruması, asistanın kendi cümlesini mikrofondan geri duymasını yok sayar.
- **Araç bağlantısı**: sunucu yalnızca eylem listesi döndürür (`add` / `remove` / `open_cart`); gerçek sepet güncellemesi istemcide `CartProvider.setQuantity` ile yapılır, böylece sipariş matrisi ve sepet paneli anında güncellenir.

## Dayanıklılık ve kayıt yedeği

- Bileşen bir React Error Boundary içindedir: beklenmeyen istisnada sayfa çökmez, sağ altta uyarı + gerçek hata adı/mesajı
  (küçük punto) ve "tekrar dene" görünür. Hata ayrıca `POST /api/voice-agent/log` ile sunucu loguna yazılır.
- Tüm tarayıcı ses API çağrıları sarmalıdır; mikrofon izni, mikrofon yok, ağ ve güvensiz bağlantı durumları panelde
  nazik uyarı olarak görünür, altında hata ayrıntısı yazar.
- **Kayıt yedeği (MediaRecorder → sunucu STT):** Web Speech API yoksa, başlatılamazsa, sürekli kapanırsa veya
  15 saniye içinde hiç sonuç vermezse asistan otomatik olarak kayıt moduna geçer: mikrofon `MediaRecorder` ile kaydedilir,
  `POST /api/voice-agent/transcribe` ile Whisper uyumlu STT servisine (`VOICE_STT_URL`, `VOICE_API_KEY`) gönderilir, dönen
  metin aynı Claude turuna girer. Böylece cihazın konuşma tanıma motoruna bağımlılık kalkar. STT tanımlı değilse panel
  bunu açıkça söyler. Sağlayıcı hata dönerse (`upstream 4xx/5xx`) panel altındaki küçük puntolu satırda
  sağlayıcının yanıtı görünür; aynı satır sunucu loguna da yazılır.

### Chrome otomatik çeviri uyarısı

Chrome'un "sayfayı çevir" özelliği DOM'daki metin düğümlerini değiştirir; React bu düğümleri yeniden düzenlerken
`NotFoundError: insertBefore` hatası oluşur. Bu yüzden `<html translate="no">` ve `<meta name="google" content="notranslate">` ile sayfa çevirisi tamamen kapalıdır;
sesli asistanın kapsayıcıları ayrıca `translate="no"` taşır ve tüm dinamik metinler sabit `<span>` içinde render edilir. Site zaten Türkçe ve Felemenkçe sunulduğundan dil için sağ üstteki dil değiştirici kullanılmalı.

### Mobil ses ve dinleme döngüsü

- **Ses kilidi:** mikrofon/panel dokunuşunda panel içindeki `<audio>` sessiz bir WAV ile bir kez çalıştırılır; sonraki mp3'ler
  aynı öğe üzerinden dokunuş olmadan çalar. Tarayıcı yine de engellerse panelde "Sesi aç" düğmesi çıkar; dokununca bekleyen
  ses çalınır. Tarayıcı sesi anında "bitti" derse (Android'de görülür) aynı düğme gösterilir.
- **Yarı çift yönlü (mobil):** ses çalma ile tanıma aynı anda ses odağı için yarıştığından mobilde asistan konuşurken tanıma
  duraklatılır, konuşma bitince otomatik yeniden başlar. Masaüstünde tanıma açık kalır (barge-in).
- **Yankı koruması** yalnızca asistan konuşurken veya bitiminden 1,5 sn sonra gelen ve söylenen cümlenin en az %70'i olan
  metni yok sayar; kısa bir "selamünaleyküm" karşılamanın içinde geçse de işlenir.
- **Dil:** asistan sitenin aktif dilinde başlar; dil değiştirici kullanılınca tanıma dili, geçmiş ve karşılama o dile geçer.
  Konuşma sırasında müşteri başka dile geçerse yanıt ve tanıma dili yine ona uyar.

## Yapılandırma (.env)

| Değişken | Açıklama |
|---|---|
| `ANTHROPIC_API_KEY` | Claude beyni. Boşsa kural tabanlı yedek (`resolveOrder`) çalışır; prototip anahtarsız da test edilebilir. |
| `VOICE_AGENT_MODEL` | Varsayılan `claude-opus-5`. |
| `VOICE_API_KEY` | Gerçek zamanlı ses sağlayıcısının anahtarı. Yalnızca sunucuda okunur, tarayıcıya inmez. |
| `VOICE_REALTIME_URL` | Sağlayıcının SDP uç noktası (WebRTC). `VOICE_API_KEY` ile birlikte dolduğunda panelde "Canlı ses" butonu belirir. |
| `VOICE_MODEL` | İsteğe bağlı model / ses kimliği; sorgu parametresi olarak eklenir. |
| `VOICE_STT_URL` | Whisper uyumlu transkripsiyon uç noktası (multipart `file`, `model`, `language` → `{ text }`). Kayıt yedeğini etkinleştirir. |
| `VOICE_STT_MODEL` | STT model adı, varsayılan `whisper-1`. |
| `OPENAI_API_KEY` | Doğal ses (TTS) anahtarı; yoksa `VOICE_API_KEY` kullanılır. Tanımlıysa yanıtlar OpenAI TTS ile mp3 olarak üretilir. |
| `VOICE_TTS_URL` / `VOICE_TTS_MODEL` / `VOICE_TTS_VOICE` | Varsayılan `https://api.openai.com/v1/audio/speech`, `tts-1`, `onyx`. `VOICE_TTS_DISABLED=1` tarayıcı sesine döndürür. |

`GET /api/voice-agent` → `{ agent, greetings, brain: "claude" | "fallback", realtime: boolean, stt: boolean, tts: boolean }`

`POST /api/voice-agent/tts` `{ text }` → `audio/mpeg`. Aynı cümle sunucuda bellek içinde önbelleklenir (karşılama tekrarları ücretsiz).

## Neden WebRTC, WebSocket değil?

Vercel benzeri sunucusuz ortamlarda kalıcı WebSocket sunucusu çalışmaz. Bu yüzden ses akışı tarayıcı ile sağlayıcı
arasında eşler arası (WebRTC) gider; Next.js yalnızca SDP sinyalleşmesini imzalar. Kendi sunucunuzda çalıştırıyorsanız
`src/server/voice/realtime.ts` içindeki `forwardOffer` yerine bir WebSocket relay koyabilirsiniz; istemci sözleşmesi
(`transcript` ve `function_call` olayları) `VoiceAgent.tsx` içindeki data channel uyarlayıcısında tanımlıdır.

## Sınırlar (prototip)

- Kürtçe: tarayıcı konuşma tanıma motorları Kurmancî desteklemez; Kürtçe konuşma Türkçe motoruyla dinlenir, asistan
  Kürtçe yanıt verir ancak seslendirme Türkçe sesle yapılır. Gerçek Kürtçe STT/TTS için canlı ses sağlayıcısı gerekir.
- Web Speech API Chrome, Edge ve Safari'de çalışır; Firefox'ta panel "desteklenmiyor" uyarısı gösterir.
- Fiyat söylenmez; fiyatlar onaylı müşteriye sepette görünür.

## Test

```bash
npm test          # tests/voice.test.ts: karşılama, ekleme, boyut sorusu, dil geçişi, çıkarma/sepet açma
npm run e2e       # sahte SpeechRecognition ile uçtan uca: konuşma → sepet → seslendirme; API doğrulama
```
