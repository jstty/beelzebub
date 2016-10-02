'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _getOwnPropertyNames = require('babel-runtime/core-js/object/get-own-property-names');

var _getOwnPropertyNames2 = _interopRequireDefault(_getOwnPropertyNames);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var path = require('path');
var _ = require('lodash');
var co = require('co');
var cli = require('yargs');
var chalk = require('chalk');
var streamToPromise = require('stream-to-promise');

var manifest = require('../package.json');

// TODO: replace ???
var when = require('when');
var whenSequence = require('when/sequence');

// internal singleton instance of the class, only created when needed
var beelzebubInst = null;

var DefaultConfig = {
  verbose: false,
  silent: false,
  logger: console
};

var nullLogger = {
  log: function log() {},
  warn: function warn() {},
  info: function info() {},
  error: function error() {},
  trace: function trace() {},

  clear: function clear() {},
  count: function count() {},
  debug: function debug() {},
  dir: function dir() {},
  dirxml: function dirxml() {},
  group: function group() {},
  groupCollapsed: function groupCollapsed() {},
  groupEnd: function groupEnd() {},
  profile: function profile() {},
  profileEnd: function profileEnd() {},
  time: function time() {},
  timeEnd: function timeEnd() {},
  timeStamp: function timeStamp() {}
};

/**
 * ========================================================
 * Util Functions
 * ========================================================
 */
/**
 * check if function is generator
 * @param function
 * @returns {boolean}
 */
function isGenerator(func) {
  return func && func.constructor && func.constructor.name === 'GeneratorFunction';
}

/**
 * check if function is promise
 * @param Promise
 * @returns {boolean}
 */
function isPromise(p) {
  return p && _.isObject(p) && _.isFunction(p.then);
}

/**
 * check if function is stream
 * @param stream
 * @returns {boolean}
 */
function isStream(s) {
  return s && _.isObject(s) && _.isFunction(s.pipe);
}

// can't use instanceof as the source might be a different modules but exactly the same
function isBaseTask(a) {
  var checkList = ['$sequence', '$parallel', '$run', '$setDefault', '$isRoot', '$useAsRoot', '$setName', '$getName', '$getTask', '$setSubTask', '$getSubTask'];
  return _.reduce(checkList, function (result, key) {
    if (!result) return result;
    if (!a[key] || !_.isFunction(a[key])) {
      result = false;
    }
    return result;
  });
  // return b.prototype.isPrototypeOf(a);
  // return a instanceof b;
}

function processConfig(config, parentConfig, contex) {
  if (config.logger) {
    contex.logger = config.logger;
  } else {
    contex.logger = parentConfig.logger || DefaultConfig.logger;
  }

  // this._config = _.merge(DefaultConfig, config || {});
  contex._config = _.merge(_.cloneDeep(DefaultConfig), _.cloneDeep(parentConfig), config || {});

  if (contex._config.silent) {
    contex.logger = nullLogger;
  }
  contex._config.logger = contex.logger;

  contex.vLogger = {
    log: function log() {},
    info: function info() {}
  };
  if (contex._config.verbose) {
    contex.vLogger = {
      log: function log() {
        var _contex$logger;

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        args.unshift('[' + contex.name + '] -');(_contex$logger = contex.logger).log.apply(_contex$logger, args);
      },
      info: function info() {
        var _contex$logger2;

        for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        args.unshift('[' + contex.name + '] -');(_contex$logger2 = contex.logger).info.apply(_contex$logger2, args);
      }
    };
  }
}

/**
 * ========================================================
 * Decorators
 * ========================================================
 */

var Decorators = function () {
  function Decorators() {
    (0, _classCallCheck3.default)(this, Decorators);
  }

  (0, _createClass3.default)(Decorators, null, [{
    key: 'defaultTask',
    value: function defaultTask(target, prop, descriptor) {
      if (!target || !prop || !descriptor) {
        console.error('default function is a decorator it should not be called directly');
      }

      target.$defaultTask = prop;
    }
  }, {
    key: 'help',
    value: function help(desc) {
      return function (target, prop, descriptor) {
        if (!target || !prop || !descriptor) {
          console.error('default function is a decorator it should not be called directly');
        }

        if (!_.isObject(target.$helpDocs)) {
          target.$helpDocs = {};
        }
        target.$helpDocs[prop] = desc;
      };
    }
  }]);
  return Decorators;
}();

