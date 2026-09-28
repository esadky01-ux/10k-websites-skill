<?php
// ============================================================
// EUROPA TAXI — sifreli rezervasyon paneli (sartname §8)
// Liste, odendi/bekliyor/sorunlu suzgecleri, toplam tahsilat, tiklanabilir telefon, aracta tahsil edilecek tutar,
// "Veri temizligi" (temizle.php). Panel dili Turkce (isletme ici).
//
// Guvenlik: ADMIN_PASSWORD bossa KAPALI; giris formu + cikis + temizlik POST'lari CSRF belirteclidir;
// oturum cerezi et_admin (Secure[https], HttpOnly, SameSite=Strict, path=/pay/, 12 saat, strict mode);
// sifre hash_equals ile; IP basina 5 basarisiz denemeden sonra 15 dk kilit (sleep() YOK); tum degerler h() ile kacislanir.
// ============================================================
declare(strict_types=1);

@ini_set('display_errors', '0');   // dahil edilen dosyalar yuklenirken (ayristirma/yukleme hatasi) bile mutlak yol ekrana basilmasin

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/girdi.php';
require_once __DIR__ . '/temizle.php';

guvenlik_baslat('orders');

const PANEL_ADRESI = '/pay/orders.php';
const PANEL_EN_FAZLA = 1000;

/** Giris formu (CSRF belirteci ile). */
function orders_giris_formu(string $hata = '', int $kod = 200, array $ek = []): never
{
    mini_sayfa('tr', 'Rezervasyon paneli',
        ($hata !== '' ? '<p style="color:#FFB4AE">' . h($hata) . '</p>' : '')
        . '<form method="post" action="' . PANEL_ADRESI . '">'
        . '<input type="hidden" name="csrf" value="' . h(csrf_belirteci()) . '">'
        . '<p><label style="font-size:13px;color:#A8AAB3">Şifre</label><br>'
        . '<input type="password" name="pw" autofocus autocomplete="current-password"'
        . ' style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);'
        . 'background:#1A1A1F;color:#F4F4F6;font-size:16px;box-sizing:border-box"></p>'
        . '<div class="btnler"><button class="btn" type="submit" style="border:0;cursor:pointer;font-size:15px">Giriş</button></div>'
        . '</form>',
        0, '', $kod, $ek);
    exit;
}

function orders_kilit_sayfasi(int $sn): never
{
    mini_sayfa('tr', 'Çok fazla deneme', '<p>Çok fazla hatalı giriş denemesi. Lütfen daha sonra tekrar deneyin.</p>',
        0, '', 429, ['Retry-After' => (string) max(1, $sn)]);
    exit;
}

/** Durum rozeti; bilinmeyen durumlar da KACISLANIR. */
function orders_rozet(string $durum): string
{
    $renk = [
        'odendi' => '#2E7D32', 'beklemede' => '#8a6d00', 'basarisiz' => '#B3261E', 'iptal' => '#B3261E',
        'suresi_doldu' => '#B3261E', 'odeme_baslatilamadi' => '#B3261E', 'iade' => '#B3261E',
        'chargeback' => '#B3261E', 'tutar_uyusmazligi' => '#B3261E',
    ][$durum] ?? '#55565E';
    $ad = [
        'odendi' => 'ÖDENDİ', 'beklemede' => 'BEKLİYOR', 'basarisiz' => 'BAŞARISIZ', 'iptal' => 'İPTAL',
        'suresi_doldu' => 'SÜRESİ DOLDU', 'odeme_baslatilamadi' => 'BAŞLATILAMADI', 'iade' => 'İADE',
        'chargeback' => 'GERİ ÖDEME', 'tutar_uyusmazligi' => 'TUTAR UYUŞMUYOR',
    ][$durum] ?? mb_strtoupper($durum);
    return '<span style="background:' . $renk . '22;color:' . $renk . ';border:1px solid ' . $renk . '55;'
        . 'padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;white-space:nowrap">' . h($ad) . '</span>';
}

