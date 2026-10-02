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
    constructor(config?: any) {
      super(config);
      this.$setName('MyBaseTasks');
    }

    task1() {
      this.logger.log('MyBaseTasks task1');
    }

    task2() {
      this.logger.log('MyBaseTasks task2');
    }

    task2Option() {
      this.logger.log('MyBaseTasks task2 option');
    }

    _internalFunction() {
      this.logger.error('this should be ignored');
    }
  }
  bz.add(MyBaseTasks);

  class MyTasks extends MyBaseTasks {
    constructor(config?: any) {
      super(config);
      this.$setName('MyTasks');
    }

    override task1() {
      this.logger.log('MyTasks task1');
    }

    task3() {
      this.logger.log('MyTasks task3');
    }
  }

  bz.add(MyTasks);

  await bz.run('MyTasks.task1', 'MyTasks.task3', 'MyTasks.task2', 'MyTasks.task2Option');
  /* Output:
MyTasks task1
MyTasks task3
MyBaseTasks task2
MyBaseTasks task2 option
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