/**
 * ========================================================
 * Beelzebub Class
 * ========================================================
 */


var Beelzebub = function () {
  function Beelzebub(config) {
    (0, _classCallCheck3.default)(this, Beelzebub);

    this.version = manifest.version;
    this.reset();
    this.init(config);

    // add Tasks to Beelzebub
    this.Tasks = BzTasks;
  }

  (0, _createClass3.default)(Beelzebub, [{
    key: 'init',
    value: function init() {
      var config = arguments.length <= 0 || arguments[0] === undefined ? DefaultConfig : arguments[0];

      processConfig(config, DefaultConfig, this);

      this._config.beelzebub = this; // don't like this, but needed for BzTasks
      this._rootTasks = new BzTasks(this._config);
      this._rootTasks.$useAsRoot();
    }
  }, {
    key: 'reset',
    value: function reset() {
      // logger util
      // TODO: move this to util
      this.logger = console;
      // verbose logger
      // TODO: move over to stumpy
      this.vLogger = {
        log: function log() {},
        info: function info() {}
      };

      this._config = _.cloneDeep(DefaultConfig);
      this._rootTasks = null;

      this._initFunctionList = [];
      this._initDone = false;
    }
  }, {
    key: 'getConfig',
    value: function getConfig() {
      return this._config;
    }
  }, {
    key: 'isLoading',
    value: function isLoading() {
      return !this._initDone;
    }
  }, {
    key: 'addInitFunction',
    value: function addInitFunction(func) {
      this._initFunctionList.push(func);
    }
  }, {
    key: 'getInitPromise',
    value: function getInitPromise() {
      var func = co.wrap(_regenerator2.default.mark(function _callee() {
        var results, i, result;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                results = [];
                i = 0;

              case 2:
                if (!(i < this._initFunctionList.length)) {
                  _context.next = 10;
                  break;
                }

                _context.next = 5;
                return this._initFunctionList[i]();

              case 5:
                result = _context.sent;

                results.push(result);

              case 7:
                i++;
                _context.next = 2;
                break;

              case 10:

                // this.vLogger.log('runTask initFunctionList done results:', results);
                this._initDone = true;

                return _context.abrupt('return', results);

              case 12:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }).bind(this));

      return func();
    }
  }, {
    key: 'getRunning',
    value: function getRunning() {
      return this._rootTasks.$getRunning();
    }
  }, {
    key: 'add',
    value: function add(Tasks, config) {
      var tasks = null;

      if (_.isString(Tasks)) {
        try {
          // TODO: yanpm install this?
          Tasks = require(Tasks);
        } catch (err) {
          this.logger.error('Add Task Error:', err);
          return;
        }
      }

      if (_.isFunction(Tasks) && _.isObject(Tasks)) {
        config = _.merge(this._config, config || {});
        config.beelzebub = this;

        tasks = new Tasks(config || this._config);

        if (!isBaseTask(tasks)) {
          this.logger.error('Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BzTasks" -', tasks);
          return;
        }
      } else if (_.isObject(Tasks) && isBaseTask(Tasks)) {
        tasks = Tasks;
      } else {
        this.logger.error('Add Task Error: Unknown Task type -', tasks);
        return;
      }

      if (tasks.$isRoot()) {
        // transfer all the current subTasks from old _rootTasks to current

        tasks.$setSubTask(this._rootTasks.$getSubTask());
        this._rootTasks = tasks;

        return tasks.$register().then(function (results) {
          // this.vLogger.log('task register done:', results);
        });
      } else {
        // this.vLogger.log('rootTask addSubTasks');
        this._rootTasks.$addSubTasks(tasks, config);
      }

      // this.vLogger.log( 'all tasks:', _.keys(this._rootTasks) );
    }

    /**
     * Runs task(s) - multi args run in sequence, arrays are run in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: 'run',
    value: function run(parent) {
      for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }

      args.unshift(parent);
      // use internal function, because $run bounces back to root level
      return this._rootTasks._run.apply(this._rootTasks, args);
    }
  }, {
    key: 'sequence',
    value: function sequence(parent) {
      for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        args[_key4 - 1] = arguments[_key4];
      }

      args.unshift(parent);
      // use internal function, because $sequence bounces back to root level
      return this._rootTasks._sequence.apply(this._rootTasks, args);
    }
  }, {
    key: 'parallel',
    value: function parallel(parent) {
      for (var _len5 = arguments.length, args = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
        args[_key5 - 1] = arguments[_key5];
      }

      args.unshift(parent);
      // use internal function, because $parallel bounces back to root level
      return this._rootTasks._parallel.apply(this._rootTasks, args);
    }
  }, {
    key: 'printHelp',
    value: function printHelp() {
      this.drawBox('Help Docs', 80);
      this._rootTasks.$printHelp();
    }
  }, {
    key: 'drawBox',
    value: function drawBox(title) {
      var width = arguments.length <= 1 || arguments[1] === undefined ? 60 : arguments[1];

      var sides = {
        'top': '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        'bottom': '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        'left': '│',
        'left-mid': '├',
        'mid': '─',
        'mid-mid': '┼',
        'right': '│',
        'right-mid': '┤',
        'middle': '│'
      };

      var spaceLen = width - title.length - 5;
      this.logger.log(sides['top-left'] + sides['top'].repeat(width - 2) + sides['top-right']);
      this.logger.log(sides['left'], title, ' '.repeat(spaceLen), sides['right']);
      this.logger.log(sides['bottom-left'] + sides['bottom'].repeat(width - 2) + sides['bottom-right']);
    }
  }]);
  return Beelzebub;
}();

/**
 * ========================================================
 * Beelzebub Task Class, should be extended
 * ========================================================
 */


var BzTasks = function () {
  function BzTasks(config) {
    (0, _classCallCheck3.default)(this, BzTasks);

    this.beelzebub = config.beelzebub || beelzebubInst;

    processConfig(config, this.beelzebub.getConfig(), this);

    this.name = config.name || this.constructor.name || 'BzTasks';
    this.version = manifest.version;
    this.namePath = this._buildNamePath(config);
    // this.vLogger.log('constructor namePath:', this.namePath, ', name:', this.name);

    // TODO: use config function/util to process this

    this._rootLevel = false;
    this._defaultTaskFuncName = this.$defaultTask || null;
    this._tasks = {};
    this._subTasks = {};

    this._running = null;

    // TODO: add cli options/commands
  }

  (0, _createClass3.default)(BzTasks, [{
    key: '_buildNamePath',
    value: function _buildNamePath(config) {
      var namePath = this.name;
      if (config.parentPath) {
        namePath = config.parentPath + '.' + config.name;
      }
      return namePath;
    }
  }, {
    key: '$printHelp',
    value: function $printHelp() {
      var _this = this;

      _.forEach(this.$getSubTask(), function (task) {
        task.$printHelp();
      });

      if (this.$helpDocs) {
        this.beelzebub.drawBox(this.name);
        _.forEach(this.$helpDocs, function (doc, taskName) {
          _this.logger.log(chalk.bold.underline(taskName));
          _this.logger.log('\t', doc, '\n');
        });
      }
    }
  }, {
    key: '$useAsRoot',
    value: function $useAsRoot() {
      this._rootLevel = true;
      this.name = '$root$';
    }
  }, {
    key: '$setDefault',
    value: function $setDefault(taskFuncName) {
      this._defaultTaskFuncName = taskFuncName;
    }
  }, {
    key: '$isRoot',
    value: function $isRoot() {
      return this._rootLevel;
    }
  }, {
    key: '$setName',
    value: function $setName(name) {
      this.name = name;
    }
  }, {
    key: '$getName',
    value: function $getName() {
      return this.name;
    }
  }, {
    key: '$getTask',
    value: function $getTask(name) {
      return this._tasks[name];
    }
  }, {
    key: '$getSubTask',
    value: function $getSubTask() {
      return this._subTasks;
    }
  }, {
    key: '$setSubTask',
    value: function $setSubTask(tasks) {
      this._subTasks = tasks;
    }
  }, {
    key: '$init',
    value: function $init() {
      return null;
    }
  }, {
    key: '$getRunning',
    value: function $getRunning() {
      return this._running;
    }
  }, {
    key: '$register',
    value: function $register() {
      // this.vLogger.log('$register start');
      var tList = [];

      this._bfsTaskBuilder(tList, this);

      // run init, running as optimal to shortcut $init's that don't return promises
      var initPromise = this._normalizeExecFuncToPromise(this.$init, this);

      // this.vLogger.log('$register bfsTaskBuilder outList:', tList);
      this._addTasks(tList, this);

      return initPromise
      // .then((results) => {
      //   this.vLogger.log('$register initFunctionList done:', results);
      // })
      .then(function (results) {
        // this.vLogger.log('$register initFunctionList done:', results);
        return results;
      });
    }
  }, {
    key: '_addTasks',
    value: function _addTasks(tList, task) {
      var _this2 = this;

      // this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', rootLevel:', this._rootLevel, ', this != task:', this != task);

      _.forEach(tList, function (funcName) {
        var taskId = '';

        if (_this2 !== task && !_this2._rootLevel) {
          taskId += task.name + '.';
        }
        taskId += funcName;

        if (funcName === _this2._defaultTaskFuncName) {
          taskId = 'default'; // set taskId to 'default'
        }

        // this.vLogger.log('taskId:', taskId);
        _this2._tasks[taskId] = {
          taskId: taskId,
          tasksObj: task,
          func: task[funcName]
        };
      });
    }

    // TODO: ??? combine the logic of 'add' and 'addSubTasks'
    // move to recursive run model using task $register instead of mixing sub tasks with current task class

  }, {
    key: '$addSubTasks',
    value: function $addSubTasks(Task, config) {
      if (!this.beelzebub.isLoading()) {
        // this.logger.error('$addSubTasks can only be called during init');
        return when.reject();
      }

      var task = null;
      if (_.isFunction(Task) && _.isObject(Task)) {
        config.parentPath = this.namePath;
        task = new Task(config);
      } else {
        task = Task;
      }

      // this.vLogger.log('$addSubTasks addInitFunction', task.name);
      this.beelzebub.addInitFunction(function () {
        return task.$register();
      });

      // this.vLogger.log('task:', task);
      this._subTasks[task.$getName()] = task;
    }
  }, {
    key: '_normalizeExecFuncToPromise',
    value: function _normalizeExecFuncToPromise(func, parent) {
      var p = null;
      // this.logger.log('normalizeExecFuncToPromise',
      // 'isPromise:', isPromise(func),
      // ', isGenerator:', isGenerator(func),
      // ', isFunction:', _.isFunction(func));

      // func already a promise
      if (isPromise(func)) {
        p = func;
      }
      // func is a generator function
      else if (isGenerator(func)) {
          // run generator using co
          if (parent) {
            p = co(func.bind(parent));
          } else {
            p = co(func);
          }
        }
        // if task is function, run it
        else if (_.isFunction(func)) {
            if (parent) {
              p = func.apply(parent);
            } else {
              p = func();
            }
          } else {
            // TODO: check other
            this.logger.warn('other type?? func:', func, ', parent:', parent);
          }

      // this.logger.log('normalizeExecFuncToPromise',
      // 'isStream:', isStream(p),
      // ', isPromise:', isPromise(p),
      // ', optimize:', optimize);

      // convert streams to promise
      if (isStream(p)) {
        p = streamToPromise(p);
      }

      if (!isPromise(p)) {
        p = when.resolve(p);
      }

      return p;
    }
  }, {
    key: '_bfsTaskBuilder',
    value: function _bfsTaskBuilder(outList, task, name) {
      var proto = (0, _getPrototypeOf2.default)(task);
      // this.vLogger.log('task:', task, ', proto:', proto, ', name:', name);

      if (proto && _.isObject(proto)) {
        // this.vLogger.log('name:', name, ', task.name:', task.name);
        name = name || task.name;
        var oproto = this._bfsTaskBuilder(outList, proto, name);
        if ((0, _getPrototypeOf2.default)(oproto) && !(oproto === BzTasks.prototype)) {
          // this.vLogger.log('name:', name, 'oproto:', oproto, ', oproto instanceof BzTasks:', (oproto === BzTasks.prototype));

          var tList = (0, _getOwnPropertyNames2.default)(oproto);
          tList = tList.filter(function (p) {
            return _.isFunction(task[p]) && p !== 'constructor' /* NOT constructor */ && p[0] !== '_' /* doesn't start with underscore */ && p[0] !== '$' /* doesn't start with $ */
            ;
          });

          // this.vLogger.log('name:', name, ', oproto:', oproto, ', tList:', tList);

          for (var i = 0; i < tList.length; i++) {
            outList.push(tList[i]);
          }
        }
      }

      return task;
    }

    /**
     * Runs task(s) in sequence
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '$sequence',
    value: function $sequence() {
      var _beelzebub;

      for (var _len6 = arguments.length, args = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
        args[_key6] = arguments[_key6];
      }

      // TODO: prevent infinite loop
      return (_beelzebub = this.beelzebub).sequence.apply(_beelzebub, [this].concat(args));
    }

    /**
     * Runs task(s) in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '$parallel',
    value: function $parallel() {
      var _beelzebub2;

      for (var _len7 = arguments.length, args = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
        args[_key7] = arguments[_key7];
      }

      // TODO: prevent infinite loop
      return (_beelzebub2 = this.beelzebub).parallel.apply(_beelzebub2, [this].concat(args));
    }

    /**
     * Runs task(s) - multi args run in sequence, arrays are run in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '$run',
    value: function $run() {
      var _beelzebub3;

      for (var _len8 = arguments.length, args = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
        args[_key8] = arguments[_key8];
      }

      // TODO: prevent infinite loop
      return (_beelzebub3 = this.beelzebub).run.apply(_beelzebub3, [this].concat(args));
    }

    /**
     * Internal Run task(s) in sequence
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '_sequence',
    value: function _sequence(parent) {
      var _this3 = this;

      for (var _len9 = arguments.length, args = Array(_len9 > 1 ? _len9 - 1 : 0), _key9 = 1; _key9 < _len9; _key9++) {
        args[_key9 - 1] = arguments[_key9];
      }

      // this.vLogger.log('sequence args:', args);
      // this.vLogger.log('sequence parent:', parent);

      if (parent && (_.isString(parent) || _.isArray(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('sequence args:', args);
      }

      var aTasks = [];
      _.forEach(args, function (task) {
        aTasks.push(function () {
          return _this3._runPromiseTask(parent, task);
        });
      });

      // this.vLogger.log('sequence args:', aTasks);
      return whenSequence(aTasks);
    }

    /**
     * Internal Runs task(s) in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '_parallel',
    value: function _parallel(parent) {
      var _this4 = this;

      for (var _len10 = arguments.length, args = Array(_len10 > 1 ? _len10 - 1 : 0), _key10 = 1; _key10 < _len10; _key10++) {
        args[_key10 - 1] = arguments[_key10];
      }

      // this.vLogger.log('parallel args:', args);

      if (parent && (_.isString(parent) || _.isArray(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('parallel args:', args);
      }

      var pList = _.map(args, function (task) {
        return _this4._runPromiseTask(parent, task);
      });

      // this.vLogger.log('parallel pList:', pList);
      return when.all(pList);
    }

    /**
     * Runs task(s) - multi args run in sequence, arrays are run in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '_run',
    value: function _run(parent) {
      var _this5 = this;

      var taskName = 'default';
      var promise = null;

      for (var _len11 = arguments.length, args = Array(_len11 > 1 ? _len11 - 1 : 0), _key11 = 1; _key11 < _len11; _key11++) {
        args[_key11 - 1] = arguments[_key11];
      }

      if (parent && (_.isString(parent) || _.isArray(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('run args:', args);
      }

      if (args.length === 1) {
        taskName = args[0];
        promise = this._runPromiseTask(parent, taskName);
      } else {
        // multi args mean, run in sequence
        promise = this._sequence.apply(this, [parent].concat(args));
      }

      this._running = promise.then(function (result) {
        _this5._running = null;
        return result;
      });

      return this._running.catch(function (e) {
        _this5.logger.error(e);
      });
    }

    /**
     * run a task
     * @param task {String}
     * @returns {Promise}
     */
    // TODO: should this be private?

  }, {
    key: '_runTask',
    value: function _runTask(task) {
      var _this6 = this;

      var p = null;

      // wait for self to complete
      if (this.beelzebub.isLoading()) {
        p = this.beelzebub.getInitPromise();
      } else {
        p = when.resolve();
      }

      return p.then(function () {
        // this.vLogger.log('task class:', this.name
        //   , ', running task:', task
        //   , ', all tasks:', _.keys(this._tasks)
        //   , ', all subTasks:', _.keys(this._subTasks));

        // if no task specified, then use default
        if (!task || !task.length) {
          task = 'default';
        }

        if (_.isString(task)) {
          var taskParts = task.split('.');
          var taskUnderscored = task.split(':').join('_');
          var taskName = taskParts.shift();

          if (_this6._subTasks[taskName]) {
            return _this6._subTasks[taskName]._runTask(taskParts.join('.'));
          } else if (_this6.$getTask(taskUnderscored)) {
            var taskObj = _this6.$getTask(taskUnderscored);
            return _this6._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj);
          } else if (_this6.$getTask(taskName)) {
            var _taskObj = _this6.$getTask(taskName);
            return _this6._normalizeExecFuncToPromise(_taskObj.func, _taskObj.tasksObj);
          }
          // Error ???
        }
        // what else could this be?
      });
    }

    /**
     * Runs task
     * @param parent object
     * @param task (function or string)
     * @returns {Promise}
     */
    // TODO: issues, need to circle back around to top level BZ and trickle down
    // TODO: can we merge this with runTask?
    // so it can recursivly chain down to resolve promises all the way down

  }, {
    key: '_runPromiseTask',
    value: function _runPromiseTask(parent, task) {
      var p = null;

      // if task is array, then run in parallel
      if (_.isArray(task)) {
        return this._parallel.apply(this, [parent].concat((0, _toConsumableArray3.default)(task)));
      }

      // if task is string, then find function and parent in list
      if (_.isString(task)) {
        // if first char "." then relative to parent path
        if (task.charAt(0) === '.') {
          if (!parent) {
            this.logger.trace('parent missing but expected');
          } else {
            task = parent.namePath + task;
          }
        }

        var taskParts = task.split('.');
        var taskName = taskParts.shift();

        if (!this._tasks.hasOwnProperty(taskName)) {
          // now check if in sub level
          if (this._subTasks.hasOwnProperty(taskName)) {
            p = this._subTasks[taskName]._runTask(taskParts.join('.'));
          } else {
            var error = 'task name not found: "' + task + '"';
            this.logger.error(error);
            p = when.reject(error);
          }
        }

        if (!p) {
          if (taskParts.length > 0) {
            p = this._tasks[taskName]._runTask(taskParts.join('.'));
          } else {
            if (this._tasks[taskName]) {
              task = this._tasks[taskName].func;
              parent = this._tasks[taskName].tasksObj;

              p = this._normalizeExecFuncToPromise(task, parent);
            } else {
              var _error = 'task name not found: "' + task + '"';
              this.logger.error(_error);
              p = when.reject(_error);
            }
          }
        }
      } else if (_.isFunction(task)) {
        p = this._normalizeExecFuncToPromise(task, parent);
      } else {
        var _error2 = 'task type not supported: "' + task + '"';
        this.logger.trace(_error2);
        p = when.reject(_error2);
      }

      // TODO: what happens to the data at the end? TBD
      return p;
    }
  }]);
  return BzTasks;
}();

/**
 * ========================================================
 * Module for export
 * ========================================================
 */


var BeelzebubMod = function BeelzebubMod(config) {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub(config);
  }
  return beelzebubInst;
};

// TODO: find a better way to create these functions
BeelzebubMod.delete = function () {
  beelzebubInst = null;
};
BeelzebubMod.create = function (config) {
  return new Beelzebub(config);
};
BeelzebubMod.init = function (config) {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }
  return beelzebubInst.init(config);
};
BeelzebubMod.add = function (task, config) {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }
  return beelzebubInst.add(task, config);
};
BeelzebubMod.sequence = function () {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }

  for (var _len12 = arguments.length, args = Array(_len12), _key12 = 0; _key12 < _len12; _key12++) {
    args[_key12] = arguments[_key12];
  }

  return beelzebubInst.sequence.apply(beelzebubInst, args);
};
BeelzebubMod.parallel = function () {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }

  for (var _len13 = arguments.length, args = Array(_len13), _key13 = 0; _key13 < _len13; _key13++) {
    args[_key13] = arguments[_key13];
  }

  return beelzebubInst.parallel.apply(beelzebubInst, args);
};
BeelzebubMod.run = function () {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }

  for (var _len14 = arguments.length, args = Array(_len14), _key14 = 0; _key14 < _len14; _key14++) {
    args[_key14] = arguments[_key14];
  }

  return beelzebubInst.run.apply(beelzebubInst, args);
};
BeelzebubMod.printHelp = function () {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }

  for (var _len15 = arguments.length, args = Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {
    args[_key15] = arguments[_key15];
  }

  return beelzebubInst.printHelp.apply(beelzebubInst, args);
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
BeelzebubMod.decorators = Decorators;

module.exports = BeelzebubMod;