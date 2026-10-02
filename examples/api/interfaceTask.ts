// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyCustomTasks1 extends bz.Tasks {
    task1() {
      this.logger.log('MyCustomTasks1 task1');
    }
  }

  class MyCustomTasks2 extends bz.Tasks {
    task1() {
      this.logger.log('MyCustomTasks2 task1');
    }
  }

  class MyTasks extends bz.InterfaceTasks {
    $replaceWith(config: any): unknown {
      let tasksClass: unknown = null;

      if (config.interfaceType === 'MyCustomTasks1') {
        tasksClass = MyCustomTasks1;
      } else if (config.interfaceType === 'MyCustomTasks2') {
        tasksClass = Promise.resolve(MyCustomTasks2);
      }

      return tasksClass;
    }
  }

  bz.add(MyTasks, { interfaceType: 'MyCustomTasks2' });
  await bz.run('MyTasks.task1');
  /* Output:
MyCustomTasks2 task1
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
