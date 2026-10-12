/**
 * Depo uyumluluk testleri.
 *
 * Aynı iddialar HER iki uygulamaya karşı çalışır: FileStore (yerel geliştirme) ve
 * PostgresStore (üretim). Amaç, üretime geçen deponun dosya tabanlı olanla aynı
 * davranmasını kanıtlamak — çağıran kod (rotalar, ajan, auth) hiç değişmediği için
 * davranış farkı sessiz hatalara dönüşür.
 *
 * PostgresStore yalnızca MAXIMUS_TEST_DATABASE_URL tanımlıysa test edilir; tanımsızsa
 * o blok atlanır, böylece `npm test` dış servis olmadan çalışmaya devam eder.
 */
import { test, suite, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileStore, type CustomerStore } from "../src/server/store";
import { PostgresStore } from "../src/server/store-postgres";

const TEST_DB = process.env.MAXIMUS_TEST_DATABASE_URL?.trim();

const baseCustomer = {
  passwordHash: "x",
  company: "Zaak",
  firstName: "Ali",
  lastName: "Yılmaz",
  contact: "Ali Yılmaz",
  country: "BE",
  lang: "nl" as const,
  status: "pending" as const,
};

/** Her iki uygulamanın da geçmesi gereken iddialar. */
function conformance(name: string, makeStore: () => Promise<CustomerStore>) {
  suite(`${name} uyumluluk`, () => {
    let store: CustomerStore;
    before(async () => {
      store = await makeStore();
    });

    test("müşteri oluşturur, e-postayı küçük harfe çevirir ve geri okur", async () => {
      const c = await store.createCustomer({ ...baseCustomer, email: "Test@Example.com", phone: "0467 07 71 64" });
      assert.ok(c.id, "id atanır");
      assert.ok(c.createdAt, "createdAt atanır");
      assert.equal(c.email, "test@example.com", "e-posta normalize edilir");
      assert.equal(c.status, "pending");

      assert.equal((await store.getCustomerById(c.id))?.id, c.id);
      assert.equal((await store.getCustomerByEmail("test@example.com"))?.id, c.id);
      assert.equal((await store.getCustomerByEmail("TEST@EXAMPLE.COM "))?.id, c.id, "arama da normalize eder");
      // Telefon normalleştirme: baştaki 0 → 32, boşluk/artı atılır.
      assert.equal((await store.getCustomerByPhone("+32467077164"))?.id, c.id);
      assert.equal((await store.getCustomerByPhone("0467077164"))?.id, c.id);
    });

    test("olmayan kayıtlar undefined döner (fırlatmaz)", async () => {
      assert.equal(await store.getCustomerById("yok-boyle-bir-id"), undefined);
      assert.equal(await store.getCustomerByEmail("yok@example.com"), undefined);
      assert.equal(await store.getCustomerByPhone("0000000000"), undefined);
      assert.equal(await store.getConversation("0000000000"), undefined);
      // Bozulmuş oturum çerezinden gelebilecek uuid olmayan değer 500 üretmemeli.
      assert.equal(await store.getCustomerById("not-a-uuid-at-all"), undefined);
    });

    test("tanımsız isteğe bağlı alanlar null olarak geri dönmez", async () => {
      const c = await store.createCustomer({ ...baseCustomer, email: "opt@example.com", phone: "0470000001" });
      const back = await store.getCustomerById(c.id);
      // publicProfile() bunları JSON'a koyar; null sızarsa istemci "null" gösterir.
      assert.equal(back?.vat, undefined);
      assert.equal(back?.street, undefined);
      assert.equal(back?.city, undefined);
      assert.equal(back?.approvedAt, undefined);
    });

    test("isteğe bağlı alanlar verildiğinde korunur", async () => {
      const c = await store.createCustomer({
        ...baseCustomer,
        email: "full@example.com",
        phone: "0470000002",
        vat: "BE0123456789",
        street: "Grote Markt 1",
        postcode: "3200",
        city: "Aarschot",
        businessType: "restaurant",
        lang: "tr",
      });
      const back = await store.getCustomerById(c.id);
      assert.equal(back?.vat, "BE0123456789");
      assert.equal(back?.street, "Grote Markt 1");
      assert.equal(back?.postcode, "3200");
      assert.equal(back?.city, "Aarschot");
      assert.equal(back?.businessType, "restaurant");
      assert.equal(back?.lang, "tr");
    });

    test("onay durumu güncellenir ve approvedAt yazılır", async () => {
      const c = await store.createCustomer({ ...baseCustomer, email: "appr@example.com", phone: "0470000003" });
      const updated = await store.setCustomerStatus(c.id, "approved");
      assert.equal(updated?.status, "approved");
      assert.ok(updated?.approvedAt, "approvedAt onayda yazılır");
      assert.equal((await store.getCustomerById(c.id))?.status, "approved", "kalıcı");

      const rejected = await store.setCustomerStatus(c.id, "rejected");
      assert.equal(rejected?.status, "rejected");
      // Olmayan müşteri: rota 404 döndürebilmek için undefined bekler.
      assert.equal(await store.setCustomerStatus("yok", "approved"), undefined);
    });

    test("müşteri listesi en yeniden eskiye sıralanır", async () => {
      const a = await store.createCustomer({ ...baseCustomer, email: "s1@example.com", phone: "0470000011" });
      // Damgalar farklı olsun: aynı milisaniyedeki eşitliği iki uygulama farklı bozar
      // (FileStore ekleme sırasını korur, PostgresStore seq ile en yeniyi öne alır).
      // Burada sıralama sözleşmesi test edilir, eşitlik bozma değil.
      await new Promise((r) => setTimeout(r, 5));
      const b = await store.createCustomer({ ...baseCustomer, email: "s2@example.com", phone: "0470000012" });
      const ids = (await store.listCustomers()).map((c) => c.id);
      assert.ok(ids.includes(a.id) && ids.includes(b.id));
      assert.ok(ids.indexOf(b.id) < ids.indexOf(a.id), "sonra oluşan önce gelir");
    });

    test("sipariş oluşturur, müşteriye göre ve toplu listeler", async () => {
      const c = await store.createCustomer({ ...baseCustomer, email: "ord@example.com", phone: "0470000004" });
      const o = await store.createOrder({
        customerId: c.id,
        delivery: "depo",
        lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }],
        status: "whatsapp",
        source: "web",
        estimateExclVat: 12.34,
      });
      assert.ok(o.id);
      const mine = await store.listOrders(c.id);
      assert.equal(mine.length, 1);
      assert.equal(mine[0].delivery, "depo");
      assert.deepEqual(mine[0].lines, [{ productId: "fd-drk-023", cases: 2, units: 0 }], "jsonb satırları aynen döner");
      assert.equal(mine[0].estimateExclVat, 12.34, "tahmin sayı olarak döner (dizge değil)");
      assert.equal(mine[0].source, "web");
      assert.equal(mine[0].note, undefined);
      assert.ok((await store.listAllOrders()).some((x) => x.id === o.id));
      assert.equal((await store.listOrders("baska-musteri")).length, 0, "müşteriye göre filtreler");
    });

    test("WhatsApp siparişi hesabı olmayan wa: kimliğiyle kaydedilir", async () => {
      // agent.ts hesabı olmayan numara için `wa:<telefon>` üretir; şemada FK olmamalı.
      const o = await store.createOrder({
        customerId: "wa:32467077164",
        delivery: "adres",
        lines: [{ productId: "fd-drk-023", cases: 1, units: 3 }],
        status: "whatsapp",
        source: "whatsapp-agent",
      });
      assert.equal((await store.listOrders("wa:32467077164"))[0]?.id, o.id);
      assert.equal(o.estimateExclVat, undefined);
    });

    test("sipariş limiti uygulanır", async () => {
      const c = await store.createCustomer({ ...baseCustomer, email: "lim@example.com", phone: "0470000005" });
      for (let i = 0; i < 3; i++) {
        await store.createOrder({
          customerId: c.id,
          delivery: "adres",
          lines: [{ productId: "fd-drk-023", cases: i + 1, units: 0 }],
          status: "whatsapp",
        });
      }
      assert.equal((await store.listOrders(c.id, 2)).length, 2);
      assert.equal((await store.listAllOrders(1)).length, 1);
    });

    test("kayıtlı liste aynı adda güncellenir, çoğaltılmaz", async () => {
      const c = await store.createCustomer({ ...baseCustomer, email: "lst@example.com", phone: "0470000006" });
      const first = await store.saveList({
        customerId: c.id,
        name: "Dinsdag",
        lines: [{ productId: "fd-drk-023", cases: 1, units: 0 }],
      });
      const second = await store.saveList({
        customerId: c.id,
        name: "dinsdag", // harf duyarsız aynı ad
        lines: [{ productId: "fd-drk-023", cases: 3, units: 0 }],
      });
      const lists = await store.listSavedLists(c.id);
      assert.equal(lists.length, 1, "aynı ad çoğaltmaz, günceller");
      assert.equal(lists[0].lines[0].cases, 3, "kalemler güncellenir");
      assert.equal(second.id, first.id, "id korunur");
      assert.equal(second.createdAt, first.createdAt, "createdAt korunur");

      await store.deleteList(c.id, lists[0].id);
      assert.equal((await store.listSavedLists(c.id)).length, 0);
    });

    test("liste silme başka müşterinin listesine dokunmaz", async () => {
      const a = await store.createCustomer({ ...baseCustomer, email: "d1@example.com", phone: "0470000007" });
      const b = await store.createCustomer({ ...baseCustomer, email: "d2@example.com", phone: "0470000008" });
      const la = await store.saveList({ customerId: a.id, name: "Lijst", lines: [{ productId: "fd-drk-023", cases: 1, units: 0 }] });
      await store.saveList({ customerId: b.id, name: "Lijst", lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }] });
      // Başka müşterinin id'siyle silme denemesi etkisiz kalmalı.
      await store.deleteList(b.id, la.id);
      assert.equal((await store.listSavedLists(a.id)).length, 1, "silinmedi");
      assert.equal((await store.listSavedLists(b.id)).length, 1, "aynı ad farklı müşteride ayrı liste");
      assert.equal((await store.listSavedLists(b.id))[0].lines[0].cases, 2);
    });

    test("WhatsApp sohbet durumu numaraya göre saklanır ve üzerine yazılır", async () => {
      const state = {
        phone: "+32 470 00 00 09",
        lang: "nl" as const,
        draft: [{ productId: "fd-drk-023", cases: 1, units: 0 }],
        history: [{ role: "user" as const, text: "merhaba", at: new Date().toISOString() }],
        updatedAt: new Date().toISOString(),
      };
      await store.saveConversation(state);
      // Farklı yazımla aynı numara bulunur (normalizePhone).
      const back = await store.getConversation("0470000009");
      assert.equal(back?.lang, "nl");
      assert.deepEqual(back?.draft, state.draft);
      assert.equal(back?.history.length, 1);
      assert.equal(back?.customerId, undefined);

      await store.saveConversation({ ...state, lang: "tr", draft: [], customerId: "c-1", history: [] });
      const all = await store.getConversation("+32470000009");
      assert.equal(all?.lang, "tr", "üzerine yazar, çoğaltmaz");
      assert.deepEqual(all?.draft, []);
      assert.equal(all?.customerId, "c-1");
    });
  });
}

conformance("FileStore", async () => new FileStore(mkdtempSync(path.join(tmpdir(), "mx-conf-"))));

if (TEST_DB) {
  const pg = new PostgresStore(TEST_DB);
  after(async () => {
    await pg.close();
  });
  conformance("PostgresStore", async () => {
    await pg.migrate();
    await pg.truncateAllForTests(); // her koşuda temiz başla
    return pg;
  });
} else {
  test("PostgresStore uyumluluk testleri atlandı (MAXIMUS_TEST_DATABASE_URL tanımsız)", (t) => {
    t.skip("MAXIMUS_TEST_DATABASE_URL tanımlı değil");
  });
}
