<?php
// ============================================================
// EUROPA TAXI — ortak yardimcilar. Tum pay/ betikleri bunu dahil eder.
//
// Icerik: yapilandirma (ortam degiskeni > config.php), 4 dilli metinler, bicim yardimcilari,
// Mollie istemcisi, kayit defteri (log), marka gorunumlu mini sayfa.
// Ayrica guvenlik.php (basliklar, hata isleyici, oran siniri, oturum) ve depo.php (siparis
// dosyalari) yuklenir. Bu dosya dahil edilince HICBIR yan etki yoktur (baslik/isleyici yok):
// her giris betigi guvenlik_baslat()'i acikca cagirir; CLI testleri dogrudan dahil edebilir.
// ============================================================
declare(strict_types=1);

date_default_timezone_set('Europe/Brussels');

const VARSAYILAN_SITE = 'https://europetaxi24.be';
const VARSAYILAN_MOLLIE = 'https://api.mollie.com/v2';
const VARSAYILAN_BREVO = 'https://api.brevo.com/v3';
const VARSAYILAN_GOOGLE = 'https://maps.googleapis.com';

// ---------------------------------------------------------------- yapilandirma

/** Ortam degiskeni (kirpilmis); yoksa ''. getenv() once, sonra (HTTP_ ile baslamayan) $_SERVER/$_ENV. */
function ortam(string $ad): string
{
    $v = getenv($ad);
    if (!is_string($v) || $v === '') {
        $v = $_ENV[$ad] ?? '';
        if ((!is_string($v) || $v === '') && !str_starts_with($ad, 'HTTP_')) {
            $v = $_SERVER[$ad] ?? '';
        }
    }
    return is_string($v) ? trim($v) : '';
}

/**
 * *_api_base degeri: yalniz https:// veya http://127.0.0.1 kabul edilir; baska sema/host/kimlik bilgisi
 * REDDEDILIR (null): ilgili dis servis cagrisi HIC yapilmaz (uretim adresine sessizce dusulmez).
 * Bos deger -> varsayilan.
 */
function taban_url(string $ham, string $varsayilan): ?string
{
    $ham = trim($ham);
    if ($ham === '') {
        return $varsayilan;
    }
    $u = parse_url($ham);
    if (!is_array($u) || !isset($u['scheme'], $u['host']) || isset($u['user']) || isset($u['pass'])) {
        return null;
    }
    $sema = strtolower((string) $u['scheme']);
    $host = strtolower((string) $u['host']);
    $https = $sema === 'https';
    $yerel = $sema === 'http' && $host === '127.0.0.1';
    if (!($https || $yerel) || preg_match('/[\x00-\x20\x7F]/', $ham) === 1) {
        return null;
    }
    return rtrim($ham, '/');
}

/** Guvenilir vekil basligi adi: HTTP_X_FORWARDED_FOR biciminde; gecersizse ''. */
function proxy_baslik_adi(string $ham): string
{
    $ham = strtoupper(str_replace('-', '_', trim($ham)));
    if ($ham === '' || $ham === 'REMOTE_ADDR') {
        return '';
    }
    if (!str_starts_with($ham, 'HTTP_')) {
        $ham = 'HTTP_' . $ham;
    }
    return preg_match('/^HTTP_[A-Z0-9_]{1,60}\z/', $ham) === 1 ? $ham : '';
}

/**
 * Yapilandirma (istek basina bir kez). Oncelik: ortam degiskeni > config.php > varsayilan.
 * Doner anahtarlar: mollie_api_key, site_url, company_email, mail_from, brevo_api_key, google_server_key,
 * admin_password, orders_dir, methods, distance_tolerance_pct, trusted_proxy_header,
 * mollie_api_base / brevo_api_base / google_api_base (gecersizse null), _kaynak (anahtar -> 'ortam'|'config').
 * $sifirla=true: onbellegi temizler (yalniz testler).
 */
