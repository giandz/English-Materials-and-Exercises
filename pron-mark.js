/* ═══════════════════════════════════════════════════════════════════════════
   PronMark — word stress and intonation marks over English text, for intro
   conversations, matching cards and any other activity. Needs house-character.js
   loaded first (it reads the text with the lip-sync tokenizer).

     PronMark.mark(target, opts)   target: an element, a selector or a list of elements.
                                   The element keeps its own HTML (grammar colours, emoji …):
                                   the marks are added around its letters.
     PronMark.unmark(target)       puts the element back as it was
     PronMark.toggle({shown})      the "🎵 Show pronunciation marks" button (hidden by default, like the stick figures), with a colour
                                   selector for stress, connected speech and intonation (colours:false leaves the selectors out)
     PronMark.colours({stress, connected, intonation})   the same colours from code, for the whole page
     PronMark.dict({word:'ho-TEL'}) add or correct words: split as spelled, the stressed syllable in capitals,
                                   + before a secondary stress: '+in-tro-DUCE'; {word:null} takes a correction back
     PronMark.colourControls()     the stress, connected speech and intonation colour selectors as an element, to place anywhere
     PronMark.useDict(data)        the pronouncing dictionary; pron-dict.js calls this. Without it the rules and the word list below do the work
     PronMark.analyse(text, opts)  → {words, tunes}: what would be drawn, without touching the page
     PronMark.syllables(word)      → [{from, to, stress}] for checking the rules

   opts
     statements:true     falling arrows on statements too (by default only questions get an arrow)
     tune:'rise'|'fall'|'none'     forces the arrow of every sentence in this element
     main:'are'          this word carries the main stress
     connected:false     no connected speech marks
     labels:'ipa'        IPA under the arcs (tʃ, dʒ, ʃ, ʒ, /j/, ŋ, ɾ) instead of plain letters (ch, j, sh, zh, /y/, ng, d)
     colours:{stress, connected, intonation}   colours for this element only
   On the page
     <span data-pm-main>word</span>   this word carries the main stress of its phrase (contrast: "And YOU?")
     data-pm-tune="rise" on the element    the same as opts.tune, for one element

   What is drawn
     · Under the gaps between words, connected speech: arrows for catenation, arcs for the rest (see the connected speech section).
     · A circle over the vowel or diphthong of every syllable, centred on its letters, all sitting on one line:
         main stress of the phrase = one stick-figure head across · stressed syllable · secondary stress · weak syllable
     · A curved arrow from the main stress to the end of the sentence: it curves up on a yes/no question, down on a
       wh-question. An or-question rises on each option and falls on the last; a tag falls.
     · Same marker as the stick figures (stick-character.js): one head = 0.72em, line width a quarter of a head,
       round ends, no fill, and the arrow's head has the same legs (1.5 heads across, 0.95 heads long).
       Every line drawn, over and under the words, has that one width.

   Where the reading comes from (house-character.js)
     HouseCharacter.speech          the words and where they are in the text; numbers and spelled letters (C-A-T-E)
     HouseCharacter.speech.visemes  how many vowels the word really says (every → 2, business → 2, people's silent e)
     HouseCharacter.prosody         the type of each sentence and the main stress of each phrase
   Spelling only goes so far, so the stress of a word comes from the CMU dictionary (pron-dict.js) if that is loaded, then from the short word
   list below when the word is on it, and from suffix rules (-tion, -teen, -ese, -ity …) when it is not. English only.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const HC = window.HouseCharacter;

/* ── the marker: the same numbers as stick-character.js and stick-sentence.js ── */
const H = 40, S = H / 4, EM = 0.72 / H;              /* one head = 40 units = 0.72em; line = a quarter of a head */
const DIAM = { 3:H, 2:0.78*H, 1:0.6*H, 0:0.375*H };  /* outside width at each stress level. The weak one is narrower than two line widths, so it is a solid dot, like the stick figures' dots */
const ROW = 0.42;                                    /* the middle of the biggest circle, in em above the top of the letters' box; all circles sit on the same bottom line */
const LINK_BELOW = 0.4;   /* how far a catenation arrow's curve dips below the legs of its head, in em */
const UNDER = 0.85, UNDER_LINK = 1.15, UNDER_LABEL = 1.8;                                  /* the room under the line for connected speech marks, in em */
const ARROW = { w:0.75*H - S/2, len:0.95*H - S/2, band:1.9*H };   /* legs as in arrowAt(); band = how far the curve climbs */

