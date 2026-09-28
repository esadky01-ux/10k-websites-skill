<?php
// ============================================================
// EUROPA TAXI — siparis deposu (ortak.php yukler).
//
// Siparisler orders_dir altinda ET-yymmdd-XXXXXX.json dosyalari olarak tutulur.
//  * VARSAYILAN KONUM web kokunun DISINDA: dirname(__DIR__, 2).'/et-siparisler' (www/ klasorunun bir ustu).
//    Olusturulamiyorsa pay/orders/'a duser (.htaccess kilidiyle; test.php bunu KIRMIZI uyari yapar).
//  * Izinler: klasorler 0700, dosyalar 0600.
//  * Yazma ATOMIKTIR (gecici dosya + rename); oku-degistir-yaz siparis_guncelle() ile siparis basina
//    flock(LOCK_EX) altinda yapilir (es zamanli webhook'lar / success.php birbirini ezmez).
// ============================================================
declare(strict_types=1);

/** Mollie durumu 'paid' olmus siparis durumlari (para hareketi var): asla baska duruma ezilmez. */
const DURUM_ODENMIS = ['odendi', 'iade', 'chargeback', 'tutar_uyusmazligi'];
/** 30 gun sonra silinen (odenmemis) durumlar. */
const DURUM_ODENMEMIS = ['odeme_baslatilamadi', 'beklemede', 'iptal', 'suresi_doldu', 'basarisiz'];
const EPOSTA_PENCERE_SN = 48 * 3600;   // paidAt bundan eskiyse e-posta gonderilmez

// ---------------------------------------------------------------- klasor

