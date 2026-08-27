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
    $beforeEach(taskInfo: { task: string }) {
      this.logger.log(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    $afterEach(taskInfo: { task: string }) {
      this.logger.log(`MyTasks afterEach - ${taskInfo.task}`);
    }

    $beforeAll() {
      this.logger.log(`MyTasks beforeAll`);
    }

    $afterAll() {
      this.logger.log(`MyTasks afterAll`);
    }

    task1() {
      this.logger.log('MyTasks task1');
    }

    task2() {
      this.logger.log('MyTasks task2');
    }
  }

  bz.add(MyTasks);

  await bz.run('MyTasks.task1', 'MyTasks.task2');

  /* Output:
MyTasks beforeAll
MyTasks beforeEach - task1
MyTasks task1
MyTasks afterEach - task1
MyTasks beforeEach - task2
MyTasks task2
MyTasks afterEach - task2
MyTasks afterAll
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
