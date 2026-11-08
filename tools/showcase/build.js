/* Builds the public plays & drills pages (theextracoach.com/basketball/...) from tools/showcase/data.js.
   Uses the app's own play designer code (js/sports.js + js/board.js) to make the diagrams,
   so every page shows exactly what the app draws.  Run:  node tools/showcase/build.js */
const fs=require("fs"),path=require("path"),vm=require("vm");
const ROOT=path.join(__dirname,"..",".."),SITE="https://theextracoach.com";
const ITEMS=require("./data.js");

/* ---- load the app's drawing code ---- */
const ctx={console,Math,JSON,document:{querySelector:()=>null},performance:{now:()=>0}};vm.createContext(ctx);
const code=["js/sports.js","js/board.js"].map(f=>fs.readFileSync(path.join(ROOT,f),"utf8")).join("\n")+
  "\n;var SPORT='basketball';this.__={boardSVG,nextTokens,withDefense,boardInner};";
vm.runInContext(code,ctx);
const B=ctx.__;

/* ---- turn the short step lists into the app's frames ---- */
const HOOP={x:250,y:58};
function tokensFrom(start){
  const toks=[];
  Object.entries(start).forEach(([id,v])=>{if(id==="ball")return;const kind=id[0]==="d"?"d":"o";toks.push({id,kind,n:+id.slice(1),x:v[0],y:v[1]});});
  const h=toks.find(t=>t.id===start.ball);toks.push({id:"ball",kind:"ball",x:h.x+13,y:h.y-13});
  return toks;
}
const r1=v=>Math.round(v*10)/10;
function curve(x1,y1,x2,y2,bend){const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1;return {cx:r1(mx-dy*(bend||0)),cy:r1(my+dx*(bend||0))};}
function framesOf(item){
  let toks=tokensFrom(item.start);const frames=[];
  item.steps.forEach((st,i)=>{
    toks=JSON.parse(JSON.stringify(toks));
    if(st.ball){const h=toks.find(t=>t.id===st.ball),b=toks.find(t=>t.kind==="ball");b.x=h.x+13;b.y=h.y-13;}
    const pos=Object.fromEntries(toks.map(t=>[t.id,{x:t.x,y:t.y}]));const actions=[];
    st.acts.forEach(a=>{
      const [type,id]=a;
      if(type==="pass"){const p=pos[id],q=pos[a[2]];actions.push({type,from:id,to:a[2],x1:p.x,y1:p.y,x2:q.x,y2:q.y,...curve(p.x,p.y,q.x,q.y,0)});return;}
      if(type==="shot"){const p=pos[id];actions.push({type,from:id,to:null,x1:p.x,y1:p.y,x2:HOOP.x,y2:HOOP.y,...curve(p.x,p.y,HOOP.x,HOOP.y,.18)});return;}
      const p=pos[id],x=a[2],y=a[3];actions.push({type,from:id,to:null,x1:p.x,y1:p.y,x2:x,y2:y,...curve(p.x,p.y,x,y,a[4])});pos[id]={x,y};
    });
    const f={fid:"f"+i,caption:st.cap,tokens:toks,actions};
    if(i===0&&item.defense)f.defense={type:item.defense};
    frames.push(f);toks=B.nextTokens(f);
  });
  return frames;
}

