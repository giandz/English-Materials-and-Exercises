/* ══════════════════════════════════════════════════════════════════════════
   HouseVN — visual-novel scenes acted by house characters: one scene, a list of lines, with
   questions that branch the conversation. Needs house-character.js loaded first, and house.js
   (HouseGapFill) for answers checked by closeness.

     const vn = HouseVN.create(hostElement, script);
     vn.next()      advance (or, while a line is being said, finish it at once)
     vn.back()      the line shown before this one (the way you came, through any branches)
     vn.restart()   the first line         vn.go(label | i)   jump to a line
     vn.index       the line shown now     vn.vars            answers saved so far
     vn.setAuto(on) auto-advance (also the ⏯️ Auto button or A): after each line, time to read, then the next
     vn.destroy()   stop it and empty the host
     HouseVN.addBackground(id, '<svg …>')   a backdrop for any scene on the page (or script.backgrounds: { id: svg })
     script.onLine = (i, line) => …          called as each line starts

   script = {
     background: 'classroom' | 'cafe' | 'park'   a built-in backdrop, or any CSS background value
     cast: { id: { name, color,                  name box colour (default: the text accent)
                   lang: 'en' | 'es', wpm: 150,  for the lip-sync (HouseCharacter.speech)
                   character: { … } } },         a house-character object (as saved by the poser)
     lines: [ { who: id, say: 'Hello!',
                at: 'left' | 'center' | 'right', shot: 'full' | 'medium' | 'closeup',
                pose: 'waving' | 'em_joy' | …,   any HouseCharacter.POSES or EMOTION_POSES id
                emotion: 'joy' | …,              a face only (HouseCharacter.EMOTIONS id, or 'neutral')
                look: { head:'right', … },       any other character fields
                stage: { otherId: { at, shot, pose, emotion, look } | null } } ] }
                                                  other characters entering, moving or (null) leaving

   Branching. Lines run in order unless one says otherwise:
     id: 'order'                          a label other lines can jump to
     goto: 'order'                        after this line, go there (a label or a line number)
     end: true                            the scene ends here (so does the last line)
   A question is asked by the line that carries it, once the line has been said:
     choices: [ { text:'Yes, please!', goto:'cakeYes' }, … ]
                                          buttons (keys 1–9); a choice without goto goes to the next line
     input: { placeholder:'Type your answer…',
              check: 'match' | 'closeness',
              branches: [ { rubric:'tea' | ['tea','a cup of tea', …], goto:'tea', min:75 }, … ],
              else: 'sorry',              where to go when no branch fits (without it: try again;
                                          with no branches at all, any answer goes to the next line)
              strict: false, min: 75 }    see below
     save: 'name'                         keep the answer (the typed text, or the choice's text) as {$name},
                                          to be used in any later line: say:"Nice to meet you, {$name}!"
   check 'match': a branch is taken when the answer is one of its rubrics. Case, extra spaces and the
     punctuation at the ends (. ! ? ¡ ¿ …) are ignored; strict:true compares exactly as typed.
   check 'closeness': each branch's score is how close the answer is to its nearest rubric, from 0 to 100,
     using HouseGapFill's Damerau-Levenshtein distance (100 − 100 × distance ÷ longer length, as in the
     gap fill). The branches whose score reaches their min (the input's min, 75 by default) qualify, and
     the closest wins; on a tie, the one with the higher min. So the same rubric can lead to different
     branches by closeness:  { rubric:'a coffee, please', min:95, goto:'perfect' },
                             { rubric:'a coffee, please', min:70, goto:'nearly' }

   Kinds of line (any line can also carry stage directions, questions and jumps):
     a line without who                   narration, in the text box with no name: "They sit down by the window."
     insert: true                         a caption over the backdrop, characters hidden for the moment:
                                          time passing or a new place ("Saturday morning. Rosa's café.")
     insert: 'black'                      the same on a black card ("Twenty years earlier…")
     think: true                          the speaker's thoughts: lips still, text in italics, 💭 by the name,
                                          and everything but the thinker turns grey
     shout: true                          the whole line is shouted: each letter shakes as it appears, then
                                          settles, and the speaker gives a jolt
     whisper: true                        the whole line is whispered, in smaller, softer letters
     Part of a line: "{shout}Hi, Ana!{/shout} Sorry I'm late." or "Shh! {whisper}He can hear you!{/whisper}".
     past: true                           a memory: the picture turns sepia, with a darker edge
   prosody: true | 'calm' | 'lively' | false
                                          the speaker's head and brows follow the line (on by default; at
                                          script or line level): a nod on stressed words, brows up and a head
                                          cock on yes/no questions, a slight frown on wh-questions, a blink as
                                          each sentence ends (HouseCharacter.prosody). Thoughts get only brows
                                          and blinks; narration and inserts none. Cast expressiveness:1.3 (or
                                          0.7) scales one character; shouting moves more, whispering less.
     "{stress}music{/stress}"            the main stress of its phrase goes there (contrast); not shown
   [words/pos] in a line: the house grammar colours, as on the lesson pages ("[She/subject] [is/verb] happy.").
     Inside a page with the 🎨 grammar toggle they show and hide with it (house.css .grammar-hidden).
   background: 'park'                     changes the backdrop from this line on (built-in or CSS), and like
                                          the cast it is put back as it was when going back.
   A character who leaves (stage: { id: null }) is remembered: bringing them back with stage: { id: {} }
   puts them where they were, in the same shot, pose and face.
   narration: { wpm:160, lang:'en' }      at script level: how fast narration and inserts appear

   Cues inside a line change the speaker's pose or face at that point of the line, as it is said:
     say: "Music? {pose:em_surprise} Wow! {emotion:joy} I love music."
   A cue is {pose:id}, {emotion:id} or both, {pose:em_joy emotion:sadness}. It is not shown or said, and
   it takes effect when the text reaches it (a click that finishes the line applies the rest at once).
   What a cue sets stays, like anything else a line sets.
   Stage cues bring other characters on or off at that point of the line, as it is said:
     say: "That's {spot:tom}my brother Tom, and {spot:lucy}my sister Lucy."
     {spot:id}                            id comes to the middle in a full shot (the spotlight); whoever had the
                                          spotlight before leaves. Add at:left|center|right or shot:… to place it
                                          elsewhere: {spot:tom at:left shot:medium}. Someone in the spotlight is
                                          never dimmed, so the one being talked about stays bright.
     {enter:id}                           id comes on (center, medium, unless at: and shot: say otherwise), or
                                          back where they were
     {leave:id}                           id goes off
   Like stage directions, they change who is on stage from then on (going back undoes them).

   Acting and resting. A line's at, shot, pose, emotion and cues are how the speaker acts it: once the
   line has been said, the speaker slowly goes back to their resting state. That state is where and how
   they first came on (their first line's at and shot, the cast character's own pose and face), and only
   stage directions change it: stage: { ana: { at:'left', shot:'closeup', pose:…, emotion:… } } moves
   Ana for good, including when she is the one speaking. look (clothes, held items…) always stays.
   The scene at any line is worked out by replaying the lines up to it, so going back always shows
   exactly what was there.
   Characters sharing a side stand a little apart; the speaker comes to the front and the others dim.
   Pose changes (between lines or from a cue) are animated: joints, turns and framing ease from the old
   posture to the new one, with the keyframe editor's easings (HouseCharacter.EASES / ease); with reduced
   motion they change at once. Both can be set for the whole scene and changed by any line:
     easing: 'quad'                       an easing id (linear, sine, quad, cubic, quart, quint, expo, circ,
                                          back, elastic, bounce) for both ends of the move: slow – fast – slow
     easing: { out:'cubic', in:'bounce' } the departure and the arrival separately, as in the editor
     moveTime: 0.45                       seconds a move takes
   A line's easing and moveTime apply to the moves it starts (its own and its cues'); the scene's are the default.
   The text appears letter by letter in step with the mouth (the words' timing from HouseCharacter.speech).
   A click, Space, Enter or 🔽 finishes the line if it is still being said, otherwise goes to the next one.
   ══════════════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';
const HC = global.HouseCharacter;
const FPS = 30;
const LIP = ['rest','mbp','ai','e','o','u','cdg','fv','l','wq'];
const REST = '@rest';   /* placeholder for "the speaker's resting mouth" in a speech track */
const AT = {left:22, center:50, right:78};
const SPREAD = 13;   /* % of the stage width between characters sharing a side */

