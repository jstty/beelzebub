'use strict';

const path  = require('path');
const _     = require('lodash');
const cli   = require('yargs');
const manifest = require('../package.json');

const when = require('when'); // TODO: replace ???

const Beelzebub   = require('./beelzebub.js');
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
 * CLI function
 * @param config [object (optional)]
 * @param args [object (optional)]
 * @returns promise
 */
BeelzebubMod.cli = function (config, args) {
  let allTasks = [];
  let promise = when.resolve();
  const currentDir = process.cwd();
  const bz = new Beelzebub(config || { verbose: true });

  if (!args) {
    // remove the first two array items
    args = process.argv.slice(2);
  }

  cli.version(() => { return manifest.version; })
    .usage('Usage: bz -f [file] ')
    .alias('version', 'V')
    .option('file', {
      alias:    'f',
      describe: 'Load a file'
    })
    .option('verbose', {
      alias:    'v',
      describe: 'Enable verbose logging',
      boolean:  true
    })
    .option('help', {
      alias:    'h',
      describe: 'print task help',
      boolean:  true
    })
    .showHelpOnFail()
    .parse(args);

  // set tasks to run
  const runTasks  = cli.argv._;

  if (cli.argv.help) {
    cli.showHelp();
  }

  function loadFile (tasks, file, displayError) {
    try {
      // remove all extra whitespace at start and end of files
      file = _.trim(file);

      // need to join the current dir,
      // because require is relative to THIS file not the running process
      if (!path.isAbsolute(file)) {
        file = path.join(currentDir, file);
      }

      let fTasks = require(file);
      if (fTasks) {
        // normalize fTasks to an array
        if (!_.isArray(fTasks)) {
          fTasks = [fTasks];
        }

        tasks = tasks.concat(fTasks);
        // tasks = _.merge(tasks, fTasks);
      } else {
        console.warn(`"${file}" needs to export a module`);
      }
    }
    catch (err) {
      // show non load errors
      if (err.code !== 'MODULE_NOT_FOUND') {
        console.error(err);
      }
      else if (displayError) {
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
  allTasks.map((task) => {
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
      promise = bz.run(...runTasks);
    }
  }

  // wait until run complete
  return promise.then(() => { return bz; });
};
// ---------------------------------------------------------------

// add Tasks Class to export module
BeelzebubMod.Tasks = BzTasks;

// add task class decorators to export module
BeelzebubMod.decorators = decorators;
BeelzebubMod.TmplStrFunc = tmplStrFunc;

module.exports = BeelzebubMod;
