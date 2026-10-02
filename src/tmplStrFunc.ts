import type { TaskInfo } from './types.js';

/** Tagged template literal helper for building task objects. */
export class TmplStrFunc {
  static task(strings: TemplateStringsArray, args?: Record<string, unknown>): TaskInfo {
    const first = strings[0] ?? '';
    const taskName = first.split(':')[0] ?? '';
    return {
      task: taskName,
      vars: args
    };
  }
}

export default TmplStrFunc;
