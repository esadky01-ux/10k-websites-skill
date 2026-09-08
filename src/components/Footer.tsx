import Link from "next/link";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import { LogoSvg } from "@/components/Logo";
import { categories } from "@/data/categories";
import { site, mapsUrl } from "@/lib/site";

export default function Footer() {
  return (
    <footer id="iletisim" className="border-t border-cream-200 bg-cream-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <LogoSvg />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500">
            {site.name}, Aarschot merkezli B2B toptan gıda tedarikçisidir. Restoran, fritür, döner
            büfesi, otel ve toplu yemek işletmelerine soslar, et ürünleri, dondurulmuş gıda, ambalaj,
            içecek ve kuru gıda tedarik ediyoruz.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${site.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-wa px-4 py-2 text-sm font-semibold text-white hover:bg-wa-dark"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Sipariş Hattı
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-900">Ürün Grupları</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/siparis?kategori=${c.slug}`} className="text-ink-500 hover:text-brand-600">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/blog" className="text-ink-500 hover:text-brand-600">
                Blog & Sektör Rehberleri
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-900">İletişim</h3>
          <ul className="mt-4 space-y-3 text-sm text-ink-500">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600">
                {site.address.street}
                <br />
                {site.address.postal} {site.address.city}, {site.address.country}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-brand-600" />
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-brand-600">
                {site.phoneDisplay}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-brand-600" />
              <a href={`mailto:${site.email}`} className="hover:text-brand-600">
                {site.email}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {site.hours}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} {site.name}. Tüm hakları saklıdır.</span>
          <span>Yalnızca işletmelere (B2B) satış yapılır. Fiyatlar KDV hariç teklif üzerine bildirilir.</span>
        </div>
      </div>
    </footer>
  );
}
