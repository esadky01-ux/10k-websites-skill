import { NextResponse } from "next/server";
import { currentCustomer } from "@/server/auth";
import { getStore, type OrderLine } from "@/server/store";
import { getProduct } from "@/data/products";
import { priceOf } from "@/server/prices";

export const dynamic = "force-dynamic";

function sanitizeLines(input: unknown): OrderLine[] {
  if (!Array.isArray(input)) return [];
  const out: OrderLine[] = [];
  for (const l of input as Partial<OrderLine>[]) {
    if (!l || typeof l.productId !== "string" || !getProduct(l.productId)) continue;
    const cases = Math.max(0, Math.floor(Number(l.cases) || 0));
    const units = Math.max(0, Math.floor(Number(l.units) || 0));
    if (cases === 0 && units === 0) continue;
    out.push({ productId: l.productId, cases, units });
  }
  return out;
}

export function estimateExclVat(lines: OrderLine[], delivery: "adres" | "depo"): number | undefined {
  let sum = 0, priced = 0;
  for (const l of lines) {
    const p = getProduct(l.productId);
    const price = priceOf(l.productId);
    if (!p || price === undefined) continue;
    priced++;
    sum += l.cases * price + (l.units * price) / Math.max(1, p.unitsPerCase);
  }
  if (!priced) return undefined;
  return Math.round((delivery === "depo" ? sum * 0.85 : sum) * 100) / 100;
}

export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orders = await getStore().listOrders(customer.id, 20);
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { lines?: unknown; delivery?: string; note?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const lines = sanitizeLines(body.lines);
  if (!lines.length) return NextResponse.json({ error: "empty" }, { status: 400 });
  const delivery = body.delivery === "depo" ? "depo" : "adres";
  const order = await getStore().createOrder({
    customerId: customer.id,
    delivery,
    lines,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
    status: "whatsapp",
    source: "web",
    estimateExclVat: estimateExclVat(lines, delivery),
  });
  return NextResponse.json({ order }, { status: 201 });
}
