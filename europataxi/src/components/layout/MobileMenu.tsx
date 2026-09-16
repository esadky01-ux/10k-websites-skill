"use client";

import { Menu, Phone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ButtonLink } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavLinks, type NavItem } from "./NavLinks";

interface MobileMenuProps {
  locale: Locale;
  items: NavItem[];
  bookingHref: string;
  phone: { display: string; href: string };
  nav: Dictionary["nav"];
  common: Pick<Dictionary["common"], "bookNow" | "callUs">;
  languageSwitcher: Dictionary["languageSwitcher"];
}

const PANEL_ID = "mobile-menu";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const iconButton =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-paper transition-colors motion-reduce:transition-none hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi";

/**
 * Hamburger düğmesi ve tam yükseklikte çekmece. Panel `document.body`'ye portal ile basılır;
 * header'daki `backdrop-blur`, `fixed` öğeler için kapsayıcı blok oluşturduğundan bu zorunludur.
 */
export function MobileMenu({ locale, items, bookingHref, phone, nav, common, languageSwitcher }: MobileMenuProps) {
  const pathname = usePathname();
  // Menü yalnızca açıldığı yolda açık kalır; rota değişince türetilmiş durum kendiliğinden kapanır.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /** Bağlantı tıklaması: kapat, odağı hedef sayfaya bırak. */
  const close = useCallback(() => setOpenedAt(null), []);
  /** Kullanıcı vazgeçti (ESC, arka plan, kapat düğmesi): kapat ve odağı açma düğmesine döndür. */
  const dismiss = useCallback(() => {
    setOpenedAt(null);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismiss]);

  /** Basit odak tuzağı: Tab ve Shift+Tab panelin içinde döner. */
  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {/* `aria-controls` yalnızca panel DOM'dayken yazılır: kapalıyken var olmayan bir kimliğe
          işaret ederdi. İlişkiyi `aria-expanded`, `role="dialog"` ve odağın panele taşınması kuruyor. */}
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        {...(open ? { "aria-controls": PANEL_ID } : {})}
        aria-label={open ? nav.closeMenu : nav.openMenu}
        onClick={() => (open ? dismiss() : setOpenedAt(pathname))}
        className={`${iconButton} xl:hidden`}
      >
        {open ? <X aria-hidden="true" className="h-6 w-6" /> : <Menu aria-hidden="true" className="h-6 w-6" />}
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 xl:hidden">
              <div className="absolute inset-0 bg-ink/70" onClick={dismiss} aria-hidden="true" />
              <div
                ref={panelRef}
                id={PANEL_ID}
                role="dialog"
                aria-modal="true"
                aria-label={nav.ariaMobile}
                onKeyDown={trapFocus}
                className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-line bg-ink shadow-card motion-safe:animate-fade-up"
              >
                <div className="flex h-16 shrink-0 items-center justify-end border-b border-line px-4">
                  <button ref={closeRef} type="button" aria-label={nav.closeMenu} onClick={dismiss} className={iconButton}>
                    <X aria-hidden="true" className="h-6 w-6" />
                  </button>
                </div>
                <nav aria-label={nav.ariaMain} className="flex-1 overflow-y-auto px-4 py-6">
                  <NavLinks items={items} variant="mobile" onNavigate={close} />
                </nav>
                <div className="flex shrink-0 flex-col items-start gap-4 border-t border-line px-4 py-5">
                  <LanguageSwitcher locale={locale} labels={languageSwitcher} size="md" onNavigate={close} />
                  <a
                    href={phone.href}
                    onClick={close}
                    className="inline-flex min-h-11 items-center gap-3 rounded-md text-base font-bold text-paper transition-colors motion-reduce:transition-none hover:text-taxi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi"
                  >
                    <Phone aria-hidden="true" className="h-5 w-5 text-taxi" />
                    <span className="sr-only">{common.callUs}: </span>
                    {phone.display}
                  </a>
                  <ButtonLink href={bookingHref} full onClick={close}>
                    {common.bookNow}
                  </ButtonLink>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
