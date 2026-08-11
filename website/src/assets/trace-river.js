const canvas = document.querySelector('[data-trace-river]');
const toggle = document.querySelector('[data-trace-toggle]');
const toggleLabel = document.querySelector('[data-trace-toggle-label]');
const elapsed = document.querySelector('[data-trace-elapsed]');
const timing = document.querySelector('[data-trace-timing]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const COLORS = {
  red: '#ff321f',
  coral: '#ff6849',
  pink: '#ff2f87',
  violet: '#8d5bff',
  cyan: '#29d9ff',
  mint: '#52f1bc',
  white: '#fff2e7'
};

const beamTemplates = [
  {
    color: COLORS.red,
    speed: 0.075,
    offset: 0,
    points: [
      [-0.08, 0.83],
      [0.14, 0.8],
      [0.32, 0.62],
      [0.48, 0.22],
      [0.72, 0.4],
      [1.08, 0.18]
    ]
  },
  {
    color: COLORS.pink,
    speed: 0.092,
    offset: 0.28,
    points: [
      [-0.08, 0.87],
      [0.15, 0.81],
      [0.32, 0.62],
      [0.5, 0.45],
      [0.72, 0.4],
      [1.08, 0.37]
    ]
  },
  {
    color: COLORS.violet,
    speed: 0.068,
    offset: 0.5,
    points: [
      [-0.08, 0.92],
      [0.16, 0.84],
      [0.32, 0.62],
      [0.52, 0.77],
      [0.72, 0.4],
      [1.08, 0.58]
    ]
  },
  {
    color: COLORS.cyan,
    speed: 0.083,
    offset: 0.72,
    points: [
      [1.08, 0.05],
      [0.9, 0.13],
      [0.72, 0.4],
      [0.82, 0.63],
      [1.08, 0.76]
    ]
  },
  {
    color: COLORS.mint,
    speed: 0.062,
    offset: 0.18,
    points: [
      [1.08, 0.88],
      [0.92, 0.78],
      [0.72, 0.4],
      [0.83, 0.28],
      [1.08, 0.26]
    ]
  },
  {
    color: COLORS.coral,
    speed: 0.086,
    offset: 0.84,
    points: [
      [-0.08, 0.24],
      [0.18, 0.31],
      [0.32, 0.62],
      [0.48, 0.22],
      [0.72, 0.4],
      [1.08, 0.18]
    ]
  }
];

const junctions = [
  { x: 0.32, y: 0.62, color: COLORS.red, label: 'BRANCH' },
  { x: 0.48, y: 0.22, color: COLORS.pink, label: 'PARALLEL' },
  { x: 0.72, y: 0.4, color: COLORS.violet, label: 'MERGE' },
  { x: 0.9, y: 0.26, color: COLORS.mint, label: 'COMPLETE' }
];

let paused = reducedMotion.matches;
let pauseStarted = 0;
let pausedDuration = 0;
let pointerTargetX = 0;
let pointerTargetY = 0;
let pointerX = 0;
let pointerY = 0;
let cachedWidth = 0;
let cachedHeight = 0;
let cachedBeams = [];

function hexToRgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function catmullRomPoint(points, amount) {
  const segmentCount = points.length - 1;
  const scaled = Math.max(0, Math.min(0.999999, amount)) * segmentCount;
  const index = Math.floor(scaled);
  const local = scaled - index;
  const first = points[Math.max(0, index - 1)];
  const second = points[index];
  const third = points[Math.min(points.length - 1, index + 1)];
  const fourth = points[Math.min(points.length - 1, index + 2)];
  const localSquared = local * local;
  const localCubed = localSquared * local;

  return [0, 1].map(
    (axis) =>
      0.5 *
      (2 * second[axis] +
        (-first[axis] + third[axis]) * local +
        (2 * first[axis] - 5 * second[axis] + 4 * third[axis] - fourth[axis]) * localSquared +
        (-first[axis] + 3 * second[axis] - 3 * third[axis] + fourth[axis]) * localCubed)
  );
}

function sampleBeam(template, width, height) {
  const scaledPoints = template.points.map(([x, y]) => [x * width, y * height]);
  return Array.from({ length: 181 }, (_, index) => catmullRomPoint(scaledPoints, index / 180));
}

function resizeCanvas() {
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(width * pixelRatio);
  const targetHeight = Math.round(height * pixelRatio);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    cachedWidth = width;
    cachedHeight = height;
    cachedBeams = beamTemplates.map((beam) => sampleBeam(beam, width, height));
  }

  const context = canvas.getContext('2d');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function strokePoints(context, points, color, width, alpha, blur = 0) {
  context.save();
  context.strokeStyle = hexToRgba(color, alpha);
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = color;
  context.shadowBlur = blur;
  context.beginPath();
  context.moveTo(points[0][0] + pointerX, points[0][1] + pointerY);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0] + pointerX, points[index][1] + pointerY);
  }
  context.stroke();
  context.restore();
}

