<?php
// ============================================================
// EUROPA TAXI — girdi dogrulama / temizleme (SAF fonksiyonlar; Node katmaniyla BIREBIR).
//
// Kurallar kaynak/vercel/api/_lib/siparis.js + create.js ile ayni; kaynak/testler/paylasilan-vektorler.json
// ("dogrulama" bolumu) iki uygulama icin kilitler. Ozet:
//  * metin: kontrol karakterleri bosluga, gorunmez bicim karakterleri (sifir genislik, bidi, BOM) silinir,
//    NFC, bosluklar tekillesir + kirpilir; uzunluklar KOD NOKTASI sayisi (mb_strlen)
//  * adres 1-120 (asarsa RET; '|' yasak: Google Distance Matrix'e coklu origin/destination enjekte edilemesin),
//    ad 2-80, e-posta ASCII <=100 (yerel kisim <=64, TLD >=2 harf, IP-literal/tirnak yok),
//    telefon >=8 rakam ve <=25 karakter, km tam sayi 1..800 (bas sifir/ondalik/us yok)
//  * tarih gecerli takvim gunu ve Europe/Brussels'e gore bugun..+365 gun; saat HH:MM; donus >= gidis ve <= +365
//  * yolcu 1-7 / buyuk 0-6 / kucuk 0-4 sinirlanir (hata vermez); arac eco|wagon|vip (aksi eco); dil fr|nl|en|tr (aksi fr)
//  * DIZI ve TEKRAR EDEN alanlar (alis[]=x, alis=a&alis=b, ad[k]=..) reddedilir
//  * regex'lerde `$` yerine `\z` (sondaki satir sonu kabul edilmez)
// Ham istek govdesi kendimiz cozulur (php://input): PHP'nin $_POST'u tekrar eden alanlarda sessizce SON degeri
// alir ve alan[]=x'i diziye cevirir; ikisini de gorebilmek icin URLSearchParams ile ayni bicimde ayristiriyoruz.
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';

/** Alan -> hata mesaji anahtari (strings.json). Node ALAN_MESAJI + PHP'ye ozgu iptal/idem. */
const GIRDI_ALAN_MESAJI = [
    'alis' => 'val_route', 'varis' => 'val_route',
    'tarih' => 'val_date', 'saat' => 'val_date', 'donus_tarih' => 'val_date', 'donus_saat' => 'val_date',
    'ad' => 'val_name', 'eposta' => 'val_email', 'telefon' => 'val_phone', 'km' => 'err_km',
    'dil' => 'err_pay', 'kaynak' => 'err_pay', 'yolcu' => 'err_pay', 'buyuk' => 'err_pay',
    'kucuk' => 'err_pay', 'arac' => 'err_pay', 'web' => 'err_pay',
    'iptal' => 'val_cancel', 'idem' => 'err_pay',
];
const GIRDI_ILERI_GUN = 365;
const GIRDI_EN_FAZLA_ALAN = 200;

// ---------------------------------------------------------------- form ayristirma

/** UTF-8 gecersiz baytlari U+FFFD ile degistirir (JS URLSearchParams ile ayni). */
function girdi_utf8_temizle(string $s): string
{
    if (mb_check_encoding($s, 'UTF-8')) {
        return $s;
    }
    $eski = mb_substitute_character();
    mb_substitute_character(0xFFFD);
    $t = mb_scrub($s, 'UTF-8');
    mb_substitute_character($eski);
    return $t;
}

/**
 * application/x-www-form-urlencoded govdesini ayristirir. Doner: ad => [deger, ...] (sira korunur).
 * '+' bosluk, gecersiz yuzde dizileri oldugu gibi kalir, bos parcalar atlanir, en fazla 200 parca.
 * Alan adlari oldugu gibi kalir (`alis[]` = 'alis[]'; PHP'nin koseli parantez sihri YOK).
 */
