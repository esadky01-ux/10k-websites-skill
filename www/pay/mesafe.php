<?php
// ============================================================
// EUROPA TAXI — sunucu tarafi mesafe dogrulamasi (dahili tablo + Google Distance Matrix + karar politikasi)
//
// NEDEN: km tarayicidan gelir. Google sunucu anahtari yoksa (veya Google ulasilamazsa) istemcinin km'sine KOR
// guvenmek, "km=1" ile 500 km'lik bir yolculugu 12 EUR'ya rezerve etmeye izin verir (FAIL-OPEN). Bu modul,
// tarayicidaki dahili motorun (template/app.js: normalize, yerBul, dahiliMesafe) sunucu tarafindaki BIREBIR
// portudur; veri mesafe.json'dan gelir (build.py -> pay_veri.py uretir).
//
// KARAR POLITIKASI (Node/Vercel katmani ile AYNI; kaynak/testler/paylasilan-vektorler.json bunu iki uygulama
// icin kilitler) — FAIL-CLOSED:
//   1) km_istemci 1..800 disi                       -> RET
//   2) Google sonucu var                            -> fark > %tol ise Google, degilse istemci
//   3) Google yok, dahili iki adresi de tanidi      -> istemci < dahili*(1-tol) ise dahili, degilse istemci
//   4) Google yok, dahili de yok (dogrulanamaz)     -> RET (422 + WhatsApp yonlendirmesi)
//   5) sonuc km 1..800 disi                         -> RET
// Google hatasi/kota/cozumlenemeyen adres = "Google yok" sayilir (istemciye DUSULMEZ).
//
// mesafe.json bicimi (kaynak: pay_veri.py; Node api/_lib/mesafe.json ile ayni icerik):
//   {"sabitler":{"yol_katsayisi":1.17,...},
//    "yerler":{anahtar:{"l":[lat,lng],"t":[normalize takma adlar]}},
//    "kesin":{"a|b":km}}
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/girdi.php';

const MESAFE_MIN_KM = 1;
const MESAFE_MAX_KM = 800;

/**
 * Metni eslesme icin normallestirir. Kurallar (JS template.html / Node mesafe.js / test_adim1.py ile ayni):
 * kucuk harf, i-noktasiz->i, ss, oe, ae, NFD + [U+0300-U+036F] silme, [^a-z0-9]+ -> bosluk, tekillestir, kirp.
 * intl (Normalizer) varsa NFD onunla; yoksa unicode_tablo.php'deki yedek tablo kullanilir (ayni sonuc; testlerle kanitli).
 */
function mesafe_normalize(string $s): string
{
    $s = girdi_utf8_temizle($s);
    $s = mb_strtolower($s, 'UTF-8');
    $s = strtr($s, ['ı' => 'i', 'ß' => 'ss', 'œ' => 'oe', 'æ' => 'ae']);
    if (girdi_intl_var()) {
        $d = Normalizer::normalize($s, Normalizer::FORM_D);
        if ($d !== false) {
            $s = $d;
        }
    } else {
        $s = strtr($s, unicode_tablo()['ascii']);
    }
    $s = (string) preg_replace('/[\x{0300}-\x{036f}]/u', '', $s);
    $s = (string) preg_replace('/[^a-z0-9]+/', ' ', $s);
    return trim((string) preg_replace('/\s+/', ' ', $s));
}

/**
 * mesafe.json'u yukler ve eslesme dizinini kurar. Eslesme sirasi JS nesnesi gibidir: tamsayi benzeri anahtarlar
 * (or. posta kodlari '1930') ARTAN sirada once, digerleri ekleme sirasinda; esit uzunlukta iki takma ad ayni girdide
 * eslesirse Node/tarayici ile ayni yer kazanir.
 */
function mesafe_veri(): array
{
    static $v = null;
    if ($v === null) {
        $yol = __DIR__ . '/mesafe.json';
        $j = is_file($yol) ? json_decode((string) file_get_contents($yol), true) : null;
        $v = ['yerler' => [], 'kesin' => [], 'eslesme' => [], 'katsayi' => 1.17];
        if (is_array($j)) {
            $v['yerler'] = is_array($j['yerler'] ?? null) ? $j['yerler'] : [];
            $v['kesin'] = is_array($j['kesin'] ?? null) ? $j['kesin'] : [];
            $v['katsayi'] = (float) ($j['sabitler']['yol_katsayisi'] ?? 1.17);
            $ham = [];
            foreach ($v['yerler'] as $anahtar => $yer) {
                foreach ($yer['t'] ?? [] as $takma) {
                    $ham[(string) $takma] = (string) $anahtar;   // son yazan kazanir; konum ilk eklemede kalir (JS gibi)
                }
            }
            $sayisal = [];
            $diger = [];
            foreach ($ham as $takma => $anahtar) {
                if (is_int($takma) && $takma >= 0 && $takma <= 4294967294) {
                    $sayisal[$takma] = $anahtar;
                } else {
                    $diger[$takma] = $anahtar;
                }
            }
            ksort($sayisal);
            $v['eslesme'] = $sayisal + $diger;
        }
    }
    return $v;
}

