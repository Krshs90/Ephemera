/**
 * Ephemera — Help Panel Controller
 * Handles open/close of the info overlay with transitions.
 */
(function () {
  const overlay = document.getElementById('info-overlay');
  const panel   = document.getElementById('info-panel');
  const toggleBtn = document.getElementById('info-toggle');
  const closeBtn  = document.getElementById('info-close');

  let _open = false;

  function openHelp() {
    _open = true;
    overlay.hidden = false;
    // Allow hidden→display to paint before adding classes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        panel.classList.add('is-open');
      });
    });
    toggleBtn.setAttribute('aria-pressed', 'true');
  }

  function closeHelp() {
    _open = false;
    overlay.classList.remove('is-open');
    panel.classList.remove('is-open');
    toggleBtn.setAttribute('aria-pressed', 'false');

    // Hide after slide-out transition ends
    panel.addEventListener('transitionend', () => {
      if (!_open) overlay.hidden = true;
    }, { once: true });
  }

  // Toggle button
  toggleBtn.addEventListener('click', () => {
    if (_open) closeHelp(); else openHelp();
  });

  // Close button inside panel
  closeBtn.addEventListener('click', closeHelp);

  // Click on dim backdrop (outside panel)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHelp();
  });

  // Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _open) closeHelp();
  });

})();
