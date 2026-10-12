import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PostgresStore } from "../src/server/store-postgres";
import type { CustomerRecord } from "../src/server/store";

/**
 * Postgres deposunun bütünleşme testi.
 *
 * TEST_DATABASE_URL verilmezse testler atlanır; böylece veritabanı olmayan bir
 * makinede `npm test` yine çalışır. Yerel bir sunucuyla çalıştırmak için:
 *   TEST_DATABASE_URL=postgres://maximus@127.0.0.1:55432/maximus_test npm test
 */
const URL = process.env.TEST_DATABASE_URL;
const skip = URL ? false : "TEST_DATABASE_URL yok";

let store: PostgresStore;

before(async () => {
  if (!URL) return;
  store = new PostgresStore(URL);
  // Her koşu temiz bir şemayla başlasın
  const admin = new PostgresStore(URL);
  await admin["pool"].query("DROP TABLE IF EXISTS customers, orders, lists, conversations");
  await admin.close();
});

after(async () => {
  if (store) await store.close();
});

const baseCustomer: Omit<CustomerRecord, "id" | "createdAt"> = {
  email: "  Chef@Frituur.BE ",
  passwordHash: "scrypt$abc$def",
  company: "Frituur De Hoek",
  vat: "BE0123456789",
  firstName: "Jan",
  lastName: "Peeters",
  contact: "Jan Peeters",
  phone: "0470 11 22 33",
  street: "Dorpsstraat 1",
  postcode: "3000",
  city: "Leuven",
  country: "BE",
  businessType: "frituur",
  lang: "nl",
  status: "pending",
};

test("yeni müşteri kaydedilir, e-posta küçük harfe iner ve boşlukları kırpılır", { skip }, async () => {
  const created = await store.createCustomer(baseCustomer);
  assert.equal(created.email, "chef@frituur.be");
  assert.match(created.id, /^[0-9a-f-]{36}$/);

  const byEmail = await store.getCustomerByEmail("CHEF@frituur.be");
  assert.equal(byEmail?.id, created.id, "e-posta araması büyük/küçük harf ayırmamalı");
  assert.equal(byEmail?.company, "Frituur De Hoek");
  assert.equal(byEmail?.vat, "BE0123456789");
  assert.equal(byEmail?.status, "pending");

  const byId = await store.getCustomerById(created.id);
  assert.equal(byId?.email, "chef@frituur.be");
});

test("telefon farklı yazımlarla da bulunur", { skip }, async () => {
  // 0470 11 22 33 → 32470112233: boşluklar atılır, baştaki 0 ülke koduna çevrilir
  for (const written of ["0470112233", "+32 470 11 22 33", "0470 11 22 33", "32470112233"]) {
    const hit = await store.getCustomerByPhone(written);
    assert.equal(hit?.company, "Frituur De Hoek", `${written} aynı müşteriye gitmeli`);
  }
});

test("bilinmeyen e-posta, id ve telefon undefined döner (hata fırlatmaz)", { skip }, async () => {
  assert.equal(await store.getCustomerByEmail("yok@yok.be"), undefined);
  assert.equal(await store.getCustomerById("00000000-0000-0000-0000-000000000000"), undefined);
  // Geçersiz biçimli id uuid sütununda hata vermemeli
  assert.equal(await store.getCustomerById("not-a-uuid"), undefined);
  assert.equal(await store.getCustomerByPhone("0000"), undefined);
});

test("aynı e-posta ikinci kez kaydedilemez", { skip }, async () => {
  await assert.rejects(() => store.createCustomer(baseCustomer), /duplicate key|unique/i);
});

test("durum onaya çevrilince approvedAt dolar, reddedilince korunur", { skip }, async () => {
  const c = await store.getCustomerByEmail("chef@frituur.be");
  assert.ok(c);
  const approved = await store.setCustomerStatus(c.id, "approved");
  assert.equal(approved?.status, "approved");
  assert.ok(approved?.approvedAt, "onay zamanı yazılmalı");

  const rejected = await store.setCustomerStatus(c.id, "rejected");
  assert.equal(rejected?.status, "rejected");
  assert.equal(rejected?.approvedAt, approved?.approvedAt, "red, eski onay zamanını silmemeli");

  await store.setCustomerStatus(c.id, "approved");
  assert.equal(await store.setCustomerStatus("00000000-0000-0000-0000-000000000000", "approved"), undefined);
});

test("müşteri listesi en yeniden eskiye sıralanır", { skip }, async () => {
  await store.createCustomer({ ...baseCustomer, email: "tweede@frituur.be", company: "Tweede Zaak" });
  const all = await store.listCustomers();
  assert.equal(all.length, 2);
  assert.ok(all[0].createdAt >= all[1].createdAt, "en yeni kayıt başta olmalı");
});

