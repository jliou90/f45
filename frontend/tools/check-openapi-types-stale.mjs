import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

const host = process.env.KUTM_HOSTNAME || "kutm.local";
const sourceUrl = process.env.OPENAPI_URL || `https://${host}/openapi.json`;
const generatedFile = path.resolve("src/gen/openapi.d.ts");

let generated = "";
try {
  generated = await fs.readFile(generatedFile, "utf8");
} catch {
  console.warn(`WARN: ${generatedFile} does not exist. Run npm run gen:openapi:types`);
  process.exit(0);
}

const hashMatch = generated.match(/^\/\/ sha256: ([a-f0-9]{64})$/m);
if (!hashMatch) {
  console.warn("WARN: Generated OpenAPI types missing hash header. Re-run npm run gen:openapi:types");
  process.exit(0);
}

const current = await fetch(sourceUrl);
if (!current.ok) {
  console.warn(`WARN: Could not fetch ${sourceUrl} (HTTP ${current.status}).`);
  process.exit(0);
}

const currentText = await current.text();
const currentHash = crypto.createHash("sha256").update(currentText).digest("hex");

if (hashMatch[1] !== currentHash) {
  console.warn("WARN: OpenAPI types are stale. Run npm run gen:openapi:types");
  console.warn(`Current hash:   ${currentHash}`);
  console.warn(`Generated hash: ${hashMatch[1]}`);
  process.exit(0);
}

console.log("OpenAPI generated types are up to date.");
