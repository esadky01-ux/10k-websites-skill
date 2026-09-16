"use client";

import { Phone } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Alert, ButtonLink, SectionHeading } from "@/components/ui";
import { suitableVehicles } from "@/data/fleet";
import type { Dictionary } from "@/i18n/getDictionary";
import { calculateQuote } from "@/lib/pricing";
import { site } from "@/lib/site";
import { createBookingSchema, fieldErrorMap, issuesToFieldErrors } from "@/lib/validation";
import type { ApiErrorResponse, BookingPayload, BookingSuccessResponse, FieldError, Locale, Trip, VehicleId } from "@/types";
import { BookingSuccess } from "./BookingSuccess";
import { BookingSummary } from "./BookingSummary";
import { EMPTY_PASSENGER, PassengerForm, passengerFieldId, type PassengerFormValues } from "./PassengerForm";
import { RouteSummary } from "./RouteSummary";
import { VehicleSelector, firstSelectableVehicleId } from "./VehicleSelector";

export type BookingFlowDict = Pick<Dictionary, "booking" | "fleet" | "validation" | "common" | "locations">;

export interface BookingFlowProps {
  locale: Locale;
  dict: BookingFlowDict;
  /** Sunucuda doğrulanmış rota. */
  trip: Trip;
  /** `?vehicle=` ile gelen ve kapasiteye uyan araç; yoksa `null`. */
  initialVehicle: VehicleId | null;
  /** Sunucudan gelen bugünün tarihi (YYYY-MM-DD); istemci doğrulaması için. */
  today: string;
}

type FlowStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; result: BookingSuccessResponse }
  | { kind: "error"; reason: "fields" | "network" | "server" };

const ERROR_PREFIX = "validation.";

/** Hata anahtarlarını (`validation.emailInvalid`) kullanıcı diline çevirir; yoksa anahtar kalır. */
function translateErrors(validation: Dictionary["validation"], errors: FieldError[]): Record<string, string> {
  const messages: Record<string, string | undefined> = validation;
  return fieldErrorMap(
    errors.map((error) => {
      const short = error.message.startsWith(ERROR_PREFIX) ? error.message.slice(ERROR_PREFIX.length) : error.message;
      return { path: error.path, message: messages[short] ?? error.message };
    }),
  );
}

/** Hata varsa odaklanacak ilk alanın görsel sırası. */
const FOCUS_ORDER = [
  "vehicle",
  "customer.firstName",
  "customer.lastName",
  "customer.email",
  "customer.phone",
  "customer.flightNumber",
  "customer.note",
  "customer.consent",
] as const;

function focusFirstError(errors: Record<string, string>, trip: Trip) {
  const first = FOCUS_ORDER.find((key) => key in errors);
  if (!first) return;
  const id = first === "vehicle" ? firstSelectableVehicleId(trip) : passengerFieldId(first);
  if (id) document.getElementById(id)?.focus();
}

function StepHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-content">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-taxi text-base text-on-taxi">
        {number}
      </span>
      <span>
        <span className="sr-only">{number}. </span>
        {title}
      </span>
    </h2>
  );
}

/**
 * Rezervasyon akışı: rota özeti → araç seçimi → yolcu bilgileri → onay.
 * Doğrulama önce istemcide (`createBookingSchema`), sonra `POST /api/booking` ile sunucuda yapılır.
 */
