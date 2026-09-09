import { NextResponse } from "next/server";
import { currentCustomer } from "@/server/auth";
import { getPricesForCustomer } from "@/server/prices";

export const dynamic = "force-dynamic";

/** Fiyatlar yalnızca giriş yapmış müşterilere döner. */
export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ prices: getPricesForCustomer(customer.pricelist), currency: "EUR" }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
