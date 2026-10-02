/**
 * Running:
 * $ bz --help
 */
import bz_factory, { defaultTask, help } from '../../src/index.js';

const bz = bz_factory();

class MyTasks extends bz.Tasks {
  @defaultTask
  @help('ES7 Decorator Example MyTasks - Task 1')
  task1() {
    this.logger.log('MyTasks task1');
  }

  @help('ES7 Decorator Example MyTasks - Task 2')
  task2() {
    this.logger.log('MyTasks task2');
  }
}

class MyTasks2 extends bz.Tasks {
  @defaultTask
  @help('ES7 Decorator Example MyTasks2 - Task 1')
  task1() {
    this.logger.log('MyTasks2 task1');
  }

  @help('ES7 Decorator Example MyTasks2 - Task 2')
  task2() {
    this.logger.log('MyTasks2 task2');
  }
}

export default [MyTasks, MyTasks2];
