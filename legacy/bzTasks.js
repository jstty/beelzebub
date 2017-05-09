'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

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
var bzStats = require('./bzStats.js');
var util = require('./util.js');

/**
 * Beelzebub Task Class, should be extended
 * @class
 */

var BzTasks = function () {
  function BzTasks(config) {
    var hidden = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    (0, _classCallCheck3.default)(this, BzTasks);

    this._hidden = hidden;
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
    this._beforeAllRun = false;
    this._stats = new bzStats.Task();

    // TODO: add cli options/commands
  }

  /**
   * Util to build Name Path
   * TODO: move this out of the class
   * @private
   */


  (0, _createClass3.default)(BzTasks, [{
    key: '_buildNamePath',
    value: function _buildNamePath(config) {
      var namePath = this.name;
      if (config.parentPath) {
        namePath = config.parentPath + '.' + namePath;
      }
      return namePath;
    }

    /**
     * Get Task Tree starting with this task
     * @returns {object}
     */

  }, {
    key: '$getTaskTree',
    value: function $getTaskTree() {
      var _this = this;

      var tree = {
        name: this.name,
        tasks: this._tasks,
        stats: this._stats,
        subTasks: []
      };

      var i = 0;
      _.forEach(this.$getSubTasks(), function (task) {
        // if task is suppose to be hidden ($root$ for example)
        // use first sub task as tree
        if (_this._hidden && i === 0) {
          tree = task.$getTaskTree();
        } else {
          if (_this._hidden) {
            // this should not really happen
            _this.logger.warn('multi sub tasks in hidden task node not allowed');
          }

          tree.subTasks.push(task.$getTaskTree());
        }
        i++;
      });

      return tree;
    }

    /**
     * Get flatten task tree so it's one level
     * @returns {object}
     */

  }, {
    key: '$getTaskFlatList',
    value: function $getTaskFlatList() {
      var list = [];
      if (!this._hidden) {
        list.push({
          name: this.name,
          tasks: this._tasks,
          stats: this._stats
        });
      }

      _.forEach(this.$getSubTasks(), function (task) {
        list = list.concat(task.$getTaskFlatList());
      });

      return list;
    }

    /**
     * Get task status and all it's sub tasks stats
     * @returns {object}
     */

  }, {
    key: '$getStatsSummary',
    value: function $getStatsSummary(parentSummary) {
      var summary = this._stats.getSummary(parentSummary);

      _.forEach(this.$getSubTasks(), function (task) {
        summary = task.$getStatsSummary(summary);
      });

      return summary;
    }

    /**
     * Prints Task help and all sub tasks help
     * @example {@embed ../examples/api/helpDocs.js}
     */

  }, {
    key: '$printHelp',
    value: function $printHelp() {
      var _this2 = this;

      _.forEach(this.$getSubTasks(), function (task) {
        task.$printHelp();
      });

      if (this.$helpDocs) {
        this.beelzebub.drawBox(this.name);
        _.forEach(this.$helpDocs, function (doc, taskName) {
          // use helpLogger so time stamp's are not printed
          _this2.helpLogger.log(chalk.bold.underline(taskName));
          _this2.helpLogger.log('\t', doc, '\n');
        });
      }
    }

    /**
     * Use this Task as root task
     * @example {@embed ../examples/api/defaultRootlevel.js}
     */

  }, {
    key: '$useAsRoot',
    value: function $useAsRoot() {
      this._rootLevel = true;
      this.name = '$root$';
    }

    /**
     * Set a Task as default
     * @param {string} taskFuncName - This Class (Task) function name
     * @example {@embed ../examples/api/defaultRootlevel.js}
     */

  }, {
    key: '$setDefault',
    value: function $setDefault(taskFuncName) {
      this._defaultTaskFuncName = taskFuncName;
    }

    /**
     * Has any of the tasks ran before?
     * @returns {boolean}
     */

  }, {
    key: '$hasRunBefore',
    value: function $hasRunBefore() {
      return this._beforeAllRun;
    }

    /**
     * Is this task root level?
     * @returns {boolean}
     */

  }, {
    key: '$isRoot',
    value: function $isRoot() {
      return this._rootLevel;
    }

    /**
     * Set name of Task Group/Class, when refering to Task Group in CLI or other Tasks
     * @param {string} name - New name of Task Group/Class
     */

  }, {
    key: '$setName',
    value: function $setName(name) {
      this.name = name;
    }

    /**
     * Get name of Task Group/Class
     * @returns {string}
     */

  }, {
    key: '$getName',
    value: function $getName() {
      return this.name;
    }

    /**
     * Get Task by Name
     * @param {string} name - Name of Task to get
     * @returns {function}
     */

  }, {
    key: '$getTask',
    value: function $getTask(name) {
      return this._tasks[name];
    }
    /**
     * Does this Task Group have a Task with the name?
     * @param {string} name - Name of Task
     * @returns {boolean}
     */

  }, {
    key: '$hasTask',
    value: function $hasTask(name) {
      return this._tasks.hasOwnProperty(name);
    }

    /**
     * Get SubTask by Name
     * @param {string} name - Name of Sub Task
     * @returns {object}
     */

  }, {
    key: '$getSubTask',
    value: function $getSubTask(name) {
      return this._subTasks[name];
    }
    /**
     * Set SubTask
     * @param {string} name - Name of Sub Task
     * @param {string} task - Task Class
     */

  }, {
    key: '$setSubTask',
    value: function $setSubTask(name, task) {
      this._subTasks[name] = task;
    }
    /**
     * Does this have a Sub Task with the name?
     * @param {string} name - Name of Sub Task
     * @returns {boolean}
     */

  }, {
    key: '$hasSubTask',
    value: function $hasSubTask(name) {
      return this._subTasks.hasOwnProperty(name);
    }

    /**
     * Get All Sub Task(s)
     * @returns {object}
     */

  }, {
    key: '$getSubTasks',
    value: function $getSubTasks() {
      return this._subTasks;
    }
    /**
     * Set All Sub Task(s)
     * @param {object} tasks
     */

  }, {
    key: '$setSubTasks',
    value: function $setSubTasks(tasks) {
      this._subTasks = tasks;
    }

    /**
     * Set Global Vars
     * @param {object} vars
     */

  }, {
    key: '$setGlobalVars',
    value: function $setGlobalVars(vars) {
      this.beelzebub.setGlobalVars(vars);
    }
    /**
     * Get Global Vars
     * @returns {object}
     */

  }, {
    key: '$getGlobalVars',
    value: function $getGlobalVars() {
      return this.beelzebub.getGlobalVars();
    }

    /**
     * Define Task Vars
     * @param {string} taskName - Name of Task
     * @param {object} taskDef - Var Defintion for Task
     * @example {@embed ../examples/api/defineVars.js}
     */

  }, {
    key: '$defineTaskVars',
    value: function $defineTaskVars(taskName, taskDef) {
      if (!_.isObject(this.$varDefs)) {
        this.$varDefs = {};
      }

      this.$varDefs[taskName] = taskDef;
    }

    /**
     * Set Help Docs for Task
     * @param {string} taskName - Name of Task
     * @param {string} helpDocs - Help Docs for Task
     * @example {@embed ../examples/api/helpDocs.js}
     */

  }, {
    key: '$setTaskHelpDocs',
    value: function $setTaskHelpDocs(taskName, helpDocs) {
      if (!_.isObject(this.$helpDocs)) {
        this.$helpDocs = {};
      }

      this.$helpDocs[taskName] = helpDocs;
    }

    /**
     * Get Define Task Vars by Name
     * @param {string} taskStr - Name of Task
     * @returns {object} Varaible Definition for Task
     */

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

    /**
     * This needs to be Extented
     * @interface
     * @example {@embed ../examples/api/subTasksSimple.js}
     */

  }, {
    key: '$init',
    value: function $init() {
      return null;
    }
    /**
     * This needs to be Extented
     * @interface
     * @example {@embed ../examples/api/beforeAfter.js}
     */

  }, {
    key: '$beforeEach',
    value: function $beforeEach() {
      return null;
    }
    /**
     * This needs to be Extented
     * @interface
     * @example {@embed ../examples/api/beforeAfter.js}
     */

  }, {
    key: '$afterEach',
    value: function $afterEach() {
      return null;
    }
    /**
     * This needs to be Extented
     * @interface
     * @example {@embed ../examples/api/beforeAfterAdvanced.js}
     */

  }, {
    key: '$beforeAll',
    value: function $beforeAll() {
      return null;
    }
    /**
     * This needs to be Extented
     * @interface
     * @example {@embed ../examples/api/beforeAfterAdvanced.js}
     */

  }, {
    key: '$afterAll',
    value: function $afterAll() {
      return null;
    }

    /**
     * Is Task Running?
     * @returns {boolean}
     */

  }, {
    key: '$getRunning',
    value: function $getRunning() {
      return this._running;
    }

    /**
     * Register the Task with BZ
     * @returns {object} Promise
     */

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

    /**
     * Util - Start Task Stats
     * @private
     */

  }, {
    key: '_taskStatsStart',
    value: function _taskStatsStart(parent, taskName) {
      var name = taskName;
      if (parent.name !== '$root$') {
        name = this.namePath + '.' + taskName;
      }

      this.logger.group(name);
      return this._stats.startTask();
    }

    /**
     * Util - End Task Stats
     * @private
     */

  }, {
    key: '_taskStatsEnd',
    value: function _taskStatsEnd(parent, taskName, statsId) {
      var name = taskName;
      if (parent.name !== '$root$') {
        name = this.namePath + '.' + taskName;
      }

      this._stats.endTask(statsId);

      // TODO: add option to not display this
      var stats = this._stats.getTask(statsId);
      var time = Number(stats.diff.time.toFixed(2));

      this.logger.groupEnd(name + ' (' + time + ' ms)');
    }

    /**
     * Util - Run Before All
     * @private
     */

  }, {
    key: '_runBeforeAll',
    value: function _runBeforeAll() {
      var _this3 = this;

      return this._normalizeExecFuncToPromise(this.$beforeAll, this).then(function () {
        _this3._beforeAllRun = true;
      });
    }

    /**
     * Util - Run After All
     * @private
     */

  }, {
    key: '_runAfterAll',
    value: function _runAfterAll() {
      var _this4 = this;

      // sequance running all sub task AfterAll function
      var afterPromises = [];
      _.forEach(this.$getSubTasks(), function (task) {
        afterPromises.push(function () {
          return task._runAfterAll();
        });
      });

      return whenSeq(afterPromises).then(function () {
        return _this4._normalizeExecFuncToPromise(_this4.$afterAll, _this4);
      });
    }

    /**
     * Util - Add Tasks
     * @private
     */

  }, {
    key: '_addTasks',
    value: function _addTasks(tList, task) {
      var _this5 = this;

      // this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', rootLevel:', this._rootLevel, ', this != task:', this != task);

      _.forEach(tList, function (funcName) {
        var taskId = '';

        if (_this5 !== task && !_this5._rootLevel) {
          taskId += task.name + '.';
        }
        taskId += funcName;

        if (funcName === _this5._defaultTaskFuncName && funcName !== 'default') {
          // default tasks have two entries
          _this5._tasks[taskId] = {
            taskId: taskId,
            tasksObj: task,
            func: task[funcName]
          };

          taskId = 'default';
        }

        // this.vLogger.log('taskId:', taskId);
        _this5._tasks[taskId] = {
          taskId: taskId,
          tasksObj: task,
          func: task[funcName]
        };
      });
    }

    // TODO: ??? combine the logic of 'add' and 'addSubTasks'
    // move to recursive run model using task $register instead of mixing sub tasks with current task class
    // TODO: should this always return a promise? when adding in $init should the use be forced to wait on this?
    /**
     * Add Sub Tasks
     * @public
     * @param {object} Task - Task Class
     * @param {object} [config={}] - Config for Task
     * @returns {object} Promise
     * @example {@embed ../examples/api/subTasksSimple.js}
    */

  }, {
    key: '$addSubTasks',
    value: function $addSubTasks(Task) {
      var _this6 = this;

      var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var task = null;
      if (_.isFunction(Task) && _.isObject(Task)) {
        config.parentPath = this.namePath;
        config.beelzebub = this.beelzebub;
        task = new Task(config);
      } else {
        task = Task;
      }

      if (!this.beelzebub.isLoading()) {
        return task.$register().then(function () {
          _this6.$setSubTask(task.$getName(), task);
        });
        // this.vLogger.error('$addSubTasks can only be called during init');
        // return when.reject();
      } else {
        // this.vLogger.log('$addSubTasks addInitFunction', task.name);
        this.beelzebub.addInitFunction(function () {
          return task.$register();
        });

        // this.vLogger.log('task:', task);
        this.$setSubTask(task.$getName(), task);

        return when.resolve();
      }
    }

    /**
     * Util - Normalize Execute of Function, Promise, or Generator (using CO)
     * @private
     */

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

    /**
     * Util - Breath First Search Task Builder
     * @private
     */

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
     * @param {(object|string)} args - task(s)
     * @returns {Object} Promise
     * @example {@embed ../examples/api/sequence.js}
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
     * @param {(function|string)} args - task(s)
     * @returns {object} Promise
     * @example {@embed ../examples/api/parallel.js}
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
     * @param {(function|string)} args - task(s)
     * @returns {object} Promise
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

    /**
     * Util - Breath First Search Task Builder
     * @private
     */

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
     * Util - Run task(s) in sequence
     * @private
     * @param {(function|string)} [parent] - Parent Task
     * @param {(object|string)} [args] - Arguments for Task
     * @returns {object} Promise
     */

  }, {
    key: '_sequence',
    value: function _sequence(parent) {
      var _this7 = this;

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
        args = _this7._normalizeTask(parent, args);

        var aTasks = [];
        _.forEach(args, function (task) {
          aTasks.push(function () {
            return _this7._runPromiseTask(parent, task);
          });
        });

        // this.vLogger.log('sequence args:', aTasks);
        return whenSeq(aTasks);
      });
    }

    /**
     * Util - Runs task(s) in parallel
     * @private
     * @param {(function|string)} [parent] - Parent Task
     * @param {(object|string)} [args] - Arguments for Task
     * @returns {object} Promise
     */

  }, {
    key: '_parallel',
    value: function _parallel(parent) {
      var _this8 = this;

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
        args = _this8._normalizeTask(parent, args);

        var pList = _.map(args, function (task) {
          return _this8._runPromiseTask(parent, task);
        });

        // this.vLogger.log('parallel pList:', pList);
        return when.all(pList);
      });
    }

    /**
     * Util - Runs task(s) - multi args run in sequence, arrays are run in parallel
     * @private
     * @param {(function|string)} [parent] - Parent Task
     * @param {(object|string)} [args] - Arguments for Task
     * @returns {object} Promise
     */

  }, {
    key: '_run',
    value: function _run(parent) {
      var _this9 = this;

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
        args = _this9._normalizeTask(parent, args);

        if (args.length === 1) {
          promise = _this9._runPromiseTask(parent, args[0]);
        } else {
          // multi args mean, run in sequence
          promise = _this9._sequence.apply(_this9, [parent].concat((0, _toConsumableArray3.default)(args)));
        }

        _this9._running = promise.then(function (result) {
          _this9._running = null;
          return result;
        });

        return _this9._running.catch(function (e) {
          _this9.logger.error(e);
        });
      });
    }

    /**
     * Util - Run a task
     * @private
     * @param {string} task
     * @returns {object} Promise
     */

  }, {
    key: '_runTask',
    value: function _runTask(task) {
      var _this10 = this;

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
        var _ret = function () {
          task.task = taskParts.join('.');
          // this.vLogger.info('runTask taskName:', taskName, ', runTask:', task.task);

          var tastObject = _this10.$getSubTask(taskName);

          // has beforeAll run
          if (!tastObject.$hasRunBefore()) {
            // call run beforeAll function which sets internal var if ran before
            // not crazy about using private, but don't want people to thing it's ok to run this
            return {
              v: tastObject._runBeforeAll().then(function () {
                return tastObject._runTask(task);
              })
            };
          }
          // beforeAll has already run
          else {
              return {
                v: tastObject._runTask(task)
              };
            }
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret)) === "object") return _ret.v;
      } else if (this.$hasTask(taskName)) {
        var taskObj = this.$getTask(taskName);

        return this._execTaskFun(taskName, taskObj.func, taskObj.tasksObj, task.vars);
      } else {
        this.logger.error('Task "' + taskName + '" - not found');
      }
    }

    /**
     * Util - Run Before Each
     * @private
     * @param {object} parent
     * @param {object} taskInfo
     * @returns {object} Promise
     */

  }, {
    key: '_runBeforeEach',
    value: function _runBeforeEach(parent, taskInfo) {
      // run beforeEach
      return this._normalizeExecFuncToPromise(parent.$beforeEach, parent, taskInfo);
    }

    /**
     * Util - Exec Task Fucntion
     * @private
     * @param {string} taskName
     * @param {function} func
     * @param {object} parent
     * @param {object} vars
     * @returns {object} Promise
     */

  }, {
    key: '_execTaskFun',
    value: function _execTaskFun(taskName, func, parent, vars) {
      var _this11 = this;

      var taskInfo = {
        task: taskName,
        vars: vars
      };

      var fullTaskName = taskName;
      if (parent && _.isString(parent.name) && parent.name !== '$root$') {
        fullTaskName = this.namePath + '.' + taskName;
      }
      // this.vLogger.info('execTaskFun taskName:', JSON.stringify(taskInfo));

      var beforePromise = null;
      if (!parent.$hasRunBefore()) {
        // call run beforeAll function which sets internal var if ran before
        // not crazy about using private, but don't want people to thing it's ok to run this
        beforePromise = parent._runBeforeAll().then(function () {
          return _this11._runBeforeEach(parent, taskInfo);
        });
      } else {
        beforePromise = this._runBeforeEach(parent, taskInfo);
      }

      // run beforeAll
      var statsId = null;
      return beforePromise.then(function () {
        // after, before
        _this11.beelzebub.emit('$before', {
          task: fullTaskName,
          vars: taskInfo.vars
        });

        statsId = parent._taskStatsStart(parent, taskName);

        // if parent is Object
        if (_.isObject(parent)) {
          // add context aware $emit
          parent.$emit = function (name, data) {
            _this11.beelzebub.emit(name, {
              task: fullTaskName,
              vars: taskInfo.vars
            }, data);
          };
        }

        // run task function
        return _this11._normalizeExecFuncToPromise(func, parent, vars);
      }).then(function () {
        parent._taskStatsEnd(parent, taskName, statsId);

        // run afterEach
        return _this11._normalizeExecFuncToPromise(parent.$afterEach, parent, taskInfo);
      }).then(function () {
        // after, after
        _this11.beelzebub.emit('$after', {
          task: fullTaskName,
          vars: taskInfo.vars
        });
      });
    }

    /**
     * Util - Runs Promise task
     * TODO: issues, need to circle back around to top level BZ and trickle down
     * TODO: can we merge this with runTask?
     * so it can recursivly chain down to resolve promises all the way down
     * @private
     * @param {object} parent - Parent Task
     * @param {(function|object)} task
     * @returns {object} Promise
     */

  }, {
    key: '_runPromiseTask',
    value: function _runPromiseTask(parent, task) {
      var _this12 = this;

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
                  (function () {
                    task.task = taskParts.join('.');
                    // this.vLogger.info('runPromiseTask taskName:', taskName, ', runTask:', task.task);
                    var tastObject = _this12.$getSubTask(taskName);

                    // run parent beforeAll running subTask
                    // has beforeAll run
                    if (!tastObject.$hasRunBefore()) {
                      // call run beforeAll function which sets internal var if ran before
                      // not crazy about using private, but don't want people to thing it's ok to run this
                      p = tastObject._runBeforeAll().then(function () {
                        return tastObject._runTask(task);
                      });
                    }
                    // beforeAll has already run
                    else {
                        p = tastObject._runTask(task);
                      }
                  })();
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

    /**
     * Util - Normalize Task
     * @private
     * @param {object} parent - Parent Task
     * @param {(function|object)} task
     * @returns {object} Promise
     */

  }, {
    key: '_normalizeTask',
    value: function _normalizeTask(parent, tasks) {
      var _this13 = this;

      var objTasks = _.map(tasks, function (task) {
        var taskObj = void 0;

        if (_.isString(task)) {
          // if first char "." then relative to parent path
          if (task.charAt(0) === '.') {
            if (!parent) {
              _this13.logger.trace('parent missing but expected');
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
                _this13.vLogger.warn('Parsing Task Error:', err);
              }
            }
          }

          if (!_this13.$getSubTask(taskName) && !_this13.$getTask(taskName)) {
            _this13.logger.warn(taskFullName, 'task not added');
            return false;
          }

          taskObj = {
            task: taskFullName,
            vars: taskVars
          };
        } else if (_.isArray(task)) {
          taskObj = _this13._normalizeTask(parent, task);
        } else if (_.isFunction(task)) {
          taskObj = {
            task: task
          };
        } else if (_.isObject(task)) {
          if (!task.hasOwnProperty('task')) {
            _this13.logger.warn('invalid object: task property required');
            return null;
          }

          // if first char "." then relative to parent path
          if (task.task.charAt(0) === '.') {
            if (!parent) {
              _this13.logger.trace('parent missing but expected');
            } else {
              task.task = parent.namePath + task.task;
            }
          }

          return task;
        } else {
          _this13.logger.warn('unknown task input type');
          return null;
        }

        // make sure vars is object
        if (taskObj.vars === null || taskObj.vars === undefined) {
          taskObj.vars = {};
        }

        if (!_.isObject(taskObj.vars)) {
          _this13.logger.warn('Vars should be an object');
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
     * Util - Apply Variable Definitions To All Tasks
     * @private
     * @param {object} objTasks - Tasks
     * @returns {object} objTasks
     */

  }, {
    key: '_applyVarDefsToAllTasks',
    value: function _applyVarDefsToAllTasks(objTasks) {
      var _this14 = this;

      objTasks = _.map(objTasks, function (task) {
        return _this14._applyVarDefToTask(task);
      });

      return objTasks;
    }

    /**
     * Util - Apply Variable Definitions To Task
     * @private
     * @param {object} task - Task
     * @returns {object} task
     */

  }, {
    key: '_applyVarDefToTask',
    value: function _applyVarDefToTask(task) {
      var _this15 = this;

      if (_.isArray(task)) {
        return _.map(task, function (t) {
          return _this15._applyVarDefToTask(t);
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
            // this.logger.error(`Task "${taskName}" - not found`);
          }

          return task;
        }
        // could be task is function or something else, but can't look up vardef to apply
        else {
            return task;
          }
    }

    /**
     * Util - Apply Variable Definitions to input Variables
     * TODO: need loads of tests to cover all the conditionals
     * @private
     * @param {object} varDefs - variable defintions
     * @param {object} vars - input variable
     * @returns {object} vars
     */

  }, {
    key: '_applyVarDefs',
    value: function _applyVarDefs(varDefs, vars) {
      var _this16 = this;

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
              _this16.logger.error(key + ' is not a string but defined as one, converting to string');
              vars[key] = String(vars[key]);
            }
          } else if (type === 'number') {
            // not number
            if (!_.isNumber(vars[key])) {
              _this16.logger.error(key + ' is not a number but defined as one, converting to number');
              vars[key] = Number(vars[key]);
            }
          } else if (type === 'boolean') {
            // not boolean
            if (!_.isBoolean(vars[key])) {
              _this16.logger.error(key + ' is not a boolean but defined as one, converting to boolean');
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
              _this16.logger.error(key + ' is not a array but defined as one, converting to array');

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
              _this16.logger.error(key + ' is not a object but defined as one, converting to object');

              // convert vars[key] to object
              if (_.isString(vars[key])) {
                try {
                  vars[key] = JSON.parse(vars[key]);
                } catch (err) {
                  // if parsing fails then just stick in data prop
                  _this16.logger.error('object "' + key + '" json parsing error: ' + err);
                  vars[key] = { data: vars[key] };
                }
              } else {
                vars[key] = { data: vars[key] };
              }
            }

            var varProps = varDef.properties;
            if (!varProps || !_.isObject(varProps)) {
              _this16.logger.error('object "' + key + '" properties is not defined as object, skipping all sub properties.');
            } else {
              // recursivly check children (properties)
              vars[key] = _this16._applyVarDefs(varProps, vars[key]);
            }
          } else {
            _this16.logger.warn('Unknown Variable Definition Type: ' + type);
          }
        }
        // not set to anything
        else {
            if (varDef.required) {
              _this16.logger.error('Var "' + key + '" is required but not set in vars.');
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