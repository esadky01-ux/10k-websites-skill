<?php
// ============================================================
// ADIM 3 PHP BIRIM TESTLERI (CLI)
// Calistirma: once build.py, sonra `php kaynak/testler/birim_test.php`
// www/pay/create.php CLI'dan dahil edildiginde yalnizca fonksiyonlar
// tanimlanir (akis calismaz); dil.php/isletme.php uretilmis olur.
// ============================================================
declare(strict_types=1);

require dirname(__DIR__, 2) . '/www/pay/create.php';

$hataSayisi = 0;
function esit(mixed $beklenen, mixed $bulunan, string $ad): void
{
    global $hataSayisi;
    if ($beklenen !== $bulunan) {
        $hataSayisi++;
        echo 'HATA: ' . $ad . ' — beklenen ' . var_export($beklenen, true)
            . ', bulunan ' . var_export($bulunan, true) . "\n";
    }
}
function dogru(bool $kosul, string $ad): void
{
    global $hataSayisi;
    if (!$kosul) {
        $hataSayisi++;
        echo 'HATA: ' . $ad . "\n";
    }
}

// ---- fiyat formulu (sartname §4 + §5 dogrulama hedefleri)
esit([99.55, 19.91, 79.64], fiyat_hesapla(45), 'fiyat 45 km (Bruksel-Antwerpen)');
esit([121.44, 24.29, 97.15], fiyat_hesapla(56), 'fiyat 56 km (Gent-BRU)');
esit([209.0, 41.8, 167.2], fiyat_hesapla(100), 'fiyat 100 km (Bruksel-Liege)');
esit([238.85, 47.77, 191.08], fiyat_hesapla(115), 'fiyat 115 km (Gent-CRL)');

// ---- km sinirlari (sartname §14-B: 0, negatif, 801, 9999 -> RET)
foreach ([0, -5, 801, 9999] as $kotu) {
    dogru(!km_gecerli($kotu), 'km_gecerli(' . $kotu . ') reddetmeli');
}
foreach ([1, 56, 800] as $iyi) {
    dogru(km_gecerli($iyi), 'km_gecerli(' . $iyi . ') kabul etmeli');
}

// ---- tolerans karari (sartname §4.5: fark > %12 ise SUNUCU degeri)
esit(60, km_karar(50, 60, 12), 'fark %16,7 -> sunucu degeri kullanilmali');
esit(58, km_karar(58, 60, 12), 'fark %3,3 -> istemci degeri kalabilir');
esit(70, km_karar(70, null, 12), 'sunucu degeri yoksa istemci degeri');
esit(100, km_karar(100, 0, 12), 'sunucu degeri 0 ise istemci degeri');
esit(200, km_karar(100, 200, 12), 'buyuk sapmada sunucu degeri');

// ---- para bicimi
esit('121,44 €', para('fr', 121.44), 'para fr');
esit('121,44 €', para('nl', 121.44), 'para nl');
esit('121,44 €', para('tr', 121.44), 'para tr');
esit('€121.44', para('en', 121.44), 'para en');
esit('1 234,50 €', para('fr', 1234.5), 'para binlik ayirici');

// ---- siparis numarasi
$no = siparis_no_uret();
dogru(siparis_no_gecerli($no), 'uretilen siparis no gecerli: ' . $no);
dogru(!siparis_no_gecerli('../../etc/passwd'), 'yol enjeksiyonu reddedilmeli');
dogru(!siparis_no_gecerli('ET-123-XX'), 'bozuk bicim reddedilmeli');

// ---- dil metinleri (dil.php uretimi)
esit('fr', dil_sec('fr'), 'dil_sec fr');
esit('fr', dil_sec('xx'), 'bilinmeyen dil fr olmali');
esit('fr', dil_sec(null), 'bos dil fr olmali');
foreach (['fr', 'nl', 'en', 'tr'] as $d) {
    dogru(str_contains(t($d, 'succ_ref', ['ref' => 'ET-TEST']), 'ET-TEST'),
        '[' . $d . '] succ_ref yer tutucusu dolmali');
    dogru(t($d, 'cancel_policy') !== 'cancel_policy', '[' . $d . '] cancel_policy yuklu olmali');
}
esit('30.08.2026, saat 14:30', tarih_goster('tr', '2026-08-30', '14:30'), 'tarih_goster tr');
esit('30.08.2026 à 14:30', tarih_goster('fr', '2026-08-30', '14:30'), 'tarih_goster fr');

// ---- e-posta govdeleri
require_once dirname(__DIR__, 2) . '/www/pay/mailer.php';
$ornek = [
    'no' => 'ET-260829-TEST01', 'dil' => 'nl', 'alis' => 'Gent', 'varis' => 'Brussels Airport (Zaventem)',
    'km' => 56, 'km_istemci' => 56, 'km_sunucu' => 56, 'toplam' => 121.44, 'kapora' => 24.29, 'kalan' => 97.15,
    'tarih' => '2026-09-01', 'saat' => '06:30', 'donus_tarih' => '2026-09-08', 'donus_saat' => '18:00',
    'yolcu' => 3, 'buyuk' => 2, 'kucuk' => 1, 'arac' => 'wagon',
    'ad' => 'Jan Peeters', 'eposta' => 'jan@voorbeeld.be', 'telefon' => '+32 470 11 22 33',
];
$html = musteri_eposta_html($ornek);
foreach (['ET-260829-TEST01', 'Gent', 'Jan Peeters', '97,15', '24,29', 'voorschot'] as $bekle) {
    dogru(stripos($html, $bekle) !== false, 'musteri e-postasinda olmali: ' . $bekle);
}
dogru(stripos($html, 'necatican') === false && stripos($html, 'ceylan') === false,
    'e-postada yonetici adi olmamali');

$metin = sirket_eposta_metni($ornek);
foreach (['ET-260829-TEST01', 'Jan Peeters', '+32 470 11 22 33', 'ARACTA TAHSIL: 97,15', 'Gent -> Brussels Airport'] as $bekle) {
    dogru(str_contains($metin, $bekle), 'is emrinde olmali: ' . $bekle);
}

// ---- sonuc
echo "\n";
if ($hataSayisi > 0) {
    echo '✗ ' . $hataSayisi . " HATA\n";
    exit(1);
}
echo "✓ PHP birim testleri gecti\n";
