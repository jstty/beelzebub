'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var path = require('path');
var _ = require('lodash');
var cli = require('yargs');
var manifest = require('../package.json');

var when = require('when'); // TODO: replace ???

var Beelzebub = require('./beelzebub.js');
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
 * CLI function
 * @param config [object (optional)]
 * @param args [object (optional)]
 * @returns promise
 */
BeelzebubMod.cli = function (config, args) {
  var allTasks = [];
  var promise = when.resolve();
  var currentDir = process.cwd();
  var bz = new Beelzebub(config || { verbose: true });

  if (!args) {
    // remove the first two array items
    args = process.argv.slice(2);
  }

  cli.version(function () {
    return manifest.version;
  }).usage('Usage: bz -f [file] ').alias('version', 'V').option('file', {
    alias: 'f',
    describe: 'Load a file'
  }).option('verbose', {
    alias: 'v',
    describe: 'Enable verbose logging',
    boolean: true
  }).option('help', {
    alias: 'h',
    describe: 'print task help',
    boolean: true
  }).showHelpOnFail().parse(args);

  // set tasks to run
  var runTasks = cli.argv._;

  if (cli.argv.help) {
    cli.showHelp();
  }

  function loadFile(tasks, file, displayError) {
    try {
      // remove all extra whitespace at start and end of files
      file = _.trim(file);

      // need to join the current dir,
      // because require is relative to THIS file not the running process
      if (!path.isAbsolute(file)) {
        file = path.join(currentDir, file);
      }

      var fTasks = require(file);
      if (fTasks) {
        // normalize fTasks to an array
        if (!_.isArray(fTasks)) {
          fTasks = [fTasks];
        }

        tasks = tasks.concat(fTasks);
        // tasks = _.merge(tasks, fTasks);
      } else {
        console.warn('"' + file + '" needs to export a module');
      }
    } catch (err) {
      // show non load errors
      if (err.code !== 'MODULE_NOT_FOUND') {
        console.error(err);
      } else if (displayError) {
        console.error('File (' + file + ') Load Error:', err);
      }
    }

    return tasks;
  }

  // if file sepecified then don't try to loading default files
  if (cli.argv.file) {
    allTasks = loadFile(allTasks, cli.argv.file, true);
  } else {
    // check if beelzebub.js/json file
    // TODO: only load the first one that exists, don't load all
    allTasks = loadFile(allTasks, './beelzebub.js');
    allTasks = loadFile(allTasks, './beelzebub.json');
    allTasks = loadFile(allTasks, './bz.js');
    allTasks = loadFile(allTasks, './bz.json');
  }

  // only if no help flag
  if (!cli.argv.help) {
    // check if there are any tasks at all
    if (!allTasks || !_.isArray(allTasks) || !allTasks.length) {
      console.error('No Tasks Loaded');
      process.exit();
      return;
    }
  }

  // add tasks to bz
  allTasks.map(function (task) {
    bz.add(task);
  });

  // if help then print task help
  if (cli.argv.help) {
    bz.printHelp();
  }

  // only if no help flag
  if (!cli.argv.help) {
    // checked if there are tasks to run
    if (!runTasks || !_.isArray(runTasks) || !runTasks.length) {
      console.error('No Tasks to Run');
    } else {
      // run tasks
      promise = bz.run.apply(bz, (0, _toConsumableArray3.default)(runTasks));
    }
  }

  // wait until run complete
  return promise.then(function () {
    return bz;
  });
};
// ---------------------------------------------------------------

// add Tasks Class to export module
BeelzebubMod.Tasks = BzTasks;

// add task class decorators to export module
BeelzebubMod.decorators = decorators;
BeelzebubMod.TmplStrFunc = tmplStrFunc;

module.exports = BeelzebubMod;