'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyBaseTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName('MyBaseTasks');
    }

    task1 () {
      this.logger.log('MyBaseTasks task1');
    }

    task2 () {
      this.logger.log('MyBaseTasks task2');
    }

    task2_option () {
      this.logger.log('MyBaseTasks task2 option');
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
}
  Beelzebub.add(MyBaseTasks);

  class MyTasks extends MyBaseTasks {
    constructor (config) {
      super(config);
      this.$setName('MyTasks');
    }

    task1 () {
      this.logger.log('MyTasks task1');
    }

    task3 () {
      this.logger.log('MyTasks task3');
    }
}

  bz.add(MyTasks);

  let p = bz.run(
    'MyTasks.task1',
    'MyTasks.task3',
    'MyTasks.task2',
    'MyTasks.task2:option'
  );
/* Output:
MyTasks task1
MyTasks task3
MyBaseTasks task2
MyBaseTasks task2 option
*/
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
