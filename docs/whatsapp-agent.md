# WhatsApp Sipariş Ajanı — Mimari

Müşteriler siparişlerini zaten WhatsApp'tan yazıyor. Ajan bu alışkanlığı değiştirmeden, gelen serbest metni
(Türkçe, Hollandaca veya karışık) katalogla eşleştirip düzenli bir taslak siparişe çevirir, belirsiz kalemleri
kısa bir soruyla netleştirir ve onaydan sonra siparişi kaydeder.

```mermaid
flowchart LR
  WA[WhatsApp Cloud API<br/>Meta] -->|webhook POST| R[/api/whatsapp/webhook]
  R --> H[handleIncoming]
  H --> S[(FileStore<br/>data/store.json)]
  H --> A{ANTHROPIC_API_KEY?}
  A -->|evet| C[Claude araç döngüsü<br/>claude-opus-5]
  A -->|hayır| F[Kural tabanlı yedek<br/>resolveOrder]
  C --> T1[search_products]
  C --> T2[update_draft / show_draft]
  C --> T3[confirm_order]
  C --> T4[lookup_customer]
  T1 --> M[matcher.ts<br/>TR/NL eşleştirme]
  T3 --> S
  H -->|yanıt| R -->|sendText| WA
```

## Bileşenler

| Dosya | Görev |
|---|---|
| `src/server/whatsapp/matcher.ts` | Deterministik ürün eşleştirme: Türkçe/Hollandaca normalizasyon, eş anlamlı sözlüğü, boyut eşleşmesi (20kg, 3 liter), satır ayrıştırma ("5 koli …, 2 kutu …"), güven puanı. LLM'den bağımsız, birim testli. |
| `src/server/whatsapp/agent.ts` | Sohbet durumu (telefon bazlı), dil tespiti, Claude araç döngüsü (`search_products`, `update_draft`, `show_draft`, `confirm_order`, `lookup_customer`) ve API anahtarı yokken çalışan kural tabanlı yedek akış. |
| `src/server/whatsapp/cloudapi.ts` | Meta Graph API ile mesaj gönderme, webhook gövdesinden mesaj ayıklama. Ortam değişkenleri yoksa "kuru mod": mesajlar konsola yazılır. |
| `src/app/api/whatsapp/webhook/route.ts` | Meta doğrulaması (GET, `hub.challenge`), imza kontrolü (`X-Hub-Signature-256`), gelen mesajları ajana iletme (POST). |
| `src/server/store.ts` | `CustomerStore` arayüzü: müşteri, sipariş, kayıtlı liste ve sohbet durumu. Dosya tabanlı uygulama; Odoo hazır olduğunda `OdooStore` ile değiştirilir. |
| `scripts/whatsapp-dry-run.mjs` | Meta bağlantısı olmadan yerel simülasyon. |

## Konuşma akışı

1. Müşteri yazar: `5 koli kip doner 20kg, 2 kutu samurai 3 liter`
2. Ajan her satırı `search_products` ile arar. Tek ve net eşleşme → taslağa ekler. Birden fazla format (10/15/20 kg) → en fazla 3 seçenekli tek soru sorar.
3. Taslağı kısa bir listeyle gösterir ve onay ister: `OK` (teslimat) veya `OK afhaling / OK depo` (-%15).
4. Onayda `confirm_order` çağrılır, sipariş `data/store.json` içine `source: "whatsapp-agent"` ile yazılır. Telefon numarası bir müşteri hesabıyla eşleşiyorsa sipariş o hesaba bağlanır ve web hesabında "Tekrar sipariş" olarak görünür.
5. Fiyat asla uydurulmaz; fiyatın teklifle onaylanacağı söylenir. Odoo bağlantısı geldiğinde `confirm_order` doğrudan satış siparişi açacak şekilde genişletilir.

## Kurulum

1. Meta for Developers'ta bir WhatsApp Business uygulaması oluşturun, kalıcı token ve `Phone Number ID` alın.
2. `.env` dosyasına `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` ve `ANTHROPIC_API_KEY` yazın (`.env.example`).
3. Webhook URL'si: `https://<alan-adı>/api/whatsapp/webhook`, doğrulama token'ı `WHATSAPP_VERIFY_TOKEN`. `messages` alanına abone olun.
4. Yerel test: `npm run whatsapp:dry -- "5 koli kip doner 20kg" "ok depo"`.

## Güvenlik ve sınırlar

- Webhook imzası `WHATSAPP_APP_SECRET` ile doğrulanır; tanımlı değilse yalnızca geliştirme ortamında atlanır.
- Sohbet geçmişi son 20 mesajla sınırlıdır ve sistem istemi önbelleklenir (`cache_control`), böylece maliyet düşük kalır.
- Model varsayılanı `claude-opus-5`, `WHATSAPP_AGENT_MODEL` ile değiştirilebilir. Oran sınırı veya bağlantı hatasında kural tabanlı yedek akış devreye girer, müşteri yanıtsız kalmaz.
- Ajan yalnızca katalogdaki ürünleri önerir; arama sonuçlarında olmayan ürün üretmez.

## Yol haritası

- **Odoo entegrasyonu:** `CustomerStore` için `OdooStore` (res.partner, sale.order, pricelist). Ajan `confirm_order` ile taslak satış siparişi açar.
- **Tekrar sipariş tahmini:** sipariş geçmişinden haftalık ritim çıkarıp teslimat gününden önce "Salı siparişiniz hazır mı?" mesajı.
- **Kayıp müşteri uyarısı:** iki hafta sipariş vermeyen müşteriyi satış ekibine bildirme.
- **Sesli mesaj:** Meta'dan gelen ses dosyalarını transkript edip aynı akışa sokma.
