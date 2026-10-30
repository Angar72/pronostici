// Avvisi sul telefono (ntfy) quando una schedina del giorno risulta vinta.
// Gira su GitHub Actions: legge le schedine cifrate in data/live.enc, controlla i risultati su ESPN
// e manda un avviso una sola volta per schedina. Env: SITE_CODE, NTFY_TOPIC (segreti del repository).
import { webcrypto as w } from "node:crypto"; import fs from "node:fs";
const code = (process.env.SITE_CODE || "").trim().toUpperCase(), topic = (process.env.NTFY_TOPIC || "").trim();
const DRY = !!process.env.DRY, STATE = "tools/avvisi-stato.json";
if (!code || !topic) { console.log("segreti mancanti"); process.exit(0); }
const fetchJ = async u => { try { const r = await fetch(u); return r.ok ? r.json() : null; } catch { return null; } };

async function open(name) {
  const s = w.subtle, salt = Buffer.from(fs.readFileSync("data/salt.txt", "utf8").trim(), "base64");
  const base = await s.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
  const key = await s.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const { iv, ct } = JSON.parse(fs.readFileSync(`data/${name}.enc`, "utf8"));
  return JSON.parse(new TextDecoder().decode(await s.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, key, Buffer.from(ct, "base64"))));
}

// stessi abbinamenti dei nomi usati dalla pagina
const ESPN_LG = { it_1: "ita.1", it_2: "ita.2", en_1: "eng.1", es_1: "esp.1", de_1: "ger.1", fr_1: "fra.1", nl_1: "ned.1", pt_1: "por.1", be_1: "bel.1", no_1: "nor.1", se_1: "swe.1", cl: "uefa.champions", el: "uefa.europa", ecl: "uefa.europa.conf" };
const E_ALIAS = { "psg": "paris saint germain", "inter": "internazionale", "man united": "manchester united", "man utd": "manchester united", "man city": "manchester city", "wolves": "wolverhampton", "spurs": "tottenham", "atletico": "atletico madrid", "bayern": "bayern munich", "gladbach": "monchengladbach", "sporting": "sporting cp", "athletic": "athletic club", "betis": "real betis", "leverkusen": "bayer leverkusen", "paris": "paris fc", "rennes": "stade rennais", "lione": "lyon", "marsiglia": "marseille", "stoccarda": "stuttgart", "barcellona": "barcelona", "siviglia": "sevilla", "lipsia": "leipzig", "bayern monaco": "bayern munich", "union saint gilloise": "union st gilloise", "lilla": "lille", "bruges": "club brugge", "magonza": "mainz", "friburgo": "freiburg", "colonia": "cologne" };
const E_STOP = new Set(["fc", "ac", "cf", "sc", "afc", "ssc", "as", "us", "ss", "calcio", "club", "de", "sk", "fk", "if", "bk", "ik", "cd", "rc", "ud", "sd", "ca", "and", "the", "bc", "sv", "vfb", "vfl", "tsg", "fsv", "rcd", "aj", "ogc", "losc", "stade", "real", "hove", "albion"]);
const eNorm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a").replace(/ß/g, "ss").replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const eToks = s => { const n = eNorm(s); return (E_ALIAS[n] || n).split(" ").filter(x => x.length >= 3 && !E_STOP.has(x)); };
const eSim = (mine, theirs) => {
  const a = eToks(mine), b = eToks(theirs);
  if (!a.length || !b.length) { const raw = x => eNorm(x).split(" ").filter(y => y && !E_STOP.has(y)); const ra = raw(mine), rb = raw(theirs); return ra.length && ra.every(y => rb.includes(y)) ? 1 : 0; }
  return a.filter(x => b.some(y => y === x || (x.length >= 4 && y.length >= 4 && (y.includes(x) || x.includes(y))))).length / a.length;
};
const boards = {};
const board = (lg, d) => boards[lg + d] || (boards[lg + d] = fetchJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${d.replace(/-/g, "")}`).then(j => j?.events || []));
const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
async function result(l) {
  if (!ESPN_LG[l.id]) return null;
  for (const day of [l.d, addDays(l.d, -1), addDays(l.d, 1)]) {
    let best = null, bs = 0;
    for (const e of await board(ESPN_LG[l.id], day)) {
      const c = e.competitions?.[0]?.competitors || [], H = c.find(x => x.homeAway === "home"), A = c.find(x => x.homeAway === "away");
      if (!H || !A) continue;
      const nm = t => [t.team?.displayName, t.team?.shortDisplayName, t.team?.name].filter(Boolean);
      const sh = Math.max(...nm(H).map(n => eSim(l.h, n))), sa = Math.max(...nm(A).map(n => eSim(l.a, n)));
      if (sh > 0 && sa > 0 && sh + sa > bs) { bs = sh + sa; best = { e, H, A }; }
    }
    if (best) return best.e.status?.type?.completed ? { hg: +best.H.score || 0, ag: +best.A.score || 0 } : { pending: true };
  }
  return null;
}
const hit = (k, h, a) => ({ "1": h > a, "X": h === a, "2": h < a, "1X": h >= a, "X2": h <= a, "12": h !== a, "Over 2,5": h + a > 2, "Under 2,5": h + a < 3, "Goal": h > 0 && a > 0, "NoGoal": h === 0 || a === 0 })[k];
const euro = v => v.toFixed(2).replace(".", ",") + " €";

const rome = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).format(new Date(process.env.NOW || Date.now()));
const today = rome.slice(0, 10), hour = +rome.slice(11, 13);
const days = hour < 3 ? [addDays(today, -1), today] : [today];
const live = await open("live"), byDay = live.schedine?.byDay || {};
// Giulia a turno: un video diverso a ogni avviso
let GN = 1; try { GN = JSON.parse(fs.readFileSync("assets/giulia.json", "utf8")).n || 1; } catch {}
let stateG = 0; try { stateG = JSON.parse(fs.readFileSync(STATE, "utf8"))._giulia || 0; } catch {}
// manda l'avviso con la GIF di Giulia (decifrata qui e caricata su ntfy, che la tiene solo per poche ore)
async function send(title, msg, tags) {
  const q = new URLSearchParams({ title, message: msg, tags, priority: "high", click: "https://angar72.github.io/pronostici/#c=" + encodeURIComponent(code) });
  try {
    stateG++; const n = ((stateG - 1) % GN) + 1;
    const { iv, ct } = JSON.parse(fs.readFileSync(`assets/giulia-${n}.gif.enc`, "utf8"));
    const S = w.subtle, salt = Buffer.from(fs.readFileSync("data/salt.txt", "utf8").trim(), "base64");
    const base = await S.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
    const k = await S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const gif = Buffer.from(await S.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, k, Buffer.from(ct, "base64")));
    q.set("filename", "giulia.gif");
    const r = await fetch("https://ntfy.sh/" + encodeURIComponent(topic) + "?" + q, { method: "PUT", body: gif });
    if (r.ok) return r;
  } catch (e) { console.log("Giulia non allegata:", String(e).slice(0, 80)); }
  q.delete("filename");
  return fetch("https://ntfy.sh/" + encodeURIComponent(topic) + "?" + q, { method: "POST" });
}
if (process.env.PROVA === "true") {
  const n = Object.keys(byDay).length;
  const r = await send("Prova avvisi Pronostici", `Avvisi attivi: ho letto le schedine di ${n} giorni. Ti scrivo qui quando una schedina è vinta.`, "white_check_mark");
  console.log("prova inviata:", r.status);
}
let state = {}; try { state = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch {}
let sent = 0;
for (const day of days) {
  const D = byDay[day]; if (!D) continue;
  const list = (D.tickets || []).map((tk, i) => ({ name: `Schedina ${i + 1}`, legs: tk, stake: D.stake || 20 }));
  if (D.recovery?.legs?.length) list.push({ name: "Recupero", legs: D.recovery.legs, stake: D.recovery.stake || 20 });
  // recuperi del giorno prima giocati oggi
  const prev = byDay[addDays(day, -1)];
  if (prev?.recovery?.legs?.some(l => l.d === day)) list.push({ name: "Recupero", legs: prev.recovery.legs, stake: prev.recovery.stake || 20 });
  for (const t of list) {
    const key = day + "|" + t.name;
    if (state[key]) continue;
    // controllo solo dopo la fine prevista dell'ultima partita della schedina (inizio + 1 ora e 50)
    const last = t.legs.map(l => new Date(`${l.d}T${l.t || "23:00"}:00${l.d >= "2026-10-25" && l.d < "2027-03-28" ? "+01:00" : "+02:00"}`).getTime()).sort().pop();
    if (Date.now() < last + 110 * 60000) continue;
    const res = await Promise.all(t.legs.map(result));
    if (res.some(r => !r || r.pending)) continue;
    const ok = t.legs.every((l, i) => hit(l.k, res[i].hg, res[i].ag));
    if (!ok) { state[key] = "persa"; continue; }
    const q = t.legs.reduce((a, l) => a * l.odd, 1);
    const msg = `${t.name} vinta! Quota ${q.toFixed(2).replace(".", ",")} · incassi ${euro(t.stake * q)} con ${euro(t.stake)} giocati.\n` + t.legs.map((l, i) => `${l.h}-${l.a} ${res[i].hg}-${res[i].ag} (${l.k}) ✓`).join("\n");
    console.log(DRY ? "[prova] " : "", key);
    if (!DRY) {
      const r = await send("Schedina vinta!", msg, "tada,soccer");
      if (!r.ok) { console.log("invio non riuscito", r.status); continue; }
    }
    state[key] = "vinta"; sent++;
  }
}
// sistema con 1 errore permesso
for (const day of days) {
  const D = live.sistemi?.byDay?.[day]; if (!D?.legs?.length) continue;
  const key = day + "|Sistema"; if (state[key]) continue;
  const last = D.legs.map(l => new Date(`${l.d}T${l.t || "23:00"}:00${l.d >= "2026-10-25" && l.d < "2027-03-28" ? "+01:00" : "+02:00"}`).getTime()).sort().pop();
  if (Date.now() < last + 110 * 60000) continue;
  const res = await Promise.all(D.legs.map(result)); if (res.some(r => !r || r.pending)) continue;
  const ok = D.legs.map((l, i) => hit(l.k, res[i].hg, res[i].ag)), wrong = ok.filter(x => !x).length, n = D.legs.length, per = 20 / n;
  if (wrong >= 2) { state[key] = "perso"; continue; }
  const combos = D.legs.map((_, s) => D.legs.reduce((a, l, i) => i === s ? a : a * l.odd, 1) * per);
  const pay = wrong ? combos[ok.indexOf(false)] : combos.reduce((a, b) => a + b, 0);
  const msg = `Sistema ${n - 1}/${n} vinto ${wrong ? "con 1 errore" : "con tutte giuste"}! Incasso ${euro(pay)} su ${euro(n * per)} giocati.\n` + D.legs.map((l, i) => `${l.h}-${l.a} ${res[i].hg}-${res[i].ag} (${l.k}) ${ok[i] ? "✓" : "✗"}`).join("\n");
  if (!DRY) { const r = await send("Sistema vinto!", msg, "tada,soccer"); if (!r.ok) continue; }
  state[key] = "vinto"; sent++;
}
state._giulia = stateG;
// tengo solo gli ultimi 10 giorni
for (const k of Object.keys(state)) if (k !== "_giulia" && k.slice(0, 10) < addDays(today, -10)) delete state[k];
fs.writeFileSync(STATE, JSON.stringify(state, null, 1) + "\n");
console.log("avvisi inviati:", sent);
