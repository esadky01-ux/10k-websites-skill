import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

interface LogoProps {
  locale: Locale;
  /** Bağlantının erişilebilir adı, ör. "Europataxi, ana sayfa". */
  ariaLabel: string;
  variant?: "header" | "footer";
  className?: string;
}

/**
 * Logo, `/public/logo.svg` dosyasından gelir. Dosyayı değiştirmek logoyu
 * sitedeki her yerde değiştirir; oran 440×112 (yaklaşık 4:1) korunursa düzen bozulmaz.
 */
export function Logo({ locale, ariaLabel, variant = "header", className = "" }: LogoProps) {
  const height = variant === "header" ? "h-10 md:h-11" : "h-12";
  return (
    <Link
      href={`/${locale}`}
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi focus-visible:ring-offset-4 focus-visible:ring-offset-ink ${className}`}
    >
      <Image src="/logo.svg" alt="" width={440} height={112} priority={variant === "header"} className={`${height} w-auto`} />
    </Link>
  );
}
