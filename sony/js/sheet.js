/* ═══════════════════════════════════════════
   SHEET — момент награды.
   Чистый чёрный #000 живёт только здесь.
   ═══════════════════════════════════════════ */

const Sheet = {
  _timer: null,
  _started: false,

  show (index, container, onDone) {
    this._render(index, container, false, onDone);
  },

  showReadOnly (index, container, onClose) {
    this._render(index, container, true, onClose);
  },

  _render (index, container, readOnly, callback) {
    this._started = false;
    if (this._timer) clearTimeout(this._timer);

    const scene = document.createElement('div');
    scene.className = 'sheet-scene';
    container.appendChild(scene);

    const flare = document.createElement('div');
    flare.className = 'reward-flare';
    flare.innerHTML = '<span></span>';
    scene.appendChild(flare);
    setTimeout(() => { if (flare.parentNode) flare.remove(); }, 1700);

    const paper = document.createElement('div');
    paper.className = 'sheet-paper';
    scene.appendChild(paper);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-quiet sheet-btn';
    btn.textContent = readOnly ? 'Закрыть' : 'Дальше';
    scene.appendChild(btn);

    const src = (CONFIG.SHEET_IMAGES && CONFIG.SHEET_IMAGES[index]) || '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Лист ' + (index + 1);
      img.className = 'sheet-img';
      paper.appendChild(img);
    } else {
      const cvs = this._tornPaper(720, 960);
      cvs.setAttribute('aria-hidden', 'true');
      paper.appendChild(cvs);
    }

    this._reveal(scene, paper, btn, readOnly, callback, index);
  },

  _reveal (scene, paper, btn, readOnly, callback, index) {
    if (this._started) return;
    this._started = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }

    requestAnimationFrame(() => {
      paper.style.opacity = '1';
      paper.style.transform = 'rotate(2deg) scale(1)';
    });

    const delay = CONFIG.SHEET_MIN_READ_SECONDS * 1000;
    setTimeout(() => {
      btn.classList.add('show');
    }, delay);

    btn.addEventListener('click', () => {
      if (btn.dataset.busy === '1') return;
      btn.dataset.busy = '1';
      AudioEngine.playTouch();
      btn.classList.remove('show');

      if (readOnly) {
        this._closeReadOnly(scene, paper, callback);
      } else {
        this._flyAway(scene, paper, index, callback);
      }
    });
  },

  _closeReadOnly (scene, paper, callback) {
    scene.classList.add('revealing');
    scene.style.background = 'transparent';
    if (scene.parentElement) scene.parentElement.style.background = 'transparent';
    paper.style.opacity = '0';
    paper.style.transform = 'rotate(0deg) scale(.9)';
    setTimeout(() => {
      if (scene.parentNode) scene.remove();
      callback();
    }, 850);
  },

  _flyAway (scene, paper, index, callback) {
    const rect = paper.getBoundingClientRect();
    let target = null;
    if (typeof Menu !== 'undefined' && Menu.getProgressDashRect) {
      target = Menu.getProgressDashRect(index);
    }
    const tx = target ? (target.left + target.width / 2) : window.innerWidth / 2;
    const ty = target ? (target.top + target.height / 2) : 18;
    const dx = tx - (rect.left + rect.width / 2);
    const dy = ty - (rect.top + rect.height / 2);

    scene.classList.add('revealing');
    scene.style.background = 'transparent';
    if (scene.parentElement) scene.parentElement.style.background = 'transparent';

    paper.style.transition = 'transform 1.15s cubic-bezier(.42,0,.2,1),opacity 1.15s ease';
    paper.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(.06)';
    paper.style.opacity = '0.35';

    setTimeout(() => {
      if (scene.parentNode) scene.remove();
      callback();
    }, 1180);
  },

  /* Убираем тёмный фон и обрезаем поля,
     чтобы лист летел к карте без чёрного прямоугольника. */
  _paperImage (img) {
    try {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      if (!origW || !origH) return img;

      // Масштабируем до разумного размера, чтобы обработка была мгновенной
      const maxDim = 800;
      const scale = Math.min(1, maxDim / Math.max(origW, origH));
      const w = Math.max(1, Math.round(origW * scale));
      const h = Math.max(1, Math.round(origH * scale));

      const src = document.createElement('canvas');
      src.width = w; src.height = h;
      const sctx = src.getContext('2d');
      if (!sctx) return img;
      sctx.drawImage(img, 0, 0, w, h);

      let data;
      try {
        data = sctx.getImageData(0, 0, w, h);
      } catch (_) {
        // На протоколе file:/// или при CORS возвращаем оригинальный img
        return img;
      }

      const d = data.data;
      const n = w * h;

      // Убираем только тёмный фон, связанный с краями изображения
      const dark = new Uint8Array(n);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        if (lum < 68) dark[p] = 1;
      }

      const seen = new Uint8Array(n);
      const stack = [];
      const push = (x, y) => {
        const p = y * w + x;
        if (!seen[p] && dark[p]) { seen[p] = 1; stack.push(p); }
      };

      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

      while (stack.length) {
        const p = stack.pop();
        const x = p % w;
        const y = (p - x) / w;
        d[p * 4 + 3] = 0;
        if (x > 0) push(x - 1, y);
        if (x < w - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < h - 1) push(x, y + 1);
      }

      // Мягкий край
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const i = p * 4;
          if (d[i + 3] === 0) continue;
          const touches =
            (x > 0 && d[(p - 1) * 4 + 3] === 0) ||
            (x < w - 1 && d[(p + 1) * 4 + 3] === 0) ||
            (y > 0 && d[(p - w) * 4 + 3] === 0) ||
            (y < h - 1 && d[(p + w) * 4 + 3] === 0);
          if (!touches) continue;
          const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          if (lum < 130) d[i + 3] = Math.max(0, Math.min(255, Math.round(255 * (lum - 68) / 62)));
        }
      }

      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 12) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      sctx.putImageData(data, 0, 0);
      if (maxX < 0 || maxX < minX || maxY < minY) return img;

      const pad = 2;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad);
      maxY = Math.min(h - 1, maxY + pad);

      const out = document.createElement('canvas');
      out.width = maxX - minX + 1;
      out.height = maxY - minY + 1;
      const octx = out.getContext('2d');
      if (octx) octx.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
      return out;
    } catch (_) {
      return img;
    }
  },

  /* Рваная бумага, если PNG не загрузился */
  _tornPaper (w, h) {
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d');
    const m = 18;

    ctx.beginPath();
    ctx.moveTo(m + this._rnd(5), m + this._rnd(8));
    for (let x = m; x < w - m; x += 5) ctx.lineTo(x, m + this._rnd(10));
    for (let y = m; y < h - m; y += 5) ctx.lineTo(w - m + this._rnd(8), y);
    for (let x = w - m; x > m; x -= 5) ctx.lineTo(x, h - m + this._rnd(10));
    for (let y = h - m; y > m; y -= 5) ctx.lineTo(m + this._rnd(8), y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#f0ece1');
    grad.addColorStop(0.55, '#e6e1d4');
    grad.addColorStop(1, '#dcd6c8');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.clip();
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const noise = (Math.random() - 0.5) * 26;
      d[i] += noise; d[i + 1] += noise; d[i + 2] += noise;
    }
    ctx.putImageData(id, 0, 0);
    ctx.restore();

    return cvs;
  },

  _rnd (range) { return (Math.random() - 0.5) * range; }
};
