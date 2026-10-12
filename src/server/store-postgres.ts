import { Pool } from "pg";
import { randomUUID } from "crypto";
import type {
  ConversationState,
  CustomerRecord,
  CustomerStore,
  OrderLine,
  OrderRecord,
  SavedList,
} from "./store";

/**
 * Postgres tabanlı müşteri ve sipariş deposu.
 *
 * Vercel'in sunucusuz dosya sistemi salt okunurdur; FileStore orada yazamaz.
 * Bu uygulama aynı CustomerStore arayüzünü karşılar, yani uygulama kodu değişmez:
 * yalnızca getStore() bağlantı dizesi varken bunu döndürür.
 *
 * Standart Postgres protokolü kullanılır (pg), yani Neon'un havuzlanmış bağlantı
 * dizesiyle de, başka bir Postgres sunucusuyla da çalışır; testlerde yerel bir
 * sunucuya bağlanabildiğimiz için SQL gerçekten doğrulanabiliyor.
 *
 * Şema ilk kullanımda oluşturulur (CREATE TABLE IF NOT EXISTS). Tablo sayısı az ve
 * sabit olduğu için ayrı bir göç aracı taşımıyoruz.
 */

/** Telefonu karşılaştırılabilir hale getirir: yalnız rakamlar, baştaki 0 yerine 32. */
function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^0/, "32");
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
  approved_at: string | null;
  created_at: string;
  odoo_partner_id: number | null;
  pricelist: string | null;
};

type OrderRow = {
  id: string;
  customer_id: string;
  created_at: string;
  delivery: string;
  lines: OrderLine[];
  note: string | null;
  status: string;
  source: string | null;
  estimate_excl_vat: string | number | null;
};

type ListRow = {
  id: string;
  customer_id: string;
  name: string;
  lines: OrderLine[];
  created_at: string;
  updated_at: string;
};

type ConversationRow = {
  phone: string;
  customer_id: string | null;
  lang: string;
  draft: OrderLine[];
  history: ConversationState["history"];
  updated_at: string;
};

/** Postgres timestamptz değerini kayıtlardaki ISO metnine çevirir. */
function iso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function toCustomer(r: CustomerRow): CustomerRecord {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    company: r.company,
    vat: r.vat ?? undefined,
    firstName: r.first_name,
    lastName: r.last_name,
    contact: r.contact,
    phone: r.phone,
    street: r.street ?? undefined,
    postcode: r.postcode ?? undefined,
    city: r.city ?? undefined,
    country: r.country,
    businessType: r.business_type ?? undefined,
    lang: r.lang === "tr" ? "tr" : "nl",
    status: r.status as CustomerRecord["status"],
    approvedAt: r.approved_at ? iso(r.approved_at) : undefined,
    createdAt: iso(r.created_at),
    odooPartnerId: r.odoo_partner_id ?? undefined,
    pricelist: r.pricelist ?? undefined,
  };
}

function toOrder(r: OrderRow): OrderRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    createdAt: iso(r.created_at),
    delivery: r.delivery as OrderRecord["delivery"],
    lines: r.lines ?? [],
    note: r.note ?? undefined,
    status: r.status as OrderRecord["status"],
    source: (r.source as OrderRecord["source"]) ?? undefined,
    // numeric sütunu sürücüden metin gelebilir; sayıya çeviriyoruz
    estimateExclVat: r.estimate_excl_vat == null ? undefined : Number(r.estimate_excl_vat),
  };
}

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

export class PostgresStore implements CustomerStore {
  private pool: Pool;
  /**
   * Etiketli şablon: `sql`SELECT ... ${v}`` yazımını $1, $2 ... parametrelerine çevirir.
   * Değerler hiçbir zaman metne gömülmez, yani SQL enjeksiyonu mümkün değil.
   */
  private sql: <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;
  private schema: Promise<void> | null = null;

