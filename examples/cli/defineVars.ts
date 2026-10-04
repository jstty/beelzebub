/**
 * Running:
 * $ bz MyTasks.task1 MyTasks.task2 --count=100 -v MyTasks.task3 --fullname.first=hello --fullname.last=world --list=te --list=st
 */
import bz_factory from '../../src/index.js';

const bz = bz_factory();

export default class MyTasks extends bz.Tasks {
  constructor(config?: any) {
    super(config);

    this.$defineTaskVars('task1', {
      name: { type: 'String', default: 'hello' },
      flag: { type: 'Boolean', default: true }
    });
    this.$defineTaskVars('task2', {
      count: { type: 'Number', required: true },
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

  $beforeAll(taskInfo: any) {
    this.logger.log(`MyTasks beforeAll - ${taskInfo.task} ${taskInfo.vars.name}`);
  }

  task1(customVars: any) {
    this.logger.log(`MyTasks task1 - ${customVars.name} ${customVars.flag}`);
  }

  task2(customVars: any) {
    this.logger.log(`MyTasks task2 - ${customVars.count} ${customVars.verbose}`);
  }

  task3(customVars: any) {
    this.logger.log(
      `MyTasks task3 - "${customVars.fullname.first} ${customVars.fullname.last}" ${customVars.list}`
    );
  }
}
