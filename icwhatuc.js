/* ══════════════════════════════════════════════════════════════════════════
   ICwhatUC — see what the others point at and select on the same lesson page.
   Loaded on demand by the loader in house.js: on the first press of 🤝, when the
   page is opened from an invitation link (#icw=…), or when this tab is already
   in a session (a new lesson page in the same tab rejoins by itself).

   Version 1 (phase 1): the panel, names and colours, a ring round the element
   under each person's pointer, a live mirror of each person's text selection,
   tags on the screen edge for highlights that are off screen, and two rail
   buttons:  🖍️ show my highlights (starts on)   👀 see the others (starts on).
   Nothing stays on the page: each message replaces that person's last one.

   CONNECTING
     The host presses Start and sends one link. Anyone who opens it types a name
     and presses Join. The handshake goes through public relays by the Trystero
     library (Nostr by default), encrypted with the key after the # in the link,
     which is never sent to the web server. Highlights then go browser to browser.
     The room is per page: people see each other when they are on the same lesson.
     The session belongs to the tab (sessionStorage), so the next lesson page in
     that tab joins its own room with no new link.
     An optional TURN relay, set by the host only, helps networks that cannot be
     reached directly (saved on that device, never in a link).

   WHERE THE LIBRARY COMES FROM
     https://esm.run/trystero, or <html data-icwhatuc-lib="trystero.js">,
     or window.ICWHATUC_LIB set before house.js. A copy next to the lesson files
     removes the CDN.

   API
     ICwhatUC.toggle()              open or close the panel (the 🤝 button)
     ICwhatUC.start({ name })       host: make a room → Promise of the link
     ICwhatUC.join(link, { name })  join from a link
     ICwhatUC.leave()  ICwhatUC.end()   (end: host only, for everyone)
     ICwhatUC.peers()               [{ id, name, color, host }]
     ICwhatUC.link()                the invitation link for this page, or null
     ICwhatUC.showHighlights(on)    🖍️      ICwhatUC.seeOthers(on)   👀
     ICwhatUC.key(element[, key])   read or set an element's shared key
     ICwhatUC.on(type, fn)  ICwhatUC.send(type, data)   for later features
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ICwhatUC) return;

  var PROTOCOL = 1;
  var APP_ID = 'icwhatuc-english-materials';
  var LIB = global.ICWHATUC_LIB || document.documentElement.getAttribute('data-icwhatuc-lib') || 'https://esm.run/trystero';
  var SESSION = 'icwhatuc-session';
  var KEY = { name: 'icwhatuc-name', hl: 'icwhatuc-show-highlights', see: 'icwhatuc-see-others', relay: 'icwhatuc-relay' };
  var COLORS = ['#1f7ae0', '#d6336c', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599'];
  var OURS = '#icw-layer, #icw-panel, #house-rail, #font-size-panel, .hd-card, .hd-arrow, .hd-hint';
  /* what a ring goes round: the smallest of these under the pointer */
  var RING = '.word-chip, .match-card, .match-stage .card, .hm-card, .fc-chip, .fc-zone, .fc-word, .opt, .ccq-opt, ' +
    '.eh2-word, .eh2-gap, .eh-word, .gf-gap-input, input.gap, .word-btn, .bubble, .think-cloud, .avatar, td, th, li, ' +
    '.q-card, .seq-step, .pair-line, .ccq-sentence, .ccq-row, .rule-box, .timeline-wrap, .setting-chip, p, h1, h2, h3, summary, button, img';

  /* ── small helpers ──────────────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  function store(k, v) {
    try { if (v === undefined) { var s = localStorage.getItem(k); return s == null ? null : JSON.parse(s); } localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { return null; }
    return v;
  }
  function session(v) {
    try {
      if (v === undefined) return JSON.parse(sessionStorage.getItem(SESSION) || 'null');
      if (v === null) sessionStorage.removeItem(SESSION); else sessionStorage.setItem(SESSION, JSON.stringify(v));
    } catch (e) { return null; }
    return v;
  }
  function random(n) {
    var a = new Uint8Array(n), s = '', L = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    crypto.getRandomValues(a);
    for (var i = 0; i < n; i++) s += L[a[i] % L.length];
    return s;
  }
  function hash(str) {        /* FNV-1a, 32 bits, in base 36 */
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  function ours(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest && el.closest(OURS));
  }
  function cleanName(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
  function pagePath() { return location.pathname.replace(/\/index\.html?$/i, '/').toLowerCase(); }

  /* ══ SHARED KEYS ═════════════════════════════════════════════════════════
     An element is sent as a key that every browser computes the same way,
     whatever the window size, text size, theme or display toggles:
       1. its own key: data-icw-key, a component's data attributes (table below), or its id
       2. otherwise: the nearest ancestor with its own key, then this element's tag and
          a hash of its text and which one of those it is (or its position, if it has no text). */
  var gen = 0;               /* goes up whenever the page's DOM changes */
  var keyCache = new WeakMap(), sigCache = new WeakMap();

  function scope(el) { var a = el.parentElement && el.parentElement.closest('[id]'); return a ? a.id : ''; }
  var TABLE = {
    m:  ['.match-card[data-id]', function (el) { return [scope(el), el.dataset.side, el.dataset.id]; }],
    hm: ['.hm-card[data-id]', function (el) { return [scope(el), el.dataset.id, el.dataset.side]; }],
    fz: ['.fc-zone[data-item]', function (el) { return [scope(el), el.dataset.item, el.dataset.part]; }],
    fp: ['.fc-chip[data-pos]', function (el) { return [scope(el), el.dataset.pos]; }],
    o:  ['.opt[data-q][data-o]', function (el) { return [scope(el), el.dataset.q, el.dataset.o]; }],
    wo: ['.wo-item[data-idx]', function (el) { return [scope(el), el.dataset.idx]; }],
    wc: ['.word-chip[data-word]', function (el) {
      var item = el.closest('.wo-item'), same = item ? [].filter.call(item.querySelectorAll('.word-chip'), function (c) { return c.dataset.word === el.dataset.word; }) : [el];
      return [item ? scope(item) + '.' + item.dataset.idx : scope(el), el.dataset.word, same.indexOf(el)];
    }]
  };
  var TABLE_ORDER = Object.keys(TABLE);

  function ownKey(el) {
    if (el.dataset && el.dataset.icwKey) return 'k:' + el.dataset.icwKey;
    for (var i = 0; i < TABLE_ORDER.length; i++) {
      var t = TABLE[TABLE_ORDER[i]];
      if (el.matches(t[0])) return TABLE_ORDER[i] + ':' + t[1](el).map(function (x) { return String(x == null ? '' : x).replace(/:/g, '%3A'); }).join(':');
    }
    if (el.id) return 'i:' + el.id;
    return null;
  }
  /* the element's text, as the same string on every page: no drawings, no spacing differences */
  function sig(el) {
    var c = sigCache.get(el);
    if (c && c.gen === gen) return c.v;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement.closest('svg, script, style, #icw-layer') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var t = '', n;
    while ((n = w.nextNode()) && t.length < 600) t += n.nodeValue;   /* no separator: bionic and mark spans split words into pieces */
    t = t.replace(/\s+/g, ' ').trim().slice(0, 400);
    var v = t ? hash(t) : '';
    sigCache.set(el, { gen: gen, v: v });
    return v;
  }
  function anchorOf(el) {
    for (var a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) if (ownKey(a)) return a;
    return document.body;
  }
  function keyOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el === document.body || el === document.documentElement) return 'b';
    var c = keyCache.get(el);
    if (c && c.gen === gen) return c.v;
    var v = ownKey(el);
    if (!v) {
      var anchor = anchorOf(el), tag = el.tagName.toLowerCase(), s = sig(el);
      var list = [].filter.call(anchor.querySelectorAll(tag), function (x) { return !ours(x) && (!s || sig(x) === s); });
      v = keyOf(anchor) + '|~' + tag + (s ? '~' + s + '~' : '@') + Math.max(0, list.indexOf(el));
    }
    keyCache.set(el, { gen: gen, v: v });
    return v;
  }
  function resolveOwn(k) {
    if (k === 'b') return document.body;
    var m = /^([a-z]+):(.*)$/.exec(k);
    if (!m) return null;
    if (m[1] === 'i') return document.getElementById(m[2]);
    if (m[1] === 'k') { try { return document.querySelector('[data-icw-key="' + CSS.escape(m[2]) + '"]'); } catch (e) { return null; } }
    var t = TABLE[m[1]];
    if (!t) return null;
    var all = document.querySelectorAll(t[0]);
    for (var i = 0; i < all.length; i++) if (!ours(all[i]) && ownKey(all[i]) === k) return all[i];
    return null;
  }
  function resolveKey(k) {
    if (typeof k !== 'string' || k.length > 600) return null;
    var cut = k.lastIndexOf('|~'), seg = cut >= 0 ? k.slice(cut + 2) : '';
    var m = /^([a-z][a-z0-9-]*)(?:~([a-z0-9]+)~|@)(\d+)$/.exec(seg);
    if (!m) return resolveOwn(k);
    var anchor = resolveKey(k.slice(0, cut));
    if (!anchor) return null;
    var list = [].filter.call(anchor.querySelectorAll(m[1]), function (x) { return !ours(x) && (!m[2] || sig(x) === m[2]); });
    /* the same text, but not the same number of them: the nearest one we have */
    return list[Math.min(+m[3], list.length - 1)] || null;
  }

  /* ══ TEXT SELECTIONS ═════════════════════════════════════════════════════
     Sent as words, not character offsets: per block, the block's key, the selected
     words and which occurrence of them it is. HouseDict's text helpers turn a block
     into one string with a map back to its text nodes. */
  function textApi() { return global.HouseDict && global.HouseDict.text; }
  function normText(text) {   /* whitespace runs → one space, with a map back to the original */
    var t = '', map = [], sp = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (/\s/.test(ch)) { if (!sp && t) { t += ' '; map.push(i); } sp = true; }
      else { t += ch; map.push(i); sp = false; }
    }
    return { t: t, map: map };
  }
  function selectionPieces() {
    var T = textApi(), s = global.getSelection && global.getSelection();
    if (!T || !s || s.isCollapsed || !s.rangeCount) return null;
    var r = s.getRangeAt(0), root = r.commonAncestorContainer;
    if (root.nodeType !== 1) root = root.parentElement;
    if (!root || ours(root)) return null;
    var blocks = [], seen = new Set();
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    if (r.startContainer.nodeType === 3 && root.contains(r.startContainer)) w.currentNode = r.startContainer;
    for (var n = w.currentNode.nodeType === 3 ? w.currentNode : w.nextNode(); n; n = w.nextNode()) {
      if (!r.intersectsNode(n)) { if (blocks.length) break; else continue; }
      if (!n.nodeValue.trim() || ours(n) || n.parentElement.closest('svg, script, style, input, textarea')) continue;
      var b = T.blockOf(n);
      if (!seen.has(b)) { seen.add(b); blocks.push(b); if (blocks.length > 12) break; }
    }
    var pieces = [];
    blocks.forEach(function (block) {
      var model = T.textModel(block), a = Infinity, z = -1;
      model.parts.forEach(function (p) {
        if (!r.intersectsNode(p.node)) return;
        var s0 = p.node === r.startContainer ? r.startOffset : 0, e0 = p.node === r.endContainer ? r.endOffset : p.node.nodeValue.length;
        a = Math.min(a, p.start + s0); z = Math.max(z, p.start + e0);
      });
      if (z <= a) return;
      var nt = normText(model.text), na = 0, nz = nt.map.length;
      while (na < nt.map.length && nt.map[na] < a) na++;
      while (nz > 0 && nt.map[nz - 1] >= z) nz--;
      var words = nt.t.slice(na, nz).trim();
      if (!words) return;
      na = nt.t.indexOf(words, na);
      var occ = 0, at = -1;
      while ((at = nt.t.indexOf(words, at + 1)) !== -1 && at < na) occ++;
      pieces.push({ k: keyOf(block), w: words.slice(0, 1000), n: occ });
    });
    return pieces.length ? pieces : null;
  }
  function rangeForPiece(block, piece) {
    var T = textApi();
    if (!T) return null;
    var model = T.textModel(block);
    if (!model.parts.length) return null;
    var nt = normText(model.text), at = -1;
    for (var i = 0; i <= piece.n; i++) { at = nt.t.indexOf(piece.w, at + 1); if (at === -1) return null; }
    try { return T.rangeFor(model, nt.map[at], nt.map[at + piece.w.length - 1] + 1); } catch (e) { return null; }
  }

  /* ══ STATE ═══════════════════════════════════════════════════════════════ */
  var S = {
    mod: null, room: null, self: null, role: null, name: '', sess: null, joinedAt: 0,
    peers: {}, actions: {}, status: 'idle', note: '', listeners: {},
    mine: { over: null, sel: null, selJson: 'null' }
  };
  var prefs = {
    hl: store(KEY.hl) !== false,
    see: store(KEY.see) !== false
  };

  function peer(id) {
    if (!S.peers[id]) S.peers[id] = { id: id, name: '', host: false, color: COLORS[0], over: null, sel: null, dirty: true, gen: -1, overEl: null, ranges: [], blocks: [], rate: { t: 0, n: 0 } };
    return S.peers[id];
  }
  function assignColors() {
    var all = Object.keys(S.peers).map(function (id) { return { id: id, host: S.peers[id].host }; });
    if (S.self) all.push({ id: S.self, host: S.role === 'host' });
    all.sort(function (a, b) { return (b.host - a.host) || (a.id < b.id ? -1 : 1); });
    var used = {};
    all.forEach(function (p) {
      var c = p.host ? 0 : parseInt(hash(p.id), 36) % COLORS.length, tries = 0;
      while (used[c] && tries++ < COLORS.length) c = (c + 1) % COLORS.length;
      used[c] = true;
      if (p.id === S.self) S.color = COLORS[c]; else S.peers[p.id].color = COLORS[c];
    });
  }

  /* ══ THE LIBRARY ═════════════════════════════════════════════════════════
     Trystero's interface has had three shapes; all are spoken here. joinRoom takes
     exactly two arguments. Handlers are registered by calling onX(fn), by assigning
     onX = fn, or (oldest) through the second item of makeAction's array. */
  function on(room, event, handler) {
    var slot, done = false;
    try { slot = room[event]; } catch (e) { slot = undefined; }
    if (typeof slot === 'function') { try { slot.call(room, handler); done = true; } catch (e) { /* not a registrar */ } }
    try { room[event] = handler; } catch (e) { if (!done) console.warn('ICwhatUC: cannot listen for ' + event, e); }
  }
  function makeAction(name, handler) {
    var a = S.room.makeAction(name);
    var wrapped = function (data, meta) {
      var id = typeof meta === 'string' ? meta : (meta && meta.peerId);
      if (id && S.room) receive(name, data, id, handler);
    };
    if (Array.isArray(a)) { a[1](wrapped); return function (d) { try { return a[0](d); } catch (e) { /* the link is going */ } }; }
    var slot;
    try { slot = a.onMessage; } catch (e) { slot = undefined; }
    if (typeof slot === 'function') slot.call(a, wrapped); else a.onMessage = wrapped;
    return function (d) { try { return a.send(d); } catch (e) { /* the link is going */ } };
  }
  function receive(name, data, id, handler) {
    var p = peer(id), now = Date.now();
    if (now - p.rate.t > 1000) { p.rate.t = now; p.rate.n = 0; }
    if (++p.rate.n > 60) return;                          /* too many: dropped */
    if (!data || typeof data !== 'object') return;
    try { handler(data, p); } catch (e) { console.warn('ICwhatUC: a message was not understood', e); }
  }

  function relayFor(role) {
    if (role !== 'host') return null;
    var r = store(KEY.relay);
    if (!r || !r.on || !r.urls || !r.urls.length) return null;
    return { urls: r.urls, username: r.username || '', credential: r.credential || '' };
  }

  async function enter(sess) {
    if (S.room) quietLeave();
    S.sess = sess; S.role = sess.role; S.name = sess.name;
    session(sess);
    setStatus('connecting');
    try { if (!S.mod) S.mod = await import(LIB); }
    catch (e) { console.warn('ICwhatUC: the library did not load', e); setStatus('error', 'We cannot connect now. Check the internet and try again.'); return; }
    if (S.sess !== sess) return;                           /* left while loading */
    var config = { appId: APP_ID, password: sess.key }, turn = relayFor(sess.role);
    if (turn) config.turnConfig = [turn];
    try { S.room = S.mod.joinRoom(config, sess.room + ':' + pagePath()); }
    catch (e) { console.warn('ICwhatUC: could not join', e); setStatus('error', 'We cannot connect now. Try again.'); return; }
    S.self = String(S.mod.selfId || random(10));
    S.joinedAt = Date.now();
    S.peers = {};
    on(S.room, 'onError', function (e) { console.warn('ICwhatUC: library problem', e); });
    on(S.room, 'onJoinError', function (e) { console.warn('ICwhatUC: join problem', e); });

    S.actions.hello = makeAction('hello', function (d, p) {
      var fresh = !p.name;
      p.name = cleanName(d.name) || 'Partner'; p.host = d.host === true; p.v = +d.v || 0;
      assignColors(); renderPanel(); kick();
      if (fresh) emit('join', publicPeer(p));
    });
    S.actions.over = makeAction('over', function (d, p) {
      var k = typeof d.k === 'string' && d.k.length <= 600 ? d.k : null;
      if (k !== p.over) { p.over = k; p.dirty = true; kick(); }
    });
    S.actions.sel = makeAction('sel', function (d, p) {
      var list = Array.isArray(d.p) ? d.p.slice(0, 12).filter(function (x) {
        return x && typeof x.k === 'string' && x.k.length <= 600 && typeof x.w === 'string' && x.w && x.w.length <= 1000 && x.n >= 0 && x.n < 1000;
      }) : [];
      p.sel = list.length ? list : null; p.dirty = true; kick();
    });
    S.actions.bye = makeAction('bye', function (d, p) {
      if (d.end && p.host) { ended(p.name); return; }
      gone(p.id);
    });
    S.actions.x = makeAction('x', function (d, p) {
      var fns = S.listeners[String(d.t)];
      if (fns) fns.forEach(function (fn) { try { fn(d.d, publicPeer(p)); } catch (e) { console.warn(e); } });
    });
    on(S.room, 'onPeerJoin', function (id) { peer(String(id)); sayHello(); renderPanel(); });
    on(S.room, 'onPeerLeave', function (id) { gone(String(id)); });

    assignColors();
    setStatus('room');
    rail(true);
    sayHello();
    kick();
    setTimeout(function () { if (S.room && S.sess === sess && !named().length) renderPanel(); }, 30000);
  }
  function emit(type, data) { (S.listeners[type] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.warn(e); } }); }
  function named() { return Object.keys(S.peers).filter(function (id) { return S.peers[id].name; }).map(function (id) { return S.peers[id]; }); }
  function publicPeer(p) { return { id: p.id, name: p.name, color: p.color, host: p.host }; }

  /* everything I show, to everyone: a newcomer gets it this way */
  function sayHello() {
    if (!S.room) return;
    S.actions.hello({ v: PROTOCOL, name: S.name, host: S.role === 'host' });
    S.actions.over({ k: prefs.hl ? S.mine.over : null });
    S.actions.sel({ p: prefs.hl ? S.mine.sel : null });
  }
  function gone(id) {
    var p = S.peers[id];
    if (!p) return;
    delete S.peers[id];
    if (p.name) { S.note = p.name + ' left this page.'; emit('leave', publicPeer(p)); }
    assignColors(); renderPanel(); clearPeerDrawing(id); kick();
  }
  function quietLeave() {
    var room = S.room;
    S.room = null;
    if (room) { try { S.actions.bye({}); } catch (e) { /* already closed */ } try { room.leave(); } catch (e) { /* already closed */ } }
    Object.keys(S.peers).forEach(clearPeerDrawing);
    S.peers = {}; S.actions = {};
    clearDrawing();
  }
  function leave() {
    quietLeave();
    session(null); S.sess = null; S.note = '';
    rail(false); setStatus('idle');
  }
  function end() {
    if (S.role !== 'host' || !S.room) return leave();
    session(null);                           /* at once: a page opened next must not rejoin */
    try { S.actions.bye({ end: true }); } catch (e) { /* closed */ }
    setTimeout(leave, 150);
  }
  function ended(by) {
    quietLeave(); session(null); S.sess = null;
    rail(false); setStatus('ended', (by ? by + ' ended the session.' : 'The session is over.'));
    openPanel(true);
  }
  global.addEventListener('pagehide', function () { if (S.room) { try { S.actions.bye({}); } catch (e) { /* closing */ } try { S.room.leave(); } catch (e) { /* closing */ } } });

  /* ══ WHAT I SEND ═════════════════════════════════════════════════════════ */
  function ringTarget(t) {
    if (!t || t.nodeType !== 1 || ours(t)) return null;
    var el = t.closest(RING);
    return el && el !== document.body ? el : null;
  }
  function sendOver(el) {
    var k = el ? keyOf(el) : null;
    S.mine.over = k;
    S.mine.overEl = el;
    if (S.room && prefs.hl && !document.hidden) S.actions.over({ k: k });
  }
  var overQueued = null, overRaf = 0, tapTimer = 0;
  document.addEventListener('pointermove', function (e) {
    if (!S.room || !prefs.hl || e.pointerType === 'touch') return;
    overQueued = e.target;
    if (overRaf) return;
    overRaf = requestAnimationFrame(function () {
      overRaf = 0;
      var el = ringTarget(overQueued);
      if (el !== S.mine.overEl) sendOver(el);
    });
  }, { capture: true, passive: true });
  document.addEventListener('pointerout', function (e) {
    if (S.room && prefs.hl && !e.relatedTarget && e.pointerType !== 'touch') sendOver(null);
  }, true);
  /* a touch screen has no resting pointer: a tap rings the tapped element for two seconds */
  document.addEventListener('pointerdown', function (e) {
    if (!S.room || !prefs.hl || e.pointerType !== 'touch') return;
    var el = ringTarget(e.target);
    if (!el) return;
    clearTimeout(tapTimer);
    sendOver(el);
    tapTimer = setTimeout(function () { if (S.mine.overEl === el) sendOver(null); }, 2000);
  }, true);
  var selTimer = 0;
  document.addEventListener('selectionchange', function () {
    if (!S.room || !prefs.hl) return;
    clearTimeout(selTimer);
    selTimer = setTimeout(sendSel, 120);
  });
  function sendSel() {
    var p = null;
    try { p = selectionPieces(); } catch (e) { p = null; }
    var j = JSON.stringify(p);
    if (j === S.mine.selJson) return;
    S.mine.sel = p; S.mine.selJson = j;
    if (S.room && prefs.hl) S.actions.sel({ p: p });
  }
  document.addEventListener('visibilitychange', function () {
    if (!S.room || !prefs.hl) return;
    if (document.hidden) S.actions.over({ k: null }); else S.actions.over({ k: S.mine.over });
  });

  /* ══ WHAT I SEE ══════════════════════════════════════════════════════════
     One fixed layer that ignores the pointer, under the rail and the dictionary
     card. Selections are painted with the CSS Custom Highlight API, so the page's
     own markup is never touched; browsers without it get boxes in the layer. */
  var layer = null, edgeTop = null, edgeBottom = null, raf = 0, hasHL = !!(global.CSS && CSS.highlights && global.Highlight);
  var drawn = {};            /* id → { ring, tag, selTag, edge, boxes:[] } */

  function ensureLayer() {
    if (layer && layer.isConnected) return;
    injectStyles();
    layer = document.createElement('div');
    layer.id = 'icw-layer';
    layer.setAttribute('aria-hidden', 'true');
    edgeTop = document.createElement('div'); edgeTop.className = 'icw-edges icw-top';
    edgeBottom = document.createElement('div'); edgeBottom.className = 'icw-edges icw-bottom';
    layer.appendChild(edgeTop); layer.appendChild(edgeBottom);
    document.body.appendChild(layer);
  }
  function parts(id) {
    if (drawn[id]) return drawn[id];
    ensureLayer();
    var d = { boxes: [] };
    d.ring = document.createElement('div'); d.ring.className = 'icw-ring';
    d.tag = document.createElement('div'); d.tag.className = 'icw-name';
    d.selTag = document.createElement('div'); d.selTag.className = 'icw-name icw-selname';
    d.edge = document.createElement('button'); d.edge.type = 'button'; d.edge.className = 'icw-edge'; d.edge.tabIndex = -1;
    d.edge.addEventListener('click', function (e) { e.stopPropagation(); goTo(id); });
    layer.appendChild(d.ring); layer.appendChild(d.tag); layer.appendChild(d.selTag);
    return (drawn[id] = d);
  }
  function clearPeerDrawing(id) {
    var d = drawn[id];
    if (!d) return;
    [d.ring, d.tag, d.selTag, d.edge].concat(d.boxes).forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    delete drawn[id];
    if (hasHL) try { CSS.highlights.delete('icw-' + id); } catch (e) { /* gone */ }
  }
  function clearDrawing() {
    Object.keys(drawn).forEach(clearPeerDrawing);
    if (hasHL) for (var i = 0; i < COLORS.length; i++) try { CSS.highlights.delete('icw-c' + i); } catch (e) { /* gone */ }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  var hlSig = '';
  function resolvePeer(p) {
    if (!p.dirty && p.gen === gen && (!p.overEl || p.overEl.isConnected)) return;
    p.overEl = p.over ? resolveKey(p.over) : null;
    p.ranges = []; p.blocks = [];
    (p.sel || []).forEach(function (piece) {
      var block = resolveKey(piece.k);
      if (!block) return;
      var r = rangeForPiece(block, piece);
      if (r) p.ranges.push(r); else if (p.blocks.indexOf(block) === -1) p.blocks.push(block);
    });
    p.dirty = false; p.gen = gen;
    hlSig = '';              /* repaint the selections */
  }
  function paintSelections(list) {
    if (!hasHL) return;
    var sigNow = list.map(function (p) { return p.id + p.color + p.gen + (p.sel ? p.sel.length : 0) + p.ranges.length; }).join('|');
    if (sigNow === hlSig) return;
    hlSig = sigNow;
    var byColor = {};
    list.forEach(function (p) { if (p.ranges.length) { var c = COLORS.indexOf(p.color); (byColor[c] = byColor[c] || []).push.apply(byColor[c], p.ranges); } });
    for (var i = 0; i < COLORS.length; i++) {
      try { if (byColor[i]) CSS.highlights.set('icw-c' + i, new Highlight(...byColor[i])); else CSS.highlights.delete('icw-c' + i); } catch (e) { /* no highlights */ }
    }
  }
  function place(el, r, pad) {
    el.style.transform = 'translate(' + Math.round(r.left - pad) + 'px,' + Math.round(r.top - pad) + 'px)';
    el.style.width = Math.round(r.width + pad * 2) + 'px';
    el.style.height = Math.round(r.height + pad * 2) + 'px';
  }
  function placeName(tag, r, name, color) {
    if (tag.textContent !== name) tag.textContent = name;
    tag.style.background = color;
    var y = r.top - 19 < 2 ? r.bottom + 3 : r.top - 19;
    tag.style.transform = 'translate(' + Math.round(Math.max(2, r.left - 3)) + 'px,' + Math.round(y) + 'px)';
    tag.hidden = false;
  }
  function visibleRect(r) { return r && (r.width || r.height); }

  function frame() {
    raf = 0;
    if (!S.room || !prefs.see) { clearDrawing(); hlSig = ''; return; }
    var vh = global.innerHeight, list = named(), keep = {};
    var tops = [], bottoms = [];
    list.forEach(function (p) {
      resolvePeer(p);
      var d = parts(p.id);
      keep[p.id] = true;
      var ringEl = p.overEl || p.blocks[0] || null, ringR = ringEl && ringEl.isConnected ? ringEl.getBoundingClientRect() : null;
      if (visibleRect(ringR)) {
        d.ring.hidden = false; d.ring.style.borderColor = p.color; place(d.ring, ringR, 3);
        placeName(d.tag, ringR, p.name, p.color);
      } else { d.ring.hidden = true; d.tag.hidden = true; }

      var first = null, rects = [];
      p.ranges.forEach(function (r) { [].forEach.call(r.getClientRects(), function (x) { if (x.width) rects.push(x); }); });
      if (rects.length) first = rects[0];
      if (!hasHL) {                           /* boxes instead of the highlight */
        while (d.boxes.length < Math.min(rects.length, 40)) { var b = document.createElement('div'); b.className = 'icw-box'; layer.appendChild(b); d.boxes.push(b); }
        d.boxes.forEach(function (b, i) {
          if (i < rects.length) { b.hidden = false; b.style.background = p.color; place(b, rects[i], 0); } else b.hidden = true;
        });
      }
      if (first && !(ringR && visibleRect(ringR) && Math.abs(ringR.top - first.top) < 4)) placeName(d.selTag, first, p.name, p.color);
      else d.selTag.hidden = true;

      /* off screen: a tag on the top or bottom edge, which takes me there */
      var focus = first || (visibleRect(ringR) ? ringR : null), edge = null;
      if (focus) { if (focus.bottom < 6) edge = 'top'; else if (focus.top > vh - 6) edge = 'bottom'; }
      if (edge) {
        d.edge.textContent = (edge === 'top' ? '▲ ' : '▼ ') + p.name;
        d.edge.style.background = p.color;
        d.edge.title = 'Go to ' + p.name;
        (edge === 'top' ? tops : bottoms).push(d.edge);
      } else if (d.edge.parentNode) d.edge.parentNode.removeChild(d.edge);
    });
    tops.forEach(function (e) { if (e.parentNode !== edgeTop) edgeTop.appendChild(e); });
    bottoms.forEach(function (e) { if (e.parentNode !== edgeBottom) edgeBottom.appendChild(e); });
    Object.keys(drawn).forEach(function (id) { if (!keep[id]) clearPeerDrawing(id); });
    paintSelections(list);
    raf = requestAnimationFrame(frame);       /* follows scrolling, resizing and reflow */
  }
  function goTo(id) {
    var p = S.peers[id];
    if (!p) return;
    var el = p.ranges[0] ? p.ranges[0].startContainer : (p.overEl || p.blocks[0]);
    if (el && el.nodeType !== 1) el = el.parentElement;
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* the page changed: keys and ranges are worked out again */
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i].target;
      if (!ours(t)) { gen++; if (S.room) kick(); return; }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });

  /* ══ RAIL BUTTONS ════════════════════════════════════════════════════════ */
  function rail(on) {
    var R = global.HouseRail;
    if (!R) return;
    R.set('icwhatuc-toggle', on);
    var main = $('icwhatuc-toggle');
    if (main) main.title = on ? 'Work together: on' : 'Work together';
    if (on) {
      R.add({ id: 'icwhatuc-hl', icon: '🖍️', label: 'Show my highlights', order: 62, pressed: prefs.hl, onClick: function () { showHighlights(!prefs.hl); } });
      R.add({ id: 'icwhatuc-see', icon: '👀', label: 'See the others', order: 63, pressed: prefs.see, onClick: function () { seeOthers(!prefs.see); } });
      titles();
    } else { R.remove('icwhatuc-hl'); R.remove('icwhatuc-see'); }
  }
  function titles() {
    var a = $('icwhatuc-hl'), b = $('icwhatuc-see');
    if (a) a.title = prefs.hl ? 'Others see what I point at and select: on' : 'Others see what I point at and select: off';
    if (b) b.title = prefs.see ? 'I see the others: on' : 'I see the others: off';
  }
  function showHighlights(v) {
    prefs.hl = !!v; store(KEY.hl, prefs.hl);
    if (global.HouseRail) global.HouseRail.set('icwhatuc-hl', prefs.hl);
    titles();
    if (!S.room) return;
    if (prefs.hl) { S.mine.selJson = ''; sendSel(); S.actions.over({ k: S.mine.over }); }
    else { S.actions.over({ k: null }); S.actions.sel({ p: null }); }
  }
  function seeOthers(v) {
    prefs.see = !!v; store(KEY.see, prefs.see);
    if (global.HouseRail) global.HouseRail.set('icwhatuc-see', prefs.see);
    titles();
    if (prefs.see) { Object.keys(S.peers).forEach(function (id) { S.peers[id].dirty = true; }); kick(); }
    else { clearDrawing(); hlSig = ''; }
  }

  /* ══ THE PANEL ═══════════════════════════════════════════════════════════
     English only, short sentences, words from the first thousand. */
  var panel = null, invite = null, ticker = 0;

  function setStatus(s, note) { S.status = s; if (note != null) S.note = note; renderPanel(); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function linkNow() { return S.sess ? location.href.split('#')[0] + '#icw=' + S.sess.room + '.' + S.sess.key : null; }

  function ensurePanel() {
    if (panel && panel.isConnected) return;
    injectStyles();
    panel = document.createElement('div');
    panel.id = 'icw-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Work together');
    panel.setAttribute('data-dict', 'off');
    panel.hidden = true;
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') openPanel(false);
      if (e.key === 'Enter' && e.target.id === 'icw-name') { var b = panel.querySelector('[data-do="start"], [data-do="join"]'); if (b) b.click(); }
    });
    document.body.appendChild(panel);
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !(e.target.closest && e.target.closest('#icwhatuc-toggle'))) openPanel(false);
    });
    global.addEventListener('resize', placePanel);
  }
  function placePanel() {
    if (!panel || panel.hidden) return;
    var btn = $('icwhatuc-toggle'), vw = document.documentElement.clientWidth;
    if (!btn) { panel.style.right = '14px'; panel.style.top = '14px'; return; }
    var r = btn.getBoundingClientRect();
    if (vw < 520) { panel.style.right = '8px'; panel.style.left = '8px'; panel.style.top = Math.min(r.bottom + 8, global.innerHeight - panel.offsetHeight - 8) + 'px'; return; }
    panel.style.left = '';
    panel.style.right = Math.max(8, vw - r.left + 8) + 'px';
    panel.style.top = Math.max(8, Math.min(r.top - 8, global.innerHeight - panel.offsetHeight - 8)) + 'px';
  }
  function openPanel(v) {
    ensurePanel();
    panel.hidden = !v;
    if (v) { renderPanel(); placePanel(); var f = panel.querySelector('#icw-name'); if (f && !f.value) f.focus({ preventScroll: true }); }
  }
  function toggle() { ensurePanel(); openPanel(panel.hidden); }

  function nameField() {
    var n = cleanName(S.name || store(KEY.name) || '');
    return '<label class="icw-label" for="icw-name">Your name</label>' +
      '<input id="icw-name" type="text" maxlength="24" autocomplete="given-name" placeholder="First name" value="' + esc(n) + '">';
  }
  var FIRST = '<p class="icw-small">The others see what you point at and select. They cannot see your answers.</p>';
  function relayBox() {
    var r = store(KEY.relay) || {};
    return '<details class="icw-more"><summary>Relay for difficult networks</summary>' +
      '<p class="icw-small">Only the person who starts needs this. It stays on this device.</p>' +
      '<input id="icw-turn-url" type="text" placeholder="turn:example.com:3478  (or paste the JSON)" autocomplete="off" spellcheck="false" value="' + esc((r.urls || []).join(', ')) + '">' +
      '<div class="icw-row"><input id="icw-turn-user" type="text" placeholder="user name" autocomplete="off" spellcheck="false" value="' + esc(r.username || '') + '">' +
      '<input id="icw-turn-pass" type="password" placeholder="password" autocomplete="off" value="' + esc(r.credential || '') + '"></div>' +
      '<label class="icw-check"><input id="icw-turn-on" type="checkbox"' + (r.on ? ' checked' : '') + '> Use it when a direct link fails</label>' +
      '</details>';
  }
  function saveRelay() {
    var u = $('icw-turn-url');
    if (!u) return;
    var text = u.value.trim(), out = { urls: [], username: $('icw-turn-user').value.trim(), credential: $('icw-turn-pass').value, on: $('icw-turn-on').checked };
    if (/^[\[{]/.test(text)) {
      try {
        var j = JSON.parse(text), list = Array.isArray(j) ? j : (j.iceServers ? [].concat(j.iceServers) : [j]);
        list.forEach(function (s) {
          [].concat(s.urls || s.url || []).forEach(function (x) { if (/^turns?:/i.test(x)) out.urls.push(x); });
          if (s.username && !out.username) { out.username = s.username; out.credential = s.credential || ''; }
        });
        out.on = true;
      } catch (e) { /* not JSON after all */ }
    } else out.urls = text.split(/[\s,]+/).filter(function (x) { return /^turns?:/i.test(x); });
    if (out.urls.length) store(KEY.relay, out);
    else if (!text) { try { localStorage.removeItem(KEY.relay); } catch (e) { /* nothing saved */ } }
  }
  function people() {
    var me = '<li><span class="icw-dot" style="background:' + (S.color || COLORS[0]) + '"></span>' + esc(S.name) + ' <span class="icw-small">(you' + (S.role === 'host' ? ', host' : '') + ')</span></li>';
    return '<ul class="icw-people">' + me + named().map(function (p) {
      return '<li><span class="icw-dot" style="background:' + p.color + '"></span>' + esc(p.name) + (p.host ? ' <span class="icw-small">(host)</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function renderPanel() {
    clearInterval(ticker); ticker = 0;
    if (!panel || panel.hidden) return;
    var h = '<div class="icw-head"><span>🤝 Work together</span><button type="button" class="icw-x" data-do="close" aria-label="Close">✕</button></div>';
    var st = S.status;
    if (st === 'idle' && invite) {
      h += '<p>Someone invites you to work together on this page.</p>' + nameField() +
        '<div class="icw-row"><button type="button" class="icw-main" data-do="join">Join</button><button type="button" data-do="no">Not now</button></div>' + FIRST;
    } else if (st === 'idle') {
      h += '<p>Work together on this page.</p>' + nameField() +
        '<div class="icw-row"><button type="button" class="icw-main" data-do="start">Start</button></div>' + FIRST + relayBox();
    } else if (st === 'connecting') {
      h += '<p class="icw-status">Connecting…</p>';
    } else if (st === 'room') {
      var others = named().length;
      if (S.role === 'host') {
        h += '<p>Send this link to your partner:</p><input id="icw-link" type="text" readonly value="' + esc(linkNow()) + '">' +
          '<div class="icw-row"><button type="button" class="icw-main" data-do="copy">Copy link</button></div>';
      }
      h += people();
      var waited = Math.round((Date.now() - S.joinedAt) / 1000);
      h += '<p class="icw-status" id="icw-status">' + (others ? 'You are together now.' :
        (waited >= 30 ? 'Nobody is here yet. Is your partner on this page?' : 'Waiting for your partner… ' + waited + ' s')) + '</p>';
      if (S.note) h += '<p class="icw-small">' + esc(S.note) + '</p>';
      h += '<p class="icw-small">On another lesson page in this tab, you join again by yourself.</p>';
      h += '<div class="icw-row">' + (S.role === 'host' ? '<button type="button" data-do="end">End for everyone</button>' : '<button type="button" data-do="leave">Leave</button>') + '</div>';
      if (!others && waited < 30) ticker = setInterval(function () { var e = $('icw-status'); if (!e || named().length) { renderPanel(); return; } var w = Math.round((Date.now() - S.joinedAt) / 1000); if (w >= 30) renderPanel(); else e.textContent = 'Waiting for your partner… ' + w + ' s'; }, 1000);
    } else if (st === 'ended') {
      h += '<p class="icw-status">' + esc(S.note || 'The session is over.') + '</p><div class="icw-row"><button type="button" class="icw-main" data-do="again">Start again</button></div>';
    } else if (st === 'error') {
      h += '<p class="icw-status icw-bad">' + esc(S.note) + '</p><div class="icw-row"><button type="button" class="icw-main" data-do="retry">Try again</button><button type="button" data-do="leave">Stop</button></div>';
    }
    panel.innerHTML = h;
    placePanel();
  }
  function readName() {
    var f = $('icw-name'), n = cleanName(f && f.value);
    if (!n) { if (f) { f.focus(); f.classList.add('icw-need'); } return null; }
    store(KEY.name, n);
    return n;
  }
  function onPanelClick(e) {
    e.stopPropagation();
    var b = e.target.closest('[data-do]');
    if (!b) return;
    var what = b.getAttribute('data-do');
    if (what === 'close') openPanel(false);
    else if (what === 'start') { var n = readName(); if (!n) return; saveRelay(); start({ name: n }); }
    else if (what === 'join') { var m = readName(); if (!m || !invite) return; var i = invite; invite = null; enter({ room: i.room, key: i.key, role: 'learner', name: m }); }
    else if (what === 'no') { invite = null; renderPanel(); }
    else if (what === 'copy') {
      var link = linkNow(), done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1200); };
      var byHand = function () { var f = $('icw-link'); if (f) { f.select(); try { document.execCommand('copy'); done(); } catch (err) { /* selected: copy by hand */ } } };
      if (navigator.clipboard && global.isSecureContext) navigator.clipboard.writeText(link).then(done, byHand); else byHand();
    }
    else if (what === 'leave') leave();
    else if (what === 'end') end();
    else if (what === 'again') { S.note = ''; setStatus('idle'); }
    else if (what === 'retry') { if (S.sess) enter(S.sess); else setStatus('idle'); }
  }

  function start(o) {
    var sess = { room: random(10), key: random(20), role: 'host', name: cleanName((o && o.name) || S.name || store(KEY.name)) || 'Teacher' };
    return enter(sess).then(linkNow);
  }
  function parseInvite(text) {
    var m = /[#&]icw=([A-Za-z0-9]{6,40})\.([A-Za-z0-9]{8,64})/.exec(String(text || ''));
    return m ? { room: m[1], key: m[2] } : null;
  }

  /* ══ STYLES ══════════════════════════════════════════════════════════════
     Chrome in px, like the rail: the 🔎 text-size slider does not resize it. */
  function injectStyles() {
    if ($('icwhatuc-styles')) return;
    var css = ''
      + '#icw-layer{ position:fixed; inset:0; z-index:990; pointer-events:none; overflow:hidden; }'
      + '#icw-layer [hidden]{ display:none !important; }'
      + '.icw-ring{ position:absolute; left:0; top:0; border:2.5px solid; border-radius:8px; box-sizing:border-box; transition:transform .08s linear, width .08s linear, height .08s linear; }'
      + '.icw-name{ position:absolute; left:0; top:0; color:#fff; font:600 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif; padding:0 6px; border-radius:6px; white-space:nowrap; max-width:180px; overflow:hidden; text-overflow:ellipsis; box-shadow:0 1px 3px rgba(0,0,0,.25); }'
      + '.icw-selname{ opacity:.92; }'
      + '.icw-box{ position:absolute; left:0; top:0; opacity:.28; border-radius:2px; }'
      + '.icw-edges{ position:absolute; left:50%; transform:translateX(-50%); display:flex; gap:6px; }'
      + '.icw-top{ top:6px; } .icw-bottom{ bottom:6px; }'
      + '.icw-edge{ pointer-events:auto; color:#fff; border:none; border-radius:999px; font:600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif; padding:6px 11px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.25); }'
      + '#icw-panel{ position:fixed; z-index:1050; width:300px; max-width:calc(100vw - 16px); box-sizing:border-box; padding:12px 14px; border-radius:14px;'
      +   ' background:var(--surface-2, #fff); color:var(--text-primary, #1a1a1a); border:1px solid var(--border, #e3e3e6); box-shadow:0 8px 24px rgba(0,0,0,.18);'
      +   ' font:14px/1.45 var(--font-sans, system-ui, sans-serif); }'
      + '#icw-panel[hidden]{ display:none; }'
      + '#icw-panel p{ margin:0 0 8px; font-size:14px; }'
      + '#icw-panel .icw-head{ display:flex; align-items:center; justify-content:space-between; font-weight:700; margin-bottom:8px; }'
      + '#icw-panel button{ font:600 13px/1.2 inherit; font-family:inherit; padding:7px 13px; border-radius:999px; border:1px solid var(--border, #e3e3e6); background:var(--surface-1, #f7f7f8); color:inherit; cursor:pointer; }'
      + '#icw-panel button.icw-main{ background:var(--text-accent, #185fa5); border-color:var(--text-accent, #185fa5); color:#fff; }'
      + '#icw-panel .icw-x{ padding:2px 8px; border:none; background:none; font-size:14px; }'
      + '#icw-panel input[type=text], #icw-panel input[type=password]{ display:block; width:100%; box-sizing:border-box; font:14px/1.3 inherit; font-family:inherit; padding:7px 9px; margin:0 0 8px; border-radius:8px;'
      +   ' border:1px solid var(--color-border-secondary, #e3e3e6); background:var(--color-background-primary, #fff); color:inherit; }'
      + '#icw-panel input.icw-need{ border-color:var(--bad, #b0392f); }'
      + '#icw-panel #icw-link{ font:12px/1.3 var(--font-mono, monospace); }'
      + '#icw-panel .icw-row{ display:flex; flex-wrap:wrap; gap:6px; margin:0 0 8px; }'
      + '#icw-panel .icw-row input{ flex:1 1 100px; margin:0; }'
      + '#icw-panel .icw-label{ display:block; font-size:12px; font-weight:600; color:var(--text-secondary, #5b5b60); margin-bottom:3px; }'
      + '#icw-panel .icw-small{ font-size:12px; color:var(--text-secondary, #5b5b60); }'
      + '#icw-panel .icw-status{ font-weight:600; }'
      + '#icw-panel .icw-bad{ color:var(--bad, #b0392f); }'
      + '#icw-panel .icw-people{ list-style:none; margin:0 0 8px; padding:0; }'
      + '#icw-panel .icw-people li{ display:flex; align-items:center; gap:7px; padding:2px 0; }'
      + '#icw-panel .icw-dot{ width:11px; height:11px; border-radius:50%; flex:0 0 auto; }'
      + '#icw-panel .icw-check{ display:flex; gap:6px; align-items:center; font-size:12px; }'
      + '#icw-panel details.icw-more{ margin:6px 0 0; border:none; }'
      + '#icw-panel details.icw-more summary{ background:none; padding:2px 0; font-size:12px; font-weight:600; color:var(--text-accent, #185fa5); display:list-item; list-style:revert; }'
      + '@media print{ #icw-layer, #icw-panel{ display:none !important; } }';
    for (var i = 0; i < COLORS.length; i++) css += '::highlight(icw-c' + i + '){ background-color:' + COLORS[i] + '4d; }';
    var s = document.createElement('style');
    s.id = 'icwhatuc-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ══ START-UP ════════════════════════════════════════════════════════════
     Opened from a link: ask for a name (the panel opens by itself). In a
     session already (a reload, or the next lesson page in this tab): join again. */
  function boot() {
    var inv = parseInvite(location.hash), saved = session();
    if (inv) {
      try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* file pages */ }
      if (saved && saved.room === inv.room && saved.key === inv.key) { enter(saved); return; }
      invite = inv;
      openPanel(true);
      return;
    }
    if (saved && saved.room && saved.key && saved.role && saved.name) enter(saved);
  }

  global.ICwhatUC = {
    toggle: toggle,
    open: function () { openPanel(true); },
    start: start,
    join: function (link, o) { var i = parseInvite(link); if (!i) return Promise.reject(new Error('not an ICwhatUC link')); return enter({ room: i.room, key: i.key, role: 'learner', name: cleanName((o && o.name) || store(KEY.name)) || 'Learner' }); },
    leave: leave, end: end,
    peers: function () { return named().map(publicPeer); },
    link: linkNow,
    status: function () { return S.status; },
    showHighlights: showHighlights, seeOthers: seeOthers,
    key: function (el, k) { if (k != null) { el.dataset.icwKey = k; gen++; return 'k:' + k; } return keyOf(el); },
    resolve: resolveKey,
    on: function (type, fn) { (S.listeners[type] = S.listeners[type] || []).push(fn); },
    send: function (type, data) { if (S.room) S.actions.x({ t: String(type), d: data }); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
