
let _mp3  = null;
let _ai   = null;
let _activeInput = 'camera';

(function () {
  
  document.getElementById('btn-minimize').addEventListener('click', () => window.electronAPI?.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.electronAPI?.maximize());
  document.getElementById('btn-close').addEventListener('click',    () => window.electronAPI?.close());

  
  const sessionEl = document.getElementById('hud-session-time');
  const startTime = Date.now();
  setInterval(() => {
    const e = Math.floor((Date.now() - startTime) / 1000);
    if (sessionEl) sessionEl.textContent =
      String(Math.floor(e / 60)).padStart(2, '0') + ':' +
      String(e % 60).padStart(2, '0');
  }, 1000);

  
  const decaySlider = document.getElementById('global-decay-slider');
  if (decaySlider) {
    decaySlider.addEventListener('input', () => {
      const v = 330 - parseInt(decaySlider.value, 10);
      window.ephemeraSketch?.setDecayOnset(v);
    });
  }

  
  const styleSelect = document.getElementById('style-select');
  if (styleSelect) {
    styleSelect.addEventListener('change', (e) => {
      window.ephemeraSketch?.setOption('mode', e.target.value);
    });
  }

  
  document.querySelectorAll('.header-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _switchInputUI(btn.dataset.input);
    });
  });

  
  const aiBtn = document.getElementById('ai-shield-btn');
  if (aiBtn) {
    aiBtn.addEventListener('click', () => {
      if (!_ai) {
        _ai = new AiShield();
        window.ephemeraSketch?.setAiShield(_ai);
      }
      const next = aiBtn.getAttribute('data-active') !== 'true';
      aiBtn.setAttribute('data-active', String(next));
      aiBtn.setAttribute('aria-pressed', String(next));
      _ai.toggle(next);

      if (next && !_ai.isReady && !_ai.loading) {
        aiBtn.innerHTML = `<span class="pill-icon">⏳</span> Loading...`;
        _ai.load().then(() => {
          aiBtn.innerHTML = `<span class="pill-icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5L10.5 3.5V6.5C10.5 9 8 10.8 6 11.5C4 10.8 1.5 9 1.5 6.5V3.5L6 1.5Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></span> AI Shield`;
        });
      }
    });
  }

  
  const micSlider = document.getElementById('mic-vol-slider');
  if (micSlider) {
    micSlider.addEventListener('input', e => {
      window.ephemeraSketch?.setOption('micThreshold', parseFloat(e.target.value));
    });
  }

  
  const mp3Input = document.getElementById('mp3-file-input');
  if (mp3Input) {
    mp3Input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!_mp3) {
        _mp3 = new Mp3Engine();
        window.ephemeraSketch?.setMp3Engine(_mp3);
      }
      const ok = await _mp3.loadFile(file);
      if (ok) {
        
        
        const mp3Area = document.getElementById('mp3-upload-area');
        if (mp3Area) mp3Area.style.display = 'none';
        
        _updateMp3PlayBtn(false);
      }
    });
  }

  
  const mp3PlayBtn = document.getElementById('mp3-play-btn');
  if (mp3PlayBtn) {
    mp3PlayBtn.addEventListener('click', () => {
      if (!_mp3 || !_mp3.buffer) return;
      if (_mp3.isPlaying) {
        _mp3.pause();
        _updateMp3PlayBtn(false);
      } else {
        _mp3.play();
        _updateMp3PlayBtn(true);
      }
    });
  }

  
  const mp3VolSlider = document.getElementById('mp3-vol-slider');
  if (mp3VolSlider) {
    mp3VolSlider.addEventListener('input', e => {
      if (_mp3) _mp3.setMasterVolume(parseFloat(e.target.value));
    });
  }

  
  const imgInput = document.getElementById('image-file-input');
  if (imgInput) {
    imgInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url  = URL.createObjectURL(file);
      const img  = new Image();
      img.onload = () => {
        window.ephemeraSketch?.setImageSource(img);
        URL.revokeObjectURL(url);
        
        const imgArea = document.getElementById('image-upload-area');
        if (imgArea) imgArea.style.display = 'none';
      };
      img.src = url;
    });
  }

  
  const imgBrushSlider = document.getElementById('img-brush-slider');
  if (imgBrushSlider) {
    imgBrushSlider.addEventListener('input', e => {
      window.ephemeraSketch?.setOption('brushRadius', parseInt(e.target.value, 10));
    });
  }

  
  const heatBtn = document.getElementById('heatmap-toggle');
  if (heatBtn) {
    heatBtn.addEventListener('click', () => {
      const next = heatBtn.getAttribute('data-active') !== 'true';
      heatBtn.setAttribute('data-active', String(next));
      heatBtn.setAttribute('aria-pressed', String(next));
      window.ephemeraSketch?.setOption('heatmapVisible', next);
    });
  }

  const crystalBtn = document.getElementById('crystallize-btn');
  if (crystalBtn) crystalBtn.addEventListener('click', () => window.ephemeraSketch?.crystallize());
  
  const audioBtn = document.getElementById('audio-toggle');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      const next = audioBtn.getAttribute('data-active') !== 'true';
      audioBtn.setAttribute('data-active', String(next));
      audioBtn.setAttribute('aria-pressed', String(next));
      window.ephemeraAudio?.toggle(next);
    });
  }

  
  const settingsOverlay = document.getElementById('settings-overlay');
  const infoOverlay     = document.getElementById('info-overlay');
  
  function openOverlay(el, btn) {
    el.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('is-open');
      el.querySelector('.info-panel').classList.add('is-open');
    }));
    btn?.setAttribute('aria-pressed', 'true');
  }
  function closeOverlay(el, btn) {
    el.classList.remove('is-open');
    el.querySelector('.info-panel').classList.remove('is-open');
    btn?.setAttribute('aria-pressed', 'false');
    el.querySelector('.info-panel').addEventListener('transitionend', () => {
      if (!el.classList.contains('is-open')) el.hidden = true;
    }, { once: true });
  }

  document.getElementById('settings-toggle')?.addEventListener('click', function() {
    if (settingsOverlay.classList.contains('is-open')) closeOverlay(settingsOverlay, this);
    else openOverlay(settingsOverlay, this);
  });
  document.getElementById('settings-close')?.addEventListener('click', () => closeOverlay(settingsOverlay, document.getElementById('settings-toggle')));
  settingsOverlay?.addEventListener('click', e => { if (e.target === settingsOverlay) closeOverlay(settingsOverlay, document.getElementById('settings-toggle')); });

  document.getElementById('info-toggle')?.addEventListener('click', function() {
    if (infoOverlay.classList.contains('is-open')) closeOverlay(infoOverlay, this);
    else {
      openOverlay(infoOverlay, this);
      _switchInfoTab(_activeInput);
    }
  });
  document.getElementById('info-close')?.addEventListener('click', () => closeOverlay(infoOverlay, document.getElementById('info-toggle')));
  infoOverlay?.addEventListener('click', e => { if (e.target === infoOverlay) closeOverlay(infoOverlay, document.getElementById('info-toggle')); });
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (settingsOverlay?.classList.contains('is-open')) closeOverlay(settingsOverlay, document.getElementById('settings-toggle'));
      if (infoOverlay?.classList.contains('is-open')) closeOverlay(infoOverlay, document.getElementById('info-toggle'));
    }
    if (e.code === 'Space' && !e.target.matches('input, button, textarea, select')) {
      e.preventDefault();
      window.ephemeraSketch?.crystallize();
    }
  });

  
  document.querySelectorAll('.info-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _switchInfoTab(btn.dataset.tab));
  });

  
  const resBtns = document.querySelectorAll('.res-btn');
  resBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      resBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      window.ephemeraSketch?.setOption('cellSize', parseInt(btn.dataset.val, 10));
    });
  });

  const histBtn = document.getElementById('toggle-history');
  if (histBtn) {
    histBtn.addEventListener('click', () => {
      const next = histBtn.getAttribute('data-active') !== 'true';
      histBtn.setAttribute('data-active', String(next));
      histBtn.textContent = next ? 'Enabled' : 'Disabled';
      window.ephemeraSketch?.setOption('historyEnabled', next);
    });
  }

  
  document.getElementById('recovery-slider')?.addEventListener('input', e => {
    window.ephemeraSketch?.setOption('recoverySpeed', parseInt(e.target.value, 10));
  });
  document.getElementById('sensitivity-slider')?.addEventListener('input', e => {
    window.ephemeraSketch?.setOption('movementThreshold', parseInt(e.target.value, 10));
  });

})();

