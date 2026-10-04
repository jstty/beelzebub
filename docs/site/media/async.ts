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
    _delayTime = 500;

    constructor(config?: any) {
      super(config);
      this.$setName('MyTasks');
    }

    _delay(message: string, delay: number): Promise<void> {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    /** Promise based task */
    task1() {
      this.logger.log('MyTasks task1: before');
      return this._delay('MyTasks task1: promise delay ' + this._delayTime, this._delayTime).then(
        () => {
          this.logger.log('MyTasks task1: after');
        }
      );
    }

    /** async/await based task (was generator) */
    async task2() {
      const delay = this._delayTime + 200;
      this.logger.log('MyTasks task2: before');
      await this._delay('MyTasks task2: yield delay ' + delay, delay);
      this.logger.log('MyTasks task2: after');
    }
  }
  bz.add(MyTasks);

  await bz.run(
    // all args run in sequence
    'MyTasks.task1',
    'MyTasks.task2',
    [
      // arrays run in parallel
      'MyTasks.task1',
      'MyTasks.task2'
    ]
  );
  /* Output:
MyTasks task1: before
MyTasks task1: promise delay 500
MyTasks task1: after
MyTasks task2: before
MyTasks task2: yield delay 700
MyTasks task2: after
MyTasks task1: before
MyTasks task2: before
MyTasks task1: promise delay 500
MyTasks task1: after
MyTasks task2: yield delay 700
MyTasks task2: after
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
