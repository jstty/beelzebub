// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyRootLevel extends bz.Tasks {
    constructor(config?: any) {
      super(config);
      this.$useAsRoot();
    }

    task1() {
      this.logger.log('MyRootLevel task1');
    }

    task2() {
      this.logger.log('MyRootLevel task2');
    }
  }

  class MyTasks1 extends bz.Tasks {
    default() {
      this.logger.log('MyTasks1 default');
    }
  }

  class MyTasks2 extends bz.Tasks {
    constructor(config?: any) {
      super(config);
      this.$setDefault('myDefault');
    }

    myDefault() {
      this.logger.log('MyTasks2 myDefault');
    }
  }

  bz.add(MyRootLevel);
  bz.add(MyTasks1);
  bz.add(MyTasks2);

  await bz.run('task1', 'task2', 'MyTasks1', 'MyTasks1.default', 'MyTasks2', 'MyTasks2.myDefault');
  /* Output:
MyRootLevel task1
MyRootLevel task2
MyTasks1 default
MyTasks1 default
MyTasks2 myDefault
MyTasks2 myDefault
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
