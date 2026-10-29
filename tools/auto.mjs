// Aggiornamento automatico (GitHub Actions): risultati e calendario da ESPN, quote Planetwin365 da OddsPapi,
// schedine del giorno con le regole concordate. Legge e riscrive i dati cifrati in data/*.enc.
// Env: SITE_CODE, ODDSPAPI_KEY. Opzionali: FORCE=true (rifà le schedine di oggi), NOW (per le prove).
import { webcrypto as w } from "node:crypto"; import fs from "node:fs";
const code = (process.env.SITE_CODE || "").trim().toUpperCase(), OP_KEY = (process.env.ODDSPAPI_KEY || "").trim();
const FORCE = process.env.FORCE === "true", LOTTO_ONLY = process.env.LOTTO_ONLY === "true", NOW = new Date(process.env.NOW || Date.now());
if (!code) { console.log("SITE_CODE mancante"); process.exit(0); }
const log = (...a) => console.log(...a);
const fetchJ = async (u, tries = 2) => { for (let i = 0; i < tries; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); log("HTTP", r.status, u.replace(/apiKey=[^&]+/, "apiKey=***")); } catch (e) { log("errore rete", String(e).slice(0, 80)); } } return null; };

// ---------- cifratura (come tools/seal.mjs e la pagina) ----------
const S = w.subtle, salt = Buffer.from(fs.readFileSync("data/salt.txt", "utf8").trim(), "base64");
const base = await S.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
const KEY = await S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
async function open(c) { const { iv, ct } = JSON.parse(fs.readFileSync(`data/${c}.enc`, "utf8")); return JSON.parse(new TextDecoder().decode(await S.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, KEY, Buffer.from(ct, "base64")))); }
async function seal(c, obj) { const iv = w.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, KEY, new TextEncoder().encode(JSON.stringify(obj)))); fs.writeFileSync(`data/${c}.enc`, JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") })); }

// ---------- date e nomi ----------
const romeFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const rome = d => { const [a, b] = romeFmt.format(new Date(d)).split(" "); return { d: a, t: b }; };
const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(a + "T12:00:00Z") - new Date(b + "T12:00:00Z")) / 864e5);
const TODAY = rome(NOW).d, NOWT = rome(NOW).t;
const ESPN_LG = { it_1: "ita.1", it_2: "ita.2", en_1: "eng.1", es_1: "esp.1", de_1: "ger.1", fr_1: "fra.1", nl_1: "ned.1", pt_1: "por.1", be_1: "bel.1", no_1: "nor.1", se_1: "swe.1", cl: "uefa.champions", el: "uefa.europa", ecl: "uefa.europa.conf" };
// coppe nazionali: id -> [codice ESPN, id OddsPapi, nome, bandiera, campionati di casa]
const NAT_CUPS = {
  es_c: ["esp.copa_del_rey", 329, "Coppa del Re", "🇪🇸", ["es_1"]],
  it_c: ["ita.coppa_italia", 328, "Coppa Italia", "🇮🇹", ["it_1", "it_2"]],
  en_fa: ["eng.fa", 19, "FA Cup", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ["en_1"]],
  en_lc: ["eng.league_cup", 21, "Coppa di Lega inglese", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ["en_1"]],
  de_c: ["ger.dfb_pokal", 217, "Coppa di Germania", "🇩🇪", ["de_1"]],
  fr_c: ["fra.coupe_de_france", 335, "Coppa di Francia", "🇫🇷", ["fr_1"]],
  nl_c: ["ned.cup", 330, "Coppa d'Olanda", "🇳🇱", ["nl_1"]],
  pt_c: ["por.taca.portugal", 336, "Coppa di Portogallo", "🇵🇹", ["pt_1"]],
};
for (const [id, c] of Object.entries(NAT_CUPS)) ESPN_LG[id] = c[0];
const OP_T = { it_1: 23, it_2: 53, en_1: 17, es_1: 8, de_1: 35, fr_1: 34, nl_1: 37, pt_1: 238, be_1: 38, no_1: 20, se_1: 40, cl: 7, el: 679, ecl: 34480 };
for (const [id, c] of Object.entries(NAT_CUPS)) OP_T[id] = c[1];
const E_ALIAS = { "psg": "paris saint germain", "inter": "internazionale", "man united": "manchester united", "man utd": "manchester united", "man city": "manchester city", "wolves": "wolverhampton", "spurs": "tottenham", "atletico": "atletico madrid", "bayern": "bayern munich", "bayern munchen": "bayern munich", "gladbach": "monchengladbach", "sporting": "sporting cp", "athletic": "athletic club", "betis": "real betis", "leverkusen": "bayer leverkusen", "paris": "paris fc", "rennes": "stade rennais", "koln": "cologne", "hamburger": "hamburg", "union saint gilloise": "union st gilloise", "club brugge": "club brugge", "sint truiden": "sint truidense", "standard liege": "standard liege", "hamkam": "hamarkameratene", "vitoria guimaraes": "vitoria de guimaraes", "estrela da amadora": "estrela", "deportivo la coruna": "deportivo", "inter milan": "internazionale" };
const E_STOP = new Set(["fc", "ac", "cf", "sc", "afc", "ssc", "as", "us", "ss", "calcio", "club", "de", "sk", "fk", "if", "bk", "ik", "cd", "rc", "ud", "sd", "ca", "and", "the", "bc", "sv", "vfb", "vfl", "tsg", "fsv", "rcd", "aj", "ogc", "losc", "stade", "real", "hove", "albion", "kv", "kvc", "krc", "royal", "aif", "is", "ff"]);
const eNorm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a").replace(/ß/g, "ss").replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const eToks = s => { const n = eNorm(s); return (E_ALIAS[n] || n).split(" ").filter(x => x.length >= 3 && !E_STOP.has(x)); };
const eSim = (mine, theirs) => {
  const a = eToks(mine), b = eToks(theirs);
  if (!a.length || !b.length) { const raw = x => eNorm(x).split(" ").filter(y => y && !E_STOP.has(y)); const ra = raw(mine), rb = raw(theirs); return ra.length && ra.every(y => rb.includes(y)) ? 1 : 0; }
  return a.filter(x => b.some(y => y === x || (x.length >= 4 && y.length >= 4 && (y.includes(x) || x.includes(y))))).length / a.length;
};
// squadra del nostro elenco che corrisponde a un nome esterno
const same = (x, y) => eSim(x, y) >= 1 && eSim(y, x) >= 1;
function teamOf(L, name) {
  // nelle coppe ci sono squadre di serie minori: serve il nome che corrisponde in entrambi i sensi
  if (L.cup) return (L.teams || []).find(t => t === name) || (L.teams || []).find(t => same(t, name)) || null;
  let best = null, bs = 0;
  for (const t of L.teams || []) { const s = Math.min(eSim(t, name), 1) + Math.min(eSim(name, t), 1) * 0.5; if (s > bs) { bs = s; best = t; } }
  return bs >= 0.75 ? best : null;
}

