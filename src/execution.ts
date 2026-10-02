import { AsyncLocalStorage } from 'node:async_hooks';

/** The task an execution frame belongs to. */
export interface ExecutionTask {
  /** Full task name, as reported in events and executions. */
  readonly name: string;
  readonly vars: Record<string, unknown> | undefined;
  /** The task-class instance running the task. */
  readonly instance: object;
}

/**
 * Per-execution state, carried through `await` by `AsyncLocalStorage`. A
 * top-level `run()` opens a frame for its Beelzebub instance; each task
 * execution and each `$pipeline` step opens a child frame.
 */
export interface ExecutionFrame {
  /** The Beelzebub instance whose `run()` opened the outermost frame. */
  readonly app: object;
  readonly signal: AbortSignal;
  readonly task?: ExecutionTask;
}

const store = new AsyncLocalStorage<ExecutionFrame>();

/** A signal that never aborts, for code running without one. */
export const neverAbortedSignal: AbortSignal = new AbortController().signal;

/** The current frame when it belongs to `app`; frames of other instances are ignored. */
export function frameFor(app: unknown): ExecutionFrame | undefined {
  const frame = store.getStore();
  return frame && frame.app === app ? frame : undefined;
}

export function runInFrame<T>(frame: ExecutionFrame, fn: () => T): T {
  return store.run(frame, fn);
}

/** Combine signals; `undefined` entries are ignored. */
export function combineSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const present = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (present.length === 0) return neverAbortedSignal;
  if (present.length === 1) return present[0]!;
  return AbortSignal.any(present);
}
