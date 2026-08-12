const pageTraceHero = document.querySelector('.examples-hero, .api-hero');
const pageTraceReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pageTraceCompact = window.matchMedia('(max-width: 760px), (pointer: coarse)');

if (pageTraceHero instanceof HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'page-trace-canvas';
  canvas.dataset.pageTrace = '';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const context = canvas.getContext('2d', { alpha: true });
  const rails = [
    { color: '#ff321f', branchY: 0.24, offset: 0 },
    { color: '#ff2f87', branchY: 0.5, offset: 0.31 },
    { color: '#8d5bff', branchY: 0.76, offset: 0.62 }
  ];
  let width = 0;
  let height = 0;
  let lastFrame = 0;
  let animationFrame = null;
  let resizeFrame = null;

  function rgba(hex, alpha) {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  function cubicPoint(start, controlOne, controlTwo, end, progress) {
    const inverse = 1 - progress;
    return {
      x:
        inverse ** 3 * start.x +
        3 * inverse ** 2 * progress * controlOne.x +
        3 * inverse * progress ** 2 * controlTwo.x +
        progress ** 3 * end.x,
      y:
        inverse ** 3 * start.y +
        3 * inverse ** 2 * progress * controlOne.y +
        3 * inverse * progress ** 2 * controlTwo.y +
        progress ** 3 * end.y
    };
  }

  function railPoint(rail, progress, seconds) {
    const wave = Math.sin(seconds * 0.42 + progress * Math.PI * 2.4 + rail.offset * 5) * 4;
    const start = { x: width * 0.38, y: height * 0.62 };
    const branch = { x: width * 0.68, y: height * rail.branchY };
    const merge = { x: width * 0.98, y: height * 0.54 };
    let point;

    if (progress <= 0.52) {
      const localProgress = progress / 0.52;
      point = cubicPoint(
        start,
        { x: width * 0.48, y: start.y },
        { x: width * 0.57, y: branch.y },
        branch,
        localProgress
      );
    } else {
      const localProgress = (progress - 0.52) / 0.48;
      point = cubicPoint(
        branch,
        { x: width * 0.79, y: branch.y },
        { x: width * 0.87, y: merge.y },
        merge,
        localProgress
      );
    }

    return { x: point.x, y: point.y + wave };
  }

  function strokeRail(rail, seconds, lineWidth, alpha, blur) {
    context.save();
    context.strokeStyle = rgba(rail.color, alpha);
    context.lineWidth = lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = rail.color;
    context.shadowBlur = blur;
    context.beginPath();
    for (let sample = 0; sample <= 72; sample += 1) {
      const point = railPoint(rail, sample / 72, seconds);
      if (sample === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
    context.restore();
  }

  function drawPulse(rail, seconds) {
    const head = (seconds * 0.075 + rail.offset) % 1;
    context.save();
    context.globalCompositeOperation = 'lighter';

    for (let segment = -11; segment < 11; segment += 1) {
      const startProgress = head + segment * 0.008;
      const endProgress = startProgress + 0.009;
      if (startProgress < 0 || endProgress > 1) continue;
      const strength = Math.cos((Math.abs(segment + 0.5) / 11) * (Math.PI / 2)) ** 2;
      const start = railPoint(rail, startProgress, seconds);
      const end = railPoint(rail, endProgress, seconds);

      context.strokeStyle = rgba(rail.color, 0.18 + strength * 0.7);
      context.lineWidth = 2 + strength * 10;
      context.lineCap = 'round';
      context.shadowColor = rail.color;
      context.shadowBlur = 8 + strength * 18;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }

    const point = railPoint(rail, head, seconds);
    context.fillStyle = '#fff2e7';
    context.shadowColor = rail.color;
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawJunctions(seconds) {
    const start = railPoint(rails[1], 0, seconds);
    const merge = railPoint(rails[1], 1, seconds);
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const [point, color] of [
      [start, '#ff321f'],
      [merge, '#8d5bff']
    ]) {
      context.fillStyle = '#fff2e7';
      context.strokeStyle = rgba(color, 0.62);
      context.lineWidth = 1.2;
      context.shadowColor = color;
      context.shadowBlur = 20;
      context.beginPath();
      context.arc(point.x, point.y, 8, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function resizePageTrace(force = false) {
    const nextWidth = Math.max(1, Math.round(window.innerWidth));
    const nextHeight = Math.max(1, Math.round(window.innerHeight));
    if (!force && nextWidth === width && nextHeight === height) return false;

    const ratio = pageTraceCompact.matches
      ? Math.min(window.devicePixelRatio || 1, 1)
      : Math.min(window.devicePixelRatio || 1, 1.35);
    width = nextWidth;
    height = nextHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    return true;
  }

  function drawPageTrace(milliseconds = 0) {
    if (!context) return;
    const seconds = milliseconds / 1000;
    context.clearRect(0, 0, width, height);
    for (const rail of rails) {
      strokeRail(rail, seconds, 20, 0.025, 22);
      strokeRail(rail, seconds, 5, 0.08, 12);
      strokeRail(rail, seconds, 1.4, 0.5, 6);
      drawPulse(rail, seconds);
    }
    drawJunctions(seconds);
  }

  function animatePageTrace(milliseconds) {
    animationFrame = null;
    if (!shouldAnimatePageTrace()) return;
    if (milliseconds - lastFrame >= 1000 / 24) {
      lastFrame = milliseconds;
      drawPageTrace(milliseconds);
    }
    animationFrame = window.requestAnimationFrame(animatePageTrace);
  }

  function refreshPageTrace() {
    if (resizePageTrace()) drawPageTrace(window.performance.now());
  }

  function shouldAnimatePageTrace() {
    return (
      !pageTraceReducedMotion.matches &&
      !pageTraceCompact.matches &&
      document.visibilityState === 'visible'
    );
  }

  function updatePageTraceAnimation() {
    if (shouldAnimatePageTrace()) {
      if (animationFrame === null) {
        lastFrame = window.performance.now();
        animationFrame = window.requestAnimationFrame(animatePageTrace);
      }
      return;
    }

    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  resizePageTrace();
  drawPageTrace(window.performance.now());
  updatePageTraceAnimation();

  window.addEventListener(
    'resize',
    () => {
      if (pageTraceCompact.matches || resizeFrame !== null) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        refreshPageTrace();
      });
    },
    { passive: true }
  );
  window.addEventListener(
    'orientationchange',
    () => {
      window.setTimeout(() => {
        resizePageTrace(true);
        drawPageTrace(window.performance.now());
      }, 120);
    },
    { passive: true }
  );

  document.addEventListener('visibilitychange', updatePageTraceAnimation);
  pageTraceReducedMotion.addEventListener('change', updatePageTraceAnimation);
  pageTraceCompact.addEventListener('change', () => {
    resizePageTrace(true);
    drawPageTrace(window.performance.now());
    updatePageTraceAnimation();
  });
}
