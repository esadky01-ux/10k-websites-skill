/**
 * Sesli sipariş asistanı beyni.
 *
 * Akış: tarayıcıda konuşma metne çevrilir → POST /api/voice-agent → bu modül Claude araç döngüsüyle
 * (search_products, add_to_cart, remove_from_cart, show_cart, open_cart) yanıt metni ve sepet
 * eylemlerini üretir → tarayıcı eylemleri gerçek sepete (addToCart) uygular ve yanıtı seslendirir.
 *
 * ANTHROPIC_API_KEY yoksa kural tabanlı yedek (resolveOrder) çalışır; böylece prototip anahtarsız da denenebilir.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getProduct, formatPackaging, productName, type Product } from "@/data/products";
import { resolveOrder, searchProducts, normalize } from "@/server/whatsapp/matcher";
import { ADDED_REPLY, VOICE_SYSTEM, type VoiceLang } from "./prompt";

export type VoiceCartLine = { productId: string; cases: number; units: number };
export type VoiceAction =
  | { type: "add"; productId: string; cases: number; units: number }
  | { type: "remove"; productId: string }
  | { type: "open_cart" };
export type VoiceHistoryItem = { role: "user" | "assistant"; text: string };
export type VoiceTurnInput = { transcript: string; lang: VoiceLang; history: VoiceHistoryItem[]; cart: VoiceCartLine[] };
export type VoiceTurnResult = { text: string; lang: VoiceLang; actions: VoiceAction[]; mode: "claude" | "fallback" };

const MODEL = process.env.VOICE_AGENT_MODEL ?? "claude-opus-5";

const KU = /\b(ez|tu|em|hûn|ew|dixwazim|dixwazin|bide|bidin|kerem|spas|çend|çiqas|qutî|bira|heval|silav|rojbaş|başe|baş|belê|na|hebe|tune|dikan|kar|goşt|nan|firotin|bikirim)\b/;
const NL = /\b(graag|bestellen|bestel|dozen|doos|stuks|alstublieft|bedankt|dank|goedemorgen|goeiedag|hallo|kaas|frieten|twee|drie|vier|vijf|nog|iets|baas|mandje|verwijder|toon)\b/;
const TR = /[çğışöü]|\b(koli|kutu|adet|lütfen|merhaba|selam|selamünaleyküm|abi|usta|sipariş|istiyorum|ekle|yaz|çıkar|sil|sepet|başka|tamam|evet|hayır)\b/;

/** Metnin dilini kaba işaretlerle tahmin eder; emin değilse önceki dili korur. */
export function detectVoiceLang(text: string, fallback: VoiceLang): VoiceLang {
  const t = text.toLowerCase();
  const ku = (t.match(KU) ?? []).length;
  const nl = (t.match(NL) ?? []).length;
  const tr = (t.match(TR) ?? []).length;
  if (ku && ku >= nl && ku >= tr && /\b(ez|dixwazim|spas|bira|silav|çend|qutî|rojbaş)\b/.test(t)) return "ku";
  if (nl > tr) return "nl";
  if (tr > 0) return "tr";
  return fallback;
}

function line(p: Product, lang: VoiceLang): string {
  return `${p.id} | ${productName(p, lang === "nl" ? "nl" : "tr")} | ${p.brand} | ${formatPackaging(p)}`;
}

