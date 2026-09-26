/* ══════════════════════════════════════════════════════════════════════════
   house.js — the shared behaviour for every lesson page in this library.

   Bundles four things:
     · the light/dark theme toggle
     · HouseWordOrder — the tap/drag sentence-builder engine
     · HouseGapFill   — the Damerau-Levenshtein accuracy-bar gap fill
     · HouseGrammar   — the part-of-speech highlighting toggle
     · HouseFontSize  — the 🔎 text-size slider
     · HouseRandomGen — the 🎲 freer-practice prompt generator
     · HouseMatching  — two-column matching with connector lines
     · HouseTimeline  — tense timelines
     · HouseFormClarf — drag POS chips onto sentence parts
     · HouseErrorHunt — find and fix the mistakes
     · HouseCCQ       — concept checking questions
     · favicon        — auto-sets a level badge in the browser tab
     · HouseComprehension — the before/after reading questions

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
   A 🔎 button under the theme toggle that opens a slider running from 10px to
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

    document.body.appendChild(wrap);
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

    function open(state) {
      panel.classList.toggle('open', state);
      btn.setAttribute('aria-expanded', String(state));
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
   A tapped gap only ever offers Insert — deleting or moving "nothing" makes
   no sense. Wrong action/word/destination flashes the offending chip(s) red
   and shakes them, then the popover closes so the student can try again.
   Some sentences can have no error at all (error: null) — OK on those just
   confirms "✓ Correct — nothing was wrong!" instead of "✓ Fixed!".

   Usage:
     HouseErrorHunt.build({
       container: 'errorHunt',   // element id (or element) to render into
       items: EH_ITEMS,          // see item shape below
       scoreEl: 'ehScore',       // element id for the running "fixed" count
       totalEl: 'ehTotal',       // element id for the item count
       prompt: 'optional hint shown once above all the sentences'
     });

   A sentence can have any number of independent errors, tappable and
   resolvable in any order — the sentence only counts as fixed once every
   one of them is. Item shape:
     { words: [...], errors: [] }                     // no mistake
     { words: [...], errors: [ <error>, <error>, ... ] }
   where each <error> is one of:
     { type:'missing',   gapIndex,  options, correct }
     { type:'extra',     wordIndex }
     { type:'misplaced', wordIndex, targetGapIndex }
     { type:'wrong',     wordIndex, options, correct }
   A single error is also accepted directly as the older, singular shape —
   `{ words: [...], error: null }` or `{ words: [...], error: <error> }` —
   for pages written before multi-error sentences existed; both forms work.
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
    + '.eh2-prompt{ font-size:13px; color:var(--text-secondary); margin-bottom:10px; }';

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

      // Back-compat: a single `error` (object or null) is treated as a
      // one-element (or empty) `errors` list, so existing pages using the
      // singular field keep working unchanged.
      var errorsList = item.errors || (item.error ? [item.error] : []);
      var errorResolved = errorsList.map(function () { return false; });
      var resolved = errorsList.length === 0; // nothing to fix: already "solved"
      var activeTarget = null;    // { kind: 'word'|'gap', index, errorIndex }
      var pickingDestination = false;
      var anchorEl = null;
      var gapEls = [];
      var wordEls = [];

      function updateResolved() {
        resolved = errorResolved.length === 0 || errorResolved.every(function (r) { return r; });
      }

      function findErrorForWord(i) {
        for (var k = 0; k < errorsList.length; k++) {
          if (errorResolved[k]) continue;
          var e = errorsList[k];
          if ((e.type === 'extra' || e.type === 'misplaced' || e.type === 'wrong') && e.wordIndex === i) return k;
        }
        return -1;
      }
      function findErrorForGap(i) {
        for (var k = 0; k < errorsList.length; k++) {
          if (errorResolved[k]) continue;
          var e = errorsList[k];
          if (e.type === 'missing' && e.gapIndex === i) return k;
        }
        return -1;
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
              w.addEventListener('click', function () { onWordClick(i); });
              sentEl.appendChild(w);
              wordEls[i] = w;
            }
          })(i);
        }
      }

      function closeMenu() {
        menuEl.classList.remove('open');
        menuEl.innerHTML = '';
        if (anchorEl) anchorEl.classList.remove('active-target');
        activeTarget = null;
        anchorEl = null;
        pickingDestination = false;
        gapEls.forEach(function (g) { g.classList.remove('target-pick'); });
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
        var errIdx = findErrorForWord(i);
        if (errIdx === -1) return; // correct word: nothing happens
        openActionMenu('word', i, errIdx);
      }

      function onGapClick(i) {
        if (pickingDestination) {
          var e = errorsList[activeTarget.errorIndex];
          // The two gaps immediately touching the word itself aren't real
          // destinations — moving it there is a no-op. They were never
          // offered as options (see startDestinationPick), so a click here
          // shouldn't register as an attempt at all, right or wrong.
          if (i === e.wordIndex || i === e.wordIndex + 1) return;
          if (e.type === 'misplaced' && i === e.targetGapIndex) {
            performMove(e.wordIndex, i);
            errorResolved[activeTarget.errorIndex] = true;
            updateResolved();
            closeMenu();
          } else {
            flashWrong([wordEls[e.wordIndex], gapEls[i]]);
            closeMenu();
          }
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

      function openActionMenu(kind, index, errIdx) {
        closeMenu();
        activeTarget = { kind: kind, index: index, errorIndex: errIdx };
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
        var t = activeTarget;
        if (!t) return;
        var e = errorsList[t.errorIndex];
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
            errorResolved[t.errorIndex] = true;
            updateResolved();
            closeMenu();
          } else {
            flashWrong([targetEl]);
            closeMenu();
          }
          return;
        }
        if (action === 'move') {
          if (e.type === 'misplaced' && t.kind === 'word' && t.index === e.wordIndex) {
            startDestinationPick();
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
              errorResolved[activeTarget.errorIndex] = true;
              updateResolved();
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

      function startDestinationPick() {
        menuEl.innerHTML = '';
        var hint = document.createElement('div');
        hint.className = 'eh2-menu-hint';
        hint.textContent = 'Where to?';
        menuEl.appendChild(hint);
        menuEl.classList.add('open');
        pickingDestination = true;
        var e = errorsList[activeTarget.errorIndex];
        gapEls.forEach(function (g, i) {
          // A gap right after sentence-ending punctuation isn't a real
          // position in the sentence — never offer it as a move destination.
          if (i > 0 && ENDERS.indexOf(item.words[i - 1]) !== -1) return;
          // Nor are the two gaps immediately touching the word being moved —
          // dropping it right back next to itself doesn't move anything.
          if (i === e.wordIndex || i === e.wordIndex + 1) return;
          g.classList.add('target-pick');
        });
        positionMenu();
      }

      function insertWordAt(gapIndex, word) {
        var chip = document.createElement('span');
        chip.className = 'eh2-word inserted';
        chip.textContent = word;
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
          : (wasFirst ? decapitalizeFirst(originalWord) : originalWord);

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
          currentFirstWordEl.textContent = decapitalizeFirst(currentFirstWordEl.textContent);
        } else if (wasFirst && !willBeFirst) {
          // The moved word WAS first and has left; whichever word is now
          // at the front of the sentence needs to gain a capital letter.
          var newFirstEl = sentEl.querySelector('.eh2-word');
          if (newFirstEl) newFirstEl.textContent = capitalizeFirst(newFirstEl.textContent);
        }
      }

      okBtn.addEventListener('click', function () {
        if (resolved) {
          verdictEl.textContent = errorsList.length ? '✓ Fixed!' : '✓ Correct — nothing was wrong!';
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
        errorResolved = errorResolved.map(function () { return false; });
        updateResolved();
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
              row.appendChild(why);
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
