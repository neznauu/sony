/* ═══════════════════════════════════════════
   SLIDESHOW — уровень 3.
   Кадры уходят в цветную пустоту, звук глохнет.
   ═══════════════════════════════════════════ */

const Slideshow = {
  container: null,
  onComplete: null,
  wrap: null,
  stage: null,
  capEl: null,
  vigEl: null,
  pauseEl: null,
  imageEl: null,
  current: 0,
  paused: false,
  _timer: null,
  _grainTimer: null,
  _timers: [],
  _destroyed: false,
  _finishing: false,
  _slideLoadId: 0,

  mount (container, onComplete) {
    this.container = container;
    this.onComplete = onComplete;
    this.current = 0;
    this.paused = false;
    this._destroyed = false;
    this._finishing = false;
    this._timers = [];
    this._slideLoadId = 0;

    const wrap = document.createElement('div');
    wrap.className = 'slideshow-container';
    container.appendChild(wrap);
    this.wrap = wrap;

    const stage = document.createElement('div');
    stage.className = 'slideshow-stage';
    wrap.appendChild(stage);
    this.stage = stage;

    const image = document.createElement('img');
    image.className = 'slideshow-img';
    image.alt = '';
    image.draggable = false;
    stage.appendChild(image);
    this.imageEl = image;

    const grain = document.createElement('canvas');
    grain.className = 'slideshow-grain';
    grain.width = 128; grain.height = 128;
    wrap.appendChild(grain);
    this._grainCanvas = grain;
    this._grainCtx = grain.getContext('2d');
    this._paintGrain();
    this._grainTimer = setInterval(() => this._paintGrain(), 140);

    const vig = document.createElement('div');
    vig.className = 'slideshow-vignette';
    wrap.appendChild(vig);
    this.vigEl = vig;

    const cap = document.createElement('div');
    cap.className = 'slideshow-caption';
    wrap.appendChild(cap);
    this.capEl = cap;

    const pause = document.createElement('div');
    pause.className = 'slideshow-pause';
    pause.innerHTML = '<i></i><i></i>';
    pause.setAttribute('aria-hidden', 'true');
    wrap.appendChild(pause);
    this.pauseEl = pause;

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn-back';
    back.setAttribute('aria-label', 'Назад к карте');
    back.innerHTML = '<svg viewBox="0 0 18 18" width="17" height="17" fill="none"><path d="M11.5 4.5 6.7 9l4.8 4.5" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    back.addEventListener('click', () => {
      if (this._destroyed) return;
      AudioEngine.playTouch();
      this._teardown();
      App.backToMap();
    });
    wrap.appendChild(back);

    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.btn-back')) return;
      if (this._finishing || this._destroyed) return;
      this.paused = !this.paused;
      this.pauseEl.style.opacity = this.paused ? '1' : '0';
      if (this.paused) {
        clearTimeout(this._timer);
      } else {
        this._scheduleNext();
      }
      AudioEngine.playTouch();
    });

    this._showSlide(0);
  },

  _later (fn, ms) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter(t => t !== id);
      if (!this._destroyed) fn();
    }, ms);
    this._timers.push(id);
    return id;
  },

  _teardown () {
    this._destroyed = true;
    clearTimeout(this._timer);
    clearInterval(this._grainTimer);
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    this._slideLoadId++;
    if (this.wrap && this.wrap.parentNode) this.wrap.remove();
    this.wrap = null;
    this.imageEl = null;
  },

  _showSlide (idx) {
    if (this._destroyed || this._finishing) return;
    const total = CONFIG.SLIDES.length;
    if (idx >= total) {
      this._finish();
      return;
    }

    this.current = idx;
    const slide = CONFIG.SLIDES[idx];
    const t = total <= 1 ? 1 : idx / (total - 1);
    const image = this.imageEl;

    image.src = slide.src;
    image.style.opacity = '1';

    // подпись только если не пустая
    this.capEl.style.opacity = '0';
    this._later(() => {
      if (slide.caption) {
        this.capEl.textContent = slide.caption;
        this.capEl.style.opacity = '1';
      }
    }, 700);

    // виньетка усиливается
    const inner = Math.max(8, 30 - idx * 3.6);
    const alpha = (0.4 + 0.48 * t).toFixed(2);
    this.vigEl.style.background =
      'radial-gradient(ellipse at 50% 48%,transparent ' + inner + '%,rgba(4,4,10,' + alpha + ') 100%)';

    this._scheduleNext();
  },

  _scheduleNext () {
    clearTimeout(this._timer);
    if (this.paused || this._destroyed || this._finishing) return;
    this._timer = setTimeout(() => {
      if (!this.paused && !this._destroyed) this._showSlide(this.current + 1);
    }, CONFIG.SLIDE_SECONDS * 1000);
  },

  _finish () {
    if (this._finishing || this._destroyed) return;
    this._finishing = true;
    clearTimeout(this._timer);
    clearInterval(this._grainTimer);

    this.stage.style.transition = 'opacity 1.5s ease';
    this.stage.style.opacity = '0';
    this.capEl.style.opacity = '0';
    this.vigEl.style.background = 'radial-gradient(ellipse at center,transparent 0%,rgba(4,4,10,.9) 100%)';

    // 1.5 с затемнения + 2 с тишины
    setTimeout(() => {
      this._teardown();
      if (this.onComplete) this.onComplete();
    }, 3500);
  },

  _paintGrain () {
    if (!this._grainCtx) return;
    const w = 128, h = 128;
    const id = this._grainCtx.createImageData(w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    this._grainCtx.putImageData(id, 0, 0);
  }
};
