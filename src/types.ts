/**
 * Public types & interfaces for Beelzebub.
 */

import type { CommandRunner } from './commandRunner.js';
import type { WorkflowRuntime } from './workflow.js';

export interface LoggerLike {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  trace(...args: unknown[]): void;

  clear?(...args: unknown[]): void;
  count?(...args: unknown[]): void;
  debug?(...args: unknown[]): void;
  dir?(...args: unknown[]): void;
  dirxml?(...args: unknown[]): void;
  group(...args: unknown[]): void;
  groupCollapsed?(...args: unknown[]): void;
  groupEnd(...args: unknown[]): void;
  profile?(...args: unknown[]): void;
  profileEnd?(...args: unknown[]): void;
  time?(...args: unknown[]): void;
  timeEnd?(...args: unknown[]): void;
  timeStamp?(...args: unknown[]): void;
}

export interface VLoggerLike {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
}

export interface BeelzebubConfig {
  verbose?: boolean;
  silent?: boolean;
  /**
   * How public task entry points handle failures. CI-safe `throw` is the v2
   * default. `log` is retained as an explicit compatibility mode for callers
   * that relied on the v1 behavior.
   */
  failureMode?: 'throw' | 'log';
  /** Injectable process runner used by task `$exec()` calls. */
  commandRunner?: CommandRunner;
  /** Injectable local or hosted workflow runtime. */
  workflow?: WorkflowRuntime;
  logger?: LoggerLike | null;
  helpLogger?: LoggerLike | null;
  /** Internal: parent path for sub-tasks. */
  parentPath?: string;
  /** Internal: back-reference to the Beelzebub instance. */
  beelzebub?: unknown;
  /** Internal: explicit name override. */
  name?: string;
  [key: string]: unknown;
}

export interface VarDef {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | string;
  alias?: string;
  default?: unknown;
  required?: boolean;
  describe?: string;
  properties?: Record<string, VarDef>;
  items?: VarDef;
}

export type VarDefMap = Record<string, VarDef>;

export interface TaskInfo {
  task: string;
  vars?: Record<string, unknown> | undefined;
}

export type TaskOutcome = 'success' | 'failure' | 'skipped' | 'cancelled';

export interface TaskExecution<T = unknown> {
  task: string;
  outcome: TaskOutcome;
  conclusion: TaskOutcome;
  value?: T;
  error?: Error;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export type EventCallback = (taskInfo: unknown, data?: unknown) => void;

export type TaskFn = (...args: unknown[]) => unknown;

export interface TaskRecord {
  taskId: string;
  tasksObj: unknown;
  func: TaskFn;
}

/** Runtime memory counters captured while a task is executing. */
export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external?: number;
  arrayBuffers?: number;
}

export interface StatsSnapshot {
  time: number;
  memory: MemoryUsage;
}

export interface StatsDiff {
  time: number;
  memory: { heapTotal: number; heapUsed: number; rss: number };
}

export interface TaskRunStats {
  start: StatsSnapshot | Record<string, never>;
  end: StatsSnapshot | Record<string, never>;
  diff: StatsDiff | Record<string, never>;
}

export interface TaskTree {
  name: string;
  tasks: Record<string, TaskRecord>;
  stats: unknown;
  subTasks: TaskTree[];
}

export interface FlatTaskListEntry {
  name: string;
  tasks: Record<string, TaskRecord>;
  stats: unknown;
}
