/**
 * WhatsApp sipariş alma ajanı.
 *
 * Akış: gelen mesaj → sohbet durumu (telefon bazlı) → Claude araç döngüsü
 *   araçlar: search_products (katalog eşleştirme), update_draft (taslak satırları),
 *            show_draft, confirm_order (siparişi kaydet), lookup_customer
 * → yanıt metni WhatsApp'a geri gönderilir.
 *
 * ANTHROPIC_API_KEY yoksa kural tabanlı yedek akış çalışır (resolveOrder), böylece
 * sistem anahtarsız ortamda da test edilebilir.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getStore, type ConversationState, type OrderLine } from "@/server/store";
import { getProduct, formatPackaging, productName } from "@/data/products";
import { resolveOrder, searchProducts } from "./matcher";
import { site } from "@/lib/site";

export type AgentReply = { text: string; state: ConversationState; orderId?: string };

const MODEL = process.env.WHATSAPP_AGENT_MODEL ?? "claude-opus-5";

function detectLang(text: string, fallback: "nl" | "tr"): "nl" | "tr" {
  const t = text.toLowerCase();
  if (/\b(graag|bestellen|bestel|dozen|stuks|alstublieft|bedankt|dank|goedemorgen|hallo|kaas|frieten)\b/.test(t)) return "nl";
  if (/[çğışöü]|\b(koli|adet|lütfen|merhaba|selam|tesekkur|teşekkür|sipariş|istiyorum|gönder)\b/.test(t)) return "tr";
  return fallback;
}

function draftText(lines: OrderLine[], lang: "nl" | "tr"): string {
  if (!lines.length) return lang === "nl" ? "(leeg)" : "(boş)";
  return lines
    .map((l, i) => {
      const p = getProduct(l.productId);
      if (!p) return "";
      const qty = [l.cases ? `${l.cases} ${lang === "nl" ? "colli" : "koli"}` : "", l.units ? `${l.units} ${lang === "nl" ? "stuks" : "adet"}` : ""].filter(Boolean).join(" + ");
      return `${i + 1}. ${productName(p, lang)} (${formatPackaging(p)}) — ${qty}`;
    })
    .filter(Boolean)
    .join("\n");
}

const SYSTEM = `Je bent de bestelassistent van ${site.name}, een B2B horeca groothandel in Aarschot (België), gespecialiseerd in döner- en pizza-ingrediënten. Je praat via WhatsApp met horecazaken (dönerzaken, pizzeria's, frituren).

Taal: antwoord in de taal van de klant (Nederlands of Turks). Klanten mengen soms beide talen; volg de laatste boodschap.

Werkwijze:
1. Haal bestelregels uit het bericht (hoeveelheid, colli of stuks, product, formaat zoals 20kg of 3 liter).
2. Zoek elk product met search_products. Gebruik het beste resultaat alleen als het duidelijk is; bij twijfel (meerdere formaten of merken) stel je één korte vraag met maximaal 3 opties.
3. Werk de conceptbestelling bij met update_draft en toon ze kort met show_draft.
4. Vraag pas om bevestiging als alles duidelijk is. Bij "ok/ja/evet/tamam/bevestig" roep je confirm_order aan met de leveringswijze (afhaling = 15% korting, of levering).
5. Wees kort en zakelijk: WhatsApp-stijl, geen lange uitleg, geen emoji-overdaad. Nooit prijzen verzinnen; zeg dat de prijs per offerte bevestigd wordt.
6. Als de klant iets vraagt buiten bestellen (openingsuren, adres, leverdagen): antwoord kort. Adres: ${site.address.full}. Openingsuren: ma–vr 08:00–17:00, za 09:00–13:00. Telefoon: ${site.phoneDisplay}.

Verzin nooit producten die niet in de zoekresultaten staan.`;

const tools: Anthropic.Tool[] = [
  {
    name: "search_products",
    description: "Zoek producten in de catalogus op naam, merk, formaat of Turks/Nederlands trefwoord. Geeft de beste kandidaten met id, naam en colliformaat.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Zoekterm, bv. 'kip doner 20kg' of 'samurai 3 liter'" } }, required: ["query"], additionalProperties: false },
    strict: true,
  },
  {
    name: "update_draft",
    description: "Voeg regels toe aan of wijzig regels in de conceptbestelling. Een regel met cases=0 en units=0 verwijdert het product.",
    input_schema: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: { type: "object", properties: { productId: { type: "string" }, cases: { type: "integer", minimum: 0 }, units: { type: "integer", minimum: 0 } }, required: ["productId", "cases", "units"], additionalProperties: false },
        },
      },
      required: ["lines"],
      additionalProperties: false,
    },
    strict: true,
  },
  { name: "show_draft", description: "Toon de huidige conceptbestelling.", input_schema: { type: "object", properties: {}, additionalProperties: false }, strict: true },
  {
    name: "confirm_order",
    description: "Bevestig en bewaar de bestelling. Alleen aanroepen nadat de klant expliciet bevestigd heeft.",
    input_schema: { type: "object", properties: { delivery: { type: "string", enum: ["adres", "depo"], description: "adres = levering, depo = afhaling in Aarschot (-15%)" }, note: { type: "string" } }, required: ["delivery", "note"], additionalProperties: false },
    strict: true,
  },
  { name: "lookup_customer", description: "Zoek de klant op telefoonnummer om zaaknaam en laatste bestelling te kennen.", input_schema: { type: "object", properties: {}, additionalProperties: false }, strict: true },
];

async function runTool(name: string, input: Record<string, unknown>, state: ConversationState, phone: string): Promise<{ result: string; orderId?: string }> {
  const store = getStore();
  switch (name) {
    case "search_products": {
      const hits = searchProducts(String(input.query ?? ""), 6);
      if (!hits.length) return { result: "Geen resultaten." };
      return { result: hits.map((h) => `${h.product.id} | ${h.product.nameNlShort} / ${h.product.name} | ${h.product.brand} | ${formatPackaging(h.product)} | score ${h.score.toFixed(1)}`).join("\n") };
    }
    case "update_draft": {
      const lines = (input.lines as OrderLine[]) ?? [];
      for (const l of lines) {
        if (!getProduct(l.productId)) continue;
        state.draft = state.draft.filter((d) => d.productId !== l.productId);
        if (l.cases > 0 || l.units > 0) state.draft.push({ productId: l.productId, cases: Math.floor(l.cases), units: Math.floor(l.units) });
      }
      return { result: draftText(state.draft, state.lang) };
    }
    case "show_draft":
      return { result: draftText(state.draft, state.lang) };
    case "lookup_customer": {
      const c = await store.getCustomerByPhone(phone);
      if (!c) return { result: "Onbekende klant (geen account gekoppeld aan dit nummer)." };
      state.customerId = c.id;
      const last = (await store.listOrders(c.id, 1))[0];
      return { result: `Zaak: ${c.company} (${c.contact}). Laatste bestelling: ${last ? draftText(last.lines, state.lang) : "geen"}` };
    }
    case "confirm_order": {
      if (!state.draft.length) return { result: "Concept is leeg; niets bevestigd." };
      const customer = state.customerId ? await store.getCustomerById(state.customerId) : await store.getCustomerByPhone(phone);
      const order = await store.createOrder({
        customerId: customer?.id ?? `wa:${phone}`,
        delivery: input.delivery === "depo" ? "depo" : "adres",
        lines: state.draft,
        note: typeof input.note === "string" && input.note ? input.note : undefined,
        status: "whatsapp",
        source: "whatsapp-agent",
      });
      state.draft = [];
      return { result: `Bestelling bewaard met id ${order.id}.`, orderId: order.id };
    }
    default:
      return { result: `Onbekend tool: ${name}` };
  }
}

/** Kural tabanlı yedek: API anahtarı yokken çalışır. */
export function fallbackReply(text: string, state: ConversationState): AgentReply {
  const lang = state.lang;
  const t = text.trim().toLowerCase();
  if (/^(ok|oke|ja|evet|tamam|bevestig|onayla|bevestigen)\b/.test(t) && state.draft.length) {
    const delivery = /afhal|depo|teslim al/.test(t) ? "depo" : "adres";
    return { text: lang === "nl" ? `Bedankt! Uw bestelling is genoteerd (${delivery === "depo" ? "afhaling, -15%" : "levering"}). Wij bevestigen prijs en leveringsmoment vandaag nog.` : `Teşekkürler! Siparişiniz alındı (${delivery === "depo" ? "depodan teslim, -%15" : "adrese teslimat"}). Fiyat ve teslimat saatini bugün onaylıyoruz.`, state: { ...state, draft: [] } };
  }
  const resolved = resolveOrder(text);
  if (!resolved.length) {
    return { text: lang === "nl" ? "Stuur uw bestelling als lijst, bv.: 5 colli kip döner 20kg, 2 dozen samurai 3L." : "Siparişinizi liste olarak yazın, örn.: 5 koli tavuk döner 20kg, 2 kutu samurai 3L.", state };
  }
  const questions: string[] = [];
  for (const r of resolved) {
    if (r.best && r.confident) {
      const p = r.best.product;
      state.draft = state.draft.filter((d) => d.productId !== p.id);
      state.draft.push({ productId: p.id, cases: r.line.unit === "koli" ? r.line.quantity : 0, units: r.line.unit === "adet" ? r.line.quantity : 0 });
    } else if (r.best) {
      const opts = [r.best, ...r.alternatives].slice(0, 3).map((m, i) => `${i + 1}) ${productName(m.product, lang)} ${formatPackaging(m.product)}`).join("  ");
      questions.push(lang === "nl" ? `Welke bedoelt u voor "${r.line.raw}"? ${opts}` : `"${r.line.raw}" için hangisi? ${opts}`);
    } else {
      questions.push(lang === "nl" ? `"${r.line.raw}" vond ik niet in de catalogus.` : `"${r.line.raw}" katalogda bulunamadı.`);
    }
  }
  const head = lang === "nl" ? "Conceptbestelling:" : "Taslak sipariş:";
  const foot = lang === "nl" ? "Klopt dit? Antwoord OK (levering) of OK afhaling (-15%)." : "Doğru mu? OK (teslimat) veya OK depo (-%15) yazın.";
  return { text: [head, draftText(state.draft, lang), ...questions, questions.length ? "" : foot].filter((s) => s !== undefined).join("\n"), state };
}

