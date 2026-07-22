/**
 * Beelzebub task decorators (TC39 stage-3 / TypeScript 5+ standard signature).
 *
 * These are method decorators applied to methods of classes that extend
 * `BzTasks`. They mutate instance state via `addInitializer`, which runs at
 * construction time (after `super()` has set up the prototype chain), so the
 * helper methods on `BzTasks` are reachable.
 *
 * Breaking change vs. v1: the legacy `(target, prop, descriptor)` signature is
 * no longer supported. Set `"target": "ES2022"` (or higher) and do NOT enable
 * `experimentalDecorators` in `tsconfig.json`.
 */

interface TasksLike {
  $defaultTask?: string | symbol;
  $setTaskHelpDocs?: (taskName: string | symbol, desc: string) => void;
  $defineTaskVars?: (taskName: string | symbol, varDefs: unknown) => void;
}

/** Mark a method as the default task for its class. */
export function defaultTask(_value: unknown, context: ClassMethodDecoratorContext): void {
  if (context.kind !== 'method') {
    throw new TypeError('@defaultTask can only be applied to methods');
  }
  context.addInitializer(function (this: unknown) {
    (this as TasksLike).$defaultTask = context.name as string;
  });
}

/** Attach a help description to a task method. */
export function help(desc: string) {
  return function (_value: unknown, context: ClassMethodDecoratorContext): void {
    if (context.kind !== 'method') {
      throw new TypeError('@help can only be applied to methods');
    }
    context.addInitializer(function (this: unknown) {
      (this as TasksLike).$setTaskHelpDocs?.(context.name as string, desc);
    });
  };
}

/** Define typed variables (and CLI options) for a task method. */
export function vars(varDefs: unknown) {
  return function (_value: unknown, context: ClassMethodDecoratorContext): void {
    if (context.kind !== 'method') {
      throw new TypeError('@vars can only be applied to methods');
    }
    context.addInitializer(function (this: unknown) {
      (this as TasksLike).$defineTaskVars?.(context.name as string, varDefs);
    });
  };
}

export const decorators = { defaultTask, help, vars };
export default decorators;
