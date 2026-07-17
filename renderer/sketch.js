/**
 * Ephemera -- Core Decay Engine (p5.js)
 *
 * INPUT MODES
 *   camera  Live webcam via getUserMedia (pixel grid)
 *   mp3     Uploaded audio file (4-band oscilloscope rows)
 *   image   Uploaded image (pixel grid, heavily cached)
 *
 * VISUAL STYLES (decay rendering)
 *   glitch, ember, phantom, liquid, ascii, wireframe, dust, vhs
 */

/* ------------------------------------------------------------------ */
/*  Runtime Options                                                      */
/* ------------------------------------------------------------------ */
let opts = {
  inputMode:         'camera',
  mode:              'glitch',
  cellSize:          10,
  movementThreshold: 22,
  recoverySpeed:     45,
  brushRadius:       3,
  historyFrames:     30 * 60,
  maxHistoryLayers:  3,
  glitchIntensity:   1.0,
  historyEnabled:    true,
  heatmapVisible:    false,
  micThreshold:      0.015,
};

let DECAY_ONSET = 150;

/* ------------------------------------------------------------------ */
/*  State                                                                */
/* ------------------------------------------------------------------ */
let cols, rows;
let cells       = [];
let histLayers  = [];
let lastSnapFrame = 0;
let noiseOff    = 0;
let crystalCount = 0;

let bgCv = null;
let bgCtx = null;

/* Camera */
let videoEl  = null;
let camReady = false;
let camRetry = null;

/* MP3 */
let mp3Engine = null;
let mp3Bands  = [
  { decay: 0, timer: 0, hover: false },
  { decay: 0, timer: 0, hover: false },
  { decay: 0, timer: 0, hover: false },
  { decay: 0, timer: 0, hover: false }
];

/* Image */
let imgOffCv  = null;
let imgOffCtx = null;
let imgReady  = false;
let imgCached = false; // flag to only read pixels once

/* AI shield */
let aiShield = null;

/* Mouse */
let mouseCell = { c: -1, r: -1 };
let rawMouseX = -1, rawMouseY = -1;

const asciiChars = '01#@$%&?+*=-:. ';

/* ------------------------------------------------------------------ */
/*  Public API                                                           */
/* ------------------------------------------------------------------ */
window.ephemeraSketch = {
  setDecayOnset(v)      { DECAY_ONSET = v; },
  setOption(key, val) {
    opts[key] = val;
    if (key === 'cellSize' && typeof window._ephemeraInitGrid === 'function') {
      window._ephemeraInitGrid();
      histLayers = [];
    }
    if (key === 'mode') histLayers = []; // Clear burn-in when style changes
    if (key === 'historyEnabled' && !val) histLayers = [];
    if (key === 'inputMode') _switchInputMode(val);
  },
  setInputMode(m) { _switchInputMode(m); },
  crystallize() { _crystallize(); },
  setMp3Engine(eng)   { mp3Engine = eng; },
  setAiShield(shield) { aiShield = shield; },
  setImageSource(imgEl) {
    if (!imgEl) return;
    imgOffCv       = document.createElement('canvas');
    imgOffCtx      = imgOffCv.getContext('2d', { willReadFrequently: true });
    imgOffCv.width  = imgEl.naturalWidth  || 640;
    imgOffCv.height = imgEl.naturalHeight || 480;
    imgOffCtx.drawImage(imgEl, 0, 0);
    imgReady = true;
    imgCached = false;
    if (typeof window._ephemeraInitGrid === 'function') window._ephemeraInitGrid();
  },
  isImageReady() { return imgReady; },
  getCrystalCount() { return crystalCount; },
};

/* ------------------------------------------------------------------ */
/*  Input Mode Switching                                                 */
/* ------------------------------------------------------------------ */
function _switchInputMode(mode) {
  opts.inputMode = mode;
  if (mode !== 'mp3' && mp3Engine) {
    mp3Engine.pause();
  }
  if (mode === 'camera') _startCamera();
  if (mode === 'image')  imgCached = false;
  if (typeof window._ephemeraInitGrid === 'function') window._ephemeraInitGrid();
}

