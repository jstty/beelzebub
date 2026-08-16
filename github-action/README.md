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

The action loads the project's installed `beelzebub` package from `working-directory`, so install dependencies before the action step. This keeps TypeScript task loading aligned with the exact Beelzebub version declared by the project.
