# SSAT Prep

A free, static SSAT practice site you can host on GitHub Pages — no backend, no build step, no account required. Everything a student enters is saved in their own browser.

**Live sections**

| Section | Status |
| --- | --- |
| Verbal (word bank + synonym/antonym/meaning quiz) | ✅ Built |
| Reading Comprehension | 🚧 Coming soon |
| Quantitative | 🚧 Coming soon |

## Verbal section

- **Word Bank** — log any hard word you run into, with its meaning, part of speech, synonyms, and antonyms. A "Look Up" button can pre-fill a definition and word forms from two free dictionary APIs (Datamuse + dictionaryapi.dev) — always editable before saving.
- **Practice Quiz** — multiple-choice drills generated from your own word bank: pick the *meaning*, the *synonym*, or the *antonym* of a word. Wrong-answer choices are drawn from your other words (and, for synonym/antonym questions, from the word's own opposite — the classic SSAT trick answer). Results feed a simple mastery tracker (New → Learning → Mastered).
- **Storage** — your word bank lives in the browser's `localStorage`, so it's private and persists across visits on the same browser. Use **Export Backup** anytime to download a `.json` file to your Downloads folder, and **Import Backup** to restore it (or move it to another browser/device).

## Running it locally

No build step — it's plain HTML/CSS/JS. Just serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser (the dictionary look-up feature needs an internet connection; everything else works offline).

## Deploying to GitHub Pages

1. Push this repo to GitHub (see below).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Save.
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

```bash
git add -A
git commit -m "Add verbal section"
git push -u origin main
```

## Project structure

```
index.html          Home page (module overview + your practice log stats)
verbal.html          Verbal section (Word Bank + Practice Quiz tabs)
reading.html          Placeholder — coming soon
quantitative.html    Placeholder — coming soon
css/styles.css       Shared design system
js/storage.js        localStorage persistence + export/import
js/dictionary.js     Datamuse + dictionaryapi.dev lookups
js/wordbank.js       Word Bank tab logic
js/quiz.js           Practice Quiz tab logic
js/app.js            Tab switching
js/home.js           Home page stats
```
