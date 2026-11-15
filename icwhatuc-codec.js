/* ══════════════════════════════════════════════════════════════════════════
   ICwhatUC CODEC — phase 0
   Packs the few facts two browsers must tell each other before a WebRTC link
   can form into one short base64 string, and back again:

       YFt4vwZV94uJRO6xvPM_RhsFNdy4X2QaJMJD8KFY0KEsGQgQXk3-…

   The string uses the URL-safe base64 letters (A-Z a-z 0-9 - _), so it has no
   spaces and nothing a chat app turns into a link or an emoji. About 90
   letters with one address, about 115 with two.

   A RELAY ADDRESS is one the host's browser was lent by a TURN server. It goes
   in the host's code like any other address; the learner needs no relay
   settings. The browsers still try the direct addresses first.

   What a code carries (see pack / unpack):
       version, and whose code it is (host or learner)
       the browser certificate's SHA-256 fingerprint      256 bits
       ICE user name and password                         about 31 + 152 bits
       up to four addresses (public, local network,       52 to 148 bits each
         and a relay when the host has one)
       a CRC-16 at the end, so a cut or changed code is refused

   BOTH CODES ARE MADE THE SAME WAY, each from the browser's own offer, and
   neither depends on the other. Nothing starts until a person presses Connect:
   only then does each side hand the other's facts to WebRTC, rebuilt as an
   answer (buildSdp). The host takes the DTLS client role and the learner the
   server role, so the two rebuilt answers agree.

     ICwhatUCCodec.encode(fields)        → 'YFt4vwZV94uJ…'
     ICwhatUCCodec.decode(text)          → fields            (throws CodeError)
     ICwhatUCCodec.parseSdp(sdp)         → fields found in a browser's own SDP
     ICwhatUCCodec.pickCandidates(list, { max })
     ICwhatUCCodec.buildSdp(fields, { mid, role })  → SDP for setRemoteDescription
                                           role = MY role: 'host' | 'learner'

   fields = { role:'host'|'learner', fingerprint:'AA:BB:…' (32 bytes), ufrag, pwd,
              candidates:[{ kind:'v4'|'v6'|'mdns', typ:'host'|'srflx'|'relay', address, port }] }
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var VERSION = 4;       /* 1, 2 = word-phrase codes; 3 = no relay addresses; none released */

  function CodeError(code, message, detail) {
    var e = new Error(message);
    e.name = 'CodeError';
    e.code = code;            /* 'empty' | 'incomplete' | 'check' | 'version' | 'format' */
    e.detail = detail || null;
    return e;
  }

  /* ── bits ─────────────────────────────────────────────────────────────── */
  function Writer() { this.bits = []; }
  Writer.prototype.put = function (value, n) {
    for (var i = n - 1; i >= 0; i--) this.bits.push(Math.floor(value / Math.pow(2, i)) % 2);
  };
  Writer.prototype.bytes = function (arr) { for (var i = 0; i < arr.length; i++) this.put(arr[i], 8); };
  Writer.prototype.toBytes = function () {
    var b = this.bits.slice(), out = [];
    while (b.length % 8) b.push(0);
    for (var i = 0; i < b.length; i += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = v * 2 + b[i + k];
      out.push(v);
    }
    return out;
  };

  function Reader(bytes) { this.bytes = bytes; this.pos = 0; }
  Reader.prototype.get = function (n) {
    var v = 0;
    for (var i = 0; i < n; i++) {
      var byte = this.bytes[this.pos >> 3];
      if (byte === undefined) throw CodeError('format', 'The code is too short for what it says it holds.');
      v = v * 2 + ((byte >> (7 - (this.pos & 7))) & 1);
      this.pos++;
    }
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

  /* ── base64, URL-safe, no padding ─────────────────────────────────────── */
  var B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function toBase64(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
      out += B64URL[a >> 2] + B64URL[((a & 3) << 4) | ((b || 0) >> 4)];
      if (b !== undefined) out += B64URL[((b & 15) << 2) | ((c || 0) >> 6)];
      if (c !== undefined) out += B64URL[c & 63];
    }
    return out;
  }
  /* Forgiving on the way in: spaces and line breaks a chat app added, quotes
     round the code, the ordinary + and / letters, and = padding are all fine. */
  function clean(text) {
    return String(text || '').replace(/\s+/g, '').replace(/^["'“”‘’`<]+|["'“”‘’`>.,]+$/g, '')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) {
      throw CodeError('incomplete', 'This code is not complete. Copy it again.');
    }
    var bytes = [];
    for (var i = 0; i < s.length; i += 4) {
      var n = [0, 1, 2, 3].map(function (k) { return s[i + k] === undefined ? -1 : B64URL.indexOf(s[i + k]); });
      bytes.push((n[0] << 2) | (n[1] >> 4));
      if (n[2] >= 0) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2));
      if (n[3] >= 0) bytes.push(((n[2] & 3) << 6) | n[3]);
    }
    return bytes;
  }

  /* ── short strings (ICE user name and password) ───────────────────────────
     Browsers write these as hex (Firefox) or in the base64 alphabet (Chrome,
     Safari). Packing by alphabet instead of as plain text keeps the code short. */
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
  var KINDS = ['v4', 'v6', 'mdns'], TYPS = ['host', 'srflx', 'relay'];
  function putCandidate(w, c) {
    var kind = KINDS.indexOf(c.kind);
    if (kind === -1) throw CodeError('format', 'An address of this kind cannot go in a code.');
    w.put(kind, 2);
    w.put(Math.max(0, TYPS.indexOf(c.typ)), 2);
    if (c.kind === 'v4') w.bytes(v4Bytes(c.address));
    else if (c.kind === 'v6') w.bytes(v6Bytes(c.address));
    else {
      var h = c.address.toLowerCase().replace(/\.local$/, '').replace(/-/g, '');
      for (var i = 0; i < 32; i += 2) w.put(parseInt(h.substr(i, 2), 16), 8);
    }
    w.put(c.port, 16);
  }
  function getCandidate(r) {
    var kind = KINDS[r.get(2)], typ = TYPS[r.get(2)], address;
    if (!kind || !typ) throw CodeError('format', 'The code has an address this page does not understand.');
    if (kind === 'v4') address = r.take(4).join('.');
    else if (kind === 'v6') address = v6Text(r.take(16));
    else {
      var h = r.take(16).map(hex2).join('');
      address = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20) + '.local';
    }
    return { kind: kind, typ: typ, address: address, port: r.get(16) };
  }

  /* ── fields ⇄ bytes ───────────────────────────────────────────────────── */
  function fingerprintBytes(fp) {
    var b = String(fp).split(':').map(function (x) { return parseInt(x, 16); });
    if (b.length !== 32 || b.some(isNaN)) throw CodeError('format', 'This browser did not give a SHA-256 fingerprint.');
    return b;
  }
  function pack(f) {
    var w = new Writer();
    w.put(VERSION, 3);
    w.put(f.role === 'learner' ? 1 : 0, 1);
    w.bytes(fingerprintBytes(f.fingerprint));
    putStr(w, f.ufrag, 5);
    putStr(w, f.pwd, 6);
    var cands = (f.candidates || []).slice(0, 4);
    w.put(cands.length, 3);
    cands.forEach(function (c) { putCandidate(w, c); });
    return w.toBytes();
  }
  function unpack(bytes) {
    var r = new Reader(bytes);
    var version = r.get(3);
    if (version !== VERSION) throw CodeError('version', 'This code is from a different version of the page.', { version: version });
    var f = { role: r.get(1) ? 'learner' : 'host' };
    f.fingerprint = r.take(32).map(function (n) { return hex2(n).toUpperCase(); }).join(':');
    f.ufrag = getStr(r, 5);
    f.pwd = getStr(r, 6);
    f.candidates = [];
    for (var n = r.get(3); n > 0; n--) f.candidates.push(getCandidate(r));
    return f;
  }

  function encode(fields) {
    var bytes = pack(fields), crc = crc16(bytes);
    return toBase64(bytes.concat([crc >> 8, crc & 255]));
  }
  function decode(text) {
    var s = clean(text);
    if (!s) throw CodeError('empty', 'There is no code here.');
    var bytes = fromBase64(s);
    if (bytes.length < 4) throw CodeError('incomplete', 'This code is not complete. Copy it again.');
    var body = bytes.slice(0, -2), crc = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
    if (crc16(body) !== crc) throw CodeError('check', 'This code is not complete. Copy it again.');
    return unpack(body);
  }

  /* ── a browser's own SDP → fields ─────────────────────────────────────── */
  function parseSdp(sdp) {
    var line = function (re) { var m = String(sdp).match(re); return m ? m[1].trim() : null; };
    var f = {
      fingerprint: line(/^a=fingerprint:sha-256 (.+)$/mi),
      ufrag: line(/^a=ice-ufrag:(.+)$/m),
      pwd: line(/^a=ice-pwd:(.+)$/m),
      mid: line(/^a=mid:(.+)$/m),
      candidates: []
    };
    var re = /^a=candidate:(\S+) (\d+) (\S+) (\d+) (\S+) (\d+) typ (\S+)/gm, m;
    while ((m = re.exec(sdp))) {
      if (m[2] !== '1' || m[3].toLowerCase() !== 'udp') continue;       /* RTP component, UDP only */
      var kind = addressKind(m[5]);
      if (!kind || TYPS.indexOf(m[7]) === -1) continue;
      f.candidates.push({ kind: kind, typ: m[7], address: m[5], port: +m[6], priority: +m[4] });
    }
    return f;
  }

  /* Which addresses go in the code, four at most: the public one (from the
     single address lookup) reaches people in other places; a local-network one
     reaches people on the same Wi-Fi, where the public one often does not; a
     relay one, when the host has a relay, reaches people the others cannot;
     and a second public one of the other family (IPv4 / IPv6) if there is room. */
  function pickCandidates(list, opts) {
    var max = opts && opts.max != null ? opts.max : 4;
    var cost = { v4: 0, mdns: 1, v6: 2 };
    var by = function (typ) {
      return list.filter(function (c) { return c.typ === typ; })
        .sort(function (a, b) { return cost[a.kind] - cost[b.kind] || b.priority - a.priority; });
    };
    var pub = by('srflx'), loc = by('host'), rel = by('relay'), out = [];
    if (pub[0]) out.push(pub[0]);
    if (loc[0]) out.push(loc[0]);
    if (rel[0]) out.push(rel[0]);
    var other = pub.filter(function (c) { return pub[0] && c.kind !== pub[0].kind; })[0];
    if (other) out.push(other);
    return out.slice(0, max).map(function (c) { return { kind: c.kind, typ: c.typ, address: c.address, port: c.port }; });
  }

  /* ── fields → SDP for setRemoteDescription ────────────────────────────────
     Always an answer to my own offer. opts.role is MY role: the host hears the
     learner say "passive" and so becomes the DTLS client; the learner hears the
     host say "active" and becomes the server. */
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
      'a=setup:' + (opts.role === 'host' ? 'passive' : 'active'),
      'a=mid:' + mid,
      'a=sctp-port:5000',
      'a=max-message-size:262144'
    ];
    (f.candidates || []).forEach(function (c, i) {
      var host = c.typ === 'host';
      /* the usual priorities: local first, then public, the relay last */
      var priority = (host ? 2122260223 : (c.typ === 'relay' ? 41885439 : 1686052607)) - i;
      lines.push('a=candidate:' + (i + 1) + ' 1 udp ' + priority + ' ' + c.address + ' ' + c.port +
        ' typ ' + c.typ + (host ? '' : ' raddr ' + (c.kind === 'v6' ? '::' : '0.0.0.0') + ' rport 0'));
    });
    lines.push('a=end-of-candidates');
    return lines.join('\r\n') + '\r\n';
  }

  var api = {
    VERSION: VERSION,
    encode: encode, decode: decode,
    parseSdp: parseSdp, pickCandidates: pickCandidates, buildSdp: buildSdp,
    addressKind: addressKind, crc16: crc16
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ICwhatUCCodec = api;
})(typeof window !== 'undefined' ? window : this);
