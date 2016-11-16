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

    this.beelzebub = config.beelzebub || util.getInstance();
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
    this._beforeAllRan = false;

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

      _.forEach(this.$getSubTasks(), function (task) {
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
    key: '$hasRunBefore',
    value: function $hasRunBefore() {
      return this._beforeAllRun;
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
    key: '$hasTask',
    value: function $hasTask(name) {
      return this._tasks.hasOwnProperty(name);
    }
  }, {
    key: '$getSubTask',
    value: function $getSubTask(name) {
      return this._subTasks[name];
    }
  }, {
    key: '$setSubTask',
    value: function $setSubTask(name, task) {
      this._subTasks[name] = task;
    }
  }, {
    key: '$hasSubTask',
    value: function $hasSubTask(name) {
      return this._subTasks.hasOwnProperty(name);
    }
  }, {
    key: '$getSubTasks',
    value: function $getSubTasks() {
      return this._subTasks;
    }
  }, {
    key: '$setSubTasks',
    value: function $setSubTasks(tasks) {
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
    key: '$defineTaskVars',
    value: function $defineTaskVars(taskName, taskDef) {
      if (!_.isObject(this.$varDefs)) {
        this.$varDefs = {};
      }

      this.$varDefs[taskName] = taskDef;
    }
  }, {
    key: '$setTaskHelpDocs',
    value: function $setTaskHelpDocs(taskName, helpDocs) {
      if (!_.isObject(this.$helpDocs)) {
        this.$helpDocs = {};
      }

      this.$helpDocs[taskName] = helpDocs;
    }
  }, {
    key: '$getVarDefsForTaskName',
    value: function $getVarDefsForTaskName(taskStr) {
      var taskParts = taskStr.split('.');
      var taskName = taskParts.shift();
      if (!taskName || !taskName.length) {
        taskName = 'default';
      }
      // this.vLogger.log('taskName:', taskName);
      // this.vLogger.log('taskParts:', taskParts);

      if (this.$hasSubTask(taskName)) {
        var newTaskName = taskParts.join('.');
        // this.vLogger.log('newTaskName:', newTaskName);
        return this.$getSubTask(taskName).$getVarDefsForTaskName(newTaskName);
      } else if (this.$hasTask(taskName)) {
        if (!this.$varDefs || _.keys(this.$varDefs).length === 0) {
          return null;
        }
        return this.$varDefs[taskName];
      }
    }
  }, {
    key: '$init',
    value: function $init() {
      return null;
    }
  }, {
    key: '$beforeEach',
    value: function $beforeEach() {
      return null;
    }
  }, {
    key: '$afterEach',
    value: function $afterEach() {
      return null;
    }
  }, {
    key: '$beforeAll',
    value: function $beforeAll() {
      return null;
    }
  }, {
    key: '$afterAll',
    value: function $afterAll() {
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
    key: '_runBeforeAll',
    value: function _runBeforeAll() {
      var _this2 = this;

      return this._normalizeExecFuncToPromise(this.$beforeAll, this).then(function () {
        _this2._beforeAllRun = true;
      });
    }
  }, {
    key: '_runAfterAll',
    value: function _runAfterAll() {
      var _this3 = this;

      // sequance running all sub task AfterAll function
      var afterPromises = [];
      _.forEach(this.$getSubTasks(), function (task) {
        afterPromises.push(function () {
          return task._runAfterAll();
        });
      });

      return whenSeq(afterPromises).then(function () {
        return _this3._normalizeExecFuncToPromise(_this3.$afterAll, _this3);
      });
    }
  }, {
    key: '_addTasks',
    value: function _addTasks(tList, task) {
      var _this4 = this;

      // this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', rootLevel:', this._rootLevel, ', this != task:', this != task);

      _.forEach(tList, function (funcName) {
        var taskId = '';

        if (_this4 !== task && !_this4._rootLevel) {
          taskId += task.name + '.';
        }
        taskId += funcName;

        if (funcName === _this4._defaultTaskFuncName) {
          taskId = 'default'; // set taskId to 'default'
        }

        // this.vLogger.log('taskId:', taskId);
        _this4._tasks[taskId] = {
          taskId: taskId,
          tasksObj: task,
          func: task[funcName]
        };
      });
    }

    // TODO: ??? combine the logic of 'add' and 'addSubTasks'
    // move to recursive run model using task $register instead of mixing sub tasks with current task class
    // TODO: should this always return a promise? when adding in $init should the use be forced to wait on this?

  }, {
    key: '$addSubTasks',
    value: function $addSubTasks(Task) {
      var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

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
      this.$setSubTask(task.$getName(), task);
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

      for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }

      if (util.isPromise(func)) {
        p = func;
      }
      // func is a generator function
      else if (util.isGenerator(func)) {
          // run generator using co
          if (parent) {
            p = co(func.bind.apply(func, [parent].concat(args)));
          } else {
            p = co(func.bind.apply(func, [func].concat(args)));
          }
        }
        // if task is function, run it
        else if (_.isFunction(func)) {
            if (parent) {
              p = func.apply(parent, args);
            } else {
              p = func.apply(undefined, args);
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

      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
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

      for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
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

      for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }

      // TODO: prevent infinite loop
      return (_beelzebub3 = this.beelzebub).run.apply(_beelzebub3, [this].concat(args));
    }
  }, {
    key: '_waitForInit',
    value: function _waitForInit() {
      var p = null;

      // wait for self to complete
      if (this.beelzebub.isLoading()) {
        p = this.beelzebub.getInitPromise();
      } else {
        p = when.resolve();
      }

      return p;
    }

    /**
     * Internal Run task(s) in sequence
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '_sequence',
    value: function _sequence(parent) {
      var _this5 = this;

      for (var _len5 = arguments.length, args = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
        args[_key5 - 1] = arguments[_key5];
      }

      // this.vLogger.log('sequence args:', args);
      // this.vLogger.log('sequence parent:', parent);

      if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('sequence args:', args);
      }

      return this._waitForInit().then(function () {
        // normalize tasks (aka args)
        args = _this5._normalizeTask(parent, args);

        var aTasks = [];
        _.forEach(args, function (task) {
          aTasks.push(function () {
            return _this5._runPromiseTask(parent, task);
          });
        });

        // this.vLogger.log('sequence args:', aTasks);
        return whenSeq(aTasks);
      });
    }

    /**
     * Internal Runs task(s) in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '_parallel',
    value: function _parallel(parent) {
      var _this6 = this;

      for (var _len6 = arguments.length, args = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
        args[_key6 - 1] = arguments[_key6];
      }

      // this.vLogger.log('parallel args:', args);

      if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('parallel args:', args);
      }

      return this._waitForInit().then(function () {
        // normalize tasks (aka args)
        args = _this6._normalizeTask(parent, args);

        var pList = _.map(args, function (task) {
          return _this6._runPromiseTask(parent, task);
        });

        // this.vLogger.log('parallel pList:', pList);
        return when.all(pList);
      });
    }

    /**
     * Runs task(s) - multi args run in sequence, arrays are run in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */

  }, {
    key: '_run',
    value: function _run(parent) {
      var _this7 = this;

      for (var _len7 = arguments.length, args = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
        args[_key7 - 1] = arguments[_key7];
      }

      // this.vLogger.log('run args:', args);

      if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
        args.unshift(parent);
        parent = undefined;
        // this.vLogger.log('run args:', args);
      }

      return this._waitForInit().then(function () {
        var promise = null;

        // normalize tasks (aka args)
        args = _this7._normalizeTask(parent, args);

        if (args.length === 1) {
          promise = _this7._runPromiseTask(parent, args[0]);
        } else {
          // multi args mean, run in sequence
          promise = _this7._sequence.apply(_this7, [parent].concat((0, _toConsumableArray3.default)(args)));
        }

        _this7._running = promise.then(function (result) {
          _this7._running = null;
          return result;
        });

        return _this7._running.catch(function (e) {
          _this7.logger.error(e);
        });
      });
    }

    /**
     * run a task
     * @param task {String}
     * @returns {Promise}
     */

  }, {
    key: '_runTask',
    value: function _runTask(task) {
      // this.vLogger.log('task class:', this.name
      //   , ', running task:', task
      //   , ', all tasks:', _.keys(this._tasks)
      //   , ', all subTasks:', _.keys(this.$getSubTasks()));
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

      if (this.$hasSubTask(taskName)) {
        task.task = taskParts.join('.');
        return this.$getSubTask(taskName)._runTask(task);
      } else if (this.$hasTask(taskName)) {
        var taskObj = this.$getTask(taskName);

        return this._execTaskFun(taskName, taskObj.func, taskObj.tasksObj, task.vars);
      } else {
        this.logger.error('Task "' + taskName + '" - not found');
      }
    }
  }, {
    key: '_execTaskFun',
    value: function _execTaskFun(taskName, func, parent, vars) {
      var _this8 = this;

      var taskInfo = {
        task: taskName,
        vars: vars
      };

      var beforeAllPromise = when.resolve();
      if (!parent.$hasRunBefore()) {
        // call run beforeAll function which sets internal var if ran before
        // not crazy about using private, but don't want people to thing it's ok to run this
        beforeAllPromise = parent._runBeforeAll();
      }

      // run beforeAll
      return beforeAllPromise.then(function () {
        // run beforeEach
        return _this8._normalizeExecFuncToPromise(parent.$beforeEach, parent, taskInfo);
      }).then(function () {
        // run task function
        return _this8._normalizeExecFuncToPromise(func, parent, vars);
      }).then(function () {
        // run afterEach
        return _this8._normalizeExecFuncToPromise(parent.$afterEach, parent, taskInfo);
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
            p = this._execTaskFun(taskName, task.task, parent, task.vars);
          }
          // task is string
          else if (_.isString(task.task)) {
              taskParts = task.task.split('.');
              taskName = taskParts.shift();

              if (!this.$hasTask(taskName)) {
                // now check if in sub level
                if (this.$hasSubTask(taskName)) {
                  task.task = taskParts.join('.');
                  // this.vLogger.info('runPromiseTask taskName:', taskName, ', runTask:', task.task);
                  p = this.$getSubTask(taskName)._runTask(task);
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

                p = this._execTaskFun(taskName, task, parent, task.vars);
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
      var _this9 = this;

      var objTasks = _.map(tasks, function (task) {
        var taskObj = void 0;

        if (_.isString(task)) {
          // if first char "." then relative to parent path
          if (task.charAt(0) === '.') {
            if (!parent) {
              _this9.logger.trace('parent missing but expected');
            } else {
              task = parent.namePath + task;
            }
          }

          var taskParts = task.split('.');
          var taskName = taskParts.shift();

          var taskFullName = task;
          var taskVarParts = task.split(':');
          var taskVars = {};

          if (taskVarParts.length > 0) {
            taskFullName = taskVarParts.shift();
            taskVars = taskVarParts.join(':');

            // vars a string and empty, this can happen is no vars pass to task string
            if (_.isString(taskVars) && taskVars.length === 0) {
              taskVars = {};
            } else {
              try {
                taskVars = JSON.parse(taskVars);
              } catch (err) {
                // this is ok
                _this9.vLogger.warn('Parsing Task Error:', err);
              }
            }
          }

          if (!_this9.$getSubTask(taskName) && !_this9.$getTask(taskName)) {
            _this9.logger.warn(taskFullName, 'task not added');
            return false;
          }

          taskObj = {
            task: taskFullName,
            vars: taskVars
          };
        } else if (_.isArray(task)) {
          taskObj = _this9._normalizeTask(parent, task);
        } else if (_.isFunction(task)) {
          taskObj = {
            task: task
          };
        } else if (_.isObject(task)) {
          if (!task.hasOwnProperty('task')) {
            _this9.logger.warn('invalid object: task property required');
            return null;
          }

          return task;
        } else {
          _this9.logger.warn('unknown task input type');
          return null;
        }

        // make sure vars is object
        if (taskObj.vars === null || taskObj.vars === undefined) {
          taskObj.vars = {};
        }

        if (!_.isObject(taskObj.vars)) {
          _this9.logger.warn('Vars should be an object');
          taskObj.vars = {};
        }

        return taskObj;
      });

      // apply var definitions if they exist
      // definitions -> defaults, data types and requirements
      objTasks = this._applyVarDefsToAllTasks(objTasks);

      // this.vLogger.log('objTasks:', objTasks);
      return objTasks;
    }

    /**
     * @return {object} tasks object
     * @param {object} var defs applied oject
     */

  }, {
    key: '_applyVarDefsToAllTasks',
    value: function _applyVarDefsToAllTasks(objTasks) {
      var _this10 = this;

      objTasks = _.map(objTasks, function (task) {
        return _this10._applyVarDefToTask(task);
      });

      return objTasks;
    }
  }, {
    key: '_applyVarDefToTask',
    value: function _applyVarDefToTask(task) {
      var _this11 = this;

      if (_.isArray(task)) {
        return _.map(task, function (t) {
          return _this11._applyVarDefToTask(t);
        });
      }
      // task object and task is string
      else if (_.isObject(task) && _.isString(task.task)) {
          var taskParts = task.task.split('.');
          var taskName = taskParts.shift();
          if (!taskName || !taskName.length) {
            taskName = 'default';
          }

          if (this.$hasSubTask(taskName)) {
            // use copy of tasks to pass to child, as we don't want to mutate the task name
            var newTask = _.cloneDeep(task);
            newTask.task = taskParts.join('.');
            newTask = this.$getSubTask(taskName)._applyVarDefToTask(newTask);
            // update task vars
            task.vars = newTask.vars;
          } else if (this.$hasTask(taskName)) {
            // no vardefs or no keys in object
            if (!this.$varDefs || _.keys(this.$varDefs).length === 0) {
              return task;
            }

            // has vars definition
            if (this.$varDefs[taskName]) {
              // apply def to vars
              task.vars = this._applyVarDefs(this.$varDefs[taskName], task.vars);
            }
          } else {
            this.logger.error('Task "' + taskName + '" - not found');
          }

          return task;
        }
        // could be task is function or something else, but can't look up vardef to apply
        else {
            return task;
          }
    }

    // TODO: need loads of tests to cover all the conditionals

  }, {
    key: '_applyVarDefs',
    value: function _applyVarDefs(varDefs, vars) {
      var _this12 = this;

      // this.vLogger.info('varDefs:', varDefs);
      // this.vLogger.info('vars:', vars);

      _.forEach(varDefs, function (varDef, key) {
        var type = varDef.type.toLowerCase();

        // if as alias
        if (varDef.alias) {
          var tkey = varDef.alias;
          // if alias var has value, then use this as the key
          if (vars[tkey] !== null && vars[tkey] !== undefined) {
            vars[key] = vars[tkey];
          }
        }

        // var is set to something
        if (vars[key] !== null && vars[key] !== undefined) {
          if (type === 'string') {
            // not string
            if (!_.isString(vars[key])) {
              _this12.logger.error(key + ' is not a string but defined as one, converting to string');
              vars[key] = String(vars[key]);
            }
          } else if (type === 'number') {
            // not number
            if (!_.isNumber(vars[key])) {
              _this12.logger.error(key + ' is not a number but defined as one, converting to number');
              vars[key] = Number(vars[key]);
            }
          } else if (type === 'boolean') {
            // not boolean
            if (!_.isBoolean(vars[key])) {
              _this12.logger.error(key + ' is not a boolean but defined as one, converting to boolean');
              // is string, only compare if 'true', otherwise false
              if (_.isString(vars[key])) {
                vars[key] = vars[key].toLowerCase() === 'true';
              }
              // convert all else use Boolean
              else {
                  vars[key] = Boolean(vars[key]);
                }
            }
          } else if (type === 'array') {
            // not array
            if (!_.isArray(vars[key])) {
              _this12.logger.error(key + ' is not a array but defined as one, converting to array');

              if (_.isString(vars[key])) {
                try {
                  vars[key] = JSON.parse(vars[key]);
                } catch (err) {
                  // if parsing fails then split the string by commas
                  vars[key] = vars[key].split(',');
                }
              } else {
                vars[key] = Array(vars[key]);
              }
            }
          } else if (type === 'object') {
            if (!_.isObject(vars[key])) {
              _this12.logger.error(key + ' is not a object but defined as one, converting to object');

              // convert vars[key] to object
              if (_.isString(vars[key])) {
                try {
                  vars[key] = JSON.parse(vars[key]);
                } catch (err) {
                  // if parsing fails then just stick in data prop
                  _this12.logger.error('object "' + key + '" json parsing error: ' + err);
                  vars[key] = { data: vars[key] };
                }
              } else {
                vars[key] = { data: vars[key] };
              }
            }

            var varProps = varDef.properties;
            if (!varProps || !_.isObject(varProps)) {
              _this12.logger.error('object "' + key + '" properties is not defined as object, skipping all sub properties.');
            } else {
              // recursivly check children (properties)
              vars[key] = _this12._applyVarDefs(varProps, vars[key]);
            }
          } else {
            _this12.logger.warn('Unknown Variable Definition Type: ' + type);
          }
        }
        // not set to anything
        else {
            if (varDef.required) {
              _this12.logger.error('Var "' + key + '" is required but not set in vars.');
            }

            var defValue = null;
            if (type === 'string') {
              defValue = '';
            } else if (type === 'number') {
              defValue = 0;
            } else if (type === 'boolean') {
              defValue = false;
            } else if (type === 'array') {
              defValue = [];
            } else if (type === 'object') {
              defValue = {};
            }

            // has default
            if (varDef.default) {
              vars[key] = varDef.default;
            }
            // else default to empty string
            else {
                vars[key] = defValue;
              }
          }
      });

      return vars;
    }
  }]);
  return BzTasks;
}();

module.exports = BzTasks;