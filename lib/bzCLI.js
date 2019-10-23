'use strict';

const path   = require('path');
const fs     = require('fs');
const _      = require('lodash');
const yargs  = require('yargs');
const when   = require('when');
const ejs    = require('ejs');
const inquirer = require('inquirer');

const manifest  = require('../package.json');
const Beelzebub = require('./beelzebub.js');
const util      = require('./util.js');

class BzCLI {
  run (options = {}) {
    let {file, cwd, config, args} = options;
    let allTasks = [];
    let runTasks = [];
    let promise = when.resolve();
    const currentDir = cwd || process.cwd();
    const bz = new Beelzebub(config || { verbose: true });
    // need to add this instance to util singleton to it's found when creating tasks
    util.setInstance(bz);

    if (!args) {
      // remove the first two array items
      args = process.argv.slice(2);
    }

    // break apart args array, spliting by tasks (doesn't start with '-')
    let argsObj = this._breakApartTasksVarsInArgs(args);

    yargs
      .version(() => { return manifest.version; })
      .usage('bz [--file <filename> | default: beelzebub.js] [--verbose] [--help] <taskToRun [vars]>...')
      .alias('version', 'V')
      .group('version', 'Beelzebub Options:')
      .option('file', {
        alias:    'f',
        describe: 'Load a file',
        group:    'Beelzebub Options:'
      })
      .option('verbose', {
        alias:    'v',
        describe: 'Enable verbose logging',
        boolean:  true,
        group:    'Beelzebub Options:'
      })
      .option('help', {
        alias:    'h',
        describe: 'Print task help',
        boolean:  true,
        group:    'Beelzebub Options:'
      })
      .option('import',  {
        alias:    'f',
        boolean:  false,
        describe: 'Import package.json scripts',
        group:    'Beelzebub Options:'
      })
      .showHelpOnFail()
      // .argv
      .parse(argsObj.rootOptions);

    let cli = yargs;
    let showHelp = cli.argv.help;
    let loadFile = file || cli.argv.file;
    let importScripts = cli.argv.import;

    // if import script, run import then exit
    if(importScripts) {
      this._importScripts(currentDir)
      .then(() => {
        process.exit();
      })
      .catch(() => {
        process.exit();
      });
      return;
    }

    // if file sepecified then don't try to loading default files
    if (loadFile) {
      allTasks = this._loadFile(currentDir, allTasks, loadFile, true);
    }
    else if (_.isArray(argsObj.files) && argsObj.files.length > 0) {
      _.forEach(argsObj.files, (file) => {
        allTasks = this._loadFile(currentDir, allTasks, file);
      });
    }
    else {
      // check if beelzebub.js/json file
      // TODO: only load the first one that exists, don't load all
      allTasks = this._loadFile(currentDir, allTasks, './beelzebub.js');
      allTasks = this._loadFile(currentDir, allTasks, './bz.js');
    }

    // check if there are any tasks at all
    if (allTasks && _.isArray(allTasks) && allTasks.length) {
      // add tasks to bz
      allTasks.map((task) => {
        bz.add(task);
      });

      promise = bz.getInitPromise().then(() => {
        // if help then print task help
        if (showHelp) {
          // adds CLI options based on varDefs
          this._addTaskOptionsToCLI(bz, cli, argsObj.taskOptions);

          cli.showHelp();
          bz.printHelp();
        } else {
          let rootVars = this._convertRootCLIArgs(argsObj.rootOptions);
          bz.setGlobalVars(rootVars);

          runTasks = this._convertCLIArgsToTasks(argsObj.taskOptions);

          // run tasks
          return bz.run(...runTasks);
        }
      }).catch((e) => {
        console.error(e);
      });
    }
    else {
      // only if no help flag
      if (!showHelp) {
        console.error('No Tasks Loaded');
        process.exit();
        return;
      }
      else {
        cli.showHelp();
        process.exit();
        return;
      }
    }

    // wait until run complete
    return promise.then(() => {
      return bz;
    });
  }

  _addTaskOptionsToCLI (bz, cli, taskOptions) {
    _.forEach(taskOptions, (task, taskName) => {
      // find taskDef from name
      let varDefs = bz.getVarDefsForTaskName(taskName);
      this._addTaskVarDefsToCLI(cli, taskName, varDefs);
    });
  }

