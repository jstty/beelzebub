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
      this.$setName('MyBaseTasks');
    }

    task1 () {
      this.logger.log('MyBaseTasks task1');
    }

    task2 () {
      this.logger.log('MyBaseTasks task2');
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
}

  class MyTasks extends MyBaseTasks {
    constructor (config) {
      super(config);
      this.$setName('MyTasks');
    }

    task1 () {
      this.logger.log('MyTasks task1');
    }

    task3 () {
      this.logger.log('MyTasks task3');
    }
}

  class SuperTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName('SuperTasks');

      this.maxCount = 2;

      this.$addSubTasks(MyTasks, {
          // config
      });
    }

    task1 () {
      var count = 0;
      return new Promise(function (resolve, reject) {
        var timer = setInterval(function () {
          count++;
          if (count >= this.maxCount) {
            clearTimeout(timer);
            resolve();
          }
          this.logger.log('SuperTasks task1:', count);
        }.bind(this), 200);
      }.bind(this));
    }
    task2 () {
      var count = 0;

      return new Promise(function (resolve, reject) {
        var timer = setInterval(function () {
          count++;
          if (count >= this.maxCount) {
            clearTimeout(timer);
            resolve();
          }
          this.logger.log('SuperTasks task2:', count);
        }.bind(this), 300);
      }.bind(this));
    }

    seqTask () {
      // this.logger.log('SuperTasks seqTask');
      return this.$sequance('SuperTasks.task1', this.task2.bind(this), 'SuperTasks.lineTask');
    }

    palTask () {
      this.logger.log('SuperTasks palTask');
      return this.$parallel('SuperTasks.task1', this.task2.bind(this));
    }

    lineTask () {
      this.logger.log('------------------------------');
    }

    comboTask () {
      this.logger.log('SuperTasks comboTask');
      return this.$sequance(
            'SuperTasks.task1',
            'SuperTasks.lineTask',
            this.palTask.bind(this),
            'SuperTasks.lineTask',
            'SuperTasks.task2'
        );
    }

}

  bz.add(MyBaseTasks);
  bz.add(MyTasks);
  bz.add(SuperTasks);

  bz.run(
    'MyBaseTasks.task1',
    'MyTasks.task1',
    'SuperTasks.lineTask',
    'SuperTasks.comboTask'
);

// =====================================================

// !-- FOR TESTS
  return bz; };
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
