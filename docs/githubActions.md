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

The bundled action loads TypeScript directly and accepts these inputs:

- `file`: task file, defaulting to `beelzebub.ts`
- `task`: one or more newline-separated task paths
- `args`: optional newline-separated task arguments
- `working-directory`: task working directory
- `summary`: whether to append the automatic task table
- `failure-mode`: `throw` by default; `log` is the legacy compatibility mode

It outputs `conclusion` and `task-count`.

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
