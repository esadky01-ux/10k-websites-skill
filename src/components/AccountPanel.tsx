"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, ListChecks, Package, LogOut, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { localePath } from "@/i18n/config";
import { getProduct, productName } from "@/data/products";
import { formatDate, formatEur } from "@/lib/format";
import type { OrderRecord, SavedList } from "@/server/store";

export default function AccountPanel() {
  const { customer, loading, logout } = useAuth();
  const cart = useCart();
  const { lang, t } = useI18n();
  const ta = t.account;
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [lists, setLists] = useState<SavedList[]>([]);
  const leaving = useRef(false);

  const load = useCallback(() => {
    return Promise.all([fetch("/api/orders", { cache: "no-store" }), fetch("/api/lists", { cache: "no-store" })]).then(async ([o, l]) => {
      const orders = o.ok ? ((await o.json()) as { orders: OrderRecord[] }).orders : [];
      const lists = l.ok ? ((await l.json()) as { lists: SavedList[] }).lists : [];
      return { orders, lists };
    });
  }, []);

  useEffect(() => {
    if (!loading && !customer && !leaving.current) router.replace(localePath(lang, "login"));
    if (!customer) return;
    let alive = true;
    load().then(({ orders, lists }) => {
      if (!alive) return;
      setOrders(orders);
      setLists(lists);
    });
    return () => {
      alive = false;
    };
  }, [customer, loading, lang, router, load]);

  if (loading || !customer) return <p className="py-20 text-center text-ink-500">…</p>;

  const reorder = (lines: { productId: string; cases: number; units: number }[]) => {
    cart.loadLines(lines);
    cart.open();
  };

  const removeList = async (id: string) => {
    await fetch(`/api/lists?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setLists((ls) => ls.filter((l) => l.id !== id));
  };

  const linesSummary = (lines: { productId: string; cases: number; units: number }[]) =>
    lines
      .slice(0, 3)
      .map((l) => {
        const p = getProduct(l.productId);
        return p ? `${l.cases > 0 ? l.cases + " " + t.cart.caseShort + " " : ""}${l.units > 0 ? l.units + " " + t.cart.unitShort + " " : ""}${productName(p, lang)}` : "";
      })
      .filter(Boolean)
      .join(", ") + (lines.length > 3 ? " …" : "");

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-cream-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-500">{ta.profile}</p>
          <p className="mt-2 text-lg font-bold text-ink-900">{customer.company}</p>
          <p className="text-sm text-ink-500">{customer.contact}</p>
          <p className="text-sm text-ink-500">{customer.phone}</p>
          <p className="text-sm text-ink-500">{customer.email}</p>
          {customer.vat && <p className="text-sm text-ink-500">{customer.vat}</p>}
          {(customer.street || customer.city) && <p className="mt-2 text-sm text-ink-500">{[customer.street, [customer.postcode, customer.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>}
          <p className="mt-4 text-xs text-ink-500">{ta.prices}</p>
          <Link href={localePath(lang, "order")} className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600">{ta.goOrder} <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <button type="button" onClick={async () => { leaving.current = true; await logout(); router.push(localePath(lang)); }} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-500">
          <LogOut className="h-4 w-4" /> {ta.logout}
        </button>
      </aside>

      <div className="space-y-8">
        {orders[0] && (
          <button type="button" onClick={() => reorder(orders[0].lines)} className="flex w-full items-center justify-between gap-4 rounded-2xl bg-ink-900 p-5 text-left text-white transition hover:bg-ink-800" data-testid="reorder-last">
            <span>
              <span className="flex items-center gap-2 text-lg font-bold"><RotateCcw className="h-5 w-5 text-gold-500" /> {ta.lastOrder}</span>
              <span className="mt-1 block text-sm text-cream-100/80">{formatDate(orders[0].createdAt, lang)} · {orders[0].lines.length} {ta.lines} · {linesSummary(orders[0].lines)}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0" />
          </button>
        )}

        <section>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink-900"><ListChecks className="h-5 w-5 text-brand-500" /> {ta.lists}</h2>
          {lists.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-cream-200 bg-white p-6 text-sm text-ink-500">{ta.noLists}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {lists.map((l) => (
                <li key={l.id} className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-ink-900">{l.name}</p>
                    <p className="text-sm text-ink-500">{l.lines.length} {ta.lines} · {linesSummary(l.lines)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => reorder(l.lines)} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600"><RotateCcw className="h-4 w-4" /> {ta.loadList}</button>
                    <button type="button" onClick={() => removeList(l.id)} aria-label={ta.deleteList} className="rounded-full border border-cream-200 p-2 text-ink-500 hover:border-brand-500 hover:text-brand-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink-900"><Package className="h-5 w-5 text-brand-500" /> {ta.orders}</h2>
          {orders.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-cream-200 bg-white p-6 text-sm text-ink-500">{ta.noOrders}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-ink-900">{ta.orderOn} {formatDate(o.createdAt, lang)}</p>
                    <p className="text-sm text-ink-500">{o.lines.length} {ta.lines} · {t.whatsapp.deliveryTypes[o.delivery]}{o.estimateExclVat !== undefined && ` · ${formatEur(o.estimateExclVat, lang)}`}</p>
                    <p className="text-xs text-ink-500">{linesSummary(o.lines)}</p>
                    <span className="mt-1 inline-block rounded-full bg-cream-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">{ta.status[o.status === "whatsapp" ? "whatsapp" : "draft"]}</span>
                  </div>
                  <button type="button" onClick={() => reorder(o.lines)} title={ta.reorderHint} className="inline-flex items-center gap-2 rounded-full border border-brand-500 px-4 py-2 text-sm font-bold text-brand-500 hover:bg-brand-50"><RotateCcw className="h-4 w-4" /> {ta.reorder}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
