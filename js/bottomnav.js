/* Phones: a tab bar along the bottom of the screen (Home, Practice, Plays, Calendar, Team, Settings).
   The Drill Library lives inside Practice (Practice plan | Drill library switch at the top of both).
   It only presses the real tabs at the top, so everything they do (feature switches, view-only
   staff, unsaved-play checks) works the same. More holds Drill Library and Settings. */
(function(){
  const app=document.getElementById("app");if(!app)return;
  const I={home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    plan:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h5"/>',
    plays:'<circle cx="5.5" cy="18.5" r="3"/><path d="M15.5 3.5l5 5M20.5 3.5l-5 5"/><path d="M5.5 14.3C5.9 9.6 8.6 7.5 12.2 8.6"/><path d="M9.8 6.4l2.6 2.2-2.1 2.7"/>',
    cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    team:'<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.3c2.6-.4 4.6 1.2 5 4.2"/>',
    more:'<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    lib:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8.5 12h7M8.5 16h7"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2"/>'};
  const ic=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
  const MAIN=[["home","Home"],["plan","Practice"],["plays","Plays"],["cal","Calendar"],["team","Team"]],MORE=[["settings","Settings"]];
  const nav=document.createElement("nav");nav.className="bnav";nav.setAttribute("aria-label","Sections");
  nav.innerHTML=MAIN.map(([k,l])=>`<button type="button" data-bn="${k}">${ic(k)}<span>${l}</span></button>`).join("")+
    `<button type="button" data-bn="settings">${ic("settings")}<span>Settings</span></button><button type="button" data-bn="more" hidden aria-expanded="false">${ic("more")}<span>More</span></button>`+
    `<div class="bnav-more" hidden></div>`;
  app.appendChild(nav);
  const more=nav.querySelector(".bnav-more"),mb=nav.querySelector('[data-bn="more"]');
  const real=k=>document.getElementById("tab-"+k);
  const closeMore=()=>{more.hidden=true;mb.setAttribute("aria-expanded","false");};
  nav.addEventListener("click",e=>{const b=e.target.closest("[data-bn]");if(!b)return;const k=b.dataset.bn;
    if(k==="more"){more.hidden=!more.hidden;mb.setAttribute("aria-expanded",String(!more.hidden));return;}
    closeMore();const t=real(k);if(t){t.click();window.scrollTo({top:0});}});
  document.addEventListener("click",e=>{if(!more.hidden&&!e.target.closest(".bnav"))closeMore();});
  function sync(){
    let on=null;
    [...MAIN,...MORE].forEach(([k])=>{const t=real(k),b=nav.querySelector(`[data-bn="${k}"]`);if(!b)return;
      const shown=!!t&&!t.hidden&&getComputedStyle(t).display!=="none";b.hidden=!shown;
      const sel=t&&(t.getAttribute("aria-selected")==="true"||(k==="plan"&&real("lib")&&real("lib").getAttribute("aria-selected")==="true"));if(sel)on=k;b.classList.toggle("on",!!sel);if(sel)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
    mb.hidden=true;
  }
  const tabs=document.querySelector(".tabs");
  if(tabs)new MutationObserver(sync).observe(tabs,{subtree:true,attributes:true,attributeFilter:["aria-selected","hidden","style","class"]});
  sync();
})();

/* Practice plan | Drill library switch at the top of both pages. */
(function(){
  const go=k=>{const t=document.getElementById("tab-"+k);if(t)t.click();};
  document.addEventListener("click",e=>{const b=e.target.closest("[data-sub]");if(!b)return;go(b.dataset.sub);});
  const sync=()=>{const lib=document.getElementById("tab-lib"),ok=lib&&!lib.hidden&&getComputedStyle(lib).display!=="none",n=document.getElementById("drillCount");
    document.querySelectorAll(".subtabs").forEach(s=>{s.hidden=!ok;});
    document.querySelectorAll("[data-subn]").forEach(x=>{x.textContent=n?n.textContent.replace(/[()]/g,""):"";});};
  const tabs=document.querySelector(".tabs");if(tabs)new MutationObserver(sync).observe(tabs,{subtree:true,attributes:true,childList:true,characterData:true});
  sync();
})();
