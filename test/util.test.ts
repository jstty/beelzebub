import { afterEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';

import bz, { Beelzebub, BzTasks, TmplStrFunc } from '../src/index.js';
import * as util from '../src/util.js';
import { createTestConfig, TestLogger } from './helpers.js';

afterEach(() => {
  bz.delete();
  vi.restoreAllMocks();
});

describe('utility predicates and object helpers', () => {
  it('recognizes promises, streams, generators, tasks, and task objects', () => {
    const { config } = createTestConfig();
    const app = bz.create(config);
    const tasks = new BzTasks({ ...config, beelzebub: app });
    const thenable = { then: () => {} };
    const callableThenable = Object.assign(() => {}, { then: () => {} });
    const generator = function* () {
      yield 1;
    };

    expect(util.isPromise(Promise.resolve())).toBe(true);
    expect(util.isPromise(thenable)).toBe(true);
    expect(util.isPromise(callableThenable)).toBe(true);
    expect(util.isPromise(() => {})).toBe(false);
    expect(util.isPromise(1)).toBe(false);
    expect(util.isPromise(null)).toBe(false);
    expect(util.isStream(Readable.from(['data']))).toBe(true);
    expect(util.isStream({ pipe: true })).toBe(false);
    expect(util.isStream(null)).toBe(false);
    expect(util.isStream({})).toBe(false);
    expect(util.isGenerator(generator)).toBe(true);
    expect(util.isGenerator(() => {})).toBe(false);
    expect(util.isGenerator(null)).toBe(false);
    expect(util.isBaseTask(tasks)).toBe(true);
    expect(util.isBaseTask(null)).toBe(false);
    expect(util.isBaseTask({ $sequence() {} })).toBe(false);
    expect(util.isTaskObject({ task: 'build' })).toBe(true);
    expect(util.isTaskObject({ task: () => {} })).toBe(true);
    expect(util.isTaskObject({ task: 3 })).toBe(false);
    expect(util.isTaskObject({})).toBe(false);
    expect(util.isTaskObject(() => {})).toBe(false);
    expect(util.isTaskObject(null)).toBe(false);
  });

  it('deep-clones and deep-merges plain structures while preserving instances', () => {
    class Marker {}
    const marker = new Marker();
    const source = { nested: { list: [1, { value: 2 }] }, marker };
    const clone = util.deepClone(source);

    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
    expect(clone.nested).not.toBe(source.nested);
    expect(clone.nested.list).not.toBe(source.nested.list);
    expect(clone.marker).toBe(marker);
    expect(util.deepClone(null)).toBeNull();
    expect(util.deepClone(3)).toBe(3);
    expect(util.deepClone(marker)).toBe(marker);

    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
      value: 1
    });
    expect(util.deepClone(nullPrototype)).toEqual({ value: 1 });

    expect(
      util.deepMerge({ nested: { left: 1 }, keep: true } as Record<string, unknown>, undefined, {
        nested: { right: 2 },
        keep: undefined,
        added: 'yes'
      })
    ).toEqual({ nested: { left: 1, right: 2 }, keep: true, added: 'yes' });
    expect(
      util.deepMerge({ nested: 1 } as Record<string, unknown>, {
        nested: { replaced: true },
        ignored: undefined
      })
    ).toEqual({ nested: { replaced: true } });
  });

  it('applies verbose and silent configuration modes', () => {
    const logger = new TestLogger();
    const helpLogger = new TestLogger();
    const context = {
      name: 'ConfigTasks',
      logger,
      helpLogger,
      vLogger: {
        log(..._args: unknown[]) {},
        info(..._args: unknown[]) {}
      },
      _config: {}
    };

    util.processConfig({ verbose: true }, { logger, helpLogger }, context);
    context.vLogger.log('message');
    context.vLogger.info('details');
    expect(logger.messages()).toEqual(['[ConfigTasks] - message', '[ConfigTasks] - details']);

    util.processConfig({ silent: true }, { logger, helpLogger }, context);
    expect(context.logger).toBe(util.nullLogger);
    context.vLogger.log('ignored');
    context.vLogger.info('ignored');

    const directLogger = new TestLogger();
    const directHelpLogger = new TestLogger();
    util.processConfig(
      { logger: directLogger, helpLogger: directHelpLogger },
      { logger, helpLogger },
      context
    );
    expect(context.logger).toBe(directLogger);
    expect(context.helpLogger).toBe(directHelpLogger);
  });

  it('calculates time and memory differences with and without memory snapshots', () => {
    expect(
      util.calcStatsDiff(
        { time: 10, memory: { rss: 5, heapTotal: 6, heapUsed: 7 } },
        { time: 25, memory: { rss: 15, heapTotal: 18, heapUsed: 20 } }
      )
    ).toEqual({ time: 15, memory: { rss: 10, heapTotal: 12, heapUsed: 13 } });

    expect(util.calcStatsDiff({ time: 1 } as never, { time: 3 } as never)).toEqual({
      time: 2,
      memory: { rss: 0, heapTotal: 0, heapUsed: 0 }
    });
    expect(util.getStats()).toHaveProperty('memory.heapUsed');
  });
});

describe('template and singleton public helpers', () => {
  it('builds task objects from tagged and empty template inputs', () => {
    expect(TmplStrFunc.task`Build.run:${{ count: 2 }}`).toEqual({
      task: 'Build.run',
      vars: { count: 2 }
    });
    expect(TmplStrFunc.task([] as unknown as TemplateStringsArray)).toEqual({
      task: '',
      vars: undefined
    });
  });

  it('forwards singleton namespace methods to the current instance', async () => {
    const { config } = createTestConfig();
    const app = bz(config);
    const init = vi.spyOn(app, 'init').mockImplementation(() => {});
    const add = vi.spyOn(app, 'add').mockImplementation(() => {});
    const sequence = vi.spyOn(app, 'sequence').mockResolvedValue([]);
    const parallel = vi.spyOn(app, 'parallel').mockResolvedValue([]);
    const run = vi.spyOn(app, 'run').mockResolvedValue(undefined);
    const printHelp = vi.spyOn(app, 'printHelp').mockImplementation(() => {});

    bz.init(config);
    bz.add(BzTasks);
    await bz.sequence('one');
    await bz.parallel('two');
    await bz.run('three');
    bz.printHelp();

    expect(init).toHaveBeenCalledWith(config);
    expect(add).toHaveBeenCalledWith(BzTasks);
    expect(sequence).toHaveBeenCalledWith('one');
    expect(parallel).toHaveBeenCalledWith('two');
    expect(run).toHaveBeenCalledWith('three');
    expect(printHelp).toHaveBeenCalledOnce();
  });

  it('lazily creates an instance through a forwarded method', () => {
    const printHelp = vi.spyOn(Beelzebub.prototype, 'printHelp').mockImplementation(() => {});
    bz.delete();

    bz.printHelp();

    expect(printHelp).toHaveBeenCalledOnce();
    expect(bz()).toBeInstanceOf(Beelzebub);
  });
});
