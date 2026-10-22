/* ══════════════════════════════════════════════════════════════════════════
   lab-kit.js — shared behaviour for the self-study grammar labs
   (a1_extra_wh_questions_be_lab, a1_extra_wh_questions_do_does_lab,
   a2_extra_modal_verbs_lab). Load it after house.js.

   A lab page supplies only data; this file builds:
     · tabs — one per section, plus ⚠️ Common mistakes and 🔍 Error hunt.
       Only the chosen tab's panel is shown; the tab is kept in the URL hash.
     · each section's card — examples (POS-tagged), then "Try it" in three
       steps, easiest first: 1 · choose (multiple choice) → 2 · build
       (HouseWordOrder) → 3 · write (HouseGapFill).
     · 🎲 Again on every exercise — draws a new random item from the
       section's generator (never the same one twice in a row).
     · the error hunt (HouseErrorHunt) — a random set from a larger pool.
     · the "Mastered" counter: a section is mastered once all three steps
       have been answered correctly at least once.

     LabKit.build({
       sections: [{
         id, emoji, label, pill, note,
         examples: [[cat, '{words|pos} …', why, label?], …],   // cat: pos | neg | q | cel
         prompts: { choice, drag, gap },
         gen: () => ({ ctx, tokens:[[word,pos], …], wrong:[…], alts?, gapCtx?, gapDirect?, key? })
       }],
       mistakes: [[wrong, right], …],
       errorHunt: [HouseErrorHunt items], ehCount: 6, ehPrompt: '…'
     });

   `tokens` is the target sentence, punctuation included as its own token with
   pos null. It drives all three steps: its text is the right option, the
   word-order chips, and the gap-fill answer (plus `alts`). `wrong` holds the
   distractors; two are drawn at random each time.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'lab-kit-styles';
  var CSS = ''
    /* rule panel */
    + '.pattern{ display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; font-size:1rem; font-weight:600; margin:2px 0 10px; }'
    + '.pattern .plus{ color:var(--text-muted); font-weight:400; }'
    + '.subj-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin:0 0 10px; }'
    + '.subj-card{ background:var(--surface-2); border:1px solid var(--color-border-tertiary); border-radius:12px; padding:8px 10px; text-align:center; }'
    + '.subj-card .verb-big{ display:block; font-size:1.2rem; font-weight:700; margin-bottom:2px; }'
    + '.subj-card .subj-list{ display:block; font-size:.9333rem; color:var(--text-primary); }'
    + '.subj-card .subj-note{ display:block; font-size:.7333rem; color:var(--text-muted); }'
    /* tabs */
    + '.lab-tabs{ display:flex; flex-wrap:wrap; gap:6px; margin:0 0 1rem; }'
    + '.lab-tab{ cursor:pointer; font-family:inherit; line-height:1.4; }'
    + '.lab-tab[aria-selected="true"]{ background:var(--color-background-info); color:var(--color-text-info); border-color:var(--text-accent); font-weight:700; }'
    + '.lab-tab.done::after{ content:" ✓"; color:var(--good); font-weight:700; }'
    + '.lab-panel[hidden]{ display:none; }'
    /* section card */
    + '.wh-card{ background:var(--surface-2); border:.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-lg); padding:14px 16px; margin-bottom:16px; }'
    + '.wh-card.done{ border-color:var(--good); }'
    + '.wh-head{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }'
    + '.wh-emoji{ font-size:1.6rem; line-height:1; }'
    + '.wh-head h2{ margin:0; }'
    + '.wh-pill{ display:inline-block; font-size:.8rem; font-weight:700; color:var(--pos-wh); }'
    + '.wh-done{ margin-left:auto; display:none; font-size:.7333rem; font-weight:700; color:var(--good); background:var(--good-bg); border-radius:20px; padding:2px 9px; }'
    + '.wh-card.done .wh-done{ display:inline-block; }'
    + '.wh-note{ font-size:.8667rem; color:var(--text-secondary); margin:0 0 10px; }'
    + '.ex-row{ border-top:.5px dashed var(--color-border-secondary); padding:8px 0 6px; }'
    + '.ex-row .cat-tag{ margin-bottom:4px; }'
    + '.ex-sent{ font-size:1rem; line-height:1.7; }'
    + '.ex-why{ font-size:.7667rem; color:var(--text-muted); font-family:var(--font-mono); }'
    /* steps */
    + '.lab-step{ border-top:.5px solid var(--color-border-tertiary); margin-top:10px; padding-top:10px; }'
    + '.step-head{ display:flex; align-items:center; gap:8px; margin-bottom:6px; }'
    + '.step-label{ font-size:.7333rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--text-accent); }'
    + '.step-ok{ display:none; font-size:.7333rem; font-weight:700; color:var(--good); }'
    + '.lab-step.done .step-ok{ display:inline; }'
    + '.again-btn{ margin-left:auto; font-size:.8rem; padding:4px 11px; }'
    + '.lab-step .subtitle{ margin-bottom:6px; }'
    + '.lab-step .quiz-q, .lab-step .gf-item, .lab-step .wo-item{ margin-bottom:0; }'
    + '.choice-ctx, .stmt{ font-weight:600; color:var(--text-primary); }'
    + '.choice-ctx{ font-size:.9667rem; margin-bottom:6px; }'
    + '.cue{ font-weight:400; color:var(--text-secondary); white-space:nowrap; }'
    + '.eh-bar{ display:flex; align-items:center; gap:8px; margin-bottom:.55rem; }'
    + '.eh-bar .score-bar{ margin:0; }';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── helpers, also used by the lab pages' generators ──────────────────── */
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  function words(str, pos) {
    return str ? str.split(' ').filter(Boolean).map(function (w) { return [w, pos]; }) : [];
  }
  function join(tokens) {
    return tokens.map(function (t) { return t[0]; }).join(' ').replace(/ ([?.!,])/g, '$1');
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function tag(s) { return s.replace(/\{([^|}]+)\|(\w+)\}/g, '<span class="pos-hl pos-$2">$1</span>'); }

  // Typed answers: with or without the final ? / . and with either apostrophe.
  function variants(list) {
    var out = [];
    function add(v) { if (out.indexOf(v) === -1) out.push(v); }
    list.forEach(function (a) {
      a = a.trim();
      [a, a.replace(/[.?!]$/, '')].forEach(function (v) {
        add(v); add(v.replace(/’/g, "'"));
      });
    });
    return out;
  }

  var LABEL = { pos: 'Affirmative', neg: 'Negative', q: 'Question', cel: 'Wh-question' };
  var uid = 0;
  function nid(p) { return p + '-' + (++uid); }

  function build(cfg) {
    injectStyles();

    var tabsEl = document.getElementById(cfg.tabs || 'labTabs');
    var panelsEl = document.getElementById(cfg.panels || 'labPanels');
    var scoreEl = document.getElementById('masteredScore');
    var totalEl = document.getElementById('masteredTotal');
    if (totalEl) totalEl.textContent = cfg.sections.length;

    var mastered = new Set();
    var tabs = [];

    /* ── a section: card + three steps ──────────────────────────────────── */
    function sectionPanel(sec) {
      var panel = document.createElement('div');
      var card = document.createElement('section');
      card.className = 'wh-card';
      card.innerHTML =
        '<div class="wh-head"><span class="wh-emoji" aria-hidden="true">' + sec.emoji + '</span>' +
          '<div><h2>' + sec.label + '</h2><span class="wh-pill">' + sec.pill + '</span></div>' +
          '<span class="wh-done">✓ Mastered</span></div>' +
        '<p class="wh-note">' + sec.note + '</p>' +
        sec.examples.map(function (ex) {
          return '<div class="ex-row"><span class="cat-tag ' + ex[0] + '">' + (ex[3] || LABEL[ex[0]]) + '</span>' +
            '<div class="ex-sent">' + tag(ex[1]) + '</div>' +
            (ex[2] ? '<div class="ex-why">' + ex[2] + '</div>' : '') + '</div>';
        }).join('') +
        '<div class="sec-div">Try it</div>';
      panel.appendChild(card);

      var done = { choice: false, drag: false, gap: false };
      function markStep(key, stepEl) {
        if (done[key]) return;
        done[key] = true;
        stepEl.classList.add('done');
        if (done.choice && done.drag && done.gap && !mastered.has(sec.id)) {
          mastered.add(sec.id);
          card.classList.add('done');
          var btn = tabsEl.querySelector('[data-tab="' + sec.id + '"]');
          if (btn) btn.classList.add('done');
          if (scoreEl) scoreEl.textContent = mastered.size;
        }
      }

      function step(n, key, title, prompt, render) {
        var el = document.createElement('div');
        el.className = 'lab-step';
        el.innerHTML =
          '<div class="step-head"><span class="step-label">Step ' + n + ' · ' + title + '</span>' +
          '<span class="step-ok">✓</span>' +
          '<button class="again-btn" type="button">🎲 Again</button></div>' +
          (prompt ? '<p class="subtitle">' + prompt + '</p>' : '') +
          '<div class="step-body"></div>';
        card.appendChild(el);
        var body = el.querySelector('.step-body');
        var last = null;

        function roll() {
          var item, tries = 0;
          do { item = sec.gen(); tries++; }
          while ((item.key || join(item.tokens)) === last && tries < 15);
          last = item.key || join(item.tokens);
          // A fresh host each time, so the engines' own listeners never stack up.
          body.innerHTML = '';
          var host = document.createElement('div');
          host.id = nid(sec.id + '-' + key);
          body.appendChild(host);
          render(host, item, function () { markStep(key, el); });
        }
        el.querySelector('.again-btn').addEventListener('click', roll);
        roll();
      }

      step(1, 'choice', 'Choose', null, function (host, item, ok) {
        var right = join(item.tokens);
        var pool = [];
        item.wrong.forEach(function (w) { if (w !== right && pool.indexOf(w) === -1) pool.push(w); });
        var opts = shuffle([right].concat(sample(pool, 2)));
        host.innerHTML = '<div class="quiz-q"><div class="choice-ctx">' + item.ctx + '</div>' +
          '<div class="q-text">' + sec.prompts.choice + '</div>' +
          opts.map(function (o, i) { return '<button class="opt" type="button" data-i="' + i + '">' + o + '</button>'; }).join('') +
          '<div class="q-feedback"></div></div>';
        host.addEventListener('click', function (e) {
          var b = e.target.closest('.opt');
          if (!b || b.disabled) return;
          var all = host.querySelectorAll('.opt');
          all.forEach(function (x) { x.disabled = true; });
          var fb = host.querySelector('.q-feedback');
          if (opts[+b.dataset.i] === right) {
            b.classList.add('correct');
            fb.textContent = '✓ Correct!';
            fb.className = 'q-feedback correct';
            ok();
          } else {
            b.classList.add('incorrect');
            all[opts.indexOf(right)].classList.add('correct');
            fb.textContent = '✗ Not quite — the correct answer is green. Press 🎲 Again to try another.';
            fb.className = 'q-feedback incorrect';
          }
        });
      });

      step(2, 'drag', 'Build', sec.prompts.drag, function (host, item, ok) {
        HouseWordOrder.build({
          container: host,
          items: [{
            context: item.ctx,
            text: item.tokens.map(function (t) { return t[0]; }).join(' / '),
            pos: item.tokens.map(function (t) { return t[1] || 'none'; })
          }]
        });
        new MutationObserver(function () {
          if (host.querySelector('.target-zone.correct')) ok();
        }).observe(host, { subtree: true, attributes: true, attributeFilter: ['class'] });
      });

      step(3, 'gap', 'Write', null, function (host, item, ok) {
        HouseGapFill.build({
          container: host,
          items: [{
            direct: item.gapDirect || sec.prompts.gap,
            template: '<span class="stmt">' + (item.gapCtx || item.ctx) + '</span><br>{0}',
            hints: [{ accepted: variants([join(item.tokens)].concat(item.alts || [])) }]
          }]
        });
        // Long answers: never wider than the card on a phone.
        host.querySelectorAll('.gf-gap-wrap, .gf-gap-input').forEach(function (n) { n.style.maxWidth = '100%'; });
        host.addEventListener('input', function () {
          if (host.querySelector('.gf-gap-input.gap-correct')) ok();
        });
      });

      return panel;
    }

    /* ── common mistakes ────────────────────────────────────────────────── */
    function mistakesPanel() {
      var panel = document.createElement('div');
      panel.innerHTML = '<div class="sec-div">Common mistakes</div>' +
        (cfg.mistakes || []).map(function (m) {
          return '<div class="pair-card"><div class="pair-line no"><span class="mark">✗</span>' + m[0] + '</div>' +
            '<div class="pair-line yes"><span class="mark">✓</span>' + m[1] + '</div></div>';
        }).join('');
      return panel;
    }

    /* ── error hunt: a random set from the pool, 🎲 for a new set ────────── */
    function errorHuntPanel() {
      var panel = document.createElement('div');
      panel.innerHTML = '<div class="sec-div">Error hunt</div>' +
        '<p class="subtitle">' + (cfg.ehPrompt || '') + '</p>' +
        '<div class="eh-bar"><div class="score-bar"><span>Done: <strong id="ehScore">0</strong> / <span id="ehTotal">0</span></span></div>' +
        '<button class="again-btn" type="button">🎲 Again</button></div>' +
        '<div class="eh-body"></div>';
      var body = panel.querySelector('.eh-body');
      function roll() {
        body.innerHTML = '';
        var host = document.createElement('div');
        host.id = nid('eh');
        body.appendChild(host);
        panel.querySelector('#ehScore').textContent = '0';
        HouseErrorHunt.build({
          container: host,
          items: sample(cfg.errorHunt || [], cfg.ehCount || 6),
          scoreEl: 'ehScore', totalEl: 'ehTotal'
        });
      }
      panel.querySelector('.again-btn').addEventListener('click', roll);
      panel._roll = roll;
      return panel;
    }

    cfg.sections.forEach(function (sec) {
      tabs.push({ id: sec.id, label: sec.emoji + ' ' + sec.label, panel: sectionPanel(sec) });
    });
    tabs.push({ id: 'mistakes', label: '⚠️ Common mistakes', panel: mistakesPanel() });
    var eh = errorHuntPanel();
    tabs.push({ id: 'error-hunt', label: '🔍 Error hunt', panel: eh });

    tabsEl.setAttribute('role', 'tablist');
    tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'topic-pill lab-tab';
      b.dataset.tab = t.id;
      b.setAttribute('role', 'tab');
      b.textContent = t.label;
      b.addEventListener('click', function () { activate(t.id, true); });
      tabsEl.appendChild(b);
      t.btn = b;
      t.panel.className = 'lab-panel';
      t.panel.id = 'panel-' + t.id;
      t.panel.setAttribute('role', 'tabpanel');
      panelsEl.appendChild(t.panel);
    });
    // Built after the panel is in the page, because the engine looks its
    // score elements up by id.
    eh._roll();

    function activate(id, fromClick) {
      tabs.forEach(function (t) {
        var on = t.id === id;
        t.panel.hidden = !on;
        t.btn.setAttribute('aria-selected', String(on));
      });
      if (fromClick) {
        try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// in some browsers */ }
        // Keep the tab row in view rather than jumping to the page top.
        var top = tabsEl.getBoundingClientRect().top;
        if (top < 0) tabsEl.scrollIntoView({ block: 'start' });
      }
      // Lines/popovers measure themselves; give anything listening a nudge.
      try { global.dispatchEvent(new Event('resize')); } catch (e) { /* old browser */ }
    }

    var start = (location.hash || '').slice(1);
    activate(tabs.some(function (t) { return t.id === start; }) ? start : tabs[0].id, false);
    global.addEventListener('hashchange', function () {
      var h = location.hash.slice(1);
      if (tabs.some(function (t) { return t.id === h; })) activate(h, false);
    });
  }

  global.LabKit = {
    build: build,
    pick: pick, shuffle: shuffle, sample: sample,
    words: words, join: join, cap: cap
  };
})(window);
