'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    $beforeEach (taskInfo) {
      this.logger.log(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    $afterEach (taskInfo) {
      this.logger.log(`MyTasks afterEach - ${taskInfo.task}`);
    }

    $beforeAll () {
      this.logger.log(`MyTasks beforeAll`);
    }

    $afterAll () {
      this.logger.log(`MyTasks afterAll`);
    }

    // my tasks
    task1 () {
      this.logger.log('MyTasks task1');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }
  }

  bz.add(MyTasks);

  let p = bz.run('MyTasks.task1', 'MyTasks.task2');

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

// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
