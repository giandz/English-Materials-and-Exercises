/* ══════════════════════════════════════════════════════════════════════════
   HouseVN — visual-novel scenes acted by house characters. One scene, a list of
   lines; no choices or scene jumps yet. Needs house-character.js loaded first.

     const vn = HouseVN.create(hostElement, script);
     vn.next()      advance (or, while a line is being said, finish it at once)
     vn.back()      the line before        vn.restart()   the first line
     vn.go(i)       line i                 vn.index       the line shown now

   script = {
     background: 'classroom' | 'cafe' | 'park'   a built-in backdrop, or any CSS background value
     cast: { id: { name, color,                  name box colour (default: the text accent)
                   lang: 'en' | 'es', wpm: 150,  for the lip-sync (HouseCharacter.speech)
                   character: { … } } },         a house-character object (as saved by the poser)
     lines: [ { who: id, say: 'Hello!',
                at: 'left' | 'center' | 'right', shot: 'full' | 'medium' | 'closeup',
                pose: 'waving' | 'em_joy' | …,   any HouseCharacter.POSES or EMOTION_POSES id
                emotion: 'joy' | …,              a face only (HouseCharacter.EMOTIONS id, or 'neutral')
                look: { head:'right', … },       any other character fields
                stage: { otherId: { at, shot, pose, emotion, look } | null } } ] }
                                                  other characters entering, moving or (null) leaving

   Cues inside a line change the speaker's pose or face at that point of the line, as it is said:
     say: "Music? {pose:em_surprise} Wow! {emotion:joy} I love music."
   A cue is {pose:id}, {emotion:id} or both, {pose:em_joy emotion:sadness}. It is not shown or said, and
   it takes effect when the text reaches it (a click that finishes the line applies the rest at once).
   What a cue sets stays, like anything else a line sets.

   Whatever a line sets stays until a later line changes it, so the scene at any line is worked out by
   replaying the lines up to it: going back always shows exactly what was there.
   Characters sharing a side stand a little apart; the speaker comes to the front and the others dim.
   Pose changes (between lines or from a cue) are animated: joints, turns and framing ease from the old
   posture to the new one, with the keyframe editor's easings (HouseCharacter.EASES / ease); with reduced
   motion they change at once. Both can be set for the whole scene and changed by any line:
     easing: 'quad'                       an easing id (linear, sine, quad, cubic, quart, quint, expo, circ,
                                          back, elastic, bounce) for both ends of the move: slow – fast – slow
     easing: { out:'cubic', in:'bounce' } the departure and the arrival separately, as in the editor
     moveTime: 0.45                       seconds a move takes
   A line's easing and moveTime apply to the moves it starts (its own and its cues'); the scene's are the default.
   The text appears letter by letter in step with the mouth (the words' timing from HouseCharacter.speech).
   A click, Space, Enter or 🔽 finishes the line if it is still being said, otherwise goes to the next one.
   ══════════════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';
const HC = global.HouseCharacter;
const FPS = 30;
const LIP = ['rest','mbp','ai','e','o','u','cdg','fv','l','wq'];
const REST = '@rest';   /* placeholder for "the speaker's resting mouth" in a speech track */
const AT = {left:22, center:50, right:78};
const SPREAD = 13;   /* % of the stage width between characters sharing a side */

