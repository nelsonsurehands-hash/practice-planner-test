/* Feature use and referrals.
   - Feature use: counts which tabs, sections and actions coaches use (just names and counts, never
     what they type), sent in small batches and shown to the app's owner in Settings → App usage.
   - Referrals: a link like theextracoach.com/?ref=k7m2xq credits the coach who shared it when a new
     coach signs up from it. Every page of the app sets this up the same way. */
(function(){
const counts={};let total=0,timer=null;
const sbOK=()=>typeof HOSTED!=="undefined"&&HOSTED&&typeof sb!=="undefined"&&sb&&typeof user!=="undefined"&&user;
function track(name){if(!name)return;name=String(name).slice(0,40);counts[name]=(counts[name]||0)+1;total++;
  if(total>=25)flush();else if(!timer)timer=setTimeout(flush,60000);}
function flush(){clearTimeout(timer);timer=null;if(!total||!sbOK())return;
  const body={...counts};Object.keys(counts).forEach(k=>delete counts[k]);total=0;
  sb.rpc("log_features",{p_counts:body}).then(()=>{},()=>{});}
window.track=track;track._counts=counts;
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flush();});

/* Tabs and Team sections */
if(typeof setTab==="function"){const _set=setTab;window.setTab=setTab=function(t){const r=_set.apply(this,arguments);track("tab:"+t);return r;};}
document.addEventListener("click",e=>{const tm=e.target.closest("[data-tm]");if(tm)track("team:"+tm.dataset.tm);},true);

/* Actions worth knowing about */
const CLICKS=[
  ["#pPlay","play:run"],["#shareBook","plays:share"],["#pPdf","plays:print"],["#printPdf","plan:print"],["#calIcs","cal:export"],
  ["#calShare","parentlink:open"],["[data-csact=copy],[data-csact=share],[data-csact=msg]","parentlink:send"],
  ["[data-fdact=copy],[data-fdact=share],[data-fdact=msg]","food:send"],["[data-st=golive]","stats:live"],["[data-lv]","stats:tracking"],
  ["[data-st=season]","stats:season"],["[data-busact=pdf]","bus:print"],["[data-busact=text]","bus:copy"],["[data-board]","bus:checkin"],
  ["[data-schact=pdf]","schedule:print"],["[data-schact=text]","schedule:copy"],["#sExport","export"],["#pageHelpBtn","help"],
  ["[data-hm]",el=>"home:"+el.dataset.hm],["[data-photo]",el=>"photo:"+el.dataset.photo],["[data-exp]",el=>"cal:export:"+el.dataset.exp],
  ["#calSetupBtn","cal:setup"],["[data-mdq]","cal:multiday"],["[data-schoolcode]","staff:schoolcode"],["#inviteCoach","invite:open"]
];
document.addEventListener("click",e=>{for(const [sel,name] of CLICKS){const el=e.target.closest(sel);if(el){track(typeof name==="function"?name(el):name);}}},true);
document.addEventListener("change",e=>{const t=e.target;
  if(t.id==="pDef")track("defense:"+t.value);
  if(t.id==="pSpeed")track("play:speed");},true);
document.addEventListener("submit",e=>{const f=e.target;
  if(f.id==="drillForm")track("drill:save");if(f.id==="setupForm")track("team:create");if(f.id==="joinForm")track("team:join");},true);

/* ---------- referrals ---------- */
try{
  const q=new URLSearchParams(location.search),ref=(q.get("ref")||"").trim().toLowerCase();
  if(ref&&/^[a-z0-9]{2,20}$/.test(ref)&&!localStorage.getItem("cpp:ref"))localStorage.setItem("cpp:ref",ref);
  if(ref){q.delete("ref");history.replaceState(null,"",location.pathname+(q.toString()?"?"+q:"")+location.hash);}
}catch{}
/* Once a coach is signed in, credit the invite (the database only counts brand-new accounts). */
const iv=setInterval(()=>{if(!sbOK())return;clearInterval(iv);
  let ref=null,done=null;try{ref=localStorage.getItem("cpp:ref");done=localStorage.getItem("cpp:refDone");}catch{}
  if(ref&&!done)sb.rpc("record_referral",{p_code:ref}).then(({error})=>{if(!error)try{localStorage.setItem("cpp:refDone","1");}catch{}},()=>{});
},2000);
setTimeout(()=>clearInterval(iv),10*60*1000);
})();
