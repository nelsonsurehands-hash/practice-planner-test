let SPORT="basketball", CATS=SPORTS.basketball.cats;
let ME={id:"me",name:"Coach"}, STAFF=[], READONLY=false;   // set by boot.js
/* What this person may change on the current team (set by boot.js from their role and permissions). */
const AREAS=["plans","plays","drills","schedule","team","share","staff"];
let PERM={plans:true,plays:true,drills:true,schedule:true,team:true,share:true,staff:true};
function ago(ts){if(!ts)return "";const m=Math.round((Date.now()-ts)/60000);if(m<1)return "just now";if(m<60)return m+" min ago";const h=Math.round(m/60);if(h<24)return h+" hr ago";const d=Math.round(h/24);return d<7?d+" day"+(d>1?"s":"")+" ago":new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});}
function setReadOnly(flag){setPerms(Object.fromEntries(AREAS.map(a=>[a,!flag])));}
/* View mode for saved plays: opening a play shows it locked so nothing changes by accident.
   Tap Edit play to unlock the board and fields; Done locks it again. New plays open unlocked. */
let PLAY_LOCK=false;
function applyPlayLock(){
  const canP=typeof PERM!=="undefined"&&PERM.plays,locked=!canP||PLAY_LOCK;
  ["#pName","#pType","#pCaption","#pNotes","#pOptName","#pForm"].forEach(q=>{const el=$(q);if(el)el.disabled=locked;});
  document.body.classList.toggle("play-locked",!!(canP&&PLAY_LOCK));
  const e=$("#pEditBtn"),d=$("#pDoneBtn");
  if(e)e.hidden=!(canP&&PLAY_LOCK);
  if(d)d.hidden=!(canP&&!PLAY_LOCK&&play&&play.id);
}
function lockPlay(on){PLAY_LOCK=!!on;if(on&&typeof tool!=="undefined"&&tool!=="move"){tool="move";if(typeof setTool==="function")setTool("move");}applyPlayLock();renderEditor();}
function setPerms(p){
  PERM={...p};READONLY=!AREAS.some(a=>PERM[a]);
  document.body.classList.toggle("readonly",READONLY);
  AREAS.forEach(a=>document.body.classList.toggle("no-"+a,!PERM[a]));
  ["#planStart","#planEnd","#planFocus"].forEach(q=>{const el=$(q);if(el)el.disabled=!PERM.plans;});
  applyPlayLock();
  if(cur)renderPlan();
  if(typeof renderPlayLib==="function")renderPlayLib();
}
const sp=()=>SPORTS[SPORT]||SPORTS.basketball;
let PRACTICES=[], SETTINGS={};
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DEFAULT_SETTINGS={sport:"basketball",school:"",mascot:"",teamLabel:"",color:"#5b2a86",weekdayStart:"16:00",weekdayEnd:"18:00",weekendStart:"10:00",weekendEnd:"12:00",
  seasonStart:"",seasonEnd:"",practiceDays:[1,2,3,4,5],games:[],special:[]};
const isoOf=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
function addDays(iso,n){const d=dObj(iso);d.setDate(d.getDate()+n);return isoOf(d);}
/* Special days can stack: a date may have several entries (e.g. "No School" + "Parent meeting",
   or a break on top of a note). A day off on a date always wins over practice. */
function specialsByDate(st){const m={};(st.special||[]).forEach(x=>{if(x.date)(m[x.date]=m[x.date]||[]).push(x);});return m;}
const specialNotes=list=>(list||[]).filter(x=>x.kind!=="off").map(x=>x.note).filter(Boolean);
function computePractices(st){
  const games={};(st.games||[]).forEach(g=>{if(g.date)games[g.date]=g;});
  const special=specialsByDate(st);
  const days=new Set(st.practiceDays||[]), out=new Map();
  const noteFor=(iso,base)=>{const g=games[addDays(iso,1)];const before=g?`Before ${g.opponent||"game"} (${DOW[dObj(g.date).getDay()]})`:"";return [base,before].filter(Boolean).join(" · ");};
  const isOff=l=>(l||[]).some(x=>x.kind==="off"),isExtra=l=>(l||[]).some(x=>x.kind==="extra");
  if(st.seasonStart&&st.seasonEnd&&st.seasonStart<=st.seasonEnd){
    for(let iso=st.seasonStart,guard=0;iso<=st.seasonEnd&&guard<400;iso=addDays(iso,1),guard++){
      const l=special[iso];
      let on=days.has(dObj(iso).getDay())&&!games[iso];
      if(isExtra(l))on=true;
      if(isOff(l))on=false;
      if(on)out.set(iso,noteFor(iso,specialNotes(l).join(" · ")));
    }
  }
  Object.entries(special).forEach(([d,l])=>{if(isExtra(l)&&!isOff(l)&&!out.has(d))out.set(d,noteFor(d,specialNotes(l).join(" · ")));});
  return [...out.entries()].sort((a,b)=>a[0]<b[0]?-1:1);
}
function teamTitle(){return [SETTINGS.school,SETTINGS.mascot].filter(Boolean).join(" ")||"Team";}
function pdfHeader(kind){const k=(kind||SETTINGS.teamLabel||"").toUpperCase();return teamTitle().toUpperCase()+(k?"  |  "+k:"");}
function contrastInk(hex){const m=/^#?([0-9a-f]{6})$/i.exec(hex||"");if(!m)return "#ffffff";const n=parseInt(m[1],16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
  const L=[r,g,b].map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return (0.2126*L[0]+0.7152*L[1]+0.0722*L[2])>0.4?"#17141c":"#ffffff";}
/* Second color and logo. color2 is only used for stripes and fills, so any color stays readable. */
function applyBrand(st){
  const root=document.documentElement,c2=st.color2||"";
  if(c2){root.style.setProperty("--team2",c2);root.classList.add("has-c2");}
  else{root.style.removeProperty("--team2");root.classList.remove("has-c2");}
  const img=document.getElementById("brandLogo");
  if(img){if(st.logo){img.src=st.logo;img.hidden=false;}else{img.removeAttribute("src");img.hidden=true;}}
  applyAppIcon(st);
}
/* ---------- app icon in the team's look ----------
   "colors": the court icon redrawn in the team color (second color for the ball)
   "logo":   the team logo on the team color
   "classic": the original purple icon
   Phones take the icon when the app is added to the home screen, so a coach who changes it
   re-adds the app once to see the new icon. */
function appIconMode(st){return st.appIcon||(st.color&&st.color.toLowerCase()!=="#5b2a86"?"colors":"classic");}
/* Half court in a 336-unit box, true to a real court: lane with free-throw line, the full
   free-throw circle, and a symmetric 3-point line (straight corners joined by an arc around the basket). */
function drawCourtIcon(ctx,N,o){
  const pad=N*(o.pad||88)/512,k=(N-2*pad)/336,X=x=>pad+x*k,Y=y=>pad+y*k;
  ctx.fillStyle=o.bg;
  if(o.round){const r=N*.22;ctx.beginPath();ctx.moveTo(r,0);ctx.arcTo(N,0,N,N,r);ctx.arcTo(N,N,0,N,r);ctx.arcTo(0,N,0,0,r);ctx.arcTo(0,0,N,0,r);ctx.closePath();ctx.fill();}
  else ctx.fillRect(0,0,N,N);
  ctx.strokeStyle=o.line;ctx.lineWidth=12*k;ctx.lineJoin="miter";ctx.lineCap="butt";
  const CX=168,BK=35,R3=160,XC=20,YJ=BK+Math.sqrt(R3*R3-(CX-XC)**2),A=Math.atan2(YJ-BK,CX-XC);
  ctx.strokeRect(X(0),Y(0),336*k,336*k);                                                       // court edge
  ctx.beginPath();ctx.moveTo(X(114),Y(0));ctx.lineTo(X(114),Y(128));ctx.lineTo(X(222),Y(128));ctx.lineTo(X(222),Y(0));ctx.stroke();   // lane + free-throw line
  ctx.beginPath();ctx.arc(X(CX),Y(128),40*k,0,Math.PI*2);ctx.stroke();                          // full free-throw circle
  ctx.beginPath();ctx.moveTo(X(XC),Y(0));ctx.lineTo(X(XC),Y(YJ));ctx.arc(X(CX),Y(BK),R3*k,Math.PI-A,A,true);ctx.lineTo(X(336-XC),Y(0));ctx.stroke();   // 3-point line
  ctx.beginPath();ctx.moveTo(X(CX-22),Y(24));ctx.lineTo(X(CX+22),Y(24));ctx.stroke();           // backboard
  ctx.lineWidth=8*k;ctx.beginPath();ctx.arc(X(CX),Y(BK+3),9*k,0,Math.PI*2);ctx.stroke();         // rim
  ctx.fillStyle=o.ball;ctx.beginPath();ctx.arc(X(250),Y(272),34*k,0,Math.PI*2);ctx.fill();      // ball
}
/* Background behind the logo on the app icon: each school picks what makes its logo readable.
   "none" is see-through; iPhones don't allow that on home-screen icons, so those get white. */
