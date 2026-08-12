import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, 'website', 'dist');
const firebaseConfig = JSON.parse(readFileSync(path.join(projectRoot, 'firebase.json'), 'utf8'));
const requiredFiles = [
  'index.html',
  'examples/index.html',
  'motion-lab/index.html',
  'motion-lab/trace-river/index.html',
  'migrate/index.html',
  'migrate/agent-guide.md',
  'assets/motion-lab.css',
  'assets/motion-lab.js',
  'assets/page-trace.js',
  'assets/trace-river.css',
  'assets/trace-river.js',
  'assets/site.css',
  'assets/site.js',
  'assets/bz-logo.svg',
  'assets/og.png',
  'robots.txt',
  'sitemap.xml',
  'api/index.html'
];

const failures = [];

for (const relativePath of requiredFiles) {
  if (!existsSync(path.join(outputRoot, relativePath))) {
    failures.push(`missing ${relativePath}`);
  }
}

function collectHtmlFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(absolutePath));
    } else if (entry.name.endsWith('.html')) {
      files.push(absolutePath);
    }
  }
  return files;
}

const productHtmlFiles = collectHtmlFiles(outputRoot);

for (const htmlFile of productHtmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  const relativeHtml = path.relative(outputRoot, htmlFile);

  if (!/<html\b[^>]*\blang="en"[^>]*>/.test(html)) {
    failures.push(`${relativeHtml} is missing its document language`);
  }
  if (!html.includes('<meta name="viewport"')) {
    failures.push(`${relativeHtml} is missing a viewport declaration`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) {
    failures.push(`${relativeHtml} is missing a page title`);
  }
  if (!html.includes('class="skip-link"')) {
    failures.push(`${relativeHtml} is missing a skip link`);
  }
  if (!/class="[^"]*\bsite-header\b/.test(html)) {
    failures.push(`${relativeHtml} is missing the shared site header`);
  }
  if (!/href="\/assets\/site\.css\?v=[a-f0-9]{12}"/.test(html)) {
    failures.push(`${relativeHtml} is missing its versioned site stylesheet`);
  }
  if (!/src="\/assets\/site\.js\?v=[a-f0-9]{12}"/.test(html)) {
    failures.push(`${relativeHtml} is missing its versioned site script`);
  }

  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const target = match[1];
    if (!target || target === '/') continue;
    const localPath = path.join(outputRoot, target);
    const candidates = [localPath, `${localPath}.html`, path.join(localPath, 'index.html')];
    if (!candidates.some((candidate) => existsSync(candidate))) {
      failures.push(`${relativeHtml} references missing local path ${target}`);
    }
  }
}

