'use strict';

const path  = require('path');
const _     = require('lodash');
const co    = require('co');
const cli   = require('commander'); // TODO: replace this with yargs
const chalk = require('chalk');
const streamToPromise = require('stream-to-promise');

const manifest = require('../package.json');

// TODO: replace ???
const when = require('when');
const whenSequence = require('when/sequence');

// internal singleton instance of the class, only created when needed
let beelzebubInst = null;

const DefaultConfig = {
  verbose: false,
  silent:  false,
  logger:  console
};

const nullLogger = {
  log:   function () {},
  warn:  function () {},
  info:  function () {},
  error: function () {},
  trace: function () {},

  clear:          function () {},
  count:          function () {},
  debug:          function () {},
  dir:            function () {},
  dirxml:         function () {},
  group:          function () {},
  groupCollapsed: function () {},
  groupEnd:       function () {},
  profile:        function () {},
  profileEnd:     function () {},
  time:           function () {},
  timeEnd:        function () {},
  timeStamp:      function () {}
};

/**
 * check if function is generator
 * @param function
 * @returns {boolean}
 */
function isGenerator (func) {
  return (func &&
            func.constructor &&
            func.constructor.name === 'GeneratorFunction');
}

/**
 * check if function is promise
 * @param Promise
 * @returns {boolean}
 */
function isPromise (p) {
  return (p && _.isObject(p) && _.isFunction(p.then));
}

/**
 * check if function is stream
 * @param stream
 * @returns {boolean}
 */
function isStream (s) {
  return (s && _.isObject(s) && _.isFunction(s.pipe));
}

// can't use instanceof as the source might be a different modules but exactly the same
function isBaseTask (a) {
  const checkList = [
    '$sequence',
    '$parallel',
    '$run',
    '$setDefault',
    '$isRoot',
    '$useAsRoot',
    '$setName',
    '$getName',
    '$getTask',
    '$setSubTask',
    '$getSubTask'
  ];
  return _.reduce(checkList, (result, key) => {
    if (!result) return result;
    if (!a[key] || !_.isFunction(a[key])) {
      result = false;
    }
    return result;
  });
  // return b.prototype.isPrototypeOf(a);
  // return a instanceof b;
}

function processConfig (config, parentConfig, contex) {
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
    log:  function () {},
    info: function () {}
  };
  if (contex._config.verbose) {
    contex.vLogger = {
      log:  (...args) => { args.unshift(`[${contex.name}] -`); contex.logger.log(...args); },
      info: (...args) => { args.unshift(`[${contex.name}] -`); contex.logger.info(...args); }
    };
  }
}

/** ******************************************************
 * Beelzebub Class
 ****************************************************** */
class Beelzebub {
  constructor (config) {
    this.version = manifest.version;
    this.reset();
    this.init(config);
  }

  init (config = DefaultConfig) {
    processConfig(config, DefaultConfig, this);

    this._config.beelzebub = this; // don't like this, but needed for BaseTasks
    this._rootTasks = new BaseTasks(this._config);
    this._rootTasks.$useAsRoot();
  }

  reset () {
    // logger util
    // TODO: move this to util
    this.logger = console;
    // verbose logger
    // TODO: move over to stumpy
    this.vLogger = {
      log:  function () {},
      info: function () {}
    };

    this._config = _.cloneDeep(DefaultConfig);
    this._rootTasks = null;

    this._initFunctionList = [];
    this._initDone = false;
  }

  getConfig () {
    return this._config;
  }

  isLoading () {
    return !this._initDone;
  }

  addInitFunction (func) {
    this._initFunctionList.push(func);
  }

  getInitPromise () {
    let func = co.wrap(function *() {
      let results = [];
      for (let i = 0; i < this._initFunctionList.length; i++) {
        let result = yield this._initFunctionList[i]();
        results.push(result);
      }

      // this.vLogger.log('runTask initFunctionList done results:', results);
      this._initDone = true;

      return results;
    }.bind(this));

    return func();
  }

  getRunning () {
    return this._rootTasks.$getRunning();
  }

