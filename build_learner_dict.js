/* ═══════════════════════════════════════════════════════════════════════════
   build_learner_dict.js — makes learner-dict/ for the dictionary in house.js (HouseDict).
   Node 18+, no packages. Run it in the repo folder (next to house.js):

     node build_learner_dict.js --cmu cmudict.dict --wordnet english-wordnet-2025.xml.gz

   Options
     --lessons DIR     the lesson .html files to read                   (default .)
     --defs FILE       simple definitions written for this library      (default dict-src/simple-defs.tsv)
     --cmu FILE        CMU Pronouncing Dictionary, cmudict.dict         https://github.com/cmusphinx/cmudict  (BSD-2)
     --wordnet FILE    Open English WordNet, GWN-LMF .xml or .xml.gz    https://en-word.net/  (CC BY 4.0)
     --out DIR         where the data goes                              (default learner-dict)
     --wn-senses N     WordNet meanings for a word with no simple one   (default 3, 0 = never use WordNet)
     --wn-extra N      WordNet meanings added under a simple one        (default 0)
     --core FILES      frequency lists, one word per line, comma-separated: each entry gets its rank (default dict-src/core-1000.txt,dict-src/core-2000.txt)
     --emoji FILE      word<TAB>emoji: the picture for a word, on the card and in My Words (default dict-src/emoji.tsv)
     --variants FILE   British<TAB>American spellings: an entry is filed under both (default dict-src/spelling-variants.tsv)

   Every source is optional. Without WordNet, only words in simple-defs.tsv get meanings;
   without CMU, only words with an ipa column get pronunciations.

   What goes in: every word and phrase the lessons use (read from the page text AND the
   strings in their scripts, so content drawn by JS counts), filed under its base form
   (went → go), plus every row of simple-defs.tsv. Inflected forms are not stored: the
   page works them out with the same rules (HouseDict.core.candidates).

   What comes out
     learner-dict/a.json … z.json, _.json   entries, one file per first letter
     learner-dict/_phrases.json             phrases to look for around a word
     learner-dict/_meta.json                when, from what, how many
     learner-dict/practice/words.json       for the My Words games only: part of speech, level, syllables,
                                            stress and sounds-alike words (ship / sheep) for each word
     dict-src/report.md                     what to do next (read this)
     dict-src/todo-defs.tsv                 lesson words with no simple definition yet, most used
                                            first, with the lesson sentence and WordNet's meaning
                                            as hints: fill in the definition column, paste the
                                            rows into simple-defs.tsv, build again

   simple-defs.tsv — one meaning per row, tab-separated, header row first. Columns:
     word  pos  level  definition  example  es  [ipa]  [say]
   Several rows for one word = several meanings, in that order. Rows with no definition
   are skipped. Lines starting with # are comments. Keep definitions inside the words
   A1–A2 learners know: report.md lists definitions that use words no A1/A2 lesson has.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
/* the lemmatiser is shared with the pages: run the DICT CORE part of house.js */
const core = (function loadCore() {
  const src = fs.readFileSync(path.join(__dirname, 'house.js'), 'utf8');
  const a = src.indexOf('/* ══ DICT CORE START'), b = src.indexOf('/* ══ DICT CORE END');
  if (a < 0 || b < a) throw new Error('house.js has no DICT CORE START … DICT CORE END block');
  return new Function(src.slice(a, b) + '\nreturn CORE;')();
})();
const { candidates, norm, wordRe, CONTRACTIONS } = core;

/* ── options ── */
const opt = { lessons: '.', defs: 'dict-src/simple-defs.tsv', out: 'learner-dict', cmu: null, wordnet: null, 'wn-senses': 3, 'wn-extra': 0,
  core: 'dict-src/core-1000.txt,dict-src/core-2000.txt,dict-src/core-3000.txt,dict-src/core-4000.txt,dict-src/core-5000.txt,dict-src/core-6000.txt', variants: 'dict-src/spelling-variants.tsv', emoji: 'dict-src/emoji.tsv' };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2), v = process.argv[i + 1];
  if (!(k in opt)) { console.error('unknown option ' + a); process.exit(1); }
  opt[k] = /senses|extra/.test(k) ? Number(v) : v; i++;
}
const srcDir = path.dirname(opt.defs);

