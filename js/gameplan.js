/* Team tab → Gameplan and Scouting report.
   Scouting report: one per opponent (kind "scouts", id from the opponent's name), so every game
   against that team shares it. Gameplan: one per game (kind "gameplans", id = the game date),
   with keys to the game, the starting lineup, matchups against the scouted players, the plays to
   run (from the team's playbook), notes, and the result afterwards. Both save as you type and print. */
(function(){
const SCOUTS={}, PLANS={};
window.TM.plans=PLANS;   // read by js/stats.js (starters, saving the final score)
let gpDate=null, scKey=null, timer=null, pendingKind=null, pendingId=null, newOpp=false;
const T=()=>window.TM;
const keyOf=o=>String(o||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"opponent";
const games=()=>(SETTINGS.games||[]).filter(g=>g.date).sort((a,b)=>a.date<b.date?-1:1);
const isBB=()=>(SETTINGS.sport||"basketball")==="basketball";
const lineupSize=()=>({basketball:5,volleyball:6,soccer:11,football:11,baseball:9})[SETTINGS.sport||"basketball"]||Math.min(sp().players||5,11);
const OFF_TAGS=["Motion","Set plays","Fast break","Post-ups","Drive and kick","Lots of 3s","Ball screens","Isolation for one player"];
const DEF_TAGS=["Man","2-3 zone","1-3-1 zone","3-2 zone","Matchup zone","Box-and-1","Full-court press","Half-court trap","Switches screens","Packs the paint"];
const THREAT=[["3","Top threat"],["2","Can hurt us"],["1","Role player"]];
const can=()=>typeof PERM!=="undefined"&&PERM.plans;
const dis=()=>can()?"":" disabled";
const lines=a=>(a||[]).filter(x=>String(x||"").trim());

/* ---------- data ---------- */
T().opened.push(()=>{
  Object.keys(SCOUTS).forEach(k=>delete SCOUTS[k]);Object.keys(PLANS).forEach(k=>delete PLANS[k]);gpDate=null;scKey=null;newOpp=false;
  const sub=(kind,map,paneName)=>store.collection(kind).onSnapshot(s=>{
    const next=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));
    if(timer&&pendingKind===kind&&map[pendingId])next[pendingId]=map[pendingId];   // keep unsaved typing
    const changed=JSON.stringify(next)!==JSON.stringify(map);
    Object.keys(map).forEach(k=>delete map[k]);Object.assign(map,next);if(window.renderHome)setTimeout(renderHome,0);
    const typing=document.activeElement&&document.activeElement.closest("#tm-"+paneName+" :is(input,textarea,select)");
    if(changed&&!typing&&["game","scout"].includes(T().pane))T().render();
  },()=>{});
  window.__gpUnsubs=(window.__gpUnsubs||[]).filter(u=>{try{u()}catch{}return false;});
  window.__gpUnsubs.push(sub("scouts",SCOUTS,"scout"),sub("gameplans",PLANS,"game"));
});
function save(kind,id,body,now){
  const map=kind==="scouts"?SCOUTS:PLANS;map[id]=body;
  if(timer&&(pendingKind!==kind||pendingId!==id))flush();
  pendingKind=kind;pendingId=id;clearTimeout(timer);
  timer=setTimeout(flush,now?0:600);
}
function flush(){
  clearTimeout(timer);timer=null;if(!pendingKind)return;
  const kind=pendingKind,id=pendingId,map=kind==="scouts"?SCOUTS:PLANS;
  const body={...map[id],updatedAt:Date.now(),updatedBy:(typeof ME!=="undefined"&&ME.name)||""};
  map[id]=body;T().put(kind,id,body).then(ok=>{const el=document.getElementById(kind==="scouts"?"scSaved":"gpSaved");if(el)el.textContent=ok?"Saved":"";});
}
window.addEventListener("pagehide",flush);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flush();});
/* Form fields carry their place in the saved object: data-p="keys.1", data-p="players.0.notes" … */
function setPath(o,path,v){const ks=path.split(".");let x=o;ks.slice(0,-1).forEach((k,i)=>{if(x[k]==null)x[k]=/^\d+$/.test(ks[i+1])?[]:{};x=x[k];});x[ks[ks.length-1]]=v;}
const mark=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt;};