const homeHtml = readFileSync(path.join(outputRoot, 'index.html'), 'utf8');
const examplesHtml = readFileSync(path.join(outputRoot, 'examples', 'index.html'), 'utf8');
const apiHtml = readFileSync(path.join(outputRoot, 'api', 'index.html'), 'utf8');
const migrationHtml = readFileSync(path.join(outputRoot, 'migrate', 'index.html'), 'utf8');
const motionLabHtml = readFileSync(path.join(outputRoot, 'motion-lab', 'index.html'), 'utf8');
const traceRiverHtml = readFileSync(
  path.join(outputRoot, 'motion-lab', 'trace-river', 'index.html'),
  'utf8'
);
const agentGuide = readFileSync(path.join(outputRoot, 'migrate', 'agent-guide.md'), 'utf8');
const siteCss = readFileSync(path.join(outputRoot, 'assets', 'site.css'), 'utf8');
const pageTraceJs = readFileSync(path.join(outputRoot, 'assets', 'page-trace.js'), 'utf8');
const traceRiverCss = readFileSync(path.join(outputRoot, 'assets', 'trace-river.css'), 'utf8');
const traceRiverJs = readFileSync(path.join(outputRoot, 'assets', 'trace-river.js'), 'utf8');
if (homeHtml.includes('forged for Node 24') || homeHtml.includes('class="release-kicker"')) {
  failures.push('index.html still includes the removed Node 24 release kicker');
}
if (
  !homeHtml.includes('data-trace-river') ||
  !homeHtml.includes('trace-cinematic-stage') ||
  !homeHtml.includes('trace-brand-tagline">One <b>hell</b> of a taskmaster.') ||
  !homeHtml.includes('class="trace-tagline-secondary">Whip your <b>agents</b> into shape.') ||
  !homeHtml.includes('class="trace-tagline-tertiary">Build testable workflows.') ||
  !homeHtml.includes('Build testable workflows.') ||
  !homeHtml.includes('Have your agent do the work.') ||
  !/href="\/assets\/trace-river\.css\?v=[a-f0-9]{12}"/.test(homeHtml) ||
  !/src="\/assets\/trace-river\.js\?v=[a-f0-9]{12}"/.test(homeHtml)
) {
  failures.push('index.html is missing the production Trace River homepage');
}
if (
  !traceRiverCss.includes('.trace-brand-tagline') ||
  !traceRiverCss.includes('.trace-tagline-secondary') ||
  !traceRiverCss.includes('.trace-tagline-tertiary') ||
  !traceRiverCss.includes('font-size: clamp(15px, 4.7cqw, 28px)') ||
  !traceRiverCss.includes('font-size: clamp(19px, 8.1cqw, 52px)') ||
  !traceRiverCss.includes('container-type: inline-size')
) {
  failures.push('index.html is missing the overview tagline hierarchy');
}
const homeHeader = homeHtml.match(
  /<header class="site-header trace-site-header"[\s\S]*?<\/header>/
);
if (!homeHeader || homeHeader[0].includes('class="brand"')) {
  failures.push('index.html should keep branding in the hero instead of the home header');
}
if (!apiHtml.includes('data-api-symbol')) {
  failures.push('api/index.html is missing generated API symbols');
}
if (!apiHtml.includes('Generated from exported TypeScript and TSDoc')) {
  failures.push('api/index.html is not the source-generated API page');
}
if (!apiHtml.includes('class="api-hero"') || !apiHtml.includes('class="api-quick-nav"')) {
  failures.push('api/index.html is missing the search hero or section jump bar');
}
if (!/<section class="api-hero"[\s\S]*data-api-search[\s\S]*<\/section>/.test(apiHtml)) {
  failures.push('api/index.html search is not inside the API hero');
}
if (apiHtml.includes('source of truth')) {
  failures.push('api/index.html still includes the removed source-of-truth marketing copy');
}
if (!/\.site-header\s*\{[^}]*position:\s*sticky/s.test(siteCss)) {
  failures.push('assets/site.css does not keep the shared header sticky');
}
if (!siteCss.includes('background: rgba(10, 6, 17, 0.78)')) {
  failures.push('assets/site.css is missing the translucent mobile navigation glass');
}
if (!siteCss.includes('body.nav-open::before') || !siteCss.includes('blur(26px) saturate(88%)')) {
  failures.push('assets/site.css is missing the frosted mobile navigation scrim');
}
if (!siteCss.includes('--paper: #ada299') || !siteCss.includes('--white: #d0c2b6')) {
  failures.push('assets/site.css is missing the muted warm-stone palette');
}
if (siteCss.includes('min-width: 560px')) {
  failures.push('assets/site.css still forces the overview console wider than a phone');
}
if (!siteCss.includes('@keyframes hero-color-drift')) {
  failures.push('assets/site.css is missing the animated hero color fields');
}
if (
  !siteCss.includes('/* Trace River product theme */') ||
  !siteCss.includes('.page-trace-canvas') ||
  !siteCss.includes(".api-page .primary-nav a[aria-current='page']")
) {
  failures.push('assets/site.css is missing the shared Trace River product theme');
}
if (
  !pageTraceJs.includes('drawPageTrace') ||
  !pageTraceJs.includes('drawPulse') ||
  !pageTraceJs.includes('pageTraceCompact') ||
  !pageTraceJs.includes('visibilitychange') ||
  !pageTraceJs.includes('orientationchange') ||
  !/src="\/assets\/page-trace\.js\?v=[a-f0-9]{12}"/.test(examplesHtml) ||
  !/src="\/assets\/page-trace\.js\?v=[a-f0-9]{12}"/.test(apiHtml) ||
  !/src="\/assets\/page-trace\.js\?v=[a-f0-9]{12}"/.test(migrationHtml)
) {
  failures.push('secondary pages are missing the simplified Trace River renderer');
}
if (
  homeHtml.includes('trace-task-callouts') ||
  homeHtml.includes('class="trace-timeline"') ||
  !homeHtml.includes('class="trace-home-root"') ||
  !traceRiverCss.includes('.trace-home-page .trace-cinematic-stage') ||
  !traceRiverCss.includes('height: calc(100dvh - var(--header-height))') ||
  !/\.page-trace-canvas\s*\{[^}]*position:\s*fixed/s.test(siteCss) ||
  !pageTraceJs.includes('PAGE_TRACE_COMPACT_FRAME_MS = 1000 / 10') ||
  !pageTraceJs.includes('Math.min(window.devicePixelRatio || 1, 0.75)')
) {
  failures.push('overview or secondary pages are missing the viewport-locked trace treatment');
}
const motionSamples = ['trace', 'topology', 'ribbons', 'grid', 'particles'];
if (
  motionSamples.some((sample) => !motionLabHtml.includes(`data-motion="${sample}"`)) ||
  !motionLabHtml.includes('data-motion-toggle')
) {
  failures.push('motion-lab/index.html is missing one or more live motion studies');
}
if (
  !traceRiverHtml.includes('data-trace-river') ||
  !traceRiverHtml.includes('trace-cinematic-stage') ||
  !traceRiverHtml.includes('trace-task-callouts') ||
  !traceRiverHtml.includes('trace-timeline') ||
  !traceRiverHtml.includes('npm install beelzebub') ||
  !motionLabHtml.includes('href="/motion-lab/trace-river/"')
) {
  failures.push('motion-lab/trace-river/index.html is missing the full background prototype');
}
if (
  traceRiverHtml.includes('trace-prototype-controls') ||
  traceRiverHtml.includes('data-trace-toggle') ||
  traceRiverHtml.includes('Pause motion') ||
  traceRiverHtml.includes('← Motion lab')
) {
  failures.push('motion-lab/trace-river/index.html still contains the removed prototype controls');
}
const traceHeader = traceRiverHtml.match(
  /<header class="site-header trace-site-header"[\s\S]*?<\/header>/
);
if (
  !traceRiverHtml.includes('Agent first.') ||
  !traceRiverHtml.includes('Build testable workflows.') ||
  !traceRiverHtml.includes('Have your agent do the work.') ||
  !traceRiverHtml.includes('beelzebub@^2') ||
  !traceRiverHtml.includes('AGENTS.md, CLAUDE.md') ||
  !traceRiverHtml.includes('data-copy-panel') ||
  !traceRiverHtml.includes('class="trace-install"') ||
  traceRiverHtml.indexOf('Have your agent do the work.') >
    traceRiverHtml.indexOf('npm install beelzebub') ||
  traceRiverHtml.includes('Agent handoff') ||
  traceRiverHtml.includes('Install · Migrate · Document · Verify') ||
  traceRiverHtml.includes('Copy a complete brief to install Beelzebub') ||
  !traceHeader ||
  traceHeader[0].includes('class="brand"')
) {
  failures.push('motion-lab/trace-river/index.html is missing the agent-first splash treatment');
}
if (
  !traceRiverJs.includes('STATIC_LAYER_SCALE') ||
  !traceRiverJs.includes('TARGET_FRAME_MS') ||
  !traceRiverJs.includes('rebuildStaticLayer') ||
  !traceRiverJs.includes('riverWaveOffset') ||
  !traceRiverJs.includes('RIVER_WAVE_PRIMARY_AMPLITUDE = 14') ||
  !traceRiverJs.includes('RIVER_WAVE_SECONDARY_AMPLITUDE = 5') ||
  !traceRiverJs.includes('PULSE_RIBBON_MAX_WIDTH') ||
  !traceRiverJs.includes('fillPulseRibbon') ||
  !traceRiverJs.includes("imageSmoothingQuality = 'high'") ||
  !traceRiverJs.includes('riverDriftX') ||
  !traceRiverJs.includes('riverDriftY') ||
  !traceRiverJs.includes('positionTaskMarkers') ||
  !traceRiverHtml.includes('data-trace-junction-marker="3"') ||
  !traceRiverHtml.includes('data-trace-beam-marker="0"')
) {
  failures.push('assets/trace-river.js is missing its cached, frame-budgeted drifting renderer');
}
if (/\.trace-glass-panel\s*\{[^}]*backdrop-filter:\s*blur/s.test(traceRiverCss)) {
  failures.push('assets/trace-river.css uses live blur over the animated canvas');
}
if (!traceRiverCss.includes('.trace-task-callout-release > div')) {
  failures.push('assets/trace-river.css does not offset the release label below the river rail');
}
if (
  !traceRiverCss.includes('.trace-home-page .trace-brand-name') ||
  !traceRiverCss.includes('-webkit-text-stroke: clamp(1.5px, 0.16vw, 2.5px) #000')
) {
  failures.push('assets/trace-river.css does not outline the overview wordmark');
}
const migrationSectionIds = ['scope', 'plan', 'example', 'packages', 'agent', 'verify'];
if (
  migrationSectionIds.some((sectionId) => !migrationHtml.includes(`id="${sectionId}"`)) ||
  !migrationHtml.includes('href="/migrate/agent-guide.md"') ||
  !migrationHtml.includes('package.json') ||
  !migrationHtml.includes('shell') ||
  !migrationHtml.includes('$sequence()') ||
  !migrationHtml.includes('$parallel()') ||
  !migrationHtml.includes('data-copy-panel')
) {
  failures.push('migrate/index.html is missing the AI-agent script-migration playbook');
}
if (
  migrationHtml.indexOf('href="#agent"') > migrationHtml.indexOf('href="#scope"') ||
  migrationHtml.indexOf('id="agent"') > migrationHtml.indexOf('id="scope"') ||
  !siteCss.includes('.agent-prompt-window .example-code-bar > span:first-child') ||
  !siteCss.includes('.migration-page .migration-nav::-webkit-scrollbar')
) {
  failures.push('migrate/index.html is missing the agent-first responsive navigation treatment');
}
if (
  migrationHtml.includes('Beelzebub 1.x') ||
  migrationHtml.includes('1.x → 2.0') ||
  migrationHtml.includes('<th scope="col">1.x</th>') ||
  migrationHtml.includes('Beelzebub.cli()')
) {
  failures.push('migrate/index.html still contains the removed 1.x upgrade framing');
}
if (
  !agentGuide.startsWith('# Migrate project scripts to Beelzebub 2.0 — AI agent guide') ||
  !agentGuide.includes('## 7. Verify the migration') ||
  !agentGuide.includes('## Copyable agent prompt') ||
  !agentGuide.includes('package.json scripts, shell scripts') ||
  agentGuide.includes('Beelzebub 1.x')
) {
  failures.push('migrate/agent-guide.md is missing required AI-agent migration instructions');
}
for (const htmlFile of productHtmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  if (!/<a href="\/migrate\/"(?: aria-current="page")?>Migrate<\/a>/.test(html)) {
    failures.push(`${path.relative(outputRoot, htmlFile)} is missing the Migrate navigation`);
  }
  if (html.includes('Migrate with AI')) {
    failures.push(`${path.relative(outputRoot, htmlFile)} still includes the old migration label`);
  }
}

const defaultHostingHeaders = firebaseConfig.hosting?.headers?.find(
  (entry) => entry.source === '**'
)?.headers;
const defaultCacheControl = defaultHostingHeaders?.find(
  (header) => header.key.toLowerCase() === 'cache-control'
)?.value;
if (defaultCacheControl !== 'public,max-age=0,must-revalidate') {
  failures.push('firebase.json must revalidate unversioned site files immediately');
}

const markdownHostingHeaders = firebaseConfig.hosting?.headers?.find(
  (entry) => entry.source === '**/*.md'
)?.headers;
const markdownContentType = markdownHostingHeaders?.find(
  (header) => header.key.toLowerCase() === 'content-type'
)?.value;
if (markdownContentType !== 'text/markdown; charset=utf-8') {
  failures.push('firebase.json must serve coding-agent guides as Markdown');
}

if (failures.length > 0) {
  throw new Error(`Website validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`site check: ${productHtmlFiles.length} product pages validated`);
