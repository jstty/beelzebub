# Beelzebub GitHub Action

Run a TypeScript Beelzebub pipeline while leaving triggers, permissions, runners, matrices, and environments in a thin workflow file.

```yaml
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
  with:
    node-version: 24
- run: npm ci
- uses: jstty/beelzebub/github-action@v2
  with:
    file: beelzebub.ts
    task: CI.verify
```

Task files can use `this.workflow` for summaries, annotations, outputs, environment variables, paths, masking, artifacts, caching, GitHub API access, and OIDC. The action adds a final task table to the job summary by default.

The action loads the project's installed `beelzebub` package from `working-directory`. Install dependencies before the action step, or select the `npm`, `pnpm`, `yarn`, or no-shell `custom` bootstrap adapter. This keeps TypeScript task loading aligned with the exact Beelzebub version declared by the project.

Generated bz bridge jobs use `bridge-contract-version: "1"`. They pass a plan hash, job ID, matrix, typed task variables, and expected-output policy to the action. The versioned result includes task outcomes, non-sensitive outputs, redacted artifact/cache operation telemetry, diagnostic count, and the resolved Beelzebub runtime version. Each structured output is capped at 64 KiB; sensitive outputs and credentials are not copied into the result.

Contract 1 supports Beelzebub 2.x and one task per generated job. It does not emulate GitHub scheduling, arbitrary marketplace actions, service-container policy, retries, or runner provisioning.
