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
 * Logo bilerek satır içi SVG'dir: marka yazısı `currentColor` kullanır, böylece
 * açık temada koyu, koyu temada beyaz görünür. Dosya olarak gömülseydi beyaz
 * yazı beyaz zeminde kaybolurdu.
 *
 * Aynı çizim `public/logo.svg` dosyasında da durur; o kopya site dışı kullanımlar
 * (yapılandırılmış veri, paylaşım görseli) içindir ve koyu zemine göre sabittir.
 * Logoyu değiştirirken iki dosyayı birlikte güncelleyin.
 *
 * Renkler: taksi gövdesi marka sarısı (`taxi`), cam ve tekerlek göbekleri
 * yüzey rengi (`surface`), yazı metin rengi (`currentColor`), slogan vurgu
 * rengi (`taxi-ink`).
 */
export function Logo({ locale, ariaLabel, variant = "header", className = "" }: LogoProps) {
  const height = variant === "header" ? "h-11 md:h-12" : "h-14";
  return (
    <Link
      href={`/${locale}`}
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center rounded-sm text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink focus-visible:ring-offset-4 focus-visible:ring-offset-surface ${className}`}
    >
      <svg viewBox="0 0 440 112" className={`${height} w-auto`} role="img" aria-hidden="true" focusable="false">
        <g transform="translate(4 8)">
          <rect x="34" y="0" width="28" height="12" rx="3" className="fill-taxi" />
          <rect x="37" y="2" width="5" height="4" className="fill-on-taxi" />
          <rect x="47" y="2" width="5" height="4" className="fill-on-taxi" />
          <rect x="42" y="6" width="5" height="4" className="fill-on-taxi" />
          <rect x="52" y="6" width="5" height="4" className="fill-on-taxi" />
          <rect x="46" y="12" width="4" height="8" className="fill-taxi" />
          <path
            d="M10 56 L18 34 Q22 22 36 22 L60 22 Q72 22 78 32 L90 46 Q96 48 96 54 L96 64 Q96 70 90 70 L6 70 Q0 70 0 64 L0 62 Q0 56 10 56 Z"
            className="fill-taxi"
          />
          <path d="M40 28 L60 28 Q68 28 72 34 L78 44 L40 44 Z" className="fill-on-taxi" />
          <path d="M34 28 L34 44 L18 44 Q22 30 34 28 Z" className="fill-on-taxi" />
          <rect x="48" y="48" width="2" height="18" className="fill-on-taxi" />
          <rect x="86" y="54" width="8" height="5" rx="1" className="fill-surface" />
          <circle cx="24" cy="70" r="10" className="fill-on-taxi" />
          <circle cx="24" cy="70" r="4" className="fill-taxi" />
          <circle cx="74" cy="70" r="10" className="fill-on-taxi" />
          <circle cx="74" cy="70" r="4" className="fill-taxi" />
        </g>
        <text
          x="118"
          y="62"
          fontFamily="var(--font-archivo), Archivo, Arial, Helvetica, sans-serif"
          fontWeight="800"
          fontSize="42"
          letterSpacing="1"
          fill="currentColor"
        >
          EUROPATAXI
        </text>
        <text
          x="120"
          y="88"
          fontFamily="var(--font-archivo), Archivo, Arial, Helvetica, sans-serif"
          fontWeight="600"
          fontSize="17"
          letterSpacing="2.2"
          className="fill-taxi-ink"
        >
          YOUR RIDE, OUR PRIORITY
        </text>
      </svg>
    </Link>
  );
}
