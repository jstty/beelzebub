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
      return this._delay(this.name + ' init', 200);
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
      return this._delay('MySubSubBaseTasks task1 - ' + this.value);
    }
}

  class MySubBaseTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName(config.name || 'MySubBaseTasks');

      this.value = config.value;
      this._delayTime = config.delayTime || 500;
    }

    $init () {
      this.logger.log(this.name + ' init');
      // simlate tasks dynamiclly added after some async event
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.$addSubTasks(MySubSubBaseTasks, { name: 'MySubSubBaseTasks1', value: 789 });
          this.$addSubTasks(MySubSubBaseTasks, { name: 'MySubSubBaseTasks2', value: 321, delayTime: 100000 });
          // done
          resolve(1234);
        }, 200);
      });
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
      return this._delay('MySubBaseTasks task1 - ' + this.value);
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
          this.$addSubTasks(MySubBaseTasks, { name: 'MySubBaseTasks1', value: 123 });
          this.$addSubTasks(MySubBaseTasks, { name: 'MySubBaseTasks2', value: 456, delayTime: 100000 });
          // done
          resolve(1234);
        }, 200);
      });
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequance('MyTasks.MySubBaseTasks1.task1', 'MyTasks.MySubBaseTasks2.task1');
    }
}

  bz.add(MyTasks);
  bz.run('MyTasks.MySubBaseTasks1.MySubSubBaseTasks1.task1');
// =====================================================

// !-- FOR TESTS
  return bz; };
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
