/* ══════════════════════════════════════════════════════════════════════════
   HouseCharacter — poseable SVG character engine. No DOM access, no ids,
   so any number of characters can share a page. Lift this whole block into
   house.js (or another lesson) unchanged.

     HouseCharacter.defaults()            → a fresh character object
     HouseCharacter.normalize(data)       → validated copy (safe for any JSON)
     HouseCharacter.render(data, opts)    → '<svg>…</svg>' string
         opts.fit    crop the viewBox to the figure (for inline use)
         opts.ground draw a floor line (stage mode only)
     HouseCharacter.pivots(data)          → joint pivots in stage coordinates
     HouseCharacter.describe(data)        → "Sam is holding a wrench."

   Angles are degrees, clockwise on screen, relative to the parent segment.
   0 = limb straight / torso and head upright. L and R are the character's own.
   pelvisOrientation does the same for the pelvis, hips and leg layering.
   torsoOrientation is a pseudo-rotation of the trunk: −90 = profile facing
   left, 0 = front, 90 = profile facing right. It narrows torso and pelvis,
   pulls the shoulder and hip attachments together, and puts the far arm
   behind the body.
   ══════════════════════════════════════════════════════════════════════════ */
const HouseCharacter = (function(){
'use strict';

const SCHEMA = 'house-character/1';

/* Fitzpatrick skin phototypes I–VI */
const SKIN = [
  {id:1,label:'Type I',hex:'#f7e0d2'},{id:2,label:'Type II',hex:'#f0cdb0'},
  {id:3,label:'Type III',hex:'#deb08a'},{id:4,label:'Type IV',hex:'#bf8a5e'},
  {id:5,label:'Type V',hex:'#8e5d3d'},{id:6,label:'Type VI',hex:'#553625'}];

/* Martin–Schultz eye-colour scale, 1 (lightest) – 16 (darkest) */
const EYES = [
  {id:1,label:'1 · light blue',hex:'#a9c9e8'},{id:2,label:'2 · blue',hex:'#7fb0dc'},
  {id:3,label:'3 · blue-grey',hex:'#7d9bb5'},{id:4,label:'4 · grey',hex:'#8e9aa3'},
  {id:5,label:'5 · blue-grey, brown flecks',hex:'#8fa3a8',fleck:1},
  {id:6,label:'6 · grey-green, brown flecks',hex:'#8d9c82',fleck:1},
  {id:7,label:'7 · green',hex:'#6f9a5a'},{id:8,label:'8 · green, brown flecks',hex:'#7c8f4a',fleck:1},
  {id:9,label:'9 · hazel',hex:'#b08a4a'},{id:10,label:'10 · light brown',hex:'#a37a3c'},
  {id:11,label:'11 · light brown',hex:'#946a30'},{id:12,label:'12 · medium brown',hex:'#7d5326'},
  {id:13,label:'13 · medium brown',hex:'#6b4420'},{id:14,label:'14 · dark brown',hex:'#54341a'},
  {id:15,label:'15 · dark brown',hex:'#3f2613'},{id:16,label:'16 · black-brown',hex:'#2a190d'}];

/* Schwarzkopf shade codes (depth-tone). Grey and white are off-chart extras. */
const HAIR = [
  {id:'1-0',label:'1-0 Black',hex:'#17120f'},{id:'3-0',label:'3-0 Dark Brown',hex:'#2e1f18'},
  {id:'4-0',label:'4-0 Medium Brown',hex:'#46301f'},{id:'5-0',label:'5-0 Light Brown',hex:'#5e4128'},
  {id:'6-0',label:'6-0 Dark Blonde',hex:'#7b5a38'},{id:'7-0',label:'7-0 Medium Blonde',hex:'#9a7648'},
  {id:'8-0',label:'8-0 Light Blonde',hex:'#b9955c'},{id:'9-0',label:'9-0 Extra Light Blonde',hex:'#d6b77c'},
  {id:'10-0',label:'10-0 Ultra Blonde',hex:'#ead7a4'},{id:'9-1',label:'9-1 Extra Light Blonde Cendré',hex:'#cfc3a8'},
  {id:'8-4',label:'8-4 Light Blonde Beige',hex:'#c2a172'},{id:'5-6',label:'5-6 Light Brown Chocolate',hex:'#5a3524'},
  {id:'5-7',label:'5-7 Light Brown Copper',hex:'#7a4526'},{id:'7-77',label:'7-77 Medium Blonde Copper Extra',hex:'#b5551f'},
  {id:'6-88',label:'6-88 Dark Blonde Red Extra',hex:'#8f1f1c'},{id:'5-99',label:'5-99 Light Brown Violet Extra',hex:'#5a2540'},
  {id:'grey',label:'Grey (off-chart)',hex:'#9a9a98'},{id:'white',label:'White (off-chart)',hex:'#e6e4de'}];

const HAIR_STYLES = [['bald','Bald'],['buzz','Buzz cut'],['short','Short'],['sidepart','Side part'],
  ['curly','Curly'],['afro','Afro'],['bob','Bob'],['long','Long'],['ponytail','Ponytail'],['bun','Bun'],['pigtails','Pigtails'],['crew','Crew cut'],['pompadour','Pompadour']];
const FACIAL = [['none','None'],['stubble','Stubble'],['moustache','Moustache'],['handlebar','Handlebar moustache'],
  ['soulpatch','Soul patch'],['goatee','Goatee'],['chinstrap','Chin strap'],['chops','Mutton chops'],
  ['beard','Short beard'],['fullbeard','Full beard']];
const HEIGHTS = ['Very short','Short','Average','Tall','Very tall'];
const WEIGHTS = ['Very slim','Slim','Average','Heavy','Very heavy'];
const HEADS = ['left','front','right'];

const JOINTS = [
  ['root','Whole body'],['pelvis','Pelvis'],['torso','Torso'],['neck','Head tilt'],
  ['shoulderL','Left shoulder'],['elbowL','Left elbow'],['wristL','Left wrist'],
  ['shoulderR','Right shoulder'],['elbowR','Right elbow'],['wristR','Right wrist'],
  ['hipL','Left hip'],['kneeL','Left knee'],['ankleL','Left ankle'],
  ['hipR','Right hip'],['kneeR','Right knee'],['ankleR','Right ankle']];

const STAND = {shoulderL:-8,elbowL:-5,shoulderR:8,elbowR:5,ankleL:-35,ankleR:35};
const POSES = [
  {id:'standing',label:'Standing',head:'front',joints:STAND},
  {id:'waving',label:'Waving',head:'front',joints:{...STAND,shoulderR:125,elbowR:60,wristR:10}},
  {id:'pointing',label:'Pointing',head:'left',joints:{...STAND,shoulderR:88,elbowR:0}},
  {id:'hips',label:'Hands on hips',head:'front',joints:{...STAND,shoulderL:-50,elbowL:95,shoulderR:50,elbowR:-95}},
  {id:'carrying',label:'Carrying a box',head:'front',held:{left:'box',right:null},
    joints:{...STAND,shoulderL:-30,elbowL:65,shoulderR:30,elbowR:-65}},
  {id:'reaching',label:'Reaching up',head:'front',joints:{...STAND,shoulderL:-172,elbowL:-4}},
  {id:'walking',label:'Walking',head:'left',turn:-90,joints:{torso:-3,shoulderL:-25,elbowL:20,shoulderR:25,elbowR:25,
    hipL:25,kneeL:-8,ankleL:58,hipR:-22,kneeR:-22,ankleR:94}},
  {id:'running',label:'Running',head:'left',turn:-90,joints:{torso:-12,shoulderL:-55,elbowL:85,shoulderR:50,elbowR:85,
    hipL:60,kneeL:-75,ankleL:85,hipR:-30,kneeR:-70,ankleR:60}},
  {id:'floor',label:'Sitting on the floor',head:'left',turn:-90,joints:{torso:4,shoulderL:-28,elbowL:8,shoulderR:-18,elbowR:6,
    hipL:88,kneeL:-4,ankleL:75,hipR:96,kneeR:-6,ankleR:75}},
  {id:'chair',label:'Sitting (chair height)',head:'left',turn:-90,joints:{shoulderL:10,elbowL:60,shoulderR:20,elbowR:50,
    hipL:90,kneeL:-88,ankleL:80,hipR:93,kneeR:-88,ankleR:80}},
  {id:'profile',label:'Standing in profile',head:'left',turn:-90,joints:{shoulderL:4,elbowL:8,shoulderR:-4,elbowR:8,ankleL:80,ankleR:80}},
  {id:'kick',label:'Kicking',head:'left',turn:-90,joints:{torso:12,pelvis:18,shoulderL:-40,elbowL:60,shoulderR:60,elbowR:40,
    hipL:70,kneeL:-5,ankleL:60,hipR:-18,ankleR:80}},
  {id:'warrior',label:'Warrior pose',head:'right',joints:{shoulderL:-90,shoulderR:90,
    hipL:-65,kneeL:65,ankleL:-80,hipR:40,ankleR:20}},
  {id:'sidebend',label:'Side bend',head:'front',joints:{torso:-22,pelvis:10,neck:-8,shoulderL:-20,elbowL:-10,shoulderR:170,elbowR:25,
    hipL:-22,ankleL:-35,hipR:2,ankleR:35}},
  {id:'lying',label:'Lying down',head:'front',joints:{root:-90,shoulderL:-8,elbowL:-5,shoulderR:8,elbowR:5}}];

/* ── colour + geometry helpers ─────────────────────────────────────────── */
function shade(hex,f){
  const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255;
  const t=f<0?0:255, a=Math.abs(f);
  r=Math.round(r+(t-r)*a); g=Math.round(g+(t-g)*a); b=Math.round(b+(t-b)*a);
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
const n2=v=>+v.toFixed(2);
const Mx={
  mul(m,n){return [m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],
                   m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];},
  tr(m,x,y,deg){const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return Mx.mul(m,[c,s,-s,c,x,y]);},
  pt(m,x,y){return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];}
};
/* tapered capsule from (0,0) radius r1 down to (0,len) radius r2 */
function capsule(r1,r2,len){
  return `M${n2(-r1)},0A${n2(r1)},${n2(r1)} 0 0 1 ${n2(r1)},0L${n2(r2)},${n2(len)}A${n2(r2)},${n2(r2)} 0 0 1 ${n2(-r2)},${n2(len)}Z`;
}
/* the covered top part of a capsule (sleeve / shorts leg) */
function sleeve(r1,r2,len,frac){
  const L=len*frac, rm=r1+(r2-r1)*frac+0.5, a=r1+0.5;
  return `M${n2(-a)},0A${n2(a)},${n2(a)} 0 0 1 ${n2(a)},0L${n2(rm)},${n2(L)}L${n2(-rm)},${n2(L)}Z`;
}
function ring(cx,cy,rx,ry,a0,a1,n,r){
  let s='';
  for(let i=0;i<n;i++){const a=(a0+(a1-a0)*i/(n-1))*Math.PI/180;
    s+=`<circle cx="${n2(cx+rx*Math.cos(a))}" cy="${n2(cy+ry*Math.sin(a))}" r="${r}"/>`;}
  return s;
}

/* ── held items. Origin = grip point in the palm.
      upright:false → drawn in the hand's frame (+y continues the forearm)
      upright:true  → stays vertical whatever the arm does
      side = +1 for the character's left hand, −1 for the right            ── */
/* props stand on the floor. Chair, stool and bicycle are pinned to the pelvis; the rest stand next to the character. */
const PROPS={chair:{label:'Chair',col:'#CC9966'},stool:{label:'Stool',col:'#CC9966'},desk:{label:'School desk',col:'#CC9966'},
  beachchair:{label:'Beach chair',col:'#FF6600'},stroller:{label:'Stroller',col:'#0066CC'},bmx:{label:'BMX bicycle',col:'#CC0000'},roadbike:{label:'Road bicycle',col:'#0066CC'},
  mtb:{label:'Mountain bicycle',col:'#00CC66'},piano:{label:'Grand piano and stool',col:'#000000'},drums:{label:'Drum set',col:'#CC0000'},keyboard:{label:'Electronic keyboard',col:'#333333'},scooter:{label:'Scooter',col:'#CC0000'},car:{label:'Car',col:'#CC0000'}};
/* Side-view bicycle geometry in stage pixels (about 227 px per metre), saddle at the origin, facing +x.
   G floor · R wheel radius · tw tyre width · A/F rear and front axle · BB bottom bracket · J where seat stays and top tube meet the seat tube ·
   HT/HB head tube top and bottom · bar handlebar point · k drawing scale */
const BIKES={
  bmx:{k:1.6,G:104,R:34,tw:5,A:[-48,70],F:[87,70],BB:[18,68],J:[4,18],HT:[67.4,4.4],HB:[67.4,4.4],bar:[63.4,-21.6],barW:30,rx:4.5},      /* 20" wheels */
  roadbike:{k:1,G:192,R:80,tw:5,A:[-60,112],F:[165,112],BB:[30,128],J:[8,34],HT:[128,2],HB:[135,28],bar:[140,-12],barW:44,drop:1,rx:5},       /* 28" wheels, drop bar */
  mtb:{k:1,G:197,R:77,tw:10,A:[-66,120],F:[186,120],BB:[34,128],J:[10,40],HT:[142,4],HB:[152,36],bar:[150,-12],barW:76,susp:1,rx:10}           /* 26" wheels, double suspension */
};
function propSVG(id,c,o){   /* o = {x,y: hip point, g: floor, side: profile view?, dir: facing (-1 left, +1 right), hw} → [{z, svg, bottom?, span?}] */
  const e=edge(c), F=`fill="${c}" stroke="${e}"`, D=`fill="${shade(c,-0.25)}" stroke="${e}"`, T='fill="#2b2b2b" stroke="#111"', Mt='fill="#b4bcc4" stroke="#5f6870"';
  const {x,y,g,side,dir}=o, sy=n2(y+13), R=(a,b,w,h,f,r)=>`<rect x="${n2(a)}" y="${n2(b)}" width="${n2(w)}" height="${n2(h)}" rx="${r||0}" ${f}/>`;
  const at=(X,Y,body,k,flip)=>`<g transform="translate(${n2(X)} ${n2(Y)}) scale(${(flip===false?1:dir)*(k||1)} ${k||1})">${body}</g>`;
  const P=p=>`${p[0]},${p[1]}`;
  const tube=(d,w,col)=>`<path d="${d}" fill="none" stroke="${col?'#111':e}" stroke-width="${w+2.4}" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col||c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  /* wheel: translucent spokes, tyre, rim, hub */
  const wheel=(cx,cy,r,tw,knob)=>{ tw=tw||5; let sp=''; for(let i=0;i<14;i++){const a=i*Math.PI/7; sp+=`M${cx},${cy}L${n2(cx+(r-tw)*Math.cos(a))},${n2(cy+(r-tw)*Math.sin(a))}`;}
    return `<path d="${sp}" stroke="#5f6870" stroke-opacity=".35" stroke-width="1.2" fill="none"/><circle cx="${cx}" cy="${cy}" r="${n2(r-tw/2)}" fill="none" stroke="#222" stroke-width="${tw}"/>`
      +(knob?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#222" stroke-width="3" stroke-dasharray="4 5"/>`:'')
      +`<circle cx="${cx}" cy="${cy}" r="${n2(r-tw-1.5)}" fill="none" stroke="#9aa3ab" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="${Math.max(2.5,r*0.07)}" ${Mt}/>`; };
  if(BIKES[id]){
    const b=BIKES[id], Y=y+13, k=b.k, wy=b.G-b.R;
    if(side){
      let fr=wheel(b.A[0],b.A[1],b.R,b.tw,b.susp)+wheel(b.F[0],b.F[1],b.R,b.tw,b.susp);
      if(b.susp){   /* swingarm, rear shock, telescopic fork */
        fr+=tube(`M${b.BB[0]-2},${b.BB[1]-26}L${P(b.A)}L${b.J[0]+6},${b.J[1]+34}`,5)
          +`<path d="M${b.J[0]+8},${b.J[1]+30}L${b.BB[0]+22},${b.BB[1]-44}" stroke="#333" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M${b.J[0]+8},${b.J[1]+30}L${b.BB[0]+22},${b.BB[1]-44}" stroke="#FFCC00" stroke-width="5" stroke-dasharray="3 3" fill="none"/>`
          +tube(`M${P(b.BB)}L${P(b.J)}M${P(b.J)}L${P(b.HT)}L${P(b.HB)}L${P(b.BB)}`,7)
          +`<path d="M${P(b.HB)}L${n2((b.HB[0]+b.F[0])/2)},${n2((b.HB[1]+b.F[1])/2)}" stroke="#b4bcc4" stroke-width="5" fill="none"/>`+tube(`M${n2((b.HB[0]+b.F[0])/2)},${n2((b.HB[1]+b.F[1])/2)}L${P(b.F)}`,8,'#333');
      } else {
        fr+=tube(`M${P(b.BB)}L${P(b.A)}L${P(b.J)}M${P(b.J)}L${P(b.HT)}L${P(b.HB)}L${P(b.BB)}L${P(b.J)}`,id==='bmx'?4:4.5)
          +tube(id==='roadbike'?`M${P(b.HB)}Q${b.HB[0]+14},${b.F[1]-30} ${P(b.F)}`:`M${P(b.HB)}L${P(b.F)}`,id==='bmx'?4:4);
      }
      fr+=`<path d="M${P(b.J)}L0,3" stroke="#b4bcc4" stroke-width="${id==='bmx'?3:4}" fill="none"/><path d="M${id==='bmx'?-12:-20},1H${id==='bmx'?13:16}" stroke="#222" stroke-width="${id==='bmx'?6:7}" stroke-linecap="round" fill="none"/>`
        +`<path d="M${P(b.HT)}L${P(b.bar)}" stroke="#b4bcc4" stroke-width="${id==='bmx'?3:4.5}" stroke-linecap="round" fill="none"/>`
        +(b.drop?`<path d="M${P(b.bar)}h16q14,2 10,18q-6,12 -20,10" stroke="#222" stroke-width="5" stroke-linecap="round" fill="none"/>`
                :`<path d="M${b.bar[0]-(id==='bmx'?8:7)},${b.bar[1]-(id==='bmx'?1:0)}L${b.bar[0]+(id==='bmx'?10:11)},${b.bar[1]+(id==='bmx'?1:0)}" stroke="#222" stroke-width="${id==='bmx'?5:7}" stroke-linecap="round" fill="none"/>`)
        +`<circle cx="${b.BB[0]}" cy="${b.BB[1]}" r="${id==='bmx'?7:11}" ${Mt}/><path d="M${P(b.BB)}l${id==='bmx'?'10,16m-6,0h12':'14,34m-10,0h20'}" stroke="#333" stroke-width="${id==='bmx'?3.4:4.5}" stroke-linecap="round" fill="none"/>`;
      const far=`<path d="M${P(b.BB)}l${id==='bmx'?'-10,-16m-6,0h12':'-14,-34m-10,0h20'}" stroke="#333" stroke-width="${id==='bmx'?3.4:4.5}" stroke-linecap="round" fill="none"/>`;   /* the other pedal */
      return [{z:5,svg:at(x,Y,far,k)},{z:24,bottom:Y+b.G*k,span:(Math.max(-b.A[0],b.F[0])+b.R)*k,svg:at(x,Y,fr,k)}];
    }
    const bw=b.barW, by=b.bar[1], col=`stroke="${e}"`;
    return [{z:33,bottom:Y+b.G*k,span:bw*k+8,svg:at(x,Y,`<ellipse cx="0" cy="${wy}" rx="${b.rx}" ry="${b.R}" ${T}/>`+tube(`M-9,${by+10}L-${b.rx+3},${wy}M9,${by+10}L${b.rx+3},${wy}M-9,${by+10}H9`,id==='mtb'?6:4)+`<path d="M-14,2H14" stroke="#222" stroke-width="7" stroke-linecap="round" fill="none"/>`,k,false)},
            {z:45,svg:at(x,Y,`<path d="M${-bw},${by}H${bw}" stroke="#5f6870" stroke-width="${id==='mtb'?5:4}" stroke-linecap="round" fill="none"/>`
              +(b.drop?`<path d="M${-bw},${by}q-7,2 -5,18q2,10 9,10M${bw},${by}q7,2 5,18q-2,10 -9,10" stroke="#222" stroke-width="5" stroke-linecap="round" fill="none"/>`
                      :`<path d="M${-bw-2},${by}H${-bw+12}M${bw-12},${by}H${bw+2}" stroke="#111" stroke-width="7" stroke-linecap="round" fill="none"/>`),k,false)}];
  }
  switch(id){
    case 'chair': return side
      ?[{z:-1,svg:R(x-dir*20-3.5,y-64,7,g-y+64,F)+R(x+dir*20-3.5,sy+6,7,g-sy-6,F)+R(x-27,sy,54,8,F,2)+R(x-dir*20-5,y-64,10,34,D,3)}]
      :[{z:-1,svg:R(x-24,y-68,7,g-y+68,F)+R(x+17,y-68,7,g-y+68,F)+R(x-24,y-66,48,30,D,4)+R(x-28,sy,56,8,F,2)+R(x-26,sy+6,6,g-sy-6,F)+R(x+20,sy+6,6,g-sy-6,F)}];
    case 'beachchair': {   /* low folding deck chair: reclined striped sling on a crossed wooden frame, seat pinned to the pelvis */
      const W='#b98a55', frame=dd=>`<path d="${dd}" fill="none" stroke="#6e4a26" stroke-width="7.4" stroke-linecap="round"/><path d="${dd}" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round"/>`;
      if(!side) return [{z:-1,span:44,svg:frame(`M${n2(x-34)},${n2(y-78)}V${n2(g)}M${n2(x+34)},${n2(y-78)}V${n2(g)}M${n2(x-34)},${n2(g-4)}H${n2(x+34)}`)+R(x-30,y-76,60,g-y+52-(g-sy)+8,F,3)
        +[-20,-6,8].map(k=>R(x+k,y-76,7,g-y+52-(g-sy)+8,'fill="#fff" fill-opacity=".85" stroke="none"')).join('')}];
      const sling=`M${n2(x-dir*56)},${n2(y-74)}Q${n2(x-dir*22)},${n2(sy+10)} ${n2(x+dir*2)},${n2(sy+6)}L${n2(x+dir*46)},${n2(sy-2)}`;
      return [{z:-1,span:70,svg:frame(`M${n2(x-dir*60)},${n2(y-80)}L${n2(x+dir*34)},${n2(g)}M${n2(x+dir*50)},${n2(sy-6)}L${n2(x-dir*44)},${n2(g)}`)
        +`<path d="${sling}" fill="none" stroke="${e}" stroke-width="9.4" stroke-linecap="round"/><path d="${sling}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="${sling}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="7" stroke-dasharray="9 11"/>`}]; }
    case 'keyboard': {   /* electronic keyboard on a folding X stand. It stands on the floor at about waist height, lower for a seated player. */
      const h=Math.max(130,Math.min(215,g-y+12)), tube=dd=>`<path d="${dd}" fill="none" stroke="#111" stroke-width="6.4" stroke-linecap="round"/><path d="${dd}" fill="none" stroke="#3a3f45" stroke-width="4" stroke-linecap="round"/>`;
      if(side){   /* seen from its end: the slab in section, the stand edge-on */
        const X=x+dir*64;
        return [{z:28,span:110,svg:at(X,g,tube(`M0,${-h+12}V-3M-20,-3H20M-15,${-h+13}H15`)
          +`<path d="M-20,${-h}H16Q20,${-h} 20,${-h+4}V${-h+11}H-20Z" ${F}/><rect x="-20" y="${-h-2.5}" width="26" height="4" rx="1" fill="#fff" stroke="#555" stroke-width=".8"/><rect x="-8" y="${-h-4}" width="14" height="3" rx="1" fill="#161616" stroke="none"/>`)}];
      }
      /* front view: the keyboard is between the viewer and the player, so it is drawn in front */
      const W2=150, kw=276, n=28; let keys='';
      for(let i=1;i<n;i++) keys+=`M${n2(-kw/2+kw*i/n)},${-h+8}V${-h+22}`;
      let blacks=''; for(let i=0;i<n;i++){ if([0,1,3,4,5].includes(i%7)) blacks+=`<rect x="${n2(-kw/2+kw*(i+1)/n-3)}" y="${-h+8}" width="6" height="8.5" fill="#161616" stroke="none"/>`; }
      const stand=tube(`M-104,-3L92,${-h+26}M104,-3L-92,${-h+26}M-118,-3H-88M88,-3H118M-108,${-h+27}H-76M76,${-h+27}H108`)+`<circle cx="0" cy="${n2((-h+26-3)/2)}" r="4.5" ${Mt}/>`
        ;
      const slab=`<g transform="translate(0 ${-2*h+26}) scale(1 -1)"><rect x="${-W2}" y="${-h}" width="${W2*2}" height="26" rx="5" ${F}/><rect x="${-kw/2}" y="${-h+8}" width="${kw}" height="14" fill="#fff" stroke="#555" stroke-width=".8"/><path d="${keys}" stroke="#777" stroke-width=".7" fill="none"/>${blacks}`
        +`<rect x="-26" y="${-h+2}" width="52" height="4.5" rx="1" fill="#7fd0e6" stroke="none"/>`+[-120,-104,-88,88,104,120].map(k=>`<circle cx="${k}" cy="${-h+4.3}" r="1.8" fill="#b4bcc4" stroke="none"/>`).join('')+'</g>';
      /* controls strip along the lower edge, redrawn on the front layer */
      const panel=`<path d="M${-W2},${n2(-h+18.5)}H${W2}V${-h+21}Q${W2},${-h+26} ${W2-5},${-h+26}H${-W2+5}Q${-W2},${-h+26} ${-W2},${-h+21}Z" ${F}/><rect x="-26" y="${n2(-h+19.5)}" width="52" height="4.5" rx="1" fill="#7fd0e6" stroke="none"/>`+[-120,-104,-88,88,104,120].map(k=>`<circle cx="${k}" cy="${n2(-h+21.7)}" r="1.8" fill="#b4bcc4" stroke="none"/>`).join('');
      /* keys and the top edge sit behind the arms, so the hands rest on them; the stand and the controls strip are in front of the hands */
      return [{z:45,span:W2+10,svg:at(x,g,slab,1,false)},{z:90,svg:at(x,g,stand+panel,1,false)}]; }   /* the keyboard itself is flipped top to bottom: keys along the top edge, controls below */
    case 'drums': {   /* the throne is pinned to the pelvis; the kit stands in front of the drummer, in side or front view. The colour is only the drum shells. */
      const seat=g-sy, H='fill="#f3ead8" stroke="#5f6870"', K='#d7b54a', KS='#8c7220';
      const stand=dd=>`<path d="${dd}" fill="none" stroke="#5f6870" stroke-width="4" stroke-linecap="round"/><path d="${dd}" fill="none" stroke="#b4bcc4" stroke-width="2" stroke-linecap="round"/>`;
      const throne=`<g transform="translate(${n2(x)} ${sy})">${stand(`M0,8V${n2(seat-4)}M0,${n2(seat*0.55)}L-20,${n2(seat)}M0,${n2(seat*0.55)}L20,${n2(seat)}`)}<rect x="-24" y="0" width="48" height="10" rx="5" fill="#2b2b2b" stroke="#111"/></g>`;
      /* a drum seen side-on: coloured shell between two metal hoops */
      const drum=(w,h)=>`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" ${F}/><rect x="${-w/2-2}" y="${-h/2-3}" width="${w+4}" height="4" rx="1.5" ${Mt}/><rect x="${-w/2-2}" y="${h/2-1}" width="${w+4}" height="4" rx="1.5" ${Mt}/>`+[-0.3,0,0.3].map(k=>`<rect x="${n2(w*k-1.2)}" y="-4" width="2.4" height="8" ${Mt} stroke-width=".6"/>`).join('');
      const put=(X,Y,r,body)=>`<g transform="translate(${X} ${Y}) rotate(${r})">${body}</g>`;
      const cym=(X,Y,r,rx)=>put(X,Y,r,`<ellipse cx="0" cy="0" rx="${rx}" ry="${n2(rx*0.11)}" fill="${K}" stroke="${KS}"/><circle cx="0" cy="-2" r="2.6" fill="${K}" stroke="${KS}" stroke-width=".8"/>`);
      if(!side){   /* front view: the kit faces the viewer and stands in front of the drummer */
        const head=(w)=>`<ellipse cx="0" cy="0" rx="${n2(w/2)}" ry="${n2(w*0.13)}" fill="#f3ead8" stroke="#5f6870"/>`;
        /* a drum seen from the front and a little above: coloured shell, pale head on top */
        const tom=(X,Y,w,h,r)=>put(X,Y,r||0,`<path d="M${n2(-w/2)},0V${n2(h)}A${n2(w/2)},${n2(w*0.13)} 0 0 0 ${n2(w/2)},${n2(h)}V0Z" ${F}/><path d="M${n2(-w/2)},${n2(h*0.5)}A${n2(w/2)},${n2(w*0.13)} 0 0 0 ${n2(w/2)},${n2(h*0.5)}" fill="none" stroke="${e}" stroke-opacity=".5"/>`+[-0.32,0,0.32].map(k=>`<rect x="${n2(w*k-1.2)}" y="${n2(h*0.3)}" width="2.4" height="${n2(h*0.4)}" ${Mt} stroke-width=".6"/>`).join('')+head(w));
        const kit=stand('M-96,0L-104,-212M-102,-16L-118,0M-102,-16L-84,0')+cym(-104,-214,6,48)                 /* ride */
          +stand('M118,0V-196M118,-10L102,0M118,-10L134,0')+cym(118,-190,0,32.4)+cym(118,-195,0,32.4)            /* hi-hat */
          +stand('M52,-126L78,-262')+cym(78,-264,-8,42)                                                          /* crash */
          +stand('M-140,-60V0M-84,-60V0')+tom(-112,-115,64.4,80.5)                                                   /* floor tom */
          +stand('M-24,-145V-168M26,-145V-166')+tom(-32,-196,52.9,32.2,-4)+tom(34,-197,57.5,34.5,4)                      /* rack toms */
          +stand('M70,-112L56,0M70,-112L84,0')+tom(70,-128,50,16)                                                /* snare */
          +`<circle cx="0" cy="-73.6" r="73.6" fill="#2b2b2b" stroke="#111"/><circle cx="0" cy="-73.6" r="65.5" fill="#f3ead8" stroke="#5f6870"/><circle cx="0" cy="-73.6" r="23" fill="none" stroke="#b9b29c" stroke-width="1.2"/>`
          +[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180; return `<rect x="-2" y="-4" width="4" height="8" transform="translate(${n2(69.6*Math.cos(r))} ${n2(-73.6+69.6*Math.sin(r))}) rotate(${a+90})" ${Mt} stroke-width=".6"/>`;}).join('')
          +stand('M-60,-25L-76,0M60,-25L76,0');                                                                   /* bass drum: we see its front head, so no shell colour here */
        return [{z:-1.5,svg:throne},{z:90,span:170,svg:at(x,g,kit,1,false)}];
      }
      const back=stand('M24,0V-196M24,-10L8,0M24,-10L40,0')+cym(24,-190,0,32.4)+cym(24,-195,0,32.4)
        +stand('M176,0L170,-210M172,-14L158,0M172,-14L190,0')+cym(170,-212,8,48)
        +stand('M150,-40V0M196,-40V0')+put(173,-80,0,drum(52.9,85.1));                                  /* hi-hat, ride cymbal, floor tom */
      const front=stand('M112,-128L128,-262')+cym(128,-264,-10,42)                                   /* crash cymbal */
        +`<rect x="78" y="-146.6" width="69" height="142.6" ${F}/><rect x="73" y="-151" width="8" height="151" rx="2" fill="#2b2b2b" stroke="#111"/><rect x="144" y="-151" width="8" height="151" rx="2" fill="#2b2b2b" stroke="#111"/>`
        +[-115,-76,-37].map(yy=>`<rect x="108" y="${yy}" width="8" height="3" ${Mt} stroke-width=".6"/>`).join('')+stand('M84,-6L70,0M141,-6L157,0')
        +stand('M100,-147V-170M134,-147V-166')+put(100,-188,-14,drum(50.6,29.9))+put(146,-182,-8,drum(55.2,34.5))   /* bass drum and two rack toms */
        +stand('M52,-132L40,0M52,-132L64,0M52,-132V-60')+put(52,-142,0,drum(44,15))                          /* snare on its stand */
        +`<path d="M46,-3H76L78,-9" fill="none" stroke="#333" stroke-width="4" stroke-linecap="round"/><path d="M70,-6L75,-58" stroke="#5f6870" stroke-width="2.4" fill="none"/><circle cx="75" cy="-60" r="5" ${H}/>`;
      return [{z:-1.5,svg:throne},{z:-1,span:230,svg:at(x,g,back)},{z:28,svg:at(x,g,front)}]; }
    case 'piano': {   /* the stool is pinned to the pelvis; the piano stands in front of the player, keyboard toward them, always seen from the side */
      const seat=g-sy, W='#b98a55';
      const bench=R(x-26,sy,52,9,'fill="#7a1f1f" stroke="#3d0f0f"',3)+R(x-24,sy+8,48,6,`fill="${c}" stroke="${e}"`)+R(x-21,sy+13,5,seat-13,`fill="${c}" stroke="${e}"`)+R(x+16,sy+13,5,seat-13,`fill="${c}" stroke="${e}"`);
      /* behind the player: pedals and keys (the hands go over them) */
      const back=`<path d="M108,-128L120,-22M100,-128L88,-22" stroke="${e}" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M84,-16H126" stroke="#e2b23a" stroke-width="5" stroke-linecap="round" fill="none"/>`
        +`<path d="M40,-170Q40,-178 48,-178H92V-156H40Z" ${F}/>`   /* only the strip the keys sit in stays behind the hands */
        +R(44,-166,44,9,'fill="#fff" stroke="#555"')+`<path d="M52,-166v9M60,-166v9M68,-166v9M76,-166v9" stroke="#555" stroke-width=".8" fill="none"/><path d="M48,-169H86" stroke="#111" stroke-width="3" fill="none"/>`;
      /* in front of the player: lid, prop stick, music desk, the case and the key bed */
      const front=`<path d="M112,-192L452,-318L462,-312L130,-190Z" ${F}/><path d="M300,-192L330,-270" stroke="${e}" stroke-width="4" stroke-linecap="round" fill="none"/>`
        +`<path d="M94,-194L102,-226" stroke="${e}" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M94,-194L102,-226" stroke="${W}" stroke-width="3" stroke-linecap="round" fill="none"/>`
        +`<path d="M86,-192H440Q470,-192 470,-162V-142Q470,-128 452,-128H86Z" ${F}/>`
        +`<path d="M40,-157H92V-128H48Q40,-128 40,-136Z" ${F}/>`;   /* key bed: in front of the player, whose legs go under it */
      const legs=R(66,-130,14,124,F,3)+R(424,-130,14,124,F,3)+`<circle cx="73" cy="-5" r="5" ${Mt}/><circle cx="431" cy="-5" r="5" ${Mt}/>`;   /* in front of the player's legs */
      return [{z:-1.5,svg:bench},{z:-1,span:520,svg:at(x,g,back)},{z:34,svg:at(x,g,legs)},{z:90,svg:at(x,g,front)}]; }
    case 'stool': { const legs=`M${n2(x-12)},${sy+6}L${n2(x-21)},${n2(g)}M${n2(x+12)},${sy+6}L${n2(x+21)},${n2(g)}M${n2(x)},${sy+6}V${n2(g)}`;
      return [{z:-1,svg:tube(legs,4.4)+R(x-17,(sy+g)/2,34,4,D,2)+R(x-20,sy,40,8,F,4)}]; }
    case 'desk': { const X=side?x+dir*74:x, w=side?52:82, h=150;   /* a real desk height: about 75 cm */
      return [{z:90,span:side?130:w,svg:R(X-w+6,g-h+6,6,h-6,Mt)+R(X+w-12,g-h+6,6,h-6,Mt)+(side?'':R(X-w+10,g-h+8,w*2-20,46,D))+R(X-w+10,g-h+22,w*2-20,6,D)+R(X-w,g-h,w*2,10,F,2)}]; }
    case 'stroller': { const X=side?x+dir*170:x+o.hw+112;
      return side?[{z:90,span:260,svg:at(X,g,`<path d="M-30,-70L-56,-104" stroke="#333" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M-62,-102L-50,-106" stroke="#111" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M-22,-36L-24,-14M22,-36L24,-14M-22,-36L24,-14" stroke="#555" stroke-width="3" fill="none"/><path d="M-32,-72H32Q32,-36 0,-34Q-32,-36 -32,-72Z" ${F}/><path d="M-2,-72A34,34 0 0 1 32,-106L32,-72Z" ${D}/>`+wheel(-24,-13,13,3)+wheel(24,-13,13,3),2)}]
        :[{z:-1,span:o.hw+180,svg:at(X,g,`<path d="M-22,-104H22" stroke="#111" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M-22,-104L-24,-70M22,-104L24,-70" stroke="#333" stroke-width="4" fill="none"/><ellipse cx="-24" cy="-13" rx="4.5" ry="13" ${T}/><ellipse cx="24" cy="-13" rx="4.5" ry="13" ${T}/><path d="M-26,-112Q0,-128 26,-112V-78H-26Z" ${D}/><rect x="-28" y="-80" width="56" height="48" rx="8" ${F}/><path d="M-22,-34V-20M22,-34V-20" stroke="#555" stroke-width="3" fill="none"/>`,2,false)}]; }
    case 'scooter': return side
      ?[{z:24,span:150,svg:at(x,g,wheel(-66,-22,22,5)+wheel(80,-22,22,5)+tube('M-58,-24H58L80,-22',7)+`<path d="M80,-22L66,-236" stroke="#5f6870" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M80,-22L66,-236" stroke="#b4bcc4" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M54,-238H78" stroke="#111" stroke-width="8" stroke-linecap="round" fill="none"/>`)}]
      :[{z:33,span:60,svg:at(x,g,`<ellipse cx="0" cy="-22" rx="6" ry="22" ${T}/>`+R(-16,-30,32,8,F,3)+`<path d="M0,-30V-236" stroke="#5f6870" stroke-width="8" fill="none"/><path d="M0,-30V-236" stroke="#b4bcc4" stroke-width="5" fill="none"/>`,1,false)},
        {z:45,svg:at(x,g,`<path d="M-46,-238H46" stroke="#5f6870" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M-48,-238H-34M34,-238H48" stroke="#111" stroke-width="8" stroke-linecap="round" fill="none"/>`,1,false)}];
    case 'car': { /* the character drives: the seat is pinned to the pelvis, the body shell is in front, and you see them through the window */
      const k=3, X=x-dir*34*k, Y=y+13+38*k;
      const body='M-170,-22V-58Q-168,-70 -150,-72L-100,-76L-66,-112Q-60,-118 -48,-118H52Q64,-118 72,-110L112,-76L156,-70Q170,-66 170,-50V-22Z', w1='M-58,-110L-90,-78H-6V-110Z', w2='M6,-110V-78H96L64,-110Z';
      const wh=cx=>`<circle cx="${cx}" cy="-24" r="24" ${T}/><circle cx="${cx}" cy="-24" r="12" ${Mt}/><circle cx="${cx}" cy="-24" r="3" fill="#5f6870" stroke="none"/>`;
      return [{z:-2,bottom:Y,span:170*k,svg:at(X,Y,`<path d="${body}" fill="${shade(c,-0.55)}" stroke="${e}" stroke-width=".6"/><rect x="10" y="-100" width="12" height="66" rx="5" fill="#3a3f45" stroke="none"/>`,k)},
              {z:95,svg:at(X,Y,`<path d="${body}${w1}${w2}" fill="${c}" fill-rule="evenodd" stroke="${e}" stroke-width=".6"/><path d="${w1}${w2}" fill="#bcdcf0" fill-opacity=".3" stroke="${e}" stroke-width=".6"/><path d="M0,-78V-26M-96,-78V-30M100,-76V-30" stroke="${e}" stroke-width=".6" fill="none"/><rect x="-24" y="-66" width="14" height="4" rx="2" ${Mt} stroke-width=".5"/><rect x="74" y="-66" width="14" height="4" rx="2" ${Mt} stroke-width=".5"/><rect x="158" y="-64" width="12" height="10" rx="3" fill="#FFFF99" stroke="${e}" stroke-width=".6"/><rect x="-170" y="-64" width="8" height="12" rx="2" fill="#CC0000" stroke="${e}" stroke-width=".6"/>`+wh(-100)+wh(104),k)}]; }
  }
  return [];
}
const ITEM_CATS=[['Tools',['wrench','hammer','screwdriver','pliers','paintbrush','flashlight','multimeter','solderingiron','toolbox']],
  ['Kitchen',['fork','knife','spoon','pan','cup','mug','bowl','plate','cake','pizzabox']],['Everyday',['book','phone','tablet','keys','balloon','teddy']],
  ['Sports',['beachball','soccerball','basketball','volleyball','football','tennisball','baseball','tennisracket','baseballbat','mitt']],
  ['Cleaning',['broom','mop','duster']],
  ['Bags and luggage',['box','bag','purse','briefcase','suitcase']],['Umbrellas and canes',['cane','parasol','umbrella','parasolclosed','umbrellaclosed']],
  ['Music',['boombox','microphone','micstand','guitar','electricguitar','bass','violin','viola','cello','doublebass','violinbow','mandolin','bongos','accordion','concertina','trumpet','flute','tambourine','maraca','drumstick']],
  ['Hats',['hat_cap','hat_beanie','hat_sunhat','hat_hardhat','hat_fedora']]];
