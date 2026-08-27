const RED = '#ff3b24';
const VIOLET = '#8f66ff';
const MINT = '#53e2ba';
const STONE = '#d0c2b6';
const INK = '#09050e';

const canvases = [...document.querySelectorAll('[data-motion]')];
const toggle = document.querySelector('[data-motion-toggle]');
const toggleLabel = document.querySelector('[data-motion-toggle-label]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const particleState = new WeakMap();
let paused = reducedMotion.matches;
let pauseStarted = 0;
let pausedDuration = 0;

function hash(value) {
  const result = Math.sin(value * 127.1) * 43758.5453;
  return result - Math.floor(result);
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function rgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function prepareCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
  const targetHeight = Math.max(1, Math.round(bounds.height * pixelRatio));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const context = canvas.getContext('2d');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.fillStyle = INK;
  context.fillRect(0, 0, bounds.width, bounds.height);
  return { context, width: bounds.width, height: bounds.height };
}

function drawDot(context, x, y, radius, color, glow = 0) {
  context.save();
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = glow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawLabel(context, text, x, y, color = STONE, align = 'left') {
  context.save();
  context.fillStyle = color;
  context.font = '10px SFMono-Regular, Consolas, monospace';
  context.textAlign = align;
  context.fillText(text, x, y);
  context.restore();
}

function cubicPoint(points, amount) {
  const inverse = 1 - amount;
  const x =
    inverse ** 3 * points[0][0] +
    3 * inverse ** 2 * amount * points[1][0] +
    3 * inverse * amount ** 2 * points[2][0] +
    amount ** 3 * points[3][0];
  const y =
    inverse ** 3 * points[0][1] +
    3 * inverse ** 2 * amount * points[1][1] +
    3 * inverse * amount ** 2 * points[2][1] +
    amount ** 3 * points[3][1];
  return [x, y];
}

function strokeCurve(context, points, color, width, alpha = 1) {
  context.save();
  context.strokeStyle = rgba(color, alpha);
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  context.bezierCurveTo(
    points[1][0],
    points[1][1],
    points[2][0],
    points[2][1],
    points[3][0],
    points[3][1]
  );
  context.stroke();
  context.restore();
}

function drawTrace(canvas, seconds) {
  const { context, width, height } = prepareCanvas(canvas);
  const start = [width * 0.04, height * 0.52];
  const split = [width * 0.27, height * 0.52];
  const merge = [width * 0.76, height * 0.52];
  const end = [width * 0.96, height * 0.52];
  const paths = [
    [
      split,
      [width * 0.38, height * 0.52],
      [width * 0.42, height * 0.23],
      [width * 0.54, height * 0.23]
    ],
    [
      [width * 0.54, height * 0.23],
      [width * 0.66, height * 0.23],
      [width * 0.64, height * 0.52],
      merge
    ],
    [split, [width * 0.43, height * 0.52], [width * 0.58, height * 0.52], merge],
    [
      split,
      [width * 0.38, height * 0.52],
      [width * 0.42, height * 0.8],
      [width * 0.54, height * 0.8]
    ],
    [
      [width * 0.54, height * 0.8],
      [width * 0.66, height * 0.8],
      [width * 0.64, height * 0.52],
      merge
    ]
  ];

  context.strokeStyle = rgba(STONE, 0.05);
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 42) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  context.strokeStyle = rgba(RED, 0.28);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(...start);
  context.lineTo(...split);
  context.stroke();
  for (const [index, path] of paths.entries()) {
    strokeCurve(context, path, index < 2 ? RED : index === 2 ? VIOLET : RED, 7, 0.08);
    strokeCurve(context, path, index < 2 ? RED : index === 2 ? VIOLET : RED, 1.4, 0.68);
    const progress = (seconds * 0.24 + index * 0.17) % 1;
    const [x, y] = cubicPoint(path, progress);
    drawDot(context, x, y, 3.3, index === 2 ? VIOLET : RED, 15);
  }

  context.strokeStyle = rgba(VIOLET, 0.7);
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(...merge);
  context.lineTo(...end);
  context.stroke();
  const releaseProgress = (seconds * 0.22) % 1;
  drawDot(context, mix(merge[0], end[0], releaseProgress), end[1], 3.5, MINT, 18);

  for (const [x, y, color] of [
    [...start, RED],
    [...split, RED],
    [...merge, VIOLET],
    [...end, MINT]
  ]) {
    drawDot(context, x, y, 4, color, 14);
    context.strokeStyle = rgba(color, 0.36);
    context.beginPath();
    context.arc(x, y, 10, 0, Math.PI * 2);
    context.stroke();
  }

  drawLabel(context, 'START', start[0], start[1] - 18, RED);
  drawLabel(context, 'BRANCH', split[0], split[1] + 25, RED, 'center');
  drawLabel(context, 'MERGE', merge[0], merge[1] + 25, VIOLET, 'center');
  drawLabel(context, 'RELEASE', end[0], end[1] - 18, MINT, 'right');
}

function drawTopology(canvas, seconds) {
  const { context, width, height } = prepareCanvas(canvas);
  const nodes = [
    [0.08, 0.5],
    [0.27, 0.5],
    [0.43, 0.25],
    [0.43, 0.5],
    [0.43, 0.75],
    [0.64, 0.25],
    [0.64, 0.5],
    [0.64, 0.75],
    [0.83, 0.5],
    [0.95, 0.5]
  ].map(([x, y]) => [x * width, y * height]);
  const edges = [
    [0, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [3, 6],
    [4, 7],
    [5, 8],
    [6, 8],
    [7, 8],
    [8, 9]
  ];

  for (let index = 0; index < 52; index += 1) {
    const x = hash(index + 4) * width;
    const y = hash(index + 40) * height;
    const nextX = x + (hash(index + 80) - 0.2) * 80;
    const nextY = y + (hash(index + 120) - 0.5) * 50;
    context.strokeStyle = rgba(VIOLET, 0.075);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(nextX, nextY);
    context.stroke();
    drawDot(context, x, y, 1.2, index % 7 === 0 ? RED : VIOLET);
  }

  for (const [from, to] of edges) {
    context.strokeStyle = rgba(STONE, 0.18);
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(...nodes[from]);
    context.lineTo(...nodes[to]);
    context.stroke();
  }

  const cycle = (seconds * 1.15) % (nodes.length + 2);
  for (const [index, [x, y]] of nodes.entries()) {
    const complete = index < cycle;
    const active = Math.abs(index - cycle) < 0.85;
    const color = complete ? (index === nodes.length - 1 ? MINT : RED) : VIOLET;
    drawDot(context, x, y, active ? 5 : 3, color, active ? 22 : 8);
    context.strokeStyle = rgba(color, complete ? 0.58 : 0.26);
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, y, active ? 10 + ((seconds * 18) % 12) : 8, 0, Math.PI * 2);
    context.stroke();
  }

  drawLabel(context, 'dependency graph', width * 0.08, 24, rgba(STONE, 0.6));
  drawLabel(
    context,
    `${Math.min(nodes.length, Math.floor(cycle))}/10 complete`,
    width * 0.92,
    height - 18,
    MINT,
    'right'
  );
}

function drawRibbons(canvas, seconds) {
  const { context, width, height } = prepareCanvas(canvas);
  const lanes = [
    { color: RED, y: 0.25, bend: 0.43, label: 'BUILD' },
    { color: VIOLET, y: 0.5, bend: 0.62, label: 'TEST' },
    { color: MINT, y: 0.76, bend: 0.53, label: 'BUNDLE' }
  ];

  for (const [index, lane] of lanes.entries()) {
    const points = [
      [width * 0.04, height * lane.y],
      [width * 0.35, height * lane.y],
      [width * 0.56, height * lane.bend],
      [width * 0.96, height * lane.bend]
    ];
    strokeCurve(context, points, lane.color, 22, 0.08);
    strokeCurve(context, points, lane.color, 1.4, 0.74);

    context.save();
    context.strokeStyle = rgba(lane.color, 0.82);
    context.lineWidth = 3;
    context.setLineDash([40, 130]);
    context.lineDashOffset = -seconds * 70 - index * 52;
    context.shadowColor = lane.color;
    context.shadowBlur = 12;
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    context.bezierCurveTo(
      points[1][0],
      points[1][1],
      points[2][0],
      points[2][1],
      points[3][0],
      points[3][1]
    );
    context.stroke();
    context.restore();

    drawLabel(context, lane.label, width * 0.06, height * lane.y - 16, lane.color);
  }

  const handoffX = width * 0.56;
  const pulse = 4 + Math.sin(seconds * 3) * 1.4;
  drawDot(context, handoffX, height * 0.53, pulse, STONE, 18);
  context.strokeStyle = rgba(STONE, 0.18);
  context.setLineDash([2, 5]);
  context.beginPath();
  context.moveTo(handoffX, height * 0.34);
  context.lineTo(handoffX, height * 0.7);
  context.stroke();
  context.setLineDash([]);
  drawLabel(context, 'HANDOFF', handoffX, height * 0.78, RED, 'center');
}

function gridDisplacement(x, y, seconds, width, height) {
  const sources = [
    [width * 0.35, height * 0.38, RED, 0],
    [width * 0.7, height * 0.63, VIOLET, 1.6]
  ];
  let offsetX = 0;
  let offsetY = 0;

  for (const [sourceX, sourceY, , phase] of sources) {
    const deltaX = x - sourceX;
    const deltaY = y - sourceY;
    const distance = Math.hypot(deltaX, deltaY);
    const influence = Math.exp(-distance / Math.max(width, height) / 0.22);
    const wave = Math.sin(distance * 0.055 - seconds * 2.2 + phase) * 9 * influence;
    const scale = distance === 0 ? 0 : wave / distance;
    offsetX += deltaX * scale;
    offsetY += deltaY * scale;
  }
  return [x + offsetX, y + offsetY];
}

function drawGrid(canvas, seconds) {
  const { context, width, height } = prepareCanvas(canvas);
  const spacing = Math.max(24, width / 17);

  context.lineWidth = 1;
  for (let x = -spacing; x <= width + spacing; x += spacing) {
    context.strokeStyle = rgba(VIOLET, 0.13);
    context.beginPath();
    for (let y = -10; y <= height + 10; y += 8) {
      const [nextX, nextY] = gridDisplacement(x, y, seconds, width, height);
      if (y === -10) context.moveTo(nextX, nextY);
      else context.lineTo(nextX, nextY);
    }
    context.stroke();
  }
  for (let y = -spacing; y <= height + spacing; y += spacing) {
    context.strokeStyle = rgba(RED, 0.11);
    context.beginPath();
    for (let x = -10; x <= width + 10; x += 8) {
      const [nextX, nextY] = gridDisplacement(x, y, seconds, width, height);
      if (x === -10) context.moveTo(nextX, nextY);
      else context.lineTo(nextX, nextY);
    }
    context.stroke();
  }

  const events = [
    [width * 0.35, height * 0.38, RED, 'TASK START'],
    [width * 0.7, height * 0.63, VIOLET, 'TASK JOIN'],
    [width * 0.88, height * 0.32, MINT, 'COMPLETE']
  ];
  for (const [index, [x, y, color, label]] of events.entries()) {
    const radius = 13 + ((seconds * 18 + index * 17) % 38);
    context.strokeStyle = rgba(color, Math.max(0, 0.6 - radius / 80));
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
    drawDot(context, x, y, 3.4, color, 15);
    drawLabel(context, label, x + 10, y - 10, color);
  }
}

function createParticles(canvas) {
  const particles = Array.from({ length: 210 }, (_, index) => ({
    seed: hash(index + 300),
    offsetX: hash(index + 600) - 0.5,
    offsetY: hash(index + 900) - 0.5,
    target: index % 7
  }));
  particleState.set(canvas, particles);
  return particles;
}

function drawParticles(canvas, seconds) {
  const { context, width, height } = prepareCanvas(canvas);
  const particles = particleState.get(canvas) ?? createParticles(canvas);
  const graphNodes = [
    [0.48, 0.5],
    [0.61, 0.24],
    [0.61, 0.5],
    [0.61, 0.76],
    [0.76, 0.34],
    [0.76, 0.66],
    [0.9, 0.5]
  ];
  const graphEdges = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [2, 4],
    [2, 5],
    [3, 5],
    [4, 6],
    [5, 6]
  ];

  context.strokeStyle = rgba(RED, 0.2);
  context.lineWidth = 1;
  for (const [from, to] of graphEdges) {
    context.beginPath();
    context.moveTo(graphNodes[from][0] * width, graphNodes[from][1] * height);
    context.lineTo(graphNodes[to][0] * width, graphNodes[to][1] * height);
    context.stroke();
  }

  const cycle = (seconds * 0.2) % 1;
  const assemble = smoothstep(Math.min(1, cycle * 2.2));
  const release = smoothstep((cycle - 0.68) / 0.25);
  const sourceX = width * 0.08;
  const sourceY = height * 0.52;

  for (const [index, particle] of particles.entries()) {
    const [targetX, targetY] = graphNodes[particle.target];
    const sourceSpread = (1 - assemble) * 80;
    const sourceParticleX = sourceX + particle.offsetX * sourceSpread + particle.seed * 60;
    const sourceParticleY = sourceY + particle.offsetY * sourceSpread;
    const graphX = targetX * width + particle.offsetX * 34;
    const graphY = targetY * height + particle.offsetY * 25;
    const waveY = height * 0.5 + Math.sin(index * 0.38 + seconds * 4) * (12 + particle.seed * 30);
    const outputX = width * (0.92 + particle.seed * 0.12);
    const x = mix(mix(sourceParticleX, graphX, assemble), outputX, release);
    const y = mix(mix(sourceParticleY, graphY, assemble), waveY, release);
    const color = release > 0.45 ? MINT : particle.target % 2 === 0 ? RED : VIOLET;
    drawDot(context, x, y, 0.8 + particle.seed * 1.25, color, particle.seed > 0.92 ? 9 : 0);
  }

  drawLabel(context, '$ npm run release', width * 0.04, height * 0.18, RED);
  drawLabel(context, 'TASK GRAPH', width * 0.61, height * 0.1, VIOLET, 'center');
  drawLabel(context, 'SUCCESS', width * 0.96, height * 0.82, MINT, 'right');
  drawDot(context, sourceX, sourceY, 4, RED, 16);
  drawDot(context, width * 0.9, height * 0.5, 4, MINT, 16);
}

const renderers = {
  trace: drawTrace,
  topology: drawTopology,
  ribbons: drawRibbons,
  grid: drawGrid,
  particles: drawParticles
};

function updateToggle() {
  if (!toggle || !toggleLabel) return;
  toggle.setAttribute('aria-pressed', String(paused));
  toggleLabel.textContent = paused ? 'Play motion' : 'Pause motion';
}

function drawFrame(timestamp) {
  const seconds = (timestamp - pausedDuration) / 1000;
  for (const canvas of canvases) {
    const renderer = renderers[canvas.dataset.motion];
    renderer?.(canvas, seconds);
  }
}

function animate(timestamp) {
  if (!paused && document.visibilityState === 'visible') drawFrame(timestamp);
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

reducedMotion.addEventListener('change', (event) => {
  paused = event.matches;
  if (paused) drawFrame(performance.now());
  updateToggle();
});

window.addEventListener('resize', () => drawFrame(performance.now()));
updateToggle();
drawFrame(performance.now());
window.requestAnimationFrame(animate);
