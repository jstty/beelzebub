'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
// <EXAMPLE>
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
  bz.on('$before', 'MyTasks.task1', function (taskInfo, data) {
    this.logger.log('$before event task:', taskInfo, ', data:', data);
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
  bz.on('$before', function (taskInfo, data) {
    this.logger.log('$before ALL event task:', taskInfo, ', data:', data);
  });

  bz.on('$after', function (taskInfo, data) {
    this.logger.log('$after ALL event task:', taskInfo, ', data:', data);
  });

  bz.on('customEvent', function (taskInfo, data) {
    this.logger.log('customEvent ALL event task:', taskInfo, ', data:', data);
  });

  bz.add(MyTasks);

  let p = bz.run(
    {
      task: 'MyTasks.task1',
      vars: { hello: 'vars' }
    },
    'MyTasks.task2');
/* Output:
$before event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
$before ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
MyTasks task1
customEvent event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}
customEvent ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}
$after event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
$after ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
$before ALL event task: {"task":"MyTasks.task2","vars":{}} , data:
MyTasks task2
customEvent ALL event task: {"task":"MyTasks.task2","vars":{}} , data: {"hello":"world2"}
$after ALL event task: {"task":"MyTasks.task2","vars":{}} , data:
*/
// </EXAMPLE>
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
