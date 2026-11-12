/* ══════════════════════════════════════════════════════════════════════════
   house.js — the shared behaviour for every lesson page in this library.

   Bundles these things:
     · the light/dark theme toggle
     · HouseWordOrder — the tap/drag sentence-builder engine
     · HouseGapFill   — the Damerau-Levenshtein accuracy-bar gap fill
     · HouseGrammar   — the part-of-speech highlighting toggle
     · HouseRail      — the column of round buttons (theme, size, grammar, figures, marks, bionic)
     · HouseFontSize  — the 🔎 text-size slider
     · HouseBionic    — the 🦾 bionic-reading toggle for conversation bubbles
     · HouseRandomGen — the 🎲 freer-practice prompt generator
     · HouseMatching  — two-column matching with connector lines
     · HouseMemory    — the memory (pairs) game: flip two cards, find the pairs
     · HouseTimeline  — tense timelines
     · HouseFormClarf — drag POS chips onto sentence parts
     · HouseErrorHunt — find and fix the mistakes
     · HouseCCQ       — concept checking questions
     · favicon        — auto-sets a level badge in the browser tab
     · HouseComprehension — the before/after reading questions
     · HouseThink     — thought bubbles under a line of a conversation
     · HouseDict      — the learner's dictionary: right-click / long press a word
                        for its meaning and sound; ☆ saves it for My Words

   Load it once at the end of <body>, before the page's own script.
   ══════════════════════════════════════════════════════════════════════════ */

