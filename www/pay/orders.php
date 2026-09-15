<?php
// ============================================================
// EUROPA TAXI — sifreli rezervasyon paneli (sartname §8)
// Liste, odendi/bekliyor suzgecleri, toplam tahsilat, tiklanabilir
// telefon, aracta tahsil edilecek tutar. Panel dili Turkce (isletme ici).
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';

session_start();

$sifre = (string) cfg()['admin_password'];
if ($sifre === '') {
    mini_sayfa('tr', 'Panel kapalı',
        '<p>Önce <code>pay/config.php</code> içinde <b>admin_password</b> alanına güçlü bir şifre yazın.</p>');
    exit;
}

// ---- cikis
if (isset($_GET['cikis'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: orders.php');
    exit;
}

// ---- giris
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['pw'])) {
    if (hash_equals($sifre, (string) $_POST['pw'])) {
        session_regenerate_id(true);
        $_SESSION['giris'] = true;
    } else {
        sleep(1); // kaba kuvvet yavaslatma
    }
    header('Location: orders.php');
    exit;
}

if (empty($_SESSION['giris'])) {
    mini_sayfa('tr', 'Rezervasyon paneli',
        '<form method="post">
           <p><label style="font-size:13px;color:#A8AAB3">Şifre</label><br>
           <input type="password" name="pw" autofocus
             style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);
                    background:#1A1A1F;color:#F4F4F6;font-size:16px"></p>
           <div class="btnler"><button class="btn" type="submit" style="border:0;cursor:pointer;font-size:15px">Giriş</button></div>
         </form>');
    exit;
}

// ---- siparisleri oku
$suzgec = in_array($_GET['f'] ?? '', ['odendi', 'beklemede'], true) ? $_GET['f'] : 'hepsi';
$siparisler = [];
foreach (glob(siparis_klasoru() . '/ET-*.json') ?: [] as $dosya) {
    $s = json_decode((string) file_get_contents($dosya), true);
    if (is_array($s)) {
        $siparisler[] = $s;
    }
}
usort($siparisler, static fn (array $a, array $b): int =>
    strcmp((string) ($b['olusturma'] ?? ''), (string) ($a['olusturma'] ?? '')));

$toplamTahsilat = 0.0;   // odenen kaporalar
$beklenenAracta = 0.0;   // odendi durumundaki siparislerde aracta alinacak
$odendiSayi = 0;
$bekleyenSayi = 0;
foreach ($siparisler as $s) {
    if (($s['durum'] ?? '') === 'odendi') {
        $odendiSayi++;
        $toplamTahsilat += (float) ($s['kapora'] ?? 0);
        $beklenenAracta += (float) ($s['kalan'] ?? 0);
    } elseif (($s['durum'] ?? '') === 'beklemede') {
        $bekleyenSayi++;
    }
}

$gosterilecek = array_values(array_filter($siparisler, static function (array $s) use ($suzgec): bool {
    return $suzgec === 'hepsi' || ($s['durum'] ?? '') === $suzgec;
}));

$rozet = static function (string $durum): string {
    $renk = ['odendi' => '#2E7D32', 'beklemede' => '#8a6d00', 'basarisiz' => '#B3261E',
             'iptal' => '#B3261E', 'suresi_doldu' => '#B3261E', 'odeme_baslatilamadi' => '#B3261E'][$durum] ?? '#55565E';
    $ad = ['odendi' => 'ÖDENDİ', 'beklemede' => 'BEKLİYOR', 'basarisiz' => 'BAŞARISIZ',
           'iptal' => 'İPTAL', 'suresi_doldu' => 'SÜRESİ DOLDU', 'odeme_baslatilamadi' => 'BAŞLATILAMADI'][$durum] ?? mb_strtoupper($durum);
    return '<span style="background:' . $renk . '22;color:' . $renk . ';border:1px solid ' . $renk . '55;'
        . 'padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;white-space:nowrap">' . $ad . '</span>';
};

$satirlar = '';
foreach ($gosterilecek as $s) {
    $tel = preg_replace('/\D/', '', (string) ($s['telefon'] ?? ''));
    $donus = !empty($s['donus_tarih']) ? '<br><small style="color:#6E7080">↩ ' . h(tarih_goster('tr', $s['donus_tarih'], $s['donus_saat'] ?? '')) . '</small>' : '';
    $satirlar .= '<tr>'
        . '<td><b>' . h((string) $s['no']) . '</b><br><small style="color:#6E7080">' . h(substr((string) ($s['olusturma'] ?? ''), 0, 16)) . '</small></td>'
        . '<td>' . h((string) $s['alis']) . ' → ' . h((string) $s['varis'])
        . '<br><small style="color:#A8AAB3">' . h(tarih_goster('tr', (string) $s['tarih'], (string) $s['saat'])) . $donus . '</small></td>'
        . '<td>' . h((string) $s['ad']) . '<br><a style="color:#FFC107" href="tel:+' . h($tel) . '">' . h((string) $s['telefon']) . '</a></td>'
        . '<td style="text-align:right">' . h(para('tr', (float) $s['toplam']))
        . '<br><small style="color:#A8AAB3">kapora ' . h(para('tr', (float) $s['kapora'])) . '</small>'
        . '<br><b style="color:#FFC107">araçta ' . h(para('tr', (float) $s['kalan'])) . '</b></td>'
        . '<td>' . h((string) $s['yolcu']) . ' yolcu<br><small style="color:#A8AAB3">'
        . h((string) $s['buyuk']) . 'B + ' . h((string) $s['kucuk']) . 'K · ' . h((string) $s['arac']) . '</small></td>'
        . '<td>' . $rozet((string) ($s['durum'] ?? '')) . '</td>'
        . '</tr>';
}
if ($satirlar === '') {
    $satirlar = '<tr><td colspan="6" style="text-align:center;color:#6E7080;padding:40px">Kayıt yok</td></tr>';
}

$sekme = static function (string $kod, string $ad, int $sayi, string $aktif): string {
    $secili = $kod === $aktif ? 'background:#FFC107;color:#141005' : 'color:#A8AAB3;border:1px solid rgba(255,255,255,.15)';
    return '<a style="padding:8px 16px;border-radius:99px;text-decoration:none;font-size:13px;font-weight:700;' . $secili . '"'
        . ' href="orders.php?f=' . $kod . '">' . $ad . ' (' . $sayi . ')</a>';
};

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
a.cikis{margin-left:auto;color:#6E7080;font-size:13px}
</style>
</head>
<body>
<div class="ust">
  <h1>EUROPA<span>TAXI</span> · Rezervasyonlar</h1>
  <?= $sekme('hepsi', 'Hepsi', count($siparisler), $suzgec) ?>
  <?= $sekme('odendi', 'Ödendi', $odendiSayi, $suzgec) ?>
  <?= $sekme('beklemede', 'Bekliyor', $bekleyenSayi, $suzgec) ?>
  <a class="cikis" href="orders.php?cikis=1">Çıkış</a>
</div>
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
</body>
</html>