/* ══ 1. sources ═══════════════════════════════════════════════════════════ */
function readText(file) {
  const buf = fs.readFileSync(file);
  return (/\.gz$/.test(file) ? zlib.gunzipSync(buf) : buf).toString('utf8');
}

/* simple-defs.tsv → key → { display, senses:[], ipa, say } */
function readDefs(file) {
  const map = new Map();
  if (!file || !fs.existsSync(file)) { console.warn('no ' + file + ' — no simple definitions'); return map; }
  let cols = null;
  readText(file).split(/\r?\n/).forEach((line, n) => {
    if (!line.trim() || line.startsWith('#')) return;
    const cells = line.split('\t').map(s => s.trim());
    if (!cols) { cols = cells.map(c => c.toLowerCase()); return; }
    const row = {}; cols.forEach((c, i) => { row[c] = cells[i] || ''; });
    if (!row.word || !row.definition) return;
    const key = norm(row.word);
    const e = map.get(key) || { display: /[A-Z]/.test(row.word) ? row.word : null, senses: [], line: n + 1 };
    e.senses.push(clean({ pos: row.pos, level: row.level, def: row.definition, ex: row.example, es: row.es, src: 'house' }));
    if (row.ipa) e.ipa = row.ipa.replace(/^\/|\/$/g, '');
    if (row.say) e.say = row.say;
    map.set(key, e);
  });
  return map;
}
const clean = o => { Object.keys(o).forEach(k => { if (o[k] === '' || o[k] == null) delete o[k]; }); return o; };

/* cmudict.dict → word → ['HH AE1 P IY0', …] */
function readCmu(file) {
  const map = new Map();
  if (!file) { console.warn('no --cmu — pronunciations only from simple-defs.tsv / WordNet'); return map; }
  for (const line of readText(file).split('\n')) {
    if (!line || line.startsWith(';;;')) continue;
    const m = /^(\S+?)(?:\(\d+\))?\s+([A-Z][A-Z0-9 ]*?)\s*(?:#.*)?$/.exec(line.trim());
    if (!m) continue;
    const w = norm(m[1]);
    if (!map.has(w)) map.set(w, []);
    if (!map.get(w).includes(m[2])) map.get(w).push(m[2]);
  }
  return map;
}

/* Open English WordNet (GWN-LMF XML) → lemma → [{pos, synset}], synset → {def, ex}, lemma → ipa */
function readWordNet(file) {
  const wn = { lemmas: new Map(), synsets: new Map(), pron: new Map() };
  if (!file) { console.warn('no --wordnet — meanings only from simple-defs.tsv'); return wn; }
  const xml = readText(file);
  const ent = s => s.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] || String.fromCharCode(+e.slice(1))));
  const POS = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb', c: 'conjunction', p: 'preposition' };
  const reEntry = /<LexicalEntry\b[^>]*>([\s\S]*?)<\/LexicalEntry>/g;
  for (let m; (m = reEntry.exec(xml));) {
    const body = m[1];
    const lem = /<Lemma\b[^>]*writtenForm="([^"]*)"[^>]*partOfSpeech="([^"]*)"/.exec(body) || /<Lemma\b[^>]*partOfSpeech="([^"]*)"[^>]*writtenForm="([^"]*)"/.exec(body);
    if (!lem) continue;
    const [form, pos] = lem[0].indexOf('writtenForm') < lem[0].indexOf('partOfSpeech') ? [lem[1], lem[2]] : [lem[2], lem[1]];
    const key = norm(ent(form));
    const list = wn.lemmas.get(key) || [];
    const reSense = /<Sense\b[^>]*synset="([^"]*)"/g;
    for (let s; (s = reSense.exec(body));) list.push({ pos: POS[pos] || pos, synset: s[1], cap: /[A-Z]/.test(form) });
    wn.lemmas.set(key, list);
    const pr = /<Pronunciation\b([^>]*)>([^<]+)<\/Pronunciation>/g;
    for (let p; (p = pr.exec(body));) if (!wn.pron.has(key) || /US/.test(p[1])) wn.pron.set(key, ent(p[2]).replace(/^\/|\/$/g, ''));
  }
  const reSyn = /<Synset\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/Synset>/g;
  for (let m; (m = reSyn.exec(xml));) {
    const d = /<Definition\b[^>]*>([\s\S]*?)<\/Definition>/.exec(m[2]);
    const x = /<Example\b[^>]*>([\s\S]*?)<\/Example>/.exec(m[2]);
    if (d) wn.synsets.set(m[1], { def: ent(d[1]).trim(), ex: x ? ent(x[1]).trim().replace(/^"|"$/g, '') : '' });
  }
  console.log('WordNet: ' + wn.lemmas.size + ' lemmas, ' + wn.synsets.size + ' synsets');
  return wn;
}

