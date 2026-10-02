# Changelog

Notable project changes are documented here. The format follows Keep a Changelog and the project uses semantic versioning.

## 2.0.0 - Unreleased

### Prereleases

- `2.0.0-next.1`: first published 2.0 preview, on the npm `next` dist-tag
  (`npm install beelzebub@next`). `next` builds may still change the API. Once the API-affecting
  changes in `plans/v2-host-embedding-and-prerelease.md` land, `2.0.0-rc.N` builds on the `rc`
  dist-tag freeze it, and `2.0.0` then becomes `latest`. Until then `latest` stays on 1.x.
  Pushing a `v2.*` tag publishes the release through `.github/workflows/release.yml` with
  npm provenance.
- `2.0.0-next.2`: Node 22.12+ support, `@actions/artifact` and `@actions/cache` load on first use,
  an instance `name` no longer renames added task classes, and a `beelzebub/package.json` export.

### Added

- First-class TypeScript declarations and declaration maps.
- Native ESM and callable CommonJS package exports, and a `beelzebub/package.json` export.
- TC39 standard task decorators.
- TypeScript 7 compilation with a temporary TypeScript 6 tooling compatibility layer.
- Vitest 4 tests, 90% coverage thresholds, tarball consumer tests, and Node 22/24/26 CI.
- TypeDoc API documentation and a dedicated 1.x migration guide.
- A new responsive product website with an expanded example library, integrated API reference,
  Firebase Hosting configuration, preview deployment, and automated static-site validation.
- Cancellation: `BeelzebubConfig.signal`, `$signal` on task classes, and `$pipeline(steps, { signal })`.
  `$exec` passes the signal to the command runner; cancelled tasks and pipeline steps are recorded
  as `cancelled`; `always()` steps still run after an abort; a cancelled pipeline rejects with
  `PipelineCancelledError`. `MemoryCommandRunner` rejects when its signal has aborted.
- Host services: `BeelzebubConfig.context`, passed by reference and read as `$context` on
  `BzTasks<C>`; `bz.create<C>()` returns `Beelzebub<C>`.
- Pipeline step events `$stepStart` and `$stepEnd`, and `onStepStart`/`onStepEnd` hooks on
  `executePipeline`.
- Typed pipelines: `step(id, fn)`, `PipelineStep<T>`, `PipelineValues`, `PipelineResult<V>`,
  `run<T>()`, and `$run<T>()`.
- `resetRunState()` for reusing an instance between runs.
- `LocalWorkflowRuntime` option `{ env: 'scoped' }` and `WorkflowRuntime.getEnv()`, so exported
  variables and paths reach `$exec` child processes without changing `process.env`.
- An `author` filter on `upsertIssueComment` for comments posted with a user token.

### Changed

- Minimum runtime is Node.js 22.12 on the 22 line, or 24.15 (`^22.12.0 || >=24.15.0`); CI adds a
  Node 22 leg on Linux.
- `@actions/artifact` and `@actions/cache` load on first use, so importing Beelzebub outside
  GitHub Actions no longer loads about 1,300 files from them.
- Development package manager is npm 12.
- CLI parsing uses `node:util.parseArgs` and native ESM loading.
- Promise, generator, sequence, parallel, and stream execution use native Node and JavaScript APIs.
- Examples use TypeScript and Gulp 5.
- Git dependencies build their untracked `dist/` output through npm's `prepare` lifecycle.
- `failureMode: 'log'` applies to the top-level `run()` only; nested runs and pipeline steps always
  reject.
- A second top-level `run()` on an instance while one is in progress rejects.
- `reset()` re-initializes the instance, so it can run again.
- Pipeline function steps are recorded under their step id instead of `default`.

### Fixed

- The CLI accepts separate values for `--file <path>` and `-f <path>` as documented.
- Summary statistics no longer double-count earlier runs when results are added in batches.
- A `name` in the instance configuration (`bz.create({ name })`) no longer renames every task
  class added to that instance; classes keep their own namespace unless `add()` names them.
- `$emit` reports the running task even when tasks of one class overlap; it used to report
  whichever task started last.
- Under `failureMode: 'log'`, a failing pipeline step was recorded as a success.
- A no-argument `bz.create()` wrote its command runner, workflow, and loggers into the shared
  defaults, so later instances shared them.

### Removed

- Babel and legacy decorator transforms.
- `Beelzebub.cli()`.
- Legacy build, documentation, test, and async dependency stacks.

### Security

- Updated all direct tooling dependencies and regenerated lockfiles.
- Removed vulnerable example and documentation-development dependencies.
- Added root and example audit gates.
