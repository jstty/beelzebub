'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var yargs = require('yargs');
var when = require('when');
var ejs = require('ejs');
var inquirer = require('inquirer');

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
        describe: 'Print task help',
        boolean: true,
        group: 'Beelzebub Options:'
      }).option('import', {
        alias: 'f',
        boolean: false,
        describe: 'Import package.json scripts',
        group: 'Beelzebub Options:'
      }).showHelpOnFail()
      // .argv
      .parse(argsObj.rootOptions);

      var cli = yargs;
      var showHelp = cli.argv.help;
      var loadFile = file || cli.argv.file;
      var importScripts = cli.argv.import;

      // if import script, run import then exit
      if (importScripts) {
        this._importScripts(currentDir).then(function () {
          process.exit();
        }).catch(function () {
          process.exit();
        });
        return;
      }

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
  }, {
    key: '_importScripts',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(currentDir) {
        var replace = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var packageFile, outputBzFile, packageJson, scripts, templateFile, templateDate, data, result, writeFile, overwrite;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                // read package.json from currentDir
                // console.log(currentDir);
                packageFile = currentDir + '/package.json';
                outputBzFile = currentDir + '/beelzebub.js';
                packageJson = util.readJsonFile(packageFile);
                // console.log(packageJson);

                if (!_.has(packageJson, 'scripts')) {
                  _context.next = 23;
                  break;
                }

                scripts = packageJson.scripts;

                // TODO: convert script names to valid functions
                // TODO: escape cmd strings
                // TODO: test run path is correct
                // TODO: add run function to bz task class

                _context.prev = 5;
                templateFile = path.resolve(__dirname, '../template/import-base.ejs');
                templateDate = fs.readFileSync(templateFile, "utf8");
                data = {
                  className: this._capitalize(packageJson.name) + 'Scripts',
                  scripts: scripts
                };
                result = ejs.render(templateDate, data);
                // console.log(result);

                writeFile = true;

                if (!fs.existsSync(outputBzFile)) {
                  _context.next = 17;
                  break;
                }

                writeFile = false;

                _context.next = 15;
                return this._prompt({
                  message: 'beelzebebub file already exists, overwrite?'
                });

              case 15:
                overwrite = _context.sent;

                if (overwrite.prompt) {
                  writeFile = true;
                }

              case 17:

                if (writeFile) {
                  // write bz file to dir
                  fs.writeFileSync(outputBzFile, result, "utf8");
                  console.log('Created file:', path.relative(currentDir, outputBzFile));
                }
                _context.next = 23;
                break;

              case 20:
                _context.prev = 20;
                _context.t0 = _context['catch'](5);

                console.log('Render Error:', _context.t0);

              case 23:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[5, 20]]);
      }));

      function _importScripts(_x3) {
        return _ref.apply(this, arguments);
      }

      return _importScripts;
    }()
  }, {
    key: '_prompt',
    value: function _prompt(property) {
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
  }, {
    key: '_capitalize',
    value: function _capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  }]);
  return BzCLI;
}();

module.exports = BzCLI;