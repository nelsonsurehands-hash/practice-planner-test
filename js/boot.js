/* App start-up: sign-in, teams and staffs, Settings, copying between teams, backups. */
const CFG=window.APP_CONFIG||{};
const HOSTED=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&window.supabase);
let sb=null, user=null, team=null, teams=[], store=null, members=[];

/* Starter drills by sport (offered when a team is created). */
const STARTERS={
 basketball:[["starter-dynamic-warmup",{name:"Dynamic Warm-up",categories:["Warm-up"],minutes:8,description:"Lines baseline to half court and back: high knees, butt kicks, carioca, lunges with twist, defensive slides, backpedal, sprint.",points:"Full effort on every rep. Talk to each other."}],
 ["starter-two-ball",{name:"Two-Ball Dribbling",categories:["Ball handling"],minutes:6,description:"Each player with two balls: same-time pounds, alternating, high-low, then walking forward and back.",points:"Eyes up. Pound the ball below the waist."}],
 ["starter-mikan",{name:"Mikan Drill",categories:["Finishing"],minutes:5,description:"Continuous alternating layups under the rim, right hand off the right side, left hand off the left. Count makes in 30 or 60 seconds.",points:"Use the backboard. Keep the ball high."}],
 ["starter-3man-weave",{name:"3-Man Weave",categories:["Passing","Transition"],minutes:8,description:"Three lines at the baseline. Pass and go behind the receiver, full court, finish with a layup. Add a 2-on-1 coming back.",points:"Lead passes, no dribbles. Sprint to fill the lane."}],
 ["starter-form-shooting",{name:"Form Shooting",categories:["Shooting"],minutes:8,description:"Partners, close to the rim. One-hand shots, then two hands, stepping back after every 5 makes.",points:"Elbow under the ball, hold the follow-through."}],
 ["starter-partner-shooting",{name:"Partner Shooting",categories:["Shooting"],minutes:8,description:"Shooter and rebounder/passer. Shooter moves to 5 spots around the arc; switch after 10 shots.",points:"Feet ready before the catch. Call for the ball."}],
 ["starter-shell",{name:"Shell Drill (4-on-4)",categories:["Defense"],minutes:12,description:"4 offense on the perimeter pass it around; defense moves on every pass to on-ball, deny or help. Add skip passes, then drives.",points:"Jump to the ball on every pass. Talk: ball, help, deny."}],
 ["starter-closeouts",{name:"Closeouts",categories:["Defense"],minutes:6,description:"Defender starts under the rim, passes to a shooter on the wing, closes out with choppy steps, then contains one dribble.",points:"Sprint then chop. Hands high."}],
 ["starter-box-out",{name:"Box Out Battle",categories:["Rebounding","Defense"],minutes:6,description:"3-on-3 inside the lane. Coach shoots; defense must box out and secure the rebound.",points:"Find, hit, then get the ball. Wide base."}],
 ["starter-ft-sprints",{name:"Free Throw Sprints",categories:["Conditioning","Shooting"],minutes:5,description:"A player shoots a free throw: a make cancels the sprint, a miss is a down-and-back for the team.",points:"Game-pressure free throws while tired."}],
 ["starter-scrimmage",{name:"Controlled Scrimmage",categories:["Scrimmage"],minutes:15,description:"5-on-5 with stops to teach. Run the offense and defense from the day's focus.",points:"Pick one or two things to correct and stick to them."}]],
 volleyball:[
  ["vb-pepper",{name:"Pepper",categories:["Warm-up","Passing","Setting"],minutes:8,description:"Partners: pass, set, hit in a continuous rally. Switch to dig-set-hit after 2 minutes.",points:"Platform angle to target. Talk on every touch."}],
  ["vb-serve-targets",{name:"Serving Targets",categories:["Serving"],minutes:10,description:"Servers aim at zones 1, 5 and 6 marked with cones. Count makes per player.",points:"Same toss every time. Follow through to the target."}],
  ["vb-serve-receive",{name:"3-Person Serve Receive",categories:["Serve receive","Passing"],minutes:12,description:"Three passers in W formation receive live serves; setter at target scores each pass 0–3.",points:"Call the ball early. Feet to the ball, then platform."}],
  ["vb-block-footwork",{name:"Block Footwork",categories:["Blocking"],minutes:6,description:"Front row slides and crosses along the net to antenna and middle, jumping on coach's cue.",points:"Hands over the net, press. Close the seam with the middle."}],
  ["vb-queen-court",{name:"Queen of the Court",categories:["Scrimmage","Transition"],minutes:15,description:"Teams of 2–3 challenge the queen side; win the rally to move over.",points:"Compete every ball. Fast transition off the net."}]],
 soccer:[
  ["sc-rondo",{name:"Rondo 5v2",categories:["Warm-up","Possession","Passing"],minutes:10,description:"Five on the outside of a 10x10 grid keep the ball from two defenders. Defender who wins it swaps with the passer.",points:"Two-touch max. Open your body to the next pass."}],
  ["sc-passing-pattern",{name:"Passing Pattern (Y)",categories:["Passing"],minutes:10,description:"Y-shaped passing pattern with follow-your-pass rotation; add a give-and-go.",points:"Pass to the back foot. Check away before checking to the ball."}],
  ["sc-1v1",{name:"1v1 to Goal",categories:["Dribbling","Defending","Finishing"],minutes:10,description:"Attacker receives from coach and goes 1v1 against a defender to a small goal.",points:"Attack the front foot. Defender stays low and patient."}],
  ["sc-finishing",{name:"Finishing Waves",categories:["Shooting","Finishing"],minutes:12,description:"Wide player crosses, two runners attack near and far post.",points:"Near post run first. Strike across the keeper."}],
  ["sc-ssg",{name:"Small-Sided Game 4v4",categories:["Small-sided games","Scrimmage"],minutes:15,description:"4v4 on a short field with small goals; restart with coach serves.",points:"Width and support angles. Win it back within 5 seconds."}]],
 football:[
  ["fb-dynamic",{name:"Dynamic Warm-up",categories:["Warm-up"],minutes:10,description:"Lines 10 yards: high knees, carioca, backpedal, shuffle, build-ups.",points:"Full speed on the last rep."}],
  ["fb-tackling-circuit",{name:"Tackling Circuit",categories:["Tackling","Defense"],minutes:12,description:"Stations: form fit, angle tackle on bags, shoulder tackle on tubes.",points:"Eyes up, near foot, wrap and roll."}],
  ["fb-routes-on-air",{name:"Routes on Air",categories:["Route running","Offense"],minutes:10,description:"QBs and receivers run the route tree against air at full speed.",points:"Sell the stem. Break at exact depth."}],
  ["fb-oline-sled",{name:"O-Line Sled",categories:["Blocking","Individual"],minutes:8,description:"First step, punch, drive on the sled by position group.",points:"Pad level below the defender. Short first step."}],
  ["fb-team-period",{name:"Team Period",categories:["Team","Offense","Defense"],minutes:20,description:"Offense vs defense, scripted plays from the day's install.",points:"Get lined up fast. Coach one thing per rep."}]],
 baseball:[
  ["bs-throwing",{name:"Throwing Progression",categories:["Warm-up","Throwing"],minutes:10,description:"Wrist flips, one-knee, long toss back to 90 feet.",points:"Lead with the glove-side shoulder. Finish over the front leg."}],
  ["bs-infield",{name:"Infield / Outfield",categories:["Fielding","Team defense"],minutes:15,description:"Coach hits rounds to every position with throws to each base and home.",points:"Get around the ball. Crow hop on outfield throws."}],
  ["bs-tee-work",{name:"Tee and Soft Toss",categories:["Hitting"],minutes:12,description:"Stations: high tee, low tee, soft toss from the side.",points:"Hands inside the ball. Barrel stays through the zone."}],
  ["bs-baserunning",{name:"Baserunning: First to Third",categories:["Baserunning"],minutes:10,description:"Runners read the ball off the bat and go first to third on a single.",points:"Round the bag at second. Find the coach early."}],
  ["bs-cutoffs",{name:"Cutoffs & Relays",categories:["Team defense","Throwing"],minutes:10,description:"Hits to the gaps; outfield hits the cutoff, infield calls the play.",points:"Line up the cut. Loud, early calls."}]],
 other:[]
};
function startersFor(sport){return (STARTERS[sport]||[]).map(([id,d])=>[id,{...d,category:d.categories[0],createdAt:Date.now()}]);}

const screens=["screen-loading","screen-auth","screen-setup","app"];
function show(id){
  screens.forEach(x=>{if(x==="screen-loading")return;$("#"+x).hidden=x!==id;});window.scrollTo(0,0);
  const sp=$("#screen-loading");   // the splash fades out instead of vanishing
  if(id==="screen-loading"){sp.hidden=false;sp.classList.remove("out");}
  else if(!sp.hidden&&!sp.classList.contains("out")){sp.classList.add("out");setTimeout(()=>{if(sp.classList.contains("out"))sp.hidden=true;},450);}
}
/* Remember this team's look for the splash screen next time the app opens on this device. */
function saveSplash(){
  try{const st=team&&team.settings||{};
    localStorage.setItem("cpp:splash",JSON.stringify({name:[st.school,st.mascot].filter(Boolean).join(" ")||team.name,label:st.teamLabel||"",logo:st.logo||"",color:st.color||"#5b2a86",color2:st.color2||""}));
  }catch{}
}
const msg=(el,text,kind)=>{el.textContent=text||"";el.className="msg"+(kind?" "+kind:"");};
const sportName=t=>(SPORTS[(t.settings||{}).sport]||SPORTS.basketball).name;
const roleName=r=>({owner:"Head coach",coach:"Coach",viewer:"View only"})[r]||r;
/* ---------- roles and permissions ----------
   Head coach: everything. Coach: everything except managing the staff. View only: nothing.
   A head coach (or anyone allowed to manage the staff) can switch any area on or off per person. */
let PERMS_DB=true;   // false until supabase/roles.sql has been run
const AREA_LABELS={plans:"Practice plans",plays:"Plays",drills:"Drill library",schedule:"Calendar, games & team settings",share:"Share plays with players",staff:"Manage staff & permissions"};
const PRESETS={assistant:{label:"Assistant coach",perms:{plans:true,plays:true,drills:true,schedule:true,share:true,staff:false}},
  manager:{label:"Team manager",perms:{plans:false,plays:false,drills:false,schedule:true,share:false,staff:false}},
  view:{label:"View only",perms:{plans:false,plays:false,drills:false,schedule:false,share:false,staff:false}}};
function permsFor(role,perms){
  const base=Object.fromEntries(AREAS.map(a=>[a,role==="owner"||(role==="coach"&&a!=="staff")]));
  if(role==="owner"||!perms)return base;
  AREAS.forEach(a=>{if(typeof perms[a]==="boolean")base[a]=perms[a];});return base;
}
const canEdit=t=>t&&t.role!=="viewer";

