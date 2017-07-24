'use strict';
/**
 * Running:
 * $ bz --myGlobalVar=hello MyTasks1 --v1=1 MyTasks2.task --v1=2
 *
 * Output:
 * MyTasks1 default hello 1
 * MyTasks1 task hello 2
 *
 */

// simulate loading from a different BZ (for Global vs Local), but still functioanlly the same
const Beelzebub = require('../../');

class MyTasks1 extends Beelzebub.Tasks {
    default(aVars) {
        const gVars = this.$getGlobalVars();
        this.logger.log(`MyTasks1 default ${gVars.myGlobalVar} ${aVars.v1}`);
    }
}

class MyTasks2 extends Beelzebub.Tasks {
    task(aVars) {
        const gVars = this.$getGlobalVars();
        this.logger.log(`MyTasks1 task ${gVars.myGlobalVar} ${aVars.v1}`);
    }
}

module.exports = [MyTasks1, MyTasks2];