function drawBackgroundParticles(context, width, height, seconds) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 80; index += 1) {
    const seedX = (Math.sin(index * 82.17) * 0.5 + 0.5) * width;
    const seedY = (Math.sin(index * 19.41 + 2) * 0.5 + 0.5) * height;
    const drift = Math.sin(seconds * 0.25 + index) * 5;
    const alpha = 0.05 + ((index * 17) % 10) / 180;
    context.fillStyle =
      index % 5 === 0 ? hexToRgba(COLORS.red, alpha) : hexToRgba(COLORS.violet, alpha);
    context.beginPath();
    context.arc(seedX + drift, seedY - drift * 0.5, index % 9 === 0 ? 1.4 : 0.7, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBeam(context, points, beam, seconds, index) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  strokePoints(context, points, beam.color, 46, 0.018, 28);
  strokePoints(context, points, beam.color, 24, 0.035, 24);
  strokePoints(context, points, beam.color, 10, 0.075, 18);
  strokePoints(context, points, beam.color, 2.2, 0.58, 10);
  strokePoints(context, points, COLORS.white, 0.65, 0.66, 4);

  const progress = (seconds * beam.speed + beam.offset) % 1;
  const headIndex = Math.floor(progress * (points.length - 1));
  const trail = [];
  for (let offset = 24; offset >= 0; offset -= 1) {
    const pointIndex = headIndex - offset;
    if (pointIndex >= 0) trail.push(points[pointIndex]);
  }
  strokePoints(context, trail, beam.color, 13, 0.18, 28);
  strokePoints(context, trail, beam.color, 4.5, 0.78, 22);
  strokePoints(context, trail, COLORS.white, 1.4, 0.96, 12);

  const [headX, headY] = points[headIndex];
  const flare = context.createRadialGradient(
    headX + pointerX,
    headY + pointerY,
    0,
    headX + pointerX,
    headY + pointerY,
    26
  );
  flare.addColorStop(0, hexToRgba(COLORS.white, 0.96));
  flare.addColorStop(0.12, hexToRgba(beam.color, 0.85));
  flare.addColorStop(1, hexToRgba(beam.color, 0));
  context.fillStyle = flare;
  context.beginPath();
  context.arc(headX + pointerX, headY + pointerY, 26, 0, Math.PI * 2);
  context.fill();

  if (index < 3) {
    for (let spark = 0; spark < 6; spark += 1) {
      const [sparkX, sparkY] = points[Math.max(0, headIndex - spark * 4)];
      context.fillStyle = hexToRgba(beam.color, 0.42 - spark * 0.05);
      context.fillRect(
        sparkX + pointerX - spark * 2,
        sparkY + pointerY + Math.sin(spark + seconds) * 3,
        1.3,
        1.3
      );
    }
  }
  context.restore();
}

function drawJunction(context, junction, width, height, seconds, index) {
  const x = junction.x * width + pointerX;
  const y = junction.y * height + pointerY;
  const pulse = (seconds * 18 + index * 13) % 28;

  context.save();
  context.globalCompositeOperation = 'lighter';
  const bloom = context.createRadialGradient(x, y, 0, x, y, 54);
  bloom.addColorStop(0, hexToRgba(COLORS.white, 0.9));
  bloom.addColorStop(0.08, hexToRgba(junction.color, 0.82));
  bloom.addColorStop(0.42, hexToRgba(junction.color, 0.13));
  bloom.addColorStop(1, hexToRgba(junction.color, 0));
  context.fillStyle = bloom;
  context.beginPath();
  context.arc(x, y, 54, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = hexToRgba(junction.color, Math.max(0, 0.48 - pulse / 70));
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, 10 + pulse, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = COLORS.white;
  context.shadowColor = junction.color;
  context.shadowBlur = 22;
  context.beginPath();
  context.arc(x, y, 3.2, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.fillStyle = hexToRgba(COLORS.white, 0.46);
  context.font = '8px SFMono-Regular, Consolas, monospace';
  context.fillText(junction.label, x + 13, y - 13);
  context.restore();
}

function updateTelemetry(seconds) {
  if (elapsed) {
    const milliseconds = Math.floor((seconds * 1000) % 1000)
      .toString()
      .padStart(3, '0');
    const wholeSeconds = Math.floor(seconds % 10)
      .toString()
      .padStart(2, '0');
    elapsed.textContent = `00:${wholeSeconds}.${milliseconds}`;
  }
  if (timing) timing.textContent = `${(2.2 + (seconds % 1.8)).toFixed(2)}s`;
}

function draw(timestamp) {
  const prepared = resizeCanvas();
  if (!prepared || cachedWidth === 0 || cachedHeight === 0) return;
  const { context, width, height } = prepared;
  const seconds = (timestamp - pausedDuration) / 1000;
  pointerX += (pointerTargetX - pointerX) * 0.035;
  pointerY += (pointerTargetY - pointerY) * 0.035;

  drawBackgroundParticles(context, width, height, seconds);
  for (const [index, beam] of beamTemplates.entries()) {
    drawBeam(context, cachedBeams[index], beam, seconds, index);
  }
  for (const [index, junction] of junctions.entries()) {
    drawJunction(context, junction, width, height, seconds, index);
  }
  updateTelemetry(seconds);
}

function updateToggle() {
  if (!toggle || !toggleLabel) return;
  toggle.setAttribute('aria-pressed', String(paused));
  toggleLabel.textContent = paused ? 'Play motion' : 'Pause motion';
}

function animate(timestamp) {
  if (!paused && document.visibilityState === 'visible') draw(timestamp);
  window.requestAnimationFrame(animate);
}

toggle?.addEventListener('click', () => {
  paused = !paused;
  if (paused) {
    pauseStarted = performance.now();
  } else if (pauseStarted > 0) {
    pausedDuration += performance.now() - pauseStarted;
  }
  updateToggle();
});

window.addEventListener('pointermove', (event) => {
  pointerTargetX = (event.clientX / window.innerWidth - 0.5) * 12;
  pointerTargetY = (event.clientY / window.innerHeight - 0.5) * 8;
});

window.addEventListener('resize', () => {
  cachedWidth = 0;
  cachedHeight = 0;
  draw(performance.now());
});

reducedMotion.addEventListener('change', (event) => {
  paused = event.matches;
  draw(performance.now());
  updateToggle();
});

updateToggle();
draw(performance.now());
window.requestAnimationFrame(animate);
