import type { BeelzebubConfig, LoggerLike } from '../src/index.js';

export interface LogEntry {
  level: 'log' | 'warn' | 'info' | 'error' | 'trace' | 'group' | 'groupEnd';
  args: unknown[];
}

export class TestLogger implements LoggerLike {
  readonly entries: LogEntry[] = [];

  private record(level: LogEntry['level'], args: unknown[]): void {
    this.entries.push({ level, args });
  }

  log(...args: unknown[]): void {
    this.record('log', args);
  }

  warn(...args: unknown[]): void {
    this.record('warn', args);
  }

  info(...args: unknown[]): void {
    this.record('info', args);
  }

  error(...args: unknown[]): void {
    this.record('error', args);
  }

  trace(...args: unknown[]): void {
    this.record('trace', args);
  }

  group(...args: unknown[]): void {
    this.record('group', args);
  }

  groupEnd(...args: unknown[]): void {
    this.record('groupEnd', args);
  }

  messages(level?: LogEntry['level']): string[] {
    return this.entries
      .filter((entry) => level === undefined || entry.level === level)
      .map((entry) => entry.args.map(String).join(' '));
  }
}

export function createTestConfig(overrides: BeelzebubConfig = {}): {
  config: BeelzebubConfig;
  logger: TestLogger;
  helpLogger: TestLogger;
} {
  const logger = new TestLogger();
  const helpLogger = new TestLogger();
  return {
    config: { logger, helpLogger, ...overrides },
    logger,
    helpLogger
  };
}
