import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const scratchRoot = mkdtempSync(path.join(tmpdir(), 'beelzebub-package-test-'));
const npmCli = process.env.npm_execpath;

if (manifest.scripts?.prepare !== 'npm run build') {
  throw new Error('Git dependencies require "prepare": "npm run build"');
}

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
      "import { createGitHubContext } from 'beelzebub/github';",
      "import { MemoryCommandRunner, MemoryWorkflowRuntime } from 'beelzebub/testing';",
      "if (typeof bz !== 'function') throw new Error('default export is not callable');",
      'for (const value of [Beelzebub, BzCLI, BzTasks, defaultTask, help, vars]) {',
      "  if (typeof value !== 'function') throw new Error('expected public export is missing');",
      '}',
      "if (createGitHubContext({ GITHUB_REPOSITORY: 'owner/repo' }).repositoryName !== 'repo') throw new Error('GitHub subpath export failed');",
      "if (!(new MemoryCommandRunner()) || !(new MemoryWorkflowRuntime())) throw new Error('testing subpath export failed');",
      "console.log('esm-ok');",
      ''
    ].join('\n')
  );
  const esmOutput = run(process.execPath, ['smoke.mjs'], consumerDir);
  if (esmOutput !== 'esm-ok') throw new Error(`Unexpected ESM smoke output: ${esmOutput}`);

  writeFileSync(
    path.join(consumerDir, 'smoke.cjs'),
    [
      "const bz = require('beelzebub');",
      "const { createGitHubContext } = require('beelzebub/github');",
      "const { MemoryCommandRunner } = require('beelzebub/testing');",
      'const { Beelzebub, BzCLI, BzTasks, defaultTask, help, vars } = bz;',
      "if (typeof bz !== 'function') throw new Error('CommonJS export is not callable');",
      "if (bz.default !== bz) throw new Error('CommonJS default export is not interoperable');",
      'for (const value of [Beelzebub, BzCLI, BzTasks, defaultTask, help, vars]) {',
      "  if (typeof value !== 'function') throw new Error('expected CommonJS export is missing');",
      '}',
      "if (createGitHubContext({ GITHUB_REPOSITORY: 'owner/repo' }).repositoryOwner !== 'owner') throw new Error('CommonJS GitHub export failed');",
      "if (typeof MemoryCommandRunner !== 'function') throw new Error('CommonJS testing export failed');",
      "console.log('cjs-ok');",
      ''
    ].join('\n')
  );
  const cjsOutput = run(process.execPath, ['smoke.cjs'], consumerDir);
  if (cjsOutput !== 'cjs-ok') throw new Error(`Unexpected CommonJS smoke output: ${cjsOutput}`);

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
  writeFileSync(
    path.join(consumerDir, 'smoke.cts'),
    [
      "import bz = require('beelzebub');",
      'class CommonJSTasks extends bz.BzTasks {',
      '  run(): void {}',
      '}',
      'bz().add(CommonJSTasks);',
      ''
    ].join('\n')
  );
  const tscCli = path.join(projectRoot, 'node_modules', 'typescript', 'lib', 'tsc.js');
  run(
    process.execPath,
    [
      tscCli,
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
      'smoke.ts',
      'smoke.cts'
    ],
    consumerDir
  );

  const cliBin = path.join(consumerDir, 'node_modules', 'beelzebub', 'dist', 'bin', 'beelzebub.js');
  const cliVersion = run(process.execPath, [cliBin, '--version'], consumerDir);
  if (cliVersion !== manifest.version) {
    throw new Error(`CLI version mismatch: expected ${manifest.version}, received ${cliVersion}`);
  }

  writeFileSync(
    path.join(consumerDir, 'tasks.mjs'),
    [
      "import { BzTasks } from 'beelzebub';",
      'export default class SmokeTasks extends BzTasks {',
      "  run() { console.log('cli-file-ok'); }",
      '}',
      ''
    ].join('\n')
  );
  for (const fileArgs of [
    ['--file', './tasks.mjs'],
    ['-f', './tasks.mjs'],
    ['--file=./tasks.mjs']
  ]) {
    const cliOutput = run(process.execPath, [cliBin, ...fileArgs, 'SmokeTasks.run'], consumerDir);
    if (!cliOutput.includes('cli-file-ok')) {
      throw new Error(`CLI did not load its task file with ${fileArgs.join(' ')}`);
    }
  }

  writeFileSync(
    path.join(consumerDir, 'tasks.ts'),
    [
      "import { BzTasks } from 'beelzebub';",
      'export default class TypeScriptSmokeTasks extends BzTasks {',
      "  run(options: { value?: number }) { console.log('cli-typescript-ok', options.value); }",
      '}',
      ''
    ].join('\n')
  );
  const typeScriptCliOutput = run(
    process.execPath,
    [cliBin, '--file', './tasks.ts', 'TypeScriptSmokeTasks.run', '--value=2'],
    consumerDir
  );
  if (!typeScriptCliOutput.includes('cli-typescript-ok 2')) {
    throw new Error('CLI did not load its TypeScript task file without a manual loader');
  }

  console.log(`package smoke test passed: ${manifest.name}@${manifest.version}`);
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}