const leagues = await open("leagues"), odds = await open("odds"), live = await open("live"), lotto = await open("lotto");
const sch = live.schedine || (live.schedine = { byDay: {} }); sch.byDay = sch.byDay || {};
let changed = { leagues: false, odds: false, live: false, lotto: false };

// ---------- 0. Lotto e SuperEnalotto da estrazionedellotto.it ----------
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
async function page(u) { try { const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } }); return r.ok ? await r.text() : ""; } catch { return ""; } }
{
  const h = await page("https://www.estrazionedellotto.it/");
  const dm = /ESTRAZIONE N\.?\s*\d+[\s\S]{0,200}?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i.exec(h.replace(/<[^>]+>/g, " "));
  const ruote = {};
  for (const m of h.matchAll(/wheelTitle">\s*([A-Za-z]+)\s*<\/li>((?:\s*<li class="ball">\s*\d+\s*<\/li>){5})/g)) ruote[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()] = [...m[2].matchAll(/>\s*(\d+)\s*</g)].map(x => x[1]).join(" ");
  if (dm && Object.keys(ruote).length >= 11) {
    const date = `${dm[3]}-${String(MESI.indexOf(dm[2].toLowerCase()) + 1).padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    const D = lotto.draws || (lotto.draws = { draws: [] });
    if (!D.draws.some(x => x.date === date)) { D.draws.unshift({ date, ruote }); D.draws.sort((a, b) => a.date < b.date ? 1 : -1); D.updated = NOW.toISOString().slice(0, 16) + "Z"; changed.lotto = true; log("Lotto: nuova estrazione", date); }
  } else log("Lotto: pagina non letta");
  const s2 = await page("https://www.estrazionedellotto.it/superenalotto/risultati-superenalotto");
  const SE = lotto.superenalotto || (lotto.superenalotto = { draws: [] });
  for (const m of s2.matchAll(/<strong>(\d\d)\/(\d\d)\/(\d{4})<\/strong>[\s\S]{0,400}?<ul class="ballRow">([\s\S]*?)<\/ul>/g)) {
    const date = `${m[3]}-${m[2]}-${m[1]}`, body = m[4];
    const nums = [...body.matchAll(/class="ball ball">\s*(\d+)/g)].map(x => x[1]), j = /ball jolly">\s*(\d+)/.exec(body), ss = /ball superstar">\s*(\d+)/.exec(body);
    if (nums.length !== 6 || SE.draws.some(x => x.date === date) || date < addDays(TODAY, -60)) continue;
    SE.draws.push({ date, numeri: nums.join(" "), jolly: j ? +j[1] : null, superstar: ss ? +ss[1] : null }); changed.lotto = true; log("SuperEnalotto: nuova estrazione", date);
  }
  SE.draws.sort((a, b) => a.date < b.date ? 1 : -1); if (changed.lotto) SE.updated = NOW.toISOString().slice(0, 16) + "Z";
}
if (LOTTO_ONLY) { if (changed.lotto) await seal("lotto", lotto); log("solo Lotto:", changed.lotto); process.exit(0); }

// forza di una squadra del campionato dentro la coppa: rapporto gol fatti/subiti attenuato, poi il salto di categoria
const tierPrior = (home, att, def) => {
  const top = /_1$/.test(home), r = x => Math.round(x * 1000) / 1000;
  return top ? [r((att + 1) / 2 * 1.45), r((def + 1) / 2 * 0.7)] : [r((att + 1) / 2 * 0.9), r((def + 1) / 2 * 1.12)];
};
// ---------- 0b. coppe nazionali: squadre dal calendario ESPN, collegate al loro campionato ----------
for (const [id, [lg, , name, flag, doms]] of Object.entries(NAT_CUPS)) {
  const fresh = () => ({ code: id, name, flag, cup: true, ver: 2, k: 10, season: "", fixtures: [], played: [], prev: [], teams: [], dom: {}, prior: {} });
  const C = leagues[id]?.ver === 2 ? leagues[id] : fresh();
  let touched = leagues[id] !== C;
  for (let k = -3; k <= 2; k++) {
    const day = addDays(TODAY, k);
    const j = await fetchJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${day.replace(/-/g, "")}`);
    for (const e of j?.events || []) for (const c of e.competitions?.[0]?.competitors || []) {
      const raw = c.team?.displayName || c.team?.name; if (!raw) continue;
      if (C.teams.some(t => t === raw || same(t, raw))) continue;
      let nm = null, home = null;
      for (const d of doms) { const t = (leagues[d]?.teams || []).find(x => same(x, raw)); if (t) { nm = t; home = d; break; } }
      nm = nm || raw;
      if (C.teams.includes(nm)) continue;
      C.teams.push(nm); touched = true;
      if (home) {
        // forza di partenza dal campionato: gol fatti e subiti rispetto alla media
        const P = leagues[home].played.filter(r => r.slice(0, 4) >= String(+TODAY.slice(0, 4) - 1)).map(r => r.split("|"));
        const avg = P.reduce((a, q) => a + +q[3] + +q[4], 0) / Math.max(P.length * 2, 1) || 1.35;
        const mine = P.filter(q => q[1] === nm || q[2] === nm);
        const gf = mine.reduce((a, q) => a + +(q[1] === nm ? q[3] : q[4]), 0), ga = mine.reduce((a, q) => a + +(q[1] === nm ? q[4] : q[3]), 0);
        C.dom[nm] = [home.replace("_", "."), nm];
        C.prior[nm] = mine.length >= 4 ? tierPrior(home, gf / mine.length / avg, ga / mine.length / avg) : tierPrior(home, 1, 1);
      } else C.prior[nm] = "C";
    }
  }
  // forza di partenza v2: chi è in prima divisione parte nettamente favorito contro le squadre di categoria inferiore
  if (C.pv !== 2) {
    for (const [t, p] of Object.entries(C.prior)) if (Array.isArray(p) && C.dom[t]) C.prior[t] = tierPrior(C.dom[t][0].replace(".", "_"), p[0], p[1]);
    for (const t of Object.keys(C.dom)) if (!(t in C.prior)) C.prior[t] = tierPrior(C.dom[t][0].replace(".", "_"), 1, 1);
    C.pv = 2; touched = true;
  }
  if (touched) { C.teams.sort(); leagues[id] = C; changed.leagues = true; }
}

// ---------- 1. risultati e calendario da ESPN ----------
for (const [id, lg] of Object.entries(ESPN_LG)) {
  const L = leagues[id]; if (!L || !L.teams?.length) continue;
  for (let k = -3; k <= 2; k++) {
    const day = addDays(TODAY, k);
    const j = await fetchJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${day.replace(/-/g, "")}`);
    for (const e of j?.events || []) {
      const c = e.competitions?.[0]?.competitors || [], H = c.find(x => x.homeAway === "home"), A = c.find(x => x.homeAway === "away");
      if (!H || !A) continue;
      const h = teamOf(L, H.team?.displayName) || teamOf(L, H.team?.shortDisplayName), a = teamOf(L, A.team?.displayName) || teamOf(L, A.team?.shortDisplayName);
      if (!h || !a || h === a) continue;
      const st = e.status?.type || {}, when = rome(e.date);
      if (/postpon|cancel|abandon|suspend/i.test(st.name || "")) continue;
      const fi = L.fixtures.findIndex(f => { const q = f.split("|"); return q[2] === h && q[3] === a && Math.abs(dayDiff(q[0], when.d)) <= 4; });
      if (st.completed) {
        const done = L.played.some(p => { const q = p.split("|"); return q[1] === h && q[2] === a && Math.abs(dayDiff(q[0], when.d)) <= 4; });
        if (done) { if (fi >= 0) { L.fixtures.splice(fi, 1); changed.leagues = true; } continue; }
        const rd = fi >= 0 ? (L.fixtures[fi].split("|")[4] || "") : "";
        if (fi >= 0) L.fixtures.splice(fi, 1);
        L.played.push([when.d, h, a, +H.score || 0, +A.score || 0, rd].join("|")); L.played.sort(); changed.leagues = true;
      } else if (st.state === "pre" || st.state === "in") {
        if (fi >= 0) {
          const q = L.fixtures[fi].split("|");
          if (q[0] !== when.d || q[1] !== when.t) { q[0] = when.d; q[1] = when.t; L.fixtures[fi] = q.join("|"); changed.leagues = true; }
        } else if (!L.played.some(p => { const q = p.split("|"); return q[1] === h && q[2] === a && Math.abs(dayDiff(q[0], when.d)) <= 4; })) {
          L.fixtures.push([when.d, when.t, h, a, ""].join("|")); changed.leagues = true;
        }
      }
    }
  }
  L.fixtures.sort(); if (changed.leagues) L.updated = NOW.toISOString().slice(0, 16) + "Z";
}
log("risultati aggiornati:", changed.leagues);

// ---------- 2. quote Planetwin365 da OddsPapi (una richiesta al giorno) ----------
const BK = "planetwin365.it", DC = {};
const NAMES_F = "tools/op-nomi.json"; let names = {}; try { names = JSON.parse(fs.readFileSync(NAMES_F, "utf8")); } catch {}
let opFix = [];
// se le schedine di oggi ci sono già (esecuzione di riserva), non spreco richieste di quote
const ready = !!sch.byDay[TODAY] && !FORCE;
if (ready) log("schedine di oggi già pronte: aggiorno solo risultati e Lotto");
if (OP_KEY && !ready) {
  // solo i campionati che giocano oggi o domani, al massimo 5 per richiesta (limite di OddsPapi)
  const ids = Object.entries(OP_T).filter(([id]) => leagues[id]?.fixtures?.some(f => f.slice(0, 10) === TODAY || f.slice(0, 10) === addDays(TODAY, 1))).map(([, t]) => t);
  for (let i = 0; i < ids.length; i += 5) {
    // OddsPapi limita le richieste ravvicinate: una pausa tra una e l'altra, e un secondo tentativo se risponde 429
    if (i) await new Promise(r => setTimeout(r, 2500));
    let j = await fetchJ(`https://api.oddspapi.io/v4/odds-by-tournaments?bookmaker=${BK}&tournamentIds=${ids.slice(i, i + 5).join(",")}&apiKey=${OP_KEY}`, 1);
    if (!Array.isArray(j)) { await new Promise(r => setTimeout(r, 8000)); j = await fetchJ(`https://api.oddspapi.io/v4/odds-by-tournaments?bookmaker=${BK}&tournamentIds=${ids.slice(i, i + 5).join(",")}&apiKey=${OP_KEY}`, 1); }
    if (Array.isArray(j)) opFix.push(...j);
  }
  log("campionati con quote richieste:", ids.length);
  const miss = [...new Set(opFix.flatMap(f => [f.participant1Id, f.participant2Id]).filter(x => !(x in names)))];
  if (miss.length) {
    await new Promise(r => setTimeout(r, 2500));
    const p = await fetchJ(`https://api.oddspapi.io/v4/participants?sportId=10&apiKey=${OP_KEY}`, 1);
    if (p) { for (const x of miss) if (p[x]) names[x] = p[x]; fs.writeFileSync(NAMES_F, JSON.stringify(names)); }
  }
}
const T2ID = Object.fromEntries(Object.entries(OP_T).map(([k, v]) => [v, k]));
let nOdds = 0;
for (const f of opFix) {
  const id = T2ID[f.tournamentId], L = leagues[id]; if (!L) continue;
  const mk = f.bookmakerOdds?.[BK]?.markets; if (!mk) continue;
  const pr = (m, o) => { const v = mk[m]?.outcomes?.[o]?.players?.["0"]?.price; return v > 1 ? Math.round(v * 100) / 100 : null; };
  const when = rome(f.startTime);
  let h = teamOf(L, names[f.participant1Id]), a = teamOf(L, names[f.participant2Id]);
  if (L.cup && (!h || !a)) {
    // coppe: i nomi delle squadre minori cambiano da un sito all'altro. Se il calendario ha una sola partita
    // quel giorno con la squadra riconosciuta (o con nomi abbastanza simili), prendo l'avversaria dal calendario
    const day = L.fixtures.map(x => x.split("|")).filter(q => Math.abs(dayDiff(q[0], when.d)) <= 1);
    const loose = (t, n) => n && Math.min(eSim(t, n), 1) + Math.min(eSim(n, t), 1) >= 1;
    const m = day.filter(q => (h ? q[2] === h : loose(q[2], names[f.participant1Id])) && (a ? q[3] === a : loose(q[3], names[f.participant2Id])));
    const m1 = m.length ? m : day.filter(q => (h && q[2] === h) || (a && q[3] === a));
    if (m1.length === 1) { h = m1[0][2]; a = m1[0][3]; }
  }
  if (!h || !a) continue;
  const o = [pr("101", "101"), pr("101", "102"), pr("101", "103")]; if (o.some(x => !x)) continue;
  const row = [when.d, h, a, ...o, pr("1010", "1010") || "-", pr("1010", "1011") || "-", pr("104", "104") || "-", pr("104", "105") || "-"].join("|");
  const O = odds[id] || (odds[id] = { code: ESPN_LG[id] || id, rows: [] });
  O.rows = O.rows.filter(r => { const q = r.split("|"); return !(q[1] === h && q[2] === a) && q[0] >= addDays(TODAY, -10); });
  O.rows.push(row); O.rows.sort(); O.updated = NOW.toISOString().slice(0, 16) + "Z"; O.source = "Planetwin365 (OddsPapi)";
  DC[id + "|" + h + "|" + a] = { "1X": pr("101902", "101902"), "12": pr("101902", "101903"), "X2": pr("101902", "101904") };
  // la data della partita dalle quote, se il calendario non l'ha
  if (!L.fixtures.some(x => { const q = x.split("|"); return q[2] === h && q[3] === a; }) && !L.played.some(x => { const q = x.split("|"); return q[1] === h && q[2] === a && Math.abs(dayDiff(q[0], when.d)) <= 4; }) && when.d >= TODAY) { L.fixtures.push([when.d, when.t, h, a, ""].join("|")); L.fixtures.sort(); changed.leagues = true; }
  nOdds++; changed.odds = true;
}
log("quote lette:", nOdds);

// ---------- 3. schedine ----------
const STAKE = 20, MINQ = 2.8;
const hit = (k, h, a) => ({ "1": h > a, "X": h === a, "2": h < a, "1X": h >= a, "X2": h <= a, "12": h !== a, "Over 2,5": h + a > 2, "Under 2,5": h + a < 3, "Goal": h > 0 && a > 0, "NoGoal": h === 0 || a === 0 })[k];
const resultOf = l => { const L = leagues[l.id]; const p = L?.played.find(x => { const q = x.split("|"); return q[1] === l.h && q[2] === l.a && Math.abs(dayDiff(q[0], l.d)) <= 4; }); if (!p) return null; const q = p.split("|"); return { hg: +q[3], ag: +q[4] }; };
const ticketState = tk => { const r = tk.map(resultOf); if (tk.some((l, i) => r[i] && !hit(l.k, r[i].hg, r[i].ag))) return "lost"; return r.every(Boolean) ? "won" : "open"; };

function stats(id) {
  const L = leagues[id], y = +TODAY.slice(0, 4), m = +TODAY.slice(5, 7);
  const from = (id === "se_1" || id === "no_1") ? `${y}-03-01` : `${m >= 7 ? y : y - 1}-07-01`;
  const T = {};
  const g = t => T[t] || (T[t] = { p: 0, n: 0, gf: 0, ga: 0, hp: 0, hn: 0, ap: 0, an: 0, o: 0, gg: 0 });
  for (const r of L.played) {
    const q = r.split("|"); if (q[0] < from) continue;
    const hg = +q[3], ag = +q[4], ph = hg > ag ? 3 : hg === ag ? 1 : 0, pa = ag > hg ? 3 : hg === ag ? 1 : 0;
    const H = g(q[1]), A = g(q[2]);
    H.p += ph; H.n++; H.gf += hg; H.ga += ag; H.hp += ph; H.hn++; A.p += pa; A.n++; A.gf += ag; A.ga += hg; A.ap += pa; A.an++;
    for (const X of [H, A]) { X.o += hg + ag > 2; X.gg += hg > 0 && ag > 0; }
  }
  const tab = Object.keys(T).sort((a, b) => T[b].p - T[a].p || (T[b].gf - T[b].ga) - (T[a].gf - T[a].ga));
  tab.forEach((t, i) => T[t].pos = i + 1);
  return { T, n: Math.max(tab.length, (L.teams || []).length) };
}
function candidates(relaxed = false) {
  const out = [];
  for (const [id, L] of Object.entries(leagues)) {
    const O = odds[id]; if (!O) continue;
    const st = stats(id);
    for (const f of L.fixtures) {
      const [d, t, h, a] = f.split("|"); if (d !== TODAY || !t || t <= addMin(NOWT, 30)) continue;
      const row = O.rows.find(r => { const q = r.split("|"); return q[0] === d && q[1] === h && q[2] === a; }); if (!row) continue;
      const q = row.split("|").slice(3).map(Number), [o1, oX, o2, ov, un, gg] = q;
      if (NAT_CUPS[id]) {
        // coppa nazionale: solo doppia chance della squadra di prima divisione contro una di categoria inferiore,
        // quota da 1,10 in su e niente coppe europee entro 3 giorni (turnover)
        const topH = !!L.dom?.[h]?.[0]?.endsWith(".1"), topA = !!L.dom?.[a]?.[0]?.endsWith(".1");
        const lowH = !L.dom?.[h] || /\.2$/.test(L.dom[h][0]), lowA = !L.dom?.[a] || /\.2$/.test(L.dom[a][0]);
        const s3 = 1 / o1 + 1 / oX + 1 / o2, q1 = 1 / o1 / s3, qX = 1 / oX / s3, q2 = 1 / o2 / s3;
        const dcN = DC[id + "|" + h + "|" + a] || {};
        const euro = t => ["cl", "el", "ecl"].some(c => leagues[c]?.fixtures?.some(f => { const z = f.split("|"); return (z[2] === t || z[3] === t) && Math.abs(dayDiff(z[0], d)) <= 3; }));
        const push = (k, odd, prob) => odd && odd >= 1.1 && out.push({ id, d, t, h, a, k, odd, prob: Math.round(prob * 1000) / 1000, why: "coppa", key: id + "|" + h + "|" + a, secca: false });
        if (topH && lowA && !euro(h)) push("1X", dcN["1X"], q1 + qX);
        if (topA && lowH && !euro(a)) push("X2", dcN["X2"], q2 + qX);
        continue;
      }
      const H = st.T[h], A = st.T[a]; if (!H || !A || H.n < 4 || A.n < 4) continue;
      const s = 1 / o1 + 1 / oX + 1 / o2, p1 = 1 / o1 / s, pX = 1 / oX / s, p2 = 1 / o2 / s, half = st.n / 2;
      const dc = DC[id + "|" + h + "|" + a] || {};
      const hppg = H.hp / Math.max(H.hn, 1), appg = A.ap / Math.max(A.an, 1);
      const nordic = id === "se_1" || id === "no_1", late = nordic && (+TODAY.slice(5, 7) >= 9);
      const leg = (k, odd, prob, why) => odd && odd > 1.01 && out.push({ id, d, t, h, a, k, odd, prob: Math.round(prob * 1000) / 1000, why, key: id + "|" + h + "|" + a, secca: k === "1" || k === "2" });
      const favH = p1 >= p2, fav = favH ? H : A, opp = favH ? A : H;
      // a fine stagione nei campionati nordici niente giocate contro chi lotta per non retrocedere
      if (late && opp.pos > st.n - 3) continue;
      // doppia chance sulla favorita meglio piazzata
      if (fav.pos < opp.pos && (fav.pos <= half || opp.pos - fav.pos >= st.n / 4)) leg(favH ? "1X" : "X2", favH ? dc["1X"] : dc["X2"], favH ? p1 + pX : p2 + pX, "doppia chance");
      // vittoria secca solo per favorita in alto, forte in casa/fuori, contro avversaria debole
      if (favH && o1 <= 1.8 && H.pos <= half && hppg >= 2 && appg <= 1.3) leg("1", o1, p1, "secca casa");
      else if (relaxed && favH && p1 >= 0.5 && o1 <= 2.2 && H.pos < A.pos) leg("1", o1, p1, "secca casa");
      if (!favH && o2 <= 1.8 && A.pos <= half && appg >= 2 && hppg <= 1.3) leg("2", o2, p2, "secca fuori");
      else if (relaxed && !favH && p2 >= 0.5 && o2 <= 2.2 && A.pos < H.pos) leg("2", o2, p2, "secca fuori");
      // gol: solo se lo dicono entrambe le squadre
      const rq = relaxed ? 0.5 : 0.6;
      if (ov && ov <= (relaxed ? 2 : 1.8) && H.o / H.n >= rq && A.o / A.n >= rq) leg("Over 2,5", ov, 1 / ov / (1 / ov + 1 / un), "over");
      if (un && un <= 1.85 && H.o / H.n <= 0.35 && A.o / A.n <= 0.35 && Math.min(o1, o2) > 1.6) leg("Under 2,5", un, 1 / un / (1 / ov + 1 / un), "under");
      if (gg && gg <= (relaxed ? 2 : 1.85) && H.gg / H.n >= rq && A.gg / A.n >= rq) leg("Goal", gg, 1 / gg / (1 / gg + 1 / q[6]), "goal");
    }
  }
  return out.filter(c => c.prob >= (relaxed ? 0.45 : 0.55)).sort((x, y) => y.prob - x.prob);
}
function addMin(t, m) { const [h, mm] = t.split(":").map(Number); const x = h * 60 + mm + m; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); }
// la combinazione con la probabilità di vincita più alta che arriva alla quota minima (al massimo 7 partite)
function best(cands, { avoid = new Set(), differ = [], usedSecca = new Set(), minQ = MINQ, maxLegs = 7 }) {
  const pool = cands.filter(c => !avoid.has(c.key) && !(c.secca && c.odd > 1.3 && usedSecca.has(c.key))).slice(0, 22);
  const need = Math.log(minQ); let bestSet = null, bestP = -Infinity;
  const lo = pool.map(c => Math.log(c.odd)), lp = pool.map(c => Math.log(c.prob));
  const pick = [], keys = new Set();
  (function dfs(i, sq, sp) {
    if (sp <= bestP) return;
    if (sq >= need - 1e-9) {
      const ok = differ.every(D => pick.filter(j => !D.has(pool[j].key + pool[j].k)).length >= 2);
      if (ok) { bestP = sp; bestSet = pick.slice(); }
      return;
    }
    if (pick.length >= maxLegs || i >= pool.length) return;
    for (let j = i; j < pool.length; j++) {
      if (keys.has(pool[j].key)) continue;
      pick.push(j); keys.add(pool[j].key);
      dfs(j + 1, sq + lo[j], sp + lp[j]);
      pick.pop(); keys.delete(pool[j].key);
    }
  })(0, 0, 0);
  return bestSet ? bestSet.map(j => pool[j]) : null;
}
const legOut = c => ({ id: c.id, d: c.d, t: c.t, h: c.h, a: c.a, k: c.k, odd: c.odd, prob: c.prob, model: c.prob, mkt: c.prob, est: false });

