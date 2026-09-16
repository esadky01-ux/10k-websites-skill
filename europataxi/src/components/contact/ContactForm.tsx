"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill, resolveKey } from "@/i18n/utils";
import { localizedPath } from "@/lib/paths";
import { LIMITS, contactSchema, contactSubjects, fieldErrorMap, issuesToFieldErrors } from "@/lib/validation";
import type { ApiErrorResponse, ContactSubject, ContactSuccessResponse, FieldError, Locale } from "@/types";

export type ContactFormDict = Pick<Dictionary, "contact" | "validation" | "common">;

interface ContactFormProps {
  locale: Locale;
  dict: ContactFormDict;
  /** Sunucu/ağ hatasında gösterilen telefon bağlantısı (site yapılandırmasından gelir). */
  phoneDisplay: string;
  phoneHref: string;
  ariaLabelledBy?: string;
}

interface ContactFormValues {
  name: string;
  email: string;
  phone: string;
  subject: ContactSubject | "";
  message: string;
  consent: boolean;
}

type FormStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  /** İstemci ya da sunucu alan hataları; hatalar alanların altında. */
  | { kind: "fields" }
  /** Ağ ya da sunucu hatası; mesaj Alert içinde. */
  | { kind: "failed"; message: string }
  | { kind: "success"; email: string };

const EMPTY_VALUES: ContactFormValues = { name: "", email: "", phone: "", subject: "", message: "", consent: false };

/** Odak sırası: ilk hatalı alana odaklanmak için. */
const FIELD_ORDER = ["name", "email", "phone", "subject", "message", "consent"] as const;

const fieldId = (path: string) => `contact-${path}`;

function isContactSubject(value: string): value is ContactSubject {
  return (contactSubjects as readonly string[]).includes(value);
}

function focusFirstError(errors: Record<string, string>) {
  const first = FIELD_ORDER.find((key) => errors[key]);
  if (first) document.getElementById(fieldId(first))?.focus();
}

