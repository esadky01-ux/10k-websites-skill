export type Product = {
  id: string;
  /** Katalog ürün numarası. Birden fazla varyantı olan ürünlerde "Çeşitli". */
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

const CESITLI = "Çeşitli";

export const products: Product[] = [
  // ───────────── Soslar (katalog: Sauzen) ─────────────
  { id: "szn-cocktail", sku: CESITLI, name: "Pauwels Cocktail Sos (Helal)", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["fritür", "çok satan"] },
  { id: "szn-andalouse", sku: CESITLI, name: "Pauwels Andalouse Sos", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["fritür", "çok satan"] },
  { id: "szn-look", sku: CESITLI, name: "Pauwels Look / Sarımsak Sosu", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["döner", "çok satan"] },
  { id: "szn-samurai", sku: CESITLI, name: "Pauwels Samurai Sos", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["fritür", "çok satan"] },
  { id: "szn-mayochef", sku: CESITLI, name: "Pauwels Mayo Chef", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["fritür"] },
  { id: "FD-SZN-074", sku: "FD-SZN-074", name: "Pauwels Fritür Mayonezi", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["fritür"] },
  { id: "FD-SZN-004", sku: "FD-SZN-004", name: "Pauwels Amerikan Sos", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "5 kg", unitLabel: "Kova" },
  { id: "FD-SZN-061", sku: "FD-SZN-061", name: "Pauwels Triple Sos", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "3 kg", unitLabel: "Kova" },
  { id: "FD-SZN-051", sku: "FD-SZN-051", name: "Pauwels Frenk Soğanlı Vinegret", brand: "Pauwels", category: "soslar", unitsPerCase: 1, unitSize: "2 kg", unitLabel: "Kova" },
  { id: "FD-SZN-022", sku: "FD-SZN-022", name: "Rema Slafris Naturel (Salata Sosu)", brand: "Rema", category: "soslar", unitsPerCase: 1, unitSize: "800 g", unitLabel: "Adet" },
  { id: "FD-SZN-021", sku: "FD-SZN-021", name: "Sambal", brand: "Maximus", category: "soslar", unitsPerCase: 6, unitSize: "750 g", unitLabel: "Kavanoz", tags: ["döner"] },
  { id: "FD-SZN-072", sku: "FD-SZN-072", name: "Sambal", brand: "Maximus", category: "soslar", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Kova", tags: ["döner"] },
  { id: "FD-SZN-002", sku: "FD-SZN-002", name: "Sambal Gala", brand: "Maximus", category: "soslar", unitsPerCase: 1, unitSize: "1 kg", unitLabel: "Kavanoz" },
  { id: "FD-SZN-019", sku: "FD-SZN-019", name: "Sambal Oelek", brand: "Maximus", category: "soslar", unitsPerCase: 1, unitSize: "1 kg", unitLabel: "Kavanoz" },
  { id: "FD-SZN-020", sku: "FD-SZN-020", name: "Tabasco Acı Sos", brand: "Tabasco", category: "soslar", unitsPerCase: 1, unitSize: "350 g", unitLabel: "Şişe" },
  { id: "FD-DRV-013", sku: "FD-DRV-013", name: "Bolonez Sos (Helal)", brand: "Maximus", category: "soslar", unitsPerCase: 12, unitSize: "680 g", unitLabel: "Kavanoz", tags: ["pizza"] },

  // ───────────── Et Ürünleri ─────────────
  { id: "et-doner-tavuk", sku: CESITLI, name: "Tavuk Döner Şiş", brand: "Polat Dönerproduktion", category: "et-urunleri", unitsPerCase: 1, unitSize: "10 – 40 kg", unitLabel: "Şiş", tags: ["döner", "çok satan"] },
  { id: "et-doner-kalfa", sku: CESITLI, name: "Dana-Hindi Döner Şiş", brand: "Polat Dönerproduktion", category: "et-urunleri", unitsPerCase: 1, unitSize: "10 – 40 kg", unitLabel: "Şiş", tags: ["döner"] },
  { id: "et-doner-kuzu", sku: CESITLI, name: "Kuzu-Dana Döner Şiş", brand: "Polat Dönerproduktion", category: "et-urunleri", unitsPerCase: 1, unitSize: "10 – 40 kg", unitLabel: "Şiş", tags: ["döner"] },
  { id: "et-doner-dilim", sku: CESITLI, name: "Dilimlenmiş Döner (Dondurulmuş)", brand: "Polat Dönerproduktion", category: "et-urunleri", unitsPerCase: 1, unitSize: "5 kg", unitLabel: "Paket", tags: ["döner"] },
  { id: "et-tavuk-gogus", sku: CESITLI, name: "Tavuk Göğsü Fileto", brand: "Dostfood", category: "et-urunleri", unitsPerCase: 2, unitSize: "5 kg", unitLabel: "Paket" },
  { id: "et-kanat", sku: CESITLI, name: "Marine Tavuk Kanat", brand: "Dostfood", category: "et-urunleri", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket" },
  { id: "et-kofte", sku: CESITLI, name: "Köfte (Helal)", brand: "Mekkafood", category: "et-urunleri", unitsPerCase: 5, unitSize: "2 kg", unitLabel: "Paket" },
  { id: "et-burger", sku: CESITLI, name: "Hamburger Köftesi (Helal)", brand: "Mekkafood", category: "et-urunleri", unitsPerCase: 48, unitSize: "100 g", unitLabel: "Adet" },
  { id: "et-sucuk", sku: CESITLI, name: "Dana Sucuk", brand: "Dostfood", category: "et-urunleri", unitsPerCase: 10, unitSize: "1 kg", unitLabel: "Adet", tags: ["pizza"] },

  // ───────────── Dondurulmuş Ürünler ─────────────
  { id: "don-frites-10", sku: CESITLI, name: "Patates Kızartması 10 mm", brand: "Lutosa", category: "dondurulmus", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket", tags: ["fritür", "çok satan"] },
  { id: "don-frites-7", sku: CESITLI, name: "Patates Kızartması 7 mm", brand: "Lutosa", category: "dondurulmus", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket", tags: ["fritür"] },
  { id: "don-frikandel", sku: CESITLI, name: "Frikandel", brand: "Van Reusel", category: "dondurulmus", unitsPerCase: 40, unitSize: "80 g", unitLabel: "Adet", tags: ["fritür"] },
  { id: "don-kroket", sku: CESITLI, name: "Peynirli Kroket", brand: "Van Reusel", category: "dondurulmus", unitsPerCase: 24, unitSize: "70 g", unitLabel: "Adet" },
  { id: "don-bitterballen", sku: CESITLI, name: "Bitterballen", brand: "Van Reusel", category: "dondurulmus", unitsPerCase: 96, unitSize: "30 g", unitLabel: "Adet" },
  { id: "don-pide", sku: CESITLI, name: "Pide Ekmeği (Döner Ekmeği)", brand: "Fırat Bakery", category: "dondurulmus", unitsPerCase: 60, unitSize: "Adet", unitLabel: "Adet", tags: ["döner"] },
  { id: "don-durum", sku: CESITLI, name: "Dürüm Lavaşı", brand: "Fırat Bakery", category: "dondurulmus", unitsPerCase: 12, unitSize: "10 adet", unitLabel: "Paket", tags: ["döner"] },
  { id: "don-pizza-taban", sku: CESITLI, name: "Pizza Tabanı 30 cm", brand: "Ruco Foods", category: "dondurulmus", unitsPerCase: 20, unitSize: "Adet", unitLabel: "Adet", tags: ["pizza"] },
  { id: "don-mozzarella", sku: CESITLI, name: "Rendelenmiş Mozzarella", brand: "Ruco Foods", category: "dondurulmus", unitsPerCase: 4, unitSize: "2,5 kg", unitLabel: "Paket", tags: ["pizza"] },
  { id: "don-karides", sku: CESITLI, name: "Karides (Soyulmuş)", brand: "Epic Seafood", category: "dondurulmus", unitsPerCase: 10, unitSize: "1 kg", unitLabel: "Paket" },
  { id: "don-kalamar", sku: CESITLI, name: "Kalamar Halkası", brand: "Epic Seafood", category: "dondurulmus", unitsPerCase: 10, unitSize: "1 kg", unitLabel: "Paket" },

  // ───────────── Konserve (katalog: Conserven) ─────────────
  { id: "FD-GRF-005", sku: "FD-GRF-005", name: "Adal Yunan Biberi", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "7 kg", unitLabel: "Teneke" },
  { id: "FD-GRF-016", sku: "FD-GRF-016", name: "Adal Jalapeño (net 6 kg)", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "13 kg", unitLabel: "Teneke", tags: ["pizza"] },
  { id: "FD-GRF-022", sku: "FD-GRF-022", name: "Elegaz Jalapeño", brand: "Elegaz", category: "konserve", unitsPerCase: 1, unitSize: "1,5 kg", unitLabel: "Kavanoz", tags: ["pizza"] },
  { id: "FD-GRF-008", sku: "FD-GRF-008", name: "Adal Sivri Biber", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "5 kg", unitLabel: "Teneke", tags: ["döner"] },
  { id: "FD-KRD-019", sku: "FD-KRD-019", name: "Adal Karışık Zeytin (Tuzlu)", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "1 kg", unitLabel: "Kavanoz" },
  { id: "FD-GRF-023", sku: "FD-GRF-023", name: "Adal Karışık Zeytin (Tuzlu)", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "400 g", unitLabel: "Kavanoz" },
  { id: "FD-GRF-018", sku: "FD-GRF-018", name: "Adal Yeşil Kırma Zeytin", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "10 kg", unitLabel: "Teneke" },
  { id: "FD-GRF-002", sku: "FD-GRF-002", name: "Adal Yeşil Kırma Zeytin", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "400 g", unitLabel: "Kavanoz" },
  { id: "FD-GRF-009", sku: "FD-GRF-009", name: "Adal Yeşil Kırma Zeytin (Tuzlu)", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "1 kg", unitLabel: "Kavanoz" },
  { id: "FD-GRF-004", sku: "FD-GRF-004", name: "Adal Yeşil Kırma Zeytin (Tuzlu)", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "400 g", unitLabel: "Kavanoz" },
  { id: "FD-GRF-017", sku: "FD-GRF-017", name: "Adal Yeşil Zeytin", brand: "Adal", category: "konserve", unitsPerCase: 1, unitSize: "4,1 kg", unitLabel: "Teneke" },
  { id: "FD-PZT-001", sku: "FD-PZT-001", name: "Marco Polo Enginar", brand: "Marco Polo", category: "konserve", unitsPerCase: 1, unitSize: "2.650 ml", unitLabel: "Teneke", tags: ["pizza"] },
  { id: "FD-GRF-014", sku: "FD-GRF-014", name: "Soyulmuş Domates", brand: "Maximus", category: "konserve", unitsPerCase: 1, unitSize: "2,5 kg", unitLabel: "Teneke", tags: ["pizza"] },
  { id: "FD-VIS-002", sku: "FD-VIS-002", name: "La Perla Ton Balığı (Kendi Suyunda)", brand: "La Perla", category: "konserve", unitsPerCase: 1, unitSize: "1.705 g", unitLabel: "Teneke", tags: ["pizza"] },
  { id: "FD-VIS-005", sku: "FD-VIS-005", name: "Marco Polo Ton Balığı (Yağlı)", brand: "Marco Polo", category: "konserve", unitsPerCase: 48, unitSize: "185 g", unitLabel: "Teneke" },
  { id: "FD-VIS-004", sku: "FD-VIS-004", name: "Ton Balığı (Yağlı)", brand: "Maximus", category: "konserve", unitsPerCase: 1, unitSize: "185 g", unitLabel: "Teneke" },

  // ───────────── Ambalaj (katalog: Verpakking) ─────────────
  { id: "NF-DZN-003", sku: "NF-DZN-003", name: "Pizza Kutusu Calzone Çift Kraft 30x30 cm", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet", tags: ["pizza"] },
  { id: "amb-pizza-wit", sku: CESITLI, name: "Pizza Kutusu Çift Kraft Beyaz (24 – 50 cm)", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet", tags: ["pizza", "çok satan"] },
  { id: "amb-pizza-bruin", sku: CESITLI, name: "Pizza Kutusu Çift Kraft Kahverengi (24 – 50 cm)", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet", tags: ["pizza"] },
  { id: "amb-frietbak-wit", sku: CESITLI, name: "Patates Kabı Beyaz (çeşitli boy)", brand: "Maximus", category: "ambalaj", unitsPerCase: 250, unitSize: "Adet", unitLabel: "Adet", tags: ["fritür"] },
  { id: "amb-frietbak-bruin", sku: CESITLI, name: "Patates Kabı Kahverengi (çeşitli boy)", brand: "Maximus", category: "ambalaj", unitsPerCase: 250, unitSize: "Adet", unitLabel: "Adet", tags: ["fritür"] },
  { id: "amb-frikandelbak", sku: CESITLI, name: "Frikandel Kabı Beyaz / Kahverengi", brand: "Maximus", category: "ambalaj", unitsPerCase: 250, unitSize: "Adet", unitLabel: "Adet", tags: ["fritür"] },
  { id: "amb-menubox", sku: CESITLI, name: "Menü Kutusu (çeşitli bölmeli)", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet", tags: ["çok satan"] },
  { id: "NF-DZN-016", sku: "NF-DZN-016", name: "Döner Kutusu 26 oz", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet", tags: ["döner", "çok satan"] },
  { id: "amb-hamburgerbox", sku: CESITLI, name: "Hamburger Kutusu (çeşitli boy)", brand: "Maximus", category: "ambalaj", unitsPerCase: 125, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-plastic-schaal", sku: CESITLI, name: "Plastik Sos Kabı 50 – 250 – 500 cc", brand: "Maximus", category: "ambalaj", unitsPerCase: 1000, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-bestek", sku: CESITLI, name: "Plastik Çatal / Kaşık / Bıçak", brand: "Maximus", category: "ambalaj", unitsPerCase: 1000, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-alu-folie", sku: CESITLI, name: "Alüminyum Folyo 30 cm – 14 mikron", brand: "Maximus", category: "ambalaj", unitsPerCase: 1, unitSize: "Rulo", unitLabel: "Rulo" },
  { id: "amb-alu-schaal", sku: CESITLI, name: "Alüminyum Kap (çeşitli boy)", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-alu-deksel", sku: CESITLI, name: "Alüminyum Kap Kapağı (çeşitli boy)", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet" },
  { id: "NF-ALU-007", sku: "NF-ALU-007", name: "Alüminyum Şnitzel Kabı R808", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet" },
  { id: "NF-ALU-008", sku: "NF-ALU-008", name: "Alüminyum Şnitzel Kabı Kapağı R808", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-salade", sku: CESITLI, name: "Salata Kabı (çeşitli boy)", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-salade-deksel", sku: CESITLI, name: "Salata Kabı Kapağı", brand: "Maximus", category: "ambalaj", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-hemd-180x450", sku: CESITLI, name: "Atlet Poşet 180x450 mm", brand: "Maximus", category: "ambalaj", unitsPerCase: 1000, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-hemd-180x480", sku: CESITLI, name: "Atlet Poşet 180x480 mm", brand: "Maximus", category: "ambalaj", unitsPerCase: 1000, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-hemd-180x550", sku: CESITLI, name: "Atlet Poşet 180x550 mm", brand: "Maximus", category: "ambalaj", unitsPerCase: 850, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-hemd-180x600", sku: CESITLI, name: "Atlet Poşet 180x600 mm", brand: "Maximus", category: "ambalaj", unitsPerCase: 750, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-hemd-200x600", sku: CESITLI, name: "Atlet Poşet 200x600 mm", brand: "Maximus", category: "ambalaj", unitsPerCase: 500, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-fruit-140", sku: CESITLI, name: "Rulo Meyve Poşeti 140x450 mm", brand: "Maximus", category: "ambalaj", unitsPerCase: 15, unitSize: "Rulo (2.700 adet)", unitLabel: "Rulo" },
  { id: "amb-fruit-130", sku: CESITLI, name: "Rulo Meyve Poşeti 130x430 mm", brand: "Maximus", category: "ambalaj", unitsPerCase: 15, unitSize: "Rulo (2.700 adet)", unitLabel: "Rulo" },
  { id: "amb-papier-32", sku: CESITLI, name: "Kağıt Taşıma Çantası 32x22x26 cm", brand: "Maximus", category: "ambalaj", unitsPerCase: 250, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-papier-28", sku: CESITLI, name: "Kağıt Taşıma Çantası 28x17x29 cm", brand: "Maximus", category: "ambalaj", unitsPerCase: 250, unitSize: "Adet", unitLabel: "Adet" },
  { id: "amb-papier-22", sku: CESITLI, name: "Kağıt Taşıma Çantası 22x10x28 cm", brand: "Maximus", category: "ambalaj", unitsPerCase: 250, unitSize: "Adet", unitLabel: "Adet" },

  // ───────────── İçecekler (katalog: Dranken) ─────────────
  { id: "drk-cola", sku: CESITLI, name: "Coca-Cola / Cola Zero", brand: "Coca-Cola", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu", tags: ["çok satan"] },
  { id: "drk-fanta", sku: CESITLI, name: "Fanta Orange / Cassis / Exotic / Lemon", brand: "Coca-Cola", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-032", sku: "FD-DRK-032", name: "Sprite", brand: "Coca-Cola", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "drk-pepsi", sku: CESITLI, name: "Pepsi Cola / Zero", brand: "Pepsi", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-050", sku: "FD-DRK-050", name: "Seven Up", brand: "Pepsi", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "drk-lipton", sku: CESITLI, name: "Lipton Ice Tea / Peach", brand: "Lipton", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu", tags: ["çok satan"] },
  { id: "drk-looza", sku: CESITLI, name: "Looza Meyve Suları", brand: "Looza", category: "icecekler", unitsPerCase: 24, unitSize: "20 cl", unitLabel: "Şişe" },
  { id: "FD-DRK-031", sku: "FD-DRK-031", name: "Oasis Tropical", brand: "Oasis", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-036", sku: "FD-DRK-036", name: "Gini", brand: "Gini", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-016", sku: "FD-DRK-016", name: "Hawai Tropical", brand: "Hawai", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-014", sku: "FD-DRK-014", name: "Tropico Originale", brand: "Tropico", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-043", sku: "FD-DRK-043", name: "Spa Water Intense (Gazlı)", brand: "Spa", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Şişe" },
  { id: "FD-DRK-044", sku: "FD-DRK-044", name: "Spa Water Intense (Gazlı)", brand: "Spa", category: "icecekler", unitsPerCase: 24, unitSize: "50 cl", unitLabel: "Şişe" },
  { id: "FD-DRK-047", sku: "FD-DRK-047", name: "Pırsu Su", brand: "Pırsu", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Şişe" },
  { id: "FD-DRK-020", sku: "FD-DRK-020", name: "Uludağ Gazoz", brand: "Uludağ", category: "icecekler", unitsPerCase: 24, unitSize: "25 cl", unitLabel: "Şişe", tags: ["döner"] },
  { id: "FD-DRK-017", sku: "FD-DRK-017", name: "Uludağ Portakallı Gazoz", brand: "Uludağ", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-019", sku: "FD-DRK-019", name: "Kızılay Meyveli Maden Suyu", brand: "Kızılay", category: "icecekler", unitsPerCase: 6, unitSize: "25 cl", unitLabel: "Şişe" },
  { id: "FD-DRK-046", sku: "FD-DRK-046", name: "Kızılay Sade Maden Suyu", brand: "Kızılay", category: "icecekler", unitsPerCase: 24, unitSize: "30 cl", unitLabel: "Şişe" },
  { id: "FD-DRK-022", sku: "FD-DRK-022", name: "Doğanay Şalgam Suyu", brand: "Doğanay", category: "icecekler", unitsPerCase: 24, unitSize: "30 cl", unitLabel: "Şişe", tags: ["döner"] },
  { id: "FD-DRK-023", sku: "FD-DRK-023", name: "Ayran", brand: "Maximus", category: "icecekler", unitsPerCase: 20, unitSize: "25 cl", unitLabel: "Şişe", tags: ["döner", "çok satan"] },
  { id: "drk-caprisun", sku: CESITLI, name: "Capri-Sun", brand: "Capri-Sun", category: "icecekler", unitsPerCase: 40, unitSize: "20 cl", unitLabel: "Adet" },
  { id: "FD-DRK-007", sku: "FD-DRK-007", name: "AA Energy Drink", brand: "AA Drink", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-009", sku: "FD-DRK-009", name: "Nalu Energy Drink Original", brand: "Nalu", category: "icecekler", unitsPerCase: 24, unitSize: "25 cl", unitLabel: "Kutu" },
  { id: "FD-DRK-008", sku: "FD-DRK-008", name: "Red Bull Energy Drink", brand: "Red Bull", category: "icecekler", unitsPerCase: 24, unitSize: "250 ml", unitLabel: "Kutu" },
  { id: "FD-DRK-006", sku: "FD-DRK-006", name: "Shakura Energy Drink", brand: "Shakura", category: "icecekler", unitsPerCase: 12, unitSize: "250 ml", unitLabel: "Kutu" },
  { id: "FD-DRK-005", sku: "FD-DRK-005", name: "Shakura Energy Drink Special Edition", brand: "Shakura", category: "icecekler", unitsPerCase: 12, unitSize: "250 ml", unitLabel: "Kutu" },
  { id: "FD-DRK-004", sku: "FD-DRK-004", name: "Jupiler Bira (Kutu)", brand: "Jupiler", category: "icecekler", unitsPerCase: 24, unitSize: "33 cl", unitLabel: "Kutu" },
  { id: "drk-kavaklidere", sku: CESITLI, name: "Kavaklıdere Şarap (Beyaz / Kırmızı / Roze)", brand: "Kavaklıdere", category: "icecekler", unitsPerCase: 12, unitSize: "75 cl", unitLabel: "Şişe" },

  // ───────────── Kuru Gıda ─────────────
  { id: "kg-caputo", sku: CESITLI, name: "Caputo Pizza Unu Tip 00", brand: "Caputo", category: "kuru-gida", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Çuval", tags: ["pizza", "çok satan"] },
  { id: "kg-ceres", sku: CESITLI, name: "Ceres Un", brand: "Ceres", category: "kuru-gida", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Çuval", tags: ["pizza"] },
  { id: "kg-pirinc", sku: CESITLI, name: "Baldo Pirinç", brand: "Düzgün", category: "kuru-gida", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Çuval" },
  { id: "kg-bulgur", sku: CESITLI, name: "Pilavlık Bulgur", brand: "Düzgün", category: "kuru-gida", unitsPerCase: 1, unitSize: "25 kg", unitLabel: "Çuval" },
  { id: "kg-mercimek", sku: CESITLI, name: "Kırmızı Mercimek", brand: "Düzgün", category: "kuru-gida", unitsPerCase: 4, unitSize: "5 kg", unitLabel: "Paket" },
  { id: "kg-nohut", sku: CESITLI, name: "Nohut", brand: "Düzgün", category: "kuru-gida", unitsPerCase: 4, unitSize: "5 kg", unitLabel: "Paket" },
  { id: "kg-makarna", sku: CESITLI, name: "Spagetti", brand: "Poco Loco", category: "kuru-gida", unitsPerCase: 6, unitSize: "3 kg", unitLabel: "Paket" },
  { id: "kg-tortilla", sku: CESITLI, name: "Tortilla Wrap 30 cm", brand: "Poco Loco", category: "kuru-gida", unitsPerCase: 6, unitSize: "18 adet", unitLabel: "Paket", tags: ["döner"] },
  { id: "kg-yag", sku: CESITLI, name: "Ayçiçek Yağı", brand: "Maximus", category: "kuru-gida", unitsPerCase: 1, unitSize: "10 L", unitLabel: "Bidon", tags: ["fritür"] },
  { id: "kg-pulbiber", sku: CESITLI, name: "Pul Biber", brand: "Düzgün", category: "kuru-gida", unitsPerCase: 6, unitSize: "1 kg", unitLabel: "Paket", tags: ["döner"] },

  // ───────────── Hijyen & Temizlik (katalog: Hygiene & Schoonmaak) ─────────────
  { id: "NF-HDS-003", sku: "NF-HDS-003", name: "Nitril Eldiven Mavi / Siyah (S – M)", brand: "Maximus", category: "hijyen", unitsPerCase: 100, unitSize: "Adet", unitLabel: "Adet", tags: ["çok satan"] },
  { id: "NF-HYG-001", sku: "NF-HYG-001", name: "El Sabunu", brand: "Maximus", category: "hijyen", unitsPerCase: 12, unitSize: "500 ml", unitLabel: "Şişe" },
  { id: "NF-HYG-002", sku: "NF-HYG-002", name: "Cam Temizleyici", brand: "Maximus", category: "hijyen", unitsPerCase: 12, unitSize: "1 L", unitLabel: "Şişe" },
  { id: "NF-HYG-004", sku: "NF-HYG-004", name: "Grill Clean Extra (Izgara Temizleyici)", brand: "Maximus", category: "hijyen", unitsPerCase: 1, unitSize: "5 L", unitLabel: "Bidon", tags: ["döner"] },
  { id: "NF-HYG-006", sku: "NF-HYG-006", name: "Maximus Çok Amaçlı Temizleyici", brand: "Maximus", category: "hijyen", unitsPerCase: 1, unitSize: "5 L", unitLabel: "Bidon" },
  { id: "NF-HYG-003", sku: "NF-HYG-003", name: "Dezenfektan", brand: "Maximus", category: "hijyen", unitsPerCase: 1, unitSize: "5 L", unitLabel: "Bidon" },
  { id: "NF-HYG-005", sku: "NF-HYG-005", name: "Temizlik Maddesi", brand: "Maximus", category: "hijyen", unitsPerCase: 1, unitSize: "1 L", unitLabel: "Şişe" },
];

export function formatPackaging(p: Product): string {
  return p.unitsPerCase === 1
    ? `1 x ${p.unitSize}`
    : `${p.unitsPerCase} x ${p.unitSize}`;
}

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
