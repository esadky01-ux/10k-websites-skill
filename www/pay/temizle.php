<?php
// ============================================================
// EUROPA TAXI — veri saklama / temizlik (GDPR uyumlu; gizlilik politikasindaki "12 ay / 7 yil" ifadesiyle uyumlu)
//
// Kurallar:
//  (i)   ODENMEMIS siparisler (odeme_baslatilamadi, beklemede, iptal, suresi_doldu, basarisiz)
//        olusturulmasindan 30 gun sonra SILINIR.
//  (ii)  ODENMIS siparislerde (odendi, iade, chargeback, tutar_uyusmazligi) yolculuk tarihinden (donus varsa
//        donus tarihinden) 12 AY sonra kisisel alanlar (ad, e-posta, telefon, alis, varis) ANONIMLESTIRILIR.
//        Referans no, tarihler, km ve tutarlar (muhasebe) SAKLANIR.
//  (ii-b) Yolculuk tarihinden 7 YIL sonra (yasal muhasebe saklama suresi biter) anonim kayit da silinir.
//  (iii) kayit.log icinde 90 gunden eski satirlar atilir.
//  (iv)  Ek: eski oran siniri dosyalari, oturum dosyalari, yarim kalmis gecici dosyalar ve sahipsiz kilit
//        dosyalari temizlenir. 'dry-run' modunda hicbir sey degismez; yalniz ozet doner.
//
// Kullanim (cron ornegi: haftada bir, gece):
//   0 3 * * 0  php /yol/pay/temizle.php
//   php pay/temizle.php --dry-run       (yalniz ozet; hicbir sey silinmez/degismez)
//   php pay/temizle.php --json          (makine okunur ozet)
// Web'den DOGRUDAN calismaz (pay/.htaccess beyaz listesinde yok); orders.php icindeki "Veri temizligi" bolumu
// POST + CSRF ile temizle_calistir()'i cagirir.
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';

const TEMIZLE_ODENMEMIS_GUN = 30;
const TEMIZLE_ANONIM_AY = 12;
const TEMIZLE_MUHASEBE_YIL = 7;
const TEMIZLE_LOG_GUN = 90;
const TEMIZLE_ANONIM_METIN = '[anonim]';

/** Yolculugun bittigi gun (gidis ve varsa donus tarihinin buyugu); okunamazsa null. */
function temizle_yolculuk_tarihi(array $s): ?DateTimeImmutable
{
    $en = null;
    foreach (['tarih', 'donus_tarih'] as $alan) {
        $v = (string) ($s[$alan] ?? '');
        if (preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}\z/', $v) === 1) {
            $d = DateTimeImmutable::createFromFormat('!Y-m-d', $v);
            if ($d !== false && ($en === null || $d > $en)) {
                $en = $d;
            }
        }
    }
    return $en;
}

/** Siparisin olusturulma zamani (olusturma alani; yoksa dosya mtime). */
function temizle_olusturma(array $s, string $yol): ?DateTimeImmutable
{
    $o = (string) ($s['olusturma'] ?? '');
    if ($o !== '') {
        try {
            return new DateTimeImmutable($o);
        } catch (\Throwable) {
            // asagida mtime
        }
    }
    $m = @filemtime($yol);
    return $m === false ? null : (new DateTimeImmutable('@' . $m))->setTimezone(new DateTimeZone('Europe/Brussels'));
}

/**
 * Temizligi calistirir. $kuru=true: hicbir sey degismez. $simdi: referans zaman (varsayilan: su an).
 * Doner ozet dizisi (siparis NUMARALARI listelenir, kisisel veri YOK).
 */
