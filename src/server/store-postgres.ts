import { Pool } from "pg";
import { randomUUID } from "crypto";
import { SCHEMA_STATEMENTS } from "./schema";
import { normalizePhone } from "./phone";
import type {
  ConversationState,
  CustomerRecord,
  CustomerStore,
  OrderLine,
  OrderRecord,
  SavedList,
} from "./store";

/**
 * Kalıcı depo (PostgreSQL / Neon / Vercel Postgres).
 *
 * Neden: Vercel'de fonksiyon dosya sistemi /tmp dışında salt okunurdur, /tmp ise her çağrı için
 * ayrıdır. FileStore üretimde hem çöküyor (mkdir ENOENT) hem de kalıcı olamaz. Bu sınıf aynı
 * CustomerStore arayüzünü uygular; çağıran kod (rotalar, ajan, auth) değişmez.
 *
 * Sürücü: node-postgres. Next.js rotaları Node runtime'da çalışır (edge yok), bu yüzden TCP
 * bağlantısı kullanılabilir. Neon'un "-pooler" (pgbouncer) bağlantı dizesiyle sunucusuz
 * ortamda bağlantı tükenmesi yaşanmaz; aynı kod Vercel Postgres ve diğer yönetilen
 * PostgreSQL servisleriyle de çalışır.
 */

/** Boş dizge de "tanımsız" sayılır: Vercel'de boş bırakılmış değişken yanlışlıkla seçilmesin. */
function envUrl(): string | undefined {
  for (const key of ["MAXIMUS_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL"]) {
    const v = process.env[key]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function databaseUrl(): string | undefined {
  return envUrl();
}

/** null → undefined: FileStore'da olmayan alanlar JSON'da hiç görünmez, aynı davranış korunur. */
function opt<T>(v: T | null | undefined): T | undefined {
  return v === null || v === undefined ? undefined : v;
}

/** timestamptz → ISO dizge. Kaynak değerler toISOString() ile üretildiği için ms hassasiyeti korunur. */
function iso(v: Date | string): string {
  return typeof v === "string" ? new Date(v).toISOString() : v.toISOString();
}

function isoOpt(v: Date | string | null): string | undefined {
  return v === null ? undefined : iso(v);
}

type CustomerRow = {
  id: string;
  email: string;
  password_hash: string;
  company: string;
  vat: string | null;
  first_name: string;
  last_name: string;
  contact: string;
  phone: string;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string;
  business_type: string | null;
  lang: string;
  status: string;
  approved_at: Date | null;
  created_at: Date;
  odoo_partner_id: number | null;
  pricelist: string | null;
};

function toCustomer(r: CustomerRow): CustomerRecord {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    company: r.company,
    vat: opt(r.vat),
    firstName: r.first_name,
    lastName: r.last_name,
    contact: r.contact,
    phone: r.phone,
    street: opt(r.street),
    postcode: opt(r.postcode),
    city: opt(r.city),
    country: r.country,
    businessType: opt(r.business_type),
    lang: r.lang === "tr" ? "tr" : "nl",
    status: r.status as CustomerRecord["status"],
    approvedAt: isoOpt(r.approved_at),
    createdAt: iso(r.created_at),
    odooPartnerId: opt(r.odoo_partner_id),
    pricelist: opt(r.pricelist),
  };
}

type OrderRow = {
  id: string;
  customer_id: string;
  created_at: Date;
  delivery: string;
  lines: OrderLine[];
  note: string | null;
  status: string;
  source: string | null;
  estimate_excl_vat: number | null;
};

function toOrder(r: OrderRow): OrderRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    createdAt: iso(r.created_at),
    delivery: r.delivery === "depo" ? "depo" : "adres",
    lines: r.lines ?? [],
    note: opt(r.note),
    status: r.status as OrderRecord["status"],
    source: opt(r.source) as OrderRecord["source"],
    estimateExclVat: opt(r.estimate_excl_vat),
  };
}

type ListRow = {
  id: string;
  customer_id: string;
  name: string;
  lines: OrderLine[];
  created_at: Date;
  updated_at: Date;
};

