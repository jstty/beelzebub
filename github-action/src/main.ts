import path from 'node:path';

import * as core from '@actions/core';

import {
  BzCLI,
  type Beelzebub,
  type TaskExecution,
  type WorkflowRuntime
} from '../../src/index.js';

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

async function main(): Promise<void> {
  let app: Beelzebub | undefined;
  try {
    const cwd = path.resolve(core.getInput('working-directory') || '.');
    const file = core.getInput('file') || 'beelzebub.ts';
    const tasks = core.getMultilineInput('task', { required: true });
    const args = core.getMultilineInput('args');
    const failureMode = core.getInput('failure-mode') === 'log' ? 'log' : 'throw';

    app = await new BzCLI().run({
      cwd,
      file,
      args: [...tasks, ...args],
      config: { verbose: true, failureMode }
    });
    await writeSummary(app);

    const executions = app?.getExecutions() ?? [];
    core.setOutput('task-count', executions.length);
    core.setOutput('conclusion', process.exitCode ? 'failure' : 'success');
    if (process.exitCode) core.setFailed('Beelzebub pipeline failed');
  } catch (error) {
    try {
      await writeSummary(app);
    } catch (summaryError) {
      core.error(summaryError instanceof Error ? summaryError : String(summaryError));
    }
    core.setFailed(error instanceof Error ? error : String(error));
  }
}

void main();
