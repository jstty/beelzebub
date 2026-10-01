# Beelzebub 2.0 host embedding and prerelease plan

This plan covers two things: publishing immutable 2.0 prereleases, and the library changes that make Beelzebub safe to embed in a long-running host. It is the upstream plan for Hypersmith stage DP-01 (`hypersmith.ai/docs/roadmap/agent-delivery-pipeline/01-beelzebub-runtime-and-embedding.md`) and for bzci.ai, which currently depends on the moving `dev/v2.0` branch.

Baseline: `dev/v2.0` at `e414a7e` plus branch `release/v2-next-prerelease`, inspected on 2026-09-24. Every claim below was checked against the source, and the behavioral ones against a probe script run on `src/`.

## Release channel policy

| Channel | Version | npm dist-tag | GitHub release | API |
| --- | --- | --- | --- | --- |
| Preview | `2.0.0-next.N` | `next` | Prerelease | May change between builds |
| Release candidate | `2.0.0-rc.N` | `rc` | Prerelease | Frozen; fixes only |
| Final | `2.0.0` | `latest` | Release | Stable |

- `latest` stays on 1.x (`1.0.4`) until `2.0.0` is published.
- Consumers pin an exact version (`"beelzebub": "2.0.0-next.1"`), never a dist-tag or a git branch.
- Moving from `next` to `rc` requires the [RC exit criteria](#rc-exit-criteria).

## Release workflow

`.github/workflows/release.yml` publishes tagged releases.

1. Triggers: a pushed tag matching `v2.*`, or `workflow_dispatch` with a required `tag` input (an existing tag) for re-runs.
2. `verify` job: checks out the tag, installs Node 24.15.0 and npm 12.0.1, runs `npm ci` and `npm --prefix examples ci`, runs `./github-action` with `CI.verify` (the same pipeline as `ci.yml`), then runs `npm run validate-pkg`.
3. `publish` job (needs `verify`, environment `npm-publish`, `contents: write`, `id-token: write`):
   1. Fails unless the tag equals `v` + `package.json` version.
   2. Derives the dist-tag: `-next.N` → `next`, `-rc.N` → `rc`, no prerelease → `latest`. Any other prerelease identifier fails. `latest` also requires the tagged commit to be contained in `origin/master` or `origin/main`.
   3. Runs `npm publish --provenance --access public --tag <dist-tag>` using npm trusted publishing (OIDC). No `NPM_TOKEN` secret exists.
   4. Runs `gh release create <tag> --verify-tag --generate-notes`, adding `--prerelease` for `next` and `rc`.
   5. Re-runs are idempotent: an already-published version or an existing GitHub release is skipped with a notice.
4. Third-party actions are pinned to full commit SHAs.

### One-time setup

1. On npmjs.com, open `beelzebub` → Settings → Trusted publishing and add a GitHub Actions publisher: owner `jstty`, repository `beelzebub`, workflow filename `release.yml`, environment `npm-publish`.
2. In GitHub, create the `npm-publish` environment with a required reviewer. Optionally restrict its deployment tags to `v2.*`.
3. After the first successful OIDC publish, optionally set the npm package's publishing access to require two-factor authentication and disallow tokens.
4. GitHub only offers `workflow_dispatch` for workflows on the default branch. Until `release.yml` reaches `master`, re-run a failed release by re-running the workflow run, or by deleting and re-pushing the tag. Tag pushes work from any branch because GitHub reads the workflow from the tagged commit.

### Release commands

First preview, after this branch is merged into `dev/v2.0` and pushed:

```sh
git switch dev/v2.0 && git pull --ff-only
git tag v2.0.0-next.1 && git push origin v2.0.0-next.1
```

Later previews and release candidates:

```sh
npm version 2.0.0-next.2 --no-git-tag-version   # or 2.0.0-rc.1
npm run docs:build                              # TypeDoc output embeds the version
# add the entry to CHANGELOG.md
npm run check
git commit -am "chore(release): 2.0.0-next.2"
git push origin dev/v2.0
git tag v2.0.0-next.2 && git push origin v2.0.0-next.2
```

Final: merge the 2.0 PR into `master`, bump to `2.0.0` there, and tag `v2.0.0` on `master`. The workflow refuses `latest` from any commit outside `master`/`main`.

A local `npm publish --dry-run` fails in `prepublishOnly`. npm exports `npm_config_dry_run=true` to lifecycle scripts, so the `npm pack` that `attw --pack .` (in `validate-pkg`) runs is also a dry run, writes no tarball, and `attw` fails with `ENOENT`. A real publish is unaffected. To rehearse locally, run `npm run check`, then `npm publish --dry-run --tag next --ignore-scripts`. Pointing `validate-pkg` at a tarball it packs itself would remove the caveat.

## Changes

| # | Change | API-affecting | Phase |
| --- | --- | --- | --- |
| 1 | Node floor | Yes (support contract) | Before rc |
| 2 | `AbortSignal` through `run()`, `$pipeline`, and task context | Yes | Before rc |
| 3 | Pipeline step events | Yes | Before rc |
| 4 | Typed task inputs and results | Yes (types) | Before rc |
| 5 | Dependency injection into task classes | Yes (additive) | Before rc |
| 6 | Lazy-load `@actions/*` | No | Any time |
| 7 | Per-execution `$emit` binding | No | Any time |
| 8 | Runtime-scoped env for `LocalWorkflowRuntime` | No (additive) | Any time |
| 9 | `upsertIssueComment` author filter | No (additive) | Any time, low priority |
| 10 | Instance reuse | Docs: no; reset: additive | Docs before rc; reset any time |
| 11 | `failureMode: 'log'` hides pipeline failures | Yes (behavior) | Before rc |

Hypersmith DP-01 asks 1–8 map to items 2, 3, 4, 8, 6, 9, 7, and 1.

### 1. Node floor

**Status.** Done: the floor is `^22.12.0 || >=24.15.0`. CI adds one Node `22.x` leg on Linux
(not all three platforms, to limit CI cost). The package smoke test parses npm's trailing JSON.

**Problem.** `package.json` declares `engines.node >=24.15.0`, which forces Hypersmith (DP-01 decision D1) to upgrade its desktop Electron 37 runtime (Node 22) before it can embed Beelzebub. The code does not appear to need Node 24:

- `src/` uses none of these newer APIs: `Promise.try`, `RegExp.escape`, `Float16Array`, `URLPattern`, `Error.isError`, `using`/`Symbol.dispose`, `module.registerHooks`, `process.features`, `Uint8Array.fromBase64`, iterator helpers, `fs.glob`, `path.matchesGlob`, `node:sqlite`, `process.getBuiltinModule`.
- `tsconfig.json` targets and uses `lib` ES2024, which Node 22 supports.
- The one version-sensitive feature is the CommonJS entry points (`src/index.cts`, `src/github.cts`, `src/testing.cts`), which synchronously `require()` the ESM build. Node has supported `require(esm)` without a flag since 22.12.
- No direct runtime dependency declares an engine above Node 22. `cli-table3` declares `10.* || >= 12.*`, `cross-spawn` `>= 8`, `tsx` `>=18.0.0`, and the `@actions/*` packages, `picocolors`, and `stumpy` declare none.

**Node 22 results** (Node 22.21.1 via nvm, macOS arm64, 2026-09-24):

| Check | Result |
| --- | --- |
| `npm test` | Passed: 18 files, 135 tests, 16.5 s |
| `require('./dist/index.cjs')`, `require('./dist/github.cjs')`, `import('./dist/index.js')` | Passed |
| `scripts/test-package.js` (tarball install; ESM, CommonJS, and TypeScript consumers; CLI) with the npm 11.13 CLI | Passed |
| `scripts/test-package.js` with Node 22.21.1's bundled npm 10.9.4 | Failed: `npm pack --json --ignore-scripts` stdout began with the `post-build:` build log, so `JSON.parse` failed. This is a tooling issue, not a runtime one. |

Not run on Node 22: lint, typecheck, coverage, site build, Node 22.12–22.20, Linux or Windows, and Electron's embedded Node. npm 12.0.1 (`packageManager`) requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`, so contributors on Node 22 need 22.22.2 or newer. Consumers do not need npm 12.

**Proposed change.** Lower the floor to `"node": "^22.12.0 || >=24.15.0"` and add a Node 22 leg to the `ci.yml` matrix. Use `22.x`: npm 12 needs 22.22.2 or newer, so a 22.12.0 leg would need the bundled npm and a fixed package smoke test. Make `scripts/test-package.js` tolerate lifecycle output, for example by parsing the last JSON document on stdout. Document the policy: supported Node lines are dropped in a 2.x minor release after they reach upstream end of life (Node 22 is maintenance LTS until 2027-04-30).

Recommendation: lower to Node 22. Keeping 24.15 is simpler to support, but the evidence shows it is not required, and it costs Hypersmith an Electron upgrade that does nothing else for it. Hypersmith should confirm that Electron 37's Node is at least 22.12 in its DP-01 spike. `engines` is not changed on the `release/v2-next-prerelease` branch.

**API-affecting.** Yes. It is part of the support contract, and removing a supported Node line later is a breaking change for its users.

**Tests.** A CI matrix leg on Node `22.x` for Linux, macOS, and Windows; the package smoke test on Node 22; a CommonJS `require('beelzebub')` smoke test under the Electron version Hypersmith ships (in Hypersmith's DP-01 spike).

**Phase.** Before rc.

### 2. `AbortSignal` through `run()`, `$pipeline`, and task context

**Problem.** Only `ExecOptions.signal` (`src/commandRunner.ts`) accepts a signal. `NodeCommandRunner.exec` honors it; `MemoryCommandRunner.exec` (`src/testing.ts`) records it but ignores it. `Beelzebub.run()` (`src/beelzebub.ts`), `BzTasks.$pipeline` (`src/bzTasksClass.ts`), `executePipeline(definitions, execute)` (`src/pipeline.ts`), `BeelzebubConfig` (`src/types.ts`), and task methods have no signal. `PipelineOutcome` and `TaskOutcome` both declare `'cancelled'`, and `cancelled(id?)` tests for it, but `executePipeline` only writes `success`, `failure`, or `skipped`, and `_execTaskFun` only `success` or `failure`. `cancelled()` therefore can never be true. In the probe, `run()` still executed tasks after the host's `AbortController` was aborted.

**Proposed API.**

```ts
interface BeelzebubConfig {
  signal?: AbortSignal; // instance-wide cancellation
}

class BzTasks {
  /** Signal for the current execution. Never undefined; defaults to a signal that never aborts. */
  get $signal(): AbortSignal;
  $pipeline(steps: readonly PipelineStep[], options?: PipelineOptions): Promise<PipelineResult>;
}

interface PipelineOptions {
  signal?: AbortSignal; // combined with $signal via AbortSignal.any
  id?: string; // see item 3
}

function executePipeline(
  steps: readonly PipelineStep[],
  execute: (task: unknown) => Promise<unknown>,
  options?: { signal?: AbortSignal; onStepStart?: StepStartHook; onStepEnd?: StepEndHook }
): Promise<PipelineResult>;
```

Semantics, modeled on GitHub Actions:

- `_execTaskFun` checks the signal before `$beforeAll`/`$beforeEach`. If it has aborted, it records a `TaskExecution` with outcome and conclusion `cancelled` and rejects with `signal.reason`.
- `$exec` passes `this.$signal` to the command runner, combined with a caller's `options.signal`.
- After the signal aborts, `executePipeline` records steps without a `when` as `cancelled` and does not run them. Steps whose `when` returns true, such as `always()` or `cancelled()`, still run, so cleanup steps work. A step that rejects while the signal is aborted is recorded as `cancelled`, not `failure`.
- A pipeline whose conclusion is `cancelled` rejects with `PipelineCancelledError extends PipelineError`, so callers can tell cancellation from failure. Today only `failure` rejects.
- `MemoryCommandRunner.exec` rejects with `signal.reason` when `options.signal` is aborted, so cancellation can be tested offline.
- `run()`'s variadic task arguments leave no room for an options object. Per-execution signals come from the instance `signal` plus the execution store in item 7. A later `runWith({ signal, context }, ...tasks)` can be added without breaking anything.

**API-affecting.** Yes: new config and member names, `cancelled` outcomes where there were none, and a new rejection type.

**Tests.** Abort between steps (remaining steps `cancelled`, an `always()` step still runs, `cancelled('id')` is true); abort during a step (step and pipeline `cancelled`, `PipelineCancelledError`); abort before `run()` (no task body or hook runs, execution outcome `cancelled`); `$exec` receives the signal (`MemoryCommandRunner.calls[0].options.signal`); `MemoryCommandRunner` rejects when aborted.

**Phase.** Before rc.

### 3. Pipeline step events

**Problem.** `executePipeline` exposes step results only in the returned `PipelineResult` (or `PipelineError.result`), after the whole pipeline finishes. While it runs, the only events are `$before`, `$after`, and `$error` from `_execTaskFun`, keyed by task name rather than step id. Skipped steps emit nothing, and function steps are recorded as a `default` task. A host cannot show live step progress.

**Proposed API.** Emit two events on the existing emitter, so `app.on(name, filter, callback)` works unchanged:

```ts
interface PipelineStepEvent {
  pipelineId: string; // PipelineOptions.id, default: the calling task's full name
  stepId: string;
  startedAt: Date;
}
interface PipelineStepEndEvent<T = unknown> extends PipelineStepEvent, PipelineStepResult<T> {}

app.on('$stepStart', 'Delivery.run', (taskInfo, event: PipelineStepEvent) => {});
app.on('$stepEnd', 'Delivery.run', (taskInfo, event: PipelineStepEndEvent) => {});
```

- `taskInfo` is the task that called `$pipeline`, so the existing task filter selects one pipeline.
- Steps that run emit `$stepStart` and then `$stepEnd`. Skipped and cancelled-without-running steps emit only `$stepEnd`.
- `executePipeline` gains `onStepStart`/`onStepEnd` hooks (item 2 signature) for standalone use; `$pipeline` wires them to `beelzebub.emit`.
- An exception thrown by a listener is logged and does not change the step outcome. `EventEmitter.emit` currently propagates listener exceptions synchronously.

**API-affecting.** Yes. Event names and payloads become part of the contract.

**Tests.** Event order for success, failure, skip, and `continueOnError`; filtering by task; timing fields match the returned result; a throwing listener does not change outcomes.

**Phase.** Before rc.

### 4. Typed task inputs and results

**Problem.** Almost every value that crosses the API is `unknown`: `Beelzebub.run(parent?: unknown, ...args: unknown[]): Promise<unknown>`; `PipelineStep.task: unknown`; `PipelineResult.steps` and `PipelineContext.steps` are `Record<string, PipelineStepResult>`. `PipelineStepResult<T = unknown>` and `TaskExecution<T = unknown>` are already generic, but nothing passes a type argument. `TaskFn` is `(...args: unknown[]) => unknown`, and `TaskInfo.vars` is `Record<string, unknown>`. Consumers cast every result.

**Proposed API.** Keep `unknown` as the default so existing code compiles.

```ts
interface PipelineStep<T = unknown> {
  id: string;
  task: string | TaskReference | ((this: BzTasks) => T | Promise<T>);
  when?: PipelineCondition;
  continueOnError?: boolean;
}

function step<const Id extends string, T>(
  id: Id,
  task: () => T | Promise<T>,
  options?: Pick<PipelineStep, 'when' | 'continueOnError'>
): PipelineStep<T> & { id: Id };

type PipelineValues<S extends readonly PipelineStep[]> = {
  [K in S[number] as K['id']]: K extends PipelineStep<infer T> ? T : unknown;
};

interface PipelineResult<V extends Record<string, unknown> = Record<string, unknown>> {
  readonly steps: { readonly [K in keyof V]: PipelineStepResult<V[K]> };
  readonly order: readonly (keyof V & string)[];
  readonly conclusion: PipelineOutcome;
}

class BzTasks {
  $pipeline<const S extends readonly PipelineStep[]>(
    steps: S,
    options?: PipelineOptions
  ): Promise<PipelineResult<PipelineValues<S>>>;
}

class Beelzebub {
  run<T = unknown>(...tasks: unknown[]): Promise<T>; // explicit for string task names
}

interface TaskInfo<V extends Record<string, unknown> = Record<string, unknown>> {
  task: string;
  vars?: V;
}
```

Function steps already work at runtime: `$run(fn)` runs the function with the task instance as `this`, so this item is mostly type-level. The runtime change is to record function steps under their step id rather than `default`, which also improves item 3's events and `getExecutions()`.

**API-affecting.** Yes. Type parameters on public types are frozen at rc.

**Tests.** Type tests with `expectTypeOf` or a `tsc` fixture (step value inference, `order` keys, default `unknown`); a runtime test that function-step values appear in `result.steps[id].value` and executions use the step id.

**Phase.** Before rc.

### 5. Dependency injection into task classes

**Current behavior** (verified in the source and with a probe script):

- `Beelzebub.add(Tasks, config?)` (`src/beelzebub.ts`) accepts a module path (loaded with `require`), a constructor, or an already-constructed `BzTasks` instance (duck-typed by `util.isBaseTask`). There is no factory form: any function is treated as a constructor and called with `new`.
- A constructor is always called as `new Ctor(config)` with one merged `BeelzebubConfig` argument, both in `add()` and in `BzTasks.$addSubTasks`. There are no extra constructor arguments.
- `BeelzebubConfig` has an index signature (`[key: string]: unknown`, `src/types.ts`), and `util.deepMerge`/`util.deepClone` keep functions and class instances by reference. A host object can therefore be passed today:

| Channel | Reaches the task? | Identity kept? |
| --- | --- | --- |
| `app.add(Delivery, { host })` | Yes: constructor `config.host` and `this.$config().host` | Yes (class instance and plain object) |
| `bz.create({ host })` | Yes: every task's `$config().host` | Class instances only; plain objects are deep-copied per task class |
| `app.add(new Delivery({ beelzebub: app, host }))` | Yes | Yes |
| `app.run({ task: 'Delivery.go', vars: { host } })` | Yes, as the task's first argument | Class instances only; plain objects are cloned during sub-task dispatch (`_applyVarDefToTask`), and `@vars` definitions can coerce values |

- Limitations: the value is typed `unknown`, so every access needs a cast. The key can collide with reserved config keys (`name`, `logger`, `helpLogger`, `workflow`, `commandRunner`, `failureMode`, `beelzebub`, `parentPath`, `verbose`, `silent`). The host is fixed at `add()`/`create()` time, with no per-run context. That is acceptable under Hypersmith's one-instance-per-execution rule (DP-01 D4).

**Answer for Hypersmith now.** Build a host class (git, CI, agent services, abort signal) per delivery execution, create one Beelzebub instance with `bz.create({ ..., failureMode: 'throw' })`, and register tasks with `app.add(DeliveryTasks, { host })`. The task constructor reads `config.host`. Pass a class instance, not a plain object.

**Proposed API** (additive):

```ts
interface BeelzebubConfig<C = unknown> {
  /** Host services for task classes. Passed by reference, never cloned or merged. */
  context?: C;
}

bz.create<C>(config: BeelzebubConfig<C>): Beelzebub<C>;

class BzTasks<C = unknown> {
  get $context(): C;
}
```

With item 7's execution store, a later `runWith({ context, signal }, ...tasks)` can override the context for one run without breaking the API.

**API-affecting.** Yes, additive. It is not needed to unblock Hypersmith, because config pass-through works. It should land before rc, because it adds type parameters to `BzTasks` and `Beelzebub` and reserves the `context` key.

**Tests.** `$context` identity for class and plain objects, in the constructor, in sub-tasks, and with instance-form `add()`; a type test that `$context` has type `C`.

**Phase.** Before rc (small).

### 6. Lazy-load `@actions/*`

**Status.** Done for `@actions/artifact` and `@actions/cache`, which account for most of the cost:
importing them loads 775 and 575 files. `github.ts` imports them on first use.

- `isCacheAvailable()` stays synchronous. It uses a copy of `@actions/cache`'s environment check,
  and a parity test pins the copy to the installed package.
- `@actions/core` and `@actions/github` (about 150 files) still load with the root entry. Loading
  them lazily needs `init()` to stop importing `./github.js` statically, and needs `getClient()`
  to become async.
- The package smoke test fails if importing the root entry loads either SDK.

**Problem.** `src/beelzebub.ts` statically imports `GitHubWorkflowRuntime` from `./github.js` only so `init()` can call `GitHubWorkflowRuntime.isAvailable()` (which checks `GITHUB_ACTIONS === 'true'`) and construct the runtime. `src/github.ts` statically imports `@actions/core`, `@actions/github`, `@actions/artifact`, and `@actions/cache`. Measured with a `module.registerHooks` load hook on Node 24.16 against the built `dist/`: `import('beelzebub')` loads 984 files in about 170 ms. These include 82 files from `@actions/*` and their dependencies (`undici`, `lodash`, `@azure/storage-blob`, `@typespec/ts-http-runtime`, `@protobuf-ts/runtime`, and others). `dist/workflow.js` alone loads 1 file. Local CLI runs and embedded hosts pay this cost on every load.

**Proposed change** (no public API change):

- Inline the environment check in `init()`. Load `./github.js` only when `GITHUB_ACTIONS === 'true'` and no `workflow` was injected, using `createRequire(import.meta.url)`. `init()` is synchronous and runs in the constructor, so `await import()` would require an API change; `require(esm)` does not. Check that the esbuild action bundle (`scripts/build-action.js`) still includes the module.
- In `src/github.ts`, create `DefaultArtifactClient` on first `uploadArtifact`/`downloadArtifact` call, and import `@actions/cache` inside `restoreCache`/`saveCache`. All four are already async. Types stay available through `import type`.

**API-affecting.** No. Auto-detection behaves the same.

**Tests.** In a child process with `GITHUB_ACTIONS` unset, importing the root entry loads no `@actions/` module (load hook as above); with `GITHUB_ACTIONS=true`, `bz.create().getConfig().workflow.provider === 'github'`; the package smoke test still passes.

**Phase.** Any time.

### 7. Per-execution `$emit` binding

**Problem.** `_execTaskFun` (`src/bzTasksClass.ts`) assigns `parent.$emit = (name, data) => this.beelzebub.emit(name, { task: fullTaskName, vars }, data)` on the shared task-class instance for every execution. When two tasks of one class overlap (`$parallel`, or two pipelines at once), the last-started execution wins. An earlier task that emits after an `await` reports the other task's name and vars. In the probe, with `$parallel('.slow', '.fast')`, the event emitted by `slow` was reported as coming from `P.fast`.

**Proposed change.** Keep the `$emit(name, data)` signature. Define it once on `BzTasks.prototype`, reading the current execution from a module-level `AsyncLocalStorage` (`node:async_hooks`, available on Node 22 and 24) that `_execTaskFun` enters around hooks and the task body. The same store carries `$signal` (item 2) and a per-run `$context` (item 5). Outside an execution, `$emit` uses `{ task: this.namePath }`.

**API-affecting.** No.

**Tests.** Two tasks on one class run through `$parallel`; each awaits, then emits; the listener sees the correct task for each. Also test emits from `$beforeEach` and `$afterEach`.

**Phase.** Any time. If item 2 uses the store for `$signal`, land them together.

### 8. Runtime-scoped env for `LocalWorkflowRuntime`

**Problem.** `LocalWorkflowRuntime.exportVariable` sets `process.env[name]`, and `addPath` rewrites `process.env.PATH` (`src/workflow.ts`). In an embedded host, one run's exports leak into the whole process and every concurrent run. `GitHubWorkflowRuntime` delegates to `@actions/core`, which also mutates `process.env`; that is expected inside Actions. `NodeCommandRunner.exec` builds a child's environment from `process.env` plus `options.env`, so a scoped value reaches child processes only if `$exec` passes it.

**Proposed API** (additive; the default is unchanged):

```ts
new LocalWorkflowRuntime(context?, sink?, { env: 'process' | 'scoped' }); // default 'process'

interface WorkflowRuntime {
  /** Environment overrides applied to child processes started through $exec. */
  getEnv?(): Readonly<Record<string, string>>;
}
```

In `scoped` mode, `exportVariable` and `addPath` update a runtime-owned map. The effective `PATH` is the base `process.env.PATH` with added entries prepended. `BzTasks.$exec` merges `this.workflow.getEnv?.()` beneath the caller's `options.env`. Hypersmith's `DeliveryWorkflowRuntime` (DP-01 D3) can implement `getEnv()` as well.

**API-affecting.** No (optional member and option).

**Tests.** Scoped mode leaves `process.env` untouched; `$exec` through `MemoryCommandRunner` receives exported variables and `PATH`; the caller's `options.env` wins; the Windows `PATH` separator is used.

**Phase.** Any time.

### 9. `upsertIssueComment` author filter

**Problem.** `upsertIssueComment` (`src/github.ts`) updates the first comment whose `user.type === 'Bot'` and whose body contains the marker. Comments made with a user token have `type: 'User'`, so every call creates a new comment. The filter also matches any bot's comment that contains the marker, not only the caller's.

**Proposed API.**

```ts
interface UpsertIssueCommentOptions {
  // ...existing fields
  /** Which existing comment may be updated. Default: { type: 'Bot' } (current behavior). */
  author?:
    | { login?: string; type?: 'Bot' | 'User' | 'Organization' }
    | ((user: { login: string; type: string } | null) => boolean);
}
```

**API-affecting.** No (optional field on the `beelzebub/github` export).

**Tests.** With a mocked client: `author: { login }` updates a user-token comment; the default ignores user comments; a login mismatch creates a new comment.

**Phase.** Any time, low priority.

### 10. Instance reuse

**Current behavior** (source and probe):

- `BzTasks._beforeAllRun` is set in `_runBeforeAll` and never reset, while `_runAfterAll` runs at the end of every top-level `run()`. In the probe, two sequential `app.run('Delivery.go')` calls ran `$beforeAll` once and `$afterAll` twice.
- `BzTasks._executions` and `BzTasks._stats` accumulate across runs. After two runs, `getExecutions()` returned two entries.
- `Beelzebub._tasksRunning` *is* reset: `run()` clears it in `finally`. It is instance-wide, though. A second `run()` started while the first is in progress is treated as nested: it gets no `$afterAll` or summary of its own, and the first run's `finally` runs `$afterAll` and prints the summary while the second may still be executing.
- `Beelzebub.reset()` sets `_rootTasks` to `null` without calling `init()` again, so `run()` after `reset()` throws (`TypeError: Cannot read properties of null`, as seen in the probe). `reset()` also puts the loggers back to `console`.

**Proposed change.**

- Before rc: document on `run()` (README and TypeDoc) that a host uses one `Beelzebub` instance per run and never calls `run()` concurrently on the same instance. Hypersmith D4 already follows this.
- Any time: add `app.resetRunState()`, which walks the task tree and clears `_beforeAllRun`, `_executions`, and `_stats`. Reject a concurrent top-level `run()`; item 7's execution store can tell nested calls from concurrent ones. Fix `reset()` so it re-runs `init()`, or deprecate it.

**API-affecting.** The documentation is not. `resetRunState()` is additive. Rejecting concurrent runs changes behavior for callers that rely on it today.

**Tests.** Two runs separated by `resetRunState()` run `$beforeAll` twice; a concurrent top-level `run()` rejects; nested `$run` still works.

**Phase.** Documentation before rc; `resetRunState()` any time.

### 11. `failureMode: 'log'` hides pipeline failures

**Problem.** Found while verifying item 2. `BzTasks._run` (`src/bzTasksClass.ts`) returns `undefined` instead of rethrowing when `failureMode === 'log'`. `$pipeline` runs each step through `$run`, which reaches that code, so a throwing step is recorded as `success`. Probe with steps `a` (throws) and `b`: under `'throw'`, `PipelineError` with `{ a: 'failure', b: 'skipped' }`; under `'log'`, a resolved result with `{ a: 'success', b: 'success' }`.

**Proposed change.** Pipeline steps always execute in throw mode, so failures drive `when` conditions and `continueOnError` as documented. `failureMode` applies only to the top-level `run()`.

**API-affecting.** Yes, a behavior change for `'log'` users. Hypersmith uses `'throw'` and is unaffected.

**Tests.** The probe scenario as a regression test under both modes.

**Phase.** Before rc.

## Embedding fixes from Hypersmith DP-01

- **A `name` in `bz.create({ name })` renamed every added task class**, so `Class.task` stopped
  resolving and `run()` returned `[]`. This is also why "a task method named `run` is not
  addressable" was reported: `Class.run` was only unreachable on a named instance. Fixed:
  `add()` no longer passes the instance's `name` or `parentPath` to task classes. Regression
  tests cover both reports.
- **`beelzebub/package.json` is an exported subpath.**
- **CommonJS under Jest:** the CommonJS entry relies on `require(esm)`. The README documents
  loading through `process.getBuiltinModule('node:module').createRequire` in test runners that
  replace Node's loader. Shipping a separate CommonJS build is not planned.

## Explicit non-goals

- No durable state, persistence, resume, or checkpointing in Beelzebub.
- No loop, retry-until, or scheduling primitives. The CI repair and review loops are host code that call `run()`/`$pipeline` once per iteration.
- No multi-process or distributed execution.

Beelzebub stays a single-process task engine. Durability and loops belong to Hypersmith's delivery controller and to bzci.ai.

## RC exit criteria

1. Every "before rc" item (1, 2, 3, 4, 5, 11, and the documentation part of 10) is merged to `dev/v2.0` with tests, and `npm run check` passes.
2. At least one `2.0.0-next.N` build has been published through `release.yml`, proving trusted publishing and the `npm-publish` environment.
3. Both consumers have run against a `next` build that contains all "before rc" items:
   - Hypersmith: the DP-01 spike loads the package from its CommonJS backend under Node 24.15 and under the Electron runtime it ships, and runs a two-step `$pipeline` with `MemoryCommandRunner`.
   - bzci.ai: its dependency is an exact `2.0.0-next.N` version instead of `git+https://github.com/jstty/beelzebub.git#dev/v2.0`, and its CI passes.
4. `CHANGELOG.md` and `MIGRATION.md` describe the final 2.0 API.

## Sequence

1. Merge `release/v2-next-prerelease` into `dev/v2.0` and publish `2.0.0-next.1`.
2. Move Hypersmith and bzci.ai to exact `2.0.0-next.1` pins.
3. Land the "before rc" items, publishing `next` builds as needed.
4. Both consumers validate a `next` build that includes them.
5. Publish `2.0.0-rc.1`; the API is frozen.
6. Merge the 2.0 PR into `master`, then tag `v2.0.0` there; it becomes `latest`.