/* ── words the rules would get wrong ── */
const WORDS = Object.create(null);   /* no inherited names: "constructor" is a word too */
const USER = new Set();   /* words corrected by hand: they come before everything else */
/* the pronouncing dictionary (pron-dict.js, optional): word → stress of each syllable, '010' = weak, MAIN, weak; 2 = secondary */
const DICT = new Map();
function useDict(data){ if (!data) { DICT.clear(); return; } for (const p in data) for (const w of data[p].split(' ')) if (w) DICT.set(w, p); }
let BASE = null;   /* the built-in list, so a correction can be taken back */
function dict(map){
  for (const k in map) {
    const key = k.toLowerCase();
    if (map[k] == null) { USER.delete(key); if (BASE && key in BASE) WORDS[key] = BASE[key]; else delete WORDS[key]; }
    else { WORDS[key] = map[k]; USER.add(key); }
  }
  return WORDS;
}
(`hel-LO good-BYE ex-CUSE to-DAY to-MOR-row to-NIGHT a-GAIN a-BOUT be-CAUSE be-TWEEN a-LONE be-LONG be-FORE a-ROUND a-WAY
  a-GREE a-CROSS a-LIKE a-RRIVE be-COME be-GIN be-HIND be-LOW be-SIDE un-TIL re-PEAT re-TURN re-PLY re-MEM-ber de-CIDE
  in-tro-DUCE EVE-ning JAN-u-ar-y FEB-ru-ar-y AU-gust sep-TEM-ber oc-TO-ber no-VEM-ber de-CEM-ber
  AL-ways AL-so AL-most WEL-come THANK-you MEET-ing EV-ery EV-ery-one EV-ery-thing DIF-ferent BUSI-ness INter-est-ing FA-vor-ite RES-tau-rant
  CHOCO-late VEG-e-ta-ble FAM-i-ly MOTH-er FA-ther BROTH-er SIS-ter HUS-band DAUGH-ter PAR-ents CHIL-dren BA-by MAR-ried SIN-gle
  AD-dress E-mail PHO-to NUM-ber AN-swer QUES-tion PEO-ple WOM-an WOM-en MON-ey LIT-tle LIS-ten OF-ten O-pen
  o-KAY O-K re-AL-ly RE-al-ly i-DE-a A-re-a QUI-et SCI-ence SCI-en-tist CAM-er-a pi-AN-o RA-di-o VID-e-o
  SEV-en e-LEV-en ZE-ro HUN-dred THOU-sand MIL-lion
  TEACH-er STU-dent DOC-tor en-gi-NEER AC-tor AC-tress WAIT-er WAIT-ress DRIV-er po-LICE ac-COUNT-ant MAN-ag-er SEC-re-tar-y
  LAW-yer DEN-tist AR-chi-tect re-CEP-tion-ist PRO-gram-mer de-SIGN-er mu-SI-cian gui-TAR com-PU-ter OF-fice HOS-pi-tal ho-TEL
  a-MER-i-ca CAN-a-da MEX-i-co bra-ZIL ja-PAN CHI-na vi-et-NAM GER-ma-ny IT-a-ly E-gypt ko-RE-a RUS-sia i-RAN PO-land
  co-LOM-bi-a ven-e-ZUE-la ar-gen-TI-na pe-RU EC-u-a-dor CHI-le CU-ba POR-tu-gal ENG-land aus-TRA-lia IN-di-a TUR-key THAI-land
  do-MIN-i-can PAN-a-ma hon-DU-ras gua-te-MA-la bo-LIV-i-a ni-ca-RA-gua
  a-MER-i-can ca-NA-di-an MEX-i-can bra-ZIL-ian jap-a-NESE chi-NESE vi-et-na-MESE i-TAL-ian GER-man ko-RE-an RUS-sian
  SPAN-ish ENG-lish BRIT-ish co-LOM-bi-an ven-e-ZUE-lan ar-gen-TIN-i-an pe-RU-vi-an
  a-BAN-don dis-COV-er ex-PEN-sive im-POR-tant com-PU-ter ba-NA-na to-MA-to po-TA-to de-VEL-op con-SID-er re-MEM-ber de-LIV-er re-COV-er
  con-TIN-ue de-TER-mine ex-AM-ine ex-AM-ple i-MAG-ine en-JOY pre-FER a-GREE a-NOTH-er to-GETH-er al-READ-y a-WAKE a-LIVE a-FRAID a-SLEEP a-MAZE a-PART a-PART-ment
  ap-POINT ap-POINT-ment ap-PEAR ap-PLY ap-PROACH ac-CEPT ac-CENT ac-CESS ac-CORD-ing ac-COUNT ac-TIV-i-ty ad-VEN-ture ad-VICE ad-VISE af-FORD a-GAINST at-TACK at-TEMPT at-TEND at-TRACT
  as-SIST-ant as-SUME at-TEN-tion a-WARD a-WARE be-HAVE be-LIEVE be-LONG-ing com-PLETE com-PLAIN com-PARE com-PET-i-tor con-FIRM con-FUSE con-NECT con-TAIN con-TROL con-VINCE
  de-PEND de-SCRIBE de-SIGN de-SIRE de-STROY de-TAIL de-LI-cious dis-CUSS dis-TURB dis-AP-pear +dis-a-GREE e-NOUGH es-CAPE ex-ACT ex-ACT-ly ex-CEPT ex-CHANGE ex-CITE ex-CIT-ing ex-IST ex-PECT ex-PLAIN ex-PRESS
  for-GET for-GIVE in-CLUDE in-DEED in-STEAD in-VITE in-VOLVE in-SIDE out-SIDE o-BEY of-FEND of-FICIAL per-FORM per-HAPS per-MIT pre-PARE pre-TEND pro-DUCE pro-TECT pro-VIDE pur-SUE re-CEIVE
  re-DUCE re-FUSE re-LAX re-MAIN re-MIND re-MOVE re-PLACE re-QUIRE re-SERVE re-SPECT re-SPOND re-SULT sug-GEST sup-PORT sup-POSE sur-PRISE sur-VIVE un-TIL with-OUT with-IN be-TWEEN mis-TAKE
  ho-RI-zon um-BREL-la ba-NAN-a pa-ja-mas va-CA-tion mu-SE-um gym-NAS-tics di-REC-tion di-RECT-or de-LI-cious fan-TAS-tic ter-RIF-ic dis-AS-ter e-LEC-tric e-QUIP-ment e-VENT e-LEV-en e-MER-gen-cy en-VI-ron-ment ex-PE-ri-ence ex-PER-i-ment
  im-POS-si-ble im-PROVE im-MEDI-ate-ly in-CRED-i-ble in-TEL-li-gent o-RIG-i-nal pre-PARE po-TEN-tial pro-FES-sor re-MARK-a-ble re-SPON-si-ble suc-CESS suc-CESS-ful to-GETH-er tra-DI-tion-al
  be-GIN-ner cre-ATE cre-A-tive a-TTRAC-tive de-CI-sion u-NIQUE ma-CHINE ca-REER ga-RAGE ga-ZELLE ho-TEL gi-RAFFE gui-TAR bal-LOON bam-BOO be-NEATH be-YOND ad-MIRE ad-MIT de-LAY de-BATE de-CREASE
  AC-ci-dent AC-tive AD-jec-tive AL-co-hol AL-pha-bet AM-bu-lance AN-i-mal AN-y-thing AN-y-one AN-y AR-ti-cle AT-mos-phere AV-e-nue AV-er-age CAL-en-dar CAP-i-tal CAR-pen-ter CHAR-ac-ter COM-fort-a-ble COM-pa-ny COM-pli-ment CON-cen-trate CON-fi-dent CON-ti-nent COUN-try CUS-tom-er DAN-ger-ous DEC-o-rate DEL-i-cate DEM-on-strate DIF-fi-cult DOC-u-ment ED-u-cate EL-e-phant EL-e-ment EN-er-gy EN-e-my EN-gine EN-ter EN-ve-lope EM-pe-ror EX-cel-lent EX-er-cise GOV-ern-ment GOV-ern HAM-bur-ger HOL-i-day IM-age IN-come IN-dus-try IN-sect IN-stru-ment IN-ter-net IM-mi-grant IN-no-cent MAR-ket MES-sen-ger MOD-ern NAT-u-ral NEG-a-tive OF-fice OF-fi-cer OP-po-site PAS-sen-ger PER-son PER-fect PER-son-al POL-i-tics POS-i-tive PRES-i-dent PROB-lem PROD-uct PRO-gram PROM-ise REC-i-pe REG-u-lar REL-a-tive RES-i-dent SAND-wich SAT-ur-day SEV-er-al SUN-day TEL-e-phone TEL-e-vi-sion TOUR-na-ment WON-der-ful YES-ter-day
  dis-COV-er-y de-LIV-er-y re-COV-er-y for-GOT-ten e-RAS-er how-EV-er what-EV-er when-EV-er where-EV-er col-LECT cor-RECT suc-CEED BEAU-ti-ful IN-ter-est CIN-e-ma CAM-er-a ge-OG-ra-phy
  RE-a-lize im-ME-di-ate-ly
  +af-ter-NOON +un-der-STAND +in-tro-DUCE +re-com-MEND +en-ter-TAIN +vol-un-TEER +en-gi-NEER +un-der-NEATH
    ma-RI-a AN-a CAR-los GA-bri-el lu-IS mi-GUEL JES-si-ca mi-CHELLE LU-cia ju-AN PE-dro DA-vid MI-chael so-PHI-a EM-i-ly o-LIV-i-a DAN-iel ROB-ert JEN-ni-fer an-TO-ni-o ve-ge-TA-ri-an a-PPA-rent-ly SKATE-board`)
  .split(/\s+/).forEach(s => { const k = s.replace(/[-+]/g,'').toLowerCase(); WORDS[k] = s; });
BASE = Object.assign(Object.create(null), WORDS);

/* weak words, as HouseCharacter.prosody has them */
const WEAK = new Set(`a an the some any this that these those my your his her its our their me you him us them i he she it we they
  mine yours hers ours theirs myself yourself am is are was were be been being do does did have has had will would shall
  should can could may might must i'm you're he's she's it's we're they're i've you've we've they've i'll you'll he'll
  she'll we'll they'll i'd you'd he'd she'd we'd they'd that's there's let's to of in on at by for from with about as
  into onto over under up down out off than then and or but so if because when while though although nor yet there here`.split(/\s+/));
const WH = /^(what|which|who|whom|whose|where|when|why|how)$/;
const LEAD_IN = /^(oh|so|and|but|well|um|okay|ok|now|hey)$/;
const NT_SYLLABLE = /^(is|does|did|was|has|have|had|could|would|should|were|must|need)$/;   /* isn't, doesn't: n't is a syllable; don't, can't: it is not */

/* ── spelling → the letters of each vowel ─────────────────────────────── */
const plain = ch => ch.normalize('NFD').charAt(0).toLowerCase();
const isV = ch => !!ch && 'aeiou'.includes(ch);
const HIATUS = /^(ia|io|iu|eo|ua|uo|ya|yo)$/;

