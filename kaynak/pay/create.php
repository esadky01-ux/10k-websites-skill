<?php
// ============================================================
// EUROPA TAXI — odeme olusturma (sartname §8)
// Akis: form POST -> Origin/oran siniri/bal-kupu -> dogrula -> km'yi Google + dahili tabloyla dogrula
// (dogrulanamazsa RET) -> fiyati SUNUCUDA yeniden hesapla -> siparisi kaydet (kaydedilemezse odeme YOK)
// -> Mollie odemesi -> checkout'a 303 yonlendir.
// Tarayicidan gelen tutara ASLA guvenilmez; tutar yalnizca km'den uretilir.
// Davranis kaynak/vercel/api/create.js ile esdegerdir (Node farklari raporda).
// ============================================================
declare(strict_types=1);

@ini_set('display_errors', '0');   // dahil edilen dosyalar yuklenirken (ayristirma/yukleme hatasi) bile mutlak yol ekrana basilmasin

// ---- Fiyat sabitleri — template.html icindeki SABIT ile BIREBIR AYNI olmali.
//      build.py derleme sirasinda esitligi kontrol eder (sartname §4).
const ACILIS_UCRETI  = 10.00;  // indi-bindi (EUR)
const KM_UCRETI      = 1.99;   // km basina (EUR)
const KAPORA_YUZDE   = 20;     // on odeme yuzdesi
const MIN_KM         = 1;
const MAX_KM         = 800;

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/girdi.php';
require_once __DIR__ . '/mesafe.php';
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
 * Checkout adresi guvenli mi? https, ya da yerel Mollie taklidiyle (http://127.0.0.1) AYNI host:port (yalniz test).
 * Acik yonlendirmeyi ve baslik enjeksiyonunu onler. Doner: adres | null.
 */
function checkout_guvenli(mixed $href): ?string
{
    if (!is_string($href) || preg_match('/[\x00-\x20\x7F]/', $href) === 1) {
        return null;
    }
    $u = parse_url($href);
    if (!is_array($u) || !isset($u['scheme'], $u['host']) || isset($u['user']) || isset($u['pass'])) {
        return null;
    }
    $sema = strtolower((string) $u['scheme']);
    if ($sema === 'https') {
        return $href;
    }
    $taban = cfg()['mollie_api_base'];
    if ($sema === 'http' && strtolower((string) $u['host']) === '127.0.0.1' && $taban !== null) {
        $t = parse_url($taban);
        if (is_array($t) && ($t['host'] ?? '') === '127.0.0.1' && ($t['port'] ?? 80) === ($u['port'] ?? 80)) {
            return $href;
        }
    }
    return null;
}

// CLI'dan dahil edilirse (birim testleri) yalnizca fonksiyonlar tanimlanir.
if (PHP_SAPI === 'cli') {
    return;
}

// ================================================================ akis
guvenlik_baslat('create');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method Not Allowed';
    exit;
}

// ---- icerik turu + govde (<=64 KB, urlencoded)
$tip = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
if (!str_starts_with($tip, 'application/x-www-form-urlencoded')) {
    hata_sayfasi('fr', t('fr', 'err_pay'), 415);
}
$govde = govde_oku();
if ($govde === null) {
    hata_sayfasi('fr', t('fr', 'err_bad_request', [], 'err_pay'), 413, '', ['Connection' => 'close']);
}
$form = girdi_form_coz($govde);
$dil = dil_sec(girdi_ilk($form, 'dil'));
istek_baglami(['dil' => $dil]);

// ---- Origin / Referer (CSRF katmani)
if (!kaynak_izinli()) {
    kayit('uyari: create: Origin/Referer reddedildi');
    hata_sayfasi($dil, t($dil, 'err_forbidden', [], 'err_pay'), 403);
}

// ---- IP tabanli oran siniri (dakikada 5 / saatte 30; dosya tabanli, flock'lu)
$oran = create_siniri(istemci_ip());
if (!$oran['izin']) {
    kayit('uyari: create: oran siniri asildi');
    hata_sayfasi($dil, t($dil, 'err_rate', [], 'err_pay'), 429, '', ['Retry-After' => (string) $oran['bekleme']]);
}

// ---- bal-kupu (honeypot): dolu ise sessizce "tamam" de, siparis/odeme OLUSTURMA
$bal = girdi_ilk($form, 'web');
if ($bal !== null && trim($bal) !== '') {
    kayit('bilgi: create: honeypot tetiklendi');
    http_response_code(200);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'tamam';
    exit;
}

// ---- dizi / tekrar eden alan (alis[]=x, alis=a&alis=b ...): temiz 400
$yapisal = girdi_yapisal_hata($form);
if ($yapisal !== null) {
    hata_sayfasi($dil, t($dil, GIRDI_ALAN_MESAJI[$yapisal], [], 'err_pay'), 400);
}

// ---- 1. girdileri temizle ve dogrula (Node ile ayni sira; ilk hata gosterilir)
$ham = [];
foreach (array_keys(GIRDI_ALAN_MESAJI) as $alan) {
    $ham[$alan] = girdi_ilk($form, $alan);
}
$dv = girdi_dogrula($ham);
if (!$dv['ok']) {
    hata_sayfasi($dil, t($dil, $dv['anahtar'], [], 'err_pay'), 422);
}
$g = $dv['deger'];

// ---- iptal kosullari onayi SUNUCUDA zorunlu (istemci JS'i atlatilabilir)
if (girdi_ilk($form, 'iptal') !== '1') {
    hata_sayfasi($dil, t($dil, 'val_cancel', [], 'err_pay'), 422);
}

