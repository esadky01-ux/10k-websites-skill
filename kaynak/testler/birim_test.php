<?php
// ============================================================
// ADIM 3 PHP BIRIM TESTLERI (CLI) — hizli duman testi
// Calistirma: once build.py, sonra `php kaynak/testler/birim_test.php`
// (Derin kapsam: test_php_pay.py + vektor_test.php; burasi sozlesmenin hizli ozeti.)
// www/pay/create.php CLI'dan dahil edildiginde yalnizca fonksiyonlar tanimlanir (akis calismaz);
// dil.php/isletme.php uretilmis olur. Siparis klasoru GECICI dizine yonlendirilir (depoya/www'ya yazilmaz).
// ============================================================
declare(strict_types=1);

$gecici = sys_get_temp_dir() . '/et_birim_' . getmypid();
putenv('ORDERS_DIR=' . $gecici);
foreach (['MOLLIE_API_KEY', 'GOOGLE_SERVER_KEY', 'BREVO_API_KEY', 'ADMIN_PASSWORD', 'MOLLIE_API_BASE', 'BREVO_API_BASE', 'GOOGLE_API_BASE', 'TRUSTED_PROXY_HEADER'] as $e) {
    putenv($e);   // ortamda kalmis anahtarlar testi etkilemesin
}

$payDizini = dirname(__DIR__, 2) . '/www/pay';
require $payDizini . '/create.php';

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

// ---- km karar politikasi (FAIL-CLOSED; Node ile ayni; ayrintili vektorler: vektor_test.php)
esit(['km' => 60, 'kaynak' => 'google', 'sebep' => null], mesafe_karar(50, 60, null, 12), 'google var, fark %16,7 -> google');
esit(['km' => 58, 'kaynak' => 'istemci', 'sebep' => null], mesafe_karar(58, 60, null, 12), 'google var, fark %3,3 -> istemci');
esit(['km' => 60, 'kaynak' => 'google', 'sebep' => null], mesafe_karar(100, 60, 56, 12), 'google varken istemci uzaksa google (istemci yuksek olsa bile)');
esit(['km' => 56, 'kaynak' => 'dahili', 'sebep' => null], mesafe_karar(1, null, 56, 12), 'km=1 + dahili 56 -> dahili (fiyat tahrifati kapali)');
esit(['km' => 100, 'kaynak' => 'istemci', 'sebep' => null], mesafe_karar(100, null, 56, 12), 'istemci daha yuksekse musteri lehine kabul');
esit(['km' => null, 'kaynak' => null, 'sebep' => 'dogrulanamadi'], mesafe_karar(70, null, null, 12), 'google de dahili de yok -> RET (fail-open KAPALI)');
esit(['km' => null, 'kaynak' => null, 'sebep' => 'aralik'], mesafe_karar(0, 50, 50, 12), 'istemci 0 -> RET');
esit(['km' => null, 'kaynak' => null, 'sebep' => 'aralik'], mesafe_karar(801, 800, 800, 12), 'istemci 801 -> RET');
esit(['km' => null, 'kaynak' => null, 'sebep' => 'aralik'], mesafe_karar(56, 900, null, 12), 'google 900 km -> aralik disi -> RET');

// ---- girdi dogrulama (Node ile birebir; ayrintili vektorler: vektor_test.php)
$bugun = new DateTimeImmutable('2026-09-28T10:00:00Z');
$taban = ['dil' => 'nl', 'alis' => 'Gent', 'varis' => 'Brussels Airport', 'km' => '56', 'tarih' => '2026-10-08', 'saat' => '14:30',
    'donus_tarih' => '', 'donus_saat' => '', 'yolcu' => '3', 'buyuk' => '1', 'kucuk' => '0', 'arac' => 'wagon',
    'ad' => "Jan\r\nPeeters", 'eposta' => 'jan@voorbeeld.be', 'telefon' => '+32 470 11 22 33'];
$dv = girdi_dogrula($taban, $bugun);
dogru($dv['ok'] === true && $dv['deger']['ad'] === 'Jan Peeters', 'girdi_dogrula: CRLF bosluga cevrilir');
dogru(girdi_dogrula(array_merge($taban, ['eposta' => "jan@x.be\r\nBcc: k@x.be"]), $bugun)['ok'] === false, 'e-posta baslik enjeksiyonu reddedilir');
dogru(girdi_dogrula(array_merge($taban, ['alis' => 'Gent|Antwerpen']), $bugun)['alan'] === 'alis', "adreste '|' reddedilir");
dogru(girdi_dogrula(array_merge($taban, ['km' => '0']), $bugun)['anahtar'] === 'err_km', 'km=0 reddedilir');
dogru(girdi_dogrula(array_merge($taban, ['tarih' => '2026-09-27']), $bugun)['ok'] === false, 'gecmis tarih reddedilir');
esit(['alis' => ['x']], girdi_form_coz('alis=x'), 'girdi_form_coz');
esit('alis', girdi_yapisal_hata(girdi_form_coz('alis=a&alis=b')), 'tekrar eden alan yapisal hata');
esit('alis', girdi_yapisal_hata(girdi_form_coz('alis%5B%5D=a')), 'dizi alan yapisal hata');

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
dogru(!siparis_no_gecerli("ET-260101-ABCDEF\n"), "sondaki satir sonu kabul edilmemeli (\\z)");

