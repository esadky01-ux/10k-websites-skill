<?php
// ============================================================
// EUROPA TAXI — e-posta gonderimi (sartname §8)
// Birincil: Brevo API (ucretsiz 300 e-posta/gun). Yedek: PHP mail().
// Brevo anahtari yoksa yine calisir ama spam riski kayit dosyasina yazilir.
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';

/**
 * E-posta gonderir. Doner: ['ok' => bool, 'yontem' => 'brevo'|'mail', 'hata' => ?string]
 */
function eposta_gonder(string $kime, string $konu, string $html, string $duzMetin = ''): array
{
    $c = cfg();
    $brevo = trim((string) $c['brevo_api_key']);
    $gonderen = $c['mail_from'];

    if ($brevo !== '') {
        $govde = [
            'sender'      => ['name' => 'Europa Taxi', 'email' => $gonderen],
            'to'          => [['email' => $kime]],
            'subject'     => $konu,
            'htmlContent' => $html,
        ];
        if ($duzMetin !== '') {
            $govde['textContent'] = $duzMetin;
        }
        $ch = curl_init('https://api.brevo.com/v3/smtp/email');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($govde, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => [
                'api-key: ' . $brevo,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
        ]);
        $yanit = curl_exec($ch);
        $kod = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $curlHata = curl_error($ch);
        curl_close($ch);
        if ($yanit !== false && $kod >= 200 && $kod < 300) {
            return ['ok' => true, 'yontem' => 'brevo', 'hata' => null];
        }
        // Brevo basarisiz -> mail() yedegine dus, sebebi kaydet
        kayit('Brevo hatasi (' . $kod . '): ' . ($curlHata !== '' ? $curlHata : substr((string) $yanit, 0, 200)));
    } else {
        kayit('Brevo anahtari bos: PHP mail() kullanildi, spam klasorune dusme riski var. ' . $kime);
    }

    // ---- Yedek: PHP mail() ----
    $sinir = 'et' . bin2hex(random_bytes(8));
    $basliklar = 'From: Europa Taxi <' . $gonderen . ">\r\n"
        . "MIME-Version: 1.0\r\n"
        . 'Content-Type: multipart/alternative; boundary="' . $sinir . '"';
    $icerik = '--' . $sinir . "\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
        . ($duzMetin !== '' ? $duzMetin : strip_tags($html)) . "\r\n"
        . '--' . $sinir . "\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
        . $html . "\r\n"
        . '--' . $sinir . "--\r\n";
    $konuKodlu = '=?UTF-8?B?' . base64_encode($konu) . '?=';
    $ok = @mail($kime, $konuKodlu, $icerik, $basliklar);
    if (!$ok) {
        kayit('mail() da basarisiz oldu: ' . $kime . ' / ' . $konu);
    }
    return ['ok' => $ok, 'yontem' => 'mail', 'hata' => $ok ? null : 'mail() false dondu'];
}

/** Siparisten arac adini uretir ("Ekonomi (Tesla Model 3)" gibi, musteri dilinde). */
function arac_adi(string $dil, string $arac): string
{
    $eslesme = ['eco' => 'veh_eco', 'wagon' => 'veh_wagon', 'vip' => 'veh_vip'];
    $on = $eslesme[$arac] ?? 'veh_eco';
    return t($dil, $on . '_name') . ' (' . t($dil, $on . '_model') . ')';
}

/**
 * Musteriye giden HTML onay e-postasi (kendi dilinde, marka renkli).
 * Icerik: rezervasyon no, guzergah, tarih, arac, odenen, aracta odenecek,
 * iptal politikasi, sirket bilgileri. (sartname §8)
 */