// Self-contained theme toggle — no external CSS or JS required. Uses plain
// getElementById/addEventListener/localStorage so it runs on the widest possible
// range of browsers and devices (desktop, mobile, older Safari included), and
// degrades gracefully (falls back to the OS theme) if storage is blocked.
(function(){
  var root = document.documentElement;
  var STORAGE_KEY = 'theme-preference';

  function getStored(){
    try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; }
  }
  function setStored(theme){
    try{ localStorage.setItem(STORAGE_KEY, theme); }catch(e){ /* private mode, etc. — ignore */ }
  }
  function systemPrefersDark(){
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function currentTheme(){
    var saved = getStored();
    return (saved === 'light' || saved === 'dark') ? saved : (systemPrefersDark() ? 'dark' : 'light');
  }
  function applyTheme(theme){
    root.setAttribute('data-theme', theme);
    var icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  applyTheme(currentTheme());

  var btn = document.getElementById('theme-toggle');
  if (btn){
    btn.addEventListener('click', function(){
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      setStored(next);
      applyTheme(next);
    });
  }

  // If the person hasn't manually chosen a theme, keep following the OS setting
  // live (e.g. their device switches to dark mode at sunset).
  if (window.matchMedia){
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function(){ if (!getStored()) applyTheme(currentTheme()); };
    if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
    else if (mql.addListener) mql.addListener(onSystemChange); // older Safari
  }
})();


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE RAIL — the column of round buttons at the top right of every page.
   Everything that changes how the whole page looks lives here, one round
   button each, in a fixed order:

       ☀️/🌙 theme · 🔎 text size · 🎨 grammar colours · 🧍 stick figures ·
       🎵 pronunciation marks · 🦾 bionic reading

   A button only appears on a page that has something for it to do.

   The kits that make their own text switches (HouseGrammar's #grammarToggle,
   StickSentence / present-perfect-kit's #stickToggle, pron-adapter's #pmStart,
   PronMark's #pmToggle) need no changes: the switch stays in the page, hidden,
   and its round button presses it and copies its state (on / off, loading,
   hidden). The page's legend and the pronunciation colour pickers stay where
   they were, next to the content they explain.

     HouseRail.add({ id, icon, label, order, pressed, onClick })  → the button
         (an existing id is reused, so calling it twice is safe)
     HouseRail.set(id, pressed)      HouseRail.remove(id)
     HouseRail.place(element, order) put any element in the column
     HouseRail.adopt(id, { icon, label, order })   a page's own text switch
   Orders in use: theme 0, text size 10, grammar 20, stick figures 30,
   pronunciation 40, bionic 50. Fixed chrome stays in px, like the theme toggle.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'house-rail-styles';
  var CSS = ''
    + '#house-rail{ position:fixed; top:14px; right:14px; z-index:1000; display:flex; flex-direction:column; align-items:center; gap:8px; }'
    + '#house-rail > #theme-toggle-wrap, #house-rail > #font-size-wrap{ position:static; top:auto; right:auto; }'
    + '.house-rail-btn{ width:38px; height:38px; border-radius:50%; padding:0; border:1px solid var(--border); background:var(--surface-2);'
    +   ' color:var(--text-primary); font-family:inherit; font-size:16px; line-height:1; display:flex; align-items:center; justify-content:center;'
    +   ' cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.12); transition:background .15s, border-color .15s, box-shadow .15s; }'
    + '.house-rail-btn:hover{ background:var(--color-background-tertiary); }'
    + '.house-rail-btn[aria-pressed="true"]{ background:var(--color-background-info); border-color:var(--text-accent); box-shadow:0 0 0 1.5px var(--text-accent), 0 2px 8px rgba(0,0,0,0.12); }'
    + '.house-rail-btn:disabled{ opacity:.55; cursor:progress; }'
    + '.house-rail-btn[hidden]{ display:none; }'
    + '.house-rail-btn:focus-visible{ outline:2px solid var(--text-accent); outline-offset:2px; }'
    + '.house-railed{ display:none !important; }'
    /* the 🔎 panel opens beside its button, wherever the button is in the column */
    + '#font-size-panel{ box-sizing:border-box; }'
    + '#font-size-panel #font-size-slider{ width:auto; flex:1 1 132px; min-width:56px; }'
    + '@media print{ #house-rail, #font-size-panel{ display:none !important; } }';

  var rail = null;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function ensure() {
    if (rail && rail.isConnected) return rail;
    injectStyles();
    rail = document.getElementById('house-rail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'house-rail';
      rail.setAttribute('role', 'toolbar');
      rail.setAttribute('aria-label', 'Page settings');
      rail.setAttribute('aria-orientation', 'vertical');
      document.body.appendChild(rail);
    }
    return rail;
  }

  function place(el, order) {
    ensure();
    el.dataset.railOrder = String(order == null ? 100 : order);
    var o = +el.dataset.railOrder, kids = rail.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] !== el && +kids[i].dataset.railOrder > o) { rail.insertBefore(el, kids[i]); return el; }
    }
    if (el.parentNode !== rail || el !== rail.lastElementChild) rail.appendChild(el);
    return el;
  }

  function setPressed(b, v) {
    var s = String(!!v);
    if (b.getAttribute('aria-pressed') !== s) b.setAttribute('aria-pressed', s);   /* only on a change: others listen */
  }

  function add(o) {
    var b = document.getElementById(o.id);
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.id = o.id;
      b.className = 'house-rail-btn';
      b.addEventListener('click', function (e) { e.stopPropagation(); if (b._railClick) b._railClick(e); });
    }
    b.textContent = o.icon || '';
    if (o.label) b.setAttribute('aria-label', o.label);
    b.title = o.title || o.label || '';
    if (o.pressed != null) setPressed(b, o.pressed);
    if (o.onClick) b._railClick = o.onClick;
    return place(b, o.order);
  }

  function set(id, pressed) { var b = document.getElementById(id); if (b) setPressed(b, pressed); }
  function remove(id) { var b = document.getElementById(id); if (b && b.parentNode === rail) b.remove(); }

  /* ── a page's own text switch, pressed from a round button ── */
  var KNOWN = {
    grammarToggle: { icon: '🎨', label: 'Grammar colours', order: 20 },
    stickToggle:   { icon: '🧍', label: 'Stick figures', order: 30 },
    pmStart:       { icon: '🎵', label: 'Pronunciation marks', order: 40 },
    pmToggle:      { icon: '🎵', label: 'Pronunciation marks', order: 40 }
  };
  var adopted = [];   /* [{orig, proxy, mo}] */

  function adopt(id, A) {
    var orig = document.getElementById(id);
    A = A || KNOWN[id];
    if (!orig || !A || orig._railProxy) return null;
    var proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.className = 'house-rail-btn';
    proxy.id = 'rail-' + id;
    proxy.textContent = A.icon;
    proxy.setAttribute('aria-label', A.label);
    orig._railProxy = proxy;
    orig.classList.add('house-railed');
    function mirror() {
      var p = orig.getAttribute('aria-pressed');
      setPressed(proxy, p === 'true');
      proxy.disabled = !!orig.disabled;
      /* the switch's own words say what a press does next: "Show Grammar", "🎵 Loading…" */
      var t = String(orig.textContent || '').replace(/^[^A-Za-z0-9]+/, '').trim() || A.label;
      if (proxy.title !== t) proxy.title = t;
      proxy.hidden = !!orig.hidden || orig.style.display === 'none';
    }
    proxy.addEventListener('click', function (e) { e.stopPropagation(); orig.click(); });
    var mo = new MutationObserver(mirror);
    mo.observe(orig, { attributes: true, attributeFilter: ['aria-pressed', 'disabled', 'hidden', 'style'], childList: true, characterData: true, subtree: true });
    adopted.push({ orig: orig, proxy: proxy, mo: mo });
    place(proxy, A.order);
    mirror();
    return proxy;
  }

  /* switches come and go (pmStart makes way for pmToggle once the marks have loaded) */
  function scan() {
    adopted = adopted.filter(function (a) {
      if (a.orig.isConnected) return true;
      a.mo.disconnect(); a.proxy.remove(); a.orig._railProxy = null;
      return false;
    });
    for (var id in KNOWN) adopt(id);
  }

  var queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    (global.requestAnimationFrame || setTimeout)(function () { queued = false; scan(); });
  }

  function start() {
    ensure();
    var theme = document.getElementById('theme-toggle-wrap');
    if (theme) place(theme, 0);
    scan();
    if (global.MutationObserver) new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  global.HouseRail = { add: add, set: set, remove: remove, place: place, adopt: adopt, refresh: scan };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE WORD-ORDER ENGINE
   Tap a chip to place it, tap again to remove it, or drag to reorder.
   Correction is automatic once every chip is in the target zone.

   Usage:
     HouseWordOrder.build({
       container: 'woItems',        // element id to render into
       items: WO_ITEMS,             // [{speaker, avatar, context, text, pos}]
       scoreEl: 'woScore',          // element id for the running score
       totalEl: 'woTotal'           // element id for the item count
     });

   Each item's `text` is words joined by " / ", and `pos` is a parallel array of
   part-of-speech keys used for the grammar highlighting shown on a correct answer.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var POS_CLASSES = {
    wh: 'pos-wh', aux: 'pos-aux', verb: 'pos-verb', part: 'pos-part',
    subject: 'pos-subject', object: 'pos-object', complement: 'pos-complement',
    noun: 'pos-noun', adj: 'pos-adj', adverb: 'pos-adverb', prep: 'pos-prep',
    det: 'pos-det', conj: 'pos-conj', time: 'pos-time', neg: 'pos-neg', none: 'pos-none'
  };

  var ALL_POS_CLASSES = Object.keys(POS_CLASSES).map(function (k) { return POS_CLASSES[k]; });

  var PLACEHOLDER_TEXT = 'Tap or drag words below to build the sentence';

  function parseItem(str) {
    return str.split(' / ').map(function (w) { return w.trim(); });
  }

  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function updatePlaceholder(zone) {
    var hasChips = zone.querySelector('.word-chip');
    var hasIndicator = zone.querySelector('.drop-indicator');
    var placeholder = zone.querySelector('.target-placeholder');
    if (!hasChips && !hasIndicator) {
      if (!placeholder && zone.dataset.role === 'target') {
        placeholder = document.createElement('span');
        placeholder.className = 'target-placeholder';
        placeholder.textContent = PLACEHOLDER_TEXT;
        zone.appendChild(placeholder);
      }
    } else if (placeholder) {
      placeholder.remove();
    }
  }

  function resetChipVisualState(chip) {
    chip.classList.remove('chip-correct', 'chip-wrong', 'chip-emphasis');
    ALL_POS_CLASSES.forEach(function (c) { chip.classList.remove(c); });
  }

  function moveChipToTarget(chip, targetZone, poolZone) {
    resetChipVisualState(chip);
    chip.classList.add('in-target');
    targetZone.appendChild(chip);
    updatePlaceholder(targetZone);
    updatePlaceholder(poolZone);
  }

  function moveChipToPool(chip, targetZone, poolZone) {
    resetChipVisualState(chip);
    chip.classList.remove('in-target');
    poolZone.appendChild(chip);
    updatePlaceholder(targetZone);
    updatePlaceholder(poolZone);
  }

  function getDropSpot(zone, x, y) {
    var chips = Array.prototype.slice.call(zone.querySelectorAll('.word-chip:not(.dragging)'));
    if (chips.length === 0) return null;
    var closest = null, closestDist = Infinity;
    chips.forEach(function (c) {
      var rect = c.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dist = Math.hypot(x - cx, y - cy);
      if (dist < closestDist) { closestDist = dist; closest = { chip: c, rect: rect }; }
    });
    var before = x < closest.rect.left + closest.rect.width / 2;
    return { chip: closest.chip, before: before };
  }

  function placeIndicator(zone, indicator, x, y) {
    var spot = getDropSpot(zone, x, y);
    if (!spot) {
      zone.appendChild(indicator);
    } else if (spot.before) {
      zone.insertBefore(indicator, spot.chip);
    } else {
      zone.insertBefore(indicator, spot.chip.nextSibling);
    }
  }

  function applyPosHighlighting(targetZone, posArray) {
    var chips = Array.prototype.slice.call(targetZone.querySelectorAll('.word-chip'));
    chips.forEach(function (chip, i) {
      var pos = (posArray && posArray[i]) || 'none';
      chip.className = 'word-chip in-target chip-emphasis ' + (POS_CLASSES[pos] || 'pos-none');
    });
  }

  function clearPosHighlighting(targetZone) {
    targetZone.querySelectorAll('.word-chip').forEach(function (chip) {
      ALL_POS_CLASSES.forEach(function (c) { chip.classList.remove(c); });
      chip.classList.remove('chip-emphasis');
    });
  }

  function attachChipEvents(chip, targetZone, poolZone, feedback, itemEl, indicator) {
    var dragState = null;
    var moved = false;

    // Shared cleanup used by pointercancel, lostpointercapture, and the window-level
    // fallback below. Mac trackpads/Safari can silently drop pointer capture mid-drag
    // (a stray scroll or gesture, or the window losing focus) without ever firing a
    // matching pointerup or pointercancel — leaving the chip stuck with position:fixed
    // and frozen in the viewport. Routing every "drag ended unexpectedly" path through
    // this one function guarantees the chip always gets its inline styles cleared and
    // lands back in a real zone.
    function forceEndDrag() {
      indicator.remove();
      if (dragState && moved) {
        chip.classList.remove('dragging');
        chip.style.position = '';
        chip.style.left = '';
        chip.style.top = '';
        chip.style.width = '';
        if (dragState.originParent === targetZone) {
          moveChipToTarget(chip, targetZone, poolZone);
        } else {
          moveChipToPool(chip, targetZone, poolZone);
        }
      }
      itemEl._dragActive = false;
      dragState = null;
      moved = false;
    }

    chip.addEventListener('pointerdown', function (e) {
      e.preventDefault();

      // Defensive: if a previous drag never got a clean pointerup (the freeze bug),
      // clear it out before starting a new one instead of stacking on top of it.
      if (dragState) forceEndDrag();

      if (targetZone.classList.contains('correct')) {
        clearPosHighlighting(targetZone);
        targetZone.classList.remove('correct');
      }

      moved = false;
      var rect = chip.getBoundingClientRect();
      dragState = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        originParent: chip.parentElement
      };
      chip.setPointerCapture(e.pointerId);

      itemEl.querySelectorAll('.word-chip').forEach(function (c) {
        c.classList.remove('chip-correct', 'chip-wrong');
      });
      targetZone.classList.remove('wrong');
      feedback.textContent = '';
      feedback.className = 'item-feedback';
    });

    chip.addEventListener('pointermove', function (e) {
      if (!dragState) return;
      if (!moved) {
        moved = true;
        itemEl._dragActive = true;
        var rect = chip.getBoundingClientRect();

        // Size the drop indicator to match the dragged chip so it acts as a real
        // reserved slot, pushing the surrounding chips apart from the very first
        // moment of the drag — this alone is what keeps the gap open, so there's
        // no separate placeholder needed at the chip's old spot.
        indicator.style.width = rect.width + 'px';
        indicator.style.height = rect.height + 'px';

        chip.classList.add('dragging');
        chip.style.width = rect.width + 'px';
      }
      chip.style.left = (e.clientX - dragState.offsetX) + 'px';
      chip.style.top = (e.clientY - dragState.offsetY) + 'px';

      targetZone.classList.remove('drag-over');
      poolZone.classList.remove('drag-over');
      var els = document.elementsFromPoint(e.clientX, e.clientY);
      var overTarget = els.some(function (el) { return el.closest && el.closest('[data-role="target"]') === targetZone; });
      var overPool = els.some(function (el) { return el.closest && el.closest('[data-role="pool"]') === poolZone; });

      if (overTarget) {
        targetZone.classList.add('drag-over');
        placeIndicator(targetZone, indicator, e.clientX, e.clientY);
      } else if (overPool) {
        poolZone.classList.add('drag-over');
        placeIndicator(poolZone, indicator, e.clientX, e.clientY);
      } else {
        indicator.remove();
      }
      // The indicator itself should hide the "tap or drag" placeholder the moment
      // it lands in an empty zone — not just once a real chip is actually dropped.
      updatePlaceholder(targetZone);
      updatePlaceholder(poolZone);
    });

    chip.addEventListener('pointerup', function (e) {
      if (!dragState) return;
      targetZone.classList.remove('drag-over');
      poolZone.classList.remove('drag-over');
      targetZone.classList.remove('correct', 'wrong');
      feedback.textContent = '';
      feedback.className = 'item-feedback';

      if (moved) {
        chip.classList.remove('dragging');
        chip.style.position = '';
        chip.style.left = '';
        chip.style.top = '';
        chip.style.width = '';

        if (indicator.parentElement === targetZone) {
          resetChipVisualState(chip);
          targetZone.insertBefore(chip, indicator);
          chip.classList.add('in-target');
          indicator.remove();
          updatePlaceholder(targetZone);
          updatePlaceholder(poolZone);
        } else if (indicator.parentElement === poolZone) {
          resetChipVisualState(chip);
          poolZone.insertBefore(chip, indicator);
          chip.classList.remove('in-target');
          indicator.remove();
          updatePlaceholder(targetZone);
          updatePlaceholder(poolZone);
        } else {
          indicator.remove();
          var els = document.elementsFromPoint(e.clientX, e.clientY);
          var overPool = els.some(function (el) { return el.closest && el.closest('[data-role="pool"]') === poolZone; });
          if (overPool) {
            moveChipToPool(chip, targetZone, poolZone);
          } else if (dragState.originParent === targetZone) {
            moveChipToTarget(chip, targetZone, poolZone);
          } else {
            moveChipToPool(chip, targetZone, poolZone);
          }
        }
      } else {
        targetZone.classList.remove('correct', 'wrong');
        if (chip.parentElement === poolZone) {
          moveChipToTarget(chip, targetZone, poolZone);
        } else {
          moveChipToPool(chip, targetZone, poolZone);
        }
      }

      itemEl._dragActive = false;
      dragState = null;
      moved = false;
    });

    chip.addEventListener('pointercancel', forceEndDrag);

    // Fires whenever pointer capture is released for any reason. In the normal flow
    // pointerup already runs first and clears dragState, so this is a no-op then; it
    // only does real work when capture was lost WITHOUT a pointerup/pointercancel,
    // which is the Mac freeze case.
    chip.addEventListener('lostpointercapture', function () {
      if (dragState) forceEndDrag();
    });

    // Last-resort fallback: if the whole window loses focus mid-drag (switching apps,
    // a trackpad gesture triggering Mission Control/Spaces, etc.) release the chip too.
    window.addEventListener('blur', function () {
      if (dragState) forceEndDrag();
    });
  }

  function build(opts) {
    var container = typeof opts.container === 'string'
      ? document.getElementById(opts.container) : opts.container;
    if (!container) return;

    var items = opts.items || [];
    var scoreEl = opts.scoreEl ? document.getElementById(opts.scoreEl) : null;
    var totalEl = opts.totalEl ? document.getElementById(opts.totalEl) : null;
    if (totalEl) totalEl.textContent = items.length;

    // Scoped per exercise, so two exercises on one page never share a score.
    var correctSet = new Set();

    items.forEach(function (entry, idx) {
      var words = parseItem(entry.text);
      var correctOrder = words.slice();
      var pool = shuffleArr(words);
      var tries = 0;
      while (JSON.stringify(pool) === JSON.stringify(correctOrder) && tries < 5) {
        pool = shuffleArr(words);
        tries++;
      }

      var itemEl = document.createElement('div');
      itemEl.className = 'wo-item';
      itemEl.dataset.idx = idx;
      var headerHtml = entry.speaker
        ? '<div class="item-speaker"><span class="avatar-mini">' + (entry.avatar || '') + '</span> ' + entry.speaker + '</div>'
        : (entry.context ? '<div class="item-context">' + entry.context + '</div>' : '');
      itemEl.innerHTML =
        headerHtml +
        '<div class="item-feedback" data-role="feedback"></div>' +
        '<div class="target-zone" data-role="target"><span class="target-placeholder">' + PLACEHOLDER_TEXT + '</span></div>' +
        '<div class="pool-zone" data-role="pool"></div>';
      container.appendChild(itemEl);

      var targetZone = itemEl.querySelector('[data-role="target"]');
      var poolZone = itemEl.querySelector('[data-role="pool"]');
      var feedback = itemEl.querySelector('[data-role="feedback"]');
      var indicator = document.createElement('span');
      indicator.className = 'drop-indicator';

      // The chips are shuffled, so a chip's pool position no longer lines up with
      // the pos array — look the part of speech up by the word's position in the
      // correct order instead, matching each duplicate word in turn.
      var posCursor = {};
      pool.forEach(function (word, wIdx) {
        var chip = document.createElement('span');
        chip.className = 'word-chip';
        chip.textContent = word;
        chip.dataset.word = word;
        chip.dataset.uid = idx + '-' + wIdx + '-' + Math.random().toString(36).slice(2, 6);
        var from = posCursor[word] || 0;
        var origIdx = correctOrder.indexOf(word, from);
        if (origIdx === -1) origIdx = correctOrder.indexOf(word);
        posCursor[word] = origIdx + 1;
        chip.dataset.pos = (entry.pos && entry.pos[origIdx]) || 'none';
        attachChipEvents(chip, targetZone, poolZone, feedback, itemEl, indicator);
        poolZone.appendChild(chip);
      });

      // Correction runs automatically, only once every chip has been placed in the
      // target zone — no Check button needed. A MutationObserver picks up every way
      // a chip can land there (tap, drag-drop, reordering) without wiring each path by hand.
      function evaluateItem() {
        // While a chip from this item is actively being dragged, it's still a real
        // DOM child of its zone (just visually floated via position:fixed) — so the
        // sized drop indicator sliding in and out still counts as a childList change
        // and would re-trigger this. Re-running the full evaluation then would call
        // applyPosHighlighting, which rewrites every chip's className in the zone —
        // including the dragged one, wiping its `dragging` class mid-drag and
        // freezing it in place. Skip evaluation entirely until the drag settles.
        if (itemEl._dragActive) return;

        var targetChips = Array.prototype.slice.call(targetZone.querySelectorAll('.word-chip'));
        targetZone.classList.remove('correct', 'wrong');

        if (targetChips.length < correctOrder.length) {
          targetChips.forEach(resetChipVisualState);
          feedback.textContent = '';
          feedback.className = 'item-feedback';
          if (correctSet.has(idx)) {
            correctSet.delete(idx);
            if (scoreEl) scoreEl.textContent = correctSet.size;
          }
          return;
        }

        var currentWords = targetChips.map(function (c) { return c.dataset.word; });
        var isCorrect = JSON.stringify(currentWords) === JSON.stringify(correctOrder);

        targetChips.forEach(function (chip, i) {
          resetChipVisualState(chip);
          if (chip.dataset.word === correctOrder[i]) {
            chip.classList.add('chip-correct', 'chip-emphasis');
          } else {
            chip.classList.add('chip-wrong');
          }
        });

        if (isCorrect) {
          targetZone.classList.add('correct');
          feedback.textContent = '✓ Correct! Well done!';
          feedback.className = 'item-feedback correct';
          correctSet.add(idx);
          applyPosHighlighting(targetZone, entry.pos);
        } else {
          targetZone.classList.add('wrong');
          feedback.textContent = '✗ Not correct. The green words are in the right place.';
          feedback.className = 'item-feedback wrong';
          correctSet.delete(idx);
        }
        if (scoreEl) scoreEl.textContent = correctSet.size;
      }

      new MutationObserver(evaluateItem).observe(targetZone, { childList: true });

      updatePlaceholder(targetZone);
    });
  }

  global.HouseWordOrder = { build: build, POS_CLASSES: POS_CLASSES };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE GAP-FILL ENGINE
   The learner types free text. A Damerau-Levenshtein comparison against every
   accepted answer drives a live accuracy bar that runs red → green, so a near
   miss reads as "nearly there" rather than a flat wrong.

   Usage:
     HouseGapFill.build({
       container: 'gfItems',
       items: GF_ITEMS,             // [{category, direct, template, hints}]
       labels: { pos:'personal info', q:'question' }   // optional cat-tag text
     });

   `template` holds {0}, {1} … placeholders; `hints[n].accepted` is the list of
   answers accepted for that gap. Items should be ordered easiest → hardest:
   short common phrases first, questions / formal / idiomatic ones last.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function damerauLevenshtein(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    var al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;

    var d = [];
    for (var i = 0; i <= al; i++) { d[i] = new Array(bl + 1).fill(0); d[i][0] = i; }
    for (var j = 0; j <= bl; j++) d[0][j] = j;

    for (i = 1; i <= al; i++) {
      for (j = 1; j <= bl; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
        }
      }
    }
    return d[al][bl];
  }

  function bestAccuracy(input, acceptedList) {
    if (!input) return 0;
    var best = 0;
    acceptedList.forEach(function (answer) {
      var dist = damerauLevenshtein(input, answer);
      var maxLen = Math.max(input.length, answer.length);
      var pct = maxLen === 0 ? 100 : Math.max(0, (1 - dist / maxLen) * 100);
      if (pct > best) best = pct;
    });
    return best;
  }

  function pctToColor(pct) {
    var hue = (pct / 100) * 120;
    return 'hsl(' + hue + 'deg 100% 40%)';
  }

  var DEFAULT_LABELS = {
    cel: 'introduction', pos: 'positive', neg: 'negative', q: 'question'
  };

  function build(opts) {
    var container = typeof opts.container === 'string'
      ? document.getElementById(opts.container) : opts.container;
    if (!container) return;

    var items = opts.items || [];
    var labels = Object.assign({}, DEFAULT_LABELS, opts.labels || {});
    var uid = container.id || ('gf' + Math.random().toString(36).slice(2, 7));

    items.forEach(function (item, idx) {
      var sentenceHtml = item.template;
      item.hints.forEach(function (gap, gapIdx) {
        var gapId = uid + '-' + idx + '-' + gapIdx;
        var widthCh = Math.max(gap.accepted[0].length * 0.75, 6);
        var gapHtml =
          '<span class="gf-gap-wrap">' +
            '<span class="bar-track"><span class="bar-fill" id="bar-' + gapId + '"></span></span>' +
            '<span class="bar-pct" id="pct-' + gapId + '">0%</span>' +
            '<input type="text" style="width:' + widthCh + 'em" class="gf-gap-input" ' +
              'id="input-' + gapId + '" data-idx="' + idx + '" data-gap="' + gapIdx + '" ' +
              'autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '</span>';
        sentenceHtml = sentenceHtml.replace('{' + gapIdx + '}', gapHtml);
      });

      var wrap = document.createElement('div');
      wrap.className = 'gf-item';
      var catHtml = item.category
        ? '<span class="cat-tag ' + item.category + '">' + (labels[item.category] || item.category) + '</span>'
        : '';
      wrap.innerHTML =
        catHtml +
        (item.direct ? '<div class="direct">' + item.direct + '</div>' : '') +
        '<div class="sentence">' + sentenceHtml + '</div>';
      container.appendChild(wrap);
    });

    container.addEventListener('input', function (e) {
      if (!e.target.classList.contains('gf-gap-input')) return;
      var idx = Number(e.target.dataset.idx);
      var gapIdx = Number(e.target.dataset.gap);
      var gapId = uid + '-' + idx + '-' + gapIdx;
      var accepted = items[idx].hints[gapIdx].accepted;

      var value = e.target.value.trim();
      var pct = bestAccuracy(value, accepted);
      var color = pctToColor(pct);

      var bar = document.getElementById('bar-' + gapId);
      var pctLabel = document.getElementById('pct-' + gapId);
      bar.style.width = pct + '%';
      bar.style.background = color;
      pctLabel.textContent = Math.round(pct) + '%';
      pctLabel.style.color = color;

      if (Math.round(pct) >= 100) {
        e.target.classList.add('gap-correct');
      } else {
        e.target.classList.remove('gap-correct');
      }
    });
  }

  /* ── In-place upgrade ────────────────────────────────────────────────────
     Some pages hand-write their gaps inside rich sentence markup rather than
     generating them from a data array. Rather than flatten that markup into
     templates, wrap each existing input in the same accuracy-bar widget so the
     interaction is identical to the generated exercises.

       HouseGapFill.attach({ g1: ['on'], g2: ['under', 'below'] });
  */
  function attach(answers, opts) {
    opts = opts || {};
    var selector = opts.selector || 'input.gap, input.gf-gap-input';

    Object.keys(answers).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      var accepted = answers[id];
      if (typeof accepted === 'string') accepted = [accepted];

      // A stale check/reset button flow would fight the live bar, so drop the
      // old pass/fail classes and let accuracy be the only signal.
      input.classList.remove('correct', 'wrong');
      input.classList.add('gf-gap-input');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      if (!input.style.width) {
        input.style.width = Math.max(accepted[0].length * 0.75, 6) + 'em';
      }

      var wrap = document.createElement('span');
      wrap.className = 'gf-gap-wrap';
      var track = document.createElement('span');
      track.className = 'bar-track';
      var fill = document.createElement('span');
      fill.className = 'bar-fill';
      track.appendChild(fill);
      var pctLabel = document.createElement('span');
      pctLabel.className = 'bar-pct';
      pctLabel.textContent = '0%';

      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(track);
      wrap.appendChild(pctLabel);
      wrap.appendChild(input);

      input.addEventListener('input', function () {
        var pct = bestAccuracy(input.value.trim(), accepted);
        var color = pctToColor(pct);
        fill.style.width = pct + '%';
        fill.style.background = color;
        pctLabel.textContent = Math.round(pct) + '%';
        pctLabel.style.color = color;
        input.classList.toggle('gap-correct', Math.round(pct) >= 100);
      });
    });
  }

  global.HouseGapFill = {
    build: build,
    attach: attach,
    damerauLevenshtein: damerauLevenshtein,
    bestAccuracy: bestAccuracy
  };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE GRAMMAR HIGHLIGHTING TOGGLE
   Colours parts of speech on chips (.word-chip.pos-*) and on inline spans
   (.pos-hl.pos-*), and wires up one "🎨 Show / Hide Grammar" button.

   Highlighting is HIDDEN by default so learners meet the language before the
   colour scaffolding — except on word-order pages, where the colours are part
   of how the exercise teaches, so they default to on.

   The legend is generated from whichever parts of speech actually appear on the
   page, so no page ever shows a swatch for a category it doesn't use.

   Usage (both optional — sensible defaults are inferred from the markup):
     HouseGrammar.init();
     HouseGrammar.init({ defaultOn: true, scope: '#page' });
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  // Ordered so the legend always reads in a sensible grammatical sequence
  // rather than in whatever order the words happen to appear.
  var POS_ORDER = [
    ['wh', 'Wh-word'],
    ['aux', 'Auxiliary'],
    ['subject', 'Subject'],
    ['verb', 'Verb'],
    ['part', 'Past participle'],
    ['object', 'Object'],
    ['complement', 'Complement'],
    ['noun', 'Noun'],
    ['det', 'Determiner'],
    ['adj', 'Adjective'],
    ['adverb', 'Adverb'],
    ['time', 'Time expression'],
    ['prep', 'Preposition'],
    ['conj', 'Conjunction'],
    ['neg', 'Negative'],
    ['none', 'Other']
  ];

  function detectUsedPos(scope) {
    var used = {};
    scope.querySelectorAll('[class*="pos-"], [data-pos]').forEach(function (el) {
      if (el.dataset && el.dataset.pos) used[el.dataset.pos] = true;
      el.classList.forEach(function (cls) {
        if (cls.indexOf('pos-') === 0) used[cls.slice(4)] = true;
      });
    });
    // `.pos-legend` and `.pos-hl` are wrappers, not parts of speech.
    delete used.legend;
    delete used.hl;
    return used;
  }

  function buildLegend(legendEl, used) {
    var html = POS_ORDER.filter(function (p) { return used[p[0]]; })
      .map(function (p) {
        return '<span class="legend-item"><span class="legend-swatch legend-' + p[0] + '"></span>' + p[1] + '</span>';
      }).join('');
    legendEl.innerHTML = html;
    // Nothing tagged on this page — don't leave an empty strip behind.
    legendEl.style.display = html ? '' : 'none';
    return !!html;
  }

  function init(opts) {
    opts = opts || {};
    var scope = document.querySelector(opts.scope || '#page') || document.body;
    var btn = document.getElementById('grammarToggle');
    var legendEl = scope.querySelector('.pos-legend') || document.querySelector('.pos-legend');

    var used = detectUsedPos(scope);
    var hasAny = legendEl ? buildLegend(legendEl, used) : Object.keys(used).length > 0;

    if (!btn) return;
    if (!hasAny) { btn.style.display = 'none'; return; }

    // Word-order exercises are the documented exception: their colours default to on.
    var defaultOn = typeof opts.defaultOn === 'boolean'
      ? opts.defaultOn
      : !!scope.querySelector('.target-zone');

    function render(hidden) {
      scope.classList.toggle('grammar-hidden', hidden);
      btn.textContent = hidden ? '🎨 Show Grammar' : '🎨 Hide Grammar';
      btn.setAttribute('aria-pressed', String(!hidden));
    }

    render(!defaultOn);
    btn.addEventListener('click', function () {
      render(!scope.classList.contains('grammar-hidden'));
    });
  }

  global.HouseGrammar = { init: init, POS_ORDER: POS_ORDER };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE COMPREHENSION QUESTIONS
   The same three questions bracket every conversation. Before it they appear
   as a plain numbered list with no options — the point there is to set a
   purpose for reading, and showing choices would hand over the answers.
   After it the learner picks from three options: the right answer and two
   distractors drawn from the text, so a wrong pick means a genuine misreading
   rather than a guess.

   One shared data array drives both, so the wording can never drift apart:

     HouseComprehension.build({
       pre:  'preQuestions',    // element id for the before-reading list
       quiz: 'quiz',            // element id for the after-reading questions
       items: CQ_ITEMS          // [{q, opts:[…], correct: <index>}]
     });

   Answering locks that question, marks the chosen option, and reveals the
   correct one if the pick was wrong.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function build(opts) {
    var items = opts.items || [];

    var preEl = typeof opts.pre === 'string' ? document.getElementById(opts.pre) : opts.pre;
    if (preEl) {
      var ol = document.createElement('ol');
      items.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item.q;
        ol.appendChild(li);
      });
      preEl.classList.add('prequiz');
      preEl.innerHTML = '';
      preEl.appendChild(ol);
    }

    var quizEl = typeof opts.quiz === 'string' ? document.getElementById(opts.quiz) : opts.quiz;
    if (!quizEl) return;

    items.forEach(function (item, qi) {
      var block = document.createElement('div');
      block.className = 'quiz-q';
      var html = '<div class="q-text">' + (qi + 1) + '. ' + item.q + '</div>';
      item.opts.forEach(function (o, oi) {
        html += '<button class="opt" data-q="' + qi + '" data-o="' + oi + '">' + o + '</button>';
      });
      html += '<div class="q-feedback" id="' + quizEl.id + '-fb-' + qi + '"></div>';
      block.innerHTML = html;
      quizEl.appendChild(block);
    });

    quizEl.addEventListener('click', function (e) {
      if (!e.target.classList.contains('opt')) return;
      var qi = Number(e.target.dataset.q);
      var oi = Number(e.target.dataset.o);
      var correctIdx = items[qi].correct;
      var buttons = quizEl.querySelectorAll('.opt[data-q="' + qi + '"]');
      buttons.forEach(function (b) { b.disabled = true; });

      var fb = document.getElementById(quizEl.id + '-fb-' + qi);
      if (oi === correctIdx) {
        e.target.classList.add('correct');
        fb.textContent = '✓ Correct!';
        fb.className = 'q-feedback correct';
      } else {
        e.target.classList.add('incorrect');
        buttons[correctIdx].classList.add('correct');
        fb.textContent = '✗ Not quite — the correct answer is highlighted.';
        fb.className = 'q-feedback incorrect';
      }
    });
  }

  global.HouseComprehension = { build: build };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE FONT SIZE
   A 🔎 button in the round-button column that opens a slider running from 10px to
   28px, captioned 🤏 (smaller) and 🖐️ (larger).

   Every font-size in house.css is expressed in rem, and `html` takes its size
   from --fs-base, so writing that one custom property rescales the whole page
   proportionally — nothing here needs to know about individual components.

   The markup is created at runtime rather than pasted into every lesson page,
   so adding the control to a page costs nothing but loading house.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'font-size-preference';

  // Read the bounds and the default straight out of house.css, so --fs-base,
  // --fs-min and --fs-max are the single source of truth and this file never
  // has to be edited in step with the stylesheet.
  function cssNum(name, fallback) {
    try {
      var v = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue(name));
      return isNaN(v) ? fallback : v;
    } catch (e) { return fallback; }
  }

  var MIN = cssNum('--fs-min', 10);
  var MAX = cssNum('--fs-max', 28);
  var DEFAULT = cssNum('--fs-default', 14);

  function getStored() {
    try {
      var v = parseFloat(localStorage.getItem(STORAGE_KEY));
      return (v >= MIN && v <= MAX) ? v : null;
    } catch (e) { return null; }
  }

  function setStored(px) {
    try { localStorage.setItem(STORAGE_KEY, String(px)); } catch (e) { /* private mode */ }
  }

  function clamp(px) {
    return Math.min(MAX, Math.max(MIN, px));
  }

  function apply(px) {
    document.documentElement.style.setProperty('--fs-base', px + 'px');
  }

  function build() {
    if (document.getElementById('font-size-wrap')) return;

    var current = getStored() || DEFAULT;
    apply(current);

    var wrap = document.createElement('div');
    wrap.id = 'font-size-wrap';
    wrap.innerHTML =
      '<button id="font-size-toggle" aria-label="Change text size" ' +
      'title="Change text size" aria-expanded="false">🔎</button>';

    var panel = document.createElement('div');
    panel.id = 'font-size-panel';
    panel.innerHTML =
      '<button class="fs-cap" id="fs-smaller" aria-label="Smaller text" title="Smaller">🤏</button>' +
      '<input type="range" id="font-size-slider" min="' + MIN + '" max="' + MAX + '" step="1" ' +
      'value="' + current + '" aria-label="Text size">' +
      '<button class="fs-cap" id="fs-larger" aria-label="Larger text" title="Larger">🖐️</button>' +
      '<span id="font-size-value">' + current + 'px</span>' +
      '<button id="font-size-reset" title="Back to the default size">Reset</button>';

    if (global.HouseRail) global.HouseRail.place(wrap, 10); else document.body.appendChild(wrap);
    document.body.appendChild(panel);

    var btn = document.getElementById('font-size-toggle');
    var slider = document.getElementById('font-size-slider');
    var label = document.getElementById('font-size-value');

    function update(px, persist) {
      px = clamp(px);
      slider.value = px;
      label.textContent = px + 'px';
      apply(px);
      if (persist !== false) setStored(px);
    }

    // Beside the button, wherever it stands in the column; on a narrow screen
    // the slider gets shorter rather than the panel running off the page.
    function placePanel() {
      if (!global.HouseRail || !panel.classList.contains('open')) return;
      var r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      panel.style.right = Math.max(8, vw - r.left + 8) + 'px';
      panel.style.maxWidth = Math.max(160, r.left - 16) + 'px';
      panel.style.top = Math.max(8, r.top + (r.height - panel.offsetHeight) / 2) + 'px';
    }
    global.addEventListener('resize', placePanel);

    function open(state) {
      panel.classList.toggle('open', state);
      btn.setAttribute('aria-expanded', String(state));
      placePanel();
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      open(!panel.classList.contains('open'));
    });

    slider.addEventListener('input', function () { update(Number(slider.value)); });

    // The captions aren't decoration — tapping them nudges by a step, which is
    // far easier than dragging a small thumb on a phone.
    document.getElementById('fs-smaller').addEventListener('click', function () {
      update(Number(slider.value) - 1);
    });
    document.getElementById('fs-larger').addEventListener('click', function () {
      update(Number(slider.value) + 1);
    });
    document.getElementById('font-size-reset').addEventListener('click', function () {
      update(DEFAULT);
    });

    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') open(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  global.HouseFontSize = {
    set: function (px) {
      px = clamp(px);
      apply(px);
      setStored(px);
      var slider = document.getElementById('font-size-slider');
      var label = document.getElementById('font-size-value');
      if (slider) slider.value = px;
      if (label) label.textContent = px + 'px';
    },
    get: function () { return getStored() || DEFAULT; },
    MIN: MIN, MAX: MAX, DEFAULT: DEFAULT
  };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE BIONIC READING
   A 🦾 button in the round-button column. Switched on, it bolds the opening letters
   of every word in the conversation bubbles (.bubble), so the eye has a fixed
   point to land on in each word and can move along the line faster:

       1–3 letters → first 1 bold      I · to · the
       4–6 letters → first 2 bold      went · school
       7+  letters → first 3 bold      yesterday

   Only letters count towards the length, so "I've" is a 3-letter word and
   "don't" a 4-letter one. Punctuation, numbers and emoji are left alone.

   It never shows together with the 🎵 pronunciation marks: switching either
   one on switches the other off.

   The extra markup exists only while the mode is ON and is removed completely
   when it is switched off, so scripts that read or measure bubble text (the
   stick figures over words, for instance) see the page exactly as authored
   unless the learner asks for bionic reading. Bubbles added or re-rendered
   later are picked up automatically, and a `resize` event is fired after each
   switch so anything laid out against the words re-measures itself.

   The button only appears on pages that have speech bubbles or a visual novel
   (house-vn.js bolds its own text from the same switch), and the choice
   is remembered across pages like the theme and the text size.

     HouseBionic.set(true);     // switch from a page's own script
     HouseBionic.get();         // → true / false
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'bionic-preference';
  var SELECTOR = '.bubble';
  var STYLE_ID = 'house-bionic-styles';

  // Only the bold letters: the button itself is a HouseRail button.
  var CSS = '.bionic-b{ font-weight:700; }';
  var PRESENCE = '.bubble, .vn';   // pages that get the button

  // Latin letters including accented ones (but not × and ÷), with internal
  // apostrophes kept inside the word: I've, don't, o'clock.
  var L = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F';
  var WORD = new RegExp('[' + L + ']+(?:[\'\u2019][' + L + ']+)*', 'g');
  var APOS = /['\u2019]/;

  // Never bolded: form fields, and the drawings (stick figures, pronunciation marks) inside a bubble.
  var SKIP = 'input, textarea, select, script, style, svg, [contenteditable]';

  var on = false;
  var btn = null;
  var queued = false;

  function getStored() {
    try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch (e) { return false; }
  }
  function setStored(state) {
    try { localStorage.setItem(STORAGE_KEY, state ? 'on' : 'off'); } catch (e) { /* private mode */ }
  }

  function boldCount(letters) {
    return letters <= 3 ? 1 : (letters <= 6 ? 2 : 3);
  }

  // Index in `word` where the bold part ends, counting letters only.
  function cutIndex(word) {
    var letters = word.replace(/['\u2019]/g, '').length;
    var want = boldCount(letters);
    var seen = 0;
    for (var i = 0; i < word.length; i++) {
      if (!APOS.test(word.charAt(i))) seen++;
      if (seen === want) return i + 1;
    }
    return word.length;
  }

  // A bubble's words are read across its inline pieces, so a word the
  // pronunciation marks have split into letter spans (w·e·nt) is still one
  // word: only its opening letters are bolded, whichever spans they sit in.
  // Each bold run is a <span class="bionic-w bionic-b"> round those letters
  // and nothing else, so stripping it leaves the page's own markup intact.
  // Stick-figure words have no spaces between their units, so a unit boundary
  // counts as one.
  function boldBubble(bubble) {
    var has = bubble.querySelector('.bionic-w');
    if (has && bubble._bionicSig === bubble.textContent) return false;   // done, and unchanged since
    if (has) stripIn(bubble);

    var walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], text = '', prevUnit = null, n;
    while ((n = walker.nextNode())) {
      var parent = n.parentNode;
      if (!n.nodeValue || (parent && parent.closest && parent.closest(SKIP))) continue;
      var unit = parent.closest('.ss-unit');
      if (nodes.length && unit !== prevUnit) text += ' ';
      prevUnit = unit;
      nodes.push({ node: n, from: text.length });
      text += n.nodeValue;
    }

    var runs = [], m;
    WORD.lastIndex = 0;
    while ((m = WORD.exec(text))) runs.push([m.index, m.index + cutIndex(m[0])]);

    // From the last text node back, and right to left inside each, so the
    // offsets still to be wrapped never move.
    for (var i = nodes.length - 1; i >= 0; i--) {
      var t = nodes[i], a = t.from, z = a + t.node.nodeValue.length;
      for (var k = runs.length - 1; k >= 0; k--) {
        var s0 = Math.max(a, runs[k][0]), e0 = Math.min(z, runs[k][1]);
        if (s0 >= e0) continue;
        var r = document.createRange();
        r.setStart(t.node, s0 - a); r.setEnd(t.node, e0 - a);
        var span = document.createElement('span');
        span.className = 'bionic-w bionic-b';
        r.surroundContents(span);
      }
    }
    bubble._bionicSig = bubble.textContent;
    return runs.length > 0;
  }

  function apply() {   // → true when some bubble was (re)bolded
    var changed = false;
    document.querySelectorAll(SELECTOR).forEach(function (b) { if (boldBubble(b)) changed = true; });
    return changed;
  }

  function stripIn(root) {
    var parents = [];
    root.querySelectorAll('.bionic-w').forEach(function (span) {
      var parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      if (parents.indexOf(parent) === -1) parents.push(parent);
    });
    // Merge the split text back into single nodes, as the page authored it.
    parents.forEach(function (p) { p.normalize(); });
  }

  function strip() { stripIn(document); }

  // Bold letters are wider: the pronunciation marks re-measure.
  function redrawMarks() {
    document.querySelectorAll('.pm-line').forEach(function (el) { if (el._pm && el._pm.draw) el._pm.draw(); });
  }

  function notifyLayout() {
    try { global.dispatchEvent(new Event('resize')); } catch (e) { /* very old browser */ }
  }

  function render() {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Bionic reading: on' : 'Bionic reading: off';
  }

  // Bionic reading and the pronunciation marks never show at the same time:
  // turning one on turns the other off. The marks are switched through their
  // own switch (the page's #pmToggle, or the visual novel's own 🎵), so the
  // page remembers the change the same way as a click. The switch itself is
  // read, not its round copy, which follows it a moment later.
  var PRON_BTNS = ['pmToggle', 'vnPron'];
  function marksOn() {
    return PRON_BTNS.some(function (id) { var b = document.getElementById(id); return !!b && b.getAttribute('aria-pressed') === 'true'; });
  }
  function marksOff() {
    PRON_BTNS.forEach(function (id) { var b = document.getElementById(id); if (b && b.getAttribute('aria-pressed') === 'true') b.click(); });
  }
  var hadMarks = false;
  function watchMarks() {
    var now = marksOn();
    if (now && !hadMarks && on) set(false);   // the marks were just turned on
    hadMarks = now;
  }

  function set(state) {
    on = !!state;
    if (on && marksOn()) marksOff();
    hadMarks = marksOn();
    setStored(on);
    if (on) apply(); else strip();
    redrawMarks();
    render();
    notifyLayout();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildButton() {
    if (btn) return;
    injectStyles();
    btn = global.HouseRail.add({ id: 'bionic-toggle', icon: '🦾', label: 'Bionic reading', order: 50,
      pressed: false, onClick: function () { set(!on); } });
    render();
  }

  // Runs on load and after any DOM change (batched to one pass per frame):
  // shows the button once bubbles exist, and wraps any new bubble text while
  // the mode is on. Its own wrapping triggers one more pass, which finds
  // nothing left to wrap and so settles immediately.
  function sync() {
    queued = false;
    if (!document.querySelector(PRESENCE)) return;
    if (!btn) {
      buildButton();
      if (getStored()) { set(true); return; }
    }
    if (on && apply()) redrawMarks();
  }

  function queue() {
    if (queued) return;
    queued = true;
    (global.requestAnimationFrame || setTimeout)(sync);
  }

  function start() {
    sync();
    var rail = document.getElementById('house-rail');
    if (rail && global.MutationObserver) {
      hadMarks = marksOn();
      new MutationObserver(watchMarks).observe(rail, { attributes: true, attributeFilter: ['aria-pressed'], subtree: true, childList: true });
    }
    if (global.MutationObserver) {
      new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  global.HouseBionic = {
    set: function (state) { if (!btn) buildButton(); set(state); },
    get: function () { return on; },
    refresh: sync
  };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE RANDOM GENERATOR
   The 🎲 prompt generator behind the freer-practice speaking activities.
   Roll, read the prompt aloud, let your partner answer, pass the dice on.

   Three shapes of generator existed across the library; this covers all of them.

   1. A flat list of ready-made prompts:

        HouseRandomGen.build({
          items: QUESTIONS            // [{icon, label, text}]
        });

   2. Prompts assembled from slots, so the pool is combinatorial rather than
      fixed — pass `pick`, which returns one freshly built prompt per roll:

        HouseRandomGen.build({
          pick: function () {
            var s = HouseRandomGen.pickFrom(SUBJECTS);
            var t = HouseRandomGen.pickFrom(TOPICS);
            return { icon:t.icon, label:t.name,
                     text: s.do + ' ' + s.label + ' ' + HouseRandomGen.pickFrom(t.complements) + '?' };
          }
        });

   3. Anything else — supply `render` and return whatever HTML the card needs.

   Element ids default to the ones every freer page already uses (`qCard`,
   `diceBtn`, `rollCount`), so most pages need only `items` or `pick`.

   An immediate repeat is always avoided: a prompt never follows itself, which
   otherwise happens often enough with small pools to feel broken.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function pickFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function defaultRender(item) {
    var head = (item.icon ? item.icon + ' ' : '') + (item.label || '');
    return (head.trim() ? '<span class="q-topic">' + head.trim() + '</span>' : '') +
           '<span class="q-text">' + (item.text || item.question || '') + '</span>';
  }

  function defaultKey(item) {
    return item.text || item.question || JSON.stringify(item);
  }

  function build(opts) {
    opts = opts || {};

    var card = document.getElementById(opts.card || 'qCard');
    var btn = document.getElementById(opts.button || 'diceBtn');
    var countEl = document.getElementById(opts.countEl || 'rollCount');
    if (!card || !btn) return;

    var items = opts.items || null;
    var pick = opts.pick || (items ? function () { return pickFrom(items); } : null);
    if (!pick) return;

    var render = opts.render || defaultRender;
    var key = opts.key || defaultKey;

    var count = 0;
    var lastKey = null;

    function roll() {
      var item, tries = 0;
      // Small pools repeat often, so re-draw a few times rather than let the
      // same prompt come up twice in a row.
      do {
        item = pick();
        tries++;
      } while (items && items.length > 1 && key(item) === lastKey && tries < 8);
      lastKey = key(item);

      card.innerHTML = render(item);

      // Removing and forcing a reflow before re-adding restarts the CSS
      // animation; without the reflow the browser coalesces the two changes
      // and the card never animates on the second roll onwards.
      card.classList.remove('roll');
      void card.offsetWidth;
      card.classList.add('roll');

      count++;
      if (countEl) countEl.textContent = count;
      return item;
    }

    btn.addEventListener('click', roll);

    return { roll: roll, reset: function () { count = 0; lastKey = null; if (countEl) countEl.textContent = 0; } };
  }

  global.HouseRandomGen = { build: build, pickFrom: pickFrom };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE MATCHING
   Two-column tap-to-match. Tap an item on the left, then its partner on the
   right. A correct pair locks in place and a connector line is drawn across
   the gutter between the columns — from the middle of the left item's right
   edge to the middle of the right item's left edge, with a circle cap at each
   end. A wrong pair flashes and clears.

   Usage:
     HouseMatching.build({
       left:  'leftCol',           // element id of the left column
       right: 'rightCol',          // element id of the right column
       pairs: PAIRS,               // [{id, left, right, leftEmoji, rightEmoji}]
       scoreEl: 'score', totalEl: 'total',
       resetBtn: 'resetBtn', winEl: 'winMsg', feedbackEl: 'feedback'
     });

   Pages with a progress bar rather than a plain counter pass `onScore`:
     HouseMatching.build({ …, onScore: function (done, total) { … } });

   Pages that name their pair fields differently can say so:
     HouseMatching.build({ left:'nouns-col', right:'defs-col', pairs: pairs,
                           leftKey:'noun', rightKey:'def' });

   The lines are laid over the columns' common ancestor and recomputed whenever
   anything resizes — which matters here, because the 🔎 text-size slider
   reflows the cards underneath them.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(id) {
    return typeof id === 'string' ? document.getElementById(id) : id;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function commonAncestor(a, b) {
    var node = a;
    while (node && !node.contains(b)) node = node.parentElement;
    return node || a.parentElement;
  }

  function build(opts) {
    var leftEl = el(opts.left);
    var rightEl = el(opts.right);
    if (!leftEl || !rightEl) return;

    var pairs = opts.pairs || [];
    var leftKey = opts.leftKey || 'left';
    var rightKey = opts.rightKey || 'right';
    var leftEmojiKey = opts.leftEmojiKey || 'leftEmoji';
    var rightEmojiKey = opts.rightEmojiKey || 'rightEmoji';
    var cardClass = opts.cardClass || 'match-card';

    var scoreEl = el(opts.scoreEl);
    var totalEl = el(opts.totalEl);
    var winEl = el(opts.winEl);
    var feedbackEl = el(opts.feedbackEl);
    var resetBtn = el(opts.resetBtn);

    // Pairs may not carry an id of their own; fall back to the index.
    pairs = pairs.map(function (p, i) {
      return {
        id: p.id != null ? String(p.id) : 'p' + i,
        left: p[leftKey], right: p[rightKey],
        leftEmoji: p[leftEmojiKey] || '', rightEmoji: p[rightEmojiKey] || ''
      };
    });

    if (totalEl) totalEl.textContent = pairs.length;

    // ── connector layer ──────────────────────────────────────────────────
    var stage = commonAncestor(leftEl, rightEl);
    stage.classList.add('match-stage');
    // Several pages set their column gap inline, which would beat a class, so
    // widen the gutter here — the connector needs room to read as a line.
    stage.style.columnGap = 'var(--match-gap)';

    var svg = stage.querySelector(':scope > .match-lines');
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'match-lines');
      svg.setAttribute('aria-hidden', 'true');
      stage.appendChild(svg);
    }

    var links = [];   // [{ id, a: leftCard, b: rightCard }]

    function drawLinks() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var base = stage.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + base.width + ' ' + base.height);
      svg.setAttribute('width', base.width);
      svg.setAttribute('height', base.height);

      links.forEach(function (link) {
        if (!link.a.isConnected || !link.b.isConnected) return;
        var ra = link.a.getBoundingClientRect();
        var rb = link.b.getBoundingClientRect();
        // Middle of the left card's right edge → middle of the right card's left edge.
        var x1 = ra.right - base.left, y1 = ra.top - base.top + ra.height / 2;
        var x2 = rb.left - base.left, y2 = rb.top - base.top + rb.height / 2;

        var line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('class', 'match-line');
        svg.appendChild(line);

        [[x1, y1], [x2, y2]].forEach(function (pt) {
          var dot = document.createElementNS(SVG_NS, 'circle');
          dot.setAttribute('cx', pt[0]); dot.setAttribute('cy', pt[1]);
          dot.setAttribute('r', 4);
          dot.setAttribute('class', 'match-dot');
          svg.appendChild(dot);
        });
      });
    }

    // Cards reflow when the window resizes and when the text-size slider moves,
    // so the lines have to be recomputed rather than drawn once.
    if (global.ResizeObserver) {
      var ro = new ResizeObserver(function () { drawLinks(); });
      ro.observe(stage);
      ro.observe(leftEl);
      ro.observe(rightEl);
    }
    global.addEventListener('resize', drawLinks);

    // ── game state ───────────────────────────────────────────────────────
    var matched = 0, pickedLeft = null, pickedRight = null;

    function cardHtml(text, emoji) {
      return (emoji ? '<span class="emoji">' + emoji + '</span>' : '') +
             '<span>' + text + '</span>';
    }

    function makeCard(pair, side) {
      var card = document.createElement('div');
      card.className = cardClass;
      card.dataset.id = pair.id;
      card.dataset.side = side;
      card.innerHTML = side === 'left'
        ? cardHtml(pair.left, pair.leftEmoji)
        : cardHtml(pair.right, pair.rightEmoji);
      card.addEventListener('click', function () { onPick(card); });
      return card;
    }

    function setFeedback(text, kind) {
      if (!feedbackEl) return;
      feedbackEl.textContent = text || '';
      feedbackEl.className = 'feedback' + (kind ? ' ' + kind : '');
    }

    function onPick(card) {
      if (card.classList.contains('matched')) return;

      if (card.dataset.side === 'left') {
        if (pickedLeft) pickedLeft.classList.remove('selected');
        pickedLeft = card;
      } else {
        if (pickedRight) pickedRight.classList.remove('selected');
        pickedRight = card;
      }
      card.classList.add('selected');

      if (!(pickedLeft && pickedRight)) return;

      var a = pickedLeft, b = pickedRight;
      pickedLeft = pickedRight = null;

      if (a.dataset.id === b.dataset.id) {
        a.classList.remove('selected');
        b.classList.remove('selected');
        a.classList.add('matched');
        b.classList.add('matched');
        links.push({ id: a.dataset.id, a: a, b: b });
        drawLinks();
        matched++;
        if (scoreEl) scoreEl.textContent = matched;
        if (opts.onScore) opts.onScore(matched, pairs.length);
        setFeedback('✓ Correct!', 'success');
        if (matched === pairs.length) {
          if (winEl) winEl.classList.add('show');
          setFeedback('🎉 All matched!', 'success');
        }
      } else {
        a.classList.add('wrong');
        b.classList.add('wrong');
        setFeedback('✗ Not a match — try again.', 'error');
        setTimeout(function () {
          a.classList.remove('selected', 'wrong');
          b.classList.remove('selected', 'wrong');
        }, 420);
      }
    }

    function render() {
      leftEl.innerHTML = '';
      rightEl.innerHTML = '';
      links = [];
      matched = 0;
      pickedLeft = pickedRight = null;
      if (scoreEl) scoreEl.textContent = 0;
      if (opts.onScore) opts.onScore(0, pairs.length);
      if (winEl) winEl.classList.remove('show');
      setFeedback('');

      // Shuffled independently, or the two columns would line up row for row.
      shuffle(pairs).forEach(function (p) { leftEl.appendChild(makeCard(p, 'left')); });
      shuffle(pairs).forEach(function (p) { rightEl.appendChild(makeCard(p, 'right')); });
      drawLinks();
    }

    if (resetBtn) resetBtn.addEventListener('click', render);
    render();

    return { render: render, redraw: drawLinks };
  }

  global.HouseMatching = { build: build };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE MEMORY
   The memory (pairs) game. Every pair is two cards — a word and its picture,
   or a word and its meaning — dealt face down in a shuffled grid. Tap two cards:
   if they are a pair they stay face up and turn green; if not, they shake and
   turn back over, and the learner tries to remember where they were. The game
   ends when every pair is found; the number of moves (two flips = one move) is
   the score to beat.

   Usage, close to HouseMatching on purpose — the same pairs work in both:
     HouseMemory.build({
       container: 'memGrid',       // element id (or element) for the grid
       pairs: PAIRS,               // [{id, a, b, aEmoji, bEmoji}]
       scoreEl: 'memScore',        // pairs found
       totalEl: 'memTotal',        // pairs in the game
       movesEl: 'memMoves',        // moves so far
       winEl: 'memWin',            // gets .show at the end
       feedbackEl: 'memFeedback',
       resetBtn: 'memReset'        // deals again, shuffled
     });

   Pages that name their pair fields differently say so, as with HouseMatching:
     HouseMemory.build({ …, aKey: 'word', bKey: 'def' });

   A card face is a word, a picture (an emoji on its own is shown big) or a
   longer text such as a definition (shown smaller, so it fits). A card can
   carry both, e.g. a: 'tea', aEmoji: '🍵'.

   Hooks:
     onFlip(card, pair, side)   a card was turned face up — side is 'a' or 'b'
                                (pages use it to say the word aloud)
     onScore(found, total)      after every pair found, and 0 on a new deal
     onWin(moves)               when the last pair is found

   Returns { render, reset }. Styles are self-injected, like the error hunt's,
   and every size is in rem so the 🔎 slider scales the cards. With
   prefers-reduced-motion the cards change face without the 3D turn.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'house-memory-styles';
  var CSS = ''
    + '.hm-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(7.2rem, 1fr)); gap:.6rem; margin-bottom:.9rem; }'
    + '.hm-card{ position:relative; min-height:7.2rem; padding:0; border:none; background:none; perspective:900px; cursor:pointer; font-family:inherit; color:var(--text-primary); border-radius:var(--border-radius-lg); }'
    + '.hm-card:hover{ background:none; }'
    + '.hm-card:active{ transform:none; }'
    + '.hm-card:focus-visible{ outline:2px solid var(--text-accent); outline-offset:3px; }'
    + '.hm-inner{ position:absolute; inset:0; transition:transform .45s cubic-bezier(.3,.7,.4,1); transform-style:preserve-3d; }'
    + '.hm-card.up .hm-inner{ transform:rotateY(180deg); }'
    + '.hm-face{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.25rem; padding:.45rem .5rem; border-radius:var(--border-radius-lg); backface-visibility:hidden; -webkit-backface-visibility:hidden; overflow:hidden; text-align:center; line-height:1.3; }'
    + '.hm-back{ background:var(--color-background-info); border:1.5px solid var(--color-border-info); color:var(--color-text-info); font-size:1.6rem; font-weight:700;'
    +   ' background-image:radial-gradient(circle at 1px 1px, var(--color-border-info) 1px, transparent 1.4px); background-size:.9rem .9rem; }'
    + '.hm-card:hover .hm-back{ border-color:var(--text-accent); }'
    + '.hm-front{ transform:rotateY(180deg); background:var(--surface-2); border:1.5px solid var(--color-border-secondary); font-size:1rem; font-weight:600; }'
    + '.hm-front.hm-pic .hm-emoji{ font-size:2.6rem; line-height:1; }'
    + '.hm-emoji{ font-size:1.6rem; line-height:1; }'
    + '.hm-front.hm-long{ font-size:.78rem; font-weight:500; }'
    + '.hm-front.hm-mid{ font-size:.88rem; font-weight:500; }'
    + '.hm-card.found .hm-front{ border-color:var(--good); background:var(--good-bg); color:var(--good); }'
    + '.hm-card.found{ cursor:default; }'
    + '.hm-card.miss .hm-front{ border-color:var(--bad); background:var(--bad-bg); color:var(--bad); animation:hm-shake .32s; }'
    + '.hm-card.found .hm-inner{ animation:hm-pop .35s ease; }'
    + '@keyframes hm-shake{ 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(-4px); } 75%{ transform:translateX(4px); } }'
    + '@keyframes hm-pop{ 0%{ transform:rotateY(180deg) scale(1); } 50%{ transform:rotateY(180deg) scale(1.06); } 100%{ transform:rotateY(180deg) scale(1); } }'
    + '.hm-bar{ display:flex; flex-wrap:wrap; gap:.4rem 1rem; align-items:center; font-size:.8667rem; color:var(--text-secondary); margin-bottom:.55rem; }'
    + '.hm-bar strong{ color:var(--text-primary); }'
    + '@media (prefers-reduced-motion: reduce){ .hm-inner{ transition:none; } .hm-card.found .hm-inner, .hm-card.miss .hm-front{ animation:none; } }';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function el(id) { return typeof id === 'string' ? document.getElementById(id) : id; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // An emoji on its own (one picture, maybe with skin tone / joiners / keycap) — shown big.
  var PIC_ONLY = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣)(?:[️‍⃣]|\p{Emoji_Modifier}|\p{Extended_Pictographic})*$/u;

  function build(opts) {
    var host = el(opts.container);
    if (!host) return;
    injectStyles();

    var aKey = opts.aKey || 'a', bKey = opts.bKey || 'b';
    var aEmojiKey = opts.aEmojiKey || 'aEmoji', bEmojiKey = opts.bEmojiKey || 'bEmoji';
    var delay = opts.delay || 950;
    var scoreEl = el(opts.scoreEl), totalEl = el(opts.totalEl), movesEl = el(opts.movesEl);
    var winEl = el(opts.winEl), feedbackEl = el(opts.feedbackEl), resetBtn = el(opts.resetBtn);

    var pairs = (opts.pairs || []).map(function (p, i) {
      return { id: p.id != null ? String(p.id) : 'p' + i, a: p[aKey], b: p[bKey], aEmoji: p[aEmojiKey] || '', bEmoji: p[bEmojiKey] || '', src: p };
    });

    host.classList.add('hm-grid');
    host.setAttribute('role', 'grid');
    if (totalEl) totalEl.textContent = pairs.length;

    var up = [], found = 0, moves = 0, locked = false, timer = 0;

    function setFeedback(text, kind) {
      if (!feedbackEl) return;
      feedbackEl.textContent = text || '';
      feedbackEl.className = 'feedback' + (kind ? ' ' + kind : '');
    }

    function faceHtml(text, emoji) {
      var t = text == null ? '' : String(text);
      var picOnly = !t && emoji ? true : PIC_ONLY.test(t.trim());
      var cls = picOnly ? ' hm-pic' : (t.length > 48 ? ' hm-long' : (t.length > 18 ? ' hm-mid' : ''));
      var inner = '';
      if (picOnly) inner = '<span class="hm-emoji">' + esc(emoji || t) + '</span>';
      else inner = (emoji ? '<span class="hm-emoji" aria-hidden="true">' + esc(emoji) + '</span>' : '') + '<span>' + esc(t) + '</span>';
      return { cls: cls, html: inner, label: t || emoji };
    }

    function makeCard(pair, side, n) {
      var face = side === 'a' ? faceHtml(pair.a, pair.aEmoji) : faceHtml(pair.b, pair.bEmoji);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'hm-card';
      card.dataset.id = pair.id;
      card.dataset.side = side;
      card._label = face.label;
      card._n = n;
      card.setAttribute('aria-label', 'Card ' + n + ', face down');
      card.innerHTML = '<span class="hm-inner"><span class="hm-face hm-back" aria-hidden="true">?</span>' +
        '<span class="hm-face hm-front' + face.cls + '">' + face.html + '</span></span>';
      card.addEventListener('click', function () { flip(card, pair); });
      return card;
    }

    function turnDown(cards) {
      cards.forEach(function (c) {
        c.classList.remove('up', 'miss');
        c.setAttribute('aria-label', 'Card ' + c._n + ', face down');
      });
    }

    function flip(card, pair) {
      if (card.classList.contains('found') || card.classList.contains('up')) return;
      // A third tap while two wrong cards are still showing turns them over at once.
      if (locked) { clearTimeout(timer); turnDown(up); up = []; locked = false; }

      card.classList.add('up');
      card.setAttribute('aria-label', 'Card ' + card._n + ': ' + card._label);
      up.push(card);
      if (opts.onFlip) opts.onFlip(card, pair.src, card.dataset.side);
      if (up.length < 2) { setFeedback(''); return; }

      moves++;
      if (movesEl) movesEl.textContent = moves;
      var a = up[0], b = up[1];
      if (a.dataset.id === b.dataset.id) {
        up = [];
        [a, b].forEach(function (c) { c.classList.add('found'); c.setAttribute('aria-disabled', 'true'); });
        found++;
        if (scoreEl) scoreEl.textContent = found;
        if (opts.onScore) opts.onScore(found, pairs.length);
        if (found === pairs.length) {
          if (winEl) winEl.classList.add('show');
          setFeedback('🎉 All pairs found in ' + moves + ' moves!', 'success');
          if (opts.onWin) opts.onWin(moves);
        } else {
          setFeedback('✓ A pair!', 'success');
        }
      } else {
        locked = true;
        a.classList.add('miss'); b.classList.add('miss');
        setFeedback('✗ Not a pair. Remember where they are!', 'error');
        timer = setTimeout(function () { turnDown(up); up = []; locked = false; }, delay);
      }
    }

    function render() {
      clearTimeout(timer);
      up = []; found = 0; moves = 0; locked = false;
      if (scoreEl) scoreEl.textContent = 0;
      if (movesEl) movesEl.textContent = 0;
      if (opts.onScore) opts.onScore(0, pairs.length);
      if (winEl) winEl.classList.remove('show');
      setFeedback('');
      host.innerHTML = '';
      var cards = [];
      pairs.forEach(function (p) { cards.push([p, 'a'], [p, 'b']); });
      shuffle(cards).forEach(function (c, i) { host.appendChild(makeCard(c[0], c[1], i + 1)); });
    }

    if (resetBtn) resetBtn.addEventListener('click', render);
    render();
    return { render: render, reset: render };
  }

  global.HouseMemory = { build: build };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE TIMELINE
   The tense timeline used on clarification pages. Every tense page was drawing
   its own SVG by hand, which is why no two of them lined up; this generates the
   whole thing from data instead.

     HouseTimeline.build({
       container: 'timeline',
       startLabel: 'Past',
       nowLabel: 'NOW',
       nowNote: 'speaking now',
       events: [
         { at: 0.30, emoji: '🏔️', label: 'went to the mountains', kind: 'point' }
       ],
       caption: 'A finished action at a definite time before now.'
     });

   `at` is a fraction of the way along the line (0 = start, 1 = now), so an
   event keeps its position whatever the viewport does.

   `kind` controls the stem:
     'point'        solid  — a definite moment  (simple past)
     'unspecified'  dashed — we don't say when  (present perfect)

   A shaded band marks a period of time that the events sit inside:

     bands: [{ from: 0.10, to: 0.76, label: 'last weekend' }]

   Bands are drawn behind the line and the events, so an event placed within
   `from`..`to` reads as happening during that period.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var W = 680, H = 232;
  var X0 = 46, X1 = 600, Y = 142;

  // Vertical extent of a period band: high enough to clear the emoji row,
  // deep enough to enclose the event captions underneath the line.
  var BAND_TOP = 40, BAND_BOTTOM = Y + 56;

  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function xAt(f) {
    return X0 + (X1 - X0) * Math.max(0, Math.min(1, f));
  }

  function build(opts) {
    var host = typeof opts.container === 'string'
      ? document.getElementById(opts.container) : opts.container;
    if (!host) return;

    host.classList.add('timeline-wrap');
    host.innerHTML = '';

    // ── sequence mode ────────────────────────────────────────────────────
    // Ordering lessons (first / then / finally) are not about time relative to
    // now, so they get numbered stops along an arrow rather than a past→now
    // line. Same component, because it is the same idea of position in time.
    if (opts.steps) {
      var strip = document.createElement('ol');
      strip.className = 'seq-strip';
      opts.steps.forEach(function (st) {
        var li = document.createElement('li');
        li.className = 'seq-step';
        li.innerHTML =
          (st.emoji ? '<span class="seq-emoji">' + st.emoji + '</span>' : '') +
          '<span class="seq-word">' + (st.word || '') + '</span>' +
          (st.example ? '<span class="seq-example">' + st.example + '</span>' : '');
        strip.appendChild(li);
      });
      host.appendChild(strip);
      if (opts.caption) {
        var cap = document.createElement('p');
        cap.className = 'seq-caption';
        cap.innerHTML = opts.caption;
        host.appendChild(cap);
      }
      return;
    }

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      xmlns: NS,
      role: 'img',
      'aria-label': opts.caption || 'Timeline'
    });

    var events = opts.events || [];

    // Older pages wrote a period as an event with kind:'span'; treat those as
    // bands so both spellings land on the same rendering.
    var bands = (opts.bands || []).slice();
    events.forEach(function (ev) {
      if (ev.kind === 'span') bands.push(ev);
    });

    // ── period bands, behind everything else ─────────────────────────────
    bands.forEach(function (b) {
      var a = xAt(b.from), z = xAt(b.to);
      var fill = b.fill || 'var(--pos-time-bg)';
      var line = b.colour || 'var(--pos-time)';
      svg.appendChild(el('rect', {
        x: a, y: BAND_TOP, width: Math.max(4, z - a), height: BAND_BOTTOM - BAND_TOP,
        rx: 14, fill: fill, stroke: line, 'stroke-width': 1.5, 'stroke-dasharray': '5,4'
      }));
      if (b.label) {
        svg.appendChild(el('text', {
          x: (a + z) / 2, y: BAND_TOP - 10, 'font-size': 12, 'font-weight': 700,
          fill: line, 'text-anchor': 'middle'
        }, b.label));
      }
    });

    // ── the line itself ──────────────────────────────────────────────────
    svg.appendChild(el('line', {
      x1: X0, y1: Y, x2: X1, y2: Y,
      stroke: 'var(--color-border-secondary)', 'stroke-width': 3, 'stroke-linecap': 'round'
    }));
    svg.appendChild(el('circle', { cx: X0, cy: Y, r: 5, fill: 'var(--text-muted)' }));
    svg.appendChild(el('text', {
      x: X0, y: Y + 25, 'font-size': 12,
      fill: 'var(--color-text-secondary)', 'text-anchor': 'middle'
    }, opts.startLabel || 'Past'));

    // ── point events ─────────────────────────────────────────────────────
    events.forEach(function (ev) {
      if (ev.kind === 'span') return;
      var x = xAt(ev.at);
      var colour = ev.colour || 'var(--pos-verb)';
      var stem = { x1: x, y1: Y, x2: x, y2: Y - 40, stroke: colour, 'stroke-width': 2 };
      if (ev.kind === 'unspecified') stem['stroke-dasharray'] = '3,3';
      svg.appendChild(el('line', stem));
      svg.appendChild(el('circle', { cx: x, cy: Y, r: 5, fill: colour }));
      if (ev.emoji) {
        svg.appendChild(el('text', {
          x: x, y: Y - 54, 'font-size': 22, 'text-anchor': 'middle'
        }, ev.emoji));
      }
      if (ev.label) {
        svg.appendChild(el('text', {
          x: x, y: Y + 46, 'font-size': 10.5,
          fill: 'var(--color-text-secondary)', 'text-anchor': 'middle'
        }, ev.label));
      }
    });

    // ── the NOW marker ───────────────────────────────────────────────────
    if (opts.nowLabel !== false) {
      svg.appendChild(el('line', {
        x1: X1, y1: Y, x2: X1, y2: Y - 40,
        stroke: 'var(--text-accent)', 'stroke-width': 2.5
      }));
      svg.appendChild(el('circle', { cx: X1, cy: Y, r: 7, fill: 'var(--text-accent)' }));
      svg.appendChild(el('text', {
        x: X1, y: Y - 60, 'font-size': 13, 'font-weight': 700,
        fill: 'var(--text-accent)', 'text-anchor': 'middle'
      }, opts.nowLabel || 'NOW'));
      if (opts.nowNote) {
        svg.appendChild(el('text', {
          x: X1, y: Y + 26, 'font-size': 10.5,
          fill: 'var(--color-text-secondary)', 'text-anchor': 'middle'
        }, opts.nowNote));
      }
    }

    if (opts.caption) {
      svg.appendChild(el('text', {
        x: W / 2 - 20, y: H - 15, 'font-size': 11,
        fill: 'var(--color-text-tertiary)', 'text-anchor': 'middle', 'font-style': 'italic'
      }, opts.caption));
    }

    host.appendChild(svg);
  }

  global.HouseTimeline = { build: build };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE FORM CLARF — guided discovery of a structure's form
   The learner sees the same structure in affirmative, negative and question
   form, and labels each part by putting a part-of-speech chip in the drop zone
   ABOVE it. Working out that "did" sits in the same slot as "didn't", and that
   the main verb goes back to its plain form in both, is the discovery; being
   told it in a rule box is not.

     HouseFormClarf.build({
       container: 'formClarf',
       pool: ['subject', 'aux', 'neg', 'verb', 'object'],
       items: [
         { form: 'aff', parts: [['I','subject'], ['went','verb'], ['to the mountains','object']] },
         { form: 'neg', parts: [['I','subject'], ["didn't",'neg'], ['buy','verb'], ['anything','object']] },
         { form: 'q',   parts: [['Did','aux'], ['you','subject'], ['go','verb'], ['anywhere?','object']] }
       ]
     });

   A part with `null` for its label is punctuation or filler — it renders with
   no drop zone and is not scored.

   The pool is a palette, not a hand: chips are reused, because several words in
   the same sentence share a part of speech. Tap a chip then tap a zone, or drag
   it — both work, because this has to be usable on a phone.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var LABELS = {
    wh: 'Wh-word', aux: 'Auxiliary', subject: 'Subject', verb: 'Verb',
    part: 'Past participle', object: 'Object', complement: 'Complement',
    noun: 'Noun', det: 'Determiner', adj: 'Adjective', adverb: 'Adverb',
    time: 'Time expression', prep: 'Preposition', conj: 'Conjunction',
    neg: 'Negative', none: 'Other'
  };

  var FORM_LABEL = {
    aff: 'affirmative', neg: 'negative',
    q: 'yes / no question', wh: 'wh- question'
  };
  // `wh` borrows the celebration pill colour so a wh- question is visibly a
  // different move from a yes/no question rather than a variant of it.
  var FORM_CAT = { aff: 'pos', neg: 'neg', q: 'q', wh: 'cel' };

  function build(opts) {
    var host = typeof opts.container === 'string'
      ? document.getElementById(opts.container) : opts.container;
    if (!host) return;

    var items = opts.items || [];
    var pool = opts.pool || [];
    var scoreEl = opts.scoreEl ? document.getElementById(opts.scoreEl) : null;
    var totalEl = opts.totalEl ? document.getElementById(opts.totalEl) : null;

    host.classList.add('fc-wrap');
    host.innerHTML = '';

    // ── the palette ──────────────────────────────────────────────────────
    var palette = document.createElement('div');
    palette.className = 'fc-pool';
    pool.forEach(function (key) {
      var chip = document.createElement('button');
      chip.className = 'fc-chip pos-' + key;
      chip.dataset.pos = key;
      chip.textContent = LABELS[key] || key;
      palette.appendChild(chip);
    });
    host.appendChild(palette);

    var total = 0;
    items.forEach(function (it) {
      it.parts.forEach(function (p) { if (p[1]) total++; });
    });
    if (totalEl) totalEl.textContent = total;
    var correct = 0;

    // ── the sentences ────────────────────────────────────────────────────
    items.forEach(function (item, idx) {
      var card = document.createElement('div');
      card.className = 'fc-item';
      if (item.form) {
        var tag = document.createElement('span');
        tag.className = 'cat-tag ' + (FORM_CAT[item.form] || 'pos');
        tag.textContent = FORM_LABEL[item.form] || item.form;
        card.appendChild(tag);
      }

      var row = document.createElement('div');
      row.className = 'fc-sentence';

      item.parts.forEach(function (part, pi) {
        var word = part[0], answer = part[1];
        var col = document.createElement('div');
        col.className = 'fc-col';

        if (answer) {
          var zone = document.createElement('div');
          zone.className = 'fc-zone';
          zone.dataset.answer = answer;
          zone.dataset.item = idx;
          zone.dataset.part = pi;
          zone.setAttribute('role', 'button');
          zone.setAttribute('tabindex', '0');
          col.appendChild(zone);
        } else {
          var spacer = document.createElement('div');
          spacer.className = 'fc-zone fc-zone-none';
          col.appendChild(spacer);
        }

        var w = document.createElement('div');
        w.className = 'fc-word';
        w.textContent = word;
        col.appendChild(w);
        row.appendChild(col);
      });

      card.appendChild(row);
      host.appendChild(card);
    });

    // ── interaction ──────────────────────────────────────────────────────
    var picked = null;

    function selectChip(chip) {
      if (picked) picked.classList.remove('selected');
      picked = (picked === chip) ? null : chip;
      if (picked) picked.classList.add('selected');
    }

    function place(zone, key) {
      if (!key || zone.classList.contains('correct')) return;
      zone.textContent = LABELS[key] || key;
      zone.className = 'fc-zone filled pos-' + key;
      if (key === zone.dataset.answer) {
        zone.classList.add('correct');
        zone.classList.remove('filled');
        correct++;
        if (scoreEl) scoreEl.textContent = correct;
        if (correct === total) host.classList.add('fc-done');
      } else {
        zone.classList.add('wrong');
        // Clear it again so the slot is obviously still open, rather than
        // leaving a wrong label sitting there looking answered.
        setTimeout(function () {
          if (zone.classList.contains('correct')) return;
          zone.textContent = '';
          zone.className = 'fc-zone';
        }, 600);
      }
    }

    palette.addEventListener('click', function (e) {
      var chip = e.target.closest('.fc-chip');
      if (chip) selectChip(chip);
    });

    host.addEventListener('click', function (e) {
      var zone = e.target.closest('.fc-zone');
      if (!zone || zone.classList.contains('fc-zone-none')) return;
      if (!picked) return;
      place(zone, picked.dataset.pos);
    });

    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var zone = e.target.closest('.fc-zone');
      if (zone && picked) { e.preventDefault(); place(zone, picked.dataset.pos); }
    });

    // ── dragging ─────────────────────────────────────────────────────────
    // Same shape as the word-order engine: every way a drag can end routes
    // through one cleanup, so a dropped pointer can't leave a chip stuck to
    // the viewport.
    palette.querySelectorAll('.fc-chip').forEach(function (chip) {
      var ghost = null;

      function endDrag(e) {
        if (!ghost) return;
        var drop = document.elementFromPoint(e.clientX, e.clientY);
        ghost.remove();
        ghost = null;
        chip.classList.remove('dragging');
        var zone = drop && drop.closest && drop.closest('.fc-zone');
        if (zone && !zone.classList.contains('fc-zone-none')) {
          place(zone, chip.dataset.pos);
        }
      }

      function cancelDrag() {
        if (ghost) { ghost.remove(); ghost = null; }
        chip.classList.remove('dragging');
      }

      chip.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        chip.setPointerCapture(e.pointerId);
        var moved = false;

        function onMove(ev) {
          if (!moved && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 6) return;
          if (!moved) {
            moved = true;
            chip.classList.add('dragging');
            ghost = chip.cloneNode(true);
            ghost.classList.add('fc-ghost');
            ghost.classList.remove('dragging', 'selected');
            document.body.appendChild(ghost);
          }
          ghost.style.left = ev.clientX + 'px';
          ghost.style.top = ev.clientY + 'px';
        }

        function onUp(ev) {
          chip.removeEventListener('pointermove', onMove);
          chip.removeEventListener('pointerup', onUp);
          chip.removeEventListener('pointercancel', cancelDrag);
          chip.removeEventListener('lostpointercapture', cancelDrag);
          if (moved) { endDrag(ev); ev.preventDefault(); }
        }

        chip.addEventListener('pointermove', onMove);
        chip.addEventListener('pointerup', onUp);
        chip.addEventListener('pointercancel', cancelDrag);
        chip.addEventListener('lostpointercapture', cancelDrag);
      });
    });
  }

  global.HouseFormClarf = { build: build, LABELS: LABELS };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE ERROR HUNT — missing / extra / misplaced / wrong-form word.

   Supersedes the earlier {words, errors:{index:{options,correct,alsoRemove}}}
   item shape entirely. Card chrome, the popover, and every interaction are
   house-owned — a page using this needs no CSS or extra script of its own,
   just the markup below and one build() call.

   Tap any word or any gap between words. Tapping a correct one does nothing,
   by design. Tapping the one erroneous spot opens a 3-way popover, centered
   on and pointing up into the tapped chip:
     ✒️ Insert — for a MISSING word (tapped a gap): pick from 3 word choices,
                 shown in random order so the correct one isn't always first.
                 Also used for a WRONG-FORM word (tapped a word that needs to
                 be replaced, e.g. "test" → "tested"): same 3-choice picker,
                 but it swaps the word in place instead of filling a gap —
                 the button reads "🔄 Replace" for that case instead.
     ❌ Delete — for an EXTRA word: leaves a permanent green "·" in its place
                 (the word is removed, but the position stays visible).
     ↔️ Move   — for a MISPLACED word: prompts "Where to?" and lets the
                 student tap the correct destination gap (never one right
                 after a ".", "?" or "!", since that's not a real position
                 in the sentence). Moving a word into or out of the
                 sentence-initial slot re-capitalizes both words involved
                 automatically.
                 Adjacent swaps: when the misplaced word is only ONE word away
                 from its right place ("Where I can find…"), the move can be
                 started from either word — moving "can" before "I" or "I"
                 after "can" both fix it.
                 Drag: after choosing Move, the student can drag that word
                 onto a gap instead of tapping one (the gaps double as drop
                 targets). A correct drop does the move; a wrong one flashes
                 red, exactly like a wrong tap. Words can't be dragged before
                 Move is chosen.
   A tapped gap only ever offers Insert — deleting or moving "nothing" makes
   no sense. Wrong action/word/destination flashes the offending chip(s) red
   and shakes them, then the popover closes so the student can try again.
   Some sentences can have no error at all (error: null) — OK on those just
   confirms "✓ Correct — nothing was wrong!" instead of "✓ Fixed!".

   Capitals: whenever a word lands in the first slot (a MISSING word inserted
   at gapIndex 0, a move to gap 0, or the first word DELETED), it gets a
   capital letter and the word it pushes out of first place loses its own.
   Some words keep their capital wherever they are. Built in: I (and I'm,
   I'll, I'd, I've), Mr. / Mrs. / Ms. / Dr. / Prof., words with a capital
   inside (TV, OK, McDonald's) and letter-hyphen words (T-shirt, U-turn).
   Add others — names, places — with keepCaps, for the whole set or for one
   item:  build({ …, keepCaps: ['Ben', 'Lima'] })  ·  { words, error, keepCaps: ['Kate'] }

   Usage:
     HouseErrorHunt.build({
       container: 'errorHunt',   // element id (or element) to render into
       items: EH_ITEMS,          // see item shape below
       scoreEl: 'ehScore',       // element id for the running "fixed" count
       totalEl: 'ehTotal',       // element id for the item count
       prompt: 'optional hint shown once above all the sentences',
       keepCaps: ['Ben']         // optional: words that never lose their capital
     });

   Item shape — one of:
     { words: [...], error: null }                                     // no mistake
     { words: [...], error: { type:'missing',   gapIndex,  options, correct } }
     { words: [...], error: { type:'extra',     wordIndex } }
     { words: [...], error: { type:'misplaced', wordIndex, targetGapIndex } }
     { words: [...], error: { type:'wrong',     wordIndex, options, correct } }
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'house-error-hunt-styles';
  var CSS = ''
    + '.eh2-item{ position:relative; border:1px solid var(--color-border-tertiary); border-radius:var(--border-radius-lg); padding:12px 14px; margin-bottom:12px; background:var(--surface-2); transition:background .15s, border-color .15s; }'
    + '.eh2-item.correct{ background:var(--good-bg); border-color:var(--good); }'
    + '.eh2-sentence{ display:flex; flex-wrap:wrap; align-items:center; gap:1px; font-size:15px; line-height:2.3; margin-bottom:8px; }'
    + '.eh2-word, .eh2-gap{ display:inline-flex; align-items:center; justify-content:center; padding:4px 8px; border-radius:8px; cursor:pointer; color:var(--text-primary); border:1px solid transparent; transition:background .12s, border-color .12s; }'
    + '.eh2-word:hover, .eh2-gap:hover{ background:var(--surface-1); border-color:var(--border); }'
    + '.eh2-gap{ min-width:10px; color:var(--text-muted); }'
    + '.eh2-gap::after{ content:"·"; font-weight:700; opacity:0; transition:opacity .12s ease; }'
    + '.eh2-gap:hover::after, .eh2-gap.target-pick::after{ opacity:1; }'
    + '.eh2-gap.target-pick{ background:var(--color-background-info); border-color:var(--text-accent); color:var(--text-accent); }'
    + '.eh2-word.inserted, .eh2-word.moved-in, .eh2-gap.deleted-ok{ color:var(--good); font-weight:600; background:var(--good-bg); border-color:var(--good); cursor:default; }'
    + '.eh2-gap.deleted-ok::after{ content:none; }'
    + '.eh2-word.wrong-flash, .eh2-gap.wrong-flash{ background:var(--bad-bg); border-color:var(--bad); color:var(--bad); animation:eh2-shake .3s; }'
    + '@keyframes eh2-shake{ 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(-4px); } 75%{ transform:translateX(4px); } }'
    + '.eh2-word.active-target, .eh2-gap.active-target{ background:var(--color-background-info); border-color:var(--text-accent); color:var(--text-accent); }'
    + '.eh2-gap.no-dot{ cursor:default; }'
    + '.eh2-gap.no-dot:hover{ background:transparent; border-color:transparent; }'
    + '.eh2-gap.no-dot::after, .eh2-gap.no-dot:hover::after{ content:none; }'
    + '.eh2-menu{ display:none; position:absolute; z-index:20; transform:translateX(-50%); flex-wrap:wrap; align-items:center; justify-content:center; gap:6px; width:max-content; max-width:min(240px, 88vw); padding:8px 10px; background:var(--surface-1); border-radius:10px; border:1px solid var(--border); box-shadow:0 6px 18px rgba(0,0,0,0.16); }'
    + '.eh2-menu.open{ display:flex; }'
    + '.eh2-menu::before{ content:""; position:absolute; top:-6px; left:50%; transform:translateX(-50%); border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:6px solid var(--surface-1); }'
    + '.eh2-menu-hint{ width:100%; text-align:center; font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:2px; }'
    + '.eh2-menu-btn{ font-family:inherit; font-size:13px; font-weight:600; padding:6px 12px; border-radius:999px; border:1px solid var(--border); background:var(--surface-2); color:var(--text-primary); cursor:pointer; }'
    + '.eh2-menu-btn:hover{ background:var(--color-background-tertiary); }'
    + '.eh2-action-btn{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; width:58px; height:58px; padding:4px; font-family:inherit; border-radius:12px; border:1px solid var(--border); background:var(--surface-2); color:var(--text-primary); cursor:pointer; }'
    + '.eh2-action-btn:hover{ background:var(--color-background-tertiary); }'
    + '.eh2-action-emoji{ font-size:20px; line-height:1; }'
    + '.eh2-action-label{ font-size:10.5px; font-weight:600; line-height:1.1; text-align:center; }'
    + '.eh2-ok{ font-family:inherit; font-size:13px; font-weight:600; padding:6px 14px; border-radius:999px; border:none; background:var(--text-accent); color:#fff; cursor:pointer; margin-right:6px; }'
    + '.eh2-verdict{ font-size:13px; margin-top:6px; min-height:18px; }'
    + '.eh2-verdict.correct{ color:var(--good); font-weight:600; }'
    + '.eh2-verdict.incorrect{ color:var(--bad); }'
    + '.eh2-prompt{ font-size:13px; color:var(--text-secondary); margin-bottom:10px; }'
    // drag to move: the original chip fades, a ghost follows the pointer, gaps light up as drop targets
    + '.eh2-word{ user-select:none; -webkit-user-select:none; }'
    + '.eh2-word.movable{ touch-action:none; cursor:grab; background:var(--color-background-info); border-color:var(--text-accent); color:var(--text-accent); }'
    + '.eh2-word.drag-src{ opacity:.35; }'
    + '.eh2-sentence.dragging .eh2-gap:not(.no-dot):not(.drag-self){ background:var(--surface-1); border-color:var(--border); border-style:dashed; }'
    + '.eh2-sentence.dragging .eh2-gap:not(.no-dot):not(.drag-self)::after{ opacity:1; }'
    + '.eh2-sentence.dragging .eh2-gap.drop-hover{ background:var(--color-background-info); border-color:var(--text-accent); border-style:solid; color:var(--text-accent); }'
    + '.eh2-ghost{ position:fixed; z-index:1000; pointer-events:none; padding:4px 10px; border-radius:8px; font-size:15px; font-weight:600; color:var(--text-accent); background:var(--surface-1); border:1px solid var(--text-accent); box-shadow:0 6px 16px rgba(0,0,0,0.2); transform:translate(-50%, -60%); white-space:nowrap; }';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  var ENDERS = ['.', '?', '!'];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function capitalizeFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function decapitalizeFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  // Words that keep their capital letter wherever they are in a sentence.
  var TITLES = /^(Mr|Mrs|Ms|Dr|Prof|St)\.$/;
  function builtInKeepCaps(w) {
    return /^I(['’](m|ll|d|ve|s))?$/.test(w) ||   // I, I'm, I'll…
           TITLES.test(w) ||                       // Mr. Smith
           /^[A-Z][-.]/.test(w) ||                 // T-shirt, U-turn, D.C.
           /[A-Z]/.test(w.slice(1));               // TV, OK, McDonald's
  }

  function build(opts) {
    injectStyles();

    var listEl = typeof opts.container === 'string' ? document.getElementById(opts.container) : opts.container;
    if (!listEl) return;
    var items = opts.items || [];
    var scoreEl = opts.scoreEl ? document.getElementById(opts.scoreEl) : null;
    var totalEl = opts.totalEl ? document.getElementById(opts.totalEl) : null;
    if (totalEl) totalEl.textContent = items.length;

    if (opts.prompt) {
      var promptEl = document.createElement('div');
      promptEl.className = 'eh2-prompt';
      promptEl.textContent = opts.prompt;
      listEl.appendChild(promptEl);
    }

    var fixedCount = 0;
    var counted = new Set();
    var globalKeep = opts.keepCaps || [];

    items.forEach(function (item, idx) { renderSentence(item, idx); });

    function renderSentence(item, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'eh2-item';

      var sentEl = document.createElement('div');
      sentEl.className = 'eh2-sentence';

      var menuEl = document.createElement('div');
      menuEl.className = 'eh2-menu';

      var okBtn = document.createElement('button');
      okBtn.className = 'eh2-ok';
      okBtn.textContent = 'OK';

      var resetBtn = document.createElement('button');
      resetBtn.className = 'eh2-menu-btn';
      resetBtn.textContent = '↺ Reset';

      var verdictEl = document.createElement('div');
      verdictEl.className = 'eh2-verdict';

      wrap.appendChild(sentEl);
      wrap.appendChild(menuEl);
      wrap.appendChild(okBtn);
      wrap.appendChild(resetBtn);
      wrap.appendChild(verdictEl);
      listEl.appendChild(wrap);

      var resolved = !item.error; // error-free sentences start already "solved"
      var activeTarget = null;    // { kind: 'word'|'gap', index }
      var pickingDestination = false;
      var moveSrc = null;         // index of the word being moved (tap-to-move)
      var anchorEl = null;
      var gapEls = [];
      var wordEls = [];
      var suppressClick = false;  // a drag ends with a click event — ignore it
      var itemKeep = item.keepCaps || [];

      function keepsCaps(w) {
        var bare = w.replace(/[.,!?;:"“”]+$/, '');
        return builtInKeepCaps(bare) || globalKeep.indexOf(w) !== -1 || globalKeep.indexOf(bare) !== -1 ||
               itemKeep.indexOf(w) !== -1 || itemKeep.indexOf(bare) !== -1;
      }
      function lowerUnlessKept(w) { return keepsCaps(w) ? w : decapitalizeFirst(w); }

      // Which words can start the move, and where each must go. Normally only
      // the misplaced word itself; when it is just ONE word away from its
      // right place, the neighbour it swaps with is an equally good start
      // ("Where I can…": move "can" to before "I", or "I" to after "can").
      function moveSolutions() {
        var e = item.error, sols = {};
        if (!e || e.type !== 'misplaced') return sols;
        sols[e.wordIndex] = e.targetGapIndex;
        if (e.targetGapIndex === e.wordIndex + 2) sols[e.wordIndex + 1] = e.wordIndex;
        else if (e.targetGapIndex === e.wordIndex - 1) sols[e.wordIndex - 1] = e.wordIndex + 1;
        return sols;
      }

      function buildSentenceDOM() {
        sentEl.innerHTML = '';
        gapEls.length = 0; wordEls.length = 0;
        for (var i = 0; i <= item.words.length; i++) {
          (function (i) {
            var gap = document.createElement('span');
            gap.className = 'eh2-gap';
            if (i > 0 && ENDERS.indexOf(item.words[i - 1]) !== -1) gap.classList.add('no-dot');
            gap.addEventListener('click', function () { onGapClick(i); });
            sentEl.appendChild(gap);
            gapEls[i] = gap;

            if (i < item.words.length) {
              var w = document.createElement('span');
              w.className = 'eh2-word';
              w.textContent = item.words[i];
              w.addEventListener('click', function () {
                if (suppressClick) { suppressClick = false; return; }
                onWordClick(i);
              });
              attachDrag(w, i);
              sentEl.appendChild(w);
              wordEls[i] = w;
            }
          })(i);
        }
      }

      function isErrorWord(i) {
        var e = item.error;
        if (!e) return false;
        return (e.type === 'extra' && e.wordIndex === i) ||
               (e.type === 'misplaced' && moveSolutions().hasOwnProperty(i)) ||
               (e.type === 'wrong' && e.wordIndex === i);
      }
      function isErrorGap(i) {
        var e = item.error;
        return !!e && e.type === 'missing' && e.gapIndex === i;
      }

      function closeMenu() {
        menuEl.classList.remove('open');
        menuEl.innerHTML = '';
        if (anchorEl) anchorEl.classList.remove('active-target');
        activeTarget = null;
        anchorEl = null;
        pickingDestination = false;
        moveSrc = null;
        gapEls.forEach(function (g) { g.classList.remove('target-pick'); });
        wordEls.forEach(function (w) { if (w) w.classList.remove('movable'); });
      }

      // Centers the menu horizontally on whichever chip opened it, with its
      // arrow pointing up into that chip — recalculated whenever the menu's
      // content changes (action list → word choices → "where to?"), since
      // the popover's own size can change even though the anchor doesn't.
      function positionMenu() {
        if (!anchorEl) return;
        var itemRect = wrap.getBoundingClientRect();
        var chipRect = anchorEl.getBoundingClientRect();
        var centerX = chipRect.left + chipRect.width / 2 - itemRect.left;
        var bottomY = chipRect.bottom - itemRect.top;
        menuEl.style.left = centerX + 'px';
        menuEl.style.top = (bottomY + 8) + 'px';
      }

      function flashWrong(elements) {
        elements.forEach(function (el) {
          if (!el) return;
          el.classList.remove('wrong-flash');
          void el.offsetWidth; // restart animation if it's already flashing
          el.classList.add('wrong-flash');
          setTimeout(function () { el.classList.remove('wrong-flash'); }, 350);
        });
      }

      function onWordClick(i) {
        if (resolved || pickingDestination) { closeMenu(); return; }
        if (!isErrorWord(i)) return; // correct word: nothing happens
        openActionMenu('word', i);
      }

      function onGapClick(i) {
        if (pickingDestination) {
          var src = moveSrc;
          // The two gaps immediately touching the word itself aren't real
          // destinations — moving it there is a no-op. They were never
          // offered as options (see startDestinationPick), so a click here
          // shouldn't register as an attempt at all, right or wrong.
          if (i === src || i === src + 1) return;
          if (gapEls[i].classList.contains('no-dot')) return;
          tryMove(src, i);
          closeMenu();
          return;
        }
        if (resolved) return;
        if (!isErrorGap(i)) return; // correct/empty gap: nothing happens
        openActionMenu('gap', i);
      }

      function makeActionBtn(emoji, label, handler) {
        var b = document.createElement('button');
        b.className = 'eh2-action-btn';
        var e = document.createElement('span');
        e.className = 'eh2-action-emoji';
        e.textContent = emoji;
        var l = document.createElement('span');
        l.className = 'eh2-action-label';
        l.textContent = label;
        b.appendChild(e);
        b.appendChild(l);
        b.addEventListener('click', handler);
        return b;
      }

      function openActionMenu(kind, index) {
        closeMenu();
        activeTarget = { kind: kind, index: index };
        anchorEl = kind === 'word' ? wordEls[index] : gapEls[index];
        anchorEl.classList.add('active-target');
        menuEl.classList.add('open');

        if (kind === 'gap') {
          // A "·" gap has nothing in it to delete or move — the only action
          // that makes sense is inserting a word into it.
          menuEl.appendChild(makeActionBtn('✒️', 'Insert', function () { handleAction('insert'); }));
        } else {
          menuEl.appendChild(makeActionBtn('🔄', 'Replace', function () { handleAction('insert'); }));
          menuEl.appendChild(makeActionBtn('❌', 'Delete', function () { handleAction('delete'); }));
          menuEl.appendChild(makeActionBtn('↔️', 'Move', function () { handleAction('move'); }));
        }
        positionMenu();
      }

      function handleAction(action) {
        var e = item.error;
        var t = activeTarget;
        if (!t) return;
        var targetEl = t.kind === 'word' ? wordEls[t.index] : gapEls[t.index];

        if (action === 'insert') {
          if (e.type === 'missing' && t.kind === 'gap' && t.index === e.gapIndex) {
            showInsertOptions(e, 'gap');
          } else if (e.type === 'wrong' && t.kind === 'word' && t.index === e.wordIndex) {
            showInsertOptions(e, 'word');
          } else {
            flashWrong([targetEl]);
            closeMenu();
          }
          return;
        }
        if (action === 'delete') {
          if (e.type === 'extra' && t.kind === 'word' && t.index === e.wordIndex) {
            removeWordAndGaps(t.index);
            // the first word was deleted: the next one now starts the sentence
            if (t.index === 0 && wordEls[1]) wordEls[1].textContent = capitalizeFirst(wordEls[1].textContent);
            resolved = true;
            closeMenu();
          } else {
            flashWrong([targetEl]);
            closeMenu();
          }
          return;
        }
        if (action === 'move') {
          if (e.type === 'misplaced' && t.kind === 'word' && moveSolutions().hasOwnProperty(t.index)) {
            startDestinationPick(t.index);
          } else {
            flashWrong([targetEl]);
            closeMenu();
          }
          return;
        }
      }

      function showInsertOptions(e, mode) {
        menuEl.innerHTML = '';
        var hint = document.createElement('div');
        hint.className = 'eh2-menu-hint';
        hint.textContent = 'Which word?';
        menuEl.appendChild(hint);
        shuffle(e.options).forEach(function (opt) {
          var b = document.createElement('button');
          b.className = 'eh2-menu-btn';
          b.textContent = opt;
          b.addEventListener('click', function () {
            if (opt === e.correct) {
              if (mode === 'gap') insertWordAt(e.gapIndex, opt);
              else replaceWordAt(e.wordIndex, opt);
              resolved = true;
              closeMenu();
            } else {
              var el = mode === 'gap' ? gapEls[e.gapIndex] : wordEls[e.wordIndex];
              flashWrong([el]);
              closeMenu();
            }
          });
          menuEl.appendChild(b);
        });
        positionMenu();
      }

      function startDestinationPick(src) {
        menuEl.innerHTML = '';
        var hint = document.createElement('div');
        hint.className = 'eh2-menu-hint';
        hint.textContent = 'Where to? Tap a space — or drag the word there.';
        menuEl.appendChild(hint);
        menuEl.classList.add('open');
        pickingDestination = true;
        moveSrc = src;
        wordEls[src].classList.add('movable');   // only this word can be dragged, and only now
        gapEls.forEach(function (g, i) {
          // A gap right after sentence-ending punctuation isn't a real
          // position in the sentence — never offer it as a move destination.
          if (i > 0 && ENDERS.indexOf(item.words[i - 1]) !== -1) return;
          // Nor are the two gaps immediately touching the word being moved —
          // dropping it right back next to itself doesn't move anything.
          if (i === src || i === src + 1) return;
          g.classList.add('target-pick');
        });
        positionMenu();
      }

      // One check for both tap-to-move and drag-to-move.
      function tryMove(src, gapIndex) {
        var sols = moveSolutions();
        if (!resolved && sols.hasOwnProperty(src) && sols[src] === gapIndex) {
          performMove(src, gapIndex);
          resolved = true;
        } else {
          flashWrong([wordEls[src], gapEls[gapIndex]]);
        }
      }

      /* ── drag to move ─────────────────────────────────────────────────────
         Only after ↔️ Move: the word being moved (and only that word) can be
         dragged instead of tapping a gap. Past a small threshold a ghost
         follows the pointer and the gaps light up as drop targets; releasing
         over a gap tries the move. A tiny wobble is still a tap. */
      function attachDrag(w, i) {
        var start = null, dragging = false, ghost = null, overGap = -1;

        function gapAt(x, y) {
          var els = document.elementsFromPoint(x, y);
          for (var k = 0; k < els.length; k++) {
            var gi = gapEls.indexOf(els[k]);
            if (gi !== -1) return gi;
          }
          return -1;
        }
        function setHover(gi) {
          if (overGap !== -1 && gapEls[overGap]) gapEls[overGap].classList.remove('drop-hover');
          overGap = gi;
          if (gi !== -1 && gi !== i && gi !== i + 1 && !gapEls[gi].classList.contains('no-dot')) gapEls[gi].classList.add('drop-hover');
        }
        function end() {
          if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
          ghost = null;
          w.classList.remove('drag-src');
          sentEl.classList.remove('dragging');
          gapEls.forEach(function (g) { g.classList.remove('drop-hover', 'drag-self'); });
          overGap = -1; start = null; dragging = false;
        }

        w.addEventListener('pointerdown', function (ev) {
          if (resolved || ev.button > 0 || !pickingDestination || moveSrc !== i) return;
          start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
          dragging = false;
        });
        w.addEventListener('pointermove', function (ev) {
          if (!start || ev.pointerId !== start.id) return;
          if (!dragging) {
            if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 8) return;
            dragging = true;
            try { w.setPointerCapture(ev.pointerId); } catch (err) { /* already released */ }
            closeMenu();
            w.classList.add('drag-src');
            sentEl.classList.add('dragging');
            if (gapEls[i]) gapEls[i].classList.add('drag-self');
            if (gapEls[i + 1]) gapEls[i + 1].classList.add('drag-self');
            ghost = document.createElement('span');
            ghost.className = 'eh2-ghost';
            ghost.textContent = w.textContent;
            document.body.appendChild(ghost);
          }
          ev.preventDefault();
          ghost.style.left = ev.clientX + 'px';
          ghost.style.top = ev.clientY + 'px';
          setHover(gapAt(ev.clientX, ev.clientY));
        });
        w.addEventListener('pointerup', function (ev) {
          if (!start || ev.pointerId !== start.id) return;
          if (!dragging) { start = null; return; }   // a tap: the click handler takes it
          var gi = gapAt(ev.clientX, ev.clientY);
          end();
          suppressClick = true;
          setTimeout(function () { suppressClick = false; }, 0);
          // dropped back where it was, after a ".", or outside any gap: nothing happens
          if (gi === -1 || gi === i || gi === i + 1 || gapEls[gi].classList.contains('no-dot')) return;
          tryMove(i, gi);
        });
        w.addEventListener('pointercancel', end);
      }

      function insertWordAt(gapIndex, word) {
        var chip = document.createElement('span');
        chip.className = 'eh2-word inserted';
        // A word inserted in front of the sentence starts it: capital letter,
        // and the old first word loses its own (unless it always keeps it).
        if (gapIndex === 0) {
          chip.textContent = capitalizeFirst(word);
          if (wordEls[0]) wordEls[0].textContent = lowerUnlessKept(wordEls[0].textContent);
        } else {
          chip.textContent = word;
        }
        gapEls[gapIndex].insertAdjacentElement('afterend', chip);

        var dot = document.createElement('span');
        dot.className = 'eh2-gap';
        chip.insertAdjacentElement('afterend', dot);
      }

      function replaceWordAt(i, word) {
        var chip = document.createElement('span');
        chip.className = 'eh2-word inserted';
        chip.textContent = word;
        wordEls[i].parentNode.insertBefore(chip, wordEls[i]);
        wordEls[i].parentNode.removeChild(wordEls[i]);
        wordEls[i] = chip;
      }

      // A word sits between two gap slots in the original layout, so
      // removing it "cleanly" means removing both of those too — otherwise
      // the sentence would be left with a leftover empty gap right next to
      // the single permanently-highlighted "·" that replaces the word. That
      // highlight matches the green an inserted or moved-in word gets, so
      // the vacated spot reads as a resolved part of the sentence.
      function removeWordAndGaps(i) {
        var wordEl = wordEls[i];
        if (!wordEl) return;

        var dot = document.createElement('span');
        dot.className = 'eh2-gap deleted-ok';
        dot.textContent = '·';
        wordEl.parentNode.insertBefore(dot, wordEl);

        var gapBefore = gapEls[i];
        var gapAfter = gapEls[i + 1];
        if (gapAfter && gapAfter.parentNode) gapAfter.parentNode.removeChild(gapAfter);
        if (gapBefore && gapBefore.parentNode) gapBefore.parentNode.removeChild(gapBefore);
        wordEl.parentNode.removeChild(wordEl);
      }

      function performMove(wordIndex, targetGapIndex) {
        var originalWord = item.words[wordIndex];
        var wasFirst = wordIndex === 0;
        var willBeFirst = targetGapIndex === 0;
        // Capture whichever word currently sits at the start of the
        // sentence, in case the move displaces it from that spot.
        var currentFirstWordEl = wasFirst ? null : wordEls[0];

        removeWordAndGaps(wordIndex);

        // A word moving into (or out of) the very first slot needs its
        // capitalization updated to match: sentence-initial words are
        // capitalized, everything else isn't.
        var displayWord = willBeFirst
          ? capitalizeFirst(originalWord)
          : (wasFirst ? lowerUnlessKept(originalWord) : originalWord);

        var chip = document.createElement('span');
        chip.className = 'eh2-word moved-in';
        chip.textContent = displayWord;
        gapEls[targetGapIndex].insertAdjacentElement('afterend', chip);

        var dot = document.createElement('span');
        dot.className = 'eh2-gap';
        chip.insertAdjacentElement('afterend', dot);

        if (willBeFirst && currentFirstWordEl && currentFirstWordEl.parentNode) {
          // Another word used to be first — it no longer is, so it loses
          // its capital letter.
          currentFirstWordEl.textContent = lowerUnlessKept(currentFirstWordEl.textContent);
        } else if (wasFirst && !willBeFirst) {
          // The moved word WAS first and has left; whichever word is now
          // at the front of the sentence needs to gain a capital letter.
          var newFirstEl = sentEl.querySelector('.eh2-word');
          if (newFirstEl) newFirstEl.textContent = capitalizeFirst(newFirstEl.textContent);
        }
      }

      okBtn.addEventListener('click', function () {
        if (resolved) {
          verdictEl.textContent = item.error ? '✓ Fixed!' : '✓ Correct — nothing was wrong!';
          verdictEl.className = 'eh2-verdict correct';
          wrap.classList.add('correct');
          if (!counted.has(idx)) {
            counted.add(idx);
            fixedCount++;
            if (scoreEl) scoreEl.textContent = fixedCount;
          }
        } else {
          verdictEl.textContent = 'Not yet — keep looking.';
          verdictEl.className = 'eh2-verdict incorrect';
          wrap.classList.remove('correct');
        }
      });

      resetBtn.addEventListener('click', function () {
        closeMenu();
        resolved = !item.error;
        verdictEl.textContent = '';
        verdictEl.className = 'eh2-verdict';
        wrap.classList.remove('correct');
        if (counted.has(idx)) {
          counted.delete(idx);
          fixedCount--;
          if (scoreEl) scoreEl.textContent = fixedCount;
        }
        buildSentenceDOM();
      });

      buildSentenceDOM();
    }
  }

  global.HouseErrorHunt = { build: build };
})(window);

/* ══════════════════════════════════════════════════════════════════════════
   HOUSE CCQ — concept checking questions
   The check a teacher makes after presenting a form: not "can you build it?"
   but "do you know what it means?". Each card shows one example sentence and
   asks one or two short questions about it, usually Yes/No. The answer is
   revealed with the reason, because the reason is the teaching.

     HouseCCQ.build({
       container: 'ccq',
       items: [
         { sentence: "I've been to Japan.",
           questions: [
             { q: 'Do we know when?',        opts: ['Yes', 'No'], correct: 1,
               why: 'The present perfect does not say when. If we said when, we would use the past simple.' },
             { q: 'Am I in Japan now?',      opts: ['Yes', 'No'], correct: 1,
               why: 'It is a finished visit — an experience in my life up to now.' }
           ]}
       ]
     });

   Kept deliberately small: a CCQ that needs a paragraph to answer is not a
   CCQ. Two options is the norm, three the maximum.

   Each question is joined to its options by a dotted line, the way a
   worksheet runs a row of dots out to the answer, and the options are
   separated by a slash:  Do we know when? ·········· Yes / No
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function build(opts) {
    var host = typeof opts.container === 'string'
      ? document.getElementById(opts.container) : opts.container;
    if (!host) return;

    host.classList.add('ccq-wrap');
    host.innerHTML = '';

    (opts.items || []).forEach(function (item, ii) {
      var card = document.createElement('div');
      card.className = 'ccq-card';

      var sent = document.createElement('div');
      sent.className = 'ccq-sentence';
      sent.innerHTML = item.sentence;
      card.appendChild(sent);

      (item.questions || []).forEach(function (q, qi) {
        var row = document.createElement('div');
        row.className = 'ccq-row';

        var label = document.createElement('span');
        label.className = 'ccq-q';
        label.textContent = q.q;
        row.appendChild(label);

        var btns = document.createElement('span');
        btns.className = 'ccq-opts';
        q.opts.forEach(function (o, oi) {
          // A slash between the options reads like the paper version: Yes / No.
          if (oi > 0) {
            var sep = document.createElement('span');
            sep.className = 'ccq-sep';
            sep.setAttribute('aria-hidden', 'true');
            sep.textContent = '/';
            btns.appendChild(sep);
          }
          var b = document.createElement('button');
          b.className = 'ccq-opt';
          b.textContent = o;
          b.addEventListener('click', function () {
            if (row.classList.contains('answered')) return;
            row.classList.add('answered');
            btns.querySelectorAll('.ccq-opt').forEach(function (x) { x.disabled = true; });
            if (oi === q.correct) {
              b.classList.add('correct');
            } else {
              b.classList.add('incorrect');
              btns.querySelectorAll('.ccq-opt')[q.correct].classList.add('correct');
            }
            if (q.why) {
              var why = document.createElement('div');
              why.className = 'ccq-why';
              why.innerHTML = q.why;
              // Under the row, not in it: the row stays one line, so the
              // dotted line always runs from the question to the options.
              row.parentNode.insertBefore(why, row.nextSibling);
            }
          });
          btns.appendChild(b);
        });
        row.appendChild(btns);
        card.appendChild(row);
      });

      host.appendChild(card);
    });
  }

  global.HouseCCQ = { build: build };
})(window);


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE FAVICON
   Sets a level-appropriate favicon by reading the `cefr-*` class already
   present on the `.cefr-tag` element. No configuration needed — just drop
   the 11 favicon files in the repo root next to house.js and they are
   picked up automatically.

   The 11 canonical filenames are:
     favicon-a1.png    favicon-a1a2.png  favicon-a2.png
     favicon-a2b1.png  favicon-b1.png    favicon-b1b2.png
     favicon-b2.png    favicon-b2c1.png  favicon-c1.png
     favicon-c1c2.png  favicon-c2.png

   Required format: **PNG, 32 × 32 px**.
   A browser that supports SVG favicons can also use a higher-resolution
   source (e.g. 64 × 64 px) in the same PNG slot; 32 × 32 is the baseline
   that works everywhere including older Safari and all Android browsers.
   Keep the files small — 1–3 KB each is plenty.

   Any `cefr-*` class not in the canonical set falls back to the nearest
   parent level (e.g. `cefr-a1b1` → `favicon-a1.png`).
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // The 11 canonical level codes in ascending order.
  // The order also acts as a fallback chain: an unknown code maps to the
  // last known code that shares its opening level.
  var LEVELS = [
    'a1', 'a1a2', 'a2', 'a2b1', 'b1', 'b1b2', 'b2', 'b2c1', 'c1', 'c1c2', 'c2'
  ];

  function levelFromClass(cls) {
    // cls is like "cefr-a1a2" — strip the prefix.
    return cls.replace(/^cefr-/, '');
  }

  function canonicalise(code) {
    if (LEVELS.indexOf(code) !== -1) return code;
    // Try the first two characters (the base level).
    var base = code.slice(0, 2);
    if (LEVELS.indexOf(base) !== -1) return base;
    return null;
  }

  function inject() {
    var tag = document.querySelector('.cefr-tag');
    if (!tag) return;

    // The level class is always the second class: "cefr-tag cefr-a1".
    var cls = '';
    for (var i = 0; i < tag.classList.length; i++) {
      if (tag.classList[i] !== 'cefr-tag') { cls = tag.classList[i]; break; }
    }
    if (!cls) return;

    var code = canonicalise(levelFromClass(cls));
    if (!code) return;

    // Resolve the favicon path relative to house.js itself rather than the
    // current page, so a page in a sub-folder still finds the file.
    var base = '';
    var scripts = document.querySelectorAll('script[src]');
    for (var s = 0; s < scripts.length; s++) {
      if (/house\.js$/.test(scripts[s].src)) {
        base = scripts[s].src.replace(/house\.js$/, '');
        break;
      }
    }

    var href = base + 'favicon-' + code + '.png';

    // Remove any existing favicon links first (there should be none in the
    // library, but a stale browser cache can inject them).
    var existing = document.querySelectorAll('link[rel~="icon"]');
    for (var e = 0; e < existing.length; e++) {
      existing[e].parentNode.removeChild(existing[e]);
    }

    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.sizes = '32x32';
    link.href = href;
    document.head.appendChild(link);
  }

  // house.js loads at the end of <body>, so the DOM is always ready by the
  // time this runs — no DOMContentLoaded guard needed.
  inject();
})();



/* ══════════════════════════════════════════════════════════════════════════
   HOUSE THOUGHT BUBBLES
   What a speaker thinks, remembers or imagines, under their line of a chat
   conversation: a cloud of pictures, with a trail of dots running from the
   cloud back to the speaker's avatar. The same thought becomes a cloud on the
   stage, at the thinker's head, when the conversation is watched as a visual
   novel (vn-adapter.js), so one piece of markup serves both.

     <div class="bubble-wrap">
       <div class="avatar av-a">👩</div>
       <div class="bubble-col">
         <div class="bname">Ana</div>
         <div class="bubble left">She must be in the kitchen.</div>
         <div class="think-bubble" role="group" aria-label="Ana thinks">
           <div class="think-cloud"> …pictures… </div>
         </div>
       </div>
     </div>

     HouseThink.html(content, { label:'Ana thinks' })   → that thought bubble as a string.
         content is the pictures (any HTML). A kit's own thought bubble (DeductionHouse.bubble /
         pastBubble) can be passed as it is: its cloud becomes the house cloud, its layout classes stay.
     HouseThink.refresh()    redraws the trails (they are redrawn by themselves on resize and when
                             bubbles are added)

   The line's avatar stays beside the words, not halfway down the cloud. The trail
   goes down from the avatar and in to the cloud's near edge, never across the
   speech bubble. A thought bubble outside a conversation gets two dots above its
   top corner instead. Styles are self-injected, like the bionic button's.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'house-think-styles';
  var CSS = ''
    + '.bubble-wrap.has-think{ align-items:flex-start; position:relative; }'
    + '.bubble-wrap.has-think > .avatar{ margin-top:1.15rem; }'
    /* doubled class: wins over a kit's own older bubble rules */
    + '.think-bubble.think-bubble{ position:relative; margin:14px 0 4px 1.5rem; padding:0; width:fit-content; max-width:calc(100% - 1.5rem); }'
    + '.bubble-wrap.right .think-bubble.think-bubble{ margin-left:0; margin-right:1.5rem; }'
    + '.think-bubble.think-free{ margin-left:0; margin-top:22px; }'
    + '.think-bubble.think-bubble::before, .think-bubble.think-bubble::after{ display:none; }'
    + '.think-cloud{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; padding:9px; border-radius:26px;'
    +   ' background:var(--surface-2); border:1.5px solid var(--color-border-primary); box-shadow:0 2px 10px rgba(0,0,0,.07); }'
    + '.think-cloud > *{ margin-top:0; margin-bottom:0; }'
    + '.think-trail{ position:absolute; left:0; top:0; width:100%; height:100%; overflow:visible; pointer-events:none; }'
    + '.think-trail circle{ fill:var(--surface-2); stroke:var(--color-border-primary); stroke-width:1.5; }';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function html(content, opts) {
    opts = opts || {};
    var t = document.createElement('template');
    t.innerHTML = String(content || '').trim();
    var first = t.content.firstElementChild, cls = '', inner;
    var own = t.content.children.length === 1 && first && (first.classList.contains('dh-think') || first.classList.contains('think-bubble'));
    var cloud = own ? first.querySelector(':scope > .dh-cloud, :scope > .think-cloud') : null;
    if (own && cloud) {
      /* a kit's own bubble: keep its layout classes, make its cloud the house cloud */
      cls = Array.prototype.filter.call(first.classList, function (c) { return c !== 'right' && c !== 'think-bubble'; }).join(' ');
      if (!opts.label) opts.label = first.getAttribute('aria-label');
      cloud.classList.add('think-cloud');
      inner = cloud.outerHTML;
    } else {
      inner = '<div class="think-cloud">' + t.innerHTML + '</div>';
    }
    return '<div class="think-bubble' + (cls ? ' ' + cls : '') + '" role="group" aria-label="' + esc(opts.label || 'What the speaker thinks') + '">' + inner + '</div>';
  }

  var SVG = 'http://www.w3.org/2000/svg';
  function trail(host, pts) {
    var svg = host.querySelector(':scope > .think-trail');
    if (!pts) { if (svg) svg.remove(); return; }
    if (!svg) { svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('class', 'think-trail'); svg.setAttribute('aria-hidden', 'true'); host.appendChild(svg); }
    svg.innerHTML = pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + p[2] + '"/>'; }).join('');
  }

  function draw(tb) {
    if (tb.closest('.vnad-think')) { trail(tb, null); return; }   /* on the visual-novel stage: it has its own trail */
    var cloud = tb.querySelector('.think-cloud') || tb.firstElementChild;
    var wrap = tb.closest('.bubble-wrap'), av = wrap && wrap.querySelector(':scope > .avatar');
    if (!cloud) return;
    var R = cloud.getBoundingClientRect();
    if (!R.width) return;   /* hidden (the chat while the visual novel is shown) */
    if (!wrap || !av) {
      /* outside a conversation: two dots above the top corner */
      tb.classList.add('think-free');
      var B = tb.getBoundingClientRect(), x = R.left - B.left + 22, y = R.top - B.top;
      trail(tb, [[x, y - 9, 6], [x - 9, y - 19, 4]]);
      return;
    }
    wrap.classList.add('has-think');
    var W = wrap.getBoundingClientRect(), A = av.getBoundingClientRect();
    var right = wrap.classList.contains('right'), s = right ? -1 : 1;
    var cx = A.left + A.width / 2 - W.left, ay = A.bottom - W.top;
    var ex = (right ? R.right : R.left) - W.left - s * 8, ey = R.top - W.top + Math.min(22, R.height / 2);
    if (ey - ay < 14) { trail(wrap, null); return; }
    /* from the avatar down, then in to the cloud: the small dot by the avatar, the big one by the cloud */
    trail(wrap, [
      [cx + s * 1, ay + 7, 3.5],
      [cx + (ex - cx) * 0.38, ay + (ey - ay) * 0.62, 5],
      [ex, ey, 7]
    ]);
  }
  function refresh() {
    document.querySelectorAll('.bubble-wrap.has-think').forEach(function (w) { if (!w.querySelector('.think-bubble')) { w.classList.remove('has-think'); trail(w, null); } });
    document.querySelectorAll('.think-bubble').forEach(draw);
  }

  var queued = false, ro = null;
  function queue() { if (queued) return; queued = true; (global.requestAnimationFrame || setTimeout)(function () { queued = false; watch(); refresh(); }); }
  function watch() {
    if (!global.ResizeObserver) return;
    if (!ro) ro = new ResizeObserver(queue);
    document.querySelectorAll('.think-bubble').forEach(function (tb) {
      if (tb._thinkWatched) return; tb._thinkWatched = true;
      ro.observe(tb); var w = tb.closest('.bubble-wrap'); if (w) ro.observe(w);
    });
  }
  function start() {
    injectStyles();
    queue();
    if (global.MutationObserver) new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.target.closest && m.target.closest('.think-trail')) continue;   /* its own drawing */
        queue(); return;
      }
    }).observe(document.body, { childList: true, subtree: true });
    global.addEventListener('resize', queue);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  global.HouseThink = { html: html, refresh: refresh, injectStyles: injectStyles };
})(window);