/* ══ 2. CMU → IPA and "sounds like" ═══════════════════════════════════════ */
const IPA_V = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɜr', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u' };
const IPA_C = { B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
const ONSETS = new Set(('B CH D DH F G HH JH K L M N P R S SH T TH V W Y Z ZH|P R|P L|B R|B L|T R|D R|K R|K L|G R|G L|F R|F L|TH R|SH R|' +
  'S P|S T|S K|S M|S N|S L|S W|S F|T W|D W|K W|G W|TH W|P Y|B Y|F Y|M Y|K Y|V Y|HH Y|S P R|S P L|S T R|S K R|S K W|S P Y|S K Y')
  .split('|').flatMap((g, i) => (i === 0 ? g.split(' ') : [g])));

/* maximal onset: each consonant cluster between two vowels goes as far right as English allows */
function syllabify(arpa) {
  const ph = arpa.trim().split(/\s+/), sylls = [];
  let cons = [];
  ph.forEach(p => {
    if (!/\d$/.test(p)) { cons.push(p); return; }
    let k = 0;
    if (sylls.length) {
      for (k = 0; k < cons.length; k++) if (ONSETS.has(cons.slice(k).join(' '))) break;
      sylls[sylls.length - 1].coda.push(...cons.slice(0, k));
    }
    sylls.push({ onset: cons.slice(k), v: p.slice(0, -1), stress: +p.slice(-1), coda: [] });
    cons = [];
  });
  if (sylls.length) sylls[sylls.length - 1].coda.push(...cons);
  return sylls;
}
function toIpa(arpa) {
  const sy = syllabify(arpa);
  return sy.map(s => {
    let v = IPA_V[s.v] || '';
    if (s.stress === 0) v = { AH: 'ə', ER: 'ər' }[s.v] || v;
    const mark = sy.length > 1 && s.stress === 1 ? 'ˈ' : (sy.length > 1 && s.stress === 2 ? 'ˌ' : '');
    return mark + s.onset.map(c => IPA_C[c]).join('') + v + s.coda.map(c => IPA_C[c]).join('');
  }).join('');
}
/* Wikipedia-style respelling: HAP-ee, buh-NAN-uh, dik-shuh-nair-ee */
const SAY_C = { CH: 'ch', DH: 'dh', HH: 'h', JH: 'j', NG: 'ng', SH: 'sh', TH: 'th', ZH: 'zh', Y: 'y' };
function toSay(arpa) {
  const sy = syllabify(arpa);
  /* a short stressed vowel keeps the next consonant: HAP-ee, not HA-pee */
  sy.forEach((s, i) => {
    const nx = sy[i + 1];
    if (nx && s.stress > 0 && !s.coda.length && /^(AE|EH|IH|AH|UH)$/.test(s.v) && nx.onset.length) s.coda.push(nx.onset.shift());
  });
  return sy.map(s => {
    const open = !s.coda.length, cv = s.stress;
    const V = {
      AA: 'ah', AE: 'a', AH: cv ? 'u' : 'uh', AO: 'aw', AW: 'ow', AY: s.onset.length ? 'y' : 'eye', EH: open ? 'eh' : 'e',
      ER: cv ? 'ur' : 'er', EY: 'ay', IH: open ? 'ih' : 'i', IY: 'ee', OW: 'oh', OY: 'oy', UH: 'uu', UW: 'oo'
    }[s.v];
    const c = x => SAY_C[x] || x.toLowerCase();
    const t = s.onset.map(c).join('') + V + s.coda.map(c).join('');
    return sy.length > 1 && s.stress === 1 ? t.toUpperCase() : t;
  }).join('-');
}

/* ══ 3. the lessons ═══════════════════════════════════════════════════════ */
function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
}
/* the words a learner can see: page text, and the strings in scripts (content drawn by JS) */
function lessonText(html) {
  let out = '';
  html = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, js) => {
    js = js.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\\w])\/\/[^\n]*/g, '$1');
    const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    for (let s; (s = re.exec(js));) {
      const str = (s[1] || s[2] || s[3] || '').replace(/\\(.)/g, '$1').replace(/\$\{[^}]*\}/g, ' ');
      if (/[a-z]{2}/i.test(str)) out += '\n' + str.replace(/<[^>]+>/g, ' ');
    }
    return ' ';
  });
  return decode(out + '\n' + html.replace(/<[^>]+>/g, ' '));
}
function lessonFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.name.startsWith('.') || /^(node_modules|learner-dict|dict-src)$/.test(f.name)) continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p); else if (/\.html?$/i.test(f.name)) out.push(p);
    }
  })(dir);
  return out;
}

