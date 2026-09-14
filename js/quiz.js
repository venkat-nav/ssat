/* ==========================================================================
   quiz.js — Practice Quiz tab: builds multiple-choice questions (meaning,
   synonym, antonym) from the word bank and runs the scantron-style quiz.
   ========================================================================== */

(() => {
  const els = {
    setup: document.getElementById('quiz-setup'),
    qtMeaning: document.getElementById('qt-meaning'),
    qtSynonym: document.getElementById('qt-synonym'),
    qtAntonym: document.getElementById('qt-antonym'),
    qtCount: document.getElementById('qt-count'),
    qtLearningOnly: document.getElementById('qt-learning-only'),
    setupStatus: document.getElementById('quiz-setup-status'),
    startBtn: document.getElementById('start-quiz-btn'),

    play: document.getElementById('quiz-play'),
    playInner: document.getElementById('quiz-play-inner'),
    progressLabel: document.getElementById('quiz-progress-label'),
    scoreLabel: document.getElementById('quiz-score-label'),
    progressFill: document.getElementById('progress-fill'),
    instruction: document.getElementById('quiz-instruction'),
    target: document.getElementById('quiz-target'),
    bubbleList: document.getElementById('bubble-list'),
    feedback: document.getElementById('quiz-feedback'),
    submitBtn: document.getElementById('submit-answer-btn'),
    nextBtn: document.getElementById('next-question-btn'),

    result: document.getElementById('quiz-result'),
    resultScore: document.getElementById('result-score'),
    resultPct: document.getElementById('result-pct'),
    missedList: document.getElementById('missed-list'),
    retryBtn: document.getElementById('retry-missed-btn'),
    newQuizBtn: document.getElementById('new-quiz-btn'),
  };

  if (!els.setup) return; // not on the Verbal page

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  let session = null; // { questions, index, score, missed: [] }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function readConfig() {
    return {
      types: {
        meaning: els.qtMeaning.checked,
        synonym: els.qtSynonym.checked,
        antonym: els.qtAntonym.checked,
      },
      count: els.qtCount.value === 'all' ? 'all' : parseInt(els.qtCount.value, 10),
      learningOnly: els.qtLearningOnly.checked,
    };
  }

  // -- Question pool ---------------------------------------------------------

  function eligibleCandidates(words, types, learningOnly) {
    const pool = learningOnly ? words.filter((w) => Storage.computeMastery(w) !== 'mastered') : words;
    return pool
      .map((w) => {
        const eligibleTypes = [];
        if (types.meaning) eligibleTypes.push('meaning');
        if (types.synonym && w.synonyms && w.synonyms.length) eligibleTypes.push('synonym');
        if (types.antonym && w.antonyms && w.antonyms.length) eligibleTypes.push('antonym');
        return { word: w, eligibleTypes };
      })
      .filter((c) => c.eligibleTypes.length > 0);
  }

  function buildQuestion(word, type, allWords) {
    const others = allWords.filter((w) => w.id !== word.id);
    let correct, wrongPool, instruction;

    if (type === 'meaning') {
      correct = word.meaning;
      const correctKey = correct.toLowerCase();
      wrongPool = others.map((w) => w.meaning).filter((m) => m.toLowerCase() !== correctKey);
      instruction = 'Choose the meaning of:';
    } else if (type === 'synonym') {
      correct = pickRandom(word.synonyms);
      const excludeKeys = new Set([correct.toLowerCase(), ...word.synonyms.map((s) => s.toLowerCase())]);
      wrongPool = [
        ...(word.antonyms || []), // real SSAT-style trick: the opposite word
        ...others.map((w) => w.word),
      ].filter((w) => !excludeKeys.has(w.toLowerCase()));
      instruction = 'Choose the word that means the SAME as:';
    } else {
      correct = pickRandom(word.antonyms);
      const excludeKeys = new Set([correct.toLowerCase(), ...word.antonyms.map((s) => s.toLowerCase())]);
      wrongPool = [
        ...(word.synonyms || []),
        ...others.map((w) => w.word),
      ].filter((w) => !excludeKeys.has(w.toLowerCase()));
      instruction = 'Choose the word that means the OPPOSITE of:';
    }

    // dedupe wrong pool case-insensitively, then shuffle and cap at 3
    const seen = new Set();
    const wrongOptions = [];
    shuffle(wrongPool).forEach((w) => {
      const key = w.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      wrongOptions.push(w);
    });

    const finalWrong = wrongOptions.slice(0, 3);
    const options = shuffle([
      { text: correct, correct: true },
      ...finalWrong.map((text) => ({ text, correct: false })),
    ]);

    return {
      type,
      word,
      target: word.word,
      instruction,
      correctAnswer: correct,
      options,
    };
  }

  function generateQuestions(config) {
    const words = Storage.getWords();
    const candidates = eligibleCandidates(words, config.types, config.learningOnly);
    if (candidates.length === 0) return { questions: [], available: 0, words };

    const shuffled = shuffle(candidates);
    const desired = config.count === 'all' ? shuffled.length : Math.min(config.count, shuffled.length);
    const chosen = shuffled.slice(0, desired);

    const questions = chosen
      .map((c) => buildQuestion(c.word, pickRandom(c.eligibleTypes), words))
      .filter((q) => q.options.length >= 2);

    return { questions, available: candidates.length, words };
  }

  // -- Setup screen / live availability preview ------------------------------

  function updatePreview() {
    const config = readConfig();
    if (!config.types.meaning && !config.types.synonym && !config.types.antonym) {
      els.setupStatus.textContent = 'Pick at least one question type.';
      els.setupStatus.className = 'lookup-status is-error';
      els.startBtn.disabled = true;
      return;
    }
    const { questions } = generateQuestions(config);
    if (questions.length === 0) {
      const total = Storage.getWords().length;
      els.setupStatus.textContent =
        total === 0
          ? 'Your word bank is empty — add some words on the Word Bank tab first.'
          : "No words match these settings yet. Try adding synonyms/antonyms to your words, or check 'Meaning'.";
      els.setupStatus.className = 'lookup-status is-error';
      els.startBtn.disabled = true;
      return;
    }
    els.setupStatus.textContent = `${questions.length} question${questions.length === 1 ? '' : 's'} ready with your current word bank.`;
    els.setupStatus.className = 'lookup-status is-ok';
    els.startBtn.disabled = false;
  }

  [els.qtMeaning, els.qtSynonym, els.qtAntonym, els.qtCount, els.qtLearningOnly].forEach((el) => {
    el.addEventListener('change', updatePreview);
  });

  document.getElementById('tab-btn-quiz').addEventListener('click', updatePreview);
  updatePreview();

  // -- Running the quiz -------------------------------------------------------

  function showScreen(name) {
    els.setup.hidden = name !== 'setup';
    els.play.hidden = name !== 'play';
    els.result.hidden = name !== 'result';
  }

  function startSession(questions) {
    session = { questions, index: 0, score: 0, missed: [] };
    showScreen('play');
    renderQuestion();
  }

  els.startBtn.addEventListener('click', () => {
    const config = readConfig();
    const { questions } = generateQuestions(config);
    if (questions.length === 0) return;
    startSession(questions);
  });

  function renderQuestion() {
    const q = session.questions[session.index];
    const total = session.questions.length;

    els.progressLabel.textContent = `Question ${session.index + 1} / ${total}`;
    els.scoreLabel.textContent = `Score: ${session.score}`;
    els.progressFill.style.width = `${(session.index / total) * 100}%`;

    els.instruction.textContent = q.instruction;
    els.target.textContent = q.target.toUpperCase();

    els.bubbleList.innerHTML = q.options
      .map(
        (opt, i) => `
        <button type="button" class="bubble-option" data-index="${i}" role="radio" aria-checked="false">
          <span class="bubble">${LETTERS[i]}</span>
          <span class="option-text">${escapeHtml(opt.text)}</span>
        </button>`
      )
      .join('');

    els.feedback.className = 'quiz-feedback';
    els.feedback.textContent = '';
    els.submitBtn.hidden = false;
    els.submitBtn.disabled = true;
    els.nextBtn.hidden = true;

    els.playInner.classList.remove('quiz-card-anim');
    // eslint-disable-next-line no-unused-expressions
    els.playInner.offsetWidth; // reflow to restart animation
    els.playInner.classList.add('quiz-card-anim');

    q._selectedIndex = null;
    q._answered = false;
  }

  els.bubbleList.addEventListener('click', (e) => {
    const btn = e.target.closest('.bubble-option');
    if (!btn) return;
    const q = session.questions[session.index];
    if (q._answered) return;

    q._selectedIndex = parseInt(btn.dataset.index, 10);
    els.bubbleList.querySelectorAll('.bubble-option').forEach((b) => {
      const isSelected = b === btn;
      b.classList.toggle('is-selected', isSelected);
      b.setAttribute('aria-checked', String(isSelected));
    });
    els.submitBtn.disabled = false;
  });

  els.submitBtn.addEventListener('click', () => {
    const q = session.questions[session.index];
    if (q._selectedIndex === null || q._answered) return;
    q._answered = true;

    const chosen = q.options[q._selectedIndex];
    const isCorrect = Boolean(chosen.correct);

    els.bubbleList.querySelectorAll('.bubble-option').forEach((b, i) => {
      b.classList.add('is-disabled');
      b.setAttribute('disabled', 'true');
      if (q.options[i].correct) b.classList.add('is-correct');
      else if (i === q._selectedIndex) b.classList.add('is-wrong');
    });

    Storage.recordAttempt(q.word.id, isCorrect);

    if (isCorrect) {
      session.score += 1;
      els.feedback.textContent = `Correct — "${q.target.toUpperCase()}" ${
        q.type === 'meaning' ? 'means' : q.type === 'synonym' ? 'is close to' : 'is the opposite of'
      } "${q.correctAnswer}."`;
      els.feedback.classList.add('is-active', 'is-correct');
    } else {
      els.feedback.textContent = `Not quite. "${q.target.toUpperCase()}" ${
        q.type === 'meaning' ? 'means' : q.type === 'synonym' ? 'is close to' : 'is the opposite of'
      } "${q.correctAnswer}."`;
      els.feedback.classList.add('is-active', 'is-wrong');
      session.missed.push({
        word: q.word,
        type: q.type,
        yourAnswer: chosen.text,
        correctAnswer: q.correctAnswer,
        target: q.target,
      });
    }

    els.scoreLabel.textContent = `Score: ${session.score}`;
    els.submitBtn.hidden = true;
    els.nextBtn.hidden = false;
    els.nextBtn.textContent =
      session.index + 1 < session.questions.length ? 'Next Question' : 'See Results';
    els.nextBtn.focus();
  });

  els.nextBtn.addEventListener('click', () => {
    session.index += 1;
    if (session.index < session.questions.length) {
      renderQuestion();
    } else {
      finishSession();
    }
  });

  function finishSession() {
    const total = session.questions.length;
    const pct = total ? Math.round((session.score / total) * 100) : 0;

    Storage.addHistoryEntry({ score: session.score, total });

    els.progressFill.style.width = '100%';
    els.resultScore.textContent = `${session.score}/${total}`;
    els.resultPct.textContent = total ? `${pct}%` : '';

    if (session.missed.length === 0) {
      els.missedList.innerHTML = `<p class="text-soft center">Perfect score — every word answered correctly.</p>`;
      els.retryBtn.hidden = true;
    } else {
      els.retryBtn.hidden = false;
      els.missedList.innerHTML = session.missed
        .map(
          (m) => `
        <div class="missed-item">
          <span class="word">${escapeHtml(m.target)}</span>
          <span class="text-soft">(${m.type})</span><br />
          You answered <span class="your-answer">${escapeHtml(m.yourAnswer)}</span> —
          correct answer: <span class="right-answer">${escapeHtml(m.correctAnswer)}</span>
        </div>`
        )
        .join('');
    }

    showScreen('result');
    if (window.WordBank) window.WordBank.render();
  }

  els.retryBtn.addEventListener('click', () => {
    if (!session || session.missed.length === 0) return;
    const words = Storage.getWords();
    const retryQuestions = session.missed
      .map((m) => buildQuestion(m.word, m.type, words))
      .filter((q) => q.options.length >= 2);
    if (retryQuestions.length === 0) return;
    startSession(retryQuestions);
  });

  els.newQuizBtn.addEventListener('click', () => {
    updatePreview();
    showScreen('setup');
  });
})();
