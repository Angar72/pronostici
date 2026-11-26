// prova: da dove ricavare i minuti giocati (ESPN summary)
const sm = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915377")).json();
const R = sm.rosters?.[1]; console.log(R?.team?.displayName);
for (const p of (R?.roster || []).slice(0, 25)) console.log(JSON.stringify({ n: p.athlete?.displayName, st: p.starter, si: p.subbedIn, so: p.subbedOut, stats: (p.stats || []).map(s => s.name + "=" + s.value).join(",") }).slice(0, 400));
const ke = (sm.keyEvents || []).filter(e => /sub/i.test(e.type?.text || ""));
console.log("keyEvents sub:", ke.length, JSON.stringify(ke[0] || {}).slice(0, 600));
