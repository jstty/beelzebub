// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import gulp from 'gulp';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyTasks extends bz.Tasks {
    _src = './static-files/src';
    _dest = './static-files/dest';

    constructor(config?: any) {
      super(config);
      this.$setName('MyTasks');
    }

    CopyFile() {
      this.logger.log('MyTasks - Coping Files');
      return gulp.src(this._src + '/*', { base: this._src }).pipe(gulp.dest(this._dest));
    }

    async NumberOfDestFiles() {
      const count = (await readdir(this._dest)).length;
      this.logger.log(`MyTasks - Number of Dest Files: ${count}`);
    }

    async DeleteFiles() {
      this.logger.log('MyTasks - Delete Files');
      const files = await readdir(this._dest);
      await Promise.all(
        files
          .filter((file) => file.endsWith('.txt'))
          .map((file) => unlink(path.join(this._dest, file)))
      );
    }
  }

  bz.add(MyTasks);

  await bz.run(
    'MyTasks.NumberOfDestFiles',
    'MyTasks.CopyFile',
    'MyTasks.NumberOfDestFiles',
    'MyTasks.DeleteFiles',
    'MyTasks.NumberOfDestFiles'
  );
  /* Output:
MyTasks - Number of Dest Files: 1
MyTasks - Coping Files
MyTasks - Number of Dest Files: 3
MyTasks - Delete Files
MyTasks - Number of Dest Files: 1
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
