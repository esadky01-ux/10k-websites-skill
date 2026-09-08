import { Beef, Snowflake, Package, CupSoda, Wheat, Droplets, type LucideIcon } from "lucide-react";

const map: Record<string, { Icon: LucideIcon; cls: string }> = {
  soslar: { Icon: Droplets, cls: "bg-amber-100 text-amber-700" },
  "et-urunleri": { Icon: Beef, cls: "bg-red-100 text-red-700" },
  dondurulmus: { Icon: Snowflake, cls: "bg-sky-100 text-sky-700" },
  ambalaj: { Icon: Package, cls: "bg-stone-200 text-stone-700" },
  icecekler: { Icon: CupSoda, cls: "bg-blue-100 text-blue-700" },
  "kuru-gida": { Icon: Wheat, cls: "bg-yellow-100 text-yellow-800" },
};

export default function ProductIcon({ category, size = "md" }: { category: string; size?: "sm" | "md" }) {
  const entry = map[category] ?? map.ambalaj;
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className={`flex ${dim} shrink-0 items-center justify-center rounded-lg ${entry.cls}`} aria-hidden>
      <entry.Icon className={icon} />
    </span>
  );
}