function iconBg(st,opaque){
  const k=st.iconBg||"white";
  const c=k==="team"?st.color||"#5b2a86":k==="team2"?st.color2||"#ffffff":k==="black"?"#000000":k==="custom"?st.iconBgColor||"#ffffff":k==="none"?null:"#ffffff";
  return c||(opaque?"#ffffff":null);
}
function iconCanvas(st,N,opts){
  const c=document.createElement("canvas");c.width=c.height=N;const x=c.getContext("2d");
  const team=st.color||"#5b2a86",ink=contrastInk(team);
  if(opts.mode==="logo"&&opts.img){
    const bg=iconBg(st,opts.opaque);
    if(bg){x.fillStyle=bg;if(opts.round){const r=N*.22;x.beginPath();x.moveTo(r,0);x.arcTo(N,0,N,N,r);x.arcTo(N,N,0,N,r);x.arcTo(0,N,0,0,r);x.arcTo(0,0,N,0,r);x.closePath();x.fill();}else x.fillRect(0,0,N,N);}
    const im=opts.img,box=N*(opts.safe?.62:bg?.78:.92),s=Math.min(box/im.naturalWidth,box/im.naturalHeight),w=im.naturalWidth*s,h=im.naturalHeight*s;
    x.drawImage(im,(N-w)/2,(N-h)/2,w,h);
  }else drawCourtIcon(x,N,{bg:team,line:ink==="#ffffff"?"#ffffff":"#17141c",ball:st.color2||"#f0884a",round:opts.round,pad:opts.safe?120:(opts.round?88:60)});
  return c.toDataURL("image/png");
}
let _iconKey=null,_manifestURL=null;
function applyAppIcon(st){
  const mode=appIconMode(st),key=[mode,st.color,st.color2,st.iconBg,st.iconBgColor,mode==="logo"?(st.logo||"").length+":"+(st.logo||"").slice(-40):""].join("|");
  if(key===_iconKey)return;_iconKey=key;
  const setLinks=(fav,touch,icons)=>{
    const f=document.querySelector('link[rel="icon"]');if(f)f.href=fav;
    const t=document.querySelector('link[rel="apple-touch-icon"]');if(t)t.href=touch;
    const name=[st.mascot||st.school].filter(Boolean)[0]||"Practice Planner";
    const tm=document.querySelector('meta[name="apple-mobile-web-app-title"]');if(tm)tm.content=name;
    const base=location.href.replace(/[#?].*$/,"").replace(/[^/]*$/,"");
    const man={name:`${name} Practice Planner`,short_name:name.slice(0,12),start_url:base,scope:base,display:"standalone",background_color:"#f3f2f6",theme_color:st.color||"#5b2a86",icons};
    try{if(_manifestURL)URL.revokeObjectURL(_manifestURL);_manifestURL=URL.createObjectURL(new Blob([JSON.stringify(man)],{type:"application/manifest+json"}));
      const ml=document.querySelector('link[rel="manifest"]');if(ml)ml.href=_manifestURL;}catch{}
  };
  if(mode==="classic"){setLinks(st.logo||"icons/icon-192.png","icons/apple-touch-icon.png",[{src:location.href.replace(/[^/]*$/,"")+"icons/icon-192.png",sizes:"192x192",type:"image/png"},{src:location.href.replace(/[^/]*$/,"")+"icons/icon-512.png",sizes:"512x512",type:"image/png"}]);return;}
  const go=img=>{
    const m=img?"logo":"colors";
    const i192=iconCanvas(st,192,{mode:m,img,round:true}),i512=iconCanvas(st,512,{mode:m,img,round:true}),
      touch=iconCanvas(st,180,{mode:m,img,round:false,opaque:true}),mask=iconCanvas(st,512,{mode:m,img,round:false,safe:true,opaque:true});
    setLinks(st.logo&&m!=="logo"?st.logo:i192,touch,[{src:i192,sizes:"192x192",type:"image/png"},{src:i512,sizes:"512x512",type:"image/png"},{src:mask,sizes:"512x512",type:"image/png",purpose:"maskable"}]);
  };
  if(mode==="logo"&&st.logo){const im=new Image();im.onload=()=>go(im);im.onerror=()=>go(null);im.src=st.logo;}else go(null);
}
/* A grayscale PNG of the logo for the black-and-white printouts (cached per logo). */
let _grayLogo={src:null,url:null,w:0,h:0};
function grayLogo(src){
  if(!src)return Promise.resolve(null);
  if(_grayLogo.src===src)return Promise.resolve(_grayLogo);
  return new Promise(res=>{const im=new Image();im.onload=()=>{
    const c=document.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext("2d");
    x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0);
    const d=x.getImageData(0,0,c.width,c.height),a=d.data;
    for(let i=0;i<a.length;i+=4){const g=Math.round(.299*a[i]+.587*a[i+1]+.114*a[i+2]);a[i]=a[i+1]=a[i+2]=g;}
    x.putImageData(d,0,0);_grayLogo={src,url:c.toDataURL("image/png"),w:c.width,h:c.height};res(_grayLogo);
  };im.onerror=()=>res(null);im.src=src;});
}
/* Draw the logo in a box (points) at the left edge; returns how far to indent the title beside it. */
async function pdfLogo(doc,left,top,box){
  const g=await grayLogo(SETTINGS.logo);if(!g||!g.w)return 0;
  const s=Math.min(box/g.w,box/g.h),w=g.w*s,h=g.h*s;
  try{doc.addImage(g.url,"PNG",left,top+(box-h)/2,w,h);}catch{return 0;}
  return w+12;
}
/* ---------- features a team uses ----------
   Every team doesn't need everything: an AAU or club team has no bus or snack sign-up, a rec team
   may skip scouting and stats. Each team keeps its own list (settings.features); anything not listed
   is on, so older teams see everything. Turning a feature off only hides it: nothing is deleted. */
const FEATURES=[
  ["plans","Practice plans","Timed plans for each practice","Practice"],
  ["plays","Plays & playbook","Draw plays, share them with players","Practice"],
  ["drills","Drill library","Your drills, by category","Practice"],
  ["game","Gameplans","Starters, matchups, plays to run, the result","Games"],
  ["scout","Scouting reports","Notes on each opponent","Games"],
  ["stats","Stats & live tracker","Track games live, box scores, season stats","Games"],
  ["sched","Game & bus schedule","Every game with bus and food times","Games"],
  ["bus","Bus lists","Who's riding, check-ins, departure times","Parents & travel"],
  ["food","Game-day food sign-up","Parents sign up to bring food or snacks","Parents & travel"],
  ["plink","Parent calendar link","An always-current schedule for families","Parents & travel"]
];
const PROGRAMS={
  school:{label:"School team",help:"Middle school or high school: everything, including bus lists and game-day food.",off:[]},
  aau:{label:"AAU or club",help:"Travel team: no bus lists, food sign-ups or scouting. Plays, stats and the parent calendar stay on.",off:["bus","food","scout"]},
  rec:{label:"Rec or youth league",help:"Keep it simple: practice plans, drills, plays, snack sign-up and the parent calendar.",off:["game","scout","stats","sched","bus"]}
};
const featuresFor=prog=>{const off=(PROGRAMS[prog]||PROGRAMS.school).off;return Object.fromEntries(FEATURES.map(([k])=>[k,!off.includes(k)]));};
function hasFeature(k){const f=(typeof SETTINGS!=="undefined"&&SETTINGS.features)||{};return f[k]!==false;}
/* Hide what this team doesn't use: top tabs, Team sections, Parent Admin items, Home buttons. */
function applyFeatures(){
  document.querySelectorAll("[data-feature]").forEach(el=>{el.hidden=!el.dataset.feature.split(" ").some(hasFeature);});
  const vis=document.querySelector("section.view:not([hidden])");
  if(vis){const tab=document.querySelector(`.tabs [data-tab="${vis.id.replace("view-","")}"]`);if(tab&&tab.hidden&&typeof setTab==="function")setTab("home");}
  if(window.onFeaturesChange)window.onFeaturesChange();
}
function applySettings(st){
  SETTINGS={...DEFAULT_SETTINGS,...(st||{})};
  PRACTICES=computePractices(SETTINGS);
  SPORT=SPORTS[SETTINGS.sport]?SETTINGS.sport:"basketball";refreshSportUI();
  document.documentElement.style.setProperty("--team",SETTINGS.color||"#5b2a86");
  document.documentElement.style.setProperty("--team-ink",contrastInk(SETTINGS.color));
  applyBrand(SETTINGS);
  $("#eyebrow").textContent=[SETTINGS.school,SETTINGS.teamLabel].filter(Boolean).join(" · ");
  $("#brandName").textContent=SETTINGS.mascot||SETTINGS.school||"Team";
  document.title=(SETTINGS.mascot||SETTINGS.school||"Coach")+" Practice Planner";
  const tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.content=SETTINGS.color||"#5b2a86";
  if(cur){buildDateSelect();renderPlan();}
  applyFeatures();
  if(window.onCalChange)window.onCalChange();
}

const toMin=t=>{const [h,m]=(t||"0:0").split(":").map(Number);return h*60+m};
const fmt=m=>{let h=Math.floor(m/60)%24,mm=m%60;const h12=((h+11)%12)+1;return h12+":"+String(mm).padStart(2,"0")};
const dObj=s=>new Date(s+"T12:00:00");
const dLabel=s=>dObj(s).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const catsOf=d=>Array.isArray(d.categories)&&d.categories.length?d.categories:(d.category?[d.category]:[]);
const catLabel=d=>catsOf(d).join(" / ");
const uid=()=>Math.random().toString(36).slice(2,10);

let db=null, canWrite=true;
let drills=[];           // [{id,...}]
let plans={};            // date -> plan
let cur=null;            // current plan object (working copy)
let pickCat="", saveTimer=null;

/* Practice times for a day: a special day's own times (e.g. no-school days start earlier), else weekday/weekend times. */
function practiceTimes(date,st){
  st=st||SETTINGS;const sp=(st.special||[]).find(x=>x.date===date&&x.kind!=="off"&&(x.start||x.end));
  const wk=[0,6].includes(dObj(date).getDay());
  return {start:(sp&&sp.start)||(wk?st.weekendStart:st.weekdayStart)||"16:00",end:(sp&&sp.end)||(wk?st.weekendEnd:st.weekdayEnd)||"18:00"};
}
function defaultPlan(date){
  const t=practiceTimes(date);
  return {date,start:t.start,end:t.end,focus:"",blocks:[]};
}
function todayISO(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}

/* ---------- date select ---------- */
function buildDateSelect(){
  const sel=$("#planDate");
  const known=new Set(PRACTICES.map(p=>p[0]));
  const extra=Object.keys(plans).filter(d=>!known.has(d));
  const all=[...PRACTICES.map(p=>p[0]),...extra].sort();
  const note=Object.fromEntries(PRACTICES.map(p=>[p[0],p[1]||""]));
  const prev=sel.value;
  sel.innerHTML=all.map(d=>`<option value="${d}">${dLabel(d)}${note[d]?" — "+esc(note[d]):""}${plans[d]&&plans[d].blocks&&plans[d].blocks.length?"  ✓":""}</option>`).join("");
  if(prev&&all.includes(prev)) sel.value=prev;
  else if(all.length){const t=todayISO();sel.value=all.find(d=>d>=t)||all[all.length-1];}
  else{sel.innerHTML=`<option value="${todayISO()}">${dLabel(todayISO())}</option>`;sel.value=todayISO();}
}

/* ---------- plan rendering ---------- */
function loadPlan(date){
  cur=JSON.parse(JSON.stringify(plans[date]||defaultPlan(date)));
  renderPlan();
}
/* Practice cards: one color per kind of drill (warm-up, shooting, defense…), used on the card edge and the minutes bar. */
let OPEN_BLOCK=null;
const SHAPE={id:null,drag:null};   // the move being aimed or bent in the play editor
const CAT_HUES=[["warm","#14897a"],["stretch","#14897a"],["shoot","#e2672a"],["free throw","#e2672a"],["defen","#b3263a"],["press","#b3263a"],["offen","#6d3bb0"],["play","#6d3bb0"],["condit","#2f62d6"],["transition","#2f62d6"],["break","#8a8794"],["water","#8a8794"],["scrim","#2f8a4a"],["game","#2f8a4a"],["pass","#b07d0c"],["rebound","#a3487e"],["finish","#d14d6b"],["layup","#d14d6b"],["dribbl","#0f7fa8"],["ball hand","#0f7fa8"]];
const CAT_SPARE=["#14897a","#e2672a","#6d3bb0","#2f62d6","#2f8a4a","#b07d0c","#a3487e","#0f7fa8"];
function catColor(c){c=String(c||"").toLowerCase();if(!c)return "#8a8794";const m=CAT_HUES.find(([k])=>c.includes(k));if(m)return m[1];let h=0;for(const ch of c)h=(h*31+ch.charCodeAt(0))>>>0;return CAT_SPARE[h%CAT_SPARE.length];}
function coachField(b){
  if(!PERM.plans)return b.coach?`<div class="led">Led by ${esc(b.coach)}</div>`:"";
  if(STAFF.length<2&&!b.coach)return "";
  const names=[...new Set([...STAFF,b.coach].filter(Boolean))];
  return `<select class="coachSel" data-act="coach" aria-label="Coach leading ${esc(b.name)}"><option value="">Led by: anyone</option>${names.map(n=>`<option value="${esc(n)}"${n===b.coach?" selected":""}>Led by ${esc(n)}</option>`).join("")}</select>`;
}
function renderPlan(){
  $("#planStart").value=cur.start; $("#planEnd").value=cur.end; $("#planFocus").value=cur.focus||"";
  const info=PRACTICES.find(p=>p[0]===cur.date);
  $("#dayTag").innerHTML=info&&info[1]?`<span class="daytag${/Before/.test(info[1])?" game":""}">${esc(info[1])}</span>`:"";
  const s=toMin(cur.start), e=toMin(cur.end), avail=Math.max(0,e-s);
  let t=s, used=0;
  const list=$("#script");
  if(!cur.blocks.length){
    list.innerHTML=`<li class="empty">No drills yet. Add drills from the list on the right, or copy a past plan below. Times fill in automatically from ${fmt(s)}.</li>`;
  } else {
    const ED=PERM.plans&&!READONLY;
    list.innerHTML=cur.blocks.map((b,i)=>{
      const st=t; t+=b.minutes; used+=b.minutes;
      const late=t>e, key=b.id||("i"+i), open=OPEN_BLOCK===key, d=b.drillId&&drills.find(x=>x.id===b.drillId);
      const desc=d&&(d.description||"").trim(), pts=d&&(d.points||"").trim(), has=b.notes||desc||pts;
      return `<li class="block bc${late?" late":""}${ED?" can-drag":""}${open?" open":""}" data-i="${i}" style="--c:${catColor(b.category)}">
        ${ED?`<button type="button" class="drag" data-drag aria-label="Drag ${esc(b.name)} to a new spot" title="Drag to move"><span aria-hidden="true"></span></button>`:"<span></span>"}
        <button type="button" class="bc-main" data-act="open" data-key="${key}" aria-expanded="${open}" aria-label="${esc(b.name)}, ${fmt(st)} to ${fmt(t)}. ${open?"Close":"Open"} notes">
          <span class="time">${fmt(st)} – ${fmt(t)}${late?" · past end":""}</span>
          <span class="name">${esc(b.name)}</span>
          <span class="bc-sub">${b.category?`<b>${esc(b.category)}</b>`:""}${b.coach?`<span>${esc(b.coach)}</span>`:""}${has&&!open?`<span class="bc-has">Notes</span>`:""}</span>
        </button>
        ${ED?`<div class="mins"><button type="button" data-act="dec" aria-label="Less time">−</button><input data-act="min" type="number" min="1" max="90" value="${b.minutes}" aria-label="Minutes"><span class="u" aria-hidden="true">m</span><button type="button" data-act="inc" aria-label="More time">+</button></div><button type="button" class="bc-del" data-act="del" aria-label="Remove ${esc(b.name)}" title="Remove"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg><span class="bc-sure">Remove?</span></button>`:`<div class="bc-min">${b.minutes} min</div>`}
        ${open?`<div class="bc-more">
          ${ED?`<textarea class="note" data-act="note" rows="2" placeholder="Notes for this practice" aria-label="Notes for ${esc(b.name)}">${esc(b.notes||"")}</textarea>`:(b.notes?`<div class="note-ro">${esc(b.notes)}</div>`:"")}
          ${desc||pts?`<div class="bc-drill">${desc?`<p><b>Drill</b>${esc(desc)}</p>`:""}${pts?`<p><b>Coaching points</b>${esc(pts)}</p>`:""}</div>`:""}
          <div class="bc-row">${coachField(b)}${ED?`<button type="button" class="btn sm" data-act="up"${i?"":" disabled"}>Move up</button><button type="button" class="btn sm" data-act="down"${i<cur.blocks.length-1?"":" disabled"}>Move down</button>${d?`<button type="button" class="btn sm" data-act="drill">Edit drill</button>`:""}`:""}</div>
        </div>`:""}</li>`;
    }).join("");
  }
  renderMeter(s,avail,used);
  renderCopyFrom();renderDupTo();
  renderPick();
}
function totals(){const avail=Math.max(0,toMin(cur.end)-toMin(cur.start));const used=cur.blocks.reduce((a,b)=>a+b.minutes,0);return {avail,used,left:avail-used};}
function renderMeter(s,avail,used){
  const left=avail-used, m=$("#meter");
  m.classList.toggle("over",left<0); m.classList.toggle("full",left===0&&used>0);
  $("#mLeft").textContent=Math.abs(left);
  $("#mLeftLabel").textContent=left<0?"min over":left===0&&used>0?"min left · full":"min left";
  $("#planEdited").textContent=cur.editedBy?`Last edited by ${cur.editedBy} · ${ago(cur.editedAt)}`:"";
  $("#mUsed").textContent=used; $("#mAvail").textContent=avail;
  const scale=Math.max(avail,used)||1;
  let acc=0;
  $("#mTrack").innerHTML=cur.blocks.map(b=>{
    const inT=Math.max(0,Math.min(b.minutes,avail-acc)), outT=b.minutes-inT; acc+=b.minutes;
    return (inT?`<i style="width:${inT/scale*100}%;background:${catColor(b.category)}" title="${esc(b.name)}"></i>`:"")+(outT?`<i class="overflow" style="width:${outT/scale*100}%"></i>`:"");
  }).join("");
  const ticks=[];for(let k=0;k<=avail;k+=30)ticks.push(k);if(ticks[ticks.length-1]!==avail)ticks.push(avail);
  $("#mTicks").innerHTML=avail?ticks.map(k=>`<span style="left:${k/scale*100}%">${fmt(s+k)}</span>`).join(""):"";
  if(!msgTimer)$("#mMsg").classList.remove("ok");
  if(left<0&&!msgTimer)$("#mMsg").textContent=`Booked past ${fmt(s+avail)}. Runs ${-left} min over.`;
  else if(!msgTimer)$("#mMsg").textContent="";
}
let msgTimer=null;
function flash(t,ok){const m=$("#mMsg");m.textContent=(ok?"✓ ":"")+t;m.classList.toggle("ok",!!ok);clearTimeout(msgTimer);msgTimer=setTimeout(()=>{msgTimer=null;renderPlan();},3500);}
function renderCopyFrom(){
  const opts=Object.values(plans).filter(p=>p.date!==cur.date&&p.blocks&&p.blocks.length).sort((a,b)=>b.date.localeCompare(a.date));
  $("#copyFrom").innerHTML=`<option value="">Copy a past plan…</option>`+opts.map(p=>`<option value="${p.date}">${dLabel(p.date)}${p.focus?" — "+esc(p.focus):""}</option>`).join("");
}
/* ---------- duplicate this plan to another practice day ---------- */
function nextPracticeAfter(date){const n=PRACTICES.find(p=>p[0]>date);return n?n[0]:null;}
function renderDupTo(){
  const nx=nextPracticeAfter(cur.date),b=$("#dupNext");
  b.disabled=!nx||!cur.blocks.length;b.dataset.armed="";
  b.textContent=nx?`Duplicate to ${dLabel(nx)} ›`:"No later practice";
  b.title=!cur.blocks.length?"Add drills to this plan first":"";
  const opts=PRACTICES.map(p=>p[0]).filter(d=>d!==cur.date);
  $("#dupTo").innerHTML=`<option value="">Duplicate to another day…</option>`+opts.map(d=>`<option value="${d}">${dLabel(d)}${plans[d]&&plans[d].blocks&&plans[d].blocks.length?" (replaces its plan)":""}</option>`).join("");
  $("#dupTo").disabled=!cur.blocks.length;
}
async function duplicateTo(date,replaced){
  if(!date||!cur.blocks.length)return;
  if(saveTimer){clearTimeout(saveTimer);saveTimer=null;cur.editedBy=ME.name;cur.editedAt=Date.now();plans[cur.date]=JSON.parse(JSON.stringify(cur));
    if(db&&canWrite){try{await db.collection("plans").doc(cur.date).set(plans[cur.date]);}catch(e){handleWriteErr(e);return;}}}
  const t=practiceTimes(date),from=cur.date;
  const copy={date,start:t.start,end:t.end,focus:cur.focus||"",blocks:cur.blocks.map(b=>({...b,id:uid()})),editedBy:ME.name,editedAt:Date.now()};
  plans[date]=copy;
  if(db&&canWrite){try{await db.collection("plans").doc(date).set(copy);}catch(e){handleWriteErr(e);return;}}
  const sel=$("#planDate");if(![...sel.options].some(o=>o.value===date))buildDateSelect();
  sel.value=date;loadPlan(date);if(window.onViewChange)window.onViewChange();
  const used=copy.blocks.reduce((a,b)=>a+b.minutes,0),avail=toMin(copy.end)-toMin(copy.start);
  flash(`Copied from ${dLabel(from)}${replaced?", replacing the plan that was here":""}.${used>avail?` This practice is ${avail} min, so ${used-avail} min of drills run past the end.`:""}`,used<=avail);
  window.scrollTo({top:0,behavior:"smooth"});
}
$("#dupNext").addEventListener("click",e=>{
  const nx=nextPracticeAfter(cur.date),b=e.currentTarget;if(!nx)return;
  const has=plans[nx]&&plans[nx].blocks&&plans[nx].blocks.length;
  if(has&&b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent=`${dLabel(nx)} already has a plan. Tap again to replace it`;setTimeout(()=>renderDupTo(),4000);return;}
  duplicateTo(nx,has);
});
$("#dupTo").addEventListener("change",e=>{
  const d=e.target.value;e.target.value="";if(!d)return;
  const has=plans[d]&&plans[d].blocks&&plans[d].blocks.length;
  duplicateTo(d,has);
});

function changed(){renderPlan();scheduleSave();renderDupTo();}
function scheduleSave(){
  if(!db||!canWrite){$("#saved").textContent=db?"View only":"Not saved in this view";return;}
  $("#saved").textContent="Saving…";
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    cur.editedBy=ME.name;cur.editedAt=Date.now();
    const snap=JSON.parse(JSON.stringify(cur));
    plans[snap.date]=snap;
    try{await db.collection("plans").doc(snap.date).set(snap);$("#saved").textContent="Saved";if(cur&&cur.date===snap.date)$("#planEdited").textContent=`Last edited by ${snap.editedBy} · ${ago(snap.editedAt)}`;}
    catch(e){handleWriteErr(e);}
    saveTimer=null;
  },700);
}
function handleWriteErr(e){
  if(e&&e.code==="invalid_argument"){canWrite=false;$("#saved").textContent="View only";showNotice("You do not have permission to change this team data.");}
  else if(e&&e.code==="quota_exceeded"){$("#saved").textContent="Not saved";showNotice("Storage is full. Delete some old plans or drills, then try again.");}
  else{$("#saved").textContent="Not saved — check your connection";}
}
function showNotice(t){const n=$("#notice");n.textContent=t;n.hidden=false;}

function addBlock(b){
  const {left}=totals();
  cur.blocks.push({id:uid(),notes:"",...b});changed();
}

/* Press and hold + or − to keep changing the minutes. */
let holdT=null,holdI=null,held=false;
const stopHold=()=>{clearTimeout(holdT);clearInterval(holdI);holdT=holdI=null;if(held){changed();setTimeout(()=>{held=false;},50);}};
$("#script").addEventListener("pointerdown",e=>{
  const btn=e.target.closest('button[data-act="inc"],button[data-act="dec"]');if(!btn)return;
  const li=btn.closest(".block"),b=cur.blocks[+li.dataset.i],inp=li.querySelector('[data-act="min"]'),up=btn.dataset.act==="inc";held=false;
  holdT=setTimeout(()=>{held=true;holdI=setInterval(()=>{
    if(up){b.minutes=Math.min(90,b.minutes+1);}
    else b.minutes=Math.max(1,b.minutes-1);
    if(inp)inp.value=b.minutes;},110);},420);
});
["pointerup","pointercancel","pointerleave"].forEach(ev=>$("#script").addEventListener(ev,e=>{if(holdT||holdI)stopHold();},true));
$("#script").addEventListener("contextmenu",e=>{if(e.target.closest(".mins"))e.preventDefault();});
$("#script").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-act]"); if(!btn)return;
  if(held&&(btn.dataset.act==="inc"||btn.dataset.act==="dec"))return;
  const i=+btn.closest(".block").dataset.i, b=cur.blocks[i], a=btn.dataset.act;
  if(a==="open"){const k=btn.dataset.key;OPEN_BLOCK=OPEN_BLOCK===k?null:k;renderPlan();if(OPEN_BLOCK){const n=$("#script").querySelector(".block.open .note");if(n&&!n.value)n.focus({preventScroll:true});}return;}
  if(a==="drill"){const d=drills.find(x=>x.id===b.drillId);if(d&&typeof editDrill==="function"){editDrill(d.id);}return;}
  if(a==="inc"){b.minutes=Math.min(90,b.minutes+1);}
  if(a==="dec")b.minutes=Math.max(1,b.minutes-1);
  if(a==="up"&&i>0)[cur.blocks[i-1],cur.blocks[i]]=[cur.blocks[i],cur.blocks[i-1]];
  if(a==="down"&&i<cur.blocks.length-1)[cur.blocks[i+1],cur.blocks[i]]=[cur.blocks[i],cur.blocks[i+1]];
  if(a==="del"){
    /* First tap arms the trash can ("Remove?"), a second tap within 3 seconds removes the drill. */
    if(btn.dataset.armed!=="1"){$("#script").querySelectorAll('.bc-del[data-armed="1"]').forEach(x=>{x.dataset.armed="";x.classList.remove("armed");});
      btn.dataset.armed="1";btn.classList.add("armed");btn.setAttribute("aria-label",`Tap again to remove ${b.name}`);
      clearTimeout(btn._t);btn._t=setTimeout(()=>{if(btn.isConnected){btn.dataset.armed="";btn.classList.remove("armed");btn.setAttribute("aria-label",`Remove ${b.name}`);}},3000);return;}
    cur.blocks.splice(i,1);}
  changed();
});
/* Drag and drop: hold the grip on the left of a drill and slide it to its new spot. */
let drag2=null;
$("#script").addEventListener("pointerdown",e=>{
  const h=e.target.closest("[data-drag]");if(!h||!PERM.plans||(e.pointerType==="mouse"&&e.button!==0))return;
  e.preventDefault();
  const li=h.closest(".block"),items=[...$("#script").querySelectorAll(".block")];
  const from=items.indexOf(li);if(from<0)return;
  const rects=items.map(x=>x.getBoundingClientRect()),gap=items.length>1?(rects[Math.min(1,items.length-1)].top-rects[0].top)||rects[from].height:rects[from].height;
  drag2={li,h,items,rects,from,to:from,y0:e.clientY,s0:window.scrollY,step:rects[from].height+(items.length>1?Math.max(0,rects[1].top-rects[0].bottom):0),pid:e.pointerId,timer:null,lastY:e.clientY};
  try{h.setPointerCapture(e.pointerId);}catch{}
  li.classList.add("dragging");$("#script").classList.add("is-dragging");
  if(navigator.vibrate)try{navigator.vibrate(8);}catch{}
});
function dragMove(y){
  const d=drag2;if(!d)return;d.lastY=y;
  const dy=y-d.y0+(window.scrollY-d.s0);
  d.li.style.transform=`translateY(${dy}px)`;
  const mid=d.rects[d.from].top+d.rects[d.from].height/2+dy;
  let to=d.from;
  d.rects.forEach((r,i)=>{if(i===d.from)return;const m=r.top+r.height/2;if(i<d.from&&mid<m)to=Math.min(to,i);if(i>d.from&&mid>m)to=Math.max(to,i);});
  d.to=to;
  d.items.forEach((x,i)=>{if(i===d.from)return;let sh=0;if(d.from<to&&i>d.from&&i<=to)sh=-d.step;if(to<d.from&&i>=to&&i<d.from)sh=d.step;x.style.transform=sh?`translateY(${sh}px)`:"";});
}
$("#script").addEventListener("pointermove",e=>{
  const d=drag2;if(!d||e.pointerId!==d.pid)return;e.preventDefault();dragMove(e.clientY);
  // near the top or bottom of the screen: scroll so long practices can be reordered in one drag
  const edge=70,vh=window.innerHeight,v=e.clientY<edge?-(edge-e.clientY)/4:e.clientY>vh-edge?(e.clientY-(vh-edge))/4:0;
  clearInterval(d.timer);d.timer=v?setInterval(()=>{window.scrollBy(0,v);dragMove(d.lastY);},16):null;
});
function dragEnd(e,cancel){
  const d=drag2;if(!d||(e&&e.pointerId!==d.pid))return;drag2=null;clearInterval(d.timer);
  d.items.forEach(x=>{x.style.transform="";});d.li.classList.remove("dragging");$("#script").classList.remove("is-dragging");
  if(!cancel&&d.to!==d.from){const [b]=cur.blocks.splice(d.from,1);cur.blocks.splice(d.to,0,b);changed();
    const moved=$("#script").querySelectorAll(".block")[d.to];if(moved){moved.classList.add("just-moved");setTimeout(()=>moved.classList.remove("just-moved"),700);}}
}
$("#script").addEventListener("pointerup",e=>dragEnd(e));
$("#script").addEventListener("pointercancel",e=>dragEnd(e,true));
$("#script").addEventListener("keydown",e=>{const h=e.target.closest("[data-drag]");if(!h||!PERM.plans)return;
  const i=+h.closest(".block").dataset.i,j=e.key==="ArrowUp"?i-1:e.key==="ArrowDown"?i+1:-1;if(j<0||j>=cur.blocks.length)return;
  e.preventDefault();[cur.blocks[i],cur.blocks[j]]=[cur.blocks[j],cur.blocks[i]];changed();const g=$("#script").querySelectorAll("[data-drag]")[j];if(g)g.focus();});

