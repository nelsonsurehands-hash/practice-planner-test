/* Team tab → Stats: a live game tracker for the bench, a recap of every tracked game, and season
   stats for each player. Each game is saved as kind "gamestats" (id = game date) as a list of
   events (shots, rebounds, subs, opponent points…), so totals, minutes and the substitution log are
   always worked out from the same record, and Undo just removes the last event. */
(function(){
const T=()=>window.TM;
const GAMES={};window.StatsGames=GAMES;   // read by js/home.js (a game in progress)
let view="season", openDate=null, playerId=null, live=null, saveTimer=null, tick=null, pick=null, subIn=null;
const can=()=>typeof PERM!=="undefined"&&PERM.plans;
const SPORT=()=>(SETTINGS.sport||"basketball");
const games=()=>(SETTINGS.games||[]).filter(g=>g.date).sort((a,b)=>a.date<b.date?-1:1);
const lineupSize=()=>({basketball:5,volleyball:6,soccer:11,football:11,baseball:9})[SPORT()]||Math.min(sp().players||5,11);
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
const pct=(m,a)=>a?Math.round(100*m/a)+"%":"–";
const avg=(v,n)=>n?(Math.round(10*v/n)/10).toFixed(1):"–";
const pname=p=>p?T().pname(p):"Player";
const short=p=>p?`${p.number?"#"+p.number+" ":""}${String(p.name||"").split(" ")[0]}`:"?";

/* What can be recorded, by sport. pts = points it adds to our score. */
const STATSETS={
  basketball:[["2pm","2 pt made",2],["2px","2 pt miss"],["3pm","3 pt made",3],["3px","3 pt miss"],["ftm","FT made",1],["ftx","FT miss"],
    ["oreb","Off. reb"],["dreb","Def. reb"],["ast","Assist"],["stl","Steal"],["blk","Block"],["to","Turnover"],["pf","Foul"]],
  soccer:[["goal","Goal",1],["ast","Assist"],["shot","Shot on goal"],["save","Save"],["foul","Foul"],["yc","Yellow card"],["rc","Red card"]],
  volleyball:[["kill","Kill",1],["ace","Ace",1],["blk","Block",1],["dig","Dig"],["ast","Assist"],["serr","Serve error"],["aerr","Attack error"]],
  other:[["score","Score",1],["ast","Assist"],["foul","Foul"]]
};
const statset=()=>STATSETS[SPORT()]||STATSETS.other;
const OPP=()=>SPORT()==="basketball"?[1,2,3]:[1];
const PERIOD_NAME=g=>g.periods===2?"Half":g.periods===4?"Q":"P";
const periodLabel=(g,p)=>g.periods===2?(p===1?"1st half":"2nd half"):g.periods===4?`Q${p}`:`Period ${p}`;

/* ---------- data ---------- */
T().opened.push(()=>{
  Object.keys(GAMES).forEach(k=>delete GAMES[k]);live=null;openDate=null;playerId=null;view="season";stopTick();
  window.__stUnsub&&window.__stUnsub();
  window.__stUnsub=store.collection("gamestats").onSnapshot(s=>{
    const next=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));
    if(live&&saveTimer)next[live.date]=live;          // keep this device's unsaved taps
    Object.keys(GAMES).forEach(k=>delete GAMES[k]);Object.assign(GAMES,next);
    if(live&&!saveTimer&&next[live.date])live=next[live.date];
    if(T().pane==="stats"&&!live)T().render();
  },()=>{});
});
function persist(now){
  if(!live)return;GAMES[live.date]=live;
  try{localStorage.setItem("cpp:live:"+team.id+":"+live.date,JSON.stringify(live));}catch{}
  clearTimeout(saveTimer);
  const go=()=>{saveTimer=null;const body={...live,updatedAt:Date.now(),updatedBy:(typeof ME!=="undefined"&&ME.name)||""};T().put("gamestats",body.date,body);};
  if(now)go();else saveTimer=setTimeout(go,900);
}

/* ---------- working out totals from the events ---------- */
const clockNow=g=>g.running&&g.startedAt?Math.min(g.len,g.elapsed+(Date.now()-g.startedAt)/1000):g.elapsed;
const tpos=(g,p,s)=>(p-1)*g.len+s;
function compute(g,asOfNow){
  const set=statset(),ptsOf=Object.fromEntries(set.map(([k,,p])=>[k,p||0]));
  const P={},row=pid=>P[pid]=P[pid]||{pid,min:0,pts:0,s:{},qs:new Set()};
  const on=new Map();(g.lineup||[]).forEach(pid=>{on.set(pid,0);row(pid).qs.add(1);});
  const per={},opp={};let us=0,them=0;const subs=[],plays=[];
  (g.events||[]).forEach(e=>{
    const T0=tpos(g,e.p,e.s);
    if(e.k==="stat"){const r=row(e.pid);r.s[e.stat]=(r.s[e.stat]||0)+1;const v=ptsOf[e.stat]||0;r.pts+=v;us+=v;per[e.p]=(per[e.p]||0)+v;plays.push(e);}
    if(e.k==="opp"){them+=e.pts;opp[e.p]=(opp[e.p]||0)+e.pts;plays.push(e);}
    if(e.k==="sub"){(e.outs||[]).forEach(pid=>{if(on.has(pid)){row(pid).min+=T0-on.get(pid);on.delete(pid);}});(e.ins||[]).forEach(pid=>{on.set(pid,T0);row(pid).qs.add(e.p);});subs.push(e);}
    if(e.k==="period")on.forEach((t,pid)=>row(pid).qs.add(e.from+1));
  });
  const end=tpos(g,g.period,clockNow(g));   // minutes run to where the game is now, or where it ended
  on.forEach((t,pid)=>{row(pid).min+=Math.max(0,end-t);});
  Object.values(P).forEach(r=>{r.q=r.qs.size;});   // quarters (or halves) played: on the floor at any point in them
  return {players:P,us,them,per,opp,subs,plays,onCourt:[...on.keys()],usedClock:(g.events||[]).some(e=>e.s>0)||g.elapsed>0||g.period>1};
}
const teamFouls=(g,p)=>(g.events||[]).filter(e=>e.k==="stat"&&e.p===p&&(e.stat==="pf"||e.stat==="foul")).length;

