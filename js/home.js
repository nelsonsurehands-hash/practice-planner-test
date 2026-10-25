/* Home tab: the first thing a coach sees. The season record, what's happening today,
   the next game, the coming week, and big buttons for the things used most at the gym. */
(function(){
const T=()=>window.TM||{};
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOWL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const ampm=t=>{if(!t)return "";const [h,m]=t.split(":").map(Number);return `${((h+11)%12)+1}:${String(m).padStart(2,"0")} ${h<12?"AM":"PM"}`;};
const span=(a,b)=>{const A=ampm(a),B=ampm(b);return A.slice(-2)===B.slice(-2)?`${A.slice(0,-3)} – ${B}`:`${A} – ${B}`;};
const fullDay=iso=>{const d=SchedCore.dObj(iso);return `${DOWL[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;};
const shortDay=iso=>{const d=SchedCore.dObj(iso);return `${DOWL[d.getDay()].slice(0,3)} ${MON[d.getMonth()]} ${d.getDate()}`;};
const daysUntil=iso=>Math.round((SchedCore.dObj(iso)-SchedCore.dObj(todayISO()))/864e5);
const whenWord=iso=>{const n=daysUntil(iso);return n===0?"Today":n===1?"Tomorrow":n<7?DOWL[SchedCore.dObj(iso).getDay()]:shortDay(iso);};

/* Final scores: from each game's gameplan (the live tracker saves its final score there too). */
function results(){
  const plans=T().plans||{},out=[];
  (SETTINGS.games||[]).forEach(g=>{const r=(plans[g.date]||{}).result||{};
    if(g.date&&r.us!==""&&r.us!=null&&r.them!==""&&r.them!=null){const u=+r.us,t=+r.them;out.push({...g,us:u,them:t,wl:u>t?"W":u<t?"L":"T"});}});
  return out.sort((a,b)=>a.date<b.date?-1:1);
}
function liveGame(){const G=window.StatsGames||{};return Object.values(G).find(g=>g&&!g.final&&(g.events||[]).length)||null;}

function recordCard(){
  const rs=results(),w=rs.filter(r=>r.wl==="W").length,l=rs.filter(r=>r.wl==="L").length,t=rs.filter(r=>r.wl==="T").length;
  const split=home=>{const x=rs.filter(r=>(r.home!==false)===home);return `${x.filter(r=>r.wl==="W").length}–${x.filter(r=>r.wl==="L").length}`;};
  let streak="";if(rs.length){const last=rs[rs.length-1].wl;let n=0;for(let i=rs.length-1;i>=0&&rs[i].wl===last;i--)n++;streak=`${last}${n}`;}
  const last=rs[rs.length-1];
  const played=(SETTINGS.games||[]).filter(g=>g.date&&g.date<todayISO()).length,missing=Math.max(0,played-rs.length);
  return `<div class="hm-card hm-record"><small class="hm-k">Season record</small>
    <b class="hm-big">${w}–${l}${t?`–${t}`:""}</b>
    ${rs.length?`<div class="hm-split"><span>Home ${split(true)}</span><span>Away ${split(false)}</span>${streak?`<span>Streak ${streak}</span>`:""}</div>
      <p class="hm-last"><span class="hm-wl ${last.wl}">${last.wl}</span> ${last.us}–${last.them} ${last.home===false?"at":"vs"} ${esc(last.opponent||"")} <small>${shortDay(last.date)}</small></p>`:
      `<p class="hm-help">Scores show up here after a game: from the live tracker, or typed into the game's Gameplan.</p>`}
    ${missing?`<button type="button" class="linkbtn hm-miss" data-hm="scores">${missing} played game${missing===1?" has":"s have"} no score yet</button>`:""}</div>`;
}
function nextGameCard(){
  const t=todayISO(),lv=liveGame();
  if(lv){const g=(SETTINGS.games||[]).find(x=>x.date===lv.date)||{};
    return `<div class="hm-card hm-next live"><small class="hm-k"><span class="st-dot"></span> Game in progress</small><b class="hm-opp">${g.home===false?"at":"vs"} ${esc(g.opponent||"Game")}</b>
      <div class="actions" style="margin:8px 0 0"><button class="btn primary" type="button" data-hm="live">Back to the live tracker</button></div></div>`;}
  const g=(SETTINGS.games||[]).filter(x=>x.date>=t).sort((a,b)=>a.date<b.date?-1:1)[0];
  if(!g)return `<div class="hm-card hm-next"><small class="hm-k">Next game</small><p class="hm-help">No games coming up. Add games in the Calendar tab.</p></div>`;
  const n=daysUntil(g.date),bus=(SETTINGS.special||[]).find(x=>x.date===g.date&&/^bus\b/i.test(x.note||""));
  return `<div class="hm-card hm-next"><small class="hm-k">Next game · ${n===0?"Today":n===1?"Tomorrow":`in ${n} days`}</small>
    <b class="hm-opp">${g.home===false?"at":"vs"} ${esc(g.opponent||"Game")}</b>
    <p class="hm-meta">${[fullDay(g.date),g.time?ampm(g.time):"Time TBD",g.home===false?"Away":"Home"].filter(Boolean).join(" · ")}${bus?`<br>${esc(bus.note)}`:""}</p>
    <div class="hm-mini">${typeof hasFeature!=="function"||hasFeature("game")?`<button type="button" class="btn" data-hm="gameplan" data-date="${g.date}">Gameplan</button>`:""}${g.home===false&&(typeof hasFeature!=="function"||hasFeature("bus"))?`<button type="button" class="btn" data-hm="bus" data-date="${g.date}">Bus list</button>`:""}</div></div>`;
}
function planLine(iso){
  const p=(typeof plans!=="undefined"&&plans[iso])||null,n=p&&p.blocks?p.blocks.length:0;
  if(!n)return `<button type="button" class="linkbtn" data-hm="practice" data-date="${iso}">No plan yet: build it</button>`;
  const used=p.blocks.reduce((a,b)=>a+(b.minutes||0),0);
  return `<button type="button" class="linkbtn" data-hm="practice" data-date="${iso}">Plan ready: ${n} drill${n===1?"":"s"}, ${used} min${p.focus?` · ${esc(p.focus)}`:""}</button>`;
}
function dayItems(d,withPlan){
  const out=[];
  if(d.game)out.push(`<li class="g"><span class="hm-pill ${d.game.home?"home":"away"}">${d.game.home?"Home":"Away"}</span><b>${d.game.home?"vs":"at"} ${esc(d.game.opponent||"Game")}</b><small>${d.game.time?ampm(d.game.time):"Time TBD"}</small></li>`);
  if(d.practice)out.push(`<li class="p"><span class="hm-pill prac">${/tryout/i.test(d.practice.notes.join(" "))?"Tryouts":"Practice"}</span><b>${span(d.practice.start,d.practice.end)}</b>${d.practice.notes.filter(n=>!/tryout/i.test(n)).map(n=>`<small>${esc(n)}</small>`).join("")}${withPlan?`<div class="hm-plan">${planLine(d.date)}</div>`:""}</li>`);
  if(d.off)out.push(`<li class="o"><span class="hm-pill off">No practice</span>${d.off.note&&d.off.note!=="No practice"?`<b>${esc(d.off.note)}</b>`:""}</li>`);
  d.notes.forEach(n=>out.push(`<li class="n"><span class="hm-pill note">${/^bus\b/i.test(n)?"Bus":"Note"}</span><b>${esc(n)}</b></li>`));
  return out.join("");
}
function todayCard(days){
  const t=todayISO(),d=days.find(x=>x.date===t);
  const next=days.find(x=>x.date>t&&(x.practice||x.game));
  return `<div class="hm-card hm-today"><small class="hm-k">Today</small><h3 class="hm-date">${fullDay(t)}</h3>
    ${d?`<ul class="hm-list">${dayItems(d,true)}</ul>`:`<p class="hm-help">Nothing on the calendar today.</p>`}
    ${!d||(!d.practice&&!d.game)?next?`<p class="hm-nextup">Next up: <b>${whenWord(next.date)}</b> · ${next.game?`${next.game.home?"vs":"at"} ${esc(next.game.opponent||"Game")} ${ampm(next.game.time)}`:`Practice ${span(next.practice.start,next.practice.end)}`}</p>`:"":""}</div>`;
}
function weekCard(days){
  const t=todayISO(),end=SchedCore.addDays(t,7),list=days.filter(x=>x.date>t&&x.date<=end);
  if(!list.length)return "";
  return `<div class="hm-card"><small class="hm-k">This week</small><div class="hm-week">${list.map(d=>{const dt=SchedCore.dObj(d.date);
    return `<div class="hm-wd${d.game?" game":""}"><div class="hm-wdate"><small>${DOWL[dt.getDay()].slice(0,3)}</small><b>${dt.getDate()}</b></div><ul class="hm-list">${dayItems(d,false)}</ul></div>`;}).join("")}</div>
    <button type="button" class="linkbtn" data-hm="cal">Full calendar ›</button></div>`;
}
function quick(){
  const t=todayISO(),pr=(typeof PRACTICES!=="undefined"?PRACTICES:[]).map(p=>p[0]),pd=pr.includes(t)?t:pr.find(d=>d>t);
  const tile=(k,icon,label,sub,extra="")=>`<button type="button" class="hm-tile" data-hm="${k}"${extra}><span class="hm-ic" aria-hidden="true">${icon}</span><b>${label}</b><small>${sub}</small></button>`;
  const H=k=>typeof hasFeature!=="function"||hasFeature(k);
  const tiles=[H("plans")&&tile("practice","📋",pd===t?"Today's practice":"Next practice",pd?(pd===t?"Open today's plan":whenWord(pd)):"No practices scheduled",pd?` data-date="${pd}"`:""),
    H("stats")&&tile("live","🔴","Live tracker",liveGame()?"Game in progress":"Track a game"),
    H("stats")&&tile("stats","📊","Stats","Season and games"),
    tile("cal","📅","Calendar","Practices and games"),
    !H("stats")&&H("plays")&&tile("plays","🏀","Plays","Your playbook"),
    !H("plans")&&H("drills")&&tile("drills","📚","Drill library","Your drills")].filter(Boolean);
  const more=[H("sched")&&`<button type="button" class="btn" data-hm="sched">🗓 ${H("bus")?"Game &amp; bus schedule":"Game schedule"}</button>`,`<button type="button" class="btn" data-hm="roster">Roster</button>`,
    H("food")&&`<button type="button" class="btn" data-hm="food">Food sign-ups</button>`,H("plink")&&`<button type="button" class="btn" data-hm="parentlink">🔗 Parent calendar link</button>`].filter(Boolean);
  return `<div class="hm-tiles">${tiles.join("")}</div><div class="hm-more">${more.join("")}</div>`;
}
function render(){
  const box=document.getElementById("homeBody");if(!box||document.getElementById("view-home").hidden||typeof SETTINGS==="undefined"||typeof team==="undefined"||!team)return;
  const days=SchedCore.days(SETTINGS);
  document.getElementById("hmEyebrow").textContent=typeof team!=="undefined"&&team?[team.name,(team.settings||{}).teamLabel].filter(Boolean).join(" · "):"";
  const h=new Date().getHours();document.getElementById("hmHello").textContent=h<12?"Good morning":h<17?"Good afternoon":"Good evening";
  box.innerHTML=`<div class="hm-grid"><div class="hm-col">${todayCard(days)}${quick()}</div><div class="hm-col">${nextGameCard()}${recordCard()}${weekCard(days)}</div></div>`;
}
window.onHomeTab=render;
window.renderHome=render;

function openPractice(d){
  setTab("plan");const sel=document.getElementById("planDate");
  if(d&&sel&&[...sel.options].some(o=>o.value===d)&&sel.value!==d){sel.value=d;sel.dispatchEvent(new Event("change",{bubbles:true}));}
  scrollTo(0,0);
}
document.getElementById("view-home").addEventListener("click",e=>{
  const b=e.target.closest("[data-hm]");if(!b)return;const k=b.dataset.hm,d=b.dataset.date;
  if(k==="practice")openPractice(d);
  if(k==="live"){window.goTeam("stats");setTimeout(()=>{const x=document.querySelector("#tm-stats [data-st=golive]");if(x)x.click();},0);}
  if(k==="stats"||k==="scores"){window.goTeam("stats");setTimeout(()=>{const x=document.querySelector(`#tm-stats [data-st=${k==="scores"?"games":"season"}]`);if(x)x.click();},0);}
  if(k==="cal"){setTab("cal");setTimeout(()=>{const x=document.getElementById("calToday");if(x)x.click();},0);}
  if(k==="gameplan")window.goTeam("game",{date:d});
  if(k==="bus")window.goTeam("bus",{date:d});
  if(k==="roster")window.goTeam("roster");
  if(k==="sched")window.goTeam("sched");
  if(k==="plays")setTab("plays");
  if(k==="drills")setTab("lib");
  if(k==="food")window.goTeam("food");
  if(k==="parentlink")window.goTeam("plink");
  if(k!=="practice")scrollTo(0,0);
});
/* Redraw when the schedule, plans or scores change, and at midnight-ish when "today" moves on. */
const prevFeat=window.onFeaturesChange;window.onFeaturesChange=function(){if(prevFeat)prevFeat();render();};
const prevCal=window.onCalChange;window.onCalChange=function(){if(prevCal)prevCal.apply(this,arguments);render();};
if(T().opened)T().opened.push(()=>setTimeout(render,0));
setInterval(render,60*1000);
/* First open (or a slow connection): keep trying until the team has loaded, so Home is never left empty. */
let tries=0;const boot=setInterval(()=>{tries++;if(typeof team!=="undefined"&&team&&typeof SETTINGS!=="undefined"){render();if(document.querySelector("#homeBody .hm-grid")||tries>60)clearInterval(boot);}else if(tries>120)clearInterval(boot);},250);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")render();});
})();
