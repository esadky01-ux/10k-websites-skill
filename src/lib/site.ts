export const site = {
  name: "MAXIMUS Food & Horeca",
  shortName: "MAXIMUS",
  tagline: "Belçika Horeca sektörünün toptan gıda ortağı",
  address: {
    street: "Nieuwlandlaan 111",
    postal: "3200",
    city: "Aarschot",
    country: "Belçika",
    full: "Nieuwlandlaan 111, 3200 Aarschot, Belçika",
  },
  phone: "+32 16 00 00 00",
  phoneDisplay: "+32 16 00 00 00",
  whatsapp: "32460000000",
  email: "siparis@maximusfood.be",
  hours: "Pzt – Cum 07:00 – 17:00 · Cmt 08:00 – 13:00",
  pickupDiscount: 0.15,
  url: "https://maximusfood.be",
};

export const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(site.address.full);
