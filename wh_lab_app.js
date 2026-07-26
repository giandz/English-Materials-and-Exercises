/* ===================================================================
   Wh-Words Lab — app.js (Do/Does)
   Data-driven sections + dynamic tables + interactive quizzes
   + drag-and-drop ordering exercise (revealed on correct answer)
   =================================================================== */

(() => {
  'use strict';

  /* --- Data: 6 sections, each with examples + quiz + ordering --- */
  const SECTIONS = [
    {
      id: 'option',
      emoji: '\uD83C\uDFA7',
      label: 'Option',
      whWord: 'What + category?',
      pattern: 'What + [category noun] + do/does + subject + base verb?',
      note: 'Use "what" followed by a category noun (sports, food, music, etc.) to ask about someone\u2019s choices or preferences.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'She <em class="aux-highlight">plays</em> tennis on weekends.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'she \u2192 3rd person singular \u2192 does'
        },
        {
          type: 'negative',
          sentence: 'She <em class="aux-highlight">doesn\u2019t</em> play tennis on weekends.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'does not + base verb (plays \u2192 play)'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">What sports does</em> she play?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'does + she + base verb'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "What + category" question:',
        sentence: 'They cook Italian food at home.',
        answers: [
          'what food do they cook',
          'what food do they cook at home',
          'what kind of food do they cook',
          'what kind of food do they cook at home',
          'what cuisine do they cook',
          'what cuisine do they cook at home'
        ],
        hint: 'The category is "food". "They" takes "do". Pattern: What + food + do + they + cook\u2026?',
        orderingWords: ['What', 'food', 'do', 'they', 'cook', '?']
      }
    },
    {
      id: 'company',
      emoji: '\uD83E\uDDD1\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1',
      label: 'Company',
      whWord: 'Who \u2026 with?',
      pattern: 'Who + do/does + subject + base verb + with?',
      note: 'Use "who \u2026 with?" to ask about the person someone does an activity with. The "with" stays at the end.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'He <em class="aux-highlight">studies</em> with Maria.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'he \u2192 3rd person singular \u2192 does'
        },
        {
          type: 'negative',
          sentence: 'He <em class="aux-highlight">doesn\u2019t</em> study with Maria.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'does not + base verb (studies \u2192 study)'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">Who does</em> he study <em class="aux-highlight">with</em>?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'does + he + base verb + with?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "Who \u2026 with?" question:',
        sentence: 'You go to the gym with David.',
        answers: [
          'who do you go to the gym with',
          'who do you go with',
          'with who do you go to the gym'
        ],
        hint: '"You" takes "do". Keep "with" at the end. Pattern: Who + do + you + go\u2026 + with?',
        orderingWords: ['Who', 'do', 'you', 'go', 'to', 'the', 'gym', 'with', '?']
      }
    },
    {
      id: 'location',
      emoji: '\uD83D\uDCCD',
      label: 'Location',
      whWord: 'Where?',
      pattern: 'Where + do/does + subject + base verb?',
      note: 'Use "where" to ask about a place or location connected to an action.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'They <em class="aux-highlight">work</em> in downtown Miami.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'they \u2192 plural \u2192 do'
        },
        {
          type: 'negative',
          sentence: 'They <em class="aux-highlight">don\u2019t</em> work in downtown Miami.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'do not + base verb'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">Where do</em> they work?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'do + they + base verb?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "Where" question:',
        sentence: 'She lives in Caracas.',
        answers: [
          'where does she live'
        ],
        hint: '"She" takes "does". Pattern: Where + does + she + live?',
        orderingWords: ['Where', 'does', 'she', 'live', '?']
      }
    },
    {
      id: 'frequency',
      emoji: '\uD83D\uDCC5',
      label: 'Frequency',
      whWord: 'How often?',
      pattern: 'How often + do/does + subject + base verb?',
      note: 'Use "how often" to ask about the frequency of an action \u2014 always, sometimes, never, etc.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'He <em class="aux-highlight">visits</em> his grandparents every Sunday.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'he \u2192 3rd person singular \u2192 does'
        },
        {
          type: 'negative',
          sentence: 'He <em class="aux-highlight">doesn\u2019t</em> visit his grandparents every Sunday.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'does not + base verb (visits \u2192 visit)'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">How often does</em> he visit his grandparents?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'does + he + base verb?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "How often" question:',
        sentence: 'You practice the guitar on weekends.',
        answers: [
          'how often do you practice the guitar',
          'how often do you practice guitar'
        ],
        hint: '"You" takes "do". Pattern: How often + do + you + practice\u2026?',
        orderingWords: ['How', 'often', 'do', 'you', 'practice', 'the', 'guitar', '?']
      }
    },
    {
      id: 'general-time',
      emoji: '\uD83C\uDF04',
      label: 'General Time',
      whWord: 'When?',
      pattern: 'When + do/does + subject + base verb?',
      note: 'Use "when" to ask about a general time \u2014 a day, season, or occasion, not a specific hour.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'We <em class="aux-highlight">travel</em> in the summer.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'we \u2192 plural \u2192 do'
        },
        {
          type: 'negative',
          sentence: 'We <em class="aux-highlight">don\u2019t</em> travel in the summer.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'do not + base verb'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">When do</em> we travel?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'do + we + base verb?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "When" question:',
        sentence: 'She starts her new job on Monday.',
        answers: [
          'when does she start her new job',
          'when does she start the new job'
        ],
        hint: '"She" takes "does". Pattern: When + does + she + start\u2026?',
        orderingWords: ['When', 'does', 'she', 'start', 'her', 'new', 'job', '?']
      }
    },
    {
      id: 'specific-time',
      emoji: '\u231A',
      label: 'Specific Time',
      whWord: 'What time?',
      pattern: 'What time + do/does + subject + base verb?',
      note: 'Use "what time" to ask for a precise hour or clock time \u2014 3:00 PM, 7:30 AM, etc.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'You <em class="aux-highlight">wake up</em> at 6:30 AM.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'you \u2192 2nd person \u2192 do'
        },
        {
          type: 'negative',
          sentence: 'You <em class="aux-highlight">don\u2019t</em> wake up at 6:30 AM.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'do not + base verb'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">What time do</em> you wake up?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'do + you + base verb?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "What time" question:',
        sentence: 'The train leaves at 8:00 PM.',
        answers: [
          'what time does the train leave',
          'at what time does the train leave'
        ],
        hint: '"The train" \u2192 it \u2192 "does". Pattern: What time + does + the train + leave?',
        orderingWords: ['What', 'time', 'does', 'the', 'train', 'leave', '?']
      }
    }
  ];

  /* --- Helpers --- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function normalize(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[?.!]+$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\bu\b/g, 'you')
      .replace(/don't/g, 'do not')
      .replace(/doesn't/g, 'does not');
  }

  function checkAnswer(userInput, acceptedAnswers) {
    const norm = normalize(userInput);
    if (!norm) return false;
    return acceptedAnswers.some(a => normalize(a) === norm);
  }

  /* --- Render Section Nav --- */
  function renderNav() {
    const nav = $('#sectionNav');
    nav.innerHTML = SECTIONS.map(s => `
      <a class="nav-pill" href="#${s.id}" data-section="${s.id}">
        <span class="nav-emoji">${s.emoji}</span>
        <span class="nav-label">${s.label}</span>
        <span class="nav-check">&#10003;</span>
      </a>
    `).join('');
  }

  /* --- Render Sections --- */
  function renderSections() {
    const container = $('#sectionsContainer');
    container.innerHTML = SECTIONS.map(section => {
      const rows = section.examples.map(ex => `
        <tr>
          <td>
            <span class="row-label ${ex.labelClass}">${ex.label}</span>
            <div class="sentence">${ex.sentence}</div>
            <span class="subject-tag">${ex.subjectTag}</span>
          </td>
        </tr>
      `).join('');

      return `
        <section class="section-card" id="${section.id}" aria-labelledby="${section.id}-title">
          <div class="section-head">
            <span class="section-emoji" aria-hidden="true">${section.emoji}</span>
            <div class="section-titles">
              <h2 id="${section.id}-title">${section.label}</h2>
              <span class="section-wh">${section.whWord}</span>
            </div>
          </div>
          <p class="section-note">${section.note}</p>

          <table class="example-table" role="table">
            <thead>
              <tr>
                <th scope="col">Affirmative \u2192 Negative \u2192 Wh-Question</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="quiz-card" data-quiz="${section.id}">
            <div class="quiz-completed-badge" data-completed="${section.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Mastered
            </div>
            <span class="quiz-label">Try it</span>
            <p class="quiz-prompt">${section.quiz.prompt}</p>
            <span class="quiz-sentence">${section.quiz.sentence}</span>
            <div class="quiz-input-row">
              <input
                type="text"
                class="quiz-input"
                placeholder="Type your Wh-question here\u2026"
                aria-label="Your answer for ${section.label} section"
                data-input="${section.id}"
                autocomplete="off"
                spellcheck="false"
              />
              <button class="quiz-btn quiz-btn-check" data-check="${section.id}">Check</button>
              <button class="quiz-btn quiz-btn-hint" data-hint="${section.id}">Hint</button>
            </div>
            <div class="quiz-feedback" data-feedback="${section.id}" role="status" aria-live="polite"></div>
            <div class="quiz-hint-text" data-hint-text="${section.id}">${section.quiz.hint}</div>

            <div class="ordering-exercise" data-ordering="${section.id}">
              <span class="ordering-step">Step 2 \u00b7 Word Order</span>
              <p class="ordering-label">Drag or tap the words to assemble the question:</p>
              <div class="drop-zone" data-dropzone="${section.id}">
                <span class="drop-placeholder">Drag or tap words here\u2026</span>
              </div>
              <div class="word-bank" data-bank="${section.id}"></div>
              <div class="ordering-actions">
                <button class="quiz-btn quiz-btn-check" data-check-order="${section.id}">Check Order</button>
                <button class="quiz-btn quiz-btn-reset" data-reset-order="${section.id}">Shuffle</button>
              </div>
              <div class="ordering-feedback" data-order-feedback="${section.id}" role="status" aria-live="polite"></div>
            </div>
          </div>
        </section>
      `;
    }).join('');
  }

  /* --- Quiz Logic --- */
  const completed = new Set();

  function handleQuiz(sectionId) {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;

    const input = $(`[data-input="${sectionId}"]`);
    const feedback = $(`[data-feedback="${sectionId}"]`);
    const value = input.value.trim();

    if (!value) {
      input.focus();
      return;
    }

    const isCorrect = checkAnswer(value, section.quiz.answers);

    input.classList.remove('is-correct', 'is-incorrect');
    feedback.classList.remove('is-visible', 'is-correct', 'is-incorrect');
    void input.offsetWidth;

    if (isCorrect) {
      input.classList.add('is-correct');
      feedback.classList.add('is-visible', 'is-correct');
      feedback.innerHTML = `<strong>&#10003; Correct!</strong> Great job \u2014 you used the right auxiliary and word order.`;

      if (!completed.has(sectionId)) {
        completed.add(sectionId);
        updateProgress();
        const pill = $(`.nav-pill[data-section="${sectionId}"]`);
        if (pill) pill.classList.add('is-done');
        $(`[data-completed="${sectionId}"]`).classList.add('is-visible');
      }

      // Reveal ordering exercise
      revealOrdering(sectionId);
    } else {
      input.classList.add('is-incorrect');
      feedback.classList.add('is-visible', 'is-incorrect');
      feedback.innerHTML = `<strong>&#10007; Not quite.</strong> Compare your answer with the correct form below.` +
        `<span class="feedback-answer">${section.quiz.answers[0]}?</span>`;

      const clearError = () => {
        input.classList.remove('is-incorrect');
        feedback.classList.remove('is-visible', 'is-incorrect');
        input.removeEventListener('input', clearError);
      };
      input.addEventListener('input', clearError);
    }
  }

  function toggleHint(sectionId) {
    $(`[data-hint-text="${sectionId}"]`).classList.toggle('is-visible');
  }

  /* --- Ordering Exercise --- */
  let draggedChip = null;
  let dragJustEnded = false;

  function revealOrdering(sectionId) {
    const exercise = $(`[data-ordering="${sectionId}"]`);
    if (exercise && !exercise.classList.contains('is-visible')) {
      exercise.classList.add('is-visible');
      initOrdering(sectionId);
    }
  }

  function shuffleWords(words) {
    const shuffled = [...words];
    let attempts = 0;
    do {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      attempts++;
    } while (shuffled.every((w, i) => w.toLowerCase() === words[i].toLowerCase()) && attempts < 10);
    return shuffled;
  }

  function initOrdering(sectionId) {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;

    const bank = $(`[data-bank="${sectionId}"]`);
    const dropZone = $(`[data-dropzone="${sectionId}"]`);

    // Reset states
    bank.innerHTML = '';
    dropZone.classList.remove('is-correct', 'is-incorrect');
    dropZone.querySelectorAll('.word-chip').forEach(c => c.remove());
    updatePlaceholder(sectionId);

    const feedback = $(`[data-order-feedback="${sectionId}"]`);
    feedback.classList.remove('is-visible', 'is-correct', 'is-incorrect');

    // Create shuffled chips
    const shuffled = shuffleWords(section.quiz.orderingWords);
    shuffled.forEach((word, i) => {
      const chip = document.createElement('span');
      chip.className = 'word-chip' + (word === '?' || word === '!' || word === '.' ? ' punctuation' : '');
      chip.draggable = true;
      chip.textContent = word;
      chip.dataset.word = word.toLowerCase();
      chip.dataset.section = sectionId;
      chip.dataset.chipId = `${sectionId}-${i}`;
      bank.appendChild(chip);
    });

    // Attach listeners
    bank.querySelectorAll('.word-chip').forEach(chip => attachChipListeners(chip, sectionId));

    // Drop zone listeners
    dropZone.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; dropZone.classList.add('is-over'); };
    dropZone.ondragleave = (e) => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('is-over'); };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('is-over');
      if (draggedChip) {
        const afterEl = getDragAfterElement(dropZone, e.clientX, e.clientY);
        if (afterEl) dropZone.insertBefore(draggedChip, afterEl);
        else dropZone.appendChild(draggedChip);
        draggedChip.classList.add('is-placed');
        draggedChip.classList.remove('is-correct', 'is-incorrect');
        updatePlaceholder(sectionId);
      }
    };

    // Bank listeners (for dragging back)
    bank.ondragover = (e) => { e.preventDefault(); bank.classList.add('is-over'); };
    bank.ondragleave = (e) => { if (!bank.contains(e.relatedTarget)) bank.classList.remove('is-over'); };
    bank.ondrop = (e) => {
      e.preventDefault();
      bank.classList.remove('is-over');
      if (draggedChip && draggedChip.classList.contains('is-placed')) {
        bank.appendChild(draggedChip);
        draggedChip.classList.remove('is-placed', 'is-correct', 'is-incorrect');
        updatePlaceholder(sectionId);
      }
    };
  }

  function attachChipListeners(chip, sectionId) {
    chip.ondragstart = (e) => {
      draggedChip = chip;
      chip.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chip.dataset.chipId);
    };
    chip.ondragend = () => {
      chip.classList.remove('is-dragging');
      draggedChip = null;
      dragJustEnded = true;
      setTimeout(() => { dragJustEnded = false; }, 100);
    };
    chip.onclick = () => {
      if (dragJustEnded) return;
      const isInDropZone = chip.parentElement.hasAttribute('data-dropzone');
      if (isInDropZone) {
        const bank = $(`[data-bank="${sectionId}"]`);
        bank.appendChild(chip);
        chip.classList.remove('is-placed', 'is-correct', 'is-incorrect');
      } else {
        const dropZone = $(`[data-dropzone="${sectionId}"]`);
        dropZone.appendChild(chip);
        chip.classList.add('is-placed');
        chip.classList.remove('is-correct', 'is-incorrect');
      }
      updatePlaceholder(sectionId);
    };
  }

  function getDragAfterElement(container, x, y) {
    const chips = [...container.querySelectorAll('.word-chip:not(.is-dragging)')];
    return chips.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: -Infinity }).element;
  }

  function updatePlaceholder(sectionId) {
    const dropZone = $(`[data-dropzone="${sectionId}"]`);
    const placeholder = dropZone.querySelector('.drop-placeholder');
    const hasChips = dropZone.querySelector('.word-chip');
    if (placeholder) placeholder.style.display = hasChips ? 'none' : '';
    dropZone.classList.remove('is-correct', 'is-incorrect');
  }

  function checkOrder(sectionId) {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;

    const dropZone = $(`[data-dropzone="${sectionId}"]`);
    const bank = $(`[data-bank="${sectionId}"]`);
    const feedback = $(`[data-order-feedback="${sectionId}"]`);
    const chips = [...dropZone.querySelectorAll('.word-chip')];

    const bankChips = bank.querySelectorAll('.word-chip');
    if (bankChips.length > 0) {
      showOrderFeedback(sectionId, 'incorrect', `You still have ${bankChips.length} word${bankChips.length > 1 ? 's' : ''} left in the word bank.`);
      return;
    }

    if (chips.length === 0) {
      showOrderFeedback(sectionId, 'incorrect', 'Place all the words in the drop zone first.');
      return;
    }

    const correctWords = section.quiz.orderingWords.map(w => w.toLowerCase());
    let allCorrect = true;
    chips.forEach((chip, i) => {
      if (chip.dataset.word === correctWords[i]) {
        chip.classList.add('is-correct');
        chip.classList.remove('is-incorrect');
      } else {
        chip.classList.add('is-incorrect');
        chip.classList.remove('is-correct');
        allCorrect = false;
      }
    });

    if (allCorrect) {
      dropZone.classList.add('is-correct');
      dropZone.classList.remove('is-incorrect');
      showOrderFeedback(sectionId, 'correct', 'Perfect! You arranged the question correctly.');
    } else {
      dropZone.classList.add('is-incorrect');
      dropZone.classList.remove('is-correct');
      showOrderFeedback(sectionId, 'incorrect', 'Some words are in the wrong position. Try again!');
    }
  }

  function showOrderFeedback(sectionId, type, message) {
    const feedback = $(`[data-order-feedback="${sectionId}"]`);
    feedback.classList.remove('is-visible', 'is-correct', 'is-incorrect');
    void feedback.offsetWidth;
    feedback.classList.add('is-visible', type);
    feedback.innerHTML = type === 'correct'
      ? `<strong>&#10003; ${message}</strong>`
      : `<strong>&#10007; ${message}</strong>`;
  }

  function resetOrdering(sectionId) {
    initOrdering(sectionId);
  }

  /* --- Progress --- */
  function updateProgress() {
    const count = completed.size;
    $('#progressCount').textContent = count;
    const arc = $('#progressArc');
    const circumference = 62.83;
    const offset = circumference - (count / SECTIONS.length) * circumference;
    arc.style.strokeDashoffset = offset;
  }

  /* --- Scroll Spy --- */
  function initScrollSpy() {
    const pills = $$('.nav-pill');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          pills.forEach(p => p.classList.toggle('is-active', p.dataset.section === id));
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
  }

  /* --- Events --- */
  function initEvents() {
    document.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('[data-check]');
      const hintBtn = e.target.closest('[data-hint]');
      const checkOrderBtn = e.target.closest('[data-check-order]');
      const resetOrderBtn = e.target.closest('[data-reset-order]');

      if (checkBtn) handleQuiz(checkBtn.dataset.check);
      else if (hintBtn) toggleHint(hintBtn.dataset.hint);
      else if (checkOrderBtn) checkOrder(checkOrderBtn.dataset.checkOrder);
      else if (resetOrderBtn) resetOrdering(resetOrderBtn.dataset.resetOrder);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = e.target.closest('.quiz-input');
        if (input) handleQuiz(input.dataset.input);
      }
    });
  }

  /* --- Theme Toggle --- */
  function initTheme() {
    const toggle = document.querySelector('[data-theme-toggle]');
    const root = document.documentElement;
    let mode = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', mode);

    const sunIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    const moonIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    const updateIcon = () => {
      toggle.innerHTML = mode === 'dark' ? sunIcon : moonIcon;
      toggle.setAttribute('aria-label', 'Switch to ' + (mode === 'dark' ? 'light' : 'dark') + ' mode');
    };
    updateIcon();

    toggle.addEventListener('click', () => {
      mode = mode === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', mode);
      updateIcon();
    });
  }

  /* --- Init --- */
  function init() {
    renderNav();
    renderSections();
    initScrollSpy();
    initEvents();
    initTheme();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