function cartText(cart: VoiceCartLine[], lang: VoiceLang): string {
  if (!cart.length) return lang === "nl" ? "(leeg)" : lang === "ku" ? "(vala)" : "(boş)";
  return cart
    .map((l) => {
      const p = getProduct(l.productId);
      if (!p) return "";
      const unit = lang === "nl" ? ["colli", "stuks"] : lang === "ku" ? ["qutî", "heb"] : ["koli", "adet"];
      const qty = [l.cases ? `${l.cases} ${unit[0]}` : "", l.units ? `${l.units} ${unit[1]}` : ""].filter(Boolean).join(" + ");
      return `${productName(p, lang === "nl" ? "nl" : "tr")} (${formatPackaging(p)}) — ${qty}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Eylemleri sanal sepete uygular (aynı tur içinde show_cart doğru görünsün diye). */
export function applyActions(cart: VoiceCartLine[], actions: VoiceAction[]): VoiceCartLine[] {
  let next = cart.map((l) => ({ ...l }));
  for (const a of actions) {
    if (a.type === "add") {
      const ex = next.find((l) => l.productId === a.productId);
      if (ex) {
        ex.cases += a.cases;
        ex.units += a.units;
      } else next.push({ productId: a.productId, cases: a.cases, units: a.units });
    } else if (a.type === "remove") next = next.filter((l) => l.productId !== a.productId);
  }
  return next.filter((l) => l.cases > 0 || l.units > 0);
}

const tools: Anthropic.Tool[] = [
  {
    name: "search_products",
    description: "Katalogda ürün ara (Türkçe/Felemenkçe ad, marka, boyut). En iyi adayları id, ad, marka ve koli formatıyla döndürür.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Arama, örn. 'mayonez', 'kip doner 20kg', 'frieten'" } }, required: ["query"], additionalProperties: false },
    strict: true,
  },
  {
    name: "add_to_cart",
    description: "Ürünü müşterinin sepetine ekler (mevcut miktara ekler). productId yalnızca search_products sonucundan.",
    input_schema: {
      type: "object",
      properties: { productId: { type: "string" }, cases: { type: "integer", minimum: 0, description: "koli sayısı" }, units: { type: "integer", minimum: 0, description: "adet/paket sayısı" } },
      required: ["productId", "cases", "units"],
      additionalProperties: false,
    },
    strict: true,
  },
  { name: "remove_from_cart", description: "Ürünü sepetten çıkarır.", input_schema: { type: "object", properties: { productId: { type: "string" } }, required: ["productId"], additionalProperties: false }, strict: true },
  { name: "show_cart", description: "Sepetin güncel içeriğini döndürür.", input_schema: { type: "object", properties: {}, additionalProperties: false }, strict: true },
  { name: "open_cart", description: "Sitede sepet panelini açar; müşteri siparişi WhatsApp ile onaylamak istediğinde çağır.", input_schema: { type: "object", properties: {}, additionalProperties: false }, strict: true },
];

function runTool(name: string, input: Record<string, unknown>, ctx: { cart: VoiceCartLine[]; actions: VoiceAction[]; lang: VoiceLang }): string {
  switch (name) {
    case "search_products": {
      const hits = searchProducts(String(input.query ?? ""), 6);
      return hits.length ? hits.map((h) => `${line(h.product, ctx.lang)} | skor ${h.score.toFixed(1)}`).join("\n") : "Sonuç yok.";
    }
    case "add_to_cart": {
      const p = getProduct(String(input.productId));
      if (!p) return "Bilinmeyen ürün id.";
      const cases = Math.max(0, Math.floor(Number(input.cases) || 0));
      const units = Math.max(0, Math.floor(Number(input.units) || 0));
      if (!cases && !units) return "Miktar sıfır; eklenmedi.";
      ctx.actions.push({ type: "add", productId: p.id, cases, units });
      ctx.cart = applyActions(ctx.cart, [{ type: "add", productId: p.id, cases, units }]);
      return `Eklendi: ${line(p, ctx.lang)}. Sepet:\n${cartText(ctx.cart, ctx.lang)}`;
    }
    case "remove_from_cart": {
      const id = String(input.productId);
      ctx.actions.push({ type: "remove", productId: id });
      ctx.cart = applyActions(ctx.cart, [{ type: "remove", productId: id }]);
      return `Çıkarıldı. Sepet:\n${cartText(ctx.cart, ctx.lang)}`;
    }
    case "show_cart":
      return cartText(ctx.cart, ctx.lang);
    case "open_cart":
      ctx.actions.push({ type: "open_cart" });
      return "Sepet paneli açıldı.";
    default:
      return `Bilinmeyen araç: ${name}`;
  }
}

const FALLBACK: Record<VoiceLang, { empty: string; which: string; none: string; removed: string; cart: string; opened: string; greet: string; thanks: string; unknown: string }> = {
  tr: { empty: "Sepet şimdilik boş abi, ne yazayım?", which: "Hangisi abi", none: "Onu bulamadım abi, başka bir isimle söyler misin?", removed: "Çıkardım abi, başka ne lazım?", cart: "Sepette şunlar var abi", opened: "Sepeti açtım abi, WhatsApp ile onaya gönderebilirsin.", greet: "Aleykümselam abi, hayırlı işler! Söyle, ne yazayım?", thanks: "Rica ederim abi, hayırlı işler!", unknown: "Anlamadım abi, kaç koli ne yazayım?" },
  nl: { empty: "Het mandje is nog leeg baas, wat mag ik erop zetten?", which: "Welke bedoel je baas", none: "Die vind ik niet baas, zeg het eens anders?", removed: "Eraf gehaald baas, nog iets?", cart: "In het mandje zit", opened: "Mandje staat open baas, je kan het via WhatsApp bevestigen.", greet: "Dag baas, goeie zaken! Zeg maar, wat mag het zijn?", thanks: "Graag gedaan baas, goeie zaken!", unknown: "Niet goed verstaan baas, hoeveel dozen van wat?" },
  ku: { empty: "Sebet niha vala ye bira, ez çi binivîsim?", which: "Kîjan bira", none: "Min ew nedît bira, bi navekî din bibêje?", removed: "Min derxist bira, tiştekî din?", cart: "Di sebetê de ev hene bira", opened: "Min sebet vekir bira, tu dikarî bi WhatsApp bişînî.", greet: "Silav bira, kar bi xêr be! Bibêje, ez çi binivîsim?", thanks: "Ser çavan bira, kar bi xêr be!", unknown: "Min fêm nekir bira, çend qutî çi?" },
};

/** Kural tabanlı yedek: anahtarsız ortamda ve API hatasında çalışır. */
export function fallbackVoiceTurn(input: VoiceTurnInput): VoiceTurnResult {
  const lang = detectVoiceLang(input.transcript, input.lang);
  const f = FALLBACK[lang];
  const n = normalize(input.transcript);
  const actions: VoiceAction[] = [];
  const speak = (text: string): VoiceTurnResult => ({ text, lang, actions, mode: "fallback" });

  if (/^(selam|selamunaleykum|selamün|merhaba|hallo|dag|goeiedag|goedemorgen|silav|rojbas|hey)\b/.test(n) && n.length < 40) return speak(f.greet);
  if (/\b(tesekkur|sagol|saol|bedankt|dank|merci|spas)\b/.test(n)) return speak(f.thanks);
  if (/\b(sepeti ac|sepeti tamamla|siparisi tamamla|onaya gonder|mandje open|afronden|bevestig|sebet veke)\b/.test(n)) {
    actions.push({ type: "open_cart" });
    return speak(f.opened);
  }
  if (/\b(sepeti (goster|oku|soyle)|sepette ne var|toon (het )?mandje|wat zit er|sebet (nisan|bixwine))\b/.test(n)) {
    return speak(input.cart.length ? `${f.cart}: ${cartText(input.cart, lang).replace(/\n/g, ", ")}. ${ADDED_REPLY[lang].split(",")[1]?.trim() ?? ""}` : f.empty);
  }
  const removing = /\b(cikar|sil|kaldir|verwijder|haal .* eraf|derxe|jê bibe)\b/.test(n);
  if (removing) {
    const q = n.replace(/\b(cikar|sil|kaldir|verwijder|haal|eraf|derxe|sepetten|sepetimden|uit het mandje|je|bibe)\b/g, " ").replace(/\s+/g, " ").trim();
    const inCart = input.cart.map((l) => getProduct(l.productId)).filter((p): p is Product => !!p);
    const tokens = q.split(" ").filter((w) => w.length >= 4);
    const hit =
      searchProducts(q, 8).map((m) => m.product).find((p) => inCart.some((c) => c.id === p.id)) ??
      inCart.find((p) => tokens.some((w) => `${normalize(p.name)} ${normalize(p.nameNlShort)}`.split(" ").some((pw) => pw.startsWith(w.slice(0, 5)))));
    if (hit) {
      actions.push({ type: "remove", productId: hit.id });
      return speak(f.removed);
    }
    return speak(f.none);
  }

  const cleaned = input.transcript.replace(/\b(bana|lütfen|yaz|ekle|ekleyiver|koy|gönder|zet|erbij|erop|graag|alstublieft|bide|min re)\b/gi, " ").replace(/\s+/g, " ").trim();
  const resolved = resolveOrder(cleaned);
  if (!resolved.length) return speak(f.unknown);
  const questions: string[] = [];
  for (const r of resolved) {
    if (r.best && r.confident) {
      const cases = r.line.unit === "koli" ? r.line.quantity : 0;
      const units = r.line.unit === "adet" ? r.line.quantity : 0;
      actions.push({ type: "add", productId: r.best.product.id, cases, units });
    } else if (r.best) {
      const opts = [r.best, ...r.alternatives].slice(0, 3).map((m) => `${productName(m.product, lang === "nl" ? "nl" : "tr")} ${formatPackaging(m.product)}`);
      questions.push(`${f.which}: ${opts.join(lang === "nl" ? " of " : lang === "ku" ? " an " : " yoksa ")}?`);
    } else questions.push(f.none);
  }
  const parts = [actions.length ? ADDED_REPLY[lang] : "", ...questions].filter(Boolean);
  return speak(parts.join(" "));
}

export async function runVoiceTurn(input: VoiceTurnInput): Promise<VoiceTurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackVoiceTurn(input);
  const lang = detectVoiceLang(input.transcript, input.lang);
  const client = new Anthropic();
  const ctx = { cart: input.cart, actions: [] as VoiceAction[], lang };
  const messages: Anthropic.MessageParam[] = [];
  for (const h of input.history.slice(-10)) if (h.text.trim()) messages.push({ role: h.role, content: h.text });
  messages.push({ role: "user", content: input.transcript });
  const context = `Algılanan dil: ${lang}. Müşterinin sepeti şu an:\n${cartText(input.cart, lang)}`;
  let finalText = "";

  for (let i = 0; i < 6; i++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: [{ type: "text", text: VOICE_SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: context }],
        tools,
        messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.AuthenticationError) return fallbackVoiceTurn(input);
      throw err;
    }
    if (response.stop_reason === "refusal") return fallbackVoiceTurn(input);
    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    finalText = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ").trim() || finalText;
    if (response.stop_reason === "pause_turn") continue;
    if (!toolUses.length) break;
    const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => ({ type: "tool_result", tool_use_id: tu.id, content: runTool(tu.name, tu.input as Record<string, unknown>, ctx) }));
    messages.push({ role: "user", content: results });
  }
  return { text: finalText || ADDED_REPLY[lang], lang, actions: ctx.actions, mode: "claude" };
}
