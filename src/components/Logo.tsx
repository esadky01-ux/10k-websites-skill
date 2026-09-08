import Image from "next/image";
import { existsSync } from "fs";
import path from "path";

const hasPngLogo = existsSync(path.join(process.cwd(), "public", "logo.png"));

type Props = { className?: string; light?: boolean };

/** Kurumsal logo: public/logo.png varsa onu, yoksa SVG logoyu gösterir. */
export default function Logo({ className = "", light = false }: Props) {
  if (hasPngLogo) {
    return (
      <Image
        src="/logo.png"
        alt="MAXIMUS Food & Horeca"
        width={200}
        height={56}
        priority
        className={`h-11 w-auto ${className}`}
      />
    );
  }
  return <LogoSvg className={className} light={light} />;
}

export function LogoSvg({ className = "", light = false }: Props) {
  const ink = light ? "#ffffff" : "#14161a";
  const sub = light ? "#e8dfd0" : "#5f6773";
  return (
    <svg
      viewBox="0 0 250 56"
      role="img"
      aria-label="MAXIMUS Food & Horeca"
      className={`h-11 w-auto ${className}`}
    >
      <defs>
        <linearGradient id="mxg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e23a45" />
          <stop offset="1" stopColor="#960d19" />
        </linearGradient>
      </defs>
      <rect x="0" y="4" width="48" height="48" rx="10" fill="url(#mxg)" />
      <path
        d="M11 40V16h6l7 12 7-12h6v24h-5.5V26.5L25 37.5 18.5 26.5V40Z"
        fill="#ffffff"
      />
      <circle cx="40" cy="12" r="3.5" fill="#e2a72e" />
      <text
        x="58"
        y="30"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="2"
        fill={ink}
      >
        MAXIMUS
      </text>
      <text
        x="59"
        y="46"
        fontFamily="'Segoe UI', Helvetica, Arial, sans-serif"
        fontWeight="600"
        fontSize="11"
        letterSpacing="3.2"
        fill={sub}
      >
        FOOD &amp; HORECA
      </text>
    </svg>
  );
}
