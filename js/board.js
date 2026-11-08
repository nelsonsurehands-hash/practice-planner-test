/* Shared play-board drawing and play-through math.
   Used by the coach app (app.js) and the player playbook page (playbook.html).
   Needs sports.js loaded first and a global SPORT naming the current sport. */
const $=s=>document.querySelector(s);

const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const VB={x:-30,y:-45,w:560,h:530};

const clone=o=>JSON.parse(JSON.stringify(o));

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function qpt(a,t){const u=1-t;return {x:u*u*a.x1+2*u*t*a.cx+t*t*a.x2,y:u*u*a.y1+2*u*t*a.cy+t*t*a.y2};}
function samples(a){
  let pts=[];for(let i=0;i<=40;i++)pts.push(qpt(a,i/40));
  const s=pts[0],e=pts[pts.length-1];
  if(a.from)while(pts.length>3&&dist(pts[1],s)<17)pts.shift();
  if(a.to)while(pts.length>3&&dist(pts[pts.length-2],e)<19)pts.pop();
  return pts;
}
function resample(pts,step){
  const out=[pts[0]];let acc=0;
  for(let i=1;i<pts.length;i++){let a=pts[i-1],b=pts[i],d=dist(a,b);
    while(acc+d>=step){const t=(step-acc)/d;const p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};out.push(p);a=p;d=dist(a,b);acc=0;}
    acc+=d;}
  out.push(pts[pts.length-1]);return out;
}
const poly=pts=>pts.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join("");
function arrowHead(pts,col){
  const e=pts[pts.length-1],p=pts[Math.max(0,pts.length-3)];
  const ang=Math.atan2(e.y-p.y,e.x-p.x),L=13,s=.45;
  const a={x:e.x-L*Math.cos(ang-s),y:e.y-L*Math.sin(ang-s)},b={x:e.x-L*Math.cos(ang+s),y:e.y-L*Math.sin(ang+s)};
  return `<path d="M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${e.x.toFixed(1)} ${e.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}Z" style="fill:${col};stroke:${col};stroke-width:1.5;stroke-linejoin:round"/>`;
}
/* A "look": a pass the ball carrier can make (1st look, 2nd look…). Drawn like a pass in the look
   color with its number; it doesn't move the ball. */
var LOOK_LIT;   // while a play runs: how many looks are lit (in order); undefined = all
function lookSVG(a,n,P){
  const col=P?"#000":"var(--look,#e07a10)",x1=a.x1,y1=a.y1,x2=a.x2,y2=a.y2,ang=Math.atan2(y2-y1,x2-x1),pad=17;
  const ex=x2-pad*Math.cos(ang),ey=y2-pad*Math.sin(ang),pts=[{x:x1,y:y1},{x:(x1+ex)/2,y:(y1+ey)/2},{x:ex,y:ey}];
  const bx=x1+(ex-x1)*.55,by=y1+(ey-y1)*.55;
  const lit=typeof LOOK_LIT==="number"?LOOK_LIT:99,op=n>lit?0.18:1,halo=n===lit&&!P?`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="16" style="fill:none;stroke:${col};stroke-width:2;opacity:.45"/>`:"";
  return `<g class="look" style="opacity:${op}">${halo}<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}" style="fill:none;stroke:${col};stroke-width:2.6;stroke-linecap:round;stroke-dasharray:4 6"/>${arrowHead(pts,col)}
    <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="10" style="fill:${P?"#fff":col};stroke:${P?"#000":"var(--surface,#fff)"};stroke-width:2"/><text x="${bx.toFixed(1)}" y="${(by+4.2).toFixed(1)}" text-anchor="middle" style="fill:${P?"#000":"#fff"};font:800 12px Arial,Helvetica,sans-serif">${n}</text></g>`;
}
function actSVG(a,col){
  if(a.type==="look")return "";   // drawn separately with its number
  if(a.type==="pass")a={...a,cx:(a.x1+a.x2)/2,cy:(a.y1+a.y2)/2};   // passes are always straight
  const pts=samples(a), base=`style="fill:none;stroke:${col};stroke-width:3;stroke-linecap:round;stroke-linejoin:round`;
  if(a.type==="cut")return `<path d="${poly(pts)}" ${base}"/>`+arrowHead(pts,col);
  if(a.type==="pass")return `<path d="${poly(pts)}" ${base};stroke-dasharray:9 7"/>`+arrowHead(pts,col);
  if(a.type==="shot")return `<path d="${poly(pts)}" ${base};stroke-width:3.5;stroke-dasharray:0.1 8"/>`+arrowHead(pts,col)+
    `<circle cx="${a.x2}" cy="${a.y2}" r="12" style="fill:none;stroke:${col};stroke-width:2;stroke-dasharray:3 3"/>`;
  if(a.type==="dribble"){
    const r=resample(pts,7), zz=[r[0]];
    for(let i=1;i<r.length-3;i++){const p=r[i-1],q=r[i+1]||r[i];const ang=Math.atan2(q.y-p.y,q.x-p.x)+Math.PI/2,o=(i%2?5.5:-5.5);zz.push({x:r[i].x+o*Math.cos(ang),y:r[i].y+o*Math.sin(ang)});}
    zz.push(...r.slice(-3));
    return `<path d="${poly(zz)}" ${base};stroke-width:2.5"/>`+arrowHead(pts,col);
  }
  if(a.type==="screen"){
    const e=pts[pts.length-1],p=pts[Math.max(0,pts.length-3)],ang=Math.atan2(e.y-p.y,e.x-p.x)+Math.PI/2;
    return `<path d="${poly(pts)}" ${base}"/><path d="M${(e.x+12*Math.cos(ang)).toFixed(1)} ${(e.y+12*Math.sin(ang)).toFixed(1)}L${(e.x-12*Math.cos(ang)).toFixed(1)} ${(e.y-12*Math.sin(ang)).toFixed(1)}" ${base};stroke-width:4"/>`;
  }
  return "";
}
/* Court looks (saved on this device): Hardwood (default), Whiteboard, or Classic (the app's colors).
   Hardwood and Whiteboard are for courts; field sports always use Classic. */