/* ---------- live tracker ---------- */
/* No game clock: playing time is counted in quarters played, so nothing needs to tick. */
function startTick(){}
function oldTick(){stopTick();tick=setInterval(()=>{if(!live||!live.running)return;
  const left=live.len-clockNow(live);const el=document.getElementById("lvClock");if(el)el.textContent=mmss(left);
  if(left<=0){live.elapsed=live.len;live.running=false;live.startedAt=null;persist(true);renderLive();}
  document.querySelectorAll("[data-min]").forEach(x=>{const c=compute(live,true).players[x.dataset.min];if(c)x.textContent=mmss(c.min);});
},500);}
function stopTick(){clearInterval(tick);tick=null;}
function setupForm(g,saved){
  const R=T().roster,plan=(T().plans||{})[g.date]||{},pre=(plan.starters||[]).filter(Boolean);
  const isBB=SPORT()==="basketball";
  return `<div class="tm-card"><h3 class="tm-h">Track ${g.home===false?"at":"vs"} ${esc(g.opponent||"Game")} <small>${esc(T().longDay(g.date))}</small></h3>
    ${R.length?`<form id="lvSetup" class="lv-setup">
      <div class="bus-grid">
        <label class="f">Game is played in<select name="periods"><option value="4"${isBB?" selected":""}>4 quarters</option><option value="2"${isBB?"":" selected"}>2 halves</option><option value="3">3 periods</option></select></label>
      </div>
      <fieldset class="catpick"><legend>Starters (${lineupSize()})</legend><div class="lv-starters">${R.map(p=>`<label><input type="checkbox" name="st" value="${esc(p.id)}"${pre.includes(p.id)?" checked":""}> ${esc(pname(p))}</label>`).join("")}</div></fieldset>
      ${pre.length?`<p class="help" style="margin:0">Starters are filled in from this game's gameplan.</p>`:""}
      <div class="actions" style="margin:0"><button class="btn primary" type="submit">Start tracking</button><button class="btn" type="button" data-st="back">Back</button></div><div class="msg" id="lvMsg"></div></form>`:
      `<p class="help">Add your players on the <button type="button" class="linkbtn" data-goteam="roster">Roster</button> page first, then come back to track the game.</p>`}</div>`;
}
/* Short labels for the stat bar. */
const SHORT={"2pm":"2 PT ✓","2px":"2 PT ✗","3pm":"3 PT ✓","3px":"3 PT ✗","ftm":"FT ✓","ftx":"FT ✗","oreb":"O REB","dreb":"D REB","ast":"AST","stl":"STL","blk":"BLK","to":"TO","pf":"FOUL"};
const statKind=(k,pts)=>pts?"made":/x$|err|^to$|^pf$|foul|yc|rc/.test(k)?"miss":"";
let armed=null;   // a stat waiting for a player tap
function renderLive(){
  const box=$("#tm-stats"),g=live;if(!g){document.body.classList.remove("live-mode");return;}
  document.body.classList.add("live-mode");if(!renderLive.top){window.scrollTo(0,0);renderLive.top=true;}
  const R=T().roster,by=Object.fromEntries(R.map(p=>[p.id,p])),c=compute(g,true),set=statset();
  const onc=c.onCourt.map(id=>by[id]).filter(Boolean),bench=R.filter(p=>!c.onCourt.includes(p.id));
  const left=g.len-clockNow(g),tf=teamFouls(g,g.period),bb=SPORT()==="basketball";
  const tile=(p,floor)=>{const r=c.players[p.id]||{s:{},pts:0,min:0},pf=r.s.pf||r.s.foul||0;
    return `<div class="lv-t${floor?" floor":""}${pick===p.id?" sel":""}${armed?" armed":""}" data-tile="${esc(p.id)}" data-floor="${floor?1:0}" role="button" tabindex="0" aria-label="${esc(pname(p))}">
      <b>${esc(short(p))}</b><small><span>${r.pts} pts</span>${bb||pf?`<span class="${pf>=4?"warn":""}">${pf} PF</span>`:""}<span class="lv-q">${r.q?(r.q===1?"1 qtr":r.q+" qtrs"):"DNP"}</span></small></div>`;};
  const hint=armed?`Tap a player to give them <b>${esc(SHORT[armed]||(set.find(x=>x[0]===armed)||[])[1]||armed)}</b>. <button type="button" class="linkbtn" data-lv="disarm">Cancel</button>`:
    pick?`Now tap a stat for <b>${esc(short(by[pick]))}</b>. <button type="button" class="linkbtn" data-lv="unpick">Cancel</button>`:
    `Tap a stat, then a player. Drag a bench player onto the floor to sub.`;
  box.innerHTML=`<div class="lv">
    <div class="lv-top">
      <div class="lv-score"><div><small>${esc((team.settings||{}).mascot||team.name)}</small><b>${c.us}</b></div><span>–</span><div><small>${esc(g.opponent||"Them")}</small><b>${c.them}</b></div></div>
      <div class="lv-clock"><b class="lv-per">${periodLabel(g,g.period)}</b>${g.period<g.periods?`<button type="button" class="btn" data-lv="nextper">End ${periodLabel(g,g.period)} ›</button>`:`<span class="lv-last">Last ${g.periods===2?"half":"quarter"}</span>`}</div>
      <div class="lv-opp"><span>${esc(g.opponent||"Opponent")}:</span>${OPP().map(n=>`<button type="button" class="btn" data-opp="${n}">+${n}</button>`).join("")}
        ${bb?`<span class="lv-tf${tf>=7?" warn":""}">Team fouls ${tf}${tf>=10?" · double bonus":tf>=7?" · bonus":""}</span>`:""}</div>
    </div>
    <p class="lv-hint">${hint}</p>
    <div class="lv-zone floor" data-zone="floor"><div class="lv-zh">On the floor <small>${onc.length}/${lineupSize()}</small></div>
      <div class="lv-grid">${onc.map(p=>tile(p,true)).join("")||`<p class="help">Drag players here to put them in.</p>`}</div></div>
    <div class="lv-zone bench" data-zone="bench"><div class="lv-zh">Bench</div>
      <div class="lv-grid">${bench.map(p=>tile(p,false)).join("")||`<p class="help">Everyone's in.</p>`}</div></div>
    <div class="lv-foot">
      <button type="button" class="btn" data-lv="undo"${(g.events||[]).length?"":" disabled"}>↶ Undo</button>
      <button type="button" class="btn" data-lv="recap">Box score</button>
      <button type="button" class="btn ${g.period>=g.periods?"primary":""}" data-lv="final">Final</button>
      <button type="button" class="btn" data-lv="exit">Close</button>
    </div>
    <p class="help lv-note">Saves as you go on this device and to the team. Track each game on one phone at a time.</p>
    <div class="lv-pal" role="group" aria-label="Stats">${set.map(([k,l,pts])=>`<button type="button" class="${statKind(k,pts)}${armed===k?" on":""}" data-arm="${k}" aria-pressed="${armed===k}">${esc(SHORT[k]||l)}</button>`).join("")}</div>
  </div>`;
}
function addEvent(e){
  const g=live;e.id=uid();e.p=g.period;e.s=0;
  (g.events=g.events||[]).push(e);persist();
}
function applyStat(pid,k){
  addEvent({k:"stat",pid,stat:k});armed=null;pick=null;
  const p=T().roster.find(x=>x.id===pid),lab=SHORT[k]||(statset().find(x=>x[0]===k)||[])[1]||k;
  renderLive();flash(`${short(p)} · ${lab}`);
}
/* Drag a player between the floor and the bench to sub. Works with a finger or a mouse. */
let drag=null,noClick=false;
$("#tm-stats").addEventListener("pointerdown",e=>{
  const t=e.target.closest("[data-tile]");if(!t||!live||!can())return;
  drag={id:t.dataset.tile,floor:t.dataset.floor==="1",x:e.clientX,y:e.clientY,el:t,ghost:null,pid:e.pointerId};
});
$("#tm-stats").addEventListener("pointermove",e=>{
  if(!drag||e.pointerId!==drag.pid)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.ghost){if(Math.hypot(dx,dy)<10)return;
    const r=drag.el.getBoundingClientRect(),gh=drag.el.cloneNode(true);gh.classList.add("lv-ghost");gh.style.width=r.width+"px";gh.style.left=r.left+"px";gh.style.top=r.top+"px";
    document.body.appendChild(gh);drag.ghost=gh;drag.ox=e.clientX-r.left;drag.oy=e.clientY-r.top;drag.el.classList.add("dragging");
    try{drag.el.setPointerCapture(e.pointerId);}catch{}}
  drag.ghost.style.left=(e.clientX-drag.ox)+"px";drag.ghost.style.top=(e.clientY-drag.oy)+"px";
  document.querySelectorAll(".lv-drop").forEach(x=>x.classList.remove("lv-drop"));
  drag.ghost.hidden=true;const under=document.elementFromPoint(e.clientX,e.clientY);drag.ghost.hidden=false;
  const tgt=under&&(under.closest("[data-tile]")||under.closest("[data-zone]"));if(tgt&&tgt!==drag.el)tgt.classList.add("lv-drop");
  e.preventDefault();
});
function endDrag(e,cancel){
  if(!drag)return;const d=drag;drag=null;
  document.querySelectorAll(".lv-drop").forEach(x=>x.classList.remove("lv-drop"));
  if(!d.ghost)return;
  d.ghost.remove();d.el.classList.remove("dragging");noClick=true;setTimeout(()=>noClick=false,350);
  if(cancel)return;
  const under=document.elementFromPoint(e.clientX,e.clientY),tile=under&&under.closest("[data-tile]"),zone=under&&under.closest("[data-zone]");
  const c=compute(live,true),full=c.onCourt.length>=lineupSize(),by=Object.fromEntries(T().roster.map(p=>[p.id,p]));
  let ev=null;
  if(!d.floor&&tile&&tile.dataset.floor==="1")ev={k:"sub",ins:[d.id],outs:[tile.dataset.tile]};
  else if(d.floor&&tile&&tile.dataset.floor==="0")ev={k:"sub",ins:[tile.dataset.tile],outs:[d.id]};
  else if(!d.floor&&zone&&zone.dataset.zone==="floor"){if(full){flash(`Floor is full: drop ${short(by[d.id])} on the player coming out`);return;}ev={k:"sub",ins:[d.id],outs:[]};}
  else if(d.floor&&zone&&zone.dataset.zone==="bench")ev={k:"sub",ins:[],outs:[d.id]};
  if(!ev)return;
  addEvent(ev);pick=null;renderLive();
  flash(`${ev.ins.map(i=>short(by[i])).join(", ")||"–"} in${ev.outs.length?" · "+ev.outs.map(i=>short(by[i])).join(", ")+" out":""}`);
}
$("#tm-stats").addEventListener("pointerup",e=>endDrag(e,false));
$("#tm-stats").addEventListener("pointercancel",e=>endDrag(e,true));
$("#tm-stats").addEventListener("click",e=>{
  if(!live)return;const g=live;
  if(noClick&&e.target.closest("[data-tile]"))return;
  const ar=e.target.closest("[data-arm]");
  if(ar&&can()){const k=ar.dataset.arm;if(pick){applyStat(pick,k);return;}armed=armed===k?null:k;renderLive();return;}
  const op=e.target.closest("[data-opp]");if(op&&can()){addEvent({k:"opp",pts:+op.dataset.opp});renderLive();flash(`${g.opponent||"Opponent"} +${op.dataset.opp}`);return;}
  const tl=e.target.closest("[data-tile]");
  if(tl&&can()){const id=tl.dataset.tile;if(armed){applyStat(id,armed);return;}pick=pick===id?null:id;renderLive();return;}
  if(e.target.closest('[data-lv="disarm"]')){armed=null;renderLive();return;}
  if(e.target.closest('[data-lv="unpick"]')){pick=null;renderLive();return;}
  const a=e.target.closest("[data-lv]");if(!a)return;
  const k=a.dataset.lv;
  if(k==="undo"&&can()){const ev=(g.events||[]).pop();if(ev&&ev.k==="period"){g.period=ev.from;g.elapsed=ev.prevElapsed||g.len;}persist();renderLive();flash("Undone");}
  if(k==="nextper"&&can()){(g.events=g.events||[]).push({id:uid(),k:"period",from:g.period,p:g.period,s:0});
    g.period++;g.elapsed=0;g.running=false;g.startedAt=null;persist(true);renderLive();flash(`${periodLabel(g,g.period)} started`);}
  if(k==="final"&&can()){if(a.dataset.armed!=="1"){a.dataset.armed="1";a.textContent="Tap again: game over";return;}
    g.running=false;g.startedAt=null;g.final=true;persist(true);stopTick();const d=g.date;live=null;
    saveResult(d);openDate=d;view="recap";render();}
  if(k==="recap"){const d=g.date;persist(true);stopTick();live=null;openDate=d;view="recap";render();}
  if(k==="exit"){persist(true);stopTick();live=null;view="games";render();}
});
function showSetClock(){
  const g=live,box=document.querySelector(".lv-clock");
  box.insertAdjacentHTML("beforeend",`<form class="lv-set" id="lvSet"><input name="t" value="${mmss(g.len-clockNow(g))}" aria-label="Time left (m:ss)" inputmode="numeric"><button class="btn primary" type="submit">OK</button></form>`);
  $("#lvSet input").select();
}
$("#tm-stats").addEventListener("submit",e=>{
  if(e.target.id==="lvSet"){e.preventDefault();const m=/^(\d{1,2})(?::(\d{1,2}))?$/.exec(e.target.t.value.trim());if(!m||!live)return;
    const left=(+m[1])*60+(+(m[2]||0));live.elapsed=Math.max(0,Math.min(live.len,live.len-left));if(live.running)live.startedAt=Date.now();persist(true);renderLive();return;}
  if(e.target.id==="lvSetup"){e.preventDefault();const f=e.target,st=[...f.querySelectorAll("[name=st]:checked")].map(x=>x.value);
    if(st.length>lineupSize()){msg($("#lvMsg"),`Pick up to ${lineupSize()} starters.`,"err");return;}
    const g=games().find(x=>x.date===openDate);
    live={date:openDate,opponent:g.opponent||"",home:g.home!==false,sport:SPORT(),periods:+f.periods.value,len:480,period:1,elapsed:0,running:false,startedAt:null,lineup:st,events:[],final:false,startedOn:Date.now()};
    persist(true);startTick();renderLive();}
});
function flash(t){const el=document.createElement("div");el.className="lv-flash";el.textContent="✓ "+t;document.body.appendChild(el);setTimeout(()=>el.remove(),900);}
/* The final score goes into the game's gameplan, where it shows on the schedule and scouting report. */
async function saveResult(date){
  const g=GAMES[date];if(!g)return;const c=compute(g);
  const plan=JSON.parse(JSON.stringify((T().plans||{})[date]||{}));plan.result={...(plan.result||{}),us:String(c.us),them:String(c.them)};
  try{await store.collection("gameplans").doc(date).set({...plan,updatedAt:Date.now()});}catch{}
}

/* ---------- recap ---------- */
function boxRows(g,c){
  const R=T().roster,by=Object.fromEntries(R.map(p=>[p.id,p]));
  const ids=Object.keys(c.players).sort((a,b)=>(c.players[b].pts-c.players[a].pts)||((parseInt((by[a]||{}).number)||99)-(parseInt((by[b]||{}).number)||99)));
  return ids.map(id=>({p:by[id]||{name:"Former player"},r:c.players[id]}));
}
const BB_COLS=[["QTR",r=>r.q||0],["PTS",r=>r.pts],["FG",r=>{const s=r.s,m=(s["2pm"]||0)+(s["3pm"]||0);return `${m}-${m+(s["2px"]||0)+(s["3px"]||0)}`;}],["3P",r=>`${r.s["3pm"]||0}-${(r.s["3pm"]||0)+(r.s["3px"]||0)}`],
  ["FT",r=>`${r.s.ftm||0}-${(r.s.ftm||0)+(r.s.ftx||0)}`],["REB",r=>(r.s.oreb||0)+(r.s.dreb||0)],["AST",r=>r.s.ast||0],["STL",r=>r.s.stl||0],["BLK",r=>r.s.blk||0],["TO",r=>r.s.to||0],["PF",r=>r.s.pf||0]];
const cols=()=>SPORT()==="basketball"?BB_COLS:[["QTR",r=>r.q||0],["PTS",r=>r.pts],...statset().map(([k,l])=>[l.replace(/ .*/,"").slice(0,5).toUpperCase(),r=>r.s[k]||0])];
function totalsRow(rows){
  const t={min:0,pts:0,s:{}};rows.forEach(({r})=>{t.min+=r.min;t.pts+=r.pts;Object.entries(r.s).forEach(([k,v])=>t.s[k]=(t.s[k]||0)+v);});return t;
}
function eventText(g,e,by){
  const set=Object.fromEntries(statset().map(([k,l])=>[k,l]));
  if(e.k==="stat")return `${short(by[e.pid])}: ${set[e.stat]||e.stat}`;
  if(e.k==="opp")return `${g.opponent||"Opponent"} +${e.pts}`;
  if(e.k==="sub"){const i=(e.ins||[]).map(x=>short(by[x])).join(", "),o=(e.outs||[]).map(x=>short(by[x])).join(", ");
    return !i?`${o} to the bench`:`Sub: ${i} in${o?" for "+o:""}`;}
  if(e.k==="period")return `End of ${periodLabel(g,e.from)}`;
  return "";
}
function renderRecap(date){
  const g=GAMES[date],gm=games().find(x=>x.date===date)||{date,opponent:(g||{}).opponent};
  const box=$("#tm-stats");
  if(!g){box.innerHTML=`<div class="tm-card"><p class="help">This game hasn't been tracked.</p><button class="btn" data-st="games">‹ Games</button></div>`;return;}
  const c=compute(g),rows=boxRows(g,c),C=cols(),tot=totalsRow(rows),by=Object.fromEntries(T().roster.map(p=>[p.id,p]));
  const per=Array.from({length:Math.max(g.periods,g.period)},(_,i)=>i+1);
  const top=rows.slice(0,3).filter(x=>x.r.pts);
  const reb=SPORT()==="basketball"?[...rows].sort((a,b)=>((b.r.s.oreb||0)+(b.r.s.dreb||0))-((a.r.s.oreb||0)+(a.r.s.dreb||0)))[0]:null;
  const res=c.us>c.them?"W":c.us<c.them?"L":"T";
  box.innerHTML=`<div class="tm-card st-recap">
    <div class="st-head"><button type="button" class="btn" data-st="games">‹ Games</button>${can()?`<button type="button" class="btn" data-st="resume" data-date="${date}">${g.final?"Edit stats":"Back to live"}</button>`:""}<button type="button" class="btn primary" data-st="pdf" data-date="${date}">Print recap</button></div>
    <h3 class="tm-h">${gm.home===false?"at":"vs"} ${esc(gm.opponent||"Game")} <small>${esc(T().longDay(date))}${g.final?"":" · in progress"}</small></h3>
    <div class="st-final"><b class="r-${res}">${g.final?res+" ":""}${c.us}–${c.them}</b></div>
    <div class="st-tablewrap"><table class="st-table st-q"><thead><tr><th></th>${per.map(p=>`<th>${g.periods===2?(p===1?"1H":"2H"):PERIOD_NAME(g)+p}</th>`).join("")}<th>T</th></tr></thead>
      <tbody><tr><th>${esc((team.settings||{}).mascot||"Us")}</th>${per.map(p=>`<td>${c.per[p]||0}</td>`).join("")}<td><b>${c.us}</b></td></tr>
      <tr><th>${esc(gm.opponent||"Them")}</th>${per.map(p=>`<td>${c.opp[p]||0}</td>`).join("")}<td><b>${c.them}</b></td></tr></tbody></table></div>
    ${top.length?`<p class="st-leaders"><b>Leading scorers:</b> ${top.map(x=>`${esc(pname(x.p))} ${x.r.pts}`).join(" · ")}${reb&&((reb.r.s.oreb||0)+(reb.r.s.dreb||0))?` · <b>Rebounds:</b> ${esc(short(reb.p))} ${(reb.r.s.oreb||0)+(reb.r.s.dreb||0)}`:""}</p>`:""}
    <h4 class="gp-h">Box score</h4>
    <div class="st-tablewrap"><table class="st-table"><thead><tr><th class="nm">Player</th>${C.map(([h])=>`<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(({p,r})=>`<tr><th class="nm"><button type="button" class="linkbtn" data-st="player" data-pid="${esc(p.id||"")}">${esc(pname(p))}</button></th>${C.map(([,f])=>`<td>${f(r)}</td>`).join("")}</tr>`).join("")}
      <tr class="tot"><th class="nm">Team</th>${C.map(([h,f])=>`<td>${h==="QTR"?"":f(tot)}</td>`).join("")}</tr></tbody></table></div>
    <p class="help">QTR = ${g.periods===2?"halves":"quarters"} played: on the floor at any point in them.</p>
    <h4 class="gp-h">Substitutions</h4>
    ${c.subs.length?`<ol class="st-log">${c.subs.map(e=>`<li><span>${periodLabel(g,e.p)}</span>${esc(eventText(g,e,by))}</li>`).join("")}</ol>`:`<p class="help">No substitutions recorded.</p>`}
    <details class="st-pbp"><summary>Every play, in order (${(g.events||[]).length})</summary>
      <ol class="st-log">${(g.events||[]).map(e=>`<li><span>${periodLabel(g,e.p)}</span>${esc(eventText(g,e,by))}${can()&&e.k!=="period"?` <button type="button" class="icon" data-st="delev" data-id="${esc(e.id)}" data-date="${date}" aria-label="Remove">✕</button>`:""}</li>`).join("")}</ol></details>
    <label class="f" style="margin-top:10px">Game notes<textarea data-st-notes="${date}" rows="2" placeholder="What went well, what to work on"${can()?"":" disabled"}>${esc(g.notes||"")}</textarea></label>
  </div>`;
}

/* ---------- season overview and each player's game log ---------- */
function seasonData(){
  const tracked=games().filter(g=>GAMES[g.date]&&(GAMES[g.date].events||[]).length);
  const P={};let w=0,l=0,pf=0,pa=0;
  tracked.forEach(gm=>{const g=GAMES[gm.date],c=compute(g);if(g.final){if(c.us>c.them)w++;else if(c.us<c.them)l++;}pf+=c.us;pa+=c.them;
    Object.values(c.players).forEach(r=>{const t=P[r.pid]=P[r.pid]||{pid:r.pid,gp:0,min:0,q:0,pts:0,s:{},log:[]};
      if(r.q>0||r.pts||Object.keys(r.s).length){t.gp++;t.min+=r.min;t.q+=r.q||0;t.pts+=r.pts;Object.entries(r.s).forEach(([k,v])=>t.s[k]=(t.s[k]||0)+v);t.log.push({date:gm.date,opp:gm.opponent,home:gm.home!==false,r});}});});
  return {tracked,P,w,l,pf,pa};
}
function renderSeason(){
  const box=$("#tm-stats"),d=seasonData(),R=T().roster,by=Object.fromEntries(R.map(p=>[p.id,p]));
  const bb=SPORT()==="basketball",set=statset();
  const list=Object.values(d.P).sort((a,b)=>b.pts/b.gp-a.pts/a.gp);
  const head=bb?["GP","QTR","PTS","REB","AST","STL","BLK","TO","FG%","3P%","FT%"]:["GP","QTR","PTS",...set.filter(([,,p])=>!p).map(([,l])=>l.replace(/ .*/,"").slice(0,5).toUpperCase())];
  const cells=t=>bb?[t.gp,avg(t.q,t.gp),avg(t.pts,t.gp),avg((t.s.oreb||0)+(t.s.dreb||0),t.gp),avg(t.s.ast||0,t.gp),avg(t.s.stl||0,t.gp),avg(t.s.blk||0,t.gp),avg(t.s.to||0,t.gp),
      pct((t.s["2pm"]||0)+(t.s["3pm"]||0),(t.s["2pm"]||0)+(t.s["3pm"]||0)+(t.s["2px"]||0)+(t.s["3px"]||0)),pct(t.s["3pm"]||0,(t.s["3pm"]||0)+(t.s["3px"]||0)),pct(t.s.ftm||0,(t.s.ftm||0)+(t.s.ftx||0))]:
    [t.gp,avg(t.q,t.gp),avg(t.pts,t.gp),...set.filter(([,,p])=>!p).map(([k])=>avg(t.s[k]||0,t.gp))];
  const leader=(lbl,f)=>{const b=[...list].filter(t=>t.gp).sort((a,b)=>f(b)-f(a))[0];return b&&f(b)>0?`<div class="st-lead"><small>${lbl}</small><b>${esc(short(by[b.pid]))}</b><span>${avg(f(b)*b.gp,b.gp)}</span></div>`:"";};
  box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Season stats <small>${d.tracked.length} game${d.tracked.length===1?"":"s"} tracked${d.w+d.l?` · ${d.w}–${d.l}`:""}</small></h3>
    ${d.tracked.length?`<div class="st-leads">${leader("Points per game",t=>t.pts/t.gp)}${bb?leader("Rebounds per game",t=>((t.s.oreb||0)+(t.s.dreb||0))/t.gp)+leader("Assists per game",t=>(t.s.ast||0)/t.gp)+leader("Steals per game",t=>(t.s.stl||0)/t.gp):""}
      <div class="st-lead"><small>Points per game</small><b>Team</b><span>${avg(d.pf,d.tracked.length)} – ${avg(d.pa,d.tracked.length)}</span></div></div>
      <div class="st-tablewrap"><table class="st-table"><thead><tr><th class="nm">Player</th>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${list.map(t=>`<tr><th class="nm"><button type="button" class="linkbtn" data-st="player" data-pid="${esc(t.pid)}">${esc(pname(by[t.pid]))}</button></th>${cells(t).map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="help">Per-game averages. QTR = quarters played. Tap a player for their game-by-game log.</p>
      <div class="actions" style="margin:0"><button type="button" class="btn" data-st="csv">Download as a spreadsheet</button></div>`:
      `<p class="help">No games tracked yet. Track a game from the <b>Games</b> list (or the Gameplan) and every player's stats add up here.</p>`}</div>`;
}
function renderPlayer(pid){
  const box=$("#tm-stats"),d=seasonData(),t=d.P[pid],p=T().roster.find(x=>x.id===pid);
  const bb=SPORT()==="basketball",C=cols();
  box.innerHTML=`<div class="tm-card"><div class="st-head"><button type="button" class="btn" data-st="season">‹ Season stats</button></div>
    <h3 class="tm-h">${esc(pname(p))} <small>${p&&p.pos?esc(p.pos):""}</small></h3>
    ${t?`<div class="st-leads"><div class="st-lead"><small>Games</small><b>${t.gp}</b></div><div class="st-lead"><small>Points</small><b>${avg(t.pts,t.gp)}</b><span>per game</span></div>
      <div class="st-lead"><small>Quarters played</small><b>${avg(t.q,t.gp)}</b><span>per game</span></div>${bb?`<div class="st-lead"><small>Rebounds</small><b>${avg((t.s.oreb||0)+(t.s.dreb||0),t.gp)}</b><span>per game</span></div>`:""}</div>
      <h4 class="gp-h">Game by game</h4>
      <div class="st-tablewrap"><table class="st-table"><thead><tr><th class="nm">Game</th>${C.map(([h])=>`<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${t.log.map(x=>`<tr><th class="nm"><button type="button" class="linkbtn" data-st="open" data-date="${x.date}">${esc(T().longDay(x.date))} ${x.home?"vs":"at"} ${esc(x.opp||"")}</button></th>${C.map(([,f])=>`<td>${f(x.r)}</td>`).join("")}</tr>`).join("")}
      <tr class="tot"><th class="nm">Season</th>${C.map(([h,f])=>`<td>${h==="QTR"?t.q:f(t)}</td>`).join("")}</tr></tbody></table></div>`:
      `<p class="help">No stats for this player yet.</p>`}</div>`;
}
function renderGames(){
  const box=$("#tm-stats"),gs=games(),today=todayISO();
  box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Games</h3>
    ${gs.length?`<ul class="st-games">${gs.map(g=>{const s=GAMES[g.date],c=s&&(s.events||[]).length?compute(s):null;
      return `<li><div><b>${esc(T().longDay(g.date))}</b> ${g.home===false?"at":"vs"} ${esc(g.opponent||"Game")}<small>${c?`${s.final?(c.us>c.them?"W":c.us<c.them?"L":"T")+" ":"Live · "}${c.us}–${c.them}`:g.date<today?"Not tracked":""}</small></div>
        <span class="st-gbtn">${c?`<button type="button" class="btn" data-st="open" data-date="${g.date}">Recap</button>`:""}${can()&&(!s||!s.final)?`<button type="button" class="btn ${c?"":"primary"}" data-st="track" data-date="${g.date}">${c?"Resume":"Track"}</button>`:""}</span></li>`;}).join("")}</ul>`:
      `<p class="help">Add games in the Calendar tab first.</p>`}</div>`;
}

/* ---------- printing and spreadsheet ---------- */
function printRecap(date){
  const g=GAMES[date],gm=games().find(x=>x.date===date)||{};if(!g)return;
  const c=compute(g),rows=boxRows(g,c),C=cols(),tot=totalsRow(rows),by=Object.fromEntries(T().roster.map(p=>[p.id,p])),doc=T().pdfDoc();
  let y=T().pdfHead(doc,`${gm.home===false?"at":"vs"} ${gm.opponent||"Game"}: ${c.us}–${c.them}`,[team.name,(team.settings||{}).teamLabel,T().longDay(date)].filter(Boolean).join(" · "));
  const per=Array.from({length:Math.max(g.periods,g.period)},(_,i)=>i+1);
  doc.setFontSize(10);doc.setFont("helvetica","bold");per.forEach((p,i)=>doc.text(g.periods===2?(p===1?"1H":"2H"):PERIOD_NAME(g)+p,170+i*40,y));doc.text("T",170+per.length*40,y);y+=14;
  [[(team.settings||{}).mascot||"Us",c.per,c.us],[gm.opponent||"Them",c.opp,c.them]].forEach(([n,m,t])=>{doc.setFont("helvetica","normal");doc.text(String(n).slice(0,26),40,y);per.forEach((p,i)=>doc.text(String(m[p]||0),170+i*40,y));doc.setFont("helvetica","bold");doc.text(String(t),170+per.length*40,y);y+=14;});
  y+=10;const x0=40,wn=140,wc=(572-x0-wn)/C.length;
  doc.setFont("helvetica","bold");doc.setFontSize(9);doc.text("Player",x0,y);C.forEach(([h],i)=>doc.text(h,x0+wn+i*wc,y));y+=4;doc.line(40,y,572,y);y+=12;
  doc.setFont("helvetica","normal");
  rows.forEach(({p,r})=>{if(y>740){doc.addPage();y=50;}doc.text(pname(p).slice(0,26),x0,y);C.forEach(([,f],i)=>doc.text(String(f(r)),x0+wn+i*wc,y));y+=14;});
  doc.setFont("helvetica","bold");doc.text("Team",x0,y);C.forEach(([h,f],i)=>{if(h!=="QTR")doc.text(String(f(tot)),x0+wn+i*wc,y);});y+=20;
  if(c.subs.length){doc.setFontSize(11);doc.text("Substitutions",40,y);y+=14;doc.setFont("helvetica","normal");doc.setFontSize(9);
    c.subs.forEach(e=>{if(y>750){doc.addPage();y=50;}doc.text(`${periodLabel(g,e.p)}   ${eventText(g,e,by)}`,40,y);y+=12;});}
  if(g.notes){y+=8;doc.setFont("helvetica","bold");doc.setFontSize(11);doc.text("Notes",40,y);y+=14;doc.setFont("helvetica","normal");doc.setFontSize(10);doc.splitTextToSize(g.notes,520).forEach(l=>{doc.text(l,40,y);y+=13;});}
  doc.save(`recap-${date}-${T().slug(gm.opponent)}.pdf`);
}
function seasonCSV(){
  const d=seasonData(),by=Object.fromEntries(T().roster.map(p=>[p.id,p])),keys=statset().map(([k])=>k),labels=statset().map(([,l])=>l);
  const q=v=>`"${String(v).replace(/"/g,'""')}"`;
  const lines=[["Player","Number","Games","Quarters played","Points",...labels].map(q).join(",")];
  Object.values(d.P).forEach(t=>{const p=by[t.pid]||{};lines.push([p.name||"",p.number||"",t.gp,t.q||0,t.pts,...keys.map(k=>t.s[k]||0)].map(q).join(","));});
  saveFile(`${T().slug(team.name)}-season-stats.csv`,new Blob([lines.join("\n")],{type:"text/csv"}));
}

