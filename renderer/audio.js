
class EphemeraAudio {
  constructor() {
    this.ctx         = null;
    this.masterGain  = null;
    this.filter      = null;
    this.distortion  = null;
    this.drone1      = null;
    this.drone2      = null;
    this.noiseGain   = null;
    this.active      = false;
    this._ready      = false;
  }

  
  _init() {
    if (this._ready) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);

    
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 180;
    this.filter.Q.value = 0.9;
    this.filter.connect(this.masterGain);

    
    this.distortion = this.ctx.createWaveShaper();
    this.distortion.curve = this._distCurve(0);
    this.distortion.oversample = '4x';
    this.distortion.connect(this.filter);

    
    this.drone1 = this.ctx.createOscillator();
    this.drone1.type = 'sine';
    this.drone1.frequency.value = 55;
    this.drone1.connect(this.distortion);
    this.drone1.start();

    
    this.drone2 = this.ctx.createOscillator();
    this.drone2.type = 'sine';
    this.drone2.frequency.value = 55.5;
    this.drone2.connect(this.distortion);
    this.drone2.start();

    
    const bufferSize    = this.ctx.sampleRate * 3;
    const noiseBuffer   = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const noiseData     = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;
    this.noiseSource.start();

    
    const noiseHP = this.ctx.createBiquadFilter();
    noiseHP.type = 'highpass';
    noiseHP.frequency.value = 3800;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;

    this.noiseSource.connect(noiseHP);
    noiseHP.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);

    this._ready = true;
  }

  
  toggle(on) {
    this._init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.active = on;

    const t = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
    
    if (!on) {
      this.masterGain.gain.linearRampToValueAtTime(0, t + 0.6);
    }
  }

  
  
  update(decayRatio) {
    if (!this._ready || !this.active) return;

    const t = this.ctx.currentTime;

    
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
    const targetGain = 0.04 + decayRatio * 0.14;
    this.masterGain.gain.linearRampToValueAtTime(targetGain, t + 0.8);

    
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, t);
    const targetFreq = 160 + decayRatio * decayRatio * 2400;
    this.filter.frequency.linearRampToValueAtTime(targetFreq, t + 0.6);

    
    const distAmt = decayRatio * decayRatio * 380;
    this.distortion.curve = this._distCurve(distAmt);

    
    this.drone2.frequency.cancelScheduledValues(t);
    this.drone2.frequency.setValueAtTime(this.drone2.frequency.value, t);
    const detune = decayRatio * 22;
    this.drone2.frequency.linearRampToValueAtTime(55.5 + detune, t + 1.2);

    
    this.noiseGain.gain.cancelScheduledValues(t);
    this.noiseGain.gain.setValueAtTime(this.noiseGain.gain.value, t);
    const noiseTarget = Math.max(0, (decayRatio - 0.55) / 0.45) * 0.18;
    this.noiseGain.gain.linearRampToValueAtTime(noiseTarget, t + 0.4);
  }

  
  _distCurve(amount) {
    const n   = 256;
    const arr = new Float32Array(n);
    const k   = amount;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      arr[i]  = k === 0
        ? x
        : ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return arr;
  }
}

window.ephemeraAudio = new EphemeraAudio();