const LOOKS={wood:"Hardwood",board:"Whiteboard",classic:"Classic"};
function courtLook(){let v="";try{v=localStorage.getItem("cpp:courtLook")||"";}catch(e){}
  if(!["basketball","volleyball"].includes(typeof SPORT==="string"?SPORT:"basketball"))return "classic";return LOOKS[v]?v:"wood";}
function setCourtLook(v){try{localStorage.setItem("cpp:courtLook",v);}catch(e){}}
function lookColors(){const L=courtLook();
  if(L==="wood")return {wood:true,out:"color-mix(in srgb,var(--team,#5b2a86) 62%,#1a1020)",floor:"url(#cpWood)",line:"#fffdf8",o:"var(--team-ink,#fff)",ofill:"var(--team,#5b2a86)",d:"#1d1720",act:"#1d1720",ball:"#e2672a",paint:"color-mix(in srgb,var(--team,#5b2a86) 86%,transparent)"};
  if(L==="board")return {out:"#eef1f7",floor:"#ffffff",line:"#172a5e",o:"#172a5e",ofill:"#ffffff",d:"#b3261e",act:"#172a5e",ball:"#e2672a",paint:"#e3e9f4"};
  return {out:"var(--court-out)",floor:"var(--court)",line:"var(--court-line)",o:"var(--accent)",ofill:"var(--surface)",d:"var(--ink)",act:"var(--ink)",ball:"var(--ball)",paint:"var(--court-paint)"};}
function boardInner(fr,mode,tmp,fade,ghost){
  const P=mode==="print";
  const c=P?{out:"#fff",floor:"#fff",line:"#000",o:"#000",ofill:"#fff",d:"#000",act:"#000",ball:"#000",paint:"#fff"}:lookColors();
  let s=courtSVG(SPORT,c);
  if(ghost&&ghost.length)s+=`<g style="opacity:.22">`+ghost.map(a=>actSVG(a,c.act)).join("")+`</g>`;
  const acts=[...fr.actions];if(tmp)acts.push(tmp);
  s+=`<g style="opacity:${fade?0.3:1}">`+acts.map(a=>actSVG(a,c.act)).join("")+`</g>`;
  if(!fade&&hasOrder(fr)){const L=seqList(fr);if(L.length&&L[L.length-1].beat>1)s+=`<g class="beats">`+L.map(x=>beatBadge(x.a,x.beat,P)).join("")+`</g>`;}
  {let n=0;const looks=acts.filter(a=>a.type==="look");if(looks.length)s+=`<g class="looks${fade?" faded":""}">`+looks.map(a=>lookSVG(a,++n,P)).join("")+`</g>`;}
  fr.tokens.filter(t=>t.kind!=="ball").forEach(t=>{
    if(t.kind==="o")s+=`<g><circle cx="${t.x}" cy="${t.y}" r="15" style="fill:${c.ofill};stroke:${c.o};stroke-width:3"/><text x="${t.x}" y="${t.y+6.5}" text-anchor="middle" style="fill:${c.o};font:700 ${lblSize(t)}px Arial,Helvetica,sans-serif">${esc(t.label||t.n)}</text></g>`;
    else s+=`<text x="${t.x}" y="${t.y+7}" text-anchor="middle" style="fill:${c.d};font:700 20px Arial,Helvetica,sans-serif">X<tspan style="font-size:12px" dy="3">${t.n}</tspan></text>`;
  });
  const b=fr.tokens.find(t=>t.kind==="ball");
  if(b)s+=`<circle cx="${b.x}" cy="${b.y}" r="7.5" style="fill:${c.ball};stroke:${P?"#000":c.floor==="var(--court)"?"var(--ink)":"#1d1720"};stroke-width:1.5"/>`;
  return s;
}
/* The step number of an action, in a small square on its line (only when the coach set the order). */
function beatBadge(a,n,P){
  const C=P?null:lookColors(),bf=P?"#fff":C.floor==="var(--court)"?"var(--ink)":C.act,bt=P?"#000":C.floor==="var(--court)"?"var(--court)":"#fff";
  const q=a.type==="pass"?{x:(a.x1+a.x2)/2,y:(a.y1+a.y2)/2}:qpt(a,.5),x=q.x.toFixed(1),y=q.y.toFixed(1);
  return `<g><rect x="${(q.x-8.5).toFixed(1)}" y="${(q.y-8.5).toFixed(1)}" width="17" height="17" rx="4" style="fill:${bf};stroke:${bt};stroke-width:${P?1.4:2}"/><text x="${x}" y="${(q.y+4.2).toFixed(1)}" text-anchor="middle" style="fill:${bt};font:800 11.5px Arial,Helvetica,sans-serif">${n}</text></g>`;
}
function lblSize(t){const n=String(t.label||t.n).length;return n>=3?10.5:n===2?14:18;}
function boardSVG(fr,mode,w){fr=withDefense(fr,fr.defense);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}"${w?` width="${w}" height="${Math.round(w*VB.h/VB.w)}"`:""}>${boardInner(fr,mode)}</svg>`;}


