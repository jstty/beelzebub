import type {
  BeelzebubConfig,
  LoggerLike,
  StatsDiff,
  StatsSnapshot,
  VLoggerLike
} from './types.js';

// internal singleton instance of beelzebub
// (typed loosely to avoid a circular type dependency on the Beelzebub class)
let beelzebubInst: unknown = null;

export const DefaultConfig: BeelzebubConfig = {
  verbose: false,
  silent: false,
  failureMode: 'throw',
  logger: null
};

const noop = () => {};

export const nullLogger: LoggerLike = {
  log: noop,
  warn: noop,
  info: noop,
  error: noop,
  trace: noop,
  clear: noop,
  count: noop,
  debug: noop,
  dir: noop,
  dirxml: noop,
  group: noop,
  groupCollapsed: noop,
  groupEnd: noop,
  profile: noop,
  profileEnd: noop,
  time: noop,
  timeEnd: noop,
  timeStamp: noop
};

/** Get the singleton Beelzebub instance, if any. */
export function getInstance<T = unknown>(): T | null {
  return beelzebubInst as T | null;
}

/** Set the singleton Beelzebub instance. */
export function setInstance<T>(inst: T | null): T | null {
  beelzebubInst = inst;
  return inst;
}

/** True when the value is a thenable (promise-like). */
export function isPromise(value: unknown): value is PromiseLike<unknown> {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/** True when the value is a Node-style readable/writable stream (has `.pipe`). */
export function isStream(value: unknown): value is NodeJS.ReadableStream | NodeJS.WritableStream {
  return (
    !!value && typeof value === 'object' && typeof (value as { pipe?: unknown }).pipe === 'function'
  );
}

/**
 * Generator-function detection. Retained for backwards compat with examples;
 * prefer async functions in new code.
 */
export function isGenerator(func: unknown): func is GeneratorFunction {
  return (
    typeof func === 'function' &&
    !!func.constructor &&
    (func as { constructor: { name: string } }).constructor.name === 'GeneratorFunction'
  );
}

/**
 * Duck-typed check for a BzTasks-like object. Cannot use `instanceof` because
 * a consumer may load Beelzebub from a different module copy.
 */
export function isBaseTask(a: unknown): boolean {
  if (!a || typeof a !== 'object') return false;
  const checkList = [
    '$sequence',
    '$parallel',
    '$run',
    '$setDefault',
    '$isRoot',
    '$useAsRoot',
    '$setName',
    '$getName',
    '$getTask',
    '$setSubTask',
    '$getSubTask'
  ];
  const obj = a as Record<string, unknown>;
  for (const key of checkList) {
    if (typeof obj[key] !== 'function') return false;
  }
  return true;
}

/** Task objects have a `task` key whose value is a string or function. */
export function isTaskObject(obj: unknown): obj is { task: string | TaskLikeFn; vars?: unknown } {
  if (!obj || typeof obj !== 'object') return false;
  const t = (obj as Record<string, unknown>).task;
  return typeof t === 'string' || typeof t === 'function';
}
type TaskLikeFn = (...args: unknown[]) => unknown;

/** Deep merge of plain objects. Replaces lodash `_.merge`. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Deep clone that preserves functions and class instances by reference (unlike structuredClone). */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as unknown as T;
  if (!isPlainObject(value)) return value; // keep functions, class instances, streams, etc. by reference
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return out as T;
}

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<T> | undefined>
): T {
  for (const src of sources) {
    if (!src) continue;
    for (const key of Object.keys(src)) {
      const srcVal = (src as Record<string, unknown>)[key];
      const tgtVal = (target as Record<string, unknown>)[key];
      if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
        (target as Record<string, unknown>)[key] = deepMerge({ ...tgtVal }, srcVal);
      } else if (srcVal !== undefined) {
        (target as Record<string, unknown>)[key] = srcVal;
      }
    }
  }
  return target;
}

interface ProcessConfigContext {
  name: string;
  logger: LoggerLike;
  helpLogger: LoggerLike;
  vLogger: VLoggerLike;
  _config: BeelzebubConfig;
}

/**
 * Mutates `context` to apply config, parent config, and the default config in
 * the correct precedence order. Mirrors the legacy behavior in lib/util.js.
 */
export function processConfig(
  config: BeelzebubConfig,
  parentConfig: BeelzebubConfig,
  context: ProcessConfigContext
): void {
  context.logger = (config.logger || parentConfig.logger) as LoggerLike;
  context.helpLogger = (config.helpLogger || parentConfig.helpLogger) as LoggerLike;

  context._config = deepMerge(
    deepClone(DefaultConfig) as BeelzebubConfig,
    deepClone(parentConfig) as BeelzebubConfig,
    config || {}
  );

  if (context._config.silent) {
    context.logger = nullLogger;
  }
  context._config.logger = context.logger;

  context.vLogger = { log: () => {}, info: () => {} };
  if (context._config.verbose) {
    context.vLogger = {
      log: (...args: unknown[]) => {
        context.logger.log(`[${context.name}] -`, ...args);
      },
      info: (...args: unknown[]) => {
        context.logger.info(`[${context.name}] -`, ...args);
      }
    };
  }
}

export function getStats(): StatsSnapshot {
  const hr = process.hrtime();
  return {
    time: hr[0] * 1e3 + hr[1] / 1e6,
    memory: process.memoryUsage()
  };
}

export function calcStatsDiff(start: StatsSnapshot, end: StatsSnapshot): StatsDiff {
  const memory = { heapTotal: 0, heapUsed: 0, rss: 0 };
  if (end.memory && start.memory) {
    memory.heapTotal = end.memory.heapTotal - start.memory.heapTotal;
    memory.heapUsed = end.memory.heapUsed - start.memory.heapUsed;
    memory.rss = end.memory.rss - start.memory.rss;
  }
  return { time: end.time - start.time, memory };
}
