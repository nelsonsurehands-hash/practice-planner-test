/* Sport settings: drill categories, play types, starting sets and the court or field
   drawn on the play board. Every board uses the same coordinate box
   (x -30…530, y -45…485), so plays keep their shape when printed or animated. */

const SPORTS={
  basketball:{
    name:"Basketball", players:5, board:"Half-court drawing board",
    cats:["Warm-up","Ball handling","Passing","Shooting","Finishing","Defense","Team Defense","Rebounding","Offense","Team Offense","Transition","Conditioning","Scrimmage","Other"],
    playTypes:["Half-court offense","Zone offense","Baseline inbound","Sideline inbound","Press break","Quick hitter","Defense","Special situation"],
    tools:{cut:"Cut",pass:"Pass",dribble:"Dribble",screen:"Screen",shot:"Shot"},target:{x:250,y:52.5},
    forms:{
      "5-Out":[[1,250,330],[2,425,245],[3,75,245],[4,455,55],[5,45,55]],
      "4-Out 1-In":[[1,250,330],[2,425,245],[3,75,245],[4,455,55],[5,340,95]],
      "1-4 High":[[1,250,350],[2,440,190],[3,60,190],[4,330,190],[5,170,190]],
      "Box (baseline inbound)":[[1,300,-25],[2,165,95],[3,335,95],[4,170,190],[5,330,190]]
    },
    defend:o=>({x:o.x+(250-o.x)*.28,y:o.y+(52.5-o.y)*.28})
  },
  volleyball:{
    name:"Volleyball", players:6, board:"Volleyball court",
    cats:["Warm-up","Serving","Passing","Setting","Attacking","Blocking","Defense","Serve receive","Transition","Conditioning","Scrimmage","Other"],
    playTypes:["Serve receive","Offense","Defense","Free ball","Out of system","Special situation"],
    tools:{cut:"Run",pass:"Ball",dribble:null,screen:null},
    forms:{
      "Base (rotation 1)":[[1,330,410],[2,330,265],[3,250,265],[4,170,265],[5,170,410],[6,250,410]],
      "Serve receive W":[[1,335,330],[2,340,250],[3,250,250],[4,165,330],[5,165,420],[6,250,380]]
    },
    defend:null
  },
  soccer:{
    name:"Soccer", players:11, board:"Half-field drawing board",
    cats:["Warm-up","Passing","Dribbling","Shooting","Finishing","Defending","Goalkeeping","Possession","Set pieces","Small-sided games","Conditioning","Scrimmage","Other"],
    playTypes:["Attack","Build-up","Corner kick","Free kick","Throw-in","Defensive shape","Pressing","Special situation"],
    tools:{cut:"Run",pass:"Pass",dribble:"Dribble",screen:null,shot:"Shot"},target:{x:250,y:-4},
    forms:{
      "4-3-3":[[1,250,462],[2,430,360],[3,320,372],[4,180,372],[5,70,360],[6,150,262],[7,250,280],[8,350,262],[9,80,130],[10,250,115],[11,420,130]],
      "4-4-2":[[1,250,462],[2,430,360],[3,320,372],[4,180,372],[5,70,360],[6,430,250],[7,320,262],[8,180,262],[9,70,250],[10,190,135],[11,310,135]]
    },
    defend:o=>({x:o.x+(250-o.x)*.25,y:o.y+(0-o.y)*.12})
  },
  football:{
    name:"Football", players:11, board:"Football field",
    cats:["Warm-up","Individual","Offense","Defense","Special teams","Tackling","Blocking","Route running","Ball security","Team","Conditioning","Other"],
    playTypes:["Run","Pass","Play action","Screen","Defense","Kickoff","Punt","Field goal","Special situation"],
    tools:{cut:"Route",pass:"Pass",dribble:"Motion",screen:"Block"},
    forms:{
      "I-formation":[["C",250,345],["G",222,345],["G",278,345],["T",194,345],["T",306,345],["Y",336,350],["QB",250,372],["FB",250,408],["RB",250,442],["X",45,345],["Z",440,352]],
      "Shotgun spread":[["C",250,345],["G",222,345],["G",278,345],["T",194,345],["T",306,345],["QB",250,402],["RB",288,402],["X",40,345],["H",110,354],["Y",390,354],["Z",460,345]]
    },
    defend:o=>{const d=o.y-330,wide=Math.abs(o.x-250)>110;   // line, linebackers, corners, safeties
      if(wide)return {x:o.x+(o.x<250?12:-12),y:330-58};
      if(d<20)return {x:o.x,y:330-30};
      if(d<50)return {x:o.x+(o.x<=250?-40:40),y:330-82};
      return {x:o.x+(o.x<=250?-70:70),y:330-150};}
  },
  baseball:{
    name:"Baseball / Softball", players:9, board:"Baseball diamond",
    cats:["Warm-up","Throwing","Fielding","Hitting","Bunting","Baserunning","Pitching","Catching","Team defense","Conditioning","Scrimmage","Other"],
    playTypes:["Bunt defense","Cutoffs & relays","Pickoffs","First & third","Baserunning","Defensive alignment","Special situation"],
    tools:{cut:"Run",pass:"Throw",dribble:null,screen:null},
    forms:{
      "Standard defense":[["P",250,312],["C",250,470],["1B",372,270],["2B",305,198],["SS",195,198],["3B",128,270],["LF",110,110],["CF",250,72],["RF",390,110]]
    },
    defend:null
  },
  other:{
    name:"Other sport", players:12, board:"Drawing board",
    cats:["Warm-up","Skills","Offense","Defense","Team","Conditioning","Scrimmage","Other"],
    playTypes:["Play","Formation","Drill setup","Special situation"],
    tools:{cut:"Run",pass:"Pass",dribble:"Dribble",screen:"Block"},
    forms:{},
    defend:null
  }
};
const SPORT_KEYS=Object.keys(SPORTS);

