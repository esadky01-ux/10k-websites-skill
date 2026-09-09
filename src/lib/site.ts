export const site = {
  name: "MAXIMUS Food & Horeca",
  shortName: "Maximus",
  tagline: "Quality Food. Trusted Partner.",
  founded: 2020,
  address: {
    street: "Nieuwlandlaan 111, Unit 3-4",
    postal: "3200",
    city: "Aarschot",
    country: "Belçika",
    full: "Nieuwlandlaan 111, Unit 3-4, 3200 Aarschot, Belçika",
  },
  phone: "+32 467 07 71 64",
  phoneDisplay: "+32 467 07 71 64",
  whatsapp: "32467077164",
  email: "info@maximusfood.be",
  hours: "Pzt – Cum 08:00 – 17:00 · Cmt 09:00 – 13:00",
  pickupDiscount: 0.15,
  url: "https://maximusfood.be",
  serviceArea: "Belçika & Hollanda",
  geo: { lat: 50.9932, lng: 4.8377 },
};

export type Partner = {
  name: string;
  /** public/media/partners altındaki logo dosyası; yoksa yalnızca isim gösterilir */
  logo?: string;
  /** Logo yalnızca simge ise (kelime markası yoksa) isim logonun yanında gösterilir */
  markOnly?: boolean;
  /** Koyu zemin gerektiren logolar */
  dark?: boolean;
};

export const partners: Partner[] = [
  { name: "Dostfood", logo: "/media/partners/dostfood.png", markOnly: true },
  { name: "Lipton", logo: "/media/partners/lipton.png" },
  { name: "Polat Dönerproduktion", logo: "/media/partners/polat.svg" },
  { name: "Pauwels Sauces", logo: "/media/partners/pauwels.png" },
  { name: "Düzgün" },
  { name: "Poco Loco", logo: "/media/partners/pocoloco.png" },
  { name: "Ceres", logo: "/media/partners/ceres.svg" },
  { name: "Van Reusel", logo: "/media/partners/vanreusel.svg" },
  { name: "Pepsi", logo: "/media/partners/pepsi.svg" },
  { name: "Lutosa", logo: "/media/partners/lutosa.png" },
  { name: "Coca-Cola", logo: "/media/partners/cocacola.png" },
  { name: "Foster" },
  { name: "Caputo" },
  { name: "Mekkafood", logo: "/media/partners/mekkafood.svg" },
  { name: "Fırat Bakery" },
  { name: "Ruco Foods", logo: "/media/partners/rucofoods.png", markOnly: true },
  { name: "Epic Seafood", logo: "/media/partners/epic.png", dark: true },
];

export const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("Nieuwlandlaan 111, 3200 Aarschot, Belgium");
