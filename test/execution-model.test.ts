import { describe, expect, expectTypeOf, it } from 'vitest';

import bz, {
  BzTasks,
  PipelineCancelledError,
  always,
  cancelled,
  executePipeline,
  step,
  type PipelineResult,
  type PipelineStepEndEvent,
  type PipelineStepEvent,
  type PipelineStepResult
} from '../src/index.js';
import { MemoryCommandRunner } from '../src/testing.js';
import { createTestConfig } from './helpers.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('per-execution $emit', () => {
  it('reports each overlapping task of one class, even after an await', async () => {
    const app = bz.create(createTestConfig().config);
    const seen: Array<[string, unknown, unknown]> = [];

    class Overlap extends BzTasks {
      async slow(vars: Record<string, unknown>): Promise<void> {
        await tick();
        this.$emit('done', vars.n);
      }
      async fast(vars: Record<string, unknown>): Promise<void> {
        this.$emit('done', vars.n);
      }
      both() {
        return this.$parallel({ task: '.slow', vars: { n: 1 } }, { task: '.fast', vars: { n: 2 } });
      }
    }

    app.add(Overlap);
    app.on('done', (taskInfo, data) => {
      const info = taskInfo as { task: string; vars?: Record<string, unknown> };
      seen.push([info.task, info.vars?.n, data]);
    });
    await app.run('Overlap.both');

    expect(seen).toEqual([
      ['Overlap.fast', 2, 2],
      ['Overlap.slow', 1, 1]
    ]);
  });

  it('reports the task from $beforeEach and $afterEach, and the class outside a run', async () => {
    const app = bz.create(createTestConfig().config);
    const seen: string[] = [];

    class Hooks extends BzTasks {
      override $beforeEach(): void {
        this.$emit('hook');
      }
      override async $afterEach(): Promise<void> {
        await tick();
        this.$emit('hook');
      }
      work(): void {}
    }

    app.add(Hooks);
    app.on('hook', (taskInfo) => seen.push((taskInfo as { task: string }).task));
    await app.getInitPromise();
    await app.run('Hooks.work');
    expect(seen).toEqual(['Hooks.work', 'Hooks.work']);

    const tasks = new Hooks({ beelzebub: app, ...createTestConfig().config });
    tasks.$emit('hook');
    expect(seen.at(-1)).toBe('Hooks');
  });
});

describe('cancellation', () => {
  it('cancels the remaining steps, still runs cleanup, and rejects with PipelineCancelledError', async () => {
    const controller = new AbortController();
    const runner = new MemoryCommandRunner();
    const app = bz.create(
      createTestConfig({ signal: controller.signal, commandRunner: runner }).config
    );
    const calls: string[] = [];

    class Delivery extends BzTasks {
      first(): void {
        calls.push('first');
        controller.abort(new Error('stop requested'));
      }
      second(): void {
        calls.push('second');
      }
      async cleanup(): Promise<void> {
        calls.push(`cleanup aborted=${String(this.$signal.aborted)}`);
        await this.$exec('git', ['worktree', 'prune']);
      }
      run() {
        return this.$pipeline([
          { id: 'first', task: '.first' },
          { id: 'second', task: '.second' },
          { id: 'cleanup', task: '.cleanup', when: always() },
          { id: 'onCancel', task: '.cleanup', when: cancelled('second') }
        ]);
      }
    }

    app.add(Delivery);
    const rejection = await app.run('Delivery.run').catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(PipelineCancelledError);
    expect((rejection as PipelineCancelledError).result).toMatchObject({
      conclusion: 'cancelled',
      steps: {
        first: { outcome: 'success' },
        second: { outcome: 'cancelled' },
        cleanup: { outcome: 'success' },
        onCancel: { outcome: 'success' }
      }
    });
    expect(calls).toEqual(['first', 'cleanup aborted=false', 'cleanup aborted=false']);
    expect(runner.calls.map(({ options }) => options.signal?.aborted)).toEqual([false, false]);
  });

  it('records a step that rejects after the abort as cancelled', async () => {
    const controller = new AbortController();
    const runner = new MemoryCommandRunner();
    const app = bz.create(createTestConfig({ commandRunner: runner }).config);

    class Build extends BzTasks {
      async compile(): Promise<void> {
        controller.abort();
        await this.$exec('tsc');
      }
      run() {
        return this.$pipeline([{ id: 'compile', task: '.compile' }], { signal: controller.signal });
      }
    }

    app.add(Build);
    await expect(app.run('Build.run')).rejects.toMatchObject({
      name: 'PipelineCancelledError',
      result: { steps: { compile: { outcome: 'cancelled', conclusion: 'cancelled' } } }
    });
    expect(runner.calls[0]!.options.signal?.aborted).toBe(true);
    expect(app.getExecutions().find(({ task }) => task === 'Build.compile')).toMatchObject({
      outcome: 'cancelled'
    });
  });

  it('runs no hook or task body after an abort before run()', async () => {
    const controller = new AbortController();
    controller.abort(new Error('shutting down'));
    const app = bz.create(createTestConfig({ signal: controller.signal }).config);
    const calls: string[] = [];

    class Guarded extends BzTasks {
      override $beforeAll(): void {
        calls.push('beforeAll');
      }
      override $beforeEach(): void {
        calls.push('beforeEach');
      }
      work(): void {
        calls.push('work');
      }
    }

    app.add(Guarded);
    await expect(app.run('Guarded.work')).rejects.toThrow('shutting down');
    expect(calls).toEqual([]);
    expect(app.getExecutions()).toMatchObject([
      { task: 'Guarded.work', outcome: 'cancelled', conclusion: 'cancelled' }
    ]);
  });

  it('passes $signal to $exec, combined with the caller signal', async () => {
    const instance = new AbortController();
    const caller = new AbortController();
    const runner = new MemoryCommandRunner();
    const app = bz.create(
      createTestConfig({ signal: instance.signal, commandRunner: runner }).config
    );

    class Exec extends BzTasks {
      async run(): Promise<void> {
        await this.$exec('echo', ['one']);
        await this.$exec('echo', ['two'], { signal: caller.signal });
      }
    }

    app.add(Exec);
    await app.run('Exec.run');
    const [first, second] = runner.calls.map(({ options }) => options.signal!);
    expect(first).toBe(instance.signal);
    caller.abort();
    expect(second!.aborted).toBe(true);
    expect(instance.signal.aborted).toBe(false);
  });

  it('leaves $exec options alone without a signal, and the memory runner rejects when aborted', async () => {
    const runner = new MemoryCommandRunner();
    const app = bz.create(createTestConfig({ commandRunner: runner }).config);

    class Plain extends BzTasks {
      run() {
        return this.$exec('echo');
      }
    }

    app.add(Plain);
    await app.run('Plain.run');
    expect(runner.calls[0]!.options.signal).toBeUndefined();

    const aborted = AbortSignal.abort(new Error('aborted'));
    await expect(runner.exec('echo', [], { signal: aborted })).rejects.toThrow('aborted');
  });
});

