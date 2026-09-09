import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = getStore();
  const [orders, customers] = await Promise.all([store.listAllOrders(50), store.listCustomers()]);
  const byId = new Map(customers.map((c) => [c.id, c.company]));
  return NextResponse.json({ orders: orders.map((o) => ({ ...o, company: byId.get(o.customerId) ?? o.customerId })) });
}
