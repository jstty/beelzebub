#!/usr/bin/env node
/**
 * Post-build: ensure the compiled CLI entry has a shebang and is executable.
 * TypeScript emits both the ESM index (`index.js`) and CommonJS compatibility
 * index (`index.cjs`) from source. We verify both so an incomplete package can
 * never pass the build step.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const binPath = resolve('dist/bin/beelzebub.js');
const shebang = '#!/usr/bin/env node\n';

for (const entryPath of [resolve('dist/index.js'), resolve('dist/index.cjs')]) {
  if (!existsSync(entryPath)) {
    throw new Error(`post-build: missing package entry point ${entryPath}`);
  }
}

let contents = readFileSync(binPath, 'utf8');
if (!contents.startsWith('#!')) {
  contents = shebang + contents;
  writeFileSync(binPath, contents);
}
chmodSync(binPath, 0o755);
console.log('post-build: ESM, CommonJS, and CLI entry points ready');