function orders_sekme(string $kod, string $ad, int $sayi, string $aktif): string
{
    $secili = $kod === $aktif ? 'background:#FFC107;color:#141005' : 'color:#A8AAB3;border:1px solid rgba(255,255,255,.15)';
    return '<a style="padding:8px 16px;border-radius:99px;text-decoration:none;font-size:13px;font-weight:700;' . $secili . '"'
        . ' href="' . PANEL_ADRESI . '?f=' . h($kod) . '">' . h($ad) . ' (' . $sayi . ')</a>';
}

/** POST formu (CSRF belirteci ile) tek dugmeli. */
function orders_dugme_formu(string $eylem, string $etiket, string $stil = ''): string
{
    return '<form method="post" action="' . PANEL_ADRESI . '" style="display:inline">'
        . '<input type="hidden" name="csrf" value="' . h(csrf_belirteci()) . '">'
        . '<input type="hidden" name="eylem" value="' . h($eylem) . '">'
        . '<button type="submit" style="' . $stil . 'cursor:pointer;border-radius:99px;padding:8px 16px;font-size:13px;font-weight:700;'
        . 'background:none;color:#A8AAB3;border:1px solid rgba(255,255,255,.15)">' . h($etiket) . '</button></form>';
}

// ---- yapilandirma / yontem
if (cfg()['admin_password'] === '') {
    mini_sayfa('tr', 'Panel kapalı',
        '<p>Önce ortam değişkeni <code>ADMIN_PASSWORD</code> (ya da <code>pay/config.php</code> içinde <b>admin_password</b>) '
        . 'alanına güçlü bir şifre yazın.</p>', 0, '', 503);
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
$temizlikOzeti = null;

// ================================================================ POST: giris / cikis / temizlik
if ($yontem === 'POST') {
    if (!kaynak_izinli()) {
        kayit('uyari: orders: Origin/Referer reddedildi');
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
        // ---- giris denemesi
        $kilit = kaba_kuvvet_kalan($ip);
        if ($kilit > 0) {
            orders_kilit_sayfasi($kilit);
        }
        if (!csrf_dogru(girdi_ilk($form, 'csrf'))) {
            orders_giris_formu('Oturum süresi doldu; formu yeniden doldurun.', 403);
        }
        if (admin_sifre_dogru($pw)) {
            kaba_kuvvet_temizle($ip);
            admin_oturum_ac();
            kayit('bilgi: orders: yonetici girisi basarili');
            header('Location: ' . PANEL_ADRESI, true, 303);
            exit;
        }
        $sonKilit = kaba_kuvvet_basarisiz($ip);
        kayit('uyari: orders: hatali giris denemesi' . ($sonKilit > 0 ? ' (IP kilitlendi)' : ''));
        if ($sonKilit > 0) {
            orders_kilit_sayfasi($sonKilit);   // 5. yanlis deneme dahil
        }
        orders_giris_formu('Şifre hatalı.', 401);
    }

    if (admin_oturum_var()) {
        if (!csrf_dogru(girdi_ilk($form, 'csrf'))) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            echo 'Forbidden';
            exit;
        }
        $eylem = (string) (girdi_ilk($form, 'eylem') ?? '');
        if ($eylem === 'cikis') {
            admin_oturum_kapat();
            header('Location: ' . PANEL_ADRESI, true, 303);
            exit;
        }
        if ($eylem === 'temizle' || $eylem === 'temizle_kuru') {
            $temizlikOzeti = temizle_calistir($eylem === 'temizle_kuru');
        }
        // baska eylem: paneli goster
    }
}

// ================================================================ oturum yoksa giris formu
if (!admin_oturum_var()) {
    orders_giris_formu();
}

// ================================================================ panel
$f = $_GET['f'] ?? '';
$suzgec = is_string($f) && in_array($f, ['odendi', 'beklemede', 'sorunlu'], true) ? $f : 'hepsi';
$siparisler = [];
$kesildi = false;
foreach (siparis_dosyalari() as $no => $yol) {
    if (count($siparisler) >= PANEL_EN_FAZLA) {
        $kesildi = true;
        break;
    }
    $s = siparis_oku($no);
    if ($s !== null) {
        $siparisler[] = $s;
    }
}
usort($siparisler, static fn (array $a, array $b): int =>
    strcmp((string) ($b['olusturma'] ?? ''), (string) ($a['olusturma'] ?? '')));

