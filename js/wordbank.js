/* ==========================================================================
   wordbank.js — Word Bank tab: add/edit/delete words, search, lookup,
   export/import backups.
   ========================================================================== */

(() => {
  const els = {
    toggle: document.getElementById('add-word-toggle'),
    body: document.getElementById('add-word-body'),
    form: document.getElementById('add-word-form'),
    word: document.getElementById('input-word'),
    pos: document.getElementById('input-pos'),
    meaning: document.getElementById('input-meaning'),
    synonyms: document.getElementById('input-synonyms'),
    antonyms: document.getElementById('input-antonyms'),
    editId: document.getElementById('input-edit-id'),
    lookupBtn: document.getElementById('lookup-btn'),
    lookupStatus: document.getElementById('lookup-status'),
    saveBtn: document.getElementById('save-word-btn'),
    cancelBtn: document.getElementById('cancel-word-btn'),
    search: document.getElementById('search-input'),
    countLabel: document.getElementById('word-count-label'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
    grid: document.getElementById('word-grid'),
    emptyState: document.getElementById('empty-state'),
  };

  // Not every element exists on every page — bail if this isn't the Verbal page.
  if (!els.form || !els.grid) return;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function splitList(str) {
    return (str || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function setLookupStatus(text, kind) {
    els.lookupStatus.textContent = text;
    els.lookupStatus.classList.remove('is-error', 'is-ok');
    if (kind) els.lookupStatus.classList.add(kind === 'ok' ? 'is-ok' : 'is-error');
  }

  function openPanel() {
    els.body.hidden = false;
    els.toggle.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    els.body.hidden = true;
    els.toggle.setAttribute('aria-expanded', 'false');
  }

  function resetForm() {
    els.form.reset();
    els.editId.value = '';
    els.saveBtn.textContent = 'Save Word';
    setLookupStatus('', null);
  }

  function startEdit(word) {
    els.editId.value = word.id;
    els.word.value = word.word;
    els.pos.value = word.partOfSpeech || '';
    els.meaning.value = word.meaning;
    els.synonyms.value = (word.synonyms || []).join(', ');
    els.antonyms.value = (word.antonyms || []).join(', ');
    els.saveBtn.textContent = 'Update Word';
    setLookupStatus('', null);
    openPanel();
    els.word.focus();
    els.body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function mastery(word) {
    return Storage.computeMastery(word);
  }

  function masteryLabel(level) {
    return level === 'mastered' ? 'Mastered' : level === 'learning' ? 'Learning' : 'New';
  }

  function renderWordCard(word) {
    const level = mastery(word);
    const synChips = (word.synonyms || [])
      .map((s) => `<span class="chip chip-syn">${escapeHtml(s)}</span>`)
      .join('');
    const antChips = (word.antonyms || [])
      .map((s) => `<span class="chip chip-ant">${escapeHtml(s)}</span>`)
      .join('');

    return `
      <article class="word-card" data-id="${word.id}">
        <div class="word-card-head">
          <div><span class="word">${escapeHtml(word.word)}</span>${
            word.partOfSpeech ? `<span class="pos">${escapeHtml(word.partOfSpeech)}</span>` : ''
          }</div>
          <span class="badge badge-${level}">${masteryLabel(level)}</span>
        </div>
        <p class="meaning">${escapeHtml(word.meaning)}</p>
        ${word.synonyms && word.synonyms.length ? `<p class="chip-label">Synonyms</p><div class="chip-group">${synChips}</div>` : ''}
        ${word.antonyms && word.antonyms.length ? `<p class="chip-label">Antonyms</p><div class="chip-group">${antChips}</div>` : ''}
        <div class="word-card-actions">
          <button type="button" class="btn btn-sm edit-btn">Edit</button>
          <button type="button" class="btn btn-sm btn-danger delete-btn">Delete</button>
        </div>
      </article>
    `;
  }

  function render() {
    const all = Storage.getWords();
    const term = (els.search.value || '').trim().toLowerCase();
    const filtered = term
      ? all.filter(
          (w) => w.word.toLowerCase().includes(term) || w.meaning.toLowerCase().includes(term)
        )
      : all;

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );

    els.countLabel.textContent = `${all.length} word${all.length === 1 ? '' : 's'}`;

    if (all.length === 0) {
      els.emptyState.hidden = false;
      els.emptyState.querySelector('h3').textContent = 'Your word bank is empty';
      els.emptyState.querySelector('p').textContent =
        "Add the first hard word above — you need at least a few before a quiz can generate good multiple-choice options.";
      els.grid.innerHTML = '';
      return;
    }

    if (sorted.length === 0) {
      els.emptyState.hidden = false;
      els.emptyState.querySelector('h3').textContent = 'No matches';
      els.emptyState.querySelector('p').textContent = `Nothing in your word bank matches "${term}".`;
      els.grid.innerHTML = '';
      return;
    }

    els.emptyState.hidden = true;
    els.grid.innerHTML = sorted.map(renderWordCard).join('');
  }

  // -- Add / edit / delete -------------------------------------------------

  els.toggle.addEventListener('click', () => {
    const isOpen = !els.body.hidden;
    if (isOpen) {
      closePanel();
      resetForm();
    } else {
      openPanel();
      els.word.focus();
    }
  });

  els.cancelBtn.addEventListener('click', () => {
    closePanel();
    resetForm();
  });

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = els.word.value.trim();
    const meaning = els.meaning.value.trim();
    if (!word || !meaning) {
      setLookupStatus('A word and a meaning are both required.', 'error');
      return;
    }

    const payload = {
      word,
      partOfSpeech: els.pos.value,
      meaning,
      synonyms: splitList(els.synonyms.value),
      antonyms: splitList(els.antonyms.value),
    };

    const editId = els.editId.value;
    if (editId) {
      Storage.updateWord(editId, payload);
      closePanel();
      resetForm();
    } else {
      Storage.addWord(payload);
      els.form.reset();
      els.editId.value = '';
      setLookupStatus(`Saved "${word}" ✓`, 'ok');
      els.word.focus();
    }
    render();
  });

  els.grid.addEventListener('click', (e) => {
    const card = e.target.closest('.word-card');
    if (!card) return;
    const id = card.dataset.id;
    const words = Storage.getWords();
    const word = words.find((w) => w.id === id);
    if (!word) return;

    if (e.target.closest('.edit-btn')) {
      startEdit(word);
    } else if (e.target.closest('.delete-btn')) {
      if (window.confirm(`Delete "${word.word}" from your word bank?`)) {
        Storage.deleteWord(id);
        render();
      }
    }
  });

  els.search.addEventListener('input', render);

  // -- Lookup ---------------------------------------------------------------

  els.lookupBtn.addEventListener('click', async () => {
    const word = els.word.value.trim();
    if (!word) {
      setLookupStatus('Enter a word first.', 'error');
      els.word.focus();
      return;
    }

    els.lookupBtn.disabled = true;
    setLookupStatus('Looking up definitions, synonyms & antonyms…', null);

    try {
      const result = await Dictionary.lookup(word);
      if (!result.found) {
        setLookupStatus(`No dictionary results for "${word}" — fill in the fields yourself.`, 'error');
        els.synonyms.value = '';
        els.antonyms.value = '';
        return;
      }

      // Look Up always reflects the word currently typed in the field — replace
      // synonyms/antonyms with fresh results (clearing them if none were found)
      // rather than merging, so leftover data from a previously looked-up word
      // never lingers and gets mistaken for a real match.
      if (result.meaning) els.meaning.value = result.meaning;
      if (result.partOfSpeech) {
        const match = Array.from(els.pos.options).find(
          (o) => o.value === result.partOfSpeech.toLowerCase()
        );
        if (match) els.pos.value = match.value;
      }
      els.synonyms.value = result.synonyms.join(', ');
      els.antonyms.value = result.antonyms.join(', ');

      const foundParts = [];
      if (result.meaning) foundParts.push('a definition');
      foundParts.push(`${result.synonyms.length} synonym(s)`);
      foundParts.push(`${result.antonyms.length} antonym(s)`);
      setLookupStatus(`Found ${foundParts.join(', ')}. Review before saving.`, 'ok');
    } catch (err) {
      setLookupStatus("Couldn't reach the dictionary lookup — check your connection, or fill in the fields yourself.", 'error');
    } finally {
      els.lookupBtn.disabled = false;
    }
  });

  // -- Export / import --------------------------------------------------------

  els.exportBtn.addEventListener('click', () => {
    Storage.exportWords();
  });

  els.importBtn.addEventListener('click', () => {
    els.importFile.click();
  });

  els.importFile.addEventListener('change', async () => {
    const file = els.importFile.files[0];
    if (!file) return;
    try {
      const data = await Storage.importWordsFromFile(file);
      const beforeCount = Storage.getWords().length;
      const proceed = window.confirm(
        `This backup has ${data.words.length} word(s). Import them into your current bank of ${beforeCount}? Words you already have (matched by spelling) will be kept as-is — this only adds new ones.`
      );
      if (proceed) {
        const merged = Storage.mergeWords(data.words);
        render();
        window.alert(`Import complete. Your word bank now has ${merged.length} word(s).`);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      els.importFile.value = '';
    }
  });

  render();

  // Expose for quiz.js to refresh mastery badges after a quiz session.
  window.WordBank = { render };
})();