/* ---------- scouting report ---------- */
function scoutFor(key,opp){const s=JSON.parse(JSON.stringify(SCOUTS[key]||{}));s.opponent=s.opponent||opp||"";s.players=s.players||[];s.keys=s.keys||["","",""];s.off=s.off||[];s.def=s.def||[];return s;}
function opponents(){
  const m=new Map();
  games().forEach(g=>{if(g.opponent){const k=keyOf(g.opponent);if(!m.has(k))m.set(k,{key:k,name:g.opponent,games:[]});m.get(k).games.push(g);}});
  Object.entries(SCOUTS).forEach(([k,s])=>{if(!m.has(k))m.set(k,{key:k,name:s.opponent||k,games:[]});});
  return [...m.values()];
}
function resultOf(date){const r=(PLANS[date]||{}).result||{};if(r.us===""||r.us==null||r.them===""||r.them==null)return "";const u=+r.us,t=+r.them;return `${u>t?"W":u<t?"L":"T"} ${u}–${t}`;}
const tagPick=(list,on,path)=>`<div class="gp-tags">${list.map(t=>`<button type="button" class="gp-tag" data-tag="${esc(path)}" data-val="${esc(t)}" aria-pressed="${on.includes(t)}"${dis()}>${esc(t)}</button>`).join("")}</div>`;
function renderScout(){
  const box=$("#tm-scout"),ops=opponents(),today=todayISO();
  if(T().date){const g=games().find(x=>x.date===T().date);if(g&&g.opponent)scKey=keyOf(g.opponent);T().date=null;}
  if(!scKey||!ops.some(o=>o.key===scKey)){const nx=games().find(g=>g.date>=today&&g.opponent)||games().find(g=>g.opponent);scKey=nx?keyOf(nx.opponent):(ops[0]||{}).key||null;}
  const chips=`<div class="bus-games" role="list">${ops.map(o=>{const nx=o.games.find(g=>g.date>=today);const has=!!SCOUTS[o.key];
      return `<button type="button" class="bus-g${o.key===scKey?" on":""}${!nx&&o.games.length?" past":""}" data-scopp="${esc(o.key)}"><b>${esc(o.name)}${has?" ✓":""}</b><small>${nx?"next "+esc(T().longDay(nx.date)):o.games.length?"played":"not on schedule"}</small></button>`;}).join("")}
    ${can()?`<button type="button" class="bus-g" data-scnew><b>+ Other team</b><small>not on the schedule</small></button>`:""}</div>`;
  if(newOpp){box.innerHTML=chips+`<div class="tm-card"><h3 class="tm-h">Scout another team</h3><form id="scNewForm" class="actions" style="margin:0;align-items:end"><label class="f" style="flex:1 1 220px">Team name<input id="scNewName" required placeholder="e.g. Springfield Catholic"></label><button class="btn primary" type="submit">Start report</button><button class="btn" type="button" data-sccancel>Cancel</button></form></div>`;return;}
  if(!scKey){box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Scouting report</h3><p class="help">Add games in the Calendar tab, and each opponent gets a scouting report here.${can()?" Or scout a team that isn't on your schedule yet.":""}</p>${can()?`<button class="btn" type="button" data-scnew>+ Scout a team</button>`:""}</div>`;return;}
  const o=ops.find(x=>x.key===scKey),s=scoutFor(scKey,o.name),D=dis();
  const gl=o.games.map(g=>`${T().longDay(g.date)} ${g.home===false?"at them":"at home"}${resultOf(g.date)?` (${resultOf(g.date)})`:""}`).join(" · ");
  const players=s.players.map((p,i)=>`<div class="sc-pl t${esc(p.threat||"2")}">
      <div class="sc-plrow"><input class="sc-num" data-p="players.${i}.num" value="${esc(p.num||"")}" placeholder="#" aria-label="Number"${D}>
      <input data-p="players.${i}.name" value="${esc(p.name||"")}" placeholder="Name or description (e.g. tall lefty)" aria-label="Player"${D}>
      <select data-p="players.${i}.threat" data-rerender aria-label="How dangerous"${D}>${THREAT.map(([v,l])=>`<option value="${v}"${(p.threat||"2")===v?" selected":""}>${l}</option>`).join("")}</select>
      ${can()?`<button class="icon" type="button" data-scrm="${i}" aria-label="Remove player">✕</button>`:""}</div>
      <input data-p="players.${i}.pos" value="${esc(p.pos||"")}" placeholder="Position, height, hand (e.g. PG, 5'6&quot;, right-handed)" aria-label="Position"${D}>
      <textarea data-p="players.${i}.notes" rows="2" placeholder="What she does, and how we guard her (e.g. drives right every time: force left, sag off, she won't shoot the 3)"${D}>${esc(p.notes||"")}</textarea></div>`).join("");
  box.innerHTML=(T().needsDb()==="scouts"?T().dbHelp:"")+chips+`<div class="tm-card sc-card">
    <h3 class="tm-h">${esc(o.name)} <small>${gl||"Not on the schedule"}</small></h3>
    <div class="bus-grid">
      <label class="f">Their record<input data-p="record" value="${esc(s.record||"")}" placeholder="e.g. 5–2"${D}></label>
      <label class="f">Their coach<input data-p="coach" value="${esc(s.coach||"")}"${D}></label>
      <label class="f bus-wide">Where this came from<input data-p="source" value="${esc(s.source||"")}" placeholder="e.g. Watched them vs Nixa, Nov 2 · film · played them last year"${D}></label>
      <label class="f bus-wide">The big picture<textarea data-p="overview" rows="3" placeholder="Size, speed, depth, how they like to play"${D}>${esc(s.overview||"")}</textarea></label>
    </div>
    <h4 class="gp-h">Players to know</h4>
    ${players||`<p class="help">No players yet.</p>`}
    ${can()?`<button class="btn" type="button" data-scadd>+ Add a player</button>`:""}
    <h4 class="gp-h">Their offense</h4>${isBB()?tagPick(OFF_TAGS,s.off,"off"):""}
    <textarea data-p="offense" rows="3" placeholder="Sets they run, who gets the ball, what they do after a timeout"${D}>${esc(s.offense||"")}</textarea>
    <h4 class="gp-h">Their defense</h4>${isBB()?tagPick(DEF_TAGS,s.def,"def"):""}
    <textarea data-p="defense" rows="3" placeholder="How they guard, who's their weak defender, when they press"${D}>${esc(s.defense||"")}</textarea>
    <h4 class="gp-h">${isBB()?"Out of bounds and special situations":"Set pieces and special situations"}</h4>
    <textarea data-p="special" rows="2" placeholder="Inbound plays, end of quarter, press break"${D}>${esc(s.special||"")}</textarea>
    <h4 class="gp-h">Keys to beat them</h4>
    <ol class="gp-keys">${s.keys.map((k,i)=>`<li><input data-p="keys.${i}" value="${esc(k||"")}" placeholder="${["e.g. Keep #3 out of the lane","e.g. Win the rebounding battle","e.g. Attack their zone from the high post"][i]||"Another key"}" aria-label="Key ${i+1}"${D}></li>`).join("")}</ol>
    ${can()?`<button class="btn" type="button" data-sckey>+ Add a key</button>`:""}
    <div class="actions" style="margin:14px 0 0"><button class="btn primary" type="button" data-scprint>Print scouting report</button>${o.games.length?`<button class="btn" type="button" data-scgame="${o.games.find(g=>g.date>=todayISO())?.date||o.games[o.games.length-1].date}">Gameplan for this game</button>`:""}<span class="saved" id="scSaved">${SCOUTS[scKey]&&SCOUTS[scKey].updatedBy?`Last edit by ${esc(SCOUTS[scKey].updatedBy)}`:""}</span></div>
  </div>`;
}
T().panes.scout=renderScout;
const scTarget=()=>scoutFor(scKey,(opponents().find(o=>o.key===scKey)||{}).name);
$("#tm-scout").addEventListener("input",e=>{
  const f=e.target.closest("[data-p]");if(!f||!can())return;
  const s=scTarget();setPath(s,f.dataset.p,f.value);mark("scSaved","Saving…");save("scouts",scKey,s);
});
$("#tm-scout").addEventListener("change",e=>{
  const f=e.target.closest("[data-p]");if(!f||!can())return;
  const s=scTarget();setPath(s,f.dataset.p,f.value);save("scouts",scKey,s,true);if(f.hasAttribute("data-rerender"))renderScout();
});
$("#tm-scout").addEventListener("click",e=>{
  const c=e.target.closest("[data-scopp]");if(c){flush();scKey=c.dataset.scopp;newOpp=false;renderScout();return;}
  if(e.target.closest("[data-scnew]")){newOpp=true;renderScout();$("#scNewName").focus();return;}
  if(e.target.closest("[data-sccancel]")){newOpp=false;renderScout();return;}
  const g=e.target.closest("[data-scgame]");if(g){flush();gpDate=g.dataset.scgame;window.goTeam("game");return;}
  if(e.target.closest("[data-scprint]")){flush();printScout();return;}
  if(!can())return;
  const s=scTarget();
  if(e.target.closest("[data-scadd]")){s.players.push({num:"",name:"",threat:"2"});save("scouts",scKey,s,true);renderScout();
    const ins=document.querySelectorAll("#tm-scout .sc-pl .sc-num");if(ins.length)ins[ins.length-1].focus();return;}
  const rm=e.target.closest("[data-scrm]");
  if(rm){if(rm.dataset.armed!=="1"){rm.dataset.armed="1";rm.textContent="Remove?";rm.classList.add("armed");return;}
    s.players.splice(+rm.dataset.scrm,1);save("scouts",scKey,s,true);renderScout();return;}
  if(e.target.closest("[data-sckey]")){s.keys.push("");save("scouts",scKey,s,true);renderScout();return;}
  const t=e.target.closest("[data-tag]");
  if(t){const list=s[t.dataset.tag]||[],v=t.dataset.val;s[t.dataset.tag]=list.includes(v)?list.filter(x=>x!==v):[...list,v];save("scouts",scKey,s,true);renderScout();}
});
$("#tm-scout").addEventListener("submit",e=>{
  e.preventDefault();const n=$("#scNewName").value.trim();if(!n)return;
  scKey=keyOf(n);newOpp=false;if(!SCOUTS[scKey])save("scouts",scKey,{opponent:n,players:[],keys:["","",""],off:[],def:[]},true);renderScout();
});

/* ---------- gameplan ---------- */
function planFor(date){const p=JSON.parse(JSON.stringify(PLANS[date]||{}));p.keys=p.keys||["","",""];p.starters=p.starters||[];p.plays=p.plays||[];p.matchups=p.matchups||{};p.result=p.result||{};return p;}
function renderGame(){
  const box=$("#tm-game"),gs=games(),today=todayISO(),D=dis();
  if(T().date){gpDate=T().date;T().date=null;}
  if(!gs.length){box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Gameplan</h3><p class="help">Add games in the Calendar tab, and each one gets a gameplan here.</p></div>`;return;}
  if(!gpDate||!gs.some(g=>g.date===gpDate))gpDate=(gs.find(g=>g.date>=today)||gs[gs.length-1]).date;
  const g=gs.find(x=>x.date===gpDate),p=planFor(gpDate),R=T().roster,sk=keyOf(g.opponent),s=SCOUTS[sk];
  const chips=`<div class="bus-games" role="list">${gs.map(x=>`<button type="button" class="bus-g${x.date===gpDate?" on":""}${x.date<today?" past":""}" data-gpg="${x.date}"><b>${esc(T().longDay(x.date))}${PLANS[x.date]?" ✓":""}</b><small>${x.home===false?"at":"vs"} ${esc(x.opponent||"Game")}${resultOf(x.date)?" · "+resultOf(x.date):""}</small></button>`).join("")}</div>`;
  const opt=(sel,ph)=>`<option value="">${ph}</option>`+R.map(r=>`<option value="${esc(r.id)}"${sel===r.id?" selected":""}>${esc(T().pname(r))}</option>`).join("");
  const n=lineupSize();
  const lineup=R.length?`<div class="gp-lineup">${Array.from({length:n},(_,i)=>`<label class="f"><span>${isBB()?["PG","SG","SF","PF","C"][i]||"Starter "+(i+1):"Starter "+(i+1)}</span><select data-p="starters.${i}"${D}>${opt(p.starters[i]||"","Pick a player")}</select></label>`).join("")}</div>`:
    `<p class="help">Add your players on the <button type="button" class="linkbtn" data-goteam="roster">Roster</button> page to pick a lineup.</p>`;
  const threats=s?[...(s.players||[])].map((x,i)=>({...x,i})).filter(x=>x.name||x.num).sort((a,b)=>(b.threat||"2")-(a.threat||"2")):[];
  const snap=s?`<div class="gp-snap">
      ${(s.def||[]).length||(s.off||[]).length?`<p>${(s.def||[]).length?`<b>Their defense:</b> ${esc(s.def.join(", "))}`:""}${(s.off||[]).length?`${(s.def||[]).length?"<br>":""}<b>Their offense:</b> ${esc(s.off.join(", "))}`:""}</p>`:""}
      ${threats.length?`<p><b>Watch out for:</b> ${threats.slice(0,3).map(x=>esc([x.num?"#"+x.num:"",x.name].filter(Boolean).join(" "))).join(", ")}</p>`:""}
      ${lines(s.keys).length?`<p><b>Scouting keys:</b> ${esc(lines(s.keys).join(" · "))}</p>`:""}
      <button type="button" class="linkbtn" data-gpscout>Open the scouting report</button></div>`:
    `<div class="gp-snap"><p>No scouting report on ${esc(g.opponent||"this team")} yet.</p>${can()?`<button type="button" class="linkbtn" data-gpscout>Start one</button>`:""}</div>`;
  const matchups=threats.length&&R.length?`<h4 class="gp-h">Matchups</h4><div class="gp-match">${threats.map(x=>`<label class="f"><span>${esc([x.num?"#"+x.num:"",x.name].filter(Boolean).join(" "))}${x.threat==="3"?" ★":""}</span><select data-p="matchups.${x.i}"${D}>${opt(p.matchups[x.i]||"","Who guards her?")}</select></label>`).join("")}</div>`:"";
  const types=[...new Set(plays.map(x=>x.type))];
  const chosen=p.plays.map(id=>plays.find(x=>x.id===id)).filter(Boolean);
  const playsUI=plays.length?`<div class="gp-chosen">${chosen.length?chosen.map(pl=>`<article class="gp-play"><div class="pthumb">${boardSVG(pl.frames[0],"screen")}</div><div><b>${esc(pl.name)}</b><small>${esc(pl.type)}</small>
        <div class="actions" style="margin:4px 0 0"><button class="btn" type="button" data-gpopen="${esc(pl.id)}">View</button>${can()?`<button class="btn" type="button" data-gptoggle="${esc(pl.id)}">Remove</button>`:""}</div></div></article>`).join(""):`<p class="help">No plays picked yet.</p>`}</div>
      ${can()?`<details class="gp-pick"><summary>Pick plays from your playbook (${plays.length})</summary>${types.map(t=>`<div class="gp-ptype"><b>${esc(t)}</b><div class="gp-tags">${plays.filter(x=>x.type===t).sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<button type="button" class="gp-tag" data-gptoggle="${esc(x.id)}" aria-pressed="${p.plays.includes(x.id)}">${esc(x.name)}</button>`).join("")}</div></div>`).join("")}</details>`:""}`:
    `<p class="help">Draw plays in the Plays tab and you can pick them here.</p>`;
  const r=p.result;
  box.innerHTML=(T().needsDb()==="gameplans"?T().dbHelp:"")+chips+`<div class="tm-card gp-card">
    <h3 class="tm-h">${g.home===false?"at":"vs"} ${esc(g.opponent||"Game")} <small>${esc(T().longDay(g.date))}${g.time?" · "+T().hm(g.time):""} · ${g.home===false?"Away":"Home"}</small></h3>
    ${snap}
    <h4 class="gp-h">Keys to the game</h4>
    <ol class="gp-keys">${p.keys.map((k,i)=>`<li><input data-p="keys.${i}" value="${esc(k||"")}" placeholder="${["e.g. Talk on defense, every possession","e.g. Box out, one shot only","e.g. Value the ball: under 10 turnovers"][i]||"Another key"}" aria-label="Key ${i+1}"${D}></li>`).join("")}</ol>
    ${can()?`<button class="btn" type="button" data-gpkey>+ Add a key</button>`:""}
    <h4 class="gp-h">Starting lineup</h4>${lineup}
    <h4 class="gp-h">Our defense</h4>
    <input data-p="defense" value="${esc(p.defense||"")}" placeholder="${isBB()?"e.g. Man, switch 1 through 4. Go to 2-3 if they post up":"How we'll defend"}"${D}>
    ${matchups}
    <h4 class="gp-h">Plays to run</h4>${playsUI}
    <label class="f" style="margin-top:8px">Offense notes<textarea data-p="offense" rows="2" placeholder="e.g. Run Bullet against man, zone offense vs 2-3, attack the left side"${D}>${esc(p.offense||"")}</textarea></label>
    <label class="f">Rotation and subs<textarea data-p="subs" rows="2" placeholder="e.g. First sub at 4:00 in the 1st, keep Ava out of foul trouble"${D}>${esc(p.subs||"")}</textarea></label>
    <label class="f">Timeouts, end of game, reminders<textarea data-p="notes" rows="2"${D}>${esc(p.notes||"")}</textarea></label>
    <h4 class="gp-h">After the game</h4>
    <div class="gp-score"><label class="f">Us<input type="number" min="0" inputmode="numeric" data-p="result.us" value="${esc(r.us??"")}"${D}></label><span>–</span><label class="f">${esc(g.opponent||"Them")}<input type="number" min="0" inputmode="numeric" data-p="result.them" value="${esc(r.them??"")}"${D}></label><b class="gp-wl" id="gpWL">${resultOf(gpDate)}</b></div>
    <label class="f">What worked, what to practice<textarea data-p="result.notes" rows="2"${D}>${esc(r.notes||"")}</textarea></label>
    <div class="actions" style="margin:14px 0 0"><button class="btn primary" type="button" data-gpprint>Print gameplan</button><button class="btn" type="button" data-gptrack="${gpDate}">📊 Track this game</button><span class="saved" id="gpSaved">${PLANS[gpDate]&&PLANS[gpDate].updatedBy?`Last edit by ${esc(PLANS[gpDate].updatedBy)}`:""}</span></div>
  </div>`;
}
T().panes.game=renderGame;
$("#tm-game").addEventListener("input",e=>{
  const f=e.target.closest("[data-p]");if(!f||!can())return;
  const p=planFor(gpDate);setPath(p,f.dataset.p,f.value);mark("gpSaved","Saving…");save("gameplans",gpDate,p);
  if(f.dataset.p.startsWith("result."))mark("gpWL",resultOf(gpDate));
});
$("#tm-game").addEventListener("change",e=>{
  const f=e.target.closest("[data-p]");if(!f||!can())return;
  const p=planFor(gpDate);setPath(p,f.dataset.p,f.value);save("gameplans",gpDate,p,true);
});
$("#tm-game").addEventListener("click",e=>{
  const c=e.target.closest("[data-gpg]");if(c){flush();gpDate=c.dataset.gpg;renderGame();return;}
  if(e.target.closest("[data-gpscout]")){flush();const g=games().find(x=>x.date===gpDate);scKey=keyOf(g&&g.opponent);window.goTeam("scout");return;}
  const o=e.target.closest("[data-gpopen]");if(o){flush();setTab("plays");const b=document.querySelector(`#plList [data-open="${CSS.escape(o.dataset.gpopen)}"]`);if(b)b.click();return;}
  if(e.target.closest("[data-gpprint]")){flush();printGame();return;}
  const tr=e.target.closest("[data-gptrack]");if(tr){flush();window.StatsTrack&&window.StatsTrack(tr.dataset.gptrack);return;}
  if(!can())return;
  const p=planFor(gpDate);
  if(e.target.closest("[data-gpkey]")){p.keys.push("");save("gameplans",gpDate,p,true);renderGame();return;}
  const t=e.target.closest("[data-gptoggle]");
  if(t){const id=t.dataset.gptoggle;p.plays=p.plays.includes(id)?p.plays.filter(x=>x!==id):[...p.plays,id];save("gameplans",gpDate,p,true);
    const open=!!(t.closest("details")&&t.closest("details").open);renderGame();if(open){const d=document.querySelector("#tm-game .gp-pick");if(d)d.open=true;}}
});