function _switchInputUI(mode) {
  _activeInput = mode;

  
  document.querySelectorAll('.header-mode-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.input === mode);
  });

  
  document.querySelectorAll('.context-group').forEach(grp => {
    if (grp.id === `context-${mode}`) {
      grp.style.display = 'flex';
      
      requestAnimationFrame(() => requestAnimationFrame(() => grp.classList.add('is-active')));
    } else {
      grp.classList.remove('is-active');
      grp.style.display = 'none';
    }
  });

  
  const mp3Area = document.getElementById('mp3-upload-area');
  const imgArea = document.getElementById('image-upload-area');
  const camPH   = document.getElementById('camera-placeholder');

  
  if (mp3Area) mp3Area.style.display = (mode === 'mp3' && (!_mp3 || !_mp3.buffer)) ? 'flex' : 'none';
  if (imgArea) imgArea.style.display = (mode === 'image' && !window.ephemeraSketch?.isImageReady()) ? 'flex' : 'none';

  if (camPH) {
    if (mode === 'camera') {
      camPH.style.display = 'flex'; camPH.style.opacity = '1';
    } else {
      camPH.style.display = 'none';
    }
  }

  
  const droneBtn = document.getElementById('audio-toggle');
  if (droneBtn) {
    droneBtn.style.display = (mode === 'mp3' || mode === 'image') ? 'none' : 'flex';
  }

  
  if (mode === 'image') {
    document.querySelectorAll('.res-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.val === '5');
    });
    window.ephemeraSketch?.setOption('cellSize', 5);
  } else if (mode === 'camera' || mode === 'mic') {
    document.querySelectorAll('.res-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.val === '10');
    });
    window.ephemeraSketch?.setOption('cellSize', 10);
  }

  
  const modeLabel = document.getElementById('hud-mode-label');
  if (modeLabel) modeLabel.textContent = mode.toUpperCase();

  
  window.ephemeraSketch?.setInputMode(mode);
}

function _switchInfoTab(tab) {
  document.querySelectorAll('.info-tab-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  document.querySelectorAll('.info-tab-pane').forEach(p => p.hidden = p.dataset.pane !== tab);
}

function _updateMp3PlayBtn(playing) {
  const btn = document.getElementById('mp3-play-btn');
  if (!btn) return;
  if (playing) {
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="3" height="8" fill="currentColor"/><rect x="7" y="2" width="3" height="8" fill="currentColor"/></svg> Pause Audio`;
    btn.setAttribute('data-playing', 'true');
  } else {
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polygon points="2,1 11,6 2,11" fill="currentColor"/></svg> Play Audio`;
    btn.setAttribute('data-playing', 'false');
  }
}

function updateHUD(decayPct) {
  const el = document.getElementById('hud-decay-pct');
  if (el) {
    el.textContent = decayPct + '%';
    el.style.color = decayPct > 60 ? `oklch(${65 - (decayPct - 60) * 0.3}% 0.12 55)` : '';
  }
  window.ephemeraAudio?.update(decayPct / 100);
}
