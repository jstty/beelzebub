// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

type TaskInfo = { task: string; vars?: Record<string, unknown> };

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MySubBaseTasks1 extends bz.Tasks {
    _delay(message: string, delay = 100): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init() {
      this.logger.log('MySubBaseTasks1 init');
    }

    async $beforeAll(taskInfo: TaskInfo) {
      await this._delay(`MySubBaseTasks1 beforeAll - ${taskInfo.task}`);
    }

    async $afterAll() {
      return this._delay('MySubBaseTasks1 afterAll');
    }

    async $beforeEach(taskInfo: TaskInfo) {
      return this._delay(`MySubBaseTasks1 beforeEach - ${taskInfo.task}`);
    }

    async $afterEach(taskInfo: TaskInfo) {
      await this._delay(`MySubBaseTasks1 afterEach - ${taskInfo.task}`);
    }

    taskA1() {
      return this._delay('MySubBaseTasks1 taskA1');
    }
  }

  class MySubBaseTasks2 extends bz.Tasks {
    _delay(message: string, delay = 100): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init() {
      this.logger.log('MySubBaseTasks2 init');
    }

    async $beforeAll(taskInfo: TaskInfo) {
      await this._delay(`MySubBaseTasks2 beforeAll - ${taskInfo.task}`);
    }

    async $afterAll() {
      return this._delay('MySubBaseTasks2 afterAll');
    }

    async $beforeEach(taskInfo: TaskInfo) {
      return this._delay(`MySubBaseTasks2 beforeEach - ${taskInfo.task}`);
    }

    async $afterEach(taskInfo: TaskInfo) {
      await this._delay(`MySubBaseTasks2 afterEach - ${taskInfo.task}`);
    }

    taskA2() {
      return this._delay('MySubBaseTasks2 taskA2');
    }
  }

  class MyBaseTasks extends bz.Tasks {
    _delay(message: string, delay = 100): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init() {
      this.logger.log('MyBaseTasks init');
      this.$addSubTasks(MySubBaseTasks1);
    }

    $beforeAll(taskInfo: TaskInfo) {
      return this._delay(`MyBaseTasks beforeAll - ${taskInfo.task}`).then(() => {
        return this.$addSubTasks(MySubBaseTasks2);
      });
    }

    $afterAll() {
      return this._delay('MyBaseTasks afterAll');
    }

    $beforeEach(taskInfo: TaskInfo) {
      return this._delay(
        `MyBaseTasks beforeEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`
      );
    }

    $afterEach(taskInfo: TaskInfo) {
      return this._delay(
        `MyBaseTasks afterEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`
      );
    }

    taskA(vars: any) {
      return this._delay(`MyBaseTasks taskA - ${vars.hello}`);
    }

    taskB(_vars: any) {
      return this._delay('MyBaseTasks taskB');
    }
  }

  class MyTasks extends bz.Tasks {
    _delay(message: string, delay = 100): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init() {
      this.logger.log('MyTasks init');
      this.$addSubTasks(MyBaseTasks);
    }

    async $beforeEach(taskInfo: TaskInfo) {
      await this._delay(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    async $afterEach(taskInfo: TaskInfo) {
      await this._delay(`MyTasks afterEach - ${taskInfo.task}`);
    }

    async $beforeAll(taskInfo: TaskInfo) {
      await this._delay(`MyTasks beforeAll - ${taskInfo.task}`);
    }

    async $afterAll() {
      await this._delay(`MyTasks afterAll`);
    }

    task1() {
      this.logger.log('MyTasks task1');
      return this.$sequence(
        {
          task: '.MyBaseTasks.taskA',
          vars: { hello: 'world' }
        },
        '.MyBaseTasks.taskB',
        '.MyBaseTasks.MySubBaseTasks2.taskA2'
      );
    }

    task2() {
      this.logger.log('MyTasks task2');
    }

    _internalFunction() {
      this.logger.error('this should be ignored');
    }
  }
  bz.add(MyTasks);

  await bz.run('MyTasks.MyBaseTasks.MySubBaseTasks1.taskA1', 'MyTasks.task1', 'MyTasks.task2');
  /* Output:
MyTasks init
MyBaseTasks init
MySubBaseTasks1 init
MyTasks beforeAll - taskA1
MyBaseTasks beforeAll - taskA1
MySubBaseTasks2 init
MySubBaseTasks1 beforeAll - taskA1
MySubBaseTasks1 beforeEach - taskA1
MySubBaseTasks1 taskA1
MySubBaseTasks1 afterEach - taskA1
MyTasks beforeEach - task1
MyTasks task1
MyBaseTasks beforeEach - taskA {"hello":"world"}
MyBaseTasks taskA - world
MyBaseTasks afterEach - taskA {"hello":"world"}
MyBaseTasks beforeEach - taskB {}
MyBaseTasks taskB
MyBaseTasks afterEach - taskB {}
MySubBaseTasks2 beforeAll - taskA2
MySubBaseTasks2 beforeEach - taskA2
MySubBaseTasks2 taskA2
MySubBaseTasks2 afterEach - taskA2
MyTasks afterEach - task1
MyTasks beforeEach - task2
MyTasks task2
MyTasks afterEach - task2
MySubBaseTasks1 afterAll
MySubBaseTasks2 afterAll
MyBaseTasks afterAll
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