/* ------------------------------------------------------------------ */
/*  Camera                                                               */
/* ------------------------------------------------------------------ */
function _startCamera() {
  if (videoEl) { try { videoEl.srcObject?.getTracks().forEach(t => t.stop()); } catch(_) {} videoEl = null; }
  camReady = false;
  clearInterval(camRetry);
  const ph = document.getElementById('camera-placeholder');
  if (ph) { ph.style.display = 'flex'; ph.style.opacity = '1'; }

  navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
    .then(stream => {
      videoEl = document.createElement('video');
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      videoEl.play();
      videoEl.addEventListener('loadedmetadata', () => {
        camReady = true;
        if (ph) {
          ph.style.transition = 'opacity 0.8s';
          ph.style.opacity = '0';
          setTimeout(() => { if (ph) ph.style.display = 'none'; }, 800);
        }
      });
    }).catch(() => {
      camRetry = setInterval(() => { clearInterval(camRetry); if (opts.inputMode === 'camera') _startCamera(); }, 3000);
    });
}

/* ------------------------------------------------------------------ */
/*  Crystallize                                                           */
/* ------------------------------------------------------------------ */
function _crystallize() {
  const cnvEl = document.querySelector('#canvas-container canvas');
  if (!cnvEl) return;
  const link = document.createElement('a');
  link.download = `ephemera-${Date.now()}.png`;
  link.href = cnvEl.toDataURL('image/png');
  link.click();
  crystalCount++;
  const el = document.getElementById('hud-crystal-count');
  if (el) el.textContent = crystalCount;
  
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:white;opacity:0;pointer-events:none;z-index:9999;transition:opacity 0.06s ease-in;';
  document.body.appendChild(flash);
  requestAnimationFrame(() => {
    flash.style.opacity = '0.7';
    setTimeout(() => { flash.style.transition = 'opacity 0.45s ease-out'; flash.style.opacity = '0'; setTimeout(() => flash.remove(), 500); }, 70);
  });
}
window._crystallize = _crystallize;

/* ------------------------------------------------------------------ */
/*  Grid                                                                 */
/* ------------------------------------------------------------------ */
function initGrid(p) {
  cols = Math.floor(p.width / opts.cellSize);
  rows = Math.floor(p.height / opts.cellSize);
  cells = [];
  
  bgCv = document.createElement('canvas');
  bgCv.width = cols;
  bgCv.height = rows;
  bgCtx = bgCv.getContext('2d', { willReadFrequently: true });
  
  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) {
      cells[r][c] = { prev: [20, 19, 16], timer: 0, decay: (opts.inputMode === 'image') ? 0 : 1.0, motion: 0, activeR: r, activeC: c };
    }
  }
}
window._ephemeraInitGrid = () => { if (_p) initGrid(_p); };
let _p = null;

