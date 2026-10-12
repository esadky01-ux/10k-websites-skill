/**
 * Maximus müşteri/sipariş şeması (PostgresStore).
 *
 * Tek doğruluk kaynağı: hem `npm run db:migrate` hem de PostgresStore ilk kullanımda bunu uygular.
 * Ayrı bir .sql dosyası değil TS modülü: böylece Vercel sunucusuz paketine dahil olur
 * (runtime'da dosya okumak paketlemede güvenilir değildir).
 *
 * Notlar:
 *  - id/customer_id alanları `text`, uuid değil: WhatsApp ajanı hesabı olmayan numaralar için
 *    `wa:<telefon>` biçiminde kimlik üretir (src/server/whatsapp/agent.ts), ayrıca bozuk bir
 *    oturum çerezi uuid cast hatasıyla 500 üretmemeli. Bu yüzden orders.customer_id'de FK yoktur.
 *  - phone_normalized: normalizePhone() JS tarafında hesaplanır; tek doğruluk kaynağı orada kalır.
 *  - seq: aynı milisaniyede oluşan kayıtlarda kesin sıralama için eşitlik bozucu.
 *
 * Her ifade ayrı ayrı ve idempotent (IF NOT EXISTS) çalıştırılır.
 */
export const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS customers (
    id               text PRIMARY KEY,
    seq              bigserial,
    email            text NOT NULL,
    password_hash    text NOT NULL,
    company          text NOT NULL,
    vat              text,
    first_name       text NOT NULL,
    last_name        text NOT NULL,
    contact          text NOT NULL,
    phone            text NOT NULL,
    phone_normalized text NOT NULL,
    street           text,
    postcode         text,
    city             text,
    country          text NOT NULL,
    business_type    text,
    lang             text NOT NULL,
    status           text NOT NULL,
    approved_at      timestamptz,
    created_at       timestamptz NOT NULL,
    odoo_partner_id  integer,
    pricelist        text
  )`,
  // Aynı e-posta ile ikinci hesap açılamaz (kayıt rotası da önceden kontrol eder).
  `CREATE UNIQUE INDEX IF NOT EXISTS customers_email_key ON customers (email)`,
  `CREATE INDEX IF NOT EXISTS customers_phone_normalized_idx ON customers (phone_normalized)`,
  `CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers (created_at DESC, seq DESC)`,

  `CREATE TABLE IF NOT EXISTS orders (
    id                text PRIMARY KEY,
    seq               bigserial,
    customer_id       text NOT NULL,
    created_at        timestamptz NOT NULL,
    delivery          text NOT NULL,
    lines             jsonb NOT NULL,
    note              text,
    status            text NOT NULL,
    source            text,
    estimate_excl_vat double precision
  )`,
  `CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC, seq DESC)`,
  `CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id, created_at DESC, seq DESC)`,

  `CREATE TABLE IF NOT EXISTS saved_lists (
    id          text PRIMARY KEY,
    seq         bigserial,
    customer_id text NOT NULL,
    name        text NOT NULL,
    lines       jsonb NOT NULL,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL
  )`,
  // Aynı müşteri + aynı ad (büyük/küçük harf duyarsız) tek liste: saveList bunu günceller.
  `CREATE UNIQUE INDEX IF NOT EXISTS saved_lists_customer_name_key ON saved_lists (customer_id, lower(name))`,
  `CREATE INDEX IF NOT EXISTS saved_lists_customer_idx ON saved_lists (customer_id, updated_at DESC, seq DESC)`,

  `CREATE TABLE IF NOT EXISTS conversations (
    phone_normalized text PRIMARY KEY,
    phone            text NOT NULL,
    customer_id      text,
    lang             text NOT NULL,
    draft            jsonb NOT NULL,
    history          jsonb NOT NULL,
    updated_at       timestamptz NOT NULL
  )`,
];
