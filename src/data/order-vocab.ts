/**
 * Saha sözlüğü: Kürtçe (Kurmancî), yöresel Türkçe ve esnaf jargonundan katalog terimlerine.
 *
 * WhatsApp sipariş eşleştiricisi (searchProducts) sorguyu bu eş anlamlılarla genişletir; böylece
 * müşteri "3 koli mirîşk" yazdığında tavuk ürünleri bulunur. Katalogda karşılığı olmayan bir kelime
 * çıktığında buraya bir satır eklemek yeterlidir: sağ tarafa katalogda geçen Türkçe/Felemenkçe kelimeyi yazın.
 */
export const ORDER_VOCAB: Record<string, string[]> = {
  // Kurmancî → katalog
  goşt: ["et", "vlees"], gost: ["et"],
  mirîşk: ["tavuk", "kip"], mirisk: ["tavuk"], mrişk: ["tavuk", "kip"], mrisk: ["tavuk"],
  hêk: ["yumurta", "eieren"], hek: ["yumurta"],
  "sêva erdê": ["patates", "friet"], "seva erde": ["patates"],
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
  karton: ["koli"], kîlo: ["kg"], kilo: ["kg"], dane: ["adet"],
  // Esnaf jargonu / yöresel
  "25lik": ["25"], "25'lik": ["25"], onluk: ["10 kg"], yirmilik: ["20 kg"],
  bidon: ["kova"], teneke: ["teneke"], bib: ["bib"],
  dönerlik: ["döner"], donerlik: ["doner"],
  fritür: ["patates", "friet"], fritur: ["patates"],
  lahmacunluk: ["lahmacun"],
};
