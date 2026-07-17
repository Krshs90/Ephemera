(function () {
  const overlay = document.getElementById('info-overlay');
  const panel   = document.getElementById('info-panel');
  const toggleBtn = document.getElementById('info-toggle');
  const closeBtn  = document.getElementById('info-close');

  let _open = false;

  function openHelp() {
    _open = true;
    overlay.hidden = false;
    
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

    
    panel.addEventListener('transitionend', () => {
      if (!_open) overlay.hidden = true;
    }, { once: true });
  }

  
  toggleBtn.addEventListener('click', () => {
    if (_open) closeHelp(); else openHelp();
  });

  
  closeBtn.addEventListener('click', closeHelp);

  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHelp();
  });

  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _open) closeHelp();
  });

})();
