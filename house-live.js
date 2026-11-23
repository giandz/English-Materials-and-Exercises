/* ══════════════════════════════════════════════════════════════════════════
   HouseLive — a live, microphone-driven talking house character for recorded videos (OBS).
   Needs house-character.js loaded first.

     const live = HouseLive.create(hostElement, options);

   What it does
     · The stage fills its host: a background (solid colour, a still image, or transparent) and the
       character on top, framed by a camera you can pan and zoom (drag, mouse wheel, or setCamera / shot).
     · The microphone drives the mouth straight from the audio (loudness and a rough vowel estimate from the
       spectrum), so it works with no speech recognition at all.
     · Speech recognition (the browser's Web Speech API, optionally on-device) adds captions, gestures on
       keywords ("hello" → wave), and head and brow movement that follows each sentence (HouseCharacter.prosody).
     · Delay: the character can run a fixed time behind the voice (setDelay(seconds)). Recognised sentences
       usually arrive within that time, and then the mouth uses the text's lip-sync shapes
       (HouseCharacter.speech), spread over the moments the microphone heard voice — so the shapes come from
       the words and the timing from the voice. Gestures and captions land on their words, too. Delay the
       microphone in OBS by the same amount (the audio source's Sync Offset) and the recording lines up.
       With no delay, the mouth comes from the audio alone and word gestures come a moment late.
     · Gestures are short clips: built in (wave, point, shrug, …) or house-animation/1 files made in the
       keyframe editor (addClip). Each clip moves only the settings it has timelines for, faded in and out
       on top of the idle pose, so clips mix with each other and with the speech.
     · Idle life: body sway, breathing, weight shift, torso, head and arm drift, blinks — each with its own amount (idle).

   options (all optional; every one can be changed later)
     character      a house-character object (as saved by the poser); its pose is the resting pose
     background     {type:'color'|'image'|'transparent', color:'#00B140', image:'<url or data URL>', fit:'cover'|'contain'|'stretch'}
     camera         {x:300, y:295, zoom:1}   x, y = the point of the 600 × 590 stage at the centre of the view;
                                             zoom 1 = the whole stage height fills the view
     delay          seconds (0–5)            how far the character runs behind the microphone
     lang           'en-US' | 'en-GB' | 'es-ES' | 'es-MX' | …   recognition language (lip-sync rules follow it)
     onDevice       true                     ask for on-device recognition where the browser has it
     mouthMode      'auto' | 'audio'          auto: text shapes when a sentence is ready in time, audio otherwise
     mouthDetail    'shapes' | 'loudness'     audio mouth: shapes from the spectrum (A·I, E, O, U, W·Q, F·V, L, C·D·G…, M·B·P), or open/closed by loudness
     calibration    {aah:{shape, db}, …}      the speaker's own sounds, from calibrate(id); HouseLive.SOUNDS lists them
     sensitivity    dB above the noise floor where voice starts (default 9)
     beats          true                      small head nods on loud syllables (beatStrength: degrees, default 3)
     idle           {on, speed, sway, breathe, shift, torso, head, arms, blinks, blinkRate, doubleBlink}
                    idle life; amounts in degrees (sway, torso, head, arms), % (breathe), stage px (shift); 0 turns one off.
                    blinkRate = blinks a minute, doubleBlink = % of blinks that come twice. HouseLive.IDLE = the defaults.
     captions       true                      caption strip at the bottom of the stage
     prosody        true                      head nods, question brows and blinks from recognised sentences
     autoGestures   true                      gestures from keywords
     lockCamera     false                     ignore drag and wheel on the stage
     fps            30                        drawing rate cap
     onLevel(db, gate, floor)   every audio frame, for a level meter
     onStatus(text)             microphone and recognition status, in words
     onTranscript(text)         each recognised sentence
     onCamera(camera)           after any camera change (drag, wheel, shot)

   methods
     startMic() → Promise · stopMic() · micOn
     calibrate(id, seconds = 1.6) → Promise {ok, frames, calibration} · calibration · clearCalibration()
     startRecognition() · stopRecognition() · recognitionOn
     setCharacter(data) · setBackground(bg) · setCamera(cam) · getCamera() · shot('full'|'medium'|'closeup')
     setDelay(s) · set(options)  (any option above)
     gesture(id) · emotion(id | 'neutral') · clips (list) · addClip(id, animation, {label, keywords:{en:[…], es:[…]}, short}) · removeClip(id)
     destroy()

   HouseLive.CLIPS: the built-in gestures; HouseLive.EMOTIONS: the basic emotion of each Plutchik petal.
   ══════════════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';
const HC = global.HouseCharacter;
const LIP = ['rest','mbp','ai','e','o','u','cdg','fv','l','wq'];
const FPS = 30;                               /* timing grid for HouseCharacter.speech and prosody */
const REST = '@r';
const now = () => performance.now() / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const JOINTS = new Set(HC.JOINTS.map(j => j[0]));
const NUMERIC = new Set(['torsoOrientation', 'pelvisOrientation', 'headNod']);
/* what a gesture clip may move: posture, face direction, brows and eyes, hands. Not the mouth (the speech
   owns it), not clothes. */
const CLIP_PARAMS = new Set([...JOINTS, ...NUMERIC, 'head', 'eyebrows', 'eyes', 'held.left', 'held.right',
  'heldLeftGrip', 'heldRightGrip', 'thumbFlipL', 'thumbFlipR']);
function getP(d, k){ if(JOINTS.has(k)) return d.joints[k]; if(k.startsWith('held.')) return (d.held || {})[k.slice(5)] ?? null; return d[k]; }
function setP(d, k, v){ if(JOINTS.has(k)) d.joints[k] = v; else if(k.startsWith('held.')) d.held = {...(d.held || {}), [k.slice(5)]: v}; else d[k] = v; }
const cloneData = d => JSON.parse(JSON.stringify(d));

/* ── gesture clips ─────────────────────────────────────────────────────────────────────────────── */
/* a value on one timeline at frame f: numbers ease (joints the natural way), everything else holds */
function trackValue(t, f){
  const K = t.keys;
  if(f <= K[0].frame) return K[0].value;
  if(f >= K[K.length - 1].frame) return K[K.length - 1].value;
  let i = 0; while(K[i + 1].frame <= f) i++;
  const A = K[i], B = K[i + 1];
  if(typeof A.value !== 'number' || typeof B.value !== 'number') return A.value;
  const e = HC.ease((f - A.frame) / (B.frame - A.frame), A.easeOut, B.easeIn);
  return JOINTS.has(t.param) ? A.value + HC.jointDelta(t.param, A.value, B.value) * e : A.value + (B.value - A.value) * e;
}
/* a house-animation/1 file (or the same shape) → a clip. Settings that change between the old-style main
   keyframes become timelines, as the keyframe editor does when it opens such a file. */
