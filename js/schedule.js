/* Parents' team calendar. Opened from a short link like theextracoach.com/c/abc123… (or schedule.html?c=…)
   No account: the page reads the schedule through the public get_calendar function every time
   it opens (and again when the phone comes back to it), so it always shows the coach's latest.
   Parents can also subscribe in their phone's calendar app through the calendar-feed function.
   In demo mode (&demo=1) it reads the team saved in this browser. */
(function(){
const $=q=>document.querySelector(q);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const params=new URLSearchParams(location.search),ID=params.get("c")||(location.pathname.match(/\/c\/([A-Za-z0-9]+)\/?$/)||[])[1]||"",DEMO=params.get("demo")==="1";
const CFG=window.APP_CONFIG||{},S=window.SchedCore;
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const ampm=t=>{if(!t)return "";const [h,m]=t.split(":").map(Number);return `${((h+11)%12)+1}:${String(m).padStart(2,"0")} ${h<12?"AM":"PM"}`;};
const span=(a,b)=>{const A=ampm(a),B=ampm(b);return A.slice(-2)===B.slice(-2)?`${A.slice(0,-3)} – ${B}`:`${A} – ${B}`;};
const longDay=s=>S.dObj(s).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const todayISO=()=>S.isoOf(new Date());
const FEED=CFG.supabaseUrl&&!DEMO?`${CFG.supabaseUrl.replace(/\/$/,"")}/functions/v1/calendar-feed?c=${encodeURIComponent(ID)}`:"";
const pref=(k,v)=>{try{if(v===undefined)return localStorage.getItem("cpp:sched:"+k);localStorage.setItem("cpp:sched:"+k,v);}catch{return null;}};
let CAL=null,DAYS=[],BY={},TEAMS=null,view=pref("view")||"month",calMonth=null,feedOK=null;

/* ---------- where the calendar lives ---------- */
let api;
if(DEMO){
  api={async get(){
    let teamId=null,share=null,t=null;
    try{teamId=localStorage.getItem("cpp:calshareTeam:"+ID);share=JSON.parse(localStorage.getItem("cpp:calshare:"+teamId)||"null");
      t=(JSON.parse(localStorage.getItem("cpp:demoTeams")||"[]")).find(x=>x.id===teamId);}catch{}
    if(!share||share.id!==ID||!share.active||!t)return null;const st=t.settings||{};
    const all=JSON.parse(localStorage.getItem("cpp:demoTeams")||"[]"),tj=x=>{const s2=x.settings||{};return {id:x.id,team:{name:x.name,color:s2.color,color2:s2.color2,logo:s2.logo,school:s2.school,mascot:s2.mascot,teamLabel:s2.teamLabel},schedule:s2};};
    const ids=[t.id,...(share.team_ids||[]).filter(x=>x!==t.id)];
    return {title:share.title||"",show:share.show,team:tj(t).team,schedule:st,teams:ids.map(id=>all.find(x=>x.id===id)).filter(Boolean).map(tj)};
  }};
}else{
  const sb=CFG.supabaseUrl&&window.supabase?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:false}}):null;
  api={async get(){if(!sb)throw new Error("not set up");const {data,error}=await sb.rpc("get_calendar",{p_id:ID});if(error)throw error;return data;}};
}

function fail(text){$("#scLoading").hidden=true;$("#scApp").hidden=true;$("#scError").hidden=false;$("#scError").textContent=text;}
function ink(hex){const m=/^#?([0-9a-f]{6})$/i.exec(hex||"");if(!m)return "#ffffff";const n=parseInt(m[1],16);
  const L=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});
  return .2126*L[0]+.7152*L[1]+.0722*L[2]>.4?"#17141c":"#ffffff";}
const teamName=()=>{const t=CAL.team||{};return [t.school&&t.mascot?`${t.school} ${t.mascot}`:t.name,TEAMS?TEAMS.map(x=>x.label).join(" & "):t.teamLabel].filter(Boolean).join(" ");};