const CSS = `
.vn{ --vn-box:28%; max-width:960px; margin:0 auto; user-select:none; -webkit-user-select:none; }
.vn-stage{ position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; border-radius:var(--radius, 12px);
  border:1px solid var(--border, #ddd); background:#cfd8dc; cursor:pointer; touch-action:manipulation; }
.vn-bg{ position:absolute; inset:0; }
.vn-cast{ position:absolute; inset:0; }   /* the characters' frame (a filter on it, for the past or thoughts, makes it their containing block) */
.vn-bg svg{ width:100%; height:100%; display:block; }
/* every shot stands on the top edge of the text box (a little behind it) and reaches near the top of the picture:
   full = the whole figure, medium = from the waist up, closeup = head and shoulders */
.vn-ch{ position:absolute; bottom:calc(var(--vn-box) - 7%); height:calc(100% - var(--vn-box) + 4%); transform:translateX(-50%); transition:left var(--vn-move, .45s) ease, height var(--vn-move, .45s) ease, bottom var(--vn-move, .45s) ease, opacity .35s ease, filter .3s ease; pointer-events:none; }
.vn-ch svg{ width:100%; height:100%; display:block; overflow:visible; }
.vn-ch.full{ bottom:calc(var(--vn-box) - 1%); height:calc(100% - var(--vn-box) - 3%); }
.vn-ch.dim{ filter:brightness(.72) saturate(.8); }
.vn-ch.out{ opacity:0; }
.vn-box{ position:absolute; z-index:100; left:3%; right:3%; bottom:3%; height:calc(var(--vn-box) - 3%); box-sizing:border-box; padding:2.4% 3% 2%;
  background:color-mix(in srgb, var(--surface-2, #fff) 96%, transparent); border:2px solid var(--text-accent, #185fa5);
  border-radius:14px; box-shadow:0 6px 18px rgba(0,0,0,.18); }
/* the name tab sits over the speaker's side: left, centre or right (data-at on the box) */
.vn-name{ position:absolute; left:4%; transform:translateX(0); bottom:calc(100% - 6px); padding:.15em .9em .2em; border-radius:9px 9px 0 0;
  white-space:nowrap; max-width:33.333%; box-sizing:border-box; overflow:hidden; text-overflow:ellipsis;   /* one line, as long as the name needs, up to a third of the box */
  font-weight:700; font-size:clamp(.8rem, 1.9vw, 1.05rem); color:#fff; background:var(--vn-name, var(--text-accent, #185fa5));
  display:grid; grid-template-columns:minmax(0, 1fr); width:max-content;   /* as wide as the name (up to the cap), wherever the tab stands */
  /* from one speaker to the next the tab slides over, its colour goes linearly from one speaker's to the other's,
     its width follows the name, and the two names crossfade on the way, all over the same time */
  transition:left var(--vn-tab, .45s) ease, transform var(--vn-tab, .45s) ease, background-color var(--vn-tab, .45s) linear, width var(--vn-tab, .45s) ease; }
.vn-name.none{ display:none; }
.vn-nm{ grid-area:1 / 1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:1; transition:opacity var(--vn-tab, .45s) linear; }
.vn-nm.fade{ opacity:0; }
.vn-text{ position:relative; font-size:clamp(.9rem, 2.3vw, 1.3rem); line-height:1.45; color:var(--text-primary, #1a1a1a); height:100%;
  overflow-y:auto; overscroll-behavior:contain; touch-action:pan-y; scrollbar-width:thin; padding-right:2.2em; box-sizing:border-box; }
.vn-text .hid{ visibility:hidden; }
.vn-next{ position:absolute; right:1.6%; bottom:6%; border:0; background:none; font-size:clamp(1rem, 2.4vw, 1.4rem); line-height:1;
  cursor:pointer; padding:2px; opacity:.35; transition:opacity .2s; }
.vn-next.ready{ opacity:1; animation:vn-bob 1s ease-in-out infinite; }
.vn-next.end{ opacity:.25; animation:none; cursor:default; }
/* kinds of line */
.vn-text{ white-space:pre-line; }
.vn-text .c.hid, .vn-insert-text .c.hid{ visibility:hidden; }
.vn-box.narrate .vn-text{ font-style:italic; color:var(--text-secondary, #555); }
.vn-box.think{ border-style:dashed; }
.vn-box.think .vn-text{ font-style:italic; }
.vn-text .w, .vn-insert-text .w{ display:inline-block; }
.c.l.sh{ display:inline-block; }
.c.l.sh.on{ animation:vn-shake-fade 1.4s linear both; }
.c.wh{ font-size:.76em; opacity:.78; letter-spacing:.01em; }
/* a grammar colour: one tint per word (and per space inside a phrase), square where a phrase goes on, rounded at its
   ends; untinted until its first letter shows; spaces get no halo, so they never paint over the word before them */
.vn .pw.pos-hl{ border-radius:0; } .vn .pw.pos-hl.hl-a{ border-radius:.22em 0 0 .22em; } .vn .pw.pos-hl.hl-z{ border-radius:0 .22em .22em 0; } .vn .pw.pos-hl.hl-a.hl-z{ border-radius:.22em; }
.vn .pw.pos-hl.pw-sp{ box-shadow:0 var(--hl-spread, .08em) 0 var(--hl-bg), 0 calc(-1 * var(--hl-spread, .08em)) 0 var(--hl-bg); margin:0 -.5px; padding:0 .5px; }   /* the halo only above and below; a hair of overlap closes the seams */
.vn .pw.hid{ background:transparent !important; box-shadow:none !important; }
@keyframes vn-shake-fade{ 0%{ transform:translate(0,0) rotate(0); }
  4%{ transform:translate(2.6px,-2px) rotate(-5deg); } 8%{ transform:translate(-2.6px,2px) rotate(5deg); }
  12%{ transform:translate(2.2px,1.6px) rotate(-4deg); } 17%{ transform:translate(-2px,-1.6px) rotate(3.5deg); }
  23%{ transform:translate(1.6px,-1.2px) rotate(-2.6deg); } 30%{ transform:translate(-1.3px,1px) rotate(2deg); }
  39%{ transform:translate(1px,.8px) rotate(-1.4deg); } 50%{ transform:translate(-.7px,-.6px) rotate(1deg); }
  63%{ transform:translate(.45px,.35px) rotate(-.6deg); } 79%{ transform:translate(-.2px,-.15px) rotate(.3deg); } 100%{ transform:none; } }
.vn-ch.quake{ animation:vn-quake 1s linear; }
@keyframes vn-quake{ 0%,100%{ transform:translateX(-50%); } 6%{ transform:translateX(calc(-50% - 6px)); } 13%{ transform:translateX(calc(-50% + 6px)); }
  21%{ transform:translateX(calc(-50% - 4.5px)); } 30%{ transform:translateX(calc(-50% + 3.5px)); } 41%{ transform:translateX(calc(-50% - 2.5px)); }
  54%{ transform:translateX(calc(-50% + 1.5px)); } 70%{ transform:translateX(calc(-50% - .8px)); } 85%{ transform:translateX(calc(-50% + .3px)); } }
/* thinking: everything but the thinker turns grey */
.vn-bg, .vn-cast{ transition:filter .4s ease, opacity .4s ease; }
.vn-stage.think .vn-bg{ filter:grayscale(1) brightness(.92); }
.vn-stage.think .vn-ch:not(.thinker){ filter:grayscale(1) brightness(.85); }
/* the past: sepia, with a darker edge */
.vn-stage.past .vn-bg, .vn-stage.past .vn-cast{ filter:sepia(.85) contrast(.95) brightness(1.03); }
.vn-stage.past.think .vn-bg{ filter:grayscale(1) sepia(.85) brightness(.95); }
.vn-stage::after{ content:''; position:absolute; inset:0; z-index:60; pointer-events:none; opacity:0; transition:opacity .4s ease;
  background:radial-gradient(ellipse at center, transparent 50%, rgba(70,42,12,.5) 100%); }
.vn-stage.past::after{ opacity:1; }
.vn-stage.past .vn-box{ background:color-mix(in srgb, var(--surface-2, #fff) 78%, #d9b77e); border-color:#8b6b3d; }
.vn-stage.past .vn-name{ filter:sepia(.8); }
.vn-box[data-at="center"] .vn-name{ left:50%; transform:translateX(-50%); }
.vn-box[data-at="right"] .vn-name{ left:96%; transform:translateX(-100%); }
/* inserts: a caption over the backdrop (characters hidden), or on a black card */
.vn-insert{ position:absolute; inset:0; z-index:130; display:flex; overflow-y:auto; align-items:center; justify-content:center; padding:8%;
  opacity:0; pointer-events:none; transition:opacity .4s ease; background:linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.55)); }
.vn-insert-text{ max-width:80%; text-align:center; color:#fff; font-family:var(--font-serif, Georgia, serif); font-style:italic;
  font-size:clamp(1.1rem, 3.6vw, 2.1rem); line-height:1.35; text-shadow:0 2px 10px rgba(0,0,0,.6); white-space:pre-line; }
.vn-stage.inserting .vn-insert{ opacity:1; }
.vn-stage.insert-black .vn-insert{ background:#111; }
.vn-stage.inserting .vn-cast, .vn-stage.inserting .vn-box{ opacity:0; pointer-events:none; }
.vn-box{ transition:opacity .35s ease; }
.vn-next.asking{ opacity:0; pointer-events:none; }
/* questions: choice buttons or an answer box, above the text box */
.vn-ask{ position:absolute; z-index:140; left:50%; transform:translateX(-50%); bottom:calc(var(--vn-box) + 2.5%); width:min(72%, 600px);
  display:flex; flex-direction:column; gap:.5em; cursor:default; animation:vn-in .25s ease; font-size:clamp(.85rem, 2.1vw, 1.1rem); }
.vn-choice{ display:flex; align-items:baseline; gap:.6em; text-align:left; font:inherit; padding:.55em .9em; border-radius:12px; cursor:pointer;
  border:2px solid var(--text-accent, #185fa5); color:var(--text-primary, #1a1a1a);
  background:color-mix(in srgb, var(--surface-2, #fff) 96%, transparent); box-shadow:0 4px 12px rgba(0,0,0,.18); }
.vn-choice:hover, .vn-choice:focus-visible{ background:var(--color-background-info, #e6f1fb); outline:none; }
.vn-key{ font-family:var(--font-mono, monospace); font-weight:700; font-size:.85em; color:var(--text-accent, #185fa5); }
.vn-input{ flex-direction:row; flex-wrap:wrap; align-items:center; padding:.6em; border-radius:14px; border:2px solid var(--text-accent, #185fa5);
  background:color-mix(in srgb, var(--surface-2, #fff) 96%, transparent); box-shadow:0 4px 12px rgba(0,0,0,.18); }
.vn-input input{ flex:1 1 10em; min-width:0; font:inherit; padding:.4em .65em; border:1px solid var(--color-border-primary, #ccc); border-radius:8px;
  background:var(--color-background-primary, #fff); color:var(--text-primary, #1a1a1a); user-select:text; -webkit-user-select:text; }
.vn-input button{ font:inherit; font-weight:600; padding:.4em .9em; border-radius:8px; cursor:pointer; }
.vn-msg{ flex:1 1 100%; font-size:.8em; color:var(--bad, #b0392f); min-height:1.2em; padding-left:.2em; }
.vn-msg:empty{ min-height:0; }
.vn-input.shake{ animation:vn-shake .3s; }
@keyframes vn-in{ from{ opacity:0; transform:translate(-50%, 8px); } to{ opacity:1; transform:translate(-50%, 0); } }
@keyframes vn-shake{ 0%,100%{ transform:translateX(-50%); } 25%{ transform:translateX(calc(-50% - 6px)); } 75%{ transform:translateX(calc(-50% + 6px)); } }
@keyframes vn-bob{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(4px); } }
/* narrow screens: a taller picture and text box, so two or three lines of text fit (longer lines scroll) */
@media (max-width:560px){ .vn{ --vn-box:31%; } .vn-stage{ aspect-ratio:4/3; } .vn-text{ font-size:.95rem; line-height:1.35; } .vn-box{ padding:2.2% 3% 1.6%; } }
@media (prefers-reduced-motion: reduce){ .vn-next.ready, .vn-ask, .vn-input.shake, .c.l.sh.on, .vn-ch.quake{ animation:none; } .vn-ch, .vn-bg, .vn-cast, .vn-insert, .vn-box{ transition:none; } }
.vn-bar{ display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; }
.vn-bar button[aria-pressed="true"]{ background:var(--color-background-info, #e6f1fb); border-color:var(--color-border-info, #85b7eb); }
.vn-bar button[aria-pressed="true"] .lb{ color:var(--color-text-info, #0c447c); }
.vn-bar button{ display:inline-flex; flex-direction:column; align-items:center; gap:1px; min-width:4.2rem; padding:5px 8px 4px; line-height:1; }
.vn-bar .ic{ font-size:1.3rem; }
.vn-bar .lb{ font-size:.6667rem; font-weight:600; color:var(--text-secondary, #555); }
.vn-count{ font-family:var(--font-mono, monospace); font-size:.8rem; color:var(--text-secondary, #555); min-width:4.5em; text-align:center; }
.vn-sr{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
`;
function injectCSS(){
  if(document.getElementById('house-vn-styles')) return;
  const st = document.createElement('style'); st.id = 'house-vn-styles'; st.textContent = CSS; document.head.appendChild(st);
}

