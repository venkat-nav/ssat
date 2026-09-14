/* home.js — populates the practice-log stat strip on the homepage */
(() => {
  const stats = Storage.getStats();
  const wordsEl = document.getElementById('stat-words');
  const masteredEl = document.getElementById('stat-mastered');
  const quizzesEl = document.getElementById('stat-quizzes');
  const bestEl = document.getElementById('stat-best');

  if (wordsEl) wordsEl.textContent = stats.wordCount;
  if (masteredEl) masteredEl.textContent = stats.masteredCount;
  if (quizzesEl) quizzesEl.textContent = stats.quizCount;
  if (bestEl) bestEl.textContent = stats.quizCount ? `${stats.bestScore}%` : '—';
})();
