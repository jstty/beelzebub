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

export interface PipelineStep {
  id: string;
  task: unknown;
  when?: PipelineCondition;
  continueOnError?: boolean;
}

export interface PipelineResult {
  readonly steps: Readonly<Record<string, PipelineStepResult>>;
  readonly order: readonly string[];
  readonly conclusion: PipelineOutcome;
}

export class PipelineError extends Error {
  readonly result: PipelineResult;

  constructor(result: PipelineResult) {
    const failed = result.order.filter((id) => result.steps[id]?.conclusion === 'failure');
    super(`Pipeline failed: ${failed.join(', ')}`);
    this.name = 'PipelineError';
    this.result = result;
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

export async function executePipeline(
  definitions: readonly PipelineStep[],
  execute: (task: unknown) => Promise<unknown>
): Promise<PipelineResult> {
  const steps: Record<string, PipelineStepResult> = {};
  const order: string[] = [];

  for (const definition of definitions) {
    if (!definition.id || steps[definition.id]) {
      throw new Error(`Pipeline step id must be unique and non-empty: ${definition.id}`);
    }
    const context: PipelineContext = { steps };
    const shouldRun = definition.when
      ? await definition.when(context)
      : Object.values(steps).every(
          (step) => step.conclusion === 'success' || step.conclusion === 'skipped'
        );
    const startedAt = new Date();
    order.push(definition.id);

    if (!shouldRun) {
      steps[definition.id] = {
        id: definition.id,
        outcome: 'skipped',
        conclusion: 'skipped',
        startedAt,
        completedAt: startedAt,
        durationMs: 0
      };
      continue;
    }

    try {
      const value = await execute(definition.task);
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
      steps[definition.id] = result;
    } catch (error) {
      const completedAt = new Date();
      steps[definition.id] = {
        id: definition.id,
        outcome: 'failure',
        conclusion: definition.continueOnError ? 'success' : 'failure',
        error: error instanceof Error ? error : new Error(String(error)),
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime()
      };
    }
  }

  const result: PipelineResult = {
    steps,
    order,
    conclusion: resultConclusion(steps)
  };
  if (result.conclusion === 'failure') throw new PipelineError(result);
  return result;
}
