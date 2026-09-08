const instances = new WeakMap();

const reducedMotion = (typeof window !== 'undefined' && 'matchMedia' in window)
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

const observer = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const canvas = entry.target;
        const inst = instances.get(canvas);
        if (!inst) return;
        if (entry.isIntersecting) {
          inst.start();
        } else {
          inst.stop();
        }
      });
    }, { threshold: 0.01 })
  : null;

export function createParticleCanvas(container, options = {}) {
  const {
    count = 60,
    baseSpeed = 0.3,
    dotMin = 0.5,
    dotMax = 2,
    alphaMin = 0.1,
    alphaMax = 0.5,
    glowIntensity = 0.08,
    scanLine = true,
    zIndex = 0
  } = options;

  const canvas = document.createElement('canvas');
  canvas.className = 'particle-canvas';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = String(zIndex);
  canvas.style.pointerEvents = 'none';
  container.style.position = container.style.position || 'relative';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const particles = [];
  let W = 0, H = 0;
  let running = false;
  let rafId = null;
  let isReduced = reducedMotion ? reducedMotion.matches : false;

  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    particles.length = 0;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * baseSpeed,
        vy: -Math.random() * (baseSpeed * 1.3) - baseSpeed * 0.3,
        size: Math.random() * (dotMax - dotMin) + dotMin,
        alpha: Math.random() * (alphaMax - alphaMin) + alphaMin,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  function drawOnce() {
    ctx.clearRect(0, 0, W, H);

    if (W > 0 && H > 0 && glowIntensity > 0) {
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      bg.addColorStop(0, `rgba(15,30,80,${glowIntensity})`);
      bg.addColorStop(1, 'rgba(3,6,20,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(74,157,168,${p.alpha})`;
      ctx.fill();
    }
  }

  function draw() {
    if (!running) return;
    rafId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);

    if (W > 0 && H > 0 && glowIntensity > 0) {
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      bg.addColorStop(0, `rgba(15,30,80,${glowIntensity})`);
      bg.addColorStop(1, 'rgba(3,6,20,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    const t = Date.now() * 0.001;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += 0.02;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;

      const a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(74,157,168,${a})`;
      ctx.fill();
    }

    if (scanLine && H > 0) {
      const scanY = ((t * 60) % (H + 100)) - 50;
      const scan = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      scan.addColorStop(0, 'rgba(74,157,168,0)');
      scan.addColorStop(0.5, 'rgba(74,157,168,0.025)');
      scan.addColorStop(1, 'rgba(74,157,168,0)');
      ctx.fillStyle = scan;
      ctx.fillRect(0, scanY - 30, W, 60);
    }
  }

  const inst = {
    start() {
      if (isReduced) {
        if (!running) {
          running = true;
          drawOnce();
        }
        return;
      }
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(draw);
    },
    stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    },
    destroy() {
      this.stop();
      if (observer) observer.unobserve(canvas);
      instances.delete(canvas);
      window.removeEventListener('resize', onResize);
      if (reducedMotion && reducedMotion.removeEventListener) {
        reducedMotion.removeEventListener('change', onReducedChange);
      }
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };

  function onResize() { resize(); seed(); if (isReduced) drawOnce(); }
  window.addEventListener('resize', onResize);

  function onReducedChange(e) {
    const wasReduced = isReduced;
    isReduced = e.matches;
    if (isReduced) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (running) drawOnce();
    } else if (!wasReduced && running && !rafId) {
      rafId = requestAnimationFrame(draw);
    }
  }
  if (reducedMotion && reducedMotion.addEventListener) {
    reducedMotion.addEventListener('change', onReducedChange);
  }

  resize();
  seed();
  instances.set(canvas, inst);

  if (observer) {
    observer.observe(canvas);
  } else {
    inst.start();
  }

  if (isReduced) {
    running = true;
    drawOnce();
  }

  return inst;
}

export default createParticleCanvas;
