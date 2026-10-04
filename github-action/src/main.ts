import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import * as core from '@actions/core';

import type {
  Beelzebub,
  TaskExecution,
  WorkflowExecutionSnapshot,
  WorkflowRuntime
} from '../../src/index.js';

type BeelzebubModule = Pick<typeof import('../../src/index.js'), 'BzCLI'>;

interface LoadedBeelzebub {
  readonly module: BeelzebubModule;
  readonly version: string;
}

interface ExpectedOutput {
  readonly name: string;
  readonly sensitive: boolean;
  readonly maximumBytes: number;
}

const bridgeContractVersion = '1';
const maximumStructuredOutputBytes = 64 * 1024;
const planHashPattern = /^sha256:[a-f0-9]{64}$/u;
const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const outputNamePattern = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/u;
const safeRelativePathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;

function findPackageVersion(entry: string): string {
  let directory = path.dirname(entry);
  for (;;) {
    const manifestPath = path.join(directory, 'package.json');
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        name?: unknown;
        version?: unknown;
      };
      if (manifest.name === 'beelzebub' && typeof manifest.version === 'string') {
        return manifest.version;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`Unable to find the Beelzebub package manifest for ${entry}.`);
}

function loadBeelzebub(cwd: string): LoadedBeelzebub {
  const requireFromProject = createRequire(path.join(cwd, 'package.json'));
  try {
    const entry = requireFromProject.resolve('beelzebub');
    return {
      module: requireFromProject('beelzebub') as BeelzebubModule,
      version: findPackageVersion(entry)
    };
  } catch (error) {
    throw new Error(
      `Unable to load Beelzebub from ${cwd}. Configure the bridge bootstrap or install the project dependencies before running the action.`,
      { cause: error }
    );
  }
}

function executionRows(executions: readonly TaskExecution[]): Array<Array<string | number>> {
  return [
    ['Task', 'Outcome', 'Duration'],
    ...executions.map((execution) => [
      execution.task,
      execution.outcome === 'success' ? '✅ success' : '❌ failure',
      `${execution.durationMs} ms`
    ])
  ];
}

async function writeSummary(app: Beelzebub | undefined): Promise<void> {
  if (!app || !core.getBooleanInput('summary')) return;
  const workflow = app.getConfig().workflow as WorkflowRuntime | undefined;
  if (!workflow) return;
  const executions = app.getExecutions();
  await workflow.summary.heading('Beelzebub pipeline', 2).table(executionRows(executions)).write();
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`${label} must be valid JSON.`, { cause: error });
  }
}

function parseRecord(value: string, label: string): Record<string, unknown> {
  const parsed = parseJson(value, label);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function parseExpectedOutputs(value: string): ExpectedOutput[] {
  const parsed = parseJson(value, 'expected-outputs-json');
  if (!Array.isArray(parsed)) throw new Error('expected-outputs-json must be a JSON array.');
  return parsed.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error(`expected-outputs-json[${index}] must be an object.`);
    }
    const output = candidate as Record<string, unknown>;
    if (typeof output.name !== 'string' || !outputNamePattern.test(output.name)) {
      throw new Error(`expected-outputs-json[${index}].name is invalid.`);
    }
    if (typeof output.sensitive !== 'boolean') {
      throw new Error(`expected-outputs-json[${index}].sensitive must be boolean.`);
    }
    if (
      typeof output.maximumBytes !== 'number' ||
      !Number.isSafeInteger(output.maximumBytes) ||
      output.maximumBytes <= 0 ||
      output.maximumBytes > maximumStructuredOutputBytes
    ) {
      throw new Error(
        `expected-outputs-json[${index}].maximumBytes must be from 1 through ${maximumStructuredOutputBytes}.`
      );
    }
    return {
      name: output.name,
      sensitive: output.sensitive,
      maximumBytes: output.maximumBytes
    };
  });
}

function taskArguments(task: string, variables: Record<string, unknown>): string[] {
  return [
    task,
    ...Object.entries(variables)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => {
        if (!outputNamePattern.test(name)) throw new Error(`Task variable '${name}' is invalid.`);
        const encoded = typeof value === 'string' ? value : JSON.stringify(value);
        if (encoded === undefined) throw new Error(`Task variable '${name}' cannot be undefined.`);
        return `--${name}=${encoded}`;
      })
  ];
}