const CSS = `
.vn{ --vn-box:28%; max-width:960px; margin:0 auto; user-select:none; -webkit-user-select:none; }
.vn-stage{ position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; border-radius:var(--radius, 12px);
  border:1px solid var(--border, #ddd); background:#cfd8dc; cursor:pointer; touch-action:manipulation; }
.vn-bg{ position:absolute; inset:0; }
.vn-bg svg{ width:100%; height:100%; display:block; }
/* every shot stands on the top edge of the text box (a little behind it) and reaches near the top of the picture:
   full = the whole figure, medium = from the waist up, closeup = head and shoulders */
.vn-ch{ position:absolute; bottom:calc(var(--vn-box) - 7%); height:calc(100% - var(--vn-box) + 4%); transform:translateX(-50%); transition:left .45s ease, height .45s ease, bottom .45s ease, opacity .35s ease, filter .3s ease; pointer-events:none; }
.vn-ch svg{ width:100%; height:100%; display:block; overflow:visible; }
.vn-ch.full{ bottom:calc(var(--vn-box) - 1%); height:calc(100% - var(--vn-box) - 3%); }
.vn-ch.dim{ filter:brightness(.72) saturate(.8); }
.vn-ch.out{ opacity:0; }
.vn-box{ position:absolute; z-index:100; left:3%; right:3%; bottom:3%; height:calc(var(--vn-box) - 3%); box-sizing:border-box; padding:2.4% 3% 2%;
  background:color-mix(in srgb, var(--surface-2, #fff) 96%, transparent); border:2px solid var(--text-accent, #185fa5);
  border-radius:14px; box-shadow:0 6px 18px rgba(0,0,0,.18); }
.vn-name{ position:absolute; left:4%; bottom:calc(100% - 6px); padding:.15em .9em .2em; border-radius:9px 9px 0 0;
  font-weight:700; font-size:clamp(.8rem, 1.9vw, 1.05rem); color:#fff; background:var(--vn-name, var(--text-accent, #185fa5)); }
.vn-name:empty{ display:none; }
.vn-text{ font-size:clamp(.9rem, 2.3vw, 1.3rem); line-height:1.45; color:var(--text-primary, #1a1a1a); overflow:hidden; height:100%; }
.vn-text .hid{ visibility:hidden; }
.vn-next{ position:absolute; right:1.6%; bottom:6%; border:0; background:none; font-size:clamp(1rem, 2.4vw, 1.4rem); line-height:1;
  cursor:pointer; padding:2px; opacity:.35; transition:opacity .2s; }
.vn-next.ready{ opacity:1; animation:vn-bob 1s ease-in-out infinite; }
.vn-next.end{ opacity:.25; animation:none; cursor:default; }
@keyframes vn-bob{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(4px); } }
@media (prefers-reduced-motion: reduce){ .vn-next.ready{ animation:none; } .vn-ch{ transition:none; } }
.vn-bar{ display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; }
.vn-bar button{ display:inline-flex; flex-direction:column; align-items:center; gap:1px; min-width:4.2rem; padding:5px 8px 4px; line-height:1; }
.vn-bar .ic{ font-size:1.3rem; }
.vn-bar .lb{ font-size:.6667rem; font-weight:600; color:var(--text-secondary, #555); }
.vn-count{ font-family:var(--font-mono, monospace); font-size:.8rem; color:var(--text-secondary, #555); min-width:4.5em; text-align:center; }
.vn-sr{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
`;
function injectCSS(){
  if(document.getElementById('house-vn-styles')) return;
  const st = document.createElement('style'); st.id = 'house-vn-styles'; st.textContent = CSS; document.head.appendChild(st);
}

/* ── built-in backdrops (1600 × 900) ── */
const BG = {
  classroom: `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="#e9e1cf"/><rect y="640" width="1600" height="260" fill="#b9946a"/><path d="M0,640H1600" stroke="#8a6a46" stroke-width="8"/>
    <rect x="430" y="150" width="740" height="330" rx="8" fill="#2f5a46" stroke="#7a5a36" stroke-width="18"/><path d="M500,240q60,-40 120,0t120,0M520,330h260M860,250h200M860,300h150" stroke="#e9efe9" stroke-opacity=".7" stroke-width="7" fill="none" stroke-linecap="round"/>
    <rect x="1290" y="140" width="220" height="300" fill="#bfe2f2" stroke="#fff" stroke-width="14"/><path d="M1400,140V440M1290,290H1510" stroke="#fff" stroke-width="10"/>
    <rect x="90" y="140" width="220" height="300" fill="#bfe2f2" stroke="#fff" stroke-width="14"/><path d="M200,140V440M90,290H310" stroke="#fff" stroke-width="10"/>
    <circle cx="800" cy="90" r="38" fill="#fff" stroke="#555" stroke-width="6"/><path d="M800,90V66M800,90h18" stroke="#333" stroke-width="5"/></svg>`,
  cafe: `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="#f1dcc0"/><rect width="1600" height="90" fill="#7a4a2a"/><rect y="610" width="1600" height="290" fill="#8a5a36"/>
    <path d="M0,610H1600" stroke="#5e3a20" stroke-width="10"/><rect x="0" y="470" width="1600" height="140" fill="#a8744a"/><path d="M0,470H1600" stroke="#6e4426" stroke-width="10"/>
    <rect x="120" y="150" width="430" height="260" rx="10" fill="#bfe2f2" stroke="#fff" stroke-width="16"/><path d="M335,150V410" stroke="#fff" stroke-width="10"/>
    <rect x="1080" y="140" width="380" height="250" rx="12" fill="#3a3a3a" stroke="#6e4426" stroke-width="14"/><path d="M1130,200h200M1130,250h260M1130,300h170M1130,350h230" stroke="#f3e7c8" stroke-width="10" stroke-linecap="round"/>
    <g fill="#c96a3a"><circle cx="700" cy="120" r="34"/><circle cx="900" cy="120" r="34"/></g><path d="M700,90V40M900,90V40" stroke="#333" stroke-width="4"/>
    <g fill="#fff" stroke="#8a5a36" stroke-width="4"><rect x="640" y="430" width="40" height="44" rx="6"/><rect x="760" y="436" width="34" height="38" rx="6"/><rect x="880" y="430" width="40" height="44" rx="6"/></g></svg>`,
  park: `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="vnsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec9f0"/><stop offset="1" stop-color="#d9f0fb"/></linearGradient></defs>
    <rect width="1600" height="900" fill="url(#vnsky)"/><circle cx="1360" cy="150" r="70" fill="#fff3b0"/><ellipse cx="380" cy="160" rx="120" ry="38" fill="#fff"/><ellipse cx="460" cy="140" rx="90" ry="34" fill="#fff"/>
    <path d="M0,560Q400,470 800,540T1600,520V900H0Z" fill="#8fcf72"/><path d="M0,650Q500,600 1000,660T1600,640V900H0Z" fill="#6fb658"/>
    <g fill="#6e4426"><rect x="210" y="330" width="34" height="260"/><rect x="1270" y="350" width="30" height="230"/></g><g fill="#3f9a4a"><circle cx="227" cy="300" r="120"/><circle cx="1285" cy="320" r="105"/></g>
    <path d="M560,700H1040M600,700V760M1000,700V760M560,660H1040" stroke="#8a5a36" stroke-width="16" stroke-linecap="round"/></svg>`
};