describe('pipeline step events', () => {
  class Events extends BzTasks {
    ok(): string {
      return 'ok';
    }
    bad(): never {
      throw new Error('bad');
    }
    run() {
      return this.$pipeline([
        { id: 'lint', task: '.bad', continueOnError: true },
        { id: 'test', task: '.ok' },
        { id: 'skip', task: '.ok', when: () => false },
        { id: 'deploy', task: '.bad' },
        { id: 'after', task: '.ok' }
      ]);
    }
    other() {
      return this.$pipeline([{ id: 'x', task: '.ok' }], { id: 'custom' });
    }
  }

  it('emits $stepStart and $stepEnd in order, filtered by the calling task', async () => {
    const app = bz.create(createTestConfig().config);
    const events: string[] = [];
    let ends: PipelineStepEndEvent[] = [];

    app.add(Events);
    app.on('$stepStart', 'Events.run', (_info, event) => {
      events.push(`start ${(event as PipelineStepEvent).stepId}`);
    });
    app.on('$stepEnd', 'Events.run', (_info, event) => {
      const end = event as PipelineStepEndEvent;
      ends.push(end);
      events.push(`end ${end.stepId} ${end.outcome}/${end.conclusion}`);
    });

    const error = (await app.run('Events.run').catch((e: unknown) => e)) as {
      result: PipelineResult;
    };
    expect(events).toEqual([
      'start lint',
      'end lint failure/success',
      'start test',
      'end test success/success',
      'end skip skipped/skipped',
      'start deploy',
      'end deploy failure/failure',
      'end after skipped/skipped'
    ]);
    for (const end of ends) {
      const result = error.result.steps[end.stepId]!;
      expect(end.pipelineId).toBe('Events.run');
      expect(end.startedAt).toEqual(result.startedAt);
      expect(end.completedAt).toEqual(result.completedAt);
      expect(end.durationMs).toBe(result.durationMs);
    }

    ends = [];
    events.length = 0;
    await app.run('Events.other');
    expect(events).toEqual([]);
  });

  it('uses the pipeline id option, and a throwing listener changes no outcome', async () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);
    const ids: string[] = [];

    app.add(Events);
    app.on('$stepStart', (_info, event) => {
      ids.push((event as PipelineStepEvent).pipelineId);
      throw new Error('listener bug');
    });
    app.on('$stepEnd', () => {
      throw new Error('listener bug');
    });

    await expect(app.run('Events.other')).resolves.toMatchObject({
      conclusion: 'success',
      steps: { x: { outcome: 'success', value: 'ok' } }
    });
    expect(ids).toEqual(['custom']);
    expect(logger.messages('error').some((message) => message.includes('listener failed'))).toBe(
      true
    );
  });

  it('calls executePipeline hooks and survives a throwing hook', async () => {
    const seen: string[] = [];
    const result = await executePipeline(
      [
        { id: 'a', task: 1 },
        { id: 'b', task: 2, when: () => false }
      ],
      async (task) => task,
      {
        onStepStart: (event) => {
          seen.push(`start ${event.stepId} ${event.pipelineId}`);
          throw new Error('hook bug');
        },
        onStepEnd: (event) => seen.push(`end ${event.stepId} ${event.outcome}`)
      }
    );
    expect(result.conclusion).toBe('success');
    expect(seen).toEqual(['start a pipeline', 'end a success', 'end b skipped']);
  });
});