/* Court and field drawings. c = colors {out, floor, line, paint}. */
function courtSVG(sport,c){
  const ln=w=>`style="fill:none;stroke:${c.line};stroke-width:${w||2}"`;
  let s=`<rect x="-30" y="-45" width="560" height="530" style="fill:${c.out}"/>`;
  switch(sport){
    case "volleyball":
      s+=`<rect x="133" y="-12" width="234" height="468" style="fill:${c.floor};stroke:${c.line};stroke-width:2.5"/>`+
         `<path d="M133 144H367M133 300H367" ${ln()}/>`+
         `<path d="M110 222H390" style="stroke:${c.line};stroke-width:5"/>`+
         `<circle cx="110" cy="222" r="4" style="fill:${c.line}"/><circle cx="390" cy="222" r="4" style="fill:${c.line}"/>`;
      break;
    case "soccer":
      s+=`<rect x="0" y="0" width="500" height="386" style="fill:${c.floor};stroke:${c.line};stroke-width:2.5"/>`+
         `<rect x="0" y="386" width="500" height="99" style="fill:${c.floor}"/>`+
         `<rect x="102" y="0" width="296" height="121" ${ln()}/><rect x="182.5" y="0" width="135" height="40" ${ln()}/>`+
         `<path d="M196.3 121A67 67 0 0 0 303.7 121" ${ln()}/><circle cx="250" cy="81" r="2.5" style="fill:${c.line}"/>`+
         `<rect x="223" y="-14" width="54" height="14" style="fill:${c.paint};stroke:${c.line};stroke-width:2"/>`+
         `<path d="M183 386A67 67 0 0 1 317 386" ${ln()}/><circle cx="250" cy="386" r="3" style="fill:${c.line}"/>`+
         `<path d="M0 0A10 10 0 0 0 10 10M490 10A10 10 0 0 0 500 0" ${ln(1.5)}/>`;
      break;
    case "football":{
      s+=`<rect x="0" y="-45" width="500" height="530" style="fill:${c.floor}"/><path d="M0 -45V485M500 -45V485" ${ln(3)}/>`;
      let lines="",hashes="";
      for(let y=-42;y<=485;y+=47)lines+=`M0 ${y}H500`;
      for(let y=-42;y<=485;y+=9.4){hashes+=`M164 ${y.toFixed(1)}h6M330 ${y.toFixed(1)}h6M2 ${y.toFixed(1)}h6M492 ${y.toFixed(1)}h6`;}
      s+=`<path d="${lines}" ${ln(1.5)}/><path d="${hashes}" ${ln(1.2)}/>`+
         `<path d="M0 330H500" style="stroke:${c.line};stroke-width:2;stroke-dasharray:10 7"/>`+
         `<text x="492" y="324" text-anchor="end" style="fill:${c.line};font:700 12px Arial,Helvetica,sans-serif">LOS</text>`;
      break;}
    case "baseball":
      s+=`<path d="M-26 169A390 390 0 0 1 526 169L250 445Z" style="fill:${c.floor};stroke:${c.line};stroke-width:2"/>`+
         `<path d="M65 250A195 195 0 0 1 435 250" ${ln()}/>`+
         `<path d="M250 445L390 305L250 165L110 305Z" style="fill:${c.paint};stroke:${c.line};stroke-width:2"/>`+
         `<path d="M250 445L-26 169M250 445L526 169" ${ln()}/>`+
         `<circle cx="250" cy="312" r="13" style="fill:${c.paint};stroke:${c.line};stroke-width:2"/>`+
         [[390,305],[250,165],[110,305]].map(([x,y])=>`<rect x="${x-6}" y="${y-6}" width="12" height="12" transform="rotate(45 ${x} ${y})" style="fill:${c.floor};stroke:${c.line};stroke-width:2"/>`).join("")+
         `<path d="M243 440h14v6l-7 7l-7-7z" style="fill:${c.floor};stroke:${c.line};stroke-width:2"/>`;
      break;
    case "other":
      s+=`<rect x="0" y="0" width="500" height="470" style="fill:${c.floor};stroke:${c.line};stroke-width:2.5"/><path d="M0 235H500" ${ln()}/><circle cx="250" cy="235" r="50" ${ln()}/>`;
      break;
    default: // basketball half court
      s+=`<rect x="0" y="0" width="500" height="470" style="fill:${c.floor};stroke:${c.line};stroke-width:2.5"/>`+
         `<rect x="170" y="0" width="160" height="190" style="fill:${c.paint};stroke:${c.line};stroke-width:2"/>`+
         `<path d="M190 190A60 60 0 0 0 310 190" ${ln()}/><path d="M190 190A60 60 0 0 1 310 190" style="fill:none;stroke:${c.line};stroke-width:2;stroke-dasharray:7 6"/>`+
         `<path d="M52.5 0V52.5A197.5 197.5 0 0 0 447.5 52.5V0" ${ln()}/>`+
         `<path d="M190 470A60 60 0 0 1 310 470" ${ln()}/>`+
         `<path d="M160 70h10M330 70h10M160 110h10M330 110h10M160 140h10M330 140h10" ${ln()}/>`+
         `<line x1="220" y1="40" x2="280" y2="40" style="stroke:${c.line};stroke-width:4"/><circle cx="250" cy="52.5" r="8" ${ln()}/>`;
  }
  return s;
}
