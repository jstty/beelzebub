/**
 * Running:
 * $ bz MyTasks.task1 MyTasks.task2
 */
import bz_factory, { vars } from '../../src/index.js';

const bz = bz_factory();

export default class MyTasks extends bz.Tasks {
  @vars({
    name: { type: 'String', default: 'hello' },
    flag: { type: 'Boolean', default: true }
  })
  task1(customVars: any) {
    this.logger.log(`MyTasks task1 - ${customVars.name} ${customVars.flag}`);
  }

  @vars({
    count: { type: 'Number', required: true },
    verbose: { type: 'Boolean', alias: 'v', default: false }
  })
  task2(customVars: any) {
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
  task3(customVars: any) {
    this.logger.log(
      `MyTasks task3 - "${customVars.fullname.first} ${customVars.fullname.last}" ${customVars.list}`
    );
  }
}
