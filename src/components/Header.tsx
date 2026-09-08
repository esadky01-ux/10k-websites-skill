import Link from "next/link";
import { MapPin, Phone, Clock } from "lucide-react";
import Logo from "@/components/Logo";
import CartButton from "@/components/CartButton";
import { site, mapsUrl } from "@/lib/site";

const nav = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/siparis", label: "Ürünler" },
  { href: "/blog", label: "Blog" },
  { href: "/#iletisim", label: "İletişim" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-white/95 backdrop-blur">
      {/* Kurumsal üst şerit */}
      <div className="hidden border-b border-cream-200 bg-ink-900 text-cream-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-1.5 text-xs sm:px-6">
          <div className="flex items-center gap-6">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <MapPin className="h-3.5 w-3.5 text-gold-500" />
              {site.address.full}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gold-500" />
              {site.hours}
            </span>
          </div>
          <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-white">
            <Phone className="h-3.5 w-3.5 text-gold-500" />
            {site.phoneDisplay}
          </a>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Maximus Food & Horeca ana sayfa" className="shrink-0">
          <Logo priority />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Ana menü">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-cream-100 hover:text-ink-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={`tel:${site.phone.replace(/\s/g, "")}`}
            className="hidden items-center gap-2 rounded-full border border-cream-200 px-4 py-2.5 text-sm font-semibold text-ink-800 transition hover:border-ink-300 sm:inline-flex"
          >
            <Phone className="h-4 w-4 text-brand-600" />
            <span className="hidden md:inline">{site.phoneDisplay}</span>
            <span className="md:hidden">Ara</span>
          </a>
          <CartButton />
        </div>
      </div>

      {/* Mobil menü */}
      <nav className="flex gap-1 overflow-x-auto border-t border-cream-200 px-2 py-1.5 lg:hidden" aria-label="Mobil menü">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-cream-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