/* Grip: items that turn with the hand (everything not marked upright or cane) can be held at an angle.
   0° = the item runs along the fingers; positive angles swing its far end away from the body's centre (arm hanging), in 45° steps.
   An item's own `grip` is its default; heldLeftGrip / heldRightGrip override it. */
const GRIPS=[-180,-135,-90,-45,0,45,90,135,180];
/* each item: col = default colour, draw(side, colour). cane:true items are sized to reach the floor. */
const ITEMS = (()=>{
  const F=(c,x)=>`fill="${c}" stroke="${edge(c)}"${x||''}`, M='#b4bcc4', MS='#5f6870', W='#b98a55', WS='#6e4a26';
  const metal=`fill="${M}" stroke="${MS}"`, wood=`fill="${W}" stroke="${WS}"`;
  const handle=(w,y1,attr)=>`<rect x="${-w}" y="-9" width="${w*2}" height="${y1+9}" rx="${Math.min(w,2)}" ${attr}/>`;
  const steam=(x,y)=>[-6,0,6].map((dx,i)=>`<path d="M${x+dx},${y-(i%2)*3}q-4,-6 0,-12t0,-12" fill="none" stroke="#8fa0aa" stroke-opacity=".5" stroke-width="2.6" stroke-linecap="round"/>`).join('');
  /* Violin family, drawn once in violin-sized units and scaled: violin 1, viola 1.18, cello 3.6, double bass 5.4.
     Origin = the hand on the neck. Scroll and peg box with four black tuning pegs, black fingerboard, waisted body with
     C-bouts and corners, f-holes, white bridge, black tailpiece and end button, four strings. */
  const viol=(c,k,o)=>{ o=o||{}; const w=v=>n2(v/k), dk=edge(c), BK='fill="#161616" stroke="#000"';
    const sh=o.bass?'C2.5,22 9.5,26 10.9,33':'C6,22 11.6,24.6 11.6,31';        /* a double bass has sloping shoulders */
    const shM=o.bass?'C-9.5,26 -2.5,22 0,22':'C-11.6,24.6 -6,22 0,22';
    const body=`M0,22${sh}C11.6,35.4 10,37.6 8.7,38.5L9.9,39.8C7.3,42.2 7.2,47.4 10,50.3L8.9,51.7C12.4,53.2 14.2,57 14.2,61.6C14.2,67.8 8,71.4 0,71.4C-8,71.4 -14.2,67.8 -14.2,61.6C-14.2,57 -12.4,53.2 -8.9,51.7L-10,50.3C-7.2,47.4 -7.3,42.2 -9.9,39.8L-8.7,38.5C-10,37.6 -11.6,35.4 ${o.bass?'-10.9,33':'-11.6,31'}${shM}Z`;
    const pegs=[[-1,-13.2],[-1,-9.6],[1,-11.4],[1,-7.8]].map(([sd,y])=>`<rect x="${sd<0?-6.6:2}" y="${y}" width="4.6" height="1.7" rx=".85" ${BK} stroke-width="${w(0.5)}"/>`).join('');
    const fhole=sd=>`<path d="M${sd*4.9},42.6Q${sd*6.6},47.6 ${sd*4.7},52.8" fill="none" stroke="#1d140c" stroke-width="${w(1.1)}" stroke-linecap="round"/><circle cx="${sd*4.5}" cy="42.2" r=".75" fill="#1d140c" stroke="none"/><circle cx="${sd*5.1}" cy="53.2" r=".75" fill="#1d140c" stroke="none"/>`;
    const strings=[-1,-0.34,0.34,1].map(t=>`M${n2(t*1.1)},-6L${n2(t*2.5)},49.6L${n2(t*1.7)},57.4`).join('');
    return `<g transform="scale(${k})" stroke-width="${w(1.3)}" stroke-linejoin="round">`
      +(o.pin?`<path d="M0,71V${71+o.pin}" stroke="#333" stroke-width="${w(2.4)}" stroke-linecap="round" fill="none"/>`:'')
      +pegs+`<path d="M-2.3,-14.6H2.3L1.9,-5.6H-1.9Z" fill="${shade(c,-0.35)}" stroke="${dk}"/><circle cx="0" cy="-16.6" r="3" fill="${shade(c,-0.35)}" stroke="${dk}"/><circle cx="0" cy="-16.6" r="1.1" fill="none" stroke="${dk}" stroke-width="${w(0.8)}"/>`
      +`<path d="${body}" fill="${c}" stroke="${dk}"/><path d="${body}" fill="none" stroke="${shade(c,-0.22)}" stroke-width="${w(0.9)}" transform="translate(0 2.34) scale(0.95)"/>`
      +fhole(-1)+fhole(1)
      +`<path d="M-1.7,-6H1.7L2.9,41H-2.9Z" ${BK} stroke-width="${w(0.6)}"/>`
      +`<path d="M-2.8,57.2H2.8L1.7,68.6H-1.7Z" ${BK} stroke-width="${w(0.6)}"/><circle cx="0" cy="71" r="1.1" ${BK} stroke-width="${w(0.5)}"/>`
      +(o.chin?`<ellipse cx="-7.6" cy="65.4" rx="4.6" ry="3.4" ${BK} stroke-width="${w(0.6)}"/>`:'')
      +`<path d="M-4.1,48.8H4.1L3.5,50.9H-3.5Z" fill="#ffffff" stroke="#8a8a8a" stroke-width="${w(0.6)}"/>`
      +`<path d="${strings}" fill="none" stroke="#e8e2d0" stroke-width="${w(0.5)}"/><path d="M-1.9,-5.8H1.9" stroke="#f1ede0" stroke-width="${w(1)}" fill="none"/></g>`; };
  /* Solid-body electric guitar / bass. o: k scale · nut, joint: where the neck starts and meets the body · head: headstock length ·
     strings · body, guard: outlines · pickups: [y, tilt, x-shift] · bridge: y · knobs: [x,y]. Origin = the hand on the neck. */
  const solid=(c,o)=>{ const k=o.k, w=v=>n2(v/k), dk=edge(c), n=o.strings, hy=o.nut-o.head, maple='#dfc08a', mapleS='#8a6a34', rose='#3a2a1c';
    const tuners=Array.from({length:n},(_,i)=>{const y=n2(hy+4+(o.head-8)*i/(n-1)); return `<rect x="-9.4" y="${n2(y-1)}" width="5" height="2" rx="1" ${metal} stroke-width="${w(0.5)}"/><circle cx="-1.6" cy="${y}" r="1.2" ${metal} stroke-width="${w(0.5)}"/>`;}).join('');
    const frets=Array.from({length:9},(_,i)=>`M-3,${n2(o.nut+(o.joint+6-o.nut)*(1-Math.pow(0.84,i+1))/(1-Math.pow(0.84,10)))}h6`).join('');
    const sx=i=>n2(-2.1+4.2*i/(n-1));
    return `<g transform="scale(${k})" stroke-width="${w(1.3)}" stroke-linejoin="round">`
      +`<path d="M-3,${o.nut}V${hy+8}Q-3,${hy} 3.5,${hy}L${n>4?8.5:10},${hy+5}L5,${o.nut}Z" fill="${maple}" stroke="${mapleS}"/>${tuners}`
      +`<path d="${o.body}" fill="${c}" stroke="${dk}"/><path d="${o.guard}" fill="#f4f4f2" stroke="#8a8a8a" stroke-width="${w(0.8)}"/>`
      +`<rect x="-3" y="${o.nut}" width="6" height="${o.joint+8-o.nut}" fill="${rose}" stroke="#1d140c" stroke-width="${w(0.8)}"/><path d="${frets}" stroke="#cfd4d8" stroke-width="${w(0.7)}" fill="none"/><path d="M-3,${o.nut}h6" stroke="#f1ede0" stroke-width="${w(1.4)}" fill="none"/>`
      +o.pickups.map(([y,t,dx])=>`<rect x="${n2(-5.5+(dx||0))}" y="${y}" width="${dx?5.6:11}" height="3.6" rx="1.2" fill="#161616" stroke="#000" stroke-width="${w(0.5)}" transform="rotate(${t||0} 0 ${y+1.8})"/>`).join('')
      +`<rect x="-6" y="${o.bridge}" width="12" height="4.4" rx="1" ${metal} stroke-width="${w(0.6)}"/>`
      +o.knobs.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2" ${metal} stroke-width="${w(0.6)}"/>`).join('')
      +`<path d="${Array.from({length:n},(_,i)=>`M${sx(i)},${o.nut}V${o.bridge+2}`).join('')}" stroke="#e8e2d0" stroke-width="${w(n>4?0.45:0.7)}" fill="none"/></g>`; };
  const hat=(id,label,noun)=>({label:label+' (in hand)',noun,phrase:`${/^[aeiou]/.test(noun)?'an':'a'} ${noun}`,verb:'holding',get col(){return HEADWEAR[id].col;},
    draw:(s,c)=>`<g transform="translate(${-s*24} 31)">${headwearSVG(id,false,c)}</g>`});
  /* a furled umbrella lies along the hand: hooked handle in the fist, folded canopy beyond it */
  /* a furled umbrella lies along the hand: hooked handle in the fist, folded canopy beyond it */
  const furled=(k,c,s)=>{const L=n2(96*k); return `<path d="M0,${L}V${n2(L+9)}" stroke="#5b4636" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M0,12V-8Q0,-17 ${-s*7},-17Q${-s*13},-17 ${-s*13},-10" fill="none" stroke="#5b4636" stroke-width="3.4" stroke-linecap="round"/><path d="M0,10Q${n2(5+2*k)},22 ${n2(4+k)},${n2(L-12)}L0,${L}L${n2(-4-k)},${n2(L-12)}Q${n2(-5-2*k)},22 0,10Z" ${F(c)}/><path d="M0,12V${n2(L-2)}M${n2(2+k)},24L${n2(1.5+k*0.5)},${n2(L-10)}M${n2(-2-k)},24L${n2(-1.5-k*0.5)},${n2(L-10)}" stroke="${edge(c)}" stroke-width=".8" fill="none"/><path d="M${n2(-5-2*k)},30H${n2(5+2*k)}" stroke="${edge(c)}" stroke-width="2.2" fill="none"/>`;};
  /* open: the canopy top sits 96k above the grip (the furled length), with the same bare tip above it and the same hooked handle below */
  const canopy=(k,c)=>`<path d="M0,${n2(-96*k-9)}V${n2(-96*k)}" stroke="#5b4636" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M0,${n2(-96*k)}V8Q0,17 7,17Q13,17 13,10" fill="none" stroke="#5b4636" stroke-width="3" stroke-linecap="round"/><path transform="translate(0 ${n2(40*k)}) scale(${k})" d="M-64,-92Q-60,-132 0,-136Q60,-132 64,-92Q48,-101 32,-92Q16,-101 0,-92Q-16,-101 -32,-92Q-48,-101 -64,-92Z" ${F(c)} stroke-width="${n2(1.3/k)}"/>`;
  return {
  /* tools */
  wrench:{label:'Wrench',noun:'wrench',plural:'wrenches',phrase:'a wrench',verb:'holding',col:'#999999',draw:(s,c)=>
    `<path d="M-3,-8L3,-8L3,33C9,35 10,42 8,48L4,47L4,40L-4,40L-4,47L-8,48C-10,42 -9,35 -3,33Z" ${F(c)}/>`},
  hammer:{label:'Hammer',noun:'hammer',phrase:'a hammer',verb:'holding',col:'#666666',draw:(s,c)=>
    handle(2.2,36,wood)+`<path d="M-11,29H7Q10,29 10,32V37Q10,40 7,40H-11Z" ${F(c)}/>`},
  screwdriver:{label:'Screwdriver',noun:'screwdriver',phrase:'a screwdriver',verb:'holding',col:'#CC0000',draw:(s,c)=>
    `<path d="M-1.2,12V40L-2,44H2L1.2,40V12Z" ${metal}/><rect x="-4.6" y="-10" width="9.2" height="24" rx="3.5" ${F(c)}/>`},
  pliers:{label:'Pliers',phrase:'a pair of pliers',plural:'pairs of pliers',verb:'holding',col:'#CC0000',draw:(s,c)=>
    [-1,1].map(k=>`<path d="M${k},13L${k*6.5},-12Q${k*5},-14 ${k*3.2},-12L${-k*1.5},13Z" ${F(c)}/><path d="M${-k*3.2},13L${-k*4},31L${-k*0.4},35L${k*0.6},15Z" ${metal}/>`).join('')+`<circle cx="0" cy="14" r="2.6" ${metal}/>`},
  paintbrush:{label:'Paintbrush',noun:'paintbrush',plural:'paintbrushes',phrase:'a paintbrush',verb:'holding',col:'#0066CC',draw:(s,c)=>
    handle(2.2,25,wood)+`<rect x="-3.6" y="24" width="7.2" height="7" ${metal}/><path d="M-3.6,31Q-4.8,39 0,47Q4.8,39 3.6,31Z" ${F(c)}/>`},
  flashlight:{label:'Flashlight',noun:'flashlight',phrase:'a flashlight',verb:'holding',col:'#333333',draw:(s,c)=>
    `<path d="M-8.5,33L-24,74H24L8.5,33Z" fill="#FFFF99" fill-opacity=".4" stroke="none"/><rect x="-4.2" y="-10" width="8.4" height="33" rx="2" ${F(c)}/><path d="M-4.2,22H4.2L8.5,29V33H-8.5V29Z" ${F(c)}/><path d="M-8.5,33H8.5" stroke="#FFCC00" stroke-width="2" fill="none"/>`},
  solderingiron:{label:'Soldering iron',noun:'soldering iron',phrase:'a soldering iron',verb:'holding',col:'#0066CC',draw:(s,c)=>
    `<path d="M0,-11Q${-s*10},-26 ${-s*4},-38T${-s*12},-58" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/><rect x="-1.8" y="18" width="3.6" height="26" ${metal}/><path d="M-1.8,44H1.8L0,54Z" ${metal}/><rect x="-4" y="16" width="8" height="5" rx="1" fill="#222" stroke="#000" stroke-width=".8"/><rect x="-4.4" y="-11" width="8.8" height="28" rx="3.6" ${F(c)}/>`},
  toolbox:{label:'Toolbox',noun:'toolbox',plural:'toolboxes',phrase:'a toolbox',verb:'carrying',upright:true,col:'#CC0000',draw:(s,c)=>
    `<path d="M-18,14V4Q-18,0 -14,0H14Q18,0 18,4V14" fill="none" stroke="#111" stroke-width="5.4"/><path d="M-18,14V4Q-18,0 -14,0H14Q18,0 18,4V14" fill="none" stroke="#444" stroke-width="3"/><path d="M-40,26L-34,12H34L40,26Z" ${F(shade(c,-0.18))}/><rect x="-42" y="26" width="84" height="34" rx="3" ${F(c)}/><path d="M-42,34H42" stroke="${edge(c)}" fill="none"/><rect x="-28" y="27" width="9" height="10" rx="1.5" ${metal}/><rect x="19" y="27" width="9" height="10" rx="1.5" ${metal}/>`},
  /* kitchen */
  fork:{label:'Fork',noun:'fork',phrase:'a fork',verb:'holding',col:'#CCCCCC',draw:(s,c)=>
    handle(1.7,30,F(c))+`<path d="M-4.6,29H4.6V46H3V35H0.8V46H-0.8V35H-3V46H-4.6Z" ${F(c)}/>`},
  knife:{label:'Butter knife',noun:'butter knife',plural:'butter knives',phrase:'a butter knife',verb:'holding',col:'#CCCCCC',draw:(s,c)=>
    handle(2.1,20,F(c))+`<path d="M-2.1,19V44Q-2,50 2.6,48Q5.2,40 4.2,19Z" ${F(c)}/>`},
  spoon:{label:'Spoon',noun:'spoon',phrase:'a spoon',verb:'holding',col:'#CCCCCC',draw:(s,c)=>
    handle(1.7,34,F(c))+`<ellipse cx="0" cy="41" rx="5.2" ry="7.2" ${F(c)}/>`},
  pan:{label:'Frying pan',noun:'frying pan',phrase:'a frying pan',verb:'holding',col:'#333333',draw:(s,c)=>
    handle(2.4,28,F(shade(c,-0.2)))+`<circle cx="0" cy="45" r="18" ${F(c)}/><circle cx="0" cy="45" r="14" fill="${shade(c,0.18)}" stroke="none"/>`},
  cup:{label:'Cup',noun:'cup',phrase:'a cup',verb:'holding',upright:true,col:'#FFFFFF',draw:(s,c)=>
    `<g transform="translate(${-s*12},-4)"><path d="M${s*8},-6Q${s*17},-6 ${s*17},2Q${s*17},9 ${s*8},9" fill="none" stroke="${edge(c)}" stroke-width="3.2"/><path d="M-10,-12H10L8,11Q8,13 6,13H-6Q-8,13 -8,11Z" ${F(c)}/></g>`},
  mug:{label:'Mug',noun:'mug',phrase:'a mug',verb:'holding',upright:true,col:'#CC0000',draw:(s,c)=>
    `<g transform="translate(${-s*12},-4)">${steam(0,-20)}<path d="M${s*8},-9Q${s*18},-9 ${s*18},-1Q${s*18},7 ${s*8},7" fill="none" stroke="${edge(c)}" stroke-width="5"/><path d="M${s*8},-9Q${s*18},-9 ${s*18},-1Q${s*18},7 ${s*8},7" fill="none" stroke="${c}" stroke-width="3"/><path d="M-9,-16H9V10Q9,13 6,13H-6Q-9,13 -9,10Z" ${F(c)}/></g>`},
  bowl:{label:'Bowl',noun:'bowl',phrase:'a bowl',verb:'holding',upright:true,col:'#0066CC',draw:(s,c)=>
    `<g transform="translate(${-s*14},-2)">${steam(0,-12)}<path d="M-17,-6H17Q17,12 0,13Q-17,12 -17,-6Z" ${F(c)}/><ellipse cx="0" cy="-6" rx="17" ry="4" fill="#f4d58a" stroke="${edge(c)}"/></g>`},
  plate:{label:'Plate of food',noun:'plate',phrase:'a plate of food',plural:'plates of food',verb:'holding',upright:true,col:'#FFFFFF',draw:(s,c)=>
    `<g transform="translate(${-s*16},0)">${steam(0,-16)}<ellipse cx="0" cy="2" rx="23" ry="5.5" ${F(c)}/><path d="M-13,1Q-12,-11 0,-12Q12,-11 13,1Z" fill="#CC6600" stroke="#7a3d00"/><circle cx="6" cy="-6" r="3.4" fill="#00CC66" stroke="#007a3d" stroke-width=".8"/><circle cx="-6" cy="-4" r="2.6" fill="#CC0000" stroke="#7a0000" stroke-width=".8"/></g>`},
  cake:{label:'Cake',noun:'cake',phrase:'a cake',verb:'carrying',upright:true,col:'#FF66CC',draw:(s,c)=>
    `<g transform="translate(${-s*20},-2)"><ellipse cx="0" cy="2" rx="27" ry="5" fill="#FFFFFF" stroke="#999"/>`+[-11,0,11].map(x=>`<rect x="${x-1.6}" y="-40" width="3.2" height="13" fill="#0066CC" stroke="none"/><ellipse cx="${x}" cy="-44" rx="2.6" ry="4.4" fill="#FFCC00" stroke="none"/>`).join('')+`<rect x="-22" y="-28" width="44" height="29" rx="5" ${F(shade(c,0.55))}/><path d="M-22,-18q5.5,7 11,0t11,0t11,0t11,0V-23Q22,-28 17,-28H-17Q-22,-28 -22,-23Z" fill="${c}" stroke="none"/></g>`},
  pizzabox:{label:'Pizza box',noun:'pizza box',plural:'pizza boxes',phrase:'a pizza box',verb:'carrying',upright:true,col:'#CC9966',draw:(s,c)=>
    `<g transform="translate(${-s*30},-1)"><rect x="-33" y="-10" width="66" height="12" rx="1.5" ${F(c)}/><path d="M-33,-5.5H33" stroke="${edge(c)}" fill="none"/><circle cx="0" cy="-5" r="3.6" fill="#CC0000" stroke="none"/></g>`},
  /* everyday */
  book:{label:'Book',noun:'book',phrase:'a book',verb:'holding',col:'#CC0000',draw:(s,c)=>
    `<rect x="-15" y="-10" width="30" height="42" rx="2" ${F(c)}/><path d="M-11,-10V32" stroke="${edge(c)}" fill="none"/><rect x="-5" y="-2" width="14" height="5" fill="#f1dcc0" stroke="none"/>`},
  phone:{label:'Phone',noun:'phone',phrase:'a phone',verb:'holding',col:'#333333',draw:(s,c)=>
    `<rect x="-8" y="-12" width="16" height="31" rx="3" ${F(c)}/><rect x="-6" y="-9" width="12" height="24" rx="1" fill="#7fb6e6" stroke="none"/>`},
  keys:{label:'Keys',phrase:'some keys',plural:'sets of keys',verb:'holding',upright:true,col:'#CC0000',draw:(s,c)=>   /* hangs straight down */
    `<circle cx="0" cy="13" r="5" fill="none" stroke="${MS}" stroke-width="1.6"/><path d="M-2.5,17.5L-6,36L-3.6,36.5L-3.4,32.5L-1.6,32.8L-1.2,29L0.6,29.2L0,18Z" fill="#d7b54a" stroke="#8c7220"/><circle cx="-1.6" cy="20.5" r="1" fill="#8c7220" stroke="none"/><rect x="2" y="17.5" width="7.5" height="14" rx="2.2" ${F(c)}/>`},
  balloon:{label:'Balloon',noun:'balloon',phrase:'a balloon',verb:'holding',upright:true,col:'#CC0000',draw:(s,c)=>   /* floats straight up */
    `<path d="M0,8Q9,-30 0,-66" fill="none" stroke="#777"/><path d="M-4,-64H4L0,-70Z" ${F(c)}/><ellipse cx="0" cy="-98" rx="24" ry="30" ${F(c)}/><ellipse cx="-8" cy="-110" rx="5" ry="8" fill="#fff" fill-opacity=".45" stroke="none"/>`},
  teddy:{label:'Teddy bear',noun:'teddy bear',phrase:'a teddy bear',verb:'holding',upright:true,col:'#CC6600',draw:(s,c)=>{   /* dangles by one paw */
    const f=F(c), l=shade(c,0.45);
    return `<g transform="translate(${s*9},4)"><path d="M${-s*7},4L${-s*10},-4" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/><ellipse cx="${s*9}" cy="22" rx="3.6" ry="6" transform="rotate(${-s*30} ${s*9} 22)" ${f}/><ellipse cx="-5.5" cy="41" rx="4.6" ry="6" ${f}/><ellipse cx="5.5" cy="41" rx="4.6" ry="6" ${f}/><ellipse cx="0" cy="28" rx="10.5" ry="12.5" ${f}/><ellipse cx="0" cy="30" rx="6" ry="7.5" fill="${l}" stroke="none"/>`
      +`<circle cx="-7" cy="3" r="3.6" ${f}/><circle cx="7" cy="3" r="3.6" ${f}/><circle cx="0" cy="10.5" r="9.5" ${f}/><ellipse cx="0" cy="13.5" rx="4.4" ry="3.4" fill="${l}" stroke="none"/><circle cx="-3.4" cy="8.5" r="1.1" fill="#111" stroke="none"/><circle cx="3.4" cy="8.5" r="1.1" fill="#111" stroke="none"/><circle cx="0" cy="12.2" r="1.3" fill="#111" stroke="none"/></g>`;}},
  box:{label:'Box',noun:'box',plural:'boxes',phrase:'a box',verb:'carrying',upright:true,col:'#CC9966',draw:(s,c)=>
    `<g transform="translate(${-s*36},-20)"><rect x="-37" y="-28" width="74" height="56" rx="2" ${F(c)}/><path d="M-37,-14H37" stroke="${edge(c)}" fill="none"/><rect x="-6" y="-28" width="12" height="20" fill="${shade(c,0.4)}" stroke="none"/></g>`},
  bag:{label:'Bag',noun:'bag',phrase:'a bag',verb:'carrying',upright:true,col:'#663300',draw:(s,c)=>
    `<path d="M-11,24Q0,-8 11,24" fill="none" stroke="${edge(c)}" stroke-width="2.6"/><path d="M-22,22H22L25,62Q25,66 21,66H-21Q-25,66 -25,62Z" ${F(c)}/>`},
  purse:{label:'Purse',noun:'purse',phrase:'a purse',verb:'carrying',upright:true,col:'#CC0066',draw:(s,c)=>   /* hangs from its strap */
    `<g transform="translate(0 -18) scale(1.4)"><path d="M-9,36Q0,-10 9,36" fill="none" stroke="${edge(c)}" stroke-width="2.2"/><path d="M-15,33H15Q18.5,33 18,37L16,53Q15.6,57 12,57H-12Q-15.6,57 -16,53L-18,37Q-18.5,33 -15,33Z" ${F(c)}/><path d="M-17.6,40Q0,50 17.6,40" fill="none" stroke="${edge(c)}"/><circle cx="0" cy="45.5" r="2.2" fill="#e2b23a" stroke="#9c7716" stroke-width=".8"/></g>`},   /* larger; the top of the strap sits in the fist */
  cane:{label:'Cane',noun:'cane',phrase:'a cane',verb:'holding',upright:true,cane:true,col:'#663300',draw:(s,c,len)=>
    `<path d="M0,0V${n2(len-3)}" stroke="${edge(c)}" stroke-width="5.6" stroke-linecap="round" fill="none"/><path d="M0,0V${n2(len-3)}" stroke="${c}" stroke-width="3.6" stroke-linecap="round" fill="none"/><path d="M0,0Q0,-9 ${-s*8},-9Q${-s*14},-9 ${-s*14},-3" fill="none" stroke="${edge(c)}" stroke-width="5.6" stroke-linecap="round"/><path d="M0,0Q0,-9 ${-s*8},-9Q${-s*14},-9 ${-s*14},-3" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/><path d="M0,${n2(len-5)}V${n2(len-1.5)}" stroke="#222" stroke-width="5" stroke-linecap="round" fill="none"/>`},
  parasol:{label:'Parasol',noun:'parasol',phrase:'a parasol',verb:'holding',upright:true,col:'#0066CC',draw:(s,c)=>canopy(1,c)},
  umbrella:{label:'Umbrella',noun:'umbrella',phrase:'an umbrella',verb:'holding',upright:true,col:'#CC0000',draw:(s,c)=>canopy(1.5,c)},
  briefcase:{label:'Briefcase',noun:'briefcase',phrase:'a briefcase',verb:'carrying',upright:true,col:'#663300',draw:(s,c)=>
    `<g transform="translate(0 -16) scale(1.35)"><path d="M-8,22V15Q-8,11 -4,11H4Q8,11 8,15V22" fill="none" stroke="${edge(c)}" stroke-width="2.6"/><rect x="-27" y="21" width="54" height="36" rx="3" ${F(c)}/><path d="M-27,33H27" stroke="${edge(c)}" fill="none"/><rect x="-4" y="30" width="8" height="6" rx="1" fill="#e2b23a" stroke="#9c7716" stroke-width=".8"/></g>`},   /* larger; the handle sits in the fist */
  suitcase:{label:'Suitcase',noun:'suitcase',phrase:'a suitcase',verb:'carrying',upright:true,col:'#006666',draw:(s,c)=>
    `<g transform="translate(0 -12) scale(1.3)"><path d="M-9,24V12Q-9,8 -5,8H5Q9,8 9,12V24" fill="none" stroke="${edge(c)}" stroke-width="2.8"/><circle cx="-16" cy="93" r="3.4" fill="#222" stroke="none"/><circle cx="16" cy="93" r="3.4" fill="#222" stroke="none"/><rect x="-25" y="23" width="50" height="68" rx="5" ${F(c)}/><path d="M-12,23V91M12,23V91" stroke="${edge(c)}" fill="none"/></g>`},   /* larger; the handle sits in the fist */
  multimeter:{label:'Multimeter',noun:'multimeter',phrase:'a multimeter',verb:'holding',col:'#FFCC00',draw:(s,c)=>
    `<path d="M-5,25Q-22,44 -10,58T-16,78" fill="none" stroke="#CC0000" stroke-width="1.3"/><path d="M5,25Q24,42 12,58T18,80" fill="none" stroke="#111" stroke-width="1.3"/><path d="M-16,76L-20,98" stroke="#CC0000" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M-20.4,100L-22,110" stroke="#8a9299" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M18,78L22,100" stroke="#222" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M22.4,102L24,112" stroke="#8a9299" stroke-width="1.6" stroke-linecap="round" fill="none"/><rect x="-11" y="-14" width="22" height="42" rx="4" ${F(c)}/><rect x="-8" y="-10" width="16" height="10" rx="1.5" fill="#cfe0c8" stroke="#555" stroke-width=".8"/><circle cx="0" cy="12" r="6.5" fill="#333" stroke="#111"/><path d="M0,12L3.5,7.5" stroke="#fff" stroke-width="1.4" fill="none"/><circle cx="-5" cy="24" r="1.6" fill="#CC0000" stroke="none"/><circle cx="5" cy="24" r="1.6" fill="#111" stroke="none"/>`},
  tablet:{label:'Tablet',noun:'tablet',phrase:'a tablet',verb:'holding',col:'#333333',draw:(s,c)=>
    `<rect x="-17" y="-16" width="34" height="48" rx="3.5" ${F(c)}/><rect x="-14" y="-13" width="28" height="40" rx="1.5" fill="#7fb6e6" stroke="none"/>`},
  /* sports */
  beachball:{label:'Beach ball',noun:'beach ball',phrase:'a beach ball',verb:'holding',col:'#CC0000',draw:(s,c)=>{   /* panels: the colour, its two triad partners, and white between */
    const h=c.slice(1), cols=[c,'#FFFFFF','#'+h.slice(2)+h.slice(0,2),'#FFFFFF','#'+h.slice(4)+h.slice(0,4),'#FFFFFF'], r=36, cy=30; let w='';
    for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2, b=a+Math.PI/3; w+=`<path d="M0,${cy}L${n2(r*Math.cos(a))},${n2(cy+r*Math.sin(a))}A${r},${r} 0 0 1 ${n2(r*Math.cos(b))},${n2(cy+r*Math.sin(b))}Z" fill="${cols[i]}" stroke="none"/>`;}
    return w+`<circle cx="0" cy="${cy}" r="${r}" fill="none" stroke="${edge(c)}"/><circle cx="0" cy="${cy}" r="5" fill="#FFFFFF" stroke="${edge(c)}" stroke-width=".8"/>`;}},
  soccerball:{label:'Soccer ball',noun:'soccer ball',phrase:'a soccer ball',verb:'holding',col:'#FFFFFF',draw:(s,c)=>
    `<circle cx="0" cy="22" r="25" ${F(c)}/><path d="M0,13L8.5,19.2L5.3,29.2H-5.3L-8.5,19.2Z" fill="#222" stroke="none"/><path d="M0,13V-3M8.5,19.2L23,14M5.3,29.2L14,42M-5.3,29.2L-14,42M-8.5,19.2L-23,14" stroke="#222" fill="none"/><path d="M-7,-2L0,-3L7,-2L4,-1H-4ZM21,9L23,14L24,22L20,17ZM17,40L14,42L7,46L11,41ZM-17,40L-14,42L-7,46L-11,41ZM-21,9L-23,14L-24,22L-20,17Z" fill="#222" stroke="none"/>`},
  basketball:{label:'Basketball',noun:'basketball',phrase:'a basketball',verb:'holding',col:'#FF6600',draw:(s,c)=>
    `<circle cx="0" cy="24" r="27" ${F(c)}/><path d="M-27,24H27M0,-3V51M-19,5Q-6,24 -19,43M19,5Q6,24 19,43" stroke="#222" stroke-width="1.4" fill="none"/>`},
  volleyball:{label:'Volleyball',noun:'volleyball',phrase:'a volleyball',verb:'holding',col:'#FFFFFF',draw:(s,c)=>
    `<circle cx="0" cy="21" r="24" ${F(c)}/><path d="M0,21Q-4,6 6,-2M0,21Q16,22 22,12M0,21Q-12,32 -10,43M-7,-1Q-18,12 -23,16M24,20Q14,36 4,44M-22,30Q-10,24 -3,10" stroke="#5f6870" fill="none"/>`},
  football:{label:'American football',noun:'football',phrase:'a football',verb:'holding',col:'#663300',draw:(s,c)=>
    `<path d="M0,-8Q20,8 20,24Q20,40 0,56Q-20,40 -20,24Q-20,8 0,-8Z" ${F(c)}/><path d="M0,10V38M-4,14H4M-4,20H4M-4,26H4M-4,32H4" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M-12,2Q0,8 12,2M-12,46Q0,40 12,46" stroke="#fff" stroke-width="2" fill="none"/>`},
  tennisball:{label:'Tennis ball',noun:'tennis ball',phrase:'a tennis ball',verb:'holding',col:'#CCFF00',draw:(s,c)=>
    `<circle cx="0" cy="11" r="8.6" ${F(c)}/><path d="M-7,5Q-1,11 -7,17M7,5Q1,11 7,17" stroke="#fff" stroke-width="1.4" fill="none"/>`},
  baseball:{label:'Baseball',noun:'baseball',phrase:'a baseball',verb:'holding',col:'#FFFFFF',draw:(s,c)=>
    `<circle cx="0" cy="11" r="9.4" ${F(c)}/><path d="M-7.6,5Q-1.5,11 -7.6,17M7.6,5Q1.5,11 7.6,17" stroke="#CC0000" stroke-width="1.2" stroke-dasharray="1.6 1.4" fill="none"/>`},
  tennisracket:{label:'Tennis racket',behindArms:true,noun:'tennis racket',phrase:'a tennis racket',verb:'holding',col:'#CC0000',draw:(s,c)=>
    `<rect x="-2.8" y="-10" width="5.6" height="34" rx="2" fill="#222" stroke="#000"/><path d="M-2,24L-9,46M2,24L9,46" stroke="${edge(c)}" stroke-width="4.6" fill="none"/><path d="M-2,24L-9,46M2,24L9,46" stroke="${c}" stroke-width="2.8" fill="none"/><ellipse cx="0" cy="70" rx="19" ry="27" fill="#fff" fill-opacity=".25" stroke="none"/><path d="M-12,48V92M-6,44V96M0,43V97M6,44V96M12,48V92M-18,60H18M-19,70H19M-18,80H18M-14,52H14M-14,88H14" stroke="#5f6870" stroke-opacity=".45" stroke-width=".8" fill="none"/><ellipse cx="0" cy="70" rx="19" ry="27" fill="none" stroke="${edge(c)}" stroke-width="5.4"/><ellipse cx="0" cy="70" rx="19" ry="27" fill="none" stroke="${c}" stroke-width="3.4"/>`},
  baseballbat:{label:'Baseball bat',behindArms:true,noun:'baseball bat',phrase:'a baseball bat',verb:'holding',col:'#CC9966',draw:(s,c)=>
    `<g transform="translate(0 -30) scale(1 1.25)"><path d="M-2.2,-9H2.2L6.4,84Q6.6,100 0,100Q-6.6,100 -6.4,84Z" ${F(c)}/><ellipse cx="0" cy="-10" rx="4" ry="2.6" ${F(c)}/></g>`},   /* 25% longer; held 1.5 hand lengths up from the knob */
  mitt:{label:'Baseball mitt',noun:'baseball mitt',phrase:'a baseball mitt',verb:'holding',col:'#663300',draw:(s,c)=>
    `<path d="M-13,2Q-19,-12 -11,-16Q-6,-17 -5,-9Q-3,-22 3,-21Q8,-20 7,-9Q11,-18 15,-14Q19,-9 15,4Q22,10 18,22Q12,34 -2,33Q-16,31 -17,16Q-18,8 -13,2Z" ${F(c)}/><path d="M-5,-9V2M7,-9V1M15,4Q8,10 -2,9Q-10,8 -13,2" stroke="${edge(c)}" fill="none"/>`},
  /* cleaning — long handles run through the fist; no floor rule */
  broom:{label:'Broom',behindArms:true,noun:'broom',phrase:'a broom',verb:'holding',col:'#FFCC00',draw:(s,c)=>
    `<g transform="scale(1 1.25)"><rect x="-2.4" y="-70" width="4.8" height="162" rx="2" ${wood}/><path d="M-9,90H9L17,128H-17Z" ${F(c)}/><path d="M-9,96H9" stroke="#CC0000" stroke-width="3" fill="none"/><path d="M-9,104L-11,127M-3,104L-4,127M3,104L4,127M9,104L11,127" stroke="${edge(c)}" stroke-width=".8" fill="none"/></g>`},
  mop:{label:'Mop',behindArms:true,noun:'mop',phrase:'a mop',verb:'holding',col:'#CCCCCC',draw:(s,c)=>
    `<g transform="scale(1 1.25)"><rect x="-2.4" y="-70" width="4.8" height="166" rx="2" ${wood}/><path d="M-12,94H12Q20,106 18,124Q14,132 10,124Q8,132 4,125Q0,133 -4,125Q-8,132 -10,124Q-14,132 -18,124Q-20,106 -12,94Z" ${F(c)}/><path d="M-6,100V122M0,100V124M6,100V122" stroke="${edge(c)}" stroke-width=".8" fill="none"/><rect x="-12" y="90" width="24" height="6" rx="2" fill="#0066CC" stroke="#003d7a"/></g>`},
  duster:{label:'Duster',noun:'duster',phrase:'a duster',verb:'holding',col:'#FF66CC',draw:(s,c)=>
    `<rect x="-2" y="-9" width="4" height="34" rx="2" ${wood}/>`+[[0,60,9,14],[-8,50,8,13],[8,50,8,13],[-5,38,8,12],[5,38,8,12],[0,28,7,9]].map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${F(c)}/>`).join('')},
  /* music — guitar, bass and violin lie across the hand (neck in the fist, body pointing away from the player's centre when the arm hangs); the rest lie along it */
  microphone:{label:'Microphone',noun:'microphone',phrase:'a microphone',verb:'holding',col:'#333333',draw:(s,c)=>
    `<g><path d="M-2.4,-8H2.4L3.4,19H-3.4Z" ${F(c)}/><circle cx="0" cy="24" r="6.8" ${metal}/><path d="M-6.4,22H6.4M-6.4,26H6.4M-3,18V30M3,18V30" stroke="${MS}" stroke-width=".7" fill="none"/></g>`},   /* across the hand; the head points away from the body's centre when the arm hangs */
  micstand:{label:'Microphone stand',across:true,noun:'microphone stand',phrase:'a microphone stand',verb:'holding',upright:true,cane:true,col:'#333333',draw:(s,c,len)=>   /* same floor rule as the cane */
    `<path d="M0,-48V${n2(len-2)}" stroke="${edge(c)}" stroke-width="4.6" stroke-linecap="round" fill="none"/><path d="M0,-48V${n2(len-2)}" stroke="${c}" stroke-width="2.8" stroke-linecap="round" fill="none"/><path d="M-20,${n2(len-1.5)}L0,${n2(len-12)}L20,${n2(len-1.5)}" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    +`<g transform="translate(0 -48) rotate(${-s*35})"><path d="M-2.4,4H2.4L3.2,-14H-3.2Z" fill="#333" stroke="#111"/><circle cx="0" cy="-19" r="6.6" ${metal}/></g>`},
  guitar:{label:'Guitar',grip:90,behindArms:true,noun:'guitar',phrase:'a guitar',verb:'holding',col:'#CC6600',draw:(s,c)=>
    `<g transform="scale(1.3)" stroke-width="1"><path d="M-5,-48H5L4,-34H-4Z" fill="#3a2a1c" stroke="#1d140c"/><rect x="-3" y="-35" width="6" height="84" fill="#5a3d22" stroke="#2e1e0f"/><g transform="translate(0 44) scale(1.25) translate(0 -44)"><path d="M0,44C-18,42 -19,58 -15,66C-26,72 -26,106 0,107C26,106 26,72 15,66C19,58 18,42 0,44Z" ${F(c)}/><circle cx="0" cy="68" r="6.5" fill="#2a1a0e" stroke="none"/><rect x="-8" y="88" width="16" height="4" fill="#3a2a1c" stroke="none"/></g><path d="M-1.6,-34V101M1.6,-34V101" stroke="#e8e2d0" stroke-width=".6" fill="none"/></g>`},
  electricguitar:{label:'Electric guitar',behindArms:true,grip:90,noun:'electric guitar',phrase:'an electric guitar',verb:'holding',col:'#0066CC',draw:(s,c)=>solid(c,{k:1.25,nut:-36,joint:39,head:22,strings:6,
    body:'M-5,38C-8,30 -16,25 -19,29C-23,35 -20,46 -18,52C-16,60 -24,66 -24,78C-24,92 -12,98 0,98C12,98 24,92 24,78C24,66 17,60 18,52C20,44 20,38 16,34C12,31 8,34 5,40Z',
    guard:'M-4,44L9,43Q16,51 15,62Q14,75 4,83Q-7,85 -11,74Q-13,59 -4,44Z',pickups:[[52,0],[62,0],[72,-8]],bridge:80,knobs:[[11,77],[14,84],[9,89]]})},
  bass:{label:'Bass guitar',behindArms:true,grip:90,noun:'bass guitar',phrase:'a bass guitar',verb:'holding',col:'#CC0000',draw:(s,c)=>solid(c,{k:1.2,nut:-48,joint:52,head:26,strings:4,
    body:'M-5,50C-8,40 -17,29 -22,33C-27,39 -23,52 -20,60C-18,68 -26,74 -26,88C-26,104 -13,112 0,112C13,112 26,104 26,88C26,74 18,68 19,60C21,52 21,46 17,42C13,39 8,44 5,52Z',
    guard:'M-4,57L8,56Q16,63 15,75Q13,87 3,91Q-8,91 -11,81Q-13,67 -4,57Z',pickups:[[74,0,-3],[78,0,3]],bridge:99,knobs:[[10,92],[13,99]]})},
  violin:{label:'Violin',behindArms:true,grip:90,noun:'violin',phrase:'a violin',verb:'holding',col:'#CC6600',draw:(s,c)=>viol(c,1,{chin:1})},
  viola:{label:'Viola',behindArms:true,grip:90,noun:'viola',phrase:'a viola',verb:'holding',col:'#CC6600',draw:(s,c)=>viol(c,1.18,{chin:1})},
  cello:{label:'Cello',behindArms:true,grip:180,noun:'cello',phrase:'a cello',verb:'holding',col:'#CC6600',draw:(s,c)=>viol(c,3.6,{pin:12})},          /* default grip 180°: raise the hand to the neck and the body hangs down to its end pin */
  doublebass:{label:'Double bass',behindArms:true,grip:180,noun:'double bass',plural:'double basses',phrase:'a double bass',verb:'holding',col:'#663300',draw:(s,c)=>viol(c,5.4,{pin:3,bass:1})},
  bongos:{label:'Bongos',phrase:'bongos',plural:'pairs of bongos',verb:'holding',upright:true,col:'#CC6600',draw:(s,c)=>   /* two small drums joined side by side, held across the body */
    `<g transform="translate(${-s*30},-4)"><rect x="-4" y="-4" width="8" height="12" fill="#3a2a1c" stroke="#1d140c"/><path d="M-26,-12H-4L-6,16H-24Z" ${F(c)}/><path d="M3,-13H29L27,18H5Z" ${F(c)}/><ellipse cx="-15" cy="-12" rx="11.5" ry="3" fill="#f3ead8" stroke="${MS}"/><ellipse cx="16" cy="-13" rx="13.5" ry="3.4" fill="#f3ead8" stroke="${MS}"/><path d="M-25,-7H-5M4,-8H28" stroke="${MS}" stroke-width="1.6" fill="none"/></g>`},
  violinbow:{label:'Violin bow',noun:'violin bow',phrase:'a violin bow',verb:'holding',col:'#663300',draw:(s,c)=>
    `<path d="M${s*3.4},-6V110" stroke="#f1ede0" stroke-width="1.6" fill="none"/><path d="M0,-10V112Q0,116 ${s*3.4},112" stroke="${edge(c)}" stroke-width="3.2" stroke-linecap="round" fill="none"/><path d="M0,-10V112Q0,116 ${s*3.4},112" stroke="${c}" stroke-width="1.8" stroke-linecap="round" fill="none"/><rect x="${s>0?0:-5}" y="-8" width="5" height="9" rx="1" fill="#222" stroke="#000" stroke-width=".8"/>`},
  mandolin:{label:'Mandolin',grip:90,behindArms:true,noun:'mandolin',phrase:'a mandolin',verb:'holding',col:'#CC9966',draw:(s,c)=>
    `<g><path d="M-4.5,-34H4.5L3.5,-22H-3.5Z" fill="#3a2a1c" stroke="#1d140c"/><rect x="-2.6" y="-23" width="5.2" height="54" fill="#5a3d22" stroke="#2e1e0f"/><path d="M0,26C-9,28 -20,40 -20,54C-20,68 -10,76 0,76C10,76 20,68 20,54C20,40 9,28 0,26Z" ${F(c)}/><ellipse cx="0" cy="48" rx="5.5" ry="4" fill="#2a1a0e" stroke="none"/><rect x="-6" y="63" width="12" height="3" fill="#3a2a1c" stroke="none"/><path d="M-1.3,-22V65M1.3,-22V65" stroke="#e8e2d0" stroke-width=".6" fill="none"/></g>`},
  accordion:{label:'Piano accordion',noun:'accordion',phrase:'an accordion',verb:'holding',upright:true,col:'#CC0000',draw:(s,c)=>   /* sits across the body, like the box */
    `<g transform="translate(${-s*34},-8)"><path d="M-14,-24H14V24H-14Z" fill="#e9e4d6" stroke="#6b6557"/><path d="M-9,-24V24M-4.5,-24V24M0,-24V24M4.5,-24V24M9,-24V24" stroke="#6b6557" fill="none"/><rect x="-36" y="-27" width="22" height="54" rx="3" ${F(c)}/><rect x="14" y="-27" width="22" height="54" rx="3" ${F(c)}/><rect x="-32" y="-22" width="7" height="44" fill="#fff" stroke="#333" stroke-width=".8"/><path d="M-32,-15H-25M-32,-8H-25M-32,-1H-25M-32,6H-25M-32,13H-25" stroke="#333" stroke-width=".8" fill="none"/>`
    +[-14,-4,6,16].map(y=>[20,26,32].map(x=>`<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" stroke="#333" stroke-width=".6"/>`).join('')).join('')+'</g>'},
  concertina:{label:'Concertina',noun:'concertina',phrase:'a concertina',verb:'holding',upright:true,col:'#663300',draw:(s,c)=>{   /* two six-sided ends, bellows between, buttons in a 2-3-2 honeycomb */
    const end=x=>`<path d="M${x-13},-12L${x-7},-24H${x+7}L${x+13},-12V12L${x+7},24H${x-7}L${x-13},12Z" ${F(c)}/>`
      +[[-4,-9],[4,-9],[-8,0],[0,0],[8,0],[-4,9],[4,9]].map(([dx,dy])=>`<circle cx="${x+dx}" cy="${dy}" r="2.5" fill="#fff" stroke="#333" stroke-width=".6"/>`).join('');
    return `<g transform="translate(${-s*30},-6)"><path d="M-13,-20H13V20H-13Z" fill="#e9e4d6" stroke="#6b6557"/><path d="M-8.7,-20V20M-4.3,-20V20M0,-20V20M4.3,-20V20M8.7,-20V20" stroke="#6b6557" fill="none"/>${end(-26)}${end(26)}</g>`;}},
  trumpet:{label:'Trumpet',behindArms:true,noun:'trumpet',phrase:'a trumpet',verb:'holding',col:'#FFCC00',draw:(s,c)=>
    `<path d="M-2,-24H2V38L11,54H-11L-2,38Z" ${F(c)}/><ellipse cx="0" cy="54" rx="11" ry="2.6" ${F(shade(c,-0.2))}/>`+[2,9,16].map(y=>`<rect x="${s>0?-9:3}" y="${y}" width="6" height="5" rx="1.2" ${F(c)}/>`).join('')+`<rect x="-2.6" y="-28" width="5.2" height="5" rx="1.5" ${F(c)}/>`},
  flute:{label:'Flute',behindArms:true,noun:'flute',phrase:'a flute',verb:'holding',col:'#CCCCCC',draw:(s,c)=>
    `<rect x="-2" y="-34" width="4" height="88" rx="2" ${F(c)}/>`+[-18,2,12,22,32,42].map(y=>`<circle cx="0" cy="${y}" r="1.3" fill="${edge(c)}" stroke="none"/>`).join('')},
  tambourine:{label:'Tambourine',noun:'tambourine',phrase:'a tambourine',verb:'holding',col:'#CC6600',draw:(s,c)=>
    `<circle cx="0" cy="20" r="17" fill="#f3ead8" stroke="${edge(c)}"/><circle cx="0" cy="20" r="17" fill="none" stroke="${c}" stroke-width="5"/>`+[30,90,150,210,270,330].map(a=>{const r=a*Math.PI/180; return `<circle cx="${n2(17*Math.cos(r))}" cy="${n2(20+17*Math.sin(r))}" r="2.6" ${metal}/>`;}).join('')},
  maraca:{label:'Maraca',noun:'maraca',phrase:'a maraca',verb:'holding',col:'#CC0000',draw:(s,c)=>
    handle(2,20,wood)+`<ellipse cx="0" cy="31" rx="9.5" ry="12.5" ${F(c)}/><path d="M-9,27Q0,31 9,27M-9,34Q0,38 9,34" stroke="#FFCC00" stroke-width="1.6" fill="none"/>`},
  drumstick:{label:'Drumstick',noun:'drumstick',phrase:'a drumstick',verb:'holding',col:'#CC9966',draw:(s,c)=>
    `<path d="M0,-10V48" stroke="${edge(c)}" stroke-width="4.4" stroke-linecap="round" fill="none"/><path d="M0,-10V48" stroke="${c}" stroke-width="2.8" stroke-linecap="round" fill="none"/><ellipse cx="0" cy="49" rx="2.6" ry="3.6" ${F(c)}/>`},
  parasolclosed:{label:'Parasol (closed)',behindArms:true,noun:'parasol',phrase:'a parasol',verb:'holding',col:'#0066CC',draw:(s,c)=>furled(1,c,s)},
  umbrellaclosed:{label:'Umbrella (closed)',behindArms:true,noun:'umbrella',phrase:'an umbrella',verb:'holding',col:'#CC0000',draw:(s,c)=>furled(1.5,c,s)},
  boombox:{label:'Boombox',noun:'boombox',plural:'boomboxes',phrase:'a boombox',verb:'carrying',upright:true,col:'#333333',draw:(s,c)=>
    `<path d="M-30,16V4Q-30,0 -26,0H26Q30,0 30,4V16" fill="none" stroke="${edge(c)}" stroke-width="5"/><path d="M-30,16V4Q-30,0 -26,0H26Q30,0 30,4V16" fill="none" stroke="#b4bcc4" stroke-width="2.6"/><path d="M34,14L52,-22" stroke="#b4bcc4" stroke-width="1.6" stroke-linecap="round" fill="none"/><rect x="-52" y="14" width="104" height="56" rx="6" ${F(c)}/>`
    +[-30,30].map(x=>`<circle cx="${x}" cy="46" r="17" fill="#1b1b1b" stroke="#b4bcc4" stroke-width="1.6"/><circle cx="${x}" cy="46" r="7" fill="#b4bcc4" stroke="#5f6870"/>`).join('')
    +`<rect x="-11" y="30" width="22" height="16" rx="2" fill="#cfd6dc" stroke="#5f6870"/><circle cx="-5" cy="38" r="3" fill="#333" stroke="none"/><circle cx="5" cy="38" r="3" fill="#333" stroke="none"/><path d="M-9,54H9M-9,60H9" stroke="#b4bcc4" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M-46,20H46" stroke="#b4bcc4" stroke-width="1.6" fill="none"/>`},
  /* hats, carried rather than worn */
  hat_cap:hat('cap','Cap','cap'), hat_beanie:hat('beanie','Beanie','beanie'), hat_sunhat:hat('sunhat','Sun hat','sun hat'),
  hat_hardhat:hat('hardhat','Hard hat','hard hat'), hat_fedora:hat('fedora','Fedora','fedora')
  };
})();

