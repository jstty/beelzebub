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

/** Local fallback used outside a hosted workflow. */
export class LocalWorkflowRuntime implements WorkflowRuntime {
  readonly provider = 'local';
  readonly context: WorkflowContext;
  readonly summary: WorkflowSummary;
  protected readonly outputs = new Map<string, string>();
  protected readonly state = new Map<string, string>();
  protected diagnosticCount = 0;

  constructor(context: WorkflowContext = {}, sink: SummarySink = new ConsoleSummarySink()) {
    this.context = context;
    this.summary = new WorkflowSummary(sink);
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
    process.env[name] = String(value);
  }
  async addPath(path: string): Promise<void> {
    process.env.PATH = `${path}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`;
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
