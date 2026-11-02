/* ═══════════════════════════════════════════════════════════════════════════
   pron-adapter.js — pronunciation marks (pron-mark.js) on the existing lesson pages, without changing them.
   The page gets a "🎵 Show pronunciation marks" button. The engines (house-character.js, pron-mark.js, from this
   file's own folder) load the first time it is pressed, so a page that never uses it pays nothing. The choice is
   remembered for every page.

   Three lookup tables decide what gets marks:

     COMPONENTS  house component → the elements that hold English to say
     PROFILES    kind of page → which components
     LESSONS     lesson file → its profile, and anything special about that file

   A file not in LESSONS gets the profile of its stage, from its name (a1_intro_x.html → intro).

   One entry in LESSONS is either a profile name or an object:
     'a1_clarf_x.html': { profile:'clarf',        the components of this profile
        add:['.ask-row > span:first-child'],      more elements, for this page only
        skip:['.answer-rule'],                    elements to leave alone, for this page only
        dict:{ Kenji:'KEN-ji' },                  word stress, for this page only
        options:{ statements:true } }             options for PronMark.mark
   Profile 'none' = no button: posters, tools and builders.

   FIXES is a table of whole lines, for what the rules cannot know: { 'How are you?':{ main:'are' } }. The key is
   the element's text; main = the word with the main stress, tune = 'rise', 'fall' or 'none'.

   Never marked, on any page: anything with a blank or an input in it, and the parts of an exercise where the marks
   would give away or get in the way of the answer (word order, gap fill, form labels, error hunt, the ✗ line of a
   common mistake).

   Content drawn later (a reset of a matching game, a new roll of the dice) is marked as it appears.

   house.js loads this file on every page, the same way it loads vn-adapter.js.

   In the browser console: PronAdapter.audit() lists what this page's profile finds, element by element.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE = SRC ? SRC.replace(/[^/]*$/, '') : '';
  const FILE = (location.pathname.split('/').pop() || '').toLowerCase();

  /* ── house component → elements ── */
  const COMPONENTS = {
    conversation: '.bubble',                       /* chat lines */
    vocabulary:   '.match-col .match-card',        /* matching cards (cards with only a picture get nothing) */
    prequestions: '.prequiz li',                   /* "Before you read" */
    questions:    '.quiz-q .q-text',               /* "Check your answers" */
    ccq:          '.ccq-sentence',                 /* the sentence, not the concept questions */
    correct:      '.pair-line.yes',                /* common mistakes: only the ✓ line, never the ✗ one */
    sequence:     '.seq-example',                  /* first / then / finally examples */
    prompt:       '.q-text, .q-line'               /* the dice card on freer pages */
  };
  /* ── kind of page → components ── */
  const PROFILES = {
    intro: ['conversation', 'vocabulary', 'prequestions', 'questions'],
    clarf: ['conversation', 'ccq', 'correct', 'sequence'],
    ctrld: ['conversation', 'vocabulary'],
    freer: ['conversation', 'prompt'],
    extra: ['conversation', 'vocabulary'],
    none: []
  };
  /* never, whatever a profile or a page asks for */
  const NEVER = '.wo-item, .gf-item, .fc-item, .fc-pool, .eh-item, .eh2-item, .pair-line.no, button, input, select, textarea';

  /* ── lesson file → profile. The entries with add or dict come from reading those pages; the rest are listed by the stage in their
     names. Pages with their own kit (present perfect, deduction, time and weather, labs) may draw English in their own classes:
     PronAdapter.audit() shows what a page finds, and add: […] brings in the rest ── */
  const LESSONS = {
    /* tools and posters: no marks */
    'a1a2_extra_character_poser.html':'none', 'a1a2_extra_stick_figure_poser.html':'none', 'character-keyframes.html':'none', 'visual-novel.html':'none',
    'a1_extra_final_sounds_poster.html':'none', 'a1_extra_consonant_clusters_poster.html':'none', 'a1_freer_house_builder.html':'none', 'a1_freer_directions_playground.html':'none',
    /* intro */
    'a1a2_intro_zero_article_likes.html':'intro', 'a1_intro_phrases_for_places.html':'intro', 'a1a2_intro_present_perfect_already_yet.html':'intro',
    'a1_intro_present_continuous_wearing_carrying_holding.html':'intro', 'a1_intro_time_and_weather_phone_call.html':'intro', 'a1_intro_weather_and_time_vocabulary.html':'intro',
    'a2_intro_reported_speech_workplace.html':'intro', 'a1a2_intro_present_perfect.html':'intro', 'b1_intro_past_modals_deduction.html':'intro', 'a2b1_intro_deduction_modals.html':'intro',
    'a1a2_intro_object_pronouns_tell_let_know.html':'intro', 'a1a2_intro_reported_speech_questions.html':'intro', 'a1a2_intro_reported_speech_requests.html':'intro',
    'a1a2_intro_reported_speech_statements.html':'intro', 'a1a2_intro_comparatives_house_hunting.html':'intro', 'a1a2_intro_house_neighborhood_adjectives.html':'intro',
    'a1a2_intro_demonstratives_one_ones.html':'intro', 'a1_intro_there_is_there_are_house.html':'intro', 'a1_intro_rooms_vocabulary.html':'intro', 'a1_intro_prepositions_of_place.html':'intro', 'a1_intro_living_room_vocabulary.html':'intro',
    /* clarification */
    'a1a2_clarf_zero_article_likes.html':'clarf',
    'a1_clarf_phrases_for_places.html':{ profile:'clarf', add:['.ask-row > span:first-child'] },
    'a1a2_clarf_present_perfect_already_yet.html':'clarf', 'a1_clarf_telling_the_time_and_weather.html':'clarf', 'a2_clarf_reported_speech_workplace.html':'clarf', 'a1a2_clarf_present_perfect.html':'clarf',
    'b1_clarf_past_modals_deduction.html':'clarf', 'a2b1_clarf_deduction_modals.html':'clarf', 'a1a2_clarf_object_pronouns_tell_let_know.html':'clarf', 'a1a2_clarf_reported_speech_questions.html':'clarf',
    'a1a2_clarf_reported_speech_requests.html':'clarf', 'a1a2_clarf_reported_speech_statements.html':'clarf', 'a1a2_clarf_comparatives_superlatives.html':'clarf', 'a1a2_clarf_demonstratives_one_ones.html':'clarf',
    'a1_clarf_there_is_there_are_house.html':'clarf', 'a1_clarf_prepositions_of_place.html':'clarf', 'a2_clarf_causative_get_and_have.html':'clarf', 'a1_clarf_spelling_personal_info.html':'clarf',
    /* controlled practice */
    'a1a2_ctrld_zero_article_likes.html':'ctrld', 'a1_ctrld_phrases_for_places.html':'ctrld', 'a1a2_ctrld_present_perfect_already_yet.html':'ctrld', 'a2_ctrld_past_simple_vacation.html':'ctrld',
    'a1_ctrld_telling_the_time_and_weather.html':'ctrld', 'a2_ctrld_reported_speech_workplace.html':'ctrld', 'a1a2_ctrld_present_perfect.html':'ctrld', 'b1_ctrld_past_modals_deduction.html':'ctrld',
    'a2b1_ctrld_deduction_modals.html':'ctrld', 'a1a2_ctrld_object_pronouns_tell_let_know.html':'ctrld', 'a1a2_ctrld_reported_speech_questions.html':'ctrld', 'a1a2_ctrld_reported_speech_requests.html':'ctrld',
    'a1a2_ctrld_reported_speech_statements.html':'ctrld', 'a1a2_ctrld_comparatives_superlatives.html':'ctrld', 'a1a2_ctrld_demonstratives_one_ones.html':'ctrld', 'a1_ctrld_there_is_there_are_house.html':'ctrld', 'a1_ctrld_prepositions_of_place.html':'ctrld',
    /* freer practice */
    'a1a2_freer_zero_article_likes.html':{ profile:'freer', add:['.rule-box b', '.check-body p:not(.text-secondary)'], dict:{ prefer:'pre-FER' } },
    'a1a2_freer_present_perfect_already_yet.html':'freer', 'a1_freer_time_and_weather_where_are_you.html':'freer', 'a2_freer_reported_speech_workplace.html':'freer', 'a1a2_freer_present_perfect.html':'freer',
    'b1_freer_past_modals_deduction.html':'freer', 'a2b1_freer_deduction_modals.html':'freer', 'a1a2_freer_object_pronouns_tell_let_know.html':'freer', 'a1a2_freer_reported_speech_questions.html':'freer',
    'a1a2_freer_reported_speech_requests.html':'freer', 'a1a2_freer_reported_speech_statements.html':'freer', 'a1a2_freer_house_ads.html':'freer', 'a1a2_freer_demonstratives_one_ones.html':'freer',
    'a1_freer_there_is_there_are_house.html':'freer', 'a1_freer_prepositions_of_place.html':'freer',
    /* self-study labs */
    'a1a2_extra_reported_speech_lab.html':'extra', 'b1_extra_modal_verbs_lab.html':'extra', 'a2_extra_present_perfect_lab.html':'extra', 'a1a2_extra_comparatives_superlatives_lab.html':'extra',
    'a2_extra_modal_verbs_lab.html':'extra', 'a1_extra_wh_questions_do_does_lab.html':'extra', 'a1_extra_wh_questions_be_lab.html':'extra',
    /* the demo marks itself */
    'a1_extra_stress_intonation_marks.html':'none'
  };
  /* ── whole lines the rules cannot know ── */
  const FIXES = {
    'How are you?': { main:'are' }
  };

  function entry() {
    const e = LESSONS[FILE];
    if (e) return typeof e === 'string' ? { profile:e } : e;
    const m = FILE.match(/^[a-c][12](?:[a-c][12])?_(intro|clarf|ctrld|freer|extra)_/);
    return { profile:m ? m[1] : 'none' };
  }
  const E = entry();
  const selector = () => (PROFILES[E.profile] || []).map(c => COMPONENTS[c]).concat(E.add || []).join(', ');
  const norm = t => t.replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  /* the words of an element: a stick-figure sentence has no spaces between its words */
  function textOf(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('.ss-figs, .ss-pic, svg, script, style').forEach(n => n.remove());
    c.querySelectorAll('.ss-unit').forEach(n => n.append(' '));
    return norm(c.textContent).replace(/\s+([,.!?;:…])/g, '$1');
  }
  function wanted(el) {
    if (el.closest(NEVER)) return false;
    if (E.skip && E.skip.some(s => el.matches(s) || el.closest(s))) return false;
    if (el.querySelector('input, select, textarea, .blank, .gap')) return false;
    if (/_{2,}/.test(el.textContent)) return false;
    return /\p{L}/u.test(textOf(el));
  }
  function list() { const s = selector(); return s ? [...document.querySelectorAll(s)].filter(wanted) : []; }

  /* mark what is new, and what a page has redrawn from inside (its marks are gone) */
  function scan() {
    for (const el of list()) {
      if (el._pm && el.contains(el._pm.svg)) continue;
      if (el._pm) el._pm = null;
      if (el.parentElement && el.parentElement.closest('.pm-line')) continue;   /* already inside a marked element */
      const fix = FIXES[textOf(el)] || {};
      window.PronMark.mark(el, Object.assign({ tune:el.getAttribute('data-pm-tune') || undefined }, E.options, fix));
    }
  }
  let queued = false, observer = null;
  function queue() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (observer) { observer.disconnect(); scan(); observer.observe(document.body, { childList:true, subtree:true }); } }); }

  /* ── loading the engines, once ── */
  function load(src) { return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = BASE + src; s.onload = ok; s.onerror = () => bad(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
  let loading = null;
  function engines() {
    return loading || (loading = (window.HouseCharacter ? Promise.resolve() : load('house-character.js')).then(() => window.PronMark ? null : load('pron-mark.js')));
  }

  const STORE = 'pron-marks-shown';
  const remember = on => { try { localStorage.setItem(STORE, on ? '1' : '0'); } catch (e) {} };
  function start(button) {
    return engines().then(() => {
      if (E.dict) window.PronMark.dict(E.dict);
      observer = new MutationObserver(queue);
      scan();
      observer.observe(document.body, { childList:true, subtree:true });
      if (button) button.remove();
      window.PronMark.toggle({ shown:true });
      setTimeout(() => { const b = document.getElementById('pmToggle'); if (b) b.addEventListener('click', () => remember(b.getAttribute('aria-pressed') === 'true')); }, 50);
    });
  }
  function init() {
    if (!selector() || !list().length) return;   /* nothing to mark on this page (yet: see below) */
    if (document.getElementById('pmStart') || document.getElementById('pmToggle')) return;
    const b = document.createElement('button');
    b.id = 'pmStart'; b.type = 'button'; b.className = 'grammar-toggle-btn'; b.style.marginRight = '6px';
    b.textContent = '🎵 Show pronunciation marks';
    b.addEventListener('click', () => { b.disabled = true; b.textContent = '🎵 Loading…'; remember(true);
      start(b).catch(err => { b.disabled = false; b.textContent = '🎵 ' + err.message; }); });
    const g = document.getElementById('grammarToggle');
    if (g) g.parentNode.insertBefore(b, g);
    else { const sub = document.querySelector('.page h1 ~ .subtitle') || document.querySelector('.page h1'); if (sub) sub.insertAdjacentElement('afterend', b); else return; }
    let on = false; try { on = localStorage.getItem(STORE) === '1'; } catch (e) {}
    if (on) { b.disabled = true; start(b).catch(() => { b.disabled = false; }); }
  }
  /* pages draw themselves with scripts: wait for that, and look again in case the first look found nothing */
  function boot() { setTimeout(init, 0); setTimeout(init, 800); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  function audit() {
    const rows = [...document.querySelectorAll(selector() || 'nothing')].map(el => ({ text:textOf(el).slice(0, 60), marked:!!el._pm, why:wanted(el) ? '' : 'excluded' }));
    if (console.table) console.table(rows);
    return { file:FILE, profile:E.profile, selector:selector(), rows };
  }
  window.PronAdapter = { COMPONENTS, PROFILES, LESSONS, FIXES, audit, scan };
})();
