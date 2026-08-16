import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
