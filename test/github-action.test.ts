import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readActionOutputs(outputPath: string): Record<string, string> {
  const lines = readFileSync(outputPath, 'utf8').split('\n');
  const outputs: Record<string, string> = {};
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const heredoc = /^([^<]+)<<(.+)$/u.exec(line);
    if (heredoc) {
      const values: string[] = [];
      while (lines[index + 1] !== undefined && lines[index + 1] !== heredoc[2]) {
        values.push(lines[++index]!);
      }
      index++;
      outputs[heredoc[1]!] = values.join('\n');
      continue;
    }
    const separator = line.indexOf('=');
    if (separator > 0) outputs[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return outputs;
}

describe('bundled GitHub Action', () => {
  it('loads a TypeScript task file and writes outputs and a job summary', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-action-'));
    const outputPath = path.join(directory, 'output');
    const summaryPath = path.join(directory, 'summary');
    const eventPath = path.join(directory, 'event.json');
    writeFileSync(outputPath, '');
    writeFileSync(summaryPath, '');
    writeFileSync(eventPath, '{}');
    try {
      const result = spawnSync(process.execPath, ['github-action/dist/index.js'], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: 'push',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: 'jstty/beelzebub',
          GITHUB_STEP_SUMMARY: summaryPath,
          GITHUB_OUTPUT: outputPath,
          INPUT_FILE: 'test/fixtures/github-action-tasks.ts',
          INPUT_TASK: 'ActionFixture.run',
          'INPUT_WORKING-DIRECTORY': projectRoot,
          INPUT_SUMMARY: 'true',
          'INPUT_FAILURE-MODE': 'throw'
        }
      });

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(outputPath, 'utf8')).toContain('relative-typescript-import');
      expect(readFileSync(outputPath, 'utf8')).toContain('conclusion');
      expect(readFileSync(summaryPath, 'utf8')).toContain('Fixture summary');
      expect(readFileSync(summaryPath, 'utf8')).toContain('Beelzebub pipeline');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not fail the action for a handled pipeline failure', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-action-'));
    const outputPath = path.join(directory, 'output');
    const summaryPath = path.join(directory, 'summary');
    const eventPath = path.join(directory, 'event.json');
    writeFileSync(outputPath, '');
    writeFileSync(summaryPath, '');
    writeFileSync(eventPath, '{}');
    try {
      const result = spawnSync(process.execPath, ['github-action/dist/index.js'], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_STEP_SUMMARY: summaryPath,
          GITHUB_OUTPUT: outputPath,
          INPUT_FILE: 'test/fixtures/github-action-tasks.ts',
          INPUT_TASK: 'ActionFixture.handledFailure',
          'INPUT_WORKING-DIRECTORY': projectRoot,
          INPUT_SUMMARY: 'true',
          'INPUT_FAILURE-MODE': 'throw'
        }
      });

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(outputPath, 'utf8')).toContain('success');
      expect(readFileSync(summaryPath, 'utf8')).toContain('ActionFixture.fail');
      expect(readFileSync(summaryPath, 'utf8')).toContain('failure');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('runs bridge contract 1 with structured vars and bounded redacted outputs', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-action-'));
    const outputPath = path.join(directory, 'output');
    const summaryPath = path.join(directory, 'summary');
    const eventPath = path.join(directory, 'event.json');
    writeFileSync(outputPath, '');
    writeFileSync(summaryPath, '');
    writeFileSync(eventPath, '{}');
    const planHash = `sha256:${'a'.repeat(64)}`;
    try {
      const result = spawnSync(process.execPath, ['github-action/dist/index.js'], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: 'pull_request',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: 'jstty/beelzebub',
          GITHUB_STEP_SUMMARY: summaryPath,
          GITHUB_OUTPUT: outputPath,
          INPUT_FILE: 'test/fixtures/github-action-tasks.ts',
          INPUT_TASK: 'ActionFixture.run',
          'INPUT_WORKING-DIRECTORY': projectRoot,
          INPUT_SUMMARY: 'true',
          'INPUT_FAILURE-MODE': 'throw',
          'INPUT_BRIDGE-CONTRACT-VERSION': '1',
          'INPUT_PLAN-HASH': planHash,
          'INPUT_JOB-ID': 'test',
          'INPUT_MATRIX-JSON': '{"node":"24"}',
          'INPUT_VARS-JSON': '{"count":2,"label":"bridge"}',
          'INPUT_EXPECTED-OUTPUTS-JSON': JSON.stringify([
            { name: 'fixture-output', sensitive: true, maximumBytes: 1024 },
            { name: 'variable-output', sensitive: false, maximumBytes: 1024 }
          ]),
          INPUT_BOOTSTRAP: 'none'
        }
      });

      expect(result.status, result.stderr).toBe(0);
      const outputs = readActionOutputs(outputPath);
      expect(outputs['plan-hash']).toBe(planHash);
      expect(outputs['job-id']).toBe('test');
      expect(outputs['runtime-version']).toMatch(/^2\./u);
      expect(JSON.parse(outputs['outputs-json']!)).toEqual({
        'variable-output': '{"count":2,"label":"bridge"}'
      });
      expect(JSON.parse(outputs.result!)).toMatchObject({
        contractVersion: '1',
        planHash,
        jobId: 'test',
        matrix: { node: '24' },
        conclusion: 'success',
        redactedOutputs: ['fixture-output']
      });
      expect(outputs['outputs-json']).not.toContain('relative-typescript-import');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails the action for an unhandled task failure', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-action-'));
    const outputPath = path.join(directory, 'output');
    const summaryPath = path.join(directory, 'summary');
    const eventPath = path.join(directory, 'event.json');
    writeFileSync(outputPath, '');
    writeFileSync(summaryPath, '');
    writeFileSync(eventPath, '{}');
    try {
      const result = spawnSync(process.execPath, ['github-action/dist/index.js'], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_STEP_SUMMARY: summaryPath,
          GITHUB_OUTPUT: outputPath,
          INPUT_FILE: 'test/fixtures/github-action-tasks.ts',
          INPUT_TASK: 'ActionFixture.fail',
          'INPUT_WORKING-DIRECTORY': projectRoot,
          INPUT_SUMMARY: 'true',
          'INPUT_FAILURE-MODE': 'throw'
        }
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('expected handled failure');
      expect(readFileSync(outputPath, 'utf8')).toContain('failure');
      expect(readFileSync(summaryPath, 'utf8')).toContain('ActionFixture.fail');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
