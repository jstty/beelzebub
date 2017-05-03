'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

/**
 * -- Note --
 * Node does not support decorators so you will need to run this with bable-cli
 * $ ../../node_modules/.bin/babel-node decorator.js
 *
 * To use in your own projects you will need to add babel with the
 * 'babel-plugin-transform-decorators-legacy' plugin
 */

// =====================================================
// <EXAMPLE>
  const Beelzebub = require('../../');
  const {defaultTask, help} = require('../../').decorators;
  const bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    @defaultTask
    @help('ES7 Decorator Example MyTasks - Task 1')
    task1 () {
      this.logger.log('MyTasks task1');
    }

    @help('ES7 Decorator Example MyTasks - Task 2')
    task2 () {
      this.logger.log('MyTasks task2');
    }
  }
  bz.add(MyTasks);

  class MyTasks2 extends bz.Tasks {
    @defaultTask
    @help('ES7 Decorator Example MyTasks2 - Task 1')
    task1 () {
      this.logger.log('MyTasks2 task1');
    }

    @help('ES7 Decorator Example MyTasks2 - Task 2')
    task2 () {
      this.logger.log('MyTasks2 task2');
    }
  }
  bz.add(MyTasks2);

  let p = bz.run('MyTasks', 'MyTasks.task2', 'MyTasks2', 'MyTasks2.task2');
  // prints help results
  // bz.printHelp();
/* Output:
MyTasks task1
MyTasks task2
MyTasks2 task1
MyTasks2 task2
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
