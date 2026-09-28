<?php
// ============================================================
// PHP VEKTOR KOSUCUSU (CLI) — paylasilan-vektorler.json'u ve Node'dan uretilmis beklenen degerleri PHP
// fonksiyonlarina karsi calistirir. test_php_pay.py tarafindan cagrilir:
//
//   php [-d disable_classes=Normalizer] vektor_test.php <pay_dizini> <girdi.json>
//
// girdi.json: {"vektorler": <paylasilan-vektorler.json>,
//              "norm":   [[girdi, node_normalize_sonucu], ...],   // mesafe_normalize
//              "yerbul": [[girdi, node_yerBul_sonucu|null], ...],  // mesafe_yer_bul
//              "dahili": [[a, b, node_dahiliMesafe|null], ...]}    // mesafe_dahili
// Cikti (stdout, tek satir JSON): {"say": N, "hatalar": [...], "intl": bool, "bolum_say": {...}}
// <pay_dizini>: create.php, mesafe.json vb. dosyalarin bulundugu klasor (gecici www/pay kopyasi).
// ============================================================
declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Kullanim: php vektor_test.php <pay_dizini> <girdi.json>\n");
    exit(2);
}
$payDizini = rtrim($argv[1], '/');
$girdi = json_decode((string) file_get_contents($argv[2]), true);
if (!is_array($girdi)) {
    fwrite(STDERR, "girdi.json okunamadi\n");
    exit(2);
}

// ORDERS_DIR verilmemisse bile yan etki olmasin: bu kosucu dosya yazmaz (fonksiyonlar saf)
require $payDizini . '/create.php';   // CLI'da yalniz fonksiyonlari tanimlar (girdi.php, mesafe.php, mailer.php dahil)

$hatalar = [];
$say = 0;
$bolum = [];
$k = static function (string $b, bool $kosul, string $mesaj) use (&$hatalar, &$say, &$bolum): void {
    $say++;
    $bolum[$b] = ($bolum[$b] ?? 0) + 1;
    if (!$kosul) {
        $hatalar[] = '[' . $b . '] ' . $mesaj;
    }
};
$j = static fn (mixed $x): string => (string) json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);

$V = $girdi['vektorler'];

// ---- fiyat
foreach ($V['fiyat'] as $f) {
    [$t, $ka, $kl] = fiyat_hesapla((int) $f['km']);
    $k('fiyat', $t === (float) $f['toplam'] && $ka === (float) $f['kapora'] && $kl === (float) $f['kalan'],
        'km=' . $f['km'] . ': beklenen ' . $j([$f['toplam'], $f['kapora'], $f['kalan']]) . ' bulunan ' . $j([$t, $ka, $kl]));
}

// ---- km_karar
foreach ($V['km_karar'] as $c) {
    $r = mesafe_karar((int) $c['istemci'], $c['google'] === null ? null : (int) $c['google'],
        $c['dahili'] === null ? null : (int) $c['dahili'], $c['tol']);
    $b = $r['km'] === null ? 'RET' : $r['km'];
    $k('km_karar', $b === $c['beklenen'], $j([$c['istemci'], $c['google'], $c['dahili'], $c['tol']]) . ': beklenen ' . $j($c['beklenen']) . ' bulunan ' . $j($b));
    if ($r['km'] !== null) {
        $k('km_karar', in_array($r['kaynak'], ['google', 'dahili', 'istemci'], true), 'kaynak alani gecersiz: ' . $j($r));
    } else {
        $k('km_karar', in_array($r['sebep'], ['aralik', 'dogrulanamadi'], true), 'RET sebep alani gecersiz: ' . $j($r));
    }
}