/** Onay metnindeki "Gizlilik Politikası" ifadesini gizlilik sayfasına bağlar. */
function ConsentLabel({ text, linkText, href, newTabHint }: { text: string; linkText: string; href: string; newTabHint: string }) {
  const index = text.indexOf(linkText);
  const link = (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm font-bold text-taxi-ink underline underline-offset-2 hover:text-taxi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
 * İletişim formu. Önce istemcide `contactSchema` ile doğrular, sonra `/api/contact`'a JSON gönderir.
 * Başarıda formun yerine `role="status"` bir onay paneli gelir.
 */
export function ContactForm({ locale, dict, phoneDisplay, phoneHref, ariaLabelledBy }: ContactFormProps) {
  const { form, error, success } = dict.contact;
  const [values, setValues] = useState<ContactFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const successPanelRef = useRef<HTMLDivElement>(null);
  /** Durum değişiminden sonra odağın taşınacağı yer (yalnızca etkide okunur). */
  const pendingFocus = useRef<"panel" | "name" | null>(null);

  useEffect(() => {
    if (pendingFocus.current === "panel") successPanelRef.current?.focus();
    if (pendingFocus.current === "name") document.getElementById(fieldId("name"))?.focus();
    pendingFocus.current = null;
  }, [status]);

  const submitting = status.kind === "submitting";

  /** Alanı günceller ve o alanın hatasını temizler. */
  function update(patch: Partial<ContactFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  function translate(errors: FieldError[]): Record<string, string> {
    return fieldErrorMap(errors.map((e) => ({ path: e.path, message: resolveKey(dict, e.message) })));
  }

  function showFieldErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    setStatus({ kind: "fields" });
    focusFirstError(errors);
  }

  function reset() {
    setValues(EMPTY_VALUES);
    setFieldErrors({});
    pendingFocus.current = "name";
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = contactSchema.safeParse({ ...values, locale });
    if (!parsed.success) {
      showFieldErrors(translate(issuesToFieldErrors(parsed.error.issues)));
      return;
    }

    setFieldErrors({});
    setStatus({ kind: "submitting" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = (await response.json().catch(() => null)) as ApiErrorResponse | ContactSuccessResponse | null;

      if (response.status === 201 && json?.ok) {
        pendingFocus.current = "panel";
        setStatus({ kind: "success", email: parsed.data.email });
        return;
      }
      if (response.status === 400 && json && !json.ok) {
        // Sunucu mesajları zaten istek diline çevrilmiş gelir.
        const errors = fieldErrorMap(json.errors ?? []);
        if (Object.keys(errors).length > 0) showFieldErrors(errors);
        else setStatus({ kind: "failed", message: json.error });
        return;
      }
      setStatus({ kind: "failed", message: error.server });
    } catch {
      setStatus({ kind: "failed", message: error.network });
    }
  }

  if (status.kind === "success") {
    return (
      <div
        ref={successPanelRef}
        role="status"
        tabIndex={-1}
        className="scroll-mt-24 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink focus-visible:ring-offset-4 focus-visible:ring-offset-surface-2"
      >
        <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-taxi-ink" />
        <h2 className="mt-4 text-xl font-extrabold tracking-tight text-content">{success.title}</h2>
        <p className="mt-3 max-w-prose break-words text-base text-muted">{fill(success.description, { email: status.email })}</p>
        <Button variant="secondary" className="mt-8" onClick={reset}>
          {success.again}
        </Button>
      </div>
    );
  }

  const subjectOptions = contactSubjects.map((id) => ({ value: id, label: form.subjects[id] }));

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby={ariaLabelledBy} className="flex flex-col gap-5">
      <p className="text-sm text-muted">{form.requiredHint}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id={fieldId("name")}
          label={form.name}
          required
          autoComplete="name"
          maxLength={LIMITS.name.max}
          value={values.name}
          onChange={(event) => update({ name: event.target.value })}
          error={fieldErrors.name}
        />
        <Input
          id={fieldId("email")}
          type="email"
          label={form.email}
          required
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={(event) => update({ email: event.target.value })}
          error={fieldErrors.email}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id={fieldId("phone")}
          type="tel"
          label={form.phone}
          required
          autoComplete="tel"
          inputMode="tel"
          hint={form.phoneHint}
          value={values.phone}
          onChange={(event) => update({ phone: event.target.value })}
          error={fieldErrors.phone}
        />
        <Select
          id={fieldId("subject")}
          label={form.subject}
          required
          placeholder={form.subjectPlaceholder}
          options={subjectOptions}
          value={values.subject}
          onChange={(event) => update({ subject: isContactSubject(event.target.value) ? event.target.value : "" })}
          error={fieldErrors.subject}
        />
      </div>

      <Textarea
        id={fieldId("message")}
        label={form.message}
        required
        placeholder={form.messagePlaceholder}
        maxLength={LIMITS.message.max}
        rows={6}
        value={values.message}
        onChange={(event) => update({ message: event.target.value })}
        error={fieldErrors.message}
      />

      <Checkbox
        id={fieldId("consent")}
        required
        checked={values.consent}
        onChange={(event) => update({ consent: event.target.checked })}
        error={fieldErrors.consent}
        label={
          <ConsentLabel
            text={form.consent}
            linkText={form.consentLink}
            href={localizedPath(locale, "privacy")}
            newTabHint={dict.common.opensInNewTab}
          />
        }
      />

      {status.kind === "fields" ? (
        <Alert tone="error" title={error.title}>
          {error.fields}
        </Alert>
      ) : null}
      {status.kind === "failed" ? (
        <Alert tone="error" title={error.title}>
          {status.message}{" "}
          <a
            href={phoneHref}
            aria-label={`${dict.common.callUs}: ${phoneDisplay}`}
            className="whitespace-nowrap font-bold text-content underline underline-offset-2 hover:text-taxi-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink"
          >
            {phoneDisplay}
          </a>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting || undefined} className="sm:self-start">
        {submitting ? form.submitting : form.submit}
      </Button>
    </form>
  );
}
