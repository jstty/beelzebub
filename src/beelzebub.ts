import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import Stumpy from 'stumpy';
import Table from 'cli-table3';

import { BzTasks } from './bzTasksClass.js';
import { InterfaceTasks } from './bzInterfaceClass.js';
import { BzTaskStats, BzSummaryStats } from './bzStats.js';
import * as util from './util.js';
import type {
  BeelzebubConfig,
  LoggerLike,
  TaskTree,
  VLoggerLike,
  VarDefMap,
  FlatTaskListEntry,
  EventCallback
} from './types.js';

const require = createRequire(import.meta.url);
const manifest = require('../package.json') as { version: string };

/** Format a millisecond duration as MM:SS.mmm. Replaces strftime. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

/**
 * Beelzebub task orchestrator — the top-level engine that owns the task
 * registry, runs tasks, and emits lifecycle events.
 */
export class Beelzebub {
  static readonly Tasks = BzTasks;
  static readonly InterfaceTasks = InterfaceTasks;

  // Made public on prototype for legacy access patterns; treat as readonly.
  readonly Tasks = BzTasks;
  readonly InterfaceTasks = InterfaceTasks;

  version: string;
  events!: EventEmitter;
  logger!: LoggerLike;
  helpLogger!: LoggerLike;
  vLogger!: VLoggerLike;
  name = '';

  protected _config!: BeelzebubConfig;
  protected _rootTasks!: BzTasks;
  protected _initFunctionList: Array<() => unknown> = [];
  protected _initDone = false;
  protected _tasksRunning = false;
  protected _globalVars: Record<string, unknown> = {};
  protected _stats!: BzTaskStats;

  constructor(config?: BeelzebubConfig) {
    this.version = manifest.version;
    this.reset();
    this.init(config);
    this.events = new EventEmitter();
  }

  init(config: BeelzebubConfig = util.DefaultConfig): void {
    if (!config.logger) {
      const stumpy = new Stumpy({
        dateStringFunc: (() => {
          const diffStats = this._stats.getCurrentDiffStats();
          return formatElapsed(diffStats.time);
        }) as unknown as () => string,
        group: {
          autoIndent: true,
          indent: {
            start: '└─┐',
            line: '  ├',
            end: '┌─┘',
            inner: '  ',
            split: '  ',
            join: '  '
          }
        }
      });
      config.logger = stumpy as unknown as LoggerLike;
    }

    if (!config.helpLogger) {
      const helpStumpy = new Stumpy('Help', {
        formatFunc: (log: { args: unknown }) => log.args
      });
      config.helpLogger = helpStumpy as unknown as LoggerLike;
    }

    util.processConfig(
      config,
      util.DefaultConfig,
      this as unknown as {
        name: string;
        logger: LoggerLike;
        helpLogger: LoggerLike;
        vLogger: VLoggerLike;
        _config: BeelzebubConfig;
      }
    );

    this._config.beelzebub = this;
    this._rootTasks = new BzTasks(this._config, true);
    this._rootTasks.$useAsRoot();
    this._stats = new BzTaskStats();
  }

  reset(): void {
    this.logger = console as unknown as LoggerLike;
    this.vLogger = { log: () => {}, info: () => {} };
    this.helpLogger = console as unknown as LoggerLike;

    this._config = util.deepClone(util.DefaultConfig) as BeelzebubConfig;
    this._rootTasks = null as unknown as BzTasks;
    this._initFunctionList = [];
    this._initDone = false;
    this._tasksRunning = false;
    this._globalVars = {};
  }

  getConfig(): BeelzebubConfig {
    return this._config;
  }

  setGlobalVars(vars: Record<string, unknown>): void {
    this._globalVars = vars;
  }

  getGlobalVars(): Record<string, unknown> {
    return this._globalVars;
  }

  isLoading(): boolean {
    return !this._initDone;
  }

  addInitFunction(func: () => unknown): void {
    this._initFunctionList.push(func);
  }

