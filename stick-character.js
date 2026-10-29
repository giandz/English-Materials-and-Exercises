/* ═══════════════════════════════════════════════════════════════════════════
   StickCharacter — poseable stick figures for the English materials.
   window.StickCharacter = { SCHEMA, defaults, normalize, render, pivots, applyPose, mirror, describe,
                             POSES, JOINTS, HEADWEAR, ITEMS, EMOTIONS, PALETTE, colourName, STAGE, H }

   Proportions, in heads (one head = H units across):
     · height: 3.5 heads for an adult, 2.5 for a child (ground to the top of the head)
     · stroke width: ¼ head · the head is always a circle, one head across · neck: ¼ head
     · adult: hip 1.5 heads from the ground, shoulders 0.75 heads above the hip
     · child: hip 0.8 heads from the ground, shoulders 0.45 heads above the hip
   Options: cap (a peak at 30° out of the head), top hat, bow, long hair, skirt (a triangle from the
   hip down to half the hip height: 1.5 → 0.75 heads for an adult), hunchback (the spine bends forward
   so the shoulders sit 0.5 heads in front of the hip), things in each hand, a chair.
   Everything is drawn as outlines in one marker width. The figure has no face: a feeling shows as eyes and a mouth
   in a speech bubble 3 heads wide and 2.5 heads tall, which can be moved (bubbleX forward, bubbleY down, in drawing units).
   Held things either stay upright or turn with the forearm (grip: extra turn per hand); headwear turns round the head (hatAngle).

   Joint angles are in degrees and always relative to the way the figure faces:
     positive = forward. Limbs: 0 = hanging straight down. Spine and neck: 0 = straight up.
     shoulder / hip: the upper arm / thigh against the body · elbow / knee: against the limb above it.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const SCHEMA='stick-character/1';
const H=40;                                   /* one head, in drawing units */
const S=H/4;                                  /* stroke width: a quarter of a head */
const R=(H-S)/2;                              /* the circle's centre line, so the head is one head across outside */
const STAGE={w:320,h:300,cx:160,ground:272};
const BUILD={
  adult:{height:3.5,hip:1.5,torso:0.75,upper:0.62,fore:0.58},
  child:{height:2.5,hip:0.8,torso:0.45,upper:0.38,fore:0.34}
};
/* every joint turns all the way round: -180° to 180° */
const JOINTS=[['root','Whole body'],['torso','Spine'],['neck','Head'],['shoulderF','Front shoulder'],['elbowF','Front elbow'],['shoulderB','Back shoulder'],['elbowB','Back elbow'],
  ['hipF','Front hip'],['kneeF','Front knee'],['hipB','Back hip'],['kneeB','Back knee']].map(([k,l])=>[k,l,-180,180]);
let MASK=0;
const wrap=v=>{ v=((Math.round(v)+180)%360+360)%360-180; return v; };
const STAND={root:0,torso:0,neck:0,shoulderF:28,elbowF:8,shoulderB:-28,elbowB:8,hipF:14,kneeF:-2,hipB:-14,kneeB:-2};   /* the classic stick figure: arms and legs a little apart */
const POSES={
  standing:{label:'Standing',j:{}},
  walking:{label:'Walking',j:{shoulderF:-30,elbowF:25,shoulderB:32,elbowB:30,hipF:28,kneeF:-8,hipB:-22,kneeB:-28}},
  running:{label:'Running',j:{torso:16,neck:-8,shoulderF:-23,elbowF:95,shoulderB:97,elbowB:95,hipF:70,kneeF:-80,hipB:-38,kneeB:-75}},
  waving:{label:'Waving',j:{shoulderF:150,elbowF:35,shoulderB:-6}},
  cheering:{label:'Arms up',j:{shoulderF:132,elbowF:10,shoulderB:-132,elbowB:-10}},
  pointing:{label:'Pointing',j:{shoulderF:88,elbowF:0}},
  thinking:{label:'Thinking',j:{neck:-10,shoulderF:20,elbowF:150,shoulderB:-10,elbowB:20}},
  sitting:{label:'Sitting',j:{shoulderF:30,elbowF:55,shoulderB:20,elbowB:60,hipF:90,kneeF:-90,hipB:84,kneeB:-86},chair:true},
  jumping:{label:'Jumping',j:{shoulderF:135,elbowF:20,shoulderB:-135,elbowB:-20,hipF:30,kneeF:-70,hipB:12,kneeB:-60}},
  kneeling:{label:'Kneeling',j:{hipF:90,kneeF:-90,hipB:0,kneeB:-90,shoulderF:10,shoulderB:-10}},
  bowing:{label:'Bowing',j:{torso:60,neck:-20,shoulderF:60,elbowF:0,shoulderB:64,elbowB:0}},
  cycling:{label:'Riding a bicycle',j:{torso:28,neck:-14,shoulderF:96,elbowF:8,shoulderB:88,elbowB:10,hipF:72,kneeF:-88,hipB:28,kneeB:-62},bike:true},
  driving:{label:'Driving a car',j:{shoulderF:60,elbowF:56,shoulderB:46,elbowB:74,hipF:90,kneeF:-90,hipB:86,kneeB:-86},car:true},
  riding:{label:'Riding a horse',riding:true,j:{shoulderF:40,elbowF:50,shoulderB:34,elbowB:56,hipF:62,kneeF:-72,hipB:58,kneeB:-70}},
  lying:{label:'Lying down',j:{root:-90,neck:0,shoulderF:12,shoulderB:-12,hipF:6,hipB:-6,kneeF:0,kneeB:0}}
};
const HEADWEAR={cap:{label:'Cap',noun:'a cap'},tophat:{label:'Top hat',noun:'a top hat'},strawhat:{label:'Straw hat',noun:'a straw hat'},chefhat:{label:'Chef’s hat',noun:'a chef’s hat'},bow:{label:'Bow',noun:'a bow'},
  longhair:{label:'Long hair',hair:true},longhairbow:{label:'Long hair and bow',hair:true,noun:'a bow'},pigtails:{label:'Pigtails',hair:true},afro:{label:'Afro',hair:true},mohawk:{label:'Mohawk (punk)',hair:true},bun:{label:'Bun',hair:true},ponytail:{label:'High ponytail',hair:true},feathered:{label:'Feathered cut',hair:true}};
/* feelings are shown as a smiley in a speech bubble; the figure itself has no face */
const EMOTIONS={happy:'happy',sad:'sad',angry:'angry',surprised:'surprised',scared:'scared',tired:'tired',bored:'bored',confused:'confused',excited:'excited',inlove:'in love',dots:'',bang:'',bangbang:'',interrobang:'',emoji:''};
const BUBBLE_LABELS={emoji:'Emoji…',dots:'… (dots)',bang:'!',bangbang:'!!',interrobang:'!?'};   /* bubble contents that are not a feeling: no adjective in the caption */
/* things in the hands. upright: always stands straight up (or hangs straight down), whatever the arm does;
   the others turn with the forearm, and the grip angle turns them further round the hand */
const ITEMS={
  balloon:{label:'Balloon',phrase:'a balloon',col:'#CC0000',upright:true},
  umbrella:{label:'Umbrella',phrase:'an umbrella',col:'#0066CC',upright:true},
  flag:{label:'Flag',phrase:'a flag',col:'#00CC66',upright:true},
  cane:{label:'Walking stick',phrase:'a walking stick',col:'#663300',upright:true},
  bag:{label:'Bag',phrase:'a bag',col:'#663300',upright:true},
  ball:{label:'Ball',phrase:'a ball',col:'#0066CC'},
  book:{label:'Book',phrase:'a book',col:'#CC0000'},
  cup:{label:'Cup',phrase:'a cup',col:'#0066CC',upright:true},
  laptop:{label:'Laptop',phrase:'a laptop',col:'#666666',upright:true},
  box:{label:'Box',phrase:'a box',col:'#8a5a3a'},
  microphone:{label:'Microphone',phrase:'a microphone',col:'#333333'},
  guitar:{label:'Guitar',phrase:'a guitar',col:'#8a5a3a'},
  phone:{label:'Phone',phrase:'a phone',col:'#333333'},
  tablet:{label:'Tablet',phrase:'a tablet',col:'#333333'},
  pickaxe:{label:'Pickaxe',phrase:'a pickaxe',col:'#666666'},
  pan:{label:'Frying pan',phrase:'a frying pan',col:'#666666'},
  spatula:{label:'Kitchen spatula',phrase:'a spatula',col:'#666666'},
  reins:{label:'Horse reins',phrase:'the reins',col:'#663300',reins:true}   /* a rein from this hand to the horse's mouth: drawn only when riding a horse */
};
const PALETTE=['#222222','#666666','#CC0000','#FF6600','#FFCC00','#00CC66','#0066CC','#6600CC','#FF66CC','#663300','#00CCCC','#FFFFFF'];
const NAMES={'#222222':'black','#666666':'grey','#CC0000':'red','#FF6600':'orange','#FFCC00':'yellow','#00CC66':'green','#0066CC':'blue','#6600CC':'purple','#FF66CC':'pink','#663300':'brown','#00CCCC':'turquoise','#FFFFFF':'white','#000000':'black'};
const colourName=c=>NAMES[String(c||'').toUpperCase()]||'coloured';
const isCol=c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c);

function defaults(){
  return {schema:SCHEMA,name:'Sam',age:'adult',facing:'right',colour:'#222222',headwear:null,longHair:false,skirt:false,hunchback:false,backpack:false,dress:false,emotion:null,sweat:false,reaction:false,sleep:false,inBed:false,
    held:{front:null,back:null},itemColour:{front:null,back:null},grip:{front:0,back:0},hatAngle:0,bubbleX:0,bubbleY:0,emoji:'🙂',chair:false,bike:false,skate:false,arrow:null,arrowUp:0,car:false,carType:'car',carColour:null,lift:0,bikeColour:null,pet:null,hideFigure:false,riding:false,joints:Object.assign({},STAND)};
}
function normalize(src){
  const d=defaults(); if(!src||typeof src!=='object') return d;
  if(typeof src.name==='string') d.name=src.name.slice(0,40);
  d.age=src.age==='child'?'child':'adult'; d.facing=src.facing==='left'?'left':'right';
  d.colour=isCol(src.colour)?src.colour.toUpperCase():d.colour;
  d.headwear=HEADWEAR[src.headwear]?src.headwear:null; d.emotion=src.emotion in EMOTIONS?src.emotion:src.face in EMOTIONS?src.face:null;
  const OLD={heart:'❤️',brokenheart:'💔',skull:'💀',thumbsup:'👍',thumbsdown:'👎'}[src.emotion];   /* older files: these symbols are now emoji */
  if(OLD&&!d.emotion){ d.emotion='emoji'; src={...src,emoji:src.emoji||OLD}; }
  d.longHair=false; if(src.longHair===true&&!d.headwear) d.headwear='longhair'; d.skirt=src.skirt===true; d.hunchback=src.hunchback===true; d.backpack=src.backpack===true; { const l=Number(src.lift); d.lift=Number.isFinite(l)?Math.max(0,Math.min(3,Math.round(l*20)/20)):0; }   /* height above the floor, in heads */ d.dress=src.dress===true; if(d.dress) d.skirt=false;   /* a dress or a skirt, not both */ d.bike=src.bike===true; d.skate=src.skate===true; d.arrow=src.arrow===true?'arrow':['arrow','selector'].includes(src.arrow)?src.arrow:null; { const a=Number(src.arrowUp); d.arrowUp=Number.isFinite(a)?Math.round(Math.max(0,Math.min(STAGE.h,a))):0; } d.car=src.car===true||!!CARS[src.car]; d.carType=CARS[src.carType]?src.carType:CARS[src.car]?src.car:'car'; d.carColour=isCol(src.carColour)?src.carColour.toUpperCase():null; if(d.car){ d.bike=false; } d.bikeColour=isCol(src.bikeColour)?src.bikeColour.toUpperCase():null;
  if(src.held&&(src.held.front==='bicycle'||src.held.back==='bicycle')) d.bike=true;   /* older files: the bicycle was a hand item */ d.chair=src.chair===true; d.sweat=src.sweat===true; d.reaction=src.reaction===true; d.sleep=src.sleep===true; d.inBed=src.inBed===true; if(d.inBed){ d.car=false; d.bike=false; d.skate=false; d.chair=false; }
  for(const h of ['front','back']){ d.held[h]=src.held&&ITEMS[src.held[h]]?src.held[h]:null; d.itemColour[h]=src.itemColour&&isCol(src.itemColour[h])?src.itemColour[h].toUpperCase():null; }
  for(const h of ['front','back']){ const g=Number(src.grip&&src.grip[h]); d.grip[h]=Number.isFinite(g)?wrap(g):0; }
  { const a=Number(src.hatAngle); d.hatAngle=Number.isFinite(a)?wrap(a):0; }
  { const e=typeof src.emoji==='string'?emojiList(src.emoji.trim()).slice(0,12).join(''):''; d.emoji=e||'🙂'; }   /* the emoji in an emoji bubble (up to 12) */
  for(const k of ['bubbleX','bubbleY']){ const v=Number(src[k]); d[k]=Number.isFinite(v)?Math.round(Math.max(-STAGE.w,Math.min(STAGE.w,v))):0; }
  for(const [k] of JOINTS){ const v=Number(src.joints&&src.joints[k]); d.joints[k]=Number.isFinite(v)?wrap(v):STAND[k]; }
  d.pet=petNormalize(src.pet); d.hideFigure=!!d.pet&&src.hideFigure===true;
  d.riding=!!d.pet&&d.pet.type==='horse'&&!d.hideFigure&&src.riding===true; if(d.riding){ d.facing=d.pet.facing; d.chair=d.bike=d.car=d.skate=d.inBed=false; d.lift=0; }   /* on horseback: facing the horse's way, nothing else to sit on */   /* an animal on its own, or beside the figure */
  return d;
}
function applyPose(d,id){ const p=POSES[id]; if(!p) return d; d.joints=Object.assign({},STAND,p.j); d.chair=!!p.chair; d.bike=!!p.bike; d.car=!!p.car; d.riding=!!p.riding; return d; }
function mirror(d){ d.facing=d.facing==='left'?'right':'left'; return d; }

