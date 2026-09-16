import { NextResponse } from "next/server";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";
import { SERVICE_TIME_ZONE, todayISO } from "@/lib/dates";
import { calculateQuote } from "@/lib/pricing";
import { generateBookingReference } from "@/lib/reference";
import { createBookingSchema, issuesToFieldErrors } from "@/lib/validation";
import type { ApiErrorResponse, BookingSuccessResponse, FieldError } from "@/types";

/** `generateBookingReference` node:crypto kullanır; Edge çalışma zamanında değil Node'da çalışsın. */
export const runtime = "nodejs";

const ERROR_PREFIX = "validation.";

/** Şema hata anahtarını (`validation.emailInvalid`) isteğin diline çevirir; yoksa anahtar kalır. */
function translate(validation: Dictionary["validation"], key: string): string {
  const messages: Record<string, string | undefined> = validation;
  const short = key.startsWith(ERROR_PREFIX) ? key.slice(ERROR_PREFIX.length) : key;
  return messages[short] ?? key;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Gövdedeki `locale` geçerliyse onu, değilse varsayılan dili kullanır. */
function requestLocale(body: unknown): Locale {
  const candidate = isPlainObject(body) ? body.locale : undefined;
  return typeof candidate === "string" && isLocale(candidate) ? candidate : defaultLocale;
}

function errorResponse(error: string, status: number, errors?: FieldError[]) {
  const payload: ApiErrorResponse = errors ? { ok: false, error, errors } : { ok: false, error };
  return NextResponse.json(payload, { status });
}

/**
 * POST /api/booking: JSON gövdeyi zod ile doğrular, fiyatı sunucuda yeniden hesaplar
 * (istemciden gelen fiyata güvenilmez) ve rezervasyon numarasıyla 201 döner.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const dict = await getDictionary(defaultLocale);
    return errorResponse(dict.validation.invalidJson, 400);
  }

  const locale = requestLocale(body);
  const dict = await getDictionary(locale);

  if (!isPlainObject(body)) {
    return errorResponse(dict.validation.invalidJson, 400);
  }

  const result = createBookingSchema(todayISO(SERVICE_TIME_ZONE)).safeParse(body);
  if (!result.success) {
    const errors = issuesToFieldErrors(result.error.issues).map((error) => ({
      path: error.path,
      message: translate(dict.validation, error.message),
    }));
    return errorResponse(dict.booking.error.fields, 400, errors);
  }

  try {
    const booking = result.data;
    const quote = calculateQuote({
      from: booking.trip.from,
      to: booking.trip.to,
      time: booking.trip.time,
      vehicle: booking.vehicle,
      returnTime: booking.trip.return?.time ?? null,
    });
    const reference = generateBookingReference();
    const receivedAt = new Date().toISOString();

    const response: BookingSuccessResponse = {
      ok: true,
      reference,
      booking: { ...booking, quote, receivedAt },
    };

    // Şimdilik yalnızca sunucu günlüğüne yazılır.
    console.log("[api/booking] yeni rezervasyon", JSON.stringify(response.booking));
    // Buraya e-posta servisi / CRM entegrasyonu eklenecek

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[api/booking] beklenmeyen hata", error);
    return errorResponse(dict.booking.error.server, 500);
  }
}