function toList(r: ListRow): SavedList {
  return {
    id: r.id,
    customerId: r.customer_id,
    name: r.name,
    lines: r.lines ?? [],
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

type ConversationRow = {
  phone: string;
  customer_id: string | null;
  lang: string;
  draft: OrderLine[];
  history: ConversationState["history"];
  updated_at: Date;
};

function toConversation(r: ConversationRow): ConversationState {
  return {
    phone: r.phone,
    customerId: opt(r.customer_id),
    lang: r.lang === "tr" ? "tr" : "nl",
    draft: r.draft ?? [],
    history: r.history ?? [],
    updatedAt: iso(r.updated_at),
  };
}

const CUSTOMER_COLS = `id, email, password_hash, company, vat, first_name, last_name, contact, phone,
  street, postcode, city, country, business_type, lang, status, approved_at, created_at,
  odoo_partner_id, pricelist`;

export class PostgresStore implements CustomerStore {
  private pool: Pool;
  private schemaReady?: Promise<void>;

  constructor(connectionString = envUrl()) {
    if (!connectionString) {
      throw new Error(
        "PostgresStore: veritabanı bağlantı dizesi yok. MAXIMUS_DATABASE_URL (veya DATABASE_URL / POSTGRES_URL) tanımlayın.",
      );
    }
    // sslmode bağlantı dizesinden okunur (Neon: ?sslmode=require). Yerelde sslmode yok → TLS yok.
    // max küçük: sunucusuz ortamda her örnek yalnızca birkaç bağlantı tutmalı.
    this.pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
    // ZORUNLU: node-postgres'te boştaki bir bağlantı hata verirse (Neon bağlantıyı kapattı,
    // ağ koptu) bu olay dinlenmezse yakalanmamış istisna olur ve fonksiyon çöker.
    // Havuz bozuk bağlantıyı kendisi atar; burada yalnızca günlüğe yazmak yeterli.
    this.pool.on("error", (err) => {
      console.error("[store] boştaki veritabanı bağlantısı hata verdi", err.message);
    });
  }

  /**
   * Şemayı örnek başına bir kez uygular. Tek uçuş (single-flight): aynı anda gelen istekler
   * aynı sözü bekler.
   *
   * Tüm DDL tek sorguda gönderilir (parametresiz "simple query"): her ifade için ayrı gidiş-dönüş
   * yapmak soğuk başlangıçta ilk isteğe 12 round-trip gecikme eklerdi. Tek sorgu örtük bir
   * işlemde çalışır, hepsi IF NOT EXISTS olduğu için tekrar çalıştırılabilir.
   *
   * Eşzamanlı CREATE ... IF NOT EXISTS, PostgreSQL'de yarış durumunda duplicate_table /
   * duplicate_object / unique_violation fırlatabilir. Bu, başka bir örneğin şemayı aynı anda
   * oluşturduğu anlamına gelir; başarı sayılır.
   */
  private ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        try {
          await this.pool.query(SCHEMA_STATEMENTS.join(";\n"));
        } catch (err) {
          const code = (err as { code?: string }).code;
          // 42P07 duplicate_table, 42710 duplicate_object, 23505 unique_violation
          if (code !== "42P07" && code !== "42710" && code !== "23505") throw err;
        }
      })().catch((err) => {
        // Başarısızsa bir dahaki isteğin yeniden denemesine izin ver.
        this.schemaReady = undefined;
        throw err;
      });
    }
    return this.schemaReady;
  }

  private async query<R>(sql: string, params: unknown[] = []): Promise<R[]> {
    await this.ensureSchema();
    const res = await this.pool.query(sql, params);
    return res.rows as R[];
  }

  /** Testlerde ve betiklerde bağlantıları kapatmak için. */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /** Şemayı açıkça kurar (npm run db:migrate). */
  async migrate(): Promise<void> {
    await this.ensureSchema();
  }

  /**
   * TÜM verileri siler. Yalnızca testler için; üretim veritabanına karşı çağrılmamalı.
   * MAXIMUS_TEST_DATABASE_URL ile çalışan uyumluluk testleri her koşuda temiz başlamak için kullanır.
   */
  async truncateAllForTests(): Promise<void> {
    await this.query("TRUNCATE customers, orders, saved_lists, conversations, voice_unmatched");
  }

  async getCustomerByEmail(email: string) {
    const rows = await this.query<CustomerRow>(
      `SELECT ${CUSTOMER_COLS} FROM customers WHERE email = $1`,
      [email.toLowerCase().trim()],
    );
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async getCustomerById(id: string) {
    const rows = await this.query<CustomerRow>(`SELECT ${CUSTOMER_COLS} FROM customers WHERE id = $1`, [id]);
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async getCustomerByPhone(phone: string) {
    const rows = await this.query<CustomerRow>(
      `SELECT ${CUSTOMER_COLS} FROM customers WHERE phone_normalized = $1
       ORDER BY created_at ASC, seq ASC LIMIT 1`,
      [normalizePhone(phone)],
    );
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async createCustomer(c: Omit<CustomerRecord, "id" | "createdAt">) {
    const email = c.email.toLowerCase().trim();
    const rows = await this.query<CustomerRow>(
      `INSERT INTO customers (id, email, password_hash, company, vat, first_name, last_name, contact,
         phone, phone_normalized, street, postcode, city, country, business_type, lang, status,
         approved_at, created_at, odoo_partner_id, pricelist)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING ${CUSTOMER_COLS}`,
      [
        randomUUID(),
        email,
        c.passwordHash,
        c.company,
        c.vat ?? null,
        c.firstName,
        c.lastName,
        c.contact,
        c.phone,
        normalizePhone(c.phone),
        c.street ?? null,
        c.postcode ?? null,
        c.city ?? null,
        c.country,
        c.businessType ?? null,
        c.lang,
        c.status,
        c.approvedAt ?? null,
        new Date().toISOString(),
        c.odooPartnerId ?? null,
        c.pricelist ?? null,
      ],
    );
    return toCustomer(rows[0]);
  }

  async listCustomers() {
    const rows = await this.query<CustomerRow>(
      `SELECT ${CUSTOMER_COLS} FROM customers ORDER BY created_at DESC, seq DESC`,
    );
    return rows.map(toCustomer);
  }

  async setCustomerStatus(id: string, status: CustomerRecord["status"]) {
    // approved_at yalnızca onayda yazılır; FileStore da eski değeri silmez.
    const rows = await this.query<CustomerRow>(
      `UPDATE customers
         SET status = $2,
             approved_at = CASE WHEN $2 = 'approved' THEN $3::timestamptz ELSE approved_at END
       WHERE id = $1
       RETURNING ${CUSTOMER_COLS}`,
      [id, status, new Date().toISOString()],
    );
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async listAllOrders(limit = 50) {
    const rows = await this.query<OrderRow>(
      `SELECT id, customer_id, created_at, delivery, lines, note, status, source, estimate_excl_vat
       FROM orders ORDER BY created_at DESC, seq DESC LIMIT $1`,
      [limit],
    );
    return rows.map(toOrder);
  }

  async listOrders(customerId: string, limit = 20) {
    const rows = await this.query<OrderRow>(
      `SELECT id, customer_id, created_at, delivery, lines, note, status, source, estimate_excl_vat
       FROM orders WHERE customer_id = $1 ORDER BY created_at DESC, seq DESC LIMIT $2`,
      [customerId, limit],
    );
    return rows.map(toOrder);
  }

  async createOrder(o: Omit<OrderRecord, "id" | "createdAt">) {
    const rows = await this.query<OrderRow>(
      `INSERT INTO orders (id, customer_id, created_at, delivery, lines, note, status, source, estimate_excl_vat)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
       RETURNING id, customer_id, created_at, delivery, lines, note, status, source, estimate_excl_vat`,
      [
        randomUUID(),
        o.customerId,
        new Date().toISOString(),
        o.delivery,
        JSON.stringify(o.lines ?? []),
        o.note ?? null,
        o.status,
        o.source ?? null,
        o.estimateExclVat ?? null,
      ],
    );
    return toOrder(rows[0]);
  }

  async listSavedLists(customerId: string) {
    const rows = await this.query<ListRow>(
      `SELECT id, customer_id, name, lines, created_at, updated_at
       FROM saved_lists WHERE customer_id = $1 ORDER BY updated_at DESC, seq DESC`,
      [customerId],
    );
    return rows.map(toList);
  }

  async saveList(l: Omit<SavedList, "id" | "createdAt" | "updatedAt">) {
    // Aynı ad (harf duyarsız) varsa kalemleri güncelle; id ve created_at korunur (FileStore gibi).
    const now = new Date().toISOString();
    const rows = await this.query<ListRow>(
      `INSERT INTO saved_lists (id, customer_id, name, lines, created_at, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$5)
       ON CONFLICT (customer_id, lower(name))
       DO UPDATE SET lines = EXCLUDED.lines, updated_at = EXCLUDED.updated_at
       RETURNING id, customer_id, name, lines, created_at, updated_at`,
      [randomUUID(), l.customerId, l.name, JSON.stringify(l.lines ?? []), now],
    );
    return toList(rows[0]);
  }

  async deleteList(customerId: string, listId: string) {
    await this.query(`DELETE FROM saved_lists WHERE customer_id = $1 AND id = $2`, [customerId, listId]);
  }

  async getConversation(phone: string) {
    const rows = await this.query<ConversationRow>(
      `SELECT phone, customer_id, lang, draft, history, updated_at
       FROM conversations WHERE phone_normalized = $1`,
      [normalizePhone(phone)],
    );
    return rows[0] ? toConversation(rows[0]) : undefined;
  }

  async saveConversation(state: ConversationState) {
    await this.query(
      `INSERT INTO conversations (phone_normalized, phone, customer_id, lang, draft, history, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
       ON CONFLICT (phone_normalized) DO UPDATE SET
         phone = EXCLUDED.phone,
         customer_id = EXCLUDED.customer_id,
         lang = EXCLUDED.lang,
         draft = EXCLUDED.draft,
         history = EXCLUDED.history,
         updated_at = EXCLUDED.updated_at`,
      [
        normalizePhone(state.phone),
        state.phone,
        state.customerId ?? null,
        state.lang,
        JSON.stringify(state.draft ?? []),
        JSON.stringify(state.history ?? []),
        new Date().toISOString(),
      ],
    );
  }

  /** Sesli siparişte eşleşmeyen sorgular. Asla fırlatmaz: kayıt tutma siparişi bozmamalı. */
  async logVoiceUnmatched(payload: unknown): Promise<void> {
    try {
      await this.query(`INSERT INTO voice_unmatched (at, payload) VALUES ($1, $2::jsonb)`, [
        new Date().toISOString(),
        JSON.stringify(payload),
      ]);
    } catch (err) {
      console.error("[store] voice_unmatched yazılamadı", err);
    }
  }
}
