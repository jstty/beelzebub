// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { defaultTask, help, type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyTasks extends bz.Tasks {
    @defaultTask
    @help('ES7 Decorator Example MyTasks - Task 1')
    task1() {
      this.logger.log('MyTasks task1');
    }

    @help('ES7 Decorator Example MyTasks - Task 2')
    task2() {
      this.logger.log('MyTasks task2');
    }
  }
  bz.add(MyTasks);

  class MyTasks2 extends bz.Tasks {
    @defaultTask
    @help('ES7 Decorator Example MyTasks2 - Task 1')
    task1() {
      this.logger.log('MyTasks2 task1');
    }

    @help('ES7 Decorator Example MyTasks2 - Task 2')
    task2() {
      this.logger.log('MyTasks2 task2');
    }
  }
  bz.add(MyTasks2);

  await bz.run('MyTasks', 'MyTasks.task2', 'MyTasks2', 'MyTasks2.task2');
  // bz.printHelp();
  /* Output:
MyTasks task1
MyTasks task2
MyTasks2 task1
MyTasks2 task2
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