export function BookingFlow({ locale, dict, trip, initialVehicle, today }: BookingFlowProps) {
  const [vehicle, setVehicle] = useState<VehicleId | null>(initialVehicle);
  const [form, setForm] = useState<PassengerFormValues>(EMPTY_PASSENGER);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<FlowStatus>({ kind: "idle" });

  const available = useMemo(() => suitableVehicles(trip.passengers, trip.luggage), [trip.passengers, trip.luggage]);
  const quote = useMemo(
    () =>
      vehicle
        ? calculateQuote({ from: trip.from, to: trip.to, time: trip.time, vehicle, returnTime: trip.return?.time ?? null })
        : null,
    [trip, vehicle],
  );

  function clearErrors(...keys: string[]) {
    setFieldErrors((prev) => {
      if (!keys.some((key) => key in prev)) return prev;
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function selectVehicle(id: VehicleId) {
    setVehicle(id);
    clearErrors("vehicle");
  }

  function updateForm(patch: Partial<PassengerFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
    clearErrors(...Object.keys(patch).map((key) => `customer.${key}`));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = { trip, vehicle, customer: form, locale };
    const parsed = createBookingSchema(today).safeParse(candidate);
    if (!parsed.success) {
      const errors = translateErrors(dict.validation, issuesToFieldErrors(parsed.error.issues));
      setFieldErrors(errors);
      setStatus({ kind: "error", reason: "fields" });
      focusFirstError(errors, trip);
      return;
    }

    const payload: BookingPayload = parsed.data;
    setFieldErrors({});
    setStatus({ kind: "submitting" });
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 201) {
        const result = (await response.json()) as BookingSuccessResponse;
        setStatus({ kind: "success", result });
        return;
      }
      if (response.status === 400) {
        const body = (await response.json()) as ApiErrorResponse;
        const errors = fieldErrorMap(body.errors ?? []);
        setFieldErrors(errors);
        setStatus({ kind: "error", reason: "fields" });
        focusFirstError(errors, trip);
        return;
      }
      setStatus({ kind: "error", reason: "server" });
    } catch {
      setStatus({ kind: "error", reason: "network" });
    }
  }

  if (status.kind === "success") {
    return <BookingSuccess locale={locale} dict={dict} result={status.result} />;
  }

  // Rota alanlarına ait hatalar (ör. gece yarısı geçtiyse tarih) formda alanı olmadığından listede gösterilir.
  const tripErrors = Object.entries(fieldErrors).filter(([key]) => key.startsWith("trip."));
  const submitting = status.kind === "submitting";

  const statusAlert =
    status.kind === "error" ? (
      <Alert tone="error" title={dict.booking.error.title}>
        {status.reason === "fields" ? (
          <>
            <p>{dict.booking.error.fields}</p>
            {tripErrors.length ? (
              <ul className="mt-2 list-disc pl-5">
                {tripErrors.map(([key, message]) => (
                  <li key={key}>{message}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : status.reason === "network" ? (
          <p>{dict.booking.error.network}</p>
        ) : (
          <p>
            {dict.booking.error.server}{" "}
            <a href={site.phone.href} className="font-bold text-taxi-ink underline underline-offset-2 hover:text-taxi-dark">
              {site.phone.display}
            </a>
          </p>
        )}
      </Alert>
    ) : null;

  return (
    <div>
      <SectionHeading as="h1" level="page" eyebrow={dict.booking.eyebrow} title={dict.booking.title} />

      <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-12">
        <div className="flex flex-col gap-12 lg:col-span-2">
          <RouteSummary locale={locale} dict={dict} trip={trip} />

          {available.length === 0 ? (
            <section aria-labelledby="booking-no-vehicle" className="rounded-lg border border-taxi-ink bg-surface-2 p-6 md:p-8">
              <h2 id="booking-no-vehicle" className="text-xl font-extrabold tracking-tight text-content">
                {dict.booking.noVehicle.title}
              </h2>
              <p className="mt-3 max-w-prose text-muted">{dict.booking.noVehicle.description}</p>
              <ButtonLink href={site.phone.href} className="mt-6">
                <Phone aria-hidden="true" className="h-5 w-5" />
                {dict.common.callUs}: {site.phone.display}
              </ButtonLink>
            </section>
          ) : (
            <>
              <section aria-labelledby="booking-step-vehicle" className="flex flex-col gap-6">
                <StepHeading id="booking-step-vehicle" number={1} title={dict.booking.steps.vehicle} />
                <VehicleSelector
                  locale={locale}
                  dict={dict}
                  trip={trip}
                  value={vehicle}
                  onChange={selectVehicle}
                  error={fieldErrors.vehicle}
                />
              </section>

              <section aria-labelledby="booking-step-passenger" className="flex flex-col gap-6">
                <StepHeading id="booking-step-passenger" number={2} title={dict.booking.steps.passenger} />
                <PassengerForm
                  locale={locale}
                  dict={dict}
                  values={form}
                  onChange={updateForm}
                  fieldErrors={fieldErrors}
                  submitting={submitting}
                  onSubmit={onSubmit}
                  status={statusAlert}
                  ariaLabelledBy="booking-step-passenger"
                />
              </section>
            </>
          )}
        </div>

        <aside className="lg:col-span-1">
          <BookingSummary locale={locale} dict={dict} trip={trip} vehicle={vehicle} quote={quote} className="lg:sticky lg:top-24" />
        </aside>
      </div>
    </div>
  );
}
