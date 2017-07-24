'use strict';

var Beelzebub = require('./beelzebub.js');
var BzCLI = require('./bzCLI.js');
var Tasks = require('./bzTasksClass.js');
var InterfaceTasks = require('./bzInterfaceClass.js');
var decorators = require('./decorators.js');
var tmplStrFunc = require('./tmplStrFunc.js');
var util = require('./util.js');

/**
 * ========================================================
 * Module for export
 * ========================================================
 */
var BeelzebubMod = function BeelzebubMod(config) {
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

function addToMod(funcName) {
  BeelzebubMod[funcName] = function () {
    var _util$getInstance;

    if (!util.getInstance()) {
      util.setInstance(new Beelzebub());
    }

    return (_util$getInstance = util.getInstance())[funcName].apply(_util$getInstance, arguments);
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