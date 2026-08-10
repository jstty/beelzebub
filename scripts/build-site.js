import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

import { buildApiReference } from './build-api-reference.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(projectRoot, 'website', 'src');
const outputRoot = path.join(projectRoot, 'website', 'dist');
const brandAssetsRoot = path.join(projectRoot, 'assets');

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

function contentVersion(relativePath) {
  return createHash('sha256')
    .update(readFileSync(path.join(outputRoot, relativePath)))
    .digest('hex')
    .slice(0, 12);
}

function versionBrowserAssets() {
  const versions = {
    '/assets/site.css': contentVersion('assets/site.css'),
    '/assets/site.js': contentVersion('assets/site.js')
  };

  for (const htmlFile of collectHtmlFiles(outputRoot)) {
    let html = readFileSync(htmlFile, 'utf8');

    for (const [assetPath, version] of Object.entries(versions)) {
      html = html.replaceAll(assetPath, `${assetPath}?v=${version}`);
    }

    writeFileSync(htmlFile, html);
  }

  return versions;
}

for (const requiredPath of [sourceRoot, brandAssetsRoot]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Website build input is missing: ${path.relative(projectRoot, requiredPath)}`);
  }
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

cpSync(sourceRoot, outputRoot, { recursive: true });
cpSync(path.join(brandAssetsRoot, 'bz-logo.svg'), path.join(outputRoot, 'assets', 'bz-logo.svg'));
cpSync(
  path.join(brandAssetsRoot, 'bz-logo-full.png'),
  path.join(outputRoot, 'assets', 'bz-logo-full.png')
);

await buildApiReference(projectRoot, outputRoot);

const versions = versionBrowserAssets();

console.log(
  `site build: website/dist ready (CSS ${versions['/assets/site.css']}, JS ${versions['/assets/site.js']})`
);
