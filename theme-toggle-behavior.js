  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  const root = document.documentElement;

  /* Read saved preference, or fall back to system preference */
  function getSaved() {
    return localStorage.getItem('theme');
  }

  function getSystem() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
      icon.textContent = '🌙';
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
      icon.textContent = '☀️';
    }
  }

  /* Initialise */
  const initial = getSaved() || getSystem();
  applyTheme(initial);

  /* Toggle on click */
  btn.addEventListener('click', function () {
    const current = root.classList.contains('dark') ? 'dark' : 'light';
    const next    = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });

  /* Follow system changes when no manual preference is saved */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!getSaved()) applyTheme(e.matches ? 'dark' : 'light');
  });