/* ------------------------------------------------------------------ */
/*  p5 Sketch                                                            */
/* ------------------------------------------------------------------ */
new p5(function(p) {
  _p = p;

  p.setup = function() {
    const container = document.getElementById('canvas-container');
    const cnv = p.createCanvas(container.offsetWidth, container.offsetHeight);
    cnv.parent('canvas-container');
    cnv.style('position', 'absolute');
    cnv.style('top', '0');
    cnv.style('left', '0');
    p.noStroke();
    p.colorMode(p.RGB);
    initGrid(p);
    _startCamera();

    cnv.elt.addEventListener('mousemove', (e) => {
      const rect = cnv.elt.getBoundingClientRect();
      rawMouseX = e.clientX - rect.left;
      rawMouseY = e.clientY - rect.top;
      mouseCell.c = Math.floor(rawMouseX / opts.cellSize);
      mouseCell.r = Math.floor(rawMouseY / opts.cellSize);
    });
    cnv.elt.addEventListener('mouseleave', () => {
      mouseCell.c = -1; mouseCell.r = -1;
      rawMouseX = -1; rawMouseY = -1;
    });
  };

  p.draw = function() {
    p.background(18, 17, 14);
    if (opts.historyEnabled && histLayers.length > 0) {
      for (let i = 0; i < histLayers.length; i++) {
        p.tint(255, 18 + i * 7);
        p.image(histLayers[i], 0, 0);
      }
      p.noTint();
    }
    noiseOff += 0.008;
    const mode = opts.inputMode;

    // -- MP3 MODE (Custom Oscilloscope Renderer) --
    if (mode === 'mp3') {
      _drawMp3Oscilloscopes(p);
      return; // Skip grid loop completely
    }

    // -- GRID RENDERER (Camera, Image) --
    let camData = null;
    
    if (mode === 'camera' && camReady && videoEl) {
      bgCtx.save();
      bgCtx.translate(cols, 0);
      bgCtx.scale(-1, 1);
      bgCtx.drawImage(videoEl, 0, 0, cols, rows);
      bgCtx.restore();
      
      camData = bgCtx.getImageData(0, 0, cols, rows).data;
      
      // Draw pixelated background native fast path
      p.drawingContext.imageSmoothingEnabled = false;
      p.drawingContext.drawImage(bgCv, 0, 0, p.width, p.height);
    }
    
    if (aiShield?.isActive && videoEl && mode === 'camera') aiShield.update(videoEl);

    if (mode === 'image' && imgReady) {
      if (!imgCached) {
        bgCtx.drawImage(imgOffCv, 0, 0, cols, rows);
        const imgData = bgCtx.getImageData(0, 0, cols, rows).data;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = (r * cols + c) * 4;
            cells[r][c].prev = [imgData[idx], imgData[idx+1], imgData[idx+2]];
            cells[r][c].timer = 0; // pristine start
          }
        }
        imgCached = true;
      }
      p.drawingContext.imageSmoothingEnabled = false;
      p.drawingContext.drawImage(bgCv, 0, 0, p.width, p.height);
    }

    let totalDecayed = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r][c];
        
        // Physics logic (Ember spread, Glitch swap, Liquid drip, Dust blow)
        if (opts.mode === 'ember' && cell.decay > 0.8 && p.random() < 0.05) {
          const dr = p.random([-1, 0, 1]); const dc = p.random([-1, 0, 1]);
          if (cells[r+dr]?.[c+dc]) cells[r+dr][c+dc].timer += DECAY_ONSET * 0.1; 
        }
        if (opts.mode === 'glitch' && cell.decay > 0.6 && p.random() < 0.02) {
          cell.prev = [..._randNeighbor(p)];
        }
        if (opts.mode === 'liquid' && cell.decay > 0.5 && p.random() < 0.04) {
          if (cells[r-1]?.[c]) cell.prev = [...cells[r-1][c].prev];
        }
        if (opts.mode === 'dust' && cell.decay > 0.4 && p.random() < 0.1) {
          if (cells[r]?.[c-1]) cell.prev = [...cells[r][c-1].prev];
        }

        let sourceColor = cell.prev;
        let motionDist  = 0;

        if (mode === 'camera' && camReady && camData) {
          const idx = (r * cols + c) * 4;
          sourceColor = [camData[idx], camData[idx+1], camData[idx+2]];
          const dr = sourceColor[0] - cell.prev[0], dg = sourceColor[1] - cell.prev[1], db = sourceColor[2] - cell.prev[2];
          motionDist = Math.sqrt(dr*dr + dg*dg + db*db);
        } else if (mode === 'image' && imgReady) {
          // Optimized brush logic - only run math if near mouse
          if (mouseCell.c >= 0 && Math.abs(c - mouseCell.c) <= opts.brushRadius && Math.abs(r - mouseCell.r) <= opts.brushRadius) {
            const dc = c - mouseCell.c, dr2 = r - mouseCell.r, d2 = Math.sqrt(dc*dc + dr2*dr2);
            motionDist = d2 <= opts.brushRadius ? (opts.brushRadius - d2) * 40 : 0;
          }
        }

        if (aiShield?.isActive && mode === 'camera' && aiShield.isProtected(c, r, cols, rows)) {
          motionDist = Math.max(motionDist, opts.movementThreshold + 1);
        }

        // Decay increment
        const decaySpeed = (mode === 'image') ? 0.3 : 0.4;
        
        if (motionDist < opts.movementThreshold) {
          cell.timer = Math.min(cell.timer + decaySpeed, DECAY_ONSET * 1.5);
        } else {
          cell.timer = Math.max(0, cell.timer - opts.recoverySpeed);
          // Brush sweeping clears neighbours
          if (opts.brushRadius > 1 && motionDist > opts.movementThreshold && (mode === 'image' || mode === 'camera')) {
            for (let dr = -opts.brushRadius; dr <= opts.brushRadius; dr++) {
              for (let dc = -opts.brushRadius; dc <= opts.brushRadius; dc++) {
                if (!dr && !dc) continue;
                const d2 = Math.sqrt(dr*dr + dc*dc);
                if (d2 > opts.brushRadius) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                  const falloff = 1 - d2 / (opts.brushRadius + 1);
                  cells[nr][nc].timer = Math.max(0, cells[nr][nc].timer - opts.recoverySpeed * falloff);
                }
              }
            }
          }
        }

        if (mode === 'camera') cell.prev = sourceColor; // Update tracking for camera motion

        cell.motion = motionDist;
        cell.decay  = Math.min(cell.timer / DECAY_ONSET, 1.0);
        if (cell.decay > 0.5) totalDecayed++;

        // Render
        const x = c * opts.cellSize, y = r * opts.cellSize, sz = opts.cellSize - 1;
        const [sr, sg, sb] = cell.prev;

        // Massive performance optimization: don't draw pristine cells if background is already there
        if (cell.decay > 0.05) {
          if (opts.mode === 'ember')         _drawEmber(p, cell, x, y, sz, sr, sg, sb);
          else if (opts.mode === 'phantom')  _drawPhantom(p, cell, x, y, sz, sr, sg, sb);
          else if (opts.mode === 'liquid')   _drawLiquid(p, cell, x, y, sz, sr, sg, sb);
          else if (opts.mode === 'ascii')    _drawASCII(p, cell, x, y, sz, sr, sg, sb);
          else if (opts.mode === 'wireframe')_drawWireframe(p, cell, x, y, sz, sr, sg, sb);
          else if (opts.mode === 'dust')     _drawDust(p, cell, x, y, sz, sr, sg, sb);
          else if (opts.mode === 'vhs')      _drawVHS(p, cell, x, y, sz, sr, sg, sb);
          else                               _drawGlitch(p, cell, x, y, sz, sr, sg, sb);
        }

        // Heatmap
        if (opts.heatmapVisible && cell.motion > opts.movementThreshold) {
          const heat = Math.min((cell.motion - opts.movementThreshold) / 60, 1);
          p.fill(255, 80 + heat * 120, 0, heat * 80);
          p.rect(x, y, sz, sz);
        }
        // AI shield glow
        if (aiShield?.isActive && mode === 'camera' && aiShield.isProtected(c, r, cols, rows) && cell.decay < 0.15) {
          p.fill(100, 200, 255, 22);
          p.rect(x, y, sz, sz);
        }
      }
    }

    if (opts.historyEnabled && p.frameCount - lastSnapFrame > opts.historyFrames) {
      const snap = p.createGraphics(p.width, p.height);
      snap.image(p, 0, 0);
      histLayers.push(snap);
      if (histLayers.length > opts.maxHistoryLayers) histLayers.shift();
      lastSnapFrame = p.frameCount;
    }

    const decayPct = Math.round((totalDecayed / Math.max(1, cols * rows)) * 100);
    if (typeof updateHUD === 'function') updateHUD(decayPct);
  };

  p.windowResized = function() {
    const container = document.getElementById('canvas-container');
    p.resizeCanvas(container.offsetWidth, container.offsetHeight);
    initGrid(p);
    histLayers = [];
    lastSnapFrame = 0;
  };
});

