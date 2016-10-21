'use strict';
/**
 * Running:
 * $ bz MyTasks.task1 MyTasks.task2
 */

// simulate loading from a different BZ (for Global vs Local), but still functioanlly the same
const Beelzebub = require('../../');

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

module.exports = MyTasks;
