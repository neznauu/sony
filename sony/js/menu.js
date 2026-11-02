/* ═══════════════════════════════════════════
   MENU — небо, вступление, карта созвездия
   ═══════════════════════════════════════════ */

const Menu = {
  canvas: null,
  ctx: null,
  uiLayer: null,

  width: 0,
  height: 0,
  dpr: 1,
  bgStars: [],
  animId: null,

  camX: 0,
  camY: 0,
  camZoom: 1,
  targetCamX: 0,
  targetCamY: 0,
  targetCamZoom: 1,

  drawnLines: [],
  animatingLine: null,

  starEls: [],
  arrowEl: null,
  progressBarEl: null,
  menuButtonsEl: null,
  introTextEl: null,
  confirmPanelEl: null,

  state: 'initial',
  activeStarIndex: 0,
  _starClick: null,
  _introTimers: [],
  _loopStarted: false,

  init () {
    this.canvas = document.getElementById('sky-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.uiLayer = document.getElementById('ui-layer');

    this._resize();
    this._initBgStars();
    this._startRenderLoop();

    window.addEventListener('resize', () => {
      this._resize();
      this._initBgStars();
      this._repositionStars();
    });
  },

  _resize () {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  _initBgStars () {
    this.bgStars = [];
    const count = this.width < 500 ? 170 : 240;
    for (let i = 0; i < count; i++) {
      const layer = i < count * 0.55 ? 0 : (i < count * 0.85 ? 1 : 2);
      this.bgStars.push({
        x: Math.random() * this.width * 2 - this.width * 0.5,
        y: Math.random() * this.height * 3 - this.height * 0.75,
        size: layer === 0 ? 0.8 : (layer === 1 ? 1.25 : 1.8),
        layer,
        speed: 0.4 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.16 + Math.random() * 0.5
      });
    }
  },

  _startRenderLoop () {
    if (this._loopStarted) return;
    this._loopStarted = true;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.06);
      last = now;
      this._updateCamera(dt);
      this._drawSky(now / 1000);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  },

  _updateCamera (dt) {
    const k = 1 - Math.exp(-dt * 1.55);
    this.camX += (this.targetCamX - this.camX) * k;
    this.camY += (this.targetCamY - this.camY) * k;
    this.camZoom += (this.targetCamZoom - this.camZoom) * k;
  },

  _drawSky (timeSec) {
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#040409');
    grad.addColorStop(0.48, '#080812');
    grad.addColorStop(1, '#05050c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // very soft depth haze
    const haze = ctx.createRadialGradient(W * 0.62, H * 0.34, 0, W * 0.62, H * 0.34, Math.max(W, H) * 0.72);
    haze.addColorStop(0, 'rgba(70,74,108,.055)');
    haze.addColorStop(1, 'rgba(5,5,12,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-W / 2, -H / 2);

    const parallax = [0.16, 0.38, 0.72];
    for (const s of this.bgStars) {
      const factor = parallax[s.layer];
      const sx = s.x - this.camX * factor;
      const sy = s.y - this.camY * factor;
      const wrapX = ((sx % (W * 1.6)) + W * 1.6) % (W * 1.6) - W * 0.3;
      const wrapY = ((sy % (H * 2.4)) + H * 2.4) % (H * 2.4) - H * 0.7;
      if (wrapX < -12 || wrapX > W + 12 || wrapY < -12 || wrapY > H + 12) continue;

      const a = s.alpha * (0.68 + 0.32 * Math.sin(timeSec * s.speed + s.phase));
      ctx.fillStyle = 'rgba(205,211,235,' + a.toFixed(3) + ')';
      ctx.fillRect(wrapX, wrapY, s.size, s.size);
      if (s.layer === 2) {
        ctx.fillStyle = 'rgba(205,211,235,' + (a * 0.16).toFixed(3) + ')';
        ctx.fillRect(wrapX - 1, wrapY - 1, 3, 3);
      }
    }

    if (this.state === 'map' || this.state === 'intro-done') {
      this._drawConstellationLines(ctx);
    }
    ctx.restore();
  },

  _starPoints () {
    return CONFIG.STARS.map(s => ({
      x: (s.x / 100) * this.width,
      y: (s.y / 100) * this.height
    }));
  },

  _drawConstellationLines (ctx) {
    const stars = this._starPoints();

    for (const [a, b] of this.drawnLines) {
      const p1 = stars[a], p2 = stars[b];
      if (!p1 || !p2) continue;

      ctx.strokeStyle = 'rgba(190,196,222,.14)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

      ctx.strokeStyle = 'rgba(208,213,235,.48)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }

    const al = this.animatingLine;
    if (al) {
      const cx = al.from.x + (al.to.x - al.from.x) * al.progress;
      const cy = al.from.y + (al.to.y - al.from.y) * al.progress;

      ctx.strokeStyle = 'rgba(222,226,246,.72)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(al.from.x, al.from.y); ctx.lineTo(cx, cy); ctx.stroke();

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 11);
      glow.addColorStop(0, 'rgba(245,247,255,.9)');
      glow.addColorStop(0.35, 'rgba(210,216,245,.4)');
      glow.addColorStop(1, 'rgba(200,208,240,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
    }
  },

  /* ── Стартовый экран ────────────────── */

  showInitialMenu (hasProgress, onStart, onRestart) {
    this.state = 'initial';
    this.drawnLines = [];
    this.animatingLine = null;
    this.uiLayer.innerHTML = '';
    this.uiLayer.style.opacity = '1';
    this.uiLayer.style.transition = '';
    this._starClick = null;
    this.starEls = [];
    this.progressBarEl = null;
    this.arrowEl = null;
    this.confirmPanelEl = null;
    this.targetCamX = 0;
    this.targetCamY = 0;
    this.targetCamZoom = 1;

    const wrap = document.createElement('div');
    wrap.className = 'menu-buttons';

    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'btn';
    start.textContent = hasProgress ? 'Продолжить' : 'Начать';
    start.addEventListener('click', () => {
      AudioEngine.playTouch();
      onStart();
    });
    wrap.appendChild(start);

    if (hasProgress && onRestart) {
      const restart = document.createElement('button');
      restart.type = 'button';
      restart.className = 'btn';
      restart.textContent = 'Начать заново';
      restart.addEventListener('click', () => {
        AudioEngine.playTouch();
        this.showConfirmModal();
      });
      wrap.appendChild(restart);
    }

    this.uiLayer.appendChild(wrap);
    this.menuButtonsEl = wrap;

    if (hasProgress && onRestart) {
      this._createConfirmModal(onRestart);
    }
  },

  _createConfirmModal (onConfirm) {
    const panel = document.createElement('div');
    panel.className = 'confirm-panel';
    panel.setAttribute('aria-hidden', 'true');

    const inner = document.createElement('div');
    inner.className = 'confirm-inner';

    const title = document.createElement('div');
    title.className = 'confirm-title';
    title.textContent = 'Начать заново?';
    inner.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'confirm-line';
    desc.textContent = 'Весь текущий прогресс будет сброшен, и все уровни откроются сначала.';
    inner.appendChild(desc);

    const btnRow = document.createElement('div');
    btnRow.className = 'confirm-buttons';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn';
    okBtn.textContent = 'Сбросить и начать';
    okBtn.addEventListener('click', () => {
      AudioEngine.playTouch();
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
      onConfirm();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-quiet';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', () => {
      AudioEngine.playTouch();
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
    });

    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);
    inner.appendChild(btnRow);
    panel.appendChild(inner);
    this.uiLayer.appendChild(panel);
    this.confirmPanelEl = panel;
  },

  showConfirmModal () {
    if (!this.confirmPanelEl) return;
    this.confirmPanelEl.classList.add('visible');
    this.confirmPanelEl.setAttribute('aria-hidden', 'false');
  },

  /* ── Вступление ─────────────────────── */

  playIntroSequence (onComplete) {
    this.state = 'intro';
    this.uiLayer.style.opacity = '1';
    this.uiLayer.style.transition = '';
    this._introTimers.forEach(t => clearTimeout(t));
    this._introTimers = [];

    if (this.confirmPanelEl) {
      this.confirmPanelEl.classList.remove('visible');
      this.confirmPanelEl.setAttribute('aria-hidden', 'true');
    }

    if (this.menuButtonsEl) {
      const btns = this.menuButtonsEl;
      btns.style.opacity = '0';
      this._later(() => { if (btns.parentNode) btns.remove(); }, 1000);
      this.menuButtonsEl = null;
    }

    const text = document.createElement('div');
    text.className = 'intro-text';
    this.uiLayer.appendChild(text);
    this.introTextEl = text;

    // медленный дрейф камеры
    this.targetCamY = -this.height * 0.86;
    this.targetCamX = this.width * 0.12;
    this.targetCamZoom = 1.055;

    const lines = CONFIG.INTRO_LINES;
    const starts = [650, 4100, 7550];
    lines.forEach((line, i) => {
      const at = starts[i] || (650 + i * 3400);
      this._later(() => this._typeLine(line, 33, 1550), at);
    });

    let finished = false;
    const finishIntro = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('click', finishIntro);
      window.removeEventListener('touchstart', finishIntro);
      this._introTimers.forEach(t => clearTimeout(t));
      this._introTimers = [];
      if (text.parentNode) text.remove();
      this.targetCamX = 0;
      this.targetCamY = 0;
      this.targetCamZoom = 1;
      this.state = 'intro-done';
      this._igniteStarsSequentially(onComplete);
    };

    setTimeout(() => {
      window.addEventListener('click', finishIntro, { once: true });
      window.addEventListener('touchstart', finishIntro, { once: true });
    }, 500);

    this._later(() => {
      text.style.opacity = '0';
      this.targetCamX = 0;
      this.targetCamY = 0;
      this.targetCamZoom = 1;
    }, 10600);

    this._later(finishIntro, 12100);
  },

  _typeLine (text, speed, hold) {
    const el = this.introTextEl;
    if (!el) return;
    el.textContent = '';
    el.style.opacity = '1';
    let i = 0;
    const step = () => {
      if (!el.parentNode) return;
      i++;
      el.textContent = text.slice(0, i);
      if (i < text.length) {
        this._later(step, speed);
      } else {
        this._later(() => { if (el.parentNode) el.style.opacity = '0'; }, hold);
      }
    };
    step();
  },

  _later (fn, ms) {
    const id = setTimeout(() => {
      this._introTimers = this._introTimers.filter(t => t !== id);
      fn();
    }, ms);
    this._introTimers.push(id);
    return id;
  },

  _igniteStarsSequentially (onComplete) {
    this._renderStarsDOM();
    this.starEls.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(.24)';
    });

    CONFIG.STARS.forEach((s, idx) => {
      this._later(() => {
        const el = this.starEls[idx];
        if (!el) return;
        el.style.transition = 'opacity .9s ease, transform 1s cubic-bezier(.18,.8,.25,1)';
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-50%) scale(1)';
        AudioEngine.playStarChime();
      }, idx * 640);
    });

    const total = CONFIG.STARS.length * 640 + 1250;
    this._later(() => {
      const layer = this.uiLayer;
      layer.style.transition = 'opacity .75s ease';
      layer.style.opacity = '0';
      this._later(() => {
        onComplete();
        requestAnimationFrame(() => {
          layer.style.transition = 'opacity 1.05s ease';
          layer.style.opacity = '1';
        });
      }, 720);
    }, total);
  },

  /* ── Карта ──────────────────────────── */

  setupMap (completedIndices, currentIndex, onStarClick, onBack) {
    this.state = 'map';
    this._starClick = onStarClick;
    this.uiLayer.innerHTML = '';
    this.targetCamX = 0;
    this.targetCamY = 0;
    this.targetCamZoom = 1;
    this.progressBarEl = null;
    this.arrowEl = null;

    this._buildLines(completedIndices);
    this._renderProgressBar(completedIndices);
    this._renderStarsDOM();
    this.updateStarsState(completedIndices, currentIndex, onStarClick);
    if (onBack) {
      this._renderBackButton(onBack);
    }
  },

  _renderBackButton (onBack) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn-back';
    back.setAttribute('aria-label', 'В главное меню');
    back.innerHTML = '<svg viewBox="0 0 18 18" width="17" height="17" fill="none"><path d="M11.5 4.5 6.7 9l4.8 4.5" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    back.addEventListener('click', () => {
      AudioEngine.playTouch();
      onBack();
    });
    this.uiLayer.appendChild(back);
  },

  _buildLines (completed) {
    this.drawnLines = [];
    if (completed.includes(0)) this.drawnLines.push([0, 1]);
    if (completed.includes(1)) this.drawnLines.push([1, 2]);
    if (completed.includes(2)) this.drawnLines.push([2, 3]);
    if (completed.includes(3)) this.drawnLines.push([3, 0]);
  },

  _renderProgressBar (completed) {
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    for (let i = 0; i < 3; i++) {
      const dash = document.createElement('div');
      dash.className = 'progress-dash' + (completed.includes(i) ? ' lit' : '');
      bar.appendChild(dash);
    }
    this.uiLayer.appendChild(bar);
    this.progressBarEl = bar;
  },

  lightProgressBar (idx) {
    if (!this.progressBarEl) return;
    const dash = this.progressBarEl.querySelectorAll('.progress-dash')[idx];
    if (dash) dash.classList.add('lit');
  },

  getProgressDashRect (idx) {
    if (this.progressBarEl) {
      const dash = this.progressBarEl.querySelectorAll('.progress-dash')[idx];
      if (dash) return dash.getBoundingClientRect();
    }
    return {
      left: this.width / 2,
      top: 18,
      width: 1,
      height: 1,
      get x () { return this.left; }
    };
  },

  _renderStarsDOM () {
    this.starEls.forEach(el => { if (el.parentNode) el.remove(); });
    this.starEls = [];

    CONFIG.STARS.forEach((s, idx) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'star-point' + (idx === 3 ? ' final-star' : '');
      el.style.left = s.x + '%';
      el.style.top = s.y + '%';
      el.setAttribute('aria-label', 'Звезда ' + (idx + 1));

      const core = document.createElement('span');
      core.className = 'star-core';
      el.appendChild(core);

      this.uiLayer.appendChild(el);
      this.starEls.push(el);
    });
  },

  _repositionStars () {
    CONFIG.STARS.forEach((s, idx) => {
      const el = this.starEls[idx];
      if (el) {
        el.style.left = s.x + '%';
        el.style.top = s.y + '%';
      }
    });
  },

  _sheetIcon () {
    return '<svg class="star-sheet-icon" viewBox="0 0 12 14" fill="none" aria-hidden="true">' +
      '<path d="M2.4 1.2h6.4l2 2.1v9.5H2.4V1.2Z" stroke="currentColor" stroke-width=".9"/>' +
      '<path d="M8.7 1.3v2.2h2.1M4 5.3h4.3M4 7.3h4.3M4 9.3h3" stroke="currentColor" stroke-width=".7" stroke-linecap="round"/>' +
      '</svg>';
  },

  updateStarsState (completedIndices, currentIndex, onStarClick) {
    this.activeStarIndex = currentIndex;
    this._starClick = onStarClick;
    this._removeArrow();

    this.starEls.forEach((el, idx) => {
      el.className = 'star-point' + (idx === 3 ? ' final-star' : '');
      el.onclick = null;
      el.style.cursor = '';
      el.setAttribute('aria-disabled', 'true');
      const oldIcon = el.querySelector('.star-sheet-icon');
      if (oldIcon) oldIcon.remove();

      const done = completedIndices.includes(idx);
      const current = idx === currentIndex;

      if (done) {
        el.classList.add('completed');
        el.setAttribute('aria-disabled', 'false');
        if (idx < 3) {
          el.insertAdjacentHTML('beforeend', this._sheetIcon());
          el.style.cursor = 'pointer';
          el.onclick = () => {
            AudioEngine.playTouch();
            onStarClick(idx, 'completed');
          };
        }
      } else if (current) {
        el.classList.add('current');
        el.setAttribute('aria-disabled', 'false');
        el.style.cursor = 'pointer';
        this._attachArrow(el);
        el.onclick = () => {
          AudioEngine.playTouch();
          onStarClick(idx, 'current');
        };
      } else {
        el.classList.add('dim');
      }
    });
  },

  _attachArrow (starEl) {
    this._removeArrow();
    const arrow = document.createElement('span');
    arrow.className = 'star-arrow';
    arrow.innerHTML = '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
      '<path d="M4.5 6.7 9 11.2l4.5-4.5" stroke="rgba(225,228,245,.9)" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    starEl.appendChild(arrow);
    this.arrowEl = arrow;
  },

  _removeArrow () {
    if (this.arrowEl && this.arrowEl.parentNode) this.arrowEl.remove();
    this.arrowEl = null;
  },

  animateStarLine (fromIdx, toIdx, onDone) {
    const stars = this._starPoints();
    const p1 = stars[fromIdx], p2 = stars[toIdx];
    if (!p1 || !p2) { if (onDone) onDone(); return; }

    const start = performance.now();
    const duration = 1650;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.animatingLine = { from: p1, to: p2, progress: ease };
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.animatingLine = null;
        if (!this.drawnLines.some(l => l[0] === fromIdx && l[1] === toIdx)) {
          this.drawnLines.push([fromIdx, toIdx]);
        }
        if (onDone) onDone();
      }
    };
    requestAnimationFrame(step);
  },

  /* ── Полёт в звезду ─────────────────── */

  flyIntoStar (starIdx, onComplete, opts) {
    const s = CONFIG.STARS[starIdx];
    if (!s) { if (onComplete) onComplete(); return; }

    const options = opts || {};
    const duration = options.duration || 1500;
    const zoom = options.zoom || 2.4;
    const starX = (s.x / 100) * this.width;
    const starY = (s.y / 100) * this.height;

    this.targetCamX = starX - this.width / 2;
    this.targetCamY = starY - this.height / 2;
    this.targetCamZoom = 1 + (zoom - 1) * 0.55;

    const el = this.starEls[starIdx];
    if (el) {
      const dx = this.width / 2 - starX;
      const dy = this.height / 2 - starY;
      el.style.transition = 'transform ' + duration + 'ms cubic-bezier(.45,0,.2,1), opacity ' + (duration * 0.45) + 'ms ease';
      el.style.transform = 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(' + zoom + ')';
      el.style.zIndex = '5';
    }
    this._removeArrow();

    const overlay = document.getElementById('transition-overlay');
    overlay.style.transitionDuration = Math.max(0.65, duration * 0.00055) + 's';
    setTimeout(() => overlay.classList.add('active'), duration * 0.42);

    setTimeout(() => {
      this.targetCamX = 0;
      this.targetCamY = 0;
      this.targetCamZoom = 1;
      this.camX = 0;
      this.camY = 0;
      this.camZoom = 1;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = 'translate(-50%,-50%)';
        el.style.opacity = '1';
        el.style.zIndex = '';
      }
      if (onComplete) onComplete();
    }, duration + 80);
  }
};
