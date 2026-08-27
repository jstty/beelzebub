// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { TmplStrFunc, type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });
  const task = TmplStrFunc.task;

  class MyTasks extends bz.Tasks {
    constructor(config?: any) {
      super(config);

      this.$setGlobalVars({
        v1: 'hello',
        v2: 'world',
        v3: 'test'
      });
    }

    task1(customVars: any) {
      this.logger.log(`MyTasks task1 - ${(this.$getGlobalVars() as any).v1} ${customVars.a}`);
    }

    task2(customVars: any) {
      this.logger.log(`MyTasks task2 - ${(this.$getGlobalVars() as any).v2} ${customVars.b}`);
    }

    task3(customVars: any) {
      this.logger.log(`MyTasks task3 - ${(this.$getGlobalVars() as any).v3} ${customVars.c}`);
    }
  }

  bz.add(MyTasks);

  await bz.run('MyTasks.task1:{"a": 1}', task`MyTasks.task2:${{ b: 2 }}`, {
    task: 'MyTasks.task3',
    vars: { c: 3 }
  });
  /* Output:
MyTasks task1 - hello 1
MyTasks task2 - world 2
MyTasks task3 - test 3
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