/* ── built-in backdrops (1600 × 900) ── */
const BG = {
  classroom: `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="#e9e1cf"/><rect y="640" width="1600" height="260" fill="#b9946a"/><path d="M0,640H1600" stroke="#8a6a46" stroke-width="8"/>
    <rect x="430" y="150" width="740" height="330" rx="8" fill="#2f5a46" stroke="#7a5a36" stroke-width="18"/><path d="M500,240q60,-40 120,0t120,0M520,330h260M860,250h200M860,300h150" stroke="#e9efe9" stroke-opacity=".7" stroke-width="7" fill="none" stroke-linecap="round"/>
    <rect x="1290" y="140" width="220" height="300" fill="#bfe2f2" stroke="#fff" stroke-width="14"/><path d="M1400,140V440M1290,290H1510" stroke="#fff" stroke-width="10"/>
    <rect x="90" y="140" width="220" height="300" fill="#bfe2f2" stroke="#fff" stroke-width="14"/><path d="M200,140V440M90,290H310" stroke="#fff" stroke-width="10"/>
    <circle cx="800" cy="90" r="38" fill="#fff" stroke="#555" stroke-width="6"/><path d="M800,90V66M800,90h18" stroke="#333" stroke-width="5"/></svg>`,
  cafe: `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="#f1dcc0"/><rect width="1600" height="62" fill="#7a4a2a"/>
    <rect y="500" width="1600" height="400" fill="#b98557"/><g stroke="#9a6a40" stroke-width="3"><path d="M0,560H1600M0,635H1600M0,725H1600M0,835H1600"/><path d="M800,500V900M560,500L380,900M1040,500L1220,900M320,500L-40,900M1280,500L1640,900"/></g>
    <rect y="488" width="1600" height="16" fill="#7a4a2a"/>
    <rect x="110" y="130" width="300" height="190" rx="8" fill="#bfe2f2" stroke="#fff" stroke-width="12"/><path d="M260,130V320" stroke="#fff" stroke-width="8"/>
    <rect x="600" y="140" width="260" height="170" rx="10" fill="#3a3a3a" stroke="#6e4426" stroke-width="10"/><path d="M635,180h140M635,215h180M635,250h120M635,285h160" stroke="#f3e7c8" stroke-width="7" stroke-linecap="round"/>
    <g fill="#c96a3a"><circle cx="520" cy="100" r="24"/><circle cx="1240" cy="100" r="24"/></g><path d="M520,78V40M1240,78V40" stroke="#333" stroke-width="3"/>
    <rect x="1010" y="400" width="590" height="22" fill="#6e4426"/><rect x="1020" y="420" width="580" height="80" fill="#a8744a"/><path d="M1020,460H1600" stroke="#8a5a36" stroke-width="4"/>
    <g fill="#fff" stroke="#8a5a36" stroke-width="3"><rect x="1120" y="370" width="28" height="31" rx="5"/><rect x="1210" y="374" width="24" height="27" rx="5"/><rect x="1300" y="370" width="28" height="31" rx="5"/></g>
    <rect x="1060" y="250" width="440" height="14" fill="#7a4a2a"/><g fill="#d9a066" stroke="#7a4a2a" stroke-width="3"><rect x="1090" y="210" width="34" height="40" rx="4"/><rect x="1150" y="200" width="34" height="50" rx="4"/><rect x="1420" y="214" width="40" height="36" rx="4"/></g><circle cx="1300" cy="224" r="22" fill="#6aa86a" stroke="#3d6e3d" stroke-width="3"/>
    <g fill="#8a5a36"><rect x="150" y="470" width="190" height="14" rx="4"/><rect x="238" y="482" width="14" height="60"/><rect x="200" y="538" width="90" height="10" rx="4"/></g></svg>`,
  park: `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="vnsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec9f0"/><stop offset="1" stop-color="#d9f0fb"/></linearGradient></defs>
    <rect width="1600" height="900" fill="url(#vnsky)"/><circle cx="1360" cy="150" r="70" fill="#fff3b0"/><ellipse cx="380" cy="160" rx="120" ry="38" fill="#fff"/><ellipse cx="460" cy="140" rx="90" ry="34" fill="#fff"/>
    <path d="M0,560Q400,470 800,540T1600,520V900H0Z" fill="#8fcf72"/><path d="M0,650Q500,600 1000,660T1600,640V900H0Z" fill="#6fb658"/>
    <g fill="#6e4426"><rect x="210" y="330" width="34" height="260"/><rect x="1270" y="350" width="30" height="230"/></g><g fill="#3f9a4a"><circle cx="227" cy="300" r="120"/><circle cx="1285" cy="320" r="105"/></g>
    <path d="M560,700H1040M600,700V760M1000,700V760M560,660H1040" stroke="#8a5a36" stroke-width="16" stroke-linecap="round"/></svg>`
};

/* "Hi! {pose:em_joy} Nice to meet you." → {text:'Hi! Nice to meet you.', cues:[{at:4, pose:'em_joy'}]} */
/* "Hi! {pose:em_joy} {shout}Nice!{/shout}" →
     {text:'Hi! Nice!', cues:[{at:3, pose:'em_joy'}], spans:[{kind:'shout', from:4, to:9}]}
   Cues and {shout} / {whisper} tags are taken out of the text; a tag between two spaces leaves one.
   A tag left open runs to the end of the line. */