test("sipariş kaydedilir, satırlar ve tutar bozulmadan geri gelir", { skip }, async () => {
  const c = await store.getCustomerByEmail("chef@frituur.be");
  assert.ok(c);
  const order = await store.createOrder({
    customerId: c.id,
    delivery: "adres",
    lines: [
      { productId: "tavuk-doner-20kg", cases: 3, units: 0 },
      { productId: "samurai-3l", cases: 1, units: 2 },
    ],
    note: "Vrijdag leveren",
    status: "whatsapp",
    source: "web",
    estimateExclVat: 412.5,
  });

  const mine = await store.listOrders(c.id);
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0].lines, order.lines, "satırlar jsonb'den aynı şekilde dönmeli");
  assert.equal(mine[0].estimateExclVat, 412.5, "numeric sütun sayı olarak dönmeli");
  assert.equal(mine[0].note, "Vrijdag leveren");
  assert.equal(mine[0].source, "web");

  const everyone = await store.listAllOrders();
  assert.equal(everyone.length, 1);
  // Başka müşterinin siparişi görünmemeli
  const other = await store.getCustomerByEmail("tweede@frituur.be");
  assert.deepEqual(await store.listOrders(other!.id), []);
});

test("tutarsız sipariş alanları boş geçilebilir", { skip }, async () => {
  const c = await store.getCustomerByEmail("tweede@frituur.be");
  const rec = await store.createOrder({ customerId: c!.id, delivery: "depo", lines: [], status: "draft" });
  const back = (await store.listOrders(c!.id))[0];
  assert.equal(back.id, rec.id);
  assert.equal(back.note, undefined);
  assert.equal(back.estimateExclVat, undefined);
  assert.deepEqual(back.lines, []);
});

test("sipariş listesi limitle kısaltılır ve en yeni başta gelir", { skip }, async () => {
  const c = await store.getCustomerByEmail("chef@frituur.be");
  for (let i = 0; i < 3; i++) {
    await store.createOrder({ customerId: c!.id, delivery: "depo", lines: [], status: "draft" });
  }
  const two = await store.listOrders(c!.id, 2);
  assert.equal(two.length, 2);
  assert.ok(two[0].createdAt >= two[1].createdAt);
  assert.equal((await store.listAllOrders(1)).length, 1);
});

test("kayıtlı liste aynı adla yeniden kaydedilince üzerine yazılır", { skip }, async () => {
  const c = await store.getCustomerByEmail("chef@frituur.be");
  const first = await store.saveList({
    customerId: c!.id,
    name: "Vaste lijst",
    lines: [{ productId: "tavuk-doner-20kg", cases: 2, units: 0 }],
  });
  const second = await store.saveList({
    customerId: c!.id,
    // Büyük/küçük harf farkı aynı liste sayılmalı
    name: "vaste LIJST",
    lines: [{ productId: "samurai-3l", cases: 5, units: 0 }],
  });
  assert.equal(second.id, first.id, "yeni satır açılmamalı");
  const lists = await store.listSavedLists(c!.id);
  assert.equal(lists.length, 1);
  assert.deepEqual(lists[0].lines, [{ productId: "samurai-3l", cases: 5, units: 0 }]);
  assert.ok(lists[0].updatedAt >= lists[0].createdAt);
});

test("liste silinir, başkasının listesi silinemez", { skip }, async () => {
  const c = await store.getCustomerByEmail("chef@frituur.be");
  const other = await store.getCustomerByEmail("tweede@frituur.be");
  const list = (await store.listSavedLists(c!.id))[0];

  await store.deleteList(other!.id, list.id);
  assert.equal((await store.listSavedLists(c!.id)).length, 1, "başka müşteri silememeli");

  await store.deleteList(c!.id, list.id);
  assert.deepEqual(await store.listSavedLists(c!.id), []);
});

test("WhatsApp sohbet durumu telefona göre yazılır ve üzerine yazılır", { skip }, async () => {
  await store.saveConversation({
    phone: "+32 470 99 88 77",
    lang: "tr",
    draft: [{ productId: "tavuk-doner-20kg", cases: 1, units: 0 }],
    history: [{ role: "user", text: "3 koli tavuk döner", at: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  });

  // Aynı numara farklı yazımla gelse de tek kayıt olmalı
  const found = await store.getConversation("0470998877");
  assert.equal(found?.lang, "tr");
  assert.equal(found?.draft.length, 1);
  assert.equal(found?.history.length, 1);

  await store.saveConversation({
    phone: "0470998877",
    lang: "nl",
    draft: [],
    history: [],
    updatedAt: new Date().toISOString(),
  });
  const after = await store.getConversation("+32470998877");
  assert.equal(after?.lang, "nl", "ikinci yazma üzerine yazmalı");
  assert.deepEqual(after?.draft, []);
  assert.equal(await store.getConversation("0470000000"), undefined);
});

test("şema iki kez kurulsa da bozulmaz (yeni örnek aynı veriyi görür)", { skip }, async () => {
  const second = new PostgresStore(URL!);
  const c = await second.getCustomerByEmail("chef@frituur.be");
  assert.equal(c?.company, "Frituur De Hoek", "ikinci örnek aynı veriyi okumalı");
  await second.close();
});
