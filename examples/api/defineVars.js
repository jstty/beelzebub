'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  const Beelzebub = require('../../');
  const bz = Beelzebub(options || { verbose: true });
  const task = Beelzebub.TmplStrFunc.task;

  class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
      super(config);

      this.$defineTaskVars('task1', {
        name: { type: 'String', default: 'hello' },
        flag: { type: 'Boolean', default: true }
      });
      this.$defineTaskVars('task2', {
        count:   { type: 'Number', required: true },
        verbose: { type: 'Boolean', alias: 'v', default: false }
      });
      this.$defineTaskVars('task3', {
        fullname: {
          type: 'Object', 
          properties: {
            first: { type: 'String' },
            last: { type: 'String' }
          }
        },
        list: {
          type: 'Array', 
          items: { type: 'String' }
        }
      });
    }
    
    task1 (customVars) {
      this.logger.log(`MyTasks task1 - ${customVars.name} ${customVars.flag}`);
    }

    task2 (customVars) {
      this.logger.log(`MyTasks task2 - ${customVars.count} ${customVars.verbose}`);
    }

    task3 (customVars) {
      this.logger.log(`MyTasks task3 - "${customVars.fullname.first} ${customVars.fullname.last}" ${customVars.list}`);
    }
  }

  bz.add(MyTasks);
  
  let p = bz.run(
    'MyTasks.task1',
    task`MyTasks.task2:${ {count: 100, verbose: true} }`,
    {
      task: 'MyTasks.task3',
      vars: { 
        fullname: { first: 'hello', last: 'world' },
        list: [ 'te', 'st' ]
      }
    }
  );
/* Output:
MyTasks task1 - hello true
MyTasks task2 - 100 true
MyTasks task3 - "hello world" te,st
*/
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
