/* ===================================================================
   Be-Verb Lab — app.js (Am/Is/Are)
   Data-driven sections + dynamic tables + interactive quizzes
   + drag-and-drop ordering exercise (revealed on correct answer)
   =================================================================== */

(() => {
  'use strict';

  /* --- Data: 7 sections, each with examples + quiz + ordering --- */
  const SECTIONS = [
    {
      id: 'objects',
      emoji: '\uD83D\uDCE6',
      label: 'Objects',
      whWord: 'What\u2026?',
      pattern: 'What + is/are + subject?',
      note: 'Use "what" to ask about a thing or object. The verb "be" moves before the subject: What is this? / What are these?',
      examples: [
        {
          type: 'affirmative',
          sentence: 'This <em class="aux-highlight">is</em> a laptop.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'this \u2192 3rd singular \u2192 is'
        },
        {
          type: 'negative',
          sentence: 'This <em class="aux-highlight">isn\u2019t</em> a laptop.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'is + not (contraction: isn\u2019t)'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">What is</em> this?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'what + is + subject?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "What" question:',
        sentence: 'These are scissors.',
        answers: [
          'what are these',
          'what are these things'
        ],
        hint: 'These is plural \u2192 "are". Pattern: What + are + these?',
        orderingWords: ['What', 'are', 'these', '?']
      }
    },
    {
      id: 'identification',
      emoji: '\uD83E\uDEC6',
      label: 'Identification',
      whWord: 'Who\u2026?',
      pattern: 'Who + is/are + subject?',
      note: 'Use "who" to ask about a person\u2019s identity. The verb "be" inverts: Who is she? / Who are they?',
      examples: [
        {
          type: 'affirmative',
          sentence: 'She <em class="aux-highlight">is</em> our new principal.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'she \u2192 3rd singular \u2192 is'
        },
        {
          type: 'negative',
          sentence: 'She <em class="aux-highlight">isn\u2019t</em> our new principal.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'is + not'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">Who is</em> she?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'who + is + subject?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "Who" question:',
        sentence: 'They are my classmates.',
        answers: [
          'who are they'
        ],
        hint: 'They is plural \u2192 "are". Pattern: Who + are + they?',
        orderingWords: ['Who', 'are', 'they', '?']
      }
    },
    {
      id: 'origin',
      emoji: '\uD83D\uDC23',
      label: 'Origin',
      whWord: 'Where\u2026from?',
      pattern: 'Where + is/are + subject + from?',
      note: 'Use "where \u2026 from?" to ask about someone\u2019s country or place of origin. The "from" stays at the end.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'He <em class="aux-highlight">is</em> from Mexico.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'he \u2192 3rd singular \u2192 is'
        },
        {
          type: 'negative',
          sentence: 'He <em class="aux-highlight">isn\u2019t</em> from Mexico.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'is + not'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">Where is</em> he <em class="aux-highlight">from</em>?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'where + is + subject + from?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "Where \u2026 from?" question:',
        sentence: 'They are from Japan.',
        answers: [
          'where are they from'
        ],
        hint: 'They is plural \u2192 "are". Keep "from" at the end. Pattern: Where + are + they + from?',
        orderingWords: ['Where', 'are', 'they', 'from', '?']
      }
    },
    {
      id: 'age',
      emoji: '\uD83C\uDF82',
      label: 'Age',
      whWord: 'How old\u2026?',
      pattern: 'How old + is/are + subject?',
      note: 'Use "how old" to ask about someone\u2019s or something\u2019s age. The verb "be" inverts after "how old".',
      examples: [
        {
          type: 'affirmative',
          sentence: 'The baby <em class="aux-highlight">is</em> one year old.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'the baby \u2192 3rd singular \u2192 is'
        },
        {
          type: 'negative',
          sentence: 'The baby <em class="aux-highlight">isn\u2019t</em> one year old.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'is + not'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">How old is</em> the baby?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'how old + is + subject?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "How old" question:',
        sentence: 'You are sixteen years old.',
        answers: [
          'how old are you'
        ],
        hint: 'You takes "are". Pattern: How old + are + you?',
        orderingWords: ['How', 'old', 'are', 'you', '?']
      }
    },
    {
      id: 'status',
      emoji: '\uD83D\uDE0E',
      label: 'Status',
      whWord: 'How\u2026?',
      pattern: 'How + am/is/are + subject?',
      note: 'Use "how" to ask about someone\u2019s condition, health, or emotional state.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'I <em class="aux-highlight">am</em> fine today.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'I \u2192 1st singular \u2192 am'
        },
        {
          type: 'negative',
          sentence: 'I <em class="aux-highlight">am not</em> fine today.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'am + not (no contraction: amn\u2019t is not used)'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">How am</em> I today?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'how + am + subject?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "How" question:',
        sentence: 'The students are nervous.',
        answers: [
          'how are the students'
        ],
        hint: 'The students is plural \u2192 "are". Pattern: How + are + the students?',
        orderingWords: ['How', 'are', 'the', 'students', '?']
      }
    },
    {
      id: 'description',
      emoji: '\uD83E\uDEE5',
      label: 'Description',
      whWord: 'What\u2026like?',
      pattern: 'What + is/are + subject + like?',
      note: 'Use "what \u2026 like?" to ask about personality or character. The "like" is a preposition, not a verb \u2014 it stays at the end.',
      examples: [
        {
          type: 'affirmative',
          sentence: 'He <em class="aux-highlight">is</em> very patient.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'he \u2192 3rd singular \u2192 is'
        },
        {
          type: 'negative',
          sentence: 'He <em class="aux-highlight">isn\u2019t</em> very patient.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'is + not'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">What is</em> he <em class="aux-highlight">like</em>?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'what + is + subject + like?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "What \u2026 like?" question:',
        sentence: 'Your sister is really creative.',
        answers: [
          'what is your sister like',
          'what is she like'
        ],
        hint: 'Your sister is singular \u2192 "is". Keep "like" at the end. Pattern: What + is + your sister + like?',
        orderingWords: ['What', 'is', 'your', 'sister', 'like', '?']
      }
    },
    {
      id: 'location',
      emoji: '\uD83D\uDCCD',
      label: 'Location',
      whWord: 'Where\u2026?',
      pattern: 'Where + is/are + subject?',
      note: 'Use "where" to ask about a place or location. The verb "be" inverts: Where is the museum? / Where are the keys?',
      examples: [
        {
          type: 'affirmative',
          sentence: 'The books <em class="aux-highlight">are</em> on the shelf.',
          label: 'Affirmative',
          labelClass: 'row-affirm',
          subjectTag: 'the books \u2192 plural \u2192 are'
        },
        {
          type: 'negative',
          sentence: 'The books <em class="aux-highlight">aren\u2019t</em> on the shelf.',
          label: 'Negative',
          labelClass: 'row-neg',
          subjectTag: 'are + not (contraction: aren\u2019t)'
        },
        {
          type: 'question',
          sentence: '<em class="aux-highlight">Where are</em> the books?',
          label: 'Wh-Question',
          labelClass: 'row-q',
          subjectTag: 'where + are + subject?'
        }
      ],
      quiz: {
        prompt: 'Transform this into a "Where" question:',
        sentence: 'The museum is downtown.',
        answers: [
          'where is the museum'
        ],
        hint: 'The museum is singular \u2192 "is". Pattern: Where + is + the museum?',
        orderingWords: ['Where', 'is', 'the', 'museum', '?']
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
      .replace(/isn't/g, 'is not')
      .replace(/aren't/g, 'are not')
      .replace(/what's/g, 'what is')
      .replace(/who's/g, 'who is')
      .replace(/where's/g, 'where is')
      .replace(/how's/g, 'how is');
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
      feedback.innerHTML = `<strong>&#10003; Correct!</strong> Great job \u2014 you inverted the verb "be" correctly.`;

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
