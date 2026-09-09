import { getProduct, formatPackaging, productName, unitLabel } from "@/data/products";
import { getCategory } from "@/data/categories";
import { site } from "@/lib/site";
import type { CartLine, DeliveryType } from "@/lib/cart";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { formatEur } from "@/lib/format";

type Input = {
  lines: CartLine[];
  delivery: DeliveryType;
  company?: string;
  note?: string;
  lang: Locale;
  prices?: Record<string, number> | null;
  customerName?: string;
};

/** Sepeti düzenli bir toptancı fişi biçiminde WhatsApp mesajına çevirir. */
export function buildWhatsAppMessage({ lines, delivery, company, note, lang, prices, customerName }: Input) {
  const t = getDictionary(lang).whatsapp;
  const now = new Date();
  const locale = lang === "nl" ? "nl-BE" : "tr-TR";
  const date = now.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const rows: string[] = [];
  let totalCases = 0, totalUnits = 0, idx = 1, estimate = 0, priced = false;

  const grouped = new Map<string, CartLine[]>();
  for (const line of lines) {
    const p = getProduct(line.productId);
    if (!p) continue;
    const arr = grouped.get(p.category) ?? [];
    arr.push(line);
    grouped.set(p.category, arr);
  }

  for (const [catSlug, catLines] of grouped) {
    const cat = getCategory(catSlug);
    rows.push(`▪ *${cat?.name[lang] ?? catSlug}*`);
    for (const line of catLines) {
      const p = getProduct(line.productId)!;
      const parts: string[] = [];
      if (line.cases > 0) parts.push(`${line.cases} ${t.caseShort}`);
      if (line.units > 0) parts.push(`${line.units} ${unitLabel(p, lang)}`);
      totalCases += line.cases;
      totalUnits += line.units;
      const price = prices?.[p.id];
      let priceStr = "";
      if (price !== undefined) {
        priced = true;
        const lineTotal = line.cases * price + (line.units * price) / Math.max(1, p.unitsPerCase);
        estimate += lineTotal;
        priceStr = ` · ${formatEur(lineTotal, lang)}`;
      }
      const catalog = lang === "tr" && p.nameNl !== p.name ? `\n   ${p.nameNl}` : "";
      rows.push(`${idx}. ${productName(p, lang)} — ${p.brand}${catalog}\n   ${formatPackaging(p)}${p.sku !== "—" ? " · SKU " + p.sku : ""}\n   ➜ ${parts.join(" + ")}${priceStr}`);
      idx++;
    }
    rows.push("");
  }

  const totals: string[] = [];
  if (totalCases > 0) totals.push(`${totalCases} ${t.caseShort}`);
  if (totalUnits > 0) totals.push(`${totalUnits} ${t.unitsShort}`);
  const finalEstimate = delivery === "depo" ? estimate * (1 - site.pickupDiscount) : estimate;

  const msg = [
    `🧾 *${site.name} — ${t.receipt}*`,
    `📅 ${date} ${time}`,
    customerName ? `👤 ${t.customer}: ${customerName}` : null,
    company ? `🏢 ${t.company}: ${company}` : null,
    `🚚 ${t.delivery}: ${t.deliveryTypes[delivery]}`,
    delivery === "depo" ? `📍 ${t.pickupPoint}: ${site.address.full}` : null,
    "",
    "━━━━━━━━━━━━━━━━━━",
    ...rows,
    "━━━━━━━━━━━━━━━━━━",
    `📦 ${t.total}: ${totals.join(" + ")} · ${idx - 1} ${t.lines}`,
    priced ? `💶 ${t.estimate}: ${formatEur(finalEstimate, lang)}` : null,
    delivery === "depo" ? `💰 ${t.discountNote}` : null,
    note ? `📝 ${t.note}: ${note}` : null,
    "",
    t.closing,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return msg;
}

export function whatsappUrl(message: string) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}
