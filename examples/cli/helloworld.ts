/**
 * Running:
 * $ bz MyTasks.task1 MyTasks.task2
 *
 * Output:
 * MyTasks task1
 * MyTasks task2
 */

import bz_factory from '../../src/index.js';

const bz = bz_factory();

export default class MyTasks extends bz.Tasks {
  constructor(config?: any) {
    super(config);
    this.$setName('MyTasks');
  }

  task1() {
    this.logger.log('MyTasks task1');
  }

  task2() {
    this.logger.log('MyTasks task2');
  }

  _internalFunction() {
    this.logger.error('this should be ignored');
  }
}
