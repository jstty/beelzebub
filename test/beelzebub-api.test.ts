import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import bz, { Beelzebub, BzTasks, type BeelzebubConfig } from '../src/index.js';
import { createTestConfig } from './helpers.js';

afterEach(() => {
  bz.delete();
  vi.restoreAllMocks();
});

describe('Beelzebub public API edges', () => {
  it('stores global variables and ignores event registrations without callbacks', () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const callback = vi.fn();

    app.setGlobalVars({ mode: 'coverage' });
    app.on('unused');
    app.on('event', 'Expected.task', callback);
    app.emit('event', { task: 'Other.task' }, 1);
    app.emit('event', { task: 'Expected.task' }, 2);

    expect(app.getGlobalVars()).toEqual({ mode: 'coverage' });
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({ task: 'Expected.task' }, 2);
  });

  it('reports missing modules, invalid classes, and unknown values passed to add', () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);
    class InvalidTasks {}

    app.add('/definitely/missing/beelzebub-tasks.cjs');
    app.add(InvalidTasks);
    app.add(42);
    app.add({});
    app.add(null);

    const errors = logger.messages('error').join('\n');
    expect(errors).toContain('Add Task Error:');
    expect(errors).toContain('Invalid Class/prototype');
    expect(errors).toContain('Unknown Task type');
  });

  it('loads duck-typed task modules passed by path', async () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-add-'));
    const fixture = path.join(directory, 'tasks.cjs');
    writeFileSync(
      fixture,
      `module.exports = {
  $sequence() {}, $parallel() {}, $run() {}, $setDefault() {},
  $isRoot() { return false; }, $useAsRoot() {}, $setName() {},
  $getName() { return 'DuckTasks'; }, $getTask() {},
  $setSubTask() {}, $getSubTask() {}, $register() { return Promise.resolve(); },
  $getTaskFlatList() { return [{ name: 'DuckTasks', tasks: {}, stats: {} }]; }
};
`
    );

    try {
      app.add(fixture);
      await app.getInitPromise();
      expect(app.$getTaskFlatList().map((entry) => entry.name)).toContain('DuckTasks');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('accepts task instances and replaces the hidden root', async () => {
    const { config } = createTestConfig();
    const app = bz.create(config);

    class InstanceTasks extends BzTasks {
      work(): void {}
    }

    const instance = new InstanceTasks({ ...config, beelzebub: app });
    app.add(instance);
    await app.getInitPromise();
    expect(app.$getTaskFlatList().map((entry) => entry.name)).toContain('InstanceTasks');

    const root = new InstanceTasks({ ...config, beelzebub: app, name: 'ReplacementRoot' });
    root.$useAsRoot();
    await app.add(root);
    expect(app.$getTaskTree().name).toBe('$root$');
  });

  it('constructs default loggers when no logger configuration is supplied', () => {
    const app = new Beelzebub({ silent: true });

    expect(app.getConfig().silent).toBe(true);
    expect(app.logger.log('hidden')).toBeUndefined();
    expect(app.helpLogger).toBeDefined();
  });

  it('formats a zero-duration summary without dividing by zero', () => {
    class SummaryApp extends Beelzebub {
      printZeroSummary(): void {
        this._stats.getCurrentDiffStats = () => ({
          time: 0,
          memory: { rss: 0, heapTotal: 0, heapUsed: 0 }
        });
        this._printSummary();
      }
    }

    const { config, helpLogger } = createTestConfig();
    const app = new SummaryApp(config);
    app.printZeroSummary();

    expect(helpLogger.messages('log').join('\n')).toContain('Per: 0.00 sec');
  });

  it('preserves explicit names and parent paths in task configuration', () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const taskConfig: BeelzebubConfig = {
      ...config,
      beelzebub: app,
      name: 'Named',
      parentPath: 'Parent'
    };
    const tasks = new BzTasks(taskConfig);

    expect(tasks.$getName()).toBe('Named');
    expect(tasks.namePath).toBe('Parent.Named');
  });
});
