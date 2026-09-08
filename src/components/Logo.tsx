import Image from "next/image";

type Props = {
  className?: string;
  /** Koyu zemin üzerinde kullanılıyorsa beyaz logo sürümünü gösterir */
  light?: boolean;
  priority?: boolean;
};

/**
 * Maximus kurumsal logosu (el yazısı "maximus" ve yükselen ok).
 * Açık zeminde kırmızı, koyu zeminde beyaz sürüm kullanılır.
 */
export default function Logo({ className = "", light = false, priority = false }: Props) {
  return (
    <Image
      src={light ? "/logo-white.png" : "/logo.png"}
      alt="Maximus Food & Horeca"
      width={1042}
      height={331}
      priority={priority}
      className={`h-10 w-auto sm:h-11 ${className}`}
    />
  );
}

/** Yuvarlak marka rozeti (favicon ile aynı görsel). */
export function LogoBadge({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo-badge.jpg"
      alt="Maximus — Quality Food. Trusted Partner."
      width={600}
      height={600}
      className={`rounded-full ${className}`}
    />
  );
}