if (!sch.byDay[TODAY] || FORCE) {
  const cands = candidates(); log("giocate possibili oggi:", cands.length);
  const tickets = [], usedSecca = new Set(), count = {};
  const inAll = () => new Set(Object.keys(count).filter(k => count[k] >= 2));
  const add = t => { if (!t) return; tickets.push(t); t.forEach(c => { count[c.key] = (count[c.key] || 0) + 1; if (c.secca && c.odd > 1.3) usedSecca.add(c.key); }); };
  const legSet = t => new Set(t.map(c => c.key + c.k));
  const t1 = best(cands, { usedSecca }); add(t1);
  const t2 = t1 && best(cands, { usedSecca, differ: [legSet(t1)] }); add(t2);
  const t3 = t2 && best(cands, { usedSecca, avoid: inAll(), differ: [legSet(t1), legSet(t2)] }); add(t3);
  // niente doppioni
  const sig = t => t.map(c => c.key + c.k).sort().join(";");
  const uniq = tickets.filter((t, i) => tickets.findIndex(x => sig(x) === sig(t)) === i);
  if (uniq.length) { sch.byDay[TODAY] = { stake: STAKE, tickets: uniq.map(t => t.map(legOut)), auto: true }; changed.live = true; }
  else if (cands.length >= 2) {
    // giornata scarsa: una sola schedina con la vincita più alta possibile usando le giocate sicure (una per partita)
    const byMatch = {};
    for (const c of cands) if (!byMatch[c.key] || c.odd > byMatch[c.key].odd) byMatch[c.key] = c;
    const legs = Object.values(byMatch).sort((x, y) => y.prob - x.prob).slice(0, 8);
    sch.byDay[TODAY] = { stake: STAKE, tickets: [legs.map(legOut)], auto: true, low: true }; changed.live = true;
    uniq.push(legs);
    log("giornata scarsa: una schedina a quota", legs.reduce((a, c) => a * c.odd, 1).toFixed(2));
  }
  log("schedine di oggi:", uniq.map(t => t.reduce((a, c) => a * c.odd, 1).toFixed(2)).join(" · ") || "nessuna");
  // recupero: solo se ieri sono andate perse tutte le schedine
  const Y = sch.byDay[addDays(TODAY, -1)];
  if (Y?.tickets?.length && !Y.recovery && Y.tickets.every(t => ticketState(t) === "lost")) {
    const need = Math.max(MINQ, (Y.tickets.length * (Y.stake || STAKE) + STAKE) / STAKE);
    const r = best(cands, { usedSecca, minQ: need });
    if (r) { Y.recovery = { lost: Y.tickets.length * (Y.stake || STAKE), stake: STAKE, need, full: need, legs: r.map(legOut) }; changed.live = true; log("recupero quota", r.reduce((a, c) => a * c.odd, 1).toFixed(2)); }
  }
}
sch.updated = NOW.toISOString().slice(0, 16) + "Z";

