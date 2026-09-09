/**
 * İstemci tarafı sesli asistan hatalarını sunucu loguna yazar (Vercel "Functions" logunda görünür).
 * Gövde: { where, name, message, stack?, ua? }
 */
import { NextResponse } from "next/server";
import { redactSecrets } from "@/server/voice/secrets";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pick = (k: string) => (typeof body[k] === "string" ? redactSecrets((body[k] as string).slice(0, 2000)) : "");
    console.error(`[voice-agent:client] ${pick("where")} → ${pick("name")}: ${pick("message")}\n  ua: ${pick("ua")}\n  ${pick("stack")}`);
  } catch {
    /* geçersiz gövde; sessizce geç */
  }
  return new NextResponse(null, { status: 204 });
}
