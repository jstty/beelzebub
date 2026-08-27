import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { BzCLI } from '../src/index.js';

class ExposedCLI extends BzCLI {
  parse(args: string[]): Record<string, unknown> {
    return this._looseParse(args);
  }

  split(args: string[]): {
    files: string[];
    rootOptions: string[];
    taskOptions: Record<string, string[]>;
  } {
    return this._breakApartTasksVarsInArgs(args);
  }

  load(currentDir: string, file: string): Promise<unknown[]> {
    return this._loadFile(currentDir, [], file, true);
  }
}

describe('BzCLI', () => {
  it('parses repeated, dotted, boolean, and numeric task options', () => {
    const cli = new ExposedCLI();

    expect(
      cli.parse([
        '--count=2',
        '--enabled',
        '--no-cache',
        '--person.name=Ada',
        '--tag=one',
        '--tag=two'
      ])
    ).toEqual({
      count: 2,
      enabled: true,
      cache: false,
      person: { name: 'Ada' },
      tag: ['one', 'two']
    });
  });

  it('associates options with the task that precedes them', () => {
    const cli = new ExposedCLI();

    expect(cli.split(['--verbose', 'Build.compile', '--watch', 'Test', '--coverage'])).toEqual({
      files: [],
      rootOptions: ['--verbose'],
      taskOptions: {
        'Build.compile': ['--watch'],
        Test: ['--coverage']
      }
    });
  });

  it('loads an ESM task module by path', async () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'beelzebub-cli-test-'));
    const fixture = path.join(fixtureDir, 'tasks.mjs');
    writeFileSync(fixture, 'export default function ExampleTasks() {}\n');

    try {
      const loaded = await new ExposedCLI().load(fixtureDir, fixture);
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toBeTypeOf('function');
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
