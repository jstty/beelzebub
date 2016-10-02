'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    _delay (message, delay = 300) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence('.task3', '.task4');
    }

    task2 () {
      return this._delay('MyTasks task2', 200);
    }

    task3 () {
      this.logger.log('MyTasks task3');
      return this.$run('.task5', '.task6');
    }

    task4 () {
      return this._delay('MyTasks task4', 400);
    }

    task5 () {
      this.logger.log('MyTasks task5');
    }

    task6 () {
      return this._delay('MyTasks task6', 600);
    }
}

  bz.add(MyTasks);
  // params are run in sequence
  let p = bz.run('MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks task1
MyTasks task3
MyTasks task5
MyTasks task6
MyTasks task4
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
