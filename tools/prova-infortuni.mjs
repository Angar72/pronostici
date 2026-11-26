// prova: dove ESPN pubblica gli infortunati di una squadra (Bayern = 132)
const urls = [
  "https://sports.core.api.espn.com/v2/sports/soccer/leagues/ger.1/teams/132/injuries",
  "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/teams/132/injuries",
  "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/teams/132?enable=injuries",
  "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/teams/132/roster",
];
for (const u of urls) {
  try { const r = await fetch(u); const t = await r.text(); console.log("==", r.status, u, "\n", t.slice(0, 700).replace(/\s+/g, " "));
    if (u.endsWith("roster")) { const j = JSON.parse(t); for (const a of j.athletes || []) if (a.injuries?.length || (a.status && a.status.type !== "active")) console.log("  ", a.displayName, JSON.stringify(a.injuries || a.status).slice(0, 200)); }
  } catch (e) { console.log("errore", u, e.message); }
}
