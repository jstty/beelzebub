import { finished } from 'node:stream/promises';
import pc from 'picocolors';

import { BzTaskStats } from './bzStats.js';
import * as util from './util.js';
import type {
  BeelzebubConfig,
  LoggerLike,
  TaskFn,
  TaskInfo,
  TaskRecord,
  TaskTree,
  VLoggerLike,
  VarDef,
  VarDefMap,
  FlatTaskListEntry
} from './types.js';

interface NormalizedTask {
  task: string | TaskFn;
  vars?: Record<string, unknown> | string | undefined;
}

/**
 * Beelzebub Task base class. User task classes should `extend` this and provide
 * task methods. Methods that begin with `_` or `$` are excluded from the task
 * registry (the `$` prefix is reserved for framework-provided helpers).
 *
 * @example
 * ```ts
 * import bz, { BzTasks } from 'beelzebub';
 *
 * class MyTasks extends BzTasks {
 *   hello() { this.logger.log('hi'); }
 * }
 * bz().add(MyTasks);
 * ```
 */
export class BzTasks {
  beelzebub: any;
  name: string;
  version: string;
  namePath: string;
  logger!: LoggerLike;
  helpLogger!: LoggerLike;
  vLogger!: VLoggerLike;

  /** Set by the `@defaultTask` decorator. */
  $defaultTask?: string;
  /** Help docs by task name. Populated by the `@help` decorator. */
  $helpDocs?: Record<string, string>;
  /** Variable definitions by task name. Populated by the `@vars` decorator. */
  $varDefs?: Record<string, VarDefMap>;

  protected _hidden: boolean;
  protected _config!: BeelzebubConfig;
  protected _rootLevel = false;
  protected _defaultTaskFuncName: string | null = null;
  protected _tasks: Record<string, TaskRecord> = {};
  protected _subTasks: Record<string, BzTasks> = {};
  protected _running: Promise<unknown> | null = null;
  protected _beforeAllRun = false;
  protected _stats: BzTaskStats = new BzTaskStats();

  // Optional context-aware emit, attached during task execution.
  $emit!: (name: string, data?: unknown) => void;

  constructor(config: BeelzebubConfig = {}, hidden = false) {
    this._hidden = hidden;
    this.beelzebub = config.beelzebub || util.getInstance();

    this.name = config.name || this.constructor.name || 'BzTasks';
    util.processConfig(
      config,
      this.beelzebub?.getConfig?.() ?? {},
      this as unknown as {
        name: string;
        logger: LoggerLike;
        helpLogger: LoggerLike;
        vLogger: VLoggerLike;
        _config: BeelzebubConfig;
      }
    );
    this.version = (this.beelzebub?.version as string) ?? '';
    this.namePath = this._buildNamePath(config);
  }

  /** Build the dotted namespace path for this task class. */
  private _buildNamePath(config: BeelzebubConfig): string {
    let namePath = this.name;
    if (config.parentPath) namePath = `${config.parentPath}.${namePath}`;
    return namePath;
  }

  /** Get the task tree starting at this task. */
  $getTaskTree(): TaskTree {
    let tree: TaskTree = {
      name: this.name,
      tasks: this._tasks,
      stats: this._stats,
      subTasks: []
    };

    let i = 0;
    for (const task of Object.values(this.$getSubTasks())) {
      // hidden root: use first sub-task as the tree
      if (this._hidden && i === 0) {
        tree = task.$getTaskTree();
      } else {
        if (this._hidden) this.logger.warn('multi sub tasks in hidden task node not allowed');
        tree.subTasks.push(task.$getTaskTree());
      }
      i++;
    }

    return tree;
  }

  /** Flat list view of the task tree. */
  $getTaskFlatList(): FlatTaskListEntry[] {
    let list: FlatTaskListEntry[] = [];
    if (!this._hidden) {
      list.push({ name: this.name, tasks: this._tasks, stats: this._stats });
    }
    for (const task of Object.values(this.$getSubTasks())) {
      list = list.concat(task.$getTaskFlatList());
    }
    return list;
  }

