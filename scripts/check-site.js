import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, 'website', 'dist');
const firebaseConfig = JSON.parse(readFileSync(path.join(projectRoot, 'firebase.json'), 'utf8'));
const requiredFiles = [
  'index.html',
  'examples/index.html',
  'migrate/index.html',
  'migrate/agent-guide.md',
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

  if (!html.includes('<html lang="en">')) {
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
  if (!html.includes('class="site-header"')) {
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
const apiHtml = readFileSync(path.join(outputRoot, 'api', 'index.html'), 'utf8');
const migrationHtml = readFileSync(path.join(outputRoot, 'migrate', 'index.html'), 'utf8');
const agentGuide = readFileSync(path.join(outputRoot, 'migrate', 'agent-guide.md'), 'utf8');
const siteCss = readFileSync(path.join(outputRoot, 'assets', 'site.css'), 'utf8');
if (homeHtml.includes('forged for Node 24') || homeHtml.includes('class="release-kicker"')) {
  failures.push('index.html still includes the removed Node 24 release kicker');
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
  if (!html.includes('Migrate with AI')) {
    failures.push(`${path.relative(outputRoot, htmlFile)} is missing the AI migration navigation`);
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
