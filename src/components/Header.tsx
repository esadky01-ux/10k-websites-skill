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
      {/* Üst şerit her ekranda görünür: diller ilk bakışta seçilebilsin diye mobilde de duruyor,
          adres ve saat gibi uzun bilgiler yalnızca geniş ekranda gösterilir. */}
      <div className="border-b border-cream-200 bg-ink-900 text-cream-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-1.5 text-xs sm:px-6">
          <div className="hidden items-center gap-6 md:flex">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
              <MapPin className="h-3.5 w-3.5 text-gold-500" />
              {site.address.full}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gold-500" />
              {t.common.hours}
            </span>
          </div>
          <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-end">
            <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold hover:text-white">
              <Phone className="h-3.5 w-3.5 text-gold-500" />
              {/* Dar ekranda yalnızca simge: dört dil şeride sığsın, numara yine aranabilir kalsın */}
              <span className="hidden sm:inline">{site.phoneDisplay}</span>
              <span className="sr-only sm:hidden">{site.phoneDisplay}</span>
            </a>
            <LangSwitch />
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
