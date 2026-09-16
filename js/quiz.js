/* ==========================================================================
   quiz.js — Practice Quiz tab: builds multiple-choice questions (meaning,
   synonym, antonym, analogy) from the word bank and runs the scantron-style
   quiz.
   ========================================================================== */

(() => {
  const els = {
    setup: document.getElementById('quiz-setup'),
    qtMeaning: document.getElementById('qt-meaning'),
    qtSynonym: document.getElementById('qt-synonym'),
    qtAntonym: document.getElementById('qt-antonym'),
    qtAnalogy: document.getElementById('qt-analogy'),
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

  const TYPE_LABELS = {
    meaning: 'meaning',
    synonym: 'synonym',
    antonym: 'antonym',
    analogy: 'analogy',
  };

  function readConfig() {
    let type = 'meaning';
    if (els.qtSynonym.checked) type = 'synonym';
    else if (els.qtAntonym.checked) type = 'antonym';
    else if (els.qtAnalogy.checked) type = 'analogy';
    return {
      type,
      count: els.qtCount.value === 'all' ? 'all' : parseInt(els.qtCount.value, 10),
      learningOnly: els.qtLearningOnly.checked,
    };
  }

  // -- Question pool ---------------------------------------------------------
  // Each quiz drills exactly one skill — meaning, synonym, or antonym — never
  // a mix, so a student can focus practice on the one they're weak on.

  function eligibleWords(words, type, learningOnly) {
    const pool = learningOnly ? words.filter((w) => Storage.computeMastery(w) !== 'mastered') : words;
    if (type === 'synonym') return pool.filter((w) => w.synonyms && w.synonyms.length);
    if (type === 'antonym') return pool.filter((w) => w.antonyms && w.antonyms.length);
    return pool; // every word has a meaning
  }

  // Shuffles `pool`, drops anything in `excludeKeys` (case-insensitive) or
  // already picked, and returns up to `cap` items — the shared distractor
  // picker used by every question type below.
  function pickWrongOptions(pool, excludeKeys, cap) {
    const seen = new Set();
    const out = [];
    shuffle(pool).forEach((w) => {
      const key = w.toLowerCase();
      if (excludeKeys.has(key) || seen.has(key)) return;
      seen.add(key);
      out.push(w);
    });
    return out.slice(0, cap);
  }

  function buildOptions(correct, wrongPool, excludeKeys) {
    const finalWrong = pickWrongOptions(wrongPool, excludeKeys, 3);
    return shuffle([
      { text: correct, correct: true },
      ...finalWrong.map((text) => ({ text, correct: false })),
    ]);
  }

  function buildQuestion(word, type, allWords) {
    const others = allWords.filter((w) => w.id !== word.id);
    let correct, wrongPool, instruction, explanation, excludeKeys;

    if (type === 'meaning') {
      correct = word.meaning;
      wrongPool = others.map((w) => w.meaning);
      excludeKeys = new Set([correct.toLowerCase()]);
      instruction = 'Choose the meaning of:';
      explanation = `"${word.word.toUpperCase()}" means "${correct}."`;
    } else if (type === 'synonym') {
      correct = pickRandom(word.synonyms);
      excludeKeys = new Set([correct.toLowerCase(), ...word.synonyms.map((s) => s.toLowerCase())]);
      wrongPool = [
        ...(word.antonyms || []), // real SSAT-style trick: the opposite word
        ...others.map((w) => w.word),
      ];
      instruction = 'Choose the word that means the SAME as:';
      explanation = `"${word.word.toUpperCase()}" is close in meaning to "${correct}."`;
    } else {
      correct = pickRandom(word.antonyms);
      excludeKeys = new Set([correct.toLowerCase(), ...word.antonyms.map((s) => s.toLowerCase())]);
      wrongPool = [...(word.synonyms || []), ...others.map((w) => w.word)];
      instruction = 'Choose the word that means the OPPOSITE of:';
      explanation = `"${word.word.toUpperCase()}" is the opposite of "${correct}."`;
    }

    const options = buildOptions(correct, wrongPool, excludeKeys);

    return { type, word, target: word.word, instruction, correctAnswer: correct, options, explanation };
  }

  // -- Analogies ---------------------------------------------------------
  // "A is to B as C is to ___" — A:B and C:D always share the SAME
  // relationship (both synonym pairs, or both antonym pairs) so the
  // question has one defensible answer; different questions in the same
  // quiz can freely mix synonym-based and antonym-based analogies.

  function pairUp(pool) {
    const shuffled = shuffle(pool);
    const pairs = [];
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }
    return pairs;
  }

  function buildAnalogyQuestion(wordA, wordC, relation, allWords) {
    const listA = relation === 'synonym' ? wordA.synonyms : wordA.antonyms;
    const listC = relation === 'synonym' ? wordC.synonyms : wordC.antonyms;
    const oppositeListC = relation === 'synonym' ? wordC.antonyms || [] : wordC.synonyms || [];

    const wordB = pickRandom(listA);
    const correct = pickRandom(listC);
    const others = allWords.filter((w) => w.id !== wordA.id && w.id !== wordC.id);
    const excludeKeys = new Set([correct.toLowerCase(), ...listC.map((s) => s.toLowerCase())]);
    const wrongPool = [
      ...oppositeListC, // trap: the reversed relationship, for the same word C
      ...others.map((w) => w.word),
    ];

    const options = buildOptions(correct, wrongPool, excludeKeys);
    const relLabel = relation === 'synonym' ? 'means the same as' : 'is the opposite of';

    return {
      type: 'analogy',
      relation,
      word: wordC, // the word actually being tested — practice stats credit this one
      target: `${wordA.word.toUpperCase()} : ${wordB.toUpperCase()} :: ${wordC.word.toUpperCase()} : ?`,
      instruction: 'Complete the analogy — find the matching relationship:',
      correctAnswer: correct,
      options,
      explanation: `Just as "${wordA.word.toUpperCase()}" ${relLabel} "${wordB}," "${wordC.word.toUpperCase()}" ${relLabel} "${correct}."`,
      isAnalogy: true,
    };
  }

  function generateAnalogyQuestions(config) {
    const words = Storage.getWords();
    const synQuestions = pairUp(eligibleWords(words, 'synonym', config.learningOnly)).map(([a, c]) =>
      buildAnalogyQuestion(a, c, 'synonym', words)
    );
    const antQuestions = pairUp(eligibleWords(words, 'antonym', config.learningOnly)).map(([a, c]) =>
      buildAnalogyQuestion(a, c, 'antonym', words)
    );

    const all = shuffle([...synQuestions, ...antQuestions]).filter((q) => q.options.length >= 2);
    if (all.length === 0) return { questions: [], available: 0, words };

    const desired = config.count === 'all' ? all.length : Math.min(config.count, all.length);
    return { questions: all.slice(0, desired), available: all.length, words };
  }

  function generateQuestions(config) {
    if (config.type === 'analogy') return generateAnalogyQuestions(config);

    const words = Storage.getWords();
    const candidates = eligibleWords(words, config.type, config.learningOnly);
    if (candidates.length === 0) return { questions: [], available: 0, words };

    const shuffled = shuffle(candidates);
    const desired = config.count === 'all' ? shuffled.length : Math.min(config.count, shuffled.length);
    const chosen = shuffled.slice(0, desired);

    const questions = chosen
      .map((w) => buildQuestion(w, config.type, words))
      .filter((q) => q.options.length >= 2);

    return { questions, available: candidates.length, words };
  }

  function regenerateFromMissed(m, words) {
    if (m.type === 'analogy') {
      const pool = eligibleWords(words, m.relation, false).filter((w) => w.id !== m.word.id);
      if (pool.length === 0) return null;
      return buildAnalogyQuestion(pickRandom(pool), m.word, m.relation, words);
    }
    return buildQuestion(m.word, m.type, words);
  }

  // -- Setup screen / live availability preview ------------------------------

  function updatePreview() {
    const config = readConfig();
    const { questions } = generateQuestions(config);
    if (questions.length === 0) {
      const total = Storage.getWords().length;
      if (total === 0) {
        els.setupStatus.textContent = 'Your word bank is empty — add some words on the Word Bank tab first.';
      } else if (config.type === 'analogy') {
        els.setupStatus.textContent =
          'You need at least 2 words with synonyms, or 2 with antonyms, to build analogy questions — add some on the Word Bank tab.';
      } else {
        const need = config.type === 'meaning' ? 'a meaning' : `${config.type}s`;
        els.setupStatus.textContent = `None of your words have ${need} recorded yet — add some on the Word Bank tab, or pick a different quiz type.`;
      }
      els.setupStatus.className = 'lookup-status is-error';
      els.startBtn.disabled = true;
      return;
    }
    els.setupStatus.textContent = `${questions.length} ${TYPE_LABELS[config.type]} question${questions.length === 1 ? '' : 's'} ready with your current word bank.`;
    els.setupStatus.className = 'lookup-status is-ok';
    els.startBtn.disabled = false;
  }

  [els.qtMeaning, els.qtSynonym, els.qtAntonym, els.qtAnalogy, els.qtCount, els.qtLearningOnly].forEach((el) => {
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
    els.target.classList.toggle('is-analogy', Boolean(q.isAnalogy));

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
      els.feedback.textContent = `Correct — ${q.explanation}`;
      els.feedback.classList.add('is-active', 'is-correct');
    } else {
      els.feedback.textContent = `Not quite. ${q.explanation}`;
      els.feedback.classList.add('is-active', 'is-wrong');
      session.missed.push({
        word: q.word,
        type: q.type,
        relation: q.relation,
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
          <span class="text-soft">(${m.type === 'analogy' ? `${m.relation} analogy` : m.type})</span><br />
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
      .map((m) => regenerateFromMissed(m, words))
      .filter((q) => q && q.options.length >= 2);
    if (retryQuestions.length === 0) return;
    startSession(retryQuestions);
  });

  els.newQuizBtn.addEventListener('click', () => {
    updatePreview();
    showScreen('setup');
  });
})();