  _addTaskVarDefsToCLI (cli, taskName, varDefs, parentKey = '') {
    _.forEach(varDefs, (varDef, key) => {
      let optionDef = _.cloneDeep(varDef);

      optionDef.type = optionDef.type.toLowerCase();
      optionDef.group = taskName + ' Options:';

      if (optionDef.type === 'object') {
        this._addTaskVarDefsToCLI(cli, taskName, optionDef.properties, key + '.');
      }
      else {
        cli.option(parentKey + key, optionDef);
      }
    });
  }

  _breakApartTasksVarsInArgs (args) {
    let argsObj = {
      files:       [],
      rootOptions: [],
      taskOptions: {}
    };
    let lastOptions = argsObj.rootOptions;

    _.forEach(args, (arg, key) => {
      // if start with './' then file to load
      if (arg.indexOf('./') === 0) {
        argsObj.files.push(arg);
      }
      // if start with '-' then arg
      else if (arg.indexOf('-') === 0) {
        lastOptions.push(arg);
      }
      // else task
      else {
        let task = arg;
        argsObj.taskOptions[task] = [];
        lastOptions = argsObj.taskOptions[task];
      }
    });

    return argsObj;
  }

  _convertRootCLIArgs (rootOptions) {
    let cli = yargs(rootOptions);
    return _.cloneDeep(cli.argv);
  }

  _convertCLIArgsToTasks (taskOptions) {
    let tasks = [];

    _.forEach(taskOptions, (taskOption, taskName) => {
      let task = {
        task: taskName,
        vars: {}
      };

      if (taskOption.length) {
        let cli = yargs(taskOption);

        task.vars = _.cloneDeep(cli.argv);
        delete task.vars['_'];
        delete task.vars['$0'];
      }

      tasks.push(task);
    });

    return tasks;
  }

  _loadFile (currentDir, tasks, file, displayError) {
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

  async _importScripts(currentDir, replace = false) {
    // read package.json from currentDir
    // console.log(currentDir);
    const packageFile = `${currentDir}/package.json`;
    const outputBzFile = `${currentDir}/beelzebub.js`;
    let packageJson = util.readJsonFile(packageFile);
    // console.log(packageJson);

    if(_.has(packageJson, 'scripts')) {
      let scripts = packageJson.scripts;

      // TODO: convert script names to valid functions
      // TODO: escape cmd strings
      // TODO: test run path is correct
      // TODO: add run function to bz task class

      try {
        let templateFile = path.resolve(__dirname, '../template/import-base.ejs');
        let templateDate = fs.readFileSync(templateFile, "utf8");
        let data = {
          className: `${this._capitalize(packageJson.name)}Scripts`,
          scripts: scripts 
        }
        let result = ejs.render(templateDate, data);
        // console.log(result);

        let writeFile = true;
        if (fs.existsSync(outputBzFile)) {
          writeFile = false;

          let overwrite = await this._prompt({
            message: 'beelzebebub file already exists, overwrite?'
          });
          if(overwrite.prompt) {
            writeFile = true;
          }
        }

        if(writeFile) {
          // write bz file to dir
          fs.writeFileSync(outputBzFile, result, "utf8");
          console.log('Created file:', path.relative(currentDir, outputBzFile));
        }
      }
      catch(err) {
        console.log('Render Error:', err);
      }
    }
  }

  _prompt(property) {
    return inquirer.prompt({
      type: 'confirm',
      name: 'prompt',
      message: property.message,
      default: false
    });
    
    // return new Promise((resolve, reject) => {
    //   try {
        
        // let readline = require('readline');
        // let rl = readline.createInterface(process.stdin, process.stdout);
        // rl.question(property.message, function(result) {
        //   console.log('prompt result:', result);
        //   resolve(result);
        // });

        // prompt.start();
        // prompt.get(property, (err, result) => {
        //   if(err) {
        //     console.error('prompt error:', err);
        //     reject(err);
        //     return;
        //   }
        //   console.log('prompt result:', result);
        //   resolve(result);
        // });
    //   }
    //   catch(err) {
    //     console.error('Prompt Error:', err);
    //   }
    // });
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = BzCLI;