/* ══ 4. build ═════════════════════════════════════════════════════════════ */
if (require.main !== module) { module.exports = { toIpa, toSay, syllabify, lessonText }; return; }   /* required for its helpers only */
const defs = readDefs(opt.defs), cmu = readCmu(opt.cmu), wn = readWordNet(opt.wordnet);
/* a hand-written file in the CMU format (core-pron.dict) is not the CMU dictionary: credit it as the course's own */
const cmuIsHouse = !!opt.cmu && /^;;; Pronunciations of the 1000 core words/.test(readText(opt.cmu));
const hasMeaning = k => defs.has(k) || wn.lemmas.has(k);
const isPhrase = k => k.indexOf(' ') > 0 && hasMeaning(k);

const used = new Map();      /* key → { count, files:Set, a1:bool, ctx } */
const surfaces = new Map();  /* lower-case surface → { count, files:Set, caps, lower } */
const lessonGloss = new Map(); /* file → Set of keys in its lesson-dict */
const files = lessonFiles(opt.lessons);
const isA1A2 = f => /^(a1|a1a2|a2)_/i.test(path.basename(f));
const note = (key, file, ctx) => {
  const u = used.get(key) || { count: 0, files: new Set(), a1: false, ctx: '' };
  u.count++; u.files.add(path.basename(file)); if (isA1A2(file)) u.a1 = true;
  if (!u.ctx && ctx) u.ctx = ctx;
  used.set(key, u);
};

for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const gl = new Set();
  const j = /<script[^>]*id="lesson-dict"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (j) { try { Object.keys(JSON.parse(j[1])).forEach(k => gl.add(norm(k))); } catch (e) { console.warn(path.basename(f) + ': lesson-dict is not valid JSON'); } }
  lessonGloss.set(path.basename(f), gl);
  const text = lessonText(html);
  const toks = [];
  const re = wordRe();
  for (let m; (m = re.exec(text));) {
    if (/[a-z][A-Z]/.test(m[0]) || m[0].length > 30) { toks.push(null); continue; }   /* camelCase: code, not English */
    toks.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  }
  toks.forEach((t, i) => {
    if (!t) return;
    const lw = norm(t.w);
    const s = surfaces.get(lw) || { count: 0, files: new Set(), caps: 0 };
    s.count++; s.files.add(f);
    const before = text.slice(Math.max(0, t.start - 3), t.start);
    if (/[A-Z]/.test(t.w[0]) && /[a-z,;]\s+$/.test(before)) s.caps++;   /* capital in mid-sentence: a name? */
    surfaces.set(lw, s);
    /* the sentence it is in, as a hint for whoever writes the definition */
    const a = Math.max(text.lastIndexOf('\n', t.start), text.slice(0, t.start).search(/[.!?]\s[^.!?]*$/) + 1, 0);
    const b = text.slice(t.end).search(/[.!?\n]/);
    t.ctx = text.slice(a, b < 0 ? t.end + 80 : t.end + b + 1).replace(/\s+/g, ' ').trim().slice(0, 140);
    /* phrases of 2–4 words, the first word in any of its forms (got up → get up) */
    for (let n = 2; n <= 4; n++) {
      const run = toks.slice(i, i + n);
      if (run.length < n || run.some(x => !x)) break;
      if (run.slice(1).some((x, k) => !/^\s+$/.test(text.slice(run[k].end, x.start)))) break;
      const rest = run.slice(1).map(x => norm(x.w)).join(' ');
      for (const c of candidates(t.w).slice(0, 4)) {
        const key = c.key + ' ' + rest;
        if (isPhrase(key)) { note(key, f, t.ctx); break; }
      }
    }
    /* the word: every base form with a meaning (up to 3, as the page shows them), or itself for its sound */
    let found = 0;
    for (const c of candidates(t.w)) {
      if (c.key.indexOf(' ') < 0 && hasMeaning(c.key)) { note(c.key, f, t.ctx); if (++found >= 3) break; }
    }
    /* no meaning of its own (went, did, the): kept for its sound — the card shows it, then the base word */
    if (!hasMeaning(lw) && (cmu.has(lw) || CONTRACTIONS[lw])) note(lw, f, t.ctx);
  });
}
defs.forEach((d, k) => { if (!used.has(k)) used.set(k, { count: 0, files: new Set(), a1: false, ctx: '' }); });
/* the words inside a contraction, so its "short for" buttons find something */
[...used.keys()].filter(k => CONTRACTIONS[k]).forEach(k => CONTRACTIONS[k].split(/\s+|\//).forEach(w => {
  w = norm(w); if (w && !used.has(w) && (hasMeaning(w) || cmu.has(w))) used.set(w, { count: 0, files: new Set(), a1: false, ctx: '' });
}));