/* ── hair. Head-centre coordinates, skull spans x ±29, y −36…35.
      view 'front' or 'side' (side = facing left; the caller mirrors it). ── */
function hair(style,view,col,hat){
  const st=shade(col,-0.3), A=`fill="${col}" stroke="${st}"`, B=`fill="${col}" stroke="none"`;
  const p=(d,a)=>`<path d="${d}" ${a||A}/>`;
  let back='',front=''; const hang=[];   /* hang = pieces that always fall straight down, each pinned at its own point on the head */
  const H=(inFront,x,y,svg)=>hang.push({front:inFront,x,y,svg:`<g transform="translate(${-x} ${-y})">${svg}</g>`});
  const hangP=(fillD,strokeD)=>`<path d="${fillD}" fill="${col}" stroke="none"/><path d="${strokeD}" fill="none" stroke="${st}"/>`;
  if(style==='bald') return {back,front,hang};
  if(hat&&(style==='afro'||style==='curly'||style==='bun'||style==='pompadour')){
    /* under a hat: nothing above the brim, the volume moves to the sides and nape */
    const F=view==='front', cx=F?0:5;
    const capF='M-30,2C-30,-28 -18,-37 0,-37C18,-37 30,-28 30,2L27.5,2C27,-12 14,-24 0,-24C-14,-24 -27,-12 -27.5,2Z';
    const capS='M-26,-20C-26,-36 -12,-39 2,-39C22,-39 33,-24 32,-2C32,10 28,18 24,24L14,14C16,6 15,-4 12,-8L2,-9L1,3L-4,3C-5,-10 -12,-20 -26,-20Z';
    front=p(F?capF:capS,style==='bun'||style==='pompadour'?A:B);
    if(style==='afro') back=`<g ${A}><path d="M${cx-42.5},-16A43,43 0 0 0 ${cx+42.5},-16Z"/>${ring(cx,-10,43,43,-6,186,9,9.5)}</g>`;
    if(style==='curly') front+=`<g ${A}>`+(F?[[-29,-7],[-29,5],[29,-7],[29,5]]:[[31,-8],[30,5],[25,17]]).map(([x,y])=>`<circle cx="${x}" cy="${y}" r="8"/>`).join('')+'</g>';
    if(style==='bun') back=F?`<circle cx="0" cy="27" r="13" ${A}/>`:`<circle cx="31" cy="17" r="11.5" ${A}/>`;
    return {back,front,hang};
  }
  if(view==='front'){
    const capF=(rx,ry,y0,line)=>`M${-rx},${y0}C${-rx},${-ry*0.75} ${-rx*0.6},${-ry} 0,${-ry}C${rx*0.6},${-ry} ${rx},${-ry*0.75} ${rx},${y0}${line}Z`;
    const round='L27.5,4C27,-12 14,-24 0,-24C-14,-24 -27,-12 -27.5,4';
    const curls=()=>`<g ${A}>${ring(0,-4,27,31,185,355,9,9.5)}${ring(0,-24,17,3,180,360,5,7.5)}</g>`;
    switch(style){
      case 'crew': front=p(capF(30,37.5,-2,'L27.5,-2C27,-14 14,-25 0,-25C-14,-25 -27,-14 -27.5,-2')); break;
      case 'pompadour': front=p(capF(31,39,4,round))+p('M-23,-21C-28,-44 -13,-55 2,-53C17,-52 27,-42 23,-23C12,-30 -8,-30 -23,-21Z'); break;
      case 'pigtails': front=p(capF(31.5,39,6,'L27,6C27,-10 16,-22 0,-29C-16,-22 -27,-10 -27,6'));
        /* behind the head, pinned high behind each ear, as long as the long style */
        [1,-1].forEach(k=>H(false,k*29,-8,`<circle cx="${k*29}" cy="-8" r="6" ${A}/>`+p(`M${k*26},-11C${k*42},-11 ${k*45},40 ${k*40},74Q${k*35},79 ${k*32},72C${k*35},44 ${k*33},8 ${k*25},-2Z`))); break;
      case 'buzz': front=`<path d="${capF(29.4,36.4,0,'L27.5,0C27,-14 14,-26 0,-26C-14,-26 -27,-14 -27.5,0')}" fill="${col}" opacity=".55"/>`; break;
      case 'short': front=p(capF(31,39,4,'L27.5,4C27,-10 20,-20 10,-22L4,-18.5L-3,-23L-10,-19.5C-20,-20 -27,-10 -27.5,4')); break;
      case 'sidepart': front=p(capF(31.5,39.5,6,'L27.5,6C28,-8 24,-19 13,-26C4,-15 -14,-11 -28,-5L-31.5,6')); break;
      case 'curly': front=p(capF(30,37,2,round),B)+curls(); break;
      case 'afro':
        back=`<g ${A}><circle cx="0" cy="-10" r="43"/>${ring(0,-10,43,43,0,334,14,9.5)}</g>`;
        front=p(capF(30,37,2,round),B)+`<g ${A}>${ring(0,-25,18,3,180,360,5,7.5)}</g>`; break;
      case 'bob':
        H(false,0,-2,`<circle cx="0" cy="-2" r="34" ${A}/>`+p('M-35,-12Q-36,-22 -29,-22L29,-22Q36,-22 35,-12L36,26Q36,32 28,32L-28,32Q-36,32 -36,26Z'));
        front=p(capF(32,39.5,10,'L27,10L27,-11Q27,-15 22,-15L-22,-15Q-27,-15 -27,-11L-27,10')); break;
      case 'long':
        H(false,0,-2,`<circle cx="0" cy="-2" r="34" ${A}/>`+p('M-34,-12Q-35,-22 -28,-22L28,-22Q35,-22 34,-12L36,74Q0,88 -36,74Z'));
        [1,-1].forEach(k=>{const L=`M${k*26},-2C${k*34},10 ${k*36},50 ${k*31},72Q${k*26},76 ${k*23},69C${k*26},44 ${k*24},20 ${k*22},6`; H(true,k*25,1,`<circle cx="${k*25}" cy="1" r="5.5" fill="${col}" stroke="none"/>`+hangP(L+'Z',L));});
        front=p(capF(32,39.5,8,'L27,8C27,-10 16,-22 0,-29C-16,-22 -27,-10 -27,8')); break;
      case 'ponytail':
        H(false,25,0,`<circle cx="25" cy="0" r="6.5" ${A}/>`+p('M22,-6C40,-8 44,22 39,52Q33,58 29,48C33,26 30,10 20,6Z'));
        front=p(capF(30.5,38,2,'L27.5,2C27,-12 14,-23 0,-23C-14,-23 -27,-12 -27.5,2')); break;
      case 'bun':
        front=`<circle cx="0" cy="-43" r="11.5" ${A}/>`+p(capF(30.5,38,2,'L27.5,2C27,-12 14,-23 0,-23C-14,-23 -27,-12 -27.5,2')); break;
    }
  } else {
    const capS=(fx,fy)=>`M${fx},${fy}C${fx},-36 -12,-39 2,-39C22,-39 33,-24 32,-2C32,10 28,18 24,24L14,14C16,6 15,-4 12,-8L2,-9L1,3L-4,3C-5,${fy+10} -12,${fy} ${fx},${fy}Z`;
    const std=capS(-26,-20);
    switch(style){
      case 'crew': front=p(std); break;
      case 'pompadour': front=p(std)+p('M-27,-18C-37,-34 -25,-53 -4,-51C12,-50 25,-43 29,-30C14,-38 -6,-36 -27,-18Z'); break;
      case 'pigtails': front=p(std); H(true,20,-6,`<circle cx="20" cy="-6" r="6" ${A}/>`+p('M17,-9C32,-9 35,44 30,76Q25,80 22,73C25,46 23,14 15,0Z')); break;
      case 'buzz': front=`<path d="${std}" fill="${col}" opacity=".55"/>`; break;
      case 'short': front=p(std)+p('M-27,-19L-31,-13L-22,-17Z'); break;
      case 'sidepart': front=p(capS(-29,-10)); break;
      case 'curly': front=p(std,B)+`<g ${A}>${ring(2,-6,29,33,200,400,10,9)}</g>`; break;
      case 'afro':
        back=`<g ${A}><circle cx="5" cy="-10" r="42"/>${ring(5,-10,42,42,0,334,14,9.5)}</g>`;
        front=p(std,B)+`<g ${A}>${ring(-12,-24,13,5,170,330,4,7)}</g>`; break;
      case 'bob': front=p(capS(-29,-13)); H(true,17,-7,`<circle cx="17" cy="-7" r="17.5" fill="${col}" stroke="none"/>`+hangP('M0,-12L33,-6C37,10 37,24 34,30Q20,36 4,31C0,20 0,0 0,-12Z','M33,-6C37,10 37,24 34,30Q20,36 4,31C0,20 0,0 0,-12')); break;
      case 'long': front=p(std); H(true,17,-7,`<circle cx="17" cy="-7" r="17.5" fill="${col}" stroke="none"/>`+hangP('M0,-12L33,-6C38,20 38,60 34,78Q20,85 8,79C4,50 2,20 0,-12Z','M33,-6C38,20 38,60 34,78Q20,85 8,79C4,50 2,20 0,-12')); break;
      case 'ponytail': H(false,26,0,`<circle cx="26" cy="0" r="6.5" ${A}/>`+p('M24,-8C44,-10 46,30 39,56Q33,59 31,50C36,30 33,10 22,6Z')); front=p(std); break;
      case 'bun': front=`<circle cx="21" cy="-35" r="11.5" ${A}/>`+p(std); break;
    }
  }
  return {back,front,hang};
}

