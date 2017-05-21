'use strict';
const BzTasks  = require('./bzTasksClass.js');
const util     = require('./util.js');

/**
 * Beelzebub Interface Task Class, should be extended
 * @class
 */
class InterfaceTasks extends BzTasks {
  constructor (config) {
    super(config);
  }

  /**
   * This needs to be Extented
   * @interface
   * @example {@embed ../examples/api/interfaceTask.js}
   */
  $replaceWith () {
    this.logger.error('$replaceWith should be replaced');
    return null;
  }

  /**
   * This extends from BzTasks
   * @private
   */
  $register () {
    let tasksClass = this.$replaceWith(this.$config());
    if (tasksClass) {
      if (util.isPromise(tasksClass)) {
        tasksClass.then((tasksClass) => {
          this.beelzebub.add(tasksClass, { name: this.name });
        })
        .catch((err) => {
          this.logger.error('$replaceWith Error:', err);
        });
      }
      else {
        this.beelzebub.add(tasksClass, { name: this.name });
      }
    }

    return Promise.resolve();
  }
}

module.exports = InterfaceTasks;
