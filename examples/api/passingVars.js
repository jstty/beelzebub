'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
// <EXAMPLE>
  const Beelzebub = require('../../');
  const bz = Beelzebub(options || { verbose: true });
  const task = Beelzebub.TmplStrFunc.task;

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$setGlobalVars({
        'v1': 'hello',
        'v2': 'world',
        'v3': 'test'
      });
    }

    task1 (customVars) {
      this.logger.log(`MyTasks task1 - ${this.$getGlobalVars().v1} ${customVars.a}`);
    }

    task2 (customVars) {
      this.logger.log(`MyTasks task2 - ${this.$getGlobalVars().v2} ${customVars.b}`);
    }

    task3 (customVars) {
      this.logger.log(`MyTasks task3 - ${this.$getGlobalVars().v3} ${customVars.c}`);
    }
  }

  bz.add(MyTasks);

  let p = bz.run(
    'MyTasks.task1:{"a": 1}',
    task`MyTasks.task2:${{b: 2}}`,
    // bz.task('MyTasks.task2', {b: 2}),
    {
      task: 'MyTasks.task3',
      vars: { c: 3 }
    }
  );
/* Output:
MyTasks task1 - hello 1
MyTasks task2 - world 2
MyTasks task3 - test 3
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
