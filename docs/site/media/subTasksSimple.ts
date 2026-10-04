// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyBaseTasks extends bz.Tasks {
    value: unknown;
    _delayTime = 300;

    constructor(config: any) {
      super(config);
      this.$setName(config.name || 'MyBaseTasks');
      this.value = config.value;
    }

    $init() {
      return this._delay('MyBaseTasks init');
    }

    _delay(message: string): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, this._delayTime);
      });
    }

    task1() {
      return this._delay('MyBaseTasks task1 - ' + this.value);
    }
  }

  class MyTasks extends bz.Tasks {
    constructor(config?: any) {
      super(config);
      this.$setName('MyTasks');
    }

    $init() {
      this.logger.log('MyTasks init');
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks1', value: 123 });
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks2', value: 456 });
          resolve(1234);
        }, 200);
      });
    }

    task1() {
      this.logger.log('MyTasks task1');
      return this.$sequence('MyTasks.MyBaseTasks1.task1', 'MyTasks.MyBaseTasks2.task1');
    }
  }

  bz.add(MyTasks);
  await bz.run('MyTasks.task1');
  /* Output:
MyTasks init
MyBaseTasks init
MyBaseTasks init
MyTasks task1
MyBaseTasks task1 - 123
MyBaseTasks task1 - 456
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