function cfg(bool $sifirla = false): array
{
    static $c = null;
    if ($sifirla) {
        $c = null;
    }
    if ($c !== null) {
        return $c;
    }
    $yol = __DIR__ . '/config.php';
    $dosya = is_file($yol) ? require $yol : [];
    $dosya = is_array($dosya) ? $dosya : [];

    $ham = $dosya + [
        'mollie_api_key' => '', 'site_url' => VARSAYILAN_SITE, 'company_email' => '', 'mail_from' => '',
        'brevo_api_key' => '', 'google_server_key' => '', 'admin_password' => '', 'orders_dir' => '',
        'methods' => ['bancontact', 'creditcard', 'applepay'], 'distance_tolerance_pct' => 12,
        'trusted_proxy_header' => '', 'mollie_api_base' => '', 'brevo_api_base' => '', 'google_api_base' => '',
    ];
    $kaynak = [];
    $env = [
        'mollie_api_key' => 'MOLLIE_API_KEY', 'site_url' => 'SITE_URL', 'company_email' => 'COMPANY_EMAIL',
        'mail_from' => 'MAIL_FROM', 'brevo_api_key' => 'BREVO_API_KEY', 'google_server_key' => 'GOOGLE_SERVER_KEY',
        'admin_password' => 'ADMIN_PASSWORD', 'orders_dir' => 'ORDERS_DIR',
        'distance_tolerance_pct' => 'DISTANCE_TOLERANCE_PCT', 'trusted_proxy_header' => 'TRUSTED_PROXY_HEADER',
        'mollie_api_base' => 'MOLLIE_API_BASE', 'brevo_api_base' => 'BREVO_API_BASE', 'google_api_base' => 'GOOGLE_API_BASE',
    ];
    foreach ($env as $anahtar => $ad) {
        $v = ortam($ad);
        if ($v !== '') {
            $ham[$anahtar] = $v;
            $kaynak[$anahtar] = 'ortam';
        } else {
            $kaynak[$anahtar] = ($dosya[$anahtar] ?? '') !== '' ? 'config' : 'varsayilan';
        }
    }

    $site = trim((string) $ham['site_url']);
    $siteU = parse_url($site);
    if (!is_array($siteU) || !in_array(strtolower((string) ($siteU['scheme'] ?? '')), ['http', 'https'], true)
        || !isset($siteU['host']) || isset($siteU['user']) || isset($siteU['pass'])) {
        $site = VARSAYILAN_SITE;
    }

    $tol = $ham['distance_tolerance_pct'];
    $tol = is_numeric($tol) ? $tol + 0 : 12;
    if ($tol < 0 || $tol > 100) {
        $tol = 12;
    }
    $yontemler = is_array($ham['methods']) ? array_values(array_filter(
        $ham['methods'],
        static fn ($m): bool => is_string($m) && preg_match('/^[a-z0-9]{2,30}\z/', $m) === 1
    )) : [];

    $c = [
        'mollie_api_key' => trim((string) $ham['mollie_api_key']),
        'site_url' => rtrim($site, '/'),
        'company_email' => trim((string) $ham['company_email']),
        'mail_from' => trim((string) $ham['mail_from']),
        'brevo_api_key' => trim((string) $ham['brevo_api_key']),
        'google_server_key' => trim((string) $ham['google_server_key']),
        'admin_password' => trim((string) $ham['admin_password']),
        'orders_dir' => trim((string) $ham['orders_dir']),
        'methods' => $yontemler !== [] ? $yontemler : ['bancontact', 'creditcard', 'applepay'],
        'distance_tolerance_pct' => $tol,
        'trusted_proxy_header' => proxy_baslik_adi((string) $ham['trusted_proxy_header']),
        'mollie_api_base' => taban_url((string) $ham['mollie_api_base'], VARSAYILAN_MOLLIE),
        'brevo_api_base' => taban_url((string) $ham['brevo_api_base'], VARSAYILAN_BREVO),
        'google_api_base' => taban_url((string) $ham['google_api_base'], VARSAYILAN_GOOGLE),
        '_kaynak' => $kaynak,
    ];
    return $c;
}

/** build.py'nin urettigi 4 dilli metinler (dil.php). */
function diller(): array
{
    static $d = null;
    if ($d === null) {
        $yol = __DIR__ . '/dil.php';
        $d = is_file($yol) ? require $yol : [];
    }
    return $d;
}

