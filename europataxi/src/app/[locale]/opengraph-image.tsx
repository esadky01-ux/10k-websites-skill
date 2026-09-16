import { ImageResponse } from "next/og";
import { locales } from "@/i18n/config";

/**
 * Sosyal paylaşım görseli (WhatsApp, LinkedIn, X). Derleme sırasında marka
 * paletiyle üretilir; ayrı bir görsel dosyası tutmaya gerek kalmaz.
 * Yazılar bilerek İngiliz alfabesindedir: `next/og` varsayılan yazı tipi
 * Türkçe karakterleri her ortamda garanti etmez.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Europataxi: Your Ride, Our Priority";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const INK = "#000000";
const TAXI = "#FFC20E";
const PAPER = "#FFFFFF";
const MUTED = "#A3A3A3";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: INK }}>
        {/* Marka şeridi: sarı-siyah dama */}
        <div style={{ display: "flex", height: 28 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, backgroundColor: i % 2 === 0 ? TAXI : INK }} />
              <div style={{ flex: 1, backgroundColor: i % 2 === 0 ? INK : TAXI }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px" }}>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 800, color: PAPER, letterSpacing: -2 }}>EUROPATAXI</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: TAXI, letterSpacing: 6, marginTop: 12 }}>
            YOUR RIDE, OUR PRIORITY
          </div>
          <div style={{ display: "flex", fontSize: 34, color: MUTED, marginTop: 44 }}>
            Belgium . Netherlands . France . Germany
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 14 }}>
            Fixed price, door to door, licensed drivers
          </div>
        </div>
      </div>
    ),
    size,
  );
}
