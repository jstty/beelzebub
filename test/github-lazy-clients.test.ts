import { describe, expect, it, vi } from 'vitest';

const artifacts = vi.hoisted(() => ({ created: 0 }));
vi.mock('@actions/artifact', () => ({
  DefaultArtifactClient: class {
    constructor() {
      artifacts.created++;
    }
    uploadArtifact = vi.fn(async () => ({ id: 1, size: 2 }));
    getArtifact = vi.fn(async () => ({ artifact: { id: 3 } }));
    downloadArtifact = vi.fn(async () => ({ downloadPath: '/tmp/out' }));
  }
}));
vi.mock('@actions/cache', () => ({
  restoreCache: vi.fn(async () => 'cache-hit'),
  saveCache: vi.fn(async () => 9),
  isFeatureAvailable: vi.fn(() => true)
}));

import * as actionsCache from '@actions/cache';
import { GitHubWorkflowRuntime } from '../src/github.js';

describe('default GitHub clients', () => {
  it('creates the artifact client on first use and imports the cache package on demand', async () => {
    const runtime = new GitHubWorkflowRuntime({
      env: { GITHUB_REPOSITORY: 'owner/repo', GITHUB_WORKSPACE: '/workspace' },
      payload: {},
      summarySink: { append: async () => undefined, write: async () => undefined } as never
    });
    expect(artifacts.created).toBe(0);
    await expect(runtime.uploadArtifact('site', ['a.txt'])).resolves.toEqual({ id: 1, size: 2 });
    await expect(runtime.downloadArtifact('site')).resolves.toEqual({ downloadPath: '/tmp/out' });
    expect(artifacts.created).toBe(1);

    await expect(runtime.restoreCache(['node_modules'], 'key', ['k-'])).resolves.toBe('cache-hit');
    await expect(runtime.saveCache(['node_modules'], 'key')).resolves.toBe(9);
    expect(actionsCache.restoreCache).toHaveBeenCalledWith(
      ['node_modules'],
      'key',
      ['k-'],
      undefined,
      undefined
    );
    expect(actionsCache.saveCache).toHaveBeenCalledWith(
      ['node_modules'],
      'key',
      undefined,
      undefined
    );
    expect(runtime.getExecutionSnapshot().caches).toHaveLength(2);
  });
});
