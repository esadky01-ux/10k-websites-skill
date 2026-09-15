#!/usr/bin/env node
/**
 * Bir sözlüğe yeni anahtarlar ekler (mevcut anahtarların üzerine YAZMAZ).
 *
 *   node scripts/i18n-add.mjs tr patch.json
 *   echo '{"faq":{"items":[...]}}' | node scripts/i18n-add.mjs en -
 *
 * Dosya kilidiyle çalışır; aynı anda birden fazla çağrı güvenlidir.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [locale, patchPath] = process.argv.slice(2);
if (!locale || !patchPath) {
  console.error("Kullanım: node scripts/i18n-add.mjs <locale> <patch.json|->");
  process.exit(1);
}

const target = join(root, "src", "i18n", "dictionaries", `${locale}.json`);
if (!existsSync(target)) {
  console.error(`Sözlük bulunamadı: ${target}`);
  process.exit(1);
}

const patchText = patchPath === "-" ? readFileSync(0, "utf8") : readFileSync(patchPath, "utf8");
const patch = JSON.parse(patchText);

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

function mergeMissing(base, add, path = "", report) {
  for (const key of Object.keys(add)) {
    const next = path ? `${path}.${key}` : key;
    if (!(key in base)) {
      base[key] = add[key];
      report.added.push(next);
    } else if (isObj(base[key]) && isObj(add[key])) {
      mergeMissing(base[key], add[key], next, report);
    } else {
      report.skipped.push(next);
    }
  }
  return base;
}

const lockDir = `${target}.lock`;
const deadline = Date.now() + 10_000;
for (;;) {
  try {
    mkdirSync(lockDir);
    break;
  } catch {
    if (Date.now() > deadline) {
      console.error("Kilit alınamadı; başka bir işlem sözlüğü kilitlemiş olabilir.");
      process.exit(1);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}

try {
  const current = JSON.parse(readFileSync(target, "utf8"));
  const report = { added: [], skipped: [] };
  const merged = mergeMissing(current, patch, "", report);
  writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`Eklendi (${report.added.length}): ${report.added.join(", ") || "-"}`);
  if (report.skipped.length) console.log(`Zaten vardı, atlandı (${report.skipped.length}): ${report.skipped.join(", ")}`);
} finally {
  rmSync(lockDir, { recursive: true, force: true });
}
