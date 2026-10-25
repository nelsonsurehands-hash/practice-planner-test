/* Player playbook page: read-only, no sign-in.
   Opens either ?pb=<share id> (hosted app) or #<packed data> (link with the plays inside it). */
const CFG=window.APP_CONFIG||{};
let SPORT="basketball", BOOK=null, cur=null, step=0, anim=null, filter="";
const show=(id,on)=>{$(id).hidden=!on;};

async function load(){
  const params=new URLSearchParams(location.search), hash=location.hash.slice(1), pbId=params.get("pb")||(location.pathname.match(/\/p\/([A-Za-z0-9]+)\/?$/)||[])[1]||"";
  try{
    if(params.get("preview")){
      BOOK=JSON.parse(localStorage.getItem("cpp:previewBook")||"null");
      if(!BOOK)return fail("Nothing to preview. Go back to the planner and tap Share with players.");
      $("#pbPreviewBar").hidden=false;
    }else if(pbId){
      if(!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&window.supabase))throw new Error("This playbook link needs the hosted app.");
      const sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:false}});
      const {data,error}=await sb.rpc("get_playbook",{p_id:pbId});
      if(error)throw error;
      if(!data)return fail("This playbook link has been turned off or doesn't exist. Ask your coach for a new one.");
      BOOK=data;
    }else if(hash){BOOK=await unpackPlaybook(hash);}
    else return fail("No playbook in this link. Ask your coach to send it again.");
  }catch(e){return fail("This playbook couldn't be opened. Check your connection, or ask your coach for a new link.");}
  start();
}
function fail(text){show("#pbLoading",false);$("#pbError").textContent=text;show("#pbError",true);}

function start(){
  const t=BOOK.team||{};
  SPORT=SPORTS[t.sport]?t.sport:"basketball";
  document.documentElement.style.setProperty("--team",t.color||"#5b2a86");
  if(t.color2){document.documentElement.style.setProperty("--team2",t.color2);document.documentElement.classList.add("has-c2");}
  if(t.logo){const im=$("#pbLogo");im.src=t.logo;im.hidden=false;const fav=document.querySelector('link[rel="icon"]');if(fav)fav.href=t.logo;}
  document.querySelector('meta[name="theme-color"]').content=t.color||"#5b2a86";
  $("#pbEyebrow").textContent=[t.school&&t.mascot?t.school+" "+t.mascot:t.name,t.teamLabel].filter(Boolean).join(" · ");
  $("#pbTitle").textContent=BOOK.title||"Playbook";
  document.title=`${BOOK.title||"Playbook"} · ${t.name||"Team"}`;
  BOOK.plays=(BOOK.plays||[]).filter(p=>p.frames&&p.frames.length);
  $("#pbCount").textContent=`${BOOK.plays.length} play${BOOK.plays.length===1?"":"s"}`;
  const L=SPORTS[SPORT].tools;
  $("#pbLegend").textContent="Key: "+[`solid arrow = ${L.cut.toLowerCase()}`,`dashed arrow = ${L.pass.toLowerCase()}`,L.dribble&&`zigzag = ${L.dribble.toLowerCase()}`,L.screen&&`line with a bar = ${L.screen.toLowerCase()}`,L.shot&&`dotted arc = ${L.shot.toLowerCase()}`].filter(Boolean).join(" · ");
  show("#pbLoading",false);show("#pbApp",true);
  renderList();
  const want=new URLSearchParams(location.search).get("play");
  if(want){const i=BOOK.plays.findIndex(p=>p.id===want);if(i>=0)openPlay(i);}
}

/* ---------- list ---------- */
function renderList(){
  const types=[...new Set(BOOK.plays.map(p=>p.type||"Plays"))];
  $("#pbTypes").innerHTML=types.length>1?[`<button aria-pressed="${!filter}" data-type="">All</button>`,...types.map(t=>`<button aria-pressed="${filter===t}" data-type="${esc(t)}">${esc(t)}</button>`)].join(""):"";
  const q=$("#pbSearch").value.trim().toLowerCase();
  const list=BOOK.plays.map((p,i)=>({p,i})).filter(({p})=>(!filter||(p.type||"Plays")===filter)&&(!q||(p.name+" "+(p.type||"")+" "+(p.notes||"")).toLowerCase().includes(q)));
  if(!list.length){$("#pbList").innerHTML=`<p class="help">No plays match.</p>`;return;}
  const groups={};list.forEach(x=>{(groups[x.p.type||"Plays"]=groups[x.p.type||"Plays"]||[]).push(x);});
  $("#pbList").innerHTML=Object.entries(groups).map(([type,items])=>`<div class="pb-group">${esc(type)}</div><div class="pb-list">`+
    items.map(({p,i})=>{const L=playLines(p.frames),n=L.main.length,k=L.options.length;
      return `<button class="pb-card" data-open="${i}">${boardSVG(p.frames[0],"screen")}<span><b>${esc(p.name)}</b><small>${n} step${n>1?"s":""}${k?` · <b class="optcount">${k} option${k>1?"s":""}</b>`:""}</small></span></button>`;}).join("")+`</div>`).join("");
}
$("#pbTypes").addEventListener("click",e=>{const b=e.target.closest("[data-type]");if(!b)return;filter=b.dataset.type;renderList();});
$("#pbSearch").addEventListener("input",renderList);
$("#pbList").addEventListener("click",e=>{const b=e.target.closest("[data-open]");if(b)openPlay(+b.dataset.open);});