/* ---------- demo mode: teams kept in this browser ---------- */
const DEMO_KEY="cpp:demoTeams";
function readDemoTeams(){
  try{
    const list=JSON.parse(localStorage.getItem(DEMO_KEY)||"null");if(list)return list;
    const old=JSON.parse(localStorage.getItem("cpp:demoTeam")||"null");   // earlier single-team demo
    if(old){localStorage.setItem(DEMO_KEY,JSON.stringify([old]));return [old];}
  }catch{}
  return [];
}
function writeDemoTeams(list){try{localStorage.setItem(DEMO_KEY,JSON.stringify(list));}catch{}}
function demoName(){try{return localStorage.getItem("cpp:demoName")||"Me";}catch{return "Me";}}

/* ---------- start-up ---------- */
async function init(){
  document.querySelectorAll(".hosted-only").forEach(x=>x.hidden=!HOSTED);
  document.querySelectorAll(".demo-only").forEach(x=>x.hidden=HOSTED);
  if(!HOSTED){
    $("#demoBar").hidden=false;$("#joinForm").hidden=true;$("#joinDivider").hidden=true;
    /* The test copy of the app (test.theextracoach.com): say so plainly, so nobody mistakes it for the real one. */
    if(CFG.env==="test"){const bar=$("#demoBar");bar.classList.add("test-bar");bar.innerHTML="<strong>🧪 TEST VERSION.</strong> Try new features here. Nothing you do here touches the real app or your team's data, and it's saved only on this device. To bring your real plays in: Settings → Import a backup.";}
    user={id:"me",email:""};
    teams=readDemoTeams();
    return teams.length?openTeam(pickLast()):showSetup(false);
  }
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,detectSessionInUrl:true,flowType:"implicit"}});
  /* Implicit flow: links in emails (confirm, reset password) and Google/Facebook sign-in return
     with the session in the address, so they work even if the email opens in another browser. */
  const back=new URLSearchParams(location.hash.slice(1)+"&"+location.search.slice(1));
  const linkErr=back.get("error_description")||back.get("error");
  RECOVERY=back.get("type")==="recovery";
  renderOauth();
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY"){RECOVERY=true;showNewPassword();return;}
    if(event==="SIGNED_IN"&&session&&!user&&!RECOVERY)afterLogin(session.user);
    if(event==="SIGNED_OUT")location.reload();
  });
  const {data:{session}}=await sb.auth.getSession();
  if(session){history.replaceState(null,"",location.pathname);if(RECOVERY){showNewPassword();return;}afterLogin(session.user);return;}
  show("screen-auth");
  if(linkErr){
    history.replaceState(null,"",location.pathname);
    msg($("#authMsg"),/expired|invalid/i.test(linkErr)?"That email link has expired or was already used. Tap Forgot password to get a new one.":"Sign-in didn't finish: "+linkErr.replace(/\+/g," "),"err");
  }
}
function pickLast(){let last=null;try{last=localStorage.getItem("cpp:lastTeam");}catch{}return teams.find(x=>x.id===last)||teams[0];}
async function afterLogin(u){
  user=u;
  await loadTeams();
  if(teams.length)openTeam(pickLast());else showSetup(false);
}
async function loadTeams(){
  if(!HOSTED){teams=readDemoTeams();return;}
  let {data,error}=await sb.from("team_members").select("role,title,display_name,perms, teams(id,name,settings,join_code,viewer_code)").eq("user_id",user.id);
  if(error&&/perms/.test(error.message||"")){PERMS_DB=false;({data,error}=await sb.from("team_members").select("role,title,display_name, teams(id,name,settings,join_code,viewer_code)").eq("user_id",user.id));}
  if(error){show("screen-auth");msg($("#authMsg"),"Couldn't load your teams: "+error.message,"err");teams=[];return;}
  teams=(data||[]).filter(r=>r.teams).map(r=>({...r.teams,role:r.role,title:r.title,myName:r.display_name}))
    .sort((a,b)=>a.name.localeCompare(b.name));
  teams.forEach(t=>{const r=(data||[]).find(x=>x.teams&&x.teams.id===t.id);t.perms=r&&r.perms||null;});
}
async function loadMembers(){
  if(!HOSTED){members=[{user_id:"me",display_name:demoName(),title:"Head Coach",role:"owner"}];return;}
  const cols="user_id,role,email,display_name,title,joined_at"+(PERMS_DB?",perms":"");
  let {data,error}=await sb.from("team_members").select(cols).eq("team_id",team.id).order("joined_at");
  if(error&&PERMS_DB){PERMS_DB=false;({data}=await sb.from("team_members").select("user_id,role,email,display_name,title,joined_at").eq("team_id",team.id).order("joined_at"));}
  members=data||[];
}
async function openTeam(t){
  if(team&&t&&team.id!==t.id&&window.guardPlay&&!guardPlay(()=>openTeam(t)))return;
  team=t;
  if(store)store.close();
  store=HOSTED?supabaseStore(sb,t.id,user.id):localStore(t.id);
  try{localStorage.setItem("cpp:lastTeam",t.id);}catch{}
  await loadMembers();
  const me=members.find(m=>m.user_id===user.id);
  ME={id:user.id,name:(me&&me.display_name)||(HOSTED?(user.email||"").split("@")[0]:demoName())};
  STAFF=members.filter(m=>m.role!=="viewer").map(m=>m.display_name||(m.email||"").split("@")[0]).filter(Boolean);
  show("app");saveSplash();
  startPlanner(store,t.settings||{});
  setPerms(HOSTED?permsFor(t.role,t.perms):permsFor("owner"));
  $("#viewOnlyBar").hidden=!READONLY;
  renderSwitcher();
  if(!$("#view-settings").hidden)window.onSettingsTab();
  if(window.onTeamOpen)window.onTeamOpen();
  startPresence();
}

