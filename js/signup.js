/* Parents' game-day food sign-up. Opened from a short link like theextracoach.com/f/abc123… (or signup.html?s=…)
   No account: the page calls three public database functions (get_signup, add_signup,
   cancel_signup). In demo mode (&demo=1) it reads the sheet the coach made in this browser.
   Each parent's own sign-ups are remembered on their phone so they can cancel them. */
(function(){
const $=q=>document.querySelector(q);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const params=new URLSearchParams(location.search),ID=params.get("s")||(location.pathname.match(/\/f\/([A-Za-z0-9]+)\/?$/)||[])[1]||"",DEMO=params.get("demo")==="1";
const CFG=window.APP_CONFIG||{};
const dObj=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
const longDay=s=>dObj(s).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const ampm=t=>{if(!t)return "";const [h,m]=t.split(":").map(Number);return `${((h+11)%12)+1}:${String(m).padStart(2,"0")} ${h<12?"AM":"PM"}`;};
const isoOf=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return isoOf(d);};
/* When the food needs to be there: the game's own time, or the home-game time for home games. */
function dropOf(g){const d=(SHEET&&SHEET.dropoff)||{home:"16:00"},own=(d.games||{})[g.date];return own||(g.home?(d.home||"16:00"):"");}
const MINE_KEY="cpp:mySignups:"+ID;
const readMine=()=>{try{return JSON.parse(localStorage.getItem(MINE_KEY)||"[]");}catch{return [];}};
const writeMine=v=>{try{localStorage.setItem(MINE_KEY,JSON.stringify(v));}catch{}};
let SHEET=null,pick=null,last=null,openDate=null,showPast=false;

/* ---------- where the sheet lives ---------- */
let api;
if(DEMO){
  const teamId=(()=>{try{return localStorage.getItem("cpp:foodboard:"+ID);}catch{return null;}})();
  const read=()=>{try{return JSON.parse(localStorage.getItem("cpp:food:"+teamId)||"null");}catch{return null;}};
  const shortName=n=>{const w=n.trim().split(/\s+/);return w.length>1?`${w[0]} ${w[w.length-1][0]}.`:w[0];};
  api={
    async get(){
      const v=read();if(!v||!v.board||v.board.id!==ID||!v.board.active)return null;
      const t=(JSON.parse(localStorage.getItem("cpp:demoTeams")||"[]")).find(x=>x.id===teamId)||{settings:{}},st=t.settings||{},b=v.board,y=yesterday();
      return {title:b.title,note:b.note,slots:b.slots,dropoff:b.dropoff||{home:"16:00"},team:{name:t.name,color:st.color,color2:st.color2,logo:st.logo,school:st.school,mascot:st.mascot,teamLabel:st.teamLabel},
        games:(st.games||[]).filter(g=>g.date&&(b.games==="all"||(b.games==="home")===(g.home!==false))).sort((a,c)=>a.date<c.date?-1:1).map(g=>({...g,home:g.home!==false,past:g.date<y,skip:(b.skip||[]).includes(g.date)})),
        entries:v.entries.filter(e=>e.game_date>=y).map(e=>({id:e.id,date:e.game_date,slot:e.slot,name:shortName(e.name),item:e.item}))};
    },
    async add(a){
      const v=read();const s=await this.get();if(!s)throw new Error("This sign-up sheet is closed.");
      const gm=s.games.find(g=>g.date===a.date);if(!gm||gm.past||gm.skip)throw new Error("That game is no longer on the sign-up sheet.");
      if(a.name.trim().length<2)throw new Error("Please enter your name.");
      if(a.contact.trim().length<5)throw new Error("Please enter a phone number or email so the coach can reach you.");
      const cap=(s.slots.find(x=>x.name===a.slot)||{}).count||0;
      if(v.entries.filter(e=>e.game_date===a.date&&e.slot===a.slot).length>=cap)throw new Error("Someone just took the last spot for that. Pick another one.");
      const e={id:"e"+Math.random().toString(36).slice(2,10),token:"t"+Math.random().toString(36).slice(2),game_date:a.date,slot:a.slot,name:a.name.trim(),contact:a.contact.trim(),player:a.player.trim(),item:a.item.trim(),created_at:new Date().toISOString()};
      v.entries.push(e);localStorage.setItem("cpp:food:"+teamId,JSON.stringify(v));return {id:e.id,token:e.token};
    },
    async cancel(id,token){const v=read();const n=v.entries.length;v.entries=v.entries.filter(e=>!(e.id===id&&e.token===token));localStorage.setItem("cpp:food:"+teamId,JSON.stringify(v));return v.entries.length<n;}
  };
}else{
  const sb=CFG.supabaseUrl&&window.supabase?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:false}}):null;
  const call=async(fn,args)=>{if(!sb)throw new Error("This link isn't set up yet.");const {data,error}=await sb.rpc(fn,args);if(error)throw new Error(error.message);return data;};
  api={
    get:()=>call("get_signup",{p_id:ID}),
    add:a=>call("add_signup",{p_id:ID,p_date:a.date,p_slot:a.slot,p_name:a.name,p_contact:a.contact,p_player:a.player,p_item:a.item}),
    cancel:(id,token)=>call("cancel_signup",{p_entry:id,p_token:token})
  };
}