function girdi_form_coz(string $ham): array
{
    $alanlar = [];
    $sayac = 0;
    foreach (explode('&', $ham) as $parca) {
        if ($parca === '') {
            continue;
        }
        if (++$sayac > GIRDI_EN_FAZLA_ALAN) {
            break;
        }
        $es = strpos($parca, '=');
        $ad = $es === false ? $parca : substr($parca, 0, $es);
        $deger = $es === false ? '' : substr($parca, $es + 1);
        $ad = girdi_utf8_temizle(urldecode($ad));
        $alanlar[$ad][] = girdi_utf8_temizle(urldecode($deger));
    }
    return $alanlar;
}

/** Bir alanin ilk degeri (yoksa null). */
function girdi_ilk(array $alanlar, string $ad): ?string
{
    $l = $alanlar[$ad] ?? null;
    return is_array($l) && $l !== [] ? (string) $l[0] : null;
}

/**
 * Bilinen bir alan TEKRAR ediyorsa (alis=a&alis=b) ya da dizi bicimindeyse (alis[]=x, alis[k]=x) alanin adini
 * doner; yoksa null. $alanlar: girdi_form_coz() ciktisi.
 */
function girdi_yapisal_hata(array $alanlar): ?string
{
    foreach ($alanlar as $anahtar => $degerler) {
        $anahtar = (string) $anahtar;
        $govdeAdi = preg_replace('/\[.*\z/s', '', $anahtar) ?? $anahtar;
        if (!array_key_exists($govdeAdi, GIRDI_ALAN_MESAJI)) {
            continue;
        }
        if ($anahtar !== $govdeAdi || count($degerler) > 1) {
            return $govdeAdi;
        }
    }
    return null;
}

// ---------------------------------------------------------------- metin temizligi

/** intl Normalizer kullanilabilir mi? (disable_classes ile sinif "kapatilmissa" metotlar da yoktur) */
function girdi_intl_var(): bool
{
    return class_exists('Normalizer') && method_exists('Normalizer', 'normalize');
}

/** Yedek unicode tablolari (intl yoksa): ['ascii' => [...], 'nfc' => [...]]. */
function unicode_tablo(): array
{
    static $t = null;
    if ($t === null) {
        $yol = __DIR__ . '/unicode_tablo.php';
        $t = is_file($yol) ? require $yol : ['ascii' => [], 'nfc' => []];
    }
    return $t;
}

/** NFC. intl varsa Normalizer; yoksa Latin/Yunan/Kiril icin ikili birlesim tablosuyla YAKLASIK (kanonik siralama yok). */
function girdi_nfc(string $s): string
{
    if (girdi_intl_var()) {
        $r = Normalizer::normalize($s, Normalizer::FORM_C);
        return $r === false ? $s : $r;
    }
    $tablo = unicode_tablo()['nfc'];
    for ($i = 0; $i < 4; $i++) {   // Vietnamca gibi cift isaretler icin sabit noktaya kadar
        $onceki = $s;
        $s = strtr($s, $tablo);
        if ($s === $onceki) {
            break;
        }
    }
    return $s;
}

/** JS \s + trim() ile ayni bosluk kumesi. */
const GIRDI_BOSLUK = '[\t\n\x0B\f\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]';

/** JS String.prototype.trim ile ayni kirpma. */
function girdi_kirp(string $s): string
{
    return preg_replace('/^' . GIRDI_BOSLUK . '+|' . GIRDI_BOSLUK . '+\z/u', '', $s) ?? '';
}

/**
 * Kontrol karakterlerini (C0, DEL, C1, U+2028/9, U+FFFD) bosluga cevirir, gorunmez bicim karakterlerini
 * (sifir genislik, bidi yonlendirme, BOM) siler, NFC, bosluklari tekillestirir, kirpar.
 * Sira Node temizMetin ile ayni: NFC -> gorunmezleri sil -> kontrol->bosluk -> tekillestir -> kirp.
 */
function girdi_temiz_metin(?string $s): string
{
    $s = girdi_utf8_temizle((string) $s);
    $s = girdi_nfc($s);
    $s = preg_replace('/[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{2069}\x{FEFF}]/u', '', $s) ?? '';
    $s = preg_replace('/[\x{0}-\x{1F}\x{7F}-\x{9F}\x{2028}\x{2029}\x{FFFD}]/u', ' ', $s) ?? '';
    $s = preg_replace('/' . GIRDI_BOSLUK . '+/u', ' ', $s) ?? '';
    return girdi_kirp($s);
}

