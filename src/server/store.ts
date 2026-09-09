import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Müşteri ve sipariş deposu.
 * Varsayılan uygulama dosya tabanlıdır (data/store.json). Odoo bağlantısı hazır olduğunda
 * aynı arayüzü uygulayan bir OdooStore ile değiştirilir; uygulama kodu değişmez.
 */
export type CustomerRecord = {
  id: string;
  email: string;
  passwordHash: string;
  company: string;
  vat?: string;
  contact: string;
  phone: string;
  street?: string;
  postcode?: string;
  city?: string;
  country: string;
  businessType?: string;
  lang: "nl" | "tr";
  createdAt: string;
  /** Odoo'daki res.partner id'si (ileride) */
  odooPartnerId?: number;
  /** Fiyat listesi kodu (ileride Odoo pricelist) */
  pricelist?: string;
};

export type OrderLine = { productId: string; cases: number; units: number };

export type OrderRecord = {
  id: string;
  customerId: string;
  createdAt: string;
  delivery: "adres" | "depo";
  lines: OrderLine[];
  note?: string;
  status: "whatsapp" | "draft" | "confirmed";
  /** WhatsApp ajanı tarafından oluşturulduysa telefon numarası */
  source?: "web" | "whatsapp-agent";
  estimateExclVat?: number;
};

export type SavedList = {
  id: string;
  customerId: string;
  name: string;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
};

/** WhatsApp ajanı sohbet durumu (telefon numarasına göre) */
export type ConversationState = {
  phone: string;
  customerId?: string;
  lang: "nl" | "tr";
  draft: OrderLine[];
  history: { role: "user" | "assistant"; text: string; at: string }[];
  updatedAt: string;
};

export interface CustomerStore {
  getCustomerByEmail(email: string): Promise<CustomerRecord | undefined>;
  getCustomerById(id: string): Promise<CustomerRecord | undefined>;
  getCustomerByPhone(phone: string): Promise<CustomerRecord | undefined>;
  createCustomer(c: Omit<CustomerRecord, "id" | "createdAt">): Promise<CustomerRecord>;
  listOrders(customerId: string, limit?: number): Promise<OrderRecord[]>;
  createOrder(o: Omit<OrderRecord, "id" | "createdAt">): Promise<OrderRecord>;
  listSavedLists(customerId: string): Promise<SavedList[]>;
  saveList(l: Omit<SavedList, "id" | "createdAt" | "updatedAt">): Promise<SavedList>;
  deleteList(customerId: string, listId: string): Promise<void>;
  getConversation(phone: string): Promise<ConversationState | undefined>;
  saveConversation(state: ConversationState): Promise<void>;
}

type Data = {
  customers: CustomerRecord[];
  orders: OrderRecord[];
  lists: SavedList[];
  conversations: ConversationState[];
};

const EMPTY: Data = { customers: [], orders: [], lists: [], conversations: [] };

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^0/, "32");
}

export class FileStore implements CustomerStore {
  private file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir = process.env.MAXIMUS_DATA_DIR ?? path.join(process.cwd(), "data")) {
    this.file = path.join(dir, "store.json");
  }

  private async read(): Promise<Data> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return { ...EMPTY, ...(JSON.parse(raw) as Partial<Data>) };
    } catch {
      return { ...EMPTY };
    }
  }

  /** Yazmaları sıraya koyar: aynı anda iki istek dosyayı bozamaz. */
  private mutate<T>(fn: (d: Data) => T | Promise<T>): Promise<T> {
    const run = async () => {
      const d = await this.read();
      const result = await fn(d);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = this.file + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(d, null, 1));
      await fs.rename(tmp, this.file);
      return result;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  async getCustomerByEmail(email: string) {
    const d = await this.read();
    return d.customers.find((c) => c.email === email.toLowerCase().trim());
  }
  async getCustomerById(id: string) {
    const d = await this.read();
    return d.customers.find((c) => c.id === id);
  }
  async getCustomerByPhone(phone: string) {
    const d = await this.read();
    const n = normalizePhone(phone);
    return d.customers.find((c) => normalizePhone(c.phone) === n);
  }
  createCustomer(c: Omit<CustomerRecord, "id" | "createdAt">) {
    return this.mutate((d) => {
      const rec: CustomerRecord = { ...c, email: c.email.toLowerCase().trim(), id: randomUUID(), createdAt: new Date().toISOString() };
      d.customers.push(rec);
      return rec;
    });
  }
  async listOrders(customerId: string, limit = 20) {
    const d = await this.read();
    return d.orders.filter((o) => o.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  createOrder(o: Omit<OrderRecord, "id" | "createdAt">) {
    return this.mutate((d) => {
      const rec: OrderRecord = { ...o, id: randomUUID(), createdAt: new Date().toISOString() };
      d.orders.push(rec);
      return rec;
    });
  }
  async listSavedLists(customerId: string) {
    const d = await this.read();
    return d.lists.filter((l) => l.customerId === customerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  saveList(l: Omit<SavedList, "id" | "createdAt" | "updatedAt">) {
    return this.mutate((d) => {
      const now = new Date().toISOString();
      const existing = d.lists.find((x) => x.customerId === l.customerId && x.name.toLowerCase() === l.name.toLowerCase());
      if (existing) {
        existing.lines = l.lines;
        existing.updatedAt = now;
        return existing;
      }
      const rec: SavedList = { ...l, id: randomUUID(), createdAt: now, updatedAt: now };
      d.lists.push(rec);
      return rec;
    });
  }
  deleteList(customerId: string, listId: string) {
    return this.mutate((d) => {
      d.lists = d.lists.filter((l) => !(l.customerId === customerId && l.id === listId));
    });
  }
  async getConversation(phone: string) {
    const d = await this.read();
    const n = normalizePhone(phone);
    return d.conversations.find((c) => normalizePhone(c.phone) === n);
  }
  saveConversation(state: ConversationState) {
    return this.mutate((d) => {
      const n = normalizePhone(state.phone);
      d.conversations = d.conversations.filter((c) => normalizePhone(c.phone) !== n);
      d.conversations.push({ ...state, updatedAt: new Date().toISOString() });
    });
  }
}

let _store: CustomerStore | null = null;
export function getStore(): CustomerStore {
  if (!_store) _store = new FileStore();
  return _store;
}
