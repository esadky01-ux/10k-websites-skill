import Link from "next/link";
import { MapPin, Phone, Clock } from "lucide-react";
import Logo from "@/components/Logo";
import HeaderActions from "@/components/HeaderActions";
import MobileMenu from "@/components/MobileMenu";
import LangSwitch from "@/components/LangSwitch";
import { site, mapsUrl } from "@/lib/site";
import { getDictionary, localePath, type Locale } from "@/i18n";

export default function Header({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);
  const nav = [
    { href: localePath(lang), label: t.nav.home },
    { href: localePath(lang, "order"), label: t.nav.products },
    { href: localePath(lang, "regions"), label: t.nav.regions },
    { href: localePath(lang, "blog"), label: t.nav.blog },
    { href: `${localePath(lang)}#contact`, label: t.nav.contact },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-white/95 backdrop-blur">
      <div className="hidden border-b border-cream-200 bg-ink-900 text-cream-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-1.5 text-xs sm:px-6">
          <div className="flex items-center gap-6">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
              <MapPin className="h-3.5 w-3.5 text-gold-500" />
              {site.address.full}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gold-500" />
              {t.common.hours}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-white">
              <Phone className="h-3.5 w-3.5 text-gold-500" />
              {site.phoneDisplay}
            </a>
            <LangSwitch className="rounded-full border border-white/20 px-2.5 py-0.5 font-semibold hover:bg-white/10" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={localePath(lang)} aria-label="Maximus Food & Horeca" className="shrink-0">
          <Logo priority />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label={t.nav.home}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-cream-100 hover:text-ink-900">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <HeaderActions />
          <MobileMenu items={nav} menuLabel={t.header.menu} closeLabel={t.common.close} />
        </div>
      </div>
    </header>
  );
}
