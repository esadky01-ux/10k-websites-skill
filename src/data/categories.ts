import type { Locale } from "@/i18n/config";

export type Category = {
  slug: string;
  name: Record<Locale, string>;
  shortName: Record<Locale, string>;
  description: Record<Locale, string>;
  image: string;
};

export const categories: Category[] = [
  {
    slug: "soslar",
    name: { nl: "Sauzen", tr: "Soslar" },
    shortName: { nl: "Sauzen", tr: "Soslar" },
    description: {
      nl: "Pauwels emmer- en flessauzen (Andalouse, Samurai, Cocktail, Curry, Mayo Chef), Bicky, sambal, Tabasco en halal bolognese. Onmisbaar voor frituur en dönertoog.",
      tr: "Pauwels kova ve şişe sosları (Andalouse, Samurai, Cocktail, Curry, Mayo Chef), Bicky, sambal, Tabasco ve helal bolonez. Fritür ve döner tezgâhının vazgeçilmezleri.",
    },
    image: "/media/categories/soslar.jpg",
  },
  {
    slug: "et-urunleri",
    name: { nl: "Vlees & Döner", tr: "Et Ürünleri" },
    shortName: { nl: "Vlees", tr: "Et" },
    description: {
      nl: "Dönerspiesen van Maximus, Dost, Düzgün, Polat en Efendi; kip, rund en kalkoen; halal gehaktballen, salami en pepperoni. Koelketen gegarandeerd.",
      tr: "Maximus, Dost, Düzgün, Polat ve Efendi döner şişleri; tavuk, dana ve hindi ürünleri; helal köfte, salam ve pepperoni. Soğuk zincir garantili.",
    },
    image: "/media/categories/et-urunleri.jpg",
  },
  {
    slug: "dondurulmus",
    name: { nl: "Diepvries", tr: "Dondurulmuş Ürünler" },
    shortName: { nl: "Diepvries", tr: "Dondurulmuş" },
    description: {
      nl: "Lutosa en Sela frieten, snacks van Van Reusel, Mekkafood en Dunya, kroketten, zeevruchten en desserts.",
      tr: "Lutosa ve Sela patates kızartması, Van Reusel, Mekkafood ve Dunya atıştırmalıkları, kroketler, deniz ürünleri ve tatlılar.",
    },
    image: "/media/categories/dondurulmus.jpg",
  },
  {
    slug: "konserve",
    name: { nl: "Conserven & Tursu", tr: "Konserve & Turşu" },
    shortName: { nl: "Conserven", tr: "Konserve" },
    description: {
      nl: "Gepelde tomaten, pizzasaus, jalapeños, Griekse pepers, artisjok, tonijn, ansjovis, kappertjes en tursu. De basisconserven voor pizza en döner.",
      tr: "Soyulmuş domates, pizza sosu, jalapeño, Yunan biberi, enginar, ton balığı, hamsi, kapari ve turşular. Pizza ve döner mutfağının temel konserveleri.",
    },
    image: "/media/categories/konserve.jpg",
  },
  {
    slug: "peynir-sut",
    name: { nl: "Kaas & Zuivel", tr: "Peynir & Süt Ürünleri" },
    shortName: { nl: "Kaas", tr: "Peynir" },
    description: {
      nl: "Geraspte en blokmozzarella, gouda, gorgonzola, Gazi feta, parmezaan en room. Het complete assortiment voor pizzeria's.",
      tr: "Rendelenmiş ve blok mozzarella, Gouda, Gorgonzola, Gazi beyaz peynir, parmesan ve krema. Pizzacılar için tam seçki.",
    },
    image: "/media/categories/peynir-sut.jpg",
  },
  {
    slug: "ekmek-hamur",
    name: { nl: "Brood & Deeg", tr: "Ekmek & Hamur İşleri" },
    shortName: { nl: "Brood", tr: "Ekmek" },
    description: {
      nl: "Fırat dönerpide, gobitbrood, lahmacunbodems, durum wraps en tortilla's, pizzadeegbollen van Foster en Piazzola.",
      tr: "Fırat döner pidesi, gobit ekmeği, lahmacun tabanları, dürüm lavaşı ve tortilla, Foster ve Piazzola pizza hamur topları.",
    },
    image: "/media/categories/ekmek-hamur.jpg",
  },
  {
    slug: "kuru-gida",
    name: { nl: "Droge voeding & Kruiden", tr: "Kuru Gıda & Baharat" },
    shortName: { nl: "Droge voeding", tr: "Kuru Gıda" },
    description: {
      nl: "Bloem van Caputo en Primo, Barilla pasta, peulvruchten en rijst van Hane en Nawras, kruiden, friet- en olijfolie, thee en suiker.",
      tr: "Caputo ve Primo unları, Barilla makarnalar, Hane ve Nawras bakliyat ve pirinç, baharatlar, kızartma ve zeytinyağları, çay ve şeker.",
    },
    image: "/media/categories/kuru-gida.jpg",
  },
  {
    slug: "icecekler",
    name: { nl: "Dranken", tr: "İçecekler" },
    shortName: { nl: "Dranken", tr: "İçecekler" },
    description: {
      nl: "Coca-Cola, Pepsi, Fanta, Lipton, Looza, Capri-Sun, Uludağ, Kızılay, Çamlıca, ayran, şalgam, energydranken, water, bier en Kavaklıdere wijnen.",
      tr: "Coca-Cola, Pepsi, Fanta, Lipton, Looza, Capri Sun, Uludağ, Kızılay, Çamlıca, ayran, şalgam, enerji içecekleri, su, bira ve Kavaklıdere şarapları.",
    },
    image: "/media/categories/icecekler.jpg",
  },
  {
    slug: "ambalaj",
    name: { nl: "Verpakking", tr: "Ambalaj" },
    shortName: { nl: "Verpakking", tr: "Ambalaj" },
    description: {
      nl: "Pizzadozen, frietbakjes en frikandelbakjes, döner-, menu- en hamburgerboxen, aluminium schalen, draagzakken, inpakpapier, bestek en servetten.",
      tr: "Pizza kutuları, patates ve frikandel kapları, döner, menü ve hamburger kutuları, alüminyum kaplar, taşıma poşetleri, sargı kağıdı, çatal-bıçak ve peçete.",
    },
    image: "/media/categories/ambalaj.jpg",
  },
  {
    slug: "hijyen",
    name: { nl: "Hygiëne & Keuken", tr: "Hijyen & Mutfak" },
    shortName: { nl: "Hygiëne", tr: "Hijyen" },
    description: {
      nl: "Nitril handschoenen, handzeep, glas- en grillreiniger, ontsmettingsmiddel, wc-papier, vuilniszakken en keukenmateriaal zoals dönermessen.",
      tr: "Nitril eldiven, el sabunu, cam ve ızgara temizleyici, dezenfektan, tuvalet kağıdı, çöp poşeti ve döner bıçağı gibi mutfak ekipmanları.",
    },
    image: "/media/categories/hijyen.jpg",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