/** Kod noktasi sayisi. */
function girdi_uzunluk(string $s): int
{
    return mb_strlen($s, 'UTF-8');
}

/**
 * E-posta: <=100, ASCII, gorunmez/kontrol karakteri, bosluk, '<>' , ',' YOK; yerel kisim <=64 ve ne nokta ile
 * baslar/biter ne de ardisik nokta icerir; TLD >=2 harf (ya da xn--); IP-literal/tirnakli yerel kisim yok.
 */
function girdi_eposta_gecerli(string $e): bool
{
    if ($e === '' || strlen($e) > 100) {
        return false;
    }
    $desen = "/^[A-Za-z0-9.!#\$%&'*+\\/=?^_`{|}~-]{1,64}@"
        . '(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+'
        . '(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{2,59})\z/';
    if (preg_match($desen, $e) !== 1) {
        return false;
    }
    $yerel = substr($e, 0, (int) strrpos($e, '@'));
    return !(str_starts_with($yerel, '.') || str_ends_with($yerel, '.') || str_contains($yerel, '..'));
}

/** Tam sayi ayikla: ^[+-]?(0|[1-9][0-9]{0,8})$ (kirpilmis); degilse null. */
function girdi_tam_sayi(?string $deger): ?int
{
    $s = girdi_kirp((string) $deger);
    if (preg_match('/^[+-]?(?:0|[1-9][0-9]{0,8})\z/', $s) !== 1) {
        return null;
    }
    return (int) $s;
}

function girdi_sinirla(?string $deger, int $min, int $maks, int $varsayilan): int
{
    $n = girdi_tam_sayi($deger);
    return $n === null ? $varsayilan : max($min, min($maks, $n));
}

// ---------------------------------------------------------------- zaman (Europe/Brussels)

/** Brussels'e gore bugun 'YYYY-MM-DD'. $simdi: test icin sabit zaman. */
function girdi_bugun(?\DateTimeInterface $simdi = null): string
{
    $tz = new DateTimeZone('Europe/Brussels');
    $an = $simdi !== null ? DateTimeImmutable::createFromInterface($simdi) : new DateTimeImmutable('now');
    return $an->setTimezone($tz)->format('Y-m-d');
}

/** 'YYYY-MM-DD' gecerli takvim gunu ise gun numarasi (1970'ten beri), degilse null. */
function girdi_gun_no(string $iso): ?int
{
    if (preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})\z/', $iso, $m) !== 1) {
        return null;
    }
    [$y, $mo, $d] = [(int) $m[1], (int) $m[2], (int) $m[3]];
    if ($y < 100 || !checkdate($mo, $d, $y)) {   // JS Date.UTC 0-99 yillarini 1900'e kaydirir -> gecersiz sayilir
        return null;
    }
    return intdiv(gmmktime(0, 0, 0, $mo, $d, $y), 86400);
}

function girdi_saat_gecerli(string $s): bool
{
    return preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]\z/', $s) === 1;
}

// ---------------------------------------------------------------- dogrulama

/**
 * Ham alanlardan (alan => TEK metin | null) dogrulanmis siparis girdisi cikarir.
 * Sira Node dogrula ile ayni: guzergah, tarih/saat, donus, ad, e-posta, telefon, km.
 * Doner: ['ok' => true, 'deger' => [...]] | ['ok' => false, 'alan' => ..., 'anahtar' => ...]
 * deger anahtarlari: dil, alis, varis, km_istemci, tarih, saat, donus_tarih, donus_saat, yolcu, buyuk, kucuk, arac,
 * ad, eposta, telefon. $simdi: test icin sabit zaman (varsayilan: su an).
 */