/* ── geometry. Everything is worked out facing right (+x = forward), then flipped for a figure facing left ── */
const rad=a=>a*Math.PI/180, n2=v=>Math.round(v*100)/100;
const down=a=>[Math.sin(rad(a)),Math.cos(rad(a))];       /* a limb at angle a: 0 = straight down, + = forward */
const up=a=>[Math.sin(rad(a)),-Math.cos(rad(a))];         /* the spine or neck at angle a: 0 = straight up, + = forward */
const add=(p,v,k)=>[p[0]+v[0]*k,p[1]+v[1]*k];
function skeleton(d){
  const B=BUILD[d.age], j=d.joints, L=B.torso*H, leg=(B.hip-0.125)*H, thigh=leg/2, shin=leg/2;
  const hip=[0,0], rt=j.root+j.torso;
  /* spine: straight, or bent forward so the shoulders come half a head in front of the hip */
  let sh, ctrl=null, tang;
  if(d.hunchback){ const f=0.5*H, h=Math.sqrt(Math.max(L*L-f*f,1)), u=up(rt), fw=[Math.cos(rad(rt)),Math.sin(rad(rt))];
    sh=add(add(hip,u,h),fw,f); ctrl=add(hip,u,h*0.55);   /* the back rounds, and the neck comes out forward */
    const t=[sh[0]-ctrl[0],sh[1]-ctrl[1]], m=Math.hypot(t[0],t[1]); tang=Math.atan2(t[0],-t[1])*180/Math.PI; }
  else { sh=add(hip,up(rt),L); tang=rt; }
  const na=(d.hunchback?rt+(tang-rt)*0.55:tang)+j.neck, nu=up(na), head=add(sh,nu,0.25*H+H/2);   /* a quarter-head neck, then the head */
  const neckEnd=add(sh,nu,0.25*H+H/2-R);
  const arm=(s,e)=>{ const a1=s-rt, el=add(sh,down(a1),B.upper*H), a2=a1+e; return {a1,a2,el,hand:add(el,down(a2),B.fore*H)}; };
  const legP=(hp,kn)=>{ const a1=hp-j.root, kn_=add(hip,down(a1),thigh), a2=a1+kn; return {a1,a2,knee:kn_,foot:add(kn_,down(a2),shin)}; };
  return {B,hip,sh,ctrl,tang,na,head,neckEnd,armF:arm(j.shoulderF,j.elbowF),armB:arm(j.shoulderB,j.elbowB),legF:legP(j.hipF,j.kneeF),legB:legP(j.hipB,j.kneeB)};
}
/* the lowest point of the body sits on the floor (or, sitting, the feet do and the chair takes the hips) */
/* a bicycle seen side on, its saddle under the hips: sizes follow the rider's hip height */
const bikeGeo=(k,d)=>{ const s0=k.B.hip/1.5, sh=1.45*H*s0, s=Math.max(s0,0.8), r=Math.min(0.6*H*s,sh*0.62), g=k.hip[1]+S*0.7+sh;
  return {s,r,g,saddle:[0,k.hip[1]+S*0.7],bb:[0.3*H*s,g-r*0.95],rear:[-0.8*H*s,g-r],front:[1.5*H*s,g-r],headTop:[1.17*H*s,k.hip[1]-0.1*H*s],headBot:[1.25*H*s,k.hip[1]+0.45*H*s]}; };
/* a car seen side on, the driver sitting inside: the body and cabin hide everything but the head */
const CARS={car:{label:'Car',noun:'a car'},longcar:{label:'Long low car',noun:'a car'},pickup:{label:'Pickup truck',noun:'a pickup truck'},suv:{label:'SUV',noun:'an SUV'}};
const carGeo=(k,type)=>{ const x=k.hip[0], g=k.hip[1]+1.2*H, r=0.38*H, top=k.head[1]-R;
  const T={car:{belt:-0.1,roof:0.35,front:3.1,rear:-2.4,cabF:1.45,cabR:-1.1,hood:2.25,trunk:-1.85,wF:2.05,wR:-1.45},
    longcar:{belt:0,roof:0.12,front:3.7,rear:-3.0,cabF:1.6,cabR:-1.0,hood:2.7,trunk:-2.1,wF:2.6,wR:-2.0},
    pickup:{belt:-0.15,roof:0.35,front:3.1,rear:-3.4,cabF:1.35,cabR:-0.75,hood:2.2,trunk:-0.75,wF:2.05,wR:-2.3,bed:true},
    suv:{belt:-0.2,roof:0.6,front:3.0,rear:-2.6,cabF:1.4,cabR:-2.55,hood:2.15,trunk:-2.6,wF:2.0,wR:-1.7,box:true}}[type]||{};
  const q=v=>x+v*H;
  return {g,r,belt:k.hip[1]+T.belt*H,roof:top-Math.max(T.roof,0.5)*H,front:q(T.front),rear:q(T.rear),bottom:g-0.55*H,cabF:q(T.cabF),cabR:q(T.cabR),hood:q(T.hood),trunk:q(T.trunk),wF:q(T.wF),wR:q(T.wR),bed:T.bed,box:T.box,wheel:[x+1.05*H,k.hip[1]-0.7*H]}; };
/* a bed seen side on: the head on the pillow, the body under the sheet toward the foot of the bed, a single-line post at the head end */
const bedGeo=k=>{ const dir=k.hip[0]>=k.sh[0]?1:-1, x=k.sh[0]-dir*0.75*H, top=k.sh[1]+R+S/2+0.17*H, bot=top+0.45*H;   /* fixed to the shoulders, so the head can lift off the pillow */
  return {dir,x,top,bot,floor:bot+0.6*H,head:x-dir*1.0*H,foot:x+dir*4.6*H}; };
function lowest(k,d){
  if(d.inBed) return bedGeo(k).floor+S/2;
  if(d.car) return carGeo(k,d.carType).g+S/2;
  if(d.skate) return Math.max(k.legF.foot[1],k.legB.foot[1])+S/2+0.5*H;   /* standing on a skateboard: deck and wheels under the feet */   /* in a car, the wheels stand on the floor */
  if(d.bike) return bikeGeo(k,d).g+S/2;   /* on a bicycle, the wheels stand on the floor */
  const pts=[k.legF.foot,k.legB.foot,k.legF.knee,k.legB.knee,k.armF.hand,k.armB.hand,k.armF.el,k.armB.el,k.sh,k.hip];
  let y=Math.max(...pts.map(p=>p[1]+S/2)); y=Math.max(y,k.head[1]+R+S/2);
  if(d.skirt){ const sk=skirtPts(k,d); y=Math.max(y,...sk.map(p=>p[1]+S/2)); }
  if(d.dress){ const dr=dressPath(k,d,p=>''); y=Math.max(y,...dr.pts.map(p=>p[1]+S/2)); }
  return y;
}
/* a dress: from the shoulder point, curving in at the waist and out to a hem lower than a skirt's */
function dressPath(k,d,P){
  const len=k.B.hip*H/2, w=k.B.hip*H/3, tF=add(k.hip,down(k.legF.a1),len*1.4), tB=add(k.hip,down(k.legB.a1),len*1.4);
  let c=[(tF[0]+tB[0])/2,(tF[1]+tB[1])/2], gap=Math.hypot(tF[0]-tB[0],tF[1]-tB[1]);
  let u=gap>1?[(tF[0]-tB[0])/gap,(tF[1]-tB[1])/gap]:null;
  if(!u||Math.hypot(c[0]-k.hip[0],c[1]-k.hip[1])<0.3*H){ const v=down(-d.joints.root); if(!u) c=add(k.hip,v,len*1.4); u=u||[-v[1],v[0]]; }
  const half=Math.max(w*1.15,gap/2+0.3*H), hF=add(c,u,half), hB=add(c,u,-half);
  /* each side bows in toward the middle of the dress, so it curves even when it hangs straight */
  const mF=[(k.sh[0]+hF[0])/2,(k.sh[1]+hF[1])/2], mB=[(k.sh[0]+hB[0])/2,(k.sh[1]+hB[1])/2], mid=[(mF[0]+mB[0])/2,(mF[1]+mB[1])/2];
  const inw=(m)=>{ const v=[mid[0]-m[0],mid[1]-m[1]], l=Math.hypot(v[0],v[1])||1; return add(m,[v[0]/l,v[1]/l],Math.min(0.32*H,l*0.8)); };
  const wF=inw(mF), wB=inw(mB);
  return {pts:[k.sh,hF,hB],d:`M${P(k.sh)}Q${P(wF)} ${P(hF)}L${P(hB)}Q${P(wB)} ${P(k.sh)}Z`};
}
function skirtPts(k,d){   /* a triangle from the hip; its lower side, half the hip height away, stretches to take in both thighs */
  const len=k.B.hip*H/2, w=k.B.hip*H/3, tF=add(k.hip,down(k.legF.a1),len), tB=add(k.hip,down(k.legB.a1),len);
  let c=[(tF[0]+tB[0])/2,(tF[1]+tB[1])/2], gap=Math.hypot(tF[0]-tB[0],tF[1]-tB[1]);
  let u=gap>1?[(tF[0]-tB[0])/gap,(tF[1]-tB[1])/gap]:null;
  if(!u||Math.hypot(c[0]-k.hip[0],c[1]-k.hip[1])<0.25*H){ const v=down(-d.joints.root); if(!u) c=add(k.hip,v,len); u=u||[-v[1],v[0]]; }
  const half=Math.max(w,gap/2+0.3*H);
  return [k.hip,add(c,u,half),add(c,u,-half)];
}
/* things in the hands: outlines only, in the same marker. Upright things are drawn in the stage frame at the hand;
   the others in the hand's frame, where +y runs on along the forearm */
