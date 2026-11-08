/* Calendar tab → "Parent link": one read-only link per team that always shows the current
   calendar (theextracoach.com/c/…). Parents need no account. Coaches who can edit the calendar
   make the link, pick what it shows, and can turn it off. Saved in calendar_shares (hosted)
   or in this browser (demo). */
(function(){
const SHOW_DEFAULT={practices:true,games:true,bus:true,off:true};
const randId=()=>{const a=new Uint8Array(10);crypto.getRandomValues(a);return Array.from(a,b=>"abcdefghijkmnpqrstuvwxyz23456789"[b%32]).join("");};
/* Short, clean links parents can trust: theextracoach.com/c/<code> */
const linkURL=id=>location.origin+"/c/"+encodeURIComponent(id)+(HOSTED?"":"?demo=1");
/* Which team's link you're looking at: any of your teams, whatever team is open in the app. */
let LT=null;const LT_=()=>LT&&teams.some(t=>t.id===LT.id)?teams.find(t=>t.id===LT.id):team;
const canMake=()=>LT_()===team||LT_().id===team.id?(typeof PERM==="undefined"||!!PERM.schedule):(!HOSTED||permsFor(LT_().role,LT_().perms).schedule);
const missing=e=>/calendar_shares|team_ids|does not exist|schema cache/i.test((e&&e.message)||String(e||""));
const API=()=>HOSTED?{
  async load(){const {data,error}=await sb.from("calendar_shares").select("*").eq("team_id",LT_().id).maybeSingle();if(error)throw error;return data;},
  async create(v){const {data,error}=await sb.from("calendar_shares").insert({...v,team_id:LT_().id}).select().single();if(error)throw error;return data;},
  async update(id,v){const {data,error}=await sb.from("calendar_shares").update(v).eq("id",id).select().single();if(error)throw error;return data;}
}:{
  key:()=>"cpp:calshare:"+LT_().id,
  async load(){try{return JSON.parse(localStorage.getItem(this.key())||"null");}catch{return null;}},
  save(v){localStorage.setItem(this.key(),JSON.stringify(v));localStorage.setItem("cpp:calshareTeam:"+v.id,LT_().id);return v;},
  async create(v){return this.save({...v,team_id:LT_().id,created_at:new Date().toISOString()});},
  async update(id,v){const cur=await this.load();return this.save({...cur,...v});}
};
let share=null,state="idle",nodbWhy="";

const teamLine=()=>{const T=LT_(),s=T.settings||{};return [s.school&&s.mascot?`${s.school} ${s.mascot}`:T.name,s.teamLabel].filter(Boolean).join(" · ");};
const showBoxes=(sh,dis)=>`<fieldset class="catpick"><legend>Parents see</legend><div class="exp-pick">
  <label><input type="checkbox" data-cs="games"${sh.games!==false?" checked":""}${dis}> Games</label>
  <label><input type="checkbox" data-cs="practices"${sh.practices!==false?" checked":""}${dis}> Practices and tryouts</label>
  <label><input type="checkbox" data-cs="bus"${sh.bus!==false?" checked":""}${dis}> Bus and departure times</label>
  <label><input type="checkbox" data-cs="off"${sh.off!==false?" checked":""}${dis}> Days off, holidays and notes (meetings)</label></div></fieldset>`;
/* Teams on the link: this team, plus any other teams you coach (e.g. 7th and 8th grade on one link). */
const others=()=>(typeof teams!=="undefined"?teams:[]).filter(t=>t.id!==LT_().id);
const lbl=t=>((t.settings||{}).teamLabel)||t.name;
const teamPick=()=>(typeof teams!=="undefined"&&teams.length>1)?`<div class="cs-pick" role="group" aria-label="Which team's link">${[...teams].sort((a,b)=>lbl(a).localeCompare(lbl(b),undefined,{numeric:true})).map(t=>`<button type="button" data-csteam="${esc(t.id)}"${t.id===LT_().id?' class="on" aria-pressed="true"':' aria-pressed="false"'}>${esc(lbl(t))}</button>`).join("")}</div>`:"";
const teamBoxes=(ids,dis)=>others().length?`<details class="cs-more"${(ids||[]).length>1?" open":""}><summary>Also show another team on this link</summary><div class="exp-pick">
  ${others().map(t=>`<label><input type="checkbox" data-cst="${esc(t.id)}"${(ids||[]).includes(t.id)?" checked":""}${dis}> ${esc(lbl(t))}</label>`).join("")}</div></details>`:"";
const readTeams=()=>{const o=[LT_().id];box().querySelectorAll("[data-cst]:checked").forEach(x=>o.push(x.dataset.cst));return o;};

/* Shown in two places: the Calendar tab's "Parent link" button (a dialog) and Team → Parent Admin. */
const inDlg=()=>$("#calShareDlg").open;
const box=()=>inDlg()?$("#csBody"):$("#tm-plink");
function render(){
  const ed=canMake(),dis=ed?"":" disabled",dlg=inDlg();
  (dlg?$("#tm-plink"):$("#csBody")).innerHTML="";
  let body="";
  if(state==="loading")body=`<p class="help">Loading…</p>`;
  else if(state==="nodb")body=`<p class="help">${nodbWhy==="teams"?"Putting more than one team on a parent link needs one database update: in Supabase, open SQL Editor, paste <b>multi-team-links.sql</b> and tap Run. Your current link still works.":"The parent link needs one more database step. In Supabase, open SQL Editor, paste <b>supabase/team-tools.sql</b> and tap Run. Then try again."}</p>`;
  else if(!share)body=ed?`<p class="help" style="margin-top:0">Make one link for parents. It always shows this calendar as it is right now: when you change a practice or add a game, parents see it the next time they open the link. No account needed.</p>
      ${teamBoxes([],"")}${showBoxes(SHOW_DEFAULT,"")}<div class="actions" style="margin:0"><button class="btn primary" type="button" data-csact="make">Make the parent link</button></div>`:
      `<p class="help">There's no parent link yet. Ask your head coach to make one.</p>`;
  else{
    const url=linkURL(share.id);
    body=share.active?`<p class="help" style="margin-top:0">Send this to parents by text, email or your team app. It always shows the latest calendar. Parents can also subscribe so the schedule shows up in their phone's calendar app.</p>
      <div class="fd-url"><input readonly value="${esc(url)}" id="csUrl" aria-label="Parent calendar link"><button class="btn primary" type="button" data-csact="copy">Copy link</button>${navigator.share?`<button class="btn" type="button" data-csact="share">Send…</button>`:""}<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open</a></div>
      <div class="actions" style="margin:8px 0 0"><button class="btn" type="button" data-csact="msg">Copy a message for parents</button></div>
      ${teamBoxes(share.team_ids||[],dis)}${showBoxes(share.show||SHOW_DEFAULT,dis)}`:
      `<p class="help" style="margin-top:0">The link is off. Parents who open it see that the calendar isn't shared. Turn it back on and the same link works again.</p>`;
    if(ed)body+=`<div class="actions" style="margin:8px 0 0"><button class="btn${share.active?" danger":""}" type="button" data-csact="toggle">${share.active?"Turn off the link":"Turn the link back on"}</button></div>`;
  }
  box().innerHTML=dlg?`<h2 id="csTitle">Parent calendar link</h2>${teamPick()}<p class="eyebrow" style="margin:-4px 0 10px">${esc(teamLine())}</p>${body}
    <div class="msg" id="csMsg" aria-live="polite"></div><div class="actions" style="margin:0"><button class="btn" type="button" data-csact="close">Close</button></div>`:
    `<div class="tm-card fd-link"><h3 class="tm-h">Parent calendar link</h3>${teamPick()}<p class="eyebrow" style="margin:0 0 8px">${esc(teamLine())}</p>${body}<div class="msg" id="csMsg" aria-live="polite"></div></div>`;
}
async function reload(){share=null;state="loading";render();
  try{share=await API().load();state="ready";}catch(e){state=missing(e)?"nodb":"ready";}render();}
async function open(asPane){
  LT=null;share=null;state="loading";if(!asPane&&!inDlg())$("#calShareDlg").showModal();render();
  try{share=await API().load();state="ready";}catch(e){state=missing(e)?"nodb":"ready";if(state==="ready")setTimeout(()=>msg($("#csMsg"),"Couldn't load the link: "+(e.message||"check your connection"),"err"));}
  render();
}
async function save(v,ok){
  try{share=share?await API().update(share.id,v):await API().create({id:randId(),show:SHOW_DEFAULT,...v});state="ready";render();if(ok)msg($("#csMsg"),ok,"ok");}
  catch(e){if(missing(e)){nodbWhy=/team_ids/i.test((e&&e.message)||"")?"teams":"";state="nodb";render();}else msg($("#csMsg"),"Not saved: "+(e.message||"check your connection"),"err");}
}
const readShow=()=>{const o={};box().querySelectorAll("[data-cs]").forEach(x=>o[x.dataset.cs]=x.checked);return o;};

$("#calShare").addEventListener("click",()=>open(false));
$("#calShareDlg").addEventListener("close",()=>{$("#csBody").innerHTML="";});
if(window.TM)TM.panes.plink=()=>{if(!inDlg())open(true);};
async function onClick(e){
  if(e.target===$("#calShareDlg")){$("#calShareDlg").close();return;}
  const tp=e.target.closest("[data-csteam]");if(tp){const t=teams.find(x=>x.id===tp.dataset.csteam);if(t&&t.id!==LT_().id){LT=t;await reload();}return;}
  const a=e.target.closest("[data-csact]");if(!a)return;const k=a.dataset.csact;
  const url=share?linkURL(share.id):"";
  const name=(LT_().settings||{}).mascot||LT_().name;
  const text=()=>`Here's our ${name} calendar: practices, games and changes, always up to date. Bookmark it or add it to your phone's calendar: ${url}`;
  const copy=async(t,ok)=>{try{await navigator.clipboard.writeText(t);msg($("#csMsg"),ok,"ok");}catch{const i=$("#csUrl");if(i)i.select();msg($("#csMsg"),"Select the link and copy it.","err");}};
  if(k==="close")$("#calShareDlg").close();
  if(k==="make"){a.disabled=true;const ids=readTeams();await save({show:readShow(),active:true,...(ids.length>1?{team_ids:ids}:{})},"Link made. Copy it and send it to parents.");}
  if(k==="copy")copy(url,"Link copied.");
  if(k==="msg")copy(text(),"Message copied. Paste it into a text or email to parents.");
  if(k==="share")navigator.share({title:`${name} calendar`,text:text(),url}).catch(()=>{});
  if(k==="toggle"){
    if(share.active&&a.dataset.armed!=="1"){a.dataset.armed="1";a.textContent="Tap again: parents lose access";return;}
    await save({active:!share.active},share.active?"Link turned off.":"Link is back on.");
  }
}
$("#calShareDlg").addEventListener("click",onClick);$("#tm-plink").addEventListener("click",onClick);
function onChange(e){
  if(e.target.closest("[data-cst]")&&share&&canMake()){const ids=readTeams();save({team_ids:ids.length>1?ids:null},"Saved. Parents see these teams next time they open the link.");return;}
  if(!e.target.closest("[data-cs]")||!share||!canMake())return;
  const v=readShow();if(!v.games&&!v.practices&&!v.off){e.target.checked=true;msg($("#csMsg"),"Parents need to see at least one thing.","err");return;}
  save({show:v},"Saved. Parents see this next time they open the link.");
}
$("#calShareDlg").addEventListener("change",onChange);$("#tm-plink").addEventListener("change",onChange);
})();
