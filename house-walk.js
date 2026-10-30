/* ══════════════════════════════════════════════════════════════════════════
   house-walk.js — house characters on the move: the keyframe editor's animations
   (character-keyframes.html, files in animations/) played in the house, and a way
   round the house from one spot to another.

   Load it after house-character.js (and house-engine.js for HouseWalk.route).

     HouseWalk.ANIMS                    the animations, by id: walking, running, sitting-down,
                                        standing-up, entering-bed, exiting-bed. The copies built in
                                        here are the files in animations/ as they were saved from
                                        the keyframe editor; HouseWalk.load() fetches the folder's
                                        own files over them (so editing one in the keyframe editor
                                        changes how people move), HouseWalk.add(id, json) adds one.
     HouseWalk.frames(id)               how many frames one play (or one cycle of a loop) lasts
     HouseWalk.pose(id, frame, c)       character c in that animation's pose at that frame (its own
                                        look, face and clothes; the animation's joints, turns and head,
                                        and its eyes if it moves them) → { d, lift, shift } with lift
                                        (up) and shift (sideways, + toward the back of a side view)
                                        in metres
     HouseWalk.route(eng, L, from, to, opts)
                                        a way from [x, y] to [x, y] on floor L that keeps clear of
                                        walls, windows, fences, columns, stairs, furniture and pools,
                                        and goes through doors and gates → [[x, y], …] or null
                                        opts.radius  how far from anything the middle of a person
                                                     keeps (0.2 m); opts.others  [[x, y], …] people
                                                     standing about; opts.pool  true: the pools are
                                                     water to wade into, not walls
     HouseWalk.trip(character, legs)    a whole outing, as legs played one after another:
       { walk: [[x, y], …], gait: 'walking' | 'running', swimIn: fn(x, y) }  along a route
       { play: id, x, y, facing, back: true }   an animation on the spot (sitting-down,
                                                standing-up…); its shift moves the person along
                                                the way they face, from (x, y) where shift is 0
       { turn: degrees, x, y }                  turn round on the spot, standing
       { stand: seconds, x, y, facing }         wait
     → { seconds, at(t) } where at(t) gives what to draw t seconds in: { x, y, z, facing,
       d (the posed character), leg, u (0–1 through the leg), done }

   Walking speed follows the gait and the person's size: an average adult's walking cycle
   (two steps) covers 1.3 m, a running one 2.4 m, and the cycle is played by distance
   covered, so the feet keep pace with the floor.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const HC = () => global.HouseCharacter;

  /* the animations, as saved by the keyframe editor, kept short: the first keyframe's pose
     (joints, turns, head, lift, shift) and each timeline as [frame, value, easeIn?, easeOut?] */
  const ANIMS = {"walking":{"fps":24,"length":24,"loop":true,"loopOut":23,"base":{"joints":{"root":0,"pelvis":0,"torso":-3,"neck":2,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"hipL":[[0,28],[3,22],[6,4],[9,-12],[12,-22],[15,-16],[18,10],[21,28],[24,28]],"kneeL":[[0,-4],[3,-20],[6,-6],[9,-4],[12,-14],[15,-42],[18,-64],[21,-30],[24,-4]],"ankleL":[[0,70],[3,78],[6,82],[9,90],[12,100],[15,112],[18,124],[21,92],[24,70]],"hipR":[[0,-22],[3,-16],[6,10],[9,28],[12,28],[15,22],[18,4],[21,-12],[24,-22]],"kneeR":[[0,-14],[3,-42],[6,-64],[9,-30],[12,-4],[15,-20],[18,-6],[21,-4],[24,-14]],"ankleR":[[0,100],[3,112],[6,124],[9,92],[12,70],[15,78],[18,82],[21,90],[24,100]],"shoulderL":[[0,-24],[3,-18],[6,-4],[9,12],[12,24],[15,18],[18,4],[21,-10],[24,-24]],"elbowL":[[0,10],[3,12],[6,16],[9,24],[12,30],[15,26],[18,18],[21,12],[24,10]],"shoulderR":[[0,24],[3,18],[6,4],[9,-10],[12,-24],[15,-18],[18,-4],[21,12],[24,24]],"elbowR":[[0,30],[3,26],[6,18],[9,12],[12,10],[15,12],[18,16],[21,24],[24,30]]}},"running":{"fps":24,"length":16,"loop":true,"loopOut":15,"base":{"joints":{"root":0,"pelvis":0,"torso":-12,"neck":9,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"hipL":[[0,40],[2,18],[4,-12],[6,-30],[8,-20],[10,18],[12,60],[14,56],[16,40]],"kneeL":[[0,-20],[2,-42],[4,-16],[6,-26],[8,-80],[10,-118],[12,-96],[14,-44],[16,-20]],"ankleL":[[0,72],[2,104],[4,94],[6,104],[8,112],[10,112],[12,102],[14,82],[16,72]],"hipR":[[0,-20],[2,18],[4,60],[6,56],[8,40],[10,18],[12,-12],[14,-30],[16,-20]],"kneeR":[[0,-80],[2,-118],[4,-96],[6,-44],[8,-20],[10,-42],[12,-16],[14,-26],[16,-80]],"ankleR":[[0,112],[2,112],[4,102],[6,82],[8,72],[10,104],[12,94],[14,104],[16,112]],"shoulderL":[[0,-46],[2,-34],[4,-6],[6,26],[8,48],[10,36],[12,10],[14,-24],[16,-46]],"elbowL":[[0,72],[2,76],[4,84],[6,92],[8,96],[10,92],[12,84],[14,76],[16,72]],"shoulderR":[[0,48],[2,36],[4,10],[6,-24],[8,-46],[10,-34],[12,-6],[14,26],[16,48]],"elbowR":[[0,96],[2,92],[4,84],[6,76],[8,72],[10,76],[12,84],[14,92],[16,96]],"lift":[[0,0],[2,0],[4,0],[6,5],[8,0],[10,0],[12,0],[14,5],[16,0]]}},"sitting-down":{"fps":24,"length":36,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[0,4,"linear","sine"],[8,14,"sine","linear"],[16,38],[22,26,"linear","sine"],[30,10,"sine","linear"]],"elbowL":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,24],[22,44,"linear","sine"],[30,60,"sine","linear"]],"shoulderR":[[0,-4,"linear","sine"],[8,10,"sine","linear"],[16,32],[22,28,"linear","sine"],[30,20,"sine","linear"]],"elbowR":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,26],[22,40,"linear","sine"],[30,50,"sine","linear"]],"hipL":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,62],[22,86,"linear","sine"],[30,90,"sine","linear"]],"kneeL":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","linear"]],"ankleL":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,106],[22,86,"linear","sine"],[30,80,"sine","linear"]],"hipR":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,64],[22,88,"linear","sine"],[30,93,"sine","linear"]],"kneeR":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","linear"]],"ankleR":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,104],[22,84,"linear","sine"],[30,80,"sine","linear"]],"torso":[[0,0,"linear","sine"],[8,-16,"sine","linear"],[16,-38],[22,-22,"linear","sine"],[30,0,"sine","linear"]],"neck":[[0,0,"linear","sine"],[8,7,"sine","linear"],[16,18],[22,11,"linear","sine"],[30,0,"sine","linear"]],"shift":[[0,-40.1],[2,-39.3],[6,-35.2],[8,-34.6],[11,-27.9],[15,-22.1],[16,-21.6],[18,-15.4],[22,-5.4],[23,-5.4],[29,0],[30,0]]}},"standing-up":{"fps":24,"length":40,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[6,10,"linear","sine"],[14,26,"sine","linear"],[20,38],[28,14,"linear","sine"],[36,4,"sine","linear"]],"elbowL":[[6,60,"linear","sine"],[14,44,"sine","linear"],[20,24],[28,14,"linear","sine"],[36,8,"sine","linear"]],"shoulderR":[[6,20,"linear","sine"],[14,28,"sine","linear"],[20,32],[28,10,"linear","sine"],[36,-4,"sine","linear"]],"elbowR":[[6,50,"linear","sine"],[14,40,"sine","linear"],[20,26],[28,14,"linear","sine"],[36,8,"sine","linear"]],"hipL":[[6,90,"linear","sine"],[14,86,"sine","linear"],[20,62],[28,22,"linear","sine"],[36,0,"sine","linear"]],"kneeL":[[6,-88,"linear","sine"],[14,-92,"sine","linear"],[20,-88],[28,-36,"linear","sine"],[36,0,"sine","linear"]],"ankleL":[[6,80,"linear","sine"],[14,86,"sine","linear"],[20,106],[28,94,"linear","sine"],[36,80,"sine","linear"]],"hipR":[[6,93,"linear","sine"],[14,88,"sine","linear"],[20,64],[28,22,"linear","sine"],[36,0,"sine","linear"]],"kneeR":[[6,-88,"linear","sine"],[14,-92,"sine","linear"],[20,-88],[28,-36,"linear","sine"],[36,0,"sine","linear"]],"ankleR":[[6,80,"linear","sine"],[14,84,"sine","linear"],[20,104],[28,94,"linear","sine"],[36,80,"sine","linear"]],"torso":[[6,0,"linear","sine"],[14,-22,"sine","linear"],[20,-38],[28,-16,"linear","sine"],[36,0,"sine","linear"]],"neck":[[6,0,"linear","sine"],[14,11,"sine","linear"],[20,18],[28,7,"linear","sine"],[36,0,"sine","linear"]],"shift":[[6,0],[7,0],[13,-5.4],[14,-5.4],[18,-15.4],[20,-21.6],[21,-22.1],[25,-27.9],[28,-34.6],[30,-35.2],[34,-39.3],[36,-40.1]]}},"entering-bed":{"fps":24,"length":86,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[0,4,"linear","sine"],[8,14,"sine","linear"],[16,38],[22,26,"linear","sine"],[30,10,"sine","sine"],[38,14],[48,12,"sine","sine"],[72,-4,"quad","linear"]],"elbowL":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,24],[22,44,"linear","sine"],[30,60,"sine","sine"],[38,56],[48,40,"sine","sine"],[72,6,"quad","linear"]],"shoulderR":[[0,-4,"linear","sine"],[8,10,"sine","linear"],[16,32],[22,28,"linear","sine"],[30,20,"sine","sine"],[38,18],[48,16,"sine","sine"],[72,-8,"quad","linear"]],"elbowR":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,26],[22,40,"linear","sine"],[30,50,"sine","sine"],[38,48],[48,34,"sine","sine"],[72,8,"quad","linear"]],"hipL":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,62],[22,86,"linear","sine"],[30,90,"sine","sine"],[38,86],[48,88,"sine","sine"],[72,0,"quad","linear"]],"kneeL":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","sine"],[38,-48],[48,-2,"sine","sine"],[72,-2,"quad","linear"]],"ankleL":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,106],[22,86,"linear","sine"],[30,80,"sine","sine"],[38,72],[48,80,"sine","sine"],[72,80,"quad","linear"]],"hipR":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,64],[22,88,"linear","sine"],[30,93,"sine","sine"],[38,88],[48,89,"sine","sine"],[72,1,"quad","linear"]],"kneeR":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","sine"],[38,-50],[48,-3,"sine","sine"],[72,-3,"quad","linear"]],"ankleR":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,104],[22,84,"linear","sine"],[30,80,"sine","sine"],[38,72],[48,80,"sine","sine"],[72,80,"quad","linear"]],"torso":[[0,0,"linear","sine"],[8,-16,"sine","linear"],[16,-38],[22,-22,"linear","sine"],[30,0,"sine","sine"],[38,6],[48,10,"sine","sine"],[72,0,"quad","linear"]],"neck":[[0,0,"linear","sine"],[8,7,"sine","linear"],[16,18],[22,11,"linear","sine"],[30,0,"sine","sine"],[38,-2],[48,-3,"sine","sine"],[72,-12,"quad","linear"]],"root":[[0,0,"linear","sine"],[8,0,"sine","linear"],[16,0],[22,0,"linear","sine"],[30,0,"sine","sine"],[38,0],[48,0,"sine","sine"],[72,90,"quad","linear"]],"eyes":[[0,"open"],[80,"closed"]],"shift":[[0,-28.1],[2,-27.3],[6,-23.2],[8,-22.6],[11,-15.9],[15,-10.1],[16,-9.6],[18,-3.4],[22,6.6],[23,6.6],[29,12],[86,12]],"lift":[[0,0],[30,0],[35,1.6],[38,6.2],[39,9.1],[40,13.5],[44,27.8],[46,32.2],[68,32.3],[69,31.7],[70,29.2],[71,27.9],[86,27.9]]}},"exiting-bed":{"fps":24,"length":92,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[14,-4,"linear","quad"],[38,12,"sine","sine"],[48,14],[56,10,"sine","sine"],[64,26,"sine","linear"],[70,38],[78,14,"linear","sine"],[86,4,"sine","linear"]],"elbowL":[[14,6,"linear","quad"],[38,40,"sine","sine"],[48,56],[56,60,"sine","sine"],[64,44,"sine","linear"],[70,24],[78,14,"linear","sine"],[86,8,"sine","linear"]],"shoulderR":[[14,-8,"linear","quad"],[38,16,"sine","sine"],[48,18],[56,20,"sine","sine"],[64,28,"sine","linear"],[70,32],[78,10,"linear","sine"],[86,-4,"sine","linear"]],"elbowR":[[14,8,"linear","quad"],[38,34,"sine","sine"],[48,48],[56,50,"sine","sine"],[64,40,"sine","linear"],[70,26],[78,14,"linear","sine"],[86,8,"sine","linear"]],"hipL":[[14,0,"linear","quad"],[38,88,"sine","sine"],[48,86],[56,90,"sine","sine"],[64,86,"sine","linear"],[70,62],[78,22,"linear","sine"],[86,0,"sine","linear"]],"kneeL":[[14,-2,"linear","quad"],[38,-2,"sine","sine"],[48,-48],[56,-88,"sine","sine"],[64,-92,"sine","linear"],[70,-88],[78,-36,"linear","sine"],[86,0,"sine","linear"]],"ankleL":[[14,80,"linear","quad"],[38,80,"sine","sine"],[48,72],[56,80,"sine","sine"],[64,86,"sine","linear"],[70,106],[78,94,"linear","sine"],[86,80,"sine","linear"]],"hipR":[[14,1,"linear","quad"],[38,89,"sine","sine"],[48,88],[56,93,"sine","sine"],[64,88,"sine","linear"],[70,64],[78,22,"linear","sine"],[86,0,"sine","linear"]],"kneeR":[[14,-3,"linear","quad"],[38,-3,"sine","sine"],[48,-50],[56,-88,"sine","sine"],[64,-92,"sine","linear"],[70,-88],[78,-36,"linear","sine"],[86,0,"sine","linear"]],"ankleR":[[14,80,"linear","quad"],[38,80,"sine","sine"],[48,72],[56,80,"sine","sine"],[64,84,"sine","linear"],[70,104],[78,94,"linear","sine"],[86,80,"sine","linear"]],"torso":[[14,0,"linear","quad"],[38,10,"sine","sine"],[48,6],[56,0,"sine","sine"],[64,-22,"sine","linear"],[70,-38],[78,-16,"linear","sine"],[86,0,"sine","linear"]],"neck":[[14,-12,"linear","quad"],[38,-3,"sine","sine"],[48,-2],[56,0,"sine","sine"],[64,11,"sine","linear"],[70,18],[78,7,"linear","sine"],[86,0,"sine","linear"]],"root":[[14,90,"linear","quad"],[38,0,"sine","sine"],[48,0],[56,0,"sine","sine"],[64,0,"sine","linear"],[70,0],[78,0,"linear","sine"],[86,0,"sine","linear"]],"eyes":[[0,"closed"],[7,"open"]],"shift":[[0,12],[57,12],[63,6.6],[64,6.6],[68,-3.4],[70,-9.6],[71,-10.1],[75,-15.9],[78,-22.6],[80,-23.2],[84,-27.3],[86,-28.1]],"lift":[[0,27.9],[15,27.9],[16,29.2],[17,31.7],[18,32.3],[40,32.2],[42,27.8],[46,13.5],[47,9.1],[48,6.2],[51,1.6],[56,0],[86,0]]}}};

  /* a full animation file (house-animation/1) in the short form above */
  function compact(a) {
    if (!a || !Array.isArray(a.keys) || !a.keys.length) return null;
    const p = a.keys[0].pose || {};
    const base = { joints: Object.assign({}, p.joints || {}), torsoOrientation: +p.torsoOrientation || 0, pelvisOrientation: +p.pelvisOrientation || 0,
      head: p.head || 'front', headNod: +p.headNod || 0, lift: +p.lift || 0, shift: +p.shift || 0 };
    const tracks = {};
    (a.tracks || []).forEach(t => {
      if (!t || typeof t.param !== 'string' || !Array.isArray(t.keys) || !t.keys.length || t.off) return;
      tracks[t.param] = t.keys.map(k => { const r = [k.frame, k.value]; if (k.easeIn !== 'linear' || k.easeOut !== 'linear') r.push(k.easeIn, k.easeOut); return r; })
        .sort((x, y) => x[0] - y[0]);
    });
    const out = { fps: +a.fps || 24, length: +a.length || 24, loop: !!a.loop, base, tracks };
    if (a.loopOut != null) out.loopOut = +a.loopOut;
    if (a.loopIn != null) out.loopIn = +a.loopIn;
    return out;
  }
  function add(id, json) { const c = json && json.base ? json : compact(json); if (c) ANIMS[id] = c; return !!c; }
  /* the animations folder next to the page: newer versions of the built-in animations (or more) */
  function load(dir, ids) {
    dir = dir == null ? 'animations/' : dir;
    ids = ids || Object.keys(ANIMS);
    if (typeof fetch !== 'function' || (typeof location !== 'undefined' && location.protocol === 'file:')) return Promise.resolve(0);
    return Promise.all(ids.map(id => fetch(dir + id + '.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)
      .then(j => (j && add(id, j) ? 1 : 0)).catch(() => 0))).then(n => n.reduce((a, b) => a + b, 0));
  }
  /* frames in one play: a loop runs from loopIn to loopOut (the frame after loopOut is loopIn again) */
  function span(A) {
    const lo = A.loop && A.loopIn != null ? A.loopIn : 0;
    const hi = A.loop && A.loopOut != null ? A.loopOut + 1 : A.length;
    return [lo, Math.max(lo + 1, hi)];
  }
  const frames = id => { const A = ANIMS[id]; if (!A) return 0; const [lo, hi] = span(A); return hi - lo; };

  const wrap = v => ((v + 180) % 360 + 360) % 360 - 180;
  const isJoint = k => HC().JOINTS.some(j => j[0] === k);
  function trackValue(id, K, f) {
    const H = HC();
    if (f <= K[0][0]) return K[0][1];
    if (f >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0; while (K[i + 1][0] <= f) i++;
    const A = K[i], B = K[i + 1];
    if (f === A[0] || typeof A[1] !== 'number') return A[1];
    const e = H.ease((f - A[0]) / (B[0] - A[0]), A[3] || 'linear', B[2] || 'linear');
    return isJoint(id) ? wrap(A[1]) + H.jointDelta(id, A[1], B[1]) * e : A[1] + (B[1] - A[1]) * e;
  }
  /* the animation's pose on a character: joints, turns and head from the animation; eyes
     only if it has them on a timeline; everything else (face, clothes, held things) the
     character's own. Cached by character and frame. */
  const memo = new Map();
  function pose(id, frame, character) {
    const A = ANIMS[id]; if (!A) return null;
    const H = HC(), f = Math.round(frame);
    const ck = character && character.__hwKey ? character.__hwKey : JSON.stringify(character);
    const key = id + '|' + f + '|' + ck;
    if (memo.has(key)) return memo.get(key);
    const d = H.normalize(character);
    const b = A.base;
    Object.assign(d.joints, b.joints);
    d.torsoOrientation = b.torsoOrientation; d.pelvisOrientation = b.pelvisOrientation; d.head = b.head; d.headNod = b.headNod;
    d.prop = null; d.back = false; d.flipped = false;
    let lift = b.lift, shift = b.shift;
    for (const k in A.tracks) {
      const v = trackValue(k, A.tracks[k], f);
      if (k === 'lift') lift = v;
      else if (k === 'shift') shift = v;
      else if (isJoint(k)) d.joints[k] = Math.round(v * 10) / 10;
      else if (k === 'torsoOrientation' || k === 'pelvisOrientation' || k === 'headNod') d[k] = v;
      else if (k === 'head' || k === 'eyes' || k === 'eyebrows' || k === 'mouth') d[k] = v;
    }
    const out = { d: H.normalize(d), lift: lift / 100, shift: shift / 100 };
    // a side view's head faces the way the body does
    out.d.head = b.head;
    if (memo.size > 600) memo.delete(memo.keys().next().value);
    memo.set(key, out);
    return out;
  }

  /* ── finding a way round the house ─────────────────────────────────────
     The floor is cut into 10 cm cells. A cell is closed if its middle is closer than the
     person's radius to anything solid; a route runs through open cells (8 ways, A*), and is
     then pulled tight: corners are dropped wherever the straight line stays in open cells. */
  const RES = 0.1;
  function grid(eng, L, opts) {
    const st = eng.state, F = st.floors[L], r = opts.radius != null ? opts.radius : 0.2;
    const W = Math.round(st.COLS / RES), Hh = Math.round(st.ROWS / RES);
    const shut = new Uint8Array(W * Hh);
    const box = (x0, y0, x1, y1, grow) => {
      const g = grow == null ? r : grow;
      const c0 = Math.max(0, Math.floor((x0 - g) / RES)), c1 = Math.min(W - 1, Math.ceil((x1 + g) / RES) - 1);
      const r0 = Math.max(0, Math.floor((y0 - g) / RES)), r1 = Math.min(Hh - 1, Math.ceil((y1 + g) / RES) - 1);
      for (let j = r0; j <= r1; j++) {
        const cy = (j + 0.5) * RES, dy = Math.max(y0 - cy, 0, cy - y1);
        for (let i = c0; i <= c1; i++) {
          const cx = (i + 0.5) * RES, dx = Math.max(x0 - cx, 0, cx - x1);
          if (dx * dx + dy * dy < g * g || (dx === 0 && dy === 0)) shut[j * W + i] = 1;
        }
      }
    };
    // the edge of the lot
    box(-1, -1, st.COLS + 1, 0); box(-1, st.ROWS, st.COLS + 1, st.ROWS + 1); box(-1, -1, 0, st.ROWS + 1); box(st.COLS, -1, st.COLS + 1, st.ROWS + 1);
    const T = eng.T || 0.16, J = 0.09;   // wall thickness; a door's or gate's frame on each side of the opening
    for (const [k, v] of F.edges) {
      const e = eng.parseKey(k), [[x0, y0], [x1, y1]] = eng.edgeEnds(e.o, e.r, e.c);
      const open = v.type === 'door' || (v.type === 'fence' && v.gate);
      const th = v.type === 'fence' ? 0.06 : T / 2;
      if (!open) { box(Math.min(x0, x1) - th, Math.min(y0, y1) - th, Math.max(x0, x1) + th, Math.max(y0, y1) + th); continue; }
      if (e.o === 'h') { box(x0 - th, y0 - th, x0 + J, y0 + th); box(x1 - J, y1 - th, x1 + th, y1 + th); }
      else { box(x0 - th, y0 - th, x0 + th, y0 + J); box(x1 - th, y1 - J, x1 + th, y1 + th); }
    }
    for (const k of F.columns) { const [X, Y] = eng.colXY(k), h = (eng.COL_W || 0.24) / 2; box(X / 2 - h, Y / 2 - h, X / 2 + h, Y / 2 + h); }
    const solid = R => box(R.x0, R.y0, R.x1, R.y1);
    F.furniture.forEach((f, i) => {
      if (opts.ignore && opts.ignore.includes(i)) return;
      if (eng.hung(f) && !(eng.FURN[f.type].hangZ < 0.5)) return;   // shelves and cabinets on the wall are over people's heads
      solid(eng.furnRect(f));
    });
    (F.appliances || []).forEach(a => { if (a.type !== 'rug') solid(eng.applRect(a)); });
    /* Stairs. Those going up from this floor are solid (a floating stair has room to walk
       under its high end); the hole of a stair coming up from the floor below is open except
       for its top two treads, which are at this floor's level — people step off there. */
    const pools = L === 0 ? st.floors[0].pools : [];
    const RISE = (eng.LEVEL_H || 2.8) / 14;
    if (eng.stairTreads) {
      F.stairs.forEach(s => eng.stairTreads(s).forEach(t => {
        if (s.style === 'cantilever' && t.riser * RISE - 0.1 > 2.05) return;
        box(t.rect.x0, t.rect.y0, t.rect.x1, t.rect.y1);
      }));
      if (st.floors[L - 1]) st.floors[L - 1].stairs.forEach(s => eng.stairTreads(s).forEach(t => {
        if (!t.landing && t.riser >= 13) return;
        box(t.rect.x0, t.rect.y0, t.rect.x1, t.rect.y1);
      }));
      // between the treads and the stair's own squares (the rail, the stringers): the squares less
      // the treads' insets are solid too — except round the hole's floor-level top
    } else {
      // an older engine: every stair square is solid
      const below = st.floors[L - 1] && st.floors[L - 1].stairs.length;
      for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
        const x = (i + 0.5) * RES, y = (j + 0.5) * RES;
        if ((F.stairs.length && eng.stairIndexAt(L, x, y) >= 0) || (below && eng.stairIndexAt(L - 1, x, y) >= 0)) shut[j * W + i] = 1;
      }
    }
    if (!opts.pool) pools.forEach(q => box(q.c0, q.r0, q.c1, q.r1));
    (opts.others || []).forEach(([x, y]) => box(x - 0.15, y - 0.15, x + 0.15, y + 0.15));
    return { W, H: Hh, shut, r };
  }
  const cellOf = (G, x, y) => [Math.max(0, Math.min(G.W - 1, Math.floor(x / RES))), Math.max(0, Math.min(G.H - 1, Math.floor(y / RES)))];
  const mid = (i, j) => [(i + 0.5) * RES, (j + 0.5) * RES];
  // the open cell nearest a point (within 1 m)
  function nearestOpen(G, x, y) {
    const [ci, cj] = cellOf(G, x, y);
    if (!G.shut[cj * G.W + ci]) return [ci, cj];
    let best = null, bd = Infinity;
    const R = Math.round(1 / RES);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= G.W || j >= G.H || G.shut[j * G.W + i]) continue;
      const [mx, my] = mid(i, j), d = Math.hypot(mx - x, my - y);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    return best;
  }
  // the straight line from a to b stays in open cells
  function clear(G, a, b) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (RES / 3));
    for (let s = 0; s <= n; s++) {
      const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n;
      const [i, j] = cellOf(G, x, y); if (G.shut[j * G.W + i]) return false;
    }
    return true;
  }
  /* a roomy way if there is one (opts.radius, 0.2 m), or else a squeeze (0.12 m): between a
     toilet and a basin, or past a chair pushed in */
  function route(eng, L, from, to, opts) {
    opts = opts || {};
    const r0 = opts.radius != null ? opts.radius : 0.2;
    for (const r of r0 > 0.12 ? [r0, 0.12] : [r0]) {
      const out = routeAt(eng, L, from, to, Object.assign({}, opts, { radius: r }));
      if (out) return out;
    }
    return null;
  }
  function routeAt(eng, L, from, to, opts) {
    const G = grid(eng, L, opts);
    const s = nearestOpen(G, from[0], from[1]), g = nearestOpen(G, to[0], to[1]);
    if (!s || !g) return null;
    const W = G.W, N = W * G.H, start = s[1] * W + s[0], goal = g[1] * W + g[0];
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    // a binary heap of [f, index]
    const heap = [];
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hx = i => { const dx = Math.abs(i % W - g[0]), dy = Math.abs(((i / W) | 0) - g[1]); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    gs[start] = 0; push(hx(start), start);
    const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) {
      const [, cur] = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === goal) break;
      const ci = cur % W, cj = (cur / W) | 0;
      for (const [di, dj, c] of STEPS) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= W || j >= G.H) continue;
        const n = j * W + i;
        if (G.shut[n] || done[n]) continue;
        if (di && dj && (G.shut[cj * W + i] || G.shut[j * W + ci])) continue;   // no cutting a corner
        const ng = gs[cur] + c;
        if (ng < gs[n]) { gs[n] = ng; came[n] = cur; push(ng + hx(n), n); }
      }
    }
    if (!done[goal]) return null;
    const cells = [];
    for (let k = goal; k !== -1; k = came[k]) cells.push(mid(k % W, (k / W) | 0));
    cells.reverse();
    // pull it tight
    const pts = [cells[0]];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !clear(G, cells[a], cells[b])) b--;
      pts.push(cells[b]); a = b;
    }
    /* from where they really are, to where they are really going: the grid's own first and last
       cells are dropped when they are only a few centimetres off, so the person doesn't take a
       little sideways step at either end (and end up facing some odd way) */
    const out = [from.slice()], near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.25;
    pts.forEach(p => { if (!near(p, out[out.length - 1])) out.push(p); });
    if (out.length > 1 && near(to, out[out.length - 1])) out[out.length - 1] = to.slice();
    else out.push(to.slice());
    return out.filter((p, i) => !i || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 1e-3);
  }

  /* ── a trip: legs played one after another ─────────────────────────── */
  const DEG = Math.PI / 180;
  const headingOf = (a, b) => ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) / DEG) % 360 + 360) % 360;   // degrees clockwise from north
  const turnTo = (from, to) => ((to - from + 540) % 360) - 180;
  const TURN_RATE = 420;   // degrees a second, turning on the spot or at a corner
  function sizeOf(character) {
    // how tall they are, against an average adult: strides scale with it
    const H = HC(), d = H.normalize(character);
    const h = [0.76, 0.87, 0.93, 1, 1.05, 1.1][Math.max(0, Math.min(5, d.height | 0))] || 1;
    return h;
  }
  function trip(character, legs) {
    const H = HC();
    const c = H.normalize(character);
    c.__hwKey = JSON.stringify(c);
    const size = sizeOf(c);
    const standing = (() => { const d = H.normalize(c); H.applyPose(d, 'standing'); d.prop = null; d.back = false; return d; })();
    let facing = 180, x = 0, y = 0, t = 0;
    const plan = [];
    for (const L of legs) {
      if (L.walk) {
        const pts = L.walk.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-3);
        if (pts.length < 2) continue;
        const gait = L.gait === 'running' ? 'running' : 'walking';
        const stride = (gait === 'running' ? 2.4 : 1.3) * size, cyc = frames(gait), fps = (ANIMS[gait] || { fps: 24 }).fps;
        const speed = stride / (cyc / fps);   // metres a second at the animation's own speed
        // distance along the route, and the heading of each piece
        const segs = []; let dist = 0;
        for (let i = 1; i < pts.length; i++) { const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push({ a: pts[i - 1], b: pts[i], d0: dist, len, h: headingOf(pts[i - 1], pts[i]) }); dist += len; }
        // turn first toward the way out, if that is a big turn
        const first = segs[0].h, big = Math.abs(turnTo(facing, first));
        if (big > 60) { const dur = big / TURN_RATE; plan.push({ kind: 'turn', t0: t, dur, x: pts[0][0], y: pts[0][1], f0: facing, f1: first }); t += dur; }
        plan.push({ kind: 'walk', t0: t, dur: dist / speed, segs, dist, gait, stride, cyc, speed, swimIn: L.swimIn, f0: big > 60 ? first : facing });
        t += dist / speed; facing = segs[segs.length - 1].h; [x, y] = pts[pts.length - 1];
      } else if (L.turn != null) {
        const f1 = ((L.turn % 360) + 360) % 360, big = Math.abs(turnTo(facing, f1));
        if (L.x != null) { x = L.x; y = L.y; }
        if (big > 1) { const dur = Math.max(0.15, big / TURN_RATE); plan.push({ kind: 'turn', t0: t, dur, x, y, f0: facing, f1 }); t += dur; }
        facing = f1;
      } else if (L.play) {
        const A = ANIMS[L.play]; if (!A) continue;
        const n = A.length, dur = n / A.fps;
        if (L.facing != null) facing = L.facing;
        if (L.x != null) { x = L.x; y = L.y; }
        plan.push({ kind: 'play', t0: t, dur, id: L.play, n, x, y, facing, z: L.z || 0 });
        t += dur;
        const end = pose(L.play, n, c), fx = Math.sin(facing * DEG), fy = -Math.cos(facing * DEG);
        x += -end.shift * fx; y += -end.shift * fy;   // a side view faces left: shift < 0 is forward
      } else if (L.stand != null) {
        if (L.x != null) { x = L.x; y = L.y; }
        if (L.facing != null) facing = L.facing;
        plan.push({ kind: 'stand', t0: t, dur: L.stand, x, y, facing, d: L.d || null });
        t += L.stand;
      }
    }
    const total = t;
    function at(tt) {
      if (!plan.length) return { x, y, z: 0, facing, d: standing, leg: -1, u: 1, done: true };
      tt = Math.max(0, tt);
      let k = plan.findIndex(p => tt < p.t0 + p.dur);
      const done = k < 0; if (done) k = plan.length - 1;
      const P = plan[k], u = done ? 1 : Math.max(0, Math.min(1, (tt - P.t0) / (P.dur || 1)));
      if (P.kind === 'turn') return { x: P.x, y: P.y, z: 0, facing: (P.f0 + turnTo(P.f0, P.f1) * u + 360) % 360, d: standing, leg: k, u, done, kind: 'turn' };
      if (P.kind === 'stand') return { x: P.x, y: P.y, z: 0, facing: P.facing, d: P.d || standing, leg: k, u, done, kind: 'stand' };
      if (P.kind === 'play') {
        const f = Math.min(P.n, Math.floor(u * P.n)), q = pose(P.id, done ? P.n : f, c);
        const fx = Math.sin(P.facing * DEG), fy = -Math.cos(P.facing * DEG);
        return { x: P.x - q.shift * fx, y: P.y - q.shift * fy, z: P.z + q.lift, facing: P.facing, d: q.d, leg: k, u, done, kind: 'play' };
      }
      // walking: where along the route, which way they face (eased round corners), which frame
      const s = Math.min(P.dist, u * P.dist);
      let i = 0; while (i < P.segs.length - 1 && s > P.segs[i].d0 + P.segs[i].len) i++;
      const S = P.segs[i], v = S.len ? (s - S.d0) / S.len : 1;
      const px = S.a[0] + (S.b[0] - S.a[0]) * v, py = S.a[1] + (S.b[1] - S.a[1]) * v;
      // turning at a corner takes a little time, shared before and after it
      let f = S.h;
      const ease = 0.35 * P.speed / 1.3;   // metres either side of a corner
      if (i > 0 && s - S.d0 < ease) { const prev = P.segs[i - 1].h, w = 0.5 + 0.5 * (s - S.d0) / ease; f = prev + turnTo(prev, S.h) * w; }
      else if (i < P.segs.length - 1 && S.d0 + S.len - s < ease) { const nx = P.segs[i + 1].h, w = 0.5 * (1 - (S.d0 + S.len - s) / ease); f = S.h + turnTo(S.h, nx) * w; }
      if (i === 0 && s < ease && P.f0 != null) { const w = s / ease; f = P.f0 + turnTo(P.f0, f) * Math.min(1, 0.5 + w / 2); }
      f = (f % 360 + 360) % 360;
      const [lo] = span(ANIMS[P.gait]);
      const frame = done ? lo : lo + Math.floor((s / P.stride) * P.cyc) % P.cyc;
      const q = pose(P.gait, frame, c);
      return { x: px, y: py, z: q.lift, facing: f, d: done ? standing : q.d, leg: k, u, done, kind: 'walk', swim: P.swimIn ? !!P.swimIn(px, py) : false, gait: P.gait };
    }
    return { seconds: total, at, plan, end: () => ({ x, y, facing }) };
  }

  global.HouseWalk = { ANIMS, add, load, compact, frames, pose, route, trip, headingOf, grid };
})(typeof window !== 'undefined' ? window : globalThis);
