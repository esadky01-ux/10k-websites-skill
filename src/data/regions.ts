import type { Region } from "./regions.types";

/**
 * Regio-pagina's voor MAXIMUS Food & Horeca (Aarschot).
 * Gesorteerd op afstand tot het magazijn (Nieuwlandlaan 111, 3200 Aarschot).
 */
export const regions: Region[] = [
  {
    slug: "aarschot",
    name: "Aarschot",
    province: "Vlaams-Brabant",
    postcodes: ["3200", "3201", "3202"],
    distanceKm: 0,
    driveMinutes: 0,
    deliveryDays: ["ma", "di", "wo", "do", "vr"],
    lat: 50.9847,
    lng: 4.8375,
    nearby: ["Rillaar", "Langdorp", "Gelrode", "Betekom", "Begijnendijk", "Rotselaar"],
    nl: {
      metaTitle: "Horeca groothandel Aarschot: döner & pizza | Maximus Food",
      metaDescription:
        "Maximus Food & Horeca in Aarschot: groothandel voor döner, pizza en frituur. Dagelijkse levering, -15% bij afhaling in ons magazijn. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Aarschot: döner, pizza en frituur leveringen",
      intro:
        "<p>MAXIMUS Food &amp; Horeca is gevestigd op de Nieuwlandlaan in Aarschot, midden in het Hageland. Voor döner shops, pizzeria's, frituren en snackbars in Aarschot, Rillaar, Langdorp en Gelrode zijn wij letterlijk de groothandel om de hoek. Ons magazijn ligt vlak bij de E314 en de Leuvensesteenweg, zodat u tussen twee shifts door snel uw döner, pizzabodems, Lutosa frieten en Pauwels sauzen komt ophalen.</p><p>Wie in Aarschot en de deelgemeenten bestelt, geniet van dagelijkse leveringen van maandag tot en met vrijdag met onze eigen koelwagens. Liever zelf langskomen? Bij afhaling in ons magazijn krijgt u 15% korting op uw bestelling. Wij zijn open van maandag tot vrijdag van 08:00 tot 17:00 en op zaterdag van 09:00 tot 13:00.</p><p>Bestellen doet u eenvoudig via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag nog een bevestiging, in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Aarschot is een levendige centrumstad van zo'n 30.000 inwoners met een compact winkelhart rond de Grote Markt en de Bogaardenstraat, een druk station en een grote scholengemeenschap. Rond de markt en langs de Leuvensesteenweg vindt u een mix van pitazaken, pizzeria's en frituren die elke dag rekenen op verse döner, pizzabodems en Belgische frieten. Ook de deelgemeenten Rillaar, Langdorp en Gelrode hebben elk hun eigen frituur of snackbar met een trouwe klantenkring uit de buurt.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Aarschot?",
          a: "Aarschot en de deelgemeenten worden elke werkdag beleverd, van maandag tot en met vrijdag. Omdat ons magazijn in Aarschot zelf ligt, kunnen we hier het snelst schakelen bij spoedbestellingen.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Aarschot?",
          a: "De leveringsvoorwaarden hangen af van uw bestelvolume en frequentie. Neem contact op voor de leveringsvoorwaarden in uw regio, wij bekijken samen wat het beste past bij uw zaak.",
        },
        {
          q: "Kan ik mijn bestelling zelf afhalen in Aarschot?",
          a: "Zeker. Bij afhaling in ons magazijn op de Nieuwlandlaan 111, Unit 3-4 krijgt u 15% korting. We zijn open van maandag tot vrijdag van 08:00 tot 17:00 en op zaterdag van 09:00 tot 13:00.",
        },
        {
          q: "Hoe bestel ik het snelst bij Maximus?",
          a: "Stuur uw bestelling via WhatsApp naar +32 467 07 71 64 of gebruik het online bestelformulier. U ontvangt dezelfde dag nog een bevestiging in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Aarschot Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Aarschot'taki Maximus Food & Horeca: döner, pizza ve frituur toptancınız. Hafta içi her gün teslimat, depodan alımda %15 indirim. WhatsApp ile sipariş.",
      h1: "Aarschot'ta horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>MAXIMUS Food &amp; Horeca'nın deposu Aarschot'ta, Nieuwlandlaan 111 adresinde bulunur. Aarschot, Rillaar, Langdorp ve Gelrode'deki dönerciler, pizzacılar ve frituurlar için en yakın toptancıyız. Döner, pizza hamuru, Lutosa patates ve Pauwels soslarını hafta içi her gün kendi soğutmalı araçlarımızla teslim ediyoruz.</p><p>Siparişinizi depodan kendiniz alırsanız %15 indirim kazanırsınız. Hafta içi 08:00-17:00, cumartesi 09:00-13:00 açığız. Siparişinizi WhatsApp (+32 467 07 71 64) veya online sipariş formu üzerinden iletin; aynı gün Türkçe onay alırsınız.</p>",
      localProfile:
        "<p>Aarschot, yaklaşık 30.000 nüfuslu hareketli bir merkez şehirdir. Grote Markt çevresi, Bogaardenstraat ve tren istasyonu bölgesinde pitacılar, pizzacılar ve frituurlar yoğun. Rillaar, Langdorp ve Gelrode gibi mahallelerde de sadık müşterisi olan snackbarlar bulunuyor. Öğrenci ve yolcu yoğunluğu hafta içi öğlen saatlerinde belirgin.</p>",
      faq: [
        {
          q: "Maximus Aarschot'a hangi günler teslimat yapıyor?",
          a: "Aarschot ve bağlı mahallelere pazartesiden cumaya her iş günü teslimat yapıyoruz. Depomuz şehirde olduğu için acil siparişlerde hızlı çözüm sunabiliyoruz.",
        },
        {
          q: "Aarschot'ta teslimat için minimum sipariş var mı?",
          a: "Teslimat koşulları sipariş hacminize ve sıklığınıza göre belirlenir. Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Siparişimi Aarschot'taki depodan alabilir miyim?",
          a: "Evet. Nieuwlandlaan 111, Unit 3-4 adresindeki depomuzdan alımda %15 indirim uygulanır. Hafta içi 08:00-17:00, cumartesi 09:00-13:00 açığız.",
        },
        {
          q: "En hızlı nasıl sipariş verebilirim?",
          a: "Siparişinizi +32 467 07 71 64 numaralı WhatsApp hattımıza yazın veya online sipariş formunu kullanın. Aynı gün Türkçe ya da Hollandaca onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "leuven",
    name: "Leuven",
    province: "Vlaams-Brabant",
    postcodes: ["3000", "3001", "3010", "3012", "3018"],
    distanceKm: 17,
    driveMinutes: 22,
    deliveryDays: ["ma", "wo", "vr"],
    lat: 50.8798,
    lng: 4.7005,
    nearby: ["Heverlee", "Kessel-Lo", "Wilsele", "Wijgmaal", "Herent", "Holsbeek"],
    nl: {
      metaTitle: "Horeca groothandel Leuven: döner & pizza | Maximus Food",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Leuven. Levering op ma, wo en vr, -15% bij afhaling in Aarschot. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Leuven: döner, pizza en frituur leveringen",
      intro:
        "<p>Leuven is de grootste studentenstad van Vlaanderen en dat voelt u elke avond in de horeca. Van de Oude Markt tot de Tiensestraat en het stationsplein draaien döner shops, pizzeria's en frituren op volle toeren. MAXIMUS Food &amp; Horeca levert vanuit Aarschot, amper 17 kilometer verderop, alles wat een drukke zaak in Leuven nodig heeft: döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel snacks, Pauwels sauzen en verpakkingen.</p><p>Onze koelwagens rijden op maandag, woensdag en vrijdag door Leuven, Heverlee, Kessel-Lo, Wilsele en Wijgmaal. Zo kunt u meerdere keren per week bijbestellen zonder grote voorraden aan te houden in een krappe stadskeuken. Wilt u liever zelf ophalen? Aarschot ligt op 20 minuten rijden en bij afhaling krijgt u 15% korting.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en u ontvangt dezelfde dag nog een bevestiging.</p>",
      localProfile:
        "<p>Met meer dan 50.000 studenten van de KU Leuven en hogescholen is Leuven een stad die laat eet. Rond de Oude Markt, de Naamsestraat, de Bondgenotenlaan en het station vindt u een hoge dichtheid aan pitazaken, kebabrestaurants, pizzeria's en nachtfrituren. Heverlee en Kessel-Lo hebben daarnaast tal van buurtfrituren en afhaalpizzeria's. Snelle rotatie van döner, pizzabodems en frieten is hier belangrijker dan waar ook, zeker tijdens het academiejaar en bij studentenevenementen.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Leuven?",
          a: "Onze vaste leveringsdagen voor Leuven en de deelgemeenten Heverlee, Kessel-Lo, Wilsele en Wijgmaal zijn maandag, woensdag en vrijdag. Bestellingen die tijdig binnenkomen, plannen we in op de eerstvolgende route.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Leuven?",
          a: "Dat hangt af van uw volume en bestelfrequentie. Neem contact op voor de leveringsvoorwaarden in uw regio, we stemmen dit graag af op uw zaak.",
        },
        {
          q: "Kan ik vanuit Leuven mijn bestelling afhalen in Aarschot?",
          a: "Ja, ons magazijn in Aarschot ligt op ongeveer 20 minuten rijden van Leuven. Bij afhaling krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Is het döner assortiment geschikt voor Turkse en halal zaken?",
          a: "Ons döner en kebab assortiment is samengesteld voor de Turkse en Mediterrane horeca. Vraag ons per product naar de specificaties en de herkomst, wij helpen u graag in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Leuven Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Leuven'deki dönerci, pizzacı ve frituurlar için toptancı. Pazartesi, çarşamba ve cuma teslimat, depodan alımda %15 indirim. WhatsApp ile sipariş.",
      h1: "Leuven'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Leuven, Flaman bölgesinin en büyük öğrenci şehri. Oude Markt, Tiensestraat ve istasyon çevresinde dönerciler, pizzacılar ve frituurlar akşam geç saatlere kadar çalışıyor. MAXIMUS Food &amp; Horeca, sadece 17 km uzaklıktaki Aarschot deposundan döner, pizza hamuru, mozzarella, Lutosa patates, Pauwels sos ve ambalaj ürünlerini pazartesi, çarşamba ve cuma günleri Leuven, Heverlee, Kessel-Lo ve Wilsele'ye teslim ediyor.</p><p>Aarschot'a gelip depodan alım yaparsanız %15 indirim kazanırsınız. Siparişinizi WhatsApp (+32 467 07 71 64) veya online form ile iletin; aynı gün onay alırsınız.</p>",
      localProfile:
        "<p>KU Leuven ve yüksekokullardaki 50.000'den fazla öğrenci sayesinde Leuven geç saatlere kadar yemek yiyen bir şehir. Oude Markt, Naamsestraat ve istasyon bölgesinde pitacı, kebapçı, pizzacı ve gece frituurları çok yoğun; Heverlee ve Kessel-Lo'da ise mahalle frituurları ve paket pizzacılar bulunuyor.</p>",
      faq: [
        {
          q: "Maximus Leuven'e hangi günler teslimat yapıyor?",
          a: "Leuven ve Heverlee, Kessel-Lo, Wilsele, Wijgmaal için sabit teslimat günlerimiz pazartesi, çarşamba ve cumadır.",
        },
        {
          q: "Leuven'de teslimat için minimum sipariş tutarı var mı?",
          a: "Sipariş hacminize ve sıklığınıza göre değişir. Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Leuven'den Aarschot deposuna gelip alım yapabilir miyim?",
          a: "Evet, depomuz Leuven'e yaklaşık 20 dakika mesafede. Depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "Döner ürünleri Türk ve helal işletmelere uygun mu?",
          a: "Döner ve kebap çeşitlerimiz Türk ve Akdeniz mutfağı işletmeleri için seçilmiştir. Ürün bazında özellik ve menşe bilgisi için bize Türkçe sorabilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "diest",
    name: "Diest",
    province: "Vlaams-Brabant",
    postcodes: ["3290", "3293", "3294"],
    distanceKm: 17,
    driveMinutes: 20,
    deliveryDays: ["ma", "wo", "vr"],
    lat: 50.9887,
    lng: 5.0512,
    nearby: ["Schaffen", "Molenstede", "Kaggevinne", "Webbekom", "Deurne", "Bekkevoort"],
    nl: {
      metaTitle: "Horeca groothandel Diest: döner, pizza & frituur | Maximus",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Diest. Levering ma, wo en vr, -15% bij afhaling in Aarschot. Vraag vandaag uw prijs aan.",
      h1: "Horeca groothandel in Diest: döner, pizza en frituur leveringen",
      intro:
        "<p>Diest is een historische stad aan de rand van het Hageland, met een gezellige Grote Markt, het Begijnhof en de Citadel als publiekstrekkers. Rond de markt, in de Ketelstraat en aan het station vindt u pitazaken, pizzeria's en frituren die zowel inwoners als dagjestoeristen bedienen. Voor al die zaken is MAXIMUS Food &amp; Horeca in Aarschot, 17 kilometer via de N10, de dichtstbijzijnde specialist in döner, pizza en frituurproducten.</p><p>We leveren in Diest, Schaffen, Molenstede, Kaggevinne en Webbekom op maandag, woensdag en vrijdag met onze eigen koelwagens. Naast döner en kebab vindt u bij ons pizzabodems, kaas, Lutosa frieten, Mekkafood snacks, Pauwels sauzen, conserven en verpakkingen zoals pizzadozen en frietbakjes.</p><p>Komt u zelf naar Aarschot? Dan krijgt u 15% korting bij afhaling. Bestellen kan via WhatsApp op +32 467 07 71 64 of via het online bestelformulier, met bevestiging dezelfde dag.</p>",
      localProfile:
        "<p>Diest telt ruim 24.000 inwoners en trekt dankzij het Begijnhof, de Citadel en de Halve Maan het hele jaar door bezoekers. De horeca concentreert zich rond de Grote Markt en de Botermarkt, met een mix van cafés, brasseries, pizzeria's en pitazaken. Aan het station en langs de Leuvensesteenweg zitten frituren en snackbars met veel doorrijklanten. In de landelijke deelgemeenten Schaffen en Molenstede zijn de dorpsfrituren een vaste waarde, en de militaire aanwezigheid in Schaffen zorgt voor extra klandizie.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Diest?",
          a: "Diest en de deelgemeenten Schaffen, Molenstede, Kaggevinne en Webbekom staan op onze route van maandag, woensdag en vrijdag.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Diest?",
          a: "De voorwaarden hangen af van uw volume en bestelfrequentie. Neem contact op voor de leveringsvoorwaarden in uw regio, wij zoeken samen een passende formule.",
        },
        {
          q: "Kan ik afhalen in Aarschot vanuit Diest?",
          a: "Ja, via de N10 bent u in ongeveer 20 minuten in ons magazijn in Aarschot. Bij afhaling krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Hoe geef ik mijn bestelling door?",
          a: "Via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag een bevestiging, in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Diest Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Diest'teki dönerci, pizzacı ve frituurlar için toptancı. Pazartesi, çarşamba ve cuma teslimat, Aarschot deposundan alımda %15 indirim.",
      h1: "Diest'te horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Diest, Grote Markt, Begijnhof ve Citadel'i ile hem yerel halkı hem de günübirlik turistleri ağırlayan tarihi bir şehir. Aarschot'a sadece 17 km uzaklıktaki MAXIMUS Food &amp; Horeca, Diest, Schaffen, Molenstede ve Webbekom'daki pitacı, pizzacı ve frituurlara pazartesi, çarşamba ve cuma günleri kendi soğutmalı araçlarıyla teslimat yapıyor.</p><p>Döner ve kebap, pizza hamuru, peynir, Lutosa patates, Mekkafood atıştırmalıklar, Pauwels soslar ve pizza kutuları tek adresten. Aarschot deposundan alımda %15 indirim; sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>24.000'den fazla nüfuslu Diest, Begijnhof ve Citadel sayesinde yıl boyu ziyaretçi çekiyor. Horeca, Grote Markt ve Botermarkt çevresinde yoğunlaşıyor; istasyon ve Leuvensesteenweg boyunca frituurlar ve snackbarlar var. Schaffen ve Molenstede gibi köylerde de köy frituurları önemli bir yer tutuyor. Schaffen'deki askeri üs ek müşteri sağlıyor.</p>",
      faq: [
        {
          q: "Maximus Diest'e hangi günler teslimat yapıyor?",
          a: "Diest ile Schaffen, Molenstede, Kaggevinne ve Webbekom pazartesi, çarşamba ve cuma rotamızda yer alıyor.",
        },
        {
          q: "Diest'te minimum sipariş tutarı var mı?",
          a: "Koşullar sipariş hacminize göre belirlenir. Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Diest'ten Aarschot'a gelip alım yapabilir miyim?",
          a: "Evet, N10 üzerinden yaklaşık 20 dakikada depomuzdasınız. Depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "Siparişimi nasıl iletebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu üzerinden. Aynı gün Türkçe onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "tienen",
    name: "Tienen",
    province: "Vlaams-Brabant",
    postcodes: ["3300", "3320"],
    distanceKm: 25,
    driveMinutes: 28,
    deliveryDays: ["ma", "wo", "vr"],
    lat: 50.8071,
    lng: 4.9376,
    nearby: ["Kumtich", "Hakendover", "Oplinter", "Bost", "Hoegaarden", "Glabbeek", "Boutersem"],
    nl: {
      metaTitle: "Horeca groothandel Tienen: döner & frituur | Maximus Food",
      metaDescription:
        "Döner, pizza en frituursnacks voor de horeca in Tienen en omgeving. Levering op ma, wo en vr vanuit Aarschot, -15% bij afhaling. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Tienen: döner, pizza en frituur leveringen",
      intro:
        "<p>Tienen, de suikerstad van het Hageland, heeft een verrassend drukke horeca. Rond de Grote Markt en in de Leuvensestraat zitten pitazaken, pizzeria's en frituren dicht bij elkaar, en het station en de Tiense Suikerraffinaderij zorgen voor een stroom pendelaars en arbeiders die snel een pita of pak friet willen. MAXIMUS Food &amp; Horeca in Aarschot ligt 25 kilometer verderop en bevoorraadt deze zaken met döner, pizzabodems, kaas, Lutosa frieten, snacks en Pauwels sauzen.</p><p>Op maandag, woensdag en vrijdag rijden onze koelwagens naar Tienen, Kumtich, Hakendover, Oplinter en de omliggende gemeenten Hoegaarden, Glabbeek en Boutersem. Daarnaast leveren we ook pizzadozen, dönerboxen, frietbakjes en hygiëneproducten, zodat u niet bij verschillende leveranciers hoeft aan te kloppen.</p><p>Wie zelf naar Aarschot rijdt, krijgt 15% korting bij afhaling. Bestellen gaat snel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.</p>",
      localProfile:
        "<p>Tienen telt ongeveer 36.000 inwoners en fungeert als centrumstad voor het oostelijke Hageland. De Grote Markt, een van de grootste van België, en de winkelstraten errond vormen het horecahart met brasseries, pizzeria's en pitazaken. Frituren vindt u vooral aan het station, langs de Aarschotsesteenweg en in de deelgemeenten Kumtich en Hakendover. De jaarlijkse Suikerrock brengt tienduizenden bezoekers naar het centrum, een piekmoment waarop döner shops en frituren extra voorraad nodig hebben.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Tienen?",
          a: "Tienen en de deelgemeenten Kumtich, Hakendover, Oplinter en Bost worden op maandag, woensdag en vrijdag beleverd, samen met Hoegaarden, Glabbeek en Boutersem.",
        },
        {
          q: "Geldt er een minimum bestelbedrag in Tienen?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We bekijken uw volume en bestelfrequentie en stellen een passende formule voor.",
        },
        {
          q: "Kan ik vanuit Tienen afhalen in Aarschot met korting?",
          a: "Ja, ons magazijn ligt op ongeveer een halfuur rijden. Bij afhaling in Aarschot krijgt u 15% korting op het volledige bedrag van uw bestelling.",
        },
        {
          q: "Levert Maximus ook verpakkingen en hygiëneproducten in Tienen?",
          a: "Ja, naast döner, pizza en frituurproducten leveren we pizzadozen, dönerboxen, frietbakjes, servetten en reinigingsmiddelen in dezelfde levering.",
        },
      ],
    },
    tr: {
      metaTitle: "Tienen Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Tienen ve çevresindeki dönerci, pizzacı ve frituurlar için toptancı. Pazartesi, çarşamba ve cuma teslimat, depodan alımda %15 indirim.",
      h1: "Tienen'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Hageland'ın şeker şehri Tienen'de Grote Markt ve Leuvensestraat çevresinde pitacılar, pizzacılar ve frituurlar yan yana çalışıyor; istasyon ve şeker fabrikası sürekli müşteri akışı sağlıyor. Aarschot'a 25 km mesafedeki MAXIMUS Food &amp; Horeca, Tienen, Kumtich, Hakendover, Hoegaarden ve Glabbeek'e pazartesi, çarşamba ve cuma günleri döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık ve Pauwels sos teslim ediyor.</p><p>Pizza kutusu, döner kutusu ve hijyen ürünleri de aynı teslimatla gelir. Aarschot deposundan alımda %15 indirim; sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 36.000 nüfuslu Tienen, doğu Hageland'ın merkez şehri. Belçika'nın en büyük meydanlarından Grote Markt ve çevresindeki alışveriş sokakları horeca'nın kalbi. Frituurlar istasyon, Aarschotsesteenweg ve Kumtich, Hakendover mahallelerinde yoğun. Suikerrock festivali her yıl on binlerce ziyaretçi getiriyor. Bu dönemde dönerci ve frituurlar ek stok ihtiyacı duyuyor.</p>",
      faq: [
        {
          q: "Maximus Tienen'e hangi günler teslimat yapıyor?",
          a: "Tienen, Kumtich, Hakendover, Oplinter ve Bost ile Hoegaarden, Glabbeek ve Boutersem'e pazartesi, çarşamba ve cuma teslimat yapıyoruz.",
        },
        {
          q: "Tienen'de minimum sipariş tutarı var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin; hacminize uygun bir formül öneririz.",
        },
        {
          q: "Tienen'den Aarschot'a gelip indirimli alım yapabilir miyim?",
          a: "Evet, depomuz yaklaşık yarım saat mesafede. Depodan alımda siparişin tamamına %15 indirim uygulanır.",
        },
        {
          q: "Ambalaj ve hijyen ürünleri de teslim ediyor musunuz?",
          a: "Evet, pizza kutusu, döner kutusu, patates kabı, peçete ve temizlik ürünlerini aynı teslimatla getiriyoruz.",
        },
      ],
    },
  },
  {
    slug: "scherpenheuvel-zichem",
    name: "Scherpenheuvel-Zichem",
    province: "Vlaams-Brabant",
    postcodes: ["3270", "3271", "3272"],
    distanceKm: 9,
    driveMinutes: 12,
    deliveryDays: ["ma", "wo", "vr"],
    lat: 50.98,
    lng: 4.976,
    nearby: ["Scherpenheuvel", "Zichem", "Averbode", "Testelt", "Messelbroek", "Okselaar"],
    nl: {
      metaTitle: "Horeca groothandel Scherpenheuvel-Zichem | Maximus Food",
      metaDescription:
        "Döner, pizza en frituurproducten voor de horeca in Scherpenheuvel-Zichem. Levering ma, wo en vr, -15% bij afhaling op 10 minuten rijden. Bestel nu.",
      h1: "Horeca groothandel in Scherpenheuvel-Zichem: döner, pizza en frituur leveringen",
      intro:
        "<p>Scherpenheuvel-Zichem is de buurgemeente van Aarschot en tegelijk de belangrijkste bedevaartplaats van Vlaanderen. Rond de basiliek en op de Grote Markt van Scherpenheuvel stromen op zon- en feestdagen duizenden bezoekers samen, wat de frituren, snackbars en pizzeria's een uitgesproken seizoenskarakter geeft. Ook de Abdij van Averbode en de Demervallei bij Zichem en Testelt trekken fietsers en wandelaars die onderweg een frietje of pizza meepikken.</p><p>MAXIMUS Food &amp; Horeca ligt op amper 9 kilometer, een ritje van tien minuten via de N10. Wij leveren op maandag, woensdag en vrijdag in Scherpenheuvel, Zichem, Averbode, Testelt en Messelbroek, met alles van döner en pizzabodems tot Lutosa frieten, Van Reusel snacks en Pauwels sauzen. Voor de piekdagen rond de basiliek kunt u eenvoudig extra bijbestellen.</p><p>Omdat we zo dichtbij zitten, kiezen veel zaken hier voor afhaling met 15% korting. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.</p>",
      localProfile:
        "<p>De gemeente Scherpenheuvel-Zichem telt zo'n 23.000 inwoners verspreid over de deelgemeenten Scherpenheuvel, Zichem, Averbode, Testelt en Messelbroek. De horeca rond de basiliek is sterk gericht op bedevaarders en dagjesmensen, met frituren, ijssalons en pizzeria's die op zondagen en tijdens de meimaand pieken. In Zichem en Averbode vindt u dorpsfrituren en pitazaken met een vaste lokale klantenkring, terwijl de fietsroutes door de Demervallei zorgen voor extra passage in de zomer.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Scherpenheuvel-Zichem?",
          a: "Scherpenheuvel, Zichem, Averbode, Testelt en Messelbroek worden op maandag, woensdag en vrijdag beleverd, in dezelfde route als Aarschot en Diest.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Scherpenheuvel?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Omdat u zo dicht bij ons magazijn ligt, zijn er doorgaans flexibele mogelijkheden.",
        },
        {
          q: "Hoe ver is afhalen in Aarschot vanuit Scherpenheuvel?",
          a: "Ongeveer 10 minuten via de N10. Bij afhaling in ons magazijn op de Nieuwlandlaan krijgt u 15% korting, ook op zaterdagvoormiddag.",
        },
        {
          q: "Kan ik voor drukke bedevaartdagen extra bijbestellen?",
          a: "Ja, stuur ons via WhatsApp op +32 467 07 71 64 uw extra bestelling door. U krijgt dezelfde dag een bevestiging en wij plannen de levering of afhaling in.",
        },
      ],
    },
    tr: {
      metaTitle: "Scherpenheuvel-Zichem Horeca Toptancısı | Maximus",
      metaDescription:
        "Scherpenheuvel-Zichem'deki frituur, pizzacı ve dönerciler için toptancı. Pazartesi, çarşamba ve cuma teslimat, 10 dakika mesafedeki depodan alımda %15 indirim.",
      h1: "Scherpenheuvel-Zichem'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Aarschot'un komşusu Scherpenheuvel-Zichem, Flaman bölgesinin en önemli hac merkezi. Bazilika ve Grote Markt çevresindeki frituurlar, snackbarlar ve pizzacılar pazar günleri ve mayıs ayında binlerce ziyaretçi ağırlıyor. Averbode Manastırı ve Demer vadisi de bisikletçi ve yürüyüşçü çekiyor.</p><p>MAXIMUS Food &amp; Horeca sadece 9 km, yani 10 dakika uzaklıkta. Scherpenheuvel, Zichem, Averbode, Testelt ve Messelbroek'e pazartesi, çarşamba ve cuma teslimat yapıyoruz. Yoğun günler için ek sipariş kolay; depodan alımda %15 indirim. WhatsApp: +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 23.000 nüfuslu belediye Scherpenheuvel, Zichem, Averbode, Testelt ve Messelbroek'ten oluşuyor. Bazilika çevresindeki horeca hacılara ve günübirlikçilere yönelik; frituurlar ve pizzacılar pazar günleri zirve yapıyor. Zichem ve Averbode'de sadık yerel müşterisi olan köy frituurları ve pitacılar var. Demer vadisindeki bisiklet rotaları yazın ek müşteri getiriyor.</p>",
      faq: [
        {
          q: "Maximus Scherpenheuvel-Zichem'e hangi günler teslimat yapıyor?",
          a: "Scherpenheuvel, Zichem, Averbode, Testelt ve Messelbroek'e pazartesi, çarşamba ve cuma teslimat yapıyoruz.",
        },
        {
          q: "Minimum sipariş tutarı var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Depoya çok yakın olduğunuz için genellikle esnek çözümler sunabiliyoruz.",
        },
        {
          q: "Aarschot deposu ne kadar uzakta?",
          a: "N10 üzerinden yaklaşık 10 dakika. Depodan alımda %15 indirim uygulanır; cumartesi sabahları da açığız.",
        },
        {
          q: "Yoğun hac günleri için ek sipariş verebilir miyim?",
          a: "Evet, ek siparişinizi WhatsApp (+32 467 07 71 64) ile iletin; aynı gün onay alır, teslimat veya alımı planlarız.",
        },
      ],
    },
  },
  {
    slug: "tremelo",
    name: "Tremelo",
    province: "Vlaams-Brabant",
    postcodes: ["3120", "3128"],
    distanceKm: 10,
    driveMinutes: 14,
    deliveryDays: ["ma", "wo", "vr"],
    lat: 50.9927,
    lng: 4.7091,
    nearby: ["Baal", "Werchter", "Keerbergen", "Haacht", "Begijnendijk", "Rotselaar"],
    nl: {
      metaTitle: "Horeca groothandel Tremelo & Werchter | Maximus Food",
      metaDescription:
        "Groothandel voor frituren, pizzeria's en döner shops in Tremelo, Baal en Werchter. Levering ma, wo en vr, -15% bij afhaling in Aarschot. Bestel nu.",
      h1: "Horeca groothandel in Tremelo: döner, pizza en frituur leveringen",
      intro:
        "<p>Tremelo en Baal liggen in de groene driehoek tussen Aarschot, Leuven en Mechelen, vlak bij de festivalweide van Werchter. Het is een woongemeente met een sterke lokale horeca: dorpsfrituren, afhaalpizzeria's en een pitazaak langs de Kruisstraat en de Baalsebaan, plus de cafés en eetzaken die profiteren van de fietsers langs de Dijle en de Demer. In de zomer, met Rock Werchter en TW Classic om de hoek, verdubbelt de vraag naar frieten, snacks en döner.</p><p>MAXIMUS Food &amp; Horeca zit op 10 kilometer in Aarschot. Op maandag, woensdag en vrijdag leveren we in Tremelo, Baal, Werchter, Keerbergen, Haacht en Begijnendijk met onze eigen koelwagens. Ons assortiment omvat döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, drank en verpakkingen.</p><p>Wie zelf naar Aarschot komt, krijgt 15% korting bij afhaling. Bestellen kan via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.</p>",
      localProfile:
        "<p>Tremelo telt zo'n 15.000 inwoners in de kernen Tremelo en Baal en heeft een typisch dorpse horeca: elke kern zijn eigen frituur, een handvol pizzeria's en een pitazaak, aangevuld met cafés rond de kerk. De ligging naast Werchter maakt de zomer uitzonderlijk druk, want tijdens de festivals passeren tienduizenden bezoekers via Tremelo en Rotselaar. Ook Keerbergen, met zijn villawijken en golfclub, en het handelscentrum van Haacht vallen onder dezelfde leveringsroute.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Tremelo en Baal?",
          a: "Tremelo, Baal en Werchter staan op onze route van maandag, woensdag en vrijdag, samen met Keerbergen, Haacht en Begijnendijk.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Tremelo?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Omdat Tremelo vlak bij ons magazijn ligt, kunnen we vaak flexibel inplannen.",
        },
        {
          q: "Kan ik in het festivalseizoen extra leveringen krijgen?",
          a: "Ja, laat ons tijdig weten welke volumes u verwacht rond Rock Werchter of TW Classic. We plannen extra leveringen in of u haalt bij met 15% korting in Aarschot.",
        },
        {
          q: "Hoe bestel ik bij Maximus vanuit Tremelo?",
          a: "Stuur uw bestelling via WhatsApp naar +32 467 07 71 64 of vul het online bestelformulier in. U ontvangt dezelfde dag nog een bevestiging.",
        },
      ],
    },
    tr: {
      metaTitle: "Tremelo Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Tremelo, Baal ve Werchter'deki frituur, pizzacı ve dönerciler için toptancı. Pazartesi, çarşamba ve cuma teslimat, Aarschot deposundan alımda %15 indirim.",
      h1: "Tremelo'da horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Tremelo ve Baal, Aarschot, Leuven ve Mechelen arasında, Werchter festival alanının hemen yanında yer alıyor. Köy frituurları, paket pizzacılar ve pitacılar Kruisstraat ve Baalsebaan boyunca sıralanıyor; yazın Rock Werchter sırasında patates, atıştırmalık ve döner talebi ikiye katlanıyor.</p><p>MAXIMUS Food &amp; Horeca 10 km uzaklıkta. Tremelo, Baal, Werchter, Keerbergen, Haacht ve Begijnendijk'e pazartesi, çarşamba ve cuma teslimat yapıyoruz. Depodan alımda %15 indirim; sipariş için WhatsApp +32 467 07 71 64 veya online form.</p>",
      localProfile:
        "<p>Yaklaşık 15.000 nüfuslu Tremelo'nun her kasabasında kendi frituuru, birkaç pizzacı ve bir pitacı bulunuyor. Werchter'e komşu olması yaz aylarını olağanüstü yoğun kılıyor. Villa mahalleleriyle Keerbergen ve Haacht'ın ticaret merkezi de aynı teslimat rotasında. Werchter festivalleri sırasında on binlerce ziyaretçi Tremelo ve Rotselaar üzerinden geçiyor.</p>",
      faq: [
        {
          q: "Maximus Tremelo ve Baal'a hangi günler teslimat yapıyor?",
          a: "Tremelo, Baal, Werchter, Keerbergen, Haacht ve Begijnendijk pazartesi, çarşamba ve cuma rotamızda.",
        },
        {
          q: "Tremelo'da minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Depoya yakın olduğunuz için esnek planlama mümkün.",
        },
        {
          q: "Festival sezonunda ek teslimat alabilir miyim?",
          a: "Evet, Rock Werchter döneminde beklediğiniz hacmi önceden bildirin; ek teslimat planlarız veya Aarschot'tan %15 indirimle alım yapabilirsiniz.",
        },
        {
          q: "Tremelo'dan nasıl sipariş verebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu ile. Aynı gün onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "heist-op-den-berg",
    name: "Heist-op-den-Berg",
    province: "Antwerpen",
    postcodes: ["2220", "2221", "2222", "2223"],
    distanceKm: 16,
    driveMinutes: 22,
    deliveryDays: ["di", "do"],
    lat: 51.0747,
    lng: 4.7256,
    nearby: ["Booischot", "Hallaar", "Itegem", "Wiekevorst", "Schriek", "Hulshout", "Putte"],
    nl: {
      metaTitle: "Horeca groothandel Heist-op-den-Berg | Maximus Food",
      metaDescription:
        "Döner, pizza en frituurproducten voor de horeca in Heist-op-den-Berg en Booischot. Levering di en do, -15% bij afhaling in Aarschot. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Heist-op-den-Berg: döner, pizza en frituur leveringen",
      intro:
        "<p>Heist-op-den-Berg is met ruim 43.000 inwoners de grootste gemeente van de Zuiderkempen en een echt handelscentrum. De Bergstraat, de Grote Markt en de omgeving van het station vormen een levendige winkelas met pitazaken, pizzeria's en frituren, en de deelgemeenten Booischot, Hallaar, Itegem, Wiekevorst en Schriek hebben elk hun eigen dorpsfrituur. Voor al die zaken is MAXIMUS Food &amp; Horeca in Aarschot, op 16 kilometer, de dichtstbijzijnde specialist in döner, pizza en frituur.</p><p>Onze koelwagens rijden op dinsdag en donderdag door Heist-op-den-Berg en de omliggende gemeenten Hulshout en Putte. We leveren döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven en verpakkingen zoals pizzadozen en frietbakjes.</p><p>Aarschot ligt op 20 minuten rijden, dus afhalen met 15% korting is voor Heistse zaken een populaire optie. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.</p>",
      localProfile:
        "<p>Heist-op-den-Berg combineert een verstedelijkt centrum met landelijke deelgemeenten. In het centrum, rond de Bergstraat en het station, zitten de meeste pitazaken, pizzeria's en snackbars, met veel scholieren en pendelaars als vaste klanten. In Booischot, Itegem en Wiekevorst draaien de dorpsfrituren op de lokale gemeenschap en de vele verenigingen. Het cultuurcentrum Zwaneberg en de wekelijkse markt zorgen voor extra passage, en de nabijheid van Hulshout en Putte vergroot het verzorgingsgebied van de horeca.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Heist-op-den-Berg?",
          a: "Heist-op-den-Berg, Booischot, Hallaar, Itegem, Wiekevorst en Schriek worden op dinsdag en donderdag beleverd, samen met Hulshout en Putte.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Heist-op-den-Berg?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We stemmen de formule af op uw volume en bestelfrequentie.",
        },
        {
          q: "Kan ik vanuit Heist afhalen in Aarschot?",
          a: "Ja, ons magazijn ligt op ongeveer 20 minuten rijden. Bij afhaling krijgt u 15% korting, ook op zaterdag tussen 09:00 en 13:00.",
        },
        {
          q: "Zijn de dönerproducten geschikt voor Turkse en halal zaken?",
          a: "Ons döner en kebab assortiment is samengesteld voor de Turkse en Mediterrane horeca. Vraag ons per product naar de specificaties en de herkomst, in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Heist-op-den-Berg Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Heist-op-den-Berg, Booischot ve Itegem'deki dönerci, pizzacı ve frituurlar için toptancı. Salı ve perşembe teslimat, Aarschot deposundan alımda %15 indirim.",
      h1: "Heist-op-den-Berg'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>43.000'den fazla nüfusuyla Heist-op-den-Berg, Zuiderkempen'in en büyük belediyesi ve gerçek bir ticaret merkezi. Bergstraat, Grote Markt ve istasyon çevresinde pitacılar, pizzacılar ve frituurlar sıralanıyor; Booischot, Hallaar, Itegem ve Wiekevorst'un her birinde köy frituuru var.</p><p>Aarschot'a 16 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Heist-op-den-Berg, Hulshout ve Putte'ye döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Depodan alımda %15 indirim; WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Heist-op-den-Berg şehirleşmiş bir merkez ile kırsal mahalleleri birleştiriyor. Bergstraat ve istasyon çevresinde öğrenci ve yolcu müşterili pitacılar, pizzacılar ve snackbarlar yoğun. Booischot, Itegem ve Wiekevorst'ta köy frituurları yerel topluluğa hizmet veriyor; haftalık pazar ek müşteri getiriyor. Hulshout ve Putte'ye yakınlık horeca'nın hizmet alanını genişletiyor.</p>",
      faq: [
        {
          q: "Maximus Heist-op-den-Berg'e hangi günler teslimat yapıyor?",
          a: "Heist-op-den-Berg ve mahalleleri ile Hulshout ve Putte'ye salı ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Heist-op-den-Berg'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin; hacminize göre formül belirleriz.",
        },
        {
          q: "Heist'ten Aarschot deposuna gelebilir miyim?",
          a: "Evet, depomuz yaklaşık 20 dakika mesafede. Depodan alımda %15 indirim; cumartesi 09:00-13:00 arası da açığız.",
        },
        {
          q: "Döner ürünleri Türk ve helal işletmelere uygun mu?",
          a: "Döner ve kebap çeşitlerimiz Türk ve Akdeniz mutfağı için seçilmiştir. Ürün bazında özellik ve menşe bilgisini Türkçe olarak sorabilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "herentals",
    name: "Herentals",
    province: "Antwerpen",
    postcodes: ["2200"],
    distanceKm: 28,
    driveMinutes: 30,
    deliveryDays: ["di", "do"],
    lat: 51.1767,
    lng: 4.8363,
    nearby: ["Noorderwijk", "Morkhoven", "Olen", "Grobbendonk", "Herenthout", "Vorselaar"],
    nl: {
      metaTitle: "Horeca groothandel Herentals: döner & pizza | Maximus Food",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Herentals en de Kempen. Levering di en do vanuit Aarschot, -15% bij afhaling. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Herentals: döner, pizza en frituur leveringen",
      intro:
        "<p>Herentals is de poort tot de Kempen en een stad met een sterke handels- en schooltraditie. De Zandstraat en de Bovenrij vormen een drukke winkelas tussen de Grote Markt en het station, met pitazaken, pizzeria's en frituren die scholieren, pendelaars en shoppers bedienen. Ook het industrieterrein langs het Albertkanaal en de sportsite Netepark brengen dagelijks volk op de been dat snel iets wil eten.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 28 kilometer, een halfuur via de N19 of de E313. Op dinsdag en donderdag rijden onze koelwagens naar Herentals, Noorderwijk, Morkhoven en de buurgemeenten Olen, Grobbendonk, Herenthout en Vorselaar. Wij leveren döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen.</p><p>Afhalen in Aarschot levert u 15% korting op. Bestellen doet u via WhatsApp op +32 467 07 71 64 of via het online bestelformulier, met bevestiging dezelfde dag.</p>",
      localProfile:
        "<p>Herentals telt ongeveer 29.000 inwoners en trekt dagelijks duizenden scholieren naar zijn middelbare scholen, wat de pitazaken en frituren rond de Zandstraat en het station een vaste middagpiek geeft. De Grote Markt met het Lakenhal en de Begijnhofwijk trekken toeristen en fietsers langs de Kempense routes. De deelgemeenten Noorderwijk en Morkhoven zijn landelijker met een klassieke dorpsfrituur. Dankzij de industriezone Herentals-Olen zijn er ook veel arbeiders die 's middags een snelle maaltijd zoeken.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Herentals?",
          a: "Herentals, Noorderwijk en Morkhoven staan op onze Kempenroute van dinsdag en donderdag, samen met Olen, Grobbendonk, Herenthout en Vorselaar.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Herentals?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We bekijken samen welke bestelfrequentie en volumes het beste passen bij uw zaak.",
        },
        {
          q: "Kan ik vanuit Herentals afhalen in Aarschot?",
          a: "Ja, ons magazijn ligt op ongeveer een halfuur rijden. Bij afhaling krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Hoe bestel ik bij Maximus vanuit Herentals?",
          a: "Via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag nog een bevestiging in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Herentals Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Herentals ve Kempen'deki dönerci, pizzacı ve frituurlar için toptancı. Salı ve perşembe teslimat, depodan alımda %15 indirim. WhatsApp ile sipariş.",
      h1: "Herentals'ta horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Kempen'in kapısı Herentals'ta Zandstraat ve Bovenrij, Grote Markt ile istasyon arasında yoğun bir alışveriş aksı oluşturuyor; pitacılar, pizzacılar ve frituurlar öğrenci, yolcu ve alışverişçilere hizmet veriyor. Albertkanaal boyundaki sanayi bölgesi de öğlen müşterisi sağlıyor.</p><p>Aarschot'a 28 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Herentals, Noorderwijk, Morkhoven, Olen, Grobbendonk ve Herenthout'a döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Depodan alımda %15 indirim; WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 29.000 nüfuslu Herentals'a her gün binlerce lise öğrencisi geliyor; Zandstraat ve istasyon çevresindeki pitacı ve frituurlar öğlen saatlerinde dolup taşıyor. Lakenhal ve Begijnhof turist ve bisikletçi çekiyor. Herentals-Olen sanayi bölgesindeki işçiler de hızlı yemek arıyor. Noorderwijk ve Morkhoven daha kırsal, klasik köy frituurlu bir yapıya sahip.</p>",
      faq: [
        {
          q: "Maximus Herentals'a hangi günler teslimat yapıyor?",
          a: "Herentals, Noorderwijk ve Morkhoven ile Olen, Grobbendonk, Herenthout ve Vorselaar salı ve perşembe Kempen rotamızda.",
        },
        {
          q: "Herentals'ta minimum sipariş tutarı var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Herentals'tan Aarschot'a gelip alım yapabilir miyim?",
          a: "Evet, depomuz yaklaşık yarım saat mesafede. Depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "Herentals'tan nasıl sipariş verebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu ile; aynı gün Türkçe onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "mechelen",
    name: "Mechelen",
    province: "Antwerpen",
    postcodes: ["2800", "2801", "2811", "2812"],
    distanceKm: 30,
    driveMinutes: 32,
    deliveryDays: ["di", "do"],
    lat: 51.0259,
    lng: 4.4776,
    nearby: ["Muizen", "Hombeek", "Leest", "Walem", "Sint-Katelijne-Waver", "Bonheiden"],
    nl: {
      metaTitle: "Horeca groothandel Mechelen: döner & pizza | Maximus Food",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Mechelen. Levering di en do, -15% bij afhaling in Aarschot. Vraag vandaag uw offerte aan.",
      h1: "Horeca groothandel in Mechelen: döner, pizza en frituur leveringen",
      intro:
        "<p>Mechelen is de voorbije jaren uitgegroeid tot een van de aantrekkelijkste steden van Vlaanderen, met een bruisend centrum rond de Grote Markt, de Bruul en de Vismarkt. De stad heeft een grote en diverse gemeenschap met veel Turkse en Marokkaanse ondernemers, wat zich vertaalt in een dicht netwerk van döner shops, kebabrestaurants en pizzeria's, vooral rond het station, de Antwerpsesteenweg en de wijken Nekkerspoel en Arsenaal. Ook de frituren en snackbars in Muizen, Hombeek en Walem draaien op een trouwe buurtklandizie.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 30 kilometer en levert op dinsdag en donderdag in Mechelen, de deelgemeenten en de buurgemeenten Sint-Katelijne-Waver en Bonheiden. Ons assortiment: döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen.</p><p>Afhalen in Aarschot? Dan krijgt u 15% korting. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.</p>",
      localProfile:
        "<p>Met ruim 87.000 inwoners en een sterk vernieuwd centrum is Mechelen een stad waar de horeca elk jaar groeit. Toeristen bezoeken de Sint-Romboutskathedraal en de Vismarkt, terwijl pendelaars aan het station en scholieren van Thomas More en de vele middelbare scholen de pitazaken en frituren vullen. De stad kent een van de grootste Turkse gemeenschappen van Vlaanderen, met tal van kebabzaken en Turkse restaurants rond de Antwerpsesteenweg en in Nekkerspoel. Technopolis en de Nekkerhal zorgen voor extra piekmomenten.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Mechelen?",
          a: "Mechelen, Muizen, Hombeek, Leest en Walem worden op dinsdag en donderdag beleverd, samen met Sint-Katelijne-Waver en Bonheiden.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Mechelen?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Voor zaken in het centrum van Mechelen bekijken we ook praktische leveringsvensters.",
        },
        {
          q: "Kan ik vanuit Mechelen afhalen in Aarschot?",
          a: "Ja, via de N15 en de N10 bent u in ongeveer een halfuur in ons magazijn. Bij afhaling krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Is het döner assortiment geschikt voor Turkse en halal zaken?",
          a: "Ons döner en kebab assortiment is samengesteld voor de Turkse en Mediterrane horeca. Vraag ons per product naar de specificaties en de herkomst, wij helpen u in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Mechelen Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Mechelen'deki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Salı ve perşembe teslimat, depodan alımda %15 indirim. WhatsApp ile sipariş.",
      h1: "Mechelen'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Mechelen, Grote Markt, Bruul ve Vismarkt çevresiyle Flaman bölgesinin en canlı şehirlerinden biri. Büyük Türk topluluğu sayesinde istasyon, Antwerpsesteenweg ve Nekkerspoel çevresinde yoğun bir dönerci, kebapçı ve pizzacı ağı var. Muizen, Hombeek ve Walem'de mahalle frituurları çalışıyor.</p><p>Aarschot'a 30 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Mechelen, Sint-Katelijne-Waver ve Bonheiden'e döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Depodan alımda %15 indirim; WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>87.000'den fazla nüfuslu Mechelen'de horeca her yıl büyüyor. Turistler katedrali ve Vismarkt'ı ziyaret ederken, istasyondaki yolcular ve öğrenciler pitacı ve frituurları dolduruyor. Şehir, Flaman bölgesinin en büyük Türk topluluklarından birine ev sahipliği yapıyor; Antwerpsesteenweg ve Nekkerspoel'de çok sayıda kebapçı ve Türk restoranı var.</p>",
      faq: [
        {
          q: "Maximus Mechelen'e hangi günler teslimat yapıyor?",
          a: "Mechelen, Muizen, Hombeek, Leest ve Walem ile Sint-Katelijne-Waver ve Bonheiden'e salı ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Mechelen'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin; şehir merkezi için uygun teslimat saatlerini birlikte belirleriz.",
        },
        {
          q: "Mechelen'den Aarschot'a gelip alım yapabilir miyim?",
          a: "Evet, N15 ve N10 üzerinden yaklaşık yarım saatte depomuzdasınız. Depodan alımda %15 indirim.",
        },
        {
          q: "Döner ürünleri Türk ve helal işletmelere uygun mu?",
          a: "Döner ve kebap çeşitlerimiz Türk ve Akdeniz mutfağı için seçilmiştir. Ürün bazında özellik ve menşe bilgisini Türkçe sorabilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "lier",
    name: "Lier",
    province: "Antwerpen",
    postcodes: ["2500", "2520"],
    distanceKm: 30,
    driveMinutes: 33,
    deliveryDays: ["di", "do"],
    lat: 51.1313,
    lng: 4.5705,
    nearby: ["Koningshooikt", "Ranst", "Boechout", "Nijlen", "Berlaar", "Duffel"],
    nl: {
      metaTitle: "Horeca groothandel Lier: döner, pizza & frituur | Maximus",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Lier en omgeving. Levering di en do vanuit Aarschot, -15% bij afhaling. Bestel snel via WhatsApp.",
      h1: "Horeca groothandel in Lier: döner, pizza en frituur leveringen",
      intro:
        "<p>Lier, de stad van de Zimmertoren en het Begijnhof, is een gezellige provinciestad met een verzorgd centrum rond de Grote Markt en de Antwerpsestraat. De horeca leeft van toeristen, winkelend publiek en de vele scholieren en pendelaars aan het station. Pitazaken, pizzeria's en frituren vindt u vooral in de Antwerpsestraat, aan de Leopoldplein en bij het station, terwijl Koningshooikt en de buurgemeenten Nijlen, Berlaar en Duffel op hun dorpsfrituren rekenen.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 30 kilometer en bedient Lier op dinsdag en donderdag met eigen koelwagens. We leveren döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen zoals pizzadozen, dönerboxen en frietbakjes.</p><p>Wie zelf naar Aarschot rijdt, krijgt 15% korting bij afhaling. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging.</p>",
      localProfile:
        "<p>Lier telt ongeveer 37.000 inwoners en trekt dankzij de Zimmertoren, het Begijnhof en de Netevaarten het hele jaar bezoekers. Het centrum is compact, met horeca rond de Grote Markt, de Zimmerplein en de Antwerpsestraat. Rond het station en de scholen in de binnenstad ligt de vaste klandizie voor pitazaken en frituren, en de Lierse markt op zaterdag brengt extra volk. Koningshooikt en de omliggende gemeenten Ranst, Boechout en Nijlen hebben een landelijker profiel met dorpsfrituren en afhaalpizzeria's.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Lier?",
          a: "Lier en Koningshooikt staan op onze route van dinsdag en donderdag, samen met Ranst, Boechout, Nijlen, Berlaar en Duffel.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Lier?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We stemmen de formule af op uw bestelvolume en frequentie.",
        },
        {
          q: "Kan ik vanuit Lier mijn bestelling afhalen in Aarschot?",
          a: "Ja, ons magazijn ligt op ongeveer een halfuur rijden. Bij afhaling in Aarschot krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Levert Maximus ook verpakkingen in Lier?",
          a: "Ja, pizzadozen, dönerboxen, frietbakjes, servetten en hygiëneproducten komen mee in dezelfde levering als uw voedingsproducten.",
        },
      ],
    },
    tr: {
      metaTitle: "Lier Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Lier ve çevresindeki dönerci, pizzacı ve frituurlar için toptancı. Salı ve perşembe teslimat, depodan alımda %15 indirim. WhatsApp ile sipariş.",
      h1: "Lier'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Zimmertoren ve Begijnhof'un şehri Lier, Grote Markt ve Antwerpsestraat çevresinde bakımlı bir merkeze sahip. Horeca turistler, alışverişçiler ve istasyondaki öğrenci ve yolculardan besleniyor; pitacılar, pizzacılar ve frituurlar Antwerpsestraat, Leopoldplein ve istasyon çevresinde yoğun.</p><p>Aarschot'a 30 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Lier, Koningshooikt, Nijlen, Berlaar ve Duffel'e döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Depodan alımda %15 indirim; WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 37.000 nüfuslu Lier, Zimmertoren ve Begijnhof sayesinde yıl boyu ziyaretçi çekiyor. Horeca Grote Markt, Zimmerplein ve Antwerpsestraat çevresinde toplanıyor. İstasyon ve merkezdeki okullar pitacı ve frituurların sabit müşterisi; cumartesi pazarı ek kalabalık getiriyor. Koningshooikt, Ranst ve Nijlen köy frituurları ve paket pizzacılarıyla daha kırsal bir profil taşıyor.</p>",
      faq: [
        {
          q: "Maximus Lier'e hangi günler teslimat yapıyor?",
          a: "Lier ve Koningshooikt ile Ranst, Boechout, Nijlen, Berlaar ve Duffel salı ve perşembe rotamızda.",
        },
        {
          q: "Lier'de minimum sipariş tutarı var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Lier'den Aarschot deposuna gelip alım yapabilir miyim?",
          a: "Evet, depomuz yaklaşık yarım saat mesafede; depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "Ambalaj ürünleri de teslim ediyor musunuz?",
          a: "Evet, pizza kutusu, döner kutusu, patates kabı, peçete ve hijyen ürünleri gıda ürünleriyle aynı teslimatta gelir.",
        },
      ],
    },
  },
  {
    slug: "tessenderlo",
    name: "Tessenderlo",
    province: "Limburg",
    postcodes: ["3980"],
    distanceKm: 26,
    driveMinutes: 26,
    deliveryDays: ["ma", "do"],
    lat: 51.0658,
    lng: 5.0873,
    nearby: ["Hulst", "Schoot", "Engsbergen", "Ham", "Kwaadmechelen", "Laakdal"],
    nl: {
      metaTitle: "Horeca groothandel Tessenderlo & Ham | Maximus Food Aarschot",
      metaDescription:
        "Döner, pizza en frituurproducten voor frituren en snackbars in Tessenderlo, Ham en Laakdal. Levering ma en do, -15% bij afhaling. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Tessenderlo: döner, pizza en frituur leveringen",
      intro:
        "<p>Tessenderlo ligt op de grens van Limburg, Antwerpen en Vlaams-Brabant en is vooral bekend als industriegemeente rond de chemiesite en de bedrijventerreinen langs de E313. Duizenden arbeiders en pendelaars zorgen elke middag voor een vaste stroom klanten bij de frituren, snackbars en pitazaken in het centrum en langs de Diesterstraat en de Geelsebaan. Ook de deelgemeenten Hulst, Schoot en Engsbergen hebben hun eigen dorpsfrituur.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 26 kilometer en rijdt op maandag en donderdag door Tessenderlo, Ham, Kwaadmechelen en Laakdal. We leveren döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Omdat Aarschot dichtbij ligt, kiezen veel zaken uit Tessenderlo voor afhaling met 15% korting. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.</p>",
      localProfile:
        "<p>Tessenderlo telt zo'n 19.000 inwoners en heeft een uitgesproken werkend karakter: de industriezones Schoonhees en Ravenshout en de chemische nijverheid brengen dagelijks veel volk naar de gemeente. De horeca is daarop afgestemd, met snackbars en frituren die pieken op de middag en pitazaken en pizzeria's die 's avonds de gezinnen bedienen. Het centrum rond de markt en de Stationsstraat is compact, en de nabije gemeenten Ham en Laakdal delen hetzelfde profiel van dorpsfrituren en afhaalzaken.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Tessenderlo?",
          a: "Tessenderlo, Hulst, Schoot en Engsbergen worden op maandag en donderdag beleverd, samen met Ham, Kwaadmechelen en Laakdal.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Tessenderlo?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We bekijken samen wat past bij uw volume en bestelfrequentie.",
        },
        {
          q: "Hoe ver is afhalen in Aarschot vanuit Tessenderlo?",
          a: "Ongeveer 25 minuten via de N127 of de E314. Bij afhaling in ons magazijn krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Hoe bestel ik bij Maximus vanuit Tessenderlo?",
          a: "Stuur uw bestelling via WhatsApp naar +32 467 07 71 64 of gebruik het online bestelformulier. U krijgt dezelfde dag een bevestiging.",
        },
      ],
    },
    tr: {
      metaTitle: "Tessenderlo Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Tessenderlo, Ham ve Laakdal'daki frituur ve dönerciler için toptancı. Pazartesi ve perşembe teslimat, depodan alımda %15 indirim. WhatsApp ile sipariş.",
      h1: "Tessenderlo'da horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Limburg, Antwerpen ve Vlaams-Brabant sınırındaki Tessenderlo, kimya tesisi ve E313 boyundaki sanayi bölgeleriyle tanınıyor. Binlerce işçi ve yolcu her öğlen merkezdeki, Diesterstraat ve Geelsebaan'daki frituur, snackbar ve pitacılara müşteri sağlıyor.</p><p>Aarschot'a 26 km mesafedeki MAXIMUS Food &amp; Horeca, pazartesi ve perşembe günleri Tessenderlo, Ham, Kwaadmechelen ve Laakdal'a döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Depodan alımda %15 indirim; WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 19.000 nüfuslu Tessenderlo belirgin bir sanayi karakterine sahip. Schoonhees ve Ravenshout sanayi bölgeleri her gün çok sayıda işçi getiriyor. Snackbar ve frituurlar öğlen, pitacı ve pizzacılar akşam yoğun. Ham ve Laakdal da aynı köy frituuru ve paket servis profilini paylaşıyor.</p>",
      faq: [
        {
          q: "Maximus Tessenderlo'ya hangi günler teslimat yapıyor?",
          a: "Tessenderlo, Hulst, Schoot ve Engsbergen ile Ham, Kwaadmechelen ve Laakdal'a pazartesi ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Tessenderlo'da minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Aarschot deposu Tessenderlo'ya ne kadar uzak?",
          a: "N127 veya E314 üzerinden yaklaşık 25 dakika. Depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "Tessenderlo'dan nasıl sipariş verebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu ile; aynı gün onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "beringen",
    name: "Beringen",
    province: "Limburg",
    postcodes: ["3580", "3581", "3582", "3583"],
    distanceKm: 33,
    driveMinutes: 30,
    deliveryDays: ["ma", "do"],
    lat: 51.049,
    lng: 5.2226,
    nearby: ["Paal", "Beverlo", "Koersel", "Heusden-Zolder", "Lummen", "Ham"],
    nl: {
      metaTitle: "Horeca groothandel Beringen: döner & pizza | Maximus Food",
      metaDescription:
        "Groothandel voor döner shops, kebabzaken, pizzeria's en frituren in Beringen en Koersel. Levering ma en do, -15% bij afhaling. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Beringen: döner, pizza en frituur leveringen",
      intro:
        "<p>Beringen is een van de mijngemeenten van Limburg en heeft daardoor een van de grootste Turkse gemeenschappen van het land, vooral in Beringen-Mijn en Koersel. Dat merkt u meteen aan de horeca: rond de Koolmijnlaan, de Stationsstraat en de mijnsite be-MINE vindt u een uitzonderlijke concentratie döner shops, kebabrestaurants, Turkse bakkers en pizzeria's. Daarnaast hebben Paal, Beverlo en het centrum van Beringen hun eigen frituren en snackbars.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 33 kilometer via de E313 en levert op maandag en donderdag in Beringen, Paal, Beverlo en Koersel, en in de buurgemeenten Heusden-Zolder, Lummen en Ham. Wij spreken Turks en Nederlands en kennen het assortiment dat een kebabzaak nodig heeft: döner en kebap, Turks brood en pide, kaas, Pauwels sauzen, Lutosa frieten, Mekkafood snacks, drank en verpakkingen.</p><p>Afhalen in Aarschot met 15% korting is voor Beringse zaken een haalbare optie op een halfuur rijden. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.</p>",
      localProfile:
        "<p>Beringen telt ruim 47.000 inwoners en dankt zijn diverse bevolking aan de steenkoolmijn, die tot 1989 arbeiders uit Turkije en Italië aantrok. Beringen-Mijn en Koersel vormen vandaag een levendig Turks handelscentrum met kebabzaken, pide-restaurants, bakkers en supermarkten. De herbestemde mijnsite be-MINE, met bioscoop, klimhal en duikcentrum, trekt dagjestoeristen die de horeca eromheen doen groeien. In Paal en Beverlo overheerst het klassieke Vlaamse profiel van frituur en afhaalpizzeria.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Beringen?",
          a: "Beringen, Paal, Beverlo en Koersel worden op maandag en donderdag beleverd, samen met Heusden-Zolder, Lummen en Ham op onze Limburgroute.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Beringen?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Voor de vele kebabzaken in Beringen-Mijn bekijken we graag een vaste weekbestelling.",
        },
        {
          q: "Kan ik vanuit Beringen afhalen in Aarschot?",
          a: "Ja, via de E313 en de N10 bent u in ongeveer een halfuur in ons magazijn. Bij afhaling krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Kan ik in het Turks bestellen bij Maximus?",
          a: "Zeker. Ons team helpt u in het Turks en het Nederlands, via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag een bevestiging.",
        },
      ],
    },
    tr: {
      metaTitle: "Beringen Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Beringen ve Koersel'deki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Pazartesi ve perşembe teslimat, %15 alım indirimi, Türkçe hizmet.",
      h1: "Beringen'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Limburg'un maden şehri Beringen, özellikle Beringen-Mijn ve Koersel'de Belçika'nın en büyük Türk topluluklarından birine ev sahipliği yapıyor. Koolmijnlaan, Stationsstraat ve be-MINE çevresinde dönerciler, kebapçılar, Türk fırınları ve pizzacılar yoğun. Paal ve Beverlo'da frituurlar ve snackbarlar var.</p><p>Aarschot'a 33 km mesafedeki MAXIMUS Food &amp; Horeca, pazartesi ve perşembe günleri Beringen, Paal, Beverlo, Koersel, Heusden-Zolder ve Lummen'e döner, pide, peynir, Pauwels sos, Lutosa patates, Mekkafood ve ambalaj teslim ediyor. Türkçe hizmet, depodan alımda %15 indirim. WhatsApp: +32 467 07 71 64.</p>",
      localProfile:
        "<p>47.000'den fazla nüfuslu Beringen, 1989'a kadar Türkiye ve İtalya'dan işçi çeken kömür madeni sayesinde çok kültürlü bir yapıya sahip. Beringen-Mijn ve Koersel bugün kebapçı, pideci, fırın ve marketleriyle canlı bir Türk ticaret merkezi. be-MINE maden sahası günübirlik turist çekiyor; Paal ve Beverlo klasik Flaman frituur profilini koruyor.</p>",
      faq: [
        {
          q: "Maximus Beringen'e hangi günler teslimat yapıyor?",
          a: "Beringen, Paal, Beverlo ve Koersel ile Heusden-Zolder, Lummen ve Ham'a pazartesi ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Beringen'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Beringen-Mijn'deki kebapçılar için sabit haftalık sipariş planı önerebiliriz.",
        },
        {
          q: "Beringen'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, E313 ve N10 üzerinden yaklaşık yarım saat. Depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "Türkçe sipariş verebilir miyim?",
          a: "Elbette. Ekibimiz WhatsApp (+32 467 07 71 64) ve online sipariş formu üzerinden Türkçe hizmet veriyor; aynı gün onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "hasselt",
    name: "Hasselt",
    province: "Limburg",
    postcodes: ["3500", "3501", "3510", "3511", "3512"],
    distanceKm: 45,
    driveMinutes: 38,
    deliveryDays: ["ma", "do"],
    lat: 50.9307,
    lng: 5.3378,
    nearby: ["Kuringen", "Kermt", "Sint-Lambrechts-Herk", "Zonhoven", "Diepenbeek", "Alken"],
    nl: {
      metaTitle: "Horeca groothandel Hasselt: döner & pizza | Maximus Food",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Hasselt en omgeving. Levering ma en do met eigen koelwagens. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Hasselt: döner, pizza en frituur leveringen",
      intro:
        "<p>Hasselt is de hoofdstad van Limburg en de shoppingstad bij uitstek, met de Demerstraat, de Koning Albertstraat en de Grote Markt als drukste assen. De horeca is er breed en divers: van brasseries en cocktailbars in het centrum tot döner shops, kebabrestaurants en frituren rond het station, de Kempische Steenweg en de Universiteit Hasselt in Diepenbeek. De vele studenten van UHasselt, PXL en UCLL zorgen voor een stevige avondomzet.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 45 kilometer via de E314. Op maandag en donderdag rijden onze koelwagens naar Hasselt, Kuringen, Kermt, Sint-Lambrechts-Herk en de buurgemeenten Zonhoven, Diepenbeek en Alken. Ons assortiment omvat döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen.</p><p>Bestellen doet u via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag nog een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Met bijna 80.000 inwoners en een verzorgingsgebied dat heel Limburg omvat, is Hasselt een stad die leeft van winkelen, uitgaan en evenementen. Het autovrije centrum en de Japanse Tuin trekken toeristen, terwijl het station en de scholencampussen in Diepenbeek en langs de Elfde-Liniestraat een jong publiek aantrekken dat vaak voor pita, pizza of frieten kiest. Rond de Kempische Steenweg en in Runkst zitten diverse kebabzaken en Turkse restaurants, en de Grenslandhallen en Pukkelpop in Kiewit zorgen voor jaarlijkse pieken.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Hasselt?",
          a: "Hasselt, Kuringen, Kermt en Sint-Lambrechts-Herk worden op maandag en donderdag beleverd, samen met Zonhoven, Diepenbeek en Alken.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Hasselt?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We bekijken samen welke bestelfrequentie en volumes het beste passen bij uw zaak.",
        },
        {
          q: "Kan ik ook afhalen in Aarschot vanuit Hasselt?",
          a: "Dat kan, ons magazijn ligt op ongeveer 40 minuten via de E314 en bij afhaling krijgt u 15% korting. Voor de meeste Hasseltse zaken is levering op maandag en donderdag het handigst.",
        },
        {
          q: "Is het döner assortiment geschikt voor Turkse en halal zaken?",
          a: "Ons döner en kebab assortiment is samengesteld voor de Turkse en Mediterrane horeca. Vraag ons per product naar de specificaties en de herkomst, in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Hasselt Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Hasselt ve çevresindeki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Pazartesi ve perşembe soğutmalı teslimat. WhatsApp ile sipariş verin.",
      h1: "Hasselt'te horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Limburg'un başkenti Hasselt, Demerstraat, Koning Albertstraat ve Grote Markt ile bir alışveriş şehri. İstasyon, Kempische Steenweg ve Diepenbeek'teki üniversite çevresinde dönerciler, kebapçılar ve frituurlar yoğun; UHasselt ve PXL öğrencileri akşam cirosunu sağlıyor.</p><p>Aarschot'a E314 üzerinden 45 km mesafedeki MAXIMUS Food &amp; Horeca, pazartesi ve perşembe günleri Hasselt, Kuringen, Kermt, Zonhoven, Diepenbeek ve Alken'e döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Sipariş için WhatsApp +32 467 07 71 64 veya online form.</p>",
      localProfile:
        "<p>Yaklaşık 80.000 nüfuslu Hasselt tüm Limburg'a hizmet veren bir alışveriş ve eğlence şehri. Araçsız merkez ve Japon Bahçesi turist çekerken, istasyon ve kampüsler pita, pizza ve patates seven genç bir kitle getiriyor. Kempische Steenweg ve Runkst'ta çok sayıda kebapçı ve Türk restoranı var.</p>",
      faq: [
        {
          q: "Maximus Hasselt'e hangi günler teslimat yapıyor?",
          a: "Hasselt, Kuringen, Kermt ve Sint-Lambrechts-Herk ile Zonhoven, Diepenbeek ve Alken'e pazartesi ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Hasselt'te minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Hasselt'ten Aarschot deposuna gelip alım yapabilir miyim?",
          a: "Evet, E314 üzerinden yaklaşık 40 dakika; depodan alımda %15 indirim. Çoğu işletme için pazartesi ve perşembe teslimatı daha pratik.",
        },
        {
          q: "Döner ürünleri Türk ve helal işletmelere uygun mu?",
          a: "Döner ve kebap çeşitlerimiz Türk ve Akdeniz mutfağı için seçilmiştir. Ürün bazında özellik ve menşe bilgisini Türkçe sorabilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "sint-truiden",
    name: "Sint-Truiden",
    province: "Limburg",
    postcodes: ["3800", "3803", "3806"],
    distanceKm: 33,
    driveMinutes: 32,
    deliveryDays: ["ma", "do"],
    lat: 50.8167,
    lng: 5.1864,
    nearby: ["Brustem", "Zepperen", "Velm", "Gelinden", "Nieuwerkerken", "Gingelom"],
    nl: {
      metaTitle: "Horeca groothandel Sint-Truiden: döner & pizza | Maximus",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Sint-Truiden en Haspengouw. Levering ma en do, -15% bij afhaling. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Sint-Truiden: döner, pizza en frituur leveringen",
      intro:
        "<p>Sint-Truiden is de hoofdstad van Haspengouw en de fruitstreek, met een van de grootste marktpleinen van België. Rond de Grote Markt, in de Luikerstraat en de Stapelstraat vindt u brasseries, pizzeria's en pitazaken, en aan het station en langs de Tiensesteenweg zitten frituren en snackbars die scholieren en pendelaars bedienen. In de bloesemperiode en tijdens de fruitpluk stroomt de stad vol met bezoekers en seizoenarbeiders.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 33 kilometer via Tienen en levert op maandag en donderdag in Sint-Truiden, Brustem, Zepperen, Velm en Gelinden, en in de buurgemeenten Nieuwerkerken en Gingelom. Ons assortiment omvat döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen.</p><p>Wie zelf naar Aarschot rijdt, krijgt 15% korting bij afhaling. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging.</p>",
      localProfile:
        "<p>Sint-Truiden telt ongeveer 42.000 inwoners en is het commerciële hart van Zuid-Limburg. De Grote Markt en de winkelstraten errond vormen een compact horecacentrum, terwijl het station en de scholen in de binnenstad de pitazaken en frituren een vaste middagpiek geven. De stad heeft een aanzienlijke Turkse en Marokkaanse gemeenschap, met kebabzaken rond de Tiensesteenweg en de Naamsesteenweg. De bloesemtoerist in april en de fruitpluk in de zomer en het najaar zorgen voor extra seizoensdrukte in de hele regio.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Sint-Truiden?",
          a: "Sint-Truiden, Brustem, Zepperen, Velm en Gelinden staan op onze route van maandag en donderdag, samen met Nieuwerkerken en Gingelom.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Sint-Truiden?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We stemmen de formule af op uw bestelvolume en frequentie.",
        },
        {
          q: "Kan ik vanuit Sint-Truiden afhalen in Aarschot?",
          a: "Ja, via Tienen bent u in ongeveer een halfuur in ons magazijn. Bij afhaling krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Hoe bestel ik bij Maximus vanuit Sint-Truiden?",
          a: "Via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag een bevestiging in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Sint-Truiden Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Sint-Truiden ve Haspengouw'daki dönerci, pizzacı ve frituurlar için toptancı. Pazartesi ve perşembe teslimat, depodan alımda %15 indirim.",
      h1: "Sint-Truiden'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Haspengouw meyve bölgesinin başkenti Sint-Truiden, Belçika'nın en büyük meydanlarından birine sahip. Grote Markt, Luikerstraat ve Stapelstraat'ta pizzacılar ve pitacılar; istasyon ve Tiensesteenweg boyunca frituurlar var. Çiçek mevsimi ve meyve hasadında şehir ziyaretçi ve mevsimlik işçiyle doluyor.</p><p>Aarschot'a 33 km mesafedeki MAXIMUS Food &amp; Horeca, pazartesi ve perşembe günleri Sint-Truiden, Brustem, Zepperen, Velm, Nieuwerkerken ve Gingelom'a döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Depodan alımda %15 indirim; WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 42.000 nüfuslu Sint-Truiden, Güney Limburg'un ticari kalbi. Grote Markt çevresi kompakt bir horeca merkezi; istasyon ve okullar pitacı ve frituurlara öğlen yoğunluğu sağlıyor. Tiensesteenweg ve Naamsesteenweg çevresinde kebapçılarıyla önemli bir Türk topluluğu var. Nisandaki çiçek turizmi ve yaz sonu meyve hasadı bölge genelinde ek sezon yoğunluğu yaratıyor.</p>",
      faq: [
        {
          q: "Maximus Sint-Truiden'e hangi günler teslimat yapıyor?",
          a: "Sint-Truiden, Brustem, Zepperen, Velm ve Gelinden ile Nieuwerkerken ve Gingelom pazartesi ve perşembe rotamızda.",
        },
        {
          q: "Sint-Truiden'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Sint-Truiden'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, Tienen üzerinden yaklaşık yarım saat. Depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "Sint-Truiden'den nasıl sipariş verebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu ile; aynı gün Türkçe onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "vilvoorde",
    name: "Vilvoorde",
    province: "Vlaams-Brabant",
    postcodes: ["1800"],
    distanceKm: 38,
    driveMinutes: 35,
    deliveryDays: ["ma", "wo", "vr"],
    lat: 50.9278,
    lng: 4.4267,
    nearby: ["Peutie", "Koningslo", "Houtem", "Machelen", "Zaventem", "Grimbergen"],
    nl: {
      metaTitle: "Horeca groothandel Vilvoorde: döner & pizza | Maximus Food",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Vilvoorde, Machelen en Zaventem. Levering ma, wo en vr. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Vilvoorde: döner, pizza en frituur leveringen",
      intro:
        "<p>Vilvoorde ligt aan de noordrand van Brussel, tussen het kanaal en de Ring, en combineert een oud industrieel hart met nieuwe woonwijken zoals Watersite en 4 Fonteinen. De stad heeft een zeer diverse bevolking, wat zich vertaalt in een groot aantal döner shops, kebabrestaurants, pizzeria's en snackbars rond de Grote Markt, de Leuvensestraat en het station. De bedrijvenzones langs de Mechelsesteenweg en de Woluwelaan brengen elke middag duizenden werknemers op de been.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 38 kilometer via de E314 en de Ring. Op maandag, woensdag en vrijdag leveren we in Vilvoorde, Peutie, Koningslo en Houtem en in de buurgemeenten Machelen, Zaventem en Grimbergen. We brengen döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestellen doet u via WhatsApp op +32 467 07 71 64 of via het online bestelformulier, met bevestiging dezelfde dag in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Vilvoorde telt ruim 46.000 inwoners en groeit snel dankzij de nabijheid van Brussel en de luchthaven van Zaventem. De horeca is uitgesproken multicultureel: rond het station en in de Leuvensestraat vindt u Turkse, Marokkaanse en Italiaanse zaken naast klassieke Vlaamse frituren. Het winkelcentrum aan de Grote Markt, de scholencampussen en de bedrijvenparken in Machelen en Zaventem zorgen voor een vaste middagklandizie, terwijl de nieuwe woonwijken langs het kanaal een jonge, stedelijke avondklant aantrekken.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Vilvoorde?",
          a: "Vilvoorde, Peutie, Koningslo en Houtem worden op maandag, woensdag en vrijdag beleverd, samen met Machelen, Zaventem en Grimbergen.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Vilvoorde?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We bekijken samen een formule die past bij uw volume en bestelfrequentie.",
        },
        {
          q: "Kan ik ook afhalen in Aarschot vanuit Vilvoorde?",
          a: "Ja, ons magazijn ligt op ongeveer 35 minuten via de E314. Bij afhaling krijgt u 15% korting, maar voor de meeste zaken is levering op drie dagen per week het handigst.",
        },
        {
          q: "Kan ik in het Turks bestellen?",
          a: "Zeker. Stuur uw bestelling in het Turks of het Nederlands via WhatsApp naar +32 467 07 71 64 of gebruik het online bestelformulier.",
        },
      ],
    },
    tr: {
      metaTitle: "Vilvoorde Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Vilvoorde, Machelen ve Zaventem'deki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Pazartesi, çarşamba ve cuma teslimat. Türkçe sipariş.",
      h1: "Vilvoorde'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Brüksel'in kuzey kenarındaki Vilvoorde, kanal ile Ring arasında eski sanayi kalbi ve yeni konut mahallelerini birleştiriyor. Çok kültürlü nüfus sayesinde Grote Markt, Leuvensestraat ve istasyon çevresinde çok sayıda dönerci, kebapçı, pizzacı ve snackbar var; Mechelsesteenweg'deki iş bölgeleri öğlen müşterisi sağlıyor.</p><p>Aarschot'a 38 km mesafedeki MAXIMUS Food &amp; Horeca, pazartesi, çarşamba ve cuma günleri Vilvoorde, Peutie, Koningslo, Machelen, Zaventem ve Grimbergen'e döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. WhatsApp: +32 467 07 71 64.</p>",
      localProfile:
        "<p>46.000'den fazla nüfuslu Vilvoorde, Brüksel ve Zaventem havalimanına yakınlığı sayesinde hızla büyüyor. Horeca belirgin biçimde çok kültürlü: istasyon ve Leuvensestraat'ta Türk, Fas ve İtalyan işletmeleri klasik Flaman frituurlarının yanında. İş parkları öğlen, kanal boyundaki yeni mahalleler akşam müşterisi getiriyor. Grote Markt'taki alışveriş merkezi ve okul kampüsleri sabit öğlen müşterisi sağlıyor.</p>",
      faq: [
        {
          q: "Maximus Vilvoorde'ye hangi günler teslimat yapıyor?",
          a: "Vilvoorde, Peutie, Koningslo ve Houtem ile Machelen, Zaventem ve Grimbergen'e pazartesi, çarşamba ve cuma teslimat yapıyoruz.",
        },
        {
          q: "Vilvoorde'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Vilvoorde'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, E314 üzerinden yaklaşık 35 dakika; depodan alımda %15 indirim. Çoğu işletme için haftada üç gün teslimat daha pratik.",
        },
        {
          q: "Türkçe sipariş verebilir miyim?",
          a: "Elbette. Siparişinizi Türkçe olarak WhatsApp (+32 467 07 71 64) veya online sipariş formu ile iletebilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "geel",
    name: "Geel",
    province: "Antwerpen",
    postcodes: ["2440"],
    distanceKm: 33,
    driveMinutes: 32,
    deliveryDays: ["di", "do"],
    lat: 51.1622,
    lng: 4.9905,
    nearby: ["Ten Aard", "Winkelomheide", "Laakdal", "Meerhout", "Kasterlee", "Westerlo"],
    nl: {
      metaTitle: "Horeca groothandel Geel: döner, pizza & frituur | Maximus",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Geel en de Kempen. Levering di en do vanuit Aarschot, -15% bij afhaling. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Geel: döner, pizza en frituur leveringen",
      intro:
        "<p>Geel is een echte Kempense centrumstad met een uitgestrekt grondgebied, een druk winkelcentrum rond de Markt en de Nieuwstraat, en een grote scholen- en hogeschoolcampus van Thomas More. Duizenden studenten en scholieren, plus de werknemers van de bedrijvenzones langs het Albertkanaal en de E313, zorgen voor een constante vraag naar pita, pizza en frieten. De pitazaken en frituren rond de Markt, het station en de Pas draaien daardoor het hele jaar door.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 33 kilometer via de N19 en rijdt op dinsdag en donderdag door Geel, Ten Aard en Winkelomheide en de buurgemeenten Laakdal, Meerhout, Kasterlee en Westerlo. We leveren döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen.</p><p>Afhalen in Aarschot met 15% korting kan op een halfuur rijden. Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en u krijgt dezelfde dag een bevestiging.</p>",
      localProfile:
        "<p>Geel telt ruim 41.000 inwoners en is bekend om zijn eeuwenoude gezinsverpleging en het ziekenhuis, maar vandaag vooral als studenten- en industriestad. De campus van Thomas More en de middelbare scholen vullen 's middags de pitazaken en frituren in de Nieuwstraat en aan de Werft. Het cultuurcentrum de Werft, de zomerse Geelse Feesten en het zwembad trekken extra publiek. In de landelijke gehuchten Ten Aard, Punt en Winkelomheide en in buurgemeenten als Westerlo en Kasterlee blijft de dorpsfrituur de vaste stek.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Geel?",
          a: "Geel, Ten Aard en Winkelomheide staan op onze Kempenroute van dinsdag en donderdag, samen met Laakdal, Meerhout, Kasterlee en Westerlo.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Geel?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We stemmen de formule af op uw bestelvolume en frequentie.",
        },
        {
          q: "Kan ik vanuit Geel afhalen in Aarschot?",
          a: "Ja, via de N19 bent u in ongeveer een halfuur in ons magazijn. Bij afhaling krijgt u 15% korting op uw bestelling.",
        },
        {
          q: "Levert Maximus in Geel ook drank en verpakkingen?",
          a: "Ja, frisdrank en water, pizzadozen, dönerboxen, frietbakjes en hygiëneproducten komen mee in dezelfde levering als uw voedingsproducten.",
        },
      ],
    },
    tr: {
      metaTitle: "Geel Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Geel ve Kempen'deki dönerci, pizzacı ve frituurlar için toptancı. Salı ve perşembe teslimat, depodan alımda %15 indirim. WhatsApp ile sipariş.",
      h1: "Geel'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Kempen'in merkez şehri Geel'de Markt ve Nieuwstraat çevresinde yoğun bir alışveriş merkezi ve Thomas More yüksekokul kampüsü var. Binlerce öğrenci ve Albertkanaal ile E313 boyundaki sanayi çalışanları pita, pizza ve patates talebini yıl boyu canlı tutuyor.</p><p>Aarschot'a N19 üzerinden 33 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Geel, Laakdal, Meerhout, Kasterlee ve Westerlo'ya döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos, içecek ve ambalaj teslim ediyor. Depodan alımda %15 indirim; WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>41.000'den fazla nüfuslu Geel bugün bir öğrenci ve sanayi şehri. Thomas More kampüsü ve liseler öğlen saatlerinde Nieuwstraat ve Werft'teki pitacı ve frituurları dolduruyor. Geelse Feesten yazın ek kalabalık getiriyor; Ten Aard ve Winkelomheide gibi köylerde köy frituuru vazgeçilmez. Westerlo ve Kasterlee gibi komşu belediyeler aynı rotada yer alıyor.</p>",
      faq: [
        {
          q: "Maximus Geel'e hangi günler teslimat yapıyor?",
          a: "Geel, Ten Aard ve Winkelomheide ile Laakdal, Meerhout, Kasterlee ve Westerlo salı ve perşembe Kempen rotamızda.",
        },
        {
          q: "Geel'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Geel'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, N19 üzerinden yaklaşık yarım saat. Depodan alımda %15 indirim uygulanır.",
        },
        {
          q: "İçecek ve ambalaj da teslim ediyor musunuz?",
          a: "Evet, meşrubat, su, pizza kutusu, döner kutusu, patates kabı ve hijyen ürünleri aynı teslimatta gelir.",
        },
      ],
    },
  },
  {
    slug: "mol",
    name: "Mol",
    province: "Antwerpen",
    postcodes: ["2400"],
    distanceKm: 40,
    driveMinutes: 38,
    deliveryDays: ["di", "do"],
    lat: 51.1911,
    lng: 5.1157,
    nearby: ["Wezel", "Rauw", "Achterbos", "Balen", "Dessel", "Retie"],
    nl: {
      metaTitle: "Horeca groothandel Mol: döner, pizza & frituur | Maximus",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Mol, Balen en Dessel. Levering di en do met eigen koelwagens. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Mol: döner, pizza en frituur leveringen",
      intro:
        "<p>Mol is de recreatiegemeente van de Kempen: de Zilvermeer- en Silverstrand-plassen, het Provinciaal Domein en de vele campings en vakantieparken trekken elke zomer honderdduizenden bezoekers. Daarnaast is Mol een onderzoeks- en onderwijscentrum met het SCK CEN, VITO en een grote scholengemeenschap, wat het hele jaar door zorgt voor pendelaars en scholieren. De frituren, pitazaken en pizzeria's in het centrum rond de Markt en de Corbiestraat, aan het station en bij de recreatiedomeinen kennen daardoor sterke seizoenspieken.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 40 kilometer en levert op dinsdag en donderdag in Mol, Wezel, Rauw en Achterbos en in de buurgemeenten Balen, Dessel en Retie. We brengen döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestellen doet u via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U ontvangt dezelfde dag nog een bevestiging.</p>",
      localProfile:
        "<p>Mol telt ongeveer 37.000 inwoners verspreid over een groot aantal gehuchten zoals Wezel, Rauw, Achterbos, Sluis en Ezaart, elk met een eigen frituur of snackbar. Het centrum rond de Markt en de Corbiestraat is de plek voor pitazaken, pizzeria's en cafés, terwijl de horeca rond het Zilvermeer en de campings in de zomer volle bak draait. De onderzoekscentra en de scholen zorgen voor een stabiele weekklandizie, en de nabijgelegen gemeenten Balen, Dessel en Retie delen hetzelfde landelijke, frituurgerichte profiel.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Mol?",
          a: "Mol en de gehuchten Wezel, Rauw en Achterbos worden op dinsdag en donderdag beleverd, samen met Balen, Dessel en Retie.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Mol?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Voor zaken met sterke zomerpieken bekijken we graag een flexibele planning.",
        },
        {
          q: "Kan ik ook afhalen in Aarschot vanuit Mol?",
          a: "Ja, ons magazijn ligt op ongeveer 40 minuten rijden en bij afhaling krijgt u 15% korting. Voor de meeste zaken in Mol is levering op dinsdag en donderdag het praktischt.",
        },
        {
          q: "Hoe bestel ik bij Maximus vanuit Mol?",
          a: "Via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag een bevestiging in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Mol Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Mol, Balen ve Dessel'deki frituur, pizzacı ve dönerciler için toptancı. Salı ve perşembe kendi soğutmalı araçlarımızla teslimat. WhatsApp ile sipariş verin.",
      h1: "Mol'da horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Kempen'in tatil beldesi Mol, Zilvermeer ve Silverstrand gölleri ile kamp alanları sayesinde her yaz yüz binlerce ziyaretçi ağırlıyor. SCK CEN ve VITO araştırma merkezleri ile okullar yıl boyu müşteri sağlıyor. Markt, Corbiestraat, istasyon ve göl çevresindeki frituur, pitacı ve pizzacılar güçlü sezon dalgalanmaları yaşıyor.</p><p>Aarschot'a 40 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Mol, Wezel, Rauw, Balen, Dessel ve Retie'ye döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. WhatsApp: +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 37.000 nüfuslu Mol, her birinde kendi frituuru bulunan Wezel, Rauw, Achterbos gibi çok sayıda köye yayılıyor. Markt ve Corbiestraat pitacı ve pizzacıların yeri; Zilvermeer ve kamp alanlarındaki horeca yazın tam kapasite çalışıyor. Balen, Dessel ve Retie aynı kırsal profili paylaşıyor.</p>",
      faq: [
        {
          q: "Maximus Mol'a hangi günler teslimat yapıyor?",
          a: "Mol ile Wezel, Rauw ve Achterbos'a ve Balen, Dessel, Retie'ye salı ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Mol'da minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin; yaz sezonu için esnek planlama yapabiliriz.",
        },
        {
          q: "Mol'dan Aarschot deposuna gelebilir miyim?",
          a: "Evet, yaklaşık 40 dakika mesafede; depodan alımda %15 indirim. Çoğu işletme için salı ve perşembe teslimatı daha pratik.",
        },
        {
          q: "Mol'dan nasıl sipariş verebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu ile; aynı gün Türkçe onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "turnhout",
    name: "Turnhout",
    province: "Antwerpen",
    postcodes: ["2300"],
    distanceKm: 52,
    driveMinutes: 45,
    deliveryDays: ["di", "do"],
    lat: 51.3226,
    lng: 4.9447,
    nearby: ["Oud-Turnhout", "Vosselaar", "Beerse", "Merksplas", "Arendonk", "Kasterlee"],
    nl: {
      metaTitle: "Horeca groothandel Turnhout: döner & pizza | Maximus Food",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Turnhout en de Noorderkempen. Levering di en do met eigen koelwagens. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Turnhout: döner, pizza en frituur leveringen",
      intro:
        "<p>Turnhout is de hoofdstad van de Kempen en het commerciële centrum van de Noorderkempen, vlak bij de Nederlandse grens. De Grote Markt, de Gasthuisstraat en de omgeving van het station en de Warande vormen een druk horecagebied met pitazaken, kebabrestaurants, pizzeria's en frituren. De stad heeft een grote Turkse gemeenschap en een jong publiek van Thomas More-studenten en scholieren, en de Nederlanders uit Baarle en Tilburg komen graag over de grens shoppen en eten.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 52 kilometer via de N19 en de E34 en levert op dinsdag en donderdag in Turnhout en de buurgemeenten Oud-Turnhout, Vosselaar, Beerse, Merksplas, Arendonk en Kasterlee. We brengen döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Turnhout telt ongeveer 46.000 inwoners en bedient een regio van meer dan 200.000 mensen. De binnenstad rond de Grote Markt en het Begijnhof combineert cafés en brasseries met een groot aanbod aan pita, kebab en pizza, vooral in de Otterstraat, de Merodelei en rond het station. De Turkse gemeenschap is prominent aanwezig met eigen restaurants, bakkers en supermarkten. Het cultuurhuis de Warande, de Turnhoutse kermis en de nabijheid van Bobbejaanland in Kasterlee brengen extra bezoekers naar de horeca.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Turnhout?",
          a: "Turnhout en de omliggende gemeenten Oud-Turnhout, Vosselaar, Beerse, Merksplas, Arendonk en Kasterlee staan op onze route van dinsdag en donderdag.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Turnhout?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Omdat Turnhout op het einde van onze Kempenroute ligt, plannen we leveringen graag in vaste weekbestellingen.",
        },
        {
          q: "Kan ik vanuit Turnhout afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer drie kwartier rijden en bij afhaling krijgt u 15% korting. Voor de meeste zaken in Turnhout is levering op dinsdag en donderdag het handigst.",
        },
        {
          q: "Kan ik in het Turks bestellen bij Maximus?",
          a: "Zeker. Ons team helpt u in het Turks en het Nederlands via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.",
        },
      ],
    },
    tr: {
      metaTitle: "Turnhout Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Turnhout ve Noorderkempen'deki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Salı ve perşembe teslimat, Türkçe hizmet. WhatsApp ile sipariş verin.",
      h1: "Turnhout'ta horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Kempen'in başkenti Turnhout, Hollanda sınırına yakın bir ticaret merkezi. Grote Markt, Gasthuisstraat, istasyon ve Warande çevresinde pitacılar, kebapçılar, pizzacılar ve frituurlar yoğun. Büyük bir Türk topluluğu, Thomas More öğrencileri ve sınırın ötesinden gelen Hollandalılar horeca'yı canlı tutuyor.</p><p>Aarschot'a 52 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Turnhout, Oud-Turnhout, Vosselaar, Beerse, Merksplas ve Arendonk'a döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 46.000 nüfuslu Turnhout 200.000'den fazla kişilik bir bölgeye hizmet veriyor. Otterstraat, Merodelei ve istasyon çevresinde pita, kebap ve pizza seçenekleri bol. Türk topluluğu kendi restoranları, fırınları ve marketleriyle görünür. Warande kültür merkezi ve Kasterlee'deki Bobbejaanland ek ziyaretçi getiriyor. Turnhout panayırı da horeca'ya ek müşteri getiriyor.</p>",
      faq: [
        {
          q: "Maximus Turnhout'a hangi günler teslimat yapıyor?",
          a: "Turnhout ile Oud-Turnhout, Vosselaar, Beerse, Merksplas, Arendonk ve Kasterlee salı ve perşembe rotamızda.",
        },
        {
          q: "Turnhout'ta minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Turnhout rotamızın sonunda olduğu için sabit haftalık siparişleri tercih ediyoruz.",
        },
        {
          q: "Turnhout'tan Aarschot deposuna gelebilir miyim?",
          a: "Evet, yaklaşık 45 dakika mesafede; depodan alımda %15 indirim. Çoğu işletme için salı ve perşembe teslimatı daha pratik.",
        },
        {
          q: "Türkçe sipariş verebilir miyim?",
          a: "Elbette. Ekibimiz WhatsApp (+32 467 07 71 64) ve online sipariş formu üzerinden Türkçe hizmet veriyor.",
        },
      ],
    },
  },
  {
    slug: "antwerpen",
    name: "Antwerpen",
    province: "Antwerpen",
    postcodes: ["2000", "2018", "2020", "2060", "2100"],
    distanceKm: 55,
    driveMinutes: 50,
    deliveryDays: ["di", "do"],
    lat: 51.2194,
    lng: 4.4025,
    nearby: ["Borgerhout", "Berchem", "Deurne", "Merksem", "Hoboken", "Wilrijk", "Mortsel"],
    nl: {
      metaTitle: "Horeca groothandel Antwerpen: döner & pizza | Maximus Food",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Antwerpen, Borgerhout en Deurne. Levering di en do. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Antwerpen: döner, pizza en frituur leveringen",
      intro:
        "<p>Antwerpen is de grootste stad van Vlaanderen en heeft de dichtste concentratie döner shops, kebabrestaurants, pizzeria's en frituren van het land. Van de Turnhoutsebaan in Borgerhout en de Bredabaan in Merksem tot de Statiestraat in Berchem, de Kioskplaats in Hoboken en de omgeving van het Centraal Station en de Meir: overal vindt u zaken die dagelijks grote volumes döner, pizzabodems en frieten verwerken. De diverse bevolking en het uitgaansleven rond het Zuid en het Eilandje maken Antwerpen een markt die nooit stilvalt.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 55 kilometer via de E313 en levert op dinsdag en donderdag in Antwerpen-centrum en de districten Borgerhout, Berchem, Deurne, Merksem, Hoboken en Wilrijk, evenals in Mortsel. We brengen döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Met meer dan 530.000 inwoners en een wereldhaven is Antwerpen een horecamarkt op zich. Borgerhout, Deurne-Noord en het Kiel hebben een sterke Turkse en Marokkaanse handelsgemeenschap met kebabzaken, pide-restaurants en Turkse bakkers. Rond het Centraal Station, de Keyserlei en de Meir mikken pitazaken en pizzeria's op toeristen en shoppers, terwijl de universiteitswijk en de studentenbuurten rond de Ossenmarkt en het Zuid een jong avondpubliek aantrekken. In Berchem, Wilrijk en Hoboken zijn buurtfrituren en afhaalpizzeria's de vaste waarden.</p>",
      faq: [
        {
          q: "In welke districten van Antwerpen levert Maximus?",
          a: "Op dinsdag en donderdag leveren we in Antwerpen-centrum, Borgerhout, Berchem, Deurne, Merksem, Hoboken en Wilrijk, en in Mortsel. Andere districten bespreken we graag op aanvraag.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Antwerpen?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Voor de stad Antwerpen werken we bij voorkeur met vaste weekbestellingen en afgesproken leveringsvensters.",
        },
        {
          q: "Kan ik vanuit Antwerpen afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer 50 minuten via de E313 en bij afhaling krijgt u 15% korting. Voor de meeste Antwerpse zaken is levering op dinsdag en donderdag het handigst.",
        },
        {
          q: "Is het döner assortiment geschikt voor Turkse en halal zaken?",
          a: "Ons döner en kebab assortiment is samengesteld voor de Turkse en Mediterrane horeca. Vraag ons per product naar de specificaties en de herkomst, in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Antwerpen Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Antwerpen, Borgerhout ve Deurne'deki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Salı ve perşembe teslimat, Türkçe hizmet. WhatsApp ile sipariş.",
      h1: "Antwerpen'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Flaman bölgesinin en büyük şehri Antwerpen, Belçika'nın en yoğun dönerci, kebapçı, pizzacı ve frituur ağına sahip. Borgerhout'taki Turnhoutsebaan, Merksem'deki Bredabaan, Berchem'deki Statiestraat ve Centraal Station çevresinde her gün büyük hacimlerde döner, pizza hamuru ve patates tüketiliyor.</p><p>Aarschot'a E313 üzerinden 55 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve perşembe günleri Antwerpen merkez, Borgerhout, Berchem, Deurne, Merksem, Hoboken, Wilrijk ve Mortsel'e döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>530.000'den fazla nüfuslu liman şehri Antwerpen başlı başına bir horeca pazarı. Borgerhout, Deurne-Noord ve Kiel'de kebapçı, pideci ve Türk fırınlarıyla güçlü bir Türk ve Fas ticaret topluluğu var. Centraal Station ve Meir çevresi turistlere, Ossenmarkt ve Zuid öğrencilere hitap ediyor.</p>",
      faq: [
        {
          q: "Maximus Antwerpen'in hangi ilçelerine teslimat yapıyor?",
          a: "Salı ve perşembe günleri Antwerpen merkez, Borgerhout, Berchem, Deurne, Merksem, Hoboken, Wilrijk ve Mortsel'e teslimat yapıyoruz. Diğer ilçeler için bize sorun.",
        },
        {
          q: "Antwerpen'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Antwerpen için sabit haftalık sipariş ve belirlenmiş teslimat saatleriyle çalışmayı tercih ediyoruz.",
        },
        {
          q: "Antwerpen'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, E313 üzerinden yaklaşık 50 dakika; depodan alımda %15 indirim. Çoğu işletme için salı ve perşembe teslimatı daha pratik.",
        },
        {
          q: "Döner ürünleri Türk ve helal işletmelere uygun mu?",
          a: "Döner ve kebap çeşitlerimiz Türk ve Akdeniz mutfağı için seçilmiştir. Ürün bazında özellik ve menşe bilgisini Türkçe sorabilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "genk",
    name: "Genk",
    province: "Limburg",
    postcodes: ["3600"],
    distanceKm: 58,
    driveMinutes: 45,
    deliveryDays: ["ma", "do"],
    lat: 50.965,
    lng: 5.5,
    nearby: ["Waterschei", "Winterslag", "Zwartberg", "Zutendaal", "As", "Houthalen-Helchteren"],
    nl: {
      metaTitle: "Horeca groothandel Genk: döner, kebab & pizza | Maximus Food",
      metaDescription:
        "Groothandel voor döner shops, kebabzaken, pizzeria's en frituren in Genk en Waterschei. Levering ma en do, Turkse service. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Genk: döner, pizza en frituur leveringen",
      intro:
        "<p>Genk is de meest multiculturele stad van Limburg, gegroeid rond de drie steenkoolmijnen van Winterslag, Waterschei en Zwartberg. De Turkse, Italiaanse en Griekse gemeenschappen hebben de stad een uitzonderlijk rijke eetcultuur gegeven: rond de Vennestraat, de Stalenstraat en het Shopping Center vindt u kebabzaken, pide-salons, pizzeria's en Turkse bakkers naast klassieke Vlaamse frituren. De mijnsite C-mine en het Nationaal Park Hoge Kempen trekken bovendien toeristen en fietsers naar de stad.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 58 kilometer via de E314 en levert op maandag en donderdag in Genk, Waterschei, Winterslag en Zwartberg en in de buurgemeenten Zutendaal, As en Houthalen-Helchteren. Wij spreken Turks en Nederlands en leveren döner en kebap, Turks brood en pide, kaas, Pauwels sauzen, Lutosa frieten, Mekkafood snacks, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging.</p>",
      localProfile:
        "<p>Genk telt ruim 66.000 inwoners van meer dan honderd nationaliteiten, met een van de grootste Turkse gemeenschappen van België. De wijken Waterschei, Winterslag, Zwartberg en Sledderlo hebben elk een eigen handelskern met kebabrestaurants, Turkse pizzeria's en bakkers, terwijl het stadscentrum rond de Grote Markt en het Shopping Center 1 en 2 het winkelend publiek bedient. C-mine, het Kattevennen-park en de Thor-site brengen extra bezoekers, en de scholencampussen en de industriezone Genk-Zuid zorgen voor een vaste middagklandizie.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Genk?",
          a: "Genk, Waterschei, Winterslag en Zwartberg worden op maandag en donderdag beleverd, samen met Zutendaal, As en Houthalen-Helchteren op onze Limburgroute.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Genk?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Voor de vele kebabzaken in Genk bekijken we graag een vaste weekbestelling die past bij uw omzet.",
        },
        {
          q: "Kan ik vanuit Genk afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer drie kwartier via de E314 en bij afhaling krijgt u 15% korting. Voor de meeste Genkse zaken is levering op maandag en donderdag het handigst.",
        },
        {
          q: "Kan ik in het Turks bestellen bij Maximus?",
          a: "Zeker. Ons team helpt u in het Turks en het Nederlands via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.",
        },
      ],
    },
    tr: {
      metaTitle: "Genk Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Genk ve Waterschei'deki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Pazartesi ve perşembe teslimat, Türkçe hizmet. WhatsApp ile sipariş.",
      h1: "Genk'te horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Limburg'un en çok kültürlü şehri Genk, Winterslag, Waterschei ve Zwartberg madenleri çevresinde büyüdü. Türk, İtalyan ve Yunan toplulukları şehre zengin bir yemek kültürü kazandırdı: Vennestraat, Stalenstraat ve Shopping Center çevresinde kebapçılar, pideciler, pizzacılar ve Türk fırınları var. C-mine ve Hoge Kempen Milli Parkı turist çekiyor.</p><p>Aarschot'a E314 üzerinden 58 km mesafedeki MAXIMUS Food &amp; Horeca, pazartesi ve perşembe günleri Genk, Zutendaal, As ve Houthalen-Helchteren'e döner, pide, peynir, Pauwels sos, Lutosa patates, Mekkafood ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>66.000'den fazla nüfuslu Genk, yüzden fazla milliyetle Belçika'nın en büyük Türk topluluklarından birine ev sahipliği yapıyor. Waterschei, Winterslag, Zwartberg ve Sledderlo'nun her birinde kebapçı, Türk pizzacısı ve fırınlarıyla kendi ticaret merkezi var. Genk-Zuid sanayi bölgesi ve okullar sabit öğlen müşterisi sağlıyor.</p>",
      faq: [
        {
          q: "Maximus Genk'e hangi günler teslimat yapıyor?",
          a: "Genk, Waterschei, Winterslag ve Zwartberg ile Zutendaal, As ve Houthalen-Helchteren'e pazartesi ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Genk'te minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Genk'teki kebapçılar için cironuza uygun sabit haftalık sipariş planı önerebiliriz.",
        },
        {
          q: "Genk'ten Aarschot deposuna gelebilir miyim?",
          a: "Evet, E314 üzerinden yaklaşık 45 dakika; depodan alımda %15 indirim. Çoğu işletme için pazartesi ve perşembe teslimatı daha pratik.",
        },
        {
          q: "Türkçe sipariş verebilir miyim?",
          a: "Elbette. Ekibimiz WhatsApp (+32 467 07 71 64) ve online sipariş formu üzerinden Türkçe hizmet veriyor.",
        },
      ],
    },
  },
  {
    slug: "brussel",
    name: "Brussel",
    province: "Brussel",
    postcodes: ["1000", "1030", "1050", "1070", "1080"],
    distanceKm: 50,
    driveMinutes: 50,
    deliveryDays: ["wo", "vr"],
    lat: 50.8503,
    lng: 4.3517,
    nearby: ["Schaarbeek", "Anderlecht", "Sint-Jans-Molenbeek", "Elsene", "Etterbeek", "Sint-Gillis", "Laken"],
    nl: {
      metaTitle: "Horeca groothandel Brussel: döner & pizza | Maximus Food",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Brussel, Schaarbeek en Anderlecht. Levering wo en vr. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Brussel: döner, pizza en frituur leveringen",
      intro:
        "<p>Brussel is de hoofdstad van België en Europa en een van de grootste horecamarkten van het land. Nergens is de dichtheid aan döner shops, kebabrestaurants, pizzeria's en frituren zo hoog als in Schaarbeek, Sint-Joost, Anderlecht en Sint-Jans-Molenbeek, en de Brabantstraat, de Chaussée de Haecht en de Bergensesteenweg zijn echte kebabassen. Daarbij komen de toeristen rond de Grote Markt en de Beurs, de studenten van de ULB en VUB in Elsene en Etterbeek en de kantoorwerknemers in de Europese wijk.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 50 kilometer via de E314 en de Ring en levert op woensdag en vrijdag in Brussel-stad en de gemeenten Schaarbeek, Anderlecht, Sint-Jans-Molenbeek, Elsene, Etterbeek, Sint-Gillis en Laken. We brengen döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Het Brussels Hoofdstedelijk Gewest telt ruim 1,2 miljoen inwoners uit de hele wereld, met grote Turkse gemeenschappen in Schaarbeek en Sint-Joost en een uitgebreid netwerk van Turkse restaurants, pide-salons, bakkers en kebabzaken. Rond het Noordstation, de Brabantstraat en het Liedtsplein draait de horeca dag en nacht. De Beurs, de Grote Markt en de Nieuwstraat trekken toeristen en shoppers, terwijl Elsene en Sint-Gillis een jong, kosmopolitisch avondpubliek hebben. Frituren blijven overal in de stad een vaste waarde, van Flagey tot Jourdan.</p>",
      faq: [
        {
          q: "In welke Brusselse gemeenten levert Maximus?",
          a: "Op woensdag en vrijdag leveren we in Brussel-stad, Laken, Schaarbeek, Anderlecht, Sint-Jans-Molenbeek, Elsene, Etterbeek en Sint-Gillis. Andere gemeenten bespreken we graag op aanvraag.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Brussel?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. In Brussel werken we bij voorkeur met vaste weekbestellingen en afgesproken leveringsvensters, zodat onze chauffeurs vlot kunnen lossen.",
        },
        {
          q: "Kan ik vanuit Brussel afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer 50 minuten via de E314 en bij afhaling krijgt u 15% korting. Voor de meeste Brusselse zaken is levering op woensdag en vrijdag het praktischt.",
        },
        {
          q: "Kan ik in het Turks bestellen bij Maximus?",
          a: "Zeker. Ons team helpt u in het Turks en het Nederlands via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.",
        },
      ],
    },
    tr: {
      metaTitle: "Brüksel Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Brüksel, Schaerbeek ve Anderlecht'teki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Çarşamba ve cuma teslimat, Türkçe hizmet.",
      h1: "Brüksel'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Belçika ve Avrupa'nın başkenti Brüksel, ülkenin en büyük horeca pazarlarından biri. Schaerbeek, Sint-Joost, Anderlecht ve Molenbeek'te dönerci, kebapçı, pizzacı ve frituur yoğunluğu benzersiz; Brabantstraat ve Chaussée de Haecht gerçek kebap caddeleri. Grote Markt çevresindeki turistler ve ULB, VUB öğrencileri de ek müşteri sağlıyor.</p><p>Aarschot'a 50 km mesafedeki MAXIMUS Food &amp; Horeca, çarşamba ve cuma günleri Brüksel merkez, Schaerbeek, Anderlecht, Molenbeek, Elsene, Etterbeek, Sint-Gillis ve Laken'e döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>1,2 milyondan fazla nüfuslu Brüksel Başkent Bölgesi'nde Schaerbeek ve Sint-Joost'ta büyük Türk toplulukları, Türk restoranları, pideciler, fırınlar ve kebapçılar var. Noordstation, Brabantstraat ve Liedtsplein çevresinde horeca gece gündüz çalışıyor. Elsene ve Sint-Gillis genç, kozmopolit bir akşam kitlesine sahip. Flagey'den Jourdan'a kadar frituurlar şehrin her yerinde vazgeçilmez.</p>",
      faq: [
        {
          q: "Maximus Brüksel'in hangi belediyelerine teslimat yapıyor?",
          a: "Çarşamba ve cuma günleri Brüksel merkez, Laken, Schaerbeek, Anderlecht, Molenbeek, Elsene, Etterbeek ve Sint-Gillis'e teslimat yapıyoruz. Diğer belediyeler için bize sorun.",
        },
        {
          q: "Brüksel'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Brüksel'de sabit haftalık sipariş ve belirlenmiş teslimat saatleriyle çalışmayı tercih ediyoruz.",
        },
        {
          q: "Brüksel'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, E314 üzerinden yaklaşık 50 dakika; depodan alımda %15 indirim. Çoğu işletme için çarşamba ve cuma teslimatı daha pratik.",
        },
        {
          q: "Türkçe sipariş verebilir miyim?",
          a: "Elbette. Ekibimiz WhatsApp (+32 467 07 71 64) ve online sipariş formu üzerinden Türkçe hizmet veriyor.",
        },
      ],
    },
  },
  {
    slug: "halle",
    name: "Halle",
    province: "Vlaams-Brabant",
    postcodes: ["1500", "1501", "1502"],
    distanceKm: 65,
    driveMinutes: 55,
    deliveryDays: ["wo", "vr"],
    lat: 50.7337,
    lng: 4.2361,
    nearby: ["Buizingen", "Lembeek", "Sint-Pieters-Leeuw", "Beersel", "Dworp", "Huizingen"],
    nl: {
      metaTitle: "Horeca groothandel Halle: döner, pizza & frituur | Maximus",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Halle, Buizingen en Lembeek. Levering wo en vr met eigen koelwagens. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Halle: döner, pizza en frituur leveringen",
      intro:
        "<p>Halle is de centrumstad van het Pajottenland en de Zennevallei, ten zuidwesten van Brussel en vlak bij de taalgrens. De Basiliek van Sint-Martinus en de Grote Markt vormen het historische hart, met eromheen een compact winkelgebied in de Basiliekstraat en de Molenborre. Het station van Halle is een van de drukste van Vlaams-Brabant en trekt elke dag duizenden pendelaars, terwijl de bedrijvenzones langs de A8 en het kanaal in Buizingen en Lembeek veel arbeiders aantrekken. Pitazaken, pizzeria's en frituren zitten daardoor vooral rond het station en de markt.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 65 kilometer via de Ring en levert op woensdag en vrijdag in Halle, Buizingen en Lembeek en in de buurgemeenten Sint-Pieters-Leeuw, Beersel, Dworp en Huizingen. We brengen döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en u krijgt dezelfde dag een bevestiging.</p>",
      localProfile:
        "<p>Halle telt ongeveer 41.000 inwoners en groeit als woonstad voor wie in Brussel werkt. De horeca rond de Grote Markt en de basiliek combineert brasseries en cafés met pitazaken en pizzeria's, en het stationsplein is de plek voor snelle hap en frituur. Het jaarlijkse Carnaval Halle, een van de grootste van België, en de wekelijkse markt brengen extra volk. In Buizingen en Lembeek overheersen buurtfrituren, en de villawijken van Beersel en Dworp zorgen voor een stevige afhaal- en leveringsmarkt voor pizza.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Halle?",
          a: "Halle, Buizingen en Lembeek staan op onze route van woensdag en vrijdag, samen met Sint-Pieters-Leeuw, Beersel, Dworp en Huizingen.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Halle?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Omdat Halle op het einde van onze Brusselse route ligt, werken we bij voorkeur met vaste weekbestellingen.",
        },
        {
          q: "Kan ik vanuit Halle afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer een uur rijden en bij afhaling krijgt u 15% korting. Voor de meeste zaken in Halle is levering op woensdag en vrijdag het handigst.",
        },
        {
          q: "Hoe bestel ik bij Maximus vanuit Halle?",
          a: "Via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. U krijgt dezelfde dag een bevestiging in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Halle Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Halle, Buizingen ve Lembeek'teki dönerci, pizzacı ve frituurlar için toptancı. Çarşamba ve cuma soğutmalı teslimat. WhatsApp ile sipariş verin.",
      h1: "Halle'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Brüksel'in güneybatısında, dil sınırına yakın Halle, Pajottenland ve Zenne vadisinin merkez şehri. Bazilika ve Grote Markt tarihi kalbi oluşturuyor; Vlaams-Brabant'ın en yoğun istasyonlarından biri her gün binlerce yolcu getiriyor. Pitacılar, pizzacılar ve frituurlar istasyon ve meydan çevresinde yoğunlaşıyor.</p><p>Aarschot'a 65 km mesafedeki MAXIMUS Food &amp; Horeca, çarşamba ve cuma günleri Halle, Buizingen, Lembeek, Sint-Pieters-Leeuw, Beersel ve Dworp'a döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. WhatsApp: +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 41.000 nüfuslu Halle, Brüksel'de çalışanlar için büyüyen bir yerleşim şehri. Grote Markt ve bazilika çevresinde pitacı ve pizzacılar, istasyon meydanında frituurlar var. Belçika'nın en büyük karnavallarından Carnaval Halle ek kalabalık getiriyor. Beersel ve Dworp'un villa mahalleleri güçlü bir paket pizza pazarı.</p>",
      faq: [
        {
          q: "Maximus Halle'ye hangi günler teslimat yapıyor?",
          a: "Halle, Buizingen ve Lembeek ile Sint-Pieters-Leeuw, Beersel, Dworp ve Huizingen çarşamba ve cuma rotamızda.",
        },
        {
          q: "Halle'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Halle Brüksel rotamızın sonunda olduğu için sabit haftalık siparişleri tercih ediyoruz.",
        },
        {
          q: "Halle'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, yaklaşık bir saat mesafede; depodan alımda %15 indirim. Çoğu işletme için çarşamba ve cuma teslimatı daha pratik.",
        },
        {
          q: "Halle'den nasıl sipariş verebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu ile; aynı gün Türkçe onay alırsınız.",
        },
      ],
    },
  },
  {
    slug: "aalst",
    name: "Aalst",
    province: "Oost-Vlaanderen",
    postcodes: ["9300", "9308", "9310", "9320"],
    distanceKm: 62,
    driveMinutes: 55,
    deliveryDays: ["di", "vr"],
    lat: 50.9378,
    lng: 4.04,
    nearby: ["Erembodegem", "Hofstade", "Moorsel", "Nieuwerkerken", "Gijzegem", "Lede", "Erpe-Mere"],
    nl: {
      metaTitle: "Horeca groothandel Aalst: döner, pizza & frituur | Maximus",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Aalst en omgeving. Levering di en vr met eigen koelwagens. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Aalst: döner, pizza en frituur leveringen",
      intro:
        "<p>Aalst is de carnavalstad van Vlaanderen en het commerciële centrum van de Denderstreek, halfweg tussen Brussel en Gent. De Grote Markt met het Belfort, de Nieuwstraat en de Molenstraat vormen een druk winkelgebied, en het vernieuwde stationskwartier en de Denderoevers trekken een jong publiek. Rond het station, aan de Vaartstraat en in de Pontstraat vindt u een dicht netwerk van döner shops, pizzeria's en frituren, terwijl de deelgemeenten Erembodegem, Hofstade en Moorsel rekenen op hun eigen dorpsfrituur.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 62 kilometer via de E40 en levert op dinsdag en vrijdag in Aalst en de deelgemeenten en in de buurgemeenten Lede en Erpe-Mere. We brengen döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Aalst telt bijna 90.000 inwoners en is een echte handelsstad met een grote regionale aantrekkingskracht. Aalst Carnaval brengt jaarlijks honderdduizenden feestvierders naar het centrum, drie dagen waarop frituren en döner shops tot diep in de nacht draaien. Het station, de scholencampussen en de Odisee-hogeschool zorgen voor een vaste middagpiek, en de industriezones langs de Dender en de E40 in Erembodegem brengen veel arbeiders. De stad heeft een groeiende Turkse en Marokkaanse gemeenschap met eigen kebabzaken rond de Vaartstraat en het Werf.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Aalst?",
          a: "Aalst, Erembodegem, Hofstade, Moorsel, Nieuwerkerken en Gijzegem worden op dinsdag en vrijdag beleverd, samen met Lede en Erpe-Mere.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Aalst?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Rond Aalst Carnaval plannen we graag vooraf extra volumes in.",
        },
        {
          q: "Kan ik vanuit Aalst afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer een uur via de E40 en bij afhaling krijgt u 15% korting. Voor de meeste zaken in Aalst is levering op dinsdag en vrijdag het handigst.",
        },
        {
          q: "Is het döner assortiment geschikt voor Turkse en halal zaken?",
          a: "Ons döner en kebab assortiment is samengesteld voor de Turkse en Mediterrane horeca. Vraag ons per product naar de specificaties en de herkomst, in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Aalst Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Aalst ve çevresindeki dönerci, pizzacı ve frituurlar için toptancı. Salı ve cuma kendi soğutmalı araçlarımızla teslimat. WhatsApp ile Türkçe sipariş verin.",
      h1: "Aalst'ta horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Flaman bölgesinin karnaval şehri Aalst, Brüksel ile Gent arasında Dender bölgesinin ticaret merkezi. Grote Markt, Nieuwstraat ve yenilenen istasyon bölgesi kalabalık; istasyon, Vaartstraat ve Pontstraat çevresinde yoğun bir dönerci, pizzacı ve frituur ağı var.</p><p>Aarschot'a E40 üzerinden 62 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve cuma günleri Aalst, Erembodegem, Hofstade, Moorsel, Lede ve Erpe-Mere'ye döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 90.000 nüfuslu Aalst bölgesel çekim gücü yüksek bir ticaret şehri. Aalst Karnavalı her yıl yüz binlerce kişiyi merkeze getiriyor; frituur ve dönerciler gece boyu çalışıyor. İstasyon, Odisee yüksekokulu ve Erembodegem sanayi bölgesi sabit müşteri sağlıyor. Vaartstraat çevresinde büyüyen bir Türk topluluğu var.</p>",
      faq: [
        {
          q: "Maximus Aalst'a hangi günler teslimat yapıyor?",
          a: "Aalst, Erembodegem, Hofstade, Moorsel, Nieuwerkerken ve Gijzegem ile Lede ve Erpe-Mere'ye salı ve cuma teslimat yapıyoruz.",
        },
        {
          q: "Aalst'ta minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Karnaval dönemi için ek hacimleri önceden planlayabiliriz.",
        },
        {
          q: "Aalst'tan Aarschot deposuna gelebilir miyim?",
          a: "Evet, E40 üzerinden yaklaşık bir saat; depodan alımda %15 indirim. Çoğu işletme için salı ve cuma teslimatı daha pratik.",
        },
        {
          q: "Döner ürünleri Türk ve helal işletmelere uygun mu?",
          a: "Döner ve kebap çeşitlerimiz Türk ve Akdeniz mutfağı için seçilmiştir. Ürün bazında özellik ve menşe bilgisini Türkçe sorabilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "dendermonde",
    name: "Dendermonde",
    province: "Oost-Vlaanderen",
    postcodes: ["9200"],
    distanceKm: 60,
    driveMinutes: 55,
    deliveryDays: ["di", "vr"],
    lat: 51.0283,
    lng: 4.1011,
    nearby: ["Sint-Gillis-bij-Dendermonde", "Appels", "Baasrode", "Grembergen", "Oudegem", "Lebbeke", "Buggenhout"],
    nl: {
      metaTitle: "Horeca groothandel Dendermonde: döner & pizza | Maximus Food",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Dendermonde en Lebbeke. Levering di en vr met eigen koelwagens. Bestel vandaag via WhatsApp.",
      h1: "Horeca groothandel in Dendermonde: döner, pizza en frituur leveringen",
      intro:
        "<p>Dendermonde ligt waar de Dender in de Schelde uitmondt en is een stad met een rijke geschiedenis: het Ros Beiaard, het Belfort en het Begijnhof trekken toeristen naar de Grote Markt en de Brusselsestraat. De horeca combineert brasseries op de markt met pitazaken, pizzeria's en frituren aan het station, in de Oude Vest en langs de Mechelsesteenweg. De deelgemeenten Sint-Gillis, Grembergen, Baasrode en Appels hebben elk hun eigen frituur, en de bedrijvenzone Hoogveld brengt dagelijks veel werknemers op de been.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 60 kilometer via Mechelen en levert op dinsdag en vrijdag in Dendermonde en de deelgemeenten en in de buurgemeenten Lebbeke en Buggenhout. We brengen döner en kebab, pizzabodems en kaas, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en u krijgt dezelfde dag een bevestiging.</p>",
      localProfile:
        "<p>Dendermonde telt ongeveer 47.000 inwoners en fungeert als centrumstad voor het oosten van Oost-Vlaanderen. Het station, de scholen in de binnenstad en de gevangenis zorgen voor een vaste doordeweekse klandizie, terwijl de Ros Beiaardommegang en Katuit tienduizenden bezoekers naar het centrum brengen. Frituren en snackbars vindt u in elke deelgemeente, van Baasrode aan de Schelde tot Oudegem en Appels. De nabije gemeenten Lebbeke en Buggenhout delen hetzelfde profiel van dorpsfrituren en afhaalpizzeria's met een trouwe lokale klantenkring.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Dendermonde?",
          a: "Dendermonde, Sint-Gillis, Appels, Baasrode, Grembergen en Oudegem staan op onze route van dinsdag en vrijdag, samen met Lebbeke en Buggenhout.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Dendermonde?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. We stemmen de formule af op uw bestelvolume en frequentie.",
        },
        {
          q: "Kan ik vanuit Dendermonde afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer een uur rijden en bij afhaling krijgt u 15% korting. Voor de meeste zaken in Dendermonde is levering op dinsdag en vrijdag het handigst.",
        },
        {
          q: "Levert Maximus in Dendermonde ook verpakkingen?",
          a: "Ja, pizzadozen, dönerboxen, frietbakjes, servetten en hygiëneproducten komen mee in dezelfde levering als uw voedingsproducten.",
        },
      ],
    },
    tr: {
      metaTitle: "Dendermonde Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Dendermonde, Lebbeke ve Buggenhout'taki dönerci, pizzacı ve frituurlar için toptancı. Salı ve cuma kendi soğutmalı araçlarımızla teslimat. WhatsApp ile sipariş.",
      h1: "Dendermonde'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Dender'in Schelde'ye döküldüğü yerdeki Dendermonde, Ros Beiaard ve Belfort'uyla turist çeken tarihi bir şehir. Grote Markt'ta brasserieler, istasyon, Oude Vest ve Mechelsesteenweg'de pitacılar, pizzacılar ve frituurlar var. Hoogveld sanayi bölgesi her gün çok sayıda çalışan getiriyor.</p><p>Aarschot'a 60 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve cuma günleri Dendermonde, Sint-Gillis, Baasrode, Grembergen, Lebbeke ve Buggenhout'a döner, pizza hamuru, peynir, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. WhatsApp: +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 47.000 nüfuslu Dendermonde, Doğu Flandre'nin doğusunun merkez şehri. İstasyon ve okullar hafta içi sabit müşteri sağlıyor; Ros Beiaard geçidi ve Katuit on binlerce ziyaretçi getiriyor. Baasrode'den Oudegem'e her mahallede frituur var; Lebbeke ve Buggenhout aynı profili paylaşıyor. Hoogveld sanayi bölgesi hafta içi öğlen yoğunluğu yaratıyor.</p>",
      faq: [
        {
          q: "Maximus Dendermonde'ye hangi günler teslimat yapıyor?",
          a: "Dendermonde ve mahalleleri ile Lebbeke ve Buggenhout salı ve cuma rotamızda.",
        },
        {
          q: "Dendermonde'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin.",
        },
        {
          q: "Dendermonde'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, yaklaşık bir saat mesafede; depodan alımda %15 indirim. Çoğu işletme için salı ve cuma teslimatı daha pratik.",
        },
        {
          q: "Ambalaj ürünleri de teslim ediyor musunuz?",
          a: "Evet, pizza kutusu, döner kutusu, patates kabı, peçete ve hijyen ürünleri gıda ürünleriyle aynı teslimatta gelir.",
        },
      ],
    },
  },
  {
    slug: "sint-niklaas",
    name: "Sint-Niklaas",
    province: "Oost-Vlaanderen",
    postcodes: ["9100", "9111", "9112"],
    distanceKm: 70,
    driveMinutes: 60,
    deliveryDays: ["di", "vr"],
    lat: 51.1655,
    lng: 4.1437,
    nearby: ["Belsele", "Nieuwkerken-Waas", "Sinaai", "Temse", "Lokeren", "Beveren"],
    nl: {
      metaTitle: "Horeca groothandel Sint-Niklaas: döner & pizza | Maximus",
      metaDescription:
        "Döner, pizza-ingrediënten en frituursnacks voor de horeca in Sint-Niklaas en het Waasland. Levering di en vr. Bestel eenvoudig via WhatsApp.",
      h1: "Horeca groothandel in Sint-Niklaas: döner, pizza en frituur leveringen",
      intro:
        "<p>Sint-Niklaas is de hoofdstad van het Waasland en heeft de grootste markt van België, waar elke donderdag een van de drukste weekmarkten van het land plaatsvindt. De Stationsstraat en het Waasland Shopping Center trekken winkelend publiek uit de hele regio, en rond het station en de Grote Markt zitten pitazaken, kebabrestaurants, pizzeria's en frituren dicht bij elkaar. De stad heeft een grote Turkse gemeenschap, vooral rond de Hazewindstraat en de Dalstraat, en veel scholieren van de vele middelbare scholen en de Odisee-campus.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 70 kilometer via de E17 en levert op dinsdag en vrijdag in Sint-Niklaas, Belsele, Nieuwkerken-Waas en Sinaai en in de buurgemeenten Temse, Lokeren en Beveren. We brengen döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Sint-Niklaas telt ruim 80.000 inwoners en is het commerciële en scholencentrum van het Waasland. De Grote Markt en de donderdagmarkt, het Waasland Shopping Center en de Stationsstraat zorgen voor een continue stroom shoppers, terwijl de Vredefeesten met de ballonvaarten in september tienduizenden bezoekers aantrekken. De Turkse gemeenschap is een van de grootste van Oost-Vlaanderen, met eigen kebabzaken, pide-restaurants en bakkers. In Belsele, Nieuwkerken en Sinaai blijven de dorpsfrituren en afhaalpizzeria's de vaste stek van de buurt.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Sint-Niklaas?",
          a: "Sint-Niklaas, Belsele, Nieuwkerken-Waas en Sinaai worden op dinsdag en vrijdag beleverd, samen met Temse, Lokeren en Beveren.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Sint-Niklaas?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Voor het Waasland werken we bij voorkeur met vaste weekbestellingen.",
        },
        {
          q: "Kan ik vanuit Sint-Niklaas afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer een uur rijden en bij afhaling krijgt u 15% korting. Voor de meeste zaken in Sint-Niklaas is levering op dinsdag en vrijdag het praktischt.",
        },
        {
          q: "Kan ik in het Turks bestellen bij Maximus?",
          a: "Zeker. Ons team helpt u in het Turks en het Nederlands via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.",
        },
      ],
    },
    tr: {
      metaTitle: "Sint-Niklaas Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Sint-Niklaas ve Waasland'daki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Salı ve cuma teslimat, Türkçe hizmet. WhatsApp ile kolay sipariş verin.",
      h1: "Sint-Niklaas'ta horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Waasland'ın başkenti Sint-Niklaas, Belçika'nın en büyük meydanına ve her perşembe kurulan kalabalık pazara sahip. Stationsstraat ve Waasland Shopping Center bölgeden alışverişçi çekiyor; istasyon ve Grote Markt çevresinde pitacılar, kebapçılar, pizzacılar ve frituurlar yan yana. Hazewindstraat ve Dalstraat çevresinde büyük bir Türk topluluğu var.</p><p>Aarschot'a E17 üzerinden 70 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve cuma günleri Sint-Niklaas, Belsele, Nieuwkerken-Waas, Temse, Lokeren ve Beveren'e döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>80.000'den fazla nüfuslu Sint-Niklaas, Waasland'ın ticaret ve okul merkezi. Perşembe pazarı, alışveriş merkezi ve Stationsstraat sürekli alışverişçi getiriyor; eylüldeki Vredefeesten balon uçuşları on binlerce ziyaretçi çekiyor. Türk topluluğu Doğu Flandre'nin en büyüklerinden; kebapçılar, pideciler ve fırınlar yaygın. Belsele, Nieuwkerken ve Sinaai'de köy frituurları ve paket pizzacılar mahallenin vazgeçilmezi.</p>",
      faq: [
        {
          q: "Maximus Sint-Niklaas'a hangi günler teslimat yapıyor?",
          a: "Sint-Niklaas, Belsele, Nieuwkerken-Waas ve Sinaai ile Temse, Lokeren ve Beveren'e salı ve cuma teslimat yapıyoruz.",
        },
        {
          q: "Sint-Niklaas'ta minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Waasland için sabit haftalık siparişleri tercih ediyoruz.",
        },
        {
          q: "Sint-Niklaas'tan Aarschot deposuna gelebilir miyim?",
          a: "Evet, yaklaşık bir saat mesafede; depodan alımda %15 indirim. Çoğu işletme için salı ve cuma teslimatı daha pratik.",
        },
        {
          q: "Türkçe sipariş verebilir miyim?",
          a: "Elbette. Ekibimiz WhatsApp (+32 467 07 71 64) ve online sipariş formu üzerinden Türkçe hizmet veriyor.",
        },
      ],
    },
  },
  {
    slug: "gent",
    name: "Gent",
    province: "Oost-Vlaanderen",
    postcodes: ["9000", "9030", "9040", "9050", "9051"],
    distanceKm: 85,
    driveMinutes: 65,
    deliveryDays: ["di", "vr"],
    lat: 51.0543,
    lng: 3.7174,
    nearby: ["Ledeberg", "Gentbrugge", "Sint-Amandsberg", "Mariakerke", "Wondelgem", "Merelbeke", "Destelbergen"],
    nl: {
      metaTitle: "Horeca groothandel Gent: döner, pizza & frituur | Maximus",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Gent, Ledeberg en Gentbrugge. Levering di en vr met eigen koelwagens. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Gent: döner, pizza en frituur leveringen",
      intro:
        "<p>Gent is de op een na grootste studentenstad van het land en een van de meest bruisende horecasteden van Europa. Meer dan 80.000 studenten van de UGent en de hogescholen, een historisch centrum vol toeristen en een uitgesproken multiculturele bevolking maken van Gent een markt waar döner shops, kebabrestaurants, pizzeria's en frituren tot diep in de nacht draaien. De Overpoortstraat, de Korenmarkt, de Sleepstraat in de Turkse wijk en de Dampoort zijn de bekendste eetassen, en Ledeberg, Gentbrugge en Sint-Amandsberg hebben hun eigen buurtzaken.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 85 kilometer via de E40 en levert op dinsdag en vrijdag in Gent-centrum, Ledeberg, Gentbrugge, Sint-Amandsberg, Mariakerke en Wondelgem en in Merelbeke en Destelbergen. We brengen döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Gent telt ruim 265.000 inwoners en heeft een van de oudste en grootste Turkse gemeenschappen van Vlaanderen, geconcentreerd rond de Sleepstraat, de Wondelgemstraat en de Brugse Poort, met tientallen kebabzaken, pide-salons, Turkse bakkers en supermarkten. De Overpoort en de studentenbuurten rond de Blandijn en de Sint-Pietersnieuwstraat zorgen voor een enorme nachtelijke vraag naar pita, pizza en frieten. De Gentse Feesten in juli brengen ruim een miljoen bezoekers naar het centrum, en het station Gent-Sint-Pieters is een van de drukste van het land.</p>",
      faq: [
        {
          q: "In welke delen van Gent levert Maximus?",
          a: "Op dinsdag en vrijdag leveren we in Gent-centrum, Ledeberg, Gentbrugge, Sint-Amandsberg, Mariakerke en Wondelgem, en in Merelbeke en Destelbergen. Andere deelgemeenten bespreken we graag op aanvraag.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Gent?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Voor Gent werken we bij voorkeur met vaste weekbestellingen en afgesproken leveringsvensters, zeker in het autoluwe centrum.",
        },
        {
          q: "Kan ik vanuit Gent afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ruim een uur via de E40 en bij afhaling krijgt u 15% korting. Voor de meeste Gentse zaken is levering op dinsdag en vrijdag het praktischt.",
        },
        {
          q: "Is het döner assortiment geschikt voor Turkse en halal zaken?",
          a: "Ons döner en kebab assortiment is samengesteld voor de Turkse en Mediterrane horeca. Vraag ons per product naar de specificaties en de herkomst, in het Nederlands of het Turks.",
        },
      ],
    },
    tr: {
      metaTitle: "Gent Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Gent, Ledeberg ve Gentbrugge'deki dönerci, kebapçı, pizzacı ve frituurlar için toptancı. Salı ve cuma teslimat, Türkçe hizmet. WhatsApp ile sipariş.",
      h1: "Gent'te horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Belçika'nın ikinci büyük öğrenci şehri Gent, Avrupa'nın en canlı horeca şehirlerinden biri. 80.000'den fazla öğrenci, turist dolu tarihi merkez ve çok kültürlü nüfus sayesinde dönerciler, kebapçılar, pizzacılar ve frituurlar gece geç saatlere kadar çalışıyor. Overpoortstraat, Korenmarkt, Türk mahallesindeki Sleepstraat ve Dampoort en bilinen yemek caddeleri.</p><p>Aarschot'a E40 üzerinden 85 km mesafedeki MAXIMUS Food &amp; Horeca, salı ve cuma günleri Gent merkez, Ledeberg, Gentbrugge, Sint-Amandsberg, Mariakerke, Wondelgem, Merelbeke ve Destelbergen'e döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>265.000'den fazla nüfuslu Gent, Sleepstraat, Wondelgemstraat ve Brugse Poort çevresinde onlarca kebapçı, pideci, Türk fırını ve marketiyle Flaman bölgesinin en eski ve en büyük Türk topluluklarından birine sahip. Overpoort ve öğrenci mahalleleri gece pita, pizza ve patates talebi yaratıyor; temmuzdaki Gentse Feesten bir milyondan fazla ziyaretçi getiriyor.</p>",
      faq: [
        {
          q: "Maximus Gent'in hangi bölgelerine teslimat yapıyor?",
          a: "Salı ve cuma günleri Gent merkez, Ledeberg, Gentbrugge, Sint-Amandsberg, Mariakerke, Wondelgem, Merelbeke ve Destelbergen'e teslimat yapıyoruz. Diğer bölgeler için bize sorun.",
        },
        {
          q: "Gent'te minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Gent için, özellikle araç kısıtlı merkezde, sabit haftalık sipariş ve belirlenmiş teslimat saatleriyle çalışıyoruz.",
        },
        {
          q: "Gent'ten Aarschot deposuna gelebilir miyim?",
          a: "Evet, E40 üzerinden bir saatten biraz fazla; depodan alımda %15 indirim. Çoğu işletme için salı ve cuma teslimatı daha pratik.",
        },
        {
          q: "Döner ürünleri Türk ve helal işletmelere uygun mu?",
          a: "Döner ve kebap çeşitlerimiz Türk ve Akdeniz mutfağı için seçilmiştir. Ürün bazında özellik ve menşe bilgisini Türkçe sorabilirsiniz.",
        },
      ],
    },
  },
  {
    slug: "maasmechelen",
    name: "Maasmechelen",
    province: "Limburg",
    postcodes: ["3630", "3631"],
    distanceKm: 75,
    driveMinutes: 55,
    deliveryDays: ["ma", "do"],
    lat: 50.9645,
    lng: 5.6936,
    nearby: ["Eisden", "Vucht", "Leut", "Opgrimbie", "Lanaken", "Dilsen-Stokkem"],
    nl: {
      metaTitle: "Horeca groothandel Maasmechelen: döner & pizza | Maximus",
      metaDescription:
        "Maximus Food levert döner, pizza-ingrediënten en frituursnacks aan de horeca in Maasmechelen, Eisden en Lanaken. Levering op ma en do. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Maasmechelen: döner, pizza en frituur leveringen",
      intro:
        "<p>Maasmechelen ligt aan de Maas op de grens met Nederland en is bekend van Maasmechelen Village, het outletcentrum dat jaarlijks miljoenen shoppers uit België, Nederland en Duitsland aantrekt. De voormalige mijncité van Eisden, met zijn grote Turkse en Italiaanse gemeenschap, is uitgegroeid tot een levendig handelscentrum met kebabrestaurants, pide-salons, pizzeria's en Turkse bakkers rond de Rijksweg en de Pauwengraaf. Daarnaast zorgen het Nationaal Park Hoge Kempen en de fietsroutes langs de Maas voor recreatief publiek in Leut, Vucht en Opgrimbie.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 75 kilometer via de E314 en levert op maandag en donderdag in Maasmechelen, Eisden, Vucht, Leut en Opgrimbie en in de buurgemeenten Lanaken en Dilsen-Stokkem. Wij spreken Turks en Nederlands en brengen döner en kebap, Turks brood en pide, kaas, Pauwels sauzen, Lutosa frieten, Mekkafood snacks, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging.</p>",
      localProfile:
        "<p>Maasmechelen telt ongeveer 39.000 inwoners en kent een van de meest diverse bevolkingen van Limburg, een erfenis van de steenkoolmijn van Eisden. De Turkse gemeenschap is er groot en ondernemend, met een dicht netwerk van kebabzaken, Turkse restaurants en bakkers in Eisden-Tuinwijk en langs de Rijksweg. Maasmechelen Village en het aangrenzende winkelgebied brengen elke dag shoppers die snel een pita, pizza of frieten willen, en de zomerse drukte langs de Maas en in het nationaal park geeft de frituren in de kleinere kernen een seizoenspiek.</p>",
      faq: [
        {
          q: "Op welke dagen levert Maximus in Maasmechelen?",
          a: "Maasmechelen, Eisden, Vucht, Leut en Opgrimbie worden op maandag en donderdag beleverd, samen met Lanaken en Dilsen-Stokkem op onze Limburgroute.",
        },
        {
          q: "Is er een minimum bestelbedrag voor levering in Maasmechelen?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Omdat Maasmechelen op het einde van onze Limburgroute ligt, werken we bij voorkeur met vaste weekbestellingen.",
        },
        {
          q: "Kan ik vanuit Maasmechelen afhalen in Aarschot?",
          a: "Dat kan, ons magazijn ligt op ongeveer een uur via de E314 en bij afhaling krijgt u 15% korting. Voor de meeste zaken in Maasmechelen is levering op maandag en donderdag het handigst.",
        },
        {
          q: "Kan ik in het Turks bestellen bij Maximus?",
          a: "Zeker. Ons team helpt u in het Turks en het Nederlands via WhatsApp op +32 467 07 71 64 of via het online bestelformulier.",
        },
      ],
    },
    tr: {
      metaTitle: "Maasmechelen Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Maasmechelen, Eisden ve Lanaken'deki dönerci, kebapçı ve pizzacılar için toptancı. Pazartesi ve perşembe teslimat, Türkçe hizmet. WhatsApp ile sipariş.",
      h1: "Maasmechelen'de horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Hollanda sınırında, Maas kıyısındaki Maasmechelen, her yıl milyonlarca alışverişçi çeken Maasmechelen Village outlet merkeziyle tanınıyor. Eski maden mahallesi Eisden, büyük Türk ve İtalyan topluluğuyla Rijksweg ve Pauwengraaf çevresinde kebapçı, pideci, pizzacı ve Türk fırınlarıyla dolu canlı bir ticaret merkezi.</p><p>Aarschot'a E314 üzerinden 75 km mesafedeki MAXIMUS Food &amp; Horeca, pazartesi ve perşembe günleri Maasmechelen, Eisden, Vucht, Leut, Lanaken ve Dilsen-Stokkem'e döner, pide, peynir, Pauwels sos, Lutosa patates, Mekkafood ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 39.000 nüfuslu Maasmechelen, Eisden madeninin mirası olarak Limburg'un en çok kültürlü nüfuslarından birine sahip. Girişimci Türk topluluğu Eisden-Tuinwijk ve Rijksweg boyunca yoğun bir kebapçı, Türk restoranı ve fırın ağı kurmuş. Maasmechelen Village her gün hızlı yemek arayan alışverişçi getiriyor.</p>",
      faq: [
        {
          q: "Maximus Maasmechelen'e hangi günler teslimat yapıyor?",
          a: "Maasmechelen, Eisden, Vucht, Leut ve Opgrimbie ile Lanaken ve Dilsen-Stokkem'e pazartesi ve perşembe teslimat yapıyoruz.",
        },
        {
          q: "Maasmechelen'de minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Maasmechelen Limburg rotamızın sonunda olduğu için sabit haftalık siparişleri tercih ediyoruz.",
        },
        {
          q: "Maasmechelen'den Aarschot deposuna gelebilir miyim?",
          a: "Evet, E314 üzerinden yaklaşık bir saat; depodan alımda %15 indirim. Çoğu işletme için pazartesi ve perşembe teslimatı daha pratik.",
        },
        {
          q: "Türkçe sipariş verebilir miyim?",
          a: "Elbette. Ekibimiz WhatsApp (+32 467 07 71 64) ve online sipariş formu üzerinden Türkçe hizmet veriyor.",
        },
      ],
    },
  },
  {
    slug: "kortrijk",
    name: "Kortrijk",
    province: "West-Vlaanderen",
    postcodes: ["8500", "8501", "8510", "8511"],
    distanceKm: 125,
    driveMinutes: 85,
    deliveryDays: ["do"],
    lat: 50.828,
    lng: 3.2649,
    nearby: ["Heule", "Bissegem", "Marke", "Kooigem", "Harelbeke", "Kuurne", "Zwevegem"],
    nl: {
      metaTitle: "Horeca groothandel Kortrijk: döner & pizza | Maximus Food",
      metaDescription:
        "Groothandel voor döner shops, pizzeria's en frituren in Kortrijk, Harelbeke en Kuurne. Wekelijkse levering op donderdag. Bestel via WhatsApp.",
      h1: "Horeca groothandel in Kortrijk: döner, pizza en frituur leveringen",
      intro:
        "<p>Kortrijk is de centrumstad van Zuid-West-Vlaanderen en een stad die de voorbije jaren sterk vernieuwde, met de heraangelegde Leieboorden, het winkelcentrum K in Kortrijk en een bloeiende studentencampus van de KU Leuven en Howest. De Lange Steenstraat, de Grote Markt en de omgeving van het station vormen het horecahart, met pitazaken, kebabrestaurants, pizzeria's en frituren die shoppers, studenten en pendelaars bedienen. De nabijheid van Frankrijk en de industriële regio rond Harelbeke, Kuurne en Zwevegem geeft de stad een groot verzorgingsgebied.</p><p>MAXIMUS Food &amp; Horeca in Aarschot ligt op 125 kilometer via de E40 en de E17 en levert elke donderdag in Kortrijk, Heule, Bissegem, Marke en Kooigem en in de buurgemeenten Harelbeke, Kuurne en Zwevegem. We brengen döner en kebab, pizzabodems en mozzarella, Lutosa frieten, Van Reusel en Mekkafood snacks, Pauwels sauzen, conserven, drank en verpakkingen met onze eigen koelwagens.</p><p>Bestel via WhatsApp op +32 467 07 71 64 of via het online bestelformulier en ontvang dezelfde dag een bevestiging in het Nederlands of het Turks.</p>",
      localProfile:
        "<p>Kortrijk telt ongeveer 78.000 inwoners en is het commerciële en onderwijscentrum van Zuid-West-Vlaanderen, met meer dan 15.000 studenten die de horeca rond de Grote Markt, de Veemarkt en het Buda-eiland doen leven. De stad heeft een Turkse en Marokkaanse gemeenschap met kebabzaken rond de Doorniksewijk en het station. K in Kortrijk en de Lange Steenstraat brengen elke dag shoppers, en de Sinksenfeesten in het pinksterweekend trekken honderdduizenden bezoekers. Heule, Bissegem en Marke hebben hun eigen buurtfrituren en afhaalpizzeria's.</p>",
      faq: [
        {
          q: "Wanneer levert Maximus in Kortrijk?",
          a: "Kortrijk, Heule, Bissegem, Marke en Kooigem worden elke donderdag beleverd, samen met Harelbeke, Kuurne en Zwevegem op onze West-Vlaamse route.",
        },
        {
          q: "Geldt er een minimum bestelbedrag voor levering in Kortrijk?",
          a: "Neem contact op voor de leveringsvoorwaarden in uw regio. Omdat we Kortrijk één keer per week beleveren, werken we bij voorkeur met een vaste weekbestelling die uw hele week dekt.",
        },
        {
          q: "Kan ik vanuit Kortrijk afhalen in Aarschot?",
          a: "Dat kan, maar ons magazijn ligt op bijna anderhalf uur rijden. Bij afhaling krijgt u 15% korting; voor de meeste zaken in Kortrijk is de donderdaglevering het praktischt.",
        },
        {
          q: "Hoe bestel ik bij Maximus vanuit Kortrijk?",
          a: "Via WhatsApp op +32 467 07 71 64 of via het online bestelformulier. Bestel tijdig zodat we uw levering op de donderdagroute kunnen inplannen; u krijgt dezelfde dag een bevestiging.",
        },
      ],
    },
    tr: {
      metaTitle: "Kortrijk Horeca Toptancısı | Maximus Food",
      metaDescription:
        "Kortrijk, Harelbeke ve Kuurne'deki dönerci, pizzacı ve frituurlar için toptancı. Her perşembe soğutmalı haftalık teslimat. WhatsApp ile sipariş.",
      h1: "Kortrijk'te horeca toptancısı: döner, pizza ve frituur teslimatı",
      intro:
        "<p>Güneybatı Flandre'nin merkez şehri Kortrijk, yenilenen Leie kıyıları, K in Kortrijk alışveriş merkezi ve KU Leuven ile Howest kampüsleriyle son yıllarda büyük dönüşüm geçirdi. Lange Steenstraat, Grote Markt ve istasyon çevresinde pitacılar, kebapçılar, pizzacılar ve frituurlar alışverişçi, öğrenci ve yolculara hizmet veriyor.</p><p>Aarschot'a E40 ve E17 üzerinden 125 km mesafedeki MAXIMUS Food &amp; Horeca, her perşembe Kortrijk, Heule, Bissegem, Marke, Harelbeke, Kuurne ve Zwevegem'e döner, pizza hamuru, mozzarella, Lutosa patates, atıştırmalık, Pauwels sos ve ambalaj teslim ediyor. Türkçe sipariş için WhatsApp +32 467 07 71 64.</p>",
      localProfile:
        "<p>Yaklaşık 78.000 nüfuslu Kortrijk, 15.000'den fazla öğrencisiyle Güneybatı Flandre'nin ticaret ve eğitim merkezi. Doorniksewijk ve istasyon çevresinde kebapçılarıyla bir Türk ve Fas topluluğu var. K in Kortrijk her gün alışverişçi, Sinksenfeesten ise yüz binlerce ziyaretçi getiriyor. Heule, Bissegem ve Marke'de mahalle frituurları ve paket pizzacılar var.</p>",
      faq: [
        {
          q: "Maximus Kortrijk'e hangi günler teslimat yapıyor?",
          a: "Kortrijk, Heule, Bissegem, Marke ve Kooigem ile Harelbeke, Kuurne ve Zwevegem'e her perşembe teslimat yapıyoruz.",
        },
        {
          q: "Kortrijk'te minimum sipariş var mı?",
          a: "Bölgenizdeki teslimat koşulları için bizimle iletişime geçin. Kortrijk'e haftada bir gittiğimiz için tüm haftayı kapsayan sabit bir sipariş öneriyoruz.",
        },
        {
          q: "Kortrijk'ten Aarschot deposuna gelebilir miyim?",
          a: "Evet, ancak depomuz yaklaşık bir buçuk saat mesafede. Depodan alımda %15 indirim; çoğu işletme için perşembe teslimatı daha pratik.",
        },
        {
          q: "Kortrijk'ten nasıl sipariş verebilirim?",
          a: "WhatsApp (+32 467 07 71 64) veya online sipariş formu ile. Perşembe rotasına planlayabilmemiz için siparişinizi zamanında iletin; aynı gün onay alırsınız.",
        },
      ],
    },
  },
];

export function getRegion(slug: string) {
  return regions.find((r) => r.slug === slug);
}
