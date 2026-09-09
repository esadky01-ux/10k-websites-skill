import { NextResponse } from "next/server";
import { adminPasswordConfigured, clearAdminCookie, setAdminCookie, verifyAdminPassword } from "@/server/auth";

export async function POST(req: Request) {
  if (!adminPasswordConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!verifyAdminPassword(body.password ?? "")) return NextResponse.json({ error: "invalid" }, { status: 401 });
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
