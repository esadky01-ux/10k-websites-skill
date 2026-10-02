<?php
// ============================================================
// EUROPA TAXI — kurulum tanilama sayfasi (sartname §8)
// Kullanim: https://alan-adiniz/pay/test.php  -> yonetici sifresini FORMA yazin.
//
// Sifre URL'de OLMAZ: yalniz POST govdesindeki `pw` alani; ?pw= ASLA kabul edilmez. ADMIN sifresi bossa kapali.
// orders.php ile ayni giris kilidini (IP basina 5 basarisiz deneme -> 15 dk) ve ayni oturumu kullanir.
// Raporda gizli anahtarlarin DEGERI yoktur: yalniz ayarli/degil ve uzunluk.
// !!! KURULUM BITINCE BU DOSYAYI (pay/test.php) SUNUCUDAN SILIN !!!
// ============================================================
declare(strict_types=1);

@ini_set('display_errors', '0');   // dahil edilen dosyalar yuklenirken (ayristirma/yukleme hatasi) bile mutlak yol ekrana basilmasin

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/girdi.php';
require_once __DIR__ . '/mesafe.php';
require_once __DIR__ . '/mailer.php';

guvenlik_baslat('test');

const TEST_ADRESI = '/pay/test.php';

function test_giris_sayfasi(string $hata = '', int $kod = 200): never
{
    mini_sayfa('tr', 'Kurulum tanılama',
        ($hata !== '' ? '<p style="color:#FFB4AE">' . h($hata) . '</p>' : '')
        . '<form method="post" action="' . TEST_ADRESI . '">'
        . '<input type="hidden" name="csrf" value="' . h(csrf_belirteci()) . '">'
        . '<p><label style="font-size:13px;color:#A8AAB3">Yönetici şifresi (ADMIN_PASSWORD)</label><br>'
        . '<input type="password" name="pw" autofocus autocomplete="current-password"'
        . ' style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);'
        . 'background:#1A1A1F;color:#F4F4F6;font-size:16px;box-sizing:border-box"></p>'
        . '<div class="btnler"><button class="btn" type="submit" style="border:0;cursor:pointer;font-size:15px">Raporu göster</button></div>'
        . '</form><p class="ref">Şifre adres çubuğuna yazılmaz; yalnızca bu form ile gönderilir.</p>',
        0, '', $kod);
    exit;
}

function test_kilit_sayfasi(int $sn): never
{
    mini_sayfa('tr', 'Çok fazla deneme', '<p>Çok fazla hatalı giriş denemesi. Lütfen daha sonra tekrar deneyin.</p>',
        0, '', 429, ['Retry-After' => (string) max(1, $sn)]);
    exit;
}

$c = cfg();
if ($c['admin_password'] === '') {
    mini_sayfa('tr', 'Tanılama kapalı',
        '<p>Önce ortam değişkeni <code>ADMIN_PASSWORD</code> (ya da <code>pay/config.php</code> içinde <b>admin_password</b>) '
        . 'belirleyin. Şifre adrese yazılmaz; formla gönderilir.</p>', 0, '', 503);
    exit;
}
$yontem = (string) ($_SERVER['REQUEST_METHOD'] ?? '');
if (!in_array($yontem, ['GET', 'HEAD', 'POST'], true)) {
    http_response_code(405);
    header('Allow: GET, HEAD, POST');
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method Not Allowed';
    exit;
}

admin_oturum_baslat();
$ip = istemci_ip();
$eposta_testi = false;

if ($yontem === 'POST') {
    if (!kaynak_izinli()) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Forbidden';
        exit;
    }
    $govde = govde_oku();
    if ($govde === null) {
        http_response_code(413);
        header('Content-Type: text/plain; charset=utf-8');
        header('Connection: close');
        echo 'govde cok buyuk';
        exit;
    }
    $form = girdi_form_coz($govde);
    $pw = girdi_ilk($form, 'pw');
    if ($pw !== null) {
        // ---- sifreyle giris (kaba kuvvet korumali; orders.php ile ORTAK sayac)
        $kilit = kaba_kuvvet_kalan($ip);
        if ($kilit > 0) {
            test_kilit_sayfasi($kilit);
        }
        if (!csrf_dogru(girdi_ilk($form, 'csrf'))) {
            test_giris_sayfasi('Oturum süresi doldu; formu yeniden doldurun.', 403);
        }
        if (admin_sifre_dogru($pw)) {
            kaba_kuvvet_temizle($ip);
            admin_oturum_ac();
            header('Location: ' . TEST_ADRESI, true, 303);   // PRG: sifre tarayici gecmisinde/yenilemede tekrar gonderilmez
            exit;
        }
        $sonKilit = kaba_kuvvet_basarisiz($ip);
        kayit('uyari: test: hatali giris denemesi' . ($sonKilit > 0 ? ' (IP kilitlendi)' : ''));
        if ($sonKilit > 0) {
            test_kilit_sayfasi($sonKilit);
        }
        test_giris_sayfasi('Şifre hatalı.', 403);
    }
    if (admin_oturum_var()) {
        if (!csrf_dogru(girdi_ilk($form, 'csrf'))) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            echo 'Forbidden';
            exit;
        }
        $eposta_testi = girdi_ilk($form, 'eposta_testi') !== null;
    }
}

