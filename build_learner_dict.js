/* ═══════════════════════════════════════════════════════════════════════════
   build_learner_dict.js — makes learner-dict/ for house-dict.js.
   Node 18+, no packages. Run it in the repo folder (next to house-dict.js):

     node build_learner_dict.js --cmu cmudict.dict --wordnet english-wordnet-2025.xml.gz

   Options
     --lessons DIR     the lesson .html files to read                   (default .)
     --defs FILE       simple definitions written for this library      (default dict-src/simple-defs.tsv)
     --cmu FILE        CMU Pronouncing Dictionary, cmudict.dict         https://github.com/cmusphinx/cmudict  (BSD-2)
     --wordnet FILE    Open English WordNet, GWN-LMF .xml or .xml.gz    https://en-word.net/  (CC BY 4.0)
     --out DIR         where the data goes                              (default learner-dict)
     --wn-senses N     WordNet meanings for a word with no simple one   (default 3, 0 = never use WordNet)
     --wn-extra N      WordNet meanings added under a simple one        (default 0)

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
const core = require(path.join(__dirname, 'house-dict.js'));
const { candidates, norm, wordRe, CONTRACTIONS } = core;

/* ── options ── */
const opt = { lessons: '.', defs: 'dict-src/simple-defs.tsv', out: 'learner-dict', cmu: null, wordnet: null, 'wn-senses': 3, 'wn-extra': 0 };
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
  const e = clean({ display: d && d.display, ipa: p.ipa.length ? p.ipa : null, say: p.say.length ? p.say : null, short: CONTRACTIONS[key], senses: senses.length ? senses : null });
  const shard = /[a-z]/.test(key[0]) ? key[0] : '_';
  (shards[shard] = shards[shard] || {})[key] = e;
  if (key.indexOf(' ') > 0) phrases.push(key);
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
    cmu: opt.cmu ? 'CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University. BSD 2-clause licence.' : null,
    wn: opt.wordnet ? 'Open English WordNet (https://en-word.net/), CC BY 4.0. Definitions used unchanged.' : null
  },
  counts: { entries: nHouse + nWn + nSound, simple: nHouse, wordnet: nWn, soundOnly: nSound, phrases: phrases.length, lessons: files.length }
}, null, 1));

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