/* ------------------------------------------------------------------ */
/*  MP3 Oscilloscope Renderer                                            */
/* ------------------------------------------------------------------ */
function _drawMp3Oscilloscopes(p) {
  const isPlaying = mp3Engine?.isPlaying;
  const waves = mp3Engine?.getWaveformData();
  let totalDecayed = 0;

  const bandHeight = p.height / 4;
  
  for (let i = 0; i < 4; i++) {
    const b = mp3Bands[i];
    const yCenter = i * bandHeight + bandHeight / 2;
    
    // Hover logic
    if (rawMouseY > i * bandHeight && rawMouseY < (i + 1) * bandHeight) {
      b.hover = true;
      b.timer = Math.max(0, b.timer - opts.recoverySpeed * 0.5);
    } else {
      b.hover = false;
      if (isPlaying) b.timer = Math.min(b.timer + 0.3, DECAY_ONSET * 1.5);
    }

    b.decay = Math.min(b.timer / DECAY_ONSET, 1.0);
    totalDecayed += b.decay;

    // Draw background zone
    p.fill(20, 19, 16, 50);
    p.rect(0, i * bandHeight, p.width, bandHeight);

    // Draw wave
    p.noFill();
    const thickness = p.map(b.decay, 0, 1, 2, 8);
    const waveColor = p.lerpColor(p.color(180, 220, 255), p.color(50, 40, 30), b.decay);
    
    p.strokeWeight(thickness);
    if (b.decay > 0.8) {
      p.stroke(waveColor);
      for(let x=0; x<p.width; x+=opts.cellSize) {
        if(p.random() < 0.2) p.point(x, yCenter + p.random(-40, 40));
      }
    } else {
      p.stroke(waveColor);
      p.beginShape();
      const wave = waves ? waves[i] : null;
      for (let x = 0; x < p.width; x += 4) {
        let amp = 0;
        if (wave) {
          const wIdx = Math.floor(p.map(x, 0, p.width, 0, wave.length));
          amp = wave[wIdx] * (bandHeight * 0.4);
        } else {
          amp = p.sin(x * 0.05 + noiseOff * 10) * 10;
        }
        const jitter = p.random(-1, 1) * (b.decay * 30);
        p.vertex(x, yCenter + amp + jitter);
      }
      p.endShape();
    }
    p.noStroke();
    
    p.fill(b.hover ? 200 : 80);
    p.textSize(10);
    p.textFont('Azeret Mono');
    const labels = ["SUB-BASS (0-80Hz)", "LOW-MID (80-500Hz)", "HIGH-MID (500-4kHz)", "AIR (4kHz+)"];
    p.text(labels[i], 20, i * bandHeight + 20);
  }

  if (isPlaying) {
    const arr = new Float32Array([mp3Bands[0].decay, mp3Bands[1].decay, mp3Bands[2].decay, mp3Bands[3].decay]);
    mp3Engine.updateDegradation(arr);
  }

  const pct = Math.round((totalDecayed / 4) * 100);
  if (typeof updateHUD === 'function') updateHUD(pct);
}

