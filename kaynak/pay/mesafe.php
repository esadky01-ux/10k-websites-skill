<?php
// ============================================================
// EUROPA TAXI — sunucu tarafi mesafe dogrulamasi (dahili tablo)
//
// NEDEN: km tarayicidan gelir. Google sunucu anahtari yoksa (veya Google
// ulasilamazsa) istemcinin km'sine KOR guvenmek, "km=1" ile 500 km'lik bir
// yolculugu 12 EUR'ya rezerve etmeye izin verir. Bu modul, tarayicidaki
// dahili motorun (template/app.js: normalize, yerBul, dahiliMesafe) sunucu
// tarafindaki birebir portudur; veri mesafe.json'dan gelir (build.py uretir).
//
// KARAR POLITIKASI (Node/Vercel katmani ile AYNI; kaynak/testler/
// paylasilan-vektorler.json bunu iki uygulama icin kilitler):
//   1) km_istemci 1..800 disi                       -> RET
//   2) Google sonucu var                            -> fark > %tol ise Google, degilse istemci
//   3) Google yok, dahili iki adresi de tanidi      -> istemci < dahili*(1-tol) ise dahili, degilse istemci
//   4) Google yok, dahili de yok (dogrulanamaz)     -> RET (kullanici WhatsApp'a yonlendirilir)
//   5) sonuc km 1..800 disi                         -> RET
// ============================================================
declare(strict_types=1);

const MESAFE_MIN_KM = 1;
const MESAFE_MAX_KM = 800;

/** Metni eslesme icin normallestirir (test_adim1.py ve tarayici JS'i ile ayni kurallar). */
function mesafe_normalize(string $s): string
{
    $s = mb_strtolower($s, 'UTF-8');
    $s = strtr($s, ['ı' => 'i', 'ß' => 'ss', 'œ' => 'oe', 'æ' => 'ae']);
    if (class_exists('Normalizer')) {
        // intl varsa: NFD ayristirma, sonra birlestirici isaretleri sil
        $d = Normalizer::normalize($s, Normalizer::FORM_D);
        if ($d !== false) {
            $s = $d;
        }
    } else {
        // intl yoksa: Latin-1 Ek + Latin Genisletilmis-A icin elle tablo
        static $tablo = [
            'à' => 'a', 'á' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'å' => 'a', 'ā' => 'a', 'ă' => 'a', 'ą' => 'a',
            'ç' => 'c', 'ć' => 'c', 'ĉ' => 'c', 'ċ' => 'c', 'č' => 'c',
            'ď' => 'd', 'đ' => 'd',
            'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e', 'ē' => 'e', 'ĕ' => 'e', 'ė' => 'e', 'ę' => 'e', 'ě' => 'e',
            'ĝ' => 'g', 'ğ' => 'g', 'ġ' => 'g', 'ģ' => 'g',
            'ĥ' => 'h', 'ħ' => 'h',
            'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i', 'ĩ' => 'i', 'ī' => 'i', 'ĭ' => 'i', 'į' => 'i',
            'ĵ' => 'j', 'ķ' => 'k',
            'ĺ' => 'l', 'ļ' => 'l', 'ľ' => 'l', 'ł' => 'l',
            'ñ' => 'n', 'ń' => 'n', 'ņ' => 'n', 'ň' => 'n',
            'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o', 'ø' => 'o', 'ō' => 'o', 'ŏ' => 'o', 'ő' => 'o',
            'ŕ' => 'r', 'ŗ' => 'r', 'ř' => 'r',
            'ś' => 's', 'ŝ' => 's', 'ş' => 's', 'š' => 's',
            'ţ' => 't', 'ť' => 't', 'ŧ' => 't',
            'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u', 'ũ' => 'u', 'ū' => 'u', 'ŭ' => 'u', 'ů' => 'u', 'ű' => 'u', 'ų' => 'u',
            'ŵ' => 'w', 'ý' => 'y', 'ÿ' => 'y', 'ŷ' => 'y',
            'ź' => 'z', 'ż' => 'z', 'ž' => 'z',
        ];
        $s = strtr($s, $tablo);
    }
    // birlestirici isaretleri (NFD kalintisi, "i̇" gibi) sil
    $s = (string) preg_replace('/[\x{0300}-\x{036f}]/u', '', $s);
    $s = (string) preg_replace('/[^a-z0-9]+/', ' ', $s);
    return trim((string) preg_replace('/\s+/', ' ', $s));
}

/**
 * mesafe.json'u yukler ve eslesme dizinini kurar. Bicim (build.py uretir):
 * {"sabitler":{...},"yerler":{anahtar:{"l":[lat,lng],"t":[normalize takma adlar]}},"kesin":{"a|b":km}}
 */