$sorunlu = ['iade', 'chargeback', 'tutar_uyusmazligi'];
$toplamTahsilat = 0.0;   // odenen kaporalar (yalniz 'odendi': iade/geri odeme/uyusmazlik tahsilata SAYILMAZ)
$beklenenAracta = 0.0;   // odendi durumundaki siparislerde aracta alinacak
$odendiSayi = 0;
$bekleyenSayi = 0;
$sorunluSayi = 0;
foreach ($siparisler as $s) {
    $d = (string) ($s['durum'] ?? '');
    if ($d === 'odendi') {
        $odendiSayi++;
        $toplamTahsilat += (float) ($s['kapora'] ?? 0);
        $beklenenAracta += (float) ($s['kalan'] ?? 0);
    } elseif ($d === 'beklemede') {
        $bekleyenSayi++;
    } elseif (in_array($d, $sorunlu, true)) {
        $sorunluSayi++;
    }
}

$gosterilecek = array_values(array_filter($siparisler, static function (array $s) use ($suzgec, $sorunlu): bool {
    $d = (string) ($s['durum'] ?? '');
    return $suzgec === 'hepsi' || ($suzgec === 'sorunlu' ? in_array($d, $sorunlu, true) : $d === $suzgec);
}));

$satirlar = '';
foreach ($gosterilecek as $s) {
    $tel = preg_replace('/\D/', '', (string) ($s['telefon'] ?? '')) ?? '';
    $donus = !empty($s['donus_tarih'])
        ? '<br><small style="color:#6E7080">↩ ' . h(tarih_goster('tr', (string) $s['donus_tarih'], (string) ($s['donus_saat'] ?? ''))) . '</small>'
        : '';
    $durum = (string) ($s['durum'] ?? '');
    $posta = '';
    if (in_array($durum, DURUM_ODENMIS, true)) {
        $b = siparis_eposta_bayraklari($s);
        $posta = '<br><small style="color:#6E7080">✉ müşteri ' . ($b['musteri'] ? '✓' : '✗') . ' · şirket ' . ($b['sirket'] ? '✓' : '✗') . '</small>';
    }
    $not = '';
    if ($durum === 'tutar_uyusmazligi') {
        $not = '<br><small style="color:#FFB4AE">⚠ ödenen tutar beklenenle uyuşmuyor (' . h((string) ($s['odenen_tutar'] ?? '?')) . ')</small>';
    }
    if (!empty($s['anonim'])) {
        $not .= '<br><small style="color:#6E7080">anonimleştirildi</small>';
    }
    $satirlar .= '<tr>'
        . '<td><b>' . h($s['no'] ?? '') . '</b><br><small style="color:#6E7080">' . h(substr((string) ($s['olusturma'] ?? ''), 0, 16)) . '</small></td>'
        . '<td>' . h($s['alis'] ?? '') . ' → ' . h($s['varis'] ?? '')
        . '<br><small style="color:#A8AAB3">' . h(tarih_goster('tr', (string) ($s['tarih'] ?? ''), (string) ($s['saat'] ?? ''))) . $donus . '</small></td>'
        . '<td>' . h($s['ad'] ?? '') . '<br><a style="color:#FFC107" href="tel:+' . h($tel) . '">' . h($s['telefon'] ?? '') . '</a></td>'
        . '<td style="text-align:right">' . h(para('tr', (float) ($s['toplam'] ?? 0)))
        . '<br><small style="color:#A8AAB3">kapora ' . h(para('tr', (float) ($s['kapora'] ?? 0))) . '</small>'
        . '<br><b style="color:#FFC107">araçta ' . h(para('tr', (float) ($s['kalan'] ?? 0))) . '</b>' . $not . '</td>'
        . '<td>' . h($s['yolcu'] ?? '') . ' yolcu<br><small style="color:#A8AAB3">'
        . h($s['buyuk'] ?? '') . 'B + ' . h($s['kucuk'] ?? '') . 'K · ' . h($s['arac'] ?? '') . ' · ' . h($s['km'] ?? '') . ' km</small></td>'
        . '<td>' . orders_rozet($durum) . $posta . '</td>'
        . '</tr>';
}
if ($satirlar === '') {
    $satirlar = '<tr><td colspan="6" style="text-align:center;color:#6E7080;padding:40px">Kayıt yok</td></tr>';
}

