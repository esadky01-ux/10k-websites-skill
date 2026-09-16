import type { Metadata } from "next";
import { BookingFlow, type BookingFlowDict } from "@/components/booking/BookingFlow";
import { Alert, ButtonLink, SectionHeading } from "@/components/ui";
import { checkCapacity, getVehicle } from "@/data/fleet";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";
import { parseTripParams } from "@/lib/booking-params";
import { SERVICE_TIME_ZONE, todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/metadata";
import { resolveLocale, type PageProps } from "@/lib/page";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";
import { VEHICLE_PARAM_KEY } from "@/lib/widget-events";
import type { FieldError, Locale, VehicleId } from "@/types";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  return pageMetadata({
    locale,
    page: "booking",
    title: dict.meta.booking.title,
    description: dict.meta.booking.description,
    siteName: dict.meta.siteName,
    noIndex: true,
  });
}

const ERROR_PREFIX = "validation.";

/** Sorgu doğrulama hatasını (`validation.pastDate`) sözlükten çevirir. */
function translate(validation: Dictionary["validation"], key: string): string {
  const messages: Record<string, string | undefined> = validation;
  const short = key.startsWith(ERROR_PREFIX) ? key.slice(ERROR_PREFIX.length) : key;
  return messages[short] ?? key;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Rota parametreleri eksik ya da geçersizse: açıklama, hata listesi ve widget'a dönüş. */
function InvalidParams({ locale, dict, errors }: { locale: Locale; dict: Dictionary; errors: FieldError[] }) {
  const messages = Array.from(new Set(errors.map((error) => translate(dict.validation, error.message))));
  return (
    <section className="container py-16 md:py-24">
      <SectionHeading as="h1" level="page" eyebrow={dict.booking.eyebrow} title={dict.booking.invalidParams.title} />
      <Alert tone="error" className="mt-8 max-w-prose">
        <p>{dict.booking.invalidParams.description}</p>
        {messages.length ? (
          <ul className="mt-2 list-disc pl-5">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </Alert>
      <ButtonLink href={localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID })} className="mt-8">
        {dict.booking.invalidParams.button}
      </ButtonLink>
    </section>
  );
}

/**
 * Rezervasyon sayfası: widget'tan gelen sorguyu sunucuda doğrular, geçerliyse
 * araç seçimi ve yolcu formunu (istemci bileşeni) çizer. Arama motorlarına kapalıdır.
 */
export default async function BookingPage({ params, searchParams }: PageProps) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  const today = todayISO(SERVICE_TIME_ZONE);
  const query = (await searchParams) ?? {};
  const parsed = parseTripParams(query, today);

  if (!parsed.ok) {
    return <InvalidParams locale={locale} dict={dict} errors={parsed.errors} />;
  }

  const { trip } = parsed;
  const requested = getVehicle(firstValue(query[VEHICLE_PARAM_KEY]));
  const initialVehicle: VehicleId | null =
    requested && checkCapacity(requested, trip.passengers, trip.luggage).ok ? requested.id : null;

  const flowDict: BookingFlowDict = {
    booking: dict.booking,
    fleet: dict.fleet,
    validation: dict.validation,
    common: dict.common,
    locations: dict.locations,
  };

  return (
    <section className="container py-16 md:py-24">
      <BookingFlow locale={locale} dict={flowDict} trip={trip} initialVehicle={initialVehicle} today={today} />
    </section>
  );
}
