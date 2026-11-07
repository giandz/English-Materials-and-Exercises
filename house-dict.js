/* ═══════════════════════════════════════════════════════════════════════════
   house-dict.js — the learner's dictionary on every lesson page.

   Right-click a word (computer) or press and hold it (phone, tablet). A card
   opens beside the word with:
     · its pronunciation — IPA, plus an easy "sounds like" spelling (HAP-ee)
     · a 🔊 button (HouseSpeak when the page has it, speech synthesis if not)
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
     2. learner-dict/ next to this file, made by build_learner_dict.js from
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

   Loading: house.js loads this file on every page — paste the loader block from the
   end of this file into house.js. The dictionary data loads on the first lookup only.

   API   HouseDict.lookup('went')    open the card for a word (centred)
         HouseDict.close()
         HouseDict.saved()           the learner's ☆ words: [{word, key, page, time}]
         HouseDict.core              the lemmatiser, shared with build_learner_dict.js
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══ CORE — no DOM. build_learner_dict.js require()s this part. ══════════ */

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
  if (typeof module === 'object' && module.exports) { module.exports = CORE; return; }
  if (typeof document === 'undefined' || window.HouseDict) return;

  /* ══ PAGE ════════════════════════════════════════════════════════════════ */

  const SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE = SRC ? SRC.replace(/[^/]*$/, '') : '';
  const DATA = document.documentElement.getAttribute('data-dict-base') || (BASE + 'learner-dict/');
  const PAGE = (location.pathname.split('/').pop() || '').toLowerCase();

  const NEVER = 'input, textarea, select, option, [contenteditable=""], [contenteditable="true"], script, style, ' +
    '#theme-toggle-wrap, #font-size-wrap, #font-size-panel, #bionic-wrap, #pmStart, #pmToggle, .hd-card, .hd-hint, [data-dict="off"]';
  /* the card would give the answer away here, until the exercise is done */
  const NOT_YET = '.match-card:not(.matched), .match-stage .card:not(.matched):not(.done), ' +
    '.eh2-item:not(.correct), .eh-item:not(.eh-correct), .fc-wrap:not(.fc-done)';
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
    const e = { key, display: (gl && gl._display) || (d && d.display) || key.replace(/^i\b/, 'I'), ipa: [], say: [], senses: [], lesson: false, speak: null, ipaSrc: null };
    if (d) { e.ipa = (d.ipa || []).slice(); e.say = (d.say || []).slice(); if (e.ipa.length) e.ipaSrc = 'cmu'; e.senses = (d.senses || []).slice(); e.short = d.short; }
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
.hd-head{ font-size:1.2rem; font-weight:700; letter-spacing:-.01em; overflow-wrap:anywhere; }
.hd-flex{ flex:1; }
.hd-card button{ font-family:inherit; cursor:pointer; }
.hd-icon{ border:1px solid var(--border, #ebebee); background:var(--surface-1, #f7f7f8); color:inherit; border-radius:999px;
  min-width:2rem; height:2rem; padding:0 .45rem; font-size:.9rem; line-height:1; display:inline-flex; align-items:center; justify-content:center; }
.hd-icon:hover{ background:var(--color-background-tertiary, #eeeef0); }
.hd-icon[aria-pressed="true"]{ border-color:var(--text-accent, #185fa5); color:var(--text-accent, #185fa5); }
.hd-icon.is-speaking{ animation:hd-say .5s ease; }
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

  function say(text, btn) {
    if (!text) return;
    if (btn) { btn.classList.remove('is-speaking'); void btn.offsetWidth; btn.classList.add('is-speaking'); }
    if (window.HouseSpeak && window.HouseSpeak.speak) { window.HouseSpeak.speak(text, btn); return; }
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.85;
    s.speak(u);                  /* synchronous inside the tap: iOS needs that */
  }

  function senseHtml(s, i, lessonFirst) {
    const k = posKey(s.pos);
    return `<li class="hd-sense">
      <div class="hd-meta">${s.pos ? `<span class="hd-pos" data-k="${k}">${esc(s.pos)}</span>` : ''}${s.level ? `<span class="hd-level">${esc(s.level)}</span>` : ''}${i === 0 && lessonFirst ? '<span class="hd-badge">In this lesson</span>' : ''}</div>
      <div class="hd-def">${esc(s.def)}</div>
      ${s.ex ? `<div class="hd-ex">“${esc(s.ex)}”<button class="hd-icon" data-say="${esc(s.ex)}" aria-label="Listen to the example">🔊</button></div>` : ''}
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
        body += `<div class="hd-from">${esc(res.surface)}${res.formPron ? ` <span class="hd-ipa">/${esc(res.formPron.ipa[0])}/</span>` : ''}: ${esc(formLabel(m.tag, firstPos))} <b>${esc(e.display)}</b></div>`;
      if (e && (e.ipa.length || e.say.length)) {
        body += `<div class="hd-pron">${e.ipa[0] ? `<span class="hd-ipa">/${esc(e.ipa[0])}/</span>` : ''}${e.say[0] ? `<span class="hd-sayas">sounds like <b>${esc(e.say[0])}</b></span>` : ''}` +
          (e.ipa[1] ? `<span class="hd-alt">also /${esc(e.ipa[1])}/</span>` : '') + '</div>';
      }
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
        if (e.ipaSrc === 'cmu') srcs.push(CREDIT.cmu);
        if (srcs.length) body += `<div class="hd-src">${srcs.join(' · ')}</div>`;
      }
    }
    const hasEs = e && e.senses.some(s => s.es);
    const key = e ? e.key : norm(res.surface);
    const isSaved = saved.some(s => s.key === key);
    const speakText = (e && e.speak) || res.surface;
    card.innerHTML = `
      <div class="hd-top">
        <span class="hd-head" id="hd-head">${esc(head)}</span>
        ${hit.status === 'notyet' ? '' : `<button class="hd-icon" data-say="${esc(speakText)}" aria-label="Listen">🔊</button>`}
        <span class="hd-flex"></span>
        ${hasEs ? `<button class="hd-icon hd-es-btn" data-es aria-pressed="${store.get('house-dict-es', false)}" title="Spanish" aria-label="Show Spanish">ES</button>` : ''}
        ${hit.status === 'notyet' ? '' : `<button class="hd-icon" data-star aria-pressed="${isSaved}" aria-label="${isSaved ? 'Saved' : 'Save this word'}" title="Save this word">${isSaved ? '★' : '☆'}</button>`}
        <button class="hd-icon" data-close aria-label="Close">✕</button>
      </div>${body}`;
    card.classList.toggle('show-es', !!(hasEs && store.get('house-dict-es', false)));
    card.dataset.key = key;
  }

  function onCardClick(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    ev.stopPropagation();
    if (b.hasAttribute('data-say')) say(b.getAttribute('data-say'), b);
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
    core: CORE
  };
})();

/* ══ LOADER — paste into house.js, after the pron-adapter block ══════════════
(function () {
  'use strict';
  function start() {
    if (window.HouseDict || document.getElementById('house-dict-js')) return;
    var base = '';
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      if (/house\.js$/.test(scripts[i].src)) { base = scripts[i].src.replace(/house\.js$/, ''); break; }
    }
    var s = document.createElement('script');
    s.id = 'house-dict-js';
    s.src = base + 'house-dict.js';
    document.body.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
})();
   ══════════════════════════════════════════════════════════════════════════ */
