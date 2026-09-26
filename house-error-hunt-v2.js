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
