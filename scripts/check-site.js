import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, 'website', 'dist');
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
      if (entry.name !== 'api') files.push(...collectHtmlFiles(absolutePath));
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

if (failures.length > 0) {
  throw new Error(`Website validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`site check: ${productHtmlFiles.length} product pages validated`);
