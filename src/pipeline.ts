import type { BzTasks } from './bzTasksClass.js';
import { neverAbortedSignal } from './execution.js';

export type PipelineOutcome = 'success' | 'failure' | 'skipped' | 'cancelled';

export interface PipelineStepResult<T = unknown> {
  id: string;
  outcome: PipelineOutcome;
  conclusion: PipelineOutcome;
  value?: T;
  error?: Error;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export interface PipelineContext {
  readonly steps: Readonly<Record<string, PipelineStepResult>>;
}

export type PipelineCondition = (context: PipelineContext) => boolean | Promise<boolean>;

/** A step for `executePipeline`: `task` is whatever its `execute` callback understands. */
export interface PipelineDefinition {
  id: string;
  task: unknown;
  when?: PipelineCondition;
  continueOnError?: boolean;
}

/** A task path with variables, as accepted by `$run`. */
export interface TaskReference {
  task: string;
  vars?: Record<string, unknown>;
}

/**
 * A `$pipeline` step. `task` is a task path (`'.build'`, `'Build.compile'`), a
 * task reference, or a function run with the calling task class as `this`.
 * `T` is the step's value, inferred from a function task.
 */
export interface PipelineStep<T = unknown> extends PipelineDefinition {
  task: string | TaskReference | ((this: BzTasks) => T | Promise<T>);
}

/** Build a function step whose id and value type are inferred. */
export function step<const Id extends string, T>(
  id: Id,
  task: (this: BzTasks) => T | Promise<T>,
  options: Pick<PipelineStep, 'when' | 'continueOnError'> = {}
): PipelineStep<T> & { id: Id } {
  return { ...options, id, task };
}

/** Step values by step id, inferred from a `$pipeline` step list. */
export type PipelineValues<S extends readonly PipelineDefinition[]> = {
  [K in S[number] as K['id']]: K extends PipelineStep<infer T> ? T : unknown;
};

export interface PipelineResult<V extends Record<string, unknown> = Record<string, unknown>> {
  readonly steps: { readonly [K in keyof V]: PipelineStepResult<V[K]> };
  readonly order: readonly (keyof V & string)[];
  readonly conclusion: PipelineOutcome;
}

export interface PipelineOptions {
  /** Cancels the pipeline; combined with the calling task's `$signal`. */
  signal?: AbortSignal;
  /** Identifies the pipeline in step events. Default: the calling task's full name. */
  id?: string;
}

export interface PipelineStepEvent {
  pipelineId: string;
  stepId: string;
  startedAt: Date;
}

export interface PipelineStepEndEvent<T = unknown>
  extends PipelineStepEvent, PipelineStepResult<T> {}

/** What `executePipeline` hands its `execute` callback for each step that runs. */
export interface PipelineStepExecution {
  readonly stepId: string;
  /**
   * The step's signal: the pipeline signal, or, for a step that runs after
   * cancellation because its `when` passed, a signal that has not aborted, so
   * cleanup can finish.
   */
  readonly signal: AbortSignal;
}

export interface ExecutePipelineOptions {
  signal?: AbortSignal;
  /** Identifies the pipeline in step events. Default: `'pipeline'`. */
  id?: string;
  onStepStart?: (event: PipelineStepEvent) => void;
  onStepEnd?: (event: PipelineStepEndEvent) => void;
}

export class PipelineError extends Error {
  readonly result: PipelineResult;