// ---------- 4. extra: sistema con 1 errore permesso (da 3 a 6 partite, combinazioni con una in meno) ----------
const sis = live.sistemi || (live.sistemi = { byDay: {} });
if (!sis.byDay[TODAY] || FORCE) {
  // per ogni partita la giocata con la quota più alta tra quelle ammesse (regole più larghe), poi le 6 più probabili
  const byM = {};
  for (const c of candidates(true)) if (c.odd >= 1.2 && (!byM[c.key] || c.odd > byM[c.key].odd)) byM[c.key] = c;
  const legs = Object.values(byM).sort((x, y) => y.prob - x.prob).slice(0, 6);
  if (legs.length >= 3) {
    sis.byDay[TODAY] = { per: 2, legs: legs.map(legOut) };
    for (const d of Object.keys(sis.byDay)) if (d < addDays(TODAY, -14)) delete sis.byDay[d];
    changed.live = true; log("sistema", legs.length - 1 + "/" + legs.length, "quota piena", legs.reduce((a, c) => a * c.odd, 1).toFixed(2));
  } else log("sistema: partite insufficienti");
}

if (changed.leagues) await seal("leagues", leagues);
if (changed.odds) await seal("odds", odds);
if (changed.live) await seal("live", live);
if (changed.lotto) await seal("lotto", lotto);
log("salvato:", JSON.stringify(changed));