/* ---------- pane ---------- */
/* The game the Live button should open: one already in progress, then today's game, then the next one coming up. */
function liveTarget(){
  const gs=games(),today=todayISO();
  return gs.find(g=>{const s=GAMES[g.date];return s&&!s.final&&(s.events||[]).length;})
    ||gs.find(g=>g.date===today&&!(GAMES[g.date]||{}).final)
    ||gs.filter(g=>g.date>today&&!(GAMES[g.date]||{}).final).sort((a,b)=>a.date<b.date?-1:1)[0]||null;
}
function render(){
  if(!live){document.body.classList.remove("live-mode");renderLive.top=false;}
  if(T().date){openDate=T().date;T().date=null;view=GAMES[openDate]&&(GAMES[openDate].events||[]).length?"recap":"setup";}
  if(live){renderLive();return;}
  const db=T().needsDb()==="gamestats"?T().dbHelp:"";
  const nav=`<div class="st-nav seg" role="group" aria-label="Stats views"><button type="button" data-st="season" aria-pressed="${view==="season"||view==="player"}">Season</button><button type="button" data-st="games" aria-pressed="${view==="games"||view==="recap"}">Games</button>${can()?`<button type="button" class="st-livebtn" data-st="golive" aria-pressed="${view==="setup"}"><span class="st-dot"></span>Live tracker</button>`:""}</div>`;
  $("#tm-stats").innerHTML=db+nav+`<div id="stBody"></div>`;
  const body=$("#stBody"),swap=f=>{const tmp=$("#tm-stats");const keep=tmp.innerHTML;f();const inner=tmp.innerHTML;tmp.innerHTML=db+nav+`<div id="stBody">${inner}</div>`;};
  if(view==="setup"){const g=games().find(x=>x.date===openDate);if(!g){view="games";return render();}body.innerHTML=setupForm(g);return;}
  if(view==="recap")swap(()=>renderRecap(openDate));
  else if(view==="player")swap(()=>renderPlayer(playerId));
  else if(view==="games")swap(renderGames);
  else swap(renderSeason);
}
T().panes.stats=render;
$("#tm-stats").addEventListener("click",e=>{
  const b=e.target.closest("[data-st]");if(!b||live)return;
  const a=b.dataset.st;
  if(a==="season"){view="season";render();}
  if(a==="games"){view="games";render();}
  if(a==="back"){view="games";render();}
  if(a==="open"){openDate=b.dataset.date;view="recap";render();}
  if(a==="player"&&b.dataset.pid){playerId=b.dataset.pid;view="player";render();}
  if(a==="golive"){const g=liveTarget();
    if(!g){view="games";render();const h=$("#tm-stats .tm-h");if(h)h.insertAdjacentHTML("afterend",`<p class="help st-nolive">No game today or coming up. Pick a game below to track it.</p>`);return;}
    b.dataset.date=g.date;}
  if(a==="track"||a==="resume"||a==="golive"){
    const d=b.dataset.date,saved=GAMES[d];openDate=d;
    let local=null;try{local=JSON.parse(localStorage.getItem("cpp:live:"+team.id+":"+d)||"null");}catch{}
    const best=[saved,local].filter(Boolean).sort((x,y)=>(y.events||[]).length-(x.events||[]).length)[0];
    if(best&&(best.events||[]).length){live=JSON.parse(JSON.stringify(best));if(a==="resume"&&live.final)live.final=false;pick=null;subIn=null;armed=null;startTick();renderLive();}
    else{view="setup";render();}
  }
  if(a==="pdf")printRecap(b.dataset.date);
  if(a==="csv")seasonCSV();
  if(a==="delev"&&can()){const g=GAMES[b.dataset.date];if(!g)return;if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Remove?";b.classList.add("armed");return;}
    g.events=(g.events||[]).filter(x=>x.id!==b.dataset.id);T().put("gamestats",g.date,{...g,updatedAt:Date.now()});if(g.final)saveResult(g.date);renderRecap(g.date);render();}
});
$("#tm-stats").addEventListener("change",e=>{
  const n=e.target.closest("[data-st-notes]");if(!n||!can())return;const g=GAMES[n.dataset.stNotes];if(!g)return;
  g.notes=n.value;T().put("gamestats",g.date,{...g,updatedAt:Date.now()});
});
/* Leaving the Team tab while a game is live keeps it saved; the clock keeps time from the saved start. */
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&live)persist(true);});
window.StatsTrack=date=>{T().date=date;window.goTeam("stats");};
})();
