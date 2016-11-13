'use strict';

const Beelzebub   = require('./beelzebub.js');
const BzCLI       = require('./bzCLI.js');
const BzTasks     = require('./bzTasks.js');
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
    util.beelzebubInst = new Beelzebub(config);
  }
  return util.beelzebubInst;
};

// TODO: find a better way to create these functions
BeelzebubMod.delete = function () {
  util.beelzebubInst = null;
};
BeelzebubMod.create = function (config) {
  return new Beelzebub(config);
};
BeelzebubMod.init = function (config) {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }
  return util.beelzebubInst.init(config);
};
BeelzebubMod.add = function (task, config) {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }
  return util.beelzebubInst.add(task, config);
};
BeelzebubMod.sequence = function (...args) {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }
  return util.beelzebubInst.sequence.apply(util.beelzebubInst, args);
};
BeelzebubMod.parallel = function (...args) {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }
  return util.beelzebubInst.parallel.apply(util.beelzebubInst, args);
};
BeelzebubMod.run = function (...args) {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }
  return util.beelzebubInst.run.apply(util.beelzebubInst, args);
};
BeelzebubMod.printHelp = function (...args) {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }
  return util.beelzebubInst.printHelp.apply(util.beelzebubInst, args);
};

/**
 * CLI Class
 * @returns promise
 */
BeelzebubMod.CLI = BzCLI;

/**
 * CLI function
 * @depricated
 * @param config [object (optional)]
 * @param args [object (optional)]
 * @returns promise
 */
BeelzebubMod.cli = function (config, args) {
  var cli = new BzCLI();
  return cli.run(config, args);
};
// ---------------------------------------------------------------

// add Tasks Class to export module
BeelzebubMod.Tasks = BzTasks;

// add task class decorators to export module
BeelzebubMod.decorators = decorators;
BeelzebubMod.TmplStrFunc = tmplStrFunc;

module.exports = BeelzebubMod;
