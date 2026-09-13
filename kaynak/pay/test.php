<?php
// ============================================================
// EUROPA TAXI — kurulum tanilama sayfasi (sartname §8)
// Kullanim: https://alan-adiniz/pay/test.php?pw=ADMIN_SIFRESI
// !!! KURULUM BITINCE BU DOSYAYI SILIN !!!
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/mailer.php';

$c = cfg();
$sifre = (string) $c['admin_password'];

if ($sifre === '') {
    mini_sayfa('tr', 'Tanılama kapalı',
        '<p>Önce <code>pay/config.php</code> içinde <b>admin_password</b> belirleyin, sonra
        <code>test.php?pw=ŞİFRENİZ</code> adresini açın.</p>');
    exit;
}
if (!hash_equals($sifre, (string) ($_GET['pw'] ?? ''))) {
    http_response_code(403);
    mini_sayfa('tr', 'Erişim reddedildi', '<p>test.php?pw=ADMIN_ŞİFRESİ biçiminde açın.</p>');
    exit;
}

// ---- test e-postasi gonderimi
$postaSonucu = null;
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['eposta_testi'])) {
    $postaSonucu = eposta_gonder(
        (string) $c['company_email'],
        'Europa Taxi kurulum testi',
        '<p>Bu bir kurulum test e-postasıdır. Bunu okuyorsanız e-posta ayarları çalışıyor.</p>',
        'Bu bir kurulum test e-postasidir.'
    );
}

// ---- kontroller
$kontroller = [];
$ekle = static function (string $ad, bool $iyi, string $detay = '') use (&$kontroller): void {
    $kontroller[] = [$ad, $iyi, $detay];
};

// PHP + eklentiler
$ekle('PHP sürümü ≥ 8.0', PHP_VERSION_ID >= 80000, 'PHP ' . PHP_VERSION);
$ekle('cURL eklentisi', function_exists('curl_init'));
$ekle('JSON eklentisi', function_exists('json_encode'));

// HTTPS
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$ekle('HTTPS bağlantısı', $https, $https ? '' : 'SSL sertifikasını (Let\'s Encrypt) etkinleştirin');

// siparis klasoru yazilabilir mi
$klasor = siparis_klasoru();
$deneme = @file_put_contents($klasor . '/yazma-testi.tmp', 'ok');
if ($deneme !== false) {
    @unlink($klasor . '/yazma-testi.tmp');
}
$ekle('pay/orders/ yazılabilir', $deneme !== false, $klasor);
$ekle('pay/orders/.htaccess koruması', is_file($klasor . '/.htaccess'));

// Mollie anahtari: bosluk/uzunluk + canli baglanti + aktif yontemler
$mollieAnahtar = (string) $c['mollie_api_key'];
$ekle('Mollie anahtarı girilmiş', trim($mollieAnahtar) !== '',
    trim($mollieAnahtar) === '' ? 'config.php > mollie_api_key' : (str_starts_with(trim($mollieAnahtar), 'live_') ? 'CANLI anahtar' : 'test anahtarı'));
if (trim($mollieAnahtar) !== '') {
    $ekle('Mollie anahtarında boşluk yok', $mollieAnahtar === trim($mollieAnahtar),
        'başta/sonda boşluk kopyalanmış olabilir');
    $ekle('Mollie anahtar uzunluğu makul', strlen(trim($mollieAnahtar)) >= 30,
        strlen(trim($mollieAnahtar)) . ' karakter');
    [$kod, $yanit] = mollie('GET', 'methods');
    $yontemler = array_map(static fn ($m) => $m['id'] ?? '?', $yanit['_embedded']['methods'] ?? []);
    $ekle('Mollie bağlantısı', $kod === 200,
        $kod === 200 ? ('aktif yöntemler: ' . (implode(', ', $yontemler) ?: 'YOK — Mollie panosundan etkinleştirin'))
                     : ('HTTP ' . $kod . ' — ' . json_encode($yanit['detail'] ?? $yanit, JSON_UNESCAPED_UNICODE)));
    foreach (['bancontact', 'creditcard', 'applepay'] as $y) {
        if ($kod === 200) {
            $ekle('Yöntem aktif: ' . $y, in_array($y, $yontemler, true),
                in_array($y, $yontemler, true) ? '' : 'Mollie panosu > Ödeme yöntemleri bölümünden açın');
        }
    }
}

// Google anahtarlari
$gSunucu = trim((string) $c['google_server_key']);
$ekle('Google SUNUCU anahtarı (Distance Matrix)', $gSunucu !== '',
    $gSunucu === '' ? 'config.php > google_server_key (boşsa mesafe doğrulaması yapılamaz)' : strlen($gSunucu) . ' karakter');
