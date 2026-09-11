# Sesli asistan: Maximus Dijital Plasiyer (canlı) + Hızlı Sesli Sipariş (bas-konuş)

Sağ alt köşedeki mikrofon iki sekmeli bir pencere açar:

- **Canlı görüşme** — GPT-Live (`gpt-live-1`) ile uçtan uca WebRTC ses: müşteri telefon görüşmesi gibi konuşur, plasiyer
  aynı dilde anında cevap verir, araya girme (barge-in) modelin kendi konuşma algılamasıyla çalışır, ürünler tarayıcıdaki
  sepete araç çağrısıyla eklenir. Durumlar: Bağlanıyor · Dinliyor · Düşünüyor · Konuşuyor · Sessizde.
- **Bas-konuş** — aşağıda anlatılan Whisper → GPT-4o-mini → katalog eşleştirme akışı. Canlı görüşme sunucuda kapalıysa
  (`VOICE_LIVE_DISABLED=1` ya da anahtar yok) veya tarayıcı WebRTC desteklemiyorsa varsayılan sekme budur.

## Canlı görüşme (GPT-Live, WebRTC)

```
Tarayıcı (src/hooks/useLiveVoice.ts)                     Sunucu                              OpenAI
getUserMedia → RTCPeerConnection                         
  addTrack(mikrofon), createDataChannel("oai-events")    
  createOffer → SDP  ──POST /api/realtime-session──►     src/server/voice/live.ts
     { sdp, lang }                                        POST /v1/live/sessions  ────────►   { session: { model: gpt-live-1,
                                                            Authorization: Bearer <sunucu>      instructions, delegation:
                                                                                                { type: responses, responses:
                                                                                                  { model: gpt-5.6-terra, tools }}},
                                                                                                transport: { type: webrtc, sdp }}
  setRemoteDescription(answer)  ◄── 201 { id, sdp } ◄──  ◄── { id, transport: { sdp } } ◄──
  ses: WebRTC medya (mikrofon → model, model sesi → <audio autoplay>)
  veri kanalı olayları: session.started · session.input_transcript.delta (müşteri altyazı)
      · session.output_transcript.delta (plasiyer altyazı) · session.delegation.created (düşünüyor)
      · response.event{ response.output_item.done: function_call }  → araç tarayıcıda çalışır
            search_catalog → searchProducts (katalog istemcide)       add_to_cart → CartProvider.setQuantity
            show_cart → sepet satırları                               open_cart  → sepet paneli
        → response.item.create { function_call_output } + response.create
      · session.close (biz) / session.closed { reason } (model)   · session.input_audio.mute / unmute (mikrofon)
```

- **Neden `/v1/live/sessions`?** `gpt-live-1` Realtime uç noktalarında (`/v1/realtime/sessions`, `client_secrets`) çalışmaz;
  Live API'de oturum, sunucunun SDP teklifini ilettiği tek HTTP isteğiyle açılır ve API anahtarı tarayıcıya hiç inmez
  (geçici anahtar/`client_secret` gerekmez). Kanalda ayrıca `session.start` gönderilmez.
- **Kişilik ve dil:** `liveInstructions(lang)` — "Maximus Food Dijital Plasiyeri", Türkçe/Felemenkçe otomatik eşleme,
  kısa cümleler, Kürtçe kelime rehberi (`KURDISH_GUIDE`), adres/saat/-%15 depodan teslim bilgisi, fiyat söylememe.
  Araç çağıran arka uç modelin kuralları `BACKEND_INSTRUCTIONS` içindedir (önce ara, belirsizse en fazla üç boyut sor).