  /** Run every queued init function in order. Replaces `co.wrap` generator. */
  async getInitPromise(): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const fn of this._initFunctionList) {
      results.push(await fn());
    }
    this._initDone = true;
    return results;
  }

  getRunning(): Promise<unknown> | null {
    return this._rootTasks.$getRunning();
  }

  getVarDefsForTaskName(taskName: string): VarDefMap | null | undefined {
    return this._rootTasks.$getVarDefsForTaskName(taskName);
  }

  /**
   * Subscribe to a task lifecycle event.
   * @param name - event name (`$before`, `$after`, or user event)
   * @param filter - optional task name filter
   * @param callback - listener
   */
  on(
    name: string | { name: string; task?: string; callback: EventCallback },
    filter?: string | EventCallback,
    callback?: EventCallback
  ): void {
    if (name && typeof name === 'object') {
      const eventInfo = name;
      callback = eventInfo.callback;
      filter = eventInfo.task;
      name = eventInfo.name;
    }

    if (typeof filter === 'function') {
      callback = filter as EventCallback;
      filter = undefined;
    }

    const cb = callback;
    if (!cb) return;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const bzThis = this;
    const filterStr = typeof filter === 'string' ? filter : undefined;

    this.events.on(name as string, (taskInfo: { task?: string }, data: unknown) => {
      if (filterStr) {
        if (taskInfo?.task === filterStr) cb.call(bzThis, taskInfo, data);
      } else {
        cb.call(bzThis, taskInfo, data);
      }
    });
  }

  emit(name: string, taskInfo?: unknown, data?: unknown): void {
    this.events.emit(name, taskInfo, data);
  }

  add(Tasks: unknown, config?: BeelzebubConfig): Promise<unknown> | void {
    let tasks: BzTasks | null = null;
    let resolvedTasks = Tasks;

    if (typeof resolvedTasks === 'string') {
      try {
        // dynamic require for legacy module-by-path API
        resolvedTasks = require(resolvedTasks);
      } catch (err) {
        this.logger.error('Add Task Error:', err);
        return;
      }
    }

    if (typeof resolvedTasks === 'function') {
      const merged: BeelzebubConfig = util.deepMerge(
        { ...this._config } as BeelzebubConfig,
        config
      );
      merged.beelzebub = this;
      const Ctor = resolvedTasks as new (cfg: BeelzebubConfig) => BzTasks;
      tasks = new Ctor(merged);

      if (!util.isBaseTask(tasks)) {
        this.logger.error(
          'Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BzTasks" -',
          tasks
        );
        return;
      }
    } else if (
      resolvedTasks &&
      typeof resolvedTasks === 'object' &&
      util.isBaseTask(resolvedTasks)
    ) {
      tasks = resolvedTasks as BzTasks;
    } else {
      this.logger.error('Add Task Error: Unknown Task type -', tasks);
      return;
    }

    if (tasks!.$isRoot()) {
      // Transfer current sub-tasks from old root to the new one.
      tasks!.$setSubTasks(this._rootTasks.$getSubTasks());
      this._rootTasks = tasks!;
      return tasks!.$register();
    }
    this._rootTasks.$addSubTasks(tasks!, config);
  }

  async run(parent?: unknown, ...args: unknown[]): Promise<unknown> {
    let entryPoint = false;
    if (!this._tasksRunning) {
      entryPoint = true;
      this._tasksRunning = true;
      this._stats.start();
    }

    args.unshift(parent);
    // The root tasks are always hidden, so call the internal `_run` directly.
    const result = await (
      this._rootTasks as unknown as { _run: (...a: unknown[]) => Promise<unknown> }
    )._run(...args);

    if (entryPoint) {
      await (this._rootTasks as unknown as { _runAfterAll: () => Promise<unknown> })._runAfterAll();
      this._stats.end();
      this._printSummary();
    }
    return result;
  }

  sequence(parent: unknown, ...args: unknown[]): Promise<unknown> {
    args.unshift(parent);
    return (
      this._rootTasks as unknown as { _sequence: (...a: unknown[]) => Promise<unknown> }
    )._sequence(...args);
  }

  parallel(parent: unknown, ...args: unknown[]): Promise<unknown> {
    args.unshift(parent);
    return (
      this._rootTasks as unknown as { _parallel: (...a: unknown[]) => Promise<unknown> }
    )._parallel(...args);
  }

  printHelp(): void {
    this.drawBox('Help Docs');
    this._rootTasks.$printHelp();
  }

  $getTaskTree(): TaskTree {
    return this._rootTasks.$getTaskTree();
  }

  $getTaskFlatList(): FlatTaskListEntry[] {
    return this._rootTasks.$getTaskFlatList();
  }

  protected _printSummary(): void {
    this.drawBox('Summary');
    const appTotal = this._stats.getCurrentDiffStats();
    const summary = new BzSummaryStats();
    summary.add(this.$getTaskFlatList());

    const timeStats = summary.getTimeStats();
    const totalTasks = summary.getTotalTasks();

    const table = new Table({
      chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: ' '
      },
      style: { 'padding-left': 0, 'padding-right': 0 }
    });

    table.push(
      [
        'Tasks',
        'Total:',
        { hAlign: 'left', content: `${totalTasks},` },
        `Per: ${(appTotal.time === 0 ? 0 : (1000 * totalTasks) / appTotal.time).toFixed(2)} sec`
      ],
      [
        'Time',
        'Total:',
        `${timeStats.total.toFixed(2)} ms,`,
        `Avg: ${timeStats.avg.toFixed(2)} ms,`,
        `Min: ${timeStats.min.toFixed(2)} ms,`,
        `Max: ${timeStats.max.toFixed(2)} ms`
      ]
    );

    this.helpLogger.log(table.toString());
  }

  drawBox(title: string, width = 80): void {
    const header = new Table({ colWidths: [width] });
    header.push([{ hAlign: 'left', content: title }]);
    this.helpLogger.log(header.toString());
  }
}

export default Beelzebub;
