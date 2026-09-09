"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, X, RotateCcw, LogOut, Users, Package, Clock } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDate, formatEur } from "@/lib/format";
import type { PublicProfile } from "@/server/auth";
import type { OrderRecord } from "@/server/store";

type AdminOrder = OrderRecord & { company: string };

export default function AdminPanel() {
  const { lang, t } = useI18n();
  const ta = t.admin;
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<PublicProfile[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  const load = useCallback(async () => {
    const [c, o] = await Promise.all([fetch("/api/admin/customers", { cache: "no-store" }), fetch("/api/admin/orders", { cache: "no-store" })]);
    if (c.status === 401) return null;
    return {
      customers: c.ok ? ((await c.json()) as { customers: PublicProfile[] }).customers : [],
      orders: o.ok ? ((await o.json()) as { orders: AdminOrder[] }).orders : [],
    };
  }, []);

  const apply = useCallback((data: { customers: PublicProfile[]; orders: AdminOrder[] } | null) => {
    if (!data) {
      setAuthed(false);
      return;
    }
    setCustomers(data.customers);
    setOrders(data.orders);
    setAuthed(true);
  }, []);

  useEffect(() => {
    let alive = true;
    load().then((data) => alive && apply(data));
    return () => {
      alive = false;
    };
  }, [load, apply]);

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: form.get("password") }) });
    if (!res.ok) {
      setError(res.status === 503 ? ta.notConfigured : ta.invalid);
      return;
    }
    apply(await load());
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const res = await fetch("/api/admin/customers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (res.ok) {
      const { customer } = (await res.json()) as { customer: PublicProfile };
      setCustomers((cs) => cs.map((c) => (c.id === id ? customer : c)));
    }
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  };

  if (authed === null) return <p className="py-20 text-center text-ink-500">…</p>;

  if (!authed) {
    return (
      <form onSubmit={login} className="max-w-sm space-y-4 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-ink-900">{ta.loginTitle}</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink-800">{ta.password}</span>
          <input name="password" type="password" required autoComplete="current-password" className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>}
        <button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600">{ta.submit}</button>
      </form>
    );
  }

  const pending = customers.filter((c) => c.status === "pending");
  const badge = (s: PublicProfile["status"]) => (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s === "approved" ? "bg-wa/15 text-wa-dark" : s === "pending" ? "bg-gold-500/20 text-yellow-800" : "bg-brand-50 text-brand-700"}`}>{t.account.statusLabel[s]}</span>
  );
  const actions = (c: PublicProfile) => (
    <div className="flex flex-wrap gap-1.5">
      {c.status !== "approved" && <button type="button" onClick={() => setStatus(c.id, "approved")} className="inline-flex items-center gap-1 rounded-full bg-wa px-3 py-1.5 text-xs font-bold text-white hover:bg-wa-dark" data-testid={`approve-${c.id}`}><Check className="h-3.5 w-3.5" />{ta.approve}</button>}
      {c.status !== "rejected" && <button type="button" onClick={() => setStatus(c.id, "rejected")} className="inline-flex items-center gap-1 rounded-full border border-brand-500 px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-50"><X className="h-3.5 w-3.5" />{ta.reject}</button>}
      {c.status !== "pending" && <button type="button" onClick={() => setStatus(c.id, "pending")} className="inline-flex items-center gap-1 rounded-full border border-cream-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"><RotateCcw className="h-3.5 w-3.5" />{ta.reset}</button>}
    </div>
  );
  const renderCustomerTable = (rows: PublicProfile[]) =>
    rows.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-cream-200 bg-white p-6 text-sm text-ink-500">{ta.none}</p>
    ) : (
      <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-cream-100 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <tr><th className="px-4 py-3">{ta.columns.company}</th><th className="px-4 py-3">{ta.columns.contact}</th><th className="px-4 py-3">{ta.columns.phone}</th><th className="px-4 py-3">{ta.columns.email}</th><th className="px-4 py-3">{ta.registered}</th><th className="px-4 py-3">{ta.columns.status}</th><th className="px-4 py-3">{ta.columns.actions}</th></tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3"><p className="font-semibold text-ink-900">{c.company}</p>{c.vat && <p className="text-xs text-ink-500">{c.vat}</p>}{(c.city || c.street) && <p className="text-xs text-ink-500">{[c.street, [c.postcode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>}{c.businessType && <p className="text-xs text-ink-500">{c.businessType}</p>}</td>
                <td className="px-4 py-3">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-3"><a href={`https://wa.me/${c.phone.replace(/[^\d]/g, "").replace(/^0/, "32")}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{c.phone}</a></td>
                <td className="px-4 py-3"><a href={`mailto:${c.email}`} className="text-brand-600 hover:underline">{c.email}</a></td>
                <td className="px-4 py-3 text-ink-500">{formatDate(c.createdAt, lang)}</td>
                <td className="px-4 py-3">{badge(c.status)}</td>
                <td className="px-4 py-3">{actions(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          <span className="rounded-full bg-gold-500/20 px-3 py-1 font-semibold text-yellow-800">{pending.length} {ta.pending.toLowerCase()}</span>
          <span className="rounded-full bg-cream-100 px-3 py-1 font-semibold text-ink-700">{customers.length} {ta.allCustomers.toLowerCase()}</span>
        </div>
        <button type="button" onClick={logout} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-500"><LogOut className="h-4 w-4" />{ta.logout}</button>
      </div>
      <section>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink-900"><Clock className="h-5 w-5 text-gold-500" />{ta.pending}</h2>
        <div className="mt-3">{renderCustomerTable(pending)}</div>
      </section>
      <section>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink-900"><Users className="h-5 w-5 text-brand-500" />{ta.allCustomers}</h2>
        <div className="mt-3">{renderCustomerTable(customers)}</div>
      </section>
      <section>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink-900"><Package className="h-5 w-5 text-brand-500" />{ta.orders}</h2>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-cream-200 bg-white p-6 text-sm text-ink-500">{ta.noOrders}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-cream-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-cream-100 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                <tr><th className="px-4 py-3">{ta.columns.date}</th><th className="px-4 py-3">{ta.columns.company}</th><th className="px-4 py-3">{ta.columns.lines}</th><th className="px-4 py-3">{ta.columns.delivery}</th><th className="px-4 py-3">{ta.columns.estimate}</th><th className="px-4 py-3">{ta.columns.actions}</th></tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-ink-500">{formatDate(o.createdAt, lang)}</td>
                    <td className="px-4 py-3 font-semibold text-ink-900">{o.company}</td>
                    <td className="px-4 py-3">{o.lines.length}</td>
                    <td className="px-4 py-3">{t.whatsapp.deliveryTypes[o.delivery]}</td>
                    <td className="px-4 py-3">{o.estimateExclVat !== undefined ? formatEur(o.estimateExclVat, lang) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{ta.source[o.source ?? "web"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