/* ------------------------------------------------------------------ */
/*  Decay Style Renderers                                                */
/* ------------------------------------------------------------------ */
function _drawGlitch(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.25) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  if (d < 0.55) {
    const shift = p.map(d, 0.25, 0.55, 0, 1) * 4 * opts.glitchIntensity;
    p.fill(cr, 0, 0, 175); p.rect(x - shift, y, sz, sz);
    p.fill(0, cg, 0, 175); p.rect(x, y, sz, sz);
    p.fill(0, 0, cb, 175); p.rect(x + shift, y, sz, sz);
  } else if (d < 0.82) {
    const t = p.map(d, 0.55, 0.82, 0, 1);
    const bigS = t * 24 * opts.glitchIntensity * (p.noise(y * 0.05, noiseOff) - 0.5);
    p.fill(p.random()<0.1 ? cr*1.5 : 170+p.random(80), 0, p.random()<0.1 ? cb*1.5 : p.random(75));
    p.rect(x + (Math.floor(y/(sz*3))%2===0 ? bigS : -bigS*0.5), y, sz, sz);
    if (p.frameCount % 3 === 0) { p.fill(0, 255, 140, 28); p.rect(x, y, sz, 1); }
  } else {
    if (p.random() < 0.4) {
      p.fill(p.random()<0.5?255:0, 0, p.random()<0.5?255:0);
    } else {
      const nv = p.random(28);
      p.fill(nv, nv, nv);
    }
    p.rect(x, y, sz, sz);
  }
}

function _drawEmber(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.3) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  if (d < 0.6) {
    const grey = cr * 0.299 + cg * 0.587 + cb * 0.114;
    const t = p.map(d, 0.3, 0.6, 0, 1);
    p.fill(p.lerp(cr, grey+12, t), p.lerp(cg, grey-4, t), p.lerp(cb, grey-8, t));
    p.rect(x, y, sz, sz);
  } else if (d < 0.85) {
    const warm = 20 + p.random(22);
    p.fill(warm + 16, warm * 0.6, warm * 0.18);
    p.rect(x, y, sz, sz);
    if (p.random() < 0.1) { p.fill(255, 180, 50, 150); p.rect(x+p.random(sz), y+p.random(sz), 3, 3); }
  } else {
    const nv = p.map(p.noise(x*0.02, y*0.02, noiseOff), 0, 1, 7, 30);
    p.fill(nv+9, nv*0.5, nv*0.1); p.rect(x, y, sz, sz);
  }
}

