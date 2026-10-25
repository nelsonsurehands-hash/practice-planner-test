/* The season schedule worked out from a team's settings, for pages that don't load the app
   (the parents' calendar). Same rules as the app's Calendar tab: practices on the practice
   days between the season dates, no practice on game days, extra practices added, and a
   day off always wins. Special days can carry notes (No School, Parent meeting, Bus departs…). */
(function(root){
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const dObj=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12);};
const isoOf=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const addDays=(iso,n)=>{const d=dObj(iso);d.setDate(d.getDate()+n);return isoOf(d);};
const byDate=st=>{const m={};(st.special||[]).forEach(x=>{if(x&&x.date)(m[x.date]=m[x.date]||[]).push(x);});return m;};
const notesOf=l=>(l||[]).filter(x=>x.kind!=="off").map(x=>x.note).filter(Boolean);

function practiceTimes(iso,st){
  const sp=(st.special||[]).find(x=>x.date===iso&&x.kind!=="off"&&(x.start||x.end));
  const wk=[0,6].includes(dObj(iso).getDay());
  return {start:(sp&&sp.start)||(wk?st.weekendStart:st.weekdayStart)||(wk?"10:00":"16:00"),
          end:(sp&&sp.end)||(wk?st.weekendEnd:st.weekdayEnd)||(wk?"12:00":"18:00")};
}
function practices(st){
  const games={};(st.games||[]).forEach(g=>{if(g.date)games[g.date]=g;});
  const sp=byDate(st),days=new Set(st.practiceDays||[]),out=new Set();
  const isOff=l=>(l||[]).some(x=>x.kind==="off"),isExtra=l=>(l||[]).some(x=>x.kind==="extra");
  if(st.seasonStart&&st.seasonEnd&&st.seasonStart<=st.seasonEnd){
    for(let iso=st.seasonStart,guard=0;iso<=st.seasonEnd&&guard<400;iso=addDays(iso,1),guard++){
      const l=sp[iso];let on=days.has(dObj(iso).getDay())&&!games[iso];
      if(isExtra(l))on=true;if(isOff(l))on=false;if(on)out.add(iso);
    }
  }
  Object.entries(sp).forEach(([d,l])=>{if(isExtra(l)&&!isOff(l))out.add(d);});
  return out;
}
/* One entry per date that has something on it, in date order:
   {date, game:{opponent,time,home,location}, practice:{start,end,notes:[]}, off:{note}, notes:[]} */
function days(st){
  st=st||{};const out={},get=d=>out[d]||(out[d]={date:d,notes:[]}),sp=byDate(st);
  practices(st).forEach(d=>{get(d).practice={...practiceTimes(d,st),notes:notesOf(sp[d])};});
  (st.games||[]).forEach(g=>{if(g.date)get(g.date).game={opponent:g.opponent||"",time:g.time||"",home:g.home!==false,location:g.location||""};});
  Object.entries(sp).forEach(([d,l])=>{
    const offs=l.filter(x=>x.kind==="off");
    if(offs.length){const names=offs.map(x=>x.note).filter(Boolean);get(d).off={note:names.filter(n=>!/^no practice$/i.test(n)).join(" · ")||"No practice"};}
    if(!get(d).practice)get(d).notes=notesOf(l);
  });
  return Object.values(out).filter(x=>x.game||x.practice||x.off||x.notes.length).sort((a,b)=>a.date<b.date?-1:1);
}
/* A calendar file (.ics) of the schedule. Times are "floating" (the phone's own time zone).
   show: {practices, games, off}. Stable UIDs so a calendar app updates events instead of duplicating them. */
function ics(list,o){
  o=o||{};const show=o.show||{practices:true,games:true,off:true},team=o.team||"Team",key=o.key||"team";
  const esc=t=>String(t||"").replace(/\\/g,"\\\\").replace(/[,;]/g,m=>"\\"+m).replace(/\n/g,"\\n");
  const dt=(d,t)=>d.replace(/-/g,"")+"T"+t.replace(":","")+"00";
  const plus=(t,m)=>{const [h,mm]=t.split(":").map(Number),x=h*60+mm+m;return String(Math.floor(x/60)%24).padStart(2,"0")+":"+String(x%60).padStart(2,"0");};
  const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Coach Practice Planner//Team Schedule//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    "X-WR-CALNAME:"+esc(team),"X-PUBLISHED-TTL:PT1H","REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  const ev=(id,d,title,start,end,desc,loc)=>{L.push("BEGIN:VEVENT","UID:"+id+"-"+d+"-"+key+"@practice-planner","DTSTAMP:"+stamp);
    if(start){L.push("DTSTART:"+dt(d,start),"DTEND:"+dt(d,end||plus(start,90)));}
    else{L.push("DTSTART;VALUE=DATE:"+d.replace(/-/g,""),"DTEND;VALUE=DATE:"+addDays(d,1).replace(/-/g,""));}
    L.push("SUMMARY:"+esc(title));if(desc)L.push("DESCRIPTION:"+esc(desc));if(loc)L.push("LOCATION:"+esc(loc));L.push("END:VEVENT");};
  list.forEach(x=>{
    if(show.games!==false&&x.game){const g=x.game;ev("game",x.date,`${g.home?"vs":"at"} ${g.opponent||"Game"}${g.time?"":" (time TBD)"}`,g.time,"",[g.home?"Home game":"Away game",...x.notes].join(" · "),g.location);}
    if(show.practices!==false&&x.practice){const p=x.practice;ev("practice",x.date,/tryout/i.test(p.notes.join(" "))?"Tryouts":"Practice",p.start,p.end,p.notes.join(" · "));}
    if(show.off!==false&&x.off)ev("off",x.date,x.off.note==="No practice"?"No practice":x.off.note+" (no practice)","","","");
    if(show.off!==false&&!x.practice&&!x.game&&x.notes.length)ev("note",x.date,x.notes.join(" · "),"","","");
  });
  L.push("END:VCALENDAR");
  return L.map(l=>{let out="";while(l.length>74){out+=l.slice(0,74)+"\r\n ";l=l.slice(74);}return out+l;}).join("\r\n")+"\r\n";
}
root.SchedCore={days,ics,dObj,isoOf,addDays,DOW};
})(typeof window!=="undefined"?window:globalThis);