/* Cuts, dribbles and screens move a player; passes and shots only move the ball. */
const isMove=a=>a.type!=="pass"&&a.type!=="shot"&&a.type!=="look";
function holderOf(fr){const b=fr.tokens.find(t=>t.kind==="ball");if(!b)return null;let h=null,bd=26;fr.tokens.forEach(t=>{if(t.kind==="o"){const d=dist(b,t);if(d<bd){bd=d;h=t;}}});return h;}

function nextTokens(f){
  const toks=clone(f.tokens),ball=toks.find(t=>t.kind==="ball"),h=holderOf(f);
  f.actions.forEach(a=>{
    if(a.from&&isMove(a)){const t=toks.find(x=>x.id===a.from);if(t){
      if(ball&&h&&h.id===t.id){ball.x=a.x2+13;ball.y=a.y2-13;}
      t.x=a.x2;t.y=a.y2;}}
  });
  f.actions.filter(a=>a.type==="pass").forEach(a=>{
    if(!ball)return;const r=a.to&&toks.find(x=>x.id===a.to);
    if(r){ball.x=r.x+13;ball.y=r.y-13;}else{ball.x=a.x2;ball.y=a.y2;}
  });
  f.actions.filter(a=>a.type==="shot").forEach(a=>{if(ball){ball.x=a.x2;ball.y=a.y2;}});
  return toks;
}

/* ---------- order of actions inside a step ----------
   a.beat = 1, 2, 3…: actions with the same number happen at the same time; a higher number waits
   until the lower ones finish. A step with no numbers uses automatic timing (screens first, then cuts
   and passes together). autoBeats shows that automatic order as numbers, so a coach can start from it. */
const seqActs=f=>(f.actions||[]).filter(a=>a.type!=="look");
const hasOrder=f=>seqActs(f).some(a=>a.beat);
function packBeats(B){const u=[...new Set(B.filter(b=>b>0))].sort((x,y)=>x-y);return B.map(b=>b>0?u.indexOf(b)+1:0);}
function autoBeats(f){
  const A=f.actions||[],B=A.map(()=>0),h=holderOf(f),mv=id=>A.findIndex(a=>a.from===id&&isMove(a));
  A.forEach((a,i)=>{if(a.type==="screen"&&a.from)B[i]=1;});
  const base=B.some(Boolean)?2:1;let cur=base;
  const passes=A.map((a,i)=>i).filter(i=>A[i].type==="pass"),shot=A.findIndex(a=>a.type==="shot");
  if(h&&(passes.length||shot>=0)){const m=mv(h.id);if(m>=0&&!B[m]){B[m]=cur;cur++;}}
  passes.forEach(i=>{const a=A[i];B[i]=cur;const m=a.to?mv(a.to):-1;
    if(m>=0&&!B[m]){if(A[m].type==="dribble"){B[m]=cur+1;cur++;}else B[m]=cur;}
    cur++;});
  if(shot>=0)B[shot]=cur;
  A.forEach((a,i)=>{if(!B[i]&&a.type!=="look")B[i]=base;});
  return packBeats(B);
}
/* Beat of every action (0 for looks). New actions added after the order was set go last. */
function beatsOf(f){
  const A=f.actions||[];if(!hasOrder(f))return autoBeats(f);
  let mx=Math.max(0,...A.map(a=>a.type!=="look"&&a.beat||0));
  return packBeats(A.map(a=>a.type==="look"?0:(a.beat||++mx)));
}
/* The step's actions in the order they happen: [{a, i (index in actions), beat}] */
function seqList(f){const B=beatsOf(f);return (f.actions||[]).map((a,i)=>({a,i,beat:B[i]})).filter(x=>x.beat).sort((x,y)=>x.beat-y.beat||x.i-y.i);}

