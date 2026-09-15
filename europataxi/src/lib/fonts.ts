import { Archivo } from "next/font/google";

/** Başlık ve gövde için tek yazı tipi. `--font-archivo` değişkeni tailwind.config.ts'de kullanılır. */
export const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});
