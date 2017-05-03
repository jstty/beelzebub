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
    }

    task1 () {
      this.logger.log('MyRootLevel task1');
    }

    task2 () {
      this.logger.log('MyRootLevel task2');
    }
  }

  class MyTasks1 extends Beelzebub.Tasks {
    default () {
      this.logger.log('MyTasks1 default');
    }
  }

  class MyTasks2 extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$setDefault('myDefault');
    }

    myDefault () {
      this.logger.log('MyTasks2 myDefault');
    }
  }

  bz.add(MyRootLevel);
  bz.add(MyTasks1);
  bz.add(MyTasks2);

  let p = bz.run(
    'task1',
    'task2',
    'MyTasks1',
    'MyTasks1.default',
    'MyTasks2',
    'MyTasks2.myDefault'
  );
/* Output:
MyRootLevel task1
MyRootLevel task2
MyTasks1 default
MyTasks1 default
MyTasks2 myDefault
MyTasks2 myDefault
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
