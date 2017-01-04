'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    task1 () {
      this.logger.log('MyTasks task1');
      this.$emit('customEvent', { hello: 'world1' });
    }

    task2 () {
      this.logger.log('MyTasks task2');
      this.$emit('customEvent', { hello: 'world2' });
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
  }

  // using filter
  bz.on('$before', 'MyTasks.task1', (taskInfo, data) => {
    console.log('$before event task:', taskInfo, ', data:', data);
  });

  // NOTE: arrow functions can NOT use apply, call or bind
  // so if you want to use this.logger you have to make it a function
  bz.on('$after', 'MyTasks.task1', function (taskInfo, data) {
    this.logger.log('$after event task:', taskInfo, ', data:', data);
  });

  bz.on({
    name: 'customEvent',
    task: 'MyTasks.task1',
    callback (taskInfo, data) {
      this.logger.log('customEvent event task:', taskInfo, ', data:', data);
    }
  });
  // bz.on('customEvent', 'MyTasks.task1', (taskInfo, data) => {
  //   console.log('customEvent event task:', taskInfo, ', data:', data);
  // });

  // for ALL tasks
  bz.on('$before', (taskInfo, data) => {
    console.log('$before ALL event task:', taskInfo, ', data:', data);
  });

  bz.on('$after', (taskInfo, data) => {
    console.log('$after ALL event task:', taskInfo, ', data:', data);
  });

  bz.on('customEvent', (taskInfo, data) => {
    console.log('customEvent ALL event task:', taskInfo, ', data:', data);
  });

  bz.add(MyTasks);

  let p = bz.run('MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks task1
MyTasks task2
*/
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