/* Add straight from the plan: a brand-new drill (saved to the library too, unless unchecked), or jump to the library list. */
function openNewDrill(){
  const dlg=$("#newDrillDlg");$("#ndForm").reset();$("#ndMsg").textContent="";
  const left=totals().left;$("#ndMin").value=Math.max(1,Math.min(10,left>0?left:10));
  $("#ndCats").innerHTML=CATS.map(c=>catChip(c,false)).join("")+catAddBtn("ndCats");
  dlg.showModal();setTimeout(()=>$("#ndName").focus(),50);
}
$("#planNew").addEventListener("click",openNewDrill);
$("#ndCancel").addEventListener("click",()=>$("#newDrillDlg").close());
$("#ndForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=titleCase($("#ndName").value.trim());if(!name){$("#ndName").focus();return;}
  const cs=[...document.querySelectorAll("#ndCats input:checked")].map(x=>x.value),minutes=Math.max(1,Math.min(90,parseInt($("#ndMin").value)||10));
  const keep=$("#ndKeep").checked;
  if(keep&&!cs.length){msg($("#ndMsg"),"Pick a category so it's easy to find in the library (or uncheck “save to the drill library”).","err");return;}
  let drillId=null;
  if(keep){
    const same=drills.find(d=>d.name.toLowerCase()===name.toLowerCase());
    if(same)drillId=same.id;
    else{const id=uid()+uid(),body={editedBy:ME.name,name,categories:cs,category:cs[0],minutes,description:"",points:"",createdAt:Date.now()};
      drills.push({id,...body});sortDrills();drillId=id;
      if(db&&canWrite){try{await db.collection("drills").doc(id).set(body);}catch(err){handleWriteErr(err);}}
      renderAllDrills();}
  }
  addBlock({drillId,name,category:cs[0]||"",minutes,notes:$("#ndNote").value.trim()});
  $("#newDrillDlg").close();
  flash(keep?`${name} added to practice and the drill library.`:`${name} added to practice.`,true);
  const last=$("#script").querySelector(".block:last-child");if(last){last.classList.add("just-moved");setTimeout(()=>last.classList.remove("just-moved"),900);}
});
$("#script").addEventListener("change",e=>{
  const el=e.target; const li=el.closest(".block"); if(!li)return;
  const b=cur.blocks[+li.dataset.i];
  if(el.dataset.act==="min"){b.minutes=Math.max(1,Math.min(90,parseInt(el.value)||1));changed();}
  if(el.dataset.act==="note"){b.notes=el.value;scheduleSave();}
  if(el.dataset.act==="coach"){if(el.value)b.coach=el.value;else delete b.coach;scheduleSave();}
});
$("#planDate").addEventListener("change",e=>{loadPlan(e.target.value);if(window.onViewChange)window.onViewChange();});
$("#planStart").addEventListener("change",e=>{cur.start=e.target.value||cur.start;changed();});
$("#planEnd").addEventListener("change",e=>{cur.end=e.target.value||cur.end;changed();});
$("#planFocus").addEventListener("change",e=>{cur.focus=e.target.value;scheduleSave();renderCopyFrom();});
$("#copyFrom").addEventListener("change",e=>{
  const src=plans[e.target.value]; if(!src)return;
  cur.blocks=src.blocks.map(b=>({...b,id:uid()}));
  if(!cur.focus)cur.focus=src.focus||"";
  changed();
});
let clearArmed=false;
$("#clearPlan").addEventListener("click",e=>{
  if(!cur.blocks.length)return;
  if(!clearArmed){clearArmed=true;e.target.textContent="Tap again to clear";setTimeout(()=>{clearArmed=false;e.target.textContent="Clear plan";},3000);return;}
  clearArmed=false;e.target.textContent="Clear plan";cur.blocks=[];changed();
});
$("#copyText").addEventListener("click",async e=>{
  let t=toMin(cur.start);
  const lines=[`${teamTitle()} Practice — ${dLabel(cur.date)} (${fmt(toMin(cur.start))}–${fmt(toMin(cur.end))})`];
  if(cur.focus)lines.push("Focus: "+cur.focus);
  lines.push("");
  cur.blocks.forEach(b=>{const s=t;t+=b.minutes;lines.push(`${fmt(s)}–${fmt(t)}  ${b.name} (${b.minutes} min)${b.coach?" ["+b.coach+"]":""}${b.notes?" — "+b.notes:""}`);});
  const text=lines.join("\n");
  try{await navigator.clipboard.writeText(text);e.target.textContent="Copied";}
  catch{const ta=document.createElement("textarea");ta.value=text;document.body.append(ta);ta.select();try{document.execCommand("copy");e.target.textContent="Copied";}catch{e.target.textContent="Copy failed";}ta.remove();}
  setTimeout(()=>e.target.textContent="Copy as text",1800);
});
/* ---------- quick adds (the one-tap buttons above the drill list) ----------
   Saved with the team, so the whole staff shares them. Each one is either a drill from the
   library (it adds that drill) or just a name and minutes, like a water break. */
const DEFAULT_QUICK=[{name:"Water break",minutes:3},{name:"Free throws",minutes:5},{name:"Running",minutes:10}];
function quickAdds(){return Array.isArray(SETTINGS.quickAdds)?SETTINGS.quickAdds:DEFAULT_QUICK;}
function quickDrill(q){return (q.drillId&&drills.find(d=>d.id===q.drillId))||drills.find(d=>d.name.toLowerCase()===String(q.name||"").toLowerCase())||null;}
function renderQuick(){
  const left=cur?totals().left:999;
  $("#quickBar").innerHTML=quickAdds().map((q,i)=>`<button class="btn" type="button" data-qi="${i}">+ ${esc(q.name)}</button>`).join("");
  const pq=$("#paQuick");if(pq)pq.innerHTML=quickAdds().map((q,i)=>`<button type="button" data-qi="${i}">+ ${esc(q.name)}<small>${q.minutes||""}${q.minutes?"m":""}</small></button>`).join("");
  $("#quickEdit").hidden=!PERM.team;
}
/* Sticky add bar on the plan: search the library, quick adds (water, running…), new drill, photo. */
function paMatches(q){q=q.trim().toLowerCase();if(!q)return [];
  const score=d=>{const n=d.name.toLowerCase();return n.startsWith(q)?0:n.split(/[\s-]+/).some(w=>w.startsWith(q))?1:n.includes(q)?2:catsOf(d).some(c=>c.toLowerCase().includes(q))?3:9;};
  return drills.map(d=>[score(d),d]).filter(x=>x[0]<9).sort((a,b)=>a[0]-b[0]||a[1].name.localeCompare(b[1].name)).slice(0,7).map(x=>x[1]);}
let paSel=0;
function renderPa(){
  const q=$("#paSearch").value,box=$("#paResults");if(!q.trim()){box.hidden=true;box.innerHTML="";return;}
  const list=paMatches(q);paSel=Math.min(paSel,Math.max(0,list.length-1));
  box.innerHTML=list.map((d,i)=>`<button type="button" role="option" class="pa-hit${i===paSel?" on":""}" data-pa="${esc(d.id)}" aria-selected="${i===paSel}"><b>${esc(d.name)}</b><small>${esc(catLabel(d))} · ${d.minutes||10} min</small></button>`).join("")+
    `<button type="button" class="pa-hit pa-new" data-panew><b>+ New drill “${esc(q.trim())}”</b><small>Add it to practice and the drill library</small></button>`;
  box.hidden=false;
}
function paAdd(d){addBlock({drillId:d.id,name:d.name,category:catLabel(d),minutes:d.minutes||10});$("#paSearch").value="";renderPa();
  const last=$("#script").querySelector(".block:last-child");if(last){last.classList.add("just-moved");setTimeout(()=>last.classList.remove("just-moved"),800);}}
$("#paSearch").addEventListener("input",()=>{paSel=0;renderPa();});
$("#paSearch").addEventListener("keydown",e=>{const list=paMatches($("#paSearch").value);
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();paSel=(paSel+(e.key==="ArrowDown"?1:-1)+list.length)%Math.max(1,list.length);renderPa();}
  if(e.key==="Enter"){e.preventDefault();if(list[paSel])paAdd(list[paSel]);else if($("#paSearch").value.trim())paNew();}
  if(e.key==="Escape"){$("#paSearch").value="";renderPa();}});
function paNew(){const v=$("#paSearch").value.trim();$("#paSearch").value="";renderPa();openNewDrill();if(v)$("#ndName").value=v;}
$("#planAdd").addEventListener("click",e=>{
  const h=e.target.closest("[data-pa]");if(h){const d=drills.find(x=>x.id===h.dataset.pa);if(d)paAdd(d);return;}
  if(e.target.closest("[data-panew]")){paNew();return;}
  const b=e.target.closest("[data-qi]");if(b){const q=quickAdds()[+b.dataset.qi];if(!q)return;const d=quickDrill(q);
    addBlock(d?{drillId:d.id,name:d.name,category:catsOf(d)[0]||"",minutes:q.minutes||d.minutes||10}:{drillId:null,name:q.name,category:"",minutes:q.minutes||5});}
});
document.addEventListener("click",e=>{if(!e.target.closest("#planAdd")){const box=$("#paResults");if(box&&!box.hidden)box.hidden=true;}});
$("#paSearch").addEventListener("focus",()=>{if($("#paSearch").value.trim())renderPa();});
$("#quickBar").addEventListener("click",e=>{
  const b=e.target.closest("[data-qi]");if(!b)return;const q=quickAdds()[+b.dataset.qi];if(!q)return;
  const d=quickDrill(q);
  addBlock(d?{drillId:d.id,name:d.name,category:catsOf(d)[0]||"",minutes:q.minutes||d.minutes||10}:{drillId:null,name:q.name,category:"",minutes:q.minutes||5});
});
let qeDraft=null;
function renderQE(){
  $("#qeList").innerHTML=qeDraft.length?qeDraft.map((q,i)=>`<div class="qe-row"><span class="qe-name">${esc(q.name)}${q.drillId?` <small>drill</small>`:""}</span>
    <input type="number" min="1" max="90" value="${q.minutes}" data-qmin="${i}" aria-label="Minutes for ${esc(q.name)}"><span class="qe-unit">min</span>
    <button class="icon" type="button" data-qup="${i}" aria-label="Move ${esc(q.name)} left"${i?"":" disabled"}>↑</button>
    <button class="icon" type="button" data-qrm="${i}" aria-label="Remove ${esc(q.name)}">✕</button></div>`).join(""):`<p class="help">No quick adds. Add a drill or something else below.</p>`;
  $("#qeDrill").innerHTML=`<option value="">Choose a drill…</option>`+[...drills].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`<option value="${d.id}">${esc(d.name)} (${d.minutes||10} min)</option>`).join("");
}
$("#quickEdit").addEventListener("click",()=>{qeDraft=JSON.parse(JSON.stringify(quickAdds()));renderQE();$("#quickEditor").hidden=false;$("#quickEdit").hidden=true;$("#qeMsg").textContent="";});
$("#qeCancel").addEventListener("click",()=>{$("#quickEditor").hidden=true;renderQuick();});
$("#qeDrill").addEventListener("change",e=>{const d=drills.find(x=>x.id===e.target.value);e.target.value="";if(!d)return;qeDraft.push({drillId:d.id,name:d.name,minutes:d.minutes||10});renderQE();});
$("#qeAddCustom").addEventListener("click",()=>{const n=$("#qeName").value.trim();if(!n){$("#qeName").focus();return;}qeDraft.push({name:n,minutes:Math.max(1,+$("#qeMin").value||5)});$("#qeName").value="";renderQE();});
$("#qeList").addEventListener("click",e=>{
  const r=e.target.closest("[data-qrm]"),u=e.target.closest("[data-qup]");
  if(r){qeDraft.splice(+r.dataset.qrm,1);renderQE();}
  if(u){const i=+u.dataset.qup;[qeDraft[i-1],qeDraft[i]]=[qeDraft[i],qeDraft[i-1]];renderQE();}
});
$("#qeList").addEventListener("input",e=>{const m=e.target.closest("[data-qmin]");if(m)qeDraft[+m.dataset.qmin].minutes=Math.max(1,+m.value||1);});
$("#qeSave").addEventListener("click",async()=>{
  $("#qeMsg").textContent="Saving…";
  try{await saveSettings({...(team.settings||{}),quickAdds:qeDraft});$("#quickEditor").hidden=true;renderQuick();flash("Quick adds saved for your staff.",true);}
  catch(err){$("#qeMsg").textContent="Not saved: "+(err.message||"check your connection");}
});

/* ---------- printable black & white PDF ---------- */
async function buildPdf(){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:"pt",format:"letter"});
  const W=612,H=792,M=40,R=W-M;
  const cols=[M,M+82,M+112,M+280]; // time, min, drill, notes
  let y=M;
  doc.setTextColor(0);doc.setDrawColor(0);
  const lx=M+await pdfLogo(doc,M,M-12,50);
  doc.setFont("helvetica","bold");doc.setFontSize(9);
  doc.text(pdfHeader(),lx,y);y+=24;
  doc.setFontSize(22);doc.text("PRACTICE PLAN",lx,y);
  doc.setFontSize(12);doc.setFont("helvetica","normal");
  const dl=dObj(cur.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  doc.text(dl,R,y-14,{align:"right"});
  doc.text(`${fmt(toMin(cur.start))} – ${fmt(toMin(cur.end))} PM`,R,y,{align:"right"});
  y+=10;doc.setLineWidth(2);doc.line(M,y,R,y);y+=18;
  const info=PRACTICES.find(p=>p[0]===cur.date);
  doc.setFontSize(10.5);
  if(cur.focus){doc.setFont("helvetica","bold");doc.text("FOCUS:",M,y);doc.setFont("helvetica","normal");const f=doc.splitTextToSize(cur.focus,R-M-50);doc.text(f,M+50,y);y+=f.length*13;}
  if(info&&info[1]){doc.setFont("helvetica","bold");doc.text("NOTE:",M,y);doc.setFont("helvetica","normal");doc.text(info[1],M+50,y);y+=13;}
  y+=8;
  const head=()=>{doc.setFont("helvetica","bold");doc.setFontSize(9);
    doc.setFillColor(0);doc.rect(M,y,R-M,18,"F");doc.setTextColor(255);
    ["TIME","MIN","DRILL","COACHING POINTS / NOTES"].forEach((h,i)=>doc.text(h,cols[i]+5,y+12));
    doc.setTextColor(0);y+=18;};
  head();
  let t=toMin(cur.start),used=0;
  cur.blocks.forEach(b=>{
    const s=t;t+=b.minutes;used+=b.minutes;
    const d=b.drillId?drills.find(x=>x.id===b.drillId):null;
    doc.setFontSize(10);
    const nameL=doc.splitTextToSize(b.name+(b.category?` (${b.category})`:""),cols[3]-cols[2]-10);
    const pts=[b.coach?("Led by: "+b.coach):"",b.notes||"",d&&d.points?d.points:""].filter(Boolean).join("\n");
    doc.setFontSize(9);
    const ptsL=pts?doc.splitTextToSize(pts,R-cols[3]-10):[];
    const h=Math.max(nameL.length*12,ptsL.length*11,12)+12;
    if(y+h>H-M-40){doc.addPage();y=M;head();}
    doc.setFontSize(10);doc.setFont("courier","bold");
    doc.text(`${fmt(s)}-${fmt(t)}`,cols[0]+5,y+14);
    doc.setFont("helvetica","normal");doc.text(String(b.minutes),cols[1]+5,y+14);
    doc.setFont("helvetica","bold");doc.text(nameL,cols[2]+5,y+14);
    doc.setFont("helvetica","normal");doc.setFontSize(9);if(ptsL.length)doc.text(ptsL,cols[3]+5,y+13);
    doc.rect(M+0,y,0,0);
    y+=h;doc.setLineWidth(.5);doc.line(M,y,R,y);
    // checkbox-free; vertical rules
    [cols[1],cols[2],cols[3]].forEach(x=>doc.line(x,y-h,x,y));
    doc.line(M,y-h,M,y);doc.line(R,y-h,R,y);
  });
  if(!cur.blocks.length){doc.setFont("helvetica","italic");doc.setFontSize(10);doc.text("No drills planned yet.",M+5,y+16);y+=26;}
  y+=16;doc.setFont("helvetica","bold");doc.setFontSize(10);
  doc.text(`Total planned: ${used} of ${Math.max(0,toMin(cur.end)-toMin(cur.start))} min`,M,y);
  y+=22;
  if(y<H-M-60){doc.text("NOTES",M,y);doc.setLineWidth(.5);y+=20;while(y<H-M-10){doc.line(M,y,R,y);y+=22;}}
  const pids=[...new Set(cur.blocks.map(b=>b.playId).filter(Boolean))];
  for(const id of pids){const p=plays.find(x=>x.id===id);if(p)await addPlayPages(doc,p,false);}
  return doc;
}
$("#printPdf").addEventListener("click",async e=>{
  const btn=e.currentTarget;
  if(!window.jspdf){btn.textContent="PDF tool didn't load";setTimeout(()=>btn.textContent="Printable PDF",2500);return;}
  let doc;try{doc=await buildPdf();}catch{btn.textContent="Couldn't build PDF";setTimeout(()=>btn.textContent="Printable PDF",2500);return;}
  saveFile(`Practice Plan ${cur.date}.pdf`,doc.output("blob"));btn.textContent="PDF downloaded";
  setTimeout(()=>btn.textContent="Printable PDF",2500);
});

