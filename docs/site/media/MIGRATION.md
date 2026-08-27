# Migrating from Beelzebub 1.x to 2.0

Beelzebub 2.0 is a breaking modernization release. It replaces the Babel implementation with typed modern JavaScript, ships ESM and CommonJS entry points, and raises the runtime baseline to Node.js 24.15.

## Runtime and installation

- Upgrade Node.js to 24.15 or newer. CI should also test Node 26.
- Use npm 12 when contributing to Beelzebub itself.
- Existing CommonJS consumers can continue to use the callable `require('beelzebub')` API.
- ESM consumers can use the native default and named exports.

CommonJS:

```js
const bz = require('beelzebub');
```

ESM:

```ts
import bz from 'beelzebub';
```

Both forms resolve to the same singleton facade. The CommonJS entry also exposes named exports as properties, such as `bz.BzTasks` and `bz.BzCLI`.

## API changes

The default export remains a callable singleton facade:

```ts
import bz from 'beelzebub';

class Tasks extends bz.Tasks {
  build(): void {}
}

bz.add(Tasks);
await bz.run('Tasks.build');
```

Use `bz.create(config)` for an independent instance. Use `bz.delete()` to reset the singleton in tests.

The old `Beelzebub.cli()` helper has been removed. Use the `bz` binary or `new BzCLI().run(options)`.

## Decorators

Decorator syntax is unchanged, but the implementation now uses TC39 standard decorators rather than Babel's legacy descriptor signature.

```ts
import { BzTasks, defaultTask, help, vars } from 'beelzebub';

class Tasks extends BzTasks {
  @defaultTask
  @help('Build the project')
  @vars({ watch: { type: 'boolean', default: false } })
  build(options: { watch: boolean }): void {}
}
```

Do not enable `experimentalDecorators`. Custom v1 decorators written as `(target, property, descriptor)` must be rewritten to the standard `(value, context)` signature.

## Async behavior

Promises, `async` functions, generators, and Node streams are supported. Internally, `co`, `when`, and `stream-to-promise` have been replaced with native APIs.

New task code should migrate generator control flow to `async`/`await`:

```diff
- *build() {
-   yield compile();
- }
+ async build() {
+   await compile();
+ }
```

Generator tasks continue to run for compatibility.

## CLI task files

ESM and CommonJS JavaScript task files load through Node's module system. To load `.ts` task files containing types or decorators, install `tsx` in the consuming project and register it with Node:

```sh
node --import tsx ./node_modules/beelzebub/dist/bin/beelzebub.js \
  --file ./beelzebub.ts BuildTasks.build
```

The CLI now uses `node:util.parseArgs`. Dotted variables, repeated options, numeric/boolean coercion, aliases, and `--no-` booleans remain supported.

## TypeScript configuration

A compatible consumer configuration is:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true
  }
}
```

Beelzebub ships JavaScript, source maps, declarations, and declaration maps. Consumers do not compile Beelzebub's source.

## Removed 1.x infrastructure

- Babel and legacy decorator transforms
- `Beelzebub.cli()`
- Mocha, Chai, Istanbul, and Coveralls project tooling
- Lodash, `co`, `when`, `yargs`, `strftime`, and `stream-to-promise`
- Generated legacy `lib/`, `bin/`, and `legacy/` trees

## Migration checklist

1. Upgrade Node to 24.15 or newer.
2. Choose the ESM or CommonJS package entry point that fits the consuming project.
3. Update custom decorators to the standard decorator API.
4. Replace `Beelzebub.cli()` calls.
5. Compile TypeScript task files or run the CLI with a TypeScript loader.
6. Run the existing task suite and compare hook, CLI-variable, and stream behavior.
