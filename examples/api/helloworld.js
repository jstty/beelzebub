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
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
}
  bz.add(MyTasks);

  let p = bz.run('MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks task1
MyTasks task2
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