function makeClip(id, src, meta){
  meta = meta || {};
  const fps = clamp(Number(src.fps) || 24, 1, 60);
  const tracks = [];
  for(const t of Array.isArray(src.tracks) ? src.tracks : []){
    if(!t || t.off || !CLIP_PARAMS.has(t.param) || !Array.isArray(t.keys) || !t.keys.length) continue;
    if(tracks.some(x => x.param === t.param)) continue;
    tracks.push({param:t.param, keys:t.keys.map(k => ({frame:Math.max(0, Number(k.frame) || 0), easeIn:HC.easeId(k.easeIn), easeOut:HC.easeId(k.easeOut), value:k.value}))
      .sort((a, b) => a.frame - b.frame)});
  }
  const main = (Array.isArray(src.keys) ? src.keys : []).filter(k => k && k.pose).sort((a, b) => a.frame - b.frame);
  if(main.length > 1) for(const k of CLIP_PARAMS){
    if(tracks.some(t => t.param === k)) continue;
    const vals = main.map(m => getP({joints:{}, held:{}, ...m.pose, joints:m.pose.joints || {}}, k));
    if(vals.every(v => v === undefined) || vals.every(v => JSON.stringify(v) === JSON.stringify(vals[0]))) continue;
    tracks.push({param:k, keys:main.map((m, i) => ({frame:m.frame, easeIn:HC.easeId(m.easeIn), easeOut:HC.easeId(m.easeOut), value:vals[i]})).filter(x => x.value !== undefined)});
  }
  const length = Math.max(1, Number(src.length) || 0, ...tracks.map(t => t.keys[t.keys.length - 1].frame));
  return {id, label:meta.label || id, fps, length, dur:length / fps, tracks, keywords:meta.keywords || {}, short:!!meta.short, builtin:!!meta.builtin, key:meta.key || null};
}
/* built-in gestures, written as timelines (frames at 24 fps). They describe the gesture itself; the fade in
   and out from whatever the character was doing is added when they play. */
const T = (param, ...pairs) => ({param, keys:pairs.map(([frame, value]) => ({frame, value, easeIn:'sine', easeOut:'sine'}))});
const BUILTIN = [
  ['wave', 'Wave', {length:44, tracks:[T('shoulderR', [0, 128]), T('elbowR', [0, 55], [7, 95], [14, 55], [21, 95], [28, 55], [35, 95], [44, 70]), T('wristR', [0, 10]), T('held.right', [0, 'hand_open'])]},
    {en:['hello', 'hi', 'hey', 'bye', 'goodbye', 'welcome', 'good morning', 'good afternoon', 'see you'], es:['hola', 'adiós', 'chao', 'chau', 'bienvenidos', 'bienvenidas', 'bienvenido', 'bienvenida', 'buenos días', 'buenas tardes', 'hasta luego']}],
  ['point', 'Point', {length:36, tracks:[T('shoulderR', [0, 86]), T('elbowR', [0, 4]), T('wristR', [0, 0]), T('held.right', [0, 'hand_point']), T('neck', [0, -3])]},
    {en:['look', 'look at', 'over here', 'over there'], es:['mira', 'miren', 'mirad', 'aquí', 'allí']}],
  ['shrug', 'Shrug', {length:34, tracks:[T('shoulderL', [0, -28]), T('elbowL', [0, -82]), T('shoulderR', [0, 28]), T('elbowR', [0, 82]),
      T('held.left', [0, 'hand_open']), T('held.right', [0, 'hand_open']), T('neck', [0, 0], [8, 7], [26, 7], [34, 0]), T('eyebrows', [0, 'raised'])]},
    {en:["i don't know", 'i dont know', 'maybe', 'who knows', 'not sure'], es:['no sé', 'quizás', 'quizá', 'tal vez', 'a lo mejor']}],
  ['open', 'Open arms', {length:38, tracks:[T('shoulderL', [0, -52]), T('elbowL', [0, -18]), T('shoulderR', [0, 52]), T('elbowR', [0, 18]),
      T('held.left', [0, 'hand_open']), T('held.right', [0, 'hand_open'])]},
    {en:['everybody', 'everyone', 'all of you', 'together'], es:['todos', 'todas', 'juntos', 'juntas']}],
  ['nod', 'Nod (yes)', {length:24, tracks:[T('headNod', [0, 0], [6, 11], [12, 1], [18, 11], [24, 0])]},
    {en:['yes', 'yeah', 'exactly', 'correct', "that's right"], es:['sí', 'claro', 'exacto', 'correcto', 'eso es']}, true],
  ['shake', 'Shake (no)', {length:26, tracks:[{param:'head', keys:[[0, 'left'], [6, 'right'], [12, 'left'], [18, 'right'], [24, 'front']].map(([frame, value]) => ({frame, value, easeIn:'linear', easeOut:'linear'}))}]},
    {en:['no', 'nope', 'wrong', 'not really'], es:['no', 'incorrecto', 'para nada']}, true],
  ['think', 'Think', {length:54, tracks:[T('shoulderR', [0, -59]), T('elbowR', [0, -140]), T('shoulderL', [0, -38]), T('elbowL', [0, 139]),
      T('neck', [0, 6]), T('eyebrows', [0, 'skeptical']), {param:'head', keys:[{frame:0, value:'left', easeIn:'linear', easeOut:'linear'}]}]},
    {en:['let me think', 'hmm', 'i wonder', 'let me see'], es:['a ver', 'déjame pensar', 'déjenme pensar', 'mmm']}],
  ['surprise', 'Surprise', {length:36, tracks:[T('shoulderL', [0, -43]), T('elbowL', [0, -136]), T('shoulderR', [0, 43]), T('elbowR', [0, 136]),
      T('held.left', [0, 'hand_open']), T('held.right', [0, 'hand_open']), T('eyebrows', [0, 'raised']), T('eyes', [0, 'wide']), T('headNod', [0, -6])]},
    {en:['wow', 'really', 'amazing', 'oh my'], es:['guau', 'en serio', 'increíble', 'qué bien']}],
  ['hips', 'Hands on hips', {length:60, tracks:[T('shoulderL', [0, -50]), T('elbowL', [0, 95]), T('shoulderR', [0, 50]), T('elbowR', [0, -95])]}, {}]
];
const CLIPS = BUILTIN.map(([id, label, src, keywords, short], i) => makeClip(id, {fps:24, ...src}, {label, keywords, short, builtin:true, key:String(i + 1)}));
/* the basic emotion of each Plutchik petal, for quick face changes */
const EMOTIONS = HC.EMOTIONS.map(([group, list]) => { const e = list[1]; return {id:e[0], label:e[1], brows:e[2], eyes:e[3], mouth:e[4]}; });

