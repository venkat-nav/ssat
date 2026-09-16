/* ==========================================================================
   storage.js — persistence layer for the Verbal section
   - Primary storage: localStorage (survives reloads, per-browser)
   - Backup/portable storage: export/import a JSON file via the Downloads
     folder, so a student's word list can move between devices/browsers.
   ========================================================================== */

const Storage = (() => {
  const KEY_WORDS = 'ssat_verbal_words_v1';
  const KEY_HISTORY = 'ssat_verbal_quiz_history_v1';

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (err) {
      console.warn('SSAT Prep: could not parse stored data, using fallback.', err);
      return fallback;
    }
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `w_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getWords() {
    const words = safeParse(localStorage.getItem(KEY_WORDS), []);
    return Array.isArray(words) ? words : [];
  }

  function saveWords(words) {
    localStorage.setItem(KEY_WORDS, JSON.stringify(words));
  }

  function normalizeList(list) {
    return Array.from(
      new Set(
        (list || [])
          .map((s) => String(s).trim())
          .filter(Boolean)
      )
    );
  }

  function addWord({ word, partOfSpeech, meaning, synonyms, antonyms }) {
    const words = getWords();
    const entry = {
      id: makeId(),
      word: word.trim(),
      partOfSpeech: (partOfSpeech || '').trim(),
      meaning: meaning.trim(),
      synonyms: normalizeList(synonyms),
      antonyms: normalizeList(antonyms),
      addedAt: new Date().toISOString(),
      stats: { seen: 0, correct: 0, incorrect: 0, lastReviewed: null },
    };
    words.push(entry);
    saveWords(words);
    return entry;
  }

  function updateWord(id, updates) {
    const words = getWords();
    const idx = words.findIndex((w) => w.id === id);
    if (idx === -1) return null;
    const next = { ...words[idx], ...updates };
    if (updates.synonyms) next.synonyms = normalizeList(updates.synonyms);
    if (updates.antonyms) next.antonyms = normalizeList(updates.antonyms);
    words[idx] = next;
    saveWords(words);
    return next;
  }

  function deleteWord(id) {
    const words = getWords().filter((w) => w.id !== id);
    saveWords(words);
    return words;
  }

  function clearAllWords() {
    saveWords([]);
  }

  function recordAttempt(id, wasCorrect) {
    const words = getWords();
    const idx = words.findIndex((w) => w.id === id);
    if (idx === -1) return;
    const stats = words[idx].stats || { seen: 0, correct: 0, incorrect: 0 };
    stats.seen = (stats.seen || 0) + 1;
    if (wasCorrect) stats.correct = (stats.correct || 0) + 1;
    else stats.incorrect = (stats.incorrect || 0) + 1;
    stats.lastReviewed = new Date().toISOString();
    words[idx].stats = stats;
    saveWords(words);
  }

  function computeMastery(word) {
    const stats = word.stats || {};
    const seen = stats.seen || 0;
    if (seen === 0) return 'new';
    const accuracy = (stats.correct || 0) / seen;
    if (seen >= 3 && accuracy >= 0.8) return 'mastered';
    return 'learning';
  }

  function getHistory() {
    const history = safeParse(localStorage.getItem(KEY_HISTORY), []);
    return Array.isArray(history) ? history : [];
  }

  function addHistoryEntry(entry) {
    const history = getHistory();
    history.push({ ...entry, date: new Date().toISOString() });
    // keep the most recent 50 attempts
    const trimmed = history.slice(-50);
    localStorage.setItem(KEY_HISTORY, JSON.stringify(trimmed));
    return trimmed;
  }

  function getStats() {
    const words = getWords();
    const history = getHistory();
    const mastered = words.filter((w) => computeMastery(w) === 'mastered').length;
    const bestScore = history.reduce((best, h) => {
      if (!h.total) return best;
      const pct = Math.round((h.score / h.total) * 100);
      return pct > best ? pct : best;
    }, 0);
    return {
      wordCount: words.length,
      masteredCount: mastered,
      quizCount: history.length,
      bestScore,
    };
  }

  function downloadFile(filename, contents, mime) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportWords() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'ssat-prep-verbal',
      version: 1,
      words: getWords(),
      history: getHistory(),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(
      `ssat-verbal-words-${stamp}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }

  function importWordsFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const words = Array.isArray(data.words) ? data.words : Array.isArray(data) ? data : null;
          if (!words) throw new Error('That file does not look like a word bank export.');
          resolve({ words, history: Array.isArray(data.history) ? data.history : [] });
        } catch (err) {
          reject(new Error('That file could not be read as a word bank backup: ' + err.message));
        }
      };
      reader.readAsText(file);
    });
  }

  function mergeWords(incomingWords) {
    const existing = getWords();
    const byWord = new Map(existing.map((w) => [w.word.toLowerCase(), w]));
    incomingWords.forEach((w) => {
      if (!w || !w.word || !w.meaning) return;
      const key = w.word.toLowerCase();
      if (byWord.has(key)) return; // keep existing entry, skip duplicate
      byWord.set(key, {
        id: w.id && !existing.some((e) => e.id === w.id) ? w.id : makeId(),
        word: w.word.trim(),
        partOfSpeech: w.partOfSpeech || '',
        meaning: w.meaning.trim(),
        synonyms: normalizeList(w.synonyms),
        antonyms: normalizeList(w.antonyms),
        addedAt: w.addedAt || new Date().toISOString(),
        stats: w.stats || { seen: 0, correct: 0, incorrect: 0, lastReviewed: null },
      });
    });
    const merged = Array.from(byWord.values());
    saveWords(merged);
    return merged;
  }

  function replaceWords(incomingWords) {
    const cleaned = incomingWords
      .filter((w) => w && w.word && w.meaning)
      .map((w) => ({
        id: w.id || makeId(),
        word: w.word.trim(),
        partOfSpeech: w.partOfSpeech || '',
        meaning: w.meaning.trim(),
        synonyms: normalizeList(w.synonyms),
        antonyms: normalizeList(w.antonyms),
        addedAt: w.addedAt || new Date().toISOString(),
        stats: w.stats || { seen: 0, correct: 0, incorrect: 0, lastReviewed: null },
      }));
    saveWords(cleaned);
    return cleaned;
  }

  const KEY_SEED_APPLIED = 'ssat_verbal_seed_applied_v4';

  // Runs once per browser: appends a starter word list to whatever's already
  // in the bank, skipping any word already present (by spelling). Safe to
  // call on every page load — after the first run it's a no-op forever,
  // even if every word is later deleted.
  function seedWordsOnce(seedList) {
    if (localStorage.getItem(KEY_SEED_APPLIED)) return;
    mergeWords(seedList);
    localStorage.setItem(KEY_SEED_APPLIED, '1');
  }

  return {
    getWords,
    saveWords,
    addWord,
    updateWord,
    deleteWord,
    clearAllWords,
    recordAttempt,
    computeMastery,
    getHistory,
    addHistoryEntry,
    getStats,
    exportWords,
    importWordsFromFile,
    mergeWords,
    replaceWords,
    seedWordsOnce,
  };
})();

if (typeof SEED_WORDS !== 'undefined') {
  Storage.seedWordsOnce(SEED_WORDS);
}