/* ---------- bench (drill picker) ---------- */
function renderPickCats(){
  const used=CATS.filter(c=>drills.some(d=>catsOf(d).includes(c)));
  $("#pickCats").innerHTML=[`<button aria-pressed="${!pickCat}" data-c="">All</button>`,...used.map(c=>`<button aria-pressed="${pickCat===c}" data-c="${esc(c)}">${esc(c)}</button>`),...(plays.length?[`<button aria-pressed="${pickCat==="Plays"}" data-c="Plays">Plays</button>`]:[])].join("");
}
function renderPick(){
  const q=$("#pickSearch").value.trim().toLowerCase();
  const list=pickCat==="Plays"?[]:drills.filter(d=>(!pickCat||catsOf(d).includes(pickCat))&&(!q||(d.name+" "+catLabel(d)).toLowerCase().includes(q)));
  const plist=(!pickCat||pickCat==="Plays")?[...plays].sort((a,b)=>a.name.localeCompare(b.name)).filter(p=>!q||(p.name+" "+p.type).toLowerCase().includes(q)):[];
  const left=cur?totals().left:999;
  const pbtn=(attr,name,m)=>`<button ${attr} aria-label="Add ${esc(name)}">Add</button>`;
  if($("#quickEditor").hidden)renderQuick();
  $("#picklist").innerHTML=list.length?list.map(d=>{const m=d.minutes||10;
    const btn=`<button data-id="${d.id}" aria-label="Add ${esc(d.name)}">Add</button>`;
    return `<div class="pick"><div><b>${esc(d.name)}</b><span>${esc(catsOf(d).join(" · "))} · ${m} min</span></div>${btn}</div>`;}).join("")
    :(plist.length?"":`<div class="empty">${drills.length?"No drills match.":"Your drill library is empty. Add drills in the Drill Library tab."}</div>`);
  $("#picklist").innerHTML+=plist.map(p=>`<div class="pick play"><div><b>${esc(p.name)}</b><span>Play · ${esc(p.type)} · 10 min</span></div>${pbtn(`data-play="${p.id}"`,p.name,10)}</div>`).join("");
}
$("#pickCats").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;pickCat=b.dataset.c;renderPickCats();renderPick();});
$("#pickSearch").addEventListener("input",renderPick);
$("#picklist").addEventListener("click",e=>{
  const pb=e.target.closest("button[data-play]");
  if(pb){const p=plays.find(x=>x.id===pb.dataset.play);if(p)addBlock({drillId:null,playId:p.id,name:p.name,category:"Play · "+p.type,minutes:10});return;}
  const b=e.target.closest("button[data-id]");if(!b)return;
  const d=drills.find(x=>x.id===b.dataset.id);
  addBlock({drillId:d.id,name:d.name,category:catLabel(d),minutes:d.minutes||10});
});

/* ---------- library ---------- */
const getCats=()=>[...document.querySelectorAll("#dCats input:checked")].map(x=>x.value);
const setCats=a=>{a.filter(c=>!document.querySelector(`#dCats input[value="${CSS.escape(c)}"]`)).forEach(c=>addCatChip("dCats",c,false));
  document.querySelectorAll("#dCats input[type=checkbox]").forEach(x=>x.checked=a.includes(x.value));};
/* Categories: the sport's list plus any the staff made up for their own drills (kept with the drills, so every coach sees them). */
function mergeCats(){
  const base=sp().cats,hasOther=base.includes("Other"),core=base.filter(c=>c!=="Other");
  const mine=[...new Set(drills.flatMap(catsOf))].filter(c=>c&&!base.includes(c)).sort((a,b)=>a.localeCompare(b));
  const next=[...core,...mine,...(hasOther?["Other"]:[])],changed=next.join("|")!==CATS.join("|");CATS=next;return changed;
}
const catChip=(c,on)=>`<label><input type="checkbox" value="${esc(c)}"${on?" checked":""}><span>${esc(c)}</span></label>`;
const catAddBtn=id=>`<button type="button" class="cat-add" data-catadd="${id}">+ New category</button>`;
function renderCatPick(){const on=getCats();$("#dCats").innerHTML=[...new Set([...CATS,...on])].map(c=>catChip(c,on.includes(c))).join("")+catAddBtn("dCats");}
function renderLibCat(){const v=$("#libCat").value;$("#libCat").innerHTML=`<option value="">All categories</option>`+CATS.map(c=>`<option>${esc(c)}</option>`).join("");if(CATS.includes(v))$("#libCat").value=v;}
function addCatChip(id,name,on){
  const box=document.getElementById(id);if(!box)return;
  const have=[...box.querySelectorAll("input[type=checkbox]")].find(x=>x.value.toLowerCase()===name.toLowerCase());
  if(have){have.checked=on||have.checked;return;}
  const add=box.querySelector(".cat-add,.cat-new");const t=document.createElement("span");t.innerHTML=catChip(name,on);
  box.insertBefore(t.firstChild,add||null);
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-catadd]");if(!b)return;e.preventDefault();
  const id=b.dataset.catadd,w=document.createElement("span");w.className="cat-new";
  w.innerHTML=`<input type="text" maxlength="30" placeholder="New category" aria-label="New category name"><button type="button" class="cat-ok" aria-label="Add category">Add</button>`;
  b.replaceWith(w);const inp=w.querySelector("input");inp.focus();
  const done=keep=>{const v=inp.value.trim().replace(/\s+/g," ");const nm=v?v.charAt(0).toUpperCase()+v.slice(1):"";
    if(keep&&nm)addCatChip(id,nm,true);const nb=document.createElement("span");nb.innerHTML=catAddBtn(id);w.replaceWith(nb.firstChild);
    if(id==="dCats")$("#dCatErr").hidden=true;};
  w.querySelector(".cat-ok").addEventListener("click",()=>done(true));
  inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();done(true);}if(ev.key==="Escape"){ev.preventDefault();done(false);}});
  inp.addEventListener("blur",()=>setTimeout(()=>{if(w.isConnected)done(true);},150));
});
$("#dCats").addEventListener("change",()=>$("#dCatErr").hidden=true);
let editing=null;
function usage(){const u={};Object.values(plans).forEach(p=>(p.blocks||[]).forEach(b=>{if(b.drillId)u[b.drillId]=(u[b.drillId]||0)+1;}));return u;}
function renderLib(){
  $("#drillCount").textContent=drills.length?`(${drills.length})`:"";
  const q=$("#libSearch").value.trim().toLowerCase(), cat=$("#libCat").value, u=usage();
  const list=drills.filter(d=>(!cat||catsOf(d).includes(cat))&&(!q||(d.name+" "+catLabel(d)+" "+d.description+" "+d.points).toLowerCase().includes(q)));
  if(!list.length){$("#library").innerHTML=`<div class="empty">${drills.length?"No drills match your search.":"No drills yet. Add your first drill with the form, and it will show up here and in the practice planner."}</div>`;return;}
  $("#library").innerHTML=CATS.filter(c=>(!cat||c===cat)&&list.some(d=>catsOf(d).includes(c))).map(c=>{
    const ds=list.filter(d=>catsOf(d).includes(c));
    return `<div class="catgroup"><h3>${esc(c)}<small>${ds.length} drill${ds.length>1?"s":""}</small></h3>${ds.map(d=>`
      <article class="drill"><div class="drill-top"><b>${esc(d.name)}</b><span class="drill-meta">${d.minutes} min · used ${u[d.id]||0}×</span></div>
      ${catsOf(d).length>1?`<div class="tags">${catsOf(d).map(x=>`<span class="chip${x===c?" here":""}">${esc(x)}</span>`).join("")}</div>`:""}
      ${d.description?`<p>${esc(d.description)}</p>`:""}
      ${d.points?`<p><strong>Coaching points:</strong> ${esc(d.points)}</p>`:""}
      ${d.editedBy?`<p class="by">Added or edited by ${esc(d.editedBy)}</p>`:""}<div class="actions edit-only"><button class="btn" data-edit="${d.id}">Edit</button><button class="btn" data-copy="drills" data-id="${d.id}">Copy to team</button><button class="btn danger" data-del="${d.id}">Delete</button></div></article>`).join("")}</div>`;
  }).join("");
}
/* Open a drill's edit form in the Drill Library (from a practice card). */
function editDrill(id){const t=$("#tab-lib");if(t)t.click();$("#libSearch").value="";$("#libCat").value="";renderLib();
  setTimeout(()=>{const b=$(`#library [data-edit="${id}"]`);if(b)b.click();},60);}
/* Phones list the drills first; the add/edit form sits below and this brings it into view. */
function showDrillForm(){const f=$("#drillForm");if(matchMedia("(max-width:720px)").matches)f.scrollIntoView({behavior:"smooth",block:"start"});else window.scrollTo({top:0,behavior:"smooth"});setTimeout(()=>$("#dName").focus({preventScroll:true}),350);}
$("#libAddBtn").addEventListener("click",()=>{resetForm();showDrillForm();});
$("#libSearch").addEventListener("input",renderLib);
$("#libCat").addEventListener("change",renderLib);
$("#library").addEventListener("click",async e=>{
  const ed=e.target.closest("[data-edit]"), del=e.target.closest("[data-del]");
  if(ed){const d=drills.find(x=>x.id===ed.dataset.edit);editing=d.id;
    $("#dName").value=d.name;setCats(catsOf(d));$("#dMin").value=d.minutes;$("#dDesc").value=d.description||"";$("#dPoints").value=d.points||"";
    $("#formTitle").textContent="Edit drill";$("#dSave").textContent="Save changes";$("#dCancel").hidden=false;showDrillForm();}
  if(del){
    if(del.dataset.armed!=="1"){del.dataset.armed="1";del.textContent="Tap to confirm";setTimeout(()=>{del.dataset.armed="";del.textContent="Delete";},3000);return;}
    const id=del.dataset.del; drills=drills.filter(x=>x.id!==id); renderAllDrills();
    if(db&&canWrite){try{await db.collection("drills").doc(id).delete();}catch(err){handleWriteErr(err);}}
  }
});
function resetForm(){editing=null;$("#drillForm").reset();setCats([]);$("#dCatErr").hidden=true;$("#dMin").value=10;$("#formTitle").textContent="Add a drill";$("#dSave").textContent="Add drill";$("#dCancel").hidden=true;}
$("#dCancel").addEventListener("click",resetForm);
$("#drillForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const cs=getCats();
  if(!cs.length){$("#dCatErr").hidden=false;return;}
  const body={editedBy:ME.name,name:titleCase($("#dName").value.trim()),categories:cs,category:cs[0],minutes:Math.max(1,parseInt($("#dMin").value)||10),description:$("#dDesc").value.trim(),points:$("#dPoints").value.trim()};
  if(!body.name)return;
  const id=editing||uid()+uid();
  const prev=drills.find(d=>d.id===id);
  body.createdAt=prev?prev.createdAt:Date.now();
  if(prev)Object.assign(prev,body);else drills.push({id,...body});
  sortDrills();renderAllDrills();resetForm();
  if(db&&canWrite){try{await db.collection("drills").doc(id).set(body);}catch(err){handleWriteErr(err);}}
});
function sortDrills(){drills.sort((a,b)=>a.name.localeCompare(b.name));}
function renderAllDrills(){renderLib();renderPickCats();renderPick();}


/* ---------- plays: drawing board + library ---------- */
function hints(t){
  const n=sp().players, L=sp().tools;
  return ({move:"Tap a player to pick what they do (cut, screen, pass…), then tap the spot. Drag to move players and the ball. Tap a line to aim or bend it.",
    o:`Tap to place the next player (1–${n}).`,d:`Tap to place the next defender (X1–X${n}).`,
    ball:"Tap a player to give them the ball.",
    cut:`Tap a player, then tap where they go. Or drag from a player to draw a curved ${(L.cut||"move").toLowerCase()}.`,pass:`Tap the player to ${(L.pass||"pass").toLowerCase()} to. Keep tapping players to ${(L.pass||"pass").toLowerCase()} again in the same step.`,
    dribble:`Tap the player with the ball, then tap where they go. Or drag to draw a ${(L.dribble||"dribble").toLowerCase()}.`,screen:`Tap a player, then tap where they set the ${(L.screen||"screen").toLowerCase()}. Or drag from the player.`,
    label:"Tap a player to give them a label, like PG, QB or 1B.",
    look:"Tap teammates in order: 1st look, 2nd look, 3rd look. Looks are passes the ball carrier can make; they don't move the ball.",
    erase:"Tap a player, the ball or a line to remove it."})[t]||"";
}
let plays=[], play=null, fi=0, tool="move", hist=[], pdirty=false, drag=null, temp=null, hintTimer=null;
const frame=()=>play.frames[fi];

function formTokens(name){
  const f=sp().forms[name]||[];
  const toks=f.map(([n,x,y],i)=>typeof n==="number"?{id:"o"+n,kind:"o",n,x,y}:{id:"o"+(i+1),kind:"o",n:i+1,label:n,x,y});
  if(toks.length){const h=toks[0];toks.push({id:"ball",kind:"ball",x:h.x+13,y:h.y-13});}
  return toks;
}
function blankPlay(){const f=Object.keys(sp().forms)[0];return {id:null,name:"",type:sp().playTypes[0],notes:"",frames:[{caption:"",tokens:f?formTokens(f):[],actions:[]}]};}

