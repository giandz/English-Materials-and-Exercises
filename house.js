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
