import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import bz, { BzCLI } from '../src/index.js';
import { createTestConfig } from './helpers.js';

class ExposedCLI extends BzCLI {
  parse(args: string[]): Record<string, unknown> {
    return this._looseParse(args);
  }

  split(args: string[]) {
    return this._breakApartTasksVarsInArgs(args);
  }

  load(currentDir: string, tasks: unknown[], file: string, displayError = false) {
    return this._loadFile(currentDir, tasks, file, displayError);
  }

  convert(taskOptions: Record<string, string[]>) {
    return this._convertCLIArgsToTasks(taskOptions);
  }

  safeParse(args: string[], options: Record<string, Record<string, unknown>>) {
    return this._safeParse(args, options as never, true);
  }

  show(options: Record<string, Record<string, unknown>>): void {
    this._showRootHelp(options as never);
  }
}

const temporaryDirectories: string[] = [];
const originalExitCode = process.exitCode;
const originalArgv = process.argv;

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-cli-run-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeTasksModule(directory: string, filename = 'tasks.mjs'): string {
  const sourceEntry = pathToFileURL(path.resolve('src/index.ts')).href;
  const file = path.join(directory, filename);
  writeFileSync(
    file,
    `import { BzTasks } from ${JSON.stringify(sourceEntry)};
export default class FileTasks extends BzTasks {
  constructor(config) {
    super(config);
    this.$defineTaskVars('run', {
      count: { type: 'number', default: 1 },
      label: { type: 'string', describe: 'Task label' },
      nested: { type: 'object', properties: { enabled: { type: 'boolean' } } }
    });
  }
  run(vars) { this.logger.log('file-task', JSON.stringify(vars)); }
}
`
  );
  return file;
}

afterEach(() => {
  bz.delete();
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
  process.argv = originalArgv;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('BzCLI run behavior', () => {
  it('prints the package version without loading tasks', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await expect(new BzCLI().run({ args: ['--version'] })).resolves.toBeUndefined();

    expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/^2\.0\.0-dev\n$/));
  });

  it('uses process arguments when an explicit argument list is omitted', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.argv = ['node', 'bz', '--version'];

    await expect(new BzCLI().run()).resolves.toBeUndefined();

    expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/^2\.0\.0-dev\n$/));
  });

  it('prints help when no task file exists', async () => {
    const directory = createTemporaryDirectory();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await expect(new BzCLI().run({ cwd: directory, args: ['--help'] })).resolves.toBeUndefined();

    expect(stdout.mock.calls.flat().join('')).toContain('Beelzebub Options:');
    expect(process.exitCode).not.toBe(1);
  });

  it('sets a failing exit code when no tasks can be loaded', async () => {
    const directory = createTemporaryDirectory();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(new BzCLI().run({ cwd: directory, args: [] })).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('No Tasks Loaded');
    expect(process.exitCode).toBe(1);
  });

  it('loads an explicit file, applies CLI variables, and runs its task', async () => {
    const directory = createTemporaryDirectory();
    writeTasksModule(directory);
    const { config, logger } = createTestConfig();

    const app = await new BzCLI().run({
      cwd: directory,
      config,
      args: ['--file=tasks.mjs', 'FileTasks.run', '--count=4', '--nested.enabled=true']
    });

    expect(app).toBeDefined();
    expect(logger.messages('log')).toContain(
      'file-task {"count":4,"nested":{"enabled":true},"label":""}'
    );
  });

  it('loads positional files and prints nested task options in help', async () => {
    const directory = createTemporaryDirectory();
    writeTasksModule(directory);
    const { config } = createTestConfig();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const app = await new BzCLI().run({
      cwd: directory,
      config,
      args: ['./tasks.mjs', '--help', 'FileTasks.run']
    });

    expect(app).toBeDefined();
    const output = stdout.mock.calls.flat().join('');
    expect(output).toContain('FileTasks.run Options:');
    expect(output).toContain('--nested.enabled');
  });

  it('reports initialization errors from loaded task classes', async () => {
    const directory = createTemporaryDirectory();
    const sourceEntry = pathToFileURL(path.resolve('src/index.ts')).href;
    writeFileSync(
      path.join(directory, 'broken.mjs'),
      `import { BzTasks } from ${JSON.stringify(sourceEntry)};
export default class BrokenTasks extends BzTasks {
  $init() { throw new Error('broken init'); }
}
`
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      new BzCLI().run({ cwd: directory, file: 'broken.mjs', args: [] })
    ).resolves.toBeUndefined();
    expect(error.mock.calls.flat().join(' ')).toContain('broken init');
  });

  it('returns a loaded application when no task was requested', async () => {
    const directory = createTemporaryDirectory();
    writeTasksModule(directory);
    const { config } = createTestConfig();

    await expect(
      new BzCLI().run({ cwd: directory, file: 'tasks.mjs', config, args: [] })
    ).resolves.toBeDefined();
  });
});