function facial(style,view,col){
  const st=shade(col,-0.3), A=`fill="${col}" stroke="${st}"`;
  const p=(d,a)=>`<path d="${d}" ${a||A}/>`, soft=`fill="${col}" stroke="none" opacity=".3"`;
  if(view==='front'){
    const mou='M-11,16Q-6,11 0,13.5Q6,11 11,16Q5,15.5 0,16.5Q-5,15.5 -11,16Z';
    const beard='M-29.5,-2C-29.5,18 -16,36.5 0,36.5C16,36.5 29.5,18 29.5,-2L25.5,-2C24,8 18,13 11,14.5Q0,10 -11,14.5C-18,13 -24,8 -25.5,-2Z';
    switch(style){
      case 'stubble': return p(beard,soft);
      case 'moustache': return p(mou);
      case 'handlebar': return p('M-16,11Q-14,16 -8,15.5Q-3,15.5 0,13.5Q3,15.5 8,15.5Q14,16 16,11Q16.5,19 8,18.5Q3,18.5 0,16.5Q-3,18.5 -8,18.5Q-16.5,19 -16,11Z');
      case 'soulpatch': return p('M-3.5,25.5Q0,24.5 3.5,25.5L0,31.5Z');
      case 'goatee': return p(mou)+p('M-11,16Q-12,30 -6,34Q0,37 6,34Q12,30 11,16L7.5,17Q8,25.5 0,26.5Q-8,25.5 -7.5,17Z');
      case 'chinstrap': return p('M-29.5,-4C-29.5,16 -16,36 0,36C16,36 29.5,16 29.5,-4L25,-4C25,14 13,30.5 0,30.5C-13,30.5 -25,14 -25,-4Z');
      case 'chops': return p('M29.5,-6C29.5,10 25,22 17,29L11,22C17,16 21,8 22,-6Z')+p('M-29.5,-6C-29.5,10 -25,22 -17,29L-11,22C-17,16 -21,8 -22,-6Z');
      case 'beard': return p(beard);
      case 'fullbeard': return p('M-30,-4C-31,24 -18,47 0,47C18,47 31,24 30,-4L25.5,-4C24,8 18,12 11,13.5Q0,9.5 -11,13.5C-18,12 -24,8 -25.5,-4Z');
    }
  } else {
    const mou='M-29,13Q-22,11.5 -15,16Q-20,18 -29,17Z';
    const beard='M-1,0L5,0C8,16 14,24 10,31C2,37 -16,38 -24,33C-28,29 -29,22 -28.5,13Q-22,11.5 -15,15C-10,15 -4,10 -1,0Z';
    switch(style){
      case 'stubble': return p(beard,soft);
      case 'moustache': return p(mou);
      case 'handlebar': return p('M-29,13Q-20,11 -11,11Q-10,19.5 -17,18.5Q-22,17 -29,17.5Z');
      case 'soulpatch': return p('M-26,25.5L-19.5,25L-23,31.5Z');
      case 'goatee': return p(mou)+p('M-27.5,25Q-20,27 -14,23Q-9,30 -8,36Q-16,38.5 -23,34Q-28,30 -27.5,25Z');
      case 'chinstrap': return p('M0,2L5,2C6,18 2,30 -8,35.8C-16,36.5 -23,33 -27,26L-23,24C-20,29 -15,31.5 -9,31C-3,27 0,16 0,2Z');
      case 'chops': return p('M-1,0L5,0C7,12 6,22 0,28L-8,22C-4,16 -2,8 -1,0Z');
      case 'beard': return p(beard);
      case 'fullbeard': return p('M-1,-2L5,-2C9,14 18,26 12,36C2,48 -20,48 -27,38C-31,30 -30,20 -28.5,12.5Q-22,11 -15,14C-10,14 -4,8 -1,-2Z');
    }
  }
  return '';
}

