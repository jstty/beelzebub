import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const scratchRoot = mkdtempSync(path.join(tmpdir(), 'beelzebub-package-test-'));
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error('npm_execpath is required; run this smoke test through npm');
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_cache: path.join(scratchRoot, 'npm-cache')
    }
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      [`Command failed: ${command} ${args.join(' ')}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n')
    );
  }
  return result.stdout.trim();
}

function runNpm(args, cwd) {
  return run(process.execPath, [npmCli, ...args], cwd);
}

try {
  const packResult = JSON.parse(
    runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', scratchRoot], projectRoot)
  );
  const packed = Array.isArray(packResult)
    ? packResult[0]
    : (packResult[manifest.name] ?? Object.values(packResult)[0]);
  if (!packed?.filename) throw new Error('npm pack did not report a tarball filename');
  const tarball = path.join(scratchRoot, packed.filename);
  const consumerDir = path.join(scratchRoot, 'consumer');
  mkdirSync(consumerDir);

  writeFileSync(
    path.join(consumerDir, 'package.json'),
    `${JSON.stringify({ name: 'beelzebub-smoke-consumer', private: true, type: 'module' }, null, 2)}\n`
  );
  runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumerDir);

  writeFileSync(
    path.join(consumerDir, 'smoke.mjs'),
    [
      "import bz, { Beelzebub, BzCLI, BzTasks, defaultTask, help, vars } from 'beelzebub';",
      "if (typeof bz !== 'function') throw new Error('default export is not callable');",
      'for (const value of [Beelzebub, BzCLI, BzTasks, defaultTask, help, vars]) {',
      "  if (typeof value !== 'function') throw new Error('expected public export is missing');",
      '}',
      "console.log('esm-ok');",
      ''
    ].join('\n')
  );
  const esmOutput = run(process.execPath, ['smoke.mjs'], consumerDir);
  if (esmOutput !== 'esm-ok') throw new Error(`Unexpected ESM smoke output: ${esmOutput}`);

  writeFileSync(
    path.join(consumerDir, 'smoke.ts'),
    [
      "import bz, { BzTasks, type BeelzebubConfig, type TaskInfo } from 'beelzebub';",
      'class SmokeTasks extends BzTasks {',
      '  run(_info?: TaskInfo): void {}',
      '}',
      'const config: BeelzebubConfig = { verbose: false };',
      'bz(config).add(SmokeTasks);',
      ''
    ].join('\n')
  );
  const tscBin = path.join(
    projectRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
  );
  run(
    tscBin,
    [
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      'false',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2024',
      'smoke.ts'
    ],
    consumerDir
  );

  const cliBin = path.join(consumerDir, 'node_modules', 'beelzebub', 'dist', 'bin', 'beelzebub.js');
  const cliVersion = run(process.execPath, [cliBin, '--version'], consumerDir);
  if (cliVersion !== manifest.version) {
    throw new Error(`CLI version mismatch: expected ${manifest.version}, received ${cliVersion}`);
  }

  console.log(`package smoke test passed: ${manifest.name}@${manifest.version}`);
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}
