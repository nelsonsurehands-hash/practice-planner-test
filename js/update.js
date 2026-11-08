/* Automatic updates. When a new version of the app is published, open copies (including the
   home-screen app) notice it and refresh themselves, so coaches never have to reload or
   re-add the app. It checks when the app opens, when you come back to it, and every 10 minutes.
   If you're in the middle of something unsaved, it waits and shows an "Update now" bar instead. */
(function(){
  const CURRENT=window.APP_VERSION||"";
  let pending=null,checking=false,lastTyped=0;const typed=new Set();
  document.addEventListener("input",e=>{const el=e.target;if(!el||!/INPUT|TEXTAREA/.test(el.tagName)||/^(search|checkbox|radio|file|range)$/.test(el.type))return;typed.add(el);lastTyped=Date.now();},true);
  /* A form that's been submitted or reset is saved (or thrown away): stop holding the update for it. */
  document.addEventListener("submit",e=>{e.target.querySelectorAll&&e.target.querySelectorAll("input,textarea").forEach(el=>typed.delete(el));},true);
  document.addEventListener("reset",e=>{e.target.querySelectorAll&&e.target.querySelectorAll("input,textarea").forEach(el=>typed.delete(el));},true);

  window.__updBusy=()=>busy();
  function busy(){
    try{
      if(typeof pdirty!=="undefined"&&pdirty)return true;                       // unsaved play
      if(typeof saveTimer!=="undefined"&&saveTimer)return true;                 // practice plan still saving
      const st=document.getElementById("sStatus");if(st&&/unsaved|saving/i.test(st.textContent))return true;
      if(document.querySelector("dialog[open]"))return true;                     // a popup is open
      if(typeof anim!=="undefined"&&anim&&!anim.paused)return true;              // a play is running
      if(document.body.classList.contains("live-mode"))return true;               // tracking a game live
      /* Anything typed that hasn't been saved yet (a new drill, a roster paste, a note…), even if
         you've tapped away from it: wait, so nothing gets lost. Fields that save as you type only
         count for a minute after the last keystroke. */
      const recent=Date.now()-lastTyped<60000;
      for(const el of typed){
        if(!el.isConnected||el.readOnly||el.disabled)continue;
        if(el.value===el.defaultValue)continue;
        if(recent||el.closest("form,dialog,[data-keepdraft]"))return true;
      }
    }catch{}
    return false;
  }
  function reload(){
    try{sessionStorage.setItem("cpp:updatedTo",pending||"");}catch{}
    const go=()=>location.reload();
    if(window.SW_REG&&window.SW_REG.update)window.SW_REG.update().then(go,go);else go();
  }
  function showBar(){
    if(document.getElementById("updBar"))return;
    const bar=document.createElement("div");bar.id="updBar";bar.className="upd-bar";bar.setAttribute("role","status");
    bar.innerHTML=`<span><b>New version ready.</b> Finish or save what you're doing, then update.</span><button class="btn primary" type="button" id="updNow">Update now</button>`;
    document.body.appendChild(bar);
    document.getElementById("updNow").addEventListener("click",reload);
  }
  async function check(){
    if(checking||!location.protocol.startsWith("http"))return;checking=true;
    try{
      const r=await fetch("version.js?t="+Date.now(),{cache:"no-store"});
      const m=/APP_VERSION\s*=\s*"([^"]+)"/.exec(await r.text());
      if(m&&CURRENT&&m[1]!==CURRENT){pending=m[1];if(busy())showBar();else reload();}
    }catch{}finally{checking=false;}
  }
  /* Once something is saved, finish a waiting update right away. */
  setInterval(()=>{if(pending&&!busy()&&document.visibilityState==="visible")reload();},5000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check();});
  window.addEventListener("focus",check);
  setInterval(()=>{if(document.visibilityState==="visible")check();},10*60*1000);
  setTimeout(check,4000);

  /* After an automatic update, say so briefly. */
  try{
    const v=sessionStorage.getItem("cpp:updatedTo");
    if(v){sessionStorage.removeItem("cpp:updatedTo");
      const t=document.createElement("div");t.className="upd-bar upd-done";t.setAttribute("role","status");
      t.innerHTML=`<span><b>App updated.</b> You're on the newest version.</span>`;document.body.appendChild(t);setTimeout(()=>t.remove(),4000);}
  }catch{}
})();
