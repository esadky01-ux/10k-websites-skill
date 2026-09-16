import { Clock, Languages, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/getDictionary";
import { site } from "@/lib/site";

export type ContactInfoDict = Pick<Dictionary, "contact" | "common">;

interface ContactInfoProps {
  dict: ContactInfoDict;
  className?: string;
}

interface InfoItem {
  icon: typeof Phone;
  label: string;
  value: ReactNode;
}

const linkClass =
  "rounded-sm font-bold text-paper underline-offset-4 transition-colors motion-reduce:transition-none hover:text-taxi hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Doğrudan iletişim bilgileri: telefon ve e-posta bağlantıları, çalışma saatleri, merkez, destek dilleri. */
export function ContactInfo({ dict, className = "" }: ContactInfoProps) {
  const info = dict.contact.info;
  const items: InfoItem[] = [
    {
      icon: Phone,
      label: info.phone,
      value: (
        <a href={site.phone.href} aria-label={`${dict.common.callUs}: ${site.phone.display}`} className={linkClass}>
          {site.phone.display}
        </a>
      ),
    },
    {
      icon: Mail,
      label: info.email,
      value: (
        <a href={`mailto:${site.email}`} className={`${linkClass} break-all`}>
          {site.email}
        </a>
      ),
    },
    { icon: Clock, label: info.hours, value: info.hoursValue },
    { icon: MapPin, label: info.base, value: info.baseValue },
    { icon: Languages, label: info.languages, value: info.languagesValue },
  ];

  return (
    <div className={className}>
      <h2 className="text-lg font-extrabold tracking-tight text-paper">{info.title}</h2>
      <dl className="mt-6 divide-y divide-line border-y border-line">
        {items.map(({ icon: Icon, label, value }) => (
          // <dl> yalnızca tek bir sarmalayıcı <div> kabul eder ve içinde doğrudan <dt>/<dd> ister;
          // simge bu yüzden <dt>'nin içindedir, ayrı bir kardeş öğe değil.
          <div key={label} className="py-4">
            <dt className="flex items-center gap-3 text-sm text-muted">
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-taxi" />
              {label}
            </dt>
            <dd className="mt-1 break-words pl-8 text-base text-paper">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
