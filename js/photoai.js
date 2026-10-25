/* Add from a photo: roster, schedule and plays read by Claude through the Supabase function
   "photo-import" (supabase/functions/photo-import). Photos are shrunk on the phone first
   (long side 1600px) so they upload fast and cost less. Nothing is saved until the coach reviews it. */
(function(){
const dlg=document.createElement("dialog");dlg.id="aiDlg";dlg.className="ai-dlg";dlg.setAttribute("aria-labelledby","aiTitle");document.body.appendChild(dlg);
const input=document.createElement("input");input.type="file";input.accept="image/*";input.multiple=true;input.hidden=true;document.body.appendChild(input);
let job=null;   // {kind, photos, result, used, limit}
const KIND={roster:{title:"Add players from a photo",tip:"A printed or handwritten roster, a sign-up sheet, or a screenshot. Get the whole list in the picture, flat and in good light."},
  schedule:{title:"Add to the calendar from a photo",tip:"A game schedule, district schedule or school calendar. Up to 4 photos for a schedule that runs across pages."},
  play:{title:"Draw a play from photos",tip:"A play on a whiteboard, in a notebook or printed. Numbers for players, X's for defenders. If the play is drawn across several pictures, add one photo per step, in order (up to 6)."}};
const SETUP=`<p class="help">Reading photos needs the photo reader turned on in Supabase. Head coaches: see <b>supabase/functions/photo-import</b> in the app's files, or ask Claude to walk you through it.</p>`;

/* ---------- photos ---------- */
function shrink(file){
  return new Promise((ok,bad)=>{
    const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{const s=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.round(im.naturalWidth*s),h=Math.round(im.naturalHeight*s);
      const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
      const d=c.toDataURL("image/jpeg",.85);URL.revokeObjectURL(url);ok({url:d,data:d.split(",")[1],type:"image/jpeg"});};
    im.onerror=()=>{URL.revokeObjectURL(url);bad(new Error("That file isn't a photo the app can open. Try a JPG or PNG screenshot."));};
    im.src=url;
  });
}
const MAX={roster:4,schedule:4,play:6};
function start(kind){
  if(typeof team==="undefined"||!team)return;
  job={kind,photos:[]};input.value="";
  input.multiple=true;
  input.onchange=async()=>{
    const room=MAX[job.kind]-job.photos.length,files=[...input.files].slice(0,Math.max(0,room));input.value="";if(!files.length)return;
    try{job.photos=job.photos.concat(await Promise.all(files.map(shrink)));}catch(e){show(`<p class="msg err">${esc(e.message)}</p>`);return;}
    stage();
  };
  show(`<p class="help" style="margin-top:0">${KIND[kind].tip}</p>
    <div class="actions" style="margin:0"><button class="btn primary" type="button" data-ai="pick">📷 Take or choose ${job.kind==="roster"?"a photo":"photos"}</button></div>
    ${HOSTED||window.__photoMock?"":`<p class="msg err" style="margin:0">${(window.APP_CONFIG||{}).env==="test"?"The test version can't read photos (it has no server). Try Add from a photo in the real app at theextracoach.com.":"Photo reading works once the app is connected to Supabase (it's in demo mode now)."}</p>`}`);
}
/* Check the photos before reading: add more, put them in order, or remove one. */
function stage(){
  const n=job.photos.length,max=MAX[job.kind];
  show(`<p class="help" style="margin-top:0">${job.kind==="play"?"Add a photo for each step of the play, in order: photo 1 is the start. Claude puts them together as one play.":
      job.kind==="schedule"?"Add every page of the schedule.":"Add every page of the roster."}</p>
    <ol class="ai-stage">${job.photos.map((ph,i)=>`<li><img src="${ph.url}" alt="Photo ${i+1}"><span class="ai-n">${job.kind==="play"?"Step ":""}${i+1}</span>
      <span class="ai-move">${i?`<button type="button" class="icon" data-mv="${i}" data-dir="-1" aria-label="Move earlier">‹</button>`:""}${i<n-1?`<button type="button" class="icon" data-mv="${i}" data-dir="1" aria-label="Move later">›</button>`:""}<button type="button" class="icon" data-rm="${i}" aria-label="Remove photo">✕</button></span></li>`).join("")}
      ${n<max?`<li class="ai-add"><button type="button" data-ai="pick">＋<span>${job.kind==="play"?"Add the next step":"Add another photo"}</span></button></li>`:""}</ol>
    <p class="help">${n} of ${max} photos.${job.kind==="play"&&n>1?" Each photo becomes one or more steps.":""}</p>`,
    `<button class="btn" type="button" data-ai="restart">Start over</button><button class="btn primary" type="button" data-ai="read"${n?"":" disabled"}>Read ${n} photo${n===1?"":"s"}</button>`);
}
function show(body,foot){
  dlg.innerHTML=`<div class="dlg ai"><div class="hg-head"><h2 id="aiTitle">${KIND[job.kind].title}</h2><button type="button" class="icon" data-ai="close" aria-label="Close">✕</button></div>
    <div class="ai-body">${body}</div>${foot?`<div class="ai-foot">${foot}</div>`:""}</div>`;
  if(!dlg.open)dlg.showModal();
}
async function read(){
  show(`<div class="ai-reading"><div class="ai-thumbs">${job.photos.map(p=>`<img src="${p.url}" alt="">`).join("")}</div>
    <div class="ai-spin" aria-hidden="true"></div><p><b>Reading your photo…</b><br><span class="help">This takes about 10 to 30 seconds.</span></p></div>`);
  const st=SETTINGS||{};
  const context=job.kind==="schedule"?{today:todayISO(),seasonStart:st.seasonStart,seasonEnd:st.seasonEnd,team:[team.name,st.teamLabel].filter(Boolean).join(" ")}:
    job.kind==="play"?{sport:st.sport||"basketball",players:sp().players,types:sp().playTypes,photos:job.photos.length}:{};
  try{
    let r;
    if(window.__photoMock)r=await window.__photoMock(job.kind,context);
    else if(!HOSTED)throw new Error((window.APP_CONFIG||{}).env==="test"?"The test version can't read photos (it has no server). Try Add from a photo in the real app at theextracoach.com.":"Photo reading works once the app is connected to Supabase (it's in demo mode now).");
    else{
      const {data,error}=await sb.functions.invoke("photo-import",{body:{kind:job.kind,team:team.id,images:job.photos.map(p=>({data:p.data,type:p.type})),context}});
      if(error){let m=error.message||"",status=error.context&&error.context.status;try{const j=await error.context.json();m=j.error||j.message||m;}catch{}
        if(status===404||(!status&&/not found|Failed to send|FunctionsFetchError|Failed to fetch/i.test(m+" "+(error.name||""))&&!/server|key/i.test(m)))throw Object.assign(new Error("The photo reader isn't turned on yet."),{setup:true});
        throw new Error(m||"Couldn't read the photo.");}
      r=data;
    }
    job.result=r.result||{};job.used=r.used;job.limit=r.limit;
    review();
  }catch(e){
    show(`<p class="msg err">${esc(e.message||String(e))}</p>${e.setup?SETUP:""}`,`<button class="btn" type="button" data-ai="restart">Try another photo</button>${job.photos.length?`<button class="btn" type="button" data-ai="read">Try again</button>`:""}<button class="btn" type="button" data-ai="close">Close</button>`);
  }
}
const usage=()=>job.limit?`<span class="help ai-usage">${job.used} of ${job.limit} photos used this month</span>`:"";

/* ---------- roster ---------- */
function reviewRoster(){
  const have=new Set(TM.roster.map(p=>String(p.name||"").trim().toLowerCase()));
  const list=(job.result.players||[]).filter(p=>p&&p.name);
  job.rows=list.map(p=>({...p,dup:have.has(String(p.name).trim().toLowerCase())}));
  if(!job.rows.length){show(`<p class="msg err">No players found in that photo. Try a closer, straight-on picture of the list.</p>`,`<button class="btn primary" type="button" data-ai="restart">Try another photo</button>`);return;}
  show(`<p class="help" style="margin-top:0">Found ${job.rows.length} player${job.rows.length===1?"":"s"}. Fix anything that's wrong, uncheck anyone you don't want, then add them.</p>
    ${job.result.notes?`<p class="ai-note">${esc(job.result.notes)}</p>`:""}
    <div class="ai-list">${job.rows.map((p,i)=>`<div class="ai-row${p.unsure?" unsure":""}">
      <label class="ai-chk"><input type="checkbox" data-row="${i}"${p.dup?"":" checked"}><span class="sr">Add</span></label>
      <div class="ai-fields ai-roster">
        <input data-f="${i}.number" value="${esc(p.number||"")}" placeholder="#" aria-label="Number" class="ai-num">
        <input data-f="${i}.name" value="${esc(p.name||"")}" aria-label="Player name">
        <input data-f="${i}.parent" value="${esc(p.parent||"")}" placeholder="Parent" aria-label="Parent">
        <input data-f="${i}.phone" value="${esc(p.phone||"")}" placeholder="Phone" aria-label="Phone" type="tel">
        <input data-f="${i}.email" value="${esc(p.email||"")}" placeholder="Email" aria-label="Email" type="email">
        ${p.dup?`<small class="ai-flag">Already on the roster</small>`:p.unsure?`<small class="ai-flag">Hard to read: please check</small>`:""}
      </div></div>`).join("")}</div>`,
    `${usage()}<button class="btn" type="button" data-ai="restart">Different photo</button><button class="btn primary" type="button" data-ai="apply">Add players</button>`);
  count();
}
async function applyRoster(){
  const now=Date.now(),pick=job.rows.filter((_,i)=>dlg.querySelector(`[data-row="${i}"]`).checked);
  const entries=pick.map((p,i)=>["p-"+uid(),{number:p.number||"",name:p.name.trim(),pos:p.pos||"",parent:p.parent||"",phone:p.phone||"",email:p.email||"",parent2:p.parent2||"",phone2:p.phone2||"",createdAt:now+i,addedFrom:"photo"}]);
  await store.bulkSet("players",entries);
  dlg.close();showNotice(`Added ${entries.length} player${entries.length===1?"":"s"} to the roster.`);window.goTeam&&window.goTeam("roster");
}

/* ---------- schedule ---------- */
const DAY_TYPES=[["noschool","No school"],["holiday","Holiday / break"],["nopractice","No practice"],["tryout","Tryouts"],["meeting","Meeting"],["extra","Extra practice"],["other","Note"]];
const levelMatch=(lv)=>{if(!lv)return true;const mine=String(SETTINGS.teamLabel||"").toLowerCase(),l=String(lv).toLowerCase();
  const num=s=>(s.match(/\b(\d{1,2})(st|nd|rd|th)?\b/)||[])[1];
  if(num(l)&&num(mine))return num(l)===num(mine);
  if(/\bjv\b|junior varsity/.test(l))return /\bjv\b|junior varsity/.test(mine);
  if(/varsity/.test(l))return /varsity/.test(mine)&&!/\bjv\b|junior/.test(mine);
  if(/fresh|9th/.test(l))return /fresh|9th/.test(mine);
  return mine.includes(l)||l.includes(mine);};
function reviewSchedule(){
  const st=SETTINGS,haveG=new Set((st.games||[]).map(g=>g.date)),valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"");
  job.games=(job.result.games||[]).filter(g=>valid(g.date)).sort((a,b)=>a.date<b.date?-1:1).map(g=>({...g,dup:haveG.has(g.date),mine:levelMatch(g.level)}));
  job.days=(job.result.days||[]).filter(d=>valid(d.date)).sort((a,b)=>a.date<b.date?-1:1);
  const levels=[...new Set(job.games.map(g=>g.level).filter(Boolean))];
  if(!job.games.length&&!job.days.length){show(`<p class="msg err">No games or dates found in that photo. Try a closer, straight-on picture.</p>`,`<button class="btn primary" type="button" data-ai="restart">Try another photo</button>`);return;}
  const homeSel=(i,h)=>`<select data-f="g${i}.home" aria-label="Home or away"><option value="home"${h==="home"?" selected":""}>Home</option><option value="away"${h==="away"?" selected":""}>Away</option>${h==="unknown"?`<option value="unknown" selected>Home or away?</option>`:""}</select>`;
  show(`<p class="help" style="margin-top:0">Check the dates against the photo, uncheck anything you don't want, then add it to ${esc(st.teamLabel||team.name)}'s calendar.</p>
    ${job.result.notes?`<p class="ai-note">${esc(job.result.notes)}</p>`:""}
    ${levels.length?`<p class="ai-note">This schedule lists games for ${esc(levels.join(", "))}. Games that look like they're for ${esc(st.teamLabel||"this team")} are checked.</p>`:""}
    ${job.games.length?`<h3 class="gp-h">Games (${job.games.length})</h3><div class="ai-list">${job.games.map((g,i)=>`<div class="ai-row${g.home==="unknown"?" unsure":""}">
      <label class="ai-chk"><input type="checkbox" data-g="${i}"${!g.dup&&g.mine?" checked":""}><span class="sr">Add</span></label>
      <div class="ai-fields ai-game"><input type="date" data-f="g${i}.date" value="${esc(g.date)}" aria-label="Date"><input type="time" data-f="g${i}.time" value="${esc(g.time||"")}" aria-label="Time">
        ${homeSel(i,g.home)}<input data-f="g${i}.opponent" value="${esc(g.opponent||"")}" aria-label="Opponent" class="ai-opp">
        ${g.level||g.note||g.dup?`<small class="ai-flag">${[g.level?"For: "+esc(g.level):"",g.note?esc(g.note):"",g.dup?"A game is already on the calendar that day":""].filter(Boolean).join(" · ")}</small>`:""}</div></div>`).join("")}</div>`:""}
    ${job.days.length?`<h3 class="gp-h">Special days (${job.days.length})</h3><div class="ai-list">${job.days.map((d,i)=>`<div class="ai-row">
      <label class="ai-chk"><input type="checkbox" data-d="${i}" checked><span class="sr">Add</span></label>
      <div class="ai-fields ai-day"><span class="ai-dates">${esc(longDay(d.date))}${d.end&&d.end>d.date?" – "+esc(longDay(d.end)):""}</span>
        <select data-f="d${i}.type" aria-label="Kind of day">${DAY_TYPES.map(([v,l])=>`<option value="${v}"${d.type===v?" selected":""}>${l}</option>`).join("")}</select>
        <input data-f="d${i}.label" value="${esc(d.label||"")}" placeholder="Label" aria-label="Label"></div></div>`).join("")}</div>`:""}`,
    `${usage()}<button class="btn" type="button" data-ai="restart">Different photo</button><button class="btn primary" type="button" data-ai="apply">Add to calendar</button>`);
  count();
}
const longDay=iso=>dObj(iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
function dayEntry(d){
  const L=String(d.label||"").trim();
  switch(d.type){
    case "noschool":return {kind:"note",note:"No School"};
    case "holiday":return {kind:"off",note:L||"Holiday"};
    case "nopractice":return {kind:"off",note:"No practice"};
    case "tryout":return {kind:"note",note:"Tryouts"};
    case "meeting":return {kind:"note",note:L||"Meeting"};
    case "extra":return {kind:"extra",note:L};
    default:return L?{kind:"note",note:L}:null;
  }
}
async function applySchedule(){
  const st=JSON.parse(JSON.stringify(team.settings||{}));st.games=st.games||[];st.special=st.special||[];
  let ng=0,nd=0,unk=0;
  job.games.forEach((g,i)=>{if(!dlg.querySelector(`[data-g="${i}"]`).checked||!g.date||!g.opponent)return;
    st.games=st.games.filter(x=>x.date!==g.date);st.games.push({date:g.date,opponent:g.opponent.trim(),time:g.time||"",home:g.home!=="away"});ng++;if(g.home==="unknown")unk++;});
  job.days.forEach((d,i)=>{if(!dlg.querySelector(`[data-d="${i}"]`).checked)return;const e=dayEntry(d);if(!e)return;
    let day=d.date;const last=d.end&&d.end>d.date&&d.end<=addDays(d.date,60)?d.end:d.date;
    while(day<=last){if(!st.special.some(x=>x.date===day&&x.kind===e.kind&&(x.note||"")===(e.note||""))){st.special.push({date:day,...e});nd++;}day=addDays(day,1);}});
  await saveSettings(st);if(window.onCalChange)window.onCalChange();
  dlg.close();showNotice(`Added ${ng} game${ng===1?"":"s"} and ${nd} special day${nd===1?"":"s"} to the calendar.${unk?` ${unk} game${unk===1?" was":"s were"} marked Home because the photo didn't say. Check them in the calendar.`:""}`);
}

/* ---------- play ---------- */
const clampX=x=>Math.max(-20,Math.min(520,+x||0)),clampY=y=>Math.max(-35,Math.min(475,+y||0));
function buildPlay(r){
  const types=sp().playTypes,tokens=[];
  (r.offense||[]).slice(0,sp().players).forEach(o=>tokens.push({id:"o"+o.n,kind:"o",n:o.n,x:clampX(o.x),y:clampY(o.y),...(o.label?{label:String(o.label).slice(0,3)}:{})}));
  (r.defense||[]).slice(0,sp().players).forEach(d=>tokens.push({id:"d"+d.n,kind:"d",n:d.n,x:clampX(d.x),y:clampY(d.y)}));
  const h=tokens.find(t=>t.id==="o"+r.ball)||tokens.find(t=>t.kind==="o");if(h)tokens.push({id:"ball",kind:"ball",x:h.x+13,y:h.y-13});
  const frames=[];let toks=tokens;
  (r.steps&&r.steps.length?r.steps:[{caption:""}]).forEach(s=>{
    const fr={caption:String(s.caption||"").slice(0,240),tokens:JSON.parse(JSON.stringify(toks)),actions:[]};
    (s.moves||[]).forEach(m=>{const t=fr.tokens.find(x=>x.id===m.who);if(!t||!["cut","dribble","screen"].includes(m.type))return;
      if(fr.actions.some(a=>a.from===t.id&&isMove(a)))return;   // one move per player per step
      const x2=clampX(m.x),y2=clampY(m.y);fr.actions.push({id:uid(),type:m.type,from:t.id,to:null,x1:t.x,y1:t.y,x2,y2,cx:(t.x+x2)/2,cy:(t.y+y2)/2});});
    (s.passes||[]).forEach(p=>{const a=fr.tokens.find(x=>x.id==="o"+p.from),b=fr.tokens.find(x=>x.id==="o"+p.to);if(!a||!b||a===b)return;
      const s1=destOf(fr,a.id),s2=destOf(fr,b.id);fr.actions.push({id:uid(),type:"pass",from:a.id,to:b.id,x1:s1.x,y1:s1.y,x2:s2.x,y2:s2.y,cx:(s1.x+s2.x)/2,cy:(s1.y+s2.y)/2});});
    syncPasses(fr);
    if(s.shot&&sp().tools.shot){const who=finalHolder(fr);if(who)fr.actions.push({id:uid(),type:"shot",from:who,to:null,...shotArc(shotStart(fr,who))});}
    frames.push(fr);toks=nextTokens(fr);
  });
  return {id:null,name:String(r.name||"Play from photo").slice(0,60),type:types.includes(r.type)?r.type:types[0],notes:[r.notes,r.unsure?`Check: ${r.unsure}`:""].filter(Boolean).join("\n"),frames};
}
function reviewPlay(){
  let p;try{p=buildPlay(job.result);}catch(e){show(`<p class="msg err">Couldn't turn that photo into a play. Try a clearer picture.</p>`,`<button class="btn primary" type="button" data-ai="restart">Try another photo</button>`);return;}
  job.play=p;
  show(`<div class="ai-play"><div><img src="${job.photos[0].url}" alt="Your photo"><small>Your photo</small></div><div>${boardSVG(p.frames[0],"screen")}<small>Step 1 of ${p.frames.length}</small></div></div>
    <p><b>${esc(p.name)}</b> · ${esc(p.type)} · ${p.frames.length} step${p.frames.length===1?"":"s"}</p>
    ${job.result.unsure?`<p class="ai-note">Check: ${esc(job.result.unsure)}</p>`:""}
    <p class="help">This is a first draft. Open it in the play designer, drag anyone who's off, play it through, then tap Save play.</p>`,
    `${usage()}<button class="btn" type="button" data-ai="restart">Different photo</button><button class="btn primary" type="button" data-ai="apply">Open in play designer</button>`);
}
function applyPlay(){
  dlg.close();
  if(window.guardPlay&&!guardPlay(applyPlay))return;setTab("plays");
  play=job.play;fi=0;hist=[];pdirty=true;PLAY_LOCK=false;renderEditor();renderPlayLib();
  $("#pStatus").textContent="Unsaved: drawn from your photo";
  document.querySelector("#view-plays .board-card").scrollIntoView({behavior:"smooth",block:"start"});
}

/* ---------- shared ---------- */
function review(){({roster:reviewRoster,schedule:reviewSchedule,play:reviewPlay})[job.kind]();}
function count(){
  const b=dlg.querySelector('[data-ai="apply"]');if(!b)return;
  const n=dlg.querySelectorAll(".ai-chk input:checked").length;b.disabled=!n;
  b.textContent=job.kind==="roster"?`Add ${n} player${n===1?"":"s"}`:`Add ${n} to the calendar`;
}
dlg.addEventListener("click",async e=>{
  if(e.target===dlg){dlg.close();return;}
  const b=e.target.closest("[data-ai]");if(!b)return;
  const a=b.dataset.ai;
  if(a==="close")dlg.close();
  if(a==="pick")input.click();
  if(a==="restart"){job.photos=[];job.result=null;input.click();}
  if(a==="read")read();
  if(a==="apply"){b.disabled=true;b.textContent="Saving…";
    try{if(job.kind==="roster")await applyRoster();else if(job.kind==="schedule")await applySchedule();else applyPlay();}
    catch(err){b.disabled=false;count();const m=dlg.querySelector(".ai-body");m.insertAdjacentHTML("afterbegin",`<p class="msg err">Not saved: ${esc(err.message||String(err))}</p>`);}}
});
dlg.addEventListener("change",e=>{if(e.target.closest(".ai-chk"))count();});
dlg.addEventListener("click",e=>{
  const mv=e.target.closest("[data-mv]"),rm=e.target.closest(".ai-stage [data-rm]");
  if(mv){const i=+mv.dataset.mv,j=i+(+mv.dataset.dir);[job.photos[i],job.photos[j]]=[job.photos[j],job.photos[i]];stage();}
  if(rm){job.photos.splice(+rm.dataset.rm,1);stage();}
});
dlg.addEventListener("input",e=>{
  const f=e.target.closest("[data-f]");if(!f)return;const [k,field]=f.dataset.f.split(".");
  if(/^g\d+$/.test(k))job.games[+k.slice(1)][field]=f.value;
  else if(/^d\d+$/.test(k))job.days[+k.slice(1)][field]=f.value;
  else job.rows[+k][field]=f.value;
});
dlg.addEventListener("change",e=>{const f=e.target.closest("select[data-f]");if(f)f.dispatchEvent(new Event("input",{bubbles:true}));});
window.PhotoAI={start};
document.addEventListener("click",e=>{const b=e.target.closest("[data-photo]");if(b)start(b.dataset.photo);});
})();