function parseCues(say){
  const raw = String(say || ''), cues = [], marks = [];
  let text = '', last = 0;
  for(const m of raw.matchAll(/\{([^{}]*)\}|\[([^\[\]\/]+)\/(\w+)\]/g)){
    if(m[2] !== undefined){   /* [words/pos]: the house grammar colours (shown or hidden by the page's 🎨 grammar toggle) */
      if(m.index < last) continue;
      text += raw.slice(last, m.index); last = m.index + m[0].length;
      marks.push({at:text.length, kind:'pos', open:true, pos:m[3]}); text += m[2]; marks.push({at:text.length, kind:'pos', open:false});
      continue;
    }
    const tag = m[1].trim().match(/^(\/?)(shout|whisper|stress)$/i), d = {};
    for(const [, k, v] of m[1].matchAll(/(pose|emotion|spot|enter|leave|at|shot)\s*[:=]\s*([\w-]+)/g)) d[k === 'at' ? 'place' : k] = v;
    if(!tag && !d.pose && !d.emotion && !d.spot && !d.enter && !d.leave) continue;   /* not a cue or a tag: leave it in the text */
    if(m.index < last) continue;
    text += raw.slice(last, m.index); last = m.index + m[0].length;
    const ws = raw.slice(last).match(/^\s+/);
    if(ws && /\s$/.test(text)) last += ws[0].length;   /* no double space where it was */
    if(tag) marks.push({at:text.length, kind:tag[2].toLowerCase(), open:!tag[1]});
    else cues.push({at:text.replace(/\s+$/, '').length, ...d});
  }
  text += raw.slice(last);
  const lead = text.length - text.replace(/^\s+/, '').length;   /* a cue or tag at the very start */
  text = text.trim();
  const fix = at => Math.max(0, Math.min(text.length, at - lead));
  const spans = [], open = {};
  for(const mk of marks){
    if(mk.kind === 'pos'){ if(mk.open) open.pos = {from:fix(mk.at), pos:mk.pos}; else if(open.pos){ spans.push({kind:'pos', pos:open.pos.pos, from:open.pos.from, to:fix(mk.at)}); open.pos = null; } continue; }
    if(mk.open){ if(open[mk.kind] == null) open[mk.kind] = fix(mk.at); }
    else if(open[mk.kind] != null){ spans.push({kind:mk.kind, from:open[mk.kind], to:fix(mk.at)}); open[mk.kind] = null; }
  }
  for(const k in open) if(open[k] != null && k !== 'pos') spans.push({kind:k, from:open[k], to:text.length});
  return {text, cues:cues.map(c => ({...c, at:fix(c.at)})), spans};
}

function face(data, id){
  if(!id) return;
  const all = [HC.NEUTRAL_FACE, ...HC.EMOTIONS.flatMap(g => g[1])], e = all.find(x => x[0] === id);
  if(e){ data.eyebrows = e[2]; data.eyes = e[3]; data.mouth = e[4]; }
}

