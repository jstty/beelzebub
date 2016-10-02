'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyRootLevel extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$useAsRoot();
    }

    default () {
      this.logger.log('MyRootLevel myDefault');
    }

    task1 () {
      this.logger.log('MyRootLevel task1');
    }

    task2 () {
      this.logger.log('MyRootLevel task2');
    }
}

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName('MyTasks');
      this.$setDefault('myDefault');
    }

    myDefault () {
      this.logger.log('MyTasks myDefault');
    }
}

  bz.add(MyRootLevel);
  bz.add(MyTasks);

  bz.run(
    'default',
    'task1',
    'task2',
    'MyTasks'
  );
/* Output:
MyRootLevel myDefault
MyRootLevel task1
MyRootLevel task2
MyTasks myDefault
*/
// =====================================================

// !-- FOR TESTS
  return bz; };
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