/** build.py'nin urettigi isletme sabitleri (isletme.php). */
function isletme(): array
{
    static $i = null;
    if ($i === null) {
        $yol = __DIR__ . '/isletme.php';
        $i = is_file($yol) ? require $yol : [];
    }
    return $i;
}

/** Gecerli dil kodu; bilinmeyen (ya da metin olmayan / dizi) her sey varsayilan fr olur. */
function dil_sec(mixed $d): string
{
    return is_string($d) && in_array($d, ['fr', 'nl', 'en', 'tr'], true) ? $d : 'fr';
}

/**
 * Metin sozlugunden ceviri getirir, {yer_tutucu} degerlerini doldurur.
 * $yedekAnahtar: $anahtar sozlukte YOKSA (henuz strings.json'a eklenmemis yeni anahtar) bu anahtar kullanilir.
 */
function t(string $dil, string $anahtar, array $deger = [], ?string $yedekAnahtar = null): string
{
    $dil = dil_sec($dil);
    $soz = diller()[$dil] ?? [];
    if (isset($soz[$anahtar])) {
        $metin = (string) $soz[$anahtar];
    } elseif ($yedekAnahtar !== null) {
        $metin = isset($soz[$yedekAnahtar]) ? (string) $soz[$yedekAnahtar] : $yedekAnahtar;
    } else {
        $metin = $anahtar;
    }
    foreach ($deger as $k => $v) {
        $metin = str_replace('{' . $k . '}', (string) $v, $metin);
    }
    return $metin;
}

/** Tutar bicimi: fr/nl/tr "121,44 €", en "€121.44". */
function para(string $dil, float $tutar): string
{
    if ($dil === 'en') {
        return '€' . number_format($tutar, 2, '.', ',');
    }
    return number_format($tutar, 2, ',', ' ') . ' €';
}

