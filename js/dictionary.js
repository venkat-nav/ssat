/* ==========================================================================
   dictionary.js — best-effort word lookup to help fill the Add Word form.
   Uses two free, no-key, CORS-friendly APIs:
     - Datamuse (synonyms + antonyms)
     - dictionaryapi.dev (definition + part of speech)
   Every request fails soft: if the student is offline or a word isn't
   found, the form is simply left for them to fill in by hand.
   ========================================================================== */

const Dictionary = (() => {
  const TIMEOUT_MS = 6000;

  function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  async function fetchSynonyms(word) {
    try {
      const res = await fetchWithTimeout(
        `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=8`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((d) => d.word);
    } catch (err) {
      return [];
    }
  }

  async function fetchAntonyms(word) {
    try {
      const res = await fetchWithTimeout(
        `https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=8`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((d) => d.word);
    } catch (err) {
      return [];
    }
  }

  async function fetchDefinition(word) {
    try {
      const res = await fetchWithTimeout(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );
      if (!res.ok) return { meaning: '', partOfSpeech: '', synonyms: [], antonyms: [] };
      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : null;
      const meaningObj = entry && entry.meanings && entry.meanings[0];
      const def = meaningObj && meaningObj.definitions && meaningObj.definitions[0];
      return {
        meaning: (def && def.definition) || '',
        partOfSpeech: (meaningObj && meaningObj.partOfSpeech) || '',
        synonyms: (def && def.synonyms) || [],
        antonyms: (def && def.antonyms) || [],
      };
    } catch (err) {
      return { meaning: '', partOfSpeech: '', synonyms: [], antonyms: [] };
    }
  }

  function dedupeCap(list, cap) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= cap) break;
    }
    return out;
  }

  async function lookup(word) {
    const clean = word.trim();
    if (!clean) throw new Error('Enter a word first.');

    const [synFromDatamuse, antFromDatamuse, defResult] = await Promise.all([
      fetchSynonyms(clean),
      fetchAntonyms(clean),
      fetchDefinition(clean),
    ]);

    const synonyms = dedupeCap([...defResult.synonyms, ...synFromDatamuse], 6);
    const antonyms = dedupeCap([...defResult.antonyms, ...antFromDatamuse], 6);

    const found = Boolean(defResult.meaning || synonyms.length || antonyms.length);

    return {
      found,
      meaning: defResult.meaning,
      partOfSpeech: defResult.partOfSpeech,
      synonyms,
      antonyms,
    };
  }

  return { lookup };
})();