describe('typed pipelines', () => {
  it('records function steps under their step id with their values', async () => {
    const app = bz.create(createTestConfig().config);

    class Typed extends BzTasks {
      build(): string {
        return 'dist';
      }
      run() {
        return this.$pipeline([
          step('count', () => 3),
          step('label', async () => 'ready'),
          { id: 'build', task: '.build' }
        ]);
      }
    }

    app.add(Typed);
    const result = await app.run<Awaited<ReturnType<Typed['run']>>>('Typed.run');

    expect(result.steps.count.value).toBe(3);
    expect(result.steps.label.value).toBe('ready');
    expect(result.order).toEqual(['count', 'label', 'build']);
    expect(app.getExecutions().map(({ task }) => task)).toEqual([
      'Typed.count',
      'Typed.label',
      'Typed.build',
      'Typed.run'
    ]);
  });

  it('infers step values, ids, and unknown defaults', () => {
    class Shape extends BzTasks {
      run() {
        return this.$pipeline([
          step('count', () => 3),
          step('label', async () => 'ready'),
          { id: 'inline', task: () => true },
          { id: 'path', task: '.other' }
        ]);
      }
    }
    type Result = Awaited<ReturnType<Shape['run']>>;
    expectTypeOf<Result['steps']['count']>().toEqualTypeOf<PipelineStepResult<number>>();
    expectTypeOf<Result['steps']['label']>().toEqualTypeOf<PipelineStepResult<string>>();
    expectTypeOf<Result['steps']['inline']>().toEqualTypeOf<PipelineStepResult<boolean>>();
    expectTypeOf<Result['steps']['path']>().toEqualTypeOf<PipelineStepResult<unknown>>();
    expectTypeOf<Result['order']>().toEqualTypeOf<
      readonly ('count' | 'label' | 'inline' | 'path')[]
    >();
    expectTypeOf<PipelineResult['steps']>().toEqualTypeOf<{
      readonly [x: string]: PipelineStepResult<unknown>;
    }>();
    expectTypeOf(bz.create().run<number>('x')).toEqualTypeOf<Promise<number>>();
    expectTypeOf(bz.create().run('x')).toEqualTypeOf<Promise<unknown>>();
  });
});

describe('typed context', () => {
  class Host {
    readonly calls: string[] = [];
  }

  it('passes the context by reference to constructors, sub-tasks, and added instances', async () => {
    const host = new Host();
    const plain = { token: 'abc' };
    const app = bz.create<Host>({ ...createTestConfig().config, context: host });
    const seen: unknown[] = [];

    class Child extends BzTasks<Host> {
      work(): void {
        seen.push(this.$context);
      }
    }
    class Parent extends BzTasks<Host> {
      constructor(config = {}) {
        super(config);
        seen.push(this.$context);
        void this.$addSubTasks(Child);
      }
      work(): void {
        this.$context.calls.push('work');
      }
    }
    class Plain extends BzTasks<typeof plain> {
      read() {
        return this.$context;
      }
    }

    app.add(Parent);
    app.add(new Plain({ beelzebub: app, context: plain }));
    await app.run('Parent.work', 'Parent.Child.work');
    const read = await app.run<typeof plain>('Plain.read');

    expect(seen).toEqual([host, host]);
    expect(seen[0]).toBe(host);
    expect(seen[1]).toBe(host);
    expect(host.calls).toEqual(['work']);
    expect(read).toBe(plain);
    expect(app.getConfig().context).toBe(host);
  });

  it('lets add() supply a plain-object context without copying it', async () => {
    const plain = { token: 'abc' };
    const app = bz.create(createTestConfig({ context: { token: 'instance' } }).config);

    class Reader extends BzTasks<typeof plain> {
      read() {
        return this.$context;
      }
    }

    app.add(Reader, { context: plain });
    await expect(app.run('Reader.read')).resolves.toBe(plain);
  });

  it('types $context and the instance config', () => {
    class Typed extends BzTasks<Host> {
      read() {
        return this.$context;
      }
    }
    expectTypeOf<ReturnType<Typed['read']>>().toEqualTypeOf<Host>();
    expectTypeOf(bz.create<Host>({ context: new Host() }).getConfig().context).toEqualTypeOf<
      Host | undefined
    >();
  });
});
