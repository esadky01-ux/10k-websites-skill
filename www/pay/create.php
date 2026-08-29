<?php
// ============================================================
// EUROPA TAXI — odeme olusturma (sartname §8)
// Akis: form POST -> dogrula -> km'yi Google ile dogrula ->
// fiyati SUNUCUDA yeniden hesapla -> siparisi kaydet ->
// Mollie odemesi olustur -> checkout'a 303 yonlendir.
// Tarayicidan gelen tutara ASLA guvenilmez; tutar yalnizca km'den uretilir.
// ============================================================
declare(strict_types=1);

// ---- Fiyat sabitleri — template.html icindeki SABIT ile BIREBIR AYNI olmali.
//      build.py derleme sirasinda esitligi kontrol eder (sartname §4).
const ACILIS_UCRETI  = 10.00;  // indi-bindi (EUR)
const KM_UCRETI      = 1.99;   // km basina (EUR)
const KAPORA_YUZDE   = 20;     // on odeme yuzdesi
const MIN_KM         = 1;
const MAX_KM         = 800;

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/mailer.php';

/** Toplam / kapora / aracta odenecek. Iki ondalik. */
function fiyat_hesapla(int $km): array
{
    $toplam = round(ACILIS_UCRETI + $km * KM_UCRETI, 2);
    $kapora = round($toplam * KAPORA_YUZDE / 100, 2);
    $kalan  = round($toplam - $kapora, 2);
    return [$toplam, $kapora, $kalan];
}

/** km sinir kontrolu (sartname §14-B: 0, negatif, 801, 9999 -> ret). */
function km_gecerli(int $km): bool
{
    return $km >= MIN_KM && $km <= MAX_KM;
}

/**
 * Istemci km'si ile Google'in km'sini karsilastirir.
 * Fark toleransi asarsa SUNUCUNUN degeri kullanilir (sartname §4.5).
 * Sunucu degeri yoksa istemci degeri kalir.
 */
function km_karar(int $istemciKm, ?int $sunucuKm, int $toleransYuzde): int
{
    if ($sunucuKm === null || $sunucuKm <= 0) {
        return $istemciKm;
    }
    $fark = abs($sunucuKm - $istemciKm) / $sunucuKm * 100;
    return $fark > $toleransYuzde ? $sunucuKm : $istemciKm;
}

/**
 * Google Distance Matrix ile gercek karayolu km'si (sunucu anahtariyla).
 * Anahtar yoksa veya cagri basarisizsa null doner (istemci km'si kullanilir).
 */
function google_km(string $alis, string $varis): ?int
{
    $anahtar = trim((string) cfg()['google_server_key']);
    if ($anahtar === '') {
        return null;
    }
    $url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
        . '?origins=' . rawurlencode($alis)
        . '&destinations=' . rawurlencode($varis)
        . '&mode=driving&units=metric&key=' . rawurlencode($anahtar);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $yanit = curl_exec($ch);
    curl_close($ch);
    if ($yanit === false) {
        return null;
    }
    $j = json_decode((string) $yanit, true);
    $oge = $j['rows'][0]['elements'][0] ?? null;
    if (!is_array($oge) || ($oge['status'] ?? '') !== 'OK') {
        return null;
    }
    $metre = $oge['distance']['value'] ?? null;
    return is_numeric($metre) ? (int) round($metre / 1000) : null;
}

/** Benzersiz siparis numarasi: ET-yymmdd-XXXXXX */
function siparis_no_uret(): string
{
    do {
        $no = 'ET-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
    } while (is_file(siparis_yolu($no)));
    return $no;
}

// CLI'dan dahil edilirse (birim testleri) yalnizca fonksiyonlar tanimlanir.
if (PHP_SAPI === 'cli') {
    return;
}

// ================================================================ akis
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /fr/', true, 303);
    exit;
}

$dil = dil_sec($_POST['dil'] ?? null);

// ---- 1. girdileri temizle ve dogrula (sartname §8: ad/e-posta/telefon zorunlu)
$alis    = trim((string) ($_POST['alis'] ?? ''));
$varis   = trim((string) ($_POST['varis'] ?? ''));
$tarih   = trim((string) ($_POST['tarih'] ?? ''));
$saat    = trim((string) ($_POST['saat'] ?? ''));
$ad      = trim((string) ($_POST['ad'] ?? ''));
$eposta  = trim((string) ($_POST['eposta'] ?? ''));
$telefon = trim((string) ($_POST['telefon'] ?? ''));

if ($alis === '' || $varis === '' || mb_strlen($alis) > 300 || mb_strlen($varis) > 300) {
    hata_sayfasi($dil, t($dil, 'val_route'));
}
if ($tarih === '' || $saat === ''
    || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $tarih) || !preg_match('/^\d{2}:\d{2}$/', $saat)) {
    hata_sayfasi($dil, t($dil, 'val_date'));
}
if (mb_strlen($ad) < 2 || mb_strlen($ad) > 120) {
    hata_sayfasi($dil, t($dil, 'val_name'));
}
if (!filter_var($eposta, FILTER_VALIDATE_EMAIL)) {
    hata_sayfasi($dil, t($dil, 'val_email'));
}
if (strlen(preg_replace('/\D/', '', $telefon)) < 8 || mb_strlen($telefon) > 30) {
    hata_sayfasi($dil, t($dil, 'val_phone'));
}

