declare module 'stumpy' {
  export default class Stumpy {
    constructor(...args: unknown[]);
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
    error(...args: unknown[]): void;
    trace(...args: unknown[]): void;
    group(...args: unknown[]): void;
    groupEnd(...args: unknown[]): void;
    [key: string]: unknown;
  }
}
