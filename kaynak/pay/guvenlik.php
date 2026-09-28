<?php
// ============================================================
// EUROPA TAXI — guvenlik yardimcilari (ortak.php yukler).
//  - guvenlik_baslat(): temel basliklar (no-store, nosniff, no-referrer, X-Frame-Options, CSP),
//    X-Powered-By kaldirma, display_errors kapatma, kendi hata isleyicisi (yol sizdirmaz: genel mesaj + istek kimligi)
//  - istemci_ip(), kaynak_izinli() (Origin/Referer: yalniz CSRF katmani; kimlik dogrulama DEGIL)
//  - dosya tabanli, flock'lu IP oran siniri ve yonetici girisi kaba kuvvet kilidi (orders_dir/rl/)
//  - yonetici oturumu (et_admin cerezi) ve CSRF belirteci (orders.php + test.php ortak)
// Bu dosya dahil edilince yan etki yoktur; isleyiciler yalniz guvenlik_baslat() ile kurulur.
// ============================================================
declare(strict_types=1);

const GOVDE_SINIRI = 65536;                 // 64 KB
const OTURUM_SN = 43200;                    // 12 saat
const KILIT_DENEME = 5;                     // yonetici girisi: bu kadar BASARISIZ denemeden sonra
const KILIT_SN = 900;                       // 15 dk kilit
const CSP_POLITIKASI = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

// ---------------------------------------------------------------- istek baglami / hata isleyici

/** Istek baglami (ad, istek kimligi, dil, siparis no). $guncelle verilirse birlestirilir. */
function istek_baglami(?array $guncelle = null): array
{
    static $b = ['ad' => 'cli', 'rid' => '00000000', 'dil' => 'fr', 'no' => ''];
    if ($guncelle !== null) {
        $b = $guncelle + $b;
    }
    return $b;
}

/** Temel guvenlik basliklari (tum PHP yanitlari). */
function guvenlik_basliklari(): void
{
    header_remove('X-Powered-By');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header('Content-Security-Policy: ' . CSP_POLITIKASI);
}

/**
 * Her giris betiginin ILK cagrisi. $ad: create | webhook | success | orders | test.
 * CLI'da (birim testleri) hicbir sey kurmaz.
 */
function guvenlik_baslat(string $ad): void
{
    istek_baglami([
        'ad' => $ad,
        // ilk karakter HARF: tamamen rakamli bir kimlik log temizleyicisinde telefon sanilip maskelenmesin
        'rid' => substr('abcdef', random_int(0, 5), 1) . substr(bin2hex(random_bytes(4)), 0, 7),
        'dil' => in_array($ad, ['orders', 'test'], true) ? 'tr' : 'fr',
        'no' => '',
    ]);
    if (PHP_SAPI === 'cli') {
        return;
    }
    @ini_set('display_errors', '0');
    @ini_set('display_startup_errors', '0');
    @ini_set('html_errors', '0');
    @ini_set('default_charset', 'UTF-8');
    error_reporting(E_ALL);
    guvenlik_basliklari();
    set_error_handler('et_hata_isleyici');
    set_exception_handler('et_istisna_isleyici');
    register_shutdown_function('et_kapanis_isleyici');
    @ignore_user_abort(true);   // istemci kopsa da siparis/e-posta bayraklari yazilsin
}

/** Uyari/bildirim -> ErrorException (akis sessizce devam etmez); @ ile susturulanlar ve deprecated gecer. */
function et_hata_isleyici(int $no, string $mesaj, string $dosya, int $satir): bool
{
    if ((error_reporting() & $no) === 0) {
        return false;
    }
    if ($no === E_DEPRECATED || $no === E_USER_DEPRECATED) {
        kayit('uyari: kullanimdan kalkan islev @' . basename($dosya) . ':' . $satir);
        return true;
    }
    throw new ErrorException($mesaj, 0, $no, $dosya, $satir);
}

function et_istisna_isleyici(\Throwable $e): void
{
    genel_500($e);
}