/* ---- page parts ---- */
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const urlOf=it=>`/basketball/${it.kind==="play"?"plays":"drills"}/${it.slug}/`;
const svgOf=(f,cls)=>B.boardSVG(f,"screen").replace("<svg ",`<svg class="${cls||""}" role="img" aria-label="${esc(f.caption)}" `);
const LEGEND=`<p class="sc-key"><span><i class="k-cut"></i>Cut</span><span><i class="k-pass"></i>Pass</span><span><i class="k-drib"></i>Dribble</span><span><i class="k-scr"></i>Screen</span><span><i class="k-shot"></i>Shot</span></p>`;
const head=({title,desc,canon,img,ld})=>`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${canon}">
<meta property="og:site_name" content="The Extra Coach">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${canon}">
<meta property="og:image" content="${SITE}${img||"/icons/icon-512.png"}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0a1230">
<link rel="icon" href="/brand/mark.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/css/app.css">
<link rel="stylesheet" href="/css/showcase.css">
${(ld||[]).map(o=>`<script type="application/ld+json">${JSON.stringify(o).replace(/</g,"\\u003c")}</script>`).join("\n")}
</head>
<body class="sc">
<header class="sc-top"><div class="sc-wrap">
  <a class="lp-logo" href="/" aria-label="The Extra Coach home"><img src="/brand/mark.svg" alt="" width="36" height="36"><span>The Extra <b>Coach</b></span></a>
  <nav class="sc-nav" aria-label="Plays and drills"><a href="/basketball-play-designer/">Play designer</a><a href="/basketball/#plays">Plays</a><a href="/basketball/#drills">Drills</a><a href="/basketball-practice-plan-template/">Templates</a><a class="sc-cta-sm" href="/?from=showcase">Try it free</a></nav>
</div></header>`;
const foot=`<footer class="sc-foot"><div class="sc-wrap">
  <span class="lp-logo small"><img src="/brand/mark.svg" alt="" width="24" height="24"><span>The Extra <b>Coach</b></span></span>
  <span>Practice plans, animated plays, the season calendar and parent sign-ups in one app for your whole staff.</span>
  <span class="sc-foot-links"><a href="/basketball/">Plays &amp; drills</a><a href="/basketball-practice-plan-template/">Practice plan templates</a><a href="/basketball-play-template/">Printable play templates</a></span>
</div></footer>`;
const cta=it=>`<aside class="sc-cta">
  <div><p class="sc-eyebrow">Made in The Extra Coach</p>
  <h2>${it.kind==="play"?"Draw your own plays like this":"Put this drill in your next practice"}</h2>
  <p>${it.kind==="play"?"Drag players onto the court, draw cuts, passes and screens, and watch the play run step by step. Share it with your players in one link.":"Build a timed practice plan in minutes: add drills, set the minutes and print it or send it to your staff. Free for coaches."}</p></div>
  <a class="sc-btn" href="${it.kind==="play"?"/basketball-play-designer/":"/?from=drill"}">${it.kind==="play"?"Try the play designer":"Create your team free"}</a>
</aside>`;

