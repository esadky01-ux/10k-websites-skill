import type { ReactNode } from "react";

/**
 * Kök düzen bilinçli olarak geçirgendir: `<html lang>` dile göre
 * `src/app/[locale]/layout.tsx` içinde kurulur.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
