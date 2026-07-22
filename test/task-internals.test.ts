import { afterEach, describe, expect, it } from 'vitest';

import bz, { BzTasks, type BeelzebubConfig } from '../src/index.js';
import { createTestConfig } from './helpers.js';

class ExposedTasks extends BzTasks {
  normalize(parent: BzTasks | undefined, tasks: unknown[]): unknown[] {
    return this._normalizeTask(parent, tasks);
  }

  execute(func: unknown, parent: unknown, ...args: unknown[]): Promise<unknown> {
    return this._normalizeExecFuncToPromise(func, parent, ...args);
  }

  runPromise(parent: BzTasks | undefined, task: unknown): Promise<unknown> {
    return this._runPromiseTask(parent, task as never);
  }

  runTask(task?: { task: string; vars?: Record<string, unknown> }): Promise<unknown> {
    return this._runTask(task);
  }

  alpha(vars?: Record<string, unknown>): Record<string, unknown> | undefined {
    return vars;
  }
}

afterEach(() => {
  bz.delete();
});

function createTasks(hidden = false) {
  const { config, logger } = createTestConfig({ verbose: true });
  const app = bz(config);
  const tasks = new ExposedTasks(
    { ...config, beelzebub: app, name: 'UnitTasks' } as BeelzebubConfig,
    hidden
  );
  return { app, tasks, config, logger };
}

describe('task normalization internals', () => {
  it('normalizes strings, JSON vars, arrays, functions, and task objects', async () => {
    const { tasks } = createTasks();
    tasks.$setDefault('alpha');
    await tasks.$register();

    const taskFunction = () => 'function';
    expect(
      tasks.normalize(undefined, [
        'alpha',
        'alpha:{"count":2}',
        ['alpha'],
        taskFunction,
        { task: 'alpha', vars: { direct: true } }
      ])
    ).toEqual([
      { task: 'alpha', vars: {} },
      { task: 'alpha', vars: { count: 2 } },
      [{ task: 'alpha', vars: {} }],
      { task: taskFunction, vars: {} },
      { task: 'alpha', vars: { direct: true } }
    ]);
  });

  it('filters missing tasks and invalid inputs while repairing malformed vars', async () => {
    const { tasks, logger } = createTasks();
    await tasks.$register();

    expect(
      tasks.normalize(undefined, ['missing', 'alpha:not-json', { invalid: true }, 4, null])
    ).toEqual([{ task: 'alpha', vars: {} }]);
    expect(logger.messages('warn')).toEqual(
      expect.arrayContaining([
        'missing task not added',
        'Vars should be an object',
        'invalid object: task property required',
        'unknown task input type'
      ])
    );
    expect(logger.messages('log').join('\n')).toContain('Parsing Task Error:');
  });

  it('normalizes empty, null, and primitive inline variable payloads', async () => {
    const { tasks, logger } = createTasks();
    await tasks.$register();

    expect(tasks.normalize(undefined, ['alpha:', 'alpha:null', 'alpha:3'])).toEqual([
      { task: 'alpha', vars: {} },
      { task: 'alpha', vars: {} },
      { task: 'alpha', vars: {} }
    ]);
    expect(logger.messages('warn')).toContain('Vars should be an object');
  });

  it('uses the singleton engine when constructed without explicit configuration', () => {
    const { app } = createTasks();
    const tasks = new BzTasks();

    expect(tasks.beelzebub).toBe(app);
    expect(tasks.$getName()).toBe('BzTasks');
  });

  it('resolves relative task names against a parent task path', async () => {
    const { app, tasks, config } = createTasks(true);
    await tasks.$register();
    const child = new ExposedTasks({
      ...config,
      beelzebub: app,
      name: 'Child',
      parentPath: 'UnitTasks'
    });
    await child.$register();
    tasks.$setSubTask('Child', child);
    const root = new ExposedTasks(
      { ...config, beelzebub: app, name: '$root$' } as BeelzebubConfig,
      true
    );
    root.$useAsRoot();
    root.$setSubTask('UnitTasks', tasks);

    expect(root.normalize(child, ['.alpha', { task: '.alpha', vars: {} }])).toEqual([
      { task: 'UnitTasks.Child.alpha', vars: {} },
      { task: 'UnitTasks.Child.alpha', vars: {} }
    ]);
  });
});

describe('task execution internals', () => {
  it('normalizes promises, functions, and unsupported values', async () => {
    const { tasks, logger } = createTasks();

    await expect(tasks.execute(Promise.resolve('promise'), tasks)).resolves.toBe('promise');
    await expect(tasks.execute(() => Promise.resolve('function'), tasks)).resolves.toBe('function');
    await expect(tasks.execute(42, tasks)).resolves.toBeNull();
    expect(logger.messages('warn').join('\n')).toContain('other type?? func:');
  });

  it('runs default and function records and rejects unsupported records', async () => {
    const { tasks } = createTasks();
    tasks.$setDefault('alpha');
    await tasks.$register();

    await expect(tasks.runTask()).resolves.toBeUndefined();
    await expect(
      tasks.runPromise(tasks, { task: () => 'inline', vars: { value: 1 } })
    ).resolves.toBeUndefined();
    await expect(tasks.runPromise(tasks, { task: 42 })).rejects.toThrow('invalid task name');
    await expect(tasks.runPromise(tasks, 42)).rejects.toThrow('task type not supported');
    await expect(tasks.runTask({ task: 'missing' })).resolves.toBeUndefined();
  });

  it('warns when a hidden task tree contains multiple children', async () => {
    const { app, tasks, config, logger } = createTasks(true);
    const first = new BzTasks({ ...config, beelzebub: app, name: 'First' });
    const second = new BzTasks({ ...config, beelzebub: app, name: 'Second' });
    tasks.$setSubTasks({ First: first, Second: second });

    expect(tasks.$getTaskTree().name).toBe('First');
    expect(logger.messages('warn')).toContain('multi sub tasks in hidden task node not allowed');
  });
});