/** Serbest metin adresten yer anahtari bulur; en uzun eslesme kazanir (esitlikte ilk). Bulamazsa null. */
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

/** Dahili tablo mesafesi: once KESIN, yoksa round(haversine x katsayi). Taninmazsa / ayni yerse null. */
function mesafe_dahili(string $alis, string $varis): ?int
{
    $ka = mesafe_yer_bul($alis);
    $kb = mesafe_yer_bul($varis);
    if ($ka === null || $kb === null || $ka === $kb) {
        return null;
    }
    $v = mesafe_veri();
    $kesin = $v['kesin'][$ka . '|' . $kb] ?? $v['kesin'][$kb . '|' . $ka] ?? null;
    if ($kesin !== null && (int) $kesin !== 0) {
        return (int) $kesin;
    }
    $x = mesafe_haversine($v['yerler'][$ka]['l'], $v['yerler'][$kb]['l']) * $v['katsayi'];
    $alt = floor($x);
    return (int) ($x - $alt >= 0.5 ? $alt + 1 : $alt);   // JS Math.round: .5 yukari (x - floor(x) tam hesaplanir)
}

/**
 * Google Distance Matrix ile gercek karayolu km'si (SUNUCU anahtariyla).
 * Anahtar yoksa / taban adres gecersizse / adreste '|' veya kontrol karakteri varsa / cagri basarisizsa /
 * durum OK degilse null ("Google yok": karar politikasi dahili tabloya duser, o da yoksa RET).
 * Anahtar ve adresler loglanmaz.
 */
function google_km(string $alis, string $varis): ?int
{
    $c = cfg();
    if ($c['google_server_key'] === '' || $c['google_api_base'] === null || !function_exists('curl_init')) {
        return null;
    }
    foreach ([$alis, $varis] as $adres) {
        // '|' Google'da origin/destination ayiricisidir; kontrol karakterleri istegi bozar
        if ($adres === '' || preg_match('/[\x00-\x1F\x7F|]/', $adres) === 1) {
            return null;
        }
    }
    $url = $c['google_api_base'] . '/maps/api/distancematrix/json'
        . '?origins=' . rawurlencode($alis)
        . '&destinations=' . rawurlencode($varis)
        . '&mode=driving&units=metric&key=' . rawurlencode($c['google_server_key']);
    $ch = curl_init($url);
    if ($ch === false) {
        return null;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    ]);
    $yanit = curl_exec($ch);
    if ($yanit === false) {
        kayit('uyari: Google cagrisi basarisiz (curl ' . curl_errno($ch) . '); dahili katmana dusuluyor');
        return null;
    }
    $kod = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($kod !== 200) {
        kayit('uyari: Google HTTP ' . $kod . '; dahili katmana dusuluyor');
        return null;
    }
    $j = json_decode((string) $yanit, true);
    $oge = is_array($j) ? ($j['rows'][0]['elements'][0] ?? null) : null;
    if (!is_array($j) || ($j['status'] ?? null) !== 'OK' || !is_array($oge) || ($oge['status'] ?? null) !== 'OK') {
        kayit('uyari: Google durum ' . substr((string) (is_array($j) ? ($j['status'] ?? '?') : '?'), 0, 30)
            . '/' . substr((string) (is_array($oge) ? ($oge['status'] ?? '?') : '?'), 0, 30) . '; dahili katmana dusuluyor');
        return null;
    }
    $metre = $oge['distance']['value'] ?? null;
    if (!is_int($metre) && !is_float($metre)) {
        return null;
    }
    $km = (int) round($metre / 1000);
    return $km > 0 ? $km : null;
}

/**
 * Nihai km kararini verir (politika dosya basinda). Doner:
 *   ['km' => int|null, 'kaynak' => 'google'|'dahili'|'istemci'|null, 'sebep' => null|'aralik'|'dogrulanamadi']
 * Tamsayi aritmetigi (float sinir hatasi olmasin): fark > tol% <=> |g-i|*100 > tol*g ; alt sinir <=> i*100 < d*(100-tol).
 */
function mesafe_karar(int $istemci, ?int $google, ?int $dahili, int|float $tolYuzde): array
{
    if ($istemci < MESAFE_MIN_KM || $istemci > MESAFE_MAX_KM) {
        return ['km' => null, 'kaynak' => null, 'sebep' => 'aralik'];
    }
    if ($google !== null && $google > 0) {
        // fark > %tol ise Google'in degeri (Google referans)
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
