// uso: CODE_FILE=<file col codice> FONTS_CSS=<css coi caratteri in base64> node tools/prova-grafica.cjs [data ISO] — da lanciare prima di pubblicare modifiche grafiche
// prova grafica: apre il sito come su iPhone (375 e 390 px) con i caratteri veri e cerca cose che escono dai riquadri
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const R=process.cwd(), code=fs.readFileSync(process.env.CODE_FILE,'utf8').trim();
const FONTS=fs.readFileSync(process.env.FONTS_CSS,'utf8');
const when=process.argv[2]||new Date().toISOString(), shot=process.argv[3];
(async()=>{const b=await chromium.launch(); let bad=0;
for (const W of [340,375,390,430]) for (const tab of ['Schedine','Extra']) {
 const p=await (await b.newContext({viewport:{width:W,height:900},deviceScaleFactor:1})).newPage();
 await p.clock.install({time:new Date(when)});
 await p.route('**/*',async r=>{const u=new URL(r.request().url());
  if(u.hostname==='fonts.googleapis.com')return r.fulfill({body:FONTS,contentType:'text/css'});
  if(u.hostname==='angar72.github.io'){let f=path.join(R,decodeURIComponent(u.pathname.replace(/^\/pronostici\/?/,''))||'index.html');if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(fs.existsSync(f))return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.html')?'text/html':undefined});return r.fulfill({status:404,body:''});}
  if(u.hostname.includes('espn')&&u.pathname.includes('eng.1'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:[{date:when,status:{clock:900,period:1,type:{state:'in',name:'STATUS_IN_PROGRESS',completed:false}},competitions:[{competitors:[{homeAway:'home',score:'0',team:{id:'1',displayName:'Hull City'}},{homeAway:'away',score:'1',team:{id:'2',displayName:'Brighton & Hove Albion'}}],details:[]}]}]})});
  if(u.hostname.includes('espn')||u.hostname.includes('github')||u.hostname.includes('gstatic'))return r.fulfill({status:200,body:'{}',contentType:'application/json'});return r.continue();});
 await p.addInitScript(c=>{localStorage.setItem('pr.code',JSON.stringify(c))},code);
 await p.goto('https://angar72.github.io/pronostici/');await p.waitForTimeout(4000);
 await p.click(`text="${tab}"`).catch(()=>{}); await p.waitForTimeout(1500);
 const days=await p.$$eval('[data-xday],[data-day]',els=>els.map(e=>e.getAttribute('data-xday')?'[data-xday="'+e.getAttribute('data-xday')+'"]':'[data-day="'+e.getAttribute('data-day')+'"]'));
 for (const d of [null,...days]) {
  if(d){await p.click(d).catch(()=>{});await p.waitForTimeout(600);}
  const res=await p.evaluate(()=>{const out=[];const vw=document.documentElement.clientWidth;
   if(document.documentElement.scrollWidth>vw+1) out.push('pagina più larga dello schermo: '+document.documentElement.scrollWidth);
   document.querySelectorAll('.slip').forEach(s=>{const S=s.getBoundingClientRect();
    s.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(!r.width) return;
     const par=e.closest('.money-box,.lp,.sc')||s; const P=par.getBoundingClientRect();
     if(r.right>P.right+1.5||r.left<P.left-1.5){const t=(e.innerText||'').trim().slice(0,40); if(t) out.push(`fuori ${par.className.split(' ')[0]}: "${t}" (${Math.round(r.right-P.right)}px)`);}
     if(e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='visible'&&e.clientWidth) out.push('tagliato: '+(e.innerText||'').slice(0,40));});});
   return [...new Set(out)];});
  if(res.length){bad+=res.length;console.log(`[${W}px ${tab} ${d||'iniziale'}]`,res.slice(0,8).join(' | '));}
 }
 if(shot&&W===390&&tab===shot) await p.screenshot({path:'prova-grafica.png',fullPage:true});
 await p.close();
}
console.log(bad?`PROBLEMI: ${bad}`:'OK: niente fuori dai riquadri');await b.close();})();
