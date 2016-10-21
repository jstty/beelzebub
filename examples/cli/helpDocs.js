'use strict';

/**
 * -- Note --
 * Node does not support decorators so you will need to run this with bable-cli
 * $ ../../node_modules/.bin/babel-node decorator.js
 *
 * To use in your own projects you will need to add babel with the
 * 'babel-plugin-transform-decorators-legacy' plugin
 */

// simulate loading from a different BZ (for Global vs Local), but still functioanlly the same
const Beelzebub = require('../../');
const {defaultTask, help} = require('../../').decorators;

class MyTasks extends Beelzebub.Tasks {
  constructor(config){
    super(config);

    this.$setDefault('task1');

    this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks - Task 1');
    this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks - Task 2');
  }

  task1 () {
    this.logger.log('MyTasks task1');
  }

  task2 () {
    this.logger.log('MyTasks task2');
  }
}

class MyTasks2 extends Beelzebub.Tasks {
  constructor(config){
    super(config);

    this.$setDefault('task1');

    this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks2 - Task 1');
    this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks2 - Task 2');
  }

  task1 () {
    this.logger.log('MyTasks2 task1');
  }

  task2 () {
    this.logger.log('MyTasks2 task2');
  }
}

module.exports = [MyTasks, MyTasks2];
