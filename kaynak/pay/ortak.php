<?php
// ============================================================
// EUROPA TAXI — ortak yardimcilar. Tum pay/ betikleri bunu dahil eder.
// ============================================================
declare(strict_types=1);

/** Yapilandirmayi bir kez yukler. */
function cfg(): array
{
    static $c = null;
    if ($c === null) {
        $c = require __DIR__ . '/config.php';
    }
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

/** Gecerli dil kodu; bilinmeyen her sey varsayilan fr olur. */
function dil_sec(?string $d): string
{
    return in_array($d, ['fr', 'nl', 'en', 'tr'], true) ? $d : 'fr';
}

/** Metin sozlugunden ceviri getirir, {yer_tutucu} degerlerini doldurur. */
function t(string $dil, string $anahtar, array $deger = []): string
{
    $soz = diller()[$dil][$anahtar] ?? $anahtar;
    foreach ($deger as $k => $v) {
        $soz = str_replace('{' . $k . '}', (string) $v, $soz);
    }
    return $soz;
}

/** Tutar bicimi: fr/nl/tr "121,44 €", en "€121.44". */
function para(string $dil, float $tutar): string
{
    if ($dil === 'en') {
        return '€' . number_format($tutar, 2, '.', ',');
    }
    return number_format($tutar, 2, ',', ' ') . ' €';
}

/** HTML kacis kisayolu. */
function h(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
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

// ---------------------------------------------------------------- siparisler

/** Siparis klasorunu garanti eder ve web erisimini .htaccess ile kapatir. */
function siparis_klasoru(): string
{
    $k = cfg()['orders_dir'];
    if (!is_dir($k)) {
        mkdir($k, 0755, true);
    }
    $ht = $k . '/.htaccess';
    if (!is_file($ht)) {
        // Apache 2.4 ve 2.2 icin cifte kilit
        file_put_contents($ht, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    }
    return $k;
}

function siparis_yolu(string $no): string
{
    return siparis_klasoru() . '/' . $no . '.json';
}

/** Siparis numarasi guvenli bicimde mi? (dosya adi olarak kullanilir) */
function siparis_no_gecerli(string $no): bool
{
    return (bool) preg_match('/^ET-[0-9]{6}-[A-Z0-9]{6}$/', $no);
}

function siparis_oku(string $no): ?array
{
    if (!siparis_no_gecerli($no)) {
        return null;
    }
    $y = siparis_yolu($no);
    if (!is_file($y)) {
        return null;
    }
    $j = json_decode((string) file_get_contents($y), true);
    return is_array($j) ? $j : null;
}

function siparis_kaydet(array $s): void
{
    file_put_contents(
        siparis_yolu($s['no']),
        json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
}

/** Kayit defteri (posta/webhook sorunlari icin, web'e kapali klasorde). */
function kayit(string $mesaj): void
{
    file_put_contents(
        siparis_klasoru() . '/kayit.log',
        date('Y-m-d H:i:s') . '  ' . $mesaj . "\n",
        FILE_APPEND | LOCK_EX
    );
}

// ---------------------------------------------------------------- Mollie

/**
 * Mollie API cagrisi. Doner: [http_kodu, govde_dizi].
 * cURL hatasinda [0, ['hata' => ...]].
 */
function mollie(string $yontem, string $yol, ?array $govde = null): array
{
    $anahtar = trim((string) cfg()['mollie_api_key']);
    $c = curl_init('https://api.mollie.com/v2/' . ltrim($yol, '/'));
    $basliklar = ['Authorization: Bearer ' . $anahtar];
    $secenekler = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CUSTOMREQUEST  => $yontem,
    ];
    if ($govde !== null) {
        $basliklar[] = 'Content-Type: application/json';
        $secenekler[CURLOPT_POSTFIELDS] = json_encode($govde, JSON_UNESCAPED_SLASHES);
    }
    $secenekler[CURLOPT_HTTPHEADER] = $basliklar;
    curl_setopt_array($c, $secenekler);
    $yanit = curl_exec($c);
    if ($yanit === false) {
        $hata = curl_error($c);
        curl_close($c);
        return [0, ['hata' => $hata]];
    }
    $kod = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    curl_close($c);
    $dizi = json_decode((string) $yanit, true);
    return [$kod, is_array($dizi) ? $dizi : []];
}

// ---------------------------------------------------------------- mini sayfa

/**
 * Marka gorunumlu kucuk sayfa (hata/odeme sonucu). noindex.
 * $yenile > 0 ise sayfa o kadar saniyede bir kendini yeniler.
 */
function mini_sayfa(string $dil, string $baslik, string $icerikHtml, int $yenile = 0): void
{
    $yenileEtiketi = $yenile > 0
        ? '<meta http-equiv="refresh" content="' . $yenile . '">'
        : '';
    header('Content-Type: text/html; charset=utf-8');
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

/** Hata sayfasi gosterip cikar. */
function hata_sayfasi(string $dil, string $mesaj): never
{
    http_response_code(422);
    mini_sayfa(
        $dil,
        t($dil, 'err_t'),
        '<p>' . h($mesaj) . '</p>'
        . '<div class="btnler"><a class="btn btn--dis" href="/' . h($dil) . '/#rezervasyon">'
        . h(t($dil, 'err_back')) . '</a></div>'
    );
    exit;
}
