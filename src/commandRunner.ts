import { spawn } from 'node:child_process';

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Uint8Array;
  timeoutMs?: number;
  signal?: AbortSignal;
  shell?: boolean;
  silent?: boolean;
  capture?: boolean;
  acceptedExitCodes?: readonly number[];
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
}

export interface ExecResult {
  command: string;
  args: readonly string[];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface CommandRunner {
  exec(command: string, args?: readonly string[], options?: ExecOptions): Promise<ExecResult>;
}

export class CommandError extends Error {
  readonly result: ExecResult;

  constructor(result: ExecResult) {
    const detail = result.signal
      ? `signal ${result.signal}`
      : `exit code ${String(result.exitCode)}`;
    super(`Command failed with ${detail}: ${formatCommand(result.command, result.args)}`);
    this.name = 'CommandError';
    this.result = result;
  }
}

function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args]
    .map((part) => (part.includes(' ') ? JSON.stringify(part) : part))
    .join(' ');
}

/** Cross-platform child-process runner used by `$exec()`. */
export class NodeCommandRunner implements CommandRunner {
  async exec(
    command: string,
    args: readonly string[] = [],
    options: ExecOptions = {}
  ): Promise<ExecResult> {
    const startedAt = performance.now();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const capture = options.capture ?? true;
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    let timeout: NodeJS.Timeout | undefined;

    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(
        () => controller.abort(new Error('Command timed out')),
        options.timeoutMs
      );
    }

    const spawnOptions: Parameters<typeof spawn>[2] = {
      env: options.env ? { ...process.env, ...options.env } : process.env,
      shell: options.shell ?? false,
      signal: controller.signal,
      stdio: ['pipe', 'pipe', 'pipe']
    };
    if (options.cwd !== undefined) spawnOptions.cwd = options.cwd;

    try {
      const result = await new Promise<ExecResult>((resolve, reject) => {
        const child = spawn(command, [...args], spawnOptions);

        child.once('error', reject);
        child.stdout!.setEncoding('utf8');
        child.stderr!.setEncoding('utf8');
        child.stdout!.on('data', (chunk: string) => {
          if (capture) stdout.push(chunk);
          options.stdout?.(chunk);
          if (!options.silent) process.stdout.write(chunk);
        });
        child.stderr!.on('data', (chunk: string) => {
          if (capture) stderr.push(chunk);
          options.stderr?.(chunk);
          if (!options.silent) process.stderr.write(chunk);
        });
        child.once('close', (exitCode, signal) => {
          resolve({
            command,
            args: [...args],
            exitCode,
            signal,
            stdout: stdout.join(''),
            stderr: stderr.join(''),
            durationMs: performance.now() - startedAt
          });
        });

        if (options.input !== undefined) child.stdin!.end(options.input);
        else child.stdin!.end();
      });

      const acceptedExitCodes = options.acceptedExitCodes ?? [0];
      if (result.exitCode === null || !acceptedExitCodes.includes(result.exitCode)) {
        throw new CommandError(result);
      }
      return result;
    } finally {
      if (timeout) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
}