// GET (veya oturumlu POST): yalniz oturum; ?pw= ASLA okunmaz
if (!admin_oturum_var()) {
    test_giris_sayfasi();
}

// ---- test e-postasi
$postaSonucu = null;
if ($eposta_testi) {
    $postaSonucu = eposta_gonder(
        sirket_eposta(),
        'europetaxi24 kurulum testi',
        '<p>Bu bir kurulum test e-postasıdır. Bunu okuyorsanız e-posta ayarları çalışıyor.</p>',
        'Bu bir kurulum test e-postasidir.',
        null,
        'test'
    );
}

// ---- kontroller
$kontroller = [];
$ekle = static function (string $ad, bool $iyi, string $detay = '') use (&$kontroller): void {
    $kontroller[] = [$ad, $iyi, $detay];
};
$kaynakEtiketi = static fn (string $anahtar): string => ['ortam' => 'ortam değişkeni', 'config' => 'config.php', 'varsayilan' => 'varsayılan'][$c['_kaynak'][$anahtar] ?? 'varsayilan'];
$sir = static function (string $ad, string $anahtar, string $deger, bool $zorunlu, string $ek = '') use ($ekle, $kaynakEtiketi): void {
    $ayarli = $deger !== '';
    $detay = $ayarli ? 'ayarlı (' . strlen($deger) . ' karakter, kaynak: ' . $kaynakEtiketi($anahtar) . ')' : ($zorunlu ? 'AYARLI DEĞİL' : 'ayarlı değil');
    if ($ayarli && $ek !== '') {
        $detay .= ' — ' . $ek;
    }
    $ekle($ad, $ayarli || !$zorunlu, $detay);
};

// PHP + eklentiler
$ekle('PHP sürümü ≥ 8.1', PHP_VERSION_ID >= 80100, 'PHP ' . PHP_VERSION);
$ekle('cURL eklentisi', function_exists('curl_init'));
$ekle('JSON eklentisi', function_exists('json_encode'));
$ekle('mbstring eklentisi (zorunlu)', function_exists('mb_strlen'));
$ekle('intl eklentisi (Normalizer)', girdi_intl_var(),
    girdi_intl_var() ? '' : 'yok: yedek unicode tablosu kullanılır (sorun değil); Combell panelinden intl açılabilir');
$ekle('OpenSSL', extension_loaded('openssl'));

// HTTPS
$ekle('site_url https', str_starts_with($c['site_url'], 'https://'),
    str_starts_with($c['site_url'], 'https://') ? '' : 'canlıda https:// kullanın (Secure çerez ve Mollie için gerekli)');
