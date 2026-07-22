import { expect } from 'vitest';

export type TestApp = { tasks: any };
export type TestFn = (app: TestApp) => void;

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;]*m/g;
const stripAnsi = (s: unknown): string =>
  typeof s === 'string' ? s.replace(ANSI_RE, '') : String(s);

export function expectBufferEquals(
  app: TestApp,
  expectList: string[],
  bufferKey: 'logger' | 'helpLogger' = 'logger'
): void {
  expect(app).not.toBeNull();
  const dump = app.tasks[bufferKey].getBuffer();
  expect(dump).toHaveLength(expectList.length);
  for (let i = 0; i < dump.length; i++) {
    expect(stripAnsi(dump[i])).toBe(expectList[i]);
  }
}
