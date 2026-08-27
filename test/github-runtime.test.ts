import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GitHubWorkflowRuntime,
  createGitHubContext,
  readGitHubSummary,
  upsertIssueComment,
  type GitHubApiClient,
  type GitHubCacheClient,
  type GitHubCoreAdapter
} from '../src/github.js';

class FakeCore implements GitHubCoreAdapter {
  readonly calls: Array<{ method: string; args: unknown[] }> = [];
  readonly states = new Map<string, string>();

  private call(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }
  debug(message: string): void {
    this.call('debug', message);
  }
  info(message: string): void {
    this.call('info', message);
  }
  notice(message: string, properties?: object): void {
    this.call('notice', message, properties);
  }
  warning(message: string, properties?: object): void {
    this.call('warning', message, properties);
  }
  error(message: string, properties?: object): void {
    this.call('error', message, properties);
  }
  async group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.call('group', name);
    return fn();
  }
  setSecret(value: string): void {
    this.call('setSecret', value);
  }
  setOutput(name: string, value: unknown): void {
    this.call('setOutput', name, value);
  }
  exportVariable(name: string, value: unknown): void {
    this.call('exportVariable', name, value);
  }
  addPath(value: string): void {
    this.call('addPath', value);
  }
  saveState(name: string, value: unknown): void {
    this.states.set(name, String(value));
  }
  getState(name: string): string {
    return this.states.get(name) ?? '';
  }
  getInput(name: string): string {
    return `input:${name}`;
  }
  getBooleanInput(): boolean {
    return true;
  }
  getMultilineInput(): string[] {
    return ['one', 'two'];
  }
  async getIDToken(audience?: string): Promise<string> {
    return `token:${audience ?? ''}`;
  }
}

const directories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixtureEnv(): { env: NodeJS.ProcessEnv; summaryPath: string } {
  const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-github-'));
  directories.push(directory);
  const summaryPath = path.join(directory, 'summary.md');
  const eventPath = path.join(directory, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 7 } }));
  return {
    summaryPath,
    env: {
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'jstty/beelzebub',
      GITHUB_SERVER_URL: 'https://github.example',
      GITHUB_RUN_ID: '123',
      GITHUB_STEP_SUMMARY: summaryPath
    }
  };
}