describe('BzCLI parsing and loading edges', () => {
  it('parses short flags, coercion, empty values, and repeated dotted values', () => {
    const parsed = new ExposedCLI().parse([
      '-x',
      '5',
      '-abc',
      '-n=3',
      '--truth=true',
      '--falsy=false',
      '--empty=',
      '--negative=-2.5',
      '--nested.value=one',
      '--nested.value=two',
      '--nested.value=three',
      '--separate',
      'value',
      'ignored'
    ]);

    expect(parsed).toEqual({
      x: 5,
      a: true,
      b: true,
      c: true,
      n: 3,
      truth: true,
      falsy: false,
      empty: '',
      negative: -2.5,
      nested: { value: ['one', 'two', 'three'] },
      separate: 'value'
    });
  });

  it('splits positional files and converts task option blocks', () => {
    const cli = new ExposedCLI();
    expect(cli.split(['./one.mjs', '--verbose', 'Build', '--watch', './two.mjs'])).toEqual({
      files: ['./one.mjs', './two.mjs'],
      rootOptions: ['--verbose'],
      taskOptions: { Build: ['--watch'] }
    });
    expect(cli.convert({ Build: [], Test: ['--count=2'] })).toEqual([
      { task: 'Build', vars: {} },
      { task: 'Test', vars: { count: 2 } }
    ]);
  });

  it('supports parser defaults and ungrouped help options', () => {
    const cli = new ExposedCLI();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(
      cli.safeParse([], {
        plain: { type: 'string', default: 'fallback' },
        aliased: { type: 'boolean', alias: 'a' }
      }).values
    ).toMatchObject({ plain: 'fallback' });
    cli.show({ plain: { type: 'string', describe: 'Plain option' } });

    expect(stdout.mock.calls.flat().join('')).toContain('Options:');
    expect(stdout.mock.calls.flat().join('')).toContain('--plain');
  });

  it('handles missing, empty, and failing modules', async () => {
    const directory = createTemporaryDirectory();
    const cli = new ExposedCLI();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(cli.load(directory, ['existing'], 'missing.mjs', true)).resolves.toEqual([
      'existing'
    ]);
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/File \(.+missing\.mjs\) Load Error: not found/)
    );

    writeFileSync(path.join(directory, 'empty.mjs'), 'export default [];\n');
    await expect(cli.load(directory, [], 'empty.mjs')).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('needs to export a module'));

    writeFileSync(path.join(directory, 'failing.mjs'), "throw new Error('module exploded');\n");
    await expect(cli.load(directory, [], 'failing.mjs', true)).resolves.toEqual([]);
    expect(error.mock.calls.flat().join(' ')).toContain('module exploded');

    writeFileSync(path.join(directory, 'missing-import.mjs'), "import './dependency.mjs';\n");
    await expect(cli.load(directory, [], 'missing-import.mjs', true)).resolves.toEqual([]);
    expect(error.mock.calls.flat().join(' ')).toContain('Load Error:');

    error.mockClear();
    await expect(cli.load(directory, [], 'missing-import.mjs')).resolves.toEqual([]);
    expect(error).not.toHaveBeenCalled();

    writeFileSync(path.join(directory, 'named.mjs'), 'export const task = 1;\n');
    await expect(cli.load(directory, [], 'named.mjs')).resolves.toEqual([
      expect.objectContaining({ task: 1 })
    ]);
  });
});