function et_kapanis_isleyici(): void
{
    $e = error_get_last();
    if ($e !== null && in_array($e['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_PARSE, E_RECOVERABLE_ERROR], true)) {
        genel_500(new ErrorException($e['message'], 0, $e['type'], $e['file'], $e['line']));
    }
}

/**
 * Genel 500: DOSYA YOLU, mesaj ve yigin ASLA disari cikmaz; yalniz istek kimligi (ref).
 * Log'a: istisna sinifi + dosya adi:satir (yol ve mesaj yok — mesajlar kisisel veri tasiyabilir).
 */
function genel_500(\Throwable $e): void
{
    static $islendi = false;
    if ($islendi) {
        return;
    }
    $islendi = true;
    $b = istek_baglami();
    kayit($b['ad'] . ': beklenmeyen hata ' . $b['rid'] . ' ' . get_class($e) . ' @' . basename($e->getFile()) . ':' . $e->getLine()
        . ($b['no'] !== '' ? ' ' . $b['no'] : ''));
    if (headers_sent()) {
        return;
    }
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    try {
        guvenlik_basliklari();
        if ($b['ad'] === 'webhook') {
            http_response_code(500);
            header('Content-Type: text/plain; charset=utf-8');
            echo 'hata ' . $b['rid'];
            return;
        }
        $ref = '<p class="ref">ref: ' . h($b['rid']) . ($b['no'] !== '' ? ' · ' . h($b['no']) : '') . '</p>';
        if ($b['dil'] === 'tr' && in_array($b['ad'], ['orders', 'test'], true)) {
            mini_sayfa('tr', 'Beklenmeyen hata', '<p>İşlem tamamlanamadı. Sorun sürerse aşağıdaki kodu geliştiriciye iletin.</p>' . $ref, 0, '', 500);
        } else {
            $dil = dil_sec($b['dil']);
            mini_sayfa($dil, t($dil, 'err_t'), '<p>' . h(t($dil, 'err_pay')) . '</p>' . $ref, 0, '', 500);
        }
    } catch (\Throwable) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: text/plain; charset=utf-8');
        }
        echo 'hata ' . $b['rid'];
    }
}

// ---------------------------------------------------------------- istek okuma

/**
 * Istek govdesini okur (en fazla $sinir bayt). Asarsa null doner (cagiran 413 verir).
 * Content-Length asiri buyukse govde hic okunmaz.
 */
function govde_oku(int $sinir = GOVDE_SINIRI): ?string
{
    $uz = $_SERVER['CONTENT_LENGTH'] ?? '';
    if (is_string($uz) && ctype_digit($uz) && (int) $uz > $sinir) {
        return null;
    }
    $f = fopen('php://input', 'rb');
    if ($f === false) {
        return '';
    }
    $ham = stream_get_contents($f, $sinir + 1);
    fclose($f);
    if (!is_string($ham)) {
        return '';
    }
    return strlen($ham) > $sinir ? null : $ham;
}

/** Tek bir IP mi? Gecerliyse standart yazimi (IPv6 kisaltilmis) doner, degilse null. */
function ip_normalize(string $ip): ?string
{
    if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
        return null;
    }
    $b = @inet_pton($ip);
    if ($b === false) {
        return null;
    }
    $n = inet_ntop($b);
    return $n === false ? null : $n;
}

/**
 * Istemci IP'si: REMOTE_ADDR. Yapilandirmada 'trusted_proxy_header' (orn. HTTP_X_FORWARDED_FOR) verilmisse
 * o basligin ILK gecerli IP'si (virgulle ayrilmis listede). Yalniz guvenilir bir ters vekil arkasinda tanimlayin:
 * aksi halde istemci basligi taklit edip oran sinirini atlatabilir.
 */
function istemci_ip(): string
{
    $baslik = cfg()['trusted_proxy_header'];
    if ($baslik !== '') {
        $ham = $_SERVER[$baslik] ?? '';
        if (is_string($ham) && $ham !== '') {
            foreach (explode(',', $ham) as $aday) {
                $ip = ip_normalize(trim($aday));
                if ($ip !== null) {
                    return $ip;
                }
            }
        }
    }
    $ra = $_SERVER['REMOTE_ADDR'] ?? '';
    return (is_string($ra) ? ip_normalize($ra) : null) ?? 'bilinmiyor';
}

