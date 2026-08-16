import { describe, expect, it, vi } from 'vitest';

import { CommandError, NodeCommandRunner } from '../src/index.js';

describe('NodeCommandRunner', () => {
  it('resolves platform command shims without enabling a shell', async () => {
    const runner = new NodeCommandRunner();
    const result = await runner.exec('npm', ['--version'], { silent: true });

    expect(result).toMatchObject({ command: 'npm', exitCode: 0, stderr: '' });
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('captures output, arguments, and successful exit details', async () => {
    const runner = new NodeCommandRunner();
    const result = await runner.exec(
      process.execPath,
      ['-e', 'process.stdout.write(process.argv[1] ?? "")', 'hello world'],
      { silent: true }
    );

    expect(result).toMatchObject({
      command: process.execPath,
      exitCode: 0,
      stdout: 'hello world',
      stderr: ''
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects disallowed exit codes with the complete result', async () => {
    const runner = new NodeCommandRunner();
    const failure = runner.exec(
      process.execPath,
      ['-e', 'process.stderr.write("bad"); process.exit(7)'],
      { silent: true }
    );

    await expect(failure).rejects.toMatchObject({
      name: 'CommandError',
      result: { exitCode: 7, stderr: 'bad' }
    });
    await expect(failure).rejects.toBeInstanceOf(CommandError);
  });

  it('supports additional accepted exit codes', async () => {
    const runner = new NodeCommandRunner();
    await expect(
      runner.exec(process.execPath, ['-e', 'process.exit(2)'], {
        acceptedExitCodes: [0, 2],
        silent: true
      })
    ).resolves.toMatchObject({ exitCode: 2 });
  });

  it('supports stdin, environment, callbacks, cwd, and disabled capture', async () => {
    const runner = new NodeCommandRunner();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const result = await runner.exec(
      process.execPath,
      [
        '-e',
        'process.stdin.on("data", value => { process.stdout.write(`${process.env.BZ_TEST}:${process.cwd()}:${value}`); process.stderr.write("warn") })'
      ],
      {
        cwd: process.cwd(),
        env: { BZ_TEST: 'yes' },
        input: 'input',
        capture: false,
        silent: true,
        stdout: (chunk) => stdout.push(chunk),
        stderr: (chunk) => stderr.push(chunk)
      }
    );

    expect(result).toMatchObject({ stdout: '', stderr: '' });
    expect(stdout.join('')).toBe(`yes:${process.cwd()}:input`);
    expect(stderr.join('')).toBe('warn');
  });

  it('streams output by default when silent is false', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const runner = new NodeCommandRunner();

    await runner.exec(
      process.execPath,
      ['-e', 'process.stdout.write("out"); process.stderr.write("err")'],
      { capture: false }
    );

    expect(stdout).toHaveBeenCalledWith('out');
    expect(stderr).toHaveBeenCalledWith('err');
    stdout.mockRestore();
    stderr.mockRestore();
  });

  it('rejects spawn errors, timeouts, and pre-aborted signals', async () => {
    const runner = new NodeCommandRunner();
    await expect(
      runner.exec('beelzebub-command-that-does-not-exist', [], { silent: true })
    ).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await expect(
      runner.exec(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
        silent: true,
        timeoutMs: 10
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    const controller = new AbortController();
    controller.abort(new Error('stopped'));
    await expect(
      runner.exec(process.execPath, ['-e', 'process.exit(0)'], {
        signal: controller.signal,
        silent: true
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