async function load(quiet){
  let c;try{c=await api.get();}catch{if(!quiet)fail("Couldn't load the schedule. Check your connection and try again.");return;}
  if(!c){fail("This calendar link is off or wrong. Ask your coach for the current link.");return;}
  CAL=c;const show=CAL.show||{};
  const prep=sched=>S.days(sched||{}).map(d=>{const nb=n=>show.bus===false?(n||[]).filter(x=>!isBus(x)):(n||[]);
      return {...d,game:show.games===false?null:d.game,practice:show.practices===false?null:(d.practice&&{...d.practice,notes:nb(d.practice.notes)}),off:show.off===false?null:d.off,notes:nb(show.off===false&&!d.game?(d.notes||[]).filter(isBus):d.notes)};})
    .filter(d=>d.game||d.practice||d.off||d.notes.length);
  DAYS=prep(CAL.schedule);
  /* One link, several teams (e.g. 7th and 8th grade) */
  TEAMS=Array.isArray(CAL.teams)&&CAL.teams.length>1?CAL.teams.map(x=>{const t=x.team||{},dl=prep(x.schedule);
    return {id:x.id,label:(t.teamLabel||t.name||"Team").replace(/\s+(basketball|volleyball|soccer|football|baseball|softball)$/i,"")||t.teamLabel||t.name,color:t.color||"#5b2a86",team:t,sched:x.schedule||{},days:dl,by:Object.fromEntries(dl.map(d=>[d.date,d]))};}):null;
  const t=CAL.team||{},root=document.documentElement;
  root.style.setProperty("--team",t.color||"#5b2a86");root.style.setProperty("--team-ink",ink(t.color));
  if(t.color2){root.style.setProperty("--team2",t.color2);root.classList.add("has-c2");}
  teamBrand(t,`${[t.school&&t.mascot?`${t.school} ${t.mascot}`:(t.name||"Team"),TEAMS?TEAMS.map(x=>x.label).join(" & "):t.teamLabel].filter(Boolean).join(" ")} Schedule`);
  $("#scEyebrow").textContent=[t.school&&t.mascot?`${t.school} ${t.mascot}`:t.name,TEAMS?TEAMS.map(x=>x.label).join(" & "):t.teamLabel].filter(Boolean).join(" · ");
  $("#scTitle").textContent=CAL.title||"Practice & Game Calendar";
  if(t.logo){$("#scLogo").src=t.logo;$("#scLogo").hidden=false;}
  $("#scDemo").hidden=!DEMO;
  $("#scChecked").textContent=`Checked ${new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}.`;
  render();
  $("#scLoading").hidden=true;$("#scError").hidden=true;$("#scApp").hidden=false;
}

