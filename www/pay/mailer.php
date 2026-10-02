<?php
// ============================================================
// EUROPA TAXI — e-posta gonderimi (sartname §8)
// Birincil: Brevo API (ucretsiz 300 e-posta/gun). Yedek: PHP mail().
// Brevo anahtari yoksa yine calisir ama spam riski kayit dosyasina yazilir.
//
// Guvenlik: alici/gonderen/Reply-To adresleri girdi kuraliyla (ASCII, CR/LF/'<>'/',' yok) dogrulanmadan
// hicbir baslik olusturulmaz; mail() NUL baytinda ValueError verir -> \Throwable yakalanir, temiz hata doner.
// Loglar kisisel veri icermez (yalniz siparis no / etiket / HTTP kodu).
// Govde icerigi Node katmaniyla (vercel/api/_lib/mail.js) AYNIDIR; is emrindeki kullanici degerleri tek satira
// indirilir (sahte 'ARACTA TAHSIL' satiri enjekte edilemez).
// ============================================================
declare(strict_types=1);

require_once __DIR__ . '/ortak.php';
require_once __DIR__ . '/girdi.php';

/** Gonderen adres: config mail_from, bossa isletme.php gonderen_eposta. */
function mail_gonderen(): string
{
    $g = cfg()['mail_from'];
    return $g !== '' ? $g : (string) (isletme()['gonderen_eposta'] ?? '');
}

/** Is emirlerinin gidecegi adres: config company_email, bossa isletme.php eposta. */
function sirket_eposta(): string
{
    $g = cfg()['company_email'];
    return $g !== '' ? $g : (string) (isletme()['eposta'] ?? '');
}

/**
 * E-posta gonderir. Doner: ['ok' => bool, 'yontem' => 'brevo'|'mail'|'yok', 'hata' => ?string]
 * $yanitAdresi: Reply-To (musteri e-postalarinda company_email). $etiket: log icin (siparis no + alici turu; KISISEL VERI YOK).
 */
