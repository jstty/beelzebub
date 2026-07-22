// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { vars, TmplStrFunc, type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });
  const task = TmplStrFunc.task;

  class MyTasks extends bz.Tasks {
    @vars({
      name: { type: 'String', default: 'hello' },
      flag: { type: 'Boolean', default: true }
    })
    task1(customVars: any) {
      this.logger.log(`MyTasks task1 - ${customVars.name} ${customVars.flag}`);
    }

    @vars({
      count: { type: 'Number', required: true },
      verbose: { type: 'Boolean', alias: 'v', default: false }
    })
    task2(customVars: any) {
      this.logger.log(`MyTasks task2 - ${customVars.count} ${customVars.verbose}`);
    }

    @vars({
      fullname: {
        type: 'Object',
        properties: {
          first: { type: 'String' },
          last: { type: 'String' }
        }
      },
      list: {
        type: 'Array',
        items: { type: 'String' }
      }
    })
    task3(customVars: any) {
      this.logger.log(
        `MyTasks task3 - "${customVars.fullname.first} ${customVars.fullname.last}" ${customVars.list}`
      );
    }
  }

  bz.add(MyTasks);

  await bz.run('MyTasks.task1', task`MyTasks.task2:${{ count: 100, verbose: true }}`, {
    task: 'MyTasks.task3',
    vars: {
      fullname: { first: 'hello', last: 'world' },
      list: ['te', 'st']
    }
  });
  /* Output:
MyTasks task1 - hello true
MyTasks task2 - 100 true
MyTasks task3 - "hello world" te,st
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
