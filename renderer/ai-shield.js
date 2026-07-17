/**
 * Ephemera -- AI Body Shield
 *
 * Uses MediaPipe SelfieSegmentation (WebGL, on-device, no API key) to
 * detect the person in the webcam frame and protect those grid cells
 * from decay.
 *
 * Gracefully degrades: if the model cannot load (offline, etc.)
 * shield simply stays disabled without breaking anything.
 */

class AiShield {
  constructor() {
    this.model    = null;
    this.isReady  = false;
    this.isActive = false;
    this.loading  = false;

    // Offscreen canvas to read mask pixels
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

      this.model.setOptions({ modelSelection: 1 }); // 1 = landscape (faster)
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

    // Resize offscreen canvas and draw mask to read pixels
    this.maskCanvas.width  = this.maskW;
    this.maskCanvas.height = this.maskH;
    this.maskCtx.drawImage(mask, 0, 0);
    this.maskPixels = this.maskCtx.getImageData(0, 0, this.maskW, this.maskH).data;
  }

  /**
   * Called once per frame in draw() before grid rendering.
   * videoEl must be a live <video> element.
   */
  async update(videoEl) {
    if (!this.isReady || !this.isActive || !videoEl) return;
    if (videoEl.readyState < 2) return; // not enough data yet
    try {
      await this.model.send({ image: videoEl });
    } catch (_) {}
  }

  /**
   * Returns true when the AI considers cell (c, r) to be "body" area.
   * Mirrored to match the horizontally-flipped camera view.
   */
  isProtected(c, r, cols, rows) {
    if (!this.isActive || !this.maskPixels || !this.maskW) return false;

    // Mirror X to match camera
    const mx = this.maskW - 1 - Math.floor((c / cols) * this.maskW);
    const my = Math.floor((r / rows) * this.maskH);

    const idx = (my * this.maskW + mx) * 4;
    // R channel of segmentation mask: 255 = person, 0 = background
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
