# GitHub Actions with Beelzebub 2.0

Beelzebub can replace the executable body of most GitHub Actions jobs with a typed task file. Keep the parts that GitHub must schedule in a thin workflow: event triggers, permissions, runners, matrices, environments, concurrency, and job dependencies.

## Define a typed pipeline

```ts
import { BzTasks, always, failure } from 'beelzebub';

export default class CI extends BzTasks {
  verify() {
    return this.$pipeline([
      { id: 'lint', task: '.lint' },
      { id: 'coverage', task: '.coverage', continueOnError: true },
      { id: 'summary', task: '.summary', when: always() },
      { id: 'enforce-coverage', task: '.enforceCoverage', when: failure('coverage') }
    ]);
  }

  lint() {
    return this.$exec('npm', ['run', 'lint']);
  }

  coverage() {
    return this.$exec('npm', ['run', 'coverage']);
  }

  async summary() {
    await this.workflow.summary.heading('CI results', 2).paragraph('Checks complete.').write();
  }

  enforceCoverage(): never {
    throw new Error('Coverage did not meet the required threshold');
  }
}
```

`$exec()` uses argument arrays without a shell by default and rejects unexpected exit codes. `$pipeline()` records stable step IDs, values, errors, timings, outcomes, and effective conclusions. Conditions can use `always()`, `success()`, `failure()`, and `cancelled()`, or an ordinary typed function.

## Keep the workflow thin

```yaml
name: CI
on: [push, pull_request]

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - uses: jstty/beelzebub/github-action@v2
        with:
          file: beelzebub.ts
          task: CI.verify
```

The bundled action loads the project's installed `beelzebub` package from `working-directory`, then uses that version to load TypeScript directly. A handwritten workflow may install dependencies first, or a generated bridge job may select the action's `npm`, `pnpm`, `yarn`, or no-shell custom bootstrap adapter. The action accepts these inputs:

- `file`: task file, defaulting to `beelzebub.ts`
- `task`: one or more newline-separated task paths
- `args`: optional newline-separated task arguments
- `working-directory`: task working directory
- `summary`: whether to append the automatic task table
- `failure-mode`: `throw` by default; `log` is the legacy compatibility mode
- `bootstrap`: `none`, `npm`, `pnpm`, `yarn`, or `custom`
- `bootstrap-command-json`: a JSON argument vector used only with `custom`; it never invokes a shell

It outputs `conclusion` and `task-count`.

### Generated bridge contract

Generated workflows set `bridge-contract-version: "1"` and provide a canonical plan hash, job ID, evaluated matrix JSON, evaluated task-variable JSON, and expected output descriptors. Contract 1 accepts exactly one task and rejects unstructured `args`. It verifies that the repository resolves Beelzebub 2.x before task execution.

Contract 1 additionally emits bounded `result`, `plan-hash`, `job-id`, `outputs-json`, `artifact-cache-summary`, `diagnostic-count`, and `runtime-version` outputs. Structured outputs are limited to 64 KiB each and fail explicitly on overflow. Sensitive expected outputs are never copied into `outputs-json` or `result`; cache summaries retain only a SHA-256 key digest and operation counts. Artifact/cache clients use the GitHub runtime's ambient credentials and the adapter does not serialize tokens or credentials.

The bridge remains deliberately thin. GitHub owns scheduling, permissions, runner labels, matrices, service containers, environments, dependencies, and cancellation. The action does not emulate arbitrary marketplace actions, retry policies, privileged containers, or runner provisioning. `pnpm` and `yarn` bootstrap require those executables to be available on the selected runner. Event fixtures are repository-relative and intended for controlled parity tests.

## Workflow runtime

Every task receives `this.workflow`. Outside GitHub it is a local runtime; on a hosted runner Beelzebub automatically selects the GitHub adapter. Provider-neutral operations include:

- structured Markdown summaries, including headings, paragraphs, code blocks, lists, tables, details, links, and separators
- debug, info, notice, warning, and error messages with annotation locations
- grouped logs and secret masking
- outputs, environment variables, PATH entries, and saved state
- typed event, repository, ref, actor, run, workspace, and payload context

The `beelzebub/github` entry point adds GitHub-specific capabilities:

```ts
import {
  GitHubWorkflowRuntime,
  readGitHubSummary,
  upsertIssueComment
} from 'beelzebub/github';
```

`GitHubWorkflowRuntime` exposes action inputs, OIDC tokens, an authenticated Octokit client, artifacts, and dependency caches. `upsertIssueComment()` creates or updates a bot-authored marker comment so pull request reports do not accumulate duplicates.

`getExecutionSnapshot()` returns provider-neutral task outputs plus a redacted artifact/cache operation summary and diagnostic count. It intentionally excludes secrets, tokens, raw cache keys, and file contents.

GitHub limits each step summary to 1 MiB. The adapter enforces that limit before writing to `GITHUB_STEP_SUMMARY` and supports append, overwrite, read, and clear operations.

## Test without GitHub or subprocesses

```ts
import { describe, expect, it } from 'vitest';
import { MemoryCommandRunner, MemoryWorkflowRuntime } from 'beelzebub/testing';
import bz from 'beelzebub';
import CI from './beelzebub.js';

describe('CI', () => {
  it('runs the expected commands', async () => {
    const commandRunner = new MemoryCommandRunner().succeed().succeed();
    const workflow = new MemoryWorkflowRuntime({ eventName: 'pull_request' });
    const app = bz.create({ commandRunner, workflow });
    app.add(CI);

    await app.run('CI.verify');

    expect(commandRunner.calls.map(({ command, args }) => [command, ...args])).toEqual([
      ['npm', 'run', 'lint'],
      ['npm', 'run', 'coverage']
    ]);
    expect(workflow.summarySink.content).toContain('CI results');
  });
});
```

Queue deterministic command successes, failures, or errors with `MemoryCommandRunner`. Inspect recorded calls, annotations, outputs, variables, paths, secrets, state, and summary Markdown through `MemoryWorkflowRuntime`.

## What remains in YAML

Beelzebub does not replace GitHub's scheduler. Keep event filters, permissions, job-level matrices, runner selection, protected environments, service containers, job dependencies, and marketplace actions that provision the runner in workflow YAML. Move command orchestration, conditions, reporting, artifact/cache calls, and GitHub API automation into TypeScript when those behaviors benefit from reuse and tests.
