import { afterEach, describe, expect, it, vi } from 'vitest';

import bz, {
  BzTasks,
  InterfaceTasks,
  defaultTask,
  help,
  vars,
  type BeelzebubConfig
} from '../src/index.js';
import { createTestConfig } from './helpers.js';

afterEach(() => {
  bz.delete();
  vi.restoreAllMocks();
});

describe('interface task replacement', () => {
  it('registers synchronous replacement classes', async () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);

    class ReplacementTasks extends BzTasks {
      work(): void {
        this.logger.log('replacement worked');
      }
    }

    class SyncInterface extends InterfaceTasks {
      override $replaceWith(): unknown {
        return ReplacementTasks;
      }
    }

    app.add(SyncInterface);
    await app.run('SyncInterface.work');

    expect(logger.messages('log')).toContain('replacement worked');
  });

  it('registers asynchronously resolved replacement classes', async () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);

    class ReplacementTasks extends BzTasks {
      work(): void {
        this.logger.log('async replacement worked');
      }
    }

    class AsyncInterface extends InterfaceTasks {
      override $replaceWith(): Promise<typeof ReplacementTasks> {
        return Promise.resolve(ReplacementTasks);
      }
    }

    app.add(AsyncInterface);
    await app.run('AsyncInterface.work');

    expect(logger.messages('log')).toContain('async replacement worked');
  });

  it('logs empty and rejected replacements', async () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);

    class EmptyInterface extends InterfaceTasks {}
    class RejectedInterface extends InterfaceTasks {
      override $replaceWith(): Promise<never> {
        return Promise.reject(new Error('replacement rejected'));
      }
    }

    app.add(EmptyInterface);
    app.add(RejectedInterface);
    await app.getInitPromise();

    expect(logger.messages('error').join('\n')).toContain('$replaceWith should be replaced');
    expect(logger.messages('error').join('\n')).toContain('$replaceWith Error:');
    expect(logger.messages('error').join('\n')).toContain('replacement rejected');
  });
});

type Initializer = (this: unknown) => void;

function decoratorContext(kind: string, name = 'build') {
  const initializers: Initializer[] = [];
  const context = {
    kind,
    name,
    addInitializer(initializer: Initializer) {
      initializers.push(initializer);
    }
  } as unknown as ClassMethodDecoratorContext;
  return { context, initializers };
}

describe('standard decorators', () => {
  it('initializes default, help, and variable metadata', () => {
    const defaultContext = decoratorContext('method', 'defaultBuild');
    const helpContext = decoratorContext('method', 'documented');
    const varsContext = decoratorContext('method', 'configured');
    const target: {
      $defaultTask?: string | symbol;
      $setTaskHelpDocs: ReturnType<typeof vi.fn>;
      $defineTaskVars: ReturnType<typeof vi.fn>;
    } = {
      $setTaskHelpDocs: vi.fn(),
      $defineTaskVars: vi.fn()
    };

    defaultTask(undefined, defaultContext.context);
    help('Build documentation')(undefined, helpContext.context);
    vars({ count: { type: 'number' } })(undefined, varsContext.context);
    for (const initializer of [
      ...defaultContext.initializers,
      ...helpContext.initializers,
      ...varsContext.initializers
    ]) {
      initializer.call(target);
    }

    expect(target.$defaultTask).toBe('defaultBuild');
    expect(target.$setTaskHelpDocs).toHaveBeenCalledWith('documented', 'Build documentation');
    expect(target.$defineTaskVars).toHaveBeenCalledWith('configured', {
      count: { type: 'number' }
    });
  });

  it('rejects non-method decorator contexts', () => {
    const field = decoratorContext('field').context;

    expect(() => defaultTask(undefined, field)).toThrow(
      '@defaultTask can only be applied to methods'
    );
    expect(() => help('description')(undefined, field)).toThrow(
      '@help can only be applied to methods'
    );
    expect(() => vars({})(undefined, field)).toThrow('@vars can only be applied to methods');
  });
});

describe('public task metadata helpers', () => {
  it('stores configuration, global variables, help, and var definitions', async () => {
    const { config } = createTestConfig();
    const app = bz.create(config);

    class MetadataTasks extends BzTasks {
      constructor(taskConfig: BeelzebubConfig) {
        super(taskConfig);
        this.$setTaskHelpDocs('build', 'Build everything');
        this.$defineTaskVars('build', { count: { type: 'number' } });
      }

      build(): void {}
    }

    const tasks = new MetadataTasks({ ...config, beelzebub: app });
    await tasks.$register();
    tasks.$setGlobalVars({ mode: 'test' });

    expect(tasks.$config().beelzebub).toBe(app);
    expect(tasks.$getGlobalVars()).toEqual({ mode: 'test' });
    expect(tasks.$getVarDefsForTaskName('build')).toEqual({ count: { type: 'number' } });
    expect(tasks.$getVarDefsForTaskName('missing')).toBeUndefined();
  });
});
