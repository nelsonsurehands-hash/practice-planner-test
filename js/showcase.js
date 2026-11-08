/* Public plays & drills pages: step through the diagram or watch it run.
   Same drawing and play-through math as the app (js/board.js). */
let SPORT="basketball";
(function(){
  const data=JSON.parse(document.getElementById("scData").textContent),frames=data.frames,sch=playDefense(frames);
  const svg=document.querySelector("#scBoard svg"),cap=document.getElementById("scCap"),runBtn=document.getElementById("scRun");
  let step=0,anim=null;
  const draw=(fr,fade)=>{svg.innerHTML=boardInner(fr,"screen",null,fade);};
  function show(i){
    step=i;draw(withDefense(frames[i],sch));
    cap.innerHTML=`<b>Step ${i+1}</b>`+esc(frames[i].caption||"");
    document.querySelectorAll("#scSteps [data-step]").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.step===i));
    document.querySelectorAll(".sc-steps li").forEach((li,k)=>li.classList.toggle("on",k===i));
  }
  function stop(){anim=null;runBtn.textContent="▶ Watch it run";}
  function run(){
    anim={i:0,seq:frames.map((_,k)=>k),frames,opt:null,phase:"hold",t:0,tr:buildTransition(frames,0),last:performance.now(),paused:false};
    show(0);runBtn.textContent="❚❚ Pause";requestAnimationFrame(tick);
  }
  function tick(now){
    if(!anim||anim.paused)return;
    const dtv=now-anim.last;anim.t+=dtv;anim.last=now;
    const tr=anim.tr,D=DUR;
    const dur=anim.phase==="move"?(tr.moves?(tr.moveDur||D.move):0):anim.phase==="pass"?(tr.passCurve?D.pass:0):anim.phase==="end"?D.end:D.hold*0.7;
    if(anim.t>=dur){
      anim.t=0;
      if(anim.phase==="hold")anim.phase="move";
      else if(anim.phase==="move")anim.phase="pass";
      else if(anim.phase==="pass"){
        if(tr.last)anim.phase="end";
        else{anim.i++;anim.tr=buildTransition(frames,anim.i);anim.phase="hold";show(anim.i);}
      }else{
        draw({tokens:animDefense(anim,animTokens(tr,"pass",1),400,sch),actions:[]});
        anim.done=true;anim.paused=true;runBtn.textContent="↻ Watch again";return;
      }
      requestAnimationFrame(tick);return;
    }
    const u=dur?anim.t/dur:1;
    draw({tokens:animDefense(anim,animTokens(tr,anim.phase,u),dtv,sch),actions:tr.f.actions},anim.phase!=="hold");
    requestAnimationFrame(tick);
  }
  runBtn.addEventListener("click",()=>{
    if(anim&&!anim.done){anim.paused=!anim.paused;if(!anim.paused){anim.last=performance.now();requestAnimationFrame(tick);}runBtn.textContent=anim.paused?"▶ Resume":"❚❚ Pause";return;}
    run();
  });
  document.addEventListener("click",e=>{const b=e.target.closest("[data-step]");if(!b)return;stop();show(+b.dataset.step);
    if(b.classList.contains("sc-steplink"))document.getElementById("scBoard").scrollIntoView({behavior:"smooth",block:"center"});});
  /* swipe the diagram to change steps */
  let sx=null;const bd=document.getElementById("scBoard");
  bd.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;},{passive:true});
  bd.addEventListener("touchend",e=>{if(sx===null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)<50)return;stop();show(Math.max(0,Math.min(frames.length-1,step+(dx<0?1:-1))));},{passive:true});
  /* start playing once the diagram scrolls into view (once), unless the visitor prefers less motion */
  const calm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!calm&&"IntersectionObserver" in window){const io=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){io.disconnect();if(!anim)run();}},{threshold:.6});io.observe(bd);}
  show(0);
})();
