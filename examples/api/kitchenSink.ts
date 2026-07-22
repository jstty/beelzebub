// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyBaseTasks extends bz.Tasks {
    constructor(config?: any) {
      super(config);
      this.$setName('MyBaseTasks');
    }

    task1() {
      this.logger.log('MyBaseTasks task1');
    }

    task2() {
      this.logger.log('MyBaseTasks task2');
    }

    _internalFunction() {
      this.logger.error('this should be ignored');
    }
  }

  class MyTasks extends MyBaseTasks {
    constructor(config?: any) {
      super(config);
      this.$setName('MyTasks');
    }

    override task1() {
      this.logger.log('MyTasks task1');
    }

    task3() {
      this.logger.log('MyTasks task3');
    }
  }

  class SuperTasks extends bz.Tasks {
    maxCount = 2;

    constructor(config?: any) {
      super(config);
      this.$setName('SuperTasks');

      this.$addSubTasks(MyTasks, {});
    }

    task1() {
      let count = 0;
      return new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          count++;
          if (count >= this.maxCount) {
            clearTimeout(timer);
            resolve();
          }
          this.logger.log('SuperTasks task1:', count);
        }, 200);
      });
    }
    task2() {
      let count = 0;

      return new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          count++;
          if (count >= this.maxCount) {
            clearTimeout(timer);
            resolve();
          }
          this.logger.log('SuperTasks task2:', count);
        }, 300);
      });
    }

    seqTask() {
      return this.$sequence('SuperTasks.task1', this.task2.bind(this), 'SuperTasks.lineTask');
    }

    palTask() {
      this.logger.log('SuperTasks palTask');
      return this.$parallel('SuperTasks.task1', this.task2.bind(this));
    }

    lineTask() {
      this.logger.log('------------------------------');
    }

    comboTask() {
      this.logger.log('SuperTasks comboTask');
      return this.$sequence(
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

  await bz.run('MyBaseTasks.task1', 'MyTasks.task1', 'SuperTasks.lineTask', 'SuperTasks.comboTask');
  /* Output:
MyBaseTasks task1
MyTasks task1
------------------------------
SuperTasks comboTask
SuperTasks task1: 1
SuperTasks task1: 2
------------------------------
SuperTasks palTask
SuperTasks task1: 1
SuperTasks task2: 1
SuperTasks task1: 2
SuperTasks task2: 2
------------------------------
SuperTasks task2: 1
SuperTasks task2: 2
*/
  // </EXAMPLE>
  // =====================================================

  // !-- FOR TESTS
  return bz;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void wrapper();
}
// --!
