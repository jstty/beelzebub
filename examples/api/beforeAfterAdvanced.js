'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MySubBaseTasks1 extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MySubBaseTasks1 init');
    }

    // generator function
    * $beforeEach (taskInfo) {
      return this._delay(`MySubBaseTasks1 beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MySubBaseTasks1 afterEach - ${taskInfo.task}`);
    }

    // generator function
    * $beforeAll () {
      yield this._delay('MySubBaseTasks1 beforeAll');
    }

    // generator function
    * $afterAll () {
      return this._delay('MySubBaseTasks1 afterAll');
    }

    taskA1 () {
      return this._delay('MySubBaseTasks1 taskA1');
    }
  }

  class MySubBaseTasks2 extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MySubBaseTasks2 init');
    }

    // generator function
    * $beforeEach (taskInfo) {
      return this._delay(`MySubBaseTasks2 beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MySubBaseTasks2 afterEach - ${taskInfo.task}`);
    }

    // generator function
    * $beforeAll () {
      yield this._delay('MySubBaseTasks2 beforeAll');
    }

    // generator function
    * $afterAll () {
      return this._delay('MySubBaseTasks2 afterAll');
    }

    taskA2 () {
      return this._delay('MySubBaseTasks2 taskA2');
    }
  }

  class MyBaseTasks extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MyBaseTasks init');
      // see subtasksSimple or Advanced for details on adding sub tasks
      this.$addSubTasks(MySubBaseTasks1);
      this.$addSubTasks(MySubBaseTasks2);
    }

    // returns promise
    $beforeEach (taskInfo) {
      return this._delay(`MyBaseTasks beforeEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`);
    }

    // returns promise
    $afterEach (taskInfo) {
      return this._delay(`MyBaseTasks afterEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`);
    }

    // returns promise
    $beforeAll () {
      return this._delay('MyBaseTasks beforeAll');
    }

    // returns promise
    $afterAll () {
      return this._delay('MyBaseTasks afterAll');
    }

    taskA (vars) {
      return this._delay(`MyBaseTasks taskA - ${vars.hello}`);
    }

    taskB (vars) {
      return this._delay('MyBaseTasks taskB');
    }
  }

  class MyTasks extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MyTasks init');
      // see subtasksSimple or Advanced for details on adding sub tasks
      this.$addSubTasks(MyBaseTasks);
    }

    // generator function
    * $beforeEach (taskInfo) {
      yield this._delay(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MyTasks afterEach - ${taskInfo.task}`);
    }

    // generator function
    * $beforeAll () {
      yield this._delay('MyTasks beforeAll');
    }

    // generator function
    * $afterAll () {
      yield this._delay('MyTasks afterAll');
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence({
        task: 'MyTasks.MyBaseTasks.taskA',
        vars: { hello: 'world' }
      },
      'MyTasks.MyBaseTasks.taskB',
      'MyTasks.MyBaseTasks.MySubBaseTasks2.taskA2');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
  }
  bz.add(MyTasks);

  let p = bz.run('MyTasks.MyBaseTasks.MySubBaseTasks1.taskA1', 'MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks init
MyBaseTasks init
MySubBaseTasks1 init
MySubBaseTasks2 init
MyTasks beforeAll
MyBaseTasks beforeAll
MySubBaseTasks1 beforeAll
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
MySubBaseTasks2 beforeAll
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
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
