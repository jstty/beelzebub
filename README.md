<!-- # Beelzebub - One hell of a task master! -->
<center id="top"><img src="./assets/bz-logo-full.png" /></center>

![License](https://img.shields.io/npm/l/beelzebub.svg)
[![npm version](https://img.shields.io/npm/v/beelzebub.svg)](https://www.npmjs.com/package/beelzebub)
[![Node.js Version](https://img.shields.io/node/v/beelzebub.svg)](https://nodejs.org)

## Description
A modern, fully-typed framework for replacing shell-script and package.json orchestration with
workflow components you can compose, reuse, observe, and test like application code.

Tasks are **Modular, Extendable, Testable, Manageable, and Fire Resistant!**

> **v2.0** is a ground-up TypeScript rewrite for Node.js 24+, with ESM and CommonJS entry points and TC39 standard decorators.

## What's New in v2.0

- **TypeScript-first** — full type definitions ship in the package
- **ESM + CommonJS** — native `import` and a callable `require('beelzebub')` compatibility entry
- **Node.js 24 LTS minimum** (`>=24.15.0`) — tested on Node 24 and Node 26
- **TypeScript 7** compilation, declarations, and strict checking
- **TC39 standard decorators** — no Babel and no `experimentalDecorators`
- **Legacy async/build dependencies removed** — native promises, streams, argument parsing, and ES2024 APIs replace `co`, `when`, `yargs`, Lodash, and related packages
- **Vitest 4** test suite (replaces Mocha/Chai)
- **Async/await tasks** are first-class. Generator tasks (`* task()` with `yield`) still supported for legacy compatibility, but no longer require `co`

### Breaking Changes from v1
- **Node.js 24.15+** required (was Node 6+)
- **Dual package entry points** — both `import bz from 'beelzebub'` and `const bz = require('beelzebub')` are supported
- **Decorators** use the TC39 standard signature. The `@defaultTask`, `@help('...')`, `@vars({...})` usage syntax is unchanged
- `Beelzebub.cli()` static helper removed — use `new BzCLI().run(opts)` or the `bz` binary
- `Beelzebub.Tasks` etc. are accessed via the singleton instance: `bz.Tasks`, `bz.InterfaceTasks`

## Features

1. **Testable workflow components** — create isolated instances with `bz.create()`, inject configuration and logging, run named tasks through the public API, and assert behavior in your existing test runner
2. **Promise-based tasks**, supporting:
    * `async`/`await` ([example](./examples/api/async.ts))
    * Generators ([example](./examples/api/async.ts))
    * Streams ([example](./examples/api/stream.ts)) — compatible with existing `gulp` tasks
3. **ES Class** base — extend other task classes ([example](./examples/api/extend.ts))
4. **Sub-tasks**
    * Static — add a task class as a sub-task ([example](./examples/api/subTasksSimple.ts))
    * Dynamic — created from configuration ([example](./examples/api/subTasksAdvanced.ts))
5. **Compose tasks**
    * Parallel ([example](./examples/api/parallel.ts))
    * Sequence ([example](./examples/api/sequence.ts))
6. **Before/After hooks** — per-task and all-tasks ([simple](./examples/api/beforeAfter.ts), [advanced](./examples/api/beforeAfterAdvanced.ts))
7. **Decorators** (TC39 standard)
    * `@defaultTask` ([example](./examples/api/decoratorHelp.ts))
    * `@help('...')` ([example](./examples/api/decoratorHelp.ts))
    * `@vars({ ... })` ([example](./examples/api/decoratorVars.ts))
8. **Auto-generated help docs** ([API](./examples/api/helpDocs.ts), [CLI](./examples/cli/helpDocs.ts))
9. **Variables / options** — pass per-task or globally ([API](./examples/api/passingVars.ts), [CLI](./examples/cli/defineVars.ts))
10. **CLI** ([examples](./examples/cli/helloworld.ts)) and **Programmatic API** ([examples](./examples/api/helloworld.ts))
11. **Totally bad-ass logo!**

---

# Install

## Requirements

- Node.js **>= 24.15.0**
- An ESM or CommonJS project

## API
```shell
npm install beelzebub
```

To try the unreleased 2.0 branch directly from GitHub:

```json
{
  "dependencies": {
    "beelzebub": "github:jstty/beelzebub#dev/v2.0"
  }
}
```

Git installs run the package's `prepare` lifecycle and build the untracked `dist/` output locally.

## CLI
```shell
npm install -g beelzebub
```

---

# Docs

- [Beelzebub website](https://beelzebub.io)
- [Examples](https://beelzebub.io/examples/)
- [API reference](https://beelzebub.io/api/)
- [Task Class](./docs/taskClass.md)
- [Interface Class](./docs/interfaceClass.md)
- [Migrating from v1](./MIGRATION.md)

---

# API

### [Examples](./examples/api/helloworld.ts)

## Simple Example

```ts
import bz from 'beelzebub';

class MyTasks extends bz.Tasks {
    task1() {
        this.logger.log('MyTasks task1');
    }
}

bz.add(MyTasks);
await bz.run('MyTasks.task1');
```

The same callable API is available to CommonJS projects:

```js
const bz = require('beelzebub');

class MyTasks extends bz.Tasks {
    task1() {
        this.logger.log('MyTasks task1');
    }
}

bz.add(MyTasks);
bz.run('MyTasks.task1').catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

## Decorator Example

```ts
import bz, { defaultTask, help, vars } from 'beelzebub';

class MyTasks extends bz.Tasks {
    @defaultTask
    @help('Builds the project')
    build() {
        this.logger.log('building...');
    }

    @help('Runs tests')
    @vars({ watch: { type: 'boolean', default: false } })
    test(opts: { watch: boolean }) {
        this.logger.log(`testing (watch=${opts.watch})`);
    }
}

bz.add(MyTasks);
await bz.run('MyTasks');           // runs the @defaultTask
await bz.run('MyTasks.test');
```

---

# CLI

### [Examples](./examples/cli/helloworld.ts)

## Reserved Global Flags
* `--help`, `-h` — print usage, task list, help docs and vars definitions
* `--version`, `-V` — print Beelzebub version
* `--file <path>`, `-f <path>` — load a file other than `beelzebub.js`/`beelzebub.ts`
* `--verbose`, `-v` — verbose logging

## Passing Vars
The CLI uses Node's native [`util.parseArgs`](https://nodejs.org/api/util.html#utilparseargsconfig) plus a small loose-parser for feature parity with the v1 yargs syntax (dotted keys, repeated flags, `--no-` prefix).

```shell
bz <global vars> TaskPath <vars for this task> AnotherTaskPath <vars for that task>
```

## Simple Example

### `beelzebub.ts`
```ts
import bz from 'beelzebub';

export default class MyTasks extends bz.Tasks {
    task() {
        this.logger.log('MyTasks task');
    }
}
```

```shell
bz MyTasks.task
```

## Vars Example

### `beelzebub.ts`
```ts
import bz from 'beelzebub';

class MyTasks1 extends bz.Tasks {
    default(aVars: { v1?: string }) {
        const gVars = this.$getGlobalVars();
        this.logger.log(`MyTasks1 default ${gVars.myGlobalVar} ${aVars.v1}`);
    }
}

class MyTasks2 extends bz.Tasks {
    task(aVars: { v1?: string }) {
        const gVars = this.$getGlobalVars();
        this.logger.log(`MyTasks2 task ${gVars.myGlobalVar} ${aVars.v1}`);
    }
}

export default [MyTasks1, MyTasks2];
```

```shell
bz --myGlobalVar=hello MyTasks1 --v1=1 MyTasks2.task --v1=2
```

## Load File Example

### `appTasks.ts`
```ts
import FrontendReact from 'bz-frontend-react';
import FrontendBabel from 'bz-frontend-babel';
import MyTask from './mytask.js';

export default [FrontendReact, FrontendBabel, MyTask];
```

```shell
bz --file ./appTasks.ts MyTasks.task1
```

> CLI files are loaded through dynamic `import()`. JavaScript task files run directly. For TypeScript task files, install `tsx` in the consuming project and register it with Node:
> ```shell
> node --import tsx ./node_modules/beelzebub/dist/bin/beelzebub.js --file ./beelzebub.ts MyTask
> ```

---

## Development

```shell
git clone https://github.com/jstty/beelzebub.git
cd beelzebub
npm ci
npm --prefix examples ci

npm run build       # tsc → dist/
npm run typecheck   # TypeScript 7 source + test checks
npm run lint        # eslint
npm run format      # prettier --write
npm test            # vitest run
npm run coverage    # instrument the focused unit suite
npm run test:package # pack, install, typecheck, and run the CLI
npm run audit       # root and example dependency audits
npm run check       # complete local release gate

# API docs (TypeDoc)
npm run docs:build   # one-off docs build into docs/site
npm run docs:serve   # serve docs locally at http://localhost:4173/site
npm run docs:dev     # watch + rebuild while serving locally

# Static website + generated API reference
npm run site:build   # generate website/dist
npm run site:dev     # build and serve at http://127.0.0.1:4174
npm run site:check   # build, validate local links, and check generated docs
npm run site:preview # publish a Firebase preview channel
```

Coverage is enforced at 90% for statements, branches, functions, and lines. The complete local release gate runs all tests, then instruments the focused unit suite and fails if any metric regresses below that floor. Example integration tests remain in `npm test`; they run source files through Node's separate TypeScript loader, which cannot be merged reliably into Vitest's V8 source maps.

The 2.0 product website lives in this repository under `website/` and deploys as a static site to the `beelzebub-io` Firebase project. See [`website/README.md`](./website/README.md) for the source, build, preview, and production-deployment layout.

TypeScript 7 does not yet expose the compiler API used by TypeDoc and typescript-eslint. Development therefore installs the official TypeScript 6 compatibility package alongside the TypeScript 7 compiler. Application and declaration compilation still use TypeScript 7.

---

## Special Thanks
To everyone supporting the development and cost to the project.
Logo by [Irving Gerardo](https://thenounproject.com/irvinggerardo)!

---

## License
*"I Beelzebub, declare myself to be under the [MIT licence](LICENSE)"*