function itemSVG(id,c,hand,ground,col,f,u){   /* upright things */
  const [x,y]=hand, st=`stroke="${c}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round" fill="none"`, ln=`fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`;
  switch(id){
    case 'balloon': return `<path d="M${x},${y}Q${x+8},${y-34} ${x},${y-62}" ${ln}/><ellipse cx="${x}" cy="${y-92}" rx="24" ry="29" ${st}/>`;
    case 'bag': return `<path d="M${x-10},${y+16}L${x},${y}L${x+10},${y+16}" ${ln}/><rect x="${x-21}" y="${y+16}" width="42" height="32" rx="4" ${st}/>`;
    case 'cane': {   /* the hook curls back toward the figure; the hand sits on the arc where the forearm meets it square
         (along the arc's radius), so the cane moves to the hand and the arm keeps its length */
      const r=(0.25*H+S)/2; let th=Math.atan2(-u[1],-u[0]); th=((th%(2*Math.PI))+2*Math.PI)%(2*Math.PI); if(th<Math.PI) th=th<Math.PI/2?2*Math.PI:Math.PI;   /* only the upper half of the hook can be held */
      const cx=x-r*Math.cos(th), cy=y-r*Math.sin(th), sx=cx+f*r, tx=cx-f*r;
      return `<path d="M${n2(sx)},${n2(Math.max(ground,cy))}V${n2(cy)}A${n2(r)},${n2(r)} 0 0 ${f>0?0:1} ${n2(tx)},${n2(cy)}v${n2(0.3*H)}" ${st}/>`; }
    case 'umbrella': {   /* J-hook handle in the hand; the shaft stops at the canopy's edge and shows again as a tip above it */
      const X=v=>n2(x-f*v), top=y-93;   /* the J hook curls the opposite way to the cane's */
      return `<path d="M${X(-13)},${y+10}Q${X(-13)},${y+22} ${X(-6)},${y+22}Q${x},${y+22} ${x},${y+12}V${y-64}M${x},${top}V${n2(top-0.5*H)}" ${ln}/>`
        +`<path d="M${x-62},${y-62}Q${x},${y-124} ${x+62},${y-62}Q${x+41},${y-74} ${x+21},${y-62}Q${x},${y-74} ${x-21},${y-62}Q${x-41},${y-74} ${x-62},${y-62}Z" ${st}/>`; }   /* four spoke tips along the edge */
    case 'cup': {   /* held by the handle, always upright; steam rises in one and a half S-bends and ends in a wider curl */
      const X=v=>n2(x+f*v), Y=v=>n2(y+v), Pp=(a,b)=>`${X(a)},${Y(b)}`;
      return `<path d="M${Pp(8,-14)}H${X(40)}L${Pp(37,16)}H${X(11)}Z" ${st}/><path d="M${Pp(9,-7)}Q${Pp(-4,-7)} ${Pp(-2,3)}Q${Pp(0,12)} ${Pp(10,9)}" ${st}/>`
        +`<path d="M${Pp(24,-24)}C${Pp(14,-32)} ${Pp(34,-38)} ${Pp(24,-46)}C${Pp(14,-54)} ${Pp(34,-60)} ${Pp(25,-68)}C${Pp(18,-74)} ${Pp(22,-86)} ${Pp(31,-84)}C${Pp(40,-82)} ${Pp(38,-70)} ${Pp(29,-72)}" fill="none" stroke="#999" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"/>`; }
    case 'laptop': {   /* side on, open, resting level on the hand: the base toward the figure, the screen leaning away */
      const X=v=>n2(x-f*v);
      return `<path d="M${X(-0.35*H)},${y-S}H${X(-0.35*H+Math.hypot(0.2,0.8)*H)}M${X(-0.35*H)},${y-S}L${X(-0.55*H)},${n2(y-S-0.8*H)}" ${st}/>`; }
    case 'bicycle': {   /* side on, beside the figure: the hand on the handlebar, both wheels on the ground, the back wheel behind */
      const r=0.62*H, gy=ground-r, X=v=>n2(x+f*v), fa=[0.35*H,gy], ra=[-1.85*H,gy], bb=[-0.8*H,gy], stem=[0.12*H,Math.min(y+0.3*H,gy-0.9*H)], seat=[-1.05*H,Math.min(y+0.15*H,gy-1.05*H)];
      const L=(a,b)=>`M${X(a[0])},${n2(a[1])}L${X(b[0])},${n2(b[1])}`;
      return `<circle cx="${X(fa[0])}" cy="${n2(gy)}" r="${r}" ${st}/><circle cx="${X(ra[0])}" cy="${n2(gy)}" r="${r}" ${st}/><path d="${L(fa,stem)}${L(stem,[0,y])}${L([-0.12*H,y],[0.18*H,y])}${L(stem,seat)}${L(stem,bb)}${L(seat,bb)}${L(bb,ra)}${L(seat,ra)}${L([seat[0]-0.22*H,seat[1]],[seat[0]+0.18*H,seat[1]])}" ${st}/>`; }
    case 'flag': return `<path d="M${x},${y+10}V${y-70}" ${ln}/><path d="M${x},${y-70}H${x+50}V${y-34}H${x}" ${st}/>`;
  }
  return '';
}
function heldSVG(id,c,col){   /* things that turn with the hand */
  const st=`stroke="${c}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round" fill="none"`, wood=`stroke="#8a5a3a" stroke-width="${S}" stroke-linecap="round" fill="none"`;
  switch(id){
    case 'ball': return `<circle cx="0" cy="12" r="19" ${st}/>`;
    case 'book': return `<rect x="-17" y="-8" width="34" height="42" rx="3" ${st}/><path d="M-9,-8V34" ${st}/>`;
    case 'box': return `<rect x="-24" y="-2" width="48" height="40" rx="2" ${st}/><path d="M-24,10H24" ${st}/>`;
    case 'microphone': return `<g transform="translate(0 ${-0.25*H})"><path d="M-3,-6L-8,${0.6*H}H8L3,-6Z" ${st}/><circle cx="0" cy="${0.6*H+11}" r="11" ${st}/></g>`;   /* the handle tapers away from the round receiver; held a quarter head up the handle */
    case 'guitar': return `<g transform="translate(0 ${-0.25*H})"><path d="M0,${-0.35*H}V${0.85*H}M-6,${-0.35*H}H6" ${st}/><path d="M0,${0.85*H}C${-0.5*H},${0.85*H} ${-0.45*H},${1.3*H} ${-0.3*H},${1.4*H}C${-0.65*H},${1.55*H} ${-0.6*H},${2.15*H} 0,${2.15*H}C${0.6*H},${2.15*H} ${0.65*H},${1.55*H} ${0.3*H},${1.4*H}C${0.45*H},${1.3*H} ${0.5*H},${0.85*H} 0,${0.85*H}Z" ${st}/></g>`;   /* held a quarter head further up the neck, toward the body */
    case 'phone': return `<rect x="-10" y="-14" width="20" height="34" rx="4" ${st}/>`;
    case 'tablet': return `<rect x="-22" y="-12" width="44" height="58" rx="5" ${st}/>`;
    case 'pickaxe': return `<path d="M0,${-0.2*H}V${1.45*H}" ${wood}/><path d="M${-0.8*H},${1.45*H}Q0,${1.75*H} ${0.8*H},${1.45*H}" ${st}/>`;
    case 'pan': return `<path d="M0,-6V${1.0*H}" ${st}/><path d="M8,${1.0*H}L-9,${1.15*H}V${2.15*H}L8,${2.3*H}Z" ${st}/>`;   /* seen side on: the handle, then the shallow pan, open on the +x side */
    case 'spatula': return `<path d="M0,-6V${1.15*H}" ${wood}/><path d="M-3,${1.15*H}L-11,${1.3*H}V${1.95*H}H11V${1.3*H}L3,${1.15*H}" ${st}/>`;
  }
  return '';
}
/* a feeling, as just eyes (short upright lines) and a mouth, in the same marker; eyes and mouth sit a line width apart
   more than a plain face would, so they read at a glance. "dots" and "heart" fill the bubble on their own. */
function smiley(e,col){
  const st=`fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`, P=d=>d?`<path d="${d}" ${st}/>`:'';
  const E='M-14,-13V-5M14,-13V-5', heart=(x,y,k)=>`M${x},${y+8*k}L${x-8*k},${y}Q${x-11*k},${y-7*k} ${x-5*k},${y-8*k}Q${x-2*k},${y-8*k} ${x},${y-4*k}Q${x+2*k},${y-8*k} ${x+5*k},${y-8*k}Q${x+11*k},${y-7*k} ${x+8*k},${y}Z`;
  const dot=(x,y)=>`<path d="M${x},${y}h0" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round"/>`, ex=x=>P(`M${x},-20V3`)+dot(x,17);
  if(e==='bang') return ex(0);
  if(e==='bangbang') return ex(-11)+ex(11);
  if(e==='interrobang') return ex(-12)+P('M2,-12Q2,-21 11,-21Q20,-21 20,-12Q20,-5 11,-2V4')+dot(11,17);
  if(e==='dots') return `<path d="M-22,0h0M0,0h0M22,0h0" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round"/>`;
  const F={
    happy:[E,'M-17,4Q0,19 17,4'], sad:[E,'M-15,15Q0,3 15,15'], angry:['M-18,-15L-10,-6M18,-15L10,-6','M-14,13Q0,6 14,13'],
    surprised:['M-14,-16V-6M14,-16V-6',''], scared:[E,'M-18,10l6,-5l6,5l6,-5l6,5l6,-5l6,5'], tired:['M-19,-8H-9M9,-8H19','M-8,10H8'],
    bored:['M-14,-10V-7M14,-10V-7','M-14,10H14'], confused:[E,'M-16,12Q-8,3 0,10T16,7'], excited:[E,'M-17,1H17Q17,18 0,18Q-17,18 -17,1Z'],
    inlove:[heart(-14,-9,1)+heart(14,-9,1).replace('M','M'),'M-15,8Q0,19 15,8']}[e];
  if(!F) return '';
  return `<g transform="translate(0 ${-S/2})">${P(F[0])}</g><g transform="translate(0 ${S/2})">${P(F[1])}${e==='surprised'?`<ellipse cx="0" cy="9" rx="6" ry="7" ${st}/>`:''}</g>`;
}
/* a speech bubble 3 heads wide and 2.5 heads tall (outside the line), up and in front of the head, its tail toward the head.
   One outline: the ellipse leaves a gap where the tail goes. (ox, oy) moves it from where it would sit. */