/* ══════════════════════════════════════════════════════════════════════════
   HOUSE CONVERSATION AS A VISUAL NOVEL
   On an intro page (a file name with _intro_, or any page with data-vn on an
   element), a conversation drawn as chat bubbles gets a 💬 Chat · 🎬 Visual
   novel switch. Everything lives in vn-adapter.js, next to house.js; it is
   loaded here, after the page's own script has drawn the bubbles, so no page
   needs a script tag of its own. It loads house-character.js and house-vn.js
   only when a visual novel is actually shown.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function start() {
    if (window.VNAdapter || document.getElementById('vn-adapter-js')) return;
    if (!document.querySelector('.bubble-wrap')) return;
    if (!/_intro_/.test(location.pathname) && !document.querySelector('[data-vn]')) return;
    var base = '';
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      if (/house\.js$/.test(scripts[i].src)) { base = scripts[i].src.replace(/house\.js$/, ''); break; }
    }
    var s = document.createElement('script');
    s.id = 'vn-adapter-js';
    s.src = base + 'vn-adapter.js';
    document.body.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
})();


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE PRONUNCIATION MARKS
   Word stress, connected speech and intonation marks on the lesson pages.
   Everything lives in pron-adapter.js, next to house.js; it is loaded here, after
   the page's own script has drawn its content, so no page needs a script tag of
   its own. Its lookup tables decide which pages get the 🎵 button and what is
   marked; it loads house-character.js and pron-mark.js only when the button is pressed.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function start() {
    if (window.PronAdapter || document.getElementById('pron-adapter-js')) return;
    var base = '';
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      if (/house\.js$/.test(scripts[i].src)) { base = scripts[i].src.replace(/house\.js$/, ''); break; }
    }
    var s = document.createElement('script');
    s.id = 'pron-adapter-js';
    s.src = base + 'pron-adapter.js';
    document.body.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
})();


/* ══════════════════════════════════════════════════════════════════════════
   HOUSE LEARNER'S DICTIONARY (HouseDict)

   Right-click a word (computer) or press and hold it (phone, tablet). A card
   opens beside the word with:
     · its pronunciation — IPA, plus an easy "sounds like" spelling (HAP-ee)
     · 🔊 and 🐢 (slowly) buttons: the browser's own speech (HouseSpeak when the page has it)
     · the part of speech, in the house POS colours
     · a simple definition and an example, and the meaning used IN THIS LESSON first
     · ☆ to save the word, and an optional Spanish line (ES)
   Forms find their base word (went → go, cities → city, bigger → big,
   didn't → did not) and phrases are found around the word (got up → get up).

   WHERE THE MEANINGS COME FROM, first match first:
     1. the lesson's own glossary — what the word means on this page
          <script type="application/json" id="lesson-dict"> { … } </script>
          window.LESSON_DICT = { … }                   (pages that build themselves in JS)
          <span data-def="the land along a river">bank</span>    (one word in one place)
     2. learner-dict/ next to house.js, made by build_learner_dict.js from
          · dict-src/simple-defs.tsv — simple definitions written for this library
          · the CMU Pronouncing Dictionary (BSD) — IPA and "sounds like"
          · Open English WordNet (CC BY 4.0) — fallback meanings, shown as harder English
        A missing folder is fine: the card shows what the page itself knows.

   Glossary entries (the key is the word or phrase; case only matters for display):
     "bank":   { "pos":"noun", "def":"the land along the side of a river", "ex":"We sat on the bank.", "es":"orilla" }
     "fine":   { "use": 2 }                  the 2nd meaning in learner-dict is this lesson's
     "get up": { "pos":"phrasal verb", "def":"to leave your bed after you sleep" }
     "Kenji":  { "pos":"name", "def":"a boy's name (Japanese)", "ipa":"ˈkɛndʒi", "say":"KEN-jee" }
     "read":   { "ipa":"rɛd", "say":"red", "speak":"red" }   only the past-tense sound on this page

   NOT LOOKED UP until the exercise is done (the card would give the answer away):
   matching cards not yet matched, error hunt sentences not yet fixed, form labelling
   until it is finished. The learner gets a one-line note instead. Never looked up:
   inputs, the page chrome, anything inside data-dict="off" (or <html data-dict="off">).
   data-dict="on" overrides the not-yet list. Shift + right-click = the browser's menu.

   Loading: nothing to add to a page — it is part of house.js. The data
   (learner-dict/, next to house.js) loads on the first lookup only.
   An old standalone house-dict.js on a page is harmless: whichever runs first wins.

   API   HouseDict.lookup('went')    open the card for a word (centred)
         HouseDict.close()
         HouseDict.saved()           the learner's ☆ words: [{word, key, page, time}] (localStorage 'house-dict-saved')
         HouseDict.get('go')         → Promise of the entry the card would show, or null
         HouseDict.unsave('go')      take a word off the list
         HouseDict.setSaved(list)    replace the whole list (My Words import)
         HouseDict.say('go', slow)   say it with the browser's voice
         window event 'house-dict-saved' (detail: the list) whenever the list changes
         HouseDict.core              the lemmatiser, shared with build_learner_dict.js
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══ DICT CORE START — no DOM. build_learner_dict.js reads the code from here to
     DICT CORE END out of house.js and runs it, so keep it plain JavaScript with no page code. */

  const L = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F';
  const WORD_SRC = '[' + L + ']+(?:[\'’][' + L + ']+)*(?:-[' + L + ']+(?:[\'’][' + L + ']+)*)*';
  const wordRe = () => new RegExp(WORD_SRC, 'g');
  const norm = w => String(w).replace(/[’‘]/g, "'").toLowerCase().trim();

  /* base past(s) participle(s) */
  const VERBS = 'arise arose arisen|awake awoke awoken|be was,were been|bear bore born,borne|beat beat beaten|become became become|begin began begun|bend bent bent|bet bet bet|bite bit bitten|bleed bled bled|blow blew blown|break broke broken|breed bred bred|bring brought brought|build built built|burn burnt,burned burnt,burned|buy bought bought|catch caught caught|choose chose chosen|come came come|cost cost cost|creep crept crept|cut cut cut|deal dealt dealt|dig dug dug|do did done|draw drew drawn|dream dreamt,dreamed dreamt,dreamed|drink drank drunk|drive drove driven|eat ate eaten|fall fell fallen|feed fed fed|feel felt felt|fight fought fought|find found found|flee fled fled|fly flew flown|forbid forbade forbidden|forget forgot forgotten|forgive forgave forgiven|freeze froze frozen|get got got,gotten|give gave given|go went gone|grind ground ground|grow grew grown|hang hung hung|have had had|hear heard heard|hide hid hidden|hit hit hit|hold held held|hurt hurt hurt|keep kept kept|kneel knelt knelt|know knew known|lay laid laid|lead led led|lean leant,leaned leant,leaned|learn learnt,learned learnt,learned|leave left left|lend lent lent|let let let|lie lay lain|light lit lit|lose lost lost|make made made|mean meant meant|meet met met|pay paid paid|prove proved proven|put put put|quit quit quit|read read read|ride rode ridden|ring rang rung|rise rose risen|run ran run|say said said|see saw seen|seek sought sought|sell sold sold|send sent sent|set set set|sew sewed sewn|shake shook shaken|shine shone shone|shoot shot shot|show showed shown|shrink shrank shrunk|shut shut shut|sing sang sung|sink sank sunk|sit sat sat|sleep slept slept|slide slid slid|smell smelt,smelled smelt,smelled|speak spoke spoken|speed sped sped|spell spelt,spelled spelt,spelled|spend spent spent|spill spilt,spilled spilt,spilled|spin spun spun|spit spat spat|split split split|spoil spoilt,spoiled spoilt,spoiled|spread spread spread|spring sprang sprung|stand stood stood|steal stole stolen|stick stuck stuck|sting stung stung|stink stank stunk|strike struck struck|swear swore sworn|sweep swept swept|swell swelled swollen|swim swam swum|swing swung swung|take took taken|teach taught taught|tear tore torn|tell told told|think thought thought|throw threw thrown|understand understood understood|wake woke woken|wear wore worn|weep wept wept|win won won|wind wound wound|write wrote written';
  const OTHER_FORMS = 'am,is,are,being:be:form of|has:have:he/she/it form of|does:do:he/she/it form of|' +
    'children:child:plural of|men:man:plural of|women:woman:plural of|people:person:plural of|feet:foot:plural of|teeth:tooth:plural of|' +
    'mice:mouse:plural of|geese:goose:plural of|knives:knife:plural of|wives:wife:plural of|lives:life:plural of|leaves:leaf:plural of|' +
    'shelves:shelf:plural of|halves:half:plural of|wolves:wolf:plural of|loaves:loaf:plural of|thieves:thief:plural of|' +
    'better:good,well:comparative of|best:good,well:superlative of|worse:bad,badly:comparative of|worst:bad,badly:superlative of|' +
    'more:many,much:comparative of|most:many,much:superlative of|less:little:comparative of|least:little:superlative of|' +
    'further,farther:far:comparative of|furthest,farthest:far:superlative of|' +
    'me:i:object form of|him:he:object form of|us:we:object form of|them:they:object form of';
  const CONTRACTIONS = {};
  ("i'm=I am|you're=you are|we're=we are|they're=they are|he's=he is / he has|she's=she is / she has|it's=it is / it has|" +
   "that's=that is|what's=what is|where's=where is|who's=who is|how's=how is|there's=there is|here's=here is|let's=let us|" +
   "i've=I have|you've=you have|we've=we have|they've=they have|i'll=I will|you'll=you will|he'll=he will|she'll=she will|" +
   "it'll=it will|we'll=we will|they'll=they will|there'll=there will|i'd=I would / I had|you'd=you would / you had|" +
   "he'd=he would / he had|she'd=she would / she had|we'd=we would / we had|they'd=they would / they had|isn't=is not|" +
   "aren't=are not|wasn't=was not|weren't=were not|don't=do not|doesn't=does not|didn't=did not|haven't=have not|" +
   "hasn't=has not|hadn't=had not|won't=will not|wouldn't=would not|can't=cannot|couldn't=could not|shouldn't=should not|" +
   "mustn't=must not|mightn't=might not|needn't=need not|shan't=shall not|ain't=am not / is not / are not|y'all=you all")
    .split('|').forEach(p => { const [k, v] = p.split('='); CONTRACTIONS[k] = v; });

  const FORMS = {};   /* form → [[lemma, label], …] */
  const addForm = (f, l, t) => {
    const list = FORMS[f] || (FORMS[f] = []);
    const had = list.find(x => x[0] === l);
    if (!had) list.push([l, t]);
    else if (had[1] !== t) had[1] = 'past / past participle of';
  };
  VERBS.split('|').forEach(row => {
    const [base, past, pp] = row.split(' ');
    past.split(',').forEach(f => { if (f !== base) addForm(f, base, 'past of'); });
    pp.split(',').forEach(f => { if (f !== base) addForm(f, base, 'past participle of'); });
  });
  OTHER_FORMS.split('|').forEach(row => {
    const [forms, lemmas, label] = row.split(':');
    forms.split(',').forEach(f => lemmas.split(',').forEach(l => addForm(f, l, label)));
  });

  /* Every key a word might be filed under, most likely first: the word itself, an
     irregular form's base, then the regular endings. The first key that exists wins. */
  function candidates(raw) {
    const w = norm(raw);
    const out = [], seen = new Set();
    const add = (key, tag) => {
      if (!key || seen.has(key)) return;
      if (key !== w && key.length < 2 && key !== 'i') return;
      seen.add(key); out.push({ key, tag: tag || null });
    };
    add(w, CONTRACTIONS[w] ? 'contraction' : null);
    (FORMS[w] || []).forEach(([l, t]) => add(l, t));
    let m;
    if (!CONTRACTIONS[w] && (m = w.match(/^(.+?)'s?$/))) add(m[1], 'possessive');
    const cvc = s => /(^|[^aeiou])[aeiou][^aeiouwxy]$/.test(s);
    const undouble = s => (/([bcdfgklmnprstvz])\1$/.test(s) ? s.slice(0, -1) : null);
    if ((m = w.match(/^(.+)ies$/))) add(m[1] + 'y', 's');
    if ((m = w.match(/^(.+[^s'])s$/))) add(m[1], 's');
    if ((m = w.match(/^(.+)es$/))) add(m[1], 's');
    if ((m = w.match(/^(.+)ied$/))) add(m[1] + 'y', 'ed');
    if ((m = w.match(/^(.+e)d$/))) add(m[1], 'ed');
    if ((m = w.match(/^(.+)ed$/))) { add(m[1], 'ed'); add(undouble(m[1]), 'ed'); }
    if ((m = w.match(/^(.+)ying$/))) add(m[1] + 'ie', 'ing');
    if ((m = w.match(/^(.+)ing$/))) {
      const s = m[1];
      if (cvc(s)) { add(s + 'e', 'ing'); add(s, 'ing'); } else { add(s, 'ing'); add(s + 'e', 'ing'); }
      add(undouble(s), 'ing');
    }
    if ((m = w.match(/^(.+)ier$/))) add(m[1] + 'y', 'er');
    if ((m = w.match(/^(.+)iest$/))) add(m[1] + 'y', 'est');
    if ((m = w.match(/^(.+e)r$/))) add(m[1], 'er');
    if ((m = w.match(/^(.+)er$/))) { add(m[1], 'er'); add(undouble(m[1]), 'er'); }
    if ((m = w.match(/^(.+e)st$/))) add(m[1], 'est');
    if ((m = w.match(/^(.+)est$/))) { add(m[1], 'est'); add(undouble(m[1]), 'est'); }
    if ((m = w.match(/^(.+)ily$/))) add(m[1] + 'y', 'ly');
    if ((m = w.match(/^(.+)ly$/))) add(m[1], 'ly');
    return out;
  }

  /* how a form relates to its base, in words a learner can read */
  function formLabel(tag, pos) {
    pos = pos || '';
    switch (tag) {
      case 's': return /verb/.test(pos) ? 'he/she/it form of' : 'plural of';
      case 'ed': return 'past form of';
      case 'ing': return '-ing form of';
      case 'er': return /adj|adverb/.test(pos) ? 'comparative of' : 'from';
      case 'est': return 'superlative of';
      case 'ly': return 'adverb from';
      case 'possessive': return "'s form of";
      default: return tag || '';
    }
  }

  const CORE = { candidates, formLabel, CONTRACTIONS, FORMS, norm, WORD_SRC, wordRe };
  /* ══ DICT CORE END ══ */
  if (typeof document === 'undefined' || window.HouseDict) return;

  /* ══ PAGE ════════════════════════════════════════════════════════════════ */

  const SRC = (document.currentScript && document.currentScript.src) ||
    ([].slice.call(document.querySelectorAll('script[src]')).map(x => x.src).filter(u => /house\.js(\?|#|$)/.test(u))[0] || '');
  const BASE = SRC ? SRC.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '';
  const DATA = document.documentElement.getAttribute('data-dict-base') || (BASE + 'learner-dict/');
  const PAGE = (location.pathname.split('/').pop() || '').toLowerCase();

  const NEVER = 'input, textarea, select, option, [contenteditable=""], [contenteditable="true"], script, style, ' +
    '#theme-toggle-wrap, #font-size-wrap, #font-size-panel, #bionic-wrap, #house-rail, #pmStart, #pmToggle, .hd-card, .hd-hint, [data-dict="off"]';
  /* the card would give the answer away here, until the exercise is done */
  const NOT_YET = '.match-card:not(.matched), .match-stage .card:not(.matched):not(.done), ' +
    '.eh2-item:not(.correct), .eh-item:not(.eh-correct), .fc-wrap:not(.fc-done), .hm-card:not(.found)';
  /* a long press on these is the start of a drag, not a lookup (right-click still works) */
  const DRAGGABLE = '.word-chip, .fc-chip, .eh2-word.movable, [draggable="true"]';

  const POS_KEY = {
    noun: 'noun', verb: 'verb', 'phrasal verb': 'verb', 'modal verb': 'aux', 'auxiliary verb': 'aux', auxiliary: 'aux',
    adjective: 'adj', adj: 'adj', adverb: 'adverb', adv: 'adverb', preposition: 'prep', prep: 'prep',
    determiner: 'det', article: 'det', number: 'det', conjunction: 'conj', pronoun: 'subject', contraction: 'aux'
  };
  const posKey = p => POS_KEY[norm(p || '')] || 'none';
  const CREDIT = {
    lesson: 'Meaning: for this lesson',
    house: 'Meaning: written for this course',
    wn: 'Meaning: <a href="https://en-word.net/" target="_blank" rel="noopener">Open English WordNet</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)',
    sounds: 'Sounds: written for this course',
    cmu: 'Sounds: <a href="http://www.speech.cs.cmu.edu/cgi-bin/cmudict" target="_blank" rel="noopener">CMU Pronouncing Dictionary</a>'
  };

  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ── data ─────────────────────────────────────────────────────────────── */
  const files = {};
  const json = name => files[name] || (files[name] = fetch(DATA + name).then(r => (r.ok ? r.json() : null)).catch(() => null));
  const shardOf = key => (/[a-z]/.test(key.charAt(0)) ? key.charAt(0) : '_') + '.json';
  async function dictEntry(key) { const s = await json(shardOf(key)); return (s && s[key]) || null; }

  function glossary() {
    const g = {};
    const take = obj => { if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => { g[norm(k)] = Object.assign({ _display: k }, obj[k]); }); };
    document.querySelectorAll('script[type="application/json"]#lesson-dict, script[type="application/json"][data-lesson-dict]').forEach(s => {
      try { take(JSON.parse(s.textContent)); } catch (e) { console.warn('house-dict: lesson-dict is not valid JSON', e); }
    });
    take(window.LESSON_DICT);
    return g;
  }
  let phraseSet = null;
  async function phrases(g) {
    if (!phraseSet) phraseSet = new Set((await json('_phrases.json')) || []);
    const s = new Set(phraseSet);
    Object.keys(g).forEach(k => { if (k.indexOf(' ') > 0) s.add(k); });
    return s;
  }

  /* one key → what the card shows: the lesson's meaning first, then learner-dict's */
  async function getEntry(key, g, inline) {
    const d = await dictEntry(key);
    const gl = inline || g[key];
    if (!d && !gl) return null;
    const e = { key: (d && d.us) || key, display: (gl && gl._display) || (d && d.display) || key.replace(/^i\b/, 'I'), ipa: [], say: [], senses: [], lesson: false, speak: null, ipaSrc: null };
    if (d) { e.emoji = d.emoji; e.variant = d.variant; e.ipa = (d.ipa || []).slice(); e.say = (d.say || []).slice(); if (e.ipa.length) e.ipaSrc = d.psrc === 'house' ? 'house' : 'cmu'; e.senses = (d.senses || []).slice(); e.short = d.short; }
    if (gl) {
      if (gl.ipa) { e.ipa = [].concat(gl.ipa); e.ipaSrc = 'lesson'; }
      if (gl.say) e.say = [].concat(gl.say);
      if (gl.speak) e.speak = gl.speak;
      if (gl.def) { e.senses.unshift({ pos: gl.pos, def: gl.def, ex: gl.ex, es: gl.es, level: gl.level, src: 'lesson' }); e.lesson = true; }
      else if (gl.use && e.senses[gl.use - 1]) { e.senses.unshift(e.senses.splice(gl.use - 1, 1)[0]); e.lesson = true; }
    }
    if (!e.short && CONTRACTIONS[key]) e.short = CONTRACTIONS[key];
    return e;
  }

  /* ── finding the word under the pointer ───────────────────────────────── */
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      return p && { node: p.offsetNode, offset: p.offset };
    }
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      return r && { node: r.startContainer, offset: r.startOffset };
    }
    return null;
  }
  const isInline = d => d === 'inline' || d === 'contents';
  function blockOf(node) {
    let el = node.parentElement;
    while (el && el !== document.body && isInline(getComputedStyle(el).display)) el = el.parentElement;
    /* a word inside a chip or a stick-figure unit: read the whole line around it */
    while (el && el.parentElement && el !== document.body && el.matches('.ss-unit, .ss-word, .pos-hl, .bionic-w')) el = el.parentElement;
    return el || document.body;
  }
  /* the block's text as one string; a space goes in where the text crosses from one box into another */
  function textModel(block) {
    const parts = [], cache = new Map();
    let text = '', prevBox = null;
    const boxOf = n => {
      for (let e = n.parentElement; e && e !== block; e = e.parentElement) {
        let d = cache.get(e);
        if (d === undefined) { d = getComputedStyle(e).display; cache.set(e, d); }
        if (!isInline(d)) return e;
      }
      return block;
    };
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement.closest('script, style, svg, .hd-card') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    for (let n; (n = walker.nextNode());) {
      const box = boxOf(n);
      if (prevBox && box !== prevBox && !/\s$/.test(text)) text += ' ';
      parts.push({ node: n, start: text.length, end: text.length + n.nodeValue.length });
      text += n.nodeValue;
      prevBox = box;
    }
    return { text, parts };
  }
  function rangeFor(model, a, b) {
    const r = document.createRange();
    const at = (pos, isEnd) => {
      for (const p of model.parts) if (pos >= p.start && (isEnd ? pos <= p.end : pos < p.end)) return [p.node, pos - p.start];
      const last = model.parts[model.parts.length - 1];
      return [last.node, last.node.nodeValue.length];
    };
    r.setStart(...at(a, false)); r.setEnd(...at(b, true));
    return r;
  }
  function rectAt(range, x, y) {
    const rects = Array.from(range.getClientRects());
    if (x == null) return rects[0] || range.getBoundingClientRect();
    return rects.find(r => x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 3 && y <= r.bottom + 3) || null;
  }
  function access(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || document.documentElement.getAttribute('data-dict') === 'off') return 'never';
    if (el.closest('[data-dict="on"]')) return 'ok';
    if (el.closest(NEVER)) return 'never';
    if (el.closest(NOT_YET)) return 'notyet';
    return 'ok';
  }
  function tokenize(model) {
    const re = wordRe(), toks = [];
    for (let m; (m = re.exec(model.text));) toks.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    /* a phrase may not run across punctuation: "…next time. Come…" */
    toks.forEach((t, i) => { const nx = toks[i + 1]; t.joined = !!nx && /^\s+$/.test(model.text.slice(t.end, nx.start)); });
    return toks;
  }
  function hitAt(x, y) {
    const c = caretAt(x, y);
    if (!c || !c.node) return null;
    let { node, offset } = c;
    if (node.nodeType !== 3) {
      const child = node.childNodes[offset] || node.childNodes[offset - 1];
      if (!child || child.nodeType !== 3) return null;
      node = child; offset = 0;
    }
    const st = access(node);
    if (st === 'never') return null;
    const block = blockOf(node), model = textModel(block);
    const part = model.parts.find(p => p.node === node);
    if (!part) return null;
    const g = part.start + offset, toks = tokenize(model);
    for (let i = 0; i < toks.length; i++) {
      if (g < toks[i].start - 1 || g > toks[i].end) continue;
      const range = rangeFor(model, toks[i].start, toks[i].end);
      if (!rectAt(range, x, y)) continue;      /* the caret snaps to the nearest letter: was the point really on this word? */
      return { status: st, node, model, toks, idx: i, g, range, x, y };
    }
    return null;
  }
  /* a word or short phrase the learner selected, then right-clicked (or pressed the menu key) */
  function hitFromSelection() {
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const text = sel.toString().trim();
    if (!text || text.split(/\s+/).length > 4 || !new RegExp('^' + WORD_SRC + '(\\s+' + WORD_SRC + ')*$').test(text)) return null;
    const range = sel.getRangeAt(0);
    const st = access(range.startContainer);
    if (st === 'never') return null;
    const toks = text.split(/\s+/).map(t => ({ text: t, joined: true }));
    return { status: st, node: range.startContainer, toks, idx: 0, range: range.cloneRange(), selection: true };
  }

  /* ── resolving: phrase → word → its base form ─────────────────────────── */
  async function resolve(hit) {
    const g = glossary();
    const words = hit.toks.map(t => t.text);
    const el = hit.node.nodeType === 1 ? hit.node : hit.node.parentElement;
    const forced = el && el.closest('[data-def], [data-lemma]');

    /* a selected phrase is looked up as it is */
    if (hit.selection && words.length > 1) {
      const key = norm(words.join(' '));
      const e = await getEntry(key, g);
      return { surface: words.join(' '), main: e && { entry: e, tag: null }, also: [], name: false };
    }

    /* phrases around the word, longest first; each word may also be its base form */
    const ph = await phrases(g);
    if (ph.size && !forced) {
      const opts = words.map(w => [norm(w)].concat(candidates(w).slice(1, 4).map(c => c.key)));
      for (let len = Math.min(4, words.length); len >= 2; len--) {
        for (let s = Math.max(0, hit.idx - len + 1); s <= hit.idx && s + len <= words.length; s++) {
          let ok = true;
          for (let k = s; k < s + len - 1; k++) if (!hit.toks[k].joined) ok = false;
          if (!ok) continue;
          let keys = [''];
          for (let k = s; k < s + len; k++) keys = keys.flatMap(a => opts[k].map(o => (a ? a + ' ' : '') + o)).slice(0, 64);
          const key = keys.find(kk => ph.has(kk));
          if (key) {
            const e = await getEntry(key, g);
            if (e) return { surface: words.slice(s, s + len).join(' '), main: { entry: e, tag: null }, also: [], phraseRange: hit.model ? rangeFor(hit.model, hit.toks[s].start, hit.toks[s + len - 1].end) : null };
          }
        }
      }
    }

    let word = words[hit.idx];
    let inline = null;
    if (forced) {
      if (forced.dataset.lemma) word = forced.dataset.lemma;
      if (forced.dataset.def) inline = { def: forced.dataset.def, pos: forced.dataset.pos, ex: forced.dataset.ex, es: forced.dataset.es, _display: word };
    }

    /* the word, then what it could be a form of — fetch every shard needed in one go */
    let cands = candidates(word);
    if (word.indexOf('-') > 0 && hit.g != null) {
      /* T-shirt, right-click: the whole word first, then the part that was clicked */
      const t = hit.toks[hit.idx], at = hit.g - t.start;
      let pos = 0;
      for (const piece of word.split('-')) {
        if (at >= pos && at <= pos + piece.length) cands = cands.concat(candidates(piece));
        pos += piece.length + 1;
      }
    }
    await Promise.all([...new Set(cands.map(c => shardOf(c.key)))].map(json));
    const found = [];
    for (const c of cands) {
      const e = await getEntry(c.key, g, c.key === norm(word) ? inline : null);
      if (e && !found.some(f => f.entry.key === e.key)) found.push({ entry: e, tag: c.tag });
      if (found.length >= 3) break;
    }
    const first = word.charAt(0), t = hit.toks[hit.idx];
    const before = hit.model && t && t.start != null ? hit.model.text.slice(0, t.start) : '';
    /* a capital in mid-sentence, and nothing but big-dictionary meanings: most likely a name (Ben, not "ben", a mountain) */
    const capMid = norm(word) !== 'i' && first === first.toUpperCase() && first !== first.toLowerCase() && /[^.!?:"“\s]\s*$/.test(before);
    const name = capMid && (!found.length || found[0].entry.senses.every(s => s.src === 'wn'));

    /* "did" is stored for its sound only: show the sound, then go on to "do" */
    let formPron = null;
    if (found.length > 1 && !found[0].entry.senses.length && !found[0].entry.short && found[0].entry.ipa.length) formPron = found.shift().entry;

    /* -s / -ed / -ing: is it the noun or the verb here? The word before it usually says. */
    const main = found[0];
    if (main && /^(s|ed|ing)$/.test(main.tag || '')) {
      const prev = norm((hit.toks[hit.idx - 1] || {}).text || '');
      const PRON = /^(i|you|he|she|it|we|they|that|this|who|which|what|there|people|everyone|someone|nobody|don't|doesn't|didn't|to|not|was|were|is|are|be|been|has|have|had|am)$/;
      const DET = /^(a|an|the|my|your|his|her|its|our|their|two|three|four|five|many|some|these|those|all|no)$/;
      const verbFirst = main.tag !== 's' || (PRON.test(prev) && !DET.test(prev));
      const isVerb = s => /verb|aux/.test(s.pos || '');
      const ss = main.entry.senses;
      if (ss.some(isVerb) && ss.some(s => !isVerb(s)) && !main.entry.lesson) {
        main.entry.senses = verbFirst ? ss.filter(isVerb).concat(ss.filter(s => !isVerb(s))) : ss.filter(s => !isVerb(s)).concat(ss.filter(isVerb));
        if (main.tag === 's' && !PRON.test(prev) && !DET.test(prev)) main.tag = '-s form of';   /* can't tell: don't guess */
      }
    }
    return { surface: word, main: main || null, also: found.slice(1), name, formPron };
  }

  /* ── the card ──────────────────────────────────────────────────────────── */
  const STYLES = `
.hd-card{ position:fixed; z-index:1100; width:min(23rem, calc(100vw - 16px)); max-height:min(70vh, 34rem); overflow:auto;
  background:var(--surface-2, #fff); color:var(--text-primary, #1a1a1a); border:1px solid var(--color-border-secondary, #e3e3e6);
  border-radius:var(--border-radius-lg, 12px); box-shadow:0 10px 30px rgba(0,0,0,.18); padding:.75rem .9rem .65rem;
  font-family:var(--font-sans, sans-serif); font-size:.9333rem; line-height:1.45; text-align:left; outline:none;
  animation:hd-in .14s ease-out; }
@keyframes hd-in{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:none; } }
.hd-card[data-side="above"]{ animation-name:hd-in-up; }
@keyframes hd-in-up{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
.hd-arrow{ position:fixed; z-index:1101; width:12px; height:12px; transform:translateX(-50%) rotate(45deg); pointer-events:none;
  background:var(--surface-2, #fff); border:1px solid var(--color-border-secondary, #e3e3e6); }
.hd-arrow[data-side="below"]{ border-right:none; border-bottom:none; }
.hd-arrow[data-side="above"]{ border-left:none; border-top:none; }
.hd-top{ display:flex; align-items:center; gap:.35rem; }
.hd-emoji{ font-size:1.5rem; line-height:1; }
.hd-head{ font-size:1.2rem; font-weight:700; letter-spacing:-.01em; overflow-wrap:anywhere; }
.hd-flex{ flex:1; }
.hd-card button{ font-family:inherit; cursor:pointer; }
.hd-icon{ border:1px solid var(--border, #ebebee); background:var(--surface-1, #f7f7f8); color:inherit; border-radius:999px;
  min-width:2rem; height:2rem; padding:0 .45rem; font-size:.9rem; line-height:1; display:inline-flex; align-items:center; justify-content:center; }
.hd-icon:hover{ background:var(--color-background-tertiary, #eeeef0); }
.hd-icon[aria-pressed="true"]{ border-color:var(--text-accent, #185fa5); color:var(--text-accent, #185fa5); }
.hd-icon.is-speaking{ animation:hd-say .5s ease; }
.hd-slow{ font-size:.8rem; }
.hd-from .hd-icon{ min-width:1.6rem; height:1.6rem; font-size:.75rem; vertical-align:middle; margin-left:.25rem; }
@keyframes hd-say{ 50%{ transform:scale(1.15); } }
.hd-es-btn{ font-size:.7rem; font-weight:700; letter-spacing:.04em; }
.hd-from{ font-size:.8rem; color:var(--text-secondary, #5b5b60); margin-top:.1rem; }
.hd-from b{ color:var(--text-primary, #1a1a1a); }
.hd-pron{ display:flex; flex-wrap:wrap; align-items:baseline; gap:.15rem .7rem; margin:.3rem 0 .15rem; }
.hd-ipa{ font-family:"Doulos SIL","Charis SIL","Gentium Plus","Lucida Sans Unicode","Segoe UI",var(--font-sans, sans-serif); font-size:1rem; color:var(--text-accent, #185fa5); }
.hd-sayas{ font-size:.8rem; color:var(--text-secondary, #5b5b60); }
.hd-sayas b{ font-weight:600; letter-spacing:.02em; color:var(--text-primary, #1a1a1a); }
.hd-alt{ font-size:.75rem; color:var(--text-muted, #8b8b90); }
.hd-senses{ list-style:none; margin:.35rem 0 0; padding:0; }
.hd-sense{ padding:.45rem 0 .35rem; border-top:.5px solid var(--color-border-tertiary, #ebebee); }
.hd-sense:first-child{ border-top:none; }
.hd-meta{ display:flex; flex-wrap:wrap; align-items:center; gap:.3rem; margin-bottom:.15rem; }
.hd-pos{ font-size:.7rem; font-weight:700; letter-spacing:.03em; padding:.05rem .5rem; border-radius:999px;
  background:var(--hd-bg, var(--pos-none-bg, #f3f4f6)); color:var(--hd-fg, var(--pos-none, #8b8b90)); }
.hd-level{ font-size:.66rem; font-weight:700; padding:.05rem .4rem; border-radius:999px; border:1px solid var(--border, #ebebee); color:var(--text-secondary, #5b5b60); }
.hd-badge{ font-size:.66rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; padding:.1rem .45rem; border-radius:999px;
  background:var(--color-background-info, #e6f1fb); color:var(--color-text-info, #0c447c); }
.hd-def{ font-size:.9667rem; }
.hd-ex{ font-size:.8667rem; font-style:italic; color:var(--text-secondary, #5b5b60); margin-top:.15rem; }
.hd-ex .hd-icon{ min-width:1.6rem; height:1.6rem; font-size:.75rem; font-style:normal; vertical-align:middle; margin-left:.25rem; }
.hd-es{ display:none; font-size:.8333rem; color:var(--color-text-success, #27500a); margin-top:.15rem; }
.hd-card.show-es .hd-es{ display:block; }
.hd-hard{ font-size:.72rem; color:var(--text-muted, #8b8b90); margin-top:.15rem; }
.hd-more{ margin-top:.25rem; border:none; border-radius:0; overflow:visible; }
.hd-more summary{ background:none; padding:.2rem 0; font-size:.8rem; font-weight:600; color:var(--text-accent, #185fa5); display:list-item; list-style:revert; cursor:pointer; }
.hd-links{ display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; margin-top:.4rem; font-size:.8rem; color:var(--text-secondary, #5b5b60); }
.hd-link{ font-size:.8rem; padding:.15rem .6rem; border-radius:999px; border:1px solid var(--border, #ebebee); background:var(--surface-1, #f7f7f8); color:var(--text-accent, #185fa5); }
.hd-note{ font-size:.8667rem; color:var(--text-secondary, #5b5b60); padding:.35rem 0 .1rem; }
.hd-src{ font-size:.66rem; color:var(--text-muted, #8b8b90); margin-top:.5rem; padding-top:.35rem; border-top:.5px solid var(--color-border-tertiary, #ebebee); }
.hd-src a{ color:inherit; }
.hd-hint{ position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:1100; max-width:calc(100vw - 24px);
  background:var(--surface-2, #fff); color:var(--text-primary, #1a1a1a); border:1px solid var(--border, #ebebee); border-radius:999px;
  box-shadow:0 6px 18px rgba(0,0,0,.16); padding:.5rem 1rem; font-size:.8667rem; cursor:pointer; animation:hd-in .2s ease-out; }
html.hd-pressing body{ -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
::highlight(house-dict){ background-color:var(--color-background-info, #e6f1fb); color:var(--color-text-info, #0c447c); }
` + Object.keys({ wh: 1, aux: 1, verb: 1, part: 1, subject: 1, object: 1, complement: 1, noun: 1, adj: 1, adverb: 1, prep: 1, det: 1, conj: 1, time: 1, neg: 1, none: 1 })
    .map(k => `.hd-pos[data-k="${k}"]{ --hd-bg:var(--pos-${k}-bg); --hd-fg:var(--pos-${k}); }`).join('\n');

  function injectStyles() {
    if (document.getElementById('house-dict-styles')) return;
    const s = document.createElement('style');
    s.id = 'house-dict-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  let card = null, arrow = null, anchor = null, pressOpenedAt = 0, current = null;

  /* ── speech: the browser's own voices (speechSynthesis), nothing to download ──────────
     Plays through HouseSpeak when the page has it, so the 🔊 here sounds like the rest of the
     page; otherwise picks a voice itself: the one the learner chose in a HouseSpeak voice
     picker (same storage key), else the best English voice on the device: the page's accent
     (<html data-dict-accent="en-GB">, default en-US), on-device before online, "natural" /
     "enhanced" voices first, novelty voices never. 🐢 says it again slowly. */
  const synth = window.speechSynthesis || null;
  const VOICE_KEY = 'house-speak-voice';
  const NOVELTY = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Eloquence|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
  const ACCENT = document.documentElement.getAttribute('data-dict-accent') || 'en-US';
  let voices = [];
  function loadVoices() {
    try { voices = (synth.getVoices() || []).filter(v => /^en([-_]|$)/i.test(v.lang) && !NOVELTY.test(v.name)); } catch (e) { voices = []; }
  }
  if (synth) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices); else synth.onvoiceschanged = loadVoices;
  }
  function savedVoiceName() {
    try { const v = localStorage.getItem(VOICE_KEY); if (!v) return null; try { const j = JSON.parse(v); return typeof j === 'string' ? j : (j && (j.voiceURI || j.name)) || v; } catch (e) { return v; } }
    catch (e) { return null; }
  }
  function pickVoice() {
    if (!voices.length) loadVoices();
    if (!voices.length) return null;
    const saved = savedVoiceName();
    const mine = saved && voices.find(v => v.voiceURI === saved || v.name === saved);
    if (mine) return mine;
    const norm2 = l => l.replace('_', '-').toLowerCase(), want = ACCENT.toLowerCase();
    const score = v => (norm2(v.lang) === want ? 8 : norm2(v.lang).slice(0, 2) === 'en' ? 2 : 0) +
      (v.localService ? 5 : 0) + (/natural|neural|premium|enhanced/i.test(v.name) ? 3 : 0) + (v.default ? 1 : 0);   /* on-device first, as HouseSpeak does */
    return voices.slice().sort((a, b) => score(b) - score(a))[0];
  }
  const canSpeak = () => !!(synth || (window.HouseSpeak && window.HouseSpeak.speak));
  function say(text, btn, slow) {
    if (!text) return;
    if (btn) { btn.classList.remove('is-speaking'); void btn.offsetWidth; btn.classList.add('is-speaking'); }
    if (!slow && window.HouseSpeak && window.HouseSpeak.speak) { window.HouseSpeak.speak(text, btn); return; }
    if (!synth) return;
    synth.cancel();
    if (synth.paused) synth.resume();            /* Chrome can get stuck paused */
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = ACCENT;
    u.rate = slow ? 0.6 : 0.85;
    synth.speak(u);                              /* synchronous inside the tap: iOS needs that */
  }
  const sayBtn = (text, label, slow) => canSpeak()
    ? `<button class="hd-icon${slow ? ' hd-slow' : ''}" data-hd-say="${esc(text)}"${slow ? ' data-slow' : ''} aria-label="${esc(label)}" title="${esc(label)}">${slow ? '🐢' : '🔊'}</button>` : '';

  function senseHtml(s, i, lessonFirst) {
    const k = posKey(s.pos);
    return `<li class="hd-sense">
      <div class="hd-meta">${s.pos ? `<span class="hd-pos" data-k="${k}">${esc(s.pos)}</span>` : ''}${s.level ? `<span class="hd-level">${esc(s.level)}</span>` : ''}${i === 0 && lessonFirst ? '<span class="hd-badge">In this lesson</span>' : ''}</div>
      <div class="hd-def">${esc(s.def)}</div>
      ${s.ex ? `<div class="hd-ex">“${esc(s.ex)}”${sayBtn(s.ex, 'Listen to the example')}</div>` : ''}
      ${s.es ? `<div class="hd-es" lang="es">${esc(s.es)}</div>` : ''}
      ${s.src === 'wn' ? '<div class="hd-hard">From a big dictionary, so the English may be harder.</div>' : ''}
    </li>`;
  }

  function render(res, hit) {
    const saved = store.get('house-dict-saved', []);
    const m = res.main, e = m && m.entry;
    const head = e ? e.display : res.surface;
    let body = '';
    if (hit.status === 'notyet') {
      body = `<div class="hd-note">Finish this exercise first. Then you can look up its words.</div>`;
    } else {
      const firstPos = e && e.senses[0] && e.senses[0].pos;
      if (e && norm(res.surface) !== norm(e.key) && m.tag && m.tag !== 'contraction')
        body += `<div class="hd-from">${esc(res.surface)}${res.formPron ? ` <span class="hd-ipa">/${esc(res.formPron.ipa[0])}/</span>` : ''}${sayBtn(res.surface, 'Listen to ' + res.surface)}: ${esc(formLabel(m.tag, firstPos))} <b>${esc(e.display)}</b></div>`;
      if (e && (e.ipa.length || e.say.length)) {
        body += `<div class="hd-pron">${e.ipa[0] ? `<span class="hd-ipa">/${esc(e.ipa[0])}/</span>` : ''}${e.say[0] ? `<span class="hd-sayas">sounds like <b>${esc(e.say[0])}</b></span>` : ''}` +
          (e.ipa[1] ? `<span class="hd-alt">also /${esc(e.ipa[1])}/</span>` : '') + '</div>';
      }
      if (e && e.variant) body += `<div class="hd-from">${esc(e.variant.split(': ')[0])} spelling: <b>${esc(e.variant.split(': ')[1])}</b></div>`;
      if (e && e.short) {
        body += `<div class="hd-links">short for ${e.short.split(' / ').map(alt => alt.split(' ').map(w =>
          `<button class="hd-link" data-go="${esc(norm(w))}">${esc(w)}</button>`).join(' ')).join(' <span>or</span> ')}</div>`;
      }
      if (e && e.senses.length) {
        const shown = res.name ? [] : e.senses.slice(0, e.lesson ? 1 : 2), rest = e.senses.slice(shown.length);
        if (res.name) body += '<div class="hd-note">This looks like a name.</div>';
        else body += `<ol class="hd-senses">${shown.map((s, i) => senseHtml(s, i, e.lesson)).join('')}</ol>`;
        if (rest.length) body += `<details class="hd-more"><summary>More meanings (${rest.length})</summary><ol class="hd-senses">${rest.map((s, i) => senseHtml(s, i + 1, false)).join('')}</ol></details>`;
      } else if (!(e && e.short)) {
        body += `<div class="hd-note">${res.name ? 'This looks like a name.' : 'No meaning here yet.'}</div>`;
      }
      if (res.also.length) {
        body += `<div class="hd-links">Also: ${res.also.map(a => {
          const p = a.entry.senses[0] && a.entry.senses[0].pos;
          return `<button class="hd-link" data-go="${esc(a.entry.key)}">${a.tag ? esc(formLabel(a.tag, p)) + ' ' : ''}${esc(a.entry.display)}</button>`;
        }).join(' ')}</div>`;
      }
      if (e) {
        const srcs = [...new Set(e.senses.map(s => s.src || 'house'))].map(s => CREDIT[s]).filter(Boolean);
        if (e.ipaSrc === 'cmu') srcs.push(CREDIT.cmu); else if (e.ipaSrc === 'house') srcs.push(CREDIT.sounds);
        if (srcs.length) body += `<div class="hd-src">${srcs.join(' · ')}</div>`;
      }
    }
    const hasEs = e && e.senses.some(s => s.es);
    const key = e ? e.key : norm(res.surface);
    const isSaved = saved.some(s => s.key === key);
    const speakText = (e && e.speak) || (e ? e.display : res.surface);   /* the headword: "went" has its own 🔊 on the form line */
    card.innerHTML = `
      <div class="hd-top">
        ${e && e.emoji ? `<span class="hd-emoji" aria-hidden="true">${e.emoji}</span>` : ''}<span class="hd-head" id="hd-head">${esc(head)}</span>
        ${hit.status === 'notyet' ? '' : sayBtn(speakText, 'Listen') + sayBtn(speakText, 'Listen slowly', true)}
        <span class="hd-flex"></span>
        ${hasEs ? `<button class="hd-icon hd-es-btn" data-es aria-pressed="${store.get('house-dict-es', false)}" title="Spanish" aria-label="Show Spanish">ES</button>` : ''}
        ${hit.status === 'notyet' ? '' : `<button class="hd-icon" data-star aria-pressed="${isSaved}" aria-label="${isSaved ? 'Saved' : 'Save this word'}" title="Save this word">${isSaved ? '★' : '☆'}</button>`}
        <button class="hd-icon" data-close aria-label="Close">✕</button>
      </div>${body}`;
    card.classList.toggle('show-es', !!(hasEs && store.get('house-dict-es', false)));
    card.dataset.key = key;
  }

  function notifySaved(list) {
    try { window.dispatchEvent(new CustomEvent('house-dict-saved', { detail: list })); } catch (e) { /* very old browser */ }
  }

  function onCardClick(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    ev.stopPropagation();
    if (b.hasAttribute('data-hd-say')) say(b.getAttribute('data-hd-say'), b, b.hasAttribute('data-slow'));
    else if (b.hasAttribute('data-close')) close();
    else if (b.hasAttribute('data-es')) {
      const on = !store.get('house-dict-es', false);
      store.set('house-dict-es', on);
      b.setAttribute('aria-pressed', on); card.classList.toggle('show-es', on);
    } else if (b.hasAttribute('data-star')) {
      let list = store.get('house-dict-saved', []);
      const key = card.dataset.key, has = list.some(s => s.key === key);
      list = has ? list.filter(s => s.key !== key) : list.concat({ word: current && current.surface, key, page: PAGE, time: Date.now() });
      store.set('house-dict-saved', list);
      notifySaved(list);
      b.textContent = has ? '☆' : '★'; b.setAttribute('aria-pressed', !has);
    } else if (b.dataset.go) lookupKey(b.dataset.go);
  }

  function ensureCard() {
    injectStyles();
    if (card) return;
    card = document.createElement('div');
    card.className = 'hd-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'hd-head');
    card.tabIndex = -1;
    arrow = document.createElement('div');
    arrow.className = 'hd-arrow';
    card.addEventListener('click', onCardClick);
    card.addEventListener('toggle', place, true);     /* "More meanings" opened: it may need to move */
  }

  function anchorRect() {
    if (!anchor) return null;
    if (anchor.range) {
      const r = rectAt(anchor.range, anchor.x, anchor.y) || rectAt(anchor.range);
      if (r && (r.width || r.height)) return r;
    }
    return null;
  }
  function place() {
    if (!card || !card.isConnected) return;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, M = 8, GAP = 11;
    const cw = card.offsetWidth, ch = card.offsetHeight, r = anchorRect();
    let left, top, side = 'below';
    if (!r) {
      left = (vw - cw) / 2; top = Math.max(M, (vh - ch) / 2);
      arrow.remove();
    } else {
      if (r.bottom < 0 || r.top > vh) { close(); return; }        /* the word has scrolled away */
      const cx = r.left + r.width / 2;
      left = Math.min(Math.max(cx - cw / 2, M), vw - cw - M);
      top = r.bottom + GAP;
      if (top + ch > vh - M) {
        if (r.top - GAP - ch >= M) { top = r.top - GAP - ch; side = 'above'; }
        else top = Math.max(M, vh - ch - M);
      }
      const overlaps = top < r.bottom && top + ch > r.top;
      if (overlaps) arrow.remove();
      else {
        if (!arrow.isConnected) document.body.appendChild(arrow);
        arrow.dataset.side = side;
        arrow.style.left = Math.min(Math.max(cx, left + 16), left + cw - 16) + 'px';
        arrow.style.top = (side === 'below' ? top - 6 : top + ch - 6) + 'px';
      }
    }
    card.dataset.side = side;
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function highlight(range) {
    try {
      if (!window.CSS || !window.CSS.highlights) return;
      if (range) window.CSS.highlights.set('house-dict', new Highlight(range)); else window.CSS.highlights.delete('house-dict');
    } catch (e) { /* no Highlight API: no highlight */ }
  }

  async function open(hit, opts) {
    opts = opts || {};
    ensureCard();
    anchor = hit.range ? { range: hit.range, x: hit.x, y: hit.y } : null;
    highlight(hit.range);
    const token = {};
    current = token;
    card.innerHTML = `<div class="hd-top"><span class="hd-head" id="hd-head">${esc(hit.toks[hit.idx].text)}</span><span class="hd-flex"></span><button class="hd-icon" data-close aria-label="Close">✕</button></div><div class="hd-note">…</div>`;
    if (!card.isConnected) document.body.appendChild(card);
    place();
    const res = hit.status === 'notyet' ? { surface: hit.toks[hit.idx].text, main: null, also: [] } : await resolve(hit);
    if (current !== token) return;                  /* another lookup started meanwhile */
    current = res;
    if (res.phraseRange) { anchor.range = res.phraseRange; highlight(res.phraseRange); }
    render(res, hit);
    place();
    if (opts.focus) card.focus({ preventScroll: true });
  }

  async function lookupKey(key) {
    if (!card) return;
    const res = await resolve({ status: 'ok', node: card, toks: [{ text: key, joined: false }], idx: 0 });
    current = res;
    render(res, { status: 'ok' });
    place();
  }

  function close() {
    if (card) card.remove();
    if (arrow) arrow.remove();
    highlight(null);
    anchor = null; current = null;
  }

  /* ── gestures ──────────────────────────────────────────────────────────── */
  let press = null, timer = 0, swallowClick = false;

  function cancelPress() {
    clearTimeout(timer); timer = 0; press = null;
    setTimeout(() => { if (!press) document.documentElement.classList.remove('hd-pressing'); }, 60);
  }

  document.addEventListener('contextmenu', ev => {
    if (ev.shiftKey) return;                                       /* the browser's own menu */
    if (card && card.contains(ev.target)) return;
    if (press) cancelPress();                                      /* Android: the long press came as a contextmenu */
    if (Date.now() - pressOpenedAt < 800) { ev.preventDefault(); return; }   /* a long press just opened the card */
    const fromKey = !ev.clientX && !ev.clientY;
    const hit = hitFromSelection() || (fromKey ? null : hitAt(ev.clientX, ev.clientY));
    if (!hit) return;                                              /* not on a word: the browser's menu */
    ev.preventDefault();
    open(hit, { focus: fromKey });
  }, true);

  document.addEventListener('pointerdown', ev => {
    if (card && !card.contains(ev.target) && ev.button !== 2) close();
    if (ev.pointerType === 'mouse' || !ev.isPrimary) return;
    cancelPress();
    if (!ev.target.closest || ev.target.closest(DRAGGABLE) || access(ev.target) === 'never') return;
    press = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    document.documentElement.classList.add('hd-pressing');         /* iOS: no text selection on this press */
    timer = setTimeout(() => {
      const p = press;
      cancelPress();
      if (!p) return;
      const hit = hitAt(p.x, p.y);
      if (!hit) return;
      try { window.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 800);
      pressOpenedAt = Date.now();
      open(hit);
    }, 480);
  }, true);
  document.addEventListener('pointermove', ev => {
    if (press && ev.pointerId === press.id && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 10) cancelPress();
  }, true);
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, ev => { if (press && ev.pointerId === press.id) cancelPress(); }, true));
  /* the finger lifting after a long press must not also press the word's button or card */
  document.addEventListener('click', ev => {
    if (!swallowClick || (card && card.contains(ev.target))) return;
    swallowClick = false; ev.preventDefault(); ev.stopPropagation();
  }, true);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && card && card.isConnected) close(); });
  window.addEventListener('scroll', () => { cancelPress(); if (card && card.isConnected) place(); }, { capture: true, passive: true });
  window.addEventListener('resize', () => { if (card && card.isConnected) place(); });

  /* ── one tip, the first time ───────────────────────────────────────────── */
  function hint() {
    if (store.get('house-dict-hint-seen', false) || document.documentElement.getAttribute('data-dict') === 'off') return;
    if (!document.querySelector('.page, .exercise-page')) return;
    setTimeout(() => {
      injectStyles();
      const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      const h = document.createElement('div');
      h.className = 'hd-hint';
      h.setAttribute('role', 'status');
      h.textContent = touch ? '📖 Tip: press and hold a word to see what it means.' : '📖 Tip: right-click a word to see what it means.';
      const done = () => { h.remove(); store.set('house-dict-hint-seen', true); };
      h.addEventListener('click', done);
      document.body.appendChild(h);
      setTimeout(done, 7000);
    }, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hint); else hint();

  window.HouseDict = {
    lookup(word) {
      ensureCard();
      return open({ status: 'ok', node: document.body, toks: [{ text: String(word), joined: false }], idx: 0 }, { focus: true });
    },
    close,
    saved: () => store.get('house-dict-saved', []),
    /* one entry, as the card shows it: {key, display, emoji, ipa:[], say:[], senses:[{pos, level, def, ex, es}], rank, variant}, or null */
    get: key => getEntry(norm(key), glossary()),
    unsave(key) {
      const list = store.get('house-dict-saved', []).filter(s => s.key !== norm(key));
      store.set('house-dict-saved', list); notifySaved(list);
      if (card && card.dataset.key === norm(key)) { const st = card.querySelector('[data-star]'); if (st) { st.textContent = '☆'; st.setAttribute('aria-pressed', 'false'); } }
      return list;
    },
    /* replace the whole list (My Words import): [{word, key, page, time}] */
    setSaved(list) {
      const seen = new Set();
      list = (Array.isArray(list) ? list : []).filter(s => s && s.key && !seen.has(norm(s.key)) && seen.add(norm(s.key)))
        .map(s => ({ word: String(s.word || s.key), key: norm(s.key), page: String(s.page || ''), time: +s.time || Date.now() }));
      store.set('house-dict-saved', list); notifySaved(list);
      if (card && card.dataset.key) { const on = seen.has(card.dataset.key), st = card.querySelector('[data-star]'); if (st) { st.textContent = on ? '★' : '☆'; st.setAttribute('aria-pressed', String(on)); } }
      return list;
    },
    say: (text, slow) => say(text, null, slow),
    voice: () => { const v = pickVoice(); return v ? v.name + ' (' + v.lang + ')' : null; },
    core: CORE
  };
})();