// ---- dil metinleri (dil.php uretimi)
esit('fr', dil_sec('fr'), 'dil_sec fr');
esit('fr', dil_sec('xx'), 'bilinmeyen dil fr olmali');
esit('fr', dil_sec(null), 'bos dil fr olmali');
esit('fr', dil_sec(['nl']), 'dizi dil fr olmali');
foreach (['fr', 'nl', 'en', 'tr'] as $d) {
    dogru(str_contains(t($d, 'succ_ref', ['ref' => 'ET-TEST']), 'ET-TEST'), '[' . $d . '] succ_ref yer tutucusu dolmali');
    dogru(t($d, 'cancel_policy') !== 'cancel_policy', '[' . $d . '] cancel_policy yuklu olmali');
}
esit(t('fr', 'err_km'), t('fr', 'yok_boyle_anahtar', [], 'err_km'), 't(): yeni anahtar yoksa yedek anahtara duser');
esit('yok_boyle_anahtar', t('fr', 'yok_boyle_anahtar'), 't(): anahtar da yedek de yoksa anahtar adi');
esit('30.08.2026, saat 14:30', tarih_goster('tr', '2026-08-30', '14:30'), 'tarih_goster tr');
esit('30.08.2026 à 14:30', tarih_goster('fr', '2026-08-30', '14:30'), 'tarih_goster fr');

// ---- dahili mesafe motoru (mesafe.json build ciktisi; yoksa atlanir)
if (is_file($payDizini . '/mesafe.json')) {
    esit(56, mesafe_dahili('Gent', 'Brussels Airport'), 'dahili mesafe Gent-BRU (KESIN tablo)');
    esit('brussels', mesafe_yer_bul('Rue de la Loi 16, Bruxelles'), 'yer_bul Bruxelles');
    esit(null, mesafe_yer_bul('Xyz Straat 1'), 'yer_bul taninmayan adres');
    esit(null, mesafe_dahili('Gent', 'Ghent'), 'ayni yer -> dogrulanamaz');
    esit('gent', mesafe_normalize('  GÉNT!  '), 'mesafe_normalize');
} else {
    echo "i  pay/mesafe.json yok: dahili mesafe testleri atlandi (build.py pay_veri.mesafe_json_yaz cagrisi)\n";
}

// ---- e-posta govdeleri
require_once $payDizini . '/mailer.php';
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
dogru(stripos($html, 'necatican') === false && stripos($html, 'ceylan') === false, 'e-postada yonetici adi olmamali');

$metin = sirket_eposta_metni($ornek);
foreach (['ET-260829-TEST01', 'Jan Peeters', '+32 470 11 22 33', 'ARACTA TAHSIL: 97,15', 'Gent -> Brussels Airport'] as $bekle) {
    dogru(str_contains($metin, $bekle), 'is emrinde olmali: ' . $bekle);
}
$kirli = $ornek;
$kirli['ad'] = "X\nARACTA TAHSIL: 0,00 EUR";
$kirliMetin = sirket_eposta_metni($kirli);
esit(1, substr_count($kirliMetin, "\nARACTA TAHSIL"), 'is emrinde CR/LF ile sahte ARACTA TAHSIL satiri eklenemez');
esit(false, eposta_gonder("a@b.be\r\nBcc: x@y.be", 'K', '<p>x</p>')['ok'], 'alici baslik enjeksiyonu reddedilir');

// ---- temizlik
foreach (glob($gecici . '/{,.}*', GLOB_BRACE) ?: [] as $d) {
    if (is_file($d)) {
        @unlink($d);
    }
}
foreach (glob($gecici . '/*', GLOB_ONLYDIR) ?: [] as $alt) {
    foreach (glob($alt . '/*') ?: [] as $d) {
        @unlink($d);
    }
    @rmdir($alt);
}
@rmdir($gecici);

// ---- sonuc
echo "\n";
if ($hataSayisi > 0) {
    echo '✗ ' . $hataSayisi . " HATA\n";
    exit(1);
}
echo "✓ PHP birim testleri gecti\n";
