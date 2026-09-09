import { NextResponse } from "next/server";
import { isAdmin, publicProfile } from "@/server/auth";
import { getStore, type CustomerRecord } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const customers = (await getStore().listCustomers()).map(publicProfile);
  return NextResponse.json({ customers });
}

/** Hesap durumunu günceller: { id, status: "approved" | "rejected" | "pending" } */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: string; status?: CustomerRecord["status"] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!body.id || !["approved", "rejected", "pending"].includes(body.status ?? "")) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const customer = await getStore().setCustomerStatus(body.id, body.status!);
  if (!customer) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ customer: publicProfile(customer) });
}
