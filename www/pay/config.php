<?php
// ============================================================
// EUROPA TAXI — odeme katmani yapilandirmasi (sartname §9)
// Anahtarlari tirnak icine yapistirin ve kaydedin. Baska dosyaya
// dokunmaniz gerekmez. Bu dosya web'den erisime kapalidir.
// ============================================================
return [
    'mollie_api_key'    => '',   // Mollie panosundan: once test_... ile deneyin, sonra live_...
    'site_url'          => 'https://europetaxi24.be',
    'company_email'     => 'Europataxisrl@gmail.com',   // is emirleri bu adrese gider
    'mail_from'         => 'noreply@europetaxi24.be',   // gonderen adres (Brevo'da dogrulanmali)
    'brevo_api_key'     => '',   // Brevo > SMTP & API > API anahtari (bos birakilirsa PHP mail() kullanilir)
    'google_server_key' => '',   // SUNUCU anahtari: IP kisitli, sadece Distance Matrix API
    'admin_password'    => '',   // orders.php ve test.php icin GUCLU bir sifre belirleyin
    'orders_dir'        => __DIR__ . '/orders',
    'methods'           => ['bancontact', 'creditcard', 'applepay'],
    'distance_tolerance_pct' => 12,   // istemci/sunucu km farki bu yuzdeyi asarsa sunucu degeri kullanilir
];