$uyari = '';
$bilgi = siparis_klasoru_bilgi();
if (!$bilgi['web_disi']) {
    $uyari .= '<div class="uyari kirmizi">⚠ Sipariş klasörü web kökünün İÇİNDE: kişisel veriler yalnızca .htaccess ile korunuyor. '
        . 'Yapılandırmada <code>orders_dir</code> / ORDERS_DIR ile web kökünün dışında bir klasör verin (test.php ayrıntıyı gösterir).</div>';
}
if ($kesildi) {
    $uyari .= '<div class="uyari">Yalnızca en yeni ' . PANEL_EN_FAZLA . ' rezervasyon gösteriliyor.</div>';
}
if ($temizlikOzeti !== null) {
    $uyari .= '<div class="uyari"><b>Veri temizliği</b><pre style="white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 monospace">'
        . h(temizle_ozet_metni($temizlikOzeti)) . '</pre></div>';
}

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<title>Rezervasyonlar · Europa Taxi</title>
<style>
body{background:#0A0A0C;color:#F4F4F6;font:400 15px/1.5 system-ui,sans-serif;margin:0;padding:24px}
.ust{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}
h1{font-size:20px;margin:0}h1 span{color:#FFC107}
.kartlar{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.kart{background:#121215;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:14px 20px}
.kart b{display:block;font-size:22px;color:#FFC107}
.kart span{font-size:12px;color:#A8AAB3;text-transform:uppercase;letter-spacing:.5px}
table{width:100%;border-collapse:collapse;background:#121215;border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden}
th{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#6E7080;text-align:left;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.09)}
td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
tr:hover td{background:rgba(255,255,255,.02)}
.tablo-sar{overflow-x:auto}
.cikis{margin-left:auto}
.uyari{background:#8a6d0022;border:1px solid #8a6d00;color:#FFE08A;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:14px}
.uyari.kirmizi{background:#B3261E22;border-color:#B3261E;color:#FFB4AE;font-weight:700}
code{background:#1A1A1F;padding:2px 6px;border-radius:6px}
.alt{margin-top:28px;color:#A8AAB3;font-size:13px}
.alt p{margin:0 0 8px}
</style>
</head>
<body>
<div class="ust">
  <h1>EUROPA<span>TAXI</span> · Rezervasyonlar</h1>
  <?= orders_sekme('hepsi', 'Hepsi', count($siparisler), $suzgec) ?>
  <?= orders_sekme('odendi', 'Ödendi', $odendiSayi, $suzgec) ?>
  <?= orders_sekme('beklemede', 'Bekliyor', $bekleyenSayi, $suzgec) ?>
  <?= orders_sekme('sorunlu', 'Sorunlu', $sorunluSayi, $suzgec) ?>
  <span class="cikis"><?= orders_dugme_formu('cikis', 'Çıkış') ?></span>
</div>
<?= $uyari ?>
<div class="kartlar">
  <div class="kart"><b><?= h(para('tr', $toplamTahsilat)) ?></b><span>Tahsil edilen kapora</span></div>
  <div class="kart"><b><?= h(para('tr', $beklenenAracta)) ?></b><span>Araçta beklenen</span></div>
  <div class="kart"><b><?= $odendiSayi ?></b><span>Ödenmiş rezervasyon</span></div>
</div>
<div class="tablo-sar">
<table>
  <tr><th>Referans</th><th>Güzergâh</th><th>Müşteri</th><th style="text-align:right">Tutar</th><th>Detay</th><th>Durum</th></tr>
  <?= $satirlar ?>
</table>
</div>
<div class="alt">
  <p><b>Veri temizliği</b> — ödenmemiş siparişler 30 gün sonra silinir; ödenmiş siparişlerde kişisel alanlar yolculuktan 12 ay sonra
  anonimleştirilir (referans, tarih ve tutarlar 7 yıl saklanır); kayit.log 90 günden eski satırları atılır.</p>
  <?= orders_dugme_formu('temizle_kuru', 'Önizle (hiçbir şey silinmez)') ?>
  <?= orders_dugme_formu('temizle', 'Temizliği çalıştır') ?>
</div>
</body>
</html>
