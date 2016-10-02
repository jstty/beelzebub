'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MySubSubBaseTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName(config.name || 'MySubSubBaseTasks');

      this.value = config.value;
      this._delayTime = config.delayTime || 500;
    }

    $init () {
      this.logger.log(`${this.name} init`);
    }

    _delay (message, delay) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay || this._delayTime);
      });
    }

    task1 () {
      // return this.$parallel(this.task2, this.task3);
      return this._delay(`${this.name} task1 - ${this.value}`);
    }

    task2 () {
      return this._delay(`${this.name} task2 - ${this.value}`);
    }

    task3 () {
      return this._delay(`${this.name} task3 - ${this.value}`);
    }
  }

  class MySubBaseTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName(config.name || 'MySubBaseTasks');

      this.value = config.value;
    }

    $init () {
      this.logger.log(`${this.name} init`);
      // simlate tasks dynamiclly added after some async event
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.$addSubTasks(MySubSubBaseTasks, { name: 'MySubSubBaseTasks1', value: this.value * 123 });
          this.$addSubTasks(MySubSubBaseTasks, { name: 'MySubSubBaseTasks2', value: this.value * 456, delayTime: 200 });
          // done
          resolve();
        }, 200);
      });
    }

    default () {
      this.logger.log(this.name + ' default');
      return this.$sequence('.MySubSubBaseTasks1.task1', '.MySubSubBaseTasks2.task1');
    }
  }

  class MyTasks extends Beelzebub.Tasks {
    $init () {
      this.logger.log(`${this.name} init`);
      // simlate tasks dynamiclly added after some async event
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.$addSubTasks(MySubBaseTasks, { name: 'MySubBaseTasks1', value: 1 });
          this.$addSubTasks(MySubBaseTasks, { name: 'MySubBaseTasks2', value: 2 });
          // done
          resolve();
        }, 200);
      });
    }

    default () {
      this.logger.log(`${this.name} task1`);
      // relative path using '.'
      return this.$sequence('.MySubBaseTasks1', '.MySubBaseTasks2');
    }
  }

  bz.add(MyTasks);
  bz.run('MyTasks');
/* Output:
MyTasks init
MySubBaseTasks1 init
MySubBaseTasks2 init
MySubSubBaseTasks1 init
MySubSubBaseTasks2 init
MySubSubBaseTasks1 init
MySubSubBaseTasks2 init
MyTasks task1
MySubBaseTasks1 default
MySubSubBaseTasks1 task1 - 123
MySubSubBaseTasks2 task1 - 456
MySubBaseTasks2 default
MySubSubBaseTasks1 task1 - 246
MySubSubBaseTasks2 task1 - 912
*/
// =====================================================

// !-- FOR TESTS
  return bz; };
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
