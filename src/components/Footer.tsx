import Link from "next/link";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import Logo from "@/components/Logo";
import { categories } from "@/data/categories";
import { regions } from "@/data/regions";
import { site, mapsUrl } from "@/lib/site";
import { fill, getDictionary, localePath, type Locale } from "@/i18n";
import { categoryHref } from "@/components/CategoryGrid";

export default function Footer({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);
  return (
    <footer id="contact" className="border-t border-cream-200 bg-cream-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 text-sm font-bold uppercase tracking-wider text-brand-500">{site.tagline}</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500">{fill(t.footer.about, { year: site.founded })}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-wa px-4 py-2 text-sm font-semibold text-white hover:bg-wa-dark">
              <MessageCircle className="h-4 w-4" />{t.footer.whatsapp}
            </a>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-900">{t.footer.groups}</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.slug}><Link href={categoryHref(lang, c.slug)} className="text-ink-500 hover:text-brand-500">{c.name[lang]}</Link></li>
            ))}
            <li><Link href={localePath(lang, "blog")} className="text-ink-500 hover:text-brand-500">{t.footer.blog}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-900">{t.footer.regions}</h3>
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {regions.slice(0, 16).map((r) => (
              <li key={r.slug}><Link href={localePath(lang, "regions", r.slug)} className="text-ink-500 hover:text-brand-500">{r.name}</Link></li>
            ))}
            <li className="col-span-2"><Link href={localePath(lang, "regions")} className="font-semibold text-brand-500 hover:text-brand-600">{t.regionsHome.all} →</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-900">{t.footer.contact}</h3>
          <ul className="mt-4 space-y-3 text-sm text-ink-500">
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-500">{site.address.street}<br />{site.address.postal} {site.address.city}, {lang === "nl" ? "België" : site.address.country}</a></li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-brand-500" /><a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-brand-500">{site.phoneDisplay}</a></li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-brand-500" /><a href={`mailto:${site.email}`} className="hover:text-brand-500">{site.email}</a></li>
            <li className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />{t.common.hours}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink-500 sm:px-6 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {site.name}. {t.footer.rights}</span>
          <span>{t.footer.b2b}</span>
        </div>
      </div>
    </footer>
  );
}
