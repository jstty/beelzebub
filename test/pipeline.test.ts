import { describe, expect, it } from 'vitest';

import bz, {
  BzTasks,
  always,
  cancelled,
  executePipeline,
  failure,
  success,
  type PipelineStepResult
} from '../src/index.js';
import { createTestConfig } from './helpers.js';

describe('typed pipeline execution', () => {
  it('supports continue-on-error, always, outcome conditions, and step values', async () => {
    const app = bz.create(createTestConfig().config);
    const calls: string[] = [];

    class PipelineTasks extends BzTasks {
      coverage(): never {
        calls.push('coverage');
        throw new Error('coverage threshold');
      }
      summary(): string {
        calls.push('summary');
        return 'report.md';
      }
      enforce(): void {
        calls.push('enforce');
      }
      skipped(): void {
        calls.push('skipped');
      }
      run() {
        return this.$pipeline([
          { id: 'coverage', task: '.coverage', continueOnError: true },
          { id: 'summary', task: '.summary', when: always() },
          { id: 'enforce', task: '.enforce', when: failure('coverage') },
          { id: 'skip', task: '.skipped', when: () => false }
        ]);
      }
    }

    app.add(PipelineTasks);
    await app.getInitPromise();
    const result = await app.run('PipelineTasks.run');

    expect(result).toMatchObject({
      conclusion: 'success',
      steps: {
        coverage: { outcome: 'failure', conclusion: 'success' },
        summary: { outcome: 'success', value: 'report.md' },
        enforce: { outcome: 'success' },
        skip: { outcome: 'skipped' }
      }
    });
    expect(calls).toEqual(['coverage', 'summary', 'enforce']);
  });

  it('runs always steps before rejecting with the complete pipeline result', async () => {
    const app = bz.create(createTestConfig().config);
    const calls: string[] = [];

    class FailedPipeline extends BzTasks {
      fail(): never {
        throw new Error('failed');
      }
      cleanup(): void {
        calls.push('cleanup');
      }
      run() {
        return this.$pipeline([
          { id: 'test', task: '.fail' },
          { id: 'ordinary', task: '.cleanup' },
          { id: 'cleanup', task: '.cleanup', when: always() }
        ]);
      }
    }

    app.add(FailedPipeline);
    await app.getInitPromise();
    await expect(app.run('FailedPipeline.run')).rejects.toMatchObject({
      name: 'PipelineError',
      result: {
        conclusion: 'failure',
        steps: {
          test: { outcome: 'failure' },
          ordinary: { outcome: 'skipped' },
          cleanup: { outcome: 'success' }
        }
      }
    });
    expect(calls).toEqual(['cleanup']);
  });

  it('rejects duplicate step ids before executing the duplicate', async () => {
    await expect(
      import('../src/pipeline.js').then(({ executePipeline }) =>
        executePipeline(
          [
            { id: 'same', task: 1 },
            { id: 'same', task: 2 }
          ],
          async (task) => task
        )
      )
    ).rejects.toThrow('unique and non-empty');
  });

  it('validates empty ids and reports an all-skipped pipeline', async () => {
    await expect(executePipeline([{ id: '', task: 'nope' }], async (task) => task)).rejects.toThrow(
      'unique and non-empty'
    );
    await expect(
      executePipeline([{ id: 'skip', task: 'nope', when: () => false }], async (task) => task)
    ).resolves.toMatchObject({ conclusion: 'skipped', order: ['skip'] });
  });

  it('provides reusable success, failure, and cancellation conditions', async () => {
    const step = (outcome: PipelineStepResult['outcome']): PipelineStepResult => ({
      id: outcome,
      outcome,
      conclusion: outcome,
      startedAt: new Date(0),
      completedAt: new Date(0),
      durationMs: 0
    });
    const successContext = { steps: { build: step('success'), optional: step('skipped') } };
    const failureContext = { steps: { build: step('failure') } };
    const cancelledContext = { steps: { build: step('cancelled') } };

    expect(success()(successContext)).toBe(true);
    expect(success()(failureContext)).toBe(false);
    expect(failure()(failureContext)).toBe(true);
    expect(failure('missing')(failureContext)).toBe(false);
    expect(cancelled()(cancelledContext)).toBe(true);
    expect(cancelled('build')(cancelledContext)).toBe(true);
    expect(cancelled('missing')(cancelledContext)).toBe(false);
  });
});