  constructor(connectionString: string) {
    // Yerel test sunucusu dışında TLS zorunlu (Neon ve diğer barındırılan Postgres'ler şart koşar)
    const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
    this.pool = new Pool({
      connectionString,
      ssl: local ? undefined : { rejectUnauthorized: true },
      // Sunucusuz işlevler kısa ömürlüdür; bağlantıyı az ve kısa tutuyoruz
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    this.sql = async <T,>(strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "");
      const res = await this.pool.query(text, values);
      return res.rows as T[];
    };
  }

  /** Testlerin bağlantıyı kapatabilmesi için. Üretimde işlev havuzla birlikte sonlanır. */
  async close() {
    await this.pool.end();
  }

  /** Şemayı yalnızca bir kez kurar; sonraki çağrılar aynı sözü bekler. */
  private ready(): Promise<void> {
    if (!this.schema) {
      this.schema = (async () => {
        const sql = this.sql;
        await sql`
          CREATE TABLE IF NOT EXISTS customers (
            id              uuid PRIMARY KEY,
            email           text NOT NULL UNIQUE,
            password_hash   text NOT NULL,
            company         text NOT NULL,
            vat             text,
            first_name      text NOT NULL,
            last_name       text NOT NULL,
            contact         text NOT NULL,
            phone           text NOT NULL,
            phone_norm      text NOT NULL,
            street          text,
            postcode        text,
            city            text,
            country         text NOT NULL,
            business_type   text,
            lang            text NOT NULL,
            status          text NOT NULL,
            approved_at     timestamptz,
            created_at      timestamptz NOT NULL,
            odoo_partner_id integer,
            pricelist       text
          )`;
        await sql`CREATE INDEX IF NOT EXISTS customers_phone_norm_idx ON customers (phone_norm)`;
        await sql`
          CREATE TABLE IF NOT EXISTS orders (
            id                uuid PRIMARY KEY,
            customer_id       uuid NOT NULL,
            created_at        timestamptz NOT NULL,
            delivery          text NOT NULL,
            lines             jsonb NOT NULL,
            note              text,
            status            text NOT NULL,
            source            text,
            estimate_excl_vat numeric
          )`;
        await sql`CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders (customer_id, created_at DESC)`;
        await sql`
          CREATE TABLE IF NOT EXISTS lists (
            id          uuid PRIMARY KEY,
            customer_id uuid NOT NULL,
            name        text NOT NULL,
            lines       jsonb NOT NULL,
            created_at  timestamptz NOT NULL,
            updated_at  timestamptz NOT NULL
          )`;
        // Aynı müşteri aynı adı iki kez kaydedemesin: saveList büyük/küçük harf ayırmadan üzerine yazar
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS lists_customer_name_idx ON lists (customer_id, lower(name))`;
        await sql`
          CREATE TABLE IF NOT EXISTS conversations (
            phone       text PRIMARY KEY,
            customer_id uuid,
            lang        text NOT NULL,
            draft       jsonb NOT NULL,
            history     jsonb NOT NULL,
            updated_at  timestamptz NOT NULL
          )`;
      })();
      // Şema kurulumu başarısız olursa bir sonraki istek yeniden denesin
      this.schema.catch(() => {
        this.schema = null;
      });
    }
    return this.schema;
  }

  async getCustomerByEmail(email: string) {
    await this.ready();
    const rows = (await this.sql`
      SELECT * FROM customers WHERE email = ${email.toLowerCase().trim()} LIMIT 1
    `) as CustomerRow[];
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async getCustomerById(id: string) {
    await this.ready();
    // Geçersiz bir id uuid sütununda hata verir; arayan taraf "bulunamadı" bekliyor
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    const rows = (await this.sql`SELECT * FROM customers WHERE id = ${id} LIMIT 1`) as CustomerRow[];
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async getCustomerByPhone(phone: string) {
    await this.ready();
    const rows = (await this.sql`
      SELECT * FROM customers WHERE phone_norm = ${normalizePhone(phone)} LIMIT 1
    `) as CustomerRow[];
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async createCustomer(c: Omit<CustomerRecord, "id" | "createdAt">) {
    await this.ready();
    const email = c.email.toLowerCase().trim();
    const rec: CustomerRecord = { ...c, email, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.sql`
      INSERT INTO customers (
        id, email, password_hash, company, vat, first_name, last_name, contact,
        phone, phone_norm, street, postcode, city, country, business_type, lang,
        status, approved_at, created_at, odoo_partner_id, pricelist
      ) VALUES (
        ${rec.id}, ${rec.email}, ${rec.passwordHash}, ${rec.company}, ${rec.vat ?? null},
        ${rec.firstName}, ${rec.lastName}, ${rec.contact}, ${rec.phone}, ${normalizePhone(rec.phone)},
        ${rec.street ?? null}, ${rec.postcode ?? null}, ${rec.city ?? null}, ${rec.country},
        ${rec.businessType ?? null}, ${rec.lang}, ${rec.status}, ${rec.approvedAt ?? null},
        ${rec.createdAt}, ${rec.odooPartnerId ?? null}, ${rec.pricelist ?? null}
      )`;
    return rec;
  }

  async listCustomers() {
    await this.ready();
    const rows = (await this.sql`SELECT * FROM customers ORDER BY created_at DESC`) as CustomerRow[];
    return rows.map(toCustomer);
  }

  async setCustomerStatus(id: string, status: CustomerRecord["status"]) {
    await this.ready();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    const approvedAt = status === "approved" ? new Date().toISOString() : null;
    const rows = (await this.sql`
      UPDATE customers
         SET status = ${status},
             approved_at = CASE WHEN ${status} = 'approved' THEN ${approvedAt}::timestamptz ELSE approved_at END
       WHERE id = ${id}
       RETURNING *
    `) as CustomerRow[];
    return rows[0] ? toCustomer(rows[0]) : undefined;
  }

  async listAllOrders(limit = 50) {
    await this.ready();
    const rows = (await this.sql`
      SELECT * FROM orders ORDER BY created_at DESC LIMIT ${limit}
    `) as OrderRow[];
    return rows.map(toOrder);
  }

  async listOrders(customerId: string, limit = 20) {
    await this.ready();
    if (!/^[0-9a-f-]{36}$/i.test(customerId)) return [];
    const rows = (await this.sql`
      SELECT * FROM orders WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT ${limit}
    `) as OrderRow[];
    return rows.map(toOrder);
  }

  async createOrder(o: Omit<OrderRecord, "id" | "createdAt">) {
    await this.ready();
    const rec: OrderRecord = { ...o, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.sql`
      INSERT INTO orders (id, customer_id, created_at, delivery, lines, note, status, source, estimate_excl_vat)
      VALUES (
        ${rec.id}, ${rec.customerId}, ${rec.createdAt}, ${rec.delivery},
        ${JSON.stringify(rec.lines)}::jsonb, ${rec.note ?? null}, ${rec.status},
        ${rec.source ?? null}, ${rec.estimateExclVat ?? null}
      )`;
    return rec;
  }

  async listSavedLists(customerId: string) {
    await this.ready();
    if (!/^[0-9a-f-]{36}$/i.test(customerId)) return [];
    const rows = (await this.sql`
      SELECT * FROM lists WHERE customer_id = ${customerId} ORDER BY updated_at DESC
    `) as ListRow[];
    return rows.map(toList);
  }

  async saveList(l: Omit<SavedList, "id" | "createdAt" | "updatedAt">) {
    await this.ready();
    const now = new Date().toISOString();
    // Aynı ad yeniden kaydedilirse satırları ve zamanı güncelle, yeni kayıt açma
    const rows = (await this.sql`
      INSERT INTO lists (id, customer_id, name, lines, created_at, updated_at)
      VALUES (${randomUUID()}, ${l.customerId}, ${l.name}, ${JSON.stringify(l.lines)}::jsonb, ${now}, ${now})
      ON CONFLICT (customer_id, lower(name))
      DO UPDATE SET lines = EXCLUDED.lines, updated_at = EXCLUDED.updated_at
      RETURNING *
    `) as ListRow[];
    return toList(rows[0]);
  }

  async deleteList(customerId: string, listId: string) {
    await this.ready();
    if (!/^[0-9a-f-]{36}$/i.test(customerId) || !/^[0-9a-f-]{36}$/i.test(listId)) return;
    await this.sql`DELETE FROM lists WHERE customer_id = ${customerId} AND id = ${listId}`;
  }

  async getConversation(phone: string) {
    await this.ready();
    const rows = (await this.sql`
      SELECT * FROM conversations WHERE phone = ${normalizePhone(phone)} LIMIT 1
    `) as ConversationRow[];
    const r = rows[0];
    if (!r) return undefined;
    return {
      phone: r.phone,
      customerId: r.customer_id ?? undefined,
      lang: r.lang === "tr" ? "tr" : "nl",
      draft: r.draft ?? [],
      history: r.history ?? [],
      updatedAt: iso(r.updated_at),
    } satisfies ConversationState;
  }

  async saveConversation(state: ConversationState) {
    await this.ready();
    await this.sql`
      INSERT INTO conversations (phone, customer_id, lang, draft, history, updated_at)
      VALUES (
        ${normalizePhone(state.phone)}, ${state.customerId ?? null}, ${state.lang},
        ${JSON.stringify(state.draft)}::jsonb, ${JSON.stringify(state.history)}::jsonb,
        ${new Date().toISOString()}
      )
      ON CONFLICT (phone) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        lang        = EXCLUDED.lang,
        draft       = EXCLUDED.draft,
        history     = EXCLUDED.history,
        updated_at  = EXCLUDED.updated_at`;
  }
}