$ekle('Bu istek HTTPS ile geldi', (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'),
    'SSL sertifikasını (Let\'s Encrypt) etkinleştirin');

// siparis klasoru
$bilgi = siparis_klasoru_bilgi();
$klasor = $bilgi['yol'];
$deneme = @file_put_contents($klasor . '/yazma-testi.tmp', 'ok');
if ($deneme !== false) {
    @unlink($klasor . '/yazma-testi.tmp');
}
$klasorAdi = '…/' . basename($klasor);   // mutlak yol gosterilmez (yalniz klasor adi)
$ekle('Sipariş klasörü yazılabilir', $deneme !== false, $klasorAdi);
$ekle('Sipariş klasörü web kökünün DIŞINDA', $bilgi['web_disi'],
    $bilgi['web_disi'] ? $klasorAdi : 'KIRMIZI UYARI: kişisel veriler web kökünün içinde ('
        . ($bilgi['yedek'] ? 'varsayılan konum yazılamadı, pay/orders/\'a düşüldü' : 'orders_dir web kökü içinde')
        . '); yalnızca .htaccess koruyor. www/ klasorunun bir üstünde et-siparisler/ olusturup yazma izni verin veya ORDERS_DIR tanimlayin');
$izin = @fileperms($klasor);
$ekle('Sipariş klasörü izni 0700', $izin !== false && ($izin & 0077) === 0, $izin === false ? '?' : substr(sprintf('%o', $izin), -4));
$ekle('Sipariş klasörü .htaccess kilidi', is_file($klasor . '/.htaccess'));
$payHt = @file_get_contents(__DIR__ . '/.htaccess');
$ekle('pay/.htaccess beyaz liste kilidi', is_string($payHt) && str_contains($payHt, 'Require all denied') && str_contains($payHt, 'create|webhook|success|orders|test'),
    is_string($payHt) ? '' : 'pay/.htaccess YOK: yapılandırma ve siparişler web\'den okunabilir olabilir');
$rlOk = true;
try {
    rl_klasoru();
} catch (\Throwable) {
    $rlOk = false;
}
$ekle('Oran sınırı klasörü (rl/) yazılabilir', $rlOk);
$ob = (string) ini_get('open_basedir');
$ekle('open_basedir', true, $ob === '' ? 'kapalı (sınırsız)' : 'AÇIK: ' . $ob . ' — sipariş klasörü bu yolların içinde olmalı (yazılabilirlik testi yukarıda geçtiyse sorun yok)');
$ekle('display_errors kapalı (uygulama zaten kapatır)', true, 'php.ini: ' . (string) ini_get('display_errors'));

// yapilandirma degerleri (DEGER gosterilmez)
$sir('MOLLIE_API_KEY', 'mollie_api_key', $c['mollie_api_key'], true,
    str_starts_with($c['mollie_api_key'], 'live_') ? 'CANLI anahtar' : (str_starts_with($c['mollie_api_key'], 'test_') ? 'test anahtarı' : 'test_/live_ ile başlamıyor'));
$sir('BREVO_API_KEY', 'brevo_api_key', $c['brevo_api_key'], false, '');
if ($c['brevo_api_key'] === '') {
    $ekle('Brevo anahtarı', false, 'boşsa PHP mail() kullanılır (spam riski)');
}
$sir('GOOGLE_SERVER_KEY', 'google_server_key', $c['google_server_key'], false);
$sir('ADMIN_PASSWORD', 'admin_password', $c['admin_password'], true, strlen($c['admin_password']) < 12 ? 'UYARI: 12 karakterden kısa' : '');
$ekle('ADMIN_PASSWORD ≥ 12 karakter', strlen($c['admin_password']) >= 12);
$ekle('SITE_URL', true, $c['site_url'] . ' (' . $kaynakEtiketi('site_url') . ')');
$ekle('DISTANCE_TOLERANCE_PCT', true, '%' . $c['distance_tolerance_pct']);
$ekle('TRUSTED_PROXY_HEADER', true, $c['trusted_proxy_header'] !== '' ? $c['trusted_proxy_header'] . ' (oran sınırı bu başlığın ilk geçerli IP\'sini kullanır)'
    : 'ayarlı değil: REMOTE_ADDR kullanılır (ters vekil arkasındaysanız tüm istekler tek IP görünür)');
foreach ([['MOLLIE_API_BASE', 'mollie_api_base'], ['BREVO_API_BASE', 'brevo_api_base'], ['GOOGLE_API_BASE', 'google_api_base']] as [$ad, $anahtar]) {
    if (($c['_kaynak'][$anahtar] ?? 'varsayilan') !== 'varsayilan') {
        $ekle($ad, $c[$anahtar] !== null,
            $c[$anahtar] === null ? 'GEÇERSİZ (yalnız https:// veya http://127.0.0.1) — çağrılar reddedilir' : 'TEST TABANI: ' . $c[$anahtar] . ' (canlıda tanımlamayın)');
    }
}
$ekle('Gönderen adres (mail_from) ayarlı', girdi_eposta_gecerli(mail_gonderen()), mail_gonderen());
$ekle('Şirket adresi (company_email) ayarlı', girdi_eposta_gecerli(sirket_eposta()), sirket_eposta());

// Mollie: baglanti + aktif yontemler
if ($c['mollie_api_key'] !== '') {
    $ekle('Mollie anahtarında boşluk yok', ortam('MOLLIE_API_KEY') === '' || ortam('MOLLIE_API_KEY') === trim(ortam('MOLLIE_API_KEY')));
    $ekle('Mollie anahtar uzunluğu makul', strlen($c['mollie_api_key']) >= 30, strlen($c['mollie_api_key']) . ' karakter');
    [$kod, $yanit] = mollie('GET', 'methods');
    $yontemler = array_map(static fn ($m) => is_array($m) ? (string) ($m['id'] ?? '?') : '?', (array) ($yanit['_embedded']['methods'] ?? []));
    $ekle('Mollie bağlantısı', $kod === 200,
        $kod === 200 ? 'aktif yöntemler: ' . ($yontemler !== [] ? implode(', ', $yontemler) : 'YOK — Mollie panosundan etkinleştirin')
            : 'HTTP ' . $kod . (isset($yanit['detail']) && is_string($yanit['detail']) ? ' — ' . substr($yanit['detail'], 0, 120) : ''));
    if ($kod === 200) {
        foreach ($c['methods'] as $y) {
            $ekle('Yöntem aktif: ' . $y, in_array($y, $yontemler, true),
                in_array($y, $yontemler, true) ? '' : 'Mollie panosu > Ödeme yöntemleri bölümünden açın');
        }
    }
}

// Google
if ($c['google_server_key'] === '') {
    $ekle('Google SUNUCU anahtarı (Distance Matrix)', false, 'boşsa mesafe yalnızca dahili tabloyla doğrulanır (tanınmayan adresler reddedilir, müşteri WhatsApp\'a yönlendirilir)');
} elseif ($c['google_api_base'] === null) {
    $ekle('Google erişilebilirliği', false, 'google_api_base geçersiz');
} else {
    $km = google_km('Brussels', 'Gent');
    $ekle('Google Distance Matrix erişilebilirliği', $km !== null, $km !== null ? 'Brussels → Gent: ' . $km . ' km' : 'yanıt alınamadı (anahtar/kısıtlama/faturalandırma?)');
}
$configJs = @file_get_contents(dirname(__DIR__) . '/assets/config.js');
$gTarayici = '';
if (is_string($configJs) && preg_match('/googleMapsKey\s*:\s*"([^"]*)"/', $configJs, $e)) {
    $gTarayici = trim($e[1]);
}
$ekle('Google TARAYICI anahtarı (assets/config.js)', $gTarayici !== '',
    $gTarayici === '' ? 'boşsa site dahili tahminle çalışır (yine de çalışır)' : strlen($gTarayici) . ' karakter');

// Brevo erisimi
if ($c['brevo_api_key'] !== '') {
    if ($c['brevo_api_base'] === null) {
        $ekle('Brevo erişilebilirliği', false, 'brevo_api_base geçersiz');
    } else {
        $ch = curl_init($c['brevo_api_base'] . '/account');
        if ($ch !== false) {
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_HTTPHEADER => ['api-key: ' . $c['brevo_api_key'], 'Accept: application/json']]);
            $r = curl_exec($ch);
            $bk = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $ekle('Brevo erişilebilirliği', $r !== false && $bk === 200,
                $r === false ? 'bağlantı hatası (curl ' . curl_errno($ch) . ')' : ($bk === 200 ? 'anahtar geçerli' : 'HTTP ' . $bk . ($bk === 401 ? ' — anahtar geçersiz' : '')));
        }
    }
}

