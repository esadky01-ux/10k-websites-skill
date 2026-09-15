import type { CountryCode, Location } from "@/types";

/**
 * Hizmet verilen şehirler ve havalimanları. Yeni konum eklemek için bu diziye
 * bir kayıt ve `src/i18n/dictionaries/tr.json` içindeki `locations` nesnesine
 * aynı `id` ile bir ad ekleyin. Koordinatlar fiyat tahmininde (kuş uçuşu × 1.25)
 * kullanılır.
 */
export const locations: Location[] = [
  // Belçika
  { id: "brussels", name: "locations.brussels", country: "BE", type: "city", lat: 50.8503, lng: 4.3517 },
  { id: "antwerp", name: "locations.antwerp", country: "BE", type: "city", lat: 51.2194, lng: 4.4025 },
  { id: "ghent", name: "locations.ghent", country: "BE", type: "city", lat: 51.0543, lng: 3.7174 },
  { id: "bruges", name: "locations.bruges", country: "BE", type: "city", lat: 51.2093, lng: 3.2247 },
  { id: "liege", name: "locations.liege", country: "BE", type: "city", lat: 50.6326, lng: 5.5797 },
  { id: "leuven", name: "locations.leuven", country: "BE", type: "city", lat: 50.8798, lng: 4.7005 },
  { id: "charleroi", name: "locations.charleroi", country: "BE", type: "city", lat: 50.4108, lng: 4.4446 },
  { id: "bru-airport", name: "locations.bru-airport", country: "BE", type: "airport", iata: "BRU", lat: 50.901, lng: 4.4844 },
  { id: "crl-airport", name: "locations.crl-airport", country: "BE", type: "airport", iata: "CRL", lat: 50.4592, lng: 4.4525 },

  // Hollanda
  { id: "amsterdam", name: "locations.amsterdam", country: "NL", type: "city", lat: 52.3676, lng: 4.9041 },
  { id: "rotterdam", name: "locations.rotterdam", country: "NL", type: "city", lat: 51.9244, lng: 4.4777 },
  { id: "the-hague", name: "locations.the-hague", country: "NL", type: "city", lat: 52.0705, lng: 4.3007 },
  { id: "utrecht", name: "locations.utrecht", country: "NL", type: "city", lat: 52.0907, lng: 5.1214 },
  { id: "eindhoven", name: "locations.eindhoven", country: "NL", type: "city", lat: 51.4416, lng: 5.4697 },
  { id: "maastricht", name: "locations.maastricht", country: "NL", type: "city", lat: 50.8514, lng: 5.691 },
  { id: "ams-airport", name: "locations.ams-airport", country: "NL", type: "airport", iata: "AMS", lat: 52.3105, lng: 4.7683 },
  { id: "ein-airport", name: "locations.ein-airport", country: "NL", type: "airport", iata: "EIN", lat: 51.45, lng: 5.3745 },

  // Fransa
  { id: "paris", name: "locations.paris", country: "FR", type: "city", lat: 48.8566, lng: 2.3522 },
  { id: "lille", name: "locations.lille", country: "FR", type: "city", lat: 50.6292, lng: 3.0573 },
  { id: "reims", name: "locations.reims", country: "FR", type: "city", lat: 49.2583, lng: 4.0317 },
  { id: "strasbourg", name: "locations.strasbourg", country: "FR", type: "city", lat: 48.5734, lng: 7.7521 },
  { id: "metz", name: "locations.metz", country: "FR", type: "city", lat: 49.1193, lng: 6.1757 },
  { id: "cdg-airport", name: "locations.cdg-airport", country: "FR", type: "airport", iata: "CDG", lat: 49.0097, lng: 2.5479 },
  { id: "ory-airport", name: "locations.ory-airport", country: "FR", type: "airport", iata: "ORY", lat: 48.7262, lng: 2.3652 },
  { id: "lil-airport", name: "locations.lil-airport", country: "FR", type: "airport", iata: "LIL", lat: 50.5619, lng: 3.0894 },

  // Almanya
  { id: "cologne", name: "locations.cologne", country: "DE", type: "city", lat: 50.9375, lng: 6.9603 },
  { id: "dusseldorf", name: "locations.dusseldorf", country: "DE", type: "city", lat: 51.2277, lng: 6.7735 },
  { id: "aachen", name: "locations.aachen", country: "DE", type: "city", lat: 50.7753, lng: 6.0839 },
  { id: "frankfurt", name: "locations.frankfurt", country: "DE", type: "city", lat: 50.1109, lng: 8.6821 },
  { id: "dortmund", name: "locations.dortmund", country: "DE", type: "city", lat: 51.5136, lng: 7.4653 },
  { id: "dus-airport", name: "locations.dus-airport", country: "DE", type: "airport", iata: "DUS", lat: 51.2895, lng: 6.7668 },
  { id: "cgn-airport", name: "locations.cgn-airport", country: "DE", type: "airport", iata: "CGN", lat: 50.8659, lng: 7.1427 },
  { id: "fra-airport", name: "locations.fra-airport", country: "DE", type: "airport", iata: "FRA", lat: 50.0379, lng: 8.5622 },
];

/** Hizmet verilen ülkeler, sitede gösterim sırasıyla. */
export const countries: CountryCode[] = ["BE", "NL", "FR", "DE"];

const byId = new Map(locations.map((l) => [l.id, l]));

export function getLocation(id: string | null | undefined): Location | undefined {
  return id ? byId.get(id) : undefined;
}

export function isLocationId(id: string | null | undefined): id is string {
  return typeof id === "string" && byId.has(id);
}

export const locationIds = locations.map((l) => l.id);

export function locationsByCountry(country: CountryCode): Location[] {
  return locations.filter((l) => l.country === country);
}

export function airports(): Location[] {
  return locations.filter((l) => l.type === "airport");
}