  /** Stats summary for this task and all sub-tasks. */
  $getStatsSummary(parentSummary?: Parameters<BzTaskStats['getSummary']>[0]) {
    let summary = this._stats.getSummary(parentSummary);
    for (const task of Object.values(this.$getSubTasks())) {
      summary = task.$getStatsSummary(summary);
    }
    return summary;
  }

  /** Print help docs for this task and all sub-tasks. */
  $printHelp(): void {
    for (const task of Object.values(this.$getSubTasks())) {
      task.$printHelp();
    }

    if (this.$helpDocs) {
      this.beelzebub.drawBox(this.name);
      for (const [taskName, doc] of Object.entries(this.$helpDocs)) {
        this.helpLogger.log(pc.bold(pc.underline(taskName)));
        this.helpLogger.log('\t', doc, '\n');
      }
    }
  }

  $config(): BeelzebubConfig {
    return this._config;
  }

  /** Promote this task to root-level. */
  $useAsRoot(): void {
    this._rootLevel = true;
    this.name = '$root$';
  }

  $setDefault(taskFuncName: string): void {
    this._defaultTaskFuncName = taskFuncName;
  }

  $hasRunBefore(): boolean {
    return this._beforeAllRun;
  }

  $isRoot(): boolean {
    return this._rootLevel;
  }

  $setName(name: string): void {
    this.name = name;
  }

  $getName(): string {
    return this.name;
  }

  $getTask(name: string): TaskRecord | undefined {
    return this._tasks[name];
  }

