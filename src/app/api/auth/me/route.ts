import { NextResponse } from "next/server";
import { currentCustomer, publicProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await currentCustomer();
  return NextResponse.json({ customer: customer ? publicProfile(customer) : null });
}