/* ---------- page ---------- */
function fail(text){$("#suLoading").hidden=true;$("#suApp").hidden=true;$("#suError").hidden=false;$("#suError").textContent=text;}
async function load(){
  try{SHEET=await api.get();}catch(e){fail("Couldn't load the sign-up. Check your connection and try again.");return;}
  if(!SHEET){fail("This sign-up sheet is closed or the link is wrong. Ask your coach for the current link.");return;}
  const t=SHEET.team||{};
  document.documentElement.style.setProperty("--team",t.color||"#5b2a86");
  if(t.color2){document.documentElement.style.setProperty("--team2",t.color2);document.documentElement.classList.add("has-c2");}
  document.documentElement.style.setProperty("--team-ink",ink(t.color));
  document.title=`${SHEET.title} · ${t.name||"Team"}`;
  $("#suEyebrow").textContent=[t.school&&t.mascot?`${t.school} ${t.mascot}`:t.name,t.teamLabel].filter(Boolean).join(" · ");
  $("#suTitle").textContent=SHEET.title||"Game-day food";
  if(t.logo){$("#suLogo").src=t.logo;$("#suLogo").hidden=false;}
  $("#suNote").hidden=!SHEET.note;$("#suNote").textContent=SHEET.note||"";
  $("#suDemo").hidden=!DEMO;
  render();
  $("#suLoading").hidden=true;$("#suError").hidden=true;$("#suApp").hidden=false;
}
function ink(hex){const m=/^#?([0-9a-f]{6})$/i.exec(hex||"");if(!m)return "#ffffff";const n=parseInt(m[1],16);
  const L=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});
  return .2126*L[0]+.7152*L[1]+.0722*L[2]>.4?"#17141c":"#ffffff";}
