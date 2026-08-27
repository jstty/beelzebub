import { afterEach, describe, expect, it, vi } from 'vitest';

import bz, { BzTasks, type TaskInfo } from '../src/index.js';
import { createTestConfig } from './helpers.js';

afterEach(() => {
  bz.delete();
});

describe('task lifecycle and dispatch', () => {
  it('runs lifecycle hooks and filtered events in order', async () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const calls: string[] = [];

    class LifecycleTasks extends BzTasks {
      override $init(): void {
        calls.push('init');
      }

      override $beforeAll(taskInfo: TaskInfo): void {
        calls.push(`beforeAll:${taskInfo.task}`);
      }

      override $beforeEach(taskInfo: TaskInfo): void {
        calls.push(`beforeEach:${taskInfo.task}`);
      }

      override $afterEach(taskInfo: TaskInfo): void {
        calls.push(`afterEach:${taskInfo.task}`);
      }

      override $afterAll(): void {
        calls.push('afterAll');
      }

      first(vars: Record<string, unknown>): void {
        calls.push(`first:${String(vars.value)}`);
        this.$emit('custom', vars.value);
      }

      second(): void {
        calls.push('second');
      }
    }

    app.on('$before', (taskInfo) => {
      calls.push(`event-before:${String((taskInfo as TaskInfo).task)}`);
    });
    app.on({
      name: 'custom',
      task: 'LifecycleTasks.first',
      callback: (_taskInfo, data) => calls.push(`custom:${String(data)}`)
    });
    app.on('custom', 'OtherTasks.first', () => calls.push('wrong-filter'));
    app.on('$after', (taskInfo) => {
      calls.push(`event-after:${String((taskInfo as TaskInfo).task)}`);
    });

    app.add(LifecycleTasks);
    expect(app.isLoading()).toBe(true);
    await app.getInitPromise();
    expect(app.isLoading()).toBe(false);

    await app.run({ task: 'LifecycleTasks.first', vars: { value: 7 } }, 'LifecycleTasks.second');

    expect(calls).toEqual([
      'init',
      'beforeAll:first',
      'beforeEach:first',
      'event-before:LifecycleTasks.first',
      'first:7',
      'custom:7',
      'afterEach:first',
      'event-after:LifecycleTasks.first',
      'beforeEach:second',
      'event-before:LifecycleTasks.second',
      'second',
      'afterEach:second',
      'event-after:LifecycleTasks.second',
      'afterAll'
    ]);
    expect(app.getRunning()).toBeNull();
  });

  it('supports sequential, parallel, function, array, and default task inputs', async () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const calls: string[] = [];
    const gate = Promise.withResolvers<void>();

    class DispatchTasks extends BzTasks {
      override $init(): void {
        this.$setDefault('first');
      }

      first(): void {
        calls.push('first');
      }

      second(): void {
        calls.push('second');
      }

      async slow(): Promise<void> {
        calls.push('slow:start');
        await gate.promise;
        calls.push('slow:end');
      }

      fast(): void {
        calls.push('fast');
      }

      async runFunction(): Promise<void> {
        await this.$run(() => calls.push('function'));
      }
    }

    app.add(DispatchTasks);
    await app.getInitPromise();

    await app.sequence('DispatchTasks.first', 'DispatchTasks.second');
    expect(calls).toEqual(['first', 'second']);

    calls.length = 0;
    const parallelRun = app.parallel('DispatchTasks.slow', 'DispatchTasks.fast');
    await vi.waitFor(() => expect(calls).toEqual(['slow:start', 'fast']));
    gate.resolve();
    await parallelRun;
    expect(calls).toEqual(['slow:start', 'fast', 'slow:end']);

    calls.length = 0;
    await app.run(['DispatchTasks.first', ['DispatchTasks.second']]);
    await app.run('DispatchTasks.runFunction');
    await app.run('DispatchTasks');
    expect(calls).toEqual(['first', 'second', 'function', 'first']);
  });

  it('registers nested tasks and exposes tree, flat-list, and stats views', async () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const calls: string[] = [];

    class ChildTasks extends BzTasks {
      work(): void {
        calls.push('child');
      }
    }

    class ParentTasks extends BzTasks {
      override $init(): Promise<unknown> | void {
        return this.$addSubTasks(ChildTasks);
      }

      own(): void {
        calls.push('parent');
      }
    }

    app.add(ParentTasks);
    await app.getInitPromise();
    await app.run('ParentTasks.own', 'ParentTasks.ChildTasks.work');

    expect(calls).toEqual(['parent', 'child']);
    expect(app.$getTaskTree()).toMatchObject({
      name: 'ParentTasks',
      subTasks: [{ name: 'ChildTasks' }]
    });
    expect(app.$getTaskFlatList().map((entry) => entry.name)).toEqual([
      'ParentTasks',
      'ChildTasks'
    ]);
    expect(app.$getTaskFlatList()[0]?.stats).toBeDefined();
  });

  it('rejects invalid task inputs and task failures for CI-safe entry points', async () => {
    const { config, logger } = createTestConfig({ verbose: true });
    const app = bz.create(config);

    class ErrorTasks extends BzTasks {
      fail(): never {
        throw new Error('expected task failure');
      }
    }

    app.add(ErrorTasks);
    await app.getInitPromise();

    await expect(app.run('MissingTasks.nope')).resolves.toEqual([]);
    await expect(app.run(undefined, { task: 42 } as never)).rejects.toThrow(
      'invalid task name: "42"'
    );
    await expect(app.run(undefined, 42)).resolves.toEqual([]);
    await expect(app.run('ErrorTasks.fail')).rejects.toThrow('expected task failure');

    expect(logger.messages('warn')).toEqual(
      expect.arrayContaining(['MissingTasks.nope task not added', 'unknown task input type'])
    );
    expect(logger.messages('error').join('\n')).toContain('invalid task name');
    expect(logger.messages('error').join('\n')).toContain('expected task failure');
  });

  it('preserves return values and runs failure cleanup with an execution record', async () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const calls: string[] = [];

    class ResultTasks extends BzTasks {
      value(): number {
        return 42;
      }

      fail(): never {
        throw new Error('boom');
      }

      override $finallyEach(_taskInfo: TaskInfo, execution: { outcome: string }): void {
        calls.push(execution.outcome);
      }
    }

    app.add(ResultTasks);
    await app.getInitPromise();

    await expect(app.run('ResultTasks.value')).resolves.toBe(42);
    await expect(app.run('ResultTasks.fail')).rejects.toThrow('boom');

    expect(app.getExecutions()).toEqual([
      expect.objectContaining({ task: 'ResultTasks.value', outcome: 'success', value: 42 }),
      expect.objectContaining({ task: 'ResultTasks.fail', outcome: 'failure' })
    ]);
    expect(calls).toEqual(['success', 'failure']);
  });
});