const POS_ORDER = { noun: 0, verb: 1, adjective: 2, adverb: 3 };
function wnSenses(key, n, capsName) {
  const out = [];
  for (const s of wn.lemmas.get(key) || []) {
    if (out.length >= n) break;
    if (s.cap && !capsName) continue;          /* "Ben" the mountain is not "ben" in a sentence */
    const syn = wn.synsets.get(s.synset);
    if (syn && !out.some(o => o.def === syn.def)) out.push(clean({ pos: s.pos, def: syn.def, ex: syn.ex, src: 'wn' }));
  }
  return out;
}
function pron(key) {
  const d = defs.get(key);
  if (d && d.ipa) return { ipa: [d.ipa], say: d.say ? [d.say] : [] };
  const words = key.split(' ');
  if (words.length > 1) {   /* a phrase: its words' sounds in a row */
    const parts = words.map(w => (cmu.get(w) || [])[0]);
    if (parts.every(Boolean)) return { ipa: [parts.map(toIpa).join(' ')], say: [parts.map(toSay).join(' ')] };
    return { ipa: [], say: [] };
  }
  const vs = (cmu.get(key) || []).slice(0, 3);
  if (vs.length) {
    const ipa = [], say = [];
    vs.forEach(v => { const i = toIpa(v); if (!ipa.includes(i)) { ipa.push(i); say.push(toSay(v)); } });
    return { ipa: ipa.slice(0, 2), say: say.slice(0, 2) };
  }
  if (wn.pron.has(key)) return { ipa: [wn.pron.get(key)], say: [] };
  return { ipa: [], say: [] };
}

const rank = new Map();
if (opt.core) opt.core.split(',').filter(f => fs.existsSync(f)).map(readText).join('\n').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).forEach((w, i) => { if (!rank.has(norm(w))) rank.set(norm(w), i + 1); });
const emoji = new Map();
if (opt.emoji && fs.existsSync(opt.emoji)) readText(opt.emoji).split(/\r?\n/).forEach(l => { if (!l.trim() || l.startsWith('#')) return; const [w, e] = l.split('\t'); if (w && e) emoji.set(norm(w), e.trim()); });
const variants = [];
if (opt.variants && fs.existsSync(opt.variants)) readText(opt.variants).split(/\r?\n/).forEach(l => {
  if (!l.trim() || l.startsWith('#')) return;
  const [uk, us] = l.split('\t').map(x => norm(x || ''));
  if (uk && us) variants.push([uk, us]);
});
const shards = {}, phrases = [];
let nHouse = 0, nWn = 0, nSound = 0;
for (const [key, u] of used) {
  const d = defs.get(key);
  let senses = d ? d.senses.slice() : [];
  if (senses.length) { nHouse++; if (opt['wn-extra']) senses = senses.concat(wnSenses(key, opt['wn-extra'])); }
  else if (opt['wn-senses']) { senses = wnSenses(key, opt['wn-senses'], d && d.display); if (senses.length) nWn++; }
  const p = pron(key);
  if (!senses.length && !p.ipa.length && !CONTRACTIONS[key]) continue;
  if (!senses.length) nSound++;
  const e = clean({ display: d && d.display, rank: rank.get(key), emoji: emoji.get(key), psrc: p.ipa.length && cmuIsHouse && !(d && d.ipa) ? 'house' : null, ipa: p.ipa.length ? p.ipa : null, say: p.say.length ? p.say : null, short: CONTRACTIONS[key], senses: senses.length ? senses : null });
  const shard = /[a-z]/.test(key[0]) ? key[0] : '_';
  (shards[shard] = shards[shard] || {})[key] = e;
  if (key.indexOf(' ') > 0) phrases.push(key);
}

