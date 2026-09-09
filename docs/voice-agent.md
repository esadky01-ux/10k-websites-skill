# Hızlı Sesli Sipariş

Sitenin sağ alt köşesindeki mikrofon, WhatsApp mantığında çalışan bir bas-konuş sipariş aracı açar. Müşteri
düğmeye dokunur, siparişini söyler, tekrar dokunur; ses sunucuda çözülür, ürünler sepete eklenir ve ekranda
onay kartı çıkar. Ses hiçbir zaman otomatik çalınmaz; "Özeti dinle" yalnızca dokunuşla çalışır.

## Akış

```
Tarayıcı                                        Sunucu (Next.js route handlers)
──────────────────────────────────────────      ─────────────────────────────────────────────────────
MediaRecorder (webm/opus, mp4)  ──POST──►       /api/voice-agent/order-audio
  { audio, lang }                                 1. Whisper (whisper-1): ses → metin (TR/NL/karma otomatik)
                                                  2. GPT-4o-mini (json_schema): metin → [{query, quantity, unit}]
                                                     (başarısızsa kural tabanlı parseOrderText yedeği)
                                                  3. Deterministik katalog eşleştirme (559 ürün, searchProducts)
                                                  4. Onaylı müşteriyse birim fiyat + toplam (fiyatlar sunucuda kalır)
  { transkript, dil, eklenenler[], bulunamayanlar[], toplamTutar, yedek }  ◄──
  eklenenler → CartProvider.setQuantity (mevcut miktara ekler)
  Sipariş Özeti kartı: transkript, eklenen satırlar, bulunamayanlar, toplam/fiyat notu
  [Sepete Git] [Özeti Dinle → /api/voice-agent/tts, dokunuşla] [Yeni Kayıt]
```

- **İstemci:** `src/components/VoiceAgent.tsx` (durumlar: idle · recording · processing · done · error), 30 sn kayıt sınırı,
  1,5 KB altı kayıtlar reddedilir, mikrofon izni/mikrofon yok/https uyarıları nazik metin olarak görünür, gerçek hata
  küçük puntolu satırda yazar ve `/api/voice-agent/log` ile sunucu loguna düşer. Bileşen bir Error Boundary içindedir.
- **Sunucu:** `src/server/voice/openai.ts` (Whisper, GPT-4o-mini, TTS köprüleri; anahtar temizleme ve gizleme),
  `src/server/voice/order.ts` (kalem çıkarımı, eşleştirme, sonuç ve özet cümlesi).
- **Belirsiz ürünler** (aynı ürün birden fazla boyutta) sepete eklenmez; "bulunamayanlar" listesinde seçeneklerle
  gösterilir: `mayonez (Pauwels Mayonez 1 L / 3 L / 9,2 kg?)`.

## Yapılandırma (.env)

| Değişken | Açıklama |
|---|---|
| `OPENAI_API_KEY` | Tek gerekli anahtar (Whisper, GPT-4o-mini, TTS). Yoksa `VOICE_API_KEY` kullanılır. Değer bozuksa (curl örneği, tırnak) yalnızca `sk-…` token'ı ayıklanır. |
| `VOICE_STT_MODEL` / `VOICE_LLM_MODEL` / `VOICE_TTS_MODEL` / `VOICE_TTS_VOICE` | Varsayılan `whisper-1`, `gpt-4o-mini`, `tts-1`, `onyx`. |
| `VOICE_STT_URL` / `VOICE_LLM_URL` / `VOICE_TTS_URL` | Uç nokta geçersiz kılma (OpenAI uyumlu sağlayıcılar). |
| `VOICE_TTS_DISABLED=1` | "Özeti dinle" düğmesini kapatır. |

`GET /api/voice-agent` → `{ configured, tts, maxSeconds }`. Anahtar yoksa arayüz düğmeyi devre dışı bırakır ve nedenini yazar.

## Güvenlik

- Fiyatlar yalnızca giriş yapmış ve onaylı müşteriye döner; diğerlerinde `birimFiyat: null`, `toplamTutar: null`.
- Tüm hata ayrıntıları `redactSecrets` ile maskelenir; anahtar, Bearer ve Authorization değerleri istemciye veya loga sızmaz.
- Sayfa `translate="no"` + `notranslate`: Chrome çevirisi DOM'u değiştiremez.

## Test

```bash
npm test      # eşleştirme, kural tabanlı yedek, sahte fetch ile Whisper→GPT→eşleştirme (Bearer doğrulaması), anahtar temizleme
npm run e2e   # sahte MediaRecorder ile kayıt → sonuç kartı → sepet → "Özeti dinle" yedeği → "Sepete git"; uyarılar; API doğrulama
```