/* ---------- the calendar (same look as the app's Calendar tab) ---------- */
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const isTryout=n=>/tryout/i.test(n||""),isMeeting=n=>/meeting/i.test(n||""),isBus=n=>/^bus\b/i.test(n||"");
const isTry=p=>(p.notes||[]).some(isTryout);
/* "Players arrive 20 minutes early": the coach's setting (Calendar → Practice schedule). */
const early=()=>+((CAL&&CAL.schedule&&CAL.schedule.arriveEarly)||0);
const prNote=()=>{const n=String((CAL&&CAL.schedule&&CAL.schedule.practiceNote)||"").trim();return /^players arrive \d+ min(ute)?s? (before|early)/i.test(n)?"":n;};   // the arrival line already says this
const arrive=p=>early()&&p.start?ampm(S.arriveAt(p.start,early())):"";
function cellHTML(iso,d){
  const today=iso===todayISO();
  if(!d)return `<button type="button" class="cal-cell${today?" today":""}" data-day="${iso}"><span class="d">${+iso.slice(8)}</span></button>`;
  let cls="",body="",after="";
  const evHTML=list=>list.filter(isMeeting).map(n=>`<span class="ev meeting"><b>${esc(n.replace(/^practice\s*\+\s*/i,""))}</b></span>`).join("")+
    list.filter(isBus).map(n=>`<span class="ev bus"><b>${esc(n)}</b></span>`).join("");
  const tagsHTML=list=>list.filter(n=>!isTryout(n)&&!isMeeting(n)&&!isBus(n)).map(n=>`<span class="tag holiday">${esc(n)}</span>`).join("");
  if(d.game){const g=d.game;cls="game";
    body+=`${g.event?`<span class="gev">${esc(g.event)}</span>`:""}<span class="tag ${g.home?"home":"away"}">${g.home?"Home":"Away"}</span><span class="ev"><b>${g.home?"":"at "}${esc(g.opponent||"Game")}</b><small>${g.time?ampm(g.time):"Time TBD"}</small></span>`;}
  if(d.off){const np=/^no practice$/i.test(d.off.note);cls=cls||(np?"nopr":"holiday");after+=np?`<span class="ev nopr"><b>No practice</b></span>`:`<span class="ev holiday"><b>${esc(d.off.note)}</b><small>No practice</small></span>`;}
  if(d.practice){const p=d.practice,tr=isTry(p);cls=cls||(tr?"tryout":"practice");
    body+=`<span class="ev"><b>${tr?"Tryouts":"Practice"}</b><small>${span(p.start,p.end)}</small></span>`+evHTML(p.notes);after+=tagsHTML(p.notes);}
  if(d.notes.length){body+=evHTML(d.notes);after+=tagsHTML(d.notes);}
  return `<button type="button" class="cal-cell ${cls}${today?" today":""}" data-day="${iso}"><span class="d">${+iso.slice(8)}</span>${body}${after}</button>`;
}
function monthHTML(y,m){
  const first=new Date(y,m,1),n=new Date(y,m+1,0).getDate(),pad=first.getDay();
  const isoD=dd=>`${y}-${String(m+1).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  let pr=0,gm=0;const offs=[];
  for(let dd=1;dd<=n;dd++){const d=BY[isoD(dd)];if(!d)continue;if(d.practice)pr++;if(d.game)gm++;if(d.off)offs.push([dd,d.off.note]);}
  const runs=[];offs.forEach(([dd,t])=>{const r=runs[runs.length-1];if(r&&r.t===t&&r.b===dd-1)r.b=dd;else runs.push({a:dd,b:dd,t});});
  const mo=MONTHS[m].slice(0,3);
  const offTxt=runs.length?` · No practice ${runs.map(r=>`${mo} ${r.a}${r.b>r.a?"–"+r.b:""}${r.t&&r.t!=="No practice"?" ("+esc(r.t)+")":""}`).join(", ")}`:"";
  let cells="";for(let i=0;i<pad;i++)cells+=`<div class="cal-cell pad"></div>`;
  for(let dd=1;dd<=n;dd++){const iso=isoD(dd);cells+=cellHTML(iso,BY[iso]);}
  const tail=(7-((pad+n)%7))%7;for(let i=0;i<tail;i++)cells+=`<div class="cal-cell pad"></div>`;
  const parts=[(CAL.show||{}).practices!==false?`${pr} practice${pr===1?"":"s"}`:"",(CAL.show||{}).games!==false?`${gm} game${gm===1?"":"s"}`:""].filter(Boolean).join(" · ");
  return `<section class="cal-month" id="cal-${y}-${m+1}"><h3>${MONTHS[m]} ${y}</h3><p class="sub">${parts}${offTxt}</p>
    <div class="cal-grid">${DOW.map(x=>`<div class="dow">${x}</div>`).join("")}${cells}</div></section>`;
}
function monthsToShow(){
  const st=CAL.schedule||{},all=Object.keys(BY).concat([st.seasonStart,st.seasonEnd].filter(Boolean)).sort();
  if(!all.length)return [];
  const out=[];let y=+all[0].slice(0,4),m=+all[0].slice(5,7)-1;const ey=+all[all.length-1].slice(0,4),em=+all[all.length-1].slice(5,7)-1;
  while(y<ey||(y===ey&&m<=em)){out.push([y,m]);m++;if(m>11){m=0;y++;}if(out.length>24)break;}
  return out;
}
function renderNext(){
  const t=todayISO(),now=new Date(),nowMin=now.getHours()*60+now.getMinutes(),toM=x=>{const [h,m]=x.split(":").map(Number);return h*60+m;};
  const ng=DAYS.find(d=>d.game&&d.date>=t),np=DAYS.find(d=>d.practice&&(d.date>t||(d.date===t&&toM(d.practice.end)>nowMin)));
  const when=d=>d.date===t?"Today":d.date===S.addDays(t,1)?"Tomorrow":longDay(d.date);
  const cards=[];
  if(ng)cards.push(`<div class="sc-nx"><small>Next game · ${esc(when(ng))}${ng.game.event?` · ${esc(ng.game.event)}`:""}</small><b>${ng.game.home?"vs":"at"} ${esc(ng.game.opponent||"Game")}</b><span>${[ng.game.time?ampm(ng.game.time):"Time TBD",ng.game.home?"Home":"Away",ng.game.location].filter(Boolean).map(esc).join(" · ")}${ng.notes.length?`<br>${esc(ng.notes.join(" · "))}`:""}</span></div>`);
  if(np)cards.push(`<div class="sc-nx"><small>Next practice · ${esc(when(np))}</small><b>${isTry(np.practice)?"Tryouts":"Practice"}</b><span>${span(np.practice.start,np.practice.end)}${prNote()?`<br>📌 ${esc(prNote())}`:""}${np.practice.notes.length?` · ${esc(np.practice.notes.join(" · "))}`:""}</span></div>`);
  $("#scNext").innerHTML=cards.join("");$("#scNext").hidden=!cards.length;
}
function renderCalButtons(){
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  if(feedOK){const web=FEED.replace(/^https?:/,"webcal:");
    $("#scCal").innerHTML=`<a class="btn primary" href="${esc(web)}">📅 Add to my phone's calendar</a><a class="btn" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(web)}" target="_blank" rel="noopener">Google Calendar</a>`;
    $("#scCalHelp").textContent=ios?"Subscribe once and the team schedule stays in your iPhone's Calendar app, updating on its own when the coach changes something.":"Subscribe once and the schedule stays in your calendar app and updates on its own. On Android, use Google Calendar.";
  }else{
    $("#scCal").innerHTML=`<button class="btn" type="button" id="scIcs">📅 Add to my calendar</button>`;
    $("#scCalHelp").textContent="That adds today's copy of the schedule. This page is always current: bookmark it or add it to your Home Screen.";
  }
}
function render(){
  if(TEAMS){renderMulti();return;}
  BY=Object.fromEntries(DAYS.map(d=>[d.date,d]));
  const st=CAL.schedule||{},show=CAL.show||{};
  renderNext();renderCalButtons();
  const fmtM=iso=>iso?`${MONTHS[+iso.slice(5,7)-1]} ${iso.slice(0,4)}`:"";
  const nP=DAYS.filter(d=>d.practice).length,games=DAYS.filter(d=>d.game);
  {const a=early(),el=$("#scArrive");if(el){el.hidden=!a;el.textContent=a?`⏰ Please have players arrive at practice at least ${a} minutes early.`:"";}}
  $("#scSeason").innerHTML=st.seasonStart?`<b>${fmtM(st.seasonStart)} – ${fmtM(st.seasonEnd)}</b><small>${[show.practices!==false?`${nP} practices`:"",show.games!==false?`${games.length} games`:""].filter(Boolean).join(" · ")}</small>`:"";
  /* legend: only what this calendar can show */
  document.querySelectorAll("#scLegend span").forEach(x=>{const k=x.querySelector("i").className.replace("sw ","");
    x.hidden=(k==="game"&&show.games===false)||((k==="practice"||k==="tryout")&&show.practices===false)||(["holiday","nopr","meeting"].includes(k)&&show.off===false)||(k==="bus"&&show.bus===false);});
  const months=monthsToShow();
  if(!months.length){$("#calMonths").innerHTML=`<div class="empty">Nothing on the schedule yet.</div>`;$("#calNav").hidden=true;$("#calGames").innerHTML="";return;}
  const keys=months.map(([y,m])=>y+"-"+m);
  if(!calMonth||!keys.includes(calMonth)){const t=todayISO(),tk=+t.slice(0,4)+"-"+(+t.slice(5,7)-1);calMonth=keys.includes(tk)?tk:(t<keys[0]?keys[0]:keys[keys.length-1]);}
  const idx=keys.indexOf(calMonth),one=view==="month";
  document.querySelectorAll("[data-v]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===view)));
  $("#calNav").hidden=!one;
  $("#calNavLabel").textContent=one?`${MONTHS[months[idx][1]]} ${months[idx][0]}`:"";
  $("#calPrev").disabled=idx<=0;$("#calNext").disabled=idx>=keys.length-1;
  $("#calMonths").classList.toggle("one-month",one);
  $("#calMonths").innerHTML=(one?[months[idx]]:months).map(([y,m])=>monthHTML(y,m)).join("");
  $("#calGames").innerHTML=games.length?`<caption>Game list</caption><thead><tr><th>Date</th><th>Opponent</th><th>Time</th><th>Location</th></tr></thead><tbody>`+
    games.map(d=>`<tr data-day="${d.date}"${d.date<todayISO()?' style="opacity:.6"':""}><td>${esc(S.dObj(d.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}))}</td><td class="opp">${esc(d.game.opponent||"")}${d.game.event?`<small class="gl-ev">${esc(d.game.event)}</small>`:""}</td><td>${d.game.time?ampm(d.game.time):"TBD"}</td><td>${d.game.home?"Home":"Away"}${d.game.location?" · "+esc(d.game.location):""}</td></tr>`).join("")+`</tbody>`:"";
  $("#calFoot").textContent=show.practices!==false&&st.weekdayStart?`Practices are usually ${span(st.weekdayStart,st.weekdayEnd)} on weekdays${st.weekendStart?` and ${span(st.weekendStart,st.weekendEnd)} on weekends`:""}.${prNote()?" "+prNote():""} Days with different times show them on the calendar.`:"";
}
function openDay(iso){
  if(TEAMS){openDayMulti(iso);return;}
  const d=BY[iso];$("#scDayTitle").textContent=longDay(iso);
  const li=[];
  if(d&&d.game)li.push(`<li><span class="sc-pill ${d.game.home?"p-home":"p-away"}">${d.game.home?"Home":"Away"}</span><b>${d.game.home?"vs":"at"} ${esc(d.game.opponent||"Game")}</b><small>${d.game.time?ampm(d.game.time):"Time TBD"}</small>${d.game.event?`<small>${esc(d.game.event)}</small>`:""}${d.game.location?`<small>📍 ${esc(d.game.location)}</small>`:""}</li>`);
  if(d&&d.practice)li.push(`<li><span class="sc-pill p-prac">${isTry(d.practice)?"Tryouts":"Practice"}</span><b>${span(d.practice.start,d.practice.end)}</b>${prNote()?`<small>📌 ${esc(prNote())}</small>`:""}</li>`);
  if(d&&d.off)li.push(`<li><span class="sc-pill p-off">No practice</span>${d.off.note!=="No practice"?`<b>${esc(d.off.note)}</b>`:""}</li>`);
  if(d)[...(d.practice?d.practice.notes.filter(n=>!isTryout(n)):[]),...d.notes].forEach(n=>li.push(`<li><span class="sc-pill p-note">${isBus(n)?"Bus":isMeeting(n)?"Meeting":"Note"}</span><b>${esc(n)}</b></li>`));
  $("#scDayList").innerHTML=li.join("")||`<li><small>Nothing scheduled.</small></li>`;
  $("#scDay").showModal();
}

/* ---------- several teams on one link ---------- */
function monthsMulti(){
  const all=[];TEAMS.forEach(x=>{all.push(...x.days.map(d=>d.date));if(x.sched.seasonStart)all.push(x.sched.seasonStart);if(x.sched.seasonEnd)all.push(x.sched.seasonEnd);});all.sort();
  if(!all.length)return [];const out=[];let y=+all[0].slice(0,4),m=+all[0].slice(5,7)-1;const ey=+all[all.length-1].slice(0,4),em=+all[all.length-1].slice(5,7)-1;
  while(y<ey||(y===ey&&m<=em)){out.push([y,m]);m++;if(m>11){m=0;y++;}if(out.length>24)break;}return out;
}
function itemsOn(iso){
  const groups=new Map(),add=(kind,text,x)=>{const k=kind+"|"+text;if(!groups.has(k))groups.set(k,{kind,text,teams:[]});groups.get(k).teams.push(x);};
  TEAMS.forEach(x=>{const d=x.by[iso];if(!d)return;
    if(d.game){const g=d.game;add("game",`${g.home?"vs":"at"} ${g.opponent||"Game"}${g.time?" "+ampm(g.time).replace(":00",""):""}`,x);}
    if(d.practice)add("practice",`${isTry(d.practice)?"Tryouts":"Practice"} ${ampm(d.practice.start).replace(":00","")}`,x);
    if(d.off)add("off",d.off.note==="No practice"?"No practice":d.off.note,x);
    [...(d.practice?d.practice.notes:[]),...d.notes].filter(n=>!isTryout(n)).forEach(n=>add(isBus(n)?"bus":"note",n,x));});
  return [...groups.values()];
}
function renderMulti(){
  const show=CAL.show||{},t=todayISO();
  /* arrival heading: one line when every team arrives the same, else per team */
  {const a=TEAMS.map(x=>+(x.sched.arriveEarly||0)),el=$("#scArrive");
    if(el){const same=a.every(v=>v===a[0]);el.hidden=!a.some(Boolean);
      el.textContent=same?(a[0]?`⏰ Please have players arrive at practice at least ${a[0]} minutes early.`:""):"⏰ Please have players arrive at practice at least: "+TEAMS.map((x,i)=>a[i]?`${x.label} ${a[i]} min`:"").filter(Boolean).join(" · ");}}
  $("#scSeason").innerHTML=`<div class="hub-key">${TEAMS.map(x=>`<span><i style="background:${esc(x.color)}"></i>${esc(x.label)}</span>`).join("")}</div>`;
  /* what's next */
  const cards=[],when=d=>d===t?"Today":d===S.addDays(t,1)?"Tomorrow":longDay(d);
  const ng=[];TEAMS.forEach(x=>{const d=x.days.find(d=>d.game&&d.date>=t);if(d)ng.push({x,d});});ng.sort((a,b)=>a.d.date<b.d.date?-1:1);
  ng.slice(0,2).forEach(({x,d})=>{const g=d.game;cards.push(`<div class="sc-nx" style="border-left-color:${esc(x.color)}"><small>${esc(x.label)} · Next game · ${esc(when(d.date))}${g.event?` · ${esc(g.event)}`:""}</small><b>${g.home?"vs":"at"} ${esc(g.opponent||"Game")}</b><span>${[g.time?ampm(g.time):"Time TBD",g.home?"Home":"Away",g.location].filter(Boolean).map(esc).join(" · ")}${d.notes.filter(isBus).length?`<br>${esc(d.notes.filter(isBus).join(" · "))}`:""}</span></div>`);});
  $("#scNext").innerHTML=cards.join("");$("#scNext").hidden=!cards.length;
  renderCalButtons();
  const months=monthsMulti();
  if(!months.length){$("#calMonths").innerHTML=`<div class="empty">Nothing on the schedule yet.</div>`;$("#calNav").hidden=true;$("#calGames").innerHTML="";return;}
  const keys=months.map(([y,m])=>y+"-"+m);
  if(!calMonth||!keys.includes(calMonth)){const tk=+t.slice(0,4)+"-"+(+t.slice(5,7)-1);calMonth=keys.includes(tk)?tk:(t<keys[0]?keys[0]:keys[keys.length-1]);}
  const idx=keys.indexOf(calMonth),one=view==="month";
  document.querySelectorAll("[data-v]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===view)));
  $("#calNav").hidden=!one;$("#calNavLabel").textContent=one?`${MONTHS[months[idx][1]]} ${months[idx][0]}`:"";
  $("#calPrev").disabled=idx<=0;$("#calNext").disabled=idx>=keys.length-1;$("#calMonths").classList.toggle("one-month",one);
  const cell=iso=>{const it=itemsOn(iso);return `<button type="button" class="cal-cell hub${iso===t?" today":""}" data-day="${iso}"><span class="d">${+iso.slice(8)}</span>${it.map(x=>`<span class="hub-ev ${x.kind==="bus"?"note":x.kind}"><span class="hub-dots">${x.teams.map(h=>`<i style="background:${esc(h.color)}"></i>`).join("")}</span><b>${esc(x.text)}</b>${x.teams.length<TEAMS.length||x.kind==="game"?`<small>${esc(x.teams.map(h=>h.label).join(", "))}</small>`:""}</span>`).join("")}</button>`;};
  $("#calMonths").innerHTML=(one?[months[idx]]:months).map(([y,m])=>{const n=new Date(y,m+1,0).getDate(),pad=new Date(y,m,1).getDay(),isoD=dd=>`${y}-${String(m+1).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
    let c="";for(let i=0;i<pad;i++)c+=`<div class="cal-cell pad"></div>`;for(let dd=1;dd<=n;dd++)c+=cell(isoD(dd));const tail=(7-((pad+n)%7))%7;for(let i=0;i<tail;i++)c+=`<div class="cal-cell pad"></div>`;
    return `<section class="cal-month"><h3>${MONTHS[m]} ${y}</h3><div class="cal-grid">${DOW.map(x=>`<div class="dow">${x}</div>`).join("")}${c}</div></section>`;}).join("");
  const games=[];TEAMS.forEach(x=>x.days.forEach(d=>{if(d.game)games.push({x,d});}));games.sort((a,b)=>a.d.date<b.d.date?-1:a.d.date>b.d.date?1:0);
  $("#calGames").innerHTML=games.length?`<caption>Game list</caption><thead><tr><th>Date</th><th>Team</th><th>Opponent</th><th>Time</th><th>Location</th></tr></thead><tbody>`+
    games.map(({x,d})=>`<tr data-day="${d.date}"${d.date<t?' style="opacity:.6"':""}><td>${esc(S.dObj(d.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}))}</td><td><i class="hub-dot" style="background:${esc(x.color)}"></i>${esc(x.label)}</td><td class="opp">${esc(d.game.opponent||"")}${d.game.event?`<small class="gl-ev">${esc(d.game.event)}</small>`:""}</td><td>${d.game.time?ampm(d.game.time):"TBD"}</td><td>${d.game.home?"Home":"Away"}${d.game.location?" · "+esc(d.game.location):""}</td></tr>`).join("")+`</tbody>`:"";
  $("#calFoot").textContent="";
}
function openDayMulti(iso){
  $("#scDayTitle").textContent=longDay(iso);const li=[];
  TEAMS.forEach(x=>{const d=x.by[iso];if(!d)return;const tag=`<span class="sc-pill" style="background:${esc(x.color)};color:#fff">${esc(x.label)}</span>`;
    if(d.game)li.push(`<li>${tag}<b>${d.game.event?esc(d.game.event)+": ":""}${d.game.home?"vs":"at"} ${esc(d.game.opponent||"Game")}</b><small>${d.game.time?ampm(d.game.time):"Time TBD"} · ${d.game.home?"Home":"Away"}</small>${d.game.location?`<small>📍 ${esc(d.game.location)}</small>`:""}</li>`);
    if(d.practice)li.push(`<li>${tag}<b>${isTry(d.practice)?"Tryouts":"Practice"} ${span(d.practice.start,d.practice.end)}</b></li>`);
    if(d.off)li.push(`<li>${tag}<b>${d.off.note==="No practice"?"No practice":esc(d.off.note)+" (no practice)"}</b></li>`);
    [...(d.practice?d.practice.notes.filter(n=>!isTryout(n)):[]),...d.notes].forEach(n=>li.push(`<li>${tag}<b>${esc(n)}</b></li>`));});
  $("#scDayList").innerHTML=li.join("")||`<li><small>Nothing scheduled.</small></li>`;
  $("#scDay").showModal();
}

/* ---------- actions ---------- */
function stepMonth(dir){const [y,m]=calMonth.split("-").map(Number);const d=new Date(y,m+dir,1);calMonth=d.getFullYear()+"-"+d.getMonth();render();
  const el=$("#calMonths .cal-month");if(el)el.classList.add(dir>0?"slide-l":"slide-r");}
$("#calPrev").addEventListener("click",()=>stepMonth(-1));
$("#calNext").addEventListener("click",()=>stepMonth(1));
let sx=null,sy=null;
$("#calMonths").addEventListener("touchstart",e=>{if(view!=="month")return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
$("#calMonths").addEventListener("touchend",e=>{if(sx===null)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;sx=null;
  if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){const b=dx<0?$("#calNext"):$("#calPrev");if(!b.disabled)stepMonth(dx<0?1:-1);}},{passive:true});
$("#scDayClose").addEventListener("click",()=>$("#scDay").close());
$("#scDay").addEventListener("click",e=>{if(e.target===$("#scDay"))$("#scDay").close();});
document.addEventListener("click",e=>{
  const v=e.target.closest("[data-v]");if(v){view=v.dataset.v;pref("view",view);render();return;}
  const d=e.target.closest("[data-day]");if(d){openDay(d.dataset.day);return;}
  if(e.target.closest("#scIcs")){
    const parts=TEAMS?TEAMS.map(x=>({list:x.days,prefix:x.label,key:ID+"-"+String(x.id||"").slice(0,8),arrive:+(x.sched.arriveEarly||0),note:x.sched.practiceNote||""})):undefined;
    const text=S.ics(DAYS,{show:CAL.show,team:teamName(),key:ID,arrive:early(),note:prNote(),parts});
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/calendar"}));a.download="team-schedule.ics";document.body.appendChild(a);a.click();a.remove();
  }
});
document.addEventListener("keydown",e=>{if(view!=="month"||document.querySelector("dialog[open]"))return;
  if(e.key==="ArrowLeft"&&!$("#calPrev").disabled)stepMonth(-1);if(e.key==="ArrowRight"&&!$("#calNext").disabled)stepMonth(1);});
/* Back on this page after a while: get the latest. */
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&CAL)load(true);});
setInterval(()=>{if(document.visibilityState==="visible"&&CAL&&!document.querySelector("dialog[open]"))load(true);},5*60*1000);

if(!ID){fail("This calendar link is missing its code. Ask your coach for the link again.");return;}
load();
if(FEED)fetch(FEED,{method:"GET"}).then(r=>r.ok?r.text():"").then(t=>{feedOK=/^BEGIN:VCALENDAR/.test(t);if(CAL)renderCalButtons();}).catch(()=>{});
})();