/* British and American spellings: the course uses American spelling, so the American form is the
   headword. The entry is also filed under the British form (with us: the American key, so a saved
   "colour" is saved as "color"), and the card says "British spelling: colour". */
const shardKey = k => (/[a-z]/.test(k[0]) ? k[0] : '_');
const getE = k => (shards[shardKey(k)] || {})[k];
const put = (k, e) => { (shards[shardKey(k)] = shards[shardKey(k)] || {})[k] = e; };
for (const [uk, us] of variants) {
  const a = getE(uk), b = getE(us);
  if (!a && !b) continue;
  const base = Object.assign({}, a || {}, b || {});
  if (!(b && b.senses) && a && a.senses) base.senses = a.senses;
  if (!(b && b.ipa) && a && a.ipa) { base.ipa = a.ipa; base.say = a.say; }
  const r = [a && a.rank, b && b.rank].filter(Boolean);
  base.rank = r.length ? Math.min.apply(null, r) : undefined;
  base.emoji = (b && b.emoji) || (a && a.emoji);
  base.variant = 'British: ' + uk;
  delete base.us;
  put(us, clean(base));
  put(uk, clean(Object.assign({}, base, { display: base.display || us, us })));
}

fs.mkdirSync(opt.out, { recursive: true });
let bytes = 0;
for (const s of Object.keys(shards).sort()) {
  const body = JSON.stringify(shards[s]);
  fs.writeFileSync(path.join(opt.out, s + '.json'), body); bytes += body.length;
}
fs.writeFileSync(path.join(opt.out, '_phrases.json'), JSON.stringify(phrases.sort()));
fs.writeFileSync(path.join(opt.out, '_meta.json'), JSON.stringify({
  built: new Date().toISOString(),
  sources: {
    house: 'Simple definitions written for this course (dict-src/simple-defs.tsv)',
    cmu: !opt.cmu ? null : cmuIsHouse ? 'Pronunciations written for this course in the CMU ARPAbet format (' + path.basename(opt.cmu) + ')' : 'CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University. BSD 2-clause licence.',
    wn: opt.wordnet ? 'Open English WordNet (https://en-word.net/), CC BY 4.0. Definitions used unchanged.' : null
  },
  core: opt.core && rank.size ? 'New General Service List 1.2 and its sister lists NGSL-Spoken, TSL, BSL, NGSL-Graded Reader and the New Dolch List (Browne, Culligan & Phillips), CC BY-SA 4.0: rank field' : null,
  counts: { entries: nHouse + nWn + nSound, simple: nHouse, wordnet: nWn, soundOnly: nSound, phrases: phrases.length, lessons: files.length }
}, null, 1));


/* ══ 4b. practice data for My Words: learner-dict/practice/words.json ═════════
   Only My Words loads it (HouseListen, HouseMystery and HouseSort rounds), so the lookup stays small.
   w: key → [pos, level, syllables, stressed syllable (0 = first), sounds-alike words or 0, display?]
     pos: one letter for each part of speech the word has, first meaning first ('nv' = noun and verb):
          n noun · v verb · a adjective · r adverb · p phrase · o other      level: 1 A1 … 5 C1
   Sounds-alike: same number of sounds, one sound different (ship / sheep), headwords with a meaning only.
   A vowel change in a weak syllable is left out: a browser voice can't make it heard. Contrasts that are
   hard for Spanish speakers come first, then the commoner word. */
