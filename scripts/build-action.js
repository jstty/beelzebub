#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'github-action', 'dist');
const buildWorkingDirectory = await realpath(tmpdir());
const relativeProjectRoot = path
  .relative(buildWorkingDirectory, projectRoot)
  .split(path.sep)
  .join('/');

await mkdir(outputDirectory, { recursive: true });
await build({
  absWorkingDir: buildWorkingDirectory,
  entryPoints: [path.join(projectRoot, 'github-action', 'src', 'main.ts')],
  outfile: path.join(outputDirectory, 'index.js'),
  nodePaths: [path.join(projectRoot, 'node_modules')],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  banner: {
    js: "import { createRequire as __beelzebubCreateRequire } from 'node:module'; const require = __beelzebubCreateRequire(import.meta.url);"
  },
  sourcemap: false,
  logLevel: 'info'
});

// tsx intentionally embeds this marker in a template string. Leaving the
// literal marker in the bundle makes source-map scanners mistake the bundle
// itself for an inline source map, so escape only the source representation.
const outputPath = path.join(outputDirectory, 'index.js');
const output = await readFile(outputPath, 'utf8');
await writeFile(
  outputPath,
  output
    .replaceAll(relativeProjectRoot, 'beelzebub')
    .replaceAll(
      '//# sourceMappingURL=data:application/json;base64,',
      '//\\x23 sourceMappingURL=data:application/json;base64,'
    )
    .replace(/[ \t]+$/gm, '')
);