const ease=u=>u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;

function buildTransition(frames,i){
  const f=frames[i], last=i===frames.length-1;
  const g=last?nextTokens(f):frames[i+1].tokens;
  const b0=f.tokens.find(t=>t.kind==="ball"),b1=g.find(t=>t.kind==="ball"),h=holderOf(f);
  const hasTok=id=>f.tokens.some(x=>x.id===id);
  const anyMove=f.tokens.some(t=>{if(t.kind==="ball")return false;const e=g.find(x=>x.id===t.id);return e&&dist(t,e)>1;});

  /* Ball events in order: the passes, then a shot. */
  const ord=hasOrder(f),BT=ord?beatsOf(f):null,nB=ord?Math.max(1,...BT):1,beatOf=a=>{const j=f.actions.indexOf(a);return j>=0&&BT[j]?BT[j]:nB;};
  const events=ord?seqList(f).filter(x=>x.a.type==="pass"||x.a.type==="shot").map(x=>x.a)
                  :f.actions.filter(a=>a.type==="pass").concat(f.actions.filter(a=>a.type==="shot"));
  const off0=b0&&h?{x:b0.x-h.x,y:b0.y-h.y}:{x:13,y:-13};
  const start0=b0?(h?{id:h.id,first:true}:{pt:{x:b0.x,y:b0.y}}):null;
  /* No pass drawn but the next step has the ball somewhere else: fly it there. */
  if(b0&&b1&&!events.length){
    const hd=h&&f.actions.find(a=>a.from===h.id&&isMove(a));
    const e=h?(hd?{x:hd.x2+13,y:hd.y2-13}:{x:b0.x,y:b0.y}):{x:b0.x,y:b0.y};
    if(dist(e,b1)>2)events.push({type:"pass",to:null,x1:e.x,y1:e.y,x2:b1.x,y2:b1.y,cx:(e.x+b1.x)/2,cy:(e.y+b1.y)/2});
  }

  /* Timeline (0..1). Passes happen DURING the movement, not after it: each ball event gets an equal
     slice and flies in the back half of it. A cutter who receives a pass finishes the cut right as the
     ball arrives; a player who catches and then dribbles starts after the catch; the starting ball
     handler drives first, then passes. Everyone else moves across the whole step. */
  const k=events.length,L=anyMove?0.5:0;
  /* Screens happen first: screeners get to their spot, then the cuts, dribbles and passes run. */
  const S=f.actions.some(a=>a.type==="screen"&&a.from)?0.42:0,sq=x=>S+x*(1-S);
  let win=events.map((a,n)=>({s:sq((n+L)/Math.max(k,1)),e:sq((n+1)/Math.max(k,1))}));
  /* Your order: each beat gets an equal slice of the step. A pass thrown while players move flies in the
     back half of its beat (so a cutter catches it as the cut ends); passes in the same beat share it. */
  if(ord){
    win=events.map((a,n)=>{
      if(!f.actions.includes(a))return {s:(nB-.5)/nB,e:1};   // ball flown to where the next step has it
      const b=beatOf(a),same=events.filter(x=>f.actions.includes(x)&&beatOf(x)===b),m=same.length,j=same.indexOf(a);
      const w0=(b-1)/nB,len=1/nB,busy=f.actions.some(x=>isMove(x)&&x.from&&beatOf(x)===b);
      return {s:w0+len*(j+(busy?.5:0))/m,e:w0+len*(j+1)/m};
    });
  }
  const recv=id=>events.findIndex(a=>a.type==="pass"&&a.to===id);
  const sends=(id,after)=>events.findIndex((a,n)=>n>after&&a.from===id);
  const windowFor=(id,act)=>{
    if(ord)return act?[(beatOf(act)-1)/nB,beatOf(act)/nB]:[0,1];
    if(S&&act&&act.type==="screen")return [0,S];
    const w=windowRaw(id,act);return S?[sq(w[0]),sq(w[1])]:w;
  };
  const windowRaw=(id,act)=>{
    if(!k||!act)return [0,1];
    const r=recv(id);
    if(r>=0){
      if(act.type==="dribble"){const nx=sends(id,r);return [win[r].e,nx>=0?win[nx].s:1];}
      return [0,win[r].e];
    }
    if(h&&id===h.id){const nx=sends(id,-1);if(nx>=0)return [0,Math.max(win[nx].s,.05)];}
    return [0,1];
  };
  const paths={};let moves=false;
  f.tokens.forEach(t=>{
    if(t.kind==="ball")return;
    const e=g.find(x=>x.id===t.id);
    if(!e){paths[t.id]=null;return;}
    const a=f.actions.find(a=>a.from===t.id&&isMove(a)&&Math.hypot(a.x2-e.x,a.y2-e.y)<3);
    if(a||dist(t,e)>1)moves=true;
    const raw=a?(v=>qpt(a,v)):(v=>({x:t.x+(e.x-t.x)*v,y:t.y+(e.y-t.y)*v}));
    const [w0,w1]=windowFor(t.id,a);
    paths[t.id]=u=>raw(ease(Math.min(1,Math.max(0,(u-w0)/((w1-w0)||1)))));   // u is raw step time
  });
  const posAt=(id,u)=>{const p=paths[id];if(p)return p(u);const t=f.tokens.find(x=>x.id===id);return t?{x:t.x,y:t.y}:null;};
  const holderMoves=!!(h&&paths[h.id]&&f.actions.some(a=>a.from===h.id&&isMove(a)));
  const carry=(c,u)=>{
    if(!c)return null;
    if(c.pt)return c.pt;
    const p=posAt(c.id,u);if(!p)return null;
    let o={x:13,y:-13};
    if(c.first){if(holderMoves){const [w0,w1]=windowFor(h.id,f.actions.find(a=>a.from===h.id&&isMove(a)));const v=Math.min(1,Math.max(0,(u-w0)/((w1-w0)||1)));o={x:off0.x+(13-off0.x)*v,y:off0.y+(-13-off0.y)*v};}else o=off0;}
    return {x:p.x+o.x,y:p.y+o.y};
  };
  const ballAt=u=>{
    if(!b0)return null;
    let c=start0;
    for(let n=0;n<k;n++){
      const a=events[n],{s:s0,e:e0}=win[n];
      const toId=a.type==="pass"&&a.to&&hasTok(a.to)?a.to:null;
      if(u<s0)return carry(c,u);
      if(u<e0){
        const A=carry(c,s0)||{x:a.x1,y:a.y1},B=toId?carry({id:toId},u):{x:a.x2,y:a.y2},v=ease((u-s0)/((e0-s0)||1));
        const bend=a.type==="shot"?{x:a.cx-(a.x1+a.x2)/2,y:a.cy-(a.y1+a.y2)/2}:{x:0,y:0};
        return qpt({x1:A.x,y1:A.y,cx:(A.x+B.x)/2+bend.x,cy:(A.y+B.y)/2+bend.y,x2:B.x,y2:B.y},v);
      }
      c=toId?{id:toId}:{pt:{x:a.x2,y:a.y2}};
    }
    return carry(c,u);
  };
  return {i,f,g,paths,ballAt,ballMove:ballAt,passCurve:null,moves:moves||!!(b0&&k),
    moveDur:ord?DUR.move*Math.max(1,0.45+0.55*nB):DUR.move*Math.max(1,0.5+0.5*k)*(S?1.35:1),last,added:g.filter(t=>!f.tokens.some(x=>x.id===t.id))};
}
function animTokens(tr,phase,u){
  const out=[];
  tr.f.tokens.forEach(t=>{
    if(t.kind==="ball")return;
    const p=tr.paths[t.id];
    if(!p){if(phase==="hold")out.push(t);return;}
    const q=phase==="hold"?{x:t.x,y:t.y}:phase==="move"?p(u):p(1);
    out.push({...t,x:q.x,y:q.y});
  });
  if(phase!=="hold")tr.added.forEach(t=>{if(t.kind!=="ball")out.push(t);});
  let b=null;
  if(phase==="hold")b=tr.f.tokens.find(t=>t.kind==="ball");
  else if(phase==="move")b=tr.ballAt(u);
  else b=tr.ballAt(1);
  if(b)out.push({id:"ball",kind:"ball",x:b.x,y:b.y});
  return out;
}

