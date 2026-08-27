import { describe, expect, it } from 'vitest';

import { createCI } from '../beelzebub.ci.js';
import { MemoryCommandRunner, MemoryWorkflowRuntime } from '../src/testing.js';
import { createTestConfig } from './helpers.js';

describe('repository CI pipeline', () => {
  it('defines the verification command order as testable TypeScript', async () => {
    const commandRunner = new MemoryCommandRunner();
    const workflow = new MemoryWorkflowRuntime();
    const app = createCI(createTestConfig({ commandRunner, workflow }).config);

    const result = await app.run('CI.verify');

    expect(result).toMatchObject({ conclusion: 'success' });
    expect(commandRunner.calls.map(({ command, args }) => [command, ...args])).toEqual([
      ['npm', 'run', 'format:check'],
      ['npm', 'run', 'lint'],
      ['npm', 'run', 'typecheck'],
      ['npm', 'run', 'test'],
      ['npm', 'run', 'build'],
      ['npm', 'run', 'test:package']
    ]);
  });
});
