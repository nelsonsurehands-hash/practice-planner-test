/* Team tab: your teams, the roster, the coaching staff, bus lists for away games,
   and game-day food sign-ups parents open from a link (no account needed).
   Roster players are saved as items of kind "players", bus lists as kind "trips" (one per game date).
   Food sign-up sheets live in their own tables (supabase/team-tools.sql); in demo mode they're
   kept in this browser so the parents' page can be previewed on this device. */
(function(){
let rsSel=null;   // roster multi-select: a Set of player ids while selecting
let pane="teams", ROSTER=[], TRIPS={}, unsubs=[], busDate=null, tripTimer=null, needsDb="", rosterEdit=null, food=null;
try{pane=localStorage.getItem("cpp:tmPane")||"teams";}catch{}
const can=()=>!!(typeof PERM!=="undefined"&&PERM.schedule);
const isDbMissing=e=>/items_kind_check|check constraint|signup_boards|does not exist|schema cache/i.test((e&&e.message)||String(e||""));
const DB_HELP=`<div class="msg err tm-db">This needs one database update. In Supabase, open <b>SQL Editor → New query</b>, paste the contents of <a href="https://raw.githubusercontent.com/nelsonsurehands-hash/practice-planner/main/supabase/team-tools.sql" target="_blank" rel="noopener">supabase/team-tools.sql</a>, and tap <b>Run</b>. Then reload the app.</div>`;
const byNum=(a,b)=>(parseInt(a.number)||999)-(parseInt(b.number)||999)||String(a.name||"").localeCompare(b.name||"");
const pname=p=>`${p.number?"#"+p.number+" ":""}${p.name||"Player"}`;
const ampm=t=>{if(!t)return "";const [h,m]=t.split(":").map(Number);return `${((h+11)%12)+1}:${String(m).padStart(2,"0")} ${h<12?"AM":"PM"}`;};
const hm=t=>t?ampm(t):"";
const longDay=iso=>dObj(iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const toMin=t=>{const [h,m]=String(t||"0:0").split(":").map(Number);return h*60+(m||0);};
/* Bus time: 90 minutes before the game (same rule as the calendar's Bus mark), or 3:00 PM. */
function busDefault(iso){const g=(SETTINGS.games||[]).find(x=>x.date===iso);if(!g||!g.time)return "15:00";const m=Math.max(0,toMin(g.time)-90);return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");}
const tel=s=>String(s||"").replace(/[^\d+]/g,"");

/* ---------- navigation ---------- */
/* Bus list, Game-day food and the parent calendar link sit together under "Parent Admin". */
const PARENT_PANES={bus:"Bus list",food:"Game-day food",plink:"Calendar link"};
function syncNav(){
  document.querySelectorAll(".tm-nav [data-tm]").forEach(b=>b.setAttribute("aria-selected",b.dataset.tm===pane));
  const pb=$("#tmParentBtn");if(pb){pb.setAttribute("aria-selected",!!PARENT_PANES[pane]);$("#tmParentSub").textContent=PARENT_PANES[pane]?": "+PARENT_PANES[pane]:"";}
  document.querySelectorAll("#tmParentMenu [data-tm]").forEach(b=>b.classList.toggle("on",b.dataset.tm===pane));
  document.querySelectorAll("#view-team .tm-pane").forEach(x=>x.hidden=x.id!=="tm-"+pane);
}
function parentMenu(open){
  const m=$("#tmParentMenu"),b=$("#tmParentBtn");if(!m||!b)return;
  if(open===undefined)open=m.hidden;
  m.hidden=!open;b.setAttribute("aria-expanded",open);
  if(open){const r=b.getBoundingClientRect(),w=Math.min(300,innerWidth-24);
    m.style.width=w+"px";m.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+"px";m.style.top=(r.bottom+6)+"px";}
}
$("#tmParentBtn").addEventListener("click",e=>{e.stopPropagation();parentMenu();});
$("#tmParentMenu").addEventListener("click",e=>{const b=e.target.closest("[data-tm]");if(b){parentMenu(false);showPane(b.dataset.tm);}});
document.addEventListener("click",e=>{if(!e.target.closest("#tmParentMenu,#tmParentBtn"))parentMenu(false);});
addEventListener("scroll",()=>parentMenu(false),{passive:true});$(".tm-nav").addEventListener("scroll",()=>parentMenu(false),{passive:true});addEventListener("resize",()=>parentMenu(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape")parentMenu(false);});
const PANE_FEATURE={game:"game",scout:"scout",stats:"stats",sched:"sched",bus:"bus",food:"food",plink:"plink"};
const paneOn=p=>!PANE_FEATURE[p]||hasFeature(PANE_FEATURE[p]);
window.onFeaturesChange=()=>{if(!paneOn(pane)){pane="teams";if(!$("#view-team").hidden)showPane("teams");}};
function showPane(p){
  pane=p||pane;if(!paneOn(pane))pane="teams";try{localStorage.setItem("cpp:tmPane",pane);}catch{}
  syncNav();
  render();
  if(pane==="food"&&food&&!$("#view-team").hidden)loadFood();   // pick up new sign-ups
}
window.goTeam=(p,opts)=>{if(opts&&opts.date){if(p==="bus")busDate=opts.date;else if(window.TM)TM.date=opts.date;}setTab("team");showPane(p);};
window.onTeamTab=()=>showPane(pane);
$(".tm-nav").addEventListener("click",e=>{const b=e.target.closest("[data-tm]");if(b)showPane(b.dataset.tm);});
document.addEventListener("click",e=>{const b=e.target.closest("[data-goteam]");if(b)window.goTeam(b.dataset.goteam);});
function render(){
  if(typeof team==="undefined"||!team||$("#view-team").hidden)return;
  /* Keep the visible section in step with the remembered one (the app can open straight onto the Team tab). */
  syncNav();
  $("#tmEyebrow").textContent=[team.name,(team.settings||{}).teamLabel].filter(Boolean).join(" · ");
  if(pane==="teams")renderTeams();
  if(pane==="roster")renderRoster();
  if(pane==="staff")renderStaff();
  if(pane==="bus")renderBus();
  if(pane==="sched")renderSched();
  if(pane==="food")renderFood();
  if(TM.panes[pane])TM.panes[pane]();
}
/* If the team opened before this file finished loading (demo mode opens instantly), catch up. */
setTimeout(()=>{if(typeof store!=="undefined"&&store&&openedFor!==store)window.onTeamOpen();},0);
/* Shared with js/gameplan.js (Gameplan and Scouting report sections). */
const TM=window.TM={panes:{},opened:[],date:null,get roster(){return ROSTER;},get pane(){return pane;},can,
  put:(k,id,b)=>put(k,id,b),dbHelp:DB_HELP,isDbMissing,pname,hm,longDay,slug:s=>slug(s),pdfDoc:()=>pdfDoc(),pdfHead:(d,t,s)=>pdfHead(d,t,s),
  needsDb:()=>needsDb,render:()=>render()};

/* ---------- data for the open team ---------- */
let openedFor=null;
window.onTeamOpen=function(){
  openedFor=store;
  unsubs.forEach(u=>{try{u()}catch{}});unsubs=[];ROSTER=[];TRIPS={};busDate=null;rosterEdit=null;food=null;needsDb="";
  unsubs.push(store.collection("players").onSnapshot(s=>{ROSTER=s.docs.map(d=>({id:d.id,...d.data()})).sort(byNum);if(["roster","bus","game","sched"].includes(pane))render();},()=>{}));
  /* Bus lists: redraw only for changes from someone else, so typing here isn't interrupted. */
  unsubs.push(store.collection("trips").onSnapshot(s=>{
    const next=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));
    if(tripTimer&&busDate&&TRIPS[busDate])next[busDate]=TRIPS[busDate];   // keep edits that haven't saved yet
    const changed=JSON.stringify(next)!==JSON.stringify(JSON.parse(JSON.stringify(TRIPS)));
    TRIPS=next;
    if(changed&&(pane==="bus"||pane==="sched")&&!(document.activeElement&&document.activeElement.closest("#tm-bus input,#tm-sched input")))render();
  },()=>{}));
  TM.opened.forEach(f=>{try{f()}catch(e){console.error(e)}});
  render();
};
async function put(kind,id,body){
  try{await store.collection(kind).doc(id).set(body);return true;}
  catch(e){if(isDbMissing(e)){needsDb=kind;render();}else showNotice("Not saved: "+(e.message||"check your connection"));return false;}
}

/* ---------- my teams ---------- */
function teamCard(t){
  const st=t.settings||{},on=t.id===team.id;
  const mark=st.logo?`<img class="sw-logo" src="${esc(st.logo)}" alt="">`:`<span class="sw-dot" style="background:${esc(st.color||"#5b2a86")}${st.color2?`;box-shadow:inset -8px 0 0 ${esc(st.color2)}`:""}"></span>`;
  const games=(st.games||[]).length,season=st.seasonStart?`${longDay(st.seasonStart)} – ${longDay(st.seasonEnd)}`:"No season dates yet";
  return `<article class="tm-tcard${on?" on":""}">${mark}<div class="tm-tinfo"><b>${esc(t.name)}</b>
    <small>${st.teamLabel?esc(st.teamLabel)+" · ":""}${esc(sportName(t))} · ${esc(roleName(t.role))}</small>
    <small>${esc(season)} · ${games} game${games===1?"":"s"}</small></div>
    ${on?`<span class="tm-badge">Open now</span>`:`<button class="btn" data-openteam="${t.id}">Open</button>`}</article>`;
}
/* Teams are grouped by school or club; each grade or level (7th grade, 8th grade, JV…) is its own team. */
const schoolKey=t=>String((t.settings||{}).school||t.name||"").trim().toLowerCase();
function schoolGroups(){
  const m=new Map();
  teams.forEach(t=>{const k=schoolKey(t);if(!m.has(k))m.set(k,[]);m.get(k).push(t);});
  return [...m.values()].map(list=>{
    list.sort((a,b)=>String((a.settings||{}).teamLabel||"").localeCompare(String((b.settings||{}).teamLabel||""),undefined,{numeric:true}));
    const lead=list.find(t=>t.id===team.id)||list[0],st=lead.settings||{};
    return {key:schoolKey(lead),school:st.school||lead.name,mascot:st.mascot||"",lead,list};
  }).sort((a,b)=>(b.list.some(t=>t.id===team.id))-(a.list.some(t=>t.id===team.id))||a.school.localeCompare(b.school));
}
/* Every school shows the same five classes in order. A team belongs to a class by its level name
   ("8th Grade Girls Basketball" is 8th); anything else is listed after them. */
const CLASSES=[{id:"7th",name:"7th",label:"7th Grade",re:/\b7(th)?\b|seventh/i},{id:"8th",name:"8th",label:"8th Grade",re:/\b8(th)?\b|eighth/i},
  {id:"fr",name:"Freshman",label:"Freshman",re:/fresh|\b9(th)?\b|ninth/i},{id:"jv",name:"JV",label:"JV",re:/\bjv\b|junior\s*varsity/i},{id:"v",name:"Varsity",label:"Varsity",re:/varsity/i}];
const classOf=t=>{const l=String((t.settings||{}).teamLabel||"");const c=CLASSES.find(c=>c.re.test(l));return c?c.id:null;};
/* Calendar marks that can carry over to a new team (a school's no-school days and breaks are usually shared). */
const CAL_KINDS=[["noschool","No school days",true],["holiday","Holidays and breaks",true],["nopractice","No-practice days",false],["games","Games",false],
  ["extra","Extra practices",false],["tryout","Tryouts",false],["meeting","Meetings",false],["bus","Bus departures",false],["times","Practice time changes and notes",false]];
function calKind(x){
  const n=String(x.note||"");
  if(x.bus!==undefined||/^bus\b/i.test(n))return "bus";
  if(/tryout/i.test(n))return "tryout";
  if(/meeting/i.test(n))return "meeting";
  if(/no school/i.test(n))return "noschool";
  if(x.kind==="off")return /no practice/i.test(n)?"nopractice":"holiday";
  if(x.kind==="extra")return "extra";
  return "times";
}
function calCounts(st){
  const c={games:(st.games||[]).filter(g=>g.date).length};(st.special||[]).forEach(x=>{if(x.date){const k=calKind(x);c[k]=(c[k]||0)+1;}});return c;
}
let addClassFor=null;   // {key: school, cls: class id or "other"}
function calKindBoxes(src){
  const c=calCounts((src&&src.settings)||{});
  const list=CAL_KINDS.filter(([k])=>c[k]);
  return list.length?list.map(([k,l,on])=>`<label><input type="checkbox" name="cal_${k}"${on?" checked":""}> ${l} <small>(${c[k]})</small></label>`).join(""):`<p class="help" style="margin:0">That team's calendar has no games or marked days yet.</p>`;
}
function addClassForm(g){
  const same=g.list.filter(t=>canEdit(t)),src=same.find(t=>t.id===team.id)||same[0]||g.lead,have=new Set(g.list.map(classOf));
  const first=CLASSES.find(c=>!have.has(c.id));
  return `<form class="rs-form tm-addclass" data-school="${esc(g.key)}">
    <p class="tm-addtitle">Add a team at <b>${esc(g.school)}</b></p>
    <label class="f">Grade or level<select name="cls">${CLASSES.map(c=>`<option value="${c.id}"${have.has(c.id)?" disabled":""}${first&&first.id===c.id?" selected":""}>${esc(c.name)}${have.has(c.id)?" (already set up)":""}</option>`).join("")}<option value="other"${first?"":" selected"}>Other…</option></select></label>
    <label class="f" data-otherwrap${first?" hidden":""}>Team name<input name="label" placeholder="e.g. 8th Grade Boys, C Team" autocomplete="off"></label>
    <label class="f">Sport<select name="sport">${Object.keys(SPORTS).map(k=>`<option value="${k}"${((src.settings||{}).sport||"basketball")===k?" selected":""}>${esc(SPORTS[k].name)}</option>`).join("")}</select></label>
    ${g.list.length?`<label class="f">Start it from<select name="from">${g.list.map(t=>`<option value="${t.id}"${t.id===src.id?" selected":""}>${esc((t.settings||{}).teamLabel||t.name)}</option>`).join("")}<option value="">Nothing, start fresh</option></select></label>`:`<input type="hidden" name="from" value="">`}
    <div class="exp-pick">
      <label><input type="checkbox" name="drills" checked> Drill library</label>
      <label><input type="checkbox" name="plays" checked> Plays (same sport only)</label>
      <label><input type="checkbox" name="sched" checked> Practice days, times and season dates</label>
      <label><input type="checkbox" name="roster"> Roster</label>
    </div>
    <fieldset class="catpick tm-calcopy"><legend>Calendar: carry over from the team above</legend>
      <div class="exp-pick" data-calkinds>${calKindBoxes(src)}</div>
    </fieldset>
    <p class="help" style="margin:0">The school name, colors and logo carry over. Games, practice plans and staff start empty.</p>
    <div class="actions" style="margin:0"><button class="btn primary" type="submit">Create team</button><button class="btn" type="button" data-addclass="">Cancel</button></div>
    <div class="msg" data-addmsg></div></form>`;
}
function renderTeams(){
  const owner=team.role==="owner"||!HOSTED,groups=schoolGroups();
  const row=(t,title)=>{const ts=t.settings||{},on=t.id===team.id,n=(ts.games||[]).length;
    return `<li class="tm-class${on?" on":""}"><div><b>${esc(title)}</b><small>${title!==ts.teamLabel&&ts.teamLabel?esc(ts.teamLabel)+" · ":""}${esc(sportName(t))} · ${n} game${n===1?"":"s"}</small></div>
      ${on?`<span class="tm-badge">Open now</span>`:`<button class="btn" type="button" data-openteam="${t.id}">Open</button>`}</li>`;};
  $("#tm-teams").innerHTML=`<div class="tm-card"><h3 class="tm-h">Schools and teams <small>${teams.length} team${teams.length===1?"":"s"}</small></h3>
    ${groups.map(g=>{const st=g.lead.settings||{},mayAdd=g.list.some(t=>canEdit(t))||!HOSTED,open=addClassFor&&addClassFor.key===g.key;
      const mark=st.logo?`<img class="sw-logo" src="${esc(st.logo)}" alt="">`:`<span class="sw-dot" style="background:${esc(st.color||"#5b2a86")}${st.color2?`;box-shadow:inset -8px 0 0 ${esc(st.color2)}`:""}"></span>`;
      return `<section class="tm-school"><header>${mark}<div><b>${esc([g.school,g.mascot].filter(Boolean).join(" "))}</b><small>${g.list.length} team${g.list.length===1?"":"s"}</small></div></header>
        <ul class="tm-classes">${[...g.list].sort((x,y)=>{const i=t=>{const c=classOf(t);return c?CLASSES.findIndex(k=>k.id===c):99;};return i(x)-i(y);}).map(t=>{const c=CLASSES.find(k=>k.id===classOf(t));return row(t,c&&(t.settings||{}).teamLabel===c.label?c.name:(t.settings||{}).teamLabel||(c?c.name:"Main team"));}).join("")}</ul>
        ${open?addClassForm(g):mayAdd?`<button class="btn" type="button" data-addclass="${esc(g.key)}">+ Add a team at ${esc(g.school)}</button>`:""}
      </section>`;}).join("")}
    <div class="actions" style="margin:12px 0 0"><button class="btn" type="button" id="tmNew">+ Add a different school or club</button>${HOSTED?`<button class="btn" type="button" id="tmJoin">Join another staff with a code</button>`:""}</div>
    <p class="help">Each grade or level is its own team with its own practice plans, plays, drills, calendar, roster and staff. Switch between them here or from the team button at the top.</p></div>
    <div class="tm-card"><h3 class="tm-h">This team</h3>
    <p class="help" style="margin-top:0">Name, colors, logo, season, practice days and games are in Settings.</p>
    <div class="actions" style="margin:0"><button class="btn" type="button" data-tab-go="settings">Team settings</button><button class="btn" type="button" data-goteam="roster">Roster</button><button class="btn" type="button" data-goteam="staff">Staff</button></div>
    ${owner?`<details class="tm-danger"><summary>Delete this team</summary>
      <p class="help">This permanently deletes <b>${esc(team.name)}</b>${HOSTED?" for everyone on the staff":""}: its practice plans, plays, drills, calendar, roster, bus lists and sign-up sheets. Download a backup first (Settings → Backup). Your other teams aren't affected.</p>
      <label class="f">Type the team name to confirm<input id="tmDelName" autocomplete="off" placeholder="${esc(team.name)}"></label>
      <button class="btn danger" type="button" id="tmDel">Delete team forever</button><div class="msg" id="tmDelMsg"></div></details>`:""}</div>`;
}
$("#tm-teams").addEventListener("change",e=>{
  if(e.target.name==="from"){const src=teams.find(t=>t.id===e.target.value);e.target.form.querySelector("[data-calkinds]").innerHTML=src?calKindBoxes(src):`<p class="help" style="margin:0">Starting fresh: the calendar starts empty.</p>`;return;}
  if(e.target.name==="cls"){const w=e.target.form.querySelector("[data-otherwrap]");w.hidden=e.target.value!=="other";if(!w.hidden)w.querySelector("input").focus();}
});
$("#tm-teams").addEventListener("submit",async e=>{
  const f=e.target.closest(".tm-addclass");if(!f)return;e.preventDefault();
  const pick=CLASSES.find(c=>c.id===f.cls.value),label=pick?pick.label:f.label.value.trim();
  if(!label){msg(f.querySelector("[data-addmsg]"),"Type a name for the team.","err");f.label.focus();return;}
  const g=schoolGroups().find(x=>x.key===f.dataset.school),src=teams.find(t=>t.id===f.from.value)||null,base=(src||g.lead).settings||{};
  const sport=f.sport.value,sameSport=src&&((src.settings||{}).sport||"basketball")===sport;
  const cls=CLASSES.find(c=>c.label===label);
  if(cls&&g.list.some(t=>classOf(t)===cls.id)){msg(f.querySelector("[data-addmsg]"),`${g.school} already has a ${cls.name} team.`,"err");return;}
  if(teams.some(t=>schoolKey(t)===g.key&&String((t.settings||{}).teamLabel||"").trim().toLowerCase()===label.toLowerCase())){msg(f.querySelector("[data-addmsg]"),`${g.school} already has a team called ${label}.`,"err");return;}
  const settings={...DEFAULT_SETTINGS,sport,school:base.school||"",mascot:base.mascot||"",teamLabel:label,color:base.color||"#5b2a86"};
  if(src){const want=k=>f.elements["cal_"+k]&&f.elements["cal_"+k].checked,ss=src.settings||{};
    if(want("games"))settings.games=JSON.parse(JSON.stringify(ss.games||[]));
    settings.special=JSON.parse(JSON.stringify((ss.special||[]).filter(x=>x.date&&want(calKind(x)))));}
  ["color2","logo","appIcon","iconBg","iconBgColor","quickAdds"].forEach(k=>{if(base[k]!==undefined)settings[k]=JSON.parse(JSON.stringify(base[k]));});
  if(src&&f.sched.checked)["practiceDays","weekdayStart","weekdayEnd","weekendStart","weekendEnd","seasonStart","seasonEnd","minPractices"].forEach(k=>{if(src.settings&&src.settings[k]!==undefined)settings[k]=JSON.parse(JSON.stringify(src.settings[k]));});
  const kinds=src?[["drills",f.drills.checked],["plays",f.plays.checked&&sameSport],["players",f.roster.checked]].filter(x=>x[1]).map(x=>x[0]):[];
  const btn=f.querySelector("[type=submit]");btn.disabled=true;msg(f.querySelector("[data-addmsg]"),"Creating "+label+"…");
  try{
    const copied={};for(const k of kinds)copied[k]=await readItems(src.id,k);
    const name=[settings.school,settings.mascot].filter(Boolean).join(" ")||label;let t;
    if(HOSTED){
      const {data,error}=await sb.rpc("create_team",{p_name:name,p_settings:settings,p_display_name:(team&&team.myName)||null});
      if(error)throw error;await loadTeams();t=teams.find(x=>x.id===data);if(!t)throw new Error("Team created, but it couldn't be loaded. Reload the app.");
    }else{t={id:"demo-"+uid(),name,settings,role:"owner",join_code:"",viewer_code:""};teams=[...readDemoTeams(),t];writeDemoTeams(teams);}
    addClassFor=null;await openTeam(t);
    for(const k of Object.keys(copied))if(copied[k].length)await store.bulkSet(k,copied[k].map(([id,d])=>[id,{...d,copiedFrom:(src.settings||{}).teamLabel||src.name}]));
    showPane("teams");
    const nCal=(settings.games||[]).length+(settings.special||[]).length;
    const parts=Object.entries(copied).filter(([k,v])=>v.length).map(([k,v])=>`${v.length} ${k==="players"?"players":k}`);if(nCal)parts.push(`${nCal} calendar item${nCal===1?"":"s"}`);
    showNotice(`${label} is ready.${parts.length?` Carried over from ${(src.settings||{}).teamLabel||src.name}: ${parts.join(", ")}.`:""}${(settings.games||[]).length?"":" Add its games in the Calendar tab."}`);
  }catch(err){btn.disabled=false;msg(f.querySelector("[data-addmsg]"),err.message||String(err),"err");}
});
$("#tm-teams").addEventListener("click",async e=>{
  const o=e.target.closest("[data-openteam]");
  if(o){const t=teams.find(x=>x.id===o.dataset.openteam);if(t){await openTeam(t);showPane("teams");}return;}
  if(e.target.closest("[data-tab-go]")){setTab(e.target.closest("[data-tab-go]").dataset.tabGo);return;}
  if(e.target.id==="tmNew"||e.target.id==="tmJoin"){showSetup(true,e.target.id==="tmJoin");return;}
  const ac=e.target.closest("[data-addclass]");
  if(ac){addClassFor=ac.dataset.addclass?{key:ac.dataset.addclass}:null;renderTeams();
    const f=document.querySelector(".tm-addclass");if(f)f.scrollIntoView({behavior:"smooth",block:"nearest"});return;}
  if(e.target.id==="tmDel"){
    if($("#tmDelName").value.trim().toLowerCase()!==team.name.trim().toLowerCase()){msg($("#tmDelMsg"),"Type the team name exactly to confirm.","err");return;}
    e.target.disabled=true;msg($("#tmDelMsg"),"Deleting…");
    const id=team.id;
    if(HOSTED){
      const {data,error}=await sb.from("teams").delete().eq("id",id).select("id");
      if(error||!data||!data.length){e.target.disabled=false;msg($("#tmDelMsg"),error?error.message:"Only a head coach can delete the team.","err");return;}
    }else{
      writeDemoTeams(readDemoTeams().filter(t=>t.id!==id));
      try{Object.keys(localStorage).filter(k=>k.startsWith(`cpp:${id}:`)||k===`cpp:food:${id}`).forEach(k=>localStorage.removeItem(k));}catch{}
    }
    await loadTeams();
    if(teams.length){await openTeam(teams[0]);showPane("teams");showNotice("Team deleted.");}else showSetup(false);
  }
});

/* ---------- roster ---------- */
function playerForm(p){
  p=p||{};
  return `<form class="rs-form" data-pid="${esc(p.id||"")}">
    <div class="rs-grid">
      <label class="f rs-n">Jersey #<input name="number" inputmode="numeric" value="${esc(p.number||"")}" maxlength="3"></label>
      <label class="f rs-name">Player name<input name="name" required value="${esc(p.name||"")}" placeholder="First and last name" autocomplete="off"></label>
      <label class="f">Grade or position<input name="pos" value="${esc(p.pos||"")}" placeholder="e.g. 8th · Guard"></label>
      <label class="f">Parent or guardian<input name="parent" value="${esc(p.parent||"")}" autocomplete="off"></label>
      <label class="f">Parent phone<input name="phone" type="tel" value="${esc(p.phone||"")}" autocomplete="off"></label>
      <label class="f">Parent email<input name="email" type="email" value="${esc(p.email||"")}" autocomplete="off"></label>
      <label class="f">Second contact<input name="parent2" value="${esc(p.parent2||"")}" placeholder="Name"></label>
      <label class="f">Second contact phone<input name="phone2" type="tel" value="${esc(p.phone2||"")}"></label>
    </div>
    <label class="f">Notes<input name="notes" value="${esc(p.notes||"")}" placeholder="Anything the staff should know"></label>
    <div class="actions" style="margin:4px 0 0"><button class="btn primary" type="submit">${p.id?"Save":"Add player"}</button><button class="btn" type="button" data-rsact="cancel">Cancel</button>${p.id?`<button class="btn danger" type="button" data-rsact="del" data-pid="${esc(p.id)}">Remove from roster</button>`:""}</div>
  </form>`;
}
function renderRoster(){
  const box=$("#tm-roster");
  if(HOSTED&&!can()&&!["owner","coach"].includes(team.role)){box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Roster</h3><p class="help">The roster has parent phone numbers and emails, so only coaches can see it.</p></div>`;return;}
  const ed=can(),emails=[...new Set(ROSTER.map(p=>p.email).filter(Boolean))];
  box.innerHTML=(needsDb==="players"?DB_HELP:"")+`<div class="tm-card"><h3 class="tm-h">Roster <small>${ROSTER.length} player${ROSTER.length===1?"":"s"}</small></h3>
    ${ed?`<div class="actions" style="margin:0 0 10px"><button class="btn primary" type="button" data-rsact="add">+ Add player</button><button class="btn" type="button" data-rsact="paste">Paste a list</button><button class="btn" type="button" data-photo="roster">📷 From a photo</button>${ROSTER.length?`<button class="btn" type="button" data-rsact="print">Print roster</button><button class="btn" type="button" data-rsact="select">Select players</button>`:""}${emails.length?`<button class="btn" type="button" data-rsact="emails">Copy parent emails</button>`:""}</div>`:""}
    ${rsSel&&ed?`<div class="rs-selbar"><span><b>${rsSel.size}</b> selected</span><button class="btn" type="button" data-rsact="selall">${rsSel.size===ROSTER.length?"Select none":"Select all"}</button>
      <button class="btn danger" type="button" data-rsact="delsel"${rsSel.size?"":" disabled"}>Remove ${rsSel.size||""} from roster</button><button class="btn" type="button" data-rsact="selcancel">Done</button></div>`:""}
    <div id="rsNew">${rosterEdit==="new"?playerForm():rosterEdit==="paste"?pasteForm():""}</div>
    ${ROSTER.length?`<ul class="rs-list">${ROSTER.map(p=>rosterEdit===p.id?`<li class="rs-row editing">${playerForm(p)}</li>`:
      `<li class="rs-row${rsSel?" selecting":""}${rsSel&&rsSel.has(p.id)?" sel":""}"${rsSel?` data-rspick="${esc(p.id)}"`:""}>${rsSel?`<label class="rs-chk"><input type="checkbox" data-rspick="${esc(p.id)}"${rsSel.has(p.id)?" checked":""} aria-label="Select ${esc(p.name||"player")}"></label>`:""}<span class="rs-num">${esc(p.number||"–")}</span><div class="rs-who"><b>${esc(p.name||"")}</b>${p.pos?` <span class="rs-pos">${esc(p.pos)}</span>`:""}
        <small>${[p.parent,p.phone?`<a href="tel:${esc(tel(p.phone))}">${esc(p.phone)}</a>`:"",p.email?`<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`:""].filter(Boolean).join(" · ")||"No parent contact yet"}</small>
        ${p.parent2||p.phone2?`<small>${esc(p.parent2||"")}${p.phone2?` · <a href="tel:${esc(tel(p.phone2))}">${esc(p.phone2)}</a>`:""}</small>`:""}
        ${p.notes?`<small class="rs-note">${esc(p.notes)}</small>`:""}</div>
        ${ed&&!rsSel?`<span class="rs-acts"><button class="btn" type="button" data-rsact="edit" data-pid="${esc(p.id)}">Edit</button><button class="icon rs-del" type="button" data-rsact="del" data-pid="${esc(p.id)}" aria-label="Remove ${esc(p.name||"player")}" title="Remove from roster">🗑</button></span>`:""}</li>`).join("")}</ul>`:
      `<p class="help">No players yet. Add them one at a time, or paste a list from a spreadsheet or your notes. The roster is used for bus lists, and parents can pick their player on the food sign-up.</p>`}
    <div class="msg" id="rsMsg"></div></div>`;
}
function pasteForm(){
  return `<form class="rs-form" id="rsPaste"><label class="f">One player per line<textarea name="list" rows="7" placeholder="12 Ava Smith&#10;3 Maya Jones, Kim Jones, 417-555-0101, kim@email.com&#10;Lily Brown"></textarea></label>
  <p class="help">Start a line with the jersey number if you like. You can also paste rows from a spreadsheet in this order: number, player, parent, phone, email.</p>
  <div class="actions" style="margin:0"><button class="btn primary" type="submit">Add players</button><button class="btn" type="button" data-rsact="cancel">Cancel</button></div></form>`;
}
function parseList(text){
  return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
    let cols=l.includes("\t")?l.split("\t"):l.split(/\s*,\s*/);cols=cols.map(c=>c.trim());
    let number="",name=cols[0]||"";
    if(/^#?\d{1,3}$/.test(name)&&cols.length>1){number=name.replace("#","");cols.shift();name=cols[0];}
    else{const m=/^#?(\d{1,3})[\s.)-]+(.+)$/.exec(name);if(m){number=m[1];name=m[2];}}
    if(/^(name|player|#|number|no\.?)$/i.test(name))return null;   // header row
    return name?{number,name,parent:cols[1]||"",phone:cols[2]||"",email:cols[3]||""}:null;
  }).filter(Boolean);
}
$("#tm-roster").addEventListener("click",async e=>{
  const pk=!e.target.closest("a,[data-rsact]")&&e.target.closest("[data-rspick]");
  if(pk&&rsSel){const id=pk.dataset.rspick;if(e.target.matches("input[type=checkbox]")){if(e.target.checked)rsSel.add(id);else rsSel.delete(id);}else{if(rsSel.has(id))rsSel.delete(id);else rsSel.add(id);}renderRoster();return;}
  const b=e.target.closest("[data-rsact]");if(!b)return;
  const a=b.dataset.rsact;
  if(a==="add"){rosterEdit="new";renderRoster();$("#rsNew [name=name]").focus();}
  if(a==="paste"){rosterEdit="paste";renderRoster();$("#rsPaste textarea").focus();}
  if(a==="edit"){rosterEdit=b.dataset.pid;renderRoster();}
  if(a==="cancel"){rosterEdit=null;renderRoster();}
  if(a==="select"){rsSel=new Set();rosterEdit=null;renderRoster();return;}
  if(a==="selcancel"){rsSel=null;renderRoster();return;}
  if(a==="selall"){rsSel=rsSel.size===ROSTER.length?new Set():new Set(ROSTER.map(p=>p.id));renderRoster();return;}
  if(a==="delsel"){
    if(!rsSel||!rsSel.size)return;
    if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent=`Tap again to remove ${rsSel.size} player${rsSel.size===1?"":"s"}`;return;}
    b.disabled=true;let n=0;
    for(const id of [...rsSel]){try{await store.collection("players").doc(id).delete();n++;}catch(err){msg($("#rsMsg"),"Stopped: "+err.message,"err");break;}}
    rsSel=null;renderRoster();if(n)msg($("#rsMsg"),`Removed ${n} player${n===1?"":"s"} from the roster.`,"ok");return;
  }
  if(a==="del"){
    if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent=b.classList.contains("rs-del")?"Remove?":"Tap again to remove";b.classList.add("armed");return;}
    try{await store.collection("players").doc(b.dataset.pid).delete();rosterEdit=null;}catch(err){msg($("#rsMsg"),err.message,"err");}
  }
  if(a==="emails"){const list=[...new Set(ROSTER.map(p=>p.email).filter(Boolean))].join(", ");
    try{await navigator.clipboard.writeText(list);msg($("#rsMsg"),`Copied ${list.split(",").length} parent emails. Paste them into the To or Bcc line.`,"ok");}catch{msg($("#rsMsg"),list,"ok");}}
  if(a==="print")printRoster();
});
$("#tm-roster").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target;
  if(f.id==="rsPaste"){
    const list=parseList(f.list.value);if(!list.length)return;
    const now=Date.now();let ok=0;
    for(const [i,p] of list.entries()){if(await put("players","p-"+uid(),{...p,createdAt:now+i}))ok++;else break;}
    rosterEdit=null;renderRoster();if(ok)msg($("#rsMsg"),`Added ${ok} player${ok===1?"":"s"}.`,"ok");return;
  }
  const d=Object.fromEntries(new FormData(f).entries());Object.keys(d).forEach(k=>d[k]=d[k].trim());
  if(!d.name)return;
  const id=f.dataset.pid||"p-"+uid(),old=ROSTER.find(p=>p.id===id)||{createdAt:Date.now()};
  if(await put("players",id,{...old,...d,id:undefined})){rosterEdit=null;renderRoster();}
});
function pdfDoc(){const {jsPDF}=window.jspdf;return new jsPDF({unit:"pt",format:"letter"});}
function pdfHead(doc,title,sub){
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text(title,40,50);
  doc.setFont("helvetica","normal");doc.setFontSize(10.5);doc.setTextColor(90);doc.text(sub,40,68);doc.setTextColor(0);
  doc.setLineWidth(1.5);doc.line(40,78,572,78);return 98;
}
function printRoster(){
  const doc=pdfDoc();let y=pdfHead(doc,`${team.name} roster`,[(team.settings||{}).teamLabel,`${ROSTER.length} players`,`Printed ${longDay(todayISO())}`].filter(Boolean).join(" · "));
  const cols=[40,72,220,350,452];
  doc.setFont("helvetica","bold");doc.setFontSize(9.5);["#","Player","Parent / guardian","Phone","Email"].forEach((h,i)=>doc.text(h,cols[i],y));y+=14;
  doc.setFont("helvetica","normal");doc.setFontSize(10);
  ROSTER.forEach(p=>{
    if(y>740){doc.addPage();y=50;}
    doc.text(String(p.number||""),cols[0],y);doc.text(doc.splitTextToSize(p.name||"",140)[0],cols[1],y);
    doc.text(doc.splitTextToSize(p.parent||"",124)[0],cols[2],y);doc.text(p.phone||"",cols[3],y);doc.text(doc.splitTextToSize(p.email||"",120)[0],cols[4],y);
    if(p.parent2||p.phone2){y+=12;doc.setTextColor(90);doc.text(doc.splitTextToSize(p.parent2||"",124)[0],cols[2],y);doc.text(p.phone2||"",cols[3],y);doc.setTextColor(0);}
    y+=6;doc.setDrawColor(210);doc.line(40,y,572,y);doc.setDrawColor(0);y+=13;
  });
  doc.save(`${slug(team.name)}-roster.pdf`);
}
const slug=s=>String(s||"team").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