/* geometry */
/* editor rendering */
function renderBoard(){{const w=$("#pLookWrap");if(w){const court=["basketball","volleyball"].includes(SPORT);w.hidden=!court;if(court)$("#pLook").value=courtLook();}}$("#board").innerHTML=boardInner(withDefense(frame(),curDefense()),"screen",temp,false,optionGhost())+qaRing()+shapeHandles();shapeBar();renderOptBanner(fi);renderLooks();renderSeq();updUndo();}
/* On the first step of an option, show the step it branches from as faint lines, so the play stays in view. */
function optionGhost(){
  const f=frame();if(!f.opt)return null;const L=playLines(play.frames),o=optionOf(play.frames,L,fi);
  if(!o||o.steps[0]!==fi)return null;const b=play.frames[L.main[o.branch]];return b?b.actions:null;
}
/* The option banner above the board: says loudly when you're looking at an option, not the main play. */
function renderOptBanner(i){
  const L=playLines(play.frames),n=stepName(play.frames,L,i),lead=!n.opt&&anim&&anim.opt?L.options.find(x=>x.id===anim.opt.id):null;
  $("#pOptBanner").hidden=!n.opt&&!lead;$("#boardFrame").classList.toggle("opt",!!n.opt);
  if(n.opt)$("#pOptBanner").innerHTML=`<b>${esc(n.opt.title)}</b><span>Step ${n.opt.steps.indexOf(i)+1} of ${n.opt.steps.length} · ${esc(n.where)}</span>`;
  else if(lead)$("#pOptBanner").innerHTML=`<b>${esc(lead.title)}</b><span>Set-up: the option starts after step ${lead.branch+1}</span>`;
}
function renderSteps(){renderDefPick();
  const L=playLines(play.frames);
  const branches=k=>L.options.filter(o=>o.branch===k).map(o=>o.letter).join("");
  $("#pSteps").innerHTML=L.main.map((i,k)=>{const f=play.frames[i];return `<button class="step st2" aria-pressed="${i===fi}" data-step="${i}" aria-label="Step ${k+1}"><span class="st-th" aria-hidden="true">${boardSVG(f,"screen")}</span><span class="st-t"><b><i>${k+1}</i>Step ${k+1}${branches(k)?`<span class="branch" title="Options branch off here">${branches(k)}</span>`:""}</b><small>${f.caption?esc(f.caption):(f.actions||[]).length?`${f.actions.length} move${f.actions.length>1?"s":""}`:"No moves yet"}</small></span></button>`;}).join("")+
    L.options.map(o=>`<div class="optgroup"><span class="optlabel">${esc(o.title)}<small>after step ${o.branch+1}</small></span>`+
      o.steps.map((i,k)=>`<button class="step opt" aria-pressed="${i===fi}" data-step="${i}">${o.letter}${k+1}</button>`).join("")+`</div>`).join("");
  $("#pDelStep").disabled=L.main.length<2&&!frame().opt;
  $("#pCaption").value=frame().caption||"";
  const o=optionOf(play.frames,L,fi);
  $("#pOptBox").hidden=!o;if(o&&document.activeElement!==$("#pOptName"))$("#pOptName").value=o.name;
  $("#pAddOpt").textContent=o?`+ Another option after step ${o.branch+1}`:`+ Add option after this step`;
  $("#pLines").hidden=!L.options.length;
  $("#pLines").innerHTML=`<span class="lbl">Play</span><button class="btn" data-line="">Main play</button>`+L.options.map(o=>`<button class="btn optbtn" data-line="${o.id}">${esc(o.title)}</button>`).join("");
  renderOptBanner(fi);
}
const fidOf=f=>f.fid||(f.fid=uid());
function renderEditor(){
  if(anim)stopAnim();
  previewDef=null;
  $("#pName").value=play.name;$("#pType").value=play.type;$("#pNotes").value=play.notes||"";fsName();
  renderSteps();renderBoard();
  $("#pStatus").textContent=pdirty?"Unsaved changes":(play.id?"Saved":"");
  $("#pEditTitle").textContent=play.id?(!PERM.plays||PLAY_LOCK?play.name||"Play":"Edit play"):"New play";
  applyPlayLock();
}
function setTool(t){qaClose();tool=t;if(SHAPE.id){SHAPE.id=null;if(play)renderBoard();}document.querySelectorAll("#ptools [data-tool]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tool===t));$("#pHint").textContent=hints(t);$("#labelBox").hidden=true;}
function pflash(t){$("#pHint").textContent=t;clearTimeout(hintTimer);hintTimer=setTimeout(()=>$("#pHint").textContent=hints(tool),3000);}
function markDirty(){pdirty=true;$("#pStatus").textContent="Unsaved changes";}
/* Undo / Redo. Redo keeps what Undo took back, until you change something new or open another play. */
let redo=[],redoFor=null,redoKept=null;
function pushHist(){hist.push(JSON.stringify({frames:play.frames,fi}));if(hist.length>60)hist.shift();redoKept=redo;redo=[];updUndo();}
function redoList(){if(redoFor!==play){redo=[];redoFor=play;}return redo;}
function updUndo(){const r=!!(play&&redoList().length),u=!!hist.length;
  ["#pUndo","#fsUndo"].forEach(q=>{const b=$(q);if(b)b.disabled=!u;});["#pRedo","#fsRedo"].forEach(q=>{const b=$(q);if(b)b.disabled=!r;});}
function applyHist(h){play.frames=h.frames;fi=Math.min(h.fi,play.frames.length-1);markDirty();renderSteps();renderBoard();}

/* pointer handling */
function svgPt(e){const svg=$("#board"),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return {x:Math.max(VB.x+8,Math.min(VB.x+VB.w-8,q.x)),y:Math.max(VB.y+8,Math.min(VB.y+VB.h-8,q.y))};}
function hitTok(p,kinds){let best=null,bd=22;frame().tokens.forEach(t=>{if(kinds&&!kinds.includes(t.kind))return;const d=dist(p,t)-(t.kind==="ball"?6:0);if(d<bd){bd=d;best=t;}});return best;}
/* Where a player ends up at the end of this step (the end of their cut, or where they stand). */
function destOf(fr,id){const a=fr.actions.find(a=>a.from===id&&isMove(a));if(a)return {x:a.x2,y:a.y2};const t=fr.tokens.find(t=>t.id===id);return t?{x:t.x,y:t.y}:null;}
/* A pass to a player always ends where that player will catch it (after their cut). */
function syncPasses(fr){
  fr.actions.forEach(a=>{if(a.type!=="pass"||!a.to)return;const d=destOf(fr,a.to);if(!d){a.to=null;return;}
    const dx=d.x-a.x2,dy=d.y-a.y2;if(Math.abs(dx)+Math.abs(dy)<.5)return;a.x2=d.x;a.y2=d.y;a.cx+=dx/2;a.cy+=dy/2;});
  const caught=new Set();
  fr.actions.forEach(a=>{if(a.type!=="pass")return;
    if(a.from&&caught.has(a.from)){const d=destOf(fr,a.from);if(d){const dx=d.x-a.x1,dy=d.y-a.y1;if(Math.abs(dx)+Math.abs(dy)>=.5){a.x1=d.x;a.y1=d.y;a.cx+=dx/2;a.cy+=dy/2;}}}
    if(a.to)caught.add(a.to);});
  fr.actions.forEach(a=>{if(a.type!=="shot")return;const who=finalHolder(fr);const s=who&&shotStart(fr,who);
    if(!s){fr.actions=fr.actions.filter(x=>x!==a);return;}a.from=who;Object.assign(a,shotArc(s));});
}
/* The teammate at a spot: someone standing there, or someone whose cut ends there. */
function receiverAt(fr,pt,except){let r=null,bd=26;
  fr.tokens.forEach(o=>{if(o.kind!=="o"||o.id===except)return;const d=destOf(fr,o.id),k=Math.min(dist(pt,d),dist(pt,o)+4);if(k<bd){bd=k;r=o;}});return r;}
/* Tap-to-pass: the ball goes from whoever has it now (after earlier passes this step) to the tapped teammate. */
function tapPass(pt){
  const fr=frame(),from=finalHolder(fr),passer=from&&fr.tokens.find(x=>x.id===from);
  if(fr.actions.some(a=>a.type==="shot")){pflash("This step ends with a shot. Tap Shot to remove it before adding passes.");return;}
  if(!passer){pflash(fr.actions.some(a=>a.type==="pass")?"The last pass went to an empty spot. Tap Undo, or start a new step.":"Give a player the ball first (Ball tool), then tap players to pass.");return;}
  const r=receiverAt(fr,pt,from);
  if(!r&&dist(pt,destOf(fr,from))<26){pflash(`${passer.label||passer.n} already has the ball. Tap a teammate to pass to.`);return;}
  const a0=destOf(fr,from),start=catchers(fr).includes(from)||fr.actions.some(a=>a.from===from&&isMove(a))?a0:{x:passer.x,y:passer.y};
  const end=r?destOf(fr,r.id):pt;
  pushHist();
  editStep(()=>{fr.actions.push({id:uid(),type:"pass",from,to:r?r.id:null,x1:start.x,y1:start.y,cx:(start.x+end.x)/2,cy:(start.y+end.y)/2,x2:end.x,y2:end.y});});
  markDirty();renderBoard();
  const n=fr.actions.filter(a=>a.type==="pass").length;
  pflash(r?`Pass ${n}: ${passer.label||passer.n} → ${r.label||r.n}. Tap the next player to pass again${n>1?"":" in this step"}, or Undo.`:`Pass ${n}: ${passer.label||passer.n} → that spot.`);
}
/* Looks: the passes the ball carrier can make this step, numbered in order (1st look, 2nd look…). */
function tapLook(pt){
  const fr=frame(),from=finalHolder(fr),passer=from&&fr.tokens.find(x=>x.id===from);
  if(!passer){pflash("Give a player the ball first (Ball tool), then tap the teammates they look to.");return;}
  const r=receiverAt(fr,pt,from);if(!r){pflash("Tap a teammate to add a look.");return;}
  const n=fr.actions.filter(a=>a.type==="look").length;
  if(fr.actions.some(a=>a.type==="look"&&a.to===r.id)){pflash(`${r.label||r.n} is already a look. Erase it to change the order.`);return;}
  if(n>=4){pflash("Four looks is the most for one step.");return;}
  const start=destOf(fr,from),end=destOf(fr,r.id);
  pushHist();
  editStep(()=>{fr.actions.push({id:uid(),type:"look",from,to:r.id,x1:start.x,y1:start.y,cx:(start.x+end.x)/2,cy:(start.y+end.y)/2,x2:end.x,y2:end.y,name:""});});
  markDirty();renderBoard();renderLooks();
  pflash(`Look ${n+1}: ${passer.label||passer.n} → ${r.label||r.n}. Name it below (optional), or tap the next look.`);
}
function renderLooks(){
  const box=$("#pLooks");if(!box||!play)return;const L=(frame().actions||[]).filter(a=>a.type==="look");box.hidden=!L.length;if(!L.length){box.innerHTML="";return;}
  const ed=PERM.plays&&!PLAY_LOCK,tok=id=>{const t=frame().tokens.find(x=>x.id===id);return t?(t.label||t.n):"spot";};
  box.innerHTML=`<span class="lk-h">Looks this step</span>`+L.map((a,i)=>`<div class="lk-row"><b class="lk-n">${i+1}</b><span class="lk-to">${esc(String(tok(a.from)))} → ${esc(String(tok(a.to)))}</span>${ed?`<input data-lookname="${esc(a.id)}" value="${esc(a.name||"")}" maxlength="40" placeholder="Name it, e.g. Roller, Skip, Backdoor" data-tc><button type="button" class="icon" data-lookdel="${esc(a.id)}" aria-label="Remove look ${i+1}">✕</button>`:a.name?`<span class="lk-name">${esc(a.name)}</span>`:""}</div>`).join("");
}
document.addEventListener("input",e=>{const id=e.target.dataset&&e.target.dataset.lookname;if(!id||!play)return;const a=frame().actions.find(x=>x.id===id);if(a){a.name=e.target.value;markDirty();}});
document.addEventListener("click",e=>{const b=e.target.closest("[data-lookdel]");if(!b||!play)return;pushHist();editStep(()=>{frame().actions=frame().actions.filter(x=>x.id!==b.dataset.lookdel);});markDirty();renderBoard();renderLooks();});
/* Order of actions: the step's cuts, screens, dribbles, passes and shot in the order they happen.
   "Then" waits for the action above to finish; "Same time" runs with it. */
const SEQ_VERB={cut:"cuts",dribble:"dribbles",screen:"sets a screen",shot:"shoots"};
function seqText(fr,a){
  const nm=id=>{const t=fr.tokens.find(x=>x.id===id);return t?String(t.label||t.n):"?";};
  if(a.type==="pass")return `<b>${esc(nm(a.from))}</b> passes to ${a.to?`<b>${esc(nm(a.to))}</b>`:"a spot"}`;
  return `<b>${esc(nm(a.from))}</b> ${SEQ_VERB[a.type]||a.type}`;
}
const SEQ_ICON={cut:'<path d="M3 11L19 3" /><path d="M14 2.5l5 .5-2.4 4.4"/>',dribble:'<path d="M3 11l2.5-3 2.5 2.5 2.5-3 2.5 2.5 2.5-3 2.5 2"/>',
  screen:'<path d="M3 8H17"/><path d="M17 3V13" style="stroke-width:2.6"/>',pass:'<path d="M3 11L19 3" style="stroke-dasharray:3 3"/><path d="M14 2.5l5 .5-2.4 4.4"/>',
  shot:'<path d="M3 12Q10 -2 19 6" style="stroke-dasharray:.1 3.4;stroke-width:2.4"/><circle cx="19" cy="7" r="2.4"/>'};
function renderSeq(){
  const box=$("#pSeq");if(!box||!play)return;const fr=frame(),L=seqList(fr);
  {const o=$("#fsOrder");if(o)o.hidden=L.length<2;}
  if(L.length<2||anim){box.hidden=true;box.innerHTML="";return;}
  box.hidden=false;
  const ed=PERM.plays&&!PLAY_LOCK,own=hasOrder(fr);
  box.innerHTML=`<div class="sq-head"><span class="lk-h">Order of actions</span><span class="sq-mode${own?" own":""}">${own?"Your order":"Automatic"}</span>${ed&&own?`<button type="button" class="sq-reset" data-seqreset>Reset to automatic</button>`:""}</div>
  <ol class="sq-list">${L.map((x,j)=>{const same=j&&x.beat===L[j-1].beat;
    return `<li class="sq-row${same?" same":""}">
      ${j?(ed?`<button type="button" class="sq-link${same?" on":""}" data-seqlink="${j}" aria-label="${same?"Happens at the same time as the action above. Tap to make it wait.":"Waits for the action above. Tap to run it at the same time."}">${same?"Same time":"Then"}</button>`:`<span class="sq-link static">${same?"Same time":"Then"}</span>`):`<span class="sq-link static first">First</span>`}
      <span class="sq-n">${x.beat}</span>
      <svg class="sq-ic" viewBox="0 0 22 14" aria-hidden="true">${SEQ_ICON[x.a.type]||""}</svg>
      <span class="sq-txt">${seqText(fr,x.a)}</span>
      ${ed?`<span class="sq-mv"><button type="button" class="icon" data-sequp="${j}" aria-label="Move earlier"${j?"":" disabled"}>↑</button><button type="button" class="icon" data-seqdn="${j}" aria-label="Move later"${j<L.length-1?"":" disabled"}>↓</button></span>`:""}
    </li>`;}).join("")}</ol>
  ${FS.on?`<button type="button" class="sq-close" data-seqclose aria-label="Close order of actions">✕</button>`:""}
  ${ed?`<p class="sq-hint">${own?"Press Play through to watch it in this order.":"Tap <b>Then</b> or <b>Same time</b>, or use the arrows, to set your own order."}</p>`:""}`;
}
/* Write a new order back: beats from the Then/Same-time links, and the actions list in that order. */
function setSeq(list,same){
  const fr=frame();let b=0;
  list.forEach((x,j)=>{if(!j||!same[j])b++;x.a.beat=b;});
  fr.actions=list.map(x=>x.a).concat(fr.actions.filter(a=>a.type==="look"));
  markDirty();renderBoard();
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-seqclose]")){document.querySelector("#view-plays .board-card").classList.remove("show-seq");const o=$("#fsOrder");if(o)o.setAttribute("aria-expanded","false");return;}
  const t=e.target.closest("[data-seqlink],[data-sequp],[data-seqdn],[data-seqreset]");if(!t||!play||!t.closest("#pSeq"))return;
  if(!PERM.plays||PLAY_LOCK)return;
  const fr=frame(),L=seqList(fr),same=L.map((x,j)=>j>0&&x.beat===L[j-1].beat);
  if(t.dataset.seqreset!==undefined){pushHist();fr.actions.forEach(a=>delete a.beat);markDirty();renderBoard();pflash("Back to automatic timing: screens first, then cuts and passes together.");return;}
  if(t.dataset.seqlink){const j=+t.dataset.seqlink;pushHist();same[j]=!same[j];setSeq(L,same);return;}
  const j=+(t.dataset.sequp||t.dataset.seqdn),k=t.dataset.sequp!==undefined?j-1:j+1;
  if(k<0||k>=L.length)return;
  const ball=x=>x.a.type==="pass"||x.a.type==="shot";
  if(ball(L[j])&&ball(L[k])){pflash("Passes and the shot stay in the order you drew them. Change who moves around them instead.");return;}
  pushHist();[L[j],L[k]]=[L[k],L[j]];setSeq(L,same);
});
/* Who has the ball after this step's passes (null if the last pass goes to an empty spot). */
function finalHolder(fr){const h=holderOf(fr);let id=h?h.id:null;fr.actions.forEach(a=>{if(a.type==="pass")id=a.to||null;});return id;}
/* Players who catch a pass in this step: a later pass from them starts where they caught it. */
function catchers(fr){return fr.actions.filter(a=>a.type==="pass"&&a.to).map(a=>a.to);}
/* A shot leaves from where the shooter is at the end of the step and arcs to the basket or goal. */
function shotStart(fr,id){const d=destOf(fr,id),t=fr.tokens.find(x=>x.id===id),b=fr.tokens.find(x=>x.kind==="ball"),h=holderOf(fr);
  if(!d||!t)return null;return b&&h&&h.id===id&&!catchers(fr).includes(id)?{x:d.x+(b.x-t.x),y:d.y+(b.y-t.y)}:{x:d.x+13,y:d.y-13};}
function shotArc(s){const T=sp().target,len=Math.hypot(T.x-s.x,T.y-s.y),lift=Math.max(22,len*.32);
  const mx=(s.x+T.x)/2,my=(s.y+T.y)/2,nx=(T.y-s.y)/(len||1),ny=-(T.x-s.x)/(len||1),side=ny<0?1:-1;
  return {x1:s.x,y1:s.y,cx:mx+nx*lift*side,cy:my+ny*lift*side,x2:T.x,y2:T.y};}
/* After a change in step i, carry the new end positions into the following steps,
   but only for players and the ball that were just sitting where the old step left them. */
function carryForward(i,before){
  const after=nextTokens(play.frames[i]);
  const L=playLines(play.frames),seqs=[lineIdx(L,null),...L.options.map(o=>lineIdx(L,o))].filter(q=>q.includes(i));
  seqs.forEach(seq=>after.forEach(n=>{
    const o=before.find(x=>x.id===n.id);if(!o||dist(o,n)<1)return;
    for(let q=seq.indexOf(i)+1;q<seq.length;q++){
      const fj=play.frames[seq[q]],t=fj.tokens.find(x=>x.id===n.id);
      if(!t||dist(t,o)>2)break;
      const dx=n.x-t.x,dy=n.y-t.y;
      if(t.kind!=="ball"){const h=holderOf(fj);const b=fj.tokens.find(x=>x.kind==="ball");
        fj.actions.forEach(a=>{if(a.from===t.id){a.x1+=dx;a.y1+=dy;a.cx+=dx/2;a.cy+=dy/2;}});
        t.x=n.x;t.y=n.y;
        if(h&&h.id===t.id&&b&&!after.some(x=>x.kind==="ball"&&before.some(y=>y.kind==="ball"&&dist(x,y)>=1))){b.x+=dx;b.y+=dy;}
        syncPasses(fj);
        if(fj.actions.some(a=>a.from===t.id&&isMove(a)))break;
      }else{
        t.x=n.x;t.y=n.y;
        const h=holderOf(fj);
        if(fj.actions.some(a=>!isMove(a))||(h&&fj.actions.some(a=>a.from===h.id&&isMove(a))))break;
      }
    }
  }));
}
/* Run an edit on the current step, then keep the arrows and later steps in line with it. */
function editStep(fn){const before=nextTokens(frame());fn();syncPasses(frame());carryForward(fi,before);}
function hitAct(p){let best=null,bd=12;frame().actions.forEach(a=>{samples(a).forEach(q=>{const d=dist(p,q);if(d<bd){bd=d;best=a;}});});return best;}

