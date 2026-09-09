import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getStore, type CustomerRecord } from "./store";

const COOKIE = "mx_session";
const ADMIN_COOKIE = "mx_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 gün

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] AUTH_SECRET tanımlı değil; geçici gizli anahtar kullanılıyor. Üretimde AUTH_SECRET ayarlayın.");
  }
  return "maximus-dev-secret-change-me";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

type SessionPayload = { sub: string; exp: number };

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(customerId: string): string {
  const payload: SessionPayload = { sub: customerId, exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(customerId: string) {
  const store = await cookies();
  store.set(COOKIE, createSessionToken(customerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function currentCustomer(): Promise<CustomerRecord | null> {
  const store = await cookies();
  const payload = readSessionToken(store.get(COOKIE)?.value);
  if (!payload) return null;
  const customer = await getStore().getCustomerById(payload.sub);
  return customer ?? null;
}

/** İstemciye gönderilecek güvenli profil (şifre özeti hariç). */
export function publicProfile(c: CustomerRecord) {
  const { passwordHash: _omit, ...rest } = c;
  void _omit;
  return rest;
}
export type PublicProfile = ReturnType<typeof publicProfile>;

// ───────────── Yönetici oturumu (ADMIN_PASSWORD ile) ─────────────
export function adminPasswordConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdminCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionToken("admin"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const payload = readSessionToken(store.get(ADMIN_COOKIE)?.value);
  return payload?.sub === "admin";
}
