export type Category = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  image: string;
  accent: string;
};

export const categories: Category[] = [
  {
    slug: "soslar",
    name: "Soslar",
    shortName: "Soslar",
    description:
      "Mayonez, ketçap, samurai, andalouse, curry ve fritür sosları. Belçika lezzetinin vazgeçilmezleri, kova ve sıkma şişe formatında.",
    image: "/media/categories/soslar.jpg",
    accent: "from-amber-500/80",
  },
  {
    slug: "et-urunleri",
    name: "Et Ürünleri",
    shortName: "Et",
    description:
      "Döner, tavuk, kıyma ve marine etler. Soğuk zincir garantili, HACCP belgeli tedarik.",
    image: "/media/categories/et-urunleri.jpg",
    accent: "from-red-600/80",
  },
  {
    slug: "dondurulmus",
    name: "Dondurulmuş Ürünler",
    shortName: "Dondurulmuş",
    description:
      "Patates kızartması, kroket, atıştırmalıklar ve dondurulmuş sebzeler. Fritür ve fast-food işletmeleri için tam kapsamlı seçki.",
    image: "/media/categories/dondurulmus.jpg",
    accent: "from-sky-500/80",
  },
  {
    slug: "ambalaj",
    name: "Ambalaj",
    shortName: "Ambalaj",
    description:
      "Paket servis kutuları, patates külahları, alüminyum kaplar, peçete ve folyo. Restoranınızın tüm ambalaj ihtiyacı tek adreste.",
    image: "/media/categories/ambalaj.jpg",
    accent: "from-stone-500/80",
  },
  {
    slug: "icecekler",
    name: "İçecekler",
    shortName: "İçecekler",
    description:
      "Gazlı içecekler, su, ayran, meyve suları ve soğuk çay. Kasa ve tepsi bazında hızlı teslimat.",
    image: "/media/categories/icecekler.jpg",
    accent: "from-blue-600/80",
  },
  {
    slug: "kuru-gida",
    name: "Bakliyat & Tahıl",
    shortName: "Kuru Gıda",
    description:
      "Pirinç, bulgur, un, mercimek, nohut, makarna ve baharatlar. Büyük ambalajlı, uzun raf ömürlü temel gıdalar.",
    image: "/media/categories/kuru-gida.jpg",
    accent: "from-yellow-600/80",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