function temizle_calistir(bool $kuru = false, ?DateTimeImmutable $simdi = null): array
{
    $simdi ??= new DateTimeImmutable('now');
    $sinirOdenmemis = $simdi->modify('-' . TEMIZLE_ODENMEMIS_GUN . ' days');
    $sinirAnonim = $simdi->modify('-' . TEMIZLE_ANONIM_AY . ' months');
    $sinirMuhasebe = $simdi->modify('-' . TEMIZLE_MUHASEBE_YIL . ' years');
    $ozet = [
        'kuru' => $kuru,
        'zaman' => $simdi->format('c'),
        'silinen_odenmemis' => [],
        'anonimlestirilen' => [],
        'silinen_muhasebe' => [],
        'bozuk_dosya' => 0,
        'log_atilan' => 0,
        'log_kalan' => 0,
        'rl_silinen' => 0,
        'oturum_silinen' => 0,
        'gecici_silinen' => 0,
        'kilit_silinen' => 0,
    ];

    foreach (siparis_dosyalari() as $no => $yol) {
        $s = siparis_oku($no);
        if ($s === null) {
            $ozet['bozuk_dosya']++;
            continue;
        }
        $durum = (string) ($s['durum'] ?? '');
        if (in_array($durum, DURUM_ODENMEMIS, true)) {
            $o = temizle_olusturma($s, $yol);
            if ($o !== null && $o < $sinirOdenmemis) {
                $ozet['silinen_odenmemis'][] = $no;
                if (!$kuru) {
                    siparis_sil($no);
                }
            }
        } elseif (in_array($durum, DURUM_ODENMIS, true)) {
            $y = temizle_yolculuk_tarihi($s);
            if ($y === null) {
                continue;   // tarih okunamiyorsa dokunma (muhasebe verisi)
            }
            if ($y < $sinirMuhasebe) {
                $ozet['silinen_muhasebe'][] = $no;
                if (!$kuru) {
                    siparis_sil($no);
                }
            } elseif ($y < $sinirAnonim && empty($s['anonim'])) {
                $ozet['anonimlestirilen'][] = $no;
                if (!$kuru) {
                    siparis_guncelle($no, static function (array $x) use ($simdi): ?array {
                        if (!empty($x['anonim'])) {
                            return $x;
                        }
                        foreach (['ad', 'alis', 'varis'] as $alan) {
                            $x[$alan] = TEMIZLE_ANONIM_METIN;
                        }
                        $x['eposta'] = '';
                        $x['telefon'] = '';
                        $x['anonim'] = $simdi->format('c');
                        return $x;
                    });
                }
            }
        }
    }

    // ---- kayit.log: 90 gunden eski satirlar
    [$ozet['log_atilan'], $ozet['log_kalan']] = temizle_log($kuru, $simdi->modify('-' . TEMIZLE_LOG_GUN . ' days'));

    // ---- yardimci dosyalar
    $k = siparis_klasoru();
    foreach (glob($k . '/rl/*.json') ?: [] as $d) {
        $m = @filemtime($d);
        if ($m !== false && $simdi->getTimestamp() - $m > 7200) {
            $ozet['rl_silinen']++;
            if (!$kuru) {
                @unlink($d);
            }
        }
    }
    foreach (glob($k . '/sess/sess_*') ?: [] as $d) {
        $m = @filemtime($d);
        if ($m !== false && $simdi->getTimestamp() - $m > 2 * 86400) {
            $ozet['oturum_silinen']++;
            if (!$kuru) {
                @unlink($d);
            }
        }
    }
    foreach (glob($k . '/.tmp*') ?: [] as $d) {
        $m = @filemtime($d);
        if ($m !== false && $simdi->getTimestamp() - $m > 3600) {
            $ozet['gecici_silinen']++;
            if (!$kuru) {
                @unlink($d);
            }
        }
    }
    foreach (glob($k . '/ET-*.json.lock') ?: [] as $d) {
        if (!is_file(substr($d, 0, -5))) {   // sahibi (siparis) yok
            $ozet['kilit_silinen']++;
            if (!$kuru) {
                @unlink($d);
            }
        }
    }

    if (!$kuru) {
        kayit('bilgi: temizle: silinen=' . count($ozet['silinen_odenmemis']) . ' anonim=' . count($ozet['anonimlestirilen'])
            . ' muhasebe_silinen=' . count($ozet['silinen_muhasebe']) . ' log_atilan=' . $ozet['log_atilan']);
    }
    return $ozet;
}

/**
 * kayit.log'dan $sinir'dan eski satirlari atar (satir basi "YYYY-MM-DD HH:MM:SS  "). Tarihsiz satir bir onceki
 * satirin kararina uyar. Doner: [atilan, kalan]. $kuru: dosya degismez.
 */