/* an arrow (or the selector triangle) pointing down, its tip at tip */
function arrowAt(kind,tip,col){
  const i=S/2, w=0.75*H-i, hh=0.95*H;
    const P2=p=>`${n2(p[0])},${n2(p[1])}`, y0=tip[1]-2*H+i, y1=tip[1]-hh, ty=tip[1]-i;
    /* selector: just the triangle; arrow: a central shaft with two legs */
  return kind==='selector'
      ?`<path data-arrow="1" d="M${n2(tip[0]-w)},${n2(y1)}H${n2(tip[0]+w)}L${P2([tip[0],ty])}Z" fill="transparent" stroke="${col}" stroke-width="${S}" stroke-linejoin="round"/>`
      :`<path data-arrow="1" d="M${n2(tip[0])},${n2(y0)}V${n2(ty)}M${n2(tip[0]-w)},${n2(y1)}L${P2([tip[0],ty])}L${n2(tip[0]+w)},${n2(y1)}" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"/><path data-arrow="1" d="M${n2(tip[0]-w)},${n2(y0)}H${n2(tip[0]+w)}V${n2(ty)}H${n2(tip[0]-w)}Z" fill="transparent" stroke="none"/>`;
}
/* one entry per emoji (a flag, a skin tone or a family is one) */
function emojiList(t){ if(!t) return []; if(typeof Intl!=='undefined'&&Intl.Segmenter) return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(t)].map(x=>x.segment).filter(x=>x.trim()); return Array.from(t).filter(x=>x.trim()); }
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function bubbleSVG(e,hc,f,col,ox,oy,free,emoji){   /* free: may rise above the top of the stage (the view grows to fit) */
  const rx=1.5*H-S/2, ry=1.25*H-S/2;
  /* emoji, a head high and side by side: past one, the bubble grows sideways into a pill (straight top and bottom, the same rounded ends) */
  const em=e==='emoji'?emojiList(emoji||'🙂'):[], hl=Math.max(0,em.length*0.6*H-0.8*H);
  let cx=hc[0]+f*(1.6*H+hl)+ox, cy=hc[1]-2.15*H+oy;
  cx=Math.max(1.5*H+hl+2,Math.min(STAGE.w-1.5*H-hl-2,cx)); cy=Math.min(STAGE.ground-1.25*H,free?cy:Math.max(1.25*H+2,cy));
  const toHead=Math.atan2(hc[1]-cy,hc[0]-cx)*180/Math.PI;   /* the tail leaves the side of the bubble that faces the head */
  const P=p=>`${n2(p[0])},${n2(p[1])}`, st=`fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`;
  let outline, hit, mid;
  if(!hl){
    const on=deg=>[cx+rx*Math.cos(rad(deg)),cy+ry*Math.sin(rad(deg))], a1=toHead-13, a2=toHead+13, p1=on(a1), p2=on(a2);
    mid=on(toHead); outline=p=>`M${P(p2)}A${n2(rx)},${n2(ry)} 0 1 1 ${P(p1)}L${P(p)}Z`;
    hit=`<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(rx)}" ry="${n2(ry)}" fill="transparent" stroke="none"/>`; }
  else {
    /* the pill's outline as close-set points, clockwise from the top of the right end; the tail's gap is cut out of it */
    const pts=[];
    for(let a=-90;a<90;a+=2) pts.push([cx+hl+rx*Math.cos(rad(a)),cy+ry*Math.sin(rad(a))]);
    for(let x=hl;x>-hl;x-=3) pts.push([cx+x,cy+ry]);
    for(let a=90;a<270;a+=2) pts.push([cx-hl+rx*Math.cos(rad(a)),cy+ry*Math.sin(rad(a))]);
    for(let x=-hl;x<hl;x+=3) pts.push([cx+x,cy-ry]);
    const ang=q=>Math.abs(wrapD(Math.atan2(q[1]-cy,q[0]-cx)*180/Math.PI-toHead));
    let mi=0; pts.forEach((q,i)=>{ if(ang(q)<ang(pts[mi])) mi=i; }); mid=pts[mi];
    const gap=0.45*ry, n=pts.length; let i1=mi, i2=mi, L=0;   /* the gap: as long as the round bubble's */
    while(L<gap){ const j=(i1-1+n)%n; L+=Math.hypot(pts[j][0]-pts[i1][0],pts[j][1]-pts[i1][1]); i1=j; }
    L=0; while(L<gap){ const j=(i2+1)%n; L+=Math.hypot(pts[j][0]-pts[i2][0],pts[j][1]-pts[i2][1]); i2=j; }
    const run=[]; for(let i=i2;i!==i1;i=(i+1)%n) run.push(pts[i]); run.push(pts[i1]);
    outline=p=>`M${run.map(P).join('L')}L${P(p)}Z`;
    hit=`<path d="M${n2(cx+hl)},${n2(cy-ry)}A${n2(rx)},${n2(ry)} 0 0 1 ${n2(cx+hl)},${n2(cy+ry)}H${n2(cx-hl)}A${n2(rx)},${n2(ry)} 0 0 1 ${n2(cx-hl)},${n2(cy-ry)}Z" fill="transparent" stroke="none"/>`; }
  const d0=Math.hypot(hc[0]-cx,hc[1]-cy), reach=Math.max(0.35*H, d0-Math.hypot(mid[0]-cx,mid[1]-cy)-0.85*H);
  const tip=[mid[0]+Math.cos(rad(toHead))*reach,mid[1]+Math.sin(rad(toHead))*reach];
  const emSvg=em.map((x,i)=>`<text x="${n2((i-(em.length-1)/2)*1.2*H)}" y="0" font-size="${H}" text-anchor="middle" dominant-baseline="central" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${esc(x)}</text>`).join('');
  return {box:[cx-rx-hl-S/2,cy-ry-S/2,cx+rx+hl+S/2,cy+ry+S/2],c:[cx,cy],svg:`<g class="stick-bubble" data-bubble="1">${hit}`
    +`<path d="${outline(tip)}" ${st}/>`
    +`<g transform="translate(${n2(cx)} ${n2(cy)})">${em.length?emSvg:smiley(e,col)}</g></g>`};
}
const wrapD=v=>((v+180)%360+360)%360-180;
function headwearSVG(id,col){
  const st=`fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`;
  if(id==='cap'){   /* one straight line, rising at 30°: across the head (the crown's edge) and out at the front as the peak */
    const v=[Math.cos(rad(-30)),Math.sin(rad(-30))], p0=[0,-0.35*R], b=p0[0]*v[0]+p0[1]*v[1], c=p0[0]*p0[0]+p0[1]*p0[1]-R*R, r=Math.sqrt(b*b-c);
    const t0=-b-r, t1=-b+r+0.55*H;
    return `<path d="M${n2(p0[0]+v[0]*t0)},${n2(p0[1]+v[1]*t0)}L${n2(p0[0]+v[0]*t1)},${n2(p0[1]+v[1]*t1)}" ${st}/>`; }
  if(id==='tophat') return `<path d="M${n2(-0.62*H)},${n2(-R+1)}H${n2(0.62*H)}M${n2(-0.32*H)},${n2(-R+1)}V${n2(-R-0.75*H)}H${n2(0.32*H)}V${n2(-R+1)}" ${st}/>`;
  if(id==='strawhat') return `<path d="M${n2(-1.05*H)},${n2(-0.45*R)}Q0,${n2(-0.7*R)} ${n2(1.05*H)},${n2(-0.45*R)}M${n2(-0.45*H)},${n2(-0.58*R)}Q${n2(-0.45*H)},${n2(-R-0.3*H)} 0,${n2(-R-0.3*H)}Q${n2(0.45*H)},${n2(-R-0.3*H)} ${n2(0.45*H)},${n2(-0.58*R)}" ${st}/>`;
  if(id==='chefhat'){ const b=-0.62*R, top=b-0.42*H;   /* a band round the head, and a puffy top */
    return `<path d="M${n2(-0.42*H)},${n2(b)}V${n2(top)}H${n2(0.42*H)}V${n2(b)}" ${st}/><path d="M${n2(-0.42*H)},${n2(top)}C${n2(-0.95*H)},${n2(top-0.3*H)} ${n2(-0.8*H)},${n2(top-1.35*H)} ${n2(-0.3*H)},${n2(top-1.15*H)}C${n2(-0.2*H)},${n2(top-1.6*H)} ${n2(0.3*H)},${n2(top-1.6*H)} ${n2(0.3*H)},${n2(top-1.15*H)}C${n2(0.8*H)},${n2(top-1.35*H)} ${n2(0.95*H)},${n2(top-0.3*H)} ${n2(0.42*H)},${n2(top)}" ${st}/>`; }
  const at=(a,r)=>`${n2(r*Math.sin(rad(a)))},${n2(-r*Math.cos(rad(a)))}`;
  const long=`<path d="M${at(-35,R)}Q${n2(-R-7)},2 ${n2(-R+3)},${n2(R+0.7*H)}" ${st}/>`;
  if(id==='longhair') return long;
  if(id==='ponytail'){   /* one curve from high on the head, out and down behind, its end flaring into two short wisps */
    const e=[-(R+0.6*H)*Math.sin(rad(120)),(R+0.6*H)*Math.cos(rad(120))*-1];
    return `<path d="M${at(-20,R)}Q${at(-50,R+0.95*H)} ${at(-118,R+0.62*H)}l-6,10M${at(-118,R+0.62*H)}l7,9" ${st}/>`; }
  if(id==='feathered') return `<path d="M${at(-35,R)}Q${n2(-R-9)},0 ${n2(-R-2)},${n2(R+0.42*H)}Q${n2(-R-3)},${n2(R+0.72*H)} ${n2(-R-16)},${n2(R+0.62*H)}" ${st}/><path d="M${at(35,R+0.02*H)}Q${at(5,R+0.42*H)} ${at(-40,R+0.3*H)}" ${st}/>`;   /* layers swept back from the face, the ends flicked out to the back */
  if(id==='bun'){ const a=-45, r=R+S/2+11; return `<path transform="translate(${n2(r*Math.sin(rad(a)))} ${n2(-r*Math.cos(rad(a)))}) rotate(${a})" d="M0,9C4,4 7,0 7,-3A7,7 0 1 0 -7,-3C-7,0 -4,4 0,9Z" ${st}/>`; }   /* a small teardrop of hair, its point toward the head */   /* a small knot of hair touching the back of the head */
  if(id==='longhairbow') return long+headwearSVG('bow',col);
  if(id==='pigtails') return [-1,1].map(s=>`<path d="M${at(s*72,R)}Q${at(s*80,R+0.35*H)} ${at(s*100,R+0.62*H)}" ${st}/><path d="M${at(s*78,R+0.12*H)}l${s*3},-6" ${st}/>`).join('');
  if(id==='afro'){ let p=`M${at(-118,R)}`; for(let a=-118;a<118;a+=26){ const b=a+26; p+=`Q${at(a+13,R+0.62*H)} ${at(b,R+0.26*H)}`; } return `<path d="${p}" ${st}/>`; }
  if(id==='mohawk'){ let p=`M${at(-55,R)}`; for(let a=-55;a<55;a+=22){ p+=`L${at(a+11,R+0.55*H)}L${at(a+22,R)}`; } return `<path d="${p}" ${st}/>`; }
  if(id==='bow'){ const a=-40, x=n2(R*Math.sin(rad(a))), y=n2(-R*Math.cos(rad(a)));   /* two triangles on the top of the head toward the back */
    return `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0,-6L-20,-17V8ZM0,-6L20,-17V8Z" ${st}/></g>`; }
  return '';
}

/* ── animals: a dog, a cat or a horse, side on, in the same marker. Standalone (hideFigure) or beside the figure.
   Built facing right with the middle of the body at (0,0), then placed on the floor.
   Pet joint angles, in degrees, positive = forward / clockwise when facing right:
     root  body tilt (+ = nose down) · neck, tail: from their natural set (0 = rest) · head: 0 = level
     legs (FF/FB front near/far, HF/HB hind near/far): 0 = straight down, + = forward · knees: against the leg above ── */
const PETS={
  cat:{label:'Cat',noun:'a cat',sc:0.833,len:1.3,ry:0.26,up:0.34,lo:0.32,neck:0.15,neckA:50,headR:0.3,tail:1.05,tailA:-25,dist:2.4},
  dog:{label:'Dog',noun:'a dog',sc:0.78,len:1.75,ry:0.33,up:0.46,lo:0.44,neck:0.32,neckA:40,headR:0.3,tail:0.6,tailA:-40,dist:2.8},
  horse:{label:'Horse',noun:'a horse',sc:1.0,len:2.9,ry:0.55,up:1.0,lo:1.0,neck:1.65,neckA:38,tail:1.25,tailA:-150,dist:5.2}};
const PET_JOINTS=[['root','Body tilt'],['neck','Neck'],['head','Head'],['tail','Tail'],['ears','Ears'],['legFF','Front leg (near)'],['kneeFF','Front knee (near)'],['legFB','Front leg (far)'],['kneeFB','Front knee (far)'],
  ['legHF','Back leg (near)'],['kneeHF','Back knee (near)'],['legHB','Back leg (far)'],['kneeHB','Back knee (far)'],['ankleFF','Front fetlock (near, horse)'],['ankleFB','Front fetlock (far, horse)'],['ankleHF','Back fetlock (near, horse)'],['ankleHB','Back fetlock (far, horse)']].map(([k,l])=>[k,l,-180,180]);