function girdi_dogrula(array $ham, ?\DateTimeInterface $simdi = null): array
{
    $al = static fn (string $k): string => isset($ham[$k]) && is_string($ham[$k]) ? $ham[$k] : '';
    $hata = static fn (string $alan): array => ['ok' => false, 'alan' => $alan, 'anahtar' => GIRDI_ALAN_MESAJI[$alan]];

    // ---- guzergah: 1..120, '|' yok
    $alis = girdi_temiz_metin($al('alis'));
    $varis = girdi_temiz_metin($al('varis'));
    if ($alis === '') {
        return $hata('alis');
    }
    if ($varis === '') {
        return $hata('varis');
    }
    if (girdi_uzunluk($alis) > 120 || str_contains($alis, '|')) {
        return $hata('alis');
    }
    if (girdi_uzunluk($varis) > 120 || str_contains($varis, '|')) {
        return $hata('varis');
    }

    // ---- tarih / saat
    $bugunNo = girdi_gun_no(girdi_bugun($simdi));
    $tarih = girdi_kirp($al('tarih'));
    $saat = girdi_kirp($al('saat'));
    $tNo = girdi_gun_no($tarih);
    if ($tNo === null || $bugunNo === null) {
        return $hata('tarih');
    }
    if ($tNo < $bugunNo || $tNo > $bugunNo + GIRDI_ILERI_GUN) {
        return $hata('tarih');
    }
    if (!girdi_saat_gecerli($saat)) {
        return $hata('saat');
    }

    $donusTarih = girdi_kirp($al('donus_tarih'));
    $donusSaat = girdi_kirp($al('donus_saat'));
    if ($donusTarih === '') {
        $donusSaat = '';   // donus tarihi yoksa donus saati yok sayilir
    } else {
        $dNo = girdi_gun_no($donusTarih);
        if ($dNo === null || $dNo < $tNo || $dNo > $bugunNo + GIRDI_ILERI_GUN) {
            return $hata('donus_tarih');
        }
        if ($donusSaat !== '') {
            if (!girdi_saat_gecerli($donusSaat)) {
                return $hata('donus_saat');
            }
            if ($dNo === $tNo && strcmp($donusSaat, $saat) < 0) {
                return $hata('donus_saat');   // ayni gun, donus saati gidisten once
            }
        }
    }

    // ---- iletisim
    $ad = girdi_temiz_metin($al('ad'));
    if (girdi_uzunluk($ad) < 2 || girdi_uzunluk($ad) > 80) {
        return $hata('ad');
    }
    $eposta = girdi_kirp($al('eposta'));
    if (!girdi_eposta_gecerli($eposta)) {
        return $hata('eposta');
    }
    $telefon = girdi_temiz_metin($al('telefon'));
    $rakam = preg_match_all('/[0-9]/', $telefon);
    if ($rakam < 8 || girdi_uzunluk($telefon) > 25) {
        return $hata('telefon');
    }

    // ---- km (istemcinin beyani; nihai karar mesafe_karar'da)
    $km = girdi_tam_sayi($al('km'));
    if ($km === null || $km < 1 || $km > 800) {
        return $hata('km');
    }

    // ---- yan alanlar (sinirlanir, hata verilmez)
    $arac = $al('arac');
    return [
        'ok' => true,
        'deger' => [
            'dil' => dil_sec($ham['dil'] ?? null),
            'alis' => $alis,
            'varis' => $varis,
            'km_istemci' => $km,
            'tarih' => $tarih,
            'saat' => $saat,
            'donus_tarih' => $donusTarih,
            'donus_saat' => $donusSaat,
            'yolcu' => girdi_sinirla($al('yolcu'), 1, 7, 1),
            'buyuk' => girdi_sinirla($al('buyuk'), 0, 6, 0),
            'kucuk' => girdi_sinirla($al('kucuk'), 0, 4, 0),
            'arac' => in_array($arac, ['eco', 'wagon', 'vip'], true) ? $arac : 'eco',
            'ad' => $ad,
            'eposta' => $eposta,
            'telefon' => $telefon,
        ],
    ];
}

/** Istemci uretimi idempotency belirteci: 16-64 [A-Za-z0-9-]; degilse ''. */
function girdi_idem(?string $deger): string
{
    return $deger !== null && preg_match('/^[A-Za-z0-9-]{16,64}\z/', $deger) === 1 ? $deger : '';
}
