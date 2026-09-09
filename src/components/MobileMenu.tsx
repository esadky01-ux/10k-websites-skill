"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Phone, MapPin, Clock, UserRound, MessageCircle } from "lucide-react";
import LangSwitch from "@/components/LangSwitch";
import Logo from "@/components/Logo";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { localePath } from "@/i18n/config";
import { site, mapsUrl } from "@/lib/site";

export type NavItem = { href: string; label: string };

/** Mobil hamburger menü: sağdan açılan çekmece (drawer). Bağlantıya tıklayınca, Escape ile ve dışarı tıklayınca kapanır. */
export default function MobileMenu({ items, menuLabel, closeLabel }: { items: NavItem[]; menuLabel: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const { customer } = useAuth();
  const { lang, t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);


  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream-200 text-ink-800 transition hover:border-ink-300 lg:hidden"
        aria-label={menuLabel}
        aria-expanded={open}
        aria-controls="mobile-menu"
        data-testid="menu-open"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden">
            <div className="animate-drawer-fade absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label={menuLabel}
              className="animate-drawer-in absolute inset-y-0 right-0 flex w-[min(88vw,360px)] flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
                <Logo />
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream-200 text-ink-800 hover:bg-cream-100" aria-label={closeLabel} data-testid="menu-close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={menuLabel}>
                {items.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base font-semibold text-ink-800 transition hover:bg-cream-100">
                    {item.label}
                  </Link>
                ))}
                <Link
                  href={customer ? localePath(lang, "account") : localePath(lang, "login")}
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center gap-3 rounded-xl border border-cream-200 px-4 py-3 text-base font-semibold text-ink-800 hover:bg-cream-100"
                >
                  <UserRound className="h-5 w-5 text-brand-500" />
                  {customer ? `${t.nav.account} · ${customer.company}` : t.nav.login}
                </Link>
              </nav>

              <div className="space-y-3 border-t border-cream-200 bg-cream-50 px-4 py-4 text-sm text-ink-700">
                <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 font-bold text-white shadow-sm">
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
                <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 font-semibold text-ink-900">
                  <Phone className="h-4 w-4 text-brand-500" />
                  {site.phoneDisplay}
                </a>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  {site.address.full}
                </a>
                <p className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  {t.common.hours}
                </p>
                <LangSwitch className="inline-flex rounded-full border border-cream-200 bg-white px-3 py-1.5 font-semibold text-ink-800" />
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
