const canvas = document.querySelector('[data-trace-river]');
const toggle = document.querySelector('[data-trace-toggle]');
const toggleLabel = document.querySelector('[data-trace-toggle-label]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactViewport = window.matchMedia('(max-width: 700px)');
const stackedMarkerViewport = window.matchMedia('(max-width: 760px)');
const staticLayer = document.createElement('canvas');
const traceStage = document.querySelector('.trace-cinematic-stage');
const taskMarkers = [...document.querySelectorAll('.trace-task-callout')];

const devicePixelRatio = window.devicePixelRatio || 1;
const STATIC_LAYER_SCALE = compactViewport.matches
  ? Math.min(Math.max(devicePixelRatio * 0.8, 0.85), 1.1)
  : Math.min(Math.max(devicePixelRatio, 1), 1.35);
const TARGET_FRAME_MS = 1000 / (compactViewport.matches ? 30 : 45);
const SAMPLE_COUNT = compactViewport.matches ? 105 : 160;

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
  { x: 0.05, y: 0.83, color: COLORS.red },
  { x: 0.32, y: 0.62, color: COLORS.red, label: 'BRANCH' },
  { x: 0.48, y: 0.22, color: COLORS.pink, label: 'PARALLEL' },
  { x: 0.72, y: 0.4, color: COLORS.violet, label: 'MERGE' },
  { x: 0.96, y: 0.58, color: COLORS.violet, label: 'COMPLETE' }
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
let lastFrame = 0;
let lastMarkerSeconds = 0;
let lastSceneOffsetX = 0;
let lastSceneOffsetY = 0;

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
  const squared = local * local;
  const cubed = squared * local;

  return [0, 1].map(
    (axis) =>
      0.5 *
      (2 * second[axis] +
        (-first[axis] + third[axis]) * local +
        (2 * first[axis] - 5 * second[axis] + 4 * third[axis] - fourth[axis]) * squared +
        (-first[axis] + 3 * second[axis] - 3 * third[axis] + fourth[axis]) * cubed)
  );
}

function sampleBeam(template, width, height) {
  const scaledPoints = template.points.map(([x, y]) => [x * width, y * height]);
  return Array.from({ length: SAMPLE_COUNT + 1 }, (_, index) =>
    catmullRomPoint(scaledPoints, index / SAMPLE_COUNT)
  );
}

function configureContext(layer, width, height) {
  layer.width = Math.max(1, Math.round(width * STATIC_LAYER_SCALE));
  layer.height = Math.max(1, Math.round(height * STATIC_LAYER_SCALE));
  const context = layer.getContext('2d', { alpha: true });
  context.setTransform(STATIC_LAYER_SCALE, 0, 0, STATIC_LAYER_SCALE, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return context;
}

function riverWaveOffset(x, width, seconds) {
  const position = x / Math.max(1, width);
  return (
    Math.sin(seconds * 0.29 + position * Math.PI * 3.2) * 4.2 +
    Math.sin(seconds * 0.13 - position * Math.PI * 1.8) * 2
  );
}

function strokePoints(context, points, color, width, alpha, blur = 0, offsetX = 0, offsetY = 0) {
  if (points.length < 2) return;
  context.save();
  context.strokeStyle = hexToRgba(color, alpha);
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = color;
  context.shadowBlur = blur;
  context.beginPath();
  context.moveTo(points[0][0] + offsetX, points[0][1] + offsetY);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0] + offsetX, points[index][1] + offsetY);
  }
  context.stroke();
  context.restore();
}