const DUR={hold:2200,move:3000,pass:1600,end:1800};   // ms per phase (doubled Oct 18: play-through was too fast)

/* Pack a playbook into a link (used when there's no server, e.g. demo mode).
   The JSON is compressed and base64url-encoded into the part after "#". */
async function packPlaybook(obj){
  const bytes=new TextEncoder().encode(JSON.stringify(obj));
  let out=bytes,tag="z";
  if(window.CompressionStream){
    out=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  }else tag="j";
  let bin="";for(let i=0;i<out.length;i+=0x8000)bin+=String.fromCharCode.apply(null,out.subarray(i,i+0x8000));
  return tag+btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function unpackPlaybook(str){
  const tag=str[0],b64=str.slice(1).replace(/-/g,"+").replace(/_/g,"/");
  const bin=atob(b64+"===".slice((b64.length+3)%4));
  let bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  if(tag==="z")bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
/* Only what players need: no plans, drills, staff or schedule. */
function playbookPayload(title,team,playList){
  const st=team.settings||{};
  return {v:1,title,team:{name:team.name,sport:st.sport||"basketball",color:st.color||"#5b2a86",color2:st.color2||"",school:st.school||"",mascot:st.mascot||"",teamLabel:st.teamLabel||""},
    plays:playList.map(p=>({id:p.id,name:p.name,type:p.type,notes:p.notes||"",frames:p.frames.map(compactFrame)}))};
}
/* Whole numbers are plenty for a diagram and keep packed links shorter. */
function compactFrame(f){
  const r=v=>typeof v==="number"?Math.round(v):v;
  const extra={};["fid","opt","optName","from","defense"].forEach(k=>{if(f[k])extra[k]=f[k];});
  return {...extra,caption:f.caption||"",
    tokens:f.tokens.map(t=>{const o={id:t.id,kind:t.kind,x:r(t.x),y:r(t.y)};if(t.n)o.n=t.n;if(t.label)o.label=t.label;return o;}),
    actions:f.actions.map(a=>{const o={type:a.type,from:a.from||null,to:a.to||null,x1:r(a.x1),y1:r(a.y1),cx:r(a.cx),cy:r(a.cy),x2:r(a.x2),y2:r(a.y2)};if(a.beat)o.beat=a.beat;if(a.name)o.name=a.name;return o;})};
}

/* ---------- options (branches of a play) ----------
   A play has a main line of steps. An option is a branch of extra steps that starts from the end of
   one main step. Option steps are stored in the same frames list, marked {opt, optName, from}, where
   "from" is the fid of the main step they branch from. Old plays with no options are unchanged. */
function playLines(frames){
  const main=[],byId={},order=[];
  frames.forEach((f,i)=>{
    if(f.opt){if(!byId[f.opt]){byId[f.opt]={id:f.opt,name:f.optName||"",from:f.from,steps:[]};order.push(f.opt);}byId[f.opt].steps.push(i);}
    else main.push(i);
  });
  const options=order.map((id,n)=>{
    const o=byId[id];let b=main.findIndex(i=>frames[i].fid&&frames[i].fid===o.from);if(b<0)b=main.length-1;
    const letter=String.fromCharCode(65+n);
    return {...o,branch:b,letter,title:`Option ${letter}${o.name?": "+o.name:""}`};
  });
  return {main,options};
}
/* Old "options" become looks: each option's first pass (or shot) becomes a numbered look on the step it
   branched from, named after the option. The option's own steps are dropped. Returns a new frames array. */
function optionsToLooks(frames){
  if(!frames||!frames.some(f=>f.opt))return frames;
  const L=playLines(frames),out=clone(frames.filter(f=>!f.opt));
  L.options.forEach(o=>{
    const base=frames[L.main[o.branch]];if(!base)return;const tgt=out.find(f=>f.fid&&f.fid===base.fid)||out[o.branch];if(!tgt)return;
    let act=null,fr=null;for(const i of o.steps){const f=frames[i];act=(f.actions||[]).find(a=>a.type==="pass")||(f.actions||[]).find(a=>a.type==="shot");if(act){fr=f;break;}}
    if(!act)return;
    const end=nextTokens(tgt),b=end.find(t=>t.kind==="ball"),hd=holderOf({tokens:end});
    const x1=hd?hd.x:b?b.x-13:act.x1,y1=hd?hd.y:b?b.y+13:act.y1;
    tgt.actions=tgt.actions||[];
    tgt.actions.push({id:"lk"+Math.random().toString(36).slice(2,9),type:"look",from:hd?hd.id:null,to:act.type==="pass"?act.to||null:null,x1,y1,cx:(x1+act.x2)/2,cy:(y1+act.y2)/2,x2:act.x2,y2:act.y2,name:o.name||""});
  });
  return out;
}
function optionOf(frames,lines,i){const f=frames[i];return f&&f.opt?lines.options.find(o=>o.id===f.opt)||null:null;}
/* The frame indexes you see when playing a line: the main steps, or the main steps up to the branch then the option. */
function lineIdx(lines,opt){return opt?lines.main.slice(0,opt.branch+1).concat(opt.steps):lines.main.slice();}
function stepName(frames,lines,i){
  const o=optionOf(frames,lines,i);
  if(!o){const k=lines.main.indexOf(i);return {short:`Step ${k+1}`,long:`Step ${k+1} of ${lines.main.length}`,opt:null};}
  const k=o.steps.indexOf(i);
  return {short:`${o.letter}${k+1}`,long:`${o.title} · step ${k+1} of ${o.steps.length}`,where:`branches off after step ${o.branch+1}`,opt:o};
}
/* Display order: main steps, then each option's steps. */
function displayOrder(lines){return lines.main.concat(...lines.options.map(o=>o.steps));}

/* ---------- auto defense (basketball) ----------
   A play can carry a defense to run against: man-to-man, 2-3 zone, 3-2 zone or box-and-1.
   The defenders aren't drawn by hand: their spots are worked out from where the offense and the
   ball are, at every moment of the play, so they slide and rotate as the ball moves.
   Stored on the play's first step as frames[0].defense = {type, chase}. */
const DEF_TYPES=[["none","No defense"],["custom","Place my own"],["man","Man-to-man"],["z23","2-3 zone"],["z32","3-2 zone"],["box1","Box-and-1"]];
const AUTO_DEF=t=>["man","z23","z32","box1"].includes(t);
const HOOP={x:250,y:52.5};
const lerpP=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const clamp01=v=>Math.max(0,Math.min(1,v));
const unitV=(a,b)=>{const d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:(b.x-a.x)/d,y:(b.y-a.y)/d};};
const smooth01=v=>{v=clamp01(v);return v*v*(3-2*v);};
/* Guarding the ball: about 3 feet off, between the ball and the basket. */
const onBall=B=>{const u=unitV(B,HOOP);return {x:B.x+u.x*30,y:B.y+u.y*30};};
const P=(x,y)=>({x,y});
function ballSpot(toks){
  const b=toks.find(t=>t.kind==="ball");if(b)return {x:b.x,y:b.y};
  const o=toks.filter(t=>t.kind==="o").sort((a,c)=>a.n-c.n)[0];return o?{x:o.x,y:o.y}:P(250,250);
}
/* Man-to-man, pack-line style: pressure the ball, deny one pass away, help in the lane two passes away. */
function manSpot(o,B,deny){
  const dB=Math.hypot(o.x-B.x,o.y-B.y);
  const toHoop=unitV(o,HOOP),toBall=unitV(o,B);
  const den={x:o.x+toBall.x*(deny?28:22)+toHoop.x*(deny?12:22),y:o.y+toBall.y*(deny?28:22)+toHoop.y*(deny?12:22)};
  const line=lerpP(HOOP,B,0.28),help=lerpP(o,line,0.55);
  const h=deny?0:smooth01((dB-170)/190);
  const off=lerpP(den,help,h);
  const w=smooth01(1-(dB-24)/40);           // has the ball (or about to)
  return lerpP(off,onBall(B),w);
}
/* Zones: each one is a set of spots for "ball on the left" and "ball on the right", high and low,
   blended smoothly by where the ball is, so defenders glide instead of jumping. */
function zoneSpots(type,B,extra){
  const bx=B.x-250;
  const cfg=s=>{   // s = +1 ball on the right, -1 ball on the left (from the offense's view, facing the basket)
    const R=k=>s>0?k:-k;   // mirror helper for an x offset
    const ballR=s>0;
    if(type==="z23"){
      // roles: 0 left guard, 1 right guard, 2 left forward, 3 right forward, 4 center
      const high=[], low=[];
      const bg=ballR?1:0,wg=ballR?0:1,bf=ballR?3:2,wf=ballR?2:3;
      high[bg]=onBall(B);high[wg]=P(250+bx*0.25-R(12),188);high[bf]=P(250+R(150)+bx*0.1,108);high[wf]=P(250-R(95),74);high[4]=P(250+bx*0.3,72);
      low[bf]=onBall(B);low[4]=P(250+R(72),56);low[wf]=P(250-R(35),76);low[bg]=P(250+R(118),172);low[wg]=P(250-R(10),186);
      return {high,low};
    }
    if(type==="z32"){
      // roles: 0 point, 1 left wing, 2 right wing, 3 left bottom, 4 right bottom
      const bw=ballR?2:1,ww=ballR?1:2,bb=ballR?4:3,wb=ballR?3:4;
      const high=[],low=[];
      high[bw]=onBall(B);high[0]=P(250+R(48),208);high[ww]=P(250-R(42),182);high[bb]=P(250+R(95),82);high[wb]=P(250-R(30),64);
      low[bb]=onBall(B);low[wb]=P(250+R(55),56);low[bw]=P(250+R(120),124);low[0]=P(250+R(30),172);low[ww]=P(250-R(55),76);
      return {high,low};
    }
    // box-and-1 box: roles 1 left top, 2 right top, 3 left bottom, 4 right bottom (0 is the chaser)
    const bt=ballR?2:1,wt=ballR?1:2,bb=ballR?4:3,wb=ballR?3:4;
    const high=[],low=[];
    high[bt]=onBall(B);high[wt]=P(250-R(15),190);high[bb]=P(250+R(85),76);high[wb]=P(250-R(40),64);
    low[bb]=onBall(B);low[wb]=P(250+R(35),56);low[bt]=P(250+R(100),130);low[wt]=P(250-R(20),170);
    return {high,low};
  };
  const n=5,L=cfg(-1),Rr=cfg(1),tSide=smooth01((bx+55)/110),tLow=smooth01((165-B.y)/50);
  const at=(c,i)=>lerpP(c.high[i]||P(250,150),c.low[i]||P(250,150),tLow);
  const out=[];for(let i=0;i<n;i++){if(type==="box1"&&i===0)continue;out[i]=lerpP(at(L,i),at(Rr,i),tSide);}
  // top of the key, ball in the middle: the zone's top defender(s) meet it
  const tTop=smooth01(1-(Math.abs(bx)-40)/70)*smooth01((B.y-185)/40);
  if(tTop>0){
    const top=type==="z23"?[P(250+bx*0.6-28,Math.max(205,B.y-30)),P(250+bx*0.6+28,Math.max(205,B.y-30))]:null;
    if(type==="z23"){const near=bx<0?0:1;out[near]=lerpP(out[near],onBall(B),tTop);out[1-near]=lerpP(out[1-near],P(250-(near?1:-1)*45,195),tTop);
      out[2]=lerpP(out[2],P(130,95),tTop);out[3]=lerpP(out[3],P(370,95),tTop);out[4]=lerpP(out[4],P(250,72),tTop);}
    if(type==="z32"){out[0]=lerpP(out[0],onBall(B),tTop);out[1]=lerpP(out[1],P(128,195),tTop);out[2]=lerpP(out[2],P(372,195),tTop);out[3]=lerpP(out[3],P(180,66),tTop);out[4]=lerpP(out[4],P(320,66),tTop);}
    if(type==="box1"){const near=bx<0?1:2;out[near]=lerpP(out[near],onBall(B),tTop*0.85);out[3-near]=lerpP(out[3-near],P(250+(near===1?45:-45),192),tTop);}
    void top;
  }
  // ball inside the lane (a post touch): collapse
  const tPost=smooth01((80-Math.abs(bx))/30)*smooth01((185-B.y)/30);
  if(tPost>0){
    const big=type==="z23"?4:type==="z32"?(bx<0?3:4):(bx<0?3:4);
    out.forEach((p,i)=>{if(!p)return;const sag=lerpP(p,lerpP(B,HOOP,0.4),0.35);out[i]=lerpP(p,i===big?onBall(B):sag,tPost);});
  }
  if(type==="box1"&&extra&&extra.chaserHasBall>0){   // their best player has it: the chaser takes the ball, the box stays home
    const home=[null,P(195+bx*0.2,192),P(305+bx*0.2,192),P(190+bx*0.18,64),P(310+bx*0.18,64)];
    for(let i=1;i<5;i++)out[i]=lerpP(out[i],home[i],extra.chaserHasBall);
  }
  return out;
}
/* Where each defender should be right now. Returns defender tokens (marked auto). */
function defenseFor(toks,sch){
  if(!sch||!AUTO_DEF(sch.type))return [];
  const os=toks.filter(t=>t.kind==="o").sort((a,b)=>a.n-b.n);if(!os.length)return [];
  const B=ballSpot(toks),fit=p=>({x:Math.max(6,Math.min(494,p.x)),y:Math.max(6,Math.min(464,p.y))});
  /* don't draw a defender right on top of a player: keep them a step apart */
  const apart=p=>{let q={...p};os.forEach(o=>{const d=Math.hypot(q.x-o.x,q.y-o.y);if(d<24){const u=d>0.5?{x:(q.x-o.x)/d,y:(q.y-o.y)/d}:unitV(o,HOOP);q={x:o.x+u.x*24,y:o.y+u.y*24};}});return q;};
  const mk=(n,p)=>({id:"ad"+n,kind:"d",n,auto:true,...fit(apart(p))});
  if(sch.type==="man")return os.map(o=>mk(o.n,manSpot(o,B,false)));
  if(sch.type==="box1"){
    const tgt=os.find(o=>String(o.n)===String(sch.chase))||os[0];
    const dB=Math.hypot(tgt.x-B.x,tgt.y-B.y),has=smooth01(1-(dB-24)/40);
    const z=zoneSpots("box1",B,{chaserHasBall:has});
    return [mk(1,manSpot(tgt,B,true)),mk(2,z[1]),mk(3,z[2]),mk(4,z[3]),mk(5,z[4])];
  }
  const z=zoneSpots(sch.type,B);
  return z.map((p,i)=>mk(i+1,p));
}
/* The play's defense with defenders filled in, for drawing one step. */
function withDefense(fr,sch){
  if(!sch||!AUTO_DEF(sch.type))return fr;
  const base=fr.tokens.filter(t=>t.kind!=="d");
  return {...fr,tokens:base.concat(defenseFor(base,sch))};
}
/* During a play-through: defenders react with a short delay instead of teleporting. */
function chaseDefense(prev,toks,sch,dt){
  const tgt=defenseFor(toks,sch);if(!tgt.length)return [];
  const k=1-Math.exp(-(dt||16)/260);
  return tgt.map(t=>{const p=prev&&prev[t.id];if(!p)return t;const q={...t,x:p.x+(t.x-p.x)*k,y:p.y+(t.y-p.y)*k};return q;});
}
const playDefense=frames=>(frames&&frames[0]&&frames[0].defense)||null;

/* Play-through: put the reacting defenders into this moment's tokens. */
function animDefense(anim,toks,dt,sch){
  if(!sch||!AUTO_DEF(sch.type))return toks;
  const base=toks.filter(t=>t.kind!=="d"),d=chaseDefense(anim.dprev,base,sch,dt);
  anim.dprev=Object.fromEntries(d.map(t=>[t.id,t]));return base.concat(d);
}
