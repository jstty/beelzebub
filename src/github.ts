import { appendFile, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import * as core from '@actions/core';
import * as github from '@actions/github';
import { DefaultArtifactClient, type ArtifactClient } from '@actions/artifact';
import * as actionsCache from '@actions/cache';

import {
  WorkflowSummary,
  type AnnotationLocation,
  type SummarySink,
  type SummaryWriteOptions,
  type ArtifactOperationSnapshot,
  type CacheOperationSnapshot,
  type WorkflowContext,
  type WorkflowExecutionSnapshot,
  type WorkflowRuntime
} from './workflow.js';

const MAX_STEP_SUMMARY_BYTES = 1024 * 1024;

export interface GitHubCoreAdapter {
  debug(message: string): void;
  info(message: string): void;
  notice(message: string, properties?: AnnotationLocation): void;
  warning(message: string, properties?: AnnotationLocation): void;
  error(message: string, properties?: AnnotationLocation): void;
  group<T>(name: string, fn: () => Promise<T>): Promise<T>;
  setSecret(value: string): void;
  setOutput(name: string, value: unknown): void;
  exportVariable(name: string, value: unknown): void;
  addPath(path: string): void;
  saveState(name: string, value: unknown): void;
  getState(name: string): string;
  getInput(name: string, options?: { required?: boolean; trimWhitespace?: boolean }): string;
  getBooleanInput(
    name: string,
    options?: { required?: boolean; trimWhitespace?: boolean }
  ): boolean;
  getMultilineInput(
    name: string,
    options?: { required?: boolean; trimWhitespace?: boolean }
  ): string[];
  getIDToken(audience?: string): Promise<string>;
}

export interface GitHubContext extends WorkflowContext {
  eventName: string;
  repository: string;
  repositoryOwner?: string;
  repositoryName?: string;
  serverUrl: string;
  apiUrl?: string;
  graphqlUrl?: string;
  runUrl?: string;
  payload?: unknown;
}

export interface GitHubRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  core?: GitHubCoreAdapter;
  payload?: unknown;
  summarySink?: SummarySink;
  artifactClient?: ArtifactClient;
  cacheClient?: GitHubCacheClient;
}

export interface GitHubCacheClient {
  isFeatureAvailable(): boolean;
  restoreCache(
    paths: string[],
    primaryKey: string,
    restoreKeys?: string[],
    options?: Parameters<typeof actionsCache.restoreCache>[3],
    enableCrossOsArchive?: boolean
  ): Promise<string | undefined>;
  saveCache(
    paths: string[],
    key: string,
    options?: Parameters<typeof actionsCache.saveCache>[2],
    enableCrossOsArchive?: boolean
  ): Promise<number>;
}

export interface UploadWorkflowArtifactOptions {
  rootDirectory?: string;
  retentionDays?: number;
  compressionLevel?: number;
  skipArchive?: boolean;
}

export interface FindWorkflowArtifactOptions {
  token: string;
  workflowRunId: number;
  repositoryOwner: string;
  repositoryName: string;
}

export interface DownloadWorkflowArtifactOptions {
  path?: string;
  expectedHash?: string;
  skipDecompress?: boolean;
  findBy?: FindWorkflowArtifactOptions;
}

