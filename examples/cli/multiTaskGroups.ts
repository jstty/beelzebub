/**
 * Running:
 * $ bz --myGlobalVar=hello MyTasks1 --v1=1 MyTasks2.task --v1=2
 */
import bz_factory from '../../src/index.js';

const bz = bz_factory();

class MyTasks1 extends bz.Tasks {
  default(aVars: any) {
    const gVars = this.$getGlobalVars() as any;
    this.logger.log(`MyTasks1 default ${gVars.myGlobalVar} ${aVars.v1}`);
  }
}

class MyTasks2 extends bz.Tasks {
  task(aVars: any) {
    const gVars = this.$getGlobalVars() as any;
    this.logger.log(`MyTasks1 task ${gVars.myGlobalVar} ${aVars.v1}`);
  }
}

export default [MyTasks1, MyTasks2];
