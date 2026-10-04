// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyRootLevel extends bz.Tasks {
    constructor(config?: any) {
      super(config);

      this.$useAsRoot();
      this.$setDefault('myDefault');
    }

    myDefault() {
      this.logger.log('MyRootLevel myDefault');
    }
  }

  bz.add(MyRootLevel);

  await bz.run();
  /* Output:
MyRootLevel myDefault
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