// ---------------------------------------------------------------- Origin / Referer (CSRF katmani)

/** URL'den "host[:port]" (kucuk harf; varsayilan port atilir). http/https disi veya bozuksa null. */
function url_host(string $url): ?string
{
    $u = parse_url($url);
    if (!is_array($u) || !isset($u['host'], $u['scheme'])) {
        return null;
    }
    $sema = strtolower((string) $u['scheme']);
    if ($sema !== 'http' && $sema !== 'https') {
        return null;
    }
    $host = strtolower((string) $u['host']);
    $port = isset($u['port']) ? (int) $u['port'] : 0;
    if ($port > 0 && !(($sema === 'https' && $port === 443) || ($sema === 'http' && $port === 80))) {
        $host .= ':' . $port;
    }
    return $host;
}

/** Izinli host kumesi: site_url (+ www. / www'suz esi) ve istegin kendi Host'u (Node katmaniyla ayni). */
function izinli_hostlar(): array
{
    $kume = [];
    $site = url_host(cfg()['site_url']);
    if ($site !== null) {
        $kume[$site] = true;
        $kume[str_starts_with($site, 'www.') ? substr($site, 4) : 'www.' . $site] = true;
    }
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (is_string($host) && $host !== '') {
        $h = url_host('http://' . $host);
        if ($h !== null) {
            $kume[$h] = true;
        }
    }
    return $kume;
}

/**
 * Origin veya Referer VARSA host'u izinli kumede olmali; ikisi de yoksa izin verilir (tarayici disi istemci).
 * Origin: null -> yok sayilir (sayfa Referrer-Policy: no-referrer ise tarayici bunu gonderir).
 * Bu yalniz CSRF savunma katmanidir, kimlik dogrulama degildir.
 */
function kaynak_izinli(): bool
{
    $izinli = izinli_hostlar();
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $anahtar) {
        if (!isset($_SERVER[$anahtar])) {
            continue;
        }
        $v = (string) $_SERVER[$anahtar];
        if ($anahtar === 'HTTP_ORIGIN' && $v === 'null') {
            continue;
        }
        $host = url_host($v);
        if ($host === null || !isset($izinli[$host])) {
            return false;
        }
    }
    return true;
}

/** Istek https uzerinden mi geldi (ya da site_url https mi)? Cerez Secure bayragi icin. */
function https_mi(): bool
{
    if (str_starts_with(cfg()['site_url'], 'https://')) {
        return true;
    }
    $https = $_SERVER['HTTPS'] ?? '';
    return (is_string($https) && $https !== '' && strtolower($https) !== 'off') || ($_SERVER['SERVER_PORT'] ?? '') === '443';
}

// ---------------------------------------------------------------- oran siniri + kaba kuvvet (dosya tabanli)

/** orders_dir/rl/ (0700). */
function rl_klasoru(): string
{
    $d = siparis_klasoru() . '/rl';
    if (!is_dir($d)) {
        @mkdir($d, 0700, true);
    }
    if (!is_dir($d) || !is_writable($d)) {
        throw new RuntimeException('rl klasoru kullanilamiyor');
    }
    return $d;
}

/** Kova + IP'den hash'li dosya yolu (IP dosya adinda gorunmez). */
function rl_dosya(string $kova, string $ip): string
{
    return rl_klasoru() . '/' . hash('sha256', $kova . '|' . $ip) . '.json';
}

/**
 * Dosya kilitli oku-degistir-yaz. $f(array $veri): [array|null $yeni, mixed $sonuc]; $yeni null ise dosya silinir.
 */