function eposta_gonder(string $kime, string $konu, string $html, string $duzMetin = '', ?string $yanitAdresi = null, string $etiket = ''): array
{
    $c = cfg();
    $gonderen = mail_gonderen();
    if (!girdi_eposta_gecerli($kime)) {
        kayit('eposta: gecersiz alici (' . $etiket . ')');
        return ['ok' => false, 'yontem' => 'yok', 'hata' => 'gecersiz_alici'];
    }
    if (!girdi_eposta_gecerli($gonderen)) {
        kayit('eposta: mail_from gecersiz (' . $etiket . ')');
        return ['ok' => false, 'yontem' => 'yok', 'hata' => 'gonderen_gecersiz'];
    }
    if ($yanitAdresi !== null && !girdi_eposta_gecerli($yanitAdresi)) {
        $yanitAdresi = null;
    }
    $konu = trim((string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $konu));

    $brevo = $c['brevo_api_key'];
    if ($brevo !== '' && $c['brevo_api_base'] !== null && function_exists('curl_init')) {
        $govde = [
            'sender' => ['name' => 'europetaxi24', 'email' => $gonderen],
            'to' => [['email' => $kime]],
            'subject' => $konu,
            'htmlContent' => $html,
        ];
        if ($yanitAdresi !== null) {
            $govde['replyTo'] = ['email' => $yanitAdresi];
        }
        if ($duzMetin !== '') {
            $govde['textContent'] = $duzMetin;
        }
        $json = json_encode($govde, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        $ch = curl_init($c['brevo_api_base'] . '/smtp/email');
        if ($json !== false && $ch !== false) {
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_POST => true,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_POSTFIELDS => $json,
                CURLOPT_HTTPHEADER => [
                    'api-key: ' . $brevo,
                    'Content-Type: application/json',
                    'Accept: application/json',
                ],
            ]);
            $yanit = curl_exec($ch);
            $kod = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlNo = curl_errno($ch);
            if ($yanit !== false && $kod >= 200 && $kod < 300) {
                return ['ok' => true, 'yontem' => 'brevo', 'hata' => null];
            }
            // Brevo basarisiz -> mail() yedegine dus; yanit govdesi loglanmaz (alici adresi icerebilir)
            kayit('eposta: Brevo hatasi (HTTP ' . $kod . ', curl ' . $curlNo . ') ' . $etiket . '; mail() yedegi deneniyor');
        }
    } else {
        kayit('eposta: Brevo anahtari/adresi yok; PHP mail() kullaniliyor, spam klasorune dusme riski var ' . $etiket);
    }

    // ---- Yedek: PHP mail() ----
    try {
        $sinir = 'et' . bin2hex(random_bytes(8));
        $govdeMetni = $duzMetin !== '' ? $duzMetin : trim(strip_tags($html));
        $crlf = static fn (string $x): string => str_replace(["\r\n", "\r", "\n"], ["\n", "\n", "\r\n"], $x);
        $parca = static fn (string $tip, string $x): string => 'Content-Type: ' . $tip . "; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($crlf($x)), 76, "\r\n");
        $basliklar = 'From: europetaxi24 <' . $gonderen . ">\r\n"
            . ($yanitAdresi !== null ? 'Reply-To: ' . $yanitAdresi . "\r\n" : '')
            . "MIME-Version: 1.0\r\n"
            . 'Content-Type: multipart/alternative; boundary="' . $sinir . '"';
        $icerik = '--' . $sinir . "\r\n" . $parca('text/plain', $govdeMetni)
            . '--' . $sinir . "\r\n" . $parca('text/html', $html)
            . '--' . $sinir . "--\r\n";
        $konuKodlu = '=?UTF-8?B?' . base64_encode(mb_substr($konu, 0, 90, 'UTF-8')) . '?=';
        $ok = @mail($kime, $konuKodlu, $icerik, $basliklar);
    } catch (\Throwable) {
        kayit('eposta: mail() istisna verdi ' . $etiket);
        return ['ok' => false, 'yontem' => 'mail', 'hata' => 'mail_istisna'];
    }
    if (!$ok) {
        kayit('eposta: mail() basarisiz ' . $etiket);
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

/** E-posta metninde tek satira indirilmis, temizlenmis kullanici degeri (CR/LF/kontrol karakteri yok). */
function mailer_satir(mixed $deger): string
{
    return girdi_temiz_metin(is_scalar($deger) ? (string) $deger : '');
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

    $satirlar = $satir(t($dil, 'em_ref'), (string) $s['no'])
        . $satir(t($dil, 'em_route'), $s['alis'] . ' → ' . $s['varis'])
        . $satir(t($dil, 'em_date'), tarih_goster($dil, (string) $s['tarih'], (string) $s['saat']));
    if (!empty($s['donus_tarih'])) {
        $satirlar .= $satir(t($dil, 'em_return'), tarih_goster($dil, (string) $s['donus_tarih'], (string) ($s['donus_saat'] ?? '')));
    }
    $satirlar .= $satir(t($dil, 'em_vehicle'), arac_adi($dil, (string) $s['arac']))
        . $satir(t($dil, 'em_pax'), (string) $s['yolcu'])
        . $satir(t($dil, 'em_bags'), $s['buyuk'] . ' + ' . $s['kucuk'])
        . $satir(t($dil, 'em_paid'), para($dil, (float) $s['kapora']))
        . $satir(t($dil, 'em_due'), para($dil, (float) $s['kalan']));

    return '<!doctype html><html><body style="margin:0;padding:0;background:#F2F2F4;">
<div style="max-width:560px;margin:0 auto;padding:24px 14px;font-family:Arial,Helvetica,sans-serif;">
  <div style="background:#0A0A0C;border-radius:14px 14px 0 0;padding:22px 28px;">
    <span style="font-size:20px;font-weight:900;letter-spacing:1px;color:#FFFFFF;">EUROPETAXI<span style="color:#F7B32B;">24</span></span>
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
      europetaxi24 · ' . h(($i['unvan'] ?? '') . ' · ' . ($i['kdv'] ?? '')) . '<br>'
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
 * Kullanici kaynakli her deger tek satira indirilir: CR/LF enjeksiyonuyla sahte satir eklenemez.
 */
function sirket_eposta_metni(array $s): string
{
    $donus = !empty($s['donus_tarih'])
        ? tarih_goster('tr', mailer_satir($s['donus_tarih']), mailer_satir($s['donus_saat'] ?? ''))
        : '-';
    $kmSunucu = $s['km_sunucu'] ?? null;
    if ($kmSunucu !== null) {
        $dogrulama = (int) $kmSunucu . ' km (Google ile dogrulandi)';
    } elseif (($s['km_kaynak'] ?? '') !== '' || isset($s['km_dahili'])) {
        $dogrulama = 'dahili tablo ile dogrulandi' . (isset($s['km_dahili']) ? ': ' . (int) $s['km_dahili'] . ' km' : '');
    } else {
        $dogrulama = 'dogrulanamadi (eski kayit)';
    }
    $sayi = static fn (mixed $x): string => (string) (int) $x;
    return "YENI REZERVASYON — KAPORA ODENDI\n"
        . "================================\n"
        . 'Referans     : ' . mailer_satir($s['no']) . "\n"
        . 'Musteri      : ' . mailer_satir($s['ad']) . "\n"
        . 'Telefon      : ' . mailer_satir($s['telefon']) . "\n"
        . 'E-posta      : ' . mailer_satir($s['eposta']) . "\n"
        . "--------------------------------\n"
        . 'Guzergah     : ' . mailer_satir($s['alis']) . ' -> ' . mailer_satir($s['varis']) . "\n"
        . 'Alis         : ' . tarih_goster('tr', mailer_satir($s['tarih']), mailer_satir($s['saat'])) . "\n"
        . 'Donus        : ' . $donus . "\n"
        . 'Arac         : ' . arac_adi('tr', mailer_satir($s['arac'])) . "\n"
        . 'Yolcu        : ' . $sayi($s['yolcu']) . "\n"
        . 'Valiz        : ' . $sayi($s['buyuk']) . ' buyuk + ' . $sayi($s['kucuk']) . ' kucuk' . "\n"
        . "--------------------------------\n"
        . 'Mesafe       : ' . $sayi($s['km']) . ' km (istemci: ' . $sayi($s['km_istemci'] ?? $s['km']) . ' / sunucu: ' . $dogrulama . ")\n"
        . 'Toplam       : ' . number_format((float) $s['toplam'], 2, ',', '') . " EUR\n"
        . 'Odenen kapora: ' . number_format((float) $s['kapora'], 2, ',', '') . " EUR\n"
        . 'ARACTA TAHSIL: ' . number_format((float) $s['kalan'], 2, ',', '') . " EUR\n"
        . 'Dil          : ' . strtoupper(dil_sec($s['dil'] ?? 'fr')) . "\n";
}