function runBootstrap(cwd: string): void {
  const adapter = core.getInput('bootstrap') || 'none';
  let command: string | undefined;
  let args: string[] = [];
  if (adapter === 'npm') [command, args] = ['npm', ['ci']];
  else if (adapter === 'pnpm') [command, args] = ['pnpm', ['install', '--frozen-lockfile']];
  else if (adapter === 'yarn') [command, args] = ['yarn', ['install', '--immutable']];
  else if (adapter === 'custom') {
    const parsed = parseJson(
      core.getInput('bootstrap-command-json') || '[]',
      'bootstrap-command-json'
    );
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      parsed.some((value) => typeof value !== 'string')
    ) {
      throw new Error('custom bootstrap-command-json must be a non-empty JSON string array.');
    }
    [command, ...args] = parsed as string[];
  } else if (adapter !== 'none') {
    throw new Error(`Unsupported bootstrap adapter '${adapter}'.`);
  }
  if (!command) return;
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.error)
    throw new Error(`Unable to start ${adapter} bootstrap.`, { cause: result.error });
  if (result.status !== 0)
    throw new Error(`${adapter} bootstrap exited with status ${String(result.status)}.`);
}

function setBoundedOutput(name: string, value: string): void {
  const bytes = Buffer.byteLength(value);
  if (bytes > maximumStructuredOutputBytes) {
    throw new Error(
      `Structured output '${name}' is ${bytes} bytes; the bridge limit is ${maximumStructuredOutputBytes} bytes.`
    );
  }
  core.setOutput(name, value);
}

function emptySnapshot(): WorkflowExecutionSnapshot {
  return { outputs: {}, artifacts: [], caches: [], diagnosticCount: 0 };
}

function executionSnapshot(app: Beelzebub, required: boolean): WorkflowExecutionSnapshot {
  const workflow = app.getConfig().workflow as Partial<WorkflowRuntime> | undefined;
  if (workflow?.getExecutionSnapshot) return workflow.getExecutionSnapshot();
  if (required) {
    throw new Error(
      'Bridge contract 1 requires a Beelzebub runtime with execution snapshot support; upgrade the project runtime.'
    );
  }
  return emptySnapshot();
}

function validateRuntimeVersion(version: string): void {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  if (major !== 2) {
    throw new Error(
      `Bridge contract ${bridgeContractVersion} requires Beelzebub 2.x; the project resolved ${version}.`
    );
  }
}