/** Klasoru hazirlar (yoksa 0700 olusturur), yazilabilirligi ve .htaccess kilidini garanti eder. */
function depo_hazirla(string $yol): bool
{
    if (!@is_dir($yol)) {
        @mkdir($yol, 0700, true);
    }
    if (!@is_dir($yol) || !@is_writable($yol)) {
        return false;
    }
    $izin = @fileperms($yol);
    if ($izin !== false && ($izin & 0077) !== 0) {
        @chmod($yol, 0700);
    }
    $ht = $yol . '/.htaccess';
    if (!@is_file($ht)) {
        // Apache 2.4 ve 2.2 icin cifte kilit (klasor web kokunun icine dusse bile web'den okunamaz)
        @file_put_contents($ht, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    }
    return true;
}

/**
 * Siparis klasoru. config 'orders_dir' bossa varsayilan: web kokunun disinda et-siparisler/; yazilamiyorsa
 * pay/orders/ (yedek). orders_dir acikca verilmisse yalniz o denenir (kullanilamazsa istisna).
 */
function siparis_klasoru_bilgi(): array
{
    static $bilgi = null;
    if ($bilgi !== null) {
        return $bilgi;
    }
    $acik = cfg()['orders_dir'];
    $adaylar = $acik !== ''
        ? [[rtrim($acik, '/\\'), false]]
        : [[dirname(__DIR__, 2) . '/et-siparisler', false], [__DIR__ . '/orders', true]];
    foreach ($adaylar as [$yol, $yedek]) {
        if (depo_hazirla($yol)) {
            $bilgi = ['yol' => $yol, 'yedek' => $yedek, 'acik' => $acik !== '', 'web_disi' => depo_web_disi_mi($yol)];
            if (!$yedek) {
                depo_eski_siparisleri_tasi($yol);   // $bilgi artik atandi: kayit() ozyinelemeye girmez
            }
            return $bilgi;
        }
    }
    throw new RuntimeException('siparis klasoru kullanilamiyor');
}

/**
 * Eski konumdaki (web kokunun ICINDEKI pay/orders/) siparis dosyalarini ve kayit.log'u yeni klasore tasir
 * (kurulum guncellemesinde eski siparisler kaybolmasin ve web ici klasorde kisisel veri kalmasin). Sessiz, tek seferlik.
 * Doner: tasinan siparis sayisi.
 */
function depo_eski_siparisleri_tasi(string $hedef): int
{
    $eski = __DIR__ . '/orders';
    $g1 = @realpath($eski);
    if ($g1 === false || $g1 === @realpath($hedef)) {
        return 0;
    }
    $say = 0;
    foreach (glob($eski . '/ET-*.json') ?: [] as $d) {
        $hedefDosya = $hedef . '/' . basename($d);
        if (is_file($hedefDosya)) {
            continue;
        }
        if (@rename($d, $hedefDosya) || (@copy($d, $hedefDosya) && @unlink($d))) {
            @chmod($hedefDosya, 0600);
            $say++;
        }
    }
    $eskiLog = $eski . '/kayit.log';
    if (is_file($eskiLog)) {
        $icerik = @file_get_contents($eskiLog);
        if (is_string($icerik) && @file_put_contents($hedef . '/kayit.log', $icerik, FILE_APPEND | LOCK_EX) !== false) {
            @chmod($hedef . '/kayit.log', 0600);
            @unlink($eskiLog);
        }
    }
    if ($say > 0) {
        kayit('bilgi: ' . $say . ' eski siparis pay/orders/ klasorunden web disi klasore tasindi');
    }
    return $say;
}

function siparis_klasoru(): string
{
    return siparis_klasoru_bilgi()['yol'];
}

/** Klasor web kokunun (pay/'in ustu ve varsa DOCUMENT_ROOT) DISINDA mi? */
function depo_web_disi_mi(string $yol): bool
{
    $g = @realpath($yol);
    if ($g === false) {
        return false;
    }
    $kokler = [];
    $pay = @realpath(dirname(__DIR__));
    if ($pay !== false) {
        $kokler[] = $pay;
    }
    $dr = $_SERVER['DOCUMENT_ROOT'] ?? '';
    if (is_string($dr) && $dr !== '' && ($r = @realpath($dr)) !== false) {
        $kokler[] = $r;
    }
    foreach ($kokler as $k) {
        if ($g === $k || str_starts_with($g . '/', rtrim($k, '/') . '/')) {
            return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------- siparis dosyalari

/** Siparis numarasi guvenli bicimde mi? (dosya adi olarak kullanilir; \z: sondaki satir sonu kabul EDILMEZ) */
function siparis_no_gecerli(string $no): bool
{
    return preg_match('/^ET-[0-9]{6}-[A-Z0-9]{6}\z/', $no) === 1;
}

function siparis_yolu(string $no): string
{
    if (!siparis_no_gecerli($no)) {
        throw new InvalidArgumentException('gecersiz siparis no');
    }
    return siparis_klasoru() . '/' . $no . '.json';
}

/** Benzersiz siparis numarasi: ET-yymmdd-XXXXXX (yymmdd = Brussels gunu). */
function siparis_no_uret(): string
{
    do {
        $no = 'ET-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    } while (is_file(siparis_yolu($no)));
    return $no;
}

function siparis_oku(string $no): ?array
{
    if (!siparis_no_gecerli($no)) {
        return null;
    }
    $y = siparis_yolu($no);
    if (!is_file($y)) {
        return null;
    }
    $ham = @file_get_contents($y);
    $j = is_string($ham) ? json_decode($ham, true) : null;
    return is_array($j) ? $j : null;
}

/** Icerigi gecici dosyaya yazip rename eder (yarim dosya gorunmez); 0600. */
function depo_yaz_atomik(string $yol, string $icerik): bool
{
    $gecici = @tempnam(dirname($yol), '.tmp');
    if ($gecici === false) {
        return false;
    }
    $n = @file_put_contents($gecici, $icerik);
    if ($n === false || $n !== strlen($icerik)) {
        @unlink($gecici);
        return false;
    }
    @chmod($gecici, 0600);
    if (!@rename($gecici, $yol)) {
        @unlink($gecici);
        return false;
    }
    return true;
}

/**
 * Siparisi yazar. Basarisizlikta (json_encode / disk) FALSE doner: cagiran ODEMEYI BASLATMAMALIDIR.
 */
function siparis_kaydet(array $s): bool
{
    $no = $s['no'] ?? null;
    if (!is_string($no) || !siparis_no_gecerli($no)) {
        return false;
    }
    $j = json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($j === false) {
        return false;
    }
    return depo_yaz_atomik(siparis_yolu($no), $j);
}

/**
 * Siparisi KILIT ALTINDA oku-degistir-yaz. $degistir(array $siparis, callable $araKaydet): ?array
 * yeni durumu doner (null/ayni = degisiklik yok). $araKaydet(array) ara durumu hemen yazar (or. e-posta
 * gonderildikten HEMEN sonra bayragi kalici yapmak icin). Kilit boyunca ayni siparisi baska surec degistiremez.
 * Doner: son durum; siparis yoksa null. Yazma basarisizsa RuntimeException.
 */
function siparis_guncelle(string $no, callable $degistir): ?array
{
    if (!siparis_no_gecerli($no) || !is_file(siparis_yolu($no))) {
        return null;
    }
    $kilitYolu = siparis_yolu($no) . '.lock';
    $yeniKilit = !is_file($kilitYolu);
    $k = fopen($kilitYolu, 'c');
    if ($k === false) {
        throw new RuntimeException('siparis kilidi acilamadi');
    }
    if ($yeniKilit) {
        @chmod($kilitYolu, 0600);
    }
    try {
        if (!flock($k, LOCK_EX)) {
            throw new RuntimeException('siparis kilidi alinamadi');
        }
        $s = siparis_oku($no);
        if ($s === null) {
            return null;
        }
        $araKaydet = static function (array $yeni): void {
            if (!siparis_kaydet($yeni)) {
                throw new RuntimeException('siparis yazilamadi');
            }
        };
        $yeni = $degistir($s, $araKaydet);
        if (!is_array($yeni)) {
            return $s;
        }
        if ($yeni !== $s) {
            $araKaydet($yeni);
        }
        return $yeni;
    } finally {
        flock($k, LOCK_UN);
        fclose($k);
    }
}

/** Siparisi (ve kilit dosyasini) siler. Doner: silindi mi. */
function siparis_sil(string $no): bool
{
    if (!siparis_no_gecerli($no)) {
        return false;
    }
    $yol = siparis_yolu($no);
    $kilitYolu = $yol . '.lock';
    $k = @fopen($kilitYolu, 'c');
    if ($k !== false) {
        flock($k, LOCK_EX);
    }
    $ok = !is_file($yol) || @unlink($yol);
    if ($k !== false) {
        @unlink($kilitYolu);
        flock($k, LOCK_UN);
        fclose($k);
    }
    return $ok;
}

/** Siparis dosyalari (en yeni ilk; dosya adindaki tarih onekine gore). Doner: [no => yol]. */
function siparis_dosyalari(): array
{
    $liste = [];
    foreach (glob(siparis_klasoru() . '/ET-*.json') ?: [] as $yol) {
        $no = basename($yol, '.json');
        if (siparis_no_gecerli($no)) {
            $liste[$no] = $yol;
        }
    }
    krsort($liste);
    return $liste;
}

// ---------------------------------------------------------------- Mollie durumu -> siparis

/** Mollie durumu -> siparis durumu (Node durumEsle ile ayni; digerleri 'beklemede'). */
function mollie_durum_esle(string $mollieDurum): string
{
    return ['paid' => 'odendi', 'expired' => 'suresi_doldu', 'canceled' => 'iptal', 'failed' => 'basarisiz'][$mollieDurum] ?? 'beklemede';
}

/** Mollie {value, currency} nesnesinden ondalik sayi (yoksa 0). */
function mollie_tutar(mixed $nesne): float
{
    return is_array($nesne) && isset($nesne['value']) && is_numeric($nesne['value']) ? (float) $nesne['value'] : 0.0;
}

/** Siparis kaporasi Mollie amount.value bicimiyle: "24.29". */
function kapora_metni(array $s): string
{
    return number_format((float) ($s['kapora'] ?? 0), 2, '.', '');
}

/**
 * Mollie odemesini siparise uygular (webhook.php + success.php ORTAK). Kurallar:
 *  - odeme 'paid' degilse ve siparis zaten odenmis durumdaysa (odendi/iade/chargeback/tutar_uyusmazligi)
 *    HICBIR sey degismez: 'paid' asla baska duruma ezilmez (eski/gecikmis yanit korumasi).
 *  - 'paid': odenen tutar (amount.value + currency EUR) siparis kaporasina ESIT degilse 'tutar_uyusmazligi';
 *    amountChargedBack > 0 -> 'chargeback'; amountRefunded > 0 -> 'iade'; aksi 'odendi'.
 *    iade/chargeback/tutar_uyusmazligi durumlari YAPISIKTIR: gecikmis bir yanit bunlari 'odendi'ye geri cevirmez
 *    (iade Mollie'de iptal edilirse durum elle duzeltilir; panel para yaniltmasin diye guvenli taraf secildi).
 * Degisiklik yoksa AYNI diziyi doner (gereksiz yazma olmaz). Cagiran, odeme id'sinin siparisin
 * mollie_id'siyle esitligini ONCEDEN dogrulamis olmalidir.
 */
function siparis_odeme_uygula(array $s, array $odeme): array
{
    $ms = (string) ($odeme['status'] ?? '');
    $eski = (string) ($s['durum'] ?? '');
    $yeni = $s;
    if ($ms !== 'paid') {
        if (in_array($eski, DURUM_ODENMIS, true)) {
            return $s;
        }
        $yeni['mollie_durum'] = $ms;
        $yeni['durum'] = mollie_durum_esle($ms);
    } else {
        $tutar = is_array($odeme['amount'] ?? null) ? $odeme['amount'] : [];
        $tutarOk = (string) ($tutar['currency'] ?? '') === 'EUR' && (string) ($tutar['value'] ?? '') === kapora_metni($s);
        $iade = mollie_tutar($odeme['amountRefunded'] ?? null);
        $geri = mollie_tutar($odeme['amountChargedBack'] ?? null);
        $yeni['mollie_durum'] = 'paid';
        $yeni['durum'] = !$tutarOk ? 'tutar_uyusmazligi' : ($geri > 0 ? 'chargeback' : ($iade > 0 ? 'iade' : 'odendi'));
        if ($yeni['durum'] === 'odendi' && in_array($eski, ['iade', 'chargeback', 'tutar_uyusmazligi'], true)) {
            // yapisik: gecikmis/eski bir 'paid' yaniti (iade/geri odeme oncesi) sorunlu durumu 'odendi'ye GERI CEVIREMEZ
            $yeni['durum'] = $eski;
        }
        $yeni['odeme_zamani'] = (string) ($odeme['paidAt'] ?? '');
        $yeni['odenen_tutar'] = (string) ($tutar['value'] ?? '') . ' ' . (string) ($tutar['currency'] ?? '');
        $yeni['iade'] = number_format($iade, 2, '.', '');       // metin: JSON'da 0.0/0 tur farki olmasin (gereksiz yazma yok)
        $yeni['geri_odeme'] = number_format($geri, 2, '.', '');
    }
    if ($yeni === $s) {
        return $s;
    }
    $yeni['guncelleme'] = date('c');
    return $yeni;
}

/** Eski (tek bayrakli) siparis dosyalari icin alici bayraklarini tamamlar. */
function siparis_eposta_bayraklari(array $s): array
{
    $eskiTam = !empty($s['eposta_gonderildi']) && !array_key_exists('eposta_musteri', $s) && !array_key_exists('eposta_sirket', $s);
    return [
        'musteri' => $eskiTam || !empty($s['eposta_musteri']),
        'sirket' => $eskiTam || !empty($s['eposta_sirket']),
    ];
}