const board=$("#board");
board.addEventListener("pointerdown",e=>{
  if(!play||anim||!PERM.plays||PLAY_LOCK)return;
  const p=svgPt(e), fr=frame();
  if(QA.menu){qaClose();return;}
  if(QA.type){qaTap(p);return;}
  if(tool==="move"){
    const sa=shapeAct();
    if(sa){const h=shapeHnd(sa),de=dist(p,h.end),db=dist(p,h.bend);
      if(Math.min(de,db)<24){pushHist();SHAPE.drag={which:de<=db?"end":"bend",before:nextTokens(fr),moved:false};board.setPointerCapture(e.pointerId);return;}}
    const t=hitTok(p);
    if(!t){const a=hitAct(p);if(a&&SHAPEABLE(a)){shapeSel(a);return;}if(sa)shapeSel(null);return;}
    if(sa)shapeSel(null);
    pushHist();const h=holderOf(fr);
    drag={t,dx:p.x-t.x,dy:p.y-t.y,ball:t.kind!=="ball"&&h&&h.id===t.id?fr.tokens.find(x=>x.kind==="ball"):null,moved:false,before:nextTokens(fr)};
    board.setPointerCapture(e.pointerId);return;
  }
  if(tool==="d"&&AUTO_DEF((curDefense()||{}).type)){pflash("The defense is set to move on its own. To place defenders by hand, set Defense to “Place my own”.");return;}
  if(tool==="o"||tool==="d"){
    const used=fr.tokens.filter(t=>t.kind===tool).map(t=>t.n);
    const n=Array.from({length:sp().players},(_,k)=>k+1).find(k=>!used.includes(k));
    if(!n){pflash(`All ${sp().players} ${tool==="o"?"players":"defenders"} are placed. Use Move to reposition.`);return;}
    pushHist();fr.tokens.push({id:tool+n,kind:tool,n,x:p.x,y:p.y});markDirty();renderBoard();return;
  }
  if(tool==="ball"){
    const t=hitTok(p,["o"]);pushHist();
    let b=fr.tokens.find(x=>x.kind==="ball");if(!b){b={id:"ball",kind:"ball"};fr.tokens.push(b);}
    if(t){b.x=t.x+13;b.y=t.y-13;}else{b.x=p.x;b.y=p.y;}
    markDirty();renderBoard();return;
  }
  if(tool==="label"){
    const t=hitTok(p,["o"]);if(!t){pflash("Tap a player to label them.");return;}
    labelTarget=t.id;$("#labelBox").hidden=false;$("#labelWho").textContent=`Label for player ${t.n}`;$("#labelInput").value=t.label||"";$("#labelInput").focus();return;
  }
  if(tool==="erase"){
    const t=hitTok(p);
    if(t){pushHist();fr.tokens=fr.tokens.filter(x=>x!==t);fr.actions=fr.actions.filter(a=>a.from!==t.id&&a.to!==t.id);markDirty();renderBoard();return;}
    const a=hitAct(p);if(a){pushHist();editStep(()=>{fr.actions=fr.actions.filter(x=>x!==a);});markDirty();renderBoard();}
    return;
  }
  if(tool==="look"){tapLook(p);return;}
  // line tools
  let s=hitTok(p,["o","d"]),st=s?{x:s.x,y:s.y}:null;
  if(tool==="pass"){
    /* Chain passes in one step: start a pass from where a teammate catches the previous one. */
    let bd=24;catchers(fr).forEach(id=>{const d=destOf(fr,id);if(d&&dist(p,d)<bd){bd=dist(p,d);s=fr.tokens.find(x=>x.id===id);st={x:d.x,y:d.y};}});
  }
  st=st||p;
  temp={type:tool,pts:[st],from:s?s.id:null,x1:st.x,y1:st.y,cx:st.x,cy:st.y,x2:st.x,y2:st.y};
  board.setPointerCapture(e.pointerId);
});
board.addEventListener("pointermove",e=>{
  if(SHAPE.drag){const a=shapeAct();if(!a)return;const p=svgPt(e);SHAPE.drag.moved=true;
    if(SHAPE.drag.which==="end"){const keep=shapeHnd(a).bend;a.x2=p.x;a.y2=p.y;a.cx=2*keep.x-(a.x1+a.x2)/2;a.cy=2*keep.y-(a.y1+a.y2)/2;}
    else{a.cx=2*p.x-(a.x1+a.x2)/2;a.cy=2*p.y-(a.y1+a.y2)/2;}   // the line bends through your finger
    syncPasses(frame());renderBoard();return;}
  if(drag){const p=svgPt(e),t=drag.t,ox=t.x,oy=t.y;t.x=p.x-drag.dx;t.y=p.y-drag.dy;const dx=t.x-ox,dy=t.y-oy;
    if(drag.ball){drag.ball.x+=dx;drag.ball.y+=dy;}
    frame().actions.forEach(a=>{if(a.from===t.id){a.x1+=dx;a.y1+=dy;a.cx+=dx/2;a.cy+=dy/2;}});syncPasses(frame());
    drag.moved=true;renderBoard();return;}
  if(temp){const p=svgPt(e),last=temp.pts[temp.pts.length-1];if(dist(p,last)<3)return;temp.pts.push(p);
    const s=temp.pts[0],m=temp.pts[Math.floor(temp.pts.length/2)];
    Object.assign(temp,{x2:p.x,y2:p.y,cx:2*m.x-(s.x+p.x)/2,cy:2*m.y-(s.y+p.y)/2});renderBoard();}
});
function endPointer(){
  if(SHAPE.drag){const d=SHAPE.drag;SHAPE.drag=null;if(d.moved){syncPasses(frame());carryForward(fi,d.before);markDirty();renderBoard();}else{hist.pop();updUndo();}return;}
  if(drag){if(drag.moved){syncPasses(frame());carryForward(fi,drag.before);markDirty();}else{hist.pop();if(redoKept){redo=redoKept;redoKept=null;}updUndo();if(drag.t.kind==="o")qaOpen(drag.t);}drag=null;return;}
  if(!temp)return;
  const t=temp;temp=null;
  const s=t.pts[0],e=t.pts[t.pts.length-1];
  if(t.pts.length<3||dist(s,e)<20){if(t.type==="pass"){tapPass(e);return;}
    const who=t.from&&frame().tokens.find(x=>x.id===t.from&&x.kind==="o");if(who&&t.type!=="look"){qaStart(who,t.type);return;}
    renderBoard();pflash(hints(tool));return;}
  let to=null,end={x:e.x,y:e.y};
  if(t.type==="pass"){
    /* Who catches it: a teammate whose cut ends where you let go, or a teammate standing there.
       The ball goes where they'll be; with nobody there, it goes exactly where you let go. */
    const r=receiverAt(frame(),end,t.from);
    if(r){to=r.id;end=destOf(frame(),r.id);}
  }
  const m=t.pts[Math.floor(t.pts.length/2)],mid={x:(s.x+end.x)/2,y:(s.y+end.y)/2};
  const chord=Math.hypot(end.x-s.x,end.y-s.y)||1;
  const dev=Math.abs((end.x-s.x)*(s.y-m.y)-(s.x-m.x)*(end.y-s.y))/chord;
  const c=dev<10||t.type==="pass"?mid:{x:2*m.x-mid.x,y:2*m.y-mid.y};   // passes are always straight
  pushHist();
  editStep(()=>{frame().actions.push({id:uid(),type:t.type,from:t.from,to,x1:s.x,y1:s.y,cx:c.x,cy:c.y,x2:end.x,y2:end.y});});
  markDirty();renderBoard();
  if(t.type==="pass")pflash(to?`Pass to ${(frame().tokens.find(x=>x.id===to)||{}).n||"player"}: the ball moves to where they catch it. To pass again in this step, draw from that catch spot.`:"Pass to a spot: the ball moves to where you let go.");
}
board.addEventListener("pointerup",endPointer);

/* ---------- Tap a player, pick an action, tap the spot ----------
   With Move: tap a player (no drag) for a menu of what they can do. With Cut, Screen or Dribble:
   tap a player, then tap where they go. Saves drawing lines by hand; a player's new cut, screen or
   dribble replaces the one they had in this step. */
const QA={menu:null,id:null,type:null};
const QA_LBL={cut:"Cut",screen:"Screen",dribble:"Dribble",pass:"Pass",shot:"Shoot"};
const QA_VERB={cut:"cuts to",screen:"sets the screen",dribble:"dribbles to",pass:"passes to"};
const toolOn=k=>{const b=document.querySelector(`#ptools [data-tool="${k}"]`);return !b||!b.hidden;};
function qaWho(){return QA.id&&frame().tokens.find(x=>x.id===QA.id);}
function qaRing(){const t=qaWho();if(!t)return "";const d=t;
  return `<circle cx="${d.x}" cy="${d.y}" r="22" style="fill:none;stroke:var(--accent);stroke-width:3;stroke-dasharray:5 4"/>`;}
function qaClose(){const had=QA.menu||QA.id;if(QA.menu)QA.menu.remove();QA.menu=null;QA.id=null;QA.type=null;if(had&&play)renderBoard();}
function qaOpen(t){
  qaClose();const fr=frame(),has=finalHolder(fr)===t.id,shot=fr.actions.some(a=>a.type==="shot");
  const opts=[...(has?["dribble","pass",...(shot?[]:["shot"])]:[]),"cut","screen"].filter(k=>k==="shot"||toolOn(k));
  QA.id=t.id;renderBoard();
  const m=document.createElement("div");m.className="qa-menu";m.setAttribute("role","menu");
  m.innerHTML=`<b>${esc(String(t.label||t.n))}</b>`+opts.map(k=>`<button type="button" role="menuitem" data-qa="${k}">${esc((k!=="shot"&&sp().tools[k])||QA_LBL[k])}</button>`).join("")+`<button type="button" class="qa-x" data-qa="x" aria-label="Close">✕</button>`;
  const fb=$("#boardFrame");fb.appendChild(m);
  const d=t,pt=board.createSVGPoint();pt.x=d.x;pt.y=d.y;const c=pt.matrixTransform(board.getScreenCTM()),r=fb.getBoundingClientRect();
  const w=m.offsetWidth,h=m.offsetHeight;let x=c.x-r.left-w/2,y=c.y-r.top-h-30;if(y<6)y=c.y-r.top+30;
  m.style.left=Math.max(6,Math.min(r.width-w-6,x))+"px";m.style.top=Math.max(6,Math.min(r.height-h-6,y))+"px";
  QA.menu=m;
  m.addEventListener("pointerdown",e=>e.stopPropagation());
  m.addEventListener("click",e=>{const b=e.target.closest("[data-qa]");if(!b)return;const k=b.dataset.qa,who=qaWho();
    if(k==="x"||!who){qaClose();return;}
    if(k==="shot"){qaClose();$("#pShot").click();return;}
    m.remove();QA.menu=null;qaStart(who,k);});
}
function qaStart(t,type){
  if(QA.menu){QA.menu.remove();QA.menu=null;}
  QA.id=t.id;QA.type=type;renderBoard();
  const n=String(t.label||t.n);
  $("#pHint").textContent=type==="pass"?`Tap the teammate ${n} passes to. Tap ${n} again to cancel.`:`Tap where ${n} ${QA_VERB[type]}. Tap ${n} again to cancel.`;
}
function qaTap(p){
  const fr=frame(),t=qaWho(),type=QA.type;
  if(!t){qaClose();return;}
  const st=destOf(fr,t.id)||t;
  if(dist(p,{x:t.x,y:t.y})<22||dist(p,st)<22){qaClose();$("#pHint").textContent=hints(tool);return;}
  QA.id=null;QA.type=null;
  if(type==="pass"){tapPass(p);renderBoard();return;}
  const s0={x:t.x,y:t.y};
  pushHist();
  editStep(()=>{fr.actions=fr.actions.filter(a=>!(a.from===t.id&&isMove(a)));
    fr.actions.push({id:uid(),type,from:t.id,to:null,x1:s0.x,y1:s0.y,cx:(s0.x+p.x)/2,cy:(s0.y+p.y)/2,x2:p.x,y2:p.y});});
  markDirty();renderBoard();
  pflash(`${t.label||t.n} ${type==="screen"?"sets a screen":type==="dribble"?"dribbles":"cuts"}. Tap the line to aim or bend it, or tap ${t.label||t.n} again to change it.`);
}
board.addEventListener("pointercancel",()=>{drag=null;temp=null;if(SHAPE.drag)SHAPE.drag=null;renderBoard();});

/* ---------- Aim and bend a move ----------
   With Move: tap a cut, dribble or screen line. Drag the round handle to change where it goes
   (its angle and length), drag the diamond to curve it. Straighten takes the curve out. */
const SHAPEABLE=a=>a&&["cut","dribble","screen"].includes(a.type);
function shapeAct(){if(!SHAPE.id||!play)return null;return frame().actions.find(x=>x.id===SHAPE.id)||null;}
function shapeHnd(a){return {end:{x:a.x2,y:a.y2},bend:qpt(a,.5)};}
function shapeHandles(){const a=shapeAct();if(!a||anim||tool!=="move"||!PERM.plays||PLAY_LOCK)return "";const h=shapeHnd(a),s={x:a.x1,y:a.y1};
  const st="fill:#fff;stroke:#e2672a;stroke-width:3";
  return `<g class="shape-h" pointer-events="none"><path d="M${s.x.toFixed(1)} ${s.y.toFixed(1)}L${h.bend.x.toFixed(1)} ${h.bend.y.toFixed(1)}L${h.end.x.toFixed(1)} ${h.end.y.toFixed(1)}" style="fill:none;stroke:#e2672a;stroke-width:1.6;stroke-dasharray:4 5;opacity:.85"/>`+
    `<rect x="${(h.bend.x-8).toFixed(1)}" y="${(h.bend.y-8).toFixed(1)}" width="16" height="16" transform="rotate(45 ${h.bend.x.toFixed(1)} ${h.bend.y.toFixed(1)})" style="${st}"/>`+
    `<circle cx="${h.end.x.toFixed(1)}" cy="${h.end.y.toFixed(1)}" r="10" style="${st}"/></g>`;}
function shapeSel(a){SHAPE.id=a?a.id:null;if(a&&QA.menu)qaClose();renderBoard();}
function shapeBar(){let b=$("#shapeBar");const a=shapeAct();
  if(!a||tool!=="move"||anim||!PERM.plays||PLAY_LOCK){if(b)b.remove();return;}
  if(!b){b=document.createElement("div");b.id="shapeBar";b.className="shape-bar";$("#boardFrame").appendChild(b);
    b.addEventListener("pointerdown",e=>e.stopPropagation());
    b.addEventListener("click",e=>{const k=e.target.closest("[data-shape]");if(!k)return;const x=shapeAct();
      if(k.dataset.shape==="done"||!x){shapeSel(null);return;}
      pushHist();const before=nextTokens(frame());x.cx=(x.x1+x.x2)/2;x.cy=(x.y1+x.y2)/2;syncPasses(frame());carryForward(fi,before);markDirty();renderBoard();});}
  const who=frame().tokens.find(t=>t.id===a.from),nm=who?String(who.label||who.n):"";
  b.innerHTML=`<span><b>${esc(nm)}'s ${esc(a.type)}</b> <i class="sb-dot"></i> aim <i class="sb-dia"></i> bend</span><button type="button" data-shape="straight">Straighten</button><button type="button" data-shape="done">Done</button>`;}

/* toolbar + steps */
$("#ptools").addEventListener("click",e=>{if(anim)stopAnim();const b=e.target.closest("[data-tool]");if(b)setTool(b.dataset.tool);});
let labelTarget=null;
$("#labelForm").addEventListener("submit",e=>{
  e.preventDefault();if(!labelTarget)return;
  const v=$("#labelInput").value.trim().slice(0,3);pushHist();
  play.frames.forEach(f=>f.tokens.forEach(t=>{if(t.id===labelTarget){if(v)t.label=v;else delete t.label;}}));
  $("#labelBox").hidden=true;labelTarget=null;markDirty();renderBoard();
});
$("#labelCancel").addEventListener("click",()=>{$("#labelBox").hidden=true;labelTarget=null;});
/* Rebuild everything that depends on the team's sport. */
function refreshSportUI(){
  const S=sp();CATS=S.cats;
  $("#pType").innerHTML=S.playTypes.map(t=>`<option>${t}</option>`).join("");
  const forms=Object.keys(S.forms);
  $("#pForm").innerHTML=`<option value="">Start from a set…</option>`+forms.map(f=>`<option>${f}</option>`).join("")+`<option>Empty</option>`;
  $("#pShot").hidden=!S.tools.shot;
  ["cut","pass","dribble","screen"].forEach(k=>{const b=document.querySelector(`#ptools [data-tool="${k}"]`);if(!b)return;
    b.hidden=!S.tools[k];if(S.tools[k])b.lastChild.textContent=S.tools[k];});
  {const lb=document.querySelector('#ptools [data-tool="look"]');if(lb)lb.hidden=!S.tools.pass;}
  $("#pDefWrap").hidden=!S.defend;
  $("#board").setAttribute("aria-label",S.board);
  mergeCats();renderCatPick();renderLibCat();
  const tb=document.querySelector(`#ptools [data-tool="${tool}"]`);if(tb&&tb.hidden)tool="move";
  setTool(tool);
}
$("#pForm").addEventListener("change",e=>{
  const f=e.target.value;if(!f)return;pushHist();
  if(f==="Empty"){frame().tokens=[];frame().actions=[];e.target.value="";markDirty();renderBoard();return;}
  const fr=frame();fr.tokens=fr.tokens.filter(t=>t.kind==="d").concat(formTokens(f));fr.actions=[];
  e.target.value="";markDirty();renderBoard();
});
/* ---------- defense to run the play against ----------
   Auto defenses (man, 2-3, 3-2, box-and-1) place and move the defenders for you. "Place my own"
   keeps hand-placed defenders. In view mode the choice is just a preview; editing saves it. */
