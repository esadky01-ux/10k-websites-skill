import { Clock, Mail, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TaxiStripe } from "@/components/ui";
import { countries } from "@/data/locations";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";
import { site } from "@/lib/site";
import { mainNavItems } from "./Header";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";

type SocialKey = keyof typeof site.social;

const socialKeys = Object.keys(site.social) as SocialKey[];

const headingClass = "text-sm font-bold uppercase tracking-[0.18em] text-paper";
/** Mobilde 44 px dokunma alanı, masaüstünde sıkı satır aralığı. */
const rowClass = "inline-flex min-h-11 items-center gap-3 text-sm lg:min-h-0 lg:py-1";
const linkClass = `${rowClass} rounded-sm text-muted transition-colors motion-reduce:transition-none hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi`;

/** Kullanılan lucide sürümü marka simgeleri içermediği için üç sade sosyal medya glifi burada çizilir. */
const socialGlyphs: Record<SocialKey, ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </>
  ),
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
};

function SocialGlyph({ name }: { name: SocialKey }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {socialGlyphs[name]}
    </svg>
  );
}

/** Siyah footer: dama şeridi, dört sütun (mobilde tek sütun) ve telif / yasal bağlantı çubuğu. */
export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const quickLinks = [
    ...mainNavItems(locale, dict.nav),
    { href: localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID }), label: dict.nav.booking },
  ];
  const regionsHref = localizedPath(locale, "regions");

  return (
    <footer className="bg-ink">
      <TaxiStripe />
      <div className="container py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-4">
          <div className="max-w-prose">
            <Logo locale={locale} ariaLabel={dict.nav.logoAria} variant="footer" />
            {/* Slogan İngilizcedir: lang olmadan Türkçe büyük harf kuralı "RİDE" üretirdi. */}
            <p lang="en" className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-taxi">
              {dict.footer.tagline}
            </p>
            <p className="mt-3 text-base text-muted">{dict.footer.about}</p>
          </div>

          <nav aria-label={dict.footer.quickLinks}>
            <h2 className={headingClass}>{dict.footer.quickLinks}</h2>
            <ul className="mt-4 flex flex-col">
              {quickLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className={headingClass}>{dict.footer.countries}</h2>
            <ul className="mt-4 flex flex-col">
              {countries.map((code) => (
                <li key={code}>
                  <Link href={regionsHref} className={linkClass}>
                    {dict.countries[code]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className={headingClass}>{dict.footer.contact}</h2>
            <ul className="mt-4 flex flex-col">
              <li>
                <a href={site.phone.href} className={linkClass}>
                  <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="sr-only">{dict.common.phoneLabel}: </span>
                  {site.phone.display}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className={`${linkClass} break-all`}>
                  <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="sr-only">{dict.common.emailLabel}: </span>
                  {site.email}
                </a>
              </li>
              <li>
                <span className={`${rowClass} text-muted`}>
                  <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {dict.footer.hours}
                </span>
              </li>
            </ul>

            <h3 className={`${headingClass} mt-8`}>{dict.footer.social}</h3>
            <ul className="mt-3 flex gap-2">
              {socialKeys.map((key) => (
                <li key={key}>
                  <a
                    href={site.social[key]}
                    aria-label={dict.footer.socialLabels[key]}
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-paper transition-colors motion-reduce:transition-none hover:border-paper hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi"
                  >
                    <SocialGlyph name={key} />
                  </a>
                </li>
              ))}
            </ul>

            <h3 className={`${headingClass} mt-8`}>{dict.footer.language}</h3>
            <LanguageSwitcher locale={locale} labels={dict.languageSwitcher} size="md" className="mt-3" />
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container flex flex-col gap-2 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between md:gap-6">
          <p>{dict.footer.copyright}</p>
          <ul className="flex flex-wrap gap-x-6">
            <li>
              <Link href={localizedPath(locale, "privacy")} className={linkClass}>
                {dict.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href={localizedPath(locale, "terms")} className={linkClass}>
                {dict.footer.terms}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
