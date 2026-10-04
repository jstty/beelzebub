/**
 * Running:
 * $ bz --help
 */
import bz_factory from '../../src/index.js';

const bz = bz_factory();

class MyTasks extends bz.Tasks {
  constructor(config?: any) {
    super(config);

    this.$setDefault('task1');

    this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks - Task 1');
    this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks - Task 2');
  }

  task1() {
    this.logger.log('MyTasks task1');
  }

  task2() {
    this.logger.log('MyTasks task2');
  }
}

class MyTasks2 extends bz.Tasks {
  constructor(config?: any) {
    super(config);

    this.$setDefault('task1');

    this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks2 - Task 1');
    this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks2 - Task 2');
  }

  task1() {
    this.logger.log('MyTasks2 task1');
  }

  task2() {
    this.logger.log('MyTasks2 task2');
  }
}

export default [MyTasks, MyTasks2];
