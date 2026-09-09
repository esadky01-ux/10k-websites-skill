<?php
// ============================================================
// EUROPA TAXI — Mollie webhook'u (sartname §8)
// Mollie odeme durumu degisince buraya POST id=tr_... gonderir.
// POST verisine GUVENILMEZ: durum her zaman Mollie API'sinden sorulur.
// Sadece ILK kez "paid" olundugunda e-postalar gonderilir.
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/mailer.php';

// Mollie'ye her durumda hizli 200 donmek gerekir; icerik onemli degil.
http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');

$odemeId = (string) ($_POST['id'] ?? '');
if (!preg_match('/^tr_[A-Za-z0-9]+$/', $odemeId)) {
    echo 'gecersiz istek';
    exit;
}

// ---- durumu Mollie'den DOGRULA (POST'a guvenme)
[$kod, $odeme] = mollie('GET', 'payments/' . $odemeId);
if ($kod !== 200 || !isset($odeme['status'])) {
    kayit('Webhook: Mollie sorgusu basarisiz (' . $kod . ') ' . $odemeId);
    echo 'mollie ulasilamadi';
    exit;
}

$siparisNo = (string) ($odeme['metadata']['order_id'] ?? '');
$siparis = siparis_oku($siparisNo);
if ($siparis === null) {
    kayit('Webhook: siparis bulunamadi: ' . $siparisNo . ' (' . $odemeId . ')');
    echo 'siparis yok';
    exit;
}

// ---- siparis durumunu guncelle
$mollieDurum = (string) $odeme['status'];
$eslesme = [
    'paid'     => 'odendi',
    'expired'  => 'suresi_doldu',
    'canceled' => 'iptal',
    'failed'   => 'basarisiz',
];
$siparis['mollie_durum'] = $mollieDurum;
$siparis['durum'] = $eslesme[$mollieDurum] ?? 'beklemede';
$siparis['guncelleme'] = date('c');

// ---- sadece ILK odemede e-posta gonder (webhook tekrar gelebilir)
if ($mollieDurum === 'paid' && empty($siparis['eposta_gonderildi'])) {
    $i = isletme();
    $dil = dil_sec($siparis['dil']);

    // Musteriye: kendi dilinde HTML onay
    $sonuc1 = eposta_gonder(
        $siparis['eposta'],
        t($dil, 'em_subject', ['ref' => $siparis['no']]),
        musteri_eposta_html($siparis)
    );

    // Sirkete: duz metin is emri
    $isEmri = sirket_eposta_metni($siparis);
    $sonuc2 = eposta_gonder(
        (string) cfg()['company_email'],
        'Yeni rezervasyon · ' . $siparis['no'] . ' · ' . $siparis['alis'] . ' -> ' . $siparis['varis'],
        '<pre style="font-family:monospace;font-size:13px;">' . h($isEmri) . '</pre>',
        $isEmri
    );

    $siparis['eposta_gonderildi'] = true;
    $siparis['eposta_kaydi'] = [
        'zaman'   => date('c'),
        'musteri' => $sonuc1['yontem'] . ($sonuc1['ok'] ? '' : ' (BASARISIZ)'),
        'sirket'  => $sonuc2['yontem'] . ($sonuc2['ok'] ? '' : ' (BASARISIZ)'),
    ];
}

siparis_kaydet($siparis);
echo 'OK';
