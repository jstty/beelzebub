// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyTasks extends bz.Tasks {
    _delay(message: string, delay = 300): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    task1() {
      this.logger.log('MyTasks task1');
      return this.$sequence('.task3', '.task4');
    }

    task2() {
      return this._delay('MyTasks task2', 200);
    }

    task3() {
      this.logger.log('MyTasks task3');
      return this.$run('.task5', '.task6');
    }

    task4() {
      return this._delay('MyTasks task4', 400);
    }

    task5() {
      this.logger.log('MyTasks task5');
    }

    task6() {
      return this._delay('MyTasks task6', 600);
    }
  }

  bz.add(MyTasks);
  // params are run in sequence
  await bz.run('MyTasks.task1', 'MyTasks.task2');
  /* Output:
MyTasks task1
MyTasks task3
MyTasks task5
MyTasks task6
MyTasks task4
MyTasks task2
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
