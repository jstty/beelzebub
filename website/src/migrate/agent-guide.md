# Migrate project scripts to Beelzebub 2.0 — AI agent guide

Use this document as the implementation contract when migrating an existing project's task automation to Beelzebub 2.0. The current automation may live in package scripts, shell scripts, Makefiles, CI-only commands, another task runner, or application code. Preserve the project's behavior and conventions, keep changes focused on task automation, do not discard unrelated work, and do not use destructive Git commands.

## Objective

Migrate the project's selected workflows to Beelzebub 2.0 as a maintainable task layer. Replace difficult-to-maintain command chains with named, composable, and testable workflow components; keep package scripts and CI commands short; update relevant documentation; and leave the project with its full validation suite passing.

The work is not complete merely because the dependency installs. Representative Beelzebub tasks must run successfully through every interface the project uses.

## 1. Discover the current automation

Before editing files, inspect and record:

- The package manager and lockfile.
- npm scripts and every script they call transitively.
- Shell scripts, JavaScript or TypeScript automation, Makefiles, CI-only commands, and other task runners.
- Which commands are developer entry points and which are private implementation details.
- Node.js versions in `package.json`, version-manager files, CI workflows, containers, deployment configuration, and contributor documentation.
- Whether the project uses ESM, CommonJS, or both.
- Repeated command chains, duplicated flags, implicit ordering, parallel work, cleanup behavior, environment variables, and secret-dependent steps.
- Existing task packages or task classes that can be reused, extended, or grouped as subtasks.
- The project's format, lint, typecheck, test, build, packaging, release, and end-to-end commands.

Run the existing validation before making changes when practical. Record failures that already exist so they are not attributed to the Beelzebub work.

## 2. Design the task surface

Create a small task map before writing code:

1. Group commands by domain, such as `Verify`, `Build`, `Release`, `Database`, or `Deploy`.
2. Give public workflows stable task names that explain intent rather than implementation.
3. Represent ordered work with `$sequence()` and independent work with `$parallel()`.
4. Use subtasks to keep related task groups together.
5. Keep implementation details in code instead of copying long shell fragments into task methods.
6. Identify reusable task classes that belong in a shared package and project-specific classes that should stay local.
7. Preserve familiar npm script names as short Beelzebub entry points when developers or CI already depend on them.
8. Define at least one focused behavioral test for every public workflow being converted.

Do not convert unrelated tooling or redesign application code as part of the script migration.

## 3. Add the runtime and package

1. Set the Node.js baseline to **24.15.0 or newer** everywhere the project declares or provisions Node.
2. Install Beelzebub with the project's package manager. For a published release, use `beelzebub@^2`.
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

## 4. Choose the matching module entry point

Keep the project's existing module format unless a module conversion is explicitly part of the request.

CommonJS:

```js
const bz = require('beelzebub');
```

ESM:

```ts
import bz from 'beelzebub';
```

Both forms resolve to the callable singleton facade. Named exports are available in ESM, and the CommonJS facade exposes exports such as `bz.BzTasks` and `bz.BzCLI` as properties.

## 5. Implement composable tasks

Create focused task classes and move orchestration out of long package or shell command chains.

```ts
import bz from 'beelzebub';

class ProjectTasks extends bz.Tasks {
  verify() {
    return this.$parallel('.lint', '.test', '.typecheck');
  }

  release() {
    return this.$sequence('.clean', '.verify', '.build', '.package');
  }

  async clean(): Promise<void> {
    await cleanOutput();
  }

  async lint(): Promise<void> {
    await lintProject();
  }

  async test(): Promise<void> {
    await testProject();
  }

  async typecheck(): Promise<void> {
    await typecheckProject();
  }

  async build(): Promise<void> {
    await buildProject();
  }

  async package(): Promise<void> {
    await packageProject();
  }
}

bz.add(ProjectTasks);
```

Prefer `async`/`await` for asynchronous implementation code. Promises, generators, and Node streams are also supported.

### Reuse task packages

Beelzebub task classes can come from local files or installed packages. A project can load multiple task classes together:

