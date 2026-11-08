/* Try-it court on the public play designer page: drag players, draw a cut, pass, dribble or screen,
   pick a defense and watch it run. Same drawing and play-through code as the app (js/board.js). */
let SPORT="basketball";
(function(){
  const svg=document.querySelector("#tdBoard svg"),hint=document.getElementById("tdHint"),runBtn=document.getElementById("tdRun");
  const START=()=>({tokens:[{id:"o1",kind:"o",n:1,x:250,y:318},{id:"o2",kind:"o",n:2,x:474,y:34},{id:"o3",kind:"o",n:3,x:26,y:34},{id:"o4",kind:"o",n:4,x:170,y:190},{id:"o5",kind:"o",n:5,x:330,y:190},{id:"ball",kind:"ball",x:263,y:305}],actions:[]});
  let fr=START(),tool="cut",def={type:"man"},drag=null,anim=null,uid=0;
  const HINTS={move:"Drag any player to a new spot.",cut:"Drag from a player to draw a cut.",dribble:"Drag from the player with the ball to draw a dribble.",
    pass:"Drag from the player with the ball to a teammate to pass.",screen:"Drag from a player to where she sets the screen."};
  const pt=e=>{const m=svg.getScreenCTM();if(!m)return {x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:p.x,y:p.y};};
  const hit=p=>fr.tokens.filter(t=>t.kind==="o").find(t=>Math.hypot(t.x-p.x,t.y-p.y)<24);
  const clampP=p=>({x:Math.max(8,Math.min(492,p.x)),y:Math.max(-30,Math.min(462,p.y))});
  function draw(tmp){svg.innerHTML=boardInner(withDefense(fr,def),"screen",tmp);}
  function setHint(t){hint.textContent=t||HINTS[tool];}
  function stop(){anim=null;runBtn.textContent="▶ Watch it run";draw();}

  svg.addEventListener("pointerdown",e=>{
    if(anim)stop();
    const p=pt(e),t=hit(p);if(!t)return;
    e.preventDefault();try{svg.setPointerCapture(e.pointerId);}catch{}
    const h=holderOf(fr);
    if((tool==="dribble"||tool==="pass")&&(!h||h.id!==t.id)){setHint(`Only the player with the ball can ${tool}. That's ${h?h.n:"nobody"} right now.`);return;}
    drag={t,p0:p,tool};
  });
  svg.addEventListener("pointermove",e=>{
    if(!drag)return;e.preventDefault();const p=clampP(pt(e)),t=drag.t;
    if(drag.tool==="move"){
      const b=fr.tokens.find(x=>x.kind==="ball"),h=holderOf(fr),dx=p.x-t.x,dy=p.y-t.y;
      t.x=p.x;t.y=p.y;if(b&&h&&h.id===t.id){b.x+=dx;b.y+=dy;}
      fr.actions.forEach(a=>{if(a.from===t.id){a.x1=t.x;a.y1=t.y;}if(a.to===t.id){a.x2=t.x;a.y2=t.y;}});
      draw();return;
    }
    const tgt=drag.tool==="pass"?(fr.tokens.find(x=>x.kind==="o"&&x.id!==t.id&&Math.hypot(x.x-p.x,x.y-p.y)<24)||p):p;
    drag.tmp={type:drag.tool,from:t.id,to:null,x1:t.x,y1:t.y,x2:tgt.x,y2:tgt.y,cx:(t.x+tgt.x)/2,cy:(t.y+tgt.y)/2};draw(drag.tmp);
  });
  function up(e){
    if(!drag)return;const d=drag;drag=null;
    if(d.tool==="move"||!d.tmp){draw();return;}
    const a=d.tmp;if(Math.hypot(a.x2-a.x1,a.y2-a.y1)<20){draw();return;}
    if(a.type==="pass"){const r=fr.tokens.find(x=>x.kind==="o"&&x.id!==a.from&&Math.hypot(x.x-a.x2,x.y-a.y2)<26);
      if(!r){setHint("Let go on a teammate to make the pass.");draw();return;}a.to=r.id;a.x2=r.x;a.y2=r.y;fr.actions=fr.actions.filter(x=>x.type!=="pass");}
    else fr.actions=fr.actions.filter(x=>!(x.from===a.from&&x.type!=="pass"));   // one move per player in this demo
    a.id="t"+(++uid);fr.actions.push(a);setHint(fr.actions.length===1?"Nice. Add another move, or tap “Watch it run.”":"");draw();
  }
  svg.addEventListener("pointerup",up);svg.addEventListener("pointercancel",up);

  document.getElementById("tdTools").addEventListener("click",e=>{const b=e.target.closest("[data-tool]");if(!b)return;tool=b.dataset.tool;
    document.querySelectorAll("#tdTools [data-tool]").forEach(x=>x.setAttribute("aria-pressed",x===b));setHint();});
  document.getElementById("tdDef").addEventListener("change",e=>{def=e.target.value==="none"?null:{type:e.target.value};if(anim)stop();else draw();});
  document.getElementById("tdClear").addEventListener("click",()=>{fr=START();if(anim)anim=null;runBtn.textContent="▶ Watch it run";setHint();draw();});
  document.getElementById("tdUndo").addEventListener("click",()=>{if(anim)stop();fr.actions.pop();draw();});

  /* play it */
  function tick(now){
    if(!anim||anim.paused)return;
    const dtv=now-anim.last;anim.t+=dtv;anim.last=now;const tr=anim.tr;
    const dur=anim.phase==="move"?(tr.moves?(tr.moveDur||DUR.move):0):anim.phase==="pass"?(tr.passCurve?DUR.pass:0):anim.phase==="hold"?700:DUR.end;
    if(anim.t>=dur){anim.t=0;
      if(anim.phase==="hold")anim.phase="move";else if(anim.phase==="move")anim.phase="pass";else if(anim.phase==="pass")anim.phase="end";
      else{svg.innerHTML=boardInner({tokens:animDefense(anim,animTokens(tr,"pass",1),400,def),actions:[]},"screen");anim.done=true;runBtn.textContent="↻ Watch again";return;}
      requestAnimationFrame(tick);return;}
    const u=dur?anim.t/dur:1;
    svg.innerHTML=boardInner({tokens:animDefense(anim,animTokens(tr,anim.phase,u),dtv,def),actions:tr.f.actions},"screen",null,anim.phase!=="hold");
    requestAnimationFrame(tick);
  }
  runBtn.addEventListener("click",()=>{
    if(anim&&!anim.done){stop();return;}
    if(!fr.actions.length){setHint("Draw a move first: pick Cut and drag from a player.");return;}
    const frames=[JSON.parse(JSON.stringify(fr))];
    anim={frames,seq:[0],i:0,opt:null,phase:"hold",t:0,tr:buildTransition(frames,0),last:performance.now()};
    runBtn.textContent="■ Stop";requestAnimationFrame(tick);
  });
  setHint();draw();
})();