function musteri_eposta_html(array $s): string
{
    $dil = dil_sec($s['dil'] ?? 'fr');
    $i = isletme();

    $satir = static function (string $etiket, string $deger): string {
        return '<tr>'
            . '<td style="padding:9px 0;color:#6E7080;font-size:13px;vertical-align:top;white-space:nowrap;padding-right:18px;">' . h($etiket) . '</td>'
            . '<td style="padding:9px 0;color:#1A1A1F;font-size:14px;font-weight:600;">' . h($deger) . '</td>'
            . '</tr>';
    };

    $satirlar = $satir(t($dil, 'em_ref'), $s['no'])
        . $satir(t($dil, 'em_route'), $s['alis'] . ' → ' . $s['varis'])
        . $satir(t($dil, 'em_date'), tarih_goster($dil, $s['tarih'], $s['saat']));
    if (!empty($s['donus_tarih'])) {
        $satirlar .= $satir(t($dil, 'em_return'), tarih_goster($dil, $s['donus_tarih'], $s['donus_saat'] ?? ''));
    }
    $satirlar .= $satir(t($dil, 'em_vehicle'), arac_adi($dil, $s['arac']))
        . $satir(t($dil, 'em_pax'), (string) $s['yolcu'])
        . $satir(t($dil, 'em_bags'), $s['buyuk'] . ' + ' . $s['kucuk'])
        . $satir(t($dil, 'em_paid'), para($dil, (float) $s['kapora']))
        . $satir(t($dil, 'em_due'), para($dil, (float) $s['kalan']));

    return '<!doctype html><html><body style="margin:0;padding:0;background:#F2F2F4;">
<div style="max-width:560px;margin:0 auto;padding:24px 14px;font-family:Arial,Helvetica,sans-serif;">
  <div style="background:#0A0A0C;border-radius:14px 14px 0 0;padding:22px 28px;">
    <span style="font-size:20px;font-weight:900;letter-spacing:1px;color:#FFFFFF;">EUROPA<span style="color:#FFC107;">TAXI</span></span>
  </div>
  <div style="height:4px;background:#FFC107;"></div>
  <div style="background:#FFFFFF;border-radius:0 0 14px 14px;padding:28px;">
    <h1 style="margin:0 0 6px;font-size:21px;color:#1A1A1F;">' . h(t($dil, 'em_heading')) . '</h1>
    <p style="margin:0 0 18px;color:#55565E;font-size:14px;">' . h(t($dil, 'em_intro', ['name' => $s['ad']])) . '</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #ECECEF;">' . $satirlar . '</table>
    <div style="margin-top:20px;padding:14px 16px;background:#FFF8E4;border-radius:10px;">
      <b style="font-size:13px;color:#8a6d00;">' . h(t($dil, 'em_cancel_t')) . '</b>
      <p style="margin:6px 0 0;font-size:13px;color:#6b6b6b;">' . h(t($dil, 'cancel_policy')) . '</p>
    </div>
    <p style="margin:20px 0 0;font-size:13px;color:#55565E;">' . h(t($dil, 'em_outro', ['phone' => $i['telefon'] ?? ''])) . '</p>
    <p style="margin:22px 0 0;font-size:11px;color:#9A9BA3;">
      Europa Taxi · ' . h(($i['unvan'] ?? '') . ' · ' . ($i['kdv'] ?? '')) . '<br>'
        . h($i['adres'] ?? '') . '<br>'
        . h(($i['telefon'] ?? '') . ' · ' . ($i['eposta'] ?? '')) . '
    </p>
  </div>
</div>
</body></html>';
}

/**
 * Sirkete giden duz metin is emri (sartname §8): musteri bilgileri,
 * guzergah, tarih, arac, yolcu/bagaj, aracta tahsil edilecek tutar.
 */
function sirket_eposta_metni(array $s): string
{
    $donus = !empty($s['donus_tarih'])
        ? tarih_goster('tr', $s['donus_tarih'], $s['donus_saat'] ?? '')
        : '-';
    $dogrulama = $s['km_sunucu'] !== null
        ? $s['km_sunucu'] . ' km (Google ile dogrulandi)'
        : 'dogrulanamadi (sunucu anahtari yok/ulasilamadi)';
    return "YENI REZERVASYON — KAPORA ODENDI\n"
        . "================================\n"
        . 'Referans     : ' . $s['no'] . "\n"
        . 'Musteri      : ' . $s['ad'] . "\n"
        . 'Telefon      : ' . $s['telefon'] . "\n"
        . 'E-posta      : ' . $s['eposta'] . "\n"
        . "--------------------------------\n"
        . 'Guzergah     : ' . $s['alis'] . ' -> ' . $s['varis'] . "\n"
        . 'Alis         : ' . tarih_goster('tr', $s['tarih'], $s['saat']) . "\n"
        . 'Donus        : ' . $donus . "\n"
        . 'Arac         : ' . arac_adi('tr', $s['arac']) . "\n"
        . 'Yolcu        : ' . $s['yolcu'] . "\n"
        . 'Valiz        : ' . $s['buyuk'] . ' buyuk + ' . $s['kucuk'] . ' kucuk' . "\n"
        . "--------------------------------\n"
        . 'Mesafe       : ' . $s['km'] . ' km (istemci: ' . $s['km_istemci'] . ' / sunucu: ' . $dogrulama . ")\n"
        . 'Toplam       : ' . number_format((float) $s['toplam'], 2, ',', '') . " EUR\n"
        . 'Odenen kapora: ' . number_format((float) $s['kapora'], 2, ',', '') . " EUR\n"
        . 'ARACTA TAHSIL: ' . number_format((float) $s['kalan'], 2, ',', '') . " EUR\n"
        . 'Dil          : ' . strtoupper((string) $s['dil']) . "\n";
}
