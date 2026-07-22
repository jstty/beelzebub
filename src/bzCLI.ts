import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { existsSync } from 'node:fs';

import { Beelzebub } from './beelzebub.js';
import * as util from './util.js';
import type { BeelzebubConfig, VarDef, VarDefMap } from './types.js';

const requireRel = createRequire(import.meta.url);
const manifest = requireRel('../package.json') as { version: string };

export interface CLIRunOptions {
  file?: string | undefined;
  cwd?: string | undefined;
  config?: BeelzebubConfig | undefined;
  args?: string[] | undefined;
}

interface OptionDef {
  alias?: string | undefined;
  describe?: string | undefined;
  type?: 'string' | 'boolean' | 'number';
  group?: string;
  default?: unknown;
}

type OptionMap = Record<string, OptionDef>;

interface ArgsObject {
  files: string[];
  rootOptions: string[];
  taskOptions: Record<string, string[]>;
}

const ROOT_OPTIONS: OptionMap = {
  version: {
    alias: 'V',
    describe: 'Show version number',
    type: 'boolean',
    group: 'Beelzebub Options:'
  },
  file: { alias: 'f', describe: 'Load a file', type: 'string', group: 'Beelzebub Options:' },
  verbose: {
    alias: 'v',
    describe: 'Enable verbose logging',
    type: 'boolean',
    group: 'Beelzebub Options:'
  },
  help: { alias: 'h', describe: 'print task help', type: 'boolean', group: 'Beelzebub Options:' }
};

/**
 * Beelzebub CLI driver. Replaces the legacy yargs-based implementation with a
 * `node:util.parseArgs` core plus a tiny help formatter that preserves the
 * yargs `group` UX.
 */
export class BzCLI {
  async run(options: CLIRunOptions = {}): Promise<Beelzebub | undefined> {
    const { file, cwd, config } = options;
    const args = options.args ?? process.argv.slice(2);
    let allTasks: unknown[] = [];

    const currentDir = cwd || process.cwd();
    const bz = new Beelzebub(config || { verbose: true });
    util.setInstance(bz);

    const argsObj = this._breakApartTasksVarsInArgs(args);

    // Parse root-level options.
    const rootParsed = this._safeParse(argsObj.rootOptions, ROOT_OPTIONS, true);

    if (rootParsed.values.version) {
      process.stdout.write(`${manifest.version}\n`);
      return undefined;
    }

    const showHelp = !!rootParsed.values.help;
    const loadFile = file || (rootParsed.values.file as string | undefined);

    if (loadFile) {
      allTasks = await this._loadFile(currentDir, allTasks, loadFile, true);
    } else if (Array.isArray(argsObj.files) && argsObj.files.length > 0) {
      for (const f of argsObj.files) {
        allTasks = await this._loadFile(currentDir, allTasks, f);
      }
    } else {
      // Try the conventional file locations.
      allTasks = await this._loadFile(currentDir, allTasks, './beelzebub.js');
      allTasks = await this._loadFile(currentDir, allTasks, './bz.js');
    }

    if (allTasks.length === 0) {
      if (!showHelp) {
        console.error('No Tasks Loaded');
        process.exitCode = 1;
        return undefined;
      }
      this._showRootHelp(ROOT_OPTIONS);
      return undefined;
    }

    for (const t of allTasks) bz.add(t);

    try {
      await bz.getInitPromise();
    } catch (e) {
      console.error(e);
      return undefined;
    }

    if (showHelp) {
      // Build a merged option map with task-level options for help display.
      const allOptions: OptionMap = { ...ROOT_OPTIONS };
      for (const taskName of Object.keys(argsObj.taskOptions)) {
        const varDefs = bz.getVarDefsForTaskName(taskName);
        if (varDefs) this._collectTaskOptions(taskName, varDefs, '', allOptions);
      }
      this._showRootHelp(allOptions);
      bz.printHelp();
      return bz;
    }

    const rootVars = this._convertRootCLIArgs(argsObj.rootOptions);
    bz.setGlobalVars(rootVars);

    const runTasks = this._convertCLIArgsToTasks(argsObj.taskOptions);
    try {
      const [first, ...rest] = runTasks;
      if (first !== undefined) await bz.run(first, ...(rest as unknown[]));
    } catch (e) {
      console.error(e);
    }
    return bz;
  }

