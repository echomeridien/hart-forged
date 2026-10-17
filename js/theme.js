// Light / dark theme. Loaded as a plain script in <head> so the theme is set
// before first paint. Follows the system setting until the toggle is used,
// then remembers the choice in this browser.
(() => {
  const KEY = 'hartforged-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');

  const stored = () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  };
  const current = () => stored() || (system.matches ? 'dark' : 'light');

  function apply(theme) {
    root.dataset.theme = theme;
    const btn = document.getElementById('themeToggle');
    if (btn) btn.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  apply(current());
  system.addEventListener('change', () => { if (!stored()) apply(current()); });

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    apply(current());
    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch { /* still switches, just isn't remembered */ }
      apply(next);
    });
  });
})();
