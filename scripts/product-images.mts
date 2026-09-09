/**
 * Ürün görsellerini toplu içe aktarır.
 *
 *   npm run images
 *
 * 1) product-images-inbox/ içindeki görselleri (jpg/png/webp/heic hariç) okur.
 *    Dosya adı (uzantısız) şu sırayla eşleştirilir: SKU → ürün id → Hollandaca katalog adı.
 *    Alternatif: inbox içine `map.csv` koyun; her satır "dosyaadı,ürün-id" (veya "dosyaadı,SKU").
 * 2) Görseli kare beyaz zemine oturtup 800×800 WebP olarak public/media/products/<id>.webp yazar.
 * 3) public/media/products klasörünü tarayıp src/data/product-images.ts dosyasını yeniden üretir.
 *
 * Eşleşmeyen dosyalar raporlanır, hiçbir şey silinmez.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { products } from "../src/data/products";

const root = process.cwd();
const inbox = path.join(root, "product-images-inbox");
const outDir = path.join(root, "public", "media", "products");
const mapFile = path.join(root, "src", "data", "product-images.ts");
const SIZE = 800;
const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff", ".gif"]);

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const bySku = new Map(products.filter((p) => p.sku !== "—").map((p) => [norm(p.sku), p.id]));
const byId = new Map(products.map((p) => [p.id, p.id]));
const byNl = new Map(products.map((p) => [norm(p.nameNl), p.id]));

function resolve(key: string): string | undefined {
  const k = key.trim();
  return byId.get(k) ?? bySku.get(norm(k)) ?? byId.get(norm(k).replace(/ /g, "-")) ?? byNl.get(norm(k));
}

function readCsvMap(): Map<string, string> {
  const m = new Map<string, string>();
  const f = path.join(inbox, "map.csv");
  if (!existsSync(f)) return m;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const [file, key] = line.split(/[,;\t]/).map((s) => s?.trim());
    if (!file || !key || file.toLowerCase().startsWith("dosya") || file.toLowerCase() === "file") continue;
    const id = resolve(key);
    if (id) m.set(file, id);
    else console.warn(`map.csv: '${key}' hiçbir ürünle eşleşmedi (${file})`);
  }
  return m;
}

async function importInbox() {
  if (!existsSync(inbox)) return;
  mkdirSync(outDir, { recursive: true });
  const csv = readCsvMap();
  const files = readdirSync(inbox).filter((f) => exts.has(path.extname(f).toLowerCase()));
  let ok = 0;
  const missed: string[] = [];
  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    const id = csv.get(file) ?? csv.get(stem) ?? resolve(stem);
    if (!id) { missed.push(file); continue; }
    const target = path.join(outDir, `${id}.webp`);
    await sharp(path.join(inbox, file))
      .rotate()
      .resize({ width: SIZE, height: SIZE, fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 82 })
      .toFile(target);
    console.log(`✓ ${file} → ${path.relative(root, target)} (${(statSync(target).size / 1024).toFixed(0)} KB)`);
    ok++;
  }
  console.log(`${ok} görsel içe aktarıldı.`);
  if (missed.length) {
    console.warn(`Eşleşmeyen ${missed.length} dosya (SKU, ürün id veya katalog adıyla adlandırın ya da map.csv kullanın):`);
    for (const f of missed) console.warn(`  - ${f}`);
  }
}

function writeMap() {
  const entries = existsSync(outDir)
    ? readdirSync(outDir)
        .filter((f) => f.endsWith(".webp"))
        .map((f) => f.replace(/\.webp$/, ""))
        .filter((id) => byId.has(id))
        .sort()
    : [];
  const body = entries.map((id) => `  "${id}": "/media/products/${id}.webp",`).join("\n");
  const src = `/**
 * Ürün görselleri: ürün id → public altındaki dosya yolu.
 * Bu dosya \`npm run images\` ile public/media/products klasöründen otomatik üretilir; elle düzenlemeyin.
 * Görsel eklemek için product-images-inbox/ klasörüne SKU veya ürün id'siyle adlandırılmış dosyaları koyup scripti çalıştırın.
 */
export const productImages: Record<string, string> = {
${body}
};

export function productImage(id: string): string | undefined {
  return productImages[id];
}
`;
  writeFileSync(mapFile, src);
  console.log(`${entries.length} ürün görseli eşlendi → ${path.relative(root, mapFile)}`);
}

await importInbox();
writeMap();