/* idle life: every motion has its own amount (0 = off) and they share one speed. Sway, breathing and weight shift
   move the whole figure with a fine transform drawn over the picture, so they glide smoothly (the engine keeps joint
   angles to whole degrees); torso, head and arms move the joints themselves. */
const IDLE = {on:true, speed:1, sway:0.6, breathe:0.6, shift:1.5, torso:1.5, head:1.5, arms:1.2, blinks:true, blinkRate:17, doubleBlink:10};
const IDLE_RANGE = {speed:[0.25, 3], sway:[0, 3], breathe:[0, 2], shift:[0, 8], torso:[0, 5], head:[0, 6], arms:[0, 6], blinkRate:[4, 40], doubleBlink:[0, 50]};
/* slow, never-repeating drift: a few sine waves at unrelated frequencies (Hz at speed 1), weights summing to 1 */
const drift = (t, f, p) => 0.6 * Math.sin(2 * Math.PI * f * t + p) + 0.3 * Math.sin(2 * Math.PI * f * 2.13 * t + p * 1.7 + 1.1) + 0.1 * Math.sin(2 * Math.PI * f * 3.71 * t + p * 2.3 + 2.4);
/* keywords → word sequences, matched on whole words (case and punctuation ignored, accents kept: sí ≠ si) */
const normWords = t => String(t || '').toLowerCase().replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);

