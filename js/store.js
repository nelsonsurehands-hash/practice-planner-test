/* Storage adapters. Both expose the same small API the planner uses:
     store.collection(kind).doc(id).set(body) / .delete()
     store.collection(kind).onSnapshot(next, error) -> unsubscribe
     store.bulkSet(kind, [[id, body], ...])
   kind is "drills", "plans" or "plays". */

function makeSnap(map){
  const docs=Object.keys(map).sort().map(id=>({id,exists:true,data:()=>map[id]}));
  return {docs,size:docs.length,empty:!docs.length,metadata:{hasPendingWrites:false,fromCache:false}};
}
const deepCopy=o=>JSON.parse(JSON.stringify(o));

/* ---------- Demo mode: everything stays in this browser ---------- */
function localStore(teamId){
  const key=k=>`cpp:${teamId}:${k}`;
  const read=k=>{try{return JSON.parse(localStorage.getItem(key(k))||"{}")}catch{return {}}};
  const write=(k,m)=>{try{localStorage.setItem(key(k),JSON.stringify(m));}catch(e){throw {code:"quota_exceeded",message:"Browser storage is full."};}};
  const listeners={};
  const emit=k=>(listeners[k]||[]).forEach(cb=>cb(makeSnap(read(k))));
  const onStorage=e=>{if(e.key&&e.key.startsWith(`cpp:${teamId}:`))emit(e.key.split(":").pop());};
  window.addEventListener("storage",onStorage);
  return {
    mode:"local",
    collection(k){return {
      doc(id){return {
        async set(body){const m=read(k);m[id]=deepCopy(body);write(k,m);emit(k);},
        async delete(){const m=read(k);delete m[id];write(k,m);emit(k);}
      };},
      onSnapshot(cb){(listeners[k]=listeners[k]||[]).push(cb);setTimeout(()=>cb(makeSnap(read(k))),0);
        return ()=>{listeners[k]=(listeners[k]||[]).filter(x=>x!==cb);};}
    };},
    async bulkSet(k,entries){const m=read(k);entries.forEach(([id,b])=>{m[id]=deepCopy(b);});write(k,m);emit(k);},
    close(){window.removeEventListener("storage",onStorage);}
  };
}

/* ---------- Hosted mode: Supabase table "items" ---------- */
function supabaseStore(sb,teamId,userId){
  const cache={}, listeners={}, loading={};
  let pchan=null, pcb=null, pstate=null, psub=false;
  const emit=k=>{if(cache[k])(listeners[k]||[]).forEach(cb=>cb(makeSnap(cache[k])));};
  const fail=e=>({code:e&&/permission|row-level|policy/i.test(e.message||"")?"invalid_argument":"unavailable",message:(e&&e.message)||"Network error"});
  async function load(k){
    const {data,error}=await sb.from("items").select("id,data").eq("team_id",teamId).eq("kind",k).limit(5000);
    if(error)throw fail(error);
    cache[k]=Object.fromEntries(data.map(r=>[r.id,r.data]));emit(k);
  }
  const channel=sb.channel("items-"+teamId)
    .on("postgres_changes",{event:"*",schema:"public",table:"items",filter:`team_id=eq.${teamId}`},payload=>{
      const row=payload.eventType==="DELETE"?payload.old:payload.new;
      if(!row||!row.kind||!cache[row.kind])return;
      if(payload.eventType==="DELETE")delete cache[row.kind][row.id];else cache[row.kind][row.id]=row.data;
      emit(row.kind);
    }).subscribe();
  // Catch up when the app comes back to the foreground (phones pause sockets).
  const refresh=()=>{if(document.visibilityState==="visible")Object.keys(listeners).forEach(k=>{if((listeners[k]||[]).length)load(k).catch(()=>{});});};
  document.addEventListener("visibilitychange",refresh);
  return {
    mode:"supabase",
    collection(k){return {
      doc(id){return {
        async set(body){
          const {error}=await sb.from("items").upsert({team_id:teamId,kind:k,id,data:body,updated_at:new Date().toISOString(),updated_by:userId});
          if(error)throw fail(error);
          if(cache[k]){cache[k][id]=deepCopy(body);emit(k);}
        },
        async delete(){
          const {error}=await sb.from("items").delete().eq("team_id",teamId).eq("kind",k).eq("id",id);
          if(error)throw fail(error);
          if(cache[k]){delete cache[k][id];emit(k);}
        }
      };},
      onSnapshot(cb,err){
        (listeners[k]=listeners[k]||[]).push(cb);
        if(cache[k])setTimeout(()=>cb(makeSnap(cache[k])),0);
        else if(!loading[k])loading[k]=load(k).catch(e=>{loading[k]=null;err&&err(e);});
        return ()=>{listeners[k]=(listeners[k]||[]).filter(x=>x!==cb);};
      }
    };},
    async bulkSet(k,entries){
      const now=new Date().toISOString();
      for(let i=0;i<entries.length;i+=200){
        const rows=entries.slice(i,i+200).map(([id,data])=>({team_id:teamId,kind:k,id,data,updated_at:now,updated_by:userId}));
        const {error}=await sb.from("items").upsert(rows);if(error)throw fail(error);
      }
      await load(k);
    },
    /* Who else on the staff has the planner open, and where. */
    presence(state){pstate=state;ensurePresence();if(psub)pchan.track(state).catch(()=>{});},
    onPresence(cb){pcb=cb;ensurePresence();},
    close(){sb.removeChannel(channel);if(pchan)sb.removeChannel(pchan);document.removeEventListener("visibilitychange",refresh);}
  };
  function ensurePresence(){
    if(pchan)return;
    pchan=sb.channel("presence-"+teamId,{config:{presence:{key:userId}}});
    pchan.on("presence",{event:"sync"},()=>{
      if(!pcb)return;
      const st=pchan.presenceState();
      pcb(Object.values(st).map(a=>a[a.length-1]).filter(Boolean));
    });
    pchan.subscribe(status=>{if(status==="SUBSCRIBED"){psub=true;if(pstate)pchan.track(pstate).catch(()=>{});}});
  }
}
