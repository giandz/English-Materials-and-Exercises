/* ══════════════════════════════════════════════════════════════════════════
   house-flow.js — HouseFlow: cause → decision → consequence flowcharts for
   conditionals, drawn inside a house thought bubble (or on their own).

       ┌──────────────┐        ◇ ✔️ ──▶ ┌──────────────┐
       │ you heat ice │ ─────▶ ◇           │ it melts     │
       └──────────────┘        ◇ ❌ ──▶ ┌──────────────┐
                                           │ it stays ice │

   The cause node is the if-clause. The diamond splits in two: the ✔️ half
   (top) is what happens when the cause happens, the ❌ half (bottom) when it
   doesn't. Each half leads to one or more consequence nodes.

   The part of the flow the speaker is talking about is highlighted:
     · the cause node and its connector ............ blue
     · the ✔️ half, its connector and consequence ... green
     · the ❌ half, its connector and consequence ... red
   A consequence with a modal (might, may, could, will probably…) carries a
   percentage, `p` from 0 to 1, shown on the node. Its path is coloured by
   that percentage instead, rotating the hue from red (0%) to green (100%):
   hue = 120 × p.

   Load it after house.js (it uses HouseThink for the bubble):
     <script src="house.js"></script>
     <script src="house-flow.js"></script>

   The spec:
     {
       cause: { text:'you heat ice', icon:'🔥', when:'past' },     // when: optional time tag (mixed conditionals)
       yes:   [{ text:'it melts', icon:'💧', p:0.5, when:'now' }],  // or one object; p only for modals
       no:    [{ text:'it stays solid', icon:'🧊' }],
       say:   { branch:'yes', item:0 },   // what the speaker says; item may be an array; 'yes' / 'no' = item 0.
                                          // Leave out: nothing is highlighted.
       real:  'no',                       // optional: 📍 on the branch that really happened (2nd / 3rd / mixed)
       label: 'Ana thinks'                // optional: the bubble's accessible name
     }

     HouseFlow.svg(spec)            → the flowchart, an <svg> string
     HouseFlow.html(spec)           → the flowchart in a house thought bubble (HouseThink.html)
     HouseFlow.render(el, spec)     → puts the flowchart into an element
     HouseFlow.hue(p, branch)       → the hue used for a path
     HouseFlow.quiz({ container, items:[{ sentence, flow, answer:{branch, item} }], scoreEl, totalEl })
         Controlled practice: read the sentence, tap the consequence it talks
         about. Right: the whole path lights up. Wrong: the node shakes red.
     HouseFlow.legend()             → a small key (blue / green / red, and the % scale), an HTML string

   Styles are self-injected; text is in SVG units, and the drawing is sized
   in rem, so the 🔎 slider scales it.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'house-flow-styles';
  var CSS = ''
    + '.hf{ display:block; width:min(31rem, calc(100vw - 6rem)); max-width:100%; height:auto; overflow:visible; font-family:inherit; }'
    + '.think-cloud .hf{ width:min(31rem, calc(100vw - 8rem)); }'
    + '.hf .hf-box{ fill:var(--surface-1); stroke:var(--color-border-secondary); stroke-width:1.5; }'
    + '.hf .hf-dia{ fill:var(--surface-1); stroke:var(--color-border-secondary); stroke-width:1.5; }'
    + '.hf .hf-t{ fill:var(--text-secondary); font-size:13px; }'
    + '.hf .hf-when{ fill:var(--text-muted); font-size:9.5px; font-weight:700; letter-spacing:.08em; }'
    + '.hf .hf-pct{ font-size:12px; font-weight:800; }'
    + '.hf .hf-mark{ font-size:15px; }'
    + '.hf .hf-line{ fill:none; stroke:var(--color-border-secondary); stroke-width:2; }'
    + '.hf .hf-head{ fill:var(--color-border-secondary); }'
    /* highlighted: --hf-h is the hue */
    + '.hf .hf-on .hf-box, .hf .hf-on.hf-dia{ fill:hsla(var(--hf-h), 75%, 50%, .15); stroke:hsl(var(--hf-h), 70%, 42%); stroke-width:2.5; }'
    + '.hf .hf-on .hf-t{ fill:hsl(var(--hf-h), 70%, 30%); font-weight:600; }'
    + '.hf .hf-on.hf-line{ stroke:hsl(var(--hf-h), 70%, 42%); stroke-width:3; }'
    + '.hf .hf-on.hf-head{ fill:hsl(var(--hf-h), 70%, 42%); }'
    + '[data-theme="dark"] .hf .hf-on .hf-box, [data-theme="dark"] .hf .hf-on.hf-dia{ fill:hsla(var(--hf-h), 70%, 55%, .18); stroke:hsl(var(--hf-h), 70%, 60%); }'
    + '[data-theme="dark"] .hf .hf-on .hf-t{ fill:hsl(var(--hf-h), 75%, 75%); }'
    + '[data-theme="dark"] .hf .hf-on.hf-line, [data-theme="dark"] .hf .hf-on.hf-head{ stroke:hsl(var(--hf-h), 70%, 60%); }'
    + '[data-theme="dark"] .hf .hf-on.hf-head{ fill:hsl(var(--hf-h), 70%, 60%); }'
    /* quiz */
    + '.hf-quiz-item{ border:1px solid var(--color-border-tertiary); border-radius:var(--border-radius-lg); background:var(--surface-2); padding:10px 12px; margin-bottom:12px; }'
    + '.hf-quiz-item.correct{ border-color:var(--good); background:var(--good-bg); }'
    + '.hf-quiz-sentence{ font-size:1rem; font-weight:600; margin-bottom:6px; }'
    + '.hf-quiz-hint{ font-size:.8rem; color:var(--text-secondary); margin-bottom:6px; }'
    + '.hf-quiz-item .hf-pick{ cursor:pointer; }'
    + '.hf-quiz-item .hf-pick:hover .hf-box{ stroke:var(--text-accent); stroke-width:2.5; }'
    + '.hf-quiz-item.correct .hf-pick{ cursor:default; }'
    + '.hf .hf-wrong .hf-box{ fill:var(--bad-bg); stroke:var(--bad); stroke-width:2.5; }'
    + '.hf .hf-wrong{ animation:hf-shake .3s; }'
    + '@keyframes hf-shake{ 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(-4px); } 75%{ transform:translateX(4px); } }'
    + '.hf-quiz-fb{ font-size:.8667rem; min-height:1.2em; margin-top:4px; }'
    + '.hf-quiz-fb.ok{ color:var(--good); font-weight:600; }'
    + '.hf-quiz-fb.no{ color:var(--bad); }'
    /* legend */
    + '.hf-legend{ display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center; font-size:.8rem; color:var(--text-secondary); margin:0 0 .8rem; }'
    + '.hf-legend .sw{ display:inline-block; width:.9em; height:.9em; border-radius:3px; vertical-align:-.1em; margin-right:4px; border:2px solid; }'
    + '.hf-legend .scale{ display:inline-block; width:7rem; height:.7em; border-radius:999px; vertical-align:middle; margin:0 4px;'
    +   ' background:linear-gradient(90deg, hsl(0,70%,45%), hsl(60,70%,45%), hsl(120,70%,40%)); }';

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function list(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }

  var BLUE = 217;
  function hue(p, branch) {
    if (typeof p === 'number') return Math.round(120 * Math.max(0, Math.min(1, p)));
    return branch === 'no' ? 0 : 120;
  }

  /* text wrapping by an estimate of the character width (13px text ≈ 7px a character) */
  function wrap(text, max) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  var CAUSE_W = 150, GAP1 = 30, D = 32, GAP2 = 28, OUT_W = 178, PAD = 8, LINE_H = 16, VGAP = 10;

  function nodeSize(n, w) {
    var room = w - 18 - (typeof n.p === 'number' ? 34 : 0);
    var lines = wrap((n.icon ? n.icon + ' ' : '') + n.text, Math.max(8, Math.floor(room / 7)));
    var h = 12 + lines.length * LINE_H + (n.when ? 12 : 0);
    return { lines: lines, h: Math.max(38, h) };
  }

  function sayOf(spec) {
    var s = spec.say;
    if (!s) return null;
    if (typeof s === 'string') return { branch: s, items: [0] };
    var items = s.item == null ? [0] : list(s.item);
    return { branch: s.branch, items: items };
  }

  /* one node: a rounded box, its lines, an optional time tag, % and 📍 */
  function nodeSvg(n, x, y, w, size, opts) {
    var o = opts || {}, g = '';
    var cls = 'hf-node' + (o.on ? ' hf-on' : '') + (o.pick ? ' hf-pick' : '');
    g += '<g class="' + cls + '" style="--hf-h:' + o.h + '"' + (o.data || '') + '>';
    g += '<rect class="hf-box" x="' + x + '" y="' + y + '" width="' + w + '" height="' + size.h + '" rx="10"/>';
    var ty = y + 6 + (n.when ? 12 : 0) + (size.h - 12 - (n.when ? 12 : 0) - size.lines.length * LINE_H) / 2 + 12;
    if (n.when) g += '<text class="hf-when" x="' + (x + 9) + '" y="' + (y + 14) + '">' + esc(String(n.when).toUpperCase()) + '</text>';
    size.lines.forEach(function (l, i) {
      g += '<text class="hf-t" x="' + (x + 9) + '" y="' + (ty + i * LINE_H) + '">' + esc(l) + '</text>';
    });
    if (typeof n.p === 'number') {
      var ph = hue(n.p);
      g += '<text class="hf-pct" x="' + (x + w - 7) + '" y="' + (y + 17) + '" text-anchor="end" style="fill:hsl(' + ph + ',70%,40%)">' + Math.round(n.p * 100) + '%</text>';
    }
    if (o.real) g += '<text class="hf-mark" x="' + (x - 7) + '" y="' + (y + 8) + '" aria-label="what really happened">📍</text>';
    g += '</g>';
    return g;
  }

  function arrow(x, y, h, on, extraCls) {
    return '<polygon class="hf-head' + (on ? ' hf-on' : '') + (extraCls || '') + '" style="--hf-h:' + h + '" points="' +
      x + ',' + y + ' ' + (x - 8) + ',' + (y - 5) + ' ' + (x - 8) + ',' + (y + 5) + '"/>';
  }

  /* the drawing. quiz: outcome nodes are tappable, and the highlight comes from `say` like everywhere else */
  function svg(spec, quizMode) {
    injectStyles();
    spec = spec || {};
    var cause = spec.cause || { text: '' };
    var yes = list(spec.yes), no = list(spec.no);
    var say = sayOf(spec);
    var on = function (branch, i) { return !!say && say.branch === branch && say.items.indexOf(i) !== -1; };

    var cSize = nodeSize(cause, CAUSE_W);
    var ySizes = yes.map(function (n) { return nodeSize(n, OUT_W); });
    var nSizes = no.map(function (n) { return nodeSize(n, OUT_W); });

    /* centres, relative to the diamond's centre (0): ✔️ nodes stack upwards above the top vertex, ❌ nodes downwards */
    var yC = [], nC = [];
    ySizes.forEach(function (s, i) { yC.push(i === 0 ? -(D + 8) : yC[i - 1] - (ySizes[i - 1].h / 2 + VGAP + s.h / 2)); });
    nSizes.forEach(function (s, i) { nC.push(i === 0 ? D + 8 : nC[i - 1] + (nSizes[i - 1].h / 2 + VGAP + s.h / 2)); });

    var top = Math.min(-cSize.h / 2, -D), bottom = Math.max(cSize.h / 2, D);
    yC.forEach(function (c, i) { top = Math.min(top, c - ySizes[i].h / 2); });
    nC.forEach(function (c, i) { bottom = Math.max(bottom, c + nSizes[i].h / 2); });
    var cy = PAD - top + 4;
    var H = Math.ceil(bottom - top + 2 * PAD + 8);

    var cx0 = PAD + 6, dX = cx0 + CAUSE_W + GAP1, dC = dX + D, outX = dX + 2 * D + GAP2;
    var W = outX + OUT_W + PAD;
    var anyOn = !!say;

    var lines = '', heads = '', nodes = '', onLines = '', onHeads = '';

    /* cause → diamond */
    var cLine = '<path class="hf-line' + (anyOn ? ' hf-on' : '') + '" style="--hf-h:' + BLUE + '" d="M' + (cx0 + CAUSE_W) + ',' + cy + ' H' + (dX - 2) + '"/>';
    var cHead = arrow(dX - 1, cy, BLUE, anyOn);
    if (anyOn) { onLines += cLine; onHeads += cHead; } else { lines += cLine; heads += cHead; }
    nodes += nodeSvg(cause, cx0, cy - cSize.h / 2, CAUSE_W, cSize, { on: anyOn, h: BLUE });

    /* the diamond, in two halves */
    var yesOn = !!say && say.branch === 'yes', noOn = !!say && say.branch === 'no';
    var yesItem = yesOn ? yes[say.items[0]] : null, noItem = noOn ? no[say.items[0]] : null;
    var yH = hue(yesItem && yesItem.p, 'yes'), nH = hue(noItem && noItem.p, 'no');
    nodes += '<polygon class="hf-dia' + (yesOn ? ' hf-on' : '') + '" style="--hf-h:' + yH + '" points="' + dX + ',' + cy + ' ' + dC + ',' + (cy - D) + ' ' + (dX + 2 * D) + ',' + cy + '"/>';
    nodes += '<polygon class="hf-dia' + (noOn ? ' hf-on' : '') + '" style="--hf-h:' + nH + '" points="' + dX + ',' + cy + ' ' + dC + ',' + (cy + D) + ' ' + (dX + 2 * D) + ',' + cy + '"/>';
    nodes += '<text class="hf-mark" x="' + dC + '" y="' + (cy - D / 2 + 9) + '" text-anchor="middle">✔️</text>';
    nodes += '<text class="hf-mark" x="' + dC + '" y="' + (cy + D / 2 + 1) + '" text-anchor="middle">❌</text>';

    function branch(items, sizes, centres, name, startY) {
      items.forEach(function (n, i) {
        var c = cy + centres[i], isOn = on(name, i), h = hue(n.p, name);
        var line = '<path class="hf-line' + (isOn ? ' hf-on' : '') + '" style="--hf-h:' + h + '" d="M' + dC + ',' + startY + ' V' + c + ' H' + (outX - 2) + '"/>';
        var head = arrow(outX - 1, c, h, isOn);
        if (isOn) { onLines += line; onHeads += head; } else { lines += line; heads += head; }
        nodes += nodeSvg(n, outX, c - sizes[i].h / 2, OUT_W, sizes[i], {
          on: isOn, h: h, real: spec.real === name, pick: quizMode,
          data: quizMode ? ' data-branch="' + name + '" data-item="' + i + '"' : ''
        });
      });
    }
    branch(yes, ySizes, yC, 'yes', cy - D);
    branch(no, nSizes, nC, 'no', cy + D);

    var label = spec.aria || ('If ' + cause.text + (yes[0] ? ': yes → ' + yes.map(function (n) { return n.text; }).join(' / ') : '') +
      (no[0] ? '; no → ' + no.map(function (n) { return n.text; }).join(' / ') : ''));
    return '<svg class="hf" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(label) + '" data-dict="off">' +
      lines + heads + onLines + onHeads + nodes + '</svg>';
  }

  function html(spec, opts) {
    var label = (opts && opts.label) || (spec && spec.label) || 'What the speaker thinks';
    var drawing = svg(spec);
    return global.HouseThink ? global.HouseThink.html(drawing, { label: label }) : '<div class="think-bubble">' + drawing + '</div>';
  }

  function render(el, spec) {
    el = typeof el === 'string' ? document.getElementById(el) : el;
    if (el) el.innerHTML = svg(spec);
    return el;
  }

  function legend(opts) {
    injectStyles();
    var pct = !opts || opts.percent !== false;
    return '<div class="hf-legend">' +
      '<span><span class="sw" style="background:hsla(217,75%,50%,.15);border-color:hsl(217,70%,42%)"></span>if … (the cause)</span>' +
      '<span><span class="sw" style="background:hsla(120,75%,50%,.15);border-color:hsl(120,70%,42%)"></span>✔️ it happens</span>' +
      '<span><span class="sw" style="background:hsla(0,75%,50%,.15);border-color:hsl(0,70%,42%)"></span>❌ it doesn’t happen</span>' +
      (pct ? '<span>0% <span class="scale"></span> 100% — how sure</span>' : '') +
      ((opts && opts.real) ? '<span>📍 what really happened</span>' : '') +
      '</div>';
  }

  /* controlled practice: tap the consequence the sentence talks about */
  function quiz(o) {
    injectStyles();
    var host = typeof o.container === 'string' ? document.getElementById(o.container) : o.container;
    if (!host) return;
    var items = o.items || [];
    var scoreEl = o.scoreEl ? document.getElementById(o.scoreEl) : null;
    var totalEl = o.totalEl ? document.getElementById(o.totalEl) : null;
    if (totalEl) totalEl.textContent = items.length;
    var done = 0;
    items.forEach(function (it, idx) {
      var card = document.createElement('div');
      card.className = 'hf-quiz-item';
      card.innerHTML = '<div class="hf-quiz-sentence">' + it.sentence + '</div>' +
        '<div class="hf-quiz-hint">' + (o.hint || 'Tap the result this sentence talks about.') + '</div>' +
        '<div class="hf-quiz-flow"></div><div class="hf-quiz-fb"></div>';
      host.appendChild(card);
      var flowEl = card.querySelector('.hf-quiz-flow'), fb = card.querySelector('.hf-quiz-fb');
      var base = Object.assign({}, it.flow, { say: null });
      flowEl.innerHTML = svg(base, true);
      flowEl.addEventListener('click', function (e) {
        if (card.classList.contains('correct')) return;
        var g = e.target.closest && e.target.closest('.hf-pick');
        if (!g) return;
        var b = g.getAttribute('data-branch'), i = +g.getAttribute('data-item');
        var ans = it.answer || {}, ai = ans.item == null ? 0 : ans.item;
        if (b === ans.branch && i === ai) {
          flowEl.innerHTML = svg(Object.assign({}, it.flow, { say: { branch: b, item: i } }), false);
          card.classList.add('correct');
          fb.textContent = '✓ ' + (it.why || 'Yes! That’s the path.');
          fb.className = 'hf-quiz-fb ok';
          done++;
          if (scoreEl) scoreEl.textContent = done;
        } else {
          g.classList.remove('hf-wrong'); void g.getBoundingClientRect(); g.classList.add('hf-wrong');
          setTimeout(function () { g.classList.remove('hf-wrong'); }, 450);
          fb.textContent = '✗ Not that one. Look at the if-part again: does it happen (✔️) or not (❌)?';
          fb.className = 'hf-quiz-fb no';
        }
      });
    });
  }

  injectStyles();
  global.HouseFlow = { svg: svg, html: html, render: render, quiz: quiz, legend: legend, hue: hue };
})(window);
