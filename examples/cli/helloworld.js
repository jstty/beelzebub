'use strict';
// simulate loading from a different BZ (for Global vs Local), but still functioanlly the same
const Beelzebub = require('../../legacy');

class MyTasks extends Beelzebub.Tasks {
  constructor (config) {
    super(config);
    this.$setName('MyTasks');
  }

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

// bz MyTasks.task1 MyTasks.task2
module.exports = MyTasks;
