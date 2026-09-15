import { randomInt } from "node:crypto";

/** Karışmayan karakterler: 0/O ve 1/I yok. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** `EPT-7K3F9Q` biçiminde rezervasyon numarası üretir. */
export function generateBookingReference(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `EPT-${code}`;
}
