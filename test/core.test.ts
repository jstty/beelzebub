import { afterEach, describe, expect, it } from 'vitest';

import bz, { BzTasks, type LoggerLike } from '../src/index.js';

class MemoryLogger implements LoggerLike {
  readonly messages: string[] = [];

  private record(args: unknown[]): void {
    this.messages.push(args.map(String).join(' '));
  }

  log(...args: unknown[]): void {
    this.record(args);
  }

  warn(...args: unknown[]): void {
    this.record(args);
  }

  info(...args: unknown[]): void {
    this.record(args);
  }

  error(...args: unknown[]): void {
    this.record(args);
  }

  trace(...args: unknown[]): void {
    this.record(args);
  }

  group(...args: unknown[]): void {
    this.record(args);
  }

  groupEnd(...args: unknown[]): void {
    this.record(args);
  }
}

afterEach(() => {
  bz.delete();
});

describe('public API', () => {
  it('creates, registers, and executes typed task classes', async () => {
    const logger = new MemoryLogger();
    const app = bz({ logger, helpLogger: logger });
    const lifecycle: string[] = [];

    class DirectTasks extends BzTasks {
      first(): void {
        this.logger.log('first');
      }

      async second(): Promise<void> {
        await Promise.resolve();
        this.logger.log('second');
      }

      *generator(): Generator<Promise<void>, void, unknown> {
        yield Promise.resolve();
        this.logger.log('generator');
      }
    }

    app.on('$before', (taskInfo) => {
      lifecycle.push((taskInfo as { task: string }).task);
    });
    app.add(DirectTasks);
    await app.getInitPromise();
    await app.run('DirectTasks.first', 'DirectTasks.second', 'DirectTasks.generator');

    expect(logger.messages).toContain('first');
    expect(logger.messages).toContain('second');
    expect(logger.messages).toContain('generator');
    expect(lifecycle).toEqual(['DirectTasks.first', 'DirectTasks.second', 'DirectTasks.generator']);
  });

  it('resets the singleton without affecting explicitly created instances', () => {
    const first = bz();
    const explicit = bz.create();

    bz.delete();
    const second = bz();

    expect(second).not.toBe(first);
    expect(explicit).not.toBe(first);
    expect(explicit).not.toBe(second);
  });
});