// ---- 2. km karari: Google (varsa) + dahili tablo + istemci -> dogrulanamazsa RET (FAIL-CLOSED)
$kmGoogle = google_km($g['alis'], $g['varis']);
$kmDahili = mesafe_dahili($g['alis'], $g['varis']);
$karar = mesafe_karar($g['km_istemci'], $kmGoogle, $kmDahili, cfg()['distance_tolerance_pct']);
if ($karar['km'] === null) {
    // Ulasilamayan / dogrulanamayan mesafe: musteriyi WhatsApp'a yonlendir (fiyat URETME)
    $waUrl = (string) (isletme()['whatsapp'] ?? '');
    $wa = $waUrl !== '' ? '<a class="btn btn--wa" href="' . h($waUrl) . '" rel="noopener">' . h(t($dil, 'succ_wa')) . '</a>' : '';
    kayit('bilgi: create: km dogrulanamadi/reddedildi (' . (string) $karar['sebep'] . ')');
    hata_sayfasi($dil, t($dil, 'err_km_wa', [], 'err_km'), 422, $wa);
}
$km = $karar['km'];

// ---- 3. fiyati SUNUCUDA yeniden hesapla (sartname §8.4)
[$toplam, $kapora, $kalan] = fiyat_hesapla($km);

// ---- 4. siparisi kaydet (klasor web kokunun disinda; kaydedilemezse ODEME BASLATILMAZ)
$no = siparis_no_uret();
istek_baglami(['no' => $no]);
$siparis = [
    'no'          => $no,
    'olusturma'   => date('c'),
    'durum'       => 'beklemede',
    'dil'         => $dil,
    'alis'        => $g['alis'],
    'varis'       => $g['varis'],
    'km'          => $km,
    'km_istemci'  => $g['km_istemci'],
    'km_sunucu'   => $kmGoogle,
    'km_dahili'   => $kmDahili,
    'km_kaynak'   => $karar['kaynak'],
    'toplam'      => $toplam,
    'kapora'      => $kapora,
    'kalan'       => $kalan,
    'tarih'       => $g['tarih'],
    'saat'        => $g['saat'],
    'donus_tarih' => $g['donus_tarih'],
    'donus_saat'  => $g['donus_saat'],
    'yolcu'       => $g['yolcu'],
    'buyuk'       => $g['buyuk'],
    'kucuk'       => $g['kucuk'],
    'arac'        => $g['arac'],
    'ad'          => $g['ad'],
    'eposta'      => $g['eposta'],
    'telefon'     => $g['telefon'],
    'iptal_onay'  => date('c'),
    'mollie_id'   => null,
    'mollie_durum' => null,
    'eposta_musteri' => false,
    'eposta_sirket'  => false,
    'eposta_gonderildi' => false,
];
if (!siparis_kaydet($siparis)) {
    kayit('hata: create: siparis kaydedilemedi; odeme baslatilmadi ' . $no);
    hata_sayfasi($dil, t($dil, 'err_pay'), 500);
}

// ---- 5. Mollie odemesi (sartname §8.6)
$c = cfg();
if ($c['mollie_api_key'] === '') {
    siparis_guncelle($no, static fn (array $s): array => ['durum' => 'odeme_baslatilamadi'] + $s);
    kayit('hata: create: Mollie anahtari bos; odeme baslatilamadi ' . $no);
    hata_sayfasi($dil, t($dil, 'err_pay'), 503);
}
$idem = girdi_idem(girdi_ilk($form, 'idem'));
$mollieYerel = ['fr' => 'fr_BE', 'nl' => 'nl_BE', 'en' => 'en_GB', 'tr' => 'fr_BE'][$dil]; // Mollie Turkce desteklemez
[$kod, $odeme] = mollie('POST', 'payments', [
    'amount'       => ['currency' => 'EUR', 'value' => number_format($kapora, 2, '.', '')],
    'description'  => 'europetaxi24 ' . $no,
    'redirectUrl'  => $c['site_url'] . '/pay/success.php?order=' . $no . '&dil=' . $dil,
    'webhookUrl'   => $c['site_url'] . '/pay/webhook.php',
    'locale'       => $mollieYerel,
    'method'       => $c['methods'],
    'metadata'     => ['order_id' => $no],
], ['idempotency' => $idem !== '' ? $idem : 'et-' . $no]);

$checkout = checkout_guvenli($odeme['_links']['checkout']['href'] ?? null);
$odemeId = $odeme['id'] ?? null;
// Idempotency tekrari (ayni idem baska siparise ait odemeyi dondurdu) ya da bozuk yanit -> hata; odeme YOK
$meta = is_array($odeme['metadata'] ?? null) ? $odeme['metadata'] : [];
if ($kod !== 201 || !is_string($odemeId) || preg_match('/^tr_[A-Za-z0-9]+\z/', $odemeId) !== 1
    || $checkout === null || ($meta['order_id'] ?? null) !== $no) {
    siparis_guncelle($no, static fn (array $s): array => ['durum' => 'odeme_baslatilamadi'] + $s);
    kayit('hata: create: Mollie odeme olusturulamadi (HTTP ' . $kod . ') ' . $no);
    hata_sayfasi($dil, t($dil, 'err_pay'), 502);
}
siparis_guncelle($no, static function (array $s) use ($odemeId, $odeme): array {
    $s['mollie_id'] = $odemeId;
    $s['mollie_durum'] = (string) ($odeme['status'] ?? 'open');
    return $s;
});
kayit('bilgi: create: odeme olusturuldu ' . $no . ' ' . $odemeId);

// ---- 6. checkout'a 303 yonlendir (sartname §8.7)
header('Location: ' . $checkout, true, 303);
exit;
