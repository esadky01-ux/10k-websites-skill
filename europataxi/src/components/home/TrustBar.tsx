import type { Dictionary } from "@/i18n/getDictionary";

interface TrustBarProps {
  trust: Dictionary["hero"]["trust"];
  /** Listenin erişilebilir adı (`dict.hero.trustAria`). */
  label: string;
  className?: string;
}

/** Hero'daki dört güven göstergesi: değer + kısa açıklama, adlandırılmış liste olarak. */
export function TrustBar({ trust, label, className = "" }: TrustBarProps) {
  return (
    <ul aria-label={label} className={`grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {trust.map((item) => (
        <li key={item.label} className="border-l-2 border-taxi-ink pl-4">
          <span className="block text-xl font-extrabold leading-none tabular-nums text-content">{item.value}</span>
          <span className="mt-2 block text-sm text-muted">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