function render(){
  const by={};SHEET.entries.forEach(e=>{(by[e.date+"|"+e.slot]=by[e.date+"|"+e.slot]||[]).push(e);});
  const mine=readMine().filter(m=>SHEET.entries.some(e=>e.id===m.id));writeMine(mine);
  $("#suMine").hidden=!mine.length;
  $("#suMine").innerHTML=`<h2>Your sign-ups</h2><ul>${mine.map(m=>`<li><span><b>${esc(m.slot)}</b>, ${esc(longDay(m.date))}${m.opp?` (${m.home?"vs":"at"} ${esc(m.opp)})`:""}</span><button class="linkbtn" type="button" data-cancel="${esc(m.id)}">Cancel</button></li>`).join("")}</ul>`;
  const games=SHEET.games||[],y=yesterday();
  games.forEach(g=>{if(g.past===undefined)g.past=g.date<y;});
  const left=g=>(SHEET.slots||[]).reduce((n,x)=>n+Math.max(0,x.count-(by[g.date+"|"+x.name]||[]).length),0);
  const total=(SHEET.slots||[]).reduce((n,x)=>n+x.count,0);
  const status=g=>g.past?["Played","st-past"]:g.skip?["No food needed","st-skip"]:left(g)?[`${left(g)} of ${total} open`,"st-open"]:["All set ✓","st-full"];
  const row=g=>{const d=dObj(g.date),[st,cls]=status(g),on=openDate===g.date,can=!g.past&&!g.skip;
    return `<article class="su-g ${cls}${on?" on":""}">
      <button type="button" class="su-row" data-g="${g.date}" aria-expanded="${on}"${can?"":" disabled"}>
        <span class="su-date"><small>${d.toLocaleDateString("en-US",{month:"short"})}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString("en-US",{weekday:"short"})}</small></span>
        <span class="su-opp"><b>${g.home?"vs":"at"} ${esc(g.opponent||"Game")}</b><small>${g.time?ampm(g.time):"Time TBD"} · ${g.home?"Home":"Away"}</small>${g.past?"":`<span class="su-drop${dropOf(g)?"":" tba"}">${dropOf(g)?`🍎 Food by ${ampm(dropOf(g))}`:"Food drop-off time coming soon"}</span>`}</span>
        <span class="su-st">${st}</span>${can?`<span class="su-chev" aria-hidden="true">›</span>`:""}
      </button>
      ${on?`<div class="su-slots"><p class="su-pickhelp">${dropOf(g)?`Please have food there by <b>${ampm(dropOf(g))}</b>${g.home?"":" (away game)"}. `:"The coach will post the drop-off time soon. "}Pick what you'll bring:</p>${(SHEET.slots||[]).map(x=>{const list=by[g.date+"|"+x.name]||[],l=x.count-list.length;
        return `<div class="su-slot"><div><div class="nm">${esc(x.name)}</div><div class="left${l<=0?" full":""}">${l<=0?"All set, thank you!":`${l} of ${x.count} spot${x.count===1?"":"s"} open`}</div></div>
          ${l>0?`<button class="btn primary" type="button" data-date="${g.date}" data-slot="${esc(x.name)}">Sign up</button>`:""}
          ${list.length?`<ul>${list.map(e=>`<li>${esc(e.name)}${e.item?`: ${esc(e.item)}`:""}</li>`).join("")}</ul>`:""}</div>`;}).join("")}</div>`:""}
    </article>`;};
  const past=games.filter(g=>g.past),rest=games.filter(g=>!g.past);
  $("#suCount").textContent=games.length?`${rest.length} game${rest.length===1?"":"s"} left this season${past.length?`, ${past.length} played`:""}. Tap a game to see what's needed.`:"";
  $("#suGames").innerHTML=games.length?
    (past.length?`<details class="su-pastwrap"${showPast?" open":""}><summary>Games already played (${past.length})</summary>${past.map(row).join("")}</details>`:"")+
    rest.map(row).join("")+(rest.length?"":`<div class="su-empty" style="margin-top:0">The season's games are all played. Thank you for helping out!</div>`):
    `<div class="su-empty" style="margin-top:0">No games are on the schedule yet. Check back later.</div>`;
}
$("#suGames").addEventListener("click",e=>{
  const r=e.target.closest("[data-g]");
  if(r){openDate=openDate===r.dataset.g?null:r.dataset.g;render();
    const el=document.querySelector(`[data-g="${openDate}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});return;}
  const b=e.target.closest("[data-slot]");if(!b)return;
  const g=SHEET.games.find(x=>x.date===b.dataset.date);pick={date:b.dataset.date,slot:b.dataset.slot,g};
  $("#suSum").innerHTML=`<b>${esc(pick.slot)}</b><br>${esc(longDay(pick.date))} · ${g.home?"vs":"at"} ${esc(g.opponent||"Game")}${g.time?" · "+ampm(g.time):""}`;
  try{const me=JSON.parse(localStorage.getItem("cpp:parent")||"{}");$("#suName").value=me.name||"";$("#suContact").value=me.contact||"";$("#suPlayer").value=me.player||"";}catch{}
  $("#suItem").value="";$("#suMsg").textContent="";$("#suMsg").className="msg";
  $("#suForm").hidden=false;$("#suDone").hidden=true;$("#suGo").disabled=false;
  $("#suDlg").showModal();($("#suName").value?$("#suItem"):$("#suName")).focus();
});
$("#suCancel").addEventListener("click",()=>$("#suDlg").close());
$("#suOk").addEventListener("click",()=>$("#suDlg").close());
$("#suForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!pick)return;
  const a={...pick,name:$("#suName").value.trim(),contact:$("#suContact").value.trim(),player:$("#suPlayer").value.trim(),item:$("#suItem").value.trim()};
  $("#suGo").disabled=true;$("#suMsg").textContent="Saving…";$("#suMsg").className="msg";
  try{
    const r=await api.add(a);
    try{localStorage.setItem("cpp:parent",JSON.stringify({name:a.name,contact:a.contact,player:a.player}));}catch{}
    writeMine([...readMine(),{id:r.id,token:r.token,date:a.date,slot:a.slot,opp:a.g.opponent||"",home:a.g.home}]);
    last=a;openDate=a.date;
    const dp=dropOf(a.g);
    $("#suDoneText").innerHTML=`<b>${esc(a.slot)}</b>${a.item?` (${esc(a.item)})`:""} for ${esc(longDay(a.date))}, ${a.g.home?"vs":"at"} ${esc(a.g.opponent||"the game")}${a.g.time?` at ${ampm(a.g.time)}`:""}.${dp?` Please have it there by <b>${ampm(dp)}</b>.`:" The coach will post the drop-off time."} Thank you!`;
    $("#suForm").hidden=true;$("#suDone").hidden=false;
    await load();
  }catch(err){$("#suGo").disabled=false;$("#suMsg").textContent=err.message.replace(/^.*?ERROR:\s*/,"");$("#suMsg").className="msg err";await load().catch(()=>{});}
});
$("#suIcs").addEventListener("click",()=>{
  if(!last)return;const g=last.g,d=last.date.replace(/-/g,"");
  const t=(dropOf(g)||g.time||"17:00").replace(":","")+"00";
  const team=(SHEET.team||{}).name||"Team";
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Coach Practice Planner//Sign-up//EN","BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@practice-planner`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").slice(0,15)}Z`,
    `DTSTART:${d}T${t}`,`SUMMARY:${dropOf(g)?"Drop off":"Bring"} ${last.slot.replace(/[,;]/g," ")} - ${team.replace(/[,;]/g," ")} ${g.home?"vs":"at"} ${(g.opponent||"").replace(/[,;]/g," ")}`,
    `DESCRIPTION:${(last.item||"").replace(/[,;\n]/g," ")}`,"BEGIN:VALARM","TRIGGER:-PT2H","ACTION:DISPLAY","DESCRIPTION:Game-day food","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));a.download="game-day-food.ics";document.body.appendChild(a);a.click();a.remove();
});
$("#suMine").addEventListener("click",async e=>{
  const b=e.target.closest("[data-cancel]");if(!b)return;
  if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again to cancel";return;}
  const m=readMine().find(x=>x.id===b.dataset.cancel);if(!m)return;
  try{await api.cancel(m.id,m.token);writeMine(readMine().filter(x=>x.id!==m.id));await load();}catch(err){b.textContent="Couldn't cancel. Try again";}
});
$("#suGames").addEventListener("toggle",e=>{if(e.target.classList.contains("su-pastwrap"))showPast=e.target.open;},true);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&SHEET&&!$("#suDlg").open)load();});
if(!ID)fail("This link is missing its sign-up code. Ask your coach for the link.");else load();
})();
