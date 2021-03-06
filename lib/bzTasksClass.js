'use strict';

const _        = require('lodash');
const when     = require('when');
const co       = require('co');
const chalk    = require('chalk');
const whenSeq  = require('when/sequence');
const streamToPromise = require('stream-to-promise');

const manifest = require('../package.json');
const bzStats  = require('./bzStats.js');
const util     = require('./util.js');

/**
 * Beelzebub Task Class, should be extended
 * @class
 */
class BzTasks {
  constructor (config, hidden = false) {
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
  _buildNamePath (config) {
    let namePath = this.name;
    if (config.parentPath) {
      namePath = config.parentPath + '.' + namePath;
    }
    return namePath;
  }

  /**
   * Get Task Tree starting with this task
   * @returns {object}
   */
  $getTaskTree () {
    let tree = {
      name:     this.name,
      tasks:    this._tasks,
      stats:    this._stats,
      subTasks: []
    };

    let i = 0;
    _.forEach(this.$getSubTasks(), (task) => {
      // if task is suppose to be hidden ($root$ for example)
      // use first sub task as tree
      if (this._hidden && i === 0) {
        tree = task.$getTaskTree();
      }
      else {
        if (this._hidden) {
          // this should not really happen
          this.logger.warn('multi sub tasks in hidden task node not allowed');
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
  $getTaskFlatList () {
    let list = [];
    if (!this._hidden) {
      list.push({
        name:     this.name,
        tasks:    this._tasks,
        stats:    this._stats
      });
    }

    _.forEach(this.$getSubTasks(), (task) => {
      list = list.concat(task.$getTaskFlatList());
    });

    return list;
  }

  /**
   * Get task status and all it's sub tasks stats
   * @returns {object}
   */
  $getStatsSummary (parentSummary) {
    let summary = this._stats.getSummary(parentSummary);

    _.forEach(this.$getSubTasks(), (task) => {
      summary = task.$getStatsSummary(summary);
    });

    return summary;
  }

  /**
   * Prints Task help and all sub tasks help
   * @example {@embed ../examples/api/helpDocs.js}
   */
  $printHelp () {
    _.forEach(this.$getSubTasks(), (task) => {
      task.$printHelp();
    });

    if (this.$helpDocs) {
      this.beelzebub.drawBox(this.name);
      _.forEach(this.$helpDocs, (doc, taskName) => {
        // use helpLogger so time stamp's are not printed
        this.helpLogger.log(chalk.bold.underline(taskName));
        this.helpLogger.log('\t', doc, '\n');
      });
    }
  }

  /**
   * Gets Current Config
   * @returns {object} config
   */
  $config () {
    return this._config;
  }

  /**
   * Use this Task as root task
   * @example {@embed ../examples/api/defaultRootlevelAdvanced.js}
   */
  $useAsRoot () {
    this._rootLevel = true;
    this.name = '$root$';
  }

  /**
   * Set a Task as default
   * @param {string} taskFuncName - This Class (Task) function name
   * @example {@embed ../examples/api/defaultRootlevelAdvanced.js}
   */
  $setDefault (taskFuncName) {
    this._defaultTaskFuncName = taskFuncName;
  }

  /**
   * Has any of the tasks ran before?
   * @returns {boolean}
   */
  $hasRunBefore () {
    return this._beforeAllRun;
  }

  /**
   * Is this task root level?
   * @returns {boolean}
   */
  $isRoot () {
    return this._rootLevel;
  }

  /**
   * Set name of Task Group/Class, when refering to Task Group in CLI or other Tasks
   * @param {string} name - New name of Task Group/Class
   */
  $setName (name) {
    this.name = name;
  }

  /**
   * Get name of Task Group/Class
   * @returns {string}
   */
  $getName () {
    return this.name;
  }

  /**
   * Get Task by Name
   * @param {string} name - Name of Task to get
   * @returns {function}
   */
  $getTask (name) {
    return this._tasks[name];
  }
  /**
   * Does this Task Group have a Task with the name?
   * @param {string} name - Name of Task
   * @returns {boolean}
   */
  $hasTask (name) {
    return this._tasks.hasOwnProperty(name);
  }

  /**
   * Get SubTask by Name
   * @param {string} name - Name of Sub Task
   * @returns {object}
   */
  $getSubTask (name) {
    return this._subTasks[name];
  }
  /**
   * Set SubTask
   * @param {string} name - Name of Sub Task
   * @param {string} task - Task Class
   */
  $setSubTask (name, task) {
    this._subTasks[name] = task;
  }
  /**
   * Does this have a Sub Task with the name?
   * @param {string} name - Name of Sub Task
   * @returns {boolean}
   */
  $hasSubTask (name) {
    return this._subTasks.hasOwnProperty(name);
  }

  /**
   * Get All Sub Task(s)
   * @returns {object}
   */
  $getSubTasks () {
    return this._subTasks;
  }
  /**
   * Set All Sub Task(s)
   * @param {object} tasks
   */
  $setSubTasks (tasks) {
    this._subTasks = tasks;
  }

  /**
   * Set Global Vars
   * @param {object} vars
   */
  $setGlobalVars (vars) {
    this.beelzebub.setGlobalVars(vars);
  }
  /**
   * Get Global Vars
   * @returns {object}
   */
  $getGlobalVars () {
    return this.beelzebub.getGlobalVars();
  }

  /**
   * Define Task Vars
   * @param {string} taskName - Name of Task
   * @param {object} taskDef - Var Defintion for Task
   * @example {@embed ../examples/api/defineVars.js}
   */
  $defineTaskVars (taskName, taskDef) {
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
  $setTaskHelpDocs (taskName, helpDocs) {
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
  $getVarDefsForTaskName (taskStr) {
    let taskParts = taskStr.split('.');
    let taskName = taskParts.shift();
    if (!taskName || !taskName.length) {
      taskName = 'default';
    }
    // this.vLogger.log('taskName:', taskName);
    // this.vLogger.log('taskParts:', taskParts);

    if (this.$hasSubTask(taskName)) {
      let newTaskName = taskParts.join('.');
      // this.vLogger.log('newTaskName:', newTaskName);
      return this.$getSubTask(taskName).$getVarDefsForTaskName(newTaskName);
    }
    else if (this.$hasTask(taskName)) {
      if (!this.$varDefs || _.keys(this.$varDefs).length === 0) {
        return null;
      }
      return this.$varDefs[taskName];
    }
  }

  /**
   * This should be Extented
   * @interface
   * @example {@embed ../examples/api/subTasksSimple.js}
   */
  $init () {
    return null;
  }
  /**
   * This should to be Extented
   * @interface
   * @param {object} taskInfo - {name, vars}
   * @example {@embed ../examples/api/beforeAfter.js}
   */
  $beforeEach (taskInfo) {
    return null;
  }
  /**
   * This should to be Extented
   * @interface
   * @param {object} taskInfo - {name, vars}
   * @example {@embed ../examples/api/beforeAfter.js}
   */
  $afterEach (taskInfo) {
    return null;
  }
  /**
   * This should to be Extented
   * @interface
   * @param {object} taskInfo - {name, vars}
   * @example {@embed ../examples/api/beforeAfterAdvanced.js}
   */
  $beforeAll (taskInfo) {
    return null;
  }
  /**
   * This should to be Extented
   * @interface
   * @example {@embed ../examples/api/beforeAfterAdvanced.js}
   */
  $afterAll () {
    return null;
  }

  /**
   * Is Task Running?
   * @returns {boolean}
   */
  $getRunning () {
    return this._running;
  }

  /**
   * Register the Task with BZ
   * @returns {object} Promise
   */
  $register () {
    // this.vLogger.log('$register start');
    let tList = [];

    this._bfsTaskBuilder(tList, this);

    // run init, running as optimal to shortcut $init's that don't return promises
    let initPromise = this._normalizeExecFuncToPromise(this.$init, this);

    // this.vLogger.log('$register bfsTaskBuilder outList:', tList);
    this._addTasks(tList, this);

    return initPromise
      // .then((results) => {
      //   this.vLogger.log('$register initFunctionList done:', results);
      // })
      .then((results) => {
        // this.vLogger.log('$register initFunctionList done:', results);
        return results;
      });
  }

  /**
   * Util - Start Task Stats
   * @private
   */
  _taskStatsStart (parent, taskName) {
    let name = taskName;
    if (parent.name !== '$root$') {
      name = `${this.namePath}.${taskName}`;
    }

    this.logger.group(name);
    return this._stats.startTask();
  }

  /**
   * Util - End Task Stats
   * @private
   */
  _taskStatsEnd (parent, taskName, statsId) {
    let name = taskName;
    if (parent.name !== '$root$') {
      name = `${this.namePath}.${taskName}`;
    }

    this._stats.endTask(statsId);

    // TODO: add option to not display this
    const stats = this._stats.getTask(statsId);
    const time = Number(stats.diff.time.toFixed(2));

    this.logger.groupEnd(`${name} (${time} ms)`);
  }

  /**
   * Util - Run Before All
   * @private
   */
  _runBeforeAll (taskInfo) {
    return this._normalizeExecFuncToPromise(this.$beforeAll, this, taskInfo)
      .then(() => {
        this._beforeAllRun = true;
      });
  }

  /**
   * Util - Run After All
   * @private
   */
  _runAfterAll () {
    // sequance running all sub task AfterAll function
    let afterPromises = [];
    _.forEach(this.$getSubTasks(), (task) => {
      afterPromises.push(() => {
        return task._runAfterAll();
      });
    });

    return whenSeq(afterPromises).then(() => {
      return this._normalizeExecFuncToPromise(this.$afterAll, this);
    });
  }

  /**
   * Util - Add Tasks
   * @private
   */
  _addTasks (tList, task) {
    // this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', rootLevel:', this._rootLevel, ', this != task:', this != task);

    _.forEach(tList, (funcName) => {
      let taskId = '';

      if ((this !== task) && !this._rootLevel) {
        taskId += task.name + '.';
      }
      taskId += funcName;

      if (funcName === this._defaultTaskFuncName &&
          funcName !== 'default') {
        // default tasks have two entries
        this._tasks[taskId] = {
          taskId:   taskId,
          tasksObj: task,
          func:     task[funcName]
        };

        taskId = 'default';
      }

      // this.vLogger.log('taskId:', taskId);
      this._tasks[taskId] = {
        taskId:   taskId,
        tasksObj: task,
        func:     task[funcName]
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
  $addSubTasks (Task, config = {}) {
    let task = null;
    if (_.isFunction(Task) && _.isObject(Task)) {
      config.parentPath = this.namePath;
      config.beelzebub = this.beelzebub;
      task = new Task(config);
    } else {
      task = Task;
    }

    if (!this.beelzebub.isLoading()) {
      return task.$register().then(() => {
        this.$setSubTask(task.$getName(), task);
      });
      // this.vLogger.error('$addSubTasks can only be called during init');
      // return when.reject();
    }
    else {
      // this.vLogger.log('$addSubTasks addInitFunction', task.name);
      this.beelzebub.addInitFunction(() => {
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
  _normalizeExecFuncToPromise (func, parent, ...args) {
    let p = null;
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
        p = co(func.bind(parent, ...args));
      } else {
        p = co(func.bind(func, ...args));
      }
    }
    // if task is function, run it
    else if (_.isFunction(func)) {
      if (parent) {
        p = func.apply(parent, args);
      } else {
        p = func(...args);
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
  _bfsTaskBuilder (outList, task, name) {
    let proto = Object.getPrototypeOf(task);
    // this.vLogger.log('task:', task, ', proto:', proto, ', name:', name);

    if (proto && _.isObject(proto)) {
      // this.vLogger.log('name:', name, ', task.name:', task.name);
      name = name || task.name;
      let oproto = this._bfsTaskBuilder(outList, proto, name);
      if (Object.getPrototypeOf(oproto) && !(oproto === BzTasks.prototype)) {
        // this.vLogger.log('name:', name, 'oproto:', oproto, ', oproto instanceof BzTasks:', (oproto === BzTasks.prototype));

        let tList = Object.getOwnPropertyNames(oproto);
        tList = tList.filter((p) => {
          return (
            _.isFunction(task[p]) &&
            (p !== 'constructor') /* NOT constructor */ &&
            (p[0] !== '_')        /* doesn't start with underscore */ &&
            (p[0] !== '$')        /* doesn't start with $ */
          );
        });

        // this.vLogger.log('name:', name, ', oproto:', oproto, ', tList:', tList);

        for (let i = 0; i < tList.length; i++) {
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
  $sequence (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.sequence(this, ...args);
  }

  /**
   * Runs task(s) in parallel
   * @param {(function|string)} args - task(s)
   * @returns {object} Promise
   * @example {@embed ../examples/api/parallel.js}
   */
  $parallel (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.parallel(this, ...args);
  }

  /**
   * Runs task(s) - multi args run in sequence, arrays are run in parallel
   * @param {(function|string)} args - task(s)
   * @returns {object} Promise
   */
  $run (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.run(this, ...args);
  }

  /**
   * Util - Breath First Search Task Builder
   * @private
   */
  _waitForInit () {
    let p = null;

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
  _sequence (parent, ...args) {
    // this.vLogger.log('sequence args:', args);
    // this.vLogger.log('sequence parent:', parent);

    if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('sequence args:', args);
    }

    return this._waitForInit().then(() => {
      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      let aTasks = [];
      _.forEach(args, (task) => {
        aTasks.push(() => {
          return this._runPromiseTask(parent, task);
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
  _parallel (parent, ...args) {
    // this.vLogger.log('parallel args:', args);

    if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('parallel args:', args);
    }

    return this._waitForInit().then(() => {
      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      let pList = _.map(args, (task) => {
        return this._runPromiseTask(parent, task);
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
  _run (parent, ...args) {
    // this.vLogger.log('run args:', args);

    // if no args
    if (_.isArray(args) && args.length === 0) {
      // check if root, level and has 'default' task
      if (this._rootLevel && _.isObject(this._tasks[this._defaultTaskFuncName])) {
        args.push(this._defaultTaskFuncName);
      }
    }

    if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('run args:', args);
    }

    return this._waitForInit().then(() => {
      let promise = null;

      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      if (args.length === 1) {
        promise = this._runPromiseTask(parent, args[0]);
      } else {
        // multi args mean, run in sequence
        promise = this._sequence(parent, ...args);
      }

      this._running = promise.then((result) => {
        this._running = null;
        return result;
      });

      return this._running.catch((e) => {
        this.logger.error(e);
      });
    });
  }

  /**
   * Util - Run a task
   * @private
   * @param {string} task
   * @returns {object} Promise
   */
  _runTask (task) {
    // this.vLogger.log('task class:', this.name
    //   , ', running task:', task
    //   , ', all tasks:', _.keys(this._tasks)
    //   , ', all subTasks:', _.keys(this.$getSubTasks()));
    // if no task specified, then use default
    if (!task) {
      task = { task: 'default' };
      // console.error('setting to default');
    }

    let taskParts = task.task.split('.');
    let taskName = taskParts.shift();
    if (!taskName || !taskName.length) {
      taskName = 'default';
    }

    if (this.$hasSubTask(taskName)) {
      task.task = taskParts.join('.');
      // this.vLogger.info('runTask taskName:', taskName, ', runTask:', task.task);

      let tastObject = this.$getSubTask(taskName);

      // has beforeAll run
      if (!tastObject.$hasRunBefore()) {
        const taskInfo = {
          task: taskParts[taskParts.length - 1],
          vars: task.vars
        };
        // call run beforeAll function which sets internal var if ran before
        // not crazy about using private, but don't want people to thing it's ok to run this
        return tastObject._runBeforeAll(taskInfo).then(() => {
          return tastObject._runTask(task);
        });
      }
      // beforeAll has already run
      else {
        return tastObject._runTask(task);
      }
    }
    else if (this.$hasTask(taskName)) {
      const taskObj = this.$getTask(taskName);

      return this._execTaskFun(taskName, taskObj.func, taskObj.tasksObj, task.vars);
    } else {
      this.logger.error(`Task "${taskName}" - not found`);
    }
  }

  /**
   * Util - Run Before Each
   * @private
   * @param {object} parent
   * @param {object} taskInfo
   * @returns {object} Promise
   */
  _runBeforeEach (parent, taskInfo) {
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
  _execTaskFun (taskName, func, parent, vars) {
    const taskInfo = {
      task: taskName,
      vars: vars
    };

    let fullTaskName = taskName;
    if (parent && _.isString(parent.name) && parent.name !== '$root$') {
      fullTaskName = `${this.namePath}.${taskName}`;
    }
    // this.vLogger.info('execTaskFun taskName:', JSON.stringify(taskInfo));

    let beforePromise = null;
    if (!parent.$hasRunBefore()) {
      // call run beforeAll function which sets internal var if ran before
      // not crazy about using private, but don't want people to thing it's ok to run this
      beforePromise = parent._runBeforeAll(taskInfo).then(() => {
        return this._runBeforeEach(parent, taskInfo);
      });
    }
    else {
      beforePromise = this._runBeforeEach(parent, taskInfo);
    }

    // run beforeAll
    let statsId = null;
    return beforePromise.then(() => {
      // after, before
      this.beelzebub.emit('$before', {
        task: fullTaskName,
        vars: taskInfo.vars
      });

      statsId = parent._taskStatsStart(parent, taskName);

      // if parent is Object
      if (_.isObject(parent)) {
        // add context aware $emit
        parent.$emit = (name, data) => {
          this.beelzebub.emit(name, {
            task: fullTaskName,
            vars: taskInfo.vars
          }, data);
        };
      }

      // run task function
      return this._normalizeExecFuncToPromise(func, parent, vars);
    })
    .then(() => {
      parent._taskStatsEnd(parent, taskName, statsId);

      // run afterEach
      return this._normalizeExecFuncToPromise(parent.$afterEach, parent, taskInfo);
    })
    .then(() => {
      // after, after
      this.beelzebub.emit('$after', {
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
  _runPromiseTask (parent, task) {
    let p = null;

    // if task is array, then run in parallel
    if (_.isArray(task)) {
      return this._parallel(parent, ...task);
    }
    // if task is object, then find function and parent in list
    else if (_.isObject(task)) {
      let taskParts = [];
      let taskName = 'default';

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
            let tastObject = this.$getSubTask(taskName);

            // run parent beforeAll running subTask
            // has beforeAll run
            if (!tastObject.$hasRunBefore()) {
              const taskInfo = {
                task: taskParts[taskParts.length - 1],
                vars: task.vars
              };
              // call run beforeAll function which sets internal var if ran before
              // not crazy about using private, but don't want people to thing it's ok to run this
              p = tastObject._runBeforeAll(taskInfo).then(() => {
                return tastObject._runTask(task);
              });
            }
            // beforeAll has already run
            else {
              p = tastObject._runTask(task);
            }
          } else {
            let error = `task name not found: "${task.task}"`;
            this.logger.error(error);
            p = when.reject(error);
          }
        }
      }
      else {
        let error = `invalid task name: "${task.task}"`;
        this.logger.error(error);
        p = when.reject(error);
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
            let error = `task name not found: "${task}"`;
            this.logger.error(error);
            p = when.reject(error);
          }
        }
      }
    }
    else {
      let error = `task type not supported: "${task}"`;
      this.logger.trace(error);
      p = when.reject(error);
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
  _normalizeTask (parent, tasks) {
    let objTasks = _.map(tasks, (task) => {
      let taskObj;

      if (_.isString(task)) {
        // if first char "." then relative to parent path
        if (task.charAt(0) === '.') {
          if (!parent) {
            this.logger.trace('parent missing but expected');
          } else {
            task = parent.namePath + task;
          }
        }

        let taskParts = task.split('.');
        let taskName = taskParts.shift();

        let taskFullName = task;
        let taskVarParts = task.split(':');
        let taskVars = {};

        if (taskVarParts.length > 0) {
          taskFullName = taskVarParts.shift();
          taskVars = taskVarParts.join(':');

          // vars a string and empty, this can happen is no vars pass to task string
          if (_.isString(taskVars) && taskVars.length === 0) {
            taskVars = {};
          } else {
            try {
              taskVars = JSON.parse(taskVars);
            }
            catch (err) {
              // this is ok
              this.vLogger.warn('Parsing Task Error:', err);
            }
          }
        }

        if (!this.$getSubTask(taskName) && !this.$getTask(taskName)) {
          this.logger.warn(taskFullName, 'task not added');
          return false;
        }

        taskObj = {
          task: taskFullName,
          vars: taskVars
        };
      }
      else if (_.isArray(task)) {
        taskObj = this._normalizeTask(parent, task);
      }
      else if (_.isFunction(task)) {
        taskObj = {
          task: task
        };
      }
      else if (_.isObject(task)) {
        if (!task.hasOwnProperty('task')) {
          this.logger.warn('invalid object: task property required');
          return null;
        }

        // if first char "." then relative to parent path
        if (task.task.charAt(0) === '.') {
          if (!parent) {
            this.logger.trace('parent missing but expected');
          } else {
            task.task = parent.namePath + task.task;
          }
        }

        return task;
      } else {
        this.logger.warn('unknown task input type');
        return null;
      }

      // make sure vars is object
      if (taskObj.vars === null || taskObj.vars === undefined) {
        taskObj.vars = {};
      }

      if (!_.isObject(taskObj.vars)) {
        this.logger.warn('Vars should be an object');
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
  _applyVarDefsToAllTasks (objTasks) {
    objTasks = _.map(objTasks, (task) => {
      return this._applyVarDefToTask(task);
    });

    return objTasks;
  }

  /**
   * Util - Apply Variable Definitions To Task
   * @private
   * @param {object} task - Task
   * @returns {object} task
   */
  _applyVarDefToTask (task) {
    if (_.isArray(task)) {
      return _.map(task, (t) => {
        return this._applyVarDefToTask(t);
      });
    }
    // task object and task is string
    else if (_.isObject(task) && _.isString(task.task)) {
      let taskParts = task.task.split('.');
      let taskName = taskParts.shift();
      if (!taskName || !taskName.length) {
        taskName = 'default';
      }

      if (this.$hasSubTask(taskName)) {
        // use copy of tasks to pass to child, as we don't want to mutate the task name
        let newTask = _.cloneDeep(task);
        newTask.task = taskParts.join('.');
        newTask = this.$getSubTask(taskName)._applyVarDefToTask(newTask);
        // update task vars
        task.vars = newTask.vars;
      }
      else if (this.$hasTask(taskName)) {
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
  _applyVarDefs (varDefs, vars) {
    // this.vLogger.info('varDefs:', varDefs);
    // this.vLogger.info('vars:', vars);

    _.forEach(varDefs, (varDef, key) => {
      let type = varDef.type.toLowerCase();

      // if as alias
      if (varDef.alias) {
        let tkey = varDef.alias;
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
            this.logger.error(`${key} is not a string but defined as one, converting to string`);
            vars[key] = String(vars[key]);
          }
        }
        else if (type === 'number') {
          // not number
          if (!_.isNumber(vars[key])) {
            this.logger.error(`${key} is not a number but defined as one, converting to number`);
            vars[key] = Number(vars[key]);
          }
        }
        else if (type === 'boolean') {
          // not boolean
          if (!_.isBoolean(vars[key])) {
            this.logger.error(`${key} is not a boolean but defined as one, converting to boolean`);
            // is string, only compare if 'true', otherwise false
            if (_.isString(vars[key])) {
              vars[key] = (vars[key].toLowerCase() === 'true');
            }
            // convert all else use Boolean
            else {
              vars[key] = Boolean(vars[key]);
            }
          }
        }
        else if (type === 'array') {
          // not array
          if (!_.isArray(vars[key])) {
            this.logger.error(`${key} is not a array but defined as one, converting to array`);

            if (_.isString(vars[key])) {
              try {
                vars[key] = JSON.parse(vars[key]);
              }
              catch (err) {
                // if parsing fails then split the string by commas
                vars[key] = vars[key].split(',');
              }
            }
            else {
              vars[key] = Array(vars[key]);
            }
          }
        }
        else if (type === 'object') {
          if (!_.isObject(vars[key])) {
            this.logger.error(`${key} is not a object but defined as one, converting to object`);

            // convert vars[key] to object
            if (_.isString(vars[key])) {
              try {
                vars[key] = JSON.parse(vars[key]);
              }
              catch (err) {
                // if parsing fails then just stick in data prop
                this.logger.error(`object "${key}" json parsing error: ${err}`);
                vars[key] = { data: vars[key] };
              }
            }
            else {
              vars[key] = { data: vars[key] };
            }
          }

          let varProps = varDef.properties;
          if (!varProps || !_.isObject(varProps)) {
            this.logger.error(`object "${key}" properties is not defined as object, skipping all sub properties.`);
          } else {
            // recursivly check children (properties)
            vars[key] = this._applyVarDefs(varProps, vars[key]);
          }
        }
        else {
          this.logger.warn(`Unknown Variable Definition Type: ${type}`);
        }
      }
      // not set to anything
      else {
        if (varDef.required) {
          this.logger.error(`Var "${key}" is required but not set in vars.`);
        }

        let defValue = null;
        if (type === 'string') { defValue = ''; }
        else if (type === 'number') { defValue = 0; }
        else if (type === 'boolean') { defValue = false; }
        else if (type === 'array') { defValue = []; }
        else if (type === 'object') { defValue = {}; }

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

}

module.exports = BzTasks;