function drawStaticParticles(context, width, height) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 96; index += 1) {
    const x = (Math.sin(index * 82.17) * 0.5 + 0.5) * width;
    const y = (Math.sin(index * 19.41 + 2) * 0.5 + 0.5) * height;
    const alpha = 0.05 + ((index * 17) % 10) / 180;
    context.fillStyle =
      index % 5 === 0 ? hexToRgba(COLORS.red, alpha) : hexToRgba(COLORS.violet, alpha);
    context.beginPath();
    context.arc(x, y, index % 9 === 0 ? 1.4 : 0.7, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawStaticJunction(context, junction, width, height) {
  const x = junction.x * width;
  const y = junction.y * height;
  const bloom = context.createRadialGradient(x, y, 0, x, y, 54);
  bloom.addColorStop(0, hexToRgba(COLORS.white, 0.82));
  bloom.addColorStop(0.08, hexToRgba(junction.color, 0.72));
  bloom.addColorStop(0.42, hexToRgba(junction.color, 0.12));
  bloom.addColorStop(1, hexToRgba(junction.color, 0));
  context.fillStyle = bloom;
  context.beginPath();
  context.arc(x, y, 54, 0, Math.PI * 2);
  context.fill();
}

function rebuildStaticLayer(width, height) {
  const context = configureContext(staticLayer, width, height);
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = 'lighter';
  drawStaticParticles(context, width, height);

  for (const [index, beam] of beamTemplates.entries()) {
    const points = cachedBeams[index];
    for (let rail = -4; rail <= 4; rail += 1) {
      if (rail === 0) continue;
      strokePoints(context, points, beam.color, 0.6, 0.09, 3, 0, rail * 4.5);
    }
    strokePoints(context, points, beam.color, 42, 0.02, 22);
    strokePoints(context, points, beam.color, 19, 0.04, 18);
    strokePoints(context, points, beam.color, 7, 0.08, 12);
    strokePoints(context, points, beam.color, 2, 0.56, 7);
    strokePoints(context, points, COLORS.white, 0.55, 0.62, 2);
  }
  for (const junction of junctions) drawStaticJunction(context, junction, width, height);
}

function drawWavedStaticLayer(context, width, height, offsetX, offsetY, seconds) {
  const sliceWidth = compactViewport.matches ? 36 : 24;
  for (let x = 0; x < width; x += sliceWidth) {
    const logicalWidth = Math.min(sliceWidth, width - x);
    const sourceX = Math.floor(x * STATIC_LAYER_SCALE);
    const sourceWidth = Math.ceil(logicalWidth * STATIC_LAYER_SCALE);
    const waveY = riverWaveOffset(x + logicalWidth / 2, width, seconds);
    context.drawImage(
      staticLayer,
      sourceX,
      0,
      sourceWidth,
      staticLayer.height,
      x + offsetX - 1,
      offsetY + waveY,
      logicalWidth + 2,
      height
    );
  }
}

function prepareCanvas(offsetX, offsetY, seconds) {
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (cachedWidth !== width || cachedHeight !== height) {
    cachedWidth = width;
    cachedHeight = height;
    cachedBeams = beamTemplates.map((beam) => sampleBeam(beam, width, height));
    configureContext(canvas, width, height);
    rebuildStaticLayer(width, height);
  }

  const context = canvas.getContext('2d', { alpha: true });
  context.setTransform(STATIC_LAYER_SCALE, 0, 0, STATIC_LAYER_SCALE, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, width, height);
  drawWavedStaticLayer(context, width, height, offsetX, offsetY, seconds);
  return { context, width, height };
}

function drawMovingBeam(context, points, beam, seconds, index, offsetX, offsetY, width) {
  const progress = (seconds * beam.speed + beam.offset) % 1;
  const headIndex = Math.floor(progress * (points.length - 1));
  const trail = [];
  for (let offset = 18; offset >= 0; offset -= 1) {
    const pointIndex = headIndex - offset;
    if (pointIndex >= 0) {
      const [trailX, trailY] = points[pointIndex];
      trail.push([trailX + offsetX, trailY + offsetY + riverWaveOffset(trailX, width, seconds)]);
    }
  }

  context.save();
  context.globalCompositeOperation = 'lighter';
  strokePoints(context, trail, beam.color, 11, 0.18, 18);
  strokePoints(context, trail, beam.color, 3.8, 0.8, 15);
  strokePoints(context, trail, COLORS.white, 1.15, 0.96, 7);

  const [headX, headY] = points[headIndex];
  const x = headX + offsetX;
  const y = headY + offsetY + riverWaveOffset(headX, width, seconds);
  const flare = context.createRadialGradient(x, y, 0, x, y, 23);
  flare.addColorStop(0, hexToRgba(COLORS.white, 0.96));
  flare.addColorStop(0.12, hexToRgba(beam.color, 0.85));
  flare.addColorStop(1, hexToRgba(beam.color, 0));
  context.fillStyle = flare;
  context.beginPath();
  context.arc(x, y, 23, 0, Math.PI * 2);
  context.fill();

  for (let packet = 1; packet <= 4; packet += 1) {
    const packetProgress = (progress + packet * 0.19 + index * 0.025) % 1;
    const packetIndex = Math.floor(packetProgress * (points.length - 1));
    const nextIndex = Math.min(points.length - 1, packetIndex + 1);
    const [packetX, packetY] = points[packetIndex];
    const [nextX, nextY] = points[nextIndex];
    const packetWaveY = riverWaveOffset(packetX, width, seconds);
    const nextWaveY = riverWaveOffset(nextX, width, seconds);
    context.save();
    context.translate(packetX + offsetX, packetY + offsetY + packetWaveY);
    context.rotate(Math.atan2(nextY + nextWaveY - packetY - packetWaveY, nextX - packetX));
    context.fillStyle = hexToRgba(beam.color, 0.72);
    context.shadowColor = beam.color;
    context.shadowBlur = 10;
    context.fillRect(-4.5, -2.2, 9, 4.4);
    context.restore();
  }

  if (index < 3) {
    for (let spark = 0; spark < 4; spark += 1) {
      const [sparkX, sparkY] = points[Math.max(0, headIndex - spark * 3)];
      context.fillStyle = hexToRgba(beam.color, 0.38 - spark * 0.07);
      context.fillRect(
        sparkX + offsetX - spark * 2,
        sparkY + offsetY + riverWaveOffset(sparkX, width, seconds) + Math.sin(spark + seconds) * 2,
        1.2,
        1.2
      );
    }
  }
  context.restore();
}

function drawJunctionPulse(context, junction, width, height, seconds, index, offsetX, offsetY) {
  const x = junction.x * width + offsetX;
  const y = junction.y * height + offsetY + riverWaveOffset(junction.x * width, width, seconds);
  const pulse = (seconds * 17 + index * 13) % 27;
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = hexToRgba(junction.color, Math.max(0, 0.44 - pulse / 70));
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, 10 + pulse, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = COLORS.white;
  context.shadowColor = junction.color;
  context.shadowBlur = 15;
  context.beginPath();
  context.arc(x, y, 2.8, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function clearTaskMarkerPositions() {
  for (const marker of taskMarkers) {
    marker.classList.remove('is-river-anchored');
    marker.style.removeProperty('--trace-marker-x');
    marker.style.removeProperty('--trace-marker-y');
  }
}

function positionTaskMarkers(width, height, seconds, offsetX, offsetY) {
  if (!(traceStage instanceof HTMLElement) || stackedMarkerViewport.matches) {
    clearTaskMarkerPositions();
    return;
  }

  const stageRect = traceStage.getBoundingClientRect();
  for (const marker of taskMarkers) {
    let anchor;
    const junctionIndex = Number.parseInt(marker.dataset.traceJunctionMarker ?? '', 10);
    const beamIndex = Number.parseInt(marker.dataset.traceBeamMarker ?? '', 10);

    if (Number.isInteger(junctionIndex) && junctions[junctionIndex]) {
      const junction = junctions[junctionIndex];
      anchor = [junction.x * width, junction.y * height];
    } else if (Number.isInteger(beamIndex) && cachedBeams[beamIndex]) {
      const progress = Math.max(0, Math.min(1, Number(marker.dataset.traceProgress) || 0));
      const points = cachedBeams[beamIndex];
      anchor = points[Math.round(progress * (points.length - 1))];
    }

    if (!anchor) continue;
    const [anchorX, anchorY] = anchor;
    const markerOffsetY = Number(marker.dataset.traceOffsetY) || 0;
    marker.style.setProperty('--trace-marker-x', `${anchorX + offsetX - stageRect.left}px`);
    marker.style.setProperty(
      '--trace-marker-y',
      `${
        anchorY + offsetY + riverWaveOffset(anchorX, width, seconds) + markerOffsetY - stageRect.top
      }px`
    );
    marker.classList.add('is-river-anchored');
  }
}

function draw(timestamp) {
  const seconds = (timestamp - pausedDuration) / 1000;
  pointerX += (pointerTargetX - pointerX) * 0.06;
  pointerY += (pointerTargetY - pointerY) * 0.06;
  const riverDriftX = Math.sin(seconds * 0.085) * 18 + Math.sin(seconds * 0.031) * 7;
  const riverDriftY = Math.cos(seconds * 0.05) * 4 + Math.sin(seconds * 0.021) * 2;
  const sceneOffsetX = pointerX + riverDriftX;
  const sceneOffsetY = pointerY + riverDriftY;
  lastMarkerSeconds = seconds;
  lastSceneOffsetX = sceneOffsetX;
  lastSceneOffsetY = sceneOffsetY;
  const prepared = prepareCanvas(sceneOffsetX, sceneOffsetY, seconds);
  if (!prepared) return;
  const { context, width, height } = prepared;

  for (const [index, beam] of beamTemplates.entries()) {
    drawMovingBeam(
      context,
      cachedBeams[index],
      beam,
      seconds,
      index,
      sceneOffsetX,
      sceneOffsetY,
      width
    );
  }
  for (const [index, junction] of junctions.entries()) {
    drawJunctionPulse(context, junction, width, height, seconds, index, sceneOffsetX, sceneOffsetY);
  }
  positionTaskMarkers(width, height, seconds, sceneOffsetX, sceneOffsetY);
}

function updateToggle() {
  if (!toggle || !toggleLabel) return;
  toggle.setAttribute('aria-pressed', String(paused));
  toggleLabel.textContent = paused ? 'Play motion' : 'Pause motion';
}

function animate(timestamp) {
  if (
    !paused &&
    document.visibilityState === 'visible' &&
    timestamp - lastFrame >= TARGET_FRAME_MS
  ) {
    lastFrame = timestamp - ((timestamp - lastFrame) % TARGET_FRAME_MS);
    draw(timestamp);
  }
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
  pointerTargetX = (event.clientX / window.innerWidth - 0.5) * 8;
  pointerTargetY = (event.clientY / window.innerHeight - 0.5) * 5;
});

window.addEventListener('resize', () => {
  cachedWidth = 0;
  cachedHeight = 0;
  draw(performance.now());
});

window.addEventListener('scroll', () =>
  positionTaskMarkers(
    cachedWidth,
    cachedHeight,
    lastMarkerSeconds,
    lastSceneOffsetX,
    lastSceneOffsetY
  )
);

reducedMotion.addEventListener('change', (event) => {
  paused = event.matches;
  draw(performance.now());
  updateToggle();
});

updateToggle();
draw(performance.now());
window.requestAnimationFrame(animate);