// ---- 2. km sinirlari: 1-800 disi RET (sartname §8.2)
$kmIstemci = filter_var($_POST['km'] ?? null, FILTER_VALIDATE_INT);
if ($kmIstemci === false || $kmIstemci === null || !km_gecerli((int) $kmIstemci)) {
    hata_sayfasi($dil, t($dil, 'err_km'));
}
$kmIstemci = (int) $kmIstemci;

// ---- 3. mesafeyi Google sunucu anahtariyla dogrula (sartname §8.3)
$kmSunucu = google_km($alis, $varis);
$km = km_karar($kmIstemci, $kmSunucu, (int) cfg()['distance_tolerance_pct']);
if (!km_gecerli($km)) {
    hata_sayfasi($dil, t($dil, 'err_km'));
}

// ---- 4. fiyati SUNUCUDA yeniden hesapla (sartname §8.4)
[$toplam, $kapora, $kalan] = fiyat_hesapla($km);

// ---- yan alanlar (sinirlanmis)
$sinirla = static fn ($deger, int $min, int $maks, int $varsayilan): int => max($min, min($maks,
    (int) (filter_var($deger, FILTER_VALIDATE_INT) ?: $varsayilan)));
$yolcu = $sinirla($_POST['yolcu'] ?? 1, 1, 7, 1);
$buyuk = $sinirla($_POST['buyuk'] ?? 0, 0, 6, 0);
$kucuk = $sinirla($_POST['kucuk'] ?? 0, 0, 4, 0);
$arac = in_array($_POST['arac'] ?? '', ['eco', 'wagon', 'vip'], true) ? $_POST['arac'] : 'eco';
$donusTarih = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($_POST['donus_tarih'] ?? '')) ? $_POST['donus_tarih'] : '';
$donusSaat = preg_match('/^\d{2}:\d{2}$/', (string) ($_POST['donus_saat'] ?? '')) ? $_POST['donus_saat'] : '';

// ---- 5. siparisi kaydet (sartname §8.5; klasor .htaccess ile kapali)
$siparis = [
    'no'          => siparis_no_uret(),
    'olusturma'   => date('c'),
    'durum'       => 'beklemede',
    'dil'         => $dil,
    'alis'        => $alis,
    'varis'       => $varis,
    'km'          => $km,
    'km_istemci'  => $kmIstemci,
    'km_sunucu'   => $kmSunucu,
    'toplam'      => $toplam,
    'kapora'      => $kapora,
    'kalan'       => $kalan,
    'tarih'       => $tarih,
    'saat'        => $saat,
    'donus_tarih' => $donusTarih,
    'donus_saat'  => $donusSaat,
    'yolcu'       => $yolcu,
    'buyuk'       => $buyuk,
    'kucuk'       => $kucuk,
    'arac'        => $arac,
    'ad'          => $ad,
    'eposta'      => $eposta,
    'telefon'     => $telefon,
    'mollie_id'   => null,
    'mollie_durum'=> null,
    'eposta_gonderildi' => false,
];
siparis_kaydet($siparis);

// ---- 6. Mollie odemesi olustur (sartname §8.6)
if (trim((string) cfg()['mollie_api_key']) === '') {
    $siparis['durum'] = 'odeme_baslatilamadi';
    siparis_kaydet($siparis);
    kayit('Mollie anahtari bos; odeme baslatilamadi. Siparis: ' . $siparis['no']);
    hata_sayfasi($dil, t($dil, 'err_pay'));
}
$site = rtrim((string) cfg()['site_url'], '/');
$mollieYerel = ['fr' => 'fr_BE', 'nl' => 'nl_BE', 'en' => 'en_GB', 'tr' => 'fr_BE'][$dil]; // Mollie Turkce desteklemez
[$kod, $odeme] = mollie('POST', 'payments', [
    'amount'       => ['currency' => 'EUR', 'value' => number_format($kapora, 2, '.', '')],
    'description'  => 'Europa Taxi ' . $siparis['no'],
    'redirectUrl'  => $site . '/pay/success.php?order=' . $siparis['no'],
    'webhookUrl'   => $site . '/pay/webhook.php',
    'locale'       => $mollieYerel,
    'method'       => cfg()['methods'],
    'billingEmail' => $eposta,
    'metadata'     => ['order_id' => $siparis['no']],
]);

if ($kod !== 201 || empty($odeme['_links']['checkout']['href'])) {
    $siparis['durum'] = 'odeme_baslatilamadi';
    siparis_kaydet($siparis);
    kayit('Mollie create hatasi (' . $kod . '): ' . json_encode($odeme, JSON_UNESCAPED_UNICODE));
    hata_sayfasi($dil, t($dil, 'err_pay'));
}

$siparis['mollie_id'] = $odeme['id'];
$siparis['mollie_durum'] = $odeme['status'] ?? 'open';
siparis_kaydet($siparis);

// ---- 7. checkout'a 303 yonlendir (sartname §8.7)
header('Location: ' . $odeme['_links']['checkout']['href'], true, 303);
exit;
