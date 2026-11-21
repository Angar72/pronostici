// Quote aggiornate prima del calcio d'inizio (21/11, richiesta di Toni) e "prossima schedina".
// Gira dentro la Sentinella, senza Claude.
// 1) Circa un'ora prima della prima partita ancora da giocare delle schedine (e del sistema) di oggi rilegge le
//    quote Planetwin solo per quei campionati (1-2 richieste OddsPapi), al massimo 2 volte al giorno:
//    la quota di ogni partita viene aggiornata, quella del mattino resta in "odd0".
// 2) Quando le partite delle schedine di oggi sono tutte finite (o oggi non ce ne sono e sono passate le 20),
//    stampa PROSSIMA=yyyy-mm-dd: la Sentinella prepara subito le schedine del giorno dopo.
import { webcrypto as w } from "node:crypto"; import fs from "node:fs";
const code = (process.env.SITE_CODE || "").trim().toUpperCase(), OP_KEY = (process.env.ODDSPAPI_KEY || "").trim();
if (!code) process.exit(0);
const S = w.subtle, salt = Buffer.from(fs.readFileSync("data/salt.txt", "utf8").trim(), "base64");
const base = await S.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
const KEY = await S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
const open = async c => { const { iv, ct } = JSON.parse(fs.readFileSync(`data/${c}.enc`, "utf8")); return JSON.parse(new TextDecoder().decode(await S.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, KEY, Buffer.from(ct, "base64")))); };
const seal = async (c, obj) => { const iv = w.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, KEY, new TextEncoder().encode(JSON.stringify(obj)))); fs.writeFileSync(`data/${c}.enc`, JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") })); };
const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const [TODAY, NOWT] = fmt.format(new Date()).split(" ");
const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mins = t => { const [h, m] = (t || "99:99").split(":").map(Number); return h * 60 + m; };
const now = mins(NOWT);

const live = await open("live"), odds = await open("odds"), leagues = await open("leagues");
const D = live.schedine?.byDay?.[TODAY], SIS = live.sistemi?.byDay?.[TODAY];
const legs = [...(D?.tickets || []).flat(), ...(SIS?.legs || [])].filter(l => l.d === TODAY);

// ---------- 1. quote prima del calcio d'inizio ----------
const OP_T = { it_1: 23, it_2: 53, en_1: 17, es_1: 8, de_1: 35, fr_1: 34, nl_1: 37, pt_1: 238, be_1: 38, no_1: 20, se_1: 40, cl: 7, el: 679, ecl: 34480, unl: 23755,
  es_c: 329, it_c: 328, en_fa: 19, en_lc: 21, de_c: 217, fr_c: 335, nl_c: 330, pt_c: 336 };
const MK = { "1": ["101", "101"], "X": ["101", "102"], "2": ["101", "103"], "1X": ["101902", "101902"], "12": ["101902", "101903"], "X2": ["101902", "101904"],
  "Over 2,5": ["1010", "1010"], "Under 2,5": ["1010", "1011"], "Goal": ["104", "104"], "NoGoal": ["104", "105"], "No Goal": ["104", "105"], "Over 1,5": ["108", "108"] };
const pending = legs.filter(l => l.t && mins(l.t) > now + 5);
const first = pending.length ? Math.min(...pending.map(l => mins(l.t))) : null;
const Q = D || SIS; let changed = false;
if (OP_KEY && Q && first !== null && first - now <= 75 && (Q.qn || 0) < 2 && (!Q.qAt || now - mins(Q.qAt) >= 150)) {
  const fx = {}; // fixtureId -> partite da aggiornare
  for (const l of pending) { const id = odds[l.id]?.fx?.[l.h + "|" + l.a]; if (id) (fx[id] ||= []).push(l); }
  const tids = [...new Set(pending.map(l => OP_T[l.id]).filter(Boolean))];
  let n = 0;
  for (let i = 0; i < tids.length; i += 5) {
    if (i) await new Promise(r => setTimeout(r, 2500));
    let j = null; try { const r = await fetch(`https://api.oddspapi.io/v4/odds-by-tournaments?bookmaker=planetwin365.it&tournamentIds=${tids.slice(i, i + 5).join(",")}&apiKey=${OP_KEY}`); if (r.ok) j = await r.json(); else console.log("quote: HTTP", r.status); } catch (e) { console.log("quote: errore", e.message); }
    for (const f of Array.isArray(j) ? j : []) {
      const mk = f.bookmakerOdds?.["planetwin365.it"]?.markets; if (!mk || !fx[f.fixtureId]) continue;
      for (const l of fx[f.fixtureId]) {
        const m = MK[l.k]; const v = m && mk[m[0]]?.outcomes?.[m[1]]?.players?.["0"]?.price;
        if (v > 1) { const q = Math.round(v * 100) / 100; if (l.odd0 == null) l.odd0 = l.odd; if (q !== l.odd) { l.odd = q; n++; } }
      }
    }
  }
  for (const X of [D, SIS].filter(Boolean)) { X.qAt = NOWT; X.qn = (X.qn || 0) + 1; }
  changed = true;
  console.log(`quote aggiornate alle ${NOWT}: ${n} cambiate (${tids.length} campionati)`);
}
if (changed) await seal("live", live);

// ---------- 2. prossima schedina ----------
const TOM = addDays(TODAY, 1);
const tomFix = Object.values(leagues).some(L => (L.fixtures || []).some(f => f.startsWith(TOM)));
const timed = legs.filter(l => l.t), lastEnd = timed.length ? Math.max(...timed.map(l => mins(l.t) + 125)) : 20 * 60;
if (!live.schedine?.byDay?.[TOM] && tomFix && now >= lastEnd && now >= 17 * 60) console.log("PROSSIMA=" + TOM);