function rl_islem(string $dosya, callable $f): mixed
{
    $yeni = !is_file($dosya);
    $fp = fopen($dosya, 'c+');
    if ($fp === false) {
        throw new RuntimeException('rl dosyasi acilamadi');
    }
    if ($yeni) {
        @chmod($dosya, 0600);
    }
    try {
        if (!flock($fp, LOCK_EX)) {
            throw new RuntimeException('rl kilidi alinamadi');
        }
        $ham = stream_get_contents($fp);
        $veri = json_decode(is_string($ham) && $ham !== '' ? $ham : '{}', true);
        [$sonraki, $sonuc] = $f(is_array($veri) ? $veri : []);
        if ($sonraki === null) {
            @unlink($dosya);
        } else {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, (string) json_encode($sonraki));
            fflush($fp);
        }
        flock($fp, LOCK_UN);
        return $sonuc;
    } finally {
        fclose($fp);
    }
}

/** Eski rl dosyalarini (varsayilan 2 saatten eski) siler. */
function rl_temizle(int $enAzSn = 7200): int
{
    $say = 0;
    foreach (glob(rl_klasoru() . '/*.json') ?: [] as $d) {
        $m = @filemtime($d);
        if ($m !== false && time() - $m > $enAzSn && @unlink($d)) {
            $say++;
        }
    }
    return $say;
}

/**
 * Kayan pencere oran siniri. $kurallar: [[pencereSn, enFazla], ...]. Reddedilen istek SAYILMAZ.
 * Doner: ['izin' => bool, 'bekleme' => int (saniye; izin varsa 0)].
 */
function oran_siniri_dene(string $kova, string $ip, array $kurallar, ?int $simdi = null): array
{
    if (random_int(1, 100) === 1) {
        rl_temizle();
    }
    $enUzun = 0;
    foreach ($kurallar as [$pencere, $en]) {
        $enUzun = max($enUzun, $pencere);
    }
    $simdi ??= time();
    return rl_islem(rl_dosya($kova, $ip), static function (array $veri) use ($kurallar, $enUzun, $simdi): array {
        $z = array_values(array_filter(
            is_array($veri['t'] ?? null) ? $veri['t'] : [],
            static fn ($x): bool => is_int($x) && $simdi - $x < $enUzun
        ));
        $bekle = 0;
        foreach ($kurallar as [$pencere, $en]) {
            $icinde = array_values(array_filter($z, static fn (int $x): bool => $simdi - $x < $pencere));
            if (count($icinde) >= $en) {
                $bekle = max($bekle, $icinde[0] + $pencere - $simdi);
            }
        }
        if ($bekle > 0) {
            return [['t' => $z], ['izin' => false, 'bekleme' => max(1, $bekle)]];
        }
        $z[] = $simdi;
        return [['t' => $z], ['izin' => true, 'bekleme' => 0]];
    });
}

/** Odeme olusturma siniri: IP basina dakikada 5, saatte 30. */
function create_siniri(string $ip): array
{
    return oran_siniri_dene('create', $ip, [[60, 5], [3600, 30]]);
}

/** Webhook siniri: IP basina dakikada 60. */
function webhook_siniri(string $ip): array
{
    return oran_siniri_dene('webhook', $ip, [[60, 60]]);
}

/** Yonetici girisi kilidi varsa kalan saniye, yoksa 0 (orders + test ortak). */
function kaba_kuvvet_kalan(string $ip, ?int $simdi = null): int
{
    $an = $simdi ?? time();
    $dosya = rl_dosya('admin', $ip);
    if (!is_file($dosya)) {
        return 0;
    }
    return (int) rl_islem($dosya, static function (array $k) use ($an): array {
        $kilit = (int) ($k['kilit'] ?? 0);
        if ($kilit <= 0) {
            return [$k === [] ? null : $k, 0];
        }
        if ($an >= $kilit) {
            return [null, 0];
        }
        return [$k, $kilit - $an];
    });
}

/** BASARISIZ giris kaydeder. Kilit devreye girdiyse (5. yanlis deneme dahil) kalan saniye, aksi 0. */
function kaba_kuvvet_basarisiz(string $ip, ?int $simdi = null): int
{
    $an = $simdi ?? time();
    return (int) rl_islem(rl_dosya('admin', $ip), static function (array $k) use ($an): array {
        $son = (int) ($k['son'] ?? 0);
        if ($k === [] || $an - $son > KILIT_SN) {
            $k = ['n' => 0, 'son' => $an, 'kilit' => 0];
        }
        $k['n'] = (int) ($k['n'] ?? 0) + 1;
        $k['son'] = $an;
        if ($k['n'] >= KILIT_DENEME) {
            $k['kilit'] = $an + KILIT_SN;
        }
        return [$k, $k['kilit'] > 0 ? $k['kilit'] - $an : 0];
    });
}

