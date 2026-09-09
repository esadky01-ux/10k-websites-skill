"use client";

import Link from "next/link";
import { Phone, ShoppingCart, UserRound } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { localePath } from "@/i18n/config";
import { site } from "@/lib/site";

export default function HeaderActions() {
  const { open, lineCount, hydrated } = useCart();
  const { customer, loading } = useAuth();
  const { lang, t } = useI18n();
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hidden items-center gap-2 rounded-full border border-cream-200 px-4 py-2.5 text-sm font-semibold text-ink-800 transition hover:border-ink-300 md:inline-flex">
        <Phone className="h-4 w-4 text-brand-500" />
        <span className="hidden lg:inline">{site.phoneDisplay}</span>
        <span className="lg:hidden">{t.header.call}</span>
      </a>
      <Link
        href={customer ? localePath(lang, "account") : localePath(lang, "login")}
        className="inline-flex items-center gap-2 rounded-full border border-cream-200 px-3 py-2.5 text-sm font-semibold text-ink-800 transition hover:border-ink-300"
        aria-label={customer ? t.nav.account : t.nav.login}
      >
        <UserRound className="h-4 w-4 text-brand-500" />
        <span className="hidden sm:inline">{loading ? "…" : customer ? customer.company.split(" ")[0] : t.nav.login}</span>
      </Link>
      <button
        type="button"
        onClick={open}
        className="relative inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-900/20 transition hover:bg-brand-600"
        aria-label={t.header.cart}
      >
        <ShoppingCart className="h-4.5 w-4.5" />
        <span className="hidden sm:inline">{t.header.cart}</span>
        {hydrated && lineCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-ink-900 ring-2 ring-white">
            {lineCount}
          </span>
        )}
      </button>
    </div>
  );
}