  // ------------------------------------------------------------
  // arg splitting & loading

  protected _breakApartTasksVarsInArgs(args: string[]): ArgsObject {
    const argsObj: ArgsObject = {
      files: [],
      rootOptions: [],
      taskOptions: {}
    };
    let lastOptions: string[] = argsObj.rootOptions;

    for (const arg of args) {
      if (arg.startsWith('./')) {
        argsObj.files.push(arg);
      } else if (arg.startsWith('-')) {
        lastOptions.push(arg);
      } else {
        const task = arg;
        argsObj.taskOptions[task] = [];
        lastOptions = argsObj.taskOptions[task]!;
      }
    }
    return argsObj;
  }

  protected async _loadFile(
    currentDir: string,
    tasks: unknown[],
    file: string,
    displayError = false
  ): Promise<unknown[]> {
    try {
      file = file.trim();
      let resolved = file;
      if (!path.isAbsolute(resolved)) resolved = path.join(currentDir, resolved);

      if (!existsSync(resolved)) {
        if (displayError) console.error(`File (${resolved}) Load Error: not found`);
        return tasks;
      }

      // Prefer dynamic import (works for both ESM and CJS in Node 22+).
      let mod: unknown;
      try {
        mod = await import(pathToFileURL(resolved).href);
      } catch {
        // Fallback to createRequire for legacy CJS configs.
        mod = requireRel(resolved);
      }
      // Unwrap default export if present.
      if (mod && typeof mod === 'object' && 'default' in (mod as Record<string, unknown>)) {
        mod = (mod as Record<string, unknown>).default;
      }
      let fTasks: unknown[] = Array.isArray(mod) ? mod : [mod];
      fTasks = fTasks.filter((t) => t !== undefined && t !== null);
      if (fTasks.length === 0) {
        console.warn(`"${resolved}" needs to export a module`);
      } else {
        tasks = tasks.concat(fTasks);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
        console.error(err);
      } else if (displayError) {
        console.error(`File (${file}) Load Error:`, err);
      }
    }
    return tasks;
  }

  // ------------------------------------------------------------
  // arg parsing helpers (replaces yargs)

  protected _safeParse(
    args: string[],
    optionMap: OptionMap,
    allowPositionals: boolean
  ): ReturnType<typeof parseArgs> {
    const options: ParseArgsConfig['options'] = {};
    for (const [name, def] of Object.entries(optionMap)) {
      const opt: NonNullable<ParseArgsConfig['options']>[string] = {
        type: def.type === 'boolean' ? 'boolean' : 'string'
      };
      if (def.alias) opt.short = def.alias;
      if (def.default !== undefined) opt.default = def.default as never;
      options[name] = opt;
    }
    try {
      return parseArgs({ args, options, allowPositionals, strict: false, tokens: false });
    } catch (err) {
      console.error('Error:', (err as Error).message);
      this._showRootHelp(optionMap);
      process.exit(1);
    }
  }

  protected _convertRootCLIArgs(rootOptions: string[]): Record<string, unknown> {
    const parsed = this._safeParse(rootOptions, ROOT_OPTIONS, true);
    return structuredClone(parsed.values) as Record<string, unknown>;
  }

  /**
   * For each task block, parse its trailing flags loosely. We don't know the
   * full shape ahead of time (varDefs may not have been declared), so we
   * accept any `--key`, `--key=value`, `-k value`, dotted (`--a.b=v`), and
   * repeated (`--list=a --list=b`) syntax. This is a faithful port of the
   * yargs default behavior for `yargs(taskOption).argv`.
   */
  protected _convertCLIArgsToTasks(
    taskOptions: Record<string, string[]>
  ): Array<{ task: string; vars: Record<string, unknown> }> {
    const tasks: Array<{ task: string; vars: Record<string, unknown> }> = [];
    for (const [taskName, taskOption] of Object.entries(taskOptions)) {
      const task = { task: taskName, vars: {} as Record<string, unknown> };
      if (taskOption.length) {
        task.vars = this._looseParse(taskOption);
      }
      tasks.push(task);
    }
    return tasks;
  }