/* ---------- one play ---------- */
function openPlay(i){
  stopRun();cur=i;step=0;pbDefPick=null;
  const p=BOOK.plays[i];
  $("#pbName").textContent=p.name;$("#pbPlayType").textContent=p.type||"";
  $("#pbNotes").textContent=p.notes||"";
  $("#pbPrevPlay").disabled=i===0;$("#pbNextPlay").disabled=i===BOOK.plays.length-1;
  show("#pbListView",false);show("#pbPlayView",true);window.scrollTo(0,0);
  renderStep();
}
/* step = real frame index. Prev/next walk the display order: main steps, then each option. */
function order(){return displayOrder(playLines(BOOK.plays[cur].frames));}
function renderDefSel(){
  const w=$("#pbDefWrap");if(!w)return;w.hidden=SPORT!=="basketball";
  const p=BOOK.plays[cur],saved=playDefense(p.frames),cur0=pbDefense()||{type:"none"};
  $("#pbDef").innerHTML=DEF_TYPES.filter(([v])=>v!=="custom"||(saved&&saved.type==="custom")).map(([v,l])=>`<option value="${v}"${v===(cur0.type||"none")?" selected":""}>${v==="custom"?"Coach's defense":l}${saved&&saved.type===v?" (coach's pick)":""}</option>`).join("");
}
function renderStep(){
  renderDefSel();
  const p=BOOK.plays[cur],f=p.frames[step],L=playLines(p.frames),n=stepName(p.frames,L,step),ord=displayOrder(L),pos=ord.indexOf(step);
  $("#pbBoard").innerHTML=boardInner(withDefense(f,pbDefense()),"screen");
  const branches=k=>L.options.filter(o=>o.branch===k).map(o=>o.letter).join("");
  $("#pbSteps").innerHTML=p.frames.length>1?L.main.map((i,k)=>`<button class="step" aria-pressed="${i===step}" data-step="${i}">Step ${k+1}${branches(k)?`<span class="branch">${branches(k)}</span>`:""}</button>`).join("")+
    L.options.map(o=>`<div class="optgroup"><span class="optlabel">${esc(o.title)}<small>after step ${o.branch+1}</small></span>`+o.steps.map((i,k)=>`<button class="step opt" aria-pressed="${i===step}" data-step="${i}">${o.letter}${k+1}</button>`).join("")+`</div>`).join(""):"";
  $("#pbLines").hidden=!L.options.length;
  $("#pbLines").innerHTML=`<span class="lbl">Watch</span><button class="btn" data-line="">Main play</button>`+L.options.map(o=>`<button class="btn optbtn" data-line="${o.id}">${esc(o.title)}</button>`).join("");
  const lead=!n.opt&&anim&&anim.opt?L.options.find(x=>x.id===anim.opt.id):null;
  $("#pbOptBanner").hidden=!n.opt&&!lead;$("#pbBoardWrap").classList.toggle("opt",!!n.opt);
  if(n.opt)$("#pbOptBanner").innerHTML=`<b>${esc(n.opt.title)}</b><span>Step ${n.opt.steps.indexOf(step)+1} of ${n.opt.steps.length} · ${esc(n.where)}</span>`;
  else if(lead)$("#pbOptBanner").innerHTML=`<b>${esc(lead.title)}</b><span>Set-up: the option starts after step ${lead.branch+1}</span>`;
  $("#pbCap").innerHTML=`<b>${n.opt?"Option "+n.opt.letter+" · step "+(n.opt.steps.indexOf(step)+1):n.long}</b>${esc(f.caption||"")}`;
  $("#pbPrev").disabled=pos<=0;$("#pbNext").disabled=pos>=ord.length-1;
  if(anim)document.querySelectorAll("#pbLines [data-line]").forEach(b=>b.setAttribute("aria-pressed",(b.dataset.line||null)===(anim.opt?anim.opt.id:null)));
}
$("#pbSteps").addEventListener("click",e=>{const b=e.target.closest("[data-step]");if(!b)return;stopRun();step=+b.dataset.step;renderStep();});
$("#pbPrev").addEventListener("click",()=>{stopRun();const o=order(),k=o.indexOf(step);if(k>0){step=o[k-1];renderStep();}});
$("#pbNext").addEventListener("click",()=>{stopRun();const o=order(),k=o.indexOf(step);if(k<o.length-1){step=o[k+1];renderStep();}});
$("#pbLines").addEventListener("click",e=>{const b=e.target.closest("[data-line]");if(!b)return;stopRun();run(b.dataset.line||"main");});
$("#pbBack").addEventListener("click",()=>{stopRun();show("#pbPlayView",false);show("#pbListView",true);});
$("#pbPrevPlay").addEventListener("click",()=>{if(cur>0)openPlay(cur-1);});
$("#pbNextPlay").addEventListener("click",()=>{if(cur<BOOK.plays.length-1)openPlay(cur+1);});