export async function handleIncoming(phone: string, text: string, name?: string): Promise<AgentReply> {
  const store = getStore();
  const existing = await store.getConversation(phone);
  const state: ConversationState = existing ?? { phone, lang: "nl", draft: [], history: [], updatedAt: new Date().toISOString() };
  state.lang = detectLang(text, state.lang);
  state.history = [...state.history.slice(-19), { role: "user", text, at: new Date().toISOString() }];

  let reply: AgentReply;
  if (!process.env.ANTHROPIC_API_KEY) {
    reply = fallbackReply(text, state);
  } else {
    reply = await claudeReply(phone, text, state, name);
  }
  reply.state.history = [...reply.state.history, { role: "assistant", text: reply.text, at: new Date().toISOString() }];
  await store.saveConversation(reply.state);
  return reply;
}

async function claudeReply(phone: string, text: string, state: ConversationState, name?: string): Promise<AgentReply> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [];
  // Son geçmiş: kısa bağlam (taslak zaten sistemde aktarılıyor)
  for (const h of state.history.slice(-8, -1)) messages.push({ role: h.role, content: h.text });
  messages.push({ role: "user", content: text });

  const context = `Klant: ${name ?? "onbekend"} (${phone}). Taal: ${state.lang}. Huidige conceptbestelling:\n${draftText(state.draft, state.lang)}`;
  let orderId: string | undefined;
  let finalText = "";

  for (let i = 0; i < 8; i++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: context }],
        tools,
        messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.APIConnectionError) {
        return fallbackReply(text, state);
      }
      throw err;
    }
    if (response.stop_reason === "refusal") return fallbackReply(text, state);
    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    finalText = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim() || finalText;
    if (response.stop_reason === "pause_turn") continue;
    if (!toolUses.length) break;
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const { result, orderId: oid } = await runTool(tu.name, tu.input as Record<string, unknown>, state, phone);
      if (oid) orderId = oid;
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }
    messages.push({ role: "user", content: results });
  }
  return { text: finalText || (state.lang === "nl" ? "Ik heb uw bericht ontvangen. Kan u uw bestelling als lijst sturen?" : "Mesajınızı aldım. Siparişinizi liste olarak yazabilir misiniz?"), state, orderId };
}
