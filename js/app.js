/* app.js — shared tab-switching for the Verbal page (Word Bank / Practice Quiz) */
(() => {
  const tabs = [
    { btn: 'tab-btn-bank', panel: 'tab-bank' },
    { btn: 'tab-btn-quiz', panel: 'tab-quiz' },
  ];

  function activate(targetBtnId) {
    tabs.forEach(({ btn, panel }) => {
      const btnEl = document.getElementById(btn);
      const panelEl = document.getElementById(panel);
      if (!btnEl || !panelEl) return;
      const isActive = btn === targetBtnId;
      btnEl.setAttribute('aria-selected', String(isActive));
      panelEl.classList.toggle('is-active', isActive);
      panelEl.hidden = !isActive;
    });
  }

  tabs.forEach(({ btn }) => {
    const btnEl = document.getElementById(btn);
    if (btnEl) btnEl.addEventListener('click', () => activate(btn));
  });
})();
