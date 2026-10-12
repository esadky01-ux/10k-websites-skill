#!/usr/bin/env node
/**
 * Şemayı kurar/günceller: `npm run db:migrate`
 *
 * Bağlantı dizesi: MAXIMUS_DATABASE_URL (veya DATABASE_URL / POSTGRES_URL).
 * Idempotent — var olan tablolara dokunmaz, tekrar tekrar çalıştırılabilir.
 *
 * PostgresStore ilk kullanımda şemayı kendisi de kurar; bu betik dağıtımdan önce
 * açıkça çalıştırmak (ve hatayı deploy sırasında değil burada görmek) için vardır.
 */
import { PostgresStore, databaseUrl } from "../src/server/store-postgres";

const url = databaseUrl();
if (!url) {
  console.error(
    "Veritabanı bağlantı dizesi yok. MAXIMUS_DATABASE_URL (veya DATABASE_URL / POSTGRES_URL) tanımlayın.",
  );
  process.exit(1);
}

// Gizli bilgiyi yazdırmadan hangi sunucuya bağlandığımızı göster.
const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "(okunamayan URL)";
  }
})();

const store = new PostgresStore(url);
try {
  await store.migrate();
  console.log(`✔ Şema hazır (${host}).`);
} catch (err) {
  console.error(`✘ Şema kurulamadı (${host}):`, err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await store.close();
}
