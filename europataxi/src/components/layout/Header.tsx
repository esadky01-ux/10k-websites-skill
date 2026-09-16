import { Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";
import { site } from "@/lib/site";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NavLinks, type NavItem } from "./NavLinks";

/** Ana menü sayfaları; Header, MobileMenu ve Footer aynı listeyi kullanır. */
export function mainNavItems(locale: Locale, nav: Dictionary["nav"]): NavItem[] {
  return [
    { href: localizedPath(locale, "home"), label: nav.home },
    { href: localizedPath(locale, "services"), label: nav.services },
    { href: localizedPath(locale, "airports"), label: nav.airports },
    { href: localizedPath(locale, "regions"), label: nav.regions },
    { href: localizedPath(locale, "contact"), label: nav.contact },
  ];
}

/**
 * Yapışkan siyah header: solda logo, masaüstünde (xl) menü, sağda dil seçici, telefon ve sarı CTA.
 * xl altında menü hamburger çekmecesine taşınır; md altında dil seçici, sm altında CTA da yalnızca çekmecededir.
 */
export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = mainNavItems(locale, dict.nav);
  const bookingHref = localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID });
  const phone = { display: site.phone.display, href: site.phone.href };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <Logo locale={locale} ariaLabel={dict.nav.logoAria} />
        <nav aria-label={dict.nav.ariaMain} className="hidden xl:block">
          <NavLinks items={items} />
        </nav>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden md:block">
            <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} />
          </div>
          <a
            href={phone.href}
            aria-label={`${dict.common.callUs}: ${phone.display}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-2 text-sm font-bold text-paper transition-colors motion-reduce:transition-none hover:text-taxi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi"
          >
            <Phone aria-hidden="true" className="h-5 w-5" />
            {/* 1280'de menü, telefon ve CTA birlikte sığmıyor; numara 2xl'den itibaren yazıyla görünür. */}
            <span className="hidden 2xl:inline">{phone.display}</span>
          </a>
          <ButtonLink href={bookingHref} size="sm" className="hidden whitespace-nowrap sm:inline-flex">
            {dict.common.bookNow}
          </ButtonLink>
          <MobileMenu
            locale={locale}
            items={items}
            bookingHref={bookingHref}
            phone={phone}
            nav={dict.nav}
            common={{ bookNow: dict.common.bookNow, callUs: dict.common.callUs }}
            languageSwitcher={dict.languageSwitcher}
          />
        </div>
      </div>
    </header>
  );
}
