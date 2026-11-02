/* ═══════════════════════════════════════════
   QUIZ — уровень 1.
   Один экран, один вопрос. Ошибка не наказывает.
   ═══════════════════════════════════════════ */

const Quiz = {
  container: null,
  onComplete: null,
  wrap: null,
  bgLayer: null,
  progEl: null,
  current: 0,
  wrongCount: 0,
  skipShown: false,
  skipEl: null,
  _advanceTimer: null,
  _timers: [],
  _locked: false,
  _finishing: false,
  _destroyed: false,

  mount (container, onComplete) {
    this.container = container;
    this.onComplete = onComplete;
    this.current = 0;
    this.wrongCount = 0;
    this.skipShown = false;
    this.skipEl = null;
    this._advanceTimer = null;
    this._timers = [];
    this._locked = false;
    this._finishing = false;
    this._destroyed = false;

    const wrap = document.createElement('div');
    wrap.className = 'quiz-container';
    container.appendChild(wrap);
    this.wrap = wrap;

    const bgLayer = document.createElement('div');
    bgLayer.className = 'quiz-bgs';
    wrap.appendChild(bgLayer);
    this.bgLayer = bgLayer;

    const dim = document.createElement('div');
    dim.className = 'quiz-dim';
    wrap.appendChild(dim);

    const grain = document.createElement('canvas');
    grain.className = 'quiz-grain';
    this._paintGrain(grain);
    wrap.appendChild(grain);

    const prog = document.createElement('div');
    prog.className = 'quiz-progress';
    for (let i = 0; i < 5; i++) {
      const tick = document.createElement('div');
      tick.className = 'quiz-tick';
      prog.appendChild(tick);
    }
    wrap.appendChild(prog);
    this.progEl = prog;

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

    this._showQuestion(0);
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
    clearTimeout(this._advanceTimer);
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    if (this.wrap && this.wrap.parentNode) this.wrap.remove();
    this.wrap = null;
  },

  _showQuestion (idx) {
    if (this._destroyed || this._finishing) return;
    if (idx >= CONFIG.QUIZ.length) {
      this._finish();
      return;
    }

    this.current = idx;
    this._locked = false;
    const q = CONFIG.QUIZ[idx];
    if (!q) { this._finish(); return; }

    // старые блоки
    const oldQ = this.wrap.querySelector('.quiz-question-box');
    const oldO = this.wrap.querySelector('.quiz-options');
    if (oldQ) {
      oldQ.classList.remove('show');
      this._later(() => { if (oldQ.parentNode) oldQ.remove(); }, 560);
    }
    if (oldO) {
      oldO.classList.remove('show');
      this._later(() => { if (oldO.parentNode) oldO.remove(); }, 560);
    }

    // фон с перетеканием
    this._makeBackground(q);

    // вопрос
    const qBox = document.createElement('div');
    qBox.className = 'quiz-question-box';
    qBox.textContent = q.question;
    this.wrap.appendChild(qBox);

    // варианты — порядок не меняется
    const opts = document.createElement('div');
    opts.className = 'quiz-options';
    q.options.forEach((label, oi) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      btn.textContent = label;
      btn.addEventListener('click', () => this._answer(idx, oi, opts));
      opts.appendChild(btn);
    });
    this.wrap.appendChild(opts);

    this._later(() => {
      qBox.classList.add('show');
      opts.classList.add('show');
    }, 140);

    this._updateProgress(idx);
  },

  _makeBackground (q) {
    const old = this.bgLayer.querySelectorAll('.quiz-bg');
    const bg = document.createElement('div');
    bg.className = 'quiz-bg';

    if (q.bg) {
      const img = document.createElement('img');
      img.className = 'quiz-bg-photo';
      img.src = q.bg;
      img.alt = '';
      bg.appendChild(img);
    } else {
      const bokeh = this._bokehCanvas();
      bg.appendChild(bokeh);
    }

    this.bgLayer.appendChild(bg);

    requestAnimationFrame(() => {
      bg.style.transition = 'opacity 1.35s ease, transform 15s linear';
      bg.style.opacity = '1';
      bg.style.transform = 'scale(1.085)';
    });

    old.forEach(layer => {
      layer.style.opacity = '0';
      this._later(() => { if (layer.parentNode) layer.remove(); }, 1450);
    });
  },

  _answer (qIdx, optIdx, optsContainer) {
    if (this._locked || this._destroyed) return;
    this._locked = true;

    const q = CONFIG.QUIZ[qIdx];
    const btns = optsContainer.querySelectorAll('.quiz-option');
    btns.forEach(b => { b.style.pointerEvents = 'none'; });

    const chosen = btns[optIdx];
    if (chosen) {
      chosen.classList.add('tapped');
      this._later(() => chosen.classList.remove('tapped'), 500);
    }

    AudioEngine.playTouch();

    if (optIdx === q.correct) {
      if (btns[q.correct]) btns[q.correct].classList.add('correct');
    } else {
      this.wrongCount++;
      if (chosen) chosen.classList.add('wrong');
      if (btns[q.correct]) btns[q.correct].classList.add('correct');
      if (this.wrongCount >= 2) this._showSkip();
    }

    const tick = this.progEl.querySelectorAll('.quiz-tick')[qIdx];
    if (tick) { tick.classList.remove('current'); tick.classList.add('done'); }

    this._advanceTimer = setTimeout(() => {
      if (!this._destroyed) this._showQuestion(qIdx + 1);
    }, 1250);
  },

  _showSkip () {
    if (this.skipShown || this._destroyed) return;
    this.skipShown = true;

    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'btn btn-quiet btn-skip';
    skip.textContent = 'Пропустить';
    skip.style.opacity = '0';
    skip.style.transition = 'opacity .8s ease';
    skip.addEventListener('click', () => {
      if (this._destroyed) return;
      AudioEngine.playTouch();
      this._finish();
    });
    this.wrap.appendChild(skip);
    this.skipEl = skip;
    this._later(() => { skip.style.opacity = '1'; }, 80);
  },

  _updateProgress (idx) {
    const ticks = this.progEl.querySelectorAll('.quiz-tick');
    ticks.forEach((t, i) => {
      t.classList.remove('current', 'done');
      if (i < idx) t.classList.add('done');
      if (i === idx) t.classList.add('current');
    });
  },

  _finish () {
    if (this._finishing || this._destroyed) return;
    this._finishing = true;
    clearTimeout(this._advanceTimer);

    const ticks = this.progEl.querySelectorAll('.quiz-tick');
    ticks.forEach(t => { t.classList.remove('current'); t.classList.add('done'); });

    this.wrap.style.transition = 'opacity .95s ease';
    this.wrap.style.opacity = '0';

    setTimeout(() => {
      if (this._destroyed) return;
      this._teardown();
      if (this.onComplete) this.onComplete();
    }, 1000);
  },

  _paintGrain (canvas) {
    const w = 128, h = 128;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const id = ctx.createImageData(w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  },

  _bokehCanvas () {
    const cvs = document.createElement('canvas');
    cvs.width = 360; cvs.height = 640;
    const ctx = cvs.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 360, 640);
    grad.addColorStop(0, '#0b0b1a');
    grad.addColorStop(0.5, '#151527');
    grad.addColorStop(1, '#080811');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 360, 640);

    for (let i = 0; i < 22; i++) {
      const x = Math.random() * 360;
      const y = Math.random() * 640;
      const r = 18 + Math.random() * 62;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(180,184,220,' + (0.035 + Math.random() * 0.06).toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(150,155,190,0.02)');
      g.addColorStop(1, 'rgba(120,125,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return cvs;
  }
};