/* each vowel or diphthong as letters [from, to) in w (already plain, the same length as the word) */
function vowelRuns(w){
  const runs = []; let i = 0;
  const glide = k => {   /* y and w that belong to the vowel before them, or y that is a vowel itself */
    const c = w[k], nx = w[k+1] || '', pv = w[k-1] || '';
    if (c === 'y') return k > 0 && !isV(nx);
    if (c === 'w') return 'aeo'.includes(pv) && !isV(nx) && k > 0;
    return false;
  };
  while (i < w.length) {
    const c = w[i], pv = w[i-1] || '', nx = w[i+1] || '';
    if (c === 'u' && (pv === 'q' || (pv === 'g' && isV(nx)))) { i++; continue; }   /* quiet, guitar: u is not a vowel here */
    if (!isV(c) && !glide(i)) { i++; continue; }
    let j = i + 1;
    while (j < w.length && (isV(w[j]) || glide(j))) j++;
    runs.push([i, j]); i = j;
  }
  return runs;
}
/* split the runs that are two syllables: radio, Maria, doing */
function splitHiatus(w, runs){
  const out = [];
  for (const [a, b] of runs) {
    const t = w.slice(a, b), before = w[a-1] || '';
    if (t.length === 2 && HIATUS.test(t) && !/[tscg]/.test(before)) { out.push([a, a+1], [a+1, b]); continue; }
    if (t.length > 1 && t.endsWith('i') && w.slice(b, b+2) === 'ng' && b + 2 === w.length) { out.push([a, b-1], [b-1, b]); continue; }   /* doing, seeing */
    out.push([a, b]);
  }
  return out;
}
/* silent e: name, lives, worked, lovely. Consonant + le stays as a syllable of its own: people, tables */
function dropSilent(w, runs){
  const last = runs[runs.length-1];
  let out = runs.slice();
  if (runs.length > 1 && last[1] - last[0] === 1 && w[last[0]] === 'e') {
    const end = w.slice(last[1]), pv = w.slice(0, last[0]);
    if (end === '' || end === 's') {
      if (/[^aeiouyrwl]l$/.test(pv)) { out[out.length-1] = [last[0]-1, last[1]]; out[out.length-1].syllabic = true; }
      else if (end === '' || !/(s|x|z|ch|sh|c|g)$/.test(pv)) out.pop();
    } else if (end === 'd' && !/[td]$/.test(pv)) out.pop();
  }
  /* an e kept silent before a suffix: lovely, careful, nicely */
  const m = w.match(/[^aeiou]e(ly|ful|less|ment|ness|ty|teen)$/);
  if (m && out.length > 2) { const at = w.length - m[1].length - 1; out = out.filter(r => !(r[0] === at && r[1] === at + 1)); }
  return out;
}
/* how many vowels the tokenizer says: ai + e and o + e are one diphthong. It reads er, ir, ur and -ture as consonants, so the caller adds those */
function spokenVowels(word){
  let vis = []; try { vis = HC.speech.visemes(word) || []; } catch (e) { /* "constructor" trips the tokenizer's word table */ }
  const m = vis.filter(x => 'ai e o u'.split(' ').includes(x) || x === 'cdg' || x === 'mbp' || x === 'fv' || x === 'l' || x === 'wq');
  let n = 0, prev = '';
  for (const x of m) {
    const v = ['ai','e','o','u'].includes(x);
    if (v && !(['ai','o'].includes(prev) && x === 'e')) n++;
    prev = v ? x : '';
  }
  return n;
}
/* how many syllables the rules find in a stem */
function countSyl(w){ const r = dropSilent(w, splitHiatus(w, vowelRuns(w))); return r.length; }
const firstCap = e => { const k = e.split('-').findIndex(x => /[A-Z]/.test(x.replace(/^\+/, ''))); return k < 0 ? 0 : k; };
/* endings that leave the stress where the shorter word has it: abandon-ed, discover-ing, apart-ment, comfort-able */
const NEUTRAL = ['ings','ing','ers','ed','es','ly','ment','ments','ness','ful','less','ship','able','er','s'];
/* prefixes the stress usually falls after */
const PREFIX = /^(be|de|dis|ex|en|em|re|con|com|pre|pro|un|mis|im|in|ad|ob|sub|per|sur|ac|af|ag|ap|ar|as|at|es|oc|of|op|su)/;
const AFTER_A = /^a[bcdfgklmnpqrstvwz][aeiouy]/;      /* a-bandon, a-mazing, a-part: one consonant after the a */
/* these endings keep the stress early even after a prefix: DEC-orate, REC-ognize, CON-fident, DAN-gerous */
const EARLY = /(ate|ize|ise|yse|fy|ous|ency|ence|ent|ary|ory|ery|ony|ogy|graph|ogue|ure|ude|ute|cy|ty|ry|ly|my|ny|gy|al|le|ic|ics)$/;
const LONG_END = /(?:[aeiouy][bcdfgklmnpqrstvz]e|ai[a-z]+|ea[a-z]+|ee[a-z]*|ie[a-z]+|oa[a-z]+|oo[a-z]+|ou[a-z]+|ei[a-z]+|au[a-z]+|igh[a-z]*)$/;
const SHORT_E = /(age|ive|ice|ile|ate|ure|ine|ace)$/;  /* image, active, office, mobile: these stay on the first syllable */
function stressIndex(w, n, runs, raw){
  if (n < 2) return 0;
  /* a written accent says it: José, María */
  if (runs) for (let i = 0; i < n; i++) if (/[́]/.test(raw.slice(runs[i][0], runs[i][1]).normalize('NFD'))) return i;
  if (/(teen|ese|eer|oon|ette|ique|esque)$/.test(w)) return n - 1;
  if (/(ity|ical|ology|ography|ometer|ify|iety|ically)$/.test(w)) return Math.max(0, n - 3);
  if (/(tion|sion|cian|ic|ics|ian|ia|ial|ual|ious|ient|iant|ience|iance)$/.test(w)) return Math.max(0, n - 2);
  /* an ending adds nothing to where the stress is */
  for (const suf of NEUTRAL) {
    if (w.length <= suf.length + 2 || !w.endsWith(suf)) continue;
    let stem = w.slice(0, -suf.length);
    if (/([bdfglmnprt])\1$/.test(stem) && /^(ing|ed|er|ers|ings)$/.test(suf)) stem = stem.slice(0, -1);   /* begin-n-ing */
    const cands = /[aeiou]$/.test(stem) && suf !== 'es' ? [stem] : [stem, stem + 'e'];
    for (const st of cands) {
      if (!USER.has(st) && DICT.has(st)) return Math.min(n - 1, Math.max(0, DICT.get(st).indexOf('1')));
      if (WORDS[st]) return Math.min(n - 1, firstCap(WORDS[st]));
    }
    if (/^(ly|ing|ings|ed|ment|ments|ness|ful|less|ship|able)$/.test(suf) || (/^(s|es)$/.test(suf) && n >= 3)) {
      /* amaz-ing is amaze, but enter-ed is not entere */
      const restore = /^(ing|ings|ed|er|ers|able)$/.test(suf) && /[aeiouy][bcdfgklmnpstvz]$/.test(stem) && !/(er|en|on|or|el|al|ow|ar|om|it)$/.test(stem) && !/[aeiou]{2}[a-z]$/.test(stem);
      const st = restore ? stem + 'e' : stem, m = countSyl(st);
      if (m >= 1 && m <= n) return Math.min(n - 1, stressIndex(st, m, null, st));
    }
  }
  if (n === 2) {
    /* ex-PLAIN, re-CEIVE, in-CLUDE, a-RRIVE: a prefix before a long last syllable. EX-pert, CON-tact and IM-age stay on the first */
    const p = PREFIX.exec(w);
    if (p && LONG_END.test(w.slice(p[1].length)) && !SHORT_E.test(w)) return 1;
    if (/^a[bcdfgklmnpqrstvwz]/.test(w) && LONG_END.test(w) && !SHORT_E.test(w)) return 1;
    return 0;
  }
  /* the stress goes on a syllable with two consonants after it: im-PORT-ant, ex-PENS-ive, as-SIST-ant, con-SIST-ent. DIF-fer-ent has a double one and stays */
  if (/(ive|ant|ance|ent|ence|al|ous)$/.test(w) && runs) {
    const pen = runs[n - 2], last = runs[n - 1], between = w.slice(pen[1], last[0]);
    if (/ive$/.test(w) && between.length >= 1) return n - 2;
    if (between.length >= 2 && between[0] !== between[1] && !/^(ph|th|ch|sh|gh|[bcdfgkpt][lr])$/.test(between)) return n - 2;
    if (/ive$/.test(w)) return n - 2;
  }
  /* dis-COV-er, de-VEL-op, re-MEM-ber, im-POS-si-ble: after a prefix, unless the ending keeps it early */
  const p = PREFIX.exec(w);
  if (p && n >= 3 && !EARLY.test(w) && countSyl(w.slice(p[1].length)) >= n - 1 && /^[a-z]*[aeiouy]/.test(w.slice(p[1].length))) return 1;
  if (n >= 3 && AFTER_A.test(w) && !/(ate|al|ous|age|ue|ent|ence|cy|le|y|ism|ist)$/.test(w)) return 1;
  if (/[ao]$/.test(w)) return n - 2;     /* names from Spanish: Roberto, Daniela; banana, tomato */
  return n >= 4 ? n - 3 : 0;
}
/* the syllables of one word: [{from, to, stress:0|1|2}] in the word's own letters (2 = main, 1 = secondary) */
/* the dictionary counts sounds and the page has letters: fit the one to the other, so each circle still sits on its vowel */
const SPLIT = /^(ia|io|iu|ie|ea|eo|ua|uo|ue|ui|oe|oi|oa|ya|yo|ao|ae|ee|ai|au|ei|eu|ou|oo)/;
function fitRuns(w, n){
  const whole = splitHiatus(w, vowelRuns(w));
  let runs = dropSilent(w, whole);
  /* blessed and naked say the e; tired and fired do not, though the dictionary counts two sounds there */
  if (runs.length !== n && whole.length === n && !/[aeiou]re[ds]?$/.test(w)) runs = whole;
  runs = runs.slice();
  while (runs.length > n && n > 0) {
    /* evEry, chocOlate, vegEtable: a single vowel in the middle that is not said */
    let k = -1;
    for (let i = 1; i < runs.length - 1; i++) if (!runs[i].syllabic && runs[i][1] - runs[i][0] === 1 && 'eioa'.includes(w[runs[i][0]])) { k = i; break; }
    runs.splice(k < 0 ? runs.length - 1 : k, 1);
  }
  while (runs.length < n) {
    let k = -1;
    for (let i = 0; i < runs.length; i++) if (runs[i][1] - runs[i][0] >= 2 && SPLIT.test(w.slice(runs[i][0], runs[i][1]))) { k = i; break; }
    if (k >= 0) { const r = runs[k]; runs.splice(k, 1, [r[0], r[0] + 1], [r[0] + 1, r[1]]); continue; }
    /* rhythm, prism, little: a consonant that is a syllable */
    const m = /[^aeiouy](m|n|l)(s?)$/.exec(w);
    if (m && !runs.some(r => r[1] > w.length - 1 - m[2].length)) { const at = w.length - 1 - m[2].length; runs.push([at, at + 1]); continue; }
    break;
  }
  return runs;
}
function fromDict(key, pat, base){
  const runs = fitRuns(key, pat.length);
  if (!runs.length) return null;
  /* fewer places than sounds (tired, fire): the main stress must not get lost */
  let p = pat;
  if (runs.length < p.length) { const m = Math.min(runs.length - 1, p.indexOf('1')); p = p.slice(0, runs.length).replace(/1/g, '0'); p = p.slice(0, m) + '1' + p.slice(m + 1); }
  return runs.map((r, i) => ({ from:base + r[0], to:base + r[1], stress:p[i] === '1' ? 2 : p[i] === '2' ? 1 : 0 }));
}
function syllables(raw, opts){
  const chars = Array.from(String(raw));
  const w = chars.map(plain).join('');
  if (w.length !== raw.length) return [{ from:0, to:raw.length, stress:2 }];
  const clean = w.replace(/[’'`]/g, "'"), key = clean.replace(/^'+|'+$/g, '');
  /* the pronouncing dictionary knows the word: nothing is more reliable, except a correction made by hand */
  if (!(opts && opts.rules) && !USER.has(key) && DICT.has(key) && !/\u0301/.test(raw.normalize('NFD'))) {
    const d = fromDict(key, DICT.get(key), clean.indexOf(key[0]));
    if (d) return d;
  }
  const entry = WORDS[key] || WORDS[key.replace(/'/g, '')];
  if (entry && entry.replace(/[-+]/g, '').toLowerCase() === key.replace(/'/g, '')) {
    const out = []; let at = clean.indexOf(key[0]);
    for (const part of entry.split('-')) {
      const sec = part[0] === '+', seg = (sec ? part.slice(1) : part), low = seg.toLowerCase();
      let rs = dropSilent(low, vowelRuns(low));
      if (!rs.length) rs = vowelRuns(low);
      const r = rs[0] || [0, low.length];
      out.push({ from:at + r[0], to:at + r[1], stress:/[A-Z]/.test(seg) ? 2 : sec ? 1 : 0 });
      at += low.length;
      if (clean[at] === "'") at++;
    }
    return out;
  }
  /* contractions: only the part before the apostrophe has vowels; isn't and doesn't add a syllable on n */
  const ap = clean.indexOf("'", 1);
  let stem = ap > 0 ? clean.slice(0, ap) : clean, extra = null;
  if (ap > 0 && clean.slice(ap - 1, ap + 2) === "n't") { stem = stem.slice(0, -1); if (NT_SYLLABLE.test(stem)) extra = [ap - 1, ap + 2]; }
  const accentEnd = /\u0301/.test(raw.slice(-1).normalize('NFD'));   /* José: a written accent is never silent */
  let runs = splitHiatus(stem, vowelRuns(stem));
  if (!accentEnd) runs = dropSilent(stem, runs);
  /* the tokenizer knows the words that say fewer vowels than they write: every, business */
  const spoken = spokenVowels(raw) + (stem.match(/(er|ir|ur)(?![aeiouy])|ture$|ered$/g) || []).length, syll = runs.filter(r => r.syllabic).length;
  while (spoken > 0 && runs.length - syll > spoken && runs.length > 2) {
    const k = runs.findIndex((r, i) => i > 0 && i < runs.length - 1 && r[1] - r[0] === 1 && !r.syllabic && 'ei'.includes(stem[r[0]]));
    if (k < 0) break;
    runs.splice(k, 1);
  }
  if (!runs.length) return [{ from:0, to:w.length, stress:2 }];   /* Mr, Dr, a lone consonant: over the whole word */
  const main = stressIndex(stem, runs.length, runs, raw);
  const out = runs.map((r, i) => ({ from:r[0], to:r[1], stress:i === main ? 2 : 0 }));
  if (extra) out.push({ from:extra[0], to:extra[1], stress:0 });
  return out;
}

/* ── reading a text: words, stress levels and tunes ─────────────────────── */
function analyse(text, opts){
  opts = opts || {};
  const sp = HC.speech(text, { fps:60, wpm:150 });
  /* digits or a symbol read as several words count as one word here */
  const W = sp.words.filter((w, i, a) => !(i && a[i-1].from === w.from && a[i-1].to === w.to));
  /* the full stop of Mr. or Dr. does not end a sentence */
  const forTune = text.replace(/\b(Mr|Mrs|Ms|Dr|Prof|St)\./g, '$1 ');
  const pr = HC.prosody(forTune, { words:W }, { fps:60, stress:opts.stress || [] });
  const tunes = [], main = new Set();
  const low = i => W[i].word.toLowerCase().replace(/[’`]/g, "'");
  const bare = i => low(i).replace(/'(s|re|d|ll)$/, '');
  let at = 0;
  for (const se of pr.sentences) {
    const phrases = se.phrases.map(p => { const idx = p.words.map(() => at++); return { idx, main:p.main, end:p.end }; });
    const all = phrases.flatMap(p => p.idx);
    /* What's, Where's, How's are wh-questions too */
    let first = 0; while (first < all.length - 1 && LEAD_IN.test(low(all[first]))) first++;
    let type = se.type;
    if (type === 'yn' && WH.test(bare(all[first]))) type = 'wh';
    for (const p of phrases) {
      let nuc = -1;
      for (const i of p.idx) if (W[i].word === p.main) nuc = i;   /* the last one with that name */
      if (nuc < 0) nuc = p.idx[p.idx.length - 1];
      /* the wh-word is not the main stress unless it stands alone: What do you DO? How are YOU? */
      if (p === phrases[phrases.length - 1] && WH.test(bare(nuc)) && p.idx.length > 1 && !(opts.stress || []).length) nuc = p.idx[p.idx.length - 1];
      main.add(nuc); p.nuc = nuc;
    }
    const lastP = phrases[phrases.length - 1], last = all[all.length - 1];
    if (se.end === '?' || type === 'wh' || type === 'yn' || type === 'tag' || type === 'choice' || opts.statements || opts.tune) {
      if (type === 'choice') {
        const opt = [[]];
        for (const i of all) { if (low(i) === 'or') opt.push([]); else opt[opt.length-1].push(i); }
        opt.filter(o => o.length).forEach((o, n, a) => {
          const content = o.filter(i => !WEAK.has(low(i))), m = content.length ? content[content.length-1] : o[o.length-1];
          main.add(m); tunes.push({ dir:n < a.length - 1 ? 'rise' : 'fall', from:m, to:o[o.length-1], type });
        });
      } else if (type === 'tag') {
        main.add(lastP.idx[0]);
        tunes.push({ dir:'fall', from:lastP.idx[0], to:last, type });
      } else {
        const dir = opts.tune || (type === 'yn' ? 'rise' : 'fall');
        if (dir !== 'none' && (type !== 'statement' && type !== 'excl' || opts.statements || opts.tune)) tunes.push({ dir, from:lastP.nuc, to:last, type });
      }
    }
  }
  /* stress level of each syllable */
  const words = [];
  W.forEach((w, i) => {
    const isMain = main.has(i), weak = WEAK.has(low(i)) && !/n't$/.test(low(i));
    const src = text.slice(w.from, w.to);
    /* digits or a symbol: one circle over all of it */
    if (!/\p{L}/u.test(src)) { words.push({ from:w.from, to:w.to, index:[i], syl:[{ from:0, to:src.length, level:isMain ? 3 : 2 }] }); return; }
    if (w.spelled) { words.push({ from:w.from, to:w.to, index:[i], syl:[{ from:0, to:src.length, level:isMain ? 3 : 2 }] }); return; }
    const sy = syllables(src);
    words.push({ from:w.from, to:w.to, index:[i], syl:sy.map(s => ({ from:s.from, to:s.to,
      level:s.stress === 2 ? (isMain ? 3 : weak ? (sy.length > 1 ? 1 : 0) : 2) : s.stress === 1 ? 1 : 0 })) });
  });
  /* tunes in terms of words[] */
  const wordOf = i => words.findIndex(x => x.index.includes(i));
  /* connected speech: only inside a phrase, so only across plain spaces */
  const links = [];
  if (opts.connected !== false) for (let k = 0; k + 1 < words.length; k++) {
    const p = words[k], q = words[k + 1];
    if (!/^\s+$/.test(text.slice(p.to, q.from)) || W[p.index[0]].spelled || W[q.index[0]].spelled) continue;
    const a = text.slice(p.from, p.to), b = text.slice(q.from, q.to);
    if (!/\p{L}/u.test(a) || !/\p{L}/u.test(b)) continue;
    const l = linkBetween(a, b, p.syl, q.syl);
    if (l) links.push({ type:l.type, label:l.label, word:k, a:[p.from + l.a[0], p.from + l.a[1]], b:[q.from + l.b[0], q.from + l.b[1]] });
  }
  return { text, words, links, types:pr.sentences.map(s => s.type), tunes:tunes.map(t => ({ dir:t.dir, type:t.type, from:wordOf(t.from), to:wordOf(t.to) })) };
}

/* ── connected speech: what happens in the gap between two words ───────────
   The sounds are read from the spelling (American English), the same way the tokenizer reads them.
     link    consonant + vowel: the consonant moves to the next word (an arrow): name_is, an_engineer. A t between
             vowels is said almost like a d: what_is (label). Weak he, him, his, her lose their h: tell_her
     glide   vowel + vowel: an intrusive /y/ or /w/ joins them (an arc with a label): I_am, you_are, the_end
     same    the same sound twice, or its voiced/voiceless partner, is said once, held: what_time, sit_down
     palatal t, d, s, z + y: meet_you ch, did_you j, miss_you sh, is_your zh
     assim   n changes before lips or the back of the mouth: ten_people m, in_Caracas ng
     elision a t or d between consonants is not said (the letter is crossed out): last_night, and_then */
const LABELS = { plain:{ y:'/y/', w:'/w/', flap:'d', ch:'ch', j:'j', sh:'sh', zh:'zh', m:'m', ng:'ng' },
                 ipa:{ y:'/j/', w:'/w/', flap:'ɾ', ch:'tʃ', j:'dʒ', sh:'ʃ', zh:'ʒ', m:'m', ng:'ŋ' } };
const END_Z = /^(is|his|has|as|was|does|these|those|please|because|close|use|lose)$/;
const VOICELESS = 'ptkfc';
/* the last sound of a word: {s, a, b}: s = a consonant, or 'y' / 'w' after a vowel, or '' after a weak a; a, b = its letters */
function lastSound(raw){
  const w = raw.toLowerCase().replace(/[’`]/g, "'").replace(/'+$/, ''), L = w.length;
  const ap = w.indexOf("'", 1);
  if (ap > 0) {
    const tail = w.slice(ap + 1);
    if (tail === 't') return { s:'t', a:L - 1, b:L };
    if (tail === 'm' || tail === 'd') return { s:tail, a:L - 1, b:L };
    if (tail === 're') return { s:'r', a:L - 2, b:L - 1 };
    if (tail === 'll') return { s:'l', a:L - 2, b:L };
    if (tail === 've') return { s:'v', a:L - 2, b:L - 1 };
    if (tail === 's') return { s:VOICELESS.includes(w[ap - 1]) ? 's' : 'z', a:L - 1, b:L };
  }
  if (w === 'of') return { s:'v', a:1, b:2 };
  if (w === 'a') return { s:'', a:0, b:1 };
  if (w === 'the') return { s:'y', a:2, b:3 };
  if (w === 'i') return { s:'y', a:0, b:1 };
  if (w === 'one') return { s:'n', a:1, b:2 };
  if (w === 'once') return { s:'s', a:2, b:3 };
  if (/[^aeiouy]le$/.test(w)) return { s:'l', a:L - 2, b:L - 1 };
  if (/(laugh|enough|cough|rough|tough)$/.test(w)) return { s:'f', a:L - 2, b:L };
  if (/ight$/.test(w)) return { s:'t', a:L - 1, b:L };
  if (/ough$/.test(w)) return { s:'w', a:L - 4, b:L };
  if (/igh$/.test(w)) return { s:'y', a:L - 3, b:L };
  /* -ed and -es that add no syllable */
  const sy = syllables(raw), last = sy[sy.length - 1], rest = w.slice(last.to);
  if (/^[^aeiouy]+ed$/.test(rest)) {
    const c = rest[rest.length - 3];
    return { s:VOICELESS.includes(c) || c === 's' || c === 'x' || /(ch|sh)ed$/.test(rest) ? 't' : 'd', a:L - 1, b:L };
  }
  if (/^[^aeiouy]+es$/.test(rest)) return { s:VOICELESS.includes(rest[rest.length - 3]) ? 's' : 'z', a:L - 1, b:L };
  if (!rest || /^h$/.test(rest)) {   /* ends on its vowel */
    const v = w.slice(last.from, last.to);
    if (last.to - last.from > 2 && v === 'le') return { s:'l', a:last.from, b:last.to };
    if (/(o|u|oo|ew|ow|ue|ou|oe)$/.test(v)) return { s:'w', a:last.from, b:last.to };
    if (/(i|e|y|ee|ay|ey|ie|ea)$/.test(v)) return { s:'y', a:last.from, b:last.to };
    return { s:'', a:last.from, b:last.to };
  }
  let c = rest;
  const silentE = c.length > 1 && c.endsWith('e');
  if (silentE) c = c.slice(0, -1);
  const end = last.to + c.length, at = n => ({ a:end - n, b:end });
  if (/tch$/.test(c)) return { s:'ch', ...at(3) };
  if (/ch$/.test(c)) return { s:'ch', ...at(2) };
  if (/sh$/.test(c)) return { s:'sh', ...at(2) };
  if (/th$/.test(c)) return { s:'th', ...at(2) };
  if (/ng$/.test(c)) return { s:'ng', ...at(2) };
  if (/ck$/.test(c)) return { s:'k', ...at(2) };
  if (/ph$/.test(c)) return { s:'f', ...at(2) };
  if (/(mb|mn)$/.test(c)) return { s:'m', ...at(2) };
  if (/dg$/.test(c)) return { s:'j', ...at(2) };
  const ch = c[c.length - 1], dbl = c.length > 1 && c[c.length - 2] === ch ? 2 : 1;
  if (ch === 'g' && silentE) return { s:'j', ...at(1) };
  if (ch === 'c') return { s:silentE ? 's' : 'k', ...at(1) };
  if (ch === 'x') return { s:'s', ...at(1) };
  if (ch === 's' || ch === 'z') {
    if (ch === 'z' || END_Z.test(w)) return { s:'z', ...at(1) };
    if (dbl === 2 || silentE) return { s:'s', ...at(dbl) };
    return { s:c.length > 1 && !VOICELESS.includes(c[c.length - 2]) ? 'z' : 's', ...at(1) };
  }
  return { s:ch, ...at(dbl) };
}
/* the first sound: {s:'vowel' or a consonant, a, b}: a, b = the letters an arrow lands on */
function firstSound(raw, firstVowel){
  const w = raw.toLowerCase().replace(/^['’`]+/, '');
  if (/^(uni|use|usu|eu|ew)/.test(w)) return { s:'y', a:0, b:1 };
  if (/^(one|once)$/.test(w)) return { s:'w', a:0, b:1 };
  if (/^(hour|honest|honor|heir)/.test(w)) return { s:'vowel', a:firstVowel.from, b:firstVowel.to };
  if (/^[aeiou]/.test(w)) return { s:'vowel', a:firstVowel.from, b:firstVowel.to };
  const two = w.slice(0, 2), c = w[0];
  if (two === 'th') return { s:'th', a:0, b:2 };
  if (two === 'ch') return { s:'ch', a:0, b:2 };
  if (two === 'sh') return { s:'sh', a:0, b:2 };
  if (two === 'ph') return { s:'f', a:0, b:2 };
  if (two === 'wh') return { s:w.startsWith('who') ? 'h' : 'w', a:0, b:2 };
  if (two === 'kn' || two === 'gn') return { s:'n', a:0, b:2 };
  if (two === 'wr') return { s:'r', a:0, b:2 };
  if (c === 'c') return { s:/[eiy]/.test(w[1] || '') ? 's' : 'k', a:0, b:1 };
  if (c === 'g') return { s:/^g[eiy]/.test(w) && !/^(get|give|girl|gift|guess)/.test(w) ? 'j' : 'g', a:0, b:1 };
  if (c === 'q') return { s:'k', a:0, b:1 };
  return { s:c, a:0, b:1 };
}
const PARTNER = { t:'d', d:'t', p:'b', b:'p', k:'g', g:'k', s:'z', z:'s', f:'v', v:'f' };
function linkBetween(aw, bw, syA, syB){
  const low = bw.toLowerCase(), A = lastSound(aw), B = firstSound(bw, syB[0] || { from:0, to:1 });
  const hit = (type, label) => ({ type, label:label || '', a:[A.a, A.b], b:[B.a, B.b] });
  if (A.s === 'y' || A.s === 'w') return B.s === 'vowel' ? hit('glide', A.s) : null;
  if (!A.s) return null;
  /* weak he, him, his, her: the h goes and the consonant links on */
  if (/^(he|him|his|her)$/.test(low)) { B.a = syB[0].from; B.b = syB[0].to; B.s = 'vowel'; }
  if (B.s === 'vowel') {
    const before = aw[A.a - 1] || '';
    return hit('link', A.s === 't' && /[aeiouyr]/i.test(before) ? 'flap' : '');
  }
  if (B.s === 'y' && 'tdsz'.includes(A.s)) return hit('palatal', { t:'ch', d:'j', s:'sh', z:'zh' }[A.s]);
  if (A.s === B.s || PARTNER[A.s] === B.s) return hit('same');
  if (A.s === 'n' && 'pbm'.includes(B.s)) return hit('assim', 'm');
  if (A.s === 'n' && 'kg'.includes(B.s)) return hit('assim', 'ng');
  if ((A.s === 't' || A.s === 'd') && !'yhw'.includes(B.s)) {
    const before = aw[A.a - 1] || '';
    if ((/[sfkpnlx]/i.test(before) || /n't$/i.test(aw)) && A.b - A.a === 1) return hit('elision');
  }
  return null;
}

/* ── drawing ────────────────────────────────────────────────────────────── */
const CSS = ''
  + '.pm-line{ position:relative; }'
  /* the words stay inline, so punctuation never wraps away from them; a zero-width strut in each word makes the room above the line */
  + '.pm-w{ white-space:nowrap; }'
  + '.pm-w::before{ content:""; display:inline-block; width:0; vertical-align:baseline; height:' + (0.93 + ROW + 0.36 - 0.1) + 'em; }'
  + '.pm-w.pm-tail::before{ height:' + (0.93 + ROW + 0.36 + 0.2 + ARROW.band * EM) + 'em; }'
  /* a word with a mark under it: the same strut reaches below the line as well */
  + '.pm-w.pm-under::before{ vertical-align:-' + UNDER + 'em; height:' + (0.93 + ROW + 0.36 - 0.1 + UNDER) + 'em; }'
  + '.pm-w.pm-tail.pm-under::before{ height:' + (0.93 + ROW + 0.36 + 0.2 + ARROW.band * EM + UNDER) + 'em; }'
  + '.pm-w.pm-under.pm-link::before{ vertical-align:-' + UNDER_LINK + 'em; height:' + (0.93 + ROW + 0.36 - 0.1 + UNDER_LINK) + 'em; }'
  + '.pm-w.pm-tail.pm-under.pm-link::before{ height:' + (0.93 + ROW + 0.36 + 0.2 + ARROW.band * EM + UNDER_LINK) + 'em; }'
  + '.pm-w.pm-under.pm-label::before{ vertical-align:-' + UNDER_LABEL + 'em; height:' + (0.93 + ROW + 0.36 - 0.1 + UNDER_LABEL) + 'em; }'
  + '.pm-w.pm-tail.pm-under.pm-label::before{ height:' + (0.93 + ROW + 0.36 + 0.2 + ARROW.band * EM + UNDER_LABEL) + 'em; }'
  /* stick-figure sentences: the marks go between the words and the figures. Every word in a marked line gets the same strut, so the
     figures stand level, above the circles; where there is an arrow and the figures are showing, above the arrow too */
  + '.pm-line .ss-txt::before{ content:""; display:inline-block; width:0; vertical-align:-' + UNDER_LABEL + 'em; height:' + (0.93 + ROW + 0.36 + 0.05 + UNDER_LABEL) + 'em; }'
  + 'html:not(.ss-sticks-hidden) .pm-line.pm-tuned .ss-txt::before{ height:' + (0.93 + ROW + 0.36 + 0.3 + ARROW.band * EM + UNDER_LABEL) + 'em; }'
  + '.pm-hidden .pm-line .ss-txt::before, html.pm-hidden:not(.ss-sticks-hidden) .pm-line.pm-tuned .ss-txt::before{ display:none; }'
  + '.pm-v{ position:relative; }'
  + '.pm-v > svg{ position:absolute; left:50%; bottom:calc(100% + ' + (ROW - 0.36) + 'em); overflow:visible; pointer-events:none; color:var(--pm-stress, var(--color-text-primary, currentColor)); -webkit-text-stroke:0; display:block; transform:translateX(-50%); }'
  + '.pm-end{ padding-right:.95em; }'
  + '.pm-arrows{ position:absolute; left:0; top:0; width:100%; height:100%; overflow:visible; pointer-events:none; }'
  + '.pm-arrows .pm-tune{ color:var(--pm-tune, var(--color-text-primary, currentColor)); }'
  + '.pm-arrows .pm-cs{ color:var(--pm-connected, #0891b2); }'
  + '.pm-arrows text{ font-family:var(--font-sans, sans-serif); font-weight:700; fill:currentColor; }'
  + '.pm-hidden .pm-v > svg, .pm-hidden .pm-arrows{ display:none; }'
  + '.pm-hidden .pm-w::before{ display:none; }'
  + '.pm-hidden .pm-end{ padding-right:0; }'
  + '.pm-btn{ margin-right:6px; }'
  + '.pm-colours{ display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center; margin:0 0 .7rem; font-size:.8rem; color:var(--text-secondary, inherit); }'
  + '.pm-colours label{ display:inline-flex; align-items:center; gap:5px; cursor:pointer; }'
  + '.pm-colours input[type=color]{ width:1.9rem; height:1.5rem; padding:0; border:1px solid var(--color-border-primary, #999); border-radius:5px; background:none; cursor:pointer; }'
  + '.pm-colours button{ font-size:.75rem; padding:2px 9px; }'
  + '.pm-hidden .pm-colours{ display:none; }';
function injectCSS(){
  if (document.getElementById('pron-mark-css')) return;
  const st = document.createElement('style'); st.id = 'pron-mark-css'; st.textContent = CSS;
  document.head.appendChild(st);
}
const SVGNS = 'http://www.w3.org/2000/svg';
function circle(level){
  const d = DIAM[level], r = (d - S) / 2, em = (d * EM).toFixed(3);
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', (-d/2) + ' ' + (-d/2) + ' ' + d + ' ' + d);
  s.setAttribute('aria-hidden', 'true');
  s.style.width = s.style.height = em + 'em';
  s.innerHTML = level === 0 ? '<circle r="' + (d / 2) + '" fill="currentColor"/>'
    : '<circle r="' + r + '" fill="none" stroke="currentColor" stroke-width="' + S + '"/>';
  return s;
}
const SKIP = '.pm-arrows, .ss-figs, .ss-pic, .emoji, .avatar, svg, button, script, style';
function textNodes(root){
  const out = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode:n => n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n, at = 0, unit = null;
  while ((n = walk.nextNode())) {
    /* stick-figure sentences have no spaces between their words: each .ss-unit counts as if a space came before it */
    const u = n.parentElement.closest('.ss-unit');
    if (u && unit && u !== unit) at += 1;
    if (u) unit = u;
    out.push({ node:n, from:at, to:at + n.data.length }); at += n.data.length;
  }
  return out;
}
/* wraps [from, to) of the element's text, staying inside one text node; returns the new element */
function wrap(el, from, to, make){
  for (const t of textNodes(el)) {
    if (from < t.from || from >= t.to) continue;
    if (to > t.to) return null;
    const r = document.createRange();
    r.setStart(t.node, from - t.from); r.setEnd(t.node, to - t.from);
    const span = make(); r.surroundContents(span);
    return span;
  }
  return null;
}
/* the same, for marking from the end of the text backward: the list of text nodes is read once, which keeps a long paragraph quick.
   Wrapping leaves the text before it in the same node, so that entry only gets shorter. */
function wrapBack(nodes, from, to, make){
  while (nodes.length && nodes[nodes.length-1].from > from) nodes.pop();
  const t = nodes[nodes.length-1];
  if (!t || from >= t.to || to > t.to) return null;
  const r = document.createRange();
  r.setStart(t.node, from - t.from); r.setEnd(t.node, to - t.from);
  const span = make(); r.surroundContents(span);
  t.to = from;
  return span;
}
function mark(target, opts){
  injectCSS();
  opts = opts || {};
  const list = typeof target === 'string' ? document.querySelectorAll(target) : target instanceof Element ? [target] : target;
  const done = [];
  for (const el of list) { done.push(markOne(el, opts)); }
  return done;
}
function markOne(el, opts){
  if (el._pm) unmarkOne(el);
  /* bionic reading (house.js) leaves marked lines alone: take its bold letters out of this one */
  el.querySelectorAll('.bionic-w').forEach(w => w.replaceWith(document.createTextNode(w.textContent)));
  el.normalize();
  const orig = el.innerHTML;
  /* direct text in a flex box (a card): each piece would become a flex item, so it goes in one span first */
  const disp = el.isConnected ? getComputedStyle(el).display : '';
  if (/flex|grid/.test(disp)) for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.data.trim()) { const sp = document.createElement('span'); el.insertBefore(sp, n); sp.appendChild(n); }
  const nodes = textNodes(el), text = nodes.reduce((a, t) => a + ' '.repeat(t.from - a.length) + t.node.data, '');
  /* <span data-pm-main> marks the main stress by hand; so does opts.main, a word of this text */
  const stress = [];
  if (opts.main) { const m = new RegExp('(^|[^\\p{L}])(' + opts.main.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\p{L}])', 'iu').exec(text); if (m) { const a = m.index + m[1].length; stress.push([a, a + m[2].length]); } }
  for (const m of el.querySelectorAll('[data-pm-main]')) {
    const ins = nodes.filter(t => m.contains(t.node));
    if (ins.length) stress.push([ins[0].from, ins[ins.length-1].to]);
  }
  const tune = el.getAttribute('data-pm-tune') || opts.tune;
  /* a question number ("1. What …") is not a sentence, and is not said */
  const said = text.replace(/^(\s*)(\d+[.)])(?=\s)/, (m, a, n) => a + ' '.repeat(n.length));
  const A = analyse(said, { statements:opts.statements, tune, stress, connected:opts.connected });
  /* from the end backward, so nothing before it moves. Words first, so the vowels nest inside them */
  const info = A.words.map(() => ({ w:null, v:null, vs:[] }));
  const tuneEnds = new Map(A.tunes.map(t => [t.to, t]));
  const tails = new Set(A.tunes.map(t => t.to));
  const back = textNodes(el);
  for (let k = A.words.length - 1; k >= 0; k--) {
    const w = A.words[k];
    const box = wrapBack(back, w.from, w.to, () => { const s = document.createElement('span'); s.className = 'pm-w' + (tails.has(k) ? ' pm-tail' : ''); return s; });
    info[k].w = box;
    /* the vowels: inside the word's own box */
    for (let n = w.syl.length - 1; n >= 0; n--) {
      const sy = w.syl[n];
      const host = box || el, base = box ? 0 : w.from;
      const v = wrap(host, base + sy.from, base + sy.to, () => { const s = document.createElement('span'); s.className = 'pm-v'; return s; });
      if (v) { v.appendChild(circle(sy.level)); info[k].vs.unshift({ el:v, level:sy.level }); }
    }
  }
  /* the room for the arrow's head after the last letter: on the punctuation if there is any, else on the word */
  const ends = [];
  for (const [to, t] of tuneEnds) {
    const w = A.words[to]; let e = w.to;
    while (e < text.length && /[.?!…,;:"”’')\]]/.test(text[e])) e++;
    let last = null;
    if (e > w.to) last = wrap(el, w.to, e, () => { const s = document.createElement('span'); s.className = 'pm-end'; return s; });
    if (!last && info[to].w) { info[to].w.classList.add('pm-end'); last = info[to].w; }
    ends.push({ t, last });
  }
  for (const l of A.links) for (const k of [l.word, l.word + 1]) if (info[k].w) { info[k].w.classList.add('pm-under'); if (l.label) info[k].w.classList.add('pm-label'); if (l.type === 'link') info[k].w.classList.add('pm-link'); }
  el.classList.add('pm-line');
  el.classList.toggle('pm-tuned', A.tunes.length > 0);
  const col = opts.colours || {};
  for (const k of ['stress', 'connected', 'intonation']) if (col[k]) el.style.setProperty(VAR[k], col[k]);
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'pm-arrows'); svg.setAttribute('aria-hidden', 'true');
  el.appendChild(svg);
  const state = { orig, A, info, ends, svg, draw:null, ro:null, labels:LABELS[opts.labels] || LABELS.plain };
  state.draw = () => drawArrows(el, state);
  el._pm = state;
  state.draw();
  if (window.ResizeObserver) { state.ro = new ResizeObserver(state.draw); state.ro.observe(el); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(state.draw);
  return el;
}
function unmarkOne(el){
  const st = el._pm; if (!st) return;
  if (st.ro) st.ro.disconnect();
  el.innerHTML = st.orig; el.classList.remove('pm-line', 'pm-tuned'); el._pm = null;
}
function unmark(target){
  const list = typeof target === 'string' ? document.querySelectorAll(target) : target instanceof Element ? [target] : target;
  for (const el of list) unmarkOne(el);
}
const f2 = v => Math.round(v * 100) / 100;
function drawArrows(el, st){
  /* the page has redrawn this element, or marked it again: this drawing is over */
  if (el._pm !== st || !el.contains(st.svg)) { if (st.ro) st.ro.disconnect(); return; }
  const box = el.getBoundingClientRect();
  if (!box.width) return;
  const fs = parseFloat(getComputedStyle(el).fontSize) || 16, u = fs * EM;   /* px per unit */
  const ox = box.left + el.clientLeft, oy = box.top + el.clientTop;
  let h = '';
  for (const { t, last } of st.ends) {
    const startInfo = st.info[t.from], endInfo = st.info[t.to];
    const lastV = endInfo.vs[endInfo.vs.length - 1]; if (!last || !lastV) continue;
    const lastLine = lastV.el.getBoundingClientRect();
    /* where the fall or rise starts: the main stress, or the first word of the line if the sentence wraps before the end */
    let sv = startInfo.vs.find(v => v.level === 3) || startInfo.vs[0];
    if (!sv) continue;
    if (Math.abs(sv.el.getBoundingClientRect().top - lastLine.top) > fs * 0.5) {
      for (let k = t.to; k >= t.from; k--) {
        const c = st.info[k].vs[0]; if (!c) continue;
        if (Math.abs(c.el.getBoundingClientRect().top - lastLine.top) > fs * 0.5) break;
        sv = c;
      }
    }
    const r0 = sv.el.getBoundingClientRect();
    const rects = last.getClientRects(), rl = rects[rects.length - 1];
    if (!rl) continue;
    const padR = parseFloat(getComputedStyle(last).paddingRight) || 0;
    const end = rl.right - padR;
    const x0 = r0.left + r0.width / 2 - ox;
    const rowY = r0.top - ROW * fs - oy;                     /* the middle of the circles */
    const yLow = rowY - 0.36 * fs - S / 2 * u;               /* just above the biggest circle */
    const yHigh = yLow - ARROW.band * u;
    const x1 = Math.max(end - ox + ARROW.w * u, x0 + 1.3 * H * u);
    const w = ARROW.w * u, len = ARROW.len * u, sw = S * u;
    /* the curve ends where the legs begin and a straight piece runs through them to the tip, as in the stick figures' arrow */
    const P = (x, y) => f2(x) + ',' + f2(y), rise = t.dir === 'rise';
    const yA = rise ? yLow : yHigh, yTip = rise ? yHigh : yLow + 0.3 * fs, sg = rise ? 1 : -1, yNeck = yTip + sg * len;
    const d = 'M' + P(x0, yA) + 'C' + P(x0 + (x1 - x0) * 0.6, yA) + ' ' + P(x1, yA - sg * Math.abs(yNeck - yA) * 0.15) + ' ' + P(x1, yNeck) + 'L' + P(x1, yTip)
      + 'M' + P(x1 - w, yNeck) + 'L' + P(x1, yTip) + 'L' + P(x1 + w, yNeck);
    h += '<path class="pm-tune" data-tune="' + t.dir + '" d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + f2(sw) + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  h += drawLinks(el, st, fs, u, ox, oy);
  st.svg.innerHTML = h;
}
/* the box of [a, b) of the element's text */
function lettersBox(el, a, b){
  const nodes = textNodes(el);
  const s = nodes.find(t => a >= t.from && a < t.to), e = nodes.find(t => b > t.from && b <= t.to);
  if (!s || !e) return null;
  const r = document.createRange();
  r.setStart(s.node, a - s.from); r.setEnd(e.node, b - e.from);
  return r.getBoundingClientRect();
}
/* under the gaps */
function drawLinks(el, st, fs, u, ox, oy){
  let h = '';
  const sw = S * u, wl = ARROW.w * u * 0.6, ll = ARROW.len * u * 0.62;   /* the same line width as everything else; the head is smaller, to fit under a space */
  const line = 'fill="none" stroke="currentColor" stroke-width="' + f2(sw) + '" stroke-linecap="round" stroke-linejoin="round"';
  let prevTip = null;
  for (const l of st.A.links) {
    const ra = lettersBox(el, l.a[0], l.a[1]), rb = lettersBox(el, l.b[0], l.b[1]);
    if (!ra || !rb || Math.abs(ra.top - rb.top) > fs * 0.5) continue;   /* the two words are on different lines */
    const x0 = ra.left + ra.width / 2 - ox, x1 = rb.left + rb.width / 2 - ox, y = ra.bottom + 0.1 * fs - oy, dip = 0.55 * fs;
    const cx = (x0 + x1) / 2, cy = y + dip * 2 * 0.62;   /* a quadratic curve reaches half way to its control point */
    let d;
    if (l.type === 'link') {
      /* catenation: as in the stick figures' arrow, a straight piece runs up through the head, and the curve stays below the legs,
         so it never hides the head. A cubic reaches 3/4 of the way to its control points. */
      /* where two arrows meet in a short word (it off), or the arrow is very narrow, the curve starts below the legs, clear of both heads */
      const neck = y + ll, ctrl = neck + LINK_BELOW * fs / 0.75;
      const crowded = (prevTip !== null && Math.abs(x0 - prevTip) < wl + sw * 1.2) || x1 - x0 < wl + sw * 1.2;
      const y0 = crowded ? neck + sw * 1.1 : y;
      d = 'M' + f2(x0) + ',' + f2(y0) + 'C' + f2(x0) + ',' + f2(ctrl) + ' ' + f2(x1) + ',' + f2(ctrl) + ' ' + f2(x1) + ',' + f2(neck) + 'L' + f2(x1) + ',' + f2(y)
        + 'M' + f2(x1 - wl) + ',' + f2(neck) + 'L' + f2(x1) + ',' + f2(y) + 'L' + f2(x1 + wl) + ',' + f2(neck);
      prevTip = x1;
    } else { d = 'M' + f2(x0) + ',' + f2(y) + 'Q' + f2(cx) + ',' + f2(cy) + ' ' + f2(x1) + ',' + f2(y); prevTip = null; }
    if (l.type === 'elision') d += 'M' + f2(ra.left - 0.02 * fs - ox) + ',' + f2(ra.bottom - 0.2 * fs - oy) + 'L' + f2(ra.right + 0.02 * fs - ox) + ',' + f2(ra.top + 0.26 * fs - oy);
    h += '<path class="pm-cs" data-cs="' + l.type + '" d="' + d + '" ' + line + '/>';
    if (l.label) h += '<text class="pm-cs" data-cs-label="' + l.type + '" x="' + f2(cx) + '" y="' + f2(l.type === 'link' ? y + ll + LINK_BELOW * fs + 0.58 * fs : y + dip * 0.62 + 0.66 * fs) + '" font-size="' + f2(0.6 * fs) + '" text-anchor="middle">' + (st.labels[l.label] || l.label) + '</text>';
  }
  return h;
}

/* ── the colours of the three layers ─────────────────────────────────────
   PronMark.colours({stress:'#CC0000', connected:'#0066CC', intonation:'#6600CC'})   for the whole page, remembered on this device.
   null puts a layer back to its default. PronMark.mark(el, {colours:{…}}) sets them for one element. */
const VAR = { stress:'--pm-stress', connected:'--pm-connected', intonation:'--pm-tune' };
const COL_KEY = 'pron-mark-colours';
let COLS = {};
try { COLS = JSON.parse(localStorage.getItem(COL_KEY) || '{}') || {}; } catch (e) { COLS = {}; }
function applyColours(){ for (const k in VAR) { if (COLS[k]) document.documentElement.style.setProperty(VAR[k], COLS[k]); else document.documentElement.style.removeProperty(VAR[k]); } }
applyColours();
function colours(map){
  if (map) { for (const k in map) if (VAR[k]) { if (map[k]) COLS[k] = map[k]; else delete COLS[k]; }
    try { localStorage.setItem(COL_KEY, JSON.stringify(COLS)); } catch (e) {}
    applyColours(); }
  return Object.assign({}, COLS);
}
/* the colour a layer has now, as #rrggbb for the colour inputs */
function shownColour(k){
  const p = document.createElement('span'); p.style.color = 'var(' + VAR[k] + ', ' + (k === 'connected' ? '#0891b2' : 'var(--color-text-primary, #000)') + ')';
  document.body.appendChild(p);
  const m = getComputedStyle(p).color.match(/\d+(\.\d+)?/g) || [0,0,0]; p.remove();
  return '#' + m.slice(0, 3).map(v => Math.round(+v).toString(16).padStart(2, '0')).join('');
}
function colourControls(){
  const box = document.createElement('div'); box.className = 'pm-colours'; box.id = 'pmColours';
  const rows = [['stress','Stress'],['connected','Connected speech'],['intonation','Intonation']];
  box.innerHTML = rows.map(([k, l]) => '<label>' + l + ' <input type="color" data-pm-colour="' + k + '" aria-label="' + l + ' colour"></label>').join('') + '<button type="button" data-pm-reset>Reset colours</button>';
  const sync = () => box.querySelectorAll('input').forEach(i => { i.value = shownColour(i.dataset.pmColour); });
  box.addEventListener('input', e => { if (e.target.dataset.pmColour) colours({ [e.target.dataset.pmColour]:e.target.value }); });
  box.querySelector('[data-pm-reset]').addEventListener('click', () => { colours({ stress:null, connected:null, intonation:null }); sync(); });
  sync();
  /* defaults follow the theme, so the inputs do too */
  new MutationObserver(sync).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
  return box;
}

/* ── show / hide: the same switch as the stick figures ── */
function toggle(opts){
  opts = opts || {}; injectCSS();
  const root = document.documentElement, cls = 'pm-hidden';
  root.classList.toggle(cls, !opts.shown);
  const redraw = () => document.querySelectorAll('.pm-line').forEach(e => e._pm && e._pm.draw());
  const run = () => {
    if (document.getElementById('pmToggle')) return;
    const b = document.createElement('button');
    b.id = 'pmToggle'; b.className = 'grammar-toggle-btn pm-btn'; b.type = 'button';
    const show = on => { root.classList.toggle(cls, !on); b.textContent = on ? '🎵 Hide pronunciation marks' : '🎵 Show pronunciation marks'; b.setAttribute('aria-pressed', String(on)); redraw(); };
    b.addEventListener('click', () => show(root.classList.contains(cls)));
    show(!!opts.shown);
    const g = document.getElementById('grammarToggle');
    if (g) g.parentNode.insertBefore(b, g);
    else { const sub = document.querySelector('.page h1 ~ .subtitle') || document.querySelector('.page h1'); if (sub) sub.insertAdjacentElement('afterend', b); }
    if (opts.colours !== false && b.parentNode) b.insertAdjacentElement('afterend', colourControls());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else setTimeout(run, 0);
}

window.PronMark = { mark, unmark, toggle, colours, colourControls, dict, useDict, analyse, syllables, DIAM, H, S, EM };
})();
