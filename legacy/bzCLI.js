'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var path = require('path');
var _ = require('lodash');
var yargs = require('yargs');
var when = require('when');

var manifest = require('../package.json');
var Beelzebub = require('./beelzebub.js');
var util = require('./util.js');

var BzCLI = function () {
  function BzCLI() {
    (0, _classCallCheck3.default)(this, BzCLI);
  }

  (0, _createClass3.default)(BzCLI, [{
    key: 'run',
    value: function run() {
      var _this = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var file = options.file,
          cwd = options.cwd,
          config = options.config,
          args = options.args;

      var allTasks = [];
      var runTasks = [];
      var promise = when.resolve();
      var currentDir = cwd || process.cwd();
      var bz = new Beelzebub(config || { verbose: true });
      // need to add this instance to util singleton to it's found when creating tasks
      util.setInstance(bz);

      if (!args) {
        // remove the first two array items
        args = process.argv.slice(2);
      }

      // break apart args array, spliting by tasks (doesn't start with '-')
      var argsObj = this._breakApartTasksVarsInArgs(args);

      console.log('manifest.version:', manifest.version);

      yargs.version(manifest.version).usage('bz [--file <filename> | default: beelzebub.js] [--verbose] [--help] <taskToRun [vars]>...').alias('version', 'V').group('version', 'Beelzebub Options:').option('file', {
        alias: 'f',
        describe: 'Load a file',
        group: 'Beelzebub Options:'
      }).option('verbose', {
        alias: 'v',
        describe: 'Enable verbose logging',
        boolean: true,
        group: 'Beelzebub Options:'
      }).option('help', {
        alias: 'h',
        describe: 'print task help',
        boolean: true,
        group: 'Beelzebub Options:'
      }).showHelpOnFail()
      // .argv
      .parse(argsObj.rootOptions);

      var cli = yargs;
      var showHelp = cli.argv.help;
      var loadFile = file || cli.argv.file;

      // if file sepecified then don't try to loading default files
      if (loadFile) {
        allTasks = this._loadFile(currentDir, allTasks, loadFile, true);
      } else if (_.isArray(argsObj.files) && argsObj.files.length > 0) {
        _.forEach(argsObj.files, function (file) {
          allTasks = _this._loadFile(currentDir, allTasks, file);
        });
      } else {
        // check if beelzebub.js/json file
        // TODO: only load the first one that exists, don't load all
        allTasks = this._loadFile(currentDir, allTasks, './beelzebub.js');
        allTasks = this._loadFile(currentDir, allTasks, './bz.js');
      }

      // check if there are any tasks at all
      if (allTasks && _.isArray(allTasks) && allTasks.length) {
        // add tasks to bz
        allTasks.map(function (task) {
          bz.add(task);
        });

        promise = bz.getInitPromise().then(function () {
          // if help then print task help
          if (showHelp) {
            // adds CLI options based on varDefs
            _this._addTaskOptionsToCLI(bz, cli, argsObj.taskOptions);

            cli.showHelp();
            bz.printHelp();
          } else {
            var rootVars = _this._convertRootCLIArgs(argsObj.rootOptions);
            bz.setGlobalVars(rootVars);

            runTasks = _this._convertCLIArgsToTasks(argsObj.taskOptions);

            // run tasks
            return bz.run.apply(bz, (0, _toConsumableArray3.default)(runTasks));
          }
        }).catch(function (e) {
          console.error(e);
        });
      } else {
        // only if no help flag
        if (!showHelp) {
          console.error('No Tasks Loaded');
          process.exit();
          return;
        } else {
          cli.showHelp();
          process.exit();
          return;
        }
      }

      // wait until run complete
      return promise.then(function () {
        return bz;
      });
    }
  }, {
    key: '_addTaskOptionsToCLI',
    value: function _addTaskOptionsToCLI(bz, cli, taskOptions) {
      var _this2 = this;

      _.forEach(taskOptions, function (task, taskName) {
        // find taskDef from name
        var varDefs = bz.getVarDefsForTaskName(taskName);
        _this2._addTaskVarDefsToCLI(cli, taskName, varDefs);
      });
    }
  }, {
    key: '_addTaskVarDefsToCLI',
    value: function _addTaskVarDefsToCLI(cli, taskName, varDefs) {
      var _this3 = this;

      var parentKey = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '';

      _.forEach(varDefs, function (varDef, key) {
        var optionDef = _.cloneDeep(varDef);

        optionDef.type = optionDef.type.toLowerCase();
        optionDef.group = taskName + ' Options:';

        if (optionDef.type === 'object') {
          _this3._addTaskVarDefsToCLI(cli, taskName, optionDef.properties, key + '.');
        } else {
          cli.option(parentKey + key, optionDef);
        }
      });
    }
  }, {
    key: '_breakApartTasksVarsInArgs',
    value: function _breakApartTasksVarsInArgs(args) {
      var argsObj = {
        files: [],
        rootOptions: [],
        taskOptions: {}
      };
      var lastOptions = argsObj.rootOptions;

      _.forEach(args, function (arg, key) {
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
              var task = arg;
              argsObj.taskOptions[task] = [];
              lastOptions = argsObj.taskOptions[task];
            }
      });

      return argsObj;
    }
  }, {
    key: '_convertRootCLIArgs',
    value: function _convertRootCLIArgs(rootOptions) {
      var cli = yargs(rootOptions);
      return _.cloneDeep(cli.argv);
    }
  }, {
    key: '_convertCLIArgsToTasks',
    value: function _convertCLIArgsToTasks(taskOptions) {
      var tasks = [];

      _.forEach(taskOptions, function (taskOption, taskName) {
        var task = {
          task: taskName,
          vars: {}
        };

        if (taskOption.length) {
          var cli = yargs(taskOption);

          task.vars = _.cloneDeep(cli.argv);
          delete task.vars['_'];
          delete task.vars['$0'];
        }

        tasks.push(task);
      });

      return tasks;
    }
  }, {
    key: '_loadFile',
    value: function _loadFile(currentDir, tasks, file, displayError) {
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
  }]);
  return BzCLI;
}();

module.exports = BzCLI;