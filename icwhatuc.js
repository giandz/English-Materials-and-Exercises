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
   Colours: each person picks their own colour, from the 140 web colours, in the
   panel's list of people; the host can change anyone's. Until someone picks, they
   have one of nine automatic colours.
   🏹 Arrow (host only): an arrow from one highlight to another, on everyone's page:
   choose 🏹, highlight where it starts, 👍 (or ❌), highlight where it ends (a dashed
   preview follows), 👍 (or ❌). Arrows stay until the host removes them. An arrow
   leaves and reaches its highlights at right angles (above or below words), with an
   S-bend when it has to.
   ⭕ Circle or underline (host only): choose ⭕, pick Circle or Underline, highlight
   (a dashed preview follows), 👍 (or ❌). Each line of the words is marked.
   🗣️ How to say it (host only): PronMark's stress, connected speech and
   intonation marks over the selected words, on everyone's page, until the host
   presses it again. The marks are drawn on see-through copies of those lines laid
   over the page, so the page itself does not move. The host picks their colour.

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
  /* the automatic colours, for people who have not picked one */
  var COLORS = ['#1f7ae0', '#d6336c', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599', '#8b5e3c', '#5c940d', '#6c757d'];
  /* the 140 web colours, greys first, then by hue, each hue dark to light */
  var WEB = 'black:000000,dim gray:696969,gray:808080,dark gray:a9a9a9,silver:c0c0c0,light gray:d3d3d3,gainsboro:dcdcdc,white smoke:f5f5f5,white:ffffff,maroon:800000,dark red:8b0000,brown:a52a2a,fire brick:b22222,crimson:dc143c,red:ff0000,indian red:cd5c5c,tomato:ff6347,rosy brown:bc8f8f,salmon:fa8072,light coral:f08080,light pink:ffb6c1,pink:ffc0cb,misty rose:ffe4e1,snow:fffafa,saddle brown:8b4513,dark golden rod:b8860b,sienna:a0522d,chocolate:d2691e,golden rod:daa520,dark orange:ff8c00,orange:ffa500,orange red:ff4500,peru:cd853f,coral:ff7f50,sandy brown:f4a460,tan:d2b48c,dark salmon:e9967a,burly wood:deb887,light salmon:ffa07a,wheat:f5deb3,navajo white:ffdead,moccasin:ffe4b5,peach puff:ffdab9,bisque:ffe4c4,blanched almond:ffebcd,antique white:faebd7,papaya whip:ffefd5,linen:faf0e6,old lace:fdf5e6,sea shell:fff5ee,floral white:fffaf0,olive:808000,gold:ffd700,yellow:ffff00,dark khaki:bdb76b,khaki:f0e68c,pale golden rod:eee8aa,light golden rod yellow:fafad2,lemon chiffon:fffacd,beige:f5f5dc,cornsilk:fff8dc,light yellow:ffffe0,ivory:fffff0,dark olive green:556b2f,olive drab:6b8e23,lawn green:7cfc00,chartreuse:7fff00,yellow green:9acd32,green yellow:adff2f,dark green:006400,green:008000,forest green:228b22,lime:00ff00,lime green:32cd32,dark sea green:8fbc8f,light green:90ee90,pale green:98fb98,honey dew:f0fff0,sea green:2e8b57,medium sea green:3cb371,medium spring green:00fa9a,spring green:00ff7f,medium aqua marine:66cdaa,aquamarine:7fffd4,mint cream:f5fffa,dark slate gray:2f4f4f,teal:008080,dark cyan:008b8b,dark turquoise:00ced1,light sea green:20b2aa,aqua:00ffff,cadet blue:5f9ea0,cyan:00ffff,medium turquoise:48d1cc,turquoise:40e0d0,light blue:add8e6,powder blue:b0e0e6,pale turquoise:afeeee,light cyan:e0ffff,azure:f0ffff,steel blue:4682b4,deep sky blue:00bfff,slate gray:708090,light slate gray:778899,dodger blue:1e90ff,cornflower blue:6495ed,sky blue:87ceeb,light sky blue:87cefa,light steel blue:b0c4de,alice blue:f0f8ff,navy:000080,midnight blue:191970,dark blue:00008b,dark slate blue:483d8b,medium blue:0000cd,blue:0000ff,royal blue:4169e1,slate blue:6a5acd,medium slate blue:7b68ee,lavender:e6e6fa,ghost white:f8f8ff,indigo:4b0082,dark violet:9400d3,dark orchid:9932cc,blue violet:8a2be2,medium purple:9370db,purple:800080,dark magenta:8b008b,fuchsia:ff00ff,magenta:ff00ff,medium orchid:ba55d3,orchid:da70d6,violet:ee82ee,plum:dda0dd,thistle:d8bfd8,medium violet red:c71585,deep pink:ff1493,pale violet red:db7093,hot pink:ff69b4,lavender blush:fff0f5'.split(',').map(function (x) { var i = x.lastIndexOf(':'); return { name: x.slice(0, i), hex: '#' + x.slice(i + 1) }; });
  var ALLOWED = {};
  COLORS.concat(WEB.map(function (w) { return w.hex; })).forEach(function (h) { ALLOWED[h] = true; });
  function okColor(c) { return typeof c === 'string' && ALLOWED[c.toLowerCase()] === true; }
  function colorName(hex) { for (var i = 0; i < WEB.length; i++) if (WEB[i].hex === hex) return WEB[i].name; return 'an automatic colour'; }
  /* black or white writing on a colour, whichever reads better */
  function ink(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff';
    var n = parseInt(m[1], 16), lum = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * lum(n >> 16) + 0.7152 * lum((n >> 8) & 255) + 0.0722 * lum(n & 255);
    return L > 0.35 ? '#1a1a1a' : '#fff';
  }
  /* one named highlight per colour in use, its style added the first time */
  var hlRules = {};
  function hlName(hex) {
    var h = String(hex || '').toLowerCase().replace('#', '');
    if (!/^[0-9a-f]{6}$/.test(h)) h = COLORS[0].slice(1);
    var name = 'icw-h' + h;
    if (!hlRules[name]) {
      hlRules[name] = true;
      var st = document.getElementById('icwhatuc-hl-styles');
      if (!st) { st = document.createElement('style'); st.id = 'icwhatuc-hl-styles'; document.head.appendChild(st); }
      st.textContent += '::highlight(' + name + '){ background-color:#' + h + '4d; }';
    }
    return name;
  }
  var OURS = '#icw-layer, .icw-say, #icw-tool, #icw-panel, #icw-bring, #icw-toast, #icw-follow, #house-rail, #font-size-panel, .hd-card, .hd-arrow, .hd-hint';
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
  var PAGED = { over: 1, sel: 1, cur: 1, tap: 1, bring: 1, say: 1, arrows: 1, marks: 1 };
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
  var ACTIONS = ['hello', 'over', 'sel', 'cur', 'tap', 'bring', 'go', 'kick', 'bye', 'x', 'paint', 'say', 'arrows', 'marks'];
  var REPLAY = ['hello', 'over', 'sel', 'say', 'arrows', 'marks'];
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
    peers: {}, out: {}, actions: {}, status: 'idle', arrows: [], arrowMode: null, marks: [], markMode: null, nums: {}, own: '', note: '', listeners: {},
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
    var all = Object.keys(S.peers).map(function (id) { return { id: id, host: S.peers[id].host, c: S.peers[id].c }; });
    if (S.self) all.push({ id: S.self, host: S.role === 'host', c: S.sess && S.sess.c });
    all.sort(function (a, b) { return (b.host - a.host) || (a.id < b.id ? -1 : 1); });
    var used = {};
    /* a colour someone picked is theirs, even if someone else has it too */
    all.forEach(function (p) {
      if (!okColor(p.c)) return;
      var hx = p.c.toLowerCase(), k = COLORS.indexOf(hx);
      if (k >= 0) used[k] = true;
      if (p.id === S.self) S.color = hx; else S.peers[p.id].color = hx;
    });
    all.forEach(function (p) {
      if (okColor(p.c)) return;
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
      sess.fresh = !sess.cont; session(sess);   /* a later link: no panel, the lesson just goes on */
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
    S.sess = sess; S.role = sess.role; setOwn(sess.name);
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
    S.nums = sess.role === 'host' ? loadNums(sess.room) : {};
    S.client = { handlers: {}, join: function (id) { peer(id); sayHello(); renderPanel(); }, leave: function (id) { gone(id); } };

    S.actions.hello = makeAction('hello', function (d, p) {
      var fresh = !p.name, wasHere = here(p);
      p.own = cleanName(d.name); p.host = d.host === true; p.v = +d.v || 0;
      p.u = typeof d.u === 'string' && /^[A-Za-z0-9]{6,20}$/.test(d.u) ? d.u : null;
      if (p.host && S.role !== 'host' && d.nums && typeof d.nums === 'object') takeNums(d.nums);
      if (S.role === 'host' && !p.host && p.u && !S.nums[p.u]) numberFor(p.u);
      label(p);
      p.pg = typeof d.pg === 'string' ? d.pg.slice(0, 16) : '';
      p.title = cleanName(String(d.title || '').slice(0, 80)) ? String(d.title).replace(/[\u0000-\u001f]/g, '').slice(0, 80) : 'another page';
      p.path = sameSite(d.path);
      var oldC = p.c;
      p.c = okColor(d.c) ? d.c.toLowerCase() : null;
      if (oldC !== p.c) { p.dirty = true; hlSig = ''; }
      if (p.host && Array.isArray(d.out)) d.out.slice(0, 50).forEach(function (id) {
        if (typeof id !== 'string') return;
        if (id === S.self) removed(p.name); else { S.out[id] = true; saveOut(); if (S.peers[id]) gone(id, true); }
      });
      if (!S.room) return;
      if (!here(p)) { p.over = null; p.sel = null; p.cur = null; p.bring = null; p.dirty = true; if (S.say && S.say.from === p.id) showSay(null); if (S.arrowsFrom === p.id) S.arrows = []; if (S.marksFrom === p.id) S.marks = []; }
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
    /* the host changes someone's colour: that person takes it as their own */
    S.actions.paint = makeAction('paint', function (d, p) {
      if (!p.host || d.id !== S.self || !okColor(d.c)) return;
      setColor('me', d.c, true);
    });
    S.actions.arrows = makeAction('arrows', function (d, p) {
      if (!p.host) return;
      S.arrows = Array.isArray(d.list) ? d.list.slice(0, 30).map(cleanArrow).filter(Boolean) : [];
      S.arrowsFrom = p.id; kick();
    });
    S.actions.marks = makeAction('marks', function (d, p) {
      if (!p.host) return;
      S.marks = Array.isArray(d.list) ? d.list.slice(0, MAX_MARKS).map(cleanMark).filter(Boolean) : [];
      S.marksFrom = p.id; kick();
    });
    S.actions.say = makeAction('say', function (d, p) {
      if (!p.host) return;
      showSay(Array.isArray(d.sel) ? cleanPieces(d.sel) : null, p.id, d.c);
    });
    S.actions.x = makeAction('x', function (d, p) {
      var fns = S.listeners[String(d.t)];
      if (fns) fns.forEach(function (fn) { try { fn(d.d, publicPeer(p)); } catch (e) { console.warn(e); } });
    });
    S.arrows = []; S.arrowMode = null; S.marks = []; S.markMode = null;
    if (sess.role === 'host') {
      try { S.arrows = (JSON.parse(sessionStorage.getItem('icwhatuc-arrows-' + PG) || '[]') || []).map(cleanArrow).filter(Boolean); } catch (e) { S.arrows = []; }
      try { S.marks = (JSON.parse(sessionStorage.getItem('icwhatuc-marks-' + PG) || '[]') || []).map(cleanMark).filter(Boolean); } catch (e) { S.marks = []; }
    }
    hub.attach(S.client);                                  /* the people already here, and what they show */

    assignColors();
    setStatus('room');
    rail(true);
    sayHello();
    remember(sess);
    if (sess.cont) { delete sess.cont; session(sess); handOver(sess); toast('You are in the lesson.'); }   /* a later link of the lesson: the old tab steps out */
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
    S.actions.hello(helloData());
    S.actions.over({ k: prefs.hl ? S.mine.over : null });
    S.actions.sel({ p: prefs.hl ? S.mine.sel : null });
    if (S.role === 'host' && S.say && S.say.from === 'me') S.actions.say({ sel: S.say.pieces, c: S.say.c });
    if (S.role === 'host' && S.arrows.length) S.actions.arrows({ list: S.arrows });
    if (S.role === 'host' && S.marks.length) S.actions.marks({ list: S.marks });
  }
  function gone(id, quiet) {
    var p = S.peers[id];
    if (!p) return;
    if (S.say && S.say.from === id) showSay(null);
    if (S.arrowsFrom === id) S.arrows = [];
    if (S.marksFrom === id) S.marks = [];
    if (p.u && Object.keys(S.peers).some(function (o) { return o !== id && S.peers[o].u === p.u && S.peers[o].name; })) quiet = true;   /* the same person, now in another tab */
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
    clearDrawing(); markTab(false); cur.on = false; follow(null); clearSay(); S.say = null; S.arrows = []; S.arrowMode = null; S.marks = []; S.markMode = null; renderTool();
    S.mine.bring = null;
  }
  function leave() {
    forget();
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
    forget();
    quietLeave(); session(null); S.sess = null; S.out = {}; saveOut();
    var said = by ? by + ' ended the session.' : 'The session is over.';
    if (unwrap('ended', said)) return;
    rail(false); setStatus('ended', said);
    openPanel(true);
  }
  /* ══ NAMES AND NUMBERS ═══════════════════════════════════════════════════
     A learner who has not typed a name is "Me" on their own screen, and "Student 1",
     "Student 2"… on everyone else's. The host gives the numbers, in the order people
     first join, and keeps them for the whole lesson (on this device, for the room), so
     a student keeps the same number on every page. The number follows the student's
     own id for the lesson, made when they press Join and kept with the lesson. */
  function setOwn(n) { S.own = cleanName(n); S.name = S.own || (S.role === 'host' ? 'Teacher' : 'Me'); }
  function label(p) { p.name = p.own || (p.host ? 'Teacher' : (S.nums[p.u] ? 'Student ' + S.nums[p.u] : 'Student')); }
  function loadNums(room) { var n = store('icwhatuc-nums-' + room); return n && typeof n === 'object' ? n : {}; }
  function numberFor(u) {
    var top = 0;
    Object.keys(S.nums).forEach(function (k) { top = Math.max(top, +S.nums[k] || 0); });
    S.nums[u] = top + 1;
    if (S.sess) store('icwhatuc-nums-' + S.sess.room, S.nums);
    setTimeout(function () { if (S.room && S.role === 'host') S.actions.hello(helloData()); }, 0);   /* the others learn the number too */
  }
  function takeNums(n) {
    var out = {};
    Object.keys(n).slice(0, 60).forEach(function (k) { var v = +n[k]; if (/^[A-Za-z0-9]{6,20}$/.test(k) && v >= 1 && v <= 999) out[k] = Math.floor(v); });
    S.nums = out;
    Object.keys(S.peers).forEach(function (id) { if (S.peers[id].name) label(S.peers[id]); });
    renderPanel(); kick();
  }
  function helloData() {
    var d = { v: PROTOCOL, name: S.own, u: S.sess && S.sess.u ? S.sess.u : undefined, host: S.role === 'host', pg: PG, path: location.pathname, title: pageTitle(), c: S.sess && okColor(S.sess.c) ? S.sess.c : '' };
    if (S.role === 'host') {
      d.out = Object.keys(S.out || {}).slice(0, 50);
      var nums = {};
      Object.keys(S.nums).slice(-60).forEach(function (k) { nums[k] = S.nums[k]; });
      d.nums = nums;
    }
    return d;
  }
  function saveMyName() {
    var f = $('icw-myname');
    if (!f || !S.sess) return;
    var n = cleanName(f.value);
    if (n === S.own) return;
    setOwn(n);
    store(KEY.name, n);
    S.sess.name = n; session(S.sess); remember(S.sess);
    sayHello(); renderPanel(); kick();
    toast(n ? 'The others see you as ' + n + ' now.' : 'Your name is “Me” again.');
  }

  /* ══ ONE LINK AFTER ANOTHER ══════════════════════════════════════════════
     The teacher can send each page's link in the video call. A device that has joined
     a lesson remembers it (for 12 hours), so the next link of that lesson joins by
     itself, with no name to type and no button to press, in whatever tab it opens.
     The tab it replaces steps out, so nobody is there twice. Only a link to another page
     joins by itself: the same page's link opened again is taken to be someone else (two
     students on one computer), who gets the usual Join box. A link opened on the teacher's
     device joins as a learner too; the teacher continues with 🤝 "Continue the lesson". */
  var DAY = 12 * 3600 * 1000;
  function remember(sess) {
    var rec = { room: sess.room, key: sess.key, name: S.own, at: Date.now(), page: PAGE };
    if (sess.role === 'host') store('icwhatuc-hosting', rec);
    else { rec.u = sess.u || ''; store('icwhatuc-joined', rec); }
  }
  function recent(k) {
    var r = store(k);
    if (!r || typeof r !== 'object' || !r.room || !r.key) return null;
    if (!(Date.now() - (+r.at || 0) < DAY)) { try { localStorage.removeItem(k); } catch (e) { /* fine */ } return null; }
    return r;
  }
  function hosting() { return recent('icwhatuc-hosting'); }
  /* the next page of a lesson I am in; the same page's link again is someone else (two students on one computer) */
  function joinedBefore(inv) { var r = recent('icwhatuc-joined'); return r && r.room === inv.room && r.key === inv.key && r.page !== PAGE ? r : null; }
  function forget() {
    try { localStorage.removeItem(S.role === 'host' ? 'icwhatuc-hosting' : 'icwhatuc-joined'); } catch (e) { /* fine */ }
  }
  /* the tabs of this browser tell each other when the lesson moves to a new one */
  var TAB = (function () {
    try { var t = sessionStorage.getItem('icwhatuc-tab'); if (!t) { t = random(8); sessionStorage.setItem('icwhatuc-tab', t); } return t; }
    catch (e) { return random(8); }
  })();
  var tabs = null;
  try { tabs = new BroadcastChannel('icwhatuc-tabs'); } catch (e) { tabs = null; }
  if (tabs) tabs.onmessage = function (e) {
    var d = e.data;
    if (!d || d.t !== 'moved' || d.tab === TAB || !S.room || !S.sess) return;
    if (d.room !== S.sess.room || d.role !== S.role || (d.u && S.sess.u && d.u !== S.sess.u)) return;
    movedAway();
  };
  function handOver(sess) { if (tabs) { try { tabs.postMessage({ t: 'moved', tab: TAB, room: sess.room, role: sess.role, u: sess.u || '' }); } catch (e) { /* fine */ } } }
  function movedAway() {
    quietLeave(); session(null); S.sess = null;
    var said = 'The lesson goes on in another tab now. You can close this one.';
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
    forget();
    quietLeave(); session(null); S.sess = null; S.out = {}; saveOut();
    var said = (by || 'The host') + ' took you out of the session.';
    if (unwrap('ended', said)) return;
    rail(false); setStatus('ended', said);
    openPanel(true);
  }

  /* ══ COLOURS ═════════════════════════════════════════════════════════════
     Everyone picks their own; the host can pick anyone's. My choice is kept for this
     tab, so it follows me to the next page, and goes to the others in my hello. */
  function setColor(id, c, fromHost) {
    if (!S.room || !okColor(c)) return false;
    c = c.toLowerCase();
    if (id === 'me' || id === S.self) {
      S.sess.c = c; session(S.sess);
      assignColors(); hlSig = ''; sayHello(); renderPanel(); kick();
      if (fromHost) toast('Your colour is now ' + colorName(c) + '.');
      return true;
    }
    if (S.role !== 'host' || !S.peers[id]) return false;
    S.actions.paint({ id: id, c: c });
    var p = S.peers[id];                         /* shown at once here; their hello confirms it */
    p.c = c; p.dirty = true; assignColors(); hlSig = ''; renderPanel(); kick();
    return true;
  }

  /* ══ ARROWS (host only) ══════════════════════════════════════════════════
     An arrow joins two highlights: each end is a text selection (as words, like a
     selection) or a tapped element (by its key). The host builds one in two steps,
     with 👍 and ❌ in the tool bar, and sees a dashed preview before the second 👍. */
  function cleanTarget(t) {
    if (!t || typeof t !== 'object') return null;
    var sel = Array.isArray(t.sel) ? cleanPieces(t.sel) : null, k = typeof t.k === 'string' && t.k.length <= 600 ? t.k : null;
    return sel || k ? { sel: sel, k: sel ? null : k } : null;
  }
  function cleanArrow(a) {
    if (!a || typeof a !== 'object') return null;
    var A = cleanTarget(a.a), B = cleanTarget(a.b);
    if (!A || !B) return null;
    return { id: String(a.id || random(6)).slice(0, 12), a: A, b: B, c: okColor(a.c) ? a.c.toLowerCase() : COLORS[0] };
  }
  /* what the host has highlighted for an arrow: a selection, or else the last thing they tapped since this step began */
  function arrowTarget(since) {
    if (S.mine.sel) return { sel: S.mine.sel, k: null };          /* words selected right now */
    var pk = S.mine.picked;                                        /* else something tapped in this step (the tap may have just cleared a selection) */
    if (pk && pk.t >= since && pk.el && pk.el.isConnected) return { sel: null, k: keyOf(pk.el) };
    if (S.mine.lastSel && S.mine.lastSelAt >= since && Date.now() - S.mine.lastSelAt < 2500) return { sel: S.mine.lastSel, k: null };
    return null;
  }
  function arrowColor() { var c = store('icwhatuc-arrow-color'); return okColor(c) ? c.toLowerCase() : (S.color || COLORS[0]); }
  function saveArrows() {
    try { sessionStorage.setItem('icwhatuc-arrows-' + PG, JSON.stringify(S.arrows)); } catch (e) { /* fine */ }
    S.actions.arrows({ list: S.arrows });
    kick();
  }
  function arrowButton() {
    if (S.role !== 'host' || !S.room) return;
    if (S.arrowMode) { arrowCancel(); return; }
    if (S.markMode) { S.markMode = null; railMark(); }
    S.arrowMode = { step: 'a', since: Date.now(), a: null };
    renderTool(); railArrow();
  }
  function arrowOk() {
    var m = S.arrowMode;
    if (!m) return;
    var t = arrowTarget(m.since);
    if (!t) { toast('First, select some words or tap something.'); return; }
    if (m.step === 'a') {
      m.a = t; m.step = 'b'; m.since = Date.now();
      try { global.getSelection().removeAllRanges(); } catch (e) { /* fine */ }
      S.mine.lastSel = null; S.mine.sel = null; S.mine.selJson = 'null'; S.mine.picked = null;
      renderTool(); kick();
      return;
    }
    S.arrows.push({ id: random(6), a: m.a, b: t, c: arrowColor() });
    if (S.arrows.length > 30) S.arrows.shift();
    S.arrowMode = null;
    try { global.getSelection().removeAllRanges(); } catch (e) { /* fine */ }
    saveArrows(); renderTool(); railArrow();
    toast(named().length ? 'Everyone sees the arrow now.' : 'The arrow is placed.');
  }
  function arrowCancel() { S.arrowMode = null; renderTool(); railArrow(); kick(); }
  function railArrow() { if (global.HouseRail) global.HouseRail.set('icwhatuc-arrow', !!S.arrowMode); titles(); }

  /* ══ ⭕ CIRCLE OR UNDERLINE (host only) ═══════════════════════════════════
     A mark on a highlight: each line of the words is circled or underlined (a tapped
     element is marked as one box). Choose ⭕, pick the shape, highlight, 👍 or ❌;
     the host sees a dashed preview while highlighting. */
  var MAX_MARKS = 40;
  function cleanMark(m) {
    if (!m || typeof m !== 'object') return null;
    var t = cleanTarget(m.t);
    if (!t) return null;
    return { id: String(m.id || random(6)).slice(0, 12), t: t, s: m.s === 'line' ? 'line' : 'circle', c: okColor(m.c) ? m.c.toLowerCase() : COLORS[0] };
  }
  function markColor() { var c = store('icwhatuc-mark-color'); return okColor(c) ? c.toLowerCase() : (S.color || COLORS[0]); }
  function markShape() { return store('icwhatuc-mark-shape') === 'line' ? 'line' : 'circle'; }
  function setShape(s) { store('icwhatuc-mark-shape', s === 'line' ? 'line' : 'circle'); renderTool(); kick(); }
  function saveMarks() {
    try { sessionStorage.setItem('icwhatuc-marks-' + PG, JSON.stringify(S.marks)); } catch (e) { /* fine */ }
    S.actions.marks({ list: S.marks });
    kick();
  }
  function markButton() {
    if (S.role !== 'host' || !S.room) return;
    if (S.markMode) { markCancel(); return; }
    if (S.arrowMode) { S.arrowMode = null; railArrow(); }
    S.markMode = { since: Date.now() };
    renderTool(); railMark(); kick();
  }
  function markOk() {
    var m = S.markMode;
    if (!m) return;
    var t = arrowTarget(m.since);
    if (!t) { toast('First, select some words or tap something.'); return; }
    S.marks.push({ id: random(6), t: t, s: markShape(), c: markColor() });
    if (S.marks.length > MAX_MARKS) S.marks.shift();
    S.markMode = null;
    try { global.getSelection().removeAllRanges(); } catch (e) { /* fine */ }
    S.mine.picked = null;
    saveMarks(); renderTool(); railMark();
    toast(named().length ? 'Everyone sees the mark now.' : 'The mark is placed.');
  }
  function markCancel() { S.markMode = null; renderTool(); railMark(); kick(); }
  function railMark() { if (global.HouseRail) global.HouseRail.set('icwhatuc-mark', !!S.markMode); titles(); }

  /* ══ WHERE THINGS ARE ON MY PAGE ═════════════════════════════════════════
     An end of an arrow, or a mark, is found on each person's own layout: the lines
     of its words, or its element's box. What is found is kept beside the target,
     not in it, so the target itself stays plain data to send. */
  var found = new WeakMap();
  function lookup(t) {
    var f = found.get(t);
    if (!f || f.gen !== gen || (f.el && !f.el.isConnected)) {
      f = { gen: gen, ranges: [], el: null };
      if (t.sel) t.sel.forEach(function (piece) { var b = resolveKey(piece.k), r = b && rangeForPiece(b, piece); if (r) f.ranges.push(r); else if (b && !f.el) f.el = b; });
      else if (t.k) f.el = resolveKey(t.k);
      found.set(t, f);
    }
    return f;
  }
  /* the rectangles of some ranges, joined into one box per line */
  function linesOf(ranges) {
    var rs = [];
    (ranges || []).forEach(function (r) { [].forEach.call(r.getClientRects(), function (x) { if (x.width > 0.5 && x.height > 0.5) rs.push({ left: x.left, top: x.top, right: x.right, bottom: x.bottom }); }); });
    rs.sort(function (a, b) { return a.top - b.top || a.left - b.left; });
    var out = [];
    rs.forEach(function (x) {
      var l = out[out.length - 1];
      if (l) {
        var ov = Math.min(l.bottom, x.bottom) - Math.max(l.top, x.top), hm = Math.min(l.bottom - l.top, x.bottom - x.top);
        if (ov > hm * 0.5) { l.left = Math.min(l.left, x.left); l.right = Math.max(l.right, x.right); l.top = Math.min(l.top, x.top); l.bottom = Math.max(l.bottom, x.bottom); return; }
      }
      out.push({ left: x.left, top: x.top, right: x.right, bottom: x.bottom });
    });
    out.forEach(function (l) { l.width = l.right - l.left; l.height = l.bottom - l.top; });
    return out;
  }
  function rectOf(el) { var e = el.getBoundingClientRect(); return e.width || e.height ? { left: e.left, top: e.top, right: e.right, bottom: e.bottom, width: e.width, height: e.height } : null; }
  /* a place on my page: { lines, box, text } — text: words, so only above or below them */
  function spot(lines, el) {
    if (lines && lines.length) {
      var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      lines.forEach(function (l) { L = Math.min(L, l.left); T = Math.min(T, l.top); R = Math.max(R, l.right); B = Math.max(B, l.bottom); });
      return { lines: lines, box: { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T }, text: true };
    }
    var r = el && el.isConnected ? rectOf(el) : null;
    return r ? { lines: [r], box: r, text: false } : null;
  }
  function targetPlace(t) { if (!t) return null; var f = lookup(t); return spot(linesOf(f.ranges), f.el); }
  function targetBox(t) { var p = targetPlace(t); return p && p.box; }
  /* what the host has highlighted right now (for the previews) */
  function livePlace(since) {
    var r = selfRanges();
    if (r.length) return spot(linesOf(r), null);
    var pk = S.mine.picked;
    return pk && pk.t >= since && pk.el && pk.el.isConnected ? spot(null, pk.el) : null;
  }

  /* ══ ARROW SHAPES ════════════════════════════════════════════════════════
     An arrow leaves its first highlight at a right angle to one side and reaches the
     second at a right angle too. Words are left from above or below (never through
     the line), elements from any side. Of the possible pairs of sides, the shortest
     one that leaves towards the other end and arrives from outside is used; that gives
     a straight arrow, an L, an S-bend between lines, or an arch over the line. */
  var PAD_FROM = 6, PAD_TO = 7;
  function sidesOf(P) {
    var f = P.lines[0], l = P.lines[P.lines.length - 1], b = P.box, out = [
      { s: 'top', p: [(f.left + f.right) / 2, f.top], n: [0, -1] },
      { s: 'bottom', p: [(l.left + l.right) / 2, l.bottom], n: [0, 1] }];
    if (!P.text) out.push({ s: 'left', p: [b.left, (b.top + b.bottom) / 2], n: [-1, 0] }, { s: 'right', p: [b.right, (b.top + b.bottom) / 2], n: [1, 0] });
    return out;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function route(PA, PB) {
    var best = null;
    sidesOf(PA).forEach(function (a) {
      sidesOf(PB).forEach(function (b) {
        var p0 = [a.p[0] + a.n[0] * PAD_FROM, a.p[1] + a.n[1] * PAD_FROM], p1 = [b.p[0] + b.n[0] * PAD_TO, b.p[1] + b.n[1] * PAD_TO];
        var v = [p1[0] - p0[0], p1[1] - p0[1]], len = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1;
        var da = a.n[0] * v[0] + a.n[1] * v[1], db = -(b.n[0] * v[0] + b.n[1] * v[1]);
        var pen = function (d) { return d > 4 ? 0 : 40 + Math.min(200, 4 - d) * 1.5; };
        var cost = len + pen(da) + pen(db) + (a.s === 'bottom' ? 3 : 0) + (b.s === 'bottom' ? 3 : 0);
        if (!best || cost < best.cost) best = { cost: cost, a: a, b: b, p0: p0, p1: p1, v: v, len: len, da: da, db: db };
      });
    });
    var r = best, ka, kb;
    if (r.a.n[0] * r.b.n[0] + r.a.n[1] * r.b.n[1] > 0.5) {
      /* both sides face the same way: an arch, higher on the side that is further back */
      var base = clamp(24 + r.len * 0.18, 28, 90), extra = r.a.n[0] * r.v[0] + r.a.n[1] * r.v[1];
      ka = base + Math.max(0, extra); kb = base + Math.max(0, -extra);
    } else {
      ka = clamp(Math.abs(r.da) * 0.55, 14, 150); kb = clamp(Math.abs(r.db) * 0.55, 14, 150);
      if (r.a.n[0] * r.b.n[0] + r.a.n[1] * r.b.n[1] > -0.5) { ka = Math.max(ka, 24); kb = Math.max(kb, 24); }   /* an L */
    }
    r.c1 = [r.p0[0] + r.a.n[0] * ka, r.p0[1] + r.a.n[1] * ka];
    r.c2 = [r.p1[0] + r.b.n[0] * kb, r.p1[1] + r.b.n[1] * kb];
    return r;
  }
  function rd(v) { return Math.round(v * 10) / 10; }
  function strokeAttrs(color) { return ' fill="none" stroke="' + color + '" stroke-linecap="round" stroke-linejoin="round"'; }
  function arrowSvg(PA, PB, color, dashed) {
    var r = route(PA, PB), p0 = r.p0, p1 = r.p1;
    var ang = Math.atan2(-r.b.n[1], -r.b.n[0]), hl = 13, spread = 0.5;   /* the head points straight in */
    var h1 = [p1[0] - hl * Math.cos(ang - spread), p1[1] - hl * Math.sin(ang - spread)], h2 = [p1[0] - hl * Math.cos(ang + spread), p1[1] - hl * Math.sin(ang + spread)];
    var dash = dashed ? ' stroke-dasharray="8 6"' : '', line = strokeAttrs(color);
    var boxes = function (P) { return P.lines.map(function (l) { return '<rect x="' + rd(l.left - 3) + '" y="' + rd(l.top - 3) + '" width="' + rd(l.width + 6) + '" height="' + rd(l.height + 6) + '" rx="6"' + line + ' stroke-width="2"' + dash + '/>'; }).join(''); };
    return '<g class="icw-arrow' + (dashed ? ' icw-preview' : '') + '" data-color="' + color + '" data-from="' + rd(p0[0]) + ',' + rd(p0[1]) + '" data-to="' + rd(p1[0]) + ',' + rd(p1[1]) + '" data-sides="' + r.a.s + '>' + r.b.s + '">' + boxes(PA) + boxes(PB) +
      '<path class="icw-line" d="M' + rd(p0[0]) + ',' + rd(p0[1]) + ' C' + rd(r.c1[0]) + ',' + rd(r.c1[1]) + ' ' + rd(r.c2[0]) + ',' + rd(r.c2[1]) + ' ' + rd(p1[0]) + ',' + rd(p1[1]) + '"' + line + ' stroke-width="3"' + dash + '/>' +
      '<path class="icw-head" d="M' + rd(h1[0]) + ',' + rd(h1[1]) + ' L' + rd(p1[0]) + ',' + rd(p1[1]) + ' L' + rd(h2[0]) + ',' + rd(h2[1]) + '"' + line + ' stroke-width="3"/></g>';
  }
  function markSvg(P, shape, color, dashed) {
    var dash = dashed ? ' stroke-dasharray="8 6"' : '', line = strokeAttrs(color), h = '';
    P.lines.forEach(function (l) {
      if (shape === 'line') {
        var y = l.bottom + 3;
        h += '<path d="M' + rd(l.left) + ',' + rd(y) + ' L' + rd(l.right) + ',' + rd(y) + '"' + line + ' stroke-width="3"' + dash + '/>';
      } else {
        var px = P.text ? 7 : 6, py = P.text ? 4 : 6, w = l.width + px * 2, ht = l.height + py * 2, rr = Math.min(ht / 2, P.text ? ht / 2 : 22);
        h += '<rect x="' + rd(l.left - px) + '" y="' + rd(l.top - py) + '" width="' + rd(w) + '" height="' + rd(ht) + '" rx="' + rd(rr) + '"' + line + ' stroke-width="2.5"' + dash + '/>';
      }
    });
    return '<g class="icw-mark' + (dashed ? ' icw-preview' : '') + '" data-shape="' + shape + '" data-color="' + color + '" data-lines="' + P.lines.length + '">' + h + '</g>';
  }
  var arrowsEl = null, arrowsSig = '';
  function frameArrows() {
    var html = '';
    S.marks.forEach(function (m) { var P = targetPlace(m.t); if (P) html += markSvg(P, m.s, m.c, false); });
    S.arrows.forEach(function (a) { var A = targetPlace(a.a), B = targetPlace(a.b); if (A && B) html += arrowSvg(A, B, a.c, false); });
    var m = S.arrowMode;
    if (m && m.step === 'b' && m.a) {
      var A = targetPlace(m.a), B = livePlace(m.since);
      if (A && B) html += arrowSvg(A, B, arrowColor(), true);
      else if (A) html += '<g class="icw-arrow icw-preview">' + A.lines.map(function (l) { return '<rect x="' + rd(l.left - 3) + '" y="' + rd(l.top - 3) + '" width="' + rd(l.width + 6) + '" height="' + rd(l.height + 6) + '" rx="6" fill="none" stroke="' + arrowColor() + '" stroke-width="2" stroke-dasharray="8 6"/>'; }).join('') + '</g>';
    }
    if (S.markMode) { var P = livePlace(S.markMode.since); if (P) html += markSvg(P, markShape(), markColor(), true); }
    if (html === arrowsSig) return;
    arrowsSig = html;
    if (!arrowsEl || !arrowsEl.isConnected) {
      ensureLayer();
      arrowsEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrowsEl.setAttribute('id', 'icw-arrows');
      arrowsEl.setAttribute('aria-hidden', 'true');
      layer.insertBefore(arrowsEl, layer.firstChild);
    }
    arrowsEl.innerHTML = html;
  }

  /* ══ THE TOOL BAR (host) ═════════════════════════════════════════════════
     At the bottom of the screen while a tool is in use: the steps of 🏹 and ⭕ with
     👍 and ❌, and the colours of the arrows, the marks and 🗣️. */
  var toolOpen = { arrow: false, say: false, mark: false };
  function toolDot(tool, color, open, title) {
    return '<button type="button" class="icw-tdot" data-tool="' + tool + '" style="background:' + color + '" aria-expanded="' + open + '" title="' + title + ': ' + esc(colorName(color)) + '" aria-label="' + title + '"></button>';
  }
  function renderTool() {
    var bar = $('icw-tool'), m = S.arrowMode, mk = S.markMode, saying = S.role === 'host' && S.say && S.say.from === 'me';
    if (!m && !mk && !saying) { if (bar) bar.hidden = true; toolOpen.arrow = toolOpen.say = toolOpen.mark = false; return; }
    injectStyles();
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'icw-tool'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Teacher tools');
      bar.setAttribute('data-dict', 'off');
      bar.addEventListener('click', onTool);
      document.body.appendChild(bar);
    }
    var h = '';
    if (m) {
      var ac = arrowColor(), okText = m.step === 'a' ? 'The arrow starts here' : 'The arrow ends here';
      h += '<div class="icw-trow"><span class="icw-ttext">🏹 ' + (m.step === 'a' ? '1. Highlight where the arrow starts.' : '2. Highlight where the arrow ends.') + '</span>' +
        '<button type="button" class="icw-ok" data-tool="ok" title="' + okText + '" aria-label="' + okText + '">👍</button>' +
        '<button type="button" data-tool="cancel" title="Cancel this arrow" aria-label="Cancel this arrow">❌</button>' +
        toolDot('arrow-colours', ac, toolOpen.arrow, 'Arrow colour') +
        (S.arrows.length && m.step === 'a' ? '<button type="button" data-tool="undo" title="Take away the last arrow" aria-label="Take away the last arrow">↩️</button><button type="button" data-tool="clear">Remove all arrows (' + S.arrows.length + ')</button>' : '') +
        '</div>' + (toolOpen.arrow ? grid('data-tool-c', 'arrow', ac) : '');
    }
    if (mk) {
      var mc = markColor(), sh = markShape();
      h += '<div class="icw-trow"><span class="icw-ttext">⭕ Highlight what to ' + (sh === 'line' ? 'underline' : 'circle') + '.</span>' +
        '<span class="icw-seg" role="group" aria-label="Shape">' +
        '<button type="button" data-tool="shape-circle" aria-pressed="' + (sh === 'circle') + '" title="Circle it">⭕ Circle</button>' +
        '<button type="button" data-tool="shape-line" aria-pressed="' + (sh === 'line') + '" title="Underline it"><u>Underline</u></button></span>' +
        '<button type="button" class="icw-ok" data-tool="mark-ok" title="Mark it" aria-label="Mark it">👍</button>' +
        '<button type="button" data-tool="mark-cancel" title="Cancel this mark" aria-label="Cancel this mark">❌</button>' +
        toolDot('mark-colours', mc, toolOpen.mark, 'Mark colour') +
        (S.marks.length ? '<button type="button" data-tool="mark-undo" title="Take away the last mark" aria-label="Take away the last mark">↩️</button><button type="button" data-tool="mark-clear">Remove all marks (' + S.marks.length + ')</button>' : '') +
        '</div>' + (toolOpen.mark ? grid('data-tool-c', 'mark', mc) : '');
    }
    if (saying) {
      var sc = S.say.c;
      h += '<div class="icw-trow"><span class="icw-ttext">🗣️ How to say it</span>' +
        '<button type="button" class="icw-tdot' + (sc ? '' : ' icw-default') + '" data-tool="say-colours" style="' + (sc ? 'background:' + sc : '') + '" aria-expanded="' + toolOpen.say + '" title="Colour of the marks: ' + (sc ? esc(colorName(sc)) : 'the usual colours') + '" aria-label="Colour of the marks">' + (sc ? '' : 'A') + '</button>' +
        '<button type="button" data-tool="say-hide">Hide</button></div>' + (toolOpen.say ? grid('data-tool-c', 'say', sc, true) : '');
    }
    bar.innerHTML = h;
    bar.hidden = false;
  }
  function onTool(e) {
    e.stopPropagation();
    var c = e.target.closest('[data-tool-c]');
    if (c) {
      var which = c.getAttribute('data-tool-c'), hex = c.dataset.c;
      if (which === 'arrow') { store('icwhatuc-arrow-color', hex); toolOpen.arrow = false; kick(); }
      else if (which === 'mark') { store('icwhatuc-mark-color', hex); toolOpen.mark = false; kick(); }
      else if (which === 'say' && S.say) {
        store('icwhatuc-say-color', hex || '');
        S.say.c = hex || '';
        S.actions.say({ sel: S.say.pieces, c: S.say.c });
        toolOpen.say = false;
        if (global.PronMark) buildSay();
      }
      renderTool();
      return;
    }
    var b = e.target.closest('[data-tool]');
    if (!b) return;
    var what = b.getAttribute('data-tool');
    if (what === 'ok') arrowOk();
    else if (what === 'cancel') arrowCancel();
    else if (what === 'arrow-colours') { toolOpen.arrow = !toolOpen.arrow; renderTool(); }
    else if (what === 'undo') { S.arrows.pop(); saveArrows(); renderTool(); }
    else if (what === 'clear') { S.arrows = []; saveArrows(); renderTool(); }
    else if (what === 'mark-ok') markOk();
    else if (what === 'mark-cancel') markCancel();
    else if (what === 'mark-colours') { toolOpen.mark = !toolOpen.mark; renderTool(); }
    else if (what === 'shape-circle' || what === 'shape-line') setShape(what === 'shape-line' ? 'line' : 'circle');
    else if (what === 'mark-undo') { S.marks.pop(); saveMarks(); renderTool(); }
    else if (what === 'mark-clear') { S.marks = []; saveMarks(); renderTool(); }
    else if (what === 'say-colours') { toolOpen.say = !toolOpen.say; renderTool(); }
    else if (what === 'say-hide') sayButton();
  }

  /* ══ HOW TO SAY IT (host only) ═══════════════════════════════════════════
     PronMark's marks over the selected words, on everyone's page. The page's own
     text is never touched: each selected line gets a see-through copy, in the same
     font, laid exactly over it in the layer, and PronMark marks the copy. The marks
     have a halo in the page colour, so they read clearly over the lines above and
     below. The copies follow scrolling, and are made again when the page changes. */
  var pronLoading = null;
  function loadScript(src) {
    return new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = HERE_DIR + src; s.onload = ok; s.onerror = function () { bad(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function pronEngines() {
    if (global.PronMark && global.HouseCharacter) return Promise.resolve();
    return pronLoading || (pronLoading = (global.HouseCharacter ? Promise.resolve() : loadScript('house-character.js'))
      .then(function () { return global.PronMark ? null : loadScript('pron-mark.js'); })
      .then(function () { return global.PRON_DICT_LOADED ? null : loadScript('pron-dict.js').catch(function () { return null; }); })
      .catch(function (e) { pronLoading = null; throw e; }));
  }
  function showSay(pieces, from, c) {
    clearSay();
    S.say = pieces && pieces.length ? { pieces: pieces, from: from || 'me', c: okColor(c) ? c.toLowerCase() : '', gen: -1, els: [], token: {} } : null;
    if (global.HouseRail) global.HouseRail.set('icwhatuc-say', !!(S.say && S.say.from === 'me'));
    titles(); renderTool();
    if (!S.say) return;
    var token = S.say.token;
    pronEngines().then(function () { if (S.say && S.say.token === token) buildSay(); }, function () {
      if (S.say && S.say.token === token) { toast('The pronunciation marks did not load.'); S.say = null; if (global.HouseRail) global.HouseRail.set('icwhatuc-say', false); }
    });
  }
  function clearSay() {
    if (!S.say) return;
    S.say.els.forEach(function (o) { try { if (global.PronMark) PronMark.unmark(o.el); } catch (e) { /* gone */ } o.el.remove(); });
    S.say.els = [];
  }
  function sayButton() {
    if (S.role !== 'host' || !S.room) return;
    if (S.say && S.say.from === 'me') { showSay(null); S.actions.say({ sel: null }); return; }
    var t = bringTarget();
    if (!t || !t.sel) { toast('First, select the words to say.'); return; }
    showSay(t.sel, 'me', store('icwhatuc-say-color'));
    S.actions.say({ sel: t.sel, c: S.say ? S.say.c : '' });
    if (!global.PronMark) toast('Loading the pronunciation marks…');
  }
  /* the [from, to) of a piece in its block's text, as rangeForPiece finds it */
  function pieceSpan(model, piece) {
    var nt = normText(model.text), at = -1;
    for (var i = 0; i <= piece.n; i++) { at = nt.t.indexOf(piece.w, at + 1); if (at === -1) return null; }
    return [nt.map[at], nt.map[at + piece.w.length - 1] + 1];
  }
  function charRect(model, T, at) {
    try { var r = T.rangeFor(model, at, at + 1), rs = r.getClientRects(); return rs[0] || r.getBoundingClientRect(); } catch (e) { return null; }
  }
  function buildSay() {
    var T = textApi();
    if (!T || !S.say) return;
    clearSay();
    ensureLayer();
    S.say.gen = gen; S.say.built = Date.now();
    S.say.pieces.forEach(function (piece) {
      var block = resolveKey(piece.k);
      if (!block) return;
      var model = T.textModel(block), span = pieceSpan(model, piece);
      if (!span) return;
      /* the words, grouped by the line they are on */
      var re = /\S+/g, m, lines = [], text = model.text;
      re.lastIndex = span[0];
      while ((m = re.exec(text)) && m.index < span[1]) {
        var a = m.index, b = Math.min(m.index + m[0].length, span[1]), r = charRect(model, T, a);
        if (!r) continue;
        var line = lines[lines.length - 1];
        if (line && Math.abs(r.top - line.top) < r.height / 2) line.to = b;
        else lines.push({ from: a, to: b, top: r.top });
      }
      lines.forEach(function (ln) {
        var part = null;
        for (var i = 0; i < model.parts.length; i++) if (ln.from >= model.parts[i].start && ln.from < model.parts[i].end) { part = model.parts[i]; break; }
        if (!part) return;
        var cs = getComputedStyle(part.node.parentElement);
        var el = document.createElement('div');
        el.className = 'icw-say';
        ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing', 'wordSpacing', 'textTransform', 'fontKerning', 'fontStretch'].forEach(function (k) { el.style[k] = cs[k]; });
        el.textContent = text.slice(ln.from, ln.to);
        layer.appendChild(el);
        var anchor = T.rangeFor(model, ln.from, ln.from + 1), ar = anchor.getClientRects()[0] || anchor.getBoundingClientRect();
        el.style.transform = 'translate(' + ar.left + 'px,' + ar.top + 'px)';
        var sc = S.say.c;
        if (sc) ['--pm-stress', '--pm-connected', '--pm-tune'].forEach(function (v) { el.style.setProperty(v, sc); });
        try { PronMark.mark(el, { colours: sc ? { stress: sc, connected: sc, intonation: sc } : null }); } catch (e) { el.remove(); return; }
        /* lay the copy's first letter exactly on the page's */
        var first = null, w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        while ((first = w.nextNode()) && !first.nodeValue.trim()) { /* the first letter */ }
        var dx = 0, dy = 0;
        if (first) {
          var fr = document.createRange(), off = first.nodeValue.search(/\S/);
          fr.setStart(first, off); fr.setEnd(first, off + 1);
          var cr = fr.getBoundingClientRect();
          dx = ar.left - cr.left; dy = ar.top - cr.top;
        }
        var o = { el: el, anchor: anchor, dx: dx, dy: dy, w: ar.width, h: ar.height };
        placeSay(o);
        S.say.els.push(o);
      });
    });
  }
  function placeSay(o) {
    var r = o.anchor.getClientRects()[0] || o.anchor.getBoundingClientRect();
    /* the letter has changed size (the 🔎 text size, a font loading): the copies are made again */
    if (Math.abs(r.width - o.w) > 0.5 || Math.abs(r.height - o.h) > 0.5) { if (S.say) S.say.resized = true; }
    o.el.hidden = !(r.width || r.height);
    o.el.style.transform = 'translate(' + (r.left + o.dx) + 'px,' + (r.top + o.dy) + 'px)';
  }
  function frameSay() {
    if (!S.say || !S.say.els) return;
    /* the page changed under the marks (a reflow, the text size): made again, at most a few times a second */
    if ((S.say.gen !== gen || S.say.resized) && Date.now() - (S.say.built || 0) > 300 && global.PronMark) { S.say.resized = false; buildSay(); return; }
    S.say.els.forEach(placeSay);
  }
  global.addEventListener('resize', function () { if (S.say) S.say.resized = true; });

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
    if ((S.arrowMode || S.markMode) && e.target && e.target.nodeType === 1 && !ours(e.target)) { var pe = ringTarget(e.target); if (pe) { S.mine.picked = { el: pe, t: Date.now() }; kick(); } }
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
    if (hasHL) Object.keys(hlRules).forEach(function (n) { try { CSS.highlights.delete(n); } catch (e) { /* gone */ } });
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
      if (list.length) { var c = hlName(v.color); (byColor[c] = byColor[c] || []).push.apply(byColor[c], list); }
    });
    Object.keys(hlRules).forEach(function (n) {
      try { if (byColor[n]) CSS.highlights.set(n, new Highlight(...byColor[n])); else CSS.highlights.delete(n); } catch (e) { /* no highlights */ }
    });
  }
  function place(node, r, pad) {
    node.style.transform = 'translate(' + Math.round(r.left - pad) + 'px,' + Math.round(r.top - pad) + 'px)';
    node.style.width = Math.round(r.width + pad * 2) + 'px';
    node.style.height = Math.round(r.height + pad * 2) + 'px';
  }
  function placeName(tag, r, name, color) {
    if (tag.textContent !== name) tag.textContent = name;
    tag.style.background = color; tag.style.color = ink(color);
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
    var saying = S.say && S.say.els && S.say.els.length && (S.say.from === v.id || (S.say.from === 'me' && v.id === 'me'));   /* the name would sit on the marks */
    if (selR && !saying && !(shown(ringR) && Math.abs(ringR.top - selR.top) < 4)) placeName(d.selTag, selR, v.name, v.color);
    else d.selTag.hidden = true;

    /* a bring: its own ring if it is not already ringed, and the "!" badge */
    var bringR = null;
    if (v.badge) {
      bringR = firstRect(v.bringRanges) || (v.bringEl && v.bringEl.isConnected ? v.bringEl.getBoundingClientRect() : null) || selR || ringR;
      var sameAsRing = shown(ringR) && v.bringEl === v.ringEl;
      if (v.bringEl && shown(bringR) && !sameAsRing && !v.bringRanges.length) { d.bring.hidden = false; d.bring.style.borderColor = v.color; place(d.bring, v.bringEl.getBoundingClientRect(), 5); }
      else d.bring.hidden = true;
      if (shown(bringR)) {
        d.badge.hidden = false; d.badge.style.background = v.color; d.badge.style.color = ink(v.color);
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
        nm.style.background = v.color; nm.style.color = ink(v.color);
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
      d.edge.style.background = v.color; d.edge.style.color = ink(v.color);
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
    frameSay();
    frameArrows();
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
     🤝 60 (from the loader) · 🖱️ 61 · 🖍️ 62 · 👀 63 · 📣 64 · host only: 🗣️ 65 · 🏹 66 · ⭕ 67 */
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
      if (S.role === 'host') R.add({ id: 'icwhatuc-say', icon: '🗣️', label: 'Show how to say the selected words', order: 65, pressed: !!(S.say && S.say.from === 'me'), onClick: function () { sayButton(); } });
      if (S.role === 'host') R.add({ id: 'icwhatuc-arrow', icon: '🏹', label: 'Draw an arrow between two highlights', order: 66, pressed: !!S.arrowMode, onClick: function () { arrowButton(); } });
      if (S.role === 'host') R.add({ id: 'icwhatuc-mark', icon: '⭕', label: 'Circle or underline a highlight', order: 67, pressed: !!S.markMode, onClick: function () { markButton(); } });
      titles();
    } else { ['icwhatuc-cur', 'icwhatuc-hl', 'icwhatuc-see', 'icwhatuc-bring', 'icwhatuc-say', 'icwhatuc-arrow', 'icwhatuc-mark'].forEach(function (id) { R.remove(id); }); closeChooser(); }
  }
  function titles() {
    var t = { 'icwhatuc-cur': prefs.cur ? 'Others see my cursor: on' : 'Others see my cursor: off',
      'icwhatuc-hl': prefs.hl ? 'Others see what I point at and select: on' : 'Others see what I point at and select: off',
      'icwhatuc-see': prefs.see ? 'I see the others: on' : 'I see the others: off',
      'icwhatuc-bring': S.role === 'host' ? 'Bring the others here: show them, or take them there' : 'Bring the others here',
      'icwhatuc-say': S.say && S.say.from === 'me' ? 'How to say it: shown to everyone. Press to hide' : 'How to say it: select some words, then press',
      'icwhatuc-arrow': S.arrowMode ? 'Arrow: press to stop' : 'Arrow: join two highlights with an arrow everyone sees',
      'icwhatuc-mark': S.markMode ? 'Circle or underline: press to stop' : 'Circle or underline: mark a highlight so everyone sees it' };
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
      if (e.target.id === 'icw-myname') { saveMyName(); return; }
      if (e.target.id !== 'icw-notify-on') return;
      if (!e.target.checked) { store(KEY.notify, 'no'); return; }
      if (Notification.permission === 'granted') store(KEY.notify, 'yes'); else askNotify(true);
    });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') openPanel(false);
      if (e.key === 'Enter' && e.target.id === 'icw-name') { var b = panel.querySelector('[data-do="start"], [data-do="join"]'); if (b) b.click(); }
      if (e.key === 'Enter' && e.target.id === 'icw-myname') saveMyName();
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
    if (!v) picking = null;
    panel.hidden = !v;
    if (v) { renderPanel(); placePanel(); var f = panel.querySelector('#icw-name'); if (f && !f.value) f.focus({ preventScroll: true }); }
  }
  function toggle() { ensurePanel(); openPanel(panel.hidden); }

  function nameField(optional) {
    var n = cleanName(S.own || store(KEY.name) || '');
    return '<label class="icw-label" for="icw-name">Your name' + (optional ? ' <span class="icw-small">(you can leave it empty)</span>' : '') + '</label>' +
      '<input id="icw-name" type="text" maxlength="24" autocomplete="given-name" placeholder="First name" value="' + esc(n) + '">';
  }
  /* in the session: my name, which can be typed or changed at any time */
  function myNameBox() {
    return '<label class="icw-label" for="icw-myname">Your name</label><div class="icw-row">' +
      '<input id="icw-myname" type="text" maxlength="24" autocomplete="given-name" placeholder="' + (S.role === 'host' ? 'First name' : 'First name (now: Me)') + '" value="' + esc(S.own) + '">' +
      '<button type="button" data-do="myname">OK</button></div>';
  }
  function resumeBox() {
    var r = hosting();
    if (!r) return '';
    return '<div class="icw-ask"><p>Your lesson is still on. Continue it on this page, with the same people.</p>' +
      '<div class="icw-row"><button type="button" class="icw-main" data-do="resume">Continue the lesson</button></div></div><p class="icw-small">Or start a new one:</p>';
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
  var picking = null;      /* whose colour swatches are open: 'me' or a person's id */
  function dot(id, color, name, mine) {
    var can = mine || S.role === 'host';
    if (!can) return '<span class="icw-dot" style="background:' + color + '"></span>';
    return '<button type="button" class="icw-dot icw-pick" data-pick="' + esc(id) + '" style="background:' + color + '" aria-expanded="' + (picking === id) + '" ' +
      'title="' + (mine ? 'Change your colour' : 'Change ' + esc(name) + '\'s colour') + '" aria-label="' + (mine ? 'Change your colour' : 'Change ' + esc(name) + '\'s colour') + '"></button>';
  }
  /* the 140 colours in a box that scrolls; attr names what a press changes */
  function grid(attr, value, current, withDefault) {
    return '<div class="icw-grid" role="group" aria-label="Colours">' +
      (withDefault ? '<button type="button" class="icw-swatch icw-default" ' + attr + '="' + esc(value) + '" data-c="" aria-pressed="' + !current + '" title="the usual colours" aria-label="the usual colours">A</button>' : '') +
      WEB.map(function (w) {
        return '<button type="button" class="icw-swatch" ' + attr + '="' + esc(value) + '" data-c="' + w.hex + '" style="background:' + w.hex + '" aria-pressed="' + (w.hex === current) + '" title="' + w.name + '" aria-label="' + w.name + '"></button>';
      }).join('') + '</div>';
  }
  function swatches(id, color) {
    if (picking !== id) return '';
    return '<li class="icw-swatches">' + grid('data-paint', id, color) + '<span class="icw-small">' + esc(colorName(color)) + '</span></li>';
  }
  function people() {
    var mine = S.color || COLORS[0];
    var me = '<li>' + dot('me', mine, S.name, true) + '<span class="icw-who">' + (S.own ? esc(S.own) + ' <span class="icw-small">(you' + (S.role === 'host' ? ', host' : '') + ')</span>' : 'Me' + (S.role === 'host' ? ' <span class="icw-small">(host)</span>' : '')) + '</span></li>' + swatches('me', mine);
    var list = named().sort(function (a, b) { return (here(b) - here(a)) || (b.host - a.host); });
    return '<ul class="icw-people">' + me + list.map(function (p) {
      var where = here(p) ? '' : '<br><span class="icw-small">on “' + esc(p.title) + '”</span>' + (p.path ? ' <button type="button" class="icw-mini" data-goto="' + esc(p.id) + '">Go there</button>' : '');
      var out = S.role === 'host' ? '<button type="button" class="icw-mini icw-out" data-out="' + esc(p.id) + '" title="Take ' + esc(p.name) + ' out of the session">Remove</button>' : '';
      return '<li>' + dot(p.id, p.color, p.name, false) + '<span class="icw-who">' + esc(p.name) + (p.host ? ' <span class="icw-small">(host)</span>' : '') + where + '</span>' + out + '</li>' + swatches(p.id, p.color);
    }).join('') + '</ul><p class="icw-small icw-hint">' + (S.role === 'host' ? 'Tap a colour dot to change that person\'s colour.' : 'Tap your colour dot to change it.') + '</p>';
  }
  function renderPanel() {
    clearInterval(ticker); ticker = 0;
    if (!panel || panel.hidden) return;
    var typing = document.activeElement, kept = typing && panel.contains(typing) && (typing.id === 'icw-myname' || typing.id === 'icw-name') ? { id: typing.id, v: typing.value, a: typing.selectionStart, b: typing.selectionEnd } : null;
    var h = '<div class="icw-head"><span>🤝 Work together</span><button type="button" class="icw-x" data-do="close" aria-label="Close">✕</button></div>';
    var st = S.status;
    if (st === 'idle' && invite) {
      h += notifyQuestion() + '<p>Someone invites you to work together on this page.</p>' + nameField(true) +
        '<div class="icw-row"><button type="button" class="icw-main" data-do="join">Join</button><button type="button" data-do="no">Not now</button></div>' + FIRST;
    } else if (st === 'idle') {
      h += notifyQuestion() + resumeBox() + '<p>Work together on this page.</p>' + nameField() +
        '<div class="icw-row"><button type="button" class="icw-main" data-do="start">Start</button></div>' + FIRST + relayBox();
    } else if (st === 'connecting') {
      h += '<p class="icw-status">Connecting…</p>';
    } else if (st === 'room') {
      var others = hereNow().length, away = named().length - others;
      if (S.role === 'host') {
        h += '<p>Invite people: send them this link.</p><input id="icw-link" type="text" readonly value="' + esc(linkNow()) + '">' +
          '<div class="icw-row"><button type="button" class="icw-main" data-do="copy">Copy link</button></div>';
      }
      h += people() + (S.role === 'host' && S.own ? '' : myNameBox());
      var waited = Math.round((Date.now() - S.joinedAt) / 1000);
      h += '<p class="icw-status" id="icw-status">' + (others ? 'You are together now.' : (away ? 'Nobody else is on this page.' :
        (waited >= 30 ? 'Nobody is here yet. Is your partner on this page?' : 'Waiting for your partner… ' + waited + ' s'))) + '</p>';
      if (S.role === 'host' && away) h += '<div class="icw-row"><button type="button" data-do="everyone">Bring everyone to this page</button></div>';
      if (S.note) h += '<p class="icw-small">' + esc(S.note) + '</p>';
      h += bringBox() + notifySwitch();
      h += '<p class="icw-small">' + (S.role === 'host' ? 'On the next page, send its link the same way: the students join it by themselves.' : 'On another lesson page, or from the next link, you join again by yourself.') + '</p>';
      h += '<div class="icw-row">' + (S.role === 'host' ? '<button type="button" data-do="end">End for everyone</button>' : '<button type="button" data-do="leave">Leave</button>') + '</div>';
      if (!others && !away && waited < 30) ticker = setInterval(function () { var e = $('icw-status'); if (!e || named().length) { renderPanel(); return; } var w = Math.round((Date.now() - S.joinedAt) / 1000); if (w >= 30) renderPanel(); else e.textContent = 'Waiting for your partner… ' + w + ' s'; }, 1000);
    } else if (st === 'ended') {
      h += '<p class="icw-status">' + esc(S.note || 'The session is over.') + '</p><div class="icw-row"><button type="button" class="icw-main" data-do="again">Start again</button></div>';
    } else if (st === 'error') {
      h += '<p class="icw-status icw-bad">' + esc(S.note) + '</p><div class="icw-row"><button type="button" class="icw-main" data-do="retry">Try again</button><button type="button" data-do="leave">Stop</button></div>';
    }
    panel.innerHTML = h;
    if (kept) { var f = $(kept.id); if (f) { f.value = kept.v; f.focus({ preventScroll: true }); try { f.setSelectionRange(kept.a, kept.b); } catch (e) { /* fine */ } } }
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
    var pk = e.target.closest('[data-pick]');
    if (pk) { picking = picking === pk.dataset.pick ? null : pk.dataset.pick; renderPanel(); return; }
    var sw = e.target.closest('[data-paint]');
    if (sw) { setColor(sw.dataset.paint, sw.dataset.c); picking = null; renderPanel(); return; }
    var t = e.target.closest('[data-goto], [data-out]');
    if (t && t.dataset.goto) { var gp = S.peers[t.dataset.goto]; if (gp && gp.path) go(gp.path); return; }
    if (t && t.dataset.out) { remove(t.dataset.out); return; }
    var b = e.target.closest('[data-do]');
    if (!b) return;
    var what = b.getAttribute('data-do');
    if (what === 'close') openPanel(false);
    else if (what === 'start') { var n = readName(); if (!n) return; saveRelay(); start({ name: n }); }
    else if (what === 'join') {
      var nf = $('icw-name'), m = cleanName(nf && nf.value);
      if (!invite) return;
      store(KEY.name, m);
      var i = invite; invite = null;
      enter({ room: i.room, key: i.key, role: 'learner', name: m, u: random(12) }, { fresh: true });
    }
    else if (what === 'myname') saveMyName();
    else if (what === 'resume') { var r = hosting(); if (r) enter({ room: r.room, key: r.key, role: 'host', name: r.name, cont: true }, { fresh: true }); }
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
      + '#icw-panel button.icw-pick{ width:15px; height:15px; padding:0; border:2px solid var(--surface-2, #fff); box-shadow:0 0 0 1px var(--border, #ccc); cursor:pointer; margin-top:2px; }'
      + '#icw-panel button.icw-pick[aria-expanded="true"]{ box-shadow:0 0 0 2px var(--text-primary, #1a1a1a); }'
      + '#icw-panel .icw-people li.icw-swatches{ display:block; padding:4px 0 6px 0; }'
      + '#icw-panel .icw-people li.icw-swatches .icw-grid{ width:100%; box-sizing:border-box; }'
      /* the 140 colours: a box that scrolls */
      + '.icw-grid{ display:grid; grid-template-columns:repeat(auto-fill, 24px); gap:5px; max-height:148px; overflow-y:auto; overscroll-behavior:contain; padding:5px; margin:2px 0 4px;'
      +   ' border:1px solid var(--border, #e3e3e6); border-radius:10px; background:var(--surface-1, #f7f7f8); }'
      + '.icw-grid button.icw-swatch{ width:24px; height:24px; padding:0; border-radius:50%; border:2px solid var(--surface-2, #fff); box-shadow:0 0 0 1px rgba(0,0,0,.18); cursor:pointer; }'
      + '.icw-grid button.icw-swatch[aria-pressed="true"]{ box-shadow:0 0 0 2px var(--text-primary, #1a1a1a); }'
      + '.icw-grid button.icw-default, #icw-tool button.icw-default{ background:var(--surface-2, #fff); color:var(--text-primary, #1a1a1a); font:700 11px/20px var(--font-sans, system-ui, sans-serif); }'
      + '#icw-arrows{ position:absolute; left:0; top:0; width:100%; height:100%; overflow:visible; filter:drop-shadow(0 0 1.5px var(--color-background-primary, #fff)) drop-shadow(0 0 1.5px var(--color-background-primary, #fff)); }'
      + '#icw-tool{ position:fixed; left:0; right:0; margin:0 auto; width:max-content; max-width:calc(100vw - 16px); bottom:64px; z-index:1105; box-sizing:border-box; padding:8px 10px;'
      +   ' border-radius:14px; background:var(--surface-2, #fff); color:var(--text-primary, #1a1a1a); border:1px solid var(--border, #e3e3e6); box-shadow:0 8px 24px rgba(0,0,0,.2);'
      +   ' font:600 13px/1.35 var(--font-sans, system-ui, sans-serif); }'
      + '#icw-tool[hidden]{ display:none; }'
      + '#icw-tool .icw-trow{ display:flex; flex-wrap:wrap; align-items:center; gap:6px; }'
      + '#icw-tool .icw-trow + .icw-trow, #icw-tool .icw-grid + .icw-trow{ margin-top:6px; padding-top:6px; border-top:1px solid var(--border, #e3e3e6); }'
      + '#icw-tool .icw-ttext{ flex:1 1 auto; min-width:0; margin-right:4px; }'
      + '#icw-tool button{ font:600 13px/1.2 var(--font-sans, system-ui, sans-serif); padding:6px 11px; border-radius:999px; border:1px solid var(--border, #e3e3e6); background:var(--surface-1, #f7f7f8); color:inherit; cursor:pointer; }'
      + '#icw-tool button.icw-ok{ font-size:16px; padding:4px 12px; }'
      + '#icw-tool .icw-seg{ display:inline-flex; }'
      + '#icw-tool .icw-seg button{ border-radius:0; }'
      + '#icw-tool .icw-seg button:first-child{ border-radius:999px 0 0 999px; }'
      + '#icw-tool .icw-seg button:last-child{ border-radius:0 999px 999px 0; border-left:none; }'
      + '#icw-tool button[aria-pressed="true"]{ background:var(--text-accent, #185fa5); color:#fff; border-color:var(--text-accent, #185fa5); }'
      + '#icw-tool button.icw-tdot{ width:26px; height:26px; padding:0; border-radius:50%; border:2px solid var(--surface-2, #fff); box-shadow:0 0 0 1px rgba(0,0,0,.25); }'
      + '#icw-tool .icw-grid{ max-width:min(520px, calc(100vw - 40px)); }'
      + '@media print{ #icw-tool{ display:none !important; } }'
      + '#icw-panel .icw-hint{ margin-top:-4px; }'
      /* the pronunciation copies: see-through text, PronMark's marks with a halo in the page colour */
      + '#icw-layer .icw-say{ position:absolute; left:0; top:0; white-space:pre; color:transparent !important; -webkit-text-stroke:0; line-height:normal; pointer-events:none; }'
      + '#icw-layer .icw-say svg{ filter:drop-shadow(0 0 1px var(--color-background-primary, #fff)) drop-shadow(0 0 1.5px var(--color-background-primary, #fff)) drop-shadow(0 0 2px var(--color-background-primary, #fff)); }'
      + 'html #icw-layer .icw-say .pm-v > svg, html #icw-layer .icw-say .pm-arrows{ display:block !important; }'
      + 'html #icw-layer .icw-say .pm-w::before{ display:inline-block !important; }'
      + '@media print{ #icw-layer, #icw-panel, #icw-bring, #icw-toast, #icw-follow{ display:none !important; } }';
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
      if (saved && saved.room === inv.room && saved.key === inv.key) { if (!(S.room && S.sess && S.sess.room === inv.room)) { saved.cont = true; enter(saved, { fresh: true }); } return; }
      var j = joinedBefore(inv);
      if (j) { enter({ room: inv.room, key: inv.key, role: 'learner', name: j.name || '', u: j.u, cont: true }, { fresh: true }); return; }
      invite = inv;
      openPanel(true);
      return;
    }
    /* in a session already: a reload, or the teacher typed the next page's address. Back into the session page too */
    if (first && saved && saved.room && saved.key && saved.role) { if (!HUB) saved.cont = true; enter(saved, { fresh: !HUB }); }
  }
  global.addEventListener('hashchange', function () { invited(false); });

  global.ICwhatUC = {
    toggle: toggle,
    open: function () { openPanel(true); },
    start: start,
    join: function (link, o) { var i = parseInvite(link); if (!i) return Promise.reject(new Error('not an ICwhatUC link')); return enter({ room: i.room, key: i.key, role: 'learner', name: cleanName((o && o.name) || store(KEY.name)), u: random(12) }); },
    leave: leave, end: end,
    peers: function () { return named().map(function (p) { var o = publicPeer(p); o.here = here(p); o.page = p.title; return o; }); },
    link: linkNow,
    status: function () { return S.status; },
    persistent: function () { return !!HUB; },
    showCursor: showCursor, showHighlights: showHighlights, seeOthers: seeOthers,
    canBring: canBring, bring: bring, everyoneHere: everyoneHere, remove: remove,
    setColor: setColor, colors: function () { return WEB.map(function (w) { return w.hex; }); },
    say: function () { sayButton(); return !!S.say; }, saying: function () { return !!S.say; },
    arrowTool: function () { arrowButton(); return S.arrowMode ? S.arrowMode.step : null; },
    arrowOk: function () { arrowOk(); return S.arrowMode ? S.arrowMode.step : null; }, arrowCancel: function () { arrowCancel(); },
    arrows: function () { return S.arrows.map(function (a) { return { id: a.id, c: a.c }; }); },
    markTool: function (shape) { if (!S.markMode) markButton(); if (S.markMode && shape) setShape(shape); return !!S.markMode; },
    markOk: function () { markOk(); return !!S.markMode; }, markCancel: function () { markCancel(); },
    marks: function () { return S.marks.map(function (m) { return { id: m.id, s: m.s, c: m.c }; }); },
    key: function (el, k) { if (k != null) { el.dataset.icwKey = k; gen++; return 'k:' + k; } return keyOf(el); },
    resolve: resolveKey,
    on: function (type, fn) { (S.listeners[type] = S.listeners[type] || []).push(fn); },
    send: function (type, data) { if (S.room) S.actions.x({ t: String(type), d: data }); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
