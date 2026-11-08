/* Title capitalization for names coaches type (drills, plays, opponents, events, team names).
   "box out shell drill" -> "Box Out Shell Drill", "pick and roll" -> "Pick and Roll",
   "2-man weave" -> "2-Man Weave". Words someone typed with capitals on purpose (JV, 2-3, McDonald)
   are left alone. A title typed in ALL CAPS is changed to Title Case, keeping short acronyms. */
(function(root){
const SMALL=new Set(["a","an","the","and","but","or","nor","for","of","on","in","at","to","by","as","vs","vs.","v","v.","with","off","per","via","from","into","over","up"]);
function capPart(p,edge){
  if(!/^[^A-Za-z]*[a-z]/.test(p)||/[A-Z]/.test(p))return p;          // nothing to do, or capitals typed on purpose
  if(!edge&&SMALL.has(p.toLowerCase()))return p.toLowerCase();
  return p.replace(/[a-z]/,c=>c.toUpperCase());
}
function titleCase(s){
  s=String(s==null?"":s);if(!/[a-z]/i.test(s))return s;
  /* ALL CAPS title (more than a short acronym): lower it first, keep words of 3 letters or fewer */
  if(!/[a-z]/.test(s)&&(s.match(/[A-Z]{4,}/g)||[]).length)s=s.replace(/[A-Z]{4,}/g,w=>w.toLowerCase());
  const words=s.split(/(\s+)/),idx=words.map((w,i)=>/\S/.test(w)?i:-1).filter(i=>i>=0),first=idx[0],last=idx[idx.length-1];
  return words.map((w,i)=>{if(!/\S/.test(w))return w;
    const parts=w.split("-");return parts.map((p,j)=>capPart(p,(i===first&&j===0)||(i===last&&j===parts.length-1)||j===0&&/[:(]$/.test(words[i-2]||""))).join("-");}).join("");
}
root.titleCase=titleCase;
/* Any field marked data-tc fixes its capitalization when you leave it. */
if(typeof document!=="undefined")document.addEventListener("change",e=>{const t=e.target;if(!t||!t.matches||!t.matches("input[data-tc]"))return;
  const v=titleCase(t.value);if(v!==t.value){t.value=v;t.dispatchEvent(new Event("input",{bubbles:true}));}},true);
})(typeof window!=="undefined"?window:globalThis);
