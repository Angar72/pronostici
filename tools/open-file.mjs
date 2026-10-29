// Decifra un file .enc creato da seal-file.mjs e lo scrive su stdout. Uso: node tools/open-file.mjs file.enc
import { webcrypto as w } from "node:crypto"; import fs from "node:fs";
const code = (process.env.SITE_CODE || "").trim().toUpperCase();
const S = w.subtle, salt = Buffer.from(fs.readFileSync("data/salt.txt", "utf8").trim(), "base64");
const base = await S.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
const key = await S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
const { iv, ct } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(Buffer.from(await S.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, key, Buffer.from(ct, "base64"))));
