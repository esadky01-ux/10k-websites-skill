import { NextResponse } from "next/server";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";
import { resolveKey } from "@/i18n/utils";
import { contactSchema, issuesToFieldErrors } from "@/lib/validation";
import type { ApiErrorResponse, ContactSuccessResponse, FieldError } from "@/types";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** İstek gövdesindeki `locale`; geçersiz ya da yoksa varsayılan dil. */
function localeOf(body: Record<string, unknown>): Locale {
  const value = body.locale;
  return typeof value === "string" && isLocale(value) ? value : defaultLocale;
}

/** `validation.emailInvalid` gibi anahtarları kullanıcı diline çevirir; anahtar yoksa olduğu gibi bırakır. */
function translateErrors(dict: Dictionary, errors: FieldError[]): FieldError[] {
  return errors.map((error) => ({ path: error.path, message: resolveKey(dict, error.message) }));
}

function errorResponse(body: ApiErrorResponse, status: number) {
  return NextResponse.json<ApiErrorResponse>(body, { status });
}

/**
 * POST /api/contact: JSON gövdeyi zod ile doğrular.
 * 400 → alan bazlı, çevrilmiş hata listesi; 201 → alındı bilgisi.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  if (!isRecord(body)) {
    const dict = await getDictionary(defaultLocale);
    return errorResponse({ ok: false, error: dict.validation.invalidJson }, 400);
  }

  const dict = await getDictionary(localeOf(body));
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      { ok: false, error: dict.contact.error.fields, errors: translateErrors(dict, issuesToFieldErrors(result.error.issues)) },
      400,
    );
  }

  const receivedAt = new Date().toISOString();
  // Veritabanı yok: mesaj şimdilik sunucu günlüğüne yazılır.
  console.log("[contact]", JSON.stringify({ ...result.data, receivedAt }));
  // Buraya e-posta servisi / CRM entegrasyonu eklenecek

  return NextResponse.json<ContactSuccessResponse>({ ok: true, receivedAt }, { status: 201 });
}
