<?php
// ============================================================
// EUROPA TAXI — odeme donus sayfasi (sartname §8)
// Webhook birkac saniye gecikebilir; musteriye yanlislikla
// "odeme tamamlanmadi" GOSTERILMEZ: durum Mollie'den CANLI sorulur.
// 4 dilde, marka gorunumunde, noindex.
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';

$siparisNo = (string) ($_GET['order'] ?? '');
$siparis = siparis_oku($siparisNo);
if ($siparis === null) {
    mini_sayfa('fr', t('fr', 'err_t'),
        '<p>' . h(t('fr', 'err_pay')) . '</p>'
        . '<div class="btnler"><a class="btn btn--dis" href="/fr/">' . h(t('fr', 'succ_home')) . '</a></div>');
    exit;
}

$dil = dil_sec($siparis['dil']);

// ---- durumu Mollie'den canli sorgula (anahtar ve odeme kaydi varsa)
if (!empty($siparis['mollie_id']) && trim((string) cfg()['mollie_api_key']) !== '') {
    [$kod, $odeme] = mollie('GET', 'payments/' . $siparis['mollie_id']);
    if ($kod === 200 && isset($odeme['status'])) {
        $eslesme = ['paid' => 'odendi', 'expired' => 'suresi_doldu', 'canceled' => 'iptal', 'failed' => 'basarisiz'];
        $siparis['mollie_durum'] = (string) $odeme['status'];
        $siparis['durum'] = $eslesme[$odeme['status']] ?? 'beklemede';
        siparis_kaydet($siparis);
    }
}

$ref = '<p class="ref">' . h(t($dil, 'succ_ref', ['ref' => $siparis['no']])) . '</p>';
$anaSayfa = '/' . $dil . '/';
$wa = (isletme()['whatsapp'] ?? 'https://wa.me/32493839898')
    . '?text=' . rawurlencode(t($dil, 'succ_ref', ['ref' => $siparis['no']]));

if ($siparis['durum'] === 'odendi') {
    // ---- odendi: onay
    mini_sayfa($dil, t($dil, 'succ_paid_t'),
        '<p>' . h(t($dil, 'succ_paid_d', ['rest' => para($dil, (float) $siparis['kalan'])])) . '</p>'
        . $ref
        . '<div class="btnler"><a class="btn" href="' . h($anaSayfa) . '">' . h(t($dil, 'succ_home')) . '</a></div>');
} elseif (in_array($siparis['durum'], ['beklemede'], true)) {
    // ---- henuz netlesmedi: sayfa kendini yeniler, "basarisiz" DENMEZ
    mini_sayfa($dil, t($dil, 'succ_pending_t'),
        '<p>' . h(t($dil, 'succ_pending_d')) . '</p>' . $ref,
        6);
} else {
    // ---- basarisiz / iptal / suresi doldu: para cekilmedi, yeniden dene veya WhatsApp
    mini_sayfa($dil, t($dil, 'succ_fail_t'),
        '<p>' . h(t($dil, 'succ_fail_d')) . '</p>' . $ref
        . '<div class="btnler">'
        . '<a class="btn" href="' . h($anaSayfa) . '#rezervasyon">' . h(t($dil, 'succ_retry')) . '</a>'
        . '<a class="btn btn--wa" href="' . h($wa) . '" rel="noopener">' . h(t($dil, 'succ_wa')) . '</a>'
        . '</div>');
}
