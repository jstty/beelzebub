// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyTasks extends bz.Tasks {
    task1() {
      this.logger.log('MyTasks task1');
    }

    task2() {
      this.logger.log('MyTasks task2');
    }

    _internalFunction() {
      this.logger.error('this should be ignored');
    }
  }
  bz.add(MyTasks);

  await bz.run('MyTasks.task1', 'MyTasks.task2');
  /* Output:
MyTasks task1
MyTasks task2
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