function itemPage(it,all){
  const frames=framesOf(it),url=urlOf(it),kindName=it.kind==="play"?"Play":"Drill";
  const title=it.kind==="play"?`${it.name}: Basketball Play Diagram (Animated) | The Extra Coach`:`${it.name}: Basketball Drill with Animated Diagram | The Extra Coach`;
  const facts=[["Type",it.type],["Level",it.level],it.minutes&&["Time",it.minutes+" min"],it.players&&["Players",it.players]].filter(Boolean);
  const listName=it.kind==="play"?"How to run it":"How the drill works";
  const extraTitle=it.kind==="play"?"Reads":"Variations",extra=it.kind==="play"?it.reads:it.variations;
  const related=all.filter(x=>x.kind===it.kind&&x.slug!==it.slug).slice(0,4);
  const ld=[{"@context":"https://schema.org","@type":"HowTo",name:`How to run the ${it.name}`,description:it.summary,
      totalTime:it.minutes?`PT${String(it.minutes).split(/[–-]/).pop()}M`:undefined,
      step:frames.map((f,i)=>({"@type":"HowToStep",position:i+1,name:`Step ${i+1}`,text:f.caption,url:`${SITE}${url}#step-${i+1}`}))},
    {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[
      {"@type":"ListItem",position:1,name:"Basketball plays & drills",item:`${SITE}/basketball/`},
      {"@type":"ListItem",position:2,name:it.kind==="play"?"Plays":"Drills",item:`${SITE}/basketball/#${it.kind}s`},
      {"@type":"ListItem",position:3,name:it.name,item:`${SITE}${url}`}]}];
  return head({title,desc:it.summary,canon:url,ld})+`
<main class="sc-wrap sc-main">
  <nav class="sc-crumbs" aria-label="Breadcrumb"><a href="/basketball/">Basketball</a><span>›</span><a href="/basketball/#${it.kind}s">${it.kind==="play"?"Plays":"Drills"}</a><span>›</span><b>${esc(it.name)}</b></nav>
  <header class="sc-hero">
    <p class="sc-eyebrow">${esc(it.type)} · ${kindName}</p>
    <h1>${esc(it.name)}</h1>
    <p class="sc-lede">${esc(it.intro)}</p>
    <dl class="sc-facts">${facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  </header>
  <section class="sc-player" aria-label="Animated diagram">
    <div class="sc-board" id="scBoard">${svgOf(frames[0],"sc-svg")}</div>
    <div class="sc-ctrl">
      <button class="sc-btn" type="button" id="scRun">▶ Watch it run</button>
      <div class="sc-stepbtns" id="scSteps">${frames.map((f,i)=>`<button type="button" data-step="${i}" aria-pressed="${i===0}" aria-label="Step ${i+1}">${i+1}</button>`).join("")}</div>
    </div>
    <p class="sc-cap" id="scCap" aria-live="polite"><b>Step 1</b>${esc(frames[0].caption)}</p>
    ${LEGEND}${it.defense?`<p class="sc-note">X's show ${it.defense==="man"?"man-to-man":"zone"} defense moving the way the app draws it.</p>`:""}
  </section>
  <div class="sc-cols">
    <section class="sc-sec"><h2>${listName}</h2><ol class="sc-steps">${frames.map((f,i)=>`<li id="step-${i+1}"><button type="button" class="sc-steplink" data-step="${i}">Step ${i+1}</button> ${esc(f.caption)}</li>`).join("")}</ol></section>
    <section class="sc-sec"><h2>Coaching points</h2><ul class="sc-list">${it.points.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>
      ${extra&&extra.length?`<h2>${extraTitle}</h2><ul class="sc-list">${extra.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>`:""}</section>
  </div>
  ${cta(it)}
  ${related.length?`<section class="sc-sec"><h2>More ${it.kind==="play"?"plays":"drills"}</h2><div class="sc-grid">${related.map(card).join("")}</div></section>`:""}
</main>
${foot}
<script type="application/json" id="scData">${JSON.stringify({frames}).replace(/</g,"\\u003c")}</script>
<script src="/js/sports.js"></script>
<script src="/js/board.js"></script>
<script src="/js/showcase.js"></script>
</body>
</html>
`;
}
function card(it){const f=framesOf(it)[0];
  return `<a class="sc-card" href="${urlOf(it)}">${svgOf(f,"sc-thumb")}<span><b>${esc(it.name)}</b><small>${esc(it.type)}${it.minutes?" · "+esc(it.minutes)+" min":""}</small></span></a>`;}

function hubPage(all){
  const plays=all.filter(x=>x.kind==="play"),drills=all.filter(x=>x.kind==="drill");
  const desc="Free animated basketball plays and drills: common sets like Horns, 5-out motion and box BLOB, plus drills like the 3-man weave, Mikan and shell, with step-by-step diagrams.";
  const ld=[{"@context":"https://schema.org","@type":"CollectionPage",name:"Basketball plays & drills, animated",description:desc,url:`${SITE}/basketball/`,
    hasPart:all.map(it=>({"@type":"CreativeWork",name:it.name,url:SITE+urlOf(it)}))}];
  return head({title:"Basketball Plays & Drills with Animated Diagrams | The Extra Coach",desc,canon:"/basketball/",ld})+`
<main class="sc-wrap sc-main">
  <header class="sc-hero sc-hero-hub">
    <p class="sc-eyebrow">Free for coaches</p>
    <h1>Basketball plays &amp; drills, animated</h1>
    <p class="sc-lede">Common sets and practice drills you can watch run, step by step. Every diagram is drawn in The Extra Coach, the app coaches use to plan practices, draw plays and share them with their team.</p>
  </header>
  <section class="sc-sec pt-tiles" aria-label="Free tools"><a href="/basketball-play-designer/"><b>Play designer</b><span>Draw a play and watch it run</span></a><a href="/basketball-practice-plan-template/"><b>Practice plan templates</b><span>60, 90 and 120 minutes, printable</span></a><a href="/basketball-play-template/"><b>Printable play templates</b><span>Blank half courts, 4 or 6 per page</span></a></section>
  <section class="sc-sec" id="plays"><h2>Plays and sets</h2><div class="sc-grid">${plays.map(card).join("")}</div></section>
  <section class="sc-sec" id="drills"><h2>Drills</h2><div class="sc-grid">${drills.map(card).join("")}</div></section>
  ${cta({kind:"play"})}
</main>
${foot}
</body>
</html>
`;
}

/* ---- the play designer landing page (/basketball-play-designer/) ---- */
function designerPage(all){
  const desc="Free basketball play designer that runs in your browser. Draw cuts, passes, dribbles and screens, add man or zone defense, and watch your plays animate step by step. No download.";
  const faqs=[
    ["Is the basketball play designer free?","Yes. You can try it on this page without an account, and creating a team in The Extra Coach to save your plays is free."],
    ["Do I need to download an app?","No. It runs in the browser on iPhone, iPad, Android, Chromebook, Mac and PC. You can also add it to your home screen so it opens like an app."],
    ["Can my plays animate?","Yes. Every step plays back with players moving, the ball passing and defenders reacting, so players can see the timing, not just the lines."],
    ["Can I show the play against a defense?","Yes. Turn on man-to-man, 2-3 zone, 3-2 zone or box-and-1, and the defenders move with the ball automatically."],
    ["Can I share plays with my players?","Yes. Send one link and players can step through or watch every play on their phone without signing up. You can also print plays as a PDF."],
    ["Can I bring in the plays I already have?","Yes. Take a photo of a play on a whiteboard, in a notebook or on a printout and the app draws it for you, one photo per step. You can also import a backup file of plays and drills from another coach."],
    ["Does it work for other sports?","Yes. Besides basketball, there are boards for volleyball, soccer, football and baseball or softball."]];
  const feats=[
    ["Draw it like a whiteboard","Drag players onto the half court and draw cuts, passes, dribbles and screens with your finger or mouse."],
    ["Watch it run","Play the whole set step by step. Players move, the ball moves, and you can pause or step back at any point."],
    ["Add a defense","Show the play against man-to-man, a 2-3 or 3-2 zone, or a box-and-1. Defenders shift with the ball."],
    ["Reads and options","Number the looks the ball handler has, so players know the first, second and third option."],
    ["Share in one link","Send your playbook to players and parents. They open it on their phone, no account needed."],
    ["Print a playbook","Clean black-and-white PDFs of every step, ready for the binder or the bench."],
    ["Import from a photo","Snap your whiteboard or notebook and the play comes in ready to animate. Practice plans, schedules and rosters work the same way."]];
  const ld=[{"@context":"https://schema.org","@type":"SoftwareApplication",name:"The Extra Coach Play Designer",applicationCategory:"SportsApplication",operatingSystem:"Web, iOS, Android, Windows, macOS",
      offers:{"@type":"Offer",price:"0",priceCurrency:"USD"},description:desc,url:`${SITE}/basketball-play-designer/`},
    {"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))}];
  const blank={tokens:[{id:"o1",kind:"o",n:1,x:250,y:318},{id:"o2",kind:"o",n:2,x:474,y:34},{id:"o3",kind:"o",n:3,x:26,y:34},{id:"o4",kind:"o",n:4,x:170,y:190},{id:"o5",kind:"o",n:5,x:330,y:190},{id:"ball",kind:"ball",x:263,y:305}],actions:[],defense:{type:"man"}};
  const plays=all.filter(x=>x.kind==="play");
  return head({title:"Free Basketball Play Designer: Draw & Animate Plays Online | The Extra Coach",desc,canon:"/basketball-play-designer/",ld})+`
<main class="sc-wrap sc-main">
  <header class="sc-hero">
    <p class="sc-eyebrow">Free · No download · Works on any phone</p>
    <h1>Basketball play designer</h1>
    <p class="sc-lede">Draw your plays, add a defense and watch them run. The Extra Coach turns the whiteboard into animated plays your players can actually follow. Try it right here: drag from a player to draw a move.</p>
  </header>
  <section class="sc-player td" aria-label="Try the play designer">
    <div class="td-tools" id="tdTools" role="toolbar" aria-label="Drawing tools">
      ${[["move","Move"],["cut","Cut"],["pass","Pass"],["dribble","Dribble"],["screen","Screen"]].map(([k,l])=>`<button type="button" data-tool="${k}" aria-pressed="${k==="cut"}">${l}</button>`).join("")}
      <label class="td-def">Defense<select id="tdDef"><option value="none">None</option><option value="man" selected>Man-to-man</option><option value="z23">2-3 zone</option><option value="z32">3-2 zone</option></select></label>
    </div>
    <div class="sc-board td-board" id="tdBoard">${svgOf(blank,"sc-svg").replace("<svg ",'<svg style="touch-action:none" ')}</div>
    <p class="td-hint" id="tdHint" aria-live="polite">Drag from a player to draw a cut.</p>
    <div class="sc-ctrl"><button class="sc-btn" type="button" id="tdRun">▶ Watch it run</button><span class="td-sec"><button class="td-link" type="button" id="tdUndo">Undo</button><button class="td-link" type="button" id="tdClear">Start over</button></span></div>
    ${LEGEND}
  </section>
  <aside class="sc-cta"><div><p class="sc-eyebrow">Like it?</p><h2>Save your plays and build a playbook</h2>
    <p>Multi-step plays, options and reads, practice plans, a season calendar and parent sign-ups, shared with your whole staff.</p></div>
    <a class="sc-btn" href="/?from=designer">Create your team free</a></aside>
  <section class="sc-sec"><h2>Everything a coach needs to draw up plays</h2>
    <div class="td-feats">${feats.map(([t,d])=>`<div><h3>${t}</h3><p>${d}</p></div>`).join("")}</div></section>
  <section class="sc-sec"><h2>See plays made with it</h2><div class="sc-grid">${plays.map(card).join("")}</div>
    <p class="td-more"><a href="/basketball/">All animated plays and drills ›</a></p></section>
  <section class="sc-sec td-faq"><h2>Questions coaches ask</h2>${faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</section>
</main>
${foot}
<script src="/js/sports.js"></script>
<script src="/js/board.js"></script>
<script src="/js/designer-demo.js"></script>
</body>
</html>
`;
}

/* ---- free templates: practice plans and printable play sheets ---- */
const TPL=require("./templates.js");
const clock=m=>`${Math.floor(m/60)}:${String(m%60).padStart(2,"0")}`;
const PRINT_JS=`<script>document.addEventListener("click",e=>{const b=e.target.closest("[data-print]");if(!b)return;const t=document.getElementById(b.dataset.print);if(!t)return;
const clear=()=>{document.body.classList.remove("print-one");document.querySelectorAll(".printing,.print-path").forEach(x=>x.classList.remove("printing","print-path"));};
clear();t.classList.add("printing");for(let p=t.parentElement;p&&p!==document.body;p=p.parentElement)p.classList.add("print-path");document.body.classList.add("print-one");window.print();});
window.addEventListener("afterprint",()=>{document.body.classList.remove("print-one");document.querySelectorAll(".printing,.print-path").forEach(x=>x.classList.remove("printing","print-path"));});</script>`;
function practiceTemplatePage(){
  const desc="Free basketball practice plan templates: timed 60-minute youth, 90-minute middle school and 2-hour high school plans, plus a blank printable practice plan sheet.";
  const plans=TPL.plans.map(p=>{let t=0;const total=p.blocks.reduce((a,b)=>a+b[1],0);
    const rows=p.blocks.map(([n,m,f,l])=>{const s=t;t+=m;return `<tr><td class="pt-time">${clock(s)}–${clock(t)}</td><td><b>${l?`<a href="/basketball/${l}/">${esc(n)}</a>`:esc(n)}</b>${f?`<small>${esc(f)}</small>`:""}</td><td class="pt-min">${m}</td></tr>`;}).join("");
    return `<section class="pt-plan sc-sec" id="${p.id}"><div class="pt-head"><div><h2>${esc(p.name)}</h2><p class="pt-who">${esc(p.who)} · ${total} minutes · ${p.blocks.length} blocks</p></div>
      <button class="sc-btn pt-print" type="button" data-print="${p.id}">Print this plan</button></div>
      <p>${esc(p.summary)}</p>
      <table class="pt-table"><thead><tr><th>Time</th><th>Drill and focus</th><th>Min</th></tr></thead><tbody>${rows}</tbody></table></section>`;}).join("");
  const blankRows=Array.from({length:14},()=>`<tr><td></td><td></td><td></td><td></td></tr>`).join("");
  const ld=[{"@context":"https://schema.org","@type":"FAQPage",mainEntity:TPL.faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))},
    ...TPL.plans.map(p=>({"@context":"https://schema.org","@type":"HowTo",name:p.name,description:p.summary,totalTime:`PT${p.blocks.reduce((a,b)=>a+b[1],0)}M`,
      step:p.blocks.map((b,i)=>({"@type":"HowToStep",position:i+1,name:b[0],text:`${b[0]} (${b[1]} min)${b[2]?": "+b[2]:""}`}))}))];
  return head({title:"Basketball Practice Plan Templates (Free & Printable) | The Extra Coach",desc,canon:"/basketball-practice-plan-template/",ld})+`
<main class="sc-wrap sc-main">
  <header class="sc-hero">
    <p class="sc-eyebrow">Free · Printable · Timed to the minute</p>
    <h1>Basketball practice plan templates</h1>
    <p class="sc-lede">Three ready-to-run practice plans by age and length, each timed block by block, plus a blank sheet to print and fill in. Drills link to animated diagrams so you and your assistants know exactly how each one runs.</p>
    <nav class="pt-toc" aria-label="Plans on this page">${TPL.plans.map(p=>`<a href="#${p.id}">${esc(p.name)}</a>`).join("")}<a href="#blank">Blank printable sheet</a></nav>
  </header>
  ${plans}
  <aside class="sc-cta"><div><p class="sc-eyebrow">Skip the paper</p><h2>Build these in minutes, timed for you</h2>
    <p>Pick drills from your library, set the minutes, and The Extra Coach fills in the clock, prints a clean copy and shares it with your staff. Already have plans on paper? Snap a photo and it reads them in.</p></div>
    <a class="sc-btn" href="/?from=practice-template">Create your team free</a></aside>
  <section class="sc-sec pt-blank" id="blank"><div class="pt-head"><div><h2>Blank practice plan sheet</h2><p class="pt-who">Print it, fill it in, take it to the gym.</p></div>
      <button class="sc-btn pt-print" type="button" data-print="blank">Print the blank sheet</button></div>
    <div class="pt-sheet"><div class="pt-sheet-head"><span>Team</span><span>Date</span><span>Start</span><span>End</span></div><div class="pt-sheet-focus"><span>Focus for the day</span></div>
      <table class="pt-table pt-blanktable"><thead><tr><th>Time</th><th>Drill</th><th>Min</th><th>Coaching points</th></tr></thead><tbody>${blankRows}</tbody></table>
      <p class="pt-sheet-foot">theextracoach.com · free practice planner and play designer</p></div></section>
  <section class="sc-sec td-faq"><h2>Practice planning questions</h2>${TPL.faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</section>
  <section class="sc-sec"><h2>Drills in these plans</h2><div class="sc-grid">${ITEMS.filter(x=>x.kind==="drill").map(card).join("")}</div></section>
</main>
${foot}
${PRINT_JS}
</body>
</html>
`;
}
function playTemplatePage(){
  const desc="Free printable basketball play templates: blank half court diagrams, 4 or 6 per page, and a playbook page with notes. Or draw and animate plays free online.";
  const court=B.boardSVG({tokens:[],actions:[]},"print").replace("<svg ",'<svg class="pt-court" role="img" aria-label="Blank half court" ');
  const sheet=(id,n,title,cls)=>`<div class="pt-courts ${cls}" id="${id}"><p class="pt-sheet-title">${title}</p>${Array.from({length:n},(_,i)=>`<div class="pt-cell">${court}<span>Play ______________________ · Step ${i+1}</span></div>`).join("")}<p class="pt-sheet-foot">theextracoach.com · draw and animate plays free</p></div>`;
  const faqs=[["What's the best way to draw basketball plays?","Use a consistent key: numbers for offensive players, X's for defenders, a solid arrow for a cut, a dashed arrow for a pass, a zig-zag for a dribble and a line ending in a bar for a screen. Draw one step per court so players can follow the order."],
    ["Can I print blank basketball court diagrams?","Yes. Print the half-court sheets on this page, 4 or 6 per page, or the single-court playbook page with room for notes and reads."],
    ["Is there a free basketball play designer?","Yes. The Extra Coach play designer runs in your browser. Drag players, draw cuts, passes and screens, add a defense and watch the play animate. You can share plays with players in one link."],
    ["Can I turn my hand-drawn plays into digital plays?","Yes. Take a photo of a play on a whiteboard or in a notebook and The Extra Coach draws it as an animated play you can edit."]];
  const ld=[{"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))}];
  return head({title:"Basketball Play Template: Free Printable Half Court Diagrams | The Extra Coach",desc,canon:"/basketball-play-template/",ld})+`
<main class="sc-wrap sc-main">
  <header class="sc-hero">
    <p class="sc-eyebrow">Free · Printable · Black and white</p>
    <h1>Basketball play templates</h1>
    <p class="sc-lede">Clean, to-scale half court diagrams to print and draw on: four or six to a page for step-by-step plays, or one big court with room for reads and notes. Want it to move? Draw the same play in the free play designer and watch it run.</p>
  </header>
  <section class="sc-sec"><div class="pt-head"><div><h2>4 half courts per page</h2><p class="pt-who">One step per court: the most common way to draw a set.</p></div><button class="sc-btn pt-print" type="button" data-print="c4">Print 4 per page</button></div>
    ${sheet("c4",4,"Play: ______________________________  Type: ____________","g4")}</section>
  <section class="sc-sec"><div class="pt-head"><div><h2>6 half courts per page</h2><p class="pt-who">For longer sets, options and counters.</p></div><button class="sc-btn pt-print" type="button" data-print="c6">Print 6 per page</button></div>
    ${sheet("c6",6,"Play: ______________________________  Type: ____________","g6")}</section>
  <section class="sc-sec"><div class="pt-head"><div><h2>Playbook page with notes</h2><p class="pt-who">One big court, plus lines for the reads and coaching points.</p></div><button class="sc-btn pt-print" type="button" data-print="c1">Print playbook page</button></div>
    <div class="pt-courts g1" id="c1"><p class="pt-sheet-title">Play: ______________________________  Type: ____________  Set: ____________</p><div class="pt-cell">${court}</div>
      <div class="pt-lines"><b>Reads</b>${"<i></i>".repeat(4)}<b>Coaching points</b>${"<i></i>".repeat(4)}</div><p class="pt-sheet-foot">theextracoach.com · draw and animate plays free</p></div></section>
  <section class="sc-sec"><h2>Diagram key</h2>${LEGEND}<p class="pt-who">Numbers 1–5 are the offense, X's are the defense.</p></section>
  <aside class="sc-cta"><div><p class="sc-eyebrow">Make it move</p><h2>Draw it once, watch it run</h2>
    <p>The free play designer animates every step, adds man or zone defense and shares the playbook with your players in one link. Already drew it on paper? Snap a photo and it comes in ready to edit.</p></div>
    <a class="sc-btn" href="/basketball-play-designer/">Try the play designer</a></aside>
  <section class="sc-sec td-faq"><h2>Questions</h2>${faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</section>
  <section class="sc-sec"><h2>Plays drawn with the designer</h2><div class="sc-grid">${ITEMS.filter(x=>x.kind==="play").map(card).join("")}</div></section>
</main>
${foot}
${PRINT_JS}
</body>
</html>
`;
}

/* ---- write it all ---- */
const out=(rel,html)=>{const p=path.join(ROOT,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,html);};
ITEMS.forEach(it=>out(urlOf(it).slice(1)+"index.html",itemPage(it,ITEMS)));
out("basketball/index.html",hubPage(ITEMS));
out("basketball-play-designer/index.html",designerPage(ITEMS));
out("basketball-practice-plan-template/index.html",practiceTemplatePage());
out("basketball-play-template/index.html",playTemplatePage());
const today=new Date().toISOString().slice(0,10);
out("sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["/","/basketball-play-designer/","/basketball-practice-plan-template/","/basketball-play-template/","/basketball/",...ITEMS.map(urlOf)].map(u=>`  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`);
out("robots.txt",`User-agent: *
Allow: /
Disallow: /c/
Disallow: /f/
Disallow: /p/
Sitemap: ${SITE}/sitemap.xml
`);
console.log(`Built ${ITEMS.length} pages + hub, sitemap.xml, robots.txt`);