function temizle_log(bool $kuru, DateTimeImmutable $sinir): array
{
    $yol = siparis_klasoru() . '/kayit.log';
    if (!is_file($yol)) {
        return [0, 0];
    }
    $fp = fopen($yol, 'c+');
    if ($fp === false) {
        return [0, 0];
    }
    try {
        flock($fp, LOCK_EX);
        $ham = (string) stream_get_contents($fp);
        $esik = $sinir->format('Y-m-d');
        $kalan = [];
        $atilan = 0;
        $tut = true;
        foreach (preg_split('/\n/', $ham) ?: [] as $satir) {
            if ($satir === '') {
                continue;
            }
            if (preg_match('/^([0-9]{4}-[0-9]{2}-[0-9]{2}) [0-9]{2}:[0-9]{2}:[0-9]{2}  /', $satir, $m) === 1) {
                $tut = strcmp($m[1], $esik) >= 0;
            }
            if ($tut) {
                $kalan[] = $satir;
            } else {
                $atilan++;
            }
        }
        if (!$kuru && $atilan > 0) {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, $kalan === [] ? '' : implode("\n", $kalan) . "\n");
            fflush($fp);
        }
        flock($fp, LOCK_UN);
        return [$atilan, count($kalan)];
    } finally {
        fclose($fp);
    }
}

/** Ozeti okunur Turkce metne cevirir (CLI ve panel icin). */
function temizle_ozet_metni(array $o): string
{
    $satirlar = [$o['kuru'] ? 'KURU CALISTIRMA — hicbir sey silinmedi/degismedi' : 'Temizlik tamamlandi', 'Zaman: ' . $o['zaman']];
    $liste = static fn (array $l): string => $l === [] ? '-' : implode(', ', $l);
    $satirlar[] = 'Silinen odenmemis siparis (30 gunden eski): ' . count($o['silinen_odenmemis']) . '  ' . $liste($o['silinen_odenmemis']);
    $satirlar[] = 'Anonimlestirilen odenmis siparis (yolculuktan 12 ay sonra): ' . count($o['anonimlestirilen']) . '  ' . $liste($o['anonimlestirilen']);
    $satirlar[] = 'Silinen muhasebe kaydi (7 yil doldu): ' . count($o['silinen_muhasebe']) . '  ' . $liste($o['silinen_muhasebe']);
    $satirlar[] = 'kayit.log: ' . $o['log_atilan'] . ' satir atildi (90 gunden eski), ' . $o['log_kalan'] . ' kaldi';
    $satirlar[] = 'Eski oran siniri dosyasi: ' . $o['rl_silinen'] . ', oturum dosyasi: ' . $o['oturum_silinen']
        . ', gecici dosya: ' . $o['gecici_silinen'] . ', sahipsiz kilit: ' . $o['kilit_silinen'];
    if ($o['bozuk_dosya'] > 0) {
        $satirlar[] = 'UYARI: okunamayan siparis dosyasi: ' . $o['bozuk_dosya'] . ' (dokunulmadi)';
    }
    return implode("\n", $satirlar) . "\n";
}

// ---- CLI girisi: yalniz bu dosya dogrudan `php temizle.php` ile calistirilirsa
if (PHP_SAPI === 'cli' && isset($argv[0]) && @realpath((string) $argv[0]) === __FILE__) {
    $args = array_slice($argv, 1);
    $bilinen = ['--dry-run', '--kuru', '--json', '--yardim', '--help'];
    if (array_diff($args, $bilinen) !== [] || in_array('--yardim', $args, true) || in_array('--help', $args, true)) {
        fwrite(STDERR, "Kullanim: php temizle.php [--dry-run] [--json]\n");
        exit(array_diff($args, $bilinen) !== [] ? 2 : 0);
    }
    $kuru = in_array('--dry-run', $args, true) || in_array('--kuru', $args, true);
    $ozet = temizle_calistir($kuru);
    echo in_array('--json', $args, true)
        ? json_encode($ozet, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
        : temizle_ozet_metni($ozet);
    exit(0);
}
