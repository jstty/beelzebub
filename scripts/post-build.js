#!/usr/bin/env node
/**
 * Post-build: ensure the compiled CLI entry has a shebang and is executable.
 * tsc preserves shebangs from .ts files in modern versions, but we re-write
 * it defensively so the published package always works.
 */
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const binPath = resolve('dist/bin/beelzebub.js');
const shebang = '#!/usr/bin/env node\n';

let contents = readFileSync(binPath, 'utf8');
if (!contents.startsWith('#!')) {
  contents = shebang + contents;
  writeFileSync(binPath, contents);
}
chmodSync(binPath, 0o755);
console.log('post-build: dist/bin/beelzebub.js ready');
