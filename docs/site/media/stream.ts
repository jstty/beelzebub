// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import * as fs from 'node:fs';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyTasks extends bz.Tasks {
    constructor(config?: any) {
      super(config);
      this.$setName('MyTasks');
    }

    task1() {
      let data = '';

      const stream = fs.createReadStream('./static-files/src/file1.txt');
      stream.setEncoding('utf8');

      stream.on('data', (chunk) => {
        data += chunk;
      });

      stream.on('end', () => {
        this.logger.log('MyTasks task1 data size:', data.length);
      });

      return stream;
    }

    task2() {
      this.logger.log('MyTasks task2');
    }
  }

  bz.add(MyTasks);

  await bz.run('MyTasks.task1', 'MyTasks.task2');
  /* Output:
MyTasks task1 data size: 840
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