const EYEWEAR = {
  glasses:{label:'Glasses',phrase:'glasses',lens:'#CCFFFF',op:0.35,frame:'#2b2b2b'},
  round:{label:'Round glasses',phrase:'round glasses',lens:'#CCFFFF',op:0.35,frame:'#8a5a2b',shape:'round'},
  sunglasses:{label:'Sunglasses',phrase:'sunglasses',lens:'#000000',op:0.92,frame:'#15171a'},
  aviators:{label:'Aviator sunglasses',phrase:'aviator sunglasses',lens:'#666600',op:0.82,frame:'#b8902c',shape:'aviator'},
  cycling:{label:'Cycling sunglasses',phrase:'cycling sunglasses',lens:'#FF6600',op:0.9,frame:'#222222',shape:'shield'},
  sports:{label:'Sports sunglasses',phrase:'sports sunglasses',lens:'#0066CC',op:0.9,frame:'#222222',shape:'sport'}
};
const HEADWEAR = {
  cap:{label:'Cap',noun:'cap',col:'#0066CC'},
  beanie:{label:'Beanie',noun:'beanie',col:'#CC0000'},
  sunhat:{label:'Sun hat',noun:'sun hat',col:'#FFFFCC'},
  hardhat:{label:'Hard hat',noun:'hard hat',col:'#FFCC00'},
  fedora:{label:'Fedora',noun:'fedora',col:'#666666'},
  bikehelmet:{label:'Bicycle helmet',noun:'bicycle helmet',col:'#CC0000'},
  headband:{label:'Headband',noun:'headband',col:'#FF66CC'},
  bow:{label:'Bow hairband',noun:'bow hairband',col:'#CC0000'},
  headphones:{label:'Headphones',noun:'headphones',pl:1,col:'#333333'},
  headset:{label:'Headset',noun:'headset',col:'#333333'}
};
const ACCESSORIES = {
  watchL:{label:'Watch (L)'},watchR:{label:'Watch (R)'},braceletL:{label:'Bracelet (L)'},braceletR:{label:'Bracelet (R)'},
  ringL:{label:'Ring (L)'},ringR:{label:'Ring (R)'},glovesL:{label:'Glove (L)'},glovesR:{label:'Glove (R)'},
  elbowpadL:{label:'Elbow pad (L)'},elbowpadR:{label:'Elbow pad (R)'},kneepadL:{label:'Knee pad (L)'},kneepadR:{label:'Knee pad (R)'},
  mascara:{label:'Mascara'},blush:{label:'Blush'},lipstick:{label:'Lipstick'},necklace:{label:'Necklace'},choker:{label:'Choker'},backpack:{label:'Backpack'},fannypack:{label:'Fanny pack'},studs:{label:'Stud earrings'},drops:{label:'Drop earrings'},tie:{label:'Tie'}
};
/* rotate a colour's hue by deg degrees */
function hueRotate(hex,deg){
  const n=parseInt(hex.slice(1),16), r=(n>>16)/255, g=((n>>8)&255)/255, b=(n&255)/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, dl=mx-mn;
  let h=0, sat=0; if(dl){ sat=dl/(1-Math.abs(2*l-1)); h=mx===r?((g-b)/dl)%6:mx===g?(b-r)/dl+2:(r-g)/dl+4; h*=60; }
  h=((h+deg)%360+360)%360; const c=(1-Math.abs(2*l-1))*sat, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  const [R,G,B]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+[R,G,B].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function eyewearSVG(id,side,tint){
  const e=EYEWEAR[id]; if(!e) return '';
  if(e.shape==='shield'||e.shape==='sport'){
    /* mirror-tinted lenses: the colour runs from the tint at the outer edges to a 60° hue rotation at the nose,
       so the front view is symmetrical. The side view shows one half: rotated at the front, plain tint at the temple. */
    const c=tint||e.lens, c30=hueRotate(c,30), c60=hueRotate(c,60), st=`stroke="${e.frame}" stroke-width="1.4"`, op=`fill-opacity="${e.op}"`;
    const grad=(id,stops)=>`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${stops.map(([o,col])=>`<stop offset="${o}" stop-color="${col}"/>`).join('')}</linearGradient>`;
    const arm=d=>`<path d="${d}" fill="none" stroke="${e.frame}" stroke-width="2.4" stroke-linecap="round"/>`, brow=d=>`<path d="${d}" fill="none" stroke="${e.frame}" stroke-width="2.6" stroke-linecap="round"/>`;
    const g1='hcg'+(++UID), g2='hcg'+(++UID);
    if(e.shape==='shield') return side
      ?grad(g1,[[0,c60],[1,c]])+arm('M-7,-6L8,-5')+`<path d="M-27.5,-9Q-16,-11 -6,-9Q-4,-2 -9,3Q-17,6.5 -27,2.5Q-29,-3 -27.5,-9Z" fill="url(#${g1})" ${op} ${st}/>`+brow('M-27,-8.6Q-16,-10.6 -6.4,-8.6')
      :grad(g1,[[0,c],[0.25,c30],[0.5,c60],[0.75,c30],[1,c]])+arm('M-21,-6L-29,-5M21,-6L29,-5')+`<path d="M-22,-8.5Q0,-11.5 22,-8.5Q24,0 17.5,4Q9,6.5 3,1.5Q0,-0.5 -3,1.5Q-9,6.5 -17.5,4Q-24,0 -22,-8.5Z" fill="url(#${g1})" ${op} ${st}/>`+brow('M-21.6,-8.2Q0,-11.2 21.6,-8.2');
    /* sport: two separate angular lenses; m = +1 when the outer corner is on the +x side */
    const lens=(cx,m,id)=>`<path d="M${cx-m*7.5},-7.5L${cx+m*9},-6.5Q${cx+m*10.5},-1 ${cx+m*6},3.6Q${cx-m},5.6 ${cx-m*7},2Z" fill="url(#${id})" ${op} ${st}/>`;
    return side
      ?grad(g1,[[0,c60],[1,c]])+arm('M-7,-5L8,-5')+lens(-16,1,g1)
      :grad(g1,[[0,c],[1,c60]])+grad(g2,[[0,c60],[1,c]])+arm('M-21,-6L-29,-5M21,-6L29,-5')+lens(-11.5,-1,g1)+lens(11.5,1,g2)+brow('M-4,-5Q0,-7 4,-5');
  }
  const w=e.shape==='aviator'?1.1:1.6;
  const fr=`fill="${tint||e.lens}" fill-opacity="${e.op}" stroke="${e.frame}" stroke-width="${w}"`, ln=`fill="none" stroke="${e.frame}" stroke-width="${w}" stroke-linecap="round"`;
  /* m = +1 when the outer corner of the lens is on the +x side */
  const lens=(cx,m)=>e.shape==='round'?`<circle cx="${cx}" cy="-2" r="6.6" ${fr}/>`
    :e.shape==='aviator'?`<path d="M${cx-m*7},-7.5Q${cx},-9 ${cx+m*7.5},-7Q${cx+m*9},0 ${cx+m*4},5Q${cx-m},7.5 ${cx-m*5.5},3.5Q${cx-m*8},-2 ${cx-m*7},-7.5Z" ${fr}/>`
    :`<rect x="${cx-7}" y="-7.5" width="14" height="11" rx="2.5" ${fr}/>`;
  const bridge=e.shape==='aviator'?'M-4.5,-6.5H4.5M-4.5,-2.5Q0,-4.5 4.5,-2.5':'M-4.5,-3Q0,-5.5 4.5,-3';
  if(!side) return lens(-11.5,-1)+lens(11.5,1)+`<path d="${bridge}M-18.5,-3L-28,-4M18.5,-3L28,-4" ${ln}/>`;
  return lens(-15.5,1)+`<path d="M-8.5,-3L7,-4M-22.5,-3L-27,-3" ${ln}/>`;
}
/* ── face parts ─────────────────────────────────────────────────────────── */
const BROWS=[['neutral','Neutral'],['raised','Raised'],['sad','Sad'],['angry','Angry'],['flat','Flat'],['skeptical','One raised']];
const EYE_SHAPES=[['open','Open'],['wide','Wide'],['narrow','Narrow'],['happy','Happy'],['closed','Closed'],['sad','Sad'],['angry','Angry'],['wink','Wink']];
/* the first six are expression mouths; the rest follow the Hanna-Barbera lip-sync chart */
const MOUTHS=[['smile','Smile'],['grin','Grin'],['frown','Frown'],['gritted','Gritted teeth'],['sneer','Sneer'],['wavy','Wavy'],
  ['rest','Rest'],['mbp','M · B · P'],['ai','A · I'],['e','E'],['o','O'],['u','U'],
  ['cdg','C · D · G · K · N · R · S · Th · Y · Z'],['fv','F · V'],['l','L'],['wq','W · Q']];
function mouthSVG(id,lip){
  const In='#4a1717', T='#fff', Tg='#e07a78', G='#b9b9b9';
  const line=(d,w)=>`<path d="${d}" fill="none" stroke="${lip}" stroke-width="${w||2.2}" stroke-linecap="round"/>`;
  const shape=(d,fill)=>`<path d="${d}" fill="${fill}" stroke="${lip}" stroke-width="1.6"/>`;
  const flat=(d,fill)=>`<path d="${d}" fill="${fill}" stroke="none"/>`;
  const open='M-7,18.5Q0,16.5 7,18.5Q6,28 0,28.5Q-6,28 -7,18.5Z', teeth='M-5.8,18.7Q0,17.5 5.8,18.7L5.3,20.8Q0,20.1 -5.3,20.8Z';
  switch(id){
    case 'grin': return shape('M-9.5,17.5Q0,21 9.5,17.5Q8,28 0,28.5Q-8,28 -9.5,17.5Z',In)+flat('M-8.3,18.3Q0,21.3 8.3,18.3L7.6,20.9Q0,23.4 -7.6,20.9Z',T)+`<ellipse cx="0" cy="26.3" rx="3.8" ry="1.7" fill="${Tg}" stroke="none"/>`;
    case 'frown': return line('M-7,23.5Q0,18.5 7,23.5');
    case 'gritted': return shape('M-8,19Q0,18 8,19L7.5,24.5Q0,25.5 -7.5,24.5Z',T)+`<path d="M-7.7,21.8H7.7M-4,18.6V25M0,18.5V25.2M4,18.6V25" fill="none" stroke="${G}" stroke-width=".8"/>`;
    case 'sneer': return line('M-7,22.5Q-2,20 2,21.5Q5,22.5 7.5,18.5');
    case 'wavy': return line('M-7.5,22Q-5,19.5 -2.5,22T2.5,22T7.5,22');
    case 'rest': return line('M-6,21.5Q0,23 6,21.5');
    case 'mbp': return line('M-6.5,21.6Q0,20.7 6.5,21.6',2.6);
    case 'ai': return shape(open,In)+flat(teeth,T)+`<ellipse cx="0" cy="26" rx="3.6" ry="1.8" fill="${Tg}" stroke="none"/>`;
    case 'e': return shape('M-9,18.5Q0,20 9,18.5Q7,25.5 0,26Q-7,25.5 -9,18.5Z',T)+`<path d="M-8,21.8Q0,23.4 8,21.8" fill="none" stroke="${G}" stroke-width=".8"/>`;
    case 'o': return `<ellipse cx="0" cy="22" rx="4.2" ry="5.5" fill="${In}" stroke="${lip}" stroke-width="2"/>`;
    case 'u': return `<ellipse cx="0" cy="22" rx="2.5" ry="3.1" fill="${In}" stroke="${lip}" stroke-width="2.4"/>`;
    case 'cdg': return shape('M-7.5,19.5Q0,18.5 7.5,19.5Q6,24.5 0,24.8Q-6,24.5 -7.5,19.5Z',T)+`<path d="M-6.8,21.9H6.8" fill="none" stroke="${G}" stroke-width=".8"/>`;
    case 'fv': return line('M-6.5,19.2Q0,18.2 6.5,19.2',1.6)+`<path d="M-4.6,19H4.6V22Q0,22.9 -4.6,22Z" fill="${T}" stroke="${lip}" stroke-width=".9"/>`+line('M-6.5,23Q0,25 6.5,23');
    case 'l': return shape(open,In)+flat(teeth,T)+`<ellipse cx="0" cy="22" rx="3.4" ry="2.7" fill="${Tg}" stroke="none"/>`;
    case 'wq': return `<ellipse cx="0" cy="22" rx="3.3" ry="3.9" fill="${In}" stroke="${lip}" stroke-width="2.8"/>`;
  }
  return line('M-7,20.5Q0,25 7,20.5');   /* smile */
}
/* Plutchik's wheel: eight petals, each mild → basic → intense. [id, label, eyebrows, eyes, mouth] */
const EMOTIONS=[
  ['Joy',[['serenity','Serenity','neutral','closed','smile'],['joy','Joy','raised','happy','e'],['ecstasy','Ecstasy','raised','wide','grin']]],
  ['Trust',[['acceptance','Acceptance','neutral','open','smile'],['trust','Trust','raised','open','smile'],['admiration','Admiration','raised','wide','e']]],
  ['Fear',[['apprehension','Apprehension','sad','open','mbp'],['fear','Fear','sad','wide','wavy'],['terror','Terror','sad','wide','ai']]],
  ['Surprise',[['distraction','Distraction','skeptical','open','u'],['surprise','Surprise','raised','wide','o'],['amazement','Amazement','raised','wide','ai']]],
  ['Sadness',[['pensiveness','Pensiveness','sad','narrow','mbp'],['sadness','Sadness','sad','sad','frown'],['grief','Grief','sad','closed','wavy']]],
  ['Disgust',[['boredom','Boredom','flat','narrow','rest'],['disgust','Disgust','flat','narrow','sneer'],['loathing','Loathing','angry','narrow','sneer']]],
  ['Anger',[['annoyance','Annoyance','angry','open','mbp'],['anger','Anger','angry','angry','frown'],['rage','Rage','angry','angry','gritted']]],
  ['Anticipation',[['interest','Interest','skeptical','open','smile'],['anticipation','Anticipation','raised','open','cdg'],['vigilance','Vigilance','angry','wide','mbp']]]
];
const NEUTRAL_FACE=['neutral','Neutral','neutral','open','rest'];
function headwearSVG(id,side,col){
  let h=HEADWEAR[id]; if(!h) return ''; h={...h,col:col||h.col};
  const dk=edge(h.col), A=`fill="${h.col}" stroke="${dk}"`, B=`fill="${shade(h.col,-0.18)}" stroke="${dk}"`;
  const t=side?'<g transform="translate(2 0)">':'<g>';
  switch(id){
    case 'beanie': return t+`<path d="M-32,-14C-34,-54 34,-54 32,-14Z" ${A}/><rect x="-33.5" y="-23" width="67" height="11" rx="4" ${B}/></g>`;
    case 'cap': return t+`<path d="M-31,-17C-33,-53 33,-53 31,-17Z" ${A}/>`+(side?'':`<path d="M-27,-18Q0,-6 27,-18Q0,-25 -27,-18Z" ${B}/>`)+'</g>'
      +(side?`<path d="M-28,-24L-48,-19Q-56,-16 -50,-14L-27,-16Z" ${B}/>`:'');
    case 'sunhat': return t+`<ellipse cx="0" cy="-21" rx="54" ry="7.5" ${A}/><path d="M-27,-21C-29,-53 29,-53 27,-21Z" ${A}/><path d="M-27,-22.5Q0,-16 27,-22.5L27.4,-28Q0,-21.5 -27.4,-28Z" fill="#8a5a3b" stroke="none"/></g>`;
    case 'hardhat': return t+`<path d="M-32,-16C-34,-56 34,-56 32,-16Z" ${A}/><path d="M-4,-45Q0,-47.5 4,-45V-17H-4Z" ${B}/><path d="M-37,-17H37Q38,-11 32,-11H-32Q-38,-11 -37,-17Z" ${A}/></g>`;
    case 'bikehelmet': { const sl='fill="#222" fill-opacity=".55" stroke="none"', strapc=`fill="none" stroke="#333" stroke-width="1.6"`;
      return side
        ?t+`<path d="M-2,-16L-12,34M18,-14L-10,34" ${strapc}/><path d="M-35,-17C-37,-50 16,-60 40,-24Q42,-16 34,-15Q0,-22 -35,-17Z" ${A}/><path d="M-22,-30Q-6,-46 16,-44L20,-38Q0,-40 -18,-26ZM-10,-22Q8,-32 26,-30L28,-24Q10,-26 -6,-19Z" ${sl}/></g>`
        :t+`<path d="M-29.6,-14C-30.4,16 -17,36.6 0,36.6C17,36.6 30.4,16 29.6,-14" ${strapc}/><rect x="-3" y="34.6" width="6" height="4" rx="1" fill="#333" stroke="none"/><path d="M-33,-14C-35,-58 35,-58 33,-14Q0,-24 -33,-14Z" ${A}/><path d="M-3,-44H3L4,-22H-4ZM-17,-39L-11,-42L-9,-22L-15,-21ZM17,-39L11,-42L9,-22L15,-21ZM-27,-27L-23,-32L-20,-20L-25,-18ZM27,-27L23,-32L20,-20L25,-18Z" ${sl}/></g>`; }
    case 'fedora': return t+`<ellipse cx="0" cy="-19" rx="45" ry="6.5" ${A}/><path d="M-27,-20C-29,-42 -22,-52 -9,-50Q0,-45.5 9,-50C22,-52 29,-42 27,-20Z" ${A}/><path d="M-27,-21Q0,-15.5 27,-21L27.6,-27.5Q0,-22 -27.6,-27.5Z" fill="${shade(h.col,-0.55)}" stroke="none"/></g>`;
    case 'bow': case 'headphones': case 'headset': {
      /* a band over the crown from ear to ear, just in front of the ears; in profile it is a vertical strip */
      const w=id==='bow'?4.5:5.5, o=31.5, q=o-w;
      const band=side?`<path d="M-4,-39.5H${n2(-4+w+1)}Q${n2(-3+w+1)},-20 ${n2(-4+w+1)},-4H-4Q-3,-20 -4,-39.5Z" ${A}/>`
        :`<path d="M${-o},-1C${-o-1},-31 -18,-40.5 0,-40.5C18,-40.5 ${o+1},-31 ${o},-1L${q},-1C${q+0.5},-27 15,${n2(-40.5+w)} 0,${n2(-40.5+w)}C-15,${n2(-40.5+w)} ${-q-0.5},-27 ${-q},-1Z" ${A}/>`;
      if(id==='bow'){ const bx=side?-1:14, by=side?-41:-38;
        return t+band+`<g transform="translate(${bx} ${by})"><path d="M0,0L-13,-8Q-15,0 -13,8Z" ${A}/><path d="M0,0L13,-8Q15,0 13,8Z" ${A}/><circle r="3.6" ${B}/></g></g>`; }
      const cups=side?`<ellipse cx="4" cy="2" rx="9.5" ry="11.5" ${A}/><ellipse cx="4" cy="2" rx="5.5" ry="7.5" ${B}/>`
        :[-1,1].map(k=>`<rect x="${k>0?28.5:-36.5}" y="-9" width="8" height="22" rx="3.5" ${A}/>`).join('');
      const mic=id!=='headset'?'':side?`<path d="M0,10Q-10,24 -25,21" fill="none" stroke="${h.col}" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="-27" cy="21" rx="3.6" ry="2.8" ${B}/>`
        :`<path d="M-32,11Q-30,25 -14,24" fill="none" stroke="${h.col}" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="-12" cy="24" rx="3.6" ry="2.8" ${B}/>`;
      return t+band+cups+mic+'</g>'; }
    case 'headband': return t+`<path d="M-30.5,-19Q0,-30 30.5,-19L30.5,-13Q0,-24 -30.5,-13Z" ${A}/></g>`;
  }
  return '';
}

function headSVG(d,C){
  const side=d.head!=='front', eye=EYES[d.eyeColor-1];
  const h=hair(d.hairStyle,side?'side':'front',C.hair,(d.headwear&&!['headband','bow','headphones','headset'].includes(d.headwear))||d.upperGarment==='hoodieup'), fh=facial(d.facialHair,side?'side':'front',C.hair);
  const S=`fill="${C.skin}" stroke="${C.skinS}"`, lash=shade(C.skin,-0.62);
  const iris=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${eye.hex}" stroke="${shade(eye.hex,-0.35)}" stroke-width=".7"/>`
    +(eye.fleck?`<circle cx="${x}" cy="${y}" r="${n2(r*0.62)}" fill="#b58a3c" stroke="none"/>`:'')
    +`<circle cx="${x}" cy="${y}" r="${n2(r*0.44)}" fill="#111" stroke="none"/><circle cx="${x+1}" cy="${y-1.1}" r=".7" fill="#fff" stroke="none"/>`;
  /* make-up: mascara darkens and thickens the lash line, blush is a translucent patch on each cheek, lipstick recolours the mouth */
  const mk=a=>d.accessories.includes(a), MASC=mk('mascara')?(d.mascaraColor||MASCARA_COL):null;
  const blushAt=x=>mk('blush')?`<ellipse cx="${x}" cy="9.5" rx="6.2" ry="4" fill="${d.blushColor||BLUSH_COL}" fill-opacity=".36" stroke="none"/>`:'';
  const ln=dd=>`<path d="${dd}" fill="none" stroke="${MASC||lash}" stroke-width="${MASC?2.5:1.8}" stroke-linecap="round"/>`;
  /* one eye. x = centre, o = which way its outer corner points (+1 / -1), ix = iris centre */
  const eyeAt=(x,o,kind,ix)=>{
    if(kind==='happy') return ln(`M${x-5},-0.5Q${x},-6.5 ${x+5},-0.5`);
    if(kind==='closed') return ln(`M${x-5},-2.5Q${x},1.5 ${x+5},-2.5`);
    const wide=kind==='wide', r=wide?5.6:5;
    let e=`<ellipse cx="${x}" cy="-2" rx="${r}" ry="${wide?5.6:4.2}" fill="#fff" stroke="${C.skinS}" stroke-width=".8"/>`+iris(ix,-2,wide?2.7:3.2);
    if(MASC&&(kind==='open'||wide)){ const ry=wide?5.6:4.2;   /* lash line along the upper lid, with a flick at the outer corner */
      e+=`<path d="M${n2(x-r)},-2.6A${r},${ry} 0 0 1 ${n2(x+r)},-2.6M${n2(x+o*r)},-2.8l${n2(o*2.8)},-2.4" fill="none" stroke="${MASC}" stroke-width="1.9" stroke-linecap="round"/>`; }
    /* an eyelid: skin down to (or up to) a line from the outer corner (yo) to the inner corner (yi) */
    const lid=(yo,yi,top)=>{const xo=n2(x+o*6.2), xi=n2(x-o*6.2), ye=top?-8.2:4.2;
      return `<path d="M${xo},${yo}L${xo},${ye}L${xi},${ye}L${xi},${yi}Z" fill="${C.skin}" stroke="none"/>`+ln(`M${xo},${yo}L${xi},${yi}`);};
    if(kind==='narrow') e+=lid(-3.6,-3.6,true)+lid(0.4,0.4,false);
    if(kind==='sad') e+=lid(-1.2,-5.4,true);
    if(kind==='angry') e+=lid(-5.6,-2.2,true);
    return e;
  };
  const browAt=(x,o,kind,hw)=>{const B={neutral:[-10.5,-10.5,-13.5],raised:[-13.5,-13,-17],sad:[-9.5,-14,-13],angry:[-13.5,-8.5,-12.5],flat:[-9.8,-9.8,-10]}[kind];
    return `<path d="M${n2(x+o*hw)},${B[0]}Q${x},${B[2]} ${n2(x-o*hw)},${B[1]}" fill="none" stroke="${C.brow}" stroke-width="2.3" stroke-linecap="round"/>`;};
  const bk=d.eyebrows, ek=d.eyes, mouth=mouthSVG(d.mouth,mk('lipstick')?(d.lipstickColor||LIPSTICK_COL):C.lip);
  let s='';
  if(!side){
    s+=`<ellipse cx="-29.5" cy="1" rx="5" ry="7.5" ${S}/><ellipse cx="29.5" cy="1" rx="5" ry="7.5" ${S}/>`
     + `<path d="M-29,-4C-29,-30 -17,-36 0,-36C17,-36 29,-30 29,-4C29,16 16,35 0,35C-16,35 -29,16 -29,-4Z" ${S}/>`
     + blushAt(-17)+blushAt(17) + fh
     + eyeAt(-11.5,-1,ek==='wink'?'open':ek,-11.5)+eyeAt(11.5,1,ek==='wink'?'happy':ek,11.5)
     + browAt(-11.5,-1,bk==='skeptical'?'raised':bk,5.5)+browAt(11.5,1,bk==='skeptical'?'flat':bk,5.5)
     + `<path d="M-1,2L-3.5,9.5Q0,11.5 3,9.5" fill="none" stroke="${C.skinS}" stroke-width="1.5" stroke-linecap="round"/>`
     + mouth;
  } else {
    s+=`<path d="M-28,-6L-35.5,8Q-36,11 -31,11.5L-28.5,12C-29,24 -22,35 -8,35C10,35 22,28 27,10C31,-2 30,-36 0,-36C-17,-36 -29,-30 -28,-6Z" ${S}/>`
     + blushAt(-14) + fh
     + eyeAt(-15,1,ek==='wink'?'open':ek,-16.2)
     + browAt(-15.5,1,bk==='skeptical'?'raised':bk,6.5)
     + `<g transform="translate(-22.3 0) scale(.55 1)">${mouth}</g>`
     + `<ellipse cx="7" cy="1" rx="5" ry="7.5" ${S}/><path d="M8,-2Q5,1 8,4" fill="none" stroke="${C.skinS}"/>`;
  }
  const star=(x,y,a)=>`<path transform="translate(${x} ${y})" d="M0,${-a}Q${n2(a*0.13)},${n2(-a*0.13)} ${a},0Q${n2(a*0.13)},${n2(a*0.13)} 0,${a}Q${n2(-a*0.13)},${n2(a*0.13)} ${-a},0Q${n2(-a*0.13)},${n2(-a*0.13)} 0,${-a}Z" fill="#fffbe0" stroke="#e2b23a" stroke-width=".8"/>`;
  const ear=d.accessories.includes('studs')?(side?[7]:[-30.5,30.5]).map(x=>`<path d="M${x},8V11" stroke="#9c7716" stroke-width="1.2" fill="none"/><circle cx="${x}" cy="13.5" r="3.6" fill="#e2b23a" stroke="#9c7716" stroke-width="1"/>`+star(x+(x<0?-5:5),8.5,5.5)).join(''):'';
  /* hood up: a shell behind the head and a rim round the face, in the hoodie's colour */
  let hood=null;
  if(d.upperGarment==='hoodieup'){ const hc=d.upperColor||UPPER.hoodieup.col, a=`fill="${hc}" stroke="${edge(hc)}"`;
    hood=side?{back:`<path d="M-14,-42C14,-50 42,-30 40,8Q36,38 8,44L-8,40Z" ${a}/>`,
               front:`<path d="M-16,-41C12,-49 41,-30 39,8Q35,37 8,43L-9,40Q-1,22 -1,0Q-2,-26 -16,-41Z" ${a}/>`}
             :{back:`<path d="M-38,22C-43,-32 -24,-49 0,-49C24,-49 43,-32 38,22Q22,44 0,46Q-22,44 -38,22Z" ${a}/>`,
               front:`<path fill-rule="evenodd" d="M-37,22C-42,-31 -23,-48 0,-48C23,-48 42,-31 37,22Q21,43 0,45Q-21,43 -37,22ZM-26,-2C-26,-25 -14,-33 0,-33C14,-33 26,-25 26,-2C26,15 14,31 0,31C-14,31 -26,15 -26,-2Z" ${a}/>`}; }
  /* drop earrings: pinned at the earlobe, drawn unrotated so they always hang */
  const drops=d.accessories.includes('drops')?(side?[7]:[-30.5,30.5]).map(x=>({x,y:8,svg:`<path d="M0,0V9" stroke="#9c7716" stroke-width="1.3" fill="none"/><path d="M0,8Q-5,16 0,20.5Q5,16 0,8Z" fill="#e2b23a" stroke="#9c7716" stroke-width="1"/>`+star(x<0?-6.5:6.5,11,5.5)})):[];
  return {back:h.back, hang:h.hang, drops,
          hoodBack:hood&&hood.back, top:headwearSVG(d.headwear,side,d.headwearColor)+(hood?hood.front:'')+ear,   /* headwear sits above all hair, earrings above that */
          front:s+h.front+eyewearSVG(d.eyewear,side,d.eyewearColor)};
}
/* ── clothes. off = how far the fitted parts sit outside the body (px).
      arm / fore / thigh / shin = fraction of that segment covered (1 = all).
      tails / skirt = loose panel length as a fraction of the thigh.        ── */
const UPPER = {
  tshirt:{label:'T-shirt',noun:'T-shirt',col:'#CC0000',off:1.5,hem:13,arm:0.5,neck:'crew'},
  polo:{label:'Polo shirt',noun:'polo shirt',col:'#00CC66',off:1.5,hem:13,arm:0.5,neck:'collar',placket:0.22},
  shirt:{label:'Shirt',noun:'shirt',col:'#FFFFFF',off:1.5,hem:3,arm:1,fore:0.95,neck:'collar',placket:1},
  tank:{label:'Tank top',noun:'tank top',col:'#FFCC00',off:1,hem:12,arm:0,neck:'scoop'},
  coat:{label:'Coat',noun:'coat',col:'#0066CC',off:4,hem:5,arm:1,fore:0.97,neck:'lapel',tails:0.42,flare:3},
  blouse:{label:'Blouse',noun:'blouse',col:'#CCCCFF',off:1.5,hem:3,arm:1,fore:0.9,neck:'vneck'},
  sportstop:{label:'Sports top',noun:'sports top',col:'#FF66CC',off:0.8,hem:6,arm:0,neck:'scoop'},
  bikinitop:{label:'Bikini top',noun:'bikini top',col:'#FF66CC',off:0.4,hem:3,arm:0,swim:true,bikini:true},
  swimsuit:{label:'Swimsuit (one-piece)',noun:'swimsuit',col:'#0066CC',off:0.6,hem:3,arm:0,neck:'scoop',swim:true,onepiece:true},
  croptop:{label:'Crop top',noun:'crop top',col:'#FFCC00',off:1.5,hem:3,arm:0.5,neck:'crew',crop:true},
  croptank:{label:'Crop top (sleeveless)',noun:'crop top',col:'#FF66CC',off:1.2,hem:3,arm:0,neck:'scoop',crop:true},
  dress:{label:'Dress',noun:'dress',col:'#00CCCC',off:1.2,hem:5,arm:0,neck:'scoop',tails:0.8,flare:12},
  hoodie:{label:'Hoodie (hood down)',noun:'hoodie',col:'#666666',off:3,hem:14,arm:1,fore:0.97,neck:'hood'},
  hoodieup:{label:'Hoodie (hood up)',noun:'hoodie',col:'#666666',off:3,hem:14,arm:1,fore:0.97,neck:'hood',hoodUp:true},
  gown:{label:'Gown',noun:'gown',col:'#660066',off:1.2,hem:5,arm:0,neck:'vneck',tails:1.85,flare:14},
  vest:{label:'Shirt and vest',noun:'vest',col:'#666666',off:2,hem:6,arm:1,fore:0.95,neck:'vest',vest:1},
  jacket:{label:'Formal jacket (closed)',noun:'jacket',col:'#000066',off:3.5,hem:5,arm:1,fore:0.97,neck:'suit',tails:0.24,flare:2},
  jacketopen:{label:'Formal jacket (open)',noun:'jacket',col:'#000066',off:3.5,hem:5,arm:1,fore:0.97,neck:'suitopen',tails:0.24,flare:2}
};
const LOWER = {
  jeans:{label:'Jeans',noun:'jeans',pl:1,col:'#000066',off:2.2,thigh:1,shin:0.96},
  trousers:{label:'Trousers',noun:'trousers',pl:1,col:'#666666',off:2.5,thigh:1,shin:0.97},
  chinos:{label:'Chinos',noun:'chinos',pl:1,col:'#CCCC66',off:2.5,thigh:1,shin:0.94},
  shorts:{label:'Shorts',noun:'shorts',pl:1,col:'#000000',off:3,thigh:0.7},
  cargopants:{label:'Cargo pants',noun:'cargo pants',pl:1,col:'#666600',off:3.2,thigh:1,shin:0.96,cargo:true},
  trackpants:{label:'Track pants',noun:'track pants',pl:1,col:'#000066',off:3,thigh:1,shin:0.95,stripe:true},
  bellbottoms:{label:'Bell-bottoms',noun:'bell-bottoms',pl:1,col:'#0066CC',off:2.2,thigh:1,shin:0.98,bell:9},
  bikinibottom:{label:'Bikini bottoms',noun:'bikini bottoms',pl:1,col:'#FF66CC',off:0.5,thigh:0,swim:true},
  swimbriefs:{label:'Swim briefs',noun:'swim briefs',pl:1,col:'#000066',off:0.5,thigh:0,swim:true},
  swimshorts:{label:'Swim shorts',noun:'swim shorts',pl:1,col:'#00CCCC',off:2.5,thigh:0.5,swim:true},
  pleatedskirt:{label:'Pleated skirt',noun:'pleated skirt',col:'#FFFFFF',off:1.5,thigh:0,skirt:0.46,flare:11,pleats:1},
  leggings:{label:'Leggings',noun:'leggings',pl:1,col:'#000000',off:0.6,thigh:1,shin:0.9},
  skirt:{label:'Skirt',noun:'skirt',col:'#660066',off:1.5,thigh:0,skirt:0.88,flare:0}
};
const FOOT = {
  socks:{label:'Socks',col:'#FFFFFF',off:0.8,kind:'sock'},
  sneakers:{label:'Sneakers',col:'#FFFFFF',off:2,kind:'closed',accent:'#d0453b'},
  shoes:{label:'Dress shoes',col:'#000000',off:1.5,kind:'closed'},
  boots:{label:'Boots',col:'#663300',off:2.2,kind:'closed',shaft:0.3},
  hikingboots:{label:'Hiking boots',col:'#CC6600',off:2.8,kind:'closed',shaft:0.2,platform:3,accent:'#663300'},
  sandals:{label:'Sandals',col:'#CC6600',off:0,kind:'sandal'},
  platforms:{label:'Platform shoes',col:'#660066',off:2,kind:'closed',platform:7},
  heels:{label:'Heels',col:'#CC0000',off:1.2,kind:'pump'}
};
const SOCK_COL='#FFFFFF', TIE_COL='#CC0000', GLOVE_COL='#663300', PACK_COL='#CC6600', MASCARA_COL='#000000', BLUSH_COL='#FF6666', LIPSTICK_COL='#CC0000';
/* 64 web-safe colours: every mix of the levels 00, 66, CC and FF */
const PALETTE=[]; for(const r of ['00','66','CC','FF']) for(const g of ['00','66','CC','FF']) for(const b of ['00','66','CC','FF']) PALETTE.push('#'+r+g+b);
/* a learner-level colour word for any hex */
function colourName(hex){
  const n=parseInt(hex.slice(1),16), r=(n>>16)/255, g=((n>>8)&255)/255, b=(n&255)/255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, dl=mx-mn;
  if(dl<0.1) return l<0.15?'black':l>0.9?'white':l>0.6?'light grey':'grey';
  let h=mx===r?((g-b)/dl)%6:mx===g?(b-r)/dl+2:(r-g)/dl+4; h=(h*60+360)%360;
  let base;
  if(h<15||h>=345) base=l>0.65?'pink':'red';
  else if(h<45){ if(l<0.45) return l<0.18?'dark brown':'brown'; base='orange'; }
  else if(h<70){ if(l<0.35) return 'olive'; base='yellow'; }
  else if(h<165) base='green'; else if(h<195) base='turquoise'; else if(h<255) base='blue';
  else if(h<290) base='purple'; else base=l<0.35?'purple':'pink';
  return (l<0.3?'dark ':l>0.72&&base!=='pink'?'light ':'')+base;
}
/* fabric patterns: base colour + a secondary colour, as SVG pattern fills */
const PATTERNS=[['plain','Plain'],['vstripes','Vertical stripes'],['hstripes','Horizontal stripes'],['checkered','Checkered'],['polka','Polka dots'],['floral','Floral'],['sidestripe','Side stripe']];
const PAT_WORD={vstripes:'striped',hstripes:'striped',checkered:'checkered',polka:'polka-dot',floral:'floral'};
const colour2Default=c=>colourName(c)==='white'?'#0066CC':'#FFFFFF';
let UID=0;
function patDef(id,type,a,b){
  const P=(w,h,body)=>`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${a}"/>${body}</pattern>`;
  switch(type){
    case 'vstripes': return P(9,9,`<rect width="4.5" height="9" fill="${b}"/>`);
    case 'hstripes': return P(9,9,`<rect width="9" height="4.5" fill="${b}"/>`);
    case 'checkered': return P(12,12,`<rect width="6" height="6" fill="${b}"/><rect x="6" y="6" width="6" height="6" fill="${b}"/>`);
    case 'polka': return P(12,12,`<circle cx="3" cy="3" r="2.1" fill="${b}"/><circle cx="9" cy="9" r="2.1" fill="${b}"/>`);
    case 'floral': { const fl=(x,y)=>[0,72,144,216,288].map(t=>{const r=t*Math.PI/180; return `<circle cx="${n2(x+2.6*Math.cos(r))}" cy="${n2(y+2.6*Math.sin(r))}" r="1.9" fill="${b}"/>`;}).join('')+`<circle cx="${x}" cy="${y}" r="1.5" fill="${shade(b,-0.4)}"/>`;
      return P(20,20,fl(5,5)+fl(15,15)); }
  }
  return '';
}
const hexOK=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toUpperCase():null;
/* outline for a fabric colour: darker, or lighter when the fabric is nearly black */
/* RGB complement — used for the shirt under a formal jacket */
const complement=hex=>'#'+((0xFFFFFF^parseInt(hex.slice(1),16))|0x1000000).toString(16).slice(1).toUpperCase();
function edge(col){const n=parseInt(col.slice(1),16); return ((n>>16)*0.3+((n>>8)&255)*0.59+(n&255)*0.11)<45?shade(col,0.32):shade(col,-0.38);}
/* Outline rule: wherever a piece overlaps a neighbour of the same colour, that
   stretch of its outline is drawn faint (SEAM) so the two read as one shape. */
const SEAM=' stroke-opacity=".2"';
/* capsule as fill + outline pieces; faint: 't' = top cap, 'b' = bottom cap */
/* a solid ring hidden under a joint: it supplies the outline on the outside of a
   bend, where the faint cap of the piece on top would otherwise leave a gap */
const under=(x,y,r,stroke)=>`<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r-0.65)}" fill="none" stroke="${stroke}" stroke-width="2.6"/>`;   /* outer edge flush with a normal outline */
function limb(r1,r2,len,fill,stroke,faint){
  const a=n2(r1), b=n2(r2), L=n2(len), o=`fill="none" stroke="${stroke}"`;
  return `<path d="${capsule(r1,r2,len)}" fill="${fill}" stroke="none"/><path d="M${a},0L${b},${L}M${-b},${L}L${-a},0" ${o}/>`
    +`<path d="M${-a},0A${a},${a} 0 0 1 ${a},0" ${o}${faint.includes('t')?SEAM:''}/><path d="M${b},${L}A${b},${b} 0 0 1 ${-b},${L}" ${o}${faint.includes('b')?SEAM:''}/>`;
}
/* sleeve / shorts leg: rounded top, flat cuff */
function cuffed(r1,r2,len,frac,fill,stroke,faintTop){
  const L=n2(len*frac), rm=n2(r1+(r2-r1)*frac+0.5), a=n2(r1+0.5), o=`fill="none" stroke="${stroke}"`;
  return `<path d="${sleeve(r1,r2,len,frac)}" fill="${fill}" stroke="none"/><path d="M${a},0L${rm},${L}L${-rm},${L}L${-a},0" ${o}/><path d="M${-a},0A${a},${a} 0 0 1 ${a},0" ${o}${faintTop?SEAM:''}/>`;
}

const OUTFITS = {
  male:[
    {id:'casual',label:'Casual',upperGarment:'tshirt',lowerGarment:'jeans',footwear:'sneakers'},
    {id:'office',label:'Office',upperGarment:'shirt',lowerGarment:'trousers',footwear:'shoes',tie:true},
    {id:'sport',label:'Sport',upperGarment:'tank',lowerGarment:'shorts',footwear:'sneakers'},
    {id:'winter',label:'Winter',upperGarment:'coat',lowerGarment:'trousers',footwear:'boots'},
    {id:'summer',label:'Summer',upperGarment:'polo',lowerGarment:'chinos',footwear:'sandals'},
    {id:'formal',label:'Formal',upperGarment:'jacket',lowerGarment:'trousers',footwear:'shoes',tie:true},
    {id:'smart',label:'Smart casual',upperGarment:'jacketopen',lowerGarment:'jeans',footwear:'sneakers'},
    {id:'waistcoat',label:'Shirt and vest',upperGarment:'vest',lowerGarment:'trousers',footwear:'shoes',tie:true},
    {id:'work',label:'Work',upperGarment:'tshirt',lowerGarment:'jeans',footwear:'boots'},
    {id:'beach',label:'Beach',upperGarment:'tank',lowerGarment:'shorts',footwear:'sandals'},
    {id:'retro',label:'Retro',upperGarment:'shirt',lowerGarment:'bellbottoms',footwear:'platforms'},
    {id:'weekend',label:'Weekend',upperGarment:'polo',lowerGarment:'shorts',footwear:'sneakers'},
    {id:'tracksuit',label:'Tracksuit',upperGarment:'hoodie',lowerGarment:'trackpants',footwear:'sneakers'},
    {id:'hooded',label:'Hood up',upperGarment:'hoodieup',lowerGarment:'jeans',footwear:'sneakers'},
    {id:'swim',label:'Swimwear',upperGarment:null,lowerGarment:'swimshorts',footwear:null}],
  female:[
    {id:'casual',label:'Casual',upperGarment:'tshirt',lowerGarment:'jeans',footwear:'sneakers'},
    {id:'office',label:'Office',upperGarment:'blouse',lowerGarment:'skirt',footwear:'heels',makeup:true},
    {id:'sport',label:'Sport',upperGarment:'sportstop',lowerGarment:'leggings',footwear:'sneakers'},
    {id:'winter',label:'Winter',upperGarment:'coat',lowerGarment:'jeans',footwear:'boots'},
    {id:'summer',label:'Summer',upperGarment:'dress',lowerGarment:null,footwear:'sandals',makeup:true},
    {id:'formal',label:'Formal',upperGarment:'gown',lowerGarment:null,footwear:'heels',makeup:true},
    {id:'smart',label:'Smart casual',upperGarment:'jacketopen',lowerGarment:'jeans',footwear:'boots',makeup:true},
    {id:'business',label:'Business',upperGarment:'jacket',lowerGarment:'skirt',footwear:'heels',makeup:true},
    {id:'waistcoat',label:'Shirt and vest',upperGarment:'vest',lowerGarment:'trousers',footwear:'shoes',makeup:true},
    {id:'beach',label:'Beach',upperGarment:'sportstop',lowerGarment:'shorts',footwear:'sandals'},
    {id:'retro',label:'Retro',upperGarment:'blouse',lowerGarment:'bellbottoms',footwear:'platforms',makeup:true},
    {id:'weekend',label:'Weekend',upperGarment:'tshirt',lowerGarment:'skirt',footwear:'sneakers'},
    {id:'tracksuit',label:'Tracksuit',upperGarment:'hoodie',lowerGarment:'trackpants',footwear:'sneakers'},
    {id:'hooded',label:'Hood up',upperGarment:'hoodieup',lowerGarment:'jeans',footwear:'sneakers'},
    {id:'swim',label:'Swimsuit',upperGarment:'swimsuit',lowerGarment:null,footwear:null},
    {id:'bikini',label:'Bikini',upperGarment:'bikinitop',lowerGarment:'bikinibottom',footwear:null}]
};

/* ── the rig ───────────────────────────────────────────────────────────── */
function build(d){
  const hk=d.height-1, wk=d.weight-1, j=d.joints;
  const H=[0.86,0.93,1,1.07,1.14][hk], HS=[0.96,0.98,1,1.02,1.04][hk], W=[0.82,0.91,1,1.14,1.3][wk]*(d.bodyType==='female'?0.93:1);
  /* pseudo-rotation: trunk narrows toward its depth, attachments slide to the centre line */
  const ct=Math.cos(d.torsoOrientation*Math.PI/180), cp=Math.cos(d.pelvisOrientation*Math.PI/180);
  const sX=[0.55,0.58,0.62,0.72,0.82][wk]; const kx=sX+(1-sX)*Math.abs(ct), kp=sX+(1-sX)*Math.abs(cp);   /* width factors: chest, pelvis */
  const fem=d.bodyType==='female';   /* narrower shoulders and waist, wider hips */
  const sw0=[33,36,38,41,45][wk]*(fem?0.87:1), hw0=[25,28,31,37,45][wk]*(fem?1.1:1);
  const cw=n2([27,30,32,37,43][wk]*kx*(fem?0.92:1)),
        sw=n2(sw0*kx*Math.abs(ct)+cw*0.8*(1-Math.abs(ct))),   /* in profile the shoulder corners tuck inside the chest */
        ww=n2([21,25,28,36,46][wk]*(kx+kp)/2*(fem?0.82:1)), hw=n2(hw0*kp);
  const nw=[8,8.5,9,10,11][wk], hx0=hw0*0.5, hx=hx0*cp, shx=(sw0-1)*ct;
  const nearLeg=d.pelvisOrientation<-30?1:d.pelvisOrientation>30?-1:0;
  const near=d.torsoOrientation<-30?1:d.torsoOrientation>30?-1:0;   /* which side faces the viewer */
  const WA=30*H, CH=84*H, UA=60*H, FA=54*H, TH=86*H, SH=82*H, FT=27.5;   /* feet: 22 × 1.25 */
  const skin=SKIN[d.skin-1].hex, hairHex=(HAIR.find(x=>x.id===d.hairColor)||HAIR[0]).hex;
  const C={skin, skinS:shade(skin,-0.28), lip:shade(skin,-0.42), hair:hairHex, brow:shade(hairHex,-0.25),
           suit:'#5d6b7a', suitS:'#414b56', trim:'#8a97a5'};
  const S=`fill="${C.skin}" stroke="${C.skinS}"`, U=`fill="${C.suit}" stroke="${C.suitS}"`;
  const parts=[], pts=[], piv={}, canes=[];
  const add=(z,m,svg,joint)=>parts.push({z,m,svg,joint});
  const mark=(m,x,y,r)=>{const p=Mx.pt(m,x,y);pts.push([p[0],p[1],r]);};

  const mRoot=Mx.tr([1,0,0,1,0,0],0,0,j.root);
  piv.root={p:[0,0],parent:0,up:true};
  /* pelvis swings from the waist, carrying the legs */
  const mP=Mx.mul(Mx.tr(mRoot,0,-WA,j.pelvis),[1,0,0,1,0,WA]);
  piv.pelvis={p:Mx.pt(mRoot,0,-WA),parent:j.root};
  const dye=(g,c)=>g&&{...g,col:c||g.col};
  const defs=[];
  const paint=(g,pat,c2)=>{ if(!g) return g; g.fill=g.col;
    /* side stripe: a band down the outside of sleeves and legs in the second colour (track pants always have one) */
    g.stripeCol=pat==='sidestripe'||(g.stripe&&(!pat||pat==='plain'))?(c2||colour2Default(g.col)):null;
    if(pat&&pat!=='plain'&&pat!=='sidestripe'){const id='hcp'+(++UID); defs.push(patDef(id,pat,g.col,c2||colour2Default(g.col))); g.fill=`url(#${id})`;}
    return g; };
  const UG0=paint(dye(UPPER[d.upperGarment],d.upperColor),d.upperPattern,d.upperColor2), LG0=paint(dye(LOWER[d.lowerGarment],d.lowerColor),d.lowerPattern,d.lowerColor2), FW=dye(FOOT[d.footwear],d.footwearColor);
  /* swimwear replaces the undersuit: bare skin shows instead. A bikini top brings its bottoms, and a woman in swim shorts gets a top. */
  const swim=!!((UG0&&UG0.swim)||(LG0&&LG0.swim));
  const UG=swim&&!UG0&&d.bodyType==='female'?{...UPPER.bikinitop,col:LG0.col,fill:LG0.fill}:UG0;
  const LG=swim&&!LG0&&UG0&&UG0.bikini?{...LOWER.bikinibottom,col:UG0.col,fill:UG0.fill}:LG0;
  const crop=!!(UG&&UG.crop);   /* a crop top bares the midriff, so the torso under it is skin, not undersuit */
  const skinTorso=crop||(swim&&(!UG||!!UG.bikini));
  /* socks: worn alone as footwear, and assumed under sneakers, shoes and boots (not sandals or heels) */
  const SG=UG&&UG.vest?{...UG,col:complement(UG.col),fill:complement(UG.col)}:UG;   /* sleeves: the shirt under a vest */
  const SK=FW?(FW.kind==='sock'?{col:FW.col}:FW.kind==='closed'?{col:d.sockColor||SOCK_COL}:null):null;
  const acc={}; d.accessories.forEach(a=>acc[a]=1);
  const GOLD='#e2b23a', GOLDS='#9c7716';
  const spark=(x,y,a)=>`<path transform="translate(${n2(x)} ${n2(y)})" d="M0,${-a}Q${n2(a*0.13)},${n2(-a*0.13)} ${a},0Q${n2(a*0.13)},${n2(a*0.13)} 0,${a}Q${n2(-a*0.13)},${n2(a*0.13)} ${-a},0Q${n2(-a*0.13)},${n2(-a*0.13)} 0,${-a}Z" fill="#fffbe0" stroke="${GOLD}" stroke-width=".8"/>`;
  const G=g=>`fill="${g.fill||g.col}" stroke="${edge(g.col)}"`;
  const st=Math.sin(d.torsoOrientation*Math.PI/180);
  /* Fitted garment parts are the body shape grown by the garment's offset (o). */
  const pelD=o=>`M${n2(-ww-o)},${n2(-WA-2)}L${n2(ww+o)},${n2(-WA-2)}Q${n2(hw+2+o)},${n2(-WA*0.4)} ${n2(hw+o)},3Q${n2(hw+o)},${18+o} 0,${16+o}Q${n2(-hw-o)},${18+o} ${n2(-hw-o)},3Q${n2(-hw-2-o)},${n2(-WA*0.4)} ${n2(-ww-o)},${n2(-WA-2)}Z`;
  const pel=(o,fill,stroke,faintTop)=>{const q=`fill="none" stroke="${stroke}"`, t=n2(-WA-2), m=n2(-WA*0.4);
    return `<path d="${pelD(o)}" fill="${fill}" stroke="none"/><path d="M${n2(ww+o)},${t}Q${n2(hw+2+o)},${m} ${n2(hw+o)},3M${n2(-ww-o)},${t}Q${n2(-hw-2-o)},${m} ${n2(-hw-o)},3" ${q}/>`
      +`<path d="M${n2(-ww-o)},${t}H${n2(ww+o)}" ${q}${faintTop?SEAM:''}/><path d="M${n2(hw+o)},3Q${n2(hw+o)},${18+o} 0,${16+o}Q${n2(-hw-o)},${18+o} ${n2(-hw-o)},3" ${q}${SEAM}/>`;};
  add(30,mP,(swim?pel(0,C.skin,C.skinS,skinTorso):pel(0,C.suit,C.suitS,!UG))+(LG?pel(LG.off,LG.fill,edge(LG.col),false):'')+(UG&&(UG.tails||UG.onepiece)?pel(UG.off,UG.fill,edge(UG.col),true):''),'pelvis');
  if(LG&&LG.stripeCol&&LG.thigh>0){ const X=(a,b)=>`M${n2(a)},${n2(-WA-1)}L${n2(b)},4`, k=Math.abs(cp), lo=LG.off;
    add(30.2,mP,`<path d="${X((ww+lo-3.2)*k,(hw+lo-3.2)*k)}${X(-(ww+lo-3.2)*k,-(hw+lo-3.2)*k)}" fill="none" stroke="${LG.stripeCol}" stroke-width="3"/>`,'pelvis'); }
  mark(mP,0,0,hw+2); mark(mP,0,6,12);

  /* chest */
  const mChest=Mx.tr(mRoot,0,-WA,j.torso);
  piv.torso={p:Mx.pt(mRoot,0,-WA),parent:j.root,up:true};
  const c=n2(CH);
  const chestSVG=(o,hem,fill,stroke,faintHem,bare)=>{
    const lft=`M${-nw-2},${n2(-c-4-o)}L${n2(-sw+4)},${n2(-c-o)}Q${n2(-sw-4-o)},${n2(-c+1-o)} ${n2(-sw-3-o)},${n2(-c+12)}L${n2(-cw-o)},${n2(-c+34)}Q${n2(-(ww+o)*1.06)},${n2(-c*0.35)} ${n2(-ww-o)},${hem}`;
    const rgt=`${n2(ww+o)},${hem}Q${n2((ww+o)*1.06)},${n2(-c*0.35)} ${n2(cw+o)},${n2(-c+34)}L${n2(sw+3+o)},${n2(-c+12)}Q${n2(sw+4+o)},${n2(-c+1-o)} ${n2(sw-4)},${n2(-c-o)}L${nw+2},${n2(-c-4-o)}`;
    const q=`fill="none" stroke="${stroke}"`;
    return `<path d="${lft}L${rgt}Z" fill="${fill}" stroke="none"/><path d="${lft}M${rgt}${bare?'':`L${-nw-2},${n2(-c-4-o)}`}" ${q}/><path d="M${n2(-ww-o)},${hem}H${n2(ww+o)}" ${q}${faintHem?SEAM:''}/>`;};
  /* navel: centred from the front, sliding to the facing edge in profile — distance by the average of the torso and pelvis cosines */
  const sp=Math.sin(d.pelvisOrientation*Math.PI/180), navX=((st+sp)<0?-1:1)*(ww-2)*(1-(Math.abs(ct)+Math.abs(cp))/2);
  /* Chest-front details (necklines, plackets, pockets, straps, bust arcs) share one transform as the torso turns:
     they narrow, and they lean toward the facing side — not at all at the collar, more the lower they are.
     So a neckline always stays round the neck, while a placket or pocket drifts to the front. */
  const co0=UG?UG.off:0, dKs=Math.max(Math.abs(ct),0.2), dSh=st*(cw+co0)*0.45/(c*0.75), dTop=-c-4-co0;
  /* the narrowing is anchored on the facing side of the neck: turning left keeps a neckline's left corner on the
     neck's left edge and pulls the right corner in, and the other way round */
  const dE=(st<0?-1:1)*(nw+3)*(1-dKs);
  const detailT=`matrix(${n2(dKs)} 0 ${n2(dSh)} 1 ${n2(dE-dSh*dTop)} 0)`, detailX=(x,y)=>dKs*x+dSh*(y-dTop)+dE;
  const co=UG?UG.off:0, cCol=UG?UG.fill:C.suit, cStr=UG?edge(UG.col):C.suitS;
  let chest=UG&&!UG.bikini&&!crop?chestSVG(co,UG.hem,UG.fill,edge(UG.col),!!(UG.tails||UG.onepiece))
    :(swim||crop)?chestSVG(0,3,C.skin,C.skinS,swim,true)+`<path d="M${n2(navX-1.6)},${n2(-c*0.14)}q1.6,2.2 3.2,0" fill="none" stroke="${C.skinS}" stroke-linecap="round"/>`
      +(crop?`<path d="M${-nw-2},${n2(-c-4-co)}L${n2(-sw+4)},${n2(-c-co)}Q${n2(-sw-4-co)},${n2(-c+1-co)} ${n2(-sw-3-co)},${n2(-c+12)}L${n2(-cw-co)},${n2(-c+34)}L${n2(-cw-co+1.8)},${n2(-c+56)}H${n2(cw+co-1.8)}L${n2(cw+co)},${n2(-c+34)}L${n2(sw+3+co)},${n2(-c+12)}Q${n2(sw+4+co)},${n2(-c+1-co)} ${n2(sw-4)},${n2(-c-co)}L${nw+2},${n2(-c-4-co)}Z" ${G(UG)}/>`
       :UG?`<path d="M${n2(-cw+0.6)},${n2(-c+41)}H${n2(cw-0.6)}" fill="none" stroke="${edge(UG.col)}" stroke-width="5"/><path d="M${n2(-cw+0.6)},${n2(-c+41)}H${n2(cw-0.6)}" fill="none" stroke="${UG.col}" stroke-width="3.2"/>`:'')
    :chestSVG(0,3,C.suit,C.suitS,!LG)+`<path d="M${-nw-2},${n2(-c-3)}L${nw+2},${n2(-c-3)}" stroke="${C.trim}" stroke-width="2.6" fill="none"/>`;
  if(fem&&Math.abs(st)>0.35){
    /* bust contour: a silhouette bump on the facing side, anchored on the torso's own edge */
    const dir=st<0?-1:1, hem=UG?UG.hem:3, p=13*W*Math.abs(st);
    const edge=y=>{                                   /* torso edge x at height y (one side) */
      if(y<=-c+34) return sw+3+co+(cw-sw-3)*(y+c-12)/22;
      const y0=-c+34,y1=-c*0.35; let a=0,b=1;
      for(let n=0;n<20;n++){const t=(a+b)/2,v=(1-t)*(1-t)*y0+2*t*(1-t)*y1+t*t*hem; if(v<y) a=t; else b=t;}
      const t=(a+b)/2; return (1-t)*(1-t)*(cw+co)+2*t*(1-t)*(ww+co)*1.06+t*t*(ww+co);
    };
    const ya=-c+20, yb=crop?-c+55:UG&&UG.bikini?-c+48:-c+56,   /* a crop top or bikini ends at its hem */
          xa=dir*(edge(ya)-0.6), xb=dir*(edge(yb)-0.6), xi=dir*(cw+co)*0.25;
    const curve=`M${n2(xa)},${n2(ya)}Q${n2(dir*(cw+co+p*1.7))},${n2((ya+yb)/2-1)} ${n2(xb)},${n2(yb)}`;
    if(UG&&UG.bikini){ const sd=`M${n2(xa)},${n2(ya)}L${dir*(nw+1)},${n2(-c-3)}`; chest+=`<path d="${sd}" fill="none" stroke="${cStr}" stroke-width="3.6"/><path d="${sd}" fill="none" stroke="${UG.col}" stroke-width="2"/>`; }
    chest+=UG&&UG.bikini?`<path d="${curve}Q${n2(dir*(cw+co)*0.1)},${n2((ya+yb)/2)} ${n2(xa)},${n2(ya)}Z" fill="${cCol}" stroke="${cStr}"/>`   /* a closed cup */
      :`<path d="${curve}L${n2(xi)},${n2(yb)}L${n2(xi)},${n2(ya)}Z" fill="${cCol}" stroke="none"/><path d="${curve}" fill="none" stroke="${cStr}" stroke-linecap="round"/>`;
  }
  {
    const g=UG||{off:0}, dk=UG?edge(g.col):C.suitS, top=-c-4-g.off; let s='';
    if(g.neck==='crew') s+=`<path d="M${-nw-2},${n2(top-1)}V${n2(top+1)}Q0,${n2(top+9)} ${nw+2},${n2(top+1)}V${n2(top-1)}Z" fill="${C.skin}" stroke="none"/><path d="M${-nw-2},${n2(top+1)}Q0,${n2(top+9)} ${nw+2},${n2(top+1)}" fill="none" stroke="${dk}" stroke-width="2.4"/>`;   /* skin shows inside the round neck */
    const opening=(dd,fill)=>`<path d="${dd}Z" fill="${fill}" stroke="none"/><path d="${dd}" fill="none" stroke="${dk}"/>`;   /* filled, outlined along its lower edge only: no seam across the neck */
    if(g.neck==='scoop') s+=opening(`M${-nw-5},${n2(top-1)}Q0,${n2(top+26)} ${nw+5},${n2(top-1)}`,C.skin);
    if(g.neck==='vneck') s+=opening(`M${-nw-3},${n2(top-1)}L0,${n2(top+24)}L${nw+3},${n2(top-1)}`,C.skin);
    if(g.neck==='lapel') s+=opening(`M${-nw-3},${n2(top-1)}L0,${n2(top+34)}L${nw+3},${n2(top-1)}`,'#ece8df')+`<path d="M0,${n2(top+34)}V${g.hem}" stroke="${dk}" fill="none"/>`
      +[0.4,0.16].map(k=>`<circle cx="5" cy="${n2(-c*k)}" r="1.9" fill="${dk}" stroke="none"/>`).join('');
    if(g.neck==='suit'||g.neck==='vest'){
      /* closed jacket: shirt shows in a V; the tie is drawn inside the V in the chest's own frame, so the jacket holds it */
      const a=nw+3, D=c*0.42, y0=n2(top-1);
      s+=opening(`M${-a},${y0}L0,${n2(top+D)}L${a},${y0}`,complement(g.col));
      if(acc.tie){
        const tc=d.tieColor||TIE_COL, k=0.04, yi=(a-2.2+k*8)/(k+a/D), xi=n2(a*(1-yi/D));   /* where the blade meets the V edge */
        s+=`<path d="M-3.4,${n2(top+2)}L3.4,${n2(top+2)}L2.2,${n2(top+8)}L${xi},${n2(top+yi)}L0,${n2(top+D)}L${-xi},${n2(top+yi)}L-2.2,${n2(top+8)}Z" fill="${tc}" stroke="${edge(tc)}"/><path d="M-2.2,${n2(top+8)}H2.2" fill="none" stroke="${edge(tc)}"/>`;
      }
      s+=(g.neck==='vest'?[]:[-1,1]).map(k=>`<path d="M${k*a},${y0}L0,${n2(top+D)}L${k*(a+9)},${n2(top+D*0.42)}Z" ${G(g)}/>`).join('')
        +`<path d="M0,${n2(top+D)}V${g.hem}" stroke="${dk}" fill="none"/>`+[10,24].map(y=>`<circle cx="4.5" cy="${n2(top+D+y)}" r="1.9" fill="${dk}" stroke="none"/>`).join('');
    }
    if(g.neck==='suitopen'){
      const a=nw+3, w1=n2((cw+co)*0.4), y0=n2(top-1), hh=g.hem-y0;
      s+=`<path d="M${-a},${y0}L${-w1},${g.hem}L${w1},${g.hem}L${a},${y0}Z" fill="${complement(g.col)}" stroke="none"/><path d="M${-a},${y0}L${-w1},${g.hem}M${w1},${g.hem}L${a},${y0}" fill="none" stroke="${dk}"/><path d="M0,${n2(top+8)}V${g.hem}" stroke="#b9b9b9" fill="none"/>`
        +[-1,1].map(k=>`<path d="M${k*a},${y0}L${n2(k*(a+(w1-a)*0.5))},${n2(y0+hh*0.5)}L${k*(a+11)},${n2(y0+hh*0.22)}Z" ${G(g)}/>`).join('');
    }
    if(g.neck==='hood'){   /* hoodie front: pouch pocket, drawstrings, and the folded hood round the neck when it is down */
      const py=n2(-c*0.36);
      s+=`<path d="M-13,${py}H13L18,${n2(g.hem-5)}H-18Z" fill="none" stroke="${dk}"/>`
        +(g.hoodUp?'':`<path d="M${-nw-10},${n2(top-3)}Q0,${n2(top+19)} ${nw+10},${n2(top-3)}L${nw+3},${n2(top-5)}Q0,${n2(top+9)} ${-nw-3},${n2(top-5)}Z" ${G(g)}/>`)
        +`<path d="M-4,${n2(top+9)}V${n2(top+27)}M4,${n2(top+9)}V${n2(top+24)}" fill="none" stroke="#f1f0ec" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    if(g.placket) s+=`<path d="M0,${n2(top+4)}V${n2(top+4+(g.hem-top-4)*g.placket)}" stroke="${dk}" fill="none"/>`;
    if(g.neck==='collar') s+=`<path d="M${-nw-1},${n2(top-1)}L0,${n2(top+9)}L${nw+1},${n2(top-1)}Z" fill="${C.skin}" stroke="none"/>`+[-1,1].map(k=>`<path d="M${k*(nw+3)},${n2(top-1)}L0,${n2(top+6)}L${k*(nw-1)},${n2(top+14)}Z" ${G(g)}/>`).join('');
    if(fem&&Math.abs(ct)>0.3){   /* front view of the bust: two arcs, as deep (0.85 × 13·W) as the profile bump sticks out */
      const bx=n2((cw+co)*0.47), h=n2(Math.min(15,(cw+co)*0.44)), y0=n2(-c+38), dp=n2(13*W*1.7), a=x=>`M${n2(x-h)},${y0}Q${n2(x)},${n2(y0+dp)} ${n2(x+h)},${y0}`;
      const xs=Math.abs(st)>0.35?[(st<0?1:-1)*bx]:[-bx,bx];   /* turned: one arc here + the silhouette bump = two, never three */
      if(UG&&UG.bikini){   /* bikini: straps run from the collar to the tip of each cup; the cup's lower edge is the bust arc */
        const strap=x=>`M${n2(x*0.82)},${n2(y0-17)}L${(x<0?-1:1)*(nw+3)},${n2(-c-3)}`;
        s+=xs.map(x=>`<path d="${strap(x)}" fill="none" stroke="${edge(UG.col)}" stroke-width="3.6"/><path d="${strap(x)}" fill="none" stroke="${UG.col}" stroke-width="2"/><path d="${a(x)}L${n2(x*0.82)},${n2(y0-17)}Z" ${G(UG)}/>`).join('');
      }
      s+=`<path d="${xs.map(a).join('')}" fill="none" stroke="${cStr}" stroke-opacity="${n2(Math.abs(ct))}" stroke-linecap="round"/>`;
    }
    /* see detailT above */
    if(s) chest+=`<g transform="${detailT}">${s}</g>`;
  }
  add(40,mChest,chest,'torso');
  if(UG&&UG.neck==='hood'&&!UG.hoodUp) add(34.5,mChest,`<ellipse cx="0" cy="${n2(-c-7-co)}" rx="${n2(nw+12)}" ry="10" ${G(UG)}/>`,'torso');   /* the hood lying behind the neck */
  if(acc.backpack){
    /* pack sits behind the torso and slides to the back as the torso turns; straps cross the chest; the loose ends hang */
    const pc=d.packColor||PACK_COL, pe=edge(pc), e=cw+co, pw=n2(e*0.95*(0.45+0.55*Math.abs(ct))), px=n2(-st*(e+pw-3)), yt=n2(-c+4), yb=n2(-c*0.1);
    add(28.5,mChest,`<path d="M${px-pw},${yt+8}Q${px-pw},${yt-8} ${px},${yt-10}Q${px+pw},${yt-8} ${px+pw},${yt+8}V${yb-6}Q${px+pw},${yb} ${px+pw-6},${yb}H${px-pw+6}Q${px-pw},${yb} ${px-pw},${yb-6}Z" fill="${pc}" stroke="${pe}"/><path d="M${n2(px-pw*0.6)},${n2(yb-26)}H${n2(px+pw*0.6)}V${n2(yb-8)}H${n2(px-pw*0.6)}Z" fill="${shade(pc,-0.15)}" stroke="${pe}"/>`,'torso');
    const ys=n2(-c*0.5);
    add(41.2,mChest,`<g transform="${detailT}">`+[-1,1].map(k=>{const dd=`M${n2(k*sw*0.6)},${n2(-c-co-1)}Q${n2(k*e*0.95)},${n2(-c+18)} ${n2(k*e*0.82)},${ys}`;
      return `<path d="${dd}" fill="none" stroke="${pe}" stroke-width="6.4"/><path d="${dd}" fill="none" stroke="${pc}" stroke-width="4.4"/>`;}).join('')+'</g>','torso');
    for(const k of [-1,1]){ const p=Mx.pt(mChest,detailX(k*e*0.82,-c*0.5),-c*0.5);
      add(41.3,[1,0,0,1,p[0],p[1]],`<path d="M0,0V16" fill="none" stroke="${pe}" stroke-width="3.8"/><path d="M0,0V16" fill="none" stroke="${pc}" stroke-width="2.2"/>`,'torso'); }
  }
  if(acc.fannypack){
    const pc=d.packColor||PACK_COL, pe=edge(pc), o=Math.max(LG?LG.off:0,UG&&UG.tails?UG.off:0)+0.8, sp=Math.sin(d.pelvisOrientation*Math.PI/180);
    const y=n2(-WA+9), bw=n2((ww+hw)/2+o+1), pw=n2(13*(0.55+0.45*Math.abs(cp))), px=n2(sp*(bw-4));
    add(41.4,mP,`<path d="M${-bw},${y-2.5}H${bw}V${y+2.5}H${-bw}Z" fill="${pc}" stroke="${pe}"/><rect x="${n2(px-pw)}" y="${y-5}" width="${n2(pw*2)}" height="15" rx="6" fill="${pc}" stroke="${pe}"/><path d="M${n2(px-pw+3.5)},${y+1}H${n2(px+pw-3.5)}" fill="none" stroke="${pe}"/>`,'pelvis');
  }
  if(acc.necklace){   /* its own layer, above every garment and the tie */
    const top=-c-4-co;
    add(41.5,mChest,`<g transform="${detailT}"><path d="M${-nw-1},${n2(top+1)}Q0,${n2(top+24)} ${nw+1},${n2(top+1)}" fill="none" stroke="${GOLDS}" stroke-width="3.2"/><path d="M${-nw-1},${n2(top+1)}Q0,${n2(top+24)} ${nw+1},${n2(top+1)}" fill="none" stroke="${GOLD}" stroke-width="1.9"/><circle cx="0" cy="${n2(top+13)}" r="3.6" fill="${GOLD}" stroke="${GOLDS}" stroke-width="1"/>${spark(6.5,top+8,5)}</g>`,'torso');
  }
  if(acc.tie&&!(UG&&(UG.neck==='suit'||UG.neck==='vest'))){
    /* necktie: pinned at the collar but drawn in an unrotated frame, so it always hangs straight down */
    const tc=d.tieColor||TIE_COL, p=Mx.pt(mChest,detailX(0,-c-co+1),-c-co+1), k=n2(Math.max(Math.abs(ct),0.45)), L=n2(c*1.05);   /* 0.6 × 1.75 */
    add(41,[1,0,0,1,p[0],p[1]],`<g transform="scale(${k} 1)"><path d="M-3.4,0L3.4,0L2.2,6L5.2,${n2(L-9)}L0,${L}L-5.2,${n2(L-9)}L-2.2,6Z" fill="${tc}" stroke="${edge(tc)}"/><path d="M-2.2,6H2.2" fill="none" stroke="${edge(tc)}"/></g>`,'torso');
    mark([1,0,0,1,p[0],p[1]],0,L,4);
  }
  /* waist ball: sits under both pieces and fills the wedge when they bend apart */
  add(29,mChest,`<circle cx="0" cy="0" r="${n2(ww+co+0.5)}" ${skinTorso?S:UG?G(UG):U}/>`,'torso'); mark(mChest,0,0,ww);
  mark(mChest,-sw,-CH+8,10); mark(mChest,sw,-CH+8,10); mark(mChest,0,-CH*0.4,ww);

  /* neck + head */
  const mNeck=Mx.tr(mChest,0,-CH-2,j.neck*0.5), mSkull=Mx.tr(mNeck,0,-16,j.neck*0.5);   /* half the tilt at the base of the neck, half under the skull */
  piv.neck={p:Mx.pt(mChest,0,-CH-2),parent:j.root+j.torso,up:true};
  add(35,mNeck,`<circle cx="0" cy="4" r="${n2(nw+2)}" fill="${C.skin}" stroke="none"/><path d="M${-nw-1},-22Q${n2(-nw+2)},-9 ${n2(-nw-4)},5L${n2(nw+4)},5Q${n2(nw-2)},-9 ${nw+1},-22Z" fill="${C.skin}" stroke="none"/><path d="M${-nw-1},-22Q${n2(-nw+2)},-9 ${n2(-nw-4)},5M${n2(nw+4)},5Q${n2(nw-2)},-9 ${nw+1},-22" fill="none" stroke="${C.skinS}"/><circle cx="0" cy="-16" r="${n2(nw+1)}" fill="${C.skin}" stroke="none"/>`,'neck');   /* flared neck with round patches at the collar and under the skull */
  if(acc.choker) add(35.5,mNeck,`<path d="M${n2(-nw-0.4)},-9Q0,-6.5 ${n2(nw+0.4)},-9V-5Q0,-2.5 ${n2(-nw-0.4)},-5Z" fill="#1b1b1b" stroke="#000" stroke-width=".8"/><circle cx="0" cy="-3.6" r="2.2" fill="${GOLD}" stroke="${GOLDS}" stroke-width=".8"/>`,'neck');   /* a band round the neck with a small pendant */
  const flip=d.head==='right'?-1:1;
  const mHead=Mx.mul(mSkull,[HS*flip,0,0,HS,0,-50*HS+16]);
  const hd=headSVG(d,C);
  if(hd.back) add(0,mHead,hd.back,'neck');
  if(hd.hoodBack) add(0.7,mHead,hd.hoodBack,'neck');
  add(50,mHead,hd.front,'neck');
  /* bob, long hair and ponytail: each piece is pinned at its own point on the head but drawn unrotated, so it stays attached and falls straight down */
  for(const g of hd.hang){ const p=Mx.pt(mHead,g.x,g.y); add(g.front?50.5:0.5,[HS*flip,0,0,HS,p[0],p[1]],g.svg,'neck'); }


  if(hd.top) add(50.7,mHead,hd.top,'neck');
  for(const g of hd.drops){ const p=Mx.pt(mHead,g.x,g.y); add(50.8,[HS*flip,0,0,HS,p[0],p[1]],g.svg,'neck'); }
  mark(mHead,0,0,d.hairStyle==='afro'?52:40); if(d.headwear) mark(mHead,0,-8,d.headwear==='sunhat'?56:45);

  /* arms */
  for(const [side,L] of [[-1,'R'],[1,'L']]){
    /* arm order. A guitar, bass, violin or mandolin sits just above the forearm that holds it; that arm is
       drawn first, so the other arm and hand (and a bow) come out in front of the instrument */
    const strung=h=>{const t=ITEMS[d.held[h]]; return !!(t&&t.behindArms);};
    const low=near?0:strung('left')&&!strung('right')?1:strung('right')&&!strung('left')?-1:0;
    const z=near&&side!==near?10:near?70:low?(side===low?60:70):(side===1?70:60);
    const base=j.root+j.torso, s=j['shoulder'+L], e=j['elbow'+L], w=j['wrist'+L];
    const sx=side*shx, sy=-CH+12;
    const m1=Mx.tr(mChest,sx,sy,s), m2=Mx.tr(m1,0,UA,e), m3=Mx.tr(m2,0,FA,w);
    piv['shoulder'+L]={p:Mx.pt(mChest,sx,sy),parent:base};
    piv['elbow'+L]={p:Mx.pt(m1,0,UA),parent:base+s};
    piv['wrist'+L]={p:Mx.pt(m2,0,FA),parent:base+s+e};
    const r1=11*W,r2=9*W,r3=7*W;
    const ao=UG?Math.min(UG.off,3):0;
    if(z>40) add(39,mChest,under(sx,sy,r1+(UG?(UG.arm>=1?ao:UG.arm>0?ao+0.5:0):0.5),UG?(UG.arm>0?edge(UG.col):C.skinS):swim?C.skinS:C.suitS));
    const full=UG&&UG.arm>=1;
    add(z+1,m1,under(0,UA,r2+(full?ao:0),full?edge(UG.col):C.skinS)+limb(r1,r2,UA,C.skin,C.skinS,'t')+(UG
      ?(UG.arm>=1?limb(r1+ao,r2+ao,UA,SG.fill,edge(SG.col),'t'):UG.arm>0?cuffed(r1+ao,r2+ao,UA,UG.arm,SG.fill,edge(SG.col),true):'')
      :swim?'':cuffed(r1,r2,UA,0.55,C.suit,C.suitS,true)+`<path d="M${n2(-r1+(r1-r2)*0.55-0.5)},${n2(UA*0.55)}H${n2(r1-(r1-r2)*0.55+0.5)}" stroke="${C.trim}" stroke-width="2.2" fill="none"/>`),'shoulder'+L);
    if(acc['elbowpad'+L]) add(z+2.5,m1,`<rect x="${n2(-r2-3.2)}" y="${n2(UA-13)}" width="${n2(r2*2+6.4)}" height="26" rx="8" fill="#3a3f45" stroke="#16181b"/><ellipse cx="0" cy="${n2(UA)}" rx="${n2(r2*0.7)}" ry="7.5" fill="#6b7279" stroke="#16181b" stroke-width=".8"/>`,'elbow'+L);   /* over the elbow, above both arm segments */
    if(UG&&UG.stripeCol&&UG.arm>0){ const k=Math.abs(ct), sl=(ra,rb,len,f)=>`<path d="M${n2(side*(ra+ao-3.2)*k)},2L${n2(side*(ra+(rb-ra)*f+ao-3.2)*k)},${n2(len*f-1)}" fill="none" stroke="${UG.stripeCol}" stroke-width="3" stroke-linecap="round"/>`;
      add(z+1.2,m1,sl(r1,r2,UA,Math.min(UG.arm,1)),'shoulder'+L); if(UG.fore) add(z+2.2,m2,sl(r2,r3,FA,UG.fore),'elbow'+L); }
    add(z+2,m2,limb(r2,r3,FA,C.skin,C.skinS,'t')+(UG&&UG.fore?cuffed(r2+ao,r3+ao,FA,UG.fore,SG.fill,edge(SG.col),true):'')
      +(acc['watch'+L]?`<rect x="${n2(-r3-1.2)}" y="${n2(FA-10)}" width="${n2(r3*2+2.4)}" height="6" rx="1.5" fill="#2b2b2b" stroke="#111" stroke-width=".8"/><circle cx="0" cy="${n2(FA-7)}" r="4.3" fill="#f4f4f2" stroke="#6d7278" stroke-width="1.2"/><path d="M0,${n2(FA-9.5)}V${n2(FA-7)}H1.8" fill="none" stroke="#333" stroke-width=".8"/>`:'')
      +(acc['bracelet'+L]?`<path d="M${n2(-r3-1)},${n2(FA-6)}H${n2(r3+1)}" stroke="${GOLD}" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M${n2(-r3-1)},${n2(FA-6)}H${n2(r3+1)}" stroke="${GOLDS}" stroke-width=".6" stroke-dasharray="1.5 2" fill="none"/>`+spark(side*(r3+5.5),FA-10,4.5):''),'elbow'+L);
    const hs=Math.min(W,1.12);
    const palm=(a,b)=>{const x=n2(a*Math.sqrt(1-16/(b*b)));   /* the arc lying over the wrist is a seam */
      return `<ellipse cx="0" cy="9" rx="${a}" ry="${b}" fill="${C.skin}" stroke="none"/><path d="M${-x},5A${a},${b} 0 1 0 ${x},5" fill="none" stroke="${C.skinS}"/><path d="M${-x},5A${a},${b} 0 0 1 ${x},5" fill="none" stroke="${C.skinS}"${SEAM}/>`;};
    /* thumb edge: turned torso → the far arm flips; front torso → whichever edge of the hand faces the body */
    let ts=side;
    if(near){ if(side!==near) ts=-side; }
    else { const hp=Mx.pt(m3,0,7), bc=Mx.pt(mChest,0,-CH*0.5); ts=(m3[0]*(bc[0]-hp[0])+m3[1]*(bc[1]-hp[1]))>=0?-1:1; }   /* the arm behind the body shows its thumb on the other edge */
    if(d['thumbFlip'+L]) ts=-ts;   /* manual override: put the thumb on the other edge of this hand */
    const GL=acc['gloves'+L]?{col:d.gloveColor||GLOVE_COL}:null;
    add(z+4,m3,GL?`<ellipse cx="${n2(-ts*6.2*hs)}" cy="7" rx="3.6" ry="6.5" transform="rotate(${ts*24} ${n2(-ts*6.2*hs)} 7)" ${G(GL)}/><ellipse cx="0" cy="9" rx="${n2(7.6*hs+0.8)}" ry="${n2(10.2*hs+0.8)}" ${G(GL)}/><rect x="${n2(-r3-2)}" y="-5" width="${n2(r3*2+4)}" height="8" rx="2.5" ${G(GL)}/>`
      :`<ellipse cx="${n2(-ts*6.2*hs)}" cy="7" rx="3.3" ry="6.2" transform="rotate(${ts*24} ${n2(-ts*6.2*hs)} 7)" ${S}/>${palm(n2(7.6*hs),n2(10.2*hs))}`
      +(acc['ring'+L]&&!GL?`<path d="M-3.5,14.5H5.5" stroke="${GOLDS}" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M-3.5,14.5H5.5" stroke="${GOLD}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`
        +`<path transform="translate(${side*8.5} 8.5)" d="M0,-7Q0.9,-0.9 7,0Q0.9,0.9 0,7Q-0.9,0.9 -7,0Q-0.9,-0.9 0,-7Z" fill="#fffbe0" stroke="${GOLD}" stroke-width=".8"/><path transform="translate(${side*14} 1.5)" d="M0,-3.2Q0.4,-0.4 3.2,0Q0.4,0.4 0,3.2Q-0.4,0.4 -3.2,0Q-0.4,-0.4 0,-3.2Z" fill="#fffbe0" stroke="${GOLD}" stroke-width=".6"/>`:''),'wrist'+L);
    mark(m1,0,0,r1); mark(m2,0,0,r2); mark(m3,0,0,r3); mark(m3,0,12,9);
    const it=ITEMS[d.held[side>0?'left':'right']], ic=it&&(d[side>0?'heldLeftColor':'heldRightColor']||it.col);
    const gsel=d[side>0?'heldLeftGrip':'heldRightGrip'], grip=it?(gsel===null||gsel===undefined?(it.grip||0):gsel):0;
    if(it){
      const g=Mx.pt(m3,0,10);
      add(z+3, it.upright?[1,0,0,1,g[0],g[1]]:Mx.tr(m3,0,10,-side*grip), it.cane?'':it.draw(side,ic), 'wrist'+L);
      if(it.cane) canes.push({part:parts[parts.length-1],gy:g[1],side,c:ic,it,mh:Mx.mul(m3,[1,0,0,1,0,10])});
    }
  }

  /* legs — not drawn at all inside a car */
  const noLegs=d.prop==='car', addL=noLegs?()=>{}:add, markL=noLegs?()=>{}:mark;
  for(const [side,L] of [[-1,'R'],[1,'L']]){
    const z=side===(nearLeg||1)?24:20, base=j.root+j.pelvis;
    const h=j['hip'+L], k=j['knee'+L], a=j['ankle'+L];
    /* high heels tip the foot 20° toe-down, so at a flat-foot ankle angle the heel tip and the toe both reach the floor */
    const pitch=FW&&FW.kind==='pump'?(wrapDeg(base+h+k+a)>=0?20:-20):0;
    const m1=Mx.tr(mP,side*hx,2,h), m2=Mx.tr(m1,0,TH,k), m3=Mx.tr(m2,0,SH,a-pitch);
    piv['hip'+L]={p:Mx.pt(mP,side*hx,2),parent:base};
    piv['knee'+L]={p:Mx.pt(m1,0,TH),parent:base+h};
    piv['ankle'+L]={p:Mx.pt(m2,0,SH),parent:base+h+k};
    const r1=Math.min(15*W,hx0+2+(W>1?4:0)), r2=11.5*W, r3=8*W, fs=Math.min(W,1.12);
    const lo=LG?LG.off:0, fa=7*fs, fb=6.8*fs   /* slim toes */;
    /* lower section of a capsule from y0 to its end (boot shafts, pumps) */
    const lower=(ra,rb,len,y0,o)=>{const r0=ra+(rb-ra)*y0/len+o; return `M${n2(-r0)},${n2(y0)}L${n2(r0)},${n2(y0)}L${n2(rb+o)},${n2(len)}A${n2(rb+o)},${n2(rb+o)} 0 0 1 ${n2(-rb-o)},${n2(len)}Z`;};
    const lowS=(ra,rb,len,y0,o,g)=>{const r0=n2(ra+(rb-ra)*y0/len+o), rb2=n2(rb+o), q=`fill="none" stroke="${edge(g.col)}"`;
      return `<path d="${lower(ra,rb,len,y0,o)}" fill="${g.fill||g.col}" stroke="none"/><path d="M${rb2},${n2(len)}L${r0},${n2(y0)}L${-r0},${n2(y0)}L${-rb2},${n2(len)}" ${q}/><path d="M${rb2},${n2(len)}A${rb2},${rb2} 0 0 1 ${-rb2},${n2(len)}" ${q}${SEAM}/>`;};
    let shoe='';
    if(FW){
      const dk=edge(FW.col);
      /* sg = which side of the foot is the sole, from the way the foot points */
      const wf=wrapDeg(base+h+k+a), sg=wf>=0?1:-1, P=FW.platform||0;
      if(P){ shoe=`<path d="M${sg*2},-7L${n2(sg*(fa+FW.off+P))},-7L${n2(sg*(fb+FW.off+P))},${n2(FT+fb)}L${sg*2},${n2(FT+fb+FW.off)}Z" fill="${shade(FW.col,-0.4)}" stroke="${edge(FW.col)}"/>`; markL(m3,sg*(fb+FW.off+P),FT*0.5,2); }
      if(FW.kind==='pump'){   /* spike heel, swung 30° toward the toe so heel tip and toe can rest on the floor together */
        const px=sg*fa*0.6, py=2, an=sg*Math.PI/6, dx=sg*(0.4*fa+12), dy=-0.5;
        shoe=`<path transform="rotate(${sg*30} ${n2(px)} ${py})" d="M${n2(sg*fa*0.4)},-4L${n2(sg*(fa+12))},-0.5L${n2(sg*(fa+12))},3L${n2(sg*fa*0.8)},9Z" ${G(FW)}/>`;
        markL(m3,px+dx*Math.cos(an)-dy*Math.sin(an),py+dx*Math.sin(an)+dy*Math.cos(an),1.5); }
      if(FW.kind==='closed') shoe+=`<path d="${capsule(fa+FW.off,fb+FW.off,FT)}" ${G(FW)}/>`
        +(FW.accent?`<path d="M${n2(-fb-FW.off)},${n2(FT*0.8)}H${n2(fb+FW.off)}" stroke="${FW.accent}" stroke-width="2.4" fill="none"/>`:'');
      if(FW.kind==='pump') shoe+=`<path d="${lower(fa,fb,FT,9,FW.off)}" ${G(FW)}/>`;
      if(FW.kind==='sandal') shoe=`<path d="M${n2(-fa-1.5)},5H${n2(fa+1.5)}M${n2(-fb-0.5)},${FT-4}H${n2(fb+0.5)}" stroke="${FW.col}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`;
    }
    addL(z+1,m3,under(0,0,r3+(FW&&FW.kind!=='sandal'?FW.off:SK?0.8:0),FW&&FW.kind!=='sandal'?edge(FW.col):SK?edge(SK.col):C.skinS)+`<path d="${capsule(fa,fb,FT)}" ${S}/>`+(SK?`<path d="${capsule(fa+0.8,fb+0.8,FT)}" ${G(SK)}/>`:'')+shoe,'ankle'+L);
    addL(z+2,m2,under(0,0,r2+(LG&&LG.thigh>=1?lo:0),LG&&LG.thigh>=1?edge(LG.col):C.skinS)+limb(r2*0.96,r3,SH,C.skin,C.skinS,'b')
      +(SK?lowS(r2*0.96,r3,SH,Math.max(SH*0.74,LG&&LG.shin?SH*LG.shin:0),0.8,SK):'')   /* never over a trouser leg */
      +(LG&&LG.shin?(LG.bell?(()=>{const a=n2(r2*0.96+lo+0.5), rk=n2((r2*0.96+r3)/2+lo), rb=n2(r3+lo+LG.bell), yk=n2(SH*0.42), yb=n2(SH*LG.shin);   /* flared leg */
          return `<path d="M${-a},0A${a},${a} 0 0 1 ${a},0L${rk},${yk}L${rb},${yb}L${-rb},${yb}L${-rk},${yk}Z" ${G(LG)}/>`;})()
        :`<path d="${sleeve(r2*0.96+lo,r3+lo,SH,LG.shin)}" ${G(LG)}/>`):'')
      /* heel ball: the rounded ankle end takes the shoe's colour */
      +(FW&&FW.kind!=='sandal'&&FW.kind!=='sock'&&!FW.shaft?lowS(r2*0.96,r3,SH,SH,FW.off,FW):'')
      +(FW&&FW.shaft?lowS(r2*0.96,r3,SH,SH*(1-FW.shaft),FW.off,FW):''),'knee'+L);
    addL(z+3,m1,limb(r1,r2,TH,C.skin,C.skinS,'b')+(LG
      ?(LG.thigh>=1?limb(r1+lo,r2+lo,TH,LG.fill,edge(LG.col),'b'):LG.thigh>0?`<path d="${sleeve(r1+lo,r2+lo,TH,LG.thigh)}" ${G(LG)}/>`:'')
      :swim?'':`<path d="${sleeve(r1,r2,TH,0.6)}" ${U}/><path d="M${n2(-r1+(r1-r2)*0.6-0.5)},${n2(TH*0.6)}H${n2(r1-(r1-r2)*0.6+0.5)}" stroke="${C.trim}" stroke-width="2.2" fill="none"/>`),'hip'+L);
    if(acc['kneepad'+L]) addL(z+3.5,m1,`<rect x="${n2(-r2-3.5)}" y="${n2(TH-15)}" width="${n2(r2*2+7)}" height="30" rx="9" fill="#3a3f45" stroke="#16181b"/><ellipse cx="0" cy="${n2(TH)}" rx="${n2(r2*0.7)}" ry="8.5" fill="#6b7279" stroke="#16181b" stroke-width=".8"/>`,'knee'+L);
    if(LG&&LG.cargo){ const k=Math.abs(cp), w=n2(11*Math.max(k,0.55)), px=n2(side*(r1*0.5+lo)*k-w/2), py=n2(TH*0.46), dk=edge(LG.col);   /* a patch pocket on the outside of each thigh */
      addL(z+3.3,m1,`<rect x="${px}" y="${py}" width="${w}" height="24" rx="1.5" fill="${LG.fill}" stroke="${dk}"/><path d="M${px},${n2(py+7)}h${w}" fill="none" stroke="${dk}"/>`,'hip'+L); }
    if(LG&&LG.stripeCol&&LG.thigh>0){ const k=Math.abs(cp), sl=(ra,rb,len,f)=>`<path d="M${n2(side*(ra+lo-3.2)*k)},2L${n2(side*(ra+(rb-ra)*f+lo-3.2)*k)},${n2(len*f-1)}" fill="none" stroke="${LG.stripeCol}" stroke-width="3" stroke-linecap="round"/>`;
      addL(z+3.2,m1,sl(r1,r2,TH,Math.min(LG.thigh,1)),'hip'+L); if(LG.shin) addL(z+2.2,m2,sl(r2*0.96,r3,SH,LG.shin),'knee'+L); }
    markL(m1,0,0,r1); markL(m2,0,0,r2); markL(m3,0,0,r3); markL(m3,0,FT,6.8*fs);
  }

  /* loose parts — skirts, coat tails, dress skirts: one panel hung from the hips
     that follows the legs' average direction and widens as they spread */
  const panel=(g,lenF,flare,z,open)=>{
    const tr1=Math.min(15*W,hx0+2+(W>1?4:0)), tr2=11.5*W, o=g.off, tw=n2(hw+o), fc=g.fill||g.col, ec=edge(g.col);
    const diff=((j.hipL-j.hipR+540)%360)-180, mean=j.hipR+diff/2, sp=Math.min(Math.abs(diff)/2,65)*Math.PI/180;
    /* a panel longer than the thigh is made in two pieces, hinged at the knees */
    const long=lenF>1, f1=Math.min(lenF,1), len=n2(TH*f1), fl1=long?flare/lenF:flare;
    const bw=n2(Math.max(Math.abs(hx)+len*Math.tan(sp)+tr1+(tr2-tr1)*f1+o+fl1, tw*0.92+fl1));
    const m=Mx.tr(mP,0,2,mean), top=`M${-tw},0Q${-tw},-10 0,-10Q${tw},-10 ${tw},0`, hem=y=>`Q0,${n2(y+5)} `;
    add(z,m,`<path d="${top}L${bw},${len}${long?'':hem(len)}${long?'L':''}${-bw},${len}Z" fill="${fc}" stroke="none"/>`
      +(long?`<path d="M${tw},0L${bw},${len}M${-bw},${len}L${-tw},0" fill="none" stroke="${ec}"/>`
            :`<path d="M${tw},0L${bw},${len}${hem(len)}${-bw},${len}L${-tw},0" fill="none" stroke="${ec}"/>`)
      +(g.pleats&&!long?`<path d="${[-3,-2,-1,0,1,2,3].map(i=>`M${n2(tw*i/4)},-4L${n2(bw*i/4)},${n2(len+(1-Math.abs(i)/4)*3)}`).join('')}" fill="none" stroke="${ec}" stroke-width=".9"/>`:'')   /* pleats fan out from the waist */
      +`<path d="${top}" fill="none" stroke="${ec}"${SEAM}/>`
      +(open?`<path d="M${n2(st*tw*0.45)},-8V${n2(len+2)}" stroke="${ec}" fill="none"/>`:''),'pelvis');
    mark(m,-bw,len,3); mark(m,bw,len,3);
    if(long){
      /* below the knee: follows the average direction of the shins, so the skirt bends when the character sits */
      const sL=j.hipL+j.kneeL, sR=j.hipR+j.kneeR, d2=((sL-sR+540)%360)-180, mean2=sR+d2/2, sp2=Math.min(Math.abs(d2)/2,65)*Math.PI/180;
      const len2=n2(TH*(lenF-1)), m2=Mx.tr(m,0,len,mean2-mean), bw2=n2(bw+len2*Math.tan(sp2)*0.6+(flare-fl1));
      add(z-0.2,m2,`<circle cx="0" cy="0" r="${bw}" fill="${fc}" stroke="${ec}"/>`,'pelvis');   /* round piece at the knees fills the outside of the bend */
      add(z-0.1,m2,`<path d="M${-bw},0L${bw},0L${bw2},${len2}${hem(len2)}${-bw2},${len2}Z" fill="${fc}" stroke="none"/><path d="M${bw},0L${bw2},${len2}${hem(len2)}${-bw2},${len2}L${-bw},0" fill="none" stroke="${ec}"/>`,'pelvis');
      mark(m2,-bw2,len2,3); mark(m2,bw2,len2,3);
    }
  };

  if(!noLegs&&LG&&LG.skirt) panel(LG,LG.skirt,LG.flare||0,31);
  if(!noLegs&&UG&&UG.tails) panel(UG,UG.tails,UG.flare||0,32,UG.neck==='lapel'||UG.neck==='suit'||UG.neck==='suitopen');

  if(PROPS[d.prop]){
    let g0=-1e9; for(const [,py,r] of pts) g0=Math.max(g0,py+r);
    const hip=Mx.pt(mP,0,0), po=d.pelvisOrientation;
    const list=propSVG(d.prop,d.propColor||PROPS[d.prop].col,{x:hip[0],y:hip[1],g:g0,side:Math.abs(po)>=45,dir:po>0?1:po<0?-1:(d.head==='right'?1:-1),hw});
    for(const p of list){ parts.push({z:p.z,m:[1,0,0,1,0,0],svg:p.svg});
      if(p.bottom!==undefined) pts.push([hip[0],p.bottom-1,1]);                       /* bicycle and car wheels become the floor */
      if(p.span){ pts.push([hip[0]-p.span,g0-10,1]); pts.push([hip[0]+p.span,g0-10,1]); } }   /* keep wide props inside a cropped drawing */
  }
  if(canes.length){
    /* a cane reaches from the hand to the floor, up to half the character's height.
       If the hand is higher than that, the cane leaves the floor and simply follows the hand. */
    let gy=-1e9; for(const [,y,r] of pts) gy=Math.max(gy,y+r);
    const maxLen=(TH+SH+FT*0.8+WA+CH+2+86*HS)/2;
    for(const cn of canes){ const need=gy-cn.gy;
      if(need<=maxLen&&need>=maxLen*0.35) cn.part.svg=cn.it.draw(cn.side,cn.c,need);   /* also let go of the floor when the hand is too low for a sensible cane */
      else { cn.part.m=cn.it.across?Mx.tr(cn.mh,0,0,cn.mh[1]>=0?-90:90):cn.mh;   /* across: the pole crosses the fist, base toward the floor */
             cn.part.svg=cn.it.draw(cn.side,cn.c,maxLen); } }
  }
  parts.sort((a,b)=>a.z-b.z);
  const inner=parts.map(p=>`<g transform="matrix(${p.m.map(n2).join(' ')})"${p.joint?` data-joint="${p.joint}"`:''}>${p.svg}</g>`).join('');
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const [x,y,r] of pts){x0=Math.min(x0,x-r);y0=Math.min(y0,y-r);x1=Math.max(x1,x+r);y1=Math.max(y1,y+r);}
  return {inner,piv,box:[x0,y0,x1,y1],defs:defs.length?`<defs>${defs.join('')}</defs>`:''};
}

const STAGE={w:600,h:590,cx:300,ground:550};

function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function render(data,opts){
  opts=opts||{}; const d=normalize(data), b=build(d);
  const wrap=`stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"`;
  const title=`<title>${esc(d.name)}</title>`;
  if(opts.fit){
    const pad=8,[x0,y0,x1,y1]=b.box;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n2(x0-pad)} ${n2(y0-pad)} ${n2(x1-x0+pad*2)} ${n2(y1-y0+pad*2)}" role="img">${title}${b.defs}<g ${wrap}>${b.inner}</g></svg>`;
  }
  const ty=STAGE.ground-b.box[3];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE.w} ${STAGE.h}" role="img">${title}${b.defs}`
    +(opts.ground?`<path d="M40,${STAGE.ground}H${STAGE.w-40}" stroke="currentColor" stroke-opacity=".45" stroke-width="2" stroke-linecap="round" fill="none"/>`:'')
    +`<g transform="translate(${STAGE.cx} ${n2(ty)})" ${wrap}>${b.inner}</g></svg>`;
}