/* swipe left/right on the diagram to change steps */
let sx=null;
$("#pbBoard").addEventListener("touchstart",e=>{sx=e.touches[0].clientX;},{passive:true});
$("#pbBoard").addEventListener("touchend",e=>{if(sx===null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;
  if(Math.abs(dx)<50)return;stopRun();const o=order(),k=o.indexOf(step);step=o[Math.max(0,Math.min(o.length-1,k+(dx<0?1:-1)))];renderStep();},{passive:true});

/* The defense this play runs against: the coach's choice, or one picked here to watch it against. */
let pbDefPick=null;
document.addEventListener("change",e=>{if(e.target.id!=="pbDef")return;pbDefPick=e.target.value;stopRun();renderStep();});
function pbDefense(){const p=BOOK&&BOOK.plays[cur];if(!p)return null;if(pbDefPick)return pbDefPick==="saved"?playDefense(p.frames):{type:pbDefPick,chase:(playDefense(p.frames)||{}).chase};return playDefense(p.frames);}
/* ---------- play through ---------- */
function stopRun(){if(!anim)return;anim=null;$("#pbRun").textContent="▶ Play through";document.querySelectorAll("#pbLines [data-line]").forEach(b=>b.removeAttribute("aria-pressed"));}
/* Play one line: the main play, or an option (which starts from the step it branches off). */
function run(line){
  const all=BOOK.plays[cur].frames,L=playLines(all);
  const opt=line===undefined?optionOf(all,L,step):line==="main"?null:L.options.find(o=>o.id===line)||null;
  const seq=lineIdx(L,opt),frames=seq.map(i=>all[i]);
  let s0;if(line===undefined){const k=seq.indexOf(step);s0=k>=0&&k<seq.length-1?k:0;}else s0=opt?opt.branch:0;
  anim={i:s0,seq,frames,opt,phase:"hold",t:0,tr:buildTransition(frames,s0),last:performance.now(),paused:false};
  step=seq[s0];renderStep();$("#pbRun").textContent="❚❚ Pause";requestAnimationFrame(tick);
}
$("#pbRun").addEventListener("click",()=>{
  if(anim&&!anim.done){if(anim.paused){anim.paused=false;anim.last=performance.now();$("#pbRun").textContent="❚❚ Pause";requestAnimationFrame(tick);}else{anim.paused=true;$("#pbRun").textContent="▶ Resume";}return;}
  if(anim&&anim.done){const o=anim.opt;anim=null;run(o?o.id:"main");return;}
  run();
});
function tick(now){
  if(!anim||anim.paused)return;
  const dtv=now-anim.last;anim.t+=dtv;anim.last=now;
  const tr=anim.tr,frames=anim.frames;
  const dur=anim.phase==="move"?(tr.moves?(tr.moveDur||DUR.move):0):anim.phase==="pass"?(tr.passCurve?DUR.pass:0):anim.phase==="end"?DUR.end:DUR.hold;
  if(anim.t>=dur){
    anim.t=0;
    if(anim.phase==="hold")anim.phase="move";
    else if(anim.phase==="move")anim.phase="pass";
    else if(anim.phase==="pass"){
      if(tr.last)anim.phase="end";
      else{anim.i++;step=anim.seq[anim.i];anim.tr=buildTransition(frames,anim.i);anim.phase="hold";renderStep();}
    }else{
      $("#pbBoard").innerHTML=boardInner({tokens:animDefense(anim,animTokens(tr,"pass",1),400,pbDefense()),actions:[]},"screen");
      anim.done=true;anim.paused=true;$("#pbRun").textContent="↻ Watch again";return;
    }
    requestAnimationFrame(tick);return;
  }
  const u=dur?anim.t/dur:1;
  $("#pbBoard").innerHTML=boardInner({tokens:animDefense(anim,animTokens(tr,anim.phase,u),dtv,pbDefense()),actions:tr.f.actions},"screen",null,anim.phase!=="hold");
  requestAnimationFrame(tick);
}

load();