- **Maliyet koruması:** oturum 90 sn sessizlikte ve en geç 10 dakikada `session.close` ile kapanır; pencere kapatılınca
  da kapanır. Live API dakika başına (saniye bazlı) ücretlendirilir, arka uç model token'ları ayrıca sayılır; ücretsiz
  katman yoktur ve eşzamanlı oturum sayısı hesabın katmanına bağlıdır (Tier 1'de 25).
- **Arayüz:** `src/components/VoicePlasiyerModal.tsx` — canlı dalga formu (mikrofon seviyesinden), son 8 altyazı satırı,
  araç işlemleri rozetleri, Mikrofon kapat/aç · Sepete git · Görüşmeyi bitir. Hatalar `/api/voice-agent/log` ile loglanır.

# Hızlı Sesli Sipariş (bas-konuş sekmesi)

"Bas-konuş" sekmesi WhatsApp mantığında çalışan bir kayıt-gönder sipariş aracıdır. Müşteri
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

## Varyant seçici ve eşleştirme hassasiyeti

- Eşleştirici net bir ürün bulamayıp aynı aileden birden fazla varyant görürse (tavuk döner 10/15/20 kg, pirinç 900 g / 5 kg)
  sonuç `secenekler` altında döner; kart "Hangisi olsun?" başlığıyla chip'ler gösterir, tek dokunuşla istenen miktar sepete girer.
- Bir adayın listeye girmesi için sorgudaki en az bir **ürün kelimesi** (ad/marka) eşleşmeli; sayı ve boyut ekleri ("25'lik",
  "onluk", "20 kg") tek başına eşleşme sayılmaz, yalnızca doğru boyutu öne çıkaran ipucudur. Böylece "ayran 25'lik" yalnızca
  ayran ürünlerini getirir, 25 litrelik yağ veya 25 kg döner listeye giremez.
- Aday listesi en iyi puana yakın olanlarla (2,5 puan bandı, en fazla 5) sınırlıdır.

## Kürtçe ve yöresel kelimeler: "eğitim" nasıl yapılır

OpenAI Whisper ve GPT-4o-mini yeniden eğitilemez; pratikte üç katmanlı bir sözlük yaklaşımı kullanılır ve hepsi
`src/data/voice-vocab.ts` dosyasından beslenir:

1. **Whisper ipucu (`WHISPER_HINT`):** marka adları ve nadir kelimeler (Kurmancî dahil) transkripsiyon isteğine `prompt`
   olarak verilir; model bu kelimeleri duyduğunda doğru yazma eğilimi gösterir. Yeni bir kelime sık yanlış yazılıyorsa buraya ekleyin.
2. **Kalem çıkarımı sözlüğü:** aynı sözlük GPT-4o-mini talimatına "goşt=et, mirîşk=tavuk, dew=ayran…" biçiminde eklenir;
   model sorguyu katalog diliyle yazar.
3. **Eşleştirici eş anlamlıları:** sözlük `searchProducts` içinde sorgu genişletmesine katılır; "mirîşk" doğrudan tavuk
   ürünlerini bulur, "onluk" 10 kg ipucuna dönüşür.

Ayrıca `KURDISH_GUIDE` (aynı dosyada) sektörel bir Kurmancî kılavuzudur: ürünler (mrişk/mirîşk = tavuk/kip, goşt = et/vlees,
hêk = yumurta/eieren, rûn = yağ/olie, birinc = pirinç/rijst, penîr = peynir/kaas, nan = ekmek/pita/durum, pîvaz = soğan,
kartol/sêva erdê = patates/friet…), sayılar (du=2 … deh=10, bîst=20) ve birimler (koli/karton/qutî = koli, teneke, kîlo = kg,
dane/heb = adet). GPT-4o-mini talimatına okunaklı biçimde eklenir ve modele "query alanına asla Kürtçe kelime yazma, katalog
karşılığını yaz" kuralı verilir; LLM olmadan çalışan kural tabanlı yedek de aynı kılavuzla deterministik çeviri yapar
(`translateKurdish`: "sê koli mirîşk bîst kîlo" → "3 koli tavuk 20 kg").

Katalogda karşılığı olmayan bir kelime geldiğinde sistem onu `MAXIMUS_DATA_DIR/voice-unmatched.jsonl` dosyasına
(`{ at, query, transcript }`) yazar. Haftada bir bu dosyaya bakıp yeni kelimeleri `VOICE_VOCAB` içine eklemek, sahadaki
"eğitim" döngüsüdür. Örnek satır: `"goşt": ["döner", "et"]`. Anahtar tarafına kelimeyi Kürtçe yazıldığı gibi (aksanlı ve aksansız
iki biçimde) koymak, transkripsiyon farklarını tolere eder.

## Yapılandırma (.env)

| Değişken | Açıklama |
|---|---|
| `OPENAI_API_KEY` | Tek gerekli anahtar (Whisper, GPT-4o-mini, TTS). Yoksa `VOICE_API_KEY` kullanılır. Değer bozuksa (curl örneği, tırnak) yalnızca `sk-…` token'ı ayıklanır. |
| `VOICE_STT_MODEL` / `VOICE_LLM_MODEL` / `VOICE_TTS_MODEL` / `VOICE_TTS_VOICE` | Varsayılan `whisper-1`, `gpt-4o-mini`, `tts-1`, `onyx`. |
| `VOICE_STT_URL` / `VOICE_LLM_URL` / `VOICE_TTS_URL` | Uç nokta geçersiz kılma (OpenAI uyumlu sağlayıcılar). |
| `VOICE_TTS_DISABLED=1` | "Özeti dinle" düğmesini kapatır. |
| `VOICE_LIVE_MODEL` | Canlı görüşme konuşma modeli, varsayılan `gpt-live-1`. |
| `VOICE_LIVE_BACKEND_MODEL` | Araç çağıran arka uç model, varsayılan `gpt-5.6-terra` (`gpt-5.6-luna` daha ucuz). |
| `VOICE_LIVE_URL` | Live oturum uç noktası geçersiz kılma (varsayılan `https://api.openai.com/v1/live/sessions`). |
| `VOICE_LIVE_DISABLED=1` | Canlı görüşmeyi kapatır; yalnızca bas-konuş kalır. |

`GET /api/voice-agent` → `{ configured, tts, maxSeconds, live, liveModel }`. `POST /api/realtime-session { sdp, lang }` →
`201 { id, sdp, model, backendModel }`; anahtar yoksa 503 `live-not-configured`, üst hizmet hatasında 502 (ayrıntı maskeli). Anahtar yoksa arayüz düğmeyi devre dışı bırakır ve nedenini yazar.

## Güvenlik

- Fiyatlar yalnızca giriş yapmış ve onaylı müşteriye döner; diğerlerinde `birimFiyat: null`, `toplamTutar: null`.
- Tüm hata ayrıntıları `redactSecrets` ile maskelenir; anahtar, Bearer ve Authorization değerleri istemciye veya loga sızmaz.
- Sayfa `translate="no"` + `notranslate`: Chrome çevirisi DOM'u değiştiremez.

## Test

```bash
npm test      # eşleştirme, kural tabanlı yedek, sahte fetch ile Whisper→GPT→eşleştirme (Bearer doğrulaması), anahtar temizleme,
              # Live oturum isteği (/v1/live/sessions gövdesi, araçlar, Bearer), tarayıcı araç yürütücüsü (runTool)
npm run e2e   # bas-konuş: sahte MediaRecorder ile kayıt → kart → sepet; canlı: sahte RTCPeerConnection + stub oturum →
              # altyazı, araç çağrısı → sepet satırı, response.item.create/response.create, mute, session.close; uyarılar; API
```
