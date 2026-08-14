import { afterEach, describe, expect, it, vi } from 'vitest';

import bz, { BzTasks, LocalWorkflowRuntime, WorkflowSummary } from '../src/index.js';
import { MemoryCommandRunner, MemorySummarySink, MemoryWorkflowRuntime } from '../src/testing.js';
import { createTestConfig } from './helpers.js';

const originalPath = process.env.PATH;

afterEach(() => {
  vi.restoreAllMocks();
  process.env.PATH = originalPath;
  delete process.env.BEELZEBUB_TEST_VARIABLE;
});

describe('workflow testing adapters', () => {
  it('tests commands, annotations, outputs, and summaries without side effects', async () => {
    const commandRunner = new MemoryCommandRunner().succeed('tests passed');
    const workflow = new MemoryWorkflowRuntime({ eventName: 'pull_request' });
    const app = bz.create(createTestConfig({ commandRunner, workflow }).config);

    class PipelineTasks extends BzTasks {
      async verify(): Promise<string> {
        const result = await this.$exec('npm', ['test']);
        this.workflow.notice('Verification passed');
        await this.workflow.setOutput('result', 'passed');
        await this.workflow.summary.heading('Verification', 2).paragraph(result.stdout).write();
        return result.stdout;
      }
    }

    app.add(PipelineTasks);
    await app.getInitPromise();
    await expect(app.run('PipelineTasks.verify')).resolves.toBe('tests passed');

    expect(commandRunner.calls).toEqual([
      expect.objectContaining({ command: 'npm', args: ['test'] })
    ]);
    expect(workflow.outputs.get('result')).toBe('passed');
    expect(workflow.calls).toContainEqual({
      method: 'notice',
      args: ['Verification passed', undefined]
    });
    expect(workflow.summarySink.content).toBe('## Verification\n\ntests passed\n');
  });

  it('can model process failure and assert the CI-safe rejection', async () => {
    const commandRunner = new MemoryCommandRunner().fail(2, 'failed');
    const app = bz.create(createTestConfig({ commandRunner }).config);

    class FailingPipeline extends BzTasks {
      verify() {
        return this.$exec('npm', ['test']);
      }
    }

    app.add(FailingPipeline);
    await app.getInitPromise();
    await expect(app.run('FailingPipeline.verify')).rejects.toMatchObject({
      name: 'CommandError',
      result: { exitCode: 2, stderr: 'failed' }
    });
  });

  it('renders every summary building block deterministically', async () => {
    const sink = new MemorySummarySink();
    const summary = new WorkflowSummary(sink);
    expect(summary.isEmpty()).toBe(true);

    summary
      .raw('raw')
      .heading('Heading', 3)
      .paragraph('paragraph')
      .codeBlock('const value = 1;', 'ts')
      .list(['one', 'two'])
      .list(['first'], true)
      .table([
        ['A', 'B'],
        ['pipe|value', 'line\nbreak']
      ])
      .details('<unsafe>', 'details')
      .link('GitHub]', 'https://example.test/a)')
      .separator();

    expect(summary.isEmpty()).toBe(false);
    expect(summary.render()).toContain('```ts\nconst value = 1;\n```');
    expect(summary.render()).toContain('pipe\\|value');
    expect(summary.render()).toContain('<summary>&lt;unsafe&gt;</summary>');
    expect(summary.render()).toContain('[GitHub\\]](https://example.test/a%29)');
    await summary.write({ overwrite: true });
    expect(sink.writes[0]?.options).toEqual({ overwrite: true });
    expect(summary.isEmpty()).toBe(true);

    summary.paragraph('discarded').empty();
    await summary.write();
    await summary.clear();
    expect(sink.content).toBe('');
  });

  it('records every memory workflow interaction and queued command behavior', async () => {
    const workflow = new MemoryWorkflowRuntime({ actor: 'octocat' });
    workflow.debug('debug');
    workflow.info('info');
    workflow.warning('warning', { file: 'a.ts' });
    workflow.error('error');
    await expect(workflow.group('group', async () => 'value')).resolves.toBe('value');
    workflow.maskSecret('secret');
    await workflow.exportVariable('MODE', 'ci');
    await workflow.addPath('/tools');
    await workflow.saveState('pid', 4);
    expect(workflow.getState('pid')).toBe('4');
    expect(workflow.variables.get('MODE')).toBe('ci');
    expect(workflow.paths).toEqual(['/tools']);
    expect(workflow.secrets).toEqual(['secret']);
    expect(workflow.calls.map(({ method }) => method)).toEqual([
      'debug',
      'info',
      'warning',
      'error',
      'group:start',
      'group:end',
      'maskSecret',
      'exportVariable',
      'addPath',
      'saveState'
    ]);

    const runner = new MemoryCommandRunner()
      .respond({ error: new Error('unavailable') })
      .respond({ exitCode: 2 });
    await expect(runner.exec('missing')).rejects.toThrow('unavailable');
    await expect(runner.exec('allowed', [], { acceptedExitCodes: [0, 2] })).resolves.toMatchObject({
      exitCode: 2
    });
  });

  it('provides a useful local workflow fallback', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const group = vi.spyOn(console, 'group').mockImplementation(() => {});
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const runtime = new LocalWorkflowRuntime({ eventName: 'local' });

    runtime.debug('debug');
    runtime.info('info');
    runtime.notice('notice');
    runtime.warning('warning');
    runtime.error('error');
    runtime.maskSecret('ignored');
    await expect(runtime.group('build', async () => 7)).resolves.toBe(7);
    await runtime.setOutput('result', 'ok');
    await runtime.exportVariable('BEELZEBUB_TEST_VARIABLE', 'yes');
    await runtime.addPath('/local/tools');
    await runtime.saveState('pid', 9);
    await runtime.summary.paragraph('Local summary').write();
    await runtime.summary.clear();

    expect(runtime.getState('pid')).toBe('9');
    expect(process.env.BEELZEBUB_TEST_VARIABLE).toBe('yes');
    expect(process.env.PATH?.startsWith('/local/tools')).toBe(true);
    expect(stdout).toHaveBeenCalledWith('Local summary\n');
    expect(
      [debug, info, warn, error, group, groupEnd].every((spy) => spy.mock.calls.length > 0)
    ).toBe(true);
  });
});
