# Interface task classes

`InterfaceTasks` is a lightweight base for objects that can replace or adapt a task group. It extends `BzTasks`, so interface classes use the same naming, configuration, hooks, logging, and composition APIs.

```ts
import bz, { InterfaceTasks, type BeelzebubConfig } from 'beelzebub';

class DeploymentInterface extends InterfaceTasks {
  constructor(config: BeelzebubConfig = {}) {
    super(config);
    this.$setName('deploy');
  }

  preview(): void {
    this.logger.log('deploy preview');
  }
}

bz.add(DeploymentInterface);
await bz.run('deploy.preview');
```

## Replacing an implementation

Override `$replaceWith(config)` when an interface task should construct or return a concrete implementation for a configuration.

```ts
import { BzTasks, InterfaceTasks, type BeelzebubConfig } from 'beelzebub';

class LocalDeployment extends BzTasks {
  publish(): void {
    this.logger.log('published locally');
  }
}

class DeploymentInterface extends InterfaceTasks {
  $replaceWith(_config: BeelzebubConfig): typeof LocalDeployment {
    return LocalDeployment;
  }
}
```

`$replaceWith` returns `unknown` at the framework boundary. Implementations should return a `BzTasks` constructor or a promise resolving to one, and should use a concrete return type in subclasses.

For inherited task APIs, see [Task classes](./taskClass.md). For exact signatures, see the generated [InterfaceTasks reference](./site/classes/InterfaceTasks.html).
