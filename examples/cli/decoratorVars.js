'use strict';
/**
 * Running:
 * $ bz MyTasks.task1 MyTasks.task2
 * 
 * Output:
 * MyTasks task1 - hello true
 * MyTasks task2 - 100 true
 * MyTasks task3 - "hello world" te,st
 * 
 */

// simulate loading from a different BZ (for Global vs Local), but still functioanlly the same
const Beelzebub = require('../../');
const {vars} = require('../../').decorators;

class MyTasks extends Beelzebub.Tasks {
  
  @vars({
    name: { type: 'String', default: 'hello' },
    flag: { type: 'Boolean', default: true }
  })
  task1 (customVars) {
    this.logger.log(`MyTasks task1 - ${customVars.name} ${customVars.flag}`);
  }

  @vars({
    count:   { type: 'Number', required: true },
    verbose: { type: 'Boolean', alias: 'v', default: false }
  })
  task2 (customVars) {
    this.logger.log(`MyTasks task2 - ${customVars.count} ${customVars.verbose}`);
  }

  @vars({
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
  })
  task3 (customVars) {
    this.logger.log(`MyTasks task3 - "${customVars.fullname.first} ${customVars.fullname.last}" ${customVars.list}`);
  }
}

module.exports = MyTasks;