function pivots(data){
  const d=normalize(data), b=build(d), ty=STAGE.ground-b.box[3], out={};
  for(const k in b.piv) out[k]={x:b.piv[k].p[0]+STAGE.cx,y:b.piv[k].p[1]+ty,parent:b.piv[k].parent,up:!!b.piv[k].up};
  return out;
}

/* ── data ──────────────────────────────────────────────────────────────── */
const COLOUR_KEYS=['mascaraColor','blushColor','lipstickColor','propColor','packColor','heldLeftColor','heldRightColor','eyewearColor','gloveColor','upperColor2','lowerColor2','upperColor','lowerColor','footwearColor','headwearColor','sockColor','tieColor'];
function wrapDeg(v){v=Math.round(Number(v)||0);v=((v+180)%360+360)%360-180;return v===-180?180:v;}
function defaults(){
  const joints={}; JOINTS.forEach(([k])=>joints[k]=STAND[k]||0);
  return {schema:SCHEMA,name:'Sam',bodyType:'male',skin:3,eyeColor:12,hairColor:'4-0',hairStyle:'short',facialHair:'none',eyebrows:'neutral',eyes:'open',mouth:'smile',
    height:3,weight:3,upperGarment:null,lowerGarment:null,footwear:null,headwear:null,eyewear:null,accessories:[],prop:null,propColor:null,
    upperColor:null,lowerColor:null,footwearColor:null,headwearColor:null,eyewearColor:null,sockColor:null,tieColor:null,gloveColor:null,packColor:null,mascaraColor:null,blushColor:null,lipstickColor:null,heldLeftGrip:null,heldRightGrip:null,thumbFlipL:false,thumbFlipR:false,heldLeftColor:null,heldRightColor:null,
    upperPattern:'plain',upperColor2:null,lowerPattern:'plain',lowerColor2:null,
    head:'front',torsoOrientation:0,pelvisOrientation:0,held:{left:null,right:null},joints};
}
function normalize(src){
  const d=defaults(); if(!src||typeof src!=='object') return d;
  const int=(v,lo,hi,def)=>{v=Math.round(Number(v));return v>=lo&&v<=hi?v:def;};
  const pick=(v,list,def)=>list.includes(v)?v:def;
  if(typeof src.name==='string') d.name=src.name.slice(0,40);
  d.bodyType=pick(src.bodyType,['male','female'],'male');
  d.skin=int(src.skin,1,6,d.skin); d.eyeColor=int(src.eyeColor,1,16,d.eyeColor);
  d.hairColor=pick(String(src.hairColor),HAIR.map(h=>h.id),d.hairColor);
  d.hairStyle=pick(src.hairStyle,HAIR_STYLES.map(h=>h[0]),d.hairStyle);
  d.facialHair=pick(src.facialHair,FACIAL.map(h=>h[0]),d.facialHair);
  d.eyebrows=pick(src.eyebrows,BROWS.map(h=>h[0]),'neutral'); d.eyes=pick(src.eyes,EYE_SHAPES.map(h=>h[0]),'open'); d.mouth=pick(src.mouth,MOUTHS.map(h=>h[0]),'smile');
  d.height=int(src.height,1,5,3); d.weight=int(src.weight,1,5,3);
  d.upperGarment=UPPER[src.upperGarment]?src.upperGarment:null;
  d.lowerGarment=LOWER[src.lowerGarment]?src.lowerGarment:null;
  d.footwear=FOOT[src.footwear]?src.footwear:null;
  d.prop=src.prop==='bicycle'?'bmx':PROPS[src.prop]?src.prop:null;   /* 'bicycle' was the BMX */
  d.headwear=HEADWEAR[src.headwear]?src.headwear:null; d.eyewear=EYEWEAR[src.eyewear]?src.eyewear:null;
  { /* older files: one-sided or unsplit accessory names */
    const OLD={watch:['watchL'],bracelet:['braceletR'],ring:['ringL'],gloves:['glovesL','glovesR'],earrings:['studs'],shoulderpadL:['elbowpadL'],shoulderpadR:['elbowpadR']};
    const got=Array.isArray(src.accessories)?[].concat(...src.accessories.map(a=>OLD[a]||[a])):[];
    d.accessories=Object.keys(ACCESSORIES).filter(a=>got.includes(a)); }
  for(const k of COLOUR_KEYS) d[k]=hexOK(src[k]);
  d.thumbFlipL=src.thumbFlipL===true; d.thumbFlipR=src.thumbFlipR===true;
  for(const k of ['heldLeftGrip','heldRightGrip']){ const v=src[k]; d[k]=v===null||v===undefined||v===''||isNaN(Number(v))?null:Math.max(-180,Math.min(180,Math.round(Number(v)/45)*45)); }
  if(Array.isArray(src.accessories)&&src.accessories.includes('socks')&&!d.footwear){ d.footwear='socks'; d.footwearColor=hexOK(src.sockColor); }   /* older files: socks were an accessory */
  for(const k of ['upperPattern','lowerPattern']) d[k]=pick(src[k],PATTERNS.map(p=>p[0]),'plain');
  d.head=pick(src.head,HEADS,'front');
  d.torsoOrientation=Math.max(-90,Math.min(90,Math.round(Number(src.torsoOrientation)||0)));
  d.pelvisOrientation=src.pelvisOrientation===undefined?d.torsoOrientation:Math.max(-90,Math.min(90,Math.round(Number(src.pelvisOrientation)||0)));
  /* constraints: pelvis within 90° of the torso; the head never faces against the torso */
  d.pelvisOrientation=Math.max(d.torsoOrientation-90,Math.min(d.torsoOrientation+90,d.pelvisOrientation));
  if((d.torsoOrientation>0&&d.head==='left')||(d.torsoOrientation<0&&d.head==='right')) d.head='front';
  const h=src.held||{};
  const itemId=v=>v==='drumsticks'?'drumstick':v==='ball'?'basketball':v;   /* older files */
  d.held={left:ITEMS[itemId(h.left)]?itemId(h.left):null,right:ITEMS[itemId(h.right)]?itemId(h.right):null};
  const sj=src.joints||{}; JOINTS.forEach(([k])=>{ if(k in sj) d.joints[k]=wrapDeg(sj[k]); });
  return d;
}
function applyPose(data,id){
  const p=POSES.find(x=>x.id===id); if(!p) return data;
  JOINTS.forEach(([k])=>data.joints[k]=p.joints[k]||0);
  data.head=p.head; data.torsoOrientation=data.pelvisOrientation=p.turn||0; if(p.held) data.held={...p.held};
  return data;
}
function mirror(data){
  const j=data.joints, o={};
  JOINTS.forEach(([k])=>{const m=k.endsWith('L')?k.slice(0,-1)+'R':k.endsWith('R')?k.slice(0,-1)+'L':k;o[k]=wrapDeg(-j[m]);});
  data.joints=o; data.torsoOrientation=-data.torsoOrientation||0; data.pelvisOrientation=-data.pelvisOrientation||0; data.head=data.head==='left'?'right':data.head==='right'?'left':'front';
  data.held={left:data.held.right,right:data.held.left};
  [data.heldLeftGrip,data.heldRightGrip]=[data.heldRightGrip,data.heldLeftGrip]; [data.thumbFlipL,data.thumbFlipR]=[data.thumbFlipR,data.thumbFlipL]; [data.heldLeftColor,data.heldRightColor]=[data.heldRightColor,data.heldLeftColor];
  return data;
}
function describe(data){
  const d=normalize(data), n=d.name||'This person', groups=[];
  const put=(verb,phrase)=>{const g=groups[groups.length-1]; if(g&&g[0]===verb) g[1].push(phrase); else groups.push([verb,[phrase]]);};
  const L=ITEMS[d.held.left], R=ITEMS[d.held.right];
  const wear=(g,c,pat,c2)=>{
    let nm=colourName(c||g.col);
    if(pat&&pat!=='plain'&&pat!=='sidestripe'){ const n2nd=colourName(c2||colour2Default(c||g.col)); nm=(pat==='floral'||n2nd===nm?nm:`${nm} and ${n2nd}`)+' '+PAT_WORD[pat]; }
    return g.pl?`${nm} ${g.noun}`:`${/^[aeiou]/.test(nm)?'an':'a'} ${nm} ${g.noun}`;};
  if(UPPER[d.upperGarment]) put('wearing',wear(UPPER[d.upperGarment],d.upperColor,d.upperPattern,d.upperColor2));
  if(LOWER[d.lowerGarment]) put('wearing',wear(LOWER[d.lowerGarment],d.lowerColor,d.lowerPattern,d.lowerColor2));
  if(d.footwear==='socks') put('wearing',`${colourName(d.footwearColor||FOOT.socks.col)} socks`);
  if(HEADWEAR[d.headwear]) put('wearing',wear(HEADWEAR[d.headwear],d.headwearColor));
  if(EYEWEAR[d.eyewear]) put('wearing',EYEWEAR[d.eyewear].phrase);
  { const has=a=>d.accessories.includes(a), pair=(id,one,two)=>{const n=has(id+'L')+has(id+'R'); if(n) put('wearing',n===2?two:one);};
    pair('watch','a watch','two watches'); pair('bracelet','a bracelet','two bracelets');
    if(has('lipstick')) put('wearing','lipstick'); if(has('mascara')) put('wearing','mascara'); if(has('blush')) put('wearing','blush');
    if(has('necklace')) put('wearing','a necklace'); if(has('choker')) put('wearing','a choker');
    if(has('backpack')) put('wearing','a backpack'); if(has('fannypack')) put('wearing','a fanny pack');
    if(has('studs')) put('wearing','stud earrings'); if(has('drops')) put('wearing','drop earrings');
    pair('ring','a ring','two rings');
    pair('elbowpad','an elbow pad','elbow pads'); pair('kneepad','a knee pad','knee pads');
    if(has('tie')) put('wearing',`a ${colourName(d.tieColor||TIE_COL)} tie`);
    const g=colourName(d.gloveColor||GLOVE_COL); pair('gloves',`${/^[aeiou]/.test(g)?'an':'a'} ${g} glove`,`${g} gloves`); }
  /* a hand item is named with its colour only when one was picked */
  const hold=(it,c)=>{ if(!c||!it.noun) return it.phrase; const nm=colourName(c); return `${/^[aeiou]/.test(nm)?'an':'a'} ${nm} ${it.noun}`; };
  if(L&&R&&d.held.left===d.held.right) put(L.verb,`two ${L.plural||L.noun+'s'}`);
  else { if(R) put(R.verb,hold(R,d.heldRightColor)); if(L) put(L.verb,hold(L,d.heldLeftColor)); }
  if(!groups.length) return '';
  const list=a=>a.length>1?a.slice(0,-1).join(', ')+' and '+a[a.length-1]:a[0];
  const g=groups.map(([v,p])=>v+' '+list(p));
  return `${n} is ${g.length>1?g.slice(0,-1).join(', ')+(groups[0][1].length>1?', and ':' and ')+g[g.length-1]:g[0]}.`;
}

return {SCHEMA,SKIN,EYES,HAIR,HAIR_STYLES,FACIAL,HEIGHTS,WEIGHTS,HEADS,JOINTS,POSES,ITEMS,UPPER,LOWER,FOOT,OUTFITS,HEADWEAR,EYEWEAR,ACCESSORIES,BROWS,EYE_SHAPES,MOUTHS,EMOTIONS,NEUTRAL_FACE,GLOVE_COL,PACK_COL,MASCARA_COL,BLUSH_COL,LIPSTICK_COL,PROPS,GRIPS,ITEM_CATS,PALETTE,PATTERNS,colour2Default,SOCK_COL,TIE_COL,colourName,STAGE,
        defaults,normalize,render,pivots,applyPose,mirror,describe};
})();
window.HouseCharacter = HouseCharacter;
