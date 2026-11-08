/* Leaving a play with unsaved changes: ask to Save play, Save as draft, Discard changes or keep editing.
   Every way out of the editor goes through guardPlay(next): changing tabs, opening another play,
   New play, switching teams, and adding a play from a photo. Closing or reloading the app is covered
   by a copy kept on this device, offered back the next time the play designer opens.

   Drafts: a play that has never been saved is stored with draft:true (in the library with a Draft tag,
   left out of player links). A saved play keeps its saved version for staff and players; the draft
   rides along as draftCopy until Save play publishes it or Discard draft drops it. */
(function(){
const dlg=document.createElement("dialog");dlg.id="leaveDlg";dlg.setAttribute("aria-labelledby","leaveTitle");document.body.appendChild(dlg);
let pending=null;
const bar=document.createElement("div");bar.id="pDraftBar";bar.className="draft-bar";bar.hidden=true;
document.querySelector("#view-plays .pmeta").before(bar);
const when=t=>{const d=new Date(t);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" at "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});};
const canEditPlays=()=>typeof PERM!=="undefined"&&PERM.plays&&typeof db!=="undefined"&&db&&canWrite;

/* ---------- the prompt ---------- */
window.guardPlay=function(next){
  if(typeof pdirty==="undefined"||!pdirty||!canEditPlays())return true;
  if(dlg.open)return false;
  pending=next;
  const named=!!(play.name||"").trim();
  dlg.innerHTML=`<div class="dlg leave">
    <h2 id="leaveTitle">Save your changes${named?` to “${esc(play.name.trim())}”`:""}?</h2>
    <p class="help" style="margin:0">${play.draftOf||play.draft?"You've changed this draft since it was last saved.":play.id?"You've changed this play since it was last saved.":"This play hasn't been saved yet."} What would you like to do?</p>
    ${named?"":`<label class="f">Play name<input id="leaveName" placeholder="e.g. Horns flare" autocomplete="off"></label>`}
    <div class="leave-opts">
      <button class="btn primary" type="button" data-leave="save">Save play<small>${play.id&&!play.draft?"Update it in the play library":"Add it to the play library"}</small></button>
      <button class="btn" type="button" data-leave="draft">Save as draft<small>${play.id&&!play.draft?"Keep working on it later. Staff and players still see the saved version":"Keep working on it later. Players don't see drafts"}</small></button>
      <button class="btn danger" type="button" data-leave="discard">Discard changes<small>${play.id?"Go back to the last saved version":"Throw this play away"}</small></button>
    </div>
    <div class="msg" id="leaveMsg"></div>
    <div class="actions" style="margin:0"><button class="btn" type="button" data-leave="stay">Keep editing</button></div></div>`;
  dlg.showModal();
  return false;
};
function done(){dlg.close();const n=pending;pending=null;if(n)n();}
dlg.addEventListener("click",async e=>{
  if(e.target===dlg){dlg.close();pending=null;return;}
  const b=e.target.closest("[data-leave]");if(!b)return;
  const a=b.dataset.leave,nm=$("#leaveName");
  if(a==="stay"){dlg.close();pending=null;return;}
  if(nm&&nm.value.trim()){play.name=nm.value.trim();$("#pName").value=play.name;}
  if(a==="save"){
    if(!(play.name||"").trim()){msg($("#leaveMsg"),"Give the play a name first.","err");nm&&nm.focus();return;}
    b.disabled=true;const ok=await savePlay();b.disabled=false;
    if(ok)done();else msg($("#leaveMsg"),"Couldn't save. Check your connection, or save as a draft.","err");return;
  }
  if(a==="draft"){b.disabled=true;const ok=await saveDraft();b.disabled=false;if(ok)done();else msg($("#leaveMsg"),"Couldn't save the draft. Check your connection.","err");return;}
  if(a==="discard"){
    if(b.dataset.armed!=="1"){b.dataset.armed="1";b.firstChild.textContent="Tap again to discard";return;}
    const saved=play.id&&plays.find(x=>x.id===play.id);
    play=saved?playFromSaved(saved):blankPlay();fi=0;hist=[];pdirty=false;PLAY_LOCK=!!saved;clearPlayBackup();renderEditor();renderPlayLib();
    done();
  }
});

/* ---------- drafts ---------- */
window.playFromSaved=function(p){
  if(p.draftCopy){const d=p.draftCopy;return {id:p.id,name:d.name||p.name,type:d.type||p.type,notes:d.notes||"",frames:JSON.parse(JSON.stringify(d.frames||p.frames)),draftOf:{at:d.at,by:d.by}};}
  return JSON.parse(JSON.stringify(p));
};
async function saveDraft(){
  const id=play.id||uid()+uid(),saved=plays.find(x=>x.id===id),at=Date.now(),by=(typeof ME!=="undefined"&&ME.name)||"";
  let body;
  if(saved&&!saved.draft){
    const base={...saved};delete base.id;delete base.draftCopy;
    body={...base,draftCopy:{name:(play.name||"").trim()||saved.name,type:play.type,notes:play.notes||"",frames:play.frames,at,by}};
    play.draftOf={at,by};
  }else{
    if(!(play.name||"").trim())play.name="Untitled draft";
    body={name:play.name.trim(),type:play.type,notes:play.notes||"",frames:play.frames,draft:true,updatedAt:at,editedBy:by};
    play.draft=true;
  }
  try{await db.collection("plays").doc(id).set(body);}catch(err){handleWriteErr(err);return false;}
  play.id=id;pdirty=false;clearPlayBackup();
  const ex=plays.find(x=>x.id===id);if(ex){Object.keys(ex).forEach(k=>{if(k!=="id")delete ex[k];});Object.assign(ex,body);}else plays.push({id,...body});
  renderPlayLib();renderEditor();$("#pStatus").textContent="Saved as draft";
  return true;
}
async function discardDraft(){
  const saved=plays.find(x=>x.id===play.id);if(!saved)return;
  if(saved.draft){
    try{await db.collection("plays").doc(saved.id).delete();}catch(err){handleWriteErr(err);return;}
    plays=plays.filter(x=>x.id!==saved.id);play=blankPlay();
  }else{
    const body={...saved};delete body.id;delete body.draftCopy;
    try{await db.collection("plays").doc(saved.id).set(body);}catch(err){handleWriteErr(err);return;}
    delete saved.draftCopy;play=JSON.parse(JSON.stringify(saved));
  }
  fi=0;hist=[];pdirty=false;clearPlayBackup();renderEditor();renderPlayLib();renderPickCats();renderPick();
}