/* "Hi! {pose:em_joy} Nice to meet you." → {text:'Hi! Nice to meet you.', cues:[{at:4, pose:'em_joy'}]} */
function parseCues(say){
  const raw = String(say || ''), cues = [];
  let text = '', last = 0;
  for(const m of raw.matchAll(/\{([^{}]*)\}/g)){
    const d = {};
    for(const [, k, v] of m[1].matchAll(/(pose|emotion)\s*[:=]\s*([\w-]+)/g)) d[k] = v;
    if(!d.pose && !d.emotion) continue;   /* not a cue: leave it in the text */
    text += raw.slice(last, m.index); last = m.index + m[0].length;
    if(/\s$/.test(text) && /^\s/.test(raw.slice(last))) text = text.replace(/\s+$/, ' ');   /* no double space where the cue was */
    cues.push({at:text.replace(/\s+$/, '').length, ...d});
  }
  text += raw.slice(last);
  const lead = text.length - text.replace(/^\s+/, '').length;   /* a cue at the very start */
  return {text:text.trim().replace(/[ \t]{2,}/g, ' '), cues:cues.map(c => ({...c, at:Math.max(0, c.at - lead)}))};
}

function face(data, id){
  if(!id) return;
  const all = [HC.NEUTRAL_FACE, ...HC.EMOTIONS.flatMap(g => g[1])], e = all.find(x => x[0] === id);
  if(e){ data.eyebrows = e[2]; data.eyes = e[3]; data.mouth = e[4]; }
}