async function main(): Promise<void> {
  let app: Beelzebub | undefined;
  let structured = false;
  let planHash = '';
  let jobId = '';
  let runtimeVersion = '';
  try {
    const cwd = path.resolve(core.getInput('working-directory') || '.');
    const file = core.getInput('file') || 'beelzebub.ts';
    const tasks = core.getMultilineInput('task', { required: true });
    const args = core.getMultilineInput('args');
    const failureMode = core.getInput('failure-mode') === 'log' ? 'log' : 'throw';
    const contract = core.getInput('bridge-contract-version') || 'legacy';
    structured = contract === bridgeContractVersion;
    if (contract !== 'legacy' && !structured)
      throw new Error(`Unsupported bridge contract '${contract}'.`);

    let matrix: Record<string, unknown> = {};
    let variables: Record<string, unknown> = {};
    let expectedOutputs: ExpectedOutput[] = [];
    if (structured) {
      planHash = core.getInput('plan-hash', { required: true });
      jobId = core.getInput('job-id', { required: true });
      if (!planHashPattern.test(planHash))
        throw new Error('plan-hash is not a canonical SHA-256 plan ID.');
      if (!identifierPattern.test(jobId)) throw new Error('job-id is invalid.');
      if (tasks.length !== 1) throw new Error('Bridge contract 1 requires exactly one task.');
      if (args.length > 0)
        throw new Error('Bridge contract 1 uses vars-json instead of unstructured args.');
      matrix = parseRecord(core.getInput('matrix-json') || '{}', 'matrix-json');
      variables = parseRecord(core.getInput('vars-json') || '{}', 'vars-json');
      expectedOutputs = parseExpectedOutputs(core.getInput('expected-outputs-json') || '[]');
      const eventFixture = core.getInput('event-fixture');
      if (eventFixture) {
        if (!safeRelativePathPattern.test(eventFixture))
          throw new Error('event-fixture must be repository-relative.');
        process.env.GITHUB_EVENT_PATH = path.resolve(cwd, eventFixture);
      }
    }

    runBootstrap(cwd);
    const loaded = loadBeelzebub(cwd);
    runtimeVersion = loaded.version;
    if (structured) validateRuntimeVersion(runtimeVersion);

    app = await new loaded.module.BzCLI().run({
      cwd,
      file,
      args: structured ? taskArguments(tasks[0]!, variables) : [...tasks, ...args],
      config: { verbose: true, failureMode }
    });
    await writeSummary(app);

    const executions = app?.getExecutions() ?? [];
    const snapshot = app ? executionSnapshot(app, structured) : emptySnapshot();
    const conclusion = process.exitCode ? 'failure' : 'success';
    core.setOutput('task-count', executions.length);
    core.setOutput('conclusion', conclusion);
    if (structured) {
      const selectedOutputs: Record<string, string> = {};
      const redactedOutputs: string[] = [];
      let missingOutputs = 0;
      for (const expected of expectedOutputs) {
        const value = snapshot.outputs[expected.name];
        if (value === undefined) {
          core.warning(`Expected task output '${expected.name}' was not produced.`);
          missingOutputs++;
          continue;
        }
        if (Buffer.byteLength(value) > expected.maximumBytes) {
          throw new Error(
            `Task output '${expected.name}' exceeds its ${expected.maximumBytes}-byte contract.`
          );
        }
        if (expected.sensitive) redactedOutputs.push(expected.name);
        else selectedOutputs[expected.name] = value;
      }
      const operationSummary = JSON.stringify({
        artifacts: snapshot.artifacts,
        caches: snapshot.caches
      });
      const diagnosticCount = snapshot.diagnosticCount + missingOutputs;
      const result = JSON.stringify({
        contractVersion: bridgeContractVersion,
        planHash,
        jobId,
        matrix,
        conclusion,
        runtimeVersion,
        taskCount: executions.length,
        executions: executions.map(({ task, outcome, conclusion: taskConclusion, durationMs }) => ({
          task,
          outcome,
          conclusion: taskConclusion,
          durationMs
        })),
        outputs: selectedOutputs,
        redactedOutputs,
        operations: JSON.parse(operationSummary) as unknown,
        diagnosticCount
      });
      core.setOutput('plan-hash', planHash);
      core.setOutput('job-id', jobId);
      core.setOutput('runtime-version', runtimeVersion);
      core.setOutput('diagnostic-count', diagnosticCount);
      setBoundedOutput('outputs-json', JSON.stringify(selectedOutputs));
      setBoundedOutput('artifact-cache-summary', operationSummary);
      setBoundedOutput('result', result);
    }
    if (process.exitCode) core.setFailed('Beelzebub pipeline failed');
  } catch (error) {
    try {
      await writeSummary(app);
    } catch (summaryError) {
      core.error(summaryError instanceof Error ? summaryError : String(summaryError));
    }
    core.setOutput('conclusion', 'failure');
    if (structured) {
      if (planHash) core.setOutput('plan-hash', planHash);
      if (jobId) core.setOutput('job-id', jobId);
      if (runtimeVersion) core.setOutput('runtime-version', runtimeVersion);
      try {
        setBoundedOutput(
          'result',
          JSON.stringify({
            contractVersion: bridgeContractVersion,
            planHash,
            jobId,
            conclusion: 'failure',
            runtimeVersion,
            errorCode: 'BZ_ACTION_FAILED'
          })
        );
      } catch (outputError) {
        core.error(outputError instanceof Error ? outputError : String(outputError));
      }
    }
    core.setFailed(error instanceof Error ? error : String(error));
  }
}

void main();
