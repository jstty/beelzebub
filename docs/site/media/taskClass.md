# Task classes

Task classes are the main unit of work in Beelzebub. Extend `BzTasks` (or `bz.Tasks`), add public methods, register the class, and run tasks by their qualified names.

```ts
import bz, { BzTasks } from 'beelzebub';

class BuildTasks extends BzTasks {
  clean(): void {
    this.logger.log('clean');
  }

  async compile(): Promise<void> {
    await Promise.resolve();
    this.logger.log('compile');
  }
}

bz.add(BuildTasks);
await bz.run('BuildTasks.clean', 'BuildTasks.compile');
```

Methods beginning with `_` are private implementation details. Methods beginning with `$` are reserved for framework hooks and helpers. Other prototype methods are registered as runnable tasks.

## Naming and default tasks

The class name is used as its task namespace by default. Override it in a constructor when a stable external name is required.

```ts
class BuildTasks extends BzTasks {
  constructor(config = {}) {
    super(config);
    this.$setName('build');
  }

  all(): void {
    this.logger.log('build everything');
  }
}
```

Set the default method either imperatively or with the standard decorator:

```ts
import { BzTasks, defaultTask } from 'beelzebub';

class BuildTasks extends BzTasks {
  @defaultTask
  all(): void {}
}
```

`await bz.run('BuildTasks')` then runs `BuildTasks.all`.

## Task inputs

Tasks can be selected with strings or task objects:

```ts
await bz.run('BuildTasks.compile');

await bz.run({
  task: 'BuildTasks.compile',
  vars: { minify: true }
});
```

Variables are passed as the first task argument. Define defaults, types, aliases, and help text with `@vars` or `$defineTaskVars`.

```ts
import { BzTasks, help, vars } from 'beelzebub';

class BuildTasks extends BzTasks {
  @help('Compile the application')
  @vars({
    minify: { type: 'boolean', default: false },
    target: { type: 'string', required: true }
  })
  compile(options: { minify: boolean; target: string }): void {
    this.logger.log(options.target, options.minify);
  }
}
```

These are TC39 standard decorators. Do not enable `experimentalDecorators` in a consuming TypeScript configuration.

## Lifecycle hooks

Override these reserved methods when a task group needs setup or cleanup:

- `$init()` runs while the task class is registered.
- `$beforeAll(taskInfo)` runs before the first task in the group.
- `$beforeEach(taskInfo)` runs before every task.
- `$afterEach(taskInfo)` runs after every task.
- `$afterAll()` runs after the group finishes.

Hooks may be synchronous, asynchronous, generator-based, or stream-returning.

```ts
class BuildTasks extends BzTasks {
  async $beforeAll(): Promise<void> {
    await this._prepareWorkspace();
  }

  $afterEach({ task }: { task: string }): void {
    this.logger.log(`finished ${task}`);
  }

  private async _prepareWorkspace(): Promise<void> {}

  compile(): void {}
}
```

## Sequence and parallel composition

Use `$sequence` when order matters and `$parallel` when tasks are independent.

```ts
class ReleaseTasks extends BzTasks {
  lint(): void {}
  test(): void {}
  build(): void {}

  verify(): Promise<unknown> {
    return this.$parallel('.lint', '.test');
  }

  release(): Promise<unknown> {
    return this.$sequence('.verify', '.build');
  }
}
```

Names beginning with `.` are resolved relative to the current task class.

## Streams and generators

Beelzebub waits for promises and Node streams. Generator tasks remain supported for v1 compatibility, though new code should prefer `async` functions.

```ts
class AssetTasks extends BzTasks {
  copy() {
    return gulp.src('src/**/*').pipe(gulp.dest('dist'));
  }

  *legacy(): Generator<Promise<void>, void, unknown> {
    yield Promise.resolve();
  }
}
```

## Subtasks

Task classes can contain named child task groups. Use `$addSubTasks` for dynamic composition or the subtask helpers for explicit registration.

```ts
class FrontendTasks extends BzTasks {
  build(): void {}
}

class ProjectTasks extends BzTasks {
  $init(): void {
    this.$addSubTasks(FrontendTasks);
  }
}
```

The child task is addressed through its full path, such as `ProjectTasks.FrontendTasks.build`.

## Configuration, logging, and events

Use `$config()` for the effective configuration and `$getGlobalVars()` for CLI options that appeared before the first task. `logger`, `helpLogger`, and `vLogger` are injectable through `BeelzebubConfig`.

Tasks may emit custom events with `$emit` while running. Subscribe through the top-level Beelzebub instance:

```ts
bz().on('artifact', (taskInfo, data) => {
  console.log((taskInfo as { task: string }).task, data);
});

class BuildTasks extends BzTasks {
  compile(): void {
    this.$emit('artifact', { file: 'dist/app.js' });
  }
}
```

For the complete exported surface and exact types, see the generated [API reference](./site/index.html).