function create(host, script){
  injectCSS();
  const cast = script.cast || {}, lines = (script.lines || []).filter(l => l && cast[l.who]);
  host.innerHTML = '';
  const root = document.createElement('div'); root.className = 'vn';
  root.innerHTML = `<div class="vn-stage" tabindex="0" role="group" aria-label="Scene. Click, Space or Enter to go on.">
      <div class="vn-bg"></div><div class="vn-cast"></div>
      <div class="vn-box"><div class="vn-name"></div><div class="vn-text" aria-hidden="true"></div><div class="vn-sr" aria-live="polite"></div>
        <button type="button" class="vn-next" title="Next (Space, Enter or a click)" aria-label="Next">🔽</button></div></div>
    <div class="vn-bar">
      <button type="button" data-act="restart" title="Start again (Home)"><span class="ic" aria-hidden="true">⏮️</span><span class="lb">Start</span></button>
      <button type="button" data-act="back" title="The line before (←)"><span class="ic" aria-hidden="true">⏪</span><span class="lb">Back</span></button>
      <span class="vn-count" aria-live="off"></span>
      <button type="button" data-act="next" title="Next (Space, Enter or a click)"><span class="ic" aria-hidden="true">🔽</span><span class="lb">Next</span></button>
    </div>`;
  host.appendChild(root);
  const $ = c => root.querySelector(c);
  const stage = $('.vn-stage'), castEl = $('.vn-cast'), nameEl = $('.vn-name'), textEl = $('.vn-text'), srEl = $('.vn-sr'), nextEl = $('.vn-next'), countEl = $('.vn-count');
  const bg = script.background || 'classroom';
  if(BG[bg]) $('.vn-bg').innerHTML = BG[bg]; else $('.vn-bg').style.background = bg;

  /* ── the scene at line i: replay the stage directions from the start ── */
  const parsed = lines.map(L => parseCues(L.say));
  /* the scene at the start of line i: the lines before it, with all their cues, then line i's own directions */
  function sceneAt(i){
    const on = new Map();
    const apply = (id, d) => {
      if(!cast[id]) return;
      const c = on.get(id) || {at:'center', shot:'medium', data:HC.normalize(cast[id].character || {})};
      if(d.at && AT[d.at] !== undefined) c.at = d.at;
      if(d.shot) c.shot = d.shot === 'mcu' ? 'closeup' : d.shot;
      if(d.pose) c.data = HC.applyPose(c.data, d.pose);
      face(c.data, d.emotion);
      if(d.look) c.data = HC.normalize({...c.data, ...d.look, joints:{...c.data.joints, ...(d.look.joints || {})}});
      on.delete(id); on.set(id, c);   /* the last one changed is drawn in front */
    };
    for(let j = 0; j <= i && j < lines.length; j++){
      const L = lines[j];
      for(const [id, d] of Object.entries(L.stage || {})){ if(d === null) on.delete(id); else apply(id, d); }
      apply(L.who, L);
      if(j < i) for(const cue of parsed[j].cues) apply(L.who, cue);
    }
    return on;
  }
  function applyCue(cue){   /* during a line: the speaker's pose or face changes on screen */
    const c = scene.get(talk.who); if(!c) return;
    if(cue.pose) c.data = HC.applyPose(c.data, cue.pose);
    face(c.data, cue.emotion);
    talk.rest = LIP.includes(c.data.mouth) ? 'rest' : c.data.mouth;   /* pauses now fall back to the new face */
    drawSprite(talk.who, c);
  }
  function runCues(upto){ while(talk.cue < talk.cues.length && talk.cues[talk.cue].at <= upto) applyCue(talk.cues[talk.cue++]); }

  /* ── one character's picture, cropped for its shot ── */
  function crop(data, shot){
    const p = HC.pivots(data), nk = p.neck, top = nk.y - 122;
    const bottom = shot === 'closeup' ? nk.y + 46 : shot === 'medium' ? p.pelvis.y + 18 : HC.STAGE.ground + 14;
    const h = bottom - top, w = h * (shot === 'full' ? 0.62 : shot === 'medium' ? 0.86 : 1);
    return [nk.x - w / 2, top, w, h];
  }
  /* ── posture changes are animated: joint angles, turns and the framing move from the old pose to the new one
     with the scene's (or the line's) easing and move time, so nobody jumps from one posture to another.
     Face, hands, clothes and facing change at once. ── */
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* an easing setting → [out, in] ids the editor knows; anything else is linear */
  const easingOf = v => { const id = x => HC.easeId(x); return v && typeof v === 'object' ? [id(v.out), id(v.in)] : [id(v), id(v)]; };
  const SCENE_EASE = easingOf(script.easing || 'quad'), SCENE_TIME = Number(script.moveTime) >= 0 ? Number(script.moveTime) : 0.45;
  let motion = {ease:SCENE_EASE, time:SCENE_TIME};   /* for the moves of the line being shown */
  const wrap = v => ((v + 180) % 360 + 360) % 360 - 180;
  const TURNS = ['torsoOrientation', 'pelvisOrientation'];
  const numsOf = d => ({joints:{...d.joints}, turns:TURNS.map(k => d[k])});
  const sameNums = (a, b) => TURNS.every((k, i) => a.turns[i] === b.turns[i]) && Object.keys(b.joints).every(j => Math.round(a.joints[j]) === Math.round(b.joints[j]));
  function lerpNums(a, b, e){
    const joints = {};
    for(const j of Object.keys(b.joints)) joints[j] = a.joints[j] + wrap(b.joints[j] - a.joints[j]) * e;   /* the short way round */
    return {joints, turns:b.turns.map((v, i) => a.turns[i] + (v - a.turns[i]) * e)};
  }
  const lerpVB = (a, b, e) => b.map((v, i) => a[i] + (v - a[i]) * e);

  const sprites = new Map();   /* id → {el, key, data (target), shot, nums (on screen), vb (on screen), anim} */
  function paint(s, nums, vb){   /* draw the target character with these joint angles and this framing */
    const d = {...s.data, joints:nums.joints}; TURNS.forEach((k, i) => d[k] = nums.turns[i]);
    const key = JSON.stringify(d) + vb.map(v => v.toFixed(1)).join();
    if(key === s.key) return;
    s.el.style.aspectRatio = `${vb[2].toFixed(1)} / ${vb[3].toFixed(1)}`;
    s.el.innerHTML = HC.render(d).replace(/viewBox="[^"]*"/, `viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMax meet"`);
    s.key = key; s.nums = nums; s.vb = vb;
  }
  let animRaf = 0;
  function animate(now){
    animRaf = 0;
    for(const s of sprites.values()){
      const A = s.anim; if(!A) continue;
      const t = A.time > 0 ? Math.min(1, (now - A.t0) / 1000 / A.time) : 1, e = HC.ease(t, A.ease[0], A.ease[1]);
      paint(s, lerpNums(A.fromN, A.toN, e), lerpVB(A.fromV, A.toV, e));
      if(t >= 1) s.anim = null;
    }
    if([...sprites.values()].some(s => s.anim)) animRaf = requestAnimationFrame(animate);
  }
  function drawSprite(id, c){
    let s = sprites.get(id);
    const toN = numsOf(c.data), toV = crop(c.data, c.shot);
    if(!s){
      const el = document.createElement('div'); el.className = 'vn-ch out'; el.dataset.id = id; castEl.appendChild(el);
      s = {el, key:'', data:c.data}; sprites.set(id, s);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('out')));
      paint(s, toN, toV);   /* a character who comes in appears in their pose */
    } else {
      s.data = c.data;
      const goal = s.anim ? s.anim.toN : s.nums, goalV = s.anim ? s.anim.toV : s.vb;
      const moved = !sameNums(goal, toN) || goalV.some((v, i) => Math.abs(v - toV[i]) > 0.5);
      if(moved && !REDUCED && motion.time > 0){   /* start from wherever the character is right now, even in the middle of a move */
        s.anim = {fromN:s.nums, fromV:s.vb, toN, toV, t0:performance.now(), ease:motion.ease, time:motion.time};
        if(!animRaf) animRaf = requestAnimationFrame(animate);
      } else if(moved) paint(s, toN, toV);
      if(!s.anim) paint(s, s.nums, s.vb);   /* only the face or clothes changed (a mouth while talking): draw it now */
    }
    s.el.classList.remove('full', 'medium', 'closeup'); s.el.classList.add(c.shot);
  }
  function layout(scene, speaker){
    const groups = {left:[], center:[], right:[]};
    for(const [id, c] of scene) groups[c.at].push(id);
    for(const [at, ids] of Object.entries(groups)) ids.forEach((id, k) => {
      const s = sprites.get(id); if(!s) return;
      s.el.style.left = (AT[at] + (k - (ids.length - 1) / 2) * SPREAD) + '%';
    });
    let z = 1;
    for(const id of scene.keys()){ const s = sprites.get(id); if(s && id !== speaker) s.el.style.zIndex = z++; }
    for(const [id, s] of sprites){
      if(id === speaker) s.el.style.zIndex = 50;
      s.el.classList.toggle('dim', !!speaker && id !== speaker && scene.has(id));
    }
  }

  /* ── saying a line ── */
  let index = -1, scene = null, talk = null, raf = 0;
  function render(text, upto){
    const esc = t => t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    textEl.innerHTML = esc(text.slice(0, upto)) + `<span class="hid">${esc(text.slice(upto))}</span>`;
  }
  function revealAt(t){   /* how much of the text has been said after t seconds */
    const W = talk.sp.words, n = talk.text.length;
    if(!W.length) return n;
    let idx = W[0].from;
    W.forEach((w, i) => {
      const s = w.start / FPS, e = w.end / FPS;
      if(t >= e){ const nx = W.slice(i + 1).find(x => x.from > w.from); idx = Math.max(idx, nx ? nx.from : n); }
      else if(t >= s) idx = Math.max(idx, Math.round(w.from + (w.to - w.from) * (t - s) / Math.max(e - s, 1e-3)));
    });
    return idx;
  }
  function setMouth(m){
    const c = scene.get(talk.who); if(!c || c.data.mouth === m) return;
    c.data.mouth = m; drawSprite(talk.who, c);
  }
  function tick(now){
    if(!talk || talk.done) return;
    const t = Math.max(0, now - talk.t0) / 1000;
    if(t >= talk.sp.seconds){ finish(); return; }
    const f = t * FPS, K = talk.sp.keys;
    const up = revealAt(t); if(up !== talk.shown){ talk.shown = up; render(talk.text, up); }
    runCues(up);
    let m = K[0] ? K[0].mouth : REST;
    for(const k of K){ if(k.frame <= f) m = k.mouth; else break; }
    setMouth(m === REST ? talk.rest : m);
    raf = requestAnimationFrame(tick);
  }
  function finish(){   /* the whole line at once, mouth at rest */
    if(!talk || talk.done) return;
    talk.done = true; cancelAnimationFrame(raf);
    render(talk.text, talk.text.length); runCues(Infinity); setMouth(talk.rest);
    syncButtons();
  }
  function go(i){
    if(!lines.length) return;
    i = Math.max(0, Math.min(lines.length - 1, i));
    cancelAnimationFrame(raf);
    const L = lines[i], who = L.who, cm = cast[who];
    motion = {ease:L.easing ? easingOf(L.easing) : SCENE_EASE, time:Number(L.moveTime) >= 0 && L.moveTime !== '' && L.moveTime != null ? Number(L.moveTime) : SCENE_TIME};
    index = i; scene = sceneAt(i);
    for(const [id, s] of sprites) if(!scene.has(id)){ s.el.classList.add('out'); sprites.delete(id); setTimeout(() => s.el.remove(), 400); }
    for(const [id, c] of scene) drawSprite(id, c);
    layout(scene, who);
    nameEl.textContent = cm.name || who;
    root.style.setProperty('--vn-name', cm.color || '');
    const {text, cues} = parsed[i], c = scene.get(who);
    const rest = LIP.includes(c.data.mouth) ? 'rest' : c.data.mouth;   /* pauses and the end fall back to their expression */
    /* pauses come back as REST and are drawn with whatever face the speaker has by then (cues can change it) */
    talk = {who, text, rest, cues, cue:0, shown:-1, done:false, t0:performance.now(),
      sp:HC.speech(text, {fps:FPS, wpm:cm.wpm || 150, lang:cm.lang || 'en', restMouth:REST})};
    srEl.textContent = `${cm.name || who}: ${text}`;
    render(text, 0);
    syncButtons();
    if(!talk.sp.keys.length) finish(); else raf = requestAnimationFrame(tick);
  }
  function syncButtons(){
    const last = index >= lines.length - 1, ready = talk && talk.done;
    nextEl.classList.toggle('ready', !!ready && !last);
    nextEl.classList.toggle('end', !!ready && last);
    nextEl.textContent = ready && last ? '⏹️' : '🔽';
    nextEl.title = ready && last ? 'The end of the scene' : 'Next (Space, Enter or a click)';
    countEl.textContent = `${index + 1} / ${lines.length}`;
    root.querySelector('[data-act="back"]').disabled = index <= 0;
    root.querySelector('[data-act="restart"]').disabled = index <= 0;
    root.querySelector('[data-act="next"]').disabled = !!ready && last;
  }
  const next = () => { if(talk && !talk.done) finish(); else if(index < lines.length - 1) go(index + 1); };
  const back = () => go(index - 1);
  const restart = () => go(0);

  stage.addEventListener('click', e => { if(e.target.closest('button') && !e.target.closest('.vn-next')) return; next(); });
  root.querySelector('.vn-bar').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    ({next, back, restart})[b.dataset.act]();
  });
  root.addEventListener('keydown', e => {
    if(e.target.closest('input, textarea, select')) return;
    if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown'){ e.preventDefault(); next(); }
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){ e.preventDefault(); back(); }
    else if(e.key === 'Home'){ e.preventDefault(); restart(); }
  });

  go(0);
  return {next, back, restart, go, get index(){ return index; }, get length(){ return lines.length; }};
}

global.HouseVN = {create, BACKGROUNDS:Object.keys(BG)};
})(window);
