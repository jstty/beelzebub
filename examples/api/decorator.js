'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
    }

    @Beelzebub.task.default
    @Beelzebub.task.help('ES7 Decorator Example MyTasks - Task 1')
    task1 () {
      this.logger.log('MyTasks task1');
    }

    @Beelzebub.task.help('ES7 Decorator Example MyTasks - Task 2')
    task2 () {
      this.logger.log('MyTasks task2');
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
  }
  bz.add(MyTasks);

  class MyTasks2 extends Beelzebub.Tasks {
    constructor (config) {
      super(config);  
    }

    @Beelzebub.task.default
    @Beelzebub.task.help('ES7 Decorator Example MyTasks2 - Task 1')
    task1 () {
      this.logger.log('MyTasks2 task1');
    }

    @Beelzebub.task.help('ES7 Decorator Example MyTasks2 - Task 2')
    task2 () {
      this.logger.log('MyTasks2 task2');
    }
  }
  bz.add(MyTasks2);

  bz.run('MyTasks', 'MyTasks.task2', 'MyTasks2', 'MyTasks2.task2');
  // bz.printHelp();
// =====================================================

// !-- FOR TESTS
  return bz; };
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!