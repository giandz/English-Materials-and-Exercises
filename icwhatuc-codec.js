/* ══════════════════════════════════════════════════════════════════════════
   ICwhatUC CODEC — phase 0
   Turns the few facts two browsers must tell each other before a WebRTC link
   can form into a row of five-word animal phrases, and back again:

       seven sad blue dancing monkeys, two happy red flying birds, …

   One phrase = one word from each of five lists of 16 = 20 bits.
   Order: number · state · colour · action · animal (the usual English order).
   The numbers run from two to seventeen, so the animal is always plural.

   What a code carries (see pack / unpack):
       version, offer or answer, DTLS role
       the browser certificate's SHA-256 fingerprint      256 bits
       ICE user name and password                         about 31 + 152 bits
       up to three addresses (public, local network)      51 to 147 bits each
       a check phrase at the end (CRC-16 plus 4 more bits)

   The receiving side rebuilds a full session description from those fields
   (buildSdp). Nothing here touches the page: it runs in a browser and in Node.

     ICwhatUCCodec.encode(fields)        → 'seven sad blue dancing monkeys, …'
     ICwhatUCCodec.decode(text)          → fields            (throws CodeError)
     ICwhatUCCodec.parseSdp(sdp)         → fields found in a browser's own SDP
     ICwhatUCCodec.pickCandidates(list, { host, max })
     ICwhatUCCodec.buildSdp(fields, { mid })  → SDP text for setRemoteDescription
     ICwhatUCCodec.measure(text)         → { phrases, words, bits }

   fields = { type:'offer'|'answer', setup:'actpass'|'active'|'passive',
              fingerprint:'AA:BB:…' (32 bytes), ufrag, pwd,
              candidates:[{ kind:'v4'|'v6'|'mdns', typ:'host'|'srflx', address, port }] }

   THE WORD LISTS ARE FIXED. Both sides must agree on them, so changing a word
   or its place breaks every code. A new set needs a new VERSION.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var VERSION = 2;       /* 1 = four-word phrases (no number), never released */

  var LISTS = [
    /* number */ ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen'],
    /* state  */ ['happy', 'sad', 'tired', 'hungry', 'thirsty', 'angry', 'sleepy', 'busy', 'quiet', 'noisy', 'fast', 'slow', 'friendly', 'funny', 'clean', 'dirty'],
    /* colour */ ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'gold', 'silver', 'beige', 'violet', 'turquoise'],
    /* action */ ['flying', 'dancing', 'running', 'swimming', 'jumping', 'singing', 'sleeping', 'eating', 'walking', 'reading', 'cooking', 'smiling', 'laughing', 'playing', 'drawing', 'climbing'],
    /* animal */ ['tigers', 'birds', 'cats', 'dogs', 'fish', 'horses', 'cows', 'pigs', 'ducks', 'bears', 'lions', 'monkeys', 'rabbits', 'mice', 'sheep', 'frogs']
  ];
  var SLOTS = LISTS.length, PHRASE_BITS = SLOTS * 4;
  var SLOT_NAMES = ['number', 'feeling', 'colour', 'action', 'animal'];
  /* what a chat app or a person might change: a spelling, a figure for a number word, a singular animal */
  var ALIAS = { grey: 'gray', fishes: 'fish', mouse: 'mice', mouses: 'mice', sheeps: 'sheep' };
  LISTS[0].forEach(function (w, i) { ALIAS[String(i + 2)] = w; });
  LISTS[4].forEach(function (w) { if (/s$/.test(w)) ALIAS[w.slice(0, -1)] = w; });

  var INDEX = LISTS.map(function (list) {
    var m = {};
    list.forEach(function (w, i) { m[w] = i; });
    return m;
  });

  function CodeError(code, message, detail) {
    var e = new Error(message);
    e.name = 'CodeError';
    e.code = code;            /* 'empty' | 'incomplete' | 'word' | 'check' | 'version' | 'format' */
    e.detail = detail || null;
    return e;
  }

  /* ── bits ─────────────────────────────────────────────────────────────── */
  function Writer() { this.bits = []; }
  Writer.prototype.put = function (value, n) {
    for (var i = n - 1; i >= 0; i--) this.bits.push(Math.floor(value / Math.pow(2, i)) % 2);
  };
  Writer.prototype.bytes = function (arr) { for (var i = 0; i < arr.length; i++) this.put(arr[i], 8); };
  /* whole phrases only: the bits as 20-bit numbers, zero-filled at the end */
  Writer.prototype.toValues = function () {
    var b = this.bits.slice(), out = [];
    while (b.length % PHRASE_BITS) b.push(0);
    for (var i = 0; i < b.length; i += PHRASE_BITS) {
      var v = 0;
      for (var k = 0; k < PHRASE_BITS; k++) v = v * 2 + b[i + k];
      out.push(v);
    }
    return out;
  };

  function Reader(values) {
    this.bits = [];
    for (var i = 0; i < values.length; i++) for (var k = PHRASE_BITS - 1; k >= 0; k--) this.bits.push(Math.floor(values[i] / Math.pow(2, k)) % 2);
    this.pos = 0;
  }
  Reader.prototype.get = function (n) {
    if (this.pos + n > this.bits.length) throw CodeError('format', 'The code is too short for what it says it holds.');
    var v = 0;
    for (var i = 0; i < n; i++) v = v * 2 + this.bits[this.pos++];
    return v;
  };
  Reader.prototype.take = function (n) { var a = []; for (var i = 0; i < n; i++) a.push(this.get(8)); return a; };

  /* CRC-16/CCITT-FALSE */
  function crc16(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (var k = 0; k < 8; k++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc;
  }
  /* the last phrase: CRC-16 of every phrase before it, plus 4 bits of a plain sum, to fill its 20 bits */
  function checkOf(values) {
    var bytes = [], sum = values.length;
    values.forEach(function (v) { bytes.push(Math.floor(v / 65536), (v >> 8) & 255, v & 255); });
    bytes.forEach(function (b) { sum += b; });
    return (sum & 15) * 65536 + crc16(bytes);
  }

  /* ── short strings (ICE user name and password) ───────────────────────────
     Browsers write these as hex (Firefox) or in the base64 alphabet (Chrome,
     Safari). Packing by alphabet instead of as plain text saves 2 to 4 bits a
     letter, which is 4 or 5 phrases a code. */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var HEX = '0123456789abcdef';
  function putStr(w, s, lenBits) {
    var mode = /^[0-9a-f]+$/.test(s) ? 0 : (/^[A-Za-z0-9+\/]+$/.test(s) ? 1 : 2);
    if (s.length >= Math.pow(2, lenBits)) throw CodeError('format', 'A connection value is too long to put in a code.');
    w.put(mode, 2);
    w.put(s.length, lenBits);
    for (var i = 0; i < s.length; i++) {
      if (mode === 0) w.put(HEX.indexOf(s[i]), 4);
      else if (mode === 1) w.put(B64.indexOf(s[i]), 6);
      else {
        var c = s.charCodeAt(i);
        if (c > 255) throw CodeError('format', 'A connection value has a letter that cannot go in a code.');
        w.put(c, 8);
      }
    }
  }
  function getStr(r, lenBits) {
    var mode = r.get(2), len = r.get(lenBits), s = '';
    if (mode === 3) throw CodeError('format', 'The code has a part this page does not understand.');
    for (var i = 0; i < len; i++) {
      s += mode === 0 ? HEX[r.get(4)] : (mode === 1 ? B64[r.get(6)] : String.fromCharCode(r.get(8)));
    }
    return s;
  }

  /* ── addresses ────────────────────────────────────────────────────────── */
  var MDNS = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i;
  function v4Bytes(a) {
    var p = a.split('.').map(Number);
    if (p.length !== 4 || p.some(function (n) { return !(n >= 0 && n <= 255) || n !== Math.floor(n); })) return null;
    return p;
  }
  function v6Bytes(a) {
    a = a.replace(/%.*$/, '');                                   /* no zone id */
    if (!/^[0-9a-f:]+$/i.test(a) || a.indexOf(':') === -1) return null;
    var halves = a.split('::');
    if (halves.length > 2) return null;
    var head = halves[0] ? halves[0].split(':') : [];
    var tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    var fill = 8 - head.length - tail.length;
    if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
    var groups = head.concat(new Array(halves.length === 2 ? fill : 0).fill('0'), tail);
    var out = [];
    for (var i = 0; i < 8; i++) {
      if (!/^[0-9a-f]{1,4}$/i.test(groups[i])) return null;
      var n = parseInt(groups[i], 16);
      out.push(n >> 8, n & 255);
    }
    return out;
  }
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16); }
  function v6Text(b) {
    var g = [];
    for (var i = 0; i < 16; i += 2) g.push(((b[i] << 8) | b[i + 1]).toString(16));
    return g.join(':');
  }
  function addressKind(address) {
    if (v4Bytes(address)) return 'v4';
    if (MDNS.test(address)) return 'mdns';
    if (v6Bytes(address)) return 'v6';
    return null;
  }
  var KINDS = ['v4', 'v6', 'mdns'];
  function putCandidate(w, c) {
    var kind = KINDS.indexOf(c.kind);
    if (kind === -1) throw CodeError('format', 'An address of this kind cannot go in a code.');
    w.put(kind, 2);
    w.put(c.typ === 'srflx' ? 1 : 0, 1);
    if (c.kind === 'v4') w.bytes(v4Bytes(c.address));
    else if (c.kind === 'v6') w.bytes(v6Bytes(c.address));
    else {
      var h = c.address.toLowerCase().replace(/\.local$/, '').replace(/-/g, '');
      for (var i = 0; i < 32; i += 2) w.put(parseInt(h.substr(i, 2), 16), 8);
    }
    w.put(c.port, 16);
  }
  function getCandidate(r) {
    var kind = KINDS[r.get(2)], typ = r.get(1) ? 'srflx' : 'host', address;
    if (!kind) throw CodeError('format', 'The code has an address this page does not understand.');
    if (kind === 'v4') address = r.take(4).join('.');
    else if (kind === 'v6') address = v6Text(r.take(16));
    else {
      var h = r.take(16).map(hex2).join('');
      address = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20) + '.local';
    }
    return { kind: kind, typ: typ, address: address, port: r.get(16) };
  }

  /* ── fields ⇄ bytes ───────────────────────────────────────────────────── */
  var SETUPS = ['actpass', 'active', 'passive'];
  function fingerprintBytes(fp) {
    var b = String(fp).split(':').map(function (x) { return parseInt(x, 16); });
    if (b.length !== 32 || b.some(isNaN)) throw CodeError('format', 'This browser did not give a SHA-256 fingerprint.');
    return b;
  }
  function pack(f) {
    var w = new Writer();
    w.put(VERSION, 3);
    w.put(f.type === 'answer' ? 1 : 0, 1);
    w.put(Math.max(0, SETUPS.indexOf(f.setup)), 2);
    w.bytes(fingerprintBytes(f.fingerprint));
    putStr(w, f.ufrag, 5);
    putStr(w, f.pwd, 6);
    var cands = (f.candidates || []).slice(0, 3);
    w.put(cands.length, 2);
    cands.forEach(function (c) { putCandidate(w, c); });
    return w.toValues();
  }
  function unpack(values) {
    var r = new Reader(values);
    var version = r.get(3);
    if (version !== VERSION) throw CodeError('version', 'This code is from a different version of the page.', { version: version });
    var f = { type: r.get(1) ? 'answer' : 'offer', setup: SETUPS[r.get(2)] };
    if (!f.setup) throw CodeError('format', 'The code has a part this page does not understand.');
    f.fingerprint = r.take(32).map(function (n) { return hex2(n).toUpperCase(); }).join(':');
    f.ufrag = getStr(r, 5);
    f.pwd = getStr(r, 6);
    f.candidates = [];
    for (var n = r.get(2); n > 0; n--) f.candidates.push(getCandidate(r));
    return f;
  }

  /* ── 20-bit numbers ⇄ phrases ─────────────────────────────────────────── */
  function phrasesOf(values) {
    return values.map(function (v) {
      var w = [];
      for (var s = 0; s < SLOTS; s++) w.push(LISTS[s][Math.floor(v / Math.pow(16, SLOTS - 1 - s)) % 16]);
      return w.join(' ');
    });
  }
  /* commas, line breaks, capitals, list numbering with a dot, smart quotes: whatever a chat app did to it */
  function words(text) {
    return (String(text || '').toLowerCase().replace(/(^|\n)\s*\d+[.)]\s/g, '$1').match(/[a-z]+|\d+/g) || []).map(function (w) {
      return Object.prototype.hasOwnProperty.call(ALIAS, w) ? ALIAS[w] : w;
    });
  }
  function fromText(text) {
    var ws = words(text);
    if (!ws.length) throw CodeError('empty', 'There is no code here.');
    var values = [];
    for (var i = 0; i < ws.length; i += SLOTS) {
      var v = 0;
      for (var s = 0; s < SLOTS; s++) {
        var word = ws[i + s];
        if (word === undefined) throw CodeError('incomplete', 'This code is not complete. Copy it again.', { phrase: i / SLOTS + 1 });
        var n = INDEX[s][word];
        if (n === undefined) {
          throw CodeError('word', 'This code is not complete. Copy it again.',
            { phrase: i / SLOTS + 1, slot: SLOT_NAMES[s], word: word });
        }
        v = v * 16 + n;
      }
      values.push(v);
    }
    return values;
  }

  function encode(fields) {
    var values = pack(fields);
    var phrases = phrasesOf(values.concat([checkOf(values)]));
    var lines = [];
    for (var i = 0; i < phrases.length; i += 2) lines.push(phrases.slice(i, i + 2).join(', '));
    return lines.join(',\n');
  }
  function decode(text) {
    var values = fromText(text);
    if (values.length < 2) throw CodeError('incomplete', 'This code is not complete. Copy it again.');
    var body = values.slice(0, -1);
    if (checkOf(body) !== values[values.length - 1]) throw CodeError('check', 'This code is not complete. Copy it again.');
    return unpack(body);
  }
  function measure(text) {
    var n = words(text).length;
    return { words: n, phrases: Math.ceil(n / SLOTS), bits: n * 4 };
  }

  /* ── a browser's own SDP → fields ─────────────────────────────────────── */
  function parseSdp(sdp) {
    var line = function (re) { var m = String(sdp).match(re); return m ? m[1].trim() : null; };
    var f = {
      fingerprint: line(/^a=fingerprint:sha-256 (.+)$/mi),
      ufrag: line(/^a=ice-ufrag:(.+)$/m),
      pwd: line(/^a=ice-pwd:(.+)$/m),
      setup: line(/^a=setup:(.+)$/m),
      mid: line(/^a=mid:(.+)$/m),
      candidates: []
    };
    var re = /^a=candidate:(\S+) (\d+) (\S+) (\d+) (\S+) (\d+) typ (\S+)/gm, m;
    while ((m = re.exec(sdp))) {
      if (m[2] !== '1' || m[3].toLowerCase() !== 'udp') continue;       /* RTP component, UDP only */
      var kind = addressKind(m[5]);
      if (!kind || (m[7] !== 'host' && m[7] !== 'srflx')) continue;
      f.candidates.push({ kind: kind, typ: m[7], address: m[5], port: +m[6], priority: +m[4] });
    }
    return f;
  }

  /* Which addresses go in the code. The public one (from the single address
     lookup) reaches people in other places; a local-network one reaches people
     on the same Wi-Fi, where the public one often does not. Shortest first
     within each kind, because every address costs phrases. */
  function pickCandidates(list, opts) {
    opts = opts || {};
    var max = opts.max == null ? 2 : opts.max;
    var cost = { v4: 0, mdns: 1, v6: 2 };
    var by = function (typ) {
      return list.filter(function (c) { return c.typ === typ; })
        .sort(function (a, b) { return cost[a.kind] - cost[b.kind] || b.priority - a.priority; });
    };
    var out = [], pub = by('srflx'), loc = by('host');
    if (pub[0]) out.push(pub[0]);
    if (opts.host !== false || !out.length) { if (loc[0]) out.push(loc[0]); }
    return out.slice(0, max).map(function (c) { return { kind: c.kind, typ: c.typ, address: c.address, port: c.port }; });
  }

  /* ── fields → SDP for setRemoteDescription ────────────────────────────── */
  function buildSdp(f, opts) {
    opts = opts || {};
    var mid = opts.mid == null ? '0' : String(opts.mid);
    var lines = [
      'v=0',
      'o=- ' + (opts.sessionId || '4611731400430051336') + ' 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'a=group:BUNDLE ' + mid,
      'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:' + f.ufrag,
      'a=ice-pwd:' + f.pwd,
      'a=ice-options:trickle',
      'a=fingerprint:sha-256 ' + f.fingerprint,
      'a=setup:' + (f.type === 'offer' ? 'actpass' : (f.setup === 'passive' ? 'passive' : 'active')),
      'a=mid:' + mid,
      'a=sctp-port:5000',
      'a=max-message-size:262144'
    ];
    (f.candidates || []).forEach(function (c, i) {
      var host = c.typ === 'host';
      lines.push('a=candidate:' + (i + 1) + ' 1 udp ' + (host ? 2122260223 - i : 1686052607 - i) + ' ' + c.address + ' ' + c.port +
        ' typ ' + c.typ + (host ? '' : ' raddr ' + (c.kind === 'v6' ? '::' : '0.0.0.0') + ' rport 0'));
    });
    lines.push('a=end-of-candidates');
    return lines.join('\r\n') + '\r\n';
  }

  var api = {
    VERSION: VERSION, LISTS: LISTS,
    encode: encode, decode: decode, measure: measure,
    parseSdp: parseSdp, pickCandidates: pickCandidates, buildSdp: buildSdp,
    addressKind: addressKind, phrasesOf: phrasesOf, checkOf: checkOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ICwhatUCCodec = api;
})(typeof window !== 'undefined' ? window : this);
