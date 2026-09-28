<?php
// ============================================================
// EUROPA TAXI — odeme donus sayfasi (sartname §8)
// Webhook birkac saniye gecikebilir; musteriye yanlislikla "odeme tamamlanmadi" GOSTERILMEZ:
// durum Mollie'den CANLI sorulur. Canli yanit siparise siparis_guncelle() ile (kilit altinda) yazilir ve
// 'paid' durumunu asla baska duruma EZMEZ (eski/gecikmis yanit korumasi). E-posta bu sayfadan gonderilmez.
// 4 dilde, marka gorunumunde, noindex.
//
// paid -> onay | beklemede (open/pending/authorized/bilinmeyen) -> "isleniyor" + 6 sn yenileme (en fazla 40 kez;
// ASLA "basarisiz" denmez) | failed/canceled/expired -> basarisiz (yeniden dene + WhatsApp) |
// tutar uyusmazligi / iade / geri odeme -> "isleniyor" metni + iletisim dugmeleri (yenileme yok).
// ============================================================
declare(strict_types=1);

@ini_set('display_errors', '0');   // dahil edilen dosyalar yuklenirken (ayristirma/yukleme hatasi) bile mutlak yol ekrana basilmasin

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/girdi.php';

guvenlik_baslat('success');

const YENILE_SN = 6;
const YENILE_EN_FAZLA = 40;   // ~4 dk sonra otomatik yenileme durur (terk edilmis sekme sunucuyu/Mollie'yi dovmesin)

if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'HEAD'], true)) {
    http_response_code(405);
    header('Allow: GET, HEAD');
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method Not Allowed';
    exit;
}

/** Sorgu parametresi (yalniz TEK metin; dizi/yoksa ''). */
function sorgu_metni(string $ad): string
{
    $v = $_GET[$ad] ?? '';
    return is_string($v) ? $v : '';
}

$siparisNo = sorgu_metni('order');
$dil = dil_sec(sorgu_metni('dil'));
istek_baglami(['dil' => $dil]);

/** Bulunamayan / bozuk siparis: genel "isleniyor" metni + iletisim dugmeleri (siparis numarasi dogrulanmis bicimdeyse referans). */
function genel_sayfa(string $dil, string $siparisNo): never
{
    $ref = $siparisNo !== '' ? '<p class="ref">' . h(t($dil, 'succ_ref', ['ref' => $siparisNo])) . '</p>' : '';
    mini_sayfa($dil, t($dil, 'succ_pending_t'), '<p>' . h(t($dil, 'succ_pending_d')) . '</p>' . $ref . iletisim_dugmeleri($dil));
    exit;
}

// ---- bozuk / eksik order: temiz genel sayfa (yansitma yok, yenileme yok)
if (!siparis_no_gecerli($siparisNo)) {
    genel_sayfa($dil, '');
}
istek_baglami(['no' => $siparisNo]);
$siparis = siparis_oku($siparisNo);
if ($siparis === null) {
    genel_sayfa($dil, $siparisNo);
}
$dil = dil_sec($siparis['dil'] ?? 'fr');   // musterinin siparis dili
istek_baglami(['dil' => $dil]);

// ---- durumu Mollie'den canli sorgula (odeme kaydi ve anahtar varsa); yalniz ILERI dogru yonde uygulanir
if (!empty($siparis['mollie_id']) && is_string($siparis['mollie_id']) && cfg()['mollie_api_key'] !== '') {
    [$kod, $odeme] = mollie('GET', 'payments/' . $siparis['mollie_id']);
    $meta = is_array($odeme['metadata'] ?? null) ? $odeme['metadata'] : [];
    if ($kod === 200 && isset($odeme['status']) && is_string($odeme['status'])
        && ($odeme['id'] ?? null) === $siparis['mollie_id'] && ($meta['order_id'] ?? null) === $siparisNo) {
        $guncel = siparis_guncelle($siparisNo, static fn (array $s): array => siparis_odeme_uygula($s, $odeme));
        if ($guncel !== null) {
            $siparis = $guncel;
        }
    } elseif ($kod !== 200) {
        kayit('uyari: success: Mollie ulasilamadi (HTTP ' . $kod . ') ' . $siparisNo);   // saklanan durumla devam
    }
}

$durum = (string) ($siparis['durum'] ?? 'beklemede');
$ref = '<p class="ref">' . h(t($dil, 'succ_ref', ['ref' => $siparis['no']])) . '</p>';
$anaSayfa = '/' . $dil . '/';
$waMetni = t($dil, 'succ_ref', ['ref' => $siparis['no']]);

if ($durum === 'odendi') {
    // ---- odendi: onay
    mini_sayfa($dil, t($dil, 'succ_paid_t'),
        '<p>' . h(t($dil, 'succ_paid_d', ['rest' => para($dil, (float) $siparis['kalan'])])) . '</p>'
        . $ref
        . '<div class="btnler"><a class="btn" href="' . h($anaSayfa) . '">' . h(t($dil, 'succ_home')) . '</a></div>');
} elseif ($durum === 'beklemede') {
    // ---- henuz netlesmedi: sayfa kendini yeniler, "basarisiz" DENMEZ
    $n = max(0, min(YENILE_EN_FAZLA, (int) sorgu_metni('n')));
    $yenile = $n < YENILE_EN_FAZLA
        ? '/pay/success.php?order=' . $siparis['no'] . '&dil=' . $dil . '&n=' . ($n + 1)
        : '';
    mini_sayfa($dil, t($dil, 'succ_pending_t'),
        '<p>' . h(t($dil, 'succ_pending_d')) . '</p>' . $ref,
        $yenile !== '' ? YENILE_SN : 0, $yenile);
} elseif (in_array($durum, ['tutar_uyusmazligi', 'iade', 'chargeback'], true)) {
    // ---- odeme var ama otomatik onaylanamadi (tutar uyusmazligi) veya iade/geri odeme: yenileme yok, iletisim
    mini_sayfa($dil, t($dil, 'succ_pending_t'),
        '<p>' . h(t($dil, 'succ_pending_d')) . '</p>' . $ref . iletisim_dugmeleri($dil, '', $waMetni));
} else {
    // ---- basarisiz / iptal / suresi doldu / odeme baslatilamadi: para cekilmedi, yeniden dene veya WhatsApp
    mini_sayfa($dil, t($dil, 'succ_fail_t'),
        '<p>' . h(t($dil, 'succ_fail_d')) . '</p>' . $ref
        . '<div class="btnler">'
        . '<a class="btn" href="' . h($anaSayfa) . '#rezervasyon">' . h(t($dil, 'succ_retry')) . '</a>'
        . '<a class="btn btn--wa" href="' . h(((string) (isletme()['whatsapp'] ?? 'https://wa.me/32493839898')) . '?text=' . rawurlencode($waMetni)) . '" rel="noopener">'
        . h(t($dil, 'succ_wa')) . '</a>'
        . '</div>');
}
