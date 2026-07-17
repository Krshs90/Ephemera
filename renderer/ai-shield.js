
class AiShield {
  constructor() {
    this.model    = null;
    this.isReady  = false;
    this.isActive = false;
    this.loading  = false;

    
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx    = this.maskCanvas.getContext('2d', { willReadFrequently: true });
    this.maskPixels = null;
    this.maskW      = 0;
    this.maskH      = 0;
  }

  async load() {
    if (this.loading || this.isReady) return;
    this.loading = true;

    try {
      if (typeof SelfieSegmentation === 'undefined') {
        throw new Error('SelfieSegmentation not loaded from CDN');
      }

      this.model = new SelfieSegmentation({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${file}`,
      });

      this.model.setOptions({ modelSelection: 1 }); 
      this.model.onResults((res) => this._onResults(res));
      await this.model.initialize();

      this.isReady = true;
      console.log('AiShield: MediaPipe ready');
    } catch (e) {
      console.warn('AiShield: could not load MediaPipe, shield disabled.', e);
      this.isReady  = false;
    } finally {
      this.loading = false;
    }
  }

  _onResults(results) {
    if (!results.segmentationMask) return;

    const mask = results.segmentationMask;
    this.maskW = mask.width;
    this.maskH = mask.height;

    
    this.maskCanvas.width  = this.maskW;
    this.maskCanvas.height = this.maskH;
    this.maskCtx.drawImage(mask, 0, 0);
    this.maskPixels = this.maskCtx.getImageData(0, 0, this.maskW, this.maskH).data;
  }

    async update(videoEl) {
    if (!this.isReady || !this.isActive || !videoEl) return;
    if (videoEl.readyState < 2) return; 
    try {
      await this.model.send({ image: videoEl });
    } catch (_) {}
  }

    isProtected(c, r, cols, rows) {
    if (!this.isActive || !this.maskPixels || !this.maskW) return false;

    
    const mx = this.maskW - 1 - Math.floor((c / cols) * this.maskW);
    const my = Math.floor((r / rows) * this.maskH);

    const idx = (my * this.maskW + mx) * 4;
    
    return this.maskPixels[idx] > 128;
  }

  toggle(active) {
    this.isActive = active;
    if (active && !this.isReady && !this.loading) {
      this.load();
    }
  }

  destroy() {
    this.isReady  = false;
    this.isActive = false;
    this.model    = null;
  }
}

window.AiShield = AiShield;
