'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _getOwnPropertyNames = require('babel-runtime/core-js/object/get-own-property-names');

var _getOwnPropertyNames2 = _interopRequireDefault(_getOwnPropertyNames);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = require('lodash');
var when = require('when');
var co = require('co');
var chalk = require('chalk');
var whenSeq = require('when/sequence');
var streamToPromise = require('stream-to-promise');

var manifest = require('../package.json');
var util = require('./util.js');

/**
 * ========================================================
 * Beelzebub Task Class, should be extended
 * ========================================================
 */

var BzTasks = function () {
  function BzTasks(config) {
    (0, _classCallCheck3.default)(this, BzTasks);

    this.beelzebub = config.beelzebub || util.beelzebubInst;

    util.processConfig(config, this.beelzebub.getConfig(), this);

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
    key: '$setGlobalVars',
    value: function $setGlobalVars(vars) {
      this.beelzebub.setGlobalVars(vars);
    }
  }, {
    key: '$getGlobalVars',
    value: function $getGlobalVars() {
      return this.beelzebub.getGlobalVars();
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
    value: function _normalizeExecFuncToPromise(func, parent, vars) {
      var p = null;
      // this.logger.log('normalizeExecFuncToPromise',
      // 'isPromise:', isPromise(func),
      // ', isGenerator:', isGenerator(func),
      // ', isFunction:', _.isFunction(func));

      // func already a promise
      if (util.isPromise(func)) {
        p = func;
      }
      // func is a generator function
      else if (util.isGenerator(func)) {
          // run generator using co
          if (parent) {
            p = co(func.bind(parent, vars));
          } else {
            p = co(func.bind(func, vars));
          }
        }
        // if task is function, run it
        else if (_.isFunction(func)) {
            if (parent) {
              p = func.apply(parent, [vars]);
            } else {
              p = func(vars);
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
      if (util.isStream(p)) {
        p = streamToPromise(p);
      }

      if (!util.isPromise(p)) {
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

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
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

      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
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

      for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
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

      for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        args[_key4 - 1] = arguments[_key4];
      }

      // this.vLogger.log('sequence args:', args);
      // this.vLogger.log('sequence parent:', parent);

      if (parent && (_.isString(parent) || _.isArray(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('sequence args:', args);
      }

      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      var aTasks = [];
      _.forEach(args, function (task) {
        aTasks.push(function () {
          return _this3._runPromiseTask(parent, task);
        });
      });

      // this.vLogger.log('sequence args:', aTasks);
      return whenSeq(aTasks);
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

      for (var _len5 = arguments.length, args = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
        args[_key5 - 1] = arguments[_key5];
      }

      // this.vLogger.log('parallel args:', args);

      if (parent && (_.isString(parent) || _.isArray(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('parallel args:', args);
      }

      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

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

      for (var _len6 = arguments.length, args = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
        args[_key6 - 1] = arguments[_key6];
      }

      var promise = null;

      if (parent && (_.isString(parent) || _.isArray(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('run args:', args);
      }

      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      if (args.length === 1) {
        promise = this._runPromiseTask(parent, args[0]);
      } else {
        // multi args mean, run in sequence
        promise = this._sequence.apply(this, [parent].concat((0, _toConsumableArray3.default)(args)));
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
        if (!task) {
          task = { task: 'default' };
          // console.error('setting to default');
        }

        var taskParts = task.task.split('.');
        var taskName = taskParts.shift();
        if (!taskName || !taskName.length) {
          taskName = 'default';
        }

        if (_this6._subTasks[taskName]) {
          task.task = taskParts.join('.');
          return _this6._subTasks[taskName]._runTask(task);
        } else if (_this6.$getTask(taskName)) {
          var taskObj = _this6.$getTask(taskName);
          return _this6._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj, task.vars);
        } else {
          _this6.logger.error('Task "' + taskName + '" - not found');
        }
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
      // if task is object, then find function and parent in list
      else if (_.isObject(task)) {
          var taskParts = [];
          var taskName = 'default';

          // task is function
          if (_.isFunction(task.task)) {
            p = this._normalizeExecFuncToPromise(task.task, parent, task.vars);
          }
          // task is string
          else if (_.isString(task.task)) {
              taskParts = task.task.split('.');
              taskName = taskParts.shift();

              if (!this._tasks.hasOwnProperty(taskName)) {
                // now check if in sub level
                if (this._subTasks.hasOwnProperty(taskName)) {
                  task.task = taskParts.join('.');
                  // this.vLogger.info('runPromiseTask taskName:', taskName, ', runTask:', task.task);
                  p = this._subTasks[taskName]._runTask(task);
                } else {
                  var error = 'task name not found: "' + task.task + '"';
                  this.logger.error(error);
                  p = when.reject(error);
                }
              }
            } else {
              var _error = 'invalid task name: "' + task.task + '"';
              this.logger.error(_error);
              p = when.reject(_error);
            }

          // no promise
          if (!p) {
            if (taskParts.length > 0) {
              task.task = taskParts.join('.');
              // this.vLogger.info('runPromiseTask taskName:', taskName, ', runTask:', task.task);
              p = this._tasks[taskName]._runTask(task);
            } else {
              if (this._tasks[taskName]) {
                task = this._tasks[taskName].func;
                parent = this._tasks[taskName].tasksObj;

                p = this._normalizeExecFuncToPromise(task, parent, task.vars);
              } else {
                var _error2 = 'task name not found: "' + task + '"';
                this.logger.error(_error2);
                p = when.reject(_error2);
              }
            }
          }
        } else {
          var _error3 = 'task type not supported: "' + task + '"';
          this.logger.trace(_error3);
          p = when.reject(_error3);
        }

      // TODO: what happens to the data at the end? TBD
      return p;
    }
  }, {
    key: '_normalizeTask',
    value: function _normalizeTask(parent, tasks) {
      var _this7 = this;

      var objTasks = _.map(tasks, function (task) {
        if (_.isString(task)) {
          // if first char "." then relative to parent path
          if (task.charAt(0) === '.') {
            if (!parent) {
              _this7.logger.trace('parent missing but expected');
            } else {
              task = parent.namePath + task;
            }
          }

          var taskParts = task.split('.');
          var taskName = taskParts.shift();

          var taskFullName = task;
          var taskVarParts = task.split(':');
          var taskVars = void 0;

          if (taskVarParts.length > 0) {
            taskFullName = taskVarParts.shift();
            taskVars = taskVarParts.join(':');

            try {
              taskVars = JSON.parse(taskVars);
            } catch (err) {
              // this is ok
            }
          }

          if (!_this7._subTasks[taskName] && !_this7.$getTask(taskName)) {
            _this7.logger.warn(taskFullName, 'task not added');
            return false;
          }

          return {
            task: taskFullName,
            vars: taskVars
          };
        } else if (_.isArray(task)) {
          return _this7._normalizeTask(parent, task);
        } else if (_.isFunction(task)) {
          return {
            task: task
          };
        } else if (_.isObject(task)) {
          if (!task.hasOwnProperty('task')) {
            _this7.logger.warn('invalid object: task property required');
            return null;
          }

          return task;
        } else {
          _this7.logger.warn('unknown task input type');
          return null;
        }
      });

      // this.vLogger.log('objTasks:', objTasks);
      return objTasks;
    }
  }]);
  return BzTasks;
}();

module.exports = BzTasks;