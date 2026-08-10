import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { buildApiReference } from './build-api-reference.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(projectRoot, 'website', 'src');
const outputRoot = path.join(projectRoot, 'website', 'dist');
const brandAssetsRoot = path.join(projectRoot, 'assets');

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

console.log('site build: website/dist ready');
