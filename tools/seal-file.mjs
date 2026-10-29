// Cifra singoli file (es. i video di Giulia) con il codice del sito: f -> f.enc, poi cancella f.
// Uso: node tools/seal-file.mjs file1 file2 ...   (codice in SITE_CODE)
import { webcrypto as w } from "node:crypto"; import fs from "node:fs";
const code = (process.env.SITE_CODE || "").trim().toUpperCase(); if (!code) { console.error("SITE_CODE mancante"); process.exit(1); }
const S = w.subtle, salt = Buffer.from(fs.readFileSync("data/salt.txt", "utf8").trim(), "base64");
const base = await S.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
const key = await S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
for (const f of process.argv.slice(2)) {
  const iv = w.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, key, fs.readFileSync(f)));
  fs.writeFileSync(f + ".enc", JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") }));
  fs.unlinkSync(f); console.log("cifrato", f);
}
