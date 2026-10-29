// Cifra i dati del sito: ogni data/<c>.json diventa data/<c>.enc (AES-GCM, chiave dal codice con PBKDF2).
// Uso: node tools/seal.mjs DATA_DIR CODICE
import { webcrypto as w } from "node:crypto"; import fs from "node:fs"; import path from "node:path";
const [dir, code] = process.argv.slice(2);
if (!dir || !code) { console.error("uso: node seal.mjs DATA_DIR CODICE"); process.exit(1); }
const s = w.subtle, E = new TextEncoder(), b64 = u => Buffer.from(u).toString("base64");
const salt = fs.existsSync(path.join(dir, "salt.txt")) ? Buffer.from(fs.readFileSync(path.join(dir, "salt.txt"), "utf8").trim(), "base64") : w.getRandomValues(new Uint8Array(16));
fs.writeFileSync(path.join(dir, "salt.txt"), b64(salt));
const base = await s.importKey("raw", E.encode(code.trim().toUpperCase()), "PBKDF2", false, ["deriveKey"]);
const key = await s.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
let n = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const iv = w.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await s.encrypt({ name: "AES-GCM", iv }, key, fs.readFileSync(path.join(dir, f))));
  fs.writeFileSync(path.join(dir, f.replace(/\.json$/, ".enc")), JSON.stringify({ iv: b64(iv), ct: b64(ct) }));
  fs.unlinkSync(path.join(dir, f)); n++;
}
console.log("cifrati", n, "file");
