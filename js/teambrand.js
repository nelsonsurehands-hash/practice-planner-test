/* Parent-facing pages (schedule, food sign-up, playbook) wear the team's brand, not the app's:
   browser-tab icon, home-screen icon and phone status-bar color all come from the team.
   No logo uploaded? A clean monogram in the team color (e.g. "HH") stands in. */
window.teamBrand=function(t,title){
  t=t||{};
  const color=/^#[0-9a-f]{6}$/i.test(t.color||"")?t.color:"#5b2a86";
  const tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.content=color;
  if(title)document.title=title;
  const put=(rel,href)=>{document.querySelectorAll(`link[rel="${rel}"]`).forEach(l=>l.remove());
    const l=document.createElement("link");l.rel=rel;l.href=href;document.head.appendChild(l);};
  if(t.logo){put("icon",t.logo);put("apple-touch-icon",t.logo);return;}
  const words=String(t.school||t.name||"Team").replace(/[^A-Za-z0-9 ]/g," ").trim().split(/\s+/).filter(w=>!/^(the|of|and|middle|school|ms|jr|high)$/i.test(w));
  const ini=(words.length>1?words[0][0]+words[1][0]:(words[0]||"T").slice(0,2)).toUpperCase();
  const n=parseInt(color.slice(1),16),lum=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});
  const ink=.2126*lum[0]+.7152*lum[1]+.0722*lum[2]>.4?"#17141c":"#ffffff";
  const draw=()=>{const c=document.createElement("canvas");c.width=c.height=180;const x=c.getContext("2d");
    x.fillStyle=color;x.beginPath();if(x.roundRect)x.roundRect(0,0,180,180,40);else x.rect(0,0,180,180);x.fill();
    x.fillStyle=ink;x.textAlign="center";x.textBaseline="middle";x.font=`800 ${ini.length>1?96:112}px "Saira Condensed",system-ui,sans-serif`;
    x.fillText(ini,90,96);const url=c.toDataURL("image/png");put("icon",url);put("apple-touch-icon",url);};
  const f=document.fonts&&document.fonts.load?document.fonts.load('800 96px "Saira Condensed"'):Promise.resolve();
  f.catch(()=>{}).then(draw);
};
window.teamFullName=function(t){t=t||{};const base=t.school&&t.mascot?`${t.school} ${t.mascot}`:(t.school||t.name||"Team"),g=t.teamLabel||"";
  return g&&!base.toLowerCase().includes(g.toLowerCase())?`${base} ${g}`:base;};
/* Opened from the installed coach app (home-screen app), these pages have no browser bar, so give a way back. */
(function(){
  const standalone=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
  if(!standalone)return;
  const add=()=>{if(document.getElementById("backToApp"))return;
    const b=document.createElement("button");b.type="button";b.id="backToApp";b.className="back-to-app";b.innerHTML="<span aria-hidden=\"true\">‹</span> Back to app";
    b.addEventListener("click",()=>{if(history.length>1)history.back();else location.href="/";setTimeout(()=>{location.href="/";},400);});
    document.body.prepend(b);document.body.classList.add("has-back");};
  if(document.body)add();else document.addEventListener("DOMContentLoaded",add);
})();