(function practice() {
  const POSC = { noun: 'n', verb: 'v', 'modal verb': 'v', 'phrasal verb': 'v', adjective: 'a', adverb: 'r', phrase: 'p' };
  const LV = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 5 };
  const HARD = new Set(['IY IH', 'AE EH', 'AE AH', 'AA AH', 'UW UH', 'IH EH', 'AE AA', 'B V', 'SH CH', 'CH JH', 'Y JH', 'S Z', 'TH T', 'TH S', 'DH D', 'M N', 'S SH', 'R L', 'ER AA', 'OW AO']
    .flatMap(p => [p, p.split(' ').reverse().join(' ')]));
  const out = {}, phon = new Map();
  for (const s of Object.keys(shards)) for (const [k, e] of Object.entries(shards[s])) {
    if (!e.senses || e.us || e.short) continue;
    const sn = e.senses[0], arpa = k.indexOf(' ') < 0 && (cmu.get(k) || [])[0];
    let syl = 0, st = 0;
    if (arpa) {
      const sy = syllabify(arpa); syl = sy.length;
      st = Math.max(0, sy.findIndex(x => x.stress === 1));
      phon.set(k, arpa.split(/\s+/));
    }
    const pos = [...new Set(e.senses.map(x => POSC[x.pos] || 'o'))].join('');
    out[k] = [pos, LV[String(sn.level).slice(0, 2)] || 3, syl, st, 0];
    if (e.display && e.display !== k) out[k][5] = e.display;
  }
  const buckets = new Map();
  for (const [k, ph] of phon) ph.forEach((_, i) => {
    const b = ph.map((p, j) => (j === i ? '*' : p.replace(/\d/, ''))).join(' ');
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push([k, i]);
  });
  const near = new Map();
  for (const ws of buckets.values()) {
    if (ws.length < 2) continue;
    for (const [a, i] of ws) for (const [b] of ws) {
      if (a === b) continue;
      const pa = phon.get(a)[i], pb = phon.get(b)[i];
      if (pa.replace(/\d/, '') === pb.replace(/\d/, '')) continue;            /* stress only */
      if (/0$/.test(pa) && /0$/.test(pb)) continue;                           /* weak vowels */
      const pair = pa.replace(/\d/, '') + ' ' + pb.replace(/\d/, '');
      if (!near.has(a)) near.set(a, new Map());
      near.get(a).set(b, HARD.has(pair) ? 0 : 1);
    }
  }
  let nNear = 0;
  for (const [a, m] of near) {
    const list = [...m].sort((x, y) => x[1] - y[1] || (rank.get(x[0]) || 1e5) - (rank.get(y[0]) || 1e5)).slice(0, 4).map(x => x[0]);
    if (out[a]) { out[a][4] = list; nNear++; }
  }
  const dir = path.join(opt.out, 'practice');
  fs.mkdirSync(dir, { recursive: true });
  const body = JSON.stringify({ v: 1, w: out });
  fs.writeFileSync(path.join(dir, 'words.json'), body);
  console.log('practice/words.json: ' + Object.keys(out).length + ' words, ' + nNear + ' with sounds-alike words, ' + Math.round(body.length / 1024) + ' KB');
})();

/* ══ 5. report: what to write next, and what to check ═════════════════════ */
const FUNCTION = new Set(('a an the and or but if so because to of in on at for with from by about as into than then that this these those there here ' +
  'what who whom whose which where when why how not no yes do does did be is am are was were been being have has had will would can could ' +
  'shall should may might must i you he she it we they me him her us them my your his its our their mine yours ours theirs one some any all ' +
  'every each many much more most few little other another very too also just only up down out off over under again something someone thing ' +
  'things people person use used make makes way kind part etc').split(' '));
const vocab = new Set(FUNCTION);
for (const [k, u] of used) if (u.a1) vocab.add(k);
const vocabFile = path.join(srcDir, 'defining-vocab.txt');
if (fs.existsSync(vocabFile)) readText(vocabFile).split(/\s+/).forEach(w => w && vocab.add(norm(w)));
const knownWord = w => candidates(w).slice(0, 5).some(c => vocab.has(c.key)) || /^\d/.test(w);