/* ---------- printing ---------- */
function writer(doc,y0){
  let y=y0;
  const need=h=>{if(y+h>750){doc.addPage();y=50;}};
  return {
    get y(){return y;},set y(v){y=v;},
    h(t){need(30);y+=8;doc.setFont("helvetica","bold");doc.setFontSize(12.5);doc.text(t.toUpperCase(),40,y);y+=5;doc.setDrawColor(180);doc.line(40,y,572,y);doc.setDrawColor(0);y+=14;},
    p(t,o={}){if(!t)return;doc.setFont("helvetica",o.bold?"bold":"normal");doc.setFontSize(o.size||10.5);
      doc.splitTextToSize(String(t),o.w||(532-(o.x||0))).forEach(l=>{need(14);doc.text(l,40+(o.x||0),y);y+=13.5;});y+=o.gap??3;},
    kv(k,v){if(!v)return;need(14);doc.setFont("helvetica","bold");doc.setFontSize(10.5);doc.text(k,40,y);doc.setFont("helvetica","normal");
      const ls=doc.splitTextToSize(String(v),420);ls.forEach((l,i)=>{if(i)need(14);doc.text(l,152,y);y+=13.5;});y+=2;}
  };
}
function printScout(){
  const o=opponents().find(x=>x.key===scKey);if(!o)return;const s=scoutFor(scKey,o.name),doc=T().pdfDoc();
  const w=writer(doc,T().pdfHead(doc,`Scouting report: ${o.name}`,[team.name,(team.settings||{}).teamLabel,o.games.map(g=>T().longDay(g.date)).join(", ")].filter(Boolean).join(" · ")));
  w.kv("Record",s.record);w.kv("Their coach",s.coach);w.kv("Source",s.source);
  if(s.overview){w.h("The big picture");w.p(s.overview);}
  const pl=s.players.filter(x=>x.name||x.num).sort((a,b)=>(b.threat||"2")-(a.threat||"2"));
  if(pl.length){w.h("Players to know");pl.forEach(x=>{w.p(`${x.num?"#"+x.num+"  ":""}${x.name||""}${x.threat==="3"?"  (top threat)":x.threat==="1"?"  (role player)":""}`,{bold:true,gap:0});w.p(x.pos,{x:14,gap:0});w.p(x.notes,{x:14,gap:6});});}
  if((s.off||[]).length||s.offense){w.h("Their offense");w.p((s.off||[]).join(", "),{bold:true});w.p(s.offense);}
  if((s.def||[]).length||s.defense){w.h("Their defense");w.p((s.def||[]).join(", "),{bold:true});w.p(s.defense);}
  if(s.special){w.h(isBB()?"Out of bounds and special situations":"Special situations");w.p(s.special);}
  if(lines(s.keys).length){w.h("Keys to beat them");lines(s.keys).forEach((k,i)=>w.p(`${i+1}. ${k}`,{size:11.5}));}
  doc.save(`scouting-${T().slug(o.name)}.pdf`);
}
function printGame(){
  const g=games().find(x=>x.date===gpDate);if(!g)return;const p=planFor(gpDate),R=T().roster,s=SCOUTS[keyOf(g.opponent)],doc=T().pdfDoc();
  const nm=id=>{const r=R.find(x=>x.id===id);return r?T().pname(r):"";};
  const w=writer(doc,T().pdfHead(doc,`Gameplan: ${g.home===false?"at":"vs"} ${g.opponent||"Game"}`,[team.name,(team.settings||{}).teamLabel,T().longDay(g.date)+(g.time?" · "+T().hm(g.time):""),g.home===false?"Away":"Home"].filter(Boolean).join(" · ")));
  if(lines(p.keys).length){w.h("Keys to the game");lines(p.keys).forEach((k,i)=>w.p(`${i+1}. ${k}`,{size:12,bold:true}));}
  const st=p.starters.map(nm).filter(Boolean);if(st.length){w.h("Starting lineup");w.p(st.join("    "),{size:11.5});}
  if(p.defense||Object.keys(p.matchups).length){w.h("Defense");w.p(p.defense);
    if(s)(s.players||[]).forEach((x,i)=>{const d=nm(p.matchups[i]);if(d)w.kv([x.num?"#"+x.num:"",x.name].filter(Boolean).join(" "),`${d}${x.notes?"  ·  "+x.notes:""}`);});}
  if(s){const bits=[(s.def||[]).length?"Their D: "+s.def.join(", "):"",(s.off||[]).length?"Their O: "+s.off.join(", "):""].filter(Boolean);if(bits.length||lines(s.keys).length){w.h("From the scouting report");bits.forEach(b=>w.p(b));lines(s.keys).forEach(k=>w.p("• "+k));}}
  const chosen=p.plays.map(id=>plays.find(x=>x.id===id)).filter(Boolean);
  if(chosen.length||p.offense){w.h("Offense");
    const byType={};chosen.forEach(x=>(byType[x.type]=byType[x.type]||[]).push(x.name));
    Object.entries(byType).forEach(([t,ns])=>w.kv(t,ns.join(", ")));w.p(p.offense);}
  if(p.subs){w.h("Rotation and subs");w.p(p.subs);}
  if(p.notes){w.h("Reminders");w.p(p.notes);}
  if(resultOf(gpDate)||p.result.notes){w.h("Result");w.p(resultOf(gpDate),{bold:true,size:12});w.p(p.result.notes);}
  doc.save(`gameplan-${gpDate}-${T().slug(g.opponent)}.pdf`);
}
})();
