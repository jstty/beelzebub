/// <reference types="node" preserve="true" />

import { Beelzebub } from './beelzebub.js';
import { BzCLI } from './bzCLI.js';
import { BzTasks } from './bzTasksClass.js';
import { InterfaceTasks } from './bzInterfaceClass.js';
import * as decoratorsImpl from './decorators.js';
import { TmplStrFunc } from './tmplStrFunc.js';
import * as util from './util.js';
import type { BeelzebubConfig } from './types.js';

export { Beelzebub, BzCLI, BzTasks, InterfaceTasks, TmplStrFunc };
export type { CLIRunOptions } from './bzCLI.js';
export * from './types.js';
export const { defaultTask, help, vars } = decoratorsImpl;
export const decorators = { defaultTask, help, vars };

/**
 * Singleton factory + namespace. Calling `bz()` returns the (lazily
 * initialized) global Beelzebub instance.
 *
 * Methods like `bz.add`, `bz.run`, etc. delegate to that instance.
 */
export interface BeelzebubModule {
  (config?: BeelzebubConfig): Beelzebub;
  delete(): void;
  create(config?: BeelzebubConfig): Beelzebub;
  init(...args: Parameters<Beelzebub['init']>): ReturnType<Beelzebub['init']>;
  add(...args: Parameters<Beelzebub['add']>): ReturnType<Beelzebub['add']>;
  sequence(...args: Parameters<Beelzebub['sequence']>): ReturnType<Beelzebub['sequence']>;
  parallel(...args: Parameters<Beelzebub['parallel']>): ReturnType<Beelzebub['parallel']>;
  run(...args: Parameters<Beelzebub['run']>): ReturnType<Beelzebub['run']>;
  printHelp(...args: Parameters<Beelzebub['printHelp']>): ReturnType<Beelzebub['printHelp']>;

  CLI: typeof BzCLI;
  Tasks: typeof BzTasks;
  InterfaceTasks: typeof InterfaceTasks;
  TmplStrFunc: typeof TmplStrFunc;
  decorators: {
    defaultTask: typeof decoratorsImpl.defaultTask;
    help: typeof decoratorsImpl.help;
    vars: typeof decoratorsImpl.vars;
  };
}

const factory = ((config?: BeelzebubConfig): Beelzebub => {
  if (!util.getInstance()) {
    util.setInstance(new Beelzebub(config));
  }
  return util.getInstance() as Beelzebub;
}) as BeelzebubModule;

factory.delete = () => {
  util.setInstance(null);
};

factory.create = (config?: BeelzebubConfig) => new Beelzebub(config);

function bind<K extends 'init' | 'add' | 'sequence' | 'parallel' | 'run' | 'printHelp'>(name: K) {
  (factory as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
    if (!util.getInstance()) util.setInstance(new Beelzebub());
    const inst = util.getInstance() as unknown as Record<string, (...a: unknown[]) => unknown>;
    return inst[name]!(...args);
  };
}

bind('init');
bind('add');
bind('sequence');
bind('parallel');
bind('run');
bind('printHelp');

factory.CLI = BzCLI;
factory.Tasks = BzTasks;
factory.InterfaceTasks = InterfaceTasks;
factory.TmplStrFunc = TmplStrFunc;
factory.decorators = decoratorsImpl;

export default factory;
