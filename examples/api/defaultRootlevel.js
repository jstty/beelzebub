'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
// <EXAMPLE>
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyRootLevel extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$useAsRoot();
      this.$setDefault('myDefault');
    }

    myDefault () {
      this.logger.log('MyRootLevel myDefault');
    }
  }

  bz.add(MyRootLevel);

  let p = bz.run();
/* Output:
MyRootLevel myDefault
*/
// </EXAMPLE>
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
