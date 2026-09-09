import { NextResponse } from "next/server";
import { currentCustomer } from "@/server/auth";
import { getStore, type OrderLine } from "@/server/store";
import { getProduct } from "@/data/products";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ lists: await getStore().listSavedLists(customer.id) });
}

export async function POST(req: Request) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { name?: string; lines?: Partial<OrderLine>[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 60);
  const lines = (body.lines ?? [])
    .filter((l) => l && typeof l.productId === "string" && getProduct(l.productId))
    .map((l) => ({ productId: l.productId as string, cases: Math.max(0, Math.floor(Number(l.cases) || 0)), units: Math.max(0, Math.floor(Number(l.units) || 0)) }))
    .filter((l) => l.cases > 0 || l.units > 0);
  if (!name || !lines.length) return NextResponse.json({ error: "required" }, { status: 400 });
  const list = await getStore().saveList({ customerId: customer.id, name, lines });
  return NextResponse.json({ list }, { status: 201 });
}

export async function DELETE(req: Request) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "required" }, { status: 400 });
  await getStore().deleteList(customer.id, id);
  return NextResponse.json({ ok: true });
}
