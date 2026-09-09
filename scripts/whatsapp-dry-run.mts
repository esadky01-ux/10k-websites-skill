/**
 * WhatsApp ajanını yerel olarak simüle eder (Meta bağlantısı gerekmez).
 * Kullanım: npm run whatsapp:dry -- "5 koli kip doner 20kg, 2 kutu samurai 3L" "ok depo"
 * ANTHROPIC_API_KEY tanımlıysa Claude kullanılır, yoksa kural tabanlı yedek akış.
 */
import { handleIncoming } from "../src/server/whatsapp/agent";

process.env.MAXIMUS_DATA_DIR ??= "./data";
const phone = process.env.DRY_RUN_PHONE ?? "32470000000";
const args = process.argv.slice(2);
const messages = args.length ? args : ["5 koli kip doner 20kg, 2 kutu samurai 3 liter", "ok depo"];

for (const m of messages) {
  console.log(`\n👤 ${m}`);
  const reply = await handleIncoming(phone, m, "Test Dönerzaak");
  console.log(`🤖 ${reply.text}`);
  if (reply.orderId) console.log(`   ✔ sipariş ${reply.orderId}`);
}
