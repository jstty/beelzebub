'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
// <EXAMPLE>
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyCustomTasks1 extends Beelzebub.Tasks {
    task1 () {
      this.logger.log('MyCustomTasks1 task1');
    }
  }

  class MyCustomTasks2 extends Beelzebub.Tasks {
    task1 () {
      this.logger.log('MyCustomTasks2 task1');
    }
  }

  class MyTasks extends Beelzebub.InterfaceTasks {
    $replaceWith (config) {
      let tasksClass = null;

      if (config.interfaceType === 'MyCustomTasks1') {
        tasksClass = MyCustomTasks1;
      }
      else if (config.interfaceType === 'MyCustomTasks2') {
        tasksClass = Promise.resolve(MyCustomTasks2);
      }

      return tasksClass;
    }
  }

  bz.add(MyTasks, { interfaceType: 'MyCustomTasks2' });
  let p = bz.run('MyTasks.task1');
/* Output:
MyCustomTasks2 task1
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