// dil / veri dosyalari
foreach (['fr', 'nl', 'en', 'tr'] as $d) {
    $ekle('Dil sayfası: /' . $d . '/', is_file(dirname(__DIR__) . '/' . $d . '/index.html'));
}
$ekle('pay/dil.php üretilmiş', is_file(__DIR__ . '/dil.php'), 'build.py üretir');
$ekle('pay/isletme.php üretilmiş', is_file(__DIR__ . '/isletme.php'), 'build.py üretir');
$yerSayisi = count(mesafe_veri()['yerler']);
$ekle('Mesafe verisi (pay/mesafe.json) yüklü', $yerSayisi > 50, $yerSayisi . ' yer (build.py üretir)');

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
$kirmizi = '';
if (!$bilgi['web_disi']) {
    $kirmizi = '<div class="uyari">🔴 KIRMIZI UYARI: sipariş klasörü web kökünün İÇİNDE. Kişisel veriler (ad, e-posta, telefon) yalnızca .htaccess ile korunuyor; '
        . 'sunucu .htaccess\'i yok sayarsa (ör. nginx) dosyalar indirilebilir. Klasörü web kökünün dışına taşıyın (ORDERS_DIR).</div>';
}
?>
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<title>Kurulum tanılama · europetaxi24</title>
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
<h1>EUROPETAXI<span>24</span> · Kurulum tanılama</h1>
<div class="uyari">⚠️ KURULUM BİTİNCE BU DOSYAYI (pay/test.php) SUNUCUDAN SİLİN.
Bu sayfa yalnızca kurulum sırasında kullanılır.</div>
<?= $kirmizi ?>
<p class="ozet"><?= $sorunSayisi === 0 ? 'Tüm kontroller yeşil ✅' : $sorunSayisi . ' madde ilgi bekliyor.' ?></p>
<table><?= $satirlar ?></table>

<h2 style="font-size:17px;margin-top:28px">Test e-postası</h2>
<form method="post" action="<?= TEST_ADRESI ?>">
  <input type="hidden" name="csrf" value="<?= h(csrf_belirteci()) ?>">
  <button type="submit" name="eposta_testi" value="1">Test e-postası gönder → <?= h(sirket_eposta()) ?></button>
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
