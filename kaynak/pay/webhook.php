<?php
// ============================================================
// EUROPA TAXI — Mollie webhook'u (sartname §8)
// Mollie odeme durumu degisince buraya POST id=tr_... gonderir.
// POST verisine GUVENILMEZ: durum ve tutar her zaman Mollie API'sinden sorulur.
//
// Kurallar (Node webhook.js ile esdeger):
//  * gecersiz id / bilinmeyen odeme / bilinmeyen siparis -> 200 (Mollie'yi bosuna tekrar denetme)
//  * Mollie sorgusu basarisiz veya e-posta gonderilemedi -> 500 (Mollie yeniden dener)
//  * siparisin kayitli mollie_id'si odeme id'siyle esit olmali (metadata.order_id'ye tek basina guvenilmez)
//  * odenen tutar (EUR) siparis kaporasina esit degilse: durum 'tutar_uyusmazligi', e-posta YOK, hata loglanir
//  * amountRefunded / amountChargedBack > 0: durum 'iade' / 'chargeback', e-posta YOK
//  * paidAt 48 saatten eskiyse e-posta YOK
//  * e-posta ALICI BASINA bayrakla (eposta_musteri, eposta_sirket) yalniz basari halinde isaretlenir; tekrar
//    denemede yalniz eksik olan gonderilir (once musteri, sonra sirket)
//  * okuma-degistirme-yazma siparis dosyasi uzerinde flock(LOCK_EX) altindadir: es zamanli webhook'lar cift
//    e-posta gonderemez (e-posta gonderimi de kilit icindedir)
// ============================================================
declare(strict_types=1);

@ini_set('display_errors', '0');   // dahil edilen dosyalar yuklenirken (ayristirma/yukleme hatasi) bile mutlak yol ekrana basilmasin

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/girdi.php';
require_once __DIR__ . '/mailer.php';

guvenlik_baslat('webhook');
@set_time_limit(90);

/** Duz metin yanit + cikis. */
function webhook_yanit(int $kod, string $govde, array $ek = []): never
{
    http_response_code($kod);
    header('Content-Type: text/plain; charset=utf-8');
    foreach ($ek as $ad => $deger) {
        header($ad . ': ' . $deger);
    }
    echo $govde;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    webhook_yanit(405, 'Method Not Allowed', ['Allow' => 'POST']);
}

// ---- IP basina dakikada 60 (kimliksiz POST'lar Mollie API'sine gitmesin)
$oran = webhook_siniri(istemci_ip());
if (!$oran['izin']) {
    kayit('uyari: webhook: oran siniri asildi');
    webhook_yanit(429, 'cok fazla istek', ['Retry-After' => (string) $oran['bekleme']]);
}

$govde = govde_oku();
if ($govde === null) {
    webhook_yanit(413, 'govde cok buyuk', ['Connection' => 'close']);
}
$odemeId = (string) (girdi_ilk(girdi_form_coz($govde), 'id') ?? '');

// Mollie'yi tekrar denemeye zorlama: gecersiz id -> 200
if (preg_match('/^tr_[A-Za-z0-9]+\z/', $odemeId) !== 1) {
    webhook_yanit(200, 'gecersiz istek');
}

// ---- durumu Mollie'den DOGRULA (POST'a guvenme)
[$kod, $odeme] = mollie('GET', 'payments/' . $odemeId);
if ($kod === 404) {
    kayit('uyari: webhook: Mollie odemeyi bilmiyor ' . $odemeId);
    webhook_yanit(200, 'odeme yok');
}
if ($kod !== 200 || !isset($odeme['status']) || !is_string($odeme['status'])) {
    kayit('hata: webhook: Mollie sorgusu basarisiz (HTTP ' . $kod . ') ' . $odemeId);
    webhook_yanit(500, 'mollie ulasilamadi');
}

$meta = is_array($odeme['metadata'] ?? null) ? $odeme['metadata'] : [];
$siparisNo = is_string($meta['order_id'] ?? null) ? $meta['order_id'] : '';
$siparis = siparis_oku($siparisNo);
if ($siparis === null) {
    kayit('uyari: webhook: siparis bulunamadi (' . $odemeId . ')');
    webhook_yanit(200, 'siparis yok');
}
istek_baglami(['no' => $siparisNo]);

// ---- odeme id'si siparisin KAYITLI mollie_id'siyle eslesmeli
if (($odeme['id'] ?? null) !== $odemeId || ($siparis['mollie_id'] ?? null) !== $odemeId) {
    kayit('hata: webhook: odeme id siparisin mollie_id\'siyle eslesmiyor ' . $siparisNo . ' ' . $odemeId . '; islem yapilmadi');
    webhook_yanit(200, 'siparis yok');
}

