"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { Button, Checkbox, Input, Textarea } from "@/components/ui";
import type { Dictionary } from "@/i18n/getDictionary";
import { localizedPath } from "@/lib/paths";
import { LIMITS } from "@/lib/validation";
import type { Locale } from "@/types";

export type PassengerFormDict = Pick<Dictionary, "booking" | "common">;

export interface PassengerFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  flightNumber: string;
  note: string;
  consent: boolean;
}

export const EMPTY_PASSENGER: PassengerFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  flightNumber: "",
  note: "",
  consent: false,
};

/** Alan hatası anahtarı (`customer.email`) → alan id'si (`booking-email`). */
export function passengerFieldId(path: string): string {
  return `booking-${path.split(".").pop() ?? path}`;
}

interface PassengerFormProps {
  locale: Locale;
  dict: PassengerFormDict;
  values: PassengerFormValues;
  onChange: (patch: Partial<PassengerFormValues>) => void;
  /** `customer.email` gibi anahtarlarla çevrilmiş hata metinleri. */
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Gönder düğmesinin hemen üstünde gösterilecek durum mesajı (Alert). */
  status?: ReactNode;
  ariaLabelledBy?: string;
}

/** Onay metnindeki "Gizlilik Politikası" ifadesini bağlantıya çevirir. */
function ConsentLabel({ text, linkText, href, newTabHint }: { text: string; linkText: string; href: string; newTabHint: string }) {
  const index = text.indexOf(linkText);
  const link = (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-taxi underline underline-offset-2 hover:text-taxi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
    >
      {linkText}
      <span className="sr-only"> ({newTabHint})</span>
    </Link>
  );
  if (index === -1) {
    return (
      <>
        {text} {link}
      </>
    );
  }
  return (
    <>
      {text.slice(0, index)}
      {link}
      {text.slice(index + linkText.length)}
    </>
  );
}

/**
 * Yolcu bilgileri formu. Doğrulama ve gönderim üst bileşende (BookingFlow) yapılır;
 * bu bileşen yalnızca alanları, hataları ve gönder düğmesini çizer.
 */
export function PassengerForm({ locale, dict, values, onChange, fieldErrors, submitting, onSubmit, status, ariaLabelledBy }: PassengerFormProps) {
  const form = dict.booking.form;
  const errorFor = (path: string) => fieldErrors[path];
  const optional = (label: string) => `${label} (${dict.common.optional})`;

  return (
    <form noValidate onSubmit={onSubmit} aria-labelledby={ariaLabelledBy} className="flex flex-col gap-5">
      <p className="text-sm text-muted">{form.requiredHint}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id={passengerFieldId("customer.firstName")}
          label={form.firstName}
          required
          autoComplete="given-name"
          maxLength={LIMITS.name.max}
          value={values.firstName}
          onChange={(event) => onChange({ firstName: event.target.value })}
          error={errorFor("customer.firstName")}
        />
        <Input
          id={passengerFieldId("customer.lastName")}
          label={form.lastName}
          required
          autoComplete="family-name"
          maxLength={LIMITS.name.max}
          value={values.lastName}
          onChange={(event) => onChange({ lastName: event.target.value })}
          error={errorFor("customer.lastName")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id={passengerFieldId("customer.email")}
          type="email"
          label={form.email}
          required
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={(event) => onChange({ email: event.target.value })}
          error={errorFor("customer.email")}
        />
        <Input
          id={passengerFieldId("customer.phone")}
          type="tel"
          label={form.phone}
          required
          autoComplete="tel"
          inputMode="tel"
          hint={form.phoneHint}
          value={values.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          error={errorFor("customer.phone")}
        />
      </div>

      <Input
        id={passengerFieldId("customer.flightNumber")}
        label={optional(form.flightNumber)}
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={LIMITS.flightNumber.max}
        hint={form.flightNumberHint}
        value={values.flightNumber}
        onChange={(event) => onChange({ flightNumber: event.target.value })}
        error={errorFor("customer.flightNumber")}
        wrapperClassName="sm:max-w-xs"
      />

      <Textarea
        id={passengerFieldId("customer.note")}
        label={optional(form.note)}
        placeholder={form.notePlaceholder}
        maxLength={LIMITS.note.max}
        rows={4}
        value={values.note}
        onChange={(event) => onChange({ note: event.target.value })}
        error={errorFor("customer.note")}
      />

      <Checkbox
        id={passengerFieldId("customer.consent")}
        required
        checked={values.consent}
        onChange={(event) => onChange({ consent: event.target.checked })}
        error={errorFor("customer.consent")}
        label={
          <ConsentLabel
            text={form.consent}
            linkText={form.consentLink}
            href={localizedPath(locale, "privacy")}
            newTabHint={dict.common.opensInNewTab}
          />
        }
      />

      {status}

      <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting || undefined} className="sm:self-start">
        {submitting ? form.submitting : form.submit}
      </Button>
    </form>
  );
}
