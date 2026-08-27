// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MySubSubBaseTasks extends bz.Tasks {
    value: number;
    _delayTime: number;

    constructor(config: any) {
      super(config);
      this.$setName(config.name || 'MySubSubBaseTasks');

      this.value = config.value;
      this._delayTime = config.delayTime || 500;
    }

    $init() {
      this.logger.log(`${this.name} init`);
    }

    _delay(message: string, delay?: number): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay || this._delayTime);
      });
    }

    task1() {
      return this._delay(`${this.name} task1 - ${this.value}`);
    }

    task2() {
      return this._delay(`${this.name} task2 - ${this.value}`);
    }

    task3() {
      return this._delay(`${this.name} task3 - ${this.value}`);
    }
  }

  class MySubBaseTasks extends bz.Tasks {
    value: number;

    constructor(config: any) {
      super(config);
      this.$setName(config.name || 'MySubBaseTasks');
      this.value = config.value;
    }

    $init() {
      this.logger.log(`${this.name} init`);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          this.$addSubTasks(MySubSubBaseTasks, {
            name: 'MySubSubBaseTasks1',
            value: this.value * 123
          });
          this.$addSubTasks(MySubSubBaseTasks, {
            name: 'MySubSubBaseTasks2',
            value: this.value * 456,
            delayTime: 200
          });
          resolve();
        }, 200);
      });
    }

    default() {
      this.logger.log(this.name + ' default');
      return this.$sequence('.MySubSubBaseTasks1.task1', '.MySubSubBaseTasks2.task1');
    }
  }

  class MyTasks extends bz.Tasks {
    $init() {
      this.logger.log(`${this.name} init`);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          this.$addSubTasks(MySubBaseTasks, { name: 'MySubBaseTasks1', value: 1 });
          this.$addSubTasks(MySubBaseTasks, { name: 'MySubBaseTasks2', value: 2 });
          resolve();
        }, 200);
      });
    }

    default() {
      this.logger.log(`${this.name} task1`);
      return this.$sequence('.MySubBaseTasks1', '.MySubBaseTasks2');
    }
  }

  bz.add(MyTasks);
  await bz.run('MyTasks');
  /* Output:
MyTasks init
MySubBaseTasks1 init
MySubBaseTasks2 init
MySubSubBaseTasks1 init
MySubSubBaseTasks2 init
MySubSubBaseTasks1 init
MySubSubBaseTasks2 init
MyTasks task1
MySubBaseTasks1 default
MySubSubBaseTasks1 task1 - 123
MySubSubBaseTasks2 task1 - 456
MySubBaseTasks2 default
MySubSubBaseTasks1 task1 - 246
MySubSubBaseTasks2 task1 - 912
*/
  // </EXAMPLE>
  // =====================================================

  // !-- FOR TESTS
  return bz;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void wrapper();
}
// --!