function _drawPhantom(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.3) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  const lum = cr * 0.299 + cg * 0.587 + cb * 0.114;
  if (d < 0.8) {
    const drift = p.map(d, 0.3, 0.8, 0, 1) * 20 * p.noise(y * 0.02, noiseOff);
    p.fill(lum*0.5, lum*0.6, lum*0.8, 100);
    p.rect(x + drift, y, sz, sz);
  } else {
    const nv = p.map(p.noise(x*0.02, y*0.02, noiseOff), 0, 1, 5, 20);
    p.fill(nv, nv, nv+10); p.rect(x, y, sz, sz);
  }
}

function _drawLiquid(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.2) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  const stretch = p.map(d, 0.2, 1.0, 1, sz * 2.5);
  const t = Math.min(1, p.map(d, 0.2, 0.8, 0, 1));
  p.fill(p.lerp(cr, cg, t), p.lerp(cg, cb, t), p.lerp(cb, cr*2, t), 200 - d*100);
  p.rect(x, y, sz, stretch);
}

function _drawASCII(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.2) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  const lum = (cr * 0.299 + cg * 0.587 + cb * 0.114);
  if (d < 0.6) {
    p.fill(0, lum, 0); 
    p.rect(x, y, sz, sz);
  } else {
    const charIdx = Math.floor(p.map(lum, 0, 255, asciiChars.length-1, 0));
    p.fill(0, p.map(d, 0.6, 1.0, 255, 30), 0);
    p.textSize(sz);
    p.textFont('monospace');
    p.text(asciiChars.charAt(charIdx), x, y + sz);
  }
}

function _drawWireframe(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.2) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  p.noFill();
  const t = Math.min(1, p.map(d, 0.2, 0.9, 0, 1));
  p.stroke(cr, cg, cb, 255 - t*200);
  p.strokeWeight(1);
  
  p.beginShape();
  p.vertex(x, y);
  if (p.random() > t) p.vertex(x + sz, y);
  if (p.random() > t) p.vertex(x + sz, y + sz);
  if (p.random() > t) p.vertex(x, y + sz);
  p.endShape(p.CLOSE);
  
  if (d > 0.8 && p.random() < 0.1) {
    p.stroke(0, 255, 255, 50);
    p.line(x, y, x + p.random(-sz*3, sz*3), y + p.random(-sz*3, sz*3));
  }
  p.noStroke();
}

function _drawDust(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.2) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  const blowDist = p.map(d, 0.2, 1.0, 0, sz * 4);
  const driftY = p.random(-sz, sz) * d;
  
  p.fill(cr*0.8, cg*0.8, cb*0.8, 255 - d*255);
  p.ellipse(x + blowDist, y + driftY, sz * (1-d), sz * (1-d));
}

function _drawVHS(p, cell, x, y, sz, cr, cg, cb) {
  const d = cell.decay;
  if (d < 0.1) return;
  p.fill(18, 17, 14); p.rect(x, y, opts.cellSize, opts.cellSize);
  
  const vTracking = (p.frameCount * 2 + y) % p.height;
  const isTrackingBand = (vTracking > p.height/2 && vTracking < p.height/2 + 40);
  
  if (isTrackingBand && d > 0.3) {
    p.fill(cr*1.5, cg*1.5, cb*1.5, 150);
    p.rect(x - p.random(sz*2), y, sz*2, sz*0.5);
    return;
  }
  
  const offset = p.map(d, 0.1, 1.0, 0, sz*1.5);
  p.fill(cr, 0, 0, 200); p.rect(x - offset, y, sz, sz);
  p.fill(0, cg, 0, 200); p.rect(x, y, sz, sz);
  p.fill(0, 0, cb, 200); p.rect(x + offset, y, sz, sz);
  
  if (d > 0.7 && p.random() < 0.05) {
    p.fill(255); p.rect(x, y, sz, sz*0.2); 
  }
}

function _randNeighbor(p) {
  const r = Math.floor(p.random(rows));
  const c = Math.floor(p.random(cols));
  return cells[r]?.[c]?.prev || [20, 19, 16];
}
