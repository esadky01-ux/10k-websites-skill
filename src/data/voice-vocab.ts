/**
 * Saha sözlüğü: Kürtçe (Kurmancî), yöresel Türkçe ve esnaf jargonundan katalog terimlerine.
 *
 * Katalogda karşılığı olmayan kelimeler için "eğitim" burada yapılır: sağ tarafa katalogda geçen
 * Türkçe/Felemenkçe kelimeyi yazın. Sözlük üç yerde kullanılır:
 *   1) Eşleştirici (searchProducts) sorguyu bu eş anlamlılarla genişletir,
 *   2) Whisper'a "prompt" ipucu olarak verilir (nadir kelimeleri doğru duyması için),
 *   3) GPT-4o-mini kalem çıkarımına sözlük olarak eklenir.
 * Eşleşmeyen sorgular data/voice-unmatched.jsonl dosyasına düşer; oradan yeni kelimeler eklenir.
 */
export const VOICE_VOCAB: Record<string, string[]> = {
  // Kurmancî → katalog
  goşt: ["et", "vlees"], gost: ["et"],
  mirîşk: ["tavuk", "kip"], mirisk: ["tavuk"],
  ga: ["dana"], çêlek: ["dana"], celek: ["dana"],
  nan: ["ekmek", "brood"],
  penîr: ["peynir", "kaas"], penir: ["peynir"],
  rûn: ["yağ", "olie"], run: ["yag"],
  sîr: ["sarımsak", "knoflook"], sir: ["sarimsak"],
  pîvaz: ["soğan"], pivaz: ["sogan"],
  bacan: ["domates"], bacanê: ["domates"],
  kartol: ["patates", "friet"],
  şîr: ["süt", "melk"],
  dew: ["ayran"],
  av: ["su", "water"], avê: ["su"],
  birinc: ["pirinç", "rijst"],
  nok: ["nohut"],
  nîsk: ["mercimek"], nisk: ["mercimek"],
  ar: ["un", "bloem"],
  xwê: ["tuz"], xwe: ["tuz"],
  şekir: ["şeker"],
  zeytûn: ["zeytin"], zeytun: ["zeytin"],
  kaxez: ["kağıt", "papier"],
  qutî: ["kutu", "koli"], quti: ["kutu"],
  // Esnaf jargonu / yöresel
  "25lik": ["25"], "25'lik": ["25"], onluk: ["10 kg"], yirmilik: ["20 kg"],
  bidon: ["kova"], teneke: ["teneke"], bib: ["bib"],
  dönerlik: ["döner"], donerlik: ["doner"],
  fritür: ["patates", "friet"], fritur: ["patates"],
  lahmacunluk: ["lahmacun"],
};

/** Whisper'a verilen kısa kelime listesi (nadir/özel kelimeleri doğru yazması için). */
export const WHISPER_HINT = [
  "Maximus, Pauwels, Samurai, Andalouse, Tabasco, Lutosa, Poco Loco, Nawras, Hane, Düzgün, Polat, Efendi, Mekkafood, Ceres, Van Reusel",
  "döner, tavuk döner, dana döner, kıyma döner, kip doner, koli, kutu, kova, teneke, bidon, BIB, 20 kg, 15 kg, 10 kg, 3 liter, 350 ml",
  "goşt, mirîşk, nan, penîr, rûn, sîr, dew, birinc, nok, nîsk, qutî",
].join(". ");
