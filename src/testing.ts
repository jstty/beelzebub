import {
  CommandError,
  type CommandRunner,
  type ExecOptions,
  type ExecResult
} from './commandRunner.js';
import {
  WorkflowSummary,
  type AnnotationLocation,
  type SummarySink,
  type SummaryWriteOptions,
  type WorkflowContext,
  type WorkflowExecutionSnapshot,
  type WorkflowRuntime
} from './workflow.js';

export interface CommandCall {
  command: string;
  args: readonly string[];
  options: ExecOptions;
}

export type CommandResponse = Partial<Omit<ExecResult, 'command' | 'args'>> & {
  error?: Error;
};

/** Deterministic command runner for testing task behavior without subprocesses. */
export class MemoryCommandRunner implements CommandRunner {
  readonly calls: CommandCall[] = [];
  protected readonly responses: CommandResponse[] = [];

  respond(response: CommandResponse = {}): this {
    this.responses.push(response);
    return this;
  }

  succeed(stdout = ''): this {
    return this.respond({ exitCode: 0, stdout });
  }

  fail(exitCode = 1, stderr = ''): this {
    return this.respond({ exitCode, stderr });
  }

  async exec(
    command: string,
    args: readonly string[] = [],
    options: ExecOptions = {}
  ): Promise<ExecResult> {
    this.calls.push({ command, args: [...args], options });
    const response = this.responses.shift() ?? {};
    if (response.error) throw response.error;
    const result: ExecResult = {
      command,
      args: [...args],
      exitCode: response.exitCode ?? 0,
      signal: response.signal ?? null,
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      durationMs: response.durationMs ?? 0
    };
    const acceptedExitCodes = options.acceptedExitCodes ?? [0];
    if (result.exitCode === null || !acceptedExitCodes.includes(result.exitCode)) {
      throw new CommandError(result);
    }
    return result;
  }
}

export interface MemoryWorkflowCall {
  method: string;
  args: unknown[];
}

export class MemorySummarySink implements SummarySink {
  readonly writes: Array<{ markdown: string; options: SummaryWriteOptions }> = [];
  content = '';

  async write(markdown: string, options: SummaryWriteOptions = {}): Promise<void> {
    this.writes.push({ markdown, options });
    this.content = options.overwrite ? markdown : this.content + markdown;
  }

  async clear(): Promise<void> {
    this.content = '';
  }
}

/** In-memory workflow host for assertions over summaries and runner interactions. */
export class MemoryWorkflowRuntime implements WorkflowRuntime {
  readonly provider = 'memory';
  readonly context: WorkflowContext;
  readonly summarySink = new MemorySummarySink();
  readonly summary = new WorkflowSummary(this.summarySink);
  readonly calls: MemoryWorkflowCall[] = [];
  readonly outputs = new Map<string, unknown>();
  readonly variables = new Map<string, unknown>();
  readonly paths: string[] = [];
  readonly secrets: string[] = [];
  readonly state = new Map<string, string>();

  constructor(context: WorkflowContext = {}) {
    this.context = context;
  }

  protected call(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }

  debug(message: string): void {
    this.call('debug', message);
  }
  info(message: string): void {
    this.call('info', message);
  }
  notice(message: string, location?: AnnotationLocation): void {
    this.call('notice', message, location);
  }
  warning(message: string, location?: AnnotationLocation): void {
    this.call('warning', message, location);
  }
  error(message: string, location?: AnnotationLocation): void {
    this.call('error', message, location);
  }
  async group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.call('group:start', name);
    try {
      return await fn();
    } finally {
      this.call('group:end', name);
    }
  }
  maskSecret(value: string): void {
    this.secrets.push(value);
    this.call('maskSecret', value);
  }
  async setOutput(name: string, value: unknown): Promise<void> {
    this.outputs.set(name, value);
    this.call('setOutput', name, value);
  }
  async exportVariable(name: string, value: unknown): Promise<void> {
    this.variables.set(name, value);
    this.call('exportVariable', name, value);
  }
  async addPath(path: string): Promise<void> {
    this.paths.push(path);
    this.call('addPath', path);
  }
  async saveState(name: string, value: unknown): Promise<void> {
    this.state.set(name, String(value));
    this.call('saveState', name, value);
  }
  getState(name: string): string | undefined {
    return this.state.get(name);
  }
  getExecutionSnapshot(): WorkflowExecutionSnapshot {
    return {
      outputs: Object.fromEntries([...this.outputs].map(([name, value]) => [name, String(value)])),
      artifacts: [],
      caches: [],
      diagnosticCount: this.calls.filter(({ method }) =>
        ['notice', 'warning', 'error'].includes(method)
      ).length
    };
  }
}