const hard = [];
defs.forEach((d, k) => d.senses.forEach(s => {
  const re = wordRe(), bad = [];
  for (let m; (m = re.exec(s.def));) if (!knownWord(m[0]) && norm(m[0]) !== k && !bad.includes(m[0])) bad.push(m[0]);
  if (bad.length) hard.push(`| ${d.display || k} | ${s.def} | ${bad.join(', ')} |`);
}));

const todo = [...used].filter(([k, u]) => u.files.size && !defs.has(k) && !FUNCTION.has(k) && !CONTRACTIONS[k] && hasMeaning(k))
  .filter(([k]) => { const s = surfaces.get(k); return !(s && s.caps > s.count / 2); })   /* mostly capitalised mid-sentence: a name */
  .sort((a, b) => b[1].files.size - a[1].files.size || b[1].count - a[1].count);
const tsv = ['word\tpos\tlevel\tdefinition\texample\tes\tlessons\tseen in\twordnet hint'];
todo.forEach(([k, u]) => {
  const w = wnSenses(k, 1, true)[0] || {};
  const lvl = [...u.files].map(f => (f.match(/^(a1a2|a2b1|b1b2|b2c1|c1c2|a1|a2|b1|b2|c1|c2)_/i) || [])[1]).filter(Boolean).sort()[0] || '';
  tsv.push([k, w.pos || '', lvl.toUpperCase(), '', '', '', u.files.size, u.ctx.replace(/\t/g, ' '), (w.def || '').replace(/\t/g, ' ')].join('\t'));
});
fs.mkdirSync(srcDir, { recursive: true });
fs.writeFileSync(path.join(srcDir, 'todo-defs.tsv'), tsv.join('\n') + '\n');

const ambiguous = [];
for (const [k, u] of used) {
  const d = defs.get(k);
  if (!d || d.senses.length < 2) continue;
  const missing = [...u.files].filter(f => !(lessonGloss.get(f) || new Set()).has(k));
  if (missing.length) ambiguous.push(`| ${d.display || k} | ${d.senses.length} | ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''} |`);
}

const report = [
  '# Learner dictionary — build report', '',
  `Built ${new Date().toISOString().slice(0, 16).replace('T', ' ')} from ${files.length} lesson files.`, '',
  `- **${nHouse}** words with a simple definition (simple-defs.tsv)`,
  `- **${nWn}** words with WordNet meanings only (harder English) — the ones to replace first are in \`todo-defs.tsv\``,
  `- **${nSound}** words with a pronunciation only (function words, names)`,
  `- **${phrases.length}** phrases`,
  `- ${Math.round(bytes / 1024)} KB of data in ${Object.keys(shards).length} files`, '',
  '## Next simple definitions to write', '',
  `\`todo-defs.tsv\` lists ${todo.length} lesson words without a simple definition, most-used first. Fill in the definition column (and example, es), paste the rows into simple-defs.tsv, run the build again.`, '',
  todo.slice(0, 30).map(([k, u]) => `\`${k}\` (${u.files.size})`).join(' · '), '',
  '## Words with more than one meaning in lessons with no lesson-dict entry for them', '',
  'The card will show the first meaning. If a lesson uses another one, add it to that page:  `"bank": { "use": 2 }`', '',
  ambiguous.length ? '| word | meanings | lessons |\n|---|---|---|\n' + ambiguous.join('\n') : '_none_', '',
  '## Definitions that use words no A1–A2 lesson has', '',
  'These may be too hard for the learners who need them. Add a word to `dict-src/defining-vocab.txt` to accept it.', '',
  hard.length ? '| word | definition | words to check |\n|---|---|---|\n' + hard.join('\n') : '_none_', ''
].join('\n');
fs.writeFileSync(path.join(srcDir, 'report.md'), report);

console.log(`learner-dict: ${nHouse} simple, ${nWn} WordNet, ${nSound} sound only, ${phrases.length} phrases, ${Math.round(bytes / 1024)} KB` +
  ` · ${todo.length} words to define (dict-src/todo-defs.tsv) · ${hard.length} hard definitions · ${ambiguous.length} ambiguous`);
