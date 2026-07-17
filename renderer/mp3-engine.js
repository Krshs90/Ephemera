/**
 * Ephemera -- MP3 Decay Engine
 *
 * Loads an audio file, plays it, and degrades it in 4 independent
 * frequency bands based on the decay level of each grid region.
 *
 * Band map (left to right in the grid):
 *   0: Sub-bass  < 80 Hz
 *   1: Low-mid   80-500 Hz
 *   2: High-mid  500-4000 Hz
 *   3: Air       4000+ Hz
 */

class Mp3Engine {
  constructor() {
    this.ctx         = null;
    this.buffer      = null;
    this.source      = null;
    this.analyser    = null;
    this.freqData    = null;
    this.masterGain  = null;
    this.noiseSource = null;
    this.noiseGain   = null;
    this.bandNodes   = [];   // [{ highpass, lowpass, distortion, gain }]
    this.isPlaying   = false;
    this.startedAt   = 0;
    this.pausedAt    = 0;
    this.duration    = 0;
    this.fileName    = '';
    this.baseVolume  = 0.4;
    this._initCtx();
  }

  _initCtx() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
      console.warn('Mp3Engine: AudioContext unavailable', e);
    }
  }

  async loadFile(file) {
    if (!this.ctx) this._initCtx();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.stop();
    this.fileName = file.name;

    try {
      const ab = await file.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(ab);
      this.duration = this.buffer.duration;
      this._buildChain();
      return true;
    } catch(e) {
      console.error('Mp3Engine: decode failed', e);
      return false;
    }
  }

  _buildChain() {
    if (!this.ctx || !this.buffer) return;
    this._teardown();

    // Master output
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.baseVolume;

    // Analyser for visualisation
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    // Noise buffer for degradation layer
    const noiseLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1;

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuf;
    this.noiseSource.loop = true;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseSource.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);
    this.noiseSource.start();

    // 4-band split: each band is highpass + lowpass sandwich
    const bands = [
      { lo: 20,   hi: 80   },
      { lo: 80,   hi: 500  },
      { lo: 500,  hi: 4000 },
      { lo: 4000, hi: 20000},
    ];

    this.bandNodes = bands.map(({ lo, hi }) => {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = lo;
      hp.Q.value = 0.7;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = hi;
      lp.Q.value = 0.7;

      const dist = this.ctx.createWaveShaper();
      dist.curve = this._distCurve(0);
      dist.oversample = '2x';

      const gain = this.ctx.createGain();
      gain.gain.value = 1;

      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;

      hp.connect(lp);
      lp.connect(dist);
      dist.connect(gain);
      gain.connect(analyser);
      analyser.connect(this.masterGain);

      const waveData = new Float32Array(analyser.frequencyBinCount);

      return { hp, lp, dist, gain, analyser, waveData, _origHi: hi, decay: 0 };
    });

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  setMasterVolume(vol) {
    this.baseVolume = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }
  }

  play() {
    if (!this.ctx || !this.buffer || this.isPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = true;

    this.bandNodes.forEach(b => this.source.connect(b.hp));

    const offset = this.pausedAt % this.buffer.duration;
    this.source.start(0, offset);
    this.startedAt = this.ctx.currentTime - offset;
    this.pausedAt  = 0;
    this.isPlaying = true;

    this.source.onended = () => { this.isPlaying = false; };
  }

  pause() {
    if (!this.isPlaying) return;
    this.pausedAt = this.ctx.currentTime - this.startedAt;
    try { this.source.stop(); } catch(_) {}
    this.source    = null;
    this.isPlaying = false;

    if (this.noiseGain && this.ctx) {
      this.noiseGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  stop() {
    if (this.source) {
      try { this.source.stop(); } catch(_) {}
      this.source = null;
    }
    this.isPlaying = false;
    this.pausedAt  = 0;
    this.startedAt = 0;

    if (this.noiseGain && this.ctx) {
      this.noiseGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  _teardown() {
    this.stop();
    if (this.noiseSource) {
      try { this.noiseSource.stop(); } catch(_) {}
      this.noiseSource = null;
    }
    this.bandNodes = [];
    this.analyser  = null;
  }

  getFreqData() {
    if (!this.analyser || !this.isPlaying) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    return this.freqData;
  }

  getWaveformData() {
    if (!this.ctx || !this.isPlaying) return null;
    return this.bandNodes.map(b => {
      b.analyser.getFloatTimeDomainData(b.waveData);
      return b.waveData;
    });
  }

  getCurrentTime() {
    if (!this.ctx || !this.isPlaying) return this.pausedAt;
    return (this.ctx.currentTime - this.startedAt) % (this.duration || 1);
  }

  /**
   * bandDecayLevels: Float32Array or Array of 4 values 0..1
   * 0 = pristine, 1 = fully decayed
   */
  updateDegradation(bandDecayLevels) {
    if (!this.ctx || !this.bandNodes.length) return;
    const now = this.ctx.currentTime;
    let totalDecay = 0;

    bandDecayLevels.forEach((decay, i) => {
      const b = this.bandNodes[i];
      if (!b) return;
      b.decay = decay;
      totalDecay += decay;

      // Distortion rises with decay squared
      b.dist.curve = this._distCurve(decay * decay * 320);

      // Gain drops as signal is "eaten" by noise
      const targetGain = Math.max(0.04, 1 - decay * 0.88);
      b.gain.gain.setTargetAtTime(targetGain, now, 0.15);

      // Low-pass filter descends: highs disappear first within each band
      const targetFreq = Math.max(b._origHi * 0.12, b._origHi * (1 - decay * 0.72));
      b.lp.frequency.setTargetAtTime(targetFreq, now, 0.4);
    });

    // Noise inversely proportional to average cleanliness
    const avgDecay = totalDecay / Math.max(1, bandDecayLevels.length);
    if (this.noiseGain) {
      this.noiseGain.gain.setTargetAtTime(avgDecay * 0.45, now, 0.25);
    }
    if (this.masterGain) {
      // Slight master duck so noise doesn't clip
      this.masterGain.gain.setTargetAtTime(this.baseVolume - avgDecay * (this.baseVolume * 0.2), now, 0.3);
    }
  }

  _distCurve(amount) {
    const n = 512;
    const curve = new Float32Array(n);
    const k = Math.max(0, amount);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = k === 0 ? x : ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  destroy() {
    this._teardown();
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
  }
}

window.Mp3Engine = Mp3Engine;
