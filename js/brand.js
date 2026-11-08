/* The Extra Coach branding: homepage buttons, and the "Invite a coach" link at the bottom of the app.
   Each coach gets one personal invite link (theextracoach.com/?ref=abc123). When a new coach signs up
   from it, it counts toward that coach's invites (see js/track.js and supabase/team-tools.sql). */
(function(){
const q=s=>document.querySelector(s);
const escH=t=>String(t==null?"":t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- homepage ---------- */
/* Menu: on phones it opens as a panel; Features and Import scroll within the homepage. */
document.addEventListener("click",e=>{
  const m=e.target.closest("#lpMenu"),nav=q("#lpNav");if(!nav)return;
  if(m){const open=!nav.classList.contains("open");nav.classList.toggle("open",open);m.setAttribute("aria-expanded",open);return;}
  const go=e.target.closest("[data-lpgo]");
  if(go){e.preventDefault();const t=document.getElementById(go.dataset.lpgo);if(t)t.scrollIntoView({behavior:"smooth",block:"start"});}
  if(nav.classList.contains("open")&&(go||e.target.closest("#lpNav a,#lpNav button")||!e.target.closest(".lp-top"))){nav.classList.remove("open");const b=q("#lpMenu");if(b)b.setAttribute("aria-expanded","false");}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const nav=q("#lpNav");if(nav&&nav.classList.contains("open")){nav.classList.remove("open");q("#lpMenu").setAttribute("aria-expanded","false");q("#lpMenu").focus();}}});
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-lp]");if(!b)return;
  if(window.HOME_PREVIEW){location.href="/";return;}   // signed in and previewing the homepage: go back to the app
  if(typeof HOSTED!=="undefined"&&!HOSTED){location.href=location.pathname;return;}   // demo preview: back into the demo
  show("screen-auth");authTab(b.dataset.lp==="up"?"up":"in");
  setTimeout(()=>{const f=b.dataset.lp==="up"?q("#authName"):q("#authEmail");if(f)f.focus();},50);
});
const back=q("#authBack");if(back)back.addEventListener("click",()=>show("screen-landing"));

/* ---------- invite a coach ---------- */
const dlg=q("#inviteDlg"),body=q("#invBody");
let code=null,count=null;
const linkOf=c=>"https://theextracoach.com/?ref="+encodeURIComponent(c);
function render(err){
  const url=code?linkOf(code):"";
  body.innerHTML=`<h2 id="invTitle">🎁 Invite a coach</h2>
    <p class="help" style="margin-top:0">Know a coach who's still running practice off a clipboard? Send them your link. When they make an account from it, it counts as your invite.</p>
    ${err?`<p class="msg err">${escH(err)}</p>`:!code?`<p class="help">Getting your link…</p>`:`
    <div class="fd-url"><input readonly value="${escH(url)}" id="invUrl" aria-label="Your invite link"><button class="btn primary" type="button" data-inv="copy">Copy link</button>${navigator.share?`<button class="btn" type="button" data-inv="share">Send…</button>`:""}</div>
    <div class="actions" style="margin:8px 0 0"><button class="btn" type="button" data-inv="msg">Copy a message to send</button></div>
    ${count!=null?`<p class="inv-count"><b>${count}</b> coach${count===1?"":"es"} joined from your link</p>`:""}`}
    <div class="msg" id="invMsg" aria-live="polite"></div>
    <div class="actions" style="margin:0"><button class="btn" type="button" data-inv="close">Close</button></div>`;
}
const message=()=>`I've been using The Extra Coach for practice plans, plays, our calendar and parent stuff. It's worth a look: ${linkOf(code)}`;
async function copy(t){try{await navigator.clipboard.writeText(t);return true;}catch{const i=q("#invUrl");if(i){i.select();try{return document.execCommand("copy");}catch{}}return false;}}
async function open(){
  render();dlg.showModal();
  if(typeof HOSTED==="undefined"||!HOSTED){code="demo";count=0;render();return;}
  try{
    const {data,error}=await sb.rpc("my_referral_code");if(error)throw error;code=data;render();
    const c=await sb.rpc("my_referral_count");if(!c.error){count=c.data||0;render();}
  }catch(e){render(/my_referral_code|does not exist|schema cache/i.test(e.message||"")?"Invite links need one more database step: in Supabase, open SQL Editor, paste supabase/team-tools.sql and tap Run.":"Couldn't get your link: "+(e.message||e));}
}
document.addEventListener("click",async e=>{
  if(e.target.closest("#inviteCoach")){open();return;}
  const a=e.target.closest("[data-inv]");if(!a)return;const k=a.dataset.inv,m=q("#invMsg");
  if(k==="close"){dlg.close();return;}
  if(k==="copy"){const ok=await copy(linkOf(code));m.textContent=ok?"Link copied.":"Press and hold the link to copy it.";}
  if(k==="msg"){const ok=await copy(message());m.textContent=ok?"Message copied. Paste it in a text or email.":"Couldn't copy. Copy the link instead.";}
  if(k==="share"){try{await navigator.share({title:"The Extra Coach",text:message()});}catch{}}
});
dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});
})();