function create(host, options){
  const o = {background:{type:'color', color:'#00B140', image:null, fit:'cover'}, camera:{x:300, y:295, zoom:1}, delay:0, lang:'en-US', onDevice:true,
    mouthMode:'auto', mouthDetail:'shapes', sensitivity:9, beats:true, beatStrength:3, captions:true, prosody:true, autoGestures:true, lockCamera:false, fps:30, ...(options || {})};
  o.idle = {...IDLE, ...((options || {}).idle || {})};
  const cb = k => (...a) => { if(typeof o[k] === 'function'){ try{ o[k](...a); }catch(e){ console.error(e); } } };
  const onLevel = cb('onLevel'), onStatus = cb('onStatus'), onTranscript = cb('onTranscript'), onCamera = cb('onCamera');

  let lastKey = '', lastDraw = 0, raf = 0, dead = false;

  /* ── stage ── */
  host.classList.add('hl-stage');
  host.innerHTML = '<div class="hl-char"></div><div class="hl-cap" aria-live="polite"></div>';
  const charEl = host.querySelector('.hl-char'), capEl = host.querySelector('.hl-cap');
  if(!document.getElementById('house-live-styles')){
    const st = document.createElement('style'); st.id = 'house-live-styles';
    st.textContent = `.hl-stage{ position:relative; overflow:hidden; background-repeat:no-repeat; background-position:center; touch-action:none; user-select:none; -webkit-user-select:none; }
.hl-stage .hl-char{ position:absolute; inset:0; }
.hl-stage .hl-char svg{ position:absolute; inset:0; width:100%; height:100%; display:block; }
.hl-stage.hl-drag{ cursor:grabbing; }
.hl-stage .hl-cap{ position:absolute; left:50%; bottom:5%; transform:translateX(-50%); max-width:86%; text-align:center; pointer-events:none;
  font:600 clamp(16px, 3.6vmin, 44px)/1.3 var(--font-sans, system-ui, sans-serif); color:#fff; background:rgba(0,0,0,.62); padding:.25em .7em; border-radius:.4em; }
.hl-stage .hl-cap:empty{ display:none; }`;
    document.head.appendChild(st);
  }
  let W = 1, H = 1;
  const measure = () => { const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); lastKey = ''; };
  const ro = global.ResizeObserver ? new ResizeObserver(measure) : null;
  if(ro) ro.observe(host); else global.addEventListener('resize', measure);
  measure();

  /* ── background ── */
  function setBackground(bg){
    o.background = {...o.background, ...(bg || {})};
    const b = o.background;
    host.style.backgroundColor = b.type === 'color' ? (b.color || '#00B140') : 'transparent';
    host.style.backgroundImage = b.type === 'image' && b.image ? `url("${String(b.image).replace(/"/g, '%22')}")` : 'none';
    host.style.backgroundSize = b.fit === 'contain' ? 'contain' : b.fit === 'stretch' ? '100% 100%' : 'cover';
  }

  /* ── camera: a view box over the character's 600 × 590 stage, with the view's own proportions ── */
  const cam = {x:300, y:295, zoom:1};
  function camVB(){ const h = HC.STAGE.h / cam.zoom, w = h * W / H; return [cam.x - w / 2, cam.y - h / 2, w, h]; }
  function setCamera(c, quiet){
    if(c){ if(isFinite(c.x)) cam.x = clamp(+c.x, -1500, 2100); if(isFinite(c.y)) cam.y = clamp(+c.y, -1500, 2100); if(isFinite(c.zoom)) cam.zoom = clamp(+c.zoom, 0.2, 12); }
    o.camera = {...cam}; lastKey = '';
    if(!quiet) onCamera({...cam});
  }
  const getCamera = () => ({...cam});
  /* framing presets, as in the visual novel: full = the whole figure, medium = from the waist up, close-up = head and shoulders */
  function shot(kind){
    const p = HC.pivots(base), nk = p.neck, top = nk.y - 122;
    const bottom = kind === 'closeup' ? nk.y + 46 : kind === 'medium' ? p.pelvis.y + 18 : HC.STAGE.ground + 14;
    const h = (bottom - top) * (kind === 'full' ? 1.06 : 1.04), zoom = HC.STAGE.h / h;
    setCamera({x:nk.x, y:kind === 'full' ? (top + bottom) / 2 : bottom - h / 2, zoom});
  }
  /* drag to pan (any mouse button), wheel to zoom at the pointer */
  let drag = null;
  const toStage = (cx, cy) => { const r = host.getBoundingClientRect(), vb = camVB(); return {x:vb[0] + (cx - r.left) / W * vb[2], y:vb[1] + (cy - r.top) / H * vb[3]}; };
  host.addEventListener('contextmenu', e => { if(!o.lockCamera) e.preventDefault(); });
  host.addEventListener('pointerdown', e => {
    if(o.lockCamera || e.target.closest('button, input, select, a')) return;
    drag = {id:e.pointerId, x:e.clientX, y:e.clientY}; host.classList.add('hl-drag');
    try{ host.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  });
  host.addEventListener('pointermove', e => {
    if(!drag || e.pointerId !== drag.id) return;
    const k = camVB()[3] / H;
    setCamera({x:cam.x - (e.clientX - drag.x) * k, y:cam.y - (e.clientY - drag.y) * k});
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = () => { drag = null; host.classList.remove('hl-drag'); };
  host.addEventListener('pointerup', endDrag); host.addEventListener('pointercancel', endDrag); host.addEventListener('lostpointercapture', endDrag);
  host.addEventListener('wheel', e => {
    if(o.lockCamera) return;
    e.preventDefault();
    const p = toStage(e.clientX, e.clientY), dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    const z1 = clamp(cam.zoom * Math.exp(-dy * 0.0015), 0.2, 12), k = cam.zoom / z1;
    setCamera({x:p.x - (p.x - cam.x) * k, y:p.y - (p.y - cam.y) * k, zoom:z1});
  }, {passive:false});

  /* ── the character ── */
  let base = null;
  function setCharacter(data){ base = HC.normalize(data || HC.defaults()); lastKey = ''; }

  /* ── microphone: one analysis per animation frame ──
     Each frame gives a sample {t, db, voiced, mouth}: the mouth the audio suggests. Voice = louder than the
     noise floor (tracked: it falls at once and rises slowly) by the sensitivity. Shapes: a hiss (most energy
     above 4 kHz) → C·D·G…; quiet voice → C·D·G…; louder voice → a vowel from the first two peaks of the smoothed
     spectrum (a rough F1 and F2): open → A·I, front → E, back and close → U, back → O. A short silence right
     after voice is drawn as M·B·P (lips closing), a longer one as rest. A shape must last two frames to show,
     so the mouth never flickers. */
  let ac = null, stream = null, an = null, tbuf = null, fbuf = null, pre = null;
  let floor = -60, mouthNow = 'rest', mouthSince = 0, cand = 'rest', candN = 0, lastVoiced = -9, vAvg = 0, lastBeat = -9;
  const samples = [];           /* {t, db, voiced, mouth}, oldest first */
  const utts = []; let curUtt = null;   /* stretches of voice, for placing recognised sentences */
  const beats = [];             /* {t0, t1, value} small nods on loud syllables */
  async function startMic(){
    if(stream) return true;
    try{
      stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:true, autoGainControl:false}});
    }catch(e){ onStatus('The microphone could not be opened: ' + (e && e.message || e)); stream = null; return false; }
    ac = new (global.AudioContext || global.webkitAudioContext)();
    if(ac.state === 'suspended') try{ await ac.resume(); }catch(_){}
    const src = ac.createMediaStreamSource(stream);
    an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.2;
    src.connect(an);
    tbuf = new Float32Array(an.fftSize); fbuf = new Float32Array(an.frequencyBinCount); pre = new Float64Array(an.frequencyBinCount + 1);
    floor = -60; onStatus('Microphone on.');
    return true;
  }
  function stopMic(){
    if(stream) stream.getTracks().forEach(t => t.stop());
    if(ac) try{ ac.close(); }catch(_){}
    stream = null; ac = null; an = null; curUtt = null; mouthNow = 'rest';
    stopRecognition(); onStatus('Microphone off.');
  }
  /* ── the audio mouth ──
     Each frame is measured three ways: loudness (against a noise floor), the loudness of the hiss band (2.5–9 kHz,
     against its own floor, because F, V and Th are so quiet they often stay under the voice gate), and the spectral
     shape: 16 bands from 150 Hz to 9 kHz, in dB, with their average taken off.
     Without calibration, rules read the shape:
       hiss, peaked and strong (S, Z, Sh) → C·D·G… · hiss, flat and weak (F, V, Th) → F·V
       nasal hum (most energy under 500 Hz) → C·D·G… (N; M can't be told apart without calibration)
       weaker voice with a low first and mid second formant → L
       vowels by their first two formants → A·I, E, O, U; U right where a stretch of voice starts → W·Q
     With calibration (calibrate(id) for each sound), every frame is matched against the speaker's own recordings of
     aah, eee, ooh, ooo, fff, vvv, sss, shh, mmm, nnn and lll first; the rules only decide when nothing is close. */
  const NB = 16, EDGES = Array.from({length:NB + 1}, (_, i) => 150 * Math.pow(9000 / 150, i / NB));
  let hiFloor = -90, vRef = null, prevVoiced = false, onsetAt = -9, recording = null;
  function features(){
    an.getFloatFrequencyData(fbuf);
    const n = fbuf.length, hz = ac.sampleRate / an.fftSize;
    for(let i = 0; i < n; i++) pre[i + 1] = pre[i] + (isFinite(fbuf[i]) ? Math.pow(10, fbuf[i] / 10) : 0);
    const bin = f => clamp(Math.round(f / hz), 0, n - 1), band = (a, b) => pre[bin(b) + 1] - pre[bin(a)] + 1e-14;
    const bands = new Array(NB); let mean = 0;
    for(let i = 0; i < NB; i++){ bands[i] = 10 * Math.log10(band(EDGES[i], EDGES[i + 1])); mean += bands[i] / NB; }
    const shape = bands.map(b => b - mean), total = band(150, 9000);
    /* hiss band: level, flatness (1 = noise-like, 0 = one peak) and centre of gravity */
    let lg = 0, ar = 0, cw = 0, m = 0;
    for(let i = bin(2000); i <= bin(9000); i++){ const p = isFinite(fbuf[i]) ? Math.pow(10, fbuf[i] / 10) : 1e-14; lg += Math.log(p + 1e-14); ar += p; cw += p * i * hz; m++; }
    const flat = Math.exp(lg / m) / (ar / m + 1e-14), cent = cw / (ar + 1e-14);
    const w = Math.max(2, Math.round(110 / hz));
    const peak = (a, b) => { let best = -1, at = a; for(let i = bin(a); i <= bin(b); i++){ const s = Math.max(0, i - w), e = Math.min(n - 1, i + w), q = (pre[e + 1] - pre[s]) / (e - s + 1); if(q > best){ best = q; at = i * hz; } } return at; };
    return {shape, hiDb:10 * Math.log10(band(2500, 9000)), hiShare:band(4000, 9000) / total, lowShare:band(150, 500) / total, flat, cent, f1:peak(250, 950), f2:peak(950, 2800)};
  }
  const CAL_MOUTH = {aah:'ai', eee:'e', ooh:'o', ooo:'u', fff:'fv', vvv:'fv', sss:'cdg', shh:'cdg', mmm:'mbp', nnn:'cdg', lll:'l'};
  const FRIC = new Set(['fff', 'vvv', 'sss', 'shh']);
  function matchCal(F, rel, hissOnly){
    const cal = o.calibration || {}, aah = cal.aah;
    let best = null;
    for(const [id, tp] of Object.entries(cal)){
      if(!CAL_MOUTH[id] || !tp || !tp.shape || (hissOnly && !FRIC.has(id))) continue;
      let d = 0; for(let i = 0; i < NB; i++) d += (F.shape[i] - tp.shape[i]) ** 2;
      d = Math.sqrt(d / NB) + (aah && rel !== null ? 0.2 * Math.abs(rel - (tp.db - aah.db)) : 0);
      if(!best || d < best.d) best = {id, d};
    }
    return best && best.d < 7 ? CAL_MOUTH[best.id] : null;
  }
  function classify(t){
    an.getFloatTimeDomainData(tbuf);
    let sum = 0; for(let i = 0; i < tbuf.length; i++) sum += tbuf[i] * tbuf[i];
    const db = 10 * Math.log10(sum / tbuf.length + 1e-12);
    floor = db < floor ? db : Math.min(floor + 0.015, -20);   /* falls at once, rises about 1 dB a second */
    const gate = Math.max(floor + o.sensitivity, -62), v = db - gate;
    onLevel(db, gate, floor);
    const F = features();
    hiFloor = F.hiDb < hiFloor ? F.hiDb : Math.min(hiFloor + 0.015, -25);
    const hiss = F.hiDb > hiFloor + o.sensitivity + 3 && F.hiShare > 0.2;   /* a fricative, even under the voice gate */
    if(recording && (v >= 0 || hiss)) recording.frames.push({shape:F.shape, db});
    if(v < 0 && !hiss){ prevVoiced = false; return {db, voiced:false, mouth:t - lastVoiced < 0.16 ? 'mbp' : 'rest'}; }
    lastVoiced = t;
    if(!prevVoiced) onsetAt = t;
    prevVoiced = true;
    if(o.mouthDetail === 'loudness') return {db, voiced:true, v, mouth:v < 5 ? 'cdg' : v < 13 ? 'e' : 'ai'};
    const cal = o.calibration || {};
    if(vRef === null && cal.aah) vRef = cal.aah.db;
    const rel = vRef === null ? null : db - vRef;
    let mouth = matchCal(F, rel, v < 0);
    if(!mouth){
      if(hiss && (v < 4 || F.hiShare > 0.45)) mouth = F.flat < 0.3 && F.cent > 3500 && (rel === null || rel > -22) ? 'cdg' : 'fv';
      else if(v < 0) mouth = 'fv';
      else if(F.lowShare > 0.8 && (rel === null || rel < -8)) mouth = 'cdg';
      else if(rel !== null && rel < -6 && F.f1 < 450 && F.f2 > 1000 && F.f2 < 1600) mouth = 'l';
      else if(v < 5) mouth = 'cdg';
      else mouth = F.f1 > 700 ? 'ai' : F.f2 > 1750 ? 'e' : (F.f1 < 420 && F.f2 < 1050) ? 'u' : F.f2 < 1250 ? 'o' : v > 14 ? 'ai' : 'e';
    }
    if(mouth === 'u' && t - onsetAt < 0.12) mouth = 'wq';   /* lips rounding into a sound: W, Q */
    if((mouth === 'ai' || mouth === 'e' || mouth === 'o') && v > 8)   /* the speaker's vowel loudness: follows peaks quickly, drops slowly */
      vRef = vRef === null ? db : vRef + (db - vRef) * (db > vRef ? 0.2 : 0.01);
    return {db, voiced:true, v, mouth};
  }
  /* calibration: record one sound for a moment and keep its average shape and loudness */
  function calibrate(id, seconds){
    if(!CAL_MOUTH[id]) return Promise.reject(new Error('Unknown sound: ' + id));
    if(!an) return Promise.reject(new Error('Start the microphone first.'));
    if(recording) return Promise.reject(new Error('Already recording.'));
    const rec = recording = {id, frames:[]};
    return new Promise(done => setTimeout(() => {
      recording = null;
      const fr = rec.frames.slice(Math.floor(rec.frames.length * 0.15));   /* skip the start of the sound */
      if(fr.length < 10){ done({ok:false, frames:fr.length}); return; }
      const shape = new Array(NB).fill(0); for(const f of fr) for(let i = 0; i < NB; i++) shape[i] += f.shape[i] / fr.length;
      const dbs = fr.map(f => f.db).sort((a, b) => a - b);
      o.calibration = {...(o.calibration || {}), [id]:{shape:shape.map(x => +x.toFixed(2)), db:+dbs[dbs.length >> 1].toFixed(2)}};
      if(id === 'aah') vRef = o.calibration.aah.db;
      done({ok:true, frames:fr.length, calibration:o.calibration});
    }, (seconds || 1.6) * 1000));
  }
  function analyse(t){
    const r = classify(t);
    if(r.mouth === cand) candN++; else { cand = r.mouth; candN = 1; }
    if(cand !== mouthNow && candN >= 2 && t - mouthSince >= 0.06){ mouthNow = cand; mouthSince = t; }
    samples.push({t, db:r.db, voiced:r.voiced, mouth:mouthNow});
    while(samples.length && samples[0].t < t - o.delay - 40) samples.shift();
    /* stretches of voice: a new one after 0.6 s of quiet */
    if(r.voiced){ if(!curUtt){ curUtt = {start:t, end:t, assigned:false}; utts.push(curUtt); } curUtt.end = t; }
    else if(curUtt && t - curUtt.end > 0.6) curUtt = null;
    while(utts.length > 60) utts.shift();
    /* beat nods: a syllable clearly louder than the running level */
    if(r.voiced){
      if(o.beats && r.v > vAvg + 7 && t - lastBeat > 0.45){ lastBeat = t; beats.push({t0:t, t1:t + 0.32, value:o.beatStrength}); }
      vAvg += (r.v - vAvg) * 0.08;
    } else vAvg *= 0.98;
    while(beats.length && beats[0].t1 < t - o.delay - 2) beats.shift();
  }
  function sampleAt(td){
    let a = 0, b = samples.length - 1; if(b < 0 || samples[0].t > td) return null;
    while(a < b){ const m = (a + b + 1) >> 1; if(samples[m].t <= td) a = m; else b = m - 1; }
    return td - samples[a].t > 0.2 ? null : samples[a];
  }

  /* ── recognised sentences ──
     A final result is laid over the stretch of voice it came from: its lip-sync shapes (HouseCharacter.speech)
     are spread over the moments in that stretch when there was voice, in order, so pauses stay closed. Words,
     prosody events and keyword gestures are placed on the same map. */
  const segs = [];
  function segFrom(text, T){
    const lang2 = /^es/i.test(o.lang) ? 'es' : 'en';
    const sp = HC.speech(text, {fps:FPS, wpm:150, lang:lang2, restMouth:REST});
    if(!sp.keys.length) return null;
    const cand = utts.filter(u => !u.assigned && u.start <= T);
    let start, end;
    if(cand.length){
      start = Math.min(...cand.map(u => u.start)); end = Math.max(...cand.map(u => Math.min(u.end, T)));
      cand.forEach(u => u.assigned = true);
      if(curUtt && cand.includes(curUtt)){ curUtt.end = T; curUtt = null; }   /* still talking: what follows is the next sentence */
    } else { end = T - 0.3; start = end - sp.seconds; }
    const prev = segs[segs.length - 1]; if(prev && start < prev.end) start = prev.end;
    if(end - start < 0.15) end = start + 0.15;
    /* the shapes as stretches of active (non-rest) speech time */
    const act = []; let S = 0;
    sp.keys.forEach((k, i) => { const a = k.frame / FPS, b = (i + 1 < sp.keys.length ? sp.keys[i + 1].frame : sp.frames) / FPS;
      if(k.mouth !== REST && b > a){ act.push({s0:a, s1:b, a0:S, a1:S + b - a, mouth:k.mouth}); S += b - a; } });
    /* how much voice there was by each moment of the stretch */
    const ts = [], cv = []; let V = 0, prevT = null;
    for(const s of samples){ if(s.t < start) continue; if(s.t > end) break; if(prevT !== null && s.voiced) V += Math.min(0.1, s.t - prevT); ts.push(s.t); cv.push(V); prevT = s.t; }
    const seg = {text, sp, start, end, act, S, ts, cv, V};
    seg.words = sp.words.map(w => ({word:w.word, to:w.to, t:absOf(seg, w.start / FPS)}));
    return seg;
  }
  const findLE = (arr, x) => { let a = 0, b = arr.length - 1; if(b < 0 || arr[0] > x) return -1; while(a < b){ const m = (a + b + 1) >> 1; if(arr[m] <= x) a = m; else b = m - 1; } return a; };
  function voiceBy(seg, t){ const i = findLE(seg.ts, t); return i < 0 ? 0 : seg.cv[i]; }
  /* speech seconds → active speech seconds → a moment in the stretch */
  function absOf(seg, sec){
    if(sec <= 0) return seg.start + sec;
    if(sec >= seg.sp.seconds) return seg.end + (sec - seg.sp.seconds);
    let a = 0; for(const x of seg.act){ if(sec >= x.s1) a = x.a1; else { if(sec > x.s0) a = x.a0 + sec - x.s0; break; } }
    if(seg.V < 0.05 || seg.S <= 0) return seg.start + sec / seg.sp.seconds * (seg.end - seg.start);
    const target = a / seg.S * seg.V; let lo = 0, hi = seg.cv.length - 1;
    if(hi < 0) return seg.start;
    while(lo < hi){ const m = (lo + hi) >> 1; if(seg.cv[m] < target) lo = m + 1; else hi = m; }
    return seg.ts[lo];
  }
  function textMouth(seg, td){
    const f = seg.V >= 0.05 ? voiceBy(seg, td) / seg.V : (td - seg.start) / (seg.end - seg.start);
    const a = clamp(f, 0, 1) * seg.S;
    for(const x of seg.act) if(a < x.a1) return x.mouth;
    return seg.act.length ? seg.act[seg.act.length - 1].mouth : null;
  }
  const segAt = td => { for(let i = segs.length - 1; i >= 0; i--){ const s = segs[i]; if(td >= s.start && td <= s.end) return s; if(s.end < td) break; } return null; };

  /* prosody events on the absolute clock: {t0, t1, kind, shape, value} */
  const pros = [];
  function addProsody(seg){
    if(!o.prosody || !HC.prosody) return;
    const lang2 = /^es/i.test(o.lang) ? 'es' : 'en';
    let r; try{ r = HC.prosody(seg.text, seg.sp, {fps:FPS, lang:lang2, view:base.head === 'front' ? 'front' : 'side'}); }catch(e){ console.error(e); return; }
    for(const e of r.events){
      const t0 = absOf(seg, e.frame / FPS); let t1 = absOf(seg, (e.frame + e.dur) / FPS);
      if(t1 - t0 < 0.1) t1 = t0 + (e.kind === 'blink' ? 0.1 : 0.2);
      pros.push({t0, t1, kind:e.kind, shape:e.shape, value:e.value});
    }
  }

  /* ── gestures: {clip, t0} on the absolute clock; a hotkey at real time t plays when the display reaches t,
     in step with the delayed voice ── */
  const clips = CLIPS.slice();
  const playing = [];
  const lastAuto = {}; let lastAnyAuto = -9;
  function gesture(id, t){ const c = clips.find(x => x.id === id); if(!c) return false; playing.push({clip:c, t0:t === undefined ? now() : t}); return true; }
  function autoGesture(id, t){
    if(!o.autoGestures) return;
    if(t - (lastAuto[id] ?? -9) < 3 || t - lastAnyAuto < 1.2) return;
    lastAuto[id] = t; lastAnyAuto = t; gesture(id, t);
  }
  /* keyword matches in a list of words: [{id, at}] (at = index of the phrase's first word) */
  function matches(words, from){
    const lang2 = /^es/i.test(o.lang) ? 'es' : 'en', out = [];
    for(const c of clips){
      for(const ph of (c.keywords && c.keywords[lang2]) || []){
        const p = normWords(ph); if(!p.length) continue;
        if(c.short && words.length > 3) continue;   /* yes / no only as a short answer, not inside a sentence */
        for(let i = 0; i + p.length <= words.length; i++){
          if(i + p.length - 1 < (from || 0)) continue;
          if(p.every((w, k) => words[i + k] === w)){ out.push({id:c.id, at:i}); break; }
        }
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }

  /* emotions: {t, face|null} on the absolute clock */
  const emotions = [];
  function emotion(id, t){
    const e = id === 'neutral' || !id ? null : (() => { const all = HC.EMOTIONS.flatMap(g => g[1]); const x = all.find(y => y[0] === id); return x ? {brows:x[2], eyes:x[3], mouth:x[4]} : null; })();
    if(id && id !== 'neutral' && !e) return false;
    emotions.push({t:t === undefined ? now() : t, face:e}); if(emotions.length > 50) emotions.shift();
    return true;
  }
  const emotionAt = td => { for(let i = emotions.length - 1; i >= 0; i--) if(emotions[i].t <= td) return emotions[i].face; return null; };

  /* ── speech recognition ── */
  const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  let rec = null, recWanted = false, session = 0, liveText = '', liveAt = 0;
  const seen = {};   /* words already scanned for keywords, per result */
  async function startRecognition(){
    if(!SR){ onStatus('Speech recognition is not available in this browser (Chrome, Edge or Safari have it). The mouth still follows the microphone.'); return false; }
    recWanted = true;
    if(rec) return true;
    let local = false;
    if(o.onDevice && SR.available){
      try{
        const st = await SR.available({langs:[o.lang], processLocally:true});
        if(st === 'available') local = true;
        else if(st === 'downloadable' || st === 'downloading'){
          onStatus(`Downloading the on-device language pack for ${o.lang}…`);
          local = await SR.install({langs:[o.lang], processLocally:true}).catch(() => false);
          if(!local) onStatus('The on-device pack could not be installed; using the browser’s online recognition.');
        } else onStatus(`On-device recognition has no ${o.lang} pack here; using the browser’s online recognition.`);
      }catch(_){ local = false; }
    }
    if(!recWanted) return false;
    rec = new SR(); rec.lang = o.lang; rec.continuous = true; rec.interimResults = true;
    if(local && 'processLocally' in rec) rec.processLocally = true;
    const mine = rec; session++;
    rec.onresult = e => {
      const T = now();
      let interim = '';
      for(let i = e.resultIndex; i < e.results.length; i++){
        const r = e.results[i], txt = r[0].transcript, key = session + ':' + i;
        if(o.delay < 0.6){   /* little or no delay: gestures as soon as the words are heard */
          const words = normWords(txt);
          for(const m of matches(words, seen[key] || 0)) autoGesture(m.id, T);
          seen[key] = words.length;
        }
        if(r.isFinal) finalText(txt.trim(), T); else interim += txt;
      }
      liveText = interim.trim(); liveAt = T;
    };
    rec.onerror = e => {
      if(e.error === 'no-speech' || e.error === 'aborted') return;
      onStatus('Speech recognition: ' + e.error + (e.error === 'not-allowed' || e.error === 'service-not-allowed' ? ' (permission refused)' : ''));
      if(e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') recWanted = false;
    };
    rec.onend = () => { if(rec === mine) rec = null; if(recWanted && !dead) setTimeout(() => { if(recWanted && !rec && !dead) startRecognition(); }, 300); };
    try{ rec.start(); onStatus(`Listening (${o.lang}${local ? ', on-device' : ''}).`); }catch(e){ onStatus('Speech recognition could not start: ' + e.message); rec = null; return false; }
    return true;
  }
  function stopRecognition(){ recWanted = false; if(rec){ const r = rec; rec = null; try{ r.abort(); }catch(_){} } liveText = ''; }
  function finalText(text, T){
    if(!text || !base) return;
    const seg = segFrom(text, T); if(!seg) return;
    segs.push(seg); while(segs.length > 40) segs.shift();
    addProsody(seg);
    if(o.delay >= 0.6){   /* gestures on their words, a moment before (or now, if that moment has gone) */
      const td = T - o.delay, words = seg.words.map(w => normWords(w.word).join(' ')).join(' ').split(' ').filter(Boolean);
      for(const m of matches(words, 0)){
        const w = seg.words[Math.min(m.at, seg.words.length - 1)], at = w.t - 0.15;
        if(td - at > 1.5) continue;
        autoGesture(m.id, Math.max(at, td));
      }
    }
    onTranscript(text);
  }
  function caption(td, t){
    if(!o.captions){ if(capEl.textContent) capEl.textContent = ''; return; }
    let txt = '';
    if(o.delay < 0.6 && liveText && t - liveAt < 3) txt = liveText;
    else for(let i = segs.length - 1; i >= 0; i--){
      const s = segs[i];
      if(s.start > td) continue;
      if(td > s.end + 2.5) break;
      let to = 0; for(const w of s.words) if(w.t <= td) to = w.to;
      txt = s.text.slice(0, to).trim(); break;
    }
    if(capEl.textContent !== txt) capEl.textContent = txt;
  }

  /* ── one frame of the character, at display time td ── */
  let nextBlink = now() + 2, blinkEnd = 0, secondBlink = false, idleT = 0, idleLast = now();
  const fine = {rot:0, dx:0, dy:0, sy:1};
  function compose(td, t){
    const d = cloneData(base), I = o.idle;
    /* idle life on its own clock, so a change of speed never makes the motion jump */
    idleT += Math.min(0.1, t - idleLast) * (I.on ? I.speed : 0); idleLast = t;
    const k = I.on ? 1 : 0, it = idleT;
    /* whole-figure motion, drawn as a fine transform (see applyFine) */
    const breath = 0.5 - 0.5 * Math.cos(2 * Math.PI * 0.24 * it + 0.35 * Math.sin(2 * Math.PI * 0.24 * it));   /* in a little faster than out */
    fine.rot = k * I.sway * drift(it, 0.11, 0.4);
    fine.dx = k * I.shift * drift(it, 0.06, 2.1);
    fine.sy = 1 + k * I.breathe / 100 * breath;
    fine.dy = 0;
    /* joint motion */
    if(k){
      d.joints.torso = (d.joints.torso || 0) + I.torso * drift(it, 0.13, 1.3);
      d.joints.neck = (d.joints.neck || 0) + I.head * drift(it, 0.09, 3.1);
      d.headNod = clamp((d.headNod || 0) + I.head * 0.8 * drift(it, 0.15, 0.7), -30, 30);   /* nods are drawn to a tenth of a degree */
      const a = I.arms * drift(it, 0.12, 5.2), b = I.arms * drift(it, 0.1, 0.9);
      d.joints.shoulderL = (d.joints.shoulderL || 0) - a * 0.8 - I.arms * 0.6 * breath;
      d.joints.shoulderR = (d.joints.shoulderR || 0) + b * 0.8 + I.arms * 0.6 * breath;
      d.joints.elbowL = (d.joints.elbowL || 0) - b * 0.6;
      d.joints.elbowR = (d.joints.elbowR || 0) + a * 0.6;
    }
    /* face: the emotion in force, else the character's own */
    const em = emotionAt(td);
    if(em){ d.eyebrows = em.brows; d.eyes = em.eyes; }
    const exprMouth = em ? em.mouth : base.mouth, restMouth = LIP.includes(exprMouth) ? 'rest' : exprMouth;
    /* gestures, each faded in and out over what is there */
    for(let i = playing.length - 1; i >= 0; i--) if(playing[i].t0 + playing[i].clip.dur < td - 1) playing.splice(i, 1);
    for(const g of playing){
      const c = g.clip, lt = td - g.t0; if(lt < 0 || lt > c.dur) continue;
      const w = smooth(Math.min(lt / 0.25, (c.dur - lt) / 0.3, 1)), f = lt * c.fps;
      for(const tr of c.tracks){
        const v = trackValue(tr, f), k = tr.param;
        if(JOINTS.has(k) && typeof v === 'number'){ const cur = d.joints[k] || 0; d.joints[k] = cur + HC.jointDelta(k, cur, v) * w; }
        else if(NUMERIC.has(k) && typeof v === 'number'){ const cur = d[k] || 0; d[k] = cur + (v - cur) * w; }
        else if(w > 0.5) setP(d, k, v);
      }
    }
    /* prosody and beat nods */
    let nod = 0, tilt = 0, brows = null, blink = false, bStart = -Infinity;
    while(pros.length && pros[0].t1 < td - 5) pros.shift();
    for(const e of pros){
      if(td < e.t0 || td > e.t1) continue;
      if(e.kind === 'blink'){ blink = true; continue; }
      if(e.kind === 'brows'){ if(e.t0 >= bStart){ brows = e.value; bStart = e.t0; } continue; }
      const amp = e.shape === 'beat' ? Math.sin(Math.PI * (td - e.t0) / (e.t1 - e.t0)) : smooth(Math.min((td - e.t0) / 0.2, (e.t1 - td) / 0.2));
      if(e.kind === 'nod') nod += e.value * amp; else if(e.kind === 'tilt') tilt += e.value * amp;
    }
    for(const b of beats) if(td >= b.t0 && td <= b.t1) nod += b.value * Math.sin(Math.PI * (td - b.t0) / (b.t1 - b.t0));
    if(nod) d.headNod = clamp((d.headNod || 0) + nod, -30, 30);
    if(tilt) d.joints.neck = (d.joints.neck || 0) + tilt;
    if(brows && d.eyebrows === 'neutral') d.eyebrows = brows;
    /* blinks: every few seconds, sometimes twice */
    if(I.on && I.blinks && t >= nextBlink){
      blinkEnd = t + 0.11 + Math.random() * 0.05;
      const again = !secondBlink && Math.random() * 100 < I.doubleBlink;
      nextBlink = t + (again ? 0.28 : 60 / I.blinkRate * (0.6 + Math.random() * 0.8)); secondBlink = again;
    }
    if(!(I.on && I.blinks)) nextBlink = Math.max(nextBlink, t + 0.5);
    if((blink || t < blinkEnd) && ['open', 'wide', 'narrow'].includes(d.eyes)) d.eyes = 'closed';
    /* mouth */
    let mouth = restMouth;
    const s = an || samples.length ? sampleAt(td) : null;
    if(s){
      const seg = o.mouthMode === 'audio' ? null : segAt(td);
      const tm = seg && s.voiced ? textMouth(seg, td) : null;
      mouth = tm || (s.mouth === 'rest' ? restMouth : s.mouth);
    }
    d.mouth = mouth;
    return d;
  }
  function draw(d){
    const vb = camVB().map(v => v.toFixed(2)).join(' '), key = JSON.stringify(d) + vb;
    if(key === lastKey) return;
    lastKey = key;
    charEl.innerHTML = HC.render(d).replace(/viewBox="[^"]*"/, `viewBox="${vb}" preserveAspectRatio="xMidYMid meet"`)
      .replace(/(<svg[^>]*>)/, '$1<g class="hl-fine">').replace(/<\/svg>\s*$/, '</g></svg>');
    fineEl = charEl.querySelector('.hl-fine');
  }
  /* the whole-figure idle motion: a turn about the feet, a sideways shift, and breathing as a slight stretch upward */
  let fineEl = null;
  function applyFine(){
    if(!fineEl) return;
    const x = HC.STAGE.cx, g = HC.STAGE.ground;
    fineEl.setAttribute('transform', `translate(${(x + fine.dx).toFixed(2)} ${(g + fine.dy).toFixed(2)}) rotate(${fine.rot.toFixed(3)}) scale(1 ${fine.sy.toFixed(4)}) translate(${-x} ${-g})`);
  }
  function frame(){
    if(dead) return;
    raf = requestAnimationFrame(frame);
    const t = now();
    if(an) try{ analyse(t); }catch(e){ console.error(e); }
    const td = t - o.delay;
    caption(td, t);
    if(t - lastDraw < 1 / clamp(o.fps, 5, 60) - 0.002) return;
    lastDraw = t;
    try{ draw(compose(td, t)); applyFine(); }catch(e){ console.error(e); }
  }

  function set(opts){
    const was = {lang:o.lang, onDevice:o.onDevice}, idle = o.idle;
    Object.assign(o, opts || {});
    o.idle = {...idle};
    if(opts && opts.idle) for(const [k, v] of Object.entries(opts.idle)){
      if(IDLE_RANGE[k]) o.idle[k] = clamp(Number(v) || 0, IDLE_RANGE[k][0], IDLE_RANGE[k][1]);
      else if(k === 'on' || k === 'blinks') o.idle[k] = !!v;
    }
    if(opts && 'beatStrength' in opts) o.beatStrength = clamp(Number(opts.beatStrength) || 0, 0, 10);
    if(opts && 'delay' in opts) o.delay = clamp(Number(opts.delay) || 0, 0, 5);
    if(opts && 'sensitivity' in opts) o.sensitivity = clamp(Number(opts.sensitivity) || 9, 2, 30);
    if(opts && opts.background) setBackground(opts.background);
    if(opts && opts.camera) setCamera(opts.camera, true);
    if(opts && opts.character) setCharacter(opts.character);
    if(opts && !o.captions) capEl.textContent = '';
    if(rec && (was.lang !== o.lang || was.onDevice !== o.onDevice)){ stopRecognition(); startRecognition(); }
    lastKey = '';
  }
  function addClip(id, anim, meta){
    if(!id || !anim) return null;
    const c = makeClip(String(id), anim, meta || {});
    if(!c.tracks.length) return null;
    const i = clips.findIndex(x => x.id === c.id);
    if(i >= 0) clips[i] = c; else clips.push(c);
    return c;
  }
  function removeClip(id){ const i = clips.findIndex(x => x.id === id && !x.builtin); if(i >= 0) clips.splice(i, 1); }
  function destroy(){
    dead = true; cancelAnimationFrame(raf); stopMic();
    if(ro) ro.disconnect(); else global.removeEventListener('resize', measure);
    host.innerHTML = ''; host.classList.remove('hl-stage');
  }

  setCharacter(o.character); setBackground(o.background); setCamera(o.camera, true);
  o.delay = clamp(Number(o.delay) || 0, 0, 5);
  raf = requestAnimationFrame(frame);
  return {startMic, stopMic, get micOn(){ return !!stream; }, startRecognition, stopRecognition, get recognitionOn(){ return recWanted; },
    setCharacter, setBackground, setCamera, getCamera, shot, setDelay:s => set({delay:s}), set, get options(){ return {...o}; },
    calibrate, get calibration(){ return {...(o.calibration || {})}; }, clearCalibration:() => { o.calibration = {}; vRef = null; },
    gesture:id => gesture(id), emotion:id => emotion(id), get clips(){ return clips.slice(); }, addClip, removeClip, destroy,
    /* for tests: feed a recognised sentence as if it had just been heard */
    _final:text => finalText(text, now())};
}

const SOUNDS = [['aah','“aah” (father)'],['eee','“eee” (see)'],['ooh','“oh” (go)'],['ooo','“ooo” (food)'],['fff','“fff”'],['vvv','“vvv”'],['sss','“sss”'],['shh','“shh”'],['mmm','“mmm” (lips closed)'],['nnn','“nnn”'],['lll','“lll”']];
global.HouseLive = {create, CLIPS, EMOTIONS, IDLE, IDLE_RANGE, SOUNDS, makeClip};
})(window);