function optional(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function loadPayload(env: NodeJS.ProcessEnv): unknown {
  const eventPath = optional(env.GITHUB_EVENT_PATH);
  if (!eventPath) return undefined;
  const source = readFileSync(eventPath, 'utf8');
  return JSON.parse(source) as unknown;
}

export function createGitHubContext(
  env: NodeJS.ProcessEnv = process.env,
  payload: unknown = loadPayload(env)
): GitHubContext {
  const repository = env.GITHUB_REPOSITORY ?? '';
  const [repositoryOwner, repositoryName] = repository.split('/', 2);
  const serverUrl = env.GITHUB_SERVER_URL ?? 'https://github.com';
  const runId = optional(env.GITHUB_RUN_ID);
  const context: GitHubContext = {
    eventName: env.GITHUB_EVENT_NAME ?? '',
    repository,
    serverUrl,
    payload
  };

  if (repositoryOwner) context.repositoryOwner = repositoryOwner;
  if (repositoryName) context.repositoryName = repositoryName;
  if (env.GITHUB_API_URL) context.apiUrl = env.GITHUB_API_URL;
  if (env.GITHUB_GRAPHQL_URL) context.graphqlUrl = env.GITHUB_GRAPHQL_URL;
  if (env.GITHUB_SHA) context.sha = env.GITHUB_SHA;
  if (env.GITHUB_REF) context.ref = env.GITHUB_REF;
  if (env.GITHUB_ACTOR) context.actor = env.GITHUB_ACTOR;
  if (runId) {
    context.runId = runId;
    if (repository) context.runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;
  }
  if (env.GITHUB_RUN_ATTEMPT) context.runAttempt = env.GITHUB_RUN_ATTEMPT;
  if (env.GITHUB_WORKSPACE) context.workspace = env.GITHUB_WORKSPACE;
  return context;
}

class GitHubSummarySink implements SummarySink {
  readonly path: string;

  constructor(env: NodeJS.ProcessEnv) {
    const path = optional(env.GITHUB_STEP_SUMMARY);
    if (!path) throw new Error('GITHUB_STEP_SUMMARY is unavailable outside a GitHub Actions step');
    this.path = path;
  }

  async write(markdown: string, options: SummaryWriteOptions = {}): Promise<void> {
    const contentBytes = Buffer.byteLength(markdown);
    let existingBytes = 0;
    if (!options.overwrite) {
      try {
        existingBytes = (await stat(this.path)).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    if (existingBytes + contentBytes > MAX_STEP_SUMMARY_BYTES) {
      throw new Error('GitHub step summary exceeds the 1 MiB per-step limit');
    }
    if (options.overwrite) await writeFile(this.path, markdown, 'utf8');
    else await appendFile(this.path, markdown, 'utf8');
  }

  async clear(): Promise<void> {
    try {
      await unlink(this.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

/** GitHub Actions runtime backed by the official Actions Toolkit. */
export class GitHubWorkflowRuntime implements WorkflowRuntime {
  readonly provider = 'github';
  readonly context: GitHubContext;
  readonly summary: WorkflowSummary;
  readonly env: NodeJS.ProcessEnv;
  protected readonly core: GitHubCoreAdapter;
  protected readonly artifactClient: ArtifactClient;
  protected readonly cacheClient: GitHubCacheClient;
  protected readonly outputs = new Map<string, string>();
  protected readonly artifactOperations: ArtifactOperationSnapshot[] = [];
  protected readonly cacheOperations: CacheOperationSnapshot[] = [];
  protected diagnosticCount = 0;

  constructor(options: GitHubRuntimeOptions = {}) {
    this.env = options.env ?? process.env;
    this.core = options.core ?? core;
    this.artifactClient = options.artifactClient ?? new DefaultArtifactClient();
    this.cacheClient = options.cacheClient ?? actionsCache;
    this.context = createGitHubContext(this.env, options.payload ?? loadPayload(this.env));
    this.summary = new WorkflowSummary(options.summarySink ?? new GitHubSummarySink(this.env));
  }

  static isAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.GITHUB_ACTIONS === 'true';
  }

  debug(message: string): void {
    this.core.debug(message);
  }
  info(message: string): void {
    this.core.info(message);
  }
  notice(message: string, location?: AnnotationLocation): void {
    this.diagnosticCount++;
    this.core.notice(message, location);
  }
  warning(message: string, location?: AnnotationLocation): void {
    this.diagnosticCount++;
    this.core.warning(message, location);
  }
  error(message: string, location?: AnnotationLocation): void {
    this.diagnosticCount++;
    this.core.error(message, location);
  }
  group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.core.group(name, fn);
  }
  maskSecret(value: string): void {
    this.core.setSecret(value);
  }
  async setOutput(name: string, value: unknown): Promise<void> {
    this.outputs.set(name, String(value));
    this.core.setOutput(name, value);
  }
  async exportVariable(name: string, value: unknown): Promise<void> {
    this.core.exportVariable(name, value);
  }
  async addPath(path: string): Promise<void> {
    this.core.addPath(path);
  }
  async saveState(name: string, value: unknown): Promise<void> {
    this.core.saveState(name, value);
  }
  getState(name: string): string | undefined {
    return optional(this.core.getState(name));
  }
  getInput(name: string, options?: { required?: boolean; trimWhitespace?: boolean }): string {
    return this.core.getInput(name, options);
  }
  getBooleanInput(
    name: string,
    options?: { required?: boolean; trimWhitespace?: boolean }
  ): boolean {
    return this.core.getBooleanInput(name, options);
  }
  getMultilineInput(
    name: string,
    options?: { required?: boolean; trimWhitespace?: boolean }
  ): string[] {
    return this.core.getMultilineInput(name, options);
  }
  getIDToken(audience?: string): Promise<string> {
    return this.core.getIDToken(audience);
  }
  getClient(token: string): ReturnType<typeof github.getOctokit> {
    return github.getOctokit(token);
  }

  async uploadArtifact(name: string, files: string[], options: UploadWorkflowArtifactOptions = {}) {
    const { rootDirectory, ...uploadOptions } = options;
    const result = await this.artifactClient.uploadArtifact(
      name,
      files,
      rootDirectory ?? this.context.workspace ?? process.cwd(),
      uploadOptions
    );
    this.artifactOperations.push({ operation: 'upload', name, fileCount: files.length });
    return result;
  }

  async downloadArtifact(name: string, options: DownloadWorkflowArtifactOptions = {}) {
    const { findBy, ...downloadOptions } = options;
    const findOptions = findBy ? { findBy } : {};
    const { artifact } = await this.artifactClient.getArtifact(name, findOptions);
    const result = await this.artifactClient.downloadArtifact(artifact.id, {
      ...downloadOptions,
      ...findOptions
    });
    this.artifactOperations.push({ operation: 'download', name });
    return result;
  }

  isCacheAvailable(): boolean {
    return this.cacheClient.isFeatureAvailable();
  }

  async restoreCache(
    paths: string[],
    primaryKey: string,
    restoreKeys?: string[],
    options?: Parameters<typeof actionsCache.restoreCache>[3],
    enableCrossOsArchive?: boolean
  ): Promise<string | undefined> {
    const matchedKey = await this.cacheClient.restoreCache(
      paths,
      primaryKey,
      restoreKeys,
      options,
      enableCrossOsArchive
    );
    this.cacheOperations.push({
      operation: 'restore',
      pathCount: paths.length,
      keyDigest: createHash('sha256').update(primaryKey).digest('hex'),
      hit: matchedKey !== undefined
    });
    return matchedKey;
  }

  async saveCache(
    paths: string[],
    key: string,
    options?: Parameters<typeof actionsCache.saveCache>[2],
    enableCrossOsArchive?: boolean
  ): Promise<number> {
    const cacheId = await this.cacheClient.saveCache(paths, key, options, enableCrossOsArchive);
    this.cacheOperations.push({
      operation: 'save',
      pathCount: paths.length,
      keyDigest: createHash('sha256').update(key).digest('hex')
    });
    return cacheId;
  }

  getExecutionSnapshot(): WorkflowExecutionSnapshot {
    return {
      outputs: Object.fromEntries(this.outputs),
      artifacts: [...this.artifactOperations],
      caches: [...this.cacheOperations],
      diagnosticCount: this.diagnosticCount
    };
  }
}

export type GitHubApiClient = ReturnType<typeof github.getOctokit>;

export interface UpsertIssueCommentOptions {
  owner: string;
  repo: string;
  issueNumber: number;
  marker: string;
  body: string;
}

/** Create or update a bot-authored marker comment, useful for stable PR reports. */
export async function upsertIssueComment(
  client: GitHubApiClient,
  options: UpsertIssueCommentOptions
): Promise<'created' | 'updated'> {
  const comments = await client.paginate(client.rest.issues.listComments, {
    owner: options.owner,
    repo: options.repo,
    issue_number: options.issueNumber,
    per_page: 100
  });
  const previous = comments.find(
    (comment) => comment.user?.type === 'Bot' && comment.body?.includes(options.marker)
  );
  if (previous) {
    await client.rest.issues.updateComment({
      owner: options.owner,
      repo: options.repo,
      comment_id: previous.id,
      body: options.body
    });
    return 'updated';
  }
  await client.rest.issues.createComment({
    owner: options.owner,
    repo: options.repo,
    issue_number: options.issueNumber,
    body: options.body
  });
  return 'created';
}

export async function readGitHubSummary(path: string): Promise<string> {
  return readFile(path, 'utf8');
}
