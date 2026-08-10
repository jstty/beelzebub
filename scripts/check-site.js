import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, 'website', 'dist');
const firebaseConfig = JSON.parse(readFileSync(path.join(projectRoot, 'firebase.json'), 'utf8'));
const requiredFiles = [
  'index.html',
  'examples/index.html',
  'migrate/index.html',
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

const apiHtml = readFileSync(path.join(outputRoot, 'api', 'index.html'), 'utf8');
const siteCss = readFileSync(path.join(outputRoot, 'assets', 'site.css'), 'utf8');
if (!apiHtml.includes('data-api-symbol')) {
  failures.push('api/index.html is missing generated API symbols');
}
if (!apiHtml.includes('Generated from exported TypeScript and TSDoc')) {
  failures.push('api/index.html is not the source-generated API page');
}
if (apiHtml.includes('class="api-hero"') || apiHtml.includes('source of truth')) {
  failures.push('api/index.html still includes the removed API hero');
}
if (!/\.site-header\s*\{[^}]*position:\s*sticky/s.test(siteCss)) {
  failures.push('assets/site.css does not keep the shared header sticky');
}
if (!siteCss.includes('background: rgba(22, 13, 34, 0.78)')) {
  failures.push('assets/site.css is missing the tinted mobile navigation background');
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

if (failures.length > 0) {
  throw new Error(`Website validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`site check: ${productHtmlFiles.length} product pages validated`);