describe('GitHubWorkflowRuntime', () => {
  it('creates a typed context from environment and event data', () => {
    const { env } = fixtureEnv();
    expect(createGitHubContext(env)).toMatchObject({
      eventName: 'pull_request',
      repositoryOwner: 'jstty',
      repositoryName: 'beelzebub',
      runUrl: 'https://github.example/jstty/beelzebub/actions/runs/123',
      payload: { pull_request: { number: 7 } }
    });

    expect(
      createGitHubContext(
        {
          GITHUB_API_URL: 'https://api.github.example',
          GITHUB_GRAPHQL_URL: 'https://api.github.example/graphql',
          GITHUB_SHA: 'abc',
          GITHUB_REF: 'refs/heads/main',
          GITHUB_ACTOR: 'octocat',
          GITHUB_RUN_ATTEMPT: '2',
          GITHUB_WORKSPACE: '/workspace'
        },
        { supplied: true }
      )
    ).toMatchObject({
      eventName: '',
      repository: '',
      serverUrl: 'https://github.com',
      payload: { supplied: true },
      apiUrl: 'https://api.github.example',
      graphqlUrl: 'https://api.github.example/graphql',
      sha: 'abc',
      ref: 'refs/heads/main',
      actor: 'octocat',
      runAttempt: '2',
      workspace: '/workspace'
    });
  });

  it('writes structured Markdown to the GitHub step summary', async () => {
    const { env, summaryPath } = fixtureEnv();
    const runtime = new GitHubWorkflowRuntime({ env, core: new FakeCore() });

    await runtime.summary
      .heading('Checks', 2)
      .table([
        ['Task', 'Result'],
        ['test', 'passed']
      ])
      .details('Output', 'Everything passed.')
      .write();

    expect(readFileSync(summaryPath, 'utf8')).toMatchInlineSnapshot(`
      "## Checks

      | Task | Result |
      | --- | --- |
      | test | passed |

      <details>
      <summary>Output</summary>

      Everything passed.

      </details>
      "
    `);
  });

  it('delegates runner commands through the injectable core adapter', async () => {
    const { env } = fixtureEnv();
    const adapter = new FakeCore();
    const runtime = new GitHubWorkflowRuntime({ env, core: adapter });

    runtime.warning('careful', { file: 'src/app.ts', startLine: 2 });
    runtime.maskSecret('secret');
    await runtime.setOutput('coverage', 95);
    await runtime.exportVariable('MODE', 'ci');
    await runtime.addPath('/tools');
    await runtime.saveState('pid', 12);

    expect(adapter.calls).toEqual([
      { method: 'warning', args: ['careful', { file: 'src/app.ts', startLine: 2 }] },
      { method: 'setSecret', args: ['secret'] },
      { method: 'setOutput', args: ['coverage', 95] },
      { method: 'exportVariable', args: ['MODE', 'ci'] },
      { method: 'addPath', args: ['/tools'] }
    ]);
    expect(runtime.getState('pid')).toBe('12');
    await expect(runtime.getIDToken('deploy')).resolves.toBe('token:deploy');
  });

  it('exposes annotations, groups, inputs, and an authenticated API client', async () => {
    const { env } = fixtureEnv();
    const adapter = new FakeCore();
    const runtime = new GitHubWorkflowRuntime({ env, core: adapter });

    runtime.debug('details');
    runtime.info('starting');
    runtime.notice('noted', { title: 'Notice' });
    runtime.error('failed', { file: 'src/app.ts' });
    await expect(runtime.group('grouped', async () => 42)).resolves.toBe(42);
    expect(runtime.getInput('mode')).toBe('input:mode');
    expect(runtime.getBooleanInput('enabled')).toBe(true);
    expect(runtime.getMultilineInput('paths')).toEqual(['one', 'two']);
    expect(runtime.getState('missing')).toBeUndefined();
    expect(runtime.getClient('token')).toBeDefined();

    expect(adapter.calls).toEqual([
      { method: 'debug', args: ['details'] },
      { method: 'info', args: ['starting'] },
      { method: 'notice', args: ['noted', { title: 'Notice' }] },
      { method: 'error', args: ['failed', { file: 'src/app.ts' }] },
      { method: 'group', args: ['grouped'] }
    ]);
  });

  it('detects the hosted runner and rejects oversized summaries', async () => {
    const { env } = fixtureEnv();
    expect(GitHubWorkflowRuntime.isAvailable(env)).toBe(true);
    expect(GitHubWorkflowRuntime.isAvailable({})).toBe(false);
    expect(() => new GitHubWorkflowRuntime({ env: {}, core: new FakeCore() })).toThrow(
      'GITHUB_STEP_SUMMARY'
    );
    const runtime = new GitHubWorkflowRuntime({ env, core: new FakeCore() });
    runtime.summary.raw('x'.repeat(1024 * 1024 + 1));
    await expect(runtime.summary.write()).rejects.toThrow('1 MiB');
  });

  it('can append, overwrite, read, and clear the GitHub summary', async () => {
    const { env, summaryPath } = fixtureEnv();
    const runtime = new GitHubWorkflowRuntime({ env, core: new FakeCore() });

    await runtime.summary.paragraph('first').write();
    await runtime.summary.paragraph('second').write();
    await expect(readGitHubSummary(summaryPath)).resolves.toBe('first\nsecond\n');
    await runtime.summary.paragraph('replacement').write({ overwrite: true });
    await expect(readGitHubSummary(summaryPath)).resolves.toBe('replacement\n');
    await runtime.summary.clear();
    await expect(readGitHubSummary(summaryPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await runtime.summary.clear();
  });

  it('wraps injectable artifact and cache clients', async () => {
    const { env } = fixtureEnv();
    env.GITHUB_WORKSPACE = '/workspace';
    const artifactClient = {
      uploadArtifact: vi.fn().mockResolvedValue({ id: 1, size: 20, digest: 'sha256:abc' }),
      getArtifact: vi.fn().mockResolvedValue({ artifact: { id: 7, name: 'site', size: 20 } }),
      downloadArtifact: vi.fn().mockResolvedValue({ downloadPath: '/tmp/site' }),
      listArtifacts: vi.fn(),
      deleteArtifact: vi.fn()
    };
    const cacheClient: GitHubCacheClient = {
      isFeatureAvailable: vi.fn(() => true),
      restoreCache: vi.fn(async () => 'npm-linux-primary'),
      saveCache: vi.fn(async () => 42)
    };
    const runtime = new GitHubWorkflowRuntime({
      env,
      core: new FakeCore(),
      artifactClient,
      cacheClient
    });

    await expect(runtime.uploadArtifact('site', ['dist/index.html'])).resolves.toMatchObject({
      id: 1
    });
    expect(artifactClient.uploadArtifact).toHaveBeenCalledWith(
      'site',
      ['dist/index.html'],
      '/workspace',
      {}
    );
    await expect(runtime.downloadArtifact('site', { path: '/tmp/site' })).resolves.toEqual({
      downloadPath: '/tmp/site'
    });
    const findBy = {
      token: 'token',
      workflowRunId: 12,
      repositoryOwner: 'jstty',
      repositoryName: 'beelzebub'
    };
    await runtime.downloadArtifact('site', {
      expectedHash: 'sha256:abc',
      skipDecompress: true,
      findBy
    });
    expect(artifactClient.getArtifact).toHaveBeenLastCalledWith('site', { findBy });
    expect(artifactClient.downloadArtifact).toHaveBeenLastCalledWith(7, {
      expectedHash: 'sha256:abc',
      skipDecompress: true,
      findBy
    });
    expect(runtime.isCacheAvailable()).toBe(true);
    await expect(runtime.restoreCache(['node_modules'], 'npm-primary')).resolves.toBe(
      'npm-linux-primary'
    );
    await expect(runtime.saveCache(['node_modules'], 'npm-primary')).resolves.toBe(42);
  });

  it('updates an existing marker comment or creates a new one', async () => {
    const issues = {
      listComments: vi.fn(),
      updateComment: vi.fn().mockResolvedValue({}),
      createComment: vi.fn().mockResolvedValue({})
    };
    const client = {
      paginate: vi.fn().mockResolvedValue([
        { id: 4, body: '<!-- report --> old', user: { type: 'Bot' } },
        { id: 5, body: '<!-- report --> human', user: { type: 'User' } }
      ]),
      rest: { issues }
    } as unknown as GitHubApiClient;
    const options = {
      owner: 'jstty',
      repo: 'beelzebub',
      issueNumber: 7,
      marker: '<!-- report -->',
      body: '<!-- report --> new'
    };

    await expect(upsertIssueComment(client, options)).resolves.toBe('updated');
    expect(issues.updateComment).toHaveBeenCalledWith({
      owner: 'jstty',
      repo: 'beelzebub',
      comment_id: 4,
      body: '<!-- report --> new'
    });

    vi.mocked(client.paginate).mockResolvedValueOnce([]);
    await expect(upsertIssueComment(client, options)).resolves.toBe('created');
    expect(issues.createComment).toHaveBeenCalledWith({
      owner: 'jstty',
      repo: 'beelzebub',
      issue_number: 7,
      body: '<!-- report --> new'
    });
  });
});