  /** Loose flag parser supporting yargs-style dotted keys, short flags, repeats, and coercion. */
  protected _looseParse(args: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i]!;
      if (a.startsWith('--')) {
        const body = a.slice(2);
        let key: string;
        let value: unknown;
        const eq = body.indexOf('=');
        if (eq >= 0) {
          key = body.slice(0, eq);
          value = coerce(body.slice(eq + 1));
        } else if (body.startsWith('no-')) {
          key = body.slice(3);
          value = false;
        } else {
          key = body;
          // Look ahead — if the next arg isn't a flag, consume it.
          const next = args[i + 1];
          if (next !== undefined && !next.startsWith('-')) {
            value = coerce(next);
            i++;
          } else {
            value = true;
          }
        }
        assignDotted(out, key, value);
      } else if (a.startsWith('-') && a.length > 1) {
        const body = a.slice(1);
        // Cluster of short bool flags (e.g. -vh) OR -kvalue OR -k value
        if (body.length === 1) {
          const next = args[i + 1];
          if (next !== undefined && !next.startsWith('-')) {
            assignDotted(out, body, coerce(next));
            i++;
          } else {
            assignDotted(out, body, true);
          }
        } else {
          // Treat as short=val or -kval
          // If first char matches a known short, consume rest as value.
          const first = body[0]!;
          const rest = body.slice(1);
          if (rest.startsWith('=')) {
            assignDotted(out, first, coerce(rest.slice(1)));
          } else {
            // Treat as cluster of booleans (yargs behavior).
            for (const ch of body) assignDotted(out, ch, true);
          }
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------
  // help formatting (replaces yargs.showHelp())

  protected _collectTaskOptions(
    taskName: string,
    varDefs: VarDefMap,
    prefix: string,
    into: OptionMap
  ): void {
    for (const [key, def] of Object.entries(varDefs)) {
      const v = def as VarDef;
      const type = (v.type || 'string').toLowerCase();
      if (type === 'object' && v.properties) {
        this._collectTaskOptions(taskName, v.properties, `${prefix}${key}.`, into);
        continue;
      }
      const fullKey = `${prefix}${key}`;
      into[fullKey] = {
        alias: v.alias,
        describe: v.describe,
        type: type === 'boolean' ? 'boolean' : type === 'number' ? 'number' : 'string',
        group: `${taskName} Options:`,
        default: v.default
      };
    }
  }

  protected _showRootHelp(options: OptionMap): void {
    const lines: string[] = [];
    lines.push(
      'bz [--file <filename> | default: beelzebub.js] [--verbose] [--help] <taskToRun [vars]>...'
    );
    lines.push('');

    // Group by `group`.
    const groups = new Map<string, Array<[string, OptionDef]>>();
    for (const [name, def] of Object.entries(options)) {
      const g = def.group || 'Options:';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push([name, def]);
    }

    for (const [group, entries] of groups) {
      lines.push(group);
      const formatted = entries.map(([name, def]) => {
        const flag = def.alias ? `-${def.alias}, --${name}` : `    --${name}`;
        return [flag, def.describe ?? ''];
      });
      const pad = Math.max(...formatted.map(([f]) => f!.length)) + 2;
      for (const [f, d] of formatted) {
        lines.push(`  ${f!.padEnd(pad)}${d}`);
      }
      lines.push('');
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  }
}

function coerce(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === '') return '';
  if (!Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function assignDotted(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.');
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    const next = cur[k];
    if (!next || typeof next !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  // Repeated keys collect into an array (yargs-compatible).
  if (Object.prototype.hasOwnProperty.call(cur, last)) {
    const prev = cur[last];
    if (Array.isArray(prev)) prev.push(value);
    else cur[last] = [prev, value];
  } else {
    cur[last] = value;
  }
}

export default BzCLI;
