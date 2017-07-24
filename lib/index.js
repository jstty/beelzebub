'use strict';

const Beelzebub   = require('./beelzebub.js');
const BzCLI       = require('./bzCLI.js');
const Tasks       = require('./bzTasksClass.js');
const InterfaceTasks = require('./bzInterfaceClass.js');
const decorators  = require('./decorators.js');
const tmplStrFunc = require('./tmplStrFunc.js');
const util        = require('./util.js');

/**
 * ========================================================
 * Module for export
 * ========================================================
 */
let BeelzebubMod = function (config) {
  if (!util.beelzebubInst) {
    util.setInstance(new Beelzebub(config));
  }
  return util.getInstance();
};

BeelzebubMod.delete = function () {
  util.setInstance(null);
};
BeelzebubMod.create = function (config) {
  return new Beelzebub(config);
};

function addToMod (funcName) {
  BeelzebubMod[funcName] = function (...args) {
    if (!util.getInstance()) {
      util.setInstance(new Beelzebub());
    }

    return util.getInstance()[funcName](...args);
  };
}

addToMod('init');
addToMod('add');
addToMod('sequence');
addToMod('parallel');
addToMod('run');
addToMod('printHelp');

/**
 * CLI Class
 *
 * @class
 */
BeelzebubMod.CLI = BzCLI;

// add Tasks Class to export module
BeelzebubMod.Tasks = Tasks;
BeelzebubMod.InterfaceTasks = InterfaceTasks;

// add task class decorators to export module
BeelzebubMod.decorators = decorators;
BeelzebubMod.TmplStrFunc = tmplStrFunc;

module.exports = BeelzebubMod;