// ---- kilit altinda: durumu uygula + (yalniz ilk odemede, eksik alicilara) e-posta gonder
$sonuc = [200, 'OK'];
$son = siparis_guncelle($siparisNo, static function (array $s, callable $kaydet) use ($odeme, $odemeId, $siparisNo, &$sonuc): ?array {
    if (($s['mollie_id'] ?? null) !== $odemeId) {   // kilit beklerken degismis olabilir
        $sonuc = [200, 'siparis yok'];
        return null;
    }
    $onceki = $s;
    $s = siparis_odeme_uygula($s, $odeme);
    if ($s !== $onceki) {
        $kaydet($s);   // durum kalici olsun (e-posta basarisiz olsa da panel dogru gorsun)
    }
    $durum = (string) $s['durum'];

    if ($odeme['status'] !== 'paid') {
        kayit('bilgi: webhook: ' . $siparisNo . ' durum=' . $durum);
        return $s;
    }
    if ($durum === 'tutar_uyusmazligi') {
        kayit('hata: webhook: TUTAR UYUSMUYOR ' . $siparisNo . ' odenen=' . (string) ($s['odenen_tutar'] ?? '?')
            . ' beklenen=' . kapora_metni($s) . ' EUR; e-posta GONDERILMEDI');
        $sonuc = [200, 'tutar uyusmuyor'];
        return $s;
    }
    if ($durum === 'iade' || $durum === 'chargeback') {
        kayit('bilgi: webhook: ' . $siparisNo . ' ' . $durum . '; e-posta gonderilmedi');
        return $s;
    }
    if ($durum !== 'odendi') {
        return $s;
    }

    // paidAt penceresi (gec/tekrarlanan webhook'lar eski siparisler icin e-posta yagdirmasin)
    $paid = strtotime((string) ($odeme['paidAt'] ?? ''));
    if ($paid === false) {
        kayit('hata: webhook: ' . $siparisNo . ' paid ama paidAt yok/gecersiz; e-posta gonderilmedi');
        return $s;
    }
    if (time() - $paid > EPOSTA_PENCERE_SN) {
        kayit('bilgi: webhook: ' . $siparisNo . ' paidAt 48 saatten eski; e-posta gonderilmedi');
        return $s;
    }

    $bayrak = siparis_eposta_bayraklari($s);
    if ($bayrak['musteri'] && $bayrak['sirket']) {
        return $s;   // zaten gonderilmis (tekrarlanan webhook)
    }
    $dil = dil_sec($s['dil'] ?? 'fr');
    $kayitYontem = is_array($s['eposta_kaydi'] ?? null) ? $s['eposta_kaydi'] : [];

    // 1) Musteriye: kendi dilinde HTML onay (Reply-To: sirket adresi)
    if (!$bayrak['musteri']) {
        $r = eposta_gonder(
            (string) $s['eposta'],
            t($dil, 'em_subject', ['ref' => $siparisNo]),
            musteri_eposta_html($s),
            '',
            sirket_eposta(),
            $siparisNo . ' musteri'
        );
        if (!$r['ok']) {
            kayit('hata: webhook: musteri e-postasi gonderilemedi ' . $siparisNo . ' -> 500 (Mollie yeniden deneyecek)');
            $sonuc = [500, 'eposta hatasi'];
            return $s;
        }
        $s['eposta_musteri'] = true;
        $s['eposta_gonderildi'] = false;
        $kayitYontem['musteri'] = $r['yontem'];
        $kayitYontem['zaman'] = date('c');
        $s['eposta_kaydi'] = $kayitYontem;
        $kaydet($s);   // bayrak HEMEN kalici: sonraki adimda hata olsa da musteri e-postasi tekrarlanmaz
    }

    // 2) Sirkete: duz metin is emri
    if (!$bayrak['sirket']) {
        $isEmri = sirket_eposta_metni($s);
        $r = eposta_gonder(
            sirket_eposta(),
            'Yeni rezervasyon · ' . $siparisNo . ' · ' . mailer_satir($s['alis']) . ' -> ' . mailer_satir($s['varis']),
            '<pre style="font-family:monospace;font-size:13px;">' . h($isEmri) . '</pre>',
            $isEmri,
            null,
            $siparisNo . ' sirket'
        );
        if (!$r['ok']) {
            kayit('hata: webhook: sirket e-postasi gonderilemedi ' . $siparisNo . ' -> 500 (Mollie yeniden deneyecek)');
            $sonuc = [500, 'eposta hatasi'];
            return $s;
        }
        $s['eposta_sirket'] = true;
        $kayitYontem['sirket'] = $r['yontem'];
        $kayitYontem['zaman'] = date('c');
        $s['eposta_kaydi'] = $kayitYontem;
    }
    $s['eposta_gonderildi'] = true;
    kayit('bilgi: webhook: ' . $siparisNo . ' e-postalar gonderildi');
    return $s;
});

if ($son === null && $sonuc[0] === 200 && $sonuc[1] === 'OK') {
    webhook_yanit(200, 'siparis yok');
}
webhook_yanit($sonuc[0], $sonuc[1]);
