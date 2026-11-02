/* ═══════════════════════════════════════════
   FINAL — заменяемая сцена.
   Всё содержимое финала живёт в runFinal().
   ═══════════════════════════════════════════ */

function runFinal (container, onComplete) {
  const wrap = document.createElement('div');
  wrap.className = 'final-container';
  container.appendChild(wrap);

  const cvs = document.createElement('canvas');
  cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  wrap.appendChild(cvs);

  const ctx = cvs.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let stars = [];
  let raf = null;
  let lineStart = 0;
  let lineDone = false;
  let captionShown = false;
  let finished = false;
  let startTime = performance.now();

  const bgStars = [];
  for (let i = 0; i < 150; i++) {
    bgStars.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() < 0.8 ? 0.8 : 1.5,
      a: 0.12 + Math.random() * 0.5,
      p: Math.random() * Math.PI * 2,
      s: 0.3 + Math.random() * 1.2
    });
  }

  function resize () {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = window.innerWidth;
    H = window.innerHeight;
    cvs.width = Math.round(W * dpr);
    cvs.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars = CONFIG.STARS.map(s => ({
      x: (s.x / 100) * W,
      y: (s.y / 100) * H
    }));
  }

  resize();
  window.addEventListener('resize', resize);

  const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  function drawStar (s, idx, pulse) {
    const isFinal = idx === 3;
    const r = isFinal ? 5.4 : 3.6;
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 5.5);
    halo.addColorStop(0, 'rgba(240,242,252,' + (isFinal ? 0.38 : 0.26) + ')');
    halo.addColorStop(0.45, 'rgba(205,210,235,0.10)');
    halo.addColorStop(1, 'rgba(190,198,228,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 5.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(232,234,245,.96)';
    ctx.beginPath(); ctx.arc(s.x, s.y, r * (1 + 0.04 * pulse), 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1, r * 0.32), 0, Math.PI * 2); ctx.fill();
  }

  function drawLine (a, b, progress, bright) {
    const p1 = stars[a], p2 = stars[b];
    if (!p1 || !p2) return;
    const x = p1.x + (p2.x - p1.x) * progress;
    const y = p1.y + (p2.y - p1.y) * progress;

    ctx.strokeStyle = bright ? 'rgba(222,226,246,.65)' : 'rgba(195,200,226,.31)';
    ctx.lineWidth = bright ? 1.15 : 1;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(x, y); ctx.stroke();

    if (bright && progress < 1) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, 'rgba(248,249,255,.95)');
      g.addColorStop(0.35, 'rgba(220,225,248,.4)');
      g.addColorStop(1, 'rgba(200,208,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    }
  }

  function showCaption () {
    if (captionShown || !CONFIG.FINAL_CAPTION) return;
    captionShown = true;
    const cap = document.createElement('div');
    cap.className = 'final-caption';
    cap.textContent = CONFIG.FINAL_CAPTION;
    wrap.appendChild(cap);
    requestAnimationFrame(() => { cap.style.opacity = '1'; });
  }

  function finish () {
    if (finished) return;
    finished = true;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    wrap.style.transition = 'opacity 1.6s ease';
    wrap.style.opacity = '0';
    setTimeout(() => {
      if (wrap.parentNode) wrap.remove();
      if (onComplete) onComplete();
    }, 1650);
  }

  function frame (now) {
    if (finished) return;
    const t = (now - startTime) / 1000;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05050d');
    grad.addColorStop(0.55, '#080812');
    grad.addColorStop(1, '#05050b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const s of bgStars) {
      const a = s.a * (0.62 + 0.38 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = 'rgba(205,211,235,' + a.toFixed(3) + ')';
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }

    // уже пройденные линии
    drawLine(0, 1, 1, false);
    drawLine(1, 2, 1, false);
    drawLine(2, 3, 1, false);

    // замыкание 4→1 после паузы
    if (!lineStart) lineStart = now + 900;
    let closeProgress = 0;
    if (now > lineStart) {
      closeProgress = Math.min(1, (now - lineStart) / 2600);
      drawLine(3, 0, ease(closeProgress), closeProgress < 1);
    }

    const pulse = 0.5 + 0.5 * Math.sin(t * 1.1);
    stars.forEach((s, i) => drawStar(s, i, pulse));

    if (closeProgress >= 1 && !lineDone) {
      lineDone = true;
      setTimeout(showCaption, 1100);
      setTimeout(finish, 5200);
    }

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
}
