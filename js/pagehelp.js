/* How-to help for every page: the round ? button next to the main tabs opens a short guide for the
   page (and Team section) you're on. The play designer keeps its own full guide (js/playhelp.js).
   New coaches also get a one-time welcome tour of the key features, which can be reopened from any guide. */
(function(){
const H=(title,intro,steps,tips)=>({title,intro,steps,tips:tips||[]});
const GUIDES={
  home:H("Home","Your day at a glance every time you open the app.",[
    ["Today","What's on the calendar today. If there's a practice, tap the plan line to open or build today's plan."],
    ["Quick links","Big buttons for the things you use most at the gym: today's practice, the live tracker, stats and the calendar."],
    ["Next game","The opponent, time, home or away, and buttons for the gameplan and the bus list."],
    ["Season record","Wins and losses, home and away, and your streak. Scores come from the live tracker or the score you type into a game's Gameplan."],
    ["This week","The next 7 days. Tap Full calendar to see the whole season."]
  ]),
  plan:H("Practice plans","Build a timed plan for any practice day, then print it or run it from your phone.",[
    ["Pick the day","Choose a practice from the date list at the top. Times come from the calendar; change them here for just this plan."],
    ["Add drills","Tap a drill from your library (right side, or below on a phone) to add it. Set the minutes for each one."],
    ["Watch the clock","The meter shows how many minutes are booked out of the practice. Red means you're over."],
    ["Reorder and assign","Drag blocks to change the order. With more than one coach, pick who leads each block."],
    ["Copy a plan","Use Copy from another day to start from a practice you've already planned."],
    ["Print or share","Print the plan for the gym wall, or open it on your phone during practice."]
  ],["Plans save as you go: there's no save button to remember."]),
  lib:H("Drill library","Every drill your staff uses, sorted by category.",[
    ["Add a drill","Type a name, pick one or more categories, set the minutes, and add how it runs and what to coach. Tap Save drill."],
    ["Find one","Search by name or filter by category."],
    ["Edit or copy","Edit changes it everywhere it's used. Copy to team sends it to one of your other teams."],
    ["Use it in a plan","Open the Practice tab and tap the drill to add it to a practice."]
  ]),
  cal:H("Calendar","The whole season: practices, games, days off, bus times and meetings.",[
    ["Month or full season","Use ‹ › (or swipe) to move between months, or Full season to see every month at once. Today is filled in bright color."],
    ["Tap a day","Mark it (no school, holiday, no practice, tryouts, meeting, bus), change the practice time, add a note, open its practice plan, or add a game."],
    ["Change several practices","When you change a practice time, use Apply to more practices to give the same time to every Monday, the rest of the week, or days you pick."],
    ["Games","Tap + Game, or tap a day. Not sure of the time yet? Check TBD."],
    ["Season & practice setup","Below the calendar (or the ⚙ button): season dates, regular practice days and times, the full game list and special days."],
    ["Share with families","🔗 Parent link gives parents an always-current calendar, and they can add it to their phone's calendar. Export makes a calendar file, a printable PDF or a spreadsheet."]
  ]),
  settings:H("Settings","How this team looks and which parts of the app it uses.",[
    ["Colors & logo","Team colors, second color, logo and the app icon. Add a logo and tap a color it found to use your school's colors."],
    ["Features","Pick School, AAU/club or Rec, or switch individual features off. Turning something off only hides it; nothing is deleted."],
    ["Export & import","Back up everything, or send just your plays or drills to another coach. Import loads a file from this app."],
    ["Your account","Your sign-in email, name and password."]
  ],["Team name and grade/level are on the Team tab. Season, practice days and games are on the Calendar tab."]),
  "team:teams":H("My teams","All your teams, grouped by school, and this team's name and grade/level.",[
    ["This team","Change the sport, school, team name and grade/level at the top, then Save."],
    ["Switch teams","Tap Open on another team, or use the team menu at the top of the app."],
    ["Add a grade or team","Add another level for the same school (7th, 8th, JV…) and copy over its calendar marks, drills, plays and look."],
    ["Join a staff","Got a code from another head coach? Use Join a staff."]
  ]),
  "team:roster":H("Roster","Players and parent contacts, used by the bus list, gameplans and stats.",[
    ["Add players","Tap + Add player, paste a list (one player per line), or add from a photo of a roster sheet."],
    ["Parent contacts","Add a parent name, phone and email for each player. Only coaches see them."],
    ["Remove players","Tap 🗑 on a player, or select several and remove them together."],
    ["Print","Print the roster with parent contacts for your clipboard."]
  ]),
  "team:game":H("Gameplan","Your plan for each game: keys, starters, matchups, plays to run and the result.",[
    ["Pick the game","Tap a game at the top."],
    ["Keys to the game","Three things your team has to do to win."],
    ["Starters and matchups","Pick your starting five and who guards whom."],
    ["Plays to run","Pick plays from your playbook to have ready."],
    ["After the game","Type the score and notes. The record on Home updates from here (or from the live tracker)."],
    ["Track it live","📊 Track this game opens the live stat tracker for this game."]
  ]),
  "team:scout":H("Scouting report","Notes on each opponent, kept for the next time you play them.",[
    ["Pick an opponent","Every team on your schedule has its own report."],
    ["Fill it in","Their best players, what they run on offense and defense, and how to beat them."],
    ["Print","Print it or bring it up on your phone before the game."]
  ]),
  "team:stats":H("Stats & live tracker","Track a game as it happens, then see box scores and season stats.",[
    ["Live tracker","Tap ● Live tracker to open the game in progress, today's game or the next one. Pick your starters."],
    ["Add a stat","Tap a stat, then the player (or the player, then the stat). Undo fixes a mistake."],
    ["Subs","Drag a player from the bench onto the floor, or tap to swap. Playing time counts quarters played."],
    ["Other team","Add their points with +1, +2, +3."],
    ["Final","End each quarter, then Final saves the result to the gameplan and your record."],
    ["Season","Season shows averages for every player; tap a name for their game-by-game log."]
  ]),
  "team:sched":H("Game & bus schedule","Every game in one place, with the bus and pre-game food times.",[
    ["Bus times","Set when the bus leaves and gets back for each away game. They update the bus list and the calendar."],
    ["Food times","Set when pre-game food needs to arrive and see who's bringing it. Use bus time copies the departure."],
    ["Missing times","A red note at the top counts away games without a bus time."],
    ["Share","Print schedule makes a one-page PDF. Copy as text is ready to paste into a text to parents or the driver."]
  ]),
  "team:bus":H("Bus list","Who's riding to each away game, and checking them on and off the bus.",[
    ["Pick the game","Tap an away game at the top."],
    ["Trip details","Departure and return times, where it leaves from, the bus or driver, and which coaches ride."],
    ["Who's riding","Mark each player Bus, Own ride or Not going."],
    ["Head count","Tick players as they get on. Switch to Coming home for the ride back."],
    ["Print or copy","Print the list for the driver or copy it as text."]
  ]),
  "team:food":H("Game-day food","A sign-up link parents use to bring pre-game meals, with no account.",[
    ["Make the link","Pick which games and what parents can sign up for, then send the link."],
    ["Delivery times","Home games use your home time; set each away game's time (or use the bus time)."],
    ["See sign-ups","Every game shows who signed up, what they're bringing and how to reach them."],
    ["No food that day","Mark a game No food needed and parents can't sign up for it."]
  ]),
  "team:plink":H("Parent calendar link","An always-current calendar parents open from one short link.",[
    ["Make the link","Pick what parents see: games, practices, days off and notes. Then copy or send it."],
    ["Always up to date","When you change the calendar, parents see it the next time they open the link."],
    ["Phone calendars","Parents can subscribe so the schedule shows in their iPhone or Google calendar and updates on its own."],
    ["Turn it off","Turn off the link any time; turn it back on and the same link works again."]
  ]),
  "team:staff":H("Coaching staff","Invite coaches, give them titles and decide what each can change.",[
    ["Staff code","Coaches sign up and enter this code to join this team."],
    ["View-only code","For managers, trainers or players: they can see and print, not change."],
    ["School staff code","One code that adds a coach to several of your teams at the same school at once."],
    ["Permissions","Open a coach's row to pick exactly what they can change, or use a quick set."]
  ])
};
function currentKey(){
  const v=document.querySelector("section.view:not([hidden])");const id=v?v.id.replace("view-",""):"home";
  if(id==="team"){const p=(window.TM&&TM.pane)||"teams";return "team:"+p;}
  return id;
}
/* the button, top right next to the logo */
const btn=document.createElement("button");btn.type="button";btn.className="btn help-q page-help";btn.id="pageHelpBtn";btn.textContent="?";
btn.title="How to use this page";btn.setAttribute("aria-label","How to use this page");
const bar=document.querySelector(".app-bar");if(bar)bar.appendChild(btn);else{const tabs=document.querySelector(".top-right .tabs");if(tabs)tabs.insertAdjacentElement("afterend",btn);}
const dlg=document.createElement("dialog");dlg.className="help-dlg";dlg.id="pageHelpDlg";dlg.setAttribute("aria-labelledby","phTitle");document.body.appendChild(dlg);
function open(key){
  key=key||currentKey();
  if(key==="plays"){const b=document.getElementById("pHelp");if(b){b.click();return;}}
  const g=GUIDES[key]||GUIDES.home;
  dlg.innerHTML=`<div class="dlg"><h2 id="phTitle">${esc(g.title)}</h2><p class="help" style="margin-top:0">${esc(g.intro)}</p>
    <ol class="hg-steps">${g.steps.map(([t,b])=>`<li><b>${esc(t)}</b><span>${esc(b)}</span></li>`).join("")}</ol>
    ${g.tips.map(t=>`<p class="help ph-tip">💡 ${esc(t)}</p>`).join("")}
    <div class="actions" style="margin:12px 0 0"><button class="btn" type="button" data-ph="tour">Take the tour</button><button class="btn primary" type="button" data-ph="close">Got it</button></div></div>`;
  dlg.showModal();
}
btn.addEventListener("click",()=>open());
dlg.addEventListener("click",e=>{if(e.target===dlg||e.target.closest("[data-ph=close]"))dlg.close();if(e.target.closest("[data-ph=tour]")){dlg.close();tour(true);}});

/* ---------- welcome tour for new coaches ---------- */
const H2=k=>typeof hasFeature!=="function"||hasFeature(k);
const STOPS=()=>[
  {icon:"🏠",t:"Home",b:"Each time you open the app: today's practice, the next game, your record and this week.",go:()=>setTab("home")},
  H2("plans")&&{icon:"📋",t:"Practice plans",b:"Build a timed practice from your drill library in minutes, then print it or run it from your phone.",go:()=>setTab("plan")},
  H2("plays")&&{icon:"🏀",t:"Plays",b:"Draw plays step by step and watch them run. Pick a defense (man, 2-3, 3-2, box-and-1) and it moves with the ball. Share plays with players by link.",go:()=>setTab("plays")},
  {icon:"📅",t:"Calendar",b:"Your whole season. Tap a day to change it, and send parents one link that's always current.",go:()=>setTab("cal")},
  H2("stats")&&{icon:"📊",t:"Live stats",b:"Tap a stat and a player during the game. Box scores, quarters played and season stats add up for you.",go:()=>window.goTeam&&goTeam("stats")},
  (H2("bus")||H2("food"))&&{icon:"🚌",t:"Parent Admin",b:"Bus lists with check-in, a game-day food sign-up parents use without an account, and the parent calendar link.",go:()=>window.goTeam&&goTeam(H2("bus")?"bus":"food")},
  {icon:"👥",t:"Your staff",b:"Invite assistant coaches with a code and decide what each one can change. Find it under Team → Staff.",go:()=>window.goTeam&&goTeam("staff")},
  {icon:"📷",t:"Add from a photo",b:"Snap a roster, a schedule or a whiteboard play and the app fills it in for you to check.",go:null}
].filter(Boolean);
function tour(force){
  const stops=STOPS();let i=0;
  const draw=()=>{const s=stops[i];
    dlg.innerHTML=`<div class="dlg tour"><div class="tour-top"><small>${i===0?"Welcome to The Extra Coach":"Key features"} · ${i+1} of ${stops.length}</small><button class="icon" type="button" data-tr="close" aria-label="Close">✕</button></div>
      <div class="tour-ic" aria-hidden="true">${s.icon}</div><h2>${esc(s.t)}</h2><p>${esc(s.b)}</p>
      <div class="tour-dots">${stops.map((_,k)=>`<i${k===i?' class="on"':""}></i>`).join("")}</div>
      <div class="actions" style="margin:0;justify-content:space-between">${i?`<button class="btn" type="button" data-tr="back">Back</button>`:`<button class="btn" type="button" data-tr="close">Skip</button>`}
        <span style="display:flex;gap:8px">${s.go?`<button class="btn" type="button" data-tr="go">Show me</button>`:""}<button class="btn primary" type="button" data-tr="next">${i===stops.length-1?"Let's go":"Next"}</button></span></div>
      <p class="help" style="text-align:center;margin:10px 0 0">Tap the <b>?</b> next to the tabs on any page for a how-to.</p></div>`;};
  draw();if(!dlg.open)dlg.showModal();
  dlg.onclick=e=>{const b=e.target.closest("[data-tr]");if(!b)return;const k=b.dataset.tr;
    if(k==="close"){dlg.close();dlg.onclick=null;}
    if(k==="back"){i=Math.max(0,i-1);draw();}
    if(k==="next"){if(i===stops.length-1){dlg.close();dlg.onclick=null;}else{i++;draw();}}
    if(k==="go"){const s=stops[i];dlg.close();dlg.onclick=null;s.go();scrollTo(0,0);}
  };
  try{localStorage.setItem("cpp:toured","1");}catch{}
}
window.showTour=()=>tour(true);
/* First time on this device with a team open: show the tour once. */
let shown=false;try{shown=localStorage.getItem("cpp:toured")==="1";}catch{}
if(!shown){const iv=setInterval(()=>{
  if(typeof team!=="undefined"&&team&&!document.getElementById("app").hidden&&!document.querySelector("dialog[open]")){clearInterval(iv);setTimeout(()=>{if(!document.querySelector("dialog[open]"))tour();},900);}
},700);setTimeout(()=>clearInterval(iv),120000);}
})();
