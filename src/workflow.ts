export interface AnnotationLocation {
  title?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
}

export interface WorkflowContext {
  eventName?: string;
  repository?: string;
  sha?: string;
  ref?: string;
  actor?: string;
  runId?: string;
  runAttempt?: string;
  workspace?: string;
  payload?: unknown;
  [key: string]: unknown;
}

export interface SummaryWriteOptions {
  overwrite?: boolean;
}

export interface SummarySink {
  write(markdown: string, options?: SummaryWriteOptions): Promise<void>;
  clear(): Promise<void>;
}

export type SummaryTableCell = string | number | boolean;

function escapeTableCell(value: SummaryTableCell): string {
  return String(value).replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Provider-neutral, deterministic Markdown job-summary builder. */
export class WorkflowSummary {
  protected readonly sink: SummarySink;
  protected readonly parts: string[] = [];

  constructor(sink: SummarySink) {
    this.sink = sink;
  }

  raw(markdown: string): this {
    this.parts.push(markdown);
    return this;
  }

  heading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 1): this {
    this.parts.push(`${'#'.repeat(level)} ${text}`);
    return this;
  }

  paragraph(text: string): this {
    this.parts.push(text);
    return this;
  }

  codeBlock(code: string, language = ''): this {
    this.parts.push(`\`\`\`${language}\n${code}\n\`\`\``);
    return this;
  }

  list(items: readonly string[], ordered = false): this {
    this.parts.push(
      items.map((item, index) => `${ordered ? `${index + 1}.` : '-'} ${item}`).join('\n')
    );
    return this;
  }

  table(rows: readonly (readonly SummaryTableCell[])[]): this {
    if (rows.length === 0) return this;
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) =>
      Array.from({ length: width }, (_, index) => escapeTableCell(row[index] ?? ''))
    );
    const [header = [], ...body] = normalized;
    this.parts.push(
      [
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...body.map((row) => `| ${row.join(' | ')} |`)
      ].join('\n')
    );
    return this;
  }

  details(label: string, markdown: string): this {
    this.parts.push(
      `<details>\n<summary>${escapeHtml(label)}</summary>\n\n${markdown}\n\n</details>`
    );
    return this;
  }

  link(label: string, url: string): this {
    this.parts.push(`[${label.replaceAll(']', '\\]')}](${url.replaceAll(')', '%29')})`);
    return this;
  }

  separator(): this {
    this.parts.push('---');
    return this;
  }

  render(): string {
    if (this.parts.length === 0) return '';
    return `${this.parts.join('\n\n')}\n`;
  }

  isEmpty(): boolean {
    return this.parts.length === 0;
  }

  empty(): this {
    this.parts.length = 0;
    return this;
  }

  async write(options?: SummaryWriteOptions): Promise<void> {
    const markdown = this.render();
    if (!markdown) return;
    await this.sink.write(markdown, options);
    this.empty();
  }

  async clear(): Promise<void> {
    this.empty();
    await this.sink.clear();
  }
}

export interface WorkflowRuntime {
  readonly provider: string;
  readonly context: WorkflowContext;
  readonly summary: WorkflowSummary;

  debug(message: string): void;
  info(message: string): void;
  notice(message: string, location?: AnnotationLocation): void;
  warning(message: string, location?: AnnotationLocation): void;
  error(message: string, location?: AnnotationLocation): void;
  group<T>(name: string, fn: () => Promise<T>): Promise<T>;
  maskSecret(value: string): void;
  setOutput(name: string, value: unknown): Promise<void>;
  exportVariable(name: string, value: unknown): Promise<void>;
  addPath(path: string): Promise<void>;
  saveState(name: string, value: unknown): Promise<void>;
  getState(name: string): string | undefined;
  /** Redacted, provider-neutral execution data for bridge adapters and tests. */
  getExecutionSnapshot?(): WorkflowExecutionSnapshot;
  /**
   * Environment overrides for child processes started through `$exec`, beneath
   * the caller's `options.env`. A runtime that scopes `exportVariable` and
   * `addPath` to itself returns them here.
   */
  getEnv?(): Readonly<Record<string, string>>;
}

