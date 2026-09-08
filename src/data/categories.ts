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
      "Pauwels kova sosları (Cocktail, Andalouse, Look, Samurai, Mayo Chef), sambal, Tabasco ve helal bolonez. Fritür ve döner tezgâhının vazgeçilmezleri.",
    image: "/media/categories/soslar.jpg",
  },
  {
    slug: "et-urunleri",
    name: "Et Ürünleri",
    shortName: "Et",
    description:
      "Polat döner şişleri, tavuk ve dana ürünleri, helal köfte. Soğuk zincir garantili, HACCP belgeli tedarik.",
    image: "/media/categories/et-urunleri.jpg",
  },
  {
    slug: "dondurulmus",
    name: "Dondurulmuş Ürünler",
    shortName: "Dondurulmuş",
    description:
      "Lutosa patates kızartması, Van Reusel atıştırmalıklar, pide ve pizza tabanları. Fritür ve pizzacılar için tam seçki.",
    image: "/media/categories/dondurulmus.jpg",
  },
  {
    slug: "konserve",
    name: "Konserve",
    shortName: "Konserve",
    description:
      "Jalapeño, soyulmuş domates, enginar ve ton balığı. Pizza ve döner mutfağının temel konserveleri.",
    image: "/media/categories/konserve.jpg",
  },
  {
    slug: "ambalaj",
    name: "Ambalaj",
    shortName: "Ambalaj",
    description:
      "Pizza kutuları, patates kapları, döner ve menü kutuları, alüminyum kaplar, taşıma poşetleri ve folyo. Paket servisin tüm ihtiyacı.",
    image: "/media/categories/ambalaj.jpg",
  },
  {
    slug: "icecekler",
    name: "İçecekler",
    shortName: "İçecekler",
    description:
      "Coca-Cola, Pepsi, Fanta, Lipton, Uludağ, Kızılay, ayran, enerji içecekleri ve su. Kasa bazında hızlı teslimat.",
    image: "/media/categories/icecekler.jpg",
  },
  {
    slug: "kuru-gida",
    name: "Kuru Gıda",
    shortName: "Kuru Gıda",
    description:
      "Caputo ve Ceres unları, pirinç, bulgur, bakliyat, makarna ve baharatlar. Büyük ambalajlı, uzun raf ömürlü temel gıdalar.",
    image: "/media/categories/kuru-gida.jpg",
  },
  {
    slug: "hijyen",
    name: "Hijyen & Temizlik",
    shortName: "Hijyen",
    description:
      "Nitril eldiven, el sabunu, cam temizleyici, ızgara temizleyici, dezenfektan ve Maximus çok amaçlı temizleyici.",
    image: "/media/categories/hijyen.jpg",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