const PET_STAND={root:0,neck:0,head:0,tail:0,ears:0,legFF:4,kneeFF:0,legFB:-4,kneeFB:0,legHF:4,kneeHF:-4,legHB:-4,kneeHB:-4,ankleFF:0,ankleFB:0,ankleHF:0,ankleHB:0};
const PET_POSES={
  standing:{label:'Standing',j:{}},
  walking:{label:'Walking',j:{legFF:22,kneeFF:-25,legFB:-14,legHF:-16,kneeHF:0,legHB:20,kneeHB:20}},
  running:{label:'Running',j:{root:-4,neck:-10,tail:20,legFF:55,kneeFF:-10,legFB:20,kneeFB:-70,legHF:-50,kneeHF:20,legHB:15,kneeHB:45}},
  sitting:{label:'Sitting',j:{root:-40,neck:-5,head:40,tail:-55,legFF:-40,kneeFF:0,legFB:-36,kneeFB:0,legHF:50,kneeHF:-170,legHB:46,kneeHB:-170}},
  lying:{label:'Lying down',j:{root:0,neck:-15,head:0,tail:-70,legFF:86,kneeFF:0,legFB:80,kneeFB:0,legHF:84,kneeHF:-165,legHB:78,kneeHB:-165}},
  begging:{label:'On its back legs',j:{root:-58,neck:-10,head:55,tail:-30,legFF:16,kneeFF:-75,legFB:6,kneeFB:-80,legHF:-58,kneeHF:0,legHB:-50,kneeHB:-6}},
  eating:{label:'Eating / grazing',j:{neck:75,head:60}}};
function petNormalize(src){
  if(!src||typeof src!=='object'||!PETS[src.type]) return null;
  const p={type:src.type,colour:isCol(src.colour)?src.colour.toUpperCase():'#222222',facing:src.facing==='right'?'right':'left',joints:{}};
  const dd=Number(src.dist); p.dist=Number.isFinite(dd)?Math.max(-8,Math.min(8,Math.round(dd*4)/4)):PETS[src.type].dist;
  for(const [k] of PET_JOINTS){ const v=Number(src.joints&&src.joints[k]); p.joints[k]=Number.isFinite(v)?wrap(v):PET_STAND[k]; }
  return p;
}
function applyPetPose(p,id){ const q=PET_POSES[id]; if(!p||!q) return p; p.joints=Object.assign({},PET_STAND,q.j); return p; }
/* the animal's own frame: facing right, body centre at the origin */
function petBuild(p){
  const T=PETS[p.type], H=40*T.sc, j=p.joints, L=T.len*H, ry=T.ry*H, rx=L/2, r0=j.root, fw=[Math.cos(rad(r0)),Math.sin(rad(r0))], nm=[-Math.sin(rad(r0)),Math.cos(rad(r0))];
  const at=(a,b)=>[fw[0]*a+nm[0]*b,fw[1]*a+nm[1]*b];
  const horse=p.type==='horse';
  const legP=(base,a,kn,an)=>{ const a1=a-r0, k1=add(base,down(a1),T.up*H), a2=a1+kn;
    if(!horse) return {a1,a2,base,knee:k1,foot:add(k1,down(a2),T.lo*H)};
    const m=add(k1,down(a2),T.lo*H*2/3), a3=a2+an;   /* a horse's lower leg has another joint (the fetlock), a third of the way up from the hoof */
    return {a1,a2,a3,base,knee:k1,ankle:m,foot:add(m,down(a3),T.lo*H/3)}; };
  const sh=at(rx*0.72,ry*0.45), hp=at(-rx*0.72,ry*0.45);
  const legs={FF:legP(sh,j.legFF,j.kneeFF,j.ankleFF),FB:legP(add(sh,fw,-0.06*H),j.legFB,j.kneeFB,j.ankleFB),HF:legP(hp,j.legHF,j.kneeHF,j.ankleHF),HB:legP(add(hp,fw,0.06*H),j.legHB,j.kneeHB,j.ankleHB)};
  const nb=p.type==='horse'?at(rx*0.78,-ry*0.55):at(rx*0.85,-ry*0.35), na=r0+T.neckA+j.neck, nt=add(nb,up(na),T.neck*H);
  const ha=r0+j.head, head=p.type==='horse'?nt:add(nt,up(na),T.headR*H*0.85);
  const tb=p.type==='horse'?at(-rx*0.96,-ry*0.45):at(-rx*0.95,-ry*0.25), ta=r0+T.tailA+j.tail;
  /* the saddle (horse): the seat sits on top of the back, a little behind the middle */
  const saddle={seat:at(-0.05*H,-ry-S),back:at(-0.62*H,-ry-0.28*H),front:at(0.52*H,-ry-0.25*H),dip:at(-0.05*H,-ry+0.28*H)};   /* a sagging arc on the back, raised at both ends */
  return {T,H,L,rx,ry,r0,fw,nm,legs,nb,na,nt,head,ha,tb,ta,saddle};
}
function petSVG(p,col,riding){
  const b=petBuild(p), T=b.T, H=40*T.sc, P=q=>`${n2(q[0])},${n2(q[1])}`, st=`fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`;
  const dot=q=>`<path d="M${P(q)}h0" fill="none" stroke="${col}" stroke-width="${S*0.9}" stroke-linecap="round"/>`;
  const seg=(a,c,jn)=>`<path d="M${P(a)}L${P(c)}" ${st} data-pet-joint="${jn}"/>`, pts=[];
  const leg=(id)=>{ const l=b.legs[id]; pts.push(l.foot,l.knee);
    const hoof=T===PETS.horse?`<path d="M${P(l.foot)}l${n2(0.16*H)},0" ${st}/>`:'';
    let top=seg(l.base,l.knee,'leg'+id);
    if(T===PETS.horse&&id[0]==='H'){   /* a horse's thigh: ¾ of a stick figure's head across at the hip, narrowing to a single line (¼ head) at the hock */
      const len=Math.hypot(l.knee[0]-l.base[0],l.knee[1]-l.base[1]), dd=[(l.knee[0]-l.base[0])/len,(l.knee[1]-l.base[1])/len], nn=[-dd[1],dd[0]], w0=(0.75*40-S)/2, ex=0.3*H, w1=w0*(1+ex/len), b0=add(l.base,dd,-ex);
      top=`<path d="M${P(add(b0,nn,w1))}L${P(l.knee)}L${P(add(b0,nn,-w1))}" fill="transparent" ${st.replace('fill="none" ','')} data-pet-joint="leg${id}"/>`; }
    return top+(l.ankle?seg(l.knee,l.ankle,'knee'+id)+seg(l.ankle,l.foot,'ankle'+id):seg(l.knee,l.foot,'knee'+id))+hoof; };
  /* inside the body nothing shows: legs, neck and tail start under its outline */
  const mid='stkp'+(++MASK), E=`<ellipse cx="0" cy="0" rx="${n2(b.rx)}" ry="${n2(b.ry)}" transform="rotate(${n2(b.r0)})"`;
  let s=`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="#fff"/>${E} fill="#000" stroke="none"/></mask>`;
  let g='';
  g+=`<g opacity="1">${leg('FB')}${leg('HB')}</g>`;
  /* tail */
  { const u=up(b.ta), pp=[-u[1],u[0]], Lt=T.tail*H, e=add(b.tb,u,Lt);
    let d;
    if(p.type==='cat'){ const c1=add(add(b.tb,u,Lt*0.4),pp,0.22*H), c2=add(add(b.tb,u,Lt*0.75),pp,-0.22*H), hook=add(add(e,pp,0.18*H),u,-0.05*H);
      d=`M${P(b.tb)}C${P(c1)} ${P(c2)} ${P(e)}Q${P(add(add(e,u,0.15*H),pp,0.12*H))} ${P(hook)}`; pts.push(e,hook); }
    else if(p.type==='dog'){ const c1=add(add(b.tb,u,Lt*0.55),pp,0.15*H); d=`M${P(b.tb)}Q${P(c1)} ${P(e)}`; pts.push(e); }
    else { const tj=p.joints.tail, bf=tj<-25?1:tj<=20?-1:tj<45?-(45-tj)/25:0, sg=bf<0?-1:1;   /* the hair falls the other way from -25° to 20°, and straightens between 20° and 45° */
      const c1=add(add(b.tb,u,Lt*0.25),pp,-0.35*H*bf), e2=add(add(b.tb,u,Lt*0.92),pp,0.22*H*sg), e3=add(add(b.tb,u,Lt*0.85),pp,-0.2*H*sg);
      d=`M${P(b.tb)}Q${P(c1)} ${P(e)}M${P(add(b.tb,u,0.3*H))}Q${P(add(c1,pp,0.1*H*sg))} ${P(e2)}M${P(add(b.tb,u,0.3*H))}Q${P(add(c1,pp,-0.15*H*sg))} ${P(e3)}`; pts.push(e,e2,e3); }
    g+=`<path d="${d}" ${st} data-pet-joint="tail"/>`; }
  /* neck */
  const u=up(b.na), pp=[-u[1],u[0]];   /* pp points to the front of the neck */
  if(p.type==='horse'){ const a0=add(b.nb,pp,0.32*H), c0=add(b.nb,pp,-0.34*H), k=1.5*H, cr=Math.cos(rad(b.ha)), sr=Math.sin(rad(b.ha));
    const HW=(x,y)=>P([b.head[0]+x*k*cr-y*k*sr,b.head[1]+x*k*sr+y*k*cr]), c1=[b.head[0]+(-.16*k)*cr-(-.1*k)*sr,b.head[1]+(-.16*k)*sr+(-.1*k)*cr];
    /* the neck and head as one closed outline: up the throat, round the muzzle, back over the poll and down the mane side */
    const outline=`M${P(a0)}L${HW(-.08,.3)}L${HW(.5,.64)}Q${HW(.644,.72)} ${HW(.708,.62)}Q${HW(.79,.47)} ${HW(.68,.38)}Q${HW(.62,.27)} ${HW(.53,.31)}L${HW(-.16,-.1)}L${P(c0)}Z`;   /* a small bump on top of the snout */
    let mane=''; for(let i=1;i<=4;i++){ const q=add(add(c0,[c1[0]-c0[0],c1[1]-c0[1]],i/5.2),pp,-0.02*H); mane+=`M${P(q)}l${n2(-pp[0]*0.2*H-u[0]*0.08*H)},${n2(-pp[1]*0.2*H-u[1]*0.08*H)}`; }
    g+=`<path d="${outline}" fill="transparent" ${st} data-pet-joint="neck"/><path d="${mane}" ${st}/>`; pts.push(c1); }
  else g+=seg(b.nb,b.nt,'neck');
  s+=`<g mask="url(#${mid})">${g}</g>`;
  let sdl=null;
  if(p.type==='horse'&&riding){ const sd=b.saddle, M=add([0,0],b.fw,-0.05*H), c2=[2*M[0]-(sd.back[0]+sd.front[0])/2,2*M[1]-(sd.back[1]+sd.front[1])/2];
    /* a crescent: the sagging seat arc, and a second arc between the same two ends whose middle lies on the body's long axis */
    sdl={d:`M${P(sd.back)}Q${P(sd.dip)} ${P(sd.front)}Q${P(c2)} ${P(sd.back)}Z`,M}; }
  if(sdl){ const sm='stkq'+(++MASK);   /* the body's outline does not show through the saddle */
    s+=`<mask id="${sm}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="#fff"/><path d="${sdl.d}" fill="#000" stroke="#000" stroke-width="${S}"/></mask><g mask="url(#${sm})">${E} fill="transparent" ${st} data-pet-joint="root"/></g>`; }
  else s+=`${E} fill="transparent" ${st} data-pet-joint="root"/>`;
  s+=`<g mask="url(#${mid})">${leg('FF')}${leg('HF')}</g>`;
  if(sdl){ const sd=b.saddle, top=sdl.M, foot=add(top,b.nm,b.ry+0.275*H), w=0.17*H;   /* the saddle, and a stirrup hanging on a strap below it */
    s+=`<path d="${sdl.d}" ${st}/><path d="M${P(top)}L${P(foot)}M${P(add(add(foot,b.fw,-w),b.nm,-0.02*H))}L${P(add(add(foot,b.fw,-w*0.75),b.nm,0.2*H))}L${P(add(add(foot,b.fw,w*0.75),b.nm,0.2*H))}L${P(add(add(foot,b.fw,w),b.nm,-0.02*H))}Z" ${st}/>`; pts.push(sd.back,sd.front,add(foot,b.nm,0.2*H)); }
  /* head, turned with the head angle */
  const hw=v=>n2(v*H*(p.type==='horse'?1.5:1));   /* a horse's head is long: half again the drawing scale */
  let hd='';
  if(p.type==='cat'){ const E_=p.joints.ears, ear=k=>`<path transform="rotate(${k*E_} ${hw(k*.14)} ${hw(-.25)})" d="M${hw(k*.24)},${hw(-.17)}L${hw(k*.24)},${hw(-.56)}L${hw(k*.04)},${hw(-.3)}" ${st} data-pet-joint="ears"/>`, wh=k=>`M${hw(k*.38)},${hw(.0)}l${hw(k*.3)},${hw(-.07)}M${hw(k*.38)},${hw(.14)}l${hw(k*.3)},${hw(.07)}`;   /* a symmetrical face: an ear and two whiskers on each side */
    hd=`<circle cx="0" cy="0" r="${hw(T.headR)}" fill="transparent" ${st} data-pet-joint="head"/>${ear(-1)}${ear(1)}<path d="${wh(-1)}${wh(1)}" ${st}/>`; }
  else if(p.type==='dog') hd=`<circle cx="0" cy="0" r="${hw(T.headR)}" fill="transparent" ${st} data-pet-joint="head"/><path d="M${hw(.28)},${hw(-.1)}H${hw(.52)}Q${hw(.62)},${hw(-.1)} ${hw(.62)},${hw(.01)}Q${hw(.62)},${hw(.14)} ${hw(.52)},${hw(.14)}H${hw(.265)}" ${st}/><path transform="rotate(${p.joints.ears} ${hw(-.08)} ${hw(-.28)})" d="M${hw(-.08)},${hw(-.28)}Q${hw(-.42)},${hw(-.22)} ${hw(-.3)},${hw(.2)}" ${st} data-pet-joint="ears"/>`+dot([hw(.6),hw(-.05)]);
  else hd=`<path d="M${hw(-.16)},${hw(-.1)}L${hw(.596)},${hw(.36)}Q${hw(.78)},${hw(.46)} ${hw(.708)},${hw(.62)}Q${hw(.644)},${hw(.72)} ${hw(.5)},${hw(.64)}L${hw(-.08)},${hw(.3)}Z" fill="transparent" stroke="none" data-pet-joint="head"/><path transform="rotate(${p.joints.ears} ${hw(.02)} ${hw(-.08)})" d="M${hw(-.08)},${hw(-.1)}L${hw(-.02)},${hw(-.42)}L${hw(.12)},${hw(-.04)}" ${st} data-pet-joint="ears"/>`+dot([hw(.18),hw(.06)]);
  s+=`<g transform="translate(${P(b.head)}) rotate(${n2(b.ha)})">${hd}</g>`;
  const R0=T===PETS.horse?1.45*H:T.headR*H+0.3*H; pts.push([b.head[0]+R0,b.head[1]+R0],[b.head[0]-R0,b.head[1]-R0-0.3*H]);
  for(let i=0;i<16;i++){ const t=i*Math.PI/8; pts.push(add([0,0],b.fw,b.rx*Math.cos(t)).map((v,k)=>v+b.nm[k]*b.ry*Math.sin(t))); }
  return {svg:s,pts,b};
}