export interface ArtifactOperationSnapshot {
  readonly operation: 'upload' | 'download';
  readonly name: string;
  readonly fileCount?: number;
}

export interface CacheOperationSnapshot {
  readonly operation: 'restore' | 'save';
  readonly pathCount: number;
  /** SHA-256 of the cache key; raw keys are intentionally not retained. */
  readonly keyDigest: string;
  readonly hit?: boolean;
}

export interface WorkflowExecutionSnapshot {
  readonly outputs: Readonly<Record<string, string>>;
  readonly artifacts: readonly ArtifactOperationSnapshot[];
  readonly caches: readonly CacheOperationSnapshot[];
  readonly diagnosticCount: number;
}

class ConsoleSummarySink implements SummarySink {
  async write(markdown: string): Promise<void> {
    process.stdout.write(markdown);
  }

  async clear(): Promise<void> {}
}

export interface LocalWorkflowRuntimeOptions {
  /**
   * Where `exportVariable` and `addPath` write. `process` (the default) changes
   * `process.env`. `scoped` keeps them on this runtime and passes them to child
   * processes through `getEnv()`, so concurrent embedded runs don't see
   * each other's values.
   */
  env?: 'process' | 'scoped';
}

/** The `PATH` key as the platform spells it (`Path` on Windows). */
function pathKey(): string {
  return Object.keys(process.env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
}

function pathSeparator(): string {
  return process.platform === 'win32' ? ';' : ':';
}

/** Local fallback used outside a hosted workflow. */
export class LocalWorkflowRuntime implements WorkflowRuntime {
  readonly provider = 'local';
  readonly context: WorkflowContext;
  readonly summary: WorkflowSummary;
  protected readonly outputs = new Map<string, string>();
  protected readonly state = new Map<string, string>();
  protected diagnosticCount = 0;
  protected readonly scoped: boolean;
  protected readonly exported = new Map<string, string>();
  protected readonly paths: string[] = [];

  constructor(
    context: WorkflowContext = {},
    sink: SummarySink = new ConsoleSummarySink(),
    options: LocalWorkflowRuntimeOptions = {}
  ) {
    this.context = context;
    this.summary = new WorkflowSummary(sink);
    this.scoped = options.env === 'scoped';
  }

  debug(message: string): void {
    console.debug(message);
  }
  info(message: string): void {
    console.info(message);
  }
  notice(message: string): void {
    this.diagnosticCount++;
    console.info(message);
  }
  warning(message: string): void {
    this.diagnosticCount++;
    console.warn(message);
  }
  error(message: string): void {
    this.diagnosticCount++;
    console.error(message);
  }
  async group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    console.group(name);
    try {
      return await fn();
    } finally {
      console.groupEnd();
    }
  }
  maskSecret(_value: string): void {}
  async setOutput(name: string, value: unknown): Promise<void> {
    this.outputs.set(name, String(value));
  }
  async exportVariable(name: string, value: unknown): Promise<void> {
    if (this.scoped) this.exported.set(name, String(value));
    else process.env[name] = String(value);
  }
  async addPath(path: string): Promise<void> {
    if (this.scoped) this.paths.unshift(path);
    else process.env.PATH = `${path}${pathSeparator()}${process.env.PATH ?? ''}`;
  }
  /** Scoped exports, with added paths before the process `PATH`; empty in `process` mode. */
  getEnv(): Readonly<Record<string, string>> {
    const env = Object.fromEntries(this.exported);
    if (this.paths.length > 0) {
      const key = pathKey();
      const base = env[key] ?? process.env[key];
      env[key] = [...this.paths, ...(base ? [base] : [])].join(pathSeparator());
    }
    return env;
  }
  async saveState(name: string, value: unknown): Promise<void> {
    this.state.set(name, String(value));
  }
  getState(name: string): string | undefined {
    return this.state.get(name);
  }
  getExecutionSnapshot(): WorkflowExecutionSnapshot {
    return {
      outputs: Object.fromEntries(this.outputs),
      artifacts: [],
      caches: [],
      diagnosticCount: this.diagnosticCount
    };
  }
}
