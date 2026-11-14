/* ══════════════════════════════════════════════════════════════════════════
   house-interview.js — HouseInterview: the "write your partner's answers"
   cards for freer-practice pages.

   One card per partner. Each card has the partner's name at the top and one
   text box per question; ➕ Add partner makes another card with the same boxes.
   Every partner gets a colour of their own (the left edge of the card and the
   numbered dot), in the style of the player cards on
   a1_freer_time_and_weather_where_are_you.html.

   Load it after house.js:
     <script src="house.js"></script>
     <script src="house-interview.js"></script>

     <div id="interview"></div>

     HouseInterview.build({
       container: 'interview',             // element id (or element)
       fields: [                            // one text box per field, in this order
         { icon: '💪', label: 'good at', placeholder: 'cooking, math…' },
         { icon: '🤩', label: 'interested in' }
       ],
       namePlaceholder: 'Your partner’s name',   // optional
       addLabel: '➕ Add partner',                // optional
       max: 8,                              // optional: most cards (default 8)
       start: 1,                            // optional: cards on a fresh page (default 1)
       storageKey: 'my-profile'             // optional: where this browser keeps the answers
     });
     → { add(), clear(), data() }           data() = [{ name, answers: [..] }, …]

   What is written stays in this browser (localStorage, per page) so a reload
   doesn't lose it; 🗑️ Clear all empties every card. Nothing is sent anywhere.
   Styles are self-injected, like the error hunt's; sizes are in rem so the
   🔎 slider scales the cards.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'house-interview-styles';
  /* the same six colours as the time-and-weather player cards, then two more */
  var COLOURS = ['#ff6b6b', '#ffd166', '#4cc9f0', '#80ed99', '#c77dff', '#ff9f1c', '#f472b6', '#2dd4bf'];

  var CSS = ''
    + '.hi-head{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin:0 0 8px; font-size:.8667rem; color:var(--text-secondary); }'
    + '.hi-head .hi-btns{ display:flex; flex-wrap:wrap; gap:6px; }'
    + '.hi-head button:disabled{ opacity:.45; cursor:default; }'
    + '.hi-list{ display:grid; grid-template-columns:repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap:8px; margin:0 0 12px; }'
    + '.hi-card{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:6px 8px; align-items:center; padding:8px 10px;'
    +   ' background:var(--surface-2); border:1px solid var(--border); border-left:5px solid var(--pc); border-radius:var(--border-radius-lg); }'
    + '.hi-card, .hi-card *{ box-sizing:border-box; }'
    + '.hi-dot{ width:1.9em; height:1.9em; border-radius:50%; background:var(--pc); color:#15171c; font-weight:800; font-size:.9rem;'
    +   ' display:flex; align-items:center; justify-content:center; }'
    + '.hi-name{ width:100%; min-width:0; font-weight:600; }'
    + '.hi-x{ padding:4px 9px; font-size:.8rem; }'
    + '.hi-x[hidden]{ display:none; }'
    + '.hi-fields{ grid-column:1 / 4; display:grid; grid-template-columns:auto minmax(0,1fr); gap:5px 8px; align-items:center; margin-top:2px; }'
    + '.hi-label{ font-size:.8667rem; font-weight:600; color:var(--text-primary); white-space:nowrap; }'
    + '.hi-label .hi-ico{ display:inline-block; width:1.4em; text-align:center; }'
    + '.hi-input{ width:100%; min-width:0; font-size:.9333rem; padding:4px 8px; }'
    + '.hi-input:focus, .hi-name:focus{ border-color:var(--pc); box-shadow:0 0 0 2px color-mix(in srgb, var(--pc) 35%, transparent); }'
    + '@media (max-width:420px){ .hi-fields{ grid-template-columns:1fr; } .hi-label{ margin-top:4px; } }'
    + '@media print{ .hi-head .hi-btns, .hi-x{ display:none; } .hi-card{ break-inside:avoid; } }';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function el(id) { return typeof id === 'string' ? document.getElementById(id) : id; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build(opts) {
    opts = opts || {};
    var host = el(opts.container);
    if (!host) return null;
    injectStyles();

    var fields = opts.fields || [];
    var max = Math.max(1, Math.min(COLOURS.length, opts.max || 8));
    var start = Math.max(1, Math.min(max, opts.start || 1));
    var key = 'house-interview:' + (opts.storageKey || (location.pathname.split('/').pop() || 'page'));
    var namePh = opts.namePlaceholder || 'Your partner’s name';

    /* people: [{ name, answers: [..], colour }] */
    var people = load() || [];
    while (people.length < start) people.push(blank());

    host.classList.add('hi-wrap');
    host.innerHTML =
      '<div class="hi-head"><span>Partners: <strong class="hi-count">1</strong> / ' + max + '</span>' +
      '<span class="hi-btns"><button type="button" class="hi-add">' + esc(opts.addLabel || '➕ Add partner') + '</button>' +
      '<button type="button" class="hi-clear" title="Empty every card">🗑️ Clear all</button></span></div>' +
      '<div class="hi-list"></div>';
    var list = host.querySelector('.hi-list'), countEl = host.querySelector('.hi-count');
    var addBtn = host.querySelector('.hi-add'), clearBtn = host.querySelector('.hi-clear');

    function freeColour() {
      for (var i = 0; i < COLOURS.length; i++) {
        if (!people.some(function (p) { return p.colour === COLOURS[i]; })) return COLOURS[i];
      }
      return COLOURS[0];
    }
    function blank() { return { name: '', answers: fields.map(function () { return ''; }), colour: freeColour() }; }

    function save() {
      try { localStorage.setItem(key, JSON.stringify(people)); } catch (e) { /* private mode */ }
    }
    function load() {
      try {
        var p = JSON.parse(localStorage.getItem(key));
        if (!Array.isArray(p) || !p.length) return null;
        return p.slice(0, max).map(function (x, i) {
          return {
            name: typeof x.name === 'string' ? x.name : '',
            answers: fields.map(function (f, k) { return x.answers && typeof x.answers[k] === 'string' ? x.answers[k] : ''; }),
            colour: COLOURS.indexOf(x.colour) !== -1 ? x.colour : COLOURS[i % COLOURS.length]
          };
        });
      } catch (e) { return null; }
    }

    function render() {
      list.innerHTML = '';
      people.forEach(function (p, i) {
        var card = document.createElement('div');
        card.className = 'hi-card';
        card.style.setProperty('--pc', p.colour);
        card.setAttribute('role', 'group');
        card.setAttribute('aria-label', 'Partner ' + (i + 1));
        card.innerHTML =
          '<span class="hi-dot" aria-hidden="true">' + (i + 1) + '</span>' +
          '<input type="text" class="hi-name" maxlength="30" autocomplete="off" placeholder="' + esc(namePh) + '" aria-label="Partner ' + (i + 1) + ' name">' +
          '<button type="button" class="hi-x" title="Remove this partner" aria-label="Remove partner ' + (i + 1) + '"' + (people.length > 1 ? '' : ' hidden') + '>✕</button>' +
          '<div class="hi-fields">' + fields.map(function (f, k) {
            var id = 'hi-' + Math.random().toString(36).slice(2, 8) + '-' + k;
            return '<label class="hi-label" for="' + id + '">' + (f.icon ? '<span class="hi-ico" aria-hidden="true">' + f.icon + '</span> ' : '') + esc(f.label) + '</label>' +
              '<input type="text" class="hi-input" id="' + id + '" data-k="' + k + '" autocomplete="off" placeholder="' + esc(f.placeholder || '') + '">';
          }).join('') + '</div>';

        var name = card.querySelector('.hi-name');
        name.value = p.name;
        name.addEventListener('input', function () { p.name = name.value; save(); });
        card.querySelectorAll('.hi-input').forEach(function (inp) {
          var k = +inp.dataset.k;
          inp.value = p.answers[k] || '';
          inp.addEventListener('input', function () { p.answers[k] = inp.value; save(); });
        });
        card.querySelector('.hi-x').addEventListener('click', function () {
          var filled = p.name.trim() || p.answers.some(function (a) { return a.trim(); });
          if (filled && !global.confirm('Remove ' + (p.name.trim() || 'partner ' + (i + 1)) + '? Their answers will be deleted.')) return;
          people.splice(i, 1); save(); render();
        });
        list.appendChild(card);
      });
      countEl.textContent = people.length;
      addBtn.disabled = people.length >= max;
    }

    function add() {
      if (people.length >= max) return;
      people.push(blank()); save(); render();
      var last = list.lastElementChild;
      if (last) last.querySelector('.hi-name').focus();
    }
    function clear() {
      people = []; for (var i = 0; i < start; i++) people.push(blank());
      save(); render();
    }

    addBtn.addEventListener('click', add);
    clearBtn.addEventListener('click', function () {
      if (global.confirm('Empty every card?')) clear();
    });
    render();

    return {
      add: add, clear: clear,
      data: function () { return people.map(function (p) { return { name: p.name, answers: p.answers.slice() }; }); }
    };
  }

  global.HouseInterview = { build: build, COLOURS: COLOURS };
})(window);