  constructor(result: PipelineResult, message?: string) {
    const failed = result.order.filter((id) => result.steps[id]?.conclusion === 'failure');
    super(message ?? `Pipeline failed: ${failed.join(', ')}`);
    this.name = 'PipelineError';
    this.result = result;
  }
}

/** A pipeline whose conclusion is `cancelled`. */
export class PipelineCancelledError extends PipelineError {
  constructor(result: PipelineResult) {
    const cancelledSteps = result.order.filter(
      (id) => result.steps[id]?.conclusion === 'cancelled'
    );
    super(result, `Pipeline cancelled: ${cancelledSteps.join(', ')}`);
    this.name = 'PipelineCancelledError';
  }
}

export function always(): PipelineCondition {
  return () => true;
}

export function success(): PipelineCondition {
  return ({ steps }) =>
    Object.values(steps).every(
      (step) => step.conclusion === 'success' || step.conclusion === 'skipped'
    );
}

export function failure(id?: string): PipelineCondition {
  return ({ steps }) =>
    id
      ? steps[id]?.outcome === 'failure'
      : Object.values(steps).some((step) => step.outcome === 'failure');
}

export function cancelled(id?: string): PipelineCondition {
  return ({ steps }) =>
    id
      ? steps[id]?.outcome === 'cancelled'
      : Object.values(steps).some((step) => step.outcome === 'cancelled');
}

function resultConclusion(steps: Record<string, PipelineStepResult>): PipelineOutcome {
  const values = Object.values(steps);
  if (values.some((step) => step.conclusion === 'failure')) return 'failure';
  if (values.some((step) => step.conclusion === 'cancelled')) return 'cancelled';
  if (values.length > 0 && values.every((step) => step.conclusion === 'skipped')) return 'skipped';
  return 'success';
}

/** A hook or listener error never changes a step outcome. */
function callHook<E>(hook: ((event: E) => void) | undefined, event: E): void {
  if (!hook) return;
  try {
    hook(event);
  } catch (error) {
    console.error('Pipeline step hook failed:', error);
  }
}

/**
 * Run steps in order. Modeled on GitHub Actions:
 * - a step without `when` runs while every earlier step succeeded or was skipped;
 * - after `signal` aborts, steps without `when` are recorded as `cancelled` and
 *   not run, while steps whose `when` passes (`always()`, `cancelled()`) still run;
 * - a step that rejects while the signal is aborted is `cancelled`, not `failure`.
 *
 * Rejects with `PipelineError` on `failure` and `PipelineCancelledError` on `cancelled`.
 */
export async function executePipeline<const S extends readonly PipelineDefinition[]>(
  definitions: S,
  execute: (task: S[number]['task'], step: PipelineStepExecution) => Promise<unknown>,
  options: ExecutePipelineOptions = {}
): Promise<PipelineResult<PipelineValues<S>>> {
  const steps: Record<string, PipelineStepResult> = {};
  const order: string[] = [];
  const pipelineId = options.id ?? 'pipeline';
  const signal = options.signal;
  let cleanupSignal: AbortSignal | undefined;

  const end = (result: PipelineStepResult): void => {
    steps[result.id] = result;
    callHook(options.onStepEnd, { pipelineId, stepId: result.id, ...result });
  };

  for (const definition of definitions) {
    if (!definition.id || steps[definition.id]) {
      throw new Error(`Pipeline step id must be unique and non-empty: ${definition.id}`);
    }
    const aborted = signal?.aborted === true;
    const context: PipelineContext = { steps };
    const shouldRun = definition.when
      ? await definition.when(context)
      : !aborted &&
        Object.values(steps).every(
          (step) => step.conclusion === 'success' || step.conclusion === 'skipped'
        );
    const startedAt = new Date();
    order.push(definition.id);

    if (!shouldRun) {
      const outcome = aborted && !definition.when ? 'cancelled' : 'skipped';
      end({
        id: definition.id,
        outcome,
        conclusion: outcome,
        startedAt,
        completedAt: startedAt,
        durationMs: 0
      });
      continue;
    }

    let stepSignal = signal;
    if (aborted) stepSignal = cleanupSignal ??= new AbortController().signal;
    callHook(options.onStepStart, { pipelineId, stepId: definition.id, startedAt });

    try {
      const value = await execute(definition.task, {
        stepId: definition.id,
        signal: stepSignal ?? neverAbortedSignal
      });
      const completedAt = new Date();
      const result: PipelineStepResult = {
        id: definition.id,
        outcome: 'success',
        conclusion: 'success',
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime()
      };
      if (value !== undefined) result.value = value;
      end(result);
    } catch (error) {
      const completedAt = new Date();
      const outcome = stepSignal?.aborted ? 'cancelled' : 'failure';
      end({
        id: definition.id,
        outcome,
        conclusion: outcome === 'failure' && definition.continueOnError ? 'success' : outcome,
        error: error instanceof Error ? error : new Error(String(error)),
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime()
      });
    }
  }

  const result: PipelineResult = { steps, order, conclusion: resultConclusion(steps) };
  if (result.conclusion === 'failure') throw new PipelineError(result);
  if (result.conclusion === 'cancelled') throw new PipelineCancelledError(result);
  return result as PipelineResult<PipelineValues<S>>;
}
