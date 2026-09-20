/* ══════════════════════════════════════════════════════════════════════════
   HOUSE SPEAK — tap-to-hear for individual words.

   Any element with data-say="word" becomes speakable. If it also has
   data-audio="audio/word.mp3" that recording plays first, and the browser's
   own speech synthesis is used only when the file is missing or fails.

     <button type="button" class="chip" data-say="cab">cab</button>
     <button type="button" class="chip" data-say="cab" data-audio="audio/cab.mp3">cab</button>

   The element gets .is-speaking while it plays.

   Optional voice picker: put <select id="speakVoice"> on the page and it is
   filled with this device's English voices, grouped by accent. The choice is
   remembered per device and the last word is replayed in the new voice.
   (Any other element with that id just shows the chosen voice as text.)
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.HouseSpeak) return; // house.js already provides it

  var LANG = 'en-US';
  var RATE = 0.85;
  var SAFETY_MS = 3000; // single words finish well inside this
  var STORE_KEY = 'house-speak-voice';

  // Good, widely shipped voices, tried in order (on-device voices first, so an
  // offline classroom doesn't silently pick a voice that needs the network).
  var PREFERRED = ['Samantha', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Ava',
                   'Microsoft Zira', 'Google US English', 'Alex'];
  // macOS/iOS list novelty and Eloquence voices under English; never offer those as pronunciation models.
  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)(\s|\(|$)/i;

  var synth = ('speechSynthesis' in global && 'SpeechSynthesisUtterance' in global) ? global.speechSynthesis : null;
  var voice = null;
  var voices = [];      // English voices currently offered, indexed by <option value>
  var current = null;   // strong reference: Chrome can garbage-collect an in-flight utterance
  var audio = null;
  var activeEl = null;
  var lastEl = null;

  function norm(lang) { return (lang || '').replace('_', '-').toLowerCase(); }
  function loadPref() { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } }
  function savePref(uri) { try { localStorage.setItem(STORE_KEY, uri); } catch (e) { /* private mode etc. */ } }

  function langLabel(code) {
    try {
      if (global.Intl && Intl.DisplayNames) {
        return new Intl.DisplayNames(['en'], { type: 'language' }).of(code.replace('_', '-'));
      }
    } catch (e) { /* malformed tag — fall through */ }
    return code;
  }

  function autoPick(list) {
    var target = norm(LANG);
    var exact = list.filter(function (v) { return norm(v.lang) === target; });
    var passes = [exact.filter(function (v) { return v.localService; }), exact];
    for (var p = 0; p < passes.length; p++) {
      for (var i = 0; i < PREFERRED.length; i++) {
        for (var j = 0; j < passes[p].length; j++) {
          if (passes[p][j].name.indexOf(PREFERRED[i]) === 0) return passes[p][j];
        }
      }
    }
    return exact.filter(function (v) { return v.default; })[0] || exact[0] || list[0] || null;
  }

  function pickVoice() {
    if (!synth) return;
    var list = synth.getVoices().filter(function (v) {
      return norm(v.lang).indexOf('en') === 0 && !NOVELTY.test(v.name);
    });
    var byUri = function (uri) { return list.filter(function (v) { return v.voiceURI === uri; })[0]; };

    // Chrome fires voiceschanged more than once; keep whatever is already in use.
    voice = (voice && byUri(voice.voiceURI)) || byUri(loadPref()) || autoPick(list);
    voices = list;
    renderPicker();
  }

  function renderPicker() {
    var el = document.getElementById('speakVoice');
    if (!el) return;

    if (el.tagName !== 'SELECT') {
      el.textContent = !synth ? 'This browser can’t read words aloud. Try Chrome, Edge or Safari.'
        : voice ? 'Voice: ' + voice.name + ' (' + voice.lang + ')' : 'Voice: device default';
      return;
    }

    if (!synth) {
      (el.closest('label') || el).textContent = 'This browser can’t read words aloud. Try Chrome, Edge or Safari.';
      return;
    }

    el.innerHTML = '';
    if (!voices.length) {
      el.appendChild(new Option('Device default', ''));
      el.disabled = true;
      return;
    }
    el.disabled = false;

    // Group by accent; the page's own accent first, the rest alphabetically.
    var groups = {};
    voices.forEach(function (v, i) {
      var key = norm(v.lang);
      (groups[key] = groups[key] || []).push(i);
    });
    var keys = Object.keys(groups).sort(function (a, b) {
      if (a === norm(LANG)) return -1;
      if (b === norm(LANG)) return 1;
      return langLabel(a).localeCompare(langLabel(b));
    });

    keys.forEach(function (key) {
      var og = document.createElement('optgroup');
      og.label = langLabel(key);
      groups[key]
        .sort(function (a, b) { return voices[a].name.localeCompare(voices[b].name); })
        .forEach(function (i) {
          var v = voices[i];
          var opt = new Option(v.name + (v.localService ? '' : ' · online'), String(i));
          if (v === voice) opt.selected = true;
          og.appendChild(opt);
        });
      el.appendChild(og);
    });
    el.title = voice ? voice.name + ' (' + voice.lang + ')' : '';
  }

  function onPickerChange(e) {
    var v = voices[Number(e.target.value)];
    if (!v) return;
    voice = v;
    savePref(v.voiceURI);
    e.target.title = v.name + ' (' + v.lang + ')';
    // Replay the last word (or the first on the page) so the new voice can be judged straight away.
    var sample = lastEl || document.querySelector('[data-say]');
    if (sample) speak(sample.getAttribute('data-say'), lastEl);
  }

  function setActive(el) {
    if (activeEl) activeEl.classList.remove('is-speaking');
    activeEl = el || null;
    if (activeEl) {
      void activeEl.offsetWidth; // restart the CSS animation on a repeat tap
      activeEl.classList.add('is-speaking');
    }
  }

  function stopAll() {
    if (audio) { audio.pause(); audio = null; }
    if (synth && (synth.speaking || synth.pending)) {
      current = null; // so the cancelled utterance's late error event can't clear the next chip
      synth.cancel();
    }
  }

  function speak(text, el) {
    if (!synth) return false;
    if (!voice) pickVoice();
    stopAll();
    synth.resume(); // Chrome can leave the queue paused after tab switches

    var u = new SpeechSynthesisUtterance(text);
    // lang must follow the voice: some engines (notably on Android) honour lang over voice.
    u.lang = voice ? voice.lang.replace('_', '-') : LANG;
    u.rate = RATE;
    if (voice) u.voice = voice;

    var done = function () {
      if (current !== u) return;
      current = null;
      if (!audio) setActive(null);
    };
    u.onend = done;
    u.onerror = done;

    current = u;
    setActive(el);
    synth.speak(u); // must stay synchronous inside the user's gesture for iOS
    setTimeout(done, SAFETY_MS);
    return true;
  }

  function play(el) {
    lastEl = el;
    var text = el.getAttribute('data-say');
    var src = el.getAttribute('data-audio');
    if (!src) { speak(text, el); return; }

    stopAll();
    var a = audio = new Audio(src);
    setActive(el);
    a.onended = function () { if (audio === a) { audio = null; setActive(null); } };
    var fallback = function () { if (audio === a) { audio = null; speak(text, el); } };
    var p = a.play();
    if (p && p.catch) p.catch(fallback);
    a.onerror = fallback;
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-say]') : null;
    if (el) play(el);
  });

  function init() {
    var picker = document.getElementById('speakVoice');
    if (picker && picker.tagName === 'SELECT') picker.addEventListener('change', onPickerChange);
    if (synth) {
      pickVoice();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
      else synth.onvoiceschanged = pickVoice;
    } else {
      document.documentElement.classList.add('no-speech');
      renderPicker();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.HouseSpeak = { speak: speak, play: play, stop: stopAll, pickVoice: pickVoice };
})(window);