  $hasTask(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._tasks, name);
  }

  $getSubTask(name: string): BzTasks | undefined {
    return this._subTasks[name];
  }

  $setSubTask(name: string, task: BzTasks): void {
    this._subTasks[name] = task;
  }

  $hasSubTask(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._subTasks, name);
  }

  $getSubTasks(): Record<string, BzTasks> {
    return this._subTasks;
  }

  $setSubTasks(tasks: Record<string, BzTasks>): void {
    this._subTasks = tasks;
  }

  $setGlobalVars(vars: Record<string, unknown>): void {
    this.beelzebub.setGlobalVars(vars);
  }

  $getGlobalVars(): Record<string, unknown> {
    return this.beelzebub.getGlobalVars();
  }

  $defineTaskVars(taskName: string, taskDef: VarDefMap): void {
    if (!this.$varDefs || typeof this.$varDefs !== 'object') this.$varDefs = {};
    this.$varDefs[taskName] = taskDef;
  }

  $setTaskHelpDocs(taskName: string, helpDocs: string): void {
    if (!this.$helpDocs || typeof this.$helpDocs !== 'object') this.$helpDocs = {};
    this.$helpDocs[taskName] = helpDocs;
  }

  /** Resolve var definitions for a dotted task path. */
  $getVarDefsForTaskName(taskStr: string): VarDefMap | null | undefined {
    const taskParts = taskStr.split('.');
    let taskName = taskParts.shift();
    if (!taskName || !taskName.length) taskName = 'default';

    if (this.$hasSubTask(taskName)) {
      return this.$getSubTask(taskName)!.$getVarDefsForTaskName(taskParts.join('.'));
    }
    if (this.$hasTask(taskName)) {
      if (!this.$varDefs || Object.keys(this.$varDefs).length === 0) return null;
      return this.$varDefs[taskName];
    }
    return undefined;
  }

  // -------- Lifecycle hooks (overridable) --------
  $init(): unknown {
    return null;
  }
  $beforeEach(_taskInfo: TaskInfo): unknown {
    return null;
  }
  $afterEach(_taskInfo: TaskInfo): unknown {
    return null;
  }
  $beforeAll(_taskInfo: TaskInfo): unknown {
    return null;
  }
  $afterAll(): unknown {
    return null;
  }

  $getRunning(): Promise<unknown> | null {
    return this._running;
  }

  /** Walk this class and its parents, registering task methods with the engine. */
  async $register(): Promise<unknown> {
    const tList: string[] = [];
    this._bfsTaskBuilder(tList, this);

    // Sync default-task set via the @defaultTask decorator.
    if (this.$defaultTask && !this._defaultTaskFuncName) {
      this._defaultTaskFuncName = this.$defaultTask;
    }

    // Run $init optimistically (it might or might not return a promise).
    const initPromise = this._normalizeExecFuncToPromise(this.$init, this);
    this._addTasks(tList, this);
    return initPromise;
  }

  // -------- Stats helpers --------
  protected _taskStatsStart(parent: BzTasks, taskName: string): number {
    let name = taskName;
    if (parent.name !== '$root$') name = `${this.namePath}.${taskName}`;
    this.logger.group(name);
    return this._stats.startTask();
  }

  protected _taskStatsEnd(parent: BzTasks, taskName: string, statsId: number): void {
    let name = taskName;
    if (parent.name !== '$root$') name = `${this.namePath}.${taskName}`;
    this._stats.endTask(statsId);
    const stats = this._stats.getTask(statsId);
    const time =
      stats?.diff && 'time' in stats.diff ? Number((stats.diff.time as number).toFixed(2)) : 0;
    this.logger.groupEnd(`${name} (${time} ms)`);
  }

  // -------- Before/After All --------
  protected async _runBeforeAll(taskInfo: TaskInfo): Promise<void> {
    await this._normalizeExecFuncToPromise(this.$beforeAll, this, taskInfo);
    this._beforeAllRun = true;
  }

  protected async _runAfterAll(): Promise<void> {
    // Sequentially run sub-tasks' afterAll, then our own.
    for (const task of Object.values(this.$getSubTasks())) {
      await task._runAfterAll();
    }
    await this._normalizeExecFuncToPromise(this.$afterAll, this);
  }

  // -------- Task registration --------
  protected _addTasks(tList: string[], task: BzTasks): void {
    for (const funcName of tList) {
      let taskId = '';
      if (this !== task && !this._rootLevel) taskId += `${task.name}.`;
      taskId += funcName;

      const fn = (task as unknown as Record<string, unknown>)[funcName] as TaskFn;
      if (funcName === this._defaultTaskFuncName && funcName !== 'default') {
        // Default tasks get registered twice — once under their real name,
        // once under "default".
        this._tasks[taskId] = { taskId, tasksObj: task, func: fn };
        taskId = 'default';
      }
      this._tasks[taskId] = { taskId, tasksObj: task, func: fn };
    }
  }

  /**
   * Add a sub-task class (or instance). Returns a promise that resolves once
   * the sub-task's own `$init` has run.
   */
  $addSubTasks(
    Task: BzTasks | (new (config: BeelzebubConfig) => BzTasks),
    config: BeelzebubConfig = {}
  ): Promise<unknown> | void {
    let task: BzTasks;
    if (typeof Task === 'function') {
      config.parentPath = this.namePath;
      config.beelzebub = this.beelzebub;
      task = new (Task as new (cfg: BeelzebubConfig) => BzTasks)(config);
    } else {
      task = Task;
    }

    if (!this.beelzebub.isLoading()) {
      return task.$register().then(() => {
        this.$setSubTask(task.$getName(), task);
      });
    }

    this.beelzebub.addInitFunction(() => task.$register());
    this.$setSubTask(task.$getName(), task);
    return Promise.resolve();
  }

  /**
   * Normalize anything (function / async function / generator / promise /
   * stream / value) into a Promise.
   */
  protected async _normalizeExecFuncToPromise(
    func: unknown,
    parent: unknown,
    ...args: unknown[]
  ): Promise<unknown> {
    let result: unknown = null;

    if (util.isPromise(func)) {
      result = await func;
    } else if (util.isGenerator(func)) {
      // Drive the generator to completion, awaiting each yielded value.
      // Replaces `co()`.
      result = await driveGenerator(func as GeneratorFunction, parent, args);
    } else if (typeof func === 'function') {
      result = (func as TaskFn).apply(parent, args);
      if (util.isPromise(result)) {
        result = await result;
      } else if (util.isStream(result)) {
        await finished(result as NodeJS.ReadableStream);
        result = undefined;
      }
    } else if (func !== undefined && func !== null) {
      this.logger.warn('other type?? func:', func, ', parent:', parent);
    }

    if (util.isStream(result)) {
      await finished(result as NodeJS.ReadableStream);
      return undefined;
    }
    return result;
  }

  /** BFS over the prototype chain to collect public method names. */
  protected _bfsTaskBuilder(outList: string[], task: object, name?: string): object {
    const proto = Object.getPrototypeOf(task);
    if (proto && typeof proto === 'object') {
      name = name || (task as { name?: string }).name;
      const oproto = this._bfsTaskBuilder(outList, proto, name);
      if (Object.getPrototypeOf(oproto) && oproto !== BzTasks.prototype) {
        const names = Object.getOwnPropertyNames(oproto).filter((p) => {
          const v = (task as Record<string, unknown>)[p];
          return typeof v === 'function' && p !== 'constructor' && p[0] !== '_' && p[0] !== '$';
        });
        for (const n of names) outList.push(n);
      }
    }
    return task;
  }

  // -------- Public run helpers (always bounce through Beelzebub) --------
  $sequence(...args: unknown[]): Promise<unknown> {
    return this.beelzebub.sequence(this, ...args);
  }

  $parallel(...args: unknown[]): Promise<unknown> {
    return this.beelzebub.parallel(this, ...args);
  }

  $run(...args: unknown[]): Promise<unknown> {
    return this.beelzebub.run(this, ...args);
  }

  // -------- Internal scheduling --------
  protected async _waitForInit(): Promise<unknown> {
    if (this.beelzebub.isLoading()) return this.beelzebub.getInitPromise();
    return undefined;
  }

  protected async _sequence(parent: unknown, ...args: unknown[]): Promise<unknown[]> {
    if (
      parent &&
      (typeof parent === 'string' || Array.isArray(parent) || util.isTaskObject(parent))
    ) {
      args.unshift(parent);
      parent = undefined;
    }

    await this._waitForInit();

    const tasks = this._normalizeTask(parent as BzTasks | undefined, args);
    const results: unknown[] = [];
    for (const t of tasks) {
      results.push(await this._runPromiseTask(parent as BzTasks | undefined, t));
    }
    return results;
  }

  protected async _parallel(parent: unknown, ...args: unknown[]): Promise<unknown[]> {
    if (
      parent &&
      (typeof parent === 'string' || Array.isArray(parent) || util.isTaskObject(parent))
    ) {
      args.unshift(parent);
      parent = undefined;
    }

    await this._waitForInit();
    const tasks = this._normalizeTask(parent as BzTasks | undefined, args);
    const pList = tasks.map((t) => this._runPromiseTask(parent as BzTasks | undefined, t));
    return Promise.all(pList);
  }

  protected async _run(parent: unknown, ...args: unknown[]): Promise<unknown> {
    if (Array.isArray(args) && args.length === 0) {
      if (this._rootLevel && this._defaultTaskFuncName && this._tasks[this._defaultTaskFuncName]) {
        args.push(this._defaultTaskFuncName);
      }
    }

    if (
      parent &&
      (typeof parent === 'string' || Array.isArray(parent) || util.isTaskObject(parent))
    ) {
      args.unshift(parent);
      parent = undefined;
    }

    await this._waitForInit();
    const tasks = this._normalizeTask(parent as BzTasks | undefined, args);

    let promise: Promise<unknown>;
    if (tasks.length === 1) {
      promise = Promise.resolve(this._runPromiseTask(parent as BzTasks | undefined, tasks[0]!));
    } else {
      promise = this._sequence(parent, ...(tasks as unknown[]));
    }

    this._running = promise.then((result) => {
      this._running = null;
      return result;
    });

    try {
      return await this._running;
    } catch (e) {
      this.logger.error(e);
      return undefined;
    }
  }

  // -------- Task dispatch --------
  protected async _runTask(task: NormalizedTask | undefined): Promise<unknown> {
    if (!task) task = { task: 'default' };

    const taskStr = task.task as string;
    const taskParts = taskStr.split('.');
    let taskName = taskParts.shift();
    if (!taskName || !taskName.length) taskName = 'default';

    if (this.$hasSubTask(taskName)) {
      const subTaskRef: NormalizedTask = { task: taskParts.join('.'), vars: task.vars };
      const sub = this.$getSubTask(taskName)!;

      if (!sub.$hasRunBefore()) {
        const taskInfo: TaskInfo = {
          task: taskParts[taskParts.length - 1] ?? '',
          vars: task.vars as Record<string, unknown> | undefined
        };
        await sub._runBeforeAll(taskInfo);
      }
      return sub._runTask(subTaskRef);
    }

    if (this.$hasTask(taskName)) {
      const taskObj = this.$getTask(taskName)!;
      return this._execTaskFun(
        taskName,
        taskObj.func,
        taskObj.tasksObj as BzTasks,
        task.vars as Record<string, unknown> | undefined
      );
    }

    this.logger.error(`Task "${taskName}" - not found`);
    return undefined;
  }

  protected _runBeforeEach(parent: BzTasks, taskInfo: TaskInfo): Promise<unknown> {
    return this._normalizeExecFuncToPromise(parent.$beforeEach, parent, taskInfo);
  }

  protected async _execTaskFun(
    taskName: string,
    func: TaskFn,
    parent: BzTasks,
    vars: Record<string, unknown> | undefined
  ): Promise<unknown> {
    const taskInfo: TaskInfo = { task: taskName, vars };

    let fullTaskName = taskName;
    if (parent && typeof parent.name === 'string' && parent.name !== '$root$') {
      fullTaskName = `${this.namePath}.${taskName}`;
    }

    if (!parent.$hasRunBefore()) {
      await parent._runBeforeAll(taskInfo);
    }
    await this._runBeforeEach(parent, taskInfo);

    this.beelzebub.emit('$before', { task: fullTaskName, vars: taskInfo.vars });
    const statsId = parent._taskStatsStart(parent, taskName);

    if (parent && typeof parent === 'object') {
      parent.$emit = (name: string, data?: unknown) => {
        this.beelzebub.emit(name, { task: fullTaskName, vars: taskInfo.vars }, data);
      };
    }

    await this._normalizeExecFuncToPromise(func, parent, vars);

    parent._taskStatsEnd(parent, taskName, statsId);
    await this._normalizeExecFuncToPromise(parent.$afterEach, parent, taskInfo);

    this.beelzebub.emit('$after', { task: fullTaskName, vars: taskInfo.vars });
    return undefined;
  }

  protected async _runPromiseTask(
    parent: BzTasks | undefined,
    task: NormalizedTask | NormalizedTask[]
  ): Promise<unknown> {
    if (Array.isArray(task)) {
      return this._parallel(parent, ...task);
    }

    if (task && typeof task === 'object') {
      if (typeof task.task === 'function') {
        return this._execTaskFun(
          'default',
          task.task as TaskFn,
          parent as BzTasks,
          task.vars as Record<string, unknown> | undefined
        );
      }
      if (typeof task.task === 'string') {
        const taskParts = task.task.split('.');
        const taskName = taskParts.shift() ?? 'default';

        if (!this.$hasTask(taskName)) {
          if (this.$hasSubTask(taskName)) {
            const subRef: NormalizedTask = { task: taskParts.join('.'), vars: task.vars };
            const sub = this.$getSubTask(taskName)!;

            if (!sub.$hasRunBefore()) {
              const taskInfo: TaskInfo = {
                task: taskParts[taskParts.length - 1] ?? '',
                vars: task.vars as Record<string, unknown> | undefined
              };
              await sub._runBeforeAll(taskInfo);
            }
            return sub._runTask(subRef);
          }
          const error = `task name not found: "${task.task}"`;
          this.logger.error(error);
          throw new Error(error);
        }

        if (taskParts.length > 0) {
          const subRef: NormalizedTask = { task: taskParts.join('.'), vars: task.vars };
          const sub = this.$getSubTask(taskName);
          if (sub) return sub._runTask(subRef);
        }

        const rec = this._tasks[taskName];
        if (rec) {
          return this._execTaskFun(
            taskName,
            rec.func,
            rec.tasksObj as BzTasks,
            task.vars as Record<string, unknown> | undefined
          );
        }
        const error = `task name not found: "${task.task}"`;
        this.logger.error(error);
        throw new Error(error);
      }

      const error = `invalid task name: "${String(task.task)}"`;
      this.logger.error(error);
      throw new Error(error);
    }

    const error = `task type not supported: "${String(task)}"`;
    this.logger.trace(error);
    throw new Error(error);
  }

  protected _normalizeTask(parent: BzTasks | undefined, tasks: unknown[]): NormalizedTask[] {
    const out: Array<NormalizedTask | NormalizedTask[] | null> = tasks.map(
      (task): NormalizedTask | NormalizedTask[] | null => {
        let taskObj: NormalizedTask;

        if (typeof task === 'string') {
          let s: string = task;
          if (s.charAt(0) === '.') {
            if (!parent) this.logger.trace('parent missing but expected');
            else s = parent.namePath + s;
          }

          const taskVarParts = s.split(':');
          const taskFullName = taskVarParts.shift() ?? s;
          let taskVars: Record<string, unknown> | string = {};

          if (taskVarParts.length > 0) {
            taskVars = taskVarParts.join(':');

            if (typeof taskVars === 'string' && taskVars.length === 0) {
              taskVars = {};
            } else if (typeof taskVars === 'string') {
              try {
                taskVars = JSON.parse(taskVars) as Record<string, unknown>;
              } catch (err) {
                this.vLogger.log('Parsing Task Error:', err);
              }
            }
          }

          const taskParts = taskFullName.split('.');
          const taskName = taskParts.shift() ?? '';

          if (!this.$getSubTask(taskName) && !this.$getTask(taskName)) {
            this.logger.warn(taskFullName, 'task not added');
            return null;
          }

          taskObj = { task: taskFullName, vars: taskVars };
        } else if (Array.isArray(task)) {
          return this._normalizeTask(parent, task);
        } else if (typeof task === 'function') {
          taskObj = { task: task as TaskFn };
        } else if (task && typeof task === 'object') {
          const o = task as Record<string, unknown>;
          if (!Object.prototype.hasOwnProperty.call(o, 'task')) {
            this.logger.warn('invalid object: task property required');
            return null;
          }
          if (typeof o.task === 'string' && (o.task as string).charAt(0) === '.') {
            if (!parent) this.logger.trace('parent missing but expected');
            else o.task = parent.namePath + (o.task as string);
          }
          return o as unknown as NormalizedTask;
        } else {
          this.logger.warn('unknown task input type');
          return null;
        }

        if (taskObj.vars === null || taskObj.vars === undefined) taskObj.vars = {};
        if (typeof taskObj.vars !== 'object') {
          this.logger.warn('Vars should be an object');
          taskObj.vars = {};
        }
        return taskObj;
      }
    );

    const filtered = out.filter(
      (t): t is NormalizedTask | NormalizedTask[] => t !== null && t !== undefined
    );
    return this._applyVarDefsToAllTasks(filtered as NormalizedTask[]);
  }

  protected _applyVarDefsToAllTasks(tasks: NormalizedTask[]): NormalizedTask[] {
    return tasks.map((t) => this._applyVarDefToTask(t));
  }

  protected _applyVarDefToTask(task: NormalizedTask | NormalizedTask[]): NormalizedTask {
    if (Array.isArray(task)) {
      return task.map((t) => this._applyVarDefToTask(t)) as unknown as NormalizedTask;
    }
    if (task && typeof task === 'object' && typeof task.task === 'string') {
      const taskParts = task.task.split('.');
      let taskName = taskParts.shift();
      if (!taskName || !taskName.length) taskName = 'default';

      if (this.$hasSubTask(taskName)) {
        const newTask: NormalizedTask = util.deepClone(task) as NormalizedTask;
        newTask.task = taskParts.join('.');
        const updated = this.$getSubTask(taskName)!._applyVarDefToTask(newTask);
        task.vars = updated.vars;
      } else if (this.$hasTask(taskName)) {
        if (!this.$varDefs || Object.keys(this.$varDefs).length === 0) return task;
        const vd = this.$varDefs[taskName];
        if (vd) {
          task.vars = this._applyVarDefs(vd, (task.vars as Record<string, unknown>) ?? {});
        }
      }
    }
    return task;
  }

  protected _applyVarDefs(
    varDefs: VarDefMap,
    vars: Record<string, unknown>
  ): Record<string, unknown> {
    for (const [key, varDef] of Object.entries(varDefs)) {
      const type = (varDef as VarDef).type.toLowerCase();

      if (varDef.alias) {
        const tkey = varDef.alias;
        if (vars[tkey] !== null && vars[tkey] !== undefined) {
          vars[key] = vars[tkey];
        }
      }

      if (vars[key] !== null && vars[key] !== undefined) {
        if (type === 'string') {
          if (typeof vars[key] !== 'string') {
            this.logger.error(`${key} is not a string but defined as one, converting to string`);
            vars[key] = String(vars[key]);
          }
        } else if (type === 'number') {
          if (typeof vars[key] !== 'number') {
            this.logger.error(`${key} is not a number but defined as one, converting to number`);
            vars[key] = Number(vars[key]);
          }
        } else if (type === 'boolean') {
          if (typeof vars[key] !== 'boolean') {
            this.logger.error(`${key} is not a boolean but defined as one, converting to boolean`);
            const v = vars[key];
            if (typeof v === 'string') vars[key] = v.toLowerCase() === 'true';
            else vars[key] = Boolean(v);
          }
        } else if (type === 'array') {
          if (!Array.isArray(vars[key])) {
            this.logger.error(`${key} is not a array but defined as one, converting to array`);
            const v = vars[key];
            if (typeof v === 'string') {
              try {
                vars[key] = JSON.parse(v);
              } catch {
                vars[key] = v.split(',');
              }
            } else {
              vars[key] = [v];
            }
          }
        } else if (type === 'object') {
          if (!vars[key] || typeof vars[key] !== 'object') {
            this.logger.error(`${key} is not a object but defined as one, converting to object`);
            const v = vars[key];
            if (typeof v === 'string') {
              try {
                vars[key] = JSON.parse(v);
              } catch (err) {
                this.logger.error(`object "${key}" json parsing error: ${String(err)}`);
                vars[key] = { data: v };
              }
            } else {
              vars[key] = { data: v };
            }
          }
          const varProps = (varDef as VarDef).properties;
          if (!varProps || typeof varProps !== 'object') {
            this.logger.error(
              `object "${key}" properties is not defined as object, skipping all sub properties.`
            );
          } else {
            vars[key] = this._applyVarDefs(varProps, vars[key] as Record<string, unknown>);
          }
        } else {
          this.logger.warn(`Unknown Variable Definition Type: ${type}`);
        }
      } else {
        if (varDef.required) {
          this.logger.error(`Var "${key}" is required but not set in vars.`);
        }
        let defValue: unknown = null;
        if (type === 'string') defValue = '';
        else if (type === 'number') defValue = 0;
        else if (type === 'boolean') defValue = false;
        else if (type === 'array') defValue = [];
        else if (type === 'object') defValue = {};

        if ((varDef as VarDef).default !== undefined) {
          vars[key] = (varDef as VarDef).default;
        } else {
          vars[key] = defValue;
        }
      }
    }
    return vars;
  }
}

/**
 * Drive a generator function as if it were async — `yield`ed promises are
 * awaited, their resolved value is sent back into the generator, and the
 * final return value is resolved. Replaces `co()`.
 */
async function driveGenerator(
  fn: GeneratorFunction,
  parent: unknown,
  args: unknown[]
): Promise<unknown> {
  const iter = (fn as unknown as (...a: unknown[]) => Generator<unknown, unknown, unknown>).apply(
    parent,
    args
  );
  let next = iter.next();
  let sent: unknown;
  while (!next.done) {
    const value = next.value;
    sent = util.isPromise(value) ? await value : value;
    next = iter.next(sent);
  }
  return next.value;
}

export default BzTasks;