function create(host, script){
  injectCSS();
  if(script.backgrounds) Object.assign(BG, script.backgrounds);   /* backdrops of its own, by name */
  const cast = script.cast || {}, lines = (script.lines || []).filter(l => l && (l.who == null || cast[l.who]));   /* no who: narration */
  host.innerHTML = '';
  const root = document.createElement('div'); root.className = 'vn';
  root.innerHTML = `<div class="vn-stage" tabindex="0" role="group" aria-label="Scene. Click, Space or Enter to go on.">
      <div class="vn-bg"></div><div class="vn-cast"></div><div class="vn-insert" aria-hidden="true"><div class="vn-insert-text"></div></div>
      <div class="vn-box"><div class="vn-name none"></div><div class="vn-text" aria-hidden="true"></div><div class="vn-sr" aria-live="polite"></div>
        <button type="button" class="vn-next" title="Next (Space, Enter or a click)" aria-label="Next">🔽</button></div></div>
    <div class="vn-bar">
      <button type="button" data-act="restart" title="Start again (Home)"><span class="ic" aria-hidden="true">⏮️</span><span class="lb">Start</span></button>
      <button type="button" data-act="back" title="The line before (←)"><span class="ic" aria-hidden="true">⏪</span><span class="lb">Back</span></button>
      <span class="vn-count" aria-live="off"></span>
      <button type="button" data-act="next" title="Next (Space, Enter or a click)"><span class="ic" aria-hidden="true">🔽</span><span class="lb">Next</span></button>
      <button type="button" data-act="auto" aria-pressed="false" title="Auto: go on by itself after each line, leaving time to read (A). It waits at questions."><span class="ic" aria-hidden="true">⏯️</span><span class="lb">Auto</span></button>
    </div>`;
  host.appendChild(root);
  const $ = c => root.querySelector(c);
  const stage = $('.vn-stage'), castEl = $('.vn-cast'), nameEl = $('.vn-name'), textEl = $('.vn-text'), srEl = $('.vn-sr'), nextEl = $('.vn-next'), countEl = $('.vn-count');
  let bgNow = null;
  function setBg(bg){
    if(bg === bgNow) return; bgNow = bg;
    const el = $('.vn-bg');
    if(BG[bg]){ el.innerHTML = BG[bg]; el.style.background = ''; } else { el.innerHTML = ''; el.style.background = bg; }
  }
  setBg(script.background || 'classroom');
  const insertEl = $('.vn-insert'), insertText = $('.vn-insert-text'), boxEl = $('.vn-box');

  const parsed = lines.map(L => parseCues(L.say));
  /* the scene at the start of the last line of path (the lines shown so far, in order): the lines before it,
     with all their cues, then its own directions. With branches, only the lines actually shown count. */
  /* the scene at the line that ends path (the lines shown so far, in order): every character in their resting
     state, then the speaker acting this line. The map holds what is shown; .rest holds the resting states. */
  const cloneC = c => ({at:c.at, shot:c.shot, spot:c.spot, data:JSON.parse(JSON.stringify(c.data))});
  function act(c, d){   /* a line's or a stage direction's settings, on a copy of c */
    if(d.at && AT[d.at] !== undefined) c.at = d.at;
    if(d.shot) c.shot = d.shot === 'mcu' ? 'closeup' : d.shot;
    if(d.pose) c.data = HC.applyPose(c.data, d.pose);
    face(c.data, d.emotion);
    if(d.look) c.data = HC.normalize({...c.data, ...d.look, joints:{...c.data.joints, ...(d.look.joints || {})}});
    return c;
  }
  const looked = (c, look) => { if(look) c.data = HC.normalize({...c.data, ...look, joints:{...c.data.joints, ...(look.joints || {})}}); return c; };
  /* a stage cue ({spot:id}, {enter:id}, {leave:id}) on the resting cast: rest (on stage) and off (left, remembered) */
  function stageCue(rest, off, q, speaker){
    const id = q.spot || q.enter || q.leave; if(!cast[id]) return;
    if(q.leave){ if(id !== speaker && rest.has(id)){ off.set(id, rest.get(id)); rest.delete(id); } return; }
    if(q.spot) for(const [o, c] of [...rest]) if(c.spot && o !== id && o !== speaker){ off.set(o, c); rest.delete(o); }
    let c = rest.get(id) || off.get(id);
    if(!c) c = {at:'center', shot:q.spot ? 'full' : 'medium', data:HC.normalize(cast[id].character || {})};
    if(q.spot){ c.at = 'center'; c.shot = 'full'; c.spot = true; }
    if(q.place && AT[q.place] !== undefined) c.at = q.place;
    if(q.shot) c.shot = q.shot === 'mcu' ? 'closeup' : q.shot;
    off.delete(id); rest.delete(id); rest.set(id, c);
  }
  const isStageCue = q => !!(q.spot || q.enter || q.leave);
  function sceneAt(path){
    const rest = new Map(), off = new Map();   /* off: characters who left, remembered for when they come back */
    let bg = script.background || 'classroom';
    const enter = (id, d) => {   /* on stage, or back: where they were, or where this line puts them */
      let c = rest.get(id) || off.get(id);
      if(!c) c = {at:'center', shot:'medium', data:HC.normalize(cast[id].character || {})};
      if(!rest.has(id)){ if(d.at && AT[d.at] !== undefined) c.at = d.at; if(d.shot) c.shot = d.shot === 'mcu' ? 'closeup' : d.shot; }
      off.delete(id); rest.delete(id); rest.set(id, c);   /* the last one to come on or move is drawn in front */
      return c;
    };
    path.forEach(j => {
      const L = lines[j];
      if(L.background) bg = L.background;
      for(const [id, d] of Object.entries(L.stage || {})){
        if(!cast[id]) continue;
        if(d === null){ if(rest.has(id)) off.set(id, rest.get(id)); rest.delete(id); continue; }
        const was = rest.has(id); act(enter(id, d || {}), was ? (d || {}) : {...(d || {}), at:null, shot:null});   /* stage directions change the resting state */
      }
      if(L.who != null && cast[L.who]) looked(enter(L.who, L), L.look);
      if(j !== path[path.length - 1]) for(const q of parsed[j].cues) if(isStageCue(q)) stageCue(rest, off, q, L.who);   /* the line being shown plays its own as it is said */
    });
    const on = new Map();
    for(const [id, c] of rest) on.set(id, cloneC(c));
    const last = lines[path[path.length - 1]];
    if(last && last.who != null && on.has(last.who)){ const c = on.get(last.who); act(c, {...last, look:null}); on.delete(last.who); on.set(last.who, c); }
    on.bg = bg; on.rest = rest; on.off = off;
    return on;
  }
  function applyCue(cue){   /* during a line: the speaker's pose or face changes on screen */
    if(isStageCue(cue)){   /* someone comes on or goes off: the resting cast changes, and the stage follows it */
      stageCue(scene.rest, scene.off, cue, talk.who);
      for(const id of [...scene.keys()]) if(!scene.rest.has(id) && id !== talk.who) scene.delete(id);
      for(const [id, c] of scene.rest) if(!scene.has(id)) scene.set(id, cloneC(c));
      const id = cue.spot || cue.enter;
      if(id && scene.has(id) && id !== talk.who){ const r = scene.rest.get(id), c = scene.get(id); c.at = r.at; c.shot = r.shot; c.spot = r.spot; }
      syncSprites();
      for(const [id, c] of scene) if(!sprites.has(id) || id === (cue.spot || cue.enter)) drawSprite(id, c);
      layout(scene, talk.insert ? null : talk.who);
      if(!cue.pose && !cue.emotion) return;
    }
    const c = talk.who != null && scene.get(talk.who); if(!c) return;
    if(cue.pose) c.data = HC.applyPose(c.data, cue.pose);
    face(c.data, cue.emotion);
    talk.rest = LIP.includes(c.data.mouth) ? 'rest' : c.data.mouth;   /* pauses now fall back to the new face */
    drawSprite(talk.who, c);
  }
  function runCues(upto){ while(talk.cue < talk.cues.length && talk.cues[talk.cue].at <= upto) applyCue(talk.cues[talk.cue++]); }

  /* ── one character's picture, cropped for its shot ── */
  /* the frame is sized for a person of average height in the same pose, so a child or a short person looks
     shorter than a tall one in the same shot (their head sits lower in the frame) */
  const cropCache = new Map();
  function crop(data, shot){
    const p = HC.pivots(data), nk = p.neck;
    const bottomOf = q => shot === 'closeup' ? q.neck.y + 46 : shot === 'medium' ? q.pelvis.y + 18 : HC.STAGE.ground + 14;
    let ref = p;
    if((data.height === undefined ? 3 : data.height) !== 3){
      const k = JSON.stringify(data.joints) + data.torsoOrientation + data.pelvisOrientation + data.bodyType + (data.lift || 0);
      if(!cropCache.has(k)){ if(cropCache.size > 200) cropCache.clear(); cropCache.set(k, HC.pivots({...data, height:3})); }
      ref = cropCache.get(k);
    }
    const h = bottomOf(ref) - (ref.neck.y - 122), bottom = bottomOf(p), top = bottom - h;
    const w = h * (shot === 'full' ? 0.62 : shot === 'medium' ? 0.86 : 1);
    return [nk.x - w / 2, top, w, h];
  }
  /* ── posture changes are animated: joint angles, turns and the framing move from the old pose to the new one
     with the scene's (or the line's) easing and move time, so nobody jumps from one posture to another.
     Face, hands, clothes and facing change at once. ── */
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* an easing setting → [out, in] ids the editor knows; anything else is linear */
  const easingOf = v => { const id = x => HC.easeId(x); return v && typeof v === 'object' ? [id(v.out), id(v.in)] : [id(v), id(v)]; };
  const SCENE_EASE = easingOf(script.easing || 'quad'), SCENE_TIME = Number(script.moveTime) >= 0 ? Number(script.moveTime) : 0.45;
  let motion = {ease:SCENE_EASE, time:SCENE_TIME};   /* for the moves of the line being shown */
  const wrap = v => ((v + 180) % 360 + 360) % 360 - 180;
  const TURNS = ['torsoOrientation', 'pelvisOrientation', 'headNod'];
  const numsOf = d => ({joints:{...d.joints}, turns:TURNS.map(k => d[k])});
  const sameNums = (a, b) => TURNS.every((k, i) => a.turns[i] === b.turns[i]) && Object.keys(b.joints).every(j => Math.round(a.joints[j]) === Math.round(b.joints[j]));
  /* which way each joint turns: HouseCharacter.jointDelta (shared with the keyframe editor) */
  const jointDelta = HC.jointDelta;
  function lerpNums(a, b, e){
    const joints = {};
    for(const j of Object.keys(b.joints)) joints[j] = wrap(a.joints[j]) + jointDelta(j, a.joints[j], b.joints[j]) * e;
    return {joints, turns:b.turns.map((v, i) => a.turns[i] + (v - a.turns[i]) * e)};
  }
  const lerpVB = (a, b, e) => b.map((v, i) => a[i] + (v - a[i]) * e);

  const sprites = new Map();   /* id → {el, key, data (target), shot, nums (on screen), vb (on screen), anim} */
  /* ── blinking: everyone on stage blinks now and then, speaking or not ──
     The time the eyes stay open and the time they stay shut are each drawn from a normal distribution (clipped to
     sensible limits). Talking makes people blink more often than listening; a face changes it too: wide, raised-brow
     surprise stares (fewer blinks), fear and worry blink more, sadness blinks slowly (longer closures), anger stares.
     A cast member's expressiveness (1 = normal) speeds or slows their blinking. Now and then (8%) a blink is
     doubled: a second one follows a moment later. Eyes that are already shut, happy or winking don't blink. */
  const BLINKABLE = ['open', 'wide', 'narrow'];
  const gauss = (mean, sd, lo, hi) => {   /* Box–Muller, clipped */
    let u = 0, v = 0; while(!u) u = Math.random(); while(!v) v = Math.random();
    return Math.max(lo, Math.min(hi, mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
  };
  function blinkMood(d){   /* [how much longer the eyes stay open, how much longer they stay shut] for this face */
    const b = d.eyebrows, e = d.eyes;
    if(e === 'wide' && b === 'raised') return [1.5, 0.9];   /* surprise, amazement: a stare */
    if(e === 'wide') return [0.65, 0.9];                    /* fear: quick, nervous blinks */
    if(b === 'sad' || e === 'sad') return [0.9, 1.35];      /* sadness: slow, heavy blinks */
    if(b === 'angry') return [1.35, 0.85];                  /* anger: a hard stare */
    if(b === 'raised') return [0.85, 1];                    /* interest, worry */
    if(e === 'narrow') return [1.15, 1.1];                  /* suspicion, boredom */
    return [1, 1];
  }
  function blinkLater(id, s, delay){
    clearTimeout(s.blinkTimer);
    s.blinkTimer = setTimeout(() => blinkNow(id, s, !!s.blinkSecond), delay);
  }
  function blinkNow(id, s, second){
    if(sprites.get(id) !== s) return;
    const [kOpen, kShut] = blinkMood(s.data), ex = Number(cast[id] && cast[id].expressiveness) > 0 ? Number(cast[id].expressiveness) : 1;
    const shut = gauss(0.15, 0.035, 0.08, 0.3) * kShut * 1000;
    s.blinking = true; if(!s.anim) paint(s, s.nums, s.vb);
    s.blinkTimer = setTimeout(() => {
      if(sprites.get(id) !== s) return;
      s.blinking = false; if(!s.anim) paint(s, s.nums, s.vb);
      if(!second && Math.random() < 0.08){ blinkLater(id, s, gauss(0.2, 0.05, 0.1, 0.35) * 1000); s.blinkSecond = true; return; }   /* a double blink */
      if(s.blinkSecond){ s.blinkSecond = false; }
      const speaking = !!(talk && talk.who === id && !talk.done);
      const mean = (speaking ? 2.8 : 4.2) * kOpen / Math.sqrt(ex), sd = mean * 0.35;
      blinkLater(id, s, gauss(mean, sd, 0.8, 10) * 1000);
    }, shut);
  }
  /* blinkNow is also how a double blink's second one runs: it knows from s.blinkSecond */
  const blinkStart = (id, s) => blinkLater(id, s, gauss(2.2, 1.2, 0.3, 6) * 1000);   /* everyone starts at a different moment */
  function paint(s, nums, vb){   /* draw the target character with these joint angles and this framing */
    const d = {...s.data, joints:nums.joints}; TURNS.forEach((k, i) => d[k] = nums.turns[i]);
    const P = s.pros;   /* the live prosody layer, on top of the pose (see "prosody") */
    if(P){
      if(P.nod) d.headNod = Math.max(-30, Math.min(30, (d.headNod || 0) + P.nod));
      if(P.tilt) d.joints = {...d.joints, neck:(d.joints.neck || 0) + P.tilt};
      if(P.brows && d.eyebrows === 'neutral') d.eyebrows = P.brows;
      if(P.blink && (d.eyes === 'open' || d.eyes === 'wide')) d.eyes = 'closed';
    }
    if(s.blinking && BLINKABLE.includes(d.eyes)) d.eyes = 'closed';   /* the everyday blink (see "blinking") */
    const key = JSON.stringify(d) + vb.map(v => v.toFixed(1)).join();
    if(key === s.key) return;
    s.el.style.aspectRatio = `${vb[2].toFixed(1)} / ${vb[3].toFixed(1)}`;
    s.el.innerHTML = HC.render(d).replace(/viewBox="[^"]*"/, `viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMax meet"`);
    s.key = key; s.nums = nums; s.vb = vb;
  }
  let animRaf = 0;
  function animate(now){
    animRaf = 0;
    for(const s of sprites.values()){
      const A = s.anim; if(!A) continue;
      const t = A.time > 0 ? Math.min(1, (now - A.t0) / 1000 / A.time) : 1, e = HC.ease(t, A.ease[0], A.ease[1]);
      paint(s, lerpNums(A.fromN, A.toN, e), lerpVB(A.fromV, A.toV, e));
      if(t >= 1) s.anim = null;
    }
    if([...sprites.values()].some(s => s.anim)) animRaf = requestAnimationFrame(animate);
  }
  function drawSprite(id, c){
    let s = sprites.get(id);
    const toN = numsOf(c.data), toV = crop(c.data, c.shot);
    if(!s){
      const el = document.createElement('div'); el.className = 'vn-ch out'; el.dataset.id = id; castEl.appendChild(el);
      s = {el, key:'', data:c.data}; sprites.set(id, s); blinkStart(id, s);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('out')));
      paint(s, toN, toV);   /* a character who comes in appears in their pose */
    } else {
      s.data = c.data;
      const goal = s.anim ? s.anim.toN : s.nums, goalV = s.anim ? s.anim.toV : s.vb;
      const moved = !sameNums(goal, toN) || goalV.some((v, i) => Math.abs(v - toV[i]) > 0.5);
      if(moved && !REDUCED && motion.time > 0){   /* start from wherever the character is right now, even in the middle of a move */
        s.anim = {fromN:s.nums, fromV:s.vb, toN, toV, t0:performance.now(), ease:motion.ease, time:motion.time};
        if(!animRaf) animRaf = requestAnimationFrame(animate);
      } else if(moved) paint(s, toN, toV);
      if(!s.anim) paint(s, s.nums, s.vb);   /* only the face or clothes changed (a mouth while talking): draw it now */
    }
    s.el.classList.remove('full', 'medium', 'closeup'); s.el.classList.add(c.shot);
  }
  /* ── the name tab: a new name crossfades with the old one while the tab slides and changes colour ── */
  const TAB = 0.45;
  root.style.setProperty('--vn-tab', (REDUCED ? 0 : TAB) + 's');
  let nameNow = '', nameTimer = 0;
  function setName(t){
    if(t === nameNow) return;
    const had = nameNow; nameNow = t;
    clearTimeout(nameTimer);
    const tidy = () => { nameEl.querySelectorAll('.vn-nm.fade').forEach(n => n.remove()); nameEl.style.width = ''; };
    if(!t){ nameEl.classList.add('none'); nameEl.innerHTML = ''; nameEl.style.width = ''; return; }
    const el = document.createElement('span'); el.className = 'vn-nm'; el.textContent = t;
    if(!had || REDUCED){ nameEl.innerHTML = ''; nameEl.appendChild(el); nameEl.classList.remove('none'); nameEl.style.width = ''; return; }   /* no one to change from: it simply appears */
    const w0 = nameEl.getBoundingClientRect().width, olds = [...nameEl.querySelectorAll('.vn-nm')];
    /* the width the new name needs (up to the cap): measured with the old names out of the grid for a moment
       (not display:none, which would cut their fade short) */
    el.classList.add('fade'); olds.forEach(n => n.style.position = 'absolute'); nameEl.style.width = ''; nameEl.appendChild(el);
    const w1 = nameEl.getBoundingClientRect().width;
    olds.forEach(n => { n.style.position = ''; n.classList.add('fade'); });
    nameEl.style.width = w0 + 'px';
    void nameEl.offsetWidth;   /* start from here */
    el.classList.remove('fade'); nameEl.style.width = w1 + 'px';
    nameTimer = setTimeout(tidy, TAB * 1000 + 60);
  }
  function syncSprites(){   /* whoever is no longer on stage fades out */
    for(const [id, s] of sprites) if(!scene.has(id)){ clearTimeout(s.blinkTimer); s.el.classList.add('out'); sprites.delete(id); setTimeout(() => s.el.remove(), 400); }
  }
  function layout(scene, speaker){
    const groups = {left:[], center:[], right:[]};
    for(const [id, c] of scene) groups[c.at].push(id);
    for(const [at, ids] of Object.entries(groups)) ids.forEach((id, k) => {
      const s = sprites.get(id); if(!s) return;
      s.el.style.left = (AT[at] + (k - (ids.length - 1) / 2) * SPREAD) + '%';
    });
    let z = 1;
    for(const id of scene.keys()){ const s = sprites.get(id); if(s && id !== speaker) s.el.style.zIndex = z++; }
    for(const [id, s] of sprites){
      if(id === speaker) s.el.style.zIndex = 50;
      s.el.classList.toggle('dim', !!speaker && id !== speaker && scene.has(id) && !(scene.get(id) || {}).spot);   /* the spotlight stays bright */
    }
  }

  /* ── prosody: the speaker's head and brows follow the line's stress and tune ──
     HouseCharacter.prosody reads the text (sentence types, stressed words, {stress} marks) and gives nods,
     head cocks, brow raises and blinks timed to the words; they are added on top of the pose while the line is
     said, and fade out with it. A click that finishes the line stops them at once. */
  const PROSODY = {calm:0.6, lively:1.4};
  let prosRaf = 0, pros = null;   /* {id, events, t0, end} */
  function stopProsody(){
    cancelAnimationFrame(prosRaf); prosRaf = 0;
    if(!pros) return;
    const s = sprites.get(pros.id); pros = null;
    if(s && s.pros){ s.pros = null; if(!s.anim) paint(s, s.nums, s.vb); }
  }
  function prosTick(now){
    prosRaf = 0; if(!pros) return;
    const s = sprites.get(pros.id), f = Math.max(0, now - pros.t0) / 1000 * FPS;
    if(!s || f > pros.end){ stopProsody(); return; }
    s.pros = HC.prosodyAt(pros.events, Math.round(f));
    if(!s.anim) paint(s, s.nums, s.vb);
    prosRaf = requestAnimationFrame(prosTick);
  }
  function startProsody(L, cm, c, text, spans, sp, think){
    stopProsody();
    const setting = L.prosody !== undefined ? L.prosody : script.prosody !== undefined ? script.prosody : true;
    if(REDUCED || !setting || !c || !HC.prosody) return;
    let energy = (PROSODY[setting] || 1) * (Number(cm.expressiveness) >= 0 && cm.expressiveness !== '' && cm.expressiveness != null ? Number(cm.expressiveness) : 1);
    const part = k => spans.filter(x => x.kind === k).reduce((n, x) => n + x.to - x.from, 0) / Math.max(1, text.length);
    if(part('shout') > 0.4) energy *= 1.5; else if(part('whisper') > 0.4) energy *= 0.5;
    const stress = spans.filter(x => x.kind === 'stress').map(x => [x.from, x.to]);
    const r = HC.prosody(text, sp, {fps:FPS, lang:cm.lang || 'en', energy, think, view:c.data.head === 'front' ? 'front' : 'side', stress});
    if(!r.events.length) return;
    pros = {id:L.who, events:r.events, t0:performance.now(), end:Math.max(...r.events.map(e => e.frame + e.dur)) + 1};
    prosRaf = requestAnimationFrame(prosTick);
  }

  /* ── saying a line ── */
  let index = -1, scene = null, talk = null, raf = 0;
  /* the line's text is laid out once, every letter hidden, and letters are shown as they are said, so the box
     never reflows. When shouting, each letter shakes as it appears and the shaking dies down. */
  function build(el, text, spans){
    const esc = t => t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    /* each letter takes the classes of shouting and whispering; a grammar colour is drawn on a wrapper round each
       word's coloured letters (and the spaces inside a coloured phrase), never letter by letter: a background painted
       per letter covers the edge of the letter before it. The wrapper is tinted once its first letter shows. */
    const kind = at => spans.filter(sp => at >= sp.from && at < sp.to && (sp.kind === 'shout' || sp.kind === 'whisper'))
      .map(sp => sp.kind === 'shout' ? ' sh' : ' wh').join('');
    const posAt = at => spans.find(sp => sp.kind === 'pos' && /^\w+$/.test(sp.pos) && at >= sp.from && at < sp.to) || null;
    const offs = []; let h = '', at = 0;
    for(const part of text.split(/(\s+)/)){
      if(!part) continue;
      const space = /^\s+$/.test(part);
      let inner = '', run = null, buf = '', runFrom = at;
      const flush = end => {
        if(!buf) return;
        if(run) inner += `<span class="pw pos-hl pos-${run.pos}${runFrom === run.from ? ' hl-a' : ''}${end === run.to ? ' hl-z' : ''}${space ? ' pw-sp' : ''} hid">${buf}</span>`;
        else inner += buf;
        buf = '';
      };
      for(const ch of part){
        const sp = posAt(at);
        if(sp !== run){ flush(at); run = sp; runFrom = at; }
        const k = kind(at); offs.push(at);
        buf += `<span class="c${space ? '' : ' l'}${space ? k.replace(' sh', '') : k} hid">${esc(ch)}</span>`;
        at += ch.length;
      }
      flush(at);
      h += space ? inner : `<span class="w">${inner}</span>`;
    }
    el.innerHTML = h; el.scrollTop = 0;
    talk.el = el; talk.chars = el.querySelectorAll('.c'); talk.offs = offs; talk.p = 0; talk.jolted = false;
  }
  function render(upto){   /* show every letter that starts before upto (a position in the text) */
    let last = null;
    while(talk.p < talk.chars.length && talk.offs[talk.p] < upto){
      const c = last = talk.chars[talk.p++]; c.classList.remove('hid'); c.classList.add('on');   /* on: a shouted letter starts shaking */
      const pw = c.parentElement; if(pw && pw.classList.contains('pw')) pw.classList.remove('hid');   /* its grammar tint shows with it */
      if(!talk.jolted && c.classList.contains('sh')){ talk.jolted = true; jolt(); }
    }
    if(last) follow(last);
  }
  /* the speaker's jolt when the shouting starts */
  function jolt(){
    const s = talk.who != null && sprites.get(talk.who); if(!s || talk.insert) return;
    s.el.classList.remove('quake'); void s.el.offsetWidth; s.el.classList.add('quake');
  }
  /* text longer than the box (a narrow screen): keep the newest letters in view; it can also be scrolled by hand */
  function follow(c){
    const el = talk.el; if(!el || el.scrollHeight <= el.clientHeight + 1) return;
    const bottom = c.offsetTop + c.offsetHeight + 4;
    if(bottom > el.scrollTop + el.clientHeight) el.scrollTo({top:bottom - el.clientHeight, behavior:REDUCED ? 'auto' : 'smooth'});
  }
  function revealAt(t){   /* how much of the text has been said after t seconds */
    const W = talk.sp.words, n = talk.text.length;
    if(!W.length) return n;
    let idx = W[0].from;
    W.forEach((w, i) => {
      const s = w.start / FPS, e = w.end / FPS;
      if(t >= e){ const nx = W.slice(i + 1).find(x => x.from > w.from); idx = Math.max(idx, nx ? nx.from : n); }
      else if(t >= s) idx = Math.max(idx, Math.round(w.from + (w.to - w.from) * (t - s) / Math.max(e - s, 1e-3)));
    });
    return idx;
  }
  function setMouth(m){
    const c = talk.who != null && scene.get(talk.who); if(!c || c.data.mouth === m) return;
    c.data.mouth = m; drawSprite(talk.who, c);
  }
  function tick(now){
    if(!talk || talk.done) return;
    const t = Math.max(0, now - talk.t0) / 1000;
    if(t >= talk.sp.seconds){ finish(); return; }
    const f = t * FPS, K = talk.sp.keys;
    const up = revealAt(t); if(up !== talk.shown){ talk.shown = up; render(up); }
    runCues(up);
    if(talk.lips){   /* narration and thoughts move no lips */
      let m = K[0] ? K[0].mouth : REST;
      for(const k of K){ if(k.frame <= f) m = k.mouth; else break; }
      setMouth(m === REST ? talk.rest : m);
    }
    raf = requestAnimationFrame(tick);
  }
  /* auto-advance: after a line has been said, wait long enough to read it, then go on; questions and the end wait */
  let auto = false, autoTimer = 0;
  try{ auto = localStorage.getItem('house-vn-auto') === '1'; }catch(e){}
  const autoWillGo = () => auto && talk && talk.done && !ended && !isQuestion(index) && !isEnd(index);
  function scheduleAuto(){
    clearTimeout(autoTimer);
    if(!autoWillGo()) return;
    const wait = Math.min(5000, (talk.insert ? 1600 : 1000) + 30 * talk.text.length);
    autoTimer = setTimeout(() => { if(auto && talk && talk.done && !askEl) next(); }, wait);
  }
  function setAuto(on){
    auto = on;
    try{ localStorage.setItem('house-vn-auto', on ? '1' : '0'); }catch(e){}
    const b = root.querySelector('[data-act="auto"]');
    b.setAttribute('aria-pressed', String(on)); b.querySelector('.lb').textContent = on ? 'Auto on' : 'Auto';
    if(on){ if(autoWillGo()) clearTimeout(settleTimer); scheduleAuto(); }
    else { clearTimeout(autoTimer); if(talk && talk.done){ clearTimeout(settleTimer); settleTimer = setTimeout(settle, SETTLE_AFTER); } }   /* off: settle as usual */
  }
  /* once a line has been said, the speaker slowly goes back to their resting place, size, pose and face */
  const SETTLE_AFTER = 700, SETTLE_TIME = Math.max(1.8, SCENE_TIME * 4);
  let settleTimer = 0, faceTimer = 0;
  /* settling: the speaker of the line just said eases back to their resting place, size and pose over
     SETTLE_TIME, and their face changes halfway. It runs on its own after a line, or (with auto-advance, or when
     the next line comes before it started) at the same time as the next line. */
  function settleSprite(id, r, from){
    const sp = sprites.get(id); if(!sp) return;
    const keepFace = {...r, data:{...r.data, eyebrows:from.data.eyebrows, eyes:from.data.eyes, mouth:from.data.mouth}};
    const keep = motion; motion = {ease:SCENE_EASE, time:REDUCED ? 0 : SETTLE_TIME};
    sp.el.style.setProperty('--vn-move', (REDUCED ? 0 : SETTLE_TIME) + 's');   /* place and size move as slowly */
    drawSprite(id, keepFace); motion = keep;
    clearTimeout(sp.faceTimer);
    sp.faceTimer = setTimeout(() => { if(sprites.get(id) === sp && scene.get(id) === r){ drawSprite(id, r); } }, REDUCED ? 0 : SETTLE_TIME * 400);
    clearTimeout(sp.moveTimer);
    sp.moveTimer = setTimeout(() => sp.el.style.removeProperty('--vn-move'), (REDUCED ? 0 : SETTLE_TIME) * 1000 + 50);
  }
  function settle(){
    const who = talk && talk.who; if(who == null || !scene.rest || !scene.rest.has(who) || talk.settled) return;
    talk.settled = true;
    const r = cloneC(scene.rest.get(who)), from = scene.get(who);
    scene.set(who, r); settleSprite(who, r, from); layout(scene, who);
  }

  function finish(){   /* the whole line at once, mouth at rest */
    if(!talk || talk.done) return;
    if((performance.now() - talk.t0) / 1000 < talk.sp.seconds) stopProsody();   /* skipped: the head and brows stop with the words */
    talk.done = true; cancelAnimationFrame(raf);
    render(Infinity); runCues(Infinity); setMouth(talk.rest);
    if(talk.el) talk.el.scrollTo({top:talk.el.scrollHeight, behavior:REDUCED ? 'auto' : 'smooth'});
    clearTimeout(settleTimer);
    /* with auto-advance on, the speaker keeps acting until the next line starts and goes back to rest with it,
       instead of settling first */
    if(!autoWillGo()) settleTimer = setTimeout(settle, SETTLE_AFTER);
    scheduleAuto();
    syncButtons();
    if(isQuestion(index)) showAsk();
  }

  /* ── labels, jumps and the way back ── */
  const labels = {};
  lines.forEach((L, i) => { if(L.id != null && !(String(L.id) in labels)) labels[String(L.id)] = i; });
  const branching = lines.some(L => L.goto != null || L.choices || L.input || L.end);
  /* a goto value → a line index; -1 when it leads nowhere (an unknown label ends the scene) */
  const target = g => typeof g === 'number' ? (g >= 0 && g < lines.length ? g : -1) : String(g) in labels ? labels[String(g)] : -1;
  const nextOf = i => lines[i].goto != null ? target(lines[i].goto) : i + 1 < lines.length ? i + 1 : -1;
  const isQuestion = i => { const L = lines[i]; return !!((Array.isArray(L.choices) && L.choices.length) || (L.input && typeof L.input === 'object')); };
  const isEnd = i => !isQuestion(i) && (!!lines[i].end || nextOf(i) < 0);
  let history = [], vars = {}, ended = false;   /* ended: an answer led nowhere, so the scene is over */   /* history: [{i, vars}] — every line shown, and the answers saved before it */

  /* {$name} in a line → the saved answer; cues after it move along with the text */
  function fill(p){
    const subs = [];
    const text = p.text.replace(/\{\$([\w-]+)\}/g, (m, k, off) => { const v = String(vars[k] ?? '').trim(); subs.push([off, v.length - m.length]); return v; });
    const shift = at => at + subs.filter(([o]) => o < at).reduce((t, [, d]) => t + d, 0);
    return {text, cues:p.cues.map(c => ({...c, at:shift(c.at)})), spans:p.spans.map(sp => ({...sp, from:shift(sp.from), to:shift(sp.to)}))};
  }

  function show(){   /* the last line of the history, with the scene as it stands there */
    if(!history.length) return;
    /* the speaker of the line before, if they have not settled yet, settles while this line plays */
    const prev = talk && talk.who != null && !talk.settled && sprites.has(talk.who) ? {id:talk.who, from:scene.get(talk.who)} : null;
    cancelAnimationFrame(raf); stopProsody(); hideAsk(); ended = false; clearTimeout(settleTimer); clearTimeout(faceTimer); clearTimeout(autoTimer);
    const cur = history[history.length - 1], i = cur.i;
    vars = {...cur.vars};
    const L = lines[i], who = L.who != null ? L.who : null, cm = who != null ? cast[who] : (script.narration || {});
    const insert = !!L.insert, think = !!(L.think || L.mode === 'think') && who != null, past = !!L.past;
    motion = {ease:L.easing ? easingOf(L.easing) : SCENE_EASE, time:Number(L.moveTime) >= 0 && L.moveTime !== '' && L.moveTime != null ? Number(L.moveTime) : SCENE_TIME};
    index = i; scene = sceneAt(history.map(h => h.i)); setBg(scene.bg);
    stage.classList.toggle('inserting', insert); stage.classList.toggle('insert-black', L.insert === 'black');
    stage.classList.toggle('think', think); stage.classList.toggle('past', past);
    boxEl.classList.toggle('narrate', who == null); boxEl.classList.toggle('think', think);
    syncSprites();
    for(const [id, c] of scene){
      if(prev && id === prev.id && id !== who && prev.from) settleSprite(id, c, prev.from);
      else drawSprite(id, c);
    }
    layout(scene, insert ? null : who);
    for(const [id, sp] of sprites) sp.el.classList.toggle('thinker', think && id === who);
    const name = who != null ? (cm.name || who) : '', c0 = who != null ? scene.get(who) : null;
    setName(insert || who == null ? '' : think ? `${name} 💭` : name);
    if(c0) boxEl.dataset.at = c0.at;   /* where the speaker stands as they say this line */
    root.style.setProperty('--vn-name', (who != null && cm.color) || '');
    const {text, cues, spans} = fill(parsed[i]), c = who != null ? scene.get(who) : null;
    for(const k of ['shout', 'whisper']) if(L[k] || L.mode === k) spans.push({kind:k, from:0, to:text.length});   /* the whole line */
    const shout = spans.some(sp => sp.kind === 'shout');
    const rest = c ? (LIP.includes(c.data.mouth) ? 'rest' : c.data.mouth) : 'rest';   /* pauses and the end fall back to their expression */
    /* pauses come back as REST and are drawn with whatever face the speaker has by then (cues can change it) */
    talk = {who, text, rest, cues, cue:0, shown:-1, done:false, t0:performance.now(), lips:who != null && !think && !insert, insert,
      sp:HC.speech(text, {fps:FPS, wpm:cm.wpm || (who != null ? 150 : 160), lang:cm.lang || 'en', restMouth:REST})};
    if(!talk.lips) setMouth(rest);   /* thinking: the mouth stays closed */
    srEl.textContent = who == null || insert ? text : `${name}${think ? ' thinks' : shout ? ' shouts' : ''}: ${text}`;
    if(insert) textEl.innerHTML = '';
    build(insert ? insertText : textEl, text, spans);
    if(!insert) insertText.innerHTML = '';
    syncButtons();
    if(who != null && !insert) startProsody(L, cm, c, text, spans, talk.sp, think);
    if(typeof script.onLine === 'function'){ try{ script.onLine(i, L); }catch(e){ console.error(e); } }
    if(!talk.sp.keys.length) finish(); else raf = requestAnimationFrame(tick);
  }
  function jump(i, newVars){
    if(i < 0 || i >= lines.length) return;
    history.push({i, vars:newVars || {...vars}});
    show();
  }

  /* ── questions ── */
  let askEl = null;
  const norm = t => String(t ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const loose = t => norm(t).toLowerCase().replace(/^[¡¿\s]+/u, '').replace(/[\s.!?¡¿…]+$/u, '');
  /* how close an answer is to the nearest rubric, 0–100: the gap fill's own measure */
  function closeness(answer, rubrics){
    const GF = global.HouseGapFill;
    if(GF && GF.bestAccuracy) return GF.bestAccuracy(answer, rubrics);
    if(GF && GF.damerauLevenshtein) return Math.max(0, ...rubrics.map(r => { const m = Math.max(answer.length, r.length); return m ? (1 - GF.damerauLevenshtein(answer, r) / m) * 100 : 100; }));
    console.warn('HouseVN: house.js (HouseGapFill) is not loaded, so answers are checked by exact match.');
    return rubrics.includes(answer) ? 100 : 0;
  }
  /* the branch an answer leads to: {goto, score} or null */
  function pickBranch(q, answer){
    const B = (Array.isArray(q.branches) ? q.branches : []).map(b => ({...b, rubrics:[].concat(b.rubric ?? b.rubrics ?? []).map(String)}));
    if(/^(closeness|close|damerau|dl|fuzzy|similar)/i.test(String(q.check || ''))){
      const a = loose(answer);
      let best = null;
      for(const b of B){
        const score = closeness(a, b.rubrics.map(loose)), min = Number(b.min ?? q.min ?? 75);
        if(score >= min && (!best || score > best.score || (score === best.score && min > best.min))) best = {goto:b.goto, score, min};
      }
      return best;
    }
    const same = r => q.strict ? norm(answer) === norm(r) : loose(answer) === loose(r);
    const b = B.find(b => b.rubrics.some(same));
    return b ? {goto:b.goto, score:100} : null;
  }
  function answered(goto, value){
    const L = lines[index], nv = {...vars};
    if(L.save) nv[L.save] = norm(value);
    const t = goto == null ? nextOf(index) : target(goto);
    hideAsk(); stage.focus({preventScroll:true});
    if(t < 0){ vars = nv; ended = true; syncButtons(); return; }   /* leads nowhere: the scene ends */
    jump(t, nv);
  }
  function hideAsk(){ if(askEl){ askEl.remove(); askEl = null; } }
  function showAsk(){
    hideAsk();
    const L = lines[index], esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    if(Array.isArray(L.choices) && L.choices.length){
      askEl = document.createElement('div'); askEl.className = 'vn-ask'; askEl.setAttribute('role', 'group'); askEl.setAttribute('aria-label', 'Choose an answer');
      askEl.innerHTML = L.choices.map((c, k) => `<button type="button" class="vn-choice" data-k="${k}">${k < 9 ? `<span class="vn-key" aria-hidden="true">${k + 1}</span>` : ''}${esc(c.text ?? '')}</button>`).join('');
      askEl.addEventListener('click', e => { const b = e.target.closest('.vn-choice'); if(!b) return; const c = L.choices[+b.dataset.k]; answered(c.goto, c.value ?? c.text); });
      stage.appendChild(askEl);
      askEl.querySelector('.vn-choice').focus({preventScroll:true});
    } else {
      const q = L.input;
      askEl = document.createElement('form'); askEl.className = 'vn-ask vn-input'; askEl.setAttribute('autocomplete', 'off');
      askEl.innerHTML = `<input type="text" spellcheck="false" autocapitalize="off" enterkeyhint="send" maxlength="200" aria-label="${esc(q.label || 'Your answer')}" placeholder="${esc(q.placeholder || 'Type your answer…')}">`
        + `<button type="submit">${esc(q.button || 'Answer')} ⏎</button><div class="vn-msg" aria-live="polite"></div>`;
      const inp = askEl.querySelector('input'), msg = askEl.querySelector('.vn-msg');
      askEl.addEventListener('submit', e => {
        e.preventDefault();
        const value = inp.value;
        if(!norm(value)){ msg.textContent = q.empty || 'Type an answer first.'; inp.focus(); return; }
        const hit = pickBranch(q, value);
        if(hit) return answered(hit.goto, value);
        if(q.else != null) return answered(q.else, value);
        if(!(Array.isArray(q.branches) && q.branches.length)) return answered(null, value);   /* no branches: any answer goes on */
        msg.textContent = q.retry || 'Try again.';
        askEl.classList.remove('shake'); void askEl.offsetWidth; askEl.classList.add('shake');
        inp.select();
      });
      stage.appendChild(askEl);
      inp.focus({preventScroll:true});
    }
    syncButtons();
  }

  function syncButtons(){
    const ready = talk && talk.done, asking = !!ready && isQuestion(index) && !!askEl, end = ended || (!!ready && isEnd(index) && !asking);
    nextEl.classList.toggle('ready', !!ready && !end && !asking);
    nextEl.classList.toggle('end', end);
    nextEl.classList.toggle('asking', asking);
    nextEl.textContent = end ? '⏹️' : '🔽';
    nextEl.title = end ? 'The end of the scene' : asking ? 'Answer the question to go on' : 'Next (Space, Enter or a click)';
    countEl.textContent = branching ? `Line ${history.length}` : `${index + 1} / ${lines.length}`;
    countEl.title = branching ? 'Lines shown so far, the way you came' : '';
    root.querySelector('[data-act="back"]').disabled = history.length <= 1;
    root.querySelector('[data-act="restart"]').disabled = history.length <= 1;
    root.querySelector('[data-act="next"]').disabled = end || asking;
  }
  const next = () => {
    if(talk && !talk.done) return finish();
    if(ended) return;
    if(askEl){ const f = askEl.querySelector('input, .vn-choice'); if(f) f.focus(); return; }   /* a question waits for its answer */
    if(isQuestion(index)) return showAsk();
    if(!isEnd(index)) jump(nextOf(index));
  };
  const back = () => { if(history.length > 1){ history.pop(); show(); } };
  const restart = () => { if(!lines.length) return; history = [{i:0, vars:{}}]; show(); };
  const go = g => jump(target(g));

  stage.addEventListener('click', e => {
    if(e.target.closest('.vn-ask')) return;
    if(e.target.closest('button') && !e.target.closest('.vn-next')) return;
    next();
  });
  root.querySelector('.vn-bar').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    ({next, back, restart, auto:() => setAuto(!auto)})[b.dataset.act]();
  });
  root.addEventListener('keydown', e => {
    if(e.target.closest('input, textarea, select')) return;
    if(askEl && /^[1-9]$/.test(e.key)){ const b = askEl.querySelectorAll('.vn-choice')[+e.key - 1]; if(b){ e.preventDefault(); b.click(); } return; }
    if(e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;   /* a focused button does its own job */
    if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown'){ e.preventDefault(); next(); }
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){ e.preventDefault(); back(); }
    else if(e.key === 'Home'){ e.preventDefault(); restart(); }
    else if(e.key === 'a' || e.key === 'A'){ e.preventDefault(); setAuto(!auto); }
  });

  let dead = false;
  function destroy(){   /* stop everything (animations, timers) and empty the host */
    if(dead) return; dead = true;
    cancelAnimationFrame(raf); cancelAnimationFrame(animRaf); stopProsody(); hideAsk();
    clearTimeout(settleTimer); clearTimeout(faceTimer); clearTimeout(autoTimer);
    for(const s of sprites.values()){ clearTimeout(s.faceTimer); clearTimeout(s.moveTimer); clearTimeout(s.blinkTimer); s.anim = null; }
    talk = null; sprites.clear(); host.innerHTML = '';
  }

  setAuto(auto);
  restart();
  return {destroy, setAuto, get auto(){ return auto; }, next, back, restart, go, get index(){ return index; }, get length(){ return lines.length; }, get vars(){ return {...vars}; }};
}

global.HouseVN = {create, get BACKGROUNDS(){ return Object.keys(BG); },
  addBackground(id, svg){ BG[id] = svg; }, background(id){ return BG[id]; }};
})(window);
