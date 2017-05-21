#!/usr/bin/env bz
/**
 * Running:
 * $ myscript.sh
 * Output:
 * MyTasks default
 *
 * Running:
 * $ myscript.sh task1 task2
 * Output:
 * MyTasks task1
 * MyTasks task2
 *
 */

// simulate loading from a different BZ (for Global vs Local), but still functioanlly the same
const Beelzebub = require('../../');

class MyTasks extends Beelzebub.Tasks {
  constructor (config) {
    super(config);
    this.$useAsRoot();
    this.$setDefault('myDefault');
    this.$setName('MyTasks');
  }

  myDefault () {
    this.logger.log('MyTasks myDefault');
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

module.exports = MyTasks;