/* ---------- season schedule: every game, with the bus for away games ---------- */
let schedFilter="upcoming";try{schedFilter=localStorage.getItem("cpp:schedFilter")||"upcoming";}catch{}
const allGames=()=>(SETTINGS.games||[]).filter(g=>g.date).sort((a,b)=>a.date<b.date?-1:1);
const busSet=iso=>!!((TRIPS[iso]||{}).depart||calBus(iso));
function resultTxt(iso){const r=((TM.plans||{})[iso]||{}).result||{};if(r.us===""||r.us==null||r.them===""||r.them==null)return "";const u=+r.us,t=+r.them;return `${u>t?"W":u<t?"L":"T"} ${u}–${t}`;}
/* Pre-game food for a game on the Schedule: when it needs to be there, and who's bringing it. */
function foodBlock(g,dis){
  const b=food&&food.board;if(!b||!b.active)return "";
  if(!foodGames(b).some(x=>x.date===g.date))return "";
  if((b.skip||[]).includes(g.date))return `<div class="sch-food off"><span class="sch-fi">🍕</span><span>No food needed for this game</span></div>`;
  const d=dropFor(b,g),bus=g.home===false?busTimeFor(g.date):"";
  const ent=food.entries.filter(e=>(e.game_date||"").slice(0,10)===g.date),cap=(b.slots||[]).reduce((n,s)=>n+s.count,0);
  return `<div class="sch-food"><span class="sch-fi">🍕</span>
    <label class="f">Food arrives by<input type="time" data-schfood="${g.date}" value="${esc(d.time)}"${dis}></label>
    <div class="sch-bi">${!d.time?`<span class="sch-sug">Not set: parents see “time coming soon”</span>`:g.home!==false&&!d.custom?`<span>Home game time</span>`:""}
      ${bus&&bus!==d.time&&!dis?`<button type="button" class="linkbtn" data-schfbus="${g.date}" data-time="${bus}">Use bus time (${hm(bus)})</button>`:""}
      ${ent.length?ent.map(e=>`<span class="ok">✓ ${esc(e.name)}${e.item?` · ${esc(e.item)}`:""}</span>`).join(""):`<span class="sch-need">No one signed up yet</span>`}
      ${ent.length&&ent.length<cap?`<span>${cap-ent.length} spot${cap-ent.length===1?"":"s"} open</span>`:""}</div></div>`;
}
function renderSched(){
  const box=$("#tm-sched"),today=todayISO(),ed=can(),dis=ed?"":" disabled",all=allGames();
  if(!food&&hasFeature("food")){loadFood();}
  if(!all.length){box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Schedule</h3><p class="help">No games yet. Add games in the Calendar tab and they show up here, with the bus for every away game.</p></div>`;return;}
  const list=all.filter(g=>schedFilter==="all"||(schedFilter==="away"?g.home===false:g.date>=today));
  const away=all.filter(g=>g.home===false),missing=away.filter(g=>g.date>=today&&!busSet(g.date)).length;
  const row=g=>{
    const d=dObj(g.date),past=g.date<today,res=resultTxt(g.date),isAway=g.home===false;
    let bus="";
    if(isAway&&hasFeature("bus")){const t=tripFor(g.date),set=busSet(g.date);
      const riding=ROSTER.filter(p=>status(t,p)==="bus").length,own=ROSTER.filter(p=>status(t,p)==="own").length,out=ROSTER.filter(p=>status(t,p)==="out").length;
      const on=Object.values(t.boarded||{}).filter(Boolean).length;
      bus=`<div class="sch-bus">
        <label class="f">Bus departs<input type="time" data-sch="depart" data-date="${g.date}" value="${esc(t.depart||"")}"${dis}></label>
        <label class="f">Back about<input type="time" data-sch="return" data-date="${g.date}" value="${esc(t.return||"")}"${dis}></label>
        <div class="sch-bi">${set?"":`<span class="sch-sug">Suggested time: 90 min before the game</span>`}${t.from?`<span>From ${esc(t.from)}</span>`:""}${t.driver?`<span>Bus ${esc(t.driver)}</span>`:""}
          ${ROSTER.length?`<span><b>${riding}</b> on the bus</span>${own?`<span><b>${own}</b> own ride</span>`:""}${out?`<span><b>${out}</b> not going</span>`:""}${on?`<span class="ok"><b>${on}</b> checked in</span>`:""}`:""}</div>
        <button type="button" class="btn" data-schbus="${g.date}">Bus list ›</button></div>`;}
    const fb=hasFeature("food")?foodBlock(g,dis):"";
    return `<article class="sch-row${past?" past":""}${isAway?" away":" home"}${g.date===today?" today":""}">
      <div class="sch-date"><small>${DOWS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MONS[d.getMonth()]}</small></div>
      <div class="sch-main"><div class="sch-top"><span class="sch-pill">${isAway?"Away":"Home"}</span><b class="sch-opp">${isAway?"at":"vs"} ${esc(g.opponent||"Game")}</b>${res?`<span class="sch-res ${res[0]}">${res}</span>`:""}</div>
        <div class="sch-meta">${g.time?`Game ${hm(g.time)}`:"Game time TBD"}${g.date===today?" · <b>Today</b>":""}</div>
        ${bus}${fb}
        <div class="sch-links"><button type="button" class="linkbtn" data-schgp="${g.date}">Gameplan</button>${g.date>=today||res?"":`<button type="button" class="linkbtn" data-schgp="${g.date}">Add the score</button>`}</div></div></article>`;};
  box.innerHTML=(needsDb==="trips"?DB_HELP:"")+`<div class="tm-card sch-head"><h3 class="tm-h">Schedule <small>${all.length} games · ${away.length} away</small></h3>
    <p class="help" style="margin-top:0">Every game in one place: the bus for away games and when the pre-game food needs to be there. Times you set here update the Bus list, the food sign-up parents see, and the calendar.</p>
    ${missing?`<p class="sch-warn">${missing} upcoming away game${missing===1?" doesn't":"s don't"} have a bus time yet.</p>`:""}
    ${food&&!food.err&&(!food.board||!food.board.active)?`<p class="help">Pre-game food shows here once the <button type="button" class="linkbtn" data-goteam="food">Game-day food sign-up</button> is on.</p>`:""}
    <div class="sch-bar"><div class="seg" role="group" aria-label="Show">${[["upcoming","Upcoming"],["away","Away games"],["all","All games"]].map(([k,l])=>`<button type="button" data-schf="${k}" aria-pressed="${schedFilter===k}">${l}</button>`).join("")}</div>
      <div class="sch-act"><button type="button" class="btn" data-schact="pdf">Print schedule</button><button type="button" class="btn" data-schact="text">Copy as text</button></div></div>
    <div class="msg" id="schMsg"></div></div>
    ${list.length?list.map(row).join(""):`<div class="tm-card"><p class="help">No upcoming games. Tap All games to see the season.</p></div>`}`;
}
const DOWS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],MONS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const schedFood=g=>{const b=food&&food.board;if(!b||!b.active||(b.skip||[]).includes(g.date)||!foodGames(b).some(x=>x.date===g.date))return "";return dropFor(b,g).time;};
function schedLines(){
  return allGames().map(g=>{const t=g.home===false?tripFor(g.date):null;
    const ft=schedFood(g);
    return `${longDay(g.date)}: ${g.home===false?"at":"vs"} ${g.opponent||"Game"}${g.time?", game "+hm(g.time):", time TBD"}${t?` · bus leaves ${hm(t.depart)}${t.return?", back about "+hm(t.return):""}${t.from?" from "+t.from:""}`:" (home)"}${ft?` · food by ${hm(ft)}`:""}`;});
}
function printSched(){
  const doc=pdfDoc();let y=pdfHead(doc,"Game & Bus Schedule",[team.name,(team.settings||{}).teamLabel].filter(Boolean).join(" · "));
  const cols=[40,125,280,322,382,450,512];
  doc.setFont("helvetica","bold");doc.setFontSize(9);["DATE","OPPONENT","","GAME","BUS LEAVES","BACK","FOOD BY"].forEach((h,i)=>doc.text(h,cols[i],y));y+=5;doc.line(40,y,572,y);y+=15;
  doc.setFont("helvetica","normal");doc.setFontSize(10);
  allGames().forEach(g=>{if(y>740){doc.addPage();y=50;}const t=g.home===false?tripFor(g.date):null;
    doc.setFont("helvetica","normal");doc.text(longDay(g.date),cols[0],y);doc.setFont("helvetica","bold");doc.text(String((g.home===false?"at ":"vs ")+(g.opponent||"Game")).slice(0,28),cols[1],y);
    doc.setFont("helvetica","normal");doc.text(g.home===false?"Away":"Home",cols[2],y);doc.text(hm(g.time)||"TBD",cols[3],y);
    const ft=schedFood(g);if(ft)doc.text(hm(ft),cols[6],y);
    if(t){doc.setFont("helvetica","bold");doc.text(hm(t.depart)||"",cols[4],y);doc.setFont("helvetica","normal");doc.text(hm(t.return)||"",cols[5],y);
      if(t.from){y+=12;doc.setFontSize(8.5);doc.setTextColor(110);doc.text("Leaves from "+t.from,cols[4],y);doc.setTextColor(0);doc.setFontSize(10);}}
    y+=7;doc.setDrawColor(220);doc.line(40,y,572,y);doc.setDrawColor(0);y+=14;});
  doc.save(`${slug(team.name)}-game-bus-schedule.pdf`);
}
$("#tm-sched").addEventListener("click",async e=>{
  const f=e.target.closest("[data-schf]");if(f){schedFilter=f.dataset.schf;try{localStorage.setItem("cpp:schedFilter",schedFilter);}catch{}renderSched();return;}
  const b=e.target.closest("[data-schbus]");if(b){busDate=b.dataset.schbus;showPane("bus");scrollTo(0,0);return;}
  const fbus=e.target.closest("[data-schfbus]");if(fbus&&can()){setDrop(fbus.dataset.schfbus,fbus.dataset.time,"sched");return;}
  const gp=e.target.closest("[data-schgp]");if(gp){window.goTeam("game",{date:gp.dataset.schgp});scrollTo(0,0);return;}
  const a=e.target.closest("[data-schact]");if(!a)return;
  if(a.dataset.schact==="pdf")printSched();
  if(a.dataset.schact==="text"){const txt=`${team.name} games\n`+schedLines().join("\n");try{await navigator.clipboard.writeText(txt);msg($("#schMsg"),"Copied. Paste it into a text or email.","ok");}catch{msg($("#schMsg"),"Couldn't copy here.","err");}}
});
$("#tm-sched").addEventListener("change",e=>{
  const ft=e.target.closest("[data-schfood]");if(ft&&can()&&food&&food.board){setDrop(ft.dataset.schfood,ft.value,"sched");return;}
  const f=e.target.closest("[data-sch]");if(!f||!can())return;const iso=f.dataset.date;
  busDate=iso;const t=tripFor(iso);t[f.dataset.sch]=f.value;saveTrip(t,true);
  if(f.dataset.sch==="depart")syncCalendarBus(iso,f.value);
  setTimeout(renderSched,50);
});

/* ---------- bus list for away games ---------- */
const awayGames=()=>(SETTINGS.games||[]).filter(g=>g.date&&g.home===false).sort((a,b)=>a.date<b.date?-1:1);
const calBus=iso=>((SETTINGS.special||[]).find(x=>x.date===iso&&x.bus)||{}).bus||"";
function tripFor(iso){
  const t=JSON.parse(JSON.stringify(TRIPS[iso]||{}));
  t.riders=t.riders||{};t.boarded=t.boarded||{};t.back=t.back||{};
  if(!t.depart)t.depart=calBus(iso)||busDefault(iso);
  if(t.from===undefined){const prev=Object.values(TRIPS).find(x=>x.from);t.from=prev?prev.from:"";}
  return t;
}
const status=(t,p)=>t.riders[p.id]||"bus";
function renderBus(){
  const box=$("#tm-bus"),games=awayGames(),today=todayISO();
  if(!games.length){box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Bus list</h3><p class="help">No away games on the calendar yet. Add a game in the Calendar tab and set it to Away, and it shows up here.</p></div>`;return;}
  if(!busDate||!games.some(g=>g.date===busDate))busDate=(games.find(g=>g.date>=today)||games[games.length-1]).date;
  const g=games.find(x=>x.date===busDate),t=tripFor(busDate),ed=can();
  const riding=ROSTER.filter(p=>status(t,p)==="bus"),own=ROSTER.filter(p=>status(t,p)==="own"),out=ROSTER.filter(p=>status(t,p)==="out");
  const on=riding.filter(p=>t.boarded[p.id]).length,home=riding.filter(p=>t.back[p.id]).length;
  const dis=ed?"":" disabled";
  const seg=(p,s)=>`<div class="seg rd-seg" role="group" aria-label="Ride for ${esc(p.name)}">${[["bus","Bus"],["own","Own ride"],["out","Not going"]].map(([v,l])=>`<button type="button" data-ride="${v}" data-pid="${esc(p.id)}" aria-pressed="${s===v}"${dis}>${l}</button>`).join("")}</div>`;
  box.innerHTML=(needsDb==="trips"?DB_HELP:"")+`<div class="bus-games" role="list">${games.map(x=>`<button type="button" class="bus-g${x.date===busDate?" on":""}${x.date<today?" past":""}" data-busg="${x.date}"><b>${esc(longDay(x.date))}</b><small>at ${esc(x.opponent||"Game")}</small></button>`).join("")}</div>
  <div class="tm-card bus-card">
    <h3 class="tm-h">at ${esc(g.opponent||"Game")} <small>${esc(longDay(g.date))}${g.time?" · game "+hm(g.time):""}</small></h3>
    <div class="bus-grid">
      <label class="f">Bus departs<input type="time" data-trip="depart" value="${esc(t.depart||"")}"${dis}></label>
      <label class="f">Back at school about<input type="time" data-trip="return" value="${esc(t.return||"")}"${dis}></label>
      <label class="f">Leave from<input data-trip="from" value="${esc(t.from||"")}" placeholder="e.g. Front lot by the gym"${dis}></label>
      <label class="f">Bus # or driver<input data-trip="driver" value="${esc(t.driver||"")}"${dis}></label>
      <label class="f bus-wide">Coaches and chaperones riding<input data-trip="adults" value="${esc(t.adults||"")}" placeholder="e.g. Coach Cornelison, Coach Lee"${dis}></label>
      <label class="f bus-wide">Notes<input data-trip="notes" value="${esc(t.notes||"")}" placeholder="e.g. Wear warm-ups, bring a sack dinner"${dis}></label>
    </div>
    <p class="help bus-sync">${calBus(busDate)?"The departure time shows on the calendar too.":"Changing the departure time adds a Bus mark to this day on the calendar."}</p>
    ${ROSTER.length?`<div class="bus-sum"><span><b>${riding.length}</b> on the bus</span><span><b>${own.length}</b> own ride</span><span><b>${out.length}</b> not going</span>
      <span class="bus-hc${on===riding.length&&riding.length?" ok":""}">Leaving: <b>${on}</b> of ${riding.length} checked in</span>${home?`<span class="bus-hc${home===riding.length?" ok":""}">Coming home: <b>${home}</b> of ${riding.length}</span>`:""}</div>
    <div class="bus-mode seg" role="group" aria-label="Head count"><button type="button" data-hc="out" aria-pressed="${(t.hc||"out")==="out"}">Check in: leaving</button><button type="button" data-hc="back" aria-pressed="${t.hc==="back"}">Check in: coming home</button></div>
    <ul class="bus-list">${ROSTER.map(p=>{const s=status(t,p),k=(t.hc||"out")==="back"?"back":"boarded";
      return `<li class="bus-row s-${s}">${s==="bus"?`<label class="bus-chk"><input type="checkbox" data-board="${esc(p.id)}"${t[k][p.id]?" checked":""}><span class="sr">On the bus</span></label>`:`<span class="bus-chk none"></span>`}
        <div class="bus-who"><b>${esc(pname(p))}</b>${p.phone?`<small><a href="tel:${esc(tel(p.phone))}">${esc(p.parent||"Parent")} ${esc(p.phone)}</a></small>`:""}</div>${seg(p,s)}</li>`;}).join("")}</ul>
    <div class="actions" style="margin:12px 0 0"><button class="btn primary" type="button" data-busact="pdf">Print bus list</button><button class="btn" type="button" data-busact="text">Copy as text</button>${ed&&(on||home)?`<button class="btn" type="button" data-busact="clear">Clear check-ins</button>`:""}</div>`:
    `<p class="help">Add your players on the <button type="button" class="linkbtn" data-goteam="roster">Roster</button> page and they'll show up here, ready to check onto the bus.</p>`}
    <div class="msg" id="busMsg"></div>
  </div>`;
}
function saveTrip(t,now){
  TRIPS[busDate]={...t,date:busDate,opponent:(awayGames().find(g=>g.date===busDate)||{}).opponent||""};
  clearTimeout(tripTimer);const iso=busDate,body=TRIPS[iso];
  const go=()=>{tripTimer=null;put("trips",iso,body);};
  if(now)go();else tripTimer=setTimeout(go,500);
}
async function syncCalendarBus(iso,time){
  if(!time||!PERM.schedule)return;
  const st=JSON.parse(JSON.stringify(team.settings||{}));st.special=st.special||[];
  const x=st.special.find(s=>s.date===iso&&s.bus);
  if(x){if(x.bus===time)return;x.bus=time;x.note="Bus departs "+ampm(time);}else st.special.push({date:iso,kind:"note",note:"Bus departs "+ampm(time),bus:time});
  try{await saveSettings(st);if(window.onCalChange)window.onCalChange();}catch{}
}
$("#tm-bus").addEventListener("click",e=>{
  const g=e.target.closest("[data-busg]");if(g){busDate=g.dataset.busg;renderBus();return;}
  if(!busDate)return;
  const t=tripFor(busDate);
  const r=e.target.closest("[data-ride]");
  if(r&&can()){t.riders[r.dataset.pid]=r.dataset.ride;if(r.dataset.ride!=="bus"){delete t.boarded[r.dataset.pid];delete t.back[r.dataset.pid];}saveTrip(t,true);renderBus();return;}
  const h=e.target.closest("[data-hc]");if(h){t.hc=h.dataset.hc;saveTrip(t,true);renderBus();return;}
  const a=e.target.closest("[data-busact]");if(!a)return;
  if(a.dataset.busact==="clear"){t.boarded={};t.back={};saveTrip(t,true);renderBus();}
  if(a.dataset.busact==="pdf")printBus(t);
  if(a.dataset.busact==="text"){const txt=busText(t);
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>msg($("#busMsg"),"Copied. Paste it into a text or email.","ok"),()=>msg($("#busMsg"),txt,"ok"));}
});
$("#tm-bus").addEventListener("change",e=>{
  if(!busDate)return;const t=tripFor(busDate);
  const b=e.target.closest("[data-board]");
  if(b){const k=(t.hc||"out")==="back"?"back":"boarded";if(b.checked)t[k][b.dataset.board]=true;else delete t[k][b.dataset.board];saveTrip(t,true);renderBus();return;}
  const f=e.target.closest("[data-trip]");
  if(f&&can()){t[f.dataset.trip]=f.value.trim();saveTrip(t,true);if(f.dataset.trip==="depart")syncCalendarBus(busDate,f.value);}
});
$("#tm-bus").addEventListener("input",e=>{
  const f=e.target.closest("[data-trip]");if(!f||!busDate||!can())return;
  const t=tripFor(busDate);t[f.dataset.trip]=f.value;saveTrip(t);
});
function busLines(t){
  const g=awayGames().find(x=>x.date===busDate)||{};
  return {g,riding:ROSTER.filter(p=>status(t,p)==="bus"),own:ROSTER.filter(p=>status(t,p)==="own"),out:ROSTER.filter(p=>status(t,p)==="out")};
}
function busText(t){
  const {g,riding,own,out}=busLines(t);
  return [`${team.name}: bus to ${g.opponent||"the game"}`,`${longDay(busDate)}${g.time?" · game "+hm(g.time):""}`,
    `Bus departs ${hm(t.depart)}${t.from?" from "+t.from:""}${t.return?" · back about "+hm(t.return):""}`,
    t.adults?`Riding: ${t.adults}`:"",t.notes||"","",
    `On the bus (${riding.length}):`,...riding.map(p=>"  "+pname(p)),
    own.length?`\nOwn ride (${own.length}):\n`+own.map(p=>"  "+pname(p)).join("\n"):"",
    out.length?`\nNot going (${out.length}):\n`+out.map(p=>"  "+pname(p)).join("\n"):""].filter((x,i)=>x!==""||i===5).join("\n");
}
function printBus(t){
  const {g,riding,own,out}=busLines(t),doc=pdfDoc();
  let y=pdfHead(doc,`Bus list: at ${g.opponent||"Game"}`,[team.name,(team.settings||{}).teamLabel,longDay(busDate)+(g.time?" · game "+hm(g.time):"")].filter(Boolean).join(" · "));
  doc.setFontSize(11);
  const info=[["Departs",`${hm(t.depart)}${t.from?" from "+t.from:""}`],["Back about",hm(t.return)],["Bus / driver",t.driver],["Coaches & chaperones",t.adults],["Notes",t.notes]].filter(x=>x[1]);
  info.forEach(([k,v])=>{doc.setFont("helvetica","bold");doc.text(k,40,y);doc.setFont("helvetica","normal");doc.splitTextToSize(v,400).forEach((l,i)=>doc.text(l,160,y+i*13));y+=Math.max(1,doc.splitTextToSize(v,400).length)*13+3;});
  y+=10;doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text(`On the bus (${riding.length})`,40,y);
  doc.setFontSize(9);doc.text("Leaving",392,y);doc.text("Return",442,y);y+=16;
  doc.setFont("helvetica","normal");doc.setFontSize(11);
  riding.forEach((p,i)=>{
    if(y>730){doc.addPage();y=50;}
    doc.text(`${i+1}.`,40,y);doc.text(pname(p),62,y);doc.setFontSize(9);doc.setTextColor(90);doc.text([p.parent,p.phone].filter(Boolean).join(" "),232,y);doc.setTextColor(0);doc.setFontSize(11);
    doc.rect(398,y-9,11,11);doc.rect(448,y-9,11,11);
    if(t.boarded[p.id]){doc.line(400,y-4,403,y);doc.line(403,y,408,y-8);}
    if(t.back[p.id]){doc.line(450,y-4,453,y);doc.line(453,y,458,y-8);}
    y+=20;
  });
  const list=(label,arr)=>{if(!arr.length)return;y+=8;if(y>720){doc.addPage();y=50;}doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text(`${label} (${arr.length})`,40,y);y+=16;
    doc.setFont("helvetica","normal");doc.setFontSize(11);doc.splitTextToSize(arr.map(pname).join(", "),520).forEach(l=>{doc.text(l,40,y);y+=14;});};
  list("Own ride",own);list("Not going",out);
  y+=10;doc.setFontSize(10);doc.setTextColor(90);doc.text(`Total on the bus: ${riding.length} players${t.adults?` + ${t.adults.split(/,| and /).filter(s=>s.trim()).length} adults`:""}`,40,Math.min(y,760));
  doc.save(`bus-${busDate}-${slug(g.opponent)}.pdf`);
}

/* ---------- game-day food sign-ups ---------- */
const FOOD_SLOTS=[{name:"Pre-game meals",count:1}];
const FOOD_PRESETS=[["Pre-game meal",1],["Post-game snacks",2],["Drinks / water",1],["Gatorade / sports drinks",1],["Fruit",1],["Ice / cooler",1],["Paper plates & napkins",1],["Dessert",1]];
const signupURL=id=>location.origin+"/f/"+encodeURIComponent(id)+(HOSTED?"":"?demo=1");
const randId=()=>{const a=new Uint8Array(10);crypto.getRandomValues(a);return Array.from(a,b=>"abcdefghijkmnpqrstuvwxyz23456789"[b%32]).join("");};
/* Same storage calls whether the sheet lives in Supabase or (demo mode) in this browser. */
const FoodAPI=HOSTED?{
  async load(){
    const {data,error}=await sb.from("signup_boards").select("*").eq("team_id",team.id).order("created_at",{ascending:false}).limit(1);
    if(error)throw error;const board=data&&data[0]||null;let entries=[];
    if(board){const r=await sb.from("signup_entries").select("id,game_date,slot,name,contact,player,item,created_at").eq("board_id",board.id).order("created_at");if(r.error)throw r.error;entries=r.data||[];}
    return {board,entries};
  },
  async create(b){const {error}=await sb.from("signup_boards").insert({...b,team_id:team.id});if(error)throw error;},
  async update(id,patch){const {error}=await sb.from("signup_boards").update(patch).eq("id",id);if(error)throw error;},
  async remove(id){const {error}=await sb.from("signup_entries").delete().eq("id",id);if(error)throw error;}
}:{
  key:()=>`cpp:food:${team.id}`,
  read(){try{return JSON.parse(localStorage.getItem(this.key())||"null")||{board:null,entries:[]};}catch{return {board:null,entries:[]};}},
  write(v){localStorage.setItem(this.key(),JSON.stringify(v));if(v.board)localStorage.setItem("cpp:foodboard:"+v.board.id,team.id);},
  async load(){return this.read();},
  async create(b){this.write({board:{...b,active:true,skip:[],created_at:new Date().toISOString()},entries:[]});},
  async update(id,patch){const v=this.read();v.board={...v.board,...patch};this.write(v);},
  async remove(id){const v=this.read();v.entries=v.entries.filter(e=>e.id!==id);this.write(v);}
};
const foodGames=b=>(SETTINGS.games||[]).filter(g=>g.date&&(b.games==="all"||(b.games==="home")===(g.home!==false))).sort((a,c)=>a.date<c.date?-1:1);
async function loadFood(){
  try{food=await FoodAPI.load();food.err="";}catch(e){food={board:null,entries:[],err:isDbMissing(e)?"db":e.message||"Couldn't load the sign-up sheet."};}
  if(pane==="food")renderFood();
  if(pane==="sched")renderSched();
}
function slotRows(slots){
  return (slots||FOOD_SLOTS).map(s=>`<div class="fd-slot"><input data-slotname value="${esc(s.name)}" placeholder="e.g. Snacks" aria-label="What to bring"><label>Spots<input data-slotcount type="number" min="1" max="20" value="${esc(s.count)}" aria-label="How many parents"></label><button class="icon" type="button" data-fdrm aria-label="Remove">✕</button></div>`).join("");
}
function boardForm(b){
  b=b||{title:"Game-day food",games:"all",slots:FOOD_SLOTS,note:""};
  return `<form id="fdForm" class="fd-form">
    <label class="f">Sign-up title<input name="title" value="${esc(b.title)}" required></label>
    <fieldset class="catpick"><legend>Which games</legend><div class="exp-pick">${[["all","All games"],["home","Home games only"],["away","Away games only"]].map(([v,l])=>`<label><input type="radio" name="games" value="${v}"${b.games===v?" checked":""}> ${l}</label>`).join("")}</div></fieldset>
    <fieldset class="catpick"><legend>What parents sign up for, at each game</legend><div id="fdSlots">${slotRows(b.slots)}</div>
      <button class="btn" type="button" id="fdAddSlot">+ Add another item</button>
      <p class="help" style="margin:4px 0 0">Each item shows at every game. Spots is how many parents can sign up for that item at one game.</p></fieldset>
    <label class="f fd-hometime">Home games: food delivered by<input type="time" name="homeTime" value="${esc(((b.dropoff||{}).home)||"16:00")}"></label>
    <p class="help" style="margin:-4px 0 0">Away games each get their own time, set next to the game below.</p>
    <label class="f">Note to parents<textarea name="note" rows="3" placeholder="e.g. Please bring enough for ${Math.max(ROSTER.length,12)} players and coaches. Drop it off with Coach before tip-off.">${esc(b.note||"")}</textarea></label>
    <div class="actions" style="margin:0"><button class="btn primary" type="submit">${food&&food.board?"Save changes":"Create the parent link"}</button></div>
  </form>`;
}
function renderFood(){
  const box=$("#tm-food");
  if(!food){box.innerHTML=`<div class="tm-card"><p class="help">Loading sign-ups…</p></div>`;loadFood();return;}
  if(food.err==="db"){box.innerHTML=DB_HELP;return;}
  if(food.err){box.innerHTML=`<div class="tm-card"><p class="msg err">${esc(food.err)}</p></div>`;return;}
  const b=food.board,ed=can();
  if(!b){box.innerHTML=`<div class="tm-card"><h3 class="tm-h">Game-day food sign-up</h3>
    <p class="help" style="margin-top:0">Make one link to send to parents. They open it on their phone, pick a game and what they'll bring, and type their name and number. No account or app. You see every sign-up here.</p>
    ${ed?boardForm():`<p class="help">Ask your head coach to set this up.</p>`}<div class="msg" id="fdMsg"></div></div>`;return;}
  const url=signupURL(b.id),today=todayISO(),games=foodGames(b),up=games.filter(g=>g.date>=today),past=games.filter(g=>g.date<today);
  const by={};food.entries.forEach(e=>{const k=(e.game_date||"").slice(0,10)+"|"+e.slot;(by[k]=by[k]||[]).push(e);});
  const open=g=>(b.slots||[]).reduce((n,s)=>n+Math.max(0,s.count-(by[g.date+"|"+s.name]||[]).length),0);
  const gameCard=g=>{const skip=(b.skip||[]).includes(g.date),d=dropFor(b,g),bus=g.home===false?busTimeFor(g.date):"";
    const drop=skip?"":ed?`<div class="fd-drop"><label>Food delivered by <input type="time" data-fddrop="${g.date}" value="${esc(d.time)}"></label>
        ${g.home!==false&&!d.custom?`<small>home game time</small>`:""}${g.home===false&&!d.time?`<small class="warn">Not set yet: parents see “time coming soon”</small>`:""}
        ${bus&&bus!==d.time?`<button type="button" class="linkbtn" data-fdbus="${g.date}" data-time="${bus}">Use bus time (${hm(bus)})</button>`:""}</div>`:
      `<div class="fd-drop">${d.time?`Food delivered by <b>${hm(d.time)}</b>`:"Delivery time not set yet"}</div>`;
    return `<article class="fd-game${skip?" skip":""}"><header><b>${esc(longDay(g.date))}</b> <span>${g.home===false?"at":"vs"} ${esc(g.opponent||"Game")}${g.time?" · "+hm(g.time):""}</span>
      <span class="fd-open">${skip?"No sign-ups":open(g)?`${open(g)} open`:"All filled"}</span></header>${drop}
      ${skip?"":(b.slots||[]).map(s=>{const list=by[g.date+"|"+s.name]||[];
        return `<div class="fd-srow"><div class="fd-sname">${esc(s.name)} <small>${list.length} of ${s.count}</small></div><ul>${list.map(e=>`<li><b>${esc(e.name)}</b>${e.player?` <span>(${esc(e.player)})</span>`:""}${e.item?` · ${esc(e.item)}`:""}<small>${/@/.test(e.contact)?`<a href="mailto:${esc(e.contact)}">${esc(e.contact)}</a>`:`<a href="tel:${esc(tel(e.contact))}">${esc(e.contact)}</a>`}</small>${ed?`<button class="icon" type="button" data-fdx="${esc(e.id)}" aria-label="Remove ${esc(e.name)}">✕</button>`:""}</li>`).join("")}${list.length<s.count?`<li class="fd-empty">${s.count-list.length} open</li>`:""}</ul></div>`;}).join("")}
      ${ed?`<button class="linkbtn fd-skip" type="button" data-fdskip="${g.date}">${skip?"Turn sign-ups back on for this game":"No food needed for this game"}</button>`:""}</article>`;};
  const filled=food.entries.filter(e=>(e.game_date||"")>=today).length;
  box.innerHTML=`<div class="tm-card fd-link"><h3 class="tm-h">${esc(b.title)} <small>${b.active?`${filled} sign-up${filled===1?"":"s"} so far`:"Link is off"}</small></h3>
    ${b.active?`<p class="help" style="margin-top:0">Send this link to parents by text, email or your team app. They don't need an account.</p>
    <div class="fd-url"><input readonly value="${esc(url)}" id="fdUrl" aria-label="Parent sign-up link"><button class="btn primary" type="button" data-fdact="copy">Copy link</button>${navigator.share?`<button class="btn" type="button" data-fdact="share">Send…</button>`:""}<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open</a></div>
    <div class="actions" style="margin:8px 0 0"><button class="btn" type="button" data-fdact="msg">Copy a message for parents</button></div>`:
    `<p class="help" style="margin-top:0">Parents who open the link see that sign-ups are closed. Sign-ups so far are kept.</p>`}
    <div class="fd-items"><b>Parents can sign up for:</b> ${(b.slots||[]).map(x=>`<span class="fd-item">${esc(x.name)} <small>${x.count} spot${x.count===1?"":"s"}</small></span>`).join("")}</div>
    ${ed?`<details class="fd-edit" id="fdEdit"><summary>${(b.slots||[]).length<2?"Add more items for parents":"Add or change items"}</summary>${boardForm(b)}</details>
    <div class="actions" style="margin:8px 0 0"><button class="btn${b.active?" danger":""}" type="button" data-fdact="toggle">${b.active?"Turn off the link":"Turn the link back on"}</button></div>`:""}
    <div class="msg" id="fdMsg"></div></div>
    ${up.length?up.map(gameCard).join(""):`<div class="tm-card"><p class="help">No upcoming ${b.games==="all"?"":b.games+" "}games on the calendar.</p></div>`}
    ${past.length?`<details class="fd-past"><summary>Past games (${past.length})</summary>${past.map(gameCard).join("")}</details>`:""}`;
}
/* Delivery time for a game: its own time if set, otherwise the home-game time (home games only). */
function dropFor(b,g){const d=b.dropoff||{},own=(d.games||{})[g.date];if(own)return {time:own,custom:true};return {time:g.home===false?"":(d.home||"16:00"),custom:false};}
const busTimeFor=iso=>(TRIPS[iso]&&TRIPS[iso].depart)||((SETTINGS.special||[]).find(x=>x.date===iso&&x.bus)||{}).bus||"";
async function setDrop(date,time,from){
  const b=food.board,d=JSON.parse(JSON.stringify(b.dropoff||{home:"16:00"}));d.games=d.games||{};
  const g=(SETTINGS.games||[]).find(x=>x.date===date)||{};
  if(!time||(g.home!==false&&time===(d.home||"16:00")))delete d.games[date];else d.games[date]=time;
  const out=()=>$(from==="sched"?"#schMsg":"#fdMsg");
  try{await FoodAPI.update(b.id,{dropoff:d});b.dropoff=d;if(from==="sched")renderSched();else renderFood();const m=out();if(m)msg(m,`Food time saved for ${longDay(date)}. Parents see it right away.`,"ok");}
  catch(err){const m=out();if(m)msg(m,isDbMissing(err)?"Delivery times need the latest database update (team-tools.sql).":err.message,"err");}
}
function readBoardForm(f){
  const slots=[...f.querySelectorAll(".fd-slot")].map(r=>({name:r.querySelector("[data-slotname]").value.trim(),count:Math.max(1,Math.min(20,+r.querySelector("[data-slotcount]").value||1))})).filter(s=>s.name);
  const names=new Set();const uniq=slots.filter(s=>!names.has(s.name.toLowerCase())&&names.add(s.name.toLowerCase()));
  const home=(f.homeTime&&f.homeTime.value)||"16:00";
  return {dropoff:{...((food&&food.board&&food.board.dropoff)||{}),games:{...(((food&&food.board&&food.board.dropoff)||{}).games||{})},home},title:f.title.value.trim()||"Game-day food",games:(f.querySelector("[name=games]:checked")||{}).value||"all",note:f.note.value.trim(),slots:uniq};
}
$("#tm-food").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target;if(f.id!=="fdForm")return;
  const v=readBoardForm(f);if(!v.slots.length){msg($("#fdMsg"),"Add at least one thing to bring.","err");return;}
  const btn=f.querySelector("[type=submit]");btn.disabled=true;
  try{
    if(food.board)await FoodAPI.update(food.board.id,v);else await FoodAPI.create({id:randId(),...v});
    await loadFood();msg($("#fdMsg"),food.board&&food.board.title===v.title?"Saved. Parents see the change right away.":"Link ready. Copy it and send it to parents.","ok");
  }catch(err){btn.disabled=false;if(isDbMissing(err)){food.err="db";renderFood();}else msg($("#fdMsg"),err.message,"err");}
});
$("#tm-food").addEventListener("change",e=>{const t=e.target.closest("[data-fddrop]");if(t&&can())setDrop(t.dataset.fddrop,t.value);});
$("#tm-food").addEventListener("click",async e=>{
  const bt=e.target.closest("[data-fdbus]");if(bt&&can()){setDrop(bt.dataset.fdbus,bt.dataset.time);return;}
  const pr=e.target.closest("[data-fdpreset]");
  if(pr){const have=[...document.querySelectorAll("#fdSlots [data-slotname]")].map(i=>i.value.trim().toLowerCase());
    if(have.includes(pr.dataset.fdpreset.toLowerCase())){msg($("#fdMsg"),pr.dataset.fdpreset+" is already on the list.","err");return;}
    const blank=[...document.querySelectorAll("#fdSlots .fd-slot")].find(r=>!r.querySelector("[data-slotname]").value.trim());
    if(blank){blank.querySelector("[data-slotname]").value=pr.dataset.fdpreset;blank.querySelector("[data-slotcount]").value=pr.dataset.count;}
    else $("#fdSlots").insertAdjacentHTML("beforeend",slotRows([{name:pr.dataset.fdpreset,count:+pr.dataset.count}]));
    pr.setAttribute("aria-pressed","true");return;}
  if(e.target.id==="fdAddSlot"){$("#fdSlots").insertAdjacentHTML("beforeend",slotRows([{name:"",count:1}]));$("#fdSlots .fd-slot:last-child input").focus();return;}
  if(e.target.closest("[data-fdrm]")){const r=e.target.closest(".fd-slot");if(document.querySelectorAll("#fdSlots .fd-slot").length>1)r.remove();return;}
  const x=e.target.closest("[data-fdx]");
  if(x){if(x.dataset.armed!=="1"){x.dataset.armed="1";x.textContent="Remove?";x.classList.add("armed");return;}
    try{await FoodAPI.remove(x.dataset.fdx);await loadFood();}catch(err){msg($("#fdMsg"),err.message,"err");}return;}
  const sk=e.target.closest("[data-fdskip]");
  if(sk){const b=food.board,d=sk.dataset.fdskip,skip=(b.skip||[]).includes(d)?b.skip.filter(x=>x!==d):[...(b.skip||[]),d];
    try{await FoodAPI.update(b.id,{skip});await loadFood();}catch(err){msg($("#fdMsg"),err.message,"err");}return;}
  const a=e.target.closest("[data-fdact]");if(!a)return;
  const url=food.board?signupURL(food.board.id):"";
  const text=()=>`${food.board.title}: please sign up to bring food for one of our ${team.settings.mascot||team.name} games. It takes a minute and you don't need an account: ${url}`;
  const copy=async(t,ok)=>{try{await navigator.clipboard.writeText(t);msg($("#fdMsg"),ok,"ok");}catch{$("#fdUrl").select();msg($("#fdMsg"),"Select the link and copy it.","err");}};
  if(a.dataset.fdact==="copy")copy(url,"Link copied.");
  if(a.dataset.fdact==="msg")copy(text(),"Message copied. Paste it into a text or email to parents.");
  if(a.dataset.fdact==="share")navigator.share({title:food.board.title,text:text(),url}).catch(()=>{});
  if(a.dataset.fdact==="toggle"){
    if(food.board.active&&a.dataset.armed!=="1"){a.dataset.armed="1";a.textContent="Tap again: parents can't sign up";return;}
    try{await FoodAPI.update(food.board.id,{active:!food.board.active});await loadFood();}catch(err){msg($("#fdMsg"),err.message,"err");}
  }
});
/* Fresh sign-ups when coming back to the app. */
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&pane==="food"&&!$("#view-team").hidden)loadFood();});
})();
