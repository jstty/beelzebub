# Beelzebub 2.0 migration guide for coding agents

Use this document as the migration contract when updating an existing project from Beelzebub 1.x to 2.0. Preserve the project's behavior and conventions. Keep changes focused on the migration, do not discard unrelated work, and do not use destructive Git commands.

## Objective

Upgrade the project to Beelzebub 2.0 and Node.js 24.15 or newer, migrate affected APIs and task-loading behavior, update project documentation, and leave the project with its full validation suite passing.

The migration is not complete merely because the dependency installs. Representative Beelzebub tasks must run successfully through every interface the project uses.

## 1. Discover the existing integration

Before editing files, inspect and record:

- The package manager and lockfile.
- The current Beelzebub version and every dependency declaration that references it.
- Node.js versions in `package.json`, version-manager files, CI workflows, containers, deployment configuration, and contributor documentation.
- Whether the project uses ESM, CommonJS, or both.
- Every Beelzebub task file and how each file is loaded.
- npm scripts, shell scripts, CI steps, and application code that invoke `bz`, `beelzebub`, or `Beelzebub.cli()`.
- Task base classes, singleton usage, isolated instances, hooks, streams, generators, variables, aliases, and decorators.
- Custom decorators that use the legacy `(target, property, descriptor)` signature.
- The project's format, lint, typecheck, test, build, packaging, and end-to-end commands.

Run the existing validation before migration when practical. Record failures that already exist; do not attribute them to the upgrade.

## 2. Upgrade the runtime and package

1. Set the Node.js baseline to **24.15.0 or newer** everywhere the project declares or provisions Node.
2. Update Beelzebub with the project's package manager. For a published release, use `beelzebub@^2`.
3. Update and retain the project's lockfile.
4. Do not copy Beelzebub source into the consuming project. The package ships JavaScript, source maps, declarations, and declaration maps.

For a temporary evaluation of the unreleased development branch, npm projects can use:

```json
{
  "dependencies": {
    "beelzebub": "github:jstty/beelzebub#dev/v2.0"
  }
}
```

Replace that Git reference with `beelzebub@^2` when 2.0 is published.

## 3. Choose the matching module entry point

Keep the project's existing module format unless the migration explicitly includes a module conversion.

CommonJS:

```js
const bz = require('beelzebub');
```

ESM:

```ts
import bz from 'beelzebub';
```

Both forms resolve to the callable singleton facade. Named exports are available in ESM, and the CommonJS facade exposes exports such as `bz.BzTasks` and `bz.BzCLI` as properties.

## 4. Apply the 2.0 API changes

- Replace removed `Beelzebub.cli()` calls with the `bz` binary or `new BzCLI().run(options)`.
- Existing singleton-oriented task code can use the default `bz` facade.
- Use `bz.create(config)` only when the project needs an independent Beelzebub instance.
- Tests that mutate the singleton can call `bz.delete()` between cases.
- Keep existing task names, dependency order, hooks, variable behavior, and externally consumed commands stable unless a breaking project change is explicitly requested.

Example:

```ts
import bz from 'beelzebub';

class BuildTasks extends bz.Tasks {
  async build(): Promise<void> {
    await compile();
  }
}

bz.add(BuildTasks);
await bz.run('BuildTasks.build');
```

## 5. Migrate decorators and TypeScript configuration

Built-in `@defaultTask`, `@help`, and `@vars` usage remains familiar, but Beelzebub 2.0 uses TC39 standard decorators.

- Do not enable `experimentalDecorators` for Beelzebub 2.0.
- Rewrite custom legacy decorators from `(target, property, descriptor)` to the standard `(value, context)` API.
- Preserve each decorator's observable behavior and add or update focused tests for custom decorators.

A compatible baseline configuration is:

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

Adapt this to the project's build system rather than replacing a working configuration wholesale.

## 6. Update task control flow and CLI loading

Promises, async functions, generators, and Node streams are supported. Existing generator tasks can remain during migration, but prefer `async`/`await` for new or substantially edited task code.

JavaScript task files load through Node's module system. If a CLI task file contains TypeScript syntax or decorators, install `tsx` in the consuming project and register it with Node:

```sh
node --import tsx ./node_modules/beelzebub/dist/bin/beelzebub.js \
  --file ./beelzebub.ts BuildTasks.build
```

Update every npm script, shell script, CI job, and document that invokes the old task-file command.

## 7. Verify the migration

Use the project's own commands and package manager. At minimum:

1. Perform a clean dependency install from the lockfile.
2. Run formatting checks, linting, typechecking, unit tests, integration tests, build, and package validation when those commands exist.
3. Run representative programmatic tasks and confirm task order, hooks, variables, streams, and error handling.
4. Exercise the CLI with the syntax the project documents. Test both spaced and short file options when the project exposes them:

   ```sh
   bz --file ./beelzebub.js BuildTasks.build
   bz -f ./beelzebub.js BuildTasks.build
   ```

5. If the project supports both ESM and CommonJS consumers, test both entry points.
6. If TypeScript task files are used, test the actual loader-backed command rather than only compiling the file.
7. Check documentation examples and package scripts for obsolete 1.x commands.

Do not weaken tests, coverage thresholds, compiler settings, or lint rules to make the migration pass. Fix migration regressions at their source.

## 8. Report the result

Finish with a concise report containing:

- Files changed and why.
- Dependency and runtime versions before and after.
- Commands run and whether each passed.
- Representative tasks and CLI forms exercised.
- Any pre-existing failures, remaining risks, or manual follow-up.
- Any intentional behavior change that could affect users or CI.

Do not commit, push, publish, or deploy unless the user or repository workflow explicitly authorizes it.

## Copyable agent prompt

```text
Update this project from Beelzebub 1.x to Beelzebub 2.0.

Follow https://beelzebub.io/migrate/agent-guide.md as the migration contract.

First inspect the current Node, package manager, module, TypeScript, task-file, CLI,
decorator, CI, and test setup. Preserve existing behavior and avoid unrelated rewrites.
Upgrade the runtime and dependency, migrate changed APIs and decorators, update task-file
loading, and run the full project validation plus representative Beelzebub tasks.

Finish with a concise report of changed files, commands run, results, remaining risks,
and any manual follow-up.
```

For human-oriented explanations and examples, see the [Beelzebub 2.0 migration page](https://beelzebub.io/migrate/), [examples](https://beelzebub.io/examples/), and [API reference](https://beelzebub.io/api/).
