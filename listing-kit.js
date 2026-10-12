/* ══════════════════════════════════════════════════════════════════════════
   listing-kit.js — houses for sale, and the neighbourhoods they are in.

   Built on the two picture engines, so a house in a lesson is a real House
   Builder house and its neighbourhood is a real City Playground map:

     <script src="house.js"></script>
     <script src="house-engine.js"></script>
     <script src="city-engine.js"></script>
     <script src="listing-kit.js"></script>

   ListingKit.house(spec)     → a House Builder file (draw it with HousePicture,
                                 { roofs: true, walls: 'full' })
       spec: { w, d          footprint in metres (whole numbers)
               floors        1 or 2
               wall          'masonry' | 'lap' | 'vertical' | 'drywall'
               roof          'gable' | 'opengable' | 'shed' | 'flat'
               roofmat       'clay' | 'concrete' | 'metal'
               garden        true: a fenced garden (picket fence, gate)
               fence         fence style for the garden (default 'picket')
               pool          true: a swimming pool in the garden
               yard          metres of garden in front (default 3 with a garden) }

   ListingKit.area(type, rnd) → { type, name, city: a playground map with the
                                 house pinned, gauges: {noise, …} 1–6, km }
       type: 'downtown' | 'suburb' | 'riverside' | 'countryside' | 'industrial'
       The gauges are counted from the map itself — more road and shops, more
       noise; more trees, more parks — so what the picture shows and what the
       gauges say always agree. Safety can't be seen on a map, so it comes
       from the type of neighbourhood.

   ListingKit.gauge(key, level)   → '🟩🟩🟩🟨◼️◼️' (six squares)
   ListingKit.gaugesHtml(gauges)  → the gauge block, house-styled
   ListingKit.houseSvg(house, opts) → the house from outside (roof on, every floor)
   ListingKit.cardHtml(listing, { tag: 'A', ad: true }) → a whole listing card (still picture)
   ListingKit.renderCards(el, listings, opts) → the cards, each house in a HouseViewer
   ListingKit.EXAMPLES        → the three fixed houses of the comparatives lesson
   ListingKit.GAUGES              → [{ key, emoji, word, bad }]

   ListingKit.random(rnd)     → one complete random listing:
       { area, house, city, gauges, facts: { size, bedrooms, bathrooms,
         floors, garden, pool, year, price, km }, title, ad }
   rnd is an optional random function (Math.random by default).
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── the house ─────────────────────────────────────────────────────────── */
  /* The rooms. A floor is cut into a back row and a front row by one wall;
     each row is cut into rooms. A bedroom needs 3 m (4 m when its row is only
     2 m deep, so the bed fits across it); a bathroom or a kitchen 2 m.
       one floor    back:  bathroom · bedrooms          front: kitchen · living room (the front door)
       two floors   ground back:  kitchen · (bathroom) · hall with the stairs
                    ground front: living room (the front door) · (bedroom)
                    upstairs back:  bathroom · (bedrooms) · hall (over the stairs)
                    upstairs front: bedrooms
     The room list is kept on the file (plan.bedrooms, plan.bathrooms), so an
     ad never promises a bedroom the picture doesn't have. */
  function splitRow(W, rooms) {   // rooms: [{type, min, flex}] → each gets .w; extra metres go to the flex rooms
    let extra = W - rooms.reduce((s, r) => s + r.min, 0);
    rooms.forEach(r => { r.w = r.min; });
    const flex = rooms.filter(r => r.flex);
    for (let i = 0; extra > 0 && flex.length; i++, extra--) flex[i % flex.length].w++;
    if (extra > 0) rooms[rooms.length - 1].w += extra;
    return rooms;
  }
  function plan(w, d, floors) {
    const bd = Math.floor(d / 2), fd = d - bd;
    const bedMin = depth => depth >= 3 ? 3 : 4;
    const beds = (W, depth) => Math.max(0, Math.floor(W / bedMin(depth)));
    const bedRooms = (n, depth) => Array.from({ length: n }, () => ({ type: 'bed', min: bedMin(depth), flex: true }));
    const levels = [];
    if (floors === 1) {
      const nb = Math.max(1, beds(w - 2, bd));
      levels.push({
        back: splitRow(w, [{ type: 'bath', min: 2 }].concat(bedRooms(nb, bd))),
        front: splitRow(w, [{ type: 'kitchen', min: w >= 6 ? 3 : 2 }, { type: 'living', min: 3, flex: true }])
      });
    } else {
      const bigBath = w >= 8;
      levels.push({
        back: splitRow(w, [{ type: 'kitchen', min: 2, flex: true }].concat(bigBath ? [{ type: 'bath', min: 2 }] : [], [{ type: 'hall', min: 3, stairs: true }])),
        front: splitRow(w, [{ type: 'living', min: 3, flex: true }].concat(w >= 8 ? bedRooms(1, fd) : []))
      });
      levels.push({
        back: splitRow(w, [{ type: 'bath', min: 2, flex: true }].concat(bedRooms(beds(w - 5, bd), bd), [{ type: 'hall', min: 3 }])),
        front: splitRow(w, bedRooms(Math.max(1, beds(w, fd)), fd))
      });
    }
    let bedrooms = 0, bathrooms = 0;
    levels.forEach(lv => [lv.back, lv.front].forEach(row => row.forEach(r => {
      if (r.type === 'bed') bedrooms++;
      if (r.type === 'bath') bathrooms++;
    })));
    return { levels, bd, fd, bedrooms, bathrooms };
  }

  // furniture worth trying in each room; the engine's own rules decide what fits
  function furnish(room, F, A, doorC, y1) {
    const { x, y, w, h, type } = room;
    const it = (t, level, slot) => ({ type: t, level, slot: slot || 'C', dir: 0 });
    // a spot is a square's middle (both .5) or a corner (both whole): nudge x to match y
    const at = (px, py) => (Math.abs((px * 2) % 2) === Math.abs((py * 2) % 2)) ? [px, py] : [px - 0.5, py];
    const put = (list, o, px, py) => { const [X, Y] = at(px, py); list.push(Object.assign(o, { x: X, y: Y })); };
    if (type === 'bed') {
      if (h >= 3) { put(F, { type: 'bed', dir: 2 }, x + 1.5, y + 1.5); put(F, { type: 'nightstand', dir: 2, items: [it('lamp', 0)] }, x + 2.5, y + 0.5); }
      else { put(F, { type: 'bed', dir: 1 }, x + 2, y + 1); put(F, { type: 'nightstand', dir: 2, items: [it('lamp', 0)] }, x + 0.5, y + 0.5); }
      if (w >= 4 && h >= 3) put(F, { type: 'dresser', dir: 3 }, x + w - 0.5, y + 1.5);
      put(A, { type: 'rug', dir: 1 }, x + w / 2, y + h - 1);
    } else if (type === 'bath') {
      put(F, { type: 'toilet', dir: 2 }, x + 0.5, y + 0.5);
      put(F, { type: 'washbasin', dir: 2 }, x + 1.5, y + 0.5);
      if (h >= 3) put(F, { type: 'bathtub', dir: 1 }, x + 1, y + 2);
    } else if (type === 'kitchen') {
      const n = Math.max(1, w - 1);
      for (let i = 0; i < n; i++) {
        F.push({ type: 'countertop', edge: { o: 'h', r: y, c: x + i }, side: 'p', insets: [i === 0 ? 0.08 : 0, 0],
          items: i === 0 ? [it('sink', 0)] : i === 1 ? [it('stove', 0)] : i === 2 ? [it('microwave', 0)] : [] });
      }
      put(A, { type: 'fridge', dir: 2 }, x + w - 0.5, y + 0.5);
      if (h >= 3 && w >= 3) {
        put(F, { type: 'table', dir: 0 }, x + 1.5, y + 2);
        put(F, { type: 'chair', dir: 3 }, x + 2.5, y + 2.5);
        put(F, { type: 'chair', dir: 1 }, x + 0.5, y + 2.5);
      }
    } else if (type === 'living') {
      // keep the sofa away from the front door
      const doorLeft = doorC - x < w / 2;
      const sx = doorLeft ? x + w - 1.5 : x + 1.5;
      put(F, { type: 'tvstand', dir: 2, items: [it('tv', 1)] }, sx, y + 0.5);
      put(F, { type: w >= 5 ? 'couch' : 'loveseat', dir: 0 }, sx, y + h - 0.5);
      put(F, { type: 'loveseat', dir: 0 }, sx, y + h - 1);
      put(F, { type: 'coffeetable', dir: 0 }, sx, y + h / 2);
      put(A, { type: 'rug', dir: 0 }, sx, y + h / 2);
      put(A, { type: 'planter', dir: 0 }, doorLeft ? x + 0.5 : x + w - 0.5, y + 0.5);
      put(A, { type: 'standlamp', dir: 0 }, doorLeft ? x + w - 0.5 : x + 0.5, y + h - 0.5);
    }
  }

  function house(spec) {
    const w = spec.w, d = spec.d, floors = spec.floors || 1;
    const wall = spec.wall || 'masonry';
    const garden = !!spec.garden;
    const side = garden ? 2 : 1, back = 1, front = garden ? (spec.yard || 3) : 1;
    const poolW = spec.pool ? 3 : 0;
    const cols = side + w + side + (spec.pool ? poolW + 1 : 0), rows = back + d + front;
    const x0 = side, y0 = back, x1 = x0 + w, y1 = y0 + d;
    const doorC = x0 + Math.floor(w / 2);
    const P = plan(w, d, floors);
    const ym = y0 + P.bd;
    // outside walls: the house's own finish outside, plain drywall inside
    const OUT = { N: { m: wall, p: 'drywall' }, S: { m: 'drywall', p: wall }, W: { m: wall, p: 'drywall' }, E: { m: 'drywall', p: wall } };
    const IN = { m: 'drywall', p: 'drywall' };

    const floorsOut = [];
    P.levels.forEach((lv, L) => {
      const edges = new Map();
      const put = (o, r, c, type, sides, extra) => edges.set(o + ':' + r + ':' + c, Object.assign({ o, r, c, type, sides }, extra || {}));
      // outside walls, a window on every other metre, the front door
      for (let c = x0; c < x1; c++) {
        put('h', y0, c, (c - x0) % 2 === 1 ? 'window' : 'wall', OUT.N);
        if (L === 0 && c === doorC) put('h', y1, c, 'door', OUT.S, { style: 'halfglass', swing: 0, closed: true });
        else put('h', y1, c, (c - x0) % 2 === 1 || (L > 0 && c === doorC) ? 'window' : 'wall', OUT.S);
      }
      for (let r = y0; r < y1; r++) {
        put('v', r, x0, (r - y0) % 2 === 1 ? 'window' : 'wall', OUT.W);
        put('v', r, x1, (r - y0) % 2 === 1 ? 'window' : 'wall', OUT.E);
      }
      // rooms: place them along each row
      const rooms = [];
      [['back', y0, P.bd], ['front', ym, P.fd]].forEach(([row, ry, rh]) => {
        let cx = x0;
        lv[row].forEach(rm => { rooms.push(Object.assign({}, rm, { row, x: cx, y: ry, w: rm.w, h: rh })); cx += rm.w; });
      });
      // the wall between the rows, and between the rooms of a row
      for (let c = x0; c < x1; c++) put('h', ym, c, 'wall', IN);
      rooms.forEach(rm => { if (rm.x > x0) for (let r = rm.y; r < rm.y + rm.h; r++) put('v', r, rm.x, 'wall', IN); });
      // ways through: open between kitchen and living room, doors elsewhere
      const hall = rooms.find(rm => rm.type === 'hall');
      const door = (o, r, c, open) => put(o, r, c, open ? 'gap' : 'door', IN, open ? {} : { swing: 0, closed: true });
      rooms.forEach(rm => {
        if (rm.type === 'living') return;
        if (rm.type === 'hall') { door('h', ym, rm.x + 1, true); return; }
        if (rm.type === 'kitchen') {
          if (rm.row === 'back') door('h', ym, rm.x + Math.min(1, rm.w - 1), true);
          else door('v', rm.y, rm.x + rm.w, true);
          return;
        }
        if (hall && rm.row === hall.row && rm.x + rm.w === hall.x) { door('v', rm.y + rm.h - 1, hall.x, false); return; }
        if (hall && rm.row !== hall.row && rm.x < hall.x + hall.w && rm.x + rm.w > hall.x) { door('h', ym, Math.max(rm.x, hall.x) + 1, false); return; }
        if (rm.row === 'front' && L === 0) { door('v', rm.y + 1, rm.x, false); return; }   // a ground-floor bedroom off the living room
        door('h', ym, rm.x + Math.floor(rm.w / 2), false);
      });
      // a 'gap' is a doorway with no door: just no wall there
      const edgeList = [...edges.values()].map(e => { const o = Object.assign({}, e); if (o.type === 'gap') return null; return o; }).filter(Boolean);

      const F = [], A = [], floorStyles = [];
      rooms.forEach(rm => {
        furnish(rm, F, A, doorC, y1);
        if (rm.type === 'bath' || rm.type === 'kitchen')
          for (let r = rm.y; r < rm.y + rm.h; r++) for (let c = rm.x; c < rm.x + rm.w; c++) floorStyles.push({ r, c, style: 'tile' });
      });
      const stairs = [];
      if (L === 0 && hall) stairs.push({ r: hall.y, c: hall.x + 2, dir: 3, type: 'straight' });

      const fl = { level: L, edges: edgeList, furniture: F, appliances: A, stairs, roofs: [], pools: [], floorStyles };
      if (L === 0 && garden) {
        const fs = spec.fence || 'picket';
        for (let c = 0; c < cols; c++) {
          edgeList.push({ o: 'h', r: 0, c, type: 'fence', style: fs });
          edgeList.push(c === doorC ? { o: 'h', r: rows, c, type: 'fence', style: fs, gate: true, swing: 0 } : { o: 'h', r: rows, c, type: 'fence', style: fs });
        }
        for (let r = 0; r < rows; r++) {
          edgeList.push({ o: 'v', r, c: 0, type: 'fence', style: fs });
          edgeList.push({ o: 'v', r, c: cols, type: 'fence', style: fs });
        }
        // potted plants by the front door
        A.push({ type: 'planter', x: doorC - 0.5, y: y1 + 0.5, dir: 2 }, { type: 'planter', x: doorC + 1.5, y: y1 + 0.5, dir: 2 });
      }
      if (L === 0 && spec.pool) {
        const px = x1 + side;
        fl.pools.push({ x0: px, y0: y0 + 1, x1: Math.min(cols - 1, px + poolW), y1: Math.min(rows - 1, y0 + 1 + Math.max(2, Math.min(4, d - 1))) });
      }
      if (L === floors - 1) {
        const roof = spec.roof || 'gable';
        const o = roof === 'flat' ? 0 : 0.5;   // eaves overhang the walls
        fl.roofs.push({ x0: x0 - o, y0: y0 - o, x1: x1 + o, y1: y1 + o, type: roof, material: spec.roofmat || 'clay',
          dir: roof === 'shed' || roof === 'openshed' ? 0 : (w >= d ? 0 : 1) });
      }
      floorsOut.push(fl);
    });
    const file = clean({ app: 'house-builder', version: 12, cols, rows, floors: floorsOut });
    file.plan = { bedrooms: P.bedrooms, bathrooms: P.bathrooms };
    return file;
  }

  /* Run every piece past the House Builder's own rules — not through a wall,
     not on the stairs, not on top of another piece — and keep only those that
     pass, in the order they were offered. So a room gets whatever furniture
     really fits it, and no picture ever warns about a piece it had to drop. */
  let cleaner = null;
  function clean(file) {
    if (typeof HouseEngine === 'undefined') return file;
    cleaner = cleaner || HouseEngine.create();
    const st = cleaner.state;
    const h = cleaner.validateHouse(file);
    st.COLS = h.cols; st.ROWS = h.rows; st.floors = h.floors;
    cleaner.LEVELS.forEach(L => {
      const Fl = st.floors[L], prev = st.level;
      st.level = L;
      const furn = Fl.furniture, appl = Fl.appliances;
      Fl.furniture = []; Fl.appliances = [];
      furn.forEach(f => { Fl.furniture.push(f); if (!cleaner.furnValid(f, L, Fl.furniture.length - 1)) Fl.furniture.pop(); });
      appl.forEach(a => { Fl.appliances.push(a); if (!cleaner.applValid(a, L, Fl.appliances.length - 1)) Fl.appliances.pop(); });
      st.level = prev;
    });
    const out = cleaner.serializeHouse();
    delete out.savedAt;
    // the save keeps every storey; leave out the empty ones so the viewer's floor buttons skip them
    out.floors = out.floors.filter(f => f.edges.length || f.furniture.length || f.appliances.length || f.roofs.length);
    return out;
  }

  // the house from outside: walls up, roof on, showing the top floor (and so every floor under it)
  function houseSvg(h, opts) {
    const top = Math.max(0, ...h.floors.map(f => f.level));
    return HousePicture.svg(h, Object.assign({ roofs: true, walls: 'full', level: top }, opts || {}));
  }

  /* ── the neighbourhood ─────────────────────────────────────────────────── */
  const SHOPS = new Set(['🏪', '☕', '🏦', '🍕', '💊', '🍞', '💇', '🎮', '🧸', '👟', '🍦', '🛒', '🍔']);
  const GREEN = new Set(['🌳', '🌲', '🌾']);

  // H = the house for sale (pinned), ? = a square filled from the area's pool
  const AREAS = {
    downtown: {
      name: 'downtown', label: 'in the city center', km: [0, 2], safety: [2, 3],
      pool: ['🏢', '🏢', '🏢', '🏪', '☕', '🏦', '🍕', '💊', '🏨', '🍔', '💇', '🎮', '🏬'],
      maps: [
        ['? ? R ? ? ?', 'R R R R R R', '? H R ? P ?', '? ? R ? ? ?', 'R R R R R R'],
        ['? R ? ? R ?', '? R H ? R ?', 'R R R R R R', '? R ? P R ?', '? R ? ? R ?'],
        ['R R R R R R', '? ? R ? H ?', '? 🌳 R ? ? ?', 'R R R R R R', '? ? R ? P ?']
      ]
    },
    suburb: {
      name: 'suburb', label: 'in a suburb', km: [6, 12], safety: [5, 6],
      pool: ['🏠', '🏠', '🏠', '🏡', '🌳', '🌳', '.', '🏫', '🏪', '⛪'],
      maps: [
        ['? ? ? R ? ?', 'R R R R ? ?', '? H ? R 🌳 🌳', '? ? ? R 🌳 🌳', '? 🏫 ? R ? ?'],
        ['? ? ? ? ? ?', 'R R R R R R', '? H ? ? ? 🌳', '? ? ? 🌳 🌳 🌳', '. . . 🌳 🌳 .'],
        ['🌳 ? ? R ? ?', '🌳 ? H R ? ?', 'R R R R R R', '? ? ? R 🌳 ?', '? ? ? R ? ?']
      ]
    },
    riverside: {
      name: 'riverside', label: 'by the river', km: [3, 6], safety: [4, 5],
      pool: ['🌳', '🌳', '🏠', '🏡', '.', '☕', '🐟', '🏠'],
      maps: [
        ['? ? ? R ? ?', 'W W W BV W W', '🌳 ? ? R ? 🌳', 'R R R R R R', '? H ? ? 🏠 ?'],
        ['? ? W ? ? ?', 'R R BH R R R', '? ? W H ? ?', '🌳 ? W ? ? 🌳', '? ? W W W W'],
        ['W W W W ? ?', '? ? ? W W W', '⚓ ? H ? ? ?', 'R R R R R R', '? 🌳 ? ? ? 🌳']
      ]
    },
    countryside: {
      name: 'the countryside', label: 'in the countryside', km: [18, 35], safety: [5, 6],
      pool: ['🌳', '🌳', '🌲', '🌾', '🐄', '🐑', '.', '.', '🚜'],
      maps: [
        ['🌳 ? . . ? 🌳', '. 🌾 🌾 . H .', 'R R R R R R', '? . 🐄 . . ?', '🌳 ? . . 🌳 🌲'],
        ['? ? ? R ? 🌲', '🌾 🌾 ? R H ?', '🌾 🌾 ? R . ?', '? ? ? R ? 🌲', '🌲 ? ? R ? ?']
      ],
      ground: [
        ['. . . . . .', '. dirt dirt . . .', '. . . . . .', '. . dirt . . .', '. . . . . .'],
        ['. . . . . .', 'dirt dirt . . . .', 'dirt dirt . . . .', '. . . . . .', '. . . . . .']
      ]
    },
    industrial: {
      name: 'an industrial area', label: 'near the factories', km: [3, 8], safety: [2, 4],
      pool: ['🏭', '🏭', '🏢', '🏬', '.', '🏪', '🍔'],
      maps: [
        ['T T T T T T', '? 🏭 ? 🚉 ? ?', 'R R R R R R', '? H R ? 🏭 ?', '? ? R ? ? ?'],
        ['? ? R ? T ?', '🏭 ? R ? T ?', 'R R R R XV R', '? H R ? T 🏭', '? ? R ? T ?']
      ]
    }
  };
  const AREA_TYPES = Object.keys(AREAS);

  const GAUGES = [
    { key: 'noise', emoji: '🔊', word: 'noise', bad: true },
    { key: 'traffic', emoji: '🚗', word: 'traffic', bad: true },
    { key: 'pollution', emoji: '🏭', word: 'pollution', bad: true },
    { key: 'parks', emoji: '🌳', word: 'green areas', bad: false },
    { key: 'shops', emoji: '🛒', word: 'shops', bad: false },
    { key: 'safety', emoji: '🛡️', word: 'safety', bad: false }
  ];
  const clamp = n => Math.max(1, Math.min(6, Math.round(n)));
  const between = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

  // gauges counted from what is on the map
  function measure(rows, type, rnd) {
    const toks = rows.join(' ').split(/\s+/).map(t => t.split('@')[0]);
    const n = s => toks.filter(t => s instanceof Set ? s.has(t) : t === s).length;
    const roads = n('R') + n('BH') + n('BV') + n('XV') + n('XH'), park = n('P');
    const shops = n(SHOPS), green = n(GREEN), factories = n('🏭'), rail = n('T') + n('XV') + n('XH') + n('🚉'), offices = n('🏢') + n('🏬') + n('🏨');
    return {
      noise: clamp(roads / 4 + shops / 3 + factories + rail / 3 + offices / 4),
      traffic: clamp(roads / 2.6 + park + offices / 4 - 0.5),
      pollution: clamp(1 + factories * 1.6 + roads / 5 + rail / 4 - green / 3),
      parks: clamp(0.6 + green / 1.4),
      shops: clamp(0.6 + shops / 1.1),
      safety: between(rnd, AREAS[type].safety)
    };
  }

  function area(type, rnd) {
    rnd = rnd || Math.random;
    const A = AREAS[type];
    const i = Math.floor(rnd() * A.maps.length);
    const rows = A.maps[i].map(line => line.split(' ').map(t => t === 'H' ? '🏠@red' : t === '?' ? pick(rnd, A.pool) : t).join(' '));
    const city = CityPicture.map({ rows, ground: A.ground ? A.ground[i] : undefined });
    return { type, name: A.name, label: A.label, city, gauges: measure(rows, type, rnd), km: between(rnd, A.km) || 1 };
  }

  /* ── gauges ────────────────────────────────────────────────────────────── */
  // six squares; the colours run green → yellow → red towards the bad end,
  // so a lot of noise ends in red and a lot of parks ends in green
  function gauge(key, level) {
    const g = GAUGES.find(x => x.key === key);
    const BAD = ['🟩', '🟩', '🟩', '🟨', '🟨', '🟥'], GOOD = ['🟥', '🟨', '🟨', '🟩', '🟩', '🟩'];
    const ramp = g && !g.bad ? GOOD : BAD;
    let s = '';
    for (let i = 0; i < 6; i++) s += i < level ? ramp[i] : '◼️';
    return s;
  }
  const GAUGE_STYLE_ID = 'listing-kit-styles';
  const GAUGE_CSS = `
.lk-gauges{ display:grid; grid-template-columns:auto auto; justify-content:start; gap:2px 10px; font-size:.9333rem; line-height:1.45; margin:6px 0; }
.lk-gauge{ letter-spacing:-1px; white-space:nowrap; }
.lk-gauge-word{ color:var(--text-secondary); white-space:nowrap; }
.lk-facts{ list-style:none; margin:4px 0 6px; padding:0; font-size:.9rem; line-height:1.6; color:var(--text-primary); }
.lk-card{ border:1px solid var(--color-border-tertiary); border-radius:14px; background:var(--surface-2); padding:10px 12px 12px; margin-bottom:14px; }
.lk-head{ display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:4px 10px; margin-bottom:8px; }
.lk-title{ font-size:1.0667rem; font-weight:700; color:var(--text-primary); }
.lk-tag{ display:inline-flex; align-items:center; justify-content:center; min-width:1.6em; height:1.6em; border-radius:50%; margin-right:6px;
  background:var(--text-accent); color:#fff; font-size:.8667rem; font-weight:700; vertical-align:middle; }
.lk-price{ font-size:1.1333rem; font-weight:700; color:var(--good); }
.lk-pics{ display:grid; grid-template-columns:minmax(0, 1.35fr) minmax(0, 1fr); gap:8px; align-items:center; margin-bottom:8px; }
.lk-pics > div{ min-width:0; }
.lk-cap{ font-size:.7333rem; color:var(--text-muted); text-align:center; margin-top:2px; }
.lk-body{ display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:4px 14px; }
.lk-ad{ grid-column:1 / -1; font-size:.9333rem; line-height:1.55; color:var(--text-primary); margin:0 0 4px; }
@media (max-width:560px){ .lk-pics, .lk-body{ grid-template-columns:1fr; } }
`;
  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(GAUGE_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = GAUGE_STYLE_ID;
    s.textContent = GAUGE_CSS;
    document.head.appendChild(s);
  }
  function gaugesHtml(gauges, keys) {
    injectStyles();
    const list = (keys || GAUGES.map(g => g.key)).map(k => GAUGES.find(g => g.key === k)).filter(Boolean);
    return '<div class="lk-gauges" role="list">' + list.map(g =>
      `<span class="lk-gauge" role="listitem" aria-label="${g.word}: ${gauges[g.key]} out of 6">${gauge(g.key, gauges[g.key])}</span>` +
      `<span class="lk-gauge-word" aria-hidden="true">${g.emoji} ${g.word}</span>`).join('') + '</div>';
  }

  /* ── a whole random listing ────────────────────────────────────────────── */
  const STREETS = {
    downtown: ['Main Street', 'Market Street', 'Central Avenue', 'King Street', 'Bank Street'],
    suburb: ['Maple Drive', 'Oak Lane', 'Rose Avenue', 'Park Road', 'Sunny Close'],
    riverside: ['River Road', 'Bridge Street', 'Water Lane', 'Mill Road', 'Harbor View'],
    countryside: ['Farm Road', 'Hill Lane', 'Old Mill Road', 'Green Valley Road', 'Apple Tree Lane'],
    industrial: ['Station Road', 'Factory Street', 'Railway Avenue', 'Iron Street', 'Dock Road']
  };
  const PRICE_M2 = { downtown: 3400, suburb: 2000, riverside: 2500, countryside: 1100, industrial: 1000 };
  const HOUSE_SPEC = {
    downtown:    rnd => ({ w: pick(rnd, [5, 6]), d: 4, floors: 2, wall: pick(rnd, ['masonry', 'drywall']), roof: 'flat', roofmat: 'concrete', garden: false }),
    suburb:      rnd => ({ w: pick(rnd, [7, 8]), d: pick(rnd, [5, 6]), floors: pick(rnd, [1, 2, 2]), wall: pick(rnd, ['lap', 'masonry', 'vertical']), roof: pick(rnd, ['gable', 'gable', 'opengable']), roofmat: pick(rnd, ['clay', 'concrete']), garden: true, pool: rnd() < 0.45 }),
    riverside:   rnd => ({ w: pick(rnd, [6, 7]), d: pick(rnd, [5, 6]), floors: pick(rnd, [1, 2]), wall: pick(rnd, ['vertical', 'lap']), roof: pick(rnd, ['shed', 'gable']), roofmat: pick(rnd, ['metal', 'clay']), garden: true, fence: pick(rnd, ['picket', 'lattice']), pool: rnd() < 0.25 }),
    countryside: rnd => ({ w: pick(rnd, [7, 8, 9]), d: pick(rnd, [5, 6]), floors: 1, wall: pick(rnd, ['masonry', 'vertical']), roof: 'gable', roofmat: 'clay', garden: true, fence: pick(rnd, ['picket', 'board']), yard: 4, pool: rnd() < 0.3 }),
    industrial:  rnd => ({ w: pick(rnd, [6, 7]), d: pick(rnd, [4, 5]), floors: 1, wall: pick(rnd, ['drywall', 'masonry']), roof: pick(rnd, ['shed', 'flat']), roofmat: 'metal', garden: rnd() < 0.4, fence: 'chain' })
  };
  const YEARS = { downtown: [1925, 1995], suburb: [1975, 2022], riverside: [1950, 2024], countryside: [1890, 1990], industrial: [1935, 1985] };

  function random(rnd, type) {
    rnd = rnd || Math.random;
    type = type || pick(rnd, AREA_TYPES);
    const ar = area(type, rnd);
    const spec = HOUSE_SPEC[type](rnd);
    const size = spec.w * spec.d * spec.floors;
    const year = between(rnd, YEARS[type]);
    const hf = house(spec);
    const { bedrooms, bathrooms } = hf.plan;   // what the picture really has
    const age = 2026 - year;
    let price = size * PRICE_M2[type] * (age > 60 ? 0.75 : age > 30 ? 0.9 : 1.05) + (spec.pool ? 18000 : 0) + (spec.garden ? 9000 : 0);
    price = Math.max(35000, Math.round(price / 5000) * 5000);
    const facts = { size, bedrooms, bathrooms, floors: spec.floors, garden: !!spec.garden, pool: !!spec.pool, year, price, km: ar.km };
    const num = 1 + Math.floor(rnd() * 98);
    const title = num + ' ' + pick(rnd, STREETS[type]);
    return { type, area: ar, house: hf, houseFile: hf, city: ar.city, gauges: ar.gauges, facts, title, ad: describe(facts, ar) };
  }

  const money = n => '$' + n.toLocaleString('en-US');
  function describe(f, ar) {
    const sizeWord = f.size >= 80 ? 'big' : f.size >= 50 ? 'medium-sized' : 'small';
    const ageWord = f.year >= 2010 ? 'new' : f.year >= 1980 ? 'modern' : 'old';
    const quiet = ar.gauges.noise <= 2 ? 'quiet ' : ar.gauges.noise >= 5 ? 'busy ' : '';
    const where = ar.type === 'downtown' ? 'in the city center'
      : 'in a ' + quiet + { suburb: 'suburb', riverside: 'neighborhood by the river', countryside: 'village in the countryside', industrial: 'neighborhood near the factories' }[ar.type];
    const parts = [
      `A ${sizeWord}, ${ageWord} house ${where}.`,
      `${f.bedrooms} bedroom${f.bedrooms > 1 ? 's' : ''}, ${f.bathrooms} bathroom${f.bathrooms > 1 ? 's' : ''}` +
        (f.garden && f.pool ? ', a garden and a swimming pool.' : f.garden ? ' and a garden.' : f.pool ? ' and a swimming pool.' : '.'),
      `${f.size} m² on ${f.floors === 1 ? 'one floor' : 'two floors'}. Built in ${f.year}.`,
      f.km <= 1 ? 'In the city center.' : `${f.km} km from the city center.`
    ];
    return parts.join(' ');
  }

  /* ── three fixed houses, shared by the comparatives clarification and
     controlled practice, so both pages talk about exactly the same houses ── */
  const EXAMPLES = [
    { id: 'main', name: 'Main Street', title: '🏙️ 8 Main Street', area: 'downtown', where: 'in the city center',
      house: { w: 5, d: 4, floors: 2, wall: 'masonry', roof: 'flat', roofmat: 'concrete', garden: false },
      map: ['🏢 🏪 R 🏦 ☕ 🏢', 'R R R R R R', '🍕 🏠@red R 🏢 P 💊', '🏢 🏬 R 🍔 🏢 🏨', 'R R R R R R'],
      gauges: { noise: 6, traffic: 6, pollution: 5, parks: 1, shops: 6, safety: 3 },
      facts: { size: 40, bedrooms: 1, bathrooms: 1, floors: 2, garden: false, pool: false, year: 1960, price: 160000, km: 1 } },
    { id: 'oak', name: 'Oak Lane', title: '🏡 24 Oak Lane', area: 'suburb', where: 'in a suburb',
      house: { w: 8, d: 6, floors: 2, wall: 'lap', roof: 'gable', roofmat: 'clay', garden: true, pool: true },
      map: ['🏠 🌳 🏠 R 🏡 🏠', 'R R R R 🌳 🌳', '🏠 🏠@red 🏡 R 🌳 🌳', '🌳 . 🏠 R 🏪 .', '🏠 🏫 🏠 R 🏠 🌳'],
      gauges: { noise: 2, traffic: 3, pollution: 2, parks: 4, shops: 3, safety: 6 },
      facts: { size: 96, bedrooms: 4, bathrooms: 2, floors: 2, garden: true, pool: true, year: 2015, price: 240000, km: 9 } },
    { id: 'farm', name: 'Farm Road', title: '🌾 3 Farm Road', area: 'countryside', where: 'in the countryside',
      house: { w: 9, d: 6, floors: 1, wall: 'masonry', roof: 'gable', roofmat: 'clay', garden: true, fence: 'board', yard: 4 },
      map: ['🌲 🌳 . . 🐄 🌳', '. 🌾 🌾 . 🏠@red .', 'R R R R R R', '🐑 . 🌾 🌾 . 🌲', '🌳 🌲 🌾 🌾 🚜 🌳'],
      ground: ['. . . . . .', '. dirt dirt . . .', '. . . . . .', '. . dirt dirt . .', '. . dirt dirt . .'],
      gauges: { noise: 1, traffic: 1, pollution: 1, parks: 6, shops: 1, safety: 5 },
      facts: { size: 54, bedrooms: 2, bathrooms: 1, floors: 1, garden: true, pool: false, year: 1925, price: 90000, km: 30 } }
  ];
  EXAMPLES.forEach(x => { x.city = CityPicture.map({ rows: x.map, ground: x.ground }); x.houseFile = house(x.house); });

  // the facts as a short list, for a listing card
  function factsHtml(f) {
    return '<ul class="lk-facts">' +
      `<li>📐 ${f.size} m² · ${f.floors === 1 ? 'one floor' : 'two floors'}</li>` +
      `<li>🛏️ ${f.bedrooms} bedroom${f.bedrooms > 1 ? 's' : ''} · 🛁 ${f.bathrooms} bathroom${f.bathrooms > 1 ? 's' : ''}</li>` +
      `<li>📅 built in ${f.year}</li>` +
      `<li>📍 ${f.km <= 1 ? 'in the city center' : f.km + ' km from the city center'}</li>` +
      (f.garden || f.pool ? `<li>${f.garden ? '🌷 garden' : ''}${f.garden && f.pool ? ' · ' : ''}${f.pool ? '🏊 swimming pool' : ''}</li>` : '') +
      '</ul>';
  }

  /* A listing card: title (and a letter tag), price, the house, its map, the
     ad text (optional), the facts and the gauges. x is a ListingKit.random()
     result or one of EXAMPLES.

     cardHtml(x, opts)            the card as markup, with a still picture of the house
     renderCards(el, list, opts)  the cards into el, each house in a HouseViewer —
                                  drag to move, ± or pinch to zoom, ⟲ ⟳ to turn,
                                  ✂️ / 🧱 to look inside, 🏠 roof on or off, ▲ ▼ floors
       opts: { ad: true, tag: (x, i) => 'A' } */
  function cardParts(x, opts, houseHtml) {
    injectStyles();
    return `<article class="lk-card"${x.id ? ` data-id="${x.id}"` : ''}>` +
      `<div class="lk-head"><span class="lk-title">${opts.tag ? `<span class="lk-tag">${opts.tag}</span>` : ''}${x.title}</span>` +
      `<span class="lk-price">${money(x.facts.price)}</span></div>` +
      `<div class="lk-pics"><div><div class="lk-house">${houseHtml}</div><div class="lk-cap">the house</div></div>` +
      `<div>${CityPicture.svg(x.city, { alt: 'Map of the neighborhood. A red pin shows the house.' })}<div class="lk-cap">📍 the neighborhood</div></div></div>` +
      `<div class="lk-body">${opts.ad && x.ad ? `<p class="lk-ad">${x.ad}</p>` : ''}<div>${factsHtml(x.facts)}</div><div>${gaugesHtml(x.gauges)}</div></div>` +
      '</article>';
  }
  const houseName = x => x.title.replace(/^\S+\s/, '');
  function cardHtml(x, opts) {
    opts = opts || {};
    return cardParts(x, opts, houseSvg(x.houseFile || x.house, { alt: 'The house at ' + houseName(x) }));
  }
  function renderCards(el, list, opts) {
    opts = opts || {};
    if (typeof el === 'string') el = document.getElementById(el);
    el.innerHTML = list.map((x, i) => cardParts(x, { ad: opts.ad, tag: opts.tag ? opts.tag(x, i) : '' }, '')).join('');
    const slots = el.querySelectorAll('.lk-house');
    return list.map((x, i) => {
      const hf = x.houseFile || x.house;
      const top = Math.max(0, ...hf.floors.map(f => f.level));
      return HouseViewer.build({ container: slots[i], house: hf, level: top, roofs: true, walls: 'full',
        floorNames: top > 0 ? { 0: 'Downstairs', 1: 'Upstairs' } : undefined, alt: 'The house at ' + houseName(x) });
    });
  }

  global.ListingKit = { EXAMPLES, cardHtml, renderCards, factsHtml, house, houseSvg, area, gauge, gaugesHtml, random, describe, money, GAUGES, AREA_TYPES, AREAS };
})(window);