// ---- yer_bul + dahili_mesafe (vektorler)
foreach ($V['yer_bul'] as $c) {
    $r = mesafe_yer_bul($c['girdi']);
    $k('yer_bul', $r === $c['beklenen'], $j($c['girdi']) . ': beklenen ' . $j($c['beklenen']) . ' bulunan ' . $j($r));
}
foreach ($V['dahili_mesafe'] as $c) {
    $r = mesafe_dahili($c['a'], $c['b']);
    $k('dahili_mesafe', $r === $c['km'], $j([$c['a'], $c['b']]) . ': beklenen ' . $j($c['km']) . ' bulunan ' . $j($r));
}

// ---- Node'dan uretilmis genis kapsam (normalize / yerBul / dahiliMesafe)
foreach ($girdi['norm'] ?? [] as [$in, $beklenen]) {
    $r = mesafe_normalize($in);
    $k('normalize', $r === $beklenen, $j($in) . ' (' . bin2hex($in) . '): Node ' . $j($beklenen) . ' PHP ' . $j($r));
}
foreach ($girdi['yerbul'] ?? [] as [$in, $beklenen]) {
    $r = mesafe_yer_bul($in);
    $k('yerbul_fuzz', $r === $beklenen, $j($in) . ': Node ' . $j($beklenen) . ' PHP ' . $j($r));
}
foreach ($girdi['dahili'] ?? [] as [$a, $b, $beklenen]) {
    $r = mesafe_dahili($a, $b);
    $k('dahili_fuzz', $r === $beklenen, $j([$a, $b]) . ': Node ' . $j($beklenen) . ' PHP ' . $j($r));
}

// ---- dogrulama
$simdi = new DateTimeImmutable($V['dogrulama_bugun']['simdi_utc']);
$k('dogrulama', girdi_bugun($simdi) === $V['dogrulama_bugun']['bugun_brussels'],
    'girdi_bugun(' . $V['dogrulama_bugun']['simdi_utc'] . ') = ' . girdi_bugun($simdi));
$cikti = ['km' => 'km_istemci'];
foreach ($V['dogrulama'] as $c) {
    $ham = array_merge($V['dogrulama_taban'], $c['baglam'] ?? []);
    $tumu = [];
    foreach ($ham as $a => $v) {
        $tumu[$a] = [$v];
    }
    $tumu[$c['alan']] = is_array($c['deger']) ? array_values($c['deger']) : [$c['deger']];
    $yh = girdi_yapisal_hata($tumu);
    if ($yh !== null) {
        $s = ['ok' => false, 'alan' => $yh, 'anahtar' => GIRDI_ALAN_MESAJI[$yh]];
    } else {
        $duz = [];
        foreach ($tumu as $a => $v) {
            $duz[$a] = $v[0];
        }
        $s = girdi_dogrula($duz, $simdi);
    }
    $ad = $c['alan'] . '=' . $j($c['deger']) . ' (' . $c['sebep'] . ')';
    $k('dogrulama', $s['ok'] === $c['gecerli'], $ad . ': beklenen gecerli=' . $j($c['gecerli']) . ' bulunan ' . $j($s));
    if (!$c['gecerli'] && !$s['ok']) {
        $k('dogrulama', $s['alan'] === $c['hata_alani'], $ad . ': hata alani ' . $c['hata_alani'] . ' beklenirdi, ' . $s['alan']);
        $k('dogrulama', $s['anahtar'] === $c['mesaj'], $ad . ': mesaj ' . $c['mesaj'] . ' beklenirdi, ' . $s['anahtar']);
    }
    if ($c['gecerli'] && $s['ok'] && array_key_exists('temiz', $c)) {
        $alan = $cikti[$c['alan']] ?? $c['alan'];
        $k('dogrulama', $s['deger'][$alan] === $c['temiz'], $ad . ': temiz ' . $j($c['temiz']) . ' beklenirdi, ' . $j($s['deger'][$alan] ?? null));
    }
}

echo json_encode(['say' => $say, 'hatalar' => $hatalar, 'intl' => girdi_intl_var(), 'bolum_say' => $bolum], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE), "\n";