function mesafe_veri(): array
{
    static $v = null;
    if ($v === null) {
        $yol = __DIR__ . '/mesafe.json';
        $j = is_file($yol) ? json_decode((string) file_get_contents($yol), true) : null;
        $v = ['yerler' => [], 'kesin' => [], 'eslesme' => [], 'katsayi' => 1.17];
        if (is_array($j)) {
            $v['yerler'] = $j['yerler'] ?? [];
            $v['kesin'] = $j['kesin'] ?? [];
            $v['katsayi'] = (float) ($j['sabitler']['yol_katsayisi'] ?? 1.17);
            foreach ($v['yerler'] as $anahtar => $yer) {
                foreach ($yer['t'] as $takma) {
                    $v['eslesme'][$takma] = $anahtar;
                }
            }
        }
    }
    return $v;
}

/** Serbest metin adresten yer anahtari bulur; en uzun eslesme kazanir. Bulamazsa null. */
function mesafe_yer_bul(string $girdi): ?string
{
    $n = mesafe_normalize($girdi);
    if ($n === '') {
        return null;
    }
    $eslesme = mesafe_veri()['eslesme'];
    if (isset($eslesme[$n])) {
        return $eslesme[$n];
    }
    $hedef = ' ' . $n . ' ';
    $enIyi = null;
    $enUzun = 0;
    foreach ($eslesme as $takma => $anahtar) {
        $takma = (string) $takma;
        if (strlen($takma) > $enUzun && str_contains($hedef, ' ' . $takma . ' ')) {
            $enIyi = $anahtar;
            $enUzun = strlen($takma);
        }
    }
    return $enIyi;
}

/** Iki koordinat arasi kus ucusu km. */
function mesafe_haversine(array $a, array $b): float
{
    $r = 6371.0;
    $d2r = M_PI / 180;
    $dLat = ($b[0] - $a[0]) * $d2r;
    $dLng = ($b[1] - $a[1]) * $d2r;
    $h = sin($dLat / 2) ** 2 + cos($a[0] * $d2r) * cos($b[0] * $d2r) * sin($dLng / 2) ** 2;
    return 2 * $r * asin(sqrt($h));
}

/** Dahili tablo mesafesi: once KESIN, yoksa haversine x katsayi. Taninmazsa null. */
function mesafe_dahili(string $alis, string $varis): ?int
{
    $ka = mesafe_yer_bul($alis);
    $kb = mesafe_yer_bul($varis);
    if ($ka === null || $kb === null || $ka === $kb) {
        return null;
    }
    $v = mesafe_veri();
    $kesin = $v['kesin'][$ka . '|' . $kb] ?? $v['kesin'][$kb . '|' . $ka] ?? null;
    if ($kesin !== null) {
        return (int) $kesin;
    }
    return (int) round(mesafe_haversine($v['yerler'][$ka]['l'], $v['yerler'][$kb]['l']) * $v['katsayi']);
}

/**
 * Nihai km kararini verir. Doner: ['km' => int|null, 'kaynak' => 'google'|'dahili'|'istemci'|null,
 * 'sebep' => null|'aralik'|'dogrulanamadi'].
 * Tamsayi aritmetigi kullanilir (float sinir hatasi olmasin).
 */
function mesafe_karar(int $istemci, ?int $google, ?int $dahili, int $tolYuzde): array
{
    if ($istemci < MESAFE_MIN_KM || $istemci > MESAFE_MAX_KM) {
        return ['km' => null, 'kaynak' => null, 'sebep' => 'aralik'];
    }
    if ($google !== null && $google > 0) {
        // fark > %tol ise Google'in degeri (iki yonlu fark, Google referans)
        $km = (abs($google - $istemci) * 100 > $tolYuzde * $google) ? $google : $istemci;
        $kaynak = $km === $google && $km !== $istemci ? 'google' : 'istemci';
    } elseif ($dahili !== null && $dahili > 0) {
        // yalniz ALT sinir: istemci daha yuksekse musteri lehine kabul
        $km = ($istemci * 100 < $dahili * (100 - $tolYuzde)) ? $dahili : $istemci;
        $kaynak = $km === $dahili && $km !== $istemci ? 'dahili' : 'istemci';
    } else {
        return ['km' => null, 'kaynak' => null, 'sebep' => 'dogrulanamadi'];
    }
    if ($km < MESAFE_MIN_KM || $km > MESAFE_MAX_KM) {
        return ['km' => null, 'kaynak' => null, 'sebep' => 'aralik'];
    }
    return ['km' => $km, 'kaynak' => $kaynak, 'sebep' => null];
}
