export type Category = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  image: string;
};

export const categories: Category[] = [
  {
    slug: "soslar",
    name: "Soslar",
    shortName: "Soslar",
    description:
      "Pauwels kova ve şişe sosları (Andalouse, Samurai, Cocktail, Curry, Mayo Chef), Bicky, sambal, Tabasco ve helal bolonez. Fritür ve döner tezgâhının vazgeçilmezleri.",
    image: "/media/categories/soslar.jpg",
  },
  {
    slug: "et-urunleri",
    name: "Et Ürünleri",
    shortName: "Et",
    description:
      "Maximus, Dost, Düzgün, Polat ve Efendi döner şişleri; tavuk, dana ve hindi ürünleri; helal köfte, salam ve pepperoni. Soğuk zincir garantili.",
    image: "/media/categories/et-urunleri.jpg",
  },
  {
    slug: "dondurulmus",
    name: "Dondurulmuş Ürünler",
    shortName: "Dondurulmuş",
    description:
      "Lutosa ve Sela patates kızartması, Van Reusel, Mekkafood ve Dunya atıştırmalıkları, kroketler, deniz ürünleri ve tatlılar.",
    image: "/media/categories/dondurulmus.jpg",
  },
  {
    slug: "konserve",
    name: "Konserve & Turşu",
    shortName: "Konserve",
    description:
      "Soyulmuş domates, pizza sosu, jalapeño, Yunan biberi, enginar, ton balığı, hamsi, kapari ve turşular. Pizza ve döner mutfağının temel konserveleri.",
    image: "/media/categories/konserve.jpg",
  },
  {
    slug: "peynir-sut",
    name: "Peynir & Süt Ürünleri",
    shortName: "Peynir",
    description:
      "Rendelenmiş ve blok mozzarella, Gouda, Gorgonzola, Gazi beyaz peynir, parmesan ve krema. Pizzacılar için tam seçki.",
    image: "/media/categories/peynir-sut.jpg",
  },
  {
    slug: "ekmek-hamur",
    name: "Ekmek & Hamur İşleri",
    shortName: "Ekmek",
    description:
      "Fırat döner pidesi, gobit ekmeği, lahmacun tabanları, dürüm lavaşı ve tortilla, Foster ve Piazzola pizza hamur topları.",
    image: "/media/categories/ekmek-hamur.jpg",
  },
  {
    slug: "kuru-gida",
    name: "Kuru Gıda & Baharat",
    shortName: "Kuru Gıda",
    description:
      "Caputo ve Primo unları, Barilla makarnalar, Hane ve Nawras bakliyat ve pirinç, baharatlar, kızartma ve zeytinyağları, çay ve şeker.",
    image: "/media/categories/kuru-gida.jpg",
  },
  {
    slug: "icecekler",
    name: "İçecekler",
    shortName: "İçecekler",
    description:
      "Coca-Cola, Pepsi, Fanta, Lipton, Looza, Capri Sun, Uludağ, Kızılay, Çamlıca, ayran, şalgam, enerji içecekleri, su, bira ve Kavaklıdere şarapları.",
    image: "/media/categories/icecekler.jpg",
  },
  {
    slug: "ambalaj",
    name: "Ambalaj",
    shortName: "Ambalaj",
    description:
      "Pizza kutuları, patates ve frikandel kapları, döner, menü ve hamburger kutuları, alüminyum kaplar, taşıma poşetleri, sargı kağıdı, çatal-bıçak ve peçete.",
    image: "/media/categories/ambalaj.jpg",
  },
  {
    slug: "hijyen",
    name: "Hijyen & Mutfak",
    shortName: "Hijyen",
    description:
      "Nitril eldiven, el sabunu, cam ve ızgara temizleyici, dezenfektan, tuvalet kağıdı, çöp poşeti ve döner bıçağı gibi mutfak ekipmanları.",
    image: "/media/categories/hijyen.jpg",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
