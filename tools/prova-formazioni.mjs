// prova: formazioni ESPN di una partita già giocata e confronto con i migliori marcatori (uso: LG=uefa.champions DAY=20261125 TEAM=Lille)
const lg = process.env.LG, day = process.env.DAY, team = process.env.TEAM;
const sb = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${day}`)).json();
const ev = (sb.events || []).find(e => (e.name || "").toLowerCase().includes(team.toLowerCase()));
if (!ev) { console.log("evento non trovato"); process.exit(); }
const sm = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/summary?event=${ev.id}`)).json();
console.log(ev.name, "rosters:", (sm.rosters || []).length);
for (const r of sm.rosters || []) console.log(r.homeAway, r.team?.displayName, "titolari:", (r.roster || []).filter(p => p.starter).map(p => p.athlete?.displayName).join(", "));