/* build the drawing, facing right, then turned round for a figure facing left. Returns {inner, piv, box, d} in stage units */
function build(data){
  const d=normalize(data), k=skeleton(d), f=d.facing==='left'?-1:1, col=d.colour;
  /* riding a horse: the hips sit on the saddle, the figure faces the way the horse does */
  const riding=!!(d.riding&&d.pet&&d.pet.type==='horse'&&!d.hideFigure);
  let gy=STAGE.ground-lowest(k,d)-d.lift*H;
  if(riding){ const pe0=petBuild(d.pet), pg0=STAGE.ground-Math.max(...petSVG(d.pet,'#000',true).pts.map(q=>q[1]))-S/2; gy=pe0.saddle.seat[1]+pg0-k.hip[1]; }
  const P=p=>`${n2(p[0])},${n2(p[1])}`, W=p=>[n2(STAGE.cx+f*p[0]),n2(p[1]+gy)];
  const st=`fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`;
  const seg=(a,b,joint)=>`<path d="M${P(a)}L${P(b)}" ${st} data-joint="${joint}"/>`;
  const pts=[k.hip,k.sh,k.head,k.armF.hand,k.armB.hand,k.armF.el,k.armB.el,k.legF.foot,k.legB.foot,k.legF.knee,k.legB.knee];
  let s='';
  if(d.chair){ const hx=k.hip[0], hy=k.hip[1]+S*0.9, g=STAGE.ground-gy-S/2-d.lift*H, bx=hx-0.55*H, fx=hx+0.55*H;   /* seat under the hips, legs to the floor, a back behind */
    s+=`<path d="M${P([bx,hy])}L${P([fx,hy])}M${P([hx-0.45*H,hy])}L${P([hx-0.45*H,g])}M${P([hx+0.45*H,hy])}L${P([hx+0.45*H,g])}M${P([bx,hy])}L${P([bx,hy-1.1*H])}" fill="none" stroke="#8a5a3a" stroke-width="${S}" stroke-linecap="round"/>`;
    pts.push([bx,hy-1.1*H],[fx,g]); }
  if(d.bike){ const b=bikeGeo(k,d), bc=d.bikeColour||'#0066CC', bst=`fill="none" stroke="${bc}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`, L=(a,c)=>`M${P(a)}L${P(c)}`;
    const hb=[b.headTop[0]-0.12*H,b.headTop[1]-0.3*H*b.s], hbLen=0.3*H+S;   /* the handlebar: a line width longer than the stem is wide */
    s+=`<circle cx="${n2(b.rear[0])}" cy="${n2(b.rear[1])}" r="${n2(b.r)}" ${bst}/><circle cx="${n2(b.front[0])}" cy="${n2(b.front[1])}" r="${n2(b.r)}" ${bst}/>`
      +`<path d="${L([b.saddle[0]-0.28*H,b.saddle[1]],[b.saddle[0]+0.22*H,b.saddle[1]])}${L(b.saddle,b.bb)}${L([b.saddle[0]+0.03*H,b.saddle[1]+0.25*H],b.headTop)}${L(b.bb,b.headBot)}${L(b.bb,b.rear)}${L([b.saddle[0]+0.03*H,b.saddle[1]+0.25*H],b.rear)}${L(b.headTop,b.front)}${L(b.headTop,hb)}${L([hb[0]-hbLen*0.2,hb[1]],[hb[0]+hbLen*0.8,hb[1]])}" ${bst}/>`;
    pts.push(b.rear,b.front,[b.front[0]+b.r,b.g],[b.rear[0]-b.r,b.g]); }
  /* back limbs first, a little lighter, so the front ones read in front */
  const sk=d.skirt?skirtPts(k,d):null, dr=d.dress?dressPath(k,d,P):null, mid='stkm'+(++MASK);
  const legMask=(sk||dr)?` mask="url(#${mid})"`:'', shape=dr?dr.d:sk?`M${P(sk[0])}L${P(sk[1])}L${P(sk[2])}Z`:'';
  if(shape) s+=`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="#fff"/><path d="${shape}" fill="#000" stroke="#000" stroke-width="${S}" stroke-linejoin="round"/></mask>`;
  s+=`<g class="stick-back"><g${legMask}${riding?' stroke-opacity="0"':''}><g${d.dress?' stroke-opacity="0"':''}>`+seg(k.hip,k.legB.knee,'hipB')+'</g>'+seg(k.legB.knee,k.legB.foot,'kneeB')+'</g>'+seg(k.sh,k.armB.el,'shoulderB')+seg(k.armB.el,k.armB.hand,'elbowB')+'</g>';
  const headT=`translate(${P(k.head)}) rotate(${n2(k.na)})`;
  if(false) s+=`<path transform="${headT}" d="M${n2(-R*Math.sin(rad(35)))},${n2(-R*Math.cos(rad(35)))}Q${n2(-R-7)},2 ${n2(-R+3)},${n2(R+0.7*H)}" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round"/>`;
  if(d.backpack){   /* on the back, following the spine (straight or hunched): a rounded outline behind it and a strap to the shoulder */
    const L=k.B.torso*H, q=0.6, c=k.ctrl||[(k.hip[0]+k.sh[0])/2,(k.hip[1]+k.sh[1])/2];
    const C=[(1-q)*(1-q)*k.hip[0]+2*q*(1-q)*c[0]+q*q*k.sh[0],(1-q)*(1-q)*k.hip[1]+2*q*(1-q)*c[1]+q*q*k.sh[1]];
    const tg=[2*(1-q)*(c[0]-k.hip[0])+2*q*(k.sh[0]-c[0]),2*(1-q)*(c[1]-k.hip[1])+2*q*(k.sh[1]-c[1])], a=Math.atan2(tg[0],-tg[1])*180/Math.PI;
    s+=`<g transform="translate(${P(C)}) rotate(${n2(a)})"><rect x="${n2(-0.72*H)}" y="${n2(-0.42*L)}" width="${n2(0.5*H)}" height="${n2(0.78*L)}" rx="${n2(0.14*H)}" ${st}/></g>`;
    const top=[C[0]+Math.cos(rad(a))*(-0.22*H)-Math.sin(rad(a))*(-0.34*L),C[1]+Math.sin(rad(a))*(-0.22*H)+Math.cos(rad(a))*(-0.34*L)];
    s+=`<path d="M${P(top)}Q${P([(top[0]+k.sh[0])/2,Math.min(top[1],k.sh[1])-0.12*H])} ${P(k.sh)}" ${st}/>`; }
  const hideT=dr?' stroke-opacity="0"':'';
  s+=`<g${hideT}>`+(d.hunchback?`<path d="M${P(k.hip)}Q${P(k.ctrl)} ${P(k.sh)}" ${st} data-joint="torso"/>`:seg(k.hip,k.sh,'torso'))+'</g>';
  if(dr){ pts.push(...dr.pts); s+=`<path d="${dr.d}" ${st} data-joint="torso"/>`; }   /* the dress: an outline from the shoulders to a long hem, the body and legs under it masked out */
  s+=seg(k.sh,k.neckEnd,'neck');
  if(sk){ pts.push(...sk); s+=`<path d="M${P(sk[0])}L${P(sk[1])}L${P(sk[2])}Z" ${st}/>`; }   /* an outline; the legs under it are masked out */
  s+=`<g${legMask}><g${d.dress?' stroke-opacity="0"':''}>`+seg(k.hip,k.legF.knee,'hipF')+'</g>'+seg(k.legF.knee,k.legF.foot,'kneeF')+'</g>';
  if(d.sweat||d.reaction){   /* drawn round the head, turned with it, with a clear gap so each mark reads on its own */
    const gap=d.headwear==='tophat'?1.05*H:0.4*H, at=(a,r)=>[r*Math.sin(rad(a)),-r*Math.cos(rad(a))];
    let m='';
    if(d.reaction) for(const a of (d.sweat?[-30,5,40]:[-40,0,40])){ const p0=at(a,R+gap), p1=at(a,R+gap+0.42*H); m+=`<path d="M${P(p0)}L${P(p1)}" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round"/>`; }
    if(d.sweat) for(const a of (d.reaction?[-95,-140,100]:[-60,-115,95])){ const c=at(a,R+0.5*H+0.35*H);   /* a drop flying outward, its point toward the head */
      m+=`<path transform="translate(${P(c)}) rotate(${a})" d="M0,16C8,5 12,-4 12,-9A12,12 0 1 0 -12,-9C-12,-4 -8,5 0,16Z" fill="none" stroke="#3BA0E6" stroke-width="${S}" stroke-linejoin="round"/>`; }
    s+=`<g transform="${headT}">${m}</g>`; }
  /* a straw hat hides the top of the head: everything above its brim is masked out of the head circle */
  let headMask='';
  if(d.headwear==='strawhat'){ const hm='stkh'+(++MASK);
    s+=`<mask id="${hm}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="#fff"/><g transform="${headT} rotate(${d.hatAngle})"><path d="M${n2(-1.05*H)},${n2(-0.45*R)}Q0,${n2(-0.7*R)} ${n2(1.05*H)},${n2(-0.45*R)}V${n2(-2*H)}H${n2(-1.05*H)}Z" fill="#000"/></g></mask>`;
    headMask=` mask="url(#${hm})"`; }
  s+=`<g${headMask}><g transform="${headT}"><circle cx="0" cy="0" r="${n2(R)}" ${st} data-joint="neck"/></g></g><g transform="${headT}"><circle cx="0" cy="0" r="${n2(R)}" fill="transparent" stroke="none" data-joint="neck"/>${d.headwear?`<g transform="rotate(${d.hatAngle})">${headwearSVG(d.headwear,col)}</g>`:''}</g>`;
  /* things that turn with the hand: drawn here, in the figure's own frame, along the forearm plus the grip angle */
  const turning=(h,arm)=>{ const id=d.held[h]; if(!id||ITEMS[id].upright||ITEMS[id].reins) return '';
    const th=-(arm.a2+d.grip[h]);
    let cable='';
    if(id==='microphone'){   /* the cable leaves the narrow end of the handle, winds down to the floor and trails two heads along it, in front */
      const ce=10+0.25*H, e=[arm.hand[0]+ce*Math.sin(rad(th)),arm.hand[1]-ce*Math.cos(rad(th))], fy=STAGE.ground-gy-S/2, sx=Math.max(e[0],0)+0.3*H, mx=(e[0]+sx)/2, my=(e[1]+fy)/2, q=H/2;
      cable=`<path d="M${P(e)}Q${P([mx-0.35*H,(e[1]+my)/2])} ${P([mx,my])}T${P([sx,fy])}Q${P([sx+q/2,fy-5])} ${P([sx+q,fy])}T${P([sx+2*q,fy])}T${P([sx+3*q,fy])}T${P([sx+4*q,fy])}" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"/>`; pts.push([sx+2*H,fy]); }
    return cable+`<g transform="translate(${P(arm.hand)}) rotate(${n2(th)})">${heldSVG(id,d.itemColour[h]||ITEMS[id].col,col)}</g>`; };
  s=s.replace('<g class="stick-back">','<g class="stick-back">'+turning('back',k.armB));
  s+=seg(k.sh,k.armF.el,'shoulderF')+seg(k.armF.el,k.armF.hand,'elbowF')+turning('front',k.armF);
  /* upright things stay straight up whatever the arm does: drawn in the stage frame, so they are not mirrored */
  let held='';
  for(const [h,arm] of [['back',k.armB],['front',k.armF]]){ const id=d.held[h]; if(!id||!ITEMS[id].upright) continue;
    held+=`<g>${itemSVG(id,d.itemColour[h]||ITEMS[id].col,W(arm.hand),STAGE.ground-S/2-d.lift*H,col,f,[f*Math.sin(rad(arm.a2)),Math.cos(rad(arm.a2))])}</g>`; }
  let bub=null;
  if(d.emotion){   /* the bubble goes in front of the head, unless a raised hand (and what it holds) is there: then behind */
    const hc=W(k.head), raised=s=>[k.armF.hand,k.armB.hand].map(W).filter(p=>p[1]<hc[1]+0.2*H&&(p[0]-hc[0])*s>-0.3*H).length;
    const side=raised(f)>raised(-f)?-f:f; bub=bubbleSVG(d.emotion,hc,side,col,f*d.bubbleX,d.bubbleY,false,d.emoji); }
  let carOut='';
  if(d.skate){ const fy=Math.max(k.legF.foot[1],k.legB.foot[1])+S/2+0.12*H, x0=Math.min(k.legF.foot[0],k.legB.foot[0])-0.45*H, x1=Math.max(k.legF.foot[0],k.legB.foot[0])+0.45*H, wy=fy+0.22*H, sb=d.carColour||'#00CC66';
    s+=`<path d="M${n2(x0-0.25*H)},${n2(fy-0.18*H)}Q${n2(x0-0.1*H)},${n2(fy)} ${n2(x0+0.1*H)},${n2(fy)}H${n2(x1-0.1*H)}Q${n2(x1+0.1*H)},${n2(fy)} ${n2(x1+0.25*H)},${n2(fy-0.18*H)}" fill="none" stroke="${sb}" stroke-width="${S}" stroke-linecap="round"/>`
      +[x0+0.2*H,x1-0.2*H].map(x=>`<circle cx="${n2(x)}" cy="${n2(wy)}" r="${n2(0.12*H)}" fill="none" stroke="${col}" stroke-width="${S}"/>`).join('');
    pts.push([x0-0.25*H,wy],[x1+0.25*H,wy]); }
  if(d.car){ const c=carGeo(k,d.carType), cc=d.carColour||'#CC0000', cst=`fill="none" stroke="${cc}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`, cid='stkc'+(++MASK), N=n2;
    /* wheel arches: the body's lower edge curves over each wheel, a quarter head clear of it */
    const ar=c.r+0.25*H, cy=c.g-c.r, dx=Math.sqrt(Math.max(ar*ar-(c.bottom-cy)**2,1));
    const arches=[c.wF,c.wR].map(x=>`L${N(x+dx)},${N(c.bottom)}A${N(ar)},${N(ar)} 0 0 0 ${N(x-dx)},${N(c.bottom)}`).join('');
    const body=`M${N(c.rear)},${N(c.bottom)}V${N(c.belt+0.15*H)}Q${N(c.rear)},${N(c.belt)} ${N(c.rear+0.3*H)},${N(c.belt)}H${N(c.front-0.45*H)}Q${N(c.front)},${N(c.belt+0.05*H)} ${N(c.front)},${N(c.belt+0.45*H)}V${N(c.bottom)}${arches}Z`;
    const cab=c.box?`M${N(c.trunk)},${N(c.belt)}V${N(c.roof+0.1*H)}Q${N(c.trunk)},${N(c.roof)} ${N(c.trunk+0.2*H)},${N(c.roof)}H${N(c.cabF)}L${N(c.hood)},${N(c.belt)}`
      :c.bed?`M${N(c.cabR)},${N(c.belt)}V${N(c.roof)}H${N(c.cabF)}L${N(c.hood)},${N(c.belt)}`
      :`M${N(c.trunk)},${N(c.belt)}L${N(c.cabR)},${N(c.roof)}H${N(c.cabF)}L${N(c.hood)},${N(c.belt)}`;
    const pillar=c.bed?'':`M${N((c.cabR+c.cabF)/2+0.35*H)},${N(c.roof)}V${N(c.belt)}`;
    const bed=c.bed?`M${N(c.rear)},${N(c.belt-0.35*H)}V${N(c.belt)}M${N(c.rear)},${N(c.belt-0.35*H)}H${N(c.cabR-0.15*H)}`:'';
    /* the arms in the window (from the shoulder down to the wheel) and the head stay visible; the rest of the driver is hidden */
    const arm=a=>`M${P(k.sh)}L${P(a.el)}L${P(a.hand)}`;
    s=`<mask id="${cid}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="#fff"/><path d="${body}${cab}ZM${N(c.rear)},${N(c.bottom)}H${N(c.front)}V${N(c.g+2*H)}H${N(c.rear)}Z" fill="#000" stroke="#000" stroke-width="${S}"/>`
      +`<path d="${arm(k.armF)}${arm(k.armB)}M${P(k.neckEnd)}L${P(k.sh)}L${P(k.hip)}" fill="none" stroke="#fff" stroke-width="${S+0.5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${body}" fill="#000"/>`
      +`<g transform="${headT}"><circle r="${n2(R+S/2)}" fill="#fff"/><g transform="rotate(${d.hatAngle})">${d.headwear?headwearSVG(d.headwear,'#fff'):''}</g></g></mask><g mask="url(#${cid})">${s}</g>`;
    const w=c.wheel;   /* the steering wheel, side on: a short upright oval on its column */
    const cb=[w[0]+0.6*H,c.belt], cv=[w[0]-cb[0],w[1]-cb[1]], cl=Math.hypot(cv[0],cv[1]), pv=[-cv[1]/cl*0.4*H,cv[0]/cl*0.4*H];
    carOut=`<path d="M${N(cb[0])},${N(cb[1])}L${N(w[0])},${N(w[1])}" ${cst}/><path d="M${N(w[0]+pv[0])},${N(w[1]+pv[1])}L${N(w[0]-pv[0])},${N(w[1]-pv[1])}" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round"/>`
      +`<path d="${body}" ${cst}/><path d="${cab}${pillar}${bed}" ${cst}/>`
      +[c.wR,c.wF].map(x=>`<circle cx="${N(x)}" cy="${N(c.g-c.r)}" r="${N(c.r)}" fill="none" stroke="${col}" stroke-width="${S}"/>`).join('');
    pts.push([c.rear,c.g],[c.front,c.g],[c.cabR,c.roof]); held=`<g mask="url(#${cid})" transform="translate(${STAGE.cx} ${n2(gy)}) scale(${f} 1)"><g transform="scale(${f} 1) translate(${-STAGE.cx} ${n2(-gy)})">${held}</g></g>`; }
  /* an arrow pointing down at the figure: 1.5 heads wide and 2 heads tall outside the line, its tip at least a quarter head
     above the highest part of the figure (head, hat or raised hands); arrowUp lifts it further */
  let arrowSvg='', arrowTip=null;
  if(d.arrow){ const hatH={tophat:0.95,chefhat:1.6,strawhat:0.5,afro:0.75,mohawk:0.7,bun:0.55,ponytail:0.9,bow:0.5,longhairbow:0.5,pigtails:0.5}[d.headwear]||0.15;
    const hc=W(k.head), tops=[hc[1]-R-S/2-hatH*H].concat([k.armF.hand,k.armB.hand,k.armF.el,k.armB.el].map(W).filter(p=>Math.abs(p[0]-hc[0])<0.9*H).map(p=>p[1]-S/2));
    arrowTip=[hc[0],Math.min(...tops)-0.25*H-d.arrowUp]; arrowSvg=arrowAt(d.arrow,arrowTip,col); }
  if(d.inBed){ const b=bedGeo(k), D=b.dir, N=n2, bid='stkb'+(++MASK), wood=`fill="none" stroke="#8a5a3a" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`;
    const px=b.x-D*0.05*H, sheetTop=b.top-0.5*H;
    /* only the head and neck show: everything else of the figure (and anything held) is under the sheet */
    s=`<mask id="${bid}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="#000"/><g transform="${headT}"><circle r="${N(R+S/2)}" fill="#fff"/><g transform="rotate(${d.hatAngle})">${d.headwear?headwearSVG(d.headwear,'#fff'):''}</g></g><path d="M${P(k.neckEnd)}L${P(k.sh)}" stroke="#fff" stroke-width="${S}" stroke-linecap="round"/></mask><g mask="url(#${bid})">${s}</g>`;
    held=''; 
    carOut=`<path d="M${N(b.head)},${N(b.floor)}V${N(b.top-1.4*H)}M${N(b.head)},${N(b.top)}H${N(b.foot)}V${N(b.bot)}H${N(b.head)}M${N(b.head+D*0.3*H)},${N(b.bot)}V${N(b.floor)}M${N(b.foot-D*0.3*H)},${N(b.bot)}V${N(b.floor)}" ${wood}/>`
      +`<ellipse cx="${N(px)}" cy="${N(b.top-0.21*H)}" rx="${N(0.68*H)}" ry="${N(0.21*H)}" ${st}/>`
      +`<path d="M${N(k.sh[0])},${N(b.top)}L${N(k.sh[0])},${N(Math.min(k.sh[1]-0.25*H,b.top))}Q${N(k.sh[0]+D*0.25*H)},${N(sheetTop-0.1*H)} ${N(k.sh[0]+D*1.0*H)},${N(sheetTop)}T${N(b.foot-D*0.6*H)},${N(sheetTop+0.1*H)}Q${N(b.foot)},${N(sheetTop+0.15*H)} ${N(b.foot+D*0.05*H)},${N(b.bot)}" ${st}/>`;
    pts.push([b.head,b.floor],[b.foot,b.floor],[b.head,b.top-1.4*H]); }
  /* sleeping: three Zs rising in a zig-zag above the head, each bigger than the last; they stay upright whatever the head does */
  let zz='';
  if(d.sleep){ const hc=W(k.head), base=hc[1]-R-S/2-0.35*H;
    [[0.55,0,0.32],[1.05,-0.75,0.42],[0.6,-1.65,0.54]].forEach(([dx,dy,z])=>{ const x=hc[0]+f*dx*H, y=base+dy*H, h=z*H/2;
      zz+=`<path d="M${n2(x-h)},${n2(y-h)}H${n2(x+h)}L${n2(x-h)},${n2(y+h)}H${n2(x+h)}" fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.push([(x-STAGE.cx)*f,y-gy-h-H*1.6]); }); }
  let inner=`<g transform="translate(${STAGE.cx} ${n2(gy)}) scale(${f} 1)">${s}${carOut}</g>`+held+zz+(bub?bub.svg:'')+arrowSvg;
  let wp=pts.map(W);
  /* the animal: beside the figure (dist heads in front of it), or in the middle of the stage on its own */
  let petPiv=null;
  if(d.pet){ const pe=petSVG(d.pet,d.pet.colour,riding), pf=d.pet.facing==='right'?1:-1, b=pe.b;
    const px=d.hideFigure?STAGE.cx:riding?STAGE.cx-pf*b.saddle.seat[0]:W(k.hip)[0]+f*d.pet.dist*H, pgy=STAGE.ground-Math.max(...pe.pts.map(q=>q[1]))-S/2, PW=q=>[n2(px+pf*q[0]),n2(q[1]+pgy)];
    const pet=`<g class="stick-pet" transform="translate(${n2(px)} ${n2(pgy)}) scale(${pf} 1)">${pe.svg}</g>`;
    let reins='';
    if(riding){ const kk=1.5*H, cr=Math.cos(rad(b.ha)), sr=Math.sin(rad(b.ha)), bit=PW([b.head[0]+.48*kk*cr-.5*kk*sr,b.head[1]+.48*kk*sr+.5*kk*cr]);   /* the reins run from the corner of the mouth to each hand, sagging a little */
      for(const [hd,a] of [['back',k.armB],['front',k.armF]]){ if(d.held[hd]!=='reins') continue;   /* only the hands holding a rein */
        const h=W(a.hand), c=[(bit[0]+h[0])/2,(bit[1]+h[1])/2+0.3*H]; reins+=`<path d="M${bit[0]},${bit[1]}Q${n2(c[0])},${n2(c[1])} ${h[0]},${h[1]}" fill="none" stroke="${d.itemColour[hd]||ITEMS.reins.col}" stroke-width="${S}" stroke-linecap="round"/>`; } }
    if(d.hideFigure){ inner=pet; wp=[];
      /* an animal on its own takes the figure's bubble, arrow or selector, reaction lines and Zs, round its own head */
      const ty=d.pet.type, hk=b.H*(ty==='horse'?1.5:1), cr=Math.cos(rad(b.ha)), sr=Math.sin(rad(b.ha));
      const HP=(x,y)=>PW([b.head[0]+(x*cr-y*sr)*hk,b.head[1]+(x*sr+y*cr)*hk]);
      const hc=ty==='horse'?HP(.28,.25):HP(0,0);
      const topY=Math.min(...({cat:[[-.24,-.56],[.24,-.56],[0,-.3]],dog:[[0,-.3],[-.08,-.28]],horse:[[-.02,-.42],[-.16,-.1],[.12,-.04],[.53,.31],[.7,.6]]}[ty]).map(q=>HP(q[0],q[1])[1]))-S/2;
      const lift=hc[1]-topY, cst=`fill="none" stroke="${col}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"`;
      let deco='';
      if(d.reaction) for(const a of [-40,0,40]){ const r0=lift+0.25*H, p0=[hc[0]+pf*r0*Math.sin(rad(a)),hc[1]-r0*Math.cos(rad(a))], p1=[hc[0]+pf*(r0+0.42*H)*Math.sin(rad(a)),hc[1]-(r0+0.42*H)*Math.cos(rad(a))];
        deco+=`<path d="M${n2(p0[0])},${n2(p0[1])}L${n2(p1[0])},${n2(p1[1])}" ${cst}/>`; wp.push(p1); }
      if(d.sleep){ const base=topY-0.35*H; [[0.55,0,0.32],[1.05,-0.75,0.42],[0.6,-1.65,0.54]].forEach(([dx,dy,z])=>{ const x=hc[0]+pf*dx*H, y=base+dy*H, h=z*H/2;
        deco+=`<path d="M${n2(x-h)},${n2(y-h)}H${n2(x+h)}L${n2(x-h)},${n2(y+h)}H${n2(x+h)}" ${cst}/>`; wp.push([x,y-h-H*1.6]); }); }
      bub=d.emotion?bubbleSVG(d.emotion,hc,pf,col,pf*d.bubbleX,d.bubbleY-Math.max(0,lift-R-S/2)-(ty==='horse'?0.6*H:0),true,d.emoji):null;   /* raised clear of ears and of a horse's long head */
      if(bub) wp.push([bub.box[0]+H*0.9,bub.box[1]+H*1.9],[bub.box[2]-H*0.9,bub.box[1]+H*1.9]);
      if(d.arrow){ const tip=[hc[0],topY-0.25*H-d.arrowUp]; deco+=arrowAt(d.arrow,tip,col); wp.push([tip[0],tip[1]-(d.arrow==='selector'?0.95*H:2*H)+H*1.9-S]); }
      inner=pet+deco+(bub?bub.svg:''); }
    else inner=pet+reins+inner;
    wp=wp.concat(pe.pts.map(PW));
    const T=b.T; petPiv={facing:pf,root:{p:PW([0,0]),parent:0,kind:'fw'},neck:{p:PW(b.nb),parent:b.r0+T.neckA,kind:'up'},tail:{p:PW(b.tb),parent:b.r0+T.tailA,kind:'up'},
      head:{p:PW(b.head),parent:b.r0+(d.pet.type==='horse'?35:0),kind:'fw'},ears:{p:PW(b.head),parent:b.ha,kind:'up'}};
    for(const id of ['FF','FB','HF','HB']){ const l=b.legs[id]; petPiv['leg'+id]={p:PW(l.base),parent:-b.r0,kind:'down'}; petPiv['knee'+id]={p:PW(l.knee),parent:l.a1,kind:'down'}; if(l.ankle) petPiv['ankle'+id]={p:PW(l.ankle),parent:l.a2,kind:'down'}; } }
  const xs=wp.map(p=>p[0]), ys=wp.map(p=>p[1]);
  if(bub&&!d.hideFigure){ xs.push(bub.box[0]+H*0.9,bub.box[2]-H*0.9); ys.push(bub.box[1]+H*1.9); }
  if(arrowTip&&!d.hideFigure){ ys.push(arrowTip[1]-(d.arrow==='selector'?0.95*H:2*H)+H*1.9-S); }
  const box=[Math.min(...xs)-H*0.9, Math.min(...ys)-H*1.9, Math.max(...xs)+H*0.9, STAGE.ground+S];
  const piv={torso:{p:W(k.hip),parent:d.joints.root,kind:'up'},neck:{p:W(k.sh),parent:k.na-d.joints.neck,kind:'up'},
    shoulderF:{p:W(k.sh),parent:-(d.joints.root+d.joints.torso),kind:'down'},elbowF:{p:W(k.armF.el),parent:k.armF.a1,kind:'down'},
    shoulderB:{p:W(k.sh),parent:-(d.joints.root+d.joints.torso),kind:'down'},elbowB:{p:W(k.armB.el),parent:k.armB.a1,kind:'down'},
    hipF:{p:W(k.hip),parent:-d.joints.root,kind:'down'},kneeF:{p:W(k.legF.knee),parent:k.legF.a1,kind:'down'},
    hipB:{p:W(k.hip),parent:-d.joints.root,kind:'down'},kneeB:{p:W(k.legB.knee),parent:k.legB.a1,kind:'down'},facing:f,bubble:bub&&bub.c,pet:petPiv};
  return {inner,piv,box,d};
}
function pivots(data){ return build(data).piv; }
/* the joint value that points the limb from its pivot toward (x,y) in stage units */
function angleTo(piv,joint,x,y){ const p=piv[joint], vx=(x-p.p[0])*piv.facing, vy=y-p.p[1];
  const a=p.kind==='up'?Math.atan2(vx,-vy):p.kind==='fw'?Math.atan2(vy,vx):Math.atan2(vx,vy); return wrap(a*180/Math.PI-p.parent); }
/* the same for an animal's joint (piv.pet from pivots) */
function petAngleTo(piv,joint,x,y){ const pp=piv.pet; if(!pp||!pp[joint]) return 0; return angleTo(Object.assign({facing:pp.facing},pp),joint,x,y); }
function render(data,opts){
  opts=opts||{}; const b=build(data), d=b.d;
  /* on the stage, a wide animal (a horse) widens the view instead of being cut off */
  const x0=Math.min(0,b.box[0]-4), x1=Math.max(STAGE.w,b.box[2]+4);
  const y0=Math.min(0,b.box[1]-4), vb=opts.fit?b.box.map((v,i)=>i<2?n2(v):n2(v-b.box[i-2])).join(' '):`${n2(x0)} ${n2(y0)} ${n2(x1-x0)} ${n2(STAGE.h-y0)}`;   /* and a rider on a horse raises it */
  const ground=opts.ground?`<path d="M${n2(x0)},${STAGE.ground}H${n2(x1)}" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5"/>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${(describe(d)||'A stick figure').replace(/"/g,'&quot;')}">${ground}${b.inner}</svg>`;
}
function describe(data){
  const d=normalize(data), w=[], h=[];
  if(d.headwear&&HEADWEAR[d.headwear].noun) w.push(HEADWEAR[d.headwear].noun); if(d.skirt) w.push('a skirt'); if(d.dress) w.push('a dress'); if(d.backpack) w.push('a backpack');
  for(const k of ['front','back']) if(d.held[k]&&!(d.held[k]==='reins'&&h.includes(ITEMS.reins.phrase))) h.push(ITEMS[d.held[k]].phrase);
  const list=a=>a.length>1?a.slice(0,-1).join(', ')+' and '+a[a.length-1]:a[0];
  const parts=[]; if(w.length) parts.push('wearing '+list(w)); if(h.length) parts.push('holding '+list(h));
  if(d.chair) parts.push('sitting on a chair'); if(d.inBed) parts.push('lying in bed'); if(d.bike) parts.push('riding a bicycle'); if(d.skate) parts.push('riding a skateboard'); if(d.car) parts.push('driving '+CARS[d.carType].noun);
  if(d.sleep) parts.unshift('sleeping');
  const n=d.name||'This person';
  if(d.pet){ const a=PETS[d.pet.type].noun; if(d.hideFigure) return `${a.charAt(0).toUpperCase()+a.slice(1)}.`; parts.push(d.riding?'riding '+a:'with '+a); }
  const all=parts.length>1?parts.slice(0,-1).join(', ')+', and '+parts[parts.length-1]:parts[0];
  if(d.emotion&&EMOTIONS[d.emotion]) return `${n} is ${EMOTIONS[d.emotion]}`+(parts.length?` and is ${all}.`:'.');
  return parts.length?`${n} is ${all}.`:'';
}
window.StickCharacter={PETS,PET_JOINTS,PET_POSES,PET_STAND,petNormalize,applyPetPose,petAngleTo,SCHEMA,H,STAGE,BUILD,JOINTS,POSES,CARS,HEADWEAR,EMOTIONS,BUBBLE_LABELS,ITEMS,PALETTE,colourName,defaults,normalize,applyPose,mirror,render,pivots,angleTo,describe,skeleton};
})();
