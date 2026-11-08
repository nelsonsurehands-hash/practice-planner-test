/* Public showcase: common basketball sets and drills, drawn with the app's play designer.
   Nothing here comes from any team's playbook. Edit this file, then run:  node tools/showcase/build.js
   Court: baseline at the top (y 0), rim at 250,52.5, free-throw line y 190, top of the arc y 250, half court y 470.
   Moves: ["cut"|"dribble"|"screen", id, x, y, bend]  bend = how far the path curves (+ right of travel, - left)
          ["pass", from, to]   ["shot", id]
   A step can start with {ball:"id"} to put the ball in that player's hands (a rebound or an outlet). */
const S={top:[250,310],slotL:[168,288],slotR:[332,288],wingL:[72,205],wingR:[428,205],cornL:[26,32],cornR:[474,32],
  elbL:[170,190],elbR:[330,190],blkL:[158,95],blkR:[342,95]};

module.exports=[
/* ======================= PLAYS ======================= */
{slug:"horns-pick-and-roll",kind:"play",name:"Horns Pick-and-Roll",type:"Half-court offense",level:"Middle school to varsity",defense:"man",
 summary:"Horns pick-and-roll for basketball: an animated diagram of the set, the screen, the roll and the pop, with coaching points and reads.",
 intro:"Horns puts two bigs at the elbows and two shooters in the corners, so the floor is spread before the action even starts. The point guard picks a side, one big sets the ball screen and rolls, and the other big pops to the top. It's simple enough for middle school and still a staple at every level above it.",
 start:{o1:[250,320],o4:S.elbL,o5:S.elbR,o2:S.cornR,o3:S.cornL,ball:"o1"},
 steps:[
  {cap:"Horns set: 4 and 5 at the elbows, 2 and 3 in the corners. 5 steps up to set a ball screen on 1's defender.",acts:[["screen","o5",284,296,-.1]]},
  {cap:"1 comes hard off the screen to the right. 5 rolls to the rim, 4 pops to the top of the key for the kick-out.",acts:[["dribble","o1",392,238,.18],["cut","o5",290,92,.12],["cut","o4",230,318,-.12]]},
  {cap:"Read the help: hit 5 rolling to the rim, or kick it to 4 if the defense collapses. Here 5 is open for the layup.",acts:[["pass","o1","o5"],["shot","o5"]]}],
 points:["The screener sprints into the screen and sets it with a wide base: no moving screens.","The ball handler sets up her defender first, then comes shoulder to shoulder off the screen.","The roll is hard and to the rim, with hands up and ready.","Corners stay wide. Their spacing is what keeps help defenders from sitting in the lane."],
 reads:["Big rolling is open: bounce pass or lob to the roll.","Help comes from the top: kick to 4 popping.","Help comes from the corner: skip to the open corner shooter.","Defense switches: attack the mismatch or post the smaller defender with 5."]},

{slug:"5-out-pass-and-cut",kind:"play",name:"5-Out Motion: Pass and Cut",type:"Motion offense",level:"Youth to high school",defense:"man",
 summary:"5-out motion offense basics: pass, basket cut and fill. Animated diagram with spacing rules and coaching points for youth and middle school teams.",
 intro:"5-out motion is the best way to teach young teams to play without set plays. All five players start outside the arc. The rule is simple: pass, cut hard to the basket, then fill the open spot away from the ball. Everyone else rotates over one spot. It opens the lane and teaches spacing, cutting and reading defenders.",
 start:{o1:[250,312],o2:S.wingR,o3:S.wingL,o4:S.cornR,o5:S.cornL,ball:"o1"},
 steps:[
  {cap:"All five spaced outside the arc. 1 passes to 2 on the wing.",acts:[["pass","o1","o2"]]},
  {cap:"Pass and cut: 1 cuts hard to the basket looking for the ball.",acts:[["cut","o1",270,78,.12]]},
  {cap:"No layup, so 1 clears to the open corner on the weak side. 5 lifts to the wing and 3 fills the top.",acts:[["cut","o1",28,34,-.12],["cut","o5",72,205,-.08],["cut","o3",250,312,-.08]]},
  {cap:"2 swings it back to 3 at the top. The ball is reversed and the motion keeps going.",acts:[["pass","o2","o3"]]}],
 points:["Cut with purpose: change speed and go all the way to the rim.","Fill away from the ball so the lane stays open behind the cut.","Keep 12–15 feet between players; two players should never be in the same spot.","Catch and face the basket every time. Look for the cutter first, then the shot."],
 reads:["Defender turns her head on the cut: hit the cutter for the layup.","Defender denies the wing: back cut to the rim.","Defense sags into the lane: shoot the open three or swing it."]},

{slug:"box-baseline-out-of-bounds",kind:"play",name:"Box Baseline Out-of-Bounds",type:"Baseline inbound",level:"Middle school to varsity",defense:null,
 summary:"Box baseline out-of-bounds play (BLOB): screen across, screen the screener and a safety outlet. Animated diagram and inbound reads.",
 intro:"The box set is the most common baseline out-of-bounds alignment in basketball. Four players line up at the blocks and elbows, so the defense has to guard every screen at once. This version uses a screen across for a layup, then the screener gets a screen of her own for a shot at the elbow, with a safety to the corner every time.",
 start:{o1:[302,-22],o4:[338,102],o5:[162,102],o2:[338,190],o3:[162,190],ball:"o1"},
 steps:[
  {cap:"Box set. On the slap of the ball, 4 screens across for 5, who cuts to the rim. 2 pops to the corner as the safety.",acts:[["screen","o4",204,100,.05],["cut","o5",292,66,.2],["cut","o2",466,52,-.12]]},
  {cap:"Screen the screener: 3 screens down for 4, who comes to the middle of the free-throw line for the shot.",acts:[["screen","o3",200,138,.05],["cut","o4",252,196,-.15]]},
  {cap:"Inbound reads in order: 5 at the rim, 4 at the free-throw line, 2 in the corner. Here 5 is open.",acts:[["pass","o1","o5"],["shot","o5"]]}],
 points:["Everyone breaks on the same signal, usually the inbounder slapping the ball.","The inbounder stands a step back from the line so she can see the whole floor.","Screens are set on a body, not on air. Hold them for a full count.","The safety (2) always gets open, so you never burn a timeout or give up a five-second call."],
 reads:["Screen across is open: bounce pass to the rim.","Defense switches the screen: the screener (4) seals and is open.","Everything is covered: safety pass to 2 in the corner and get into your offense."]},

{slug:"down-screen-wing-entry",kind:"play",name:"Down Screen Wing Entry",type:"Quick hitter",level:"Youth to high school",defense:"man",
 summary:"Down screen wing entry for basketball: get a shooter open on the wing and slip the screener. Animated diagram with coaching points.",
 intro:"When the wing is being denied, a down screen is the cleanest way to get the ball there. A player sets a screen for a teammate on the block, who curls or pops to the wing. The screener then slips to the basket. It works as a play on its own or as the first action of almost any offense.",
 start:{o1:[250,320],o2:[350,92],o4:[372,262],o3:S.wingL,o5:S.blkL,ball:"o1"},
 steps:[
  {cap:"2 starts on the right block. 4 comes down and sets a down screen on 2's defender.",acts:[["screen","o4",352,140,.05]]},
  {cap:"2 sets up her defender low, then comes off the screen to the wing. 1 makes the entry pass while 4 slips to the rim.",acts:[["cut","o2",430,214,-.2],["cut","o4",302,74,.1],["pass","o1","o2"]]},
  {cap:"2 catches ready to shoot. If her defender trails the screen, it's an open jumper.",acts:[["shot","o2"]]}],
 points:["The cutter walks her defender into the screen before she comes off it.","The screener's back faces where the cutter wants to go.","Read the defender: trail = curl to the middle, cheat over the top = pop or flare.","The screener slips as soon as the cutter clears; that's when the defense is out of position."],
 reads:["Defender trails the screen: curl toward the middle for a layup or short jumper.","Defender goes under: pop to the wing for the shot.","Defenders switch: hit the screener slipping to the rim."]},

{slug:"give-and-go",kind:"play",name:"Give and Go",type:"Basic action",level:"Youth and beginners",defense:"man",
 summary:"Give and go basketball play for youth teams: pass, cut and get it back for a layup. Animated diagram and teaching tips.",
 intro:"The give and go is the first two-player action every young team should learn. Pass to a teammate, take your defender away with a jab step, then cut hard to the basket to get the ball right back. It teaches passing, timing and cutting, and it beats defenders who watch the ball.",
 start:{o1:S.slotR,o2:S.wingR,o3:S.wingL,o4:S.cornL,o5:S.cornR,ball:"o1"},
 steps:[
  {cap:"1 passes to 2 on the wing (the give).",acts:[["pass","o1","o2"]]},
  {cap:"1 jab steps away from the ball, then cuts hard to the basket in front of her defender (the go).",acts:[["cut","o1",292,82,-.22]]},
  {cap:"2 hits 1 in stride for the layup.",acts:[["pass","o2","o1"],["shot","o1"]]}],
 points:["Set up the cut: a jab step or a step away makes the defender lean.","Cut in front of the defender, with your target hand up.","The passer leads the cutter, a bounce pass in front, not at her.","If it's not open, keep going through and fill the spot on the far side."],
 reads:["Defender watches the ball: cut in front for the layup.","Defender jumps to the ball: back cut behind her.","Help comes from the lane: kick out to the open wing."]},

/* ======================= DRILLS ======================= */
{slug:"3-man-weave",kind:"drill",name:"3-Man Weave",type:"Passing · Transition",level:"All levels",minutes:"8–10",players:"3 per group",defense:null,
 summary:"3-man weave basketball drill: animated diagram showing pass and go behind, lanes and the layup finish, with coaching points.",
 intro:"The 3-man weave is a classic for a reason. It teaches passing on the move, filling lanes and finishing at full speed, all without dribbling. Three players start at half court: pass to a teammate, run behind her, and keep the weave going until someone finishes the layup.",
 start:{o1:[250,462],o2:[420,452],o3:[80,452],ball:"o1"},
 steps:[
  {cap:"Three lanes at half court. The middle player (1) passes to 2 on the right.",acts:[["pass","o1","o2"]]},
  {cap:"1 runs behind 2 to fill the right lane. 2 moves to the middle, 3 runs ahead on the left.",acts:[["cut","o1",440,352,.3],["cut","o2",250,356,-.1],["cut","o3",90,340,0]]},
  {cap:"2 passes to 3 on the left and runs behind her.",acts:[["pass","o2","o3"]]},
  {cap:"3 moves to the middle, 2 fills the left lane, 1 runs ahead on the right.",acts:[["cut","o3",250,246,.1],["cut","o2",66,232,-.3],["cut","o1",420,232,0]]},
  {cap:"3 passes ahead to 1. Lead pass, no dribble.",acts:[["pass","o3","o1"]]},
  {cap:"1 attacks the rim for the layup. 2 and 3 crash for the rebound.",acts:[["dribble","o1",298,82,.1],["cut","o3",214,128,0],["cut","o2",150,150,.1],["shot","o1"]]}],
 points:["No dribbles: the ball moves only by passing.","Lead passes, chest high, in front of the receiver.","Always pass and go behind the person you passed to.","Sprint the lanes wide, then finish with two hands or a soft layup off the glass."],
 variations:["Add a 2-on-1 coming back the other way.","Make it 11-man break or a timed weave: down and back in under 20 seconds.","Finish with a pull-up jumper instead of a layup."]},

{slug:"mikan-drill",kind:"drill",name:"Mikan Drill",type:"Finishing",level:"All levels",minutes:"3–5",players:"1 per basket",defense:null,
 summary:"Mikan drill for basketball finishing: animated diagram of alternating layups under the rim, plus counts, coaching points and variations.",
 intro:"The Mikan drill builds soft touch and footwork around the rim. One player stands under the basket and makes continuous layups, right hand on the right side and left hand on the left side, without letting the ball touch the floor. Count makes in 30 or 60 seconds.",
 start:{o1:[206,70],ball:"o1"},
 steps:[
  {cap:"Start on the left side of the rim. Lay it in off the glass with the left hand.",acts:[["shot","o1"]]},
  {ball:"o1",cap:"Catch it out of the net above your head, step across and lay it in with the right hand.",acts:[["cut","o1",294,70,.4],["shot","o1"]]},
  {ball:"o1",cap:"Back to the left side and repeat. Keep the ball high the whole time.",acts:[["cut","o1",206,70,.4],["shot","o1"]]}],
 points:["Ball stays above your shoulders: never bring it down.","Use the backboard and the correct hand on each side.","Quick feet: one step across and up.","Count makes in 30 or 60 seconds and try to beat it next practice."],
 variations:["Reverse Mikan: lay it in on the far side, reverse layups.","Power Mikan: two-foot power finish each side.","Use a weighted ball to build strength."]},

{slug:"shell-drill",kind:"drill",name:"Shell Drill (4-on-4)",type:"Team defense",level:"Middle school to varsity",minutes:"10–15",players:"8",defense:"man",
 summary:"Shell drill for basketball team defense: animated 4-on-4 diagram showing on-ball, deny and help positions as the ball moves.",
 intro:"The shell drill is how coaches teach team defense. Four offensive players pass the ball around the perimeter, and the four defenders move on every pass: pressure the ball, deny one pass away and sink to help two passes away. Watch how every defender's spot changes each time the ball moves.",
 start:{o1:[175,292],o2:[325,292],o3:[438,170],o4:[62,170],ball:"o1"},
 steps:[
  {cap:"Four offensive players around the arc. Defense: one on the ball, the others in deny or help.",acts:[["pass","o1","o2"]]},
  {cap:"Ball to the top right. Every defender jumps to the ball on the pass, not after the catch.",acts:[["pass","o2","o3"]]},
  {cap:"Ball on the wing: pressure the ball, deny the pass back, and help side sinks to the middle of the lane.",acts:[["pass","o3","o2"]]},
  {cap:"Ball reversed. Help defenders recover to deny as their player becomes one pass away.",acts:[["pass","o2","o1"]]},
  {cap:"Skip to the far wing: the help defender closes out under control.",acts:[["pass","o1","o4"]]}],
 points:["Move on the flight of the pass, not on the catch.","Talk every time: 'ball,' 'deny,' 'help.'","See both your player and the ball (point to both).","Close out short, with choppy feet and hands high."],
 variations:["Add dribble penetration: help stops the ball, then everyone rotates.","Add cutters: offense basket cuts after passing and defense must jump to the ball.","Play it live after six passes: first stop wins."]},

{slug:"closeout-drill",kind:"drill",name:"Closeout Drill",type:"Defense",level:"All levels",minutes:"5–8",players:"2 per group",defense:null,
 summary:"Closeout drill for basketball: an animated diagram of sprint, chop and contest, then cutting off the drive, with coaching points.",
 intro:"Most open threes come from bad closeouts. In this drill, the defender starts under the rim with the ball, passes to a shooter on the wing, and closes out: sprint most of the way, then chop the feet with a hand up. The shooter can shoot or drive one dribble, so the defender has to contest without flying by.",
 start:{d1:[250,96],o1:[428,205],ball:"d1"},
 steps:[
  {cap:"The defender starts under the rim with the ball and passes to the shooter on the wing.",acts:[["pass","d1","o1"]]},
  {cap:"Closeout: sprint the first two-thirds, then chop the feet the last few steps, hand high, weight back.",acts:[["cut","d1",396,180,.05]]},
  {cap:"The shooter drives baseline. The defender slides and cuts off the drive without reaching.",acts:[["dribble","o1",418,104,.12],["cut","d1",382,108,-.05]]}],
 points:["Sprint, then chop: short, quick steps as you arrive.","High hand contests the shot; the other hand covers the drive.","Arrive with your weight back so you can slide either way.","Take away the middle or baseline, whichever your team rule says."],
 variations:["Make it live 1-on-1 with two dribbles.","Closeout from the help side of the lane.","Add a second shooter: defender closes out to whoever gets the ball."]},

{slug:"partner-shooting",kind:"drill",name:"Partner Shooting",type:"Shooting",level:"All levels",minutes:"8–10",players:"2 per ball",defense:null,
 summary:"Partner shooting drill: an animated diagram of five spots around the arc with a passer, plus form tips and scoring variations.",
 intro:"Partner shooting gets a lot of game-like shots in a short time. One player shoots while her partner rebounds and passes. The shooter moves through five spots, from corner to corner, and has her feet and hands ready before the catch. Switch after ten shots or one full lap.",
 start:{o1:S.cornR,o2:[250,126],ball:"o2"},
 steps:[
  {cap:"Spot 1, right corner. The passer hits the shooter, who catches ready and shoots.",acts:[["pass","o2","o1"],["shot","o1"]]},
  {ball:"o2",cap:"The passer rebounds. Shooter moves to the right wing, hands up, and shoots on the catch.",acts:[["cut","o1",428,205,.1],["pass","o2","o1"],["shot","o1"]]},
  {ball:"o2",cap:"Spot 3, top of the key.",acts:[["cut","o1",250,312,.1],["pass","o2","o1"],["shot","o1"]]},
  {ball:"o2",cap:"Spot 4, left wing.",acts:[["cut","o1",72,205,.1],["pass","o2","o1"],["shot","o1"]]},
  {ball:"o2",cap:"Spot 5, left corner. Then switch: the passer shoots.",acts:[["cut","o1",26,32,.1],["pass","o2","o1"],["shot","o1"]]}],
 points:["Feet and hands ready before the catch.","Same shot every time: balance, elbow under the ball, hold the follow-through.","Passer: crisp chest pass to the shooting pocket.","Track makes and try to beat your score."],
 variations:["Make it a competition: first pair to 15 makes.","Add a shot fake and one dribble into a pull-up.","Move in from the three-point line to mid-range for younger players."]}
];
