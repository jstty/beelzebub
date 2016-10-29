'use strict';
/**
 * Running:
 * $ bz MyTasks.task1 MyTasks.task2
 */

// simulate loading from a different BZ (for Global vs Local), but still functioanlly the same
const Beelzebub = require('../../../');

class MyTasks extends Beelzebub.Tasks {
  task1 () {
    this.logger.log('MyTasks task1');
  }
}

module.exports = MyTasks;
