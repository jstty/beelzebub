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
      this.$setName(config.name || 'MyBaseTasks');

      this.value = config.value;
      this._delayTime = 300;
    }

    // TODO: why is this being added to the tasks?
    $init () {
      return this._delay('MyBaseTasks init');
    }

    _delay (message) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, this._delayTime);
      });
    }

    task1 () {
      return this._delay('MyBaseTasks task1 - ' + this.value);
    }
}

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName('MyTasks');
    }

    $init () {
      this.logger.log('MyTasks init');
      // simlate tasks dynamiclly added after some async event
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks1', value: 123 });
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks2', value: 456 });
          // done
          resolve(1234);
        }, 200);
      });
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence('MyTasks.MyBaseTasks1.task1', 'MyTasks.MyBaseTasks2.task1');
    }
  }

  bz.add(MyTasks);
  let p = bz.run('MyTasks.task1');
/* Output:
MyTasks init
MyBaseTasks init
MyBaseTasks init
MyTasks task1
MyBaseTasks task1 - 123
MyBaseTasks task1 - 456
*/
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
