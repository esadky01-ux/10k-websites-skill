<?php
// ============================================================
// EUROPA TAXI — odeme katmani yapilandirmasi (sartname §9)
//
// !!! GUVENLIK UYARISI !!!
//  * Bu dosya BOS anahtarlarla depoda durur. Gercek anahtarlari (Mollie, Brevo, Google,
//    yonetici sifresi) bu dosyaya yazip GIT'E / DEPOYA COMMIT ETMEYIN. Anahtarlari yalnizca
//    canli sunucudaki kopyaya yazin ya da (tercih edilir) ortam degiskeni olarak tanimlayin.
//  * ORTAM DEGISKENLERI bu dosyanin ustundedir (varsa ve bos degilse bu dosyadaki degeri ezer):
//      MOLLIE_API_KEY  SITE_URL  COMPANY_EMAIL  MAIL_FROM  BREVO_API_KEY  GOOGLE_SERVER_KEY
//      ADMIN_PASSWORD  ORDERS_DIR  DISTANCE_TOLERANCE_PCT  TRUSTED_PROXY_HEADER
//      MOLLIE_API_BASE  BREVO_API_BASE  GOOGLE_API_BASE      (son uc taban adres yalniz TEST icindir)
//    Combell / Apache: pay/.htaccess icine `SetEnv MOLLIE_API_KEY "live_..."` satirlari koymak
//    yerine, mumkunse hosting panelindeki ortam degiskeni ekranini kullanin; .htaccess dosyasi
//    da depoya girmemelidir.
//  * Bu dosya web'den erisime kapalidir (pay/.htaccess beyaz listesi), yine de anahtarlari
//    buraya yazdiginizda dosya izinlerini 0640/0600 tutun.
//
// Siparis klasoru (orders_dir): BOS BIRAKIRSANIZ varsayilan olarak web kokunun DISINDA,
// www/ klasorunun bir ustundeki `et-siparisler/` kullanilir. O klasor olusturulamiyorsa
// pay/orders/ kullanilir (.htaccess kilidiyle) ve test.php bunu KIRMIZI uyari olarak gosterir.
// ============================================================
return [
    'mollie_api_key'    => '',   // Mollie panosundan: once test_... ile deneyin, sonra live_...
    'site_url'          => 'https://europetaxi24.be',
    'company_email'     => 'Europataxisrl@gmail.com',   // is emirleri bu adrese gider (musteri e-postasinda Reply-To da budur)
    'mail_from'         => 'noreply@europetaxi24.be',   // gonderen adres (Brevo'da dogrulanmali)
    'brevo_api_key'     => '',   // Brevo > SMTP & API > API anahtari (bos birakilirsa PHP mail() kullanilir)
    'google_server_key' => '',   // SUNUCU anahtari: IP kisitli, sadece Distance Matrix API (bos: km yalniz dahili tabloyla dogrulanir)
    'admin_password'    => '',   // orders.php ve test.php icin GUCLU (>= 12 karakter) bir sifre; bos: ikisi de KAPALI
    'orders_dir'        => '',   // bos: web kokunun disinda et-siparisler/ (bkz. yukaridaki not)
    'methods'           => ['bancontact', 'creditcard', 'applepay'],
    'distance_tolerance_pct' => 12,   // istemci/sunucu km farki bu yuzdeyi asarsa sunucu degeri kullanilir
    'trusted_proxy_header'   => '',   // orn. HTTP_X_FORWARDED_FOR: yalniz guvenilir bir ters vekil ARKASINDAYSANIZ (oran siniri IP'si)
    // Asagidaki taban adresler YALNIZ testler icindir (yalniz https:// veya http://127.0.0.1 kabul edilir); canlida bos birakin.
    'mollie_api_base'   => '',
    'brevo_api_base'    => '',
    'google_api_base'   => '',
];
