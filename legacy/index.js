'use strict';

var Beelzebub = require('./beelzebub.js');
var BzCLI = require('./bzCLI.js');
var BzTasks = require('./bzTasks.js');
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
BeelzebubMod.sequence = function () {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }

  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return util.beelzebubInst.sequence.apply(util.beelzebubInst, args);
};
BeelzebubMod.parallel = function () {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }

  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  return util.beelzebubInst.parallel.apply(util.beelzebubInst, args);
};
BeelzebubMod.run = function () {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }

  for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
    args[_key3] = arguments[_key3];
  }

  return util.beelzebubInst.run.apply(util.beelzebubInst, args);
};
BeelzebubMod.printHelp = function () {
  if (!util.beelzebubInst) {
    util.beelzebubInst = new Beelzebub();
  }

  for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
    args[_key4] = arguments[_key4];
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