/** HTML kacis kisayolu (Node h() ile ayni: & < > " '). */
function h(mixed $s): string
{
    return htmlspecialchars(is_scalar($s) || $s === null ? (string) $s : '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** "2026-08-30" + "14:30" -> dile gore okunur metin. */
function tarih_goster(string $dil, string $tarih, string $saat = ''): string
{
    if ($tarih === '') {
        return '';
    }
    $p = explode('-', $tarih);
    $okunur = count($p) === 3 ? sprintf('%s.%s.%s', $p[2], $p[1], $p[0]) : $tarih;
    if ($saat === '') {
        return $okunur;
    }
    return t($dil, 'dt_join', ['date' => $okunur, 'time' => $saat]);
}

// ---------------------------------------------------------------- kayit defteri (log)

/**
 * Log satirini temizler: CR/LF/kontrol karakterleri bosluk olur (log satiri enjeksiyonu yok);
 * son emniyet olarak e-posta, uzun rakam dizisi (telefon), API anahtari benzeri ve uzun belirtecler
 * maskelenir; siparis no / odeme id korunur. En fazla 300 karakter.
 * KURAL: cagiranlar zaten yalniz siparis no / odeme id / durum yazar; bu yalniz ikinci savunma hattidir.
 */
function kayit_temizle(string $mesaj): string
{
    // 0) gecersiz UTF-8 baytlari '?' olur (log dosyasina ikili cop yazilmaz)
    if (function_exists('mb_scrub')) {
        $mesaj = mb_scrub($mesaj, 'UTF-8');
    }
    // 1) kontrol karakterleri (CR/LF dahil) -> bosluk: log satiri enjeksiyonu imkansiz
    $m = preg_replace('/[\x00-\x1F\x7F]+/', ' ', $mesaj) ?? '';
    $m = preg_replace("/[\u{0080}-\u{009F}\u{2028}\u{2029}]+/u", ' ', $m) ?? $m;
    // 2) siparis no / odeme id'yi maskelemeden koru (tutucu isaretleri artik girdide olamaz)
    $saklanan = [];
    $m = preg_replace_callback('/ET-[0-9]{6}-[A-Z0-9]{6}|tr_[A-Za-z0-9]{6,20}/', static function (array $e) use (&$saklanan): string {
        $saklanan[] = $e[0];
        return "\x01" . (count($saklanan) - 1) . "\x02";
    }, $m) ?? '';
    $m = preg_replace("/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/", '[eposta]', $m) ?? $m;
    $m = preg_replace('/\b(?:test|live)_[A-Za-z0-9]{8,}/', '[anahtar]', $m) ?? $m;
    $m = preg_replace('/[A-Za-z0-9_-]{32,}/', '[token]', $m) ?? $m;
    $m = preg_replace('/\d(?:[\s().-]?\d){7,}/', '[sayi]', $m) ?? $m;
    $m = preg_replace_callback('/\x01(\d+)\x02/', static fn (array $e): string => $saklanan[(int) $e[1]] ?? '', $m) ?? $m;
    $m = preg_replace('/[\x01\x02]/', '', $m) ?? $m;
    return substr($m, 0, 300);
}

/** Kayit defteri (web'e kapali klasorde kayit.log, 0600). Hicbir hata disari sizmaz. */
function kayit(string $mesaj): void
{
    try {
        $yol = siparis_klasoru() . '/kayit.log';
        $yeni = !is_file($yol);
        @file_put_contents($yol, date('Y-m-d H:i:s') . '  ' . kayit_temizle($mesaj) . "\n", FILE_APPEND | LOCK_EX);
        if ($yeni) {
            @chmod($yol, 0600);
        }
    } catch (\Throwable) {
        // log yazilamiyorsa akisi bozma
    }
}

// ---------------------------------------------------------------- Mollie

/**
 * Mollie API cagrisi. Doner: [http_kodu, govde_dizi]. Ag/ayar hatasinda [0, ['hata' => ...]].
 * mollie_api_base gecersizse (https:// veya http://127.0.0.1 disi) veya anahtar bossa HIC cagri yapilmaz.
 * $secenek: ['idempotency' => string, 'zaman_asimi' => int]
 */
function mollie(string $yontem, string $yol, ?array $govde = null, array $secenek = []): array
{
    $c = cfg();
    if ($c['mollie_api_base'] === null) {
        return [0, ['hata' => 'mollie_api_base gecersiz']];
    }
    if ($c['mollie_api_key'] === '') {
        return [0, ['hata' => 'mollie_api_key yok']];
    }
    if (!function_exists('curl_init')) {
        return [0, ['hata' => 'curl yok']];
    }
    $ch = curl_init($c['mollie_api_base'] . '/' . ltrim($yol, '/'));
    if ($ch === false) {
        return [0, ['hata' => 'curl baslatilamadi']];
    }
    $basliklar = ['Authorization: Bearer ' . $c['mollie_api_key'], 'Accept: application/json'];
    $ayar = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT        => (int) ($secenek['zaman_asimi'] ?? 15),
        CURLOPT_CUSTOMREQUEST  => $yontem,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    ];
    if ($govde !== null) {
        $json = json_encode($govde, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return [0, ['hata' => 'json_encode']];
        }
        $basliklar[] = 'Content-Type: application/json';
        $ayar[CURLOPT_POSTFIELDS] = $json;
    }
    if (!empty($secenek['idempotency']) && preg_match('/^[A-Za-z0-9-]{1,80}\z/', (string) $secenek['idempotency']) === 1) {
        $basliklar[] = 'Idempotency-Key: ' . $secenek['idempotency'];
    }
    $ayar[CURLOPT_HTTPHEADER] = $basliklar;
    curl_setopt_array($ch, $ayar);
    $yanit = curl_exec($ch);
    if ($yanit === false) {
        return [0, ['hata' => 'curl:' . curl_errno($ch)]];
    }
    $kod = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $dizi = json_decode((string) $yanit, true);
    return [$kod, is_array($dizi) ? $dizi : []];
}

// ---------------------------------------------------------------- mini sayfa

/**
 * Marka gorunumlu kucuk sayfa (hata/odeme sonucu). noindex.
 * $yenile > 0: sayfa o kadar saniye sonra $yenileUrl'e (bos ise kendine) yonlenir.
 * $kod: HTTP durum kodu; $ekBasliklar: ['Retry-After' => '60'] gibi.
 */
function mini_sayfa(string $dil, string $baslik, string $icerikHtml, int $yenile = 0, string $yenileUrl = '', int $kod = 200, array $ekBasliklar = []): void
{
    $yenileEtiketi = $yenile > 0
        ? '<meta http-equiv="refresh" content="' . h((string) $yenile . ($yenileUrl !== '' ? ';url=' . $yenileUrl : '')) . '">'
        : '';
    http_response_code($kod);
    header('Content-Type: text/html; charset=utf-8');
    foreach ($ekBasliklar as $ad => $deger) {
        header($ad . ': ' . $deger);
    }
    echo '<!doctype html>
<html lang="' . h($dil) . '">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<title>' . h($baslik) . ' · Europa Taxi</title>
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
' . $yenileEtiketi . '
<style>
body{background:#0A0A0C;color:#F4F4F6;font:400 16px/1.6 "Archivo",system-ui,sans-serif;
margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.kart{max-width:520px;width:100%;background:#121215;border:1px solid rgba(255,255,255,.09);
border-radius:18px;padding:34px;position:relative}
.kart::before{content:"";position:absolute;top:0;left:24px;right:24px;height:2px;
background:linear-gradient(90deg,transparent,#FFC107,transparent)}
.marka{font-weight:900;font-size:18px;letter-spacing:.5px;margin-bottom:22px}
.marka b{color:#fff}.marka span{color:#FFC107}
h1{font-size:23px;font-weight:900;margin:0 0 12px;color:#FFC107}
p{color:#A8AAB3;margin:0 0 12px}
.ref{font-size:13px;color:#6E7080;margin-top:16px}
.btnler{display:grid;gap:10px;margin-top:24px}
.btn{display:block;text-align:center;padding:13px 22px;border-radius:12px;font-weight:800;
text-decoration:none;color:#141005;background:linear-gradient(180deg,#FFC107,#E5A93C)}
.btn--dis{background:none;border:1px solid rgba(255,255,255,.22);color:#F4F4F6}
.btn--wa{background:#25D366;color:#06250f}
</style>
</head>
<body>
<div class="kart">
  <div class="marka"><b>EUROPA</b><span>TAXI</span></div>
  <h1>' . h($baslik) . '</h1>
  ' . $icerikHtml . '
</div>
</body>
</html>';
}

/** WhatsApp / telefon dugmeleri (isletme.php'den). $ek: ek dugme HTML'i (ilk sirada). */
function iletisim_dugmeleri(string $dil, string $ek = '', string $waMetni = ''): string
{
    $i = isletme();
    $s = '<div class="btnler">' . $ek;
    $wa = (string) ($i['whatsapp'] ?? '');
    if ($wa !== '') {
        $s .= '<a class="btn btn--wa" href="' . h($wa . ($waMetni !== '' ? '?text=' . rawurlencode($waMetni) : '')) . '" rel="noopener">'
            . h(t($dil, 'succ_wa')) . '</a>';
    }
    $tel = (string) ($i['telefon_link'] ?? '');
    if ($tel !== '') {
        $s .= '<a class="btn btn--dis" href="tel:' . h($tel) . '">' . h((string) ($i['telefon'] ?? $tel)) . '</a>';
    }
    return $s . '<a class="btn btn--dis" href="/' . h($dil) . '/">' . h(t($dil, 'succ_home')) . '</a></div>';
}

/**
 * Hata sayfasi gosterip cikar. $kod: HTTP durumu (varsayilan 422). $ekBtn: ek dugme HTML'i.
 * "Forma don" baglantisi her zaman vardir.
 */
function hata_sayfasi(string $dil, string $mesaj, int $kod = 422, string $ekBtn = '', array $ekBasliklar = []): never
{
    mini_sayfa(
        $dil,
        t($dil, 'err_t'),
        '<p>' . h($mesaj) . '</p>'
        . '<div class="btnler">' . $ekBtn . '<a class="btn btn--dis" href="/' . h($dil) . '/#rezervasyon">'
        . h(t($dil, 'err_back')) . '</a></div>',
        0,
        '',
        $kod,
        $ekBasliklar
    );
    exit;
}

// ---------------------------------------------------------------- diger modulleri yukle
require_once __DIR__ . '/guvenlik.php';
require_once __DIR__ . '/depo.php';
