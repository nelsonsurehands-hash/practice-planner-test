/* Play designer how-to guide: the ? button in the play designer's header (and in its full-screen
   toolbar) opens a step-by-step guide. Tool names follow the team's sport, and "Try it" buttons
   close the guide and pick that tool. */
(function(){
const btn=document.createElement("button");
btn.type="button";btn.id="pHelp";btn.className="btn help-q";btn.textContent="?";
btn.title="How to use the play designer";btn.setAttribute("aria-label","How to use the play designer");
document.querySelector("#view-plays .bh-btns").prepend(btn);

const dlg=document.createElement("dialog");dlg.id="helpDlg";dlg.className="help-dlg";dlg.setAttribute("aria-labelledby","helpTitle");
document.body.appendChild(dlg);

const T=()=>{const t=(sp().tools)||{};return {cut:t.cut||"Cut",pass:t.pass||"Pass",dribble:t.dribble,screen:t.screen,shot:t.shot};};
const tryIt=(tool,label)=>`<button type="button" class="btn try" data-try="${tool}">Try ${esc(label)}</button>`;
const step=(n,title,body)=>`<li><b>${title}</b><span>${body}</span></li>`;
function section(id,title,intro,steps,open){
  return `<details class="hg-sec" id="hg-${id}"${open?" open":""}><summary>${title}</summary><div class="hg-body">${intro?`<p>${intro}</p>`:""}<ol class="hg-steps">${steps.join("")}</ol></div></details>`;
}
function build(){
  const L=T(),ball="ball",n=sp().players,defend=!!sp().defend;
  const quick=section("quick","Quick start: your first play in 2 minutes","",[
    step(1,"Name it","Type a play name and pick its type (for example Half-court offense or Baseline inbound)."),
    step(2,"Put players on the court",`Pick a formation from <b>Set</b> to drop all ${n} players at once, or use <b>+ Player</b> and tap the court for each one.`),
    step(3,`Give someone the ${ball}`,`Tap <b>Ball</b>, then tap the player who starts with it.`),
    step(4,"Draw step 1",`Use <b>${esc(L.cut)}</b>${L.dribble?`, <b>${esc(L.dribble)}</b>`:""}${L.screen?` and <b>${esc(L.screen)}</b>`:""} (drag from a player) and <b>${esc(L.pass)}</b> (tap who gets it). Everything in one step happens at the same time.`),
    step(5,"Add the next step","Tap <b>+ Next step</b>. Players slide to where their lines ended, ready for the next action."),
    step(6,"Watch it and save","Tap <b>▶ Play through</b> to see it run, then <b>Save play</b>.")
  ],true);
  const setup=section("setup","Set up the court","Every play starts with players in their spots. These tools add or move them.",[
    step(1,"Set",`Fills the court with a ready-made formation (for example 5-Out or 1-4 High). It replaces your offense but keeps any defenders. <b>Empty</b> clears the court.`),
    step(2,"+ Player",`Tap the court to place players 1 through ${n}, in order. ${tryIt("o","+ Player")}`),
    defend?step(3,"+ Defender / Add defense",`<b>+ Defender</b> places X1, X2… one tap at a time. <b>Add defense</b> (under the court) puts a defender on every offensive player for you.`):step(3,"+ Defender",`Tap the court to place defenders. ${tryIt("d","+ Defender")}`),
    step(4,"Ball",`Tap a player to give them the ${ball}. ${tryIt("ball","Ball")}`),
    step(5,"Label",`Tap a player to give them a short label like PG, 5 or QB (up to 3 letters). ${tryIt("label","Label")}`),
    step(6,"Move",`Drag any player, defender or the ${ball} to a new spot. Lines attached to a player move with them. ${tryIt("move","Move")}`)
  ]);
  const draw=section("draw","Draw what happens",`Pick a tool, then use the hint line under the toolbar: it tells you what to tap or drag next.`,[
    step(1,esc(L.cut),`Drag from a player to where they run. ${tryIt("cut",L.cut)}`),
    L.dribble?step(2,esc(L.dribble),`Drag from the player with the ${ball} to where they dribble. The ${ball} goes with them. ${tryIt("dribble",L.dribble)}`):"",
    L.screen?step(3,esc(L.screen),`Drag from a player to the spot where they set the ${L.screen.toLowerCase()}. The line ends in a flat bar. ${tryIt("screen",L.screen)}`):"",
    step(4,esc(L.pass),`Tap the player who should get the ${ball}. The ${ball} travels to where that player will be after their move, so it lands right as they arrive. Keep tapping players to chain more ${L.pass.toLowerCase()}es in the same step, in order. Tap an empty spot to ${L.pass.toLowerCase()} to a spot. ${tryIt("pass",L.pass)}`),
    L.shot?step(5,"Shot",`Tap <b>Shot</b> (under the court) and whoever has the ${ball} at the end of the step shoots: off the catch, or after their move. Tap Shot again to remove it.`):"",
    step(6,"Erase",`Tap a player, the ${ball} or a single line to remove it. ${tryIt("erase","Erase")}`),
    step(7,"Undo and Clear lines","<b>Undo</b> takes back your last change, as many times as you need. <b>Clear lines</b> (tap twice) wipes every line on the current step but keeps the players where they are.")
  ].filter(Boolean));
  const steps=section("steps","Build the play step by step","A play is a series of steps, like frames on a whiteboard. All the movement in one step happens at the same time; the next step starts when it ends.",[
    step(1,"+ Next step","Adds a step after the one you're on. Players start where their lines ended, and the ball is with whoever caught it."),
    step(2,"Duplicate step","Copies the current step, players and lines, right after it. Handy for a play that repeats on the other side."),
    step(3,"Delete step","Removes the step you're on."),
    step(4,"Jump between steps","Tap the step numbers to go back and edit any step. Changes to player spots carry forward to the steps after it."),
    step(5,"Describe each step",`Type in <b>What happens in this step</b> (for example "1 passes to 2, 5 down screens for 3"). It shows as a caption when the play runs and in the PDF.`),
    step(6,"Play notes","Use <b>Play notes</b> for when to call it, the reads and counters.")
  ]);
  const options=section("options","Add options (reads and counters)","An option is a different ending that branches off the play at a certain step, like a backdoor if the wing is denied. The main play stays exactly as it is.",[
    step(1,"Go to the branch step","Tap the step where the read happens."),
    step(2,"+ Add option after this step","Starts option A with every player where that step ended, and the step's lines shown faintly for reference. A colored banner shows you're in an option."),
    step(3,"Name it",`Type a name like Backdoor or Skip ${L.pass.toLowerCase()} in <b>Option name</b>.`),
    step(4,"Draw it","Draw the option the same way, with <b>+ Next step</b> for more steps in the option."),
    step(5,"More options","Tap <b>+ Another option</b> to add option B, C… from the same step, or go to a different step to branch from there."),
    step(6,"Back to the main play","Tap any main step number. To remove an option, open it and tap <b>Delete this option</b> twice.")
  ]);
  const watch=section("watch","Watch it run","",[
    step(1,"▶ Play through","Runs the whole play: players move, the ball travels with each pass, and each step's caption shows."),
    step(2,"Speed","Slow, Normal or Fast. Slow is good for walking players through it."),
    step(3,"Play the options","When a play has options, buttons appear under the court: <b>Main play</b> and each option. Tap one to watch that version from the start."),
    step(4,"Stop","Tap Stop, or any other button, to end it.")
  ]);
  const full=section("full","Full screen","",[
    step(1,"⤢ Full screen","Gives the court the whole screen with every tool in one toolbar at the top. Best on a phone or iPad."),
    step(2,"Exit","Tap <b>✕ Exit</b> to go back. Save works from the full-screen toolbar too.")
  ]);
  const save=section("save","Save, print and share","",[
    step(1,"Save play","Saves it to your team's play library. Your staff sees it right away. If you tap New play or open another play with unsaved changes, the app asks before throwing them away."),
    step(2,"Open, copy or delete","Your plays are in the <b>Play Library</b> (on a phone, tap <b>All plays</b>). Tap <b>Open</b> to see one: saved plays open in view mode so nothing changes by accident. Tap <b>✏️ Edit play</b> to change it and <b>✓ Done</b> to lock it again. <b>Copy</b> sends a play to another team you coach."),
    step(3,"New play","Starts a blank play."),
    step(4,"Printable PDF","Prints every step and option, with captions and notes, for a binder or the bench."),
    step(5,"Share with players","Makes a link players open on their phones to step through and watch your plays. No account needed."),
    step(6,"Use it in practice","In the Practice tab, add the play to a practice plan from the drill picker.")
  ]);
  dlg.innerHTML=`<div class="dlg hg">
    <div class="hg-head"><h2 id="helpTitle">How to use the play designer</h2><button type="button" class="icon" data-hgclose aria-label="Close">✕</button></div>
    <nav class="hg-nav" aria-label="Guide sections">${[["quick","Quick start"],["setup","Set up"],["draw","Draw"],["steps","Steps"],["options","Options"],["watch","Watch"],["full","Full screen"],["save","Save & share"]].map(([k,l])=>`<button type="button" data-hgjump="${k}">${l}</button>`).join("")}</nav>
    <div class="hg-scroll">${quick}${setup}${draw}${steps}${options}${watch}${full}${save}
      ${PERM.plays?"":`<p class="help">You have view-only access to plays, so the drawing tools are hidden. You can still play through, print and watch every option.</p>`}</div>
    <div class="actions" style="margin:0"><button type="button" class="btn primary" data-hgclose>Got it</button></div></div>`;
}
function open(){build();dlg.showModal();dlg.querySelector(".hg-scroll").scrollTop=0;}
document.addEventListener("click",e=>{if(e.target.closest("#pHelp"))open();});
dlg.addEventListener("click",e=>{
  if(e.target===dlg||e.target.closest("[data-hgclose]")){dlg.close();return;}
  const j=e.target.closest("[data-hgjump]");
  if(j){const d=document.getElementById("hg-"+j.dataset.hgjump);d.open=true;dlg.querySelector(".hg-scroll").scrollTop=d.offsetTop-dlg.querySelector(".hg-scroll").offsetTop;return;}
  const t=e.target.closest("[data-try]");
  if(t){dlg.close();const b=document.querySelector(`#ptools [data-tool="${t.dataset.try}"]`);if(b){b.click();b.scrollIntoView({behavior:"smooth",block:"center"});}}
});
})();