$configJs = @file_get_contents(dirname(__DIR__) . '/assets/config.js');
$gTarayici = '';
if (is_string($configJs) && preg_match('/googleMapsKey\s*:\s*"([^"]*)"/', $configJs, $e)) {
    $gTarayici = trim($e[1]);
}
$ekle('Google TARAYICI anahtarı (assets/config.js)', $gTarayici !== '',
    $gTarayici === '' ? 'boşsa site dahili tahminle çalışır (yine de çalışır)' : strlen($gTarayici) . ' karakter');

// e-posta ayarlari
$ekle('Brevo API anahtarı', trim((string) $c['brevo_api_key']) !== '',
    trim((string) $c['brevo_api_key']) === '' ? 'boşsa PHP mail() kullanılır (spam riski)' : '');
$ekle('Gönderen adres ayarlı', filter_var($c['mail_from'], FILTER_VALIDATE_EMAIL) !== false, (string) $c['mail_from']);
$ekle('Şirket adresi ayarlı', filter_var($c['company_email'], FILTER_VALIDATE_EMAIL) !== false, (string) $c['company_email']);

// dil dosyalari
foreach (['fr', 'nl', 'en', 'tr'] as $d) {
    $ekle('Dil sayfası: /' . $d . '/', is_file(dirname(__DIR__) . '/' . $d . '/index.html'));
}
$ekle('pay/dil.php üretilmiş', is_file(__DIR__ . '/dil.php'), 'build.py üretir');

// ---- goruntu
header('Content-Type: text/html; charset=utf-8');
$satirlar = '';
$sorunSayisi = 0;
foreach ($kontroller as [$ad, $iyi, $detay]) {
    if (!$iyi) {
        $sorunSayisi++;
    }
    $isaret = $iyi
        ? '<span style="color:#4CAF50;font-weight:800">✓</span>'
        : '<span style="color:#FF5252;font-weight:800">✗</span>';
    $satirlar .= '<tr><td style="width:26px">' . $isaret . '</td><td>' . h($ad) . '</td>'
        . '<td style="color:#A8AAB3;font-size:13px">' . h($detay) . '</td></tr>';
}
?>
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<title>Kurulum tanılama · Europa Taxi</title>
<style>
body{background:#0A0A0C;color:#F4F4F6;font:400 15px/1.6 system-ui,sans-serif;margin:0;padding:24px;max-width:860px;margin-inline:auto}
h1{font-size:22px}h1 span{color:#FFC107}
.uyari{background:#B3261E22;border:1px solid #B3261E;color:#FFB4AE;border-radius:12px;padding:16px 18px;font-weight:700;margin:18px 0}
table{width:100%;border-collapse:collapse;background:#121215;border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden}
td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
.ozet{margin:16px 0;color:#A8AAB3}
button{background:linear-gradient(180deg,#FFC107,#E5A93C);border:0;color:#141005;font-weight:800;
padding:12px 22px;border-radius:10px;font-size:15px;cursor:pointer}
.sonuc{margin-top:10px;padding:12px;border-radius:10px;font-size:14px}
.sonuc.ok{background:#2E7D3222;border:1px solid #2E7D32;color:#A5D6A7}
.sonuc.hata{background:#B3261E22;border:1px solid #B3261E;color:#FFB4AE}
code{background:#1A1A1F;padding:2px 6px;border-radius:6px}
</style>
</head>
<body>
<h1>EUROPA<span>TAXI</span> · Kurulum tanılama</h1>
<div class="uyari">⚠️ KURULUM BİTİNCE BU DOSYAYI (pay/test.php) SUNUCUDAN SİLİN.
Bu sayfa yalnızca kurulum sırasında kullanılır.</div>
<p class="ozet"><?= $sorunSayisi === 0 ? 'Tüm kontroller yeşil ✅' : $sorunSayisi . ' madde ilgi bekliyor.' ?></p>
<table><?= $satirlar ?></table>

<h2 style="font-size:17px;margin-top:28px">Test e-postası</h2>
<form method="post">
  <button type="submit" name="eposta_testi" value="1">Test e-postası gönder → <?= h((string) $c['company_email']) ?></button>
</form>
<?php if ($postaSonucu !== null): ?>
  <div class="sonuc <?= $postaSonucu['ok'] ? 'ok' : 'hata' ?>">
    <?= $postaSonucu['ok']
        ? 'Gönderildi (' . h($postaSonucu['yontem']) . '). Gelen kutusunu ve spam klasörünü kontrol edin.'
        : 'Gönderilemedi: ' . h((string) $postaSonucu['hata']) ?>
  </div>
<?php endif; ?>
</body>
</html>
