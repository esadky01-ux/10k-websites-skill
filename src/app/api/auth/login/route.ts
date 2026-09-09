import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { publicProfile, setSessionCookie, verifyPassword } from "@/server/auth";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const customer = await getStore().getCustomerByEmail(body.email ?? "");
  if (!customer || !verifyPassword(body.password ?? "", customer.passwordHash)) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  await setSessionCookie(customer.id);
  return NextResponse.json({ customer: publicProfile(customer) });
}
