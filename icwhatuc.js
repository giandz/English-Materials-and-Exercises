/* ══════════════════════════════════════════════════════════════════════════
   ICwhatUC — see what the others point at and select on the same lesson page.
   Loaded on demand by the loader in house.js: on the first press of 🤝, when the
   page is opened from an invitation link (#icw=…), or when this tab is already
   in a session (a new lesson page in the same tab rejoins by itself).

   What each person sees of the others: a ring round the element under their
   pointer, a live mirror of their text selection, their cursor (when they show
   it), and tags on the screen edge for anything that is off screen. My own
   highlights look the same on my page as on theirs. Nothing stays on the page:
   each message replaces that person's last one.
   Rail:  🖱️ show my cursor (starts off) · 🖍️ show my highlights (starts on) ·
          👀 see the others (starts on) · 📣 bring the others here
   Bring here: a "!" badge on my highlight (anyone), or, for the host only, the
   others' pages scroll to it. A browser notification and a tab mark reach
   someone who is on another tab.

   CONNECTING
     The host presses Start and sends one link. Anyone who opens it types a name
     and presses Join. The handshake goes through public relays by the Trystero
     library (Nostr by default), encrypted with the key after the # in the link,
     which is never sent to the web server. Highlights then go browser to browser.
     One room for the whole session: everyone knows who is on which lesson page, and
     highlights are shown only between people on the same page. The session belongs
     to the tab (sessionStorage), so the next lesson page in that tab joins again with
     no new link. When the host moves to another page, the others are offered a
     "Go there"; the host can also take everyone to the page they are on, and can
     take a person out of the session.
     An optional TURN relay, set by the host only, helps networks that cannot be
     reached directly (saved on that device, never in a link).

   ONE CONNECTION FOR THE WHOLE LESSON
     A connection belongs to a page, and a browser closes it when the page goes. So
     when a session starts (Start or Join), the tab moves to the session page,
     together.html next to house.js, which holds the connection and shows the lesson
     pages in a frame that fills the window. Moving to the next lesson changes only
     the frame: the connection stays open, nobody leaves or joins again. The lesson
     pages run this same file and borrow the session page's connection (the hub).
     Without together.html (or with <html data-icwhatuc-session-page="off">, or
     window.ICWHATUC_SESSION_PAGE = false), each lesson page connects by itself and
     joins again on the next page, as before.

   WHERE THE LIBRARY COMES FROM
     https://esm.run/trystero, or <html data-icwhatuc-lib="trystero.js">,
     or window.ICWHATUC_LIB set before house.js. A copy next to the lesson files
     removes the CDN.

   API
     ICwhatUC.toggle()              open or close the panel (the 🤝 button)
     ICwhatUC.start({ name })       host: make a room → Promise of the link
     ICwhatUC.join(link, { name })  join from a link
     ICwhatUC.leave()  ICwhatUC.end()   (end: host only, for everyone)
     ICwhatUC.everyoneHere()  ICwhatUC.remove(id)    (host only)
     ICwhatUC.peers()               [{ id, name, color, host }]
     ICwhatUC.link()                the invitation link for this page, or null
     ICwhatUC.showCursor(on)  🖱️   ICwhatUC.showHighlights(on)  🖍️   ICwhatUC.seeOthers(on)  👀
     ICwhatUC.canBring()  ICwhatUC.bring('soft' | 'hard')    (hard: host only)
     ICwhatUC.key(element[, key])   read or set an element's shared key
     ICwhatUC.on(type, fn)  ICwhatUC.send(type, data)   for later features
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ICwhatUC) return;

  var PROTOCOL = 3;
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var HERE_DIR = SCRIPT_SRC ? SCRIPT_SRC.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '';
  var APP_ID = 'icwhatuc-english-materials';
  var LIB = global.ICWHATUC_LIB || document.documentElement.getAttribute('data-icwhatuc-lib') || 'https://esm.run/trystero';
  var SESSION = 'icwhatuc-session';
  var KEY = { name: 'icwhatuc-name', cur: 'icwhatuc-show-cursor', hl: 'icwhatuc-show-highlights', see: 'icwhatuc-see-others', relay: 'icwhatuc-relay', notify: 'icwhatuc-notify' };
  var COLORS = ['#1f7ae0', '#d6336c', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599'];
  var OURS = '#icw-layer, #icw-panel, #icw-bring, #icw-toast, #icw-follow, #house-rail, #font-size-panel, .hd-card, .hd-arrow, .hd-hint';
  /* what a ring goes round: the smallest of these under the pointer */
  var RING = '.word-chip, .match-card, .match-stage .card, .hm-card, .fc-chip, .fc-zone, .fc-word, .opt, .ccq-opt, ' +
    '.eh2-word, .eh2-gap, .eh-word, .gf-gap-input, input.gap, .word-btn, .bubble, .think-cloud, .avatar, td, th, li, ' +
    '.q-card, .seq-step, .pair-line, .ccq-sentence, .ccq-row, .rule-box, .timeline-wrap, .setting-chip, [data-id], [data-icw-key], ' +
    'p, h1, h2, h3, summary, button, img';

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
  /* one room for the whole session; what belongs to one page carries that page's tag */
  var PAGE = pagePath(), PG = null;
  var PAGED = { over: 1, sel: 1, cur: 1, tap: 1, bring: 1 };
  function pageTitle() { return String(document.title || '').replace(/^\(!\) /, '').replace(/\s+/g, ' ').trim().slice(0, 80) || PAGE.split('/').pop(); }
  /* a page of this site, from a path a peer sent: never anywhere else */
  function sameSite(path) {
    try { var u = new URL(String(path), location.origin); return u.origin === location.origin && /^\/[^/]/.test(u.pathname + 'x') ? u.pathname : null; }
    catch (e) { return null; }
  }

  /* ══ THE HUB ═════════════════════════════════════════════════════════════
     Holds the Trystero room and nothing else. In a lesson page opened on its own,
     the hub lives and dies with the page. In the session page it belongs to the
     session page, and each lesson page shown in its frame borrows it: attaches when
     it opens, detaches when it goes. The hub keeps the last hello, pointed-at element
     and selection of each person, so the next page knows everyone at once.
     Trystero's interface has had three shapes; all are spoken here. joinRoom takes
     exactly two arguments. Handlers are registered by calling onX(fn), by assigning
     onX = fn, or (oldest) through the second item of makeAction's array. */
  var ACTIONS = ['hello', 'over', 'sel', 'cur', 'tap', 'bring', 'go', 'kick', 'bye', 'x'];
  var REPLAY = ['hello', 'over', 'sel'];
  function listen(room, event, handler) {
    var slot, done = false;
    try { slot = room[event]; } catch (e) { slot = undefined; }
    if (typeof slot === 'function') { try { slot.call(room, handler); done = true; } catch (e) { /* not a registrar */ } }
    try { room[event] = handler; } catch (e) { if (!done) console.warn('ICwhatUC: cannot listen for ' + event, e); }
  }
  function makeHub() {
    var H = { room: null, ident: '', selfId: null, sends: {}, peers: {}, last: {}, client: null, joins: 0, mod: null };
    function deliver(name, data, id) {
      if (REPLAY.indexOf(name) !== -1) (H.last[id] = H.last[id] || {})[name] = data;
      var c = H.client;
      if (c && c.handlers[name]) { try { c.handlers[name](data, id); } catch (e) { console.warn('ICwhatUC: a message was not understood', e); } }
    }
    H.join = async function (lib, config, roomId) {
      var ident = roomId + '|' + config.password;
      if (H.room && H.ident === ident) return H;         /* the session page is already in this room */
      if (H.room) H.leave();
      if (!H.mod) H.mod = await import(lib);
      var room = H.mod.joinRoom(config, roomId);
      H.room = room; H.ident = ident; H.joins++; H.peers = {}; H.last = {}; H.sends = {};
      H.selfId = String(H.mod.selfId || random(10));
      listen(room, 'onError', function (e) { console.warn('ICwhatUC: library problem', e); });
      listen(room, 'onJoinError', function (e) { console.warn('ICwhatUC: join problem', e); });
      ACTIONS.forEach(function (name) {
        var a = room.makeAction(name);
        var recv = function (data, meta) {
          var id = typeof meta === 'string' ? meta : (meta && meta.peerId);
          if (id && H.room === room && data && typeof data === 'object') deliver(name, data, String(id));
        };
        if (Array.isArray(a)) { a[1](recv); H.sends[name] = function (d) { return a[0](d); }; return; }
        var slot;
        try { slot = a.onMessage; } catch (e) { slot = undefined; }
        if (typeof slot === 'function') slot.call(a, recv); else a.onMessage = recv;
        H.sends[name] = function (d) { return a.send(d); };
      });
      listen(room, 'onPeerJoin', function (id) {
        id = String(id); H.peers[id] = true;
        var c = H.client; if (c) { try { c.join(id); } catch (e) { /* a page that is going */ } }
      });
      listen(room, 'onPeerLeave', function (id) {
        id = String(id); delete H.peers[id]; delete H.last[id];
        var c = H.client; if (c) { try { c.leave(id); } catch (e) { /* a page that is going */ } }
      });
      return H;
    };
    H.send = function (name, d) { if (H.room && H.sends[name]) { try { return H.sends[name](d); } catch (e) { /* the link is going */ } } };
    H.attach = function (client) {
      H.client = client;
      Object.keys(H.peers).forEach(function (id) {
        client.join(id);
        var l = H.last[id] || {};
        REPLAY.forEach(function (n) { if (l[n] && client.handlers[n]) client.handlers[n](l[n], id); });
      });
    };
    H.detach = function (client) { if (H.client === client) H.client = null; };
    H.leave = function () {
      var r = H.room;
      H.room = null; H.client = null; H.ident = ''; H.peers = {}; H.last = {};
      if (r) { try { r.leave(); } catch (e) { /* already closed */ } }
    };
    return H;
  }

  /* the session page's hub, when this lesson page is shown in its frame */
  function shellHub() {
    try {
      if (global.parent !== global && global.parent.location.origin === location.origin && global.parent.ICwhatUCHub) return global.parent.ICwhatUCHub;
    } catch (e) { /* another site's page around this one: no hub */ }
    return null;
  }
  function sessionPage() {
    var c = global.ICWHATUC_SESSION_PAGE;
    if (c === false) return null;
    var a = document.documentElement.getAttribute('data-icwhatuc-session-page');
    if (a === 'off') return null;
    var u = (typeof c === 'string' && c) || a || (HERE_DIR ? HERE_DIR + 'together.html' : '');
    if (!u) return null;
    try { var url = new URL(u, location.href); return url.origin === location.origin ? url.href.replace(/[?#].*$/, '') : null; } catch (e) { return null; }
  }
  function framePath(raw) {   /* a page of this site for the frame, with its query and #, or null */
    try { var u = new URL(String(raw || ''), location.origin); return u.origin === location.origin ? u.pathname + u.search + u.hash : null; }
    catch (e) { return null; }
  }

  /* ══ THE SESSION PAGE (together.html) ════════════════════════════════════
     A frame that fills the window, and the hub. It mirrors the lesson's title, icon
     and address, so the tab reads as the lesson. Without a session it opens the
     lesson by itself. */
  function shell() {
    var hub = global.ICwhatUCHub = makeHub();
    var q = new URLSearchParams(location.search), path = framePath(q.get('p')) || '/';
    var frame = document.getElementById('icw-frame');
    if (!session() || !frame) { location.replace(path); return; }
    function note(text) {
      var n = document.getElementById('icw-shell-note');
      if (!text) { if (n) n.hidden = true; return; }
      if (!n) {
        n = document.createElement('div'); n.id = 'icw-shell-note';
        n.innerHTML = '<span></span><button type="button">Go back</button>';
        n.querySelector('button').addEventListener('click', function () { history.back(); });
        document.body.appendChild(n);
      }
      n.firstChild.textContent = text; n.hidden = false;
    }
    var mo = null;
    frame.addEventListener('load', function () {
      var w = frame.contentWindow, d = null, loc = null;
      try { d = frame.contentDocument; loc = w.location; if (loc.origin !== location.origin) d = null; } catch (e) { d = null; }
      if (mo) { mo.disconnect(); mo = null; }
      if (!d) { note('This page is not one of the lessons, so it cannot open here.'); return; }
      note(null);
      if (!session()) { location.replace(loc.pathname + loc.search + loc.hash); return; }   /* the session ended while that page loaded */
      try { history.replaceState(null, '', location.pathname + '?p=' + encodeURIComponent(loc.pathname + loc.search + loc.hash)); } catch (e) { /* fine */ }
      var mirror = function () {
        if (document.title !== d.title) document.title = d.title;
        var src = d.querySelector('link[rel~="icon"]'), mine = document.querySelector('link[rel~="icon"]');
        if (src) {
          if (!mine) { mine = document.createElement('link'); mine.rel = 'icon'; document.head.appendChild(mine); }
          if (mine.href !== src.href) mine.href = src.href;
        }
      };
      mirror();
      mo = new MutationObserver(mirror);
      mo.observe(d.head, { subtree: true, childList: true, characterData: true, attributes: true });
      try { w.focus(); } catch (e) { /* the browser decides */ }
    });
    frame.src = path;
  }
  global.ICwhatUCMakeHub = makeHub;
  if (global.ICWHATUC_SHELL) { shell(); return; }

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
    /* house.js stamps these: a word chip's item and place in the correct order; error-hunt items, words and gaps */
    wk: ['.word-chip[data-wo]', function (el) { return [scope(el), el.dataset.wo]; }],
    eh: ['[data-eh]', function (el) { return [scope(el), el.dataset.eh]; }],
    /* an older house.js: the chip's word, and which of the same word it is (two of one word can swap) */
    wc: ['.word-chip[data-word]', function (el) {
      var item = el.closest('.wo-item'), same = item ? [].filter.call(item.querySelectorAll('.word-chip'), function (c) { return c.dataset.word === el.dataset.word; }) : [el];
      return [item ? scope(item) + '.' + item.dataset.idx : scope(el), el.dataset.word, same.indexOf(el)];
    }],
    /* a page's own engine: cards built from data usually carry data-id (and data-side) */
    d:  ['[data-id]', function (el) { return [scope(el), (el.className && typeof el.className === 'string' ? el.className.split(/\s+/)[0] : el.tagName), el.dataset.id, el.dataset.side || '']; }]
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
    peers: {}, out: {}, actions: {}, status: 'idle', note: '', listeners: {},
    mine: { over: null, sel: null, selJson: 'null', lastOver: null, lastSel: null, lastSelAt: 0, bring: null }
  };
  var prefs = {
    cur: store(KEY.cur) === true,
    hl: store(KEY.hl) !== false,
    see: store(KEY.see) !== false
  };

  function peer(id) {
    if (!S.peers[id]) S.peers[id] = { id: id, name: '', host: false, color: COLORS[0], over: null, sel: null, cur: null, bring: null, dirty: true, gen: -1, overEl: null, ranges: [], blocks: [], rate: { t: 0, n: 0 } };
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

  /* ══ CONNECTING ══════════════════════════════════════════════════════════
     Through the hub: the session page's, when this page is in its frame, or one of
     this page's own. */
  var HUB = shellHub(), localHub = null;
  function makeAction(name, handler) {
    var paged = !!PAGED[name], hub = S.hub;
    S.client.handlers[name] = function (data, id) {
      if (!id || !S.room || S.out[id]) return;
      if (paged && data.pg !== PG) {                     /* from someone on another page */
        if (name === 'bring') receive(name, data, id, farBring);
        return;
      }
      receive(name, data, id, handler);
    };
    return function (d) { if (paged && d) d.pg = PG; return hub.send(name, d); };
  }
  /* people the host took out: kept for this tab, so the next page knows them too */
  function loadOut() { try { return JSON.parse(sessionStorage.getItem('icwhatuc-out') || '{}') || {}; } catch (e) { return {}; } }
  function saveOut() { try { sessionStorage.setItem('icwhatuc-out', JSON.stringify(S.out || {})); } catch (e) { /* fine */ } }
  /* on another tab or window? (in the session page's frame, the session page decides) */
  function away() {
    if (document.hidden) return true;
    try { return !global.top.document.hasFocus(); } catch (e) { return !document.hasFocus(); }
  }
  /* Start and Join move the tab to the session page, when there is one */
  function toShell(sess) {
    var page = sessionPage();
    if (!page || HUB || !global.fetch) return Promise.resolve(false);
    return fetch(page, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      if (!r.ok) return false;
      sess.fresh = true; session(sess);
      location.replace(page + '?p=' + encodeURIComponent(location.pathname + location.search));
      return true;
    }, function () { return false; });
  }
  /* the session is over for me: back to the plain lesson page, with a line to say why */
  function unwrap(status, note) {
    if (!HUB) return false;
    try { sessionStorage.setItem('icwhatuc-note', JSON.stringify({ status: status || 'idle', note: note || '' })); } catch (e) { /* fine */ }
    try { global.top.location.replace(location.href.split('#')[0]); return true; } catch (e) { return false; }
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

  async function enter(sess, o) {
    if (S.room) quietLeave();
    S.sess = sess; S.role = sess.role; S.name = sess.name;
    session(sess);
    setStatus('connecting');
    if (o && o.fresh && await toShell(sess)) return;     /* the tab is moving to the session page */
    var hub = HUB || localHub || (localHub = makeHub());
    var config = { appId: APP_ID, password: sess.key }, turn = relayFor(sess.role);
    if (turn) config.turnConfig = [turn];
    PG = hash(sess.key + PAGE);
    var lib = LIB;
    try { lib = new URL(LIB, document.baseURI).href; } catch (e) { /* as it is */ }
    try { await hub.join(lib, config, sess.room); }
    catch (e) { console.warn('ICwhatUC: could not connect', e); setStatus('error', 'We cannot connect now. Check the internet and try again.'); return; }
    if (S.sess !== sess) return;                           /* left while connecting */
    S.hub = hub; S.room = hub;
    S.self = hub.selfId;
    S.joinedAt = Date.now();
    S.peers = {}; S.out = loadOut();
    S.client = { handlers: {}, join: function (id) { peer(id); sayHello(); renderPanel(); }, leave: function (id) { gone(id); } };

    S.actions.hello = makeAction('hello', function (d, p) {
      var fresh = !p.name, wasHere = here(p);
      p.name = cleanName(d.name) || 'Partner'; p.host = d.host === true; p.v = +d.v || 0;
      p.pg = typeof d.pg === 'string' ? d.pg.slice(0, 16) : '';
      p.title = cleanName(String(d.title || '').slice(0, 80)) ? String(d.title).replace(/[\u0000-\u001f]/g, '').slice(0, 80) : 'another page';
      p.path = sameSite(d.path);
      if (p.host && Array.isArray(d.out)) d.out.slice(0, 50).forEach(function (id) {
        if (typeof id !== 'string') return;
        if (id === S.self) removed(p.name); else { S.out[id] = true; saveOut(); if (S.peers[id]) gone(id, true); }
      });
      if (!S.room) return;
      if (!here(p)) { p.over = null; p.sel = null; p.cur = null; p.bring = null; p.dirty = true; }
      assignColors(); renderPanel(); kick();
      if (p.host && S.role !== 'host') hostIs(p, fresh || wasHere);
      if (fresh) emit('join', publicPeer(p));
    });
    S.actions.over = makeAction('over', function (d, p) {
      var k = typeof d.k === 'string' && d.k.length <= 600 ? d.k : null;
      if (k !== p.over) { p.over = k; p.dirty = true; kick(); }
    });
    S.actions.sel = makeAction('sel', function (d, p) {
      p.sel = Array.isArray(d.p) ? cleanPieces(d.p) : null; p.dirty = true; kick();
    });
    S.actions.cur = makeAction('cur', function (d, p) {
      if (typeof d.k !== 'string' || d.k.length > 600 || !isFinite(d.x) || !isFinite(d.y)) p.cur = null;
      else p.cur = { k: d.k, x: Math.max(-5, Math.min(6, +d.x)), y: Math.max(-5, Math.min(6, +d.y)), d: d.d === true, t: Date.now(), gen: -1, el: p.cur && p.cur.k === d.k ? p.cur.el : null };
      kick();
    });
    S.actions.tap = makeAction('tap', function (d, p) {
      if (typeof d.k === 'string' && d.k.length <= 600 && isFinite(d.x) && isFinite(d.y)) ripple(p, d);
    });
    S.actions.bring = makeAction('bring', function (d, p) { if (p.name) received(p, d); });
    S.actions.go = makeAction('go', function (d, p) { if (p.host && S.role !== 'host') takenTo(p, d); });
    S.actions.kick = makeAction('kick', function (d, p) {
      if (!p.host || typeof d.id !== 'string') return;
      if (d.id === S.self) removed(p.name); else { S.out[d.id] = true; saveOut(); gone(d.id, true); }
    });
    S.actions.bye = makeAction('bye', function (d, p) {
      if (d.end && p.host) { ended(p.name); return; }
      gone(p.id);
    });
    S.actions.x = makeAction('x', function (d, p) {
      var fns = S.listeners[String(d.t)];
      if (fns) fns.forEach(function (fn) { try { fn(d.d, publicPeer(p)); } catch (e) { console.warn(e); } });
    });
    hub.attach(S.client);                                  /* the people already here, and what they show */

    assignColors();
    setStatus('room');
    rail(true);
    sayHello();
    kick();
    if (sess.fresh) { delete sess.fresh; session(sess); openPanel(true); }
    setTimeout(function () { if (S.room && S.sess === sess && !named().length) renderPanel(); }, 30000);
  }
  function emit(type, data) { (S.listeners[type] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.warn(e); } }); }
  function named() { return Object.keys(S.peers).filter(function (id) { return S.peers[id].name && !S.out[id]; }).map(function (id) { return S.peers[id]; }); }
  function here(p) { return !!p && !!p.name && p.pg === PG; }
  function hereNow() { return named().filter(here); }
  function publicPeer(p) { return { id: p.id, name: p.name, color: p.color, host: p.host }; }

  /* everything I show, to everyone: a newcomer gets it this way */
  function sayHello() {
    if (!S.room) return;
    var hello = { v: PROTOCOL, name: S.name, host: S.role === 'host', pg: PG, path: location.pathname, title: pageTitle() };
    if (S.role === 'host') hello.out = Object.keys(S.out || {}).slice(0, 50);
    S.actions.hello(hello);
    S.actions.over({ k: prefs.hl ? S.mine.over : null });
    S.actions.sel({ p: prefs.hl ? S.mine.sel : null });
  }
  function gone(id, quiet) {
    var p = S.peers[id];
    if (!p) return;
    delete S.peers[id];
    if (p.name && !quiet) { S.note = p.name + (here(p) ? ' left this page.' : ' left.'); emit('leave', publicPeer(p)); }
    assignColors(); renderPanel(); clearPeerDrawing(id); kick();
  }
  function quietLeave() {
    var hub = S.hub;
    S.room = null; S.hub = null;
    if (hub) {
      try { if (S.actions.bye) S.actions.bye({}); } catch (e) { /* already closed */ }
      hub.detach(S.client); hub.leave();
    }
    Object.keys(S.peers).forEach(clearPeerDrawing);
    S.peers = {}; S.actions = {};
    clearDrawing(); markTab(false); cur.on = false; follow(null);
    S.mine.bring = null;
  }
  function leave() {
    quietLeave();
    session(null); S.sess = null; S.note = ''; S.out = {}; saveOut();
    if (unwrap('idle', '')) return;
    rail(false); setStatus('idle');
  }
  function end() {
    if (S.role !== 'host' || !S.room) return leave();
    session(null);                           /* at once: a page opened next must not rejoin */
    try { S.actions.bye({ end: true }); } catch (e) { /* closed */ }
    setTimeout(leave, 150);
  }
  function ended(by) {
    quietLeave(); session(null); S.sess = null; S.out = {}; saveOut();
    var said = by ? by + ' ended the session.' : 'The session is over.';
    if (unwrap('ended', said)) return;
    rail(false); setStatus('ended', said);
    openPanel(true);
  }
  /* ══ GROUPS ══════════════════════════════════════════════════════════════
     Everyone in the session is in one room, whatever page they are on. */
  var hostWas = null;          /* the page I last told the learner about */
  function hostIs(p, news) {
    if (here(p)) { hostWas = null; follow(null); return; }
    if (!news && hostWas === p.pg) return;
    hostWas = p.pg;
    follow({ text: p.name + ' is on “' + p.title + '”.', path: p.path, go: 'Go there' });
    if (away()) { markTab(true); osNotify(p, p.name + ' is on another page', p.title); }
  }
  /* the host takes everyone to their page: a few seconds to say "Stay here" */
  var goTimer = 0;
  function takenTo(p, d) {
    var path = sameSite(d.path);
    if (!path || d.pg === PG) return;
    var title = String(d.title || '').replace(/[\u0000-\u001f]/g, '').slice(0, 80) || 'another page';
    var left = 3;
    follow({ text: p.name + ' is taking you to “' + title + '”… ' + left, path: path, go: 'Go now', stay: true });
    if (away()) { markTab(true); osNotify(p, p.name + ' is taking you to another page', title); }
    clearInterval(goTimer);
    goTimer = setInterval(function () {
      var box = $('icw-follow');
      if (!box || box.hidden) { clearInterval(goTimer); return; }
      if (--left <= 0) { clearInterval(goTimer); go(path); return; }
      box.querySelector('.icw-ftext').textContent = p.name + ' is taking you to “' + title + '”… ' + left;
    }, 1000);
  }
  /* a call from someone on another page */
  function farBring(d, p) {
    if (!p.name || !p.path) return;
    var now = Date.now();
    if (p.lastBring && now - p.lastBring < 2500) return;
    p.lastBring = now;
    follow({ text: p.name + ' calls you to “' + p.title + '”.', path: p.path, go: 'Go there' });
    if (away()) { markTab(true); osNotify(p); }
  }
  function go(path) { clearInterval(goTimer); if (sameSite(path)) location.href = sameSite(path); }
  /* the line at the bottom that offers to go to another page */
  function follow(o) {
    var box = $('icw-follow');
    if (!o) { if (box) box.hidden = true; clearInterval(goTimer); return; }
    injectStyles();
    if (!box) {
      box = document.createElement('div'); box.id = 'icw-follow'; box.setAttribute('role', 'status');
      box.innerHTML = '<span class="icw-ftext"></span><button type="button" class="icw-fgo"></button><button type="button" class="icw-fstay"></button>';
      box.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.target.closest('.icw-fgo')) go(box.dataset.path);
        else if (e.target.closest('.icw-fstay')) { follow(null); }
      });
      document.body.appendChild(box);
    }
    box.querySelector('.icw-ftext').textContent = o.text;
    var g = box.querySelector('.icw-fgo'), st = box.querySelector('.icw-fstay');
    g.textContent = o.go; g.hidden = !o.path;
    st.textContent = o.stay ? 'Stay here' : '✕'; st.setAttribute('aria-label', o.stay ? 'Stay here' : 'Close');
    box.dataset.path = o.path || '';
    box.hidden = false;
  }
  function everyoneHere() {
    if (S.role !== 'host' || !S.room) return false;
    S.actions.go({ pg: PG, path: location.pathname, title: pageTitle() });
    var away = named().filter(function (p) { return !here(p); }).length;
    toast(away ? 'Everyone comes to this page now.' : 'Everyone is on this page already.');
    return true;
  }
  function remove(id) {
    if (S.role !== 'host' || !S.room || !S.peers[id]) return false;
    var name = S.peers[id].name;
    S.out[id] = true; saveOut();
    S.actions.kick({ id: id });
    gone(id, true);
    S.note = name + ' is out of the session. To keep them out for good, end the session and start a new link.';
    renderPanel();
    return true;
  }
  function removed(by) {
    quietLeave(); session(null); S.sess = null; S.out = {}; saveOut();
    var said = (by || 'The host') + ' took you out of the session.';
    if (unwrap('ended', said)) return;
    rail(false); setStatus('ended', said);
    openPanel(true);
  }

  global.addEventListener('pagehide', function () {
    if (!S.room) return;
    if (HUB) { HUB.detach(S.client); return; }             /* the session page keeps the connection open */
    try { S.actions.bye({}); } catch (e) { /* closing */ }
    try { S.hub.leave(); } catch (e) { /* closing */ }
  });
  /* in the session page's frame, a link to another site opens in a new tab, so the session stays */
  if (HUB) document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target) return;
    try { if (new URL(a.href, location.href).origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener'; } } catch (err) { /* not a link */ }
  }, true);

  /* ══ WHAT I SEND ═════════════════════════════════════════════════════════
     My pointed-at element and my selection are worked out whenever I am in a
     session (so "Bring here" knows them) but sent only while 🖍️ is on. My cursor
     is sent only while 🖱️ is on. */
  function ringTarget(t) {
    if (!t || t.nodeType !== 1 || ours(t)) return null;
    var el = t.closest(RING);
    return el && el !== document.body ? el : null;
  }
  function sendOver(el) {
    var k = el ? keyOf(el) : null;
    S.mine.over = k;
    S.mine.overEl = el;
    if (k) { S.mine.lastOver = k; S.mine.lastOverEl = el; }
    if (S.room && prefs.hl && !document.hidden) S.actions.over({ k: k });
    kick();
  }
  var overQueued = null, overRaf = 0, tapTimer = 0;
  var cur = { last: 0, timer: 0, ev: null, down: false, on: false };
  function curAnchor(t) {
    if (!t || t.nodeType !== 1 || ours(t)) return null;
    return t.closest(RING) || t.closest('div, section, main, article, form, table, ul, ol') || document.body;
  }
  function curPoint(e) {
    var el = curAnchor(e.target);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { k: keyOf(el), x: +((e.clientX - r.left) / (r.width || 1)).toFixed(4), y: +((e.clientY - r.top) / (r.height || 1)).toFixed(4) };
  }
  function sendCur(e) {
    cur.timer = 0; cur.last = Date.now();
    if (!S.room || !prefs.cur || document.hidden) return;
    var pt = curPoint(e);
    if (!pt) { curOff(); return; }
    pt.d = cur.down;
    S.actions.cur(pt); cur.on = true;
  }
  function curOff() { if (cur.on && S.room) S.actions.cur({ k: null }); cur.on = false; }
  document.addEventListener('pointermove', function (e) {
    if (!S.room || e.pointerType === 'touch') return;
    overQueued = e.target;
    if (!overRaf) overRaf = requestAnimationFrame(function () {
      overRaf = 0;
      var el = ringTarget(overQueued);
      if (el !== S.mine.overEl) sendOver(el);
    });
    if (prefs.cur) {                                   /* at most 20 a second, and the last one always */
      var ev = { target: e.target, clientX: e.clientX, clientY: e.clientY };
      var wait = 50 - (Date.now() - cur.last);
      if (wait <= 0) sendCur(ev);
      else { cur.ev = ev; if (!cur.timer) cur.timer = setTimeout(function () { sendCur(cur.ev); }, wait); }
    }
  }, { capture: true, passive: true });
  document.addEventListener('pointerout', function (e) {
    if (!S.room || e.relatedTarget || e.pointerType === 'touch') return;
    sendOver(null); curOff();
  }, true);
  document.addEventListener('pointerdown', function (e) {
    if (!S.room) return;
    if (e.pointerType === 'touch') {
      /* a touch screen has no resting pointer: a tap rings the tapped element for two seconds,
         and with 🖱️ on it sends a ripple at that spot */
      var el = ringTarget(e.target);
      if (el) {
        clearTimeout(tapTimer);
        sendOver(el);
        tapTimer = setTimeout(function () { if (S.mine.overEl === el) sendOver(null); }, 2000);
      }
      if (prefs.cur) { var pt = curPoint(e); if (pt) S.actions.tap(pt); }
      return;
    }
    cur.down = true;
    if (prefs.cur) sendCur(e);
  }, true);
  document.addEventListener('pointerup', function (e) {
    if (!S.room || e.pointerType === 'touch') return;
    cur.down = false;
    if (prefs.cur) sendCur(e);
  }, true);

  var selTimer = 0, selfVer = 0;
  document.addEventListener('selectionchange', function () {
    if (!S.room) return;
    selfVer++; kick();                                 /* my own tint follows at once */
    clearTimeout(selTimer);
    selTimer = setTimeout(sendSel, 120);
  });
  function sendSel() {
    var p = null;
    try { p = selectionPieces(); } catch (e) { p = null; }
    var j = JSON.stringify(p);
    if (j === S.mine.selJson) return;
    if (!p && S.mine.sel) { S.mine.lastSel = S.mine.sel; S.mine.lastSelAt = Date.now(); }
    S.mine.sel = p; S.mine.selJson = j;
    if (S.room && prefs.hl) S.actions.sel({ p: p });
  }
  document.addEventListener('visibilitychange', function () {
    if (!S.room) return;
    if (document.hidden) { if (prefs.hl) S.actions.over({ k: null }); curOff(); }
    else { if (prefs.hl) S.actions.over({ k: S.mine.over }); markTab(false); }
  });
  global.addEventListener('focus', function () { markTab(false); });

  /* ══ BRING HERE ══════════════════════════════════════════════════════════
     Calls the others to my highlight: my text selection, or failing that the last
     element I pointed at (the pointer has usually moved to the button by then).
       soft  everyone   a "!" badge on my highlight on their page, next to the edge tag if
                        it is off their screen; nothing moves
       hard  host only  their page scrolls to my highlight, which gets the "!" badge
     Someone on another tab or window gets a browser notification (if they said yes)
     and "(!)" in the tab title with a dot on its icon. */
  var lastBring = 0;
  function bringTarget() {
    var sel = S.mine.sel || (S.mine.lastSel && Date.now() - S.mine.lastSelAt < 2500 ? S.mine.lastSel : null);
    if (sel) return { sel: sel, k: null };
    if (S.mine.lastOver && S.mine.lastOverEl && S.mine.lastOverEl.isConnected) return { sel: null, k: S.mine.lastOver };
    return null;
  }
  function canBring() { return !!(S.room && bringTarget()); }
  function bring(mode) {
    if (!S.room) return false;
    var t = bringTarget();
    if (!t) { toast('First, select some words or point at something.'); return false; }
    if (Date.now() - lastBring < 3000) { toast('Wait a moment, then try again.'); return false; }
    lastBring = Date.now();
    mode = mode === 'hard' && S.role === 'host' ? 'hard' : 'soft';
    S.actions.bring({ m: mode, sel: t.sel, k: t.k });
    S.mine.bring = { sel: t.sel, k: t.k, until: Date.now() + 5000, gen: -1 };
    if (!hereNow().length) toast(named().length ? 'The others are on another page. They get a “Go there”.' : 'Nobody is here to call yet.');
    else toast(mode === 'hard' ? 'Their page moves here now.' : 'They see a ! here now.');
    kick();
    return true;
  }
  function received(p, d) {
    var now = Date.now();
    if (p.lastBring && now - p.lastBring < 2500) return;        /* one every few seconds */
    p.lastBring = now;
    var sel = Array.isArray(d.sel) ? cleanPieces(d.sel) : null;
    var k = typeof d.k === 'string' && d.k.length <= 600 ? d.k : null;
    if (!sel && !k) return;
    var hard = d.m === 'hard' && p.host;                        /* only the host can move my page */
    p.bring = { hard: hard, sel: sel, k: k, t: now, seen: 0, last: now, gen: -1 };
    resolveBring(p.bring);
    if (hard) {
      var where = bringFocusNode(p.bring);
      if (where) { where.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast(p.name + ' brought you here.'); }
      else toast(p.name + ' called you, but it is not on your page.');
    }
    if (away()) { markTab(true); osNotify(p); }
    emit('bring', { from: publicPeer(p), hard: hard });
    kick();
  }
  function cleanPieces(list) {
    list = list.slice(0, 12).filter(function (x) {
      return x && typeof x.k === 'string' && x.k.length <= 600 && typeof x.w === 'string' && x.w && x.w.length <= 1000 && x.n >= 0 && x.n < 1000;
    });
    return list.length ? list : null;
  }
  function resolveBring(b) {
    if (!b || b.gen === gen) return;
    b.el = b.k ? resolveKey(b.k) : null;
    b.ranges = []; b.block = null;
    (b.sel || []).forEach(function (piece) {
      var block = resolveKey(piece.k);
      if (!block) return;
      var r = rangeForPiece(block, piece);
      if (r) b.ranges.push(r); else if (!b.block) b.block = block;
    });
    b.gen = gen;
    hlSig = '';
  }
  function bringFocusNode(b) {
    var n = b.ranges && b.ranges[0] ? b.ranges[0].startContainer : (b.el || b.block);
    return n && n.nodeType !== 1 ? n.parentElement : n;
  }

  /* the tab's own mark, when the person is on another tab or window */
  var tabMark = null;
  function markTab(on) {
    if (on && !tabMark) {
      tabMark = { link: document.querySelector('link[rel~="icon"]'), href: null, made: false };
      if (!/^\(!\) /.test(document.title)) document.title = '(!) ' + document.title;
      var link = tabMark.link;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); tabMark.link = link; tabMark.made = true; }
      else tabMark.href = link.href;
      var c = document.createElement('canvas'); c.width = c.height = 32;
      var g = c.getContext('2d'), dot = function () {
        g.beginPath(); g.arc(23, 9, 8, 0, Math.PI * 2); g.fillStyle = '#e03131'; g.fill();
        g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
        try { if (tabMark) link.href = c.toDataURL('image/png'); } catch (e) { /* a tainted icon: keep the title mark */ }
      };
      if (tabMark.href) { var img = new Image(); img.onload = function () { g.drawImage(img, 0, 0, 32, 32); dot(); }; img.onerror = dot; img.src = tabMark.href; }
      else dot();
    } else if (!on && tabMark) {
      document.title = document.title.replace(/^\(!\) /, '');
      if (tabMark.made) tabMark.link.remove(); else if (tabMark.href) tabMark.link.href = tabMark.href;
      tabMark = null;
    }
  }
  function notifyOk() { return 'Notification' in global && global.isSecureContext !== false; }
  function osNotify(p, text, body) {
    if (!notifyOk() || store(KEY.notify) !== 'yes' || Notification.permission !== 'granted') return;
    try {
      var n = new Notification(text || p.name + ': come here!', { body: body || document.title.replace(/^\(!\) /, ''), tag: 'icwhatuc-bring', renotify: true });
      n.onclick = function () { try { global.focus(); } catch (e) { /* the browser decides */ } n.close(); markTab(false); goTo(p.id); };
    } catch (e) { /* some phones only allow notifications from a service worker: the tab mark is still there */ }
  }
  function askNotify(yes) {
    if (!yes || !notifyOk()) { store(KEY.notify, 'no'); renderPanel(); return; }
    var done = function (r) { store(KEY.notify, r === 'granted' ? 'yes' : 'no'); renderPanel(); };
    try { var pr = Notification.requestPermission(done); if (pr && pr.then) pr.then(done, function () { done('denied'); }); }
    catch (e) { done('denied'); }
  }

  /* a short line at the bottom of the screen */
  var toastTimer = 0;
  function toast(text) {
    injectStyles();
    var t = $('icw-toast');
    if (!t) { t = document.createElement('div'); t.id = 'icw-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ══ WHAT I SEE ══════════════════════════════════════════════════════════
     One fixed layer that ignores the pointer, under the rail and the dictionary
     card. Selections are painted with the CSS Custom Highlight API, so the page's
     own markup is never touched; browsers without it get boxes in the layer.
     My own highlights are drawn the same way, in my colour and with my name, while
     🖍️ is on: I see them as the others see them. */
  var layer = null, edgeTop = null, edgeBottom = null, raf = 0, hasHL = !!(global.CSS && CSS.highlights && global.Highlight);
  var drawn = {};            /* id → the elements drawn for that person */
  var hlSig = '';
  var ARROW = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 2 L3 16.5 L7 12.8 L9.8 18.6 L12.4 17.4 L9.7 11.8 L15 11.6 Z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';

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
  function el(cls, tag) { var e = document.createElement(tag || 'div'); e.className = cls; e.hidden = true; layer.appendChild(e); return e; }
  function parts(id) {
    if (drawn[id]) return drawn[id];
    ensureLayer();
    var d = { boxes: [] };
    d.ring = el('icw-ring'); d.tag = el('icw-name'); d.selTag = el('icw-name icw-selname');
    d.bring = el('icw-ring icw-bringring'); d.badge = el('icw-badge'); d.badge.textContent = '!';
    d.cur = el('icw-cursor'); d.cur.innerHTML = ARROW + '<span class="icw-curname"></span>';
    d.edge = document.createElement('button'); d.edge.type = 'button'; d.edge.className = 'icw-edge'; d.edge.tabIndex = -1;
    d.edge.addEventListener('click', function (e) { e.stopPropagation(); goTo(id); });
    return (drawn[id] = d);
  }
  function clearPeerDrawing(id) {
    var d = drawn[id];
    if (!d) return;
    [d.ring, d.tag, d.selTag, d.bring, d.badge, d.cur, d.edge].concat(d.boxes).forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    delete drawn[id];
  }
  function clearDrawing() {
    Object.keys(drawn).forEach(clearPeerDrawing);
    if (hasHL) for (var i = 0; i < COLORS.length; i++) try { CSS.highlights.delete('icw-c' + i); } catch (e) { /* gone */ }
    hlSig = '';
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function resolvePeer(p) {
    if (p.bring) resolveBring(p.bring);
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
    hlSig = '';
  }
  var selfCache = { ver: -1, ranges: [] };
  function selfRanges() {
    if (selfCache.ver === selfVer) return selfCache.ranges;
    var s = global.getSelection && global.getSelection(), out = [];
    if (s && !s.isCollapsed && s.rangeCount) {
      var r = s.getRangeAt(0), root = r.commonAncestorContainer;
      if (root.nodeType !== 1) root = root.parentElement;
      if (root && !ours(root) && !root.closest('input, textarea')) out.push(r.cloneRange());
    }
    selfCache = { ver: selfVer, ranges: out };
    hlSig = '';
    return out;
  }
  function paintSelections(views) {
    if (!hasHL) return;
    var sigNow = views.map(function (v) { return v.id + v.color + v.sig; }).join('|');
    if (sigNow === hlSig) return;
    hlSig = sigNow;
    var byColor = {};
    views.forEach(function (v) {
      var list = v.ranges.concat(v.bringRanges || []);
      if (list.length) { var c = COLORS.indexOf(v.color); (byColor[c] = byColor[c] || []).push.apply(byColor[c], list); }
    });
    for (var i = 0; i < COLORS.length; i++) {
      try { if (byColor[i]) CSS.highlights.set('icw-c' + i, new Highlight(...byColor[i])); else CSS.highlights.delete('icw-c' + i); } catch (e) { /* no highlights */ }
    }
  }
  function place(node, r, pad) {
    node.style.transform = 'translate(' + Math.round(r.left - pad) + 'px,' + Math.round(r.top - pad) + 'px)';
    node.style.width = Math.round(r.width + pad * 2) + 'px';
    node.style.height = Math.round(r.height + pad * 2) + 'px';
  }
  function placeName(tag, r, name, color) {
    if (tag.textContent !== name) tag.textContent = name;
    tag.style.background = color;
    var y = r.top - 19 < 2 ? r.bottom + 3 : r.top - 19;
    tag.style.transform = 'translate(' + Math.round(Math.max(2, r.left - 3)) + 'px,' + Math.round(y) + 'px)';
    tag.hidden = false;
  }
  function shown(r) { return !!(r && (r.width || r.height)); }
  function firstRect(ranges) {
    for (var i = 0; i < ranges.length; i++) { var rs = ranges[i].getClientRects(); for (var j = 0; j < rs.length; j++) if (rs[j].width) return rs[j]; }
    return null;
  }
  function rectsOf(ranges) {
    var out = [];
    ranges.forEach(function (r) { [].forEach.call(r.getClientRects(), function (x) { if (x.width) out.push(x); }); });
    return out;
  }

  /* one person's view: what to draw, wherever it comes from */
  function peerView(p, now) {
    var b = p.bring, v = { id: p.id, name: p.name, color: p.color, ringEl: p.overEl || p.blocks[0] || null, ranges: p.ranges, bringRanges: [], badge: false, cur: null };
    if (b) { v.bringEl = b.el || b.block; v.bringRanges = b.ranges || []; v.badge = true; }
    v.sig = p.gen + ':' + p.ranges.length + ':' + (b ? b.t + ':' + b.gen : '');
    if (p.cur && p.cur.k) {
      var age = now - p.cur.t;
      if (age < 5000) {
        if (p.cur.gen !== gen || !p.cur.el || !p.cur.el.isConnected) { p.cur.el = resolveKey(p.cur.k); p.cur.gen = gen; }
        if (p.cur.el) { var r = p.cur.el.getBoundingClientRect(); v.cur = { x: r.left + p.cur.x * r.width, y: r.top + p.cur.y * r.height, down: p.cur.d, fade: age > 4000 ? 1 - (age - 4000) / 1000 : 1 }; }
      }
    }
    return v;
  }
  function selfView(now) {
    var mb = S.mine.bring && now < S.mine.bring.until ? S.mine.bring : null;
    if (mb) resolveBring(mb);
    var ranges = selfRanges();
    return {
      id: 'me', name: S.name, color: S.color || COLORS[0], ringEl: S.mine.overEl && S.mine.overEl.isConnected ? S.mine.overEl : null, ranges: ranges,
      bringEl: mb ? (mb.el || mb.block) : null, bringRanges: mb && !ranges.length ? mb.ranges : [], badge: !!mb, cur: null,
      sig: 'v' + selfVer + (mb ? 'b' + mb.until + ':' + mb.gen : '')
    };
  }

  /* draw one view; → the edge tag it needs, if its focus is off screen */
  function drawView(v, now, vh, edges) {
    var d = parts(v.id);
    var ringR = v.ringEl && v.ringEl.isConnected ? v.ringEl.getBoundingClientRect() : null;
    if (shown(ringR)) { d.ring.hidden = false; d.ring.style.borderColor = v.color; place(d.ring, ringR, 3); placeName(d.tag, ringR, v.name, v.color); }
    else { d.ring.hidden = true; d.tag.hidden = true; }

    var selR = firstRect(v.ranges);
    if (!hasHL) {                                   /* boxes instead of the highlight */
      var rects = rectsOf(v.ranges.concat(v.bringRanges || []));
      while (d.boxes.length < Math.min(rects.length, 40)) d.boxes.push(el('icw-box'));
      d.boxes.forEach(function (b, i) { if (i < rects.length) { b.hidden = false; b.style.background = v.color; place(b, rects[i], 0); } else b.hidden = true; });
    }
    if (selR && !(shown(ringR) && Math.abs(ringR.top - selR.top) < 4)) placeName(d.selTag, selR, v.name, v.color);
    else d.selTag.hidden = true;

    /* a bring: its own ring if it is not already ringed, and the "!" badge */
    var bringR = null;
    if (v.badge) {
      bringR = firstRect(v.bringRanges) || (v.bringEl && v.bringEl.isConnected ? v.bringEl.getBoundingClientRect() : null) || selR || ringR;
      var sameAsRing = shown(ringR) && v.bringEl === v.ringEl;
      if (v.bringEl && shown(bringR) && !sameAsRing && !v.bringRanges.length) { d.bring.hidden = false; d.bring.style.borderColor = v.color; place(d.bring, v.bringEl.getBoundingClientRect(), 5); }
      else d.bring.hidden = true;
      if (shown(bringR)) {
        d.badge.hidden = false; d.badge.style.background = v.color;
        /* placed by left/top, not transform, so the pop below grows and shrinks round its own centre */
        d.badge.style.left = Math.round(Math.min(global.innerWidth - 24, bringR.right - 4)) + 'px';
        d.badge.style.top = Math.round(bringR.top - 14) + 'px';
      } else d.badge.hidden = true;
    } else { d.bring.hidden = true; d.badge.hidden = true; }

    /* a cursor: an arrow in the person's colour with the name, eased between positions */
    if (v.cur) {
      var c = v.cur;
      if (d.cx == null || Math.abs(c.x - d.cx) > 400 || Math.abs(c.y - d.cy) > 400) { d.cx = c.x; d.cy = c.y; }
      d.cx += (c.x - d.cx) * 0.4; d.cy += (c.y - d.cy) * 0.4;
      var off = c.y < 0 || c.y > vh;
      d.cur.hidden = off;
      if (!off) {
        d.cur.style.color = v.color;
        d.cur.style.transform = 'translate(' + Math.round(d.cx - 3) + 'px,' + Math.round(d.cy - 2) + 'px)';
        d.cur.style.opacity = String(Math.max(0, c.fade));
        var nm = d.cur.lastChild;
        if (nm.textContent !== v.name) nm.textContent = v.name;
        nm.style.background = v.color;
        if (c.down && !d.wasDown) { d.cur.classList.remove('icw-pulse'); void d.cur.offsetWidth; d.cur.classList.add('icw-pulse'); }
      }
      d.wasDown = c.down;
    } else { d.cur.hidden = true; d.cx = null; }

    if (!edges) return;
    /* off screen: a tag on the top or bottom edge, which takes me there */
    var focus = shown(bringR) ? bringR : (selR || (shown(ringR) ? ringR : null) || (v.cur ? { top: v.cur.y, bottom: v.cur.y } : null)), side = null;
    if (focus) { if (focus.bottom < (S.topClear || 0) + 6) side = 'top'; else if (focus.top > vh - 6) side = 'bottom'; }
    if (side) {
      var label = (side === 'top' ? '▲ ' : '▼ ') + v.name, sigE = label + (v.badge ? '!' : '');
      if (d.edge.dataset.sig !== sigE) {
        d.edge.textContent = label;
        if (v.badge) { var bg = document.createElement('span'); bg.className = 'icw-edgebadge'; bg.textContent = '!'; d.edge.appendChild(bg); }
        d.edge.dataset.sig = sigE;
      }
      d.edge.style.background = v.color;
      d.edge.title = 'Go to ' + v.name;
      (side === 'top' ? edges.top : edges.bottom).push(d.edge);
    } else if (d.edge.parentNode) d.edge.parentNode.removeChild(d.edge);
    return bringR;
  }

  function frame() {
    raf = 0;
    if (!S.room) { clearDrawing(); return; }
    var now = Date.now(), vh = global.innerHeight, keep = {}, views = [], edges = { top: [], bottom: [] }, busy = false;
    var clear = topClear();
    ensureLayer();
    edgeTop.style.top = (clear + 6) + 'px';
    S.topClear = clear;
    if (prefs.hl) { var me = selfView(now); drawView(me, now, vh, null); keep.me = true; views.push(me); }
    if (prefs.see) hereNow().forEach(function (p) {
      resolvePeer(p);
      var v = peerView(p, now), bringR = drawView(v, now, vh, edges);
      keep[p.id] = true; views.push(v);
      if (p.bring) {
        /* a bring stays until I have had it on my screen for a moment, or for a minute at most */
        var onScreen = shown(bringR) && bringR.bottom > 0 && bringR.top < vh && !document.hidden;
        if (onScreen) p.bring.seen += now - p.bring.last;
        p.bring.last = now;
        if (p.bring.seen > 2500 || now - p.bring.t > 60000) { p.bring = null; hlSig = ''; }
      }
      if (p.cur && now - p.cur.t < 5200) busy = true;
    });
    edges.top.forEach(function (e) { if (e.parentNode !== edgeTop) edgeTop.appendChild(e); });
    edges.bottom.forEach(function (e) { if (e.parentNode !== edgeBottom) edgeBottom.appendChild(e); });
    Object.keys(drawn).forEach(function (id) { if (!keep[id]) clearPeerDrawing(id); });
    paintSelections(views);
    raf = requestAnimationFrame(frame);       /* follows scrolling, resizing, reflow and easing */
  }
  function goTo(id) {
    var p = S.peers[id];
    if (!p) return;
    var node = p.bring ? bringFocusNode(p.bring) : null;
    if (!node) { node = p.ranges[0] ? p.ranges[0].startContainer : (p.overEl || p.blocks[0]); if (node && node.nodeType !== 1) node = node.parentElement; }
    if (!node && p.cur && p.cur.el) node = p.cur.el;
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function ripple(p, d) {
    if (!prefs.see) return;
    var target = resolveKey(d.k);
    if (!target) return;
    ensureLayer();
    var r = target.getBoundingClientRect(), x = r.left + d.x * r.width, y = r.top + d.y * r.height;
    if (y < 0 || y > global.innerHeight) return;
    var e = document.createElement('div');
    e.className = 'icw-ripple';
    e.style.borderColor = p.color;
    e.style.left = Math.round(x) + 'px'; e.style.top = Math.round(y) + 'px';
    layer.appendChild(e);
    setTimeout(function () { e.remove(); }, 800);
  }

  /* the page changed: keys and ranges are worked out again */
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i].target;
      if (!ours(t)) { gen++; if (S.room) kick(); return; }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });

  /* ══ RAIL BUTTONS ════════════════════════════════════════════════════════
     🤝 60 (from the loader) · 🖱️ 61 · 🖍️ 62 · 👀 63 · 📣 64 */
  function rail(on) {
    var R = global.HouseRail;
    document.documentElement.classList.toggle('icw-own', !!(on && prefs.hl));
    if (!R) return;
    R.set('icwhatuc-toggle', on);
    var main = $('icwhatuc-toggle');
    if (main) main.title = on ? 'Work together: on' : 'Work together';
    if (on) {
      R.add({ id: 'icwhatuc-cur', icon: '🖱️', label: 'Show my cursor', order: 61, pressed: prefs.cur, onClick: function () { showCursor(!prefs.cur); } });
      R.add({ id: 'icwhatuc-hl', icon: '🖍️', label: 'Show my highlights', order: 62, pressed: prefs.hl, onClick: function () { showHighlights(!prefs.hl); } });
      R.add({ id: 'icwhatuc-see', icon: '👀', label: 'See the others', order: 63, pressed: prefs.see, onClick: function () { seeOthers(!prefs.see); } });
      R.add({ id: 'icwhatuc-bring', icon: '📣', label: 'Bring the others here', order: 64, onClick: function () { onBringButton(); } });
      titles();
    } else { ['icwhatuc-cur', 'icwhatuc-hl', 'icwhatuc-see', 'icwhatuc-bring'].forEach(function (id) { R.remove(id); }); closeChooser(); }
  }
  function titles() {
    var t = { 'icwhatuc-cur': prefs.cur ? 'Others see my cursor: on' : 'Others see my cursor: off',
      'icwhatuc-hl': prefs.hl ? 'Others see what I point at and select: on' : 'Others see what I point at and select: off',
      'icwhatuc-see': prefs.see ? 'I see the others: on' : 'I see the others: off',
      'icwhatuc-bring': S.role === 'host' ? 'Bring the others here: show them, or take them there' : 'Bring the others here' };
    Object.keys(t).forEach(function (id) { var b = $(id); if (b) b.title = t[id]; });
  }
  function showCursor(v) {
    prefs.cur = !!v; store(KEY.cur, prefs.cur);
    if (global.HouseRail) global.HouseRail.set('icwhatuc-cur', prefs.cur);
    titles();
    if (!prefs.cur) curOff();
  }
  function showHighlights(v) {
    prefs.hl = !!v; store(KEY.hl, prefs.hl);
    if (global.HouseRail) global.HouseRail.set('icwhatuc-hl', prefs.hl);
    document.documentElement.classList.toggle('icw-own', !!(S.room && prefs.hl));
    titles(); hlSig = ''; kick();
    if (!S.room) return;
    if (prefs.hl) { S.mine.selJson = ''; sendSel(); S.actions.over({ k: S.mine.over }); }
    else { S.actions.over({ k: null }); S.actions.sel({ p: null }); }
  }
  function seeOthers(v) {
    prefs.see = !!v; store(KEY.see, prefs.see);
    if (global.HouseRail) global.HouseRail.set('icwhatuc-see', prefs.see);
    titles();
    Object.keys(S.peers).forEach(function (id) { S.peers[id].dirty = true; });
    Object.keys(drawn).forEach(function (id) { if (id !== 'me') clearPeerDrawing(id); });
    hlSig = ''; kick();
  }

  /* 📣: everyone calls with a "!"; the host chooses between that and moving the others' pages */
  var chooser = null;
  function onBringButton() {
    if (!canBring()) { toast('First, select some words or point at something.'); return; }
    if (S.role !== 'host') { bring('soft'); return; }
    if (chooser && !chooser.hidden) { closeChooser(); return; }
    injectStyles();
    if (!chooser) {
      chooser = document.createElement('div');
      chooser.id = 'icw-bring';
      chooser.setAttribute('role', 'menu');
      chooser.innerHTML = '<button type="button" role="menuitem" data-m="soft">❗ Show them</button><button type="button" role="menuitem" data-m="hard">➡️ Take them there</button>';
      chooser.addEventListener('click', function (e) {
        e.stopPropagation();
        var b = e.target.closest('[data-m]');
        if (b) { closeChooser(); bring(b.getAttribute('data-m')); }
      });
      document.body.appendChild(chooser);
      document.addEventListener('click', function (e) { if (chooser && !chooser.hidden && !chooser.contains(e.target)) closeChooser(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChooser(); });
    }
    chooser.hidden = false;
    var btn = $('icwhatuc-bring'), r = btn ? btn.getBoundingClientRect() : { left: global.innerWidth - 14, right: global.innerWidth - 14, top: 200, bottom: 238, height: 38 };
    var vw = document.documentElement.clientWidth;
    if (railAcross()) {                      /* the rail runs across the top: open below the button */
      chooser.style.right = Math.max(8, Math.min(vw - r.right, vw - chooser.offsetWidth - 8)) + 'px';
      chooser.style.top = Math.round(r.bottom + 8) + 'px';
    } else {
      chooser.style.right = Math.max(8, vw - r.left + 8) + 'px';
      chooser.style.top = Math.round(r.top + r.height / 2 - chooser.offsetHeight / 2) + 'px';
    }
  }
  function closeChooser() { if (chooser) chooser.hidden = true; }
  /* is the rail a row across the top (narrow or short screens)? → where it ends */
  function railAcross() { return !!(global.HouseRail && global.HouseRail.across && global.HouseRail.across()); }
  function topClear() {
    if (!railAcross()) return 0;
    var rail = $('house-rail');
    return rail ? Math.max(0, rail.getBoundingClientRect().bottom) : 0;
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
    panel.addEventListener('change', function (e) {
      if (e.target.id !== 'icw-notify-on') return;
      if (!e.target.checked) { store(KEY.notify, 'no'); return; }
      if (Notification.permission === 'granted') store(KEY.notify, 'yes'); else askNotify(true);
    });
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
    if (railAcross() || vw < 520) {
      panel.style.right = '8px'; panel.style.left = '8px'; panel.style.width = 'auto';
      panel.style.top = Math.max(8, Math.min(Math.max(r.bottom, topClear()) + 8, global.innerHeight - panel.offsetHeight - 8)) + 'px';
      panel.style.maxHeight = (global.innerHeight - Math.max(r.bottom, topClear()) - 16) + 'px'; panel.style.overflowY = 'auto';
      return;
    }
    panel.style.width = ''; panel.style.maxHeight = ''; panel.style.overflowY = '';
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
  function notifyQuestion() {
    if (store(KEY.notify) != null) return '';
    if (!notifyOk()) { store(KEY.notify, 'no'); return ''; }
    return '<div class="icw-ask"><p>Can we tell you when someone calls you?</p><div class="icw-row"><button type="button" data-do="notify-yes">Yes</button><button type="button" data-do="notify-no">No</button></div></div>';
  }
  function bringBox() {
    var ready = canBring();
    return '<div class="icw-bringbox"><p class="icw-label">Bring the others to what you select or point at</p><div class="icw-row">' +
      '<button type="button" data-do="bring-soft"' + (ready ? '' : ' class="icw-grey"') + '>❗ Show them</button>' +
      (S.role === 'host' ? '<button type="button" data-do="bring-hard"' + (ready ? '' : ' class="icw-grey"') + '>➡️ Take them there</button>' : '') +
      '</div>' + (ready ? '' : '<p class="icw-small">First, select some words or point at something.</p>') + '</div>';
  }
  function notifySwitch() {
    if (!notifyOk()) return '';
    return '<label class="icw-check"><input id="icw-notify-on" type="checkbox"' + (store(KEY.notify) === 'yes' ? ' checked' : '') + '> Tell me when someone calls me, if I am on another tab</label>';
  }
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
    var me = '<li><span class="icw-dot" style="background:' + (S.color || COLORS[0]) + '"></span><span class="icw-who">' + esc(S.name) + ' <span class="icw-small">(you' + (S.role === 'host' ? ', host' : '') + ')</span></span></li>';
    var list = named().sort(function (a, b) { return (here(b) - here(a)) || (b.host - a.host); });
    return '<ul class="icw-people">' + me + list.map(function (p) {
      var where = here(p) ? '' : '<br><span class="icw-small">on “' + esc(p.title) + '”</span>' + (p.path ? ' <button type="button" class="icw-mini" data-goto="' + esc(p.id) + '">Go there</button>' : '');
      var out = S.role === 'host' ? '<button type="button" class="icw-mini icw-out" data-out="' + esc(p.id) + '" title="Take ' + esc(p.name) + ' out of the session">Remove</button>' : '';
      return '<li><span class="icw-dot" style="background:' + p.color + '"></span><span class="icw-who">' + esc(p.name) + (p.host ? ' <span class="icw-small">(host)</span>' : '') + where + '</span>' + out + '</li>';
    }).join('') + '</ul>';
  }
  function renderPanel() {
    clearInterval(ticker); ticker = 0;
    if (!panel || panel.hidden) return;
    var h = '<div class="icw-head"><span>🤝 Work together</span><button type="button" class="icw-x" data-do="close" aria-label="Close">✕</button></div>';
    var st = S.status;
    if (st === 'idle' && invite) {
      h += notifyQuestion() + '<p>Someone invites you to work together on this page.</p>' + nameField() +
        '<div class="icw-row"><button type="button" class="icw-main" data-do="join">Join</button><button type="button" data-do="no">Not now</button></div>' + FIRST;
    } else if (st === 'idle') {
      h += notifyQuestion() + '<p>Work together on this page.</p>' + nameField() +
        '<div class="icw-row"><button type="button" class="icw-main" data-do="start">Start</button></div>' + FIRST + relayBox();
    } else if (st === 'connecting') {
      h += '<p class="icw-status">Connecting…</p>';
    } else if (st === 'room') {
      var others = hereNow().length, away = named().length - others;
      if (S.role === 'host') {
        h += '<p>Invite people: send them this link.</p><input id="icw-link" type="text" readonly value="' + esc(linkNow()) + '">' +
          '<div class="icw-row"><button type="button" class="icw-main" data-do="copy">Copy link</button></div>';
      }
      h += people();
      var waited = Math.round((Date.now() - S.joinedAt) / 1000);
      h += '<p class="icw-status" id="icw-status">' + (others ? 'You are together now.' : (away ? 'Nobody else is on this page.' :
        (waited >= 30 ? 'Nobody is here yet. Is your partner on this page?' : 'Waiting for your partner… ' + waited + ' s'))) + '</p>';
      if (S.role === 'host' && away) h += '<div class="icw-row"><button type="button" data-do="everyone">Bring everyone to this page</button></div>';
      if (S.note) h += '<p class="icw-small">' + esc(S.note) + '</p>';
      h += bringBox() + notifySwitch();
      h += '<p class="icw-small">On another lesson page in this tab, you join again by yourself.</p>';
      h += '<div class="icw-row">' + (S.role === 'host' ? '<button type="button" data-do="end">End for everyone</button>' : '<button type="button" data-do="leave">Leave</button>') + '</div>';
      if (!others && !away && waited < 30) ticker = setInterval(function () { var e = $('icw-status'); if (!e || named().length) { renderPanel(); return; } var w = Math.round((Date.now() - S.joinedAt) / 1000); if (w >= 30) renderPanel(); else e.textContent = 'Waiting for your partner… ' + w + ' s'; }, 1000);
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
    var t = e.target.closest('[data-goto], [data-out]');
    if (t && t.dataset.goto) { var gp = S.peers[t.dataset.goto]; if (gp && gp.path) go(gp.path); return; }
    if (t && t.dataset.out) { remove(t.dataset.out); return; }
    var b = e.target.closest('[data-do]');
    if (!b) return;
    var what = b.getAttribute('data-do');
    if (what === 'close') openPanel(false);
    else if (what === 'start') { var n = readName(); if (!n) return; saveRelay(); start({ name: n }); }
    else if (what === 'join') { var m = readName(); if (!m || !invite) return; var i = invite; invite = null; enter({ room: i.room, key: i.key, role: 'learner', name: m }, { fresh: true }); }
    else if (what === 'no') { invite = null; renderPanel(); }
    else if (what === 'copy') {
      var link = linkNow(), done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1200); };
      var byHand = function () { var f = $('icw-link'); if (f) { f.select(); try { document.execCommand('copy'); done(); } catch (err) { /* selected: copy by hand */ } } };
      if (navigator.clipboard && global.isSecureContext) navigator.clipboard.writeText(link).then(done, byHand); else byHand();
    }
    else if (what === 'notify-yes' || what === 'notify-no') askNotify(what === 'notify-yes');
    else if (what === 'bring-soft' || what === 'bring-hard') { if (bring(what === 'bring-hard' ? 'hard' : 'soft')) openPanel(false); }
    else if (what === 'leave') leave();
    else if (what === 'end') end();
    else if (what === 'everyone') { everyoneHere(); openPanel(false); }
    else if (what === 'again') { S.note = ''; setStatus('idle'); }
    else if (what === 'retry') { if (S.sess) enter(S.sess); else setStatus('idle'); }
  }

  function start(o) {
    var sess = { room: random(10), key: random(20), role: 'host', name: cleanName((o && o.name) || S.name || store(KEY.name)) || 'Teacher' };
    return enter(sess, { fresh: true }).then(linkNow);
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
      + '.icw-bringring{ border-style:dashed; }'
      + '.icw-badge{ position:absolute; left:0; top:0; transform-origin:50% 50%; width:20px; height:20px; border-radius:50%; color:#fff; font:800 13px/20px system-ui, sans-serif; text-align:center; box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,.3); animation:icw-pop .5s ease 2; }'
      + '.icw-edgebadge{ display:inline-block; margin-left:6px; width:16px; height:16px; border-radius:50%; background:#fff; color:#c92a2a; font:800 11px/16px system-ui, sans-serif; text-align:center; }'
      + '@keyframes icw-pop{ 0%, 100%{ transform:scale(1); } 50%{ transform:scale(1.35); } }'
      + '.icw-cursor{ position:absolute; left:0; top:0; display:flex; align-items:flex-start; filter:drop-shadow(0 1px 2px rgba(0,0,0,.35)); transition:opacity .3s; }'
      + '.icw-curname{ margin:14px 0 0 -4px; color:#fff; font:600 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif; padding:0 6px; border-radius:6px; white-space:nowrap; max-width:140px; overflow:hidden; text-overflow:ellipsis; }'
      + '.icw-cursor.icw-pulse svg{ animation:icw-click .45s ease-out; }'
      + '@keyframes icw-click{ 0%{ scale:1; } 40%{ scale:1.45; } 100%{ scale:1; } }'
      + '.icw-ripple{ position:absolute; width:14px; height:14px; margin:-7px 0 0 -7px; border:3px solid; border-radius:50%; animation:icw-ripple .8s ease-out forwards; }'
      + '@keyframes icw-ripple{ to{ width:56px; height:56px; margin:-28px 0 0 -28px; opacity:0; } }'
      /* while 🖍️ is on, my selection is drawn in my colour, as the others see it */
      + 'html.icw-own *::selection{ background:transparent; }'
      + 'html.icw-own #icw-panel *::selection, html.icw-own input::selection, html.icw-own textarea::selection{ background:Highlight; color:HighlightText; }'
      + '#icw-toast{ position:fixed; left:0; right:0; margin:0 auto; width:max-content; bottom:58px; z-index:1060; text-align:center; max-width:calc(100vw - 24px); padding:8px 14px; border-radius:999px;'
      +   ' background:var(--text-primary, #1a1a1a); color:var(--surface-2, #fff); font:600 13px/1.35 var(--font-sans, system-ui, sans-serif); box-shadow:0 6px 18px rgba(0,0,0,.2); }'
      + '#icw-toast[hidden], #icw-bring[hidden]{ display:none; }'
      + '#icw-bring{ position:fixed; z-index:1050; display:flex; flex-direction:column; gap:6px; padding:8px; border-radius:12px; background:var(--surface-2, #fff); border:1px solid var(--border, #e3e3e6); box-shadow:0 8px 24px rgba(0,0,0,.18); }'
      + '#icw-bring button, #icw-panel .icw-bringbox button{ font:600 13px/1.2 var(--font-sans, system-ui, sans-serif); padding:7px 13px; border-radius:999px; border:1px solid var(--border, #e3e3e6); background:var(--surface-1, #f7f7f8); color:var(--text-primary, #1a1a1a); cursor:pointer; text-align:left; white-space:nowrap; }'
      + '#icw-panel button.icw-grey{ opacity:.5; }'
      + '#icw-panel .icw-ask{ background:var(--color-background-info, #e6f1fb); border-radius:10px; padding:8px 10px 2px; margin-bottom:10px; }'
      + '#icw-panel .icw-bringbox{ border-top:1px solid var(--border, #e3e3e6); padding-top:8px; margin-top:4px; }'
      + '#icw-follow{ position:fixed; left:0; right:0; margin:0 auto; width:max-content; bottom:14px; z-index:1110; display:flex; align-items:center; gap:8px; max-width:calc(100vw - 20px);'
      +   ' padding:8px 8px 8px 14px; border-radius:14px; background:var(--surface-2, #fff); color:var(--text-primary, #1a1a1a); border:1px solid var(--text-accent, #185fa5);'
      +   ' box-shadow:0 8px 24px rgba(0,0,0,.2); font:600 13px/1.35 var(--font-sans, system-ui, sans-serif); }'
      + '#icw-follow[hidden]{ display:none; }'
      + '#icw-follow .icw-ftext{ flex:1 1 auto; min-width:0; }'
      + '#icw-follow button{ font:600 13px/1.2 var(--font-sans, system-ui, sans-serif); padding:7px 12px; border-radius:999px; border:1px solid var(--border, #e3e3e6); background:var(--surface-1, #f7f7f8); color:inherit; cursor:pointer; white-space:nowrap; }'
      + '#icw-follow .icw-fgo{ background:var(--text-accent, #185fa5); border-color:var(--text-accent, #185fa5); color:#fff; }'
      + '#icw-follow button[hidden]{ display:none; }'
      + '#icw-panel .icw-people li{ align-items:flex-start; }'
      + '#icw-panel .icw-people .icw-dot{ margin-top:4px; }'
      + '#icw-panel .icw-who{ flex:1 1 auto; min-width:0; overflow-wrap:anywhere; }'
      + '#icw-panel button.icw-mini{ font-size:11px; padding:2px 8px; margin-top:1px; }'
      + '#icw-panel button.icw-out{ color:var(--bad, #b0392f); }'
      + '@media print{ #icw-layer, #icw-panel, #icw-bring, #icw-toast, #icw-follow{ display:none !important; } }';
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
    var said = null;
    try { said = JSON.parse(sessionStorage.getItem('icwhatuc-note') || 'null'); sessionStorage.removeItem('icwhatuc-note'); } catch (e) { said = null; }
    if (said && said.status === 'ended') { setStatus('ended', said.note); openPanel(true); }
    invited(true);
  }
  function invited(first) {
    var inv = parseInvite(location.hash), saved = session();
    if (!inv && !first) return;
    if (inv) {
      try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* file pages */ }
      if (saved && saved.room === inv.room && saved.key === inv.key) { if (!(S.room && S.sess && S.sess.room === inv.room)) enter(saved); return; }
      invite = inv;
      openPanel(true);
      return;
    }
    if (first && saved && saved.room && saved.key && saved.role && saved.name) enter(saved);
  }
  global.addEventListener('hashchange', function () { invited(false); });

  global.ICwhatUC = {
    toggle: toggle,
    open: function () { openPanel(true); },
    start: start,
    join: function (link, o) { var i = parseInvite(link); if (!i) return Promise.reject(new Error('not an ICwhatUC link')); return enter({ room: i.room, key: i.key, role: 'learner', name: cleanName((o && o.name) || store(KEY.name)) || 'Learner' }); },
    leave: leave, end: end,
    peers: function () { return named().map(function (p) { var o = publicPeer(p); o.here = here(p); o.page = p.title; return o; }); },
    link: linkNow,
    status: function () { return S.status; },
    persistent: function () { return !!HUB; },
    showCursor: showCursor, showHighlights: showHighlights, seeOthers: seeOthers,
    canBring: canBring, bring: bring, everyoneHere: everyoneHere, remove: remove,
    key: function (el, k) { if (k != null) { el.dataset.icwKey = k; gen++; return 'k:' + k; } return keyOf(el); },
    resolve: resolveKey,
    on: function (type, fn) { (S.listeners[type] = S.listeners[type] || []).push(fn); },
    send: function (type, data) { if (S.room) S.actions.x({ t: String(type), d: data }); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
