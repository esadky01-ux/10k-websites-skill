import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashPassword, verifyPassword, createSessionToken, readSessionToken } from "../src/server/auth";
import { FileStore } from "../src/server/store";

test("password hashing round-trips and rejects wrong password", () => {
  const h = hashPassword("geheim123");
  assert.ok(h.startsWith("scrypt$"));
  assert.equal(verifyPassword("geheim123", h), true);
  assert.equal(verifyPassword("fout", h), false);
});

test("session tokens are signed and expire", () => {
  const token = createSessionToken("abc");
  assert.equal(readSessionToken(token)?.sub, "abc");
  assert.equal(readSessionToken(token + "x"), null);
  assert.equal(readSessionToken("garbage"), null);
});

test("FileStore persists customers, orders and lists", async () => {
  const store = new FileStore(mkdtempSync(path.join(tmpdir(), "mx-store-")));
  const c = await store.createCustomer({ email: "Test@Example.com", passwordHash: "x", company: "Zaak", firstName: "Ali", lastName: "Yılmaz", contact: "Ali Yılmaz", phone: "0467 07 71 64", country: "BE", lang: "nl", status: "pending" });
  assert.equal((await store.listCustomers()).length, 1);
  await store.setCustomerStatus(c.id, "approved");
  assert.equal((await store.getCustomerById(c.id))?.status, "approved");
  assert.equal((await store.getCustomerByEmail("test@example.com"))?.id, c.id);
  assert.equal((await store.getCustomerByPhone("+32467077164"))?.id, c.id);
  await store.createOrder({ customerId: c.id, delivery: "depo", lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }], status: "whatsapp" });
  assert.equal((await store.listOrders(c.id)).length, 1);
  await store.saveList({ customerId: c.id, name: "Dinsdag", lines: [{ productId: "fd-drk-023", cases: 1, units: 0 }] });
  await store.saveList({ customerId: c.id, name: "dinsdag", lines: [{ productId: "fd-drk-023", cases: 3, units: 0 }] });
  const lists = await store.listSavedLists(c.id);
  assert.equal(lists.length, 1, "same name updates instead of duplicating");
  assert.equal(lists[0].lines[0].cases, 3);
  await store.deleteList(c.id, lists[0].id);
  assert.equal((await store.listSavedLists(c.id)).length, 0);
});
