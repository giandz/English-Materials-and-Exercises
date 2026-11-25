/* ══════════════════════════════════════════════════════════════════════════
   house-vocab.js — vocabulary activities for the house style.

     HouseScale       word scales: put words in order on a colour line
                      (freezing → cold → cool → warm → hot)
     HouseCollocate   collocation forks: which words go with this word?
                      (do ✔ / make ✘ + homework)
     HouseWordFamily  word family grid: noun / verb / adjective / adverb,
                      then use one form in a sentence
     HouseSort        sort words into groups
     HouseListen      listen, then tap what you heard
     HouseGrid        a yes / no table: can ✓ / can’t ✗, has got / hasn’t got
     HouseLabel       label a picture: words to the boxes beside it
     HouseMystery     mystery word: a ❓ hides the same word in three clues;
                      fewer clues = more ⭐

   Load it after house.js:   <script src="house-vocab.js"></script>
   It injects its own CSS, built from the house tokens and components (cards like the error
   hunt's, chips like the matching cards, the gap fill's accuracy bar); no font of its own,
   every size in rem — pages need no styles.
   Tap-to-hear works through HouseSpeak: finished words get data-say.

   ── HouseScale.build({ container, items, scoreEl, totalEl })
     item: { title, low:{ label, icon }, high:{ label, icon },
             words:['freezing','cold','cool','warm','hot'],   // the right order, low → high
             hues:[210, 0],                                   // optional; default [0, 120] red → green
             note:'…' }                                       // optional; shown when the scale is done
     Drag a word onto a place on the line, or tap a word then tap a place.
     Right place: the word locks in that place's colour. Wrong: it shakes and goes back.

   ── HouseCollocate.build({ container, items, scoreEl, totalEl })
     item: { word:'homework', icon:'📚', side:'before',       // 'before': options come before the word (do homework)
                                                              // 'after':  options come after it (depend on)
             options:[{ text:'do', ok:true }, { text:'make', ok:false, why:'We <b>do</b> homework.' }, …] }
     Tap every option that goes with the word. Right: the branch turns green and the phrase is
     added to the list. Wrong: the branch turns red and the `why` is shown.

   ── HouseWordFamily.build({ container, columns, items, scoreEl, totalEl, title, note })
     columns: optional, default ['noun','verb','adj','adverb'] (POS colours);
              also 'person' (noun colour) and 'opposite' (adjective colour)
     item: { forms:{ noun:'success', verb:'succeed', adj:'successful', adverb:'successfully' },
             given:'noun',                 // or ['noun','adj']; default: the first form
             use:{ template:'She passed the test {0}.', accepted:['successfully'] } }   // optional
     labels: optional { column: 'Header' } for columns of your own (e.g. { num:'Number', ord:'1st, 2nd…' });
     pos:    optional { column: 'noun' | 'verb' | 'adj' | 'adverb' | 'prep' | 'det' } — the colour of a column of your own.
     A form may list alternatives with '/' ('happiness'), or be null for "no word" (shown as —).
     Inputs correct themselves as you type (bar 🔴→🟢), like HouseGapFill. When the row is
     complete, the `use` sentence appears. A family scores when everything in it is done.

   ── HouseSort.build({ container, items, scoreEl, totalEl })
     item: { title, groups:[{ label:'Metal', icon:'🪙' }, …],
             words:[['gold', 0], ['cotton', 1, 'Cotton comes from a plant — it’s a fabric.'], …],   // [word, group index, why if wrong]
             note:'…' }                                       // optional; shown when every word is in its group
     Drag a word into a group, or tap a word then tap a group. Right: it stays there.
     Wrong: it shakes and goes back (and the why, if there is one, is shown). One point for each item sorted.

   ── HouseListen.build({ container, items, scoreEl, totalEl, title, hint })
     item: { say:'thirteen', options:['13','30'], correct:0, note:'thir<b>TEEN</b>' }   // note: optional, shown when right
     Tap 🔊 to hear it (HouseSpeak, or the browser's voice), then tap what you heard.
     Right: green, and it says it again. Wrong: red and crossed out — try again. One point for each item.

   ── HouseGrid.build({ container, items, scoreEl, totalEl })
     item: { title, yes:'can', no:'can’t', pronoun:'It',
             cols:[{ icon:'🕊️', label:'fly' }, …],                       // label = the words after yes / no
             rows:[{ icon:'🐧', label:'penguin', subject:'A penguin',
                     cells:[0, 1, null, …],                              // 1 yes · 0 no · null not asked
                     why:{ 0:'Penguins have wings, but they can’t fly.' } }, …],   // optional, shown on a wrong answer
             note:'…' }
     Every cell has ✓ and ✗. Right: it stays (green ✓ or red ✗). Wrong: it shakes and the why is shown.
     A finished row writes its sentence under the table: “A penguin can swim. It can’t fly or run fast.”
     One point for each row.

   ── HouseLabel.build({ container, items, scoreEl, totalEl })
     item: { title, svg:'<svg viewBox="0 0 200 400">…</svg>', w:200, h:400, width:'15rem',
             spots:[{ x:100, y:30, word:'head', side:'left' }, …] }       // x, y in the svg's units
     A label box on each side of the picture, joined to its dot by a line. Drag a word to a box (or to its
     dot), or tap a word and then tap a box. Right: the word stays. One point for each picture.

   ── HouseMystery.build({ container, items, points, scoreEl, totalEl })
     item: { answer:'oven' | ['oven','ovens'], pic:'🔥',
             clues:['Mom put the cake in the ❓.', …],         // ❓ marks the word; first clue shown at the start
             options:['oven','fridge','sink','table'],        // optional: buttons instead of typing (A1)
             note:'…' }                                       // optional; shown when solved
     points: optional, default [3, 2, 1] — ⭐ for solving after 1, 2, 3 clues.
     A wrong guess shakes and opens the next clue (so it costs a ⭐); 👀 Show me appears after the last clue.
     The score is ⭐ won; the total is the most ⭐ possible.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var STYLE_ID = 'house-vocab-css';
  var POS = { noun: 'noun', verb: 'verb', adj: 'adj', adverb: 'adverb', person: 'noun', prep: 'prep', opposite: 'adj', det: 'det', time: 'time' };
  var POS_HEX = { noun: '#ea580c', verb: '#f59e0b', adj: '#c026d3', adverb: '#0891b2', prep: '#65a30d', det: '#6366f1', time: '#0d9488' };
  function posVars(c) { var k = POS[c] || 'det'; return '--hv-pos:var(--pos-' + k + ',' + (POS_HEX[k] || '#6366f1') + ');--hv-pos-bg:var(--pos-' + k + '-bg,color-mix(in srgb,' + (POS_HEX[k] || '#6366f1') + ' 14%,transparent))'; }
  var LABEL = { noun: 'Noun', verb: 'Verb', adj: 'Adjective', adverb: 'Adverb', person: 'Person', prep: 'Preposition', opposite: 'Opposite' };

  /* Styled with the house tokens and the house component language (house.css):
     cards like .eh2-item / .ccq-card, chips like .match-card, inputs and the accuracy bar
     like HouseGapFill, the done line like .win-msg. No font of its own: it inherits the page's
     (--font-sans). Every size is in rem, so the 🔎 slider scales it. Light and dark come from
     the tokens alone — no theme selectors here. Fallback values only matter without house.css. */
  var CSS = ''
    + '.hv-card{ position:relative; background:var(--surface-2,#fff); border:.5px solid var(--color-border-tertiary,#ebebee); border-radius:var(--border-radius-lg,12px); padding:12px 14px; margin:0 0 12px; font-family:inherit; color:var(--text-primary,#1a1a1a); transition:background .15s, border-color .15s; }'
    + '.hv-card.hv-complete{ border-color:var(--good,#2f7d3a); }'
    + '.hv-title{ font-size:.95rem; font-weight:600; margin:0 0 .5rem; color:var(--text-primary,#1a1a1a); }'
    + '.hv-hint{ font-size:.8333rem; color:var(--text-secondary,#5b5b60); margin:0 0 .6rem; }'
    + '.hv-done{ display:none; margin-top:.7rem; text-align:center; font-size:.9333rem; font-weight:600; color:var(--good,#2f7d3a); background:var(--good-bg,#e8f4ea); border:1px solid var(--color-border-success,#97c459); border-radius:var(--border-radius-md,8px); padding:7px 12px; }'
    + '.hv-complete > .hv-done{ display:block; }'
    /* chips: the matching-card look, as pills */
    + '.hv-chip{ display:inline-flex; align-items:center; justify-content:center; gap:.3em; min-height:2.5rem; padding:6px 14px; border-radius:999px; border:1.5px solid var(--color-border-secondary,#e3e3e6);'
    +   ' background:var(--surface-2,#fff); color:var(--text-primary,#1a1a1a); font-family:inherit; font-size:.9333rem; font-weight:500; line-height:1.2; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:none; transition:background .15s, border-color .15s; }'
    + '.hv-chip:hover{ background:var(--surface-1,#f7f7f8); border-color:var(--color-border-primary,#d4d4d8); }'
    + '.hv-chip:active{ transform:scale(.98); }'
    + '.hv-chip:focus-visible{ outline:2px solid var(--text-accent,#185fa5); outline-offset:2px; }'
    + '.hv-chip.hv-sel{ border-color:var(--text-accent,#185fa5); background:var(--color-background-info,#e6f1fb); color:var(--color-text-info,#0c447c); }'
    + '.hv-wrong{ border-color:var(--bad,#b0392f) !important; background:var(--bad-bg,#fbebe9) !important; color:var(--bad,#b0392f) !important; animation:hv-shake .3s; }'
    + '@keyframes hv-shake{ 0%,100%{ translate:0; } 25%{ translate:-5px; } 75%{ translate:5px; } }'
    + '@media (prefers-reduced-motion:reduce){ .hv-wrong{ animation:none; } }'
    + '.hv-ghost{ position:fixed; z-index:1200; pointer-events:none; transform:translate(-50%,-50%) scale(1.05); box-shadow:0 8px 20px rgba(0,0,0,.18); }'
    + '.hv-ghost-src{ opacity:.35; }'
    /* ── HouseScale ── */
    + '.hv-scale-ends{ display:flex; justify-content:space-between; align-items:center; gap:1rem; font-size:.8rem; font-weight:500; color:var(--text-secondary,#5b5b60); margin-bottom:4px; }'
    + '.hv-scale-ends .hv-end-icon{ font-size:1.4rem; line-height:1; vertical-align:middle; margin:0 .25em; }'
    + '.hv-scale-bar{ position:relative; height:6px; border-radius:3px; margin:0 .6rem 8px 0; }'
    + '.hv-scale-bar::after{ content:""; position:absolute; right:-.55rem; top:50%; translate:0 -50%; border:.45rem solid transparent; border-left:.6rem solid var(--hv-end); border-right:0; }'
    + '.hv-slots{ display:grid; gap:6px; }'
    + '.hv-slot{ min-height:3rem; border-radius:var(--border-radius-md,8px); border:1.5px dashed hsl(var(--h) 55% 55%); background:hsl(var(--h) 70% 50% / .07); display:flex; align-items:center; justify-content:center; padding:3px; transition:background .15s, border-color .15s; }'
    + '.hv-slot.hv-over{ background:hsl(var(--h) 70% 50% / .22); border-style:solid; }'
    + '.hv-slot.hv-filled{ border-style:solid; }'
    + '.hv-slot .hv-chip{ width:100%; min-height:2.3rem; padding:4px 6px; font-size:.8667rem; white-space:normal; text-align:center; line-height:1.15; }'
    + '.hv-chip.hv-lock{ cursor:pointer; touch-action:auto; font-weight:600; border-color:hsl(var(--h) 60% 45%); background:hsl(var(--h) 75% 50% / .16);'
    +   ' color:color-mix(in srgb, hsl(var(--h) 70% 40%) 70%, var(--color-text-primary,#1a1a1a)); }'
    + '.hv-tray{ display:flex; flex-wrap:wrap; gap:6px; justify-content:center; min-height:2.8rem; margin-top:10px; padding:7px; border-radius:14px; background:color-mix(in srgb, var(--color-text-primary,#1a1a1a) 4%, transparent); }'
    + '.hv-tray:empty{ display:none; }'
    + '.hv-end-bottom{ display:none; justify-content:flex-end; margin:6px 0 0; }'
    + '@media (max-width:560px){ .hv-slots.hv-long{ grid-template-columns:minmax(0,1fr) !important; } .hv-slots.hv-long .hv-slot{ min-height:2.6rem; }'
    +   ' .hv-scale-bar.hv-long, .hv-long-ends .hv-end-hi{ display:none; } .hv-end-bottom{ display:flex; } }'
    /* ── HouseCollocate ── */
    + '.hv-fork{ position:relative; display:grid; grid-template-columns:minmax(0,auto) clamp(2.5rem,12vw,7rem) auto; justify-content:center; align-items:center; }'
    + '.hv-fork.hv-after{ grid-template-columns:auto clamp(2.5rem,12vw,7rem) minmax(0,auto); }'
    + '.hv-fork svg{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }'
    + '.hv-opts{ display:flex; flex-direction:column; gap:7px; align-items:flex-end; position:relative; z-index:1; }'
    + '.hv-after .hv-opts{ align-items:flex-start; grid-column:3; grid-row:1; }'
    + '.hv-after .hv-hub{ grid-column:1; grid-row:1; }'
    + '.hv-hub{ position:relative; z-index:1; grid-column:3; display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 14px; border-radius:var(--border-radius-lg,12px);'
    +   ' border:1.5px solid var(--color-border-info,#85b7eb); background:var(--color-background-info,#e6f1fb); color:var(--color-text-info,#0c447c); font-weight:600; font-size:1.0667rem; text-align:center; cursor:pointer; }'
    + '.hv-hub .hv-hub-icon{ font-size:1.8rem; line-height:1; }'
    + '.hv-opt.hv-ok{ border-color:var(--good,#2f7d3a); background:var(--good-bg,#e8f4ea); color:var(--good,#2f7d3a); font-weight:600; cursor:default; }'
    + '.hv-opt.hv-no{ border-color:var(--bad,#b0392f); background:var(--bad-bg,#fbebe9); color:var(--bad,#b0392f); text-decoration:line-through; cursor:default; }'
    + '.hv-opt.hv-ok::after{ content:"✓"; margin-left:.35em; } .hv-opt.hv-no::after{ content:"✗"; margin-left:.35em; display:inline-block; text-decoration:none; }'
    + '.hv-line{ fill:none; stroke:var(--color-border-primary,#d4d4d8); stroke-width:2; stroke-dasharray:5 5; }'
    + '.hv-line.hv-ok{ stroke:var(--good,#2f7d3a); stroke-dasharray:none; }'
    + '.hv-line.hv-no{ stroke:var(--bad,#b0392f); opacity:.5; }'
    + '.hv-found{ display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; min-height:1.6rem; align-items:center; }'
    + '.hv-found .hv-count{ font-size:.8rem; color:var(--text-muted,#8b8b90); margin-right:2px; }'
    + '.hv-phrase{ font-size:.8667rem; font-weight:600; padding:3px 11px; border-radius:20px; background:var(--bg-pos,#eaf3de); color:var(--text-pos,#27500a); cursor:pointer; }'
    + '.hv-why{ font-size:.8rem; line-height:1.55; margin-top:6px; min-height:0; color:var(--color-text-danger,#791f1f); }'
    + '.hv-why:not(:empty){ background:var(--color-background-danger,#fcebeb); border-radius:var(--border-radius-md,8px); padding:6px 10px; }'
    /* ── HouseSort ── */
    + '.hv-bins{ display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr)); gap:8px; }'
    + '.hv-bin{ --h:210; min-height:6.5rem; border-radius:var(--border-radius-md,8px); border:1.5px dashed hsl(var(--h) 55% 55%); background:hsl(var(--h) 70% 50% / .07); padding:6px; display:flex; flex-direction:column; gap:5px; transition:background .15s, border-color .15s; cursor:pointer; }'
    + '.hv-bin.hv-over{ background:hsl(var(--h) 70% 50% / .22); border-style:solid; }'
    + '.hv-bin-head{ display:flex; align-items:center; justify-content:center; gap:.35em; font-size:.8667rem; font-weight:700; color:color-mix(in srgb, hsl(var(--h) 70% 38%) 75%, var(--color-text-primary,#1a1a1a)); text-align:center; line-height:1.2; padding:2px 0 4px; }'
    + '.hv-bin-head .hv-bin-icon{ font-size:1.4rem; line-height:1; }'
    + '.hv-bin-body{ display:flex; flex-wrap:wrap; gap:5px; justify-content:center; }'
    + '.hv-bin .hv-chip{ min-height:2.1rem; padding:3px 10px; font-size:.8667rem; }'
    /* ── HouseGrid ── */
    + '.hv-grid-wrap{ overflow-x:auto; margin:0 -4px; padding:0 4px; }'
    + '.hv-grid{ border-collapse:separate; border-spacing:4px; margin:0 auto; }'
    + '.hv-grid th{ font-size:.7667rem; font-weight:600; color:var(--text-secondary,#5b5b60); text-align:center; vertical-align:bottom; padding:2px; line-height:1.2; }'
    + '.hv-grid th .hv-gicon{ display:block; font-size:1.5rem; line-height:1.1; }'
    + '.hv-grid th.hv-rowh{ text-align:left; white-space:nowrap; font-size:.8667rem; color:var(--text-primary,#1a1a1a); vertical-align:middle; }'
    + '.hv-grid th.hv-rowh .hv-gicon{ display:inline; font-size:1.4rem; margin-right:.3em; vertical-align:middle; }'
    + '.hv-grid tr.hv-row-done th.hv-rowh{ color:var(--good,#2f7d3a); }'
    + '.hv-cell{ text-align:center; vertical-align:middle; min-width:2.7rem; padding:3px; border-radius:var(--border-radius-md,8px); background:var(--surface-1,#f7f7f8); }'
    + '.hv-cell.hv-skip{ background:none; color:var(--text-muted,#8b8b90); }'
    + '.hv-yn{ display:flex; flex-direction:column; gap:3px; align-items:center; }'
    + '.hv-yn button{ width:2.2rem; height:1.7rem; padding:0; border-radius:999px; font-size:.85rem; line-height:1; cursor:pointer; font-family:inherit; border:1.5px solid var(--color-border-secondary,#e3e3e6); background:var(--surface-2,#fff); color:var(--text-primary,#1a1a1a); }'
    + '.hv-yn button:hover{ border-color:var(--text-accent,#185fa5); }'
    + '.hv-cell.hv-set-yes{ background:var(--good-bg,#e8f4ea); } .hv-cell.hv-set-no{ background:var(--bad-bg,#fbebe9); }'
    + '.hv-mark{ font-size:1.3rem; line-height:1; font-weight:700; } .hv-set-yes .hv-mark{ color:var(--good,#2f7d3a); } .hv-set-no .hv-mark{ color:var(--bad,#b0392f); }'
    + '.hv-sents{ list-style:none; margin:10px 0 0; padding:0; display:flex; flex-direction:column; gap:4px; }'
    + '.hv-sents li{ font-size:.9rem; padding:5px 10px; border-radius:var(--border-radius-md,8px); background:var(--bg-pos,#eaf3de); color:var(--text-pos,#27500a); cursor:pointer; animation:hv-pop .25s ease; }'
    + '.hv-sents li b{ font-weight:700; }'
    /* ── HouseLabel ── */
    + '.hv-lab{ position:relative; display:grid; grid-template-columns:minmax(4.5rem,8rem) minmax(0,var(--hv-w,15rem)) minmax(4.5rem,8rem); justify-content:center; column-gap:clamp(.8rem,4vw,2rem); }'
    + '.hv-lab-pic{ position:relative; grid-column:2; border-radius:var(--border-radius-lg,12px); background:var(--surface-1,#f7f7f8); }'
    + '.hv-lab-pic > svg{ display:block; width:100%; height:auto; }'
    + '.hv-lab-col{ position:relative; }'
    + '.hv-lab-col.hv-l{ grid-column:1; grid-row:1; } .hv-lab-col.hv-r{ grid-column:3; grid-row:1; }'
    + '.hv-box{ position:absolute; left:0; right:0; transform:translateY(-50%); min-height:1.9rem; display:flex; align-items:center; justify-content:center; border-radius:999px; border:1.5px dashed var(--color-border-primary,#d4d4d8); background:var(--surface-2,#fff); font-size:.8667rem; font-weight:600; padding:2px 6px; cursor:pointer; text-align:center; line-height:1.1; z-index:1; transition:background .15s, border-color .15s; }'
    + '.hv-box.hv-over{ border-color:var(--text-accent,#185fa5); background:var(--color-background-info,#e6f1fb); border-style:solid; }'
    + '.hv-box.hv-filled{ border-style:solid; border-color:var(--good,#2f7d3a); background:var(--good-bg,#e8f4ea); color:var(--good,#2f7d3a); cursor:pointer; }'
    + '.hv-lab-lines{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; z-index:0; }'
    + '.hv-lab-lines line{ stroke:var(--color-border-primary,#d4d4d8); stroke-width:1.5; stroke-dasharray:4 4; }'
    + '.hv-lab-lines line.hv-ok{ stroke:var(--good,#2f7d3a); stroke-dasharray:none; }'
    + '.hv-lab-lines circle{ fill:var(--text-accent,#185fa5); stroke:var(--surface-2,#fff); stroke-width:1.5; }'
    + '.hv-lab-lines circle.hv-ok{ fill:var(--good,#2f7d3a); }'
    + '.hv-dot{ position:absolute; width:1.6rem; height:1.6rem; transform:translate(-50%,-50%); border-radius:50%; cursor:pointer; z-index:2; }'
    /* ── HouseListen ── */
    + '.hv-listen{ display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr)); gap:8px; }'
    + '.hv-lrow{ display:flex; align-items:center; gap:7px; flex-wrap:wrap; padding:7px 9px; border-radius:var(--border-radius-md,8px); border:.5px solid var(--color-border-tertiary,#ebebee); background:var(--surface-1,#f7f7f8); transition:background .15s, border-color .15s; }'
    + '.hv-lrow.hv-row-done{ border-color:var(--good,#2f7d3a); background:var(--good-bg,#e8f4ea); }'
    + '.hv-lnum{ font-size:.7667rem; font-weight:600; color:var(--text-muted,#8b8b90); min-width:1.2em; }'
    + '.hv-play{ width:2.5rem; height:2.5rem; padding:0; border-radius:50%; font-size:1.15rem; line-height:1; border:1.5px solid var(--text-accent,#185fa5); background:var(--color-background-info,#e6f1fb); color:var(--color-text-info,#0c447c); cursor:pointer; flex-shrink:0; }'
    + '.hv-play.is-speaking{ animation:hv-pulse .6s ease-in-out infinite alternate; }'
    + '@keyframes hv-pulse{ to{ transform:scale(1.12); } }'
    + '.hv-lrow .hv-chip{ min-height:2.3rem; padding:4px 12px; }'
    + '.hv-lnote{ flex-basis:100%; font-size:.8rem; color:var(--good,#2f7d3a); padding-left:3.2rem; }'
    + '.hv-lnote:empty{ display:none; }'
    /* ── HouseWordFamily ── */
    + '.hv-wf-wrap{ overflow-x:auto; }'
    + '.hv-wf{ width:100%; border-collapse:separate; border-spacing:6px; table-layout:fixed; min-width:30rem; margin:-6px; }'
    + '.hv-wf th{ font-size:.7667rem; font-weight:600; padding:3px 6px; border-radius:20px; text-align:center; color:var(--hv-pos); background:var(--hv-pos-bg); }'
    + '.hv-wf td{ vertical-align:top; text-align:center; }'
    + '.hv-given{ display:block; padding:6px 4px; border-radius:var(--border-radius-md,8px); font-size:.9333rem; font-weight:600; border:1.5px solid var(--hv-pos); color:var(--hv-pos); background:var(--hv-pos-bg); cursor:pointer; overflow-wrap:anywhere; }'
    + '.hv-none{ display:block; padding:6px; color:var(--text-muted,#8b8b90); font-weight:600; }'
    + '.hv-in{ width:100%; font-family:inherit; font-size:.9667rem; padding:5px 8px; border-radius:6px; border:1px solid var(--color-border-secondary,#e3e3e6); background:var(--color-background-primary,#fff); color:var(--text-primary,#1a1a1a); text-align:center; outline:none; transition:border-color .12s linear, background .12s linear, color .12s linear; }'
    + '.hv-in:focus{ border-color:var(--text-accent,#185fa5); }'
    + '.hv-in.hv-ok{ border-color:var(--good,#2f7d3a); background:var(--good-bg,#e8f4ea); color:var(--good,#2f7d3a); font-weight:600; }'
    /* the accuracy bar, as HouseGapFill draws it */
    + '.hv-card .bar-track{ display:block; height:5px; margin:3px 2px 0; background:var(--color-border-secondary,#e3e3e6); border-radius:3px; overflow:hidden; }'
    + '.hv-card .bar-fill{ display:block; height:100%; width:0%; background:hsl(0deg 100% 40%); transition:width .12s linear, background .12s linear; }'
    + '.hv-use{ display:none; text-align:left !important; padding:2px 4px 6px !important; font-size:.9667rem; line-height:2.1; }'
    + '.hv-use.hv-show{ display:table-cell; }'
    + '.hv-use .hv-in{ min-width:6em; }'
    + '.hv-use-label{ font-size:.7667rem; font-weight:600; color:var(--text-muted,#8b8b90); margin-right:6px; }'
    + '.hv-row-tick{ width:1.6rem; font-size:1rem; vertical-align:middle !important; }'
    /* ── HouseMystery ── */
    + '.hv-myst-head{ display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; }'
    + '.hv-myst-head .hv-title{ margin:0; }'
    + '.hv-stars{ font-size:1.1rem; letter-spacing:.08em; white-space:nowrap; }'
    + '.hv-stars .hv-lost{ filter:grayscale(1); opacity:.3; }'
    + '.hv-clues{ list-style:none; margin:0 0 10px; padding:0; display:flex; flex-direction:column; gap:6px; }'
    + '.hv-clues li{ background:var(--surface-1,#f7f7f8); border:1px solid var(--border,#ebebee); border-radius:var(--border-radius-md,8px); padding:7px 11px; font-size:.9333rem; line-height:1.6; animation:hv-pop .25s ease; }'
    + '.hv-clues li .hv-n{ font-size:.7333rem; font-weight:600; color:var(--text-muted,#8b8b90); margin-right:6px; }'
    + '@keyframes hv-pop{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }'
    + '.hv-q{ display:inline-block; padding:0 .2em; border-radius:5px; background:var(--bg-q,#fdf1da); color:var(--text-q,#8a5a10); }'
    + '.hv-q.hv-solved{ background:var(--good-bg,#e8f4ea); color:var(--good,#2f7d3a); font-weight:600; padding:0 .3em; }'
    + '.hv-guess{ display:flex; flex-wrap:wrap; gap:7px; align-items:center; }'
    + '.hv-guess .hv-in{ flex:1 1 10rem; width:auto; text-align:left; }'
    + '.hv-btn.hv-main{ background:var(--text-accent,#185fa5); border-color:var(--text-accent,#185fa5); color:#fff; font-weight:600; }'
    + '.hv-btn:disabled{ opacity:.5; cursor:default; }'
    + '.hv-btn.hv-no{ border-color:var(--bad,#b0392f); background:var(--bad-bg,#fbebe9); color:var(--bad,#b0392f); text-decoration:line-through; opacity:1; }'
    + '.hv-myst-tools{ display:flex; flex-wrap:wrap; gap:7px; margin-top:8px; }'
    + '.hv-reveal{ display:none; align-items:center; gap:10px; margin-top:8px; font-size:.9333rem; color:var(--text-secondary,#5b5b60); }'
    + '.hv-complete .hv-reveal{ display:flex; }'
    + '.hv-reveal .hv-big{ font-size:2rem; line-height:1; }'
    + '.hv-reveal b{ font-size:1.0667rem; color:var(--good,#2f7d3a); cursor:pointer; }'
    + '.hv-complete .hv-guess, .hv-complete .hv-myst-tools{ display:none; }'
    /* buttons without house.css: the house pill */
    + '.hv-card button.hv-btn{ font-family:inherit; font-size:.8667rem; font-weight:500; padding:6px 13px; border-radius:999px; border:1px solid var(--border,#ebebee); background:var(--surface-1,#f7f7f8); color:var(--text-primary,#1a1a1a); cursor:pointer; }'
    + '.hv-card button.hv-btn.hv-main{ background:var(--text-accent,#185fa5); border-color:var(--text-accent,#185fa5); color:#fff; font-weight:600; }'
    + '.hv-card button.hv-btn.hv-no{ border-color:var(--bad,#b0392f); background:var(--bad-bg,#fbebe9); color:var(--bad,#b0392f); }';

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function $(x) { return typeof x === 'string' ? document.getElementById(x) : x; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim(); }
  function list(x) { return (Array.isArray(x) ? x : String(x).split('/')).map(function (s) { return String(s).trim(); }).filter(Boolean); }
  function shuffle(a, avoidSame) {
    var b = a.slice();
    for (var t = 0; t < 8; t++) {
      for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var k = b[i]; b[i] = b[j]; b[j] = k; }
      if (!avoidSame || b.length < 2 || b.some(function (v, i) { return v !== a[i]; })) break;
    }
    return b;
  }
  function flashWrong() {
    Array.prototype.forEach.call(arguments, function (n) {
      if (!n) return;
      n.classList.remove('hv-wrong'); void n.offsetWidth; n.classList.add('hv-wrong');
      setTimeout(function () { n.classList.remove('hv-wrong'); }, 600);
    });
  }
  function hueAt(i, n, from, to) { return n < 2 ? from : Math.round(from + (to - from) * i / (n - 1)); }
  function counter(scoreEl, totalEl, total) {
    var s = $(scoreEl), t = $(totalEl), n = 0;
    if (t) t.textContent = total;
    if (s) s.textContent = 0;
    return { add: function (k) { n += (k == null ? 1 : k); if (s) s.textContent = n; return n; }, get: function () { return n; } };
  }
  function bar(input, accepted) {
    var v = norm(input.value), best = 0;
    accepted.forEach(function (a) {
      a = norm(a); var i = 0;
      while (i < v.length && i < a.length && v[i] === a[i]) i++;
      var r = v.length > a.length ? i / v.length : i / a.length;
      if (v.length > i) r *= 0.6;
      if (r > best) best = r;
    });
    return best;
  }
  /* the same accuracy as the gap fill (Damerau-Levenshtein), when house.js is there */
  function accuracy(value, accepted) {
    var v = String(value || '').trim();
    if (!v) return 0;
    if (global.HouseGapFill && global.HouseGapFill.bestAccuracy) return global.HouseGapFill.bestAccuracy(v, accepted) / 100;
    return bar({ value: v }, accepted);
  }
  function isAccepted(value, accepted) {
    var v = norm(value);
    return accepted.some(function (a) { return norm(a) === v; });
  }

  /* drag OR tap for chips. onDrop(chip, targetEl|null) / onTap(chip) */
  function draggable(chip, opts) {
    var start = null, ghost = null, over = null;
    function targetAt(x, y) {
      var e = document.elementFromPoint(x, y);
      return e && e.closest ? e.closest(opts.targetSel) : null;
    }
    function setOver(t) { if (over === t) return; if (over) over.classList.remove('hv-over'); over = t; if (over) over.classList.add('hv-over'); }
    function cleanup() {
      if (ghost) { ghost.remove(); ghost = null; }
      chip.classList.remove('hv-ghost-src');
      setOver(null); start = null;
      window.removeEventListener('blur', cleanup);
      if (opts.state) opts.state.dragging = false;
    }
    chip.addEventListener('pointerdown', function (e) {
      if (chip.classList.contains('hv-lock') || e.button > 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try { chip.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      window.addEventListener('blur', cleanup);
    });
    chip.addEventListener('pointermove', function (e) {
      if (!start) return;
      if (!ghost) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
        ghost = chip.cloneNode(true); ghost.classList.add('hv-ghost'); ghost.classList.remove('hv-sel');
        ghost.style.width = chip.offsetWidth + 'px';
        document.body.appendChild(ghost); chip.classList.add('hv-ghost-src');
        if (opts.state) opts.state.dragging = true;
      }
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      setOver(targetAt(e.clientX, e.clientY));
      e.preventDefault();
    });
    chip.addEventListener('pointerup', function (e) {
      if (!start) return;
      var wasDrag = !!ghost, t = wasDrag ? targetAt(e.clientX, e.clientY) : null;
      cleanup();
      if (wasDrag) opts.onDrop(chip, t); else opts.onTap(chip);
    });
    chip.addEventListener('pointercancel', cleanup);
    chip.addEventListener('lostpointercapture', function () { if (ghost) cleanup(); });
    chip.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onTap(chip); } });
  }

  /* ══ HouseScale ═══════════════════════════════════════════════════════ */
  function buildScale(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [], sc = counter(o.scoreEl, o.totalEl, items.length);
    box.innerHTML = '';
    items.forEach(function (it) {
      var n = it.words.length, hs = it.hues || [0, 120], long = n > 5;
      var hue = function (i) { return hueAt(i, n, hs[0], hs[1]); };
      var card = el('div', 'hv-card hv-scale');
      var end = function (e, right) { if (!e) return ''; var ic = e.icon ? '<span class="hv-end-icon">' + e.icon + '</span>' : ''; return right ? esc(e.label || '') + ic : ic + esc(e.label || ''); };
      var grad = it.words.map(function (_, i) { return 'hsl(' + hue(i) + ',70%,50%)'; }).join(',');
      card.innerHTML = (it.title ? '<div class="hv-title">' + it.title + '</div>' : '') +
        '<div class="hv-scale-ends' + (long ? ' hv-long-ends' : '') + '"><span>' + end(it.low) + '</span><span class="hv-end-hi">' + end(it.high, true) + '</span></div>' +
        '<div class="hv-scale-bar' + (long ? ' hv-long' : '') + '" style="background:linear-gradient(90deg,' + grad + ');--hv-end:hsl(' + hue(n - 1) + ',70%,50%)"></div>';
      var slots = el('div', 'hv-slots' + (long ? ' hv-long' : ''));
      slots.style.gridTemplateColumns = 'repeat(' + n + ',minmax(0,1fr))';
      it.words.forEach(function (_, i) { var s = el('div', 'hv-slot'); s.dataset.i = i; s.style.setProperty('--h', hue(i)); s.setAttribute('aria-label', 'place ' + (i + 1)); slots.appendChild(s); });
      var tray = el('div', 'hv-tray'), done = el('div', 'hv-done', '✓ ' + (it.note || 'Well done — the scale is in order!'));
      card.appendChild(slots);
      if (long) card.appendChild(el('div', 'hv-scale-ends hv-end-bottom', '<span>' + end(it.high, true) + '</span>'));
      card.appendChild(tray); card.appendChild(done);
      box.appendChild(card);

      var sel = null, placed = 0, state = {};
      function select(c) { if (sel) sel.classList.remove('hv-sel'); sel = (sel === c) ? null : c; if (sel) sel.classList.add('hv-sel'); }
      function tryPlace(chip, slot) {
        if (!slot || slot.classList.contains('hv-filled')) return;
        var i = +slot.dataset.i;
        if (chip.dataset.w === it.words[i]) {
          if (sel) { sel.classList.remove('hv-sel'); sel = null; }
          chip.classList.add('hv-lock'); chip.style.setProperty('--h', hue(i));
          chip.dataset.say = chip.dataset.w; chip.removeAttribute('tabindex');
          slot.appendChild(chip); slot.classList.add('hv-filled');
          if (++placed === n) { card.classList.add('hv-complete'); sc.add(); }
        } else {
          if (sel) { sel.classList.remove('hv-sel'); sel = null; }   /* pick again after a wrong place */
          flashWrong(chip, slot);
        }
      }
      shuffle(it.words, true).forEach(function (w) {
        var c = el('button', 'hv-chip', esc(w)); c.type = 'button'; c.dataset.w = w;
        draggable(c, { targetSel: '.hv-slot', state: state,
          onDrop: function (chip, t) { if (t && slots.contains(t)) tryPlace(chip, t); },
          onTap: function (chip) { if (!chip.classList.contains('hv-lock')) select(chip); } });
        tray.appendChild(c);
      });
      slots.addEventListener('click', function (e) {
        var s = e.target.closest('.hv-slot'); if (!s || !sel || state.dragging) return;
        tryPlace(sel, s);
      });
    });
  }

  /* ══ HouseCollocate ═══════════════════════════════════════════════════ */
  function buildCollocate(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [], sc = counter(o.scoreEl, o.totalEl, items.length);
    box.innerHTML = '';
    items.forEach(function (it) {
      var after = it.side === 'after', need = it.options.filter(function (x) { return x.ok; }).length, got = 0;
      var phrase = function (op) { return op.phrase || (after ? it.word + ' ' + op.text : op.text + ' ' + it.word); };
      var card = el('div', 'hv-card hv-coll');
      card.innerHTML = (it.title ? '<div class="hv-title">' + it.title + '</div>' : '') +
        '<div class="hv-hint">Which words go with <b>' + esc(it.word) + '</b>? Tap all the right ones (' + need + ').</div>';
      var fork = el('div', 'hv-fork' + (after ? ' hv-after' : ''));
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      var opts = el('div', 'hv-opts');
      var hub = el('div', 'hv-hub', (it.icon ? '<span class="hv-hub-icon">' + it.icon + '</span>' : '') + '<span>' + esc(it.word) + '</span>');
      hub.dataset.say = it.word;
      fork.appendChild(svg); fork.appendChild(opts); fork.appendChild(hub);
      var found = el('div', 'hv-found', '<span class="hv-count">0 / ' + need + '</span>');
      var why = el('div', 'hv-why');
      var done = el('div', 'hv-done', '✓ ' + (it.note || 'You found them all!'));
      card.appendChild(fork); card.appendChild(found); card.appendChild(why); card.appendChild(done);
      box.appendChild(card);

      var lines = [];
      shuffle(it.options, true).forEach(function (op) {
        var c = el('button', 'hv-chip hv-opt', esc(op.text)); c.type = 'button';
        opts.appendChild(c);
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('class', 'hv-line'); svg.appendChild(path);
        lines.push({ chip: c, path: path });
        c.addEventListener('click', function () {
          if (c.classList.contains('hv-ok') || c.classList.contains('hv-no')) return;
          if (op.ok) {
            c.classList.add('hv-ok'); path.setAttribute('class', 'hv-line hv-ok'); why.innerHTML = '';
            var p = el('span', 'hv-phrase', esc(phrase(op))); p.dataset.say = phrase(op); found.appendChild(p);
            got++; found.firstChild.textContent = got + ' / ' + need;
            if (got === need) { card.classList.add('hv-complete'); sc.add(); }
          } else {
            c.classList.add('hv-no'); path.setAttribute('class', 'hv-line hv-no');
            why.innerHTML = op.why ? '✘ ' + op.why : '✘ We don’t say “' + esc(phrase(op)) + '”.';
            flashWrong(c);
          }
        });
      });

      function draw() {
        var fr = fork.getBoundingClientRect(), hr = hub.getBoundingClientRect();
        if (!fr.width) return;
        var hx = (after ? hr.right : hr.left) - fr.left, hy = hr.top + hr.height / 2 - fr.top;
        lines.forEach(function (l) {
          var r = l.chip.getBoundingClientRect();
          var x = (after ? r.left : r.right) - fr.left, y = r.top + r.height / 2 - fr.top, dx = (hx - x) / 2;
          l.path.setAttribute('d', 'M' + x + ' ' + y + ' C' + (x + dx) + ' ' + y + ' ' + (hx - dx) + ' ' + hy + ' ' + hx + ' ' + hy);
        });
      }
      draw();
      if (global.ResizeObserver) { var ro = new ResizeObserver(draw); ro.observe(fork); }
      window.addEventListener('resize', draw);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    });
  }

  /* ══ HouseWordFamily ══════════════════════════════════════════════════ */
  function buildWordFamily(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [], cols = o.columns || ['noun', 'verb', 'adj', 'adverb'];
    var sc = counter(o.scoreEl, o.totalEl, items.length);
    var colLabel = function (c) { return (o.labels && o.labels[c]) || LABEL[c] || c; };
    var colVars = function (c) { return posVars(o.pos && o.pos[c] ? o.pos[c] : c); };
    box.innerHTML = '';
    var card = el('div', 'hv-card hv-wfam'), wrap = el('div', 'hv-wf-wrap'), table = el('table', 'hv-wf');
    var head = '<thead><tr>' + cols.map(function (c) { return '<th style="' + colVars(c) + '">' + colLabel(c) + '</th>'; }).join('') + '<th class="hv-row-tick" aria-label="done"></th></tr></thead>';
    table.innerHTML = head;
    var body = el('tbody');
    table.appendChild(body); wrap.appendChild(table); card.appendChild(wrap);
    if (o.title) card.insertBefore(el('div', 'hv-title', o.title), wrap);
    box.appendChild(card);
    var families = 0;

    function liveInput(accepted, onOk) {
      var cell = el('div'), inp = el('input', 'hv-in'), b = el('span', 'bar-track', '<span class="bar-fill"></span>');
      inp.type = 'text'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('autocapitalize', 'off');
      cell.appendChild(inp); cell.appendChild(b);
      inp.addEventListener('input', function () {
        if (inp.readOnly) return;
        if (isAccepted(inp.value, accepted)) {
          inp.value = accepted.filter(function (a) { return norm(a) === norm(inp.value); })[0];
          inp.readOnly = true; inp.classList.add('hv-ok'); inp.dataset.say = inp.value;
          b.firstChild.style.width = '100%'; b.firstChild.style.background = 'hsl(120deg 100% 40%)';
          onOk(inp);
        } else {
          var r = accuracy(inp.value, accepted); b.firstChild.style.width = Math.round(r * 100) + '%'; b.firstChild.style.background = 'hsl(' + Math.round(120 * r) + 'deg 100% 40%)';
        }
      });
      inp.addEventListener('click', function () { if (inp.readOnly && global.HouseSpeak) global.HouseSpeak.speak(inp.value, inp); });
      return { cell: cell, input: inp };
    }

    items.forEach(function (it) {
      var given = it.given ? list(it.given) : [cols.filter(function (c) { return it.forms[c]; })[0]];
      var tr = el('tr'), open = 0, ok = 0, tick = el('td', 'hv-row-tick');
      var useRow = null, useDone = !it.use;
      function check() {
        if (ok < open) return;
        if (useRow && !useRow.firstChild.classList.contains('hv-show')) { useRow.firstChild.classList.add('hv-show'); var f = useRow.querySelector('input'); if (f) f.focus(); }
        if (ok >= open && useDone && !tr.classList.contains('hv-row-done')) { tr.classList.add('hv-row-done'); tick.textContent = '✅'; if (++families === items.length) card.classList.add('hv-complete'); sc.add(); }
      }
      cols.forEach(function (c) {
        var td = el('td'), v = it.forms[c];
        td.setAttribute('style', colVars(c));
        if (v == null || v === '' || v === '—') { td.innerHTML = '<span class="hv-none" title="no word">—</span>'; }
        else if (given.indexOf(c) >= 0) { var g = el('span', 'hv-given', esc(list(v)[0])); g.dataset.say = list(v)[0]; td.appendChild(g); }
        else { open++; var li = liveInput(list(v), function () { ok++; check(); }); li.input.setAttribute('aria-label', colLabel(c).replace(/<[^>]+>/g, '') + ' of ' + list(it.forms[given[0]])[0]); td.appendChild(li.cell); }
        tr.appendChild(td);
      });
      tr.appendChild(tick);
      body.appendChild(tr);
      if (it.use) {
        useRow = el('tr', 'hv-use-row');
        var td = el('td', 'hv-use'); td.colSpan = cols.length + 1;
        var parts = it.use.template.split('{0}');
        var li = liveInput(list(it.use.accepted), function () { useDone = true; check(); });
        li.cell.style.display = 'inline-block'; li.cell.style.verticalAlign = 'middle';
        li.input.style.width = Math.max(list(it.use.accepted)[0].length * 0.75, 6) + 'em';
        td.appendChild(el('span', 'hv-use-label', '✍️ Use it:'));
        td.appendChild(document.createTextNode(parts[0]));
        td.appendChild(li.cell);
        td.appendChild(document.createTextNode(parts[1] || ''));
        useRow.appendChild(td); body.appendChild(useRow);
      }
      if (!open) check();
    });
    card.appendChild(el('div', 'hv-done', '✓ ' + (o.note || 'All the families are complete!')));
  }

  /* ══ HouseMystery ═════════════════════════════════════════════════════ */
  function buildMystery(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [], pts = o.points || [3, 2, 1];
    var max = Math.max.apply(null, pts), sc = counter(o.scoreEl, o.totalEl, items.length * max);
    box.innerHTML = '';
    items.forEach(function (it, k) {
      var answers = list(it.answer), shown = 1, solved = false;
      var card = el('div', 'hv-card hv-myst');
      var stars = el('span', 'hv-stars');
      var head = el('div', 'hv-myst-head', '<span class="hv-title" style="margin:0">❓ Mystery word ' + (items.length > 1 ? (k + 1) : '') + '</span>');
      head.appendChild(stars);
      var ul = el('ul', 'hv-clues');
      var guess = el('div', 'hv-guess'), tools = el('div', 'hv-myst-tools');
      var more = el('button', 'hv-btn', '🔎 Another clue'), show = el('button', 'hv-btn', '👀 Show me');
      more.type = show.type = 'button';
      tools.appendChild(more); tools.appendChild(show);
      var reveal = el('div', 'hv-reveal');
      card.appendChild(head); card.appendChild(ul); card.appendChild(guess); card.appendChild(tools); card.appendChild(reveal);
      if (it.note) card.appendChild(el('div', 'hv-done', it.note));
      box.appendChild(card);

      var clueHTML = function (t) { return esc(t).replace(/❓/g, '<span class="hv-q">❓</span>'); };
      function worth() { return pts[Math.min(shown, pts.length) - 1] || 0; }
      function paintStars() {
        var w = solved ? card.dataset.won | 0 : worth(), s = '';
        for (var i = 0; i < max; i++) s += i < w ? '⭐' : '<span class="hv-lost">⭐</span>';
        stars.innerHTML = s; stars.title = w + ' ⭐';
      }
      function addClue(i) { var li = el('li', null, '<span class="hv-n">' + (i + 1) + '</span>' + clueHTML(it.clues[i])); ul.appendChild(li); }
      function refresh() {
        more.disabled = shown >= it.clues.length;
        more.textContent = shown >= it.clues.length ? '🔎 No more clues' : '🔎 Another clue (−1 ⭐)';
        show.style.display = shown >= it.clues.length ? '' : 'none';
        paintStars();
      }
      function finish(won) {
        solved = true; card.dataset.won = won;
        for (var i = shown; i < it.clues.length; i++) addClue(i);
        shown = it.clues.length;
        ul.querySelectorAll('.hv-q').forEach(function (q) { q.textContent = answers[0]; q.classList.add('hv-solved'); });
        reveal.innerHTML = (it.pic ? '<span class="hv-big">' + it.pic + '</span>' : '') + '<b data-say="' + esc(answers[0]) + '">' + esc(answers[0]) + '</b>' +
          '<span>' + (won ? '+' + won + ' ⭐' : 'Next time!') + '</span>';
        card.classList.add('hv-complete');
        if (won) sc.add(won);
        paintStars();
      }
      function tryGuess(value, node) {
        if (solved) return;
        if (isAccepted(value, answers)) finish(worth());
        else {
          flashWrong(node);
          if (node && node.tagName === 'BUTTON') { node.disabled = true; node.classList.add('hv-no'); }
          if (shown < it.clues.length) { addClue(shown++); refresh(); }   /* a wrong guess costs a clue */
        }
      }

      if (it.options) {
        shuffle(it.options, false).forEach(function (op) {
          var b = el('button', 'hv-btn', esc(op)); b.type = 'button';
          b.addEventListener('click', function () { tryGuess(op, b); });
          guess.appendChild(b);
        });
      } else {
        var inp = el('input', 'hv-in'), go = el('button', 'hv-btn hv-main', 'Guess');
        inp.type = 'text'; inp.placeholder = 'Type the word…'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('autocapitalize', 'off');
        inp.setAttribute('aria-label', 'Your guess'); go.type = 'button';
        guess.appendChild(inp); guess.appendChild(go);
        var submit = function () { if (!norm(inp.value)) return; tryGuess(inp.value, inp); if (!solved) inp.select(); };
        go.addEventListener('click', submit);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      }
      more.addEventListener('click', function () { if (shown < it.clues.length) { addClue(shown++); refresh(); } });
      show.addEventListener('click', function () { finish(0); });
      addClue(0); refresh();
    });
  }


  /* ══ HouseSort ════════════════════════════════════════════════════════ */
  function buildSort(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [], sc = counter(o.scoreEl, o.totalEl, items.length);
    var HUES = [210, 30, 140, 280, 0, 180, 60];
    box.innerHTML = '';
    items.forEach(function (it) {
      var card = el('div', 'hv-card hv-sort'), bins = el('div', 'hv-bins'), tray = el('div', 'hv-tray'), why = el('div', 'hv-why');
      if (it.title) card.appendChild(el('div', 'hv-title', it.title));
      it.groups.forEach(function (g, i) {
        var b = el('div', 'hv-bin'); b.dataset.g = i; b.style.setProperty('--h', g.hue != null ? g.hue : HUES[i % HUES.length]);
        b.innerHTML = '<div class="hv-bin-head">' + (g.icon ? '<span class="hv-bin-icon">' + g.icon + '</span>' : '') + '<span>' + g.label + '</span></div><div class="hv-bin-body"></div>';
        b.setAttribute('aria-label', String(g.label).replace(/<[^>]+>/g, ''));
        bins.appendChild(b);
      });
      card.appendChild(bins); card.appendChild(tray); card.appendChild(why);
      card.appendChild(el('div', 'hv-done', '✓ ' + (it.note || 'Well done — every word is in its group!')));
      box.appendChild(card);
      var sel = null, placed = 0, state = {};
      function select(c) { if (sel) sel.classList.remove('hv-sel'); sel = (sel === c) ? null : c; if (sel) sel.classList.add('hv-sel'); }
      function tryPlace(chip, bin) {
        if (!bin) return;
        var w = it.words[+chip.dataset.k];
        if (sel) { sel.classList.remove('hv-sel'); sel = null; }
        if (+bin.dataset.g === w[1]) {
          chip.classList.add('hv-lock'); chip.style.setProperty('--h', bin.style.getPropertyValue('--h'));
          chip.dataset.say = w[0]; chip.removeAttribute('tabindex');
          bin.querySelector('.hv-bin-body').appendChild(chip); why.innerHTML = '';
          if (++placed === it.words.length) { card.classList.add('hv-complete'); sc.add(); }
        } else {
          flashWrong(chip, bin);
          why.innerHTML = w[2] || '';
        }
      }
      shuffle(it.words.map(function (w, k) { return k; }), true).forEach(function (k) {
        var c = el('button', 'hv-chip', esc(it.words[k][0])); c.type = 'button'; c.dataset.k = k; c.dataset.w = it.words[k][0];
        draggable(c, { targetSel: '.hv-bin', state: state,
          onDrop: function (chip, t) { if (t && bins.contains(t)) tryPlace(chip, t); },
          onTap: function (chip) { if (!chip.classList.contains('hv-lock')) select(chip); } });
        tray.appendChild(c);
      });
      bins.addEventListener('click', function (e) {
        var b = e.target.closest('.hv-bin'); if (!b || !sel || state.dragging) return;
        tryPlace(sel, b);
      });
    });
  }

  /* ══ HouseListen ══════════════════════════════════════════════════════ */
  function speak(text, btn) {
    try {
      if (global.HouseSpeak && global.HouseSpeak.speak) return global.HouseSpeak.speak(text, btn);
      if (global.speechSynthesis) { var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); }
    } catch (e) { /* no speech */ }
  }
  function buildListen(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [], sc = counter(o.scoreEl, o.totalEl, items.length);
    box.innerHTML = '';
    var card = el('div', 'hv-card hv-lcard'), grid = el('div', 'hv-listen'), done = 0;
    if (o.title) card.appendChild(el('div', 'hv-title', o.title));
    if (o.hint) card.appendChild(el('div', 'hv-hint', o.hint));
    card.appendChild(grid);
    card.appendChild(el('div', 'hv-done', '✓ ' + (o.note || 'Great listening!')));
    box.appendChild(card);
    items.forEach(function (it, k) {
      var row = el('div', 'hv-lrow'), play = el('button', 'hv-play', '🔊'), note = el('div', 'hv-lnote');
      play.type = 'button'; play.setAttribute('aria-label', 'Listen to number ' + (k + 1));
      row.appendChild(el('span', 'hv-lnum', (k + 1) + '.'));
      row.appendChild(play);
      play.addEventListener('click', function () { speak(it.say, play); });
      it.options.forEach(function (op, i) {
        var c = el('button', 'hv-chip hv-opt', esc(op)); c.type = 'button';
        c.addEventListener('click', function () {
          if (row.classList.contains('hv-row-done') || c.classList.contains('hv-no')) return;
          if (i === it.correct) {
            c.classList.add('hv-ok'); row.classList.add('hv-row-done'); note.innerHTML = it.note || '';
            speak(it.say, play); sc.add();
            if (++done === items.length) card.classList.add('hv-complete');
          } else { c.classList.add('hv-no'); flashWrong(c); }
        });
        row.appendChild(c);
      });
      row.appendChild(note);
      grid.appendChild(row);
    });
  }


  /* ══ HouseGrid ════════════════════════════════════════════════════════ */
  function joinList(a, word) { return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' ' + word + ' ' + a[a.length - 1]; }
  function buildGrid(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [];
    var total = items.reduce(function (n, it) { return n + it.rows.length; }, 0), sc = counter(o.scoreEl, o.totalEl, total);
    box.innerHTML = '';
    items.forEach(function (it) {
      var yes = it.yes || 'can', no = it.no || 'can’t', pron = it.pronoun || 'It', rowsDone = 0;
      var card = el('div', 'hv-card hv-gridcard'), wrap = el('div', 'hv-grid-wrap'), t = el('table', 'hv-grid'), why = el('div', 'hv-why'), sents = el('ul', 'hv-sents');
      if (it.title) card.appendChild(el('div', 'hv-title', it.title));
      t.innerHTML = '<thead><tr><th></th>' + it.cols.map(function (c) { return '<th>' + (c.icon ? '<span class="hv-gicon">' + c.icon + '</span>' : '') + esc(c.label) + '</th>'; }).join('') + '</tr></thead>';
      var tb = el('tbody');
      it.rows.forEach(function (r) {
        var tr = el('tr'), left = 0;
        tr.innerHTML = '<th class="hv-rowh" data-say="' + esc(r.subject || r.label) + '">' + (r.icon ? '<span class="hv-gicon">' + r.icon + '</span>' : '') + esc(r.label) + '</th>';
        r.cells.forEach(function (v, c) {
          var td = el('td', 'hv-cell');
          if (v == null) { td.classList.add('hv-skip'); td.textContent = '—'; tr.appendChild(td); return; }
          left++;
          var yn = el('div', 'hv-yn'), by = el('button', null, '✓'), bn = el('button', null, '✗');
          by.type = bn.type = 'button';
          by.setAttribute('aria-label', (r.subject || r.label) + ' ' + yes + ' ' + it.cols[c].label);
          bn.setAttribute('aria-label', (r.subject || r.label) + ' ' + no + ' ' + it.cols[c].label);
          yn.appendChild(by); yn.appendChild(bn); td.appendChild(yn);
          var pick = function (ans, btn) {
            if (ans === !!v) {
              td.className = 'hv-cell ' + (v ? 'hv-set-yes' : 'hv-set-no');
              td.innerHTML = '<span class="hv-mark">' + (v ? '✓' : '✗') + '</span>';
              td.dataset.say = (r.subject || r.label) + ' ' + (v ? yes : no) + ' ' + it.cols[c].label + '.';
              why.innerHTML = '';
              if (--left === 0) {
                tr.classList.add('hv-row-done');
                var ys = [], ns = [];
                r.cells.forEach(function (x, k) { if (x === 1 || x === true) ys.push(it.cols[k].label); else if (x === 0 || x === false) ns.push(it.cols[k].label); });
                var s1 = ys.length ? (r.subject || r.label) + ' <b>' + yes + '</b> ' + joinList(ys, 'and') + '.' : '';
                var s2 = ns.length ? (ys.length ? pron : (r.subject || r.label)) + ' <b>' + no + '</b> ' + joinList(ns, 'or') + '.' : '';
                var li = el('li', null, (s1 + ' ' + s2).trim()); li.dataset.say = li.textContent; sents.appendChild(li);
                sc.add();
                if (++rowsDone === it.rows.length) card.classList.add('hv-complete');
              }
            } else {
              flashWrong(btn);
              why.innerHTML = (r.why && r.why[c]) || '';
            }
          };
          by.addEventListener('click', function () { pick(true, by); });
          bn.addEventListener('click', function () { pick(false, bn); });
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t);
      card.appendChild(wrap); card.appendChild(why); card.appendChild(sents);
      card.appendChild(el('div', 'hv-done', '✓ ' + (it.note || 'The table is complete!')));
      box.appendChild(card);
    });
  }

  /* ══ HouseLabel ═══════════════════════════════════════════════════════ */
  function buildLabel(o) {
    injectStyles();
    var box = $(o.container), items = o.items || [], sc = counter(o.scoreEl, o.totalEl, items.length);
    box.innerHTML = '';
    items.forEach(function (it) {
      var card = el('div', 'hv-card hv-labcard'), lab = el('div', 'hv-lab'), pic = el('div', 'hv-lab-pic', it.svg);
      var colL = el('div', 'hv-lab-col hv-l'), colR = el('div', 'hv-lab-col hv-r'), tray = el('div', 'hv-tray');
      var lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); lines.setAttribute('class', 'hv-lab-lines');
      if (it.title) card.appendChild(el('div', 'hv-title', it.title));
      lab.style.setProperty('--hv-w', it.width || '15rem');
      lab.appendChild(colL); lab.appendChild(pic); lab.appendChild(colR); lab.appendChild(lines);
      card.appendChild(lab); card.appendChild(tray);
      card.appendChild(el('div', 'hv-done', '✓ ' + (it.note || 'Every label is in the right place!')));
      box.appendChild(card);
      var spots = it.spots.map(function (s, i) {
        var b = el('div', 'hv-box', '&nbsp;'); b.dataset.i = i; b.setAttribute('aria-label', 'label ' + (i + 1));
        (s.side === 'right' ? colR : colL).appendChild(b);
        var d = el('div', 'hv-dot'); d.dataset.i = i; d.style.left = (100 * s.x / it.w) + '%'; d.style.top = (100 * s.y / it.h) + '%'; pic.appendChild(d);
        var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'), c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('r', 5); lines.appendChild(ln); lines.appendChild(c);
        return { s: s, box: b, dot: d, line: ln, circle: c, done: false };
      });
      function layout() {
        var L = lab.getBoundingClientRect(), P = pic.getBoundingClientRect();
        if (!P.width) return;
        lines.setAttribute('viewBox', '0 0 ' + L.width + ' ' + L.height);
        spots.forEach(function (sp) {
          var py = P.top - L.top + P.height * sp.s.y / it.h, px = P.left - L.left + P.width * sp.s.x / it.w;
          sp.box.style.top = py + 'px';
          var B = sp.box.getBoundingClientRect(), bx = sp.s.side === 'right' ? B.left - L.left : B.right - L.left;
          sp.line.setAttribute('x1', bx); sp.line.setAttribute('y1', py); sp.line.setAttribute('x2', px); sp.line.setAttribute('y2', py);
          sp.circle.setAttribute('cx', px); sp.circle.setAttribute('cy', py);
        });
      }
      var sel = null, placed = 0, state = {};
      function select(c) { if (sel) sel.classList.remove('hv-sel'); sel = (sel === c) ? null : c; if (sel) sel.classList.add('hv-sel'); }
      function tryPlace(chip, target) {
        if (!target) return;
        var sp = spots[+target.dataset.i];
        if (sel) { sel.classList.remove('hv-sel'); sel = null; }
        if (sp.done) return;
        if (norm(chip.dataset.w) === norm(sp.s.word)) {
          sp.done = true; sp.box.classList.add('hv-filled'); sp.box.textContent = sp.s.word; sp.box.dataset.say = sp.s.word;
          sp.line.setAttribute('class', 'hv-ok'); sp.circle.setAttribute('class', 'hv-ok');
          chip.remove();
          if (++placed === spots.length) { card.classList.add('hv-complete'); sc.add(); }
        } else flashWrong(chip, sp.box);
      }
      shuffle(it.spots.map(function (s) { return s.word; }), true).forEach(function (w) {
        var c = el('button', 'hv-chip', esc(w)); c.type = 'button'; c.dataset.w = w;
        draggable(c, { targetSel: '.hv-box, .hv-dot', state: state,
          onDrop: function (chip, t) { if (t && lab.contains(t)) tryPlace(chip, t); },
          onTap: function (chip) { select(chip); } });
        tray.appendChild(c);
      });
      lab.addEventListener('click', function (e) {
        var t = e.target.closest('.hv-box, .hv-dot'); if (!t || !sel || state.dragging) return;
        tryPlace(sel, t);
      });
      layout();
      if (global.ResizeObserver) new ResizeObserver(layout).observe(lab);
      window.addEventListener('resize', layout);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    });
  }

  global.HouseScale = { build: buildScale };
  global.HouseGrid = { build: buildGrid };
  global.HouseLabel = { build: buildLabel };
  global.HouseSort = { build: buildSort };
  global.HouseListen = { build: buildListen };
  global.HouseCollocate = { build: buildCollocate };
  global.HouseWordFamily = { build: buildWordFamily };
  global.HouseMystery = { build: buildMystery };
})(window);
