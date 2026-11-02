/* ═══════════════════════════════════════════
   PLATFORMER — уровень 2.
   Логическая ширина 180, пиксельная ночь.
   ═══════════════════════════════════════════ */

const Platformer = {
  container: null,
  onComplete: null,
  wrap: null,
  canvas: null,
  ctx: null,

  W: 180,
  H: 390,
  camera: 0,
  topY: -900,

  hero: null,
  him: null,
  platforms: [],
  particles: [],
  bgStars: [],

  heroImg: null,
  himImg: null,
  heroReady: false,
  himReady: false,

  dragging: false,
  pointerX: null,
  keyDir: 0,

  floorHits: 0,
  floorFlash: 0,
  skipShown: false,
  skipEl: null,

  done: false,
  finishing: false,
  finishT: 0,
  startX: 0,
  startY: 0,
  targetX: 0,
  targetY: 0,
  finishHold: 0,
  finishFade: false,
  finishCalled: false,

  _raf: null,
  _last: 0,
  _acc: 0,
  _tick: 0,
  _resizeHandler: null,

  GRAVITY: 0.28,
  JUMP: -6.6,
  MAX_FALL: 5.2,
  PLAT_COUNT: 32,
  AMBER: '#E8B25A',
  SILVER: '#c3c5d2',
  GRAPHITE: '#252531',
  BG_TOP: '#05050d',
  BG_BOT: '#0a0a1c',

  mount (container, onComplete) {
    this.container = container;
    this.onComplete = onComplete;
    this.done = false;
    this.finishing = false;
    this.finishT = 0;
    this.finishHold = 0;
    this.finishFade = false;
    this.finishCalled = false;
    this.floorHits = 0;
    this.floorFlash = 0;
    this.skipShown = false;
    this.skipEl = null;
    this.particles = [];
    this.dragging = false;
    this.pointerX = null;
    this.keyDir = 0;
    this.camera = 0;
    this._acc = 0;
    this._tick = 0;

    this.W = 180;
    this.H = Math.max(100, Math.round(this.W * window.innerHeight / Math.max(1, window.innerWidth)));

    const wrap = document.createElement('div');
    wrap.className = 'platformer-wrap';
    container.appendChild(wrap);
    this.wrap = wrap;

    const cvs = document.createElement('canvas');
    cvs.className = 'platformer-canvas';
    cvs.width = this.W;
    cvs.height = this.H;
    wrap.appendChild(cvs);
    this.canvas = cvs;
    this.ctx = cvs.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn-back';
    back.setAttribute('aria-label', 'Назад к карте');
    back.innerHTML = '<svg viewBox="0 0 18 18" width="17" height="17" fill="none"><path d="M11.5 4.5 6.7 9l4.8 4.5" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    back.addEventListener('click', () => {
      if (this.done) return;
      AudioEngine.playTouch();
      this._teardown();
      App.backToMap();
    });
    wrap.appendChild(back);

    this._generateWorld();
    this._makeStars();
    this._initActors();
    this._loadSprites();
    this._bindInput();

    this._resizeHandler = () => {
      if (this.canvas) this.ctx.imageSmoothingEnabled = false;
    };
    window.addEventListener('resize', this._resizeHandler);

    this._last = performance.now();
    this._loop();
  },

  _teardown () {
    if (this.done) return;
    this.done = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._unbindInput();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    this._resizeHandler = null;
    if (this.wrap && this.wrap.parentNode) this.wrap.remove();
    this.wrap = null;
  },

  _generateWorld () {
    this.platforms = [];
    let y = this.H - 34;

    const first = {
      x: this.W / 2 - 32, y, w: 64, moving: false,
      dx: 0, range: 0, baseX: this.W / 2 - 32, debris: false
    };
    this.platforms.push(first);

    // ровно ~30% платформ движутся, а не случайные 0-100%
    const movable = [];
    for (let i = 5; i < this.PLAT_COUNT - 1; i++) movable.push(i);
    for (let i = movable.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [movable[i], movable[j]] = [movable[j], movable[i]];
    }
    const movingSet = new Set(movable.slice(0, Math.max(1, Math.ceil(movable.length * 0.3))));

    for (let i = 1; i < this.PLAT_COUNT; i++) {
      const gap = 29 + Math.random() * 17; // ≤ 46; max jump ≈ 77
      y -= gap;
      const w = 28 + Math.floor(Math.random() * 19);
      const moving = movingSet.has(i);

      let range = moving ? 16 + Math.random() * 20 : 0;
      const maxRange = Math.max(0, (this.W - w) / 2 - 3);
      if (range > maxRange) range = maxRange;
      let x = 3 + range + Math.random() * Math.max(1, this.W - w - range * 2 - 6);

      this.platforms.push({
        x, y, w, moving,
        dx: moving ? (0.32 + Math.random() * 0.38) * (Math.random() < 0.5 ? 1 : -1) : 0,
        range,
        baseX: x,
        debris: Math.random() < 0.42
      });
    }

    const top = this.platforms[this.platforms.length - 1];
    top.moving = false;
    top.w = 62;
    top.x = this.W / 2 - top.w / 2;
    top.baseX = top.x;
    top.range = 0;
    top.dx = 0;
    top.debris = false;
    this.topY = top.y;
  },

  _makeStars () {
    this.bgStars = [];
    const layers = [70, 40, 18];
    for (let l = 0; l < 3; l++) {
      for (let i = 0; i < layers[l]; i++) {
        this.bgStars.push({
          x: Math.random() * this.W,
          y: Math.random() * this.H * 2.4,
          size: l === 0 ? 1 : (l === 1 ? 1 : 2),
          layer: l,
          alpha: 0.15 + Math.random() * 0.55
        });
      }
    }
  },

  _initActors () {
    const start = this.platforms[0];
    this.hero = {
      x: start.x + start.w / 2 - 5,
      y: start.y - 15,
      w: 10, h: 15,
      vy: 0, facing: 1
    };

    const top = this.platforms[this.platforms.length - 1];
    this.him = {
      x: top.x + top.w * 0.62 - 5,
      y: top.y - 15,
      w: 10, h: 15,
      facing: -1
    };
  },

  /* ── Спрайты: обрезка + nearest ── */

  _loadSprites () {
    const hi = new Image();
    const onHeroLoad = () => {
      this.heroImg = this._processSprite(hi);
      this.heroReady = !!this.heroImg;
    };
    hi.onload = onHeroLoad;
    hi.onerror = () => { this.heroReady = false; };
    hi.src = CONFIG.HERO_IMG;
    if (hi.complete && (hi.naturalWidth > 0 || hi.width > 0)) {
      onHeroLoad();
    }

    const hm = new Image();
    const onHimLoad = () => {
      this.himImg = this._processSprite(hm);
      this.himReady = !!this.himImg;
    };
    hm.onload = onHimLoad;
    hm.onerror = () => { this.himReady = false; };
    hm.src = CONFIG.HIM_IMG;
    if (hm.complete && (hm.naturalWidth > 0 || hm.width > 0)) {
      onHimLoad();
    }
  },

  _processSprite (img) {
    try {
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      if (!imgW || !imgH) return img;

      const maxSide = 96;
      const k = maxSide / Math.max(1, imgW, imgH);
      const sw = Math.max(1, Math.round(imgW * k));
      const sh = Math.max(1, Math.round(imgH * k));

      const c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, sw, sh);

      let id;
      try {
        id = ctx.getImageData(0, 0, sw, sh);
      } catch (_) {
        // На file:/// или при блокировке CORS возвращаем канвас со спрайтом
        return c;
      }

      const d = id.data;

      // убираем однотонный зелёный фон с допуском
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (g > 100 && g > r * 1.25 + 8 && g > b * 1.25 + 8 && g - Math.min(r,b) > 25) {
          d[i + 3] = 0;
        }
      }
      ctx.putImageData(id, 0, 0);

      let minX = sw, minY = sh, maxX = -1, maxY = -1;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (d[(y * sw + x) * 4 + 3] > 12) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) return c;

      const tw = maxX - minX + 1;
      const th = maxY - minY + 1;
      const targetH = 30;
      const targetW = Math.max(1, Math.round(tw * targetH / th));

      const out = document.createElement('canvas');
      out.width = targetW; out.height = targetH;
      const octx = out.getContext('2d');
      octx.imageSmoothingEnabled = false;
      octx.drawImage(c, minX, minY, tw, th, 0, 0, targetW, targetH);
      return out;
    } catch (_) {
      return img;
    }
  },

  /* ── Ввод ──────────────────────────────── */

  _bindInput () {
    const el = this.canvas;
    if (!el) return;

    this._onDown = (e) => {
      if (e.cancelable) e.preventDefault();
      this.dragging = true;
      this._setPointerX(e);
    };
    this._onMove = (e) => {
      if (!this.dragging) return;
      if (e.cancelable) e.preventDefault();
      this._setPointerX(e);
    };
    this._onUp = () => {
      this.dragging = false;
      this.pointerX = null;
    };

    if (window.PointerEvent) {
      el.addEventListener('pointerdown', this._onDown, { passive: false });
      el.addEventListener('pointermove', this._onMove, { passive: false });
      el.addEventListener('pointerup', this._onUp);
      el.addEventListener('pointercancel', this._onUp);
      el.addEventListener('pointerleave', this._onUp);
    } else {
      el.addEventListener('touchstart', this._onDown, { passive: false });
      el.addEventListener('touchmove', this._onMove, { passive: false });
      el.addEventListener('touchend', this._onUp);
      el.addEventListener('touchcancel', this._onUp);
      el.addEventListener('mousedown', this._onDown);
      el.addEventListener('mousemove', this._onMove);
      el.addEventListener('mouseup', this._onUp);
    }

    this._onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keyDir = -1;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keyDir = 1;
    };
    this._onKeyUp = () => { this.keyDir = 0; };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
  },

  _unbindInput () {
    const el = this.canvas;
    if (!el) return;
    if (window.PointerEvent) {
      el.removeEventListener('pointerdown', this._onDown);
      el.removeEventListener('pointermove', this._onMove);
      el.removeEventListener('pointerup', this._onUp);
      el.removeEventListener('pointercancel', this._onUp);
      el.removeEventListener('pointerleave', this._onUp);
    } else {
      el.removeEventListener('touchstart', this._onDown);
      el.removeEventListener('touchmove', this._onMove);
      el.removeEventListener('touchend', this._onUp);
      el.removeEventListener('touchcancel', this._onUp);
      el.removeEventListener('mousedown', this._onDown);
      el.removeEventListener('mousemove', this._onMove);
      el.removeEventListener('mouseup', this._onUp);
    }
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
  },

  _setPointerX (e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    this.pointerX = Math.max(0, Math.min(this.W, (e.clientX - rect.left) / rect.width * this.W));
  },

  /* ── Цикл ──────────────────────────────── */

  _loop () {
    if (this.done) return;
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this._acc += dt;

    let guard = 0;
    while (this._acc >= 1 / 60 && guard++ < 4) {
      this._update();
      this._acc -= 1 / 60;
    }

    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  },

  _update () {
    if (this.done) return;
    this._tick++;

    if (this.finishing) {
      this._updateFinish();
      this._updateParticles();
      this.floorFlash *= 0.94;
      return;
    }

    const h = this.hero;
    if (!h) return;

    // платформы
    for (const p of this.platforms) {
      if (!p.moving) continue;
      p.x += p.dx;
      if (p.x < p.baseX - p.range) { p.x = p.baseX - p.range; p.dx = Math.abs(p.dx); }
      if (p.x > p.baseX + p.range) { p.x = p.baseX + p.range; p.dx = -Math.abs(p.dx); }
      p.x = Math.max(0, Math.min(this.W - p.w, p.x));
    }

    // горизонталь: палец ведёт с плавным догоном
    if (this.dragging && this.pointerX !== null) {
      const center = h.x + h.w / 2;
      const diff = this.pointerX - center;
      const step = Math.max(-6, Math.min(6, diff * 0.22));
      h.x += step;
      if (diff > 0.6) h.facing = 1;
      else if (diff < -0.6) h.facing = -1;
    } else if (this.keyDir !== 0) {
      h.x += this.keyDir * 2.2;
      h.facing = this.keyDir;
    }

    if (h.x + h.w < 0) h.x = this.W;
    else if (h.x > this.W) h.x = -h.w;

    // гравитация
    const prevBottom = h.y + h.h;
    h.vy += this.GRAVITY;
    if (h.vy > this.MAX_FALL) h.vy = this.MAX_FALL;
    h.y += h.vy;
    const bottom = h.y + h.h;

    // приземление только сверху
    if (h.vy > 0) {
      for (const p of this.platforms) {
        if (h.x + h.w < p.x + 1 || h.x > p.x + p.w - 1) continue;
        if (bottom >= p.y && prevBottom <= p.y + 2) {
          h.y = p.y - h.h;
          h.vy = this.JUMP;
          h.x += p.dx;
          AudioEngine.playJumpBlip();
          for (let i = 0; i < 3; i++) {
            this.particles.push({
              x: h.x + h.w / 2 + (Math.random() - 0.5) * 8,
              y: h.y + h.h,
              vx: (Math.random() - 0.5) * 0.8,
              vy: -0.2 - Math.random() * 0.6,
              life: 16 + Math.random() * 10,
              maxLife: 26,
              amber: false
            });
          }
          break;
        }
      }
    }

    // камера только вверх
    const camTarget = h.y - this.H * 0.42;
    if (camTarget < this.camera) this.camera = camTarget;
    if (h.y - this.camera < 6) this.camera = h.y - 6;

    // мягкий свет снизу — упасть нельзя
    if (h.y > this.camera + this.H + 28) {
      this.floorHits++;
      this.floorFlash = 1;
      h.y = this.camera + this.H * 0.67;
      h.vy = this.JUMP * 0.92;
      h.x = Math.max(2, Math.min(this.W - h.w - 2, h.x));
      AudioEngine.playLanding();
      for (let i = 0; i < 12; i++) {
        this.particles.push({
          x: h.x + h.w / 2 + (Math.random() - 0.5) * 28,
          y: this.camera + this.H - 2,
          vx: (Math.random() - 0.5) * 2.2,
          vy: -1 - Math.random() * 2.4,
          life: 30 + Math.random() * 20,
          maxLife: 50,
          amber: false
        });
      }
      if (this.floorHits >= 5) this._showSkip();
    }

    // верхняя платформа
    if (h.y + h.h <= this.topY + 7) {
      this._beginFinish();
    }

    this._updateParticles();
    this.floorFlash *= 0.94;
  },

  _updateParticles () {
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.035;
      p.life--;
      return p.life > 0;
    });
  },

  _showSkip () {
    if (this.skipShown || this.done) return;
    this.skipShown = true;
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'btn btn-quiet btn-skip';
    skip.textContent = 'Пропустить';
    skip.style.opacity = '0';
    skip.style.transition = 'opacity .8s ease';
    skip.addEventListener('click', () => {
      if (this.done) return;
      AudioEngine.playTouch();
      this._skipLevel();
    });
    this.wrap.appendChild(skip);
    this.skipEl = skip;
    requestAnimationFrame(() => { skip.style.opacity = '1'; });
  },

  _skipLevel () {
    if (this.finishing || this.done) return;
    this.finishing = true;
    if (this.skipEl) this.skipEl.style.opacity = '0';
    this.wrap.style.transition = 'opacity 1.1s ease';
    this.wrap.style.opacity = '0';
    setTimeout(() => {
      if (this.done) return;
      this._teardown();
      if (this.onComplete) this.onComplete();
    }, 1200);
  },

  _beginFinish () {
    if (this.finishing || this.done) return;
    this.finishing = true;
    this.dragging = false;
    this.pointerX = null;
    this.finishT = 0;
    this.finishHold = 0;
    this.finishFade = false;
    this.startX = this.hero.x;
    this.startY = this.hero.y;
    this.targetY = this.him.y;

    let tx = this.him.x - this.hero.w - 2;
    if (tx < 2 || tx + this.hero.w > this.W - 2) tx = this.him.x + this.him.w + 2;
    tx = Math.max(2, Math.min(this.W - this.hero.w - 2, tx));
    this.targetX = tx;
    this.hero.facing = this.him.x > this.hero.x ? 1 : -1;

    AudioEngine.playStarChime();
    for (let i = 0; i < 22; i++) this._spark(true);
  },

  _updateFinish () {
    this.finishT = Math.min(1, this.finishT + 1 / 68);
    const t = this.finishT;
    const ease = 1 - Math.pow(1 - t, 3);

    this.hero.x = this.startX + (this.targetX - this.startX) * ease;
    this.hero.y = this.startY + (this.targetY - this.startY) * ease - Math.sin(t * Math.PI) * 18;

    const camTarget = this.topY - this.H * 0.46;
    this.camera += (camTarget - this.camera) * 0.055;

    if (t < 1) {
      if (this._tick % 4 === 0) this._spark(true);
      return;
    }

    this.hero.x = this.targetX;
    this.hero.y = this.targetY;
    this.finishHold++;

    if (this.finishHold % 5 === 0) this._spark(true);

    if (this.finishHold === 70 && !this.finishFade) {
      this.finishFade = true;
      this.wrap.style.transition = 'opacity 1.25s ease';
      this.wrap.style.opacity = '0';
    }

    if (this.finishHold >= 155 && !this.finishCalled) {
      this.finishCalled = true;
      this._teardown();
      if (this.onComplete) this.onComplete();
    }
  },

  _spark (amber) {
    const h = this.hero;
    this.particles.push({
      x: h.x + h.w / 2 + (Math.random() - 0.5) * 26,
      y: h.y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 1.6,
      vy: -0.4 - Math.random() * 1.5,
      life: 40 + Math.random() * 30,
      maxLife: 70,
      amber: !!amber
    });
  },

  /* ── Рисование ─────────────────────────── */

  _draw () {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.W, H = this.H, cam = this.camera;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, this.BG_TOP);
    grad.addColorStop(1, this.BG_BOT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this._drawBgStars(cam);

    for (const p of this.platforms) {
      const py = p.y - cam;
      if (py < -14 || py > H + 14) continue;
      this._drawPlatform(p, py);
    }

    // он — янтарный акцент
    const himY = this.him.y - cam;
    if (himY > -30 && himY < H + 30) {
      this._drawGlow(this.him.x + this.him.w / 2, himY + this.him.h, 12, 'rgba(232,178,90,.18)');
      this._drawCharacter(this.him.x, himY, this.himImg, this.himReady, this.him.facing, true);
    }

    // она
    if (this.hero) {
      const hy = this.hero.y - cam;
      this._drawGlow(this.hero.x + this.hero.w / 2, hy + this.hero.h, 10, 'rgba(200,205,228,.13)');
      this._drawCharacter(this.hero.x, hy, this.heroImg, this.heroReady, this.hero.facing, false);
    }

    // частицы
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.amber
        ? 'rgba(232,178,90,' + (a * 0.9).toFixed(3) + ')'
        : 'rgba(195,197,210,' + (a * 0.8).toFixed(3) + ')';
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y - cam), 2, 2);
    }

    // мягкий свет снизу
    const lightA = 0.055 + this.floorFlash * 0.28;
    const lg = ctx.createLinearGradient(0, H - 58, 0, H);
    lg.addColorStop(0, 'rgba(190,195,220,0)');
    lg.addColorStop(1, 'rgba(190,195,220,' + lightA.toFixed(3) + ')');
    ctx.fillStyle = lg;
    ctx.fillRect(0, H - 58, W, 58);
  },

  _drawBgStars (cam) {
    const ctx = this.ctx, H = this.H;
    const factors = [0.12, 0.32, 0.62];
    for (const s of this.bgStars) {
      const sy = s.y - cam * factors[s.layer];
      const wrap = ((sy % (H * 2.4)) + H * 2.4) % (H * 2.4) - H * 0.7;
      if (wrap < -6 || wrap > H + 6) continue;
      ctx.fillStyle = 'rgba(200,205,228,' + s.alpha.toFixed(3) + ')';
      ctx.fillRect(Math.floor(s.x), Math.floor(wrap), s.size, s.size);
    }
  },

  _drawPlatform (p, py) {
    const ctx = this.ctx;
    const x = Math.round(p.x);
    const y = Math.round(py);
    const w = Math.round(p.w);

    ctx.fillStyle = 'rgba(8,8,16,.55)';
    ctx.fillRect(x + 1, y + 5, w, 2);

    ctx.fillStyle = this.GRAPHITE;
    ctx.fillRect(x, y, w, 5);

    ctx.fillStyle = 'rgba(185,189,208,.42)';
    ctx.fillRect(x, y, w, 1);

    const bw = Math.max(4, Math.floor(w / 5));
    ctx.fillStyle = 'rgba(44,44,58,.95)';
    ctx.fillRect(x + bw, y - 2, bw, 2);
    ctx.fillRect(x + bw * 2, y - 3, bw, 3);
    if (w > 34) ctx.fillRect(x + bw * 3, y - 1, bw, 1);
    ctx.fillRect(x + Math.floor(w / 2), y + 5, 3, 2);

    if (p.debris) {
      ctx.fillStyle = 'rgba(180,184,202,.18)';
      ctx.fillRect(x + 3, y + 2, 2, 1);
      ctx.fillRect(x + w - 8, y + 3, 2, 1);
      ctx.fillRect(x + Math.floor(w * 0.55), y + 1, 1, 1);
    }
  },

  _drawGlow (cx, feetY, r, color) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(cx, feetY - 2, 0, cx, feetY - 2, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, feetY - 2 - r, r * 2, r * 2);
  },

  _drawCharacter (x, y, sprite, ready, facing, isHim) {
    const ctx = this.ctx;
    const actorW = 10;
    const drawH = 23;

    const img = sprite || (isHim ? this.himImg : this.heroImg);
    const isReady = (ready && sprite) || (img && (img.complete || img.width > 0));

    if (isReady && img) {
      const iw = img.width || img.naturalWidth || 10;
      const ih = img.height || img.naturalHeight || 23;
      const drawW = Math.max(8, Math.round(drawH * iw / ih));
      const dx = Math.floor(x + actorW / 2 - drawW / 2);
      const dy = Math.floor(y + 15 - drawH);
      ctx.save();
      if (facing < 0) {
        ctx.translate(dx + drawW, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, drawW, drawH);
      } else {
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }
      ctx.restore();
      return;
    }

    this._drawPixelPerson(x, y, facing, isHim);
  },

  _drawPixelPerson (x, y, facing, isHim) {
    const ctx = this.ctx;
    const ox = Math.floor(x - 1);
    const oy = Math.floor(y + 15 - 16);
    const px = (r, c, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(ox + c, oy + r, w, h);
    };

    const body = isHim ? 'rgba(218,164,82,.95)' : 'rgba(198,201,216,.95)';
    const light = 'rgba(225,227,238,.95)';
    const dark = 'rgba(32,32,42,.95)';

    // голова
    px(0, 3, 6, 5, light);
    // волосы
    px(0, 3, 6, 1, dark);
    px(0, 9, 2, 2, body);
    // глаз
    px(2, facing < 0 ? 4 : 7, 1, 1, dark);
    // тело
    px(5, 2, 8, 5, body);
    // янтарный шарф
    px(5, 3, 6, 1, this.AMBER);
    // руки
    px(6, 0, 2, 4, body);
    px(6, 10, 2, 4, body);
    // ноги
    px(10, 3, 3, 6, light);
    px(10, 6, 3, 6, light);
  }
};
