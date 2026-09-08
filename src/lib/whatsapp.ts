import { getProduct, formatPackaging } from "@/data/products";
import { getCategory } from "@/data/categories";
import { site } from "@/lib/site";
import { CartLine, DeliveryType, DELIVERY_LABELS } from "@/lib/cart";

type Input = {
  lines: CartLine[];
  delivery: DeliveryType;
  company?: string;
  note?: string;
};

/** Sepeti düzenli bir toptancı fişi biçiminde WhatsApp mesajına çevirir. */
export function buildWhatsAppMessage({ lines, delivery, company, note }: Input) {
  const now = new Date();
  const date = now.toLocaleDateString("tr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("tr-BE", { hour: "2-digit", minute: "2-digit" });

  const rows: string[] = [];
  let totalCases = 0;
  let totalUnits = 0;
  let idx = 1;

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
    rows.push(`▪ *${cat?.name ?? catSlug}*`);
    for (const line of catLines) {
      const p = getProduct(line.productId)!;
      const parts: string[] = [];
      if (line.cases > 0) parts.push(`${line.cases} koli`);
      if (line.units > 0) parts.push(`${line.units} ${p.unitLabel.toLowerCase()}`);
      totalCases += line.cases;
      totalUnits += line.units;
      rows.push(
        `${idx}. ${p.name} — ${p.brand}\n   ${formatPackaging(p)} · SKU ${p.sku}\n   ➜ ${parts.join(" + ")}`
      );
      idx++;
    }
    rows.push("");
  }

  const totals: string[] = [];
  if (totalCases > 0) totals.push(`${totalCases} koli`);
  if (totalUnits > 0) totals.push(`${totalUnits} paket/adet`);

  const msg = [
    `🧾 *${site.name} — Sipariş Fişi*`,
    `📅 ${date} ${time}`,
    company ? `🏢 İşletme: ${company}` : null,
    `🚚 Teslimat: ${DELIVERY_LABELS[delivery]}`,
    delivery === "depo"
      ? `📍 Teslim noktası: ${site.address.full}`
      : null,
    "",
    "━━━━━━━━━━━━━━━━━━",
    ...rows,
    "━━━━━━━━━━━━━━━━━━",
    `📦 Toplam: ${totals.join(" + ")} · ${idx - 1} kalem`,
    delivery === "depo" ? `💰 Depodan teslim indirimi: %15 uygulanacak` : null,
    note ? `📝 Not: ${note}` : null,
    "",
    "Fiyat teklifi ve teslimat saati için onay bekliyorum. Teşekkürler!",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return msg;
}

export function whatsappUrl(message: string) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}