/* ---------- a copy on this device, in case the app is closed mid-edit ---------- */
const bkKey=()=>typeof team!=="undefined"&&team?"cpp:playBackup:"+team.id:null;
let bkTimer=null,offered=null;
function writeBackup(){clearTimeout(bkTimer);bkTimer=null;const k=bkKey();if(!k||!pdirty||!play)return;try{localStorage.setItem(k,JSON.stringify({at:Date.now(),play}));}catch{}}
window.clearPlayBackup=function(){clearTimeout(bkTimer);bkTimer=null;const k=bkKey();try{if(k)localStorage.removeItem(k);}catch{}};
function readBackup(){const k=bkKey();try{return k&&JSON.parse(localStorage.getItem(k)||"null");}catch{return null;}}
const _markDirty=markDirty;
markDirty=function(){_markDirty();if(!bkTimer)bkTimer=setTimeout(writeBackup,800);updateBar();};
window.addEventListener("pagehide",writeBackup);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")writeBackup();});
window.addEventListener("beforeunload",e=>{if(pdirty&&canEditPlays()){writeBackup();e.preventDefault();e.returnValue="";}});

/* ---------- the bar above the board ---------- */
function updateBar(){
  if(typeof play==="undefined"||!play){bar.hidden=true;return;}
  const bk=!pdirty&&canEditPlays()&&readBackup();
  if(bk&&bk.play&&offered!==bk.at){
    bar.innerHTML=`<span><b>Unsaved changes found</b> to “${esc(bk.play.name||"Untitled play")}” from ${when(bk.at)}, left when the app closed.</span>
      <span class="draft-acts"><button class="btn primary" type="button" data-dbar="restore">Restore</button><button class="btn" type="button" data-dbar="forget">Discard</button></span>`;
    bar.className="draft-bar warn";bar.hidden=false;return;
  }
  if(play.draftOf){
    bar.innerHTML=`<span><b>Draft</b> from ${when(play.draftOf.at)}${play.draftOf.by?" by "+esc(play.draftOf.by):""}. Staff and players still see the saved version until you tap Save play.</span>
      ${canEditPlays()?`<span class="draft-acts"><button class="btn" type="button" data-dbar="drop">Discard draft</button></span>`:""}`;
    bar.className="draft-bar";bar.hidden=false;return;
  }
  if(play.draft){
    bar.innerHTML=`<span><b>Draft.</b> Not in your playbook for players yet. Tap Save play when it's ready.</span>
      ${canEditPlays()?`<span class="draft-acts"><button class="btn" type="button" data-dbar="drop">Delete draft</button></span>`:""}`;
    bar.className="draft-bar";bar.hidden=false;return;
  }
  bar.hidden=true;
}
const _renderEditor=renderEditor;
renderEditor=function(){_renderEditor();updateBar();if(play&&(play.draftOf||play.draft)&&!pdirty)$("#pStatus").textContent="Draft";};
bar.addEventListener("click",async e=>{
  const b=e.target.closest("[data-dbar]");if(!b)return;
  const a=b.dataset.dbar;
  if(a==="restore"){const bk=readBackup();if(!bk)return;offered=bk.at;play=bk.play;fi=0;hist=[];pdirty=true;PLAY_LOCK=false;renderEditor();renderPlayLib();$("#pStatus").textContent="Restored: unsaved changes";return;}
  if(a==="forget"){const bk=readBackup();offered=bk&&bk.at;clearPlayBackup();updateBar();return;}
  if(a==="drop"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent=play.draft?"Tap again to delete":"Tap again to discard";return;}await discardDraft();}
});
/* View mode buttons. Done with unsaved changes asks first, like leaving the play. */
$("#pEditBtn").addEventListener("click",()=>{lockPlay(false);if(window.autoFull)autoFull();pflash("Editing. Tap Save play when you're done, or Done to lock it again.");});
const doneFull=()=>{if(FS.auto)exitFull();};
$("#pDoneBtn").addEventListener("click",()=>{if(!guardPlay(()=>{lockPlay(true);doneFull();}))return;lockPlay(true);doneFull();});
/* Check for a left-behind copy whenever the play designer is opened. */
const _setTab=setTab;
setTab=function(t){_setTab(t);if(t==="plays")updateBar();};
})();