let previewDef=null;
function curDefense(){return previewDef||playDefense(play.frames);}
function renderDefPick(){
  const d=curDefense()||{type:"none"},sel=$("#pDef");if(!sel)return;
  sel.innerHTML=DEF_TYPES.map(([v,l])=>`<option value="${v}"${v===(d.type||"none")?" selected":""}>${l}</option>`).join("");
  const os=(frame()?frame().tokens:[]).filter(t=>t.kind==="o").sort((a,b)=>a.n-b.n);
  $("#pChaseWrap").hidden=d.type!=="box1";
  $("#pChase").innerHTML=os.map(o=>`<option value="${o.n}"${String(o.n)===String(d.chase||(os[0]&&os[0].n))?" selected":""}>#${o.n}${o.label?" "+esc(o.label):""}</option>`).join("")||`<option value="1">#1</option>`;
}
function setDefense(type,chase){
  const editable=typeof PERM!=="undefined"&&PERM.plays&&!PLAY_LOCK;
  const prev=curDefense()||{type:"none"};
  const next=type==="none"?null:{type,chase:chase||(prev.chase)||undefined};
  if(!editable){previewDef=next||{type:"none"};renderBoard();renderDefPick();
    pflash(PERM&&PERM.plays?"Preview only. Tap Edit play to save a defense with the play.":"Preview: this is how the play looks against that defense.");return;}
  pushHist();
  /* Going from an auto defense to "Place my own": start from where the auto defenders were. */
  if(type==="custom"&&AUTO_DEF(prev.type))play.frames.forEach(f=>{if(!f.tokens.some(t=>t.kind==="d"))
    f.tokens=f.tokens.concat(defenseFor(f.tokens,prev).map(t=>({id:"d"+t.n,kind:"d",n:t.n,x:Math.round(t.x),y:Math.round(t.y)})));});
  if(next)play.frames[0].defense=next;else delete play.frames[0].defense;
  previewDef=null;markDirty();renderBoard();renderDefPick();
  if(AUTO_DEF(type))pflash(`${(DEF_TYPES.find(x=>x[0]===type)||[])[1]}: the defenders move on their own as the ball moves. Press Play through to watch it.`);
}
$("#pDef").addEventListener("change",e=>setDefense(e.target.value));
/* Court look: Hardwood, Whiteboard or Classic. Saved on this device; redraws the board and the play cards. */
$("#pLook").addEventListener("change",e=>{setCourtLook(e.target.value);renderBoard();renderPlayLib();});
$("#pChase").addEventListener("change",e=>setDefense("box1",e.target.value));
$("#pUndo").addEventListener("click",()=>{if(!hist.length){pflash("Nothing to undo.");return;}
  redoList().push(JSON.stringify({frames:play.frames,fi}));const h=JSON.parse(hist.pop());applyHist(h);});
$("#pRedo").addEventListener("click",()=>{const r=redoList();if(!r.length){pflash("Nothing to redo.");return;}
  hist.push(JSON.stringify({frames:play.frames,fi}));const h=JSON.parse(r.pop());applyHist(h);});
let clearStepArmed=false;
$("#pClear").addEventListener("click",e=>{
  if(!frame().actions.length){pflash("No lines to clear on this step.");return;}
  if(!clearStepArmed){clearStepArmed=true;e.currentTarget.textContent="Tap again to clear lines";setTimeout(()=>{clearStepArmed=false;$("#pClear").textContent="Clear lines";},3000);return;}
  clearStepArmed=false;$("#pClear").textContent="Clear lines";pushHist();editStep(()=>{frame().actions=[];});markDirty();renderBoard();
});
$("#pSteps").addEventListener("click",e=>{const b=e.target.closest("[data-step]");if(!b)return;qaClose();if(anim)stopAnim();fi=+b.dataset.step;renderSteps();renderBoard();});
$("#pShot").addEventListener("click",()=>{
  if(anim)stopAnim();
  const fr=frame(),had=fr.actions.find(a=>a.type==="shot");
  if(had){pushHist();editStep(()=>{fr.actions=fr.actions.filter(a=>a!==had);});markDirty();renderBoard();pflash("Shot removed.");return;}
  const who=finalHolder(fr),h=who&&fr.tokens.find(x=>x.id===who);
  if(!h){pflash(fr.actions.some(a=>a.type==="pass")?"The last pass goes to an empty spot, so nobody has the ball to shoot.":"Give a player the ball first (Ball tool), then tap Shot.");return;}
  pushHist();editStep(()=>{fr.actions.push({id:uid(),type:"shot",from:h.id,to:null,...shotArc(shotStart(fr,h.id))});});
  markDirty();renderBoard();pflash(`${h.label||h.n} shoots${catchers(fr).includes(h.id)?" off the catch":fr.actions.some(a=>a.from===h.id&&isMove(a))?" after their move":""}. Tap Shot again to remove it.`);
});
$("#pAddOpt").addEventListener("click",()=>{
  if(anim)stopAnim();
  const L=playLines(play.frames),o=optionOf(play.frames,L,fi);
  const k=o?o.branch:L.main.indexOf(fi),base=play.frames[L.main[k]];
  pushHist();
  const id="opt"+uid(),letter=String.fromCharCode(65+L.options.length);
  /* The option picks up exactly where step k ends: same players, same spots, ball with the same player.
     The main play is untouched; step k's lines show faintly on the first option step for reference. */
  play.frames.push({caption:"",tokens:nextTokens(base),actions:[],opt:id,optName:"",from:fidOf(base)});
  fi=play.frames.length-1;markDirty();renderSteps();renderBoard();
  $("#pOptBanner").scrollIntoView({behavior:"smooth",block:"start"});
  pflash(`Option ${letter} starts where step ${k+1} ends. Draw what happens differently, then name it below.`);
});
$("#pOptName").addEventListener("input",e=>{const f=frame();if(!f.opt)return;play.frames.forEach(x=>{if(x.opt===f.opt)x.optName=e.target.value.trim();});markDirty();
  const keep=e.target.selectionStart;renderSteps();e.target.focus();try{e.target.setSelectionRange(keep,keep);}catch{}});
let delOptArmed=false;
$("#pOptDel").addEventListener("click",e=>{
  const f=frame();if(!f.opt)return;
  if(!delOptArmed){delOptArmed=true;e.currentTarget.textContent="Tap again to delete the option";setTimeout(()=>{delOptArmed=false;$("#pOptDel").textContent="Delete this option";},3000);return;}
  delOptArmed=false;$("#pOptDel").textContent="Delete this option";
  pushHist();const L=playLines(play.frames),o=optionOf(play.frames,L,fi),back=play.frames[L.main[o.branch]];
  play.frames=play.frames.filter(x=>x.opt!==f.opt);fi=Math.max(0,play.frames.indexOf(back));markDirty();renderSteps();renderBoard();
});
$("#pLines").addEventListener("click",e=>{const b=e.target.closest("[data-line]");if(!b)return;if(anim)stopAnim();startAnim(b.dataset.line||"main");});
$("#pDup").addEventListener("click",()=>{
  pushHist();
  const f=frame(),copy=JSON.parse(JSON.stringify(f));copy.actions.forEach(a=>a.id=uid());delete copy.fid;
  play.frames.splice(fi+1,0,copy);fi++;markDirty();renderSteps();renderBoard();
  pflash(`Step ${fi} copied as step ${fi+1}, with the same players and lines.`);
});
$("#pNext").addEventListener("click",()=>{
  pushHist();
  const cf=frame(),nf={caption:"",tokens:nextTokens(cf),actions:[]};
  if(cf.opt)Object.assign(nf,{opt:cf.opt,optName:cf.optName||"",from:cf.from});
  play.frames.splice(fi+1,0,nf);fi++;markDirty();renderSteps();renderBoard();
  pflash(cf.opt?"New option step: players moved to where their lines ended.":"New step: players moved to where their lines ended.");
});


/* ---------- play-through animation ---------- */
let anim=null;
/* k = position in the line being played; anim.seq maps it to the real step */
function animCaption(k){
  const i=anim.seq[k],f=play.frames[i],L=playLines(play.frames),n=stepName(play.frames,L,i);
  $("#pAnimCap").innerHTML=`<b>${n.opt?esc(n.opt.title)+" · ":""}${n.opt?`Step ${n.opt.steps.indexOf(i)+1} of ${n.opt.steps.length}`:n.long}</b>${f.caption?esc(f.caption):""}`;
  document.querySelectorAll("#pSteps [data-step]").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.step===i));
  renderOptBanner(i);
}
/* line: undefined = the line of the step you're on; "main" = main play; or an option id */
function startAnim(line){
  if(QA.id||QA.menu)qaClose();
  if(!play.frames.length)return;
  if(line===undefined&&anim&&anim.paused&&!anim.done){anim.paused=false;anim.last=performance.now();$("#pPlay").innerHTML="&#10074;&#10074; Pause";requestAnimationFrame(tick);return;}
  if(line===undefined&&anim&&!anim.paused){anim.paused=true;$("#pPlay").innerHTML="&#9654; Resume";return;}
  const L=playLines(play.frames);
  const opt=line===undefined?optionOf(play.frames,L,fi):line==="main"?null:L.options.find(o=>o.id===line)||null;
  const seq=lineIdx(L,opt),frames=seq.map(i=>play.frames[i]);
  let start;
  if(line===undefined){const k=seq.indexOf(fi);start=k>=0&&k<seq.length-1?k:0;}
  else start=opt?Math.max(0,opt.branch):0;    // an option plays from the step it branches off
  anim={i:start,seq,frames,opt,phase:"hold",t:0,tr:buildTransition(frames,start),last:performance.now(),paused:false};
  $("#pPlay").innerHTML="&#10074;&#10074; Pause";$("#pStop").hidden=false;$("#boardFrame").classList.add("playing");
  document.querySelectorAll("#pLines [data-line]").forEach(b=>b.setAttribute("aria-pressed",(b.dataset.line||null)===(opt?opt.id:null)));
  board.style.cursor="default";animCaption(start);requestAnimationFrame(tick);
}
function stopAnim(){
  if(!anim)return;anim=null;LOOK_LIT=undefined;
  $("#pPlay").innerHTML="&#9654; Play through";$("#pStop").hidden=true;$("#boardFrame").classList.remove("playing");
  document.querySelectorAll("#pLines [data-line]").forEach(b=>b.removeAttribute("aria-pressed"));
  board.style.cursor="";$("#pAnimCap").textContent="";renderSteps();renderBoard();
}
function tick(now){
  if(!anim||anim.paused)return;
  const spd=+$("#pSpeed").value||1;
  const dtv=(now-anim.last)*spd;anim.t+=dtv;anim.last=now;
  const tr=anim.tr;
  const nLooks=(tr.f.actions||[]).filter(a=>a.type==="look").length;
  const dur=anim.phase==="move"?(tr.moves?(tr.moveDur||DUR.move):0):anim.phase==="pass"?(tr.passCurve?DUR.pass:0):anim.phase==="end"?DUR.end:DUR.hold+(nLooks>2?700*(nLooks-2):0);
  if(anim.t>=dur){
    anim.t=0;
    if(anim.phase==="hold")anim.phase="move";
    else if(anim.phase==="move")anim.phase="pass";
    else if(anim.phase==="pass"){
      if(tr.last){anim.phase="end";}
      else{anim.i++;anim.tr=buildTransition(anim.frames,anim.i);anim.phase="hold";animCaption(anim.i);}
    }
    else if(anim.phase==="end"){
      $("#board").innerHTML=boardInner({tokens:animDefense(anim,animTokens(tr,"pass",1),400,curDefense()),actions:[]},"screen");
      anim.paused=true;$("#pPlay").innerHTML="&#8635; Replay";$("#pAnimCap").innerHTML+=` <span style="color:var(--muted)">· End of play</span>`;
      anim.done=true;return;
    }
    requestAnimationFrame(tick);return;
  }
  const u=dur?anim.t/dur:1;
  const ph=anim.phase==="end"?"pass":anim.phase;
  {const nl=(tr.f.actions||[]).filter(a=>a.type==="look").length;LOOK_LIT=nl&&anim.phase==="hold"?Math.min(nl,Math.floor(u*(nl+1))):undefined;}
  $("#board").innerHTML=boardInner({tokens:animDefense(anim,animTokens(tr,ph,anim.phase==="end"?1:u),dtv,curDefense()),actions:anim.phase==="end"?[]:tr.f.actions},"screen",null,anim.phase!=="hold");
  requestAnimationFrame(tick);
}
$("#pPlay").addEventListener("click",()=>{
  if(anim&&anim.done){const o=anim.opt;anim=null;startAnim(o?o.id:"main");return;}
  startAnim();
});
$("#pStop").addEventListener("click",stopAnim);
document.querySelector(".board-card").addEventListener("click",e=>{const b=e.target.closest("button");if(anim&&b&&!["pPlay","pStop"].includes(b.id)&&!b.closest("#pLines"))stopAnim();},true);
document.querySelector(".board-card").addEventListener("change",e=>{if(anim&&e.target.id==="pForm")stopAnim();},true);

let delStepArmed=false;
$("#pDelStep").addEventListener("click",e=>{
  if(play.frames.length<2)return;
  if(!delStepArmed){delStepArmed=true;e.currentTarget.textContent="Tap again to delete";setTimeout(()=>{delStepArmed=false;$("#pDelStep").textContent="Delete step";},3000);return;}
  delStepArmed=false;$("#pDelStep").textContent="Delete step";
  pushHist();
  const gone=play.frames[fi];
  if(!gone.opt&&gone.fid){   // options that branched off this step now branch off the step before it (or after it)
    const L=playLines(play.frames),k=L.main.indexOf(fi),alt=play.frames[L.main[k-1]!==undefined?L.main[k-1]:L.main[k+1]];
    if(alt)play.frames.forEach(f=>{if(f.opt&&f.from===gone.fid)f.from=fidOf(alt);});
  }
  play.frames.splice(fi,1);fi=Math.max(0,Math.min(fi-1,play.frames.length-1));markDirty();renderSteps();renderBoard();
});
$("#pCaption").addEventListener("input",e=>{frame().caption=e.target.value;markDirty();});
$("#pName").addEventListener("input",e=>{play.name=e.target.value;markDirty();fsName();});
$("#pType").addEventListener("change",e=>{play.type=e.target.value;markDirty();});
$("#pNotes").addEventListener("input",e=>{play.notes=e.target.value;markDirty();});

/* save / new / library */
/* Save play: publishes to the play library. It replaces any draft of this play. Returns true when saved. */
async function savePlay(){
  if(!play.name.trim()){pflash("Give the play a name before saving.");$("#pName").focus();return false;}
  play.name=titleCase(play.name.trim());$("#pName").value=play.name;
  const id=play.id||uid()+uid();
  const body={name:play.name.trim(),type:play.type,notes:play.notes||"",frames:play.frames,updatedAt:Date.now(),editedBy:ME.name};
  play.id=id;delete play.draftOf;delete play.draft;pdirty=false;
  const ex=plays.find(p=>p.id===id);if(ex){Object.keys(ex).forEach(k=>{if(k!=="id")delete ex[k];});Object.assign(ex,body);}else plays.push({id,...body});
  renderPlayLib();renderPickCats();renderPick();renderEditor();
  if(!db||!canWrite){$("#pStatus").textContent=db?"View only":"Not saved in this view";return false;}
  $("#pStatus").textContent="Saving…";
  try{await db.collection("plays").doc(id).set(body);$("#pStatus").textContent="Saved to play library";if(window.clearPlayBackup)clearPlayBackup();return true;}
  catch(err){handleWriteErr(err);$("#pStatus").textContent="Not saved";pdirty=true;return false;}
}
$("#pSave").addEventListener("click",()=>savePlay());
let newArmed=false;
$("#pNew").addEventListener("click",e=>{
  if(window.guardPlay&&!guardPlay(()=>$("#pNew").click()))return;
  play=blankPlay();fi=0;hist=[];pdirty=false;PLAY_LOCK=false;renderEditor();renderPlayLib();$("#pName").focus();
});
function playSummary(frames){const L=playLines(frames),n=L.main.length,k=L.options.length;return `${n} step${n>1?"s":""}${k?` · <b class="optcount">${k} option${k>1?"s":""}</b>`:""}`;}
function renderPlayLib(){
  $("#playCount").textContent=plays.length?`(${plays.length})`:"";
  const q=$("#plSearch").value.trim().toLowerCase();
  const list=[...plays].sort((a,b)=>a.name.localeCompare(b.name)).filter(p=>!q||(p.name+" "+p.type+" "+(p.notes||"")).toLowerCase().includes(q));
  $("#plList").innerHTML=list.length?list.map(p=>`<article class="pcard${play&&play.id===p.id?" open":""}" data-card="${p.id}">
      <div class="pthumb">${boardSVG(p.frames[0],"screen")}</div>
      <div style="min-width:0"><b>${esc(p.name)}</b>${p.draft?` <span class="draft-tag">Draft</span>`:p.draftCopy?` <span class="draft-tag">Draft changes</span>`:""}<span>${esc(p.type)} · ${playSummary(p.frames)}</span>
      <div class="actions"><button class="btn" data-open="${p.id}">${!PERM.plays?"View":"Open"}</button><button class="btn edit-only" data-copy="plays" data-id="${p.id}">Copy</button><button class="btn danger edit-only" data-pdel="${p.id}">Delete</button></div></div></article>`).join("")
    :`<div class="empty">${plays.length?"No plays match.":"No plays saved yet. Draw a play on the board, name it, and tap Save play."}</div>`;
}
$("#plSearch").addEventListener("input",renderPlayLib);
/* ---------- Full-screen play builder ----------
   Pops the builder out over the whole screen: every control moves into one toolbar at the top
   and the court gets the rest of the screen. The same buttons are moved (not copied), so
   everything keeps working; Exit puts them back where they were. */
