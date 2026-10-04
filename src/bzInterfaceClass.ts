import { BzTasks } from './bzTasksClass.js';
import { isPromise } from './util.js';
import type { BeelzebubConfig } from './types.js';

/**
 * Abstract task class that defers to another task class returned by
 * `$replaceWith()`. Useful for dynamically loading task definitions.
 */
export class InterfaceTasks extends BzTasks {
  constructor(config: BeelzebubConfig = {}) {
    super(config);
  }

  /** Override to return a `BzTasks` subclass (or a promise resolving to one). */
  $replaceWith(_config: BeelzebubConfig): unknown {
    this.logger.error('$replaceWith should be replaced');
    return null;
  }

  override async $register(): Promise<unknown> {
    const tasksClass = this.$replaceWith(this.$config());
    if (!tasksClass) return undefined;

    if (isPromise(tasksClass)) {
      try {
        const resolved = await tasksClass;
        this.beelzebub.add(resolved, { name: this.name });
      } catch (err) {
        this.logger.error('$replaceWith Error:', err);
      }
    } else {
      this.beelzebub.add(tasksClass, { name: this.name });
    }
    return undefined;
  }
}

export default InterfaceTasks;
