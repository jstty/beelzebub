import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import bz, { BzTasks, always, failure, success } from './src/index.js';
import { GitHubWorkflowRuntime, upsertIssueComment } from './src/github.js';
import { createCoverageReport } from './scripts/coverage-report.js';

interface PullRequestPayload {
  pull_request?: {
    number?: number;
    head?: { repo?: { full_name?: string } };
  };
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

export default class CI extends BzTasks {
  verify() {
    return this.$pipeline([
      { id: 'format', task: '.formatCheck' },
      { id: 'lint', task: '.lint' },
      { id: 'typecheck', task: '.typecheck' },
      { id: 'test', task: '.test' },
      { id: 'build', task: '.build' },
      { id: 'package', task: '.testPackage' }
    ]);
  }

  quality() {
    return this.$pipeline([
      { id: 'coverage', task: '.coverage', continueOnError: true },
      { id: 'coverage-summary', task: '.coverageSummary', when: always() },
      {
        id: 'coverage-comment',
        task: '.coverageComment',
        when: () => this._shouldCommentCoverage()
      },
      { id: 'enforce-coverage', task: '.enforceCoverage', when: failure('coverage') },
      { id: 'build', task: '.build' },
      { id: 'site', task: '.siteCheck' },
      { id: 'package', task: '.validatePackage' },
      { id: 'audit', task: '.audit' },
      {
        id: 'artifacts',
        task: '.uploadArtifacts',
        when: async (context) => this.workflow.provider === 'github' && (await success()(context))
      }
    ]);
  }

  formatCheck() {
    return this._script('format:check');
  }
  lint() {
    return this._script('lint');
  }
  typecheck() {
    return this._script('typecheck');
  }
  test() {
    return this._script('test');
  }
  build() {
    return this._script('build');
  }
  testPackage() {
    return this._script('test:package');
  }
  coverage() {
    return this._script('coverage');
  }
  siteCheck() {
    return this._script('site:check');
  }
  validatePackage() {
    return this._script('validate-pkg');
  }
  audit() {
    return this._script('audit');
  }

  async coverageSummary(): Promise<string> {
    const runtime = this._github();
    const report = await createCoverageReport(
      runtime?.context.runUrl ? { runUrl: runtime.context.runUrl } : {}
    );
    await writeFile('coverage-summary.md', report, 'utf8');
    await this.workflow.summary.raw(report).write();
    return report;
  }

  async coverageComment(): Promise<void> {
    const github = this._github();
    if (!github) return;
    const payload = github.context.payload as PullRequestPayload | undefined;
    const issueNumber = payload?.pull_request?.number;
    const owner = github.context.repositoryOwner;
    const repo = github.context.repositoryName;
    const token = process.env.GITHUB_TOKEN;
    if (!issueNumber || !owner || !repo || !token) {
      throw new Error('GitHub pull request context or GITHUB_TOKEN is unavailable');
    }
    const body = await readFile('coverage-summary.md', 'utf8');
    await upsertIssueComment(github.getClient(token), {
      owner,
      repo,
      issueNumber,
      marker: '<!-- beelzebub-coverage-report -->',
      body
    });
  }

  enforceCoverage(): never {
    throw new Error('Coverage did not meet the required threshold');
  }

  async uploadArtifacts(): Promise<void> {
    const github = this._github();
    if (!github) return;
    const coverageRoot = path.resolve('coverage');
    const websiteRoot = path.resolve('website/dist');
    await github.uploadArtifact('coverage', await collectFiles(coverageRoot), {
      rootDirectory: coverageRoot
    });
    await github.uploadArtifact('website-static', await collectFiles(websiteRoot), {
      rootDirectory: websiteRoot
    });
  }

  private _script(name: string) {
    return this.$exec('npm', ['run', name]);
  }

  private _shouldCommentCoverage(): boolean {
    const github = this._github();
    if (!github) return false;
    const payload = github.context.payload as PullRequestPayload | undefined;
    return (
      github.context.eventName === 'pull_request' &&
      payload?.pull_request?.head?.repo?.full_name === github.context.repository &&
      github.context.actor !== 'dependabot[bot]'
    );
  }

  private _github(): GitHubWorkflowRuntime | undefined {
    return this.workflow.provider === 'github'
      ? (this.workflow as GitHubWorkflowRuntime)
      : undefined;
  }
}

// Retain direct programmatic use in addition to the default CLI export.
export const createCI = (config = {}) => {
  const app = bz.create(config);
  app.add(CI);
  return app;
};
