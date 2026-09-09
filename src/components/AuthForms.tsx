"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { localePath } from "@/i18n/config";
import type { PublicProfile } from "@/server/auth";

const input = "w-full rounded-lg border border-cream-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-ink-800">{label}</span>
      {children}
    </label>
  );
}

export function LoginForm() {
  const { t, lang } = useI18n();
  const { setCustomer } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 401 ? t.auth.errorInvalid : t.auth.errorGeneric);
      return;
    }
    const data = (await res.json()) as { customer: PublicProfile };
    setCustomer(data.customer);
    router.push(localePath(lang, "account"));
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t.auth.email}><input name="email" type="email" autoComplete="email" required className={input} /></Field>
      <Field label={t.auth.password}><input name="password" type="password" autoComplete="current-password" required className={input} /></Field>
      {error && <p role="alert" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{t.auth.submitLogin}</button>
      <p className="text-center text-sm text-ink-500">
        {t.auth.noAccount} <Link href={localePath(lang, "register")} className="font-semibold text-brand-500 hover:text-brand-600">{t.auth.createOne}</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const { t, lang } = useI18n();
  const { setCustomer } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, lang }) });
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 409 ? t.auth.errorExists : res.status === 400 ? t.auth.errorRequired : t.auth.errorGeneric);
      return;
    }
    const data = (await res.json()) as { customer: PublicProfile };
    setCustomer(data.customer);
    router.push(localePath(lang, "account"));
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.auth.company + " *"}><input name="company" required className={input} /></Field>
        <Field label={t.auth.vat}><input name="vat" placeholder="BE0123.456.789" className={input} /></Field>
        <Field label={t.auth.contact + " *"}><input name="contact" required autoComplete="name" className={input} /></Field>
        <Field label={t.auth.phone + " *"}><input name="phone" type="tel" required autoComplete="tel" placeholder="+32 4xx xx xx xx" className={input} /></Field>
        <Field label={t.auth.businessType}>
          <select name="businessType" className={input} defaultValue={t.auth.businessTypes[0]}>
            {t.auth.businessTypes.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label={t.auth.country}>
          <select name="country" className={input} defaultValue="BE">
            <option value="BE">{lang === "nl" ? "België" : "Belçika"}</option>
            <option value="NL">{lang === "nl" ? "Nederland" : "Hollanda"}</option>
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label={t.auth.street}><input name="street" autoComplete="street-address" className={input} /></Field></div>
        <Field label={t.auth.postcode}><input name="postcode" autoComplete="postal-code" className={input} /></Field>
        <Field label={t.auth.city}><input name="city" autoComplete="address-level2" className={input} /></Field>
        <Field label={t.auth.email + " *"}><input name="email" type="email" required autoComplete="email" className={input} /></Field>
        <Field label={t.auth.password + " *"}><input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} /><span className="mt-1 block text-xs text-ink-500">{t.auth.passwordHint}</span></Field>
      </div>
      <p className="text-xs text-ink-500">{t.auth.terms}</p>
      {error && <p role="alert" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{t.auth.submitRegister}</button>
      <p className="text-center text-sm text-ink-500">
        {t.auth.hasAccount} <Link href={localePath(lang, "login")} className="font-semibold text-brand-500 hover:text-brand-600">{t.auth.loginLink}</Link>
      </p>
    </form>
  );
}
