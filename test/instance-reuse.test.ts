import { describe, expect, it } from 'vitest';

import bz, { BzTasks, PipelineError, failure, type PipelineResult } from '../src/index.js';
import * as util from '../src/util.js';
import { createTestConfig } from './helpers.js';

class Probe extends BzTasks {
  a(): never {
    throw new Error('a failed');
  }
  b(): string {
    return 'b';
  }
  async run(): Promise<PipelineResult> {
    try {
      return await this.$pipeline([
        { id: 'a', task: '.a' },
        { id: 'b', task: '.b' },
        { id: 'report', task: '.b', when: failure('a') }
      ]);
    } catch (error) {
      return (error as PipelineError).result;
    }
  }
}

describe("failureMode: 'log'", () => {
  for (const failureMode of ['throw', 'log'] as const) {
    it(`records failed pipeline steps as failures under '${failureMode}'`, async () => {
      const app = bz.create(createTestConfig({ failureMode }).config);
      app.add(Probe);
      const result = await app.run<PipelineResult>('Probe.run');
      expect(result).toMatchObject({
        conclusion: 'failure',
        steps: {
          a: { outcome: 'failure' },
          b: { outcome: 'skipped' },
          report: { outcome: 'success', value: 'b' }
        }
      });
    });
  }

  it('applies to the top-level run only', async () => {
    const { config, logger } = createTestConfig({ failureMode: 'log' });
    const app = bz.create(config);
    app.add(Probe);
    await expect(app.run('Probe.a')).resolves.toBeUndefined();
    expect(logger.messages('error').some((message) => message.includes('a failed'))).toBe(true);

    const strict = bz.create(createTestConfig().config);
    strict.add(Probe);
    await expect(strict.run('Probe.a')).rejects.toThrow('a failed');
  });
});

describe('instance reuse', () => {
  it('runs $beforeAll once per instance until resetRunState()', async () => {
    const app = bz.create(createTestConfig().config);
    let beforeAll = 0;

    class Once extends BzTasks {
      override $beforeAll(): void {
        beforeAll++;
      }
      work(): void {}
    }

    app.add(Once);
    await app.run('Once.work');
    await app.run('Once.work');
    expect(beforeAll).toBe(1);
    expect(app.getExecutions()).toHaveLength(2);

    app.resetRunState();
    expect(app.getExecutions()).toHaveLength(0);
    await app.run('Once.work');
    expect(beforeAll).toBe(2);
    expect(app.getExecutions()).toHaveLength(1);
  });

  it('rejects a concurrent top-level run, while nested runs and listeners join', async () => {
    const app = bz.create(createTestConfig().config);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const nested: unknown[] = [];

    class Busy extends BzTasks {
      async wait(): Promise<string> {
        await gate;
        return this.$run<string>('.inner');
      }
      inner(): string {
        return 'inner';
      }
      override async $afterAll(): Promise<void> {
        nested.push(await this.$run('.inner'));
      }
    }

    app.add(Busy);
    app.on('$after', 'Busy.inner', () => {
      nested.push('listener');
    });
    const first = app.run('Busy.wait');
    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(app.run('Busy.inner')).rejects.toThrow('already running');
    expect(() => app.resetRunState()).toThrow('in progress');
    expect(() => app.reset()).toThrow('in progress');

    release();
    await expect(first).resolves.toBe('inner');
    expect(nested).toEqual(['listener', 'listener', 'inner']);
    await expect(app.run('Busy.inner')).resolves.toBe('inner');
  });

  it('can run again after reset()', async () => {
    const app = bz.create(createTestConfig().config);
    class Again extends BzTasks {
      work(): string {
        return 'again';
      }
    }

    app.add(Again);
    app.reset();
    app.init(createTestConfig().config);
    app.add(Again);
    await expect(app.run('Again.work')).resolves.toBe('again');
  });

  it('keeps the shared defaults untouched when an instance fills in its own', () => {
    const before = Object.keys(util.DefaultConfig);
    const first = bz.create();
    const second = bz.create();
    expect(Object.keys(util.DefaultConfig)).toEqual(before);
    expect(first.getConfig().commandRunner).not.toBe(second.getConfig().commandRunner);
    expect(first.getConfig().workflow).not.toBe(second.getConfig().workflow);
  });
});