/* ---------- team switcher (header) ---------- */
function renderSwitcher(){
  $("#swName").textContent=team.name;
  $("#swMeta").textContent=`${(team.settings||{}).teamLabel?team.settings.teamLabel+" · ":""}${sportName(team)} · ${roleName(team.role)}`;
  const groups=new Map();teams.forEach(t=>{const k=String((t.settings||{}).school||t.name).trim().toLowerCase();if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t);});
  $("#swMenu").innerHTML=[...groups.values()].map(list=>{list.sort((a,b)=>String((a.settings||{}).teamLabel||"").localeCompare(String((b.settings||{}).teamLabel||""),undefined,{numeric:true}));const st=list[0].settings||{};
    return `<div class="sw-head">${esc([st.school,st.mascot].filter(Boolean).join(" ")||list[0].name)}</div>`+
    list.map(t=>`<button class="sw-item${t.id===team.id?" on":""}" data-team="${t.id}" role="menuitem">
      ${(t.settings||{}).logo?`<img class="sw-logo" src="${esc(t.settings.logo)}" alt="">`:`<span class="sw-dot" style="background:${esc((t.settings||{}).color||"#5b2a86")}${(t.settings||{}).color2?`;box-shadow:inset -6px 0 0 ${esc(t.settings.color2)}`:""}"></span>`}
      <span><b>${esc((t.settings||{}).teamLabel||t.name)}</b><small>${esc(sportName(t))} · ${esc(roleName(t.role))}</small></span></button>`).join("");}).join("")+
    `<div class="sw-actions"><button class="btn" id="swManage">Manage teams</button><button class="btn" id="swNew">+ Add a grade or team</button>${HOSTED?`<button class="btn" id="swJoin">Join a staff</button>`:""}</div>`;
}
$("#swMenu").addEventListener("click",e=>{
  const b=e.target.closest("[data-team]");
  if(b){const t=teams.find(x=>x.id===b.dataset.team);$("#teamSw").open=false;if(t&&t.id!==team.id){openTeam(t);setTab("home");}return;}
  if(e.target.id==="swManage"){$("#teamSw").open=false;window.goTeam&&window.goTeam("teams");return;}
  if(e.target.id==="swNew"){$("#teamSw").open=false;window.goTeam&&window.goTeam("teams");return;}
  if(e.target.id==="swJoin"){$("#teamSw").open=false;showSetup(true,e.target.id==="swJoin");}
});
document.addEventListener("click",e=>{const d=$("#teamSw");if(d.open&&!d.contains(e.target))d.open=false;});

/* ---------- sign in ---------- */
/* Email + password. "Create account" signs you up; "Forgot password?" emails a reset link. */
let authMode="in";
function authTab(mode){
  authMode=mode;
  $("#authTabIn").setAttribute("aria-selected",mode==="in");$("#authTabUp").setAttribute("aria-selected",mode==="up");
  $("#authNameWrap").hidden=mode!=="up";$("#authForgot").hidden=mode!=="in";
  $("#authPass").autocomplete=mode==="up"?"new-password":"current-password";
  $("#authPass").placeholder=mode==="up"?"At least 8 characters":"";
  $("#authBtn").textContent=mode==="up"?"Create account":"Sign in";
  $("#authMsg").textContent="";$("#authMsg").className="msg";
}
$("#authTabIn").addEventListener("click",()=>authTab("in"));
$("#authTabUp").addEventListener("click",()=>authTab("up"));
const authErr=m=>/invalid login/i.test(m)?"Email or password is wrong. New here? Tap Create account. Forgot it? Tap Forgot password.":
  /already registered|already been registered/i.test(m)?"There's already an account with that email. Tap Sign in, or Forgot password to set a new one.":
  /email not confirmed/i.test(m)?"Confirm your email first: tap the link in the email we sent, then sign in.":
  /rate limit/i.test(m)?"Too many emails sent in the last hour. Wait a bit and try again.":
  /provider is not enabled|unsupported provider/i.test(m)?"That sign-in option isn't turned on yet. Use email and password for now.":m;
$("#authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("#authEmail").value.trim(),password=$("#authPass").value;if(!email||!password)return;
  if(password.length<8){msg($("#authMsg"),"Passwords need at least 8 characters.","err");return;}
  $("#authBtn").disabled=true;msg($("#authMsg"),authMode==="up"?"Creating your account…":"Signing in…");
  if(authMode==="up"){
    const name=$("#authName").value.trim();
    const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname,data:name?{full_name:name}:{}}});
    $("#authBtn").disabled=false;
    if(error){msg($("#authMsg"),authErr(error.message),"err");return;}
    if(!data.session){
      if(data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length){msg($("#authMsg"),authErr("already registered"),"err");return;}
      authTab("in");$("#authEmail").value=email;
      msg($("#authMsg"),`Almost done: tap the confirmation link we sent to ${email}, then sign in here.`,"ok");return;
    }
    return;   // signed in: onAuthStateChange opens the app
  }
  const {error}=await sb.auth.signInWithPassword({email,password});
  $("#authBtn").disabled=false;
  if(error)msg($("#authMsg"),authErr(error.message),"err");
});
$("#authForgot").addEventListener("click",async()=>{
  const email=$("#authEmail").value.trim();
  if(!email){msg($("#authMsg"),"Type your email above, then tap Forgot password.","err");$("#authEmail").focus();return;}
  msg($("#authMsg"),"Sending…");
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error)msg($("#authMsg"),authErr(error.message),"err");
  else msg($("#authMsg"),`Check ${email} for a link to set your password. Open it on this device.`,"ok");
});
/* Back from the reset email: pick a new password, then carry on into the app. */
let RECOVERY=false;
function showNewPassword(){
  show("screen-auth");$("#authForm").hidden=true;$(".auth-tabs").hidden=true;$("#oauthBox").hidden=true;$("#newPwForm").hidden=false;$("#newPass").focus();
}
$("#newPwForm").addEventListener("submit",async e=>{
  e.preventDefault();const v=$("#newPass").value;if(v.length<8){msg($("#authMsg"),"Use at least 8 characters.","err");return;}
  $("#newPwBtn").disabled=true;msg($("#authMsg"),"Saving…");
  const {data,error}=await sb.auth.updateUser({password:v});
  $("#newPwBtn").disabled=false;
  if(error){msg($("#authMsg"),authErr(error.message),"err");return;}
  RECOVERY=false;$("#newPwForm").hidden=true;$("#authForm").hidden=false;$(".auth-tabs").hidden=false;msg($("#authMsg"),"");
  afterLogin(data.user);
});
/* Google / Facebook: only the providers listed in js/config.js (turned on in Supabase) are shown. */
function renderOauth(){
  const list=(CFG.oauth||[]).filter(p=>["google","facebook"].includes(p));
  $("#oauthBox").hidden=!list.length;
  document.querySelectorAll("[data-provider]").forEach(b=>b.hidden=!list.includes(b.dataset.provider));
}
$("#oauthBox").addEventListener("click",async e=>{
  const b=e.target.closest("[data-provider]");if(!b)return;
  msg($("#authMsg"),"Opening "+b.textContent.replace("Continue with ","")+"…");
  const {error}=await sb.auth.signInWithOAuth({provider:b.dataset.provider,options:{redirectTo:location.origin+location.pathname}});
  if(error)msg($("#authMsg"),authErr(error.message),"err");
});

/* ---------- create or join a team ---------- */
function showSetup(canGoBack,focusJoin){
  $("#suBack").hidden=!canGoBack;msg($("#setupMsg"),"");msg($("#joinMsg"),"");
  const nm=team&&team.myName||"";$("#suName").value=nm;$("#joinName").value=nm;
  updateStarterLabel();fillCopyFrom();
  if(typeof suLogo!=="undefined"){suLogo="";$("#suLogoPrev").textContent="Logo";$("#suLogoRm").hidden=true;$("#suLogoColors").hidden=true;$("#suUseC2").checked=false;}
  show("screen-setup");
  if(focusJoin)$("#joinCode").focus();
}
function updateStarterLabel(){
  const n=(STARTERS[$("#suSport").value]||[]).length;
  $("#suStarterWrap").hidden=!n;$("#suStarterText").textContent=`Add ${n} starter drills`;
}
$("#suSport").addEventListener("change",()=>{updateStarterLabel();copyNote();});
/* New team from an existing one: same school, colors and schedule, with its drills and plays. */
function fillCopyFrom(){
  const box=$("#suCopyBox"),sel=$("#suCopyFrom");
  box.hidden=!teams.length;
  sel.innerHTML=`<option value="">Nothing, start fresh</option>`+teams.map(t=>`<option value="${t.id}">${esc(t.name)}${(t.settings||{}).teamLabel?" · "+esc(t.settings.teamLabel):""}</option>`).join("");
  sel.value="";copyNote();
}
function copyNote(){
  const src=teams.find(t=>t.id===$("#suCopyFrom").value);
  $("#suCopyWhat").hidden=$("#suCopyHelp").hidden=!src;
  if(!src)return;
  const same=((src.settings||{}).sport||"basketball")===$("#suSport").value;
  $("#suCpPlays").disabled=!same;if(!same)$("#suCpPlays").checked=false;
  $("#suCpPlaysNote").textContent=same?"":"(different sport, so plays can't be copied)";
}
$("#suCopyFrom").addEventListener("change",()=>{
  const src=teams.find(t=>t.id===$("#suCopyFrom").value);
  if(src){const st=src.settings||{};
    $("#suSport").value=st.sport||"basketball";$("#suSchool").value=st.school||"";$("#suMascot").value=st.mascot||"";
    $("#suLabel").value="";$("#suColor").value=st.color||"#5b2a86";$("#suUseC2").checked=!!st.color2;if(st.color2)$("#suColor2").value=st.color2;
    $("#suStart").value=st.seasonStart||"";$("#suEnd").value=st.seasonEnd||"";
    $("#suWdS").value=st.weekdayStart||"";$("#suWdE").value=st.weekdayEnd||"";
    $("#suStarter").checked=false;$("#suLabel").focus();}
  updateStarterLabel();copyNote();
});
async function readItems(teamId,kind){
  if(!HOSTED){try{const m=JSON.parse(localStorage.getItem(`cpp:${teamId}:${kind}`)||"{}");return Object.entries(m);}catch{return [];}}
  const {data,error}=await sb.from("items").select("id,data").eq("team_id",teamId).eq("kind",kind).limit(5000);
  if(error)throw error;return (data||[]).map(r=>[r.id,r.data]);
}
$("#suBack").addEventListener("click",()=>{show("app");});
/* ---------- which features a team uses (new team form and Settings → Features) ---------- */
function progHTML(name,cur){return Object.entries(PROGRAMS).map(([k,p])=>`<label class="prog"><input type="radio" name="${name}" value="${k}"${k===cur?" checked":""}><span><b>${p.label}</b><small>${p.help}</small></span></label>`).join("");}
function featHTML(f){
  const groups=[...new Set(FEATURES.map(x=>x[3]))];
  return groups.map(g=>`<div class="feat-g"><h4>${g}</h4>${FEATURES.filter(x=>x[3]===g).map(([k,l,h])=>`<label class="feat"><input type="checkbox" data-feat="${k}"${f[k]!==false?" checked":""}><span><b>${l}</b><small>${h}</small></span></label>`).join("")}</div>`).join("")+
    `<p class="help feat-always">Always on: Home, Calendar, Roster, Staff and Settings.</p>`;
}
const readFeat=box=>Object.fromEntries([...box.querySelectorAll("[data-feat]")].map(x=>[x.dataset.feat,x.checked]));
/* Which preset matches these features exactly (or none = custom). */
const progOf=f=>Object.keys(PROGRAMS).find(k=>FEATURES.every(([x])=>(f[x]!==false)===featuresFor(k)[x]))||"";
function renderSuFeatures(prog){$("#suProg").innerHTML=progHTML("suProg",prog);$("#suFeatures").innerHTML=featHTML(featuresFor(prog));}
renderSuFeatures("school");
$("#suProg").addEventListener("change",e=>{if(e.target.name==="suProg")$("#suFeatures").innerHTML=featHTML(featuresFor(e.target.value));});
$("#suFeatures").addEventListener("change",()=>{const p=progOf(readFeat($("#suFeatures")));document.querySelectorAll('[name="suProg"]').forEach(r=>r.checked=r.value===p);});
let suLogo="";
$("#suLogo").addEventListener("change",async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  try{let out=await shrinkImage(f,256);if(out.length>150000)out=await shrinkImage(f,160);suLogo=out;
    $("#suLogoPrev").innerHTML=`<img src="${out}" alt="Team logo">`;$("#suLogoRm").hidden=false;
    const cs=await logoColors(out);const apply=(c1,c2)=>{$("#suColor").value=c1;if(c2){$("#suColor2").value=c2;$("#suUseC2").checked=true;}};
    if(cs.length)apply(cs[0],cs[1]||"");showLogoColors($("#suLogoColors"),cs,apply);}
  catch{msg($("#setupMsg"),"That file couldn't be read as an image. Try a PNG or JPG.","err");}
});
$("#sProg").addEventListener("change",e=>{if(e.target.name!=="sProg")return;$("#sFeatures").innerHTML=featHTML(featuresFor(e.target.value));$("#sStatus").textContent="Unsaved changes";});
$("#sFeatures").addEventListener("change",()=>{const p=progOf(readFeat($("#sFeatures")));document.querySelectorAll('[name="sProg"]').forEach(r=>r.checked=r.value===p);$("#sStatus").textContent="Unsaved changes";});
$("#suLogoRm").addEventListener("click",()=>{suLogo="";$("#suLogoPrev").textContent="Logo";$("#suLogoRm").hidden=true;$("#suLogoColors").hidden=true;});
$("#setupForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const sport=$("#suSport").value;
  const settings={...DEFAULT_SETTINGS,sport,
    school:$("#suSchool").value.trim(),mascot:$("#suMascot").value.trim(),teamLabel:$("#suLabel").value.trim(),
    color:$("#suColor").value,seasonStart:$("#suStart").value,seasonEnd:$("#suEnd").value,
    weekdayStart:$("#suWdS").value||"16:00",weekdayEnd:$("#suWdE").value||"18:00",
    color2:$("#suUseC2").checked?$("#suColor2").value:""};
  if(suLogo)settings.logo=suLogo;
  settings.features=readFeat($("#suFeatures"));settings.program=progOf(settings.features)||"custom";
  const src=teams.find(x=>x.id===$("#suCopyFrom").value)||null,sst=src&&src.settings||{};
  if(src&&$("#suCpSched").checked){
    ["practiceDays","weekendStart","weekendEnd","minPractices"].forEach(k=>{if(sst[k]!==undefined)settings[k]=JSON.parse(JSON.stringify(sst[k]));});
    if(!settings.seasonStart)settings.seasonStart=sst.seasonStart||"";if(!settings.seasonEnd)settings.seasonEnd=sst.seasonEnd||"";
  }
  if(src&&$("#suCpLook").checked)["logo","color2","quickAdds","appIcon","iconBg","iconBgColor"].forEach(k=>{
    if(k==="logo"&&suLogo)return;if(k==="color2"&&$("#suUseC2").checked)return;   // what you picked here wins
    if(sst[k]!==undefined)settings[k]=JSON.parse(JSON.stringify(sst[k]));});
  const copyKinds=src?[["drills","#suCpDrills"],["plays","#suCpPlays"],["players","#suCpRoster"]].filter(([k,q])=>$(q).checked&&!$(q).disabled).map(([k])=>k):[];
  let copied={};
  for(const k of copyKinds){try{copied[k]=await readItems(src.id,k);}catch{copied[k]=[];}}
  const name=[settings.school,settings.mascot,settings.teamLabel&&!settings.mascot?settings.teamLabel:""].filter(Boolean).join(" ")||"My team";
  let t;
  if(HOSTED){
    msg($("#setupMsg"),"Creating team…");
    const {data,error}=await sb.rpc("create_team",{p_name:name,p_settings:settings,p_display_name:$("#suName").value.trim()||null});
    if(error){msg($("#setupMsg"),error.message,"err");return;}
    await loadTeams();t=teams.find(x=>x.id===data);
    if(!t){msg($("#setupMsg"),"Team created, but it couldn't be loaded. Reload the page.","err");return;}
  }else{
    t={id:"demo-"+uid(),name,settings,role:"owner",join_code:"",viewer_code:""};
    teams=[...readDemoTeams(),t];writeDemoTeams(teams);
  }
  const addStarters=$("#suStarter").checked;
  $("#setupForm").reset();updateStarterLabel();
  await openTeam(t);setTab("home");
  if(addStarters&&!copied.drills&&STARTERS[sport]&&STARTERS[sport].length){try{await store.bulkSet("drills",startersFor(sport));}catch{}}
  for(const k of Object.keys(copied)){if(copied[k].length){try{await store.bulkSet(k,copied[k].map(([id,d])=>[id,{...d,copiedFrom:src.name}]));}catch(err){showNotice("Some "+k+" couldn't be copied: "+(err.message||err));}}}
  if(src)showNotice(`${t.name} is ready${Object.keys(copied).length?`, with ${Object.entries(copied).map(([k,v])=>`${v.length} ${({drills:"drills",plays:"plays",players:"players"})[k]}`).join(", ")} copied from ${src.name}`:""}.`);
});
$("#suSample").addEventListener("click",async e=>{
  const b=e.currentTarget;b.disabled=true;b.textContent="Loading sample…";
  try{
    const data=await (await fetch("data/sample-team.json")).json();
    const t={id:"demo-"+uid(),name:data.team||"Sample team",settings:{...DEFAULT_SETTINGS,...data.settings},role:"owner",join_code:"",viewer_code:""};
    teams=[...readDemoTeams(),t];writeDemoTeams(teams);
    await openTeam(t);setTab("home");
    await store.bulkSet("drills",data.drills.map(({id,...d})=>[id,d]));
    await store.bulkSet("plays",data.plays.map(({id,...p})=>[id,p]));
    await store.bulkSet("plans",data.plans.map(p=>[p.date,p]));
  }catch(err){msg($("#setupMsg"),"Couldn't load the sample team.","err");}
  b.disabled=false;b.textContent="Explore with sample team";
});
$("#joinForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const code=$("#joinCode").value.trim().toUpperCase();if(!code)return;
  msg($("#joinMsg"),"Joining…");
  const {data,error}=await sb.rpc("join_team",{p_code:code,p_display_name:$("#joinName").value.trim()||null});
  if(error){msg($("#joinMsg"),error.message,"err");return;}
  await loadTeams();const t=teams.find(x=>x.id===data);
  if(t){$("#joinForm").reset();await openTeam(t);setTab("home");}
  else msg($("#joinMsg"),"Joined, but the team couldn't be loaded. Reload the page.","err");
});

/* ---------- who else is here (live) ---------- */
let presenceTimer=null;
function viewState(){
  const tab=["plan","lib","plays","cal","team","settings"].find(t=>!$("#view-"+t).hidden)||"plan";
  return {name:ME.name,tab,date:cur?cur.date:null};
}
function startPresence(){
  $("#presenceBar").hidden=true;
  if(!store||!store.presence)return;
  store.onPresence(list=>{
    const others=list.filter(p=>p.user!==user.id);
    if(!others.length){$("#presenceBar").hidden=true;return;}
    const where=p=>p.tab==="plan"&&p.date?`planning ${dLabel(p.date)}`:p.tab==="plays"?"in Plays":p.tab==="lib"?"in Drills":p.tab==="cal"?"in Calendar":p.tab==="team"?"in Team":"in Settings";
    $("#presenceBar").innerHTML=`<span class="live" aria-hidden="true"></span> Also here: `+others.map(p=>`<b>${esc(p.name)}</b> <span>${where(p)}</span>`).join(", ");
    $("#presenceBar").hidden=false;
  });
  window.onViewChange();
}
window.onViewChange=function(){
  if(!store||!store.presence)return;
  clearTimeout(presenceTimer);presenceTimer=setTimeout(()=>store.presence({...viewState(),user:user.id}),300);
};

/* ---------- Settings tab ---------- */
let draft=null;
$("#sDays").innerHTML=DOW.map((d,i)=>`<label><input type="checkbox" id="sd${i}" value="${i}"><span>${d}</span></label>`).join("");
function gameRow(g,i){return `<div class="row game" data-i="${i}">
  <input type="date" data-f="date" value="${esc(g.date||"")}" aria-label="Game date">
  <input data-f="opponent" value="${esc(g.opponent||"")}" placeholder="Opponent" aria-label="Opponent">
  <span class="tbd-wrap"><input type="time" data-f="time" value="${esc(g.time||"")}" aria-label="Game time"${g.tbd?" disabled":""}><label class="tbd"><input type="checkbox" data-f="tbd"${g.tbd?" checked":""}> TBD</label></span>
  <select data-f="home" aria-label="Home or away"><option value="1"${g.home!==false?" selected":""}>Home</option><option value="0"${g.home===false?" selected":""}>Away</option></select>
  <button class="icon rm" data-rm="games" aria-label="Remove game">✕</button></div>`;}
function specialRow(x,i){return `<div class="row special" data-i="${i}">
  <input type="date" data-f="date" value="${esc(x.date||"")}" aria-label="Date">
  <select data-f="kind" aria-label="Kind of day"><option value="off"${x.kind==="off"?" selected":""}>No practice</option><option value="extra"${x.kind==="extra"?" selected":""}>Extra practice</option><option value="note"${x.kind==="note"?" selected":""}>Note only</option></select>
  <input data-f="note" value="${esc(x.note||"")}" placeholder="e.g. Thanksgiving, Tryouts" aria-label="Note">
  <input type="time" data-f="start" value="${esc(x.start||"")}" aria-label="Practice starts (optional)" title="Practice starts (leave blank for the usual time)">
  <input type="time" data-f="end" value="${esc(x.end||"")}" aria-label="Practice ends (optional)" title="Practice ends (leave blank for the usual time)">
  <button class="icon rm" data-rm="special" aria-label="Remove day">✕</button></div>`;}
function renderRows(){
  $("#sGames").innerHTML=draft.games.length?draft.games.map(gameRow).join(""):`<p class="help">No games yet.</p>`;
  $("#sSpecial").innerHTML=draft.special.length?draft.special.map(specialRow).join(""):`<p class="help">No special days yet.</p>`;
}
function readForm(){
  draft.sport=$("#sSport").value;
  draft.school=$("#sSchool").value.trim();draft.mascot=$("#sMascot").value.trim();draft.teamLabel=$("#sLabel").value.trim();draft.color=$("#sColor").value;
  draft.color2=$("#sUseC2").checked?$("#sColor2").value:"";
  {const r=document.querySelector('input[name="sIcon"]:checked');if(r)draft.appIcon=r.value;}
  {const r=document.querySelector('input[name="sIconBg"]:checked');if(r)draft.iconBg=r.value;const c=$("#sIconBgColor");if(c&&draft.iconBg==="custom")draft.iconBgColor=c.value;}
  draft.weekdayStart=$("#sWdS").value;draft.weekdayEnd=$("#sWdE").value;draft.weekendStart=$("#sWeS").value;draft.weekendEnd=$("#sWeE").value;
  draft.seasonStart=$("#sStart").value;draft.seasonEnd=$("#sEnd").value;
  draft.minPractices=+$("#sMinPr").value||0;
  draft.special.forEach(x=>{if(!x.start)delete x.start;if(!x.end)delete x.end;});
  draft.practiceDays=[...document.querySelectorAll("#sDays input:checked")].map(x=>+x.value);
  if($("#sFeatures").children.length){draft.features=readFeat($("#sFeatures"));draft.program=progOf(draft.features)||"custom";}
  return draft;
}
/* ---------- Settings sections (accordion) ---------- */
/* One-line summary on each closed section, so you can see what's inside without opening it. */
function accSummaries(){
  if(!draft)return;
  const t=x=>x?ampm12(x):"";
  const sub=(id,txt)=>{const el=document.getElementById("accSub-"+id);if(el)el.textContent=txt;};
  sub("team",[draft.school,draft.mascot].filter(Boolean).join(" ")+(draft.teamLabel?" · "+draft.teamLabel:""));
  const n=computePractices(draft).length,dd=(draft.practiceDays||[]).map(i=>DOW[i]).join(", ");
  sub("schedule",draft.seasonStart?`${n} practices · ${dd} · ${t(draft.weekdayStart)}–${t(draft.weekdayEnd)}`:"Set your season dates and practice days");
  const g=(draft.games||[]).filter(x=>x.date).sort((a,b)=>a.date<b.date?-1:1),nx=g.find(x=>x.date>=todayISO());
  sub("games",g.length?`${g.length} game${g.length>1?"s":""}${nx?` · next: ${dLabel(nx.date)} ${nx.home===false?"at":"vs"} ${nx.opponent||""}`:""}`:"No games yet");
  const sp=(draft.special||[]).filter(x=>x.date),off=sp.filter(x=>x.kind==="off").length,ex=sp.filter(x=>x.kind==="extra").length;
  sub("special",sp.length?`${off} day${off===1?"":"s"} off · ${ex} extra practice${ex===1?"":"s"} · ${sp.length-off-ex} with notes`:"Holidays, extra practices and notes");
  sub("staff",members.length?`${members.length} on staff`:"");
  {const f=draft.features||{},on=FEATURES.filter(([k])=>f[k]!==false).length,pr=PROGRAMS[progOf(f)];sub("features",`${pr?pr.label+" · ":""}${on} of ${FEATURES.length} on`);}
  sub("account",HOSTED&&user?user.email||"":"Demo mode");
}
const ampm12=x=>{const [h,m]=x.split(":").map(Number);return `${((h+11)%12)+1}:${String(m).padStart(2,"0")}${h<12?"am":"pm"}`;};
function openAcc(id,scroll){
  const d=document.getElementById("acc-"+id);if(!d)return;d.open=true;
  if(scroll)d.scrollIntoView({behavior:"smooth",block:"start"});
}
document.querySelector(".set-nav").addEventListener("click",e=>{const b=e.target.closest("[data-acc]");if(b)openAcc(b.dataset.acc,true);});
/* Remember which sections are open on this device. Team starts open the first time. */
(function(){
  let open=["team"];try{const v=JSON.parse(localStorage.getItem("cpp:accOpen")||"null");if(Array.isArray(v))open=v;}catch{}
  document.querySelectorAll("#view-settings details.acc").forEach(d=>{d.open=open.includes(d.id.slice(4));
    d.addEventListener("toggle",()=>{try{localStorage.setItem("cpp:accOpen",JSON.stringify([...document.querySelectorAll("#view-settings details.acc[open]")].map(x=>x.id.slice(4))));}catch{}});});
})();
function updatePreview(){
  const st=readForm(),list=computePractices(st);
  accSummaries();
  $("#sPreview").textContent=list.length?`${list.length} practice days scheduled, ${dLabel(list[0][0])} to ${dLabel(list[list.length-1][0])}.`:"Set season dates and practice days to build your practice calendar.";
}
window.onSettingsTab=function(){
  if(!team)return;
  draft=JSON.parse(JSON.stringify({...DEFAULT_SETTINGS,...(team.settings||{})}));
  draft.games=draft.games||[];draft.special=draft.special||[];
  $("#sSport").value=draft.sport||"basketball";$("#sSportHelp").hidden=true;
  $("#sSchool").value=draft.school||"";$("#sMascot").value=draft.mascot||"";$("#sLabel").value=draft.teamLabel||"";$("#sColor").value=draft.color||"#5b2a86";
  $("#sColor2").value=draft.color2||"#f2b705";$("#sUseC2").checked=!!draft.color2;renderLogoEdit();renderIconPick();
  $("#sWdS").value=draft.weekdayStart||"";$("#sWdE").value=draft.weekdayEnd||"";$("#sWeS").value=draft.weekendStart||"";$("#sWeE").value=draft.weekendEnd||"";
  $("#sStart").value=draft.seasonStart||"";$("#sEnd").value=draft.seasonEnd||"";$("#sMinPr").value=draft.minPractices||"";
  document.querySelectorAll("#sDays input").forEach(x=>x.checked=(draft.practiceDays||[]).includes(+x.value));
  {const f=draft.features||{};$("#sProg").innerHTML=progHTML("sProg",progOf(f));$("#sFeatures").innerHTML=featHTML(f);}
  renderRows();updatePreview();$("#sStatus").textContent="";
  renderStaff();renderAccount();$("#importBox").innerHTML="";
  document.querySelectorAll("#view-settings .st-edit .acc-body :is(input,select,button)").forEach(el=>el.disabled=!PERM.schedule);
  accSummaries();
};
/* App icon choices, previewed in the colors and logo currently on the form. */
function renderIconPick(){
  const st={...draft,color:$("#sColor").value,color2:$("#sUseC2").checked?$("#sColor2").value:""};
  $("#sIconColors").src=iconCanvas(st,96,{mode:"colors",round:true});
  const logoOpt=document.querySelector('input[name="sIcon"][value="logo"]');logoOpt.disabled=!draft.logo;
  logoOpt.closest("label").title=draft.logo?"":"Upload a team logo first";
  if(draft.logo){const im=new Image();im.onload=()=>{$("#sIconLogo").src=iconCanvas(st,96,{mode:"logo",img:im,round:true});};im.src=draft.logo;}
  else $("#sIconLogo").src=iconCanvas({...st},96,{mode:"colors",round:true});
  const cur=draft.appIcon||appIconMode(st),r=document.querySelector(`input[name="sIcon"][value="${cur==="logo"&&!draft.logo?"colors":cur}"]`);if(r)r.checked=true;
  renderIconBg(st);
}
/* Logo background swatches, each previewing the real icon. */
function renderIconBg(st){
  const wrap=$("#sIconBgWrap"),on=(document.querySelector('input[name="sIcon"]:checked')||{}).value==="logo"&&!!draft.logo;
  wrap.hidden=!on;if(!on)return;
  const cur=draft.iconBg||"white",custom=draft.iconBgColor||"#ffffff";
  const opts=[["white","White"],["team","Team color"],["team2","Second color"],["black","Black"],["none","Transparent"],["custom","Pick a color"]].filter(([k])=>k!=="team2"||st.color2);
  $("#sIconBgOpts").innerHTML=opts.map(([k,l])=>`<label class="ibg"><input type="radio" name="sIconBg" value="${k}"${k===cur?" checked":""}><img alt="" data-ibg="${k}"><span>${l}</span>${k==="custom"?`<input type="color" id="sIconBgColor" value="${esc(custom)}" aria-label="Background color">`:""}</label>`).join("");
  const im=new Image();im.onload=()=>{opts.forEach(([k])=>{const el=document.querySelector(`[data-ibg="${k}"]`);if(el)el.src=iconCanvas({...st,iconBg:k,iconBgColor:custom},96,{mode:"logo",img:im,round:true});});};im.src=draft.logo;
}
function renderLogoEdit(){
  $("#sLogoPrev").innerHTML=draft.logo?`<img src="${draft.logo}" alt="Team logo">`:"No logo";
  $("#sLogoRm").hidden=!draft.logo;
}
/* Shrink an uploaded logo so it fits comfortably in the team's settings. */
function shrinkImage(file,max){
  return new Promise((res,rej)=>{const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{URL.revokeObjectURL(url);const s=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(im.naturalWidth*s));c.height=Math.max(1,Math.round(im.naturalHeight*s));
      c.getContext("2d").drawImage(im,0,0,c.width,c.height);
      let out=c.toDataURL("image/webp",.9);if(!out.startsWith("data:image/webp"))out=c.toDataURL("image/png");res(out);};
    im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("bad image"));};im.src=url;});
}
/* Team colors from a logo: the two strongest, most-used colors in it (white and see-through parts
   are skipped). Done on the phone, no photo reader needed. */
function logoColors(src){
  return new Promise(res=>{const im=new Image();im.onload=()=>{
    const N=72,c=document.createElement("canvas"),s=Math.min(1,N/Math.max(im.naturalWidth,im.naturalHeight));
    c.width=Math.max(1,Math.round(im.naturalWidth*s));c.height=Math.max(1,Math.round(im.naturalHeight*s));
    const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(im,0,0,c.width,c.height);
    let d;try{d=x.getImageData(0,0,c.width,c.height).data;}catch{res([]);return;}
    const bins=new Map();
    for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a<160)continue;const r=d[i],g=d[i+1],b=d[i+2];
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/510,sat=mx?(mx-mn)/mx:0;
      if(l>0.9&&sat<0.15)continue;                       // white background
      const k=(r>>4)<<8|(g>>4)<<4|(b>>4),e=bins.get(k)||{n:0,r:0,g:0,b:0,sat:0};
      e.n++;e.r+=r;e.g+=g;e.b+=b;e.sat+=sat;bins.set(k,e);}
    const list=[...bins.values()].map(e=>{const r=e.r/e.n,g=e.g/e.n,b=e.b/e.n,sat=e.sat/e.n;return {r,g,b,n:e.n,score:e.n*(0.3+sat)};}).sort((a,b)=>b.score-a.score);
    const hex=o=>"#"+[o.r,o.g,o.b].map(v=>Math.round(v).toString(16).padStart(2,"0")).join("");
    const far=(a,b)=>Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b)>90;
    const top=list[0]?list[0].score:0;   // skip specks (edges of shapes blend into in-between colors)
    const out=[];for(const e of list){if(e.score<top*0.1)break;if(out.every(o=>far(o,e)))out.push(e);if(out.length>=4)break;}
    res(out.map(hex));};im.onerror=()=>res([]);im.src=src;});
}
/* Show the colors found in a logo as one-tap choices. */
function showLogoColors(box,colors,apply){
  if(!colors.length){box.hidden=true;return;}
  box.hidden=false;
  box.innerHTML=`<span>Colors in your logo:</span>`+colors.map(c=>`<span class="lc-sw" style="background:${c}" title="${c}"></span>`).join("")+
    `<button type="button" class="btn" data-lcuse>Use ${colors.length>1?"the first two":"it"}</button>`+
    (colors.length>1?`<button type="button" class="linkbtn" data-lcswap>Swap them</button>`:"")+`<small class="lc-tip">Tap a color to make it the main one.</small>`;
  let pick=colors.slice(0,2);
  box.onclick=e=>{
    if(e.target.closest("[data-lcuse]"))apply(pick[0],pick[1]||"");
    if(e.target.closest("[data-lcswap]")){pick=[pick[1],pick[0]];apply(pick[0],pick[1]);}
    const sw=e.target.closest(".lc-sw");if(sw){const c=sw.title;pick=[c,pick[0]===c?pick[1]:pick[0]];apply(pick[0],pick[1]||"");}
  };
}
$("#sLogo").addEventListener("change",async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  try{let out=await shrinkImage(f,256);if(out.length>150000)out=await shrinkImage(f,160);
    draft.logo=out;renderLogoEdit();renderIconPick();$("#sStatus").textContent="Unsaved changes";
    showLogoColors($("#sLogoColors"),await logoColors(out),(c1,c2)=>{$("#sColor").value=c1;if(c2){$("#sColor2").value=c2;$("#sUseC2").checked=true;}
      renderIconPick();$("#sStatus").textContent="Unsaved changes";$("#sColor").dispatchEvent(new Event("input",{bubbles:true}));});}
  catch{$("#sStatus").textContent="That file couldn't be read as an image. Try a PNG or JPG.";}
});
$("#sLogoRm").addEventListener("click",()=>{draft.logo="";if(draft.appIcon==="logo")draft.appIcon="colors";renderLogoEdit();renderIconPick();$("#sStatus").textContent="Unsaved changes";});
const settingsView=$("#view-settings");
$("#sSport").addEventListener("change",()=>{$("#sSportHelp").hidden=$("#sSport").value===((team.settings||{}).sport||"basketball");});
settingsView.addEventListener("input",e=>{
  if(e.target.name==="sIcon"){draft.appIcon=e.target.value;renderIconBg({...draft,color:$("#sColor").value,color2:$("#sUseC2").checked?$("#sColor2").value:""});}
  if(e.target.name==="sIconBg"){draft.iconBg=e.target.value;$("#sStatus").textContent="Unsaved changes";}
  if(e.target.id==="sIconBgColor"){draft.iconBg="custom";draft.iconBgColor=e.target.value;const r=document.querySelector('input[name="sIconBg"][value="custom"]');if(r)r.checked=true;
    const st={...draft,color:$("#sColor").value,color2:$("#sUseC2").checked?$("#sColor2").value:""};const im=new Image();im.onload=()=>{const el=document.querySelector('[data-ibg="custom"]');if(el)el.src=iconCanvas(st,96,{mode:"logo",img:im,round:true});};im.src=draft.logo;$("#sStatus").textContent="Unsaved changes";}
  if(["sColor","sColor2","sUseC2"].includes(e.target.id))renderIconPick();
  const row=e.target.closest(".row");
  if(row){const list=row.classList.contains("game")?draft.games:draft.special,item=list[+row.dataset.i],f=e.target.dataset.f;
    if(f==="tbd"){item.tbd=e.target.checked;if(item.tbd)item.time="";else delete item.tbd;const t=row.querySelector('[data-f="time"]');t.disabled=e.target.checked;if(e.target.checked)t.value="";}
    else item[f]=f==="home"?e.target.value==="1":e.target.value;
    if(f==="time"&&item.time)delete item.tbd;}
  if(e.target.closest(".st-edit"))$("#sStatus").textContent="Unsaved changes";
  updatePreview();
});
settingsView.addEventListener("change",e=>{if(e.target.matches("select[data-f],input[type=checkbox][data-f]"))settingsView.dispatchEvent(new Event("input",{bubbles:true}));});
settingsView.addEventListener("click",e=>{
  const rm=e.target.closest("[data-rm]");
  if(rm){const row=rm.closest(".row");draft[rm.dataset.rm].splice(+row.dataset.i,1);renderRows();updatePreview();$("#sStatus").textContent="Unsaved changes";}
});
$("#sAddGame").addEventListener("click",()=>{draft.games.push({date:"",opponent:"",time:"",home:true});renderRows();$("#sStatus").textContent="Unsaved changes";$("#sGames .row:last-child input").focus();});
$("#sAddSpecial").addEventListener("click",()=>{draft.special.push({date:"",kind:"off",note:""});renderRows();$("#sSpecial .row:last-child input").focus();});
async function saveSettings(st){
  st.games=(st.games||[]).filter(g=>g.date).sort((a,b)=>a.date<b.date?-1:1);
  st.special=(st.special||[]).filter(x=>x.date).sort((a,b)=>a.date<b.date?-1:1);
  const name=[st.school,st.mascot].filter(Boolean).join(" ")||team.name;
  if(HOSTED){
    const {error}=await sb.from("teams").update({name,settings:st}).eq("id",team.id);
    if(error)throw error;
  }else{writeDemoTeams(readDemoTeams().map(t=>t.id===team.id?{...t,name,settings:st}:t));}
  const sportChanged=(team.settings||{}).sport!==st.sport;
  team.name=name;team.settings=st;teams=teams.map(t=>t.id===team.id?team:t);saveSplash();
  applySettings(st);renderSwitcher();
  if(sportChanged){play=blankPlay();fi=0;hist=[];pdirty=false;renderEditor();renderPlayLib();renderAllDrills();}
}
$("#sSave").addEventListener("click",async()=>{
  const st=readForm();$("#sStatus").textContent="Saving…";
  try{await saveSettings(st);$("#sStatus").textContent="Saved";window.onSettingsTab();$("#sStatus").textContent="Saved";}
  catch(err){$("#sStatus").textContent="Not saved: "+(err.message||"check your connection");}
});


/* ---------- coaching staff ---------- */
async function renderStaff(){
  const box=$("#staffBody");
  if(!HOSTED){box.innerHTML=`<p class="help">Staffs need sign-in, which is off in demo mode. Once the app is connected to Supabase, this is where you invite assistant coaches, give them titles and decide what each one can change.</p>`;return;}
  await loadMembers();
  const owner=team.role==="owner",mgr=PERM.staff;
  const codeRow=(label,code,kind,help)=>`<div class="coderow"><div><div class="eyebrow">${label}</div><span class="code">${esc(code||"—")}</span></div>
      <div class="actions" style="margin:0"><button class="btn" data-copycode="${esc(code||"")}">Copy</button>${mgr?`<button class="btn" data-newcode="${kind}">New code</button>`:""}</div>
      <p class="help" style="flex-basis:100%">${help}</p></div>`;
  const permUI=m=>{
    if(m.role==="owner")return `<p class="perm-sum">Can change everything</p>`;
    const p=permsFor(m.role,m.perms),on=AREAS.filter(a=>p[a]);
    const sum=on.length?"Can change: "+on.map(a=>AREA_LABELS[a].split(/[,&]/)[0].trim().toLowerCase()).join(", "):"View only: can see and print everything, change nothing";
    if(!mgr||!PERMS_DB)return `<p class="perm-sum">${esc(sum)}</p>`;
    return `<details class="perm-edit"><summary>${esc(sum)}</summary>
      <div class="perm-presets"><span>Quick set:</span>${Object.entries(PRESETS).map(([k,v])=>`<button class="btn" type="button" data-preset="${k}" data-uid="${m.user_id}">${v.label}</button>`).join("")}</div>
      <div class="perm-grid">${AREAS.map(a=>`<label><input type="checkbox" data-perm="${a}" data-uid="${m.user_id}"${p[a]?" checked":""}${a==="staff"&&!owner?" disabled":""}> ${AREA_LABELS[a]}</label>`).join("")}</div></details>`;
  };
  box.innerHTML=(team.role==="viewer"&&!mgr?"":
      codeRow("Staff code",team.join_code,"staff","Coaches who join with this code can edit plans, drills, plays and the calendar. You can narrow that per person below.")+
      codeRow("View-only code",team.viewer_code,"viewer","For team managers, trainers or players: they can see and print plans and play through plays. You can let them edit some areas below (for example, the calendar)."))+
    (!PERMS_DB&&owner?`<p class="msg err">Per-person permissions need one database update. Run supabase/roles.sql in Supabase (SQL Editor) to turn them on.</p>`:"")+
    `<ul class="members">${members.map(m=>{
      const me=m.user_id===user.id,name=esc(m.display_name||(m.email||"").split("@")[0]);
      const canSet=mgr&&(owner||m.role!=="owner");
      const roleSel=canSet?`<select data-role="${m.user_id}" aria-label="Role for ${name}">${["owner","coach","viewer"].filter(r=>owner||r!=="owner").map(r=>`<option value="${r}"${r===m.role?" selected":""}>${roleName(r)}</option>`).join("")}</select>`:`<span class="role">${roleName(m.role)}</span>`;
      const title=canSet?`<input data-title="${m.user_id}" value="${esc(m.title||"")}" placeholder="Title (e.g. JV Coach)" aria-label="Title for ${name}">`:`<span class="mtitle">${esc(m.title||"")}</span>`;
      const rm=canSet&&!me?`<button class="icon" data-remove="${m.user_id}" aria-label="Remove ${name}">✕</button>`:"";
      return `<li class="member"><div class="who"><b>${name}${me?" (you)":""}</b><small>${esc(m.email||"")}</small></div>${title}${roleSel}${rm}<div class="perm-row">${permUI(m)}</div></li>`;}).join("")}</ul>
    <div class="msg" id="staffMsg"></div>
    <div class="actions" style="margin:0"><button class="btn danger" id="leaveTeam">Leave this team</button></div>`;
}
async function savePerms(uid,perms){
  const {error}=await sb.rpc("set_member_perms",{p_team:team.id,p_user:uid,p_perms:perms});
  if(error){msg($("#staffMsg"),error.message,"err");renderStaff();return;}
  msg($("#staffMsg"),"Permissions saved","ok");
  const keep=document.querySelector(`.perm-edit [data-uid="${uid}"]`);await renderStaff();
  const det=document.querySelector(`.perm-edit [data-uid="${uid}"]`);if(det)det.closest("details").open=!!keep;
  if(uid===user.id){await loadTeams();team=teams.find(t=>t.id===team.id)||team;openTeam(team);}
}
$("#staffBody").addEventListener("click",async e=>{
  const pr=e.target.closest("[data-preset]");
  if(pr){await savePerms(pr.dataset.uid,{...PRESETS[pr.dataset.preset].perms});return;}
  const c=e.target.closest("[data-copycode]");
  if(c){try{await navigator.clipboard.writeText(c.dataset.copycode);c.textContent="Copied";}catch{c.textContent=c.dataset.copycode;}setTimeout(()=>c.textContent="Copy",2000);return;}
  const n=e.target.closest("[data-newcode]");
  if(n){
    if(n.dataset.armed!=="1"){n.dataset.armed="1";n.textContent="Old code stops working. Tap again";return;}
    const {data,error}=await sb.rpc("new_join_code",{p_team:team.id,p_kind:n.dataset.newcode});
    if(error){msg($("#staffMsg"),error.message,"err");return;}
    if(n.dataset.newcode==="viewer")team.viewer_code=data;else team.join_code=data;renderStaff();return;
  }
  const r=e.target.closest("[data-remove]");
  if(r){
    if(r.dataset.armed!=="1"){r.dataset.armed="1";r.textContent="Remove?";r.classList.add("danger");return;}
    const {error}=await sb.rpc("remove_member",{p_team:team.id,p_user:r.dataset.remove});
    if(error)msg($("#staffMsg"),error.message,"err");else renderStaff();return;
  }
  if(e.target.id==="leaveTeam"){
    const b=e.target;if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again to leave "+team.name;return;}
    const {error}=await sb.rpc("remove_member",{p_team:team.id,p_user:user.id});
    if(error){msg($("#staffMsg"),error.message,"err");return;}
    await loadTeams();if(teams.length){openTeam(teams[0]);setTab("home");}else showSetup(false);
  }
});
$("#staffBody").addEventListener("change",async e=>{
  const pc=e.target.closest("[data-perm]");
  if(pc){const uid=pc.dataset.uid,m=members.find(x=>x.user_id===uid);const p=permsFor(m.role,m.perms);p[pc.dataset.perm]=pc.checked;await savePerms(uid,p);return;}
  const sel=e.target.closest("[data-role]"),ti=e.target.closest("[data-title]");
  if(!sel&&!ti)return;
  const args=sel?{p_team:team.id,p_user:sel.dataset.role,p_role:sel.value,p_title:null}:{p_team:team.id,p_user:ti.dataset.title,p_role:null,p_title:ti.value};
  const {error}=await sb.rpc("set_member",args);
  if(error){msg($("#staffMsg"),error.message,"err");renderStaff();return;}
  msg($("#staffMsg"),"Saved","ok");
  if(sel&&sel.dataset.role===user.id){await loadTeams();team=teams.find(t=>t.id===team.id)||team;openTeam(team);}
});

/* ---------- account ---------- */
function renderAccount(){
  const box=$("#accountBody");
  box.innerHTML=(HOSTED?`<p class="help">Signed in as <b>${esc(user.email||"")}</b>.</p>`:`<p class="help">Demo mode: no account needed.</p>`)+
    `<form id="nameForm" class="actions" style="margin:0;align-items:end"><label class="f" style="flex:1 1 200px">Your name (shown to your staff)<input id="myName" value="${esc(ME.name||"")}"></label><button class="btn" type="submit">Save name</button></form><div class="msg" id="nameMsg"></div>`+
    (HOSTED?`<form id="pwSetForm" class="actions" style="margin:0;align-items:end"><input type="email" autocomplete="username" value="${esc(user.email||"")}" hidden aria-hidden="true"><label class="f" style="flex:1 1 200px">Change password<input id="newPw" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters"></label><button class="btn" type="submit">Set password</button></form><div class="msg" id="pwMsg"></div>`:"")+
    `<div class="actions" style="margin-top:0">${HOSTED?`<button class="btn danger" id="signOut">Sign out</button>`:`<button class="btn danger" id="resetDemo">Erase demo data</button>`}</div>`;
  $("#nameForm").addEventListener("submit",async e=>{
    e.preventDefault();const v=$("#myName").value.trim();if(!v)return;
    if(HOSTED){
      const {error}=await sb.rpc("update_my_name",{p_name:v});
      if(error){msg($("#nameMsg"),error.message,"err");return;}
      sb.auth.updateUser({data:{full_name:v}}).catch(()=>{});
    }else{try{localStorage.setItem("cpp:demoName",v);}catch{}}
    ME.name=v;await loadMembers();STAFF=members.filter(m=>m.role!=="viewer").map(m=>m.display_name).filter(Boolean);
    msg($("#nameMsg"),"Saved","ok");renderStaff();if(cur)renderPlan();window.onViewChange();
  });
  if(HOSTED)$("#signOut").addEventListener("click",async()=>{await sb.auth.signOut();});
  if(HOSTED)$("#pwSetForm").addEventListener("submit",async e=>{
    e.preventDefault();const v=$("#newPw").value;
    if(v.length<8){msg($("#pwMsg"),"Use at least 8 characters.","err");return;}
    msg($("#pwMsg"),"Saving…");
    const {error}=await sb.auth.updateUser({password:v});
    if(error){msg($("#pwMsg"),/reauth|recent/i.test(error.message)?"For safety, sign out, sign back in, then change the password right away.":error.message,"err");return;}
    $("#newPw").value="";msg($("#pwMsg"),`Password saved. Sign in anywhere with ${user.email} and this password.`,"ok");
  });
  else $("#resetDemo").addEventListener("click",e=>{
    if(e.target.dataset.armed!=="1"){e.target.dataset.armed="1";e.target.textContent="Tap again to erase every demo team";return;}
    Object.keys(localStorage).filter(k=>k.startsWith("cpp:")).forEach(k=>localStorage.removeItem(k));location.reload();
  });
}

/* ---------- copy to another team ---------- */
let copyJob=null;
window.openCopy=function(kind,id){
  const targets=teams.filter(t=>t.id!==team.id&&canEdit(t));
  const dlg=$("#copyDlg");msg($("#copyMsg"),"");
  let item,label;
  if(kind==="plans"){item=cur;label=`the practice plan for ${dLabel(cur.date)}`;}
  else if(kind==="drills"){item=drills.find(d=>d.id===id);label=item&&`the drill "${item.name}"`;}
  else{item=plays.find(p=>p.id===id);label=item&&`the play "${item.name}"`;}
  if(!item)return;
  copyJob={kind,item:JSON.parse(JSON.stringify(item))};
  const sameSport=t=>((t.settings||{}).sport||"basketball")===SPORT;
  $("#copyWhat").textContent=targets.length?`Copy ${label} to another team you coach.`+(kind==="plays"?" Plays can only go to teams with the same sport.":""):
    "You don't coach any other teams yet. Create or join one from the team menu at the top.";
  $("#copyTeam").innerHTML=targets.map(t=>`<option value="${t.id}"${kind==="plays"&&!sameSport(t)?" disabled":""}>${esc(t.name)} (${esc(sportName(t))})</option>`).join("");
  const first=targets.find(t=>kind!=="plays"||sameSport(t));if(first)$("#copyTeam").value=first.id;
  $("#copyTeam").disabled=$("#copyGo").disabled=!first;
  $("#copyDateRow").hidden=kind!=="plans";$("#copyDate").value=cur?cur.date:"";
  $("#copyGo").textContent="Copy";
  dlg.showModal();
};
$("#copyGo").addEventListener("click",async e=>{
  e.preventDefault();if(!copyJob)return;
  const target=teams.find(t=>t.id===$("#copyTeam").value);if(!target)return;
  const {kind}=copyJob;const data={...copyJob.item};delete data.id;
  data.editedBy=ME.name;data.copiedFrom=team.name;
  let id;
  if(kind==="plans"){id=$("#copyDate").value;if(!id){msg($("#copyMsg"),"Pick a practice date.","err");return;}data.date=id;data.editedAt=Date.now();}
  else id=uid()+uid();
  msg($("#copyMsg"),"Copying…");
  try{
    if(HOSTED){
      const {error}=await sb.from("items").upsert({team_id:target.id,kind,id,data,updated_at:new Date().toISOString(),updated_by:user.id});
      if(error)throw error;
    }else{const s2=localStore(target.id);await s2.bulkSet(kind,[[id,data]]);s2.close();}
    msg($("#copyMsg"),`Copied to ${target.name}.`+(kind==="plans"?" It replaces any plan that team had on that date.":""),"ok");
    $("#copyGo").textContent="Copy again";
  }catch(err){msg($("#copyMsg"),"Couldn't copy: "+(err.message||"check your connection"),"err");}
});
$("#copyCancel").addEventListener("click",e=>{e.preventDefault();$("#copyDlg").close();});

/* ---------- share plays with players ---------- */
const playbookURL=q=>new URL("playbook.html"+q,location.href).href;
function shareLinkFor(id){return location.origin+"/p/"+encodeURIComponent(id);}
/* 10 letters/digits: short enough to text, about 60 bits so links can't be guessed. */
function randomId(){const A="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789",b=new Uint8Array(10);crypto.getRandomValues(b);return [...b].map(x=>A[x%A.length]).join("");}
/* Inside the Claude preview there is no web address players could open. */
const IN_PREVIEW=!!(window.claude&&window.claude.use);
async function renderShareLinks(){
  const box=$("#shareExisting");
  if(!HOSTED){box.innerHTML="";return;}
  const {data,error}=await sb.from("playbooks").select("id,title,play_ids,active,views,created_at").eq("team_id",team.id).order("created_at",{ascending:false});
  if(error||!data||!data.length){box.innerHTML="";return;}
  box.innerHTML=`<h3 style="font-size:16px;text-transform:uppercase;color:var(--muted);margin:6px 0">Your player links</h3><ul class="links">`+data.map(l=>`<li class="${l.active?"":"off"}"><span><b>${esc(l.title)}</b><small>${l.play_ids?l.play_ids.length+" plays":"All plays"} · opened ${l.views} time${l.views===1?"":"s"}${l.active?"":" · turned off"}</small></span>
    <span class="actions" style="margin:0">${l.active?`<button class="btn" type="button" data-linkcopy="${esc(l.id)}">Copy</button><button class="btn danger" type="button" data-linkoff="${esc(l.id)}">Turn off</button>`:`<button class="btn" type="button" data-linkon="${esc(l.id)}">Turn on</button>`}</span></li>`).join("")+`</ul>`;
}
$("#shareBook").addEventListener("click",()=>{
  if(!plays.length){pflash("Save a play first, then share it.");return;}
  $("#shareName").value=`${SETTINGS.mascot||team.name} Playbook`;
  $("#sharePlays").innerHTML=plays.filter(p=>!p.draft).sort((a,b)=>(a.type||"").localeCompare(b.type||"")||a.name.localeCompare(b.name))
    .map(p=>`<label><input type="checkbox" value="${esc(p.id)}" checked> <span>${esc(p.name)} <small>${esc(p.type||"")}</small></span></label>`).join("");
  $("#shareMake").textContent=IN_PREVIEW&&!HOSTED?"Preview player view":"Create player link";
  $("#shareHelp").textContent=IN_PREVIEW&&!HOSTED?
    "You're in the Claude preview, which has no web address your players could open, so it can't make player links. Tap Preview player view to see exactly what players will get. Real, short player links work once the app is hosted (Netlify) and connected to Supabase.":
    HOSTED?
    "Players open the link on any phone with no account. They see only these plays, never your practice plans, drills or staff. Changes you make to these plays show up for them automatically, and you can turn a link off anytime.":
    "Players open the link on any phone with no account, and see only these plays. Demo mode has no server, so the plays are packed into the link itself. That makes the link long, and edits you make later won't show. Connect Supabase (see the README) for short links that stay up to date.";
  $("#shareResult").hidden=true;msg($("#shareMsg"),"");$("#shareMake").disabled=false;
  $("#shareSend").hidden=!navigator.share;
  renderShareLinks();
  $("#shareDlg").showModal();
});
$("#shareAll").addEventListener("click",()=>document.querySelectorAll("#sharePlays input").forEach(x=>x.checked=true));
$("#shareNone").addEventListener("click",()=>document.querySelectorAll("#sharePlays input").forEach(x=>x.checked=false));
$("#shareMake").addEventListener("click",async()=>{
  const ids=[...document.querySelectorAll("#sharePlays input:checked")].map(x=>x.value);
  if(!ids.length){msg($("#shareMsg"),"Pick at least one play.","err");return;}
  const title=$("#shareName").value.trim()||"Playbook";
  msg($("#shareMsg"),"Creating link…");
  let link;
  try{
    if(HOSTED){
      const id=randomId(),all=ids.length===plays.filter(p=>!p.draft).length;
      const {error}=await sb.from("playbooks").insert({id,team_id:team.id,title,play_ids:all?null:ids});
      if(error)throw error;
      link=shareLinkFor(id);renderShareLinks();
    }else{
      const chosen=plays.filter(p=>ids.includes(p.id)),payload=playbookPayload(title,team,chosen);
      if(IN_PREVIEW){
        try{localStorage.setItem("cpp:previewBook",JSON.stringify({...payload,team:{...payload.team,logo:(team.settings||{}).logo||""}}));}catch{}
        $("#shareDlg").close();location.href="playbook.html?preview=1";return;
      }
      link=playbookURL("#"+await packPlaybook(payload));
    }
  }catch(err){msg($("#shareMsg"),"Couldn't create the link: "+(err.message||"check your connection"),"err");return;}
  $("#shareLink").value=link;$("#shareOpen").href=link;$("#shareResult").hidden=false;
  msg($("#shareMsg"),HOSTED?"Link ready. Send it to your players.":`Link ready, but long (${link.length.toLocaleString()} characters) because demo mode has no server. Email works best.`,"ok");
});
$("#shareCopy").addEventListener("click",async e=>{
  const v=$("#shareLink").value;
  try{await navigator.clipboard.writeText(v);e.target.textContent="Copied";}catch{$("#shareLink").select();e.target.textContent="Press and hold to copy";}
  setTimeout(()=>e.target.textContent="Copy link",2000);
});
$("#shareSend").addEventListener("click",()=>{navigator.share({title:$("#shareName").value||"Playbook",text:"Our team plays:",url:$("#shareLink").value}).catch(()=>{});});
$("#shareExisting").addEventListener("click",async e=>{
  const c=e.target.closest("[data-linkcopy]"),off=e.target.closest("[data-linkoff]"),on=e.target.closest("[data-linkon]");
  if(c){try{await navigator.clipboard.writeText(shareLinkFor(c.dataset.linkcopy));c.textContent="Copied";}catch{c.textContent="Copy failed";}return;}
  if(off&&off.dataset.armed!=="1"){off.dataset.armed="1";off.textContent="Tap again: players lose access";return;}
  const id=(off||on)&&(off||on).dataset[off?"linkoff":"linkon"];if(!id)return;
  const {error}=await sb.from("playbooks").update({active:!!on}).eq("id",id);
  if(error)msg($("#shareMsg"),error.message,"err");else renderShareLinks();
});
$("#shareClose").addEventListener("click",e=>{e.preventDefault();$("#shareDlg").close();});

/* ---------- backups ---------- */
/* ---------- export and import ----------
   Export: pick what goes in the file (plays, drill library, practice plans, calendar, roster, or
   everything). A plays-only file is how you send plays to another coach: they import it on their team.
   Import: shows what's in the file and lets you pick which parts to bring in. Nothing is deleted. */
const CAL_KEYS=["games","special","seasonStart","seasonEnd","practiceDays","weekdayStart","weekdayEnd","weekendStart","weekendEnd","minPractices"];
const sendable=()=>plays.filter(p=>!p.draft).sort((a,b)=>a.name.localeCompare(b.name));
function exportPanel(){
  const st=team.settings||{},ps=sendable(),ng=(st.games||[]).length,nd=(st.special||[]).length,nr=(window.TM&&TM.roster.length)||0;
  const row=(id,label,sub,on,dis)=>`<label class="ex-row"><input type="checkbox" id="${id}"${on?" checked":""}${dis?" disabled":""}><span><b>${label}</b><small>${sub}</small></span></label>`;
  $("#exportBox").innerHTML=`<div class="ex-panel">
    <div class="ex-quick"><span>Quick pick:</span><button class="gp-tag" type="button" data-expreset="plays">Plays for another coach</button><button class="gp-tag" type="button" data-expreset="all">Full backup</button></div>
    ${row("exPlays","Plays",`${ps.length} play${ps.length===1?"":"s"}${plays.length>ps.length?" (drafts left out)":""}`,true,!ps.length)}
    ${ps.length?`<details class="ex-pick" id="exPlayPick"><summary>Choose which plays (<span id="exPlayCount">all ${ps.length}</span>)</summary>
      <div class="actions" style="margin:6px 0"><button class="btn" type="button" data-exall="1">All</button><button class="btn" type="button" data-exall="0">None</button></div>
      <div class="ex-plays">${ps.map(p=>`<label><input type="checkbox" data-explay="${esc(p.id)}" checked> ${esc(p.name)} <small>${esc(p.type||"")}</small></label>`).join("")}</div></details>`:""}
    ${row("exDrills","Drill library",`${drills.length} drill${drills.length===1?"":"s"}`,true,!drills.length)}
    ${row("exPlans","Practice plans",`${Object.keys(plans).length} plan${Object.keys(plans).length===1?"":"s"}`,true,!Object.keys(plans).length)}
    ${row("exCal","Calendar",`${ng} game${ng===1?"":"s"}, ${nd} marked day${nd===1?"":"s"}, season dates and practice times`,true,!(ng||nd||st.seasonStart))}
    ${row("exLook","Team name, colors and logo","So a full backup can rebuild the team",true)}
    ${row("exRoster","Roster",`${nr} player${nr===1?"":"s"}. Has parent phone numbers and emails: leave this off when sending to other coaches`,false,!nr)}
    <div class="actions" style="margin:6px 0 0"><button class="btn primary" type="button" id="exGo">Download file</button>${navigator.canShare?`<button class="btn" type="button" id="exShare">Send…</button>`:""}<button class="btn" type="button" id="exCancel">Close</button></div>
    <div class="msg" id="exMsg"></div></div>`;
}
function exportPreset(k){
  const on=(id,v)=>{const el=$("#"+id);if(el&&!el.disabled)el.checked=v;};
  if(k==="plays"){on("exPlays",true);["exDrills","exPlans","exCal","exLook","exRoster"].forEach(id=>on(id,false));}
  else{["exPlays","exDrills","exPlans","exCal","exLook"].forEach(id=>on(id,true));on("exRoster",false);document.querySelectorAll("[data-explay]").forEach(x=>x.checked=true);}
  exCount();
}
function exCount(){const all=document.querySelectorAll("[data-explay]"),on=document.querySelectorAll("[data-explay]:checked");const c=$("#exPlayCount");if(c)c.textContent=on.length===all.length?`all ${all.length}`:`${on.length} of ${all.length}`;}
async function buildExport(){
  const want=id=>{const el=$("#"+id);return !!(el&&el.checked&&!el.disabled);},st=team.settings||{},contents=[];
  const data={format:"practice-planner-backup",version:2,exportedAt:new Date().toISOString(),team:team.name,teamLabel:st.teamLabel||"",sport:st.sport||"basketball",exportedBy:ME.name,contents};
  if(want("exPlays")){const ids=new Set([...document.querySelectorAll("[data-explay]:checked")].map(x=>x.dataset.explay));
    data.plays=sendable().filter(p=>!document.querySelector("[data-explay]")||ids.has(p.id)).map(p=>{const o={...p};delete o.draftCopy;return o;});if(data.plays.length)contents.push("plays");}
  if(want("exDrills")){data.drills=drills.map(d=>({...d}));contents.push("drills");}
  if(want("exPlans")){data.plans=Object.values(plans);contents.push("plans");}
  const settings={};
  if(want("exCal")){CAL_KEYS.forEach(k=>{if(st[k]!==undefined)settings[k]=JSON.parse(JSON.stringify(st[k]));});contents.push("calendar");}
  if(want("exLook")){["sport","school","mascot","teamLabel","color","color2","logo","appIcon","iconBg","iconBgColor","quickAdds"].forEach(k=>{if(st[k]!==undefined)settings[k]=st[k];});contents.push("team");}
  if(Object.keys(settings).length)data.settings=settings;
  if(want("exRoster")){data.players=(await readItems(team.id,"players")).map(([id,d])=>({id,...d}));contents.push("roster");}
  const slug=s=>(s||"team").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const what=contents.length===1?contents[0]:contents.length>=4?"backup":contents.join("-");
  return {data,name:`${slug([team.name,st.teamLabel].filter(Boolean).join(" "))}-${what}-${todayISO()}.json`,contents};
}
$("#sExport").addEventListener("click",()=>{if($("#exportBox").innerHTML){$("#exportBox").innerHTML="";return;}exportPanel();});
$("#exportBox").addEventListener("change",e=>{if(e.target.closest("[data-explay]"))exCount();});
$("#exportBox").addEventListener("click",async e=>{
  const pr=e.target.closest("[data-expreset]");if(pr){exportPreset(pr.dataset.expreset);return;}
  const al=e.target.closest("[data-exall]");if(al){document.querySelectorAll("[data-explay]").forEach(x=>x.checked=al.dataset.exall==="1");exCount();return;}
  if(e.target.id==="exCancel"){$("#exportBox").innerHTML="";return;}
  if(e.target.id!=="exGo"&&e.target.id!=="exShare")return;
  const {data,name,contents}=await buildExport();
  if(!contents.length){msg($("#exMsg"),"Pick at least one thing to export.","err");return;}
  const text=JSON.stringify(data,null,1),n=data.plays?data.plays.length:0;
  const done=contents.length===1&&contents[0]==="plays"?`${n} play${n===1?"":"s"} ready. The other coach opens Settings → Export & import → Import a file on their team.`:"File ready.";
  if(e.target.id==="exShare"){
    const file=new File([text],name,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name,text:contents.includes("plays")?`Plays from ${team.name}. Import them in the Practice Planner: Settings → Export & import → Import a file.`:""});msg($("#exMsg"),done,"ok");}catch{}return;}
  }
  await saveFile(name,text);msg($("#exMsg"),done,"ok");
});
$("#sImport").addEventListener("change",async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  const box=$("#importBox");let data;
  try{data=JSON.parse(await f.text());}catch{box.innerHTML=`<p class="msg err">That file isn't from the practice planner.</p>`;return;}
  if(data.format!=="practice-planner-backup"){box.innerHTML=`<p class="msg err">That file isn't from the practice planner.</p>`;return;}
  const n={drills:(data.drills||[]).length,plays:(data.plays||[]).length,plans:(data.plans||[]).length,players:(data.players||[]).length};
  const ss=data.settings||{},calN=(ss.games||[]).length+(ss.special||[]).length,full=!data.contents||data.contents.includes("team");
  const sportOff=n.plays&&data.sport&&data.sport!==((team.settings||{}).sport||"basketball");
  const row=(id,label,sub,on)=>`<label class="ex-row"><input type="checkbox" id="${id}"${on?" checked":""}><span><b>${label}</b><small>${sub}</small></span></label>`;
  box.innerHTML=`<div class="ex-panel"><p class="help" style="margin:0">From <b>${esc([data.team,data.teamLabel].filter(Boolean).join(" · ")||"another team")}</b>${data.exportedBy?` (exported by ${esc(data.exportedBy)})`:""}. Pick what to bring into <b>${esc(team.name)}</b>. Nothing you have is deleted; items with the same name or practice date are updated.</p>
    ${n.plays?row("impPlays","Plays",`${n.plays} play${n.plays===1?"":"s"}: ${esc(data.plays.slice(0,4).map(p=>p.name).join(", "))}${n.plays>4?"…":""}${sportOff?`. Drawn for ${esc(data.sport)}, so they'll sit on your court`:""}`,true):""}
    ${n.drills?row("impDrills","Drill library",`${n.drills} drills`,true):""}
    ${n.plans?row("impPlans","Practice plans",`${n.plans} plans`,true):""}
    ${calN&&!full?row("impCal","Calendar",`Add ${(ss.games||[]).length} games and ${(ss.special||[]).length} marked days to your calendar`,false):""}
    ${n.players?row("impRoster","Roster",`${n.players} players with parent contacts`,false):""}
    ${data.settings&&full?`<label class="f" style="flex-direction:row;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:14px;font-weight:500;color:var(--ink)"><input type="checkbox" id="impSettings" style="width:auto"> Also use this file's team settings (sport, name, colors, season, games). This replaces yours.</label>`:""}
    <div class="actions" style="margin:4px 0 0"><button class="btn primary" id="impGo">Import</button><button class="btn" id="impCancel">Cancel</button></div><div class="msg" id="impMsg"></div></div>`;
  $("#impCancel").addEventListener("click",()=>box.innerHTML="");
  $("#impGo").addEventListener("click",async ev=>{
    const on=id=>{const el=$("#"+id);return !!(el&&el.checked);};
    ev.target.disabled=true;msg($("#impMsg"),"Importing…");
    try{
      const strip=o=>{const {id,...rest}=o;return rest;},done=[];
      const from=data.team&&data.team!==team.name?data.team:"";
      if(n.drills&&on("impDrills")){await store.bulkSet("drills",data.drills.map(d=>[d.id,strip(d)]));done.push(`${n.drills} drills`);}
      if(n.plays&&on("impPlays")){
        /* Another team's play with the same name as one of yours gets a new ID, so yours isn't overwritten. */
        const mine=new Map(plays.map(p=>[p.id,p]));
        await store.bulkSet("plays",data.plays.map(p=>{const clash=from&&mine.has(p.id)&&mine.get(p.id).name!==p.name;const body=strip(p);delete body.draftCopy;if(from)body.sharedFrom=from;return [clash?p.id+"-"+uid():p.id,body];}));
        done.push(`${n.plays} plays`);}
      if(n.plans&&on("impPlans")){await store.bulkSet("plans",data.plans.filter(p=>p.date).map(p=>[p.date,p]));done.push(`${n.plans} plans`);}
      if(n.players&&on("impRoster")){await store.bulkSet("players",data.players.map(p=>[p.id||"p-"+uid(),strip(p)]));done.push(`${n.players} players`);}
      if(on("impCal")){
        const st=JSON.parse(JSON.stringify({...DEFAULT_SETTINGS,...(team.settings||{})}));st.games=st.games||[];st.special=st.special||[];
        (ss.games||[]).forEach(g=>{if(!g.date)return;st.games=st.games.filter(x=>x.date!==g.date);st.games.push(g);});
        (ss.special||[]).forEach(x=>{if(x.date&&!st.special.some(y=>y.date===x.date&&y.kind===x.kind&&(y.note||"")===(x.note||"")))st.special.push(x);});
        ["seasonStart","seasonEnd"].forEach(k=>{if(!st[k]&&ss[k])st[k]=ss[k];});
        await saveSettings(st);done.push("the calendar");}
      const useSettings=data.settings&&on("impSettings");
      if(useSettings){await saveSettings({...DEFAULT_SETTINGS,...(team.settings||{}),...data.settings});window.onSettingsTab();done.push("the team settings");}
      box.innerHTML=`<p class="msg ok" id="impMsg">${done.length?"Imported "+done.join(", ").replace(/, ([^,]*)$/," and $1")+".":"Nothing was picked to import."}</p>`;
    }catch(err){msg($("#impMsg"),"Import stopped: "+(err.message||"check your connection"),"err");ev.target.disabled=false;}
  });
});

/* ---------- offline support ---------- */
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>{window.SW_REG=r;}).catch(()=>{});

init().catch(err=>{show("screen-auth");msg($("#authMsg"),"Something went wrong starting the app: "+err.message,"err");});