  add (Tasks, config) {
    let tasks = null;

    if (_.isString(Tasks)) {
      try {
        // TODO: yanpm install this?
        Tasks = require(Tasks);
      }
            catch (err) {
              this.logger.error('Add Task Error:', err);
              return;
            }
    }

    if (_.isFunction(Tasks) && _.isObject(Tasks)) {
      config = _.merge(this._config, config || {});
      config.beelzebub = this;

      tasks = new Tasks(config || this._config);

      if (!isBaseTask(tasks)) {
        this.logger.error('Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BaseTasks" -', tasks);
        return;
      }
    }
    else if (_.isObject(Tasks) && isBaseTask(Tasks)) {
      tasks = Tasks;
    }
    else {
      this.logger.error('Add Task Error: Unknown Task type -', tasks);
      return;
    }

    if (tasks.$isRoot()) {
      // transfer all the current subTasks from old _rootTasks to current

      tasks.$setSubTask(this._rootTasks.$getSubTask());
      this._rootTasks = tasks;

      return tasks.$register().then((results) => {
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
  run (parent, ...args) {
    args.unshift(parent);
    // this.logger.log('args:', args);

    // use internal function, because $run bounces back to root level
    return this._rootTasks._run.apply(this._rootTasks, args);
  }

  sequence (parent, ...args) {
    args.unshift(parent);
    // use internal function, because $sequence bounces back to root level
    return this._rootTasks._sequence.apply(this._rootTasks, args);
  }

  parallel (parent, ...args) {
    args.unshift(parent);
    // use internal function, because $parallel bounces back to root level
    return this._rootTasks._parallel.apply(this._rootTasks, args);
  }

  printHelp () {
    this.drawBox('Help Docs', 80);
    this._rootTasks.$printHelp();
  }

  drawBox (title, width = 60) {
    const sides = {
      'top':          '─',
      'top-mid':      '┬',
      'top-left':     '┌',
      'top-right':    '┐',
      'bottom':       '─',
      'bottom-mid':   '┴',
      'bottom-left':  '└',
      'bottom-right': '┘',
      'left':         '│',
      'left-mid':     '├',
      'mid':          '─',
      'mid-mid':      '┼',
      'right':        '│',
      'right-mid':    '┤',
      'middle':       '│'
    };

    const spaceLen = width - title.length - 5;
    this.logger.log(sides['top-left'] + sides['top'].repeat(width - 2) + sides['top-right']);
    this.logger.log(sides['left'], title, ' '.repeat(spaceLen), sides['right']);
    this.logger.log(sides['bottom-left'] + sides['bottom'].repeat(width - 2) + sides['bottom-right']);
  }
}

// TODO: ??? rename this to BzTasks
class BaseTasks {
  constructor (config) {
    // console.log('cons $helpDocs:', this.$helpDocs);
    this.beelzebub = config.beelzebub || beelzebubInst;

    processConfig(config, this.beelzebub.getConfig(), this);

    this.name = config.name || this.constructor.name || 'BaseTasks';
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
    // this.cli = cli.parse(process.argv);
  }

  _buildNamePath (config) {
    let namePath = this.name;
    if (config.parentPath) {
      namePath = config.parentPath + '.' + config.name;
    }
    return namePath;
  }

  $printHelp () {
    _.forEach(this.$getSubTask(), (task) => {
      task.$printHelp();
    });

    if (this.$helpDocs) {
      this.beelzebub.drawBox(this.name);
      _.forEach(this.$helpDocs, (doc, taskName) => {
        this.logger.log(chalk.bold.underline(taskName));
        this.logger.log('\t', doc, '\n');
      });
    }
  }

  $useAsRoot () {
    this._rootLevel = true;
    this.name = '$root$';
  }

  $setDefault (taskFuncName) {
    this._defaultTaskFuncName = taskFuncName;
  }

  $isRoot () {
    return this._rootLevel;
  }

  $setName (name) {
    this.name = name;
  }

  $getName () {
    return this.name;
  }

  $getTask (name) {
    return this._tasks[name];
  }

  $getSubTask () {
    return this._subTasks;
  }

  $setSubTask (tasks) {
    this._subTasks = tasks;
  }

  $init () {
    return null;
  }

  $getRunning () {
    return this._running;
  }

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

  _addTasks (tList, task) {
    // this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', rootLevel:', this._rootLevel, ', this != task:', this != task);

    _.forEach(tList, (funcName) => {
      let taskId = '';

      if ((this !== task) && !this._rootLevel) {
        taskId += task.name + '.';
      }
      taskId += funcName;

      if (funcName === this._defaultTaskFuncName) {
        taskId = 'default'; // set taskId to 'default'
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
  $addSubTasks (Task, config) {
    if (!this.beelzebub.isLoading()) {
      // console.error('$addSubTasks can only be called during init');
      return when.reject();
    }

    let task = null;
    if (_.isFunction(Task) && _.isObject(Task)) {
      config.parentPath = this.namePath;
      task = new Task(config);
    } else {
      task = Task;
    }

    // this.vLogger.log('$addSubTasks addInitFunction', task.name);
    this.beelzebub.addInitFunction(() => {
      return task.$register();
    });

    // this.vLogger.log('task:', task);
    this._subTasks[task.$getName()] = task;
  }

  _normalizeExecFuncToPromise (func, parent) {
    let p = null;
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

  _bfsTaskBuilder (outList, task, name) {
    let proto = Object.getPrototypeOf(task);
    // this.vLogger.log('task:', task, ', proto:', proto, ', name:', name);

    if (proto && _.isObject(proto)) {
      // this.vLogger.log('name:', name, ', task.name:', task.name);
      name = name || task.name;
      let oproto = this._bfsTaskBuilder(outList, proto, name);
      if (Object.getPrototypeOf(oproto) && !(oproto === BaseTasks.prototype)) {
        // this.vLogger.log('name:', name, 'oproto:', oproto, ', oproto instanceof BaseTasks:', (oproto === BaseTasks.prototype));

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
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  $sequence (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.sequence(this, ...args);
  }

  /**
   * Runs task(s) in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  $parallel (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.parallel(this, ...args);
  }

  /**
   * Runs task(s) - multi args run in sequence, arrays are run in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  $run (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.run(this, ...args);
  }

  /**
   * Internal Run task(s) in sequence
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  _sequence (parent, ...args) {
    // this.vLogger.log('sequence args:', args);

    if (_.isFunction(parent) || !_.isObject(parent)) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('sequence args:', args);
    }

    let aTasks = [];
    _.forEach(args, (task) => {
      aTasks.push(() => {
        return this._runPromiseTask(parent, task);
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
  _parallel (parent, ...args) {
    // this.vLogger.log('parallel args:', args);

    if (parent && !_.isObject(parent)) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('parallel args:', args);
    }

    let pList = _.map(args, (task) => {
      return this._runPromiseTask(parent, task);
    });

    // this.vLogger.log('parallel pList:', pList);
    return when.all(pList);
  }

  /**
   * Runs task(s) - multi args run in sequence, arrays are run in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  _run (parent, ...args) {
    let taskName = 'default';
    let promise = null;

    if (!_.isObject(parent)) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('run args:', args);
    }

    if (args.length === 1) {
      taskName = args[0];
      promise = this._runPromiseTask(parent, taskName);
    } else {
      // multi args mean, run in sequence
      promise = this._sequence(...args);
    }

    this._running = promise.then((result) => {
      this._running = null;
      return result;
    });

    return this._running.catch((e) => {
      this.logger.error(e);
    });
  }

    /**
     * run a task
     * @param task {String}
     * @returns {Promise}
     */
  // TODO: should this be private?
  _runTask (task) {
    let p = null;

    // wait for self to complete
    if (this.beelzebub.isLoading()) {
      p = this.beelzebub.getInitPromise();
    } else {
      p = when.resolve();
    }

    return p.then(() => {
      // this.vLogger.log('task class:', this.name
      //   , ', running task:', task
      //   , ', all tasks:', _.keys(this._tasks)
      //   , ', all subTasks:', _.keys(this._subTasks));

      // if no task specified, then use default
      if (!task || !task.length) {
        task = 'default';
      }

      if (_.isString(task)) {
        let taskParts = task.split('.');
        let taskUnderscored = task.split(':').join('_');
        let taskName = taskParts.shift();

        if (this._subTasks[taskName]) {
          return this._subTasks[taskName]._runTask(taskParts.join('.'));
        }
        else if (this.$getTask(taskUnderscored)) {
          let taskObj = this.$getTask(taskUnderscored);
          return this._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj);
        }
        else if (this.$getTask(taskName)) {
          let taskObj = this.$getTask(taskName);
          return this._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj);
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
  _runPromiseTask (parent, task) {
    let p = null;

    // if task is array, then run in parallel
    if (_.isArray(task)) {
      return this._parallel(parent, ...task);
    }

    // if task is string, then find function and parent in list
    if (_.isString(task)) {
      // if first char "." then relative to parent path
      if (task.charAt(0) === '.') {
        task = parent.namePath + task;
      }

      let taskParts = task.split('.');
      let taskName = taskParts.shift();

      if (!this._tasks.hasOwnProperty(taskName)) {
        // now check if in sub level
        if (this._subTasks.hasOwnProperty(taskName)) {
          p = this._subTasks[taskName]._runTask(taskParts.join('.'));
        } else {
          let error = 'task name not found: "' + task + '"';
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
            let error = 'task name not found: "' + task + '"';
            this.logger.error(error);
            p = when.reject(error);
          }
        }
      }
    }
    else if (_.isFunction(task)) {
      p = this._normalizeExecFuncToPromise(task, parent);
    }
    else {
      let error = 'task type not supported: "' + task + '"';
      this.logger.trace(error);
      p = when.reject(error);
    }

    // TODO: what happens to the data at the end? TBD
    return p;
  }
}

let BeelzebubMod = function (config) {
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
BeelzebubMod.sequence = function (...args) {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }
  return beelzebubInst.sequence.apply(beelzebubInst, args);
};
BeelzebubMod.parallel = function (...args) {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }
  return beelzebubInst.parallel.apply(beelzebubInst, args);
};
BeelzebubMod.run = function (...args) {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }
  return beelzebubInst.run.apply(beelzebubInst, args);
};
BeelzebubMod.printHelp = function (...args) {
  if (!beelzebubInst) {
    beelzebubInst = new Beelzebub();
  }
  return beelzebubInst.printHelp.apply(beelzebubInst, args);
};

BeelzebubMod.cli = function (config) {
  cli.version(manifest.version)
   .option('-f, --file <file>', 'Load file')
   .parse(process.argv);

  const currentDir = process.cwd();
  const bz = new Beelzebub(config || { verbose: true });
  const runTasks  = cli.args; // tasks to run
  let allTasks = [];

  // TODO: use transfuser
  function loadFile (tasks, file, displayError) {
    try {
      // need to join the current dir,
      // because require is relative to THIS file not the running process
      if (!path.isAbsolute(file)) {
        file = path.join(currentDir, file);
      }

      let fTasks = require(file);
      if (fTasks) {
        tasks = _.merge(tasks, fTasks);
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

  // console.info('BZ CLI file:', cli.file);
  if (cli.file) {
    allTasks = loadFile(allTasks, cli.file, true);
  }

  // check if beelzebub.js/json file
  allTasks = loadFile(allTasks, './beelzebub.js');
  allTasks = loadFile(allTasks, './beelzebub.json');
  allTasks = loadFile(allTasks, './bz.js');
  allTasks = loadFile(allTasks, './bz.json');

  if (!allTasks || !_.isArray(allTasks) || !allTasks.length) {
    console.error('No Tasks Loaded');
    process.exit();
    return;
  }

  if (!runTasks || !_.isArray(runTasks) || !runTasks.length) {
    console.error('No Tasks to Run');
    process.exit();
    return;
  }

  allTasks.map((task) => {
    bz.add(task);
  });

  bz.run(...runTasks);
  return bz;
};

// classes
BeelzebubMod.Tasks = BaseTasks;

// Decorators
BeelzebubMod.task = {
  default: (target, prop, descriptor) => {
    target.$defaultTask = prop;
  },

  help: (desc) => {
    return (target, prop, descriptor) => {
      if (!_.isObject(target.$helpDocs)) {
        target.$helpDocs = {};
      }
      target.$helpDocs[prop] = desc;
      // console.log('target:', target);
    };
  }
};

module.exports = BeelzebubMod;
