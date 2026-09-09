import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { hashPassword, publicProfile, setSessionCookie } from "@/server/auth";

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const email = (body.email ?? "").toLowerCase().trim();
  const password = body.password ?? "";
  const company = (body.company ?? "").trim();
  const contact = (body.contact ?? "").trim();
  const phone = (body.phone ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !company || !contact || !phone) {
    return NextResponse.json({ error: "required" }, { status: 400 });
  }
  const store = getStore();
  if (await store.getCustomerByEmail(email)) {
    return NextResponse.json({ error: "exists" }, { status: 409 });
  }
  const customer = await store.createCustomer({
    email,
    passwordHash: hashPassword(password),
    company,
    vat: (body.vat ?? "").trim() || undefined,
    contact,
    phone,
    street: (body.street ?? "").trim() || undefined,
    postcode: (body.postcode ?? "").trim() || undefined,
    city: (body.city ?? "").trim() || undefined,
    country: (body.country ?? "BE").trim() || "BE",
    businessType: (body.businessType ?? "").trim() || undefined,
    lang: body.lang === "tr" ? "tr" : "nl",
  });
  await setSessionCookie(customer.id);
  return NextResponse.json({ customer: publicProfile(customer) }, { status: 201 });
}
