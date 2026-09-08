import Image from "next/image";
import { existsSync } from "fs";
import path from "path";

const hasPngLogo = existsSync(path.join(process.cwd(), "public", "logo.png"));

type Props = {
  className?: string;
  /** Koyu zemin üzerinde kullanılıyorsa true */
  light?: boolean;
};

/** Kurumsal logo: public/logo.png varsa onu, yoksa SVG logoyu gösterir. */
export default function Logo({ className = "", light = false }: Props) {
  if (hasPngLogo) {
    return (
      <Image
        src="/logo.png"
        alt="MAXIMUS Food & Horeca"
        width={220}
        height={56}
        priority
        className={`h-11 w-auto ${className}`}
      />
    );
  }
  return <LogoSvg className={className} light={light} />;
}

/**
 * MAXIMUS marka işareti: turuncu (#EA580C) yuvarlatılmış kare zemin üzerinde
 * depo rafı formunu andıran geometrik "M" harfi ve slate detaylar.
 * Hem koyu hem açık zeminde tek başına kullanılabilir.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="MAXIMUS marka işareti" className={className}>
      <defs>
        <linearGradient id="mx-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="mx-mark-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#mx-mark-bg)" />
      <rect x="2" y="2" width="60" height="30" rx="16" fill="url(#mx-mark-shine)" />
      {/* Slate taban çizgisi: depo zemini */}
      <rect x="12" y="47" width="40" height="4" rx="2" fill="#0F172A" fillOpacity="0.9" />
      {/* Geometrik M: iki dış kolon ve ortada çatı formu */}
      <path
        d="M14 43V17h7.5L32 32.5 42.5 17H50v26h-7V29.5L32 44.5 21 29.5V43Z"
        fill="#ffffff"
      />
      {/* Slate vurgu noktası */}
      <circle cx="50" cy="14" r="4" fill="#0F172A" />
      <circle cx="50" cy="14" r="1.6" fill="#F97316" />
    </svg>
  );
}

/** Tam logo: marka işareti + MAXIMUS yazı markası ve FOOD & HORECA alt başlığı. */
export function LogoSvg({ className = "", light = false }: Props) {
  const primary = light ? "#F8FAFC" : "#0F172A";
  const secondary = light ? "#CBD5E1" : "#475569";
  return (
    <svg
      viewBox="0 0 268 56"
      role="img"
      aria-label="MAXIMUS Food & Horeca"
      className={`h-11 w-auto ${className}`}
    >
      <defs>
        <linearGradient id="mx-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="mx-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(0 2) scale(0.8125)">
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#mx-bg)" />
        <rect x="2" y="2" width="60" height="30" rx="16" fill="url(#mx-shine)" />
        <rect x="12" y="47" width="40" height="4" rx="2" fill="#0F172A" fillOpacity="0.9" />
        <path d="M14 43V17h7.5L32 32.5 42.5 17H50v26h-7V29.5L32 44.5 21 29.5V43Z" fill="#ffffff" />
        <circle cx="50" cy="14" r="4" fill="#0F172A" />
        <circle cx="50" cy="14" r="1.6" fill="#F97316" />
      </g>
      <text
        x="62"
        y="31"
        fontFamily="'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight="800"
        fontSize="27"
        letterSpacing="1.5"
        fill={primary}
      >
        MAXIMUS
      </text>
      <rect x="63" y="36.5" width="18" height="2.5" rx="1.25" fill="#EA580C" />
      <text
        x="86"
        y="46"
        fontFamily="'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight="600"
        fontSize="10.5"
        letterSpacing="3"
        fill={secondary}
      >
        FOOD &amp; HORECA
      </text>
    </svg>
  );
}
