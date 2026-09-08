export type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  /** Koli içindeki birim sayısı */
  unitsPerCase: number;
  /** Tek birimin boyutu, örn. "2,5 kg" */
  unitSize: string;
  /** Birim etiketi: Paket, Adet, Şişe, Kova... */
  unitLabel: string;
  tags?: string[];
};

export const products: Product[] = [
  // Soslar
  { id: "s1", sku: "MX-SOS-001", name: "Mayonez Kova", brand: "Vandemoortele", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["fritür", "çok satan"] },
  { id: "s2", sku: "MX-SOS-002", name: "Samurai Sos", brand: "Devos Lemmens", category: "soslar", unitsPerCase: 6, unitSize: "3 L", unitLabel: "Şişe", tags: ["çok satan"] },
  { id: "s3", sku: "MX-SOS-003", name: "Andalouse Sos", brand: "Devos Lemmens", category: "soslar", unitsPerCase: 6, unitSize: "3 L", unitLabel: "Şişe" },
  { id: "s4", sku: "MX-SOS-004", name: "Curry Ketçap", brand: "Vandemoortele", category: "soslar", unitsPerCase: 4, unitSize: "5 L", unitLabel: "Bidon" },
  { id: "s5", sku: "MX-SOS-005", name: "Tartar Sos", brand: "Maximus Select", category: "soslar", unitsPerCase: 6, unitSize: "1 L", unitLabel: "Şişe" },
  { id: "s6", sku: "MX-SOS-006", name: "Ketçap Sıkma Şişe", brand: "Heinz", category: "soslar", unitsPerCase: 12, unitSize: "875 ml", unitLabel: "Şişe" },
  { id: "s7", sku: "MX-SOS-007", name: "Sarımsak Sosu", brand: "Maximus Select", category: "soslar", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Kova", tags: ["döner"] },
  { id: "s8", sku: "MX-SOS-008", name: "Acı Sos (Hot Sauce)", brand: "Maximus Select", category: "soslar", unitsPerCase: 6, unitSize: "1 L", unitLabel: "Şişe", tags: ["döner"] },
  { id: "s9", sku: "MX-SOS-009", name: "Pita Sos", brand: "Devos Lemmens", category: "soslar", unitsPerCase: 6, unitSize: "3 L", unitLabel: "Şişe" },
  { id: "s10", sku: "MX-SOS-010", name: "Porsiyon Sos Karışık", brand: "Vandemoortele", category: "soslar", unitsPerCase: 200, unitSize: "25 ml", unitLabel: "Adet" },

  // Et Ürünleri
  { id: "e1", sku: "MX-ET-001", name: "Tavuk Döner Şiş", brand: "Maximus Meat", category: "et-urunleri", unitsPerCase: 1, unitSize: "20 kg", unitLabel: "Şiş", tags: ["döner", "çok satan"] },
  { id: "e2", sku: "MX-ET-002", name: "Dana-Kuzu Döner Şiş", brand: "Maximus Meat", category: "et-urunleri", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Şiş", tags: ["döner"] },
  { id: "e3", sku: "MX-ET-003", name: "Tavuk Göğsü Fileto", brand: "Plukon", category: "et-urunleri", unitsPerCase: 2, unitSize: "5 kg", unitLabel: "Paket" },
  { id: "e4", sku: "MX-ET-004", name: "Dana Kıyma", brand: "Maximus Meat", category: "et-urunleri", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket" },
  { id: "e5", sku: "MX-ET-005", name: "Marine Tavuk Kanat", brand: "Plukon", category: "et-urunleri", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket" },
  { id: "e6", sku: "MX-ET-006", name: "Köfte Hazır Şekilli", brand: "Maximus Meat", category: "et-urunleri", unitsPerCase: 5, unitSize: "2 kg", unitLabel: "Paket" },
  { id: "e7", sku: "MX-ET-007", name: "Dana Sucuk", brand: "Maximus Meat", category: "et-urunleri", unitsPerCase: 10, unitSize: "1 kg", unitLabel: "Adet" },
  { id: "e8", sku: "MX-ET-008", name: "Hamburger Köftesi", brand: "Maximus Meat", category: "et-urunleri", unitsPerCase: 48, unitSize: "100 g", unitLabel: "Adet" },

  // Dondurulmuş
  { id: "d1", sku: "MX-DON-001", name: "Patates Kızartması 10 mm", brand: "Lutosa", category: "dondurulmus", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket", tags: ["fritür", "çok satan"] },
  { id: "d2", sku: "MX-DON-002", name: "Patates Kızartması 7 mm", brand: "Lutosa", category: "dondurulmus", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket", tags: ["fritür"] },
  { id: "d3", sku: "MX-DON-003", name: "Peynirli Kroket", brand: "Mora", category: "dondurulmus", unitsPerCase: 24, unitSize: "70 g", unitLabel: "Adet" },
  { id: "d4", sku: "MX-DON-004", name: "Frikandel", brand: "Mora", category: "dondurulmus", unitsPerCase: 40, unitSize: "80 g", unitLabel: "Adet", tags: ["fritür"] },
  { id: "d5", sku: "MX-DON-005", name: "Bitterballen", brand: "Mora", category: "dondurulmus", unitsPerCase: 96, unitSize: "30 g", unitLabel: "Adet" },
  { id: "d6", sku: "MX-DON-006", name: "Soğan Halkası", brand: "McCain", category: "dondurulmus", unitsPerCase: 6, unitSize: "1 kg", unitLabel: "Paket" },
  { id: "d7", sku: "MX-DON-007", name: "Karışık Sebze", brand: "Ardo", category: "dondurulmus", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket" },
  { id: "d8", sku: "MX-DON-008", name: "Pide Ekmeği", brand: "Maximus Select", category: "dondurulmus", unitsPerCase: 60, unitSize: "Adet", unitLabel: "Adet", tags: ["döner"] },
  { id: "d9", sku: "MX-DON-009", name: "Mozzarella Çubuk", brand: "McCain", category: "dondurulmus", unitsPerCase: 6, unitSize: "1 kg", unitLabel: "Paket" },

  // Ambalaj
  { id: "a1", sku: "MX-AMB-001", name: "Patates Külahı Küçük", brand: "Packo", category: "ambalaj", unitsPerCase: 1000, unitSize: "Adet", unitLabel: "Adet", tags: ["fritür"] },
  { id: "a2", sku: "MX-AMB-002", name: "Kraft Menü Kutusu", brand: "Packo", category: "ambalaj", unitsPerCase: 200, unitSize: "Adet", unitLabel: "Adet", tags: ["çok satan"] },
  { id: "a3", sku: "MX-AMB-003", name: "Alüminyum Kap + Kapak", brand: "Packo", category: "ambalaj", unitsPerCase: 100, unitSize: "900 ml", unitLabel: "Adet" },
  { id: "a4", sku: "MX-AMB-004", name: "Dürüm Sargı Kağıdı", brand: "Packo", category: "ambalaj", unitsPerCase: 1000, unitSize: "Adet", unitLabel: "Adet", tags: ["döner"] },
  { id: "a5", sku: "MX-AMB-005", name: "Peçete 1 Katlı", brand: "Tork", category: "ambalaj", unitsPerCase: 5000, unitSize: "Adet", unitLabel: "Adet" },
  { id: "a6", sku: "MX-AMB-006", name: "Alüminyum Folyo", brand: "Packo", category: "ambalaj", unitsPerCase: 6, unitSize: "150 m", unitLabel: "Rulo" },
  { id: "a7", sku: "MX-AMB-007", name: "Sos Kabı + Kapak", brand: "Packo", category: "ambalaj", unitsPerCase: 1000, unitSize: "80 ml", unitLabel: "Adet" },
  { id: "a8", sku: "MX-AMB-008", name: "Taşıma Poşeti", brand: "Packo", category: "ambalaj", unitsPerCase: 500, unitSize: "Adet", unitLabel: "Adet" },

  // İçecekler
  { id: "i1", sku: "MX-ICE-001", name: "Coca-Cola Kutu", brand: "Coca-Cola", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu", tags: ["çok satan"] },
  { id: "i2", sku: "MX-ICE-002", name: "Fanta Portakal Kutu", brand: "Coca-Cola", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "i3", sku: "MX-ICE-003", name: "Doğal Kaynak Suyu", brand: "Spa", category: "icecekler", unitsPerCase: 24, unitSize: "50 cl", unitLabel: "Şişe" },
  { id: "i4", sku: "MX-ICE-004", name: "Ayran", brand: "Maximus Select", category: "icecekler", unitsPerCase: 20, unitSize: "25 cl", unitLabel: "Şişe", tags: ["döner"] },
  { id: "i5", sku: "MX-ICE-005", name: "Ice Tea Şeftali", brand: "Lipton", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "i6", sku: "MX-ICE-006", name: "Portakal Suyu", brand: "Minute Maid", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Şişe" },
  { id: "i7", sku: "MX-ICE-007", name: "Şalgam Suyu", brand: "Maximus Select", category: "icecekler", unitsPerCase: 12, unitSize: "1 L", unitLabel: "Şişe" },

  // Bakliyat & Tahıl
  { id: "k1", sku: "MX-KUR-001", name: "Baldo Pirinç", brand: "Maximus Select", category: "kuru-gida", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Çuval", tags: ["çok satan"] },
  { id: "k2", sku: "MX-KUR-002", name: "Pilavlık Bulgur", brand: "Maximus Select", category: "kuru-gida", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Çuval" },
  { id: "k3", sku: "MX-KUR-003", name: "Kırmızı Mercimek", brand: "Maximus Select", category: "kuru-gida", unitsPerCase: 4, unitSize: "5 kg", unitLabel: "Paket" },
  { id: "k4", sku: "MX-KUR-004", name: "Nohut 8 mm", brand: "Maximus Select", category: "kuru-gida", unitsPerCase: 4, unitSize: "5 kg", unitLabel: "Paket" },
  { id: "k5", sku: "MX-KUR-005", name: "Un Tip 00", brand: "Ceres", category: "kuru-gida", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Çuval" },
  { id: "k6", sku: "MX-KUR-006", name: "Spagetti", brand: "Barilla", category: "kuru-gida", unitsPerCase: 6, unitSize: "3 kg", unitLabel: "Paket" },
  { id: "k7", sku: "MX-KUR-007", name: "Ayçiçek Yağı", brand: "Vandemoortele", category: "kuru-gida", unitsPerCase: 1, unitSize: "10 L", unitLabel: "Bidon", tags: ["fritür"] },
  { id: "k8", sku: "MX-KUR-008", name: "Pul Biber", brand: "Maximus Select", category: "kuru-gida", unitsPerCase: 6, unitSize: "1 kg", unitLabel: "Paket", tags: ["döner"] },
];

export function formatPackaging(p: Product): string {
  return p.unitsPerCase === 1
    ? `1 x ${p.unitSize}`
    : `${p.unitsPerCase} x ${p.unitSize}`;
}

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