```ts
import SharedReleaseTasks from '@acme/beelzebub-release-tasks';
import ProjectTasks from './tasks/project.js';

export default [SharedReleaseTasks, ProjectTasks];
```

When a project needs to customize shared behavior, extend the imported task class and override only the project-specific methods:

```ts
import SharedReleaseTasks from '@acme/beelzebub-release-tasks';

export default class ProjectReleaseTasks extends SharedReleaseTasks {
  async publish(): Promise<void> {
    await publishToProjectRegistry();
  }
}
```

Keep shared packages generic, keep credentials and environment-specific behavior in the consuming project, and verify the final composed task paths.

## 6. Add concise entry points

JavaScript task files load through Node's module system. A JavaScript task file can be invoked with:

```sh
bz --file ./beelzebub.js ProjectTasks.release
```

TypeScript task files are loaded through Beelzebub's bundled TypeScript loader:

```sh
bz --file ./beelzebub.ts ProjectTasks.release
```

Replace long package scripts with short, stable entry points while preserving any script names developers and CI already use:

```json
{
  "scripts": {
    "verify": "bz --file ./beelzebub.js ProjectTasks.verify",
    "release": "bz --file ./beelzebub.js ProjectTasks.release"
  }
}
```

Keep a dependency bootstrap such as `npm ci` before the Beelzebub command when that step must install Beelzebub itself. Do not hide or drop bootstrap behavior while shortening the rest of the workflow.

Update every npm script, shell script, CI job, and document that should use the new task entry points.

## 7. Verify the migration

Use the project's own commands and package manager. At minimum:

1. Perform a clean dependency install from the lockfile.
2. Run formatting checks, linting, typechecking, unit tests, integration tests, build, and package validation when those commands exist.
3. Compare each converted workflow with its previous behavior, including order, concurrency, exit codes, cleanup, environment variables, and failure handling.
4. Run representative programmatic tasks and confirm task paths, subtasks, hooks, variables, streams, and errors.
5. Exercise the CLI with the syntax the project documents. Test both spaced and short file options when the project exposes them:

   ```sh
   bz --file ./beelzebub.js ProjectTasks.release
   bz -f ./beelzebub.js ProjectTasks.release
   ```

6. If the project supports both ESM and CommonJS consumers, test both entry points.
7. If TypeScript task files are used, test the actual loader-backed command rather than only compiling the file.
8. Confirm npm scripts and CI now call the intended Beelzebub tasks without duplicating their orchestration logic.

Do not weaken tests, coverage thresholds, compiler settings, or lint rules to make the migration pass. Fix regressions at their source.

## 8. Report the result

Finish with a concise report containing:

- Files changed and why.
- The workflows converted to Beelzebub tasks.
- Runtime and dependency versions used.
- Commands run and whether each passed.
- Representative tasks and CLI forms exercised.
- Reusable task packages imported, extended, or created.
- Any pre-existing failures, remaining risks, or manual follow-up.
- Any intentional behavior change that could affect developers or CI.

Do not commit, push, publish, or deploy unless the user or repository workflow explicitly authorizes it.

## Copyable agent prompt

```text
Migrate this project's task automation from package.json scripts, shell scripts,
CI-only commands, and other task runners to Beelzebub 2.0.

Follow https://beelzebub.io/migrate/agent-guide.md as the implementation contract.

First inventory every public and private automation entry point and run the existing
validation. Preserve command names and behavior. Replace complex command chains with
named, composable Beelzebub tasks; model ordering with $sequence(), independent work
with $parallel(), and reuse or extend shared task packages where useful. Keep package.json
scripts and CI steps as short wrappers around the same task graph.

Use Node 24.15 or newer, choose the project's existing ESM or CommonJS format, and
configure TypeScript task-file loading when needed. Run the full project validation and
representative Beelzebub CLI tasks. Report changed files, commands run, results, risks,
and manual follow-up. Do not commit, push, publish, or deploy unless explicitly authorized.
```

For human-oriented explanations and examples, see the [Beelzebub website](https://beelzebub.io/), [examples](https://beelzebub.io/examples/), and [API reference](https://beelzebub.io/api/).