/** Dogru giriste sayaci sifirlar. */
function kaba_kuvvet_temizle(string $ip): void
{
    $dosya = rl_dosya('admin', $ip);
    if (is_file($dosya)) {
        @unlink($dosya);
    }
}

// ---------------------------------------------------------------- yonetici oturumu + CSRF

/** Yonetici sifresi dogru mu? (bos sifre = kapali; iki tarafin SHA-256'si hash_equals ile: uzunluk sizdirmaz) */
function admin_sifre_dogru(string $girilen): bool
{
    $s = cfg()['admin_password'];
    if ($s === '') {
        return false;
    }
    return hash_equals(hash('sha256', $s), hash('sha256', trim($girilen)));
}

/** Oturum dosyalari icin ozel klasor (orders_dir/sess, 0700); kurulamazsa null (varsayilan yol). */
function oturum_dizini(): ?string
{
    try {
        $d = siparis_klasoru() . '/sess';
        if (!is_dir($d)) {
            @mkdir($d, 0700, true);
        }
        return is_dir($d) && is_writable($d) ? $d : null;
    } catch (\Throwable) {
        return null;
    }
}

/**
 * Oturumu baslatir: cerez adi et_admin, Secure (https ise), HttpOnly, SameSite=Strict, path=/pay/,
 * use_strict_mode, 12 saat. orders.php ve test.php ORTAK oturumu kullanir.
 */
function admin_oturum_baslat(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $dizin = oturum_dizini();
    if ($dizin !== null) {
        session_save_path($dizin);
    }
    session_name('et_admin');
    session_cache_limiter('');   // PHP'nin kendi Cache-Control/Expires basliklari bizim no-store'umuzu ezmesin
    @ini_set('session.use_strict_mode', '1');
    @ini_set('session.use_only_cookies', '1');
    @ini_set('session.use_trans_sid', '0');
    @ini_set('session.gc_maxlifetime', (string) OTURUM_SN);
    @ini_set('session.gc_probability', '1');
    @ini_set('session.gc_divisor', '100');
    session_set_cookie_params([
        'lifetime' => OTURUM_SN,
        'path' => '/pay/',
        'secure' => https_mi(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

/** Dogru sifreden sonra: oturum kimligi yenilenir (fixation), CSRF belirteci tazelenir. */
function admin_oturum_ac(): void
{
    session_regenerate_id(true);
    $_SESSION = ['giris' => true, 'giris_zamani' => time(), 'csrf' => bin2hex(random_bytes(32))];
}

/** Giris yapilmis ve 12 saat dolmamis mi? */
function admin_oturum_var(): bool
{
    if (cfg()['admin_password'] === '' || empty($_SESSION['giris'])) {
        return false;
    }
    $z = $_SESSION['giris_zamani'] ?? 0;
    return is_int($z) && time() - $z < OTURUM_SN;
}

/** Oturumu ve cerezi siler. */
function admin_oturum_kapat(): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    setcookie('et_admin', '', [
        'expires' => time() - 3600, 'path' => '/pay/', 'secure' => https_mi(), 'httponly' => true, 'samesite' => 'Strict',
    ]);
}

/** Oturuma bagli CSRF belirteci (yoksa uretilir). Giris oncesi formlar da kullanir. */
function csrf_belirteci(): string
{
    if (!isset($_SESSION['csrf']) || !is_string($_SESSION['csrf']) || strlen($_SESSION['csrf']) < 32) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Gelen belirteç oturumdakiyle esit mi (sabit zamanli)? */
function csrf_dogru(mixed $gelen): bool
{
    $b = $_SESSION['csrf'] ?? null;
    return is_string($gelen) && is_string($b) && $b !== '' && hash_equals($b, $gelen);
}