const FS={on:false,moved:[]};
function fsMove(el,into){if(!el)return;const mark=document.createComment("fs");el.parentNode.insertBefore(mark,el);FS.moved.push([el,mark]);into.appendChild(el);}
function enterFull(){
  if(FS.on)return;FS.on=true;
  const card=document.querySelector("#view-plays .board-card");
  const bar=document.createElement("div");bar.id="fsBar";bar.className="fs-bar";
  bar.innerHTML=`<div class="fs-row fs-head"><button class="btn" type="button" id="fsExit">✕ Exit</button><b class="fs-name" id="fsName"></b><span class="fs-gap"></span></div>
    <div class="fs-row fs-scroll" id="fsTools"></div>`;
  card.insertBefore(bar,card.firstChild);
  const bot=document.createElement("div");bot.id="fsBot";bot.className="fs-bar fs-bottom";
  bot.innerHTML=`<div class="fs-row fs-scroll" id="fsSteps"></div><div class="fs-row fs-scroll" id="fsPlay"></div>`;
  $("#boardFrame").after(bot);
  const head=bar.querySelector(".fs-head");
  {const u=document.createElement("button");u.type="button";u.className="btn edit-only";u.id="fsUndo";u.setAttribute("aria-label","Undo");u.innerHTML='↶<span class="fs-lbl"> Undo</span>';u.addEventListener("click",()=>$("#pUndo").click());head.insertBefore(u,head.querySelector(".fs-gap"));
   const r=document.createElement("button");r.type="button";r.className="btn edit-only";r.id="fsRedo";r.setAttribute("aria-label","Redo");r.innerHTML='↷<span class="fs-lbl"> Redo</span>';r.addEventListener("click",()=>$("#pRedo").click());head.insertBefore(r,head.querySelector(".fs-gap"));updUndo();}
  fsMove($("#pEditBtn"),head);fsMove($("#pDoneBtn"),head);fsMove($("#pSave"),head);fsMove($("#pStatus"),head);fsMove($("#pHelp"),head);
  fsMove($("#ptools"),$("#fsTools"));fsMove(document.querySelector("#view-plays .toolbar.edit-only:not(#ptools)"),$("#fsTools"));
  fsMove($("#pSteps").parentNode,$("#fsSteps"));
  fsMove(document.querySelector("#view-plays .player"),$("#fsPlay"));fsMove($("#pLines"),$("#fsPlay"));fsMove($("#pAnimCap"),bot);
  {const o=document.createElement("button");o.type="button";o.className="btn";o.id="fsOrder";o.setAttribute("aria-expanded","false");o.textContent="Order of actions";
   o.addEventListener("click",()=>{const on=card.classList.toggle("show-seq");o.setAttribute("aria-expanded",on);});$("#fsPlay").insertBefore(o,$("#fsPlay").firstChild);}
  fsName();document.body.classList.add("pb-full");card.classList.add("full");
  $("#fsExit").addEventListener("click",exitFull);
  try{const el=document.documentElement;if(el.requestFullscreen&&matchMedia("(pointer:fine)").matches)el.requestFullscreen().catch(()=>{});}catch{}
  window.scrollTo(0,0);renderBoard();
}
function exitFull(){
  if(!FS.on)return;FS.on=false;
  FS.moved.reverse().forEach(([el,mark])=>{mark.parentNode.insertBefore(el,mark);mark.remove();});FS.moved=[];
  const bar=$("#fsBar");if(bar)bar.remove();{const b2=$("#fsBot");if(b2)b2.remove();}
  document.body.classList.remove("pb-full");document.querySelector("#view-plays .board-card").classList.remove("full","show-seq");FS.auto=false;
  try{if(document.fullscreenElement)document.exitFullscreen();}catch{}
  document.querySelector("#view-plays .board-card").scrollIntoView({block:"start"});
}
function fsName(){const n=$("#fsName");if(n)n.textContent=(play&&play.name)||"New play";}
$("#pFull").addEventListener("click",enterFull);
/* Keyboard: Cmd/Ctrl+Z undoes, Shift+Cmd/Ctrl+Z or Ctrl+Y redoes (not while typing in a box). */
document.addEventListener("keydown",e=>{
  if(!(e.metaKey||e.ctrlKey)||e.altKey||!play||!PERM.plays||PLAY_LOCK)return;
  if(e.target.closest&&e.target.closest("input,textarea,select,[contenteditable]"))return;
  if(!document.querySelector("#view-plays")||document.querySelector("#view-plays").hidden)return;
  const k=e.key.toLowerCase();
  if(k==="z"&&!e.shiftKey){e.preventDefault();$("#pUndo").click();}
  else if((k==="z"&&e.shiftKey)||k==="y"){e.preventDefault();$("#pRedo").click();}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&FS.on&&!document.querySelector("dialog[open]"))exitFull();});
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&FS.on&&matchMedia("(pointer:fine)").matches)exitFull();});
/* Phones: editing a play opens the full-screen builder with its toolbar; Done puts it back. */
const phoneEdit=()=>matchMedia("(pointer:coarse)").matches&&Math.min(innerWidth,innerHeight)<700;
function autoFull(){if(phoneEdit()&&!FS.on&&PERM.plays&&!PLAY_LOCK){enterFull();FS.auto=true;}}
$("#pNewTop").addEventListener("click",()=>{$("#pNew").click();if(phoneEdit()&&!PLAY_LOCK){autoFull();return;}document.querySelector("#view-plays .board-card").scrollIntoView({behavior:"smooth",block:"start"});});
/* iPhone: stop pinch and double-tap zoom on the play builder (the page can still be zoomed elsewhere). */
{const card=document.querySelector("#view-plays .board-card");
 ["gesturestart","gesturechange"].forEach(ev=>card.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
 let lastTap=0;card.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTap<320&&!e.target.closest("input,textarea,select,button,a,label"))e.preventDefault();lastTap=now;},{passive:false});
 card.addEventListener("touchmove",e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});}
$("#pToLib").addEventListener("click",()=>document.querySelector("#view-plays .playlib").scrollIntoView({behavior:"smooth",block:"start"}));
$("#plList").addEventListener("click",async e=>{
  let o=e.target.closest("[data-open]");const d=e.target.closest("[data-pdel]");
  /* Tapping anywhere on a play card (picture or name) opens it, same as the button. */
  if(!o&&!d&&!e.target.closest("button")){const card=e.target.closest("[data-card]");if(card)o=card.querySelector("[data-open]");}
  if(o){
    const pid=o.dataset.open;
    if(window.guardPlay&&!guardPlay(()=>{const b=document.querySelector(`#plList [data-open="${CSS.escape(pid)}"]`);if(b)b.click();}))return;
    const p=plays.find(x=>x.id===pid);play=window.playFromSaved?playFromSaved(p):clone(p);fi=0;hist=[];pdirty=false;PLAY_LOCK=true;renderEditor();renderPlayLib();
    document.querySelector("#view-plays .board-card").scrollIntoView({behavior:"smooth",block:"start"});
  }
  if(d){
    if(d.dataset.armed!=="1"){d.dataset.armed="1";d.textContent="Tap to confirm";setTimeout(()=>{d.dataset.armed="";d.textContent="Delete";},3000);return;}
    const id=d.dataset.pdel;plays=plays.filter(x=>x.id!==id);
    if(play&&play.id===id){play.id=null;pdirty=true;renderEditor();}
    renderPlayLib();renderPickCats();renderPick();
    if(db&&canWrite){try{await db.collection("plays").doc(id).delete();}catch(err){handleWriteErr(err);}}
  }
});

/* printing */
/* One frame per moment of a step (for 1a, 1b… in the PDF): players already moved by earlier
   moments stand where they ended up; each frame shows only that moment's moves. */
function beatFrames(f){
  const L=seqList(f),max=L.length?L[L.length-1].beat:0,looks=(f.actions||[]).filter(a=>a.type==="look");
  if(max<2)return [{f,lines:[]}];
  const plain=t=>String(t).replace(/<[^>]+>/g,"");let toks=clone(f.tokens);const out=[];
  for(let b=1;b<=max;b++){
    const acts=L.filter(x=>x.beat===b).map(x=>{const a={...x.a};delete a.beat;return a;});
    const fr={...f,tokens:clone(toks),actions:b===max?acts.concat(looks):acts};
    out.push({f:fr,lines:acts.map(a=>plain(seqText(f,a)))});
    toks=nextTokens({tokens:toks,actions:acts});
  }
  return out;
}
function svgToPng(svg,w){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=w;c.height=Math.round(w*VB.h/VB.w);const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);res(c.toDataURL("image/png"));};img.onerror=()=>rej(new Error("diagram"));img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);});}
async function addPlayPages(doc,p,fresh){
  const W=612,H=792,M=40,R=W-M,IW=300,IH=IW*VB.h/VB.w;
  if(!fresh)doc.addPage();
  let y=M;
  const lx=M+await pdfLogo(doc,M,M-12,44);
  doc.setTextColor(0);doc.setFont("helvetica","bold");doc.setFontSize(9);
  doc.text(pdfHeader("Play"),lx,y);y+=24;
  doc.setFontSize(20);doc.text(p.name.toUpperCase(),lx,y);
  doc.setFont("helvetica","normal");doc.setFontSize(11);doc.text(p.type,R,y,{align:"right"});
  y+=10;doc.setLineWidth(2);doc.line(M,y,R,y);y+=16;
  if(p.notes){doc.setFontSize(10);const n=doc.splitTextToSize(p.notes,R-M);doc.text(n,M,y);y+=n.length*12+4;}
  doc.setFontSize(8.5);doc.setFont("helvetica","italic");
  const L=sp().tools;doc.text([`Solid arrow = ${L.cut.toLowerCase()}`,`Dashed arrow = ${L.pass.toLowerCase()}`,L.dribble&&`Zigzag = ${L.dribble.toLowerCase()}`,L.screen&&`Line with bar = ${L.screen.toLowerCase()}`,L.shot&&`Dotted arc = ${L.shot.toLowerCase()}`].filter(Boolean).join("     "),M,y);y+=14;
  /* Main steps first, then each option under its own heading, boxed with a heavier border. */
  const PL=playLines(p.frames);let lastOpt=null;
  for(const i of displayOrder(PL)){
    const f=p.frames[i],n=stepName(p.frames,PL,i),o=n.opt;
    if(o&&o!==lastOpt){
      if(y+IH+40>H-M){doc.addPage();y=M;}
      y+=6;doc.setFillColor(0);doc.rect(M,y,R-M,22,"F");doc.setTextColor(255);doc.setFont("helvetica","bold");doc.setFontSize(12);
      doc.text(o.title.toUpperCase(),M+8,y+15);doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.text(`Branches off after step ${o.branch+1}`,R-8,y+15,{align:"right"});
      doc.setTextColor(0);y+=32;lastOpt=o;
    }
    /* A step whose moves happen in order (1, then 2…) prints as 1a, 1b…: one small diagram per
       moment, each showing only what happens then, with the steps listed underneath. */
    const parts=beatFrames(f);
    if(parts.length>1){
      const base=o?`${o.letter}${o.steps.indexOf(i)+1}`:String(PL.main.indexOf(i)+1),GW=(R-M-14)/2,GH=GW*VB.h/VB.w;
      if(y+GH+60>H-M){doc.addPage();y=M;}
      doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(o?`OPTION ${o.letter} · STEP ${o.steps.indexOf(i)+1}`:n.short.toUpperCase(),M,y+4);
      if(f.caption){doc.setFont("helvetica","normal");doc.setFontSize(9.5);const c=doc.splitTextToSize(f.caption,R-M-110);doc.text(c,M+100,y+4);y+=Math.max(0,c.length-1)*11;}
      y+=14;
      for(let r=0;r<parts.length;r+=2){
        const row=parts.slice(r,r+2);
        if(y+GH>H-M){doc.addPage();y=M;}
        for(let k=0;k<row.length;k++){const q=row[k],x=M+k*(GW+14);
          const img=await svgToPng(boardSVG({...q.f,defense:curDefense()},"print",700),700);
          doc.addImage(img,"PNG",x,y,GW,GH);doc.setLineWidth(o?2.5:.75);doc.rect(x,y,GW,GH);
          const tag=base+String.fromCharCode(97+r+k);doc.setFillColor(0);doc.roundedRect(x+6,y+6,doc.getTextWidth(tag)+14,17,3,3,"F");
          doc.setTextColor(255);doc.setFont("helvetica","bold");doc.setFontSize(10.5);doc.text(tag,x+13,y+18.5);doc.setTextColor(0);}
        y+=GH+12;
        let hh=0;
        for(let k=0;k<row.length;k++){const q=row[k],x=M+k*(GW+14);let yy=y;doc.setFont("helvetica","normal");doc.setFontSize(9.5);
          q.lines.forEach(t=>{const w=doc.splitTextToSize("• "+t,GW-4);if(yy+w.length*11>H-M+4)return;doc.text(w,x+2,yy);yy+=w.length*11+2;});
          hh=Math.max(hh,yy-y);}
        y+=hh+10;
      }
      y+=6;doc.setLineWidth(.4);doc.line(M,y-8,R,y-8);
      continue;
    }
    if(y+IH>H-M){doc.addPage();y=M;}
    const img=await svgToPng(boardSVG({...f,defense:curDefense()},"print",900),900);
    doc.addImage(img,"PNG",M,y,IW,IH);doc.setLineWidth(o?2.5:.75);doc.rect(M,y,IW,IH);
    doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(o?`OPTION ${o.letter} · STEP ${o.steps.indexOf(i)+1}`:n.short.toUpperCase(),M+IW+16,y+16);
    doc.setFont("helvetica","normal");doc.setFontSize(10);
    if(f.caption){const c=doc.splitTextToSize(f.caption,R-(M+IW+16));doc.text(c,M+IW+16,y+34);}
    y+=IH+18;
  }
}
async function savePdf(btn,label,make,name){
  if(!window.jspdf){btn.textContent="PDF tool didn't load";setTimeout(()=>btn.textContent=label,2500);return;}
  btn.textContent="Building PDF…";
  try{const doc=await make();saveFile(name,doc.output("blob"));btn.textContent="PDF downloaded";}
  catch(err){btn.textContent="Couldn't build PDF";}
  setTimeout(()=>btn.textContent=label,2500);
}
$("#pPdf").addEventListener("click",e=>{
  if(!play.name.trim()){pflash("Name the play before printing.");$("#pName").focus();return;}
  savePdf(e.currentTarget,"Printable PDF",async()=>{const doc=new window.jspdf.jsPDF({unit:"pt",format:"letter"});await addPlayPages(doc,play,true);return doc;},`Play - ${play.name.trim()}.pdf`);
});

play=blankPlay();setTool("move");renderEditor();renderPlayLib();

function shareTap(file){
  let t=document.getElementById("shareTap");
  if(!t){t=document.createElement("div");t.id="shareTap";t.className="share-tap";t.setAttribute("role","dialog");document.body.appendChild(t);}
  t.innerHTML=`<span><b>Your PDF is ready</b><small>${esc(file.name)}</small></span><button type="button" class="btn primary">Send</button><button type="button" class="icon" aria-label="Close">✕</button>`;
  t.hidden=false;
  const [send,close]=t.querySelectorAll("button");
  send.onclick=async()=>{t.hidden=true;try{await navigator.share({files:[file]});}catch{}};
  close.onclick=()=>{t.hidden=true;};
}
async function saveFile(name,data){
  const blob=data instanceof Blob?data:new Blob([data],{type:"application/json"});
  // Inside a Claude preview, downloads go through Claude's save prompt.
  const dl=window.claude&&window.claude.use?await window.claude.use("downloads").catch(()=>null):null;
  if(dl){try{await dl.save({filename:name,data:blob});return;}catch(e){if(e&&e.code==="declined")return;}}
  /* Phones: open the share sheet with just the file, so a text message gets the PDF
     itself (not a "blob:" link and the website). Computers keep downloading. */
  if(blob.type==="application/pdf"&&matchMedia("(pointer:coarse)").matches&&navigator.canShare){
    const file=new File([blob],name,{type:"application/pdf"});
    if(navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file]});return;}
      catch(e){if(e&&e.name==="AbortError")return;
        /* The share sheet needs a fresh tap when the PDF took a moment to build. */
        if(e&&e.name==="NotAllowedError"){shareTap(file);return;}}
    }
  }
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/* ---------- tabs ---------- */
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
function setTab(t){
  document.body.classList.remove("live-mode");
  if(t!=="plays"&&!$("#view-plays").hidden&&window.guardPlay&&!guardPlay(()=>setTab(t)))return;
  if(typeof FS!=="undefined"&&FS.on&&t!=="plays")exitFull();
  document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===t));
  document.querySelectorAll("section.view").forEach(v=>v.hidden=v.id!=="view-"+t);
  if(window.onViewChange)window.onViewChange();
  if(t==="settings"&&window.onSettingsTab)window.onSettingsTab();
  if(t==="cal"&&window.onCalChange)window.onCalChange();
  if(t==="cal"&&window.onSettingsTab)window.onSettingsTab();
  if(t==="team"&&window.onTeamTab)window.onTeamTab();
  if(t==="home"&&window.onHomeTab)window.onHomeTab();
  try{localStorage.setItem("tab",t)}catch{}
}
/* The app always opens on Home. */
setTab("home");

/* ---------- start / stop (called by boot.js once a team is chosen) ---------- */
let unsubs=[];
function stopPlanner(){unsubs.forEach(u=>{try{u()}catch{}});unsubs=[];db=null;drills=[];plans={};plays=[];cur=null;}
function startPlanner(store,settings){
  stopPlanner();
  db=store;canWrite=true;
  applySettings(settings);
  buildDateSelect(); loadPlan($("#planDate").value); renderAllDrills();
  play=blankPlay();fi=0;hist=[];pdirty=false;renderEditor();renderPlayLib();
  let firstPlans=true;
  const err=()=>showNotice("Couldn't load your team's data. Check your connection and reload.");
  unsubs.push(db.collection("drills").onSnapshot(s=>{
    drills=s.docs.map(d=>{const x={id:d.id,...d.data()};x.name=titleCase(x.name||"");return x;});sortDrills();
    if(mergeCats()){renderCatPick();renderLibCat();}renderAllDrills();
  },err));
  unsubs.push(db.collection("plays").onSnapshot(s=>{
    plays=s.docs.map(d=>{const x={id:d.id,...d.data()};x.name=titleCase(x.name||"");if(x.frames&&x.frames.some(f=>f.opt))x.frames=optionsToLooks(x.frames);return x;});renderPlayLib();renderPickCats();renderPick();
  },err));
  unsubs.push(db.collection("plans").onSnapshot(s=>{
    plans={};s.docs.forEach(d=>{const x=d.data();(x.blocks||[]).forEach(b=>{if(b&&b.name)b.name=titleCase(b.name);});plans[d.id]=x;});
    buildDateSelect();if(window.renderHome)renderHome();
    const inc=plans[cur.date];
    if(firstPlans||(!saveTimer&&inc&&!s.metadata.hasPendingWrites&&JSON.stringify(inc)!==JSON.stringify(cur))){firstPlans=false;loadPlan($("#planDate").value);}
    else renderCopyFrom();
    renderLib();
  },err));
}

/* Copy to another team (handled by boot.js) */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-copy]");if(!b||!window.openCopy)return;
  e.preventDefault();e.stopPropagation();window.openCopy(b.dataset.copy,b.dataset.id);
},true);
